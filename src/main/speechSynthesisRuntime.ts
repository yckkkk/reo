import {
  workspaceError,
  type WorkspaceErrorEnvelope,
  type WorkspaceMemoryDetailProjection,
  type WorkspaceRequestSegmentSpeechSynthesisResponse,
  type WorkspaceRequestSegmentSupplementSpeechSynthesisResponse,
  type WorkspaceSnapshot,
  type VoiceSpeechSynthesisSpeaker,
} from '../workspace-contract/workspace-contract.js';
import {
  BackfillAlreadyRunningError,
  createBackfillQueue,
  type BackfillQueueBatchEnqueueResult,
  type BackfillQueueErrorCode,
  type BackfillQueueRunResult,
  type BackfillQueueTask,
  type BackfillTaskMode,
} from './backfillQueue.js';
import { readMemoryDetailFromFileTruth } from './memoryFiles.js';
import {
  markFinalizedNoteSegmentSpeechSynthesisFailed,
  markFinalizedNoteSegmentSupplementSpeechSynthesisFailed,
  readFinalizedNoteSegmentSpeechSynthesisSource,
  readFinalizedNoteSegmentSupplementSpeechSynthesisSource,
  saveFinalizedNoteSegmentSpeechSynthesis,
  saveFinalizedNoteSegmentSupplementSpeechSynthesis,
  type NoteSpeechSynthesisSaveResult,
  type NoteSpeechSynthesisSourceResult,
} from './noteDrafts.js';
import { synthesizeDoubaoTtsSpeech, type DoubaoTtsSynthesisResult } from './doubaoTtsClient.js';
import { plainTextFromMarkdown } from './markdownPlainText.js';
import type { VoiceSettingsStore } from './voiceSettingsStore.js';
import { readWorkspaceSnapshotFromIndex } from './workspaceFiles.js';

const SPEECH_SYNTHESIS_CHUNK_TEXT_LIMIT = 900;
const SPEECH_SYNTHESIS_TOTAL_TEXT_LIMIT = 18_000;
const SPEECH_SYNTHESIS_MAX_CHUNKS = 20;
const DEFAULT_AUTOMATIC_BATCH_LIMIT = 5;
const DEFAULT_AUTOMATIC_BREAKER_THRESHOLD = 3;

type AssertWorkspaceUsable = () => { readonly ok: true } | WorkspaceErrorEnvelope;

type SegmentInput = {
  readonly assertWorkspaceUsable: AssertWorkspaceUsable;
  readonly memoryId: string;
  readonly mode: BackfillTaskMode;
  readonly rootPath: string;
  readonly segmentId: string;
  readonly speaker?: VoiceSpeechSynthesisSpeaker;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
};

type SupplementInput = SegmentInput & {
  readonly supplementId: string;
};

type ReadSegmentSource = typeof readFinalizedNoteSegmentSpeechSynthesisSource;
type ReadSupplementSource = typeof readFinalizedNoteSegmentSupplementSpeechSynthesisSource;
type SaveSegmentSpeech = typeof saveFinalizedNoteSegmentSpeechSynthesis;
type SaveSupplementSpeech = typeof saveFinalizedNoteSegmentSupplementSpeechSynthesis;
type MarkSegmentSpeechFailed = typeof markFinalizedNoteSegmentSpeechSynthesisFailed;
type MarkSupplementSpeechFailed = typeof markFinalizedNoteSegmentSupplementSpeechSynthesisFailed;
type SpeechSynthesisResponse =
  | WorkspaceRequestSegmentSpeechSynthesisResponse
  | WorkspaceRequestSegmentSupplementSpeechSynthesisResponse;
type ReadyNoteSpeechSynthesisSource = Extract<
  NoteSpeechSynthesisSourceResult,
  { readonly ok: true }
>;
type SpeechSegmentTask = Omit<
  Extract<BackfillQueueTask, { readonly kind: 'segment' }>,
  'assertWorkspaceUsable' | 'rootPath'
> & {
  readonly assertWorkspaceUsable: AssertWorkspaceUsable;
  readonly rootPath: string;
  readonly speaker?: VoiceSpeechSynthesisSpeaker;
  readonly sourceSnapshot?: ReadyNoteSpeechSynthesisSource;
  readonly speechText?: string;
};
type SpeechSupplementTask = Omit<
  Extract<BackfillQueueTask, { readonly kind: 'supplement' }>,
  'assertWorkspaceUsable' | 'rootPath'
> & {
  readonly assertWorkspaceUsable: AssertWorkspaceUsable;
  readonly rootPath: string;
  readonly speaker?: VoiceSpeechSynthesisSpeaker;
  readonly sourceSnapshot?: ReadyNoteSpeechSynthesisSource;
  readonly speechText?: string;
};
type SpeechRuntimeTask = SpeechSegmentTask | SpeechSupplementTask;

type ReadWorkspaceSnapshot = (input: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly rootPath: string;
  readonly workspaceId: string;
}) => Promise<{ readonly ok: true; readonly snapshot: WorkspaceSnapshot } | WorkspaceErrorEnvelope>;

type ReadMemoryDetail = (input: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly memoryId: string;
  readonly rootPath: string;
  readonly workspaceId: string;
}) => Promise<
  { readonly ok: true; readonly value: WorkspaceMemoryDetailProjection } | WorkspaceErrorEnvelope
>;

export type CreateWorkspaceSpeechSynthesisRuntimeInput = {
  readonly automaticBatchLimit?: number;
  readonly automaticBreakerThreshold?: number;
  readonly readMemoryDetail?: ReadMemoryDetail;
  readonly readSegmentSource?: ReadSegmentSource;
  readonly readSupplementSource?: ReadSupplementSource;
  readonly readWorkspaceSnapshot?: ReadWorkspaceSnapshot;
  readonly saveSegmentSpeech?: SaveSegmentSpeech;
  readonly saveSupplementSpeech?: SaveSupplementSpeech;
  readonly markSegmentSpeechFailed?: MarkSegmentSpeechFailed;
  readonly markSupplementSpeechFailed?: MarkSupplementSpeechFailed;
  readonly synthesize?: typeof synthesizeDoubaoTtsSpeech;
  readonly voiceSettingsStore: Pick<VoiceSettingsStore, 'read' | 'readDecryptedApiKey'>;
};

type AutomaticWorkspaceInput = {
  readonly assertWorkspaceUsable: AssertWorkspaceUsable;
  readonly isCurrent?: () => boolean;
  readonly rootPath: string;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
};

export type SpeechSynthesisBatchTarget =
  | {
      readonly kind: 'segment';
      readonly memoryId: string;
      readonly segmentId: string;
      readonly workspaceId: string;
    }
  | {
      readonly kind: 'supplement';
      readonly memoryId: string;
      readonly segmentId: string;
      readonly supplementId: string;
      readonly workspaceId: string;
    };

export type SpeechSynthesisBatchResult = {
  readonly failed: number;
  readonly failedTargets: readonly SpeechSynthesisBatchTarget[];
  readonly generated: number;
  readonly skipped: number;
  readonly speaker: VoiceSpeechSynthesisSpeaker;
  readonly total: number;
};
type PreparedNoteSpeech =
  | {
      readonly action: 'skip';
      readonly ok: true;
      readonly speechSynthesis: ReadyNoteSpeechSynthesisSource['speechSynthesis'];
    }
  | {
      readonly action: 'save';
      readonly audio: Uint8Array;
      readonly expectedContentHash: string;
      readonly ok: true;
      readonly speaker: VoiceSpeechSynthesisSpeaker;
    };
type ResolvedSpeechSource =
  | {
      readonly action: 'skip';
      readonly ok: true;
      readonly speechSynthesis: ReadyNoteSpeechSynthesisSource['speechSynthesis'];
    }
  | {
      readonly action: 'use';
      readonly ok: true;
      readonly source: ReadyNoteSpeechSynthesisSource;
      readonly speechText?: string;
    };

function splitSpeechSynthesisText(text: string): readonly string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return [];
  }
  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > SPEECH_SYNTHESIS_CHUNK_TEXT_LIMIT) {
    const candidate = remaining.slice(0, SPEECH_SYNTHESIS_CHUNK_TEXT_LIMIT + 1);
    const boundary = bestSpeechChunkBoundary(candidate);
    chunks.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }
  if (remaining.length > 0) {
    chunks.push(remaining);
  }
  return chunks;
}

function bestSpeechChunkBoundary(text: string): number {
  const punctuationBoundary = Math.max(
    text.lastIndexOf('。'),
    text.lastIndexOf('！'),
    text.lastIndexOf('？'),
    text.lastIndexOf('；'),
    text.lastIndexOf('.'),
    text.lastIndexOf('!'),
    text.lastIndexOf('?'),
    text.lastIndexOf(';')
  );
  if (punctuationBoundary >= SPEECH_SYNTHESIS_CHUNK_TEXT_LIMIT * 0.5) {
    return punctuationBoundary + 1;
  }
  const whitespaceBoundary = text.lastIndexOf(' ', SPEECH_SYNTHESIS_CHUNK_TEXT_LIMIT);
  if (whitespaceBoundary >= SPEECH_SYNTHESIS_CHUNK_TEXT_LIMIT * 0.5) {
    return whitespaceBoundary;
  }
  return SPEECH_SYNTHESIS_CHUNK_TEXT_LIMIT;
}

function concatAudioChunks(chunks: readonly Uint8Array[]): Uint8Array {
  const byteLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function voiceSettingsReady(
  voiceSettingsStore: Pick<VoiceSettingsStore, 'read' | 'readDecryptedApiKey'>
): { readonly apiKey: string; readonly ok: true } | WorkspaceErrorEnvelope {
  const settings = voiceSettingsStore.read();
  const apiKey = voiceSettingsStore.readDecryptedApiKey();
  if (settings.lastSpeechSynthesisValidationCode === 'auth') {
    return workspaceError('ERR_SPEECH_SYNTHESIS_AUTH_FAILED', 'Speech synthesis key is invalid');
  }
  if (!settings.enabled || !settings.apiKeyConfigured || !apiKey) {
    return workspaceError('ERR_SPEECH_SYNTHESIS_UNAVAILABLE', 'Speech synthesis is unavailable');
  }
  return { apiKey, ok: true };
}

function synthesisErrorResponse(
  result: Extract<DoubaoTtsSynthesisResult, { readonly ok: false }>
): WorkspaceErrorEnvelope {
  if (result.errorCode === 'auth') {
    return workspaceError('ERR_SPEECH_SYNTHESIS_AUTH_FAILED', 'Speech synthesis key is invalid');
  }
  return workspaceError('ERR_SPEECH_SYNTHESIS_UNAVAILABLE', 'Speech synthesis failed');
}

function shouldSkipFillMissing({
  source,
  taskSource,
}: {
  readonly source: Extract<NoteSpeechSynthesisSourceResult, { readonly ok: true }>;
  readonly taskSource: SpeechRuntimeTask['source'];
}) {
  if (taskSource === 'auto' && source.speechSynthesis.status === 'failed') {
    return true;
  }
  return source.speechSynthesis.status === 'ready';
}

function shouldMarkSpeechSynthesisFailed(
  response: WorkspaceErrorEnvelope,
  signal: AbortSignal | undefined
) {
  if (signal?.aborted) {
    return false;
  }
  return ![
    'ERR_SPEECH_SYNTHESIS_AUTH_FAILED',
    'ERR_SPEECH_SYNTHESIS_NOTE_CHANGED',
    'ERR_SPEECH_SYNTHESIS_TARGET_NOT_ELIGIBLE',
    'ERR_SPEECH_SYNTHESIS_TEXT_EMPTY',
  ].includes(response.error.code);
}

function speechSynthesisFailureReason(response: WorkspaceErrorEnvelope) {
  return response.error.code === 'ERR_SPEECH_SYNTHESIS_TEXT_TOO_LONG'
    ? ('text-too-long' as const)
    : undefined;
}

async function maybeMarkSpeechSynthesisFailed({
  markFailed,
  response,
  signal,
  task,
}: {
  readonly markFailed: () => Promise<NoteSpeechSynthesisSaveResult>;
  readonly response: WorkspaceErrorEnvelope;
  readonly signal?: AbortSignal;
  readonly task: SpeechRuntimeTask;
}): Promise<void> {
  const reason = speechSynthesisFailureReason(response);
  if (
    (task.source !== 'auto' && reason !== 'text-too-long') ||
    !shouldMarkSpeechSynthesisFailed(response, signal)
  ) {
    return;
  }
  await markFailed().catch(() => {});
}

async function prepareNoteSpeech({
  apiKey,
  signal,
  source,
  speechText,
  speaker,
  synthesize,
  task,
}: {
  readonly apiKey: string;
  readonly signal?: AbortSignal;
  readonly source: ReadyNoteSpeechSynthesisSource;
  readonly speechText?: string;
  readonly speaker: VoiceSpeechSynthesisSpeaker;
  readonly synthesize: typeof synthesizeDoubaoTtsSpeech;
  readonly task: SpeechRuntimeTask;
}): Promise<PreparedNoteSpeech | WorkspaceErrorEnvelope> {
  if (task.mode === 'fill-missing' && shouldSkipFillMissing({ source, taskSource: task.source })) {
    return { action: 'skip', ok: true, speechSynthesis: source.speechSynthesis };
  }
  const text = speechText ?? plainTextFromMarkdown(source.bodyMarkdown);
  if (text.length === 0) {
    return workspaceError('ERR_SPEECH_SYNTHESIS_TEXT_EMPTY', 'Note text is empty');
  }
  if (text.length > SPEECH_SYNTHESIS_TOTAL_TEXT_LIMIT) {
    return workspaceError('ERR_SPEECH_SYNTHESIS_TEXT_TOO_LONG', 'Note text is too long');
  }
  const chunks = splitSpeechSynthesisText(text);
  if (chunks.length > SPEECH_SYNTHESIS_MAX_CHUNKS) {
    return workspaceError('ERR_SPEECH_SYNTHESIS_TEXT_TOO_LONG', 'Note text is too long');
  }
  const audioChunks: Uint8Array[] = [];
  for (const chunk of chunks) {
    if (signal?.aborted) {
      return workspaceError('ERR_SPEECH_SYNTHESIS_UNAVAILABLE', 'Speech synthesis was canceled');
    }
    const synthesized = await synthesize({
      apiKey,
      ...(signal ? { signal } : {}),
      speaker,
      text: chunk,
    });
    if (!synthesized.ok) {
      return synthesisErrorResponse(synthesized);
    }
    audioChunks.push(synthesized.audio);
  }
  return {
    action: 'save',
    audio: concatAudioChunks(audioChunks),
    expectedContentHash: source.contentHash,
    ok: true,
    speaker,
  };
}

async function resolveFreshSpeechSource<TTask extends SpeechRuntimeTask>({
  readSource,
  task,
}: {
  readonly readSource: (task: TTask) => Promise<NoteSpeechSynthesisSourceResult>;
  readonly task: TTask;
}): Promise<ResolvedSpeechSource | WorkspaceErrorEnvelope> {
  const snapshot = task.sourceSnapshot;
  if (!snapshot) {
    const source = await readSource(task);
    if (!source.ok) return source;
    return { action: 'use', ok: true, source };
  }

  const currentSource = await readSource(task);
  if (!currentSource.ok) return currentSource;
  if (currentSource.contentHash !== snapshot.contentHash) {
    if (task.source === 'auto') {
      return { action: 'skip', ok: true, speechSynthesis: currentSource.speechSynthesis };
    }
    return workspaceError('ERR_SPEECH_SYNTHESIS_NOTE_CHANGED', 'Note changed before save');
  }
  return {
    action: 'use',
    ok: true,
    source: currentSource,
    speechText: plainTextFromMarkdown(currentSource.bodyMarkdown),
  };
}

async function synthesizeAndSaveSegment({
  markFailed,
  readSource,
  saveSpeech,
  signal,
  synthesize,
  task,
  voiceSettingsStore,
}: {
  readonly markFailed: MarkSegmentSpeechFailed;
  readonly readSource: ReadSegmentSource;
  readonly saveSpeech: SaveSegmentSpeech;
  readonly signal?: AbortSignal;
  readonly synthesize: typeof synthesizeDoubaoTtsSpeech;
  readonly task: SpeechSegmentTask;
  readonly voiceSettingsStore: Pick<VoiceSettingsStore, 'read' | 'readDecryptedApiKey'>;
}): Promise<WorkspaceRequestSegmentSpeechSynthesisResponse> {
  if (signal?.aborted) {
    return workspaceError('ERR_SPEECH_SYNTHESIS_UNAVAILABLE', 'Speech synthesis was canceled');
  }
  const usable = task.assertWorkspaceUsable();
  if (!usable.ok) return usable;
  const ready = voiceSettingsReady(voiceSettingsStore);
  if (!ready.ok) return ready;
  const resolvedSource = await resolveFreshSpeechSource({ readSource, task });
  if (!resolvedSource.ok) return resolvedSource;
  if (resolvedSource.action === 'skip') {
    return { ok: true, value: { speechSynthesis: resolvedSource.speechSynthesis } };
  }
  const source = resolvedSource.source;
  const speaker = task.speaker ?? voiceSettingsStore.read().speechSynthesisSpeaker;
  const { sourceSnapshot: _sourceSnapshot, speechText: _speechText, ...taskForWrite } = task;
  void _sourceSnapshot;
  void _speechText;
  const prepared = await prepareNoteSpeech({
    apiKey: ready.apiKey,
    ...(signal ? { signal } : {}),
    source,
    ...(resolvedSource.speechText
      ? { speechText: resolvedSource.speechText }
      : task.speechText
        ? { speechText: task.speechText }
        : {}),
    speaker,
    synthesize,
    task,
  });
  if (!prepared.ok) {
    const reason = speechSynthesisFailureReason(prepared);
    await maybeMarkSpeechSynthesisFailed({
      markFailed: () =>
        markFailed({
          ...taskForWrite,
          expectedContentHash: source.contentHash,
          ...(reason ? { reason } : {}),
          speaker,
        }),
      response: prepared,
      ...(signal ? { signal } : {}),
      task,
    });
    return prepared;
  }
  if (prepared.action === 'skip') {
    return { ok: true, value: { speechSynthesis: prepared.speechSynthesis } };
  }
  const saved = await saveSpeech({
    ...taskForWrite,
    allowOverwrite: task.mode === 'regenerate',
    audio: prepared.audio,
    expectedContentHash: prepared.expectedContentHash,
    speaker: prepared.speaker,
  });
  if (!saved.ok) return saved;
  return { ok: true, value: { speechSynthesis: saved.speechSynthesis } };
}

async function synthesizeAndSaveSupplement({
  markFailed,
  readSource,
  saveSpeech,
  signal,
  synthesize,
  task,
  voiceSettingsStore,
}: {
  readonly markFailed: MarkSupplementSpeechFailed;
  readonly readSource: ReadSupplementSource;
  readonly saveSpeech: SaveSupplementSpeech;
  readonly signal?: AbortSignal;
  readonly synthesize: typeof synthesizeDoubaoTtsSpeech;
  readonly task: SpeechSupplementTask;
  readonly voiceSettingsStore: Pick<VoiceSettingsStore, 'read' | 'readDecryptedApiKey'>;
}): Promise<WorkspaceRequestSegmentSupplementSpeechSynthesisResponse> {
  if (signal?.aborted) {
    return workspaceError('ERR_SPEECH_SYNTHESIS_UNAVAILABLE', 'Speech synthesis was canceled');
  }
  const usable = task.assertWorkspaceUsable();
  if (!usable.ok) return usable;
  const ready = voiceSettingsReady(voiceSettingsStore);
  if (!ready.ok) return ready;
  const resolvedSource = await resolveFreshSpeechSource({ readSource, task });
  if (!resolvedSource.ok) return resolvedSource;
  if (resolvedSource.action === 'skip') {
    return { ok: true, value: { speechSynthesis: resolvedSource.speechSynthesis } };
  }
  const source = resolvedSource.source;
  const speaker = task.speaker ?? voiceSettingsStore.read().speechSynthesisSpeaker;
  const { sourceSnapshot: _sourceSnapshot, speechText: _speechText, ...taskForWrite } = task;
  void _sourceSnapshot;
  void _speechText;
  const prepared = await prepareNoteSpeech({
    apiKey: ready.apiKey,
    ...(signal ? { signal } : {}),
    source,
    ...(resolvedSource.speechText
      ? { speechText: resolvedSource.speechText }
      : task.speechText
        ? { speechText: task.speechText }
        : {}),
    speaker,
    synthesize,
    task,
  });
  if (!prepared.ok) {
    const reason = speechSynthesisFailureReason(prepared);
    await maybeMarkSpeechSynthesisFailed({
      markFailed: () =>
        markFailed({
          ...taskForWrite,
          expectedContentHash: source.contentHash,
          ...(reason ? { reason } : {}),
          speaker,
        }),
      response: prepared,
      ...(signal ? { signal } : {}),
      task,
    });
    return prepared;
  }
  if (prepared.action === 'skip') {
    return { ok: true, value: { speechSynthesis: prepared.speechSynthesis } };
  }
  const saved = await saveSpeech({
    ...taskForWrite,
    allowOverwrite: task.mode === 'regenerate',
    audio: prepared.audio,
    expectedContentHash: prepared.expectedContentHash,
    speaker: prepared.speaker,
  });
  if (!saved.ok) return saved;
  return { ok: true, value: { speechSynthesis: saved.speechSynthesis } };
}

export function createWorkspaceSpeechSynthesisRuntime({
  automaticBatchLimit = DEFAULT_AUTOMATIC_BATCH_LIMIT,
  automaticBreakerThreshold = DEFAULT_AUTOMATIC_BREAKER_THRESHOLD,
  readMemoryDetail = readMemoryDetailFromFileTruth,
  readSegmentSource = readFinalizedNoteSegmentSpeechSynthesisSource,
  readSupplementSource = readFinalizedNoteSegmentSupplementSpeechSynthesisSource,
  readWorkspaceSnapshot = readWorkspaceSnapshotFromIndex,
  markSegmentSpeechFailed = markFinalizedNoteSegmentSpeechSynthesisFailed,
  markSupplementSpeechFailed = markFinalizedNoteSegmentSupplementSpeechSynthesisFailed,
  saveSegmentSpeech = saveFinalizedNoteSegmentSpeechSynthesis,
  saveSupplementSpeech = saveFinalizedNoteSegmentSupplementSpeechSynthesis,
  synthesize = synthesizeDoubaoTtsSpeech,
  voiceSettingsStore,
}: CreateWorkspaceSpeechSynthesisRuntimeInput) {
  let cancellationGeneration = 0;
  const automaticDrainKeys = new Set<string>();
  const queue = createBackfillQueue<SpeechSynthesisResponse>({
    automaticBatchLimit,
    automaticBreakerThreshold,
    runTask: async ({ signal, task }) =>
      executeSpeechSynthesisTask(task as SpeechRuntimeTask, {
        readSegmentSource,
        readSupplementSource,
        markSegmentSpeechFailed,
        markSupplementSpeechFailed,
        saveSegmentSpeech,
        saveSupplementSpeech,
        signal,
        synthesize,
        voiceSettingsStore,
      }),
  });

  async function runManualTask(task: SpeechRuntimeTask): Promise<SpeechSynthesisResponse> {
    try {
      const result = await queue.runManual(task);
      if (result.response) {
        return result.response;
      }
      if (!result.ok) {
        return speechSynthesisQueueErrorResponse(result.errorCode);
      }
      return speechSynthesisQueueErrorResponse('save-failed');
    } catch (error) {
      if (error instanceof BackfillAlreadyRunningError) {
        return workspaceError(
          'ERR_SPEECH_SYNTHESIS_ALREADY_RUNNING',
          'Speech synthesis target is already running'
        );
      }
      return workspaceError('ERR_SPEECH_SYNTHESIS_UNAVAILABLE', 'Speech synthesis is unavailable');
    }
  }

  async function enqueueAutomaticWorkspaceBatch(
    {
      assertWorkspaceUsable,
      isCurrent,
      rootPath,
      workspaceHandle,
      workspaceId,
    }: AutomaticWorkspaceInput,
    generation: number,
    visitedTargetKeys: Set<string>
  ): Promise<{
    readonly result: BackfillQueueBatchEnqueueResult;
    readonly tasks: readonly SpeechRuntimeTask[];
  }> {
    if (isCurrent?.() === false || generation !== cancellationGeneration) {
      return { result: { accepted: 0, capped: 0, duplicates: 0 }, tasks: [] };
    }
    try {
      const tasks = await scanWorkspaceSpeechSynthesisTasks(
        {
          assertWorkspaceUsable,
          ...(isCurrent ? { isCurrent } : {}),
          intent: 'automatic',
          limit: automaticBatchLimit + 1,
          rootPath,
          visitedTargetKeys,
          workspaceHandle,
          workspaceId,
        },
        {
          readMemoryDetail,
          readSegmentSource,
          readSupplementSource,
          readWorkspaceSnapshot,
        }
      );
      if (isCurrent?.() === false || generation !== cancellationGeneration) {
        return { result: { accepted: 0, capped: 0, duplicates: 0 }, tasks: [] };
      }
      const result = queue.enqueueAutomaticBatch(tasks);
      if (result.capped > 0) {
        for (const task of tasks.slice(-result.capped)) {
          visitedTargetKeys.delete(speechSynthesisTargetKey(speechSynthesisTargetFromTask(task)));
        }
      }
      return { result, tasks };
    } catch {
      return { result: { accepted: 0, capped: 0, duplicates: 0 }, tasks: [] };
    }
  }

  function awaitAcceptedAutomaticTasks(tasks: readonly SpeechRuntimeTask[]) {
    return Promise.allSettled(
      tasks.slice(0, automaticBatchLimit).map((task) => queue.awaitTask(task))
    );
  }

  function maybeContinueAutomaticWorkspace({
    generation,
    input,
    result,
    tasks,
    visitedTargetKeys,
  }: {
    readonly generation: number;
    readonly input: AutomaticWorkspaceInput;
    readonly result: BackfillQueueBatchEnqueueResult;
    readonly tasks: readonly SpeechRuntimeTask[];
    readonly visitedTargetKeys: Set<string>;
  }) {
    if (result.accepted === 0 || result.capped === 0) {
      return;
    }
    const key = `${input.workspaceId}:${input.workspaceHandle}`;
    if (automaticDrainKeys.has(key)) {
      return;
    }
    automaticDrainKeys.add(key);
    void (async () => {
      try {
        let nextTasks = tasks;
        let nextResult = result;
        while (
          nextResult.accepted > 0 &&
          nextResult.capped > 0 &&
          generation === cancellationGeneration &&
          input.isCurrent?.() !== false
        ) {
          await awaitAcceptedAutomaticTasks(nextTasks);
          if (generation !== cancellationGeneration || input.isCurrent?.() === false) {
            return;
          }
          const next = await enqueueAutomaticWorkspaceBatch(input, generation, visitedTargetKeys);
          nextResult = next.result;
          nextTasks = next.tasks;
        }
      } finally {
        automaticDrainKeys.delete(key);
      }
    })();
  }

  async function enqueueAutomaticWorkspace(
    input: AutomaticWorkspaceInput
  ): Promise<BackfillQueueBatchEnqueueResult> {
    const generation = cancellationGeneration;
    if (!voiceSettingsReady(voiceSettingsStore).ok) {
      return { accepted: 0, capped: 0, duplicates: 0 };
    }
    const visitedTargetKeys = new Set<string>();
    const { result, tasks } = await enqueueAutomaticWorkspaceBatch(
      input,
      generation,
      visitedTargetKeys
    );
    maybeContinueAutomaticWorkspace({ generation, input, result, tasks, visitedTargetKeys });
    return result;
  }

  async function regenerateWorkspaceSpeechSynthesis({
    assertWorkspaceUsable,
    isCurrent,
    rootPath,
    speaker,
    targets,
    workspaceHandle,
    workspaceId,
  }: AutomaticWorkspaceInput & {
    readonly speaker: VoiceSpeechSynthesisSpeaker;
    readonly targets?: readonly SpeechSynthesisBatchTarget[];
  }): Promise<SpeechSynthesisBatchResult> {
    if (!voiceSettingsReady(voiceSettingsStore).ok) {
      return {
        failed: targets?.length ?? 0,
        failedTargets: targets ?? [],
        generated: 0,
        skipped: 0,
        speaker,
        total: targets?.length ?? 0,
      };
    }
    const targetKeys = targets ? new Set(targets.map(speechSynthesisTargetKey)) : undefined;
    const tasks = await scanWorkspaceSpeechSynthesisTasks(
      {
        assertWorkspaceUsable,
        ...(isCurrent ? { isCurrent } : {}),
        ...(targetKeys ? { targetKeys } : {}),
        intent: 'regenerate',
        limit: Number.MAX_SAFE_INTEGER,
        rootPath,
        speaker,
        workspaceHandle,
        workspaceId,
      },
      {
        readMemoryDetail,
        readSegmentSource,
        readSupplementSource,
        readWorkspaceSnapshot,
      }
    );

    const failedTargets: SpeechSynthesisBatchTarget[] = [];
    let generated = 0;
    for (const task of tasks) {
      if (isCurrent?.() === false) {
        failedTargets.push(speechSynthesisTargetFromTask(task));
        continue;
      }
      const response = await runManualTask(task);
      if (response.ok) {
        generated += 1;
      } else {
        failedTargets.push(speechSynthesisTargetFromTask(task));
      }
    }

    const skipped = targetKeys ? Math.max(0, targetKeys.size - tasks.length) : 0;
    return {
      failed: failedTargets.length,
      failedTargets,
      generated,
      skipped,
      speaker,
      total: tasks.length + skipped,
    };
  }

  return {
    cancelAll: (reason: 'app-quit' | 'lock-lost' | 'workspace-switch') => {
      cancellationGeneration += 1;
      queue.cancelAll(reason);
    },
    cancelAllAndDrain: async (reason: 'app-quit' | 'lock-lost' | 'workspace-switch') => {
      cancellationGeneration += 1;
      await queue.cancelAllAndDrain(reason);
    },
    enqueueAutomaticWorkspace,
    pause: queue.pause,
    regenerateWorkspaceSpeechSynthesis,
    requestSegmentSpeechSynthesis(
      input: SegmentInput
    ): Promise<WorkspaceRequestSegmentSpeechSynthesisResponse> {
      return runManualTask({
        ...input,
        kind: 'segment',
        source: 'manual',
      }) as Promise<WorkspaceRequestSegmentSpeechSynthesisResponse>;
    },
    requestSupplementSpeechSynthesis(
      input: SupplementInput
    ): Promise<WorkspaceRequestSegmentSupplementSpeechSynthesisResponse> {
      return runManualTask({
        ...input,
        kind: 'supplement',
        source: 'manual',
      }) as Promise<WorkspaceRequestSegmentSupplementSpeechSynthesisResponse>;
    },
    resume: queue.resume,
  };
}

export type WorkspaceSpeechSynthesisRuntime = ReturnType<
  typeof createWorkspaceSpeechSynthesisRuntime
>;

async function executeSpeechSynthesisTask(
  task: SpeechRuntimeTask,
  {
    readSegmentSource,
    readSupplementSource,
    markSegmentSpeechFailed,
    markSupplementSpeechFailed,
    saveSegmentSpeech,
    saveSupplementSpeech,
    signal,
    synthesize,
    voiceSettingsStore,
  }: {
    readonly readSegmentSource: ReadSegmentSource;
    readonly readSupplementSource: ReadSupplementSource;
    readonly markSegmentSpeechFailed: MarkSegmentSpeechFailed;
    readonly markSupplementSpeechFailed: MarkSupplementSpeechFailed;
    readonly saveSegmentSpeech: SaveSegmentSpeech;
    readonly saveSupplementSpeech: SaveSupplementSpeech;
    readonly signal: AbortSignal;
    readonly synthesize: typeof synthesizeDoubaoTtsSpeech;
    readonly voiceSettingsStore: Pick<VoiceSettingsStore, 'read' | 'readDecryptedApiKey'>;
  }
): Promise<BackfillQueueRunResult<SpeechSynthesisResponse>> {
  if (signal.aborted) {
    return { errorCode: 'canceled', ok: false };
  }
  const response =
    task.kind === 'segment'
      ? await synthesizeAndSaveSegment({
          markFailed: markSegmentSpeechFailed,
          readSource: readSegmentSource,
          saveSpeech: saveSegmentSpeech,
          signal,
          synthesize,
          task,
          voiceSettingsStore,
        })
      : await synthesizeAndSaveSupplement({
          markFailed: markSupplementSpeechFailed,
          readSource: readSupplementSource,
          saveSpeech: saveSupplementSpeech,
          signal,
          synthesize,
          task,
          voiceSettingsStore,
        });
  if (response.ok) {
    return { ok: true, response, transcriptText: '' };
  }
  const errorCode = mapSpeechSynthesisErrorToQueueCode(response.error.code);
  if (
    task.source === 'auto' &&
    (errorCode === 'target-not-eligible' ||
      response.error.code === 'ERR_SPEECH_SYNTHESIS_TEXT_EMPTY' ||
      response.error.code === 'ERR_SPEECH_SYNTHESIS_TEXT_TOO_LONG')
  ) {
    return { ok: true, transcriptText: '' };
  }
  return { errorCode, ok: false, response };
}

function mapSpeechSynthesisErrorToQueueCode(errorCode: string): BackfillQueueErrorCode {
  switch (errorCode) {
    case 'ERR_SPEECH_SYNTHESIS_AUTH_FAILED':
    case 'ERR_SPEECH_SYNTHESIS_UNAVAILABLE':
      return 'auth';
    case 'ERR_SPEECH_SYNTHESIS_NOTE_CHANGED':
      return 'transcript-changed';
    case 'ERR_SPEECH_SYNTHESIS_TARGET_NOT_ELIGIBLE':
    case 'ERR_SPEECH_SYNTHESIS_TEXT_EMPTY':
    case 'ERR_SPEECH_SYNTHESIS_TEXT_TOO_LONG':
      return 'target-not-eligible';
    case 'ERR_SPEECH_SYNTHESIS_WRITE_FAILED':
      return 'save-failed';
    case 'ERR_WORKSPACE_LOCK_LOST':
      return 'lock-lost';
    default:
      return 'network';
  }
}

function speechSynthesisQueueErrorResponse(
  errorCode: BackfillQueueErrorCode
): WorkspaceErrorEnvelope {
  switch (errorCode) {
    case 'auth':
      return workspaceError('ERR_SPEECH_SYNTHESIS_AUTH_FAILED', 'Speech synthesis key is invalid');
    case 'target-not-eligible':
      return workspaceError(
        'ERR_SPEECH_SYNTHESIS_TARGET_NOT_ELIGIBLE',
        'Speech synthesis target is not eligible'
      );
    case 'transcript-changed':
      return workspaceError('ERR_SPEECH_SYNTHESIS_NOTE_CHANGED', 'Note changed before save');
    case 'save-failed':
      return workspaceError('ERR_SPEECH_SYNTHESIS_WRITE_FAILED', 'Speech could not be saved');
    default:
      return workspaceError('ERR_SPEECH_SYNTHESIS_UNAVAILABLE', 'Speech synthesis is unavailable');
  }
}

async function scanWorkspaceSpeechSynthesisTasks(
  {
    assertWorkspaceUsable,
    intent,
    isCurrent,
    limit,
    rootPath,
    speaker,
    targetKeys,
    visitedTargetKeys,
    workspaceHandle,
    workspaceId,
  }: {
    readonly assertWorkspaceUsable: AssertWorkspaceUsable;
    readonly intent: 'automatic' | 'regenerate';
    readonly isCurrent?: () => boolean;
    readonly limit: number;
    readonly rootPath: string;
    readonly speaker?: VoiceSpeechSynthesisSpeaker;
    readonly targetKeys?: ReadonlySet<string>;
    readonly visitedTargetKeys?: Set<string>;
    readonly workspaceHandle: string;
    readonly workspaceId: string;
  },
  {
    readMemoryDetail,
    readSegmentSource,
    readSupplementSource,
    readWorkspaceSnapshot,
  }: {
    readonly readMemoryDetail: ReadMemoryDetail;
    readonly readSegmentSource: ReadSegmentSource;
    readonly readSupplementSource: ReadSupplementSource;
    readonly readWorkspaceSnapshot: ReadWorkspaceSnapshot;
  }
): Promise<readonly SpeechRuntimeTask[]> {
  if (limit <= 0) {
    return [];
  }
  const snapshot = await readWorkspaceSnapshot({
    assertWorkspaceUsable,
    rootPath,
    workspaceId,
  });
  if (!snapshot.ok || isCurrent?.() === false) {
    return [];
  }

  const tasks: SpeechRuntimeTask[] = [];
  for (const memory of snapshot.snapshot.memories) {
    if (!memory.hasAnyNote || isCurrent?.() === false) {
      continue;
    }
    const detail = await readMemoryDetail({
      assertWorkspaceUsable,
      memoryId: memory.memoryId,
      rootPath,
      workspaceId,
    });
    if (!detail.ok) {
      continue;
    }
    await collectMemorySpeechSynthesisTasks({
      assertWorkspaceUsable,
      detail: detail.value,
      intent,
      limit,
      readSegmentSource,
      readSupplementSource,
      rootPath,
      ...(speaker ? { speaker } : {}),
      ...(targetKeys ? { targetKeys } : {}),
      ...(visitedTargetKeys ? { visitedTargetKeys } : {}),
      tasks,
      workspaceHandle,
      workspaceId,
    });
    if (tasks.length >= limit) {
      break;
    }
  }
  return tasks;
}

async function collectMemorySpeechSynthesisTasks({
  assertWorkspaceUsable,
  detail,
  intent,
  limit,
  readSegmentSource,
  readSupplementSource,
  rootPath,
  speaker,
  targetKeys,
  tasks,
  visitedTargetKeys,
  workspaceHandle,
  workspaceId,
}: {
  readonly assertWorkspaceUsable: AssertWorkspaceUsable;
  readonly detail: WorkspaceMemoryDetailProjection;
  readonly intent: 'automatic' | 'regenerate';
  readonly limit: number;
  readonly readSegmentSource: ReadSegmentSource;
  readonly readSupplementSource: ReadSupplementSource;
  readonly rootPath: string;
  readonly speaker?: VoiceSpeechSynthesisSpeaker;
  readonly targetKeys?: ReadonlySet<string>;
  readonly tasks: SpeechRuntimeTask[];
  readonly visitedTargetKeys?: Set<string>;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
}) {
  for (const segment of detail.segments) {
    if (tasks.length >= limit) {
      return;
    }
    if (segment.workspaceId !== workspaceId) {
      continue;
    }
    if (segment.type === 'note') {
      const target: SpeechSynthesisBatchTarget = {
        kind: 'segment',
        memoryId: detail.memoryId,
        segmentId: segment.segmentId,
        workspaceId,
      };
      if (!targetKeys || targetKeys.has(speechSynthesisTargetKey(target))) {
        const targetKey = speechSynthesisTargetKey(target);
        if (visitedTargetKeys?.has(targetKey)) {
          continue;
        }
        visitedTargetKeys?.add(targetKey);
        const source = await readSegmentSource({
          assertWorkspaceUsable,
          memoryId: detail.memoryId,
          rootPath,
          segmentId: segment.segmentId,
          workspaceId,
        });
        const speechText = source.ok ? plainTextFromMarkdown(source.bodyMarkdown) : '';
        const eligible =
          source.ok &&
          (intent === 'automatic'
            ? isAutomaticSpeechSynthesisEligible(source, speechText)
            : isRegenerationSpeechSynthesisEligible(speechText));
        if (eligible) {
          tasks.push({
            assertWorkspaceUsable,
            kind: 'segment',
            memoryId: detail.memoryId,
            mode: intent === 'automatic' ? 'fill-missing' : 'regenerate',
            rootPath,
            segmentId: segment.segmentId,
            ...(speaker ? { speaker } : {}),
            sourceSnapshot: source,
            source: intent === 'automatic' ? 'auto' : 'manual',
            speechText,
            workspaceHandle,
            workspaceId,
          });
        }
      }
    }
    for (const supplement of segment.supplements) {
      if (tasks.length >= limit) {
        return;
      }
      if (supplement.type !== 'note' || supplement.workspaceId !== workspaceId) {
        continue;
      }
      const target: SpeechSynthesisBatchTarget = {
        kind: 'supplement',
        memoryId: detail.memoryId,
        segmentId: segment.segmentId,
        supplementId: supplement.supplementId,
        workspaceId,
      };
      if (targetKeys && !targetKeys.has(speechSynthesisTargetKey(target))) {
        continue;
      }
      const targetKey = speechSynthesisTargetKey(target);
      if (visitedTargetKeys?.has(targetKey)) {
        continue;
      }
      visitedTargetKeys?.add(targetKey);
      const source = await readSupplementSource({
        assertWorkspaceUsable,
        memoryId: detail.memoryId,
        rootPath,
        segmentId: segment.segmentId,
        supplementId: supplement.supplementId,
        workspaceId,
      });
      const speechText = source.ok ? plainTextFromMarkdown(source.bodyMarkdown) : '';
      const eligible =
        source.ok &&
        (intent === 'automatic'
          ? isAutomaticSpeechSynthesisEligible(source, speechText)
          : isRegenerationSpeechSynthesisEligible(speechText));
      if (eligible) {
        tasks.push({
          assertWorkspaceUsable,
          kind: 'supplement',
          memoryId: detail.memoryId,
          mode: intent === 'automatic' ? 'fill-missing' : 'regenerate',
          rootPath,
          segmentId: segment.segmentId,
          ...(speaker ? { speaker } : {}),
          sourceSnapshot: source,
          source: intent === 'automatic' ? 'auto' : 'manual',
          speechText,
          supplementId: supplement.supplementId,
          workspaceHandle,
          workspaceId,
        });
      }
    }
  }
}

function isAutomaticSpeechSynthesisEligible(
  source: Extract<NoteSpeechSynthesisSourceResult, { readonly ok: true }>,
  speechText: string
): boolean {
  if (
    source.speechSynthesis.status === 'ready' ||
    source.speechSynthesis.status === 'failed' ||
    source.speechSynthesis.status === 'unsupported'
  ) {
    return false;
  }
  return speechText.length > 0;
}

function isRegenerationSpeechSynthesisEligible(speechText: string): boolean {
  return speechText.length > 0;
}

function speechSynthesisTargetKey(target: SpeechSynthesisBatchTarget): string {
  if (target.kind === 'segment') {
    return `${target.workspaceId}\0${target.memoryId}\0${target.segmentId}`;
  }
  return `${target.workspaceId}\0${target.memoryId}\0${target.segmentId}\0${target.supplementId}`;
}

function speechSynthesisTargetFromTask(task: SpeechRuntimeTask): SpeechSynthesisBatchTarget {
  if (task.kind === 'segment') {
    return {
      kind: 'segment',
      memoryId: task.memoryId,
      segmentId: task.segmentId,
      workspaceId: task.workspaceId,
    };
  }
  return {
    kind: 'supplement',
    memoryId: task.memoryId,
    segmentId: task.segmentId,
    supplementId: task.supplementId,
    workspaceId: task.workspaceId,
  };
}

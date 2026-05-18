import type {
  WorkspaceErrorEnvelope,
  WorkspaceMemoryDetailProjection,
  WorkspaceMemorySummary,
  WorkspaceSnapshot,
  WorkspaceRecordingMarkdownSaveResponse,
  WorkspaceSegmentSupplementMarkdownSaveResponse,
} from '../workspace-contract/workspace-contract.js';
import { BACKFILL_SCAN_FAILED_ERROR_CODE } from './backfillDiagnosticConstants.js';
import { workspaceError } from '../workspace-contract/workspace-contract.js';
import {
  prepareBackfillAudioData,
  BackfillAudioDataSourceError,
  BACKFILL_AUDIO_MAX_INPUT_BYTES,
} from './backfillAudioDataSource.js';
import { createBackfillDiagnostics, type BackfillDiagnostics } from './backfillDiagnostics.js';
import {
  BackfillAlreadyRunningError,
  createBackfillQueue,
  type BackfillTaskMode,
  type BackfillQueueBatchEnqueueResult,
  type BackfillQueueErrorCode,
  type BackfillQueueTask,
} from './backfillQueue.js';
import {
  addEligibleBackfillTargets,
  createBackfillTargetSelector,
  type BackfillScannerProjection,
  isBackfillEligibleProjection,
  isManualFillMissingEligibleProjection,
  normalizeBackfillTargetLimit,
  type BackfillEligibleTarget,
} from './backfillScanner.js';
import { recognizeDoubaoAucTurboAudioData } from './doubaoAucTurboClient.js';
import {
  readFinalizedSegmentAudioProjection,
  readFinalizedSegmentSupplementProjection,
  readMemoryDetailFromFileTruth,
} from './memoryFiles.js';
import {
  readFinalizedAudioSegmentBackfillSource,
  readFinalizedAudioSegmentSupplementBackfillSource,
  saveRecordingMarkdown,
  saveSegmentSupplementMarkdown,
} from './recordingDrafts.js';
import { transcriptDigest } from './transcriptDigest.js';
import type { VoiceSettingsStore } from './voiceSettingsStore.js';
import {
  readWorkspaceSnapshotFromFileTruth,
  readWorkspaceSnapshotFromIndex,
} from './workspaceFiles.js';

type AssertWorkspaceUsable = () => { readonly ok: true } | WorkspaceErrorEnvelope;

type BackfillRuntimeTask = BackfillQueueTask & {
  readonly assertWorkspaceUsable: AssertWorkspaceUsable;
  readonly rootPath: string;
};

type ReadFinalizedAudioResult =
  | {
      readonly audio: Uint8Array;
      readonly audioByteLength: number;
      readonly audioFileDescriptor?: never;
      readonly dispose?: never;
      readonly lastTranscriptionAttempt: 'failed' | 'never' | 'success';
      readonly ok: true;
      readonly transcript: { readonly exists: boolean; readonly text: string };
    }
  | {
      readonly audio?: never;
      readonly audioByteLength: number;
      readonly audioFileDescriptor: number;
      readonly dispose: () => void;
      readonly lastTranscriptionAttempt: 'failed' | 'never' | 'success';
      readonly ok: true;
      readonly transcript: { readonly exists: boolean; readonly text: string };
    }
  | WorkspaceErrorEnvelope;

type BackfillSavedResponse =
  | WorkspaceRecordingMarkdownSaveResponse
  | WorkspaceSegmentSupplementMarkdownSaveResponse;

type BackfillTargetProjectionInput =
  | {
      readonly assertWorkspaceUsable: AssertWorkspaceUsable;
      readonly kind: 'segment';
      readonly memoryId: string;
      readonly rootPath: string;
      readonly segmentId: string;
      readonly workspaceId: string;
    }
  | {
      readonly assertWorkspaceUsable: AssertWorkspaceUsable;
      readonly kind: 'supplement';
      readonly memoryId: string;
      readonly rootPath: string;
      readonly segmentId: string;
      readonly supplementId: string;
      readonly workspaceId: string;
    };

type ReadBackfillTargetProjection = (input: BackfillTargetProjectionInput) => Promise<
  | {
      readonly ok: true;
      readonly value: BackfillScannerProjection;
    }
  | WorkspaceErrorEnvelope
>;

function* createAutomaticBackfillTasks({
  assertWorkspaceUsable,
  rootPath,
  targets,
  workspaceHandle,
  workspaceId,
}: {
  readonly assertWorkspaceUsable: AssertWorkspaceUsable;
  readonly rootPath: string;
  readonly targets: readonly BackfillEligibleTarget[];
  readonly workspaceHandle: string;
  readonly workspaceId: string;
}): Iterable<BackfillRuntimeTask> {
  for (const target of targets) {
    if (target.workspaceId !== workspaceId) {
      continue;
    }
    yield {
      ...target,
      assertWorkspaceUsable,
      mode: 'fill-missing',
      rootPath,
      source: 'auto',
      workspaceHandle,
    };
  }
}

export type WorkspaceBackfillRuntime = {
  readonly cancelAll: (reason: 'app-quit' | 'lock-lost' | 'workspace-switch') => void;
  readonly cancelAllAndDrain: (
    reason: 'app-quit' | 'lock-lost' | 'workspace-switch'
  ) => Promise<void>;
  readonly enqueueAutomaticTargets: (input: {
    readonly assertWorkspaceUsable: AssertWorkspaceUsable;
    readonly rootPath: string;
    readonly targets: readonly BackfillEligibleTarget[];
    readonly workspaceHandle: string;
    readonly workspaceId: string;
    readonly isCurrent?: () => boolean;
  }) => Promise<BackfillQueueBatchEnqueueResult>;
  readonly enqueueAutomaticWorkspace: (input: {
    readonly assertWorkspaceUsable: AssertWorkspaceUsable;
    readonly isCurrent?: () => boolean;
    readonly rootPath: string;
    readonly workspaceHandle: string;
    readonly workspaceId: string;
  }) => Promise<BackfillQueueBatchEnqueueResult>;
  readonly pause: (reason: 'recording') => void;
  readonly requestSegmentBackfill: (input: {
    readonly assertWorkspaceUsable: AssertWorkspaceUsable;
    readonly memoryId: string;
    readonly mode: BackfillTaskMode;
    readonly rootPath: string;
    readonly segmentId: string;
    readonly workspaceHandle: string;
    readonly workspaceId: string;
  }) => Promise<WorkspaceRecordingMarkdownSaveResponse>;
  readonly requestSupplementBackfill: (input: {
    readonly assertWorkspaceUsable: AssertWorkspaceUsable;
    readonly memoryId: string;
    readonly mode: BackfillTaskMode;
    readonly rootPath: string;
    readonly segmentId: string;
    readonly supplementId: string;
    readonly workspaceHandle: string;
    readonly workspaceId: string;
  }) => Promise<WorkspaceSegmentSupplementMarkdownSaveResponse>;
  readonly resume: (reason: 'recording') => void;
};

export type CreateWorkspaceBackfillRuntimeInput = {
  readonly automaticBatchLimit?: number;
  readonly automaticBreakerThreshold?: number;
  readonly diagnostics?: BackfillDiagnostics;
  readonly prepareAudioData?: typeof prepareBackfillAudioData;
  readonly readMemoryDetail?: (input: {
    readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
    readonly memoryId: string;
    readonly rootPath: string;
    readonly workspaceId: string;
  }) => Promise<
    { readonly ok: true; readonly value: WorkspaceMemoryDetailProjection } | WorkspaceErrorEnvelope
  >;
  readonly readBackfillTargetProjection?: ReadBackfillTargetProjection;
  readonly readSegmentAudio?: (input: {
    readonly assertWorkspaceUsable: AssertWorkspaceUsable;
    readonly maxBytes?: number;
    readonly memoryId: string;
    readonly rootPath: string;
    readonly segmentId: string;
    readonly transcriptReadMode?: 'read' | 'assume-missing';
  }) => Promise<ReadFinalizedAudioResult>;
  readonly readSupplementAudio?: (input: {
    readonly assertWorkspaceUsable: AssertWorkspaceUsable;
    readonly maxBytes?: number;
    readonly memoryId: string;
    readonly rootPath: string;
    readonly segmentId: string;
    readonly supplementId: string;
    readonly transcriptReadMode?: 'read' | 'assume-missing';
    readonly workspaceId: string;
  }) => Promise<ReadFinalizedAudioResult>;
  readonly recognize?: typeof recognizeDoubaoAucTurboAudioData;
  readonly readWorkspaceSnapshot?: (input: {
    readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
    readonly rootPath: string;
    readonly workspaceId: string;
  }) => Promise<
    { readonly ok: true; readonly snapshot: WorkspaceSnapshot } | WorkspaceErrorEnvelope
  >;
  readonly refreshWorkspaceSnapshot?: (input: {
    readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
    readonly rootPath: string;
    readonly workspaceId: string;
  }) => Promise<
    { readonly ok: true; readonly snapshot: WorkspaceSnapshot } | WorkspaceErrorEnvelope
  >;
  readonly saveSegmentTranscript?: typeof saveRecordingMarkdown;
  readonly saveSupplementTranscript?: typeof saveSegmentSupplementMarkdown;
  readonly voiceSettingsStore: Pick<VoiceSettingsStore, 'read' | 'readDecryptedApiKey'>;
};

export function createWorkspaceBackfillRuntime({
  automaticBatchLimit = 20,
  automaticBreakerThreshold = 3,
  diagnostics = createBackfillDiagnostics(),
  prepareAudioData = prepareBackfillAudioData,
  readMemoryDetail = readMemoryDetailFromFileTruth,
  readBackfillTargetProjection,
  readSegmentAudio = readFinalizedAudioSegmentBackfillSource,
  readSupplementAudio = readFinalizedAudioSegmentSupplementBackfillSource,
  recognize = recognizeDoubaoAucTurboAudioData,
  readWorkspaceSnapshot = readWorkspaceSnapshotFromIndex,
  refreshWorkspaceSnapshot = readWorkspaceSnapshotFromFileTruth,
  saveSegmentTranscript = saveRecordingMarkdown,
  saveSupplementTranscript = saveSegmentSupplementMarkdown,
  voiceSettingsStore,
}: CreateWorkspaceBackfillRuntimeInput): WorkspaceBackfillRuntime {
  let cancellationGeneration = 0;
  const effectiveReadBackfillTargetProjection =
    readBackfillTargetProjection ??
    (readMemoryDetail === readMemoryDetailFromFileTruth
      ? readBackfillTargetProjectionFromFileTruth
      : (input: BackfillTargetProjectionInput) =>
          readBackfillTargetProjectionFromMemoryDetail(input, { readMemoryDetail }));
  const queue = createBackfillQueue<BackfillSavedResponse>({
    automaticBatchLimit,
    automaticBreakerThreshold,
    onEvent: (event) => diagnostics.record(event.event, event.fields, event.level),
    runTask: async ({ signal, task }) => {
      const result = await executeBackfillTask(task as BackfillRuntimeTask, {
        readMemoryDetail,
        readBackfillTargetProjection: effectiveReadBackfillTargetProjection,
        readSegmentAudio,
        readSupplementAudio,
        recognize,
        saveSegmentTranscript,
        saveSupplementTranscript,
        prepareAudioData,
        signal,
        voiceSettingsStore,
      });
      if (result.ok) {
        return {
          ok: true,
          ...(result.response ? { response: result.response } : {}),
          transcriptText: result.transcriptText,
        };
      }
      return {
        errorCode: result.errorCode,
        ok: false,
        ...(result.response ? { response: result.response } : {}),
      };
    },
  });

  async function runManualTask(task: BackfillRuntimeTask): Promise<BackfillSavedResponse> {
    try {
      const result = await queue.runManual(task);
      if (result.response) {
        return result.response;
      }
      if (!result.ok) {
        return backfillErrorResponse(result.errorCode) as BackfillSavedResponse;
      }
      return backfillErrorResponse('save-failed') as BackfillSavedResponse;
    } catch (error) {
      if (error instanceof BackfillAlreadyRunningError) {
        return workspaceError('ERR_BACKFILL_ALREADY_RUNNING', 'Backfill target is already running');
      }
      return workspaceError('ERR_BACKFILL_UNAVAILABLE', 'Backfill is unavailable');
    }
  }

  async function enqueueAutomaticTargets({
    assertWorkspaceUsable,
    rootPath,
    targets,
    workspaceHandle,
    workspaceId,
    isCurrent,
  }: {
    readonly assertWorkspaceUsable: AssertWorkspaceUsable;
    readonly rootPath: string;
    readonly targets: readonly BackfillEligibleTarget[];
    readonly workspaceHandle: string;
    readonly workspaceId: string;
    readonly isCurrent?: () => boolean;
  }): Promise<BackfillQueueBatchEnqueueResult> {
    const generation = cancellationGeneration;
    if (isCurrent?.() === false || generation !== cancellationGeneration) {
      return { accepted: 0, capped: 0, duplicates: 0 };
    }
    return queue.enqueueAutomaticBatch(
      createAutomaticBackfillTasks({
        assertWorkspaceUsable,
        rootPath,
        targets,
        workspaceHandle,
        workspaceId,
      })
    );
  }

  async function enqueueAutomaticWorkspace({
    assertWorkspaceUsable,
    isCurrent,
    rootPath,
    workspaceHandle,
    workspaceId,
  }: {
    readonly assertWorkspaceUsable: AssertWorkspaceUsable;
    readonly isCurrent?: () => boolean;
    readonly rootPath: string;
    readonly workspaceHandle: string;
    readonly workspaceId: string;
  }): Promise<BackfillQueueBatchEnqueueResult> {
    const generation = cancellationGeneration;
    if (isCurrent?.() === false) {
      return { accepted: 0, capped: 0, duplicates: 0 };
    }
    diagnostics.record('scan-started', {}, 'info');
    try {
      const targets = await scanWorkspaceBackfillTargets(
        {
          assertWorkspaceUsable,
          ...(isCurrent ? { isCurrent } : {}),
          limit: automaticBatchLimit,
          rootPath,
          workspaceId,
        },
        { readMemoryDetail, readWorkspaceSnapshot, refreshWorkspaceSnapshot }
      );
      if (isCurrent?.() === false || generation !== cancellationGeneration) {
        return { accepted: 0, capped: 0, duplicates: 0 };
      }
      diagnostics.record('scan-completed', { taskCount: targets.length }, 'info');
      return enqueueAutomaticTargets({
        assertWorkspaceUsable,
        rootPath,
        targets,
        workspaceHandle,
        workspaceId,
        ...(isCurrent ? { isCurrent } : {}),
      });
    } catch {
      diagnostics.record(
        BACKFILL_SCAN_FAILED_ERROR_CODE,
        {
          errorCode: BACKFILL_SCAN_FAILED_ERROR_CODE,
        },
        'warn'
      );
      return { accepted: 0, capped: 0, duplicates: 0 };
    }
  }

  return {
    cancelAll: (reason) => {
      cancellationGeneration += 1;
      queue.cancelAll(reason);
    },
    cancelAllAndDrain: async (reason) => {
      cancellationGeneration += 1;
      await queue.cancelAllAndDrain(reason);
    },
    enqueueAutomaticTargets,
    enqueueAutomaticWorkspace,
    pause: queue.pause,
    requestSegmentBackfill: async (input) =>
      (await runManualTask({
        ...input,
        kind: 'segment',
        mode: input.mode,
        source: 'manual',
      })) as WorkspaceRecordingMarkdownSaveResponse,
    requestSupplementBackfill: async (input) =>
      (await runManualTask({
        ...input,
        kind: 'supplement',
        mode: input.mode,
        source: 'manual',
      })) as WorkspaceSegmentSupplementMarkdownSaveResponse,
    resume: queue.resume,
  };
}

async function executeBackfillTask(
  task: BackfillRuntimeTask,
  {
    readBackfillTargetProjection,
    readSegmentAudio,
    readSupplementAudio,
    recognize,
    saveSegmentTranscript,
    saveSupplementTranscript,
    prepareAudioData,
    signal,
    voiceSettingsStore,
  }: Required<
    Pick<
      CreateWorkspaceBackfillRuntimeInput,
      | 'readMemoryDetail'
      | 'readBackfillTargetProjection'
      | 'readSegmentAudio'
      | 'readSupplementAudio'
      | 'recognize'
      | 'saveSegmentTranscript'
      | 'saveSupplementTranscript'
      | 'prepareAudioData'
    >
  > & {
    readonly signal: AbortSignal;
    readonly voiceSettingsStore: Pick<VoiceSettingsStore, 'read' | 'readDecryptedApiKey'>;
  }
): Promise<
  | {
      readonly ok: true;
      readonly response?: BackfillSavedResponse;
      readonly transcriptText: string;
    }
  | {
      readonly errorCode: BackfillQueueErrorCode;
      readonly ok: false;
      readonly response?: BackfillSavedResponse;
    }
> {
  if (signal.aborted) {
    return { errorCode: 'canceled', ok: false };
  }
  const settings = voiceSettingsStore.read();
  if (!settings.enabled || !settings.apiKeyConfigured || settings.lastValidationOk !== true) {
    return { errorCode: 'auth', ok: false };
  }
  const apiKey = voiceSettingsStore.readDecryptedApiKey();
  if (!apiKey) {
    return { errorCode: 'auth', ok: false };
  }
  if (task.mode === 'fill-missing') {
    const eligibility = await readCurrentBackfillEligibility(task, {
      readBackfillTargetProjection,
    });
    if (!eligibility.ok) {
      if (task.source === 'auto' && eligibility.errorCode === 'target-not-eligible') {
        return { ok: true, transcriptText: '' };
      }
      return eligibility;
    }
  }
  if (signal.aborted) {
    return { errorCode: 'canceled', ok: false };
  }
  const audio = await readTaskAudio(task, { readSegmentAudio, readSupplementAudio });
  if (!audio.ok) {
    return { errorCode: mapWorkspaceAudioReadError(audio), ok: false };
  }
  const fillMissingEligible =
    task.source === 'auto'
      ? isBackfillEligibleProjection(audio)
      : isManualFillMissingEligibleProjection(audio);
  if (task.mode === 'fill-missing' && !fillMissingEligible) {
    if (task.source === 'auto') {
      return { ok: true, transcriptText: audio.transcript.text };
    }
    return { errorCode: 'target-not-eligible', ok: false };
  }
  if (task.mode === 'regenerate' && audio.audioByteLength <= 0) {
    return { errorCode: 'target-not-eligible', ok: false };
  }
  if (task.mode === 'regenerate' && signal.aborted) {
    return { errorCode: 'canceled', ok: false };
  }
  const expectedTranscriptDigest =
    task.mode === 'regenerate' ? transcriptDigest(audio.transcript.text) : null;

  let audioData: Awaited<ReturnType<typeof prepareBackfillAudioData>>;
  try {
    audioData =
      audio.audioFileDescriptor === undefined
        ? await prepareAudioData({
            finalizedWebmBytes: audio.audio,
            signal,
          })
        : await prepareAudioData({
            finalizedWebmByteLength: audio.audioByteLength,
            finalizedWebmFileDescriptor: audio.audioFileDescriptor,
            signal,
          });
  } catch (error) {
    return {
      errorCode:
        error instanceof BackfillAudioDataSourceError
          ? mapAudioDataSourceError(error.code)
          : 'transcode-failed',
      ok: false,
    };
  } finally {
    audio.dispose?.();
  }

  const recognized = await recognize({
    apiKey,
    audioDataBase64: audioData.base64,
    signal,
  });
  if (signal.aborted) {
    return { errorCode: 'canceled', ok: false };
  }
  if (!recognized.ok) {
    return { errorCode: mapTurboError(recognized.errorCode), ok: false };
  }
  if (signal.aborted) {
    return { errorCode: 'canceled', ok: false };
  }

  const assertWorkspaceUsable = createCancellationAwareAssertWorkspaceUsable(
    task.assertWorkspaceUsable,
    signal
  );
  const saveAssertWorkspaceUsable =
    task.mode === 'regenerate' ? task.assertWorkspaceUsable : assertWorkspaceUsable;

  if (task.kind === 'segment') {
    if (task.mode === 'regenerate' && signal.aborted) {
      return { errorCode: 'canceled', ok: false };
    }
    const saved =
      task.mode === 'regenerate'
        ? await saveSegmentTranscript({
            allowOverwrite: true,
            assertWorkspaceUsable: saveAssertWorkspaceUsable,
            expectedTranscriptDigest: requireExpectedTranscriptDigest(expectedTranscriptDigest),
            fileName: 'transcript.md',
            isAbortRequested: () => signal.aborted,
            markdown: recognized.transcriptText,
            memoryId: task.memoryId,
            requireTranscriptMissing: false,
            rootPath: task.rootPath,
            segmentId: task.segmentId,
            workspaceId: task.workspaceId,
          })
        : await saveSegmentTranscript({
            assertWorkspaceUsable,
            fileName: 'transcript.md',
            markdown: recognized.transcriptText,
            memoryId: task.memoryId,
            requireTranscriptMissing: true,
            rootPath: task.rootPath,
            segmentId: task.segmentId,
            workspaceId: task.workspaceId,
          });
    if (!saved.ok) {
      if (
        signal.aborted &&
        (saved.error.code === 'ERR_BACKFILL_UNAVAILABLE' ||
          saved.error.code === 'ERR_WORKSPACE_LOCK_LOST')
      ) {
        return { errorCode: 'canceled', ok: false };
      }
      if (saved.error.code === 'ERR_BACKFILL_TARGET_NOT_ELIGIBLE') {
        if (task.source === 'auto') {
          return { ok: true, transcriptText: '' };
        }
        return { errorCode: 'target-not-eligible', ok: false, response: saved };
      }
      if (saved.error.code === 'ERR_BACKFILL_TRANSCRIPT_CHANGED') {
        return { errorCode: 'transcript-changed', ok: false, response: saved };
      }
      return {
        errorCode: saved.error.code === 'ERR_WORKSPACE_LOCK_LOST' ? 'lock-lost' : 'save-failed',
        ok: false,
        response: saved,
      };
    }
    return {
      ok: true,
      response: { ok: true, value: { memory: saved.memory, saved: true } },
      transcriptText: recognized.transcriptText,
    };
  }

  if (task.mode === 'regenerate' && signal.aborted) {
    return { errorCode: 'canceled', ok: false };
  }
  const saved =
    task.mode === 'regenerate'
      ? await saveSupplementTranscript({
          allowOverwrite: true,
          assertWorkspaceUsable: saveAssertWorkspaceUsable,
          expectedTranscriptDigest: requireExpectedTranscriptDigest(expectedTranscriptDigest),
          isAbortRequested: () => signal.aborted,
          markdown: recognized.transcriptText,
          memoryId: task.memoryId,
          requireTranscriptMissing: false,
          rootPath: task.rootPath,
          segmentId: task.segmentId,
          supplementId: task.supplementId,
          workspaceId: task.workspaceId,
        })
      : await saveSupplementTranscript({
          assertWorkspaceUsable,
          markdown: recognized.transcriptText,
          memoryId: task.memoryId,
          requireTranscriptMissing: true,
          rootPath: task.rootPath,
          segmentId: task.segmentId,
          supplementId: task.supplementId,
          workspaceId: task.workspaceId,
        });
  if (!saved.ok) {
    if (
      signal.aborted &&
      (saved.error.code === 'ERR_BACKFILL_UNAVAILABLE' ||
        saved.error.code === 'ERR_WORKSPACE_LOCK_LOST')
    ) {
      return { errorCode: 'canceled', ok: false };
    }
    if (saved.error.code === 'ERR_BACKFILL_TARGET_NOT_ELIGIBLE') {
      if (task.source === 'auto') {
        return { ok: true, transcriptText: '' };
      }
      return { errorCode: 'target-not-eligible', ok: false, response: saved };
    }
    if (saved.error.code === 'ERR_BACKFILL_TRANSCRIPT_CHANGED') {
      return { errorCode: 'transcript-changed', ok: false, response: saved };
    }
    return {
      errorCode: saved.error.code === 'ERR_WORKSPACE_LOCK_LOST' ? 'lock-lost' : 'save-failed',
      ok: false,
      response: saved,
    };
  }
  return {
    ok: true,
    response: {
      ok: true,
      value: {
        memory: saved.memory,
        segment: saved.segment,
        supplement: saved.supplement,
        saved: true,
      },
    },
    transcriptText: recognized.transcriptText,
  };
}

async function readCurrentBackfillEligibility(
  task: BackfillRuntimeTask,
  {
    readBackfillTargetProjection,
  }: Required<Pick<CreateWorkspaceBackfillRuntimeInput, 'readBackfillTargetProjection'>>
): Promise<
  | { readonly ok: true }
  | {
      readonly errorCode: BackfillQueueErrorCode;
      readonly ok: false;
      readonly response?: BackfillSavedResponse;
    }
> {
  const projection = await readBackfillTargetProjection(
    task.kind === 'segment'
      ? {
          assertWorkspaceUsable: task.assertWorkspaceUsable,
          kind: 'segment',
          memoryId: task.memoryId,
          rootPath: task.rootPath,
          segmentId: task.segmentId,
          workspaceId: task.workspaceId,
        }
      : {
          assertWorkspaceUsable: task.assertWorkspaceUsable,
          kind: 'supplement',
          memoryId: task.memoryId,
          rootPath: task.rootPath,
          segmentId: task.segmentId,
          supplementId: task.supplementId,
          workspaceId: task.workspaceId,
        }
  );
  if (!projection.ok) {
    return projection.error.code === 'ERR_WORKSPACE_LOCK_LOST'
      ? { errorCode: 'lock-lost', ok: false, response: projection }
      : { errorCode: 'target-not-eligible', ok: false };
  }

  const eligible =
    task.source === 'auto'
      ? isBackfillEligibleProjection(projection.value)
      : isManualFillMissingEligibleProjection(projection.value);
  return eligible ? { ok: true } : { errorCode: 'target-not-eligible', ok: false };
}

async function readBackfillTargetProjectionFromFileTruth(
  input: BackfillTargetProjectionInput
): Promise<
  | {
      readonly ok: true;
      readonly value: BackfillScannerProjection;
    }
  | WorkspaceErrorEnvelope
> {
  const usable = input.assertWorkspaceUsable();
  if (!usable.ok) {
    return usable;
  }
  try {
    const target =
      input.kind === 'segment'
        ? await readFinalizedSegmentAudioProjection({
            memoryId: input.memoryId,
            rootPath: input.rootPath,
            segmentId: input.segmentId,
            workspaceId: input.workspaceId,
          })
        : await readFinalizedSegmentSupplementProjection({
            memoryId: input.memoryId,
            rootPath: input.rootPath,
            segmentId: input.segmentId,
            supplementId: input.supplementId,
            workspaceId: input.workspaceId,
          });
    const stillUsable = input.assertWorkspaceUsable();
    if (!stillUsable.ok) {
      return stillUsable;
    }
    return {
      ok: true,
      value: {
        audioByteLength: target.audioByteLength,
        lastTranscriptionAttempt: target.lastTranscriptionAttempt,
        transcript: target.transcript,
      },
    };
  } catch {
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Backfill target was not found');
  }
}

async function readBackfillTargetProjectionFromMemoryDetail(
  input: BackfillTargetProjectionInput,
  { readMemoryDetail }: Required<Pick<CreateWorkspaceBackfillRuntimeInput, 'readMemoryDetail'>>
): Promise<
  { readonly ok: true; readonly value: BackfillScannerProjection } | WorkspaceErrorEnvelope
> {
  const detail = await readMemoryDetail({
    assertWorkspaceUsable: input.assertWorkspaceUsable,
    memoryId: input.memoryId,
    rootPath: input.rootPath,
    workspaceId: input.workspaceId,
  });
  if (!detail.ok) {
    return detail;
  }

  const segment = detail.value.segments.find(
    (candidate) => candidate.segmentId === input.segmentId
  );
  const target =
    input.kind === 'segment'
      ? segment
      : segment?.supplements.find((candidate) => candidate.supplementId === input.supplementId);
  if (!target) {
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Backfill target was not found');
  }
  return {
    ok: true,
    value: {
      audioByteLength: target.audioByteLength,
      lastTranscriptionAttempt: target.lastTranscriptionAttempt,
      transcript: target.transcript,
    },
  };
}

function requireExpectedTranscriptDigest(digest: string | null): string {
  if (digest === null) {
    throw new Error('Regenerate backfill is missing a transcript snapshot digest');
  }
  return digest;
}

function createCancellationAwareAssertWorkspaceUsable(
  assertWorkspaceUsable: AssertWorkspaceUsable,
  signal: AbortSignal
): AssertWorkspaceUsable {
  return () => {
    if (signal.aborted) {
      return workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost');
    }
    return assertWorkspaceUsable();
  };
}

async function readTaskAudio(
  task: BackfillRuntimeTask,
  {
    readSegmentAudio,
    readSupplementAudio,
  }: Required<Pick<CreateWorkspaceBackfillRuntimeInput, 'readSegmentAudio' | 'readSupplementAudio'>>
): Promise<ReadFinalizedAudioResult> {
  const transcriptReadMode = task.mode === 'fill-missing' ? 'assume-missing' : 'read';
  if (task.kind === 'segment') {
    return readSegmentAudio({
      assertWorkspaceUsable: task.assertWorkspaceUsable,
      maxBytes: BACKFILL_AUDIO_MAX_INPUT_BYTES,
      memoryId: task.memoryId,
      rootPath: task.rootPath,
      segmentId: task.segmentId,
      transcriptReadMode,
    });
  }
  return readSupplementAudio({
    assertWorkspaceUsable: task.assertWorkspaceUsable,
    maxBytes: BACKFILL_AUDIO_MAX_INPUT_BYTES,
    memoryId: task.memoryId,
    rootPath: task.rootPath,
    segmentId: task.segmentId,
    supplementId: task.supplementId,
    transcriptReadMode,
    workspaceId: task.workspaceId,
  });
}

function mapWorkspaceAudioReadError(error: WorkspaceErrorEnvelope): BackfillQueueErrorCode {
  if (error.error.code === 'ERR_WORKSPACE_LOCK_LOST') return 'lock-lost';
  if (error.error.code === 'ERR_RECORDING_CHUNK_TOO_LARGE') return 'size';
  if (error.error.code === 'ERR_RECORDING_AUDIO_MISSING') return 'empty-audio';
  return 'transcode-failed';
}

function mapAudioDataSourceError(
  code: BackfillAudioDataSourceError['code']
): BackfillQueueErrorCode {
  if (code === 'abort') return 'canceled';
  if (code === 'empty-audio') return 'empty-audio';
  if (code === 'size') return 'size';
  return 'transcode-failed';
}

function mapTurboError(errorCode: string): BackfillQueueErrorCode {
  if (errorCode === 'abort') return 'abort';
  if (errorCode === 'auth') return 'auth';
  if (errorCode === 'empty-audio') return 'empty-audio';
  if (errorCode === 'format') return 'format';
  if (errorCode === 'rate-limit') return 'rate-limit';
  if (errorCode === 'server-busy') return 'server-busy';
  if (errorCode === 'silent-audio') return 'silent-audio';
  if (errorCode === 'size') return 'size';
  if (errorCode === 'timeout') return 'timeout';
  if (errorCode === 'malformed') return 'malformed';
  return 'network';
}

function backfillErrorResponse(errorCode: BackfillQueueErrorCode): WorkspaceErrorEnvelope {
  if (errorCode === 'lock-lost') {
    return workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost');
  }
  if (errorCode === 'target-not-eligible') {
    return workspaceError('ERR_BACKFILL_TARGET_NOT_ELIGIBLE', 'Backfill target is not eligible');
  }
  if (errorCode === 'transcript-changed') {
    return workspaceError('ERR_BACKFILL_TRANSCRIPT_CHANGED', 'Transcript changed during backfill');
  }
  if (errorCode === 'empty-audio' || errorCode === 'silent-audio') {
    return workspaceError('ERR_BACKFILL_AUDIO_EMPTY', 'Backfill audio is empty');
  }
  if (errorCode === 'size') {
    return workspaceError('ERR_BACKFILL_AUDIO_TOO_LARGE', 'Backfill audio is too large');
  }
  if (errorCode === 'transcode-failed' || errorCode === 'format') {
    return workspaceError(
      'ERR_BACKFILL_AUDIO_TRANSCODE_FAILED',
      'Backfill audio could not be converted'
    );
  }
  if (errorCode === 'auth') {
    return workspaceError('ERR_BACKFILL_AUTH_FAILED', 'Backfill credentials are invalid');
  }
  if (errorCode === 'rate-limit') {
    return workspaceError('ERR_BACKFILL_RATE_LIMITED', 'Backfill request was rate limited');
  }
  if (errorCode === 'queue-full') {
    return workspaceError('ERR_BACKFILL_UNAVAILABLE', 'Backfill queue is full');
  }
  if (errorCode === 'canceled') {
    return workspaceError('ERR_BACKFILL_UNAVAILABLE', 'Backfill was canceled');
  }
  return workspaceError('ERR_BACKFILL_TRANSCRIBE_FAILED', 'Backfill transcription failed');
}

type ScanWorkspaceInput = {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly isCurrent?: () => boolean;
  readonly limit?: number;
  readonly rootPath: string;
  readonly workspaceId: string;
};

type ScanWorkspaceDeps = {
  readonly readMemoryDetail?: NonNullable<CreateWorkspaceBackfillRuntimeInput['readMemoryDetail']>;
  readonly readWorkspaceSnapshot?: NonNullable<
    CreateWorkspaceBackfillRuntimeInput['readWorkspaceSnapshot']
  >;
  readonly refreshWorkspaceSnapshot?: NonNullable<
    CreateWorkspaceBackfillRuntimeInput['refreshWorkspaceSnapshot']
  >;
};

export async function scanWorkspaceBackfillTargets(
  input: ScanWorkspaceInput,
  {
    readMemoryDetail = readMemoryDetailFromFileTruth,
    readWorkspaceSnapshot = readWorkspaceSnapshotFromIndex,
    refreshWorkspaceSnapshot = readWorkspaceSnapshotFromFileTruth,
  }: ScanWorkspaceDeps = {}
): Promise<readonly BackfillEligibleTarget[]> {
  const targetLimit = normalizeBackfillTargetLimit(input.limit ?? Number.POSITIVE_INFINITY);
  if (targetLimit === 0) {
    return [];
  }
  const snapshot = await readWorkspaceSnapshot({
    rootPath: input.rootPath,
    workspaceId: input.workspaceId,
    ...(input.assertWorkspaceUsable ? { assertWorkspaceUsable: input.assertWorkspaceUsable } : {}),
  });
  if (!snapshot.ok) {
    throw new BackfillScanError(snapshot);
  }
  if (input.isCurrent?.() === false) {
    return [];
  }

  const firstPassMemoryDetails = new Map<string, CachedBackfillMemoryDetail>();
  await selectBackfillTargetsFromSnapshot({
    ...(input.assertWorkspaceUsable ? { assertWorkspaceUsable: input.assertWorkspaceUsable } : {}),
    ...(input.isCurrent ? { isCurrent: input.isCurrent } : {}),
    detailCache: firstPassMemoryDetails,
    readMemoryDetail,
    rootPath: input.rootPath,
    snapshot: snapshot.snapshot,
    targetLimit,
    workspaceId: input.workspaceId,
  });

  const refreshedSnapshot = await refreshWorkspaceSnapshot({
    rootPath: input.rootPath,
    workspaceId: input.workspaceId,
    ...(input.assertWorkspaceUsable ? { assertWorkspaceUsable: input.assertWorkspaceUsable } : {}),
  });
  if (!refreshedSnapshot.ok) {
    throw new BackfillScanError(refreshedSnapshot);
  }
  if (input.isCurrent?.() === false) {
    return [];
  }
  const targets = await selectBackfillTargetsFromSnapshot({
    ...(input.assertWorkspaceUsable ? { assertWorkspaceUsable: input.assertWorkspaceUsable } : {}),
    ...(input.isCurrent ? { isCurrent: input.isCurrent } : {}),
    detailCache: firstPassMemoryDetails,
    readMemoryDetail,
    rootPath: input.rootPath,
    snapshot: refreshedSnapshot.snapshot,
    targetLimit,
    workspaceId: input.workspaceId,
  });
  return targets;
}

async function selectBackfillTargetsFromSnapshot({
  assertWorkspaceUsable,
  detailCache,
  isCurrent,
  readMemoryDetail,
  rootPath,
  snapshot,
  targetLimit,
  workspaceId,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly detailCache?: Map<string, CachedBackfillMemoryDetail>;
  readonly isCurrent?: () => boolean;
  readonly readMemoryDetail: NonNullable<CreateWorkspaceBackfillRuntimeInput['readMemoryDetail']>;
  readonly rootPath: string;
  readonly snapshot: WorkspaceSnapshot;
  readonly targetLimit: number;
  readonly workspaceId: string;
}): Promise<readonly BackfillEligibleTarget[]> {
  const selector = createBackfillTargetSelector(targetLimit);
  const canStopEarly = backfillMemorySummariesAreSortedForScan(snapshot.memories);
  for (const memory of orderedBackfillMemorySummaries(snapshot.memories)) {
    if (isCurrent?.() === false) {
      return [];
    }
    const oldestSelected = selector.peekOldestSelected();
    if (
      canStopEarly &&
      selector.isFull() &&
      oldestSelected &&
      memory.updatedAt.localeCompare(oldestSelected.updatedAt) <= 0
    ) {
      break;
    }
    if (
      memory.audioByteLength === 0 ||
      (memory.segmentCount === 0 && memory.supplementCount === 0)
    ) {
      continue;
    }
    const summaryKey = backfillMemorySummaryCacheKey(memory);
    const cachedDetail = detailCache?.get(memory.memoryId);
    let detailValue = cachedDetail?.summaryKey === summaryKey ? cachedDetail.value : undefined;
    if (!detailValue) {
      const detail = await readMemoryDetail({
        memoryId: memory.memoryId,
        rootPath,
        workspaceId,
        ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
      });
      if (!detail.ok) {
        throw new BackfillScanError(detail);
      }
      detailValue = detail.value;
      detailCache?.set(memory.memoryId, { summaryKey, value: detailValue });
    }
    addEligibleBackfillTargets({ memories: [detailValue] }, selector);
    if (isCurrent?.() === false) {
      return [];
    }
  }

  return selector.toArray();
}

type CachedBackfillMemoryDetail = {
  readonly summaryKey: string;
  readonly value: WorkspaceMemoryDetailProjection;
};

function backfillMemorySummaryCacheKey(memory: WorkspaceMemorySummary): string {
  return [
    memory.memoryId,
    memory.updatedAt,
    memory.segmentCount,
    memory.supplementCount,
    memory.audioByteLength,
    memory.hasTranscript ? '1' : '0',
  ].join('\u0000');
}

function isBackfillMemorySummaryCandidate(memory: WorkspaceMemorySummary): boolean {
  return memory.audioByteLength > 0 && (memory.segmentCount > 0 || memory.supplementCount > 0);
}

function backfillMemorySummaryOrder(
  left: WorkspaceMemorySummary,
  right: WorkspaceMemorySummary
): number {
  const updatedComparison = right.updatedAt.localeCompare(left.updatedAt);
  if (updatedComparison !== 0) {
    return updatedComparison;
  }
  return right.createdAt.localeCompare(left.createdAt);
}

function backfillMemorySummariesAreSortedForScan(
  memories: readonly WorkspaceMemorySummary[]
): boolean {
  let previous: WorkspaceMemorySummary | null = null;
  for (const memory of memories) {
    if (!isBackfillMemorySummaryCandidate(memory)) {
      continue;
    }
    if (previous && backfillMemorySummaryOrder(previous, memory) > 0) {
      return false;
    }
    previous = memory;
  }
  return true;
}

export class BackfillScanError extends Error {
  readonly envelope: WorkspaceErrorEnvelope;

  constructor(envelope: WorkspaceErrorEnvelope) {
    super('Backfill scan failed');
    this.name = 'BackfillScanError';
    this.envelope = envelope;
  }
}

function* orderedBackfillMemorySummaries(
  memories: readonly WorkspaceMemorySummary[]
): Generator<WorkspaceMemorySummary> {
  for (const memory of memories) {
    if (isBackfillMemorySummaryCandidate(memory)) {
      yield memory;
    }
  }
}

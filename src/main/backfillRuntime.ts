import type {
  WorkspaceErrorEnvelope,
  WorkspaceMemoryDetailProjection,
  WorkspaceSnapshot,
} from '../workspace-contract/workspace-contract.js';
import type {
  BackfillAudioUrlErrorCode,
  BackfillAudioUrlResult,
  BackfillAudioUrlSource,
} from './backfillAudioUrlSource.js';
import { createBackfillAudioUrlSource } from './backfillAudioUrlSource.js';
import { resolveBackfillAudioUrlSettings } from './backfillAudioUrlSettings.js';
import {
  createBackfillQueue,
  type BackfillQueue,
  type BackfillQueueErrorCode,
  type BackfillQueueTask,
} from './backfillQueue.js';
import { collectEligibleBackfillTargets, type BackfillEligibleTarget } from './backfillScanner.js';
import {
  readFinalizedAudioSegmentContent,
  readFinalizedAudioSegmentSupplementContent,
  saveRecordingMarkdown,
  saveSegmentSupplementMarkdown,
} from './recordingDrafts.js';
import { transcribeWithSeedAsrAuc, type SeedAsrAucResult } from './c0SeedAsrAucClient.js';
import { createBackfillDiagnostics, type BackfillDiagnostics } from './backfillDiagnostics.js';
import { readMemoryDetailFromFileTruth } from './memoryFiles.js';
import { readWorkspaceSnapshotFromFileTruth } from './workspaceFiles.js';
import type { VoiceSettingsStore } from './voiceSettingsStore.js';

type AssertWorkspaceUsable = () => { readonly ok: true } | WorkspaceErrorEnvelope;

type ReadFinalizedAudioResult =
  | {
      readonly audio: Uint8Array;
      readonly audioByteLength: number;
      readonly ok: true;
      readonly transcript: { readonly exists: boolean; readonly text: string };
    }
  | WorkspaceErrorEnvelope;

type SaveTranscriptResult = { readonly ok: true } | WorkspaceErrorEnvelope;

export type WorkspaceBackfillVoiceSettingsStore = Pick<VoiceSettingsStore, 'readDecryptedApiKey'>;

export type CreateWorkspaceBackfillQueueInput = {
  readonly audioUrlSource?: BackfillAudioUrlSource;
  readonly automaticBatchLimit?: number;
  readonly automaticBreakerThreshold?: number;
  readonly diagnostics?: BackfillDiagnostics;
  readonly onLockLost?: () => void;
  readonly readSegmentAudio?: (input: {
    readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
    readonly memoryId: string;
    readonly rootPath: string;
    readonly segmentId: string;
  }) => Promise<ReadFinalizedAudioResult>;
  readonly readSupplementAudio?: (input: {
    readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
    readonly memoryId: string;
    readonly rootPath: string;
    readonly segmentId: string;
    readonly supplementId: string;
    readonly workspaceId: string;
  }) => Promise<ReadFinalizedAudioResult>;
  readonly saveSegmentTranscript?: (input: {
    readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
    readonly fileName: 'transcript.md';
    readonly markdown: string;
    readonly memoryId: string;
    readonly rootPath: string;
    readonly segmentId: string;
    readonly workspaceId: string;
  }) => Promise<SaveTranscriptResult>;
  readonly saveSupplementTranscript?: (input: {
    readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
    readonly markdown: string;
    readonly memoryId: string;
    readonly rootPath: string;
    readonly segmentId: string;
    readonly supplementId: string;
    readonly workspaceId: string;
  }) => Promise<SaveTranscriptResult>;
  readonly transcribe?: (input: {
    readonly apiKey: string;
    readonly audioCodec: 'opus';
    readonly audioFormat: 'ogg';
    readonly audioUrl: string;
    readonly signal: AbortSignal;
    readonly uid: string;
  }) => Promise<SeedAsrAucResult>;
  readonly voiceSettingsStore: WorkspaceBackfillVoiceSettingsStore;
};

type ScanWorkspaceInput = {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly limit: number;
  readonly rootPath: string;
  readonly workspaceId: string;
};

type ScanWorkspaceDeps = {
  readonly readMemoryDetail?: (input: {
    readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
    readonly memoryId: string;
    readonly rootPath: string;
    readonly workspaceId: string;
  }) => Promise<
    { readonly ok: true; readonly value: WorkspaceMemoryDetailProjection } | WorkspaceErrorEnvelope
  >;
  readonly readWorkspaceSnapshot?: (input: {
    readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
    readonly rootPath: string;
    readonly workspaceId: string;
  }) => Promise<
    { readonly ok: true; readonly snapshot: WorkspaceSnapshot } | WorkspaceErrorEnvelope
  >;
};

export function createWorkspaceBackfillQueue({
  audioUrlSource = createBackfillAudioUrlSource({
    settings: resolveBackfillAudioUrlSettings(),
  }),
  automaticBatchLimit = 20,
  automaticBreakerThreshold = 3,
  diagnostics = createBackfillDiagnostics(),
  onLockLost,
  readSegmentAudio = readFinalizedAudioSegmentContent,
  readSupplementAudio = readFinalizedAudioSegmentSupplementContent,
  saveSegmentTranscript = saveRecordingMarkdown,
  saveSupplementTranscript = saveSegmentSupplementMarkdown,
  transcribe = transcribeWithSeedAsrAuc,
  voiceSettingsStore,
}: CreateWorkspaceBackfillQueueInput): BackfillQueue {
  return createBackfillQueue({
    acquireUrlSource: async ({ signal, task }) => {
      if (signal.aborted) {
        return { errorCode: 'canceled', ok: false };
      }
      const audio = await readTaskAudio(task, { readSegmentAudio, readSupplementAudio });
      if (!audio.ok) {
        if (audio.error.code === 'ERR_WORKSPACE_LOCK_LOST') {
          onLockLost?.();
        }
        return { errorCode: mapWorkspaceAudioReadError(audio), ok: false };
      }
      if (task.source === 'manual' && audio.transcript.exists) {
        return { errorCode: 'target-not-eligible', ok: false };
      }
      if (signal.aborted) {
        return { errorCode: 'canceled', ok: false };
      }
      const url = await audioUrlSource.createUrl(
        {
          audioByteLength: audio.audioByteLength,
          audioBytes: audio.audio,
          audioPath: 'finalized-audio.webm',
          codec: 'opus',
          container: 'webm',
          memoryId: task.memoryId,
          segmentId: task.segmentId,
        },
        { signal }
      );
      return mapAudioUrlResult(url);
    },
    automaticBatchLimit,
    automaticBreakerThreshold,
    runTask: async ({ signal, task, url }) => {
      if (signal.aborted) {
        return { errorCode: 'canceled', ok: false };
      }
      const apiKey = voiceSettingsStore.readDecryptedApiKey();
      if (!apiKey) {
        return { errorCode: 'auth', ok: false };
      }
      const transcribed = await transcribe({
        apiKey,
        audioCodec: 'opus',
        audioFormat: 'ogg',
        audioUrl: url,
        signal,
        uid: task.workspaceId,
      });
      if (signal.aborted) {
        return { errorCode: 'canceled', ok: false };
      }
      if (!transcribed.ok) {
        return { errorCode: transcribed.errorCode, ok: false };
      }
      if (task.source === 'auto') {
        const latestAudio = await readTaskAudio(task, { readSegmentAudio, readSupplementAudio });
        if (signal.aborted) {
          return { errorCode: 'canceled', ok: false };
        }
        if (!latestAudio.ok) {
          if (latestAudio.error.code === 'ERR_WORKSPACE_LOCK_LOST') {
            onLockLost?.();
          }
          return { errorCode: mapWorkspaceAudioReadError(latestAudio), ok: false };
        }
        if (latestAudio.transcript.exists) {
          return { ok: true, transcriptText: transcribed.transcriptText };
        }
        const saved = await saveAutomaticTranscript(task, transcribed.transcriptText, {
          saveSegmentTranscript,
          saveSupplementTranscript,
        });
        if (signal.aborted) {
          return { errorCode: 'canceled', ok: false };
        }
        if (!saved.ok) {
          if (saved.error.code === 'ERR_WORKSPACE_LOCK_LOST') {
            onLockLost?.();
          }
          return {
            errorCode: saved.error.code === 'ERR_WORKSPACE_LOCK_LOST' ? 'lock-lost' : 'save-failed',
            ok: false,
          };
        }
      }
      return { ok: true, transcriptText: transcribed.transcriptText };
    },
    onEvent: (event) => diagnostics.record(event.event, event.fields, event.level),
  });
}

export async function scanWorkspaceBackfillTargets(
  input: ScanWorkspaceInput,
  {
    readMemoryDetail = readMemoryDetailFromFileTruth,
    readWorkspaceSnapshot = readWorkspaceSnapshotFromFileTruth,
  }: ScanWorkspaceDeps = {}
): Promise<readonly BackfillEligibleTarget[]> {
  const snapshot = await readWorkspaceSnapshot({
    rootPath: input.rootPath,
    workspaceId: input.workspaceId,
    ...(input.assertWorkspaceUsable ? { assertWorkspaceUsable: input.assertWorkspaceUsable } : {}),
  });
  if (!snapshot.ok) {
    throw new BackfillScanError(snapshot);
  }

  const memories: WorkspaceMemoryDetailProjection[] = [];
  for (const memory of snapshot.snapshot.memories) {
    const detail = await readMemoryDetail({
      memoryId: memory.memoryId,
      rootPath: input.rootPath,
      workspaceId: input.workspaceId,
      ...(input.assertWorkspaceUsable
        ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
        : {}),
    });
    if (!detail.ok) {
      throw new BackfillScanError(detail);
    }
    memories.push(detail.value);
  }

  return collectEligibleBackfillTargets({ memories }, input.limit);
}

export class BackfillScanError extends Error {
  readonly envelope: WorkspaceErrorEnvelope;

  constructor(envelope: WorkspaceErrorEnvelope) {
    super('Backfill scan failed');
    this.name = 'BackfillScanError';
    this.envelope = envelope;
  }
}

async function readTaskAudio(
  task: BackfillQueueTask,
  {
    readSegmentAudio,
    readSupplementAudio,
  }: {
    readonly readSegmentAudio: NonNullable<CreateWorkspaceBackfillQueueInput['readSegmentAudio']>;
    readonly readSupplementAudio: NonNullable<
      CreateWorkspaceBackfillQueueInput['readSupplementAudio']
    >;
  }
): Promise<ReadFinalizedAudioResult> {
  if (!task.rootPath) {
    return {
      ok: false,
      error: { code: 'ERR_BACKFILL_AUDIO_URL_FAILED', message: 'Backfill root path is missing' },
    };
  }
  if (task.kind === 'segment') {
    return readSegmentAudio({
      memoryId: task.memoryId,
      rootPath: task.rootPath,
      segmentId: task.segmentId,
      ...(task.assertWorkspaceUsable
        ? { assertWorkspaceUsable: task.assertWorkspaceUsable as AssertWorkspaceUsable }
        : {}),
    });
  }
  return readSupplementAudio({
    memoryId: task.memoryId,
    rootPath: task.rootPath,
    segmentId: task.segmentId,
    supplementId: task.supplementId,
    workspaceId: task.workspaceId,
    ...(task.assertWorkspaceUsable
      ? { assertWorkspaceUsable: task.assertWorkspaceUsable as AssertWorkspaceUsable }
      : {}),
  });
}

async function saveAutomaticTranscript(
  task: BackfillQueueTask,
  transcriptText: string,
  {
    saveSegmentTranscript,
    saveSupplementTranscript,
  }: {
    readonly saveSegmentTranscript: NonNullable<
      CreateWorkspaceBackfillQueueInput['saveSegmentTranscript']
    >;
    readonly saveSupplementTranscript: NonNullable<
      CreateWorkspaceBackfillQueueInput['saveSupplementTranscript']
    >;
  }
): Promise<SaveTranscriptResult> {
  if (!task.rootPath) {
    return {
      ok: false,
      error: { code: 'ERR_BACKFILL_AUDIO_URL_FAILED', message: 'Backfill root path is missing' },
    };
  }
  if (task.kind === 'segment') {
    return saveSegmentTranscript({
      fileName: 'transcript.md',
      markdown: transcriptText,
      memoryId: task.memoryId,
      rootPath: task.rootPath,
      segmentId: task.segmentId,
      workspaceId: task.workspaceId,
      ...(task.assertWorkspaceUsable
        ? { assertWorkspaceUsable: task.assertWorkspaceUsable as AssertWorkspaceUsable }
        : {}),
    });
  }
  return saveSupplementTranscript({
    markdown: transcriptText,
    memoryId: task.memoryId,
    rootPath: task.rootPath,
    segmentId: task.segmentId,
    supplementId: task.supplementId,
    workspaceId: task.workspaceId,
    ...(task.assertWorkspaceUsable
      ? { assertWorkspaceUsable: task.assertWorkspaceUsable as AssertWorkspaceUsable }
      : {}),
  });
}

function mapAudioUrlResult(url: BackfillAudioUrlResult) {
  if (url.ok) {
    return { cleanup: url.cleanup, ok: true as const, url: url.url };
  }
  return { errorCode: mapAudioUrlError(url.error.code), ok: false as const };
}

function mapAudioUrlError(errorCode: BackfillAudioUrlErrorCode): BackfillQueueErrorCode {
  if (errorCode === 'aborted') {
    return 'canceled';
  }
  if (errorCode === 'unconfigured') {
    return 'url-source-unconfigured';
  }
  if (
    errorCode === 'unsupported-audio-format' ||
    errorCode === 'invalid-remux-output' ||
    errorCode === 'remux-failed'
  ) {
    return 'format';
  }
  return 'url-source-failed';
}

function mapWorkspaceAudioReadError(error: WorkspaceErrorEnvelope): BackfillQueueErrorCode {
  if (error.error.code === 'ERR_WORKSPACE_LOCK_LOST') {
    return 'lock-lost';
  }
  if (error.error.code === 'ERR_RECORDING_CHUNK_TOO_LARGE') {
    return 'size';
  }
  if (error.error.code === 'ERR_RECORDING_AUDIO_MISSING') {
    return 'empty-audio';
  }
  return 'url-source-failed';
}

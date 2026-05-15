import type {
  FinalizedAudioSegment,
  FinalizedSegmentSupplementRecording,
  WorkspaceMemorySummary,
  WorkspaceSession,
} from './workspaceApi';
import {
  transcriptMarkdownFromSegments,
  type TranscriptSegment,
} from './recording/recordingTimeline';

const RECORDING_RECOVERY_STORAGE_PREFIX = 'reo.recordingRecovery.v1.';
const RECORDING_RECOVERY_TRANSCRIPT_STORAGE_PREFIX = 'reo.recordingRecoveryTranscript.v1.';
const MAX_RECOVERY_DRAFT_STORAGE_BYTES = 512 * 1024;
const MAX_RECOVERY_TRANSCRIPT_STORAGE_BYTES = 2 * 1024 * 1024;
const MAX_RECOVERY_AUDIO_CHUNKS = 16_384;
const MAX_RECOVERY_WAVEFORM_SAMPLES = 2400;
const MAX_RECOVERY_TRANSCRIPT_SEGMENTS = 2000;
const MAX_RECOVERY_TRANSCRIPT_TEXT_LENGTH = 1000;

export type RecordingRecoveryDraft = {
  readonly audioChunks?: readonly RecordingRecoveryAudioChunk[];
  readonly createdAt: string;
  readonly durationMs: number;
  readonly finalizedAudio?: RecordingRecoveryFinalizedAudio;
  readonly finalizedSupplement?: FinalizedSegmentSupplementRecording;
  readonly memoryId: string;
  readonly nextSequence?: number;
  readonly parentSegmentId?: string;
  readonly segmentId: string;
  readonly targetKind?: RecordingRecoveryTargetKind;
  readonly recordingSessionId?: string;
  readonly revisionId?: string;
  readonly safeAudioByteLength?: number;
  readonly schemaVersion: 1;
  readonly title: string;
  readonly transcriptInSidecar?: true;
  readonly transcriptMarkdown?: string;
  readonly transcriptSegments?: readonly TranscriptSegment[];
  readonly updatedAt: string;
  readonly waveformSamples?: readonly number[];
  readonly workspaceId: string;
};

export type RecordingRecoveryTargetKind = 'segment' | 'segment-supplement';

export type RecordingRecoveryFinalizedAudio = FinalizedAudioSegment;

export type RecordingRecoveryAudioChunk = {
  readonly byteLength: number;
  readonly endTimeMs: number;
  readonly startTimeMs: number;
};

type WriteRecordingRecoveryDraftInput = {
  readonly audioChunks?: readonly RecordingRecoveryAudioChunk[];
  readonly durationMs: number;
  readonly finalizedAudio?: RecordingRecoveryFinalizedAudio;
  readonly finalizedSupplement?: FinalizedSegmentSupplementRecording;
  readonly memoryId: string;
  readonly nextSequence?: number;
  readonly parentSegmentId?: string;
  readonly segmentId: string;
  readonly targetKind?: RecordingRecoveryTargetKind;
  readonly recordingSessionId?: string;
  readonly revisionId?: string;
  readonly safeAudioByteLength?: number;
  readonly title: string;
  readonly transcriptMarkdown?: string;
  readonly transcriptSegments?: readonly TranscriptSegment[];
  readonly waveformSamples?: readonly number[];
  readonly workspaceId: string;
};

function recoveryStorageKey(workspaceId: string) {
  return `${RECORDING_RECOVERY_STORAGE_PREFIX}${workspaceId}`;
}

function recoveryTranscriptStorageKey(workspaceId: string) {
  return `${RECORDING_RECOVERY_TRANSCRIPT_STORAGE_PREFIX}${workspaceId}`;
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStorageItem(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function removeStorageItem(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Recovery markers are best-effort renderer state; durable audio remains in the draft files.
  }
}

function writeStorageItem(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    // Quota/private-mode failures must not interrupt durable recording capture.
    return false;
  }
}

function readTranscriptSidecar(storage: Storage, workspaceId: string, segmentId: string) {
  const raw = readStorageItem(storage, recoveryTranscriptStorageKey(workspaceId));
  if (!raw || raw.length > MAX_RECOVERY_TRANSCRIPT_STORAGE_BYTES) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const sidecar = parsed as {
      readonly segmentId?: unknown;
      readonly transcriptMarkdown?: unknown;
    };
    return sidecar.segmentId === segmentId && typeof sidecar.transcriptMarkdown === 'string'
      ? sidecar.transcriptMarkdown
      : null;
  } catch {
    return null;
  }
}

function writeTranscriptSidecar(
  storage: Storage,
  workspaceId: string,
  segmentId: string,
  transcriptMarkdown: string
) {
  if (transcriptMarkdown.trim().length === 0) {
    removeStorageItem(storage, recoveryTranscriptStorageKey(workspaceId));
    return false;
  }
  const serialized = JSON.stringify({ segmentId, transcriptMarkdown });
  if (serialized.length > MAX_RECOVERY_TRANSCRIPT_STORAGE_BYTES) {
    return false;
  }
  return writeStorageItem(storage, recoveryTranscriptStorageKey(workspaceId), serialized);
}

function compactAudioChunks(
  chunks: readonly RecordingRecoveryAudioChunk[]
): readonly RecordingRecoveryAudioChunk[] {
  const compacted: RecordingRecoveryAudioChunk[] = [];
  for (let index = 0; index < chunks.length; index += 2) {
    const first = chunks[index];
    const second = chunks[index + 1];
    if (!first) {
      continue;
    }
    if (!second) {
      compacted.push(first);
      continue;
    }
    compacted.push({
      byteLength: first.byteLength + second.byteLength,
      endTimeMs: second.endTimeMs,
      startTimeMs: first.startTimeMs,
    });
  }
  return compacted;
}

function serializeRecoveryDraftWithinBudget(draft: RecordingRecoveryDraft): string | null {
  let candidate = draft;
  let serialized = JSON.stringify(candidate);
  if (serialized.length <= MAX_RECOVERY_DRAFT_STORAGE_BYTES) {
    return serialized;
  }

  if (candidate.transcriptSegments) {
    const { transcriptSegments, ...withoutTranscriptSegments } = candidate;
    void transcriptSegments;
    candidate = withoutTranscriptSegments;
    serialized = JSON.stringify(candidate);
    if (serialized.length <= MAX_RECOVERY_DRAFT_STORAGE_BYTES) {
      return serialized;
    }
  }

  if (candidate.transcriptMarkdown && candidate.transcriptInSidecar) {
    const { transcriptMarkdown, ...withoutTranscriptMarkdown } = candidate;
    void transcriptMarkdown;
    candidate = withoutTranscriptMarkdown;
    serialized = JSON.stringify(candidate);
    if (serialized.length <= MAX_RECOVERY_DRAFT_STORAGE_BYTES) {
      return serialized;
    }
  }

  if (candidate.waveformSamples) {
    const { waveformSamples, ...withoutWaveformSamples } = candidate;
    void waveformSamples;
    candidate = withoutWaveformSamples;
    serialized = JSON.stringify(candidate);
    if (serialized.length <= MAX_RECOVERY_DRAFT_STORAGE_BYTES) {
      return serialized;
    }
  }

  let audioChunks = candidate.audioChunks;
  while (
    audioChunks &&
    audioChunks.length > 1 &&
    serialized.length > MAX_RECOVERY_DRAFT_STORAGE_BYTES
  ) {
    audioChunks = compactAudioChunks(audioChunks);
    candidate = { ...candidate, audioChunks };
    serialized = JSON.stringify(candidate);
  }

  if (serialized.length <= MAX_RECOVERY_DRAFT_STORAGE_BYTES) {
    return serialized;
  }

  const { audioChunks: omittedAudioChunks, ...withoutAudioChunks } = candidate;
  void omittedAudioChunks;
  candidate = withoutAudioChunks;
  serialized = JSON.stringify(candidate);
  return serialized.length <= MAX_RECOVERY_DRAFT_STORAGE_BYTES ? serialized : null;
}

function isRecoveryDraft(value: unknown): value is RecordingRecoveryDraft {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const draft = value as Partial<RecordingRecoveryDraft>;
  return (
    draft.schemaVersion === 1 &&
    typeof draft.workspaceId === 'string' &&
    draft.workspaceId.length > 0 &&
    typeof draft.memoryId === 'string' &&
    draft.memoryId.length > 0 &&
    typeof draft.segmentId === 'string' &&
    draft.segmentId.length > 0 &&
    typeof draft.title === 'string' &&
    draft.title.length > 0 &&
    typeof draft.durationMs === 'number' &&
    Number.isFinite(draft.durationMs) &&
    draft.durationMs >= 0 &&
    (draft.finalizedAudio === undefined ||
      isRecoveryFinalizedAudio(draft.finalizedAudio, {
        workspaceId: draft.workspaceId,
        memoryId: draft.memoryId,
        segmentId: draft.segmentId,
      })) &&
    (draft.finalizedSupplement === undefined ||
      isRecoveryFinalizedSupplement(draft.finalizedSupplement, {
        supplementId: draft.segmentId,
        memoryId: draft.memoryId,
        ...(draft.parentSegmentId ? { parentSegmentId: draft.parentSegmentId } : {}),
      })) &&
    (draft.targetKind === undefined ||
      draft.targetKind === 'segment' ||
      draft.targetKind === 'segment-supplement') &&
    (draft.targetKind !== 'segment-supplement' ||
      (typeof draft.parentSegmentId === 'string' && draft.parentSegmentId.length > 0)) &&
    (draft.parentSegmentId === undefined || typeof draft.parentSegmentId === 'string') &&
    (draft.audioChunks === undefined ||
      (Array.isArray(draft.audioChunks) &&
        draft.audioChunks.length <= MAX_RECOVERY_AUDIO_CHUNKS &&
        draft.audioChunks.every(isRecoveryAudioChunk))) &&
    (draft.nextSequence === undefined ||
      (typeof draft.nextSequence === 'number' &&
        Number.isInteger(draft.nextSequence) &&
        draft.nextSequence >= 0)) &&
    (draft.recordingSessionId === undefined || typeof draft.recordingSessionId === 'string') &&
    (draft.revisionId === undefined || typeof draft.revisionId === 'string') &&
    (draft.safeAudioByteLength === undefined ||
      (typeof draft.safeAudioByteLength === 'number' &&
        Number.isInteger(draft.safeAudioByteLength) &&
        draft.safeAudioByteLength >= 0)) &&
    (draft.waveformSamples === undefined ||
      (Array.isArray(draft.waveformSamples) &&
        draft.waveformSamples.length <= MAX_RECOVERY_WAVEFORM_SAMPLES &&
        draft.waveformSamples.every(
          (sample) => typeof sample === 'number' && Number.isFinite(sample)
        ))) &&
    (draft.transcriptSegments === undefined ||
      (Array.isArray(draft.transcriptSegments) &&
        draft.transcriptSegments.length <= MAX_RECOVERY_TRANSCRIPT_SEGMENTS &&
        draft.transcriptSegments.every(isRecoveryTranscriptSegment))) &&
    (draft.transcriptInSidecar === undefined || draft.transcriptInSidecar === true) &&
    (draft.transcriptMarkdown === undefined || typeof draft.transcriptMarkdown === 'string') &&
    typeof draft.createdAt === 'string' &&
    typeof draft.updatedAt === 'string'
  );
}

function isRecoveryFinalizedSupplement(
  value: unknown,
  draft: {
    readonly supplementId: string;
    readonly memoryId: string;
    readonly parentSegmentId?: string;
  }
): value is FinalizedSegmentSupplementRecording {
  if (typeof value !== 'object' || value === null || !draft.parentSegmentId) {
    return false;
  }
  const finalized = value as Partial<FinalizedSegmentSupplementRecording>;
  const segment = finalized.segment as Partial<
    FinalizedSegmentSupplementRecording['segment']
  > | null;
  const supplement = finalized.supplement as Partial<
    FinalizedSegmentSupplementRecording['supplement']
  > | null;
  return (
    isWorkspaceMemorySummary(finalized.memory) &&
    finalized.memory.memoryId === draft.memoryId &&
    typeof segment === 'object' &&
    segment !== null &&
    segment.memoryId === draft.memoryId &&
    segment.segmentId === draft.parentSegmentId &&
    typeof supplement === 'object' &&
    supplement !== null &&
    supplement.memoryId === draft.memoryId &&
    supplement.segmentId === draft.parentSegmentId &&
    supplement.supplementId === draft.supplementId &&
    supplement.type === 'audio'
  );
}

function isRecoveryFinalizedAudio(
  value: unknown,
  draft: Pick<RecordingRecoveryDraft, 'memoryId' | 'segmentId' | 'workspaceId'>
): value is RecordingRecoveryFinalizedAudio {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const finalized = value as Partial<RecordingRecoveryFinalizedAudio>;
  const segment = finalized.segment as Partial<RecordingRecoveryFinalizedAudio['segment']> | null;
  return (
    isWorkspaceMemorySummary(finalized.memory) &&
    finalized.memory.memoryId === draft.memoryId &&
    typeof segment === 'object' &&
    segment !== null &&
    segment.workspaceId === draft.workspaceId &&
    segment.type === 'audio' &&
    segment.memoryId === draft.memoryId &&
    segment.segmentId === draft.segmentId &&
    typeof segment.title === 'string' &&
    segment.title.length > 0 &&
    typeof segment.createdAt === 'string' &&
    segment.createdAt.length > 0 &&
    typeof segment.updatedAt === 'string' &&
    segment.updatedAt.length > 0 &&
    typeof segment.durationMs === 'number' &&
    Number.isFinite(segment.durationMs) &&
    segment.durationMs >= 0 &&
    typeof segment.audioByteLength === 'number' &&
    Number.isInteger(segment.audioByteLength) &&
    segment.audioByteLength >= 0 &&
    typeof segment.transcript === 'object' &&
    segment.transcript !== null &&
    typeof segment.transcript.exists === 'boolean' &&
    typeof segment.supplementCount === 'number' &&
    Number.isInteger(segment.supplementCount) &&
    segment.supplementCount >= 0 &&
    Array.isArray(segment.supplements)
  );
}

function isWorkspaceMemorySummary(value: unknown): value is WorkspaceMemorySummary {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const memory = value as Partial<WorkspaceMemorySummary>;
  return (
    typeof memory.memoryId === 'string' &&
    memory.memoryId.length > 0 &&
    typeof memory.title === 'string' &&
    memory.title.length > 0 &&
    typeof memory.createdAt === 'string' &&
    typeof memory.updatedAt === 'string' &&
    typeof memory.segmentCount === 'number' &&
    Number.isInteger(memory.segmentCount) &&
    memory.segmentCount >= 0 &&
    typeof memory.durationMs === 'number' &&
    Number.isInteger(memory.durationMs) &&
    memory.durationMs >= 0 &&
    typeof memory.audioByteLength === 'number' &&
    Number.isInteger(memory.audioByteLength) &&
    memory.audioByteLength >= 0 &&
    typeof memory.hasTranscript === 'boolean' &&
    typeof memory.supplementCount === 'number' &&
    Number.isInteger(memory.supplementCount) &&
    memory.supplementCount >= 0
  );
}

function isRecoveryTranscriptSegment(value: unknown): value is TranscriptSegment {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const segment = value as Partial<TranscriptSegment>;
  return (
    typeof segment.startTimeMs === 'number' &&
    Number.isFinite(segment.startTimeMs) &&
    segment.startTimeMs >= 0 &&
    typeof segment.endTimeMs === 'number' &&
    Number.isFinite(segment.endTimeMs) &&
    segment.endTimeMs >= segment.startTimeMs &&
    typeof segment.text === 'string' &&
    segment.text.trim().length > 0 &&
    segment.text.length <= MAX_RECOVERY_TRANSCRIPT_TEXT_LENGTH &&
    typeof segment.isFinal === 'boolean' &&
    typeof segment.recordingSessionId === 'string' &&
    segment.recordingSessionId.length > 0 &&
    typeof segment.revisionId === 'string' &&
    segment.revisionId.length > 0
  );
}

function isRecoveryAudioChunk(value: unknown): value is RecordingRecoveryAudioChunk {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const chunk = value as Partial<RecordingRecoveryAudioChunk>;
  return (
    typeof chunk.startTimeMs === 'number' &&
    Number.isFinite(chunk.startTimeMs) &&
    chunk.startTimeMs >= 0 &&
    typeof chunk.endTimeMs === 'number' &&
    Number.isFinite(chunk.endTimeMs) &&
    chunk.endTimeMs >= chunk.startTimeMs &&
    typeof chunk.byteLength === 'number' &&
    Number.isInteger(chunk.byteLength) &&
    chunk.byteLength >= 0
  );
}

export function readRecordingRecoveryDraft(
  workspaceSession: WorkspaceSession
): RecordingRecoveryDraft | null {
  const storage = browserStorage();
  if (!storage) {
    return null;
  }

  const rawDraft = readStorageItem(storage, recoveryStorageKey(workspaceSession.workspaceId));
  if (!rawDraft) {
    return null;
  }
  if (rawDraft.length > MAX_RECOVERY_DRAFT_STORAGE_BYTES) {
    removeStorageItem(storage, recoveryStorageKey(workspaceSession.workspaceId));
    removeStorageItem(storage, recoveryTranscriptStorageKey(workspaceSession.workspaceId));
    return null;
  }

  let parsedDraft: unknown;
  try {
    parsedDraft = JSON.parse(rawDraft);
  } catch {
    removeStorageItem(storage, recoveryStorageKey(workspaceSession.workspaceId));
    removeStorageItem(storage, recoveryTranscriptStorageKey(workspaceSession.workspaceId));
    return null;
  }

  if (
    !isRecoveryDraft(parsedDraft) ||
    parsedDraft.workspaceId !== workspaceSession.workspaceId ||
    !workspaceSession.snapshot.memories.some((memory) => memory.memoryId === parsedDraft.memoryId)
  ) {
    removeStorageItem(storage, recoveryStorageKey(workspaceSession.workspaceId));
    removeStorageItem(storage, recoveryTranscriptStorageKey(workspaceSession.workspaceId));
    return null;
  }

  const sidecarTranscript =
    parsedDraft.transcriptInSidecar === true
      ? readTranscriptSidecar(storage, workspaceSession.workspaceId, parsedDraft.segmentId)
      : null;
  return sidecarTranscript !== null
    ? { ...parsedDraft, transcriptMarkdown: sidecarTranscript }
    : parsedDraft;
}

export function writeRecordingRecoveryDraft(input: WriteRecordingRecoveryDraftInput) {
  const storage = browserStorage();
  if (!storage) {
    return;
  }

  const existingDraft = readRawRecordingRecoveryDraft(input.workspaceId);
  if (existingDraft && existingDraft.segmentId !== input.segmentId) {
    removeStorageItem(storage, recoveryTranscriptStorageKey(input.workspaceId));
  }
  writeRecordingRecoveryDraftWithExisting(storage, input, existingDraft);
}

function writeRecordingRecoveryDraftWithExisting(
  storage: Storage,
  input: WriteRecordingRecoveryDraftInput,
  existingDraft: RecordingRecoveryDraft | null
) {
  const now = new Date().toISOString();
  const existing = existingDraft?.segmentId === input.segmentId ? existingDraft : null;
  const hasTranscriptInput =
    input.transcriptMarkdown !== undefined || input.transcriptSegments !== undefined;
  const audioChunks = (input.audioChunks ?? existing?.audioChunks)?.slice(
    -MAX_RECOVERY_AUDIO_CHUNKS
  );
  const finalizedAudio = input.finalizedAudio ?? existing?.finalizedAudio;
  const finalizedSupplement = input.finalizedSupplement ?? existing?.finalizedSupplement;
  const nextSequence = input.nextSequence ?? existing?.nextSequence;
  const parentSegmentId = input.parentSegmentId ?? existing?.parentSegmentId;
  const recordingSessionId = input.recordingSessionId ?? existing?.recordingSessionId;
  const revisionId = input.revisionId ?? existing?.revisionId;
  const targetKind = input.targetKind ?? existing?.targetKind ?? 'segment';
  const transcriptSegments = (input.transcriptSegments ?? existing?.transcriptSegments)
    ?.slice(-MAX_RECOVERY_TRANSCRIPT_SEGMENTS)
    .map((segment) => ({
      ...segment,
      text: segment.text.slice(0, MAX_RECOVERY_TRANSCRIPT_TEXT_LENGTH),
    }));
  const transcriptMarkdown =
    input.transcriptMarkdown ??
    (input.transcriptSegments !== undefined
      ? transcriptMarkdownFromSegments(transcriptSegments ?? [])
      : existing?.transcriptMarkdown);
  const safeAudioByteLength =
    input.safeAudioByteLength ??
    (audioChunks
      ? audioChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
      : existing?.safeAudioByteLength);
  const waveformSamples = (input.waveformSamples ?? existing?.waveformSamples)?.slice(
    -MAX_RECOVERY_WAVEFORM_SAMPLES
  );
  const draft: RecordingRecoveryDraft = {
    createdAt: existing?.createdAt ?? now,
    ...(audioChunks ? { audioChunks } : {}),
    durationMs: Math.max(0, Math.round(input.durationMs)),
    ...(finalizedAudio ? { finalizedAudio } : {}),
    ...(finalizedSupplement ? { finalizedSupplement } : {}),
    memoryId: input.memoryId,
    ...(nextSequence !== undefined ? { nextSequence } : {}),
    ...(parentSegmentId !== undefined ? { parentSegmentId } : {}),
    segmentId: input.segmentId,
    ...(recordingSessionId ? { recordingSessionId } : {}),
    ...(revisionId ? { revisionId } : {}),
    ...(safeAudioByteLength !== undefined ? { safeAudioByteLength } : {}),
    schemaVersion: 1,
    ...(targetKind !== 'segment' ? { targetKind } : {}),
    title: input.title,
    ...(existing?.transcriptInSidecar && !hasTranscriptInput && !transcriptMarkdown
      ? { transcriptInSidecar: true as const }
      : {}),
    ...(transcriptMarkdown ? { transcriptMarkdown } : {}),
    ...(transcriptSegments ? { transcriptSegments } : {}),
    updatedAt: now,
    ...(waveformSamples ? { waveformSamples } : {}),
    workspaceId: input.workspaceId,
  };

  let serializedDraft = serializeRecoveryDraftWithinBudget(draft);
  if (serializedDraft) {
    if (hasTranscriptInput || (existing?.transcriptInSidecar && transcriptMarkdown)) {
      removeStorageItem(storage, recoveryTranscriptStorageKey(input.workspaceId));
    }
    writeStorageItem(storage, recoveryStorageKey(input.workspaceId), serializedDraft);
    return;
  }

  if (transcriptMarkdown) {
    if (
      hasTranscriptInput &&
      !writeTranscriptSidecar(storage, input.workspaceId, input.segmentId, transcriptMarkdown)
    ) {
      return;
    }
    const { transcriptMarkdown: sidecarTranscriptMarkdown, ...draftWithSidecar } = draft;
    void sidecarTranscriptMarkdown;
    serializedDraft = serializeRecoveryDraftWithinBudget({
      ...draftWithSidecar,
      transcriptInSidecar: true,
    });
  } else if (existing?.transcriptInSidecar) {
    serializedDraft = serializeRecoveryDraftWithinBudget({ ...draft, transcriptInSidecar: true });
  }

  if (serializedDraft) {
    writeStorageItem(storage, recoveryStorageKey(input.workspaceId), serializedDraft);
  }
}

export function updateRecordingRecoveryDuration({
  durationMs,
  segmentId,
  workspaceId,
}: {
  readonly durationMs: number;
  readonly segmentId: string;
  readonly workspaceId: string;
}) {
  const existing = readRawRecordingRecoveryDraft(workspaceId);
  if (!existing || existing.segmentId !== segmentId) {
    return;
  }
  const storage = browserStorage();
  if (!storage) {
    return;
  }
  writeRecordingRecoveryDraftWithExisting(
    storage,
    {
      durationMs,
      memoryId: existing.memoryId,
      ...(existing.parentSegmentId ? { parentSegmentId: existing.parentSegmentId } : {}),
      segmentId: existing.segmentId,
      title: existing.title,
      ...(existing.targetKind ? { targetKind: existing.targetKind } : {}),
      workspaceId,
    },
    existing
  );
}

export function updateRecordingRecoverySnapshot({
  segmentId,
  patch,
  workspaceId,
}: {
  readonly segmentId: string;
  readonly patch: {
    readonly durationMs?: number;
    readonly audioChunks?: readonly RecordingRecoveryAudioChunk[];
    readonly finalizedAudio?: RecordingRecoveryFinalizedAudio;
    readonly finalizedSupplement?: FinalizedSegmentSupplementRecording;
    readonly nextSequence?: number;
    readonly recordingSessionId?: string;
    readonly revisionId?: string;
    readonly safeAudioByteLength?: number;
    readonly transcriptMarkdown?: string;
    readonly transcriptSegments?: readonly TranscriptSegment[];
    readonly waveformSamples?: readonly number[];
  };
  readonly workspaceId: string;
}) {
  const existing = readRawRecordingRecoveryDraft(workspaceId);
  if (!existing || existing.segmentId !== segmentId) {
    return;
  }
  const storage = browserStorage();
  if (!storage) {
    return;
  }
  const nextAudioChunks = patch.audioChunks ?? existing.audioChunks;
  const nextFinalizedAudio = patch.finalizedAudio ?? existing.finalizedAudio;
  const nextFinalizedSupplement = patch.finalizedSupplement ?? existing.finalizedSupplement;
  const nextSequenceValue = patch.nextSequence ?? existing.nextSequence;
  const nextRecordingSessionId = patch.recordingSessionId ?? existing.recordingSessionId;
  const nextRevisionId = patch.revisionId ?? existing.revisionId;
  const nextSafeAudioByteLength = patch.safeAudioByteLength ?? existing.safeAudioByteLength;
  const hasTranscriptMarkdownPatch = Object.hasOwn(patch, 'transcriptMarkdown');
  const hasTranscriptSegmentsPatch = Object.hasOwn(patch, 'transcriptSegments');
  const nextWaveformSamples = patch.waveformSamples ?? existing.waveformSamples;
  writeRecordingRecoveryDraftWithExisting(
    storage,
    {
      durationMs: patch.durationMs ?? existing.durationMs,
      memoryId: existing.memoryId,
      ...(existing.parentSegmentId ? { parentSegmentId: existing.parentSegmentId } : {}),
      segmentId: existing.segmentId,
      ...(existing.targetKind ? { targetKind: existing.targetKind } : {}),
      title: existing.title,
      workspaceId,
      ...(nextAudioChunks !== undefined ? { audioChunks: nextAudioChunks } : {}),
      ...(nextFinalizedAudio !== undefined ? { finalizedAudio: nextFinalizedAudio } : {}),
      ...(nextFinalizedSupplement !== undefined
        ? { finalizedSupplement: nextFinalizedSupplement }
        : {}),
      ...(nextSequenceValue !== undefined ? { nextSequence: nextSequenceValue } : {}),
      ...(nextRecordingSessionId !== undefined
        ? { recordingSessionId: nextRecordingSessionId }
        : {}),
      ...(nextRevisionId !== undefined ? { revisionId: nextRevisionId } : {}),
      ...(nextSafeAudioByteLength !== undefined
        ? { safeAudioByteLength: nextSafeAudioByteLength }
        : {}),
      ...(hasTranscriptMarkdownPatch ? { transcriptMarkdown: patch.transcriptMarkdown } : {}),
      ...(hasTranscriptSegmentsPatch ? { transcriptSegments: patch.transcriptSegments } : {}),
      ...(nextWaveformSamples !== undefined ? { waveformSamples: nextWaveformSamples } : {}),
    },
    existing
  );
}

export function clearRecordingRecoveryDraft({
  segmentId,
  workspaceId,
}: {
  readonly segmentId?: string;
  readonly workspaceId: string;
}) {
  const storage = browserStorage();
  if (!storage) {
    return;
  }
  if (segmentId) {
    const existing = readRawRecordingRecoveryDraft(workspaceId);
    if (existing && existing.segmentId !== segmentId) {
      return;
    }
  }
  removeStorageItem(storage, recoveryStorageKey(workspaceId));
  removeStorageItem(storage, recoveryTranscriptStorageKey(workspaceId));
}

export function memoryForRecoveryDraft(
  draft: RecordingRecoveryDraft,
  memories: readonly WorkspaceMemorySummary[]
) {
  return memories.find((memory) => memory.memoryId === draft.memoryId) ?? null;
}

function readRawRecordingRecoveryDraft(workspaceId: string): RecordingRecoveryDraft | null {
  const storage = browserStorage();
  if (!storage) {
    return null;
  }

  const rawDraft = readStorageItem(storage, recoveryStorageKey(workspaceId));
  if (!rawDraft) {
    return null;
  }
  if (rawDraft.length > MAX_RECOVERY_DRAFT_STORAGE_BYTES) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawDraft);
    return isRecoveryDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

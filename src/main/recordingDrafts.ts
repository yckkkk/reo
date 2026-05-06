import { appendFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { writeWorkspaceFileAtomic, writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';
import { updateWorkspaceIndex } from './workspaceFiles.js';
import { createSafeRecordingId, resolveRecordingDirectory } from './workspacePaths.js';
import { workspaceError, type WorkspaceErrorEnvelope } from './workspaceContract.js';

const MAX_AUDIO_CHUNK_BYTES = 1_048_576;

const recordingMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  workspaceId: z.string(),
  recordingId: z.string(),
  status: z.enum(['draft', 'finalized']),
  title: z.string(),
  createdAt: z.string(),
  finalizedAt: z.string().optional(),
  nextSequence: z.number().int().nonnegative(),
  audioByteLength: z.number().int().nonnegative(),
});

type RecordingMetadata = z.infer<typeof recordingMetadataSchema>;

const inFlightAppends = new Set<string>();
const finalizingRecordings = new Set<string>();

function metadataPath(recordingDirectory: string): string {
  return path.join(recordingDirectory, 'recording.json');
}

function audioPath(recordingDirectory: string): string {
  return path.join(recordingDirectory, 'audio.webm');
}

async function readMetadata(
  rootPath: string,
  recordingId: string
): Promise<RecordingMetadata | null> {
  try {
    const recordingDirectory = resolveRecordingDirectory(rootPath, recordingId);
    return recordingMetadataSchema.parse(
      JSON.parse(await readFile(metadataPath(recordingDirectory), 'utf8'))
    );
  } catch {
    return null;
  }
}

async function writeMetadata(
  recordingDirectory: string,
  metadata: RecordingMetadata
): Promise<void> {
  await writeWorkspaceJsonAtomic(metadataPath(recordingDirectory), metadata);
}

export async function initializeRecordingDraftWorkspace({
  rootPath,
}: {
  readonly rootPath: string;
}): Promise<void> {
  await mkdir(path.join(rootPath, 'recordings'), { recursive: true });
}

export async function createRecordingDraft({
  rootPath,
  workspaceId,
  createRecordingId,
  now,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly createRecordingId: () => string;
  readonly now: () => string;
}): Promise<
  | {
      readonly ok: true;
      readonly recordingId: string;
      readonly nextSequence: number;
    }
  | WorkspaceErrorEnvelope
> {
  try {
    const recordingId = createSafeRecordingId(createRecordingId());
    const recordingDirectory = resolveRecordingDirectory(rootPath, recordingId);
    await mkdir(recordingDirectory, { recursive: false });
    const metadata: RecordingMetadata = {
      schemaVersion: 1,
      workspaceId,
      recordingId,
      status: 'draft',
      title: '',
      createdAt: now(),
      nextSequence: 0,
      audioByteLength: 0,
    };
    await appendFile(audioPath(recordingDirectory), new Uint8Array());
    await writeMetadata(recordingDirectory, metadata);
    return { ok: true, recordingId, nextSequence: 0 };
  } catch {
    return workspaceError('ERR_RECORDING_INVALID_ID', 'Recording draft could not be created');
  }
}

export async function appendRecordingAudioChunk({
  rootPath,
  recordingId,
  sequence,
  chunk,
}: {
  readonly rootPath: string;
  readonly recordingId: string;
  readonly sequence: number;
  readonly chunk: Uint8Array;
}): Promise<{ readonly ok: true; readonly nextSequence: number } | WorkspaceErrorEnvelope> {
  if (chunk.byteLength > MAX_AUDIO_CHUNK_BYTES) {
    return workspaceError('ERR_RECORDING_CHUNK_TOO_LARGE', 'Recording audio chunk is too large');
  }

  const key = `${rootPath}:${recordingId}`;
  if (finalizingRecordings.has(key)) {
    return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalized');
  }
  if (inFlightAppends.has(key)) {
    return workspaceError('ERR_RECORDING_APPEND_IN_FLIGHT', 'Recording append already in flight');
  }

  inFlightAppends.add(key);
  try {
    const recordingDirectory = resolveRecordingDirectory(rootPath, recordingId);
    const metadata = await readMetadata(rootPath, recordingId);
    if (!metadata) {
      return workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording draft not found');
    }
    if (metadata.status !== 'draft') {
      return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalized');
    }
    if (metadata.nextSequence !== sequence) {
      return workspaceError('ERR_RECORDING_SEQUENCE', 'Recording audio chunk sequence mismatch');
    }

    await appendFile(audioPath(recordingDirectory), Buffer.from(chunk));
    const nextMetadata = {
      ...metadata,
      nextSequence: metadata.nextSequence + 1,
      audioByteLength: metadata.audioByteLength + chunk.byteLength,
    };
    await writeMetadata(recordingDirectory, nextMetadata);
    return { ok: true, nextSequence: nextMetadata.nextSequence };
  } catch {
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording draft not found');
  } finally {
    inFlightAppends.delete(key);
  }
}

export async function finalizeRecordingDraft({
  rootPath,
  recordingId,
  title,
  now,
}: {
  readonly rootPath: string;
  readonly recordingId: string;
  readonly title: string;
  readonly now: () => string;
}): Promise<
  | {
      readonly ok: true;
      readonly recording: {
        readonly recordingId: string;
        readonly title: string;
        readonly audioByteLength: number;
      };
    }
  | WorkspaceErrorEnvelope
> {
  const key = `${rootPath}:${recordingId}`;
  if (finalizingRecordings.has(key)) {
    return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalized');
  }
  if (inFlightAppends.has(key)) {
    return workspaceError('ERR_RECORDING_APPEND_IN_FLIGHT', 'Recording append still in flight');
  }

  finalizingRecordings.add(key);
  let finalizedMetadataWritten = false;
  try {
    const recordingDirectory = resolveRecordingDirectory(rootPath, recordingId);
    const metadata = await readMetadata(rootPath, recordingId);
    if (!metadata) {
      return workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording draft not found');
    }
    if (metadata.status !== 'draft') {
      return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalized');
    }

    const audio = await stat(audioPath(recordingDirectory));
    const finalized = {
      ...metadata,
      audioByteLength: audio.size,
      status: 'finalized' as const,
      title,
      finalizedAt: now(),
    };
    await writeWorkspaceFileAtomic(path.join(recordingDirectory, 'transcript.md'), '');
    await writeWorkspaceFileAtomic(path.join(recordingDirectory, 'reflections.md'), '');
    await writeMetadata(recordingDirectory, finalized);
    finalizedMetadataWritten = true;
    try {
      await updateWorkspaceIndex(rootPath, (recordings) => [
        ...recordings.filter((recording) => recording.recordingId !== recordingId),
        {
          recordingId,
          title,
          audioByteLength: finalized.audioByteLength,
        },
      ]);
    } catch {
      try {
        await writeMetadata(recordingDirectory, metadata);
        finalizedMetadataWritten = false;
      } catch {
        return workspaceError(
          'ERR_RECORDING_FINALIZE_FAILED',
          'Recording draft could not be finalized',
          'unknown'
        );
      }
      return workspaceError(
        'ERR_RECORDING_FINALIZE_FAILED',
        'Recording draft could not be finalized',
        'draft-preserved'
      );
    }

    return {
      ok: true,
      recording: {
        recordingId,
        title,
        audioByteLength: finalized.audioByteLength,
      },
    };
  } catch {
    return workspaceError(
      'ERR_RECORDING_FINALIZE_FAILED',
      'Recording draft could not be finalized',
      finalizedMetadataWritten ? 'unknown' : 'draft-preserved'
    );
  } finally {
    finalizingRecordings.delete(key);
  }
}

export async function discardRecordingDraft({
  rootPath,
  recordingId,
}: {
  readonly rootPath: string;
  readonly recordingId: string;
}): Promise<{ readonly ok: true; readonly discarded: true } | WorkspaceErrorEnvelope> {
  try {
    await rm(resolveRecordingDirectory(rootPath, recordingId), { recursive: true, force: true });
    return { ok: true, discarded: true };
  } catch {
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording draft not found');
  }
}

export async function readRecordingAudioManifest({
  rootPath,
  recordingId,
}: {
  readonly rootPath: string;
  readonly recordingId: string;
}): Promise<
  | {
      readonly ok: true;
      readonly manifest: {
        readonly recordingId: string;
        readonly byteLength: number;
        readonly maxChunkBytes: number;
      };
    }
  | WorkspaceErrorEnvelope
> {
  try {
    const recordingDirectory = resolveRecordingDirectory(rootPath, recordingId);
    const audio = await stat(audioPath(recordingDirectory));
    return {
      ok: true,
      manifest: {
        recordingId,
        byteLength: audio.size,
        maxChunkBytes: MAX_AUDIO_CHUNK_BYTES,
      },
    };
  } catch {
    return workspaceError('ERR_RECORDING_AUDIO_MISSING', 'Recording audio is missing');
  }
}

export async function readRecordingAudioChunk({
  rootPath,
  recordingId,
  offset,
  length,
}: {
  readonly rootPath: string;
  readonly recordingId: string;
  readonly offset: number;
  readonly length: number;
}): Promise<{ readonly ok: true; readonly chunk: Uint8Array } | WorkspaceErrorEnvelope> {
  if (offset < 0 || length <= 0 || length > MAX_AUDIO_CHUNK_BYTES) {
    return workspaceError('ERR_RECORDING_INVALID_RANGE', 'Recording audio range is invalid');
  }

  try {
    const recordingDirectory = resolveRecordingDirectory(rootPath, recordingId);
    const audio = await readFile(audioPath(recordingDirectory));
    if (offset + length > audio.byteLength) {
      return workspaceError('ERR_RECORDING_INVALID_RANGE', 'Recording audio range is invalid');
    }
    return {
      ok: true,
      chunk: new Uint8Array(audio.subarray(offset, offset + length)),
    };
  } catch {
    return workspaceError('ERR_RECORDING_AUDIO_MISSING', 'Recording audio is missing');
  }
}

export async function getRecordingDetail({
  rootPath,
  recordingId,
}: {
  readonly rootPath: string;
  readonly recordingId: string;
}): Promise<{ readonly ok: true; readonly recording: RecordingMetadata } | WorkspaceErrorEnvelope> {
  const metadata = await readMetadata(rootPath, recordingId);
  return metadata
    ? { ok: true, recording: metadata }
    : workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording not found');
}

export async function saveRecordingMarkdown({
  rootPath,
  recordingId,
  fileName,
  markdown,
}: {
  readonly rootPath: string;
  readonly recordingId: string;
  readonly fileName: 'transcript.md' | 'reflections.md';
  readonly markdown: string;
}): Promise<{ readonly ok: true; readonly saved: true } | WorkspaceErrorEnvelope> {
  try {
    const recordingDirectory = resolveRecordingDirectory(rootPath, recordingId);
    await writeWorkspaceFileAtomic(path.join(recordingDirectory, fileName), markdown);
    return { ok: true, saved: true };
  } catch {
    return workspaceError(
      'ERR_RECORDING_NOT_FOUND',
      'Recording markdown could not be saved',
      'previous-file-preserved'
    );
  }
}

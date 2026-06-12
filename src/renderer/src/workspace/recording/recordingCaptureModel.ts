import { trimPcmChunkEnd } from '../../../../workspace-contract/recording-audio';

export const RECORDING_CAPTURE_SEEK_EPSILON_MS = 50;
const MAX_RECORDING_WAVEFORM_SAMPLES = 2400;

export type CapturedRecordingChunk = {
  readonly chunk: Uint8Array;
  readonly endTimeMs: number;
  readonly startTimeMs: number;
};

export type CapturedPcmChunk = {
  readonly chunk: Uint8Array;
  readonly endTimeMs: number;
  readonly startTimeMs: number;
};

export function recordingSessionNumberFrom(recordingSessionId: string) {
  const match = /^recording-(\d+)$/.exec(recordingSessionId);
  return match ? Number.parseInt(match[1] ?? '0', 10) : null;
}

export function appendBoundedWaveformSampleInPlace(samples: number[], sample: number): void {
  samples.push(sample);
  if (samples.length <= MAX_RECORDING_WAVEFORM_SAMPLES) {
    return;
  }
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < samples.length; readIndex += 2) {
    samples[writeIndex] = Math.max(samples[readIndex] ?? 0, samples[readIndex + 1] ?? 0);
    writeIndex += 1;
  }
  samples.length = Math.min(writeIndex, MAX_RECORDING_WAVEFORM_SAMPLES);
}

export function resolveReplacementStartMs({
  chunks,
  cursorTimeMs,
  totalDurationMs,
}: {
  readonly chunks: readonly CapturedRecordingChunk[];
  readonly cursorTimeMs: number;
  readonly totalDurationMs: number;
}) {
  const safeCursorTimeMs = Math.min(
    Math.max(0, Math.round(cursorTimeMs)),
    Math.max(0, Math.round(totalDurationMs))
  );
  if (safeCursorTimeMs <= RECORDING_CAPTURE_SEEK_EPSILON_MS) {
    return 0;
  }
  const containingOrNextChunk = chunks.find(
    (chunk) => chunk.endTimeMs >= safeCursorTimeMs - RECORDING_CAPTURE_SEEK_EPSILON_MS
  );
  if (!containingOrNextChunk) {
    return safeCursorTimeMs;
  }
  return Math.min(totalDurationMs, containingOrNextChunk.endTimeMs);
}

export function resolveDraftPlaybackStartMs({
  cursorTimeMs,
  totalDurationMs,
}: {
  readonly cursorTimeMs: number;
  readonly totalDurationMs: number;
}) {
  const safeTotalDurationMs = Math.max(0, Math.round(totalDurationMs));
  if (safeTotalDurationMs <= RECORDING_CAPTURE_SEEK_EPSILON_MS) {
    return 0;
  }

  const safeCursorTimeMs = Math.min(Math.max(0, Math.round(cursorTimeMs)), safeTotalDurationMs);
  if (safeCursorTimeMs >= safeTotalDurationMs - RECORDING_CAPTURE_SEEK_EPSILON_MS) {
    return 0;
  }
  return safeCursorTimeMs;
}

export function retainPcmChunksThrough(
  chunks: readonly CapturedPcmChunk[],
  cursorTimeMs: number
): CapturedPcmChunk[] {
  const retainedChunks: CapturedPcmChunk[] = [];
  for (const chunk of chunks) {
    if (chunk.endTimeMs <= cursorTimeMs) {
      retainedChunks.push(chunk);
      continue;
    }
    if (chunk.startTimeMs >= cursorTimeMs) {
      continue;
    }
    const retainedAudio = trimPcmChunkEnd(chunk.chunk, cursorTimeMs - chunk.startTimeMs);
    if (retainedAudio) {
      retainedChunks.push({
        chunk: new Uint8Array(retainedAudio),
        endTimeMs: cursorTimeMs,
        startTimeMs: chunk.startTimeMs,
      });
    }
  }
  return retainedChunks;
}

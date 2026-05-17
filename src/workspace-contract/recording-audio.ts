export const RECORDING_TRANSCRIPTION_PCM_SAMPLE_RATE_HZ = 16_000;
export const RECORDING_TRANSCRIPTION_PCM_BITS_PER_SAMPLE = 16;
export const RECORDING_TRANSCRIPTION_PCM_CHANNELS = 1;
export const RECORDING_TRANSCRIPTION_PCM_CHUNK_DURATION_MS = 200;
export const MAX_RECORDING_DRAFT_AUDIO_READ_BYTES = 64 * 1024 * 1024;
export const MAX_BACKFILL_AUDIO_READ_BYTES = 100 * 1024 * 1024;
export const RECORDING_TRANSCRIPTION_PCM_BYTES_PER_SAMPLE =
  RECORDING_TRANSCRIPTION_PCM_BITS_PER_SAMPLE / 8;
export const RECORDING_TRANSCRIPTION_PCM_BYTES_PER_MILLISECOND =
  (RECORDING_TRANSCRIPTION_PCM_SAMPLE_RATE_HZ *
    RECORDING_TRANSCRIPTION_PCM_BYTES_PER_SAMPLE *
    RECORDING_TRANSCRIPTION_PCM_CHANNELS) /
  1000;

export function pcmByteLengthToDurationMs(byteLength: number) {
  if (byteLength <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(byteLength / RECORDING_TRANSCRIPTION_PCM_BYTES_PER_MILLISECOND));
}

export function pcmChunkByteLengthForDuration(durationMs: number) {
  return (
    Math.max(1, Math.round((RECORDING_TRANSCRIPTION_PCM_SAMPLE_RATE_HZ * durationMs) / 1000)) *
    RECORDING_TRANSCRIPTION_PCM_BYTES_PER_SAMPLE *
    RECORDING_TRANSCRIPTION_PCM_CHANNELS
  );
}

function pcmByteLengthForDuration(durationMs: number, round: (value: number) => number): number {
  if (durationMs <= 0) {
    return 0;
  }
  return (
    Math.max(0, round((RECORDING_TRANSCRIPTION_PCM_SAMPLE_RATE_HZ * durationMs) / 1000)) *
    RECORDING_TRANSCRIPTION_PCM_BYTES_PER_SAMPLE *
    RECORDING_TRANSCRIPTION_PCM_CHANNELS
  );
}

export function trimPcmChunkStart(chunk: Uint8Array, trimDurationMs: number): Uint8Array | null {
  const offset = Math.min(chunk.byteLength, pcmByteLengthForDuration(trimDurationMs, Math.ceil));
  if (offset >= chunk.byteLength) {
    return null;
  }
  return chunk.subarray(offset);
}

export function trimPcmChunkEnd(chunk: Uint8Array, keepDurationMs: number): Uint8Array | null {
  const byteLength = Math.min(
    chunk.byteLength,
    pcmByteLengthForDuration(keepDurationMs, Math.floor)
  );
  if (byteLength <= 0) {
    return null;
  }
  return chunk.subarray(0, byteLength);
}

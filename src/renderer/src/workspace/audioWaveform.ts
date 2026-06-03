export const MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT = 320;
export const MEMORY_STUDIO_PLAYBACK_WAVEFORM_DECODE_MAX_BYTES = 20 * 1024 * 1024;
export const MEMORY_STUDIO_PLAYBACK_WAVEFORM_DECODE_TIMEOUT_MS = 5_000;
const MEMORY_STUDIO_PLAYBACK_WAVEFORM_MAX_SAMPLES_PER_BAR = 512;

type DecodedAudioBuffer = Pick<AudioBuffer, 'getChannelData' | 'length' | 'numberOfChannels'>;

type AudioContextConstructor = new () => AudioContext;

let sharedAudioContext: AudioContext | null = null;

function createExactArrayBuffer(audioBytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(audioBytes.byteLength);
  copy.set(audioBytes);
  return copy.buffer;
}

export function createWaveformDataFromAudioBuffer(
  audioBuffer: DecodedAudioBuffer,
  barCount = MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT
): readonly number[] {
  const safeBarCount = Math.max(0, Math.floor(barCount));
  if (safeBarCount === 0) {
    return [];
  }

  if (audioBuffer.length <= 0 || audioBuffer.numberOfChannels <= 0) {
    return Array.from({ length: safeBarCount }, () => 0);
  }

  const channelData = Array.from({ length: audioBuffer.numberOfChannels }, (_, channelIndex) =>
    audioBuffer.getChannelData(channelIndex)
  );
  const levels = new Array<number>(safeBarCount);
  let maxLevel = 0;

  for (let barIndex = 0; barIndex < safeBarCount; barIndex += 1) {
    const start = Math.floor((barIndex / safeBarCount) * audioBuffer.length);
    const end = Math.max(
      start + 1,
      Math.floor(((barIndex + 1) / safeBarCount) * audioBuffer.length)
    );
    const span = end - start;
    const stride = Math.max(
      1,
      Math.ceil(span / MEMORY_STUDIO_PLAYBACK_WAVEFORM_MAX_SAMPLES_PER_BAR)
    );
    let sampleCount = 0;
    let squareSum = 0;

    for (const channel of channelData) {
      const safeEnd = Math.min(channel.length, end);

      for (let sampleIndex = start; sampleIndex < safeEnd; sampleIndex += stride) {
        const sample = channel[sampleIndex] ?? 0;
        squareSum += sample * sample;
        sampleCount += 1;
      }
    }

    const level = sampleCount > 0 ? Math.sqrt(squareSum / sampleCount) : 0;
    levels[barIndex] = level;
    maxLevel = Math.max(maxLevel, level);
  }

  if (maxLevel <= 0) {
    return levels;
  }

  for (let index = 0; index < levels.length; index += 1) {
    levels[index] = Math.min(1, (levels[index] ?? 0) / maxLevel);
  }
  return levels;
}

export function createFallbackWaveformData(
  byteLength: number,
  durationMs: number,
  barCount = MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT
): readonly number[] {
  const safeBarCount = Math.max(0, Math.floor(barCount));
  if (safeBarCount === 0) {
    return [];
  }

  const safeByteLength = Number.isFinite(byteLength) && byteLength > 0 ? byteLength : 1;
  const safeDurationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 1;
  const density = Math.min(1, Math.max(0, safeByteLength / Math.max(1, safeDurationMs * 3)));
  const seed = Math.max(1, Math.floor((safeByteLength % 9973) + (safeDurationMs % 7919)));

  return Array.from({ length: safeBarCount }, (_value, index) => {
    const position = index / Math.max(1, safeBarCount - 1);
    const envelope = 0.72 + 0.2 * Math.sin(position * Math.PI);
    const low = Math.sin((index + seed) * 0.19) * 0.18;
    const mid = Math.sin((index + seed * 0.37) * 0.047) * 0.14;
    const high = Math.sin((index + seed * 0.13) * 0.61) * 0.08;
    const level = 0.28 + density * 0.18 + low + mid + high;
    return Math.min(0.96, Math.max(0.14, level * envelope));
  });
}

function getSharedAudioContext(): AudioContext {
  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { readonly webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error('AudioContext unavailable');
  }

  sharedAudioContext ??= new AudioContextCtor();
  return sharedAudioContext;
}

export async function closeAudioWaveformDecoder(): Promise<void> {
  const audioContext = sharedAudioContext;
  sharedAudioContext = null;
  if (audioContext) {
    await audioContext.close();
  }
}

export async function decodeAudioBytesToWaveformData(
  audioBytes: Uint8Array,
  barCount = MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT,
  timeoutMs = MEMORY_STUDIO_PLAYBACK_WAVEFORM_DECODE_TIMEOUT_MS
): Promise<readonly number[]> {
  let timeoutId: ReturnType<typeof window.setTimeout> | null = null;
  const decodePromise = getSharedAudioContext().decodeAudioData(createExactArrayBuffer(audioBytes));
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = window.setTimeout(
      () => {
        reject(new Error('Audio waveform decode timed out.'));
      },
      Math.max(0, timeoutMs)
    );
  });

  const audioBuffer = await Promise.race([decodePromise, timeoutPromise]).finally(() => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  });
  return createWaveformDataFromAudioBuffer(audioBuffer, barCount);
}

export function canDecodeAudioBytesToWaveformData(byteLength: number): boolean {
  return (
    Number.isFinite(byteLength) &&
    byteLength > 0 &&
    byteLength <= MEMORY_STUDIO_PLAYBACK_WAVEFORM_DECODE_MAX_BYTES
  );
}

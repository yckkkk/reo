export const MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT = 160;
export const MEMORY_STUDIO_PLAYBACK_WAVEFORM_DECODE_MAX_BYTES = 20 * 1024 * 1024;

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
  const peaks = new Array<number>(safeBarCount);
  let maxPeak = 0;

  for (let barIndex = 0; barIndex < safeBarCount; barIndex += 1) {
    const start = Math.floor((barIndex / safeBarCount) * audioBuffer.length);
    const end = Math.max(
      start + 1,
      Math.floor(((barIndex + 1) / safeBarCount) * audioBuffer.length)
    );
    let peak = 0;

    for (const channel of channelData) {
      const safeEnd = Math.min(channel.length, end);

      for (let sampleIndex = start; sampleIndex < safeEnd; sampleIndex += 1) {
        peak = Math.max(peak, Math.abs(channel[sampleIndex] ?? 0));
      }
    }

    peaks[barIndex] = peak;
    maxPeak = Math.max(maxPeak, peak);
  }

  if (maxPeak <= 0) {
    return peaks;
  }

  for (let index = 0; index < peaks.length; index += 1) {
    peaks[index] = Math.min(1, (peaks[index] ?? 0) / maxPeak);
  }
  return peaks;
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
  barCount = MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT
): Promise<readonly number[]> {
  const audioBuffer = await getSharedAudioContext().decodeAudioData(
    createExactArrayBuffer(audioBytes)
  );
  return createWaveformDataFromAudioBuffer(audioBuffer, barCount);
}

export function canDecodeAudioBytesToWaveformData(byteLength: number): boolean {
  return (
    Number.isFinite(byteLength) &&
    byteLength > 0 &&
    byteLength <= MEMORY_STUDIO_PLAYBACK_WAVEFORM_DECODE_MAX_BYTES
  );
}

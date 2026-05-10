export const MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT = 160;

type DecodedAudioBuffer = Pick<AudioBuffer, 'getChannelData' | 'length' | 'numberOfChannels'>;

type AudioContextConstructor = new () => AudioContext;

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

  const peaks = Array.from({ length: safeBarCount }, (_, barIndex) => {
    const start = Math.floor((barIndex / safeBarCount) * audioBuffer.length);
    const end = Math.max(
      start + 1,
      Math.floor(((barIndex + 1) / safeBarCount) * audioBuffer.length)
    );
    let peak = 0;

    for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
      const channelData = audioBuffer.getChannelData(channelIndex);
      const safeEnd = Math.min(channelData.length, end);

      for (let sampleIndex = start; sampleIndex < safeEnd; sampleIndex += 1) {
        peak = Math.max(peak, Math.abs(channelData[sampleIndex] ?? 0));
      }
    }

    return peak;
  });
  const maxPeak = Math.max(...peaks);

  if (maxPeak <= 0) {
    return peaks;
  }

  return peaks.map((peak) => Math.min(1, peak / maxPeak));
}

export async function decodeAudioBytesToWaveformData(
  audioBytes: Uint8Array,
  barCount = MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT
): Promise<readonly number[]> {
  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { readonly webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error('AudioContext unavailable');
  }

  const audioContext = new AudioContextCtor();

  try {
    const audioBuffer = await audioContext.decodeAudioData(createExactArrayBuffer(audioBytes));
    return createWaveformDataFromAudioBuffer(audioBuffer, barCount);
  } finally {
    await audioContext.close();
  }
}

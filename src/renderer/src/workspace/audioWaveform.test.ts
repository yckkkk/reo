import { describe, expect, it, vi } from 'vitest';
import { createWaveformDataFromAudioBuffer, decodeAudioBytesToWaveformData } from './audioWaveform';

describe('audioWaveform', () => {
  it('derives normalized peaks from decoded audio samples across channels', () => {
    const left = Float32Array.from([0, 0.2, -0.6, 0.1, 0.9, -0.4, 0.05, -0.8]);
    const right = Float32Array.from([0.8, -0.3, 0.1, -0.05, 0.2, -0.4, 0.3, -0.1]);

    const waveform = createWaveformDataFromAudioBuffer(
      {
        length: left.length,
        numberOfChannels: 2,
        getChannelData: (channelIndex) => (channelIndex === 0 ? left : right),
      },
      4
    );

    expect(waveform).toHaveLength(4);
    expect(waveform[0]).toBeCloseTo(0.8 / 0.9, 4);
    expect(waveform[1]).toBeCloseTo(0.6 / 0.9, 4);
    expect(waveform[2]).toBe(1);
    expect(waveform[3]).toBeCloseTo(0.8 / 0.9, 4);
  });

  it('keeps silence silent instead of generating placeholder bars', () => {
    const waveform = createWaveformDataFromAudioBuffer(
      {
        length: 4,
        numberOfChannels: 1,
        getChannelData: () => Float32Array.from([0, 0, 0, 0]),
      },
      3
    );

    expect(waveform).toEqual([0, 0, 0]);
  });

  it('decodes the exact finalized audio byte range before peak extraction', async () => {
    const samples = Float32Array.from([0, 0.5, -1, 0.25]);
    const decodeAudioData = vi.fn(async (_audioData: ArrayBuffer) => ({
      length: samples.length,
      numberOfChannels: 1,
      getChannelData: () => samples,
    }));
    const close = vi.fn(async () => undefined);
    const AudioContextMock = vi.fn(function MockAudioContext() {
      return { close, decodeAudioData };
    });
    vi.stubGlobal('AudioContext', AudioContextMock);

    const sourceBuffer = new Uint8Array([99, 1, 2, 3, 88]);
    const slicedBytes = sourceBuffer.subarray(1, 4);
    const waveform = await decodeAudioBytesToWaveformData(slicedBytes, 2);

    expect(waveform).toEqual([0.5, 1]);
    expect(decodeAudioData).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    const decodedBuffer = decodeAudioData.mock.calls[0]?.[0];
    if (!(decodedBuffer instanceof ArrayBuffer)) {
      throw new Error('Expected decoded audio bytes to be copied into an ArrayBuffer.');
    }
    const decodedBytes = new Uint8Array(decodedBuffer);
    expect([...decodedBytes]).toEqual([1, 2, 3]);
    expect(close).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canDecodeAudioBytesToWaveformData,
  closeAudioWaveformDecoder,
  createWaveformDataFromAudioBuffer,
  decodeAudioBytesToWaveformData,
  MEMORY_STUDIO_PLAYBACK_WAVEFORM_DECODE_MAX_BYTES,
} from './audioWaveform';

afterEach(async () => {
  await closeAudioWaveformDecoder();
  vi.unstubAllGlobals();
});

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
    expect(close).not.toHaveBeenCalled();

    await closeAudioWaveformDecoder();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('copies exact Uint8Array buffers before WebAudio can detach them', async () => {
    const samples = Float32Array.from([1]);
    const decodeAudioData = vi.fn(async (_audioData: ArrayBuffer) => ({
      length: samples.length,
      numberOfChannels: 1,
      getChannelData: () => samples,
    }));
    const AudioContextMock = vi.fn(function MockAudioContext() {
      return { close: vi.fn(async () => undefined), decodeAudioData };
    });
    vi.stubGlobal('AudioContext', AudioContextMock);

    const audioBytes = new Uint8Array([1, 2, 3]);
    await decodeAudioBytesToWaveformData(audioBytes, 1);

    const decodedBuffer = decodeAudioData.mock.calls[0]?.[0];
    expect(decodedBuffer).toBeInstanceOf(ArrayBuffer);
    expect(decodedBuffer).not.toBe(audioBytes.buffer);
    expect([...(decodedBuffer ? new Uint8Array(decodedBuffer) : [])]).toEqual([1, 2, 3]);
    expect([...audioBytes]).toEqual([1, 2, 3]);
  });

  it('reuses one AudioContext across repeated waveform decodes', async () => {
    const decodeAudioData = vi.fn(async () => ({
      length: 1,
      numberOfChannels: 1,
      getChannelData: () => Float32Array.from([1]),
    }));
    const close = vi.fn(async () => undefined);
    const AudioContextMock = vi.fn(function MockAudioContext() {
      return { close, decodeAudioData };
    });
    vi.stubGlobal('AudioContext', AudioContextMock);

    await decodeAudioBytesToWaveformData(new Uint8Array([1]), 1);
    await decodeAudioBytesToWaveformData(new Uint8Array([2]), 1);

    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(decodeAudioData).toHaveBeenCalledTimes(2);
    expect(close).not.toHaveBeenCalled();

    await closeAudioWaveformDecoder();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('caps decoded waveform input size before WebAudio expansion', () => {
    expect(canDecodeAudioBytesToWaveformData(1)).toBe(true);
    expect(
      canDecodeAudioBytesToWaveformData(MEMORY_STUDIO_PLAYBACK_WAVEFORM_DECODE_MAX_BYTES)
    ).toBe(true);
    expect(
      canDecodeAudioBytesToWaveformData(MEMORY_STUDIO_PLAYBACK_WAVEFORM_DECODE_MAX_BYTES + 1)
    ).toBe(false);
    expect(canDecodeAudioBytesToWaveformData(0)).toBe(false);
  });
});

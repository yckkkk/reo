import { describe, expect, it } from 'vitest';
import { pcmChunkByteLengthForDuration } from '../../../../workspace-contract/recording-audio';
import {
  appendBoundedWaveformSampleInPlace,
  recordingSessionNumberFrom,
  resolveDraftPlaybackStartMs,
  resolveReplacementStartMs,
  retainPcmChunksThrough,
} from './recordingCaptureModel';

describe('recordingCaptureModel', () => {
  it('parses only current recording session ids', () => {
    expect(recordingSessionNumberFrom('recording-12')).toBe(12);
    expect(recordingSessionNumberFrom('recording-12-extra')).toBeNull();
    expect(recordingSessionNumberFrom('session-12')).toBeNull();
  });

  it('snaps replacement to the containing or next durable chunk end', () => {
    const chunks = [
      { chunk: new Uint8Array([1]), startTimeMs: 0, endTimeMs: 250 },
      { chunk: new Uint8Array([2]), startTimeMs: 250, endTimeMs: 500 },
    ];

    expect(resolveReplacementStartMs({ chunks, cursorTimeMs: 20, totalDurationMs: 1_000 })).toBe(0);
    expect(resolveReplacementStartMs({ chunks, cursorTimeMs: 260, totalDurationMs: 1_000 })).toBe(
      250
    );
    expect(resolveReplacementStartMs({ chunks, cursorTimeMs: 310, totalDurationMs: 1_000 })).toBe(
      500
    );
    expect(resolveReplacementStartMs({ chunks, cursorTimeMs: 900, totalDurationMs: 1_000 })).toBe(
      900
    );
  });

  it('starts draft playback at the cursor unless it is effectively at the end', () => {
    expect(resolveDraftPlaybackStartMs({ cursorTimeMs: 3_000, totalDurationMs: 10_000 })).toBe(
      3_000
    );
    expect(resolveDraftPlaybackStartMs({ cursorTimeMs: 9_980, totalDurationMs: 10_000 })).toBe(0);
    expect(resolveDraftPlaybackStartMs({ cursorTimeMs: -100, totalDurationMs: 10_000 })).toBe(0);
  });

  it('compacts waveform samples in place when the capture buffer exceeds its cap', () => {
    const samples = Array.from({ length: 2400 }, (_, index) => index);

    appendBoundedWaveformSampleInPlace(samples, 2400);

    expect(samples).toHaveLength(1201);
    expect(samples.slice(0, 4)).toEqual([1, 3, 5, 7]);
    expect(samples.at(-1)).toBe(2400);
  });

  it('retains full PCM chunks before the cursor and trims an overlapping chunk', () => {
    const first = new Uint8Array(pcmChunkByteLengthForDuration(100)).fill(1);
    const second = new Uint8Array(pcmChunkByteLengthForDuration(200)).fill(2);

    const retained = retainPcmChunksThrough(
      [
        { chunk: first, startTimeMs: 0, endTimeMs: 100 },
        { chunk: second, startTimeMs: 100, endTimeMs: 300 },
        {
          chunk: new Uint8Array(pcmChunkByteLengthForDuration(100)).fill(3),
          startTimeMs: 300,
          endTimeMs: 400,
        },
      ],
      150
    );

    expect(retained).toHaveLength(2);
    expect(retained[0]?.chunk).toBe(first);
    expect(retained[1]?.startTimeMs).toBe(100);
    expect(retained[1]?.endTimeMs).toBe(150);
    expect(retained[1]?.chunk.byteLength).toBe(pcmChunkByteLengthForDuration(50));
  });
});

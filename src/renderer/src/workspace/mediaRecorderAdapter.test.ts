import { describe, expect, it, vi } from 'vitest';
import { createBrowserMediaRecorderAdapter } from './mediaRecorderAdapter';

describe('MediaRecorder adapter', () => {
  it('requests audio only and emits Uint8Array chunks', async () => {
    let dataHandler: (event: BlobEvent) => void = () => {};
    const mediaDevices = {
      getUserMedia: vi.fn(async () => ({ id: 'stream-1' }) as unknown as MediaStream),
    };
    class FakeMediaRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;

      constructor() {
        dataHandler = (event) => this.ondataavailable?.(event);
      }

      pause() {}
      resume() {}
      start() {}
      stop() {
        this.onstop?.();
      }
    }

    const chunks: Uint8Array[] = [];
    const adapter = createBrowserMediaRecorderAdapter({
      mediaDevices,
      MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
    });
    await adapter.start({
      onChunk: (chunk) => chunks.push(chunk),
      onError: () => {},
      onStop: () => {},
    });
    dataHandler?.({ data: new Blob([new Uint8Array([1, 2, 3])]) } as BlobEvent);
    await Promise.resolve();

    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(chunks).toEqual([new Uint8Array([1, 2, 3])]);
  });
});

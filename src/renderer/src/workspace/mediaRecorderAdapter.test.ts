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

  it('waits for the final dataavailable chunk before stop resolves', async () => {
    type FakeRecordingState = 'inactive' | 'paused' | 'recording';
    let recorderState: FakeRecordingState = 'inactive';
    let resolveFinalChunk: (value: ArrayBuffer) => void = () => {};
    const stream = {
      getTracks: vi.fn(() => [{ stop: vi.fn() }]),
    } as unknown as MediaStream;
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };
    const finalData = {
      arrayBuffer: vi.fn(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            resolveFinalChunk = resolve;
          })
      ),
      size: 1,
    };

    class FakeMediaRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;
      state: FakeRecordingState = 'recording';

      constructor() {
        recorderState = this.state;
      }

      pause() {}
      resume() {}
      start() {}
      stop() {
        this.state = 'inactive';
        recorderState = this.state;
        this.ondataavailable?.({ data: finalData } as unknown as BlobEvent);
        this.onstop?.();
      }
    }

    const chunks: Uint8Array[] = [];
    const adapter = createBrowserMediaRecorderAdapter({
      mediaDevices,
      MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
    });
    const controller = await adapter.start({
      onChunk: (chunk) => chunks.push(chunk),
      onError: () => {},
      onStop: () => {},
    });

    let stopResolved = false;
    const stopPromise = controller.stop().then(() => {
      stopResolved = true;
    });
    await Promise.resolve();

    expect(recorderState).toBe('inactive');
    expect(stopResolved).toBe(false);
    resolveFinalChunk(new Uint8Array([9]).buffer);
    await stopPromise;
    expect(chunks).toEqual([new Uint8Array([9])]);
  });

  it('reuses the same stop operation while final chunk conversion is pending', async () => {
    let resolveFinalChunk: (value: ArrayBuffer) => void = () => {};
    const track = { stop: vi.fn() };
    const stream = {
      getTracks: vi.fn(() => [track]),
    } as unknown as MediaStream;
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };
    const finalData = {
      arrayBuffer: vi.fn(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            resolveFinalChunk = resolve;
          })
      ),
      size: 1,
    };
    const recorderStop = vi.fn();

    class FakeMediaRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;
      state: 'inactive' | 'recording' = 'recording';

      pause() {}
      resume() {}
      start() {}
      stop() {
        recorderStop();
        this.state = 'inactive';
        this.ondataavailable?.({ data: finalData } as unknown as BlobEvent);
        this.onstop?.();
      }
    }

    const adapter = createBrowserMediaRecorderAdapter({
      mediaDevices,
      MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
    });
    const controller = await adapter.start({
      onChunk: () => {},
      onError: () => {},
      onStop: () => {},
    });

    const firstStop = controller.stop();
    const secondStop = controller.stop();
    resolveFinalChunk(new Uint8Array([7]).buffer);
    await Promise.all([firstStop, secondStop]);

    expect(recorderStop).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('rejects stop when final chunk conversion fails', async () => {
    const track = { stop: vi.fn() };
    const stream = {
      getTracks: vi.fn(() => [track]),
    } as unknown as MediaStream;
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };
    const finalData = {
      arrayBuffer: vi.fn(async () => {
        throw new Error('Blob read failed');
      }),
      size: 1,
    };

    class FakeMediaRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;
      state: 'inactive' | 'recording' = 'recording';

      pause() {}
      resume() {}
      start() {}
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: finalData } as unknown as BlobEvent);
        this.onstop?.();
      }
    }

    const onError = vi.fn();
    const adapter = createBrowserMediaRecorderAdapter({
      mediaDevices,
      MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
    });
    const controller = await adapter.start({
      onChunk: () => {},
      onError,
      onStop: () => {},
    });

    await expect(controller.stop()).rejects.toThrow('Microphone recording failed');
    expect(onError).toHaveBeenCalledWith('Microphone recording failed');
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('stops acquired tracks when recorder setup fails', async () => {
    const track = { stop: vi.fn() };
    const stream = {
      getTracks: vi.fn(() => [track]),
    } as unknown as MediaStream;
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };

    class FakeMediaRecorder {
      start() {
        throw new Error('Recorder start failed');
      }
    }

    const adapter = createBrowserMediaRecorderAdapter({
      mediaDevices,
      MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
    });

    await expect(
      adapter.start({
        onChunk: () => {},
        onError: () => {},
        onStop: () => {},
      })
    ).rejects.toThrow('Recorder start failed');
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('stops acquired tracks when recorder construction fails', async () => {
    const track = { stop: vi.fn() };
    const stream = {
      getTracks: vi.fn(() => [track]),
    } as unknown as MediaStream;
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };

    class FakeMediaRecorder {
      constructor() {
        throw new Error('Recorder construction failed');
      }
    }

    const adapter = createBrowserMediaRecorderAdapter({
      mediaDevices,
      MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
    });

    await expect(
      adapter.start({
        onChunk: () => {},
        onError: () => {},
        onStop: () => {},
      })
    ).rejects.toThrow('Recorder construction failed');
    expect(track.stop).toHaveBeenCalledTimes(1);
  });
});

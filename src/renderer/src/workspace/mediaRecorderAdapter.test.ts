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

  it('flushes current recorder data for paused draft preview', async () => {
    let resolvePreviewChunk: (value: ArrayBuffer) => void = () => {};
    const track = { stop: vi.fn() };
    const stream = {
      getAudioTracks: vi.fn(() => [track]),
      getTracks: vi.fn(() => [track]),
    } as unknown as MediaStream;
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };
    const previewData = {
      arrayBuffer: vi.fn(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            resolvePreviewChunk = resolve;
          })
      ),
      size: 1,
    };
    const requestData = vi.fn();

    class FakeMediaRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;
      state: 'inactive' | 'paused' | 'recording' = 'recording';

      pause() {
        this.state = 'paused';
      }
      requestData() {
        requestData();
        this.ondataavailable?.({ data: previewData } as unknown as BlobEvent);
      }
      resume() {
        this.state = 'recording';
      }
      start() {}
      stop() {
        this.state = 'inactive';
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

    controller.pause();
    let flushResult: boolean | null = null;
    const flushPromise = controller.flush().then((result) => {
      flushResult = result;
    });
    await Promise.resolve();

    expect(requestData).toHaveBeenCalledTimes(1);
    expect(flushResult).toBeNull();

    resolvePreviewChunk(new Uint8Array([4]).buffer);
    await flushPromise;

    expect(chunks).toEqual([new Uint8Array([4])]);
    expect(flushResult).toBe(true);
  });

  it('reports when a paused preview flush times out before dataavailable arrives', async () => {
    vi.useFakeTimers();
    try {
      const track = { stop: vi.fn() };
      const stream = {
        getAudioTracks: vi.fn(() => [track]),
        getTracks: vi.fn(() => [track]),
      } as unknown as MediaStream;
      const mediaDevices = {
        getUserMedia: vi.fn(async () => stream),
      };
      const requestData = vi.fn();

      class FakeMediaRecorder {
        ondataavailable: ((event: BlobEvent) => void) | null = null;
        onerror: (() => void) | null = null;
        onstop: (() => void) | null = null;
        state: 'inactive' | 'paused' | 'recording' = 'recording';

        pause() {
          this.state = 'paused';
        }
        requestData() {
          requestData();
        }
        resume() {
          this.state = 'recording';
        }
        start() {}
        stop() {
          this.state = 'inactive';
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

      controller.pause();
      const flushPromise = controller.flush();
      await Promise.resolve();
      expect(requestData).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(250);

      await expect(flushPromise).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
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

    await expect(controller.stop()).rejects.toThrow('麦克风录音失败。');
    expect(onError).toHaveBeenCalledWith('麦克风录音失败。');
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('emits encoded PCM chunks from the microphone audio graph', async () => {
    let workletMessageHandler: ((event: MessageEvent<Uint8Array>) => void) | null = null;
    const track = { stop: vi.fn() };
    const stream = {
      getAudioTracks: vi.fn(() => [track]),
      getTracks: vi.fn(() => [track]),
    } as unknown as MediaStream;
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };
    const mediaStreamSource = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const gain = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: { value: 1 },
    };
    const audioContext = {
      audioWorklet: {
        addModule: vi.fn(async () => {}),
      },
      close: vi.fn(async () => {}),
      createGain: vi.fn(() => gain),
      createMediaStreamSource: vi.fn(() => mediaStreamSource),
      destination: {},
      sampleRate: 48_000,
    };
    class FakeAudioContext {
      audioWorklet = audioContext.audioWorklet;
      close = audioContext.close;
      createGain = audioContext.createGain;
      createMediaStreamSource = audioContext.createMediaStreamSource;
      destination = audioContext.destination;
      sampleRate = audioContext.sampleRate;
    }
    class FakeAudioWorkletNode {
      readonly connect = vi.fn();
      readonly disconnect = vi.fn();
      readonly port = {
        onmessage: null as ((event: MessageEvent<Uint8Array | { type: 'flushed' }>) => void) | null,
        postMessage: vi.fn(() => {
          this.port.onmessage?.({ data: { type: 'flushed' } } as MessageEvent<{
            type: 'flushed';
          }>);
        }),
      };

      constructor() {
        workletMessageHandler = (event) => this.port.onmessage?.(event);
      }
    }
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
        this.onstop?.();
      }
    }

    const pcmChunks: Uint8Array[] = [];
    const adapter = createBrowserMediaRecorderAdapter({
      AudioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
      AudioWorkletNodeCtor: FakeAudioWorkletNode as unknown as typeof AudioWorkletNode,
      MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
      mediaDevices,
      pcmChunkDurationMs: 1,
      pcmWorkletUrl: '/assets/reo-recording-pcm-worklet.js',
    });
    const controller = await adapter.start({
      onChunk: () => {},
      onError: () => {},
      onPcmChunk: (chunk) => pcmChunks.push(chunk),
      onStop: () => {},
    });

    expect(audioContext.audioWorklet.addModule).toHaveBeenCalledWith(
      '/assets/reo-recording-pcm-worklet.js'
    );
    expect(mediaStreamSource.connect).toHaveBeenCalledTimes(1);
    expect(workletMessageHandler).not.toBeNull();
    const emitWorkletMessage = workletMessageHandler as unknown as (
      event: MessageEvent<Uint8Array>
    ) => void;

    emitWorkletMessage({
      data: new Uint8Array(32).fill(0x40),
    } as MessageEvent<Uint8Array>);

    expect(pcmChunks).toHaveLength(1);
    expect(pcmChunks[0]).toHaveLength(32);
    expect([...pcmChunks[0]!.subarray(0, 4)]).toEqual([0x40, 0x40, 0x40, 0x40]);

    await controller.stop();
    expect(audioContext.close).toHaveBeenCalledTimes(1);
  });

  it('suspends PCM delivery while recording is paused and resumes it afterwards', async () => {
    let workletMessageHandler: ((event: MessageEvent<Uint8Array>) => void) | null = null;
    const track = { enabled: true, stop: vi.fn() };
    const stream = {
      getAudioTracks: vi.fn(() => [track]),
      getTracks: vi.fn(() => [track]),
    } as unknown as MediaStream;
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };
    const audioContext = {
      audioWorklet: {
        addModule: vi.fn(async () => {}),
      },
      close: vi.fn(async () => {}),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1 },
      })),
      createMediaStreamSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      destination: {},
      resume: vi.fn(async () => {}),
      sampleRate: 48_000,
      suspend: vi.fn(async () => {}),
    };
    class FakeAudioContext {
      audioWorklet = audioContext.audioWorklet;
      close = audioContext.close;
      createGain = audioContext.createGain;
      createMediaStreamSource = audioContext.createMediaStreamSource;
      destination = audioContext.destination;
      resume = audioContext.resume;
      sampleRate = audioContext.sampleRate;
      suspend = audioContext.suspend;
    }
    class FakeAudioWorkletNode {
      readonly connect = vi.fn();
      readonly disconnect = vi.fn();
      readonly port = {
        onmessage: null as ((event: MessageEvent<Uint8Array | { type: 'flushed' }>) => void) | null,
        postMessage: vi.fn(() => {
          this.port.onmessage?.({ data: { type: 'flushed' } } as MessageEvent<{
            type: 'flushed';
          }>);
        }),
      };

      constructor() {
        workletMessageHandler = (event) => this.port.onmessage?.(event);
      }
    }
    class FakeMediaRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;
      state: 'inactive' | 'paused' | 'recording' = 'recording';

      pause() {
        this.state = 'paused';
      }
      resume() {
        this.state = 'recording';
      }
      start() {}
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }

    const pcmChunks: Uint8Array[] = [];
    const adapter = createBrowserMediaRecorderAdapter({
      AudioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
      AudioWorkletNodeCtor: FakeAudioWorkletNode as unknown as typeof AudioWorkletNode,
      MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
      mediaDevices,
    });
    const controller = await adapter.start({
      onChunk: () => {},
      onError: () => {},
      onPcmChunk: (chunk) => pcmChunks.push(chunk),
      onStop: () => {},
    });
    const emitWorkletMessage = workletMessageHandler as unknown as (
      event: MessageEvent<Uint8Array>
    ) => void;

    emitWorkletMessage({ data: new Uint8Array([1]) } as MessageEvent<Uint8Array>);
    controller.pause();
    emitWorkletMessage({ data: new Uint8Array([2]) } as MessageEvent<Uint8Array>);
    controller.resume();
    emitWorkletMessage({ data: new Uint8Array([3]) } as MessageEvent<Uint8Array>);

    expect(audioContext.suspend).toHaveBeenCalledTimes(1);
    expect(audioContext.resume).toHaveBeenCalledTimes(1);
    expect(pcmChunks.map((chunk) => [...chunk])).toEqual([[1], [3]]);
    await controller.stop();
  });

  it('flushes a partial PCM chunk when recording stops', async () => {
    const track = { stop: vi.fn() };
    const stream = {
      getAudioTracks: vi.fn(() => [track]),
      getTracks: vi.fn(() => [track]),
    } as unknown as MediaStream;
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };
    const audioContext = {
      audioWorklet: {
        addModule: vi.fn(async () => {}),
      },
      close: vi.fn(async () => {}),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1 },
      })),
      createMediaStreamSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      destination: {},
      sampleRate: 48_000,
    };
    class FakeAudioContext {
      audioWorklet = audioContext.audioWorklet;
      close = audioContext.close;
      createGain = audioContext.createGain;
      createMediaStreamSource = audioContext.createMediaStreamSource;
      destination = audioContext.destination;
      sampleRate = audioContext.sampleRate;
    }
    class FakeAudioWorkletNode {
      readonly connect = vi.fn();
      readonly disconnect = vi.fn();
      readonly port = {
        onmessage: null as ((event: MessageEvent<Uint8Array | { type: 'flushed' }>) => void) | null,
        postMessage: vi.fn(() => {
          this.port.onmessage?.({
            data: new Uint8Array(32).fill(0xc0),
          } as MessageEvent<Uint8Array>);
          this.port.onmessage?.({ data: { type: 'flushed' } } as MessageEvent<{
            type: 'flushed';
          }>);
        }),
      };

      constructor() {}
    }
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
        this.onstop?.();
      }
    }

    const pcmChunks: Uint8Array[] = [];
    const adapter = createBrowserMediaRecorderAdapter({
      AudioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
      AudioWorkletNodeCtor: FakeAudioWorkletNode as unknown as typeof AudioWorkletNode,
      MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
      mediaDevices,
      pcmChunkDurationMs: 200,
      pcmWorkletUrl: '/assets/reo-recording-pcm-worklet.js',
    });
    const controller = await adapter.start({
      onChunk: () => {},
      onError: () => {},
      onPcmChunk: (chunk) => pcmChunks.push(chunk),
      onStop: () => {},
    });
    expect(pcmChunks).toEqual([]);
    await controller.stop();

    expect(pcmChunks).toHaveLength(1);
    expect(pcmChunks[0]).toHaveLength(32);
    expect([...pcmChunks[0]!.subarray(0, 4)]).toEqual([0xc0, 0xc0, 0xc0, 0xc0]);
  });

  it('cleans up microphone and PCM resources when recorder stop throws', async () => {
    const track = { stop: vi.fn() };
    const stream = {
      getAudioTracks: vi.fn(() => [track]),
      getTracks: vi.fn(() => [track]),
    } as unknown as MediaStream;
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };
    const audioContext = {
      audioWorklet: {
        addModule: vi.fn(async () => {}),
      },
      close: vi.fn(async () => {}),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1 },
      })),
      createMediaStreamSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      destination: {},
      sampleRate: 48_000,
    };
    class FakeAudioContext {
      audioWorklet = audioContext.audioWorklet;
      close = audioContext.close;
      createGain = audioContext.createGain;
      createMediaStreamSource = audioContext.createMediaStreamSource;
      destination = audioContext.destination;
      sampleRate = audioContext.sampleRate;
    }
    class FakeAudioWorkletNode {
      readonly connect = vi.fn();
      readonly disconnect = vi.fn();
      readonly port = {
        onmessage: null as ((event: MessageEvent<Uint8Array | { type: 'flushed' }>) => void) | null,
        postMessage: vi.fn(() => {
          this.port.onmessage?.({ data: { type: 'flushed' } } as MessageEvent<{
            type: 'flushed';
          }>);
        }),
      };
    }
    class FakeMediaRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;
      state = 'recording' as const;

      pause() {}
      resume() {}
      start() {}
      stop() {
        throw new Error('Recorder stop failed');
      }
    }

    const adapter = createBrowserMediaRecorderAdapter({
      AudioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
      AudioWorkletNodeCtor: FakeAudioWorkletNode as unknown as typeof AudioWorkletNode,
      MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
      mediaDevices,
      pcmWorkletUrl: '/assets/reo-recording-pcm-worklet.js',
    });
    const controller = await adapter.start({
      onChunk: () => {},
      onError: () => {},
      onPcmChunk: () => {},
      onStop: () => {},
    });

    await expect(controller.stop()).rejects.toThrow('Recorder stop failed');
    expect(audioContext.close).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('cleans up microphone and PCM resources when PCM flush fails', async () => {
    const track = { stop: vi.fn() };
    const stream = {
      getAudioTracks: vi.fn(() => [track]),
      getTracks: vi.fn(() => [track]),
    } as unknown as MediaStream;
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };
    const audioContext = {
      audioWorklet: {
        addModule: vi.fn(async () => {}),
      },
      close: vi.fn(async () => {}),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1 },
      })),
      createMediaStreamSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      destination: {},
      sampleRate: 48_000,
    };
    class FakeAudioContext {
      audioWorklet = audioContext.audioWorklet;
      close = audioContext.close;
      createGain = audioContext.createGain;
      createMediaStreamSource = audioContext.createMediaStreamSource;
      destination = audioContext.destination;
      sampleRate = audioContext.sampleRate;
    }
    class FakeAudioWorkletNode {
      readonly connect = vi.fn();
      readonly disconnect = vi.fn();
      readonly port = {
        onmessage: null as ((event: MessageEvent<Uint8Array | { type: 'flushed' }>) => void) | null,
        postMessage: vi.fn(() => {
          throw new Error('PCM flush failed');
        }),
      };
    }
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
        this.onstop?.();
      }
    }

    const adapter = createBrowserMediaRecorderAdapter({
      AudioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
      AudioWorkletNodeCtor: FakeAudioWorkletNode as unknown as typeof AudioWorkletNode,
      MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
      mediaDevices,
      pcmWorkletUrl: '/assets/reo-recording-pcm-worklet.js',
    });
    const controller = await adapter.start({
      onChunk: () => {},
      onError: () => {},
      onPcmChunk: () => {},
      onStop: () => {},
    });

    await expect(controller.stop()).resolves.toBeUndefined();
    expect(audioContext.close).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('continues resource cleanup when audio node disconnect throws', async () => {
    const track = { stop: vi.fn() };
    const stream = {
      getAudioTracks: vi.fn(() => [track]),
      getTracks: vi.fn(() => [track]),
    } as unknown as MediaStream;
    const mediaDevices = {
      getUserMedia: vi.fn(async () => stream),
    };
    const levelAudioContext = {
      close: vi.fn(async () => {}),
      createAnalyser: vi.fn(() => ({
        fftSize: 1024,
        getByteTimeDomainData: vi.fn(),
      })),
      createMediaStreamSource: vi.fn(() => ({
        connect: vi.fn(() => {
          throw new Error('level connect failed');
        }),
        disconnect: vi.fn(() => {
          throw new Error('level disconnect failed');
        }),
      })),
      destination: {},
      sampleRate: 48_000,
    };
    const pcmAudioContext = {
      audioWorklet: {
        addModule: vi.fn(async () => {}),
      },
      close: vi.fn(async () => {}),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(() => {
          throw new Error('gain disconnect failed');
        }),
        gain: { value: 1 },
      })),
      createMediaStreamSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(() => {
          throw new Error('pcm source disconnect failed');
        }),
      })),
      destination: {},
      sampleRate: 48_000,
    };
    class FakeAudioContext {
      static createCount = 0;

      readonly audioWorklet;
      readonly close;
      readonly createAnalyser;
      readonly createGain;
      readonly createMediaStreamSource;
      readonly destination;
      readonly sampleRate;

      constructor() {
        const context = FakeAudioContext.createCount === 0 ? levelAudioContext : pcmAudioContext;
        FakeAudioContext.createCount += 1;
        this.audioWorklet = 'audioWorklet' in context ? context.audioWorklet : undefined;
        this.close = context.close;
        this.createAnalyser =
          'createAnalyser' in context
            ? context.createAnalyser
            : () => levelAudioContext.createAnalyser();
        this.createGain =
          'createGain' in context ? context.createGain : () => pcmAudioContext.createGain();
        this.createMediaStreamSource = context.createMediaStreamSource;
        this.destination = context.destination;
        this.sampleRate = context.sampleRate;
      }
    }
    class FakeAudioWorkletNode {
      readonly connect = vi.fn();
      readonly disconnect = vi.fn(() => {
        throw new Error('worklet disconnect failed');
      });
      readonly port = {
        onmessage: null as ((event: MessageEvent<Uint8Array | { type: 'flushed' }>) => void) | null,
        postMessage: vi.fn(() => {
          this.port.onmessage?.({ data: { type: 'flushed' } } as MessageEvent<{
            type: 'flushed';
          }>);
        }),
      };
    }
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
        this.onstop?.();
      }
    }

    const adapter = createBrowserMediaRecorderAdapter({
      AudioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
      AudioWorkletNodeCtor: FakeAudioWorkletNode as unknown as typeof AudioWorkletNode,
      MediaRecorderCtor: FakeMediaRecorder as unknown as typeof MediaRecorder,
      mediaDevices,
      pcmWorkletUrl: '/assets/reo-recording-pcm-worklet.js',
    });
    const controller = await adapter.start({
      onChunk: () => {},
      onError: () => {},
      onLevel: () => {},
      onPcmChunk: () => {},
      onStop: () => {},
    });

    await expect(controller.stop()).resolves.toBeUndefined();
    expect(levelAudioContext.close).toHaveBeenCalledTimes(1);
    expect(pcmAudioContext.close).toHaveBeenCalledTimes(1);
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

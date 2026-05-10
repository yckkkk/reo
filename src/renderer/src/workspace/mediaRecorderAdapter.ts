import {
  RECORDING_TRANSCRIPTION_PCM_CHUNK_DURATION_MS,
  RECORDING_TRANSCRIPTION_PCM_SAMPLE_RATE_HZ,
} from '../../../workspace-contract/recording-audio';

export type RecordingMediaHandlers = {
  readonly onChunk: (chunk: Uint8Array) => void;
  readonly onError: (message: string) => void;
  readonly onLevel?: (samples: readonly number[]) => void;
  readonly onPcmChunk?: (chunk: Uint8Array) => void;
  readonly onStop: () => void;
};

export type RecordingMediaController = {
  readonly pause: () => void;
  readonly resume: () => void;
  readonly stop: () => Promise<void>;
};

export type RecordingMediaAdapter = {
  readonly start: (handlers: RecordingMediaHandlers) => Promise<RecordingMediaController>;
};

type AudioContextConstructor = new () => AudioContext;
type AudioWorkletNodeConstructor = new (
  context: BaseAudioContext,
  name: string,
  options?: AudioWorkletNodeOptions
) => AudioWorkletNode;

const DURABLE_AUDIO_CHUNK_DURATION_MS = 250;

function ignoreCleanupFailure(cleanup: () => void) {
  try {
    cleanup();
  } catch {
    return;
  }
}

async function ignoreAsyncCleanupFailure(cleanup: () => Promise<void>) {
  try {
    await cleanup();
  } catch {
    return;
  }
}

function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    ignoreCleanupFailure(() => {
      track.stop();
    });
  }
}

function setAudioTracksEnabled(stream: MediaStream, enabled: boolean) {
  for (const track of stream.getAudioTracks()) {
    track.enabled = enabled;
  }
}

function resolveAudioContextCtor(): AudioContextConstructor | null {
  return typeof AudioContext === 'undefined' ? null : AudioContext;
}

function resolveAudioWorkletNodeCtor(): AudioWorkletNodeConstructor | null {
  return typeof AudioWorkletNode === 'undefined' ? null : AudioWorkletNode;
}

function resolvePcmWorkletUrl() {
  return new URL('./recordingPcmWorklet.js', import.meta.url).toString();
}

export function createBrowserMediaRecorderAdapter({
  AudioContextCtor = resolveAudioContextCtor(),
  AudioWorkletNodeCtor = resolveAudioWorkletNodeCtor(),
  MediaRecorderCtor = MediaRecorder,
  mediaDevices = navigator.mediaDevices,
  pcmChunkDurationMs = RECORDING_TRANSCRIPTION_PCM_CHUNK_DURATION_MS,
  pcmWorkletUrl = resolvePcmWorkletUrl(),
}: {
  readonly AudioContextCtor?: AudioContextConstructor | null;
  readonly AudioWorkletNodeCtor?: AudioWorkletNodeConstructor | null;
  readonly MediaRecorderCtor?: typeof MediaRecorder;
  readonly mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
  readonly pcmChunkDurationMs?: number;
  readonly pcmWorkletUrl?: string;
} = {}): RecordingMediaAdapter {
  return {
    async start({ onChunk, onError, onLevel, onPcmChunk, onStop }) {
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorderCtor(stream, { mimeType: 'audio/webm' });
      } catch (setupError) {
        stopTracks(stream);
        throw setupError;
      }
      const pendingChunks = new Set<Promise<void>>();
      let resolveStopped: () => void = () => {};
      const stopped = new Promise<void>((resolve) => {
        resolveStopped = resolve;
      });
      let recordingFailure: Error | null = null;
      let stopPromise: Promise<void> | null = null;
      let animationFrame: number | null = null;
      let audioContext: AudioContext | null = null;
      let audioSource: MediaStreamAudioSourceNode | null = null;
      let pcmAudioContext: AudioContext | null = null;
      let pcmAudioSource: MediaStreamAudioSourceNode | null = null;
      let pcmSilenceGain: GainNode | null = null;
      let pcmWorkletNode: AudioWorkletNode | null = null;
      let pcmPaused = false;

      function stopLevelPump() {
        if (animationFrame !== null) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
        const source = audioSource;
        audioSource = null;
        ignoreCleanupFailure(() => {
          source?.disconnect();
        });
        const context = audioContext;
        audioContext = null;
        if (context) {
          ignoreCleanupFailure(() => {
            void context.close().catch(() => {});
          });
        }
      }

      async function flushPcmWorklet() {
        const workletNode = pcmWorkletNode;
        if (!workletNode) {
          return;
        }
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          let timeout: number | null = null;
          const previousHandler = workletNode.port.onmessage;
          const restoreHandler = () => {
            if (timeout !== null) {
              window.clearTimeout(timeout);
              timeout = null;
            }
            workletNode.port.onmessage = previousHandler;
          };
          const resolveFlush = () => {
            if (settled) {
              return;
            }
            settled = true;
            restoreHandler();
            resolve();
          };
          const rejectFlush = (error: unknown) => {
            if (settled) {
              return;
            }
            settled = true;
            restoreHandler();
            reject(error);
          };
          timeout = window.setTimeout(resolveFlush, 100);
          workletNode.port.onmessage = (event: MessageEvent<unknown>) => {
            const data = event.data;
            if (data instanceof Uint8Array) {
              onPcmChunk?.(new Uint8Array(data));
              return;
            }
            if (data instanceof ArrayBuffer) {
              onPcmChunk?.(new Uint8Array(data));
              return;
            }
            if (
              typeof data === 'object' &&
              data !== null &&
              (data as { readonly type?: unknown }).type === 'flushed'
            ) {
              resolveFlush();
            }
          };
          try {
            workletNode.port.postMessage({ type: 'flush' });
          } catch (error) {
            rejectFlush(error);
          }
        });
      }

      async function stopRecorderResources() {
        await ignoreAsyncCleanupFailure(flushPcmWorklet);
        stopLevelPump();
        stopPcmPump();
        stopTracks(stream);
      }

      function stopPcmPump() {
        const workletNode = pcmWorkletNode;
        pcmWorkletNode = null;
        if (workletNode) {
          workletNode.port.onmessage = null;
          ignoreCleanupFailure(() => {
            workletNode.disconnect();
          });
        }
        const silenceGain = pcmSilenceGain;
        pcmSilenceGain = null;
        ignoreCleanupFailure(() => {
          silenceGain?.disconnect();
        });
        const source = pcmAudioSource;
        pcmAudioSource = null;
        ignoreCleanupFailure(() => {
          source?.disconnect();
        });
        const context = pcmAudioContext;
        pcmAudioContext = null;
        if (context) {
          ignoreCleanupFailure(() => {
            void context.close().catch(() => {});
          });
        }
      }

      async function startPcmPump() {
        if (!onPcmChunk || !AudioContextCtor || !AudioWorkletNodeCtor) {
          return;
        }
        try {
          pcmAudioContext = new AudioContextCtor();
          if (!pcmAudioContext.audioWorklet) {
            stopPcmPump();
            return;
          }
          await pcmAudioContext.audioWorklet.addModule(pcmWorkletUrl);
          pcmAudioSource = pcmAudioContext.createMediaStreamSource(stream);
          pcmWorkletNode = new AudioWorkletNodeCtor(pcmAudioContext, 'reo-pcm-capture', {
            processorOptions: {
              chunkDurationMs: pcmChunkDurationMs,
              targetSampleRateHz: RECORDING_TRANSCRIPTION_PCM_SAMPLE_RATE_HZ,
            },
          });
          pcmSilenceGain = pcmAudioContext.createGain();
          pcmSilenceGain.gain.value = 0;
          pcmWorkletNode.port.onmessage = (event: MessageEvent<unknown>) => {
            if (pcmPaused) {
              return;
            }
            const data = event.data;
            if (data instanceof Uint8Array) {
              onPcmChunk(new Uint8Array(data));
            } else if (data instanceof ArrayBuffer) {
              onPcmChunk(new Uint8Array(data));
            }
          };
          pcmAudioSource.connect(pcmWorkletNode);
          pcmWorkletNode.connect(pcmSilenceGain);
          pcmSilenceGain.connect(pcmAudioContext.destination);
        } catch {
          stopPcmPump();
        }
      }

      function startLevelPump() {
        if (!onLevel || !AudioContextCtor) {
          return;
        }
        if (audioContext) {
          return;
        }
        const emitLevel: (samples: readonly number[]) => void = onLevel;

        try {
          audioContext = new AudioContextCtor();
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 1024;
          audioSource = audioContext.createMediaStreamSource(stream);
          audioSource.connect(analyser);
          const data = new Uint8Array(analyser.fftSize);
          const bucketCount = 64;

          function pumpLevel() {
            analyser.getByteTimeDomainData(data);
            const bucketSize = Math.max(1, Math.floor(data.length / bucketCount));
            const samples: number[] = [];
            for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
              let sum = 0;
              const start = bucketIndex * bucketSize;
              const end = Math.min(data.length, start + bucketSize);
              for (let index = start; index < end; index += 1) {
                const centered = (data[index] ?? 128) - 128;
                sum += centered * centered;
              }
              const rms = Math.sqrt(sum / Math.max(1, end - start)) / 128;
              samples.push(Math.min(1, Math.max(0.06, rms * 3.4)));
            }
            emitLevel(samples);
            animationFrame = requestAnimationFrame(pumpLevel);
          }

          pumpLevel();
        } catch {
          stopLevelPump();
        }
      }

      function failRecording() {
        recordingFailure ??= new Error('麦克风录音失败。');
        onError(recordingFailure.message);
        return recordingFailure;
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) {
          return;
        }
        const pendingChunk = event.data
          .arrayBuffer()
          .then((buffer) => {
            onChunk(new Uint8Array(buffer));
          })
          .catch(() => {
            throw failRecording();
          })
          .finally(() => {
            pendingChunks.delete(pendingChunk);
          });
        pendingChunks.add(pendingChunk);
        void pendingChunk.catch(() => {});
      };
      recorder.onerror = () => {
        void failRecording();
      };
      recorder.onstop = () => {
        onStop();
        resolveStopped();
      };
      try {
        recorder.start(DURABLE_AUDIO_CHUNK_DURATION_MS);
      } catch (setupError) {
        stopLevelPump();
        stopTracks(stream);
        throw setupError;
      }
      startLevelPump();
      await startPcmPump();

      return {
        pause: () => {
          if (recorder.state === 'recording') {
            recorder.pause();
          }
          pcmPaused = true;
          stopLevelPump();
          if (pcmAudioContext && typeof pcmAudioContext.suspend === 'function') {
            void pcmAudioContext.suspend().catch(() => {});
          }
          setAudioTracksEnabled(stream, false);
        },
        resume: () => {
          setAudioTracksEnabled(stream, true);
          pcmPaused = false;
          if (pcmAudioContext && typeof pcmAudioContext.resume === 'function') {
            void pcmAudioContext.resume().catch(() => {});
          }
          startLevelPump();
          if (recorder.state === 'paused') {
            recorder.resume();
          }
        },
        stop: () => {
          stopPromise ??= (async () => {
            const waitForStop = recorder.state === 'inactive' ? Promise.resolve() : stopped;
            let stopError: unknown = null;
            if (recorder.state !== 'inactive') {
              try {
                recorder.stop();
              } catch (error) {
                stopError = error;
              }
            }
            let primaryError: unknown = null;
            try {
              if (!stopError) {
                await waitForStop;
              }
              await Promise.all([...pendingChunks]);
              if (recordingFailure) {
                throw recordingFailure;
              }
              if (stopError) {
                throw stopError;
              }
            } catch (error) {
              primaryError = error;
            } finally {
              await stopRecorderResources();
            }
            if (primaryError) {
              throw primaryError;
            }
          })();
          return stopPromise;
        },
      };
    },
  };
}

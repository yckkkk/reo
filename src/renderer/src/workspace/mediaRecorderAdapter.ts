export type RecordingMediaHandlers = {
  readonly onChunk: (chunk: Uint8Array) => void;
  readonly onError: (message: string) => void;
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

function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

export function createBrowserMediaRecorderAdapter({
  MediaRecorderCtor = MediaRecorder,
  mediaDevices = navigator.mediaDevices,
}: {
  readonly MediaRecorderCtor?: typeof MediaRecorder;
  readonly mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
} = {}): RecordingMediaAdapter {
  return {
    async start({ onChunk, onError, onStop }) {
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

      function failRecording() {
        recordingFailure ??= new Error('Microphone recording failed');
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
        recorder.start(1000);
      } catch (setupError) {
        stopTracks(stream);
        throw setupError;
      }

      return {
        pause: () => recorder.pause(),
        resume: () => recorder.resume(),
        stop: () => {
          stopPromise ??= (async () => {
            const waitForStop = recorder.state === 'inactive' ? Promise.resolve() : stopped;
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
            try {
              await waitForStop;
              await Promise.all([...pendingChunks]);
              if (recordingFailure) {
                throw recordingFailure;
              }
            } finally {
              stopTracks(stream);
            }
          })();
          return stopPromise;
        },
      };
    },
  };
}

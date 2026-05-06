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
      const recorder = new MediaRecorderCtor(stream, { mimeType: 'audio/webm' });

      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) {
          return;
        }
        void event.data.arrayBuffer().then((buffer) => {
          onChunk(new Uint8Array(buffer));
        });
      };
      recorder.onerror = () => onError('Microphone recording failed');
      recorder.onstop = () => onStop();
      recorder.start(1000);

      return {
        pause: () => recorder.pause(),
        resume: () => recorder.resume(),
        stop: async () => {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
          for (const track of stream.getTracks()) {
            track.stop();
          }
        },
      };
    },
  };
}

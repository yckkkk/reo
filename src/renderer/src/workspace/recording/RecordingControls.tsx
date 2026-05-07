import { Button } from '@/components/ui/button';
import { VoiceButton } from '@/components/ui/voice-button';
import type { RecordingState } from '../recordingMachine';

type RecordingControlsProps = {
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onStart: () => void;
  readonly onStop: () => void;
  readonly state: RecordingState;
};

export function RecordingControls({
  onPause,
  onResume,
  onStart,
  onStop,
  state,
}: RecordingControlsProps) {
  if (state.status === 'idle') {
    return <VoiceButton label="Start recording" onClick={onStart} state="idle" />;
  }

  if (state.status === 'failed') {
    return <VoiceButton label="Try again" onClick={onStart} />;
  }

  if (state.status === 'acquiring-permission') {
    return <VoiceButton disabled label="Preparing microphone" state="processing" />;
  }

  if (state.status === 'finalizing') {
    return <VoiceButton disabled label="Saving recording" state="processing" />;
  }

  return (
    <div className="flex flex-wrap gap-12">
      {state.status === 'recording' ? (
        <Button type="button" variant="secondary" onClick={onPause}>
          Pause recording
        </Button>
      ) : null}
      {state.status === 'paused' ? (
        <Button type="button" variant="secondary" onClick={onResume}>
          Resume recording
        </Button>
      ) : null}
      {state.status === 'recording' || state.status === 'paused' ? (
        <VoiceButton label="Stop recording" onClick={onStop} state="recording" />
      ) : null}
    </div>
  );
}

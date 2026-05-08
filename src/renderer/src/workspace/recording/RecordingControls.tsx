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
    return <VoiceButton label="开始录音" onClick={onStart} state="idle" />;
  }

  if (state.status === 'failed') {
    return <VoiceButton label="重试" onClick={onStart} />;
  }

  if (state.status === 'acquiring-permission') {
    return <VoiceButton disabled label="正在准备麦克风" state="processing" />;
  }

  if (state.status === 'finalizing') {
    return <VoiceButton disabled label="正在保存录音" state="processing" />;
  }

  return (
    <div className="flex flex-wrap gap-12">
      {state.status === 'recording' ? (
        <Button type="button" variant="secondary" onClick={onPause}>
          暂停录音
        </Button>
      ) : null}
      {state.status === 'paused' ? (
        <Button type="button" variant="secondary" onClick={onResume}>
          继续录音
        </Button>
      ) : null}
      {state.status === 'recording' || state.status === 'paused' ? (
        <VoiceButton label="停止录音" onClick={onStop} state="recording" />
      ) : null}
    </div>
  );
}

import { AudioPlayer } from '@/components/ui/audio-player';
import { Button } from '@/components/ui/button';
import { memo } from 'react';

type RecordingPlaybackProps = {
  readonly onLoad: () => void;
  readonly playbackUrl: string | null;
};

function RecordingPlaybackComponent({ onLoad, playbackUrl }: RecordingPlaybackProps) {
  return (
    <div className="flex flex-col gap-12">
      {playbackUrl ? (
        <AudioPlayer description="已保存为本地录音文件。" src={playbackUrl} title="本地录音" />
      ) : (
        <Button type="button" variant="secondary" onClick={onLoad}>
          加载录音
        </Button>
      )}
    </div>
  );
}

export const RecordingPlayback = memo(RecordingPlaybackComponent);

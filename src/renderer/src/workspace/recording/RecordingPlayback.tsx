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
        <AudioPlayer
          description="Stored as a local recording file."
          src={playbackUrl}
          title="Local recording"
        />
      ) : (
        <Button type="button" variant="secondary" onClick={onLoad}>
          Load recording
        </Button>
      )}
    </div>
  );
}

export const RecordingPlayback = memo(RecordingPlaybackComponent);

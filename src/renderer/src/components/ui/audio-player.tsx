import * as SliderPrimitive from '@radix-ui/react-slider';
import { Pause, Play } from 'lucide-react';
import { useRef, useState, type SyntheticEvent } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export type AudioPlayerProps = {
  readonly className?: string;
  readonly description: string;
  readonly src: string;
  readonly title: string;
};

export function AudioPlayer({ className, description, src, title }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const PlayIcon = playing ? Pause : Play;
  const sliderMax = duration > 0 ? duration : 1;

  function handleLoadedMetadata(event: SyntheticEvent<HTMLAudioElement>) {
    const nextDuration = event.currentTarget.duration;
    setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
  }

  function handlePositionChange(value: number[]) {
    const nextTime = value[0];
    if (nextTime === undefined || !audioRef.current) {
      return;
    }
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function handlePlayPause() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }

  function handleTimeUpdate(event: SyntheticEvent<HTMLAudioElement>) {
    const nextTime = event.currentTarget.currentTime;
    setCurrentTime((current) => {
      const currentBucket = Math.floor(current / 0.25);
      const nextBucket = Math.floor(nextTime / 0.25);
      return currentBucket === nextBucket ? current : nextTime;
    });
  }

  return (
    <section
      aria-label={title}
      className={cn('rounded-cards border border-chalk bg-card-white px-16 py-16', className)}
    >
      <div className="mb-12 flex flex-col gap-4">
        <h3 className="text-body-lg font-medium leading-body-lg text-obsidian">{title}</h3>
        <p className="text-body leading-body text-gravel">{description}</p>
      </div>
      <div className="flex items-center gap-12">
        <Button
          aria-label={playing ? 'Pause local recording' : 'Play local recording'}
          size="iconMedium"
          type="button"
          variant="secondary"
          onClick={handlePlayPause}
        >
          <PlayIcon className="size-16" aria-hidden="true" />
        </Button>
        <span className="w-40 text-caption leading-caption text-gravel tabular-nums">
          {formatTime(currentTime)}
        </span>
        <SliderPrimitive.Root
          className="relative flex h-32 flex-1 touch-none items-center"
          disabled={duration === 0}
          max={sliderMax}
          step={0.25}
          value={[currentTime]}
          onValueChange={handlePositionChange}
        >
          <SliderPrimitive.Track className="relative h-4 grow overflow-hidden rounded-full bg-chalk">
            <SliderPrimitive.Range className="absolute h-full bg-signal-blue" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            aria-label="Recording position"
            className="block size-12 rounded-full border border-chalk bg-card-white shadow-subtle outline-none focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-eggshell"
          />
        </SliderPrimitive.Root>
        <span className="w-40 text-right text-caption leading-caption text-gravel tabular-nums">
          {formatTime(duration)}
        </span>
      </div>
      <audio
        aria-hidden="true"
        className="sr-only"
        data-testid="audio-player-audio"
        preload="metadata"
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={handleLoadedMetadata}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onTimeUpdate={handleTimeUpdate}
      />
    </section>
  );
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

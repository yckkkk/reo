import { LoaderCircle, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MediaPlaybackPlayState } from './useMediaPlaybackController';

export type MediaPlaybackControlProps = {
  readonly playable: boolean;
  readonly hovered: boolean;
  readonly playState: MediaPlaybackPlayState;
  readonly label: string;
  readonly onToggle: () => void;
  readonly className?: string;
};

export function MediaPlaybackControl({
  className,
  hovered,
  label,
  onToggle,
  playable,
  playState,
}: MediaPlaybackControlProps) {
  if (!playable) {
    return null;
  }

  const visible = hovered || playState === 'playing';
  if (!visible) {
    return null;
  }

  const isPlaying = playState === 'playing';
  const isLoading = playState === 'loading';
  const actionLabel = isPlaying ? '暂停' : '播放';
  const accessibleLabel = label ? `${actionLabel} ${label}` : actionLabel;

  return (
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center rounded-[inherit] bg-transparent text-foreground transition-opacity duration-150 ease-out',
        className
      )}
      data-slot="media-playback-control"
    >
      <button
        type="button"
        aria-label={accessibleLabel}
        disabled={isLoading}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className="reo-squircle inline-flex size-28 items-center justify-center rounded-full bg-card/95 text-card-foreground shadow-none outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:bg-muted disabled:text-muted-foreground"
      >
        {isLoading ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-16 animate-spin"
            data-testid="media-playback-spinner"
          />
        ) : isPlaying ? (
          <Pause aria-hidden="true" className="size-16" />
        ) : (
          <Play aria-hidden="true" className="size-16 translate-x-[1px]" />
        )}
      </button>
    </div>
  );
}

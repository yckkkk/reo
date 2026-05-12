import { Check, Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RecordingState } from '../recordingMachine';

type RecordingControlsProps = {
  readonly cursorAtEnd?: boolean;
  readonly isPlaying?: boolean;
  readonly onPause: () => void;
  readonly onPlayPause?: () => void;
  readonly onResume: () => void;
  readonly onSeekBackward?: () => void;
  readonly onSeekForward?: () => void;
  readonly onStart: () => void;
  readonly onStop: () => void;
  readonly state: RecordingState;
};

function LocatorIconButton({
  children,
  className,
  label,
  ...props
}: Omit<ComponentProps<typeof Button>, 'children' | 'size' | 'variant'> & {
  readonly children: ReactNode;
  readonly label: string;
}) {
  return (
    <Button
      aria-label={label}
      className={cn(
        'size-40 rounded-md !bg-transparent p-0 text-muted-foreground shadow-none hover:!bg-accent hover:text-foreground disabled:!bg-transparent disabled:!text-muted-foreground disabled:opacity-45',
        className
      )}
      size="iconMedium"
      type="button"
      variant="ghostIcon"
      {...props}
    >
      {children}
    </Button>
  );
}

export function RecordingControls({
  cursorAtEnd = true,
  isPlaying = false,
  onPause,
  onPlayPause,
  onResume,
  onSeekBackward,
  onSeekForward,
  onStart,
  onStop,
  state,
}: RecordingControlsProps) {
  if (
    state.status === 'idle' ||
    state.status === 'failed' ||
    state.status === 'acquiring-permission'
  ) {
    const disabled = state.status === 'acquiring-permission';
    const label =
      state.status === 'failed'
        ? '重试'
        : state.status === 'acquiring-permission'
          ? '正在准备麦克风'
          : '开始录音';

    return (
      <Button
        aria-label={label}
        className="size-[88px] rounded-full bg-brand-ember p-0 text-primary-foreground shadow-none hover:bg-brand-ember disabled:bg-muted"
        disabled={disabled}
        onClick={onStart}
        size="iconLarge"
        type="button"
      >
        <span className="sr-only">{label}</span>
      </Button>
    );
  }

  if (state.status === 'finalizing' || state.status === 'replacing') {
    const label = state.status === 'replacing' ? '正在替换录音' : '正在保存录音';
    return (
      <Button
        aria-label={label}
        className="size-[88px] rounded-full bg-muted p-0 text-muted-foreground"
        disabled
        size="iconLarge"
        type="button"
      >
        <span className="sr-only">{label}</span>
      </Button>
    );
  }

  const isPaused = state.status === 'paused';
  const locatorDisabled = !isPaused;
  const primaryLabel = isPaused ? (cursorAtEnd ? '继续录音' : '替换录音') : '暂停录音';
  const playbackLabel = isPlaying ? '暂停回放' : '播放录音';

  return (
    <div
      className="grid w-full grid-cols-[minmax(96px,1fr)_auto_minmax(96px,1fr)] items-center gap-16"
      data-vaul-no-drag
    >
      <div className="flex justify-start" data-testid="recording-left-control-slot">
        {isPaused ? (
          <Button
            aria-label={primaryLabel}
            className={cn(
              'h-40 w-[108px] rounded-lg px-10 text-ui-md shadow-none',
              cursorAtEnd
                ? 'bg-card text-brand-ember hover:bg-secondary hover:text-foreground'
                : 'bg-card text-brand-ember hover:bg-secondary hover:text-foreground'
            )}
            onClick={onResume}
            type="button"
            variant="secondary"
          >
            {cursorAtEnd ? '继续' : '替换'}
          </Button>
        ) : (
          <Button
            aria-label="暂停录音"
            className="h-40 w-[108px] rounded-lg bg-card p-0 text-brand-ember shadow-none hover:bg-secondary hover:text-foreground"
            onClick={onPause}
            type="button"
            variant="secondary"
          >
            <Pause aria-hidden="true" className="size-[22px] fill-current stroke-[3]" />
            <span className="sr-only">暂停录音</span>
          </Button>
        )}
      </div>

      <div
        aria-label="播放定位控件"
        className={cn(
          'flex items-center justify-center gap-8 px-0 py-0',
          locatorDisabled ? 'opacity-35' : 'opacity-100'
        )}
        data-testid="recording-locator-control-slot"
        role="group"
      >
        <LocatorIconButton disabled={locatorDisabled} label="后退 15 秒" onClick={onSeekBackward}>
          <RotateCcw aria-hidden="true" className="size-[18px]" />
          <span className="text-caption font-bold leading-none">15</span>
        </LocatorIconButton>
        <LocatorIconButton
          className="text-muted-foreground disabled:!text-muted-foreground"
          disabled={locatorDisabled}
          label={playbackLabel}
          onClick={onPlayPause}
        >
          {isPlaying ? (
            <Pause aria-hidden="true" className="size-[18px] fill-current stroke-[3]" />
          ) : (
            <Play aria-hidden="true" className="ml-2 size-24 fill-current stroke-[2]" />
          )}
        </LocatorIconButton>
        <LocatorIconButton disabled={locatorDisabled} label="前进 15 秒" onClick={onSeekForward}>
          <RotateCw aria-hidden="true" className="size-[18px]" />
          <span className="text-caption font-bold leading-none">15</span>
        </LocatorIconButton>
      </div>

      <div className="flex justify-end" data-testid="recording-right-control-slot">
        {state.status === 'recording' || state.status === 'paused' ? (
          <Button
            aria-label="停止录音"
            className="rounded-lg bg-card px-8 text-foreground shadow-none hover:bg-secondary hover:text-foreground"
            onClick={onStop}
            type="button"
            variant="secondary"
          >
            <Check aria-hidden="true" className="size-16" />
            完成
          </Button>
        ) : null}
      </div>
    </div>
  );
}

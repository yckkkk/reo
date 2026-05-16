import { Check, Pause, Play } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RecordingState } from '../recordingMachine';

export type PausedRecordingPrimaryAction = 'resume' | 'replace' | 'none';

const PAUSED_PRIMARY_ACTION_CONTENT: Record<
  PausedRecordingPrimaryAction,
  { readonly label: string; readonly text: string } | null
> = {
  resume: { label: '继续录音', text: '继续' },
  replace: { label: '替换录音', text: '替换' },
  none: null,
};

type RecordingControlsProps = {
  readonly isPlaying?: boolean;
  readonly playbackDisabled?: boolean;
  readonly onPause: () => void;
  readonly onPlayPause?: () => void;
  readonly onPrimaryPausedAction: () => void;
  readonly pausedPrimaryAction?: PausedRecordingPrimaryAction;
  readonly onStart: () => void;
  readonly onStop: () => void;
  readonly state: RecordingState;
};

function PlaybackIconButton({
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
  isPlaying = false,
  playbackDisabled = false,
  onPause,
  onPlayPause,
  onPrimaryPausedAction,
  pausedPrimaryAction = 'none',
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
        className="size-[88px] rounded-full bg-brand-ember p-0 text-destructive-foreground shadow-none hover:bg-brand-ember disabled:bg-muted"
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
  const playbackControlDisabled = locatorDisabled || playbackDisabled;
  const pausedPrimaryContent = PAUSED_PRIMARY_ACTION_CONTENT[pausedPrimaryAction];
  const playbackLabel = isPlaying ? '暂停回放' : '播放录音';

  return (
    <div
      className="grid w-full grid-cols-[minmax(96px,1fr)_auto_minmax(96px,1fr)] items-center gap-16"
      data-vaul-no-drag
    >
      <div className="flex justify-start" data-testid="recording-left-control-slot">
        {isPaused && pausedPrimaryContent ? (
          <Button
            aria-label={pausedPrimaryContent.label}
            className="h-40 w-[108px] rounded-lg bg-card px-10 text-ui-md text-brand-ember shadow-none hover:bg-secondary hover:text-foreground"
            onClick={onPrimaryPausedAction}
            type="button"
            variant="secondary"
          >
            {pausedPrimaryContent.text}
          </Button>
        ) : isPaused ? null : (
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
        <PlaybackIconButton
          className="text-muted-foreground disabled:!text-muted-foreground"
          disabled={playbackControlDisabled}
          label={playbackLabel}
          onClick={onPlayPause}
        >
          {isPlaying ? (
            <Pause aria-hidden="true" className="size-[18px] fill-current stroke-[3]" />
          ) : (
            <Play aria-hidden="true" className="size-24 fill-current stroke-[2]" />
          )}
        </PlaybackIconButton>
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

import type { KeyboardEvent, PointerEvent } from 'react';
import { Waveform } from '@/components/ui/waveform';
import type { RecordingState } from '../recordingMachine';

const READY_WAVEFORM_DATA = Array.from({ length: 96 }, () => 0.08);
const LOW_ACTIVITY_WAVEFORM_DATA = Array.from({ length: 160 }, () => 0.06);

type RecordingWaveformProps = {
  readonly cursorTimeMs: number;
  readonly onCursorChange?: (cursorTimeMs: number) => void;
  readonly samples: readonly number[];
  readonly state: RecordingState;
  readonly totalDurationMs: number;
};

function waveformLabel(state: RecordingState) {
  if (state.status === 'recording' || state.status === 'finalizing') {
    return '实时录音波形';
  }
  if (state.status === 'paused' || state.status === 'replacing') {
    return '暂停录音波形';
  }
  return '静态录音波形';
}

export function RecordingWaveform({
  cursorTimeMs,
  onCursorChange,
  samples,
  state,
  totalDurationMs,
}: RecordingWaveformProps) {
  const isReadyState =
    state.status === 'idle' || state.status === 'acquiring-permission' || state.status === 'failed';
  const waveformData = isReadyState
    ? READY_WAVEFORM_DATA
    : samples.length > 0
      ? samples
      : LOW_ACTIVITY_WAVEFORM_DATA;
  const playheadProgress =
    (state.status === 'paused' || state.status === 'replacing') && totalDurationMs > 0
      ? cursorTimeMs / totalDurationMs
      : null;
  const canSeek = state.status === 'paused' && totalDurationMs > 0 && Boolean(onCursorChange);

  function updateCursorFromPointer(event: PointerEvent<HTMLDivElement>) {
    if (!canSeek || !onCursorChange) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const progress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onCursorChange(progress * totalDurationMs);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!canSeek) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    updateCursorFromPointer(event);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!canSeek || event.buttons !== 1) {
      return;
    }
    updateCursorFromPointer(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!canSeek || !onCursorChange) {
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onCursorChange(Math.max(0, cursorTimeMs - 15_000));
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onCursorChange(Math.min(totalDurationMs, cursorTimeMs + 15_000));
    }
  }

  return (
    <Waveform
      active={state.status === 'recording'}
      barGap={isReadyState ? 8 : 3}
      barRadius={2}
      barWidth={isReadyState ? 3 : 3}
      className="mx-auto w-full max-w-[min(72vw,1120px)]"
      data={waveformData}
      data-vaul-no-drag
      height={state.status === 'paused' ? 112 : 72}
      label={waveformLabel(state)}
      mode={isReadyState ? 'dots' : 'bars'}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      playheadProgress={playheadProgress}
      tone={isReadyState ? 'muted' : 'neutral'}
      {...(canSeek
        ? {
            'aria-valuemax': Math.round(totalDurationMs),
            'aria-valuemin': 0,
            'aria-valuenow': Math.round(cursorTimeMs),
            role: 'slider' as const,
            tabIndex: 0,
          }
        : {})}
    />
  );
}

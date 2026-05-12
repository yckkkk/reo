import type { KeyboardEvent, PointerEvent } from 'react';
import { useRef } from 'react';
import { Waveform } from '@/components/ui/waveform';
import type { RecordingState } from '../recordingMachine';

const READY_WAVEFORM_DATA = Array.from({ length: 160 }, (_, index) => {
  if (index > 54 && index < 63) {
    return 0.18;
  }
  return 0.06;
});
const LOW_ACTIVITY_WAVEFORM_DATA = Array.from({ length: 160 }, () => 0.06);
const RECORDING_WAVEFORM_BAR_RADIUS = 4;
const RECORDING_WAVEFORM_BAR_WIDTH = 4;
const RECORDING_WAVEFORM_HEIGHT = 88;
const RECORDING_WAVEFORM_KEY_STEP_MS = 1_000;

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
  const waveformProgress =
    (state.status === 'paused' || state.status === 'replacing') && totalDurationMs > 0
      ? cursorTimeMs / totalDurationMs
      : null;
  const canSeek = state.status === 'paused' && totalDurationMs > 0 && Boolean(onCursorChange);
  const pointerScrubbingRef = useRef(false);

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
    pointerScrubbingRef.current = true;
    updateCursorFromPointer(event);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!canSeek || !pointerScrubbingRef.current) {
      return;
    }
    updateCursorFromPointer(event);
  }

  function endPointerScrub() {
    pointerScrubbingRef.current = false;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!canSeek || !onCursorChange) {
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onCursorChange(Math.max(0, cursorTimeMs - RECORDING_WAVEFORM_KEY_STEP_MS));
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onCursorChange(Math.min(totalDurationMs, cursorTimeMs + RECORDING_WAVEFORM_KEY_STEP_MS));
    }
  }

  return (
    <Waveform
      active={state.status === 'recording'}
      barRadius={RECORDING_WAVEFORM_BAR_RADIUS}
      barWidth={RECORDING_WAVEFORM_BAR_WIDTH}
      className="mx-auto w-full max-w-[min(72vw,1120px)]"
      data={waveformData}
      data-vaul-no-drag
      height={RECORDING_WAVEFORM_HEIGHT}
      label={waveformLabel(state)}
      mode="bars"
      onKeyDown={handleKeyDown}
      onPointerCancel={endPointerScrub}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointerScrub}
      progress={waveformProgress}
      tone="neutral"
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

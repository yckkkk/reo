import { useCallback, useEffect, useRef, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type WaveformProps = ComponentProps<'div'> & {
  readonly active?: boolean;
  readonly barGap?: number;
  readonly barRadius?: number;
  readonly barWidth?: number;
  readonly data: readonly number[];
  readonly decorative?: boolean;
  readonly height?: number;
  readonly label?: string;
  readonly mode?: 'bars' | 'dots';
  readonly playheadProgress?: number | null;
  readonly tone?: 'muted' | 'neutral' | 'voice';
};

type DrawWaveformState = {
  readonly active: boolean;
  readonly barGap: number;
  readonly barRadius: number;
  readonly barWidth: number;
  readonly data: readonly number[];
  readonly mode: NonNullable<WaveformProps['mode']>;
  readonly tone: NonNullable<WaveformProps['tone']>;
};

export function Waveform({
  active = false,
  barGap = 4,
  barRadius = 2,
  barWidth = 4,
  className,
  data,
  decorative = false,
  height = 64,
  label = '音频波形',
  mode = 'bars',
  playheadProgress = null,
  tone = 'voice',
  ...props
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawStateRef = useRef<DrawWaveformState>({
    active,
    barGap,
    barRadius,
    barWidth,
    data,
    mode,
    tone,
  });

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const { active, barGap, barRadius, barWidth, data, mode, tone } = drawStateRef.current;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.scale(dpr, dpr);
    context.clearRect(0, 0, rect.width, rect.height);
    const styles = getComputedStyle(canvas);
    const fillColor =
      tone === 'voice'
        ? styles.getPropertyValue('--color-voice-spectrum') || '#3d75d8'
        : tone === 'neutral'
          ? styles.getPropertyValue('--color-obsidian') || '#111111'
          : styles.getPropertyValue('--color-slate') || '#8d8982';
    context.fillStyle = fillColor;

    const step = barWidth + barGap;
    const barCount = Math.floor(rect.width / step);
    const centerY = rect.height / 2;

    if (mode === 'dots') {
      const dotRadius = Math.max(1.4, Math.min(2.4, barWidth / 2));
      const dotGap = Math.max(6, step);
      const dotCount = Math.floor(rect.width / dotGap);
      context.globalAlpha = active ? 0.72 : 0.58;
      for (let index = 0; index < dotCount; index += 1) {
        const x = index * dotGap + dotRadius;
        context.beginPath();
        context.arc(x, centerY, dotRadius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      return;
    }

    for (let index = 0; index < barCount; index += 1) {
      const value = data[Math.floor((index / barCount) * data.length)] ?? 0;
      const barHeight = Math.max(8, value * rect.height * 0.88) * (active ? 1 : 0.88);
      const x = index * step;
      const y = centerY - barHeight / 2;
      context.globalAlpha = active ? 0.95 : 0.64;
      context.beginPath();
      context.roundRect(x, y, barWidth, barHeight, barRadius);
      context.fill();
    }

    context.globalAlpha = 1;
  }, []);

  useEffect(() => {
    drawStateRef.current = { active, barGap, barRadius, barWidth, data, mode, tone };
    drawWaveform();
  }, [active, barGap, barRadius, barWidth, data, drawWaveform, mode, tone]);

  useEffect(() => {
    const observedContainer = containerRef.current;
    if (!observedContainer) {
      return undefined;
    }

    drawWaveform();
    const resizeObserver = new ResizeObserver(drawWaveform);
    resizeObserver.observe(observedContainer);
    return () => resizeObserver.disconnect();
  }, [drawWaveform]);

  const safePlayheadProgress =
    playheadProgress === null ? null : Math.min(1, Math.max(0, playheadProgress));
  const playheadLeft =
    safePlayheadProgress === null
      ? undefined
      : safePlayheadProgress >= 1
        ? 'calc(100% - 2px)'
        : `${safePlayheadProgress * 100}%`;

  return (
    <div
      aria-hidden={decorative}
      aria-label={decorative ? undefined : label}
      className={cn('relative overflow-hidden', className)}
      ref={containerRef}
      role={decorative ? undefined : 'img'}
      style={{ height }}
      {...props}
    >
      <canvas className="block h-full w-full" ref={canvasRef} />
      {safePlayheadProgress !== null ? (
        <span
          aria-hidden="true"
          className="absolute top-1/2 block h-[calc(100%-10px)] w-[2px] -translate-y-1/2 bg-voice-spectrum"
          data-slot="recording-playhead"
          style={{ left: playheadLeft }}
        >
          <span className="absolute left-1/2 top-0 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-voice-spectrum" />
          <span className="absolute bottom-0 left-1/2 h-8 w-8 -translate-x-1/2 translate-y-1/2 rounded-full bg-voice-spectrum" />
        </span>
      ) : null}
    </div>
  );
}

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
  readonly progress?: number | null;
  readonly tone?: 'muted' | 'neutral' | 'voice';
};

type DrawWaveformState = {
  readonly active: boolean;
  readonly barGap: number;
  readonly barRadius: number;
  readonly barWidth: number;
  readonly data: readonly number[];
  readonly mode: NonNullable<WaveformProps['mode']>;
  readonly progress: number | null;
  readonly tone: NonNullable<WaveformProps['tone']>;
};

type CanvasBackingStore = {
  readonly dpr: number;
  readonly height: number;
  readonly width: number;
};

type WaveformBarShape =
  | {
      readonly centerX: number;
      readonly centerY: number;
      readonly kind: 'dot';
      readonly radius: number;
    }
  | {
      readonly height: number;
      readonly kind: 'bar';
      readonly radius: number;
      readonly width: number;
      readonly x: number;
      readonly y: number;
    };

const WAVEFORM_TONE_TOKEN: Record<NonNullable<WaveformProps['tone']>, string> = {
  muted: '--muted-foreground',
  neutral: '--foreground',
  voice: '--primary',
};
const DOT_HEIGHT_RATIO = 1.25;

function readColorToken(styles: CSSStyleDeclaration, token: string, fallback: string) {
  return styles.getPropertyValue(token).trim() || fallback;
}

export function resolveWaveformBarShape({
  barHeight,
  barRadius,
  barWidth,
  centerY,
  x,
}: {
  readonly barHeight: number;
  readonly barRadius: number;
  readonly barWidth: number;
  readonly centerY: number;
  readonly x: number;
}): WaveformBarShape {
  if (barHeight <= barWidth * DOT_HEIGHT_RATIO) {
    return {
      centerX: x + barWidth / 2,
      centerY,
      kind: 'dot',
      radius: barWidth / 2,
    };
  }

  return {
    height: barHeight,
    kind: 'bar',
    radius: barRadius,
    width: barWidth,
    x,
    y: centerY - barHeight / 2,
  };
}

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
  progress = null,
  tone = 'voice',
  ...props
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const backingStoreRef = useRef<CanvasBackingStore | null>(null);
  const drawStateRef = useRef<DrawWaveformState>({
    active,
    barGap,
    barRadius,
    barWidth,
    data,
    mode,
    progress,
    tone,
  });

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const { active, barGap, barRadius, barWidth, data, mode, progress, tone } =
      drawStateRef.current;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const nextBackingStore = {
      dpr,
      height: rect.height,
      width: rect.width,
    };
    const previousBackingStore = backingStoreRef.current;
    if (
      !previousBackingStore ||
      previousBackingStore.dpr !== nextBackingStore.dpr ||
      previousBackingStore.height !== nextBackingStore.height ||
      previousBackingStore.width !== nextBackingStore.width
    ) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      backingStoreRef.current = nextBackingStore;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    const styles = getComputedStyle(canvas);
    const fillColor = readColorToken(styles, WAVEFORM_TONE_TOKEN[tone], styles.color);
    const playedColor = readColorToken(styles, '--foreground', fillColor);
    const unplayedColor = readColorToken(styles, '--secondary', fillColor);

    const step = barWidth + barGap;
    const barCount = Math.floor(rect.width / step);
    const centerY = rect.height / 2;

    if (mode === 'dots') {
      const dotRadius = Math.max(1.4, Math.min(2.4, barWidth / 2));
      const dotGap = Math.max(6, step);
      const dotCount = Math.floor(rect.width / dotGap);
      context.fillStyle = fillColor;
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

    if (data.length === 0 || barCount <= 0) {
      return;
    }

    const drawBars = (fillStyle: string, globalAlpha: number, clipWidth?: number) => {
      context.save();
      if (clipWidth !== undefined) {
        context.beginPath();
        context.rect(0, 0, clipWidth, rect.height);
        context.clip();
      }

      context.fillStyle = fillStyle;
      context.globalAlpha = globalAlpha;
      for (let index = 0; index < barCount; index += 1) {
        const value = Math.max(
          0,
          Math.min(1, data[Math.floor((index / barCount) * data.length)] ?? 0)
        );
        if (value <= 0) {
          continue;
        }

        const barHeight = Math.max(2, value * rect.height * 0.88) * (active ? 1 : 0.88);
        const x = index * step;
        const shape = resolveWaveformBarShape({
          barHeight,
          barRadius,
          barWidth,
          centerY,
          x,
        });
        context.beginPath();
        if (shape.kind === 'dot') {
          context.arc(shape.centerX, shape.centerY, shape.radius, 0, Math.PI * 2);
        } else {
          context.roundRect(shape.x, shape.y, shape.width, shape.height, shape.radius);
        }
        context.fill();
      }
      context.restore();
    };

    const safeProgress = progress === null ? null : Math.min(1, Math.max(0, progress));

    if (safeProgress !== null) {
      drawBars(unplayedColor, active ? 0.92 : 0.86);
      if (safeProgress > 0) {
        drawBars(playedColor, active ? 1 : 0.98, rect.width * safeProgress);
      }
    } else {
      drawBars(fillColor, active ? 0.95 : 0.64);
    }

    context.globalAlpha = 1;
  }, []);

  useEffect(() => {
    drawStateRef.current = {
      active,
      barGap,
      barRadius,
      barWidth,
      data,
      mode,
      progress,
      tone,
    };
    drawWaveform();
  }, [active, barGap, barRadius, barWidth, data, drawWaveform, mode, progress, tone]);

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

  const safeProgress = progress === null ? null : Math.min(1, Math.max(0, progress));

  return (
    <div
      aria-hidden={decorative}
      aria-label={decorative ? undefined : label}
      className={cn('relative overflow-hidden', className)}
      data-waveform-progress={safeProgress === null ? undefined : String(safeProgress)}
      data-waveform-progress-style={safeProgress === null ? undefined : 'split'}
      data-waveform-bar-radius={barRadius}
      data-waveform-bar-width={barWidth}
      data-waveform-mode={mode}
      data-waveform-tone={tone}
      ref={containerRef}
      role={decorative ? undefined : 'img'}
      style={{ height }}
      {...props}
    >
      <canvas className="block h-full w-full" ref={canvasRef} />
    </div>
  );
}

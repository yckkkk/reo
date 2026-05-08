import { useEffect, useRef, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type WaveformProps = ComponentProps<'div'> & {
  readonly active?: boolean;
  readonly barGap?: number;
  readonly barRadius?: number;
  readonly barWidth?: number;
  readonly data: readonly number[];
  readonly decorative?: boolean;
  readonly height?: number;
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
  ...props
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observedContainer = containerRef.current;
    if (!observedContainer) {
      return undefined;
    }

    function draw() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) {
        return;
      }

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
      context.fillStyle =
        getComputedStyle(canvas).getPropertyValue('--color-voice-spectrum') || '#3d75d8';

      const step = barWidth + barGap;
      const barCount = Math.floor(rect.width / step);
      const centerY = rect.height / 2;

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
    }

    draw();
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(observedContainer);
    return () => resizeObserver.disconnect();
  }, [active, barGap, barRadius, barWidth, data]);

  return (
    <div
      aria-hidden={decorative}
      aria-label={decorative ? undefined : '音频波形'}
      className={cn('relative overflow-hidden', className)}
      ref={containerRef}
      role={decorative ? undefined : 'img'}
      style={{ height }}
      {...props}
    >
      <canvas className="block h-full w-full" ref={canvasRef} />
    </div>
  );
}

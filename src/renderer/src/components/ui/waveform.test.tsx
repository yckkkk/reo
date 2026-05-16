import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveWaveformBarShape, Waveform } from './waveform';

describe('Waveform', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
  });

  it('renders low-amplitude bars as round dots instead of stretched pills', () => {
    expect(
      resolveWaveformBarShape({
        barHeight: 2,
        barRadius: 4,
        barWidth: 4,
        centerY: 21,
        x: 12,
      })
    ).toEqual({
      centerX: 14,
      centerY: 21,
      kind: 'dot',
      radius: 2,
    });

    expect(
      resolveWaveformBarShape({
        barHeight: 4.1,
        barRadius: 4,
        barWidth: 4,
        centerY: 21,
        x: 12,
      })
    ).toMatchObject({
      centerX: 14,
      kind: 'dot',
      radius: 2,
    });

    expect(
      resolveWaveformBarShape({
        barHeight: 18,
        barRadius: 4,
        barWidth: 4,
        centerY: 21,
        x: 12,
      })
    ).toMatchObject({
      height: 18,
      kind: 'bar',
      radius: 4,
      width: 4,
      x: 12,
      y: 12,
    });
  });

  it('renders playback progress as a split waveform instead of a separate playhead', () => {
    render(<Waveform data={[0.1, 0.7, 0.4, 1]} label="录音播放进度" progress={0.375} />);

    const waveform = screen.getByRole('img', { name: '录音播放进度' });
    expect(waveform).toHaveAttribute('data-waveform-progress', '0.375');
    expect(waveform).toHaveAttribute('data-waveform-progress-style', 'split');
    expect(waveform.querySelector('[data-slot="recording-playhead"]')).not.toBeInTheDocument();
  });

  it('redraws the canvas when the active theme token changes', async () => {
    const assignedFillStyles: string[] = [];
    const canvasContext = {
      arc: () => undefined,
      beginPath: () => undefined,
      clip: () => undefined,
      clearRect: () => undefined,
      fill: () => undefined,
      get fillStyle() {
        return assignedFillStyles.at(-1) ?? '';
      },
      rect: () => undefined,
      restore: () => undefined,
      roundRect: () => undefined,
      save: () => undefined,
      set fillStyle(value: string) {
        assignedFillStyles.push(value);
      },
      setTransform: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    const rect = {
      bottom: 32,
      height: 32,
      left: 0,
      right: 72,
      top: 0,
      width: 72,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
    document.documentElement.setAttribute('data-theme', 'light');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextType) =>
      contextType === '2d' ? canvasContext : null
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
    vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(
      () =>
        ({
          color:
            document.documentElement.getAttribute('data-theme') === 'dark'
              ? 'dark-fallback'
              : 'light-fallback',
          getPropertyValue: (token: string) => {
            const theme = document.documentElement.getAttribute('data-theme');
            if (token === '--foreground') {
              return theme === 'dark' ? 'dark-foreground-token' : 'light-foreground-token';
            }
            if (token === '--secondary') {
              return theme === 'dark' ? 'dark-secondary-token' : 'light-secondary-token';
            }
            return '';
          },
        }) as CSSStyleDeclaration
    );

    render(<Waveform data={[0.2, 0.8, 0.4, 1]} label="片段预览波形" tone="neutral" />);

    await waitFor(() => expect(assignedFillStyles).toContain('light-foreground-token'));
    document.documentElement.setAttribute('data-theme', 'dark');

    await waitFor(() => expect(assignedFillStyles).toContain('dark-foreground-token'));
  });
});

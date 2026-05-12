import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolveWaveformBarShape, Waveform } from './waveform';

describe('Waveform', () => {
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
});

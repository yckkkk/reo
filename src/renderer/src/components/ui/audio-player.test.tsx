import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AudioPlayer } from './audio-player';

describe('AudioPlayer', () => {
  it('renders a named local playback surface with Reo tokens', () => {
    render(
      <AudioPlayer description="已保存为本地录音文件。" src="blob:recording" title="本地录音" />
    );

    expect(screen.getByRole('region', { name: '本地录音' })).toHaveClass(
      'border-chalk',
      'bg-card-white'
    );
    expect(screen.getByRole('button', { name: '播放本地录音' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: '录音位置' })).toBeInTheDocument();
    expect(screen.getByText('已保存为本地录音文件。')).toBeInTheDocument();
    expect(screen.getByTestId('audio-player-audio')).toHaveAttribute('src', 'blob:recording');
    expect(screen.getByTestId('audio-player-audio')).not.toHaveAttribute('controls');
  });

  it('updates the position slider by playback step buckets', () => {
    render(
      <AudioPlayer description="已保存为本地录音文件。" src="blob:recording" title="本地录音" />
    );

    const audio = screen.getByTestId('audio-player-audio');
    Object.defineProperty(audio, 'duration', { configurable: true, value: 2 });
    fireEvent.loadedMetadata(audio);

    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 0.1 });
    fireEvent.timeUpdate(audio);
    expect(screen.getByRole('slider', { name: '录音位置' })).toHaveAttribute('aria-valuenow', '0');

    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 0.3 });
    fireEvent.timeUpdate(audio);
    expect(screen.getByRole('slider', { name: '录音位置' })).toHaveAttribute(
      'aria-valuenow',
      '0.3'
    );
  });
});

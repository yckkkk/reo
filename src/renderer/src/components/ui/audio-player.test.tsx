import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AudioPlayer } from './audio-player';

describe('AudioPlayer', () => {
  it('renders a named local playback surface with Reo tokens', () => {
    render(
      <AudioPlayer
        description="Stored as a local recording file."
        src="blob:recording"
        title="Local recording"
      />
    );

    expect(screen.getByRole('region', { name: 'Local recording' })).toHaveClass(
      'border-chalk',
      'bg-card-white'
    );
    expect(screen.getByRole('button', { name: 'Play local recording' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Recording position' })).toBeInTheDocument();
    expect(screen.getByText('Stored as a local recording file.')).toBeInTheDocument();
    expect(screen.getByTestId('audio-player-audio')).toHaveAttribute('src', 'blob:recording');
    expect(screen.getByTestId('audio-player-audio')).not.toHaveAttribute('controls');
  });

  it('updates the position slider by playback step buckets', () => {
    render(
      <AudioPlayer
        description="Stored as a local recording file."
        src="blob:recording"
        title="Local recording"
      />
    );

    const audio = screen.getByTestId('audio-player-audio');
    Object.defineProperty(audio, 'duration', { configurable: true, value: 2 });
    fireEvent.loadedMetadata(audio);

    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 0.1 });
    fireEvent.timeUpdate(audio);
    expect(screen.getByRole('slider', { name: 'Recording position' })).toHaveAttribute(
      'aria-valuenow',
      '0'
    );

    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 0.3 });
    fireEvent.timeUpdate(audio);
    expect(screen.getByRole('slider', { name: 'Recording position' })).toHaveAttribute(
      'aria-valuenow',
      '0.3'
    );
  });
});

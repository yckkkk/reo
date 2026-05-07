import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecordingPlayback } from './RecordingPlayback';

describe('RecordingPlayback', () => {
  it('exposes a load command before local playback is loaded', () => {
    const onLoad = vi.fn();

    render(<RecordingPlayback playbackUrl={null} onLoad={onLoad} />);

    fireEvent.click(screen.getByRole('button', { name: 'Load recording' }));

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Local recording' })).not.toBeInTheDocument();
  });

  it('renders only the local playback surface when audio is loaded', () => {
    render(<RecordingPlayback playbackUrl="blob:recording" onLoad={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Load recording' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Local recording' })).toBeInTheDocument();
    expect(screen.getByTestId('audio-player-audio')).toHaveAttribute('src', 'blob:recording');
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MediaPlaybackControl } from './media-playback-control';

describe('MediaPlaybackControl', () => {
  it('renders no interactive control when playback is unavailable', () => {
    render(
      <MediaPlaybackControl
        playable={false}
        hovered={true}
        playState="idle"
        label="近期表达"
        onToggle={vi.fn()}
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps the parent glyph visible when idle and not hovered', () => {
    render(
      <MediaPlaybackControl
        playable
        hovered={false}
        playState="idle"
        label="近期表达"
        onToggle={vi.fn()}
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a play control on hover and calls onToggle when clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <MediaPlaybackControl
        playable
        hovered
        playState="idle"
        label="近期表达"
        onToggle={onToggle}
      />
    );

    const button = screen.getByRole('button', { name: '播放 近期表达' });
    expect(button).toBeEnabled();
    expect(document.querySelector('[data-slot="media-playback-control"]')).toHaveClass(
      'bg-transparent'
    );
    expect(document.querySelector('[data-slot="media-playback-control"]')).not.toHaveClass(
      'bg-background/70'
    );
    expect(button).toHaveClass('size-28', 'rounded-full', 'bg-card/95');
    expect(button).not.toHaveClass('size-full', 'rounded-[8px]');
    expect(button).not.toHaveClass('hover:bg-accent', 'hover:text-accent-foreground');
    await user.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows a disabled loading spinner while audio is loading', () => {
    render(
      <MediaPlaybackControl
        playable
        hovered
        playState="loading"
        label="近期表达"
        onToggle={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: '播放 近期表达' });
    expect(button).toBeDisabled();
    expect(screen.getByTestId('media-playback-spinner')).toBeInTheDocument();
  });

  it('keeps pause visible while playing even when the row is not hovered', () => {
    render(
      <MediaPlaybackControl
        playable
        hovered={false}
        playState="playing"
        label="近期表达"
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '暂停 近期表达' })).toBeInTheDocument();
  });

  it('shows paused playback as play only while hovered', () => {
    const { rerender } = render(
      <MediaPlaybackControl
        playable
        hovered
        playState="paused"
        label="近期表达"
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '播放 近期表达' })).toBeInTheDocument();

    rerender(
      <MediaPlaybackControl
        playable
        hovered={false}
        playState="paused"
        label="近期表达"
        onToggle={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: '播放 近期表达' })).not.toBeInTheDocument();
  });

  it('hides loading playback after hover leaves', () => {
    render(
      <MediaPlaybackControl
        playable
        hovered={false}
        playState="loading"
        label="近期表达"
        onToggle={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: '播放 近期表达' })).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentTranscriptView } from './SegmentTranscriptView';

const copy = {
  loading: '正在载入。',
  error: '加载失败，请重试。',
  empty: '还没有转录。',
  failedRetryable: '上次生成转录失败。',
  running: '正在生成转录。',
  retry: '重试',
} as const;

describe('SegmentTranscriptView', () => {
  it('shows loading copy when status is loading', () => {
    render(
      <SegmentTranscriptView status="loading" outcome={{ kind: 'empty-never' }} copy={copy} />
    );
    expect(screen.getByText('正在载入。')).toBeInTheDocument();
  });

  it('shows error copy when status is error', () => {
    render(<SegmentTranscriptView status="error" outcome={{ kind: 'empty-never' }} copy={copy} />);
    expect(screen.getByText('加载失败，请重试。')).toBeInTheDocument();
  });

  it('shows empty copy for a never-created transcript outcome', () => {
    render(<SegmentTranscriptView status="ready" outcome={{ kind: 'empty-never' }} copy={copy} />);
    expect(screen.getByText('还没有转录。')).toBeInTheDocument();
  });

  it('shows empty copy for a cleared transcript outcome', () => {
    render(
      <SegmentTranscriptView status="ready" outcome={{ kind: 'empty-cleared' }} copy={copy} />
    );
    expect(screen.getByText('还没有转录。')).toBeInTheDocument();
  });

  it('shows transcript text with selectable styling for a successful outcome', () => {
    render(
      <SegmentTranscriptView
        status="ready"
        outcome={{ kind: 'success', text: '补充录音转写正文' }}
        copy={copy}
      />
    );
    const paragraph = screen.getByText('补充录音转写正文');
    expect(paragraph).toBeInTheDocument();
    expect(paragraph.className).toContain('select-text');
    expect(paragraph.className).toContain('max-w-[820px]');
    expect(paragraph.className).toContain('text-foreground');
  });

  it('calls onRetry from a retryable failed outcome', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <SegmentTranscriptView
        status="ready"
        outcome={{ kind: 'failed-retryable' }}
        onRetry={onRetry}
        copy={copy}
      />
    );

    expect(screen.getByText('上次生成转录失败。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重试' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('disables retry when onRetry is missing', () => {
    render(
      <SegmentTranscriptView status="ready" outcome={{ kind: 'failed-retryable' }} copy={copy} />
    );

    expect(screen.getByRole('button', { name: '重试' })).toBeDisabled();
  });

  it('shows running copy without a retry button while backfill is in progress', () => {
    render(<SegmentTranscriptView status="ready" outcome={{ kind: 'running' }} copy={copy} />);

    expect(screen.getByText('正在生成转录。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument();
  });

  it('keeps the current transcript visible while a regenerate backfill is running', () => {
    render(
      <SegmentTranscriptView
        status="ready"
        outcome={{ kind: 'running-overwrite', text: '这是一段已有转录。' }}
        copy={copy}
      />
    );

    expect(screen.getByText('这是一段已有转录。')).toBeInTheDocument();
    expect(screen.getByText('正在生成转录。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SegmentTranscriptView } from './SegmentTranscriptView';

const copy = {
  loading: '正在载入。',
  error: '加载失败，请重试。',
  empty: '还没有转录。',
} as const;

describe('SegmentTranscriptView', () => {
  it('shows loading copy when status is loading', () => {
    render(<SegmentTranscriptView status="loading" transcript={null} copy={copy} />);
    expect(screen.getByText('正在载入。')).toBeInTheDocument();
  });

  it('shows error copy when status is error', () => {
    render(<SegmentTranscriptView status="error" transcript={null} copy={copy} />);
    expect(screen.getByText('加载失败，请重试。')).toBeInTheDocument();
  });

  it('shows empty copy when transcript does not exist', () => {
    render(
      <SegmentTranscriptView
        status="ready"
        transcript={{ exists: false, text: '' }}
        copy={copy}
      />
    );
    expect(screen.getByText('还没有转录。')).toBeInTheDocument();
  });

  it('shows transcript text with selectable styling when transcript exists', () => {
    render(
      <SegmentTranscriptView
        status="ready"
        transcript={{ exists: true, text: '补充录音转写正文' }}
        copy={copy}
      />
    );
    const paragraph = screen.getByText('补充录音转写正文');
    expect(paragraph).toBeInTheDocument();
    expect(paragraph.className).toContain('select-text');
    expect(paragraph.className).toContain('max-w-[820px]');
    expect(paragraph.className).toContain('text-foreground');
  });

  it('treats null transcript in ready state as empty', () => {
    render(<SegmentTranscriptView status="ready" transcript={null} copy={copy} />);
    expect(screen.getByText('还没有转录。')).toBeInTheDocument();
  });
});

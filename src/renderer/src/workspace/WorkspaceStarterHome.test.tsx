import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WorkspaceStarterHome,
  greetingForHour,
  type WorkspaceStarterHomeRecentExpression,
} from './WorkspaceStarterHome';

const readExpressionPlaybackAudioMock = vi.hoisted(() => vi.fn());

class FakeHomeAudioElement {
  readonly pause = vi.fn();
  readonly play = vi.fn(async () => undefined);
  currentTime = 0;
  src = '';
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  removeAttribute(name: string): void {
    if (name === 'src') {
      this.src = '';
    }
  }
}

const recentExpression: WorkspaceStarterHomeRecentExpression = {
  coverImageSrc: '/covers/recent-note.png',
  id: 'recent-seg-1',
  preview: '整理今日产品判断。',
  time: '今天 09:24',
  title: '产品判断笔记',
  type: 'note',
};

function recentExpressionWith(
  overrides: Partial<WorkspaceStarterHomeRecentExpression>
): WorkspaceStarterHomeRecentExpression {
  return { ...recentExpression, ...overrides };
}

describe('greetingForHour', () => {
  it('maps each hour to its time-of-day greeting at the bucket boundaries', () => {
    expect(greetingForHour(0)).toBe('晚上好');
    expect(greetingForHour(4)).toBe('晚上好');
    expect(greetingForHour(5)).toBe('早上好');
    expect(greetingForHour(11)).toBe('早上好');
    expect(greetingForHour(12)).toBe('下午好');
    expect(greetingForHour(17)).toBe('下午好');
    expect(greetingForHour(18)).toBe('晚上好');
    expect(greetingForHour(23)).toBe('晚上好');
  });
});

describe('WorkspaceStarterHome', () => {
  beforeEach(() => {
    readExpressionPlaybackAudioMock.mockImplementation(
      async (payload: {
        readonly kind: 'audio' | 'note-speech';
        readonly memoryId: string;
        readonly requestId: string;
        readonly segmentId: string;
        readonly supplementId?: string;
        readonly workspaceId: string;
      }) => ({
        ok: true,
        value: {
          requestId: payload.requestId,
          workspaceId: payload.workspaceId,
          memoryId: payload.memoryId,
          segmentId: payload.segmentId,
          ...(payload.supplementId ? { supplementId: payload.supplementId } : {}),
          kind: payload.kind,
          audio: new Uint8Array([1, 2, 3]),
          mimeType: payload.kind === 'note-speech' ? 'audio/mpeg' : 'audio/webm',
        },
      })
    );
    Object.defineProperty(window, 'reoWorkspace', {
      configurable: true,
      value: {
        readExpressionPlaybackAudio: readExpressionPlaybackAudioMock,
      },
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:home-recent-expression'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal('Audio', FakeHomeAudioElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    readExpressionPlaybackAudioMock.mockReset();
  });

  it('renders the time-based greeting and welcome heading above the action tiles', () => {
    render(<WorkspaceStarterHome recentExpressionsStatus="ready" />);

    expect(screen.getByText('想到的，都留下来')).toBeInTheDocument();
    expect(
      screen.getByText((text) => ['早上好', '下午好', '晚上好'].includes(text))
    ).toBeInTheDocument();
  });

  it('renders loading and empty recent expression states without static fixture rows', () => {
    const { rerender } = render(<WorkspaceStarterHome recentExpressionsStatus="loading" />);

    expect(screen.getByText('正在加载近期表达')).toBeInTheDocument();
    expect(screen.queryByText('清晨的灵感碎片')).not.toBeInTheDocument();

    rerender(<WorkspaceStarterHome recentExpressions={[]} recentExpressionsStatus="ready" />);

    expect(screen.getByText('暂无近期表达')).toBeInTheDocument();
    expect(screen.queryByText('清晨的灵感碎片')).not.toBeInTheDocument();
  });

  it('renders populated recent expressions and reports row selection', async () => {
    const user = userEvent.setup();
    const onOpenRecentExpression = vi.fn();
    render(
      <WorkspaceStarterHome
        recentExpressions={[recentExpression]}
        recentExpressionsStatus="ready"
        onOpenRecentExpression={onOpenRecentExpression}
      />
    );

    expect(screen.getByText('产品判断笔记')).toBeInTheDocument();
    expect(screen.getByText('整理今日产品判断。')).toBeInTheDocument();
    expect(screen.queryByText('清晨的灵感碎片')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开近期表达 产品判断笔记' }));

    expect(onOpenRecentExpression).toHaveBeenCalledWith(recentExpression);
  });

  it('fills recent expression icons with cover images while keeping foreground glyphs', () => {
    render(
      <WorkspaceStarterHome
        recentExpressions={[
          recentExpressionWith({
            coverImageSrc: '/covers/recent-note.png',
            id: 'recent-note',
            title: '产品判断笔记',
            type: 'note',
          }),
          recentExpressionWith({
            coverImageSrc: '/assets/cover-05.png',
            id: 'recent-audio',
            title: '现场录音',
            type: 'audio',
          }),
          recentExpressionWith({
            coverImageSrc: '/covers/recent-artifact.png',
            id: 'recent-artifact',
            title: '作品片段',
            type: 'artifact',
          }),
        ]}
        recentExpressionsStatus="ready"
      />
    );

    const covers = Array.from(
      document.querySelectorAll<HTMLImageElement>('[data-slot="home-recent-expression-cover"]')
    );
    expect(covers.map((cover) => cover.getAttribute('src'))).toEqual([
      '/covers/recent-note.png',
      '/assets/cover-05.png',
      '/covers/recent-artifact.png',
    ]);
    expect(screen.getByLabelText('笔记')).toBeInTheDocument();
    expect(screen.getByLabelText('录音')).toBeInTheDocument();
    expect(screen.getByLabelText('作品')).toBeInTheDocument();

    const audioIcon = document.querySelector<HTMLElement>(
      '[data-slot="home-recent-expression-icon"][data-expression-id="recent-audio"]'
    );
    if (!(audioIcon instanceof HTMLElement)) {
      throw new Error('Expected recent expression audio icon.');
    }
    expect(audioIcon).toHaveClass('rounded-full');
    expect(audioIcon).not.toHaveClass('rounded-[10px]');
    expect(audioIcon.style.getPropertyValue('--recent-expression-glyph-r')).toBe('250');
    expect(audioIcon.style.getPropertyValue('--recent-expression-glyph-g')).toBe('250');
    expect(audioIcon.style.getPropertyValue('--recent-expression-glyph-b')).toBe('250');
    expect(audioIcon.style.getPropertyValue('--cover-bottom-r')).toBe('');
    expect(audioIcon.querySelector('[data-slot="home-recent-expression-glyph"]')).toHaveClass(
      'text-[rgb(var(--recent-expression-glyph-r)_var(--recent-expression-glyph-g)_var(--recent-expression-glyph-b)/0.92)]'
    );
  });

  it('plays a playable recent expression from the icon without opening the row', async () => {
    const onOpenRecentExpression = vi.fn();
    render(
      <WorkspaceStarterHome
        recentExpressions={[
          recentExpressionWith({
            playback: {
              kind: 'note-speech',
              ref: {
                workspaceId: 'ws_1',
                memoryId: 'mem_1',
                segmentId: 'seg_1',
              },
            },
          }),
        ]}
        recentExpressionsStatus="ready"
        onOpenRecentExpression={onOpenRecentExpression}
      />
    );

    const icon = document.querySelector<HTMLElement>(
      '[data-slot="home-recent-expression-icon"][data-expression-id="recent-seg-1"]'
    );
    if (!(icon instanceof HTMLElement)) {
      throw new Error('Expected recent expression icon.');
    }

    fireEvent.pointerEnter(icon);
    const playButton = screen.getByRole('button', { name: '播放 产品判断笔记' });
    expect(playButton).toHaveClass('size-28', 'rounded-full');
    expect(playButton).not.toHaveClass('size-full');
    fireEvent.click(playButton);

    expect(onOpenRecentExpression).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(readExpressionPlaybackAudioMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          kind: 'note-speech',
        })
      )
    );
    expect(readExpressionPlaybackAudioMock.mock.calls[0]?.[0]).not.toHaveProperty(
      'workspaceHandle'
    );
    expect(await screen.findByRole('button', { name: '暂停 产品判断笔记' })).toBeInTheDocument();

    fireEvent.pointerLeave(icon);

    expect(screen.getByRole('button', { name: '暂停 产品判断笔记' })).toBeInTheDocument();

    fireEvent.pointerEnter(icon);
    fireEvent.click(screen.getByRole('button', { name: '暂停 产品判断笔记' }));
    expect(screen.getByRole('button', { name: '播放 产品判断笔记' })).toBeInTheDocument();

    fireEvent.pointerLeave(icon);

    expect(screen.queryByRole('button', { name: '播放 产品判断笔记' })).not.toBeInTheDocument();
    expect(icon.querySelector('[data-slot="home-recent-expression-glyph"]')).toHaveClass(
      'opacity-100'
    );
    expect(icon.querySelector('[data-slot="home-recent-expression-scrim"]')).not.toHaveClass(
      'bg-background/30'
    );
  });

  it('does not show playback for non-playable rows and keeps row body opening intact', async () => {
    const user = userEvent.setup();
    const onOpenRecentExpression = vi.fn();
    render(
      <WorkspaceStarterHome
        recentExpressions={[recentExpression]}
        recentExpressionsStatus="ready"
        onOpenRecentExpression={onOpenRecentExpression}
      />
    );

    const icon = document.querySelector<HTMLElement>(
      '[data-slot="home-recent-expression-icon"][data-expression-id="recent-seg-1"]'
    );
    if (!(icon instanceof HTMLElement)) {
      throw new Error('Expected recent expression icon.');
    }

    fireEvent.pointerEnter(icon);

    expect(screen.queryByRole('button', { name: '播放 产品判断笔记' })).not.toBeInTheDocument();
    const scrim = icon.querySelector<HTMLElement>('[data-slot="home-recent-expression-scrim"]');
    if (!(scrim instanceof HTMLElement)) {
      throw new Error('Expected recent expression icon scrim.');
    }
    expect(scrim).not.toHaveClass('bg-background/30');

    await user.click(screen.getByRole('button', { name: '打开近期表达 产品判断笔记' }));

    expect(onOpenRecentExpression).toHaveBeenCalledWith(recentExpression);
  });

  it('keeps recent expression hover surface inset from row content', () => {
    render(
      <WorkspaceStarterHome
        recentExpressions={[recentExpression]}
        recentExpressionsStatus="ready"
      />
    );

    const row = screen.getByRole('button', { name: '打开近期表达 产品判断笔记' });

    expect(row).toHaveClass('px-16');
    expect(row).not.toHaveClass('pl-0', 'pr-0');
    expect(row).toHaveClass('py-8');
    expect(row).not.toHaveClass('py-10');
  });

  it('renders Home actions without an outer card wrapped around each icon tile', () => {
    render(<WorkspaceStarterHome recentExpressionsStatus="ready" />);

    for (const label of ['写下来', '录下来', '造出来', '拍下来']) {
      const action = screen.getByRole('button', { name: label });
      expect(action).not.toHaveClass('bg-card');
      expect(action.querySelectorAll('[data-slot^="home-action-icon-slot-"]')).toHaveLength(1);
    }
  });

  it('keeps the disabled capture action out of active hover compositing', () => {
    render(<WorkspaceStarterHome recentExpressionsStatus="ready" onStartNote={vi.fn()} />);

    const writeAction = screen.getByRole('button', { name: '写下来' });
    const captureAction = screen.getByRole('button', { name: '拍下来' });
    const captureOverlay = captureAction.querySelector(
      '[data-slot="home-action-state-overlay-capture"]'
    ) as HTMLElement;

    expect(writeAction).toHaveClass('group', 'hover:-translate-y-1');
    expect(captureAction).toBeDisabled();
    expect(captureAction).not.toHaveClass('group');
    expect(captureAction).not.toHaveClass('opacity-[0.58]');
    expect(captureAction).not.toHaveClass('hover:-translate-y-1');
    expect(captureOverlay).toHaveClass('bg-background/30');
    expect(captureOverlay).not.toHaveClass('group-hover:bg-foreground/[0.05]');
  });

  it('renders partial recent expression failures without exposing raw paths', () => {
    render(
      <WorkspaceStarterHome
        recentExpressions={[recentExpression]}
        recentExpressionsSkippedCount={1}
        recentExpressionsStatus="ready"
      />
    );

    expect(screen.getByText('部分记忆空间暂不可读')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('/Users/');
  });
});

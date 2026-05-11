import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createReoQueryClient } from '../queryClient';
import { LoadedWorkspaceFrame } from './LoadedWorkspaceFrame';
import type { WorkspaceSession } from './workspaceApi';
import { seedWorkspaceSnapshot, workspaceSnapshotQueryKey } from './workspaceQueries';

function workspaceSession(snapshot: Partial<WorkspaceSession['snapshot']> = {}): WorkspaceSession {
  return {
    workspaceHandle: 'workspace-handle-secret',
    workspaceId: 'ws_1',
    snapshot: {
      workspaceId: 'ws_1',
      title: 'Daily memory',
      description: 'Private notes',
      memories: [],
      ...snapshot,
    },
  };
}

const birthdayMemory = {
  memoryId: 'mem_birthday',
  title: 'My seventh birthday',
  createdAt: '2026-05-06T13:08:00.000',
  updatedAt: '2026-05-06T13:10:00.000',
  segmentCount: 2,
  durationMs: 125_000,
  audioByteLength: 2048,
  hasTranscript: true,
  attachmentCount: 0,
};

const birthdayDetail = {
  workspaceId: 'ws_1',
  memoryId: 'mem_birthday',
  title: 'My seventh birthday',
  createdAt: '2026-05-06T13:08:00.000',
  updatedAt: '2026-05-06T13:10:00.000',
  segmentCount: 2,
  durationMs: 125_000,
  audioByteLength: 2048,
  hasTranscript: true,
  attachmentCount: 0,
  segments: [
    {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      type: 'audio',
      title: 'Birthday candles',
      createdAt: '2026-05-06T13:08:00.000',
      updatedAt: '2026-05-06T13:10:00.000',
      durationMs: 125_000,
      audioByteLength: 2048,
      transcript: {
        exists: true,
      },
      attachmentCount: 0,
      attachments: [],
    },
  ],
};

const birthdayDetailWithTwoSegments = {
  ...birthdayDetail,
  segmentCount: 2,
  durationMs: 190_000,
  audioByteLength: 3072,
  segments: [
    birthdayDetail.segments[0],
    {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_song',
      type: 'audio',
      title: 'Birthday song',
      createdAt: '2026-05-06T13:12:00.000',
      updatedAt: '2026-05-06T13:13:05.000',
      durationMs: 65_000,
      audioByteLength: 1024,
      transcript: {
        exists: false,
      },
      attachmentCount: 0,
      attachments: [],
    },
  ],
};

function setScrollMetrics(
  element: HTMLElement,
  metrics: {
    readonly clientWidth: number;
    readonly scrollLeft: number;
    readonly scrollWidth: number;
  }
) {
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: metrics.clientWidth },
    scrollLeft: { configurable: true, value: metrics.scrollLeft, writable: true },
    scrollWidth: { configurable: true, value: metrics.scrollWidth },
  });
}

function expectGlassVectorClass(element: Element | null) {
  expect(element).toBeInstanceOf(HTMLElement);
  const className = (element as HTMLElement).getAttribute('class') ?? '';
  expect(className).not.toMatch(/(^|\s)(hover:|active:)?-?translate-/);
  expect(className).not.toMatch(/(^|\s)(hover:|active:)?scale-/);
  expect(className).not.toMatch(/(^|\s)(hover:|active:)?opacity-/);
  expect(className).not.toMatch(/\b(?:bg|border|text)-[^\s/]+\/\d/);
  expect(className).not.toMatch(/card-white|text-card-white|border-card-white/);
  expect(className).not.toMatch(/shadow-subtle-\d/);
}

const morningMemory = {
  memoryId: 'mem_morning',
  title: 'Morning note',
  createdAt: '2026-04-11T09:00:00.000',
  updatedAt: '2026-04-11T09:02:00.000',
  segmentCount: 1,
  durationMs: 30_000,
  audioByteLength: 512,
  hasTranscript: false,
  attachmentCount: 1,
};

const recitalMemory = {
  memoryId: 'mem_recital',
  title: 'School recital',
  createdAt: '2026-05-01T09:00:00.000',
  updatedAt: '2026-05-01T09:10:00.000',
  segmentCount: 1,
  durationMs: 60_000,
  audioByteLength: 1024,
  hasTranscript: false,
  attachmentCount: 0,
};

function renderLoadedWorkspaceFrame({
  currentMemory = null,
  memoryRailOpen,
  onDeleteMemory = vi.fn(),
  onRenameMemory = vi.fn(),
  onSelectMemory = vi.fn(),
  onStartRecording = vi.fn(),
  onStartSegmentAttachmentRecording = vi.fn(),
  readFinalizedAudioSegmentAttachment = vi.fn().mockResolvedValue({
    ok: false,
    error: {
      code: 'ERR_RECORDING_NOT_FOUND',
      message: 'Attachment recording not found',
    },
  }),
  readFinalizedAudioSegment = vi.fn().mockResolvedValue({
    ok: false,
    error: {
      code: 'ERR_RECORDING_NOT_FOUND',
      message: 'Recording not found',
    },
  }),
  session = workspaceSession(),
}: {
  readonly currentMemory?: WorkspaceSession['snapshot']['memories'][number] | null;
  readonly memoryRailOpen?: boolean;
  readonly onDeleteMemory?: (memory: WorkspaceSession['snapshot']['memories'][number]) => void;
  readonly onRenameMemory?: (memory: WorkspaceSession['snapshot']['memories'][number]) => void;
  readonly onSelectMemory?: (memoryId: string) => void;
  readonly onStartRecording?: () => void;
  readonly onStartSegmentAttachmentRecording?: (target: {
    readonly memoryId: string;
    readonly segmentId: string;
  }) => void;
  readonly readFinalizedAudioSegmentAttachment?: ReturnType<typeof vi.fn>;
  readonly readFinalizedAudioSegment?: ReturnType<typeof vi.fn>;
  readonly session?: WorkspaceSession;
} = {}) {
  Object.defineProperty(window, 'reoWorkspace', {
    configurable: true,
    value: {
      readFinalizedAudioSegmentAttachment,
      readFinalizedAudioSegment,
      readMemoryDetail: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'ERR_MEMORY_NOT_FOUND',
          message: 'Memory not found',
        },
      }),
    } as unknown as Window['reoWorkspace'],
  });
  const queryClient = createReoQueryClient();
  seedWorkspaceSnapshot(queryClient, session);
  const frameProps =
    memoryRailOpen === undefined
      ? {}
      : {
          memoryRailOpen,
        };
  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <LoadedWorkspaceFrame
        currentMemory={currentMemory}
        workspaceSession={session}
        onDeleteMemory={onDeleteMemory}
        onRenameMemory={onRenameMemory}
        onSelectMemory={onSelectMemory}
        onStartSegmentAttachmentRecording={onStartSegmentAttachmentRecording}
        onStartRecording={onStartRecording}
        {...frameProps}
      />
    </QueryClientProvider>
  );

  return { queryClient, ...renderResult };
}

describe('LoadedWorkspaceFrame', () => {
  it('renders the loaded workspace frame as a workspace stage with one real expression entry', async () => {
    const user = userEvent.setup();
    const onStartRecording = vi.fn();

    renderLoadedWorkspaceFrame({ onStartRecording });

    expect(screen.queryByRole('region', { name: '记忆空间栏' })).not.toBeInTheDocument();
    expect(screen.queryByText('Daily memory')).not.toBeInTheDocument();
    const stage = screen.getByRole('region', { name: '记忆空间舞台' });
    expect(within(stage).getByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();
    expect(within(stage).getByRole('heading', { name: '今天想记录些什么？' })).toHaveClass(
      'font-memory-serif'
    );
    expect(stage.querySelector('svg')).not.toBeInTheDocument();
    expect(within(stage).queryByText('片段时间线')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '全部记忆' })).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: '搜索记忆' })).not.toBeInTheDocument();
    expect(screen.queryByText('workspace-handle-secret')).not.toBeInTheDocument();

    const dock = screen.getByRole('region', { name: '表达入口' });
    expect(dock).toHaveClass('pointer-events-none');
    expect(dock.closest('[data-slot="workspace-expression-fab-layer"]')).toHaveClass(
      'bottom-32',
      'right-[var(--workspace-memory-rail-stage-inset)]',
      'xl:right-[var(--workspace-memory-rail-stage-inset-wide)]'
    );
    const workspaceFrame = document.querySelector('[data-slot="workspace-frame"]');
    expect(workspaceFrame).toHaveClass('h-full', 'min-h-0', 'overflow-hidden');
    expect(workspaceFrame).not.toHaveClass('min-h-full');
    expect(workspaceFrame).toHaveStyle({
      '--workspace-memory-rail-stage-inset':
        'calc(var(--workspace-memory-rail-width) + clamp(12px, 2vw, 20px))',
      '--workspace-memory-rail-stage-inset-wide':
        'calc(var(--workspace-memory-rail-width) + clamp(20px, 2.5vw, 40px))',
      '--workspace-memory-rail-width': 'clamp(220px, 24vw, 280px)',
    });
    const dialTrigger = within(dock).getByRole('button', { name: '打开表达入口' });
    expect(dialTrigger).toHaveClass(
      '!bg-signal-blue',
      '!rounded-full',
      '!size-[var(--reo-speed-dial-diameter)]'
    );
    expect(within(dock).queryByRole('menuitem', { name: '录音' })).not.toBeInTheDocument();
    expect(dock.querySelector('[role="menu"]')).toHaveAttribute('aria-hidden', 'true');
    expect(within(dock).queryByRole('menuitem', { name: '上传图片' })).not.toBeInTheDocument();

    await user.click(dialTrigger);
    const recordingAction = within(dock).getByRole('menuitem', { name: '录音' });
    expect(recordingAction).toHaveClass('rounded-full', 'size-[var(--reo-speed-dial-action-size)]');
    expect(within(dock).getByRole('menu', { name: '表达方式' })).toBeInTheDocument();
    expect(within(dock).queryByText('笔记')).not.toBeInTheDocument();
    expect(within(dock).queryByText('拍照')).not.toBeInTheDocument();
    expect(within(dock).queryByText('视频')).not.toBeInTheDocument();
    expect(within(dock).queryByText('上传')).not.toBeInTheDocument();
    expect(
      dock.querySelectorAll('[data-slot="floating-action-button-speed-dial-action-unavailable"]')
    ).toHaveLength(4);
    expect(within(dock).getByRole('menuitem', { name: '笔记暂不可用' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(within(dock).getByRole('menuitem', { name: '拍照暂不可用' })).toHaveClass(
      'cursor-default',
      'focus-visible:ring-2',
      'p-disabled'
    );
    expect(within(dock).queryByRole('menuitem', { name: '上传图片' })).not.toBeInTheDocument();

    await user.click(recordingAction);
    expect(onStartRecording).toHaveBeenCalledOnce();
  });

  it('renders right-side Memory containers without turning the stage into an segment timeline', () => {
    renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session: workspaceSession({
        memories: [morningMemory, recitalMemory, birthdayMemory],
      }),
    });

    const rail = screen.getByRole('navigation', { name: '记忆列表' });
    const railShell = rail.closest('[data-slot="workspace-memory-rail-shell"]');
    const stageShell = document.querySelector('[data-slot="workspace-stage-shell"]');
    expect(railShell).toHaveAttribute('aria-hidden', 'false');
    expect(railShell).toHaveClass('absolute', 'right-0', 'w-[var(--workspace-memory-rail-width)]');
    expect(stageShell).toHaveClass('min-h-0', 'overflow-hidden');
    expect(stageShell).not.toHaveClass('min-h-[640px]');
    expect(railShell).toHaveClass('translate-x-0', 'opacity-100');
    expect(stageShell).toHaveClass(
      'pr-[var(--workspace-memory-rail-stage-inset)]',
      'xl:pr-[var(--workspace-memory-rail-stage-inset-wide)]'
    );
    expect(rail).toHaveAttribute('id', 'workspace-memory-rail');
    expect(railShell).toHaveClass('border-l', 'border-glass-border');
    expect(rail).toHaveClass('bg-card-glass', 'backdrop-blur-glass-lg', 'px-16', 'py-20');
    expect(rail).not.toHaveClass('bg-linen');
    expect(rail).not.toHaveClass('bg-eggshell/70');
    expect(rail).not.toHaveClass('xl:border-l');
    expect(within(rail).queryByRole('heading', { name: '当前记忆' })).not.toBeInTheDocument();
    expect(within(rail).queryByText('3 条记忆')).not.toBeInTheDocument();
    expect(
      within(rail)
        .getAllByRole('button', { name: /选择记忆/ })
        .map((button) => button.getAttribute('aria-label'))
    ).toEqual(['选择记忆 My seventh birthday', '选择记忆 School recital', '选择记忆 Morning note']);
    const birthdayMemoryButton = within(rail).getByRole('button', {
      name: '选择记忆 My seventh birthday',
    });
    const recitalMemoryButton = within(rail).getByRole('button', {
      name: '选择记忆 School recital',
    });
    const birthdayMemoryCard = birthdayMemoryButton.closest('[data-slot="memory-rail-card"]');
    const recitalMemoryCard = recitalMemoryButton.closest('[data-slot="memory-rail-card"]');

    expect(birthdayMemoryButton).toHaveClass('min-h-[68px]', 'px-12', 'py-12');
    expect(birthdayMemoryCard).toHaveClass('rounded-panels', 'bg-chalk');
    expect(recitalMemoryCard).toHaveClass('rounded-panels', 'bg-powder');
    expect(birthdayMemoryCard).not.toHaveClass(
      'border',
      'border-signal-blue',
      'border-glass-border',
      'shadow-glass',
      'backdrop-blur-glass-sm',
      'bg-card-glass'
    );
    expect(within(rail).getByText('05/06 13:10 · 2 个片段')).toBeInTheDocument();
    expect(within(rail).getByText('05/01 09:10 · 1 个片段')).toBeInTheDocument();
    expect(within(rail).getByText('04/11 09:02 · 1 个片段')).toBeInTheDocument();
    expect(within(rail).queryByText(/更新/)).not.toBeInTheDocument();
    expect(within(rail).queryByText('转写')).not.toBeInTheDocument();
    expect(within(rail).queryByText('反思')).not.toBeInTheDocument();
    expect(within(rail).queryByText('时长')).not.toBeInTheDocument();
    expect(screen.queryByText('片段时间线')).not.toBeInTheDocument();
    const frame = document.querySelector('[data-slot="workspace-frame"]');
    expect(frame).toHaveClass('bg-card-glass', 'backdrop-blur-glass-lg');
    expect(frame).not.toHaveClass('bg-eggshell', 'bg-linen');
  });

  it('selects an existing Memory through the right rail without requiring a detail route', async () => {
    const user = userEvent.setup();
    const onSelectMemory = vi.fn();

    renderLoadedWorkspaceFrame({
      onSelectMemory,
      session: workspaceSession({ memories: [birthdayMemory] }),
    });

    await user.click(screen.getByRole('button', { name: '选择记忆 My seventh birthday' }));

    expect(onSelectMemory).toHaveBeenCalledWith('mem_birthday');
  });

  it('renders the selected Memory as an empty Memory Studio context', async () => {
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session: workspaceSession({ memories: [birthdayMemory] }),
    });
    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_empty',
      detail: {
        ...birthdayDetail,
        segmentCount: 0,
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        segments: [],
      },
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    expect(
      within(studio).getByRole('heading', { name: 'My seventh birthday' })
    ).toBeInTheDocument();
    expect(within(studio).getByText('0 个片段 · 00:00')).toBeInTheDocument();
    expect(within(studio).getByText('这条记忆还没有片段')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择记忆 My seventh birthday' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('renders Memory Studio from the current Memory detail projection', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday',
      detail: birthdayDetail,
    });

    expect(await screen.findByRole('region', { name: 'Memory Studio' })).toBeInTheDocument();
    const studio = screen.getByRole('region', { name: 'Memory Studio' });
    expect(
      within(studio).getByRole('heading', { name: 'My seventh birthday' })
    ).toBeInTheDocument();
    expect(within(studio).getByText('2 个片段 · 02:05')).toBeInTheDocument();
    const content = within(studio).getByRole('region', { name: '片段内容' });
    expect(
      within(content).getByRole('button', { name: '播放片段 Birthday candles' })
    ).toBeInTheDocument();
    expect(within(content).queryByText('audio · 02:05 · 已有转录')).toBeNull();
    expect(screen.queryByText('workspace-handle-secret')).not.toBeInTheDocument();
  });

  it('keeps Memory Studio as a first-viewport studio surface instead of a centered card list', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_visual_surface',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const stageContent = document.querySelector('[data-slot="workspace-stage-content"]');
    const studioLayout = studio.querySelector('[data-slot="memory-studio-layout"]');
    const strip = within(studio).getByRole('region', { name: '片段预览流' });
    const segmentItems = studio.querySelectorAll('[data-slot="memory-studio-segment-item"]');
    const segmentCards = studio.querySelectorAll('[data-slot="memory-studio-segment-card"]');
    const stripScroll = studio.querySelector('[data-slot="memory-studio-segment-strip-scroll"]');
    const contentPanel = studio.querySelector('[data-slot="memory-studio-content-panel"]');
    const transcriptScroll = studio.querySelector('[data-slot="memory-studio-transcript-scroll"]');

    expect(stageContent).toHaveClass('items-stretch', 'justify-start');
    expect(studio).toHaveClass('overflow-hidden');
    expect(studioLayout).toHaveClass('max-w-[1120px]');
    expect(segmentItems).toHaveLength(2);
    expect(segmentCards).toHaveLength(2);
    expect(segmentItems[0]).toHaveClass(
      'flex-[0_0_var(--memory-studio-segment-card-size)]',
      'snap-start',
      'flex-col',
      'min-w-[var(--memory-studio-segment-card-min-size)]'
    );
    expect(segmentCards[0]).toHaveClass(
      'aspect-square',
      'rounded-panels',
      'bg-chalk',
      'p-12',
      'min-h-[var(--memory-studio-segment-card-min-size)]',
      'min-w-[var(--memory-studio-segment-card-min-size)]'
    );
    expect(segmentCards[1]).toHaveClass('bg-powder');
    expect(segmentCards[0]).not.toHaveClass(
      'border',
      'border-2',
      'border-signal-blue',
      'border-glass-border',
      'shadow-glass',
      'shadow-subtle',
      'backdrop-blur-glass-sm'
    );
    expect(within(segmentCards[0] as HTMLElement).queryByText('已有转录')).toBeNull();
    expect(within(segmentCards[1] as HTMLElement).queryByText('本地音频')).toBeNull();
    expect(strip).toHaveAttribute(
      'style',
      expect.stringContaining('--memory-studio-segment-card-min-size: 136px')
    );
    expect(strip).toHaveAttribute(
      'style',
      expect.stringContaining(
        '--memory-studio-segment-card-size: clamp(var(--memory-studio-segment-card-min-size), 18vw, 148px)'
      )
    );
    expect(stripScroll).not.toHaveClass('px-44');
    expect(contentPanel).toHaveClass('flex-1', 'min-h-0');
    expect(transcriptScroll).toHaveClass('min-h-0', 'overflow-y-auto');
  });

  it('keeps timeline marker and time inside the same horizontal Segment item', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_segment_item_timeline',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const strip = within(studio).getByRole('region', { name: '片段预览流' });
    const activeItem = within(strip).getByRole('button', { name: '选择片段 Birthday candles' });
    const inactiveItem = within(strip).getByRole('button', { name: '选择片段 Birthday song' });

    expect(activeItem).toHaveAttribute('data-slot', 'memory-studio-segment-item');
    expect(activeItem).toHaveClass(
      'flex-[0_0_var(--memory-studio-segment-card-size)]',
      'snap-start',
      'flex-col'
    );
    expect(activeItem.querySelector('[data-slot="memory-studio-segment-card"]')).toBeTruthy();
    expect(
      activeItem.querySelector('[data-slot="memory-studio-segment-timeline-anchor"]')
    ).toHaveClass('before:top-[3px]');
    expect(
      activeItem.querySelector('[data-slot="memory-studio-segment-timeline-dot"]')
    ).toHaveClass('block', 'size-[7px]', 'min-h-[7px]', 'min-w-[7px]', 'rounded-full');
    expect(
      activeItem.querySelector('[data-slot="memory-studio-segment-timeline-time"]')
    ).toHaveClass('mt-12', 'block', 'text-slate');
    expect(
      activeItem.querySelector('[data-slot="memory-studio-segment-timeline-time"]')
    ).toHaveTextContent('13:08');
    expect(
      inactiveItem.querySelector('[data-slot="memory-studio-segment-timeline-time"]')
    ).toHaveTextContent('13:12');
    expect(within(studio).queryByRole('navigation', { name: 'Memory 片段时间轴' })).toBeNull();
  });

  it('renders Segment recording cards with balanced flat-vector waveform and mono duration', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_segment_card_visual_detail',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const activeCard = within(studio).getByRole('button', { name: '选择片段 Birthday candles' });
    const inactiveCard = within(studio).getByRole('button', { name: '选择片段 Birthday song' });

    expect(within(activeCard).queryByText('SEG 01')).toBeNull();
    expect(within(activeCard).queryByText('已有转录')).toBeNull();
    expect(within(inactiveCard).queryByText('本地音频')).toBeNull();
    expect(within(activeCard).getByText('Birthday candles')).toHaveClass(
      'text-body',
      'font-bold',
      'leading-body',
      'max-w-[88px]',
      'whitespace-normal'
    );
    expect(
      activeCard.querySelector('[data-slot="memory-studio-segment-card-duration"]')
    ).toHaveClass('shrink-0', 'font-geist-mono', 'text-ui-sm', 'font-bold', 'tracking-wide');
    expect(
      activeCard.querySelector('[data-slot="memory-studio-segment-card-waveform"]')
    ).toHaveClass('h-32', 'w-[52px]', 'gap-[2px]');

    const activeBars = activeCard.querySelectorAll(
      '[data-slot="memory-studio-segment-card-waveform"] span'
    );
    const inactiveBars = inactiveCard.querySelectorAll(
      '[data-slot="memory-studio-segment-card-waveform"] span'
    );

    expect(activeBars).toHaveLength(15);
    expect(inactiveBars).toHaveLength(15);
    expect(activeBars[0]).toHaveClass('w-[2px]', 'rounded-[2px]');
    expect(activeBars[0]).not.toHaveClass('rounded-tags');
    expect(activeBars[0]).toHaveStyle({
      animationName: 'reo-flat-wave',
      animationDelay: '0s',
      animationDirection: 'alternate',
      animationIterationCount: 'infinite',
      animationTimingFunction: 'ease-in-out',
      height: '30%',
    });
    expect(activeBars[8]).toHaveStyle({ animationDelay: '-0.8s', height: '90%' });
    expect(
      new Set(Array.from(activeBars, (bar) => (bar as HTMLElement).style.animationDuration)).size
    ).toBeGreaterThan(1);
    expect(inactiveBars[0]).not.toHaveStyle({ animationName: 'reo-flat-wave' });
  });

  it('does not repeat selected Segment summary above the player', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_no_repeated_segment_summary',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });

    expect(within(content).queryByRole('heading', { name: 'Birthday candles' })).toBeNull();
    expect(within(content).queryByText('audio · 02:05 · 已有转录')).toBeNull();
    expect(
      within(content).getByRole('button', { name: '播放片段 Birthday candles' })
    ).toBeInTheDocument();
  });

  it('uses the glass-vector contract for visible Memory Studio surfaces', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_glass_vector',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const glassVectorElements = [
      studio,
      studio.querySelector('[data-slot="memory-studio-layout"]'),
      ...Array.from(studio.querySelectorAll('[data-slot="memory-studio-segment-card"]')),
      studio.querySelector('[data-slot="memory-studio-content-panel"]'),
      studio.querySelector('[data-slot="memory-studio-player"]'),
      studio.querySelector('[data-slot="memory-studio-playback-waveform"]'),
      studio.querySelector('[data-slot="memory-studio-transcript-scroll"]'),
      within(studio).getByRole('button', { name: '播放片段 Birthday candles' }),
      within(studio).getByRole('button', { name: '添加片段补充内容' }),
    ];

    for (const element of glassVectorElements) {
      expectGlassVectorClass(element);
    }
  });

  it('keeps Memory Studio playback controls inside narrow surfaces without wrapping time', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_narrow_playback',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const player = studio.querySelector('[data-slot="memory-studio-player"]');
    const time = studio.querySelector('[data-slot="memory-studio-audio-player-time"]');

    expect(player).toHaveClass(
      'w-full',
      'min-w-0',
      'grid-cols-[40px_minmax(64px,1fr)_max-content]',
      'gap-12'
    );
    expect(time).toHaveClass('whitespace-nowrap');
  });

  it('syncs the Segment strip, timeline, and content selection inside the current Memory', async () => {
    const user = userEvent.setup();
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_segments',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const strip = within(studio).getByRole('region', { name: '片段预览流' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const birthdayItem = within(strip).getByRole('button', { name: '选择片段 Birthday candles' });
    const birthdaySongItem = within(strip).getByRole('button', { name: '选择片段 Birthday song' });

    expect(birthdayItem).toHaveAttribute('aria-current', 'true');
    expect(
      birthdayItem.querySelector('[data-slot="memory-studio-segment-timeline-dot"]')
    ).toHaveClass('bg-signal-blue');
    expect(
      within(content).getByRole('button', { name: '播放片段 Birthday candles' })
    ).toBeInTheDocument();

    await user.click(birthdaySongItem);

    expect(within(strip).getByRole('button', { name: '选择片段 Birthday song' })).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(
      within(strip).getByRole('button', { name: '选择片段 Birthday candles' })
    ).not.toHaveAttribute('aria-current');
    expect(
      birthdaySongItem.querySelector('[data-slot="memory-studio-segment-timeline-dot"]')
    ).toHaveClass('bg-signal-blue');
    expect(
      birthdayItem.querySelector('[data-slot="memory-studio-segment-timeline-dot"]')
    ).not.toHaveClass('bg-signal-blue');
    expect(
      within(content).getByRole('button', { name: '播放片段 Birthday song' })
    ).toBeInTheDocument();
    expect(within(content).queryByText('audio · 01:05 · 暂无转录')).toBeNull();
  });

  it('shows CarouselArrowButton only for reachable Segment strip overflow edges', async () => {
    const user = userEvent.setup();
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_carousel',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const strip = within(studio).getByRole('region', { name: '片段预览流' });
    const stripScroll = strip.querySelector('[data-slot="memory-studio-segment-strip-scroll"]');

    expect(stripScroll).toBeInstanceOf(HTMLElement);
    expect(
      within(strip).queryByRole('button', { name: '向左浏览片段卡片' })
    ).not.toBeInTheDocument();
    expect(
      within(strip).queryByRole('button', { name: '向右浏览片段卡片' })
    ).not.toBeInTheDocument();

    setScrollMetrics(stripScroll as HTMLElement, {
      clientWidth: 240,
      scrollLeft: 20,
      scrollWidth: 640,
    });
    fireEvent.scroll(stripScroll as HTMLElement);

    const rightButton = await within(strip).findByRole('button', { name: '向右浏览片段卡片' });
    expect(
      within(strip).queryByRole('button', { name: '向左浏览片段卡片' })
    ).not.toBeInTheDocument();

    const scrollTo = vi.fn((options?: ScrollToOptions | number) => {
      const left = typeof options === 'number' ? options : Number(options?.left ?? 0);
      setScrollMetrics(stripScroll as HTMLElement, {
        clientWidth: 240,
        scrollLeft: left,
        scrollWidth: 640,
      });
      fireEvent.scroll(stripScroll as HTMLElement);
    });
    (stripScroll as HTMLElement).scrollTo = scrollTo as HTMLElement['scrollTo'];

    await user.click(rightButton);

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'smooth', left: 212 });
    expect(
      within(strip).getByRole('button', { name: '选择片段 Birthday candles' })
    ).toHaveAttribute('aria-current', 'true');

    setScrollMetrics(stripScroll as HTMLElement, {
      clientWidth: 240,
      scrollLeft: 400,
      scrollWidth: 640,
    });
    fireEvent.scroll(stripScroll as HTMLElement);

    await waitFor(() => {
      expect(
        within(strip).queryByRole('button', { name: '向右浏览片段卡片' })
      ).not.toBeInTheDocument();
    });
    expect(within(strip).getByRole('button', { name: '向左浏览片段卡片' })).toBeInTheDocument();
  });

  it('uses instant Segment strip scrolling when reduced motion is requested', async () => {
    const user = userEvent.setup();
    const matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.stubGlobal('matchMedia', matchMedia);
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_reduced_motion',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const strip = within(studio).getByRole('region', { name: '片段预览流' });
    const stripScroll = strip.querySelector('[data-slot="memory-studio-segment-strip-scroll"]');
    expect(stripScroll).toBeInstanceOf(HTMLElement);
    setScrollMetrics(stripScroll as HTMLElement, {
      clientWidth: 240,
      scrollLeft: 20,
      scrollWidth: 640,
    });
    fireEvent.scroll(stripScroll as HTMLElement);
    const scrollTo = vi.fn();
    (stripScroll as HTMLElement).scrollTo = scrollTo as HTMLElement['scrollTo'];

    await user.click(await within(strip).findByRole('button', { name: '向右浏览片段卡片' }));

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'auto', left: 212 });
  });

  it('plays finalized audio and shows transcript content for the selected Segment', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:finalized-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const readFinalizedAudioSegment = vi.fn(
      async (request: {
        readonly memoryId: string;
        readonly requestId: string;
        readonly segmentId: string;
        readonly workspaceId: string;
      }) => ({
        ok: true,
        value: {
          requestId: request.requestId,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          audio: new Uint8Array([1, 2, 3]),
          audioByteLength: 3,
          transcript: {
            exists: true,
            text: 'Grandma lit the candles and everyone started singing.',
          },
        },
      })
    );
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      readFinalizedAudioSegment,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_playback',
      detail: birthdayDetail,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });

    expect(
      await within(content).findByText('Grandma lit the candles and everyone started singing.')
    ).toBeInTheDocument();
    expect(within(content).getByRole('slider', { name: '片段播放进度' })).toBeInTheDocument();
    expect(within(content).getByText('00:00 / 02:05')).toBeInTheDocument();
    expect(readFinalizedAudioSegment).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceHandle: 'workspace-handle-secret',
        workspaceId: 'ws_1',
        memoryId: 'mem_birthday',
        segmentId: 'seg_birthday_voice',
      })
    );

    await user.click(within(content).getByRole('button', { name: '播放片段 Birthday candles' }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(play).toHaveBeenCalledOnce();
    expect(
      within(content).getByRole('button', { name: '暂停片段 Birthday candles' })
    ).toBeInTheDocument();
  });

  it('announces playback slider value text and supports keyboard seek', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:keyboard-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const readFinalizedAudioSegment = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        transcript: {
          exists: true,
          text: 'Keyboard access should move the playback cursor.',
        },
      },
    }));
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      readFinalizedAudioSegment,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_slider_a11y',
      detail: birthdayDetail,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const slider = await within(studio).findByRole('slider', { name: '片段播放进度' });
    expect(slider).toHaveAttribute('aria-orientation', 'horizontal');
    expect(slider).toHaveAttribute('aria-valuetext', '00:00 / 02:05');
    await waitFor(() => {
      expect(slider).toHaveAttribute('tabindex', '0');
    });

    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(slider).toHaveAttribute('aria-valuenow', '5000');
      expect(slider).toHaveAttribute('aria-valuetext', '00:05 / 02:05');
    });
  });

  it('builds the playback waveform from decoded finalized audio bytes instead of static data', async () => {
    const audioSamples = Float32Array.from([0, 0.2, -0.6, 0.1, 0.9, -0.4, 0.05, -0.8]);
    const decodeAudioData = vi.fn(async (_audioData: ArrayBuffer) => ({
      length: audioSamples.length,
      numberOfChannels: 1,
      getChannelData: () => audioSamples,
    }));
    const close = vi.fn(async () => undefined);
    const AudioContextMock = vi.fn(function MockAudioContext() {
      return { close, decodeAudioData };
    });
    vi.stubGlobal('AudioContext', AudioContextMock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:decoded-finalized-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      readFinalizedAudioSegment: vi.fn(async (request) => ({
        ok: true,
        value: {
          requestId: request.requestId,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          audio: new Uint8Array([8, 7, 6, 5]),
          audioByteLength: 4,
          transcript: {
            exists: true,
            text: 'A decoded waveform belongs to the actual finalized audio bytes.',
          },
        },
      })),
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_real_waveform',
      detail: birthdayDetail,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const waveform = await within(studio).findByRole('slider', { name: '片段播放进度' });

    await waitFor(() => {
      expect(waveform).toHaveAttribute('data-waveform-source', 'decoded-audio');
    });
    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(decodeAudioData).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    expect(close).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('scopes the transcript tab and SegmentAttachment menu to the selected Segment', async () => {
    const user = userEvent.setup();
    const onStartSegmentAttachmentRecording = vi.fn();
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      onStartSegmentAttachmentRecording,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_tabs',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });

    const tabs = within(content).getByRole('tablist', { name: '片段内容类型' });
    expect(within(tabs).getByRole('tab', { name: '转录' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(within(tabs).queryByRole('tab', { name: '笔记' })).toBeNull();
    expect(within(tabs).queryByRole('tab', { name: '视频' })).toBeNull();
    expect(within(tabs).queryByRole('tab', { name: '图片' })).toBeNull();

    await user.click(within(content).getByRole('button', { name: '添加片段补充内容' }));

    const menu = await screen.findByRole('menu', { name: '片段补充内容' });
    const recordingAttachmentAction = within(menu).getByRole('menuitem', { name: '录音补充' });
    expect(recordingAttachmentAction).not.toHaveAttribute('data-disabled');
    await user.click(recordingAttachmentAction);

    expect(onStartSegmentAttachmentRecording).toHaveBeenCalledWith({
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
    });

    await user.click(within(studio).getByRole('button', { name: '选择片段 Birthday song' }));

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: '片段补充内容' })).not.toBeInTheDocument();
    });
    expect(
      within(content).getByRole('button', { name: '播放片段 Birthday song' })
    ).toBeInTheDocument();
    expect(within(tabs).getAllByRole('tab')).toHaveLength(1);
  });

  it('shows finalized recording supplements in a Supplement tab with playback and waveform controls', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:attachment-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const readFinalizedAudioSegmentAttachment = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        attachmentId: request.attachmentId,
        audio: new Uint8Array([7, 8, 9]),
        audioByteLength: 3,
      },
    }));
    const session = workspaceSession({ memories: [{ ...birthdayMemory, attachmentCount: 1 }] });
    const detailWithSupplement = {
      ...birthdayDetail,
      attachmentCount: 1,
      segments: [
        {
          ...birthdayDetail.segments[0],
          attachmentCount: 1,
          attachments: [
            {
              workspaceId: 'ws_1',
              memoryId: 'mem_birthday',
              segmentId: 'seg_birthday_voice',
              attachmentId: 'att_birthday_followup',
              type: 'audio',
              title: '补充录音',
              createdAt: '2026-05-06T13:11:00.000',
              updatedAt: '2026-05-06T13:11:05.000',
              durationMs: 5_000,
              audioByteLength: 3,
              transcript: { exists: false },
            },
          ],
        },
      ],
    };
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      readFinalizedAudioSegmentAttachment,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_attachment_tab',
      detail: detailWithSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const primaryPlayback = content.querySelector('[data-slot="memory-studio-player"]');
    const tabs = within(content).getByRole('tablist', { name: '片段内容类型' });

    expect(primaryPlayback).toHaveAttribute('data-component', 'memory-studio-audio-player');
    expect(within(tabs).getByRole('tab', { name: '转录' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await userEvent.click(within(tabs).getByRole('tab', { name: '补充' }));

    const supplements = await within(content).findByRole('region', { name: '片段补充内容' });
    expect(within(supplements).queryByText('这段录音还没有转录。')).not.toBeInTheDocument();
    expect(
      within(supplements).getByRole('button', { name: '播放补充录音 补充录音' })
    ).toBeInTheDocument();
    const supplementPlayback = supplements.querySelector(
      '[data-slot="memory-studio-attachment-player"]'
    );
    expect(supplementPlayback).toHaveAttribute('data-component', 'memory-studio-audio-player');
    expect(supplementPlayback).toHaveClass(
      'grid',
      'w-full',
      'min-w-0',
      'grid-cols-[40px_minmax(64px,1fr)_max-content]',
      'items-center',
      'gap-12'
    );
    expect(within(supplements).getByRole('slider', { name: '补充录音播放进度' })).toHaveAttribute(
      'aria-valuetext',
      '00:00 / 00:05'
    );
    expect(within(supplements).getByText('00:00 / 00:05')).toBeInTheDocument();
    expect(readFinalizedAudioSegmentAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceHandle: 'workspace-handle-secret',
        workspaceId: 'ws_1',
        memoryId: 'mem_birthday',
        segmentId: 'seg_birthday_voice',
        attachmentId: 'att_birthday_followup',
      })
    );

    play.mockClear();
    await userEvent.click(
      within(supplements).getByRole('button', { name: '播放补充录音 补充录音' })
    );

    expect(play).toHaveBeenCalledOnce();
    expect(
      within(supplements).getByRole('button', { name: '暂停补充录音 补充录音' })
    ).toBeInTheDocument();
  });

  it('moves newly created SegmentAttachment recordings into the Supplement tab when they first appear', async () => {
    const session = workspaceSession({ memories: [{ ...birthdayMemory, attachmentCount: 1 }] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_before_attachment',
      detail: birthdayDetail,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    expect(within(content).getByRole('tab', { name: '转录' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(within(content).queryByRole('tab', { name: '补充' })).toBeNull();

    act(() => {
      queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
        requestId: 'request_mem_birthday_after_attachment',
        detail: {
          ...birthdayDetail,
          attachmentCount: 1,
          segments: [
            {
              ...birthdayDetail.segments[0],
              attachmentCount: 1,
              attachments: [
                {
                  workspaceId: 'ws_1',
                  memoryId: 'mem_birthday',
                  segmentId: 'seg_birthday_voice',
                  attachmentId: 'att_new_followup',
                  type: 'audio',
                  title: '补充录音',
                  createdAt: '2026-05-06T13:12:00.000',
                  updatedAt: '2026-05-06T13:12:04.000',
                  durationMs: 4_000,
                  audioByteLength: 4,
                  transcript: { exists: false },
                },
              ],
            },
          ],
        },
      });
    });

    await waitFor(() => {
      expect(within(content).getByRole('tab', { name: '补充' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
    expect(within(content).getByRole('region', { name: '片段补充内容' })).toBeInTheDocument();
    expect(within(content).queryByText('这段录音还没有转录。')).not.toBeInTheDocument();
    expect(await within(content).findByRole('status')).toHaveTextContent('补充录音加载失败。');
  });

  it('opens the Memory rename action from a compact card menu', async () => {
    const user = userEvent.setup();
    const onRenameMemory = vi.fn();

    renderLoadedWorkspaceFrame({
      onRenameMemory,
      session: workspaceSession({ memories: [birthdayMemory] }),
    });

    await user.click(screen.getByRole('button', { name: 'My seventh birthday 更多操作' }));
    expect(screen.getByRole('menu', { name: 'My seventh birthday 更多操作' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: '重命名记忆' }));

    expect(onRenameMemory).toHaveBeenCalledWith(birthdayMemory);
  });

  it('can hide the right-side Memory rail without turning the workspace stage into a timeline', () => {
    renderLoadedWorkspaceFrame({
      memoryRailOpen: false,
      session: workspaceSession({
        memories: [birthdayMemory],
      }),
    });

    expect(screen.queryByRole('navigation', { name: '记忆列表' })).not.toBeInTheDocument();
    const railShell = document.querySelector('[data-slot="workspace-memory-rail-shell"]');
    const stageShell = document.querySelector('[data-slot="workspace-stage-shell"]');
    expect(railShell).toHaveAttribute('aria-hidden', 'true');
    expect(railShell).toHaveAttribute('inert');
    expect(railShell).toHaveClass('absolute', 'right-0', 'w-[var(--workspace-memory-rail-width)]');
    expect(railShell).toHaveClass('translate-x-full', 'opacity-0', 'pointer-events-none');
    expect(stageShell).toHaveClass('pr-24', 'sm:pr-40', 'xl:pr-40');
    expect(document.querySelector('[data-slot="workspace-expression-fab-layer"]')).toHaveClass(
      'right-24',
      'sm:right-40',
      'xl:right-40'
    );
    expect(screen.getByRole('region', { name: '记忆空间舞台' })).toBeInTheDocument();
    expect(screen.queryByText('片段时间线')).not.toBeInTheDocument();
  });

  it('renders the Memory rail from the TanStack Query snapshot cache', async () => {
    const session = workspaceSession({
      memories: [morningMemory],
    });
    const { queryClient } = renderLoadedWorkspaceFrame({ session });

    queryClient.setQueryData(workspaceSnapshotQueryKey(session), {
      ...session.snapshot,
      memories: [birthdayMemory],
    });

    expect(
      await screen.findByRole('button', { name: '选择记忆 My seventh birthday' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '选择记忆 Morning note' })).not.toBeInTheDocument();
  });
});

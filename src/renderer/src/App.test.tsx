import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, mergeMemoryIntoSession } from './App';
import { ReoQueryProvider } from './queryClient';

describe('App', () => {
  const reoWorkspace = {
    chooseDirectory: vi.fn(),
    listMemorySpaces: vi.fn(),
    initializeWorkspace: vi.fn(),
    openWorkspace: vi.fn(),
    openMemorySpace: vi.fn(),
    removeMemorySpace: vi.fn(),
    closeWorkspace: vi.fn(),
    createMemory: vi.fn(),
    deleteMemory: vi.fn(),
    restoreDeletedMemory: vi.fn(),
    readMemoryDetail: vi.fn(),
    readFinalizedAudioSegment: vi.fn(),
    createRecordingDraft: vi.fn(),
    createSegmentAttachmentRecordingDraft: vi.fn(),
    readRecordingDraftAudio: vi.fn(),
    appendRecordingAudioChunk: vi.fn(),
    appendSegmentAttachmentRecordingAudioChunk: vi.fn(),
    cloneRecordingDraftPrefix: vi.fn(),
    finalizeRecordingDraft: vi.fn(),
    finalizeSegmentAttachmentRecordingDraft: vi.fn(),
    discardRecordingDraft: vi.fn(),
    discardSegmentAttachmentRecordingDraft: vi.fn(),
    updateMemoryTitle: vi.fn(),
    saveTranscript: vi.fn(),
    beginMicrophoneIntent: vi.fn(),
    clearMicrophoneIntent: vi.fn(),
    startRecordingTranscription: vi.fn(),
    sendRecordingTranscriptionAudio: vi.fn(),
    finishRecordingTranscription: vi.fn(),
    closeRecordingTranscription: vi.fn(),
    onRecordingTranscriptionEvent: vi.fn(),
  };

  function installRecordingBrowserMocks() {
    class FakeMediaRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;
      state: 'inactive' | 'paused' | 'recording' = 'inactive';

      pause() {
        this.state = 'paused';
      }

      resume() {
        this.state = 'recording';
      }

      start() {
        this.state = 'recording';
        queueMicrotask(() => {
          if (this.state === 'recording') {
            this.ondataavailable?.({ data: new Blob([new Uint8Array([1])]) } as BlobEvent);
          }
        });
      }

      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob([new Uint8Array([1])]) } as BlobEvent);
        this.onstop?.();
      }
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getAudioTracks: () => [{ stop: vi.fn(), enabled: true }],
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: FakeMediaRecorder,
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    reoWorkspace.listMemorySpaces.mockResolvedValue({ ok: true, value: { memorySpaces: [] } });
    reoWorkspace.removeMemorySpace.mockResolvedValue({ ok: true, value: { removed: true } });
    reoWorkspace.closeWorkspace.mockResolvedValue({ ok: true, value: { closed: true } });
    reoWorkspace.createMemory.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_MEMORY_CREATE_FAILED', message: 'Memory could not be created' },
    });
    reoWorkspace.deleteMemory.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_MEMORY_DELETE_FAILED', message: 'Memory could not be deleted' },
    });
    reoWorkspace.restoreDeletedMemory.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_MEMORY_RESTORE_FAILED', message: 'Memory could not be restored' },
    });
    reoWorkspace.updateMemoryTitle.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_MEMORY_NOT_FOUND', message: 'Memory not found' },
    });
    reoWorkspace.readMemoryDetail.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_MEMORY_NOT_FOUND', message: 'Memory not found' },
    });
    reoWorkspace.readRecordingDraftAudio.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_RECORDING_NOT_FOUND', message: 'Recording draft not found' },
    });
    reoWorkspace.createSegmentAttachmentRecordingDraft.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_RECORDING_NOT_FOUND', message: 'Segment not found' },
    });
    reoWorkspace.appendSegmentAttachmentRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.finalizeSegmentAttachmentRecordingDraft.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_RECORDING_FINALIZE_FAILED', message: 'Attachment could not be saved' },
    });
    reoWorkspace.discardSegmentAttachmentRecordingDraft.mockResolvedValue({
      ok: true,
      value: { discarded: true },
    });
    reoWorkspace.startRecordingTranscription.mockResolvedValue({
      ok: true,
      value: { accepted: true },
    });
    reoWorkspace.sendRecordingTranscriptionAudio.mockResolvedValue({
      ok: true,
      value: { accepted: true },
    });
    reoWorkspace.finishRecordingTranscription.mockResolvedValue({
      ok: true,
      value: { accepted: true },
    });
    reoWorkspace.closeRecordingTranscription.mockResolvedValue({
      ok: true,
      value: { accepted: true },
    });
    reoWorkspace.onRecordingTranscriptionEvent.mockReturnValue(() => {});
    Object.defineProperty(window, 'reoWorkspace', {
      configurable: true,
      value: reoWorkspace,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function openCreateWorkspaceDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));
    await user.click(screen.getByRole('menuitem', { name: '创建本地记忆空间' }));
  }

  async function expandMemoryRail(user: ReturnType<typeof userEvent.setup>) {
    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    const expandButton = within(titlebar).queryByRole('button', { name: '展开记忆列表' });

    if (expandButton) {
      await user.click(expandButton);
    }
  }

  function stubWorkspaceRailInlineMedia(matches: boolean) {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQueryList = {
      matches,
      media: '(min-width: 1100px)',
      onchange: null,
      addEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          listeners.add(listener);
        }
      }),
      removeEventListener: vi.fn(
        (event: string, listener: (event: MediaQueryListEvent) => void) => {
          if (event === 'change') {
            listeners.delete(listener);
          }
        }
      ),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        ...mediaQueryList,
        matches: query === mediaQueryList.media ? mediaQueryList.matches : false,
        media: query,
      }))
    );
    return {
      setMatches(nextMatches: boolean) {
        mediaQueryList.matches = nextMatches;
        for (const listener of listeners) {
          listener({ matches: nextMatches, media: mediaQueryList.media } as MediaQueryListEvent);
        }
      },
    };
  }

  function audioSegmentProjection({
    audioByteLength,
    createdAt = '2026-05-09T10:00:00.000Z',
    durationMs,
    memoryId,
    segmentId,
    title,
    transcriptExists = false,
    updatedAt = createdAt,
    workspaceId = 'ws_1',
  }: {
    readonly audioByteLength: number;
    readonly createdAt?: string;
    readonly durationMs: number;
    readonly memoryId: string;
    readonly segmentId: string;
    readonly title: string;
    readonly transcriptExists?: boolean;
    readonly updatedAt?: string;
    readonly workspaceId?: string;
  }) {
    return {
      workspaceId,
      memoryId,
      segmentId,
      type: 'audio' as const,
      title,
      createdAt,
      updatedAt,
      durationMs,
      audioByteLength,
      transcript: { exists: transcriptExists },
      attachmentCount: 0,
      attachments: [],
    };
  }

  it('renders starter home without a page plus and opens creation from the sidebar entry', async () => {
    const user = userEvent.setup();
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    expect(screen.getByRole('navigation', { name: '记忆空间' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '今天想记录些什么？' })).not.toBeInTheDocument();
    expect(
      screen.queryByText('Create a local workspace to start collecting memories.')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '创建本地记忆空间' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '创建记忆空间' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新记忆' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '资料库' })).toBeInTheDocument();
    await openCreateWorkspaceDialog(user);

    expect(screen.getByRole('dialog', { name: '创建本地记忆空间' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '添加记忆空间' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('记忆空间名称')).toHaveFocus();
    expect(screen.queryByText(/photo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/video/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/file/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/film/i)).not.toBeInTheDocument();
  });

  it('opens the workspace library page from the sidebar', async () => {
    const user = userEvent.setup();
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(screen.getByRole('button', { name: '资料库' }));

    expect(screen.getByRole('heading', { name: '资料库' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '今天想记录些什么？' })).not.toBeInTheDocument();
  });

  it('moves to a loaded workspace state after successful initialization', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(screen.getByRole('button', { name: '切换到深色模式' }));
    expect(
      screen.getByRole('main', { name: '记忆空间内容' }).closest('[data-theme]')
    ).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();
    expect(
      screen.getByRole('main', { name: '记忆空间内容' }).closest('[data-theme]')
    ).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    expect(within(titlebar).getByText('Daily memory')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '记忆空间栏' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '记忆空间' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: '记忆空间内容' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '记忆空间舞台' })).toBeInTheDocument();
    expect(within(titlebar).getByRole('button', { name: '展开记忆列表' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByRole('navigation', { name: '记忆列表' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '表达入口' })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: '搜索记忆' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '记忆' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '收藏' })).not.toBeInTheDocument();
    expect(screen.queryByText('workspace-handle-1')).not.toBeInTheDocument();
  });

  it('uses the titlebar Memory control to collapse and expand the workspace Memory list', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('heading', { name: '今天想记录些什么？' });

    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    const expandButton = within(titlebar).getByRole('button', { name: '展开记忆列表' });
    const sidebarToggleControls = within(titlebar).getByRole('group', { name: '窗口控制' });
    const titlebarContent = titlebar.querySelector(
      '[data-slot="app-shell-panel-titlebar-content"]'
    );
    const railShell = document.querySelector('[data-slot="workspace-memory-rail-shell"]');
    const stageShell = document.querySelector('[data-slot="workspace-stage-shell"]');
    expect(titlebarContent).toHaveStyle({ left: '240px' });
    expect(titlebarContent).toHaveStyle({
      top: 'calc(var(--spacing-titlebar-control-top) + ((var(--spacing-titlebar-control-size) - var(--spacing-titlebar)) / 2))',
    });
    expect(expandButton).toHaveAttribute('aria-controls', 'workspace-memory-rail');
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: '记忆列表' })).not.toBeInTheDocument();
    expect(railShell).toHaveAttribute('data-rail-mode', 'inline');
    expect(railShell).toHaveAttribute('aria-hidden', 'true');
    expect(stageShell).toHaveClass('pr-24', 'sm:pr-40', 'xl:pr-40');

    await user.click(expandButton);

    expect(screen.getByRole('navigation', { name: '记忆列表' })).toBeInTheDocument();
    expect(railShell).toHaveAttribute('aria-hidden', 'false');
    expect(railShell).toHaveClass('border-l', 'border-glass-border');
    expect(stageShell).toHaveClass('pr-[var(--workspace-memory-rail-stage-inset)]');

    await user.click(within(titlebar).getByRole('button', { name: '隐藏侧边栏' }));
    expect(sidebarToggleControls).toHaveStyle({
      left: 'var(--spacing-titlebar-control-left)',
    });
    expect(titlebarContent).toHaveStyle({
      left: 'calc(var(--spacing-titlebar-control-left) + var(--spacing-titlebar-control-size) + var(--spacing-titlebar-control-gap) - var(--spacing-panel-titlebar-x))',
    });

    const collapseButton = within(titlebar).getByRole('button', { name: '折叠记忆列表' });
    await user.click(collapseButton);

    expect(screen.queryByRole('navigation', { name: '记忆列表' })).not.toBeInTheDocument();
    const expandButtonAfterCollapse = within(titlebar).getByRole('button', {
      name: '展开记忆列表',
    });
    expect(expandButtonAfterCollapse).toHaveAttribute('aria-controls', 'workspace-memory-rail');
    expect(expandButtonAfterCollapse).toHaveAttribute('aria-expanded', 'false');

    await user.click(expandButtonAfterCollapse);

    expect(screen.getByRole('navigation', { name: '记忆列表' })).toBeInTheDocument();
  });

  it('defaults the Memory rail to an overlay-closed state on compact workspace widths', async () => {
    const media = stubWorkspaceRailInlineMedia(false);
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('heading', { name: '今天想记录些什么？' });

    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    const stageShell = document.querySelector('[data-slot="workspace-stage-shell"]');
    const railShell = document.querySelector('[data-slot="workspace-memory-rail-shell"]');
    expect(within(titlebar).getByRole('button', { name: '展开记忆列表' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(railShell).toHaveAttribute('data-rail-mode', 'overlay');
    expect(railShell).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('navigation', { name: '记忆列表' })).not.toBeInTheDocument();
    expect(stageShell).toHaveClass('pr-24', 'sm:pr-40', 'xl:pr-40');
    expect(stageShell).not.toHaveClass('pr-[var(--workspace-memory-rail-stage-inset)]');

    await user.click(within(titlebar).getByRole('button', { name: '展开记忆列表' }));

    expect(screen.getByRole('navigation', { name: '记忆列表' })).toBeInTheDocument();
    expect(railShell).toHaveAttribute('data-rail-mode', 'overlay');
    expect(railShell).toHaveAttribute('aria-hidden', 'false');
    expect(stageShell).toHaveClass('pr-24', 'sm:pr-40', 'xl:pr-40');
    expect(stageShell).not.toHaveClass('pr-[var(--workspace-memory-rail-stage-inset)]');

    act(() => {
      media.setMatches(true);
    });

    expect(within(titlebar).getByRole('button', { name: '折叠记忆列表' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('navigation', { name: '记忆列表' })).toBeInTheDocument();
    expect(railShell).toHaveAttribute('data-rail-mode', 'inline');
    expect(railShell).toHaveAttribute('aria-hidden', 'false');
    expect(stageShell).toHaveClass('pr-[var(--workspace-memory-rail-stage-inset)]');
  });

  it('renames a Memory container from the right rail menu', async () => {
    const user = userEvent.setup();
    const originalMemory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      segmentCount: 2,
      durationMs: 125_000,
      audioByteLength: 2048,
      hasTranscript: true,
      attachmentCount: 0,
    };
    const renamedMemory = {
      ...originalMemory,
      title: '产品灵感与思考',
      updatedAt: '2026-05-08T14:42:00.000Z',
    };
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [originalMemory],
        },
      },
    });
    reoWorkspace.updateMemoryTitle.mockResolvedValue({
      ok: true,
      value: renamedMemory,
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await expandMemoryRail(user);
    await screen.findByRole('button', { name: '选择记忆 My seventh birthday' });

    await user.click(screen.getByRole('button', { name: 'My seventh birthday 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '重命名记忆' }));

    const dialog = screen.getByRole('dialog', { name: '重命名记忆' });
    const titleInput = within(dialog).getByLabelText('记忆名称');
    expect(titleInput).toHaveValue('My seventh birthday');
    await user.clear(titleInput);
    await user.type(titleInput, '产品灵感与思考');
    await user.click(within(dialog).getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(reoWorkspace.updateMemoryTitle).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        memoryId: 'mem_birthday',
        title: '产品灵感与思考',
      })
    );
    expect(screen.getByRole('button', { name: '选择记忆 产品灵感与思考' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '重命名记忆' })).not.toBeInTheDocument();
  });

  it('confirms Memory deletion, removes it from the current Studio, and restores it from undo', async () => {
    const user = userEvent.setup();
    const deletedMemory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      segmentCount: 2,
      durationMs: 125_000,
      audioByteLength: 2048,
      hasTranscript: true,
      attachmentCount: 0,
    };
    const remainingMemory = {
      memoryId: 'mem_morning',
      title: 'Morning note',
      createdAt: '2026-05-07T09:00:00.000Z',
      updatedAt: '2026-05-07T09:10:00.000Z',
      segmentCount: 1,
      durationMs: 30_000,
      audioByteLength: 512,
      hasTranscript: false,
      attachmentCount: 0,
    };
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [deletedMemory, remainingMemory],
        },
      },
    });
    reoWorkspace.deleteMemory.mockResolvedValue({
      ok: true,
      value: {
        memoryId: deletedMemory.memoryId,
        restoreToken: 'mem_birthday',
        memories: [remainingMemory],
      },
    });
    reoWorkspace.restoreDeletedMemory.mockResolvedValue({
      ok: true,
      value: {
        memory: deletedMemory,
        memories: [deletedMemory, remainingMemory],
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await expandMemoryRail(user);
    await screen.findByRole('button', { name: '选择记忆 My seventh birthday' });

    await user.click(screen.getByRole('button', { name: 'My seventh birthday 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '删除记忆' }));

    const dialog = screen.getByRole('dialog', { name: '删除记忆' });
    expect(within(dialog).getByText('My seventh birthday')).toBeInTheDocument();
    expect(within(dialog).getByText('片段和补充录音会先进入恢复区。')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '删除' }));

    await waitFor(() =>
      expect(reoWorkspace.deleteMemory).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        memoryId: 'mem_birthday',
      })
    );
    expect(screen.queryByRole('button', { name: '选择记忆 My seventh birthday' })).toBeNull();
    expect(screen.getByRole('button', { name: '选择记忆 Morning note' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(await screen.findByText('已删除记忆')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '恢复' }));

    await waitFor(() =>
      expect(reoWorkspace.restoreDeletedMemory).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        restoreToken: 'mem_birthday',
      })
    );
    expect(
      await screen.findByRole('button', { name: '选择记忆 My seventh birthday' })
    ).toHaveAttribute('aria-current', 'page');
  });

  it('creates a named Memory from the titlebar plus control and opens it', async () => {
    const user = userEvent.setup();
    const createdMemory = {
      memoryId: 'mem_created',
      title: '产品灵感与思考',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentCount: 0,
      durationMs: 0,
      audioByteLength: 0,
      hasTranscript: false,
      attachmentCount: 0,
    };
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [],
        },
      },
    });
    reoWorkspace.createMemory.mockResolvedValue({
      ok: true,
      value: createdMemory,
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    await user.click(within(titlebar).getByRole('button', { name: '新建记忆' }));

    const dialog = screen.getByRole('dialog', { name: '新建记忆' });
    const titleInput = within(dialog).getByLabelText('记忆名称');
    expect(titleInput).toHaveFocus();
    await user.type(titleInput, '产品灵感与思考');
    await user.click(within(dialog).getByRole('button', { name: '创建' }));

    await waitFor(() =>
      expect(reoWorkspace.createMemory).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        title: '产品灵感与思考',
      })
    );
    await expandMemoryRail(user);
    expect(screen.getByRole('button', { name: '选择记忆 产品灵感与思考' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '产品灵感与思考' })).toBeInTheDocument();
  });

  it('records from the loaded workspace FAB into the current existing Memory', async () => {
    const user = userEvent.setup();
    installRecordingBrowserMocks();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [
            {
              memoryId: 'mem_existing',
              title: 'Existing memory',
              createdAt: '2026-05-07T14:30:00.000Z',
              updatedAt: '2026-05-07T14:30:00.000Z',
              segmentCount: 1,
              durationMs: 1,
              audioByteLength: 1,
              hasTranscript: false,
              attachmentCount: 0,
            },
          ],
        },
      },
    });
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.clearMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { cleared: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, segmentId: 'seg_1' },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          audioByteLength: 1,
          createdAt: '2026-05-07T14:30:00.000Z',
          durationMs: 1,
          attachmentCount: 0,
          hasTranscript: false,
          memoryId: 'mem_existing',
          segmentCount: 2,
          title: 'Existing memory',
          updatedAt: '2026-05-08T14:30:01.000Z',
        },
        segment: audioSegmentProjection({
          audioByteLength: 1,
          createdAt: '2026-05-08T14:30:00.000Z',
          durationMs: 1,
          memoryId: 'mem_existing',
          segmentId: 'seg_1',
          title: 'Daily memory 录音',
          updatedAt: '2026-05-08T14:30:01.000Z',
        }),
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await user.click(await screen.findByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));

    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '新建记忆' })).not.toBeInTheDocument();
    expect(reoWorkspace.createMemory).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await user.click(screen.getByRole('button', { name: '停止录音' }));
    await user.click(screen.getByRole('button', { name: '停止录音' }));

    await waitFor(() => expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledOnce());
    const finalizePayload = reoWorkspace.finalizeRecordingDraft.mock.calls[0]?.[0];
    expect(finalizePayload).toMatchObject({
      segmentId: 'seg_1',
      title: 'Daily memory 录音',
      workspaceHandle: 'workspace-handle-1',
      memoryId: 'mem_existing',
    });
  });

  it('requires a named Memory before recording when the workspace has no memories', async () => {
    const user = userEvent.setup();
    installRecordingBrowserMocks();
    const createdMemory = {
      memoryId: 'mem_recording_target',
      title: '第一条记忆',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentCount: 0,
      durationMs: 0,
      audioByteLength: 0,
      hasTranscript: false,
      attachmentCount: 0,
    };
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [],
        },
      },
    });
    reoWorkspace.createMemory.mockResolvedValue({
      ok: true,
      value: createdMemory,
    });
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.clearMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { cleared: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, segmentId: 'seg_1' },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...createdMemory,
          audioByteLength: 1,
          durationMs: 1,
          segmentCount: 1,
          updatedAt: '2026-05-08T14:42:01.000Z',
        },
        segment: audioSegmentProjection({
          audioByteLength: 1,
          createdAt: '2026-05-08T14:42:00.000Z',
          durationMs: 1,
          memoryId: 'mem_recording_target',
          segmentId: 'seg_1',
          title: 'Daily memory 录音',
          updatedAt: '2026-05-08T14:42:01.000Z',
        }),
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await user.click(await screen.findByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));

    expect(screen.queryByRole('dialog', { name: '录音' })).not.toBeInTheDocument();
    const createDialog = screen.getByRole('dialog', { name: '新建记忆' });
    await user.type(within(createDialog).getByLabelText('记忆名称'), '第一条记忆');
    await user.click(within(createDialog).getByRole('button', { name: '开始录音' }));

    await waitFor(() =>
      expect(reoWorkspace.createMemory).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        title: '第一条记忆',
      })
    );
    expect(await screen.findByRole('dialog', { name: '录音' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await user.click(screen.getByRole('button', { name: '停止录音' }));
    await user.click(screen.getByRole('button', { name: '停止录音' }));

    await waitFor(() => expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledOnce());
    expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        memoryId: 'mem_recording_target',
        segmentId: 'seg_1',
        workspaceHandle: 'workspace-handle-1',
      })
    );
  });

  it('offers to save a recoverable unfinished recording after reopening a workspace', async () => {
    const user = userEvent.setup();
    const recoveredMemory = {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-07T14:30:00.000Z',
      updatedAt: '2026-05-07T14:30:00.000Z',
      segmentCount: 1,
      durationMs: 1,
      audioByteLength: 1,
      hasTranscript: false,
      attachmentCount: 0,
    };
    window.localStorage.setItem(
      'reo.recordingRecovery.v1.ws_1',
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        segmentId: 'seg_recoverable',
        title: 'Daily memory 录音',
        durationMs: 3720,
        transcriptSegments: [
          {
            endTimeMs: 3000,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '恢复后直接保存的转写内容',
          },
        ],
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:03.720Z',
      })
    );
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [recoveredMemory],
        },
      },
    });
    reoWorkspace.saveTranscript.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          segmentCount: 2,
          durationMs: 3721,
          audioByteLength: 24,
          hasTranscript: true,
          updatedAt: '2026-05-09T10:00:05.000Z',
        },
        saved: true,
      },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          segmentCount: 2,
          durationMs: 3721,
          audioByteLength: 24,
          updatedAt: '2026-05-09T10:00:04.000Z',
        },
        segment: audioSegmentProjection({
          audioByteLength: 23,
          createdAt: '2026-05-09T10:00:00.000Z',
          durationMs: 3720,
          memoryId: 'mem_existing',
          segmentId: 'seg_recoverable',
          title: 'Daily memory 录音',
          updatedAt: '2026-05-09T10:00:04.000Z',
        }),
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const recoveryDialog = await screen.findByRole('dialog', { name: '未完成录音' });
    expect(within(recoveryDialog).getByText('检测到一段未完成的录音。')).toBeInTheDocument();
    await user.click(within(recoveryDialog).getByRole('button', { name: '保存录音' }));

    await waitFor(() =>
      expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        memoryId: 'mem_existing',
        segmentId: 'seg_recoverable',
        title: 'Daily memory 录音',
        durationMs: 3720,
      })
    );
    await waitFor(() =>
      expect(reoWorkspace.saveTranscript).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        memoryId: 'mem_existing',
        segmentId: 'seg_recoverable',
        markdown: '恢复后直接保存的转写内容',
      })
    );
    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).toBeNull();
    expect(await screen.findByText('2 个片段 · 00:03')).toBeInTheDocument();
  });

  it('recovers an unfinished SegmentAttachment recording through attachment IPC', async () => {
    const user = userEvent.setup();
    const recoveredMemory = {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-07T14:30:00.000Z',
      updatedAt: '2026-05-07T14:30:00.000Z',
      segmentCount: 1,
      durationMs: 1,
      audioByteLength: 1,
      hasTranscript: false,
      attachmentCount: 0,
    };
    window.localStorage.setItem(
      'reo.recordingRecovery.v1.ws_1',
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        parentSegmentId: 'seg_parent',
        segmentId: 'att_recoverable',
        targetKind: 'segment-attachment',
        title: '补充录音',
        durationMs: 3720,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:03.720Z',
      })
    );
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [recoveredMemory],
        },
      },
    });
    reoWorkspace.finalizeSegmentAttachmentRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          attachmentCount: 1,
          updatedAt: '2026-05-09T10:00:04.000Z',
        },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_existing',
          segmentId: 'seg_parent',
          type: 'audio',
          title: 'Parent recording',
          createdAt: '2026-05-07T14:30:00.000Z',
          updatedAt: '2026-05-09T10:00:04.000Z',
          durationMs: 1,
          audioByteLength: 1,
          transcript: { exists: false },
          attachmentCount: 1,
        },
        attachment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_existing',
          segmentId: 'seg_parent',
          attachmentId: 'att_recoverable',
          type: 'audio',
          title: '补充录音',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:04.000Z',
          durationMs: 3720,
          audioByteLength: 23,
          transcript: { exists: false },
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const recoveryDialog = await screen.findByRole('dialog', { name: '未完成录音' });
    expect(within(recoveryDialog).queryByRole('button', { name: '继续检查' })).toBeNull();
    await user.click(within(recoveryDialog).getByRole('button', { name: '保存录音' }));

    await waitFor(() =>
      expect(reoWorkspace.finalizeSegmentAttachmentRecordingDraft).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        segmentId: 'seg_parent',
        attachmentId: 'att_recoverable',
        title: '补充录音',
        durationMs: 3720,
      })
    );
    expect(reoWorkspace.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(reoWorkspace.saveTranscript).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).toBeNull();
    expect(await screen.findByText('1 个片段 · 00:00')).toBeInTheDocument();
  });

  it('discards an unfinished SegmentAttachment recovery through attachment IPC', async () => {
    const user = userEvent.setup();
    const recoveredMemory = {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-07T14:30:00.000Z',
      updatedAt: '2026-05-07T14:30:00.000Z',
      segmentCount: 1,
      durationMs: 1,
      audioByteLength: 1,
      hasTranscript: false,
      attachmentCount: 0,
    };
    window.localStorage.setItem(
      'reo.recordingRecovery.v1.ws_1',
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        parentSegmentId: 'seg_parent',
        segmentId: 'att_recoverable',
        targetKind: 'segment-attachment',
        title: '补充录音',
        durationMs: 3720,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:03.720Z',
      })
    );
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [recoveredMemory],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const recoveryDialog = await screen.findByRole('dialog', { name: '未完成录音' });
    await user.click(within(recoveryDialog).getByRole('button', { name: '放弃' }));

    await waitFor(() =>
      expect(reoWorkspace.discardSegmentAttachmentRecordingDraft).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        attachmentId: 'att_recoverable',
      })
    );
    expect(reoWorkspace.discardRecordingDraft).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).toBeNull();
  });

  it('keeps a recovered transcript marker after transcript save fails and clears it after retry', async () => {
    const user = userEvent.setup();
    const recoveredMemory = {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-07T14:30:00.000Z',
      updatedAt: '2026-05-07T14:30:00.000Z',
      segmentCount: 1,
      durationMs: 1,
      audioByteLength: 1,
      hasTranscript: false,
      attachmentCount: 0,
    };
    window.localStorage.setItem(
      'reo.recordingRecovery.v1.ws_1',
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        segmentId: 'seg_recoverable',
        title: 'Daily memory 录音',
        durationMs: 3720,
        transcriptSegments: [
          {
            endTimeMs: 3000,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '会尝试保存的恢复转写',
          },
        ],
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:03.720Z',
      })
    );
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [recoveredMemory],
        },
      },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          segmentCount: 2,
          durationMs: 3721,
          audioByteLength: 24,
          updatedAt: '2026-05-09T10:00:04.000Z',
        },
        segment: audioSegmentProjection({
          audioByteLength: 23,
          createdAt: '2026-05-09T10:00:00.000Z',
          durationMs: 3720,
          memoryId: 'mem_existing',
          segmentId: 'seg_recoverable',
          title: 'Daily memory 录音',
          updatedAt: '2026-05-09T10:00:04.000Z',
        }),
      },
    });
    reoWorkspace.saveTranscript.mockRejectedValue(new Error('Transcript write failed'));

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const recoveryDialog = await screen.findByRole('dialog', { name: '未完成录音' });
    await user.click(within(recoveryDialog).getByRole('button', { name: '保存录音' }));

    await waitFor(() => expect(reoWorkspace.saveTranscript).toHaveBeenCalledOnce());
    const retainedMarker = window.localStorage.getItem('reo.recordingRecovery.v1.ws_1');
    expect(retainedMarker).not.toBeNull();
    expect(JSON.parse(retainedMarker as string)).toMatchObject({
      finalizedAudio: {
        segment: {
          memoryId: 'mem_existing',
          segmentId: 'seg_recoverable',
          type: 'audio',
        },
      },
    });
    expect(await screen.findByText('2 个片段 · 00:03')).toBeInTheDocument();

    reoWorkspace.saveTranscript.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          segmentCount: 2,
          durationMs: 3721,
          audioByteLength: 24,
          hasTranscript: true,
          updatedAt: '2026-05-09T10:00:05.000Z',
        },
        saved: true,
      },
    });

    const finalizedRecoveryDialog = await screen.findByRole('dialog', { name: '录音已保存' });
    expect(within(finalizedRecoveryDialog).queryByRole('button', { name: '继续检查' })).toBeNull();
    await user.click(within(finalizedRecoveryDialog).getByRole('button', { name: '重试保存转写' }));

    await waitFor(() => expect(reoWorkspace.saveTranscript).toHaveBeenCalledTimes(2));
    expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledOnce();
    expect(reoWorkspace.readRecordingDraftAudio).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).toBeNull();
  });

  it('keeps a recovered recording marker when the draft is missing before audio finalize', async () => {
    const user = userEvent.setup();
    const recoveredMemory = {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-07T14:30:00.000Z',
      updatedAt: '2026-05-07T14:30:00.000Z',
      segmentCount: 1,
      durationMs: 1,
      audioByteLength: 1,
      hasTranscript: false,
      attachmentCount: 0,
    };
    window.localStorage.setItem(
      'reo.recordingRecovery.v1.ws_1',
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        segmentId: 'seg_missing_draft',
        title: 'Daily memory 录音',
        durationMs: 3720,
        transcriptSegments: [
          {
            endTimeMs: 3000,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '不应该静默丢失的恢复转写',
          },
        ],
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:03.720Z',
      })
    );
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [recoveredMemory],
        },
      },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_RECORDING_NOT_FOUND' as const,
        message: 'Recording draft not found',
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const recoveryDialog = await screen.findByRole('dialog', { name: '未完成录音' });
    await user.click(within(recoveryDialog).getByRole('button', { name: '保存录音' }));

    await waitFor(() => expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledOnce());
    expect(reoWorkspace.saveTranscript).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).not.toBeNull();
  });

  it('opens a recoverable unfinished recording in paused review state before saving', async () => {
    const user = userEvent.setup();
    const recoveredMemory = {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-07T14:30:00.000Z',
      updatedAt: '2026-05-07T14:30:00.000Z',
      segmentCount: 1,
      durationMs: 1,
      audioByteLength: 1,
      hasTranscript: false,
      attachmentCount: 0,
    };
    window.localStorage.setItem(
      'reo.recordingRecovery.v1.ws_1',
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        segmentId: 'seg_recoverable',
        title: 'Daily memory 录音',
        durationMs: 3720,
        nextSequence: 3,
        audioChunks: [
          {
            byteLength: 3,
            endTimeMs: 3720,
            startTimeMs: 0,
          },
        ],
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:03.720Z',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        waveformSamples: [0.2, 0.4, 0.1],
        transcriptSegments: [
          {
            endTimeMs: 3000,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '恢复后的转写内容',
          },
        ],
      })
    );
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [recoveredMemory],
        },
      },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          segmentCount: 2,
          durationMs: 3721,
          audioByteLength: 24,
          hasTranscript: false,
          updatedAt: '2026-05-09T10:00:04.000Z',
        },
        segment: audioSegmentProjection({
          audioByteLength: 23,
          createdAt: '2026-05-09T10:00:00.000Z',
          durationMs: 3720,
          memoryId: 'mem_existing',
          segmentId: 'seg_recoverable',
          title: 'Daily memory 录音',
          updatedAt: '2026-05-09T10:00:04.000Z',
        }),
      },
    });
    reoWorkspace.readRecordingDraftAudio.mockResolvedValue({
      ok: true,
      value: {
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        nextSequence: 3,
      },
    });
    reoWorkspace.saveTranscript.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          hasTranscript: true,
          updatedAt: '2026-05-09T10:00:05.000Z',
        },
        saved: true,
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const recoveryDialog = await screen.findByRole('dialog', { name: '未完成录音' });
    await user.click(within(recoveryDialog).getByRole('button', { name: '继续检查' }));

    expect(await screen.findByRole('dialog', { name: '录音' })).toBeInTheDocument();
    expect(screen.getByLabelText('暂停录音波形')).toBeInTheDocument();
    expect(screen.getByText('恢复后的转写内容')).toBeInTheDocument();
    expect(screen.getByText('00:03.72')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '播放录音' })).toBeEnabled();
    await waitFor(() =>
      expect(reoWorkspace.readRecordingDraftAudio).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        segmentId: 'seg_recoverable',
        maxBytes: 3,
      })
    );

    await user.click(screen.getByRole('button', { name: '停止录音' }));

    await waitFor(() =>
      expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        memoryId: 'mem_existing',
        segmentId: 'seg_recoverable',
        title: 'Daily memory 录音',
        durationMs: 3720,
      })
    );
    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).toBeNull();
  });

  it('opens workspace creation from the sidebar add menu', async () => {
    const user = userEvent.setup();
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);

    expect(screen.getByRole('dialog', { name: '创建本地记忆空间' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: '创建本地记忆空间' })).toBeInTheDocument();
  });

  it('opens a local workspace from the sidebar add menu without initializing it', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-open',
        displayPath: 'Existing memory',
      },
    });
    reoWorkspace.openWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-open',
        workspaceId: 'ws_open',
        snapshot: {
          workspaceId: 'ws_open',
          title: 'Existing memory',
          description: '',
          memories: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));
    await user.click(screen.getByRole('menuitem', { name: '打开本地记忆空间' }));

    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();
    expect(screen.getAllByText('Existing memory').length).toBeGreaterThan(0);
    expect(reoWorkspace.openWorkspace).toHaveBeenCalledWith({
      selectionToken: 'selection-token-open',
    });
    expect(reoWorkspace.initializeWorkspace).not.toHaveBeenCalled();
    expect(reoWorkspace.openWorkspace).not.toHaveBeenCalledWith(
      expect.objectContaining({ displayPath: expect.any(String) })
    );
  });

  it('keeps imported 记忆空间 visible after an app restart before opening one', async () => {
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
          {
            workspaceId: 'ws_imported',
            title: 'Runtime validated memory',
            description: 'Final runtime validation workspace.',
            addedAt: '2026-05-08T07:48:00.000Z',
            lastOpenedAt: '2026-05-08T07:48:00.000Z',
          },
        ],
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    expect(
      await screen.findByRole('button', { name: 'Runtime validated memory' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '今天想记录些什么？' })).not.toBeInTheDocument();
    expect(reoWorkspace.openWorkspace).not.toHaveBeenCalled();
  });

  it('removes a persisted workspace from the sidebar list after confirmation without deleting its folder', async () => {
    const user = userEvent.setup();
    reoWorkspace.listMemorySpaces
      .mockResolvedValueOnce({
        ok: true,
        value: {
          memorySpaces: [
            {
              workspaceId: 'ws_test_1',
              title: '测试1',
              description: '',
              addedAt: '2026-05-08T07:48:00.000Z',
              lastOpenedAt: '2026-05-08T07:48:00.000Z',
            },
          ],
        },
      })
      .mockResolvedValueOnce({ ok: true, value: { memorySpaces: [] } });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    expect(await screen.findByRole('button', { name: '测试1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '测试1 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '移除记忆空间' }));

    expect(screen.getByRole('dialog', { name: '移除记忆空间' })).toBeInTheDocument();
    expect(screen.getByText('本地文件夹不会被删除。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '移除' }));

    await waitFor(() => {
      expect(reoWorkspace.removeMemorySpace).toHaveBeenCalledWith({
        workspaceId: 'ws_test_1',
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '测试1' })).not.toBeInTheDocument();
    });
    expect(await screen.findByText('已移除记忆空间')).toBeInTheDocument();
  });

  it('shows only toast feedback when removing a persisted workspace fails', async () => {
    const user = userEvent.setup();
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
          {
            workspaceId: 'ws_test_1',
            title: '测试1',
            description: '',
            addedAt: '2026-05-08T07:48:00.000Z',
            lastOpenedAt: '2026-05-08T07:48:00.000Z',
          },
        ],
      },
    });
    reoWorkspace.removeMemorySpace.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_WRITE_FAILED',
        message: 'Workspace memory space registry could not be written',
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    expect(await screen.findByRole('button', { name: '测试1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '测试1 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '移除记忆空间' }));
    await user.click(screen.getByRole('button', { name: '移除' }));

    expect(await screen.findByText('无法移除记忆空间')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: '移除记忆空间' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).queryByText('无法保存记忆空间列表。')).not.toBeInTheDocument();
  });

  it('opens a persisted 记忆空间 from the sidebar without exposing a raw path', async () => {
    const user = userEvent.setup();
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
          {
            workspaceId: 'ws_imported',
            title: 'Runtime validated memory',
            description: 'Final runtime validation workspace.',
            addedAt: '2026-05-08T07:48:00.000Z',
            lastOpenedAt: '2026-05-08T07:48:00.000Z',
          },
        ],
      },
    });
    reoWorkspace.openMemorySpace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-imported',
        workspaceId: 'ws_imported',
        snapshot: {
          workspaceId: 'ws_imported',
          title: 'Runtime validated memory',
          description: 'Final runtime validation workspace.',
          memories: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(await screen.findByRole('button', { name: 'Runtime validated memory' }));

    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();
    expect(reoWorkspace.openMemorySpace).toHaveBeenCalledWith({
      workspaceId: 'ws_imported',
    });
    expect(reoWorkspace.openMemorySpace).not.toHaveBeenCalledWith(
      expect.objectContaining({ rootPath: expect.any(String) })
    );
  });

  it('removes the current workspace memory space entry and then closes the active workspace', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Daily memory 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '移除记忆空间' }));
    await user.click(screen.getByRole('button', { name: '移除' }));

    await waitFor(() => {
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      });
    });
    expect(reoWorkspace.removeMemorySpace).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
    });
    expect(screen.queryByRole('heading', { name: '今天想记录些什么？' })).not.toBeInTheDocument();
    expect(await screen.findByText('已移除记忆空间')).toBeInTheDocument();
  });

  it('removes the current workspace memory space entry even when closing the active workspace fails', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [],
        },
      },
    });
    reoWorkspace.closeWorkspace.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_LOCK_FAILED',
        message: 'Workspace lock could not be released',
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Daily memory 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '移除记忆空间' }));
    await user.click(screen.getByRole('button', { name: '移除' }));

    expect(reoWorkspace.removeMemorySpace).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
    });
    expect(await screen.findByText('已移除记忆空间')).toBeInTheDocument();
    expect(screen.getByText('无法获取记忆空间锁。')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '今天想记录些什么？' })).not.toBeInTheDocument();
  });

  it('releases the previous workspace handle when switching to a persisted memory space', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
          {
            workspaceId: 'ws_memory_space_two',
            title: 'Memory Space two',
            description: '',
            addedAt: '2026-05-08T07:48:00.000Z',
            lastOpenedAt: '2026-05-08T07:48:00.000Z',
          },
        ],
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [],
        },
      },
    });
    reoWorkspace.openMemorySpace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-2',
        workspaceId: 'ws_memory_space_two',
        snapshot: {
          workspaceId: 'ws_memory_space_two',
          title: 'Memory Space two',
          description: '',
          memories: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Memory Space two' }));

    await waitFor(() => {
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      });
    });
    expect(screen.getAllByText('Memory Space two').length).toBeGreaterThan(0);
  });

  it('blocks workspace switching while a recording flow is open', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
          {
            workspaceId: 'ws_memory_space_two',
            title: 'Memory Space two',
            description: '',
            addedAt: '2026-05-08T07:48:00.000Z',
            lastOpenedAt: '2026-05-08T07:48:00.000Z',
          },
        ],
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [
            {
              memoryId: 'mem_existing',
              title: 'Existing memory',
              createdAt: '2026-05-07T14:30:00.000Z',
              updatedAt: '2026-05-07T14:30:00.000Z',
              segmentCount: 1,
              durationMs: 1,
              audioByteLength: 1,
              hasTranscript: false,
              attachmentCount: 0,
            },
          ],
        },
      },
    });
    reoWorkspace.openMemorySpace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-2',
        workspaceId: 'ws_memory_space_two',
        snapshot: {
          workspaceId: 'ws_memory_space_two',
          title: 'Memory Space two',
          description: '',
          memories: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('heading', { name: 'Existing memory' });
    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));
    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Memory Space two', hidden: true }));

    expect(await screen.findByText('当前录音尚未完成，请先完成或关闭录音。')).toBeInTheDocument();
    expect(reoWorkspace.openMemorySpace).not.toHaveBeenCalled();
    expect(reoWorkspace.closeWorkspace).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Existing memory', hidden: true })
    ).toBeInTheDocument();
  });

  it('blocks native window unload while recording is busy', async () => {
    const user = userEvent.setup();
    installRecordingBrowserMocks();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [
            {
              memoryId: 'mem_existing',
              title: 'Existing memory',
              createdAt: '2026-05-07T14:30:00.000Z',
              updatedAt: '2026-05-07T14:30:00.000Z',
              segmentCount: 1,
              durationMs: 1,
              audioByteLength: 1,
              hasTranscript: false,
              attachmentCount: 0,
            },
          ],
        },
      },
    });
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, segmentId: 'seg_1' },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('heading', { name: 'Existing memory' });
    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));

    const readyUnload = new Event('beforeunload', { cancelable: true });
    expect(window.dispatchEvent(readyUnload)).toBe(true);
    expect(readyUnload.defaultPrevented).toBe(false);

    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await screen.findByRole('button', { name: '停止录音' });

    const recordingUnload = new Event('beforeunload', { cancelable: true });
    expect(window.dispatchEvent(recordingUnload)).toBe(false);
    expect(recordingUnload.defaultPrevented).toBe(true);
  });

  it('shows toast feedback when opening a persisted memory space rejects', async () => {
    const user = userEvent.setup();
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
          {
            workspaceId: 'ws_imported',
            title: 'Runtime validated memory',
            description: '',
            addedAt: '2026-05-08T07:48:00.000Z',
            lastOpenedAt: '2026-05-08T07:48:00.000Z',
          },
        ],
      },
    });
    reoWorkspace.openMemorySpace.mockRejectedValue(new Error('IPC failed'));

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(await screen.findByRole('button', { name: 'Runtime validated memory' }));

    expect(await screen.findByText('无法打开记忆空间。')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a missing-folder toast when a deleted persisted memory space is opened', async () => {
    const user = userEvent.setup();
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
          {
            workspaceId: 'ws_deleted',
            title: 'Deleted workspace',
            description: '',
            addedAt: '2026-05-08T07:48:00.000Z',
            lastOpenedAt: '2026-05-08T07:48:00.000Z',
          },
        ],
      },
    });
    reoWorkspace.openMemorySpace.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_ROOT_MISSING',
        message: 'Workspace folder is missing',
        dataRetention: 'none-written',
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(await screen.findByRole('button', { name: 'Deleted workspace' }));

    expect(await screen.findByText('记忆空间文件夹已不存在。')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deleted workspace' })).toBeInTheDocument();
  });

  it('shows open-local workspace errors as toasts from the starter shell', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-invalid-open',
        displayPath: 'Not Reo',
      },
    });
    reoWorkspace.openWorkspace.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_METADATA_INVALID',
        message: 'Workspace metadata is invalid',
        dataRetention: 'none-written',
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));
    await user.click(screen.getByRole('menuitem', { name: '打开本地记忆空间' }));

    expect(await screen.findByText('该文件夹不是有效的 Reo 记忆空间。')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '创建本地记忆空间' })).not.toBeInTheDocument();
  });

  it('shows open-local workspace errors as toasts without losing the current workspace', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory
      .mockResolvedValueOnce({
        ok: true,
        value: {
          status: 'selected',
          selectionToken: 'selection-token-create',
          displayPath: 'Memory',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          status: 'selected',
          selectionToken: 'selection-token-locked-open',
          displayPath: 'Memory',
        },
      });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [],
        },
      },
    });
    reoWorkspace.openWorkspace.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_LOCKED',
        message: 'Workspace is already open',
        dataRetention: 'none-written',
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));
    await user.click(screen.getByRole('menuitem', { name: '打开本地记忆空间' }));

    expect(await screen.findByText('该记忆空间已在其他窗口打开。')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();
    expect(screen.getAllByText('Daily memory').length).toBeGreaterThan(0);
  });

  it('releases the previous workspace handle when opening another local workspace', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory
      .mockResolvedValueOnce({
        ok: true,
        value: {
          status: 'selected',
          selectionToken: 'selection-token-create',
          displayPath: 'Memory',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          status: 'selected',
          selectionToken: 'selection-token-open',
          displayPath: 'Other memory',
        },
      });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [],
        },
      },
    });
    reoWorkspace.openWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-2',
        workspaceId: 'ws_2',
        snapshot: {
          workspaceId: 'ws_2',
          title: 'Other memory',
          description: '',
          memories: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));
    await user.click(screen.getByRole('menuitem', { name: '打开本地记忆空间' }));

    await waitFor(() => {
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      });
    });
    expect(screen.getAllByText('Other memory').length).toBeGreaterThan(0);
  });

  it('selects a saved memory from MemoryRail as the current workspace stage context', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [
            {
              memoryId: 'mem_birthday',
              title: 'My seventh birthday',
              createdAt: '2026-04-12T09:00:00.000Z',
              updatedAt: '2026-04-12T09:10:00.000Z',
              segmentCount: 1,
              durationMs: 135_000,
              audioByteLength: 4096,
              hasTranscript: true,
              attachmentCount: 0,
            },
          ],
        },
      },
    });
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await expandMemoryRail(user);
    await user.click(await screen.findByRole('button', { name: '选择记忆 My seventh birthday' }));

    expect(await screen.findByRole('heading', { name: 'My seventh birthday' })).toBeInTheDocument();
    expect(screen.getByText('1 个片段 · 02:15')).toBeInTheDocument();
  });

  it('returns from a loaded workspace to the starter home and releases the workspace handle', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '首页' }));

    await waitFor(() => {
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      });
    });
    expect(screen.queryByRole('heading', { name: '今天想记录些什么？' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新记忆' })).not.toBeInTheDocument();
  });

  it('keeps the current workspace page when opening Library cannot release the handle', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [],
        },
      },
    });
    reoWorkspace.closeWorkspace.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_LOCK_FAILED',
        message: 'Workspace lock could not be released',
        dataRetention: 'unknown',
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '资料库' }));

    expect(await screen.findByText('无法获取记忆空间锁。')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '资料库' })).not.toBeInTheDocument();
  });

  it('keeps the current memory context when selecting the active workspace from the sidebar', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [
            {
              memoryId: 'mem_birthday',
              title: 'My seventh birthday',
              createdAt: '2026-04-12T09:00:00.000Z',
              updatedAt: '2026-04-12T09:10:00.000Z',
              segmentCount: 1,
              durationMs: 135_000,
              audioByteLength: 4096,
              hasTranscript: true,
              attachmentCount: 0,
            },
          ],
        },
      },
    });
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await expandMemoryRail(user);
    await user.click(await screen.findByRole('button', { name: '选择记忆 My seventh birthday' }));

    expect(await screen.findByRole('heading', { name: 'My seventh birthday' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Daily memory' }));

    expect(screen.getByRole('heading', { name: 'My seventh birthday' })).toBeInTheDocument();
  });

  it('finalizes a FAB recording against the current selected memory without creating a new memory', async () => {
    const user = userEvent.setup();
    installRecordingBrowserMocks();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [
            {
              memoryId: 'mem_birthday',
              title: 'My seventh birthday',
              createdAt: '2026-04-12T09:00:00.000Z',
              updatedAt: '2026-04-12T09:10:00.000Z',
              segmentCount: 1,
              durationMs: 135_000,
              audioByteLength: 4096,
              hasTranscript: true,
              attachmentCount: 0,
            },
          ],
        },
      },
    });
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, segmentId: 'seg_2' },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          memoryId: 'mem_birthday',
          title: 'My seventh birthday',
          createdAt: '2026-04-12T09:00:00.000Z',
          updatedAt: '2026-04-12T09:15:00.000Z',
          segmentCount: 2,
          durationMs: 136_200,
          audioByteLength: 4097,
          hasTranscript: true,
          attachmentCount: 0,
        },
        segment: audioSegmentProjection({
          audioByteLength: 1,
          createdAt: '2026-04-12T09:15:00.000Z',
          durationMs: 1200,
          memoryId: 'mem_birthday',
          segmentId: 'seg_2',
          title: 'Birthday followup',
          updatedAt: '2026-04-12T09:15:00.000Z',
        }),
      },
    });
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('heading', { name: 'My seventh birthday' });
    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));
    expect(screen.queryByRole('dialog', { name: '新建记忆' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await screen.findByRole('button', { name: '停止录音' });
    await user.click(screen.getByRole('button', { name: '停止录音' }));
    await screen.findByText(/录音时间较短/);
    await user.click(screen.getByRole('button', { name: '停止录音' }));

    await waitFor(() =>
      expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          memoryId: 'mem_birthday',
          segmentId: 'seg_2',
          workspaceHandle: 'workspace-handle-1',
        })
      )
    );
    expect(reoWorkspace.createMemory).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('projects a finalized FAB recording into the active Memory detail and focuses the new Segment', async () => {
    const user = userEvent.setup();
    installRecordingBrowserMocks();
    const birthdayMemory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-04-12T09:00:00.000Z',
      updatedAt: '2026-04-12T09:10:00.000Z',
      segmentCount: 1,
      durationMs: 135_000,
      audioByteLength: 4096,
      hasTranscript: true,
      attachmentCount: 0,
    };
    const existingSegment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      type: 'audio' as const,
      title: 'Birthday candles',
      createdAt: '2026-04-12T09:00:00.000Z',
      updatedAt: '2026-04-12T09:10:00.000Z',
      durationMs: 135_000,
      audioByteLength: 4096,
      transcript: { exists: true },
      attachmentCount: 0,
      attachments: [],
    };
    const finalizedSegment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_2',
      type: 'audio' as const,
      title: 'Birthday followup',
      createdAt: '2026-04-12T09:15:00.000Z',
      updatedAt: '2026-04-12T09:15:00.000Z',
      durationMs: 1200,
      audioByteLength: 1,
      transcript: { exists: false },
      attachmentCount: 0,
      attachments: [],
    };

    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [birthdayMemory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...birthdayMemory,
          workspaceId: 'ws_1',
          segments: [existingSegment],
        },
      },
    }));
    reoWorkspace.readFinalizedAudioSegment.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: 'ws_1',
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        transcript: { exists: false, text: '' },
      },
    }));
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, segmentId: 'seg_2' },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...birthdayMemory,
          updatedAt: '2026-04-12T09:15:00.000Z',
          segmentCount: 2,
          durationMs: 136_200,
          audioByteLength: 4097,
        },
        segment: finalizedSegment,
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(
      await screen.findByRole('button', { name: '选择片段 Birthday candles' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));
    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await screen.findByRole('button', { name: '停止录音' });
    await user.click(screen.getByRole('button', { name: '停止录音' }));
    await screen.findByText(/录音时间较短/);
    await user.click(screen.getByRole('button', { name: '停止录音' }));

    const finalizedSegmentButton = await screen.findByRole('button', {
      name: '选择片段 Birthday followup',
    });
    expect(finalizedSegmentButton).toHaveAttribute('aria-current', 'true');
    expect(reoWorkspace.readMemoryDetail).toHaveBeenCalledTimes(1);
  });

  it('finalizes a SegmentAttachment recording from the selected Segment plus menu', async () => {
    const user = userEvent.setup();
    installRecordingBrowserMocks();
    const birthdayMemory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-04-12T09:00:00.000Z',
      updatedAt: '2026-04-12T09:10:00.000Z',
      segmentCount: 1,
      durationMs: 135_000,
      audioByteLength: 4096,
      hasTranscript: true,
      attachmentCount: 0,
    };
    const parentSegment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      type: 'audio' as const,
      title: 'Birthday candles',
      createdAt: '2026-04-12T09:00:00.000Z',
      updatedAt: '2026-04-12T09:10:00.000Z',
      durationMs: 135_000,
      audioByteLength: 4096,
      transcript: { exists: true },
      attachmentCount: 0,
    };
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [birthdayMemory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...birthdayMemory,
          workspaceId: 'ws_1',
          segments: [parentSegment],
        },
      },
    }));
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.createSegmentAttachmentRecordingDraft.mockResolvedValue({
      ok: true,
      value: { attachmentId: 'att_birthday_followup', nextSequence: 0 },
    });
    reoWorkspace.appendSegmentAttachmentRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.finalizeSegmentAttachmentRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...birthdayMemory,
          updatedAt: '2026-04-12T09:15:00.000Z',
          attachmentCount: 1,
        },
        segment: {
          ...parentSegment,
          updatedAt: '2026-04-12T09:15:00.000Z',
          attachmentCount: 1,
        },
        attachment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_birthday',
          segmentId: 'seg_birthday_voice',
          attachmentId: 'att_birthday_followup',
          type: 'audio',
          title: '补充录音',
          createdAt: '2026-04-12T09:15:00.000Z',
          updatedAt: '2026-04-12T09:15:00.000Z',
          durationMs: 1200,
          audioByteLength: 1,
          transcript: { exists: false },
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('heading', { name: 'My seventh birthday' });
    await user.click(await screen.findByRole('button', { name: '添加片段补充内容' }));
    await user.click(await screen.findByRole('menuitem', { name: '录音补充' }));

    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await screen.findByRole('button', { name: '停止录音' });
    await user.click(screen.getByRole('button', { name: '停止录音' }));
    await screen.findByText(/录音时间较短/);
    await user.click(screen.getByRole('button', { name: '停止录音' }));

    await waitFor(() =>
      expect(reoWorkspace.finalizeSegmentAttachmentRecordingDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceHandle: 'workspace-handle-1',
          workspaceId: 'ws_1',
          memoryId: 'mem_birthday',
          segmentId: 'seg_birthday_voice',
          attachmentId: 'att_birthday_followup',
        })
      )
    );
    expect(reoWorkspace.createRecordingDraft).not.toHaveBeenCalled();
    expect(reoWorkspace.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(reoWorkspace.createMemory).not.toHaveBeenCalled();
  });

  it('opens the recording overlay from the current memory stage FAB', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [
            {
              memoryId: 'mem_birthday',
              title: 'My seventh birthday',
              createdAt: '2026-04-12T09:00:00.000Z',
              updatedAt: '2026-04-12T09:10:00.000Z',
              segmentCount: 1,
              durationMs: 135_000,
              audioByteLength: 4096,
              hasTranscript: true,
              attachmentCount: 0,
            },
          ],
        },
      },
    });
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('heading', { name: 'My seventh birthday' });
    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));

    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();
  });

  it('records into the selected Memory after switching the quiet stage context', async () => {
    const user = userEvent.setup();
    installRecordingBrowserMocks();
    const birthdayMemory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-04-12T09:00:00.000Z',
      updatedAt: '2026-04-12T09:10:00.000Z',
      segmentCount: 1,
      durationMs: 135_000,
      audioByteLength: 4096,
      hasTranscript: true,
      attachmentCount: 0,
    };
    const morningMemory = {
      memoryId: 'mem_morning',
      title: 'Morning note',
      createdAt: '2026-05-07T06:40:00.000Z',
      updatedAt: '2026-05-07T06:42:00.000Z',
      segmentCount: 1,
      durationMs: 12_000,
      audioByteLength: 1024,
      hasTranscript: false,
      attachmentCount: 0,
    };
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: '',
          memories: [birthdayMemory, morningMemory],
        },
      },
    });
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, segmentId: 'seg_selected_memory' },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...morningMemory,
          segmentCount: 2,
          durationMs: 13_200,
          audioByteLength: 1025,
          updatedAt: '2026-05-07T06:43:00.000Z',
        },
        segment: audioSegmentProjection({
          audioByteLength: 1,
          createdAt: '2026-05-07T06:43:00.000Z',
          durationMs: 1200,
          memoryId: 'mem_morning',
          segmentId: 'seg_selected_memory',
          title: 'Morning followup',
          updatedAt: '2026-05-07T06:43:00.000Z',
        }),
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await expandMemoryRail(user);
    await user.click(await screen.findByRole('button', { name: '选择记忆 Morning note' }));
    expect(await screen.findByRole('heading', { name: 'Morning note' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));
    expect(screen.queryByRole('dialog', { name: '新建记忆' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await screen.findByRole('button', { name: '停止录音' });
    await user.click(screen.getByRole('button', { name: '停止录音' }));
    await screen.findByText(/录音时间较短/);
    await user.click(screen.getByRole('button', { name: '停止录音' }));

    await waitFor(() =>
      expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          memoryId: 'mem_morning',
          segmentId: 'seg_selected_memory',
          workspaceHandle: 'workspace-handle-1',
        })
      )
    );
    expect(reoWorkspace.createMemory).not.toHaveBeenCalled();
  });

  it('keeps memory projection fresh after finalize', () => {
    const session = {
      workspaceHandle: 'workspace-handle-1',
      workspaceId: 'ws_1',
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Daily memory',
        description: '',
        memories: [],
      },
    };

    expect(
      mergeMemoryIntoSession(session, {
        audioByteLength: 3,
        createdAt: '2026-05-06T13:08:00.000Z',
        durationMs: 2000,
        attachmentCount: 0,
        hasTranscript: false,
        memoryId: 'mem_1',
        segmentCount: 1,
        title: 'Daily memory recording',
        updatedAt: '2026-05-06T13:09:00.000Z',
      }).snapshot
    ).toMatchObject({
      memories: [{ memoryId: 'mem_1', segmentCount: 1 }],
    });
  });
});

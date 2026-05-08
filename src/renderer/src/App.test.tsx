import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App, mergeFinalizedRecordingIntoSession } from './App';
import { ReoQueryProvider } from './queryClient';

describe('App', () => {
  const reoWorkspace = {
    chooseDirectory: vi.fn(),
    initializeWorkspace: vi.fn(),
    openWorkspace: vi.fn(),
    closeWorkspace: vi.fn(),
    createRecordingDraft: vi.fn(),
    appendRecordingAudioChunk: vi.fn(),
    finalizeRecordingDraft: vi.fn(),
    discardRecordingDraft: vi.fn(),
    getMemoryDetail: vi.fn(),
    getRecordingDetail: vi.fn(),
    readRecordingAudioManifest: vi.fn(),
    readRecordingAudioChunk: vi.fn(),
    saveTranscript: vi.fn(),
    saveReflections: vi.fn(),
    beginMicrophoneIntent: vi.fn(),
    clearMicrophoneIntent: vi.fn(),
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
    Object.defineProperty(window, 'reoWorkspace', {
      configurable: true,
      value: reoWorkspace,
    });
  });

  async function openCreateWorkspaceDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: '添加工作区' }));
    await user.click(screen.getByRole('menuitem', { name: '新建空白项目' }));
  }

  it('renders starter home without a page plus and opens creation from the sidebar entry', async () => {
    const user = userEvent.setup();
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    expect(screen.getByRole('navigation', { name: '工作区' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '全部记忆' })).not.toBeInTheDocument();
    expect(
      screen.queryByText('Create a local workspace to start collecting memories.')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '创建本地工作区' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '创建工作区' })).not.toBeInTheDocument();
    await openCreateWorkspaceDialog(user);

    expect(screen.getByRole('dialog', { name: '创建本地工作区' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '添加工作区' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('工作区名称')).toHaveFocus();
    expect(screen.queryByText(/photo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/video/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/file/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/film/i)).not.toBeInTheDocument();
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
          recordings: [],
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
      screen.getByRole('main', { name: '工作区内容' }).closest('[data-theme]')
    ).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('工作区名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(await screen.findByRole('heading', { name: '全部记忆' })).toBeInTheDocument();
    expect(
      screen.getByRole('main', { name: '工作区内容' }).closest('[data-theme]')
    ).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getAllByText('Daily memory').length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: '工作区' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: '工作区内容' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '搜索记忆' })).toBeInTheDocument();
    expect(screen.queryByText('workspace-handle-1')).not.toBeInTheDocument();
  });

  it('opens the recording drawer from Home to create a new memory', async () => {
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
          recordings: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('工作区名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await user.click(await screen.findByRole('button', { name: '记录记忆' }));

    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();
  });

  it('opens workspace creation from the sidebar add menu', async () => {
    const user = userEvent.setup();
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);

    expect(screen.getByRole('dialog', { name: '创建本地工作区' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: '创建本地工作区' })).toBeInTheDocument();
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
          recordings: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(screen.getByRole('button', { name: '添加工作区' }));
    await user.click(screen.getByRole('menuitem', { name: '打开本地工作区' }));

    expect(await screen.findByRole('heading', { name: '全部记忆' })).toBeInTheDocument();
    expect(screen.getAllByText('Existing memory').length).toBeGreaterThan(0);
    expect(reoWorkspace.openWorkspace).toHaveBeenCalledWith({
      selectionToken: 'selection-token-open',
    });
    expect(reoWorkspace.initializeWorkspace).not.toHaveBeenCalled();
    expect(reoWorkspace.openWorkspace).not.toHaveBeenCalledWith(
      expect.objectContaining({ displayPath: expect.any(String) })
    );
  });

  it('opens a saved memory detail from Home and returns to Home', async () => {
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
              recordingCount: 1,
              durationMs: 135_000,
              audioByteLength: 4096,
              hasTranscript: true,
              hasReflections: false,
            },
          ],
          recordings: [],
        },
      },
    });
    reoWorkspace.getMemoryDetail.mockResolvedValue({
      ok: true,
      value: {
        memoryId: 'mem_birthday',
        title: 'My seventh birthday',
        sourceKind: 'recording',
        createdAt: '2026-04-12T09:00:00.000Z',
        updatedAt: '2026-04-12T09:10:00.000Z',
        recordingIds: ['rec_1'],
        recordingCount: 1,
        recordingsTruncated: false,
        hasTranscript: true,
        hasReflections: false,
        recordings: [
          {
            recordingId: 'rec_1',
            title: 'Birthday_summary_01',
            durationMs: 135_000,
            audioByteLength: 4096,
          },
        ],
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('工作区名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await user.click(await screen.findByRole('button', { name: '打开 My seventh birthday' }));

    expect(await screen.findByRole('heading', { name: 'My seventh birthday' })).toBeInTheDocument();
    expect(screen.getByText('Birthday_summary_01')).toBeInTheDocument();
    expect(reoWorkspace.getMemoryDetail).toHaveBeenCalledWith({
      workspaceHandle: 'workspace-handle-1',
      memoryId: 'mem_birthday',
    });

    await user.click(screen.getByRole('button', { name: '首页' }));
    expect(screen.getByRole('heading', { name: '全部记忆' })).toBeInTheDocument();
  });

  it('returns from memory detail when selecting the active workspace from the sidebar', async () => {
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
              recordingCount: 1,
              durationMs: 135_000,
              audioByteLength: 4096,
              hasTranscript: true,
              hasReflections: false,
            },
          ],
          recordings: [],
        },
      },
    });
    reoWorkspace.getMemoryDetail.mockResolvedValue({
      ok: true,
      value: {
        memoryId: 'mem_birthday',
        title: 'My seventh birthday',
        sourceKind: 'recording',
        createdAt: '2026-04-12T09:00:00.000Z',
        updatedAt: '2026-04-12T09:10:00.000Z',
        recordingIds: ['rec_1'],
        recordingCount: 1,
        recordingsTruncated: false,
        hasTranscript: true,
        hasReflections: false,
        recordings: [
          {
            recordingId: 'rec_1',
            title: 'Birthday_summary_01',
            durationMs: 135_000,
            audioByteLength: 4096,
          },
        ],
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('工作区名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await user.click(await screen.findByRole('button', { name: '打开 My seventh birthday' }));

    expect(await screen.findByRole('heading', { name: 'My seventh birthday' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Daily memory' }));

    expect(screen.getByRole('heading', { name: '全部记忆' })).toBeInTheDocument();
  });

  it('finalizes a recording from memory detail against the current memory', async () => {
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
              recordingCount: 1,
              durationMs: 135_000,
              audioByteLength: 4096,
              hasTranscript: true,
              hasReflections: false,
            },
          ],
          recordings: [],
        },
      },
    });
    reoWorkspace.getMemoryDetail
      .mockResolvedValueOnce({
        ok: true,
        value: {
          memoryId: 'mem_birthday',
          title: 'My seventh birthday',
          sourceKind: 'recording',
          createdAt: '2026-04-12T09:00:00.000Z',
          updatedAt: '2026-04-12T09:10:00.000Z',
          recordingIds: ['rec_1'],
          recordingCount: 1,
          recordingsTruncated: false,
          hasTranscript: true,
          hasReflections: false,
          recordings: [],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          memoryId: 'mem_birthday',
          title: 'My seventh birthday',
          sourceKind: 'recording',
          createdAt: '2026-04-12T09:00:00.000Z',
          updatedAt: '2026-04-12T09:15:00.000Z',
          recordingIds: ['rec_1', 'rec_2'],
          recordingCount: 2,
          recordingsTruncated: false,
          hasTranscript: true,
          hasReflections: false,
          recordings: [
            {
              recordingId: 'rec_2',
              title: 'Birthday followup',
              durationMs: 1200,
              audioByteLength: 1,
            },
          ],
        },
      });
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, recordingId: 'rec_2' },
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
          recordingCount: 2,
          durationMs: 136_200,
          audioByteLength: 4097,
          hasTranscript: true,
          hasReflections: false,
        },
        recording: {
          recordingId: 'rec_2',
          memoryId: 'mem_birthday',
          title: 'Birthday followup',
          durationMs: 1200,
          audioByteLength: 1,
        },
      },
    });
    reoWorkspace.readRecordingAudioManifest.mockResolvedValue({
      ok: true,
      value: { byteLength: 1, maxChunkBytes: 1, recordingId: 'rec_2' },
    });
    reoWorkspace.readRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { chunk: new Uint8Array([1]) },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('工作区名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await user.click(await screen.findByRole('button', { name: '打开 My seventh birthday' }));
    await screen.findByRole('heading', { name: 'My seventh birthday' });
    await user.click(screen.getByRole('button', { name: '继续记录' }));
    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await screen.findByRole('button', { name: '停止录音' });
    await user.click(screen.getByRole('button', { name: '停止录音' }));
    await screen.findByRole('heading', { name: '编辑录音' });

    expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        memoryId: 'mem_birthday',
        recordingId: 'rec_2',
        workspaceHandle: 'workspace-handle-1',
      })
    );
    await waitFor(() => expect(reoWorkspace.getMemoryDetail).toHaveBeenCalledTimes(2));
  });

  it('opens the recording drawer from memory detail', async () => {
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
              recordingCount: 1,
              durationMs: 135_000,
              audioByteLength: 4096,
              hasTranscript: true,
              hasReflections: false,
            },
          ],
          recordings: [],
        },
      },
    });
    reoWorkspace.getMemoryDetail.mockResolvedValue({
      ok: true,
      value: {
        memoryId: 'mem_birthday',
        title: 'My seventh birthday',
        sourceKind: 'recording',
        createdAt: '2026-04-12T09:00:00.000Z',
        updatedAt: '2026-04-12T09:10:00.000Z',
        recordingIds: ['rec_1'],
        recordingCount: 1,
        recordingsTruncated: false,
        hasTranscript: true,
        hasReflections: false,
        recordings: [],
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('工作区名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await user.click(await screen.findByRole('button', { name: '打开 My seventh birthday' }));
    await screen.findByRole('heading', { name: 'My seventh birthday' });
    await user.click(screen.getByRole('button', { name: '继续记录' }));

    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();
  });

  it('keeps memory and recording projections fresh after finalize', () => {
    const session = {
      workspaceHandle: 'workspace-handle-1',
      workspaceId: 'ws_1',
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Daily memory',
        description: '',
        memories: [],
        recordings: [],
      },
    };

    expect(
      mergeFinalizedRecordingIntoSession(session, {
        memory: {
          audioByteLength: 3,
          createdAt: '2026-05-06T13:08:00.000Z',
          durationMs: 2000,
          hasReflections: false,
          hasTranscript: false,
          memoryId: 'mem_1',
          recordingCount: 1,
          title: 'Daily memory recording',
          updatedAt: '2026-05-06T13:09:00.000Z',
        },
        recording: {
          audioByteLength: 3,
          durationMs: 2000,
          memoryId: 'mem_1',
          recordingId: 'rec_1',
          title: 'Daily memory recording',
        },
      }).snapshot
    ).toMatchObject({
      memories: [{ memoryId: 'mem_1', recordingCount: 1 }],
      recordings: [{ recordingId: 'rec_1' }],
    });
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App, mergeFinalizedRecordingIntoSession } from './App';
import { ReoQueryProvider } from './queryClient';

describe('App', () => {
  const reoWorkspace = {
    chooseDirectory: vi.fn(),
    listWorkspaceProjects: vi.fn(),
    initializeWorkspace: vi.fn(),
    openWorkspace: vi.fn(),
    openWorkspaceProject: vi.fn(),
    removeWorkspaceProject: vi.fn(),
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
    reoWorkspace.listWorkspaceProjects.mockResolvedValue({ ok: true, value: { projects: [] } });
    reoWorkspace.removeWorkspaceProject.mockResolvedValue({ ok: true, value: { removed: true } });
    reoWorkspace.closeWorkspace.mockResolvedValue({ ok: true, value: { closed: true } });
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
    expect(screen.queryByRole('button', { name: '新记忆' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '资料库' })).toBeInTheDocument();
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

  it('opens the workspace library page from the sidebar', async () => {
    const user = userEvent.setup();
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(screen.getByRole('button', { name: '资料库' }));

    expect(screen.getByRole('heading', { name: '资料库' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '全部记忆' })).not.toBeInTheDocument();
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

  it('keeps imported workspace projects visible after an app restart before opening one', async () => {
    reoWorkspace.listWorkspaceProjects.mockResolvedValue({
      ok: true,
      value: {
        projects: [
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
    expect(screen.queryByRole('heading', { name: '全部记忆' })).not.toBeInTheDocument();
    expect(reoWorkspace.openWorkspace).not.toHaveBeenCalled();
  });

  it('removes a persisted workspace from the sidebar list after confirmation without deleting its folder', async () => {
    const user = userEvent.setup();
    reoWorkspace.listWorkspaceProjects
      .mockResolvedValueOnce({
        ok: true,
        value: {
          projects: [
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
      .mockResolvedValueOnce({ ok: true, value: { projects: [] } });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    expect(await screen.findByRole('button', { name: '测试1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '测试1 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '移除工作区' }));

    expect(screen.getByRole('dialog', { name: '移除工作区' })).toBeInTheDocument();
    expect(screen.getByText('本地文件夹不会被删除。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '移除' }));

    await waitFor(() => {
      expect(reoWorkspace.removeWorkspaceProject).toHaveBeenCalledWith({
        workspaceId: 'ws_test_1',
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '测试1' })).not.toBeInTheDocument();
    });
    expect(await screen.findByText('已移除工作区')).toBeInTheDocument();
  });

  it('shows only toast feedback when removing a persisted workspace fails', async () => {
    const user = userEvent.setup();
    reoWorkspace.listWorkspaceProjects.mockResolvedValue({
      ok: true,
      value: {
        projects: [
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
    reoWorkspace.removeWorkspaceProject.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_PROJECT_REGISTRY_WRITE_FAILED',
        message: 'Workspace project registry could not be written',
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    expect(await screen.findByRole('button', { name: '测试1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '测试1 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '移除工作区' }));
    await user.click(screen.getByRole('button', { name: '移除' }));

    expect(await screen.findByText('无法移除工作区')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: '移除工作区' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).queryByText('无法保存工作区列表。')).not.toBeInTheDocument();
  });

  it('opens a persisted workspace project from the sidebar without exposing a raw path', async () => {
    const user = userEvent.setup();
    reoWorkspace.listWorkspaceProjects.mockResolvedValue({
      ok: true,
      value: {
        projects: [
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
    reoWorkspace.openWorkspaceProject.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-imported',
        workspaceId: 'ws_imported',
        snapshot: {
          workspaceId: 'ws_imported',
          title: 'Runtime validated memory',
          description: 'Final runtime validation workspace.',
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

    await user.click(await screen.findByRole('button', { name: 'Runtime validated memory' }));

    expect(await screen.findByRole('heading', { name: '全部记忆' })).toBeInTheDocument();
    expect(reoWorkspace.openWorkspaceProject).toHaveBeenCalledWith({
      workspaceId: 'ws_imported',
    });
    expect(reoWorkspace.openWorkspaceProject).not.toHaveBeenCalledWith(
      expect.objectContaining({ rootPath: expect.any(String) })
    );
  });

  it('removes the current workspace project entry and then closes the active workspace', async () => {
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
    expect(await screen.findByRole('heading', { name: '全部记忆' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Daily memory 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '移除工作区' }));
    await user.click(screen.getByRole('button', { name: '移除' }));

    await waitFor(() => {
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      });
    });
    expect(reoWorkspace.removeWorkspaceProject).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
    });
    expect(screen.queryByRole('heading', { name: '全部记忆' })).not.toBeInTheDocument();
    expect(await screen.findByText('已移除工作区')).toBeInTheDocument();
  });

  it('removes the current workspace project entry even when closing the active workspace fails', async () => {
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
    await user.type(screen.getByLabelText('工作区名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '全部记忆' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Daily memory 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '移除工作区' }));
    await user.click(screen.getByRole('button', { name: '移除' }));

    expect(reoWorkspace.removeWorkspaceProject).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
    });
    expect(await screen.findByText('已移除工作区')).toBeInTheDocument();
    expect(screen.getByText('无法获取工作区锁。')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '全部记忆' })).not.toBeInTheDocument();
  });

  it('releases the previous workspace handle when switching to a persisted project', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.listWorkspaceProjects.mockResolvedValue({
      ok: true,
      value: {
        projects: [
          {
            workspaceId: 'ws_project_two',
            title: 'Project two',
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
          recordings: [],
        },
      },
    });
    reoWorkspace.openWorkspaceProject.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-2',
        workspaceId: 'ws_project_two',
        snapshot: {
          workspaceId: 'ws_project_two',
          title: 'Project two',
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
    expect(await screen.findByRole('heading', { name: '全部记忆' })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Project two' }));

    await waitFor(() => {
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      });
    });
    expect(screen.getAllByText('Project two').length).toBeGreaterThan(0);
  });

  it('shows a visible error when opening a persisted project rejects', async () => {
    const user = userEvent.setup();
    reoWorkspace.listWorkspaceProjects.mockResolvedValue({
      ok: true,
      value: {
        projects: [
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
    reoWorkspace.openWorkspaceProject.mockRejectedValue(new Error('IPC failed'));

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(await screen.findByRole('button', { name: 'Runtime validated memory' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('无法打开工作区。');
  });

  it('shows a missing-folder error when a deleted persisted project is opened', async () => {
    const user = userEvent.setup();
    reoWorkspace.listWorkspaceProjects.mockResolvedValue({
      ok: true,
      value: {
        projects: [
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
    reoWorkspace.openWorkspaceProject.mockResolvedValue({
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

    expect(await screen.findByRole('alert')).toHaveTextContent('工作区文件夹已不存在。');
    expect(screen.getByRole('button', { name: 'Deleted workspace' })).toBeInTheDocument();
  });

  it('shows open-local workspace errors from the starter shell', async () => {
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

    await user.click(screen.getByRole('button', { name: '添加工作区' }));
    await user.click(screen.getByRole('menuitem', { name: '打开本地工作区' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('该文件夹不是有效的 Reo 工作区。');
    expect(screen.queryByRole('dialog', { name: '创建本地工作区' })).not.toBeInTheDocument();
  });

  it('shows open-local workspace errors from the loaded shell without losing the current workspace', async () => {
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
          recordings: [],
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
    await user.type(screen.getByLabelText('工作区名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '全部记忆' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '添加工作区' }));
    await user.click(screen.getByRole('menuitem', { name: '打开本地工作区' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('该工作区已在其他窗口打开。');
    expect(screen.getByRole('heading', { name: '全部记忆' })).toBeInTheDocument();
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
          recordings: [],
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
    expect(await screen.findByRole('heading', { name: '全部记忆' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '添加工作区' }));
    await user.click(screen.getByRole('menuitem', { name: '打开本地工作区' }));

    await waitFor(() => {
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      });
    });
    expect(screen.getAllByText('Other memory').length).toBeGreaterThan(0);
  });

  it('opens a saved memory detail from Home and returns to the workspace Home with the back button', async () => {
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

    await user.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByRole('heading', { name: '全部记忆' })).toBeInTheDocument();
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
    expect(await screen.findByRole('heading', { name: '全部记忆' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '首页' }));

    await waitFor(() => {
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      });
    });
    expect(screen.queryByRole('heading', { name: '全部记忆' })).not.toBeInTheDocument();
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
          recordings: [],
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
    await user.type(screen.getByLabelText('工作区名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '全部记忆' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '资料库' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('无法获取工作区锁。');
    expect(screen.getByRole('heading', { name: '全部记忆' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '资料库' })).not.toBeInTheDocument();
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

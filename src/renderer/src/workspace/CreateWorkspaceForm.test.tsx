import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '@/components/ui/toaster';
import { CreateWorkspaceForm } from './CreateWorkspaceForm';

vi.mock('@/components/ui/toaster', () => {
  const toast = Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  });

  return { toast };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

describe('CreateWorkspaceForm', () => {
  const reoWorkspace = {
    chooseDirectory: vi.fn(),
    initializeWorkspace: vi.fn(),
    openWorkspace: vi.fn(),
    closeWorkspace: vi.fn(),
    createRecordingDraft: vi.fn(),
    createSegmentAttachmentRecordingDraft: vi.fn(),
    readFinalizedAudioSegment: vi.fn(),
    readRecordingDraftAudio: vi.fn(),
    appendRecordingAudioChunk: vi.fn(),
    appendSegmentAttachmentRecordingAudioChunk: vi.fn(),
    cloneRecordingDraftPrefix: vi.fn(),
    finalizeRecordingDraft: vi.fn(),
    finalizeSegmentAttachmentRecordingDraft: vi.fn(),
    discardRecordingDraft: vi.fn(),
    discardSegmentAttachmentRecordingDraft: vi.fn(),
    saveTranscript: vi.fn(),
    beginMicrophoneIntent: vi.fn(),
    clearMicrophoneIntent: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(window, 'reoWorkspace', {
      configurable: true,
      value: reoWorkspace,
    });
  });

  function renderCreateWorkspaceForm(onWorkspaceReady = vi.fn()) {
    render(
      <CreateWorkspaceForm
        onCreateFinish={vi.fn()}
        onCreateStart={() => true}
        onWorkspaceReady={onWorkspaceReady}
      />
    );
  }

  it('starts with Chinese compact fields, folder picker, submit, and title focus', () => {
    renderCreateWorkspaceForm();

    expect(screen.getByRole('form', { name: '创建本地记忆空间' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '创建本地记忆空间' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('记忆空间名称')).toHaveFocus();
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    expect(screen.getByLabelText('描述')).toHaveClass('min-h-72', 'rounded-inputs', 'text-ui-sm');
    expect(screen.getByText('补充这个记忆空间的用途，可选')).toHaveClass('text-ui-xs');
    expect(screen.getByText('给新的记忆空间起一个名字')).toHaveClass('text-ui-xs');
    expect(screen.getByRole('button', { name: '浏览' })).toHaveClass('min-h-32');
    expect(screen.getByRole('button', { name: '创建' })).toBeEnabled();
  });

  it('keeps form values and returns focus to the folder picker after OS dialog cancel', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({ ok: true, value: { status: 'canceled' } });

    renderCreateWorkspaceForm();

    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));

    expect(screen.getByLabelText('记忆空间名称')).toHaveValue('Daily memory');
    await waitFor(() => expect(screen.getByRole('button', { name: '浏览' })).toHaveFocus());
    expect(screen.getByRole('button', { name: '创建' })).toBeEnabled();
  });

  it('ignores repeated folder picker clicks while the OS dialog is pending', async () => {
    const user = userEvent.setup();
    const selection = deferred<Awaited<ReturnType<(typeof reoWorkspace)['chooseDirectory']>>>();
    reoWorkspace.chooseDirectory.mockReturnValue(selection.promise);

    renderCreateWorkspaceForm();

    await user.dblClick(screen.getByRole('button', { name: '浏览' }));

    expect(reoWorkspace.chooseDirectory).toHaveBeenCalledTimes(1);

    selection.resolve({ ok: true, value: { status: 'canceled' } });
  });

  it('shows a toast for existing AGENTS.md conflict without clearing user input', async () => {
    const user = userEvent.setup();
    const onWorkspaceReady = vi.fn();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_AGENTS_CONFLICT',
        message: 'Folder already contains AGENTS.md',
      },
    });

    renderCreateWorkspaceForm(onWorkspaceReady);

    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.type(screen.getByLabelText('描述'), 'Private notes');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(toast.error).toHaveBeenCalledWith('无法创建记忆空间', {
      description: expect.stringContaining('AGENTS.md'),
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('记忆空间名称')).toHaveValue('Daily memory');
    expect(screen.getByLabelText('描述')).toHaveValue('Private notes');
    expect(screen.queryByText('Memory')).not.toBeInTheDocument();
    expect(onWorkspaceReady).not.toHaveBeenCalled();
  });

  it('requires a fresh folder selection after initialize returns an error', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-consumed',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_AGENTS_CONFLICT',
        message: 'Folder already contains AGENTS.md',
      },
    });

    renderCreateWorkspaceForm();

    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(reoWorkspace.initializeWorkspace).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('请选择记忆空间文件夹')).toBeInTheDocument();
  });

  it('validates on submit instead of trapping users in a disabled button', async () => {
    const user = userEvent.setup();

    renderCreateWorkspaceForm();

    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(await screen.findByText('请输入记忆空间名称')).toBeInTheDocument();
    expect(screen.getByText('请选择记忆空间文件夹')).toBeInTheDocument();
    expect(screen.getByLabelText('记忆空间名称')).toHaveFocus();
  });

  it('rejects workspace names that contain path separators', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'folder_token_unsafe_name',
        displayPath: 'Memories',
      },
    });

    renderCreateWorkspaceForm();

    await user.type(screen.getByLabelText('记忆空间名称'), 'Family/memories');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memories');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(
      await screen.findByText('记忆空间名称不能是 . 或 ..，也不能包含路径分隔符')
    ).toBeInTheDocument();
    expect(reoWorkspace.initializeWorkspace).not.toHaveBeenCalled();
  });

  it('submits the folder selection token instead of a raw filesystem path', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'folder_token_1',
        displayPath: 'Memories',
      },
    });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Family memories',
          description: '',
          memories: [],
        },
      },
    });

    renderCreateWorkspaceForm();

    await user.type(screen.getByLabelText('记忆空间名称'), 'Family memories');
    await user.type(screen.getByLabelText('描述'), 'Private notes for family');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memories');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(reoWorkspace.initializeWorkspace).toHaveBeenCalledWith({
      selectionToken: 'folder_token_1',
      title: 'Family memories',
      description: 'Private notes for family',
    });
    expect(reoWorkspace.initializeWorkspace).not.toHaveBeenCalledWith(
      expect.objectContaining({ displayPath: expect.any(String) })
    );
    expect(reoWorkspace.initializeWorkspace).not.toHaveBeenCalledWith(
      expect.objectContaining({ folderPath: expect.any(String) })
    );
  });

  it('rejects folder display names that contain path separators', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'folder_token_3',
        displayPath: '/Users/yck/Memories',
      },
    });

    renderCreateWorkspaceForm();

    await user.click(screen.getByRole('button', { name: '浏览' }));

    expect(toast.error).toHaveBeenCalledWith('无法创建记忆空间', {
      description: '请选择记忆空间文件夹',
    });
    expect(screen.queryByText('请选择记忆空间文件夹')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('/Users/yck/Memories')).not.toBeInTheDocument();
  });
});

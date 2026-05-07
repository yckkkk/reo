import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateWorkspaceForm } from './CreateWorkspaceForm';
import { WorkspaceEntryPage } from './WorkspaceEntryPage';

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
    appendRecordingAudioChunk: vi.fn(),
    finalizeRecordingDraft: vi.fn(),
    discardRecordingDraft: vi.fn(),
    getRecordingDetail: vi.fn(),
    readRecordingAudioManifest: vi.fn(),
    readRecordingAudioChunk: vi.fn(),
    saveTranscript: vi.fn(),
    saveReflections: vi.fn(),
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

  it('starts with title, description, folder picker, submit, and title focus', () => {
    render(<CreateWorkspaceForm onWorkspaceReady={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Create workspace' })).toBeInTheDocument();
    expect(screen.getByLabelText('Workspace title')).toHaveFocus();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose folder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeEnabled();
  });

  it('keeps form values and returns focus to the folder picker after OS dialog cancel', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({ ok: true, value: { status: 'canceled' } });

    render(<CreateWorkspaceForm onWorkspaceReady={vi.fn()} />);

    await user.type(screen.getByLabelText('Workspace title'), 'Daily memory');
    await user.type(screen.getByLabelText('Description'), 'Private notes');
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    expect(screen.getByLabelText('Workspace title')).toHaveValue('Daily memory');
    expect(screen.getByLabelText('Description')).toHaveValue('Private notes');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Choose folder' })).toHaveFocus()
    );
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeEnabled();
  });

  it('ignores repeated folder picker clicks while the OS dialog is pending', async () => {
    const user = userEvent.setup();
    const selection = deferred<Awaited<ReturnType<(typeof reoWorkspace)['chooseDirectory']>>>();
    reoWorkspace.chooseDirectory.mockReturnValue(selection.promise);

    render(<CreateWorkspaceForm onWorkspaceReady={vi.fn()} />);

    await user.dblClick(screen.getByRole('button', { name: 'Choose folder' }));

    expect(reoWorkspace.chooseDirectory).toHaveBeenCalledTimes(1);

    selection.resolve({ ok: true, value: { status: 'canceled' } });
  });

  it('shows an alert for existing AGENTS.md conflict without clearing user input', async () => {
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

    render(<CreateWorkspaceForm onWorkspaceReady={onWorkspaceReady} />);

    await user.type(screen.getByLabelText('Workspace title'), 'Daily memory');
    await user.type(screen.getByLabelText('Description'), 'Private notes');
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already contains AGENTS.md');
    expect(screen.getByLabelText('Workspace title')).toHaveValue('Daily memory');
    expect(screen.getByLabelText('Description')).toHaveValue('Private notes');
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

    render(<CreateWorkspaceForm onWorkspaceReady={vi.fn()} />);

    await user.type(screen.getByLabelText('Workspace title'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    expect(reoWorkspace.initializeWorkspace).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Choose a workspace folder')).toBeInTheDocument();
  });

  it('validates on submit instead of trapping users in a disabled button', async () => {
    const user = userEvent.setup();

    render(<WorkspaceEntryPage onWorkspaceReady={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    expect(await screen.findByText('Workspace title is required')).toBeInTheDocument();
    expect(screen.getByText('Choose a workspace folder')).toBeInTheDocument();
    expect(screen.getByLabelText('Workspace title')).toHaveFocus();
  });

  it('keeps create draft values while opening an existing workspace', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'canceled',
      },
    });

    render(<WorkspaceEntryPage onWorkspaceReady={vi.fn()} />);

    await user.type(screen.getByLabelText('Workspace title'), 'Family memories');
    await user.click(screen.getByRole('button', { name: 'Open workspace' }));

    expect(screen.getByDisplayValue('Family memories')).toBeInTheDocument();
    expect(screen.queryByText(/already contains AGENTS.md/i)).not.toBeInTheDocument();
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
          recordings: [],
        },
      },
    });

    render(<WorkspaceEntryPage onWorkspaceReady={vi.fn()} />);

    await user.type(screen.getByLabelText('Workspace title'), 'Family memories');
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await screen.findByText('Memories');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    expect(reoWorkspace.initializeWorkspace).toHaveBeenCalledWith({
      selectionToken: 'folder_token_1',
      title: 'Family memories',
      description: '',
    });
    expect(reoWorkspace.initializeWorkspace).not.toHaveBeenCalledWith(
      expect.objectContaining({ displayPath: expect.any(String) })
    );
    expect(reoWorkspace.initializeWorkspace).not.toHaveBeenCalledWith(
      expect.objectContaining({ folderPath: expect.any(String) })
    );
  });

  it('shows open errors separately from the create form draft', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'folder_token_2',
        displayPath: 'Existing workspace',
      },
    });
    reoWorkspace.openWorkspace.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_LOCKED',
        message: 'Workspace is already open in another Reo window',
      },
    });

    render(<WorkspaceEntryPage onWorkspaceReady={vi.fn()} />);

    await user.type(screen.getByLabelText('Workspace title'), 'Family memories');
    await user.click(screen.getByRole('button', { name: 'Open workspace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already open');
    expect(screen.getByDisplayValue('Family memories')).toBeInTheDocument();
    expect(screen.queryByText(/already contains AGENTS.md/i)).not.toBeInTheDocument();
    expect(reoWorkspace.openWorkspace).toHaveBeenCalledWith({ selectionToken: 'folder_token_2' });
  });

  it('ignores repeated open clicks while the OS dialog is pending', async () => {
    const user = userEvent.setup();
    const selection = deferred<Awaited<ReturnType<(typeof reoWorkspace)['chooseDirectory']>>>();
    reoWorkspace.chooseDirectory.mockReturnValue(selection.promise);

    render(<WorkspaceEntryPage onWorkspaceReady={vi.fn()} />);

    await user.dblClick(screen.getByRole('button', { name: 'Open workspace' }));

    expect(reoWorkspace.chooseDirectory).toHaveBeenCalledTimes(1);

    selection.resolve({ ok: true, value: { status: 'canceled' } });
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

    render(<WorkspaceEntryPage onWorkspaceReady={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a workspace folder');
    expect(screen.queryByText('/Users/yck/Memories')).not.toBeInTheDocument();
  });
});

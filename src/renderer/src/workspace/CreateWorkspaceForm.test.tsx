import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateWorkspaceForm } from './CreateWorkspaceForm';

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
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeDisabled();
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
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeDisabled();
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
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(onWorkspaceReady).not.toHaveBeenCalled();
  });
});

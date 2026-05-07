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

  it('renders starter home and opens workspace creation from the plus action', async () => {
    const user = userEvent.setup();
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    expect(screen.getByRole('navigation', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All memories' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create workspace' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByLabelText('Workspace title')).toHaveFocus();
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

    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(
      screen.getByRole('main', { name: 'Workspace content' }).closest('[data-theme]')
    ).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    await user.type(screen.getByLabelText('Workspace title'), 'Daily memory');
    await user.type(screen.getByLabelText('Description'), 'Private notes');
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    expect(await screen.findByRole('heading', { name: 'All memories' })).toBeInTheDocument();
    expect(
      screen.getByRole('main', { name: 'Workspace content' }).closest('[data-theme]')
    ).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByText('Daily memory')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Workspace content' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search memories' })).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    await user.type(screen.getByLabelText('Workspace title'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    await user.click(await screen.findByRole('button', { name: 'Record memory' }));

    expect(screen.getByRole('dialog', { name: 'Recording' })).toBeInTheDocument();
  });

  it('opens workspace creation with a named and described dialog', async () => {
    const user = userEvent.setup();
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    const dialog = screen.getByRole('dialog', {
      description: /keeps user content in this folder/i,
      name: 'Create workspace',
    });
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
  });

  it('opens an existing workspace from the entry dialog', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    await user.click(screen.getByRole('button', { name: 'Open workspace' }));

    expect(await screen.findByRole('heading', { name: 'All memories' })).toBeInTheDocument();
    expect(screen.getByText('Existing memory')).toBeInTheDocument();
    expect(reoWorkspace.openWorkspace).toHaveBeenCalledWith({
      selectionToken: 'selection-token-open',
    });
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

    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    await user.type(screen.getByLabelText('Workspace title'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    await user.click(await screen.findByRole('button', { name: 'Open My seventh birthday' }));

    expect(await screen.findByRole('heading', { name: 'My seventh birthday' })).toBeInTheDocument();
    expect(screen.getByText('Birthday_summary_01')).toBeInTheDocument();
    expect(reoWorkspace.getMemoryDetail).toHaveBeenCalledWith({
      workspaceHandle: 'workspace-handle-1',
      memoryId: 'mem_birthday',
    });

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'All memories' })).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    await user.type(screen.getByLabelText('Workspace title'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    await user.click(await screen.findByRole('button', { name: 'Open My seventh birthday' }));
    await screen.findByRole('heading', { name: 'My seventh birthday' });
    await user.click(screen.getByRole('button', { name: 'Record memory' }));
    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    await screen.findByRole('button', { name: 'Stop recording' });
    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    await screen.findByRole('heading', { name: 'Edit recording' });

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

    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    await user.type(screen.getByLabelText('Workspace title'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    await user.click(await screen.findByRole('button', { name: 'Open My seventh birthday' }));
    await screen.findByRole('heading', { name: 'My seventh birthday' });
    await user.click(screen.getByRole('button', { name: 'Record memory' }));

    expect(screen.getByRole('dialog', { name: 'Recording' })).toBeInTheDocument();
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

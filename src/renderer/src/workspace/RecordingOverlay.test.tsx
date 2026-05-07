import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingOverlay } from './RecordingOverlay';
import type {
  RecordingMediaAdapter,
  RecordingMediaController,
  RecordingMediaHandlers,
} from './mediaRecorderAdapter';
import type { WorkspaceSession } from './workspaceApi';

const workspaceSession: WorkspaceSession = {
  workspaceHandle: 'workspace-handle-secret',
  workspaceId: 'ws_1',
  snapshot: {
    workspaceId: 'ws_1',
    title: 'Daily memory',
    description: '',
    memories: [],
    recordings: [],
  },
};

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

type AppendResponse = Awaited<ReturnType<Window['reoWorkspace']['appendRecordingAudioChunk']>>;

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function installWorkspaceBridge(overrides: Partial<Window['reoWorkspace']> = {}) {
  const bridge: Window['reoWorkspace'] = {
    chooseDirectory: vi.fn(),
    initializeWorkspace: vi.fn(),
    openWorkspace: vi.fn(),
    closeWorkspace: vi.fn(),
    createRecordingDraft: vi.fn(async () => ({
      ok: true as const,
      value: { nextSequence: 0, recordingId: 'rec_1' },
    })),
    appendRecordingAudioChunk: vi.fn(async () => ({
      ok: true as const,
      value: { nextSequence: 1 },
    })),
    finalizeRecordingDraft: vi.fn(async () => ({
      ok: true as const,
      value: {
        memory: {
          audioByteLength: 3,
          createdAt: '2026-05-06T13:08:00.000Z',
          durationMs: 0,
          hasReflections: false,
          hasTranscript: false,
          memoryId: 'mem_1',
          recordingCount: 1,
          title: 'Daily memory recording',
          updatedAt: '2026-05-06T13:08:00.000Z',
        },
        recording: {
          audioByteLength: 3,
          durationMs: 0,
          memoryId: 'mem_1',
          recordingId: 'rec_1',
          title: 'Daily memory recording',
        },
      },
    })),
    discardRecordingDraft: vi.fn(async () => ({
      ok: true as const,
      value: { discarded: true as const },
    })),
    getMemoryDetail: vi.fn(),
    getRecordingDetail: vi.fn(),
    readRecordingAudioManifest: vi.fn(async () => ({
      ok: true as const,
      value: { byteLength: 3, maxChunkBytes: 2, recordingId: 'rec_1' },
    })),
    readRecordingAudioChunk: vi
      .fn()
      .mockResolvedValueOnce({ ok: true as const, value: { chunk: new Uint8Array([1, 2]) } })
      .mockResolvedValueOnce({ ok: true as const, value: { chunk: new Uint8Array([3]) } }),
    saveTranscript: vi.fn(async () => ({
      ok: true as const,
      value: { saved: true as const },
    })),
    saveReflections: vi.fn(async () => ({ ok: true as const, value: { saved: true as const } })),
    beginMicrophoneIntent: vi.fn(async () => ({
      ok: true as const,
      value: { registered: true as const },
    })),
    clearMicrophoneIntent: vi.fn(async () => ({
      ok: true as const,
      value: { cleared: true as const },
    })),
    ...overrides,
  };
  Object.defineProperty(window, 'reoWorkspace', {
    configurable: true,
    value: bridge,
  });
  return bridge;
}

function createMediaAdapter() {
  const handlers: RecordingMediaHandlers[] = [];
  const controller: RecordingMediaController = {
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(async () => {
      handlers.at(-1)?.onStop();
    }),
  };
  const adapter: RecordingMediaAdapter = {
    start: vi.fn(async (nextHandlers) => {
      handlers.push(nextHandlers);
      return controller;
    }),
  };
  return {
    adapter,
    controller,
    emitChunk: (chunk: Uint8Array, index = handlers.length - 1) => handlers[index]?.onChunk(chunk),
    emitError: (message: string, index = handlers.length - 1) => handlers[index]?.onError(message),
  };
}

describe('RecordingOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('pauses and resumes timer plus local mock transcript', async () => {
    installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    expect(screen.getByText(/Status: recording/)).toBeInTheDocument();
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();
    expect(window.reoWorkspace.appendRecordingAudioChunk).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/Mock transcript 1s/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pause recording' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText(/Mock transcript 2s/)).not.toBeInTheDocument();
    expect(media.controller.pause).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Resume recording' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/Mock transcript 2s/)).toBeInTheDocument();
    expect(media.controller.resume).toHaveBeenCalledTimes(1);
  });

  it('waits for the final append acknowledgement before finalize', async () => {
    const append = createDeferred<AppendResponse>();
    const bridge = installWorkspaceBridge({
      appendRecordingAudioChunk: vi.fn(() => append.promise),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    expect(screen.getByText(/Status: recording/)).toBeInTheDocument();
    act(() => media.emitChunk(new Uint8Array([1])));
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    append.resolve({ ok: true, value: { nextSequence: 1 } });
    await flushPromises();
    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Edit recording' })).toBeInTheDocument();
  });

  it('passes the elapsed recording duration to finalize', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledWith({
      durationMs: 2000,
      recordingId: 'rec_1',
      title: 'Daily memory recording',
      workspaceHandle: 'workspace-handle-secret',
    });
  });

  it('uses sub-second recording duration instead of the rounded display timer', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();
    act(() => vi.advanceTimersByTime(750));
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledWith({
      durationMs: 750,
      recordingId: 'rec_1',
      title: 'Daily memory recording',
      workspaceHandle: 'workspace-handle-secret',
    });
  });

  it('does not expose stop or finalize before the media controller is ready', async () => {
    const controller: RecordingMediaController = {
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    };
    const start = createDeferred<RecordingMediaController>();
    const bridge = installWorkspaceBridge();
    const adapter: RecordingMediaAdapter = {
      start: vi.fn(() => start.promise),
    };

    render(
      <RecordingOverlay
        mediaAdapter={adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();

    expect(screen.getByText(/Status: acquiring/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop recording' })).not.toBeInTheDocument();
    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();

    start.resolve(controller);
    await flushPromises();
    expect(screen.getByText(/Status: recording/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
  });

  it('opens a microphone intent before media acquisition starts', async () => {
    const order: string[] = [];
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi.fn(async () => {
        order.push('create-draft');
        return {
          ok: true as const,
          value: { nextSequence: 0, recordingId: 'rec_1' },
        };
      }),
      beginMicrophoneIntent: vi.fn(async () => {
        order.push('begin-intent');
        return {
          ok: true as const,
          value: { registered: true as const },
        };
      }),
    });
    const media = createMediaAdapter();
    const controller: RecordingMediaController = {
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    };
    vi.mocked(media.adapter.start).mockImplementation(async () => {
      order.push('media-start');
      return controller;
    });

    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();

    expect(order).toEqual(['begin-intent', 'create-draft', 'media-start']);
    expect(bridge.beginMicrophoneIntent).toHaveBeenCalledWith({
      drawerSessionId: 'recording-1',
      workspaceHandle: 'workspace-handle-secret',
    });
  });

  it('does not start media acquisition when microphone intent is rejected', async () => {
    const bridge = installWorkspaceBridge({
      beginMicrophoneIntent: vi.fn(async () => ({
        error: {
          code: 'ERR_MIC_INTENT_ALREADY_ACTIVE',
          message: 'Microphone intent already active',
        },
        ok: false as const,
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();

    expect(media.adapter.start).not.toHaveBeenCalled();
    expect(bridge.createRecordingDraft).not.toHaveBeenCalled();
    expect(bridge.discardRecordingDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Microphone intent already active');
  });

  it('clears microphone intent when draft creation fails after intent registration', async () => {
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi.fn(async () => ({
        error: { code: 'ERR_WORKSPACE_LOCK_LOST', message: 'Workspace lock was lost' },
        ok: false as const,
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();

    expect(media.adapter.start).not.toHaveBeenCalled();
    expect(bridge.clearMicrophoneIntent).toHaveBeenCalledWith({
      drawerSessionId: 'recording-1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Workspace lock was lost');
  });

  it('clears microphone intent when begin resolves after unmount', async () => {
    const begin =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['beginMicrophoneIntent']>>>();
    const bridge = installWorkspaceBridge({
      beginMicrophoneIntent: vi.fn(() => begin.promise),
    });
    const media = createMediaAdapter();

    const { unmount } = render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    unmount();
    begin.resolve({ ok: true, value: { registered: true } });
    await flushPromises();

    expect(bridge.clearMicrophoneIntent).toHaveBeenCalledWith({
      drawerSessionId: 'recording-1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(bridge.createRecordingDraft).not.toHaveBeenCalled();
    expect(media.adapter.start).not.toHaveBeenCalled();
  });

  it('clears microphone intent and discards the draft when unmounted during draft creation', async () => {
    const draft =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['createRecordingDraft']>>>();
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi.fn(() => draft.promise),
    });
    const media = createMediaAdapter();

    const { unmount } = render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    unmount();

    expect(bridge.clearMicrophoneIntent).toHaveBeenCalledWith({
      drawerSessionId: 'recording-1',
      workspaceHandle: 'workspace-handle-secret',
    });

    draft.resolve({ ok: true, value: { nextSequence: 0, recordingId: 'rec_1' } });
    await flushPromises();

    expect(bridge.discardRecordingDraft).toHaveBeenCalledWith({
      recordingId: 'rec_1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(media.adapter.start).not.toHaveBeenCalled();
  });

  it('discards the draft when unmounted while media acquisition is pending', async () => {
    const start = createDeferred<RecordingMediaController>();
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();
    const controller: RecordingMediaController = {
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    };
    vi.mocked(media.adapter.start).mockReturnValue(start.promise);

    const { unmount } = render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    unmount();

    expect(bridge.clearMicrophoneIntent).toHaveBeenCalledWith({
      drawerSessionId: 'recording-1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(bridge.discardRecordingDraft).toHaveBeenCalledWith({
      recordingId: 'rec_1',
      workspaceHandle: 'workspace-handle-secret',
    });

    start.resolve(controller);
    await flushPromises();

    expect(controller.stop).toHaveBeenCalled();
  });

  it('clears microphone intent when the workspace handle changes during draft creation', async () => {
    const draft =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['createRecordingDraft']>>>();
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi.fn(() => draft.promise),
    });
    const media = createMediaAdapter();
    const nextWorkspaceSession: WorkspaceSession = {
      ...workspaceSession,
      workspaceHandle: 'workspace-handle-next',
      workspaceId: 'ws_2',
      snapshot: {
        ...workspaceSession.snapshot,
        workspaceId: 'ws_2',
      },
    };

    const { rerender } = render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    rerender(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={nextWorkspaceSession}
      />
    );

    expect(bridge.clearMicrophoneIntent).toHaveBeenCalledWith({
      drawerSessionId: 'recording-1',
      workspaceHandle: 'workspace-handle-secret',
    });

    draft.resolve({ ok: true, value: { nextSequence: 0, recordingId: 'rec_1' } });
    await flushPromises();

    expect(bridge.discardRecordingDraft).toHaveBeenCalledWith({
      recordingId: 'rec_1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(media.adapter.start).not.toHaveBeenCalled();
  });

  it('does not finalize when audio append returns an error envelope', async () => {
    const bridge = installWorkspaceBridge({
      appendRecordingAudioChunk: vi.fn(async () => ({
        error: { code: 'ERR_RECORDING_SEQUENCE', message: 'Append failed' },
        ok: false as const,
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    expect(screen.getByText(/Status: recording/)).toBeInTheDocument();
    act(() => media.emitChunk(new Uint8Array([1])));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Append failed');
    expect(screen.getByText(/Status: failed/)).toBeInTheDocument();
    expect(media.controller.stop).toHaveBeenCalledTimes(1);
  });

  it('does not finalize when audio append rejects', async () => {
    const bridge = installWorkspaceBridge({
      appendRecordingAudioChunk: vi.fn(async () => {
        throw new Error('Append rejected');
      }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    expect(screen.getByText(/Status: recording/)).toBeInTheDocument();
    act(() => media.emitChunk(new Uint8Array([1])));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Append rejected');
    expect(screen.getByText(/Status: failed/)).toBeInTheDocument();
    expect(media.controller.stop).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale stop click after recording failure', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    const staleStop = screen.getByRole('button', { name: 'Stop recording' });
    act(() => media.emitError('Microphone failed', 0));
    fireEvent.click(staleStop);
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(bridge.discardRecordingDraft).toHaveBeenCalledWith({
      recordingId: 'rec_1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(screen.getByText(/Status: failed/)).toBeInTheDocument();
  });

  it('discards the draft when media acquisition fails after draft creation', async () => {
    const bridge = installWorkspaceBridge();
    const adapter: RecordingMediaAdapter = {
      start: vi.fn(async () => {
        throw new Error('Microphone unavailable');
      }),
    };

    render(
      <RecordingOverlay
        mediaAdapter={adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();

    expect(bridge.discardRecordingDraft).toHaveBeenCalledWith({
      recordingId: 'rec_1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(bridge.clearMicrophoneIntent).toHaveBeenCalledWith({
      drawerSessionId: 'recording-1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Microphone unavailable');
  });

  it('cleans up a failed recorder before retry and ignores stale chunks', async () => {
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, recordingId: 'rec_old' },
        })
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, recordingId: 'rec_new' },
        }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    expect(screen.getByText(/Status: recording/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/Mock transcript 1s/)).toBeInTheDocument();
    act(() => media.emitError('Microphone failed', 0));
    await flushPromises();
    expect(screen.getByText(/Status: failed/)).toBeInTheDocument();
    expect(media.controller.stop).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    expect(screen.getByText(/Status: recording/)).toBeInTheDocument();
    expect(screen.queryByText(/Mock transcript 1s/)).not.toBeInTheDocument();
    act(() => media.emitChunk(new Uint8Array([1]), 0));
    act(() => media.emitChunk(new Uint8Array([2]), 1));
    await flushPromises();

    expect(bridge.appendRecordingAudioChunk).toHaveBeenCalledTimes(1);
    expect(bridge.appendRecordingAudioChunk).toHaveBeenCalledWith({
      chunk: new Uint8Array([2]),
      recordingId: 'rec_new',
      sequence: 0,
      workspaceHandle: 'workspace-handle-secret',
    });
  });

  it('ignores a stale stop click from a failed recording after retry starts a new draft', async () => {
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, recordingId: 'rec_old' },
        })
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, recordingId: 'rec_new' },
        }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    const staleStop = screen.getByRole('button', { name: 'Stop recording' });
    act(() => media.emitError('Microphone failed', 0));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    expect(screen.getByText(/Status: recording/)).toBeInTheDocument();
    fireEvent.click(staleStop);
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(media.controller.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Status: recording/)).toBeInTheDocument();
  });

  it('keeps transcript draft when autosave fails', async () => {
    installWorkspaceBridge({
      saveTranscript: vi.fn(async () => ({
        error: { code: 'ERR_RECORDING_NOT_FOUND', message: 'Save failed' },
        ok: false as const,
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    expect(screen.getByText(/Status: recording/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await flushPromises();
    const transcript = screen.getByRole('textbox', { name: 'Transcript' });

    fireEvent.change(transcript, { target: { value: 'Edited local transcript' } });
    act(() => vi.advanceTimersByTime(500));
    await flushPromises();

    expect(screen.getByRole('alert')).toHaveTextContent('Save failed');
    expect(transcript).toHaveValue('Edited local transcript');
  });

  it('reads audio through manifest and chunks, then revokes Blob URL on close', async () => {
    const bridge = installWorkspaceBridge();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const media = createMediaAdapter();
    const { unmount } = render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    expect(screen.getByText(/Status: recording/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: 'Play recording' }));
    await flushPromises();

    const manifestCallOrder = vi.mocked(bridge.readRecordingAudioManifest).mock
      .invocationCallOrder[0];
    const chunkCallOrder = vi.mocked(bridge.readRecordingAudioChunk).mock.invocationCallOrder[0];
    expect(manifestCallOrder).toBeDefined();
    expect(chunkCallOrder).toBeDefined();
    if (manifestCallOrder === undefined || chunkCallOrder === undefined) {
      throw new Error('Missing playback call order');
    }
    expect(manifestCallOrder).toBeLessThan(chunkCallOrder);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Recording playback')).toHaveAttribute('src', 'blob:recording');

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:recording');
  });

  it('revokes playback Blob URL when closing the recording panel', async () => {
    installWorkspaceBridge();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();
    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: 'Play recording' }));
    await flushPromises();
    expect(screen.getByLabelText('Recording playback')).toHaveAttribute('src', 'blob:recording');

    fireEvent.click(screen.getByRole('button', { name: 'Close recording panel' }));
    await flushPromises();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:recording');
    expect(screen.queryByLabelText('Recording playback')).not.toBeInTheDocument();
  });

  it('does not create a Blob URL when playback finishes after closing the recording panel', async () => {
    const pending = createDeferred<{ ok: true; value: { chunk: Uint8Array } }>();
    installWorkspaceBridge({
      readRecordingAudioChunk: vi.fn(() => pending.promise),
    });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();
    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: 'Play recording' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: 'Close recording panel' }));
    pending.resolve({ ok: true, value: { chunk: new Uint8Array([1, 2, 3]) } });
    await flushPromises();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Recording playback')).not.toBeInTheDocument();
  });

  it('does not create a Blob URL when playback finishes after unmount', async () => {
    const pending = createDeferred<{ ok: true; value: { chunk: Uint8Array } }>();
    installWorkspaceBridge({
      readRecordingAudioChunk: vi.fn(() => pending.promise),
    });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording');
    const media = createMediaAdapter();
    const { unmount } = render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: 'Play recording' }));
    await flushPromises();
    unmount();
    pending.resolve({ ok: true, value: { chunk: new Uint8Array([1, 2, 3]) } });
    await flushPromises();

    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('limits playback chunk reads to four concurrent requests', async () => {
    const pending: Array<() => void> = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const bridge = installWorkspaceBridge({
      readRecordingAudioManifest: vi.fn(async () => ({
        ok: true as const,
        value: { byteLength: 10, maxChunkBytes: 1, recordingId: 'rec_1' },
      })),
      readRecordingAudioChunk: vi.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>((resolve) => pending.push(resolve));
        inFlight -= 1;
        return { ok: true as const, value: { chunk: new Uint8Array([1]) } };
      }),
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording');
    const media = createMediaAdapter();
    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: 'Play recording' }));
    await flushPromises();

    expect(bridge.readRecordingAudioChunk).toHaveBeenCalledTimes(4);
    expect(maxInFlight).toBe(4);

    act(() => pending.shift()?.());
    await flushPromises();
    expect(bridge.readRecordingAudioChunk).toHaveBeenCalledTimes(5);
    expect(maxInFlight).toBe(4);

    while (pending.length > 0) {
      act(() => {
        pending.splice(0).forEach((resolve) => resolve());
      });
      await flushPromises();
    }

    expect(screen.getByLabelText('Recording playback')).toHaveAttribute('src', 'blob:recording');
  });

  it('stops scheduling playback chunks after closing the recording panel', async () => {
    const pending: Array<() => void> = [];
    const bridge = installWorkspaceBridge({
      readRecordingAudioManifest: vi.fn(async () => ({
        ok: true as const,
        value: { byteLength: 10, maxChunkBytes: 1, recordingId: 'rec_1' },
      })),
      readRecordingAudioChunk: vi.fn(async () => {
        await new Promise<void>((resolve) => pending.push(resolve));
        return { ok: true as const, value: { chunk: new Uint8Array([1]) } };
      }),
    });
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();
    render(
      <RecordingOverlay
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: 'Play recording' }));
    await flushPromises();
    expect(bridge.readRecordingAudioChunk).toHaveBeenCalledTimes(4);

    fireEvent.click(screen.getByRole('button', { name: 'Close recording panel' }));
    act(() => pending.shift()?.());
    await flushPromises();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(bridge.readRecordingAudioChunk).toHaveBeenCalledTimes(4);
  });
});

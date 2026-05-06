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
      value: { audioByteLength: 3, recordingId: 'rec_1', title: 'Daily memory recording' },
    })),
    discardRecordingDraft: vi.fn(),
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
    ...overrides,
  };
  Object.defineProperty(window, 'reoWorkspace', {
    configurable: true,
    value: bridge,
  });
  return bridge;
}

function createMediaAdapter() {
  let handlers: RecordingMediaHandlers | null = null;
  const controller: RecordingMediaController = {
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(async () => {
      handlers?.onStop();
    }),
  };
  const adapter: RecordingMediaAdapter = {
    start: vi.fn(async (nextHandlers) => {
      handlers = nextHandlers;
      return controller;
    }),
  };
  return { adapter, controller, emitChunk: (chunk: Uint8Array) => handlers?.onChunk(chunk) };
}

describe('RecordingOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
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
    const append = createDeferred<{
      readonly ok: true;
      readonly value: { readonly nextSequence: 1 };
    }>();
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
});

import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingOverlay, type RecordingTarget } from './RecordingOverlay';
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
  },
};

const newMemoryTarget = { kind: 'new-memory' } satisfies RecordingTarget;

type RecordingOverlayForTestProps = Omit<
  ComponentProps<typeof RecordingOverlay>,
  'recordingTarget'
> & {
  readonly recordingTarget?: RecordingTarget;
};

function RecordingOverlayForTest({
  recordingTarget = newMemoryTarget,
  ...props
}: RecordingOverlayForTestProps) {
  return <RecordingOverlay recordingTarget={recordingTarget} {...props} />;
}

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
    listMemorySpaces: vi.fn(async () => ({ ok: true as const, value: { memorySpaces: [] } })),
    initializeWorkspace: vi.fn(),
    openWorkspace: vi.fn(),
    openMemorySpace: vi.fn(),
    removeMemorySpace: vi.fn(),
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
          title: 'Daily memory 录音',
          updatedAt: '2026-05-06T13:08:00.000Z',
        },
        recording: {
          audioByteLength: 3,
          durationMs: 0,
          memoryId: 'mem_1',
          recordingId: 'rec_1',
          title: 'Daily memory 录音',
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

function expectNoMockTranscript() {
  expect(screen.queryByText(/Mock transcript/i)).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue(/Mock transcript/i)).not.toBeInTheDocument();
}

describe('RecordingOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('pauses and resumes the timer without synthesizing transcript text', async () => {
    installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    expect(screen.getByText(/正在录制本地音频/)).toBeInTheDocument();
    expect(screen.getByLabelText('音频波形')).toBeInTheDocument();
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();
    expect(window.reoWorkspace.appendRecordingAudioChunk).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/已录制：1 秒/)).toBeInTheDocument();
    expectNoMockTranscript();

    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/已录制：1 秒/)).toBeInTheDocument();
    expectNoMockTranscript();
    expect(media.controller.pause).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '继续录音' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/已录制：2 秒/)).toBeInTheDocument();
    expectNoMockTranscript();
    expect(media.controller.resume).toHaveBeenCalledTimes(1);
  });

  it('waits for the final append acknowledgement before finalize', async () => {
    const append = createDeferred<AppendResponse>();
    const bridge = installWorkspaceBridge({
      appendRecordingAudioChunk: vi.fn(() => append.promise),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    expect(screen.getByText(/正在录制本地音频/)).toBeInTheDocument();
    act(() => media.emitChunk(new Uint8Array([1])));
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    append.resolve({ ok: true, value: { nextSequence: 1 } });
    await flushPromises();
    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: '编辑录音' })).toBeInTheDocument();
  });

  it('passes the elapsed recording duration to finalize', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledWith({
      durationMs: 2000,
      recordingId: 'rec_1',
      title: 'Daily memory 录音',
      workspaceHandle: 'workspace-handle-secret',
    });
  });

  it('passes the current memory target when recording from memory detail', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        recordingTarget={{ kind: 'existing-memory', memoryId: 'mem_birthday' }}
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        memoryId: 'mem_birthday',
        recordingId: 'rec_1',
        workspaceHandle: 'workspace-handle-secret',
      })
    );
  });

  it('uses sub-second recording duration instead of the rounded display timer', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();
    act(() => vi.advanceTimersByTime(750));
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledWith({
      durationMs: 750,
      recordingId: 'rec_1',
      title: 'Daily memory 录音',
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
      <RecordingOverlayForTest
        mediaAdapter={adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();

    expect(screen.getByText(/正在准备麦克风权限/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '停止录音' })).not.toBeInTheDocument();
    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();

    start.resolve(controller);
    await flushPromises();
    expect(screen.getByText(/正在录制本地音频/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '停止录音' })).toBeInTheDocument();
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
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
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
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();

    expect(media.adapter.start).not.toHaveBeenCalled();
    expect(bridge.createRecordingDraft).not.toHaveBeenCalled();
    expect(bridge.discardRecordingDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('麦克风正在被另一个录音流程使用。');
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
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();

    expect(media.adapter.start).not.toHaveBeenCalled();
    expect(bridge.clearMicrophoneIntent).toHaveBeenCalledWith({
      drawerSessionId: 'recording-1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(screen.getByRole('alert')).toHaveTextContent('记忆空间锁已失效。');
  });

  it('clears microphone intent when begin resolves after unmount', async () => {
    const begin =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['beginMicrophoneIntent']>>>();
    const bridge = installWorkspaceBridge({
      beginMicrophoneIntent: vi.fn(() => begin.promise),
    });
    const media = createMediaAdapter();

    const { unmount } = render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
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
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
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
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
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
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    rerender(
      <RecordingOverlayForTest
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
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    expect(screen.getByText(/正在录制本地音频/)).toBeInTheDocument();
    act(() => media.emitChunk(new Uint8Array([1])));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('录音片段顺序不正确。');
    expect(screen.getByText(/录音没有保存/)).toBeInTheDocument();
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
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    expect(screen.getByText(/正在录制本地音频/)).toBeInTheDocument();
    act(() => media.emitChunk(new Uint8Array([1])));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('音频写入失败。');
    expect(screen.getByText(/录音没有保存/)).toBeInTheDocument();
    expect(media.controller.stop).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale stop click after recording failure', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    const staleStop = screen.getByRole('button', { name: '停止录音' });
    act(() => media.emitError('Microphone failed', 0));
    fireEvent.click(staleStop);
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(bridge.discardRecordingDraft).toHaveBeenCalledWith({
      recordingId: 'rec_1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(screen.getByText(/录音没有保存/)).toBeInTheDocument();
  });

  it('discards the draft when media acquisition fails after draft creation', async () => {
    const bridge = installWorkspaceBridge();
    const adapter: RecordingMediaAdapter = {
      start: vi.fn(async () => {
        throw new Error('Microphone unavailable');
      }),
    };

    render(
      <RecordingOverlayForTest
        mediaAdapter={adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
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
    expect(screen.getByRole('alert')).toHaveTextContent('无法使用麦克风。');
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
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    expect(screen.getByText(/正在录制本地音频/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/已录制：1 秒/)).toBeInTheDocument();
    expectNoMockTranscript();
    act(() => media.emitError('Microphone failed', 0));
    await flushPromises();
    expect(screen.getByText(/录音没有保存/)).toBeInTheDocument();
    expect(media.controller.stop).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await flushPromises();
    expect(screen.getByText(/正在录制本地音频/)).toBeInTheDocument();
    expectNoMockTranscript();
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
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    const staleStop = screen.getByRole('button', { name: '停止录音' });
    act(() => media.emitError('Microphone failed', 0));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await flushPromises();
    expect(screen.getByText(/正在录制本地音频/)).toBeInTheDocument();
    fireEvent.click(staleStop);
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(media.controller.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/正在录制本地音频/)).toBeInTheDocument();
  });

  it('keeps transcript draft when autosave fails', async () => {
    const bridge = installWorkspaceBridge({
      saveTranscript: vi.fn(async () => ({
        error: { code: 'ERR_RECORDING_NOT_FOUND', message: 'Save failed' },
        ok: false as const,
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    expect(screen.getByText(/正在录制本地音频/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();
    const transcript = screen.getByRole('textbox', { name: '转写' });
    expect(transcript).toHaveValue('');

    fireEvent.change(transcript, { target: { value: 'Edited local transcript' } });
    act(() => vi.advanceTimersByTime(500));
    await flushPromises();

    expect(screen.getByRole('alert')).toHaveTextContent('找不到这段录音。');
    expect(bridge.saveTranscript).toHaveBeenCalledWith({
      markdown: 'Edited local transcript',
      memoryId: 'mem_1',
      recordingId: 'rec_1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(transcript).toHaveValue('Edited local transcript');
  });

  it('saves reflections with the finalized memory identity', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();
    fireEvent.change(screen.getByRole('textbox', { name: '反思' }), {
      target: { value: 'Local reflection' },
    });
    act(() => vi.advanceTimersByTime(500));
    await flushPromises();

    expect(bridge.saveReflections).toHaveBeenCalledWith({
      markdown: 'Local reflection',
      memoryId: 'mem_1',
      recordingId: 'rec_1',
      workspaceHandle: 'workspace-handle-secret',
    });
  });

  it('ignores transcript autosave results after the drawer is closed and reopened', async () => {
    const saveTranscript =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['saveTranscript']>>>();
    installWorkspaceBridge({
      saveTranscript: vi.fn(() => saveTranscript.promise),
    });
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();
    fireEvent.change(screen.getByRole('textbox', { name: '转写' }), {
      target: { value: 'Edited local transcript' },
    });
    act(() => vi.advanceTimersByTime(500));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '关闭录音面板' }));
    rerender(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingFinalized={() => {}}
        open={false}
        workspaceSession={workspaceSession}
      />
    );
    rerender(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );
    saveTranscript.resolve({
      error: { code: 'ERR_RECORDING_NOT_FOUND', message: 'Save failed' },
      ok: false,
    });
    await flushPromises();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByText(/可以开始录制本地音频/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reads audio through manifest and chunks, then revokes Blob URL on close', async () => {
    const bridge = installWorkspaceBridge();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const media = createMediaAdapter();
    const { unmount } = render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    expect(screen.getByText(/正在录制本地音频/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '加载录音' }));
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
    expect(bridge.readRecordingAudioManifest).toHaveBeenCalledWith({
      memoryId: 'mem_1',
      recordingId: 'rec_1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(bridge.readRecordingAudioChunk).toHaveBeenCalledWith({
      length: 2,
      memoryId: 'mem_1',
      offset: 0,
      recordingId: 'rec_1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('audio-player-audio')).toHaveAttribute('src', 'blob:recording');

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:recording');
  });

  it('shows local transcript preview and playback surface after editing', async () => {
    installWorkspaceBridge();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording');
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();
    fireEvent.change(screen.getByRole('textbox', { name: '转写' }), {
      target: { value: 'Edited local transcript' },
    });
    fireEvent.click(screen.getByRole('button', { name: '加载录音' }));
    await flushPromises();

    expect(screen.getByRole('region', { name: '转写预览' })).toHaveTextContent(
      'Edited local transcript'
    );
    expect(screen.getByRole('region', { name: '本地录音' })).toBeInTheDocument();
    expect(screen.getByTestId('audio-player-audio')).toHaveAttribute('src', 'blob:recording');
  });

  it('revokes playback Blob URL when closing the recording panel', async () => {
    installWorkspaceBridge();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();
    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '加载录音' }));
    await flushPromises();
    expect(screen.getByTestId('audio-player-audio')).toHaveAttribute('src', 'blob:recording');

    fireEvent.click(screen.getByRole('button', { name: '关闭录音面板' }));
    await flushPromises();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:recording');
    expect(screen.queryByTestId('audio-player-audio')).not.toBeInTheDocument();
  });

  it('resets the drawer to ready state when reopened after editing', async () => {
    installWorkspaceBridge();
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();
    expect(screen.getByRole('heading', { name: '编辑录音' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭录音面板' }));
    await flushPromises();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    rerender(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingFinalized={() => {}}
        open={false}
        workspaceSession={workspaceSession}
      />
    );
    rerender(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    expect(screen.getByRole('heading', { name: '录音' })).toBeInTheDocument();
    expect(screen.getByText(/可以开始录制本地音频/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始录音' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '转写' })).not.toBeInTheDocument();
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
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '加载录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '关闭录音面板' }));
    pending.resolve({ ok: true, value: { chunk: new Uint8Array([1, 2, 3]) } });
    await flushPromises();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByTestId('audio-player-audio')).not.toBeInTheDocument();
  });

  it('ignores a stale audio manifest failure after closing the recording panel', async () => {
    const pending =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['readRecordingAudioManifest']>>>();
    const bridge = installWorkspaceBridge({
      readRecordingAudioManifest: vi.fn(() => pending.promise),
    });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording');
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();
    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '加载录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '关闭录音面板' }));
    pending.resolve({
      error: { code: 'ERR_RECORDING_NOT_FOUND', message: 'Manifest failed' },
      ok: false,
    });
    await flushPromises();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(bridge.readRecordingAudioChunk).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not create a Blob URL when playback finishes after unmount', async () => {
    const pending = createDeferred<{ ok: true; value: { chunk: Uint8Array } }>();
    installWorkspaceBridge({
      readRecordingAudioChunk: vi.fn(() => pending.promise),
    });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording');
    const media = createMediaAdapter();
    const { unmount } = render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '加载录音' }));
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
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '加载录音' }));
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

    expect(screen.getByTestId('audio-player-audio')).toHaveAttribute('src', 'blob:recording');
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
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '加载录音' }));
    await flushPromises();
    expect(bridge.readRecordingAudioChunk).toHaveBeenCalledTimes(4);

    fireEvent.click(screen.getByRole('button', { name: '关闭录音面板' }));
    act(() => pending.shift()?.());
    await flushPromises();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(bridge.readRecordingAudioChunk).toHaveBeenCalledTimes(4);
  });

  it('stops scheduling playback chunks after a chunk read fails', async () => {
    type ChunkResponse = Awaited<ReturnType<Window['reoWorkspace']['readRecordingAudioChunk']>>;
    const pending: Array<(response: ChunkResponse) => void> = [];
    const bridge = installWorkspaceBridge({
      readRecordingAudioManifest: vi.fn(async () => ({
        ok: true as const,
        value: { byteLength: 10, maxChunkBytes: 1, recordingId: 'rec_1' },
      })),
      readRecordingAudioChunk: vi.fn(
        () => new Promise<ChunkResponse>((resolve) => pending.push(resolve))
      ),
    });
    const media = createMediaAdapter();
    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onRecordingFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '加载录音' }));
    await flushPromises();
    expect(bridge.readRecordingAudioChunk).toHaveBeenCalledTimes(4);

    act(() =>
      pending.shift()?.({
        error: { code: 'ERR_RECORDING_NOT_FOUND', message: 'Chunk failed' },
        ok: false,
      })
    );
    await flushPromises();
    act(() => pending.shift()?.({ ok: true, value: { chunk: new Uint8Array([1]) } }));
    await flushPromises();

    expect(screen.getByRole('alert')).toHaveTextContent('找不到这段录音。');
    expect(bridge.readRecordingAudioChunk).toHaveBeenCalledTimes(4);
  });
});

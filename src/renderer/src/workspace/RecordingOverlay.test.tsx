import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render as renderTestingLibrary, screen } from '@testing-library/react';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '@/components/ui/toaster';
import { createReoQueryClient } from '../queryClient';
import { voiceSettingsQueryKey } from '@/settings/voiceSettingsQueries';
import { RecordingOverlay, type RecordingTarget } from './RecordingOverlay';
import type {
  RecordingMediaAdapter,
  RecordingMediaController,
  RecordingMediaHandlers,
} from './mediaRecorderAdapter';
import type { VoiceTranscriptionSettings, WorkspaceSession } from './workspaceApi';

vi.mock('@/components/ui/toaster', () => {
  const toast = Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  });
  return { toast };
});

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

const existingMemoryTarget = {
  kind: 'existing-memory',
  memoryId: 'mem_1',
} satisfies RecordingTarget;
const savedMemorySummary = {
  audioByteLength: 3,
  createdAt: '2026-05-06T13:08:00.000Z',
  durationMs: 0,
  supplementCount: 0,
  hasTranscript: true,
  memoryId: 'mem_1',
  segmentCount: 1,
  title: 'Daily memory 录音',
  updatedAt: '2026-05-06T13:09:00.000Z',
};

function createVoiceSettingsSnapshot(enabled: boolean = true): VoiceTranscriptionSettings {
  return {
    enabled,
    apiKeyConfigured: enabled,
    apiKeyLastFour: enabled ? '1234' : null,
    lastValidatedAt: enabled ? '2026-05-16T09:00:00.000Z' : null,
    lastValidationOk: enabled ? true : null,
    lastValidationCode: enabled ? 'ok' : null,
  };
}

let voiceSettingsForTest = createVoiceSettingsSnapshot();

function render(ui: ReactElement, options: { readonly seedVoiceSettings?: boolean } = {}) {
  const queryClient = createReoQueryClient();
  if (options.seedVoiceSettings !== false) {
    queryClient.setQueryData(voiceSettingsQueryKey(), voiceSettingsForTest);
  }
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return {
    queryClient,
    ...renderTestingLibrary(ui, { wrapper: Wrapper }),
  };
}

type RecordingOverlayForTestProps = Omit<
  ComponentProps<typeof RecordingOverlay>,
  'recordingTarget'
> & {
  readonly recordingTarget?: RecordingTarget;
};

function RecordingOverlayForTest({
  recordingTarget = existingMemoryTarget,
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
type TranscriptionControlResponse = Awaited<
  ReturnType<Window['reoWorkspace']['finishRecordingTranscription']>
>;
type TranscriptionStartResponse = Awaited<
  ReturnType<Window['reoWorkspace']['startRecordingTranscription']>
>;

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
    revealMemorySpaceInFinder: vi.fn(),
    revealMemoryInFinder: vi.fn(),
    revealSegmentInFinder: vi.fn(),
    revealSegmentSupplementInFinder: vi.fn(),
    openMemorySpaceAgentsFile: vi.fn(),
    openMemoryDocument: vi.fn(),
    openSegmentDocument: vi.fn(),
    openSegmentSupplementDocument: vi.fn(),
    copyMemorySpaceAbsolutePath: vi.fn(),
    copyMemoryAbsolutePath: vi.fn(),
    copySegmentAbsolutePath: vi.fn(),
    copySegmentSupplementAbsolutePath: vi.fn(),
    copyMemoryRelativePath: vi.fn(),
    copySegmentRelativePath: vi.fn(),
    copySegmentSupplementRelativePath: vi.fn(),
    closeWorkspace: vi.fn(),
    readWorkspaceSnapshot: vi.fn(),
    createMemory: vi.fn(),
    deleteMemory: vi.fn(),
    restoreDeletedMemory: vi.fn(),
    deleteSegment: vi.fn(),
    restoreDeletedSegment: vi.fn(),
    deleteSegmentSupplement: vi.fn(),
    restoreDeletedSegmentSupplement: vi.fn(),
    readMemoryDetail: vi.fn(async () => ({
      ok: false as const,
      error: { code: 'ERR_MEMORY_NOT_FOUND' as const, message: 'Memory not found' },
    })),
    readFinalizedAudioSegment: vi.fn(async () => ({
      ok: false as const,
      error: { code: 'ERR_RECORDING_NOT_FOUND' as const, message: 'Recording not found' },
    })),
    readFinalizedAudioSegmentSupplement: vi.fn(async () => ({
      ok: false as const,
      error: { code: 'ERR_RECORDING_NOT_FOUND' as const, message: 'Recording not found' },
    })),
    createRecordingDraft: vi.fn(async () => ({
      ok: true as const,
      value: { nextSequence: 0, segmentId: 'seg_1' },
    })),
    createSegmentSupplementRecordingDraft: vi.fn(async () => ({
      ok: true as const,
      value: { supplementId: 'sup_1', nextSequence: 0 },
    })),
    readRecordingDraftAudio: vi.fn(async () => ({
      ok: false as const,
      error: { code: 'ERR_RECORDING_NOT_FOUND' as const, message: 'Recording draft not found' },
    })),
    appendRecordingAudioChunk: vi.fn(async () => ({
      ok: true as const,
      value: { nextSequence: 1 },
    })),
    appendSegmentSupplementRecordingAudioChunk: vi.fn(async () => ({
      ok: true as const,
      value: { nextSequence: 1 },
    })),
    cloneRecordingDraftPrefix: vi.fn(async () => ({
      ok: true as const,
      value: { audioByteLength: 3, nextSequence: 1 },
    })),
    finalizeRecordingDraft: vi.fn(async () => ({
      ok: true as const,
      value: {
        memory: {
          audioByteLength: 3,
          createdAt: '2026-05-06T13:08:00.000Z',
          durationMs: 0,
          supplementCount: 0,
          hasTranscript: false,
          memoryId: 'mem_1',
          segmentCount: 1,
          title: '录音1',
          updatedAt: '2026-05-06T13:08:00.000Z',
        },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          type: 'audio' as const,
          title: 'Daily memory 录音',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-06T13:08:00.000Z',
          audioByteLength: 3,
          durationMs: 0,
          transcript: { exists: false },
          supplementCount: 0,
          supplements: [],
        },
      },
    })),
    finalizeSegmentSupplementRecordingDraft: vi.fn(async () => ({
      ok: true as const,
      value: {
        memory: { ...savedMemorySummary, supplementCount: 1 },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          type: 'audio' as const,
          title: 'Daily memory 录音',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-06T13:09:00.000Z',
          durationMs: 0,
          audioByteLength: 3,
          transcript: { exists: true },
          supplementCount: 1,
          supplements: [
            {
              workspaceId: 'ws_1',
              memoryId: 'mem_1',
              segmentId: 'seg_1',
              supplementId: 'sup_1',
              type: 'audio' as const,
              title: '补充录音1',
              createdAt: '2026-05-06T13:09:00.000Z',
              updatedAt: '2026-05-06T13:10:00.000Z',
              durationMs: 0,
              audioByteLength: 1,
              transcript: { exists: false },
            },
          ],
        },
        supplement: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          supplementId: 'sup_1',
          type: 'audio' as const,
          title: '补充录音1',
          createdAt: '2026-05-06T13:09:00.000Z',
          updatedAt: '2026-05-06T13:10:00.000Z',
          durationMs: 0,
          audioByteLength: 1,
          transcript: { exists: false },
        },
      },
    })),
    discardRecordingDraft: vi.fn(async () => ({
      ok: true as const,
      value: { discarded: true as const },
    })),
    discardSegmentSupplementRecordingDraft: vi.fn(async () => ({
      ok: true as const,
      value: { discarded: true as const },
    })),
    updateMemorySpaceTitle: vi.fn(),
    updateMemoryTitle: vi.fn(),
    updateSegmentTitle: vi.fn(),
    updateSegmentSupplementTitle: vi.fn(),
    saveTranscript: vi.fn(async () => ({
      ok: true as const,
      value: { memory: savedMemorySummary, saved: true as const },
    })),
    saveSegmentSupplementTranscript: vi.fn(async () => ({
      ok: true as const,
      value: {
        memory: { ...savedMemorySummary, supplementCount: 1 },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          type: 'audio' as const,
          title: 'Daily memory 录音',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-06T13:09:00.000Z',
          durationMs: 0,
          audioByteLength: 3,
          transcript: { exists: true },
          supplementCount: 1,
          supplements: [
            {
              workspaceId: 'ws_1',
              memoryId: 'mem_1',
              segmentId: 'seg_1',
              supplementId: 'sup_1',
              type: 'audio' as const,
              title: '补充录音1',
              createdAt: '2026-05-06T13:09:00.000Z',
              updatedAt: '2026-05-06T13:10:00.000Z',
              durationMs: 0,
              audioByteLength: 1,
              transcript: { exists: true },
            },
          ],
        },
        supplement: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          supplementId: 'sup_1',
          type: 'audio' as const,
          title: '补充录音1',
          createdAt: '2026-05-06T13:09:00.000Z',
          updatedAt: '2026-05-06T13:10:00.000Z',
          durationMs: 0,
          audioByteLength: 1,
          transcript: { exists: true },
        },
        saved: true as const,
      },
    })),
    beginMicrophoneIntent: vi.fn(async () => ({
      ok: true as const,
      value: { registered: true as const },
    })),
    clearMicrophoneIntent: vi.fn(async () => ({
      ok: true as const,
      value: { cleared: true as const },
    })),
    startRecordingTranscription: vi.fn(async () => ({
      ok: true as const,
      value: { accepted: true as const },
    })),
    sendRecordingTranscriptionAudio: vi.fn(async () => ({
      ok: true as const,
      value: { accepted: true as const },
    })),
    finishRecordingTranscription: vi.fn(async () => ({
      ok: true as const,
      value: { accepted: true as const },
    })),
    closeRecordingTranscription: vi.fn(async () => ({
      ok: true as const,
      value: { accepted: true as const },
    })),
    readVoiceTranscriptionSettings: vi.fn(async () => ({
      ok: true as const,
      value: {
        settings: voiceSettingsForTest,
      },
    })),
    setVoiceTranscriptionEnabled: vi.fn(async () => ({
      ok: true as const,
      value: {
        settings: {
          enabled: false,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
          lastValidatedAt: null,
          lastValidationOk: null,
          lastValidationCode: null,
        },
      },
    })),
    saveVoiceTranscriptionApiKey: vi.fn(async () => ({
      ok: true as const,
      value: {
        settings: {
          enabled: false,
          apiKeyConfigured: true,
          apiKeyLastFour: '1234',
          lastValidatedAt: null,
          lastValidationOk: null,
          lastValidationCode: null,
        },
      },
    })),
    clearVoiceTranscriptionApiKey: vi.fn(async () => ({
      ok: true as const,
      value: {
        settings: {
          enabled: false,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
          lastValidatedAt: null,
          lastValidationOk: null,
          lastValidationCode: null,
        },
      },
    })),
    validateVoiceTranscriptionCredentials: vi.fn(async () => ({
      ok: true as const,
      value: { code: 'network' as const },
    })),
    openExternalUrl: vi.fn(async () => ({
      ok: true as const,
      value: {},
    })),
    onRecordingTranscriptionEvent: vi.fn(() => () => {}),
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
  const controllers: RecordingMediaController[] = [];
  const adapter: RecordingMediaAdapter = {
    start: vi.fn(async (nextHandlers) => {
      const handlerIndex = handlers.length;
      handlers.push(nextHandlers);
      const controller: RecordingMediaController = {
        flush: vi.fn(async () => true),
        pause: vi.fn(),
        resume: vi.fn(),
        stop: vi.fn(async () => {
          handlers[handlerIndex]?.onStop();
        }),
      };
      controllers.push(controller);
      return controller;
    }),
  };
  return {
    adapter,
    controllers,
    get controller() {
      const controller = controllers.at(-1);
      if (!controller) {
        throw new Error('Media controller has not started');
      }
      return controller;
    },
    emitChunk: (chunk: Uint8Array, index = handlers.length - 1) => handlers[index]?.onChunk(chunk),
    emitPcm: (chunk: Uint8Array, index = handlers.length - 1) =>
      handlers[index]?.onPcmChunk?.(chunk),
    emitLevel: (samples: readonly number[], index = handlers.length - 1) =>
      handlers[index]?.onLevel?.(samples),
    emitError: (message: string, index = handlers.length - 1) => handlers[index]?.onError(message),
  };
}

async function emitRecordedAudio(media: ReturnType<typeof createMediaAdapter>) {
  act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
  act(() => vi.advanceTimersByTime(2000));
  await flushPromises();
}

function mockWaveformRect(waveform: HTMLElement, width = 200, height = 88) {
  vi.spyOn(waveform, 'getBoundingClientRect').mockReturnValue({
    bottom: height,
    height,
    left: 0,
    right: width,
    toJSON: () => ({}),
    top: 0,
    width,
    x: 0,
    y: 0,
  });
}

function scrubPausedWaveformTo(progress: number) {
  const waveform = screen.getByRole('slider', { name: '暂停录音波形' });
  mockWaveformRect(waveform);
  fireEvent.pointerDown(waveform, {
    clientX: Math.round(200 * progress),
    pointerId: 1,
  });
  fireEvent.pointerUp(waveform, { pointerId: 1 });
  return waveform;
}

function expectNoMockTranscript() {
  expect(screen.queryByText(/Mock transcript/i)).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue(/Mock transcript/i)).not.toBeInTheDocument();
}

describe('RecordingOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    voiceSettingsForTest = createVoiceSettingsSnapshot();
    vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    window.localStorage.clear();
    vi.mocked(toast).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders the pre-recording state as a quiet immersive composer', () => {
    installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();
    const primaryPrompt = screen.getByText('从一个念头开始，慢慢说，我们会安静地为你记下。');
    expect(primaryPrompt).toBeInTheDocument();
    expect(screen.getByText('不必急着组织完整，想到哪里就说到哪里。')).toBeInTheDocument();
    expect(primaryPrompt.parentElement).toHaveClass(
      'font-sans',
      'text-body-lg',
      'font-medium',
      'leading-body-lg'
    );
    expect(primaryPrompt.parentElement).not.toHaveClass('text-heading-sm', 'font-regular');
    expect(screen.getByRole('button', { name: '开始录音' })).toHaveClass(
      'rounded-full',
      'bg-brand-ember',
      'text-destructive-foreground'
    );
    const waveform = screen.getByLabelText('静态录音波形');
    expect(waveform).toHaveAttribute('data-waveform-mode', 'bars');
    expect(waveform).toHaveAttribute('data-waveform-bar-width', '4');
    expect(waveform).toHaveAttribute('data-waveform-bar-radius', '4');
    expect(screen.queryByText(/\d\d:\d\d\.\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '暂停录音' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '停止录音' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '播放录音' })).not.toBeInTheDocument();
  });

  it('returns directly from the pre-recording state because no audio exists yet', () => {
    installWorkspaceBridge();
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '返回' }));

    expect(screen.queryByRole('dialog', { name: '保存这段录音吗？' })).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('asks before returning from active recording and saves when confirmed', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    await emitRecordedAudio(media);

    fireEvent.click(screen.getByRole('button', { name: '返回' }));

    const exitDialog = screen.getByRole('dialog', { name: '保存这段录音吗？' });
    expect(exitDialog).toHaveTextContent('返回会结束当前录音。');

    fireEvent.click(screen.getByRole('button', { name: '保存录音' }));
    await flushPromises();

    expect(media.controller.stop).toHaveBeenCalledTimes(1);
    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        workspaceHandle: workspaceSession.workspaceHandle,
      })
    );
    expect(bridge.discardRecordingDraft).not.toHaveBeenCalledWith({
      segmentId: 'seg_1',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('saves segment supplement recording through supplement draft IPC without creating a sibling segment', async () => {
    let transcriptionListener: Parameters<
      Window['reoWorkspace']['onRecordingTranscriptionEvent']
    >[0] = () => {};
    const bridge = installWorkspaceBridge({
      onRecordingTranscriptionEvent: vi.fn((listener) => {
        transcriptionListener = listener;
        return () => {};
      }),
    });
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();
    const onSegmentSupplementFinalized = vi.fn();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        onSegmentSupplementFinalized={onSegmentSupplementFinalized}
        open
        recordingTarget={{
          kind: 'segment-supplement',
          memoryId: 'mem_1',
          segmentId: 'seg_parent',
          title: '补充录音1',
        }}
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    await emitRecordedAudio(media);
    act(() => media.emitPcm(new Uint8Array([1, 2, 3, 4])));
    await flushPromises();
    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 1600,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 200,
            text: '现场补充转写',
          },
        ],
      })
    );

    expect(
      JSON.parse(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1') ?? '{}')
    ).toMatchObject({
      memoryId: 'mem_1',
      parentSegmentId: 'seg_parent',
      segmentId: 'sup_1',
      targetKind: 'segment-supplement',
      title: '补充录音1',
      workspaceId: 'ws_1',
    });

    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    fireEvent.click(screen.getByRole('button', { name: '保存录音' }));
    await flushPromises();

    expect(bridge.createRecordingDraft).not.toHaveBeenCalled();
    expect(bridge.appendRecordingAudioChunk).not.toHaveBeenCalled();
    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(bridge.createSegmentSupplementRecordingDraft).toHaveBeenCalledWith({
      workspaceHandle: workspaceSession.workspaceHandle,
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_parent',
    });
    expect(bridge.appendSegmentSupplementRecordingAudioChunk).toHaveBeenCalledWith({
      workspaceHandle: workspaceSession.workspaceHandle,
      supplementId: 'sup_1',
      sequence: 0,
      chunk: new Uint8Array([1, 2, 3]),
    });
    expect(bridge.finalizeSegmentSupplementRecordingDraft).toHaveBeenCalledWith({
      workspaceHandle: workspaceSession.workspaceHandle,
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_parent',
      supplementId: 'sup_1',
      title: '补充录音1',
      durationMs: expect.any(Number),
    });
    expect(bridge.saveSegmentSupplementTranscript).toHaveBeenCalledWith({
      workspaceHandle: workspaceSession.workspaceHandle,
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_parent',
      supplementId: 'sup_1',
      markdown: '现场补充转写',
    });
    expect(onSegmentSupplementFinalized).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('ignores stale SegmentSupplement transcript save failures after close', async () => {
    let transcriptionListener: Parameters<
      Window['reoWorkspace']['onRecordingTranscriptionEvent']
    >[0] = () => {};
    const transcriptSave =
      createDeferred<
        Awaited<ReturnType<Window['reoWorkspace']['saveSegmentSupplementTranscript']>>
      >();
    const bridge = installWorkspaceBridge({
      onRecordingTranscriptionEvent: vi.fn((listener) => {
        transcriptionListener = listener;
        return () => {};
      }),
      saveSegmentSupplementTranscript: vi.fn(() => transcriptSave.promise),
    });
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();
    const onSegmentSupplementFinalized = vi.fn();

    const { unmount } = render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        onSegmentSupplementFinalized={onSegmentSupplementFinalized}
        open
        recordingTarget={{
          kind: 'segment-supplement',
          memoryId: 'mem_1',
          segmentId: 'seg_parent',
          title: '补充录音1',
        }}
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    await emitRecordedAudio(media);
    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 1600,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 200,
            text: '现场补充转写',
          },
        ],
      })
    );

    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    fireEvent.click(screen.getByRole('button', { name: '保存录音' }));
    await flushPromises();

    expect(bridge.saveSegmentSupplementTranscript).toHaveBeenCalledTimes(1);
    expect(onSegmentSupplementFinalized).toHaveBeenCalledTimes(1);

    vi.mocked(toast.error).mockClear();
    unmount();
    await act(async () => {
      transcriptSave.resolve({
        ok: false,
        error: {
          code: 'ERR_RECORDING_TRANSCRIPTION_FAILED',
          message: 'save failed',
        },
      });
      await transcriptSave.promise;
    });

    expect(toast.error).not.toHaveBeenCalledWith('补充录音已保存，转写暂时无法写入。');
  });

  it('does not expose mid-track replacement for segment supplement recording', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        onSegmentSupplementFinalized={() => {}}
        open
        recordingTarget={{
          kind: 'segment-supplement',
          memoryId: 'mem_1',
          segmentId: 'seg_parent',
          title: '补充录音1',
        }}
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(10000));
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));

    scrubPausedWaveformTo(0.5);

    expect(screen.queryByRole('button', { name: '替换录音' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '继续录音' })).not.toBeInTheDocument();
    expect(bridge.createRecordingDraft).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalledWith(
      '补充录音暂不支持从中间替换，可以保存后再补充一段。'
    );
  });

  it('re-enables return after save-and-return fails', async () => {
    const bridge = installWorkspaceBridge({
      finalizeRecordingDraft: vi.fn(async () => ({
        error: { code: 'ERR_RECORDING_FINALIZE_FAILED' as const, message: 'finalize failed' },
        ok: false as const,
      })),
    });
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    await emitRecordedAudio(media);

    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    fireEvent.click(screen.getByRole('button', { name: '保存录音' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('无法完成录音保存。');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: '返回' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('reopens the recording surface when optimistic completion fails after visual close', async () => {
    const bridge = installWorkspaceBridge({
      finalizeRecordingDraft: vi.fn(async () => ({
        error: { code: 'ERR_RECORDING_FINALIZE_FAILED' as const, message: 'finalize failed' },
        ok: false as const,
      })),
    });
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    await emitRecordedAudio(media);

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(toast.error).toHaveBeenCalledWith('无法完成录音保存。');
  });

  it('asks before returning from paused recording and can discard without saving', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    await emitRecordedAudio(media);
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));

    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('button', { name: '继续录音' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    fireEvent.click(screen.getByRole('button', { name: '直接退出' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(bridge.discardRecordingDraft).toHaveBeenCalledWith({
      segmentId: 'seg_1',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps waveform, copy, time and control slots aligned across recording states', async () => {
    installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    const expectSharedLayoutSlots = () => {
      expect(screen.getByTestId('recording-composer-layout')).toHaveClass('content-end');
      expect(screen.getByTestId('recording-waveform-slot')).toHaveClass(
        'row-start-1',
        'items-center'
      );
      expect(screen.getByTestId('recording-copy-slot')).toHaveClass('row-start-2', 'items-center');
      expect(screen.getByTestId('recording-timer-slot')).toHaveClass('row-start-3', 'items-center');
      expect(screen.getByTestId('recording-controls-slot')).toHaveClass(
        'row-start-4',
        'items-center'
      );
    };

    expectSharedLayoutSlots();
    expect(screen.getByRole('button', { name: '开始录音' })).toHaveClass('size-[88px]');

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(4720));

    expectSharedLayoutSlots();
    expect(screen.getByTestId('recording-left-control-slot')).toHaveClass('justify-start');
    expect(screen.getByTestId('recording-locator-control-slot')).toHaveClass('justify-center');
    expect(screen.getByTestId('recording-right-control-slot')).toHaveClass('justify-end');
    expect(screen.getByRole('button', { name: '暂停录音' })).toHaveClass('w-[108px]');

    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));

    expectSharedLayoutSlots();
    expect(screen.getByRole('button', { name: '继续录音' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '继续录音' })).toHaveClass('w-[108px]');
    expect(screen.getByTestId('recording-left-control-slot')).toHaveClass('justify-start');
    expect(screen.getByTestId('recording-locator-control-slot')).toHaveClass('justify-center');
    expect(screen.getByTestId('recording-right-control-slot')).toHaveClass('justify-end');
  });

  it('renders the active recording state with dynamic waveform, timer and transcript', async () => {
    installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(4720));

    const waveform = screen.getByLabelText('实时录音波形');
    expect(waveform).toHaveAttribute('data-waveform-mode', 'bars');
    expect(waveform).toHaveAttribute('data-waveform-bar-width', '4');
    expect(waveform).toHaveAttribute('data-waveform-bar-radius', '4');
    expect(screen.getByRole('region', { name: '实时转写' })).toBeInTheDocument();
    expect(screen.getByText('00:04.72')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂停录音' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '播放录音' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '后退 15 秒' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '前进 15 秒' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '停止录音' })).toBeEnabled();
    expect(document.querySelector('[data-slot="recording-playhead"]')).not.toBeInTheDocument();
  });

  it('streams PCM to the main transcription session and renders current transcript events', async () => {
    let transcriptionListener: Parameters<
      Window['reoWorkspace']['onRecordingTranscriptionEvent']
    >[0] = () => {};
    const bridge = installWorkspaceBridge({
      onRecordingTranscriptionEvent: vi.fn((listener) => {
        transcriptionListener = listener;
        return () => {};
      }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(1200));
    act(() => media.emitPcm(new Uint8Array([1, 2, 3, 4])));
    await flushPromises();

    expect(bridge.startRecordingTranscription).toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      timeOffsetMs: 0,
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(bridge.sendRecordingTranscriptionAudio).toHaveBeenCalledWith({
      chunk: new Uint8Array([1, 2, 3, 4]),
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: workspaceSession.workspaceHandle,
    });

    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'stale-revision',
        segments: [
          {
            endTimeMs: 1800,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'stale-revision',
            startTimeMs: 1000,
            text: '旧转写',
          },
        ],
      })
    );
    expect(screen.queryByText('旧转写')).not.toBeInTheDocument();

    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 1800,
            isFinal: false,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 1000,
            text: '新的实时转写',
          },
        ],
      })
    );

    expect(screen.getByText('新的实时转写')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    await flushPromises();
    expect(bridge.finishRecordingTranscription).toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    vi.mocked(bridge.sendRecordingTranscriptionAudio).mockClear();
    act(() => media.emitPcm(new Uint8Array([5, 6, 7, 8])));
    await flushPromises();
    expect(bridge.sendRecordingTranscriptionAudio).not.toHaveBeenCalled();
  });

  it('saves recording without live transcription when voice settings are disabled', async () => {
    voiceSettingsForTest = createVoiceSettingsSnapshot(false);
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();
    const onAudioSegmentFinalized = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={onAudioSegmentFinalized}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    await emitRecordedAudio(media);
    act(() => media.emitPcm(new Uint8Array([1, 2, 3, 4])));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.startRecordingTranscription).not.toHaveBeenCalled();
    expect(bridge.sendRecordingTranscriptionAudio).not.toHaveBeenCalled();
    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        workspaceHandle: workspaceSession.workspaceHandle,
      })
    );
    expect(onAudioSegmentFinalized).toHaveBeenCalledWith(
      expect.objectContaining({
        segment: expect.objectContaining({ segmentId: 'seg_1' }),
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('stays quiet when main accepts transcription start as disabled', async () => {
    const bridge = installWorkspaceBridge({
      startRecordingTranscription: vi.fn(async () => ({
        ok: true as const,
        value: { accepted: true, transcriptionMode: 'disabled' as const },
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    await emitRecordedAudio(media);
    act(() => media.emitPcm(new Uint8Array([1, 2, 3, 4])));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.startRecordingTranscription).toHaveBeenCalledOnce();
    expect(bridge.sendRecordingTranscriptionAudio).not.toHaveBeenCalled();
    expect(bridge.finishRecordingTranscription).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('starts live transcription after voice settings finish loading enabled', async () => {
    const deferredSettings =
      createDeferred<
        Awaited<ReturnType<Window['reoWorkspace']['readVoiceTranscriptionSettings']>>
      >();
    const bridge = installWorkspaceBridge({
      readVoiceTranscriptionSettings: vi.fn(() => deferredSettings.promise),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />,
      { seedVoiceSettings: false }
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    await emitRecordedAudio(media);
    act(() => media.emitPcm(new Uint8Array([1, 2, 3, 4])));
    await flushPromises();

    expect(bridge.startRecordingTranscription).not.toHaveBeenCalled();
    expect(bridge.sendRecordingTranscriptionAudio).not.toHaveBeenCalled();

    await act(async () => {
      deferredSettings.resolve({
        ok: true,
        value: {
          settings: createVoiceSettingsSnapshot(true),
        },
      });
      await deferredSettings.promise;
    });
    await flushPromises();
    act(() => vi.advanceTimersByTime(0));
    await flushPromises();

    expect(bridge.startRecordingTranscription).toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      timeOffsetMs: 0,
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(bridge.sendRecordingTranscriptionAudio).toHaveBeenCalledWith({
      chunk: new Uint8Array([1, 2, 3, 4]),
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
  });

  it('starts durable capture before live transcription accepts and flushes buffered PCM', async () => {
    const started = createDeferred<TranscriptionStartResponse>();
    const bridge = installWorkspaceBridge({
      startRecordingTranscription: vi.fn(() => started.promise),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();

    expect(media.adapter.start).toHaveBeenCalledTimes(1);
    act(() => media.emitPcm(new Uint8Array([9, 8, 7, 6])));
    await flushPromises();
    expect(bridge.sendRecordingTranscriptionAudio).not.toHaveBeenCalled();

    started.resolve({ ok: true, value: { accepted: true } });
    await flushPromises();

    expect(bridge.sendRecordingTranscriptionAudio).toHaveBeenCalledWith({
      chunk: new Uint8Array([9, 8, 7, 6]),
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
  });

  it('bounds live transcription audio sends while a previous send is pending', async () => {
    const send = createDeferred<TranscriptionControlResponse>();
    const bridge = installWorkspaceBridge({
      sendRecordingTranscriptionAudio: vi.fn(() => send.promise),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitPcm(new Uint8Array(700_000)));
    await flushPromises();
    act(() => media.emitPcm(new Uint8Array(700_000)));
    await flushPromises();

    expect(bridge.sendRecordingTranscriptionAudio).toHaveBeenCalledTimes(1);
    expect(bridge.closeRecordingTranscription).toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(toast.error).toHaveBeenCalledWith('实时转写暂时不可用，录音会继续保存。');
    send.resolve({ ok: true, value: { accepted: true } });
  });

  it('flushes PCM captured while resumed live transcription is still accepting', async () => {
    const resumeStarted = createDeferred<TranscriptionStartResponse>();
    const bridge = installWorkspaceBridge({
      startRecordingTranscription: vi
        .fn()
        .mockResolvedValueOnce({ ok: true as const, value: { accepted: true as const } })
        .mockImplementation(() => resumeStarted.promise),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    await flushPromises();
    vi.mocked(bridge.sendRecordingTranscriptionAudio).mockClear();

    fireEvent.click(screen.getByRole('button', { name: '继续录音' }));
    await flushPromises();
    act(() => media.emitPcm(new Uint8Array([6, 7, 8, 9])));
    await flushPromises();

    expect(bridge.sendRecordingTranscriptionAudio).not.toHaveBeenCalled();

    resumeStarted.resolve({ ok: true, value: { accepted: true } });
    await flushPromises();

    expect(bridge.sendRecordingTranscriptionAudio).toHaveBeenCalledWith({
      chunk: new Uint8Array([6, 7, 8, 9]),
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
  });

  it('backfills completion when resumed transcription start fails after existing transcript text', async () => {
    let transcriptionListener: Parameters<
      Window['reoWorkspace']['onRecordingTranscriptionEvent']
    >[0] = () => {};
    const bridge = installWorkspaceBridge({
      finishRecordingTranscription: vi.fn(async (payload) =>
        payload.recordingFlowSessionId.endsWith('completion-backfill')
          ? {
              ok: true as const,
              value: {
                accepted: true as const,
                segments: [
                  {
                    endTimeMs: 4200,
                    isFinal: true,
                    recordingSessionId: 'recording-1',
                    revisionId: 'recording-1-revision-0',
                    startTimeMs: 0,
                    text: '完整补转写文本',
                  },
                ],
              },
            }
          : { ok: true as const, value: { accepted: true as const } }
      ),
      onRecordingTranscriptionEvent: vi.fn((listener) => {
        transcriptionListener = listener;
        return () => {};
      }),
      startRecordingTranscription: vi
        .fn()
        .mockResolvedValueOnce({ ok: true as const, value: { accepted: true as const } })
        .mockResolvedValueOnce({
          ok: false as const,
          error: {
            code: 'ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE' as const,
            message: 'ASR unavailable',
          },
        })
        .mockResolvedValueOnce({ ok: true as const, value: { accepted: true as const } }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 1200,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '已有转写',
          },
        ],
      })
    );
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => media.emitPcm(new Uint8Array([1, 2, 3, 4])));
    act(() => vi.advanceTimersByTime(2200));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '继续录音' }));
    await flushPromises();
    act(() => media.emitChunk(new Uint8Array([4, 5, 6])));
    act(() => media.emitPcm(new Uint8Array([5, 6, 7, 8])));
    act(() => vi.advanceTimersByTime(2200));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.startRecordingTranscription).toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-1-completion-backfill',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      timeOffsetMs: 0,
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(bridge.saveTranscript).toHaveBeenCalledWith({
      markdown: '完整补转写文本',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
  });

  it('saves live transcript text after finalizing and closes without opening an editor', async () => {
    let transcriptionListener: Parameters<
      Window['reoWorkspace']['onRecordingTranscriptionEvent']
    >[0] = () => {};
    const onOpenChange = vi.fn();
    const onRecordingContentSaved = vi.fn();
    const bridge = installWorkspaceBridge({
      onRecordingTranscriptionEvent: vi.fn((listener) => {
        transcriptionListener = listener;
        return () => {};
      }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingContentSaved={onRecordingContentSaved}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 1400,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 400,
            text: '完成后要保存的转写',
          },
        ],
      })
    );
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => vi.advanceTimersByTime(2000));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.saveTranscript).toHaveBeenCalledWith({
      markdown: '完成后要保存的转写',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(onRecordingContentSaved).toHaveBeenCalledWith({
      memory: savedMemorySummary,
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('textbox', { name: '转写' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '反思' })).not.toBeInTheDocument();
  });

  it('keeps finalized audio recovery truth when transcript save fails after live finalize', async () => {
    let transcriptionListener: Parameters<
      Window['reoWorkspace']['onRecordingTranscriptionEvent']
    >[0] = () => {};
    const bridge = installWorkspaceBridge({
      onRecordingTranscriptionEvent: vi.fn((listener) => {
        transcriptionListener = listener;
        return () => {};
      }),
      saveTranscript: vi.fn(async () => ({
        ok: false as const,
        error: {
          code: 'ERR_WORKSPACE_INDEX_WRITE_FAILED' as const,
          message: 'Transcript save failed',
        },
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 1400,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 400,
            text: '保存失败后要恢复的转写',
          },
        ],
      })
    );
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => vi.advanceTimersByTime(2000));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledTimes(1);
    expect(bridge.saveTranscript).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1') ?? '{}')
    ).toMatchObject({
      finalizedAudio: {
        memory: {
          memoryId: 'mem_1',
        },
        segment: {
          memoryId: 'mem_1',
          segmentId: 'seg_1',
        },
      },
      segmentId: 'seg_1',
      transcriptSegments: [
        {
          text: '保存失败后要恢复的转写',
        },
      ],
    });
  });

  it('waits for final transcription before finalizing and saving transcript text', async () => {
    let transcriptionListener: Parameters<
      Window['reoWorkspace']['onRecordingTranscriptionEvent']
    >[0] = () => {};
    const finalTranscription = createDeferred<TranscriptionControlResponse>();
    const bridge = installWorkspaceBridge({
      finishRecordingTranscription: vi.fn(() => finalTranscription.promise),
      onRecordingTranscriptionEvent: vi.fn((listener) => {
        transcriptionListener = listener;
        return () => {};
      }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => vi.advanceTimersByTime(2000));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();

    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 2000,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '最终转写会跟随完成保存',
          },
        ],
      })
    );
    finalTranscription.resolve({ ok: true, value: { accepted: true } });
    await flushPromises();
    act(() => vi.advanceTimersByTime(300));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledTimes(1);
    expect(bridge.saveTranscript).toHaveBeenCalledWith({
      markdown: '最终转写会跟随完成保存',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('saves final transcript segments returned by the finish response even without an event', async () => {
    const bridge = installWorkspaceBridge({
      finishRecordingTranscription: vi.fn(async () => ({
        ok: true as const,
        value: {
          accepted: true as const,
          segments: [
            {
              endTimeMs: 1800,
              isFinal: true,
              recordingSessionId: 'recording-1',
              revisionId: 'recording-1-revision-0',
              startTimeMs: 0,
              text: '完成响应里的最终文本',
            },
          ],
        },
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => vi.advanceTimersByTime(2000));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.saveTranscript).toHaveBeenCalledWith({
      markdown: '完成响应里的最终文本',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
  });

  it('toasts final transcription failure while preserving the durable recording and closing', async () => {
    const onOpenChange = vi.fn();
    const bridge = installWorkspaceBridge({
      finishRecordingTranscription: vi.fn(async () => ({
        ok: false as const,
        error: {
          code: 'ERR_RECORDING_TRANSCRIPTION_FAILED' as const,
          message: '最终转写未返回，录音会继续保存。',
        },
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => vi.advanceTimersByTime(2000));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(toast.error).toHaveBeenCalledWith('最终转写未返回，录音会继续保存。');
    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('keeps durable recording available when live transcription is unavailable', async () => {
    const onOpenChange = vi.fn();
    const bridge = installWorkspaceBridge({
      startRecordingTranscription: vi.fn(async () => ({
        ok: false as const,
        error: {
          code: 'ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE' as const,
          message: '豆包流式语音识别暂时不可用，录音会继续保存。',
        },
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('豆包流式语音识别暂时不可用'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => media.emitPcm(new Uint8Array([1, 2, 3, 4])));
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => vi.advanceTimersByTime(2000));
    await flushPromises();
    expect(
      JSON.parse(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1') ?? '{}')
    ).toMatchObject({
      audioChunks: [
        {
          byteLength: 3,
          startTimeMs: 0,
        },
      ],
      nextSequence: 0,
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
    });
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.sendRecordingTranscriptionAudio).not.toHaveBeenCalled();
    expect(bridge.appendRecordingAudioChunk).toHaveBeenCalled();
    expect(bridge.finalizeRecordingDraft).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('backfills transcription from captured PCM after the durable recording is finalized', async () => {
    let transcriptionListener: Parameters<
      Window['reoWorkspace']['onRecordingTranscriptionEvent']
    >[0] = () => {};
    const backfillFinished = createDeferred<TranscriptionControlResponse>();
    const callOrder: string[] = [];
    const bridge = installWorkspaceBridge({
      finalizeRecordingDraft: vi.fn(async () => {
        callOrder.push('finalize');
        return {
          ok: true as const,
          value: {
            memory: {
              audioByteLength: 3,
              createdAt: '2026-05-06T13:08:00.000Z',
              durationMs: 2000,
              supplementCount: 0,
              hasTranscript: false,
              memoryId: 'mem_1',
              segmentCount: 1,
              title: 'Daily memory 录音',
              updatedAt: '2026-05-06T13:08:00.000Z',
            },
            segment: {
              workspaceId: 'ws_1',
              memoryId: 'mem_1',
              segmentId: 'seg_1',
              type: 'audio' as const,
              title: 'Daily memory 录音',
              createdAt: '2026-05-06T13:08:00.000Z',
              updatedAt: '2026-05-06T13:08:00.000Z',
              audioByteLength: 3,
              durationMs: 2000,
              transcript: { exists: false },
              supplementCount: 0,
              supplements: [],
            },
          },
        };
      }),
      finishRecordingTranscription: vi.fn(() => backfillFinished.promise),
      onRecordingTranscriptionEvent: vi.fn((listener) => {
        transcriptionListener = listener;
        return () => {};
      }),
      sendRecordingTranscriptionAudio: vi.fn(async () => {
        callOrder.push('send-pcm');
        return { ok: true as const, value: { accepted: true as const } };
      }),
      startRecordingTranscription: vi
        .fn()
        .mockResolvedValueOnce({
          ok: false as const,
          error: {
            code: 'ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE' as const,
            message: '豆包流式语音识别暂时不可用，录音会继续保存。',
          },
        })
        .mockImplementation(async () => {
          callOrder.push('backfill-start');
          return { ok: true as const, value: { accepted: true as const } };
        }),
    });
    const onOpenChange = vi.fn();
    const onRecordingContentSaved = vi.fn();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onRecordingContentSaved={onRecordingContentSaved}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitPcm(new Uint8Array([1, 2, 3, 4])));
    act(() => media.emitPcm(new Uint8Array([5, 6, 7, 8])));
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => vi.advanceTimersByTime(2000));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledTimes(1);
    expect(bridge.startRecordingTranscription).toHaveBeenCalledTimes(2);
    expect(callOrder.at(0)).toBe('finalize');
    expect(callOrder).toContain('backfill-start');
    expect(bridge.sendRecordingTranscriptionAudio).toHaveBeenCalledWith({
      chunk: new Uint8Array([1, 2, 3, 4]),
      recordingFlowSessionId: 'recording-1-completion-backfill',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(bridge.sendRecordingTranscriptionAudio).toHaveBeenCalledWith({
      chunk: new Uint8Array([5, 6, 7, 8]),
      recordingFlowSessionId: 'recording-1-completion-backfill',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: workspaceSession.workspaceHandle,
    });

    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 1800,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '补转写保存内容',
          },
        ],
      })
    );
    backfillFinished.resolve({ ok: true, value: { accepted: true } });
    await flushPromises();

    expect(bridge.saveTranscript).toHaveBeenCalledWith({
      markdown: '补转写保存内容',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(onRecordingContentSaved).toHaveBeenCalledWith({
      memory: savedMemorySummary,
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('backfills transcription when final transcription fails after partial live text', async () => {
    let transcriptionListener: Parameters<
      Window['reoWorkspace']['onRecordingTranscriptionEvent']
    >[0] = () => {};
    const backfillFinished = createDeferred<TranscriptionControlResponse>();
    const bridge = installWorkspaceBridge({
      finishRecordingTranscription: vi
        .fn()
        .mockResolvedValueOnce({
          ok: false as const,
          error: {
            code: 'ERR_RECORDING_TRANSCRIPTION_FAILED' as const,
            message: '最终转写未返回，录音会继续保存。',
          },
        })
        .mockImplementation(() => backfillFinished.promise),
      onRecordingTranscriptionEvent: vi.fn((listener) => {
        transcriptionListener = listener;
        return () => {};
      }),
    });
    const onOpenChange = vi.fn();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitPcm(new Uint8Array([1, 2, 3, 4])));
    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 1200,
            isFinal: false,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '部分实时转写',
          },
        ],
      })
    );
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => vi.advanceTimersByTime(2000));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(toast.error).toHaveBeenCalledWith('最终转写未返回，录音会继续保存。');
    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledTimes(1);
    expect(bridge.startRecordingTranscription).toHaveBeenCalledTimes(2);
    expect(bridge.sendRecordingTranscriptionAudio).toHaveBeenLastCalledWith({
      chunk: new Uint8Array([1, 2, 3, 4]),
      recordingFlowSessionId: 'recording-1-completion-backfill',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: workspaceSession.workspaceHandle,
    });

    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 2000,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '完整补转写内容',
          },
        ],
      })
    );
    backfillFinished.resolve({ ok: true, value: { accepted: true } });
    await flushPromises();

    expect(bridge.saveTranscript).toHaveBeenCalledWith({
      markdown: '完整补转写内容',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('backfills transcription when live audio is no longer accepted after partial live text', async () => {
    let transcriptionListener: Parameters<
      Window['reoWorkspace']['onRecordingTranscriptionEvent']
    >[0] = () => {};
    const backfillFinished = createDeferred<TranscriptionControlResponse>();
    const bridge = installWorkspaceBridge({
      finishRecordingTranscription: vi.fn(() => backfillFinished.promise),
      onRecordingTranscriptionEvent: vi.fn((listener) => {
        transcriptionListener = listener;
        return () => {};
      }),
      sendRecordingTranscriptionAudio: vi
        .fn()
        .mockResolvedValueOnce({ ok: true as const, value: { accepted: false as const } })
        .mockResolvedValue({ ok: true as const, value: { accepted: true as const } }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitPcm(new Uint8Array([1, 2, 3, 4])));
    await flushPromises();
    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 1000,
            isFinal: false,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '已有实时转写',
          },
        ],
      })
    );
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => vi.advanceTimersByTime(2000));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.startRecordingTranscription).toHaveBeenCalledTimes(2);
    expect(bridge.sendRecordingTranscriptionAudio).toHaveBeenLastCalledWith({
      chunk: new Uint8Array([1, 2, 3, 4]),
      recordingFlowSessionId: 'recording-1-completion-backfill',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: workspaceSession.workspaceHandle,
    });

    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 2000,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '补转写完整内容',
          },
        ],
      })
    );
    backfillFinished.resolve({ ok: true, value: { accepted: true } });
    await flushPromises();

    expect(bridge.saveTranscript).toHaveBeenCalledWith({
      markdown: '补转写完整内容',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
  });

  it('backfills transcription when final transcription returns an unaccepted close', async () => {
    let transcriptionListener: Parameters<
      Window['reoWorkspace']['onRecordingTranscriptionEvent']
    >[0] = () => {};
    const backfillFinished = createDeferred<TranscriptionControlResponse>();
    const bridge = installWorkspaceBridge({
      finishRecordingTranscription: vi
        .fn()
        .mockResolvedValueOnce({ ok: true as const, value: { accepted: false as const } })
        .mockImplementation(() => backfillFinished.promise),
      onRecordingTranscriptionEvent: vi.fn((listener) => {
        transcriptionListener = listener;
        return () => {};
      }),
    });
    const onOpenChange = vi.fn();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitPcm(new Uint8Array([1, 2, 3, 4])));
    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 1200,
            isFinal: false,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '已有部分转写',
          },
        ],
      })
    );
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => vi.advanceTimersByTime(2000));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledTimes(1);
    expect(bridge.startRecordingTranscription).toHaveBeenCalledTimes(2);
    expect(bridge.sendRecordingTranscriptionAudio).toHaveBeenLastCalledWith({
      chunk: new Uint8Array([1, 2, 3, 4]),
      recordingFlowSessionId: 'recording-1-completion-backfill',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: workspaceSession.workspaceHandle,
    });

    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 2000,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '补转写后的完整内容',
          },
        ],
      })
    );
    backfillFinished.resolve({ ok: true, value: { accepted: true } });
    await flushPromises();

    expect(bridge.saveTranscript).toHaveBeenCalledWith({
      markdown: '补转写后的完整内容',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps backfilled transcript in recovery when transcript save fails after finalize', async () => {
    let transcriptionListener: Parameters<
      Window['reoWorkspace']['onRecordingTranscriptionEvent']
    >[0] = () => {};
    const backfillFinished = createDeferred<TranscriptionControlResponse>();
    const bridge = installWorkspaceBridge({
      finishRecordingTranscription: vi.fn(() => backfillFinished.promise),
      onRecordingTranscriptionEvent: vi.fn((listener) => {
        transcriptionListener = listener;
        return () => {};
      }),
      saveTranscript: vi.fn(async () => ({
        ok: false as const,
        error: {
          code: 'ERR_RECORDING_TRANSCRIPTION_FAILED' as const,
          message: 'Transcript save failed',
        },
      })),
      startRecordingTranscription: vi
        .fn()
        .mockResolvedValueOnce({
          ok: false as const,
          error: {
            code: 'ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE' as const,
            message: '豆包流式语音识别暂时不可用，录音会继续保存。',
          },
        })
        .mockResolvedValue({ ok: true as const, value: { accepted: true as const } }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitPcm(new Uint8Array([1, 2, 3, 4])));
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => vi.advanceTimersByTime(2000));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 2000,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '补转写失败后仍要恢复',
          },
        ],
      })
    );
    backfillFinished.resolve({ ok: true, value: { accepted: true } });
    await flushPromises();

    const marker = JSON.parse(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1') ?? '{}');
    expect(marker).toMatchObject({
      finalizedAudio: expect.any(Object),
      transcriptMarkdown: '补转写失败后仍要恢复',
      transcriptSegments: [
        expect.objectContaining({
          text: '补转写失败后仍要恢复',
        }),
      ],
    });
    expect(bridge.saveTranscript).toHaveBeenCalledWith({
      markdown: '补转写失败后仍要恢复',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
  });

  it('persists a recoverable draft marker while recording and clears it after finalize', async () => {
    installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();

    expect(
      JSON.parse(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1') ?? '{}')
    ).toMatchObject({
      schemaVersion: 1,
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      title: '录音1',
    });

    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => vi.advanceTimersByTime(2000));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).toBeNull();
  });

  it('keeps durable capture running when the recovery marker cannot be written', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();

    expect(media.adapter.start).toHaveBeenCalledTimes(1);
    expect(bridge.appendRecordingAudioChunk).toHaveBeenCalledWith({
      chunk: new Uint8Array([1, 2, 3]),
      segmentId: 'seg_1',
      sequence: 0,
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(bridge.discardRecordingDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '暂停录音' })).toBeEnabled();
  });

  it('does not rewrite the recovery marker for every acknowledged durable chunk', async () => {
    installWorkspaceBridge();
    const media = createMediaAdapter();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();

    setItem.mockClear();
    act(() => media.emitChunk(new Uint8Array([1])));
    await flushPromises();
    expect(setItem).toHaveBeenCalledTimes(1);

    setItem.mockClear();
    act(() => media.emitChunk(new Uint8Array([2])));
    await flushPromises();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('renders the paused state with split waveform progress, cursor time and continue action', async () => {
    installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(14970));
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));

    const waveform = screen.getByRole('slider', { name: '暂停录音波形' });
    expect(waveform).toHaveAttribute('data-waveform-mode', 'bars');
    expect(waveform).toHaveAttribute('data-waveform-bar-width', '4');
    expect(waveform).toHaveAttribute('data-waveform-bar-radius', '4');
    expect(waveform).toHaveAttribute('data-waveform-progress-style', 'split');
    expect(document.querySelector('[data-slot="recording-playhead"]')).not.toBeInTheDocument();
    expect(screen.getByText('00:14.97')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '继续录音' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '播放录音' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '后退 15 秒' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '前进 15 秒' })).not.toBeInTheDocument();
    expect(media.controller.pause).toHaveBeenCalledTimes(1);
  });

  it('ignores paused recording waveform pointer movement until a scrub starts on the waveform', async () => {
    installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(14970));
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));

    const waveform = screen.getByRole('slider', { name: '暂停录音波形' });
    vi.spyOn(waveform, 'getBoundingClientRect').mockReturnValue({
      bottom: 112,
      height: 112,
      left: 0,
      right: 200,
      toJSON: () => ({}),
      top: 0,
      width: 200,
      x: 0,
      y: 0,
    });

    fireEvent.pointerMove(waveform, { buttons: 1, clientX: 0, pointerId: 1 });

    expect(waveform).toHaveAttribute('aria-valuenow', '14970');
    expect(screen.getByText('00:14.97')).toBeInTheDocument();
  });

  it('plays the paused draft audio and keeps cursor time synchronized', async () => {
    installWorkspaceBridge();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:draft-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(4000));
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    await flushPromises();
    scrubPausedWaveformTo(0);
    fireEvent.canPlay(screen.getByTestId('draft-playback-audio'));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '播放录音' }));
    await flushPromises();

    const draftAudio = screen.getByTestId('draft-playback-audio') as HTMLAudioElement;
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(draftAudio).toHaveAttribute('src', 'blob:draft-audio');
    expect(draftAudio.currentTime).toBe(0);
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '暂停回放' })).toBeEnabled();

    act(() => {
      draftAudio.currentTime = 2.12;
      fireEvent.timeUpdate(draftAudio);
    });
    expect(screen.getByText('00:02.12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '替换录音' })).toBeEnabled();

    scrubPausedWaveformTo(1);
    expect(draftAudio.currentTime).toBe(4);
    expect(screen.getByText('00:04.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '继续录音' })).toBeEnabled();

    act(() => {
      fireEvent.ended(draftAudio);
    });
    expect(screen.getByRole('button', { name: '播放录音' })).toBeEnabled();
  });

  it('starts paused draft playback from the beginning when the cursor is at the end', async () => {
    installWorkspaceBridge();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:draft-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(4000));
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    await flushPromises();
    expect(screen.getByText('00:04.00')).toBeInTheDocument();

    const playButton = screen.getByRole('button', { name: '播放录音' });
    expect(playButton.querySelector('svg')).not.toHaveClass('ml-2');
    fireEvent.canPlay(screen.getByTestId('draft-playback-audio'));
    await flushPromises();
    fireEvent.click(playButton);
    await flushPromises();

    const draftAudio = screen.getByTestId('draft-playback-audio') as HTMLAudioElement;
    expect(draftAudio.currentTime).toBe(0);
    expect(play).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalledWith('无法播放当前录音预览。');

    act(() => {
      draftAudio.currentTime = 4;
      fireEvent.ended(draftAudio);
    });
    expect(screen.getByRole('button', { name: '播放录音' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '播放录音' }));
    await flushPromises();

    expect(draftAudio.currentTime).toBe(0);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('keeps paused playback recoverable when no audio chunk is available yet', async () => {
    installWorkspaceBridge();
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    const playbackButton = screen.getByRole('button', { name: '播放录音' });
    expect(playbackButton).toBeDisabled();
    fireEvent.click(playbackButton);

    expect(media.controller.flush).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalledWith('没有可回听的录音内容。');
    expect(toast.error).not.toHaveBeenCalledWith('无法播放当前录音预览。');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '继续录音' })).toBeEnabled();
  });

  it('waits for the paused draft audio element to become playable before enabling playback', async () => {
    installWorkspaceBridge();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:draft-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const load = vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(3000));
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();

    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    await flushPromises();

    const playbackButton = screen.getByRole('button', { name: '播放录音' });
    expect(load).toHaveBeenCalledTimes(1);
    expect(playbackButton).toBeDisabled();
    fireEvent.click(playbackButton);
    expect(play).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalledWith('无法播放当前录音预览。');

    const draftAudio = screen.getByTestId('draft-playback-audio') as HTMLAudioElement;
    fireEvent.canPlay(draftAudio);
    await flushPromises();

    expect(screen.getByRole('button', { name: '播放录音' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '播放录音' }));
    await flushPromises();

    expect(draftAudio).toHaveAttribute('src', 'blob:draft-audio');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('prepares paused draft playback from the captured chunk prefix when the flush times out', async () => {
    installWorkspaceBridge();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:draft-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const load = vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(3000));
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();
    vi.mocked(media.controller.flush).mockResolvedValueOnce(false);

    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    await flushPromises();

    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '播放录音' })).toBeDisabled();

    fireEvent.canPlay(screen.getByTestId('draft-playback-audio'));
    await flushPromises();

    expect(screen.getByRole('button', { name: '播放录音' })).toBeEnabled();
    expect(screen.getByTestId('draft-playback-audio')).toHaveAttribute('src', 'blob:draft-audio');
  });

  it('keeps a recovered draft saveable without appending a new media session', async () => {
    const bridge = installWorkspaceBridge({
      readRecordingDraftAudio: vi.fn(async () => ({
        ok: true as const,
        value: {
          audio: new Uint8Array([1, 2, 3]),
          audioByteLength: 3,
          nextSequence: 3,
        },
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        recoveredDraft={{
          audioChunks: [{ byteLength: 3, endTimeMs: 4000, startTimeMs: 0 }],
          createdAt: '2026-05-09T10:00:00.000Z',
          durationMs: 4000,
          memoryId: 'mem_1',
          nextSequence: 3,
          segmentId: 'seg_recoverable',
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          schemaVersion: 1,
          title: 'Daily memory 录音',
          updatedAt: '2026-05-09T10:00:04.000Z',
          waveformSamples: [0.2, 0.3],
          workspaceId: 'ws_1',
        }}
        workspaceSession={workspaceSession}
      />
    );

    await flushPromises();
    fireEvent.canPlay(screen.getByTestId('draft-playback-audio'));
    await flushPromises();
    expect(screen.getByRole('button', { name: '播放录音' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '继续录音' })).not.toBeInTheDocument();

    expect(bridge.createRecordingDraft).not.toHaveBeenCalled();
    expect(bridge.beginMicrophoneIntent).not.toHaveBeenCalled();
    expect(media.adapter.start).not.toHaveBeenCalled();
    expect(bridge.appendRecordingAudioChunk).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalledWith('恢复录音可以先保存或放弃，暂不支持继续录制。');
    expect(screen.getByRole('button', { name: '播放录音' })).toBeEnabled();
  });

  it('shows recovered transcript segments even when new voice recognition is disabled', async () => {
    voiceSettingsForTest = createVoiceSettingsSnapshot(false);
    installWorkspaceBridge({
      readRecordingDraftAudio: vi.fn(async () => ({
        ok: true as const,
        value: {
          audio: new Uint8Array([1, 2, 3]),
          audioByteLength: 3,
          nextSequence: 3,
        },
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        recoveredDraft={{
          audioChunks: [{ byteLength: 3, endTimeMs: 4000, startTimeMs: 0 }],
          createdAt: '2026-05-09T10:00:00.000Z',
          durationMs: 4000,
          memoryId: 'mem_1',
          nextSequence: 3,
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          schemaVersion: 1,
          segmentId: 'seg_recoverable',
          title: 'Daily memory 录音',
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
          updatedAt: '2026-05-09T10:00:04.000Z',
          workspaceId: 'ws_1',
        }}
        workspaceSession={workspaceSession}
      />
    );

    await flushPromises();

    expect(screen.getByText('恢复后的转写内容')).toBeInTheDocument();
    expect(screen.queryByText('语音识别已关闭，本次只保存本地录音。')).not.toBeInTheDocument();
  });

  it('saves recovered transcript markdown when the recovery marker only has sidecar text', async () => {
    const bridge = installWorkspaceBridge({
      readRecordingDraftAudio: vi.fn(async () => ({
        ok: true as const,
        value: {
          audio: new Uint8Array([1, 2, 3]),
          audioByteLength: 3,
          nextSequence: 3,
        },
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        recoveredDraft={{
          audioChunks: [{ byteLength: 3, endTimeMs: 4000, startTimeMs: 0 }],
          createdAt: '2026-05-09T10:00:00.000Z',
          durationMs: 4000,
          memoryId: 'mem_1',
          nextSequence: 3,
          segmentId: 'seg_recoverable',
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          schemaVersion: 1,
          title: 'Daily memory 录音',
          transcriptInSidecar: true,
          transcriptMarkdown: '恢复转写文本必须保存',
          updatedAt: '2026-05-09T10:00:04.000Z',
          workspaceId: 'ws_1',
        }}
        workspaceSession={workspaceSession}
      />
    );

    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: 4000,
        memoryId: 'mem_1',
        segmentId: 'seg_recoverable',
        workspaceHandle: workspaceSession.workspaceHandle,
      })
    );
    expect(bridge.saveTranscript).toHaveBeenCalledWith({
      markdown: '恢复转写文本必须保存',
      memoryId: 'mem_1',
      segmentId: 'seg_recoverable',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
  });

  it('does not read recovered draft audio without a marker-derived chunk map', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        recoveredDraft={{
          createdAt: '2026-05-09T10:00:00.000Z',
          durationMs: 4000,
          memoryId: 'mem_1',
          nextSequence: 3,
          safeAudioByteLength: 3,
          segmentId: 'seg_recoverable',
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          schemaVersion: 1,
          title: 'Daily memory 录音',
          updatedAt: '2026-05-09T10:00:04.000Z',
          workspaceId: 'ws_1',
        }}
        workspaceSession={workspaceSession}
      />
    );

    await flushPromises();

    expect(bridge.readRecordingDraftAudio).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('无法恢复录音预览，但仍可保存未完成录音。');
    expect(screen.getByRole('button', { name: '停止录音' })).toBeEnabled();
  });

  it('does not open recovered resume transcription or media acquisition', async () => {
    const bridge = installWorkspaceBridge({
      readRecordingDraftAudio: vi.fn(async () => ({
        ok: true as const,
        value: {
          audio: new Uint8Array([1, 2, 3]),
          audioByteLength: 3,
          nextSequence: 3,
        },
      })),
    });
    const adapter: RecordingMediaAdapter = {
      start: vi.fn(async () => {
        throw new Error('Microphone unavailable');
      }),
    };

    render(
      <RecordingOverlayForTest
        mediaAdapter={adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        recoveredDraft={{
          audioChunks: [{ byteLength: 3, endTimeMs: 4000, startTimeMs: 0 }],
          createdAt: '2026-05-09T10:00:00.000Z',
          durationMs: 4000,
          memoryId: 'mem_1',
          nextSequence: 3,
          segmentId: 'seg_recoverable',
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          schemaVersion: 1,
          title: 'Daily memory 录音',
          updatedAt: '2026-05-09T10:00:04.000Z',
          waveformSamples: [0.2, 0.3],
          workspaceId: 'ws_1',
        }}
        workspaceSession={workspaceSession}
      />
    );

    await flushPromises();
    expect(screen.queryByRole('button', { name: '继续录音' })).not.toBeInTheDocument();

    expect(bridge.startRecordingTranscription).not.toHaveBeenCalled();
    expect(bridge.closeRecordingTranscription).not.toHaveBeenCalled();
    expect(bridge.discardRecordingDraft).not.toHaveBeenCalled();
    expect(adapter.start).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalledWith('恢复录音可以先保存或放弃，暂不支持继续录制。');
  });

  it('does not expose unavailable continue or replace actions for a recovered draft', async () => {
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi.fn(async () => ({
        ok: true as const,
        value: { nextSequence: 0, segmentId: 'seg_replacement' },
      })),
      readRecordingDraftAudio: vi.fn(async () => ({
        ok: true as const,
        value: {
          audio: new Uint8Array([1, 2, 3, 4, 5]),
          audioByteLength: 5,
          nextSequence: 2,
        },
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        recoveredDraft={{
          audioChunks: [
            { byteLength: 2, endTimeMs: 15000, startTimeMs: 0 },
            { byteLength: 3, endTimeMs: 30000, startTimeMs: 15000 },
          ],
          createdAt: '2026-05-09T10:00:00.000Z',
          durationMs: 30000,
          memoryId: 'mem_1',
          nextSequence: 2,
          segmentId: 'seg_recoverable',
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          schemaVersion: 1,
          title: 'Daily memory 录音',
          updatedAt: '2026-05-09T10:00:30.000Z',
          waveformSamples: [0.2, 0.3, 0.1],
          workspaceId: 'ws_1',
        }}
        workspaceSession={workspaceSession}
      />
    );

    await flushPromises();
    scrubPausedWaveformTo(0.5);

    expect(screen.queryByRole('button', { name: '继续录音' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '替换录音' })).not.toBeInTheDocument();
    expect(bridge.createRecordingDraft).not.toHaveBeenCalled();
    expect(bridge.appendRecordingAudioChunk).not.toHaveBeenCalled();
    expect(bridge.discardRecordingDraft).not.toHaveBeenCalled();
    expect(media.adapter.start).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalledWith('恢复录音可以先保存或放弃，暂不支持继续替换。');
  });

  it('keeps the previous recovery marker when unmounted during active replacement copy', async () => {
    const prefixCopy =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['cloneRecordingDraftPrefix']>>>();
    const bridge = installWorkspaceBridge({
      cloneRecordingDraftPrefix: vi.fn(() => prefixCopy.promise),
      createRecordingDraft: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_1' },
        })
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_replacement' },
        }),
    });
    const media = createMediaAdapter();

    const { unmount } = render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(15000));
    act(() => media.emitChunk(new Uint8Array([1, 2])));
    await flushPromises();
    act(() => vi.advanceTimersByTime(15000));
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    scrubPausedWaveformTo(0.5);
    const replaceButton = screen.getByRole('button', { name: '替换录音' });
    fireEvent.click(replaceButton);
    fireEvent.click(replaceButton);
    await flushPromises();
    expect(screen.getByRole('button', { name: '正在替换录音' })).toBeDisabled();
    expect(bridge.createRecordingDraft).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: '正在替换录音' }));
    expect(bridge.createRecordingDraft).toHaveBeenCalledTimes(2);
    unmount();
    prefixCopy.resolve({
      error: {
        code: 'ERR_RECORDING_APPEND_FAILED' as const,
        message: 'copy failed',
      },
      ok: false as const,
    });
    await flushPromises();

    expect(bridge.discardRecordingDraft).not.toHaveBeenCalledWith({
      segmentId: 'seg_1',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(
      JSON.parse(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1') ?? '{}')
    ).toMatchObject({
      segmentId: 'seg_1',
    });
    expect(toast.error).not.toHaveBeenCalledWith('替换录音失败，原录音已保留。');
  });

  it('updates the paused cursor and restarts capture when replacing from the beginning', async () => {
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_1' },
        })
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_2' },
        }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(14970));
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));

    scrubPausedWaveformTo(0);

    expect(screen.getByText('00:00.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '替换录音' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '替换录音' }));
    await flushPromises();

    expect(media.adapter.start).toHaveBeenCalledTimes(2);
    expect(bridge.createRecordingDraft).toHaveBeenCalledTimes(2);
    expect(media.controllers[0]?.stop).toHaveBeenCalledTimes(1);
    expect(bridge.cloneRecordingDraftPrefix).not.toHaveBeenCalled();
    expect(bridge.startRecordingTranscription).toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-2',
      recordingSessionId: 'recording-2',
      revisionId: 'recording-2-revision-0',
      timeOffsetMs: 0,
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(bridge.discardRecordingDraft).toHaveBeenCalledWith({
      segmentId: 'seg_1',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    act(() => media.emitChunk(new Uint8Array([7, 8])));
    await flushPromises();
    expect(bridge.appendRecordingAudioChunk).toHaveBeenCalledWith({
      chunk: new Uint8Array([7, 8]),
      segmentId: 'seg_2',
      sequence: 0,
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(screen.getByRole('button', { name: '暂停录音' })).toBeEnabled();
  });

  it('starts replacement immediately after resolving the durable cursor boundary', async () => {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:draft-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(5000));
    act(() => media.emitChunk(new Uint8Array([1])));
    await flushPromises();
    act(() => vi.advanceTimersByTime(1000));
    act(() => media.emitChunk(new Uint8Array([2])));
    await flushPromises();
    act(() => vi.advanceTimersByTime(14000));
    act(() => media.emitChunk(new Uint8Array([3])));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    await flushPromises();
    fireEvent.canPlay(screen.getByTestId('draft-playback-audio'));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '播放录音' }));
    await flushPromises();

    const draftAudio = screen.getByTestId('draft-playback-audio') as HTMLAudioElement;
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);

    act(() => {
      draftAudio.currentTime = 5.25;
      fireEvent.timeUpdate(draftAudio);
    });
    expect(screen.getByText('00:05.25')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '替换录音' }));
    await flushPromises();

    expect(screen.getByText('00:06.00')).toBeInTheDocument();
    expect(bridge.createRecordingDraft).toHaveBeenCalledTimes(2);
    expect(bridge.cloneRecordingDraftPrefix).toHaveBeenCalledWith(
      expect.objectContaining({
        retainedByteLength: 2,
        sourceSegmentId: 'seg_1',
        targetSegmentId: 'seg_1',
      })
    );
    expect(media.controller.resume).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalledWith('从这里重新录制会替换后面的录音内容。');
  });

  it('does not flush retained PCM before a replacement cursor when the cursor cuts a PCM chunk', async () => {
    const replacementStart = createDeferred<TranscriptionStartResponse>();
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_1' },
        })
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_2' },
        }),
      startRecordingTranscription: vi
        .fn()
        .mockResolvedValueOnce({ ok: true as const, value: { accepted: true as const } })
        .mockImplementationOnce(() => replacementStart.promise),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(5000));
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => media.emitPcm(new Uint8Array(192_000).fill(7)));
    act(() => vi.advanceTimersByTime(15000));
    act(() => media.emitChunk(new Uint8Array([4, 5, 6])));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    scrubPausedWaveformTo(0.25);
    fireEvent.click(screen.getByRole('button', { name: '替换录音' }));
    await flushPromises();

    vi.mocked(bridge.sendRecordingTranscriptionAudio).mockClear();
    replacementStart.resolve({ ok: true, value: { accepted: true } });
    await flushPromises();

    expect(bridge.sendRecordingTranscriptionAudio).not.toHaveBeenCalled();
  });

  it('saves only the transcript retained before a replacement cursor', async () => {
    let transcriptionListener: Parameters<
      Window['reoWorkspace']['onRecordingTranscriptionEvent']
    >[0] = () => {};
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_1' },
        })
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_2' },
        }),
      onRecordingTranscriptionEvent: vi.fn((listener) => {
        transcriptionListener = listener;
        return () => {};
      }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(20000));
    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [
          {
            endTimeMs: 4_000,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '保留的转写',
          },
          {
            endTimeMs: 20_000,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 5_000,
            text: '应该被替换删除的旧文本',
          },
        ],
      })
    );
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    scrubPausedWaveformTo(0.25);
    fireEvent.click(screen.getByRole('button', { name: '替换录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.saveTranscript).toHaveBeenCalledWith({
      markdown: '保留的转写',
      memoryId: 'mem_1',
      segmentId: 'seg_2',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(bridge.saveTranscript).not.toHaveBeenCalledWith(
      expect.objectContaining({
        markdown: expect.stringContaining('应该被替换删除'),
      })
    );
  });

  it('invalidates a stale paused playback URL after replacement truncates audio chunks', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:before-replacement');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    installWorkspaceBridge({
      createRecordingDraft: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_1' },
        })
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_2' },
        }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(5000));
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();
    act(() => vi.advanceTimersByTime(1000));
    act(() => media.emitChunk(new Uint8Array([4, 5, 6])));
    await flushPromises();
    act(() => vi.advanceTimersByTime(14000));
    act(() => media.emitChunk(new Uint8Array([7, 8, 9])));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '播放录音' }));
    await flushPromises();

    expect(screen.getByTestId('draft-playback-audio')).toHaveAttribute(
      'src',
      'blob:before-replacement'
    );

    scrubPausedWaveformTo(0.25);
    fireEvent.click(screen.getByRole('button', { name: '替换录音' }));
    await flushPromises();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:before-replacement');
    expect(screen.getByTestId('draft-playback-audio')).not.toHaveAttribute(
      'src',
      'blob:before-replacement'
    );
  });

  it('rolls back replacement state if fresh capture cannot restart at the beginning', async () => {
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_1' },
        })
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_2' },
        }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(15000));
    act(() => media.emitChunk(new Uint8Array([1, 2])));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    vi.mocked(media.adapter.start).mockRejectedValueOnce(new Error('restart failed'));
    scrubPausedWaveformTo(0);
    fireEvent.click(screen.getByRole('button', { name: '替换录音' }));
    await flushPromises();

    expect(media.controllers[0]?.pause).toHaveBeenCalledTimes(2);
    expect(bridge.discardRecordingDraft).toHaveBeenCalledWith({
      segmentId: 'seg_2',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(bridge.discardRecordingDraft).not.toHaveBeenCalledWith({
      segmentId: 'seg_1',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(toast.error).toHaveBeenCalledWith('替换录音失败，原录音已保留。');
    expect(screen.getByRole('button', { name: '替换录音' })).toBeEnabled();
  });

  it('routes beginning replacement PCM through a fresh recording session', async () => {
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_1' },
        })
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_2' },
        }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    scrubPausedWaveformTo(0);
    fireEvent.click(screen.getByRole('button', { name: '替换录音' }));
    await flushPromises();

    expect(media.adapter.start).toHaveBeenCalledTimes(2);

    act(() => media.emitPcm(new Uint8Array([1, 2])));
    await flushPromises();
    expect(bridge.sendRecordingTranscriptionAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        chunk: new Uint8Array([1, 2]),
        recordingFlowSessionId: 'recording-2',
        recordingSessionId: 'recording-2',
        revisionId: 'recording-2-revision-0',
      })
    );
  });

  it('does not open a new microphone intent when replacement draft creation fails', async () => {
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_1' },
        })
        .mockResolvedValueOnce({
          error: { code: 'ERR_WORKSPACE_LOCK_LOST' as const, message: 'Workspace lock was lost' },
          ok: false as const,
        }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(5000));
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    scrubPausedWaveformTo(0);
    fireEvent.click(screen.getByRole('button', { name: '替换录音' }));
    await flushPromises();

    expect(bridge.beginMicrophoneIntent).not.toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-2',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(bridge.clearMicrophoneIntent).not.toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-2',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(toast.error).toHaveBeenCalledWith('记忆空间锁已失效。');
    expect(media.adapter.start).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '替换录音' })).toBeEnabled();
  });

  it('does not open replacement transcription when retained audio copy fails', async () => {
    const bridge = installWorkspaceBridge({
      cloneRecordingDraftPrefix: vi.fn(async () => ({
        error: {
          code: 'ERR_RECORDING_APPEND_FAILED' as const,
          message: 'copy failed',
        },
        ok: false as const,
      })),
      createRecordingDraft: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_1' },
        })
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_2' },
        }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(15000));
    act(() => media.emitChunk(new Uint8Array([1, 2])));
    await flushPromises();
    act(() => vi.advanceTimersByTime(15000));
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    scrubPausedWaveformTo(0.5);
    fireEvent.click(screen.getByRole('button', { name: '替换录音' }));
    await flushPromises();

    expect(bridge.startRecordingTranscription).not.toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-1',
      timeOffsetMs: 15000,
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(bridge.discardRecordingDraft).toHaveBeenCalledWith({
      segmentId: 'seg_2',
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    expect(media.adapter.start).toHaveBeenCalledTimes(1);
    expect(media.controller.resume).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('无法保存录音音频。');
    expect(screen.getByRole('button', { name: '替换录音' })).toBeEnabled();
  });

  it('pauses and resumes the timer without synthesizing transcript text', async () => {
    installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    expect(screen.getByText(/正在录制本地音频/)).toBeInTheDocument();
    expect(screen.getByLabelText('实时录音波形')).toBeInTheDocument();
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
    const onOpenChange = vi.fn();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    expect(screen.getByText(/正在录制本地音频/)).toBeInTheDocument();
    act(() => media.emitChunk(new Uint8Array([1])));
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    append.resolve({ ok: true, value: { nextSequence: 1 } });
    await flushPromises();
    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('closes the recording surface without waiting for final transcription backfill', async () => {
    const finalTranscription = createDeferred<TranscriptionControlResponse>();
    installWorkspaceBridge({
      finishRecordingTranscription: vi.fn(() => finalTranscription.promise),
    });
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
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

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(window.reoWorkspace.finalizeRecordingDraft).not.toHaveBeenCalled();

    finalTranscription.resolve({ ok: true, value: { accepted: true } });
    await flushPromises();
    expect(window.reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledTimes(1);
  });

  it('passes the elapsed recording duration to finalize', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
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
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      title: '录音1',
      workspaceHandle: 'workspace-handle-secret',
    });
  });

  it('warns before saving an extremely short recording and keeps recording active', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(750));

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(screen.getByRole('status')).toHaveTextContent('录音时间较短，可能无法生成有效内容。');
    expect(media.controller.stop).not.toHaveBeenCalled();
    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '暂停录音' })).toBeEnabled();
  });

  it('warns before saving a paused short recording without clearing preview playback', async () => {
    installWorkspaceBridge();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:draft-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();
    act(() => vi.advanceTimersByTime(750));
    fireEvent.click(screen.getByRole('button', { name: '暂停录音' }));
    await flushPromises();
    fireEvent.canPlay(screen.getByTestId('draft-playback-audio'));
    await flushPromises();
    expect(screen.getByRole('button', { name: '播放录音' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(screen.getByRole('status')).toHaveTextContent('录音时间较短，可能无法生成有效内容。');
    expect(media.controller.stop).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '继续录音' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '播放录音' })).toBeEnabled();
  });

  it('passes the current memory target when recording from the current memory context', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        recordingTarget={{ kind: 'existing-memory', memoryId: 'mem_birthday' }}
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    act(() => vi.advanceTimersByTime(2000));
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        memoryId: 'mem_birthday',
        segmentId: 'seg_1',
        workspaceHandle: 'workspace-handle-secret',
      })
    );
  });

  it('warns before saving a sub-second recording with captured audio, then preserves exact duration on confirm', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
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

    expect(screen.getByRole('status')).toHaveTextContent('录音时间较短，可能无法生成有效内容。');
    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();

    expect(bridge.finalizeRecordingDraft).toHaveBeenCalledWith({
      durationMs: 750,
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      title: '录音1',
      workspaceHandle: 'workspace-handle-secret',
    });
  });

  it('automatically pauses and notifies when recording reaches the maximum duration', async () => {
    installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();

    vi.spyOn(performance, 'now').mockReturnValue(60 * 60 * 1000 + 1);
    act(() => vi.advanceTimersByTime(40));
    await flushPromises();

    expect(toast).toHaveBeenCalledWith('录音已达到时长上限，已自动暂停。');
    expect(media.controller.pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '继续录音' })).toBeEnabled();
    expect(screen.getByText('60:00.00')).toBeInTheDocument();
  });

  it('shows a non-blocking toast after sustained silence while durable recording continues', async () => {
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    act(() => vi.advanceTimersByTime(15000));
    act(() => media.emitLevel([0.001, 0.002, 0.001]));
    act(() => media.emitChunk(new Uint8Array([1, 2, 3])));
    await flushPromises();

    expect(toast).toHaveBeenCalledWith('暂时没有检测到明显声音，你可以靠近麦克风或继续录音。');
    expect(bridge.appendRecordingAudioChunk).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '暂停录音' })).toBeEnabled();
  });

  it('does not expose stop or finalize before the media controller is ready', async () => {
    const controller: RecordingMediaController = {
      flush: vi.fn(async () => true),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(async () => {}),
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
        onAudioSegmentFinalized={() => {}}
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
          value: { nextSequence: 0, segmentId: 'seg_1' },
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
      flush: vi.fn(async () => true),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(async () => {}),
    };
    vi.mocked(media.adapter.start).mockImplementation(async () => {
      order.push('media-start');
      return controller;
    });

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();

    expect(order).toEqual(['begin-intent', 'create-draft', 'media-start']);
    expect(bridge.beginMicrophoneIntent).toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-1',
      workspaceHandle: 'workspace-handle-secret',
    });
  });

  it('does not start media acquisition when microphone intent is rejected', async () => {
    const bridge = installWorkspaceBridge({
      beginMicrophoneIntent: vi.fn(async () => ({
        error: {
          code: 'ERR_MIC_INTENT_ALREADY_ACTIVE' as const,
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
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();

    expect(media.adapter.start).not.toHaveBeenCalled();
    expect(bridge.createRecordingDraft).not.toHaveBeenCalled();
    expect(bridge.discardRecordingDraft).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('麦克风正在被另一个录音流程使用。');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears microphone intent when draft creation fails after intent registration', async () => {
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi.fn(async () => ({
        error: { code: 'ERR_WORKSPACE_LOCK_LOST' as const, message: 'Workspace lock was lost' },
        ok: false as const,
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();

    expect(media.adapter.start).not.toHaveBeenCalled();
    expect(bridge.clearMicrophoneIntent).toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(toast.error).toHaveBeenCalledWith('记忆空间锁已失效。');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
        onAudioSegmentFinalized={() => {}}
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
      recordingFlowSessionId: 'recording-1',
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
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    unmount();

    expect(bridge.clearMicrophoneIntent).toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-1',
      workspaceHandle: 'workspace-handle-secret',
    });

    draft.resolve({ ok: true, value: { nextSequence: 0, segmentId: 'seg_1' } });
    await flushPromises();

    expect(bridge.discardRecordingDraft).toHaveBeenCalledWith({
      segmentId: 'seg_1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(media.adapter.start).not.toHaveBeenCalled();
  });

  it('discards the draft when unmounted while media acquisition is pending', async () => {
    const start = createDeferred<RecordingMediaController>();
    const bridge = installWorkspaceBridge();
    const media = createMediaAdapter();
    const controller: RecordingMediaController = {
      flush: vi.fn(async () => true),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(async () => {}),
    };
    vi.mocked(media.adapter.start).mockReturnValue(start.promise);

    const { unmount } = render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    unmount();

    expect(bridge.clearMicrophoneIntent).toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(bridge.discardRecordingDraft).toHaveBeenCalledWith({
      segmentId: 'seg_1',
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
        onAudioSegmentFinalized={() => {}}
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
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={nextWorkspaceSession}
      />
    );

    expect(bridge.clearMicrophoneIntent).toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-1',
      workspaceHandle: 'workspace-handle-secret',
    });

    draft.resolve({ ok: true, value: { nextSequence: 0, segmentId: 'seg_1' } });
    await flushPromises();

    expect(bridge.discardRecordingDraft).toHaveBeenCalledWith({
      segmentId: 'seg_1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(media.adapter.start).not.toHaveBeenCalled();
  });

  it('does not finalize when audio append returns an error envelope', async () => {
    const bridge = installWorkspaceBridge({
      appendRecordingAudioChunk: vi.fn(async () => ({
        error: { code: 'ERR_RECORDING_SEQUENCE' as const, message: 'Append failed' },
        ok: false as const,
      })),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
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
    expect(toast.error).toHaveBeenCalledWith('录音片段顺序不正确。');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
        onAudioSegmentFinalized={() => {}}
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
    expect(toast.error).toHaveBeenCalledWith('音频写入失败。');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
        onAudioSegmentFinalized={() => {}}
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
      segmentId: 'seg_1',
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
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();

    expect(bridge.discardRecordingDraft).toHaveBeenCalledWith({
      segmentId: 'seg_1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(bridge.clearMicrophoneIntent).toHaveBeenCalledWith({
      recordingFlowSessionId: 'recording-1',
      workspaceHandle: 'workspace-handle-secret',
    });
    expect(bridge.startRecordingTranscription).not.toHaveBeenCalled();
    expect(bridge.closeRecordingTranscription).not.toHaveBeenCalled();
    expect(bridge.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('无法使用麦克风。');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('cleans up a failed recorder before retry and ignores stale chunks', async () => {
    const bridge = installWorkspaceBridge({
      createRecordingDraft: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_old' },
        })
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_new' },
        }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
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
      segmentId: 'seg_new',
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
          value: { nextSequence: 0, segmentId: 'seg_old' },
        })
        .mockResolvedValueOnce({
          ok: true as const,
          value: { nextSequence: 0, segmentId: 'seg_new' },
        }),
    });
    const media = createMediaAdapter();

    render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={() => {}}
        onAudioSegmentFinalized={() => {}}
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
    expect(media.controllers[0]?.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/正在录制本地音频/)).toBeInTheDocument();
  });

  it('resets the recording surface to ready state when reopened after completion', async () => {
    installWorkspaceBridge();
    const media = createMediaAdapter();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
    await flushPromises();
    await emitRecordedAudio(media);
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }));
    await flushPromises();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    rerender(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        open={false}
        workspaceSession={workspaceSession}
      />
    );
    rerender(
      <RecordingOverlayForTest
        mediaAdapter={media.adapter}
        onOpenChange={onOpenChange}
        onAudioSegmentFinalized={() => {}}
        open
        workspaceSession={workspaceSession}
      />
    );

    expect(screen.getByRole('heading', { name: '录音' })).toBeInTheDocument();
    expect(screen.getByText(/可以开始录制本地音频/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始录音' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '转写' })).not.toBeInTheDocument();
  });
});

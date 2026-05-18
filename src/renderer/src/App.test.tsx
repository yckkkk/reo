import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, mergeMemoryIntoSession } from './App';
import { THEME_PREFERENCE_STORAGE_KEY } from './app-shell/themePreference';
import { toast } from './components/ui/toaster';
import { createReoQueryClient, ReoQueryProvider } from './queryClient';
import type { WorkspaceMemoryDetail, WorkspaceMemorySummary } from './workspace/workspaceApi';
import {
  memoryDetailQueryKey,
  segmentSupplementContentQueryKey,
  segmentContentQueryKey,
  workspaceSnapshotQueryKey,
} from './workspace/workspaceQueries';

describe('App', () => {
  const reoWorkspace = {
    chooseDirectory: vi.fn(),
    listMemorySpaces: vi.fn(),
    initializeWorkspace: vi.fn(),
    openWorkspace: vi.fn(),
    openMemorySpace: vi.fn(),
    openMemorySpaceAgentsFile: vi.fn(),
    openMemoryDocument: vi.fn(),
    openSegmentDocument: vi.fn(),
    revealMemorySpaceInFinder: vi.fn(),
    revealMemoryInFinder: vi.fn(),
    revealSegmentInFinder: vi.fn(),
    copyMemorySpaceAbsolutePath: vi.fn(),
    copyMemoryAbsolutePath: vi.fn(),
    copyMemoryRelativePath: vi.fn(),
    copySegmentAbsolutePath: vi.fn(),
    copySegmentRelativePath: vi.fn(),
    removeMemorySpace: vi.fn(),
    closeWorkspace: vi.fn(),
    createMemory: vi.fn(),
    deleteMemory: vi.fn(),
    restoreDeletedMemory: vi.fn(),
    deleteSegment: vi.fn(),
    restoreDeletedSegment: vi.fn(),
    deleteSegmentSupplement: vi.fn(),
    restoreDeletedSegmentSupplement: vi.fn(),
    readMemoryDetail: vi.fn(),
    readFinalizedAudioSegment: vi.fn(),
    readFinalizedAudioSegmentSupplement: vi.fn(),
    createRecordingDraft: vi.fn(),
    createSegmentSupplementRecordingDraft: vi.fn(),
    readRecordingDraftAudio: vi.fn(),
    appendRecordingAudioChunk: vi.fn(),
    appendSegmentSupplementRecordingAudioChunk: vi.fn(),
    cloneRecordingDraftPrefix: vi.fn(),
    finalizeRecordingDraft: vi.fn(),
    finalizeSegmentSupplementRecordingDraft: vi.fn(),
    discardRecordingDraft: vi.fn(),
    discardSegmentSupplementRecordingDraft: vi.fn(),
    updateMemorySpaceTitle: vi.fn(),
    readWorkspaceSnapshot: vi.fn(),
    updateMemoryTitle: vi.fn(),
    updateSegmentTitle: vi.fn(),
    updateSegmentSupplementTitle: vi.fn(),
    saveTranscript: vi.fn(),
    saveSegmentSupplementTranscript: vi.fn(),
    requestSegmentTranscriptionBackfill: vi.fn(),
    requestSegmentSupplementTranscriptionBackfill: vi.fn(),
    beginMicrophoneIntent: vi.fn(),
    clearMicrophoneIntent: vi.fn(),
    startRecordingTranscription: vi.fn(),
    sendRecordingTranscriptionAudio: vi.fn(),
    finishRecordingTranscription: vi.fn(),
    closeRecordingTranscription: vi.fn(),
    readVoiceTranscriptionSettings: vi.fn(),
    setVoiceTranscriptionEnabled: vi.fn(),
    saveVoiceTranscriptionApiKey: vi.fn(),
    clearVoiceTranscriptionApiKey: vi.fn(),
    validateVoiceTranscriptionCredentials: vi.fn(),
    openVoiceTranscriptionProviderConsole: vi.fn(),
    onRecordingTranscriptionEvent: vi.fn(),
  };

  function createDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
      resolve = promiseResolve;
      reject = promiseReject;
    });
    return { promise, reject, resolve };
  }

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
        queueMicrotask(() => {
          if (this.state === 'recording') {
            this.ondataavailable?.({ data: new Blob([new Uint8Array([1])]) } as BlobEvent);
          }
        });
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
          getAudioTracks: () => [{ stop: vi.fn(), enabled: true }],
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
    vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    window.localStorage.clear();
    reoWorkspace.listMemorySpaces.mockResolvedValue({ ok: true, value: { memorySpaces: [] } });
    reoWorkspace.openMemorySpaceAgentsFile.mockResolvedValue({ ok: true });
    reoWorkspace.openMemoryDocument.mockResolvedValue({ ok: true });
    reoWorkspace.openSegmentDocument.mockResolvedValue({ ok: true });
    reoWorkspace.revealMemorySpaceInFinder.mockResolvedValue({ ok: true });
    reoWorkspace.revealMemoryInFinder.mockResolvedValue({ ok: true });
    reoWorkspace.revealSegmentInFinder.mockResolvedValue({ ok: true });
    reoWorkspace.copyMemorySpaceAbsolutePath.mockResolvedValue({ ok: true });
    reoWorkspace.copyMemoryAbsolutePath.mockResolvedValue({ ok: true });
    reoWorkspace.copyMemoryRelativePath.mockResolvedValue({ ok: true });
    reoWorkspace.copySegmentAbsolutePath.mockResolvedValue({ ok: true });
    reoWorkspace.copySegmentRelativePath.mockResolvedValue({ ok: true });
    reoWorkspace.removeMemorySpace.mockResolvedValue({ ok: true, value: { removed: true } });
    reoWorkspace.closeWorkspace.mockResolvedValue({ ok: true, value: { closed: true } });
    reoWorkspace.createMemory.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_MEMORY_CREATE_FAILED', message: 'Memory could not be created' },
    });
    reoWorkspace.deleteMemory.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_MEMORY_DELETE_FAILED', message: 'Memory could not be deleted' },
    });
    reoWorkspace.restoreDeletedMemory.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_MEMORY_RESTORE_FAILED', message: 'Memory could not be restored' },
    });
    reoWorkspace.deleteSegment.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_SEGMENT_DELETE_FAILED', message: 'Segment could not be deleted' },
    });
    reoWorkspace.restoreDeletedSegment.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_SEGMENT_RESTORE_FAILED', message: 'Segment could not be restored' },
    });
    reoWorkspace.deleteSegmentSupplement.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_SEGMENT_SUPPLEMENT_DELETE_FAILED',
        message: 'SegmentSupplement could not be deleted',
      },
    });
    reoWorkspace.restoreDeletedSegmentSupplement.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_SEGMENT_SUPPLEMENT_RESTORE_FAILED',
        message: 'SegmentSupplement could not be restored',
      },
    });
    reoWorkspace.updateMemoryTitle.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_MEMORY_NOT_FOUND', message: 'Memory not found' },
    });
    reoWorkspace.updateSegmentTitle.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_MEMORY_NOT_FOUND', message: 'Segment not found' },
    });
    reoWorkspace.updateSegmentSupplementTitle.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_RECORDING_NOT_FOUND', message: 'Supplement not found' },
    });
    reoWorkspace.updateMemorySpaceTitle.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_MEMORY_SPACE_NOT_FOUND',
        message: 'Memory space not found',
      },
    });
    reoWorkspace.readWorkspaceSnapshot.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_OPEN_FAILED',
        message: 'Workspace snapshot could not be read',
      },
    });
    reoWorkspace.readMemoryDetail.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_MEMORY_NOT_FOUND', message: 'Memory not found' },
    });
    reoWorkspace.readFinalizedAudioSegmentSupplement.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_RECORDING_NOT_FOUND', message: 'Supplement recording not found' },
    });
    reoWorkspace.readRecordingDraftAudio.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_RECORDING_NOT_FOUND', message: 'Recording draft not found' },
    });
    reoWorkspace.createSegmentSupplementRecordingDraft.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_RECORDING_NOT_FOUND', message: 'Segment not found' },
    });
    reoWorkspace.appendSegmentSupplementRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.finalizeSegmentSupplementRecordingDraft.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_RECORDING_FINALIZE_FAILED', message: 'Supplement could not be saved' },
    });
    reoWorkspace.discardSegmentSupplementRecordingDraft.mockResolvedValue({
      ok: true,
      value: { discarded: true },
    });
    reoWorkspace.startRecordingTranscription.mockResolvedValue({
      ok: true,
      value: { accepted: true },
    });
    reoWorkspace.sendRecordingTranscriptionAudio.mockResolvedValue({
      ok: true,
      value: { accepted: true },
    });
    reoWorkspace.finishRecordingTranscription.mockResolvedValue({
      ok: true,
      value: { accepted: true },
    });
    reoWorkspace.closeRecordingTranscription.mockResolvedValue({
      ok: true,
      value: { accepted: true },
    });
    reoWorkspace.readVoiceTranscriptionSettings.mockResolvedValue({
      ok: true,
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
    });
    reoWorkspace.onRecordingTranscriptionEvent.mockReturnValue(() => {});
    Object.defineProperty(window, 'reoWorkspace', {
      configurable: true,
      value: reoWorkspace,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function openCreateWorkspaceDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));
    await user.click(screen.getByRole('menuitem', { name: '创建本地记忆空间' }));
  }

  function mockVoiceTranscriptionSettings(enabled: boolean) {
    reoWorkspace.readVoiceTranscriptionSettings.mockResolvedValue({
      ok: true,
      value: {
        settings: {
          enabled,
          apiKeyConfigured: enabled,
          apiKeyLastFour: enabled ? '1234' : null,
          lastValidatedAt: enabled ? '2026-05-09T09:00:00.000Z' : null,
          lastValidationOk: enabled ? true : null,
          lastValidationCode: enabled ? 'ok' : null,
        },
      },
    });
  }

  type SegmentSupplementFixture = {
    readonly memory: WorkspaceMemorySummary;
    readonly segment: WorkspaceMemoryDetail['segments'][number];
    readonly supplement: WorkspaceMemoryDetail['segments'][number]['supplements'][number];
  };

  function createSegmentSupplementFixture(): SegmentSupplementFixture {
    const memory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      segmentCount: 1,
      durationMs: 6000,
      audioByteLength: 2050,
      hasTranscript: true,
      supplementCount: 1,
    };
    const supplement = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      supplementId: 'sup_birthday_followup',
      type: 'audio' as const,
      title: '补充录音1',
      createdAt: '2026-05-06T13:11:00.000Z',
      updatedAt: '2026-05-06T13:11:00.000Z',
      durationMs: 1000,
      audioByteLength: 2,
      lastTranscriptionAttempt: 'never' as const,
      transcript: { exists: false },
    };
    const segment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      type: 'audio' as const,
      title: '录音1',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      durationMs: 5000,
      audioByteLength: 2048,
      lastTranscriptionAttempt: 'never' as const,
      transcript: { exists: false },
      supplementCount: 1,
      supplements: [supplement],
    };

    return { supplement, memory, segment };
  }

  function mockSegmentSupplementWorkspace(fixture: SegmentSupplementFixture) {
    const { memory, segment } = fixture;

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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [segment],
        },
      },
    }));
    reoWorkspace.readFinalizedAudioSegment.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: 'ws_1',
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        transcript: { exists: false, text: '' },
      },
    }));
    reoWorkspace.readFinalizedAudioSegmentSupplement.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: 'ws_1',
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        supplementId: payload.supplementId,
        audio: new Uint8Array([4, 5]),
        audioByteLength: 2,
        transcript: { exists: true, text: '补充录音转写正文' },
      },
    }));
  }

  async function createWorkspaceWithSegmentSupplement(user: ReturnType<typeof userEvent.setup>) {
    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('tab', { name: '补充录音1' });
  }

  async function createWorkspaceWithSingleSegment(user: ReturnType<typeof userEvent.setup>) {
    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
  }

  function mockWorkspaceWithSingleSegment({
    memoryId = 'mem_transcription_menu',
    segmentId = 'seg_transcription_menu',
    segmentTitle = 'Transcription menu segment',
    transcriptExists = false,
  }: {
    readonly memoryId?: string;
    readonly segmentId?: string;
    readonly segmentTitle?: string;
    readonly transcriptExists?: boolean;
  } = {}) {
    const memory = {
      memoryId,
      title: 'Transcription menu memory',
      createdAt: '2026-05-16T18:20:00.000Z',
      updatedAt: '2026-05-16T18:21:00.000Z',
      segmentCount: 1,
      durationMs: 4200,
      audioByteLength: 12,
      hasTranscript: transcriptExists,
      supplementCount: 0,
    };
    const segment = {
      ...audioSegmentProjection({
        audioByteLength: 12,
        durationMs: 4200,
        memoryId,
        segmentId,
        title: segmentTitle,
        transcriptExists,
      }),
      lastTranscriptionAttempt: transcriptExists ? ('success' as const) : ('failed' as const),
    };

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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [segment],
        },
      },
    }));
    reoWorkspace.readFinalizedAudioSegment.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: payload.workspaceId,
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        transcript: {
          exists: transcriptExists,
          text: transcriptExists ? '已有转录正文' : '',
        },
      },
    }));

    return { memory, segment };
  }

  async function submitSegmentSupplementRename(
    user: ReturnType<typeof userEvent.setup>,
    currentTitle: string,
    nextTitle: string
  ) {
    const tab = screen.getByRole('tab', { name: currentTitle });
    const tabItem = tab.closest('[data-slot="memory-studio-supplement-tab-item"]');
    expect(tabItem).toBeInstanceOf(HTMLElement);
    await user.click(tab);
    await user.hover(tabItem as HTMLElement);
    await user.click(screen.getByRole('button', { name: `${currentTitle} 更多操作` }));
    await user.click(screen.getByRole('menuitem', { name: '重命名' }));

    const dialog = screen.getByRole('dialog', { name: '重命名补充内容' });
    const titleInput = within(dialog).getByLabelText('补充内容名称');
    await user.clear(titleInput);
    await user.type(titleInput, nextTitle);
    await user.click(within(dialog).getByRole('button', { name: '保存' }));
  }

  async function openSegmentSupplementDeleteDialog(
    user: ReturnType<typeof userEvent.setup>,
    title: string
  ) {
    await user.click(screen.getByRole('tab', { name: title }));
    const supplementTab = screen.getByRole('tab', { name: title });
    const supplementTabItem = supplementTab.closest(
      '[data-slot="memory-studio-supplement-tab-item"]'
    );
    expect(supplementTabItem).toBeInstanceOf(HTMLElement);
    await user.hover(supplementTabItem as HTMLElement);
    await user.click(screen.getByRole('button', { name: `${title} 更多操作` }));
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    expect(screen.getByRole('alertdialog', { name: '删除补充内容' })).toBeInTheDocument();
  }

  async function expandMemoryRail(user: ReturnType<typeof userEvent.setup>) {
    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    const expandButton = within(titlebar).queryByRole('button', { name: '展开记忆列表' });

    if (expandButton) {
      await user.click(expandButton);
    }
  }

  async function findTitlebarMemoryControl(title: string) {
    return within(screen.getByRole('banner', { name: '标题栏', hidden: true })).findByRole(
      'button',
      {
        hidden: true,
        name: `${title} 记忆操作`,
      }
    );
  }

  function getTitlebarMemoryControl(title: string) {
    return within(screen.getByRole('banner', { name: '标题栏', hidden: true })).getByRole(
      'button',
      {
        hidden: true,
        name: `${title} 记忆操作`,
      }
    );
  }

  function stubWorkspaceRailInlineMedia(matches: boolean) {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQueryList = {
      matches,
      media: '(min-width: 1100px)',
      onchange: null,
      addEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          listeners.add(listener);
        }
      }),
      removeEventListener: vi.fn(
        (event: string, listener: (event: MediaQueryListEvent) => void) => {
          if (event === 'change') {
            listeners.delete(listener);
          }
        }
      ),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        ...mediaQueryList,
        matches: query === mediaQueryList.media ? mediaQueryList.matches : false,
        media: query,
      }))
    );
    return {
      setMatches(nextMatches: boolean) {
        mediaQueryList.matches = nextMatches;
        for (const listener of listeners) {
          listener({ matches: nextMatches, media: mediaQueryList.media } as MediaQueryListEvent);
        }
      },
    };
  }

  function audioSegmentProjection({
    audioByteLength,
    createdAt = '2026-05-09T10:00:00.000Z',
    durationMs,
    memoryId,
    segmentId,
    title,
    transcriptExists = false,
    updatedAt = createdAt,
    workspaceId = 'ws_1',
  }: {
    readonly audioByteLength: number;
    readonly createdAt?: string;
    readonly durationMs: number;
    readonly memoryId: string;
    readonly segmentId: string;
    readonly title: string;
    readonly transcriptExists?: boolean;
    readonly updatedAt?: string;
    readonly workspaceId?: string;
  }) {
    return {
      workspaceId,
      memoryId,
      segmentId,
      type: 'audio' as const,
      title,
      createdAt,
      updatedAt,
      durationMs,
      audioByteLength,
      transcript: { exists: transcriptExists },
      supplementCount: 0,
      supplements: [],
    };
  }

  it('renders starter home without a page plus and opens creation from the sidebar entry', async () => {
    const user = userEvent.setup();
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    expect(screen.getByRole('navigation', { name: '记忆空间' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '今天想记录些什么？' })).not.toBeInTheDocument();
    expect(
      screen.queryByText('Create a local workspace to start collecting memories.')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '创建本地记忆空间' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '创建记忆空间' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新记忆' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '资料库' })).toBeInTheDocument();
    await openCreateWorkspaceDialog(user);

    expect(screen.getByRole('dialog', { name: '创建本地记忆空间' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '添加记忆空间' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('记忆空间名称')).toHaveFocus();
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
    expect(screen.queryByRole('heading', { name: '今天想记录些什么？' })).not.toBeInTheDocument();
  });

  it('opens voice settings in the same app window and returns to the app', async () => {
    const user = userEvent.setup();
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(screen.getByRole('button', { name: '设置' }));

    expect(await screen.findByRole('region', { name: '语音设置' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '语音' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '启用流式语音识别' })).toBeInTheDocument();
    expect(screen.queryByRole('main', { name: '记忆空间内容' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '首页' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '资料库' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '返回应用' }));

    expect(screen.getByRole('region', { name: '首页' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '语音设置' })).not.toBeInTheDocument();
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
        },
      },
    });

    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'light');

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(screen.getByRole('button', { name: '切换到深色模式' }));
    expect(
      screen.getByRole('main', { name: '记忆空间内容' }).closest('[data-theme]')
    ).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();
    expect(
      screen.getByRole('main', { name: '记忆空间内容' }).closest('[data-theme]')
    ).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    expect(within(titlebar).getByText('Daily memory')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '记忆空间栏' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '记忆空间' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: '记忆空间内容' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '记忆空间舞台' })).toBeInTheDocument();
    expect(within(titlebar).getByRole('button', { name: '展开记忆列表' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByRole('navigation', { name: '记忆列表' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '表达入口' })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: '搜索记忆' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '记忆' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '收藏' })).not.toBeInTheDocument();
    expect(screen.queryByText('workspace-handle-1')).not.toBeInTheDocument();
  });

  it('returns from settings without releasing the loaded workspace session or stage state', async () => {
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
              memoryId: 'mem_existing',
              title: 'Existing memory',
              createdAt: '2026-05-07T14:30:00.000Z',
              updatedAt: '2026-05-07T14:30:00.000Z',
              segmentCount: 1,
              durationMs: 1,
              audioByteLength: 1,
              hasTranscript: false,
              supplementCount: 0,
            },
          ],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await findTitlebarMemoryControl('Existing memory')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '设置' }));
    expect(await screen.findByRole('region', { name: '语音设置' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '返回应用' }));

    expect(await findTitlebarMemoryControl('Existing memory')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Memory Studio' })).toBeInTheDocument();
    expect(reoWorkspace.closeWorkspace).not.toHaveBeenCalled();
  });

  it('requests segment transcription backfill when retrying a failed segment transcription from the loaded workspace', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_retry_transcription',
      title: 'Retry transcription memory',
      createdAt: '2026-05-16T18:20:00.000Z',
      updatedAt: '2026-05-16T18:21:00.000Z',
      segmentCount: 1,
      durationMs: 4200,
      audioByteLength: 12,
      hasTranscript: false,
      supplementCount: 0,
    };
    const segment = {
      ...audioSegmentProjection({
        audioByteLength: 12,
        durationMs: 4200,
        memoryId: memory.memoryId,
        segmentId: 'seg_retry_transcription',
        title: 'Failed transcription segment',
      }),
      lastTranscriptionAttempt: 'failed' as const,
    };
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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [segment],
        },
      },
    }));
    reoWorkspace.readFinalizedAudioSegment.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: payload.workspaceId,
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        transcript: { exists: false, text: '' },
      },
    }));

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    expect(await within(content).findByText('上次生成转录失败。')).toBeInTheDocument();

    const backfill =
      createDeferred<
        Awaited<ReturnType<Window['reoWorkspace']['requestSegmentTranscriptionBackfill']>>
      >();
    reoWorkspace.requestSegmentTranscriptionBackfill.mockReturnValueOnce(backfill.promise);

    await user.click(within(content).getByRole('button', { name: '重试' }));

    expect(await screen.findByText('正在生成转录。')).toBeInTheDocument();
    await waitFor(() =>
      expect(reoWorkspace.requestSegmentTranscriptionBackfill).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: memory.memoryId,
        segmentId: segment.segmentId,
        mode: 'fill-missing',
      })
    );
    backfill.resolve({
      ok: true,
      value: { memory: { ...memory, hasTranscript: true }, saved: true },
    });
    expect(await screen.findByText('已生成转录')).toBeInTheDocument();
  });

  it('ignores an in-flight segment transcription backfill response after reopening the same workspace with a new handle', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_retry_reopen_transcription',
      title: 'Retry reopen transcription memory',
      createdAt: '2026-05-16T18:20:00.000Z',
      updatedAt: '2026-05-16T18:21:00.000Z',
      segmentCount: 1,
      durationMs: 4200,
      audioByteLength: 12,
      hasTranscript: false,
      supplementCount: 0,
    };
    const segment = {
      ...audioSegmentProjection({
        audioByteLength: 12,
        durationMs: 4200,
        memoryId: memory.memoryId,
        segmentId: 'seg_retry_reopen_transcription',
        title: 'Failed reopen transcription segment',
      }),
      lastTranscriptionAttempt: 'failed' as const,
    };
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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [segment],
        },
      },
    }));
    reoWorkspace.readFinalizedAudioSegment.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: payload.workspaceId,
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        transcript: { exists: false, text: '' },
      },
    }));
    const backfill =
      createDeferred<
        Awaited<ReturnType<Window['reoWorkspace']['requestSegmentTranscriptionBackfill']>>
      >();
    reoWorkspace.requestSegmentTranscriptionBackfill.mockReturnValueOnce(backfill.promise);

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    await user.click(within(content).getByRole('button', { name: '重试' }));
    expect(await screen.findByText('正在生成转录。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { hidden: true, name: '首页' }));
    await waitFor(() =>
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      })
    );

    reoWorkspace.initializeWorkspace.mockResolvedValueOnce({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-2',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [memory],
        },
      },
    });
    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await findTitlebarMemoryControl(memory.title)).toBeInTheDocument();

    await act(async () => {
      backfill.resolve({
        ok: true,
        value: { memory: { ...memory, hasTranscript: true }, saved: true },
      });
      await backfill.promise;
    });

    expect(screen.queryByText('已生成转录')).not.toBeInTheDocument();
  }, 10_000);

  it('requests supplement transcription backfill when retrying a failed supplement transcription from the loaded workspace', async () => {
    const user = userEvent.setup();
    const fixture = createSegmentSupplementFixture();
    mockSegmentSupplementWorkspace({
      ...fixture,
      supplement: {
        ...fixture.supplement,
        lastTranscriptionAttempt: 'failed',
      },
      segment: {
        ...fixture.segment,
        supplements: [
          {
            ...fixture.supplement,
            lastTranscriptionAttempt: 'failed',
          },
        ],
      },
    });
    reoWorkspace.readFinalizedAudioSegmentSupplement.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: 'ws_1',
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        supplementId: payload.supplementId,
        audio: new Uint8Array([4, 5]),
        audioByteLength: 2,
        transcript: { exists: false, text: '' },
      },
    }));

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await createWorkspaceWithSegmentSupplement(user);
    await user.click(screen.getByRole('tab', { name: '补充录音1' }));
    expect(await screen.findByText('上次生成补充录音转录失败。')).toBeInTheDocument();

    const backfill =
      createDeferred<
        Awaited<ReturnType<Window['reoWorkspace']['requestSegmentSupplementTranscriptionBackfill']>>
      >();
    reoWorkspace.requestSegmentSupplementTranscriptionBackfill.mockReturnValueOnce(
      backfill.promise
    );

    await user.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByText('正在生成补充录音转录。')).toBeInTheDocument();
    await waitFor(() =>
      expect(reoWorkspace.requestSegmentSupplementTranscriptionBackfill).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: fixture.memory.memoryId,
        segmentId: fixture.segment.segmentId,
        supplementId: fixture.supplement.supplementId,
        mode: 'fill-missing',
      })
    );
    backfill.resolve({
      ok: true,
      value: {
        memory: fixture.memory,
        segment: fixture.segment,
        supplement: fixture.supplement,
        saved: true,
      },
    });
    expect(await screen.findByText('已生成转录')).toBeInTheDocument();
  });

  it('confirms before regenerating an existing supplement transcript', async () => {
    const user = userEvent.setup();
    mockVoiceTranscriptionSettings(true);
    const fixture = createSegmentSupplementFixture();
    const transcriptSupplement = {
      ...fixture.supplement,
      lastTranscriptionAttempt: 'success' as const,
      transcript: { exists: true },
    };
    const transcriptSegment = {
      ...fixture.segment,
      supplements: [transcriptSupplement],
    };
    mockSegmentSupplementWorkspace({
      ...fixture,
      segment: transcriptSegment,
      supplement: transcriptSupplement,
    });
    const backfill =
      createDeferred<
        Awaited<ReturnType<Window['reoWorkspace']['requestSegmentSupplementTranscriptionBackfill']>>
      >();
    reoWorkspace.requestSegmentSupplementTranscriptionBackfill.mockReturnValueOnce(
      backfill.promise
    );

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await createWorkspaceWithSegmentSupplement(user);
    await user.click(screen.getByRole('tab', { name: transcriptSupplement.title }));
    expect(await screen.findByText('补充录音转写正文')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: `${transcriptSupplement.title} 更多操作` })
    );
    await user.click(screen.getByRole('menuitem', { name: '重新生成转录' }));
    expect(screen.getByRole('alertdialog', { name: '重新生成转录？' })).toBeInTheDocument();
    expect(reoWorkspace.requestSegmentSupplementTranscriptionBackfill).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '重新生成' }));

    await waitFor(() =>
      expect(reoWorkspace.requestSegmentSupplementTranscriptionBackfill).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: fixture.memory.memoryId,
        segmentId: fixture.segment.segmentId,
        supplementId: transcriptSupplement.supplementId,
        mode: 'regenerate',
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog', { name: '重新生成转录？' })).not.toBeInTheDocument()
    );
    expect(await screen.findByText('正在生成补充录音转录。')).toBeInTheDocument();
    expect(screen.getByText('补充录音转写正文')).toBeInTheDocument();
    backfill.resolve({
      ok: true,
      value: {
        memory: fixture.memory,
        segment: transcriptSegment,
        supplement: transcriptSupplement,
        saved: true,
      },
    });
    expect(await screen.findByText('已生成转录')).toBeInTheDocument();
  });

  it('confirms before regenerating an existing segment transcript', async () => {
    const user = userEvent.setup();
    mockVoiceTranscriptionSettings(true);
    const { memory, segment } = mockWorkspaceWithSingleSegment({
      memoryId: 'mem_regenerate_segment_transcript',
      segmentId: 'seg_regenerate_transcript',
      segmentTitle: 'Existing transcript segment',
      transcriptExists: true,
    });
    const backfill =
      createDeferred<
        Awaited<ReturnType<Window['reoWorkspace']['requestSegmentTranscriptionBackfill']>>
      >();
    reoWorkspace.requestSegmentTranscriptionBackfill.mockReturnValueOnce(backfill.promise);

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await createWorkspaceWithSingleSegment(user);
    expect(await screen.findByText('已有转录正文')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: `片段 ${segment.title} 更多操作` }));
    await user.click(screen.getByRole('menuitem', { name: '重新生成转录' }));
    expect(screen.getByRole('alertdialog', { name: '重新生成转录？' })).toBeInTheDocument();
    expect(reoWorkspace.requestSegmentTranscriptionBackfill).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '重新生成' }));

    await waitFor(() =>
      expect(reoWorkspace.requestSegmentTranscriptionBackfill).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: memory.memoryId,
        segmentId: segment.segmentId,
        mode: 'regenerate',
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog', { name: '重新生成转录？' })).not.toBeInTheDocument()
    );
    expect(await screen.findByText('正在生成转录。')).toBeInTheDocument();
    expect(screen.getByText('已有转录正文')).toBeInTheDocument();
    backfill.resolve({
      ok: true,
      value: { memory: { ...memory, hasTranscript: true }, saved: true },
    });
    expect(await screen.findByText('已生成转录')).toBeInTheDocument();
  });

  it.each([
    [
      'voice recognition is disabled',
      {
        enabled: false,
        apiKeyConfigured: true,
        apiKeyLastFour: '1234',
        lastValidatedAt: '2026-05-16T18:00:00.000Z',
        lastValidationOk: true,
        lastValidationCode: 'ok',
      },
      '先在设置里启用语音识别。',
    ],
    [
      'the X-Api-Key is missing',
      {
        enabled: true,
        apiKeyConfigured: false,
        apiKeyLastFour: null,
        lastValidatedAt: null,
        lastValidationOk: null,
        lastValidationCode: null,
      },
      '先在设置里填写 X-Api-Key。',
    ],
    [
      'the last credential validation failed with auth',
      {
        enabled: true,
        apiKeyConfigured: true,
        apiKeyLastFour: '1234',
        lastValidatedAt: '2026-05-16T18:00:00.000Z',
        lastValidationOk: false,
        lastValidationCode: 'auth',
      },
      'X-Api-Key 验证失败，请在设置中更新。',
    ],
  ] as const)(
    'disables manual transcription backfill when %s',
    async (_caseName, settings, disabledReason) => {
      const user = userEvent.setup();
      const { segment } = mockWorkspaceWithSingleSegment();
      reoWorkspace.readVoiceTranscriptionSettings.mockResolvedValue({
        ok: true,
        value: { settings },
      });

      render(
        <ReoQueryProvider>
          <App />
        </ReoQueryProvider>
      );

      await createWorkspaceWithSingleSegment(user);

      await user.click(screen.getByRole('button', { name: `片段 ${segment.title} 更多操作` }));
      const item = screen.getByRole('menuitem', { name: '生成转录' });

      expect(item).toHaveAttribute('aria-disabled', 'true');
      await user.hover(item);
      expect(await screen.findByRole('tooltip')).toHaveTextContent(disabledReason);
      await user.click(item);
      expect(reoWorkspace.requestSegmentTranscriptionBackfill).not.toHaveBeenCalled();
    }
  );

  it('keeps manual transcription backfill clickable after a network validation failure', async () => {
    const user = userEvent.setup();
    const { memory, segment } = mockWorkspaceWithSingleSegment();
    reoWorkspace.readVoiceTranscriptionSettings.mockResolvedValue({
      ok: true,
      value: {
        settings: {
          enabled: true,
          apiKeyConfigured: true,
          apiKeyLastFour: '1234',
          lastValidatedAt: '2026-05-16T18:00:00.000Z',
          lastValidationOk: false,
          lastValidationCode: 'network',
        },
      },
    });
    reoWorkspace.requestSegmentTranscriptionBackfill.mockResolvedValue({
      ok: true,
      value: { memory, saved: true },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await createWorkspaceWithSingleSegment(user);

    await user.click(screen.getByRole('button', { name: `片段 ${segment.title} 更多操作` }));
    await user.click(screen.getByRole('menuitem', { name: '生成转录' }));

    await waitFor(() =>
      expect(reoWorkspace.requestSegmentTranscriptionBackfill).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: memory.memoryId,
        segmentId: segment.segmentId,
        mode: 'fill-missing',
      })
    );
  });

  it('blocks manual transcription backfill while the recording overlay is open', async () => {
    const user = userEvent.setup();
    installRecordingBrowserMocks();
    mockVoiceTranscriptionSettings(true);
    const { segment } = mockWorkspaceWithSingleSegment({
      segmentTitle: 'Recording blocks transcription',
    });
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, segmentId: 'seg_new_recording' },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await createWorkspaceWithSingleSegment(user);
    const segmentMenuButton = await screen.findByRole('button', {
      name: `片段 ${segment.title} 更多操作`,
    });

    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));
    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();

    fireEvent.click(segmentMenuButton);

    expect(
      screen.queryByRole('menuitem', { hidden: true, name: '生成转录' })
    ).not.toBeInTheDocument();
    expect(reoWorkspace.requestSegmentTranscriptionBackfill).not.toHaveBeenCalled();
  }, 20_000);

  it('defaults the theme preference to "system" and resolves the effective theme from prefers-color-scheme', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }))
    );

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    const shell = await screen.findByRole('main', { name: '记忆空间内容' });
    const themedRoot = shell.closest('[data-theme]');
    expect(themedRoot).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: '切换到浅色模式' })).toBeInTheDocument();
    expect(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBeNull();
  });

  it('persists the chosen theme preference across remounts and cycles through all three states', async () => {
    const user = userEvent.setup();

    const { unmount } = render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(screen.getByRole('button', { name: '切换到浅色模式' }));
    expect(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('light');

    await user.click(screen.getByRole('button', { name: '切换到深色模式' }));
    expect(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('dark');

    await user.click(screen.getByRole('button', { name: '切换到跟随系统' }));
    expect(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('system');

    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'dark');
    unmount();

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    const shell = await screen.findByRole('main', { name: '记忆空间内容' });
    expect(shell.closest('[data-theme]')).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('uses the titlebar Memory control to collapse and expand the workspace Memory list', async () => {
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
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('heading', { name: '今天想记录些什么？' });

    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    const expandButton = within(titlebar).getByRole('button', { name: '展开记忆列表' });
    const sidebarToggleControls = within(titlebar).getByRole('group', { name: '窗口控制' });
    const titlebarContent = titlebar.querySelector(
      '[data-slot="app-shell-panel-titlebar-content"]'
    );
    const railShell = document.querySelector('[data-slot="workspace-memory-rail-shell"]');
    const stageShell = document.querySelector('[data-slot="workspace-stage-shell"]');
    const frameBody = document.querySelector('[data-slot="workspace-frame-body"]');
    expect(titlebarContent).toHaveStyle({ left: '240px' });
    expect(titlebarContent).toHaveStyle({
      top: '-6px',
    });
    expect(expandButton).toHaveAttribute('aria-controls', 'workspace-memory-rail');
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: '记忆列表' })).not.toBeInTheDocument();
    expect(railShell).toHaveAttribute('data-rail-mode', 'inline');
    expect(railShell).toHaveAttribute('aria-hidden', 'true');
    expect(frameBody).toHaveClass('grid-cols-[minmax(0,1fr)_0px]');
    expect(frameBody).toHaveClass(
      'transition-[grid-template-columns]',
      'duration-200',
      'ease-out',
      'motion-reduce:transition-none'
    );
    expect(stageShell).toHaveClass('px-24', 'sm:px-40');

    await user.click(expandButton);

    expect(screen.getByRole('navigation', { name: '记忆列表' })).toBeInTheDocument();
    expect(railShell).toHaveAttribute('aria-hidden', 'false');
    expect(frameBody).toHaveClass('grid-cols-[minmax(0,1fr)_var(--workspace-memory-rail-width)]');
    expect(railShell).toHaveClass('border-l', 'border-secondary');
    expect(railShell).not.toHaveClass('border-border', 'shadow-float');
    expect(stageShell).toHaveClass('px-24', 'sm:px-40');

    await user.click(within(titlebar).getByRole('button', { name: '隐藏侧边栏' }));
    expect(sidebarToggleControls).toHaveStyle({
      left: '80px',
    });
    expect(titlebarContent).toHaveStyle({
      left: '88px',
    });

    const collapseButton = within(titlebar).getByRole('button', { name: '折叠记忆列表' });
    await user.click(collapseButton);

    expect(screen.queryByRole('navigation', { name: '记忆列表' })).not.toBeInTheDocument();
    const expandButtonAfterCollapse = within(titlebar).getByRole('button', {
      name: '展开记忆列表',
    });
    expect(expandButtonAfterCollapse).toHaveAttribute('aria-controls', 'workspace-memory-rail');
    expect(expandButtonAfterCollapse).toHaveAttribute('aria-expanded', 'false');

    await user.click(expandButtonAfterCollapse);

    expect(screen.getByRole('navigation', { name: '记忆列表' })).toBeInTheDocument();
  });

  it('defaults the Memory rail to an overlay-closed state on compact workspace widths', async () => {
    const media = stubWorkspaceRailInlineMedia(false);
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
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('heading', { name: '今天想记录些什么？' });

    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    const stageShell = document.querySelector('[data-slot="workspace-stage-shell"]');
    const railShell = document.querySelector('[data-slot="workspace-memory-rail-shell"]');
    const frameBody = document.querySelector('[data-slot="workspace-frame-body"]');
    expect(within(titlebar).getByRole('button', { name: '展开记忆列表' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(railShell).toHaveAttribute('data-rail-mode', 'overlay');
    expect(railShell).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('navigation', { name: '记忆列表' })).not.toBeInTheDocument();
    expect(frameBody).toHaveClass('grid-cols-[minmax(0,1fr)_0px]');
    expect(stageShell).toHaveClass('px-24', 'sm:px-40');

    await user.click(within(titlebar).getByRole('button', { name: '展开记忆列表' }));

    expect(screen.getByRole('navigation', { name: '记忆列表' })).toBeInTheDocument();
    expect(railShell).toHaveAttribute('data-rail-mode', 'overlay');
    expect(railShell).toHaveAttribute('aria-hidden', 'false');
    expect(frameBody).toHaveClass('grid-cols-[minmax(0,1fr)_0px]');
    expect(stageShell).toHaveClass('px-24', 'sm:px-40');

    act(() => {
      media.setMatches(true);
    });

    expect(within(titlebar).getByRole('button', { name: '折叠记忆列表' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('navigation', { name: '记忆列表' })).toBeInTheDocument();
    expect(railShell).toHaveAttribute('data-rail-mode', 'inline');
    expect(railShell).toHaveAttribute('aria-hidden', 'false');
    expect(frameBody).toHaveClass('grid-cols-[minmax(0,1fr)_var(--workspace-memory-rail-width)]');
    expect(stageShell).toHaveClass('px-24', 'sm:px-40');
  });

  it('renames a Memory container from the right rail menu', async () => {
    const user = userEvent.setup();
    const originalMemory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      segmentCount: 2,
      durationMs: 125_000,
      audioByteLength: 2048,
      hasTranscript: true,
      supplementCount: 0,
    };
    const renamedMemory = {
      ...originalMemory,
      title: '产品灵感与思考',
      updatedAt: '2026-05-08T14:42:00.000Z',
    };
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
          memories: [originalMemory],
        },
      },
    });
    const rename =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['updateMemoryTitle']>>>();
    reoWorkspace.updateMemoryTitle.mockReturnValue(rename.promise);

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await expandMemoryRail(user);
    await screen.findByRole('button', { name: '选择记忆 My seventh birthday' });

    await user.click(screen.getByRole('button', { name: 'My seventh birthday 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '重命名' }));

    const dialog = screen.getByRole('dialog', { name: '重命名记忆' });
    const titleInput = within(dialog).getByLabelText('记忆名称');
    expect(titleInput).toHaveValue('My seventh birthday');
    await user.clear(titleInput);
    await user.type(titleInput, '产品灵感与思考');
    await user.click(within(dialog).getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(reoWorkspace.updateMemoryTitle).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        memoryId: 'mem_birthday',
        title: '产品灵感与思考',
      })
    );
    expect(screen.getByRole('button', { name: '选择记忆 产品灵感与思考' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '重命名记忆' })).not.toBeInTheDocument();

    await act(async () => {
      rename.resolve({ ok: true, value: renamedMemory });
      await rename.promise;
    });
  });

  it('renames a Segment card optimistically without waiting for file persistence', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      segmentCount: 1,
      durationMs: 5000,
      audioByteLength: 2048,
      hasTranscript: true,
      supplementCount: 0,
    };
    const segment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      type: 'audio' as const,
      title: '录音1',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      durationMs: 5000,
      audioByteLength: 2048,
      lastTranscriptionAttempt: 'never' as const,
      transcript: { exists: false },
      supplementCount: 0,
      supplements: [],
    };
    const rename =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['updateSegmentTitle']>>>();
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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [segment],
        },
      },
    }));
    reoWorkspace.readFinalizedAudioSegment.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: 'ws_1',
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        transcript: { exists: false, text: '' },
      },
    }));
    reoWorkspace.updateSegmentTitle.mockReturnValue(rename.promise);

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('button', { name: '选择片段 录音1' });

    const openSegmentMenu = async () => {
      const trigger = screen.getByRole('button', { name: '片段 录音1 更多操作' });
      expect(trigger).toBeInTheDocument();
      expect(trigger.querySelector('svg')).toBeInTheDocument();
      await user.click(trigger);
      return screen.findByRole('menu');
    };
    const waitForSegmentMenuToClose = async () => {
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    };
    const segmentActionPayload = {
      workspaceHandle: 'workspace-handle-1',
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
    };

    let segmentMenu = await openSegmentMenu();
    expect(
      within(segmentMenu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual([
      '用默认应用打开',
      '在访达中显示',
      '复制相对路径',
      '复制绝对路径',
      '生成转录',
      '重命名',
      '删除',
    ]);

    await user.click(within(segmentMenu).getByRole('menuitem', { name: '用默认应用打开' }));
    expect(reoWorkspace.openSegmentDocument).toHaveBeenCalledWith(segmentActionPayload);
    await waitForSegmentMenuToClose();

    segmentMenu = await openSegmentMenu();
    await user.click(within(segmentMenu).getByRole('menuitem', { name: '在访达中显示' }));
    expect(reoWorkspace.revealSegmentInFinder).toHaveBeenCalledWith(segmentActionPayload);
    await waitForSegmentMenuToClose();

    segmentMenu = await openSegmentMenu();
    await user.click(within(segmentMenu).getByRole('menuitem', { name: '复制相对路径' }));
    expect(reoWorkspace.copySegmentRelativePath).toHaveBeenCalledWith(segmentActionPayload);
    await waitForSegmentMenuToClose();

    segmentMenu = await openSegmentMenu();
    await user.click(within(segmentMenu).getByRole('menuitem', { name: '复制绝对路径' }));
    expect(reoWorkspace.copySegmentAbsolutePath).toHaveBeenCalledWith(segmentActionPayload);
    await waitForSegmentMenuToClose();

    segmentMenu = await openSegmentMenu();
    await user.click(within(segmentMenu).getByRole('menuitem', { name: '删除' }));
    const deleteDialog = screen.getByRole('alertdialog', { name: '删除片段' });
    expect(deleteDialog).toHaveTextContent('录音1');
    await user.click(within(deleteDialog).getByRole('button', { name: '取消' }));

    segmentMenu = await openSegmentMenu();
    await user.click(within(segmentMenu).getByRole('menuitem', { name: '重命名' }));

    const dialog = screen.getByRole('dialog', { name: '重命名片段' });
    const titleInput = within(dialog).getByLabelText('片段名称');
    await user.clear(titleInput);
    await user.type(titleInput, '晨间记录');
    await user.click(within(dialog).getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(reoWorkspace.updateSegmentTitle).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: 'mem_birthday',
        segmentId: 'seg_birthday_voice',
        title: '晨间记录',
      })
    );
    expect(screen.getByRole('button', { name: '选择片段 晨间记录' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '重命名片段' })).not.toBeInTheDocument();

    await act(async () => {
      rename.resolve({
        ok: true,
        value: {
          memory,
          segment: {
            ...segment,
            title: '晨间记录',
          },
        },
      });
      await rename.promise;
    });
  }, 10_000);

  it('renames a SegmentSupplement tab optimistically from the hover More menu', async () => {
    const user = userEvent.setup();
    const fixture = createSegmentSupplementFixture();
    const { supplement, memory, segment } = fixture;
    const rename =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['updateSegmentSupplementTitle']>>>();
    mockSegmentSupplementWorkspace(fixture);
    reoWorkspace.updateSegmentSupplementTitle.mockReturnValue(rename.promise);

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await createWorkspaceWithSegmentSupplement(user);
    await submitSegmentSupplementRename(user, '补充录音1', '现场补充');

    await waitFor(() =>
      expect(reoWorkspace.updateSegmentSupplementTitle).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: 'mem_birthday',
        segmentId: 'seg_birthday_voice',
        supplementId: 'sup_birthday_followup',
        title: '现场补充',
      })
    );
    expect(screen.getByRole('tab', { name: '现场补充' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '重命名补充内容' })).not.toBeInTheDocument();

    await act(async () => {
      rename.resolve({
        ok: true,
        value: {
          memory,
          segment: {
            ...segment,
            supplements: [{ ...supplement, title: '现场补充' }],
          },
          supplement: {
            ...supplement,
            title: '现场补充',
          },
        },
      });
      await rename.promise;
    });
  }, 10_000);

  it('ignores an in-flight SegmentSupplement rename failure after reopening the same workspace with a new handle', async () => {
    const user = userEvent.setup();
    const fixture = createSegmentSupplementFixture();
    const { memory, segment } = fixture;
    const rename =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['updateSegmentSupplementTitle']>>>();
    const reopenedSupplement = { ...fixture.supplement, title: '现场补充' };
    const reopenedSegment = { ...segment, supplements: [reopenedSupplement] };
    mockSegmentSupplementWorkspace(fixture);
    reoWorkspace.updateSegmentSupplementTitle.mockReturnValue(rename.promise);

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await createWorkspaceWithSegmentSupplement(user);
    await submitSegmentSupplementRename(user, '补充录音1', '现场补充');
    await screen.findByRole('tab', { name: '现场补充' });

    fireEvent.click(screen.getByRole('button', { hidden: true, name: '首页' }));
    await waitFor(() =>
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      })
    );

    reoWorkspace.initializeWorkspace.mockResolvedValueOnce({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-2',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [memory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [reopenedSegment],
        },
      },
    }));

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('tab', { name: '现场补充' });
    expect(screen.queryByRole('tab', { name: '补充录音1' })).not.toBeInTheDocument();

    await act(async () => {
      rename.resolve({
        ok: false,
        error: { code: 'ERR_RECORDING_NOT_FOUND', message: 'Supplement not found' },
      });
      await rename.promise;
    });

    expect(screen.getByRole('tab', { name: '现场补充' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '补充录音1' })).not.toBeInTheDocument();
  }, 10_000);

  it('rolls back a SegmentSupplement rename when saving fails and the submitted title is still current', async () => {
    const user = userEvent.setup();
    const fixture = createSegmentSupplementFixture();
    const rename =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['updateSegmentSupplementTitle']>>>();
    mockSegmentSupplementWorkspace(fixture);
    reoWorkspace.updateSegmentSupplementTitle.mockReturnValue(rename.promise);

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await createWorkspaceWithSegmentSupplement(user);
    await submitSegmentSupplementRename(user, '补充录音1', '现场补充');
    await screen.findByRole('tab', { name: '现场补充' });

    await act(async () => {
      rename.resolve({
        ok: false,
        error: { code: 'ERR_RECORDING_NOT_FOUND', message: 'Supplement not found' },
      });
      await rename.promise;
    });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '补充录音1' })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: '现场补充' })).not.toBeInTheDocument();
    });
  }, 10_000);

  it('keeps the optimistic SegmentSupplement rename when saving reports stale projections', async () => {
    const user = userEvent.setup();
    const fixture = createSegmentSupplementFixture();
    const rename =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['updateSegmentSupplementTitle']>>>();
    mockSegmentSupplementWorkspace(fixture);
    reoWorkspace.updateSegmentSupplementTitle.mockReturnValue(rename.promise);

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await createWorkspaceWithSegmentSupplement(user);
    await submitSegmentSupplementRename(user, '补充录音1', '现场补充');
    await screen.findByRole('tab', { name: '现场补充' });

    await act(async () => {
      rename.resolve({
        ok: false,
        error: {
          code: 'ERR_MEMORY_UPDATE_FAILED',
          dataRetention: 'file-written-index-stale',
          message: 'Memory index is stale',
        },
      });
      await rename.promise;
    });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '现场补充' })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: '补充录音1' })).not.toBeInTheDocument();
    });
  }, 10_000);

  it('renders the supplement transcript text under the player when transcript exists', async () => {
    const user = userEvent.setup();
    const fixture = createSegmentSupplementFixture();
    mockSegmentSupplementWorkspace(fixture);

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await createWorkspaceWithSegmentSupplement(user);
    await user.click(screen.getByRole('tab', { name: '补充录音1' }));

    expect(await screen.findByText('补充录音转写正文')).toBeInTheDocument();
  }, 10_000);

  it('renders the supplement empty transcript copy when the supplement has no transcript', async () => {
    const user = userEvent.setup();
    const fixture = createSegmentSupplementFixture();
    mockSegmentSupplementWorkspace(fixture);
    reoWorkspace.readFinalizedAudioSegmentSupplement.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: 'ws_1',
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        supplementId: payload.supplementId,
        audio: new Uint8Array([4, 5]),
        audioByteLength: 2,
        transcript: { exists: false, text: '' },
      },
    }));

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await createWorkspaceWithSegmentSupplement(user);
    await user.click(screen.getByRole('tab', { name: '补充录音1' }));

    expect(await screen.findByText('这段补充录音还没有转录。')).toBeInTheDocument();
  }, 10_000);

  it('deletes a SegmentSupplement through confirmation and restores it from the toast action', async () => {
    const user = userEvent.setup();
    const fixture = createSegmentSupplementFixture();
    const { supplement, memory, segment } = fixture;
    const memoryAfterDelete = { ...memory, supplementCount: 0 };
    const segmentAfterDelete = { ...segment, supplementCount: 0, supplements: [] };
    const supplementContentKey = segmentSupplementContentQueryKey({
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: segment.segmentId,
      supplementId: supplement.supplementId,
    });
    mockSegmentSupplementWorkspace(fixture);
    reoWorkspace.readFinalizedAudioSegmentSupplement.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: 'ws_1',
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        supplementId: payload.supplementId,
        audio: new Uint8Array([1, 2]),
        audioByteLength: 2,
        transcript: { exists: false, text: '' },
      },
    }));
    reoWorkspace.deleteSegmentSupplement.mockResolvedValue({
      ok: true,
      value: {
        memory: memoryAfterDelete,
        segment: segmentAfterDelete,
        supplementId: supplement.supplementId,
        restoreToken: supplement.supplementId,
      },
    });
    reoWorkspace.restoreDeletedSegmentSupplement.mockResolvedValue({
      ok: true,
      value: {
        memory,
        segment,
        supplement,
      },
    });
    const queryClient = createReoQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    await createWorkspaceWithSegmentSupplement(user);
    queryClient.setQueryData(supplementContentKey, {
      requestId: 'cached_supplement_content',
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: segment.segmentId,
      supplementId: supplement.supplementId,
      audio: new Uint8Array([1, 2]),
      audioByteLength: 2,
      transcript: { exists: false, text: '' },
    });
    await openSegmentSupplementDeleteDialog(user, supplement.title);

    const dialog = screen.getByRole('alertdialog', { name: '删除补充内容' });
    expect(dialog).toHaveTextContent(`删除“${supplement.title}”？`);
    await user.click(within(dialog).getByRole('button', { name: '删除' }));

    await waitFor(() =>
      expect(reoWorkspace.deleteSegmentSupplement).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: memory.memoryId,
        segmentId: segment.segmentId,
        supplementId: supplement.supplementId,
      })
    );
    expect(screen.queryByRole('tab', { name: supplement.title })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '转录' })).toHaveAttribute('aria-selected', 'true');
    expect(queryClient.getQueryData(supplementContentKey)).toBeUndefined();
    expect(
      queryClient.getQueryData<{
        readonly detail: typeof memory & { readonly segments: readonly [typeof segment] };
      }>(memoryDetailQueryKey({ workspaceId: 'ws_1', memoryId: memory.memoryId }))?.detail
        .segments[0].supplements
    ).toEqual([]);
    const deletedToastTitle = await screen.findByText('已删除补充内容');
    expect(deletedToastTitle.closest('[data-sonner-toast]')).toHaveClass('reo-undo-toast');
    expect(screen.getByText(supplement.title)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '恢复' }));

    await waitFor(() =>
      expect(reoWorkspace.restoreDeletedSegmentSupplement).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: memory.memoryId,
        segmentId: segment.segmentId,
        restoreToken: supplement.supplementId,
      })
    );
    expect(await screen.findByRole('tab', { name: supplement.title })).toBeInTheDocument();
    expect(
      queryClient.getQueryData<{
        readonly detail: typeof memory & { readonly segments: readonly [typeof segment] };
      }>(memoryDetailQueryKey({ workspaceId: 'ws_1', memoryId: memory.memoryId }))?.detail
        .segments[0].supplements
    ).toEqual([supplement]);
  }, 20_000);

  it('clears a pending SegmentSupplement delete target when leaving the workspace session', async () => {
    const user = userEvent.setup();
    const fixture = createSegmentSupplementFixture();
    mockSegmentSupplementWorkspace(fixture);

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await createWorkspaceWithSegmentSupplement(user);
    await openSegmentSupplementDeleteDialog(user, fixture.supplement.title);

    fireEvent.click(screen.getByRole('button', { hidden: true, name: '首页' }));

    await waitFor(() =>
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      })
    );
    await createWorkspaceWithSegmentSupplement(user);
    expect(screen.queryByRole('alertdialog', { name: '删除补充内容' })).not.toBeInTheDocument();
  }, 10_000);

  it('keeps a SegmentSupplement hidden with restore action when delete reports stale projection after moving files', async () => {
    const user = userEvent.setup();
    const fixture = createSegmentSupplementFixture();
    const { supplement, memory, segment } = fixture;
    const supplementContentKey = segmentSupplementContentQueryKey({
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: segment.segmentId,
      supplementId: supplement.supplementId,
    });
    mockSegmentSupplementWorkspace(fixture);
    reoWorkspace.deleteSegmentSupplement.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_LOCK_LOST',
        dataRetention: 'file-written-index-stale',
        message: 'Workspace lock was lost',
      },
    });
    reoWorkspace.restoreDeletedSegmentSupplement.mockResolvedValue({
      ok: true,
      value: {
        memory,
        segment,
        supplement,
      },
    });
    const queryClient = createReoQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    await createWorkspaceWithSegmentSupplement(user);
    queryClient.setQueryData(supplementContentKey, {
      requestId: 'cached_supplement_content',
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: segment.segmentId,
      supplementId: supplement.supplementId,
      audio: new Uint8Array([1, 2]),
      audioByteLength: 2,
      transcript: { exists: false, text: '' },
    });
    await openSegmentSupplementDeleteDialog(user, supplement.title);

    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除补充内容' })).getByRole('button', {
        name: '删除',
      })
    );

    await waitFor(() => expect(reoWorkspace.deleteSegmentSupplement).toHaveBeenCalled());
    expect(screen.queryByRole('tab', { name: supplement.title })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '转录' })).toHaveAttribute('aria-selected', 'true');
    expect(queryClient.getQueryData(supplementContentKey)).toBeUndefined();
    expect((await screen.findAllByText('无法删除补充内容。')).length).toBeGreaterThan(0);
    expect(await screen.findByText('已删除补充内容')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '恢复' }));

    await waitFor(() =>
      expect(reoWorkspace.restoreDeletedSegmentSupplement).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: memory.memoryId,
        segmentId: segment.segmentId,
        restoreToken: supplement.supplementId,
      })
    );
    expect(await screen.findByRole('tab', { name: supplement.title })).toBeInTheDocument();
  }, 20_000);

  it('restores a SegmentSupplement projection when restore reports stale projection after moving files', async () => {
    const user = userEvent.setup();
    const fixture = createSegmentSupplementFixture();
    const { supplement, memory, segment } = fixture;
    const memoryAfterDelete = { ...memory, supplementCount: 0 };
    const segmentAfterDelete = { ...segment, supplementCount: 0, supplements: [] };
    mockSegmentSupplementWorkspace(fixture);
    reoWorkspace.deleteSegmentSupplement.mockResolvedValue({
      ok: true,
      value: {
        memory: memoryAfterDelete,
        segment: segmentAfterDelete,
        supplementId: supplement.supplementId,
        restoreToken: supplement.supplementId,
      },
    });
    reoWorkspace.restoreDeletedSegmentSupplement.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_LOCK_LOST',
        dataRetention: 'file-written-index-stale',
        message: 'Workspace lock was lost',
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await createWorkspaceWithSegmentSupplement(user);
    await openSegmentSupplementDeleteDialog(user, supplement.title);
    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除补充内容' })).getByRole('button', {
        name: '删除',
      })
    );
    await screen.findByText('已删除补充内容');
    expect(screen.queryByRole('tab', { name: supplement.title })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '恢复' }));

    await waitFor(() => expect(reoWorkspace.restoreDeletedSegmentSupplement).toHaveBeenCalled());
    expect(await screen.findByRole('tab', { name: supplement.title })).toBeInTheDocument();
    expect((await screen.findAllByText('无法恢复补充内容。')).length).toBeGreaterThan(0);
  }, 20_000);

  it('uses titlebar breadcrumb dropdowns to run memory-space actions and active Memory actions', async () => {
    const user = userEvent.setup();
    const originalMemory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      segmentCount: 2,
      durationMs: 125_000,
      audioByteLength: 2048,
      hasTranscript: true,
      supplementCount: 0,
    };
    const renamedMemory = {
      ...originalMemory,
      title: '灵感',
      updatedAt: '2026-05-08T14:42:00.000Z',
    };
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
          memories: [originalMemory],
        },
      },
    });
    reoWorkspace.updateMemorySpaceTitle.mockResolvedValue({
      ok: true,
      value: {
        workspaceId: 'ws_1',
        title: '测试工作区1',
        description: 'Private notes',
        memories: [originalMemory],
      },
    });
    reoWorkspace.updateMemoryTitle.mockResolvedValue({
      ok: true,
      value: renamedMemory,
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    expect(within(titlebar).getByRole('navigation', { name: '当前位置' })).toBeInTheDocument();
    expect(within(titlebar).getByRole('button', { name: 'Daily memory 记忆空间操作' })).toHaveClass(
      'rounded-sm'
    );
    expect(
      within(titlebar).getByRole('button', { name: 'My seventh birthday 记忆操作' })
    ).toHaveClass('rounded-sm');
    expect(titlebar.querySelector('[data-slot="breadcrumb-list"]')).toHaveClass('gap-4');
    expect(titlebar.querySelector('[data-slot="workspace-titlebar"]')).toHaveClass(
      'pl-28',
      'pr-12'
    );
    expect(titlebar.querySelector('[data-slot="breadcrumb"]')?.querySelector('svg')).toBeNull();
    const breadcrumbSeparator = titlebar.querySelector('[data-slot="breadcrumb-separator"]');
    expect(breadcrumbSeparator?.querySelector('svg')).toBeNull();
    expect(breadcrumbSeparator?.querySelector('.size-4.rounded-full')).toBeInTheDocument();
    expect(breadcrumbSeparator).not.toHaveClass('px-2');
    expect(screen.queryByRole('heading', { name: 'My seventh birthday' })).not.toBeInTheDocument();
    expect(screen.queryByText('2 个片段 · 02:05')).not.toBeInTheDocument();

    const openMemorySpaceBreadcrumbMenu = async (name: string) => {
      await user.click(within(titlebar).getByRole('button', { name }));
      return screen.findByRole('menu', { name });
    };
    const openMemoryBreadcrumbMenu = async (name: string) => {
      await user.click(within(titlebar).getByRole('button', { name }));
      return screen.findByRole('menu', { name });
    };

    let memorySpaceMenu = await openMemorySpaceBreadcrumbMenu('Daily memory 记忆空间操作');
    const memorySpaceMenuItems = within(memorySpaceMenu).getAllByRole('menuitem');
    expect(memorySpaceMenuItems.map((item) => item.textContent)).toEqual([
      '用默认应用打开',
      '在访达中显示',
      '复制绝对路径',
      '重命名',
      '移除',
    ]);
    expect(memorySpaceMenuItems.at(-1)).toHaveTextContent('移除');
    expect(
      within(memorySpaceMenu).queryByRole('menuitem', { name: '重命名记忆空间' })
    ).not.toBeInTheDocument();

    await user.click(within(memorySpaceMenu).getByRole('menuitem', { name: '用默认应用打开' }));
    expect(reoWorkspace.openMemorySpaceAgentsFile).toHaveBeenCalledWith({ workspaceId: 'ws_1' });

    memorySpaceMenu = await openMemorySpaceBreadcrumbMenu('Daily memory 记忆空间操作');
    await user.click(within(memorySpaceMenu).getByRole('menuitem', { name: '在访达中显示' }));
    expect(reoWorkspace.revealMemorySpaceInFinder).toHaveBeenCalledWith({ workspaceId: 'ws_1' });

    memorySpaceMenu = await openMemorySpaceBreadcrumbMenu('Daily memory 记忆空间操作');
    await user.click(within(memorySpaceMenu).getByRole('menuitem', { name: '复制绝对路径' }));
    expect(reoWorkspace.copyMemorySpaceAbsolutePath).toHaveBeenCalledWith({ workspaceId: 'ws_1' });

    memorySpaceMenu = await openMemorySpaceBreadcrumbMenu('Daily memory 记忆空间操作');
    await user.click(within(memorySpaceMenu).getByRole('menuitem', { name: '移除' }));
    const removeDialog = screen.getByRole('alertdialog', { name: '移除记忆空间' });
    expect(removeDialog).toHaveTextContent(
      '从 Reo 的记忆空间列表中移除“Daily memory”？本地文件夹不会被删除。'
    );
    await user.click(within(removeDialog).getByRole('button', { name: '取消' }));

    memorySpaceMenu = await openMemorySpaceBreadcrumbMenu('Daily memory 记忆空间操作');
    await user.click(within(memorySpaceMenu).getByRole('menuitem', { name: '重命名' }));

    const workspaceDialog = screen.getByRole('dialog', { name: '重命名记忆空间' });
    const workspaceTitleInput = within(workspaceDialog).getByLabelText('记忆空间名称');
    expect(workspaceTitleInput).toHaveValue('Daily memory');
    await user.clear(workspaceTitleInput);
    await user.type(workspaceTitleInput, '测试工作区1');
    await user.click(within(workspaceDialog).getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(reoWorkspace.updateMemorySpaceTitle).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        title: '测试工作区1',
      })
    );
    expect(
      within(titlebar).getByRole('button', { name: '测试工作区1 记忆空间操作' })
    ).toBeInTheDocument();

    let memoryMenu = await openMemoryBreadcrumbMenu('My seventh birthday 记忆操作');
    const memoryMenuItems = within(memoryMenu).getAllByRole('menuitem');
    expect(memoryMenuItems.map((item) => item.textContent)).toEqual([
      '用默认应用打开',
      '在访达中显示',
      '复制相对路径',
      '复制绝对路径',
      '重命名',
      '删除',
    ]);
    expect(
      within(memoryMenu).queryByRole('menuitem', { name: '重命名记忆' })
    ).not.toBeInTheDocument();

    const memoryActionPayload = {
      workspaceHandle: 'workspace-handle-1',
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
    };

    await user.click(within(memoryMenu).getByRole('menuitem', { name: '用默认应用打开' }));
    expect(reoWorkspace.openMemoryDocument).toHaveBeenCalledWith(memoryActionPayload);

    memoryMenu = await openMemoryBreadcrumbMenu('My seventh birthday 记忆操作');
    await user.click(within(memoryMenu).getByRole('menuitem', { name: '在访达中显示' }));
    expect(reoWorkspace.revealMemoryInFinder).toHaveBeenCalledWith(memoryActionPayload);

    memoryMenu = await openMemoryBreadcrumbMenu('My seventh birthday 记忆操作');
    await user.click(within(memoryMenu).getByRole('menuitem', { name: '复制相对路径' }));
    expect(reoWorkspace.copyMemoryRelativePath).toHaveBeenCalledWith(memoryActionPayload);

    memoryMenu = await openMemoryBreadcrumbMenu('My seventh birthday 记忆操作');
    await user.click(within(memoryMenu).getByRole('menuitem', { name: '复制绝对路径' }));
    expect(reoWorkspace.copyMemoryAbsolutePath).toHaveBeenCalledWith(memoryActionPayload);

    memoryMenu = await openMemoryBreadcrumbMenu('My seventh birthday 记忆操作');
    await user.click(within(memoryMenu).getByRole('menuitem', { name: '删除' }));
    const deleteDialog = screen.getByRole('alertdialog', { name: '删除记忆' });
    expect(deleteDialog).toHaveTextContent(
      '删除“My seventh birthday”？片段和补充录音会先进入恢复区。'
    );
    await user.click(within(deleteDialog).getByRole('button', { name: '取消' }));

    memoryMenu = await openMemoryBreadcrumbMenu('My seventh birthday 记忆操作');
    await user.click(within(memoryMenu).getByRole('menuitem', { name: '重命名' }));

    const memoryDialog = screen.getByRole('dialog', { name: '重命名记忆' });
    const memoryTitleInput = within(memoryDialog).getByLabelText('记忆名称');
    expect(memoryTitleInput).toHaveValue('My seventh birthday');
    await user.clear(memoryTitleInput);
    await user.type(memoryTitleInput, '灵感');
    await user.click(within(memoryDialog).getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(reoWorkspace.updateMemoryTitle).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        memoryId: 'mem_birthday',
        title: '灵感',
      })
    );
    expect(within(titlebar).getByRole('button', { name: '灵感 记忆操作' })).toBeInTheDocument();
  });

  it('keeps the optimistic memory space title when rename reports stale projections', async () => {
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
          title: '生活记录',
          description: 'Private notes',
          memories: [],
        },
      },
    });
    reoWorkspace.updateMemorySpaceTitle.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_LOCK_LOST',
        dataRetention: 'file-written-index-stale',
        message: 'Workspace lock was lost',
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), '生活记录');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    await user.click(within(titlebar).getByRole('button', { name: '生活记录 记忆空间操作' }));
    await user.click(screen.getByRole('menuitem', { name: '重命名' }));

    const dialog = screen.getByRole('dialog', { name: '重命名记忆空间' });
    const titleInput = within(dialog).getByLabelText('记忆空间名称');
    await user.clear(titleInput);
    await user.type(titleInput, '生活记');
    await user.click(within(dialog).getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(reoWorkspace.updateMemorySpaceTitle).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        title: '生活记',
      })
    );
    expect(
      within(titlebar).getByRole('button', { name: '生活记 记忆空间操作' })
    ).toBeInTheDocument();
    expect(
      within(titlebar).queryByRole('button', { name: '生活记录 记忆空间操作' })
    ).not.toBeInTheDocument();
  });

  it('refreshes the active workspace once after open and ignores focus-only events', async () => {
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
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('heading', { name: '今天想记录些什么？' });

    await waitFor(() => expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledTimes(1));
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledTimes(1);
  });

  it('skips child query invalidation when external file refresh returns the same snapshot', async () => {
    const user = userEvent.setup();
    const originalMemory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      segmentCount: 1,
      durationMs: 1000,
      audioByteLength: 3,
      hasTranscript: true,
      supplementCount: 0,
    };
    const snapshot = {
      workspaceId: 'ws_1',
      title: 'Daily memory',
      description: 'Private notes',
      memories: [originalMemory],
    };
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
        snapshot,
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          workspaceId: 'ws_1',
          ...originalMemory,
          segments: [],
        },
      },
    }));
    reoWorkspace.readWorkspaceSnapshot.mockResolvedValue({
      ok: true,
      value: snapshot,
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await waitFor(() => expect(reoWorkspace.readMemoryDetail).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledTimes(1));

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledTimes(2));
    expect(reoWorkspace.readMemoryDetail).toHaveBeenCalledTimes(1);
  });

  it('refreshes the active workspace from external Markdown edits when the document becomes visible', async () => {
    const user = userEvent.setup();
    const originalMemory = {
      memoryId: 'mem_birthday',
      title: '旧记忆',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      segmentCount: 1,
      durationMs: 1000,
      audioByteLength: 3,
      hasTranscript: false,
      supplementCount: 0,
    };
    const refreshedMemory = {
      ...originalMemory,
      title: '外部记忆',
      updatedAt: '2026-05-08T14:42:00.000Z',
      hasTranscript: true,
    };
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
          memories: [originalMemory],
        },
      },
    });
    reoWorkspace.readWorkspaceSnapshot
      .mockResolvedValueOnce({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [originalMemory],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: '外部空间',
          description: 'Codex updated workspace metadata.',
          memories: [refreshedMemory],
        },
      });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    expect(
      within(titlebar).getByRole('button', { name: 'Daily memory 记忆空间操作' })
    ).toBeInTheDocument();
    await waitFor(() => expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledTimes(1));

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() =>
      expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      })
    );
    expect(
      within(titlebar).getByRole('button', { name: '外部空间 记忆空间操作' })
    ).toBeInTheDocument();
    expect(within(titlebar).getByRole('button', { name: '外部记忆 记忆操作' })).toBeInTheDocument();
  });

  it('ignores stale external file refresh responses when visibility events overlap', async () => {
    const user = userEvent.setup();
    const originalMemory = {
      memoryId: 'mem_birthday',
      title: '旧记忆',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      segmentCount: 1,
      durationMs: 1000,
      audioByteLength: 3,
      hasTranscript: false,
      supplementCount: 0,
    };
    const staleRefresh =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['readWorkspaceSnapshot']>>>();
    const freshRefresh =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['readWorkspaceSnapshot']>>>();

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
          memories: [originalMemory],
        },
      },
    });
    reoWorkspace.readWorkspaceSnapshot
      .mockResolvedValueOnce({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [originalMemory],
        },
      })
      .mockReturnValueOnce(staleRefresh.promise)
      .mockReturnValueOnce(freshRefresh.promise);

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await waitFor(() => expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledTimes(1));

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledTimes(3));

    await act(async () => {
      freshRefresh.resolve({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: '最新空间',
          description: 'Fresh workspace truth.',
          memories: [{ ...originalMemory, title: '最新记忆' }],
        },
      });
      await freshRefresh.promise;
    });

    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    expect(
      await within(titlebar).findByRole('button', { name: '最新空间 记忆空间操作' })
    ).toBeInTheDocument();

    await act(async () => {
      staleRefresh.resolve({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: '过期空间',
          description: 'Stale workspace truth.',
          memories: [{ ...originalMemory, title: '过期记忆' }],
        },
      });
      await staleRefresh.promise;
    });

    expect(
      within(titlebar).getByRole('button', { name: '最新空间 记忆空间操作' })
    ).toBeInTheDocument();
    expect(
      within(titlebar).queryByRole('button', { name: '过期空间 记忆空间操作' })
    ).not.toBeInTheDocument();
    expect(
      within(titlebar).queryByRole('button', { name: '过期记忆 记忆操作' })
    ).not.toBeInTheDocument();
  });

  it('confirms Memory deletion, removes it from the current Studio, and restores it from undo', async () => {
    const user = userEvent.setup();
    const deletedMemory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      segmentCount: 2,
      durationMs: 125_000,
      audioByteLength: 2048,
      hasTranscript: true,
      supplementCount: 0,
    };
    const remainingMemory = {
      memoryId: 'mem_morning',
      title: 'Morning note',
      createdAt: '2026-05-07T09:00:00.000Z',
      updatedAt: '2026-05-07T09:10:00.000Z',
      segmentCount: 1,
      durationMs: 30_000,
      audioByteLength: 512,
      hasTranscript: false,
      supplementCount: 0,
    };
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
          memories: [deletedMemory, remainingMemory],
        },
      },
    });
    reoWorkspace.deleteMemory.mockResolvedValue({
      ok: true,
      value: {
        memoryId: deletedMemory.memoryId,
        restoreToken: 'mem_birthday',
        memories: [remainingMemory],
      },
    });
    reoWorkspace.restoreDeletedMemory.mockResolvedValue({
      ok: true,
      value: {
        memory: deletedMemory,
        memories: [deletedMemory, remainingMemory],
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await expandMemoryRail(user);
    await screen.findByRole('button', { name: '选择记忆 My seventh birthday' });

    await user.click(screen.getByRole('button', { name: 'My seventh birthday 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '删除' }));

    const dialog = screen.getByRole('alertdialog', { name: '删除记忆' });
    expect(dialog).toHaveTextContent('删除“My seventh birthday”？片段和补充录音会先进入恢复区。');

    await user.click(within(dialog).getByRole('button', { name: '删除' }));

    await waitFor(() =>
      expect(reoWorkspace.deleteMemory).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        memoryId: 'mem_birthday',
      })
    );
    expect(screen.queryByRole('button', { name: '选择记忆 My seventh birthday' })).toBeNull();
    expect(screen.getByRole('button', { name: '选择记忆 Morning note' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const memoryToastTitle = await screen.findByText('已删除记忆');
    expect(memoryToastTitle.closest('[data-sonner-toast]')).toHaveClass('reo-undo-toast');
    expect(screen.getByText('My seventh birthday')).toBeInTheDocument();
    const memoryUndoButton = screen.getByRole('button', { name: '恢复' });
    expect(memoryUndoButton).toHaveClass('reo-toast-action');
    expect(memoryUndoButton).not.toHaveClass('bg-secondary', 'hover:bg-accent');
    expect(memoryUndoButton).toHaveClass('hover:text-popover-foreground');
    expect(memoryUndoButton).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-ring');
    expect(memoryUndoButton.querySelector('svg[aria-hidden="true"]')).toHaveClass('h-16', 'w-16');

    await user.click(memoryUndoButton);

    await waitFor(() =>
      expect(reoWorkspace.restoreDeletedMemory).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        restoreToken: 'mem_birthday',
      })
    );
    expect(
      await screen.findByRole('button', { name: '选择记忆 My seventh birthday' })
    ).toHaveAttribute('aria-current', 'page');
  });

  it('optimistically hides a deleted Segment and restores it from toast undo without IPC', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      segmentCount: 2,
      durationMs: 190_000,
      audioByteLength: 3072,
      hasTranscript: true,
      supplementCount: 0,
    };
    const deletedSegment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      type: 'audio' as const,
      title: 'Birthday candles',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      durationMs: 125_000,
      audioByteLength: 2048,
      lastTranscriptionAttempt: 'never' as const,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
    const remainingSegment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_song',
      type: 'audio' as const,
      title: 'Birthday song',
      createdAt: '2026-05-06T13:12:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      durationMs: 65_000,
      audioByteLength: 1024,
      lastTranscriptionAttempt: 'never' as const,
      transcript: { exists: false },
      supplementCount: 0,
      supplements: [],
    };
    const memoryAfterDelete = {
      ...memory,
      segmentCount: 1,
      durationMs: 65_000,
      audioByteLength: 1024,
      hasTranscript: false,
    };
    const fileTruthSnapshot = {
      workspaceId: 'ws_1',
      title: 'Daily memory',
      description: 'Private notes',
      memories: [memory],
    };
    const refreshAfterOptimisticDelete =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['readWorkspaceSnapshot']>>>();
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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readWorkspaceSnapshot
      .mockResolvedValueOnce({
        ok: true,
        value: fileTruthSnapshot,
      })
      .mockReturnValueOnce(refreshAfterOptimisticDelete.promise)
      .mockResolvedValue({
        ok: true,
        value: fileTruthSnapshot,
      });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [deletedSegment, remainingSegment],
        },
      },
    }));
    reoWorkspace.readFinalizedAudioSegment.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: 'ws_1',
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        transcript: { exists: false, text: '' },
      },
    }));
    reoWorkspace.deleteSegment.mockResolvedValue({
      ok: true,
      value: {
        memory: memoryAfterDelete,
        segmentId: deletedSegment.segmentId,
        restoreToken: deletedSegment.segmentId,
      },
    });
    reoWorkspace.restoreDeletedSegment.mockResolvedValue({
      ok: true,
      value: {
        memory,
        segment: deletedSegment,
      },
    });
    const queryClient = createReoQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('button', { name: '选择片段 Birthday candles' });
    await waitFor(() => expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: '片段 Birthday candles 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '删除' }));

    const dialog = screen.getByRole('alertdialog', { name: '删除片段' });
    expect(dialog).toHaveTextContent('Birthday candles');
    expect(dialog).toHaveTextContent('补充录音会随片段一起进入恢复区。');
    const cancelDeleteSegmentButton = within(dialog).getByRole('button', { name: '取消' });
    const confirmDeleteSegmentButton = within(dialog).getByRole('button', { name: '删除' });
    expect(cancelDeleteSegmentButton).toHaveClass(
      'hover:bg-accent',
      'hover:text-accent-foreground'
    );
    expect(cancelDeleteSegmentButton).not.toHaveClass('hover:bg-secondary');
    expect(confirmDeleteSegmentButton).toHaveClass('hover:bg-destructive-hover');
    expect(confirmDeleteSegmentButton).not.toHaveClass('hover:bg-destructive/90');
    expect(confirmDeleteSegmentButton).not.toHaveClass('hover:bg-destructive');

    await user.click(confirmDeleteSegmentButton);

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '选择片段 Birthday candles' })).toBeNull()
    );
    await waitFor(() => expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledTimes(2));
    await act(async () => {
      refreshAfterOptimisticDelete.resolve({
        ok: true,
        value: fileTruthSnapshot,
      });
      await refreshAfterOptimisticDelete.promise;
    });
    const pendingSnapshot = queryClient.getQueryData<{
      readonly memories: readonly (typeof memory)[];
    }>(workspaceSnapshotQueryKey({ workspaceId: 'ws_1' }));
    expect(
      pendingSnapshot?.memories.find((candidate) => candidate.memoryId === memory.memoryId)
    ).toMatchObject({
      audioByteLength: 1024,
      durationMs: 65_000,
      hasTranscript: false,
      segmentCount: 1,
    });
    expect(reoWorkspace.deleteSegment).not.toHaveBeenCalled();
    expect(reoWorkspace.restoreDeletedSegment).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '选择片段 Birthday candles' })).toBeNull();
    expect(screen.getByRole('button', { name: '选择片段 Birthday song' })).toBeInTheDocument();
    const toastTitle = await screen.findByText('已删除片段');
    expect(toastTitle.closest('[data-sonner-toast]')).toHaveClass('reo-undo-toast');
    expect(screen.getByText('Birthday candles')).toBeInTheDocument();
    const segmentUndoButton = screen.getByRole('button', { name: '恢复' });
    expect(segmentUndoButton).toHaveClass('reo-toast-action');
    expect(segmentUndoButton).not.toHaveClass('bg-secondary', 'hover:bg-accent');
    expect(segmentUndoButton).toHaveClass('hover:text-popover-foreground');
    expect(segmentUndoButton).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-ring');
    expect(segmentUndoButton.querySelector('svg[aria-hidden="true"]')).toHaveClass('h-16', 'w-16');

    await user.click(segmentUndoButton);

    expect(reoWorkspace.deleteSegment).not.toHaveBeenCalled();
    expect(reoWorkspace.restoreDeletedSegment).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('button', { name: '选择片段 Birthday candles' })
    ).toBeInTheDocument();
    const restoredSnapshot = queryClient.getQueryData<{
      readonly memories: readonly (typeof memory)[];
    }>(workspaceSnapshotQueryKey({ workspaceId: 'ws_1' }));
    expect(
      restoredSnapshot?.memories.find((candidate) => candidate.memoryId === memory.memoryId)
    ).toMatchObject({
      audioByteLength: 3072,
      durationMs: 190_000,
      hasTranscript: true,
      segmentCount: 2,
    });
  }, 20_000);

  it('keeps external summary changes while projecting a pending Segment delete', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_birthday_external_summary',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      segmentCount: 2,
      durationMs: 190_000,
      audioByteLength: 3072,
      hasTranscript: true,
      supplementCount: 0,
    };
    const deletedSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_external_deleted',
      type: 'audio' as const,
      title: 'Birthday candles external summary',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      durationMs: 125_000,
      audioByteLength: 2048,
      lastTranscriptionAttempt: 'never' as const,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
    const remainingSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_external_remaining',
      type: 'audio' as const,
      title: 'Birthday song external summary',
      createdAt: '2026-05-06T13:12:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      durationMs: 65_000,
      audioByteLength: 1024,
      lastTranscriptionAttempt: 'never' as const,
      transcript: { exists: false },
      supplementCount: 0,
      supplements: [],
    };
    const externallyUpdatedFileTruthMemory = {
      ...memory,
      updatedAt: '2026-05-06T13:20:00.000Z',
      hasTranscript: true,
    };
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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readWorkspaceSnapshot
      .mockResolvedValueOnce({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [memory],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [externallyUpdatedFileTruthMemory],
        },
      })
      .mockResolvedValue({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [externallyUpdatedFileTruthMemory],
        },
      });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [deletedSegment, remainingSegment],
        },
      },
    }));
    const queryClient = createReoQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('button', { name: '选择片段 Birthday candles external summary' });
    await waitFor(() => expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledTimes(1));

    await user.click(
      screen.getByRole('button', { name: '片段 Birthday candles external summary 更多操作' })
    );
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除片段' })).getByRole('button', {
        name: '删除',
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: '选择片段 Birthday candles external summary' })
      ).toBeNull()
    );
    await waitFor(() =>
      expect(reoWorkspace.readWorkspaceSnapshot.mock.calls.length).toBeGreaterThanOrEqual(2)
    );

    const projectedSnapshot = queryClient.getQueryData<{
      readonly memories: readonly (typeof memory)[];
    }>(workspaceSnapshotQueryKey({ workspaceId: 'ws_1' }));
    expect(
      projectedSnapshot?.memories.find((candidate) => candidate.memoryId === memory.memoryId)
    ).toMatchObject({
      audioByteLength: 1024,
      durationMs: 65_000,
      hasTranscript: true,
      segmentCount: 1,
      updatedAt: '2026-05-06T13:20:00.000Z',
    });
  }, 20_000);

  it('keeps non-target Memory detail refreshable during a pending Segment delete', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_birthday_invalidation',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      segmentCount: 2,
      durationMs: 190_000,
      audioByteLength: 3072,
      hasTranscript: true,
      supplementCount: 0,
    };
    const otherMemory = {
      memoryId: 'mem_other_invalidation',
      title: 'Other memory',
      createdAt: '2026-05-07T13:08:00.000Z',
      updatedAt: '2026-05-07T13:13:05.000Z',
      segmentCount: 1,
      durationMs: 50_000,
      audioByteLength: 512,
      hasTranscript: false,
      supplementCount: 0,
    };
    const otherMemoryAfterRefresh = {
      ...otherMemory,
      updatedAt: '2026-05-07T14:13:05.000Z',
      hasTranscript: true,
    };
    const deletedSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_invalidation_deleted',
      type: 'audio' as const,
      title: 'Birthday candles invalidation',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      durationMs: 125_000,
      audioByteLength: 2048,
      lastTranscriptionAttempt: 'never' as const,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
    const remainingSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_invalidation_remaining',
      type: 'audio' as const,
      title: 'Birthday song invalidation',
      createdAt: '2026-05-06T13:12:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      durationMs: 65_000,
      audioByteLength: 1024,
      lastTranscriptionAttempt: 'never' as const,
      transcript: { exists: false },
      supplementCount: 0,
      supplements: [],
    };
    const otherSegment = {
      workspaceId: 'ws_1',
      memoryId: otherMemory.memoryId,
      segmentId: 'seg_other_invalidation',
      type: 'audio' as const,
      title: 'Other segment invalidation',
      createdAt: '2026-05-07T13:08:00.000Z',
      updatedAt: '2026-05-07T13:13:05.000Z',
      durationMs: 50_000,
      audioByteLength: 512,
      transcript: { exists: false },
      supplementCount: 0,
      supplements: [],
    };
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
          memories: [memory, otherMemory],
        },
      },
    });
    reoWorkspace.readWorkspaceSnapshot
      .mockResolvedValueOnce({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [memory, otherMemory],
        },
      })
      .mockResolvedValue({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [memory, otherMemoryAfterRefresh],
        },
      });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail:
          payload.memoryId === memory.memoryId
            ? {
                ...memory,
                workspaceId: 'ws_1',
                segments: [deletedSegment, remainingSegment],
              }
            : {
                ...otherMemory,
                workspaceId: 'ws_1',
                segments: [otherSegment],
              },
      },
    }));

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await expandMemoryRail(user);
    await screen.findByRole('button', { name: '选择片段 Birthday candles invalidation' });

    await user.click(screen.getByRole('button', { name: '选择记忆 Other memory' }));
    await screen.findByRole('button', { name: '选择片段 Other segment invalidation' });
    await user.click(screen.getByRole('button', { name: '选择记忆 My seventh birthday' }));
    await screen.findByRole('button', { name: '选择片段 Birthday candles invalidation' });

    await user.click(
      screen.getByRole('button', { name: '片段 Birthday candles invalidation 更多操作' })
    );
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除片段' })).getByRole('button', {
        name: '删除',
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: '选择片段 Birthday candles invalidation' })
      ).toBeNull()
    );
    await waitFor(() =>
      expect(reoWorkspace.readWorkspaceSnapshot.mock.calls.length).toBeGreaterThanOrEqual(2)
    );

    await user.click(screen.getByRole('button', { name: '选择记忆 Other memory' }));

    await waitFor(() =>
      expect(
        reoWorkspace.readMemoryDetail.mock.calls.filter(
          ([payload]) => payload.memoryId === otherMemory.memoryId
        )
      ).toHaveLength(2)
    );
  }, 20_000);

  it('restores an optimistically deleted Segment without rolling back a later Memory rename', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_birthday_scoped_undo',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      segmentCount: 2,
      durationMs: 190_000,
      audioByteLength: 3072,
      hasTranscript: true,
      supplementCount: 0,
    };
    const deletedSegment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday_scoped_undo',
      segmentId: 'seg_birthday_voice_scoped_undo',
      type: 'audio' as const,
      title: 'Birthday candles scoped undo',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      durationMs: 125_000,
      audioByteLength: 2048,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
    const remainingSegment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday_scoped_undo',
      segmentId: 'seg_birthday_song_scoped_undo',
      type: 'audio' as const,
      title: 'Birthday song scoped undo',
      createdAt: '2026-05-06T13:12:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      durationMs: 65_000,
      audioByteLength: 1024,
      transcript: { exists: false },
      supplementCount: 0,
      supplements: [],
    };
    const memoryAfterDelete = {
      ...memory,
      segmentCount: 1,
      durationMs: 65_000,
      audioByteLength: 1024,
      hasTranscript: false,
    };
    const renamedMemoryAfterDelete = {
      ...memoryAfterDelete,
      title: 'Renamed birthday',
    };
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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [deletedSegment, remainingSegment],
        },
      },
    }));
    reoWorkspace.readFinalizedAudioSegment.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: 'ws_1',
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        transcript: { exists: false, text: '' },
      },
    }));
    reoWorkspace.updateMemoryTitle.mockResolvedValue({
      ok: true,
      value: renamedMemoryAfterDelete,
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('button', { name: '选择片段 Birthday candles scoped undo' });

    await user.click(
      screen.getByRole('button', { name: '片段 Birthday candles scoped undo 更多操作' })
    );
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除片段' })).getByRole('button', {
        name: '删除',
      })
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: '选择片段 Birthday candles scoped undo' })
      ).toBeNull()
    );

    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    await user.click(
      within(titlebar).getByRole('button', { name: 'My seventh birthday 记忆操作' })
    );
    await user.click(screen.getByRole('menuitem', { name: '重命名' }));
    const renameDialog = screen.getByRole('dialog', { name: '重命名记忆' });
    const titleInput = within(renameDialog).getByLabelText('记忆名称');
    await user.clear(titleInput);
    await user.type(titleInput, 'Renamed birthday');
    await user.click(within(renameDialog).getByRole('button', { name: '保存' }));

    expect(
      await within(titlebar).findByRole('button', { name: 'Renamed birthday 记忆操作' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '恢复' }));

    expect(
      await screen.findByRole('button', { name: '选择片段 Birthday candles scoped undo' })
    ).toBeInTheDocument();
    expect(
      within(titlebar).getByRole('button', { name: 'Renamed birthday 记忆操作' })
    ).toBeInTheDocument();
    expect(
      within(titlebar).queryByRole('button', { name: 'My seventh birthday 记忆操作' })
    ).not.toBeInTheDocument();
    expect(reoWorkspace.deleteSegment).not.toHaveBeenCalled();
    expect(reoWorkspace.restoreDeletedSegment).not.toHaveBeenCalled();
  }, 20_000);

  it('commits Segment deletion after the undo toast grace period expires', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_birthday_commit',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      segmentCount: 2,
      durationMs: 190_000,
      audioByteLength: 3072,
      hasTranscript: true,
      supplementCount: 0,
    };
    const deletedSegment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday_commit',
      segmentId: 'seg_birthday_voice_commit',
      type: 'audio' as const,
      title: 'Birthday candles commit',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      durationMs: 125_000,
      audioByteLength: 2048,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
    const remainingSegment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday_commit',
      segmentId: 'seg_birthday_song_commit',
      type: 'audio' as const,
      title: 'Birthday song commit',
      createdAt: '2026-05-06T13:12:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      durationMs: 65_000,
      audioByteLength: 1024,
      transcript: { exists: false },
      supplementCount: 0,
      supplements: [],
    };
    const memoryAfterDelete = {
      ...memory,
      segmentCount: 1,
      durationMs: 65_000,
      audioByteLength: 1024,
      hasTranscript: false,
    };
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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [deletedSegment, remainingSegment],
        },
      },
    }));
    reoWorkspace.readFinalizedAudioSegment.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: 'ws_1',
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        transcript: { exists: false, text: '' },
      },
    }));
    reoWorkspace.deleteSegment.mockResolvedValue({
      ok: true,
      value: {
        memory: memoryAfterDelete,
        segmentId: deletedSegment.segmentId,
        restoreToken: deletedSegment.segmentId,
      },
    });
    const queryClient = createReoQueryClient();
    const deletedSegmentContentKey = segmentContentQueryKey({
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: deletedSegment.segmentId,
    });
    const deletedSupplementContentKey = segmentSupplementContentQueryKey({
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: deletedSegment.segmentId,
      supplementId: 'sup_birthday_followup_commit',
    });
    queryClient.setQueryData(deletedSegmentContentKey, {
      audio: new Uint8Array([1]),
      audioByteLength: 1,
      memoryId: memory.memoryId,
      requestId: 'segment-content:stale',
      segmentId: deletedSegment.segmentId,
      transcript: { exists: false, text: '' },
      workspaceId: 'ws_1',
    });
    queryClient.setQueryData(deletedSupplementContentKey, {
      supplementId: 'sup_birthday_followup_commit',
      audio: new Uint8Array([2]),
      audioByteLength: 1,
      memoryId: memory.memoryId,
      requestId: 'segment-supplement-content:stale',
      segmentId: deletedSegment.segmentId,
      workspaceId: 'ws_1',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('button', { name: '选择片段 Birthday candles commit' });

    await user.click(screen.getByRole('button', { name: '片段 Birthday candles commit 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除片段' })).getByRole('button', {
        name: '删除',
      })
    );

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '选择片段 Birthday candles commit' })).toBeNull()
    );
    expect(reoWorkspace.deleteSegment).not.toHaveBeenCalled();

    const segmentDeleteToast = [...toast.getToasts()]
      .reverse()
      .find((entry) => 'title' in entry && entry.title === '已删除片段');
    expect(segmentDeleteToast).toMatchObject({
      className: 'reo-undo-toast',
      dismissible: false,
      duration: 10000,
    });
    if (!segmentDeleteToast || !('onAutoClose' in segmentDeleteToast)) {
      throw new Error('Segment delete toast did not expose an auto-close handler');
    }
    await act(async () => {
      segmentDeleteToast?.onAutoClose?.(segmentDeleteToast);
      segmentDeleteToast?.onAutoClose?.(segmentDeleteToast);
    });

    await waitFor(() =>
      expect(reoWorkspace.deleteSegment).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: 'mem_birthday_commit',
        segmentId: 'seg_birthday_voice_commit',
      })
    );
    expect(reoWorkspace.deleteSegment).toHaveBeenCalledTimes(1);
    expect(reoWorkspace.restoreDeletedSegment).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(deletedSegmentContentKey)).toBeUndefined();
    expect(queryClient.getQueryData(deletedSupplementContentKey)).toBeUndefined();
  }, 20_000);

  it('does not undo a Segment delete after the grace period has started committing', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_birthday_commit_race',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      segmentCount: 1,
      durationMs: 125_000,
      audioByteLength: 2048,
      hasTranscript: true,
      supplementCount: 0,
    };
    const deletedSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_commit_race',
      type: 'audio' as const,
      title: 'Birthday candles commit race',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      durationMs: 125_000,
      audioByteLength: 2048,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
    const deleteDeferred =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['deleteSegment']>>>();
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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [deletedSegment],
        },
      },
    }));
    reoWorkspace.deleteSegment.mockReturnValue(deleteDeferred.promise);
    const queryClient = createReoQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('button', { name: '选择片段 Birthday candles commit race' });
    await user.click(
      screen.getByRole('button', { name: '片段 Birthday candles commit race 更多操作' })
    );
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除片段' })).getByRole('button', {
        name: '删除',
      })
    );

    const segmentDeleteToast = [...toast.getToasts()]
      .reverse()
      .find((entry) => 'className' in entry && entry.className === 'reo-undo-toast');
    if (!segmentDeleteToast || !('onAutoClose' in segmentDeleteToast)) {
      throw new Error('Segment delete toast did not expose an auto-close handler');
    }

    await act(async () => {
      segmentDeleteToast.onAutoClose?.(segmentDeleteToast);
    });
    await waitFor(() => expect(reoWorkspace.deleteSegment).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: '恢复' }));

    expect(
      screen.queryByRole('button', { name: '选择片段 Birthday candles commit race' })
    ).toBeNull();
    expect(reoWorkspace.restoreDeletedSegment).not.toHaveBeenCalled();

    await act(async () => {
      deleteDeferred.resolve({
        ok: true,
        value: {
          memory: {
            ...memory,
            audioByteLength: 0,
            durationMs: 0,
            hasTranscript: false,
            segmentCount: 0,
          },
          segmentId: deletedSegment.segmentId,
          restoreToken: deletedSegment.segmentId,
        },
      });
      await deleteDeferred.promise;
    });

    expect(
      screen.queryByRole('button', { name: '选择片段 Birthday candles commit race' })
    ).toBeNull();
  }, 20_000);

  it('keeps other pending Segment deletes projected when one delayed commit succeeds', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_birthday_multi_pending',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      segmentCount: 3,
      durationMs: 6000,
      audioByteLength: 600,
      hasTranscript: true,
      supplementCount: 0,
    };
    const firstSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_multi_first',
      type: 'audio' as const,
      title: 'Birthday candles multi first',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      audioByteLength: 100,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
    const secondSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_multi_second',
      type: 'audio' as const,
      title: 'Birthday candles multi second',
      createdAt: '2026-05-06T13:10:00.000Z',
      updatedAt: '2026-05-06T13:11:00.000Z',
      durationMs: 2000,
      audioByteLength: 200,
      transcript: { exists: false },
      supplementCount: 0,
      supplements: [],
    };
    const remainingSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_multi_remaining',
      type: 'audio' as const,
      title: 'Birthday song multi remaining',
      createdAt: '2026-05-06T13:12:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      durationMs: 3000,
      audioByteLength: 300,
      transcript: { exists: false },
      supplementCount: 0,
      supplements: [],
    };
    const memoryAfterFirstDelete = {
      ...memory,
      segmentCount: 2,
      durationMs: 5000,
      audioByteLength: 500,
    };
    const memoryAfterSecondDelete = {
      ...memory,
      segmentCount: 2,
      durationMs: 4000,
      audioByteLength: 400,
    };
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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [firstSegment, secondSegment, remainingSegment],
        },
      },
    }));
    reoWorkspace.deleteSegment.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        memory:
          payload.segmentId === secondSegment.segmentId
            ? memoryAfterSecondDelete
            : memoryAfterFirstDelete,
        segmentId: payload.segmentId,
        restoreToken: payload.segmentId,
      },
    }));
    const queryClient = createReoQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('button', { name: '选择片段 Birthday candles multi first' });

    await user.click(
      screen.getByRole('button', { name: '片段 Birthday candles multi first 更多操作' })
    );
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除片段' })).getByRole('button', {
        name: '删除',
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: '选择片段 Birthday candles multi first' })
      ).toBeNull()
    );

    await user.click(
      screen.getByRole('button', { name: '片段 Birthday candles multi second 更多操作' })
    );
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除片段' })).getByRole('button', {
        name: '删除',
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: '选择片段 Birthday candles multi second' })
      ).toBeNull()
    );

    const secondSegmentToast = [...toast.getToasts()].find(
      (entry) => 'description' in entry && entry.description === secondSegment.title
    );
    if (!secondSegmentToast || !('onAutoClose' in secondSegmentToast)) {
      throw new Error('Second Segment delete toast did not expose an auto-close handler');
    }

    await act(async () => {
      secondSegmentToast.onAutoClose?.(secondSegmentToast);
    });

    await waitFor(() =>
      expect(reoWorkspace.deleteSegment).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: memory.memoryId,
        segmentId: secondSegment.segmentId,
      })
    );
    const pendingSnapshot = queryClient.getQueryData<{
      readonly memories: readonly (typeof memory)[];
    }>(workspaceSnapshotQueryKey({ workspaceId: 'ws_1' }));
    expect(
      pendingSnapshot?.memories.find((candidate) => candidate.memoryId === memory.memoryId)
    ).toMatchObject({
      audioByteLength: 300,
      durationMs: 3000,
      hasTranscript: false,
      segmentCount: 1,
    });
    expect(
      screen.queryByRole('button', { name: '选择片段 Birthday candles multi first' })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: '选择片段 Birthday candles multi second' })
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: '选择片段 Birthday song multi remaining' })
    ).toBeInTheDocument();
  }, 20_000);

  it('does not double subtract a pending Segment when file-truth refresh already excludes it', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_birthday_refresh_already_deleted',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      segmentCount: 2,
      durationMs: 190_000,
      audioByteLength: 3072,
      hasTranscript: true,
      supplementCount: 0,
    };
    const deletedSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_refresh_already_deleted',
      type: 'audio' as const,
      title: 'Birthday candles already deleted',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      durationMs: 125_000,
      audioByteLength: 2048,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
    const remainingSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_refresh_remaining',
      type: 'audio' as const,
      title: 'Birthday song already deleted refresh',
      createdAt: '2026-05-06T13:12:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      durationMs: 65_000,
      audioByteLength: 1024,
      transcript: { exists: false },
      supplementCount: 0,
      supplements: [],
    };
    const memoryAfterFileTruthDelete = {
      ...memory,
      audioByteLength: remainingSegment.audioByteLength,
      durationMs: remainingSegment.durationMs,
      hasTranscript: false,
      segmentCount: 1,
    };
    const refreshAfterOptimisticDelete =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['readWorkspaceSnapshot']>>>();
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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readWorkspaceSnapshot
      .mockResolvedValueOnce({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [memory],
        },
      })
      .mockReturnValueOnce(refreshAfterOptimisticDelete.promise);
    let fileTruthAlreadyDeleted = false;
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...(fileTruthAlreadyDeleted ? memoryAfterFileTruthDelete : memory),
          workspaceId: 'ws_1',
          segments: fileTruthAlreadyDeleted
            ? [remainingSegment]
            : [deletedSegment, remainingSegment],
        },
      },
    }));
    const queryClient = createReoQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('button', { name: '选择片段 Birthday candles already deleted' });
    await waitFor(() => expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledTimes(1));
    await user.click(
      screen.getByRole('button', { name: '片段 Birthday candles already deleted 更多操作' })
    );
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除片段' })).getByRole('button', {
        name: '删除',
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: '选择片段 Birthday candles already deleted' })
      ).toBeNull()
    );
    await waitFor(() => expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledTimes(2));

    await act(async () => {
      fileTruthAlreadyDeleted = true;
      refreshAfterOptimisticDelete.resolve({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [memoryAfterFileTruthDelete],
        },
      });
      await refreshAfterOptimisticDelete.promise;
    });

    const pendingSnapshot = queryClient.getQueryData<{
      readonly memories: readonly (typeof memory)[];
    }>(workspaceSnapshotQueryKey({ workspaceId: 'ws_1' }));
    expect(
      pendingSnapshot?.memories.find((candidate) => candidate.memoryId === memory.memoryId)
    ).toMatchObject({
      audioByteLength: 1024,
      durationMs: 65_000,
      hasTranscript: false,
      segmentCount: 1,
    });
  }, 20_000);

  it('rolls back optimistic Segment deletion when delayed commit fails', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_birthday_rollback',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      segmentCount: 1,
      durationMs: 125_000,
      audioByteLength: 2048,
      hasTranscript: true,
      supplementCount: 0,
    };
    const deletedSegment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday_rollback',
      segmentId: 'seg_birthday_voice_rollback',
      type: 'audio' as const,
      title: 'Birthday candles rollback',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      durationMs: 125_000,
      audioByteLength: 2048,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [deletedSegment],
        },
      },
    }));
    reoWorkspace.readFinalizedAudioSegment.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: 'ws_1',
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        transcript: { exists: false, text: '' },
      },
    }));
    reoWorkspace.deleteSegment.mockResolvedValue({
      ok: false,
      error: { code: 'ERR_SEGMENT_DELETE_FAILED', message: 'Segment could not be deleted' },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('button', { name: '选择片段 Birthday candles rollback' });

    await user.click(
      screen.getByRole('button', { name: '片段 Birthday candles rollback 更多操作' })
    );
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除片段' })).getByRole('button', {
        name: '删除',
      })
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: '选择片段 Birthday candles rollback' })
      ).toBeNull()
    );

    const segmentDeleteToast = [...toast.getToasts()]
      .reverse()
      .find((entry) => 'title' in entry && entry.title === '已删除片段');
    if (!segmentDeleteToast || !('onAutoClose' in segmentDeleteToast)) {
      throw new Error('Segment delete toast did not expose an auto-close handler');
    }
    await act(async () => {
      segmentDeleteToast?.onAutoClose?.(segmentDeleteToast);
    });

    await waitFor(() => expect(reoWorkspace.deleteSegment).toHaveBeenCalled());
    expect(
      await screen.findByRole('button', { name: '选择片段 Birthday candles rollback' })
    ).toBeInTheDocument();
    expect((await screen.findAllByText('无法删除片段。')).length).toBeGreaterThan(0);
    expect(reoWorkspace.restoreDeletedSegment).not.toHaveBeenCalled();
  }, 20_000);

  it('keeps Segment deletion projected when delayed commit reports stale file truth', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_birthday_stale_file_truth',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      segmentCount: 1,
      durationMs: 125_000,
      audioByteLength: 2048,
      hasTranscript: true,
      supplementCount: 0,
    };
    const deletedSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_stale_file_truth',
      type: 'audio' as const,
      title: 'Birthday candles stale file truth',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      durationMs: 125_000,
      audioByteLength: 2048,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [deletedSegment],
        },
      },
    }));
    reoWorkspace.deleteSegment.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_LOCK_LOST',
        dataRetention: 'file-written-index-stale',
        message: 'Workspace lock was lost',
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('button', { name: '选择片段 Birthday candles stale file truth' });

    await user.click(
      screen.getByRole('button', { name: '片段 Birthday candles stale file truth 更多操作' })
    );
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除片段' })).getByRole('button', {
        name: '删除',
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: '选择片段 Birthday candles stale file truth' })
      ).toBeNull()
    );

    const segmentDeleteToast = [...toast.getToasts()]
      .reverse()
      .find((entry) => 'title' in entry && entry.title === '已删除片段');
    if (!segmentDeleteToast || !('onAutoClose' in segmentDeleteToast)) {
      throw new Error('Segment delete toast did not expose an auto-close handler');
    }
    await act(async () => {
      segmentDeleteToast.onAutoClose?.(segmentDeleteToast);
    });

    await waitFor(() => expect(reoWorkspace.deleteSegment).toHaveBeenCalled());
    expect(
      screen.queryByRole('button', { name: '选择片段 Birthday candles stale file truth' })
    ).toBeNull();
    expect((await screen.findAllByText('无法删除片段。')).length).toBeGreaterThan(0);
    expect(reoWorkspace.restoreDeletedSegment).not.toHaveBeenCalled();
  }, 20_000);

  it('does not commit a pending Segment delete after leaving the workspace session', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_birthday_leave',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      segmentCount: 1,
      durationMs: 125_000,
      audioByteLength: 2048,
      hasTranscript: true,
      supplementCount: 0,
    };
    const deletedSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_leave',
      type: 'audio' as const,
      title: 'Birthday candles leave',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      durationMs: 125_000,
      audioByteLength: 2048,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readWorkspaceSnapshot.mockResolvedValue({
      ok: true,
      value: {
        workspaceId: 'ws_1',
        title: 'Daily memory',
        description: 'Private notes',
        memories: [memory],
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [deletedSegment],
        },
      },
    }));

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('button', { name: '选择片段 Birthday candles leave' });

    await user.click(screen.getByRole('button', { name: '片段 Birthday candles leave 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除片段' })).getByRole('button', {
        name: '删除',
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '选择片段 Birthday candles leave' })).toBeNull()
    );

    const segmentDeleteToast = [...toast.getToasts()]
      .reverse()
      .find((entry) => 'title' in entry && entry.title === '已删除片段');
    if (!segmentDeleteToast || !('onAutoClose' in segmentDeleteToast)) {
      throw new Error('Segment delete toast did not expose an auto-close handler');
    }

    await user.click(screen.getByRole('button', { name: '首页' }));
    await waitFor(() =>
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      })
    );

    await act(async () => {
      segmentDeleteToast.onAutoClose?.(segmentDeleteToast);
    });

    expect(reoWorkspace.deleteSegment).not.toHaveBeenCalled();
  }, 20_000);

  it('ignores an in-flight delayed Segment delete response after reopening the same workspace id', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_birthday_reopen',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      segmentCount: 2,
      durationMs: 190_000,
      audioByteLength: 3072,
      hasTranscript: true,
      supplementCount: 0,
    };
    const deletedSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_reopen_deleted',
      type: 'audio' as const,
      title: 'Birthday candles reopen',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      durationMs: 125_000,
      audioByteLength: 2048,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
    const remainingSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_reopen_remaining',
      type: 'audio' as const,
      title: 'Birthday song reopen',
      createdAt: '2026-05-06T13:12:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      durationMs: 65_000,
      audioByteLength: 1024,
      transcript: { exists: false },
      supplementCount: 0,
      supplements: [],
    };
    const memoryAfterOldDelete = {
      ...memory,
      segmentCount: 1,
      durationMs: 65_000,
      audioByteLength: 1024,
    };
    const delayedDelete =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['deleteSegment']>>>();
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
          {
            workspaceId: 'ws_1',
            title: 'Daily memory',
            description: 'Private notes',
            addedAt: '2026-05-06T13:08:00.000Z',
            lastOpenedAt: '2026-05-06T13:08:00.000Z',
          },
        ],
      },
    });
    reoWorkspace.openMemorySpace
      .mockResolvedValueOnce({
        ok: true,
        value: {
          workspaceHandle: 'workspace-handle-1',
          workspaceId: 'ws_1',
          snapshot: {
            workspaceId: 'ws_1',
            title: 'Daily memory',
            description: 'Private notes',
            memories: [memory],
          },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          workspaceHandle: 'workspace-handle-2',
          workspaceId: 'ws_1',
          snapshot: {
            workspaceId: 'ws_1',
            title: 'Daily memory',
            description: 'Private notes',
            memories: [memory],
          },
        },
      });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [deletedSegment, remainingSegment],
        },
      },
    }));
    reoWorkspace.deleteSegment.mockReturnValue(delayedDelete.promise);
    const queryClient = createReoQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    await user.click(await screen.findByRole('button', { name: 'Daily memory' }));
    await screen.findByRole('button', { name: '选择片段 Birthday candles reopen' });

    await user.click(screen.getByRole('button', { name: '片段 Birthday candles reopen 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除片段' })).getByRole('button', {
        name: '删除',
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '选择片段 Birthday candles reopen' })).toBeNull()
    );

    const segmentDeleteToast = [...toast.getToasts()]
      .reverse()
      .find((entry) => 'title' in entry && entry.title === '已删除片段');
    if (!segmentDeleteToast || !('onAutoClose' in segmentDeleteToast)) {
      throw new Error('Segment delete toast did not expose an auto-close handler');
    }
    await act(async () => {
      segmentDeleteToast.onAutoClose?.(segmentDeleteToast);
    });
    await waitFor(() => expect(reoWorkspace.deleteSegment).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: '首页' }));
    await waitFor(() =>
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      })
    );
    await user.click(await screen.findByRole('button', { name: 'Daily memory' }));
    expect(
      await screen.findByRole('button', { name: '选择片段 Birthday candles reopen' })
    ).toBeInTheDocument();

    await act(async () => {
      delayedDelete.resolve({
        ok: true,
        value: {
          memory: memoryAfterOldDelete,
          segmentId: deletedSegment.segmentId,
          restoreToken: deletedSegment.segmentId,
        },
      });
      await delayedDelete.promise;
    });

    expect(
      screen.getByRole('button', { name: '选择片段 Birthday candles reopen' })
    ).toBeInTheDocument();
    const reopenedSnapshot = queryClient.getQueryData<{
      readonly memories: readonly (typeof memory)[];
    }>(workspaceSnapshotQueryKey({ workspaceId: 'ws_1' }));
    expect(
      reopenedSnapshot?.memories.find((candidate) => candidate.memoryId === memory.memoryId)
    ).toMatchObject({
      audioByteLength: 3072,
      durationMs: 190_000,
      segmentCount: 2,
    });
  }, 20_000);

  it('does not let a stale pending refresh detail overwrite a reopened workspace session', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_birthday_reopen_refresh',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      segmentCount: 2,
      durationMs: 190_000,
      audioByteLength: 3072,
      hasTranscript: true,
      supplementCount: 0,
    };
    const deletedSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_reopen_refresh_deleted',
      type: 'audio' as const,
      title: 'Birthday candles stale refresh',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:10:00.000Z',
      durationMs: 125_000,
      audioByteLength: 2048,
      lastTranscriptionAttempt: 'never' as const,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
    const staleRemainingSegment = {
      workspaceId: 'ws_1',
      memoryId: memory.memoryId,
      segmentId: 'seg_birthday_reopen_refresh_remaining',
      type: 'audio' as const,
      title: 'Old remaining from stale refresh',
      createdAt: '2026-05-06T13:12:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      durationMs: 65_000,
      audioByteLength: 1024,
      lastTranscriptionAttempt: 'never' as const,
      transcript: { exists: false },
      supplementCount: 0,
      supplements: [],
    };
    const freshRemainingSegment = {
      ...staleRemainingSegment,
      title: 'Fresh remaining after reopen',
    };
    const staleRefreshSnapshot =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['readWorkspaceSnapshot']>>>();
    const staleRefreshDetail =
      createDeferred<Awaited<ReturnType<Window['reoWorkspace']['readMemoryDetail']>>>();
    let staleRefreshDetailRequestId = '';
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
          {
            workspaceId: 'ws_1',
            title: 'Daily memory',
            description: 'Private notes',
            addedAt: '2026-05-06T13:08:00.000Z',
            lastOpenedAt: '2026-05-06T13:08:00.000Z',
          },
        ],
      },
    });
    reoWorkspace.openMemorySpace
      .mockResolvedValueOnce({
        ok: true,
        value: {
          workspaceHandle: 'workspace-handle-1',
          workspaceId: 'ws_1',
          snapshot: {
            workspaceId: 'ws_1',
            title: 'Daily memory',
            description: 'Private notes',
            memories: [memory],
          },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          workspaceHandle: 'workspace-handle-2',
          workspaceId: 'ws_1',
          snapshot: {
            workspaceId: 'ws_1',
            title: 'Daily memory',
            description: 'Private notes',
            memories: [memory],
          },
        },
      });
    reoWorkspace.readWorkspaceSnapshot
      .mockResolvedValueOnce({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [memory],
        },
      })
      .mockReturnValueOnce(staleRefreshSnapshot.promise)
      .mockResolvedValue({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [memory],
        },
      });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => {
      if (payload.requestId.startsWith('memory-detail-refresh:')) {
        staleRefreshDetailRequestId = payload.requestId;
        return staleRefreshDetail.promise;
      }
      return {
        ok: true,
        value: {
          requestId: payload.requestId,
          detail: {
            ...memory,
            workspaceId: 'ws_1',
            segments:
              payload.workspaceHandle === 'workspace-handle-2'
                ? [deletedSegment, freshRemainingSegment]
                : [deletedSegment, staleRemainingSegment],
          },
        },
      };
    });
    reoWorkspace.deleteSegment.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...memory,
          audioByteLength: staleRemainingSegment.audioByteLength,
          durationMs: staleRemainingSegment.durationMs,
          hasTranscript: staleRemainingSegment.transcript.exists,
          segmentCount: 1,
        },
        segmentId: deletedSegment.segmentId,
        restoreToken: deletedSegment.segmentId,
      },
    });
    const queryClient = createReoQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    await user.click(await screen.findByRole('button', { name: 'Daily memory' }));
    await screen.findByRole('button', { name: '选择片段 Birthday candles stale refresh' });
    await user.click(
      screen.getByRole('button', { name: '片段 Birthday candles stale refresh 更多操作' })
    );
    await user.click(screen.getByRole('menuitem', { name: '删除' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: '删除片段' })).getByRole('button', {
        name: '删除',
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: '选择片段 Birthday candles stale refresh' })
      ).toBeNull()
    );
    await waitFor(() => expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledTimes(2));

    await act(async () => {
      staleRefreshSnapshot.resolve({
        ok: true,
        value: {
          workspaceId: 'ws_1',
          title: 'Daily memory',
          description: 'Private notes',
          memories: [memory],
        },
      });
      await staleRefreshSnapshot.promise;
    });
    await waitFor(() =>
      expect(reoWorkspace.readMemoryDetail).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.stringMatching(/^memory-detail-refresh:/),
          workspaceHandle: 'workspace-handle-1',
        })
      )
    );

    await user.click(screen.getByRole('button', { name: '首页' }));
    await waitFor(() =>
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      })
    );
    await user.click(await screen.findByRole('button', { name: 'Daily memory' }));
    await screen.findByRole('button', { name: '选择片段 Fresh remaining after reopen' });

    await act(async () => {
      staleRefreshDetail.resolve({
        ok: true,
        value: {
          requestId: staleRefreshDetailRequestId,
          detail: {
            ...memory,
            workspaceId: 'ws_1',
            segments: [deletedSegment, staleRemainingSegment],
          },
        },
      });
      await staleRefreshDetail.promise;
    });

    const reopenedDetail = queryClient.getQueryData<{
      readonly detail: { readonly segments: readonly { readonly title: string }[] };
    }>(
      memoryDetailQueryKey({
        workspaceId: 'ws_1',
        memoryId: memory.memoryId,
      })
    );
    expect(reopenedDetail?.detail.segments.map((segment) => segment.title)).toContain(
      'Fresh remaining after reopen'
    );
    expect(reopenedDetail?.detail.segments.map((segment) => segment.title)).not.toContain(
      'Old remaining from stale refresh'
    );
  }, 20_000);

  it('does not expose Segment deletion while a recording flow is open', async () => {
    const user = userEvent.setup();
    const memory = {
      memoryId: 'mem_recording_blocks_delete',
      title: 'Recording guard memory',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:13:05.000Z',
      segmentCount: 1,
      durationMs: 125_000,
      audioByteLength: 2048,
      hasTranscript: false,
      supplementCount: 0,
    };
    const segment = audioSegmentProjection({
      audioByteLength: 2048,
      durationMs: 125_000,
      memoryId: memory.memoryId,
      segmentId: 'seg_recording_blocks_delete',
      title: 'Recording guard segment',
    });
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
          memories: [memory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...memory,
          workspaceId: 'ws_1',
          segments: [segment],
        },
      },
    }));
    reoWorkspace.readFinalizedAudioSegment.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: 'ws_1',
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        transcript: { exists: false, text: '' },
      },
    }));
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, segmentId: 'seg_new_recording' },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    const segmentMenuButton = await screen.findByRole('button', {
      name: '片段 Recording guard segment 更多操作',
    });

    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));
    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();

    fireEvent.click(segmentMenuButton);
    expect(
      screen.queryByRole('menu', {
        hidden: true,
        name: '片段 Recording guard segment 操作',
      })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { hidden: true, name: '删除' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '删除片段' })).not.toBeInTheDocument();
    expect(reoWorkspace.deleteSegment).not.toHaveBeenCalled();
  }, 20_000);

  it('creates a named Memory from the titlebar plus control and opens it', async () => {
    const user = userEvent.setup();
    const createdMemory = {
      memoryId: 'mem_created',
      title: '产品灵感与思考',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentCount: 0,
      durationMs: 0,
      audioByteLength: 0,
      hasTranscript: false,
      supplementCount: 0,
    };
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
        },
      },
    });
    reoWorkspace.createMemory.mockResolvedValue({
      ok: true,
      value: createdMemory,
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    await user.click(within(titlebar).getByRole('button', { name: '新建记忆' }));

    const dialog = screen.getByRole('dialog', { name: '新建记忆' });
    const titleInput = within(dialog).getByLabelText('记忆名称');
    expect(titleInput).toHaveFocus();
    await user.type(titleInput, '产品灵感与思考');
    await user.click(within(dialog).getByRole('button', { name: '创建' }));

    await waitFor(() =>
      expect(reoWorkspace.createMemory).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        title: '产品灵感与思考',
      })
    );
    await expandMemoryRail(user);
    expect(screen.getByRole('button', { name: '选择记忆 产品灵感与思考' })).toBeInTheDocument();
    expect(getTitlebarMemoryControl('产品灵感与思考')).toBeInTheDocument();
  });

  it('records from the loaded workspace FAB into the current existing Memory', async () => {
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
              memoryId: 'mem_existing',
              title: 'Existing memory',
              createdAt: '2026-05-07T14:30:00.000Z',
              updatedAt: '2026-05-07T14:30:00.000Z',
              segmentCount: 1,
              durationMs: 1,
              audioByteLength: 1,
              hasTranscript: false,
              supplementCount: 0,
            },
          ],
        },
      },
    });
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.clearMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { cleared: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, segmentId: 'seg_1' },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          audioByteLength: 1,
          createdAt: '2026-05-07T14:30:00.000Z',
          durationMs: 1,
          supplementCount: 0,
          hasTranscript: false,
          memoryId: 'mem_existing',
          segmentCount: 2,
          title: 'Existing memory',
          updatedAt: '2026-05-08T14:30:01.000Z',
        },
        segment: audioSegmentProjection({
          audioByteLength: 1,
          createdAt: '2026-05-08T14:30:00.000Z',
          durationMs: 1,
          memoryId: 'mem_existing',
          segmentId: 'seg_1',
          title: '录音2',
          updatedAt: '2026-05-08T14:30:01.000Z',
        }),
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await user.click(await screen.findByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));

    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '新建记忆' })).not.toBeInTheDocument();
    expect(reoWorkspace.createMemory).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await user.click(screen.getByRole('button', { name: '停止录音' }));
    await user.click(screen.getByRole('button', { name: '停止录音' }));

    await waitFor(() => expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledOnce());
    const finalizePayload = reoWorkspace.finalizeRecordingDraft.mock.calls[0]?.[0];
    expect(finalizePayload).toMatchObject({
      segmentId: 'seg_1',
      title: '录音2',
      workspaceHandle: 'workspace-handle-1',
      memoryId: 'mem_existing',
    });
  });

  it('requires a named Memory before recording when the workspace has no memories', async () => {
    const user = userEvent.setup();
    installRecordingBrowserMocks();
    const createdMemory = {
      memoryId: 'mem_recording_target',
      title: '第一条记忆',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentCount: 0,
      durationMs: 0,
      audioByteLength: 0,
      hasTranscript: false,
      supplementCount: 0,
    };
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
        },
      },
    });
    reoWorkspace.createMemory.mockResolvedValue({
      ok: true,
      value: createdMemory,
    });
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.clearMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { cleared: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, segmentId: 'seg_1' },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...createdMemory,
          audioByteLength: 1,
          durationMs: 1,
          segmentCount: 1,
          updatedAt: '2026-05-08T14:42:01.000Z',
        },
        segment: audioSegmentProjection({
          audioByteLength: 1,
          createdAt: '2026-05-08T14:42:00.000Z',
          durationMs: 1,
          memoryId: 'mem_recording_target',
          segmentId: 'seg_1',
          title: '录音1',
          updatedAt: '2026-05-08T14:42:01.000Z',
        }),
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await user.click(await screen.findByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));

    expect(screen.queryByRole('dialog', { name: '录音' })).not.toBeInTheDocument();
    const createDialog = screen.getByRole('dialog', { name: '新建记忆' });
    await user.type(within(createDialog).getByLabelText('记忆名称'), '第一条记忆');
    await user.click(within(createDialog).getByRole('button', { name: '开始录音' }));

    await waitFor(() =>
      expect(reoWorkspace.createMemory).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        title: '第一条记忆',
      })
    );
    expect(await screen.findByRole('dialog', { name: '录音' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '新建记忆' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await user.click(screen.getByRole('button', { name: '停止录音' }));
    await user.click(screen.getByRole('button', { name: '停止录音' }));

    await waitFor(() => expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledOnce());
    expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        memoryId: 'mem_recording_target',
        segmentId: 'seg_1',
        workspaceHandle: 'workspace-handle-1',
      })
    );
  });

  it('offers to save a recoverable unfinished recording after reopening a workspace', async () => {
    const user = userEvent.setup();
    const recoveredMemory = {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-07T14:30:00.000Z',
      updatedAt: '2026-05-07T14:30:00.000Z',
      segmentCount: 1,
      durationMs: 1,
      audioByteLength: 1,
      hasTranscript: false,
      supplementCount: 0,
    };
    window.localStorage.setItem(
      'reo.recordingRecovery.v1.ws_1',
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        segmentId: 'seg_recoverable',
        title: 'Daily memory 录音',
        durationMs: 3720,
        transcriptSegments: [
          {
            endTimeMs: 3000,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '恢复后直接保存的转写内容',
          },
        ],
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:03.720Z',
      })
    );
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
          memories: [recoveredMemory],
        },
      },
    });
    reoWorkspace.saveTranscript.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          segmentCount: 2,
          durationMs: 3721,
          audioByteLength: 24,
          hasTranscript: true,
          updatedAt: '2026-05-09T10:00:05.000Z',
        },
        saved: true,
      },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          segmentCount: 2,
          durationMs: 3721,
          audioByteLength: 24,
          updatedAt: '2026-05-09T10:00:04.000Z',
        },
        segment: audioSegmentProjection({
          audioByteLength: 23,
          createdAt: '2026-05-09T10:00:00.000Z',
          durationMs: 3720,
          memoryId: 'mem_existing',
          segmentId: 'seg_recoverable',
          title: 'Daily memory 录音',
          updatedAt: '2026-05-09T10:00:04.000Z',
        }),
      },
    });

    const queryClient = createReoQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const recoveryDialog = await screen.findByRole('dialog', { name: '未完成录音' });
    queryClient.setQueryData(
      memoryDetailQueryKey({ workspaceId: 'ws_1', memoryId: 'mem_existing' }),
      {
        requestId: 'cached_recovered_memory_detail',
        detail: {
          ...recoveredMemory,
          workspaceId: 'ws_1',
          segments: [
            {
              ...audioSegmentProjection({
                audioByteLength: 23,
                createdAt: '2026-05-09T10:00:00.000Z',
                durationMs: 3720,
                memoryId: 'mem_existing',
                segmentId: 'seg_recoverable',
                title: 'Daily memory 录音',
                updatedAt: '2026-05-09T10:00:04.000Z',
              }),
              lastTranscriptionAttempt: 'failed' as const,
            },
          ],
        },
      }
    );
    expect(within(recoveryDialog).getByText('检测到一段未完成的录音。')).toBeInTheDocument();
    await user.click(within(recoveryDialog).getByRole('button', { name: '保存录音' }));

    await waitFor(() =>
      expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        memoryId: 'mem_existing',
        segmentId: 'seg_recoverable',
        title: 'Daily memory 录音',
        durationMs: 3720,
        lastTranscriptionAttemptOnFinalize: 'never',
      })
    );
    await waitFor(() =>
      expect(reoWorkspace.saveTranscript).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        memoryId: 'mem_existing',
        segmentId: 'seg_recoverable',
        markdown: '恢复后直接保存的转写内容',
      })
    );
    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).toBeNull();
    await waitFor(() =>
      expect(
        queryClient.getQueryData<{
          readonly detail: {
            readonly segments: readonly {
              readonly lastTranscriptionAttempt: 'failed' | 'never' | 'success';
              readonly transcript: { readonly exists: boolean };
            }[];
          };
        }>(memoryDetailQueryKey({ workspaceId: 'ws_1', memoryId: 'mem_existing' }))?.detail
          .segments[0]
      ).toMatchObject({
        lastTranscriptionAttempt: 'success',
        transcript: { exists: true },
      })
    );
    expect(await findTitlebarMemoryControl('Existing memory')).toBeInTheDocument();
    expect(screen.queryByText('2 个片段 · 00:03')).not.toBeInTheDocument();
  });

  it('passes failed transcription attempt when saving a recovered recording with current voice settings enabled', async () => {
    const user = userEvent.setup();
    mockVoiceTranscriptionSettings(true);
    const recoveredMemory = {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-07T14:30:00.000Z',
      updatedAt: '2026-05-07T14:30:00.000Z',
      segmentCount: 1,
      durationMs: 1,
      audioByteLength: 1,
      hasTranscript: false,
      supplementCount: 0,
    };
    window.localStorage.setItem(
      'reo.recordingRecovery.v1.ws_1',
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        segmentId: 'seg_recoverable',
        title: 'Daily memory 录音',
        durationMs: 3720,
        transcriptMarkdown: '恢复后转写暂时失败',
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:03.720Z',
      })
    );
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
          memories: [recoveredMemory],
        },
      },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          segmentCount: 2,
          durationMs: 3721,
          audioByteLength: 24,
          updatedAt: '2026-05-09T10:00:04.000Z',
        },
        segment: audioSegmentProjection({
          audioByteLength: 23,
          createdAt: '2026-05-09T10:00:00.000Z',
          durationMs: 3720,
          memoryId: 'mem_existing',
          segmentId: 'seg_recoverable',
          title: 'Daily memory 录音',
          updatedAt: '2026-05-09T10:00:04.000Z',
        }),
      },
    });
    reoWorkspace.saveTranscript.mockRejectedValue(new Error('Transcript write failed'));

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const recoveryDialog = await screen.findByRole('dialog', { name: '未完成录音' });
    await user.click(within(recoveryDialog).getByRole('button', { name: '保存录音' }));

    await waitFor(() =>
      expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        memoryId: 'mem_existing',
        segmentId: 'seg_recoverable',
        title: 'Daily memory 录音',
        durationMs: 3720,
        lastTranscriptionAttemptOnFinalize: 'failed',
      })
    );
    const retainedMarker = JSON.parse(
      window.localStorage.getItem('reo.recordingRecovery.v1.ws_1') ?? '{}'
    );
    expect(retainedMarker).not.toHaveProperty('lastTranscriptionAttemptOnFinalize');
  });

  it('recovers an unfinished SegmentSupplement recording through supplement IPC', async () => {
    const user = userEvent.setup();
    const recoveredMemory = {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-07T14:30:00.000Z',
      updatedAt: '2026-05-07T14:30:00.000Z',
      segmentCount: 1,
      durationMs: 1,
      audioByteLength: 1,
      hasTranscript: false,
      supplementCount: 0,
    };
    window.localStorage.setItem(
      'reo.recordingRecovery.v1.ws_1',
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        parentSegmentId: 'seg_parent',
        segmentId: 'sup_recoverable',
        targetKind: 'segment-supplement',
        title: '补充录音',
        durationMs: 3720,
        transcriptMarkdown: '恢复补充录音转写',
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:03.720Z',
      })
    );
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
          memories: [recoveredMemory],
        },
      },
    });
    reoWorkspace.finalizeSegmentSupplementRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          supplementCount: 1,
          updatedAt: '2026-05-09T10:00:04.000Z',
        },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_existing',
          segmentId: 'seg_parent',
          type: 'audio',
          title: 'Parent recording',
          createdAt: '2026-05-07T14:30:00.000Z',
          updatedAt: '2026-05-09T10:00:04.000Z',
          durationMs: 1,
          audioByteLength: 1,
          lastTranscriptionAttempt: 'never' as const,
          transcript: { exists: false },
          supplementCount: 1,
        },
        supplement: {
          workspaceId: 'ws_1',
          memoryId: 'mem_existing',
          segmentId: 'seg_parent',
          supplementId: 'sup_recoverable',
          type: 'audio',
          title: '补充录音',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:04.000Z',
          durationMs: 3720,
          audioByteLength: 23,
          lastTranscriptionAttempt: 'never' as const,
          transcript: { exists: false },
        },
      },
    });
    reoWorkspace.saveSegmentSupplementTranscript.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          supplementCount: 1,
          updatedAt: '2026-05-09T10:00:04.000Z',
        },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_existing',
          segmentId: 'seg_parent',
          type: 'audio',
          title: 'Parent recording',
          createdAt: '2026-05-07T14:30:00.000Z',
          updatedAt: '2026-05-09T10:00:04.000Z',
          durationMs: 1,
          audioByteLength: 1,
          lastTranscriptionAttempt: 'never' as const,
          transcript: { exists: false },
          supplementCount: 1,
          supplements: [
            {
              workspaceId: 'ws_1',
              memoryId: 'mem_existing',
              segmentId: 'seg_parent',
              supplementId: 'sup_recoverable',
              type: 'audio',
              title: '补充录音',
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T10:00:04.000Z',
              durationMs: 3720,
              audioByteLength: 23,
              lastTranscriptionAttempt: 'never' as const,
              transcript: { exists: true },
            },
          ],
        },
        supplement: {
          workspaceId: 'ws_1',
          memoryId: 'mem_existing',
          segmentId: 'seg_parent',
          supplementId: 'sup_recoverable',
          type: 'audio',
          title: '补充录音',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:04.000Z',
          durationMs: 3720,
          audioByteLength: 23,
          lastTranscriptionAttempt: 'never' as const,
          transcript: { exists: true },
        },
        saved: true,
      },
    });
    const queryClient = createReoQueryClient();
    const supplementContentKey = segmentSupplementContentQueryKey({
      workspaceId: 'ws_1',
      memoryId: 'mem_existing',
      segmentId: 'seg_parent',
      supplementId: 'sup_recoverable',
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    queryClient.setQueryData(supplementContentKey, {
      requestId: 'cached_supplement_content',
      workspaceId: 'ws_1',
      memoryId: 'mem_existing',
      segmentId: 'seg_parent',
      supplementId: 'sup_recoverable',
      audio: new Uint8Array([4, 5]),
      audioByteLength: 2,
      transcript: { exists: false, text: '' },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const recoveryDialog = await screen.findByRole('dialog', { name: '未完成录音' });
    expect(within(recoveryDialog).queryByRole('button', { name: '继续检查' })).toBeNull();
    await user.click(within(recoveryDialog).getByRole('button', { name: '保存录音' }));

    await waitFor(() =>
      expect(reoWorkspace.finalizeSegmentSupplementRecordingDraft).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        segmentId: 'seg_parent',
        supplementId: 'sup_recoverable',
        title: '补充录音',
        durationMs: 3720,
        lastTranscriptionAttemptOnFinalize: 'never',
      })
    );
    expect(reoWorkspace.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(reoWorkspace.saveTranscript).not.toHaveBeenCalled();
    expect(reoWorkspace.saveSegmentSupplementTranscript).toHaveBeenCalledWith({
      workspaceHandle: 'workspace-handle-1',
      workspaceId: 'ws_1',
      memoryId: 'mem_existing',
      segmentId: 'seg_parent',
      supplementId: 'sup_recoverable',
      markdown: '恢复补充录音转写',
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        exact: true,
        queryKey: supplementContentKey,
      });
    });
    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).toBeNull();
    const supplementContentInvalidations = invalidateSpy.mock.calls.filter(
      ([options]) =>
        options?.exact === true &&
        JSON.stringify(options.queryKey) === JSON.stringify(supplementContentKey)
    );
    expect(supplementContentInvalidations).toHaveLength(1);
    expect(await findTitlebarMemoryControl('Existing memory')).toBeInTheDocument();
    expect(screen.queryByText('1 个片段 · 00:00')).not.toBeInTheDocument();
  });

  it('passes failed transcription attempt when saving a recovered SegmentSupplement with current voice settings enabled', async () => {
    const user = userEvent.setup();
    mockVoiceTranscriptionSettings(true);
    const recoveredMemory = {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-07T14:30:00.000Z',
      updatedAt: '2026-05-07T14:30:00.000Z',
      segmentCount: 1,
      durationMs: 1,
      audioByteLength: 1,
      hasTranscript: false,
      supplementCount: 0,
    };
    window.localStorage.setItem(
      'reo.recordingRecovery.v1.ws_1',
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        parentSegmentId: 'seg_parent',
        segmentId: 'sup_recoverable',
        targetKind: 'segment-supplement',
        title: '补充录音',
        durationMs: 3720,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:03.720Z',
      })
    );
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
          memories: [recoveredMemory],
        },
      },
    });
    reoWorkspace.finalizeSegmentSupplementRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          supplementCount: 1,
          updatedAt: '2026-05-09T10:00:04.000Z',
        },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_existing',
          segmentId: 'seg_parent',
          type: 'audio',
          title: 'Parent recording',
          createdAt: '2026-05-07T14:30:00.000Z',
          updatedAt: '2026-05-09T10:00:04.000Z',
          durationMs: 1,
          audioByteLength: 1,
          lastTranscriptionAttempt: 'never' as const,
          transcript: { exists: false },
          supplementCount: 1,
        },
        supplement: {
          workspaceId: 'ws_1',
          memoryId: 'mem_existing',
          segmentId: 'seg_parent',
          supplementId: 'sup_recoverable',
          type: 'audio',
          title: '补充录音',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:04.000Z',
          durationMs: 3720,
          audioByteLength: 23,
          lastTranscriptionAttempt: 'never' as const,
          transcript: { exists: false },
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const recoveryDialog = await screen.findByRole('dialog', { name: '未完成录音' });
    await user.click(within(recoveryDialog).getByRole('button', { name: '保存录音' }));

    await waitFor(() =>
      expect(reoWorkspace.finalizeSegmentSupplementRecordingDraft).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        segmentId: 'seg_parent',
        supplementId: 'sup_recoverable',
        title: '补充录音',
        durationMs: 3720,
        lastTranscriptionAttemptOnFinalize: 'failed',
      })
    );
  });

  it('discards an unfinished SegmentSupplement recovery through supplement IPC', async () => {
    const user = userEvent.setup();
    const recoveredMemory = {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-07T14:30:00.000Z',
      updatedAt: '2026-05-07T14:30:00.000Z',
      segmentCount: 1,
      durationMs: 1,
      audioByteLength: 1,
      hasTranscript: false,
      supplementCount: 0,
    };
    window.localStorage.setItem(
      'reo.recordingRecovery.v1.ws_1',
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        parentSegmentId: 'seg_parent',
        segmentId: 'sup_recoverable',
        targetKind: 'segment-supplement',
        title: '补充录音',
        durationMs: 3720,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:03.720Z',
      })
    );
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
          memories: [recoveredMemory],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const recoveryDialog = await screen.findByRole('dialog', { name: '未完成录音' });
    await user.click(within(recoveryDialog).getByRole('button', { name: '放弃' }));

    await waitFor(() =>
      expect(reoWorkspace.discardSegmentSupplementRecordingDraft).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        supplementId: 'sup_recoverable',
      })
    );
    expect(reoWorkspace.discardRecordingDraft).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).toBeNull();
  });

  it('keeps a recovered transcript marker after transcript save fails and clears it after retry', async () => {
    const user = userEvent.setup();
    const recoveredMemory = {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-07T14:30:00.000Z',
      updatedAt: '2026-05-07T14:30:00.000Z',
      segmentCount: 1,
      durationMs: 1,
      audioByteLength: 1,
      hasTranscript: false,
      supplementCount: 0,
    };
    window.localStorage.setItem(
      'reo.recordingRecovery.v1.ws_1',
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        segmentId: 'seg_recoverable',
        title: 'Daily memory 录音',
        durationMs: 3720,
        transcriptSegments: [
          {
            endTimeMs: 3000,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '会尝试保存的恢复转写',
          },
        ],
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:03.720Z',
      })
    );
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
          memories: [recoveredMemory],
        },
      },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          segmentCount: 2,
          durationMs: 3721,
          audioByteLength: 24,
          updatedAt: '2026-05-09T10:00:04.000Z',
        },
        segment: audioSegmentProjection({
          audioByteLength: 23,
          createdAt: '2026-05-09T10:00:00.000Z',
          durationMs: 3720,
          memoryId: 'mem_existing',
          segmentId: 'seg_recoverable',
          title: 'Daily memory 录音',
          updatedAt: '2026-05-09T10:00:04.000Z',
        }),
      },
    });
    reoWorkspace.saveTranscript.mockRejectedValue(new Error('Transcript write failed'));

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const recoveryDialog = await screen.findByRole('dialog', { name: '未完成录音' });
    await user.click(within(recoveryDialog).getByRole('button', { name: '保存录音' }));

    await waitFor(() => expect(reoWorkspace.saveTranscript).toHaveBeenCalledOnce());
    const retainedMarker = window.localStorage.getItem('reo.recordingRecovery.v1.ws_1');
    expect(retainedMarker).not.toBeNull();
    expect(JSON.parse(retainedMarker as string)).toMatchObject({
      finalizedAudio: {
        segment: {
          memoryId: 'mem_existing',
          segmentId: 'seg_recoverable',
          type: 'audio',
        },
      },
    });
    expect(await findTitlebarMemoryControl('Existing memory')).toBeInTheDocument();
    expect(screen.queryByText('2 个片段 · 00:03')).not.toBeInTheDocument();

    reoWorkspace.saveTranscript.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          segmentCount: 2,
          durationMs: 3721,
          audioByteLength: 24,
          hasTranscript: true,
          updatedAt: '2026-05-09T10:00:05.000Z',
        },
        saved: true,
      },
    });

    const finalizedRecoveryDialog = await screen.findByRole('dialog', { name: '录音已保存' });
    expect(within(finalizedRecoveryDialog).queryByRole('button', { name: '继续检查' })).toBeNull();
    await user.click(within(finalizedRecoveryDialog).getByRole('button', { name: '重试保存转写' }));

    await waitFor(() => expect(reoWorkspace.saveTranscript).toHaveBeenCalledTimes(2));
    expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledOnce();
    expect(reoWorkspace.readRecordingDraftAudio).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).toBeNull();
  });

  it('keeps a recovered recording marker when the draft is missing before audio finalize', async () => {
    const user = userEvent.setup();
    const recoveredMemory = {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-07T14:30:00.000Z',
      updatedAt: '2026-05-07T14:30:00.000Z',
      segmentCount: 1,
      durationMs: 1,
      audioByteLength: 1,
      hasTranscript: false,
      supplementCount: 0,
    };
    window.localStorage.setItem(
      'reo.recordingRecovery.v1.ws_1',
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        segmentId: 'seg_missing_draft',
        title: 'Daily memory 录音',
        durationMs: 3720,
        transcriptSegments: [
          {
            endTimeMs: 3000,
            isFinal: true,
            recordingSessionId: 'recording-1',
            revisionId: 'recording-1-revision-0',
            startTimeMs: 0,
            text: '不应该静默丢失的恢复转写',
          },
        ],
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:03.720Z',
      })
    );
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
          memories: [recoveredMemory],
        },
      },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_RECORDING_NOT_FOUND' as const,
        message: 'Recording draft not found',
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const recoveryDialog = await screen.findByRole('dialog', { name: '未完成录音' });
    await user.click(within(recoveryDialog).getByRole('button', { name: '保存录音' }));

    await waitFor(() => expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledOnce());
    expect(reoWorkspace.saveTranscript).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).not.toBeNull();
  });

  it('opens a recoverable unfinished recording in paused review state before saving', async () => {
    const user = userEvent.setup();
    const recoveredMemory = {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-07T14:30:00.000Z',
      updatedAt: '2026-05-07T14:30:00.000Z',
      segmentCount: 1,
      durationMs: 1,
      audioByteLength: 1,
      hasTranscript: false,
      supplementCount: 0,
    };
    window.localStorage.setItem(
      'reo.recordingRecovery.v1.ws_1',
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_1',
        memoryId: 'mem_existing',
        segmentId: 'seg_recoverable',
        title: 'Daily memory 录音',
        durationMs: 3720,
        nextSequence: 3,
        audioChunks: [
          {
            byteLength: 3,
            endTimeMs: 3720,
            startTimeMs: 0,
          },
        ],
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:03.720Z',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        waveformSamples: [0.2, 0.4, 0.1],
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
      })
    );
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
          memories: [recoveredMemory],
        },
      },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          segmentCount: 2,
          durationMs: 3721,
          audioByteLength: 24,
          hasTranscript: false,
          updatedAt: '2026-05-09T10:00:04.000Z',
        },
        segment: audioSegmentProjection({
          audioByteLength: 23,
          createdAt: '2026-05-09T10:00:00.000Z',
          durationMs: 3720,
          memoryId: 'mem_existing',
          segmentId: 'seg_recoverable',
          title: 'Daily memory 录音',
          updatedAt: '2026-05-09T10:00:04.000Z',
        }),
      },
    });
    reoWorkspace.readRecordingDraftAudio.mockResolvedValue({
      ok: true,
      value: {
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        nextSequence: 3,
      },
    });
    reoWorkspace.saveTranscript.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...recoveredMemory,
          hasTranscript: true,
          updatedAt: '2026-05-09T10:00:05.000Z',
        },
        saved: true,
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const recoveryDialog = await screen.findByRole('dialog', { name: '未完成录音' });
    await user.click(within(recoveryDialog).getByRole('button', { name: '继续检查' }));

    expect(await screen.findByRole('dialog', { name: '录音' })).toBeInTheDocument();
    expect(screen.getByLabelText('暂停录音波形')).toBeInTheDocument();
    expect(screen.getByText('恢复后的转写内容')).toBeInTheDocument();
    expect(screen.getByText('00:03.72')).toBeInTheDocument();
    await waitFor(() =>
      expect(reoWorkspace.readRecordingDraftAudio).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        segmentId: 'seg_recoverable',
        maxBytes: 3,
      })
    );
    fireEvent.canPlay(screen.getByTestId('draft-playback-audio'));
    await waitFor(() => expect(screen.getByRole('button', { name: '播放录音' })).toBeEnabled());

    await user.click(screen.getByRole('button', { name: '停止录音' }));

    await waitFor(() =>
      expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        memoryId: 'mem_existing',
        segmentId: 'seg_recoverable',
        title: 'Daily memory 录音',
        durationMs: 3720,
        lastTranscriptionAttemptOnFinalize: 'never',
      })
    );
    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).toBeNull();
  });

  it('opens workspace creation from the sidebar add menu', async () => {
    const user = userEvent.setup();
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);

    expect(screen.getByRole('dialog', { name: '创建本地记忆空间' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: '创建本地记忆空间' })).toBeInTheDocument();
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
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));
    await user.click(screen.getByRole('menuitem', { name: '打开本地记忆空间' }));

    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();
    expect(screen.getAllByText('Existing memory').length).toBeGreaterThan(0);
    expect(reoWorkspace.openWorkspace).toHaveBeenCalledWith({
      selectionToken: 'selection-token-open',
    });
    expect(reoWorkspace.initializeWorkspace).not.toHaveBeenCalled();
    expect(reoWorkspace.openWorkspace).not.toHaveBeenCalledWith(
      expect.objectContaining({ displayPath: expect.any(String) })
    );
  });

  it('keeps imported 记忆空间 visible after an app restart before opening one', async () => {
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
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
    expect(screen.queryByRole('heading', { name: '今天想记录些什么？' })).not.toBeInTheDocument();
    expect(reoWorkspace.openWorkspace).not.toHaveBeenCalled();
  });

  it('renames an imported memory space from the sidebar more menu', async () => {
    const user = userEvent.setup();
    reoWorkspace.listMemorySpaces
      .mockResolvedValueOnce({
        ok: true,
        value: {
          memorySpaces: [
            {
              workspaceId: 'ws_imported',
              title: 'Runtime validated memory',
              description: 'Final runtime validation workspace.',
              addedAt: '2026-05-08T07:48:00.000Z',
              lastOpenedAt: '2026-05-08T07:48:00.000Z',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          memorySpaces: [
            {
              workspaceId: 'ws_imported',
              title: '测试工作区1',
              description: 'Final runtime validation workspace.',
              addedAt: '2026-05-08T07:48:00.000Z',
              lastOpenedAt: '2026-05-08T07:48:00.000Z',
            },
          ],
        },
      });
    reoWorkspace.updateMemorySpaceTitle.mockResolvedValue({
      ok: true,
      value: {
        workspaceId: 'ws_imported',
        title: '测试工作区1',
        description: 'Final runtime validation workspace.',
        memories: [],
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
    await user.click(screen.getByRole('button', { name: 'Runtime validated memory 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '重命名' }));

    const dialog = screen.getByRole('dialog', { name: '重命名记忆空间' });
    const titleInput = within(dialog).getByLabelText('记忆空间名称');
    expect(titleInput).toHaveValue('Runtime validated memory');
    await user.clear(titleInput);
    await user.type(titleInput, '测试工作区1');
    await user.click(within(dialog).getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(reoWorkspace.updateMemorySpaceTitle).toHaveBeenCalledWith({
        workspaceId: 'ws_imported',
        title: '测试工作区1',
      })
    );
    expect(await screen.findByRole('button', { name: '测试工作区1' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '重命名记忆空间' })).not.toBeInTheDocument();
  });

  it('removes a persisted workspace from the sidebar list after confirmation without deleting its folder', async () => {
    const user = userEvent.setup();
    reoWorkspace.listMemorySpaces
      .mockResolvedValueOnce({
        ok: true,
        value: {
          memorySpaces: [
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
      .mockResolvedValueOnce({ ok: true, value: { memorySpaces: [] } });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    expect(await screen.findByRole('button', { name: '测试1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '测试1 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '移除' }));

    const dialog = screen.getByRole('alertdialog', { name: '移除记忆空间' });
    expect(dialog).toHaveTextContent('从 Reo 的记忆空间列表中移除“测试1”？本地文件夹不会被删除。');

    await user.click(screen.getByRole('button', { name: '移除' }));

    await waitFor(() => {
      expect(reoWorkspace.removeMemorySpace).toHaveBeenCalledWith({
        workspaceId: 'ws_test_1',
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '测试1' })).not.toBeInTheDocument();
    });
    expect(await screen.findByText('已移除记忆空间')).toBeInTheDocument();
  });

  it('runs memory-space sidebar path bridge actions from the More menu', async () => {
    const user = userEvent.setup();
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
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

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    expect(await screen.findByRole('button', { name: '测试1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '测试1 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '用默认应用打开' }));
    expect(reoWorkspace.openMemorySpaceAgentsFile).toHaveBeenCalledWith({
      workspaceId: 'ws_test_1',
    });

    await user.click(screen.getByRole('button', { name: '测试1 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '在访达中显示' }));
    expect(reoWorkspace.revealMemorySpaceInFinder).toHaveBeenCalledWith({
      workspaceId: 'ws_test_1',
    });

    await user.click(screen.getByRole('button', { name: '测试1 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '复制绝对路径' }));
    expect(reoWorkspace.copyMemorySpaceAbsolutePath).toHaveBeenCalledWith({
      workspaceId: 'ws_test_1',
    });
  });

  it('shows only toast feedback when removing a persisted workspace fails', async () => {
    const user = userEvent.setup();
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
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
    reoWorkspace.removeMemorySpace.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_WRITE_FAILED',
        message: 'Workspace memory space registry could not be written',
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    expect(await screen.findByRole('button', { name: '测试1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '测试1 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '移除' }));
    await user.click(screen.getByRole('button', { name: '移除' }));

    expect(await screen.findByText('无法移除记忆空间')).toBeInTheDocument();
    const dialog = screen.getByRole('alertdialog', { name: '移除记忆空间' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).queryByText('无法保存记忆空间列表。')).not.toBeInTheDocument();
  });

  it('opens a persisted 记忆空间 from the sidebar without exposing a raw path', async () => {
    const user = userEvent.setup();
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
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
    reoWorkspace.openMemorySpace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-imported',
        workspaceId: 'ws_imported',
        snapshot: {
          workspaceId: 'ws_imported',
          title: 'Runtime validated memory',
          description: 'Final runtime validation workspace.',
          memories: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(await screen.findByRole('button', { name: 'Runtime validated memory' }));

    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();
    expect(reoWorkspace.openMemorySpace).toHaveBeenCalledWith({
      workspaceId: 'ws_imported',
    });
    expect(reoWorkspace.openMemorySpace).not.toHaveBeenCalledWith(
      expect.objectContaining({ rootPath: expect.any(String) })
    );
  });

  it('removes the current workspace memory space entry and then closes the active workspace', async () => {
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
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Daily memory 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '移除' }));
    await user.click(screen.getByRole('button', { name: '移除' }));

    await waitFor(() => {
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      });
    });
    expect(reoWorkspace.removeMemorySpace).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
    });
    expect(screen.queryByRole('heading', { name: '今天想记录些什么？' })).not.toBeInTheDocument();
    expect(await screen.findByText('已移除记忆空间')).toBeInTheDocument();
  });

  it('removes the current workspace memory space entry even when closing the active workspace fails', async () => {
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
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Daily memory 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '移除' }));
    await user.click(screen.getByRole('button', { name: '移除' }));

    expect(reoWorkspace.removeMemorySpace).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
    });
    expect(await screen.findByText('已移除记忆空间')).toBeInTheDocument();
    expect(screen.getByText('无法获取记忆空间锁。')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '今天想记录些什么？' })).not.toBeInTheDocument();
  });

  it('releases the previous workspace handle when switching to a persisted memory space', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
          {
            workspaceId: 'ws_memory_space_two',
            title: 'Memory Space two',
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
        },
      },
    });
    reoWorkspace.openMemorySpace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-2',
        workspaceId: 'ws_memory_space_two',
        snapshot: {
          workspaceId: 'ws_memory_space_two',
          title: 'Memory Space two',
          description: '',
          memories: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Memory Space two' }));

    await waitFor(() => {
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      });
    });
    expect(screen.getAllByText('Memory Space two').length).toBeGreaterThan(0);
  });

  it('blocks workspace switching while a recording flow is open', async () => {
    const user = userEvent.setup();
    reoWorkspace.chooseDirectory.mockResolvedValue({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: 'selection-token-1',
        displayPath: 'Memory',
      },
    });
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
          {
            workspaceId: 'ws_memory_space_two',
            title: 'Memory Space two',
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
          memories: [
            {
              memoryId: 'mem_existing',
              title: 'Existing memory',
              createdAt: '2026-05-07T14:30:00.000Z',
              updatedAt: '2026-05-07T14:30:00.000Z',
              segmentCount: 1,
              durationMs: 1,
              audioByteLength: 1,
              hasTranscript: false,
              supplementCount: 0,
            },
          ],
        },
      },
    });
    reoWorkspace.openMemorySpace.mockResolvedValue({
      ok: true,
      value: {
        workspaceHandle: 'workspace-handle-2',
        workspaceId: 'ws_memory_space_two',
        snapshot: {
          workspaceId: 'ws_memory_space_two',
          title: 'Memory Space two',
          description: '',
          memories: [],
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await findTitlebarMemoryControl('Existing memory');
    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));
    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '设置', hidden: true }));

    expect(await screen.findByText('当前录音尚未完成，请先完成或关闭录音。')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '语音设置' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Memory Space two', hidden: true }));

    expect(await screen.findByText('当前录音尚未完成，请先完成或关闭录音。')).toBeInTheDocument();
    expect(reoWorkspace.openMemorySpace).not.toHaveBeenCalled();
    expect(reoWorkspace.closeWorkspace).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();
    expect(getTitlebarMemoryControl('Existing memory')).toBeInTheDocument();
  });

  it('blocks native window unload while recording is busy', async () => {
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
              memoryId: 'mem_existing',
              title: 'Existing memory',
              createdAt: '2026-05-07T14:30:00.000Z',
              updatedAt: '2026-05-07T14:30:00.000Z',
              segmentCount: 1,
              durationMs: 1,
              audioByteLength: 1,
              hasTranscript: false,
              supplementCount: 0,
            },
          ],
        },
      },
    });
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, segmentId: 'seg_1' },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await findTitlebarMemoryControl('Existing memory');
    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));

    const readyUnload = new Event('beforeunload', { cancelable: true });
    expect(window.dispatchEvent(readyUnload)).toBe(true);
    expect(readyUnload.defaultPrevented).toBe(false);

    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await screen.findByRole('button', { name: '停止录音' });

    const recordingUnload = new Event('beforeunload', { cancelable: true });
    expect(window.dispatchEvent(recordingUnload)).toBe(false);
    expect(recordingUnload.defaultPrevented).toBe(true);
  });

  it('shows toast feedback when opening a persisted memory space rejects', async () => {
    const user = userEvent.setup();
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
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
    reoWorkspace.openMemorySpace.mockRejectedValue(new Error('IPC failed'));

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await user.click(await screen.findByRole('button', { name: 'Runtime validated memory' }));

    expect(await screen.findByText('无法打开记忆空间。')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a missing-folder toast when a deleted persisted memory space is opened', async () => {
    const user = userEvent.setup();
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
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
    reoWorkspace.openMemorySpace.mockResolvedValue({
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

    expect(await screen.findByText('记忆空间文件夹已不存在。')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deleted workspace' })).toBeInTheDocument();
  });

  it('shows open-local workspace errors as toasts from the starter shell', async () => {
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

    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));
    await user.click(screen.getByRole('menuitem', { name: '打开本地记忆空间' }));

    expect(await screen.findByText('该文件夹不是有效的 Reo 记忆空间。')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '创建本地记忆空间' })).not.toBeInTheDocument();
  });

  it('shows open-local workspace errors as toasts without losing the current workspace', async () => {
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
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));
    await user.click(screen.getByRole('menuitem', { name: '打开本地记忆空间' }));

    expect(await screen.findByText('该记忆空间已在其他窗口打开。')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();
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
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));
    await user.click(screen.getByRole('menuitem', { name: '打开本地记忆空间' }));

    await waitFor(() => {
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      });
    });
    expect(screen.getAllByText('Other memory').length).toBeGreaterThan(0);
  });

  it('selects a saved memory from MemoryRail as the current workspace stage context', async () => {
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
              segmentCount: 1,
              durationMs: 135_000,
              audioByteLength: 4096,
              hasTranscript: true,
              supplementCount: 0,
            },
          ],
        },
      },
    });
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await expandMemoryRail(user);
    await user.click(await screen.findByRole('button', { name: '选择记忆 My seventh birthday' }));

    expect(
      await within(screen.getByRole('banner', { name: '标题栏' })).findByRole('button', {
        name: 'My seventh birthday 记忆操作',
      })
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My seventh birthday' })).not.toBeInTheDocument();
    expect(screen.queryByText('1 个片段 · 02:15')).not.toBeInTheDocument();
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
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '首页' }));

    await waitFor(() => {
      expect(reoWorkspace.closeWorkspace).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
      });
    });
    expect(screen.queryByRole('heading', { name: '今天想记录些什么？' })).not.toBeInTheDocument();
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
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '资料库' }));

    expect(await screen.findByText('无法获取记忆空间锁。')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '资料库' })).not.toBeInTheDocument();
  });

  it('keeps the current memory context when selecting the active workspace from the sidebar', async () => {
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
              segmentCount: 1,
              durationMs: 135_000,
              audioByteLength: 4096,
              hasTranscript: true,
              supplementCount: 0,
            },
          ],
        },
      },
    });
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await expandMemoryRail(user);
    await user.click(await screen.findByRole('button', { name: '选择记忆 My seventh birthday' }));

    expect(await findTitlebarMemoryControl('My seventh birthday')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Daily memory' }));

    expect(getTitlebarMemoryControl('My seventh birthday')).toBeInTheDocument();
  });

  it('finalizes a FAB recording against the current selected memory without creating a new memory', async () => {
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
              segmentCount: 1,
              durationMs: 135_000,
              audioByteLength: 4096,
              hasTranscript: true,
              supplementCount: 0,
            },
          ],
        },
      },
    });
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, segmentId: 'seg_2' },
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
          segmentCount: 2,
          durationMs: 136_200,
          audioByteLength: 4097,
          hasTranscript: true,
          supplementCount: 0,
        },
        segment: audioSegmentProjection({
          audioByteLength: 1,
          createdAt: '2026-04-12T09:15:00.000Z',
          durationMs: 1200,
          memoryId: 'mem_birthday',
          segmentId: 'seg_2',
          title: 'Birthday followup',
          updatedAt: '2026-04-12T09:15:00.000Z',
        }),
      },
    });
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await findTitlebarMemoryControl('My seventh birthday');
    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));
    expect(screen.queryByRole('dialog', { name: '新建记忆' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await screen.findByRole('button', { name: '停止录音' });
    await user.click(screen.getByRole('button', { name: '停止录音' }));
    await screen.findByText(/录音时间较短/);
    await user.click(screen.getByRole('button', { name: '停止录音' }));

    await waitFor(() =>
      expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          memoryId: 'mem_birthday',
          segmentId: 'seg_2',
          workspaceHandle: 'workspace-handle-1',
        })
      )
    );
    expect(reoWorkspace.createMemory).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('projects a finalized FAB recording into the active Memory detail and focuses the new Segment', async () => {
    const user = userEvent.setup();
    installRecordingBrowserMocks();
    const birthdayMemory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-04-12T09:00:00.000Z',
      updatedAt: '2026-04-12T09:10:00.000Z',
      segmentCount: 1,
      durationMs: 135_000,
      audioByteLength: 4096,
      hasTranscript: true,
      supplementCount: 0,
    };
    const existingSegment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      type: 'audio' as const,
      title: 'Birthday candles',
      createdAt: '2026-04-12T09:00:00.000Z',
      updatedAt: '2026-04-12T09:10:00.000Z',
      durationMs: 135_000,
      audioByteLength: 4096,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
    const finalizedSegment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_2',
      type: 'audio' as const,
      title: 'Birthday followup',
      createdAt: '2026-04-12T09:15:00.000Z',
      updatedAt: '2026-04-12T09:15:00.000Z',
      durationMs: 1200,
      audioByteLength: 1,
      transcript: { exists: false },
      supplementCount: 0,
      supplements: [],
    };

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
          memories: [birthdayMemory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...birthdayMemory,
          workspaceId: 'ws_1',
          segments: [existingSegment],
        },
      },
    }));
    reoWorkspace.readFinalizedAudioSegment.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: 'ws_1',
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        transcript: { exists: false, text: '' },
      },
    }));
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, segmentId: 'seg_2' },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...birthdayMemory,
          updatedAt: '2026-04-12T09:15:00.000Z',
          segmentCount: 2,
          durationMs: 136_200,
          audioByteLength: 4097,
        },
        segment: finalizedSegment,
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(
      await screen.findByRole('button', { name: '选择片段 Birthday candles' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));
    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await screen.findByRole('button', { name: '停止录音' });
    await user.click(screen.getByRole('button', { name: '停止录音' }));
    await screen.findByText(/录音时间较短/);
    await user.click(screen.getByRole('button', { name: '停止录音' }));

    const finalizedSegmentButton = await screen.findByRole('button', {
      name: '选择片段 Birthday followup',
    });
    expect(finalizedSegmentButton).toHaveAttribute('aria-current', 'true');
    expect(reoWorkspace.readMemoryDetail).toHaveBeenCalledTimes(1);
  }, 10_000);

  it('finalizes a SegmentSupplement recording from the selected Segment plus menu', async () => {
    const user = userEvent.setup();
    installRecordingBrowserMocks();
    const birthdayMemory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-04-12T09:00:00.000Z',
      updatedAt: '2026-04-12T09:10:00.000Z',
      segmentCount: 1,
      durationMs: 135_000,
      audioByteLength: 4096,
      hasTranscript: true,
      supplementCount: 0,
    };
    const parentSegment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      type: 'audio' as const,
      title: 'Birthday candles',
      createdAt: '2026-04-12T09:00:00.000Z',
      updatedAt: '2026-04-12T09:10:00.000Z',
      durationMs: 135_000,
      audioByteLength: 4096,
      transcript: { exists: true },
      supplementCount: 0,
    };
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
          memories: [birthdayMemory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...birthdayMemory,
          workspaceId: 'ws_1',
          segments: [parentSegment],
        },
      },
    }));
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.createSegmentSupplementRecordingDraft.mockResolvedValue({
      ok: true,
      value: { supplementId: 'sup_birthday_followup', nextSequence: 0 },
    });
    reoWorkspace.appendSegmentSupplementRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.finalizeSegmentSupplementRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...birthdayMemory,
          updatedAt: '2026-04-12T09:15:00.000Z',
          supplementCount: 1,
        },
        segment: {
          ...parentSegment,
          updatedAt: '2026-04-12T09:15:00.000Z',
          supplementCount: 1,
        },
        supplement: {
          workspaceId: 'ws_1',
          memoryId: 'mem_birthday',
          segmentId: 'seg_birthday_voice',
          supplementId: 'sup_birthday_followup',
          type: 'audio',
          title: '补充录音',
          createdAt: '2026-04-12T09:15:00.000Z',
          updatedAt: '2026-04-12T09:15:00.000Z',
          durationMs: 1200,
          audioByteLength: 1,
          lastTranscriptionAttempt: 'never' as const,
          transcript: { exists: false },
        },
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await findTitlebarMemoryControl('My seventh birthday');
    await user.click(await screen.findByRole('button', { name: '添加片段补充内容' }));
    await user.click(await screen.findByRole('menuitem', { name: '录音补充' }));

    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await screen.findByRole('button', { name: '停止录音' });
    await user.click(screen.getByRole('button', { name: '停止录音' }));
    await screen.findByText(/录音时间较短/);
    await user.click(screen.getByRole('button', { name: '停止录音' }));

    await waitFor(() =>
      expect(reoWorkspace.finalizeSegmentSupplementRecordingDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceHandle: 'workspace-handle-1',
          workspaceId: 'ws_1',
          memoryId: 'mem_birthday',
          segmentId: 'seg_birthday_voice',
          supplementId: 'sup_birthday_followup',
        })
      )
    );
    expect(reoWorkspace.createRecordingDraft).not.toHaveBeenCalled();
    expect(reoWorkspace.finalizeRecordingDraft).not.toHaveBeenCalled();
    expect(reoWorkspace.createMemory).not.toHaveBeenCalled();
  });

  it('refreshes an active SegmentSupplement panel after its transcript is saved', async () => {
    const user = userEvent.setup();
    installRecordingBrowserMocks();
    let transcriptionListener: Parameters<
      Window['reoWorkspace']['onRecordingTranscriptionEvent']
    >[0] = () => {};
    const birthdayMemory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-04-12T09:00:00.000Z',
      updatedAt: '2026-04-12T09:10:00.000Z',
      segmentCount: 1,
      durationMs: 135_000,
      audioByteLength: 4096,
      hasTranscript: true,
      supplementCount: 0,
    };
    const parentSegment = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      type: 'audio' as const,
      title: 'Birthday candles',
      createdAt: '2026-04-12T09:00:00.000Z',
      updatedAt: '2026-04-12T09:10:00.000Z',
      durationMs: 135_000,
      audioByteLength: 4096,
      transcript: { exists: true },
      supplementCount: 0,
      supplements: [],
    };
    const supplementWithoutTranscript = {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      supplementId: 'sup_birthday_followup',
      type: 'audio' as const,
      title: '补充录音',
      createdAt: '2026-04-12T09:15:00.000Z',
      updatedAt: '2026-04-12T09:15:00.000Z',
      durationMs: 1200,
      audioByteLength: 1,
      transcript: { exists: false },
    };
    const segmentWithSupplementWithoutTranscript = {
      ...parentSegment,
      updatedAt: '2026-04-12T09:15:00.000Z',
      supplementCount: 1,
      supplements: [supplementWithoutTranscript],
    };
    const supplementWithTranscript = {
      ...supplementWithoutTranscript,
      transcript: { exists: true },
    };
    const segmentWithSupplementTranscript = {
      ...segmentWithSupplementWithoutTranscript,
      supplements: [supplementWithTranscript],
    };
    const saveDeferred =
      createDeferred<Awaited<ReturnType<typeof reoWorkspace.saveSegmentSupplementTranscript>>>();
    const finalTranscriptSegment = {
      endTimeMs: 1100,
      isFinal: true,
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      startTimeMs: 100,
      text: '现场补充转写',
    };
    let transcriptReadReady = false;

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
          memories: [birthdayMemory],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        detail: {
          ...birthdayMemory,
          workspaceId: 'ws_1',
          segments: [parentSegment],
        },
      },
    }));
    reoWorkspace.readFinalizedAudioSegmentSupplement.mockImplementation(async (payload) => ({
      ok: true,
      value: {
        requestId: payload.requestId,
        workspaceId: 'ws_1',
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        supplementId: payload.supplementId,
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        transcript: transcriptReadReady
          ? { exists: true, text: '现场补充转写' }
          : { exists: false, text: '' },
      },
    }));
    reoWorkspace.onRecordingTranscriptionEvent.mockImplementation((listener) => {
      transcriptionListener = listener;
      return () => {};
    });
    reoWorkspace.finishRecordingTranscription.mockResolvedValue({
      ok: true,
      value: {
        accepted: true,
        segments: [finalTranscriptSegment],
      },
    });
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.createSegmentSupplementRecordingDraft.mockResolvedValue({
      ok: true,
      value: { supplementId: 'sup_birthday_followup', nextSequence: 0 },
    });
    reoWorkspace.appendSegmentSupplementRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.finalizeSegmentSupplementRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...birthdayMemory,
          updatedAt: '2026-04-12T09:15:00.000Z',
          supplementCount: 1,
        },
        segment: segmentWithSupplementWithoutTranscript,
        supplement: supplementWithoutTranscript,
      },
    });
    reoWorkspace.saveSegmentSupplementTranscript.mockReturnValue(saveDeferred.promise);

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await findTitlebarMemoryControl('My seventh birthday');
    await user.click(await screen.findByRole('button', { name: '添加片段补充内容' }));
    await user.click(await screen.findByRole('menuitem', { name: '录音补充' }));
    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await screen.findByRole('button', { name: '停止录音' });
    act(() =>
      transcriptionListener({
        kind: 'segments',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        segments: [finalTranscriptSegment],
      })
    );
    await user.click(screen.getByRole('button', { name: '停止录音' }));
    await screen.findByText(/录音时间较短/);
    await user.click(screen.getByRole('button', { name: '停止录音' }));

    expect(await screen.findByText('这段补充录音还没有转录。')).toBeInTheDocument();
    await waitFor(() =>
      expect(reoWorkspace.saveSegmentSupplementTranscript).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-1',
        workspaceId: 'ws_1',
        memoryId: 'mem_birthday',
        segmentId: 'seg_birthday_voice',
        supplementId: 'sup_birthday_followup',
        markdown: '现场补充转写',
      })
    );

    transcriptReadReady = true;
    await act(async () => {
      saveDeferred.resolve({
        ok: true,
        value: {
          memory: {
            ...birthdayMemory,
            updatedAt: '2026-04-12T09:15:00.000Z',
            supplementCount: 1,
          },
          segment: segmentWithSupplementTranscript,
          supplement: supplementWithTranscript,
          saved: true,
        },
      });
      await saveDeferred.promise;
    });

    expect(await screen.findByText('现场补充转写')).toBeInTheDocument();
  }, 10_000);

  it('opens the recording overlay from the current memory stage FAB', async () => {
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
              segmentCount: 1,
              durationMs: 135_000,
              audioByteLength: 4096,
              hasTranscript: true,
              supplementCount: 0,
            },
          ],
        },
      },
    });
    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await findTitlebarMemoryControl('My seventh birthday');
    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));

    expect(screen.getByRole('dialog', { name: '录音' })).toBeInTheDocument();
  });

  it('records into the selected Memory after switching the quiet stage context', async () => {
    const user = userEvent.setup();
    installRecordingBrowserMocks();
    const birthdayMemory = {
      memoryId: 'mem_birthday',
      title: 'My seventh birthday',
      createdAt: '2026-04-12T09:00:00.000Z',
      updatedAt: '2026-04-12T09:10:00.000Z',
      segmentCount: 1,
      durationMs: 135_000,
      audioByteLength: 4096,
      hasTranscript: true,
      supplementCount: 0,
    };
    const morningMemory = {
      memoryId: 'mem_morning',
      title: 'Morning note',
      createdAt: '2026-05-07T06:40:00.000Z',
      updatedAt: '2026-05-07T06:42:00.000Z',
      segmentCount: 1,
      durationMs: 12_000,
      audioByteLength: 1024,
      hasTranscript: false,
      supplementCount: 0,
    };
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
          memories: [birthdayMemory, morningMemory],
        },
      },
    });
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { nextSequence: 0, segmentId: 'seg_selected_memory' },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          ...morningMemory,
          segmentCount: 2,
          durationMs: 13_200,
          audioByteLength: 1025,
          updatedAt: '2026-05-07T06:43:00.000Z',
        },
        segment: audioSegmentProjection({
          audioByteLength: 1,
          createdAt: '2026-05-07T06:43:00.000Z',
          durationMs: 1200,
          memoryId: 'mem_morning',
          segmentId: 'seg_selected_memory',
          title: 'Morning followup',
          updatedAt: '2026-05-07T06:43:00.000Z',
        }),
      },
    });

    render(
      <ReoQueryProvider>
        <App />
      </ReoQueryProvider>
    );

    await openCreateWorkspaceDialog(user);
    await user.type(screen.getByLabelText('记忆空间名称'), 'Daily memory');
    await user.click(screen.getByRole('button', { name: '浏览' }));
    await screen.findByText('Memory');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await expandMemoryRail(user);
    await user.click(await screen.findByRole('button', { name: '选择记忆 Morning note' }));
    expect(await findTitlebarMemoryControl('Morning note')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开表达入口' }));
    await user.click(screen.getByRole('menuitem', { name: '录音' }));
    expect(screen.queryByRole('dialog', { name: '新建记忆' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开始录音' }));
    await screen.findByRole('button', { name: '停止录音' });
    await user.click(screen.getByRole('button', { name: '停止录音' }));
    await screen.findByText(/录音时间较短/);
    await user.click(screen.getByRole('button', { name: '停止录音' }));

    await waitFor(() =>
      expect(reoWorkspace.finalizeRecordingDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          memoryId: 'mem_morning',
          segmentId: 'seg_selected_memory',
          workspaceHandle: 'workspace-handle-1',
        })
      )
    );
    expect(reoWorkspace.createMemory).not.toHaveBeenCalled();
  });

  it('keeps memory projection fresh after finalize', () => {
    const session = {
      workspaceHandle: 'workspace-handle-1',
      workspaceId: 'ws_1',
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Daily memory',
        description: '',
        memories: [],
      },
    };

    expect(
      mergeMemoryIntoSession(session, {
        audioByteLength: 3,
        createdAt: '2026-05-06T13:08:00.000Z',
        durationMs: 2000,
        supplementCount: 0,
        hasTranscript: false,
        memoryId: 'mem_1',
        segmentCount: 1,
        title: 'Daily memory recording',
        updatedAt: '2026-05-06T13:09:00.000Z',
      }).snapshot
    ).toMatchObject({
      memories: [{ memoryId: 'mem_1', segmentCount: 1 }],
    });
  });

  it('keeps unchanged activity order when merging a renamed memory projection', () => {
    const olderMemory = {
      audioByteLength: 3,
      createdAt: '2026-05-06T13:08:00.000Z',
      durationMs: 2000,
      supplementCount: 0,
      hasTranscript: false,
      memoryId: 'mem_older',
      segmentCount: 1,
      title: 'Older',
      updatedAt: '2026-05-06T13:09:00.000Z',
    };
    const newerMemory = {
      ...olderMemory,
      memoryId: 'mem_newer',
      title: 'Newer',
      updatedAt: '2026-05-06T13:12:00.000Z',
    };
    const session = {
      workspaceHandle: 'workspace-handle-1',
      workspaceId: 'ws_1',
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Daily memory',
        description: '',
        memories: [newerMemory, olderMemory],
      },
    };

    expect(
      mergeMemoryIntoSession(session, {
        ...olderMemory,
        title: 'Renamed older',
      }).snapshot.memories.map((memory) => memory.memoryId)
    ).toEqual(['mem_newer', 'mem_older']);
  });
});

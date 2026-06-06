import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendRecordingAudioChunk,
  beginMicrophoneIntent,
  chooseWorkspaceDirectory,
  clearMicrophoneIntent,
  cloneRecordingDraftPrefix,
  closeWorkspace,
  copyArtifactAgentPrompt,
  copyMemoryAbsolutePath,
  copyMemoryRelativePath,
  copyMemorySpaceAbsolutePath,
  copySegmentAbsolutePath,
  copySegmentRelativePath,
  copySegmentSupplementAbsolutePath,
  copySegmentSupplementRelativePath,
  copyWidgetAbsolutePath,
  copyWidgetAgentPrompt,
  copyWidgetRelativePath,
  createMemory,
  createNoteSegmentDraft,
  createSegmentSupplementNoteDraft,
  deleteWidget,
  deleteMemory,
  deleteSegmentSupplement,
  deleteSegment,
  createRecordingDraft,
  createSegmentSupplementRecordingDraft,
  discardRecordingDraft,
  discardSegmentSupplementRecordingDraft,
  finalizeRecordingDraft,
  finalizeNoteSegmentDraft,
  finalizeSegmentSupplementNoteDraft,
  finalizeSegmentSupplementRecordingDraft,
  initializeWorkspace,
  listMemorySpaces,
  openMarkdownExternalLink,
  openWidgetDocument,
  openMemoryDocument,
  openMemorySpaceAgentsFile,
  openVoiceTranscriptionProviderConsole,
  openSegmentDocument,
  openSegmentSupplementDocument,
  openWorkspace,
  openMemorySpace,
  readFinalizedAudioSegment,
  readFinalizedAudioSegmentAudio,
  readFinalizedAudioSegmentSupplement,
  readFinalizedAudioSegmentSupplementAudio,
  readArtifactRuntimeState,
  readMemoryDetail,
  readSegmentContent,
  readSegmentSupplementContent,
  readWorkspaceSnapshot,
  readRecordingDraftAudio,
  regenerateImportedSpeechSynthesis,
  removeMemorySpace,
  requestSegmentSpeechSynthesis,
  requestSegmentSupplementSpeechSynthesis,
  requestSegmentSupplementTranscriptionBackfill,
  requestSegmentTranscriptionBackfill,
  revealMemoryInFinder,
  revealMemorySpaceInFinder,
  revealSegmentInFinder,
  revealSegmentSupplementInFinder,
  revealWidgetInFinder,
  restoreDeletedWidget,
  restoreDeletedMemory,
  restoreDeletedSegmentSupplement,
  restoreDeletedSegment,
  saveTranscript,
  setVoiceSpeechSynthesisSpeaker,
  updateWidgetTabOrder,
  updateWidgetTitle,
  updateMemorySpaceTitle,
  updateMemoryTitle,
  updateSegmentContentTabOrder,
  updateSegmentSupplementTitle,
  appendSegmentSupplementRecordingAudioChunk,
  writeArtifactRuntimeState,
  writeNoteSegmentDraftBody,
  writeSegmentContent,
  writeSegmentSupplementContent,
  writeSegmentSupplementNoteDraftBody,
} from './workspaceApi';

describe('workspace renderer API wrapper', () => {
  const reoWorkspace = {
    chooseDirectory: vi.fn(),
    listMemorySpaces: vi.fn(),
    initializeWorkspace: vi.fn(),
    openWorkspace: vi.fn(),
    openMemorySpace: vi.fn(),
    removeMemorySpace: vi.fn(),
    revealMemorySpaceInFinder: vi.fn(),
    revealMemoryInFinder: vi.fn(),
    revealSegmentInFinder: vi.fn(),
    revealSegmentSupplementInFinder: vi.fn(),
    revealWidgetInFinder: vi.fn(),
    openMemorySpaceAgentsFile: vi.fn(),
    openMemoryDocument: vi.fn(),
    openSegmentDocument: vi.fn(),
    openSegmentSupplementDocument: vi.fn(),
    openWidgetDocument: vi.fn(),
    openVoiceTranscriptionProviderConsole: vi.fn(),
    openMarkdownExternalLink: vi.fn(),
    copyMemorySpaceAbsolutePath: vi.fn(),
    copyMemoryAbsolutePath: vi.fn(),
    copySegmentAbsolutePath: vi.fn(),
    copySegmentSupplementAbsolutePath: vi.fn(),
    copyWidgetAbsolutePath: vi.fn(),
    copyMemoryRelativePath: vi.fn(),
    copySegmentRelativePath: vi.fn(),
    copySegmentSupplementRelativePath: vi.fn(),
    copyWidgetRelativePath: vi.fn(),
    copyArtifactAgentPrompt: vi.fn(),
    copyWidgetAgentPrompt: vi.fn(),
    readArtifactRuntimeState: vi.fn(),
    writeArtifactRuntimeState: vi.fn(),
    closeWorkspace: vi.fn(),
    readWorkspaceSnapshot: vi.fn(),
    createMemory: vi.fn(),
    updateWidgetTitle: vi.fn(),
    updateWidgetTabOrder: vi.fn(),
    deleteWidget: vi.fn(),
    restoreDeletedWidget: vi.fn(),
    deleteMemory: vi.fn(),
    restoreDeletedMemory: vi.fn(),
    deleteSegment: vi.fn(),
    restoreDeletedSegment: vi.fn(),
    deleteSegmentSupplement: vi.fn(),
    restoreDeletedSegmentSupplement: vi.fn(),
    readMemoryDetail: vi.fn(),
    readFinalizedAudioSegment: vi.fn(),
    readFinalizedAudioSegmentSupplement: vi.fn(),
    readFinalizedAudioSegmentAudio: vi.fn(),
    readFinalizedAudioSegmentSupplementAudio: vi.fn(),
    createNoteSegmentDraft: vi.fn(),
    createSegmentSupplementNoteDraft: vi.fn(),
    writeNoteSegmentDraftBody: vi.fn(),
    writeSegmentSupplementNoteDraftBody: vi.fn(),
    finalizeNoteSegmentDraft: vi.fn(),
    finalizeSegmentSupplementNoteDraft: vi.fn(),
    readSegmentContent: vi.fn(),
    readSegmentSupplementContent: vi.fn(),
    writeSegmentContent: vi.fn(),
    writeSegmentSupplementContent: vi.fn(),
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
    updateMemoryTitle: vi.fn(),
    updateSegmentTitle: vi.fn(),
    updateSegmentContentTitle: vi.fn(),
    updateSegmentContentTabOrder: vi.fn(),
    updateSegmentSupplementTitle: vi.fn(),
    saveTranscript: vi.fn(),
    requestSegmentTranscriptionBackfill: vi.fn(),
    requestSegmentSupplementTranscriptionBackfill: vi.fn(),
    requestSegmentSpeechSynthesis: vi.fn(),
    requestSegmentSupplementSpeechSynthesis: vi.fn(),
    regenerateImportedSpeechSynthesis: vi.fn(),
    setVoiceSpeechSynthesisSpeaker: vi.fn(),
    beginMicrophoneIntent: vi.fn(),
    clearMicrophoneIntent: vi.fn(),
  };

  const workspaceWidget = {
    workspaceId: 'ws_1',
    widgetId: 'wdg_1',
    type: 'widget' as const,
    format: 'html' as const,
    mount: 'workspace-rail' as const,
    title: 'Workspace 总览',
    createdAt: '2026-06-05T12:00:00.000Z',
    updatedAt: '2026-06-05T12:00:00.000Z',
    icon: { source: 'default' as const },
    entryByteLength: 12,
    entryHash: 'a'.repeat(64),
    previewVersion: 'b'.repeat(64),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(window, 'reoWorkspace', {
      configurable: true,
      value: reoWorkspace,
    });
  });

  it('forwards entity shell actions to the explicit preload surface', async () => {
    const okResponse = { ok: true, value: { completed: true } };
    for (const action of [
      reoWorkspace.revealMemorySpaceInFinder,
      reoWorkspace.revealMemoryInFinder,
      reoWorkspace.revealSegmentInFinder,
      reoWorkspace.revealSegmentSupplementInFinder,
      reoWorkspace.revealWidgetInFinder,
      reoWorkspace.openMemorySpaceAgentsFile,
      reoWorkspace.openMemoryDocument,
      reoWorkspace.openSegmentDocument,
      reoWorkspace.openSegmentSupplementDocument,
      reoWorkspace.openWidgetDocument,
      reoWorkspace.copyMemorySpaceAbsolutePath,
      reoWorkspace.copyMemoryAbsolutePath,
      reoWorkspace.copySegmentAbsolutePath,
      reoWorkspace.copySegmentSupplementAbsolutePath,
      reoWorkspace.copyWidgetAbsolutePath,
      reoWorkspace.copyMemoryRelativePath,
      reoWorkspace.copySegmentRelativePath,
      reoWorkspace.copySegmentSupplementRelativePath,
      reoWorkspace.copyWidgetRelativePath,
      reoWorkspace.copyArtifactAgentPrompt,
      reoWorkspace.copyWidgetAgentPrompt,
    ]) {
      action.mockResolvedValue(okResponse);
    }
    reoWorkspace.openVoiceTranscriptionProviderConsole.mockResolvedValue(okResponse);
    reoWorkspace.openMarkdownExternalLink.mockResolvedValue(okResponse);

    const memorySpacePayload = { workspaceId: 'ws_1' };
    const memoryPayload = {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
    };
    const segmentPayload = {
      ...memoryPayload,
      segmentId: 'seg_1',
    };
    const supplementPayload = {
      ...segmentPayload,
      supplementId: 'sup_1',
    };
    const widgetPayload = {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      widgetId: 'wdg_1',
    };

    await revealMemorySpaceInFinder(memorySpacePayload);
    await openMemorySpaceAgentsFile(memorySpacePayload);
    await copyMemorySpaceAbsolutePath(memorySpacePayload);
    await revealMemoryInFinder(memoryPayload);
    await openMemoryDocument(memoryPayload);
    await copyMemoryAbsolutePath(memoryPayload);
    await copyMemoryRelativePath(memoryPayload);
    await revealSegmentInFinder(segmentPayload);
    await openSegmentDocument(segmentPayload);
    await copySegmentAbsolutePath(segmentPayload);
    await copySegmentRelativePath(segmentPayload);
    await revealSegmentSupplementInFinder(supplementPayload);
    await openSegmentSupplementDocument(supplementPayload);
    await copySegmentSupplementAbsolutePath(supplementPayload);
    await copySegmentSupplementRelativePath(supplementPayload);
    await revealWidgetInFinder(widgetPayload);
    await openWidgetDocument(widgetPayload);
    await copyWidgetAbsolutePath(widgetPayload);
    await copyWidgetRelativePath(widgetPayload);
    await copyArtifactAgentPrompt({
      ...segmentPayload,
      action: 'update-segment',
    });
    await copyWidgetAgentPrompt({
      ...widgetPayload,
      action: 'update-widget',
    });
    await openVoiceTranscriptionProviderConsole();
    await openMarkdownExternalLink({ url: 'https://tiptap.dev/docs' });

    expect(reoWorkspace.revealMemorySpaceInFinder).toHaveBeenCalledWith(memorySpacePayload);
    expect(reoWorkspace.openMemorySpaceAgentsFile).toHaveBeenCalledWith(memorySpacePayload);
    expect(reoWorkspace.copyMemorySpaceAbsolutePath).toHaveBeenCalledWith(memorySpacePayload);
    expect(reoWorkspace.revealMemoryInFinder).toHaveBeenCalledWith(memoryPayload);
    expect(reoWorkspace.openMemoryDocument).toHaveBeenCalledWith(memoryPayload);
    expect(reoWorkspace.copyMemoryAbsolutePath).toHaveBeenCalledWith(memoryPayload);
    expect(reoWorkspace.copyMemoryRelativePath).toHaveBeenCalledWith(memoryPayload);
    expect(reoWorkspace.revealSegmentInFinder).toHaveBeenCalledWith(segmentPayload);
    expect(reoWorkspace.openSegmentDocument).toHaveBeenCalledWith(segmentPayload);
    expect(reoWorkspace.copySegmentAbsolutePath).toHaveBeenCalledWith(segmentPayload);
    expect(reoWorkspace.copySegmentRelativePath).toHaveBeenCalledWith(segmentPayload);
    expect(reoWorkspace.revealSegmentSupplementInFinder).toHaveBeenCalledWith(supplementPayload);
    expect(reoWorkspace.openSegmentSupplementDocument).toHaveBeenCalledWith(supplementPayload);
    expect(reoWorkspace.copySegmentSupplementAbsolutePath).toHaveBeenCalledWith(supplementPayload);
    expect(reoWorkspace.copySegmentSupplementRelativePath).toHaveBeenCalledWith(supplementPayload);
    expect(reoWorkspace.revealWidgetInFinder).toHaveBeenCalledWith(widgetPayload);
    expect(reoWorkspace.openWidgetDocument).toHaveBeenCalledWith(widgetPayload);
    expect(reoWorkspace.copyWidgetAbsolutePath).toHaveBeenCalledWith(widgetPayload);
    expect(reoWorkspace.copyWidgetRelativePath).toHaveBeenCalledWith(widgetPayload);
    expect(reoWorkspace.copyArtifactAgentPrompt).toHaveBeenCalledWith({
      ...segmentPayload,
      action: 'update-segment',
    });
    expect(reoWorkspace.copyWidgetAgentPrompt).toHaveBeenCalledWith({
      ...widgetPayload,
      action: 'update-widget',
    });
    expect(reoWorkspace.openVoiceTranscriptionProviderConsole).toHaveBeenCalledWith();
    expect(reoWorkspace.openMarkdownExternalLink).toHaveBeenCalledWith({
      url: 'https://tiptap.dev/docs',
    });
  });

  it('forwards artifact runtime methods to the explicit preload surface', async () => {
    const runtimeTarget = {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      targetType: 'segment' as const,
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    };

    await readArtifactRuntimeState({ ...runtimeTarget, requestId: 'state-read-1' });
    await writeArtifactRuntimeState({
      ...runtimeTarget,
      requestId: 'state-write-1',
      baselineVersion: 'a'.repeat(64),
      state: { schemaVersion: 1, stores: { ui: {} } },
    });
    expect(reoWorkspace.readArtifactRuntimeState).toHaveBeenCalledWith({
      ...runtimeTarget,
      requestId: 'state-read-1',
    });
    expect(reoWorkspace.writeArtifactRuntimeState).toHaveBeenCalledWith({
      ...runtimeTarget,
      requestId: 'state-write-1',
      baselineVersion: 'a'.repeat(64),
      state: { schemaVersion: 1, stores: { ui: {} } },
    });
  });

  it('forwards workspace file methods to the explicit preload surface', async () => {
    reoWorkspace.chooseDirectory.mockResolvedValue({ ok: true, value: { status: 'canceled' } });
    reoWorkspace.initializeWorkspace.mockResolvedValue({
      ok: true,
      value: { workspaceId: 'ws_1' },
    });
    reoWorkspace.listMemorySpaces.mockResolvedValue({
      ok: true,
      value: {
        memorySpaces: [
          {
            workspaceId: 'ws_1',
            title: '记忆',
            description: '',
            addedAt: '2026-05-08T07:48:00.000Z',
            lastOpenedAt: '2026-05-08T07:48:00.000Z',
          },
        ],
      },
    });
    reoWorkspace.openWorkspace.mockResolvedValue({ ok: true, value: { workspaceId: 'ws_1' } });
    reoWorkspace.openMemorySpace.mockResolvedValue({
      ok: true,
      value: { workspaceId: 'ws_1' },
    });
    reoWorkspace.removeMemorySpace.mockResolvedValue({
      ok: true,
      value: { removed: true },
    });
    reoWorkspace.closeWorkspace.mockResolvedValue({ ok: true, value: { closed: true } });
    reoWorkspace.readWorkspaceSnapshot.mockResolvedValue({
      ok: true,
      value: {
        workspaceId: 'ws_1',
        title: '记忆',
        description: '',
        memories: [],
      },
    });
    reoWorkspace.createMemory.mockResolvedValue({
      ok: true,
      value: {
        memoryId: 'mem_1',
        title: '产品灵感与思考',
        createdAt: '2026-05-08T14:42:00.000Z',
        updatedAt: '2026-05-08T14:42:00.000Z',
        segmentCount: 0,
        noteSegmentCount: 0,
        artifactSegmentCount: 0,
        audioSegmentCount: 0,
        audioDurationMs: 0,
        audioByteLength: 0,
        hasAudioTranscript: false,
        hasAnyNote: false,
        supplementCount: 0,
      },
    });
    reoWorkspace.updateWidgetTitle.mockResolvedValue({
      ok: true,
      value: { widget: workspaceWidget, widgets: [workspaceWidget] },
    });
    reoWorkspace.updateWidgetTabOrder.mockResolvedValue({
      ok: true,
      value: { widgets: [workspaceWidget] },
    });
    reoWorkspace.deleteWidget.mockResolvedValue({
      ok: true,
      value: { restoreToken: 'wdg_1', widgets: [] },
    });
    reoWorkspace.restoreDeletedWidget.mockResolvedValue({
      ok: true,
      value: { widget: workspaceWidget, widgets: [workspaceWidget] },
    });
    reoWorkspace.deleteMemory.mockResolvedValue({
      ok: true,
      value: { memoryId: 'mem_1', restoreToken: 'mem_1', memories: [] },
    });
    reoWorkspace.restoreDeletedMemory.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          memoryId: 'mem_1',
          title: '产品灵感与思考',
          createdAt: '2026-05-08T14:42:00.000Z',
          updatedAt: '2026-05-08T14:42:00.000Z',
          segmentCount: 0,
          noteSegmentCount: 0,
          artifactSegmentCount: 0,
          audioSegmentCount: 0,
          audioDurationMs: 0,
          audioByteLength: 0,
          hasAudioTranscript: false,
          hasAnyNote: false,
          supplementCount: 0,
        },
        memories: [],
      },
    });
    reoWorkspace.deleteSegment.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          memoryId: 'mem_1',
          title: '产品灵感与思考',
          createdAt: '2026-05-08T14:42:00.000Z',
          updatedAt: '2026-05-08T14:42:00.000Z',
          segmentCount: 0,
          noteSegmentCount: 0,
          artifactSegmentCount: 0,
          audioSegmentCount: 0,
          audioDurationMs: 0,
          audioByteLength: 0,
          hasAudioTranscript: false,
          hasAnyNote: false,
          supplementCount: 0,
        },
        segmentId: 'seg_1',
        restoreToken: 'seg_1',
      },
    });
    reoWorkspace.restoreDeletedSegment.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          memoryId: 'mem_1',
          title: '产品灵感与思考',
          createdAt: '2026-05-08T14:42:00.000Z',
          updatedAt: '2026-05-08T14:42:00.000Z',
          segmentCount: 1,
          noteSegmentCount: 0,
          artifactSegmentCount: 0,
          audioSegmentCount: 1,
          audioDurationMs: 1,
          audioByteLength: 1,
          hasAudioTranscript: false,
          hasAnyNote: false,
          supplementCount: 0,
        },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          type: 'audio',
          title: '录音',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-06T13:08:00.000Z',
          durationMs: 1,
          audioByteLength: 1,
          transcript: { exists: false },
          supplementCount: 0,
          supplements: [],
        },
      },
    });
    reoWorkspace.readMemoryDetail.mockResolvedValue({
      ok: true,
      value: {
        requestId: 'request_mem_1',
        detail: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          title: '产品灵感与思考',
          createdAt: '2026-05-08T14:42:00.000Z',
          updatedAt: '2026-05-08T14:42:00.000Z',
          segmentCount: 0,
          noteSegmentCount: 0,
          artifactSegmentCount: 0,
          audioSegmentCount: 0,
          audioDurationMs: 0,
          audioByteLength: 0,
          hasAudioTranscript: false,
          hasAnyNote: false,
          supplementCount: 0,
          segments: [],
        },
      },
    });
    reoWorkspace.readFinalizedAudioSegment.mockResolvedValue({
      ok: true,
      value: {
        requestId: 'request_seg_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        audioByteLength: 3,
        audioHash: 'a'.repeat(64),
        transcript: { exists: true, text: '正文', baselineHash: 'a'.repeat(64) },
      },
    });
    reoWorkspace.readFinalizedAudioSegmentSupplement.mockResolvedValue({
      ok: true,
      value: {
        requestId: 'request_sup_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        supplementId: 'sup_1',
        audioByteLength: 1,
        audioHash: 'a'.repeat(64),
        transcript: { exists: false, text: '', baselineHash: 'a'.repeat(64) },
      },
    });
    reoWorkspace.readFinalizedAudioSegmentAudio.mockResolvedValue({
      ok: true,
      value: {
        requestId: 'request_seg_audio_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        audioHash: 'a'.repeat(64),
      },
    });
    reoWorkspace.readFinalizedAudioSegmentSupplementAudio.mockResolvedValue({
      ok: true,
      value: {
        requestId: 'request_sup_audio_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        supplementId: 'sup_1',
        audio: new Uint8Array([2]),
        audioByteLength: 1,
        audioHash: 'a'.repeat(64),
      },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { segmentId: 'seg_1' },
    });
    reoWorkspace.createSegmentSupplementRecordingDraft.mockResolvedValue({
      ok: true,
      value: { supplementId: 'sup_1', nextSequence: 0 },
    });
    reoWorkspace.readRecordingDraftAudio.mockResolvedValue({
      ok: true,
      value: { audio: new Uint8Array([1]), audioByteLength: 1, nextSequence: 1 },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.appendSegmentSupplementRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.cloneRecordingDraftPrefix.mockResolvedValue({
      ok: true,
      value: { audioByteLength: 1, nextSequence: 1 },
    });
    reoWorkspace.finalizeRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          audioByteLength: 1,
          createdAt: '2026-05-06T13:08:00.000Z',
          audioDurationMs: 0,
          supplementCount: 0,
          hasAudioTranscript: false,
          hasAnyNote: false,
          memoryId: 'mem_1',
          segmentCount: 1,
          noteSegmentCount: 0,
          artifactSegmentCount: 0,
          audioSegmentCount: 1,
          title: '录音',
          updatedAt: '2026-05-06T13:08:00.000Z',
        },
        segment: {
          type: 'audio' as const,
          audioByteLength: 1,
          durationMs: 0,
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          title: '录音',
        },
      },
    });
    reoWorkspace.finalizeSegmentSupplementRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          audioByteLength: 1,
          createdAt: '2026-05-06T13:08:00.000Z',
          audioDurationMs: 0,
          supplementCount: 1,
          hasAudioTranscript: false,
          hasAnyNote: false,
          memoryId: 'mem_1',
          segmentCount: 1,
          noteSegmentCount: 0,
          artifactSegmentCount: 0,
          audioSegmentCount: 1,
          title: '录音',
          updatedAt: '2026-05-06T13:08:00.000Z',
        },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          type: 'audio',
          title: '录音',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-06T13:08:00.000Z',
          durationMs: 0,
          audioByteLength: 1,
          transcript: { exists: false },
          supplementCount: 1,
          supplements: [
            {
              workspaceId: 'ws_1',
              memoryId: 'mem_1',
              segmentId: 'seg_1',
              supplementId: 'sup_1',
              type: 'audio',
              title: '补充录音',
              createdAt: '2026-05-06T13:08:00.000Z',
              updatedAt: '2026-05-06T13:08:00.000Z',
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
          type: 'audio',
          title: '补充录音',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-06T13:08:00.000Z',
          durationMs: 0,
          audioByteLength: 1,
          transcript: { exists: false },
        },
      },
    });
    reoWorkspace.discardRecordingDraft.mockResolvedValue({ ok: true, value: { discarded: true } });
    reoWorkspace.discardSegmentSupplementRecordingDraft.mockResolvedValue({
      ok: true,
      value: { discarded: true },
    });
    reoWorkspace.updateMemoryTitle.mockResolvedValue({
      ok: true,
      value: {
        memoryId: 'mem_1',
        title: '产品灵感与思考',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-08T14:42:00.000Z',
        segmentCount: 1,
        noteSegmentCount: 0,
        artifactSegmentCount: 0,
        audioSegmentCount: 1,
        audioDurationMs: 0,
        audioByteLength: 1,
        hasAudioTranscript: false,
        hasAnyNote: false,
        supplementCount: 0,
      },
    });
    reoWorkspace.updateSegmentSupplementTitle.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          memoryId: 'mem_1',
          title: '录音',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-06T13:09:00.000Z',
          segmentCount: 1,
          noteSegmentCount: 0,
          artifactSegmentCount: 0,
          audioSegmentCount: 1,
          audioDurationMs: 1000,
          audioByteLength: 1,
          hasAudioTranscript: false,
          hasAnyNote: false,
          supplementCount: 1,
        },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          type: 'audio',
          title: '录音',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-06T13:09:00.000Z',
          durationMs: 1000,
          audioByteLength: 1,
          transcript: { exists: false },
          supplementCount: 1,
          supplements: [
            {
              workspaceId: 'ws_1',
              memoryId: 'mem_1',
              segmentId: 'seg_1',
              supplementId: 'sup_1',
              type: 'audio',
              title: '现场补充',
              createdAt: '2026-05-06T13:10:00.000Z',
              updatedAt: '2026-05-06T13:10:00.000Z',
              durationMs: 1000,
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
          type: 'audio',
          title: '现场补充',
          createdAt: '2026-05-06T13:10:00.000Z',
          updatedAt: '2026-05-06T13:10:00.000Z',
          durationMs: 1000,
          audioByteLength: 1,
          transcript: { exists: false },
        },
      },
    });
    reoWorkspace.deleteSegmentSupplement.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          memoryId: 'mem_1',
          title: '录音',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-06T13:09:00.000Z',
          segmentCount: 1,
          noteSegmentCount: 0,
          artifactSegmentCount: 0,
          audioSegmentCount: 1,
          audioDurationMs: 1000,
          audioByteLength: 1,
          hasAudioTranscript: false,
          hasAnyNote: false,
          supplementCount: 0,
        },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          type: 'audio',
          title: '录音',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-06T13:09:00.000Z',
          durationMs: 1000,
          audioByteLength: 1,
          transcript: { exists: false },
          supplementCount: 0,
          supplements: [],
        },
        supplementId: 'sup_1',
        restoreToken: 'sup_1',
      },
    });
    reoWorkspace.restoreDeletedSegmentSupplement.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          memoryId: 'mem_1',
          title: '录音',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-06T13:09:00.000Z',
          segmentCount: 1,
          noteSegmentCount: 0,
          artifactSegmentCount: 0,
          audioSegmentCount: 1,
          audioDurationMs: 1000,
          audioByteLength: 1,
          hasAudioTranscript: false,
          hasAnyNote: false,
          supplementCount: 1,
        },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          type: 'audio',
          title: '录音',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-06T13:09:00.000Z',
          durationMs: 1000,
          audioByteLength: 1,
          transcript: { exists: false },
          supplementCount: 1,
          supplements: [
            {
              workspaceId: 'ws_1',
              memoryId: 'mem_1',
              segmentId: 'seg_1',
              supplementId: 'sup_1',
              type: 'audio',
              title: '现场补充',
              createdAt: '2026-05-06T13:10:00.000Z',
              updatedAt: '2026-05-06T13:11:00.000Z',
              durationMs: 500,
              audioByteLength: 2,
              transcript: { exists: true },
            },
          ],
        },
        supplement: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          supplementId: 'sup_1',
          type: 'audio',
          title: '现场补充',
          createdAt: '2026-05-06T13:10:00.000Z',
          updatedAt: '2026-05-06T13:11:00.000Z',
          durationMs: 500,
          audioByteLength: 2,
          transcript: { exists: true },
        },
      },
    });
    reoWorkspace.saveTranscript.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          audioByteLength: 1,
          createdAt: '2026-05-06T13:08:00.000Z',
          audioDurationMs: 0,
          supplementCount: 0,
          hasAudioTranscript: true,
          hasAnyNote: false,
          memoryId: 'mem_1',
          segmentCount: 1,
          noteSegmentCount: 0,
          artifactSegmentCount: 0,
          audioSegmentCount: 1,
          title: '录音',
          updatedAt: '2026-05-06T13:09:00.000Z',
        },
        saved: true,
        baselineTranscriptHash: 'b'.repeat(64),
      },
    });
    reoWorkspace.requestSegmentTranscriptionBackfill.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          audioByteLength: 1,
          createdAt: '2026-05-06T13:08:00.000Z',
          audioDurationMs: 0,
          supplementCount: 0,
          hasAudioTranscript: true,
          hasAnyNote: false,
          memoryId: 'mem_1',
          segmentCount: 1,
          noteSegmentCount: 0,
          artifactSegmentCount: 0,
          audioSegmentCount: 1,
          title: '录音',
          updatedAt: '2026-05-06T13:09:00.000Z',
        },
        saved: true,
        baselineTranscriptHash: 'b'.repeat(64),
      },
    });
    reoWorkspace.requestSegmentSupplementTranscriptionBackfill.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          audioByteLength: 1,
          createdAt: '2026-05-06T13:08:00.000Z',
          audioDurationMs: 0,
          supplementCount: 1,
          hasAudioTranscript: false,
          hasAnyNote: false,
          memoryId: 'mem_1',
          segmentCount: 1,
          noteSegmentCount: 0,
          artifactSegmentCount: 0,
          audioSegmentCount: 1,
          title: '录音',
          updatedAt: '2026-05-06T13:09:00.000Z',
        },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          type: 'audio',
          title: '录音',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-06T13:09:00.000Z',
          durationMs: 1000,
          audioByteLength: 1,
          transcript: { exists: false },
          supplementCount: 1,
          supplements: [],
        },
        supplement: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          supplementId: 'sup_1',
          type: 'audio',
          title: '现场补充',
          createdAt: '2026-05-06T13:10:00.000Z',
          updatedAt: '2026-05-06T13:11:00.000Z',
          durationMs: 500,
          audioByteLength: 2,
          transcript: { exists: true },
        },
        saved: true,
        baselineTranscriptHash: 'b'.repeat(64),
      },
    });
    reoWorkspace.requestSegmentSpeechSynthesis.mockResolvedValue({
      ok: true,
      value: { speechSynthesis: { status: 'missing' } },
    });
    reoWorkspace.requestSegmentSupplementSpeechSynthesis.mockResolvedValue({
      ok: true,
      value: { speechSynthesis: { status: 'missing' } },
    });
    reoWorkspace.regenerateImportedSpeechSynthesis.mockResolvedValue({
      ok: true,
      value: {
        failed: 0,
        failedTargets: [],
        generated: 1,
        skipped: 0,
        speaker: 'zh_female_vv_uranus_bigtts',
        total: 1,
      },
    });
    reoWorkspace.setVoiceSpeechSynthesisSpeaker.mockResolvedValue({
      ok: true,
      value: {
        settings: {
          enabled: false,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
          speechSynthesisSpeaker: 'zh_male_m191_uranus_bigtts',
          lastTranscriptionValidatedAt: null,
          lastTranscriptionValidationOk: null,
          lastTranscriptionValidationCode: null,
          lastSpeechSynthesisValidatedAt: null,
          lastSpeechSynthesisValidationOk: null,
          lastSpeechSynthesisValidationCode: null,
        },
      },
    });
    reoWorkspace.beginMicrophoneIntent.mockResolvedValue({
      ok: true,
      value: { registered: true },
    });
    reoWorkspace.clearMicrophoneIntent.mockResolvedValue({ ok: true, value: { cleared: true } });

    await chooseWorkspaceDirectory();
    await initializeWorkspace({
      selectionToken: 'selection-token-1',
      title: '记忆',
      description: '',
    });
    await listMemorySpaces();
    await openWorkspace({ selectionToken: 'selection-token-2' });
    await openMemorySpace({ workspaceId: 'ws_1' });
    await removeMemorySpace({ workspaceId: 'ws_1' });
    await updateMemorySpaceTitle({ workspaceId: 'ws_1', title: '测试工作区1' });
    await closeWorkspace({ workspaceHandle: 'wh_1' });
    await readWorkspaceSnapshot({ workspaceHandle: 'wh_1' });
    await createMemory({ workspaceHandle: 'wh_1', title: '产品灵感与思考' });
    await updateWidgetTitle({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      widgetId: 'wdg_1',
      title: 'Workspace 总览',
    });
    await updateWidgetTabOrder({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      widgetTabOrder: ['wdg_1'],
    });
    await deleteWidget({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      widgetId: 'wdg_1',
    });
    await restoreDeletedWidget({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      restoreToken: 'wdg_1',
    });
    await deleteMemory({ workspaceHandle: 'wh_1', memoryId: 'mem_1' });
    await restoreDeletedMemory({ workspaceHandle: 'wh_1', restoreToken: 'mem_1' });
    await deleteSegment({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    });
    await restoreDeletedSegment({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      restoreToken: 'seg_1',
    });
    await readMemoryDetail({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      requestId: 'request_mem_1',
    });
    await readFinalizedAudioSegment({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      requestId: 'request_seg_1',
    });
    await readFinalizedAudioSegmentAudio({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      requestId: 'request_seg_audio_1',
      audioByteLength: 3,
      audioHash: 'a'.repeat(64),
    });
    await readFinalizedAudioSegmentSupplement({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      requestId: 'request_sup_1',
    });
    await readFinalizedAudioSegmentSupplementAudio({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      requestId: 'request_sup_audio_1',
      audioByteLength: 1,
      audioHash: 'a'.repeat(64),
    });
    await createRecordingDraft({ workspaceHandle: 'wh_1' });
    await createSegmentSupplementRecordingDraft({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    });
    await readRecordingDraftAudio({ workspaceHandle: 'wh_1', segmentId: 'seg_1' });
    await appendRecordingAudioChunk({
      workspaceHandle: 'wh_1',
      segmentId: 'seg_1',
      sequence: 0,
      chunk: new Uint8Array([1]),
    });
    await appendSegmentSupplementRecordingAudioChunk({
      workspaceHandle: 'wh_1',
      supplementId: 'sup_1',
      sequence: 0,
      chunk: new Uint8Array([1]),
    });
    await cloneRecordingDraftPrefix({
      workspaceHandle: 'wh_1',
      sourceSegmentId: 'seg_1',
      targetSegmentId: 'seg_2',
      retainedByteLength: 1,
      nextSequence: 0,
    });
    await finalizeRecordingDraft({
      durationMs: 1000,
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      title: '录音',
      workspaceHandle: 'wh_1',
    });
    await finalizeSegmentSupplementRecordingDraft({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      title: '补充录音',
      durationMs: 1000,
    });
    await discardRecordingDraft({ workspaceHandle: 'wh_1', segmentId: 'seg_1' });
    await discardSegmentSupplementRecordingDraft({
      workspaceHandle: 'wh_1',
      supplementId: 'sup_1',
    });
    await updateMemoryTitle({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
      title: '产品灵感与思考',
    });
    await updateSegmentSupplementTitle({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      title: '现场补充',
    });
    await updateSegmentContentTabOrder({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      contentTabOrder: ['supplement:sup_1', 'segment'],
    });
    await deleteSegmentSupplement({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
    });
    await restoreDeletedSegmentSupplement({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      restoreToken: 'sup_1',
    });
    await saveTranscript({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      markdown: '文字',
    });
    await requestSegmentTranscriptionBackfill({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      mode: 'fill-missing',
    });
    await requestSegmentSupplementTranscriptionBackfill({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      mode: 'regenerate',
    });
    await requestSegmentSpeechSynthesis({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      mode: 'fill-missing',
    });
    await requestSegmentSupplementSpeechSynthesis({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      mode: 'regenerate',
    });
    await setVoiceSpeechSynthesisSpeaker({ speaker: 'zh_male_m191_uranus_bigtts' });
    await regenerateImportedSpeechSynthesis({
      activeWorkspace: { workspaceHandle: 'wh_1', workspaceId: 'ws_1' },
      mode: 'all',
      speaker: 'zh_female_vv_uranus_bigtts',
    });
    await beginMicrophoneIntent({
      workspaceHandle: 'wh_1',
      recordingFlowSessionId: 'recording_flow_1',
    });
    await clearMicrophoneIntent({
      workspaceHandle: 'wh_1',
      recordingFlowSessionId: 'recording_flow_1',
    });

    expect(reoWorkspace.chooseDirectory).toHaveBeenCalledTimes(1);
    expect(reoWorkspace.initializeWorkspace).toHaveBeenCalledWith({
      selectionToken: 'selection-token-1',
      title: '记忆',
      description: '',
    });
    expect(reoWorkspace.listMemorySpaces).toHaveBeenCalledTimes(1);
    expect(reoWorkspace.openMemorySpace).toHaveBeenCalledWith({ workspaceId: 'ws_1' });
    expect(reoWorkspace.removeMemorySpace).toHaveBeenCalledWith({ workspaceId: 'ws_1' });
    expect(reoWorkspace.updateMemorySpaceTitle).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      title: '测试工作区1',
    });
    expect(reoWorkspace.readWorkspaceSnapshot).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
    });
    expect(reoWorkspace.createMemory).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      title: '产品灵感与思考',
    });
    expect(reoWorkspace.updateWidgetTitle).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      widgetId: 'wdg_1',
      title: 'Workspace 总览',
    });
    expect(reoWorkspace.updateWidgetTabOrder).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      widgetTabOrder: ['wdg_1'],
    });
    expect(reoWorkspace.deleteWidget).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      widgetId: 'wdg_1',
    });
    expect(reoWorkspace.restoreDeletedWidget).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      restoreToken: 'wdg_1',
    });
    expect(reoWorkspace.deleteMemory).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
    });
    expect(reoWorkspace.restoreDeletedMemory).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      restoreToken: 'mem_1',
    });
    expect(reoWorkspace.deleteSegment).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    });
    expect(reoWorkspace.restoreDeletedSegment).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      restoreToken: 'seg_1',
    });
    expect(reoWorkspace.readMemoryDetail).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      requestId: 'request_mem_1',
    });
    expect(reoWorkspace.readFinalizedAudioSegment).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      requestId: 'request_seg_1',
    });
    expect(reoWorkspace.readFinalizedAudioSegmentAudio).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      requestId: 'request_seg_audio_1',
      audioByteLength: 3,
      audioHash: 'a'.repeat(64),
    });
    expect(reoWorkspace.readFinalizedAudioSegmentSupplement).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      requestId: 'request_sup_1',
    });
    expect(reoWorkspace.readFinalizedAudioSegmentSupplementAudio).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      requestId: 'request_sup_audio_1',
      audioByteLength: 1,
      audioHash: 'a'.repeat(64),
    });
    expect(reoWorkspace.createSegmentSupplementRecordingDraft).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    });
    expect(reoWorkspace.readRecordingDraftAudio).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      segmentId: 'seg_1',
    });
    expect(reoWorkspace.appendSegmentSupplementRecordingAudioChunk).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      supplementId: 'sup_1',
      sequence: 0,
      chunk: new Uint8Array([1]),
    });
    expect(reoWorkspace.cloneRecordingDraftPrefix).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      sourceSegmentId: 'seg_1',
      targetSegmentId: 'seg_2',
      retainedByteLength: 1,
      nextSequence: 0,
    });
    expect(reoWorkspace.finalizeSegmentSupplementRecordingDraft).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      title: '补充录音',
      durationMs: 1000,
    });
    expect(reoWorkspace.discardSegmentSupplementRecordingDraft).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      supplementId: 'sup_1',
    });
    expect(reoWorkspace.updateMemoryTitle).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
      title: '产品灵感与思考',
    });
    expect(reoWorkspace.updateSegmentSupplementTitle).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      title: '现场补充',
    });
    expect(reoWorkspace.updateSegmentContentTabOrder).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      contentTabOrder: ['supplement:sup_1', 'segment'],
    });
    expect(reoWorkspace.deleteSegmentSupplement).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
    });
    expect(reoWorkspace.restoreDeletedSegmentSupplement).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      restoreToken: 'sup_1',
    });
    expect(reoWorkspace.requestSegmentTranscriptionBackfill).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      mode: 'fill-missing',
    });
    expect(reoWorkspace.requestSegmentSupplementTranscriptionBackfill).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      mode: 'regenerate',
    });
    expect(reoWorkspace.requestSegmentSpeechSynthesis).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      mode: 'fill-missing',
    });
    expect(reoWorkspace.requestSegmentSupplementSpeechSynthesis).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      mode: 'regenerate',
    });
    expect(reoWorkspace.setVoiceSpeechSynthesisSpeaker).toHaveBeenCalledWith({
      speaker: 'zh_male_m191_uranus_bigtts',
    });
    expect(reoWorkspace.regenerateImportedSpeechSynthesis).toHaveBeenCalledWith({
      activeWorkspace: { workspaceHandle: 'wh_1', workspaceId: 'ws_1' },
      mode: 'all',
      speaker: 'zh_female_vv_uranus_bigtts',
    });
    expect(reoWorkspace.beginMicrophoneIntent).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      recordingFlowSessionId: 'recording_flow_1',
    });
    expect(reoWorkspace.clearMicrophoneIntent).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      recordingFlowSessionId: 'recording_flow_1',
    });
  });

  it('forwards Note draft and finalized content methods to the explicit preload surface', async () => {
    const okResponse = { ok: true, value: { saved: true } };
    const baselineContentHash = 'a'.repeat(64);
    for (const action of [
      reoWorkspace.createNoteSegmentDraft,
      reoWorkspace.createSegmentSupplementNoteDraft,
      reoWorkspace.writeNoteSegmentDraftBody,
      reoWorkspace.writeSegmentSupplementNoteDraftBody,
      reoWorkspace.finalizeNoteSegmentDraft,
      reoWorkspace.finalizeSegmentSupplementNoteDraft,
      reoWorkspace.readSegmentContent,
      reoWorkspace.readSegmentSupplementContent,
      reoWorkspace.writeSegmentContent,
      reoWorkspace.writeSegmentSupplementContent,
    ]) {
      action.mockResolvedValue(okResponse);
    }

    const basePayload = {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
    };
    const segmentPayload = { ...basePayload, segmentId: 'seg_1' };
    const supplementPayload = { ...segmentPayload, supplementId: 'sup_1' };
    const segmentDraftPayload = { ...basePayload, title: '笔记' };
    const supplementDraftPayload = { ...segmentPayload, title: '补充笔记' };
    const segmentBodyPayload = {
      workspaceHandle: 'wh_1',
      segmentId: 'seg_1',
      bodyMarkdown: '# Note',
      revision: 1,
    };
    const supplementBodyPayload = {
      workspaceHandle: 'wh_1',
      supplementId: 'sup_1',
      bodyMarkdown: '# Follow up',
      revision: 1,
    };
    const readPayload = { ...segmentPayload, requestId: 'request_1' };
    const readSupplementPayload = { ...supplementPayload, requestId: 'request_2' };
    const writePayload = { ...segmentPayload, bodyMarkdown: '# Saved', baselineContentHash };
    const writeSupplementPayload = {
      ...supplementPayload,
      bodyMarkdown: '# Saved follow up',
      baselineContentHash,
    };

    await createNoteSegmentDraft(segmentDraftPayload);
    await createSegmentSupplementNoteDraft(supplementDraftPayload);
    await writeNoteSegmentDraftBody(segmentBodyPayload);
    await writeSegmentSupplementNoteDraftBody(supplementBodyPayload);
    await finalizeNoteSegmentDraft({ ...segmentPayload, title: '笔记' });
    await finalizeSegmentSupplementNoteDraft({ ...supplementPayload, title: '补充笔记' });
    await readSegmentContent(readPayload);
    await readSegmentSupplementContent(readSupplementPayload);
    await writeSegmentContent(writePayload);
    await writeSegmentSupplementContent(writeSupplementPayload);

    expect(reoWorkspace.createNoteSegmentDraft).toHaveBeenCalledWith(segmentDraftPayload);
    expect(reoWorkspace.createSegmentSupplementNoteDraft).toHaveBeenCalledWith(
      supplementDraftPayload
    );
    expect(reoWorkspace.writeNoteSegmentDraftBody).toHaveBeenCalledWith(segmentBodyPayload);
    expect(reoWorkspace.writeSegmentSupplementNoteDraftBody).toHaveBeenCalledWith(
      supplementBodyPayload
    );
    expect(reoWorkspace.finalizeNoteSegmentDraft).toHaveBeenCalledWith({
      ...segmentPayload,
      title: '笔记',
    });
    expect(reoWorkspace.finalizeSegmentSupplementNoteDraft).toHaveBeenCalledWith({
      ...supplementPayload,
      title: '补充笔记',
    });
    expect(reoWorkspace.readSegmentContent).toHaveBeenCalledWith(readPayload);
    expect(reoWorkspace.readSegmentSupplementContent).toHaveBeenCalledWith(readSupplementPayload);
    expect(reoWorkspace.writeSegmentContent).toHaveBeenCalledWith(writePayload);
    expect(reoWorkspace.writeSegmentSupplementContent).toHaveBeenCalledWith(writeSupplementPayload);
  });
});

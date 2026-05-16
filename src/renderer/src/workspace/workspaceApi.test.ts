import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendRecordingAudioChunk,
  beginMicrophoneIntent,
  chooseWorkspaceDirectory,
  clearMicrophoneIntent,
  cloneRecordingDraftPrefix,
  closeWorkspace,
  copyMemoryAbsolutePath,
  copyMemoryRelativePath,
  copyMemorySpaceAbsolutePath,
  copySegmentAbsolutePath,
  copySegmentRelativePath,
  copySegmentSupplementAbsolutePath,
  copySegmentSupplementRelativePath,
  createMemory,
  deleteMemory,
  deleteSegmentSupplement,
  deleteSegment,
  createRecordingDraft,
  createSegmentSupplementRecordingDraft,
  discardRecordingDraft,
  discardSegmentSupplementRecordingDraft,
  finalizeRecordingDraft,
  finalizeSegmentSupplementRecordingDraft,
  initializeWorkspace,
  listMemorySpaces,
  openMemoryDocument,
  openMemorySpaceAgentsFile,
  openExternalUrl,
  openSegmentDocument,
  openSegmentSupplementDocument,
  openWorkspace,
  openMemorySpace,
  readFinalizedAudioSegment,
  readFinalizedAudioSegmentSupplement,
  readMemoryDetail,
  readWorkspaceSnapshot,
  readRecordingDraftAudio,
  removeMemorySpace,
  revealMemoryInFinder,
  revealMemorySpaceInFinder,
  revealSegmentInFinder,
  revealSegmentSupplementInFinder,
  restoreDeletedMemory,
  restoreDeletedSegmentSupplement,
  restoreDeletedSegment,
  saveTranscript,
  updateMemorySpaceTitle,
  updateMemoryTitle,
  updateSegmentSupplementTitle,
  appendSegmentSupplementRecordingAudioChunk,
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
    openMemorySpaceAgentsFile: vi.fn(),
    openMemoryDocument: vi.fn(),
    openSegmentDocument: vi.fn(),
    openSegmentSupplementDocument: vi.fn(),
    openExternalUrl: vi.fn(),
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
    updateMemoryTitle: vi.fn(),
    updateSegmentSupplementTitle: vi.fn(),
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

  it('forwards entity shell actions to the explicit preload surface', async () => {
    const okResponse = { ok: true, value: { completed: true } };
    for (const action of [
      reoWorkspace.revealMemorySpaceInFinder,
      reoWorkspace.revealMemoryInFinder,
      reoWorkspace.revealSegmentInFinder,
      reoWorkspace.revealSegmentSupplementInFinder,
      reoWorkspace.openMemorySpaceAgentsFile,
      reoWorkspace.openMemoryDocument,
      reoWorkspace.openSegmentDocument,
      reoWorkspace.openSegmentSupplementDocument,
      reoWorkspace.copyMemorySpaceAbsolutePath,
      reoWorkspace.copyMemoryAbsolutePath,
      reoWorkspace.copySegmentAbsolutePath,
      reoWorkspace.copySegmentSupplementAbsolutePath,
      reoWorkspace.copyMemoryRelativePath,
      reoWorkspace.copySegmentRelativePath,
      reoWorkspace.copySegmentSupplementRelativePath,
      reoWorkspace.openExternalUrl,
    ]) {
      action.mockResolvedValue(okResponse);
    }

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
    await openExternalUrl({ url: 'https://console.volcengine.com/' });

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
    expect(reoWorkspace.openExternalUrl).toHaveBeenCalledWith({
      url: 'https://console.volcengine.com/',
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
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        supplementCount: 0,
      },
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
          durationMs: 0,
          audioByteLength: 0,
          hasTranscript: false,
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
          durationMs: 0,
          audioByteLength: 0,
          hasTranscript: false,
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
          durationMs: 1,
          audioByteLength: 1,
          hasTranscript: false,
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
          durationMs: 0,
          audioByteLength: 0,
          hasTranscript: false,
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
        audio: new Uint8Array([1]),
        audioByteLength: 1,
        transcript: { exists: true, text: '正文' },
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
        audio: new Uint8Array([2]),
        audioByteLength: 1,
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
          durationMs: 0,
          supplementCount: 0,
          hasTranscript: false,
          memoryId: 'mem_1',
          segmentCount: 1,
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
          durationMs: 0,
          supplementCount: 1,
          hasTranscript: false,
          memoryId: 'mem_1',
          segmentCount: 1,
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
        durationMs: 0,
        audioByteLength: 1,
        hasTranscript: false,
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
          durationMs: 1000,
          audioByteLength: 1,
          hasTranscript: false,
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
          durationMs: 1000,
          audioByteLength: 1,
          hasTranscript: false,
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
          durationMs: 1000,
          audioByteLength: 1,
          hasTranscript: false,
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
          durationMs: 0,
          supplementCount: 0,
          hasTranscript: true,
          memoryId: 'mem_1',
          segmentCount: 1,
          title: '录音',
          updatedAt: '2026-05-06T13:09:00.000Z',
        },
        saved: true,
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
    await readFinalizedAudioSegmentSupplement({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      requestId: 'request_sup_1',
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
    expect(reoWorkspace.readFinalizedAudioSegmentSupplement).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      requestId: 'request_sup_1',
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
    expect(reoWorkspace.beginMicrophoneIntent).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      recordingFlowSessionId: 'recording_flow_1',
    });
    expect(reoWorkspace.clearMicrophoneIntent).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      recordingFlowSessionId: 'recording_flow_1',
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendRecordingAudioChunk,
  beginMicrophoneIntent,
  chooseWorkspaceDirectory,
  clearMicrophoneIntent,
  cloneRecordingDraftPrefix,
  closeWorkspace,
  createMemory,
  deleteMemory,
  createRecordingDraft,
  createSegmentAttachmentRecordingDraft,
  discardRecordingDraft,
  discardSegmentAttachmentRecordingDraft,
  finalizeRecordingDraft,
  finalizeSegmentAttachmentRecordingDraft,
  initializeWorkspace,
  listMemorySpaces,
  openWorkspace,
  openMemorySpace,
  readFinalizedAudioSegment,
  readFinalizedAudioSegmentAttachment,
  readMemoryDetail,
  readRecordingDraftAudio,
  removeMemorySpace,
  restoreDeletedMemory,
  saveTranscript,
  updateMemoryTitle,
  appendSegmentAttachmentRecordingAudioChunk,
} from './workspaceApi';

describe('workspace renderer API wrapper', () => {
  const reoWorkspace = {
    chooseDirectory: vi.fn(),
    listMemorySpaces: vi.fn(),
    initializeWorkspace: vi.fn(),
    openWorkspace: vi.fn(),
    openMemorySpace: vi.fn(),
    removeMemorySpace: vi.fn(),
    closeWorkspace: vi.fn(),
    createMemory: vi.fn(),
    deleteMemory: vi.fn(),
    restoreDeletedMemory: vi.fn(),
    readMemoryDetail: vi.fn(),
    readFinalizedAudioSegment: vi.fn(),
    readFinalizedAudioSegmentAttachment: vi.fn(),
    createRecordingDraft: vi.fn(),
    createSegmentAttachmentRecordingDraft: vi.fn(),
    readRecordingDraftAudio: vi.fn(),
    appendRecordingAudioChunk: vi.fn(),
    appendSegmentAttachmentRecordingAudioChunk: vi.fn(),
    cloneRecordingDraftPrefix: vi.fn(),
    finalizeRecordingDraft: vi.fn(),
    finalizeSegmentAttachmentRecordingDraft: vi.fn(),
    discardRecordingDraft: vi.fn(),
    discardSegmentAttachmentRecordingDraft: vi.fn(),
    updateMemoryTitle: vi.fn(),
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
        attachmentCount: 0,
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
          attachmentCount: 0,
        },
        memories: [],
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
          attachmentCount: 0,
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
    reoWorkspace.readFinalizedAudioSegmentAttachment.mockResolvedValue({
      ok: true,
      value: {
        requestId: 'request_att_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        attachmentId: 'att_1',
        audio: new Uint8Array([2]),
        audioByteLength: 1,
      },
    });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { segmentId: 'seg_1' },
    });
    reoWorkspace.createSegmentAttachmentRecordingDraft.mockResolvedValue({
      ok: true,
      value: { attachmentId: 'att_1', nextSequence: 0 },
    });
    reoWorkspace.readRecordingDraftAudio.mockResolvedValue({
      ok: true,
      value: { audio: new Uint8Array([1]), audioByteLength: 1, nextSequence: 1 },
    });
    reoWorkspace.appendRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { nextSequence: 1 },
    });
    reoWorkspace.appendSegmentAttachmentRecordingAudioChunk.mockResolvedValue({
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
          attachmentCount: 0,
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
    reoWorkspace.finalizeSegmentAttachmentRecordingDraft.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          audioByteLength: 1,
          createdAt: '2026-05-06T13:08:00.000Z',
          durationMs: 0,
          attachmentCount: 1,
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
          attachmentCount: 1,
          attachments: [
            {
              workspaceId: 'ws_1',
              memoryId: 'mem_1',
              segmentId: 'seg_1',
              attachmentId: 'att_1',
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
        attachment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          attachmentId: 'att_1',
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
    reoWorkspace.discardSegmentAttachmentRecordingDraft.mockResolvedValue({
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
        attachmentCount: 0,
      },
    });
    reoWorkspace.saveTranscript.mockResolvedValue({
      ok: true,
      value: {
        memory: {
          audioByteLength: 1,
          createdAt: '2026-05-06T13:08:00.000Z',
          durationMs: 0,
          attachmentCount: 0,
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
    await closeWorkspace({ workspaceHandle: 'wh_1' });
    await createMemory({ workspaceHandle: 'wh_1', title: '产品灵感与思考' });
    await deleteMemory({ workspaceHandle: 'wh_1', memoryId: 'mem_1' });
    await restoreDeletedMemory({ workspaceHandle: 'wh_1', restoreToken: 'mem_1' });
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
    await readFinalizedAudioSegmentAttachment({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      attachmentId: 'att_1',
      requestId: 'request_att_1',
    });
    await createRecordingDraft({ workspaceHandle: 'wh_1' });
    await createSegmentAttachmentRecordingDraft({
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
    await appendSegmentAttachmentRecordingAudioChunk({
      workspaceHandle: 'wh_1',
      attachmentId: 'att_1',
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
    await finalizeSegmentAttachmentRecordingDraft({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      attachmentId: 'att_1',
      title: '补充录音',
      durationMs: 1000,
    });
    await discardRecordingDraft({ workspaceHandle: 'wh_1', segmentId: 'seg_1' });
    await discardSegmentAttachmentRecordingDraft({
      workspaceHandle: 'wh_1',
      attachmentId: 'att_1',
    });
    await updateMemoryTitle({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
      title: '产品灵感与思考',
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
    expect(reoWorkspace.readFinalizedAudioSegmentAttachment).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      attachmentId: 'att_1',
      requestId: 'request_att_1',
    });
    expect(reoWorkspace.createSegmentAttachmentRecordingDraft).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    });
    expect(reoWorkspace.readRecordingDraftAudio).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      segmentId: 'seg_1',
    });
    expect(reoWorkspace.appendSegmentAttachmentRecordingAudioChunk).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      attachmentId: 'att_1',
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
    expect(reoWorkspace.finalizeSegmentAttachmentRecordingDraft).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      attachmentId: 'att_1',
      title: '补充录音',
      durationMs: 1000,
    });
    expect(reoWorkspace.discardSegmentAttachmentRecordingDraft).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      attachmentId: 'att_1',
    });
    expect(reoWorkspace.updateMemoryTitle).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
      title: '产品灵感与思考',
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

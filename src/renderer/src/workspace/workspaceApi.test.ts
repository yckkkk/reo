import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendRecordingAudioChunk,
  beginMicrophoneIntent,
  chooseWorkspaceDirectory,
  clearMicrophoneIntent,
  closeWorkspace,
  createRecordingDraft,
  discardRecordingDraft,
  finalizeRecordingDraft,
  getMemoryDetail,
  getRecordingDetail,
  initializeWorkspace,
  listWorkspaceProjects,
  openWorkspace,
  openWorkspaceProject,
  removeWorkspaceProject,
  readRecordingAudioChunk,
  readRecordingAudioManifest,
  saveReflections,
  saveTranscript,
} from './workspaceApi';

describe('workspace renderer API wrapper', () => {
  const reoWorkspace = {
    chooseDirectory: vi.fn(),
    listWorkspaceProjects: vi.fn(),
    initializeWorkspace: vi.fn(),
    openWorkspace: vi.fn(),
    openWorkspaceProject: vi.fn(),
    removeWorkspaceProject: vi.fn(),
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
    reoWorkspace.listWorkspaceProjects.mockResolvedValue({
      ok: true,
      value: {
        projects: [
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
    reoWorkspace.openWorkspaceProject.mockResolvedValue({
      ok: true,
      value: { workspaceId: 'ws_1' },
    });
    reoWorkspace.removeWorkspaceProject.mockResolvedValue({
      ok: true,
      value: { removed: true },
    });
    reoWorkspace.closeWorkspace.mockResolvedValue({ ok: true, value: { closed: true } });
    reoWorkspace.createRecordingDraft.mockResolvedValue({
      ok: true,
      value: { recordingId: 'rec_1' },
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
          createdAt: '2026-05-06T13:08:00.000Z',
          durationMs: 0,
          hasReflections: false,
          hasTranscript: false,
          memoryId: 'mem_1',
          recordingCount: 1,
          title: '录音',
          updatedAt: '2026-05-06T13:08:00.000Z',
        },
        recording: {
          audioByteLength: 1,
          durationMs: 0,
          memoryId: 'mem_1',
          recordingId: 'rec_1',
          title: '录音',
        },
      },
    });
    reoWorkspace.discardRecordingDraft.mockResolvedValue({ ok: true, value: { discarded: true } });
    reoWorkspace.getMemoryDetail.mockResolvedValue({
      ok: true,
      value: {
        memoryId: 'mem_1',
        title: '录音',
        sourceKind: 'recording',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
        recordingIds: [],
        recordingCount: 0,
        recordingsTruncated: false,
        hasTranscript: false,
        hasReflections: false,
        recordings: [],
      },
    });
    reoWorkspace.getRecordingDetail.mockResolvedValue({
      ok: true,
      value: { recordingId: 'rec_1' },
    });
    reoWorkspace.readRecordingAudioManifest.mockResolvedValue({
      ok: true,
      value: { recordingId: 'rec_1', byteLength: 3, maxChunkBytes: 1_048_576 },
    });
    reoWorkspace.readRecordingAudioChunk.mockResolvedValue({
      ok: true,
      value: { chunk: new Uint8Array([1]) },
    });
    reoWorkspace.saveTranscript.mockResolvedValue({ ok: true, value: { saved: true } });
    reoWorkspace.saveReflections.mockResolvedValue({ ok: true, value: { saved: true } });
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
    await listWorkspaceProjects();
    await openWorkspace({ selectionToken: 'selection-token-2' });
    await openWorkspaceProject({ workspaceId: 'ws_1' });
    await removeWorkspaceProject({ workspaceId: 'ws_1' });
    await closeWorkspace({ workspaceHandle: 'wh_1' });
    await createRecordingDraft({ workspaceHandle: 'wh_1' });
    await appendRecordingAudioChunk({
      workspaceHandle: 'wh_1',
      recordingId: 'rec_1',
      sequence: 0,
      chunk: new Uint8Array([1]),
    });
    await finalizeRecordingDraft({
      durationMs: 1000,
      recordingId: 'rec_1',
      title: '录音',
      workspaceHandle: 'wh_1',
    });
    await discardRecordingDraft({ workspaceHandle: 'wh_1', recordingId: 'rec_1' });
    await getMemoryDetail({ workspaceHandle: 'wh_1', memoryId: 'mem_1' });
    await getRecordingDetail({ workspaceHandle: 'wh_1', memoryId: 'mem_1', recordingId: 'rec_1' });
    await readRecordingAudioManifest({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
      recordingId: 'rec_1',
    });
    await readRecordingAudioChunk({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
      recordingId: 'rec_1',
      offset: 0,
      length: 1,
    });
    await saveTranscript({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
      recordingId: 'rec_1',
      markdown: '文字',
    });
    await saveReflections({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
      recordingId: 'rec_1',
      markdown: '想法',
    });
    await beginMicrophoneIntent({ workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });
    await clearMicrophoneIntent({ workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

    expect(reoWorkspace.chooseDirectory).toHaveBeenCalledTimes(1);
    expect(reoWorkspace.initializeWorkspace).toHaveBeenCalledWith({
      selectionToken: 'selection-token-1',
      title: '记忆',
      description: '',
    });
    expect(reoWorkspace.listWorkspaceProjects).toHaveBeenCalledTimes(1);
    expect(reoWorkspace.openWorkspaceProject).toHaveBeenCalledWith({ workspaceId: 'ws_1' });
    expect(reoWorkspace.removeWorkspaceProject).toHaveBeenCalledWith({ workspaceId: 'ws_1' });
    expect(reoWorkspace.readRecordingAudioChunk).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
      recordingId: 'rec_1',
      offset: 0,
      length: 1,
    });
    expect(reoWorkspace.getMemoryDetail).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
    });
    expect(reoWorkspace.beginMicrophoneIntent).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      drawerSessionId: 'drawer_1',
    });
    expect(reoWorkspace.clearMicrophoneIntent).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      drawerSessionId: 'drawer_1',
    });
  });
});

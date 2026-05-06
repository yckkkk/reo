import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendRecordingAudioChunk,
  chooseWorkspaceDirectory,
  closeWorkspace,
  createRecordingDraft,
  discardRecordingDraft,
  finalizeRecordingDraft,
  getRecordingDetail,
  initializeWorkspace,
  openWorkspace,
  readRecordingAudioChunk,
  readRecordingAudioManifest,
  saveReflections,
  saveTranscript,
  workspaceSnapshotQueryKey,
} from './workspaceApi';

describe('workspace renderer API wrapper', () => {
  const reoWorkspace = {
    chooseDirectory: vi.fn(),
    initializeWorkspace: vi.fn(),
    openWorkspace: vi.fn(),
    closeWorkspace: vi.fn(),
    createRecordingDraft: vi.fn(),
    appendRecordingAudioChunk: vi.fn(),
    finalizeRecordingDraft: vi.fn(),
    discardRecordingDraft: vi.fn(),
    getRecordingDetail: vi.fn(),
    readRecordingAudioManifest: vi.fn(),
    readRecordingAudioChunk: vi.fn(),
    saveTranscript: vi.fn(),
    saveReflections: vi.fn(),
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
    reoWorkspace.openWorkspace.mockResolvedValue({ ok: true, value: { workspaceId: 'ws_1' } });
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
      value: { recordingId: 'rec_1' },
    });
    reoWorkspace.discardRecordingDraft.mockResolvedValue({ ok: true, value: { discarded: true } });
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

    await chooseWorkspaceDirectory();
    await initializeWorkspace({
      selectionToken: 'selection-token-1',
      title: '记忆',
      description: '',
    });
    await openWorkspace({ selectionToken: 'selection-token-2' });
    await closeWorkspace({ workspaceHandle: 'wh_1' });
    await createRecordingDraft({ workspaceHandle: 'wh_1' });
    await appendRecordingAudioChunk({
      workspaceHandle: 'wh_1',
      recordingId: 'rec_1',
      sequence: 0,
      chunk: new Uint8Array([1]),
    });
    await finalizeRecordingDraft({ workspaceHandle: 'wh_1', recordingId: 'rec_1', title: '录音' });
    await discardRecordingDraft({ workspaceHandle: 'wh_1', recordingId: 'rec_1' });
    await getRecordingDetail({ workspaceHandle: 'wh_1', recordingId: 'rec_1' });
    await readRecordingAudioManifest({ workspaceHandle: 'wh_1', recordingId: 'rec_1' });
    await readRecordingAudioChunk({
      workspaceHandle: 'wh_1',
      recordingId: 'rec_1',
      offset: 0,
      length: 1,
    });
    await saveTranscript({ workspaceHandle: 'wh_1', recordingId: 'rec_1', markdown: '文字' });
    await saveReflections({ workspaceHandle: 'wh_1', recordingId: 'rec_1', markdown: '想法' });

    expect(reoWorkspace.chooseDirectory).toHaveBeenCalledTimes(1);
    expect(reoWorkspace.initializeWorkspace).toHaveBeenCalledWith({
      selectionToken: 'selection-token-1',
      title: '记忆',
      description: '',
    });
    expect(reoWorkspace.readRecordingAudioChunk).toHaveBeenCalledWith({
      workspaceHandle: 'wh_1',
      recordingId: 'rec_1',
      offset: 0,
      length: 1,
    });
  });

  it('builds workspace snapshot query key without workspaceHandle', () => {
    expect(
      workspaceSnapshotQueryKey({ workspaceId: 'ws_1', workspaceHandle: 'wh_secret' })
    ).toEqual(['workspace', 'snapshot', 'ws_1']);
  });
});

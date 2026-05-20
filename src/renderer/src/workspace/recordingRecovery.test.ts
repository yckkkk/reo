import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readRecordingRecoveryDraft,
  updateRecordingRecoveryDuration,
  writeRecordingRecoveryDraft,
} from './recordingRecovery';
import type { WorkspaceSession } from './workspaceApi';

const workspaceSession: WorkspaceSession = {
  workspaceHandle: 'workspace-handle',
  workspaceId: 'ws_1',
  snapshot: {
    description: '',
    memories: [
      {
        audioByteLength: 0,
        createdAt: '2026-05-09T10:00:00.000Z',
        audioDurationMs: 0,
        supplementCount: 0,
        hasAudioTranscript: false,
        hasAnyNote: false,
        memoryId: 'mem_1',
        segmentCount: 0,
        noteSegmentCount: 0,
        audioSegmentCount: 0,
        title: 'Memory',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
    ],
    title: 'Workspace',
    workspaceId: 'ws_1',
  },
};

function largeRecoveryDraft() {
  return {
    audioChunks: Array.from({ length: 1200 }, (_, index) => ({
      byteLength: 120,
      endTimeMs: (index + 1) * 250,
      startTimeMs: index * 250,
    })),
    durationMs: 300_000,
    memoryId: 'mem_1',
    recordingSessionId: 'recording-long',
    revisionId: 'recording-long-revision-0',
    segmentId: 'seg_long',
    title: 'Long recording',
    transcriptSegments: Array.from({ length: 2000 }, (_, index) => ({
      endTimeMs: (index + 1) * 100,
      isFinal: true,
      recordingSessionId: 'recording-long',
      revisionId: 'recording-long-revision-0',
      startTimeMs: index * 100,
      text: `很长的恢复转写 ${index} ${'内容'.repeat(200)}`,
    })),
    waveformSamples: Array.from({ length: 2400 }, () => 0.4),
    workspaceId: 'ws_1',
  };
}

describe('recordingRecovery', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('does not carry recoverable recording state from a different segment', () => {
    writeRecordingRecoveryDraft({
      audioChunks: [{ byteLength: 3, endTimeMs: 1000, startTimeMs: 0 }],
      durationMs: 1000,
      memoryId: 'mem_1',
      nextSequence: 7,
      recordingSessionId: 'recording-old',
      revisionId: 'recording-old-revision-0',
      segmentId: 'seg_old',
      title: 'Old recording',
      transcriptSegments: [
        {
          endTimeMs: 1000,
          isFinal: true,
          recordingSessionId: 'recording-old',
          revisionId: 'recording-old-revision-0',
          startTimeMs: 0,
          text: '旧片段转写',
        },
      ],
      waveformSamples: [0.2, 0.4],
      workspaceId: 'ws_1',
    });

    writeRecordingRecoveryDraft({
      durationMs: 0,
      memoryId: 'mem_1',
      recordingSessionId: 'recording-new',
      revisionId: 'recording-new-revision-0',
      segmentId: 'seg_new',
      title: 'New recording',
      workspaceId: 'ws_1',
    });

    expect(readRecordingRecoveryDraft(workspaceSession)).toMatchObject({
      durationMs: 0,
      memoryId: 'mem_1',
      recordingSessionId: 'recording-new',
      revisionId: 'recording-new-revision-0',
      segmentId: 'seg_new',
      title: 'New recording',
    });
    expect(readRecordingRecoveryDraft(workspaceSession)).not.toMatchObject({
      audioChunks: expect.any(Array),
      nextSequence: 7,
      transcriptSegments: expect.any(Array),
      waveformSamples: expect.any(Array),
    });
  });

  it('keeps an oversized recovery marker readable without losing transcript text', () => {
    writeRecordingRecoveryDraft({ ...largeRecoveryDraft(), nextSequence: 1200 });

    const raw = window.localStorage.getItem('reo.recordingRecovery.v1.ws_1');
    const sidecar = window.localStorage.getItem('reo.recordingRecoveryTranscript.v1.ws_1');
    expect(raw).not.toBeNull();
    expect(sidecar).not.toBeNull();
    expect(raw!.length).toBeLessThanOrEqual(512 * 1024);
    expect(JSON.parse(raw!)).toMatchObject({
      transcriptInSidecar: true,
    });
    expect(JSON.parse(raw!)).not.toHaveProperty('transcriptMarkdown');
    const draft = readRecordingRecoveryDraft(workspaceSession);
    expect(draft).toMatchObject({
      durationMs: 300_000,
      memoryId: 'mem_1',
      nextSequence: 1200,
      safeAudioByteLength: 144000,
      segmentId: 'seg_long',
    });
    expect(draft?.audioChunks?.length).toBeGreaterThan(0);
    expect(draft?.transcriptMarkdown).toContain('很长的恢复转写 0');
  });

  it('does not rewrite transcript sidecar during duration-only recovery updates', () => {
    writeRecordingRecoveryDraft(largeRecoveryDraft());

    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    setItem.mockClear();
    updateRecordingRecoveryDuration({
      durationMs: 301_000,
      segmentId: 'seg_long',
      workspaceId: 'ws_1',
    });

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem.mock.calls[0]?.[0]).toBe('reo.recordingRecovery.v1.ws_1');
    expect(window.localStorage.getItem('reo.recordingRecoveryTranscript.v1.ws_1')).toContain(
      '很长的恢复转写 0'
    );
    expect(readRecordingRecoveryDraft(workspaceSession)).toMatchObject({
      durationMs: 301_000,
      transcriptMarkdown: expect.stringContaining('很长的恢复转写 0'),
    });
  });

  it('rejects finalized recovery audio whose memory summary does not match the draft memory', () => {
    writeRecordingRecoveryDraft({
      durationMs: 1000,
      finalizedAudio: {
        memory: {
          audioByteLength: 3,
          createdAt: '2026-05-09T10:00:00.000Z',
          audioDurationMs: 1000,
          supplementCount: 0,
          hasAudioTranscript: false,
          hasAnyNote: false,
          memoryId: 'mem_other',
          segmentCount: 1,
          noteSegmentCount: 0,
          audioSegmentCount: 1,
          title: 'Wrong memory',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_1',
          segmentId: 'seg_1',
          type: 'audio',
          title: 'Recovered audio',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
          audioByteLength: 3,
          durationMs: 1000,
          lastTranscriptionAttempt: 'never' as const,
          transcript: { exists: false },
          supplementCount: 0,
          supplements: [],
        },
      },
      memoryId: 'mem_1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      segmentId: 'seg_1',
      title: 'Recovered audio',
      workspaceId: 'ws_1',
    });

    expect(readRecordingRecoveryDraft(workspaceSession)).toBeNull();
    expect(window.localStorage.getItem('reo.recordingRecovery.v1.ws_1')).toBeNull();
  });
});

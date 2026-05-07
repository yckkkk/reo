import { describe, expect, it } from 'vitest';
import {
  createInitialRecordingState,
  isRecordingCloseBlocked,
  transitionRecordingState,
  type RecordingState,
} from './recordingMachine';

describe('recording machine', () => {
  it('models record, pause, resume, stop, editing, and duplicate stop', () => {
    const acquiring = transitionRecordingState(createInitialRecordingState(), {
      type: 'start-requested',
    });
    const recording = transitionRecordingState(acquiring, {
      recordingId: 'rec_1',
      type: 'draft-ready',
    });
    const paused = transitionRecordingState(recording, { type: 'pause-requested' });
    const resumed = transitionRecordingState(paused, { type: 'resume-requested' });
    const finalizing = transitionRecordingState(resumed, { type: 'stop-requested' });
    const duplicateStop = transitionRecordingState(finalizing, { type: 'stop-requested' });
    const editing = transitionRecordingState(finalizing, {
      memoryId: 'mem_1',
      recordingId: 'rec_1',
      title: 'Recording',
      type: 'finalized',
    });

    expect(acquiring.status).toBe('acquiring-permission');
    expect(recording.status).toBe('recording');
    expect(paused.status).toBe('paused');
    expect(resumed.status).toBe('recording');
    expect(finalizing.status).toBe('finalizing');
    expect(duplicateStop).toEqual(finalizing);
    expect(editing.status).toBe('editing');
  });

  it('allows retry after a failed recording attempt', () => {
    const acquiring = transitionRecordingState(createInitialRecordingState(), {
      type: 'start-requested',
    });
    const failed = transitionRecordingState(acquiring, {
      type: 'failed',
    });
    const retry = transitionRecordingState(failed, {
      type: 'start-requested',
    });

    expect(retry.status).toBe('acquiring-permission');
  });

  it('ignores late failed events from idle and editing states', () => {
    const idle: RecordingState = { status: 'idle' };
    expect(
      transitionRecordingState(idle, {
        type: 'failed',
      })
    ).toEqual(idle);

    const editing: RecordingState = {
      memoryId: 'mem_1',
      recordingId: 'rec_1',
      status: 'editing',
      title: 'Recording',
    };
    expect(
      transitionRecordingState(editing, {
        type: 'failed',
      })
    ).toEqual(editing);
  });

  it('blocks close only while capture work is active', () => {
    expect(isRecordingCloseBlocked({ status: 'idle' })).toBe(false);
    expect(
      isRecordingCloseBlocked({
        status: 'acquiring-permission',
      })
    ).toBe(true);
    expect(isRecordingCloseBlocked({ recordingId: 'rec_1', status: 'recording' })).toBe(true);
    expect(isRecordingCloseBlocked({ recordingId: 'rec_1', status: 'finalizing' })).toBe(true);
    expect(
      isRecordingCloseBlocked({
        memoryId: 'mem_1',
        recordingId: 'rec_1',
        status: 'editing',
        title: 'Recording',
      })
    ).toBe(false);
  });
});

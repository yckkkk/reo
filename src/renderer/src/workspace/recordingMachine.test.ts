import { describe, expect, it } from 'vitest';
import {
  createInitialRecordingState,
  isRecordingCloseBlocked,
  transitionRecordingState,
} from './recordingMachine';

describe('recording machine', () => {
  it('models record, pause, resume, stop, completion reset, and duplicate stop', () => {
    const acquiring = transitionRecordingState(createInitialRecordingState(), {
      type: 'start-requested',
    });
    const recording = transitionRecordingState(acquiring, {
      segmentId: 'seg_1',
      type: 'draft-ready',
    });
    const paused = transitionRecordingState(recording, { type: 'pause-requested' });
    const resumed = transitionRecordingState(paused, { type: 'resume-requested' });
    const finalizing = transitionRecordingState(resumed, { type: 'stop-requested' });
    const duplicateStop = transitionRecordingState(finalizing, { type: 'stop-requested' });
    const completed = transitionRecordingState(finalizing, { type: 'finalized' });

    expect(acquiring.status).toBe('acquiring-permission');
    expect(recording.status).toBe('recording');
    expect(paused.status).toBe('paused');
    expect(resumed.status).toBe('recording');
    expect(finalizing.status).toBe('finalizing');
    expect(duplicateStop).toEqual(finalizing);
    expect(completed.status).toBe('idle');
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

  it('ignores late failed events from idle', () => {
    const idle = { status: 'idle' } as const;
    expect(
      transitionRecordingState(idle, {
        type: 'failed',
      })
    ).toEqual(idle);
  });

  it('blocks close only while capture work is active', () => {
    expect(isRecordingCloseBlocked({ status: 'idle' })).toBe(false);
    expect(
      isRecordingCloseBlocked({
        status: 'acquiring-permission',
      })
    ).toBe(true);
    expect(isRecordingCloseBlocked({ segmentId: 'seg_1', status: 'recording' })).toBe(true);
    expect(isRecordingCloseBlocked({ segmentId: 'seg_1', status: 'finalizing' })).toBe(true);
  });
});

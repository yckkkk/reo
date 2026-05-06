import { describe, expect, it } from 'vitest';
import { createInitialRecordingState, transitionRecordingState } from './recordingMachine';

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
    const stopping = transitionRecordingState(resumed, { type: 'stop-requested' });
    const duplicateStop = transitionRecordingState(stopping, { type: 'stop-requested' });
    const editing = transitionRecordingState(stopping, {
      recordingId: 'rec_1',
      title: 'Recording',
      type: 'finalized',
    });

    expect(acquiring.status).toBe('acquiring');
    expect(recording.status).toBe('recording');
    expect(paused.status).toBe('paused');
    expect(resumed.status).toBe('recording');
    expect(stopping.status).toBe('stopping');
    expect(duplicateStop).toEqual(stopping);
    expect(editing.status).toBe('editing');
  });

  it('allows retry after a failed recording attempt', () => {
    const failed = transitionRecordingState(createInitialRecordingState(), {
      message: 'Append failed',
      type: 'failed',
    });
    const retry = transitionRecordingState(failed, { type: 'start-requested' });

    expect(retry.status).toBe('acquiring');
  });
});

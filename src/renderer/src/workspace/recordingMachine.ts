export type RecordingState =
  | { readonly status: 'idle' }
  | { readonly status: 'acquiring-permission' }
  | { readonly recordingId: string; readonly status: 'recording' }
  | { readonly recordingId: string; readonly status: 'paused' }
  | { readonly recordingId: string; readonly status: 'finalizing' }
  | {
      readonly recordingId: string;
      readonly status: 'editing';
      readonly title: string;
    }
  | {
      readonly status: 'failed';
    };

export type RecordingEvent =
  | { readonly type: 'start-requested' }
  | { readonly recordingId: string; readonly type: 'draft-ready' }
  | { readonly type: 'pause-requested' }
  | { readonly type: 'resume-requested' }
  | { readonly type: 'stop-requested' }
  | {
      readonly recordingId: string;
      readonly title: string;
      readonly type: 'finalized';
    }
  | { readonly type: 'failed' }
  | { readonly type: 'reset' };

export function createInitialRecordingState(): RecordingState {
  return { status: 'idle' };
}

export function transitionRecordingState(
  state: RecordingState,
  event: RecordingEvent
): RecordingState {
  if (event.type === 'failed') {
    if (state.status === 'idle' || state.status === 'editing') {
      return state;
    }
    return {
      status: 'failed',
    };
  }
  if (event.type === 'reset') {
    return createInitialRecordingState();
  }
  if (event.type === 'start-requested' && (state.status === 'idle' || state.status === 'failed')) {
    return { status: 'acquiring-permission' };
  }
  if (event.type === 'draft-ready' && state.status === 'acquiring-permission') {
    return { recordingId: event.recordingId, status: 'recording' };
  }
  if (event.type === 'pause-requested' && state.status === 'recording') {
    return { ...state, status: 'paused' };
  }
  if (event.type === 'resume-requested' && state.status === 'paused') {
    return { ...state, status: 'recording' };
  }
  if (
    event.type === 'stop-requested' &&
    (state.status === 'recording' || state.status === 'paused')
  ) {
    return { recordingId: state.recordingId, status: 'finalizing' };
  }
  if (event.type === 'finalized' && state.status === 'finalizing') {
    return {
      recordingId: event.recordingId,
      status: 'editing',
      title: event.title,
    };
  }

  return state;
}

export function isRecordingCloseBlocked(state: RecordingState) {
  return (
    state.status === 'acquiring-permission' ||
    state.status === 'recording' ||
    state.status === 'paused' ||
    state.status === 'finalizing'
  );
}

export type RecordingState =
  | { readonly status: 'idle' }
  | { readonly status: 'acquiring-permission' }
  | { readonly segmentId: string; readonly status: 'recording' }
  | { readonly segmentId: string; readonly status: 'paused' }
  | { readonly segmentId: string; readonly status: 'replacing' }
  | { readonly segmentId: string; readonly status: 'finalizing' }
  | {
      readonly status: 'failed';
    };

export type RecordingEvent =
  | { readonly type: 'start-requested' }
  | { readonly segmentId: string; readonly type: 'draft-ready' }
  | { readonly type: 'pause-requested' }
  | { readonly segmentId: string; readonly type: 'replace-requested' }
  | { readonly type: 'replace-failed' }
  | { readonly segmentId?: string; readonly type: 'resume-requested' }
  | { readonly type: 'stop-requested' }
  | { readonly type: 'finalized' }
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
    if (state.status === 'idle') {
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
    return { segmentId: event.segmentId, status: 'recording' };
  }
  if (event.type === 'pause-requested' && state.status === 'recording') {
    return { ...state, status: 'paused' };
  }
  if (event.type === 'replace-requested' && state.status === 'paused') {
    return { segmentId: event.segmentId, status: 'replacing' };
  }
  if (event.type === 'replace-failed' && state.status === 'replacing') {
    return { segmentId: state.segmentId, status: 'paused' };
  }
  if (
    event.type === 'resume-requested' &&
    (state.status === 'paused' || state.status === 'replacing')
  ) {
    return { segmentId: event.segmentId ?? state.segmentId, status: 'recording' };
  }
  if (
    event.type === 'stop-requested' &&
    (state.status === 'recording' || state.status === 'paused')
  ) {
    return { segmentId: state.segmentId, status: 'finalizing' };
  }
  if (event.type === 'finalized' && state.status === 'finalizing') {
    return createInitialRecordingState();
  }

  return state;
}

export function isRecordingCloseBlocked(state: RecordingState) {
  return (
    state.status === 'acquiring-permission' ||
    state.status === 'recording' ||
    state.status === 'paused' ||
    state.status === 'replacing' ||
    state.status === 'finalizing'
  );
}

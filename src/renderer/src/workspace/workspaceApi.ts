export function chooseWorkspaceDirectory() {
  return window.reoWorkspace.chooseDirectory();
}

export function initializeWorkspace(
  payload: Parameters<Window['reoWorkspace']['initializeWorkspace']>[0]
) {
  return window.reoWorkspace.initializeWorkspace(payload);
}

export function openWorkspace(payload: Parameters<Window['reoWorkspace']['openWorkspace']>[0]) {
  return window.reoWorkspace.openWorkspace(payload);
}

export function closeWorkspace(payload: Parameters<Window['reoWorkspace']['closeWorkspace']>[0]) {
  return window.reoWorkspace.closeWorkspace(payload);
}

export function createRecordingDraft(
  payload: Parameters<Window['reoWorkspace']['createRecordingDraft']>[0]
) {
  return window.reoWorkspace.createRecordingDraft(payload);
}

export function appendRecordingAudioChunk(
  payload: Parameters<Window['reoWorkspace']['appendRecordingAudioChunk']>[0]
) {
  return window.reoWorkspace.appendRecordingAudioChunk(payload);
}

export function finalizeRecordingDraft(
  payload: Parameters<Window['reoWorkspace']['finalizeRecordingDraft']>[0]
) {
  return window.reoWorkspace.finalizeRecordingDraft(payload);
}

export function discardRecordingDraft(
  payload: Parameters<Window['reoWorkspace']['discardRecordingDraft']>[0]
) {
  return window.reoWorkspace.discardRecordingDraft(payload);
}

export function getRecordingDetail(
  payload: Parameters<Window['reoWorkspace']['getRecordingDetail']>[0]
) {
  return window.reoWorkspace.getRecordingDetail(payload);
}

export function readRecordingAudioManifest(
  payload: Parameters<Window['reoWorkspace']['readRecordingAudioManifest']>[0]
) {
  return window.reoWorkspace.readRecordingAudioManifest(payload);
}

export function readRecordingAudioChunk(
  payload: Parameters<Window['reoWorkspace']['readRecordingAudioChunk']>[0]
) {
  return window.reoWorkspace.readRecordingAudioChunk(payload);
}

export function saveTranscript(payload: Parameters<Window['reoWorkspace']['saveTranscript']>[0]) {
  return window.reoWorkspace.saveTranscript(payload);
}

export function saveReflections(payload: Parameters<Window['reoWorkspace']['saveReflections']>[0]) {
  return window.reoWorkspace.saveReflections(payload);
}

export function workspaceSnapshotQueryKey({
  workspaceId,
}: {
  readonly workspaceId: string;
  readonly workspaceHandle: string;
}) {
  return ['workspace', 'snapshot', workspaceId] as const;
}

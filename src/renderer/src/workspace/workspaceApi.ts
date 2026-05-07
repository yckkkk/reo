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

export function getMemoryDetail(payload: Parameters<Window['reoWorkspace']['getMemoryDetail']>[0]) {
  return window.reoWorkspace.getMemoryDetail(payload);
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

export function beginMicrophoneIntent(
  payload: Parameters<Window['reoWorkspace']['beginMicrophoneIntent']>[0]
) {
  return window.reoWorkspace.beginMicrophoneIntent(payload);
}

export function clearMicrophoneIntent(
  payload: Parameters<Window['reoWorkspace']['clearMicrophoneIntent']>[0]
) {
  return window.reoWorkspace.clearMicrophoneIntent(payload);
}

export type WorkspaceInitializeResponse = Awaited<ReturnType<typeof initializeWorkspace>>;
export type WorkspaceSession = Extract<WorkspaceInitializeResponse, { readonly ok: true }>['value'];
export type WorkspaceSnapshot = WorkspaceSession['snapshot'];
export type WorkspaceError = Extract<WorkspaceInitializeResponse, { readonly ok: false }>['error'];
export type MemoryDetailResponse = Awaited<ReturnType<typeof getMemoryDetail>>;
export type WorkspaceMemoryDetail = Extract<MemoryDetailResponse, { readonly ok: true }>['value'];
export type WorkspaceChooseDirectoryResponse = Awaited<ReturnType<typeof chooseWorkspaceDirectory>>;
export type WorkspaceDirectorySelection = Extract<
  Extract<WorkspaceChooseDirectoryResponse, { readonly ok: true }>['value'],
  { readonly status: 'selected' }
>;

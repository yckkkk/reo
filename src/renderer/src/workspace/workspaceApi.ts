export function chooseWorkspaceDirectory() {
  return window.reoWorkspace.chooseDirectory();
}

export function initializeWorkspace(
  payload: Parameters<Window['reoWorkspace']['initializeWorkspace']>[0]
) {
  return window.reoWorkspace.initializeWorkspace(payload);
}

export function listMemorySpaces() {
  return window.reoWorkspace.listMemorySpaces();
}

export function openWorkspace(payload: Parameters<Window['reoWorkspace']['openWorkspace']>[0]) {
  return window.reoWorkspace.openWorkspace(payload);
}

export function openMemorySpace(payload: Parameters<Window['reoWorkspace']['openMemorySpace']>[0]) {
  return window.reoWorkspace.openMemorySpace(payload);
}

export function removeMemorySpace(
  payload: Parameters<Window['reoWorkspace']['removeMemorySpace']>[0]
) {
  return window.reoWorkspace.removeMemorySpace(payload);
}

export function closeWorkspace(payload: Parameters<Window['reoWorkspace']['closeWorkspace']>[0]) {
  return window.reoWorkspace.closeWorkspace(payload);
}

export function createMemory(payload: Parameters<Window['reoWorkspace']['createMemory']>[0]) {
  return window.reoWorkspace.createMemory(payload);
}

export function createRecordingDraft(
  payload: Parameters<Window['reoWorkspace']['createRecordingDraft']>[0]
) {
  return window.reoWorkspace.createRecordingDraft(payload);
}

export function readRecordingDraftAudio(
  payload: Parameters<Window['reoWorkspace']['readRecordingDraftAudio']>[0]
) {
  return window.reoWorkspace.readRecordingDraftAudio(payload);
}

export function appendRecordingAudioChunk(
  payload: Parameters<Window['reoWorkspace']['appendRecordingAudioChunk']>[0]
) {
  return window.reoWorkspace.appendRecordingAudioChunk(payload);
}

export function cloneRecordingDraftPrefix(
  payload: Parameters<Window['reoWorkspace']['cloneRecordingDraftPrefix']>[0]
) {
  return window.reoWorkspace.cloneRecordingDraftPrefix(payload);
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

export function updateMemoryTitle(
  payload: Parameters<Window['reoWorkspace']['updateMemoryTitle']>[0]
) {
  return window.reoWorkspace.updateMemoryTitle(payload);
}

export function saveTranscript(payload: Parameters<Window['reoWorkspace']['saveTranscript']>[0]) {
  return window.reoWorkspace.saveTranscript(payload);
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

export function startRecordingTranscription(
  payload: Parameters<Window['reoWorkspace']['startRecordingTranscription']>[0]
) {
  return window.reoWorkspace.startRecordingTranscription(payload);
}

export function sendRecordingTranscriptionAudio(
  payload: Parameters<Window['reoWorkspace']['sendRecordingTranscriptionAudio']>[0]
) {
  return window.reoWorkspace.sendRecordingTranscriptionAudio(payload);
}

export function finishRecordingTranscription(
  payload: Parameters<Window['reoWorkspace']['finishRecordingTranscription']>[0]
) {
  return window.reoWorkspace.finishRecordingTranscription(payload);
}

export function closeRecordingTranscription(
  payload: Parameters<Window['reoWorkspace']['closeRecordingTranscription']>[0]
) {
  return window.reoWorkspace.closeRecordingTranscription(payload);
}

export function onRecordingTranscriptionEvent(
  callback: Parameters<Window['reoWorkspace']['onRecordingTranscriptionEvent']>[0]
) {
  return window.reoWorkspace.onRecordingTranscriptionEvent(callback);
}

export type WorkspaceInitializeResponse = Awaited<ReturnType<typeof initializeWorkspace>>;
export type WorkspaceSession = Extract<WorkspaceInitializeResponse, { readonly ok: true }>['value'];
export type WorkspaceSnapshot = WorkspaceSession['snapshot'];
export type WorkspaceError = Extract<WorkspaceInitializeResponse, { readonly ok: false }>['error'];
export type FinalizedAudioSegment = Extract<
  Awaited<ReturnType<typeof finalizeRecordingDraft>>,
  { readonly ok: true }
>['value'];
export type WorkspaceMemorySpace = Extract<
  Awaited<ReturnType<typeof listMemorySpaces>>,
  { readonly ok: true }
>['value']['memorySpaces'][number];
export type WorkspaceMemorySummary = WorkspaceSnapshot['memories'][number];
export type WorkspaceChooseDirectoryResponse = Awaited<ReturnType<typeof chooseWorkspaceDirectory>>;
export type WorkspaceDirectorySelection = Extract<
  Extract<WorkspaceChooseDirectoryResponse, { readonly ok: true }>['value'],
  { readonly status: 'selected' }
>;

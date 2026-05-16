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

export function revealMemorySpaceInFinder(
  payload: Parameters<Window['reoWorkspace']['revealMemorySpaceInFinder']>[0]
) {
  return window.reoWorkspace.revealMemorySpaceInFinder(payload);
}

export function revealMemoryInFinder(
  payload: Parameters<Window['reoWorkspace']['revealMemoryInFinder']>[0]
) {
  return window.reoWorkspace.revealMemoryInFinder(payload);
}

export function revealSegmentInFinder(
  payload: Parameters<Window['reoWorkspace']['revealSegmentInFinder']>[0]
) {
  return window.reoWorkspace.revealSegmentInFinder(payload);
}

export function revealSegmentSupplementInFinder(
  payload: Parameters<Window['reoWorkspace']['revealSegmentSupplementInFinder']>[0]
) {
  return window.reoWorkspace.revealSegmentSupplementInFinder(payload);
}

export function openMemorySpaceAgentsFile(
  payload: Parameters<Window['reoWorkspace']['openMemorySpaceAgentsFile']>[0]
) {
  return window.reoWorkspace.openMemorySpaceAgentsFile(payload);
}

export function openExternalUrl(payload: Parameters<Window['reoWorkspace']['openExternalUrl']>[0]) {
  return window.reoWorkspace.openExternalUrl(payload);
}

export function openMemoryDocument(
  payload: Parameters<Window['reoWorkspace']['openMemoryDocument']>[0]
) {
  return window.reoWorkspace.openMemoryDocument(payload);
}

export function openSegmentDocument(
  payload: Parameters<Window['reoWorkspace']['openSegmentDocument']>[0]
) {
  return window.reoWorkspace.openSegmentDocument(payload);
}

export function openSegmentSupplementDocument(
  payload: Parameters<Window['reoWorkspace']['openSegmentSupplementDocument']>[0]
) {
  return window.reoWorkspace.openSegmentSupplementDocument(payload);
}

export function copyMemorySpaceAbsolutePath(
  payload: Parameters<Window['reoWorkspace']['copyMemorySpaceAbsolutePath']>[0]
) {
  return window.reoWorkspace.copyMemorySpaceAbsolutePath(payload);
}

export function copyMemoryAbsolutePath(
  payload: Parameters<Window['reoWorkspace']['copyMemoryAbsolutePath']>[0]
) {
  return window.reoWorkspace.copyMemoryAbsolutePath(payload);
}

export function copySegmentAbsolutePath(
  payload: Parameters<Window['reoWorkspace']['copySegmentAbsolutePath']>[0]
) {
  return window.reoWorkspace.copySegmentAbsolutePath(payload);
}

export function copySegmentSupplementAbsolutePath(
  payload: Parameters<Window['reoWorkspace']['copySegmentSupplementAbsolutePath']>[0]
) {
  return window.reoWorkspace.copySegmentSupplementAbsolutePath(payload);
}

export function copyMemoryRelativePath(
  payload: Parameters<Window['reoWorkspace']['copyMemoryRelativePath']>[0]
) {
  return window.reoWorkspace.copyMemoryRelativePath(payload);
}

export function copySegmentRelativePath(
  payload: Parameters<Window['reoWorkspace']['copySegmentRelativePath']>[0]
) {
  return window.reoWorkspace.copySegmentRelativePath(payload);
}

export function copySegmentSupplementRelativePath(
  payload: Parameters<Window['reoWorkspace']['copySegmentSupplementRelativePath']>[0]
) {
  return window.reoWorkspace.copySegmentSupplementRelativePath(payload);
}

export function updateMemorySpaceTitle(
  payload: Parameters<Window['reoWorkspace']['updateMemorySpaceTitle']>[0]
) {
  return window.reoWorkspace.updateMemorySpaceTitle(payload);
}

export function closeWorkspace(payload: Parameters<Window['reoWorkspace']['closeWorkspace']>[0]) {
  return window.reoWorkspace.closeWorkspace(payload);
}

export function readWorkspaceSnapshot(
  payload: Parameters<Window['reoWorkspace']['readWorkspaceSnapshot']>[0]
) {
  return window.reoWorkspace.readWorkspaceSnapshot(payload);
}

export function createMemory(payload: Parameters<Window['reoWorkspace']['createMemory']>[0]) {
  return window.reoWorkspace.createMemory(payload);
}

export function deleteMemory(payload: Parameters<Window['reoWorkspace']['deleteMemory']>[0]) {
  return window.reoWorkspace.deleteMemory(payload);
}

export function restoreDeletedMemory(
  payload: Parameters<Window['reoWorkspace']['restoreDeletedMemory']>[0]
) {
  return window.reoWorkspace.restoreDeletedMemory(payload);
}

export function deleteSegment(payload: Parameters<Window['reoWorkspace']['deleteSegment']>[0]) {
  return window.reoWorkspace.deleteSegment(payload);
}

export function restoreDeletedSegment(
  payload: Parameters<Window['reoWorkspace']['restoreDeletedSegment']>[0]
) {
  return window.reoWorkspace.restoreDeletedSegment(payload);
}

export function deleteSegmentSupplement(
  payload: Parameters<Window['reoWorkspace']['deleteSegmentSupplement']>[0]
) {
  return window.reoWorkspace.deleteSegmentSupplement(payload);
}

export function restoreDeletedSegmentSupplement(
  payload: Parameters<Window['reoWorkspace']['restoreDeletedSegmentSupplement']>[0]
) {
  return window.reoWorkspace.restoreDeletedSegmentSupplement(payload);
}

export function readMemoryDetail(
  payload: Parameters<Window['reoWorkspace']['readMemoryDetail']>[0]
) {
  return window.reoWorkspace.readMemoryDetail(payload);
}

export function readFinalizedAudioSegment(
  payload: Parameters<Window['reoWorkspace']['readFinalizedAudioSegment']>[0]
) {
  return window.reoWorkspace.readFinalizedAudioSegment(payload);
}

export function readFinalizedAudioSegmentSupplement(
  payload: Parameters<Window['reoWorkspace']['readFinalizedAudioSegmentSupplement']>[0]
) {
  return window.reoWorkspace.readFinalizedAudioSegmentSupplement(payload);
}

export function createRecordingDraft(
  payload: Parameters<Window['reoWorkspace']['createRecordingDraft']>[0]
) {
  return window.reoWorkspace.createRecordingDraft(payload);
}

export function createSegmentSupplementRecordingDraft(
  payload: Parameters<Window['reoWorkspace']['createSegmentSupplementRecordingDraft']>[0]
) {
  return window.reoWorkspace.createSegmentSupplementRecordingDraft(payload);
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

export function appendSegmentSupplementRecordingAudioChunk(
  payload: Parameters<Window['reoWorkspace']['appendSegmentSupplementRecordingAudioChunk']>[0]
) {
  return window.reoWorkspace.appendSegmentSupplementRecordingAudioChunk(payload);
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

export function finalizeSegmentSupplementRecordingDraft(
  payload: Parameters<Window['reoWorkspace']['finalizeSegmentSupplementRecordingDraft']>[0]
) {
  return window.reoWorkspace.finalizeSegmentSupplementRecordingDraft(payload);
}

export function discardRecordingDraft(
  payload: Parameters<Window['reoWorkspace']['discardRecordingDraft']>[0]
) {
  return window.reoWorkspace.discardRecordingDraft(payload);
}

export function discardSegmentSupplementRecordingDraft(
  payload: Parameters<Window['reoWorkspace']['discardSegmentSupplementRecordingDraft']>[0]
) {
  return window.reoWorkspace.discardSegmentSupplementRecordingDraft(payload);
}

export function updateMemoryTitle(
  payload: Parameters<Window['reoWorkspace']['updateMemoryTitle']>[0]
) {
  return window.reoWorkspace.updateMemoryTitle(payload);
}

export function updateSegmentTitle(
  payload: Parameters<Window['reoWorkspace']['updateSegmentTitle']>[0]
) {
  return window.reoWorkspace.updateSegmentTitle(payload);
}

export function updateSegmentSupplementTitle(
  payload: Parameters<Window['reoWorkspace']['updateSegmentSupplementTitle']>[0]
) {
  return window.reoWorkspace.updateSegmentSupplementTitle(payload);
}

export function saveTranscript(payload: Parameters<Window['reoWorkspace']['saveTranscript']>[0]) {
  return window.reoWorkspace.saveTranscript(payload);
}

export function saveSegmentSupplementTranscript(
  payload: Parameters<Window['reoWorkspace']['saveSegmentSupplementTranscript']>[0]
) {
  return window.reoWorkspace.saveSegmentSupplementTranscript(payload);
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

export function readVoiceTranscriptionSettings() {
  return window.reoWorkspace.readVoiceTranscriptionSettings(undefined);
}

export function setVoiceTranscriptionEnabled(
  payload: Parameters<Window['reoWorkspace']['setVoiceTranscriptionEnabled']>[0]
) {
  return window.reoWorkspace.setVoiceTranscriptionEnabled(payload);
}

export function saveVoiceTranscriptionApiKey(
  payload: Parameters<Window['reoWorkspace']['saveVoiceTranscriptionApiKey']>[0]
) {
  return window.reoWorkspace.saveVoiceTranscriptionApiKey(payload);
}

export function clearVoiceTranscriptionApiKey() {
  return window.reoWorkspace.clearVoiceTranscriptionApiKey(undefined);
}

export function validateVoiceTranscriptionCredentials() {
  return window.reoWorkspace.validateVoiceTranscriptionCredentials(undefined);
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
export type FinalizedSegmentSupplementRecording = Extract<
  Awaited<ReturnType<typeof finalizeSegmentSupplementRecordingDraft>>,
  { readonly ok: true }
>['value'];
export type RenamedSegment = Extract<
  Awaited<ReturnType<typeof updateSegmentTitle>>,
  { readonly ok: true }
>['value'];
export type RenamedSegmentSupplement = Extract<
  Awaited<ReturnType<typeof updateSegmentSupplementTitle>>,
  { readonly ok: true }
>['value'];
export type DeletedSegmentSupplement = Extract<
  Awaited<ReturnType<typeof deleteSegmentSupplement>>,
  { readonly ok: true }
>['value'];
export type RestoredSegmentSupplement = Extract<
  Awaited<ReturnType<typeof restoreDeletedSegmentSupplement>>,
  { readonly ok: true }
>['value'];
export type WorkspaceMemorySpace = Extract<
  Awaited<ReturnType<typeof listMemorySpaces>>,
  { readonly ok: true }
>['value']['memorySpaces'][number];
export type WorkspaceMemorySummary = WorkspaceSnapshot['memories'][number];
export type WorkspaceMemoryDetail = Extract<
  Awaited<ReturnType<typeof readMemoryDetail>>,
  { readonly ok: true }
>['value']['detail'];
export type WorkspaceFinalizedAudioSegmentContent = Extract<
  Awaited<ReturnType<typeof readFinalizedAudioSegment>>,
  { readonly ok: true }
>['value'];
export type WorkspaceFinalizedAudioSegmentSupplementContent = Extract<
  Awaited<ReturnType<typeof readFinalizedAudioSegmentSupplement>>,
  { readonly ok: true }
>['value'];
export type VoiceTranscriptionSettings = Extract<
  Awaited<ReturnType<typeof readVoiceTranscriptionSettings>>,
  { readonly ok: true }
>['value']['settings'];
export type VoiceTranscriptionSettingsResponseValue = Extract<
  Awaited<ReturnType<typeof readVoiceTranscriptionSettings>>,
  { readonly ok: true }
>['value'];
export type VoiceTranscriptionCredentialsValidation = Extract<
  Awaited<ReturnType<typeof validateVoiceTranscriptionCredentials>>,
  { readonly ok: true }
>['value'];
export type WorkspaceChooseDirectoryResponse = Awaited<ReturnType<typeof chooseWorkspaceDirectory>>;
export type WorkspaceDirectorySelection = Extract<
  Extract<WorkspaceChooseDirectoryResponse, { readonly ok: true }>['value'],
  { readonly status: 'selected' }
>;

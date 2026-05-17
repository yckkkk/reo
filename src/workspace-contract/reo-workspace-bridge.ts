import type {
  WorkspaceChooseDirectoryResponse,
  WorkspaceClearMicrophoneIntentResponse,
  WorkspaceClearVoiceTranscriptionApiKeyRequest,
  WorkspaceClearVoiceTranscriptionApiKeyResponse,
  WorkspaceCloseRequest,
  WorkspaceCloseResponse,
  WorkspaceCopyMemoryAbsolutePathRequest,
  WorkspaceCopyMemoryRelativePathRequest,
  WorkspaceCopyMemorySpaceAbsolutePathRequest,
  WorkspaceCopySegmentAbsolutePathRequest,
  WorkspaceCopySegmentRelativePathRequest,
  WorkspaceCopySegmentSupplementAbsolutePathRequest,
  WorkspaceCopySegmentSupplementRelativePathRequest,
  WorkspaceCreateMemoryRequest,
  WorkspaceCreateMemoryResponse,
  WorkspaceDeleteMemoryRequest,
  WorkspaceDeleteMemoryResponse,
  WorkspaceDeleteSegmentSupplementRequest,
  WorkspaceDeleteSegmentSupplementResponse,
  WorkspaceDeleteSegmentRequest,
  WorkspaceDeleteSegmentResponse,
  WorkspaceCreateRecordingDraftResponse,
  WorkspaceCreateSegmentSupplementRecordingDraftRequest,
  WorkspaceCreateSegmentSupplementRecordingDraftResponse,
  WorkspaceDiscardRecordingDraftResponse,
  WorkspaceFinalizeSegmentSupplementRecordingDraftRequest,
  WorkspaceFinalizeSegmentSupplementRecordingDraftResponse,
  WorkspaceHandleRequest,
  WorkspaceInitializeRequest,
  WorkspaceInitializeResponse,
  WorkspaceEntityActionResponse,
  WorkspaceListMemorySpacesResponse,
  WorkspaceMemorySpaceIdRequest,
  WorkspaceMicrophoneIntentRequest,
  WorkspaceMicrophoneIntentResponse,
  WorkspaceOpenVoiceTranscriptionProviderConsoleResponse,
  WorkspaceOpenMemoryDocumentRequest,
  WorkspaceOpenMemorySpaceAgentsFileRequest,
  WorkspaceOpenRequest,
  WorkspaceOpenSegmentDocumentRequest,
  WorkspaceOpenSegmentSupplementDocumentRequest,
  WorkspaceReadFinalizedAudioSegmentRequest,
  WorkspaceReadFinalizedAudioSegmentResponse,
  WorkspaceReadFinalizedAudioSegmentSupplementRequest,
  WorkspaceReadFinalizedAudioSegmentSupplementResponse,
  WorkspaceReadMemoryDetailRequest,
  WorkspaceReadMemoryDetailResponse,
  WorkspaceReadVoiceTranscriptionSettingsRequest,
  WorkspaceReadVoiceTranscriptionSettingsResponse,
  WorkspaceReadWorkspaceSnapshotRequest,
  WorkspaceReadWorkspaceSnapshotResponse,
  WorkspaceRestoreDeletedMemoryRequest,
  WorkspaceRestoreDeletedMemoryResponse,
  WorkspaceRestoreDeletedSegmentSupplementRequest,
  WorkspaceRestoreDeletedSegmentSupplementResponse,
  WorkspaceRestoreDeletedSegmentRequest,
  WorkspaceRestoreDeletedSegmentResponse,
  WorkspaceRecordingAppendRequest,
  WorkspaceRecordingAppendResponse,
  WorkspaceAppendSegmentSupplementRecordingAudioRequest,
  WorkspaceRecordingDraftPrefixCloneRequest,
  WorkspaceRecordingDraftPrefixCloneResponse,
  WorkspaceRecordingDraftAudioResponse,
  WorkspaceRecordingDraftAudioRequest,
  WorkspaceRecordingFinalizeRequest,
  WorkspaceRecordingFinalizeResponse,
  WorkspaceRecordingTranscriptionAudioRequest,
  WorkspaceRecordingTranscriptionCloseRequest,
  WorkspaceRecordingTranscriptionControlResponse,
  WorkspaceRecordingTranscriptionEvent,
  WorkspaceRecordingTranscriptionStartRequest,
  WorkspaceRevealMemoryInFinderRequest,
  WorkspaceRevealMemorySpaceInFinderRequest,
  WorkspaceRevealSegmentInFinderRequest,
  WorkspaceRevealSegmentSupplementInFinderRequest,
  WorkspaceSegmentSupplementIdRequest,
  WorkspaceSegmentSupplementRecordingAppendResponse,
  WorkspaceSegmentIdRequest,
  WorkspaceRecordingMarkdownSaveRequest,
  WorkspaceRecordingMarkdownSaveResponse,
  WorkspaceSegmentSupplementMarkdownSaveRequest,
  WorkspaceSegmentSupplementMarkdownSaveResponse,
  WorkspaceRequestSegmentTranscriptionBackfillRequest,
  WorkspaceRequestSegmentTranscriptionBackfillResponse,
  WorkspaceRequestSegmentSupplementTranscriptionBackfillRequest,
  WorkspaceRequestSegmentSupplementTranscriptionBackfillResponse,
  WorkspaceRemoveMemorySpaceResponse,
  WorkspaceSaveVoiceTranscriptionApiKeyRequest,
  WorkspaceSaveVoiceTranscriptionApiKeyResponse,
  WorkspaceSetVoiceTranscriptionEnabledRequest,
  WorkspaceSetVoiceTranscriptionEnabledResponse,
  WorkspaceUpdateMemorySpaceTitleRequest,
  WorkspaceUpdateMemorySpaceTitleResponse,
  WorkspaceUpdateMemoryTitleRequest,
  WorkspaceUpdateMemoryTitleResponse,
  WorkspaceUpdateSegmentSupplementTitleRequest,
  WorkspaceUpdateSegmentSupplementTitleResponse,
  WorkspaceUpdateSegmentTitleRequest,
  WorkspaceUpdateSegmentTitleResponse,
  WorkspaceValidateVoiceTranscriptionCredentialsRequest,
  WorkspaceValidateVoiceTranscriptionCredentialsResponse,
} from './workspace-contract.js';

export interface ReoWorkspaceBridge {
  readonly chooseDirectory: () => Promise<WorkspaceChooseDirectoryResponse>;
  readonly listMemorySpaces: () => Promise<WorkspaceListMemorySpacesResponse>;
  readonly initializeWorkspace: (
    payload: WorkspaceInitializeRequest
  ) => Promise<WorkspaceInitializeResponse>;
  readonly openWorkspace: (payload: WorkspaceOpenRequest) => Promise<WorkspaceInitializeResponse>;
  readonly openMemorySpace: (
    payload: WorkspaceMemorySpaceIdRequest
  ) => Promise<WorkspaceInitializeResponse>;
  readonly removeMemorySpace: (
    payload: WorkspaceMemorySpaceIdRequest
  ) => Promise<WorkspaceRemoveMemorySpaceResponse>;
  readonly revealMemorySpaceInFinder: (
    payload: WorkspaceRevealMemorySpaceInFinderRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly revealMemoryInFinder: (
    payload: WorkspaceRevealMemoryInFinderRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly revealSegmentInFinder: (
    payload: WorkspaceRevealSegmentInFinderRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly revealSegmentSupplementInFinder: (
    payload: WorkspaceRevealSegmentSupplementInFinderRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly openMemorySpaceAgentsFile: (
    payload: WorkspaceOpenMemorySpaceAgentsFileRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly openMemoryDocument: (
    payload: WorkspaceOpenMemoryDocumentRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly openSegmentDocument: (
    payload: WorkspaceOpenSegmentDocumentRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly openSegmentSupplementDocument: (
    payload: WorkspaceOpenSegmentSupplementDocumentRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly copyMemorySpaceAbsolutePath: (
    payload: WorkspaceCopyMemorySpaceAbsolutePathRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly copyMemoryAbsolutePath: (
    payload: WorkspaceCopyMemoryAbsolutePathRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly copySegmentAbsolutePath: (
    payload: WorkspaceCopySegmentAbsolutePathRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly copySegmentSupplementAbsolutePath: (
    payload: WorkspaceCopySegmentSupplementAbsolutePathRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly copyMemoryRelativePath: (
    payload: WorkspaceCopyMemoryRelativePathRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly copySegmentRelativePath: (
    payload: WorkspaceCopySegmentRelativePathRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly copySegmentSupplementRelativePath: (
    payload: WorkspaceCopySegmentSupplementRelativePathRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly updateMemorySpaceTitle: (
    payload: WorkspaceUpdateMemorySpaceTitleRequest
  ) => Promise<WorkspaceUpdateMemorySpaceTitleResponse>;
  readonly closeWorkspace: (payload: WorkspaceCloseRequest) => Promise<WorkspaceCloseResponse>;
  readonly readWorkspaceSnapshot: (
    payload: WorkspaceReadWorkspaceSnapshotRequest
  ) => Promise<WorkspaceReadWorkspaceSnapshotResponse>;
  readonly createMemory: (
    payload: WorkspaceCreateMemoryRequest
  ) => Promise<WorkspaceCreateMemoryResponse>;
  readonly deleteMemory: (
    payload: WorkspaceDeleteMemoryRequest
  ) => Promise<WorkspaceDeleteMemoryResponse>;
  readonly restoreDeletedMemory: (
    payload: WorkspaceRestoreDeletedMemoryRequest
  ) => Promise<WorkspaceRestoreDeletedMemoryResponse>;
  readonly deleteSegment: (
    payload: WorkspaceDeleteSegmentRequest
  ) => Promise<WorkspaceDeleteSegmentResponse>;
  readonly restoreDeletedSegment: (
    payload: WorkspaceRestoreDeletedSegmentRequest
  ) => Promise<WorkspaceRestoreDeletedSegmentResponse>;
  readonly deleteSegmentSupplement: (
    payload: WorkspaceDeleteSegmentSupplementRequest
  ) => Promise<WorkspaceDeleteSegmentSupplementResponse>;
  readonly restoreDeletedSegmentSupplement: (
    payload: WorkspaceRestoreDeletedSegmentSupplementRequest
  ) => Promise<WorkspaceRestoreDeletedSegmentSupplementResponse>;
  readonly readMemoryDetail: (
    payload: WorkspaceReadMemoryDetailRequest
  ) => Promise<WorkspaceReadMemoryDetailResponse>;
  readonly readFinalizedAudioSegment: (
    payload: WorkspaceReadFinalizedAudioSegmentRequest
  ) => Promise<WorkspaceReadFinalizedAudioSegmentResponse>;
  readonly readFinalizedAudioSegmentSupplement: (
    payload: WorkspaceReadFinalizedAudioSegmentSupplementRequest
  ) => Promise<WorkspaceReadFinalizedAudioSegmentSupplementResponse>;
  readonly createRecordingDraft: (
    payload: WorkspaceHandleRequest
  ) => Promise<WorkspaceCreateRecordingDraftResponse>;
  readonly createSegmentSupplementRecordingDraft: (
    payload: WorkspaceCreateSegmentSupplementRecordingDraftRequest
  ) => Promise<WorkspaceCreateSegmentSupplementRecordingDraftResponse>;
  readonly readRecordingDraftAudio: (
    payload: WorkspaceRecordingDraftAudioRequest
  ) => Promise<WorkspaceRecordingDraftAudioResponse>;
  readonly appendRecordingAudioChunk: (
    payload: WorkspaceRecordingAppendRequest
  ) => Promise<WorkspaceRecordingAppendResponse>;
  readonly appendSegmentSupplementRecordingAudioChunk: (
    payload: WorkspaceAppendSegmentSupplementRecordingAudioRequest
  ) => Promise<WorkspaceSegmentSupplementRecordingAppendResponse>;
  readonly cloneRecordingDraftPrefix: (
    payload: WorkspaceRecordingDraftPrefixCloneRequest
  ) => Promise<WorkspaceRecordingDraftPrefixCloneResponse>;
  readonly finalizeRecordingDraft: (
    payload: WorkspaceRecordingFinalizeRequest
  ) => Promise<WorkspaceRecordingFinalizeResponse>;
  readonly finalizeSegmentSupplementRecordingDraft: (
    payload: WorkspaceFinalizeSegmentSupplementRecordingDraftRequest
  ) => Promise<WorkspaceFinalizeSegmentSupplementRecordingDraftResponse>;
  readonly discardRecordingDraft: (
    payload: WorkspaceSegmentIdRequest
  ) => Promise<WorkspaceDiscardRecordingDraftResponse>;
  readonly discardSegmentSupplementRecordingDraft: (
    payload: WorkspaceSegmentSupplementIdRequest
  ) => Promise<WorkspaceDiscardRecordingDraftResponse>;
  readonly updateMemoryTitle: (
    payload: WorkspaceUpdateMemoryTitleRequest
  ) => Promise<WorkspaceUpdateMemoryTitleResponse>;
  readonly updateSegmentTitle: (
    payload: WorkspaceUpdateSegmentTitleRequest
  ) => Promise<WorkspaceUpdateSegmentTitleResponse>;
  readonly updateSegmentSupplementTitle: (
    payload: WorkspaceUpdateSegmentSupplementTitleRequest
  ) => Promise<WorkspaceUpdateSegmentSupplementTitleResponse>;
  readonly saveTranscript: (
    payload: WorkspaceRecordingMarkdownSaveRequest
  ) => Promise<WorkspaceRecordingMarkdownSaveResponse>;
  readonly saveSegmentSupplementTranscript: (
    payload: WorkspaceSegmentSupplementMarkdownSaveRequest
  ) => Promise<WorkspaceSegmentSupplementMarkdownSaveResponse>;
  readonly requestSegmentTranscriptionBackfill: (
    payload: WorkspaceRequestSegmentTranscriptionBackfillRequest
  ) => Promise<WorkspaceRequestSegmentTranscriptionBackfillResponse>;
  readonly requestSegmentSupplementTranscriptionBackfill: (
    payload: WorkspaceRequestSegmentSupplementTranscriptionBackfillRequest
  ) => Promise<WorkspaceRequestSegmentSupplementTranscriptionBackfillResponse>;
  readonly beginMicrophoneIntent: (
    payload: WorkspaceMicrophoneIntentRequest
  ) => Promise<WorkspaceMicrophoneIntentResponse>;
  readonly clearMicrophoneIntent: (
    payload: WorkspaceMicrophoneIntentRequest
  ) => Promise<WorkspaceClearMicrophoneIntentResponse>;
  readonly startRecordingTranscription: (
    payload: WorkspaceRecordingTranscriptionStartRequest
  ) => Promise<WorkspaceRecordingTranscriptionControlResponse>;
  readonly sendRecordingTranscriptionAudio: (
    payload: WorkspaceRecordingTranscriptionAudioRequest
  ) => Promise<WorkspaceRecordingTranscriptionControlResponse>;
  readonly finishRecordingTranscription: (
    payload: WorkspaceRecordingTranscriptionCloseRequest
  ) => Promise<WorkspaceRecordingTranscriptionControlResponse>;
  readonly closeRecordingTranscription: (
    payload: WorkspaceRecordingTranscriptionCloseRequest
  ) => Promise<WorkspaceRecordingTranscriptionControlResponse>;
  readonly readVoiceTranscriptionSettings: (
    payload: WorkspaceReadVoiceTranscriptionSettingsRequest
  ) => Promise<WorkspaceReadVoiceTranscriptionSettingsResponse>;
  readonly setVoiceTranscriptionEnabled: (
    payload: WorkspaceSetVoiceTranscriptionEnabledRequest
  ) => Promise<WorkspaceSetVoiceTranscriptionEnabledResponse>;
  readonly saveVoiceTranscriptionApiKey: (
    payload: WorkspaceSaveVoiceTranscriptionApiKeyRequest
  ) => Promise<WorkspaceSaveVoiceTranscriptionApiKeyResponse>;
  readonly clearVoiceTranscriptionApiKey: (
    payload: WorkspaceClearVoiceTranscriptionApiKeyRequest
  ) => Promise<WorkspaceClearVoiceTranscriptionApiKeyResponse>;
  readonly validateVoiceTranscriptionCredentials: (
    payload: WorkspaceValidateVoiceTranscriptionCredentialsRequest
  ) => Promise<WorkspaceValidateVoiceTranscriptionCredentialsResponse>;
  readonly openVoiceTranscriptionProviderConsole: () => Promise<WorkspaceOpenVoiceTranscriptionProviderConsoleResponse>;
  readonly onRecordingTranscriptionEvent: (
    callback: (event: WorkspaceRecordingTranscriptionEvent) => void
  ) => () => void;
}

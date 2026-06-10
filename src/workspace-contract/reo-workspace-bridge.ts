import type {
  WorkspaceChooseDirectoryResponse,
  WorkspaceClearMicrophoneIntentResponse,
  WorkspaceClearVoiceTranscriptionApiKeyRequest,
  WorkspaceClearVoiceTranscriptionApiKeyResponse,
  WorkspaceCloseRequest,
  WorkspaceCloseResponse,
  WorkspaceCopyArtifactAgentPromptRequest,
  WorkspaceCopyWidgetAbsolutePathRequest,
  WorkspaceCopyWidgetAgentPromptRequest,
  WorkspaceCopyWidgetRelativePathRequest,
  WorkspaceCopyMemoryAbsolutePathRequest,
  WorkspaceCopyMemoryRelativePathRequest,
  WorkspaceCopyMemorySpaceAbsolutePathRequest,
  WorkspaceCopyNeedsReviewAgentPromptRequest,
  WorkspaceCopySegmentAbsolutePathRequest,
  WorkspaceCopySegmentRelativePathRequest,
  WorkspaceCopySegmentSupplementAbsolutePathRequest,
  WorkspaceCopySegmentSupplementRelativePathRequest,
  WorkspaceCreateMemoryRequest,
  WorkspaceCreateMemoryResponse,
  WorkspaceCreateNoteSegmentDraftRequest,
  WorkspaceCreateNoteSegmentDraftResponse,
  WorkspaceDeleteWidgetRequest,
  WorkspaceDeleteWidgetResponse,
  WorkspaceDeleteMemoryRequest,
  WorkspaceDeleteMemoryResponse,
  WorkspaceDeleteSegmentSupplementRequest,
  WorkspaceDeleteSegmentSupplementResponse,
  WorkspaceDeleteSegmentRequest,
  WorkspaceDeleteSegmentResponse,
  WorkspaceCreateRecordingDraftResponse,
  WorkspaceCreateSegmentSupplementNoteDraftRequest,
  WorkspaceCreateSegmentSupplementNoteDraftResponse,
  WorkspaceCreateSegmentSupplementRecordingDraftRequest,
  WorkspaceCreateSegmentSupplementRecordingDraftResponse,
  WorkspaceDiscardRecordingDraftResponse,
  WorkspaceFinalizeNoteSegmentDraftRequest,
  WorkspaceFinalizeNoteSegmentDraftResponse,
  WorkspaceFinalizeSegmentSupplementNoteDraftRequest,
  WorkspaceFinalizeSegmentSupplementNoteDraftResponse,
  WorkspaceFinalizeSegmentSupplementRecordingDraftRequest,
  WorkspaceFinalizeSegmentSupplementRecordingDraftResponse,
  WorkspaceHandleRequest,
  WorkspaceInitializeRequest,
  WorkspaceInitializeResponse,
  WorkspaceEntityActionResponse,
  WorkspaceListMemorySpacesResponse,
  WorkspaceListEntityMoveTargetsRequest,
  WorkspaceListEntityMoveTargetsResponse,
  WorkspaceMemorySpaceIdRequest,
  WorkspaceMicrophoneIntentRequest,
  WorkspaceMicrophoneIntentResponse,
  WorkspaceMoveMemoryRequest,
  WorkspaceMoveMemoryResponse,
  WorkspaceMoveSegmentRequest,
  WorkspaceMoveSegmentResponse,
  WorkspaceMoveSegmentSupplementRequest,
  WorkspaceMoveSegmentSupplementResponse,
  WorkspaceOpenMarkdownExternalLinkRequest,
  WorkspaceOpenMarkdownExternalLinkResponse,
  WorkspaceOpenVoiceTranscriptionProviderConsoleResponse,
  WorkspaceOpenWidgetDocumentRequest,
  WorkspaceOpenMemoryDocumentRequest,
  WorkspaceOpenMemorySpaceAgentsFileRequest,
  WorkspaceOpenRequest,
  WorkspaceOpenSystemDraftWorkspaceResponse,
  WorkspaceOpenSegmentDocumentRequest,
  WorkspaceOpenSegmentSupplementDocumentRequest,
  WorkspaceReadArtifactRuntimeStateRequest,
  WorkspaceReadArtifactRuntimeStateResponse,
  WorkspaceReadSegmentContentRequest,
  WorkspaceReadSegmentContentResponse,
  WorkspaceReadSegmentSpeechAudioRequest,
  WorkspaceReadSegmentSpeechAudioResponse,
  WorkspaceReadSegmentSupplementContentRequest,
  WorkspaceReadSegmentSupplementContentResponse,
  WorkspaceReadSegmentSupplementSpeechAudioRequest,
  WorkspaceReadSegmentSupplementSpeechAudioResponse,
  WorkspaceSaveSegmentAttachmentRequest,
  WorkspaceSaveSegmentSupplementAttachmentRequest,
  WorkspaceListSegmentAttachmentsRequest,
  WorkspaceListSegmentSupplementAttachmentsRequest,
  WorkspaceSaveAttachmentResponse,
  WorkspaceListAttachmentsResponse,
  WorkspaceReadFinalizedAudioSegmentRequest,
  WorkspaceReadFinalizedAudioSegmentAudioRequest,
  WorkspaceReadFinalizedAudioSegmentAudioResponse,
  WorkspaceReadFinalizedAudioSegmentResponse,
  WorkspaceReadFinalizedAudioSegmentSupplementRequest,
  WorkspaceReadFinalizedAudioSegmentSupplementAudioRequest,
  WorkspaceReadFinalizedAudioSegmentSupplementAudioResponse,
  WorkspaceReadFinalizedAudioSegmentSupplementResponse,
  WorkspaceReadMemoryDetailRequest,
  WorkspaceReadMemoryDetailResponse,
  WorkspaceReadExpressionPlaybackAudioRequest,
  WorkspaceReadExpressionPlaybackAudioResponse,
  WorkspaceReadRecentExpressionsRequest,
  WorkspaceReadRecentExpressionsResponse,
  WorkspaceReadAppPermissionStatusRequest,
  WorkspaceReadAppPermissionStatusResponse,
  WorkspaceRequestAppPermissionRequest,
  WorkspaceRequestAppPermissionResponse,
  WorkspaceReadVoiceTranscriptionSettingsRequest,
  WorkspaceReadVoiceTranscriptionSettingsResponse,
  WorkspaceReadSystemDraftWorkspaceResponse,
  WorkspaceReadWorkspaceSnapshotRequest,
  WorkspaceReadWorkspaceSnapshotResponse,
  WorkspaceResetMemoryCoverRequest,
  WorkspaceResetMemoryCoverResponse,
  WorkspaceResetSegmentCoverRequest,
  WorkspaceResetSegmentCoverResponse,
  WorkspaceRestoreDeletedWidgetRequest,
  WorkspaceRestoreDeletedWidgetResponse,
  WorkspaceRestoreDeletedMemoryRequest,
  WorkspaceRestoreDeletedMemoryResponse,
  WorkspaceRestoreMemoryCoverRequest,
  WorkspaceRestoreMemoryCoverResponse,
  WorkspaceRestoreSegmentCoverRequest,
  WorkspaceRestoreSegmentCoverResponse,
  WorkspaceSwitchMemoryDefaultCoverRequest,
  WorkspaceSwitchMemoryDefaultCoverResponse,
  WorkspaceSwitchSegmentDefaultCoverRequest,
  WorkspaceSwitchSegmentDefaultCoverResponse,
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
  WorkspaceFileTruthChangedEvent,
  WorkspaceRecordingTranscriptionStartRequest,
  WorkspaceRevealWidgetInFinderRequest,
  WorkspaceRevealMemoryInFinderRequest,
  WorkspaceRevealMemorySpaceInFinderRequest,
  WorkspaceRevealSegmentInFinderRequest,
  WorkspaceRevealSegmentSupplementInFinderRequest,
  WorkspaceSegmentSupplementIdRequest,
  WorkspaceSegmentSupplementRecordingAppendResponse,
  WorkspaceSegmentIdRequest,
  WorkspaceRecordingMarkdownSaveRequest,
  WorkspaceRecordingMarkdownSaveResponse,
  WorkspaceRequestSegmentSupplementTranscriptionBackfillRequest,
  WorkspaceRequestSegmentSupplementTranscriptionBackfillResponse,
  WorkspaceRequestSegmentSupplementSpeechSynthesisRequest,
  WorkspaceRequestSegmentSupplementSpeechSynthesisResponse,
  WorkspaceRequestSegmentTranscriptionBackfillRequest,
  WorkspaceRequestSegmentTranscriptionBackfillResponse,
  WorkspaceRequestSegmentSpeechSynthesisRequest,
  WorkspaceRequestSegmentSpeechSynthesisResponse,
  WorkspaceRegenerateImportedSpeechSynthesisRequest,
  WorkspaceRegenerateImportedSpeechSynthesisResponse,
  WorkspaceSegmentSupplementMarkdownSaveRequest,
  WorkspaceSegmentSupplementMarkdownSaveResponse,
  WorkspaceRemoveMemorySpaceResponse,
  WorkspaceSaveVoiceTranscriptionApiKeyRequest,
  WorkspaceSaveVoiceTranscriptionApiKeyResponse,
  WorkspaceSetVoiceSpeechSynthesisSpeakerRequest,
  WorkspaceSetVoiceSpeechSynthesisSpeakerResponse,
  WorkspaceSetVoiceTranscriptionEnabledRequest,
  WorkspaceSetVoiceTranscriptionEnabledResponse,
  WorkspaceUpdateWidgetTabOrderRequest,
  WorkspaceUpdateWidgetTabOrderResponse,
  WorkspaceUpdateWidgetTitleRequest,
  WorkspaceUpdateWidgetTitleResponse,
  WorkspaceUpdateMemorySpaceTitleRequest,
  WorkspaceUpdateMemorySpaceTitleResponse,
  WorkspaceUpdateMemoryTitleRequest,
  WorkspaceUpdateMemoryTitleResponse,
  WorkspaceUpdateSegmentContentTitleRequest,
  WorkspaceUpdateSegmentContentTitleResponse,
  WorkspaceUpdateSegmentContentTabOrderRequest,
  WorkspaceUpdateSegmentContentTabOrderResponse,
  WorkspaceUpdateSegmentSupplementTitleRequest,
  WorkspaceUpdateSegmentSupplementTitleResponse,
  WorkspaceUpdateSegmentTitleRequest,
  WorkspaceUpdateSegmentTitleResponse,
  WorkspaceValidateVoiceTranscriptionCredentialsRequest,
  WorkspaceValidateVoiceTranscriptionCredentialsResponse,
  WorkspaceWriteArtifactRuntimeStateRequest,
  WorkspaceWriteArtifactRuntimeStateResponse,
  WorkspaceWriteNoteSegmentDraftBodyRequest,
  WorkspaceWriteNoteSegmentDraftBodyResponse,
  WorkspaceWriteSegmentContentRequest,
  WorkspaceWriteSegmentContentResponse,
  WorkspaceWriteSegmentSupplementContentRequest,
  WorkspaceWriteSegmentSupplementContentResponse,
  WorkspaceWriteSegmentSupplementNoteDraftBodyRequest,
  WorkspaceWriteSegmentSupplementNoteDraftBodyResponse,
} from './workspace-contract.js';

export interface ReoWorkspaceBridge {
  readonly chooseDirectory: () => Promise<WorkspaceChooseDirectoryResponse>;
  readonly listMemorySpaces: () => Promise<WorkspaceListMemorySpacesResponse>;
  readonly listEntityMoveTargets: (
    payload: WorkspaceListEntityMoveTargetsRequest
  ) => Promise<WorkspaceListEntityMoveTargetsResponse>;
  readonly readSystemDraftWorkspace: () => Promise<WorkspaceReadSystemDraftWorkspaceResponse>;
  readonly openSystemDraftWorkspace: () => Promise<WorkspaceOpenSystemDraftWorkspaceResponse>;
  readonly readRecentExpressions: (
    payload: WorkspaceReadRecentExpressionsRequest
  ) => Promise<WorkspaceReadRecentExpressionsResponse>;
  readonly readExpressionPlaybackAudio: (
    payload: WorkspaceReadExpressionPlaybackAudioRequest
  ) => Promise<WorkspaceReadExpressionPlaybackAudioResponse>;
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
  readonly revealWidgetInFinder: (
    payload: WorkspaceRevealWidgetInFinderRequest
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
  readonly openWidgetDocument: (
    payload: WorkspaceOpenWidgetDocumentRequest
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
  readonly copyWidgetAbsolutePath: (
    payload: WorkspaceCopyWidgetAbsolutePathRequest
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
  readonly copyWidgetRelativePath: (
    payload: WorkspaceCopyWidgetRelativePathRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly copyArtifactAgentPrompt: (
    payload: WorkspaceCopyArtifactAgentPromptRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly copyWidgetAgentPrompt: (
    payload: WorkspaceCopyWidgetAgentPromptRequest
  ) => Promise<WorkspaceEntityActionResponse>;
  readonly readArtifactRuntimeState: (
    payload: WorkspaceReadArtifactRuntimeStateRequest
  ) => Promise<WorkspaceReadArtifactRuntimeStateResponse>;
  readonly writeArtifactRuntimeState: (
    payload: WorkspaceWriteArtifactRuntimeStateRequest
  ) => Promise<WorkspaceWriteArtifactRuntimeStateResponse>;
  readonly copyNeedsReviewAgentPrompt: (
    payload: WorkspaceCopyNeedsReviewAgentPromptRequest
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
  readonly moveMemory: (
    payload: WorkspaceMoveMemoryRequest
  ) => Promise<WorkspaceMoveMemoryResponse>;
  readonly deleteMemory: (
    payload: WorkspaceDeleteMemoryRequest
  ) => Promise<WorkspaceDeleteMemoryResponse>;
  readonly restoreDeletedMemory: (
    payload: WorkspaceRestoreDeletedMemoryRequest
  ) => Promise<WorkspaceRestoreDeletedMemoryResponse>;
  readonly resetMemoryCover: (
    payload: WorkspaceResetMemoryCoverRequest
  ) => Promise<WorkspaceResetMemoryCoverResponse>;
  readonly restoreMemoryCover: (
    payload: WorkspaceRestoreMemoryCoverRequest
  ) => Promise<WorkspaceRestoreMemoryCoverResponse>;
  readonly switchMemoryDefaultCover: (
    payload: WorkspaceSwitchMemoryDefaultCoverRequest
  ) => Promise<WorkspaceSwitchMemoryDefaultCoverResponse>;
  readonly resetSegmentCover: (
    payload: WorkspaceResetSegmentCoverRequest
  ) => Promise<WorkspaceResetSegmentCoverResponse>;
  readonly restoreSegmentCover: (
    payload: WorkspaceRestoreSegmentCoverRequest
  ) => Promise<WorkspaceRestoreSegmentCoverResponse>;
  readonly switchSegmentDefaultCover: (
    payload: WorkspaceSwitchSegmentDefaultCoverRequest
  ) => Promise<WorkspaceSwitchSegmentDefaultCoverResponse>;
  readonly deleteSegment: (
    payload: WorkspaceDeleteSegmentRequest
  ) => Promise<WorkspaceDeleteSegmentResponse>;
  readonly moveSegment: (
    payload: WorkspaceMoveSegmentRequest
  ) => Promise<WorkspaceMoveSegmentResponse>;
  readonly restoreDeletedSegment: (
    payload: WorkspaceRestoreDeletedSegmentRequest
  ) => Promise<WorkspaceRestoreDeletedSegmentResponse>;
  readonly deleteSegmentSupplement: (
    payload: WorkspaceDeleteSegmentSupplementRequest
  ) => Promise<WorkspaceDeleteSegmentSupplementResponse>;
  readonly moveSegmentSupplement: (
    payload: WorkspaceMoveSegmentSupplementRequest
  ) => Promise<WorkspaceMoveSegmentSupplementResponse>;
  readonly restoreDeletedSegmentSupplement: (
    payload: WorkspaceRestoreDeletedSegmentSupplementRequest
  ) => Promise<WorkspaceRestoreDeletedSegmentSupplementResponse>;
  readonly deleteWidget: (
    payload: WorkspaceDeleteWidgetRequest
  ) => Promise<WorkspaceDeleteWidgetResponse>;
  readonly restoreDeletedWidget: (
    payload: WorkspaceRestoreDeletedWidgetRequest
  ) => Promise<WorkspaceRestoreDeletedWidgetResponse>;
  readonly readMemoryDetail: (
    payload: WorkspaceReadMemoryDetailRequest
  ) => Promise<WorkspaceReadMemoryDetailResponse>;
  readonly readFinalizedAudioSegment: (
    payload: WorkspaceReadFinalizedAudioSegmentRequest
  ) => Promise<WorkspaceReadFinalizedAudioSegmentResponse>;
  readonly readFinalizedAudioSegmentSupplement: (
    payload: WorkspaceReadFinalizedAudioSegmentSupplementRequest
  ) => Promise<WorkspaceReadFinalizedAudioSegmentSupplementResponse>;
  readonly readFinalizedAudioSegmentAudio: (
    payload: WorkspaceReadFinalizedAudioSegmentAudioRequest
  ) => Promise<WorkspaceReadFinalizedAudioSegmentAudioResponse>;
  readonly readFinalizedAudioSegmentSupplementAudio: (
    payload: WorkspaceReadFinalizedAudioSegmentSupplementAudioRequest
  ) => Promise<WorkspaceReadFinalizedAudioSegmentSupplementAudioResponse>;
  readonly createRecordingDraft: (
    payload: WorkspaceHandleRequest
  ) => Promise<WorkspaceCreateRecordingDraftResponse>;
  readonly createSegmentSupplementRecordingDraft: (
    payload: WorkspaceCreateSegmentSupplementRecordingDraftRequest
  ) => Promise<WorkspaceCreateSegmentSupplementRecordingDraftResponse>;
  readonly createNoteSegmentDraft: (
    payload: WorkspaceCreateNoteSegmentDraftRequest
  ) => Promise<WorkspaceCreateNoteSegmentDraftResponse>;
  readonly createSegmentSupplementNoteDraft: (
    payload: WorkspaceCreateSegmentSupplementNoteDraftRequest
  ) => Promise<WorkspaceCreateSegmentSupplementNoteDraftResponse>;
  readonly writeNoteSegmentDraftBody: (
    payload: WorkspaceWriteNoteSegmentDraftBodyRequest
  ) => Promise<WorkspaceWriteNoteSegmentDraftBodyResponse>;
  readonly writeSegmentSupplementNoteDraftBody: (
    payload: WorkspaceWriteSegmentSupplementNoteDraftBodyRequest
  ) => Promise<WorkspaceWriteSegmentSupplementNoteDraftBodyResponse>;
  readonly finalizeNoteSegmentDraft: (
    payload: WorkspaceFinalizeNoteSegmentDraftRequest
  ) => Promise<WorkspaceFinalizeNoteSegmentDraftResponse>;
  readonly finalizeSegmentSupplementNoteDraft: (
    payload: WorkspaceFinalizeSegmentSupplementNoteDraftRequest
  ) => Promise<WorkspaceFinalizeSegmentSupplementNoteDraftResponse>;
  readonly readSegmentContent: (
    payload: WorkspaceReadSegmentContentRequest
  ) => Promise<WorkspaceReadSegmentContentResponse>;
  readonly readSegmentSupplementContent: (
    payload: WorkspaceReadSegmentSupplementContentRequest
  ) => Promise<WorkspaceReadSegmentSupplementContentResponse>;
  readonly readSegmentSpeechAudio: (
    payload: WorkspaceReadSegmentSpeechAudioRequest
  ) => Promise<WorkspaceReadSegmentSpeechAudioResponse>;
  readonly readSegmentSupplementSpeechAudio: (
    payload: WorkspaceReadSegmentSupplementSpeechAudioRequest
  ) => Promise<WorkspaceReadSegmentSupplementSpeechAudioResponse>;
  readonly writeSegmentContent: (
    payload: WorkspaceWriteSegmentContentRequest
  ) => Promise<WorkspaceWriteSegmentContentResponse>;
  readonly writeSegmentSupplementContent: (
    payload: WorkspaceWriteSegmentSupplementContentRequest
  ) => Promise<WorkspaceWriteSegmentSupplementContentResponse>;
  readonly saveSegmentAttachment: (
    payload: WorkspaceSaveSegmentAttachmentRequest
  ) => Promise<WorkspaceSaveAttachmentResponse>;
  readonly listSegmentAttachments: (
    payload: WorkspaceListSegmentAttachmentsRequest
  ) => Promise<WorkspaceListAttachmentsResponse>;
  readonly saveSegmentSupplementAttachment: (
    payload: WorkspaceSaveSegmentSupplementAttachmentRequest
  ) => Promise<WorkspaceSaveAttachmentResponse>;
  readonly listSegmentSupplementAttachments: (
    payload: WorkspaceListSegmentSupplementAttachmentsRequest
  ) => Promise<WorkspaceListAttachmentsResponse>;
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
  readonly updateSegmentContentTitle: (
    payload: WorkspaceUpdateSegmentContentTitleRequest
  ) => Promise<WorkspaceUpdateSegmentContentTitleResponse>;
  readonly updateSegmentSupplementTitle: (
    payload: WorkspaceUpdateSegmentSupplementTitleRequest
  ) => Promise<WorkspaceUpdateSegmentSupplementTitleResponse>;
  readonly updateSegmentContentTabOrder: (
    payload: WorkspaceUpdateSegmentContentTabOrderRequest
  ) => Promise<WorkspaceUpdateSegmentContentTabOrderResponse>;
  readonly updateWidgetTitle: (
    payload: WorkspaceUpdateWidgetTitleRequest
  ) => Promise<WorkspaceUpdateWidgetTitleResponse>;
  readonly updateWidgetTabOrder: (
    payload: WorkspaceUpdateWidgetTabOrderRequest
  ) => Promise<WorkspaceUpdateWidgetTabOrderResponse>;
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
  readonly requestSegmentSpeechSynthesis: (
    payload: WorkspaceRequestSegmentSpeechSynthesisRequest
  ) => Promise<WorkspaceRequestSegmentSpeechSynthesisResponse>;
  readonly requestSegmentSupplementSpeechSynthesis: (
    payload: WorkspaceRequestSegmentSupplementSpeechSynthesisRequest
  ) => Promise<WorkspaceRequestSegmentSupplementSpeechSynthesisResponse>;
  readonly regenerateImportedSpeechSynthesis: (
    payload: WorkspaceRegenerateImportedSpeechSynthesisRequest
  ) => Promise<WorkspaceRegenerateImportedSpeechSynthesisResponse>;
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
  readonly readAppPermissionStatus: (
    payload: WorkspaceReadAppPermissionStatusRequest
  ) => Promise<WorkspaceReadAppPermissionStatusResponse>;
  readonly requestAppPermission: (
    payload: WorkspaceRequestAppPermissionRequest
  ) => Promise<WorkspaceRequestAppPermissionResponse>;
  readonly readVoiceTranscriptionSettings: (
    payload: WorkspaceReadVoiceTranscriptionSettingsRequest
  ) => Promise<WorkspaceReadVoiceTranscriptionSettingsResponse>;
  readonly setVoiceTranscriptionEnabled: (
    payload: WorkspaceSetVoiceTranscriptionEnabledRequest
  ) => Promise<WorkspaceSetVoiceTranscriptionEnabledResponse>;
  readonly setVoiceSpeechSynthesisSpeaker: (
    payload: WorkspaceSetVoiceSpeechSynthesisSpeakerRequest
  ) => Promise<WorkspaceSetVoiceSpeechSynthesisSpeakerResponse>;
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
  readonly openMarkdownExternalLink: (
    payload: WorkspaceOpenMarkdownExternalLinkRequest
  ) => Promise<WorkspaceOpenMarkdownExternalLinkResponse>;
  readonly onRecordingTranscriptionEvent: (
    callback: (event: WorkspaceRecordingTranscriptionEvent) => void
  ) => () => void;
  readonly onFileTruthChanged: (
    callback: (event: WorkspaceFileTruthChangedEvent) => void
  ) => () => void;
}

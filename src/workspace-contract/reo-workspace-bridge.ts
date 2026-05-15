import type {
  WorkspaceChooseDirectoryResponse,
  WorkspaceClearMicrophoneIntentResponse,
  WorkspaceCloseRequest,
  WorkspaceCloseResponse,
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
  WorkspaceListMemorySpacesResponse,
  WorkspaceMemorySpaceIdRequest,
  WorkspaceMicrophoneIntentRequest,
  WorkspaceMicrophoneIntentResponse,
  WorkspaceOpenRequest,
  WorkspaceReadFinalizedAudioSegmentRequest,
  WorkspaceReadFinalizedAudioSegmentResponse,
  WorkspaceReadFinalizedAudioSegmentSupplementRequest,
  WorkspaceReadFinalizedAudioSegmentSupplementResponse,
  WorkspaceReadMemoryDetailRequest,
  WorkspaceReadMemoryDetailResponse,
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
  WorkspaceSegmentSupplementIdRequest,
  WorkspaceSegmentSupplementRecordingAppendResponse,
  WorkspaceSegmentIdRequest,
  WorkspaceRecordingMarkdownSaveRequest,
  WorkspaceRecordingMarkdownSaveResponse,
  WorkspaceSegmentSupplementMarkdownSaveRequest,
  WorkspaceSegmentSupplementMarkdownSaveResponse,
  WorkspaceRemoveMemorySpaceResponse,
  WorkspaceUpdateMemorySpaceTitleRequest,
  WorkspaceUpdateMemorySpaceTitleResponse,
  WorkspaceUpdateMemoryTitleRequest,
  WorkspaceUpdateMemoryTitleResponse,
  WorkspaceUpdateSegmentSupplementTitleRequest,
  WorkspaceUpdateSegmentSupplementTitleResponse,
  WorkspaceUpdateSegmentTitleRequest,
  WorkspaceUpdateSegmentTitleResponse,
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
  readonly onRecordingTranscriptionEvent: (
    callback: (event: WorkspaceRecordingTranscriptionEvent) => void
  ) => () => void;
}

import type {
  WorkspaceChooseDirectoryResponse,
  WorkspaceClearMicrophoneIntentResponse,
  WorkspaceCloseRequest,
  WorkspaceCloseResponse,
  WorkspaceCreateMemoryRequest,
  WorkspaceCreateMemoryResponse,
  WorkspaceDeleteMemoryRequest,
  WorkspaceDeleteMemoryResponse,
  WorkspaceDeleteSegmentAttachmentRequest,
  WorkspaceDeleteSegmentAttachmentResponse,
  WorkspaceDeleteSegmentRequest,
  WorkspaceDeleteSegmentResponse,
  WorkspaceCreateRecordingDraftResponse,
  WorkspaceCreateSegmentAttachmentRecordingDraftRequest,
  WorkspaceCreateSegmentAttachmentRecordingDraftResponse,
  WorkspaceDiscardRecordingDraftResponse,
  WorkspaceFinalizeSegmentAttachmentRecordingDraftRequest,
  WorkspaceFinalizeSegmentAttachmentRecordingDraftResponse,
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
  WorkspaceReadFinalizedAudioSegmentAttachmentRequest,
  WorkspaceReadFinalizedAudioSegmentAttachmentResponse,
  WorkspaceReadMemoryDetailRequest,
  WorkspaceReadMemoryDetailResponse,
  WorkspaceReadWorkspaceSnapshotRequest,
  WorkspaceReadWorkspaceSnapshotResponse,
  WorkspaceRestoreDeletedMemoryRequest,
  WorkspaceRestoreDeletedMemoryResponse,
  WorkspaceRestoreDeletedSegmentAttachmentRequest,
  WorkspaceRestoreDeletedSegmentAttachmentResponse,
  WorkspaceRestoreDeletedSegmentRequest,
  WorkspaceRestoreDeletedSegmentResponse,
  WorkspaceRecordingAppendRequest,
  WorkspaceRecordingAppendResponse,
  WorkspaceAppendSegmentAttachmentRecordingAudioRequest,
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
  WorkspaceSegmentAttachmentIdRequest,
  WorkspaceSegmentAttachmentRecordingAppendResponse,
  WorkspaceSegmentIdRequest,
  WorkspaceRecordingMarkdownSaveRequest,
  WorkspaceRecordingMarkdownSaveResponse,
  WorkspaceRemoveMemorySpaceResponse,
  WorkspaceUpdateMemorySpaceTitleRequest,
  WorkspaceUpdateMemorySpaceTitleResponse,
  WorkspaceUpdateMemoryTitleRequest,
  WorkspaceUpdateMemoryTitleResponse,
  WorkspaceUpdateSegmentAttachmentTitleRequest,
  WorkspaceUpdateSegmentAttachmentTitleResponse,
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
  readonly deleteSegmentAttachment: (
    payload: WorkspaceDeleteSegmentAttachmentRequest
  ) => Promise<WorkspaceDeleteSegmentAttachmentResponse>;
  readonly restoreDeletedSegmentAttachment: (
    payload: WorkspaceRestoreDeletedSegmentAttachmentRequest
  ) => Promise<WorkspaceRestoreDeletedSegmentAttachmentResponse>;
  readonly readMemoryDetail: (
    payload: WorkspaceReadMemoryDetailRequest
  ) => Promise<WorkspaceReadMemoryDetailResponse>;
  readonly readFinalizedAudioSegment: (
    payload: WorkspaceReadFinalizedAudioSegmentRequest
  ) => Promise<WorkspaceReadFinalizedAudioSegmentResponse>;
  readonly readFinalizedAudioSegmentAttachment: (
    payload: WorkspaceReadFinalizedAudioSegmentAttachmentRequest
  ) => Promise<WorkspaceReadFinalizedAudioSegmentAttachmentResponse>;
  readonly createRecordingDraft: (
    payload: WorkspaceHandleRequest
  ) => Promise<WorkspaceCreateRecordingDraftResponse>;
  readonly createSegmentAttachmentRecordingDraft: (
    payload: WorkspaceCreateSegmentAttachmentRecordingDraftRequest
  ) => Promise<WorkspaceCreateSegmentAttachmentRecordingDraftResponse>;
  readonly readRecordingDraftAudio: (
    payload: WorkspaceRecordingDraftAudioRequest
  ) => Promise<WorkspaceRecordingDraftAudioResponse>;
  readonly appendRecordingAudioChunk: (
    payload: WorkspaceRecordingAppendRequest
  ) => Promise<WorkspaceRecordingAppendResponse>;
  readonly appendSegmentAttachmentRecordingAudioChunk: (
    payload: WorkspaceAppendSegmentAttachmentRecordingAudioRequest
  ) => Promise<WorkspaceSegmentAttachmentRecordingAppendResponse>;
  readonly cloneRecordingDraftPrefix: (
    payload: WorkspaceRecordingDraftPrefixCloneRequest
  ) => Promise<WorkspaceRecordingDraftPrefixCloneResponse>;
  readonly finalizeRecordingDraft: (
    payload: WorkspaceRecordingFinalizeRequest
  ) => Promise<WorkspaceRecordingFinalizeResponse>;
  readonly finalizeSegmentAttachmentRecordingDraft: (
    payload: WorkspaceFinalizeSegmentAttachmentRecordingDraftRequest
  ) => Promise<WorkspaceFinalizeSegmentAttachmentRecordingDraftResponse>;
  readonly discardRecordingDraft: (
    payload: WorkspaceSegmentIdRequest
  ) => Promise<WorkspaceDiscardRecordingDraftResponse>;
  readonly discardSegmentAttachmentRecordingDraft: (
    payload: WorkspaceSegmentAttachmentIdRequest
  ) => Promise<WorkspaceDiscardRecordingDraftResponse>;
  readonly updateMemoryTitle: (
    payload: WorkspaceUpdateMemoryTitleRequest
  ) => Promise<WorkspaceUpdateMemoryTitleResponse>;
  readonly updateSegmentTitle: (
    payload: WorkspaceUpdateSegmentTitleRequest
  ) => Promise<WorkspaceUpdateSegmentTitleResponse>;
  readonly updateSegmentAttachmentTitle: (
    payload: WorkspaceUpdateSegmentAttachmentTitleRequest
  ) => Promise<WorkspaceUpdateSegmentAttachmentTitleResponse>;
  readonly saveTranscript: (
    payload: WorkspaceRecordingMarkdownSaveRequest
  ) => Promise<WorkspaceRecordingMarkdownSaveResponse>;
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

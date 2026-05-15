import {
  WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_APPEND_SEGMENT_ATTACHMENT_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_BEGIN_MICROPHONE_INTENT_CHANNEL,
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_CLEAR_MICROPHONE_INTENT_CHANNEL,
  WORKSPACE_CLOSE_CHANNEL,
  WORKSPACE_CLOSE_RECORDING_TRANSCRIPTION_CHANNEL,
  WORKSPACE_CLONE_RECORDING_DRAFT_PREFIX_CHANNEL,
  WORKSPACE_CREATE_MEMORY_CHANNEL,
  WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_CREATE_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DELETE_MEMORY_CHANNEL,
  WORKSPACE_DELETE_SEGMENT_ATTACHMENT_CHANNEL,
  WORKSPACE_DELETE_SEGMENT_CHANNEL,
  WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DISCARD_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_FINISH_RECORDING_TRANSCRIPTION_CHANNEL,
  WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_FINALIZE_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_INITIALIZE_CHANNEL,
  WORKSPACE_LIST_MEMORY_SPACES_CHANNEL,
  WORKSPACE_OPEN_CHANNEL,
  WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_ATTACHMENT_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_CHANNEL,
  WORKSPACE_READ_MEMORY_DETAIL_CHANNEL,
  WORKSPACE_READ_RECORDING_DRAFT_AUDIO_CHANNEL,
  WORKSPACE_READ_WORKSPACE_SNAPSHOT_CHANNEL,
  WORKSPACE_REMOVE_MEMORY_SPACE_CHANNEL,
  WORKSPACE_RESTORE_DELETED_MEMORY_CHANNEL,
  WORKSPACE_RESTORE_DELETED_SEGMENT_ATTACHMENT_CHANNEL,
  WORKSPACE_RESTORE_DELETED_SEGMENT_CHANNEL,
  WORKSPACE_RECORDING_TRANSCRIPTION_EVENT_CHANNEL,
  WORKSPACE_SAVE_TRANSCRIPT_CHANNEL,
  WORKSPACE_SEND_RECORDING_TRANSCRIPTION_AUDIO_CHANNEL,
  WORKSPACE_START_RECORDING_TRANSCRIPTION_CHANNEL,
  WORKSPACE_UPDATE_MEMORY_SPACE_TITLE_CHANNEL,
  WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_ATTACHMENT_TITLE_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_TITLE_CHANNEL,
  type WorkspaceIpcChannel,
  type WorkspaceRendererEventChannel,
} from '../workspace-contract/workspace-channels.js';
import type { ReoWorkspaceBridge } from '../workspace-contract/reo-workspace-bridge.js';

export interface WorkspaceBridgeInvoker {
  readonly invoke: (channel: WorkspaceIpcChannel, payload?: unknown) => Promise<unknown>;
  readonly on?: (
    channel: WorkspaceRendererEventChannel,
    listener: (payload: unknown) => void
  ) => () => void;
}

type WorkspaceBridgeMethod = keyof ReoWorkspaceBridge;
type WorkspaceBridgeResponse<Method extends WorkspaceBridgeMethod> = Awaited<
  ReturnType<ReoWorkspaceBridge[Method]>
>;

export function createWorkspaceBridge(invoker: WorkspaceBridgeInvoker): ReoWorkspaceBridge {
  const invoke = <Response>(channel: WorkspaceIpcChannel, payload?: unknown): Promise<Response> =>
    invoker.invoke(channel, payload) as Promise<Response>;

  const bridge: ReoWorkspaceBridge = {
    chooseDirectory: () =>
      invoke<WorkspaceBridgeResponse<'chooseDirectory'>>(WORKSPACE_CHOOSE_DIRECTORY_CHANNEL),
    listMemorySpaces: () =>
      invoke<WorkspaceBridgeResponse<'listMemorySpaces'>>(WORKSPACE_LIST_MEMORY_SPACES_CHANNEL),
    initializeWorkspace: (payload) =>
      invoke<WorkspaceBridgeResponse<'initializeWorkspace'>>(WORKSPACE_INITIALIZE_CHANNEL, payload),
    openWorkspace: (payload) =>
      invoke<WorkspaceBridgeResponse<'openWorkspace'>>(WORKSPACE_OPEN_CHANNEL, payload),
    openMemorySpace: (payload) =>
      invoke<WorkspaceBridgeResponse<'openMemorySpace'>>(
        WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL,
        payload
      ),
    removeMemorySpace: (payload) =>
      invoke<WorkspaceBridgeResponse<'removeMemorySpace'>>(
        WORKSPACE_REMOVE_MEMORY_SPACE_CHANNEL,
        payload
      ),
    updateMemorySpaceTitle: (payload) =>
      invoke<WorkspaceBridgeResponse<'updateMemorySpaceTitle'>>(
        WORKSPACE_UPDATE_MEMORY_SPACE_TITLE_CHANNEL,
        payload
      ),
    closeWorkspace: (payload) =>
      invoke<WorkspaceBridgeResponse<'closeWorkspace'>>(WORKSPACE_CLOSE_CHANNEL, payload),
    readWorkspaceSnapshot: (payload) =>
      invoke<WorkspaceBridgeResponse<'readWorkspaceSnapshot'>>(
        WORKSPACE_READ_WORKSPACE_SNAPSHOT_CHANNEL,
        payload
      ),
    createMemory: (payload) =>
      invoke<WorkspaceBridgeResponse<'createMemory'>>(WORKSPACE_CREATE_MEMORY_CHANNEL, payload),
    deleteMemory: (payload) =>
      invoke<WorkspaceBridgeResponse<'deleteMemory'>>(WORKSPACE_DELETE_MEMORY_CHANNEL, payload),
    restoreDeletedMemory: (payload) =>
      invoke<WorkspaceBridgeResponse<'restoreDeletedMemory'>>(
        WORKSPACE_RESTORE_DELETED_MEMORY_CHANNEL,
        payload
      ),
    deleteSegment: (payload) =>
      invoke<WorkspaceBridgeResponse<'deleteSegment'>>(WORKSPACE_DELETE_SEGMENT_CHANNEL, payload),
    restoreDeletedSegment: (payload) =>
      invoke<WorkspaceBridgeResponse<'restoreDeletedSegment'>>(
        WORKSPACE_RESTORE_DELETED_SEGMENT_CHANNEL,
        payload
      ),
    deleteSegmentAttachment: (payload) =>
      invoke<WorkspaceBridgeResponse<'deleteSegmentAttachment'>>(
        WORKSPACE_DELETE_SEGMENT_ATTACHMENT_CHANNEL,
        payload
      ),
    restoreDeletedSegmentAttachment: (payload) =>
      invoke<WorkspaceBridgeResponse<'restoreDeletedSegmentAttachment'>>(
        WORKSPACE_RESTORE_DELETED_SEGMENT_ATTACHMENT_CHANNEL,
        payload
      ),
    readMemoryDetail: (payload) =>
      invoke<WorkspaceBridgeResponse<'readMemoryDetail'>>(
        WORKSPACE_READ_MEMORY_DETAIL_CHANNEL,
        payload
      ),
    readFinalizedAudioSegment: (payload) =>
      invoke<WorkspaceBridgeResponse<'readFinalizedAudioSegment'>>(
        WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_CHANNEL,
        payload
      ),
    readFinalizedAudioSegmentAttachment: (payload) =>
      invoke<WorkspaceBridgeResponse<'readFinalizedAudioSegmentAttachment'>>(
        WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_ATTACHMENT_CHANNEL,
        payload
      ),
    createRecordingDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'createRecordingDraft'>>(
        WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
        payload
      ),
    createSegmentAttachmentRecordingDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'createSegmentAttachmentRecordingDraft'>>(
        WORKSPACE_CREATE_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
        payload
      ),
    readRecordingDraftAudio: (payload) =>
      invoke<WorkspaceBridgeResponse<'readRecordingDraftAudio'>>(
        WORKSPACE_READ_RECORDING_DRAFT_AUDIO_CHANNEL,
        payload
      ),
    appendRecordingAudioChunk: (payload) =>
      invoke<WorkspaceBridgeResponse<'appendRecordingAudioChunk'>>(
        WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
        payload
      ),
    appendSegmentAttachmentRecordingAudioChunk: (payload) =>
      invoke<WorkspaceBridgeResponse<'appendSegmentAttachmentRecordingAudioChunk'>>(
        WORKSPACE_APPEND_SEGMENT_ATTACHMENT_RECORDING_AUDIO_CHUNK_CHANNEL,
        payload
      ),
    cloneRecordingDraftPrefix: (payload) =>
      invoke<WorkspaceBridgeResponse<'cloneRecordingDraftPrefix'>>(
        WORKSPACE_CLONE_RECORDING_DRAFT_PREFIX_CHANNEL,
        payload
      ),
    finalizeRecordingDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'finalizeRecordingDraft'>>(
        WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
        payload
      ),
    finalizeSegmentAttachmentRecordingDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'finalizeSegmentAttachmentRecordingDraft'>>(
        WORKSPACE_FINALIZE_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
        payload
      ),
    discardRecordingDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'discardRecordingDraft'>>(
        WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
        payload
      ),
    discardSegmentAttachmentRecordingDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'discardSegmentAttachmentRecordingDraft'>>(
        WORKSPACE_DISCARD_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
        payload
      ),
    updateMemoryTitle: (payload) =>
      invoke<WorkspaceBridgeResponse<'updateMemoryTitle'>>(
        WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL,
        payload
      ),
    updateSegmentTitle: (payload) =>
      invoke<WorkspaceBridgeResponse<'updateSegmentTitle'>>(
        WORKSPACE_UPDATE_SEGMENT_TITLE_CHANNEL,
        payload
      ),
    updateSegmentAttachmentTitle: (payload) =>
      invoke<WorkspaceBridgeResponse<'updateSegmentAttachmentTitle'>>(
        WORKSPACE_UPDATE_SEGMENT_ATTACHMENT_TITLE_CHANNEL,
        payload
      ),
    saveTranscript: (payload) =>
      invoke<WorkspaceBridgeResponse<'saveTranscript'>>(WORKSPACE_SAVE_TRANSCRIPT_CHANNEL, payload),
    beginMicrophoneIntent: (payload) =>
      invoke<WorkspaceBridgeResponse<'beginMicrophoneIntent'>>(
        WORKSPACE_BEGIN_MICROPHONE_INTENT_CHANNEL,
        payload
      ),
    clearMicrophoneIntent: (payload) =>
      invoke<WorkspaceBridgeResponse<'clearMicrophoneIntent'>>(
        WORKSPACE_CLEAR_MICROPHONE_INTENT_CHANNEL,
        payload
      ),
    startRecordingTranscription: (payload) =>
      invoke<WorkspaceBridgeResponse<'startRecordingTranscription'>>(
        WORKSPACE_START_RECORDING_TRANSCRIPTION_CHANNEL,
        payload
      ),
    sendRecordingTranscriptionAudio: (payload) =>
      invoke<WorkspaceBridgeResponse<'sendRecordingTranscriptionAudio'>>(
        WORKSPACE_SEND_RECORDING_TRANSCRIPTION_AUDIO_CHANNEL,
        payload
      ),
    finishRecordingTranscription: (payload) =>
      invoke<WorkspaceBridgeResponse<'finishRecordingTranscription'>>(
        WORKSPACE_FINISH_RECORDING_TRANSCRIPTION_CHANNEL,
        payload
      ),
    closeRecordingTranscription: (payload) =>
      invoke<WorkspaceBridgeResponse<'closeRecordingTranscription'>>(
        WORKSPACE_CLOSE_RECORDING_TRANSCRIPTION_CHANNEL,
        payload
      ),
    onRecordingTranscriptionEvent: (callback) =>
      invoker.on?.(WORKSPACE_RECORDING_TRANSCRIPTION_EVENT_CHANNEL, (payload) =>
        callback(payload as Parameters<typeof callback>[0])
      ) ?? (() => {}),
  };
  return Object.freeze(bridge);
}

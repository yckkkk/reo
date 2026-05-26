import {
  WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_APPEND_SEGMENT_SUPPLEMENT_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_BEGIN_MICROPHONE_INTENT_CHANNEL,
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_CLEAR_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
  WORKSPACE_CLEAR_MICROPHONE_INTENT_CHANNEL,
  WORKSPACE_CLOSE_CHANNEL,
  WORKSPACE_CLOSE_RECORDING_TRANSCRIPTION_CHANNEL,
  WORKSPACE_CLONE_RECORDING_DRAFT_PREFIX_CHANNEL,
  WORKSPACE_COPY_MEMORY_ABSOLUTE_PATH_CHANNEL,
  WORKSPACE_COPY_MEMORY_RELATIVE_PATH_CHANNEL,
  WORKSPACE_COPY_MEMORY_SPACE_ABSOLUTE_PATH_CHANNEL,
  WORKSPACE_COPY_SEGMENT_ABSOLUTE_PATH_CHANNEL,
  WORKSPACE_COPY_SEGMENT_RELATIVE_PATH_CHANNEL,
  WORKSPACE_COPY_SEGMENT_SUPPLEMENT_ABSOLUTE_PATH_CHANNEL,
  WORKSPACE_COPY_SEGMENT_SUPPLEMENT_RELATIVE_PATH_CHANNEL,
  WORKSPACE_CREATE_MEMORY_CHANNEL,
  WORKSPACE_CREATE_NOTE_SEGMENT_DRAFT_CHANNEL,
  WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_CHANNEL,
  WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DELETE_MEMORY_CHANNEL,
  WORKSPACE_DELETE_SEGMENT_SUPPLEMENT_CHANNEL,
  WORKSPACE_DELETE_SEGMENT_CHANNEL,
  WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DISCARD_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_FINISH_RECORDING_TRANSCRIPTION_CHANNEL,
  WORKSPACE_FINALIZE_NOTE_SEGMENT_DRAFT_CHANNEL,
  WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_FINALIZE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_CHANNEL,
  WORKSPACE_FINALIZE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_FILE_TRUTH_CHANGED_EVENT_CHANNEL,
  WORKSPACE_INITIALIZE_CHANNEL,
  WORKSPACE_LIST_MEMORY_SPACES_CHANNEL,
  WORKSPACE_OPEN_CHANNEL,
  WORKSPACE_OPEN_MARKDOWN_EXTERNAL_LINK_CHANNEL,
  WORKSPACE_OPEN_VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_CHANNEL,
  WORKSPACE_OPEN_MEMORY_DOCUMENT_CHANNEL,
  WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL,
  WORKSPACE_OPEN_MEMORY_SPACE_AGENTS_FILE_CHANNEL,
  WORKSPACE_OPEN_SEGMENT_DOCUMENT_CHANNEL,
  WORKSPACE_OPEN_SEGMENT_SUPPLEMENT_DOCUMENT_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_SUPPLEMENT_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_CHANNEL,
  WORKSPACE_READ_MEMORY_DETAIL_CHANNEL,
  WORKSPACE_READ_RECORDING_DRAFT_AUDIO_CHANNEL,
  WORKSPACE_READ_SEGMENT_CONTENT_CHANNEL,
  WORKSPACE_READ_SEGMENT_SUPPLEMENT_CONTENT_CHANNEL,
  WORKSPACE_READ_VOICE_TRANSCRIPTION_SETTINGS_CHANNEL,
  WORKSPACE_READ_WORKSPACE_SNAPSHOT_CHANNEL,
  WORKSPACE_REMOVE_MEMORY_SPACE_CHANNEL,
  WORKSPACE_REVEAL_MEMORY_IN_FINDER_CHANNEL,
  WORKSPACE_REVEAL_MEMORY_SPACE_IN_FINDER_CHANNEL,
  WORKSPACE_REVEAL_SEGMENT_IN_FINDER_CHANNEL,
  WORKSPACE_REVEAL_SEGMENT_SUPPLEMENT_IN_FINDER_CHANNEL,
  WORKSPACE_RESTORE_DELETED_MEMORY_CHANNEL,
  WORKSPACE_RESTORE_DELETED_SEGMENT_SUPPLEMENT_CHANNEL,
  WORKSPACE_RESTORE_DELETED_SEGMENT_CHANNEL,
  WORKSPACE_RECORDING_TRANSCRIPTION_EVENT_CHANNEL,
  WORKSPACE_REQUEST_SEGMENT_SUPPLEMENT_TRANSCRIPTION_BACKFILL_CHANNEL,
  WORKSPACE_REQUEST_SEGMENT_TRANSCRIPTION_BACKFILL_CHANNEL,
  WORKSPACE_SAVE_SEGMENT_ATTACHMENT_CHANNEL,
  WORKSPACE_LIST_SEGMENT_ATTACHMENTS_CHANNEL,
  WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_ATTACHMENT_CHANNEL,
  WORKSPACE_LIST_SEGMENT_SUPPLEMENT_ATTACHMENTS_CHANNEL,
  WORKSPACE_SAVE_TRANSCRIPT_CHANNEL,
  WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_TRANSCRIPT_CHANNEL,
  WORKSPACE_SEND_RECORDING_TRANSCRIPTION_AUDIO_CHANNEL,
  WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
  WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL,
  WORKSPACE_START_RECORDING_TRANSCRIPTION_CHANNEL,
  WORKSPACE_UPDATE_MEMORY_SPACE_TITLE_CHANNEL,
  WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_CONTENT_TAB_ORDER_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_CONTENT_TITLE_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_SUPPLEMENT_TITLE_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_TITLE_CHANNEL,
  WORKSPACE_VALIDATE_VOICE_TRANSCRIPTION_CREDENTIALS_CHANNEL,
  WORKSPACE_WRITE_NOTE_SEGMENT_DRAFT_BODY_CHANNEL,
  WORKSPACE_WRITE_SEGMENT_CONTENT_CHANNEL,
  WORKSPACE_WRITE_SEGMENT_SUPPLEMENT_CONTENT_CHANNEL,
  WORKSPACE_WRITE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_BODY_CHANNEL,
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
    revealMemorySpaceInFinder: (payload) =>
      invoke<WorkspaceBridgeResponse<'revealMemorySpaceInFinder'>>(
        WORKSPACE_REVEAL_MEMORY_SPACE_IN_FINDER_CHANNEL,
        payload
      ),
    revealMemoryInFinder: (payload) =>
      invoke<WorkspaceBridgeResponse<'revealMemoryInFinder'>>(
        WORKSPACE_REVEAL_MEMORY_IN_FINDER_CHANNEL,
        payload
      ),
    revealSegmentInFinder: (payload) =>
      invoke<WorkspaceBridgeResponse<'revealSegmentInFinder'>>(
        WORKSPACE_REVEAL_SEGMENT_IN_FINDER_CHANNEL,
        payload
      ),
    revealSegmentSupplementInFinder: (payload) =>
      invoke<WorkspaceBridgeResponse<'revealSegmentSupplementInFinder'>>(
        WORKSPACE_REVEAL_SEGMENT_SUPPLEMENT_IN_FINDER_CHANNEL,
        payload
      ),
    openMemorySpaceAgentsFile: (payload) =>
      invoke<WorkspaceBridgeResponse<'openMemorySpaceAgentsFile'>>(
        WORKSPACE_OPEN_MEMORY_SPACE_AGENTS_FILE_CHANNEL,
        payload
      ),
    openMemoryDocument: (payload) =>
      invoke<WorkspaceBridgeResponse<'openMemoryDocument'>>(
        WORKSPACE_OPEN_MEMORY_DOCUMENT_CHANNEL,
        payload
      ),
    openSegmentDocument: (payload) =>
      invoke<WorkspaceBridgeResponse<'openSegmentDocument'>>(
        WORKSPACE_OPEN_SEGMENT_DOCUMENT_CHANNEL,
        payload
      ),
    openSegmentSupplementDocument: (payload) =>
      invoke<WorkspaceBridgeResponse<'openSegmentSupplementDocument'>>(
        WORKSPACE_OPEN_SEGMENT_SUPPLEMENT_DOCUMENT_CHANNEL,
        payload
      ),
    copyMemorySpaceAbsolutePath: (payload) =>
      invoke<WorkspaceBridgeResponse<'copyMemorySpaceAbsolutePath'>>(
        WORKSPACE_COPY_MEMORY_SPACE_ABSOLUTE_PATH_CHANNEL,
        payload
      ),
    copyMemoryAbsolutePath: (payload) =>
      invoke<WorkspaceBridgeResponse<'copyMemoryAbsolutePath'>>(
        WORKSPACE_COPY_MEMORY_ABSOLUTE_PATH_CHANNEL,
        payload
      ),
    copySegmentAbsolutePath: (payload) =>
      invoke<WorkspaceBridgeResponse<'copySegmentAbsolutePath'>>(
        WORKSPACE_COPY_SEGMENT_ABSOLUTE_PATH_CHANNEL,
        payload
      ),
    copySegmentSupplementAbsolutePath: (payload) =>
      invoke<WorkspaceBridgeResponse<'copySegmentSupplementAbsolutePath'>>(
        WORKSPACE_COPY_SEGMENT_SUPPLEMENT_ABSOLUTE_PATH_CHANNEL,
        payload
      ),
    copyMemoryRelativePath: (payload) =>
      invoke<WorkspaceBridgeResponse<'copyMemoryRelativePath'>>(
        WORKSPACE_COPY_MEMORY_RELATIVE_PATH_CHANNEL,
        payload
      ),
    copySegmentRelativePath: (payload) =>
      invoke<WorkspaceBridgeResponse<'copySegmentRelativePath'>>(
        WORKSPACE_COPY_SEGMENT_RELATIVE_PATH_CHANNEL,
        payload
      ),
    copySegmentSupplementRelativePath: (payload) =>
      invoke<WorkspaceBridgeResponse<'copySegmentSupplementRelativePath'>>(
        WORKSPACE_COPY_SEGMENT_SUPPLEMENT_RELATIVE_PATH_CHANNEL,
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
    deleteSegmentSupplement: (payload) =>
      invoke<WorkspaceBridgeResponse<'deleteSegmentSupplement'>>(
        WORKSPACE_DELETE_SEGMENT_SUPPLEMENT_CHANNEL,
        payload
      ),
    restoreDeletedSegmentSupplement: (payload) =>
      invoke<WorkspaceBridgeResponse<'restoreDeletedSegmentSupplement'>>(
        WORKSPACE_RESTORE_DELETED_SEGMENT_SUPPLEMENT_CHANNEL,
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
    readFinalizedAudioSegmentSupplement: (payload) =>
      invoke<WorkspaceBridgeResponse<'readFinalizedAudioSegmentSupplement'>>(
        WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_SUPPLEMENT_CHANNEL,
        payload
      ),
    createRecordingDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'createRecordingDraft'>>(
        WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
        payload
      ),
    createSegmentSupplementRecordingDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'createSegmentSupplementRecordingDraft'>>(
        WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
        payload
      ),
    createNoteSegmentDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'createNoteSegmentDraft'>>(
        WORKSPACE_CREATE_NOTE_SEGMENT_DRAFT_CHANNEL,
        payload
      ),
    createSegmentSupplementNoteDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'createSegmentSupplementNoteDraft'>>(
        WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_CHANNEL,
        payload
      ),
    writeNoteSegmentDraftBody: (payload) =>
      invoke<WorkspaceBridgeResponse<'writeNoteSegmentDraftBody'>>(
        WORKSPACE_WRITE_NOTE_SEGMENT_DRAFT_BODY_CHANNEL,
        payload
      ),
    writeSegmentSupplementNoteDraftBody: (payload) =>
      invoke<WorkspaceBridgeResponse<'writeSegmentSupplementNoteDraftBody'>>(
        WORKSPACE_WRITE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_BODY_CHANNEL,
        payload
      ),
    finalizeNoteSegmentDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'finalizeNoteSegmentDraft'>>(
        WORKSPACE_FINALIZE_NOTE_SEGMENT_DRAFT_CHANNEL,
        payload
      ),
    finalizeSegmentSupplementNoteDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'finalizeSegmentSupplementNoteDraft'>>(
        WORKSPACE_FINALIZE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_CHANNEL,
        payload
      ),
    readSegmentContent: (payload) =>
      invoke<WorkspaceBridgeResponse<'readSegmentContent'>>(
        WORKSPACE_READ_SEGMENT_CONTENT_CHANNEL,
        payload
      ),
    readSegmentSupplementContent: (payload) =>
      invoke<WorkspaceBridgeResponse<'readSegmentSupplementContent'>>(
        WORKSPACE_READ_SEGMENT_SUPPLEMENT_CONTENT_CHANNEL,
        payload
      ),
    writeSegmentContent: (payload) =>
      invoke<WorkspaceBridgeResponse<'writeSegmentContent'>>(
        WORKSPACE_WRITE_SEGMENT_CONTENT_CHANNEL,
        payload
      ),
    writeSegmentSupplementContent: (payload) =>
      invoke<WorkspaceBridgeResponse<'writeSegmentSupplementContent'>>(
        WORKSPACE_WRITE_SEGMENT_SUPPLEMENT_CONTENT_CHANNEL,
        payload
      ),
    saveSegmentAttachment: (payload) =>
      invoke<WorkspaceBridgeResponse<'saveSegmentAttachment'>>(
        WORKSPACE_SAVE_SEGMENT_ATTACHMENT_CHANNEL,
        payload
      ),
    listSegmentAttachments: (payload) =>
      invoke<WorkspaceBridgeResponse<'listSegmentAttachments'>>(
        WORKSPACE_LIST_SEGMENT_ATTACHMENTS_CHANNEL,
        payload
      ),
    saveSegmentSupplementAttachment: (payload) =>
      invoke<WorkspaceBridgeResponse<'saveSegmentSupplementAttachment'>>(
        WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_ATTACHMENT_CHANNEL,
        payload
      ),
    listSegmentSupplementAttachments: (payload) =>
      invoke<WorkspaceBridgeResponse<'listSegmentSupplementAttachments'>>(
        WORKSPACE_LIST_SEGMENT_SUPPLEMENT_ATTACHMENTS_CHANNEL,
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
    appendSegmentSupplementRecordingAudioChunk: (payload) =>
      invoke<WorkspaceBridgeResponse<'appendSegmentSupplementRecordingAudioChunk'>>(
        WORKSPACE_APPEND_SEGMENT_SUPPLEMENT_RECORDING_AUDIO_CHUNK_CHANNEL,
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
    finalizeSegmentSupplementRecordingDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'finalizeSegmentSupplementRecordingDraft'>>(
        WORKSPACE_FINALIZE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
        payload
      ),
    discardRecordingDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'discardRecordingDraft'>>(
        WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
        payload
      ),
    discardSegmentSupplementRecordingDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'discardSegmentSupplementRecordingDraft'>>(
        WORKSPACE_DISCARD_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
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
    updateSegmentContentTitle: (payload) =>
      invoke<WorkspaceBridgeResponse<'updateSegmentContentTitle'>>(
        WORKSPACE_UPDATE_SEGMENT_CONTENT_TITLE_CHANNEL,
        payload
      ),
    updateSegmentSupplementTitle: (payload) =>
      invoke<WorkspaceBridgeResponse<'updateSegmentSupplementTitle'>>(
        WORKSPACE_UPDATE_SEGMENT_SUPPLEMENT_TITLE_CHANNEL,
        payload
      ),
    updateSegmentContentTabOrder: (payload) =>
      invoke<WorkspaceBridgeResponse<'updateSegmentContentTabOrder'>>(
        WORKSPACE_UPDATE_SEGMENT_CONTENT_TAB_ORDER_CHANNEL,
        payload
      ),
    saveTranscript: (payload) =>
      invoke<WorkspaceBridgeResponse<'saveTranscript'>>(WORKSPACE_SAVE_TRANSCRIPT_CHANNEL, payload),
    saveSegmentSupplementTranscript: (payload) =>
      invoke<WorkspaceBridgeResponse<'saveSegmentSupplementTranscript'>>(
        WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_TRANSCRIPT_CHANNEL,
        payload
      ),
    requestSegmentTranscriptionBackfill: (payload) =>
      invoke<WorkspaceBridgeResponse<'requestSegmentTranscriptionBackfill'>>(
        WORKSPACE_REQUEST_SEGMENT_TRANSCRIPTION_BACKFILL_CHANNEL,
        payload
      ),
    requestSegmentSupplementTranscriptionBackfill: (payload) =>
      invoke<WorkspaceBridgeResponse<'requestSegmentSupplementTranscriptionBackfill'>>(
        WORKSPACE_REQUEST_SEGMENT_SUPPLEMENT_TRANSCRIPTION_BACKFILL_CHANNEL,
        payload
      ),
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
    readVoiceTranscriptionSettings: (payload) =>
      invoke<WorkspaceBridgeResponse<'readVoiceTranscriptionSettings'>>(
        WORKSPACE_READ_VOICE_TRANSCRIPTION_SETTINGS_CHANNEL,
        payload
      ),
    setVoiceTranscriptionEnabled: (payload) =>
      invoke<WorkspaceBridgeResponse<'setVoiceTranscriptionEnabled'>>(
        WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL,
        payload
      ),
    saveVoiceTranscriptionApiKey: (payload) =>
      invoke<WorkspaceBridgeResponse<'saveVoiceTranscriptionApiKey'>>(
        WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
        payload
      ),
    clearVoiceTranscriptionApiKey: (payload) =>
      invoke<WorkspaceBridgeResponse<'clearVoiceTranscriptionApiKey'>>(
        WORKSPACE_CLEAR_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
        payload
      ),
    validateVoiceTranscriptionCredentials: (payload) =>
      invoke<WorkspaceBridgeResponse<'validateVoiceTranscriptionCredentials'>>(
        WORKSPACE_VALIDATE_VOICE_TRANSCRIPTION_CREDENTIALS_CHANNEL,
        payload
      ),
    openVoiceTranscriptionProviderConsole: () =>
      invoke<WorkspaceBridgeResponse<'openVoiceTranscriptionProviderConsole'>>(
        WORKSPACE_OPEN_VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_CHANNEL
      ),
    openMarkdownExternalLink: (payload) =>
      invoke<WorkspaceBridgeResponse<'openMarkdownExternalLink'>>(
        WORKSPACE_OPEN_MARKDOWN_EXTERNAL_LINK_CHANNEL,
        payload
      ),
    onRecordingTranscriptionEvent: (callback) =>
      invoker.on?.(WORKSPACE_RECORDING_TRANSCRIPTION_EVENT_CHANNEL, (payload) =>
        callback(payload as Parameters<typeof callback>[0])
      ) ?? (() => {}),
    onFileTruthChanged: (callback) =>
      invoker.on?.(WORKSPACE_FILE_TRUTH_CHANGED_EVENT_CHANNEL, (payload) =>
        callback(payload as Parameters<typeof callback>[0])
      ) ?? (() => {}),
  };
  return Object.freeze(bridge);
}

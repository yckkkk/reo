export const WORKSPACE_CHOOSE_DIRECTORY_CHANNEL = 'workspace:chooseDirectory' as const;
export const WORKSPACE_LIST_MEMORY_SPACES_CHANNEL = 'workspace:listMemorySpaces' as const;
export const WORKSPACE_INITIALIZE_CHANNEL = 'workspace:initialize' as const;
export const WORKSPACE_OPEN_CHANNEL = 'workspace:open' as const;
export const WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL = 'workspace:openMemorySpace' as const;
export const WORKSPACE_REMOVE_MEMORY_SPACE_CHANNEL = 'workspace:removeMemorySpace' as const;
export const WORKSPACE_CLOSE_CHANNEL = 'workspace:close' as const;
export const WORKSPACE_CREATE_MEMORY_CHANNEL = 'workspace:createMemory' as const;
export const WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL = 'workspace:createRecordingDraft' as const;
export const WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL =
  'workspace:appendRecordingAudioChunk' as const;
export const WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL =
  'workspace:finalizeRecordingDraft' as const;
export const WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL = 'workspace:discardRecordingDraft' as const;
export const WORKSPACE_GET_MEMORY_DETAIL_CHANNEL = 'workspace:getMemoryDetail' as const;
export const WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL = 'workspace:updateMemoryTitle' as const;
export const WORKSPACE_GET_RECORDING_DETAIL_CHANNEL = 'workspace:getRecordingDetail' as const;
export const WORKSPACE_READ_RECORDING_AUDIO_MANIFEST_CHANNEL =
  'workspace:readRecordingAudioManifest' as const;
export const WORKSPACE_READ_RECORDING_AUDIO_CHUNK_CHANNEL =
  'workspace:readRecordingAudioChunk' as const;
export const WORKSPACE_SAVE_TRANSCRIPT_CHANNEL = 'workspace:saveTranscript' as const;
export const WORKSPACE_SAVE_REFLECTIONS_CHANNEL = 'workspace:saveReflections' as const;
export const WORKSPACE_BEGIN_MICROPHONE_INTENT_CHANNEL = 'workspace:beginMicrophoneIntent' as const;
export const WORKSPACE_CLEAR_MICROPHONE_INTENT_CHANNEL = 'workspace:clearMicrophoneIntent' as const;

export const WORKSPACE_IPC_CHANNELS = [
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_LIST_MEMORY_SPACES_CHANNEL,
  WORKSPACE_INITIALIZE_CHANNEL,
  WORKSPACE_OPEN_CHANNEL,
  WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL,
  WORKSPACE_REMOVE_MEMORY_SPACE_CHANNEL,
  WORKSPACE_CLOSE_CHANNEL,
  WORKSPACE_CREATE_MEMORY_CHANNEL,
  WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_GET_MEMORY_DETAIL_CHANNEL,
  WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL,
  WORKSPACE_GET_RECORDING_DETAIL_CHANNEL,
  WORKSPACE_READ_RECORDING_AUDIO_MANIFEST_CHANNEL,
  WORKSPACE_READ_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_SAVE_TRANSCRIPT_CHANNEL,
  WORKSPACE_SAVE_REFLECTIONS_CHANNEL,
  WORKSPACE_BEGIN_MICROPHONE_INTENT_CHANNEL,
  WORKSPACE_CLEAR_MICROPHONE_INTENT_CHANNEL,
] as const;

export type WorkspaceIpcChannel = (typeof WORKSPACE_IPC_CHANNELS)[number];

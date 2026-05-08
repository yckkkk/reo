import {
  WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_BEGIN_MICROPHONE_INTENT_CHANNEL,
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_CLEAR_MICROPHONE_INTENT_CHANNEL,
  WORKSPACE_CLOSE_CHANNEL,
  WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_GET_MEMORY_DETAIL_CHANNEL,
  WORKSPACE_GET_RECORDING_DETAIL_CHANNEL,
  WORKSPACE_INITIALIZE_CHANNEL,
  WORKSPACE_LIST_MEMORY_SPACES_CHANNEL,
  WORKSPACE_OPEN_CHANNEL,
  WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL,
  WORKSPACE_REMOVE_MEMORY_SPACE_CHANNEL,
  WORKSPACE_READ_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_READ_RECORDING_AUDIO_MANIFEST_CHANNEL,
  WORKSPACE_SAVE_REFLECTIONS_CHANNEL,
  WORKSPACE_SAVE_TRANSCRIPT_CHANNEL,
  type WorkspaceIpcChannel,
} from '../main/workspaceChannels.js';

export type WorkspaceChooseDirectoryResponse =
  | {
      readonly ok: true;
      readonly value:
        | {
            readonly status: 'selected';
            readonly selectionToken: string;
            readonly displayPath: string;
          }
        | {
            readonly status: 'canceled';
          };
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
      };
    };

export interface WorkspaceBridgeInvoker {
  readonly invoke: (channel: WorkspaceIpcChannel, payload?: unknown) => Promise<unknown>;
}

export interface ReoWorkspaceBridge {
  readonly chooseDirectory: () => Promise<WorkspaceChooseDirectoryResponse>;
  readonly listMemorySpaces: () => Promise<unknown>;
  readonly initializeWorkspace: (payload: unknown) => Promise<unknown>;
  readonly openWorkspace: (payload: unknown) => Promise<unknown>;
  readonly openMemorySpace: (payload: unknown) => Promise<unknown>;
  readonly removeMemorySpace: (payload: unknown) => Promise<unknown>;
  readonly closeWorkspace: (payload: unknown) => Promise<unknown>;
  readonly createRecordingDraft: (payload: unknown) => Promise<unknown>;
  readonly appendRecordingAudioChunk: (payload: unknown) => Promise<unknown>;
  readonly finalizeRecordingDraft: (payload: unknown) => Promise<unknown>;
  readonly discardRecordingDraft: (payload: unknown) => Promise<unknown>;
  readonly getMemoryDetail: (payload: unknown) => Promise<unknown>;
  readonly getRecordingDetail: (payload: unknown) => Promise<unknown>;
  readonly readRecordingAudioManifest: (payload: unknown) => Promise<unknown>;
  readonly readRecordingAudioChunk: (payload: unknown) => Promise<unknown>;
  readonly saveTranscript: (payload: unknown) => Promise<unknown>;
  readonly saveReflections: (payload: unknown) => Promise<unknown>;
  readonly beginMicrophoneIntent: (payload: unknown) => Promise<unknown>;
  readonly clearMicrophoneIntent: (payload: unknown) => Promise<unknown>;
}

export function createWorkspaceBridge(invoker: WorkspaceBridgeInvoker): ReoWorkspaceBridge {
  return Object.freeze({
    async chooseDirectory() {
      return (await invoker.invoke(
        WORKSPACE_CHOOSE_DIRECTORY_CHANNEL
      )) as WorkspaceChooseDirectoryResponse;
    },
    listMemorySpaces: () => invoker.invoke(WORKSPACE_LIST_MEMORY_SPACES_CHANNEL),
    initializeWorkspace: (payload: unknown) =>
      invoker.invoke(WORKSPACE_INITIALIZE_CHANNEL, payload),
    openWorkspace: (payload: unknown) => invoker.invoke(WORKSPACE_OPEN_CHANNEL, payload),
    openMemorySpace: (payload: unknown) =>
      invoker.invoke(WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL, payload),
    removeMemorySpace: (payload: unknown) =>
      invoker.invoke(WORKSPACE_REMOVE_MEMORY_SPACE_CHANNEL, payload),
    closeWorkspace: (payload: unknown) => invoker.invoke(WORKSPACE_CLOSE_CHANNEL, payload),
    createRecordingDraft: (payload: unknown) =>
      invoker.invoke(WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL, payload),
    appendRecordingAudioChunk: (payload: unknown) =>
      invoker.invoke(WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL, payload),
    finalizeRecordingDraft: (payload: unknown) =>
      invoker.invoke(WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL, payload),
    discardRecordingDraft: (payload: unknown) =>
      invoker.invoke(WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL, payload),
    getMemoryDetail: (payload: unknown) =>
      invoker.invoke(WORKSPACE_GET_MEMORY_DETAIL_CHANNEL, payload),
    getRecordingDetail: (payload: unknown) =>
      invoker.invoke(WORKSPACE_GET_RECORDING_DETAIL_CHANNEL, payload),
    readRecordingAudioManifest: (payload: unknown) =>
      invoker.invoke(WORKSPACE_READ_RECORDING_AUDIO_MANIFEST_CHANNEL, payload),
    readRecordingAudioChunk: (payload: unknown) =>
      invoker.invoke(WORKSPACE_READ_RECORDING_AUDIO_CHUNK_CHANNEL, payload),
    saveTranscript: (payload: unknown) =>
      invoker.invoke(WORKSPACE_SAVE_TRANSCRIPT_CHANNEL, payload),
    saveReflections: (payload: unknown) =>
      invoker.invoke(WORKSPACE_SAVE_REFLECTIONS_CHANNEL, payload),
    beginMicrophoneIntent: (payload: unknown) =>
      invoker.invoke(WORKSPACE_BEGIN_MICROPHONE_INTENT_CHANNEL, payload),
    clearMicrophoneIntent: (payload: unknown) =>
      invoker.invoke(WORKSPACE_CLEAR_MICROPHONE_INTENT_CHANNEL, payload),
  });
}

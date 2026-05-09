import {
  WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_BEGIN_MICROPHONE_INTENT_CHANNEL,
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_CLEAR_MICROPHONE_INTENT_CHANNEL,
  WORKSPACE_CLOSE_CHANNEL,
  WORKSPACE_CREATE_MEMORY_CHANNEL,
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
  WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL,
  type WorkspaceIpcChannel,
} from '../workspace-contract/workspace-channels.js';
import type { ReoWorkspaceBridge } from '../workspace-contract/reo-workspace-bridge.js';

export interface WorkspaceBridgeInvoker {
  readonly invoke: (channel: WorkspaceIpcChannel, payload?: unknown) => Promise<unknown>;
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
    closeWorkspace: (payload) =>
      invoke<WorkspaceBridgeResponse<'closeWorkspace'>>(WORKSPACE_CLOSE_CHANNEL, payload),
    createMemory: (payload) =>
      invoke<WorkspaceBridgeResponse<'createMemory'>>(WORKSPACE_CREATE_MEMORY_CHANNEL, payload),
    createRecordingDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'createRecordingDraft'>>(
        WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
        payload
      ),
    appendRecordingAudioChunk: (payload) =>
      invoke<WorkspaceBridgeResponse<'appendRecordingAudioChunk'>>(
        WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
        payload
      ),
    finalizeRecordingDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'finalizeRecordingDraft'>>(
        WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
        payload
      ),
    discardRecordingDraft: (payload) =>
      invoke<WorkspaceBridgeResponse<'discardRecordingDraft'>>(
        WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
        payload
      ),
    getMemoryDetail: (payload) =>
      invoke<WorkspaceBridgeResponse<'getMemoryDetail'>>(
        WORKSPACE_GET_MEMORY_DETAIL_CHANNEL,
        payload
      ),
    updateMemoryTitle: (payload) =>
      invoke<WorkspaceBridgeResponse<'updateMemoryTitle'>>(
        WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL,
        payload
      ),
    getRecordingDetail: (payload) =>
      invoke<WorkspaceBridgeResponse<'getRecordingDetail'>>(
        WORKSPACE_GET_RECORDING_DETAIL_CHANNEL,
        payload
      ),
    readRecordingAudioManifest: (payload) =>
      invoke<WorkspaceBridgeResponse<'readRecordingAudioManifest'>>(
        WORKSPACE_READ_RECORDING_AUDIO_MANIFEST_CHANNEL,
        payload
      ),
    readRecordingAudioChunk: (payload) =>
      invoke<WorkspaceBridgeResponse<'readRecordingAudioChunk'>>(
        WORKSPACE_READ_RECORDING_AUDIO_CHUNK_CHANNEL,
        payload
      ),
    saveTranscript: (payload) =>
      invoke<WorkspaceBridgeResponse<'saveTranscript'>>(WORKSPACE_SAVE_TRANSCRIPT_CHANNEL, payload),
    saveReflections: (payload) =>
      invoke<WorkspaceBridgeResponse<'saveReflections'>>(
        WORKSPACE_SAVE_REFLECTIONS_CHANNEL,
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
  };
  return Object.freeze(bridge);
}

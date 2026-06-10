import { randomUUID } from 'node:crypto';
import { closeSync, constants, fstatSync, readSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Session } from 'electron';
import type { z } from 'zod';
import {
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_CLOSE_CHANNEL,
  WORKSPACE_BEGIN_MICROPHONE_INTENT_CHANNEL,
  WORKSPACE_CLEAR_MICROPHONE_INTENT_CHANNEL,
  WORKSPACE_CLOSE_RECORDING_TRANSCRIPTION_CHANNEL,
  WORKSPACE_CLEAR_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
  WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_APPEND_SEGMENT_SUPPLEMENT_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_CLONE_RECORDING_DRAFT_PREFIX_CHANNEL,
  WORKSPACE_COPY_ARTIFACT_AGENT_PROMPT_CHANNEL,
  WORKSPACE_COPY_WIDGET_ABSOLUTE_PATH_CHANNEL,
  WORKSPACE_COPY_WIDGET_AGENT_PROMPT_CHANNEL,
  WORKSPACE_COPY_WIDGET_RELATIVE_PATH_CHANNEL,
  WORKSPACE_COPY_MEMORY_ABSOLUTE_PATH_CHANNEL,
  WORKSPACE_COPY_MEMORY_SPACE_ABSOLUTE_PATH_CHANNEL,
  WORKSPACE_COPY_MEMORY_RELATIVE_PATH_CHANNEL,
  WORKSPACE_COPY_NEEDS_REVIEW_AGENT_PROMPT_CHANNEL,
  WORKSPACE_COPY_SEGMENT_ABSOLUTE_PATH_CHANNEL,
  WORKSPACE_COPY_SEGMENT_RELATIVE_PATH_CHANNEL,
  WORKSPACE_COPY_SEGMENT_SUPPLEMENT_ABSOLUTE_PATH_CHANNEL,
  WORKSPACE_COPY_SEGMENT_SUPPLEMENT_RELATIVE_PATH_CHANNEL,
  WORKSPACE_CREATE_MEMORY_CHANNEL,
  WORKSPACE_CREATE_NOTE_SEGMENT_DRAFT_CHANNEL,
  WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_CHANNEL,
  WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DELETE_WIDGET_CHANNEL,
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
  WORKSPACE_IPC_CHANNELS,
  WORKSPACE_LIST_ENTITY_MOVE_TARGETS_CHANNEL,
  WORKSPACE_LIST_MEMORY_SPACES_CHANNEL,
  WORKSPACE_MOVE_MEMORY_CHANNEL,
  WORKSPACE_MOVE_SEGMENT_CHANNEL,
  WORKSPACE_MOVE_SEGMENT_SUPPLEMENT_CHANNEL,
  WORKSPACE_OPEN_CHANNEL,
  WORKSPACE_OPEN_SYSTEM_DRAFT_WORKSPACE_CHANNEL,
  WORKSPACE_OPEN_WIDGET_DOCUMENT_CHANNEL,
  WORKSPACE_OPEN_MARKDOWN_EXTERNAL_LINK_CHANNEL,
  WORKSPACE_OPEN_MEMORY_DOCUMENT_CHANNEL,
  WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL,
  WORKSPACE_OPEN_MEMORY_SPACE_AGENTS_FILE_CHANNEL,
  WORKSPACE_OPEN_VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_CHANNEL,
  WORKSPACE_OPEN_SEGMENT_DOCUMENT_CHANNEL,
  WORKSPACE_OPEN_SEGMENT_SUPPLEMENT_DOCUMENT_CHANNEL,
  WORKSPACE_READ_APP_PERMISSION_STATUS_CHANNEL,
  WORKSPACE_REQUEST_APP_PERMISSION_CHANNEL,
  WORKSPACE_READ_ARTIFACT_RUNTIME_STATE_CHANNEL,
  WORKSPACE_READ_EXPRESSION_PLAYBACK_AUDIO_CHANNEL,
  WORKSPACE_READ_RECENT_EXPRESSIONS_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_AUDIO_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_SUPPLEMENT_AUDIO_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_SUPPLEMENT_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_CHANNEL,
  WORKSPACE_READ_MEMORY_DETAIL_CHANNEL,
  WORKSPACE_READ_SYSTEM_DRAFT_WORKSPACE_CHANNEL,
  WORKSPACE_READ_VOICE_TRANSCRIPTION_SETTINGS_CHANNEL,
  WORKSPACE_READ_RECORDING_DRAFT_AUDIO_CHANNEL,
  WORKSPACE_READ_SEGMENT_CONTENT_CHANNEL,
  WORKSPACE_READ_SEGMENT_SPEECH_AUDIO_CHANNEL,
  WORKSPACE_READ_SEGMENT_SUPPLEMENT_CONTENT_CHANNEL,
  WORKSPACE_READ_SEGMENT_SUPPLEMENT_SPEECH_AUDIO_CHANNEL,
  WORKSPACE_READ_WORKSPACE_SNAPSHOT_CHANNEL,
  WORKSPACE_REVEAL_WIDGET_IN_FINDER_CHANNEL,
  WORKSPACE_REVEAL_MEMORY_IN_FINDER_CHANNEL,
  WORKSPACE_REVEAL_MEMORY_SPACE_IN_FINDER_CHANNEL,
  WORKSPACE_REVEAL_SEGMENT_IN_FINDER_CHANNEL,
  WORKSPACE_REVEAL_SEGMENT_SUPPLEMENT_IN_FINDER_CHANNEL,
  WORKSPACE_REMOVE_MEMORY_SPACE_CHANNEL,
  WORKSPACE_RESET_MEMORY_COVER_CHANNEL,
  WORKSPACE_RESET_SEGMENT_COVER_CHANNEL,
  WORKSPACE_RESTORE_DELETED_WIDGET_CHANNEL,
  WORKSPACE_RESTORE_DELETED_MEMORY_CHANNEL,
  WORKSPACE_RESTORE_MEMORY_COVER_CHANNEL,
  WORKSPACE_RESTORE_SEGMENT_COVER_CHANNEL,
  WORKSPACE_RESTORE_DELETED_SEGMENT_SUPPLEMENT_CHANNEL,
  WORKSPACE_RESTORE_DELETED_SEGMENT_CHANNEL,
  WORKSPACE_SWITCH_MEMORY_DEFAULT_COVER_CHANNEL,
  WORKSPACE_SWITCH_SEGMENT_DEFAULT_COVER_CHANNEL,
  WORKSPACE_RECORDING_TRANSCRIPTION_EVENT_CHANNEL,
  WORKSPACE_REGENERATE_IMPORTED_SPEECH_SYNTHESIS_CHANNEL,
  WORKSPACE_REQUEST_SEGMENT_SUPPLEMENT_TRANSCRIPTION_BACKFILL_CHANNEL,
  WORKSPACE_REQUEST_SEGMENT_SUPPLEMENT_SPEECH_SYNTHESIS_CHANNEL,
  WORKSPACE_REQUEST_SEGMENT_SPEECH_SYNTHESIS_CHANNEL,
  WORKSPACE_REQUEST_SEGMENT_TRANSCRIPTION_BACKFILL_CHANNEL,
  WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_TRANSCRIPT_CHANNEL,
  WORKSPACE_SAVE_SEGMENT_ATTACHMENT_CHANNEL,
  WORKSPACE_LIST_SEGMENT_ATTACHMENTS_CHANNEL,
  WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_ATTACHMENT_CHANNEL,
  WORKSPACE_LIST_SEGMENT_SUPPLEMENT_ATTACHMENTS_CHANNEL,
  WORKSPACE_SAVE_TRANSCRIPT_CHANNEL,
  WORKSPACE_SEND_RECORDING_TRANSCRIPTION_AUDIO_CHANNEL,
  WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
  WORKSPACE_SET_VOICE_SPEECH_SYNTHESIS_SPEAKER_CHANNEL,
  WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL,
  WORKSPACE_START_RECORDING_TRANSCRIPTION_CHANNEL,
  WORKSPACE_UPDATE_WIDGET_TAB_ORDER_CHANNEL,
  WORKSPACE_UPDATE_WIDGET_TITLE_CHANNEL,
  WORKSPACE_UPDATE_MEMORY_SPACE_TITLE_CHANNEL,
  WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_CONTENT_TAB_ORDER_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_CONTENT_TITLE_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_SUPPLEMENT_TITLE_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_TITLE_CHANNEL,
  WORKSPACE_VALIDATE_VOICE_TRANSCRIPTION_CREDENTIALS_CHANNEL,
  WORKSPACE_WRITE_ARTIFACT_RUNTIME_STATE_CHANNEL,
  WORKSPACE_WRITE_NOTE_SEGMENT_DRAFT_BODY_CHANNEL,
  WORKSPACE_WRITE_SEGMENT_CONTENT_CHANNEL,
  WORKSPACE_WRITE_SEGMENT_SUPPLEMENT_CONTENT_CHANNEL,
  WORKSPACE_WRITE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_BODY_CHANNEL,
  workspaceCloseRequestSchema,
  workspaceCloseResponseSchema,
  workspaceChooseDirectoryResponseSchema,
  workspaceDeleteMemoryRequestSchema,
  workspaceDeleteMemoryResponseSchema,
  workspaceDeleteSegmentSupplementRequestSchema,
  workspaceDeleteSegmentSupplementResponseSchema,
  workspaceDeleteSegmentRequestSchema,
  workspaceDeleteSegmentResponseSchema,
  workspaceCreateMemoryRequestSchema,
  workspaceCreateMemoryResponseSchema,
  workspaceCreateNoteSegmentDraftRequestSchema,
  workspaceCreateNoteSegmentDraftResponseSchema,
  workspaceCreateRecordingDraftResponseSchema,
  workspaceCreateSegmentSupplementNoteDraftRequestSchema,
  workspaceCreateSegmentSupplementNoteDraftResponseSchema,
  workspaceCreateSegmentSupplementRecordingDraftRequestSchema,
  workspaceCreateSegmentSupplementRecordingDraftResponseSchema,
  workspaceDiscardRecordingDraftResponseSchema,
  workspaceError,
  workspaceFinalizeNoteSegmentDraftRequestSchema,
  workspaceFinalizeNoteSegmentDraftResponseSchema,
  workspaceFinalizeSegmentSupplementNoteDraftRequestSchema,
  workspaceFinalizeSegmentSupplementNoteDraftResponseSchema,
  workspaceFileTruthChangedEventSchema,
  workspaceInitializeRequestSchema,
  workspaceInitializeResponseSchema,
  workspaceListEntityMoveTargetsRequestSchema,
  workspaceListEntityMoveTargetsResponseSchema,
  workspaceListMemorySpacesResponseSchema,
  workspaceMicrophoneIntentRequestSchema,
  workspaceMicrophoneIntentResponseSchema,
  workspaceMoveMemoryRequestSchema,
  workspaceMoveMemoryResponseSchema,
  workspaceMoveSegmentRequestSchema,
  workspaceMoveSegmentResponseSchema,
  workspaceMoveSegmentSupplementRequestSchema,
  workspaceMoveSegmentSupplementResponseSchema,
  workspaceClearMicrophoneIntentResponseSchema,
  workspaceNoInputSchema,
  workspaceOpenRequestSchema,
  workspaceOpenWidgetDocumentRequestSchema,
  workspaceOpenMemoryDocumentRequestSchema,
  workspaceOpenMemorySpaceRequestSchema,
  workspaceOpenSystemDraftWorkspaceResponseSchema,
  workspaceOpenMemorySpaceAgentsFileRequestSchema,
  workspaceOpenSegmentDocumentRequestSchema,
  workspaceOpenSegmentSupplementDocumentRequestSchema,
  workspaceCopyArtifactAgentPromptRequestSchema,
  workspaceCopyWidgetAbsolutePathRequestSchema,
  workspaceCopyWidgetAgentPromptRequestSchema,
  workspaceCopyWidgetRelativePathRequestSchema,
  workspaceCopyMemoryAbsolutePathRequestSchema,
  workspaceCopyMemorySpaceAbsolutePathRequestSchema,
  workspaceCopyMemoryRelativePathRequestSchema,
  workspaceCopyNeedsReviewAgentPromptRequestSchema,
  workspaceCopySegmentAbsolutePathRequestSchema,
  workspaceCopySegmentRelativePathRequestSchema,
  workspaceCopySegmentSupplementAbsolutePathRequestSchema,
  workspaceCopySegmentSupplementRelativePathRequestSchema,
  workspaceReadArtifactRuntimeStateRequestSchema,
  workspaceReadArtifactRuntimeStateResponseSchema,
  workspaceReadFinalizedAudioSegmentRequestSchema,
  workspaceReadFinalizedAudioSegmentAudioRequestSchema,
  workspaceReadFinalizedAudioSegmentAudioResponseSchema,
  workspaceReadFinalizedAudioSegmentResponseSchema,
  workspaceReadFinalizedAudioSegmentSupplementRequestSchema,
  workspaceReadFinalizedAudioSegmentSupplementAudioRequestSchema,
  workspaceReadFinalizedAudioSegmentSupplementAudioResponseSchema,
  workspaceReadFinalizedAudioSegmentSupplementResponseSchema,
  workspaceReadExpressionPlaybackAudioRequestSchema,
  workspaceReadExpressionPlaybackAudioResponseSchema,
  workspaceReadMemoryDetailRequestSchema,
  workspaceReadMemoryDetailResponseSchema,
  workspaceReadRecentExpressionsRequestSchema,
  workspaceReadRecentExpressionsResponseSchema,
  workspaceReadSegmentContentRequestSchema,
  workspaceReadSegmentContentResponseSchema,
  workspaceReadSegmentSpeechAudioRequestSchema,
  workspaceReadSegmentSpeechAudioResponseSchema,
  workspaceReadSegmentSupplementContentRequestSchema,
  workspaceReadSegmentSupplementContentResponseSchema,
  workspaceReadSegmentSupplementSpeechAudioRequestSchema,
  workspaceReadSegmentSupplementSpeechAudioResponseSchema,
  workspaceSaveSegmentAttachmentRequestSchema,
  workspaceSaveSegmentSupplementAttachmentRequestSchema,
  workspaceListSegmentAttachmentsRequestSchema,
  workspaceListSegmentSupplementAttachmentsRequestSchema,
  workspaceSaveAttachmentResponseSchema,
  workspaceListAttachmentsResponseSchema,
  appPermissionStatusSchema,
  workspaceReadAppPermissionStatusRequestSchema,
  workspaceReadAppPermissionStatusResponseSchema,
  workspaceRequestAppPermissionRequestSchema,
  workspaceRequestAppPermissionResponseSchema,
  workspaceReadVoiceTranscriptionSettingsRequestSchema,
  workspaceReadVoiceTranscriptionSettingsResponseSchema,
  workspaceReadSystemDraftWorkspaceResponseSchema,
  workspaceReadWorkspaceSnapshotRequestSchema,
  workspaceReadWorkspaceSnapshotResponseSchema,
  workspaceRevealWidgetInFinderRequestSchema,
  workspaceRevealMemoryInFinderRequestSchema,
  workspaceRevealMemorySpaceInFinderRequestSchema,
  workspaceRevealSegmentInFinderRequestSchema,
  workspaceRevealSegmentSupplementInFinderRequestSchema,
  workspaceRemoveMemorySpaceRequestSchema,
  workspaceRemoveMemorySpaceResponseSchema,
  workspaceResetMemoryCoverRequestSchema,
  workspaceResetMemoryCoverResponseSchema,
  workspaceResetSegmentCoverRequestSchema,
  workspaceResetSegmentCoverResponseSchema,
  workspaceRecordingAppendRequestSchema,
  workspaceRecordingAppendResponseSchema,
  workspaceDeleteWidgetRequestSchema,
  workspaceDeleteWidgetResponseSchema,
  workspaceRestoreDeletedMemoryRequestSchema,
  workspaceRestoreDeletedMemoryResponseSchema,
  workspaceRestoreMemoryCoverRequestSchema,
  workspaceRestoreMemoryCoverResponseSchema,
  workspaceRestoreSegmentCoverRequestSchema,
  workspaceRestoreSegmentCoverResponseSchema,
  workspaceRestoreDeletedWidgetRequestSchema,
  workspaceRestoreDeletedWidgetResponseSchema,
  workspaceSwitchMemoryDefaultCoverRequestSchema,
  workspaceSwitchMemoryDefaultCoverResponseSchema,
  workspaceSwitchSegmentDefaultCoverRequestSchema,
  workspaceSwitchSegmentDefaultCoverResponseSchema,
  workspaceRestoreDeletedSegmentSupplementRequestSchema,
  workspaceRestoreDeletedSegmentSupplementResponseSchema,
  workspaceRestoreDeletedSegmentRequestSchema,
  workspaceRestoreDeletedSegmentResponseSchema,
  workspaceAppendSegmentSupplementRecordingAudioRequestSchema,
  workspaceSegmentSupplementRecordingAppendResponseSchema,
  workspaceRecordingDraftPrefixCloneRequestSchema,
  workspaceRecordingDraftPrefixCloneResponseSchema,
  workspaceRecordingDraftAudioResponseSchema,
  workspaceRecordingDraftAudioRequestSchema,
  workspaceRecordingFinalizeResponseSchema,
  workspaceRecordingFinalizeRequestSchema,
  workspaceFinalizeSegmentSupplementRecordingDraftRequestSchema,
  workspaceFinalizeSegmentSupplementRecordingDraftResponseSchema,
  workspaceRecordingTranscriptionAudioRequestSchema,
  workspaceRecordingTranscriptionCloseRequestSchema,
  workspaceRecordingTranscriptionControlResponseSchema,
  workspaceRecordingTranscriptionEventSchema,
  workspaceRecordingTranscriptionStartRequestSchema,
  workspaceSaveVoiceTranscriptionApiKeyRequestSchema,
  workspaceSaveVoiceTranscriptionApiKeyResponseSchema,
  workspaceSegmentIdRequestSchema,
  workspaceSegmentSupplementIdRequestSchema,
  workspaceSegmentSupplementMarkdownSaveRequestSchema,
  workspaceSegmentSupplementMarkdownSaveResponseSchema,
  workspaceSetVoiceSpeechSynthesisSpeakerRequestSchema,
  workspaceSetVoiceSpeechSynthesisSpeakerResponseSchema,
  workspaceSetVoiceTranscriptionEnabledRequestSchema,
  workspaceSetVoiceTranscriptionEnabledResponseSchema,
  workspaceClearVoiceTranscriptionApiKeyRequestSchema,
  workspaceClearVoiceTranscriptionApiKeyResponseSchema,
  workspaceValidateVoiceTranscriptionCredentialsRequestSchema,
  workspaceValidateVoiceTranscriptionCredentialsResponseSchema,
  workspaceWriteArtifactRuntimeStateRequestSchema,
  workspaceWriteArtifactRuntimeStateResponseSchema,
  workspaceOpenMarkdownExternalLinkRequestSchema,
  workspaceOpenMarkdownExternalLinkResponseSchema,
  workspaceOpenVoiceTranscriptionProviderConsoleRequestSchema,
  workspaceOpenVoiceTranscriptionProviderConsoleResponseSchema,
  workspaceRecordingMarkdownSaveRequestSchema,
  workspaceRecordingMarkdownSaveResponseSchema,
  workspaceRequestSegmentSupplementTranscriptionBackfillRequestSchema,
  workspaceRequestSegmentSupplementTranscriptionBackfillResponseSchema,
  workspaceRequestSegmentSupplementSpeechSynthesisRequestSchema,
  workspaceRequestSegmentSupplementSpeechSynthesisResponseSchema,
  workspaceRegenerateImportedSpeechSynthesisRequestSchema,
  workspaceRegenerateImportedSpeechSynthesisResponseSchema,
  workspaceRequestSegmentSpeechSynthesisRequestSchema,
  workspaceRequestSegmentSpeechSynthesisResponseSchema,
  workspaceRequestSegmentTranscriptionBackfillRequestSchema,
  workspaceRequestSegmentTranscriptionBackfillResponseSchema,
  workspaceHandleRequestSchema,
  workspaceUpdateActiveMemorySpaceTitleRequestSchema,
  workspaceUpdateMemorySpaceTitleRequestSchema,
  workspaceUpdateMemorySpaceTitleResponseSchema,
  workspaceUpdateWidgetTabOrderRequestSchema,
  workspaceUpdateWidgetTabOrderResponseSchema,
  workspaceUpdateWidgetTitleRequestSchema,
  workspaceUpdateWidgetTitleResponseSchema,
  workspaceUpdateMemoryTitleRequestSchema,
  workspaceUpdateMemoryTitleResponseSchema,
  workspaceUpdateSegmentContentTabOrderRequestSchema,
  workspaceUpdateSegmentContentTabOrderResponseSchema,
  workspaceUpdateSegmentContentTitleRequestSchema,
  workspaceUpdateSegmentContentTitleResponseSchema,
  workspaceUpdateSegmentSupplementTitleRequestSchema,
  workspaceUpdateSegmentSupplementTitleResponseSchema,
  workspaceUpdateSegmentTitleRequestSchema,
  workspaceUpdateSegmentTitleResponseSchema,
  workspaceEntityActionResponseSchema,
  workspaceWriteNoteSegmentDraftBodyRequestSchema,
  workspaceWriteNoteSegmentDraftBodyResponseSchema,
  workspaceWriteSegmentContentRequestSchema,
  workspaceWriteSegmentContentResponseSchema,
  workspaceWriteSegmentSupplementContentRequestSchema,
  workspaceWriteSegmentSupplementContentResponseSchema,
  workspaceWriteSegmentSupplementNoteDraftBodyRequestSchema,
  workspaceWriteSegmentSupplementNoteDraftBodyResponseSchema,
  type WorkspaceCopyArtifactAgentPromptRequest,
  type WorkspaceCopyWidgetAgentPromptRequest,
  type WorkspaceEntityActionResponse,
  type WorkspaceInitializeResponse,
  type WorkspaceOpenSystemDraftWorkspaceResponse,
  type WorkspaceChooseDirectoryResponse,
  type AppPermissionStatus,
  type WorkspaceErrorEnvelope,
  type WorkspaceSpeechSynthesisBatchTarget,
  type WorkspaceSnapshot,
} from '../workspace-contract/workspace-contract.js';
import {
  ARTIFACT_RUNTIME_ASSETS_DIRECTORY,
  ARTIFACT_RUNTIME_ENTRY_FILE,
  ARTIFACT_RUNTIME_MANIFEST_FILE,
  ARTIFACT_RUNTIME_STATE_FILE,
} from '../workspace-contract/artifact-runtime-url.js';
import { buildWorkspaceReviewAgentPrompt } from '../workspace-contract/workspace-review-prompt.js';
import { parseReoMarkdownExternalLinkHref } from '../tiptap-markdown/tiptapLinkHref.js';
import { parseWorkspaceMarkdownObject } from './workspaceMarkdownObjects.js';
import { createWorkspaceHandleStore, type WorkspaceHandleStore } from './workspaceHandles.js';
import {
  createWorkspaceFileTruthWatcherRegistry,
  type WorkspaceFileTruthWatcherRegistry,
} from './workspaceFileTruthWatcher.js';
import {
  createWorkspaceMemorySpaceRegistry,
  WorkspaceMemorySpaceRegistryReadError,
  type WorkspaceMemorySpaceRegistry,
} from './workspaceMemorySpaceRegistry.js';
import {
  nodeFsProbe,
  resolveMemoryPaths,
  resolveMemorySpacePaths,
  resolveSegmentPaths,
  resolveSegmentSupplementPaths,
  type FsProbe,
  type MemoryPaths,
  type MemorySpacePaths,
  type ResolverResult,
  type SegmentPaths,
  type SegmentSupplementPaths,
} from './entityPathResolver.js';
import { acquireWorkspaceLock } from './workspaceLock.js';
import {
  createWorkspaceSelectionTokenStore,
  type WorkspaceSelectionTokenStore,
} from './workspaceSelectionTokens.js';
import {
  validateTrustedWorkspaceSender,
  type TrustedSenderEventAdapter,
  type TrustedSenderIdentity,
} from './trustedSender.js';
import {
  appendRecordingAudioChunk,
  appendSegmentSupplementRecordingAudioChunk,
  cloneRecordingDraftPrefix,
  clearRecordingRuntimeState,
  clearRecordingRuntimeStateForRoot,
  createRecordingDraft,
  createSegmentSupplementRecordingDraft,
  discardRecordingDraft,
  discardSegmentSupplementRecordingDraft,
  finalizeRecordingDraft,
  finalizeSegmentSupplementRecordingDraft,
  readFinalizedAudioSegmentAudio,
  readFinalizedAudioSegmentContent,
  readFinalizedAudioSegmentSupplementAudio,
  readFinalizedAudioSegmentSupplementContent,
  readRecordingDraftAudio,
  saveRecordingMarkdown,
  saveSegmentSupplementMarkdown,
} from './recordingDrafts.js';
import {
  createNoteSegmentDraft,
  createSegmentSupplementNoteDraft,
  finalizeNoteSegmentDraft,
  finalizeSegmentSupplementNoteDraft,
  readFinalizedNoteSegmentContent,
  readFinalizedNoteSegmentSpeechAudio,
  readFinalizedNoteSegmentSupplementContent,
  readFinalizedNoteSegmentSupplementSpeechAudio,
  writeFinalizedNoteSegmentContent,
  writeFinalizedNoteSegmentSupplementContent,
  writeNoteSegmentDraftBody,
  writeSegmentSupplementNoteDraftBody,
} from './noteDrafts.js';
import { resolveExpressionPlaybackAudio } from './expressionPlaybackAudio.js';
import {
  listNoteSegmentAttachments,
  listNoteSegmentSupplementAttachments,
  saveNoteSegmentAttachment,
  saveNoteSegmentSupplementAttachment,
} from './noteAttachments.js';
import {
  createMemoryFromFileTruth,
  deleteMemoryFromFileTruth,
  deleteSegmentSupplementFromFileTruth,
  deleteSegmentFromFileTruth,
  moveMemoryBetweenFileTruthRoots,
  moveSegmentBetweenFileTruthRoots,
  moveSegmentSupplementBetweenFileTruthRoots,
  readMemoryDetailFromFileTruth,
  resetMemoryCoverToDefaultFromFileTruth,
  resetSegmentCoverToDefaultFromFileTruth,
  restoreDeletedMemoryFromFileTruth,
  restoreDeletedSegmentSupplementFromFileTruth,
  restoreDeletedSegmentFromFileTruth,
  restoreMemoryCoverFromTrash,
  restoreSegmentCoverFromTrash,
  switchMemoryDefaultCoverTemplateFromFileTruth,
  switchSegmentDefaultCoverTemplateFromFileTruth,
  updateMemoryTitleFromFileTruth,
  updateSegmentContentTabOrderFromFileTruth,
  updateSegmentContentTitleFromFileTruth,
  updateSegmentSupplementTitleFromFileTruth,
  updateSegmentTitleFromFileTruth,
} from './memoryFiles.js';
import {
  assertSameDirectoryIdentitySync,
  readSafeDirectoryIdentitySync,
} from './directoryIdentity.js';
import { openExistingWorkspaceFileInDirectory } from './workspaceDirectoryTransactions.js';
import {
  widgetDocumentPath,
  deleteWorkspaceWidgetFromFileTruth,
  readWorkspaceWidgetMarkdownFromDirectory,
  resolveWorkspaceWidgetDirectoryFromFileTruth,
  restoreDeletedWorkspaceWidgetFromFileTruth,
  updateWorkspaceWidgetTabOrderFromFileTruth,
  updateWorkspaceWidgetTitleFromFileTruth,
} from './workspaceWidgets.js';
import {
  clearAllMicrophoneIntents,
  clearMicrophoneIntent,
  clearMicrophoneIntentsForWorkspaceHandle,
  createMicrophoneIntent,
} from './security.js';
import {
  classifyWorkspaceOpenTarget,
  createWorkspaceInitializeTargetInParent,
  initializeWorkspaceFiles,
  openWorkspaceFiles,
  readWorkspaceSnapshotFromFileTruth,
  renameWorkspaceRootFromFileTruth,
  repairWorkspaceTitleMirrorFromRootName,
  removeLockOnlyReoDirectory,
  validateEmptyWorkspaceOpenCanonicalTargetAfterLock,
  validateWorkspaceOpenTarget,
  type WorkspaceInitializeTarget,
} from './workspaceFiles.js';
import {
  createRecordingTranscriptionSessionRegistry,
  type RecordingTranscriptionSessionRegistry,
} from './recordingTranscriptionSessions.js';
import { withDiagnosticSpan } from './diagnostics.js';
import {
  runVoiceTranscriptionProbe,
  type VoiceTranscriptionProbeResult,
} from './voiceTranscriptionProbe.js';
import {
  runVoiceSpeechSynthesisProbe,
  type VoiceSpeechSynthesisProbeResult,
} from './voiceSpeechSynthesisProbe.js';
import type { VoiceSettingsStore } from './voiceSettingsStore.js';
import { readArtifactRuntimeState, writeArtifactRuntimeState } from './artifactRuntimeState.js';
import type { ArtifactRuntimeTarget } from './artifactRuntimeTarget.js';
import {
  createWorkspaceBackfillRuntime,
  type WorkspaceBackfillRuntime,
} from './backfillRuntime.js';
import {
  createWorkspaceSpeechSynthesisRuntime,
  type SpeechSynthesisBatchResult,
  type WorkspaceSpeechSynthesisRuntime,
} from './speechSynthesisRuntime.js';
import { transcriptDigest } from './transcriptDigest.js';
import {
  ensureSystemDraftWorkspace,
  isSystemDraftDefaultMemoryId,
  isSystemDraftWorkspaceId,
  resolveSystemDraftWorkspaceRootForRead,
  SYSTEM_DRAFT_DEFAULT_MEMORY_ROLE,
  SYSTEM_DRAFT_DEFAULT_MEMORY_ID,
  SYSTEM_DRAFT_TITLE,
  SYSTEM_DRAFT_WORKSPACE_ID,
  SYSTEM_DRAFT_WORKSPACE_ROLE,
  type SystemDraftWorkspaceEnsureResult,
} from './systemDraftWorkspace.js';
import { readRecentExpressionsFromWorkspaceSources } from './recentExpressions.js';

const nodeRequire = createRequire(import.meta.url);
const { app, clipboard, dialog, ipcMain, shell, systemPreferences } = nodeRequire(
  'electron'
) as Partial<typeof import('electron')>;
const defaultHandleStore = createWorkspaceHandleStore();
const defaultWorkspaceFileTruthWatcherRegistry = createWorkspaceFileTruthWatcherRegistry();
let defaultMemorySpaceRegistry: WorkspaceMemorySpaceRegistry | null = null;
const defaultRecordingTranscriptionSessions = createRecordingTranscriptionSessionRegistry();
const COVER_ROOT_CACHE_TTL_MS = 2_000;
type WorkspaceCoverRootResolution =
  | {
      readonly ok: true;
      readonly canonicalRoot: string;
    }
  | WorkspaceErrorEnvelope;
const workspaceCoverRootCache = new Map<
  string,
  { readonly expiresAt: number; readonly resolution: WorkspaceCoverRootResolution }
>();
const workspaceCoverRootInFlight = new Map<string, Promise<WorkspaceCoverRootResolution>>();

interface ShowOpenDirectoryDialogResult {
  readonly canceled: boolean;
  readonly filePaths: readonly string[];
}

type ShowOpenDirectoryDialog = () => Promise<ShowOpenDirectoryDialogResult>;
type ShowItemInFolder = (filePath: string) => void;
type OpenPath = (filePath: string) => Promise<string>;
type OpenExternalUrl = (url: string) => Promise<void>;
type OpenVoiceTranscriptionProviderConsole = OpenExternalUrl;
type WriteClipboardText = (text: string) => void;
type AppPermissionMediaType = 'microphone' | 'camera';
type GetAppPermissionMediaAccessStatus = (mediaType: AppPermissionMediaType) => AppPermissionStatus;
type AskAppMediaAccess = (mediaType: AppPermissionMediaType) => Promise<boolean>;
type GetAppAccessibilityPermissionStatus = () => boolean;
type RequestAppAccessibilityPermission = () => boolean;
type VoiceTranscriptionProbe = (apiKey: string) => Promise<VoiceTranscriptionProbeResult>;
type VoiceSpeechSynthesisProbe = (input: {
  readonly apiKey: string;
  readonly speaker: ReturnType<VoiceSettingsStore['read']>['speechSynthesisSpeaker'];
}) => Promise<VoiceSpeechSynthesisProbeResult>;
type ResolveMemorySpacePaths = (
  workspaceId: string,
  deps?: {
    readonly registry?: WorkspaceMemorySpaceRegistry;
    readonly fs?: FsProbe;
    readonly requireAgentEntryFile?: boolean;
  }
) => Promise<ResolverResult<MemorySpacePaths>>;
type ResolveMemoryPaths = (
  handle: { readonly canonicalRoot: string; readonly workspaceId: string },
  workspaceId: string,
  memoryId: string,
  deps?: {
    readonly fs?: FsProbe;
    readonly requireDocument?: boolean;
  }
) => Promise<ResolverResult<MemoryPaths>>;
type ResolveSegmentPaths = (
  handle: { readonly canonicalRoot: string; readonly workspaceId: string },
  workspaceId: string,
  memoryId: string,
  segmentId: string,
  deps?: {
    readonly fs?: FsProbe;
    readonly requireDocument?: boolean;
  }
) => Promise<ResolverResult<SegmentPaths>>;
type ResolveSegmentSupplementPaths = (
  handle: { readonly canonicalRoot: string; readonly workspaceId: string },
  workspaceId: string,
  memoryId: string,
  segmentId: string,
  supplementId: string,
  deps?: {
    readonly fs?: FsProbe;
    readonly requireDocument?: boolean;
  }
) => Promise<ResolverResult<SegmentSupplementPaths>>;
type MaybePromise<T> = T | Promise<T>;

export interface RegisterWorkspaceIpcOptions {
  readonly appDataDir?: string;
  readonly expectedSession: Session | object;
  readonly expectedSessionKey: string;
  readonly isTrustedUrl: (url: string) => boolean;
  readonly tokenStore?: WorkspaceSelectionTokenStore;
  readonly handleStore?: WorkspaceHandleStore;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
  readonly recordingTranscriptionSessions?: RecordingTranscriptionSessionRegistry;
  readonly fileTruthWatcher?: WorkspaceFileTruthWatcherRegistry;
  readonly backfillRuntime?: WorkspaceBackfillRuntime;
  readonly speechSynthesisRuntime?: WorkspaceSpeechSynthesisRuntime;
  readonly voiceSettingsStore: VoiceSettingsStore;
  readonly voiceTranscriptionProbe?: VoiceTranscriptionProbe;
  readonly voiceSpeechSynthesisProbe?: VoiceSpeechSynthesisProbe;
  readonly openExternal?: OpenVoiceTranscriptionProviderConsole;
  readonly showOpenDirectoryDialog?: ShowOpenDirectoryDialog;
  readonly withDiagnostics?: typeof withDiagnosticSpan;
}

interface WorkspaceIpcBaseOptions {
  readonly expectedSession: Session | object;
  readonly expectedSessionKey: string;
  readonly isTrustedUrl: (url: string) => boolean;
}

export interface HandleChooseWorkspaceDirectoryOptions extends WorkspaceIpcBaseOptions {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly tokenStore?: WorkspaceSelectionTokenStore;
  readonly showOpenDirectoryDialog?: ShowOpenDirectoryDialog;
}

export interface HandleInitializeWorkspaceOptions extends WorkspaceIpcBaseOptions {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly tokenStore?: WorkspaceSelectionTokenStore;
  readonly handleStore?: WorkspaceHandleStore;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
  readonly createWorkspaceId?: () => string;
  readonly createHandle?: () => string;
  readonly now?: () => string;
}

interface HandleWorkspaceRequestOptions {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly expectedSession: Session | object;
  readonly expectedSessionKey: string;
  readonly isTrustedUrl: (url: string) => boolean;
  readonly backfillRuntime?: WorkspaceBackfillRuntime;
  readonly speechSynthesisRuntime?: WorkspaceSpeechSynthesisRuntime;
  readonly handleStore?: WorkspaceHandleStore;
  readonly onBeforeBackfillCancel?: (workspaceHandle: string) => boolean;
  readonly onWorkspaceClosed?: (workspaceHandle: string) => Promise<void> | void;
  readonly recordingTranscriptionSessions?: RecordingTranscriptionSessionRegistry;
}

export interface HandleMicrophoneIntentOptions extends HandleWorkspaceRequestOptions {
  readonly now?: () => number;
}

export interface HandleUpdateMemoryTitleOptions extends HandleWorkspaceRequestOptions {
  readonly now?: () => string;
}

export interface HandleUpdateSegmentTitleOptions extends HandleWorkspaceRequestOptions {
  readonly now?: () => string;
}

export interface HandleUpdateSegmentContentTitleOptions extends HandleWorkspaceRequestOptions {
  readonly now?: () => string;
}

export type HandleUpdateSegmentSupplementTitleOptions = HandleWorkspaceRequestOptions;

export interface HandleCreateMemoryOptions extends HandleWorkspaceRequestOptions {
  readonly createMemoryId?: () => string;
  readonly now?: () => string;
}

type HandleEntityMoveOptions = HandleWorkspaceRequestOptions & {
  readonly appDataDir?: string;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
  readonly now?: () => string;
};

export interface HandleCreateRecordingDraftOptions extends HandleWorkspaceRequestOptions {
  readonly createSegmentId?: () => string;
  readonly now?: () => string;
}

export interface HandleCreateSegmentSupplementRecordingDraftOptions extends HandleWorkspaceRequestOptions {
  readonly createSupplementId?: () => string;
  readonly now?: () => string;
}

export interface HandleCreateNoteSegmentDraftOptions extends HandleWorkspaceRequestOptions {
  readonly createSegmentId?: () => string;
  readonly now?: () => string;
}

export interface HandleCreateSegmentSupplementNoteDraftOptions extends HandleWorkspaceRequestOptions {
  readonly createSupplementId?: () => string;
  readonly now?: () => string;
}

export interface HandleFinalizeRecordingDraftOptions extends HandleWorkspaceRequestOptions {
  readonly now?: () => string;
}

export interface HandleFinalizeSegmentSupplementRecordingDraftOptions extends HandleWorkspaceRequestOptions {
  readonly now?: () => string;
}

export interface HandleFinalizeNoteSegmentDraftOptions extends HandleWorkspaceRequestOptions {
  readonly now?: () => string;
}

export interface HandleFinalizeSegmentSupplementNoteDraftOptions extends HandleWorkspaceRequestOptions {
  readonly now?: () => string;
}

export interface HandleWriteNoteContentOptions extends HandleWorkspaceRequestOptions {
  readonly now?: () => string;
}

export type HandleRecordingTranscriptionControlOptions = HandleWorkspaceRequestOptions;

type HandleReadAppPermissionStatusOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly getMediaAccessStatus?: GetAppPermissionMediaAccessStatus;
  readonly getAccessibilityPermissionStatus?: GetAppAccessibilityPermissionStatus;
};

type HandleRequestAppPermissionOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly askForMediaAccess?: AskAppMediaAccess;
  readonly getMediaAccessStatus?: GetAppPermissionMediaAccessStatus;
  readonly getAccessibilityPermissionStatus?: GetAppAccessibilityPermissionStatus;
  readonly requestAccessibilityPermission?: RequestAppAccessibilityPermission;
};

type HandleVoiceSettingsRequestOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly store: VoiceSettingsStore;
};

type HandleSetVoiceSpeechSynthesisSpeakerOptions = HandleVoiceSettingsRequestOptions & {
  readonly speechSynthesisProbe?: VoiceSpeechSynthesisProbe;
};

type HandleSaveVoiceTranscriptionApiKeyOptions = HandleVoiceSettingsRequestOptions & {
  readonly probe: VoiceTranscriptionProbe;
  readonly speechSynthesisProbe?: VoiceSpeechSynthesisProbe;
};

type HandleValidateVoiceTranscriptionCredentialsOptions = HandleVoiceSettingsRequestOptions & {
  readonly probe: VoiceTranscriptionProbe;
  readonly speechSynthesisProbe?: VoiceSpeechSynthesisProbe;
};

type HandleOpenVoiceTranscriptionProviderConsoleOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly openExternal?: OpenVoiceTranscriptionProviderConsole;
};

type HandleOpenMarkdownExternalLinkOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly openExternal?: OpenExternalUrl;
};

type HandleInitializeWorkspaceForTestOptions = HandleInitializeWorkspaceOptions & {
  readonly afterWorkspaceLockAcquiredForTest?: () => MaybePromise<void>;
};

type HandleListWorkspaceMemorySpacesOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
};

type HandleReadSystemDraftWorkspaceOptions = WorkspaceIpcBaseOptions & {
  readonly appDataDir?: string;
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly now?: () => string;
};

type HandleOpenSystemDraftWorkspaceOptions = HandleReadSystemDraftWorkspaceOptions & {
  readonly handleStore?: WorkspaceHandleStore;
  readonly createHandle?: () => string;
  readonly afterWorkspaceLockAcquiredForTest?: () => MaybePromise<void>;
};

type HandleReadRecentExpressionsOptions = WorkspaceIpcBaseOptions & {
  readonly appDataDir?: string;
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
  readonly now?: () => string;
};

type HandleReadExpressionPlaybackAudioOptions = WorkspaceIpcBaseOptions & {
  readonly appDataDir?: string;
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
  readonly now?: () => string;
};

type HandleRemoveWorkspaceMemorySpaceOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
};

type HandleUpdateMemorySpaceTitleOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly handleStore?: WorkspaceHandleStore;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
};

type HandleOpenWorkspaceMemorySpaceOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly handleStore?: WorkspaceHandleStore;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
  readonly createHandle?: () => string;
  readonly afterWorkspaceLockAcquiredForTest?: () => MaybePromise<void>;
};

type HandleRevealMemorySpaceInFinderOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
  readonly fs?: FsProbe;
  readonly resolver?: ResolveMemorySpacePaths;
  readonly showItemInFolder?: ShowItemInFolder;
};

type HandleOpenMemorySpaceAgentsFileOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
  readonly fs?: FsProbe;
  readonly resolver?: ResolveMemorySpacePaths;
  readonly openPath?: OpenPath;
};

type HandleCopyMemorySpaceAbsolutePathOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
  readonly fs?: FsProbe;
  readonly resolver?: ResolveMemorySpacePaths;
  readonly writeText?: WriteClipboardText;
};

interface HandleCopyMemoryAbsolutePathOptions extends HandleWorkspaceRequestOptions {
  readonly fs?: FsProbe;
  readonly resolver?: ResolveMemoryPaths;
  readonly writeText?: WriteClipboardText;
}

interface HandleCopyMemoryRelativePathOptions extends HandleWorkspaceRequestOptions {
  readonly fs?: FsProbe;
  readonly resolver?: ResolveMemoryPaths;
  readonly writeText?: WriteClipboardText;
}

interface HandleCopySegmentAbsolutePathOptions extends HandleWorkspaceRequestOptions {
  readonly fs?: FsProbe;
  readonly resolver?: ResolveSegmentPaths;
  readonly writeText?: WriteClipboardText;
}

interface HandleCopySegmentRelativePathOptions extends HandleWorkspaceRequestOptions {
  readonly fs?: FsProbe;
  readonly resolver?: ResolveSegmentPaths;
  readonly writeText?: WriteClipboardText;
}

interface HandleCopySegmentSupplementAbsolutePathOptions extends HandleWorkspaceRequestOptions {
  readonly fs?: FsProbe;
  readonly resolver?: ResolveSegmentSupplementPaths;
  readonly writeText?: WriteClipboardText;
}

interface HandleCopySegmentSupplementRelativePathOptions extends HandleWorkspaceRequestOptions {
  readonly fs?: FsProbe;
  readonly resolver?: ResolveSegmentSupplementPaths;
  readonly writeText?: WriteClipboardText;
}

interface HandleCopyWidgetAbsolutePathOptions extends HandleWorkspaceRequestOptions {
  readonly writeText?: WriteClipboardText;
}

interface HandleCopyWidgetRelativePathOptions extends HandleWorkspaceRequestOptions {
  readonly writeText?: WriteClipboardText;
}

interface HandleCopyNeedsReviewAgentPromptOptions extends HandleWorkspaceRequestOptions {
  readonly writeText?: WriteClipboardText;
}

interface HandleCopyArtifactAgentPromptOptions extends HandleWorkspaceRequestOptions {
  readonly writeText?: WriteClipboardText;
}

interface HandleCopyWidgetAgentPromptOptions extends HandleWorkspaceRequestOptions {
  readonly writeText?: WriteClipboardText;
}

interface HandleRevealMemoryInFinderOptions extends HandleWorkspaceRequestOptions {
  readonly fs?: FsProbe;
  readonly resolver?: ResolveMemoryPaths;
  readonly showItemInFolder?: ShowItemInFolder;
}

interface HandleOpenMemoryDocumentOptions extends HandleWorkspaceRequestOptions {
  readonly fs?: FsProbe;
  readonly resolver?: ResolveMemoryPaths;
  readonly openPath?: OpenPath;
}

interface HandleOpenSegmentDocumentOptions extends HandleWorkspaceRequestOptions {
  readonly fs?: FsProbe;
  readonly resolver?: ResolveSegmentPaths;
  readonly openPath?: OpenPath;
}

interface HandleRevealSegmentInFinderOptions extends HandleWorkspaceRequestOptions {
  readonly fs?: FsProbe;
  readonly resolver?: ResolveSegmentPaths;
  readonly showItemInFolder?: ShowItemInFolder;
}

interface HandleRevealSegmentSupplementInFinderOptions extends HandleWorkspaceRequestOptions {
  readonly fs?: FsProbe;
  readonly resolver?: ResolveSegmentSupplementPaths;
  readonly showItemInFolder?: ShowItemInFolder;
}

interface HandleOpenSegmentSupplementDocumentOptions extends HandleWorkspaceRequestOptions {
  readonly fs?: FsProbe;
  readonly resolver?: ResolveSegmentSupplementPaths;
  readonly openPath?: OpenPath;
}

interface HandleRevealWidgetInFinderOptions extends HandleWorkspaceRequestOptions {
  readonly showItemInFolder?: ShowItemInFolder;
}

interface HandleOpenWidgetDocumentOptions extends HandleWorkspaceRequestOptions {
  readonly openPath?: OpenPath;
}

type AcquiredWorkspaceLock = Extract<
  Awaited<ReturnType<typeof acquireWorkspaceLock>>,
  { readonly ok: true }
>;

type TrustedResult =
  | {
      readonly ok: true;
      readonly sender: TrustedSenderIdentity;
    }
  | ReturnType<typeof workspaceError>;

async function showSystemOpenDirectoryDialog(): Promise<ShowOpenDirectoryDialogResult> {
  return requireElectronMainApi().dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
}

function showSystemItemInFolder(filePath: string): void {
  requireElectronShellApi().shell.showItemInFolder(filePath);
}

async function openSystemPath(filePath: string): Promise<string> {
  return requireElectronShellApi().shell.openPath(filePath);
}

function writeSystemClipboardText(text: string): void {
  requireElectronClipboardApi().clipboard.writeText(text);
}

function requireElectronMainApi(): Pick<typeof import('electron'), 'dialog' | 'ipcMain'> {
  if (!dialog || !ipcMain) {
    throw new Error('Electron main API is unavailable');
  }
  return { dialog, ipcMain };
}

function requireElectronShellApi(): Pick<typeof import('electron'), 'shell'> {
  if (!shell) {
    throw new Error('Electron shell API is unavailable');
  }
  return { shell };
}

function requireElectronClipboardApi(): Pick<typeof import('electron'), 'clipboard'> {
  if (!clipboard) {
    throw new Error('Electron clipboard API is unavailable');
  }
  return { clipboard };
}

function requireElectronSystemPreferencesApi(): Pick<
  typeof import('electron'),
  'systemPreferences'
> {
  if (!systemPreferences) {
    throw new Error('Electron systemPreferences API is unavailable');
  }
  return { systemPreferences };
}

export async function handleChooseWorkspaceDirectory({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  tokenStore = createWorkspaceSelectionTokenStore(),
  showOpenDirectoryDialog = showSystemOpenDirectoryDialog,
}: HandleChooseWorkspaceDirectoryOptions): Promise<WorkspaceChooseDirectoryResponse> {
  const trusted = validateTrustedWorkspaceSender({
    event,
    channel: WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
    allowedChannels: new Set(WORKSPACE_IPC_CHANNELS),
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });

  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceNoInputSchema.safeParse(input);
  if (!request.success) {
    return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'chooseDirectory accepts no payload');
  }

  try {
    const result = await showOpenDirectoryDialog();
    const rootPath = result.filePaths[0];

    if (result.canceled || !rootPath) {
      return { ok: true, value: { status: 'canceled' } };
    }

    const selection = tokenStore.issueSelection({
      rootPath,
      displayPath: path.basename(rootPath),
      sender: trusted.sender,
    });

    return workspaceChooseDirectoryResponseSchema.parse({
      ok: true,
      value: {
        status: 'selected',
        selectionToken: selection.selectionToken,
        displayPath: selection.displayPath,
      },
    });
  } catch {
    return workspaceError('ERR_WORKSPACE_CHOOSE_FAILED', 'Workspace directory selection failed');
  }
}

async function handleListWorkspaceMemorySpacesCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
}: HandleListWorkspaceMemorySpacesOptions): Promise<
  z.infer<typeof workspaceListMemorySpacesResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_LIST_MEMORY_SPACES_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceNoInputSchema.safeParse(input);
  if (!request.success) {
    return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'listMemorySpaces accepts no payload');
  }

  try {
    const memorySpaces = await memorySpaceRegistry.listMemorySpaces();
    return workspaceListMemorySpacesResponseSchema.parse({
      ok: true,
      value: { memorySpaces },
    });
  } catch (error) {
    return workspaceMemorySpaceRegistryReadError(error);
  }
}

export async function handleListWorkspaceMemorySpaces(
  options: HandleListWorkspaceMemorySpacesOptions
): Promise<z.infer<typeof workspaceListMemorySpacesResponseSchema>> {
  return handleListWorkspaceMemorySpacesCore(options);
}

export async function handleListWorkspaceMemorySpacesForTest(
  options: HandleListWorkspaceMemorySpacesOptions
): Promise<z.infer<typeof workspaceListMemorySpacesResponseSchema>> {
  return handleListWorkspaceMemorySpacesCore(options);
}

async function ensureSystemDraftWorkspaceForIpc({
  appDataDir,
  now,
}: {
  readonly appDataDir?: string | undefined;
  readonly now: () => string;
}): Promise<SystemDraftWorkspaceEnsureResult> {
  const resolvedAppDataDir = appDataDir ?? defaultAppDataDir();
  if (typeof resolvedAppDataDir !== 'string') {
    return resolvedAppDataDir;
  }
  return ensureSystemDraftWorkspace({
    appDataDir: resolvedAppDataDir,
    now,
  });
}

async function handleReadSystemDraftWorkspaceCore({
  appDataDir,
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  now = nowIso,
}: HandleReadSystemDraftWorkspaceOptions): Promise<
  z.infer<typeof workspaceReadSystemDraftWorkspaceResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_READ_SYSTEM_DRAFT_WORKSPACE_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceNoInputSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'readSystemDraftWorkspace accepts no payload'
    );
  }

  const ensured = await ensureSystemDraftWorkspaceForIpc({ appDataDir, now });
  if (!ensured.ok) {
    return ensured;
  }

  return workspaceReadSystemDraftWorkspaceResponseSchema.parse({
    ok: true,
    value: {
      draft: systemDraftProjection(),
    },
  });
}

export async function handleReadSystemDraftWorkspace(
  options: HandleReadSystemDraftWorkspaceOptions
): Promise<z.infer<typeof workspaceReadSystemDraftWorkspaceResponseSchema>> {
  return handleReadSystemDraftWorkspaceCore(options);
}

export async function handleReadSystemDraftWorkspaceForTest(
  options: HandleReadSystemDraftWorkspaceOptions
): Promise<z.infer<typeof workspaceReadSystemDraftWorkspaceResponseSchema>> {
  return handleReadSystemDraftWorkspaceCore(options);
}

async function handleOpenSystemDraftWorkspaceCore({
  appDataDir,
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  handleStore = createWorkspaceHandleStore(),
  createHandle,
  now = nowIso,
  afterWorkspaceLockAcquiredForTest,
}: HandleOpenSystemDraftWorkspaceOptions): Promise<WorkspaceOpenSystemDraftWorkspaceResponse> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_OPEN_SYSTEM_DRAFT_WORKSPACE_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceNoInputSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'openSystemDraftWorkspace accepts no payload'
    );
  }

  const ensured = await ensureSystemDraftWorkspaceForIpc({ appDataDir, now });
  if (!ensured.ok) {
    return ensured;
  }

  const lock = await acquireWorkspaceLock({ canonicalRoot: ensured.value.rootPath });
  if (!lock.ok) {
    return lock;
  }
  await afterWorkspaceLockAcquiredForTest?.();
  if (!lock.lock.isUsable()) {
    await releaseWorkspaceLockAfterFailure(lock);
    return workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost', 'none-written');
  }

  const opened = await openWorkspaceFiles({
    rootPath: ensured.value.rootPath,
    assertWorkspaceUsable: () =>
      lock.lock.isUsable()
        ? { ok: true as const }
        : workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost', 'none-written'),
  });
  if (!opened.ok) {
    await releaseWorkspaceLockAfterFailure(lock);
    return opened;
  }
  if (!isSystemDraftWorkspaceId(opened.snapshot.workspaceId)) {
    await releaseWorkspaceLockAfterFailure(lock);
    return workspaceError(
      'ERR_WORKSPACE_METADATA_INVALID',
      'System Draft workspace metadata is invalid',
      'previous-file-preserved'
    );
  }

  const store =
    createHandle === undefined ? handleStore : createWorkspaceHandleStore({ createHandle });
  let registered: ReturnType<WorkspaceHandleStore['register']> | undefined;
  try {
    registered = store.register({
      canonicalRoot: ensured.value.rootPath,
      workspaceId: opened.snapshot.workspaceId,
      sender: trusted.sender,
      lock: lock.lock,
    });
  } catch {
    await releaseWorkspaceRegistrationAfterFailure({
      lock,
      store,
      registered,
      sender: trusted.sender,
    });
    return workspaceError(
      'ERR_WORKSPACE_OPEN_FAILED',
      'System Draft workspace could not be opened'
    );
  }

  return workspaceOpenSystemDraftWorkspaceResponseSchema.parse({
    ok: true,
    value: {
      ...registered,
      defaultMemoryId: SYSTEM_DRAFT_DEFAULT_MEMORY_ID,
      draft: systemDraftProjection(),
      snapshot: annotateSystemDraftSnapshot(opened.snapshot),
    },
  });
}

export async function handleOpenSystemDraftWorkspace(
  options: HandleOpenSystemDraftWorkspaceOptions
): Promise<WorkspaceOpenSystemDraftWorkspaceResponse> {
  return handleOpenSystemDraftWorkspaceCore(options);
}

export async function handleOpenSystemDraftWorkspaceForTest(
  options: HandleOpenSystemDraftWorkspaceOptions
): Promise<WorkspaceOpenSystemDraftWorkspaceResponse> {
  return handleOpenSystemDraftWorkspaceCore(options);
}

async function handleReadRecentExpressionsCore({
  appDataDir,
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
  now = nowIso,
}: HandleReadRecentExpressionsOptions): Promise<
  z.infer<typeof workspaceReadRecentExpressionsResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_READ_RECENT_EXPRESSIONS_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceReadRecentExpressionsRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'readRecentExpressions request is invalid'
    );
  }

  const ensuredDraft = await ensureSystemDraftWorkspaceForIpc({ appDataDir, now });
  if (!ensuredDraft.ok) {
    return ensuredDraft;
  }

  const sources = [
    {
      rootPath: ensuredDraft.value.rootPath,
      workspaceId: SYSTEM_DRAFT_WORKSPACE_ID,
      workspaceTitle: SYSTEM_DRAFT_TITLE,
    },
  ];
  const skipped: Array<{
    readonly workspaceId: string;
    readonly workspaceTitle: string;
    readonly reason: 'missing';
  }> = [];

  let memorySpaces: Awaited<ReturnType<WorkspaceMemorySpaceRegistry['listMemorySpaces']>>;
  try {
    memorySpaces = await memorySpaceRegistry.listMemorySpaces();
  } catch (error) {
    return workspaceMemorySpaceRegistryReadError(error);
  }

  for (const memorySpace of memorySpaces) {
    if (isSystemDraftWorkspaceId(memorySpace.workspaceId)) {
      continue;
    }
    const resolved = await memorySpaceRegistry.resolveMemorySpace(memorySpace.workspaceId);
    if (!resolved) {
      skipped.push({
        workspaceId: memorySpace.workspaceId,
        workspaceTitle: memorySpace.title,
        reason: 'missing',
      });
      continue;
    }
    sources.push({
      rootPath: resolved.rootPath,
      workspaceId: memorySpace.workspaceId,
      workspaceTitle: memorySpace.title,
    });
  }

  const feed = await readRecentExpressionsFromWorkspaceSources({
    ...(request.data.contentKinds ? { contentKinds: request.data.contentKinds } : {}),
    limit: request.data.limit ?? 12,
    sources,
  });

  return workspaceReadRecentExpressionsResponseSchema.parse({
    ok: true,
    value: { items: feed.items, skipped: [...skipped, ...feed.skipped] },
  });
}

export async function handleReadRecentExpressions(
  options: HandleReadRecentExpressionsOptions
): Promise<z.infer<typeof workspaceReadRecentExpressionsResponseSchema>> {
  return handleReadRecentExpressionsCore(options);
}

export async function handleReadRecentExpressionsForTest(
  options: HandleReadRecentExpressionsOptions
): Promise<z.infer<typeof workspaceReadRecentExpressionsResponseSchema>> {
  return handleReadRecentExpressionsCore(options);
}

async function resolveExpressionPlaybackRootPath({
  appDataDir,
  memorySpaceRegistry,
  now,
  workspaceId,
}: {
  readonly appDataDir?: string | undefined;
  readonly memorySpaceRegistry: WorkspaceMemorySpaceRegistry;
  readonly now: () => string;
  readonly workspaceId: string;
}): Promise<{ readonly ok: true; readonly rootPath: string } | WorkspaceErrorEnvelope> {
  if (workspaceId === SYSTEM_DRAFT_WORKSPACE_ID) {
    const ensuredDraft = await ensureSystemDraftWorkspaceForIpc({ appDataDir, now });
    return ensuredDraft.ok ? { ok: true, rootPath: ensuredDraft.value.rootPath } : ensuredDraft;
  }

  try {
    const resolved = await resolveMemorySpacePaths(workspaceId, {
      registry: memorySpaceRegistry,
    });
    if (resolved.ok) {
      return { ok: true, rootPath: resolved.value.rootAbsolute };
    }
    if (resolved.code === 'ERR_WORKSPACE_ROOT_MISSING') {
      return workspaceError(
        'ERR_WORKSPACE_MEMORY_SPACE_NOT_FOUND',
        'Expression workspace could not be resolved'
      );
    }
    if (
      resolved.code === 'ERR_WORKSPACE_METADATA_INVALID' ||
      resolved.code === 'ERR_WORKSPACE_UNSAFE_PATH'
    ) {
      return workspaceError(resolved.code, 'Expression workspace root is unavailable');
    }
    return workspaceError('ERR_WORKSPACE_ROOT_MISSING', 'Expression workspace root is unavailable');
  } catch (error) {
    return workspaceMemorySpaceRegistryReadError(error);
  }
}

async function handleReadExpressionPlaybackAudioCore({
  appDataDir,
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
  now = nowIso,
}: HandleReadExpressionPlaybackAudioOptions): Promise<
  z.infer<typeof workspaceReadExpressionPlaybackAudioResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_READ_EXPRESSION_PLAYBACK_AUDIO_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceReadExpressionPlaybackAudioRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'readExpressionPlaybackAudio request is invalid'
    );
  }

  const root = await resolveExpressionPlaybackRootPath({
    appDataDir,
    memorySpaceRegistry,
    now,
    workspaceId: request.data.workspaceId,
  });
  if (!root.ok) {
    return root;
  }

  const result = await resolveExpressionPlaybackAudio({
    request: request.data,
    rootPath: root.rootPath,
  });

  return workspaceReadExpressionPlaybackAudioResponseSchema.parse(
    result.ok
      ? {
          ok: true,
          value: {
            requestId: request.data.requestId,
            workspaceId: request.data.workspaceId,
            memoryId: request.data.memoryId,
            segmentId: request.data.segmentId,
            ...(request.data.supplementId ? { supplementId: request.data.supplementId } : {}),
            kind: request.data.kind,
            audio: result.audio,
            mimeType: result.mimeType,
          },
        }
      : result
  );
}

export async function handleReadExpressionPlaybackAudio(
  options: HandleReadExpressionPlaybackAudioOptions
): Promise<z.infer<typeof workspaceReadExpressionPlaybackAudioResponseSchema>> {
  return handleReadExpressionPlaybackAudioCore(options);
}

export async function handleReadExpressionPlaybackAudioForTest(
  options: HandleReadExpressionPlaybackAudioOptions
): Promise<z.infer<typeof workspaceReadExpressionPlaybackAudioResponseSchema>> {
  return handleReadExpressionPlaybackAudioCore(options);
}

async function handleRemoveMemorySpaceCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
}: HandleRemoveWorkspaceMemorySpaceOptions): Promise<
  z.infer<typeof workspaceRemoveMemorySpaceResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_REMOVE_MEMORY_SPACE_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceRemoveMemorySpaceRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'removeMemorySpace request is invalid');
  }
  if (isSystemDraftWorkspaceId(request.data.workspaceId)) {
    return protectedSystemEntityError('System Draft workspace cannot be removed');
  }

  try {
    await memorySpaceRegistry.removeMemorySpace(request.data.workspaceId);
    return workspaceRemoveMemorySpaceResponseSchema.parse({ ok: true, value: { removed: true } });
  } catch {
    return workspaceMemorySpaceRegistryWriteError();
  }
}

export async function handleRemoveMemorySpace(
  options: HandleRemoveWorkspaceMemorySpaceOptions
): Promise<z.infer<typeof workspaceRemoveMemorySpaceResponseSchema>> {
  return handleRemoveMemorySpaceCore(options);
}

export async function handleRemoveMemorySpaceForTest(
  options: HandleRemoveWorkspaceMemorySpaceOptions
): Promise<z.infer<typeof workspaceRemoveMemorySpaceResponseSchema>> {
  return handleRemoveMemorySpaceCore(options);
}

function handleRevealMemorySpaceInFinderCore({
  fs,
  resolver = resolveMemorySpacePaths,
  showItemInFolder = showSystemItemInFolder,
  ...options
}: HandleRevealMemorySpaceInFinderOptions): Promise<WorkspaceEntityActionResponse> {
  return handleMemorySpaceEntityActionRequest({
    options,
    channel: WORKSPACE_REVEAL_MEMORY_SPACE_IN_FINDER_CHANNEL,
    schema: workspaceRevealMemorySpaceInFinderRequestSchema,
    invalidMessage: 'revealMemorySpaceInFinder request is invalid',
    resolveFailureMessage: 'Memory space path could not be resolved',
    resolve: (request, memorySpaceRegistry) =>
      resolver(request.workspaceId, {
        registry: memorySpaceRegistry,
        ...(fs ? { fs } : {}),
      }),
    run: (paths) =>
      revealEntityDirectory({
        fs: entityActionFsForResolver(fs, resolver, resolveMemorySpacePaths),
        paths: { directoryAbsolute: paths.rootAbsolute },
        missingCode: 'ERR_WORKSPACE_ROOT_MISSING',
        missingMessage: 'Memory space root is missing',
        unsafeMessage: 'Memory space root is unsafe',
        showItemInFolder,
        failureMessage: 'Memory space could not be revealed',
      }),
  });
}

export async function handleRevealMemorySpaceInFinder(
  options: HandleRevealMemorySpaceInFinderOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleRevealMemorySpaceInFinderCore(options);
}

export async function handleRevealMemorySpaceInFinderForTest(
  options: HandleRevealMemorySpaceInFinderOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleRevealMemorySpaceInFinderCore(options);
}

function handleOpenMemorySpaceAgentsFileCore({
  fs,
  resolver = resolveMemorySpacePaths,
  openPath = openSystemPath,
  ...options
}: HandleOpenMemorySpaceAgentsFileOptions): Promise<WorkspaceEntityActionResponse> {
  return handleMemorySpaceEntityActionRequest({
    options,
    channel: WORKSPACE_OPEN_MEMORY_SPACE_AGENTS_FILE_CHANNEL,
    schema: workspaceOpenMemorySpaceAgentsFileRequestSchema,
    invalidMessage: 'openMemorySpaceAgentsFile request is invalid',
    resolveFailureMessage: 'Memory space agent entry path could not be resolved',
    resolve: (request, memorySpaceRegistry) =>
      resolver(request.workspaceId, {
        registry: memorySpaceRegistry,
        requireAgentEntryFile: true,
        ...(fs ? { fs } : {}),
      }),
    run: (paths) =>
      openEntityDocument({
        fs: entityActionFsForResolver(fs, resolver, resolveMemorySpacePaths),
        paths: { documentAbsolute: paths.agentEntryFileAbsolute },
        missingCode: 'ERR_MEMORY_SPACE_AGENT_ENTRY_MISSING',
        missingMessage: 'Memory space agent entry is missing',
        unsafeMessage: 'Memory space agent entry path is unsafe',
        openPath,
        failureMessage: 'Memory space agent entry could not be opened',
      }),
  });
}

export async function handleOpenMemorySpaceAgentsFile(
  options: HandleOpenMemorySpaceAgentsFileOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleOpenMemorySpaceAgentsFileCore(options);
}

export async function handleOpenMemorySpaceAgentsFileForTest(
  options: HandleOpenMemorySpaceAgentsFileOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleOpenMemorySpaceAgentsFileCore(options);
}

function handleCopyMemorySpaceAbsolutePathCore({
  fs,
  resolver = resolveMemorySpacePaths,
  writeText = writeSystemClipboardText,
  ...options
}: HandleCopyMemorySpaceAbsolutePathOptions): Promise<WorkspaceEntityActionResponse> {
  return handleMemorySpaceEntityActionRequest({
    options,
    channel: WORKSPACE_COPY_MEMORY_SPACE_ABSOLUTE_PATH_CHANNEL,
    schema: workspaceCopyMemorySpaceAbsolutePathRequestSchema,
    invalidMessage: 'copyMemorySpaceAbsolutePath request is invalid',
    resolveFailureMessage: 'Memory space path could not be resolved',
    resolve: (request, memorySpaceRegistry) =>
      resolver(request.workspaceId, {
        registry: memorySpaceRegistry,
        ...(fs ? { fs } : {}),
      }),
    run: (paths) =>
      copyEntityAbsoluteDirectoryPath({
        fs: entityActionFsForResolver(fs, resolver, resolveMemorySpacePaths),
        paths: { directoryAbsolute: paths.rootAbsolute },
        missingCode: 'ERR_WORKSPACE_ROOT_MISSING',
        missingMessage: 'Memory space root is missing',
        unsafeMessage: 'Memory space root is unsafe',
        writeText,
        failureMessage: 'Memory space path could not be copied',
      }),
  });
}

export async function handleCopyMemorySpaceAbsolutePath(
  options: HandleCopyMemorySpaceAbsolutePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopyMemorySpaceAbsolutePathCore(options);
}

export async function handleCopyMemorySpaceAbsolutePathForTest(
  options: HandleCopyMemorySpaceAbsolutePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopyMemorySpaceAbsolutePathCore(options);
}

function handleCopyNeedsReviewAgentPromptCore({
  writeText = writeSystemClipboardText,
  ...options
}: HandleCopyNeedsReviewAgentPromptOptions): Promise<
  WorkspaceEntityActionResponse | WorkspaceErrorEnvelope
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_COPY_NEEDS_REVIEW_AGENT_PROMPT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceCopyNeedsReviewAgentPromptRequestSchema,
    invalidMessage: 'copyNeedsReviewAgentPrompt request is invalid',
    run: (request, handle) => {
      if (request.workspaceId !== handle.workspaceId) {
        return workspaceError(
          'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
          'Needs-review prompt copy workspace does not match the active handle'
        );
      }

      try {
        writeText(buildWorkspaceReviewAgentPrompt(request.needsReviewCount));
      } catch {
        return workspaceError(
          'ERR_CLIPBOARD_WRITE_FAILED',
          'Needs-review prompt could not be copied'
        );
      }

      return workspaceEntityActionResponseSchema.parse({ ok: true });
    },
  });
}

export async function handleCopyNeedsReviewAgentPrompt(
  options: HandleCopyNeedsReviewAgentPromptOptions
): Promise<WorkspaceEntityActionResponse | WorkspaceErrorEnvelope> {
  return handleCopyNeedsReviewAgentPromptCore(options);
}

export async function handleCopyNeedsReviewAgentPromptForTest(
  options: HandleCopyNeedsReviewAgentPromptOptions
): Promise<WorkspaceEntityActionResponse | WorkspaceErrorEnvelope> {
  return handleCopyNeedsReviewAgentPromptCore(options);
}

async function resolveArtifactAgentPromptTarget({
  handle,
  request,
}: {
  readonly handle: RequiredWorkspaceHandle;
  readonly request: WorkspaceCopyArtifactAgentPromptRequest;
}): Promise<
  { readonly ok: true; readonly targetDirectoryRelative: string } | WorkspaceErrorEnvelope
> {
  try {
    const resolved = await resolveArtifactPromptTargetDirectory({ handle, request });
    if (!resolved.ok) {
      return resolved;
    }
    return {
      ok: true,
      targetDirectoryRelative: workspaceRelativePosixPath(handle, resolved.directoryAbsolute),
    };
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Artifact prompt target could not be resolved'
    );
  }
}

function handleCopyArtifactAgentPromptCore({
  writeText = writeSystemClipboardText,
  ...options
}: HandleCopyArtifactAgentPromptOptions): Promise<
  WorkspaceEntityActionResponse | WorkspaceErrorEnvelope
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_COPY_ARTIFACT_AGENT_PROMPT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceCopyArtifactAgentPromptRequestSchema,
    invalidMessage: 'copyArtifactAgentPrompt request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Artifact prompt copy workspace does not match the active handle'
          );
        }

        const target = await resolveArtifactAgentPromptTarget({
          handle,
          request,
        });
        if (!target.ok) {
          return target;
        }

        try {
          writeText(
            buildWorkspaceArtifactAgentPrompt({
              request,
              targetDirectoryRelative: target.targetDirectoryRelative,
            })
          );
        } catch {
          return workspaceError(
            'ERR_CLIPBOARD_WRITE_FAILED',
            'Artifact prompt could not be copied'
          );
        }

        return workspaceEntityActionResponseSchema.parse({ ok: true });
      }),
  });
}

export async function handleCopyArtifactAgentPrompt(
  options: HandleCopyArtifactAgentPromptOptions
): Promise<WorkspaceEntityActionResponse | WorkspaceErrorEnvelope> {
  return handleCopyArtifactAgentPromptCore(options);
}

export async function handleCopyArtifactAgentPromptForTest(
  options: HandleCopyArtifactAgentPromptOptions
): Promise<WorkspaceEntityActionResponse | WorkspaceErrorEnvelope> {
  return handleCopyArtifactAgentPromptCore(options);
}

function handleCopyWidgetAgentPromptCore({
  writeText = writeSystemClipboardText,
  ...options
}: HandleCopyWidgetAgentPromptOptions): Promise<
  WorkspaceEntityActionResponse | WorkspaceErrorEnvelope
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_COPY_WIDGET_AGENT_PROMPT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceCopyWidgetAgentPromptRequestSchema,
    invalidMessage: 'copyWidgetAgentPrompt request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Widget prompt copy workspace does not match the active handle'
          );
        }

        const target = await resolveWidgetAgentPromptTarget({ handle, request });
        if (!target.ok) {
          return target;
        }

        try {
          writeText(
            buildWorkspaceWidgetAgentPrompt({
              request,
              targetDirectoryRelative: target.targetDirectoryRelative,
            })
          );
        } catch {
          return workspaceError('ERR_CLIPBOARD_WRITE_FAILED', 'Widget prompt could not be copied');
        }

        return workspaceEntityActionResponseSchema.parse({ ok: true });
      }),
  });
}

export async function handleCopyWidgetAgentPrompt(
  options: HandleCopyWidgetAgentPromptOptions
): Promise<WorkspaceEntityActionResponse | WorkspaceErrorEnvelope> {
  return handleCopyWidgetAgentPromptCore(options);
}

export async function handleCopyWidgetAgentPromptForTest(
  options: HandleCopyWidgetAgentPromptOptions
): Promise<WorkspaceEntityActionResponse | WorkspaceErrorEnvelope> {
  return handleCopyWidgetAgentPromptCore(options);
}

function artifactRuntimeTargetFromRequest(
  request: z.infer<typeof workspaceReadArtifactRuntimeStateRequestSchema>
): ArtifactRuntimeTarget {
  if (request.targetType === 'widget') {
    return {
      targetType: 'widget',
      workspaceId: request.workspaceId,
      widgetId: request.widgetId,
    };
  }
  if (request.targetType === 'supplement') {
    return {
      targetType: 'supplement',
      workspaceId: request.workspaceId,
      memoryId: request.memoryId,
      segmentId: request.segmentId,
      supplementId: request.supplementId,
    };
  }
  return {
    targetType: 'segment',
    workspaceId: request.workspaceId,
    memoryId: request.memoryId,
    segmentId: request.segmentId,
  };
}

function artifactRuntimeWorkspaceMismatchError(): WorkspaceErrorEnvelope {
  return workspaceError(
    'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
    'Artifact runtime workspace does not match the active handle'
  );
}

function handleReadArtifactRuntimeStateCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadArtifactRuntimeStateResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_READ_ARTIFACT_RUNTIME_STATE_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceReadArtifactRuntimeStateRequestSchema,
    invalidMessage: 'readArtifactRuntimeState request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return artifactRuntimeWorkspaceMismatchError();
        }
        const result = await readArtifactRuntimeState({
          rootPath: handle.canonicalRoot,
          target: artifactRuntimeTargetFromRequest(request),
        });
        return workspaceReadArtifactRuntimeStateResponseSchema.parse(
          result.ok
            ? { ok: true, value: { requestId: request.requestId, ...result.value } }
            : result
        );
      }),
  });
}

function handleWriteArtifactRuntimeStateCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceWriteArtifactRuntimeStateResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_WRITE_ARTIFACT_RUNTIME_STATE_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceWriteArtifactRuntimeStateRequestSchema,
    invalidMessage: 'writeArtifactRuntimeState request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return artifactRuntimeWorkspaceMismatchError();
        }
        const result = await writeArtifactRuntimeState({
          rootPath: handle.canonicalRoot,
          target: artifactRuntimeTargetFromRequest(request),
          baselineVersion: request.baselineVersion,
          state: request.state,
        });
        return workspaceWriteArtifactRuntimeStateResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: { requestId: request.requestId, ...result.value },
              }
            : result
        );
      }),
  });
}

export async function handleReadArtifactRuntimeStateForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadArtifactRuntimeStateResponseSchema>> {
  return handleReadArtifactRuntimeStateCore(options);
}

export async function handleWriteArtifactRuntimeStateForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceWriteArtifactRuntimeStateResponseSchema>> {
  return handleWriteArtifactRuntimeStateCore(options);
}

function handleCopyMemoryAbsolutePathCore({
  fs,
  resolver = resolveMemoryPaths,
  writeText = writeSystemClipboardText,
  ...options
}: HandleCopyMemoryAbsolutePathOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_COPY_MEMORY_ABSOLUTE_PATH_CHANNEL,
    schema: workspaceCopyMemoryAbsolutePathRequestSchema,
    invalidMessage: 'copyMemoryAbsolutePath request is invalid',
    workspaceMismatchMessage: 'Memory path copy workspace does not match the active handle',
    resolveFailureMessage: 'Memory path could not be resolved',
    resolve: (request, handle) =>
      resolver(handle, request.workspaceId, request.memoryId, {
        ...(fs ? { fs } : {}),
      }),
    run: (paths, handle) =>
      copyEntityDirectoryPath({
        paths,
        handle,
        fs: entityActionFsForResolver(fs, resolver, resolveMemoryPaths),
        pathKind: 'absolute',
        missingCode: 'ERR_WORKSPACE_MEMORY_NOT_FOUND',
        missingMessage: 'Memory path is missing',
        unsafeMessage: 'Memory path is unsafe',
        writeText,
        failureMessage: 'Memory path could not be copied',
      }),
  });
}

export async function handleCopyMemoryAbsolutePath(
  options: HandleCopyMemoryAbsolutePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopyMemoryAbsolutePathCore(options);
}

export async function handleCopyMemoryAbsolutePathForTest(
  options: HandleCopyMemoryAbsolutePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopyMemoryAbsolutePathCore(options);
}

function handleCopyMemoryRelativePathCore({
  fs,
  resolver = resolveMemoryPaths,
  writeText = writeSystemClipboardText,
  ...options
}: HandleCopyMemoryRelativePathOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_COPY_MEMORY_RELATIVE_PATH_CHANNEL,
    schema: workspaceCopyMemoryRelativePathRequestSchema,
    invalidMessage: 'copyMemoryRelativePath request is invalid',
    workspaceMismatchMessage:
      'Memory relative path copy workspace does not match the active handle',
    resolveFailureMessage: 'Memory relative path could not be resolved',
    resolve: (request, handle) =>
      resolver(handle, request.workspaceId, request.memoryId, {
        ...(fs ? { fs } : {}),
      }),
    run: (paths, handle) =>
      copyEntityDirectoryPath({
        paths,
        handle,
        fs: entityActionFsForResolver(fs, resolver, resolveMemoryPaths),
        pathKind: 'relative',
        missingCode: 'ERR_WORKSPACE_MEMORY_NOT_FOUND',
        missingMessage: 'Memory relative path is missing',
        unsafeMessage: 'Memory relative path is unsafe',
        writeText,
        failureMessage: 'Memory relative path could not be copied',
      }),
  });
}

export async function handleCopyMemoryRelativePath(
  options: HandleCopyMemoryRelativePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopyMemoryRelativePathCore(options);
}

export async function handleCopyMemoryRelativePathForTest(
  options: HandleCopyMemoryRelativePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopyMemoryRelativePathCore(options);
}

function handleRevealMemoryInFinderCore({
  fs,
  resolver = resolveMemoryPaths,
  showItemInFolder = showSystemItemInFolder,
  ...options
}: HandleRevealMemoryInFinderOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_REVEAL_MEMORY_IN_FINDER_CHANNEL,
    schema: workspaceRevealMemoryInFinderRequestSchema,
    invalidMessage: 'revealMemoryInFinder request is invalid',
    workspaceMismatchMessage: 'Memory reveal workspace does not match the active handle',
    resolveFailureMessage: 'Memory path could not be resolved',
    resolve: (request, handle) =>
      resolver(handle, request.workspaceId, request.memoryId, {
        ...(fs ? { fs } : {}),
      }),
    run: (paths) =>
      revealEntityDirectory({
        paths,
        fs: entityActionFsForResolver(fs, resolver, resolveMemoryPaths),
        missingCode: 'ERR_WORKSPACE_MEMORY_NOT_FOUND',
        missingMessage: 'Memory path is missing',
        unsafeMessage: 'Memory path is unsafe',
        showItemInFolder,
        failureMessage: 'Memory could not be revealed',
      }),
  });
}

export async function handleRevealMemoryInFinder(
  options: HandleRevealMemoryInFinderOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleRevealMemoryInFinderCore(options);
}

export async function handleRevealMemoryInFinderForTest(
  options: HandleRevealMemoryInFinderOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleRevealMemoryInFinderCore(options);
}

function handleOpenMemoryDocumentCore({
  fs,
  resolver = resolveMemoryPaths,
  openPath = openSystemPath,
  ...options
}: HandleOpenMemoryDocumentOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_OPEN_MEMORY_DOCUMENT_CHANNEL,
    schema: workspaceOpenMemoryDocumentRequestSchema,
    invalidMessage: 'openMemoryDocument request is invalid',
    workspaceMismatchMessage: 'Memory document workspace does not match the active handle',
    resolveFailureMessage: 'Memory document path could not be resolved',
    resolve: (request, handle) =>
      resolver(handle, request.workspaceId, request.memoryId, {
        requireDocument: true,
        ...(fs ? { fs } : {}),
      }),
    run: (paths) =>
      openEntityDocument({
        paths,
        fs: entityActionFsForResolver(fs, resolver, resolveMemoryPaths),
        missingCode: 'ERR_ENTITY_DOCUMENT_MISSING',
        missingMessage: 'Memory document is missing',
        unsafeMessage: 'Memory document path is unsafe',
        openPath,
        failureMessage: 'Memory document could not be opened',
      }),
  });
}

export async function handleOpenMemoryDocument(
  options: HandleOpenMemoryDocumentOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleOpenMemoryDocumentCore(options);
}

export async function handleOpenMemoryDocumentForTest(
  options: HandleOpenMemoryDocumentOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleOpenMemoryDocumentCore(options);
}

function handleOpenSegmentDocumentCore({
  fs,
  resolver = resolveSegmentPaths,
  openPath = openSystemPath,
  ...options
}: HandleOpenSegmentDocumentOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_OPEN_SEGMENT_DOCUMENT_CHANNEL,
    schema: workspaceOpenSegmentDocumentRequestSchema,
    invalidMessage: 'openSegmentDocument request is invalid',
    workspaceMismatchMessage: 'Segment document workspace does not match the active handle',
    resolveFailureMessage: 'Segment document path could not be resolved',
    resolve: (request, handle) =>
      resolver(handle, request.workspaceId, request.memoryId, request.segmentId, {
        requireDocument: true,
        ...(fs ? { fs } : {}),
      }),
    run: (paths) =>
      openEntityDocument({
        paths,
        fs: entityActionFsForResolver(fs, resolver, resolveSegmentPaths),
        missingCode: 'ERR_ENTITY_DOCUMENT_MISSING',
        missingMessage: 'Segment document is missing',
        unsafeMessage: 'Segment document path is unsafe',
        openPath,
        failureMessage: 'Segment document could not be opened',
      }),
  });
}

export async function handleOpenSegmentDocument(
  options: HandleOpenSegmentDocumentOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleOpenSegmentDocumentCore(options);
}

export async function handleOpenSegmentDocumentForTest(
  options: HandleOpenSegmentDocumentOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleOpenSegmentDocumentCore(options);
}

function handleRevealSegmentInFinderCore({
  fs,
  resolver = resolveSegmentPaths,
  showItemInFolder = showSystemItemInFolder,
  ...options
}: HandleRevealSegmentInFinderOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_REVEAL_SEGMENT_IN_FINDER_CHANNEL,
    schema: workspaceRevealSegmentInFinderRequestSchema,
    invalidMessage: 'revealSegmentInFinder request is invalid',
    workspaceMismatchMessage: 'Segment reveal workspace does not match the active handle',
    resolveFailureMessage: 'Segment path could not be resolved',
    resolve: (request, handle) =>
      resolver(handle, request.workspaceId, request.memoryId, request.segmentId, {
        ...(fs ? { fs } : {}),
      }),
    run: (paths) =>
      revealEntityDirectory({
        paths,
        fs: entityActionFsForResolver(fs, resolver, resolveSegmentPaths),
        missingCode: 'ERR_WORKSPACE_SEGMENT_NOT_FOUND',
        missingMessage: 'Segment path is missing',
        unsafeMessage: 'Segment path is unsafe',
        showItemInFolder,
        failureMessage: 'Segment could not be revealed',
      }),
  });
}

export async function handleRevealSegmentInFinder(
  options: HandleRevealSegmentInFinderOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleRevealSegmentInFinderCore(options);
}

export async function handleRevealSegmentInFinderForTest(
  options: HandleRevealSegmentInFinderOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleRevealSegmentInFinderCore(options);
}

function handleCopySegmentAbsolutePathCore({
  fs,
  resolver = resolveSegmentPaths,
  writeText = writeSystemClipboardText,
  ...options
}: HandleCopySegmentAbsolutePathOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_COPY_SEGMENT_ABSOLUTE_PATH_CHANNEL,
    schema: workspaceCopySegmentAbsolutePathRequestSchema,
    invalidMessage: 'copySegmentAbsolutePath request is invalid',
    workspaceMismatchMessage: 'Segment path copy workspace does not match the active handle',
    resolveFailureMessage: 'Segment path could not be resolved',
    resolve: (request, handle) =>
      resolver(handle, request.workspaceId, request.memoryId, request.segmentId, {
        ...(fs ? { fs } : {}),
      }),
    run: (paths, handle) =>
      copyEntityDirectoryPath({
        paths,
        handle,
        fs: entityActionFsForResolver(fs, resolver, resolveSegmentPaths),
        pathKind: 'absolute',
        missingCode: 'ERR_WORKSPACE_SEGMENT_NOT_FOUND',
        missingMessage: 'Segment path is missing',
        unsafeMessage: 'Segment path is unsafe',
        writeText,
        failureMessage: 'Segment path could not be copied',
      }),
  });
}

export async function handleCopySegmentAbsolutePath(
  options: HandleCopySegmentAbsolutePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopySegmentAbsolutePathCore(options);
}

export async function handleCopySegmentAbsolutePathForTest(
  options: HandleCopySegmentAbsolutePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopySegmentAbsolutePathCore(options);
}

function handleCopySegmentRelativePathCore({
  fs,
  resolver = resolveSegmentPaths,
  writeText = writeSystemClipboardText,
  ...options
}: HandleCopySegmentRelativePathOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_COPY_SEGMENT_RELATIVE_PATH_CHANNEL,
    schema: workspaceCopySegmentRelativePathRequestSchema,
    invalidMessage: 'copySegmentRelativePath request is invalid',
    workspaceMismatchMessage:
      'Segment relative path copy workspace does not match the active handle',
    resolveFailureMessage: 'Segment relative path could not be resolved',
    resolve: (request, handle) =>
      resolver(handle, request.workspaceId, request.memoryId, request.segmentId, {
        ...(fs ? { fs } : {}),
      }),
    run: (paths, handle) =>
      copyEntityDirectoryPath({
        paths,
        handle,
        fs: entityActionFsForResolver(fs, resolver, resolveSegmentPaths),
        pathKind: 'relative',
        missingCode: 'ERR_WORKSPACE_SEGMENT_NOT_FOUND',
        missingMessage: 'Segment relative path is missing',
        unsafeMessage: 'Segment relative path is unsafe',
        writeText,
        failureMessage: 'Segment relative path could not be copied',
      }),
  });
}

export async function handleCopySegmentRelativePath(
  options: HandleCopySegmentRelativePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopySegmentRelativePathCore(options);
}

export async function handleCopySegmentRelativePathForTest(
  options: HandleCopySegmentRelativePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopySegmentRelativePathCore(options);
}

function handleCopySegmentSupplementAbsolutePathCore({
  fs,
  resolver = resolveSegmentSupplementPaths,
  writeText = writeSystemClipboardText,
  ...options
}: HandleCopySegmentSupplementAbsolutePathOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_COPY_SEGMENT_SUPPLEMENT_ABSOLUTE_PATH_CHANNEL,
    schema: workspaceCopySegmentSupplementAbsolutePathRequestSchema,
    invalidMessage: 'copySegmentSupplementAbsolutePath request is invalid',
    workspaceMismatchMessage:
      'SegmentSupplement path copy workspace does not match the active handle',
    resolveFailureMessage: 'SegmentSupplement path could not be resolved',
    resolve: (request, handle) =>
      resolver(
        handle,
        request.workspaceId,
        request.memoryId,
        request.segmentId,
        request.supplementId,
        {
          ...(fs ? { fs } : {}),
        }
      ),
    run: (paths, handle) =>
      copyEntityDirectoryPath({
        paths,
        handle,
        fs: entityActionFsForResolver(fs, resolver, resolveSegmentSupplementPaths),
        pathKind: 'absolute',
        missingCode: 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND',
        missingMessage: 'SegmentSupplement path is missing',
        unsafeMessage: 'SegmentSupplement path is unsafe',
        writeText,
        failureMessage: 'SegmentSupplement path could not be copied',
      }),
  });
}

export async function handleCopySegmentSupplementAbsolutePath(
  options: HandleCopySegmentSupplementAbsolutePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopySegmentSupplementAbsolutePathCore(options);
}

export async function handleCopySegmentSupplementAbsolutePathForTest(
  options: HandleCopySegmentSupplementAbsolutePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopySegmentSupplementAbsolutePathCore(options);
}

function handleCopySegmentSupplementRelativePathCore({
  fs,
  resolver = resolveSegmentSupplementPaths,
  writeText = writeSystemClipboardText,
  ...options
}: HandleCopySegmentSupplementRelativePathOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_COPY_SEGMENT_SUPPLEMENT_RELATIVE_PATH_CHANNEL,
    schema: workspaceCopySegmentSupplementRelativePathRequestSchema,
    invalidMessage: 'copySegmentSupplementRelativePath request is invalid',
    workspaceMismatchMessage:
      'SegmentSupplement relative path copy workspace does not match the active handle',
    resolveFailureMessage: 'SegmentSupplement relative path could not be resolved',
    resolve: (request, handle) =>
      resolver(
        handle,
        request.workspaceId,
        request.memoryId,
        request.segmentId,
        request.supplementId,
        {
          ...(fs ? { fs } : {}),
        }
      ),
    run: (paths, handle) =>
      copyEntityDirectoryPath({
        paths,
        handle,
        fs: entityActionFsForResolver(fs, resolver, resolveSegmentSupplementPaths),
        pathKind: 'relative',
        missingCode: 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND',
        missingMessage: 'SegmentSupplement relative path is missing',
        unsafeMessage: 'SegmentSupplement relative path is unsafe',
        writeText,
        failureMessage: 'SegmentSupplement relative path could not be copied',
      }),
  });
}

export async function handleCopySegmentSupplementRelativePath(
  options: HandleCopySegmentSupplementRelativePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopySegmentSupplementRelativePathCore(options);
}

export async function handleCopySegmentSupplementRelativePathForTest(
  options: HandleCopySegmentSupplementRelativePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopySegmentSupplementRelativePathCore(options);
}

function handleRevealSegmentSupplementInFinderCore({
  fs,
  resolver = resolveSegmentSupplementPaths,
  showItemInFolder = showSystemItemInFolder,
  ...options
}: HandleRevealSegmentSupplementInFinderOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_REVEAL_SEGMENT_SUPPLEMENT_IN_FINDER_CHANNEL,
    schema: workspaceRevealSegmentSupplementInFinderRequestSchema,
    invalidMessage: 'revealSegmentSupplementInFinder request is invalid',
    workspaceMismatchMessage: 'SegmentSupplement reveal workspace does not match the active handle',
    resolveFailureMessage: 'SegmentSupplement path could not be resolved',
    resolve: (request, handle) =>
      resolver(
        handle,
        request.workspaceId,
        request.memoryId,
        request.segmentId,
        request.supplementId,
        {
          ...(fs ? { fs } : {}),
        }
      ),
    run: (paths) =>
      revealEntityDirectory({
        paths,
        fs: entityActionFsForResolver(fs, resolver, resolveSegmentSupplementPaths),
        missingCode: 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND',
        missingMessage: 'SegmentSupplement path is missing',
        unsafeMessage: 'SegmentSupplement path is unsafe',
        showItemInFolder,
        failureMessage: 'SegmentSupplement could not be revealed',
      }),
  });
}

export async function handleRevealSegmentSupplementInFinder(
  options: HandleRevealSegmentSupplementInFinderOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleRevealSegmentSupplementInFinderCore(options);
}

export async function handleRevealSegmentSupplementInFinderForTest(
  options: HandleRevealSegmentSupplementInFinderOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleRevealSegmentSupplementInFinderCore(options);
}

function handleOpenSegmentSupplementDocumentCore({
  fs,
  resolver = resolveSegmentSupplementPaths,
  openPath = openSystemPath,
  ...options
}: HandleOpenSegmentSupplementDocumentOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_OPEN_SEGMENT_SUPPLEMENT_DOCUMENT_CHANNEL,
    schema: workspaceOpenSegmentSupplementDocumentRequestSchema,
    invalidMessage: 'openSegmentSupplementDocument request is invalid',
    workspaceMismatchMessage:
      'SegmentSupplement document workspace does not match the active handle',
    resolveFailureMessage: 'SegmentSupplement document path could not be resolved',
    resolve: (request, handle) =>
      resolver(
        handle,
        request.workspaceId,
        request.memoryId,
        request.segmentId,
        request.supplementId,
        {
          requireDocument: true,
          ...(fs ? { fs } : {}),
        }
      ),
    run: (paths) =>
      openEntityDocument({
        paths,
        fs: entityActionFsForResolver(fs, resolver, resolveSegmentSupplementPaths),
        missingCode: 'ERR_ENTITY_DOCUMENT_MISSING',
        missingMessage: 'SegmentSupplement document is missing',
        unsafeMessage: 'SegmentSupplement document path is unsafe',
        openPath,
        failureMessage: 'SegmentSupplement document could not be opened',
      }),
  });
}

export async function handleOpenSegmentSupplementDocument(
  options: HandleOpenSegmentSupplementDocumentOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleOpenSegmentSupplementDocumentCore(options);
}

export async function handleOpenSegmentSupplementDocumentForTest(
  options: HandleOpenSegmentSupplementDocumentOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleOpenSegmentSupplementDocumentCore(options);
}

function handleRevealWidgetInFinderCore({
  showItemInFolder = showSystemItemInFolder,
  ...options
}: HandleRevealWidgetInFinderOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_REVEAL_WIDGET_IN_FINDER_CHANNEL,
    schema: workspaceRevealWidgetInFinderRequestSchema,
    invalidMessage: 'revealWidgetInFinder request is invalid',
    workspaceMismatchMessage: 'Widget reveal workspace does not match the active handle',
    resolveFailureMessage: 'Widget path could not be resolved',
    resolve: (request, handle) =>
      resolveWidgetPaths({
        widgetId: request.widgetId,
        handle,
        workspaceId: request.workspaceId,
      }),
    run: (paths) =>
      revealEntityDirectory({
        paths,
        fs: nodeFsProbe,
        missingCode: 'ERR_WORKSPACE_WIDGET_NOT_FOUND',
        missingMessage: 'Widget path is missing',
        unsafeMessage: 'Widget path is unsafe',
        showItemInFolder,
        failureMessage: 'Widget could not be revealed',
      }),
  });
}

export async function handleRevealWidgetInFinder(
  options: HandleRevealWidgetInFinderOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleRevealWidgetInFinderCore(options);
}

export async function handleRevealWidgetInFinderForTest(
  options: HandleRevealWidgetInFinderOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleRevealWidgetInFinderCore(options);
}

function handleOpenWidgetDocumentCore({
  openPath = openSystemPath,
  ...options
}: HandleOpenWidgetDocumentOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_OPEN_WIDGET_DOCUMENT_CHANNEL,
    schema: workspaceOpenWidgetDocumentRequestSchema,
    invalidMessage: 'openWidgetDocument request is invalid',
    workspaceMismatchMessage: 'Widget document workspace does not match the active handle',
    resolveFailureMessage: 'Widget document path could not be resolved',
    resolve: (request, handle) =>
      resolveWidgetPaths({
        widgetId: request.widgetId,
        handle,
        workspaceId: request.workspaceId,
      }),
    run: (paths) =>
      openEntityDocument({
        paths,
        fs: nodeFsProbe,
        missingCode: 'ERR_ENTITY_DOCUMENT_MISSING',
        missingMessage: 'Widget document is missing',
        unsafeMessage: 'Widget document path is unsafe',
        openPath,
        failureMessage: 'Widget document could not be opened',
      }),
  });
}

export async function handleOpenWidgetDocument(
  options: HandleOpenWidgetDocumentOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleOpenWidgetDocumentCore(options);
}

export async function handleOpenWidgetDocumentForTest(
  options: HandleOpenWidgetDocumentOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleOpenWidgetDocumentCore(options);
}

function handleCopyWidgetAbsolutePathCore({
  writeText = writeSystemClipboardText,
  ...options
}: HandleCopyWidgetAbsolutePathOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_COPY_WIDGET_ABSOLUTE_PATH_CHANNEL,
    schema: workspaceCopyWidgetAbsolutePathRequestSchema,
    invalidMessage: 'copyWidgetAbsolutePath request is invalid',
    workspaceMismatchMessage: 'Widget path copy workspace does not match the active handle',
    resolveFailureMessage: 'Widget path could not be resolved',
    resolve: (request, handle) =>
      resolveWidgetPaths({
        widgetId: request.widgetId,
        handle,
        workspaceId: request.workspaceId,
      }),
    run: (paths, handle) =>
      copyEntityDirectoryPath({
        paths,
        handle,
        fs: nodeFsProbe,
        pathKind: 'absolute',
        missingCode: 'ERR_WORKSPACE_WIDGET_NOT_FOUND',
        missingMessage: 'Widget path is missing',
        unsafeMessage: 'Widget path is unsafe',
        writeText,
        failureMessage: 'Widget path could not be copied',
      }),
  });
}

export async function handleCopyWidgetAbsolutePath(
  options: HandleCopyWidgetAbsolutePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopyWidgetAbsolutePathCore(options);
}

export async function handleCopyWidgetAbsolutePathForTest(
  options: HandleCopyWidgetAbsolutePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopyWidgetAbsolutePathCore(options);
}

function handleCopyWidgetRelativePathCore({
  writeText = writeSystemClipboardText,
  ...options
}: HandleCopyWidgetRelativePathOptions): Promise<WorkspaceEntityActionResponse> {
  return handleWorkspaceEntityActionRequest({
    options,
    channel: WORKSPACE_COPY_WIDGET_RELATIVE_PATH_CHANNEL,
    schema: workspaceCopyWidgetRelativePathRequestSchema,
    invalidMessage: 'copyWidgetRelativePath request is invalid',
    workspaceMismatchMessage:
      'Widget relative path copy workspace does not match the active handle',
    resolveFailureMessage: 'Widget relative path could not be resolved',
    resolve: (request, handle) =>
      resolveWidgetPaths({
        widgetId: request.widgetId,
        handle,
        workspaceId: request.workspaceId,
      }),
    run: (paths, handle) =>
      copyEntityDirectoryPath({
        paths,
        handle,
        fs: nodeFsProbe,
        pathKind: 'relative',
        missingCode: 'ERR_WORKSPACE_WIDGET_NOT_FOUND',
        missingMessage: 'Widget relative path is missing',
        unsafeMessage: 'Widget relative path is unsafe',
        writeText,
        failureMessage: 'Widget relative path could not be copied',
      }),
  });
}

export async function handleCopyWidgetRelativePath(
  options: HandleCopyWidgetRelativePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopyWidgetRelativePathCore(options);
}

export async function handleCopyWidgetRelativePathForTest(
  options: HandleCopyWidgetRelativePathOptions
): Promise<WorkspaceEntityActionResponse> {
  return handleCopyWidgetRelativePathCore(options);
}

async function persistMemorySpaceTitleUpdate({
  canonicalRoot,
  workspaceId,
  title,
  memorySpaceRegistry,
  assertWorkspaceUsable,
  relocateWorkspaceRoot,
  registryProjection = 'required',
}: {
  readonly canonicalRoot: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly memorySpaceRegistry: WorkspaceMemorySpaceRegistry;
  readonly assertWorkspaceUsable: () => WorkspaceErrorEnvelope | { readonly ok: true };
  readonly relocateWorkspaceRoot: (
    canonicalRoot: string
  ) => WorkspaceErrorEnvelope | { readonly ok: true };
  readonly registryProjection?: 'required' | 'best-effort';
}): Promise<z.infer<typeof workspaceUpdateMemorySpaceTitleResponseSchema>> {
  const updated = await renameWorkspaceRootFromFileTruth({
    rootPath: canonicalRoot,
    workspaceId,
    title,
    assertWorkspaceUsable,
    relocateWorkspaceRoot,
  });
  if (!updated.ok) {
    return updated;
  }

  try {
    if (registryProjection === 'best-effort') {
      await memorySpaceRegistry.upsertMemorySpace({
        canonicalRoot: updated.canonicalRoot,
        snapshot: updated.snapshot,
      });
    } else {
      await memorySpaceRegistry.updateMemorySpaceSnapshot({
        canonicalRoot: updated.canonicalRoot,
        snapshot: updated.snapshot,
      });
    }
  } catch {
    if (registryProjection === 'required') {
      return workspaceMemorySpaceRegistryWriteError('file-written-index-stale');
    }
  }

  return workspaceUpdateMemorySpaceTitleResponseSchema.parse({
    ok: true,
    value: updated.snapshot,
  });
}

async function updateRegisteredMemorySpaceTitle({
  request,
  memorySpaceRegistry,
}: {
  readonly request: Extract<
    z.infer<typeof workspaceUpdateMemorySpaceTitleRequestSchema>,
    { readonly workspaceId: string }
  >;
  readonly memorySpaceRegistry: WorkspaceMemorySpaceRegistry;
}): Promise<z.infer<typeof workspaceUpdateMemorySpaceTitleResponseSchema>> {
  let rootPath: string | null;
  try {
    rootPath = await memorySpaceRegistry.resolveMemorySpaceRoot(request.workspaceId);
  } catch (error) {
    return workspaceMemorySpaceRegistryReadError(error);
  }

  if (!rootPath) {
    return workspaceError(
      'ERR_WORKSPACE_MEMORY_SPACE_NOT_FOUND',
      'Memory space registry entry was not found'
    );
  }

  const target = await validateWorkspaceOpenTarget(rootPath);
  if (!target.ok) {
    return target;
  }
  const lock = await acquireWorkspaceLock({ canonicalRoot: target.canonicalRoot });
  if (!lock.ok) {
    return lock;
  }

  const assertWorkspaceUsable = () =>
    lock.lock.isUsable()
      ? { ok: true as const }
      : workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost', 'none-written');

  try {
    return await persistMemorySpaceTitleUpdate({
      canonicalRoot: target.canonicalRoot,
      workspaceId: request.workspaceId,
      title: request.title,
      memorySpaceRegistry,
      assertWorkspaceUsable,
      relocateWorkspaceRoot: (nextCanonicalRoot) => lock.lock.relocate(nextCanonicalRoot),
    });
  } finally {
    if (lock.lock.isHeld()) {
      await lock.lock.release().catch(() => {});
    }
  }
}

async function handleUpdateMemorySpaceTitleCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  handleStore = createWorkspaceHandleStore(),
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
}: HandleUpdateMemorySpaceTitleOptions): Promise<
  z.infer<typeof workspaceUpdateMemorySpaceTitleResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_UPDATE_MEMORY_SPACE_TITLE_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceUpdateMemorySpaceTitleRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'updateMemorySpaceTitle request is invalid'
    );
  }

  if ('workspaceHandle' in request.data) {
    return withWorkspaceHandleRequest({
      event,
      input,
      channel: WORKSPACE_UPDATE_MEMORY_SPACE_TITLE_CHANNEL,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      schema: workspaceUpdateActiveMemorySpaceTitleRequestSchema,
      invalidMessage: 'updateMemorySpaceTitle request is invalid',
      run: (activeRequest, handle, assertUsable, trustedSender) =>
        withUsableWorkspaceHandle(assertUsable, () =>
          isSystemDraftWorkspaceId(handle.workspaceId)
            ? protectedSystemEntityError('System Draft workspace cannot be renamed')
            : persistMemorySpaceTitleUpdate({
                canonicalRoot: handle.canonicalRoot,
                workspaceId: handle.workspaceId,
                title: activeRequest.title,
                memorySpaceRegistry,
                assertWorkspaceUsable: assertUsable,
                relocateWorkspaceRoot: (nextCanonicalRoot) =>
                  handleStore.relocateHandleRoot({
                    workspaceHandle: activeRequest.workspaceHandle,
                    sender: trustedSender,
                    workspaceId: handle.workspaceId,
                    canonicalRoot: nextCanonicalRoot,
                  }),
                registryProjection: 'best-effort',
              })
        ),
    });
  }

  if (isSystemDraftWorkspaceId(request.data.workspaceId)) {
    return protectedSystemEntityError('System Draft workspace cannot be renamed');
  }

  return updateRegisteredMemorySpaceTitle({
    request: request.data,
    memorySpaceRegistry,
  });
}

export async function handleUpdateMemorySpaceTitle(
  options: HandleUpdateMemorySpaceTitleOptions
): Promise<z.infer<typeof workspaceUpdateMemorySpaceTitleResponseSchema>> {
  return handleUpdateMemorySpaceTitleCore(options);
}

export async function handleUpdateMemorySpaceTitleForTest(
  options: HandleUpdateMemorySpaceTitleOptions
): Promise<z.infer<typeof workspaceUpdateMemorySpaceTitleResponseSchema>> {
  return handleUpdateMemorySpaceTitleCore(options);
}

export async function closeAllWorkspaceHandles(): Promise<void> {
  clearAllMicrophoneIntents();
  defaultRecordingTranscriptionSessions.closeAll();
  await defaultWorkspaceFileTruthWatcherRegistry.closeAll();
  await defaultHandleStore.closeAllHandles();
  clearRecordingRuntimeState();
}

export function resolveActiveWorkspaceRootForProtocol(workspaceId: string):
  | {
      readonly ok: true;
      readonly canonicalRoot: string;
    }
  | WorkspaceErrorEnvelope {
  return defaultHandleStore.resolveActiveRoot({ workspaceId });
}

export async function resolveWorkspaceCoverRootForProtocol(
  workspaceId: string
): Promise<WorkspaceCoverRootResolution> {
  const activeRoot = defaultHandleStore.resolveActiveRoot({ workspaceId });
  if (activeRoot.ok) {
    return activeRoot;
  }

  const cached = workspaceCoverRootCache.get(workspaceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.resolution;
  }

  const inFlight = workspaceCoverRootInFlight.get(workspaceId);
  if (inFlight) {
    return inFlight;
  }

  const resolutionPromise = resolveInactiveWorkspaceCoverRootForProtocol(workspaceId)
    .then((resolution) => {
      workspaceCoverRootCache.set(workspaceId, {
        expiresAt: Date.now() + COVER_ROOT_CACHE_TTL_MS,
        resolution,
      });
      return resolution;
    })
    .finally(() => {
      workspaceCoverRootInFlight.delete(workspaceId);
    });
  workspaceCoverRootInFlight.set(workspaceId, resolutionPromise);
  return resolutionPromise;
}

async function resolveInactiveWorkspaceCoverRootForProtocol(
  workspaceId: string
): Promise<WorkspaceCoverRootResolution> {
  if (isSystemDraftWorkspaceId(workspaceId)) {
    const appDataDir = defaultAppDataDir();
    if (typeof appDataDir !== 'string') {
      return appDataDir;
    }
    return resolveSystemDraftWorkspaceRootForRead(appDataDir);
  }

  const resolved = await resolveMemorySpacePaths(workspaceId, {
    registry: getDefaultMemorySpaceRegistry(),
  });
  if (resolved.ok) {
    return { ok: true, canonicalRoot: resolved.value.rootAbsolute };
  }
  if (resolved.code === 'ERR_WORKSPACE_ROOT_MISSING') {
    return workspaceError(
      'ERR_WORKSPACE_MEMORY_SPACE_NOT_FOUND',
      'Memory space was not found',
      'none-written'
    );
  }
  if (
    resolved.code === 'ERR_WORKSPACE_METADATA_INVALID' ||
    resolved.code === 'ERR_WORKSPACE_UNSAFE_PATH'
  ) {
    return workspaceError(resolved.code, 'Memory space root is unavailable', 'none-written');
  }
  return workspaceError(
    'ERR_WORKSPACE_ROOT_MISSING',
    'Memory space root is unavailable',
    'none-written'
  );
}

function createWorkspaceId(): string {
  return `ws_${randomUUID()}`;
}

function createSegmentId(): string {
  return createTimestampedEntityId('seg');
}

function createSupplementId(): string {
  return createTimestampedEntityId('sup');
}

function createMemoryId(): string {
  return createTimestampedEntityId('mem');
}

function createTimestampedEntityId(prefix: 'mem' | 'seg' | 'sup'): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `${prefix}_${timestamp}_${randomUUID().slice(0, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getDefaultMemorySpaceRegistry(): WorkspaceMemorySpaceRegistry {
  const userDataPath =
    app?.getPath('userData') ??
    path.join(process.cwd(), '.tmp', 'workspace-registry', `${process.pid}`);
  defaultMemorySpaceRegistry ??= createWorkspaceMemorySpaceRegistry({
    registryPath: path.join(userDataPath, 'workspace-registry.json'),
  });
  return defaultMemorySpaceRegistry;
}

function defaultAppDataDir(): string | WorkspaceErrorEnvelope {
  const userDataPath = app?.getPath('userData');
  if (!userDataPath) {
    return workspaceError(
      'ERR_WORKSPACE_INIT_FAILED',
      'System Draft app data directory is unavailable',
      'none-written'
    );
  }
  return userDataPath;
}

function systemDraftProjection() {
  return {
    workspaceId: SYSTEM_DRAFT_WORKSPACE_ID,
    title: SYSTEM_DRAFT_TITLE,
    systemRole: SYSTEM_DRAFT_WORKSPACE_ROLE,
    defaultMemoryId: SYSTEM_DRAFT_DEFAULT_MEMORY_ID,
    capabilities: {
      canRename: false,
      canRemove: false,
      canCreateMemory: true,
    },
  } as const;
}

function annotateSystemDraftSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  if (!isSystemDraftWorkspaceId(snapshot.workspaceId)) {
    return snapshot;
  }
  return {
    ...snapshot,
    memories: snapshot.memories.map((memory) =>
      isSystemDraftDefaultMemoryId(memory.memoryId)
        ? {
            ...memory,
            systemRole: SYSTEM_DRAFT_DEFAULT_MEMORY_ROLE,
            capabilities: {
              canRename: false,
              canDelete: false,
            },
          }
        : memory
    ),
  };
}

function protectedSystemEntityError(message: string): WorkspaceErrorEnvelope {
  return workspaceError('ERR_WORKSPACE_PROTECTED_ENTITY', message, 'none-written');
}

function workspaceMemorySpaceRegistryReadError(error: unknown): WorkspaceErrorEnvelope {
  const message =
    error instanceof WorkspaceMemorySpaceRegistryReadError
      ? error.message
      : 'Workspace memory space registry could not be read';
  return workspaceError('ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_READ_FAILED', message, 'unknown');
}

function workspaceMemorySpaceRegistryWriteError(
  dataRetention: NonNullable<WorkspaceErrorEnvelope['error']['dataRetention']> = 'unknown'
): WorkspaceErrorEnvelope {
  return workspaceError(
    'ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_WRITE_FAILED',
    'Workspace memory space registry could not be written',
    dataRetention
  );
}

function senderKeyFor(sender: TrustedSenderIdentity): string {
  return `${sender.sessionKey}:${sender.processId}:${sender.frameRoutingId}:${sender.origin}`;
}

function sendWorkspaceRendererEvent({
  channel,
  event,
  payload,
  schema,
}: {
  readonly channel: string;
  readonly event: TrustedSenderEventAdapter;
  readonly payload: unknown;
  readonly schema: { parse: (payload: unknown) => unknown };
}): void {
  const sender = event.sender as {
    readonly isDestroyed?: () => boolean;
    readonly send?: (channel: string, payload: unknown) => void;
  };
  if (typeof sender.isDestroyed === 'function' && sender.isDestroyed()) {
    return;
  }
  if (typeof sender.send !== 'function') {
    return;
  }
  const parsedPayload = schema.parse(payload);
  try {
    sender.send(channel, parsedPayload);
  } catch (sendError) {
    if (typeof sender.isDestroyed === 'function' && sender.isDestroyed()) {
      return;
    }
    throw sendError;
  }
}

function sendRecordingTranscriptionEvent(
  event: TrustedSenderEventAdapter,
  payload: z.infer<typeof workspaceRecordingTranscriptionEventSchema>
): void {
  sendWorkspaceRendererEvent({
    channel: WORKSPACE_RECORDING_TRANSCRIPTION_EVENT_CHANNEL,
    event,
    payload,
    schema: workspaceRecordingTranscriptionEventSchema,
  });
}

function sendFileTruthChangedEvent(
  event: TrustedSenderEventAdapter,
  payload: z.infer<typeof workspaceFileTruthChangedEventSchema>
): void {
  sendWorkspaceRendererEvent({
    channel: WORKSPACE_FILE_TRUTH_CHANGED_EVENT_CHANNEL,
    event,
    payload,
    schema: workspaceFileTruthChangedEventSchema,
  });
}

export function sendRecordingTranscriptionEventForTest(
  event: TrustedSenderEventAdapter,
  payload: z.infer<typeof workspaceRecordingTranscriptionEventSchema>
): void {
  sendRecordingTranscriptionEvent(event, payload);
}

export function sendFileTruthChangedEventForTest(
  event: TrustedSenderEventAdapter,
  payload: z.infer<typeof workspaceFileTruthChangedEventSchema>
): void {
  sendFileTruthChangedEvent(event, payload);
}

async function releaseWorkspaceLockAfterFailure(
  lock: Awaited<ReturnType<typeof acquireWorkspaceLock>>
): Promise<void> {
  if (lock.ok && lock.lock.isHeld()) {
    await lock.lock.release().catch(() => {});
  }
}

async function releaseWorkspaceRegistrationAfterFailure({
  lock,
  store,
  registered,
  sender,
}: {
  readonly lock: AcquiredWorkspaceLock;
  readonly store: WorkspaceHandleStore;
  readonly registered: ReturnType<WorkspaceHandleStore['register']> | undefined;
  readonly sender: TrustedSenderIdentity;
}): Promise<void> {
  if (registered) {
    const closed = await store
      .closeHandle({
        workspaceHandle: registered.workspaceHandle,
        sender,
      })
      .catch(() => null);

    if (closed?.ok) {
      return;
    }
  }

  await releaseWorkspaceLockAfterFailure(lock);
}

async function persistAndRegisterWorkspaceSession({
  canonicalRoot,
  snapshot,
  trustedSender,
  lock,
  handleStore,
  createHandle,
  memorySpaceRegistry,
  failureCode,
  failureMessage,
}: {
  readonly canonicalRoot: string;
  readonly snapshot: WorkspaceSnapshot;
  readonly trustedSender: TrustedSenderIdentity;
  readonly lock: AcquiredWorkspaceLock;
  readonly handleStore: WorkspaceHandleStore;
  readonly createHandle?: (() => string) | undefined;
  readonly memorySpaceRegistry: WorkspaceMemorySpaceRegistry;
  readonly failureCode: 'ERR_WORKSPACE_INIT_FAILED' | 'ERR_WORKSPACE_OPEN_FAILED';
  readonly failureMessage: string;
}): Promise<WorkspaceInitializeResponse> {
  try {
    await memorySpaceRegistry.upsertMemorySpace({ canonicalRoot, snapshot });
  } catch {
    await releaseWorkspaceLockAfterFailure(lock);
    return workspaceError(
      'ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_WRITE_FAILED',
      'Workspace memory space registry could not be updated',
      'previous-file-preserved'
    );
  }

  const store =
    createHandle === undefined ? handleStore : createWorkspaceHandleStore({ createHandle });
  let registered: ReturnType<WorkspaceHandleStore['register']> | undefined;
  try {
    registered = store.register({
      canonicalRoot,
      workspaceId: snapshot.workspaceId,
      sender: trustedSender,
      lock: lock.lock,
    });

    return workspaceInitializeResponseSchema.parse({
      ok: true,
      value: {
        ...registered,
        snapshot,
      },
    });
  } catch {
    await releaseWorkspaceRegistrationAfterFailure({
      lock,
      store,
      registered,
      sender: trustedSender,
    });
    return workspaceError(failureCode, failureMessage, 'unknown');
  }
}

async function initializeWorkspaceRoot({
  canonicalRoot,
  title,
  description,
  trustedSender,
  handleStore,
  createWorkspaceId: createWorkspaceIdOption,
  createHandle,
  now,
  memorySpaceRegistry,
  validateBeforeInitialize,
  afterWorkspaceLockAcquiredForTest,
}: {
  readonly canonicalRoot: string;
  readonly title: string;
  readonly description: string;
  readonly trustedSender: TrustedSenderIdentity;
  readonly handleStore: WorkspaceHandleStore;
  readonly createWorkspaceId: () => string;
  readonly createHandle?: (() => string) | undefined;
  readonly now: () => string;
  readonly memorySpaceRegistry: WorkspaceMemorySpaceRegistry;
  readonly validateBeforeInitialize?: (() => MaybePromise<WorkspaceInitializeTarget>) | undefined;
  readonly afterWorkspaceLockAcquiredForTest?: (() => MaybePromise<void>) | undefined;
}): Promise<WorkspaceInitializeResponse> {
  const lock = await acquireWorkspaceLock({ canonicalRoot });
  if (!lock.ok) {
    return lock;
  }
  await afterWorkspaceLockAcquiredForTest?.();
  if (!lock.lock.isUsable()) {
    await releaseWorkspaceLockAfterFailure(lock);
    return workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost', 'none-written');
  }
  const beforeInitialize = await validateBeforeInitialize?.();
  if (beforeInitialize && !beforeInitialize.ok) {
    const wasHeld = lock.lock.isHeld();
    await releaseWorkspaceLockAfterFailure(lock);
    if (wasHeld && !lock.lock.isHeld()) {
      await removeLockOnlyReoDirectory(canonicalRoot).catch(() => {});
    }
    return beforeInitialize;
  }
  if (!lock.lock.isUsable()) {
    await releaseWorkspaceLockAfterFailure(lock);
    return workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost', 'none-written');
  }

  let initialized: Awaited<ReturnType<typeof initializeWorkspaceFiles>>;
  try {
    initialized = await initializeWorkspaceFiles({
      rootPath: canonicalRoot,
      title,
      description,
      createWorkspaceId: createWorkspaceIdOption,
      now,
      assertWorkspaceUsable: () =>
        lock.lock.isUsable()
          ? { ok: true as const }
          : workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost', 'none-written'),
    });
  } catch {
    await releaseWorkspaceLockAfterFailure(lock);
    return workspaceError(
      'ERR_WORKSPACE_INIT_FAILED',
      'Workspace could not be initialized',
      'unknown'
    );
  }

  if (!initialized.ok) {
    await releaseWorkspaceLockAfterFailure(lock);
    return initialized;
  }

  return persistAndRegisterWorkspaceSession({
    canonicalRoot,
    snapshot: initialized.snapshot,
    trustedSender,
    lock,
    handleStore,
    createHandle,
    memorySpaceRegistry,
    failureCode: 'ERR_WORKSPACE_INIT_FAILED',
    failureMessage: 'Workspace could not be initialized',
  });
}

async function handleInitializeWorkspaceCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  tokenStore = createWorkspaceSelectionTokenStore(),
  handleStore = createWorkspaceHandleStore(),
  createWorkspaceId: createWorkspaceIdOption = createWorkspaceId,
  createHandle,
  now = nowIso,
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
  afterWorkspaceLockAcquiredForTest,
}: HandleInitializeWorkspaceForTestOptions): Promise<WorkspaceInitializeResponse> {
  const trusted = validateTrustedWorkspaceSender({
    event,
    channel: WORKSPACE_INITIALIZE_CHANNEL,
    allowedChannels: new Set(WORKSPACE_IPC_CHANNELS),
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });

  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceInitializeRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'initializeWorkspace request is invalid'
    );
  }

  const consumed = tokenStore.consumeSelection({
    selectionToken: request.data.selectionToken,
    sender: trusted.sender,
  });
  if (!consumed.ok) {
    return consumed;
  }

  const target = await createWorkspaceInitializeTargetInParent(
    consumed.rootPath,
    request.data.title
  );
  if (!target.ok) {
    return target;
  }

  return initializeWorkspaceRoot({
    canonicalRoot: target.canonicalRoot,
    title: request.data.title,
    description: request.data.description,
    trustedSender: trusted.sender,
    handleStore,
    createWorkspaceId: createWorkspaceIdOption,
    createHandle,
    memorySpaceRegistry,
    now,
    afterWorkspaceLockAcquiredForTest,
  });
}

export async function handleInitializeWorkspace(
  options: HandleInitializeWorkspaceOptions
): Promise<WorkspaceInitializeResponse> {
  return handleInitializeWorkspaceCore(options);
}

export async function handleInitializeWorkspaceForTest(
  options: HandleInitializeWorkspaceForTestOptions
): Promise<WorkspaceInitializeResponse> {
  return handleInitializeWorkspaceCore(options);
}

function validateWorkspaceSender({
  event,
  channel,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
}: {
  readonly event: TrustedSenderEventAdapter;
  readonly channel: string;
  readonly expectedSession: object;
  readonly expectedSessionKey: string;
  readonly isTrustedUrl: (url: string) => boolean;
}): TrustedResult {
  return validateTrustedWorkspaceSender({
    event,
    channel,
    allowedChannels: new Set(WORKSPACE_IPC_CHANNELS),
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
}

function safeVoiceValidationMessage(code: VoiceTranscriptionProbeResult['code']): string {
  if (code === 'auth') {
    return 'X-Api-Key 验证失败。';
  }
  if (code === 'network') {
    return '暂时无法连接语音识别服务。';
  }
  return 'X-Api-Key 验证通过。';
}

function voiceSettingsWriteFailedError(
  dataRetention: NonNullable<WorkspaceErrorEnvelope['error']['dataRetention']> = 'none-written'
) {
  return workspaceError(
    'ERR_VOICE_SETTINGS_WRITE_FAILED',
    '语音设置无法写入本地配置。',
    dataRetention
  );
}

async function runVoiceSettingsProbe(apiKey: string, probe: VoiceTranscriptionProbe) {
  try {
    return await probe(apiKey);
  } catch {
    return {
      code: 'network',
      message: safeVoiceValidationMessage('network'),
      ok: false,
    } as const;
  }
}

async function recordVoiceSettingsValidation(
  store: VoiceSettingsStore,
  apiKey: string,
  code: VoiceTranscriptionProbeResult['code'],
  dataRetention: NonNullable<WorkspaceErrorEnvelope['error']['dataRetention']>
) {
  try {
    return {
      ok: true as const,
      validationApplied: await store.recordTranscriptionValidation({ apiKey, code }),
    };
  } catch {
    return {
      ok: false as const,
      error: voiceSettingsWriteFailedError(dataRetention),
    };
  }
}

async function recordVoiceSpeechSynthesisSettingsValidation(
  store: VoiceSettingsStore,
  apiKey: string,
  code: VoiceSpeechSynthesisProbeResult['code'],
  dataRetention: NonNullable<WorkspaceErrorEnvelope['error']['dataRetention']>
) {
  try {
    return {
      ok: true as const,
      validationApplied: await store.recordSpeechSynthesisValidation({ apiKey, code }),
    };
  } catch {
    return {
      ok: false as const,
      error: voiceSettingsWriteFailedError(dataRetention),
    };
  }
}

async function probeAndPersistVoiceValidation({
  apiKey,
  dataRetention,
  probe,
  store,
}: {
  readonly apiKey: string;
  readonly dataRetention: NonNullable<WorkspaceErrorEnvelope['error']['dataRetention']>;
  readonly probe: VoiceTranscriptionProbe;
  readonly store: VoiceSettingsStore;
}) {
  const result = await runVoiceSettingsProbe(apiKey, probe);
  const persisted = await recordVoiceSettingsValidation(store, apiKey, result.code, dataRetention);
  if (!persisted.ok) {
    return { ok: false as const, error: persisted.error };
  }
  return { ok: true as const, result, validationApplied: persisted.validationApplied };
}

async function probeAndPersistVoiceSpeechSynthesisValidation({
  apiKey,
  dataRetention,
  probe,
  store,
}: {
  readonly apiKey: string;
  readonly dataRetention: NonNullable<WorkspaceErrorEnvelope['error']['dataRetention']>;
  readonly probe: VoiceSpeechSynthesisProbe;
  readonly store: VoiceSettingsStore;
}) {
  const result = await probe({ apiKey, speaker: store.read().speechSynthesisSpeaker });
  const persisted = await recordVoiceSpeechSynthesisSettingsValidation(
    store,
    apiKey,
    result.code,
    dataRetention
  );
  if (!persisted.ok) {
    return { ok: false as const, error: persisted.error };
  }
  return { ok: true as const, result, validationApplied: persisted.validationApplied };
}

function hasExplicitPort(rawUrl: string): boolean {
  const schemeIndex = rawUrl.indexOf('://');
  if (schemeIndex < 0) {
    return false;
  }
  const authority = rawUrl.slice(schemeIndex + 3).split(/[/?#]/, 1)[0] ?? '';
  const hostPort = authority.slice(authority.lastIndexOf('@') + 1);
  if (hostPort.startsWith('[')) {
    const end = hostPort.indexOf(']');
    return end >= 0 && hostPort.slice(end + 1).startsWith(':');
  }
  return /:\d*$/.test(hostPort);
}

const VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_URL = 'https://console.volcengine.com/';

function isAllowedVolcengineExternalUrl(
  rawUrl: string
): { readonly ok: true; readonly url: URL } | { readonly ok: false } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false };
  }

  const hostname = url.hostname.toLowerCase();
  const isAllowedHost = hostname === 'volcengine.com' || hostname.endsWith('.volcengine.com');
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    hasExplicitPort(rawUrl) ||
    !isAllowedHost
  ) {
    return { ok: false };
  }
  return { ok: true, url };
}

function isAllowedMarkdownExternalLinkUrl(
  rawUrl: string
): { readonly ok: true; readonly url: URL } | { readonly ok: false } {
  const url = parseReoMarkdownExternalLinkHref(rawUrl);
  if (!url) {
    return { ok: false };
  }
  return { ok: true, url };
}

function runDefaultVoiceTranscriptionProbe(apiKey: string): Promise<VoiceTranscriptionProbeResult> {
  return runVoiceTranscriptionProbe({ apiKey });
}

function runDefaultVoiceSpeechSynthesisProbe({
  apiKey,
  speaker,
}: {
  readonly apiKey: string;
  readonly speaker: ReturnType<VoiceSettingsStore['read']>['speechSynthesisSpeaker'];
}): Promise<VoiceSpeechSynthesisProbeResult> {
  return runVoiceSpeechSynthesisProbe({ apiKey, speaker });
}

async function openSystemExternalUrl(url: string): Promise<void> {
  await requireElectronShellApi().shell.openExternal(url);
}

function normalizeAppPermissionStatus(status: unknown): AppPermissionStatus {
  const parsed = appPermissionStatusSchema.safeParse(status);
  return parsed.success ? parsed.data : 'unknown';
}

function readDefaultAppMediaAccessStatus(mediaType: AppPermissionMediaType): AppPermissionStatus {
  try {
    return normalizeAppPermissionStatus(
      requireElectronSystemPreferencesApi().systemPreferences.getMediaAccessStatus(mediaType)
    );
  } catch {
    return 'unknown';
  }
}

async function askDefaultAppMediaAccess(mediaType: AppPermissionMediaType): Promise<boolean> {
  return requireElectronSystemPreferencesApi().systemPreferences.askForMediaAccess(mediaType);
}

function readDefaultAppAccessibilityPermissionStatus(): boolean {
  try {
    return requireElectronSystemPreferencesApi().systemPreferences.isTrustedAccessibilityClient(
      false
    );
  } catch {
    return false;
  }
}

function requestDefaultAppAccessibilityPermission(): boolean {
  try {
    return requireElectronSystemPreferencesApi().systemPreferences.isTrustedAccessibilityClient(
      true
    );
  } catch {
    return false;
  }
}

function accessibilityPermissionStatusFromTrusted(trusted: boolean): AppPermissionStatus {
  return trusted ? 'granted' : 'not-determined';
}

async function handleReadAppPermissionStatusCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  getMediaAccessStatus = readDefaultAppMediaAccessStatus,
  getAccessibilityPermissionStatus = readDefaultAppAccessibilityPermissionStatus,
}: HandleReadAppPermissionStatusOptions): Promise<
  z.infer<typeof workspaceReadAppPermissionStatusResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_READ_APP_PERMISSION_STATUS_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceReadAppPermissionStatusRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'readAppPermissionStatus request is invalid',
      'none-written'
    );
  }

  return workspaceReadAppPermissionStatusResponseSchema.parse({
    ok: true,
    value: {
      permissions: {
        microphone: { status: getMediaAccessStatus('microphone') },
        camera: { status: getMediaAccessStatus('camera') },
        accessibility: {
          status: accessibilityPermissionStatusFromTrusted(getAccessibilityPermissionStatus()),
        },
      },
    },
  });
}

async function handleRequestAppPermissionCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  askForMediaAccess = askDefaultAppMediaAccess,
  getMediaAccessStatus = readDefaultAppMediaAccessStatus,
  getAccessibilityPermissionStatus = readDefaultAppAccessibilityPermissionStatus,
  requestAccessibilityPermission = requestDefaultAppAccessibilityPermission,
}: HandleRequestAppPermissionOptions): Promise<
  z.infer<typeof workspaceRequestAppPermissionResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_REQUEST_APP_PERMISSION_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceRequestAppPermissionRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'requestAppPermission request is invalid',
      'none-written'
    );
  }

  if (request.data.permission === 'accessibility') {
    try {
      requestAccessibilityPermission();
    } catch {
      // The bounded response below reports a pending status instead of leaking platform errors.
    }

    const status = accessibilityPermissionStatusFromTrusted(getAccessibilityPermissionStatus());

    return workspaceRequestAppPermissionResponseSchema.parse({
      ok: true,
      value: {
        permission: request.data.permission,
        restartRequired: status !== 'granted',
        status,
      },
    });
  }

  let grantedByPrompt: boolean;
  try {
    grantedByPrompt = await askForMediaAccess(request.data.permission);
  } catch {
    grantedByPrompt = false;
  }

  const status = getMediaAccessStatus(request.data.permission);

  return workspaceRequestAppPermissionResponseSchema.parse({
    ok: true,
    value: {
      permission: request.data.permission,
      restartRequired: grantedByPrompt && status !== 'granted',
      status,
    },
  });
}

async function handleReadVoiceTranscriptionSettingsCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  store,
}: HandleVoiceSettingsRequestOptions): Promise<
  z.infer<typeof workspaceReadVoiceTranscriptionSettingsResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_READ_VOICE_TRANSCRIPTION_SETTINGS_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceReadVoiceTranscriptionSettingsRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'readVoiceTranscriptionSettings request is invalid',
      'none-written'
    );
  }

  return workspaceReadVoiceTranscriptionSettingsResponseSchema.parse({
    ok: true,
    value: { settings: store.read() },
  });
}

async function handleSetVoiceTranscriptionEnabledCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  store,
}: HandleVoiceSettingsRequestOptions): Promise<
  z.infer<typeof workspaceSetVoiceTranscriptionEnabledResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceSetVoiceTranscriptionEnabledRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'setVoiceTranscriptionEnabled request is invalid',
      'none-written'
    );
  }

  try {
    await store.setEnabled(request.data.enabled);
  } catch {
    return workspaceError(
      'ERR_VOICE_SETTINGS_WRITE_FAILED',
      '语音设置无法写入本地配置。',
      'none-written'
    );
  }

  return workspaceSetVoiceTranscriptionEnabledResponseSchema.parse({
    ok: true,
    value: { settings: store.read() },
  });
}

async function handleSetVoiceSpeechSynthesisSpeakerCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  speechSynthesisProbe = runDefaultVoiceSpeechSynthesisProbe,
  store,
}: HandleSetVoiceSpeechSynthesisSpeakerOptions): Promise<
  z.infer<typeof workspaceSetVoiceSpeechSynthesisSpeakerResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_SET_VOICE_SPEECH_SYNTHESIS_SPEAKER_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceSetVoiceSpeechSynthesisSpeakerRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'setVoiceSpeechSynthesisSpeaker request is invalid',
      'none-written'
    );
  }

  try {
    await store.setSpeechSynthesisSpeaker(request.data.speaker);
  } catch {
    return workspaceError(
      'ERR_VOICE_SETTINGS_WRITE_FAILED',
      '语音设置无法写入本地配置。',
      'none-written'
    );
  }

  const settings = store.read();
  const apiKey = store.readDecryptedApiKey();
  if (settings.enabled && settings.apiKeyConfigured && apiKey) {
    const validation = await probeAndPersistVoiceSpeechSynthesisValidation({
      apiKey,
      dataRetention: 'file-written-index-stale',
      probe: speechSynthesisProbe,
      store,
    });
    if (!validation.ok) {
      return validation.error;
    }
  }

  return workspaceSetVoiceSpeechSynthesisSpeakerResponseSchema.parse({
    ok: true,
    value: { settings: store.read() },
  });
}

async function handleSaveVoiceTranscriptionApiKeyCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  store,
  probe,
  speechSynthesisProbe = async () => ({ code: 'ok', ok: true }),
}: HandleSaveVoiceTranscriptionApiKeyOptions): Promise<
  z.infer<typeof workspaceSaveVoiceTranscriptionApiKeyResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceSaveVoiceTranscriptionApiKeyRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'saveVoiceTranscriptionApiKey request is invalid',
      'none-written'
    );
  }

  const apiKey = request.data.apiKey.trim();
  try {
    await store.writeApiKey(apiKey);
  } catch (error) {
    const code =
      error instanceof Error && error.message === 'safeStorage unavailable'
        ? 'ERR_VOICE_SETTINGS_STORAGE_UNAVAILABLE'
        : 'ERR_VOICE_SETTINGS_WRITE_FAILED';
    return workspaceError(code, '语音设置无法写入本地配置。', 'none-written');
  }

  const validation = await probeAndPersistVoiceValidation({
    apiKey,
    dataRetention: 'file-written-index-stale',
    probe,
    store,
  });
  if (!validation.ok) {
    return validation.error;
  }
  const speechSynthesisValidation = await probeAndPersistVoiceSpeechSynthesisValidation({
    apiKey,
    dataRetention: 'file-written-index-stale',
    probe: speechSynthesisProbe,
    store,
  });
  if (!speechSynthesisValidation.ok) {
    return speechSynthesisValidation.error;
  }
  return workspaceSaveVoiceTranscriptionApiKeyResponseSchema.parse({
    ok: true,
    value: { settings: store.read() },
  });
}

async function handleClearVoiceTranscriptionApiKeyCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  store,
}: HandleVoiceSettingsRequestOptions): Promise<
  z.infer<typeof workspaceClearVoiceTranscriptionApiKeyResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_CLEAR_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceClearVoiceTranscriptionApiKeyRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'clearVoiceTranscriptionApiKey request is invalid',
      'none-written'
    );
  }

  try {
    await store.clearApiKey();
  } catch {
    return workspaceError(
      'ERR_VOICE_SETTINGS_WRITE_FAILED',
      '语音设置无法写入本地配置。',
      'none-written'
    );
  }

  return workspaceClearVoiceTranscriptionApiKeyResponseSchema.parse({
    ok: true,
    value: { settings: store.read() },
  });
}

async function handleValidateVoiceTranscriptionCredentialsCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  store,
  probe,
  speechSynthesisProbe = async () => ({ code: 'ok', ok: true }),
}: HandleValidateVoiceTranscriptionCredentialsOptions): Promise<
  z.infer<typeof workspaceValidateVoiceTranscriptionCredentialsResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_VALIDATE_VOICE_TRANSCRIPTION_CREDENTIALS_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceValidateVoiceTranscriptionCredentialsRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'validateVoiceTranscriptionCredentials request is invalid',
      'none-written'
    );
  }

  const apiKey = store.readDecryptedApiKey();
  if (!apiKey) {
    return workspaceError(
      'ERR_VOICE_TRANSCRIPTION_PROBE_FAILED',
      '请先填写或重新保存 X-Api-Key。',
      'none-written'
    );
  }

  const validation = await probeAndPersistVoiceValidation({
    apiKey,
    dataRetention: 'previous-file-preserved',
    probe,
    store,
  });
  if (!validation.ok) {
    return validation.error;
  }
  if (!validation.validationApplied) {
    return workspaceError(
      'ERR_VOICE_TRANSCRIPTION_PROBE_FAILED',
      'X-Api-Key 已变更，请重新验证。',
      'previous-file-preserved'
    );
  }
  const speechSynthesisValidation = await probeAndPersistVoiceSpeechSynthesisValidation({
    apiKey,
    dataRetention: 'previous-file-preserved',
    probe: speechSynthesisProbe,
    store,
  });
  if (!speechSynthesisValidation.ok) {
    return speechSynthesisValidation.error;
  }
  return workspaceValidateVoiceTranscriptionCredentialsResponseSchema.parse({
    ok: true,
    value: {
      code: validation.result.code,
      ...(validation.result.code === 'ok'
        ? {}
        : { message: safeVoiceValidationMessage(validation.result.code) }),
    },
  });
}

async function handleOpenVoiceTranscriptionProviderConsoleCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  openExternal = openSystemExternalUrl,
}: HandleOpenVoiceTranscriptionProviderConsoleOptions): Promise<
  z.infer<typeof workspaceOpenVoiceTranscriptionProviderConsoleResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_OPEN_VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceOpenVoiceTranscriptionProviderConsoleRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'openVoiceTranscriptionProviderConsole request is invalid',
      'none-written'
    );
  }

  const allowed = isAllowedVolcengineExternalUrl(VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_URL);
  if (!allowed.ok) {
    return workspaceError(
      'ERR_VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_REJECTED',
      '不允许打开该外部链接。',
      'none-written'
    );
  }

  try {
    await openExternal(allowed.url.toString());
    return workspaceOpenVoiceTranscriptionProviderConsoleResponseSchema.parse({
      ok: true,
      value: {},
    });
  } catch {
    return workspaceError(
      'ERR_VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_REJECTED',
      '外部链接无法打开。',
      'none-written'
    );
  }
}

async function handleOpenMarkdownExternalLinkCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  openExternal = openSystemExternalUrl,
}: HandleOpenMarkdownExternalLinkOptions): Promise<
  z.infer<typeof workspaceOpenMarkdownExternalLinkResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_OPEN_MARKDOWN_EXTERNAL_LINK_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceOpenMarkdownExternalLinkRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'openMarkdownExternalLink request is invalid',
      'none-written'
    );
  }

  const allowed = isAllowedMarkdownExternalLinkUrl(request.data.url);
  if (!allowed.ok) {
    return workspaceError(
      'ERR_MARKDOWN_EXTERNAL_LINK_REJECTED',
      '不允许打开该外部链接。',
      'none-written'
    );
  }

  try {
    await openExternal(allowed.url.toString());
    return workspaceOpenMarkdownExternalLinkResponseSchema.parse({
      ok: true,
      value: {},
    });
  } catch {
    return workspaceError(
      'ERR_MARKDOWN_EXTERNAL_LINK_REJECTED',
      '外部链接无法打开。',
      'none-written'
    );
  }
}

export async function handleReadVoiceTranscriptionSettingsForTest(
  options: HandleVoiceSettingsRequestOptions
): Promise<z.infer<typeof workspaceReadVoiceTranscriptionSettingsResponseSchema>> {
  return handleReadVoiceTranscriptionSettingsCore(options);
}

export async function handleReadAppPermissionStatusForTest(
  options: HandleReadAppPermissionStatusOptions
): Promise<z.infer<typeof workspaceReadAppPermissionStatusResponseSchema>> {
  return handleReadAppPermissionStatusCore(options);
}

export async function handleRequestAppPermissionForTest(
  options: HandleRequestAppPermissionOptions
): Promise<z.infer<typeof workspaceRequestAppPermissionResponseSchema>> {
  return handleRequestAppPermissionCore(options);
}

export async function handleSetVoiceTranscriptionEnabledForTest(
  options: HandleVoiceSettingsRequestOptions
): Promise<z.infer<typeof workspaceSetVoiceTranscriptionEnabledResponseSchema>> {
  return handleSetVoiceTranscriptionEnabledCore(options);
}

export async function handleSetVoiceSpeechSynthesisSpeakerForTest(
  options: HandleSetVoiceSpeechSynthesisSpeakerOptions
): Promise<z.infer<typeof workspaceSetVoiceSpeechSynthesisSpeakerResponseSchema>> {
  return handleSetVoiceSpeechSynthesisSpeakerCore(options);
}

export async function handleSaveVoiceTranscriptionApiKeyForTest(
  options: HandleSaveVoiceTranscriptionApiKeyOptions
): Promise<z.infer<typeof workspaceSaveVoiceTranscriptionApiKeyResponseSchema>> {
  return handleSaveVoiceTranscriptionApiKeyCore(options);
}

export async function handleClearVoiceTranscriptionApiKeyForTest(
  options: HandleVoiceSettingsRequestOptions
): Promise<z.infer<typeof workspaceClearVoiceTranscriptionApiKeyResponseSchema>> {
  return handleClearVoiceTranscriptionApiKeyCore(options);
}

export async function handleValidateVoiceTranscriptionCredentialsForTest(
  options: HandleValidateVoiceTranscriptionCredentialsOptions
): Promise<z.infer<typeof workspaceValidateVoiceTranscriptionCredentialsResponseSchema>> {
  return handleValidateVoiceTranscriptionCredentialsCore(options);
}

export async function handleOpenVoiceTranscriptionProviderConsoleForTest(
  options: HandleOpenVoiceTranscriptionProviderConsoleOptions
): Promise<z.infer<typeof workspaceOpenVoiceTranscriptionProviderConsoleResponseSchema>> {
  return handleOpenVoiceTranscriptionProviderConsoleCore(options);
}

export async function handleOpenMarkdownExternalLinkForTest(
  options: HandleOpenMarkdownExternalLinkOptions
): Promise<z.infer<typeof workspaceOpenMarkdownExternalLinkResponseSchema>> {
  return handleOpenMarkdownExternalLinkCore(options);
}

type WorkspaceHandleRequestData = {
  readonly workspaceHandle: string;
};

type RequiredWorkspaceHandle = Extract<
  ReturnType<WorkspaceHandleStore['requireHandle']>,
  { readonly ok: true }
>['handle'];
type AssertWorkspaceHandleUsable = RequiredWorkspaceHandle['assertUsable'];

function ipcSenderId(event: TrustedSenderEventAdapter): number | WorkspaceErrorEnvelope {
  return typeof event.sender.id === 'number'
    ? event.sender.id
    : workspaceError('ERR_WORKSPACE_UNTRUSTED_SENDER', 'IPC sender is not trusted');
}

async function withUsableWorkspaceHandle<Result>(
  assertUsable: AssertWorkspaceHandleUsable,
  run: () => MaybePromise<Result | WorkspaceErrorEnvelope>
): Promise<Result | WorkspaceErrorEnvelope> {
  const usable = assertUsable();
  return usable.ok ? await run() : usable;
}

async function withWorkspaceHandleRequest<
  Schema extends z.ZodType<WorkspaceHandleRequestData>,
  Result,
>({
  event,
  input,
  channel,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  handleStore,
  schema,
  invalidMessage,
  requireUsable,
  run,
}: {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly channel: string;
  readonly expectedSession: Session | object;
  readonly expectedSessionKey: string;
  readonly isTrustedUrl: (url: string) => boolean;
  readonly handleStore: WorkspaceHandleStore;
  readonly schema: Schema;
  readonly invalidMessage: string;
  readonly requireUsable?: boolean;
  readonly run: (
    data: z.infer<Schema>,
    handle: RequiredWorkspaceHandle,
    assertUsable: AssertWorkspaceHandleUsable,
    sender: TrustedSenderIdentity
  ) => MaybePromise<Result | WorkspaceErrorEnvelope>;
}): Promise<Result | WorkspaceErrorEnvelope> {
  const trusted = validateWorkspaceSender({
    event,
    channel,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = schema.safeParse(input);
  if (!request.success) {
    return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', invalidMessage);
  }

  const required = (
    requireUsable === false ? handleStore.requireOwnedHandle : handleStore.requireHandle
  )({
    workspaceHandle: request.data.workspaceHandle,
    sender: trusted.sender,
  });
  if (!required.ok) {
    return required;
  }

  return run(
    request.data as z.infer<Schema>,
    required.handle,
    required.handle.assertUsable,
    trusted.sender
  );
}

type WorkspaceEntityHandleRequestData = WorkspaceHandleRequestData & {
  readonly workspaceId: string;
};

type MemorySpaceEntityActionOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
};

type MemorySpaceEntityActionRequestData = {
  readonly workspaceId: string;
};

type EntityDirectoryPaths = {
  readonly directoryAbsolute: string;
};

type EntityDocumentPaths = {
  readonly documentAbsolute: string;
};

type WidgetPaths = EntityDirectoryPaths & EntityDocumentPaths;

type EntityActionMissingPathCode =
  | 'ERR_WORKSPACE_ROOT_MISSING'
  | 'ERR_WORKSPACE_MEMORY_NOT_FOUND'
  | 'ERR_WORKSPACE_SEGMENT_NOT_FOUND'
  | 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND'
  | 'ERR_WORKSPACE_WIDGET_NOT_FOUND'
  | 'ERR_MEMORY_SPACE_AGENT_ENTRY_MISSING'
  | 'ERR_ENTITY_DOCUMENT_MISSING';

const PROMPT_TARGET_MARKDOWN_MAX_BYTES = 1_048_576;

function entityActionFsForResolver<Resolver>(
  fs: FsProbe | undefined,
  resolver: Resolver,
  defaultResolver: Resolver
): FsProbe | undefined {
  return fs ?? (resolver === defaultResolver ? nodeFsProbe : undefined);
}

async function safeDirectoryForAction(
  fs: FsProbe | undefined,
  directoryPath: string
): Promise<'present' | 'missing' | 'unsafe'> {
  if (!fs) {
    return 'present';
  }
  if (fs?.safeDirectory) {
    return fs.safeDirectory(directoryPath);
  }

  return (await fs.exists(directoryPath)) ? 'present' : 'missing';
}

async function safeFileForAction(
  fs: FsProbe | undefined,
  filePath: string
): Promise<'present' | 'missing' | 'unsafe'> {
  if (!fs) {
    return 'present';
  }
  if (fs?.safeFile) {
    return fs.safeFile(filePath);
  }

  return (await fs.exists(filePath)) ? 'present' : 'missing';
}

function entityActionMissingPathError(
  code: EntityActionMissingPathCode,
  message: string
): WorkspaceEntityActionResponse {
  return workspaceError(code, message);
}

function entityActionUnsafePathError(message: string): WorkspaceEntityActionResponse {
  return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', message);
}

async function validateDirectoryBeforeEntityAction({
  fs,
  directoryPath,
  missingCode,
  missingMessage,
  unsafeMessage,
}: {
  readonly fs: FsProbe | undefined;
  readonly directoryPath: string;
  readonly missingCode: EntityActionMissingPathCode;
  readonly missingMessage: string;
  readonly unsafeMessage: string;
}): Promise<WorkspaceEntityActionResponse | null> {
  const state = await safeDirectoryForAction(fs, directoryPath);
  if (state === 'present') {
    return null;
  }

  return state === 'missing'
    ? entityActionMissingPathError(missingCode, missingMessage)
    : entityActionUnsafePathError(unsafeMessage);
}

async function validateFileBeforeEntityAction({
  fs,
  filePath,
  missingCode,
  missingMessage,
  unsafeMessage,
}: {
  readonly fs: FsProbe | undefined;
  readonly filePath: string;
  readonly missingCode: EntityActionMissingPathCode;
  readonly missingMessage: string;
  readonly unsafeMessage: string;
}): Promise<WorkspaceEntityActionResponse | null> {
  const state = await safeFileForAction(fs, filePath);
  if (state === 'present') {
    return null;
  }

  return state === 'missing'
    ? entityActionMissingPathError(missingCode, missingMessage)
    : entityActionUnsafePathError(unsafeMessage);
}

async function handleWorkspaceEntityActionRequest<
  Schema extends z.ZodType<WorkspaceEntityHandleRequestData>,
  Paths,
>({
  options,
  channel,
  schema,
  invalidMessage,
  workspaceMismatchMessage,
  resolveFailureMessage,
  resolve,
  run,
}: {
  readonly options: HandleWorkspaceRequestOptions;
  readonly channel: string;
  readonly schema: Schema;
  readonly invalidMessage: string;
  readonly workspaceMismatchMessage: string;
  readonly resolveFailureMessage: string;
  readonly resolve: (
    request: z.infer<Schema>,
    handle: RequiredWorkspaceHandle
  ) => Promise<ResolverResult<Paths>>;
  readonly run: (
    paths: Paths,
    handle: RequiredWorkspaceHandle
  ) => MaybePromise<WorkspaceEntityActionResponse | WorkspaceErrorEnvelope>;
}): Promise<WorkspaceEntityActionResponse | WorkspaceErrorEnvelope> {
  return withWorkspaceHandleRequest({
    ...options,
    channel,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema,
    invalidMessage,
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            workspaceMismatchMessage
          );
        }

        let resolved: ResolverResult<Paths>;
        try {
          resolved = await resolve(request, handle);
        } catch {
          return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', resolveFailureMessage);
        }
        if (!resolved.ok) {
          return workspaceError(resolved.code, resolveFailureMessage);
        }

        return run(resolved.value, handle);
      }),
  });
}

async function handleMemorySpaceEntityActionRequest<
  Schema extends z.ZodType<MemorySpaceEntityActionRequestData>,
>({
  options: {
    event,
    input,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
    memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
  },
  channel,
  schema,
  invalidMessage,
  resolveFailureMessage,
  resolve,
  run,
}: {
  readonly options: MemorySpaceEntityActionOptions;
  readonly channel: string;
  readonly schema: Schema;
  readonly invalidMessage: string;
  readonly resolveFailureMessage: string;
  readonly resolve: (
    request: z.infer<Schema>,
    memorySpaceRegistry: WorkspaceMemorySpaceRegistry
  ) => Promise<ResolverResult<MemorySpacePaths>>;
  readonly run: (paths: MemorySpacePaths) => MaybePromise<WorkspaceEntityActionResponse>;
}): Promise<WorkspaceEntityActionResponse> {
  const trusted = validateWorkspaceSender({
    event,
    channel,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = schema.safeParse(input);
  if (!request.success) {
    return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', invalidMessage);
  }

  let resolved: ResolverResult<MemorySpacePaths>;
  try {
    resolved = await resolve(request.data, memorySpaceRegistry);
  } catch {
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', resolveFailureMessage);
  }
  if (!resolved.ok) {
    return workspaceError(resolved.code, resolveFailureMessage);
  }

  return run(resolved.value);
}

function workspaceRelativePosixPath(handle: RequiredWorkspaceHandle, absolutePath: string): string {
  return path.relative(handle.canonicalRoot, absolutePath).split(path.sep).join('/');
}

function readPromptTargetMarkdown(documentAbsolute: string): string {
  const directory = path.dirname(documentAbsolute);
  const directoryIdentity = readSafeDirectoryIdentitySync(
    directory,
    'Prompt target directory is not safe'
  );
  const fd = openExistingWorkspaceFileInDirectory({
    directory,
    directoryIdentity,
    fileName: path.basename(documentAbsolute),
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
  try {
    const stats = fstatSync(fd);
    if (!stats.isFile()) {
      throw new Error('Prompt target document is not safe');
    }
    if (stats.size > PROMPT_TARGET_MARKDOWN_MAX_BYTES) {
      throw new Error('Prompt target document is too large');
    }
    const buffer = Buffer.allocUnsafe(stats.size);
    let offset = 0;
    while (offset < stats.size) {
      const bytesRead = readSync(fd, buffer, offset, stats.size - offset, offset);
      if (bytesRead <= 0) {
        throw new Error('Prompt target document changed during read');
      }
      offset += bytesRead;
    }
    assertSameDirectoryIdentitySync(
      directory,
      directoryIdentity,
      'Prompt target directory changed'
    );
    return buffer.toString('utf8');
  } finally {
    closeSync(fd);
  }
}

async function resolveWidgetPaths({
  widgetId,
  handle,
  workspaceId,
}: {
  readonly widgetId: string;
  readonly handle: RequiredWorkspaceHandle;
  readonly workspaceId: string;
}): Promise<ResolverResult<WidgetPaths>> {
  try {
    const directoryAbsolute = await resolveWorkspaceWidgetDirectoryFromFileTruth({
      rootPath: handle.canonicalRoot,
      workspaceId,
      widgetId,
    });
    return {
      ok: true,
      value: {
        directoryAbsolute,
        documentAbsolute: widgetDocumentPath(directoryAbsolute),
      },
    };
  } catch {
    return { ok: false, code: 'ERR_WORKSPACE_WIDGET_NOT_FOUND' };
  }
}

async function resolveArtifactPromptTargetDirectory({
  handle,
  request,
}: {
  readonly handle: RequiredWorkspaceHandle;
  readonly request: WorkspaceCopyArtifactAgentPromptRequest;
}): Promise<{ readonly ok: true; readonly directoryAbsolute: string } | WorkspaceErrorEnvelope> {
  const memoryPaths = await resolveMemoryPaths(handle, request.workspaceId, request.memoryId, {
    fs: nodeFsProbe,
  });
  if (!memoryPaths.ok) {
    return workspaceError(memoryPaths.code, 'Artifact prompt target could not be resolved');
  }
  if (request.action === 'create-segment') {
    return { ok: true, directoryAbsolute: memoryPaths.value.directoryAbsolute };
  }

  const segmentPaths = await resolveSegmentPaths(
    handle,
    request.workspaceId,
    request.memoryId,
    request.segmentId,
    { fs: nodeFsProbe, requireDocument: true }
  );
  if (!segmentPaths.ok) {
    return workspaceError(segmentPaths.code, 'Artifact prompt target could not be resolved');
  }
  if (request.action === 'create-supplement') {
    return { ok: true, directoryAbsolute: segmentPaths.value.directoryAbsolute };
  }
  if (request.action === 'update-segment') {
    const validationError = await requireArtifactPromptTarget({
      directoryAbsolute: segmentPaths.value.directoryAbsolute,
      documentAbsolute: segmentPaths.value.documentAbsolute,
      entryFileName: ARTIFACT_RUNTIME_ENTRY_FILE,
      objectType: 'segment',
    });
    return validationError ?? { ok: true, directoryAbsolute: segmentPaths.value.directoryAbsolute };
  }

  const supplementPaths = await resolveSegmentSupplementPaths(
    handle,
    request.workspaceId,
    request.memoryId,
    request.segmentId,
    request.supplementId,
    { fs: nodeFsProbe, requireDocument: true }
  );
  if (!supplementPaths.ok) {
    return workspaceError(supplementPaths.code, 'Artifact prompt target could not be resolved');
  }

  const validationError = await requireArtifactPromptTarget({
    directoryAbsolute: supplementPaths.value.directoryAbsolute,
    documentAbsolute: supplementPaths.value.documentAbsolute,
    entryFileName: ARTIFACT_RUNTIME_ENTRY_FILE,
    objectType: 'supplement',
  });
  return (
    validationError ?? { ok: true, directoryAbsolute: supplementPaths.value.directoryAbsolute }
  );
}

async function requireArtifactPromptTarget({
  directoryAbsolute,
  documentAbsolute,
  entryFileName,
  objectType,
}: {
  readonly directoryAbsolute: string;
  readonly documentAbsolute: string;
  readonly entryFileName: typeof ARTIFACT_RUNTIME_ENTRY_FILE;
  readonly objectType: 'segment' | 'supplement';
}): Promise<WorkspaceErrorEnvelope | null> {
  let markdown: string;
  try {
    markdown = readPromptTargetMarkdown(documentAbsolute);
  } catch {
    return workspaceError(
      'ERR_ENTITY_DOCUMENT_MISSING',
      'Artifact prompt target could not be resolved'
    );
  }

  try {
    const parsed = parseWorkspaceMarkdownObject({ markdown, objectType });
    const kind = 'kind' in parsed.data ? parsed.data.kind : undefined;
    const format = 'format' in parsed.data ? parsed.data.format : undefined;
    if (kind !== 'artifact' || format !== 'html') {
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'Artifact prompt target is not a work'
      );
    }
  } catch {
    return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'Artifact prompt target is not a work');
  }

  const entryState = await safeFileForAction(
    nodeFsProbe,
    path.join(directoryAbsolute, entryFileName)
  );
  if (entryState === 'present' || entryState === 'missing') {
    return null;
  }
  return workspaceError(
    'ERR_WORKSPACE_UNSAFE_PATH',
    'Artifact prompt target could not be resolved'
  );
}

function artifactPromptIdentityLines(request: WorkspaceCopyArtifactAgentPromptRequest): string[] {
  return [
    `- workspaceId: ${request.workspaceId}`,
    `- memoryId: ${request.memoryId}`,
    ...('segmentId' in request ? [`- segmentId: ${request.segmentId}`] : []),
    ...('supplementId' in request ? [`- supplementId: ${request.supplementId}`] : []),
  ];
}

function buildWorkspaceArtifactAgentPrompt({
  request,
  targetDirectoryRelative,
}: {
  readonly request: WorkspaceCopyArtifactAgentPromptRequest;
  readonly targetDirectoryRelative: string;
}): string {
  const runtimeBundleLine = `- 写入同目录 runtime bundle：\`${ARTIFACT_RUNTIME_ENTRY_FILE}\`、\`${ARTIFACT_RUNTIME_MANIFEST_FILE}\`、\`${ARTIFACT_RUNTIME_STATE_FILE}\` 和 \`${ARTIFACT_RUNTIME_ASSETS_DIRECTORY}/\`。`;
  const common = [
    '请在当前 Reo 记忆空间根目录内工作。先阅读 `.reo/REO.md`，再阅读 `skills/reo-works/SKILL.md`，并按其中指引读取 `skills/reo-works/references/`；作品运行时 bundle、状态和验证先阅读 `skills/reo-generative-runtime/SKILL.md`、`skills/reo-generative-runtime/references/` 和 `skills/reo-generative-runtime/scripts/`；用户未指定风格时默认按 `reo-works-design` 的 Reo 视觉变量和参考模块，涉及视觉、信息布局、交互或数据表达时同时阅读 `skills/reo-works-design/SKILL.md` 及 `skills/reo-works-design/references/`。',
    '',
    '边界：',
    '- 只使用下方 workspace-relative path，不要使用绝对路径。',
    '- 不要编辑根 `AGENTS.md` 或用户自带 skills；Reo 官方同名 skills 会由 Reo 更新。',
    '- 不要编辑 `.reo/index.json`、`.reo/objects/**`、`.reo/review/**`、draft、trash 或 lock 文件。',
    '- 不要调用 Reo IPC，不要创建录音或笔记 draft；直接写普通文件。',
    '- 作品对象 frontmatter 必须包含 `kind: artifact` 和 `format: html`。',
    '- 内联预览先展示有用摘要、主要控件和核心结果，避免用户为了理解作品而长滚动；复杂作品可用 sections、内部滚动、全屏入口或作品补充承载深度，不要锁死单一高度。',
    '- 打卡、待办、进度、偏好和需要下次打开仍记得的用户操作结果必须通过 `window.reo.state` 写入 `state.json`；localStorage/IndexedDB 只能作为快速 UI cache 或兼容缓存，不能作为唯一长期状态。',
    '',
    '目标身份：',
    ...artifactPromptIdentityLines(request),
    '',
  ];

  if (request.action === 'create-segment') {
    return [
      '# 创建一个 Reo 作品片段',
      '',
      ...common,
      '目标 Memory：',
      `- memory directory: \`${targetDirectoryRelative}\``,
      '',
      '创建要求：',
      `- 在 \`${targetDirectoryRelative}/segments/\` 下创建一个新的片段目录，目录名使用新的 \`seg_...\` id 和可读标题。`,
      '- 写入 `segment.md`，frontmatter 至少包含 `id`、`title`、`kind: artifact`、`format: html`。',
      runtimeBundleLine,
      '- 不要先创建空占位；一次性给出可用作品。',
    ].join('\n');
  }

  if (request.action === 'create-supplement') {
    return [
      '# 创建一个 Reo 作品补充',
      '',
      ...common,
      '目标 Segment：',
      `- segment directory: \`${targetDirectoryRelative}\``,
      '',
      '创建要求：',
      `- 在 \`${targetDirectoryRelative}/supplements/\` 下创建一个新的补充目录，目录名使用新的 \`sup_...\` id 和可读标题。`,
      '- 写入 `supplement.md`，frontmatter 至少包含 `id`、`title`、`kind: artifact`、`format: html`。',
      runtimeBundleLine,
      '- 不要先创建空占位；一次性给出可用作品补充。',
    ].join('\n');
  }

  if (request.action === 'update-segment') {
    return [
      '# 更新一个已有 Reo 作品片段',
      '',
      ...common,
      '目标作品片段：',
      `- segment directory: \`${targetDirectoryRelative}\``,
      `- metadata: \`${targetDirectoryRelative}/segment.md\``,
      `- entry: \`${targetDirectoryRelative}/${ARTIFACT_RUNTIME_ENTRY_FILE}\``,
      `- runtime metadata: \`${targetDirectoryRelative}/${ARTIFACT_RUNTIME_MANIFEST_FILE}\``,
      `- state: \`${targetDirectoryRelative}/${ARTIFACT_RUNTIME_STATE_FILE}\``,
      `- assets: \`${targetDirectoryRelative}/${ARTIFACT_RUNTIME_ASSETS_DIRECTORY}/\``,
      '',
      '更新要求：',
      '- 不要创建新的作品对象。',
      '- 保留 `segment.md` 中已有 `id`，继续保持 `kind: artifact` 与 `format: html`。',
      '- 更新 runtime bundle，必要时同步 `segment.md` 的标题或摘要字段。',
    ].join('\n');
  }

  return [
    '# 更新一个已有 Reo 作品补充',
    '',
    ...common,
    '目标作品补充：',
    `- supplement directory: \`${targetDirectoryRelative}\``,
    `- metadata: \`${targetDirectoryRelative}/supplement.md\``,
    `- entry: \`${targetDirectoryRelative}/${ARTIFACT_RUNTIME_ENTRY_FILE}\``,
    `- runtime metadata: \`${targetDirectoryRelative}/${ARTIFACT_RUNTIME_MANIFEST_FILE}\``,
    `- state: \`${targetDirectoryRelative}/${ARTIFACT_RUNTIME_STATE_FILE}\``,
    `- assets: \`${targetDirectoryRelative}/${ARTIFACT_RUNTIME_ASSETS_DIRECTORY}/\``,
    '',
    '更新要求：',
    '- 不要创建新的作品对象。',
    '- 保留 `supplement.md` 中已有 `id`，继续保持 `kind: artifact` 与 `format: html`。',
    '- 更新 runtime bundle，必要时同步 `supplement.md` 的标题或摘要字段。',
  ].join('\n');
}

async function resolveWidgetAgentPromptTarget({
  handle,
  request,
}: {
  readonly handle: RequiredWorkspaceHandle;
  readonly request: WorkspaceCopyWidgetAgentPromptRequest;
}): Promise<
  { readonly ok: true; readonly targetDirectoryRelative: string } | WorkspaceErrorEnvelope
> {
  if (request.action === 'create-widget') {
    return { ok: true, targetDirectoryRelative: 'widgets' };
  }

  const resolved = await resolveWidgetPaths({
    widgetId: request.widgetId,
    handle,
    workspaceId: request.workspaceId,
  });
  if (!resolved.ok) {
    return workspaceError(resolved.code, 'Widget prompt target could not be resolved');
  }

  const validationError = await requireWidgetPromptTarget({
    directoryAbsolute: resolved.value.directoryAbsolute,
  });
  return (
    validationError ?? {
      ok: true,
      targetDirectoryRelative: workspaceRelativePosixPath(handle, resolved.value.directoryAbsolute),
    }
  );
}

async function requireWidgetPromptTarget({
  directoryAbsolute,
}: {
  readonly directoryAbsolute: string;
}): Promise<WorkspaceErrorEnvelope | null> {
  let markdown: string;
  try {
    markdown = await readWorkspaceWidgetMarkdownFromDirectory(directoryAbsolute);
  } catch {
    return workspaceError(
      'ERR_ENTITY_DOCUMENT_MISSING',
      'Widget prompt target could not be resolved'
    );
  }

  try {
    parseWorkspaceMarkdownObject({ markdown, objectType: 'widget' });
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'Widget prompt target is not a workspace rail widget'
    );
  }

  const entryState = await safeFileForAction(
    nodeFsProbe,
    path.join(directoryAbsolute, ARTIFACT_RUNTIME_ENTRY_FILE)
  );
  if (entryState === 'unsafe') {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Widget prompt target could not be resolved'
    );
  }
  return null;
}

function widgetPromptIdentityLines(request: WorkspaceCopyWidgetAgentPromptRequest): string[] {
  return [
    `- workspaceId: ${request.workspaceId}`,
    ...('widgetId' in request ? [`- widgetId: ${request.widgetId}`] : []),
  ];
}

function buildWorkspaceWidgetAgentPrompt({
  request,
  targetDirectoryRelative,
}: {
  readonly request: WorkspaceCopyWidgetAgentPromptRequest;
  readonly targetDirectoryRelative: string;
}): string {
  const runtimeBundleLine = `- 写入同目录 runtime bundle：\`${ARTIFACT_RUNTIME_ENTRY_FILE}\`、\`${ARTIFACT_RUNTIME_MANIFEST_FILE}\`、\`${ARTIFACT_RUNTIME_STATE_FILE}\` 和 \`${ARTIFACT_RUNTIME_ASSETS_DIRECTORY}/\`；可选图标为 \`${ARTIFACT_RUNTIME_ASSETS_DIRECTORY}/icon.svg\`。`;
  const common = [
    '请在当前 Reo 记忆空间根目录内工作。先阅读 `.reo/REO.md`，再阅读 `skills/reo-generative-runtime/SKILL.md`、`skills/reo-generative-runtime/references/` 和 `skills/reo-generative-runtime/scripts/`；涉及视觉、信息布局、交互或数据表达时同时阅读 `skills/reo-works-design/SKILL.md` 及 `skills/reo-works-design/references/`。',
    '',
    '边界：',
    '- 只使用下方 workspace-relative path，不要使用绝对路径。',
    '- 不要编辑根 `AGENTS.md` 或用户自带 skills；Reo 官方同名 skills 会由 Reo 更新。',
    '- 不要编辑 `.reo/index.json`、`.reo/objects/**`、`.reo/review/**`、draft、trash 或 lock 文件。',
    '- 不要调用 Reo IPC，不要创建录音、笔记 draft 或空 Widget 占位；直接写普通文件。',
    '- Widget frontmatter 必须包含 `kind: widget`、`format: html`、`mount: workspace-rail`。',
    '- Widget 必须在 240px 到 520px rail 宽度之间仍然可读、可点、不中断布局；不要把核心信息放到需要长滚动才能看到的位置。',
    '- `entry.html` 通过 `<script src="reo-render://vendor/reo-render/bridge.js"></script>` 加载 Reo bridge。',
    '- 需要下次打开仍保留的 Widget 状态必须通过 `window.reo.state` 写入 `state.json`；localStorage/IndexedDB 只能作为快速 UI cache 或兼容缓存，不能作为唯一长期状态。',
    '- Widget 可以用 `window.reo.workspace.read()` 读取 workspace、当前 widget 和 currentMemory/null hint；如需切换主内容当前记忆，调用 `window.reo.ui.selectMemory({ memoryId })`；如需定位 active 片段或补充，先用 `window.reo.content.readMemoryDetail({ memoryId })` 取得对象，再调用 `window.reo.ui.selectObject({ memoryId, segmentId?, supplementId? })`。',
    '- `workspace.memories` 中每个 Memory 的主键是 `memory.memoryId`，不是 `memory.id`；Memory 列表按钮必须用 `const memoryId = memory.memoryId` 再调用 `window.reo.ui.selectMemory({ memoryId })` 或 `window.reo.ui.selectObject({ memoryId })`。',
    '- 右侧窄 rail 内的文本必须自适应：flex/grid 文本容器设置 `min-width: 0`；单行标题使用 `display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`；长 id、URL 或自由文本使用 `overflow-wrap: anywhere`，不能横向溢出。',
    '',
    '目标身份：',
    ...widgetPromptIdentityLines(request),
    '',
  ];

  if (request.action === 'create-widget') {
    return [
      '# 创建一个 Reo Workspace 侧栏 Widget',
      '',
      ...common,
      '目标目录：',
      `- widgets root: \`${targetDirectoryRelative}\``,
      '',
      '创建要求：',
      '- 在 `widgets/` 下创建一个新的 Widget 目录，目录名使用新的 `wdg_YYYYMMDDHHMMSS_8hex--可读标题`。',
      '- 写入 `widget.md`，frontmatter 至少包含 `id`、`title`、`kind: widget`、`format: html`、`mount: workspace-rail`。',
      runtimeBundleLine,
      '- 默认推荐创建 “Workspace 总览” Widget：统计 memories/segments/supplements/works/widgets/needs-review，提供可点击的 Memory 列表，并用 `window.reo.ui.selectMemory({ memoryId })` 或 `window.reo.ui.selectObject({ memoryId, segmentId?, supplementId? })` 切换主内容当前对象。',
      '- Widget 是右侧 rail 的独立 tab，不要假设自己持久挂载；切 tab、折叠 rail 或切 workspace 后都可能被卸载。',
    ].join('\n');
  }

  return [
    '# 更新一个 Reo Workspace 侧栏 Widget',
    '',
    ...common,
    '目标 Widget：',
    `- widget directory: \`${targetDirectoryRelative}\``,
    `- metadata: \`${targetDirectoryRelative}/widget.md\``,
    `- entry: \`${targetDirectoryRelative}/${ARTIFACT_RUNTIME_ENTRY_FILE}\``,
    `- runtime metadata: \`${targetDirectoryRelative}/${ARTIFACT_RUNTIME_MANIFEST_FILE}\``,
    `- state: \`${targetDirectoryRelative}/${ARTIFACT_RUNTIME_STATE_FILE}\``,
    `- assets: \`${targetDirectoryRelative}/${ARTIFACT_RUNTIME_ASSETS_DIRECTORY}/\``,
    '',
    '更新要求：',
    '- 不要创建新的 Widget 对象。',
    '- 保留 `widget.md` 中已有 `id`，继续保持 `kind: widget`、`format: html`、`mount: workspace-rail`。',
    '- 更新 runtime bundle，必要时同步 `widget.md` 的标题或摘要字段。',
  ].join('\n');
}

async function copyEntityAbsoluteDirectoryPath({
  paths,
  fs,
  missingCode,
  missingMessage,
  unsafeMessage,
  writeText,
  failureMessage,
}: {
  readonly paths: EntityDirectoryPaths;
  readonly fs: FsProbe | undefined;
  readonly missingCode: EntityActionMissingPathCode;
  readonly missingMessage: string;
  readonly unsafeMessage: string;
  readonly writeText: WriteClipboardText;
  readonly failureMessage: string;
}): Promise<WorkspaceEntityActionResponse> {
  const validation = await validateDirectoryBeforeEntityAction({
    fs,
    directoryPath: paths.directoryAbsolute,
    missingCode,
    missingMessage,
    unsafeMessage,
  });
  if (validation) {
    return validation;
  }

  try {
    writeText(paths.directoryAbsolute);
  } catch {
    return workspaceError('ERR_CLIPBOARD_WRITE_FAILED', failureMessage);
  }

  return workspaceEntityActionResponseSchema.parse({ ok: true });
}

async function copyEntityDirectoryPath({
  paths,
  handle,
  fs,
  pathKind,
  missingCode,
  missingMessage,
  unsafeMessage,
  writeText,
  failureMessage,
}: {
  readonly paths: EntityDirectoryPaths;
  readonly handle: RequiredWorkspaceHandle;
  readonly fs: FsProbe | undefined;
  readonly pathKind: 'absolute' | 'relative';
  readonly missingCode: EntityActionMissingPathCode;
  readonly missingMessage: string;
  readonly unsafeMessage: string;
  readonly writeText: WriteClipboardText;
  readonly failureMessage: string;
}): Promise<WorkspaceEntityActionResponse> {
  if (pathKind === 'absolute') {
    return copyEntityAbsoluteDirectoryPath({
      paths,
      fs,
      missingCode,
      missingMessage,
      unsafeMessage,
      writeText,
      failureMessage,
    });
  }

  const pathText = workspaceRelativePosixPath(handle, paths.directoryAbsolute);
  const validation = await validateDirectoryBeforeEntityAction({
    fs,
    directoryPath: paths.directoryAbsolute,
    missingCode,
    missingMessage,
    unsafeMessage,
  });
  if (validation) {
    return validation;
  }

  try {
    writeText(pathText);
  } catch {
    return workspaceError('ERR_CLIPBOARD_WRITE_FAILED', failureMessage);
  }

  return workspaceEntityActionResponseSchema.parse({ ok: true });
}

async function revealEntityDirectory({
  paths,
  fs,
  missingCode,
  missingMessage,
  unsafeMessage,
  showItemInFolder,
  failureMessage,
}: {
  readonly paths: EntityDirectoryPaths;
  readonly fs: FsProbe | undefined;
  readonly missingCode: EntityActionMissingPathCode;
  readonly missingMessage: string;
  readonly unsafeMessage: string;
  readonly showItemInFolder: ShowItemInFolder;
  readonly failureMessage: string;
}): Promise<WorkspaceEntityActionResponse> {
  const validation = await validateDirectoryBeforeEntityAction({
    fs,
    directoryPath: paths.directoryAbsolute,
    missingCode,
    missingMessage,
    unsafeMessage,
  });
  if (validation) {
    return validation;
  }

  try {
    showItemInFolder(paths.directoryAbsolute);
  } catch {
    return workspaceError('ERR_SHELL_OPEN_FAILED', failureMessage);
  }

  return workspaceEntityActionResponseSchema.parse({ ok: true });
}

async function openEntityDocument({
  paths,
  fs,
  missingCode,
  missingMessage,
  unsafeMessage,
  openPath,
  failureMessage,
}: {
  readonly paths: EntityDocumentPaths;
  readonly fs: FsProbe | undefined;
  readonly missingCode: EntityActionMissingPathCode;
  readonly missingMessage: string;
  readonly unsafeMessage: string;
  readonly openPath: OpenPath;
  readonly failureMessage: string;
}): Promise<WorkspaceEntityActionResponse> {
  const validation = await validateFileBeforeEntityAction({
    fs,
    filePath: paths.documentAbsolute,
    missingCode,
    missingMessage,
    unsafeMessage,
  });
  if (validation) {
    return validation;
  }

  try {
    const openError = await openPath(paths.documentAbsolute);
    if (openError) {
      return workspaceError('ERR_SHELL_OPEN_FAILED', failureMessage);
    }
  } catch {
    return workspaceError('ERR_SHELL_OPEN_FAILED', failureMessage);
  }

  return workspaceEntityActionResponseSchema.parse({ ok: true });
}

async function openWorkspaceRoot({
  canonicalRoot,
  trustedSender,
  handleStore,
  createHandle,
  memorySpaceRegistry,
  expectedWorkspaceId,
  afterWorkspaceLockAcquiredForTest,
}: {
  readonly canonicalRoot: string;
  readonly trustedSender: TrustedSenderIdentity;
  readonly handleStore: WorkspaceHandleStore;
  readonly createHandle?: (() => string) | undefined;
  readonly memorySpaceRegistry: WorkspaceMemorySpaceRegistry;
  readonly expectedWorkspaceId?: string | undefined;
  readonly afterWorkspaceLockAcquiredForTest?: (() => MaybePromise<void>) | undefined;
}): Promise<WorkspaceInitializeResponse> {
  const lock = await acquireWorkspaceLock({ canonicalRoot });
  if (!lock.ok) {
    return lock;
  }
  await afterWorkspaceLockAcquiredForTest?.();
  if (!lock.lock.isUsable()) {
    await releaseWorkspaceLockAfterFailure(lock);
    return workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost', 'none-written');
  }
  const repaired = await repairWorkspaceTitleMirrorFromRootName({
    rootPath: canonicalRoot,
    ...(expectedWorkspaceId !== undefined ? { workspaceId: expectedWorkspaceId } : {}),
    assertWorkspaceUsable: () =>
      lock.lock.isUsable()
        ? { ok: true as const }
        : workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost', 'none-written'),
  });
  if (!repaired.ok) {
    await releaseWorkspaceLockAfterFailure(lock);
    return repaired;
  }

  let opened: Awaited<ReturnType<typeof openWorkspaceFiles>>;
  try {
    opened = await openWorkspaceFiles({
      rootPath: canonicalRoot,
      assertWorkspaceUsable: () =>
        lock.lock.isUsable()
          ? { ok: true as const }
          : workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost', 'none-written'),
    });
  } catch {
    await releaseWorkspaceLockAfterFailure(lock);
    return workspaceError('ERR_WORKSPACE_OPEN_FAILED', 'Workspace could not be opened', 'unknown');
  }
  if (!opened.ok) {
    await releaseWorkspaceLockAfterFailure(lock);
    return opened;
  }
  const snapshot = opened.snapshot;
  if (expectedWorkspaceId !== undefined && snapshot.workspaceId !== expectedWorkspaceId) {
    await releaseWorkspaceLockAfterFailure(lock);
    return workspaceError(
      'ERR_WORKSPACE_METADATA_INVALID',
      'Workspace metadata is invalid',
      'previous-file-preserved'
    );
  }
  if (!lock.lock.isUsable()) {
    await releaseWorkspaceLockAfterFailure(lock);
    return workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost', 'none-written');
  }

  return persistAndRegisterWorkspaceSession({
    canonicalRoot,
    snapshot,
    trustedSender,
    lock,
    handleStore,
    createHandle,
    memorySpaceRegistry,
    failureCode: 'ERR_WORKSPACE_OPEN_FAILED',
    failureMessage: 'Workspace could not be opened',
  });
}

async function handleOpenWorkspaceCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  tokenStore = createWorkspaceSelectionTokenStore(),
  handleStore = createWorkspaceHandleStore(),
  createWorkspaceId: createWorkspaceIdOption = createWorkspaceId,
  createHandle,
  now = nowIso,
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
  afterWorkspaceLockAcquiredForTest,
}: HandleInitializeWorkspaceForTestOptions): Promise<WorkspaceInitializeResponse> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_OPEN_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceOpenRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'openWorkspace request is invalid');
  }

  const consumed = tokenStore.consumeSelection({
    selectionToken: request.data.selectionToken,
    sender: trusted.sender,
  });
  if (!consumed.ok) {
    return consumed;
  }

  const target = await classifyWorkspaceOpenTarget(consumed.rootPath);
  if (!target.ok) {
    return target;
  }

  if (target.kind === 'empty') {
    return initializeWorkspaceRoot({
      canonicalRoot: target.canonicalRoot,
      title: path.basename(target.canonicalRoot),
      description: '',
      trustedSender: trusted.sender,
      handleStore,
      createWorkspaceId: createWorkspaceIdOption,
      createHandle,
      memorySpaceRegistry,
      now,
      validateBeforeInitialize: () =>
        validateEmptyWorkspaceOpenCanonicalTargetAfterLock(target.canonicalRoot),
      afterWorkspaceLockAcquiredForTest,
    });
  }
  const { canonicalRoot } = target;

  return openWorkspaceRoot({
    canonicalRoot,
    trustedSender: trusted.sender,
    handleStore,
    createHandle,
    memorySpaceRegistry,
    afterWorkspaceLockAcquiredForTest,
  });
}

export async function handleOpenWorkspace(
  options: HandleInitializeWorkspaceOptions
): Promise<WorkspaceInitializeResponse> {
  return handleOpenWorkspaceCore(options);
}

export async function handleOpenWorkspaceForTest(
  options: HandleInitializeWorkspaceForTestOptions
): Promise<WorkspaceInitializeResponse> {
  return handleOpenWorkspaceCore(options);
}

async function handleOpenWorkspaceMemorySpaceCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  handleStore = createWorkspaceHandleStore(),
  createHandle,
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
  afterWorkspaceLockAcquiredForTest,
}: HandleOpenWorkspaceMemorySpaceOptions): Promise<WorkspaceInitializeResponse> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceOpenMemorySpaceRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'openMemorySpace request is invalid');
  }

  let memorySpace: Awaited<ReturnType<WorkspaceMemorySpaceRegistry['resolveMemorySpace']>> | null;
  try {
    memorySpace = await memorySpaceRegistry.resolveMemorySpace(request.data.workspaceId);
  } catch (error) {
    return workspaceMemorySpaceRegistryReadError(error);
  }
  if (!memorySpace) {
    return workspaceError(
      'ERR_WORKSPACE_MEMORY_SPACE_NOT_FOUND',
      'Workspace memorySpace is not registered',
      'none-written'
    );
  }

  const target = await validateWorkspaceOpenTarget(memorySpace.rootPath);
  if (!target.ok) {
    return target;
  }

  return openWorkspaceRoot({
    canonicalRoot: target.canonicalRoot,
    trustedSender: trusted.sender,
    handleStore,
    createHandle,
    memorySpaceRegistry,
    expectedWorkspaceId: request.data.workspaceId,
    afterWorkspaceLockAcquiredForTest,
  });
}

export async function handleOpenWorkspaceMemorySpace(
  options: HandleOpenWorkspaceMemorySpaceOptions
): Promise<WorkspaceInitializeResponse> {
  return handleOpenWorkspaceMemorySpaceCore(options);
}

export async function handleOpenWorkspaceMemorySpaceForTest(
  options: HandleOpenWorkspaceMemorySpaceOptions
): Promise<WorkspaceInitializeResponse> {
  return handleOpenWorkspaceMemorySpaceCore(options);
}

async function handleBeginMicrophoneIntentCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  handleStore = createWorkspaceHandleStore(),
  now,
}: HandleMicrophoneIntentOptions): Promise<ReturnType<typeof createMicrophoneIntent>> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_BEGIN_MICROPHONE_INTENT_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const senderId = ipcSenderId(event);
  if (typeof senderId !== 'number') {
    return senderId;
  }

  const request = workspaceMicrophoneIntentRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'beginMicrophoneIntent request is invalid'
    );
  }

  const required = handleStore.requireHandle({
    workspaceHandle: request.data.workspaceHandle,
    sender: trusted.sender,
  });
  if (!required.ok) {
    return required;
  }

  return workspaceMicrophoneIntentResponseSchema.parse(
    createMicrophoneIntent({
      senderId,
      workspaceHandle: request.data.workspaceHandle,
      recordingFlowSessionId: request.data.recordingFlowSessionId,
      ...(now ? { now } : {}),
    })
  );
}

export async function handleBeginMicrophoneIntent(
  options: HandleMicrophoneIntentOptions
): Promise<ReturnType<typeof createMicrophoneIntent>> {
  return handleBeginMicrophoneIntentCore(options);
}

export async function handleBeginMicrophoneIntentForTest(
  options: HandleMicrophoneIntentOptions
): Promise<ReturnType<typeof createMicrophoneIntent>> {
  return handleBeginMicrophoneIntentCore(options);
}

async function handleClearMicrophoneIntentCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  handleStore = createWorkspaceHandleStore(),
}: HandleWorkspaceRequestOptions): Promise<
  z.infer<typeof workspaceClearMicrophoneIntentResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_CLEAR_MICROPHONE_INTENT_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const senderId = ipcSenderId(event);
  if (typeof senderId !== 'number') {
    return senderId;
  }

  const request = workspaceMicrophoneIntentRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'clearMicrophoneIntent request is invalid'
    );
  }

  const required = handleStore.requireOwnedHandle({
    workspaceHandle: request.data.workspaceHandle,
    sender: trusted.sender,
  });
  if (!required.ok) {
    return required;
  }

  clearMicrophoneIntent({
    senderId,
    workspaceHandle: request.data.workspaceHandle,
    recordingFlowSessionId: request.data.recordingFlowSessionId,
  });
  return workspaceClearMicrophoneIntentResponseSchema.parse({ ok: true, value: { cleared: true } });
}

export async function handleClearMicrophoneIntent(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceClearMicrophoneIntentResponseSchema>> {
  return handleClearMicrophoneIntentCore(options);
}

export async function handleClearMicrophoneIntentForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceClearMicrophoneIntentResponseSchema>> {
  return handleClearMicrophoneIntentCore(options);
}

async function handleCloseWorkspaceCore({
  backfillRuntime,
  speechSynthesisRuntime,
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  handleStore = createWorkspaceHandleStore(),
  onBeforeBackfillCancel,
  onWorkspaceClosed,
  recordingTranscriptionSessions = defaultRecordingTranscriptionSessions,
}: HandleWorkspaceRequestOptions): Promise<z.infer<typeof workspaceCloseResponseSchema>> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_CLOSE_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceCloseRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'closeWorkspace request is invalid');
  }

  const handle = handleStore.requireOwnedHandle({
    workspaceHandle: request.data.workspaceHandle,
    sender: trusted.sender,
  });
  if (!handle.ok) {
    return handle;
  }

  clearMicrophoneIntentsForWorkspaceHandle(request.data.workspaceHandle);
  recordingTranscriptionSessions.closeForWorkspaceHandle(request.data.workspaceHandle);
  if (onBeforeBackfillCancel?.(request.data.workspaceHandle) ?? true) {
    await backfillRuntime?.cancelAllAndDrain('workspace-switch');
    await speechSynthesisRuntime?.cancelAllAndDrain('workspace-switch');
  }
  const closed = await handleStore.closeHandle({
    workspaceHandle: request.data.workspaceHandle,
    sender: trusted.sender,
  });
  if (!closed.ok) {
    return closed;
  }

  clearRecordingRuntimeStateForRoot(handle.handle.canonicalRoot);
  await onWorkspaceClosed?.(request.data.workspaceHandle);
  return workspaceCloseResponseSchema.parse({ ok: true, value: { closed: true } });
}

export async function handleCloseWorkspace(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceCloseResponseSchema>> {
  return handleCloseWorkspaceCore(options);
}

export async function handleCloseWorkspaceForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceCloseResponseSchema>> {
  return handleCloseWorkspaceCore(options);
}

function handleUpdateMemoryTitleCore({
  now = nowIso,
  ...options
}: HandleUpdateMemoryTitleOptions): Promise<
  z.infer<typeof workspaceUpdateMemoryTitleResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceUpdateMemoryTitleRequestSchema,
    invalidMessage: 'updateMemoryTitle request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (
          isSystemDraftWorkspaceId(handle.workspaceId) &&
          isSystemDraftDefaultMemoryId(request.memoryId)
        ) {
          return protectedSystemEntityError('System Draft default Memory cannot be renamed');
        }
        const result = await updateMemoryTitleFromFileTruth({
          rootPath: handle.canonicalRoot,
          memoryId: request.memoryId,
          title: request.title,
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceUpdateMemoryTitleResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

export async function handleUpdateMemoryTitle(
  options: HandleUpdateMemoryTitleOptions
): Promise<z.infer<typeof workspaceUpdateMemoryTitleResponseSchema>> {
  return handleUpdateMemoryTitleCore(options);
}

export async function handleUpdateMemoryTitleForTest(
  options: HandleUpdateMemoryTitleOptions
): Promise<z.infer<typeof workspaceUpdateMemoryTitleResponseSchema>> {
  return handleUpdateMemoryTitleCore(options);
}

function handleUpdateSegmentTitleCore({
  now = nowIso,
  ...options
}: HandleUpdateSegmentTitleOptions): Promise<
  z.infer<typeof workspaceUpdateSegmentTitleResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_UPDATE_SEGMENT_TITLE_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceUpdateSegmentTitleRequestSchema,
    invalidMessage: 'updateSegmentTitle request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await updateSegmentTitleFromFileTruth({
          rootPath: handle.canonicalRoot,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          title: request.title,
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceUpdateSegmentTitleResponseSchema.parse(result);
      }),
  });
}

export async function handleUpdateSegmentTitle(
  options: HandleUpdateSegmentTitleOptions
): Promise<z.infer<typeof workspaceUpdateSegmentTitleResponseSchema>> {
  return handleUpdateSegmentTitleCore(options);
}

export async function handleUpdateSegmentTitleForTest(
  options: HandleUpdateSegmentTitleOptions
): Promise<z.infer<typeof workspaceUpdateSegmentTitleResponseSchema>> {
  return handleUpdateSegmentTitleCore(options);
}

function handleUpdateSegmentContentTitleCore({
  now = nowIso,
  ...options
}: HandleUpdateSegmentContentTitleOptions): Promise<
  z.infer<typeof workspaceUpdateSegmentContentTitleResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_UPDATE_SEGMENT_CONTENT_TITLE_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceUpdateSegmentContentTitleRequestSchema,
    invalidMessage: 'updateSegmentContentTitle request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment content title workspace does not match the active handle'
          );
        }

        const result = await updateSegmentContentTitleFromFileTruth({
          rootPath: handle.canonicalRoot,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          contentTitle: request.contentTitle,
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceUpdateSegmentContentTitleResponseSchema.parse(result);
      }),
  });
}

export async function handleUpdateSegmentContentTitle(
  options: HandleUpdateSegmentContentTitleOptions
): Promise<z.infer<typeof workspaceUpdateSegmentContentTitleResponseSchema>> {
  return handleUpdateSegmentContentTitleCore(options);
}

export async function handleUpdateSegmentContentTitleForTest(
  options: HandleUpdateSegmentContentTitleOptions
): Promise<z.infer<typeof workspaceUpdateSegmentContentTitleResponseSchema>> {
  return handleUpdateSegmentContentTitleCore(options);
}

function handleUpdateSegmentContentTabOrderCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceUpdateSegmentContentTabOrderResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_UPDATE_SEGMENT_CONTENT_TAB_ORDER_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceUpdateSegmentContentTabOrderRequestSchema,
    invalidMessage: 'updateSegmentContentTabOrder request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment content tab order workspace does not match the active handle'
          );
        }

        const result = await updateSegmentContentTabOrderFromFileTruth({
          rootPath: handle.canonicalRoot,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          contentTabOrder: request.contentTabOrder,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceUpdateSegmentContentTabOrderResponseSchema.parse(result);
      }),
  });
}

export async function handleUpdateSegmentContentTabOrder(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceUpdateSegmentContentTabOrderResponseSchema>> {
  return handleUpdateSegmentContentTabOrderCore(options);
}

export async function handleUpdateSegmentContentTabOrderForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceUpdateSegmentContentTabOrderResponseSchema>> {
  return handleUpdateSegmentContentTabOrderCore(options);
}

function widgetMutationError(
  fallbackCode:
    | 'ERR_WORKSPACE_WIDGET_UPDATE_FAILED'
    | 'ERR_WORKSPACE_WIDGET_DELETE_FAILED'
    | 'ERR_WORKSPACE_WIDGET_RESTORE_FAILED',
  message: string,
  error: unknown
): WorkspaceErrorEnvelope {
  if (error instanceof Error && error.message === 'Workspace widget not found') {
    return workspaceError('ERR_WORKSPACE_WIDGET_NOT_FOUND', 'Workspace widget was not found');
  }
  return workspaceError(fallbackCode, message, 'unknown');
}

function handleUpdateWidgetTitleCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceUpdateWidgetTitleResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_UPDATE_WIDGET_TITLE_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceUpdateWidgetTitleRequestSchema,
    invalidMessage: 'updateWidgetTitle request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Widget title workspace does not match the active handle'
          );
        }

        try {
          const result = await updateWorkspaceWidgetTitleFromFileTruth({
            rootPath: handle.canonicalRoot,
            workspaceId: request.workspaceId,
            widgetId: request.widgetId,
            title: request.title,
            assertWorkspaceUsable: assertUsable,
          });
          return workspaceUpdateWidgetTitleResponseSchema.parse({ ok: true, value: result });
        } catch (error) {
          return widgetMutationError(
            'ERR_WORKSPACE_WIDGET_UPDATE_FAILED',
            'Workspace widget title could not be updated',
            error
          );
        }
      }),
  });
}

export async function handleUpdateWidgetTitle(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceUpdateWidgetTitleResponseSchema>> {
  return handleUpdateWidgetTitleCore(options);
}

export async function handleUpdateWidgetTitleForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceUpdateWidgetTitleResponseSchema>> {
  return handleUpdateWidgetTitleCore(options);
}

function handleUpdateWidgetTabOrderCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceUpdateWidgetTabOrderResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_UPDATE_WIDGET_TAB_ORDER_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceUpdateWidgetTabOrderRequestSchema,
    invalidMessage: 'updateWidgetTabOrder request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Widget tab order workspace does not match the active handle'
          );
        }

        try {
          const result = await updateWorkspaceWidgetTabOrderFromFileTruth({
            rootPath: handle.canonicalRoot,
            workspaceId: request.workspaceId,
            widgetTabOrder: request.widgetTabOrder,
            assertWorkspaceUsable: assertUsable,
          });
          return workspaceUpdateWidgetTabOrderResponseSchema.parse({ ok: true, value: result });
        } catch (error) {
          return widgetMutationError(
            'ERR_WORKSPACE_WIDGET_UPDATE_FAILED',
            'Workspace widget tab order could not be updated',
            error
          );
        }
      }),
  });
}

export async function handleUpdateWidgetTabOrder(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceUpdateWidgetTabOrderResponseSchema>> {
  return handleUpdateWidgetTabOrderCore(options);
}

export async function handleUpdateWidgetTabOrderForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceUpdateWidgetTabOrderResponseSchema>> {
  return handleUpdateWidgetTabOrderCore(options);
}

function handleUpdateSegmentSupplementTitleCore(
  options: HandleUpdateSegmentSupplementTitleOptions
): Promise<z.infer<typeof workspaceUpdateSegmentSupplementTitleResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_UPDATE_SEGMENT_SUPPLEMENT_TITLE_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceUpdateSegmentSupplementTitleRequestSchema,
    invalidMessage: 'updateSegmentSupplementTitle request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment supplement title workspace does not match the active handle'
          );
        }

        const result = await updateSegmentSupplementTitleFromFileTruth({
          rootPath: handle.canonicalRoot,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          supplementId: request.supplementId,
          title: request.title,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceUpdateSegmentSupplementTitleResponseSchema.parse(result);
      }),
  });
}

export async function handleUpdateSegmentSupplementTitle(
  options: HandleUpdateSegmentSupplementTitleOptions
): Promise<z.infer<typeof workspaceUpdateSegmentSupplementTitleResponseSchema>> {
  return handleUpdateSegmentSupplementTitleCore(options);
}

export async function handleUpdateSegmentSupplementTitleForTest(
  options: HandleUpdateSegmentSupplementTitleOptions
): Promise<z.infer<typeof workspaceUpdateSegmentSupplementTitleResponseSchema>> {
  return handleUpdateSegmentSupplementTitleCore(options);
}

type MoveTargetSegment = {
  readonly segmentId: string;
  readonly title: string;
  readonly disabledReason: string | null;
};

type MoveTargetMemory = {
  readonly memoryId: string;
  readonly title: string;
  readonly disabledReason: string | null;
  readonly segments: readonly MoveTargetSegment[];
};

type MoveTargetSpace = {
  readonly workspaceId: string;
  readonly title: string;
  readonly disabledReason: string | null;
  readonly memories: readonly MoveTargetMemory[];
};
type EntityMoveSourceType = z.infer<
  typeof workspaceListEntityMoveTargetsRequestSchema
>['sourceType'];
type EntityMoveTargetLevel = 'workspace' | 'memory' | 'segment';

type MoveSourceProjection =
  | {
      readonly type: 'memory';
      readonly workspaceId: string;
      readonly memoryId: string;
      readonly title: string;
      readonly breadcrumb: readonly string[];
    }
  | {
      readonly type: 'segment';
      readonly workspaceId: string;
      readonly memoryId: string;
      readonly segmentId: string;
      readonly title: string;
      readonly breadcrumb: readonly string[];
    }
  | {
      readonly type: 'supplement';
      readonly workspaceId: string;
      readonly memoryId: string;
      readonly segmentId: string;
      readonly supplementId: string;
      readonly title: string;
      readonly breadcrumb: readonly string[];
    };

type MoveTargetWorkspaceRoot = {
  readonly rootPath: string;
  readonly assertUsable: AssertWorkspaceHandleUsable;
  readonly release: () => Promise<void>;
};

function moveInvalidTargetError(message: string): WorkspaceErrorEnvelope {
  return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', message);
}

function entityMoveTargetLevelForSource(sourceType: EntityMoveSourceType): EntityMoveTargetLevel {
  if (sourceType === 'memory') {
    return 'workspace';
  }
  if (sourceType === 'segment') {
    return 'memory';
  }
  return 'segment';
}

async function resolveMoveTargetWorkspaceRoot({
  activeHandle,
  appDataDir,
  memorySpaceRegistry,
  now,
  targetWorkspaceId,
}: {
  readonly activeHandle: RequiredWorkspaceHandle;
  readonly appDataDir?: string | undefined;
  readonly memorySpaceRegistry: WorkspaceMemorySpaceRegistry;
  readonly now: () => string;
  readonly targetWorkspaceId: string;
}): Promise<
  { readonly ok: true; readonly value: MoveTargetWorkspaceRoot } | WorkspaceErrorEnvelope
> {
  if (targetWorkspaceId === activeHandle.workspaceId) {
    return {
      ok: true,
      value: {
        rootPath: activeHandle.canonicalRoot,
        assertUsable: activeHandle.assertUsable,
        release: async () => {},
      },
    };
  }

  let rootPath: string | null;
  if (isSystemDraftWorkspaceId(targetWorkspaceId)) {
    const ensured = await ensureSystemDraftWorkspaceForIpc({ appDataDir, now });
    if (!ensured.ok) {
      return ensured;
    }
    rootPath = ensured.value.rootPath;
  } else {
    try {
      rootPath = await memorySpaceRegistry.resolveMemorySpaceRoot(targetWorkspaceId);
    } catch (error) {
      return workspaceMemorySpaceRegistryReadError(error);
    }
  }

  if (!rootPath) {
    return workspaceError(
      'ERR_WORKSPACE_MEMORY_SPACE_NOT_FOUND',
      'Move target workspace could not be resolved'
    );
  }

  const lock = await acquireWorkspaceLock({ canonicalRoot: rootPath });
  if (!lock.ok) {
    return lock;
  }
  const assertTemporaryTargetUsable = workspaceLockAssertUsable(lock);

  const opened = await openWorkspaceFiles({
    rootPath,
    assertWorkspaceUsable: assertTemporaryTargetUsable,
  });
  if (!opened.ok) {
    await releaseWorkspaceLockAfterFailure(lock);
    return opened;
  }
  if (opened.snapshot.workspaceId !== targetWorkspaceId) {
    await releaseWorkspaceLockAfterFailure(lock);
    return workspaceError(
      'ERR_WORKSPACE_METADATA_INVALID',
      'Move target workspace metadata is invalid',
      'previous-file-preserved'
    );
  }

  return {
    ok: true,
    value: {
      rootPath,
      assertUsable: assertTemporaryTargetUsable,
      release: async () => {
        if (lock.lock.isHeld()) {
          await lock.lock.release().catch(() => {});
        }
      },
    },
  };
}

async function readMoveWorkspaceSnapshot({
  assertUsable,
  rootPath,
  workspaceId,
}: {
  readonly assertUsable?: AssertWorkspaceHandleUsable;
  readonly rootPath: string;
  readonly workspaceId: string;
}): Promise<{ readonly ok: true; readonly snapshot: WorkspaceSnapshot } | WorkspaceErrorEnvelope> {
  const result = await readWorkspaceSnapshotFromFileTruth({
    rootPath,
    workspaceId,
    ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
  });
  return result.ok ? { ok: true, snapshot: result.snapshot } : result;
}

async function readMoveMemoryDetailSegments({
  assertUsable,
  rootPath,
  workspaceId,
  memoryId,
}: {
  readonly assertUsable?: AssertWorkspaceHandleUsable;
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
}): Promise<readonly MoveTargetSegment[]> {
  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId,
    memoryId,
    ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
  });
  if (!detail.ok) {
    return [];
  }
  return detail.value.segments.map((segment) => ({
    segmentId: segment.segmentId,
    title: segment.title,
    disabledReason: null,
  }));
}

async function moveTargetSpaceFromSnapshot({
  assertUsable,
  rootPath,
  snapshot,
  source,
}: {
  readonly assertUsable?: AssertWorkspaceHandleUsable;
  readonly rootPath: string;
  readonly snapshot: WorkspaceSnapshot;
  readonly source: z.infer<typeof workspaceListEntityMoveTargetsRequestSchema>;
}): Promise<MoveTargetSpace> {
  const targetLevel = entityMoveTargetLevelForSource(source.sourceType);
  const memories =
    targetLevel === 'workspace'
      ? []
      : await Promise.all(
          snapshot.memories.map(async (memory) => {
            const segments =
              targetLevel === 'segment'
                ? await readMoveMemoryDetailSegments({
                    rootPath,
                    workspaceId: snapshot.workspaceId,
                    memoryId: memory.memoryId,
                    ...(assertUsable ? { assertUsable } : {}),
                  })
                : [];
            return {
              memoryId: memory.memoryId,
              title: memory.title,
              disabledReason:
                source.sourceType === 'segment' &&
                snapshot.workspaceId === source.workspaceId &&
                memory.memoryId === source.memoryId
                  ? '当前位置'
                  : null,
              segments: segments.map((segment) => ({
                ...segment,
                disabledReason:
                  source.sourceType === 'supplement' &&
                  snapshot.workspaceId === source.workspaceId &&
                  memory.memoryId === source.memoryId &&
                  segment.segmentId === source.segmentId
                    ? '当前位置'
                    : null,
              })),
            };
          })
        );

  return {
    workspaceId: snapshot.workspaceId,
    title: snapshot.title,
    disabledReason:
      source.sourceType === 'memory' && snapshot.workspaceId === source.workspaceId
        ? '当前位置'
        : null,
    memories,
  };
}

async function withTemporaryMoveTargetWorkspace<T>({
  rootPath,
  workspaceId,
  run,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly run: (input: {
    readonly assertUsable: AssertWorkspaceHandleUsable;
    readonly rootPath: string;
    readonly snapshot: WorkspaceSnapshot;
  }) => Promise<T>;
}): Promise<T | null> {
  const lock = await acquireWorkspaceLock({ canonicalRoot: rootPath });
  if (!lock.ok) {
    return null;
  }
  const assertUsable = workspaceLockAssertUsable(lock);
  try {
    const opened = await openWorkspaceFiles({ rootPath, assertWorkspaceUsable: assertUsable });
    if (!opened.ok || opened.snapshot.workspaceId !== workspaceId) {
      return null;
    }
    return await run({ assertUsable, rootPath, snapshot: opened.snapshot });
  } finally {
    if (lock.lock.isHeld()) {
      await lock.lock.release().catch(() => {});
    }
  }
}

async function readMoveSourceProjection({
  handle,
  request,
}: {
  readonly handle: RequiredWorkspaceHandle;
  readonly request: z.infer<typeof workspaceListEntityMoveTargetsRequestSchema>;
}): Promise<
  | {
      readonly ok: true;
      readonly source: MoveSourceProjection;
      readonly snapshot: WorkspaceSnapshot;
    }
  | WorkspaceErrorEnvelope
> {
  const snapshotResult = await readMoveWorkspaceSnapshot({
    assertUsable: handle.assertUsable,
    rootPath: handle.canonicalRoot,
    workspaceId: handle.workspaceId,
  });
  if (!snapshotResult.ok) {
    return snapshotResult;
  }
  const { snapshot } = snapshotResult;
  const memory = snapshot.memories.find((candidate) => candidate.memoryId === request.memoryId);
  if (!memory) {
    return workspaceError('ERR_WORKSPACE_MEMORY_NOT_FOUND', 'Move source Memory was not found');
  }
  if (request.sourceType === 'memory') {
    return {
      ok: true,
      snapshot,
      source: {
        type: 'memory',
        workspaceId: snapshot.workspaceId,
        memoryId: memory.memoryId,
        title: memory.title,
        breadcrumb: [snapshot.title],
      },
    };
  }

  const detail = await readMemoryDetailFromFileTruth({
    rootPath: handle.canonicalRoot,
    workspaceId: handle.workspaceId,
    memoryId: request.memoryId,
    assertWorkspaceUsable: handle.assertUsable,
  });
  if (!detail.ok) {
    return detail;
  }
  const segment = detail.value.segments.find(
    (candidate) => candidate.segmentId === request.segmentId
  );
  if (!segment) {
    return workspaceError('ERR_WORKSPACE_SEGMENT_NOT_FOUND', 'Move source Segment was not found');
  }
  if (request.sourceType === 'segment') {
    return {
      ok: true,
      snapshot,
      source: {
        type: 'segment',
        workspaceId: snapshot.workspaceId,
        memoryId: memory.memoryId,
        segmentId: segment.segmentId,
        title: segment.title,
        breadcrumb: [snapshot.title, memory.title],
      },
    };
  }

  const supplement = segment.supplements.find(
    (candidate) => candidate.supplementId === request.supplementId
  );
  if (!supplement) {
    return workspaceError(
      'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND',
      'Move source SegmentSupplement was not found'
    );
  }
  return {
    ok: true,
    snapshot,
    source: {
      type: 'supplement',
      workspaceId: snapshot.workspaceId,
      memoryId: memory.memoryId,
      segmentId: segment.segmentId,
      supplementId: supplement.supplementId,
      title: supplement.title,
      breadcrumb: [snapshot.title, memory.title, segment.title],
    },
  };
}

function handleListEntityMoveTargetsCore({
  appDataDir,
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  handleStore = createWorkspaceHandleStore(),
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
  now = nowIso,
}: HandleEntityMoveOptions): Promise<z.infer<typeof workspaceListEntityMoveTargetsResponseSchema>> {
  return withWorkspaceHandleRequest({
    event,
    input,
    channel: WORKSPACE_LIST_ENTITY_MOVE_TARGETS_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
    handleStore,
    schema: workspaceListEntityMoveTargetsRequestSchema,
    invalidMessage: 'listEntityMoveTargets request is invalid',
    run: async (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Move target list workspace does not match the active handle'
          );
        }

        const sourceResult = await readMoveSourceProjection({ handle, request });
        if (!sourceResult.ok) {
          return sourceResult;
        }

        const spaces: MoveTargetSpace[] = [];
        const seenWorkspaceIds = new Set<string>();
        const pushSnapshot = async ({
          assertUsable,
          rootPath,
          snapshot,
        }: {
          readonly assertUsable?: AssertWorkspaceHandleUsable;
          readonly rootPath: string;
          readonly snapshot: WorkspaceSnapshot;
        }) => {
          if (seenWorkspaceIds.has(snapshot.workspaceId)) {
            return;
          }
          seenWorkspaceIds.add(snapshot.workspaceId);
          spaces.push(
            await moveTargetSpaceFromSnapshot({
              rootPath,
              snapshot,
              source: request,
              ...(assertUsable ? { assertUsable } : {}),
            })
          );
        };

        await pushSnapshot({
          assertUsable: handle.assertUsable,
          rootPath: handle.canonicalRoot,
          snapshot: sourceResult.snapshot,
        });

        if (!seenWorkspaceIds.has(SYSTEM_DRAFT_WORKSPACE_ID)) {
          const ensuredDraft = await ensureSystemDraftWorkspaceForIpc({ appDataDir, now });
          if (!ensuredDraft.ok) {
            return ensuredDraft;
          }
          const draftRead = await withTemporaryMoveTargetWorkspace({
            rootPath: ensuredDraft.value.rootPath,
            workspaceId: SYSTEM_DRAFT_WORKSPACE_ID,
            run: async ({ assertUsable: draftAssertUsable, rootPath, snapshot }) => {
              await pushSnapshot({
                assertUsable: draftAssertUsable,
                rootPath,
                snapshot: annotateSystemDraftSnapshot(snapshot),
              });
            },
          });
          if (draftRead === null && !seenWorkspaceIds.has(SYSTEM_DRAFT_WORKSPACE_ID)) {
            return workspaceError(
              'ERR_WORKSPACE_OPEN_FAILED',
              'System Draft workspace could not be read for move targets'
            );
          }
        }

        let memorySpaces: Awaited<ReturnType<WorkspaceMemorySpaceRegistry['listMemorySpaces']>>;
        try {
          memorySpaces = await memorySpaceRegistry.listMemorySpaces();
        } catch (error) {
          return workspaceMemorySpaceRegistryReadError(error);
        }
        for (const memorySpace of memorySpaces) {
          if (seenWorkspaceIds.has(memorySpace.workspaceId)) {
            continue;
          }
          let rootPath: string | null;
          try {
            rootPath = await memorySpaceRegistry.resolveMemorySpaceRoot(memorySpace.workspaceId);
          } catch (error) {
            return workspaceMemorySpaceRegistryReadError(error);
          }
          if (!rootPath) {
            continue;
          }
          await withTemporaryMoveTargetWorkspace({
            rootPath,
            workspaceId: memorySpace.workspaceId,
            run: async ({
              assertUsable: targetAssertUsable,
              rootPath: targetRootPath,
              snapshot,
            }) => {
              await pushSnapshot({
                assertUsable: targetAssertUsable,
                rootPath: targetRootPath,
                snapshot,
              });
            },
          });
        }

        const targetLevel = entityMoveTargetLevelForSource(request.sourceType);
        return workspaceListEntityMoveTargetsResponseSchema.parse({
          ok: true,
          value: {
            source: sourceResult.source,
            targetLevel,
            spaces,
          },
        });
      }),
  });
}

function handleMoveMemoryCore({
  appDataDir,
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
  now = nowIso,
  ...options
}: HandleEntityMoveOptions): Promise<z.infer<typeof workspaceMoveMemoryResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_MOVE_MEMORY_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceMoveMemoryRequestSchema,
    invalidMessage: 'moveMemory request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Memory move workspace does not match the active handle'
          );
        }
        if (
          isSystemDraftWorkspaceId(handle.workspaceId) &&
          isSystemDraftDefaultMemoryId(request.memoryId)
        ) {
          return protectedSystemEntityError('System Draft default Memory cannot be moved');
        }
        if (request.targetWorkspaceId === request.workspaceId) {
          return moveInvalidTargetError('Memory is already in this workspace');
        }

        const target = await resolveMoveTargetWorkspaceRoot({
          activeHandle: handle,
          appDataDir,
          memorySpaceRegistry,
          now,
          targetWorkspaceId: request.targetWorkspaceId,
        });
        if (!target.ok) {
          return target;
        }
        try {
          const result = await moveMemoryBetweenFileTruthRoots({
            sourceRootPath: handle.canonicalRoot,
            sourceWorkspaceId: request.workspaceId,
            memoryId: request.memoryId,
            targetRootPath: target.value.rootPath,
            targetWorkspaceId: request.targetWorkspaceId,
            assertSourceWorkspaceUsable: assertUsable,
            assertTargetWorkspaceUsable: target.value.assertUsable,
          });
          return workspaceMoveMemoryResponseSchema.parse(
            result.ok ? { ok: true, value: result.value } : result
          );
        } finally {
          await target.value.release();
        }
      }),
  });
}

function handleMoveSegmentCore({
  appDataDir,
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
  now = nowIso,
  ...options
}: HandleEntityMoveOptions): Promise<z.infer<typeof workspaceMoveSegmentResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_MOVE_SEGMENT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceMoveSegmentRequestSchema,
    invalidMessage: 'moveSegment request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment move workspace does not match the active handle'
          );
        }
        if (
          request.targetWorkspaceId === request.workspaceId &&
          request.targetMemoryId === request.memoryId
        ) {
          return moveInvalidTargetError('Segment is already in this Memory');
        }

        const target = await resolveMoveTargetWorkspaceRoot({
          activeHandle: handle,
          appDataDir,
          memorySpaceRegistry,
          now,
          targetWorkspaceId: request.targetWorkspaceId,
        });
        if (!target.ok) {
          return target;
        }
        try {
          const result = await moveSegmentBetweenFileTruthRoots({
            sourceRootPath: handle.canonicalRoot,
            sourceWorkspaceId: request.workspaceId,
            memoryId: request.memoryId,
            segmentId: request.segmentId,
            targetRootPath: target.value.rootPath,
            targetWorkspaceId: request.targetWorkspaceId,
            targetMemoryId: request.targetMemoryId,
            assertSourceWorkspaceUsable: assertUsable,
            assertTargetWorkspaceUsable: target.value.assertUsable,
          });
          return workspaceMoveSegmentResponseSchema.parse(
            result.ok ? { ok: true, value: result.value } : result
          );
        } finally {
          await target.value.release();
        }
      }),
  });
}

function handleMoveSegmentSupplementCore({
  appDataDir,
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
  now = nowIso,
  ...options
}: HandleEntityMoveOptions): Promise<z.infer<typeof workspaceMoveSegmentSupplementResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_MOVE_SEGMENT_SUPPLEMENT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceMoveSegmentSupplementRequestSchema,
    invalidMessage: 'moveSegmentSupplement request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'SegmentSupplement move workspace does not match the active handle'
          );
        }
        if (
          request.targetWorkspaceId === request.workspaceId &&
          request.targetMemoryId === request.memoryId &&
          request.targetSegmentId === request.segmentId
        ) {
          return moveInvalidTargetError('SegmentSupplement is already in this Segment');
        }

        const target = await resolveMoveTargetWorkspaceRoot({
          activeHandle: handle,
          appDataDir,
          memorySpaceRegistry,
          now,
          targetWorkspaceId: request.targetWorkspaceId,
        });
        if (!target.ok) {
          return target;
        }
        try {
          const result = await moveSegmentSupplementBetweenFileTruthRoots({
            sourceRootPath: handle.canonicalRoot,
            sourceWorkspaceId: request.workspaceId,
            memoryId: request.memoryId,
            segmentId: request.segmentId,
            supplementId: request.supplementId,
            targetRootPath: target.value.rootPath,
            targetWorkspaceId: request.targetWorkspaceId,
            targetMemoryId: request.targetMemoryId,
            targetSegmentId: request.targetSegmentId,
            assertSourceWorkspaceUsable: assertUsable,
            assertTargetWorkspaceUsable: target.value.assertUsable,
          });
          return workspaceMoveSegmentSupplementResponseSchema.parse(
            result.ok ? { ok: true, value: result.value } : result
          );
        } finally {
          await target.value.release();
        }
      }),
  });
}

export async function handleListEntityMoveTargets(
  options: HandleEntityMoveOptions
): Promise<z.infer<typeof workspaceListEntityMoveTargetsResponseSchema>> {
  return handleListEntityMoveTargetsCore(options);
}

export async function handleListEntityMoveTargetsForTest(
  options: HandleEntityMoveOptions
): Promise<z.infer<typeof workspaceListEntityMoveTargetsResponseSchema>> {
  return handleListEntityMoveTargetsCore(options);
}

export async function handleMoveMemory(
  options: HandleEntityMoveOptions
): Promise<z.infer<typeof workspaceMoveMemoryResponseSchema>> {
  return handleMoveMemoryCore(options);
}

export async function handleMoveMemoryForTest(
  options: HandleEntityMoveOptions
): Promise<z.infer<typeof workspaceMoveMemoryResponseSchema>> {
  return handleMoveMemoryCore(options);
}

export async function handleMoveSegment(
  options: HandleEntityMoveOptions
): Promise<z.infer<typeof workspaceMoveSegmentResponseSchema>> {
  return handleMoveSegmentCore(options);
}

export async function handleMoveSegmentForTest(
  options: HandleEntityMoveOptions
): Promise<z.infer<typeof workspaceMoveSegmentResponseSchema>> {
  return handleMoveSegmentCore(options);
}

export async function handleMoveSegmentSupplement(
  options: HandleEntityMoveOptions
): Promise<z.infer<typeof workspaceMoveSegmentSupplementResponseSchema>> {
  return handleMoveSegmentSupplementCore(options);
}

export async function handleMoveSegmentSupplementForTest(
  options: HandleEntityMoveOptions
): Promise<z.infer<typeof workspaceMoveSegmentSupplementResponseSchema>> {
  return handleMoveSegmentSupplementCore(options);
}

function handleCreateMemoryCore({
  createMemoryId: createMemoryIdOption = createMemoryId,
  now = nowIso,
  ...options
}: HandleCreateMemoryOptions): Promise<z.infer<typeof workspaceCreateMemoryResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_CREATE_MEMORY_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceCreateMemoryRequestSchema,
    invalidMessage: 'createMemory request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await createMemoryFromFileTruth({
          rootPath: handle.canonicalRoot,
          memoryId: createMemoryIdOption(),
          title: request.title,
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceCreateMemoryResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

function handleDeleteMemoryCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceDeleteMemoryResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_DELETE_MEMORY_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceDeleteMemoryRequestSchema,
    invalidMessage: 'deleteMemory request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (
          isSystemDraftWorkspaceId(handle.workspaceId) &&
          isSystemDraftDefaultMemoryId(request.memoryId)
        ) {
          return protectedSystemEntityError('System Draft default Memory cannot be deleted');
        }
        const result = await deleteMemoryFromFileTruth({
          rootPath: handle.canonicalRoot,
          memoryId: request.memoryId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceDeleteMemoryResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

function handleRestoreDeletedMemoryCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreDeletedMemoryResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_RESTORE_DELETED_MEMORY_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceRestoreDeletedMemoryRequestSchema,
    invalidMessage: 'restoreDeletedMemory request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await restoreDeletedMemoryFromFileTruth({
          rootPath: handle.canonicalRoot,
          restoreToken: request.restoreToken,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceRestoreDeletedMemoryResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

function handleResetMemoryCoverCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceResetMemoryCoverResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_RESET_MEMORY_COVER_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceResetMemoryCoverRequestSchema,
    invalidMessage: 'resetMemoryCover request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await resetMemoryCoverToDefaultFromFileTruth({
          rootPath: handle.canonicalRoot,
          memoryId: request.memoryId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceResetMemoryCoverResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

function handleRestoreMemoryCoverCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreMemoryCoverResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_RESTORE_MEMORY_COVER_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceRestoreMemoryCoverRequestSchema,
    invalidMessage: 'restoreMemoryCover request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await restoreMemoryCoverFromTrash({
          rootPath: handle.canonicalRoot,
          memoryId: request.memoryId,
          restoreToken: request.restoreToken,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceRestoreMemoryCoverResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

function handleSwitchMemoryDefaultCoverCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceSwitchMemoryDefaultCoverResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_SWITCH_MEMORY_DEFAULT_COVER_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceSwitchMemoryDefaultCoverRequestSchema,
    invalidMessage: 'switchMemoryDefaultCover request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await switchMemoryDefaultCoverTemplateFromFileTruth({
          rootPath: handle.canonicalRoot,
          memoryId: request.memoryId,
          templateId: request.templateId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceSwitchMemoryDefaultCoverResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

function handleResetSegmentCoverCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceResetSegmentCoverResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_RESET_SEGMENT_COVER_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceResetSegmentCoverRequestSchema,
    invalidMessage: 'resetSegmentCover request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Workspace handle does not match workspace'
          );
        }
        const result = await resetSegmentCoverToDefaultFromFileTruth({
          rootPath: handle.canonicalRoot,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceResetSegmentCoverResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

function handleRestoreSegmentCoverCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreSegmentCoverResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_RESTORE_SEGMENT_COVER_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceRestoreSegmentCoverRequestSchema,
    invalidMessage: 'restoreSegmentCover request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Workspace handle does not match workspace'
          );
        }
        const result = await restoreSegmentCoverFromTrash({
          rootPath: handle.canonicalRoot,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          restoreToken: request.restoreToken,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceRestoreSegmentCoverResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

function handleSwitchSegmentDefaultCoverCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceSwitchSegmentDefaultCoverResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_SWITCH_SEGMENT_DEFAULT_COVER_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceSwitchSegmentDefaultCoverRequestSchema,
    invalidMessage: 'switchSegmentDefaultCover request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Workspace handle does not match workspace'
          );
        }
        const result = await switchSegmentDefaultCoverTemplateFromFileTruth({
          rootPath: handle.canonicalRoot,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          templateId: request.templateId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceSwitchSegmentDefaultCoverResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

function handleDeleteSegmentCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceDeleteSegmentResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_DELETE_SEGMENT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceDeleteSegmentRequestSchema,
    invalidMessage: 'deleteSegment request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment delete workspace does not match the active handle'
          );
        }

        const result = await deleteSegmentFromFileTruth({
          rootPath: handle.canonicalRoot,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceDeleteSegmentResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

function handleRestoreDeletedSegmentCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreDeletedSegmentResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_RESTORE_DELETED_SEGMENT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceRestoreDeletedSegmentRequestSchema,
    invalidMessage: 'restoreDeletedSegment request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment restore workspace does not match the active handle'
          );
        }

        const result = await restoreDeletedSegmentFromFileTruth({
          rootPath: handle.canonicalRoot,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          restoreToken: request.restoreToken,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceRestoreDeletedSegmentResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

function handleDeleteSegmentSupplementCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceDeleteSegmentSupplementResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_DELETE_SEGMENT_SUPPLEMENT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceDeleteSegmentSupplementRequestSchema,
    invalidMessage: 'deleteSegmentSupplement request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'SegmentSupplement delete workspace does not match the active handle'
          );
        }

        const result = await deleteSegmentSupplementFromFileTruth({
          rootPath: handle.canonicalRoot,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          supplementId: request.supplementId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceDeleteSegmentSupplementResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

function handleRestoreDeletedSegmentSupplementCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreDeletedSegmentSupplementResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_RESTORE_DELETED_SEGMENT_SUPPLEMENT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceRestoreDeletedSegmentSupplementRequestSchema,
    invalidMessage: 'restoreDeletedSegmentSupplement request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'SegmentSupplement restore workspace does not match the active handle'
          );
        }

        const result = await restoreDeletedSegmentSupplementFromFileTruth({
          rootPath: handle.canonicalRoot,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          restoreToken: request.restoreToken,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceRestoreDeletedSegmentSupplementResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

function handleDeleteWidgetCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceDeleteWidgetResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_DELETE_WIDGET_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceDeleteWidgetRequestSchema,
    invalidMessage: 'deleteWidget request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Widget delete workspace does not match the active handle'
          );
        }

        try {
          const result = await deleteWorkspaceWidgetFromFileTruth({
            rootPath: handle.canonicalRoot,
            workspaceId: request.workspaceId,
            widgetId: request.widgetId,
            assertWorkspaceUsable: assertUsable,
          });
          return workspaceDeleteWidgetResponseSchema.parse({ ok: true, value: result });
        } catch (error) {
          return widgetMutationError(
            'ERR_WORKSPACE_WIDGET_DELETE_FAILED',
            'Workspace widget could not be deleted',
            error
          );
        }
      }),
  });
}

export async function handleDeleteWidget(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceDeleteWidgetResponseSchema>> {
  return handleDeleteWidgetCore(options);
}

export async function handleDeleteWidgetForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceDeleteWidgetResponseSchema>> {
  return handleDeleteWidgetCore(options);
}

function handleRestoreDeletedWidgetCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreDeletedWidgetResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_RESTORE_DELETED_WIDGET_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceRestoreDeletedWidgetRequestSchema,
    invalidMessage: 'restoreDeletedWidget request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Widget restore workspace does not match the active handle'
          );
        }

        try {
          const result = await restoreDeletedWorkspaceWidgetFromFileTruth({
            rootPath: handle.canonicalRoot,
            workspaceId: request.workspaceId,
            restoreToken: request.restoreToken,
            assertWorkspaceUsable: assertUsable,
          });
          return workspaceRestoreDeletedWidgetResponseSchema.parse({ ok: true, value: result });
        } catch (error) {
          return widgetMutationError(
            'ERR_WORKSPACE_WIDGET_RESTORE_FAILED',
            'Workspace widget could not be restored',
            error
          );
        }
      }),
  });
}

export async function handleRestoreDeletedWidget(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreDeletedWidgetResponseSchema>> {
  return handleRestoreDeletedWidgetCore(options);
}

export async function handleRestoreDeletedWidgetForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreDeletedWidgetResponseSchema>> {
  return handleRestoreDeletedWidgetCore(options);
}

function handleCreateRecordingDraftCore({
  createSegmentId: createSegmentIdOption = createSegmentId,
  now = nowIso,
  ...options
}: HandleCreateRecordingDraftOptions): Promise<
  z.infer<typeof workspaceCreateRecordingDraftResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceHandleRequestSchema,
    invalidMessage: 'createRecordingDraft request is invalid',
    run: (_request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await createRecordingDraft({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          createSegmentId: createSegmentIdOption,
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceCreateRecordingDraftResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  segmentId: result.segmentId,
                  nextSequence: result.nextSequence,
                },
              }
            : result
        );
      }),
  });
}

function handleCreateSegmentSupplementRecordingDraftCore({
  createSupplementId: createSupplementIdOption = createSupplementId,
  now = nowIso,
  ...options
}: HandleCreateSegmentSupplementRecordingDraftOptions): Promise<
  z.infer<typeof workspaceCreateSegmentSupplementRecordingDraftResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceCreateSegmentSupplementRecordingDraftRequestSchema,
    invalidMessage: 'createSegmentSupplementRecordingDraft request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment supplement draft workspace does not match the active handle'
          );
        }

        const result = await createSegmentSupplementRecordingDraft({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          createSupplementId: createSupplementIdOption,
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceCreateSegmentSupplementRecordingDraftResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  supplementId: result.supplementId,
                  nextSequence: result.nextSequence,
                },
              }
            : result
        );
      }),
  });
}

function handleCreateNoteSegmentDraftCore({
  createSegmentId: createSegmentIdOption = createSegmentId,
  now = nowIso,
  ...options
}: HandleCreateNoteSegmentDraftOptions): Promise<
  z.infer<typeof workspaceCreateNoteSegmentDraftResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_CREATE_NOTE_SEGMENT_DRAFT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceCreateNoteSegmentDraftRequestSchema,
    invalidMessage: 'createNoteSegmentDraft request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Note segment draft workspace does not match the active handle'
          );
        }
        const result = await createNoteSegmentDraft({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          title: request.title,
          createSegmentId: createSegmentIdOption,
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceCreateNoteSegmentDraftResponseSchema.parse(
          result.ok
            ? { ok: true, value: { segmentId: result.segmentId, revision: result.revision } }
            : result
        );
      }),
  });
}

function handleCreateSegmentSupplementNoteDraftCore({
  createSupplementId: createSupplementIdOption = createSupplementId,
  now = nowIso,
  ...options
}: HandleCreateSegmentSupplementNoteDraftOptions): Promise<
  z.infer<typeof workspaceCreateSegmentSupplementNoteDraftResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceCreateSegmentSupplementNoteDraftRequestSchema,
    invalidMessage: 'createSegmentSupplementNoteDraft request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Note supplement draft workspace does not match the active handle'
          );
        }
        const result = await createSegmentSupplementNoteDraft({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          title: request.title,
          createSupplementId: createSupplementIdOption,
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceCreateSegmentSupplementNoteDraftResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: { supplementId: result.supplementId, revision: result.revision },
              }
            : result
        );
      }),
  });
}

function handleWriteNoteSegmentDraftBodyCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceWriteNoteSegmentDraftBodyResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_WRITE_NOTE_SEGMENT_DRAFT_BODY_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceWriteNoteSegmentDraftBodyRequestSchema,
    invalidMessage: 'writeNoteSegmentDraftBody request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await writeNoteSegmentDraftBody({
          rootPath: handle.canonicalRoot,
          segmentId: request.segmentId,
          bodyMarkdown: request.bodyMarkdown,
          ...(request.bodyTiptapJson ? { bodyTiptapJson: request.bodyTiptapJson } : {}),
          revision: request.revision,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceWriteNoteSegmentDraftBodyResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: { bodyByteLength: result.bodyByteLength, revision: result.revision },
              }
            : result
        );
      }),
  });
}

function handleWriteSegmentSupplementNoteDraftBodyCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceWriteSegmentSupplementNoteDraftBodyResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_WRITE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_BODY_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceWriteSegmentSupplementNoteDraftBodyRequestSchema,
    invalidMessage: 'writeSegmentSupplementNoteDraftBody request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await writeSegmentSupplementNoteDraftBody({
          rootPath: handle.canonicalRoot,
          supplementId: request.supplementId,
          bodyMarkdown: request.bodyMarkdown,
          ...(request.bodyTiptapJson ? { bodyTiptapJson: request.bodyTiptapJson } : {}),
          revision: request.revision,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceWriteSegmentSupplementNoteDraftBodyResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: { bodyByteLength: result.bodyByteLength, revision: result.revision },
              }
            : result
        );
      }),
  });
}

export async function handleCreateRecordingDraft(
  options: HandleCreateRecordingDraftOptions
): Promise<z.infer<typeof workspaceCreateRecordingDraftResponseSchema>> {
  return handleCreateRecordingDraftCore(options);
}

export async function handleCreateRecordingDraftForTest(
  options: HandleCreateRecordingDraftOptions
): Promise<z.infer<typeof workspaceCreateRecordingDraftResponseSchema>> {
  return handleCreateRecordingDraftCore(options);
}

export async function handleCreateSegmentSupplementRecordingDraft(
  options: HandleCreateSegmentSupplementRecordingDraftOptions
): Promise<z.infer<typeof workspaceCreateSegmentSupplementRecordingDraftResponseSchema>> {
  return handleCreateSegmentSupplementRecordingDraftCore(options);
}

export async function handleCreateSegmentSupplementRecordingDraftForTest(
  options: HandleCreateSegmentSupplementRecordingDraftOptions
): Promise<z.infer<typeof workspaceCreateSegmentSupplementRecordingDraftResponseSchema>> {
  return handleCreateSegmentSupplementRecordingDraftCore(options);
}

export async function handleCreateNoteSegmentDraft(
  options: HandleCreateNoteSegmentDraftOptions
): Promise<z.infer<typeof workspaceCreateNoteSegmentDraftResponseSchema>> {
  return handleCreateNoteSegmentDraftCore(options);
}

export async function handleCreateNoteSegmentDraftForTest(
  options: HandleCreateNoteSegmentDraftOptions
): Promise<z.infer<typeof workspaceCreateNoteSegmentDraftResponseSchema>> {
  return handleCreateNoteSegmentDraftCore(options);
}

export async function handleCreateSegmentSupplementNoteDraft(
  options: HandleCreateSegmentSupplementNoteDraftOptions
): Promise<z.infer<typeof workspaceCreateSegmentSupplementNoteDraftResponseSchema>> {
  return handleCreateSegmentSupplementNoteDraftCore(options);
}

export async function handleCreateSegmentSupplementNoteDraftForTest(
  options: HandleCreateSegmentSupplementNoteDraftOptions
): Promise<z.infer<typeof workspaceCreateSegmentSupplementNoteDraftResponseSchema>> {
  return handleCreateSegmentSupplementNoteDraftCore(options);
}

export async function handleWriteNoteSegmentDraftBodyForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceWriteNoteSegmentDraftBodyResponseSchema>> {
  return handleWriteNoteSegmentDraftBodyCore(options);
}

export async function handleWriteSegmentSupplementNoteDraftBodyForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceWriteSegmentSupplementNoteDraftBodyResponseSchema>> {
  return handleWriteSegmentSupplementNoteDraftBodyCore(options);
}

export async function handleCreateMemory(
  options: HandleCreateMemoryOptions
): Promise<z.infer<typeof workspaceCreateMemoryResponseSchema>> {
  return handleCreateMemoryCore(options);
}

export async function handleCreateMemoryForTest(
  options: HandleCreateMemoryOptions
): Promise<z.infer<typeof workspaceCreateMemoryResponseSchema>> {
  return handleCreateMemoryCore(options);
}

export async function handleDeleteMemory(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceDeleteMemoryResponseSchema>> {
  return handleDeleteMemoryCore(options);
}

export async function handleDeleteMemoryForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceDeleteMemoryResponseSchema>> {
  return handleDeleteMemoryCore(options);
}

export async function handleRestoreDeletedMemory(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreDeletedMemoryResponseSchema>> {
  return handleRestoreDeletedMemoryCore(options);
}

export async function handleRestoreDeletedMemoryForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreDeletedMemoryResponseSchema>> {
  return handleRestoreDeletedMemoryCore(options);
}

export async function handleResetMemoryCover(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceResetMemoryCoverResponseSchema>> {
  return handleResetMemoryCoverCore(options);
}

export async function handleResetMemoryCoverForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceResetMemoryCoverResponseSchema>> {
  return handleResetMemoryCoverCore(options);
}

export async function handleRestoreMemoryCover(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreMemoryCoverResponseSchema>> {
  return handleRestoreMemoryCoverCore(options);
}

export async function handleRestoreMemoryCoverForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreMemoryCoverResponseSchema>> {
  return handleRestoreMemoryCoverCore(options);
}

export async function handleSwitchMemoryDefaultCover(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceSwitchMemoryDefaultCoverResponseSchema>> {
  return handleSwitchMemoryDefaultCoverCore(options);
}

export async function handleSwitchMemoryDefaultCoverForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceSwitchMemoryDefaultCoverResponseSchema>> {
  return handleSwitchMemoryDefaultCoverCore(options);
}

export async function handleResetSegmentCover(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceResetSegmentCoverResponseSchema>> {
  return handleResetSegmentCoverCore(options);
}

export async function handleResetSegmentCoverForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceResetSegmentCoverResponseSchema>> {
  return handleResetSegmentCoverCore(options);
}

export async function handleRestoreSegmentCover(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreSegmentCoverResponseSchema>> {
  return handleRestoreSegmentCoverCore(options);
}

export async function handleRestoreSegmentCoverForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreSegmentCoverResponseSchema>> {
  return handleRestoreSegmentCoverCore(options);
}

export async function handleSwitchSegmentDefaultCover(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceSwitchSegmentDefaultCoverResponseSchema>> {
  return handleSwitchSegmentDefaultCoverCore(options);
}

export async function handleSwitchSegmentDefaultCoverForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceSwitchSegmentDefaultCoverResponseSchema>> {
  return handleSwitchSegmentDefaultCoverCore(options);
}

export async function handleDeleteSegment(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceDeleteSegmentResponseSchema>> {
  return handleDeleteSegmentCore(options);
}

export async function handleDeleteSegmentForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceDeleteSegmentResponseSchema>> {
  return handleDeleteSegmentCore(options);
}

export async function handleRestoreDeletedSegment(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreDeletedSegmentResponseSchema>> {
  return handleRestoreDeletedSegmentCore(options);
}

export async function handleRestoreDeletedSegmentForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreDeletedSegmentResponseSchema>> {
  return handleRestoreDeletedSegmentCore(options);
}

export async function handleDeleteSegmentSupplement(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceDeleteSegmentSupplementResponseSchema>> {
  return handleDeleteSegmentSupplementCore(options);
}

export async function handleDeleteSegmentSupplementForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceDeleteSegmentSupplementResponseSchema>> {
  return handleDeleteSegmentSupplementCore(options);
}

export async function handleRestoreDeletedSegmentSupplement(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreDeletedSegmentSupplementResponseSchema>> {
  return handleRestoreDeletedSegmentSupplementCore(options);
}

export async function handleRestoreDeletedSegmentSupplementForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRestoreDeletedSegmentSupplementResponseSchema>> {
  return handleRestoreDeletedSegmentSupplementCore(options);
}

function handleReadMemoryDetailCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadMemoryDetailResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_READ_MEMORY_DETAIL_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceReadMemoryDetailRequestSchema,
    invalidMessage: 'readMemoryDetail request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Memory detail workspace does not match the active handle'
          );
        }

        const result = await readMemoryDetailFromFileTruth({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceReadMemoryDetailResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  requestId: request.requestId,
                  detail: result.value,
                },
              }
            : result
        );
      }),
  });
}

function handleReadWorkspaceSnapshotCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadWorkspaceSnapshotResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_READ_WORKSPACE_SNAPSHOT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceReadWorkspaceSnapshotRequestSchema,
    invalidMessage: 'readWorkspaceSnapshot request is invalid',
    run: (_request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await readWorkspaceSnapshotFromFileTruth({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceReadWorkspaceSnapshotResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: result.snapshot,
              }
            : result
        );
      }),
  });
}

export async function handleReadWorkspaceSnapshot(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadWorkspaceSnapshotResponseSchema>> {
  return handleReadWorkspaceSnapshotCore(options);
}

export async function handleReadWorkspaceSnapshotForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadWorkspaceSnapshotResponseSchema>> {
  return handleReadWorkspaceSnapshotCore(options);
}

export async function handleReadMemoryDetail(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadMemoryDetailResponseSchema>> {
  return handleReadMemoryDetailCore(options);
}

export async function handleReadMemoryDetailForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadMemoryDetailResponseSchema>> {
  return handleReadMemoryDetailCore(options);
}

function handleReadFinalizedAudioSegmentCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadFinalizedAudioSegmentResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceReadFinalizedAudioSegmentRequestSchema,
    invalidMessage: 'readFinalizedAudioSegment request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Finalized audio workspace does not match the active handle'
          );
        }

        const result = await readFinalizedAudioSegmentContent({
          rootPath: handle.canonicalRoot,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceReadFinalizedAudioSegmentResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  requestId: request.requestId,
                  workspaceId: handle.workspaceId,
                  memoryId: request.memoryId,
                  segmentId: request.segmentId,
                  audioByteLength: result.audioByteLength,
                  audioHash: result.audioHash,
                  transcript: result.transcript,
                },
              }
            : result
        );
      }),
  });
}

function handleReadFinalizedAudioSegmentSupplementCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadFinalizedAudioSegmentSupplementResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_SUPPLEMENT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceReadFinalizedAudioSegmentSupplementRequestSchema,
    invalidMessage: 'readFinalizedAudioSegmentSupplement request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Finalized segment supplement audio workspace does not match the active handle'
          );
        }

        const result = await readFinalizedAudioSegmentSupplementContent({
          rootPath: handle.canonicalRoot,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          supplementId: request.supplementId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceReadFinalizedAudioSegmentSupplementResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  requestId: request.requestId,
                  workspaceId: handle.workspaceId,
                  memoryId: request.memoryId,
                  segmentId: request.segmentId,
                  supplementId: request.supplementId,
                  audioByteLength: result.audioByteLength,
                  audioHash: result.audioHash,
                  transcript: result.transcript,
                },
              }
            : result
        );
      }),
  });
}

function handleReadFinalizedAudioSegmentAudioCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadFinalizedAudioSegmentAudioResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_AUDIO_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceReadFinalizedAudioSegmentAudioRequestSchema,
    invalidMessage: 'readFinalizedAudioSegmentAudio request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Finalized audio workspace does not match the active handle'
          );
        }

        const result = await readFinalizedAudioSegmentAudio({
          ...(request.maxBytes !== undefined ? { maxBytes: request.maxBytes } : {}),
          rootPath: handle.canonicalRoot,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          expectedAudioByteLength: request.audioByteLength,
          expectedAudioHash: request.audioHash ?? null,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceReadFinalizedAudioSegmentAudioResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  requestId: request.requestId,
                  workspaceId: handle.workspaceId,
                  memoryId: request.memoryId,
                  segmentId: request.segmentId,
                  audio: result.audio,
                  audioByteLength: result.audioByteLength,
                  audioHash: result.audioHash,
                },
              }
            : result
        );
      }),
  });
}

function handleReadFinalizedAudioSegmentSupplementAudioCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadFinalizedAudioSegmentSupplementAudioResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_SUPPLEMENT_AUDIO_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceReadFinalizedAudioSegmentSupplementAudioRequestSchema,
    invalidMessage: 'readFinalizedAudioSegmentSupplementAudio request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Finalized segment supplement audio workspace does not match the active handle'
          );
        }

        const result = await readFinalizedAudioSegmentSupplementAudio({
          ...(request.maxBytes !== undefined ? { maxBytes: request.maxBytes } : {}),
          rootPath: handle.canonicalRoot,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          supplementId: request.supplementId,
          expectedAudioByteLength: request.audioByteLength,
          expectedAudioHash: request.audioHash ?? null,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceReadFinalizedAudioSegmentSupplementAudioResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  requestId: request.requestId,
                  workspaceId: handle.workspaceId,
                  memoryId: request.memoryId,
                  segmentId: request.segmentId,
                  supplementId: request.supplementId,
                  audio: result.audio,
                  audioByteLength: result.audioByteLength,
                  audioHash: result.audioHash,
                },
              }
            : result
        );
      }),
  });
}

export async function handleReadFinalizedAudioSegment(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadFinalizedAudioSegmentResponseSchema>> {
  return handleReadFinalizedAudioSegmentCore(options);
}

export async function handleReadFinalizedAudioSegmentForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadFinalizedAudioSegmentResponseSchema>> {
  return handleReadFinalizedAudioSegmentCore(options);
}

export async function handleReadFinalizedAudioSegmentSupplement(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadFinalizedAudioSegmentSupplementResponseSchema>> {
  return handleReadFinalizedAudioSegmentSupplementCore(options);
}

export async function handleReadFinalizedAudioSegmentSupplementForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadFinalizedAudioSegmentSupplementResponseSchema>> {
  return handleReadFinalizedAudioSegmentSupplementCore(options);
}

export async function handleReadFinalizedAudioSegmentAudio(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadFinalizedAudioSegmentAudioResponseSchema>> {
  return handleReadFinalizedAudioSegmentAudioCore(options);
}

export async function handleReadFinalizedAudioSegmentAudioForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadFinalizedAudioSegmentAudioResponseSchema>> {
  return handleReadFinalizedAudioSegmentAudioCore(options);
}

export async function handleReadFinalizedAudioSegmentSupplementAudio(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadFinalizedAudioSegmentSupplementAudioResponseSchema>> {
  return handleReadFinalizedAudioSegmentSupplementAudioCore(options);
}

export async function handleReadFinalizedAudioSegmentSupplementAudioForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadFinalizedAudioSegmentSupplementAudioResponseSchema>> {
  return handleReadFinalizedAudioSegmentSupplementAudioCore(options);
}

function handleFinalizeNoteSegmentDraftCore({
  now = nowIso,
  ...options
}: HandleFinalizeNoteSegmentDraftOptions): Promise<
  z.infer<typeof workspaceFinalizeNoteSegmentDraftResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_FINALIZE_NOTE_SEGMENT_DRAFT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceFinalizeNoteSegmentDraftRequestSchema,
    invalidMessage: 'finalizeNoteSegmentDraft request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Note segment finalize workspace does not match the active handle'
          );
        }
        const result = await finalizeNoteSegmentDraft({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          title: request.title,
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceFinalizeNoteSegmentDraftResponseSchema.parse(
          result.ok
            ? { ok: true, value: { memory: result.memory, segment: result.segment } }
            : result
        );
      }),
  });
}

function handleFinalizeSegmentSupplementNoteDraftCore({
  now = nowIso,
  ...options
}: HandleFinalizeSegmentSupplementNoteDraftOptions): Promise<
  z.infer<typeof workspaceFinalizeSegmentSupplementNoteDraftResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_FINALIZE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceFinalizeSegmentSupplementNoteDraftRequestSchema,
    invalidMessage: 'finalizeSegmentSupplementNoteDraft request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Note supplement finalize workspace does not match the active handle'
          );
        }
        const result = await finalizeSegmentSupplementNoteDraft({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          supplementId: request.supplementId,
          title: request.title,
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceFinalizeSegmentSupplementNoteDraftResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  memory: result.memory,
                  segment: result.segment,
                  supplement: result.supplement,
                },
              }
            : result
        );
      }),
  });
}

function handleReadSegmentContentCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadSegmentContentResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_READ_SEGMENT_CONTENT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceReadSegmentContentRequestSchema,
    invalidMessage: 'readSegmentContent request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment content workspace does not match the active handle'
          );
        }
        const result = await readFinalizedNoteSegmentContent({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceReadSegmentContentResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  requestId: request.requestId,
                  workspaceId: handle.workspaceId,
                  memoryId: request.memoryId,
                  segmentId: request.segmentId,
                  type: 'note',
                  title: result.title,
                  bodyMarkdown: result.bodyMarkdown,
                  bodyTiptapJson: result.bodyTiptapJson,
                  bodyByteLength: result.bodyByteLength,
                  baselineContentHash: result.baselineContentHash,
                  baselineTiptapContentHash: result.baselineTiptapContentHash,
                  speechSynthesis: result.speechSynthesis,
                },
              }
            : result
        );
      }),
  });
}

function handleReadSegmentSupplementContentCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadSegmentSupplementContentResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_READ_SEGMENT_SUPPLEMENT_CONTENT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceReadSegmentSupplementContentRequestSchema,
    invalidMessage: 'readSegmentSupplementContent request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment supplement content workspace does not match the active handle'
          );
        }
        const result = await readFinalizedNoteSegmentSupplementContent({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          supplementId: request.supplementId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceReadSegmentSupplementContentResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  requestId: request.requestId,
                  workspaceId: handle.workspaceId,
                  memoryId: request.memoryId,
                  segmentId: request.segmentId,
                  supplementId: request.supplementId,
                  type: 'note',
                  title: result.title,
                  bodyMarkdown: result.bodyMarkdown,
                  bodyTiptapJson: result.bodyTiptapJson,
                  bodyByteLength: result.bodyByteLength,
                  baselineContentHash: result.baselineContentHash,
                  baselineTiptapContentHash: result.baselineTiptapContentHash,
                  speechSynthesis: result.speechSynthesis,
                },
              }
            : result
        );
      }),
  });
}

function handleReadSegmentSpeechAudioCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadSegmentSpeechAudioResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_READ_SEGMENT_SPEECH_AUDIO_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceReadSegmentSpeechAudioRequestSchema,
    invalidMessage: 'readSegmentSpeechAudio request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment speech audio workspace does not match the active handle'
          );
        }
        const result = await readFinalizedNoteSegmentSpeechAudio({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          contentHash: request.contentHash,
          audioByteLength: request.audioByteLength,
          speaker: request.speaker,
          updatedAt: request.updatedAt,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceReadSegmentSpeechAudioResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  requestId: request.requestId,
                  workspaceId: handle.workspaceId,
                  memoryId: request.memoryId,
                  segmentId: request.segmentId,
                  audio: result.audio,
                  audioByteLength: result.audioByteLength,
                  contentHash: result.contentHash,
                  mimeType: result.mimeType,
                },
              }
            : result
        );
      }),
  });
}

function handleReadSegmentSupplementSpeechAudioCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadSegmentSupplementSpeechAudioResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_READ_SEGMENT_SUPPLEMENT_SPEECH_AUDIO_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceReadSegmentSupplementSpeechAudioRequestSchema,
    invalidMessage: 'readSegmentSupplementSpeechAudio request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment supplement speech audio workspace does not match the active handle'
          );
        }
        const result = await readFinalizedNoteSegmentSupplementSpeechAudio({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          supplementId: request.supplementId,
          contentHash: request.contentHash,
          audioByteLength: request.audioByteLength,
          speaker: request.speaker,
          updatedAt: request.updatedAt,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceReadSegmentSupplementSpeechAudioResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  requestId: request.requestId,
                  workspaceId: handle.workspaceId,
                  memoryId: request.memoryId,
                  segmentId: request.segmentId,
                  supplementId: request.supplementId,
                  audio: result.audio,
                  audioByteLength: result.audioByteLength,
                  contentHash: result.contentHash,
                  mimeType: result.mimeType,
                },
              }
            : result
        );
      }),
  });
}

function handleWriteSegmentContentCore({
  now = nowIso,
  ...options
}: HandleWriteNoteContentOptions): Promise<
  z.infer<typeof workspaceWriteSegmentContentResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_WRITE_SEGMENT_CONTENT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceWriteSegmentContentRequestSchema,
    invalidMessage: 'writeSegmentContent request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment content write workspace does not match the active handle'
          );
        }
        const result = await writeFinalizedNoteSegmentContent({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          bodyMarkdown: request.bodyMarkdown,
          ...(request.bodyTiptapJson ? { bodyTiptapJson: request.bodyTiptapJson } : {}),
          baselineContentHash: request.baselineContentHash,
          ...(request.baselineTiptapContentHash
            ? { baselineTiptapContentHash: request.baselineTiptapContentHash }
            : {}),
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceWriteSegmentContentResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  baselineContentHash: result.baselineContentHash,
                  baselineTiptapContentHash: result.baselineTiptapContentHash,
                  bodyByteLength: result.bodyByteLength,
                  saved: true,
                },
              }
            : result
        );
      }),
  });
}

function handleWriteSegmentSupplementContentCore({
  now = nowIso,
  ...options
}: HandleWriteNoteContentOptions): Promise<
  z.infer<typeof workspaceWriteSegmentSupplementContentResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_WRITE_SEGMENT_SUPPLEMENT_CONTENT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceWriteSegmentSupplementContentRequestSchema,
    invalidMessage: 'writeSegmentSupplementContent request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment supplement content write workspace does not match the active handle'
          );
        }
        const result = await writeFinalizedNoteSegmentSupplementContent({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          supplementId: request.supplementId,
          bodyMarkdown: request.bodyMarkdown,
          ...(request.bodyTiptapJson ? { bodyTiptapJson: request.bodyTiptapJson } : {}),
          baselineContentHash: request.baselineContentHash,
          ...(request.baselineTiptapContentHash
            ? { baselineTiptapContentHash: request.baselineTiptapContentHash }
            : {}),
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceWriteSegmentSupplementContentResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  baselineContentHash: result.baselineContentHash,
                  baselineTiptapContentHash: result.baselineTiptapContentHash,
                  bodyByteLength: result.bodyByteLength,
                  saved: true,
                },
              }
            : result
        );
      }),
  });
}

function handleSaveSegmentAttachmentCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceSaveAttachmentResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_SAVE_SEGMENT_ATTACHMENT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceSaveSegmentAttachmentRequestSchema,
    invalidMessage: 'saveSegmentAttachment request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment attachment workspace does not match the active handle'
          );
        }
        const result = await saveNoteSegmentAttachment({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          originalFilename: request.originalFilename,
          mimeType: request.mimeType,
          payload: request.payload,
        });
        return workspaceSaveAttachmentResponseSchema.parse(
          result.ok ? { ok: true, value: { relativePath: result.relativePath } } : result
        );
      }),
  });
}

function handleListSegmentAttachmentsCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceListAttachmentsResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_LIST_SEGMENT_ATTACHMENTS_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceListSegmentAttachmentsRequestSchema,
    invalidMessage: 'listSegmentAttachments request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment attachments workspace does not match the active handle'
          );
        }
        const result = await listNoteSegmentAttachments({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
        });
        return workspaceListAttachmentsResponseSchema.parse(
          result.ok ? { ok: true, value: { attachments: result.attachments } } : result
        );
      }),
  });
}

function handleSaveSegmentSupplementAttachmentCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceSaveAttachmentResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_ATTACHMENT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceSaveSegmentSupplementAttachmentRequestSchema,
    invalidMessage: 'saveSegmentSupplementAttachment request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment supplement attachment workspace does not match the active handle'
          );
        }
        const result = await saveNoteSegmentSupplementAttachment({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          supplementId: request.supplementId,
          originalFilename: request.originalFilename,
          mimeType: request.mimeType,
          payload: request.payload,
        });
        return workspaceSaveAttachmentResponseSchema.parse(
          result.ok ? { ok: true, value: { relativePath: result.relativePath } } : result
        );
      }),
  });
}

function handleListSegmentSupplementAttachmentsCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceListAttachmentsResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_LIST_SEGMENT_SUPPLEMENT_ATTACHMENTS_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceListSegmentSupplementAttachmentsRequestSchema,
    invalidMessage: 'listSegmentSupplementAttachments request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment supplement attachments workspace does not match the active handle'
          );
        }
        const result = await listNoteSegmentSupplementAttachments({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          supplementId: request.supplementId,
        });
        return workspaceListAttachmentsResponseSchema.parse(
          result.ok ? { ok: true, value: { attachments: result.attachments } } : result
        );
      }),
  });
}

export async function handleFinalizeNoteSegmentDraftForTest(
  options: HandleFinalizeNoteSegmentDraftOptions
): Promise<z.infer<typeof workspaceFinalizeNoteSegmentDraftResponseSchema>> {
  return handleFinalizeNoteSegmentDraftCore(options);
}

export async function handleFinalizeSegmentSupplementNoteDraftForTest(
  options: HandleFinalizeSegmentSupplementNoteDraftOptions
): Promise<z.infer<typeof workspaceFinalizeSegmentSupplementNoteDraftResponseSchema>> {
  return handleFinalizeSegmentSupplementNoteDraftCore(options);
}

export async function handleReadSegmentContentForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadSegmentContentResponseSchema>> {
  return handleReadSegmentContentCore(options);
}

export async function handleReadSegmentSupplementContentForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadSegmentSupplementContentResponseSchema>> {
  return handleReadSegmentSupplementContentCore(options);
}

export async function handleReadSegmentSpeechAudioForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadSegmentSpeechAudioResponseSchema>> {
  return handleReadSegmentSpeechAudioCore(options);
}

export async function handleReadSegmentSupplementSpeechAudioForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceReadSegmentSupplementSpeechAudioResponseSchema>> {
  return handleReadSegmentSupplementSpeechAudioCore(options);
}

export async function handleWriteSegmentContentForTest(
  options: HandleWriteNoteContentOptions
): Promise<z.infer<typeof workspaceWriteSegmentContentResponseSchema>> {
  return handleWriteSegmentContentCore(options);
}

export async function handleWriteSegmentSupplementContentForTest(
  options: HandleWriteNoteContentOptions
): Promise<z.infer<typeof workspaceWriteSegmentSupplementContentResponseSchema>> {
  return handleWriteSegmentSupplementContentCore(options);
}

export async function handleSaveSegmentAttachmentForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceSaveAttachmentResponseSchema>> {
  return handleSaveSegmentAttachmentCore(options);
}

export async function handleListSegmentAttachmentsForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceListAttachmentsResponseSchema>> {
  return handleListSegmentAttachmentsCore(options);
}

export async function handleSaveSegmentSupplementAttachmentForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceSaveAttachmentResponseSchema>> {
  return handleSaveSegmentSupplementAttachmentCore(options);
}

export async function handleListSegmentSupplementAttachmentsForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceListAttachmentsResponseSchema>> {
  return handleListSegmentSupplementAttachmentsCore(options);
}

function handleFinalizeRecordingDraftCore({
  now = nowIso,
  ...options
}: HandleFinalizeRecordingDraftOptions): Promise<
  z.infer<typeof workspaceRecordingFinalizeResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceRecordingFinalizeRequestSchema,
    invalidMessage: 'finalizeRecordingDraft request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await finalizeRecordingDraft({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          segmentId: request.segmentId,
          memoryId: request.memoryId,
          title: request.title,
          durationMs: request.durationMs,
          ...(request.lastTranscriptionAttemptOnFinalize
            ? { lastTranscriptionAttemptOnFinalize: request.lastTranscriptionAttemptOnFinalize }
            : {}),
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceRecordingFinalizeResponseSchema.parse(
          result.ok
            ? { ok: true, value: { memory: result.memory, segment: result.segment } }
            : result
        );
      }),
  });
}

function handleFinalizeSegmentSupplementRecordingDraftCore({
  now = nowIso,
  ...options
}: HandleFinalizeSegmentSupplementRecordingDraftOptions): Promise<
  z.infer<typeof workspaceFinalizeSegmentSupplementRecordingDraftResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_FINALIZE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceFinalizeSegmentSupplementRecordingDraftRequestSchema,
    invalidMessage: 'finalizeSegmentSupplementRecordingDraft request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment supplement finalize workspace does not match the active handle'
          );
        }

        const result = await finalizeSegmentSupplementRecordingDraft({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          supplementId: request.supplementId,
          title: request.title,
          durationMs: request.durationMs,
          ...(request.lastTranscriptionAttemptOnFinalize
            ? { lastTranscriptionAttemptOnFinalize: request.lastTranscriptionAttemptOnFinalize }
            : {}),
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceFinalizeSegmentSupplementRecordingDraftResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  memory: result.memory,
                  segment: result.segment,
                  supplement: result.supplement,
                },
              }
            : result
        );
      }),
  });
}

export async function handleFinalizeSegmentSupplementRecordingDraft(
  options: HandleFinalizeSegmentSupplementRecordingDraftOptions
): Promise<z.infer<typeof workspaceFinalizeSegmentSupplementRecordingDraftResponseSchema>> {
  return handleFinalizeSegmentSupplementRecordingDraftCore(options);
}

export async function handleFinalizeRecordingDraftForTest(
  options: HandleFinalizeRecordingDraftOptions
): Promise<z.infer<typeof workspaceRecordingFinalizeResponseSchema>> {
  return handleFinalizeRecordingDraftCore(options);
}

export async function handleFinalizeRecordingDraft(
  options: HandleFinalizeRecordingDraftOptions
): Promise<z.infer<typeof workspaceRecordingFinalizeResponseSchema>> {
  return handleFinalizeRecordingDraftCore(options);
}

export async function handleFinalizeSegmentSupplementRecordingDraftForTest(
  options: HandleFinalizeSegmentSupplementRecordingDraftOptions
): Promise<z.infer<typeof workspaceFinalizeSegmentSupplementRecordingDraftResponseSchema>> {
  return handleFinalizeSegmentSupplementRecordingDraftCore(options);
}

function handleSaveTranscriptCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRecordingMarkdownSaveResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_SAVE_TRANSCRIPT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceRecordingMarkdownSaveRequestSchema,
    invalidMessage: 'save transcript request is invalid',
    run: (request, handle, assertUsable) => saveTranscriptWithHandle(request, handle, assertUsable),
  });
}

function handleSaveSegmentSupplementTranscriptCore(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceSegmentSupplementMarkdownSaveResponseSchema>> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_TRANSCRIPT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceSegmentSupplementMarkdownSaveRequestSchema,
    invalidMessage: 'save segment supplement transcript request is invalid',
    run: (request, handle, assertUsable) =>
      saveSegmentSupplementTranscriptWithHandle(request, handle, assertUsable),
  });
}

function handleRequestSegmentTranscriptionBackfillCore({
  backfillRuntime,
  voiceSettingsStore,
  ...options
}: HandleWorkspaceRequestOptions & {
  readonly backfillRuntime?: WorkspaceBackfillRuntime;
  readonly voiceSettingsStore: VoiceSettingsStore;
}): Promise<z.infer<typeof workspaceRequestSegmentTranscriptionBackfillResponseSchema>> {
  const runtime = backfillRuntime ?? createWorkspaceBackfillRuntime({ voiceSettingsStore });
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_REQUEST_SEGMENT_TRANSCRIPTION_BACKFILL_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceRequestSegmentTranscriptionBackfillRequestSchema,
    invalidMessage: 'requestSegmentTranscriptionBackfill request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Backfill workspace does not match the active handle'
          );
        }
        return workspaceRequestSegmentTranscriptionBackfillResponseSchema.parse(
          await runtime.requestSegmentBackfill({
            assertWorkspaceUsable: assertUsable,
            memoryId: request.memoryId,
            mode: request.mode,
            rootPath: handle.canonicalRoot,
            segmentId: request.segmentId,
            workspaceHandle: request.workspaceHandle,
            workspaceId: request.workspaceId,
          })
        );
      }),
  });
}

function handleRequestSegmentSupplementTranscriptionBackfillCore({
  backfillRuntime,
  voiceSettingsStore,
  ...options
}: HandleWorkspaceRequestOptions & {
  readonly backfillRuntime?: WorkspaceBackfillRuntime;
  readonly voiceSettingsStore: VoiceSettingsStore;
}): Promise<z.infer<typeof workspaceRequestSegmentSupplementTranscriptionBackfillResponseSchema>> {
  const runtime = backfillRuntime ?? createWorkspaceBackfillRuntime({ voiceSettingsStore });
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_REQUEST_SEGMENT_SUPPLEMENT_TRANSCRIPTION_BACKFILL_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceRequestSegmentSupplementTranscriptionBackfillRequestSchema,
    invalidMessage: 'requestSegmentSupplementTranscriptionBackfill request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Backfill supplement workspace does not match the active handle'
          );
        }
        return workspaceRequestSegmentSupplementTranscriptionBackfillResponseSchema.parse(
          await runtime.requestSupplementBackfill({
            assertWorkspaceUsable: assertUsable,
            memoryId: request.memoryId,
            mode: request.mode,
            rootPath: handle.canonicalRoot,
            segmentId: request.segmentId,
            supplementId: request.supplementId,
            workspaceHandle: request.workspaceHandle,
            workspaceId: request.workspaceId,
          })
        );
      }),
  });
}

function handleRequestSegmentSpeechSynthesisCore({
  speechSynthesisRuntime,
  voiceSettingsStore,
  ...options
}: HandleWorkspaceRequestOptions & {
  readonly speechSynthesisRuntime?: WorkspaceSpeechSynthesisRuntime;
  readonly voiceSettingsStore?: VoiceSettingsStore;
}): Promise<z.infer<typeof workspaceRequestSegmentSpeechSynthesisResponseSchema>> {
  const runtime =
    speechSynthesisRuntime ??
    (voiceSettingsStore ? createWorkspaceSpeechSynthesisRuntime({ voiceSettingsStore }) : null);
  if (!runtime) {
    return Promise.resolve(
      workspaceRequestSegmentSpeechSynthesisResponseSchema.parse(
        workspaceError(
          'ERR_SPEECH_SYNTHESIS_UNAVAILABLE',
          'Speech synthesis runtime is unavailable'
        )
      )
    );
  }
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_REQUEST_SEGMENT_SPEECH_SYNTHESIS_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceRequestSegmentSpeechSynthesisRequestSchema,
    invalidMessage: 'requestSegmentSpeechSynthesis request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Speech synthesis workspace does not match the active handle'
          );
        }
        return workspaceRequestSegmentSpeechSynthesisResponseSchema.parse(
          await runtime.requestSegmentSpeechSynthesis({
            assertWorkspaceUsable: assertUsable,
            memoryId: request.memoryId,
            mode: request.mode,
            rootPath: handle.canonicalRoot,
            segmentId: request.segmentId,
            ...(request.speaker ? { speaker: request.speaker } : {}),
            workspaceHandle: request.workspaceHandle,
            workspaceId: request.workspaceId,
          })
        );
      }),
  });
}

function handleRequestSegmentSupplementSpeechSynthesisCore({
  speechSynthesisRuntime,
  voiceSettingsStore,
  ...options
}: HandleWorkspaceRequestOptions & {
  readonly speechSynthesisRuntime?: WorkspaceSpeechSynthesisRuntime;
  readonly voiceSettingsStore?: VoiceSettingsStore;
}): Promise<z.infer<typeof workspaceRequestSegmentSupplementSpeechSynthesisResponseSchema>> {
  const runtime =
    speechSynthesisRuntime ??
    (voiceSettingsStore ? createWorkspaceSpeechSynthesisRuntime({ voiceSettingsStore }) : null);
  if (!runtime) {
    return Promise.resolve(
      workspaceRequestSegmentSupplementSpeechSynthesisResponseSchema.parse(
        workspaceError(
          'ERR_SPEECH_SYNTHESIS_UNAVAILABLE',
          'Speech synthesis runtime is unavailable'
        )
      )
    );
  }
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_REQUEST_SEGMENT_SUPPLEMENT_SPEECH_SYNTHESIS_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceRequestSegmentSupplementSpeechSynthesisRequestSchema,
    invalidMessage: 'requestSegmentSupplementSpeechSynthesis request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Speech synthesis supplement workspace does not match the active handle'
          );
        }
        return workspaceRequestSegmentSupplementSpeechSynthesisResponseSchema.parse(
          await runtime.requestSupplementSpeechSynthesis({
            assertWorkspaceUsable: assertUsable,
            memoryId: request.memoryId,
            mode: request.mode,
            rootPath: handle.canonicalRoot,
            segmentId: request.segmentId,
            supplementId: request.supplementId,
            ...(request.speaker ? { speaker: request.speaker } : {}),
            workspaceHandle: request.workspaceHandle,
            workspaceId: request.workspaceId,
          })
        );
      }),
  });
}

function emptySpeechSynthesisBatchResult(
  speaker: SpeechSynthesisBatchResult['speaker']
): SpeechSynthesisBatchResult {
  return {
    failed: 0,
    failedTargets: [],
    generated: 0,
    skipped: 0,
    speaker,
    total: 0,
  };
}

function mergeSpeechSynthesisBatchResult(
  current: SpeechSynthesisBatchResult,
  next: SpeechSynthesisBatchResult
): SpeechSynthesisBatchResult {
  return {
    failed: current.failed + next.failed,
    failedTargets: [...current.failedTargets, ...next.failedTargets],
    generated: current.generated + next.generated,
    skipped: current.skipped + next.skipped,
    speaker: current.speaker,
    total: current.total + next.total,
  };
}

function workspaceLockAssertUsable(
  lock: Extract<Awaited<ReturnType<typeof acquireWorkspaceLock>>, { readonly ok: true }>
): () => { readonly ok: true } | WorkspaceErrorEnvelope {
  return () =>
    lock.ok && lock.lock.isUsable()
      ? { ok: true as const }
      : workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost', 'none-written');
}

async function regenerateInactiveWorkspaceSpeechSynthesis({
  memorySpaceRegistry,
  runtime,
  speaker,
  targets,
  workspaceId,
}: {
  readonly memorySpaceRegistry: WorkspaceMemorySpaceRegistry;
  readonly runtime: WorkspaceSpeechSynthesisRuntime;
  readonly speaker: SpeechSynthesisBatchResult['speaker'];
  readonly targets?: readonly WorkspaceSpeechSynthesisBatchTarget[];
  readonly workspaceId: string;
}): Promise<SpeechSynthesisBatchResult | null> {
  const memorySpace = await memorySpaceRegistry.resolveMemorySpace(workspaceId);
  if (!memorySpace) {
    return null;
  }
  const target = await validateWorkspaceOpenTarget(memorySpace.rootPath);
  if (!target.ok || target.metadata.workspaceId !== workspaceId) {
    return null;
  }
  const lock = await acquireWorkspaceLock({ canonicalRoot: target.canonicalRoot });
  if (!lock.ok) {
    return null;
  }

  try {
    return await runtime.regenerateWorkspaceSpeechSynthesis({
      assertWorkspaceUsable: workspaceLockAssertUsable(lock),
      rootPath: target.canonicalRoot,
      speaker,
      ...(targets ? { targets } : {}),
      workspaceHandle: `batch:${workspaceId}`,
      workspaceId,
    });
  } finally {
    if (lock.lock.isHeld()) {
      await lock.lock.release().catch(() => {});
    }
  }
}

async function handleRegenerateImportedSpeechSynthesisCore({
  event,
  expectedSession,
  expectedSessionKey,
  handleStore = createWorkspaceHandleStore(),
  input,
  isTrustedUrl,
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
  speechSynthesisRuntime,
  voiceSettingsStore,
}: WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly handleStore?: WorkspaceHandleStore;
  readonly input: unknown;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
  readonly speechSynthesisRuntime?: WorkspaceSpeechSynthesisRuntime;
  readonly voiceSettingsStore?: VoiceSettingsStore;
}): Promise<z.infer<typeof workspaceRegenerateImportedSpeechSynthesisResponseSchema>> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_REGENERATE_IMPORTED_SPEECH_SYNTHESIS_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }
  const request = workspaceRegenerateImportedSpeechSynthesisRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'regenerateImportedSpeechSynthesis request is invalid'
    );
  }

  const runtime =
    speechSynthesisRuntime ??
    (voiceSettingsStore ? createWorkspaceSpeechSynthesisRuntime({ voiceSettingsStore }) : null);
  if (!runtime) {
    return workspaceRegenerateImportedSpeechSynthesisResponseSchema.parse(
      workspaceError('ERR_SPEECH_SYNTHESIS_UNAVAILABLE', 'Speech synthesis runtime is unavailable')
    );
  }

  let memorySpaces: Awaited<ReturnType<WorkspaceMemorySpaceRegistry['listMemorySpaces']>>;
  try {
    memorySpaces = await memorySpaceRegistry.listMemorySpaces();
  } catch (error) {
    return workspaceMemorySpaceRegistryReadError(error);
  }

  let summary = emptySpeechSynthesisBatchResult(request.data.speaker);
  for (const memorySpace of memorySpaces) {
    const targets =
      request.data.mode === 'retry'
        ? request.data.targets.filter((target) => target.workspaceId === memorySpace.workspaceId)
        : undefined;
    if (request.data.mode === 'retry' && (!targets || targets.length === 0)) {
      continue;
    }

    let result: SpeechSynthesisBatchResult | null = null;
    const activeWorkspace = request.data.activeWorkspace;
    if (activeWorkspace?.workspaceId === memorySpace.workspaceId) {
      const required = handleStore.requireHandle({
        workspaceHandle: activeWorkspace.workspaceHandle,
        workspaceId: activeWorkspace.workspaceId,
        sender: trusted.sender,
      });
      if (required.ok) {
        result = await runtime.regenerateWorkspaceSpeechSynthesis({
          assertWorkspaceUsable: required.handle.assertUsable,
          rootPath: required.handle.canonicalRoot,
          speaker: request.data.speaker,
          ...(targets ? { targets } : {}),
          workspaceHandle: activeWorkspace.workspaceHandle,
          workspaceId: activeWorkspace.workspaceId,
        });
      }
    } else {
      result = await regenerateInactiveWorkspaceSpeechSynthesis({
        memorySpaceRegistry,
        runtime,
        speaker: request.data.speaker,
        ...(targets ? { targets } : {}),
        workspaceId: memorySpace.workspaceId,
      });
    }
    if (result) {
      summary = mergeSpeechSynthesisBatchResult(summary, result);
    } else if (targets) {
      summary = mergeSpeechSynthesisBatchResult(summary, {
        failed: targets.length,
        failedTargets: targets,
        generated: 0,
        skipped: 0,
        speaker: request.data.speaker,
        total: targets.length,
      });
    } else {
      summary = mergeSpeechSynthesisBatchResult(summary, {
        ...emptySpeechSynthesisBatchResult(request.data.speaker),
        skipped: 1,
        total: 1,
      });
    }
  }

  return workspaceRegenerateImportedSpeechSynthesisResponseSchema.parse({
    ok: true,
    value: summary,
  });
}

export async function handleRequestSegmentTranscriptionBackfillForTest(
  options: HandleWorkspaceRequestOptions & {
    readonly backfillRuntime?: WorkspaceBackfillRuntime;
    readonly voiceSettingsStore: VoiceSettingsStore;
  }
): Promise<z.infer<typeof workspaceRequestSegmentTranscriptionBackfillResponseSchema>> {
  return handleRequestSegmentTranscriptionBackfillCore(options);
}

export async function handleRequestSegmentSupplementTranscriptionBackfillForTest(
  options: HandleWorkspaceRequestOptions & {
    readonly backfillRuntime?: WorkspaceBackfillRuntime;
    readonly voiceSettingsStore: VoiceSettingsStore;
  }
): Promise<z.infer<typeof workspaceRequestSegmentSupplementTranscriptionBackfillResponseSchema>> {
  return handleRequestSegmentSupplementTranscriptionBackfillCore(options);
}

export async function handleRequestSegmentSpeechSynthesisForTest(
  options: HandleWorkspaceRequestOptions & {
    readonly speechSynthesisRuntime?: WorkspaceSpeechSynthesisRuntime;
    readonly voiceSettingsStore?: VoiceSettingsStore;
  }
): Promise<z.infer<typeof workspaceRequestSegmentSpeechSynthesisResponseSchema>> {
  return handleRequestSegmentSpeechSynthesisCore(options);
}

export async function handleRequestSegmentSupplementSpeechSynthesisForTest(
  options: HandleWorkspaceRequestOptions & {
    readonly speechSynthesisRuntime?: WorkspaceSpeechSynthesisRuntime;
    readonly voiceSettingsStore?: VoiceSettingsStore;
  }
): Promise<z.infer<typeof workspaceRequestSegmentSupplementSpeechSynthesisResponseSchema>> {
  return handleRequestSegmentSupplementSpeechSynthesisCore(options);
}

export async function handleRegenerateImportedSpeechSynthesisForTest(
  options: WorkspaceIpcBaseOptions & {
    readonly event: TrustedSenderEventAdapter;
    readonly handleStore?: WorkspaceHandleStore;
    readonly input: unknown;
    readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
    readonly speechSynthesisRuntime?: WorkspaceSpeechSynthesisRuntime;
    readonly voiceSettingsStore?: VoiceSettingsStore;
  }
): Promise<z.infer<typeof workspaceRegenerateImportedSpeechSynthesisResponseSchema>> {
  return handleRegenerateImportedSpeechSynthesisCore(options);
}

function saveTranscriptWithHandle(
  request: z.infer<typeof workspaceRecordingMarkdownSaveRequestSchema>,
  handle: RequiredWorkspaceHandle,
  assertUsable: AssertWorkspaceHandleUsable
): Promise<z.infer<typeof workspaceRecordingMarkdownSaveResponseSchema>> {
  return withUsableWorkspaceHandle(assertUsable, async () => {
    const result = await saveRecordingMarkdown({
      rootPath: handle.canonicalRoot,
      workspaceId: handle.workspaceId,
      memoryId: request.memoryId,
      segmentId: request.segmentId,
      fileName: 'transcript.md',
      markdown: request.markdown,
      assertWorkspaceUsable: assertUsable,
      ...(request.baselineTranscriptHash !== undefined
        ? {
            allowOverwrite: true,
            expectedTranscriptDigest: request.baselineTranscriptHash,
          }
        : {}),
      ...(request.baselineTiptapContentHash !== undefined
        ? { expectedTiptapContentHash: request.baselineTiptapContentHash }
        : {}),
      ...(request.tiptapJson ? { tiptapJson: request.tiptapJson } : {}),
    });
    return workspaceRecordingMarkdownSaveResponseSchema.parse(
      result.ok
        ? {
            ok: true,
            value: {
              memory: result.memory,
              saved: true,
              baselineTranscriptHash: transcriptDigest(request.markdown),
              baselineTiptapContentHash: result.baselineTiptapContentHash,
            },
          }
        : result
    );
  });
}

function saveSegmentSupplementTranscriptWithHandle(
  request: z.infer<typeof workspaceSegmentSupplementMarkdownSaveRequestSchema>,
  handle: RequiredWorkspaceHandle,
  assertUsable: AssertWorkspaceHandleUsable
): Promise<z.infer<typeof workspaceSegmentSupplementMarkdownSaveResponseSchema>> {
  return withUsableWorkspaceHandle(assertUsable, async () => {
    if (request.workspaceId !== handle.workspaceId) {
      return workspaceError(
        'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
        'Segment supplement transcript workspace does not match the active handle'
      );
    }
    const result = await saveSegmentSupplementMarkdown({
      rootPath: handle.canonicalRoot,
      workspaceId: request.workspaceId,
      memoryId: request.memoryId,
      segmentId: request.segmentId,
      supplementId: request.supplementId,
      markdown: request.markdown,
      assertWorkspaceUsable: assertUsable,
      ...(request.baselineTranscriptHash !== undefined
        ? {
            allowOverwrite: true,
            expectedTranscriptDigest: request.baselineTranscriptHash,
          }
        : {}),
      ...(request.baselineTiptapContentHash !== undefined
        ? { expectedTiptapContentHash: request.baselineTiptapContentHash }
        : {}),
      ...(request.tiptapJson ? { tiptapJson: request.tiptapJson } : {}),
    });
    return workspaceSegmentSupplementMarkdownSaveResponseSchema.parse(
      result.ok
        ? {
            ok: true,
            value: {
              memory: result.memory,
              segment: result.segment,
              supplement: result.supplement,
              saved: true,
              baselineTranscriptHash: transcriptDigest(request.markdown),
              baselineTiptapContentHash: result.baselineTiptapContentHash,
            },
          }
        : result
    );
  });
}

export async function handleSaveTranscriptForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceRecordingMarkdownSaveResponseSchema>> {
  return handleSaveTranscriptCore(options);
}

export async function handleSaveSegmentSupplementTranscriptForTest(
  options: HandleWorkspaceRequestOptions
): Promise<z.infer<typeof workspaceSegmentSupplementMarkdownSaveResponseSchema>> {
  return handleSaveSegmentSupplementTranscriptCore(options);
}

function closeRecordingTranscriptionCore({
  recordingTranscriptionSessions = defaultRecordingTranscriptionSessions,
  ...options
}: HandleRecordingTranscriptionControlOptions): Promise<
  z.infer<typeof workspaceRecordingTranscriptionControlResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_CLOSE_RECORDING_TRANSCRIPTION_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceRecordingTranscriptionCloseRequestSchema,
    invalidMessage: 'closeRecordingTranscription request is invalid',
    requireUsable: false,
    run: (request, _handle, _assertUsable, trustedSender) =>
      workspaceRecordingTranscriptionControlResponseSchema.parse(
        recordingTranscriptionSessions.close({
          recordingFlowSessionId: request.recordingFlowSessionId,
          recordingSessionId: request.recordingSessionId,
          revisionId: request.revisionId,
          senderKey: senderKeyFor(trustedSender),
          workspaceHandle: request.workspaceHandle,
        })
      ),
  });
}

function finishRecordingTranscriptionCore({
  recordingTranscriptionSessions = defaultRecordingTranscriptionSessions,
  ...options
}: HandleRecordingTranscriptionControlOptions): Promise<
  z.infer<typeof workspaceRecordingTranscriptionControlResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_FINISH_RECORDING_TRANSCRIPTION_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceRecordingTranscriptionCloseRequestSchema,
    invalidMessage: 'finishRecordingTranscription request is invalid',
    requireUsable: false,
    run: async (request, _handle, assertUsable, trustedSender) => {
      const identity = {
        recordingFlowSessionId: request.recordingFlowSessionId,
        recordingSessionId: request.recordingSessionId,
        revisionId: request.revisionId,
        senderKey: senderKeyFor(trustedSender),
        workspaceHandle: request.workspaceHandle,
      };
      const usable = assertUsable();
      if (!usable.ok) {
        recordingTranscriptionSessions.close(identity);
        return usable;
      }
      const response = await recordingTranscriptionSessions.finish(identity);
      return workspaceRecordingTranscriptionControlResponseSchema.parse(response);
    },
  });
}

export async function handleCloseRecordingTranscriptionForTest(
  options: HandleRecordingTranscriptionControlOptions
): Promise<z.infer<typeof workspaceRecordingTranscriptionControlResponseSchema>> {
  return closeRecordingTranscriptionCore(options);
}

export async function handleFinishRecordingTranscriptionForTest(
  options: HandleRecordingTranscriptionControlOptions
): Promise<z.infer<typeof workspaceRecordingTranscriptionControlResponseSchema>> {
  return finishRecordingTranscriptionCore(options);
}

export function registerWorkspaceIpc({
  appDataDir,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  tokenStore = createWorkspaceSelectionTokenStore(),
  handleStore = defaultHandleStore,
  fileTruthWatcher = defaultWorkspaceFileTruthWatcherRegistry,
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
  recordingTranscriptionSessions = defaultRecordingTranscriptionSessions,
  voiceSettingsStore,
  backfillRuntime = createWorkspaceBackfillRuntime({ voiceSettingsStore }),
  speechSynthesisRuntime = createWorkspaceSpeechSynthesisRuntime({ voiceSettingsStore }),
  voiceTranscriptionProbe = runDefaultVoiceTranscriptionProbe,
  voiceSpeechSynthesisProbe = runDefaultVoiceSpeechSynthesisProbe,
  openExternal = openSystemExternalUrl,
  showOpenDirectoryDialog = showSystemOpenDirectoryDialog,
  withDiagnostics = withDiagnosticSpan,
}: RegisterWorkspaceIpcOptions): void {
  const electronMain = requireElectronMainApi();
  const registerWorkspaceIpcHandler = (
    channel: string,
    handler: (event: TrustedSenderEventAdapter, input: unknown) => unknown
  ): void => {
    electronMain.ipcMain.handle(channel, (event, input) =>
      withDiagnostics(
        {
          area: 'workspace-ipc',
          event: 'request',
          fields: { channel },
        },
        () => handler(event as TrustedSenderEventAdapter, input)
      )
    );
  };
  type ReadyBackfillWorkspace = {
    readonly assertWorkspaceUsable: () => { readonly ok: true } | WorkspaceErrorEnvelope;
    readonly isCurrent: () => boolean;
    readonly rootPath: string;
    readonly workspaceHandle: string;
    readonly workspaceId: string;
  };
  let readyBackfillWorkspace: ReadyBackfillWorkspace | null = null;
  let readyBackfillGeneration = 0;
  let lastFiredBackfillReadyKey: string | null = null;
  let lastFiredSpeechSynthesisReadyKey: string | null = null;

  function voiceSettingsReadyForBackfill(): boolean {
    const settings = voiceSettingsStore.read();
    return (
      settings.enabled &&
      settings.apiKeyConfigured &&
      settings.lastTranscriptionValidationCode !== 'auth'
    );
  }

  function voiceSettingsReadyForSpeechSynthesis(): boolean {
    const settings = voiceSettingsStore.read();
    return (
      settings.enabled &&
      settings.apiKeyConfigured &&
      settings.lastSpeechSynthesisValidationCode !== 'auth'
    );
  }

  function maybeTriggerAutomaticBackfill(): void {
    if (!readyBackfillWorkspace || !voiceSettingsReadyForBackfill()) {
      return;
    }
    const readyKey = `${readyBackfillWorkspace.workspaceId}:${readyBackfillWorkspace.workspaceHandle}`;
    if (lastFiredBackfillReadyKey === readyKey) {
      return;
    }
    lastFiredBackfillReadyKey = readyKey;
    void backfillRuntime.enqueueAutomaticWorkspace(readyBackfillWorkspace);
  }

  function maybeTriggerAutomaticSpeechSynthesis({
    force = false,
  }: {
    readonly force?: boolean;
  } = {}): void {
    if (!readyBackfillWorkspace || !voiceSettingsReadyForSpeechSynthesis()) {
      return;
    }
    const readyKey = `${readyBackfillWorkspace.workspaceId}:${readyBackfillWorkspace.workspaceHandle}`;
    if (!force && lastFiredSpeechSynthesisReadyKey === readyKey) {
      return;
    }
    lastFiredSpeechSynthesisReadyKey = readyKey;
    void speechSynthesisRuntime.enqueueAutomaticWorkspace(readyBackfillWorkspace);
  }

  type ReadyWorkspaceOpenResponse =
    | WorkspaceInitializeResponse
    | WorkspaceOpenSystemDraftWorkspaceResponse;

  function rememberReadyBackfillWorkspace<Response extends ReadyWorkspaceOpenResponse>(
    event: TrustedSenderEventAdapter,
    channel: string,
    response: Response
  ): Response {
    if (!response.ok) {
      return response;
    }
    const trusted = validateWorkspaceSender({
      event,
      channel,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    });
    if (!trusted.ok) {
      return response;
    }
    const required = handleStore.requireHandle({
      workspaceHandle: response.value.workspaceHandle,
      sender: trusted.sender,
      workspaceId: response.value.workspaceId,
    });
    if (!required.ok) {
      return response;
    }
    const workspaceHandle = response.value.workspaceHandle;
    const workspaceId = response.value.workspaceId;
    const generation = (readyBackfillGeneration += 1);
    readyBackfillWorkspace = {
      assertWorkspaceUsable: required.handle.assertUsable,
      isCurrent: () =>
        readyBackfillWorkspace?.workspaceHandle === workspaceHandle &&
        readyBackfillWorkspace.workspaceId === workspaceId &&
        readyBackfillGeneration === generation,
      rootPath: required.handle.canonicalRoot,
      workspaceHandle,
      workspaceId,
    };
    fileTruthWatcher.watchWorkspace({
      rootPath: required.handle.canonicalRoot,
      sendEvent: (payload) => sendFileTruthChangedEvent(event, payload),
      workspaceHandle,
      workspaceId,
    });
    maybeTriggerAutomaticBackfill();
    maybeTriggerAutomaticSpeechSynthesis();
    return response;
  }

  function handleVoiceSettingsResult<Response extends { readonly ok: boolean }>(
    response: Response
  ): Response {
    if (response.ok) {
      maybeTriggerAutomaticBackfill();
      maybeTriggerAutomaticSpeechSynthesis({ force: true });
    }
    return response;
  }

  function afterOk<Response extends { readonly ok: boolean }>(
    response: Response,
    after: () => void
  ): Response {
    if (response.ok) {
      after();
    }
    return response;
  }
  registerWorkspaceIpcHandler(WORKSPACE_CHOOSE_DIRECTORY_CHANNEL, (event, input) =>
    handleChooseWorkspaceDirectory({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      tokenStore,
      showOpenDirectoryDialog,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_LIST_MEMORY_SPACES_CHANNEL, (event, input) =>
    handleListWorkspaceMemorySpaces({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      memorySpaceRegistry,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_READ_SYSTEM_DRAFT_WORKSPACE_CHANNEL, (event, input) =>
    handleReadSystemDraftWorkspace({
      ...(appDataDir ? { appDataDir } : {}),
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_OPEN_SYSTEM_DRAFT_WORKSPACE_CHANNEL, async (event, input) =>
    rememberReadyBackfillWorkspace(
      event,
      WORKSPACE_OPEN_SYSTEM_DRAFT_WORKSPACE_CHANNEL,
      await handleOpenSystemDraftWorkspace({
        ...(appDataDir ? { appDataDir } : {}),
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
      })
    )
  );
  registerWorkspaceIpcHandler(WORKSPACE_READ_RECENT_EXPRESSIONS_CHANNEL, (event, input) =>
    handleReadRecentExpressions({
      ...(appDataDir ? { appDataDir } : {}),
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      memorySpaceRegistry,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_READ_EXPRESSION_PLAYBACK_AUDIO_CHANNEL, (event, input) =>
    handleReadExpressionPlaybackAudio({
      ...(appDataDir ? { appDataDir } : {}),
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      memorySpaceRegistry,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_LIST_ENTITY_MOVE_TARGETS_CHANNEL, (event, input) =>
    handleListEntityMoveTargets({
      ...(appDataDir ? { appDataDir } : {}),
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      memorySpaceRegistry,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_INITIALIZE_CHANNEL, async (event, input) =>
    rememberReadyBackfillWorkspace(
      event,
      WORKSPACE_INITIALIZE_CHANNEL,
      await handleInitializeWorkspace({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        tokenStore,
        handleStore,
        memorySpaceRegistry,
      })
    )
  );
  registerWorkspaceIpcHandler(WORKSPACE_OPEN_CHANNEL, async (event, input) =>
    rememberReadyBackfillWorkspace(
      event,
      WORKSPACE_OPEN_CHANNEL,
      await handleOpenWorkspace({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        tokenStore,
        handleStore,
        memorySpaceRegistry,
      })
    )
  );
  registerWorkspaceIpcHandler(WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL, async (event, input) =>
    rememberReadyBackfillWorkspace(
      event,
      WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL,
      await handleOpenWorkspaceMemorySpace({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
        memorySpaceRegistry,
      })
    )
  );
  registerWorkspaceIpcHandler(WORKSPACE_REMOVE_MEMORY_SPACE_CHANNEL, (event, input) =>
    handleRemoveMemorySpace({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      memorySpaceRegistry,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_REVEAL_MEMORY_SPACE_IN_FINDER_CHANNEL, (event, input) =>
    handleRevealMemorySpaceInFinder({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      memorySpaceRegistry,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_OPEN_MEMORY_SPACE_AGENTS_FILE_CHANNEL, (event, input) =>
    handleOpenMemorySpaceAgentsFile({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      memorySpaceRegistry,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_COPY_MEMORY_SPACE_ABSOLUTE_PATH_CHANNEL, (event, input) =>
    handleCopyMemorySpaceAbsolutePath({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      memorySpaceRegistry,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_REVEAL_MEMORY_IN_FINDER_CHANNEL, (event, input) =>
    handleRevealMemoryInFinder({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_OPEN_MEMORY_DOCUMENT_CHANNEL, (event, input) =>
    handleOpenMemoryDocument({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_COPY_MEMORY_ABSOLUTE_PATH_CHANNEL, (event, input) =>
    handleCopyMemoryAbsolutePath({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_COPY_MEMORY_RELATIVE_PATH_CHANNEL, (event, input) =>
    handleCopyMemoryRelativePath({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_REVEAL_SEGMENT_IN_FINDER_CHANNEL, (event, input) =>
    handleRevealSegmentInFinder({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_OPEN_SEGMENT_DOCUMENT_CHANNEL, (event, input) =>
    handleOpenSegmentDocument({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_COPY_SEGMENT_ABSOLUTE_PATH_CHANNEL, (event, input) =>
    handleCopySegmentAbsolutePath({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_COPY_SEGMENT_RELATIVE_PATH_CHANNEL, (event, input) =>
    handleCopySegmentRelativePath({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_COPY_ARTIFACT_AGENT_PROMPT_CHANNEL, (event, input) =>
    handleCopyArtifactAgentPrompt({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_READ_ARTIFACT_RUNTIME_STATE_CHANNEL, (event, input) =>
    handleReadArtifactRuntimeStateCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_WRITE_ARTIFACT_RUNTIME_STATE_CHANNEL, (event, input) =>
    handleWriteArtifactRuntimeStateCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_COPY_NEEDS_REVIEW_AGENT_PROMPT_CHANNEL, (event, input) =>
    handleCopyNeedsReviewAgentPrompt({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_REVEAL_SEGMENT_SUPPLEMENT_IN_FINDER_CHANNEL,
    (event, input) =>
      handleRevealSegmentSupplementInFinder({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
      })
  );
  registerWorkspaceIpcHandler(WORKSPACE_OPEN_SEGMENT_SUPPLEMENT_DOCUMENT_CHANNEL, (event, input) =>
    handleOpenSegmentSupplementDocument({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_COPY_SEGMENT_SUPPLEMENT_ABSOLUTE_PATH_CHANNEL,
    (event, input) =>
      handleCopySegmentSupplementAbsolutePath({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
      })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_COPY_SEGMENT_SUPPLEMENT_RELATIVE_PATH_CHANNEL,
    (event, input) =>
      handleCopySegmentSupplementRelativePath({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
      })
  );
  registerWorkspaceIpcHandler(WORKSPACE_REVEAL_WIDGET_IN_FINDER_CHANNEL, (event, input) =>
    handleRevealWidgetInFinder({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_OPEN_WIDGET_DOCUMENT_CHANNEL, (event, input) =>
    handleOpenWidgetDocument({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_COPY_WIDGET_ABSOLUTE_PATH_CHANNEL, (event, input) =>
    handleCopyWidgetAbsolutePath({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_COPY_WIDGET_RELATIVE_PATH_CHANNEL, (event, input) =>
    handleCopyWidgetRelativePath({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_COPY_WIDGET_AGENT_PROMPT_CHANNEL, (event, input) =>
    handleCopyWidgetAgentPrompt({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_UPDATE_MEMORY_SPACE_TITLE_CHANNEL, (event, input) =>
    handleUpdateMemorySpaceTitle({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      memorySpaceRegistry,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_BEGIN_MICROPHONE_INTENT_CHANNEL, (event, input) =>
    handleBeginMicrophoneIntent({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      recordingTranscriptionSessions,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_CLEAR_MICROPHONE_INTENT_CHANNEL, (event, input) =>
    handleClearMicrophoneIntent({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      recordingTranscriptionSessions,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_START_RECORDING_TRANSCRIPTION_CHANNEL, (event, input) =>
    withWorkspaceHandleRequest({
      event,
      input,
      channel: WORKSPACE_START_RECORDING_TRANSCRIPTION_CHANNEL,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      schema: workspaceRecordingTranscriptionStartRequestSchema,
      invalidMessage: 'startRecordingTranscription request is invalid',
      run: (request, _handle, assertUsable, trustedSender) =>
        withUsableWorkspaceHandle(assertUsable, () =>
          recordingTranscriptionSessions.start({
            recordingFlowSessionId: request.recordingFlowSessionId,
            recordingSessionId: request.recordingSessionId,
            revisionId: request.revisionId,
            sendEvent: (payload) => sendRecordingTranscriptionEvent(event, payload),
            senderKey: senderKeyFor(trustedSender),
            timeOffsetMs: request.timeOffsetMs,
            workspaceHandle: request.workspaceHandle,
          })
        ),
    })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_SEND_RECORDING_TRANSCRIPTION_AUDIO_CHANNEL,
    (event, input) =>
      withWorkspaceHandleRequest({
        event,
        input,
        channel: WORKSPACE_SEND_RECORDING_TRANSCRIPTION_AUDIO_CHANNEL,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
        schema: workspaceRecordingTranscriptionAudioRequestSchema,
        invalidMessage: 'sendRecordingTranscriptionAudio request is invalid',
        run: (request, _handle, assertUsable, trustedSender) =>
          withUsableWorkspaceHandle(assertUsable, () =>
            workspaceRecordingTranscriptionControlResponseSchema.parse(
              recordingTranscriptionSessions.sendAudio({
                audio: request.chunk,
                recordingFlowSessionId: request.recordingFlowSessionId,
                recordingSessionId: request.recordingSessionId,
                revisionId: request.revisionId,
                senderKey: senderKeyFor(trustedSender),
                workspaceHandle: request.workspaceHandle,
              })
            )
          ),
      })
  );
  registerWorkspaceIpcHandler(WORKSPACE_FINISH_RECORDING_TRANSCRIPTION_CHANNEL, (event, input) =>
    finishRecordingTranscriptionCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      recordingTranscriptionSessions,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_CLOSE_RECORDING_TRANSCRIPTION_CHANNEL, (event, input) =>
    closeRecordingTranscriptionCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      recordingTranscriptionSessions,
    })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_REQUEST_SEGMENT_TRANSCRIPTION_BACKFILL_CHANNEL,
    (event, input) =>
      handleRequestSegmentTranscriptionBackfillCore({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
        backfillRuntime,
        voiceSettingsStore,
      })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_REQUEST_SEGMENT_SUPPLEMENT_TRANSCRIPTION_BACKFILL_CHANNEL,
    (event, input) =>
      handleRequestSegmentSupplementTranscriptionBackfillCore({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
        backfillRuntime,
        voiceSettingsStore,
      })
  );
  registerWorkspaceIpcHandler(WORKSPACE_REQUEST_SEGMENT_SPEECH_SYNTHESIS_CHANNEL, (event, input) =>
    handleRequestSegmentSpeechSynthesisCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      speechSynthesisRuntime,
      voiceSettingsStore,
    })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_REQUEST_SEGMENT_SUPPLEMENT_SPEECH_SYNTHESIS_CHANNEL,
    (event, input) =>
      handleRequestSegmentSupplementSpeechSynthesisCore({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
        speechSynthesisRuntime,
        voiceSettingsStore,
      })
  );
  registerWorkspaceIpcHandler(WORKSPACE_READ_VOICE_TRANSCRIPTION_SETTINGS_CHANNEL, (event, input) =>
    handleReadVoiceTranscriptionSettingsCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      store: voiceSettingsStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_READ_APP_PERMISSION_STATUS_CHANNEL, (event, input) =>
    handleReadAppPermissionStatusCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_REQUEST_APP_PERMISSION_CHANNEL, (event, input) =>
    handleRequestAppPermissionCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL, (event, input) =>
    handleSetVoiceTranscriptionEnabledCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      store: voiceSettingsStore,
    }).then(handleVoiceSettingsResult)
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_SET_VOICE_SPEECH_SYNTHESIS_SPEAKER_CHANNEL,
    (event, input) =>
      handleSetVoiceSpeechSynthesisSpeakerCore({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        speechSynthesisProbe: voiceSpeechSynthesisProbe,
        store: voiceSettingsStore,
      }).then(handleVoiceSettingsResult)
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_REGENERATE_IMPORTED_SPEECH_SYNTHESIS_CHANNEL,
    (event, input) =>
      handleRegenerateImportedSpeechSynthesisCore({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
        memorySpaceRegistry,
        speechSynthesisRuntime,
        voiceSettingsStore,
      })
  );
  registerWorkspaceIpcHandler(WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL, (event, input) =>
    handleSaveVoiceTranscriptionApiKeyCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      store: voiceSettingsStore,
      probe: voiceTranscriptionProbe,
      speechSynthesisProbe: voiceSpeechSynthesisProbe,
    }).then(handleVoiceSettingsResult)
  );
  registerWorkspaceIpcHandler(WORKSPACE_CLEAR_VOICE_TRANSCRIPTION_API_KEY_CHANNEL, (event, input) =>
    handleClearVoiceTranscriptionApiKeyCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      store: voiceSettingsStore,
    }).then(handleVoiceSettingsResult)
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_VALIDATE_VOICE_TRANSCRIPTION_CREDENTIALS_CHANNEL,
    (event, input) =>
      handleValidateVoiceTranscriptionCredentialsCore({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        store: voiceSettingsStore,
        probe: voiceTranscriptionProbe,
        speechSynthesisProbe: voiceSpeechSynthesisProbe,
      }).then(handleVoiceSettingsResult)
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_OPEN_VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_CHANNEL,
    (event, input) =>
      handleOpenVoiceTranscriptionProviderConsoleCore({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        openExternal,
      })
  );
  registerWorkspaceIpcHandler(WORKSPACE_OPEN_MARKDOWN_EXTERNAL_LINK_CHANNEL, (event, input) =>
    handleOpenMarkdownExternalLinkCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      openExternal,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL, (event, input) =>
    handleUpdateMemoryTitle({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_UPDATE_SEGMENT_TITLE_CHANNEL, (event, input) =>
    handleUpdateSegmentTitle({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_UPDATE_SEGMENT_CONTENT_TITLE_CHANNEL, (event, input) =>
    handleUpdateSegmentContentTitle({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_UPDATE_SEGMENT_SUPPLEMENT_TITLE_CHANNEL, (event, input) =>
    handleUpdateSegmentSupplementTitle({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_UPDATE_SEGMENT_CONTENT_TAB_ORDER_CHANNEL, (event, input) =>
    handleUpdateSegmentContentTabOrder({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_UPDATE_WIDGET_TITLE_CHANNEL, (event, input) =>
    handleUpdateWidgetTitle({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_UPDATE_WIDGET_TAB_ORDER_CHANNEL, (event, input) =>
    handleUpdateWidgetTabOrder({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_CREATE_MEMORY_CHANNEL, (event, input) =>
    handleCreateMemory({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_DELETE_MEMORY_CHANNEL, (event, input) =>
    handleDeleteMemory({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_MOVE_MEMORY_CHANNEL, (event, input) =>
    handleMoveMemory({
      ...(appDataDir ? { appDataDir } : {}),
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      memorySpaceRegistry,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_RESTORE_DELETED_MEMORY_CHANNEL, (event, input) =>
    handleRestoreDeletedMemory({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_RESET_MEMORY_COVER_CHANNEL, (event, input) =>
    handleResetMemoryCover({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_RESTORE_MEMORY_COVER_CHANNEL, (event, input) =>
    handleRestoreMemoryCover({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_SWITCH_MEMORY_DEFAULT_COVER_CHANNEL, (event, input) =>
    handleSwitchMemoryDefaultCover({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_RESET_SEGMENT_COVER_CHANNEL, (event, input) =>
    handleResetSegmentCover({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_RESTORE_SEGMENT_COVER_CHANNEL, (event, input) =>
    handleRestoreSegmentCover({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_SWITCH_SEGMENT_DEFAULT_COVER_CHANNEL, (event, input) =>
    handleSwitchSegmentDefaultCover({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_DELETE_SEGMENT_CHANNEL, (event, input) =>
    handleDeleteSegment({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_MOVE_SEGMENT_CHANNEL, (event, input) =>
    handleMoveSegment({
      ...(appDataDir ? { appDataDir } : {}),
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      memorySpaceRegistry,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_RESTORE_DELETED_SEGMENT_CHANNEL, (event, input) =>
    handleRestoreDeletedSegment({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_DELETE_SEGMENT_SUPPLEMENT_CHANNEL, (event, input) =>
    handleDeleteSegmentSupplement({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_MOVE_SEGMENT_SUPPLEMENT_CHANNEL, (event, input) =>
    handleMoveSegmentSupplement({
      ...(appDataDir ? { appDataDir } : {}),
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      memorySpaceRegistry,
    })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_RESTORE_DELETED_SEGMENT_SUPPLEMENT_CHANNEL,
    (event, input) =>
      handleRestoreDeletedSegmentSupplement({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
      })
  );
  registerWorkspaceIpcHandler(WORKSPACE_DELETE_WIDGET_CHANNEL, (event, input) =>
    handleDeleteWidget({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_RESTORE_DELETED_WIDGET_CHANNEL, (event, input) =>
    handleRestoreDeletedWidget({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_READ_MEMORY_DETAIL_CHANNEL, (event, input) =>
    handleReadMemoryDetail({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_CHANNEL, (event, input) =>
    handleReadFinalizedAudioSegment({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_SUPPLEMENT_CHANNEL,
    (event, input) =>
      handleReadFinalizedAudioSegmentSupplement({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
      })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_AUDIO_CHANNEL,
    (event, input) =>
      handleReadFinalizedAudioSegmentAudio({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
      })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_SUPPLEMENT_AUDIO_CHANNEL,
    (event, input) =>
      handleReadFinalizedAudioSegmentSupplementAudio({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
      })
  );
  registerWorkspaceIpcHandler(WORKSPACE_CLOSE_CHANNEL, (event, input) =>
    handleCloseWorkspace({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      backfillRuntime,
      speechSynthesisRuntime,
      handleStore,
      onBeforeBackfillCancel: (workspaceHandle) => {
        if (readyBackfillWorkspace && readyBackfillWorkspace.workspaceHandle !== workspaceHandle) {
          return false;
        }
        readyBackfillGeneration += 1;
        readyBackfillWorkspace = null;
        lastFiredBackfillReadyKey = null;
        lastFiredSpeechSynthesisReadyKey = null;
        return true;
      },
      onWorkspaceClosed: (workspaceHandle) => fileTruthWatcher.closeWorkspace(workspaceHandle),
      recordingTranscriptionSessions,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_READ_WORKSPACE_SNAPSHOT_CHANNEL, (event, input) =>
    handleReadWorkspaceSnapshot({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );

  function registerWorkspaceHandleRequest<
    Schema extends z.ZodType<WorkspaceHandleRequestData>,
    Result,
  >(
    channel: string,
    schema: Schema,
    invalidMessage: string,
    run: (
      data: z.infer<Schema>,
      handle: RequiredWorkspaceHandle,
      assertUsable: AssertWorkspaceHandleUsable
    ) => MaybePromise<Result | WorkspaceErrorEnvelope>
  ): void {
    registerWorkspaceIpcHandler(channel, (event, input) =>
      withWorkspaceHandleRequest({
        event,
        input,
        channel,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
        schema,
        invalidMessage,
        run,
      })
    );
  }

  registerWorkspaceIpcHandler(WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL, (event, input) =>
    handleCreateRecordingDraft({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    }).then((response) =>
      afterOk(response, () => {
        backfillRuntime.pause('recording');
        speechSynthesisRuntime.pause('recording');
      })
    )
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
    (event, input) =>
      handleCreateSegmentSupplementRecordingDraft({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
      }).then((response) =>
        afterOk(response, () => {
          backfillRuntime.pause('recording');
          speechSynthesisRuntime.pause('recording');
        })
      )
  );
  registerWorkspaceIpcHandler(WORKSPACE_CREATE_NOTE_SEGMENT_DRAFT_CHANNEL, (event, input) =>
    handleCreateNoteSegmentDraft({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_CHANNEL,
    (event, input) =>
      handleCreateSegmentSupplementNoteDraft({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_WRITE_NOTE_SEGMENT_DRAFT_BODY_CHANNEL,
    workspaceWriteNoteSegmentDraftBodyRequestSchema,
    'writeNoteSegmentDraftBody request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await writeNoteSegmentDraftBody({
          rootPath: handle.canonicalRoot,
          segmentId: request.segmentId,
          bodyMarkdown: request.bodyMarkdown,
          ...(request.bodyTiptapJson ? { bodyTiptapJson: request.bodyTiptapJson } : {}),
          revision: request.revision,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceWriteNoteSegmentDraftBodyResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: { bodyByteLength: result.bodyByteLength, revision: result.revision },
              }
            : result
        );
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_WRITE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_BODY_CHANNEL,
    workspaceWriteSegmentSupplementNoteDraftBodyRequestSchema,
    'writeSegmentSupplementNoteDraftBody request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await writeSegmentSupplementNoteDraftBody({
          rootPath: handle.canonicalRoot,
          supplementId: request.supplementId,
          bodyMarkdown: request.bodyMarkdown,
          ...(request.bodyTiptapJson ? { bodyTiptapJson: request.bodyTiptapJson } : {}),
          revision: request.revision,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceWriteSegmentSupplementNoteDraftBodyResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: { bodyByteLength: result.bodyByteLength, revision: result.revision },
              }
            : result
        );
      })
  );
  registerWorkspaceIpcHandler(WORKSPACE_FINALIZE_NOTE_SEGMENT_DRAFT_CHANNEL, (event, input) =>
    handleFinalizeNoteSegmentDraftCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      now: nowIso,
    }).then((response) =>
      afterOk(response, () => maybeTriggerAutomaticSpeechSynthesis({ force: true }))
    )
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_FINALIZE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_CHANNEL,
    (event, input) =>
      handleFinalizeSegmentSupplementNoteDraftCore({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
        now: nowIso,
      }).then((response) =>
        afterOk(response, () => maybeTriggerAutomaticSpeechSynthesis({ force: true }))
      )
  );
  registerWorkspaceIpcHandler(WORKSPACE_READ_SEGMENT_CONTENT_CHANNEL, (event, input) =>
    handleReadSegmentContentCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_READ_SEGMENT_SUPPLEMENT_CONTENT_CHANNEL, (event, input) =>
    handleReadSegmentSupplementContentCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_READ_SEGMENT_SPEECH_AUDIO_CHANNEL, (event, input) =>
    handleReadSegmentSpeechAudioCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_READ_SEGMENT_SUPPLEMENT_SPEECH_AUDIO_CHANNEL,
    (event, input) =>
      handleReadSegmentSupplementSpeechAudioCore({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
      })
  );
  registerWorkspaceIpcHandler(WORKSPACE_WRITE_SEGMENT_CONTENT_CHANNEL, (event, input) =>
    handleWriteSegmentContentCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      now: nowIso,
    }).then((response) =>
      afterOk(response, () => maybeTriggerAutomaticSpeechSynthesis({ force: true }))
    )
  );
  registerWorkspaceIpcHandler(WORKSPACE_WRITE_SEGMENT_SUPPLEMENT_CONTENT_CHANNEL, (event, input) =>
    handleWriteSegmentSupplementContentCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      now: nowIso,
    }).then((response) =>
      afterOk(response, () => maybeTriggerAutomaticSpeechSynthesis({ force: true }))
    )
  );
  registerWorkspaceIpcHandler(WORKSPACE_SAVE_SEGMENT_ATTACHMENT_CHANNEL, (event, input) =>
    handleSaveSegmentAttachmentCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_LIST_SEGMENT_ATTACHMENTS_CHANNEL, (event, input) =>
    handleListSegmentAttachmentsCore({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_ATTACHMENT_CHANNEL,
    (event, input) =>
      handleSaveSegmentSupplementAttachmentCore({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
      })
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_LIST_SEGMENT_SUPPLEMENT_ATTACHMENTS_CHANNEL,
    (event, input) =>
      handleListSegmentSupplementAttachmentsCore({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_READ_RECORDING_DRAFT_AUDIO_CHANNEL,
    workspaceRecordingDraftAudioRequestSchema,
    'readRecordingDraftAudio request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await readRecordingDraftAudio({
          ...(request.maxBytes !== undefined ? { maxBytes: request.maxBytes } : {}),
          rootPath: handle.canonicalRoot,
          segmentId: request.segmentId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceRecordingDraftAudioResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  audio: result.audio,
                  audioByteLength: result.audioByteLength,
                  nextSequence: result.nextSequence,
                },
              }
            : result
        );
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
    workspaceRecordingAppendRequestSchema,
    'appendRecordingAudioChunk request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await appendRecordingAudioChunk({
          rootPath: handle.canonicalRoot,
          segmentId: request.segmentId,
          sequence: request.sequence,
          chunk: request.chunk,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceRecordingAppendResponseSchema.parse(
          result.ok ? { ok: true, value: { nextSequence: result.nextSequence } } : result
        );
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_APPEND_SEGMENT_SUPPLEMENT_RECORDING_AUDIO_CHUNK_CHANNEL,
    workspaceAppendSegmentSupplementRecordingAudioRequestSchema,
    'appendSegmentSupplementRecordingAudioChunk request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await appendSegmentSupplementRecordingAudioChunk({
          rootPath: handle.canonicalRoot,
          supplementId: request.supplementId,
          sequence: request.sequence,
          chunk: request.chunk,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceSegmentSupplementRecordingAppendResponseSchema.parse(
          result.ok ? { ok: true, value: { nextSequence: result.nextSequence } } : result
        );
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_CLONE_RECORDING_DRAFT_PREFIX_CHANNEL,
    workspaceRecordingDraftPrefixCloneRequestSchema,
    'cloneRecordingDraftPrefix request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await cloneRecordingDraftPrefix({
          rootPath: handle.canonicalRoot,
          sourceSegmentId: request.sourceSegmentId,
          targetSegmentId: request.targetSegmentId,
          retainedByteLength: request.retainedByteLength,
          nextSequence: request.nextSequence,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceRecordingDraftPrefixCloneResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  audioByteLength: result.audioByteLength,
                  nextSequence: result.nextSequence,
                },
              }
            : result
        );
      })
  );
  registerWorkspaceIpcHandler(WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL, (event, input) =>
    handleFinalizeRecordingDraft({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      now: nowIso,
    }).then((response) =>
      afterOk(response, () => {
        backfillRuntime.resume('recording');
        speechSynthesisRuntime.resume('recording');
      })
    )
  );
  registerWorkspaceIpcHandler(
    WORKSPACE_FINALIZE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
    (event, input) =>
      handleFinalizeSegmentSupplementRecordingDraft({
        event,
        input,
        expectedSession,
        expectedSessionKey,
        isTrustedUrl,
        handleStore,
        now: nowIso,
      }).then((response) =>
        afterOk(response, () => {
          backfillRuntime.resume('recording');
          speechSynthesisRuntime.resume('recording');
        })
      )
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
    workspaceSegmentIdRequestSchema,
    'discardRecordingDraft request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await discardRecordingDraft({
          rootPath: handle.canonicalRoot,
          segmentId: request.segmentId,
          assertWorkspaceUsable: assertUsable,
        });
        const response = workspaceDiscardRecordingDraftResponseSchema.parse(
          result.ok ? { ok: true, value: { discarded: true } } : result
        );
        if (response.ok) {
          backfillRuntime.resume('recording');
          speechSynthesisRuntime.resume('recording');
        }
        return response;
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_DISCARD_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
    workspaceSegmentSupplementIdRequestSchema,
    'discardSegmentSupplementRecordingDraft request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await discardSegmentSupplementRecordingDraft({
          rootPath: handle.canonicalRoot,
          supplementId: request.supplementId,
          assertWorkspaceUsable: assertUsable,
        });
        const response = workspaceDiscardRecordingDraftResponseSchema.parse(
          result.ok ? { ok: true, value: { discarded: true } } : result
        );
        if (response.ok) {
          backfillRuntime.resume('recording');
          speechSynthesisRuntime.resume('recording');
        }
        return response;
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_SAVE_TRANSCRIPT_CHANNEL,
    workspaceRecordingMarkdownSaveRequestSchema,
    'save transcript request is invalid',
    saveTranscriptWithHandle
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_TRANSCRIPT_CHANNEL,
    workspaceSegmentSupplementMarkdownSaveRequestSchema,
    'save segment supplement transcript request is invalid',
    saveSegmentSupplementTranscriptWithHandle
  );
}

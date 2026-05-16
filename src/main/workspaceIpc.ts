import { randomUUID } from 'node:crypto';
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
  WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_APPEND_SEGMENT_SUPPLEMENT_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_CLONE_RECORDING_DRAFT_PREFIX_CHANNEL,
  WORKSPACE_COPY_MEMORY_ABSOLUTE_PATH_CHANNEL,
  WORKSPACE_COPY_MEMORY_SPACE_ABSOLUTE_PATH_CHANNEL,
  WORKSPACE_COPY_MEMORY_RELATIVE_PATH_CHANNEL,
  WORKSPACE_COPY_SEGMENT_ABSOLUTE_PATH_CHANNEL,
  WORKSPACE_COPY_SEGMENT_RELATIVE_PATH_CHANNEL,
  WORKSPACE_COPY_SEGMENT_SUPPLEMENT_ABSOLUTE_PATH_CHANNEL,
  WORKSPACE_COPY_SEGMENT_SUPPLEMENT_RELATIVE_PATH_CHANNEL,
  WORKSPACE_CREATE_MEMORY_CHANNEL,
  WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DELETE_MEMORY_CHANNEL,
  WORKSPACE_DELETE_SEGMENT_SUPPLEMENT_CHANNEL,
  WORKSPACE_DELETE_SEGMENT_CHANNEL,
  WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DISCARD_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_FINISH_RECORDING_TRANSCRIPTION_CHANNEL,
  WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_FINALIZE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_INITIALIZE_CHANNEL,
  WORKSPACE_IPC_CHANNELS,
  WORKSPACE_LIST_MEMORY_SPACES_CHANNEL,
  WORKSPACE_OPEN_CHANNEL,
  WORKSPACE_OPEN_MEMORY_DOCUMENT_CHANNEL,
  WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL,
  WORKSPACE_OPEN_MEMORY_SPACE_AGENTS_FILE_CHANNEL,
  WORKSPACE_OPEN_SEGMENT_DOCUMENT_CHANNEL,
  WORKSPACE_OPEN_SEGMENT_SUPPLEMENT_DOCUMENT_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_SUPPLEMENT_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_CHANNEL,
  WORKSPACE_READ_MEMORY_DETAIL_CHANNEL,
  WORKSPACE_READ_RECORDING_DRAFT_AUDIO_CHANNEL,
  WORKSPACE_READ_WORKSPACE_SNAPSHOT_CHANNEL,
  WORKSPACE_REVEAL_MEMORY_IN_FINDER_CHANNEL,
  WORKSPACE_REVEAL_MEMORY_SPACE_IN_FINDER_CHANNEL,
  WORKSPACE_REVEAL_SEGMENT_IN_FINDER_CHANNEL,
  WORKSPACE_REVEAL_SEGMENT_SUPPLEMENT_IN_FINDER_CHANNEL,
  WORKSPACE_REMOVE_MEMORY_SPACE_CHANNEL,
  WORKSPACE_RESTORE_DELETED_MEMORY_CHANNEL,
  WORKSPACE_RESTORE_DELETED_SEGMENT_SUPPLEMENT_CHANNEL,
  WORKSPACE_RESTORE_DELETED_SEGMENT_CHANNEL,
  WORKSPACE_RECORDING_TRANSCRIPTION_EVENT_CHANNEL,
  WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_TRANSCRIPT_CHANNEL,
  WORKSPACE_SAVE_TRANSCRIPT_CHANNEL,
  WORKSPACE_SEND_RECORDING_TRANSCRIPTION_AUDIO_CHANNEL,
  WORKSPACE_START_RECORDING_TRANSCRIPTION_CHANNEL,
  WORKSPACE_UPDATE_MEMORY_SPACE_TITLE_CHANNEL,
  WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_SUPPLEMENT_TITLE_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_TITLE_CHANNEL,
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
  workspaceCreateRecordingDraftResponseSchema,
  workspaceCreateSegmentSupplementRecordingDraftRequestSchema,
  workspaceCreateSegmentSupplementRecordingDraftResponseSchema,
  workspaceDiscardRecordingDraftResponseSchema,
  workspaceError,
  workspaceInitializeRequestSchema,
  workspaceInitializeResponseSchema,
  workspaceListMemorySpacesResponseSchema,
  workspaceMicrophoneIntentRequestSchema,
  workspaceMicrophoneIntentResponseSchema,
  workspaceClearMicrophoneIntentResponseSchema,
  workspaceNoInputSchema,
  workspaceOpenRequestSchema,
  workspaceOpenMemoryDocumentRequestSchema,
  workspaceOpenMemorySpaceRequestSchema,
  workspaceOpenMemorySpaceAgentsFileRequestSchema,
  workspaceOpenSegmentDocumentRequestSchema,
  workspaceOpenSegmentSupplementDocumentRequestSchema,
  workspaceCopyMemoryAbsolutePathRequestSchema,
  workspaceCopyMemorySpaceAbsolutePathRequestSchema,
  workspaceCopyMemoryRelativePathRequestSchema,
  workspaceCopySegmentAbsolutePathRequestSchema,
  workspaceCopySegmentRelativePathRequestSchema,
  workspaceCopySegmentSupplementAbsolutePathRequestSchema,
  workspaceCopySegmentSupplementRelativePathRequestSchema,
  workspaceReadFinalizedAudioSegmentRequestSchema,
  workspaceReadFinalizedAudioSegmentResponseSchema,
  workspaceReadFinalizedAudioSegmentSupplementRequestSchema,
  workspaceReadFinalizedAudioSegmentSupplementResponseSchema,
  workspaceReadMemoryDetailRequestSchema,
  workspaceReadMemoryDetailResponseSchema,
  workspaceReadWorkspaceSnapshotRequestSchema,
  workspaceReadWorkspaceSnapshotResponseSchema,
  workspaceRevealMemoryInFinderRequestSchema,
  workspaceRevealMemorySpaceInFinderRequestSchema,
  workspaceRevealSegmentInFinderRequestSchema,
  workspaceRevealSegmentSupplementInFinderRequestSchema,
  workspaceRemoveMemorySpaceRequestSchema,
  workspaceRemoveMemorySpaceResponseSchema,
  workspaceRecordingAppendRequestSchema,
  workspaceRecordingAppendResponseSchema,
  workspaceRestoreDeletedMemoryRequestSchema,
  workspaceRestoreDeletedMemoryResponseSchema,
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
  workspaceSegmentIdRequestSchema,
  workspaceSegmentSupplementIdRequestSchema,
  workspaceSegmentSupplementMarkdownSaveRequestSchema,
  workspaceSegmentSupplementMarkdownSaveResponseSchema,
  workspaceRecordingMarkdownSaveRequestSchema,
  workspaceRecordingMarkdownSaveResponseSchema,
  workspaceHandleRequestSchema,
  workspaceUpdateActiveMemorySpaceTitleRequestSchema,
  workspaceUpdateMemorySpaceTitleRequestSchema,
  workspaceUpdateMemorySpaceTitleResponseSchema,
  workspaceUpdateMemoryTitleRequestSchema,
  workspaceUpdateMemoryTitleResponseSchema,
  workspaceUpdateSegmentSupplementTitleRequestSchema,
  workspaceUpdateSegmentSupplementTitleResponseSchema,
  workspaceUpdateSegmentTitleRequestSchema,
  workspaceUpdateSegmentTitleResponseSchema,
  workspaceEntityActionResponseSchema,
  type WorkspaceEntityActionResponse,
  type WorkspaceInitializeResponse,
  type WorkspaceChooseDirectoryResponse,
  type WorkspaceErrorEnvelope,
  type WorkspaceSnapshot,
} from '../workspace-contract/workspace-contract.js';
import { createWorkspaceHandleStore, type WorkspaceHandleStore } from './workspaceHandles.js';
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
  readFinalizedAudioSegmentContent,
  readFinalizedAudioSegmentSupplementContent,
  readRecordingDraftAudio,
  saveRecordingMarkdown,
  saveSegmentSupplementMarkdown,
} from './recordingDrafts.js';
import {
  createMemoryFromFileTruth,
  deleteMemoryFromFileTruth,
  deleteSegmentSupplementFromFileTruth,
  deleteSegmentFromFileTruth,
  readMemoryDetailFromFileTruth,
  restoreDeletedMemoryFromFileTruth,
  restoreDeletedSegmentSupplementFromFileTruth,
  restoreDeletedSegmentFromFileTruth,
  updateMemoryTitleFromFileTruth,
  updateSegmentSupplementTitleFromFileTruth,
  updateSegmentTitleFromFileTruth,
} from './memoryFiles.js';
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

const nodeRequire = createRequire(import.meta.url);
const { app, clipboard, dialog, ipcMain, shell } = nodeRequire('electron') as Partial<
  typeof import('electron')
>;
const defaultHandleStore = createWorkspaceHandleStore();
let defaultMemorySpaceRegistry: WorkspaceMemorySpaceRegistry | null = null;
const defaultRecordingTranscriptionSessions = createRecordingTranscriptionSessionRegistry();

interface ShowOpenDirectoryDialogResult {
  readonly canceled: boolean;
  readonly filePaths: readonly string[];
}

type ShowOpenDirectoryDialog = () => Promise<ShowOpenDirectoryDialogResult>;
type ShowItemInFolder = (filePath: string) => void;
type OpenPath = (filePath: string) => Promise<string>;
type WriteClipboardText = (text: string) => void;
type ResolveMemorySpacePaths = (
  workspaceId: string,
  deps?: {
    readonly registry?: WorkspaceMemorySpaceRegistry;
    readonly fs?: FsProbe;
    readonly requireAgentsFile?: boolean;
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
  readonly expectedSession: Session | object;
  readonly expectedSessionKey: string;
  readonly isTrustedUrl: (url: string) => boolean;
  readonly tokenStore?: WorkspaceSelectionTokenStore;
  readonly handleStore?: WorkspaceHandleStore;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
  readonly recordingTranscriptionSessions?: RecordingTranscriptionSessionRegistry;
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
  readonly handleStore?: WorkspaceHandleStore;
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

export type HandleUpdateSegmentSupplementTitleOptions = HandleWorkspaceRequestOptions;

export interface HandleCreateMemoryOptions extends HandleWorkspaceRequestOptions {
  readonly createMemoryId?: () => string;
  readonly now?: () => string;
}

export interface HandleCreateRecordingDraftOptions extends HandleWorkspaceRequestOptions {
  readonly createSegmentId?: () => string;
  readonly now?: () => string;
}

export interface HandleCreateSegmentSupplementRecordingDraftOptions extends HandleWorkspaceRequestOptions {
  readonly createSupplementId?: () => string;
  readonly now?: () => string;
}

export interface HandleFinalizeSegmentSupplementRecordingDraftOptions extends HandleWorkspaceRequestOptions {
  readonly now?: () => string;
}

export type HandleRecordingTranscriptionControlOptions = HandleWorkspaceRequestOptions;

type HandleInitializeWorkspaceForTestOptions = HandleInitializeWorkspaceOptions & {
  readonly afterWorkspaceLockAcquiredForTest?: () => MaybePromise<void>;
};

type HandleListWorkspaceMemorySpacesOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
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
    resolveFailureMessage: 'Memory space AGENTS.md path could not be resolved',
    resolve: (request, memorySpaceRegistry) =>
      resolver(request.workspaceId, {
        registry: memorySpaceRegistry,
        requireAgentsFile: true,
        ...(fs ? { fs } : {}),
      }),
    run: (paths) =>
      openEntityDocument({
        fs: entityActionFsForResolver(fs, resolver, resolveMemorySpacePaths),
        paths: { documentAbsolute: paths.agentsFileAbsolute },
        missingCode: 'ERR_MEMORY_SPACE_AGENTS_FILE_MISSING',
        missingMessage: 'Memory space AGENTS.md is missing',
        unsafeMessage: 'Memory space AGENTS.md path is unsafe',
        openPath,
        failureMessage: 'Memory space AGENTS.md could not be opened',
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
          persistMemorySpaceTitleUpdate({
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
  await defaultHandleStore.closeAllHandles();
  clearRecordingRuntimeState();
}

function createWorkspaceId(): string {
  return `ws_${randomUUID()}`;
}

function createSegmentId(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `seg_${timestamp}_${randomUUID().slice(0, 8)}`;
}

function createSupplementId(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `sup_${timestamp}_${randomUUID().slice(0, 8)}`;
}

function createMemoryId(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `mem_${timestamp}_${randomUUID().slice(0, 8)}`;
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

function sendRecordingTranscriptionEvent(
  event: TrustedSenderEventAdapter,
  payload: z.infer<typeof workspaceRecordingTranscriptionEventSchema>
): void {
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
  const parsedPayload = workspaceRecordingTranscriptionEventSchema.parse(payload);
  try {
    sender.send(WORKSPACE_RECORDING_TRANSCRIPTION_EVENT_CHANNEL, parsedPayload);
  } catch (sendError) {
    if (typeof sender.isDestroyed === 'function' && sender.isDestroyed()) {
      return;
    }
    throw sendError;
  }
}

export function sendRecordingTranscriptionEventForTest(
  event: TrustedSenderEventAdapter,
  payload: z.infer<typeof workspaceRecordingTranscriptionEventSchema>
): void {
  sendRecordingTranscriptionEvent(event, payload);
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

type EntityActionMissingPathCode =
  | 'ERR_WORKSPACE_ROOT_MISSING'
  | 'ERR_WORKSPACE_MEMORY_NOT_FOUND'
  | 'ERR_WORKSPACE_SEGMENT_NOT_FOUND'
  | 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND'
  | 'ERR_MEMORY_SPACE_AGENTS_FILE_MISSING'
  | 'ERR_ENTITY_DOCUMENT_MISSING';

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
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  handleStore = createWorkspaceHandleStore(),
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
  const closed = await handleStore.closeHandle({
    workspaceHandle: request.data.workspaceHandle,
    sender: trusted.sender,
  });
  if (!closed.ok) {
    return closed;
  }

  clearRecordingRuntimeStateForRoot(handle.handle.canonicalRoot);
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
          ...(request.maxBytes !== undefined ? { maxBytes: request.maxBytes } : {}),
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
                  audio: result.audio,
                  audioByteLength: result.audioByteLength,
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
          ...(request.maxBytes !== undefined ? { maxBytes: request.maxBytes } : {}),
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
                  audio: result.audio,
                  audioByteLength: result.audioByteLength,
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

export async function handleFinalizeSegmentSupplementRecordingDraftForTest(
  options: HandleFinalizeSegmentSupplementRecordingDraftOptions
): Promise<z.infer<typeof workspaceFinalizeSegmentSupplementRecordingDraftResponseSchema>> {
  return handleFinalizeSegmentSupplementRecordingDraftCore(options);
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
            },
          }
        : result
    );
  });
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
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  tokenStore = createWorkspaceSelectionTokenStore(),
  handleStore = defaultHandleStore,
  memorySpaceRegistry = getDefaultMemorySpaceRegistry(),
  recordingTranscriptionSessions = defaultRecordingTranscriptionSessions,
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
  registerWorkspaceIpcHandler(WORKSPACE_INITIALIZE_CHANNEL, (event, input) =>
    handleInitializeWorkspace({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      tokenStore,
      handleStore,
      memorySpaceRegistry,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_OPEN_CHANNEL, (event, input) =>
    handleOpenWorkspace({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      tokenStore,
      handleStore,
      memorySpaceRegistry,
    })
  );
  registerWorkspaceIpcHandler(WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL, (event, input) =>
    handleOpenWorkspaceMemorySpace({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      memorySpaceRegistry,
    })
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
  registerWorkspaceIpcHandler(WORKSPACE_CLOSE_CHANNEL, (event, input) =>
    handleCloseWorkspace({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
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
    })
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
  registerWorkspaceHandleRequest(
    WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
    workspaceRecordingFinalizeRequestSchema,
    'finalizeRecordingDraft request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await finalizeRecordingDraft({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          segmentId: request.segmentId,
          memoryId: request.memoryId,
          title: request.title,
          durationMs: request.durationMs,
          now: nowIso,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceRecordingFinalizeResponseSchema.parse(
          result.ok
            ? { ok: true, value: { memory: result.memory, segment: result.segment } }
            : result
        );
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_FINALIZE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
    workspaceFinalizeSegmentSupplementRecordingDraftRequestSchema,
    'finalizeSegmentSupplementRecordingDraft request is invalid',
    (request, handle, assertUsable) =>
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
          now: nowIso,
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
      })
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
        return workspaceDiscardRecordingDraftResponseSchema.parse(
          result.ok ? { ok: true, value: { discarded: true } } : result
        );
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
        return workspaceDiscardRecordingDraftResponseSchema.parse(
          result.ok ? { ok: true, value: { discarded: true } } : result
        );
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_SAVE_TRANSCRIPT_CHANNEL,
    workspaceRecordingMarkdownSaveRequestSchema,
    'save transcript request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await saveRecordingMarkdown({
          rootPath: handle.canonicalRoot,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          fileName: 'transcript.md',
          markdown: request.markdown,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceRecordingMarkdownSaveResponseSchema.parse(
          result.ok ? { ok: true, value: { memory: result.memory, saved: true } } : result
        );
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_TRANSCRIPT_CHANNEL,
    workspaceSegmentSupplementMarkdownSaveRequestSchema,
    'save segment supplement transcript request is invalid',
    saveSegmentSupplementTranscriptWithHandle
  );
}

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
  WORKSPACE_APPEND_SEGMENT_ATTACHMENT_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_CLONE_RECORDING_DRAFT_PREFIX_CHANNEL,
  WORKSPACE_CREATE_MEMORY_CHANNEL,
  WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_CREATE_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DELETE_MEMORY_CHANNEL,
  WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DISCARD_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_FINISH_RECORDING_TRANSCRIPTION_CHANNEL,
  WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_FINALIZE_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_INITIALIZE_CHANNEL,
  WORKSPACE_IPC_CHANNELS,
  WORKSPACE_LIST_MEMORY_SPACES_CHANNEL,
  WORKSPACE_OPEN_CHANNEL,
  WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_CHANNEL,
  WORKSPACE_READ_MEMORY_DETAIL_CHANNEL,
  WORKSPACE_READ_RECORDING_DRAFT_AUDIO_CHANNEL,
  WORKSPACE_REMOVE_MEMORY_SPACE_CHANNEL,
  WORKSPACE_RESTORE_DELETED_MEMORY_CHANNEL,
  WORKSPACE_RECORDING_TRANSCRIPTION_EVENT_CHANNEL,
  WORKSPACE_SAVE_TRANSCRIPT_CHANNEL,
  WORKSPACE_SEND_RECORDING_TRANSCRIPTION_AUDIO_CHANNEL,
  WORKSPACE_START_RECORDING_TRANSCRIPTION_CHANNEL,
  WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL,
  workspaceCloseRequestSchema,
  workspaceCloseResponseSchema,
  workspaceChooseDirectoryResponseSchema,
  workspaceDeleteMemoryRequestSchema,
  workspaceDeleteMemoryResponseSchema,
  workspaceCreateMemoryRequestSchema,
  workspaceCreateMemoryResponseSchema,
  workspaceCreateRecordingDraftResponseSchema,
  workspaceCreateSegmentAttachmentRecordingDraftRequestSchema,
  workspaceCreateSegmentAttachmentRecordingDraftResponseSchema,
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
  workspaceOpenMemorySpaceRequestSchema,
  workspaceReadFinalizedAudioSegmentRequestSchema,
  workspaceReadFinalizedAudioSegmentResponseSchema,
  workspaceReadMemoryDetailRequestSchema,
  workspaceReadMemoryDetailResponseSchema,
  workspaceRemoveMemorySpaceRequestSchema,
  workspaceRemoveMemorySpaceResponseSchema,
  workspaceRecordingAppendRequestSchema,
  workspaceRecordingAppendResponseSchema,
  workspaceRestoreDeletedMemoryRequestSchema,
  workspaceRestoreDeletedMemoryResponseSchema,
  workspaceAppendSegmentAttachmentRecordingAudioRequestSchema,
  workspaceSegmentAttachmentRecordingAppendResponseSchema,
  workspaceRecordingDraftPrefixCloneRequestSchema,
  workspaceRecordingDraftPrefixCloneResponseSchema,
  workspaceRecordingDraftAudioResponseSchema,
  workspaceRecordingDraftAudioRequestSchema,
  workspaceRecordingFinalizeResponseSchema,
  workspaceRecordingFinalizeRequestSchema,
  workspaceFinalizeSegmentAttachmentRecordingDraftRequestSchema,
  workspaceFinalizeSegmentAttachmentRecordingDraftResponseSchema,
  workspaceRecordingTranscriptionAudioRequestSchema,
  workspaceRecordingTranscriptionCloseRequestSchema,
  workspaceRecordingTranscriptionControlResponseSchema,
  workspaceRecordingTranscriptionEventSchema,
  workspaceRecordingTranscriptionStartRequestSchema,
  workspaceSegmentIdRequestSchema,
  workspaceSegmentAttachmentIdRequestSchema,
  workspaceRecordingMarkdownSaveRequestSchema,
  workspaceRecordingMarkdownSaveResponseSchema,
  workspaceHandleRequestSchema,
  workspaceUpdateMemoryTitleRequestSchema,
  workspaceUpdateMemoryTitleResponseSchema,
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
  appendSegmentAttachmentRecordingAudioChunk,
  cloneRecordingDraftPrefix,
  clearRecordingRuntimeState,
  clearRecordingRuntimeStateForRoot,
  createRecordingDraft,
  createSegmentAttachmentRecordingDraft,
  discardRecordingDraft,
  discardSegmentAttachmentRecordingDraft,
  finalizeRecordingDraft,
  finalizeSegmentAttachmentRecordingDraft,
  readFinalizedAudioSegmentContent,
  readRecordingDraftAudio,
  saveRecordingMarkdown,
} from './recordingDrafts.js';
import {
  createMemoryFromFileTruth,
  deleteMemoryFromFileTruth,
  readMemoryDetailFromFileTruth,
  restoreDeletedMemoryFromFileTruth,
  updateMemoryTitleFromFileTruth,
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
  removeLockOnlyReoDirectory,
  validateEmptyWorkspaceOpenCanonicalTargetAfterLock,
  validateWorkspaceOpenTarget,
  type WorkspaceInitializeTarget,
} from './workspaceFiles.js';
import {
  createRecordingTranscriptionSessionRegistry,
  type RecordingTranscriptionSessionRegistry,
} from './recordingTranscriptionSessions.js';

const nodeRequire = createRequire(import.meta.url);
const { app, dialog, ipcMain } = nodeRequire('electron') as Partial<typeof import('electron')>;
const defaultHandleStore = createWorkspaceHandleStore();
let defaultMemorySpaceRegistry: WorkspaceMemorySpaceRegistry | null = null;
const defaultRecordingTranscriptionSessions = createRecordingTranscriptionSessionRegistry();

interface ShowOpenDirectoryDialogResult {
  readonly canceled: boolean;
  readonly filePaths: readonly string[];
}

type ShowOpenDirectoryDialog = () => Promise<ShowOpenDirectoryDialogResult>;
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

export interface HandleCreateMemoryOptions extends HandleWorkspaceRequestOptions {
  readonly createMemoryId?: () => string;
  readonly now?: () => string;
}

export interface HandleCreateRecordingDraftOptions extends HandleWorkspaceRequestOptions {
  readonly createSegmentId?: () => string;
  readonly now?: () => string;
}

export interface HandleCreateSegmentAttachmentRecordingDraftOptions extends HandleWorkspaceRequestOptions {
  readonly createAttachmentId?: () => string;
  readonly now?: () => string;
}

export interface HandleFinalizeSegmentAttachmentRecordingDraftOptions extends HandleWorkspaceRequestOptions {
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

type HandleOpenWorkspaceMemorySpaceOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly handleStore?: WorkspaceHandleStore;
  readonly memorySpaceRegistry?: WorkspaceMemorySpaceRegistry;
  readonly createHandle?: () => string;
  readonly afterWorkspaceLockAcquiredForTest?: () => MaybePromise<void>;
};

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

function requireElectronMainApi(): Pick<typeof import('electron'), 'dialog' | 'ipcMain'> {
  if (!dialog || !ipcMain) {
    throw new Error('Electron main API is unavailable');
  }
  return { dialog, ipcMain };
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

function createAttachmentId(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `att_${timestamp}_${randomUUID().slice(0, 8)}`;
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

function workspaceMemorySpaceRegistryWriteError(): WorkspaceErrorEnvelope {
  return workspaceError(
    'ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_WRITE_FAILED',
    'Workspace memory space registry could not be written',
    'unknown'
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

async function openWorkspaceRoot({
  canonicalRoot,
  trustedSender,
  handleStore,
  createHandle,
  memorySpaceRegistry,
  afterWorkspaceLockAcquiredForTest,
}: {
  readonly canonicalRoot: string;
  readonly trustedSender: TrustedSenderIdentity;
  readonly handleStore: WorkspaceHandleStore;
  readonly createHandle?: (() => string) | undefined;
  readonly memorySpaceRegistry: WorkspaceMemorySpaceRegistry;
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
  if (!lock.lock.isUsable()) {
    await releaseWorkspaceLockAfterFailure(lock);
    return workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost', 'none-written');
  }

  return persistAndRegisterWorkspaceSession({
    canonicalRoot,
    snapshot: opened.snapshot,
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

  let rootPath: string | null;
  try {
    rootPath = await memorySpaceRegistry.resolveMemorySpaceRoot(request.data.workspaceId);
  } catch (error) {
    return workspaceMemorySpaceRegistryReadError(error);
  }
  if (!rootPath) {
    return workspaceError(
      'ERR_WORKSPACE_MEMORY_SPACE_NOT_FOUND',
      'Workspace memorySpace is not registered',
      'none-written'
    );
  }

  const target = await validateWorkspaceOpenTarget(rootPath);
  if (!target.ok) {
    return target;
  }

  return openWorkspaceRoot({
    canonicalRoot: target.canonicalRoot,
    trustedSender: trusted.sender,
    handleStore,
    createHandle,
    memorySpaceRegistry,
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

function handleCreateSegmentAttachmentRecordingDraftCore({
  createAttachmentId: createAttachmentIdOption = createAttachmentId,
  now = nowIso,
  ...options
}: HandleCreateSegmentAttachmentRecordingDraftOptions): Promise<
  z.infer<typeof workspaceCreateSegmentAttachmentRecordingDraftResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_CREATE_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceCreateSegmentAttachmentRecordingDraftRequestSchema,
    invalidMessage: 'createSegmentAttachmentRecordingDraft request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment attachment draft workspace does not match the active handle'
          );
        }

        const result = await createSegmentAttachmentRecordingDraft({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          createAttachmentId: createAttachmentIdOption,
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceCreateSegmentAttachmentRecordingDraftResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  attachmentId: result.attachmentId,
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

export async function handleCreateSegmentAttachmentRecordingDraft(
  options: HandleCreateSegmentAttachmentRecordingDraftOptions
): Promise<z.infer<typeof workspaceCreateSegmentAttachmentRecordingDraftResponseSchema>> {
  return handleCreateSegmentAttachmentRecordingDraftCore(options);
}

export async function handleCreateSegmentAttachmentRecordingDraftForTest(
  options: HandleCreateSegmentAttachmentRecordingDraftOptions
): Promise<z.infer<typeof workspaceCreateSegmentAttachmentRecordingDraftResponseSchema>> {
  return handleCreateSegmentAttachmentRecordingDraftCore(options);
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

function handleFinalizeSegmentAttachmentRecordingDraftCore({
  now = nowIso,
  ...options
}: HandleFinalizeSegmentAttachmentRecordingDraftOptions): Promise<
  z.infer<typeof workspaceFinalizeSegmentAttachmentRecordingDraftResponseSchema>
> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_FINALIZE_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceFinalizeSegmentAttachmentRecordingDraftRequestSchema,
    invalidMessage: 'finalizeSegmentAttachmentRecordingDraft request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment attachment finalize workspace does not match the active handle'
          );
        }

        const result = await finalizeSegmentAttachmentRecordingDraft({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          attachmentId: request.attachmentId,
          title: request.title,
          durationMs: request.durationMs,
          now,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceFinalizeSegmentAttachmentRecordingDraftResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  memory: result.memory,
                  segment: result.segment,
                  attachment: result.attachment,
                },
              }
            : result
        );
      }),
  });
}

export async function handleFinalizeSegmentAttachmentRecordingDraft(
  options: HandleFinalizeSegmentAttachmentRecordingDraftOptions
): Promise<z.infer<typeof workspaceFinalizeSegmentAttachmentRecordingDraftResponseSchema>> {
  return handleFinalizeSegmentAttachmentRecordingDraftCore(options);
}

export async function handleFinalizeSegmentAttachmentRecordingDraftForTest(
  options: HandleFinalizeSegmentAttachmentRecordingDraftOptions
): Promise<z.infer<typeof workspaceFinalizeSegmentAttachmentRecordingDraftResponseSchema>> {
  return handleFinalizeSegmentAttachmentRecordingDraftCore(options);
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
}: RegisterWorkspaceIpcOptions): void {
  const electronMain = requireElectronMainApi();

  electronMain.ipcMain.handle(WORKSPACE_CHOOSE_DIRECTORY_CHANNEL, (event, input) =>
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
  electronMain.ipcMain.handle(WORKSPACE_LIST_MEMORY_SPACES_CHANNEL, (event, input) =>
    handleListWorkspaceMemorySpaces({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      memorySpaceRegistry,
    })
  );
  electronMain.ipcMain.handle(WORKSPACE_INITIALIZE_CHANNEL, (event, input) =>
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
  electronMain.ipcMain.handle(WORKSPACE_OPEN_CHANNEL, (event, input) =>
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
  electronMain.ipcMain.handle(WORKSPACE_OPEN_MEMORY_SPACE_CHANNEL, (event, input) =>
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
  electronMain.ipcMain.handle(WORKSPACE_REMOVE_MEMORY_SPACE_CHANNEL, (event, input) =>
    handleRemoveMemorySpace({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      memorySpaceRegistry,
    })
  );
  electronMain.ipcMain.handle(WORKSPACE_BEGIN_MICROPHONE_INTENT_CHANNEL, (event, input) =>
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
  electronMain.ipcMain.handle(WORKSPACE_CLEAR_MICROPHONE_INTENT_CHANNEL, (event, input) =>
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
  electronMain.ipcMain.handle(WORKSPACE_START_RECORDING_TRANSCRIPTION_CHANNEL, (event, input) =>
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
  electronMain.ipcMain.handle(
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
  electronMain.ipcMain.handle(WORKSPACE_FINISH_RECORDING_TRANSCRIPTION_CHANNEL, (event, input) =>
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
  electronMain.ipcMain.handle(WORKSPACE_CLOSE_RECORDING_TRANSCRIPTION_CHANNEL, (event, input) =>
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
  electronMain.ipcMain.handle(WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL, (event, input) =>
    handleUpdateMemoryTitle({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  electronMain.ipcMain.handle(WORKSPACE_CREATE_MEMORY_CHANNEL, (event, input) =>
    handleCreateMemory({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  electronMain.ipcMain.handle(WORKSPACE_DELETE_MEMORY_CHANNEL, (event, input) =>
    handleDeleteMemory({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  electronMain.ipcMain.handle(WORKSPACE_RESTORE_DELETED_MEMORY_CHANNEL, (event, input) =>
    handleRestoreDeletedMemory({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  electronMain.ipcMain.handle(WORKSPACE_READ_MEMORY_DETAIL_CHANNEL, (event, input) =>
    handleReadMemoryDetail({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  electronMain.ipcMain.handle(WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_CHANNEL, (event, input) =>
    handleReadFinalizedAudioSegment({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  electronMain.ipcMain.handle(WORKSPACE_CLOSE_CHANNEL, (event, input) =>
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
    electronMain.ipcMain.handle(channel, (event, input) =>
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

  electronMain.ipcMain.handle(WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL, (event, input) =>
    handleCreateRecordingDraft({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
    })
  );
  electronMain.ipcMain.handle(
    WORKSPACE_CREATE_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
    (event, input) =>
      handleCreateSegmentAttachmentRecordingDraft({
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
    WORKSPACE_APPEND_SEGMENT_ATTACHMENT_RECORDING_AUDIO_CHUNK_CHANNEL,
    workspaceAppendSegmentAttachmentRecordingAudioRequestSchema,
    'appendSegmentAttachmentRecordingAudioChunk request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await appendSegmentAttachmentRecordingAudioChunk({
          rootPath: handle.canonicalRoot,
          attachmentId: request.attachmentId,
          sequence: request.sequence,
          chunk: request.chunk,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceSegmentAttachmentRecordingAppendResponseSchema.parse(
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
    WORKSPACE_FINALIZE_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
    workspaceFinalizeSegmentAttachmentRecordingDraftRequestSchema,
    'finalizeSegmentAttachmentRecordingDraft request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        if (request.workspaceId !== handle.workspaceId) {
          return workspaceError(
            'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
            'Segment attachment finalize workspace does not match the active handle'
          );
        }

        const result = await finalizeSegmentAttachmentRecordingDraft({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          attachmentId: request.attachmentId,
          title: request.title,
          durationMs: request.durationMs,
          now: nowIso,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceFinalizeSegmentAttachmentRecordingDraftResponseSchema.parse(
          result.ok
            ? {
                ok: true,
                value: {
                  memory: result.memory,
                  segment: result.segment,
                  attachment: result.attachment,
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
    WORKSPACE_DISCARD_SEGMENT_ATTACHMENT_RECORDING_DRAFT_CHANNEL,
    workspaceSegmentAttachmentIdRequestSchema,
    'discardSegmentAttachmentRecordingDraft request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await discardSegmentAttachmentRecordingDraft({
          rootPath: handle.canonicalRoot,
          attachmentId: request.attachmentId,
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
}

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
  WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_GET_MEMORY_DETAIL_CHANNEL,
  WORKSPACE_GET_RECORDING_DETAIL_CHANNEL,
  WORKSPACE_INITIALIZE_CHANNEL,
  WORKSPACE_IPC_CHANNELS,
  WORKSPACE_LIST_PROJECTS_CHANNEL,
  WORKSPACE_OPEN_CHANNEL,
  WORKSPACE_OPEN_PROJECT_CHANNEL,
  WORKSPACE_REMOVE_PROJECT_CHANNEL,
  WORKSPACE_READ_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_READ_RECORDING_AUDIO_MANIFEST_CHANNEL,
  WORKSPACE_SAVE_REFLECTIONS_CHANNEL,
  WORKSPACE_SAVE_TRANSCRIPT_CHANNEL,
  workspaceCloseRequestSchema,
  workspaceChooseDirectoryResponseSchema,
  workspaceError,
  workspaceInitializeRequestSchema,
  workspaceInitializeResponseSchema,
  workspaceListProjectsResponseSchema,
  workspaceMemoryDetailResponseSchema,
  workspaceMemoryIdRequestSchema,
  workspaceMicrophoneIntentRequestSchema,
  workspaceMicrophoneIntentResponseSchema,
  workspaceNoInputSchema,
  workspaceOpenRequestSchema,
  workspaceOpenProjectRequestSchema,
  workspaceRemoveProjectRequestSchema,
  workspaceRecordingAppendRequestSchema,
  workspaceRecordingAudioChunkRequestSchema,
  workspaceRecordingFinalizeRequestSchema,
  workspaceRecordingIdRequestSchema,
  workspaceRecordingMarkdownSaveRequestSchema,
  workspaceRecordingReadRequestSchema,
  type WorkspaceInitializeResponse,
  type WorkspaceChooseDirectoryResponse,
  type WorkspaceErrorEnvelope,
  type WorkspaceSnapshot,
} from './workspaceContract.js';
import { createWorkspaceHandleStore, type WorkspaceHandleStore } from './workspaceHandles.js';
import {
  createWorkspaceProjectRegistry,
  WorkspaceProjectRegistryReadError,
  type WorkspaceProjectRegistry,
} from './workspaceProjectRegistry.js';
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
  clearRecordingRuntimeState,
  clearRecordingRuntimeStateForRoot,
  createRecordingDraft,
  discardRecordingDraft,
  finalizeRecordingDraft,
  getRecordingDetail,
  readRecordingAudioChunk,
  readRecordingAudioManifest,
  saveRecordingMarkdown,
} from './recordingDrafts.js';
import { readMemoryDetail, type MemoryDetail } from './memoryFiles.js';
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

const nodeRequire = createRequire(import.meta.url);
const { app, dialog, ipcMain } = nodeRequire('electron') as Partial<typeof import('electron')>;
const defaultHandleStore = createWorkspaceHandleStore();
let defaultProjectRegistry: WorkspaceProjectRegistry | null = null;

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
  readonly projectRegistry?: WorkspaceProjectRegistry;
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
  readonly projectRegistry?: WorkspaceProjectRegistry;
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
}

export interface HandleMicrophoneIntentOptions extends HandleWorkspaceRequestOptions {
  readonly now?: () => number;
}

type HandleInitializeWorkspaceForTestOptions = HandleInitializeWorkspaceOptions & {
  readonly afterWorkspaceLockAcquiredForTest?: () => MaybePromise<void>;
};

type HandleListWorkspaceProjectsOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly projectRegistry?: WorkspaceProjectRegistry;
};

type HandleRemoveWorkspaceProjectOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly projectRegistry?: WorkspaceProjectRegistry;
};

type HandleOpenWorkspaceProjectOptions = WorkspaceIpcBaseOptions & {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly handleStore?: WorkspaceHandleStore;
  readonly projectRegistry?: WorkspaceProjectRegistry;
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

async function handleListWorkspaceProjectsCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  projectRegistry = getDefaultProjectRegistry(),
}: HandleListWorkspaceProjectsOptions): Promise<
  z.infer<typeof workspaceListProjectsResponseSchema>
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_LIST_PROJECTS_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceNoInputSchema.safeParse(input);
  if (!request.success) {
    return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'listProjects accepts no payload');
  }

  try {
    const projects = await projectRegistry.listProjects();
    return workspaceListProjectsResponseSchema.parse({
      ok: true,
      value: { projects },
    });
  } catch (error) {
    return workspaceProjectRegistryReadError(error);
  }
}

export async function handleListWorkspaceProjects(
  options: HandleListWorkspaceProjectsOptions
): Promise<z.infer<typeof workspaceListProjectsResponseSchema>> {
  return handleListWorkspaceProjectsCore(options);
}

export async function handleListWorkspaceProjectsForTest(
  options: HandleListWorkspaceProjectsOptions
): Promise<z.infer<typeof workspaceListProjectsResponseSchema>> {
  return handleListWorkspaceProjectsCore(options);
}

async function handleRemoveWorkspaceProjectCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  projectRegistry = getDefaultProjectRegistry(),
}: HandleRemoveWorkspaceProjectOptions): Promise<
  WorkspaceErrorEnvelope | { readonly ok: true; readonly value: { readonly removed: true } }
> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_REMOVE_PROJECT_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceRemoveProjectRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'removeProject request is invalid');
  }

  try {
    await projectRegistry.removeProject(request.data.workspaceId);
    return { ok: true, value: { removed: true } };
  } catch {
    return workspaceProjectRegistryWriteError();
  }
}

export async function handleRemoveWorkspaceProject(
  options: HandleRemoveWorkspaceProjectOptions
): Promise<
  WorkspaceErrorEnvelope | { readonly ok: true; readonly value: { readonly removed: true } }
> {
  return handleRemoveWorkspaceProjectCore(options);
}

export async function handleRemoveWorkspaceProjectForTest(
  options: HandleRemoveWorkspaceProjectOptions
): Promise<
  WorkspaceErrorEnvelope | { readonly ok: true; readonly value: { readonly removed: true } }
> {
  return handleRemoveWorkspaceProjectCore(options);
}

export async function closeAllWorkspaceHandles(): Promise<void> {
  clearAllMicrophoneIntents();
  await defaultHandleStore.closeAllHandles();
  clearRecordingRuntimeState();
}

function createWorkspaceId(): string {
  return `ws_${randomUUID()}`;
}

function createRecordingId(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `rec_${timestamp}_${randomUUID().slice(0, 8)}`;
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

function getDefaultProjectRegistry(): WorkspaceProjectRegistry {
  const userDataPath =
    app?.getPath('userData') ??
    path.join(process.cwd(), '.tmp', 'workspace-registry', `${process.pid}`);
  defaultProjectRegistry ??= createWorkspaceProjectRegistry({
    registryPath: path.join(userDataPath, 'workspace-registry.json'),
  });
  return defaultProjectRegistry;
}

function workspaceProjectRegistryReadError(error: unknown): WorkspaceErrorEnvelope {
  const message =
    error instanceof WorkspaceProjectRegistryReadError
      ? error.message
      : 'Workspace project registry could not be read';
  return workspaceError('ERR_WORKSPACE_PROJECT_REGISTRY_READ_FAILED', message, 'unknown');
}

function workspaceProjectRegistryWriteError(): WorkspaceErrorEnvelope {
  return workspaceError(
    'ERR_WORKSPACE_PROJECT_REGISTRY_WRITE_FAILED',
    'Workspace project registry could not be written',
    'unknown'
  );
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
  projectRegistry,
  failureCode,
  failureMessage,
}: {
  readonly canonicalRoot: string;
  readonly snapshot: WorkspaceSnapshot;
  readonly trustedSender: TrustedSenderIdentity;
  readonly lock: AcquiredWorkspaceLock;
  readonly handleStore: WorkspaceHandleStore;
  readonly createHandle?: (() => string) | undefined;
  readonly projectRegistry: WorkspaceProjectRegistry;
  readonly failureCode: 'ERR_WORKSPACE_INIT_FAILED' | 'ERR_WORKSPACE_OPEN_FAILED';
  readonly failureMessage: string;
}): Promise<WorkspaceInitializeResponse> {
  try {
    await projectRegistry.upsertProject({ canonicalRoot, snapshot });
  } catch {
    await releaseWorkspaceLockAfterFailure(lock);
    return workspaceError(
      'ERR_WORKSPACE_PROJECT_REGISTRY_WRITE_FAILED',
      'Workspace project registry could not be updated',
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
  projectRegistry,
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
  readonly projectRegistry: WorkspaceProjectRegistry;
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
    projectRegistry,
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
  projectRegistry = getDefaultProjectRegistry(),
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
    projectRegistry,
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
  readonly run: (
    data: z.infer<Schema>,
    handle: RequiredWorkspaceHandle,
    assertUsable: AssertWorkspaceHandleUsable
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

  const required = handleStore.requireHandle({
    workspaceHandle: request.data.workspaceHandle,
    sender: trusted.sender,
  });
  if (!required.ok) {
    return required;
  }

  return run(request.data as z.infer<Schema>, required.handle, required.handle.assertUsable);
}

async function openWorkspaceRoot({
  canonicalRoot,
  trustedSender,
  handleStore,
  createHandle,
  projectRegistry,
  afterWorkspaceLockAcquiredForTest,
}: {
  readonly canonicalRoot: string;
  readonly trustedSender: TrustedSenderIdentity;
  readonly handleStore: WorkspaceHandleStore;
  readonly createHandle?: (() => string) | undefined;
  readonly projectRegistry: WorkspaceProjectRegistry;
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
    projectRegistry,
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
  projectRegistry = getDefaultProjectRegistry(),
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
      projectRegistry,
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
    projectRegistry,
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

async function handleOpenWorkspaceProjectCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  handleStore = createWorkspaceHandleStore(),
  createHandle,
  projectRegistry = getDefaultProjectRegistry(),
  afterWorkspaceLockAcquiredForTest,
}: HandleOpenWorkspaceProjectOptions): Promise<WorkspaceInitializeResponse> {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_OPEN_PROJECT_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) {
    return trusted;
  }

  const request = workspaceOpenProjectRequestSchema.safeParse(input);
  if (!request.success) {
    return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'openProject request is invalid');
  }

  let rootPath: string | null;
  try {
    rootPath = await projectRegistry.resolveProjectRoot(request.data.workspaceId);
  } catch (error) {
    return workspaceProjectRegistryReadError(error);
  }
  if (!rootPath) {
    return workspaceError(
      'ERR_WORKSPACE_PROJECT_NOT_FOUND',
      'Workspace project is not registered',
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
    projectRegistry,
    afterWorkspaceLockAcquiredForTest,
  });
}

export async function handleOpenWorkspaceProject(
  options: HandleOpenWorkspaceProjectOptions
): Promise<WorkspaceInitializeResponse> {
  return handleOpenWorkspaceProjectCore(options);
}

export async function handleOpenWorkspaceProjectForTest(
  options: HandleOpenWorkspaceProjectOptions
): Promise<WorkspaceInitializeResponse> {
  return handleOpenWorkspaceProjectCore(options);
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
      drawerSessionId: request.data.drawerSessionId,
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
  { readonly ok: true; readonly value: { readonly cleared: true } } | WorkspaceErrorEnvelope
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
    drawerSessionId: request.data.drawerSessionId,
  });
  return { ok: true, value: { cleared: true } };
}

export async function handleClearMicrophoneIntent(
  options: HandleWorkspaceRequestOptions
): Promise<
  { readonly ok: true; readonly value: { readonly cleared: true } } | WorkspaceErrorEnvelope
> {
  return handleClearMicrophoneIntentCore(options);
}

export async function handleClearMicrophoneIntentForTest(
  options: HandleWorkspaceRequestOptions
): Promise<
  { readonly ok: true; readonly value: { readonly cleared: true } } | WorkspaceErrorEnvelope
> {
  return handleClearMicrophoneIntentCore(options);
}

async function handleCloseWorkspaceCore({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  handleStore = createWorkspaceHandleStore(),
}: HandleWorkspaceRequestOptions): Promise<
  { readonly ok: true; readonly value: { readonly closed: true } } | WorkspaceErrorEnvelope
> {
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
  const closed = await handleStore.closeHandle({
    workspaceHandle: request.data.workspaceHandle,
    sender: trusted.sender,
  });
  if (!closed.ok) {
    return closed;
  }

  clearRecordingRuntimeStateForRoot(handle.handle.canonicalRoot);
  return { ok: true, value: { closed: true } };
}

export async function handleCloseWorkspace(
  options: HandleWorkspaceRequestOptions
): Promise<
  { readonly ok: true; readonly value: { readonly closed: true } } | WorkspaceErrorEnvelope
> {
  return handleCloseWorkspaceCore(options);
}

export async function handleCloseWorkspaceForTest(
  options: HandleWorkspaceRequestOptions
): Promise<
  { readonly ok: true; readonly value: { readonly closed: true } } | WorkspaceErrorEnvelope
> {
  return handleCloseWorkspaceCore(options);
}

function handleGetMemoryDetailCore(
  options: HandleWorkspaceRequestOptions
): Promise<WorkspaceErrorEnvelope | { readonly ok: true; readonly value: MemoryDetail }> {
  return withWorkspaceHandleRequest({
    ...options,
    channel: WORKSPACE_GET_MEMORY_DETAIL_CHANNEL,
    handleStore: options.handleStore ?? createWorkspaceHandleStore(),
    schema: workspaceMemoryIdRequestSchema,
    invalidMessage: 'getMemoryDetail request is invalid',
    run: (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await readMemoryDetail({
          rootPath: handle.canonicalRoot,
          memoryId: request.memoryId,
          assertWorkspaceUsable: assertUsable,
        });
        return workspaceMemoryDetailResponseSchema.parse(
          result.ok ? { ok: true, value: result.value } : result
        );
      }),
  });
}

export async function handleGetMemoryDetail(
  options: HandleWorkspaceRequestOptions
): Promise<WorkspaceErrorEnvelope | { readonly ok: true; readonly value: MemoryDetail }> {
  return handleGetMemoryDetailCore(options);
}

export async function handleGetMemoryDetailForTest(
  options: HandleWorkspaceRequestOptions
): Promise<WorkspaceErrorEnvelope | { readonly ok: true; readonly value: MemoryDetail }> {
  return handleGetMemoryDetailCore(options);
}

export function registerWorkspaceIpc({
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  tokenStore = createWorkspaceSelectionTokenStore(),
  handleStore = defaultHandleStore,
  projectRegistry = getDefaultProjectRegistry(),
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
  electronMain.ipcMain.handle(WORKSPACE_LIST_PROJECTS_CHANNEL, (event, input) =>
    handleListWorkspaceProjects({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      projectRegistry,
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
      projectRegistry,
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
      projectRegistry,
    })
  );
  electronMain.ipcMain.handle(WORKSPACE_OPEN_PROJECT_CHANNEL, (event, input) =>
    handleOpenWorkspaceProject({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      handleStore,
      projectRegistry,
    })
  );
  electronMain.ipcMain.handle(WORKSPACE_REMOVE_PROJECT_CHANNEL, (event, input) =>
    handleRemoveWorkspaceProject({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      projectRegistry,
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
    })
  );
  electronMain.ipcMain.handle(WORKSPACE_GET_MEMORY_DETAIL_CHANNEL, (event, input) =>
    handleGetMemoryDetail({
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

  registerWorkspaceHandleRequest(
    WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
    workspaceCloseRequestSchema,
    'createRecordingDraft request is invalid',
    (_request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await createRecordingDraft({
          rootPath: handle.canonicalRoot,
          workspaceId: handle.workspaceId,
          createRecordingId,
          now: nowIso,
          assertWorkspaceUsable: assertUsable,
        });
        return result.ok ? { ok: true, value: result } : result;
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
          recordingId: request.recordingId,
          sequence: request.sequence,
          chunk: request.chunk,
          assertWorkspaceUsable: assertUsable,
        });
        return result.ok ? { ok: true, value: { nextSequence: result.nextSequence } } : result;
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
          recordingId: request.recordingId,
          createMemoryId,
          title: request.title,
          durationMs: request.durationMs,
          now: nowIso,
          ...(request.memoryId ? { memoryId: request.memoryId } : {}),
          assertWorkspaceUsable: assertUsable,
        });
        return result.ok
          ? { ok: true, value: { memory: result.memory, recording: result.recording } }
          : result;
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
    workspaceRecordingIdRequestSchema,
    'discardRecordingDraft request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await discardRecordingDraft({
          rootPath: handle.canonicalRoot,
          recordingId: request.recordingId,
          assertWorkspaceUsable: assertUsable,
        });
        return result.ok ? { ok: true, value: { discarded: true } } : result;
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_GET_RECORDING_DETAIL_CHANNEL,
    workspaceRecordingReadRequestSchema,
    'getRecordingDetail request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await getRecordingDetail({
          rootPath: handle.canonicalRoot,
          memoryId: request.memoryId,
          recordingId: request.recordingId,
          assertWorkspaceUsable: assertUsable,
        });
        return result.ok ? { ok: true, value: result.recording } : result;
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_READ_RECORDING_AUDIO_MANIFEST_CHANNEL,
    workspaceRecordingReadRequestSchema,
    'readRecordingAudioManifest request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await readRecordingAudioManifest({
          rootPath: handle.canonicalRoot,
          memoryId: request.memoryId,
          recordingId: request.recordingId,
          assertWorkspaceUsable: assertUsable,
        });
        return result.ok ? { ok: true, value: result.manifest } : result;
      })
  );
  registerWorkspaceHandleRequest(
    WORKSPACE_READ_RECORDING_AUDIO_CHUNK_CHANNEL,
    workspaceRecordingAudioChunkRequestSchema,
    'readRecordingAudioChunk request is invalid',
    (request, handle, assertUsable) =>
      withUsableWorkspaceHandle(assertUsable, async () => {
        const result = await readRecordingAudioChunk({
          rootPath: handle.canonicalRoot,
          memoryId: request.memoryId,
          recordingId: request.recordingId,
          offset: request.offset,
          length: request.length,
          assertWorkspaceUsable: assertUsable,
        });
        return result.ok ? { ok: true, value: { chunk: result.chunk } } : result;
      })
  );
  for (const [channel, fileName] of [
    [WORKSPACE_SAVE_TRANSCRIPT_CHANNEL, 'transcript.md'],
    [WORKSPACE_SAVE_REFLECTIONS_CHANNEL, 'reflections.md'],
  ] as const) {
    registerWorkspaceHandleRequest(
      channel,
      workspaceRecordingMarkdownSaveRequestSchema,
      'save markdown request is invalid',
      (request, handle, assertUsable) =>
        withUsableWorkspaceHandle(assertUsable, async () => {
          const result = await saveRecordingMarkdown({
            rootPath: handle.canonicalRoot,
            memoryId: request.memoryId,
            recordingId: request.recordingId,
            fileName,
            markdown: request.markdown,
            assertWorkspaceUsable: assertUsable,
          });
          return result.ok ? { ok: true, value: { saved: true } } : result;
        })
    );
  }
}

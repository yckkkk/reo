import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Session } from 'electron';
import {
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_CLOSE_CHANNEL,
  WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_GET_RECORDING_DETAIL_CHANNEL,
  WORKSPACE_INITIALIZE_CHANNEL,
  WORKSPACE_IPC_CHANNELS,
  WORKSPACE_OPEN_CHANNEL,
  WORKSPACE_READ_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_READ_RECORDING_AUDIO_MANIFEST_CHANNEL,
  WORKSPACE_SAVE_REFLECTIONS_CHANNEL,
  WORKSPACE_SAVE_TRANSCRIPT_CHANNEL,
  workspaceCloseRequestSchema,
  workspaceChooseDirectoryResponseSchema,
  workspaceError,
  workspaceInitializeRequestSchema,
  workspaceInitializeResponseSchema,
  workspaceNoInputSchema,
  workspaceOpenRequestSchema,
  workspaceRecordingAppendRequestSchema,
  workspaceRecordingAudioChunkRequestSchema,
  workspaceRecordingFinalizeRequestSchema,
  workspaceRecordingIdRequestSchema,
  workspaceRecordingMarkdownSaveRequestSchema,
  type WorkspaceInitializeResponse,
  type WorkspaceChooseDirectoryResponse,
} from './workspaceContract.js';
import { createWorkspaceHandleStore, type WorkspaceHandleStore } from './workspaceHandles.js';
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
  createRecordingDraft,
  discardRecordingDraft,
  finalizeRecordingDraft,
  getRecordingDetail,
  readRecordingAudioChunk,
  readRecordingAudioManifest,
  saveRecordingMarkdown,
} from './recordingDrafts.js';
import { initializeWorkspaceFiles, openWorkspaceFiles } from './workspaceFiles.js';
import { resolveWorkspaceRoot } from './workspacePaths.js';

const require = createRequire(import.meta.url);
const { dialog, ipcMain } = require('electron') as typeof import('electron');

interface ShowOpenDirectoryDialogResult {
  readonly canceled: boolean;
  readonly filePaths: readonly string[];
}

type ShowOpenDirectoryDialog = () => Promise<ShowOpenDirectoryDialogResult>;

export interface RegisterWorkspaceIpcOptions {
  readonly expectedSession: Session | object;
  readonly expectedSessionKey: string;
  readonly isTrustedUrl: (url: string) => boolean;
  readonly tokenStore?: WorkspaceSelectionTokenStore;
  readonly handleStore?: WorkspaceHandleStore;
  readonly showOpenDirectoryDialog?: ShowOpenDirectoryDialog;
}

export interface HandleChooseWorkspaceDirectoryOptions extends RegisterWorkspaceIpcOptions {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
}

export interface HandleInitializeWorkspaceOptions extends RegisterWorkspaceIpcOptions {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly createWorkspaceId?: () => string;
  readonly createHandle?: () => string;
  readonly now?: () => string;
}

type TrustedResult =
  | {
      readonly ok: true;
      readonly sender: TrustedSenderIdentity;
    }
  | ReturnType<typeof workspaceError>;

async function showSystemOpenDirectoryDialog(): Promise<ShowOpenDirectoryDialogResult> {
  return dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
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

function nowIso(): string {
  return new Date().toISOString();
}

export async function handleInitializeWorkspace({
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
}: HandleInitializeWorkspaceOptions): Promise<WorkspaceInitializeResponse> {
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

  const canonicalRoot = await resolveWorkspaceRoot(consumed.rootPath);
  if (typeof canonicalRoot !== 'string') {
    return canonicalRoot;
  }

  const lock = await acquireWorkspaceLock({ canonicalRoot });
  if (!lock.ok) {
    return lock;
  }

  const initialized = await initializeWorkspaceFiles({
    rootPath: canonicalRoot,
    title: request.data.title,
    description: request.data.description,
    createWorkspaceId: createWorkspaceIdOption,
    now,
  });

  if (!initialized.ok) {
    await lock.lock.release();
    return initialized;
  }

  const store =
    createHandle === undefined ? handleStore : createWorkspaceHandleStore({ createHandle });
  const registered = store.register({
    canonicalRoot,
    workspaceId: initialized.snapshot.workspaceId,
    sender: trusted.sender,
    lock: lock.lock,
  });

  return workspaceInitializeResponseSchema.parse({
    ok: true,
    value: {
      ...registered,
      snapshot: initialized.snapshot,
    },
  });
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

export async function handleOpenWorkspace({
  event,
  input,
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  tokenStore = createWorkspaceSelectionTokenStore(),
  handleStore = createWorkspaceHandleStore(),
}: HandleInitializeWorkspaceOptions): Promise<WorkspaceInitializeResponse> {
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

  const canonicalRoot = await resolveWorkspaceRoot(consumed.rootPath);
  if (typeof canonicalRoot !== 'string') {
    return canonicalRoot;
  }

  const lock = await acquireWorkspaceLock({ canonicalRoot });
  if (!lock.ok) {
    return lock;
  }

  const opened = await openWorkspaceFiles({ rootPath: canonicalRoot });
  if (!opened.ok) {
    await lock.lock.release();
    return opened;
  }

  const registered = handleStore.register({
    canonicalRoot,
    workspaceId: opened.snapshot.workspaceId,
    sender: trusted.sender,
    lock: lock.lock,
  });

  return workspaceInitializeResponseSchema.parse({
    ok: true,
    value: {
      ...registered,
      snapshot: opened.snapshot,
    },
  });
}

export function registerWorkspaceIpc({
  expectedSession,
  expectedSessionKey,
  isTrustedUrl,
  tokenStore = createWorkspaceSelectionTokenStore(),
  handleStore = createWorkspaceHandleStore(),
  showOpenDirectoryDialog = showSystemOpenDirectoryDialog,
}: RegisterWorkspaceIpcOptions): void {
  ipcMain.handle(WORKSPACE_CHOOSE_DIRECTORY_CHANNEL, (event, input) =>
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
  ipcMain.handle(WORKSPACE_INITIALIZE_CHANNEL, (event, input) =>
    handleInitializeWorkspace({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      tokenStore,
      handleStore,
    })
  );
  ipcMain.handle(WORKSPACE_OPEN_CHANNEL, (event, input) =>
    handleOpenWorkspace({
      event,
      input,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
      tokenStore,
      handleStore,
    })
  );
  ipcMain.handle(WORKSPACE_CLOSE_CHANNEL, (event, input) => {
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
    return handleStore.closeHandle({
      workspaceHandle: request.data.workspaceHandle,
      sender: trusted.sender,
    });
  });
  ipcMain.handle(WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL, async (event, input) => {
    const trusted = validateWorkspaceSender({
      event,
      channel: WORKSPACE_CREATE_RECORDING_DRAFT_CHANNEL,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    });
    if (!trusted.ok) {
      return trusted;
    }
    const request = workspaceCloseRequestSchema.safeParse(input);
    if (!request.success) {
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'createRecordingDraft request is invalid'
      );
    }
    const handle = handleStore.requireHandle({
      workspaceHandle: request.data.workspaceHandle,
      sender: trusted.sender,
    });
    if (!handle.ok) {
      return handle;
    }
    const result = await createRecordingDraft({
      rootPath: handle.handle.canonicalRoot,
      workspaceId: handle.handle.workspaceId,
      createRecordingId,
      now: nowIso,
    });
    return result.ok ? { ok: true, value: result } : result;
  });
  ipcMain.handle(WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL, async (event, input) => {
    const trusted = validateWorkspaceSender({
      event,
      channel: WORKSPACE_APPEND_RECORDING_AUDIO_CHUNK_CHANNEL,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    });
    if (!trusted.ok) {
      return trusted;
    }
    const request = workspaceRecordingAppendRequestSchema.safeParse(input);
    if (!request.success) {
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'appendRecordingAudioChunk request is invalid'
      );
    }
    const handle = handleStore.requireHandle({
      workspaceHandle: request.data.workspaceHandle,
      sender: trusted.sender,
    });
    if (!handle.ok) {
      return handle;
    }
    const result = await appendRecordingAudioChunk({
      rootPath: handle.handle.canonicalRoot,
      recordingId: request.data.recordingId,
      sequence: request.data.sequence,
      chunk: request.data.chunk,
    });
    return result.ok ? { ok: true, value: { nextSequence: result.nextSequence } } : result;
  });
  ipcMain.handle(WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL, async (event, input) => {
    const trusted = validateWorkspaceSender({
      event,
      channel: WORKSPACE_FINALIZE_RECORDING_DRAFT_CHANNEL,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    });
    if (!trusted.ok) {
      return trusted;
    }
    const request = workspaceRecordingFinalizeRequestSchema.safeParse(input);
    if (!request.success) {
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'finalizeRecordingDraft request is invalid'
      );
    }
    const handle = handleStore.requireHandle({
      workspaceHandle: request.data.workspaceHandle,
      sender: trusted.sender,
    });
    if (!handle.ok) {
      return handle;
    }
    const result = await finalizeRecordingDraft({
      rootPath: handle.handle.canonicalRoot,
      recordingId: request.data.recordingId,
      title: request.data.title,
      now: nowIso,
    });
    return result.ok ? { ok: true, value: result.recording } : result;
  });
  ipcMain.handle(WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL, async (event, input) => {
    const trusted = validateWorkspaceSender({
      event,
      channel: WORKSPACE_DISCARD_RECORDING_DRAFT_CHANNEL,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    });
    if (!trusted.ok) {
      return trusted;
    }
    const request = workspaceRecordingIdRequestSchema.safeParse(input);
    if (!request.success) {
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'discardRecordingDraft request is invalid'
      );
    }
    const handle = handleStore.requireHandle({
      workspaceHandle: request.data.workspaceHandle,
      sender: trusted.sender,
    });
    if (!handle.ok) {
      return handle;
    }
    const result = await discardRecordingDraft({
      rootPath: handle.handle.canonicalRoot,
      recordingId: request.data.recordingId,
    });
    return result.ok ? { ok: true, value: { discarded: true } } : result;
  });
  ipcMain.handle(WORKSPACE_GET_RECORDING_DETAIL_CHANNEL, async (event, input) => {
    const trusted = validateWorkspaceSender({
      event,
      channel: WORKSPACE_GET_RECORDING_DETAIL_CHANNEL,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    });
    if (!trusted.ok) {
      return trusted;
    }
    const request = workspaceRecordingIdRequestSchema.safeParse(input);
    if (!request.success) {
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'getRecordingDetail request is invalid'
      );
    }
    const handle = handleStore.requireHandle({
      workspaceHandle: request.data.workspaceHandle,
      sender: trusted.sender,
    });
    if (!handle.ok) {
      return handle;
    }
    const result = await getRecordingDetail({
      rootPath: handle.handle.canonicalRoot,
      recordingId: request.data.recordingId,
    });
    return result.ok ? { ok: true, value: result.recording } : result;
  });
  ipcMain.handle(WORKSPACE_READ_RECORDING_AUDIO_MANIFEST_CHANNEL, async (event, input) => {
    const trusted = validateWorkspaceSender({
      event,
      channel: WORKSPACE_READ_RECORDING_AUDIO_MANIFEST_CHANNEL,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    });
    if (!trusted.ok) {
      return trusted;
    }
    const request = workspaceRecordingIdRequestSchema.safeParse(input);
    if (!request.success) {
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'readRecordingAudioManifest request is invalid'
      );
    }
    const handle = handleStore.requireHandle({
      workspaceHandle: request.data.workspaceHandle,
      sender: trusted.sender,
    });
    if (!handle.ok) {
      return handle;
    }
    const result = await readRecordingAudioManifest({
      rootPath: handle.handle.canonicalRoot,
      recordingId: request.data.recordingId,
    });
    return result.ok ? { ok: true, value: result.manifest } : result;
  });
  ipcMain.handle(WORKSPACE_READ_RECORDING_AUDIO_CHUNK_CHANNEL, async (event, input) => {
    const trusted = validateWorkspaceSender({
      event,
      channel: WORKSPACE_READ_RECORDING_AUDIO_CHUNK_CHANNEL,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    });
    if (!trusted.ok) {
      return trusted;
    }
    const request = workspaceRecordingAudioChunkRequestSchema.safeParse(input);
    if (!request.success) {
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'readRecordingAudioChunk request is invalid'
      );
    }
    const handle = handleStore.requireHandle({
      workspaceHandle: request.data.workspaceHandle,
      sender: trusted.sender,
    });
    if (!handle.ok) {
      return handle;
    }
    const result = await readRecordingAudioChunk({
      rootPath: handle.handle.canonicalRoot,
      recordingId: request.data.recordingId,
      offset: request.data.offset,
      length: request.data.length,
    });
    return result.ok ? { ok: true, value: { chunk: result.chunk } } : result;
  });
  for (const [channel, fileName] of [
    [WORKSPACE_SAVE_TRANSCRIPT_CHANNEL, 'transcript.md'],
    [WORKSPACE_SAVE_REFLECTIONS_CHANNEL, 'reflections.md'],
  ] as const) {
    ipcMain.handle(channel, async (event, input) => {
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
      const request = workspaceRecordingMarkdownSaveRequestSchema.safeParse(input);
      if (!request.success) {
        return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'save markdown request is invalid');
      }
      const handle = handleStore.requireHandle({
        workspaceHandle: request.data.workspaceHandle,
        sender: trusted.sender,
      });
      if (!handle.ok) {
        return handle;
      }
      const result = await saveRecordingMarkdown({
        rootPath: handle.handle.canonicalRoot,
        recordingId: request.data.recordingId,
        fileName,
        markdown: request.data.markdown,
      });
      return result.ok ? { ok: true, value: { saved: true } } : result;
    });
  }
}

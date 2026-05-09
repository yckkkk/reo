import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  closeAllWorkspaceHandles,
  handleChooseWorkspaceDirectory,
  handleBeginMicrophoneIntentForTest,
  handleClearMicrophoneIntentForTest,
  handleCloseWorkspaceForTest,
  handleCreateRecordingDraftForTest,
  handleCreateMemoryForTest,
  handleGetMemoryDetailForTest,
  handleInitializeWorkspace,
  handleInitializeWorkspaceForTest,
  handleListWorkspaceMemorySpacesForTest,
  handleOpenWorkspace,
  handleOpenWorkspaceMemorySpaceForTest,
  handleOpenWorkspaceForTest,
  handleRemoveMemorySpaceForTest,
  handleUpdateMemoryTitleForTest,
} from '../../src/main/workspaceIpc.js';
import { createWorkspaceHandleStore } from '../../src/main/workspaceHandles.js';
import { acquireWorkspaceLock } from '../../src/main/workspaceLock.js';
import {
  initializeWorkspaceFiles,
  setBeforeWorkspaceIndexReconciliationPersistForTest,
} from '../../src/main/workspaceFiles.js';
import {
  createMicrophoneIntent,
  decideMediaPermissionRequest,
  resetMicrophoneIntentsForTest,
} from '../../src/main/security.js';
import { setAfterWorkspaceReoDirectoryCheckForTest } from '../../src/main/workspacePaths.js';
import { createWorkspaceSelectionTokenStore } from '../../src/main/workspaceSelectionTokens.js';
import { createWorkspaceMemorySpaceRegistry } from '../../src/main/workspaceMemorySpaceRegistry.js';
import type {
  TrustedSenderEventAdapter,
  TrustedSenderIdentity,
} from '../../src/main/trustedSender.js';

const expectedSession = { label: 'default-session' };
const sender: TrustedSenderIdentity = {
  processId: 7,
  frameRoutingId: 4,
  origin: 'reo-app://renderer',
  sessionKey: 'default',
};
const event: TrustedSenderEventAdapter = {
  processId: 7,
  sender: { session: expectedSession },
  senderFrame: {
    routingId: 4,
    topRoutingId: 4,
    url: 'reo-app://renderer/index.html',
  },
};
const microphoneEvent = {
  ...event,
  sender: { ...event.sender, id: 101 },
};

async function assertWorkspaceLockCanBeReacquired(rootPath: string): Promise<void> {
  const lock = await acquireWorkspaceLock({ canonicalRoot: rootPath });
  assert.equal(lock.ok, true);
  if (lock.ok) {
    await lock.lock.release();
  }
}

async function writeFinalizedMemoryRecording({
  root,
  workspaceId,
  memoryId,
  recordingId,
  title,
}: {
  readonly root: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly recordingId: string;
  readonly title: string;
}): Promise<void> {
  const memoryDirectory = path.join(root, 'memories', memoryId);
  const recordingDirectory = path.join(memoryDirectory, 'recordings', recordingId);
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(
    path.join(memoryDirectory, 'memory.json'),
    `${JSON.stringify({
      memoryId,
      title,
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      assetIds: [recordingId],
    })}\n`
  );
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1, 2, 3]));
  await writeFile(path.join(recordingDirectory, 'transcript.md'), '');
  await writeFile(path.join(recordingDirectory, 'reflections.md'), '');
  await writeFile(
    path.join(recordingDirectory, 'recording.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      workspaceId,
      memoryId,
      recordingId,
      status: 'finalized',
      title,
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 3,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    })}\n`
  );
}

function createRegisteredHandleStore(
  rootPath: string,
  isUsable: () => boolean = () => true,
  release: () => Promise<void> = async () => {}
) {
  const handleStore = createWorkspaceHandleStore({ createHandle: () => 'wh_ipc' });
  handleStore.register({
    canonicalRoot: rootPath,
    workspaceId: 'ws_ipc',
    sender,
    lock: {
      isHeld: () => true,
      isUsable,
      release,
    },
  });
  return handleStore;
}

test('initializeWorkspace consumes selection token and never exposes rootPath', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-1',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-1',
      title: 'IPC 初始化',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_ipc',
    createHandle: () => 'wh_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      snapshot: {
        workspaceId: 'ws_ipc',
        title: 'IPC 初始化',
        description: '',
        memories: [],
      },
    });
    assert.equal('rootPath' in result.value, false);
  }

  const replay = await handleInitializeWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-1',
      title: '重放',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_replay',
    createHandle: () => 'wh_replay',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(replay.ok, false);
  if (!replay.ok) {
    assert.equal('rootPath' in replay.error, false);
  }
});

test('initializeWorkspace creates a named workspace directory under the selected parent', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-parent-'));
  const workspaceRoot = path.join(parentPath, '你好');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-named-child',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({
    rootPath: parentPath,
    displayPath: path.basename(parentPath),
    sender,
  });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-named-child',
      title: '你好',
      description: 'named child workspace',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_named_child',
    createHandle: () => 'wh_named_child',
    now: () => '2026-05-08T13:08:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.deepEqual((await readdir(parentPath)).sort(), ['你好']);
  assert.equal(
    await readFile(path.join(workspaceRoot, 'AGENTS.md'), 'utf8'),
    '# Reo workspace\n\n本文件是 Reo workspace 的 AI 协作入口。\n'
  );
  await assert.rejects(stat(path.join(parentPath, '.reo')));
  await assert.rejects(stat(path.join(parentPath, 'AGENTS.md')));
});

test('initializeWorkspace rejects an existing same-name workspace directory', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-existing-parent-'));
  const workspaceRoot = path.join(parentPath, '你好');
  await mkdir(workspaceRoot);
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-existing-child',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({
    rootPath: parentPath,
    displayPath: path.basename(parentPath),
    sender,
  });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-existing-child',
      title: '你好',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_existing_child',
    createHandle: () => 'wh_existing_child',
    now: () => '2026-05-08T13:08:00.000Z',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_ALREADY_EXISTS');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  assert.deepEqual(await readdir(parentPath), ['你好']);
  await assert.rejects(stat(path.join(workspaceRoot, '.reo')));
  await assert.rejects(stat(path.join(parentPath, '.reo')));
});

test('chooseDirectory response does not expose rootPath or equivalent absolute displayPath', async () => {
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-display',
    now: () => 1_000,
    ttlMs: 5_000,
  });

  const result = await handleChooseWorkspaceDirectory({
    event,
    input: undefined,
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    showOpenDirectoryDialog: async () => ({
      canceled: false,
      filePaths: ['/Users/example/Voice Notes'],
    }),
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      status: 'selected',
      selectionToken: 'selection-token-display',
      displayPath: 'Voice Notes',
    },
  });
});

test('beginMicrophoneIntent uses sender id from the IPC event and returns no raw path', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-mic-'));
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      drawerSessionId: 'drawer_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, { registered: true });
    assert.equal('rootPath' in result.value, false);
    assert.equal('microphoneIntentId' in result.value, false);
  }
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    true
  );
});

test('clearMicrophoneIntent requires the matching workspace handle owner', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-clear-mic-'));
  const handleStore = createRegisteredHandleStore(rootPath);

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      drawerSessionId: 'drawer_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  const result = await handleClearMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      drawerSessionId: 'drawer_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.deepEqual(result, { ok: true, value: { cleared: true } });
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('clearMicrophoneIntent clears pending intent after workspace lock is lost', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-clear-mic-lock-lost-'));
  let usable = true;
  const handleStore = createRegisteredHandleStore(rootPath, () => usable);

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      drawerSessionId: 'drawer_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  usable = false;
  const result = await handleClearMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      drawerSessionId: 'drawer_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.deepEqual(result, { ok: true, value: { cleared: true } });
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('closeWorkspace clears pending microphone intent for the closed workspace handle', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-close-mic-'));
  const handleStore = createRegisteredHandleStore(rootPath);

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      drawerSessionId: 'drawer_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  const closed = await handleCloseWorkspaceForTest({
    event,
    input: { workspaceHandle: 'wh_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.deepEqual(closed, { ok: true, value: { closed: true } });
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('closeWorkspace clears pending microphone intent after workspace lock is lost', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-close-mic-lock-lost-'));
  let usable = true;
  const handleStore = createRegisteredHandleStore(rootPath, () => usable);

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      drawerSessionId: 'drawer_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  usable = false;
  const closed = await handleCloseWorkspaceForTest({
    event,
    input: { workspaceHandle: 'wh_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.deepEqual(closed, { ok: true, value: { closed: true } });
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('closeWorkspace clears pending microphone intent when lock release fails', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-close-mic-release-fails-'));
  const handleStore = createRegisteredHandleStore(
    rootPath,
    () => true,
    async () => {
      throw new Error('release failed');
    }
  );

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      drawerSessionId: 'drawer_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  const closed = await handleCloseWorkspaceForTest({
    event,
    input: { workspaceHandle: 'wh_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(closed.ok, false);
  if (!closed.ok) {
    assert.equal(closed.error.code, 'ERR_WORKSPACE_LOCK_FAILED');
  }
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('window teardown clears all pending microphone intents through workspace cleanup', async () => {
  resetMicrophoneIntentsForTest();
  createMicrophoneIntent({
    senderId: 101,
    workspaceHandle: 'wh_teardown',
    drawerSessionId: 'drawer_1',
  });

  await closeAllWorkspaceHandles();

  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('getMemoryDetail returns finalized memory detail through a workspace handle', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memory-detail-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc',
    recordingId: 'rec_ipc',
    title: 'IPC 录音',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleGetMemoryDetailForTest({
    event,
    input: { workspaceHandle: 'wh_ipc', memoryId: 'mem_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.memoryId, 'mem_ipc');
    assert.equal(result.value.recordings[0]?.recordingId, 'rec_ipc');
    assert.equal('rootPath' in result.value, false);
  }
});

test('createMemory creates an empty Memory container through file truth', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memory-create-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleCreateMemoryForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      title: '产品灵感与思考',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    createMemoryId: () => 'mem_ipc_created',
    now: () => '2026-05-08T14:42:00.000Z',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      memoryId: 'mem_ipc_created',
      title: '产品灵感与思考',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      assetCount: 0,
      durationMs: 0,
      audioByteLength: 0,
      hasTranscript: false,
      hasReflections: false,
    });
  }
  assert.deepEqual(
    JSON.parse(
      await readFile(path.join(rootPath, 'memories', 'mem_ipc_created', 'memory.json'), 'utf8')
    ),
    {
      memoryId: 'mem_ipc_created',
      title: '产品灵感与思考',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      assetIds: [],
    }
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8')).memories,
    [
      {
        memoryId: 'mem_ipc_created',
        title: '产品灵感与思考',
        createdAt: '2026-05-08T14:42:00.000Z',
        updatedAt: '2026-05-08T14:42:00.000Z',
        assetCount: 0,
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        hasReflections: false,
      },
    ]
  );
});

test('createRecordingDraft returns a flat IPC response value', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-recording-draft-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 录音',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleCreateRecordingDraftForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    createRecordingId: () => 'rec_ipc_draft',
    now: () => '2026-05-08T14:42:00.000Z',
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      recordingId: 'rec_ipc_draft',
      nextSequence: 0,
    },
  });
});

test('updateMemoryTitle updates only the memory container through file truth', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memory-title-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc',
    recordingId: 'rec_ipc',
    title: '旧标题',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleUpdateMemoryTitleForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      memoryId: 'mem_ipc',
      title: '产品灵感与思考',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => '2026-05-08T14:42:00.000Z',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.memoryId, 'mem_ipc');
    assert.equal(result.value.title, '产品灵感与思考');
    assert.equal(result.value.assetCount, 1);
    assert.equal(result.value.updatedAt, '2026-05-08T14:42:00.000Z');
    assert.equal('rootPath' in result.value, false);
    assert.equal('assetIds' in result.value, false);
  }
  assert.deepEqual(
    JSON.parse(await readFile(path.join(rootPath, 'memories', 'mem_ipc', 'memory.json'), 'utf8')),
    {
      memoryId: 'mem_ipc',
      title: '产品灵感与思考',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      assetIds: ['rec_ipc'],
    }
  );
  assert.equal(
    JSON.parse(
      await readFile(
        path.join(rootPath, 'memories', 'mem_ipc', 'recordings', 'rec_ipc', 'recording.json'),
        'utf8'
      )
    ).title,
    '旧标题'
  );
});

test('getMemoryDetail stops when the workspace lock is lost during detail read', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memory-detail-lock-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc',
    recordingId: 'rec_ipc',
    title: 'IPC 录音',
  });
  let usableChecks = 0;
  const handleStore = createRegisteredHandleStore(rootPath, () => {
    usableChecks += 1;
    return usableChecks < 5;
  });

  const result = await handleGetMemoryDetailForTest({
    event,
    input: { workspaceHandle: 'wh_ipc', memoryId: 'mem_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
});

test('initializeWorkspace releases the lock when post-lock file writes throw', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-throw-'));
  const workspaceRoot = path.join(rootPath, '写入失败工作区');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-throw',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-init-throw',
      title: '写入失败工作区',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_init_throw',
    createHandle: () => 'wh_init_throw',
    now: () => '2026-05-06T13:08:00.000Z',
    afterWorkspaceLockAcquiredForTest: async () => {
      await mkdir(path.join(workspaceRoot, '.reo', 'workspace.json'), { recursive: true });
    },
  });

  assert.equal(result.ok, false);
  await assertWorkspaceLockCanBeReacquired(workspaceRoot);
});

test('initializeWorkspace rejects lock identity loss before workspace files are written', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-lock-lost-'));
  const workspaceRoot = path.join(rootPath, 'Lock lost');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-lock-lost',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-init-lock-lost',
      title: 'Lock lost',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_init_lock_lost',
    createHandle: () => 'wh_init_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
    afterWorkspaceLockAcquiredForTest: async () => {
      await rename(path.join(workspaceRoot, '.reo'), path.join(workspaceRoot, '.reo-preserved'));
      await mkdir(path.join(workspaceRoot, '.reo'));
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await assert.rejects(stat(path.join(workspaceRoot, 'AGENTS.md')));
  await assert.rejects(stat(path.join(workspaceRoot, '.reo', 'workspace.json')));
});

test('initializeWorkspace rejects lock identity loss during managed directory creation', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-mid-lock-lost-'));
  const workspaceRoot = path.join(rootPath, 'Lock lost');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-mid-lock-lost',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });
  setAfterWorkspaceReoDirectoryCheckForTest(async () => {
    setAfterWorkspaceReoDirectoryCheckForTest(null);
    await rename(path.join(workspaceRoot, '.reo'), path.join(workspaceRoot, '.reo-preserved'));
    await mkdir(path.join(workspaceRoot, '.reo'));
  });

  try {
    const result = await handleInitializeWorkspaceForTest({
      event,
      input: {
        selectionToken: 'selection-token-init-mid-lock-lost',
        title: 'Lock lost',
        description: '',
      },
      expectedSession,
      expectedSessionKey: 'default',
      isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
      tokenStore,
      createWorkspaceId: () => 'ws_init_mid_lock_lost',
      createHandle: () => 'wh_init_mid_lock_lost',
      now: () => '2026-05-06T13:08:00.000Z',
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
  } finally {
    setAfterWorkspaceReoDirectoryCheckForTest(null);
  }
  await assert.rejects(stat(path.join(workspaceRoot, 'AGENTS.md')));
  await assert.rejects(stat(path.join(workspaceRoot, '.reo', 'drafts')));
  await assert.rejects(stat(path.join(workspaceRoot, '.reo', 'workspace.json')));
});

test('initializeWorkspace releases the lock when handle registration throws', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-handle-throw-'));
  const workspaceRoot = path.join(rootPath, 'handle 注册失败工作区');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-handle-throw',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-init-handle-throw',
      title: 'handle 注册失败工作区',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_init_handle_throw',
    createHandle: () => {
      throw new Error('handle boom');
    },
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_INIT_FAILED');
  }
  await assertWorkspaceLockCanBeReacquired(workspaceRoot);
});

test('openWorkspace initializes an empty selected folder as a new workspace', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-empty-'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-empty',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-empty',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_open_empty',
    createHandle: () => 'wh_open_empty',
    now: () => '2026-05-08T13:09:00.000Z',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.workspaceHandle, 'wh_open_empty');
    assert.equal(result.value.workspaceId, 'ws_open_empty');
    assert.equal(result.value.snapshot.title, path.basename(rootPath));
  }
  assert.equal(
    await readFile(path.join(rootPath, 'AGENTS.md'), 'utf8'),
    '# Reo workspace\n\n本文件是 Reo workspace 的 AI 协作入口。\n'
  );
  await stat(path.join(rootPath, '.reo', 'workspace.json'));
});

test('openWorkspace rejects non-empty non-Reo directories before writing a workspace lock', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-non-empty-'));
  await writeFile(path.join(rootPath, 'notes.md'), 'not a Reo workspace\n');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-non-empty',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-non-empty',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(rootPath, '.reo')));
});

test('openWorkspace rejects a folder that becomes non-empty after the empty check', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-empty-race-'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-empty-race',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-empty-race',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_open_empty_race',
    createHandle: () => 'wh_open_empty_race',
    now: () => '2026-05-08T13:09:00.000Z',
    afterWorkspaceLockAcquiredForTest: async () => {
      await writeFile(path.join(rootPath, 'notes.md'), 'not a Reo workspace\n');
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(rootPath, '.reo')));
  await assertWorkspaceLockCanBeReacquired(rootPath);
});

test('openWorkspace registers imported memory spaces and listMemorySpaces never exposes rootPath', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-register-'));
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath: path.join(
      await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-')),
      'registry.json'
    ),
    now: () => '2026-05-08T07:48:00.000Z',
  });
  await initializeWorkspaceFiles({
    rootPath,
    title: 'Runtime validated memory',
    description: 'Final runtime validation workspace.',
    createWorkspaceId: () => 'ws_runtime_validated',
    now: () => '2026-05-08T07:47:00.000Z',
  });
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-memory-space-register',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const openResult = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-memory-space-register',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    memorySpaceRegistry,
  });

  assert.equal(openResult.ok, true);
  const listResult = await handleListWorkspaceMemorySpacesForTest({
    event,
    input: undefined,
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry,
  });

  assert.deepEqual(listResult, {
    ok: true,
    value: {
      memorySpaces: [
        {
          workspaceId: 'ws_runtime_validated',
          title: 'Runtime validated memory',
          description: 'Final runtime validation workspace.',
          addedAt: '2026-05-08T07:48:00.000Z',
          lastOpenedAt: '2026-05-08T07:48:00.000Z',
        },
      ],
    },
  });
  assert.equal(JSON.stringify(listResult).includes(rootPath), false);
});

test('listMemorySpaces returns an error envelope when the memory space registry cannot be read', async () => {
  const result = await handleListWorkspaceMemorySpacesForTest({
    event,
    input: undefined,
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry: {
      listMemorySpaces: async () => {
        throw new Error('registry unreadable');
      },
      resolveMemorySpaceRoot: async () => null,
      removeMemorySpace: async () => {},
      upsertMemorySpace: async () => {
        throw new Error('unused');
      },
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_READ_FAILED');
  }
});

test('openMemorySpace opens a persisted memory space without a selection token', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-open-'));
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-open-registry-')),
    'registry.json'
  );
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });
  await initializeWorkspaceFiles({
    rootPath,
    title: 'Runtime validated memory',
    description: 'Final runtime validation workspace.',
    createWorkspaceId: () => 'ws_runtime_validated',
    now: () => '2026-05-08T07:47:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_runtime_validated',
      title: 'Runtime validated memory',
      description: 'Final runtime validation workspace.',
      memories: [],
    },
  });
  const restartedMemorySpacesRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:50:00.000Z',
  });

  const result = await handleOpenWorkspaceMemorySpaceForTest({
    event,
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    createHandle: () => 'wh_memory_space_open',
    memorySpaceRegistry: restartedMemorySpacesRegistry,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      workspaceHandle: 'wh_memory_space_open',
      workspaceId: 'ws_runtime_validated',
      snapshot: {
        workspaceId: 'ws_runtime_validated',
        title: 'Runtime validated memory',
        description: 'Final runtime validation workspace.',
        memories: [],
      },
    });
    assert.equal('rootPath' in result.value, false);
  }
});

test('openMemorySpace reports a missing persisted workspace folder', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-missing-'));
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-missing-registry-')),
    'registry.json'
  );
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_deleted',
      title: 'Deleted workspace',
      description: '',
      memories: [],
    },
  });
  await rm(rootPath, { recursive: true, force: true });

  const result = await handleOpenWorkspaceMemorySpaceForTest({
    event,
    input: {
      workspaceId: 'ws_deleted',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_ROOT_MISSING');
    assert.equal(result.error.dataRetention, 'none-written');
  }
});

test('removeMemorySpace removes a persisted memory space without resolving or deleting its folder', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-remove-'));
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-remove-registry-')),
    'registry.json'
  );
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });
  await initializeWorkspaceFiles({
    rootPath,
    title: '测试1',
    description: '',
    createWorkspaceId: () => 'ws_test_1',
    now: () => '2026-05-08T07:47:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_test_1',
      title: '测试1',
      description: '',
      memories: [],
    },
  });

  const result = await handleRemoveMemorySpaceForTest({
    event,
    input: {
      workspaceId: 'ws_test_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry,
  });

  assert.deepEqual(result, { ok: true, value: { removed: true } });
  assert.deepEqual(await memorySpaceRegistry.listMemorySpaces(), []);
  assert.equal((await stat(path.join(rootPath, '.reo'))).isDirectory(), true);
});

test('openWorkspace releases the lock when post-lock recovery or index writes throw', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-throw-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_throw',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await rm(path.join(rootPath, '.reo', 'index.json'), { force: true });
  await mkdir(path.join(rootPath, '.reo', 'index.json'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-throw',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-throw',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
  });

  assert.equal(result.ok, false);
  await assertWorkspaceLockCanBeReacquired(rootPath);
});

test('openWorkspace rejects lock identity loss before workspace files are opened', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-lock-lost-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-lock-lost',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-lock-lost',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    afterWorkspaceLockAcquiredForTest: async () => {
      await rename(path.join(rootPath, '.reo'), path.join(rootPath, '.reo-preserved'));
      await mkdir(path.join(rootPath, '.reo'));
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await assert.rejects(stat(path.join(rootPath, '.reo', 'index.json')));
});

test('openWorkspace rejects lock identity loss during index reconciliation', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-mid-lock-lost-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_mid_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_open_mid_lock_lost',
    memoryId: 'mem_open_mid_lock_lost',
    recordingId: 'rec_open_mid_lock_lost',
    title: 'Open mid lock lost',
  });
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-mid-lock-lost',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });
  setBeforeWorkspaceIndexReconciliationPersistForTest(async () => {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
    await rename(path.join(rootPath, '.reo'), path.join(rootPath, '.reo-preserved'));
    await mkdir(path.join(rootPath, '.reo'));
  });

  try {
    const result = await handleOpenWorkspaceForTest({
      event,
      input: {
        selectionToken: 'selection-token-open-mid-lock-lost',
      },
      expectedSession,
      expectedSessionKey: 'default',
      isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
      tokenStore,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
  } finally {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
  }
  await assert.rejects(stat(path.join(rootPath, '.reo', 'index.json')));
});

test('openWorkspace releases the lock when handle registration throws', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-handle-throw-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_handle_throw',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-handle-throw',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-open-handle-throw',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    handleStore: createWorkspaceHandleStore({
      createHandle: () => {
        throw new Error('handle boom');
      },
    }),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_OPEN_FAILED');
  }
  await assertWorkspaceLockCanBeReacquired(rootPath);
});

test('openWorkspace rejects unsafe child directories before writing a workspace lock', async () => {
  const memoriesRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-memories-link-'));
  await initializeWorkspaceFiles({
    rootPath: memoriesRoot,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_memories_link',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const outsideMemories = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-memories-outside-'));
  await rm(path.join(memoriesRoot, 'memories'), { recursive: true });
  await symlink(outsideMemories, path.join(memoriesRoot, 'memories'));
  const memoriesTokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-memories-link',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  memoriesTokenStore.issueSelection({
    rootPath: memoriesRoot,
    displayPath: path.basename(memoriesRoot),
    sender,
  });

  const memoriesResult = await handleOpenWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-open-memories-link',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore: memoriesTokenStore,
  });

  assert.equal(memoriesResult.ok, false);
  if (!memoriesResult.ok) {
    assert.equal(memoriesResult.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    assert.equal(memoriesResult.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(memoriesRoot, '.reo', 'workspace.lock')));

  const draftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-drafts-link-'));
  await initializeWorkspaceFiles({
    rootPath: draftsRoot,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_drafts_link',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const outsideDrafts = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-drafts-outside-'));
  await rm(path.join(draftsRoot, '.reo', 'drafts'), { recursive: true });
  await symlink(outsideDrafts, path.join(draftsRoot, '.reo', 'drafts'));
  const draftsTokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-drafts-link',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  draftsTokenStore.issueSelection({
    rootPath: draftsRoot,
    displayPath: path.basename(draftsRoot),
    sender,
  });

  const draftsResult = await handleOpenWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-open-drafts-link',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore: draftsTokenStore,
  });

  assert.equal(draftsResult.ok, false);
  if (!draftsResult.ok) {
    assert.equal(draftsResult.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    assert.equal(draftsResult.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(draftsRoot, '.reo', 'workspace.lock')));
  await assert.rejects(stat(path.join(outsideDrafts, 'recordings')));
});

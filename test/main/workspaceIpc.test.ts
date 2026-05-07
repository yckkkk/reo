import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  handleChooseWorkspaceDirectory,
  handleInitializeWorkspace,
  handleInitializeWorkspaceForTest,
  handleOpenWorkspace,
  handleOpenWorkspaceForTest,
} from '../../src/main/workspaceIpc.js';
import { createWorkspaceHandleStore } from '../../src/main/workspaceHandles.js';
import { acquireWorkspaceLock } from '../../src/main/workspaceLock.js';
import {
  initializeWorkspaceFiles,
  setBeforeWorkspaceIndexReconciliationPersistForTest,
} from '../../src/main/workspaceFiles.js';
import { setAfterWorkspaceReoDirectoryCheckForTest } from '../../src/main/workspacePaths.js';
import { createWorkspaceSelectionTokenStore } from '../../src/main/workspaceSelectionTokens.js';
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
      sourceKind: 'recording',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      recordingIds: [recordingId],
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
        recordings: [],
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

test('initializeWorkspace rejects symlinked .reo before writing workspace files', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-symlink-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-outside-'));
  await symlink(outside, path.join(rootPath, '.reo'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-symlink',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-symlink',
      title: '不安全工作区',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_symlink',
    createHandle: () => 'wh_symlink',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  await assert.rejects(stat(path.join(outside, 'workspace.lock')));
  await assert.rejects(stat(path.join(outside, 'workspace.json')));
});

test('initializeWorkspace returns AGENTS conflict without leaving a workspace lock', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-conflict-'));
  await writeFile(path.join(rootPath, 'AGENTS.md'), '用户已有规则\n');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-conflict',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-conflict',
      title: '冲突工作区',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_conflict',
    createHandle: () => 'wh_conflict',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_AGENTS_CONFLICT');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(rootPath, '.reo')));
});

test('initializeWorkspace treats dangling AGENTS.md symlink as conflict before lock', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-dangling-conflict-'));
  await symlink(path.join(rootPath, 'missing-user-agents.md'), path.join(rootPath, 'AGENTS.md'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-dangling-conflict',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-dangling-conflict',
      title: '冲突工作区',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_conflict',
    createHandle: () => 'wh_conflict',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_AGENTS_CONFLICT');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(rootPath, '.reo')));
  await assert.rejects(stat(path.join(rootPath, 'memories')));
});

test('initializeWorkspace releases the lock when post-lock file writes throw', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-throw-'));
  await mkdir(path.join(rootPath, '.reo', 'workspace.json'), { recursive: true });
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-throw',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspace({
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
  });

  assert.equal(result.ok, false);
  await assertWorkspaceLockCanBeReacquired(rootPath);
});

test('initializeWorkspace rejects lock identity loss before workspace files are written', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-lock-lost-'));
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
      await rename(path.join(rootPath, '.reo'), path.join(rootPath, '.reo-preserved'));
      await mkdir(path.join(rootPath, '.reo'));
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await assert.rejects(stat(path.join(rootPath, 'AGENTS.md')));
  await assert.rejects(stat(path.join(rootPath, '.reo', 'workspace.json')));
});

test('initializeWorkspace rejects lock identity loss during managed directory creation', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-mid-lock-lost-'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-mid-lock-lost',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });
  setAfterWorkspaceReoDirectoryCheckForTest(async () => {
    setAfterWorkspaceReoDirectoryCheckForTest(null);
    await rename(path.join(rootPath, '.reo'), path.join(rootPath, '.reo-preserved'));
    await mkdir(path.join(rootPath, '.reo'));
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
  await assert.rejects(stat(path.join(rootPath, 'AGENTS.md')));
  await assert.rejects(stat(path.join(rootPath, '.reo', 'drafts')));
  await assert.rejects(stat(path.join(rootPath, '.reo', 'workspace.json')));
});

test('initializeWorkspace releases the lock when handle registration throws', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-handle-throw-'));
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
  await assertWorkspaceLockCanBeReacquired(rootPath);
});

test('initializeWorkspace returns an error envelope when the lock file target cannot be written', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-lock-target-'));
  await mkdir(path.join(rootPath, '.reo', 'workspace.lock'), { recursive: true });
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-lock-target',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-init-lock-target',
      title: 'Lock target failure',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_FAILED');
  }
});

test('openWorkspace rejects non-Reo directories before writing a workspace lock', async () => {
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
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(rootPath, '.reo')));
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

test('initializeWorkspace rejects unsafe memories targets before writing workspace files', async () => {
  const fileRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memories-file-'));
  await writeFile(path.join(fileRoot, 'memories'), 'not a directory\n');
  const fileTokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-memories-file',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  fileTokenStore.issueSelection({
    rootPath: fileRoot,
    displayPath: path.basename(fileRoot),
    sender,
  });

  const fileResult = await handleInitializeWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-memories-file',
      title: '非法 memories',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore: fileTokenStore,
    createWorkspaceId: () => 'ws_memories_file',
    createHandle: () => 'wh_memories_file',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(fileResult.ok, false);
  if (!fileResult.ok) {
    assert.equal(fileResult.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    assert.equal(fileResult.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(fileRoot, '.reo')));

  const symlinkRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memories-link-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memories-outside-'));
  await symlink(outside, path.join(symlinkRoot, 'memories'));
  const symlinkTokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-memories-link',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  symlinkTokenStore.issueSelection({
    rootPath: symlinkRoot,
    displayPath: path.basename(symlinkRoot),
    sender,
  });

  const symlinkResult = await handleInitializeWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-memories-link',
      title: '非法 memories 链接',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore: symlinkTokenStore,
    createWorkspaceId: () => 'ws_memories_link',
    createHandle: () => 'wh_memories_link',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(symlinkResult.ok, false);
  if (!symlinkResult.ok) {
    assert.equal(symlinkResult.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    assert.equal(symlinkResult.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(symlinkRoot, '.reo')));
});

test('initializeWorkspace rejects symlinked .reo draft ancestors before writing outside workspace', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-drafts-link-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-drafts-outside-'));
  await mkdir(path.join(rootPath, '.reo'));
  await symlink(outside, path.join(rootPath, '.reo', 'drafts'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-drafts-link',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-drafts-link',
      title: '非法 drafts 链接',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_drafts_link',
    createHandle: () => 'wh_drafts_link',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(outside, 'recordings')));
  await assert.rejects(stat(path.join(rootPath, 'AGENTS.md')));
});

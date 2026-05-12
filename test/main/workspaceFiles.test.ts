import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
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
  initializeWorkspaceFiles,
  openWorkspaceFiles,
  readWorkspaceSnapshotFromFileTruth,
  setBeforeWorkspaceJsonNoFollowFinalAssertForTest,
  setBeforeWorkspaceIndexReconciliationPersistForTest,
  updateWorkspaceTitleFromFileTruth,
  updateWorkspaceIndex,
} from '../../src/main/workspaceFiles.js';
import { setAfterAtomicWorkspaceFileTempOpenForTest } from '../../src/main/atomicWorkspaceFile.js';
import { setBeforeReadModelReaddirForTest } from '../../src/main/memoryFiles.js';
import { setAfterWorkspaceReoDirectoryCheckForTest } from '../../src/main/workspacePaths.js';

async function sha256(filePath: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex');
}

async function writeFinalizedMemoryRecording({
  root,
  workspaceId,
  memoryId,
  segmentId,
  title,
  audio,
  durationMs,
}: {
  readonly root: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly audio: Uint8Array;
  readonly durationMs: number;
}): Promise<void> {
  const memoryDirectory = path.join(root, 'memories', memoryId);
  const recordingDirectory = path.join(memoryDirectory, 'segments', segmentId);
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(
    path.join(memoryDirectory, 'memory.json'),
    `${JSON.stringify(
      {
        memoryId,
        title,
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:09:00.000Z',
        segmentIds: [segmentId],
      },
      null,
      2
    )}\n`
  );
  await writeFile(path.join(recordingDirectory, 'audio.webm'), audio);
  await writeFile(path.join(recordingDirectory, 'transcript.md'), '');
  await writeFile(
    path.join(recordingDirectory, 'segment.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId,
        memoryId,
        segmentId,
        type: 'audio',
        status: 'finalized',
        title,
        createdAt: '2026-05-06T13:08:00.000Z',
        finalizedAt: '2026-05-06T13:09:00.000Z',
        durationMs,
        nextSequence: 1,
        audioByteLength: audio.byteLength,
        transcriptPath: 'transcript.md',
      },
      null,
      2
    )}\n`
  );
}

test('existing AGENTS.md conflict does not write any workspace files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-conflict-'));
  const agentsPath = path.join(root, 'AGENTS.md');
  await writeFile(agentsPath, '用户已有规则\n');
  const beforeHash = await sha256(agentsPath);

  const result = await initializeWorkspaceFiles({
    rootPath: root,
    title: '会议记录',
    description: '产品讨论',
    createWorkspaceId: () => 'ws_conflict',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_AGENTS_CONFLICT');
  }
  assert.equal(await sha256(agentsPath), beforeHash);
  await assert.rejects(stat(path.join(root, '.reo')));
});

test('dangling AGENTS.md symlink conflict does not write workspace files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-dangling-agents-'));
  await symlink(path.join(root, 'missing-user-agents.md'), path.join(root, 'AGENTS.md'));

  const result = await initializeWorkspaceFiles({
    rootPath: root,
    title: '会议记录',
    description: '产品讨论',
    createWorkspaceId: () => 'ws_conflict',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_AGENTS_CONFLICT');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(root, '.reo')));
  await assert.rejects(stat(path.join(root, 'memories')));
});

test('workspace init creates only stable first-slice files and no future capability folders', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-init-'));

  const result = await initializeWorkspaceFiles({
    rootPath: root,
    title: '记忆录音',
    description: '第一产品切片',
    createWorkspaceId: () => 'ws_20260506_000001',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.deepEqual(result, {
    ok: true,
    snapshot: {
      workspaceId: 'ws_20260506_000001',
      title: '记忆录音',
      description: '第一产品切片',
      memories: [],
    },
  });
  assert.deepEqual((await readdir(root)).sort(), ['.reo', 'AGENTS.md', 'memories']);
  assert.deepEqual((await readdir(path.join(root, '.reo'))).sort(), [
    'drafts',
    'index.json',
    'workspace.json',
  ]);
  assert.deepEqual(await readdir(path.join(root, '.reo', 'drafts')), ['segments']);
  for (const forbidden of ['photos', 'videos', 'files', 'films']) {
    await assert.rejects(stat(path.join(root, forbidden)));
  }
});

test('corrupt index rebuilds while corrupt workspace metadata blocks writes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '可重建索引',
    description: '',
    createWorkspaceId: () => 'ws_rebuild',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFile(path.join(root, '.reo', 'index.json'), '{not json');

  assert.deepEqual(await openWorkspaceFiles({ rootPath: root }), {
    ok: true,
    snapshot: {
      workspaceId: 'ws_rebuild',
      title: '可重建索引',
      description: '',
      memories: [],
    },
  });

  const corruptRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-corrupt-meta-'));
  await mkdir(path.join(corruptRoot, '.reo'), { recursive: true });
  await writeFile(path.join(corruptRoot, '.reo', 'workspace.json'), '{not json');

  const corrupt = await openWorkspaceFiles({ rootPath: corruptRoot });
  assert.equal(corrupt.ok, false);
  if (!corrupt.ok) {
    assert.equal(corrupt.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
  }
  await assert.rejects(stat(path.join(corruptRoot, 'AGENTS.md')));
});

test('open workspace rejects symlinked workspace metadata', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-metadata-symlink-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-metadata-outside-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '元数据链接',
    description: '',
    createWorkspaceId: () => 'ws_metadata_link',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const outsideMetadata = path.join(outside, 'workspace.json');
  await writeFile(
    outsideMetadata,
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_outside',
      title: 'Outside',
      description: '',
      createdAt: '2026-05-06T13:08:00.000Z',
    })
  );
  await rm(path.join(root, '.reo', 'workspace.json'));
  await symlink(outsideMetadata, path.join(root, '.reo', 'workspace.json'));

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, false);
  if (!opened.ok) {
    assert.equal(opened.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
  }
});

test('open workspace rejects workspace metadata when .reo changes during read', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-metadata-parent-swap-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '元数据父目录交换',
    description: '',
    createWorkspaceId: () => 'ws_metadata_parent_swap',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  setBeforeWorkspaceJsonNoFollowFinalAssertForTest(async (filePath) => {
    if (path.basename(filePath) !== 'workspace.json') {
      return;
    }
    setBeforeWorkspaceJsonNoFollowFinalAssertForTest(null);
    await rename(path.join(root, '.reo'), path.join(root, '.reo-preserved'));
    await mkdir(path.join(root, '.reo'));
    await writeFile(
      path.join(root, '.reo', 'workspace.json'),
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws_replaced',
        title: 'Replaced',
        description: '',
        createdAt: '2026-05-06T13:08:00.000Z',
      })
    );
  });

  try {
    const opened = await openWorkspaceFiles({ rootPath: root });
    assert.equal(opened.ok, false);
    if (!opened.ok) {
      assert.equal(opened.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
    }
  } finally {
    setBeforeWorkspaceJsonNoFollowFinalAssertForTest(null);
  }
});

test('open workspace rebuilds instead of trusting a symlinked index', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-index-symlink-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-index-outside-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '索引链接',
    description: '',
    createWorkspaceId: () => 'ws_index_link',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const outsideIndex = path.join(outside, 'index.json');
  await writeFile(outsideIndex, '{\n  "schemaVersion": 1,\n  "memories": []\n}\n');
  await rm(path.join(root, '.reo', 'index.json'));
  await symlink(outsideIndex, path.join(root, '.reo', 'index.json'));

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, true);
  const indexEntry = await lstat(path.join(root, '.reo', 'index.json'));
  assert.equal(indexEntry.isSymbolicLink(), false);
  assert.equal(
    await readFile(outsideIndex, 'utf8'),
    '{\n  "schemaVersion": 1,\n  "memories": []\n}\n'
  );
});

test('corrupt index rebuilds finalized memory summaries from workspace files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-rebuild-memories-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '录音索引',
    description: '',
    createWorkspaceId: () => 'ws_rebuild_memories',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_rebuild_memories',
    memoryId: 'mem_20260506_000001',
    segmentId: 'seg_20260506_000001',
    title: '重建录音',
    audio: new Uint8Array([1, 2, 3]),
    durationMs: 12_000,
  });
  await writeFile(path.join(root, '.reo', 'index.json'), '{not json');

  const expectedMemory = {
    memoryId: 'mem_20260506_000001',
    title: '重建录音',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:09:00.000Z',
    segmentCount: 1,
    durationMs: 12_000,
    audioByteLength: 3,
    hasTranscript: false,
    attachmentCount: 0,
  };
  assert.deepEqual(await openWorkspaceFiles({ rootPath: root }), {
    ok: true,
    snapshot: {
      workspaceId: 'ws_rebuild_memories',
      title: '录音索引',
      description: '',
      memories: [expectedMemory],
    },
  });
  assert.deepEqual(JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8')), {
    schemaVersion: 1,
    memories: [expectedMemory],
  });
});

test('open workspace uses a valid index without scanning finalized memory files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-fast-open-index-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '快速进入',
    description: '',
    createWorkspaceId: () => 'ws_fast_open',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const indexedMemory = {
    memoryId: 'mem_fast_open',
    title: '已索引记忆',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:09:00.000Z',
    segmentCount: 1,
    durationMs: 3000,
    audioByteLength: 3,
    hasTranscript: false,
    attachmentCount: 0,
  };
  await writeFile(
    path.join(root, '.reo', 'index.json'),
    `${JSON.stringify({ schemaVersion: 1, memories: [indexedMemory] }, null, 2)}\n`
  );
  setBeforeReadModelReaddirForTest(() => {
    throw new Error('open should not rebuild the read model when index is valid');
  });

  try {
    assert.deepEqual(await openWorkspaceFiles({ rootPath: root }), {
      ok: true,
      snapshot: {
        workspaceId: 'ws_fast_open',
        title: '快速进入',
        description: '',
        memories: [indexedMemory],
      },
    });
  } finally {
    setBeforeReadModelReaddirForTest(null);
  }
});

test('open workspace fails without replacing index when memories cannot be read', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-unreadable-memories-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '不可读目录',
    description: '',
    createWorkspaceId: () => 'ws_unreadable_memories',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_unreadable_memories',
    memoryId: 'mem_20260506_unreadable',
    segmentId: 'seg_20260506_unreadable',
    title: '不可读录音',
    audio: new Uint8Array([1, 2, 3]),
    durationMs: 3000,
  });
  await openWorkspaceFiles({ rootPath: root });
  const indexPath = path.join(root, '.reo', 'index.json');
  const indexBefore = await readFile(indexPath, 'utf8');

  await chmod(path.join(root, 'memories'), 0o000);
  try {
    const opened = await openWorkspaceFiles({ rootPath: root });
    assert.equal(opened.ok, false);
    if (!opened.ok) {
      assert.equal(opened.error.code, 'ERR_WORKSPACE_OPEN_FAILED');
    }
  } finally {
    await chmod(path.join(root, 'memories'), 0o700);
  }

  assert.equal(await readFile(indexPath, 'utf8'), indexBefore);
});

test('open workspace uses stale valid index and snapshot refresh reconciles file truth', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-stale-index-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '合法但陈旧索引',
    description: '',
    createWorkspaceId: () => 'ws_stale_index',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_stale_index',
    memoryId: 'mem_20260506_000002',
    segmentId: 'seg_20260506_000002',
    title: '崩溃后录音',
    audio: new Uint8Array([4, 5, 6, 7]),
    durationMs: 34_000,
  });
  await writeFile(
    path.join(root, '.reo', 'index.json'),
    '{\n  "schemaVersion": 1,\n  "memories": []\n}\n'
  );

  const expectedMemory = {
    memoryId: 'mem_20260506_000002',
    title: '崩溃后录音',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:09:00.000Z',
    segmentCount: 1,
    durationMs: 34_000,
    audioByteLength: 4,
    hasTranscript: false,
    attachmentCount: 0,
  };
  assert.deepEqual(await openWorkspaceFiles({ rootPath: root }), {
    ok: true,
    snapshot: {
      workspaceId: 'ws_stale_index',
      title: '合法但陈旧索引',
      description: '',
      memories: [],
    },
  });
  assert.deepEqual(JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8')), {
    schemaVersion: 1,
    memories: [],
  });

  assert.deepEqual(
    await readWorkspaceSnapshotFromFileTruth({
      rootPath: root,
      workspaceId: 'ws_stale_index',
    }),
    {
      ok: true,
      snapshot: {
        workspaceId: 'ws_stale_index',
        title: '合法但陈旧索引',
        description: '',
        memories: [expectedMemory],
      },
    }
  );
  assert.deepEqual(JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8')), {
    schemaVersion: 1,
    memories: [expectedMemory],
  });
});

test('open workspace returns valid index without reconciliation before returning ready', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-reconcile-swap-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Open reconcile swap',
    description: '',
    createWorkspaceId: () => 'ws_open_reconcile_swap',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_open_reconcile_swap',
    memoryId: 'mem_open_reconcile_swap',
    segmentId: 'seg_open_reconcile_swap',
    title: 'Open reconcile swap',
    audio: new Uint8Array([1, 2, 3]),
    durationMs: 3000,
  });
  const previousIndex = await readFile(path.join(root, '.reo', 'index.json'), 'utf8');
  let reconciliationStarted = false;
  setBeforeWorkspaceIndexReconciliationPersistForTest(async () => {
    reconciliationStarted = true;
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
    await rename(path.join(root, 'memories'), path.join(root, 'memories-preserved'));
    await mkdir(path.join(root, 'memories'));
  });

  try {
    const opened = await openWorkspaceFiles({ rootPath: root });
    assert.equal(opened.ok, true);
  } finally {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
  }
  assert.equal(reconciliationStarted, false);
  assert.equal(await readFile(path.join(root, '.reo', 'index.json'), 'utf8'), previousIndex);
});

test('workspace snapshot refresh preserves the existing index when memories root changes before reconciliation persist', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-snapshot-reconcile-swap-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Snapshot reconcile swap',
    description: '',
    createWorkspaceId: () => 'ws_snapshot_reconcile_swap',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_snapshot_reconcile_swap',
    memoryId: 'mem_snapshot_reconcile_swap',
    segmentId: 'seg_snapshot_reconcile_swap',
    title: 'Snapshot reconcile swap',
    audio: new Uint8Array([1, 2, 3]),
    durationMs: 3000,
  });
  const previousIndex = await readFile(path.join(root, '.reo', 'index.json'), 'utf8');
  setBeforeWorkspaceIndexReconciliationPersistForTest(async () => {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
    await rename(path.join(root, 'memories'), path.join(root, 'memories-preserved'));
    await mkdir(path.join(root, 'memories'));
  });

  try {
    const snapshot = await readWorkspaceSnapshotFromFileTruth({
      rootPath: root,
      workspaceId: 'ws_snapshot_reconcile_swap',
    });
    assert.equal(snapshot.ok, false);
  } finally {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
  }
  assert.equal(await readFile(path.join(root, '.reo', 'index.json'), 'utf8'), previousIndex);
});

test('workspace title update uses a valid index without rebuilding memory file truth', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-title-reconcile-swap-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Title reconcile swap',
    description: '',
    createWorkspaceId: () => 'ws_title_reconcile_swap',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_title_reconcile_swap',
    memoryId: 'mem_title_reconcile_swap',
    segmentId: 'seg_title_reconcile_swap',
    title: 'Title reconcile swap',
    audio: new Uint8Array([1, 2, 3]),
    durationMs: 3000,
  });
  await readWorkspaceSnapshotFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_title_reconcile_swap',
  });
  const previousIndex = await readFile(path.join(root, '.reo', 'index.json'), 'utf8');
  setBeforeWorkspaceIndexReconciliationPersistForTest(async () => {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
    throw new Error('workspace title update should not rebuild a valid index');
  });

  try {
    const updated = await updateWorkspaceTitleFromFileTruth({
      rootPath: root,
      workspaceId: 'ws_title_reconcile_swap',
      title: 'Renamed title',
    });
    assert.equal(updated.ok, true);
    if (updated.ok) {
      assert.equal(updated.snapshot.title, 'Renamed title');
      assert.equal(updated.snapshot.memories[0]?.memoryId, 'mem_title_reconcile_swap');
    }
  } finally {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
  }
  assert.equal(await readFile(path.join(root, '.reo', 'index.json'), 'utf8'), previousIndex);
  assert.equal(
    JSON.parse(await readFile(path.join(root, '.reo', 'workspace.json'), 'utf8')).title,
    'Renamed title'
  );
});

test('open workspace reports lock lost before target revalidation errors', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-pre-lock-lost-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Open pre lock lost',
    description: '',
    createWorkspaceId: () => 'ws_open_pre_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await rename(path.join(root, '.reo'), path.join(root, '.reo-preserved'));
  await mkdir(path.join(root, '.reo'));

  const opened = await openWorkspaceFiles({
    rootPath: root,
    assertWorkspaceUsable: () => ({
      ok: false as const,
      error: {
        code: 'ERR_WORKSPACE_LOCK_LOST',
        dataRetention: 'none-written',
        message: 'Workspace lock was lost',
      },
    }),
  });

  assert.equal(opened.ok, false);
  if (!opened.ok) {
    assert.equal(opened.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
});

test('initialize workspace does not write AGENTS when lock is lost inside atomic write', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-init-atomic-lock-lost-'));
  let usable = true;
  setAfterAtomicWorkspaceFileTempOpenForTest(() => {
    usable = false;
    setAfterAtomicWorkspaceFileTempOpenForTest(null);
  });

  try {
    const initialized = await initializeWorkspaceFiles({
      rootPath: root,
      title: 'Init atomic lock lost',
      description: '',
      createWorkspaceId: () => 'ws_init_atomic_lock_lost',
      now: () => '2026-05-06T13:08:00.000Z',
      assertWorkspaceUsable: () =>
        usable
          ? { ok: true as const }
          : {
              ok: false as const,
              error: {
                code: 'ERR_WORKSPACE_LOCK_LOST',
                dataRetention: 'none-written',
                message: 'Workspace lock was lost',
              },
            },
    });
    assert.equal(initialized.ok, false);
    if (!initialized.ok) {
      assert.equal(initialized.error.code, 'ERR_WORKSPACE_LOCK_LOST');
      assert.equal(initialized.error.dataRetention, 'none-written');
    }
  } finally {
    setAfterAtomicWorkspaceFileTempOpenForTest(null);
  }

  await assert.rejects(stat(path.join(root, 'AGENTS.md')));
});

test('open workspace does not create drafts when lock identity is lost during drafts ensure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-drafts-lock-lost-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Open drafts lock lost',
    description: '',
    createWorkspaceId: () => 'ws_open_drafts_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await rm(path.join(root, '.reo', 'drafts'), { force: true, recursive: true });
  let usable = true;
  setAfterWorkspaceReoDirectoryCheckForTest(async () => {
    setAfterWorkspaceReoDirectoryCheckForTest(null);
    usable = false;
    await rename(path.join(root, '.reo'), path.join(root, '.reo-preserved'));
    await mkdir(path.join(root, '.reo'));
  });

  try {
    const opened = await openWorkspaceFiles({
      rootPath: root,
      assertWorkspaceUsable: () =>
        usable
          ? { ok: true as const }
          : {
              ok: false as const,
              error: {
                code: 'ERR_WORKSPACE_LOCK_LOST',
                dataRetention: 'none-written',
                message: 'Workspace lock was lost',
              },
            },
    });
    assert.equal(opened.ok, false);
    if (!opened.ok) {
      assert.equal(opened.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
  } finally {
    setAfterWorkspaceReoDirectoryCheckForTest(null);
  }
  await assert.rejects(stat(path.join(root, '.reo', 'drafts')));
});

test('workspace snapshot refresh computes replacement after a metadata refresh', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-reconcile-current-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Open reconcile current',
    description: '',
    createWorkspaceId: () => 'ws_open_reconcile_current',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_open_reconcile_current',
    memoryId: 'mem_open_reconcile_current',
    segmentId: 'seg_open_reconcile_current',
    title: 'Open reconcile current',
    audio: new Uint8Array([1, 2, 3]),
    durationMs: 3000,
  });
  setBeforeWorkspaceIndexReconciliationPersistForTest(async () => {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
    await writeFile(
      path.join(
        root,
        'memories',
        'mem_open_reconcile_current',
        'segments',
        'seg_open_reconcile_current',
        'transcript.md'
      ),
      'Open-time transcript\n'
    );
  });

  try {
    const snapshot = await readWorkspaceSnapshotFromFileTruth({
      rootPath: root,
      workspaceId: 'ws_open_reconcile_current',
    });
    assert.equal(snapshot.ok, true);
    if (snapshot.ok) {
      assert.equal(snapshot.snapshot.memories[0]?.hasTranscript, true);
    }
  } finally {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
  }
  const index = JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8'));
  assert.equal(index.memories[0].hasTranscript, true);
});

test('open workspace recreates missing managed directories before returning ready', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-open-managed-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '托管目录',
    description: '',
    createWorkspaceId: () => 'ws_open_managed',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await rm(path.join(root, '.reo', 'drafts'), { force: true, recursive: true });
  await rm(path.join(root, 'memories'), { force: true, recursive: true });

  const opened = await openWorkspaceFiles({ rootPath: root });

  assert.equal(opened.ok, true);
  await stat(path.join(root, '.reo', 'drafts', 'segments'));
  await stat(path.join(root, 'memories'));
});

test('workspace index update does not persist reconciliation before update succeeds', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-index-update-failure-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '更新失败索引',
    description: '',
    createWorkspaceId: () => 'ws_index_update_failure',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_index_update_failure',
    memoryId: 'mem_20260506_000003',
    segmentId: 'seg_20260506_000003',
    title: '不应提前写入',
    audio: new Uint8Array([8, 9]),
    durationMs: 5_000,
  });
  await writeFile(
    path.join(root, '.reo', 'index.json'),
    '{\n  "schemaVersion": 1,\n  "memories": []\n}\n'
  );

  await assert.rejects(
    updateWorkspaceIndex(root, () => {
      throw new Error('Index update failed');
    }),
    /Index update failed/
  );

  assert.deepEqual(JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8')), {
    schemaVersion: 1,
    memories: [],
  });
});

test('index rebuild ignores symlinked transcript presence files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-markdown-presence-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-markdown-outside-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Markdown presence',
    description: '',
    createWorkspaceId: () => 'ws_markdown_presence',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root,
    workspaceId: 'ws_markdown_presence',
    memoryId: 'mem_20260506_markdown_presence',
    segmentId: 'seg_20260506_markdown_presence',
    title: 'Markdown presence',
    audio: new Uint8Array([1]),
    durationMs: 1000,
  });
  const recordingDirectory = path.join(
    root,
    'memories',
    'mem_20260506_markdown_presence',
    'segments',
    'seg_20260506_markdown_presence'
  );
  await writeFile(path.join(outside, 'transcript.md'), 'outside transcript');
  await rm(path.join(recordingDirectory, 'transcript.md'));
  await symlink(
    path.join(outside, 'transcript.md'),
    path.join(recordingDirectory, 'transcript.md')
  );

  const opened = await readWorkspaceSnapshotFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_markdown_presence',
  });

  assert.equal(opened.ok, true);
  if (opened.ok) {
    assert.equal(opened.snapshot.memories[0]?.hasTranscript, false);
    assert.equal(opened.snapshot.memories[0]?.attachmentCount, 0);
  }
});

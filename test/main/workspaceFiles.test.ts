import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  initializeWorkspaceFiles,
  openWorkspaceFiles,
  updateWorkspaceIndex,
} from '../../src/main/workspaceFiles.js';

async function sha256(filePath: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex');
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
      recordings: [],
    },
  });
  assert.deepEqual((await readdir(root)).sort(), ['.reo', 'AGENTS.md', 'recordings']);
  assert.deepEqual((await readdir(path.join(root, '.reo'))).sort(), [
    'index.json',
    'workspace.json',
  ]);
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
      recordings: [],
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

test('corrupt index rebuilds finalized recording summaries from workspace files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-rebuild-recordings-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '录音索引',
    description: '',
    createWorkspaceId: () => 'ws_rebuild_recordings',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const recordingDirectory = path.join(root, 'recordings', 'rec_20260506_000001');
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1, 2, 3]));
  await writeFile(
    path.join(recordingDirectory, 'recording.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_rebuild_recordings',
        recordingId: 'rec_20260506_000001',
        status: 'finalized',
        title: '重建录音',
        createdAt: '2026-05-06T13:08:00.000Z',
        finalizedAt: '2026-05-06T13:09:00.000Z',
        nextSequence: 1,
        audioByteLength: 3,
      },
      null,
      2
    )}\n`
  );
  await writeFile(path.join(root, '.reo', 'index.json'), '{not json');

  assert.deepEqual(await openWorkspaceFiles({ rootPath: root }), {
    ok: true,
    snapshot: {
      workspaceId: 'ws_rebuild_recordings',
      title: '录音索引',
      description: '',
      recordings: [
        {
          recordingId: 'rec_20260506_000001',
          title: '重建录音',
          audioByteLength: 3,
        },
      ],
    },
  });
  assert.deepEqual(JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8')), {
    schemaVersion: 1,
    recordings: [
      {
        recordingId: 'rec_20260506_000001',
        title: '重建录音',
        audioByteLength: 3,
      },
    ],
  });
});

test('valid but stale index is reconciled from finalized workspace files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-stale-index-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '合法但陈旧索引',
    description: '',
    createWorkspaceId: () => 'ws_stale_index',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const recordingDirectory = path.join(root, 'recordings', 'rec_20260506_000002');
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([4, 5, 6, 7]));
  await writeFile(
    path.join(recordingDirectory, 'recording.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_stale_index',
        recordingId: 'rec_20260506_000002',
        status: 'finalized',
        title: '崩溃后录音',
        createdAt: '2026-05-06T13:08:00.000Z',
        finalizedAt: '2026-05-06T13:09:00.000Z',
        nextSequence: 1,
        audioByteLength: 4,
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    path.join(root, '.reo', 'index.json'),
    '{\n  "schemaVersion": 1,\n  "recordings": []\n}\n'
  );

  assert.deepEqual(await openWorkspaceFiles({ rootPath: root }), {
    ok: true,
    snapshot: {
      workspaceId: 'ws_stale_index',
      title: '合法但陈旧索引',
      description: '',
      recordings: [
        {
          recordingId: 'rec_20260506_000002',
          title: '崩溃后录音',
          audioByteLength: 4,
        },
      ],
    },
  });
  assert.deepEqual(JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8')), {
    schemaVersion: 1,
    recordings: [
      {
        recordingId: 'rec_20260506_000002',
        title: '崩溃后录音',
        audioByteLength: 4,
      },
    ],
  });
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
  const recordingDirectory = path.join(root, 'recordings', 'rec_20260506_000003');
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([8, 9]));
  await writeFile(
    path.join(recordingDirectory, 'recording.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_index_update_failure',
        recordingId: 'rec_20260506_000003',
        status: 'finalized',
        title: '不应提前写入',
        createdAt: '2026-05-06T13:08:00.000Z',
        finalizedAt: '2026-05-06T13:09:00.000Z',
        nextSequence: 1,
        audioByteLength: 2,
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    path.join(root, '.reo', 'index.json'),
    '{\n  "schemaVersion": 1,\n  "recordings": []\n}\n'
  );

  await assert.rejects(
    updateWorkspaceIndex(root, () => {
      throw new Error('Index update failed');
    }),
    /Index update failed/
  );

  assert.deepEqual(JSON.parse(await readFile(path.join(root, '.reo', 'index.json'), 'utf8')), {
    schemaVersion: 1,
    recordings: [],
  });
});

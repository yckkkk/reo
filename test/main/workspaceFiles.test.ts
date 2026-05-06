import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { initializeWorkspaceFiles, openWorkspaceFiles } from '../../src/main/workspaceFiles.js';

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

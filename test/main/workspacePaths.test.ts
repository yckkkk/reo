import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rename, stat, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createSafeSegmentId,
  ensureWorkspaceMemoriesDirectory,
  ensureWorkspaceReoDirectory,
  ensureWorkspaceDraftsDirectory,
  resolveWorkspaceRoot,
  setAfterWorkspaceReoDirectoryCheckForTest,
  setBeforeWorkspaceRootRealpathForTest,
  setBeforeWorkspaceRootChildDirectoryCreateForTest,
} from '../../src/main/workspacePaths.js';

test('workspace root resolves to canonical real path and rejects symlink roots', async () => {
  const realRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-workspace-root-'));
  const linkRoot = `${realRoot}-link`;
  await symlink(realRoot, linkRoot);

  const resolved = await resolveWorkspaceRoot(realRoot);
  assert.equal(resolved, await realpath(realRoot));

  const rejected = await resolveWorkspaceRoot(linkRoot);
  assert.notEqual(typeof rejected, 'string');
  if (typeof rejected !== 'string') {
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
});

test('workspace root rejects root swap before canonical realpath', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-workspace-root-swap-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-workspace-root-outside-'));

  setBeforeWorkspaceRootRealpathForTest(async () => {
    setBeforeWorkspaceRootRealpathForTest(null);
    await rename(root, `${root}-preserved`);
    await symlink(outside, root, 'dir');
  });

  try {
    const resolved = await resolveWorkspaceRoot(root);

    assert.notEqual(typeof resolved, 'string');
    if (typeof resolved !== 'string') {
      assert.equal(resolved.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    }
  } finally {
    setBeforeWorkspaceRootRealpathForTest(null);
  }
});

test('segment ids reject traversal and slash characters', () => {
  assert.equal(createSafeSegmentId('seg_20260506_000001'), 'seg_20260506_000001');
  assert.throws(() => createSafeSegmentId('../escape'));
  assert.throws(() => createSafeSegmentId('seg_bad/slash'));
});

test('managed draft directory creation rejects .reo ancestor swap before child mkdir', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-managed-drafts-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-managed-drafts-outside-'));
  await mkdir(path.join(root, '.reo'));

  setAfterWorkspaceReoDirectoryCheckForTest(async () => {
    await rename(path.join(root, '.reo'), path.join(root, '.reo-preserved'));
    await symlink(outside, path.join(root, '.reo'), 'dir');
  });
  const result = await ensureWorkspaceDraftsDirectory(root);
  setAfterWorkspaceReoDirectoryCheckForTest(null);

  assert.notEqual(typeof result, 'string');
  if (typeof result !== 'string') {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  await assert.rejects(stat(path.join(outside, 'drafts')));
});

test('managed .reo directory creation rejects root swap before child mkdir', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-managed-reo-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-managed-reo-outside-'));
  setBeforeWorkspaceRootChildDirectoryCreateForTest(async (directoryName) => {
    if (directoryName === '.reo') {
      setBeforeWorkspaceRootChildDirectoryCreateForTest(null);
      await rename(root, `${root}-preserved`);
      await symlink(outside, root, 'dir');
    }
  });

  try {
    const result = await ensureWorkspaceReoDirectory(root);

    assert.notEqual(typeof result, 'string');
    if (typeof result !== 'string') {
      assert.equal(result.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    }
    await assert.rejects(stat(path.join(outside, '.reo')));
  } finally {
    setBeforeWorkspaceRootChildDirectoryCreateForTest(null);
  }
});

test('managed memories directory creation rejects root swap before child mkdir', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-managed-memories-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-managed-memories-outside-'));
  setBeforeWorkspaceRootChildDirectoryCreateForTest(async (directoryName) => {
    if (directoryName === 'memories') {
      setBeforeWorkspaceRootChildDirectoryCreateForTest(null);
      await rename(root, `${root}-preserved`);
      await symlink(outside, root, 'dir');
    }
  });

  try {
    const result = await ensureWorkspaceMemoriesDirectory(root);

    assert.notEqual(typeof result, 'string');
    if (typeof result !== 'string') {
      assert.equal(result.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    }
    await assert.rejects(stat(path.join(outside, 'memories')));
  } finally {
    setBeforeWorkspaceRootChildDirectoryCreateForTest(null);
  }
});

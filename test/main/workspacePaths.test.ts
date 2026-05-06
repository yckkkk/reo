import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createSafeRecordingId,
  resolveRecordingDirectory,
  resolveWorkspaceRoot,
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

test('recording paths reject traversal, slash, and symlink parent escapes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-recording-path-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-recording-outside-'));
  await mkdir(path.join(root, 'recordings'), { recursive: true });
  await symlink(outside, path.join(root, 'recordings', 'rec_link'));

  assert.equal(createSafeRecordingId('rec_20260506_000001'), 'rec_20260506_000001');
  assert.throws(() => createSafeRecordingId('../escape'));
  assert.throws(() => createSafeRecordingId('rec_bad/slash'));

  assert.equal(
    resolveRecordingDirectory(root, 'rec_20260506_000001'),
    path.join(root, 'recordings', 'rec_20260506_000001')
  );
  assert.throws(() => resolveRecordingDirectory(root, '../escape'));
  assert.throws(() => resolveRecordingDirectory(root, 'rec_link'));
});

import assert from 'node:assert/strict';
import { renameSync, symlinkSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  acquireWorkspaceLock,
  setAfterWorkspaceLockDirectoryCreateForTest,
} from '../../src/main/workspaceLock.js';

test('workspace lock rejects duplicate open and releases explicitly', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-'));
  const first = await acquireWorkspaceLock({ canonicalRoot: root });
  assert.equal(first.ok, true);
  if (!first.ok) {
    return;
  }

  const duplicate = await acquireWorkspaceLock({ canonicalRoot: root });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.error.code, 'ERR_WORKSPACE_LOCKED');
  }

  await first.lock.release();
  assert.equal(first.lock.isHeld(), false);

  const second = await acquireWorkspaceLock({ canonicalRoot: root });
  assert.equal(second.ok, true);
  if (second.ok) {
    await second.lock.release();
  }
});

test('workspace lock replaces stale lock directories owned by dead processes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-stale-'));
  const staleLockDirectory = path.join(root, '.reo', 'workspace.lock.lock');
  await mkdir(staleLockDirectory, { recursive: true });
  await writeFile(path.join(staleLockDirectory, 'owner.json'), JSON.stringify({ pid: 999_999 }));

  const acquired = await acquireWorkspaceLock({ canonicalRoot: root });

  assert.equal(acquired.ok, true);
  if (!acquired.ok) {
    return;
  }
  const owner = JSON.parse(await readFile(path.join(staleLockDirectory, 'owner.json'), 'utf8'));
  assert.equal(owner.pid, process.pid);
  await acquired.lock.release();
});

test('workspace lock replaces stale lock directories when the owner process fingerprint mismatches', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-stale-fingerprint-'));
  const staleLockDirectory = path.join(root, '.reo', 'workspace.lock.lock');
  await mkdir(staleLockDirectory, { recursive: true });
  await writeFile(
    path.join(staleLockDirectory, 'owner.json'),
    JSON.stringify({ schemaVersion: 2, pid: process.pid, processStartTimeMs: 0 })
  );

  const acquired = await acquireWorkspaceLock({ canonicalRoot: root });

  assert.equal(acquired.ok, true);
  if (!acquired.ok) {
    return;
  }
  const owner = JSON.parse(await readFile(path.join(staleLockDirectory, 'owner.json'), 'utf8'));
  assert.equal(owner.pid, process.pid);
  assert.equal(owner.schemaVersion, 2);
  assert.equal(typeof owner.processStartTimeMs, 'number');
  assert.notEqual(owner.processStartTimeMs, 0);
  await acquired.lock.release();
});

test('workspace lock replaces legacy pid-only locks when the owner file predates the live pid', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-stale-legacy-pid-reuse-'));
  const staleLockDirectory = path.join(root, '.reo', 'workspace.lock.lock');
  const ownerPath = path.join(staleLockDirectory, 'owner.json');
  await mkdir(staleLockDirectory, { recursive: true });
  await writeFile(ownerPath, JSON.stringify({ pid: process.pid }));
  await utimes(ownerPath, new Date(0), new Date(0));

  const acquired = await acquireWorkspaceLock({ canonicalRoot: root });

  assert.equal(acquired.ok, true);
  if (!acquired.ok) {
    return;
  }
  const owner = JSON.parse(await readFile(ownerPath, 'utf8'));
  assert.equal(owner.pid, process.pid);
  assert.equal(owner.schemaVersion, 2);
  assert.equal(typeof owner.processStartTimeMs, 'number');
  await acquired.lock.release();
});

test('workspace lock replaces stale lock directories with missing owner files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-stale-missing-owner-'));
  const staleLockDirectory = path.join(root, '.reo', 'workspace.lock.lock');
  await mkdir(staleLockDirectory, { recursive: true });

  const acquired = await acquireWorkspaceLock({ canonicalRoot: root });

  assert.equal(acquired.ok, true);
  if (acquired.ok) {
    await acquired.lock.release();
  }
});

test('workspace lock replaces stale lock directories with symlinked owner files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-stale-owner-symlink-'));
  const staleLockDirectory = path.join(root, '.reo', 'workspace.lock.lock');
  const outsideOwner = path.join(await mkdtemp(path.join(os.tmpdir(), 'reo-lock-owner-')), 'owner');
  await mkdir(staleLockDirectory, { recursive: true });
  await writeFile(outsideOwner, JSON.stringify({ pid: 1 }));
  await symlink(outsideOwner, path.join(staleLockDirectory, 'owner.json'));

  const acquired = await acquireWorkspaceLock({ canonicalRoot: root });

  assert.equal(acquired.ok, true);
  assert.equal(await readFile(outsideOwner, 'utf8'), JSON.stringify({ pid: 1 }));
  if (acquired.ok) {
    await acquired.lock.release();
  }
});

test('workspace lock rejects lock directory replacement before owner write', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-owner-swap-'));
  const outsideDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-owner-outside-'));
  setAfterWorkspaceLockDirectoryCreateForTest(() => {
    setAfterWorkspaceLockDirectoryCreateForTest(null);
    renameSync(
      path.join(root, '.reo', 'workspace.lock.lock'),
      path.join(root, '.reo', 'workspace.lock.lock-preserved')
    );
    symlinkSync(outsideDirectory, path.join(root, '.reo', 'workspace.lock.lock'));
  });

  try {
    const acquired = await acquireWorkspaceLock({ canonicalRoot: root });
    assert.equal(acquired.ok, false);
  } finally {
    setAfterWorkspaceLockDirectoryCreateForTest(null);
  }

  await assert.rejects(readFile(path.join(outsideDirectory, 'owner.json'), 'utf8'));
});

test('workspace lock is unusable when its lock directory is replaced', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-replaced-owner-'));
  const first = await acquireWorkspaceLock({ canonicalRoot: root });
  assert.equal(first.ok, true);
  if (!first.ok) {
    return;
  }
  const lockDirectory = path.join(root, '.reo', 'workspace.lock.lock');
  await rm(lockDirectory, { recursive: true });

  const second = await acquireWorkspaceLock({ canonicalRoot: root });
  assert.equal(second.ok, true);
  if (!second.ok) {
    return;
  }

  assert.equal(first.lock.isUsable(), false);
  await assert.rejects(first.lock.release());
  const duplicate = await acquireWorkspaceLock({ canonicalRoot: root });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.error.code, 'ERR_WORKSPACE_LOCKED');
  }
  await second.lock.release();
});

test('workspace lock rejects .reo symlink swap before lock file write', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-swap-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-outside-'));
  await mkdir(path.join(root, '.reo'));

  const acquired = await acquireWorkspaceLock({
    canonicalRoot: root,
    beforeLockFileWrite: async () => {
      await rename(path.join(root, '.reo'), path.join(root, '.reo-preserved'));
      await symlink(outside, path.join(root, '.reo'), 'dir');
    },
  });

  assert.equal(acquired.ok, false);
  if (!acquired.ok) {
    assert.equal(acquired.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  await assert.rejects(stat(path.join(outside, 'workspace.lock')));
});

test('workspace lock rejects .reo parent swap before lock target open', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-open-swap-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-open-outside-'));
  await mkdir(path.join(root, '.reo'));

  const acquired = await acquireWorkspaceLock({
    canonicalRoot: root,
    beforeLockTargetOpen: async () => {
      await rename(path.join(root, '.reo'), path.join(root, '.reo-preserved'));
      await symlink(outside, path.join(root, '.reo'), 'dir');
    },
  });

  assert.equal(acquired.ok, false);
  if (!acquired.ok) {
    assert.equal(acquired.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  await assert.rejects(stat(path.join(outside, 'workspace.lock')));
  await assert.rejects(stat(path.join(outside, 'workspace.lock.lock')));
});

test('workspace lock returns an error envelope when lock target cannot be written', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-target-'));
  await mkdir(path.join(root, '.reo', 'workspace.lock'), { recursive: true });

  const acquired = await acquireWorkspaceLock({ canonicalRoot: root });

  assert.equal(acquired.ok, false);
  if (!acquired.ok) {
    assert.equal(acquired.error.code, 'ERR_WORKSPACE_LOCK_FAILED');
  }
});

test('workspace lock rejects symlinked lock file leaf without writing outside', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-leaf-symlink-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-leaf-outside-'));
  const outsideLockFile = path.join(outside, 'created-by-lock');
  await mkdir(path.join(root, '.reo'));
  await symlink(outsideLockFile, path.join(root, '.reo', 'workspace.lock'));

  const acquired = await acquireWorkspaceLock({ canonicalRoot: root });

  assert.equal(acquired.ok, false);
  if (!acquired.ok) {
    assert.equal(acquired.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  await assert.rejects(stat(outsideLockFile));
});

test('workspace lock is marked lost when release fails', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-release-fails-'));
  const acquired = await acquireWorkspaceLock({ canonicalRoot: root });
  assert.equal(acquired.ok, true);
  if (!acquired.ok) {
    return;
  }

  const lockDirectory = path.join(root, '.reo', 'workspace.lock.lock');
  await rm(lockDirectory, { recursive: true });
  await writeFile(lockDirectory, 'not a directory');

  await assert.rejects(acquired.lock.release());
  assert.equal(acquired.lock.isHeld(), true);
  assert.equal(acquired.lock.isUsable(), false);
});

test('workspace lock is unusable when workspace root identity changes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-lock-root-swap-'));
  const acquired = await acquireWorkspaceLock({ canonicalRoot: root });
  assert.equal(acquired.ok, true);
  if (!acquired.ok) {
    return;
  }

  const displacedRoot = `${root}-preserved`;
  await rename(root, displacedRoot);
  await mkdir(root);
  await mkdir(path.join(root, '.reo'));

  assert.equal(acquired.lock.isUsable(), false);

  await rm(root, { recursive: true });
  await rename(displacedRoot, root);
  await acquired.lock.release();
});

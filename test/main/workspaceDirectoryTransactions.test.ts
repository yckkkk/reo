import assert from 'node:assert/strict';
import { renameSync, symlinkSync } from 'node:fs';
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readSafeDirectoryIdentity } from '../../src/main/directoryIdentity.js';
import {
  isUnsupportedWorkspaceDirectoryFsyncError,
  openExistingWorkspaceFileInDirectory,
  openNoReplaceWorkspaceFileInDirectory,
  readWorkspaceDirectoryEntriesInDirectory,
  removeEmptyWorkspaceDirectoryInDirectory,
  removeWorkspaceDirectoryTreeInDirectory,
  removeWorkspaceFileInDirectory,
  runInWorkspaceDirectorySync,
} from '../../src/main/workspaceDirectoryTransactions.js';

test('workspace directory transaction rejects parent identity replacement', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-workspace-directory-transaction-'));
  const directory = path.join(root, 'current');
  const preservedDirectory = path.join(root, 'current-preserved');
  const outsideDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-workspace-directory-outside-')
  );

  try {
    await mkdir(directory);
    const directoryIdentity = await readSafeDirectoryIdentity(directory);

    assert.throws(
      () =>
        runInWorkspaceDirectorySync(
          { directory, directoryIdentity, validateDirectoryPath: true },
          () => {
            renameSync(directory, preservedDirectory);
            symlinkSync(outsideDirectory, directory, 'dir');
          }
        ),
      /Workspace directory changed|Workspace directory is not safe/
    );

    assert.deepEqual(await readdir(outsideDirectory), []);
  } finally {
    await rm(root, { force: true, recursive: true });
    await rm(outsideDirectory, { force: true, recursive: true });
  }
});

test('workspace directory transaction opens no-replace files without replacing existing or symlink leaves', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-workspace-directory-open-'));
  const outsideDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-workspace-directory-open-outside-')
  );

  try {
    const directoryIdentity = await readSafeDirectoryIdentity(root);
    await writeFile(path.join(root, 'existing.txt'), 'existing');
    await symlink(path.join(outsideDirectory, 'outside.txt'), path.join(root, 'linked.txt'));

    assert.throws(
      () =>
        openNoReplaceWorkspaceFileInDirectory({
          directory: root,
          directoryIdentity,
          fileName: 'existing.txt',
        }),
      /EEXIST/
    );
    assert.throws(
      () =>
        openNoReplaceWorkspaceFileInDirectory({
          directory: root,
          directoryIdentity,
          fileName: 'linked.txt',
        }),
      /EEXIST/
    );

    assert.deepEqual(await readdir(outsideDirectory), []);
  } finally {
    await rm(root, { force: true, recursive: true });
    await rm(outsideDirectory, { force: true, recursive: true });
  }
});

test('workspace directory transaction existing file open rejects symlink leaves by default', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-workspace-directory-existing-open-'));
  const outsideDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-workspace-directory-existing-open-outside-')
  );

  try {
    const directoryIdentity = await readSafeDirectoryIdentity(root);
    await writeFile(path.join(outsideDirectory, 'outside.txt'), 'outside');
    await symlink(path.join(outsideDirectory, 'outside.txt'), path.join(root, 'linked.txt'));

    assert.throws(
      () =>
        openExistingWorkspaceFileInDirectory({
          directory: root,
          directoryIdentity,
          fileName: 'linked.txt',
          flags: 0,
        }),
      /ELOOP|EFTYPE|Too many levels of symbolic links/
    );
  } finally {
    await rm(root, { force: true, recursive: true });
    await rm(outsideDirectory, { force: true, recursive: true });
  }
});

test('workspace directory transaction refuses file removal after parent identity changes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-workspace-directory-remove-'));
  const directory = path.join(root, 'current');
  const preservedDirectory = path.join(root, 'current-preserved');
  const outsideDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-workspace-directory-remove-outside-')
  );

  try {
    await mkdir(directory);
    const directoryIdentity = await readSafeDirectoryIdentity(directory);
    await writeFile(path.join(outsideDirectory, 'victim.txt'), 'outside');

    await rename(directory, preservedDirectory);
    await symlink(outsideDirectory, directory, 'dir');

    assert.throws(
      () =>
        removeWorkspaceFileInDirectory({
          directory,
          directoryIdentity,
          fileName: 'victim.txt',
        }),
      /Workspace directory changed/
    );
    assert.equal(await readFile(path.join(outsideDirectory, 'victim.txt'), 'utf8'), 'outside');
  } finally {
    await rm(root, { force: true, recursive: true });
    await rm(outsideDirectory, { force: true, recursive: true });
  }
});

test('workspace directory transaction best-effort fsync ignores only unsupported directory fsync codes', () => {
  for (const code of ['EACCES', 'EISDIR', 'EINVAL', 'ENOTSUP', 'EPERM']) {
    assert.equal(isUnsupportedWorkspaceDirectoryFsyncError({ code }), true);
  }

  for (const code of ['EBADF', 'ENOENT', 'EIO', undefined]) {
    assert.equal(isUnsupportedWorkspaceDirectoryFsyncError({ code }), false);
  }
});

test('workspace directory transaction reads entries only from the validated directory identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-workspace-directory-read-'));
  const directory = path.join(root, 'current');
  const outsideDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-workspace-directory-read-outside-')
  );

  try {
    await mkdir(directory);
    await writeFile(path.join(directory, 'inside.txt'), 'inside');
    await writeFile(path.join(outsideDirectory, 'outside.txt'), 'outside');
    const directoryIdentity = await readSafeDirectoryIdentity(directory);

    assert.deepEqual(
      readWorkspaceDirectoryEntriesInDirectory({ directory, directoryIdentity }).map(
        (entry) => entry.name
      ),
      ['inside.txt']
    );

    await rename(directory, `${directory}-preserved`);
    await symlink(outsideDirectory, directory, 'dir');

    assert.throws(
      () => readWorkspaceDirectoryEntriesInDirectory({ directory, directoryIdentity }),
      /Workspace directory changed/
    );
  } finally {
    await rm(root, { force: true, recursive: true });
    await rm(outsideDirectory, { force: true, recursive: true });
  }
});

test('workspace directory transaction removes only the expected tree directory identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-workspace-directory-tree-remove-'));
  const parentDirectory = path.join(root, 'parent');
  const outsideDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-workspace-directory-tree-remove-outside-')
  );

  try {
    await mkdir(path.join(parentDirectory, 'target'), { recursive: true });
    await writeFile(path.join(parentDirectory, 'target', 'inside.txt'), 'inside');
    await writeFile(path.join(outsideDirectory, 'inside.txt'), 'outside');
    const parentIdentity = await readSafeDirectoryIdentity(parentDirectory);
    const targetIdentity = await readSafeDirectoryIdentity(path.join(parentDirectory, 'target'));

    await rename(path.join(parentDirectory, 'target'), path.join(parentDirectory, 'target-old'));
    await symlink(outsideDirectory, path.join(parentDirectory, 'target'), 'dir');

    assert.throws(
      () =>
        removeWorkspaceDirectoryTreeInDirectory({
          directory: parentDirectory,
          directoryIdentity: parentIdentity,
          targetName: 'target',
          targetIdentity,
        }),
      /Workspace directory changed|Workspace directory is not safe/
    );
    assert.equal(await readFile(path.join(outsideDirectory, 'inside.txt'), 'utf8'), 'outside');
  } finally {
    await rm(root, { force: true, recursive: true });
    await rm(outsideDirectory, { force: true, recursive: true });
  }
});

test('workspace directory transaction empty directory remove refuses late payloads', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-workspace-directory-empty-remove-'));
  const targetDirectory = path.join(root, 'target');

  try {
    await mkdir(targetDirectory);
    const parentIdentity = await readSafeDirectoryIdentity(root);
    const targetIdentity = await readSafeDirectoryIdentity(targetDirectory);
    await writeFile(path.join(targetDirectory, 'memory.md'), 'late payload');

    assert.throws(
      () =>
        removeEmptyWorkspaceDirectoryInDirectory({
          directory: root,
          directoryIdentity: parentIdentity,
          targetName: 'target',
          targetIdentity,
        }),
      /ENOTEMPTY/
    );
    assert.equal(await readFile(path.join(targetDirectory, 'memory.md'), 'utf8'), 'late payload');
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

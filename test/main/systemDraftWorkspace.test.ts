import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ensureSystemDraftWorkspace,
  getSystemDraftWorkspaceRootPath,
  getSystemDraftWorkspaceStorePath,
  SYSTEM_DRAFT_DEFAULT_MEMORY_ID,
  SYSTEM_DRAFT_TITLE,
  SYSTEM_DRAFT_WORKSPACE_ID,
  SYSTEM_DRAFT_WORKSPACE_ROLE,
} from '../../src/main/systemDraftWorkspace.js';

async function makeAppDataDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'reo-system-draft-'));
}

async function cleanup(directory: string): Promise<void> {
  await rm(directory, { force: true, recursive: true });
}

test('ensureSystemDraftWorkspace creates a real app-managed Draft workspace root and store', async () => {
  const appDataDir = await makeAppDataDir();
  try {
    const result = await ensureSystemDraftWorkspace({
      appDataDir,
      now: () => '2026-06-06T20:45:00.000-07:00',
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    const { rootPath, snapshot, store } = result.value;
    assert.equal(rootPath, await realpath(getSystemDraftWorkspaceRootPath(appDataDir)));
    assert.equal(store.schemaVersion, 1);
    assert.equal(store.systemRole, SYSTEM_DRAFT_WORKSPACE_ROLE);
    assert.equal(store.workspaceId, SYSTEM_DRAFT_WORKSPACE_ID);
    assert.equal(store.title, SYSTEM_DRAFT_TITLE);
    assert.equal(store.defaultMemoryId, SYSTEM_DRAFT_DEFAULT_MEMORY_ID);
    assert.equal(store.rootPath, rootPath);

    const persistedStore = JSON.parse(
      await readFile(getSystemDraftWorkspaceStorePath(appDataDir), 'utf8')
    ) as typeof store;
    assert.deepEqual(persistedStore, store);

    const workspaceJson = JSON.parse(
      await readFile(path.join(rootPath, '.reo', 'workspace.json'), 'utf8')
    ) as { readonly workspaceId: string; readonly title: string; readonly description: string };
    assert.equal(workspaceJson.workspaceId, SYSTEM_DRAFT_WORKSPACE_ID);
    assert.equal(workspaceJson.title, SYSTEM_DRAFT_TITLE);
    assert.equal(workspaceJson.description, '');

    assert.equal(snapshot.workspaceId, SYSTEM_DRAFT_WORKSPACE_ID);
    assert.equal(snapshot.title, SYSTEM_DRAFT_TITLE);
    assert.equal(snapshot.memories.length, 1);
    assert.equal(snapshot.memories[0]?.memoryId, SYSTEM_DRAFT_DEFAULT_MEMORY_ID);
    assert.equal(snapshot.memories[0]?.title, SYSTEM_DRAFT_TITLE);

    await lstat(path.join(rootPath, '.reo'));
    await lstat(path.join(rootPath, 'memories'));
    await lstat(path.join(rootPath, 'widgets'));
    await lstat(path.join(rootPath, '.reo', 'drafts'));
  } finally {
    await cleanup(appDataDir);
  }
});

test('ensureSystemDraftWorkspace is idempotent and does not duplicate the default Draft Memory', async () => {
  const appDataDir = await makeAppDataDir();
  try {
    const first = await ensureSystemDraftWorkspace({
      appDataDir,
      now: () => '2026-06-06T20:45:00.000-07:00',
    });
    assert.equal(first.ok, true);

    const second = await ensureSystemDraftWorkspace({
      appDataDir,
      now: () => '2026-06-06T21:00:00.000-07:00',
    });
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      return;
    }

    assert.equal(second.value.rootPath, first.value.rootPath);
    assert.equal(second.value.store.createdAt, first.value.store.createdAt);
    assert.equal(second.value.snapshot.memories.length, 1);
    assert.equal(second.value.snapshot.memories[0]?.memoryId, SYSTEM_DRAFT_DEFAULT_MEMORY_ID);
    assert.equal(
      second.value.snapshot.memories[0]?.createdAt,
      first.value.snapshot.memories[0]?.createdAt
    );
  } finally {
    await cleanup(appDataDir);
  }
});

test('ensureSystemDraftWorkspace rejects an unsafe symlink Draft root', async () => {
  const appDataDir = await makeAppDataDir();
  const outside = await makeAppDataDir();
  try {
    const rootPath = getSystemDraftWorkspaceRootPath(appDataDir);
    await mkdir(path.dirname(rootPath), { recursive: true });
    await symlink(outside, rootPath);

    const result = await ensureSystemDraftWorkspace({
      appDataDir,
      now: () => '2026-06-06T20:45:00.000-07:00',
    });

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    assert.equal((await lstat(rootPath)).isSymbolicLink(), true);
  } finally {
    await cleanup(appDataDir);
    await cleanup(outside);
  }
});

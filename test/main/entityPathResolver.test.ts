import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  resolveMemoryPaths,
  resolveMemorySpacePaths,
  resolveSegmentSupplementPaths,
  resolveSegmentPaths,
} from '../../src/main/entityPathResolver.js';
import { resolveMemoryDirectory as resolveStrictMemoryDirectory } from '../../src/main/memoryFiles.js';
import { initializeWorkspaceFiles } from '../../src/main/workspaceFiles.js';

const allowMemorySpaceRoot = async ({ rootPath }: { readonly rootPath: string }) => ({
  ok: true as const,
  value: { rootAbsolute: rootPath },
});

test('resolveMemorySpacePaths returns root and AGENTS.md absolute paths for known workspaceId', async () => {
  const registry = {
    async findByWorkspaceId(id: string) {
      return id === 'wsp-1' ? { canonicalRoot: '/tmp/reo-ws-1' } : null;
    },
  };
  const fs = {
    async exists(filePath: string) {
      return filePath === '/tmp/reo-ws-1' || filePath === '/tmp/reo-ws-1/AGENTS.md';
    },
  };

  const result = await resolveMemorySpacePaths('wsp-1', {
    registry,
    fs,
    memorySpaceRootValidator: allowMemorySpaceRoot,
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      rootAbsolute: '/tmp/reo-ws-1',
      agentsFileAbsolute: '/tmp/reo-ws-1/AGENTS.md',
    },
  });
});

test('resolveMemorySpacePaths returns ERR_WORKSPACE_ROOT_MISSING when registry entry absent', async () => {
  const registry = {
    async findByWorkspaceId() {
      return null;
    },
  };
  const result = await resolveMemorySpacePaths('wsp-x', { registry });

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_ROOT_MISSING' });
});

test('resolveMemorySpacePaths returns ERR_WORKSPACE_ROOT_MISSING when root path is missing on disk', async () => {
  const registry = {
    async findByWorkspaceId() {
      return { canonicalRoot: '/gone/path' };
    },
  };
  const result = await resolveMemorySpacePaths('wsp-1', {
    registry,
    memorySpaceRootValidator: async () => ({
      ok: false,
      code: 'ERR_WORKSPACE_ROOT_MISSING',
    }),
  });

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_ROOT_MISSING' });
});

test('resolveMemorySpacePaths returns ERR_MEMORY_SPACE_AGENTS_FILE_MISSING when AGENTS.md is required and missing', async () => {
  const registry = {
    async findByWorkspaceId() {
      return { canonicalRoot: '/tmp/reo-ws-1' };
    },
  };
  const fs = {
    async exists(filePath: string) {
      return filePath === '/tmp/reo-ws-1';
    },
  };

  const result = await resolveMemorySpacePaths('wsp-1', {
    registry,
    fs,
    memorySpaceRootValidator: allowMemorySpaceRoot,
    requireAgentsFile: true,
  });

  assert.deepEqual(result, { ok: false, code: 'ERR_MEMORY_SPACE_AGENTS_FILE_MISSING' });
});

test('resolveMemorySpacePaths rejects symlinked AGENTS.md when required', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-entity-space-agents-link-'));
  const targetPath = path.join(rootPath, 'target.md');
  await writeFile(targetPath, '# outside\n');
  await symlink(targetPath, path.join(rootPath, 'AGENTS.md'));
  const registry = {
    async findByWorkspaceId() {
      return { canonicalRoot: rootPath };
    },
  };

  const result = await resolveMemorySpacePaths('wsp-1', {
    registry,
    memorySpaceRootValidator: allowMemorySpaceRoot,
    requireAgentsFile: true,
  });

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_UNSAFE_PATH' });
});

test('resolveMemorySpacePaths accepts current registry-style resolveMemorySpace API', async () => {
  const registry = {
    async resolveMemorySpace(id: string) {
      return id === 'wsp-1' ? { rootPath: '/tmp/reo-ws-1' } : null;
    },
  };
  const fs = {
    async exists(filePath: string) {
      return filePath === '/tmp/reo-ws-1' || filePath === '/tmp/reo-ws-1/AGENTS.md';
    },
  };

  const result = await resolveMemorySpacePaths('wsp-1', {
    registry,
    fs,
    memorySpaceRootValidator: allowMemorySpaceRoot,
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      rootAbsolute: '/tmp/reo-ws-1',
      agentsFileAbsolute: '/tmp/reo-ws-1/AGENTS.md',
    },
  });
});

test('resolveMemorySpacePaths validates registry root workspace ownership', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-entity-space-owner-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'Other Space',
    description: '',
    createWorkspaceId: () => 'wsp-other',
    now: () => '2026-05-16T01:00:00.000Z',
  });
  const registry = {
    async resolveMemorySpace(id: string) {
      return id === 'wsp-requested' ? { rootPath } : null;
    },
  };

  const result = await resolveMemorySpacePaths('wsp-requested', { registry });

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_METADATA_INVALID' });
});

test('resolveMemorySpacePaths rejects symlinked registry roots', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-entity-space-real-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'Linked Space',
    description: '',
    createWorkspaceId: () => 'wsp-linked',
    now: () => '2026-05-16T01:00:00.000Z',
  });
  const linkRoot = `${rootPath}-link`;
  await symlink(await realpath(rootPath), linkRoot, 'dir');
  const registry = {
    async resolveMemorySpace(id: string) {
      return id === 'wsp-linked' ? { rootPath: linkRoot } : null;
    },
  };

  const result = await resolveMemorySpacePaths('wsp-linked', { registry });

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_UNSAFE_PATH' });
});

test('resolveMemoryPaths returns memory directory and memory.md absolute paths when memory exists', async () => {
  const handle = { canonicalRoot: '/tmp/reo-ws-1', workspaceId: 'wsp-1' };
  const fs = {
    async exists(filePath: string) {
      return filePath === '/tmp/reo-ws-1/memories/mem-1';
    },
  };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory(canonicalRoot: string, memoryId: string) {
      assert.equal(canonicalRoot, '/tmp/reo-ws-1');
      assert.equal(memoryId, 'mem-1');
      return '/tmp/reo-ws-1/memories/mem-1';
    },
  };

  const result = await resolveMemoryPaths(handle, 'wsp-1', 'mem-1', {
    fs,
    memoryDirectoryResolver,
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      directoryAbsolute: '/tmp/reo-ws-1/memories/mem-1',
      documentAbsolute: '/tmp/reo-ws-1/memories/mem-1/memory.md',
    },
  });
});

test('resolveMemoryPaths returns ERR_WORKSPACE_MEMORY_NOT_FOUND when memory directory is missing', async () => {
  const handle = { canonicalRoot: '/tmp/reo-ws-1', workspaceId: 'wsp-1' };
  const fs = {
    async exists() {
      return false;
    },
  };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory() {
      return '/tmp/reo-ws-1/memories/mem-missing';
    },
  };

  const result = await resolveMemoryPaths(handle, 'wsp-1', 'mem-missing', {
    fs,
    memoryDirectoryResolver,
  });

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_MEMORY_NOT_FOUND' });
});

test('resolveMemoryPaths returns ERR_WORKSPACE_UNSAFE_PATH when resolved directory escapes memories root', async () => {
  const handle = { canonicalRoot: '/tmp/reo-ws-1', workspaceId: 'wsp-1' };
  const fs = {
    async exists() {
      return true;
    },
  };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory() {
      return '/tmp/reo-ws-1/segments/mem-1';
    },
  };

  const result = await resolveMemoryPaths(handle, 'wsp-1', 'mem-1', {
    fs,
    memoryDirectoryResolver,
  });

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_UNSAFE_PATH' });
});

test('resolveMemoryPaths returns ERR_ENTITY_DOCUMENT_MISSING when required memory.md is missing', async () => {
  const handle = { canonicalRoot: '/tmp/reo-ws-1', workspaceId: 'wsp-1' };
  const fs = {
    async exists(filePath: string) {
      return filePath === '/tmp/reo-ws-1/memories/mem-1';
    },
  };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory() {
      return '/tmp/reo-ws-1/memories/mem-1';
    },
  };

  const result = await resolveMemoryPaths(handle, 'wsp-1', 'mem-1', {
    fs,
    memoryDirectoryResolver,
    requireDocument: true,
  });

  assert.deepEqual(result, { ok: false, code: 'ERR_ENTITY_DOCUMENT_MISSING' });
});

test('resolveMemoryPaths returns ERR_ENTITY_DOCUMENT_MISSING for a titled memory directory missing memory.md', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-entity-memory-doc-missing-'));
  const memoryId = 'mem_missing_document';
  await mkdir(path.join(rootPath, 'memories', `${memoryId}--Runtime Memory`), {
    recursive: true,
  });
  await mkdir(path.join(rootPath, '.reo', 'objects', 'memories'), { recursive: true });
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'memories', `${memoryId}.json`),
    JSON.stringify({
      schemaVersion: 1,
      objectType: 'memory',
      memoryId,
      createdAt: '2026-05-16T01:00:00.000Z',
      updatedAt: '2026-05-16T01:00:00.000Z',
    })
  );

  const result = await resolveMemoryPaths(
    { canonicalRoot: await realpath(rootPath), workspaceId: 'wsp-1' },
    'wsp-1',
    memoryId,
    { requireDocument: true }
  );

  assert.deepEqual(result, { ok: false, code: 'ERR_ENTITY_DOCUMENT_MISSING' });
});

test('strict memory file-truth lookup does not resolve a titled memory directory from manifest alone', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-strict-memory-doc-missing-'));
  const memoryId = 'mem_strict_missing_document';
  await mkdir(path.join(rootPath, 'memories', `${memoryId}--Runtime Memory`), {
    recursive: true,
  });
  await mkdir(path.join(rootPath, '.reo', 'objects', 'memories'), { recursive: true });
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'memories', `${memoryId}.json`),
    JSON.stringify({
      schemaVersion: 1,
      objectType: 'memory',
      memoryId,
      createdAt: '2026-05-16T01:00:00.000Z',
      updatedAt: '2026-05-16T01:00:00.000Z',
    })
  );

  const result = await resolveStrictMemoryDirectory(await realpath(rootPath), memoryId);

  assert.equal(path.basename(result), memoryId);
});

test('resolveMemoryPaths rejects symlinked memory.md when document is required', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-entity-memory-doc-link-'));
  const memoryDirectory = path.join(rootPath, 'memories', 'mem-1');
  await mkdir(memoryDirectory, { recursive: true });
  const targetPath = path.join(memoryDirectory, 'target.md');
  await writeFile(targetPath, '# outside\n');
  await symlink(targetPath, path.join(memoryDirectory, 'memory.md'));
  const handle = { canonicalRoot: rootPath, workspaceId: 'wsp-1' };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory() {
      return memoryDirectory;
    },
  };

  const result = await resolveMemoryPaths(handle, 'wsp-1', 'mem-1', {
    memoryDirectoryResolver,
    requireDocument: true,
  });

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_UNSAFE_PATH' });
});

test('resolveSegmentPaths returns segment directory and segment.md absolute paths when segment exists', async () => {
  const handle = { canonicalRoot: '/tmp/reo-ws-1', workspaceId: 'wsp-1' };
  const fs = {
    async exists(filePath: string) {
      return (
        filePath === '/tmp/reo-ws-1/memories/mem-1' ||
        filePath === '/tmp/reo-ws-1/memories/mem-1/segments/seg-1'
      );
    },
  };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory(canonicalRoot: string, memoryId: string) {
      assert.equal(canonicalRoot, '/tmp/reo-ws-1');
      assert.equal(memoryId, 'mem-1');
      return '/tmp/reo-ws-1/memories/mem-1';
    },
  };
  const segmentDirectoryResolver = {
    async resolveSegmentDirectory(
      canonicalRoot: string,
      memoryId: string,
      segmentId: string,
      context?: { readonly memoryDirectoryAbsolute: string }
    ) {
      assert.equal(canonicalRoot, '/tmp/reo-ws-1');
      assert.equal(memoryId, 'mem-1');
      assert.equal(segmentId, 'seg-1');
      assert.deepEqual(context, {
        memoryDirectoryAbsolute: '/tmp/reo-ws-1/memories/mem-1',
      });
      return '/tmp/reo-ws-1/memories/mem-1/segments/seg-1';
    },
  };

  const result = await resolveSegmentPaths(handle, 'wsp-1', 'mem-1', 'seg-1', {
    fs,
    memoryDirectoryResolver,
    segmentDirectoryResolver,
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      directoryAbsolute: '/tmp/reo-ws-1/memories/mem-1/segments/seg-1',
      documentAbsolute: '/tmp/reo-ws-1/memories/mem-1/segments/seg-1/segment.md',
    },
  });
});

test('resolveSegmentPaths returns ERR_WORKSPACE_MEMORY_NOT_FOUND when parent memory is missing', async () => {
  const handle = { canonicalRoot: '/tmp/reo-ws-1', workspaceId: 'wsp-1' };
  const fs = {
    async exists() {
      return false;
    },
  };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory() {
      return '/tmp/reo-ws-1/memories/mem-missing';
    },
  };
  const segmentDirectoryResolver = {
    async resolveSegmentDirectory() {
      assert.fail('segment directory should not resolve when parent memory is missing');
    },
  };

  const result = await resolveSegmentPaths(handle, 'wsp-1', 'mem-missing', 'seg-1', {
    fs,
    memoryDirectoryResolver,
    segmentDirectoryResolver,
  });

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_MEMORY_NOT_FOUND' });
});

test('resolveSegmentPaths returns ERR_WORKSPACE_SEGMENT_NOT_FOUND when segment directory is missing', async () => {
  const handle = { canonicalRoot: '/tmp/reo-ws-1', workspaceId: 'wsp-1' };
  const fs = {
    async exists(filePath: string) {
      return filePath === '/tmp/reo-ws-1/memories/mem-1';
    },
  };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory() {
      return '/tmp/reo-ws-1/memories/mem-1';
    },
  };
  const segmentDirectoryResolver = {
    async resolveSegmentDirectory() {
      return '/tmp/reo-ws-1/memories/mem-1/segments/seg-missing';
    },
  };

  const result = await resolveSegmentPaths(handle, 'wsp-1', 'mem-1', 'seg-missing', {
    fs,
    memoryDirectoryResolver,
    segmentDirectoryResolver,
  });

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_SEGMENT_NOT_FOUND' });
});

test('resolveSegmentPaths returns ERR_WORKSPACE_UNSAFE_PATH when segment directory escapes memory segments directory', async () => {
  const handle = { canonicalRoot: '/tmp/reo-ws-1', workspaceId: 'wsp-1' };
  const fs = {
    async exists() {
      return true;
    },
  };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory() {
      return '/tmp/reo-ws-1/memories/mem-1';
    },
  };
  const segmentDirectoryResolver = {
    async resolveSegmentDirectory() {
      return '/tmp/reo-ws-1/memories/other/segments/seg-1';
    },
  };

  const result = await resolveSegmentPaths(handle, 'wsp-1', 'mem-1', 'seg-1', {
    fs,
    memoryDirectoryResolver,
    segmentDirectoryResolver,
  });

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_UNSAFE_PATH' });
});

test('resolveSegmentPaths returns ERR_ENTITY_DOCUMENT_MISSING when required segment.md is missing', async () => {
  const handle = { canonicalRoot: '/tmp/reo-ws-1', workspaceId: 'wsp-1' };
  const fs = {
    async exists(filePath: string) {
      return (
        filePath === '/tmp/reo-ws-1/memories/mem-1' ||
        filePath === '/tmp/reo-ws-1/memories/mem-1/segments/seg-1'
      );
    },
  };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory() {
      return '/tmp/reo-ws-1/memories/mem-1';
    },
  };
  const segmentDirectoryResolver = {
    async resolveSegmentDirectory() {
      return '/tmp/reo-ws-1/memories/mem-1/segments/seg-1';
    },
  };

  const result = await resolveSegmentPaths(handle, 'wsp-1', 'mem-1', 'seg-1', {
    fs,
    memoryDirectoryResolver,
    segmentDirectoryResolver,
    requireDocument: true,
  });

  assert.deepEqual(result, { ok: false, code: 'ERR_ENTITY_DOCUMENT_MISSING' });
});

test('resolveSegmentPaths rejects symlinked segment.md when document is required', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-entity-segment-doc-link-'));
  const memoryDirectory = path.join(rootPath, 'memories', 'mem-1');
  const segmentDirectory = path.join(memoryDirectory, 'segments', 'seg-1');
  await mkdir(segmentDirectory, { recursive: true });
  const targetPath = path.join(segmentDirectory, 'target.md');
  await writeFile(targetPath, '# outside\n');
  await symlink(targetPath, path.join(segmentDirectory, 'segment.md'));
  const handle = { canonicalRoot: rootPath, workspaceId: 'wsp-1' };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory() {
      return memoryDirectory;
    },
  };
  const segmentDirectoryResolver = {
    async resolveSegmentDirectory() {
      return segmentDirectory;
    },
  };

  const result = await resolveSegmentPaths(handle, 'wsp-1', 'mem-1', 'seg-1', {
    memoryDirectoryResolver,
    segmentDirectoryResolver,
    requireDocument: true,
  });

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_UNSAFE_PATH' });
});

test('resolveSegmentSupplementPaths returns supplement directory and supplement.md absolute paths when supplement exists', async () => {
  const handle = { canonicalRoot: '/tmp/reo-ws-1', workspaceId: 'wsp-1' };
  const fs = {
    async exists(filePath: string) {
      return (
        filePath === '/tmp/reo-ws-1/memories/mem-1' ||
        filePath === '/tmp/reo-ws-1/memories/mem-1/segments/seg-1' ||
        filePath === '/tmp/reo-ws-1/memories/mem-1/segments/seg-1/supplements/sup-1'
      );
    },
  };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory() {
      return '/tmp/reo-ws-1/memories/mem-1';
    },
  };
  const segmentDirectoryResolver = {
    async resolveSegmentDirectory() {
      return '/tmp/reo-ws-1/memories/mem-1/segments/seg-1';
    },
  };
  const segmentSupplementDirectoryResolver = {
    async resolveSegmentSupplementDirectory(
      canonicalRoot: string,
      memoryId: string,
      segmentId: string,
      supplementId: string,
      context?: { readonly segmentDirectoryAbsolute: string }
    ) {
      assert.equal(canonicalRoot, '/tmp/reo-ws-1');
      assert.equal(memoryId, 'mem-1');
      assert.equal(segmentId, 'seg-1');
      assert.equal(supplementId, 'sup-1');
      assert.deepEqual(context, {
        segmentDirectoryAbsolute: '/tmp/reo-ws-1/memories/mem-1/segments/seg-1',
      });
      return '/tmp/reo-ws-1/memories/mem-1/segments/seg-1/supplements/sup-1';
    },
  };

  const result = await resolveSegmentSupplementPaths(handle, 'wsp-1', 'mem-1', 'seg-1', 'sup-1', {
    fs,
    memoryDirectoryResolver,
    segmentDirectoryResolver,
    segmentSupplementDirectoryResolver,
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      directoryAbsolute: '/tmp/reo-ws-1/memories/mem-1/segments/seg-1/supplements/sup-1',
      documentAbsolute:
        '/tmp/reo-ws-1/memories/mem-1/segments/seg-1/supplements/sup-1/supplement.md',
    },
  });
});

test('resolveSegmentSupplementPaths returns ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND when supplement directory is missing', async () => {
  const handle = { canonicalRoot: '/tmp/reo-ws-1', workspaceId: 'wsp-1' };
  const fs = {
    async exists(filePath: string) {
      return (
        filePath === '/tmp/reo-ws-1/memories/mem-1' ||
        filePath === '/tmp/reo-ws-1/memories/mem-1/segments/seg-1'
      );
    },
  };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory() {
      return '/tmp/reo-ws-1/memories/mem-1';
    },
  };
  const segmentDirectoryResolver = {
    async resolveSegmentDirectory() {
      return '/tmp/reo-ws-1/memories/mem-1/segments/seg-1';
    },
  };
  const segmentSupplementDirectoryResolver = {
    async resolveSegmentSupplementDirectory() {
      return '/tmp/reo-ws-1/memories/mem-1/segments/seg-1/supplements/sup-missing';
    },
  };

  const result = await resolveSegmentSupplementPaths(
    handle,
    'wsp-1',
    'mem-1',
    'seg-1',
    'sup-missing',
    {
      fs,
      memoryDirectoryResolver,
      segmentDirectoryResolver,
      segmentSupplementDirectoryResolver,
    }
  );

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND' });
});

test('resolveSegmentSupplementPaths returns ERR_WORKSPACE_UNSAFE_PATH when supplement directory escapes segment supplements directory', async () => {
  const handle = { canonicalRoot: '/tmp/reo-ws-1', workspaceId: 'wsp-1' };
  const fs = {
    async exists() {
      return true;
    },
  };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory() {
      return '/tmp/reo-ws-1/memories/mem-1';
    },
  };
  const segmentDirectoryResolver = {
    async resolveSegmentDirectory() {
      return '/tmp/reo-ws-1/memories/mem-1/segments/seg-1';
    },
  };
  const segmentSupplementDirectoryResolver = {
    async resolveSegmentSupplementDirectory() {
      return '/tmp/reo-ws-1/memories/mem-1/segments/other/supplements/sup-1';
    },
  };

  const result = await resolveSegmentSupplementPaths(handle, 'wsp-1', 'mem-1', 'seg-1', 'sup-1', {
    fs,
    memoryDirectoryResolver,
    segmentDirectoryResolver,
    segmentSupplementDirectoryResolver,
  });

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_UNSAFE_PATH' });
});

test('resolveSegmentSupplementPaths rejects symlinked supplement.md when document is required', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-entity-supplement-doc-link-'));
  const memoryDirectory = path.join(rootPath, 'memories', 'mem-1');
  const segmentDirectory = path.join(memoryDirectory, 'segments', 'seg-1');
  const supplementDirectory = path.join(segmentDirectory, 'supplements', 'sup-1');
  await mkdir(supplementDirectory, { recursive: true });
  const targetPath = path.join(supplementDirectory, 'target.md');
  await writeFile(targetPath, '# outside\n');
  await symlink(targetPath, path.join(supplementDirectory, 'supplement.md'));
  const handle = { canonicalRoot: rootPath, workspaceId: 'wsp-1' };
  const memoryDirectoryResolver = {
    async resolveMemoryDirectory() {
      return memoryDirectory;
    },
  };
  const segmentDirectoryResolver = {
    async resolveSegmentDirectory() {
      return segmentDirectory;
    },
  };
  const segmentSupplementDirectoryResolver = {
    async resolveSegmentSupplementDirectory() {
      return supplementDirectory;
    },
  };

  const result = await resolveSegmentSupplementPaths(handle, 'wsp-1', 'mem-1', 'seg-1', 'sup-1', {
    memoryDirectoryResolver,
    segmentDirectoryResolver,
    segmentSupplementDirectoryResolver,
    requireDocument: true,
  });

  assert.deepEqual(result, { ok: false, code: 'ERR_WORKSPACE_UNSAFE_PATH' });
});

import assert from 'node:assert/strict';
import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createWorkspaceMemorySpaceRegistry } from '../../src/main/workspaceMemorySpaceRegistry.js';

const snapshot = {
  workspaceId: 'ws_runtime_validated',
  title: 'Runtime validated memory',
  description: 'Final runtime validation workspace.',
  memories: [],
};

test('workspace memory space registry persists memorySpaces across registry instances without exposing rootPath', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-persist-')),
    'registry.json'
  );
  const firstRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });

  await firstRegistry.upsertMemorySpace({
    canonicalRoot: '/Users/example/Runtime validated memory',
    snapshot,
  });

  const secondRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });

  assert.deepEqual(await secondRegistry.listMemorySpaces(), [
    {
      workspaceId: 'ws_runtime_validated',
      title: 'Runtime validated memory',
      description: 'Final runtime validation workspace.',
      addedAt: '2026-05-08T07:48:00.000Z',
      lastOpenedAt: '2026-05-08T07:48:00.000Z',
    },
  ]);
  assert.equal(
    await secondRegistry.resolveMemorySpaceRoot('ws_runtime_validated'),
    '/Users/example/Runtime validated memory'
  );
  assert.equal(
    JSON.stringify(await secondRegistry.listMemorySpaces()).includes('/Users/example'),
    false
  );
});

test('workspace memory space registry serializes concurrent upserts without dropping memorySpaces', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-concurrent-')),
    'registry.json'
  );
  const registry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });

  await Promise.all([
    registry.upsertMemorySpace({
      canonicalRoot: '/Users/example/Runtime validated memory',
      snapshot,
    }),
    registry.upsertMemorySpace({
      canonicalRoot: '/Users/example/Product research',
      snapshot: {
        ...snapshot,
        workspaceId: 'ws_product_research',
        title: 'Product research',
        description: '',
      },
    }),
  ]);

  assert.deepEqual(
    (await registry.listMemorySpaces()).map((memorySpace) => memorySpace.workspaceId).sort(),
    ['ws_product_research', 'ws_runtime_validated']
  );
});

test('workspace memory space registry removes a memory space entry without touching other memorySpaces', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-remove-')),
    'registry.json'
  );
  const registry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });

  await registry.upsertMemorySpace({
    canonicalRoot: '/Users/example/Runtime validated memory',
    snapshot,
  });
  await registry.upsertMemorySpace({
    canonicalRoot: '/Users/example/Product research',
    snapshot: {
      ...snapshot,
      workspaceId: 'ws_product_research',
      title: 'Product research',
      description: '',
    },
  });

  await registry.removeMemorySpace('ws_runtime_validated');
  await registry.removeMemorySpace('ws_missing');

  assert.equal(await registry.resolveMemorySpaceRoot('ws_runtime_validated'), null);
  assert.deepEqual(await registry.listMemorySpaces(), [
    {
      workspaceId: 'ws_product_research',
      title: 'Product research',
      description: '',
      addedAt: '2026-05-08T07:48:00.000Z',
      lastOpenedAt: '2026-05-08T07:48:00.000Z',
    },
  ]);
});

test('workspace memory space registry does not write when removing a missing memorySpace', async () => {
  const registryDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-memory-space-registry-noop-')
  );
  const registryPath = path.join(registryDirectory, 'registry.json');
  const registry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });

  await registry.upsertMemorySpace({
    canonicalRoot: '/Users/example/Runtime validated memory',
    snapshot,
  });

  await chmod(registryDirectory, 0o500);
  try {
    await registry.removeMemorySpace('ws_missing');
  } finally {
    await chmod(registryDirectory, 0o700);
  }

  assert.deepEqual(await registry.listMemorySpaces(), [
    {
      workspaceId: 'ws_runtime_validated',
      title: 'Runtime validated memory',
      description: 'Final runtime validation workspace.',
      addedAt: '2026-05-08T07:48:00.000Z',
      lastOpenedAt: '2026-05-08T07:48:00.000Z',
    },
  ]);
});

test('workspace memory space registry treats corrupt registry JSON as an empty memorySpace list', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-corrupt-')),
    'registry.json'
  );
  await writeFile(registryPath, '{not-json');

  const registry = createWorkspaceMemorySpaceRegistry({ registryPath });

  assert.deepEqual(await registry.listMemorySpaces(), []);
});

test('workspace memory space registry treats relative root paths as corrupt registry data', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-relative-root-')),
    'registry.json'
  );
  await writeFile(
    registryPath,
    `${JSON.stringify({
      schemaVersion: 1,
      memorySpaces: [
        {
          workspaceId: 'ws_relative',
          title: 'Relative',
          description: '',
          rootPath: 'relative/workspace',
          addedAt: '2026-05-08T07:48:00.000Z',
          lastOpenedAt: '2026-05-08T07:48:00.000Z',
        },
      ],
    })}\n`
  );

  const registry = createWorkspaceMemorySpaceRegistry({ registryPath });

  assert.deepEqual(await registry.listMemorySpaces(), []);
  assert.equal(await registry.resolveMemorySpaceRoot('ws_relative'), null);
});

test('workspace memory space registry bounds stored memorySpace count and display text length', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-bounds-')),
    'registry.json'
  );
  const registry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });

  for (let index = 0; index < 105; index += 1) {
    await registry.upsertMemorySpace({
      canonicalRoot: `/Users/example/workspace-${index}`,
      snapshot: {
        ...snapshot,
        workspaceId: `ws_${index}`,
        title: `Workspace ${index}`,
        description: index === 104 ? 'a'.repeat(5000) : '',
      },
    });
  }

  const memorySpaces = await registry.listMemorySpaces();
  assert.equal(memorySpaces.length, 100);
  assert.equal(memorySpaces[0]?.workspaceId, 'ws_104');
  assert.equal(memorySpaces[0]?.description.length, 4096);
  assert.equal(await registry.resolveMemorySpaceRoot('ws_0'), null);
});

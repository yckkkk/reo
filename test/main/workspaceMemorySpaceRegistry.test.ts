import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createWorkspaceMemorySpaceRegistry,
  setRenamedRootSiblingScanLimitForTest,
  setRenamedRootTotalSiblingScanLimitForTest,
} from '../../src/main/workspaceMemorySpaceRegistry.js';

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

test('workspace memory space registry lists cached entries and resolves Finder-renamed folders on demand', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-rename-'));
  const originalRoot = path.join(parentPath, '旧空间');
  const renamedRoot = path.join(parentPath, '灵感空间');
  await mkdir(path.join(originalRoot, '.reo'), { recursive: true });
  await writeFile(
    path.join(originalRoot, '.reo', 'workspace.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_runtime_validated',
        title: '旧空间',
        description: 'Final runtime validation workspace.',
        createdAt: '2026-05-08T07:47:00.000Z',
      },
      null,
      2
    )}\n`
  );

  const registryPath = path.join(parentPath, 'registry.json');
  const registry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });
  await registry.upsertMemorySpace({
    canonicalRoot: originalRoot,
    snapshot,
  });

  await rename(originalRoot, renamedRoot);

  assert.deepEqual(await registry.listMemorySpaces(), [
    {
      workspaceId: 'ws_runtime_validated',
      title: 'Runtime validated memory',
      description: 'Final runtime validation workspace.',
      addedAt: '2026-05-08T07:48:00.000Z',
      lastOpenedAt: '2026-05-08T07:48:00.000Z',
    },
  ]);
  assert.deepEqual(await registry.resolveMemorySpace('ws_runtime_validated'), {
    workspaceId: 'ws_runtime_validated',
    title: '灵感空间',
    description: 'Final runtime validation workspace.',
    rootPath: await realpath(renamedRoot),
    addedAt: '2026-05-08T07:48:00.000Z',
    lastOpenedAt: '2026-05-08T07:48:00.000Z',
  });
  assert.equal(
    await registry.resolveMemorySpaceRoot('ws_runtime_validated'),
    await realpath(renamedRoot)
  );
  assert.equal(
    JSON.parse(await readFile(path.join(renamedRoot, '.reo', 'workspace.json'), 'utf8')).title,
    '旧空间'
  );
  assert.equal(
    JSON.parse(await readFile(registryPath, 'utf8')).memorySpaces[0]?.rootPath,
    originalRoot
  );
});

test('workspace memory space registry caps Finder-renamed folder recovery scan', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-many-'));
  const originalRoot = path.join(parentPath, '旧空间');
  const renamedRoot = path.join(parentPath, 'zz-灵感空间');
  await mkdir(path.join(originalRoot, '.reo'), { recursive: true });
  await writeFile(
    path.join(originalRoot, '.reo', 'workspace.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_runtime_validated',
        title: '旧空间',
        description: 'Final runtime validation workspace.',
        createdAt: '2026-05-08T07:47:00.000Z',
      },
      null,
      2
    )}\n`
  );

  const registryPath = path.join(parentPath, 'registry.json');
  const registry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });
  await registry.upsertMemorySpace({
    canonicalRoot: originalRoot,
    snapshot,
  });

  for (let index = 0; index < 240; index += 1) {
    await mkdir(path.join(parentPath, `aa-decoy-${index.toString().padStart(3, '0')}`, '.reo'), {
      recursive: true,
    });
  }
  await rename(originalRoot, renamedRoot);

  setRenamedRootSiblingScanLimitForTest(0);
  try {
    assert.equal(await registry.resolveMemorySpaceRoot('ws_runtime_validated'), originalRoot);
  } finally {
    setRenamedRootSiblingScanLimitForTest(null);
  }
});

test('workspace memory space registry recovers a renamed folder within the scan cap', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-cap-hit-'));
  const originalRoot = path.join(parentPath, '旧空间');
  const renamedRoot = path.join(parentPath, '灵感空间');
  await mkdir(path.join(originalRoot, '.reo'), { recursive: true });
  await writeFile(
    path.join(originalRoot, '.reo', 'workspace.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_runtime_validated',
        title: '旧空间',
        description: 'Final runtime validation workspace.',
        createdAt: '2026-05-08T07:47:00.000Z',
      },
      null,
      2
    )}\n`
  );

  const registry = createWorkspaceMemorySpaceRegistry({
    registryPath: path.join(parentPath, 'registry.json'),
    now: () => '2026-05-08T07:48:00.000Z',
  });
  await registry.upsertMemorySpace({
    canonicalRoot: originalRoot,
    snapshot,
  });
  await rename(originalRoot, renamedRoot);

  setRenamedRootSiblingScanLimitForTest(1);
  try {
    assert.equal(
      await registry.resolveMemorySpaceRoot('ws_runtime_validated'),
      await realpath(renamedRoot)
    );
  } finally {
    setRenamedRootSiblingScanLimitForTest(null);
  }
});

test('workspace memory space registry rename scan counts only Reo workspace metadata candidates', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-cap-meta-'));
  const originalRoot = path.join(parentPath, '旧空间');
  const renamedRoot = path.join(parentPath, '灵感空间');
  await mkdir(path.join(originalRoot, '.reo'), { recursive: true });
  await writeFile(
    path.join(originalRoot, '.reo', 'workspace.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_runtime_validated',
        title: '旧空间',
        description: 'Final runtime validation workspace.',
        createdAt: '2026-05-08T07:47:00.000Z',
      },
      null,
      2
    )}\n`
  );
  for (let index = 0; index < 240; index += 1) {
    await mkdir(path.join(parentPath, `decoy-${index.toString().padStart(3, '0')}`, '.reo'), {
      recursive: true,
    });
  }

  const registry = createWorkspaceMemorySpaceRegistry({
    registryPath: path.join(parentPath, 'registry.json'),
    now: () => '2026-05-08T07:48:00.000Z',
  });
  await registry.upsertMemorySpace({
    canonicalRoot: originalRoot,
    snapshot,
  });
  await rename(originalRoot, renamedRoot);

  setRenamedRootSiblingScanLimitForTest(1);
  try {
    assert.equal(
      await registry.resolveMemorySpaceRoot('ws_runtime_validated'),
      await realpath(renamedRoot)
    );
  } finally {
    setRenamedRootSiblingScanLimitForTest(null);
  }
});

test('workspace memory space registry updates title projections without changing recency order', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-title-update-')),
    'registry.json'
  );
  let currentTime = '2026-05-08T07:48:00.000Z';
  const registry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => currentTime,
  });

  await registry.upsertMemorySpace({
    canonicalRoot: '/Users/example/Runtime validated memory',
    snapshot,
  });
  currentTime = '2026-05-08T07:49:00.000Z';
  await registry.upsertMemorySpace({
    canonicalRoot: '/Users/example/Product research',
    snapshot: {
      ...snapshot,
      workspaceId: 'ws_product_research',
      title: 'Product research',
      description: '',
    },
  });
  currentTime = '2026-05-08T07:50:00.000Z';

  await registry.updateMemorySpaceSnapshot({
    canonicalRoot: '/Users/example/Runtime validated memory',
    snapshot: {
      ...snapshot,
      title: 'Renamed memory space',
      description: 'Renamed description',
    },
  });

  assert.deepEqual(await registry.listMemorySpaces(), [
    {
      workspaceId: 'ws_product_research',
      title: 'Product research',
      description: '',
      addedAt: '2026-05-08T07:49:00.000Z',
      lastOpenedAt: '2026-05-08T07:49:00.000Z',
    },
    {
      workspaceId: 'ws_runtime_validated',
      title: 'Renamed memory space',
      description: 'Renamed description',
      addedAt: '2026-05-08T07:48:00.000Z',
      lastOpenedAt: '2026-05-08T07:48:00.000Z',
    },
  ]);
});

test('workspace memory space registry updates existing memorySpace without moving it', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-open-order-')),
    'registry.json'
  );
  let currentTime = '2026-05-08T07:48:00.000Z';
  const registry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => currentTime,
  });

  await registry.upsertMemorySpace({
    canonicalRoot: '/Users/example/Runtime validated memory',
    snapshot,
  });
  currentTime = '2026-05-08T07:49:00.000Z';
  await registry.upsertMemorySpace({
    canonicalRoot: '/Users/example/Product research',
    snapshot: {
      ...snapshot,
      workspaceId: 'ws_product_research',
      title: 'Product research',
      description: '',
    },
  });
  currentTime = '2026-05-08T07:50:00.000Z';

  await registry.upsertMemorySpace({
    canonicalRoot: '/Users/example/Runtime validated memory',
    snapshot: {
      ...snapshot,
      title: 'Runtime validated memory',
      description: 'Opened again.',
    },
  });

  assert.deepEqual(await registry.listMemorySpaces(), [
    {
      workspaceId: 'ws_product_research',
      title: 'Product research',
      description: '',
      addedAt: '2026-05-08T07:49:00.000Z',
      lastOpenedAt: '2026-05-08T07:49:00.000Z',
    },
    {
      workspaceId: 'ws_runtime_validated',
      title: 'Runtime validated memory',
      description: 'Opened again.',
      addedAt: '2026-05-08T07:48:00.000Z',
      lastOpenedAt: '2026-05-08T07:50:00.000Z',
    },
  ]);
});

test('workspace memory space registry keeps stale entries when Finder rename scan cannot read the parent', async () => {
  const parentPath = await mkdtemp(
    path.join(os.tmpdir(), 'reo-memory-space-registry-rename-unreadable-')
  );
  const registryDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-memory-space-registry-unreadable-parent-registry-')
  );
  const originalRoot = path.join(parentPath, '旧空间');
  const registryPath = path.join(registryDirectory, 'registry.json');
  const registry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });
  await registry.upsertMemorySpace({
    canonicalRoot: originalRoot,
    snapshot,
  });

  await chmod(parentPath, 0o000);
  try {
    assert.deepEqual(await registry.listMemorySpaces(), [
      {
        workspaceId: 'ws_runtime_validated',
        title: 'Runtime validated memory',
        description: 'Final runtime validation workspace.',
        addedAt: '2026-05-08T07:48:00.000Z',
        lastOpenedAt: '2026-05-08T07:48:00.000Z',
      },
    ]);
    assert.equal(await registry.resolveMemorySpaceRoot('ws_runtime_validated'), originalRoot);
  } finally {
    await chmod(parentPath, 0o700);
  }
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

test('workspace memory space registry treats over-cap registry files as corrupt data', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-over-cap-')),
    'registry.json'
  );
  await writeFile(
    registryPath,
    `${JSON.stringify({
      schemaVersion: 1,
      memorySpaces: Array.from({ length: 101 }, (_, index) => ({
        workspaceId: `ws_${index}`,
        title: `Workspace ${index}`,
        description: '',
        rootPath: `/Users/example/workspace-${index}`,
        addedAt: '2026-05-08T07:48:00.000Z',
        lastOpenedAt: '2026-05-08T07:48:00.000Z',
      })),
    })}\n`
  );

  const registry = createWorkspaceMemorySpaceRegistry({ registryPath });

  assert.deepEqual(await registry.listMemorySpaces(), []);
  assert.equal(await registry.resolveMemorySpaceRoot('ws_100'), null);
});

test('workspace memory space registry rejects writes that would exceed its read budget', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-byte-budget-')),
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

  const oversizedText = 'a'.repeat(4096);
  const oversizedRoot = `/${'r'.repeat(3800)}`;
  let rejected = false;
  for (let index = 0; index < 100; index += 1) {
    try {
      await registry.upsertMemorySpace({
        canonicalRoot: `${oversizedRoot}${index}`,
        snapshot: {
          ...snapshot,
          workspaceId: `ws_large_${index}`,
          title: oversizedText,
          description: oversizedText,
        },
      });
    } catch (error) {
      rejected = true;
      assert.match((error as Error).message, /too large/i);
      break;
    }
  }

  assert.equal(rejected, true);
  assert.ok(Buffer.byteLength(await readFile(registryPath, 'utf8'), 'utf8') <= 1_048_576);
  assert.equal(
    (await registry.listMemorySpaces()).some(
      (memorySpace) => memorySpace.workspaceId === 'ws_runtime_validated'
    ),
    true
  );
});

test('workspace memory space registry Finder rename scan counts only directory candidates', async () => {
  const parentPath = await mkdtemp(
    path.join(os.tmpdir(), 'reo-memory-space-registry-rename-files-')
  );
  const originalRoot = path.join(parentPath, '旧空间');
  const renamedRoot = path.join(parentPath, '灵感空间');
  await mkdir(path.join(originalRoot, '.reo'), { recursive: true });
  await writeFile(
    path.join(originalRoot, '.reo', 'workspace.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_runtime_validated',
        title: '旧空间',
        description: 'Final runtime validation workspace.',
        createdAt: '2026-05-08T07:47:00.000Z',
      },
      null,
      2
    )}\n`
  );

  for (let index = 0; index < 240; index += 1) {
    await writeFile(path.join(parentPath, `unrelated-${index}.txt`), '');
  }

  const registryPath = path.join(parentPath, 'registry.json');
  const registry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });
  await registry.upsertMemorySpace({
    canonicalRoot: originalRoot,
    snapshot,
  });

  await rename(originalRoot, renamedRoot);

  assert.equal(
    await registry.resolveMemorySpaceRoot('ws_runtime_validated'),
    await realpath(renamedRoot)
  );
});

test('workspace memory space registry Finder rename scan stops at the total sibling cap', async () => {
  const parentPath = await mkdtemp(
    path.join(os.tmpdir(), 'reo-memory-space-registry-rename-total-cap-')
  );
  const originalRoot = path.join(parentPath, '旧空间');
  const renamedRoot = path.join(parentPath, '灵感空间');
  await mkdir(path.join(originalRoot, '.reo'), { recursive: true });
  await writeFile(
    path.join(originalRoot, '.reo', 'workspace.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_runtime_validated',
        title: '旧空间',
        description: 'Final runtime validation workspace.',
        createdAt: '2026-05-08T07:47:00.000Z',
      },
      null,
      2
    )}\n`
  );

  const registryPath = path.join(parentPath, 'registry.json');
  const registry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });
  await registry.upsertMemorySpace({
    canonicalRoot: originalRoot,
    snapshot,
  });

  await rename(originalRoot, renamedRoot);

  setRenamedRootTotalSiblingScanLimitForTest(0);
  try {
    assert.equal(await registry.resolveMemorySpaceRoot('ws_runtime_validated'), originalRoot);
  } finally {
    setRenamedRootTotalSiblingScanLimitForTest(null);
  }
});

import assert from 'node:assert/strict';
import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createWorkspaceProjectRegistry } from '../../src/main/workspaceProjectRegistry.js';

const snapshot = {
  workspaceId: 'ws_runtime_validated',
  title: 'Runtime validated memory',
  description: 'Final runtime validation workspace.',
  memories: [],
  recordings: [],
};

test('workspace project registry persists projects across registry instances without exposing rootPath', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-project-registry-persist-')),
    'registry.json'
  );
  const firstRegistry = createWorkspaceProjectRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });

  await firstRegistry.upsertProject({
    canonicalRoot: '/Users/example/Runtime validated memory',
    snapshot,
  });

  const secondRegistry = createWorkspaceProjectRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });

  assert.deepEqual(await secondRegistry.listProjects(), [
    {
      workspaceId: 'ws_runtime_validated',
      title: 'Runtime validated memory',
      description: 'Final runtime validation workspace.',
      addedAt: '2026-05-08T07:48:00.000Z',
      lastOpenedAt: '2026-05-08T07:48:00.000Z',
    },
  ]);
  assert.equal(
    await secondRegistry.resolveProjectRoot('ws_runtime_validated'),
    '/Users/example/Runtime validated memory'
  );
  assert.equal(
    JSON.stringify(await secondRegistry.listProjects()).includes('/Users/example'),
    false
  );
});

test('workspace project registry serializes concurrent upserts without dropping projects', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-project-registry-concurrent-')),
    'registry.json'
  );
  const registry = createWorkspaceProjectRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });

  await Promise.all([
    registry.upsertProject({
      canonicalRoot: '/Users/example/Runtime validated memory',
      snapshot,
    }),
    registry.upsertProject({
      canonicalRoot: '/Users/example/Product research',
      snapshot: {
        ...snapshot,
        workspaceId: 'ws_product_research',
        title: 'Product research',
        description: '',
      },
    }),
  ]);

  assert.deepEqual((await registry.listProjects()).map((project) => project.workspaceId).sort(), [
    'ws_product_research',
    'ws_runtime_validated',
  ]);
});

test('workspace project registry removes a project entry without touching other projects', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-project-registry-remove-')),
    'registry.json'
  );
  const registry = createWorkspaceProjectRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });

  await registry.upsertProject({
    canonicalRoot: '/Users/example/Runtime validated memory',
    snapshot,
  });
  await registry.upsertProject({
    canonicalRoot: '/Users/example/Product research',
    snapshot: {
      ...snapshot,
      workspaceId: 'ws_product_research',
      title: 'Product research',
      description: '',
    },
  });

  await registry.removeProject('ws_runtime_validated');
  await registry.removeProject('ws_missing');

  assert.equal(await registry.resolveProjectRoot('ws_runtime_validated'), null);
  assert.deepEqual(await registry.listProjects(), [
    {
      workspaceId: 'ws_product_research',
      title: 'Product research',
      description: '',
      addedAt: '2026-05-08T07:48:00.000Z',
      lastOpenedAt: '2026-05-08T07:48:00.000Z',
    },
  ]);
});

test('workspace project registry does not write when removing a missing project', async () => {
  const registryDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-project-registry-noop-'));
  const registryPath = path.join(registryDirectory, 'registry.json');
  const registry = createWorkspaceProjectRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });

  await registry.upsertProject({
    canonicalRoot: '/Users/example/Runtime validated memory',
    snapshot,
  });

  await chmod(registryDirectory, 0o500);
  try {
    await registry.removeProject('ws_missing');
  } finally {
    await chmod(registryDirectory, 0o700);
  }

  assert.deepEqual(await registry.listProjects(), [
    {
      workspaceId: 'ws_runtime_validated',
      title: 'Runtime validated memory',
      description: 'Final runtime validation workspace.',
      addedAt: '2026-05-08T07:48:00.000Z',
      lastOpenedAt: '2026-05-08T07:48:00.000Z',
    },
  ]);
});

test('workspace project registry treats corrupt registry JSON as an empty project list', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-project-registry-corrupt-')),
    'registry.json'
  );
  await writeFile(registryPath, '{not-json');

  const registry = createWorkspaceProjectRegistry({ registryPath });

  assert.deepEqual(await registry.listProjects(), []);
});

test('workspace project registry treats relative root paths as corrupt registry data', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-project-registry-relative-root-')),
    'registry.json'
  );
  await writeFile(
    registryPath,
    `${JSON.stringify({
      schemaVersion: 1,
      projects: [
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

  const registry = createWorkspaceProjectRegistry({ registryPath });

  assert.deepEqual(await registry.listProjects(), []);
  assert.equal(await registry.resolveProjectRoot('ws_relative'), null);
});

test('workspace project registry bounds stored project count and display text length', async () => {
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-project-registry-bounds-')),
    'registry.json'
  );
  const registry = createWorkspaceProjectRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });

  for (let index = 0; index < 105; index += 1) {
    await registry.upsertProject({
      canonicalRoot: `/Users/example/workspace-${index}`,
      snapshot: {
        ...snapshot,
        workspaceId: `ws_${index}`,
        title: `Workspace ${index}`,
        description: index === 104 ? 'a'.repeat(5000) : '',
      },
    });
  }

  const projects = await registry.listProjects();
  assert.equal(projects.length, 100);
  assert.equal(projects[0]?.workspaceId, 'ws_104');
  assert.equal(projects[0]?.description.length, 4096);
  assert.equal(await registry.resolveProjectRoot('ws_0'), null);
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, renameSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setBeforeAtomicWorkspaceFileTempOpenForTest } from '../../src/main/atomicWorkspaceFile.js';
import {
  readArtifactRuntimeState,
  writeArtifactRuntimeState,
} from '../../src/main/artifactRuntimeState.js';
import { renderWorkspaceMarkdownObject } from '../../src/main/workspaceMarkdownObjects.js';

function sha256Text(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

async function workspaceRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'reo-artifact-runtime-'));
}

async function writeHomeComponent(rootPath: string): Promise<string> {
  const componentId = 'hcmp_runtime';
  const componentDirectory = path.join(rootPath, 'home-components', `${componentId}--Runtime`);
  await mkdir(componentDirectory, { recursive: true });
  await writeFile(
    path.join(componentDirectory, 'component.md'),
    '---\nid: hcmp_runtime\ntitle: Runtime\nkind: home-component\nformat: html\nmount: home\n---\n# Runtime\n'
  );
  await writeFile(path.join(componentDirectory, 'entry.html'), '<!doctype html><p>Runtime</p>');
  await writeFile(
    path.join(componentDirectory, 'state.json'),
    '{"schemaVersion":1,"stores":{"home":{"selected":"today"}}}\n'
  );
  return componentDirectory;
}

async function writeArtifactSegment(rootPath: string): Promise<string> {
  const memoryId = 'mem_runtime';
  const segmentId = 'seg_runtime';
  const segmentDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  const timestamp = '2026-06-04T08:00:00.000Z';
  const html = '<!doctype html><html><body>Runtime</body></html>\n';

  await mkdir(path.join(rootPath, '.reo', 'objects', 'segments'), { recursive: true });
  await mkdir(segmentDirectory, { recursive: true });
  await writeFile(
    path.join(rootPath, 'memories', memoryId, 'memory.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'memory',
      data: { id: memoryId, title: 'Runtime memory' },
      content: '# Runtime memory\n',
    })
  );
  await writeFile(
    path.join(segmentDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { id: segmentId, title: 'Runtime work', kind: 'artifact', format: 'html' },
      content: '# Runtime work\n',
    })
  );
  await writeFile(path.join(segmentDirectory, 'entry.html'), html);
  await writeFile(
    path.join(segmentDirectory, 'runtime.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        title: 'Runtime work',
        entry: 'entry.html',
      },
      null,
      2
    ) + '\n'
  );
  await writeFile(
    path.join(segmentDirectory, 'state.json'),
    '{"schemaVersion":1,"stores":{"todos":{"items":[]}}}\n'
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'segments', `${segmentId}.json`),
    JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'segment',
        workspaceId: 'ws_runtime',
        memoryId,
        segmentId,
        kind: 'artifact',
        format: 'html',
        createdAt: timestamp,
        finalizedAt: timestamp,
        updatedAt: timestamp,
        entryByteLength: Buffer.byteLength(html, 'utf8'),
        entryHash: sha256Text(html),
      },
      null,
      2
    ) + '\n'
  );

  return segmentDirectory;
}

async function writeArtifactSupplement(rootPath: string): Promise<string> {
  const segmentDirectory = await writeArtifactSegment(rootPath);
  const memoryId = 'mem_runtime';
  const segmentId = 'seg_runtime';
  const supplementId = 'sup_runtime';
  const supplementDirectory = path.join(segmentDirectory, 'supplements', supplementId);
  const timestamp = '2026-06-04T08:05:00.000Z';
  const html = '<!doctype html><html><body>Runtime supplement</body></html>\n';

  await mkdir(path.join(rootPath, '.reo', 'objects', 'supplements'), { recursive: true });
  await mkdir(supplementDirectory, { recursive: true });
  await writeFile(
    path.join(supplementDirectory, 'supplement.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'supplement',
      data: { id: supplementId, title: 'Runtime supplement', kind: 'artifact', format: 'html' },
      content: '# Runtime supplement\n',
    })
  );
  await writeFile(path.join(supplementDirectory, 'entry.html'), html);
  await writeFile(
    path.join(supplementDirectory, 'runtime.json'),
    '{"schemaVersion":1,"title":"Runtime supplement","entry":"entry.html"}\n'
  );
  await writeFile(
    path.join(supplementDirectory, 'state.json'),
    '{"schemaVersion":1,"stores":{"progress":{"done":false}}}\n'
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'supplements', `${supplementId}.json`),
    JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'supplement',
        workspaceId: 'ws_runtime',
        memoryId,
        segmentId,
        supplementId,
        kind: 'artifact',
        format: 'html',
        createdAt: timestamp,
        finalizedAt: timestamp,
        updatedAt: timestamp,
        entryByteLength: Buffer.byteLength(html, 'utf8'),
        entryHash: sha256Text(html),
      },
      null,
      2
    ) + '\n'
  );

  return supplementDirectory;
}

test('artifact runtime state reads state.json and rejects stale baseline writes', async () => {
  const rootPath = await workspaceRoot();
  const segmentDirectory = await writeArtifactSegment(rootPath);
  const target = {
    targetType: 'segment' as const,
    workspaceId: 'ws_runtime',
    memoryId: 'mem_runtime',
    segmentId: 'seg_runtime',
  };

  const firstRead = await readArtifactRuntimeState({ rootPath, target });
  assert.equal(firstRead.ok, true);
  if (!firstRead.ok) {
    return;
  }
  assert.deepEqual(firstRead.value.state, {
    schemaVersion: 1,
    stores: { todos: { items: [] } },
  });
  assert.equal(firstRead.value.source, 'file');

  const saved = await writeArtifactRuntimeState({
    rootPath,
    target,
    baselineVersion: firstRead.value.version,
    state: { schemaVersion: 1, stores: { todos: { items: ['first'] } } },
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) {
    return;
  }
  assert.equal(saved.value.status, 'saved');
  assert.notEqual(saved.value.version, firstRead.value.version);
  assert.deepEqual(JSON.parse(await readFile(path.join(segmentDirectory, 'state.json'), 'utf8')), {
    schemaVersion: 1,
    stores: { todos: { items: ['first'] } },
  });

  await writeFile(
    path.join(segmentDirectory, 'state.json'),
    '{"schemaVersion":1,"stores":{"todos":{"items":["external"]}}}\n'
  );
  const stale = await writeArtifactRuntimeState({
    rootPath,
    target,
    baselineVersion: saved.value.version,
    state: { schemaVersion: 1, stores: { todos: { items: ['second'] } } },
  });
  assert.equal(stale.ok, true);
  if (stale.ok) {
    assert.equal(stale.value.status, 'stale');
    assert.deepEqual(stale.value.currentState, {
      schemaVersion: 1,
      stores: { todos: { items: ['external'] } },
    });
  }
  assert.deepEqual(JSON.parse(await readFile(path.join(segmentDirectory, 'state.json'), 'utf8')), {
    schemaVersion: 1,
    stores: { todos: { items: ['external'] } },
  });
});

test('artifact runtime state supports app-level home component targets', async () => {
  const rootPath = await workspaceRoot();
  const componentDirectory = await writeHomeComponent(rootPath);
  const target = {
    targetType: 'home-component' as const,
    componentId: 'hcmp_runtime',
  };

  const firstRead = await readArtifactRuntimeState({ rootPath, target });
  assert.equal(firstRead.ok, true);
  if (!firstRead.ok) {
    return;
  }
  assert.deepEqual(firstRead.value.state, {
    schemaVersion: 1,
    stores: { home: { selected: 'today' } },
  });

  const saved = await writeArtifactRuntimeState({
    rootPath,
    target,
    baselineVersion: firstRead.value.version,
    state: { schemaVersion: 1, stores: { home: { selected: 'tomorrow' } } },
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) {
    return;
  }
  assert.equal(saved.value.status, 'saved');
  assert.deepEqual(
    JSON.parse(await readFile(path.join(componentDirectory, 'state.json'), 'utf8')),
    {
      schemaVersion: 1,
      stores: { home: { selected: 'tomorrow' } },
    }
  );
});

test('artifact runtime state rejects writes that exceed the readable state size limit', async () => {
  const rootPath = await workspaceRoot();
  const segmentDirectory = await writeArtifactSegment(rootPath);
  const target = {
    targetType: 'segment' as const,
    workspaceId: 'ws_runtime',
    memoryId: 'mem_runtime',
    segmentId: 'seg_runtime',
  };

  const before = await readArtifactRuntimeState({ rootPath, target });
  assert.equal(before.ok, true);
  if (!before.ok) {
    return;
  }
  const originalStateText = await readFile(path.join(segmentDirectory, 'state.json'), 'utf8');

  const oversized = await writeArtifactRuntimeState({
    rootPath,
    target,
    baselineVersion: before.value.version,
    state: { schemaVersion: 1, stores: { oversized: 'x'.repeat(1024 * 1024) } },
  });
  assert.equal(oversized.ok, false);
  if (!oversized.ok) {
    assert.equal(oversized.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');
  }
  assert.equal(
    await readFile(path.join(segmentDirectory, 'state.json'), 'utf8'),
    originalStateText
  );
});

test('artifact runtime state fails open for missing or corrupt state files and supports supplements', async () => {
  const rootPath = await workspaceRoot();
  const supplementDirectory = await writeArtifactSupplement(rootPath);
  const supplementTarget = {
    targetType: 'supplement' as const,
    workspaceId: 'ws_runtime',
    memoryId: 'mem_runtime',
    segmentId: 'seg_runtime',
    supplementId: 'sup_runtime',
  };

  const supplementRead = await readArtifactRuntimeState({ rootPath, target: supplementTarget });
  assert.equal(supplementRead.ok, true);
  if (supplementRead.ok) {
    assert.deepEqual(supplementRead.value.state, {
      schemaVersion: 1,
      stores: { progress: { done: false } },
    });
  }

  await rm(path.join(supplementDirectory, 'state.json'));
  const missingRead = await readArtifactRuntimeState({ rootPath, target: supplementTarget });
  assert.equal(missingRead.ok, true);
  if (missingRead.ok) {
    assert.equal(missingRead.value.source, 'missing');
    assert.deepEqual(missingRead.value.state, { schemaVersion: 1, stores: {} });
  }

  await writeFile(path.join(supplementDirectory, 'state.json'), '{not-json');
  const invalidRead = await readArtifactRuntimeState({ rootPath, target: supplementTarget });
  assert.equal(invalidRead.ok, true);
  if (invalidRead.ok) {
    assert.equal(invalidRead.value.source, 'invalid');
    assert.deepEqual(invalidRead.value.state, { schemaVersion: 1, stores: {} });
  }
});

test('artifact runtime state missing first write does not follow a replaced object directory', async () => {
  const rootPath = await workspaceRoot();
  const segmentDirectory = await writeArtifactSegment(rootPath);
  const target = {
    targetType: 'segment' as const,
    workspaceId: 'ws_runtime',
    memoryId: 'mem_runtime',
    segmentId: 'seg_runtime',
  };
  await rm(path.join(segmentDirectory, 'state.json'));

  const missingRead = await readArtifactRuntimeState({ rootPath, target });
  assert.equal(missingRead.ok, true);
  if (!missingRead.ok) {
    return;
  }
  assert.equal(missingRead.value.source, 'missing');

  const replacedDirectory = `${segmentDirectory}.replaced`;
  let replaced = false;
  setBeforeAtomicWorkspaceFileTempOpenForTest(() => {
    if (replaced) {
      return;
    }
    replaced = true;
    renameSync(segmentDirectory, replacedDirectory);
    mkdirSync(segmentDirectory, { recursive: true });
  });

  try {
    const result = await writeArtifactRuntimeState({
      rootPath,
      target,
      baselineVersion: missingRead.value.version,
      state: { schemaVersion: 1, stores: { created: true } },
    });

    assert.equal(result.ok, false);
    await assert.rejects(readFile(path.join(segmentDirectory, 'state.json'), 'utf8'));
    await assert.rejects(readFile(path.join(replacedDirectory, 'state.json'), 'utf8'));
  } finally {
    setBeforeAtomicWorkspaceFileTempOpenForTest(null);
  }
});

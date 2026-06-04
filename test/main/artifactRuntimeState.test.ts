import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createArtifactRuntimeSecretStore,
  clearArtifactRuntimeSecretValue,
  getArtifactRuntimeSecretsFilePath,
  getArtifactRuntimeSecretValue,
  listArtifactRuntimeSecretSlots,
  setArtifactRuntimeSecretValue,
} from '../../src/main/artifactRuntimeSecrets.js';
import {
  readArtifactRuntimeState,
  writeArtifactRuntimeState,
} from '../../src/main/artifactRuntimeState.js';
import { renderWorkspaceMarkdownObject } from '../../src/main/workspaceMarkdownObjects.js';

type FakeSafeStorageBackend =
  | 'basic_text'
  | 'gnome_libsecret'
  | 'kwallet'
  | 'kwallet5'
  | 'kwallet6'
  | 'unknown';

function makeFakeSafeStorage() {
  let available = true;
  let backend: FakeSafeStorageBackend | undefined;
  const prefix = 'enc:';
  return {
    isEncryptionAvailable: () => available,
    encryptString: (plaintext: string) => Buffer.from(`${prefix}${plaintext}`, 'utf8'),
    decryptString: (cipher: Buffer) => {
      const value = cipher.toString('utf8');
      if (!value.startsWith(prefix)) {
        throw new Error('decrypt failed');
      }
      return value.slice(prefix.length);
    },
    getSelectedStorageBackend: () => backend ?? 'gnome_libsecret',
    setAvailable(value: boolean) {
      available = value;
    },
    setBackend(value: FakeSafeStorageBackend | undefined) {
      backend = value;
    },
  };
}

function sha256Text(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

async function workspaceRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'reo-artifact-runtime-'));
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
        secrets: [{ id: 'apiKey', label: 'API Key', purpose: '联网仪表盘测试' }],
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
    '{"schemaVersion":1,"title":"Runtime supplement","entry":"entry.html","secrets":[]}\n'
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

test('artifact runtime secrets bind object slot values outside the runtime bundle', async () => {
  const rootPath = await workspaceRoot();
  const segmentDirectory = await writeArtifactSegment(rootPath);
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'reo-artifact-runtime-secrets-'));
  const store = createArtifactRuntimeSecretStore({
    platform: 'linux',
    safeStorage: makeFakeSafeStorage(),
    userDataDir,
  });
  const target = {
    targetType: 'segment' as const,
    workspaceId: 'ws_runtime',
    memoryId: 'mem_runtime',
    segmentId: 'seg_runtime',
  };

  const before = await listArtifactRuntimeSecretSlots({ rootPath, store, target });
  assert.equal(before.ok, true);
  if (!before.ok) {
    return;
  }
  assert.deepEqual(before.value.slots, [
    { id: 'apiKey', label: 'API Key', purpose: '联网仪表盘测试', configured: false },
  ]);

  const set = await setArtifactRuntimeSecretValue({
    rootPath,
    store,
    target,
    slotId: 'apiKey',
    value: 'runtime-secret-value',
  });
  assert.equal(set.ok, true);

  const value = await getArtifactRuntimeSecretValue({ rootPath, store, target, slotId: 'apiKey' });
  assert.equal(value.ok, true);
  if (value.ok) {
    assert.equal(value.value.configured, true);
    assert.equal(value.value.value, 'runtime-secret-value');
  }

  const after = await listArtifactRuntimeSecretSlots({ rootPath, store, target });
  assert.equal(after.ok, true);
  if (after.ok) {
    assert.equal(after.value.slots[0]?.configured, true);
  }
  assert.doesNotMatch(
    await readFile(path.join(segmentDirectory, 'runtime.json'), 'utf8'),
    /secret-value/
  );
  assert.doesNotMatch(
    await readFile(path.join(segmentDirectory, 'state.json'), 'utf8'),
    /secret-value/
  );
  const rawSecretFile = await readFile(getArtifactRuntimeSecretsFilePath(userDataDir), 'utf8');
  assert.doesNotMatch(rawSecretFile, /runtime-secret-value/);
  assert.match(
    rawSecretFile,
    new RegExp(Buffer.from('enc:runtime-secret-value').toString('base64'))
  );
});

test('artifact runtime secrets require declared slots and resolvable artifact targets', async () => {
  const rootPath = await workspaceRoot();
  await writeArtifactSegment(rootPath);
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'reo-artifact-runtime-secrets-'));
  const store = createArtifactRuntimeSecretStore({
    platform: 'linux',
    safeStorage: makeFakeSafeStorage(),
    userDataDir,
  });
  const target = {
    targetType: 'segment' as const,
    workspaceId: 'ws_runtime',
    memoryId: 'mem_runtime',
    segmentId: 'seg_runtime',
  };

  const undeclaredSet = await setArtifactRuntimeSecretValue({
    rootPath,
    store,
    target,
    slotId: 'undeclared',
    value: 'must-not-persist',
  });
  assert.equal(undeclaredSet.ok, false);
  if (!undeclaredSet.ok) {
    assert.equal(undeclaredSet.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');
  }

  const undeclaredGet = await getArtifactRuntimeSecretValue({
    rootPath,
    store,
    target,
    slotId: 'undeclared',
  });
  assert.equal(undeclaredGet.ok, false);

  const undeclaredClear = await clearArtifactRuntimeSecretValue({
    rootPath,
    store,
    target,
    slotId: 'undeclared',
  });
  assert.equal(undeclaredClear.ok, false);

  const missingTargetSet = await setArtifactRuntimeSecretValue({
    rootPath,
    store,
    target: { ...target, segmentId: 'seg_missing' },
    slotId: 'apiKey',
    value: 'must-not-persist',
  });
  assert.equal(missingTargetSet.ok, false);
  if (!missingTargetSet.ok) {
    assert.equal(missingTargetSet.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }

  const secretFile = await readFile(getArtifactRuntimeSecretsFilePath(userDataDir), 'utf8').catch(
    () => ''
  );
  assert.doesNotMatch(secretFile, /must-not-persist/);
});

test('artifact runtime secrets reject writes when secure storage is unavailable', async () => {
  const rootPath = await workspaceRoot();
  await writeArtifactSegment(rootPath);
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'reo-artifact-runtime-secrets-'));
  const safeStorage = makeFakeSafeStorage();
  safeStorage.setAvailable(false);
  const store = createArtifactRuntimeSecretStore({
    platform: 'linux',
    safeStorage,
    userDataDir,
  });
  const target = {
    targetType: 'segment' as const,
    workspaceId: 'ws_runtime',
    memoryId: 'mem_runtime',
    segmentId: 'seg_runtime',
  };

  const set = await setArtifactRuntimeSecretValue({
    rootPath,
    store,
    target,
    slotId: 'apiKey',
    value: 'must-not-persist',
  });
  assert.equal(set.ok, false);
  if (!set.ok) {
    assert.equal(set.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');
  }
  const secretFile = await readFile(getArtifactRuntimeSecretsFilePath(userDataDir), 'utf8').catch(
    () => ''
  );
  assert.doesNotMatch(secretFile, /must-not-persist/);
});

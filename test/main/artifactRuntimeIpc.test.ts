import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createArtifactRuntimeSecretStore,
  getArtifactRuntimeSecretsFilePath,
} from '../../src/main/artifactRuntimeSecrets.js';
import {
  handleGetArtifactRuntimeSecretForTest,
  handleClearArtifactRuntimeSecretForTest,
  handleListArtifactRuntimeSecretSlotsForTest,
  handleReadArtifactRuntimeStateForTest,
  handleSetArtifactRuntimeSecretForTest,
  handleWriteArtifactRuntimeStateForTest,
} from '../../src/main/workspaceIpc.js';
import { createWorkspaceHandleStore } from '../../src/main/workspaceHandles.js';
import { renderWorkspaceMarkdownObject } from '../../src/main/workspaceMarkdownObjects.js';
import type {
  TrustedSenderEventAdapter,
  TrustedSenderIdentity,
} from '../../src/main/trustedSender.js';

const expectedSession = { label: 'default-session' };
const sender: TrustedSenderIdentity = {
  processId: 7,
  frameRoutingId: 4,
  origin: 'reo-app://renderer',
  sessionKey: 'default',
};
const event: TrustedSenderEventAdapter = {
  processId: 7,
  sender: { session: expectedSession },
  senderFrame: {
    routingId: 4,
    topRoutingId: 4,
    url: 'reo-app://renderer/index.html',
  },
};

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
  return mkdtemp(path.join(os.tmpdir(), 'reo-artifact-runtime-ipc-'));
}

function handleStoreFor(rootPath: string) {
  const handleStore = createWorkspaceHandleStore({ createHandle: () => 'wh_runtime' });
  handleStore.register({
    canonicalRoot: rootPath,
    workspaceId: 'ws_runtime',
    sender,
    lock: {
      isHeld: () => true,
      isUsable: () => true,
      relocate: () => ({ ok: true }),
      release: async () => {},
    },
  });
  return handleStore;
}

function baseIpcOptions(rootPath: string, input: unknown) {
  return {
    event,
    expectedSession,
    expectedSessionKey: 'default',
    handleStore: handleStoreFor(rootPath),
    input,
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
  };
}

async function writeArtifactSegment(rootPath: string): Promise<string> {
  const memoryId = 'mem_runtime';
  const segmentId = 'seg_runtime';
  const segmentDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  const timestamp = '2026-06-04T09:00:00.000Z';
  const html = '<!doctype html><html><body>Runtime IPC</body></html>\n';

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
    '{"schemaVersion":1,"title":"Runtime work","entry":"entry.html","secrets":[{"id":"apiKey","label":"API Key"}]}\n'
  );
  await writeFile(
    path.join(segmentDirectory, 'state.json'),
    '{"schemaVersion":1,"stores":{"ui":{"count":0}}}\n'
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

test('artifact runtime state IPC reads and writes through the active workspace handle', async () => {
  const rootPath = await workspaceRoot();
  const segmentDirectory = await writeArtifactSegment(rootPath);
  const target = {
    workspaceHandle: 'wh_runtime',
    workspaceId: 'ws_runtime',
    targetType: 'segment' as const,
    memoryId: 'mem_runtime',
    segmentId: 'seg_runtime',
  };

  const read = await handleReadArtifactRuntimeStateForTest(
    baseIpcOptions(rootPath, { ...target, requestId: 'state-read-1' })
  );
  assert.equal(read.ok, true);
  if (!read.ok) {
    return;
  }
  assert.equal(read.value.requestId, 'state-read-1');
  assert.deepEqual(read.value.state, { schemaVersion: 1, stores: { ui: { count: 0 } } });

  const write = await handleWriteArtifactRuntimeStateForTest(
    baseIpcOptions(rootPath, {
      ...target,
      requestId: 'state-write-1',
      baselineVersion: read.value.version,
      state: { schemaVersion: 1, stores: { ui: { count: 1 } } },
    })
  );
  assert.equal(write.ok, true);
  if (write.ok) {
    assert.equal(write.value.status, 'saved');
  }
  if (write.ok && write.value.status === 'saved') {
    assert.deepEqual(write.value, {
      requestId: 'state-write-1',
      status: 'saved',
      state: { schemaVersion: 1, stores: { ui: { count: 1 } } },
      version: write.value.version,
    });
  }
  assert.deepEqual(JSON.parse(await readFile(path.join(segmentDirectory, 'state.json'), 'utf8')), {
    schemaVersion: 1,
    stores: { ui: { count: 1 } },
  });
});

test('artifact runtime secret IPC stores values outside the runtime bundle', async () => {
  const rootPath = await workspaceRoot();
  const segmentDirectory = await writeArtifactSegment(rootPath);
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'reo-artifact-runtime-ipc-secrets-'));
  const secretStore = createArtifactRuntimeSecretStore({
    platform: 'linux',
    safeStorage: makeFakeSafeStorage(),
    userDataDir,
  });
  const target = {
    workspaceHandle: 'wh_runtime',
    workspaceId: 'ws_runtime',
    targetType: 'segment' as const,
    memoryId: 'mem_runtime',
    segmentId: 'seg_runtime',
  };

  const before = await handleListArtifactRuntimeSecretSlotsForTest({
    ...baseIpcOptions(rootPath, { ...target, requestId: 'secret-list-1' }),
    artifactRuntimeSecretStore: secretStore,
  });
  assert.equal(before.ok, true);
  if (before.ok) {
    assert.deepEqual(before.value.slots, [{ id: 'apiKey', label: 'API Key', configured: false }]);
  }

  const set = await handleSetArtifactRuntimeSecretForTest({
    ...baseIpcOptions(rootPath, {
      ...target,
      requestId: 'secret-set-1',
      slotId: 'apiKey',
      value: 'ipc-secret',
    }),
    artifactRuntimeSecretStore: secretStore,
  });
  assert.equal(set.ok, true);
  if (set.ok) {
    assert.deepEqual(set.value, { requestId: 'secret-set-1', configured: true });
  }

  const value = await handleGetArtifactRuntimeSecretForTest({
    ...baseIpcOptions(rootPath, {
      ...target,
      requestId: 'secret-get-1',
      slotId: 'apiKey',
    }),
    artifactRuntimeSecretStore: secretStore,
  });
  assert.equal(value.ok, true);
  if (value.ok) {
    assert.deepEqual(value.value, {
      requestId: 'secret-get-1',
      configured: true,
      value: 'ipc-secret',
    });
  }

  assert.doesNotMatch(
    await readFile(path.join(segmentDirectory, 'runtime.json'), 'utf8'),
    /ipc-secret/
  );
  assert.doesNotMatch(
    await readFile(path.join(segmentDirectory, 'state.json'), 'utf8'),
    /ipc-secret/
  );
  const rawSecretFile = await readFile(getArtifactRuntimeSecretsFilePath(userDataDir), 'utf8');
  assert.doesNotMatch(rawSecretFile, /ipc-secret/);
  assert.match(rawSecretFile, new RegExp(Buffer.from('enc:ipc-secret').toString('base64')));
});

test('artifact runtime secret IPC rejects undeclared slots before touching userData', async () => {
  const rootPath = await workspaceRoot();
  await writeArtifactSegment(rootPath);
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'reo-artifact-runtime-ipc-secrets-'));
  const secretStore = createArtifactRuntimeSecretStore({
    platform: 'linux',
    safeStorage: makeFakeSafeStorage(),
    userDataDir,
  });
  const target = {
    workspaceHandle: 'wh_runtime',
    workspaceId: 'ws_runtime',
    targetType: 'segment' as const,
    memoryId: 'mem_runtime',
    segmentId: 'seg_runtime',
  };

  const set = await handleSetArtifactRuntimeSecretForTest({
    ...baseIpcOptions(rootPath, {
      ...target,
      requestId: 'secret-set-undeclared',
      slotId: 'undeclared',
      value: 'must-not-persist',
    }),
    artifactRuntimeSecretStore: secretStore,
  });
  assert.equal(set.ok, false);
  if (!set.ok) {
    assert.equal(set.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');
  }

  const get = await handleGetArtifactRuntimeSecretForTest({
    ...baseIpcOptions(rootPath, {
      ...target,
      requestId: 'secret-get-undeclared',
      slotId: 'undeclared',
    }),
    artifactRuntimeSecretStore: secretStore,
  });
  assert.equal(get.ok, false);

  const clear = await handleClearArtifactRuntimeSecretForTest({
    ...baseIpcOptions(rootPath, {
      ...target,
      requestId: 'secret-clear-undeclared',
      slotId: 'undeclared',
    }),
    artifactRuntimeSecretStore: secretStore,
  });
  assert.equal(clear.ok, false);

  const missingTarget = await handleSetArtifactRuntimeSecretForTest({
    ...baseIpcOptions(rootPath, {
      ...target,
      requestId: 'secret-set-missing-target',
      segmentId: 'seg_missing',
      slotId: 'apiKey',
      value: 'must-not-persist',
    }),
    artifactRuntimeSecretStore: secretStore,
  });
  assert.equal(missingTarget.ok, false);
  if (!missingTarget.ok) {
    assert.equal(missingTarget.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }

  const secretFile = await readFile(getArtifactRuntimeSecretsFilePath(userDataDir), 'utf8').catch(
    () => ''
  );
  assert.doesNotMatch(secretFile, /must-not-persist/);
});

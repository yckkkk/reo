import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  closeAllWorkspaceHandles,
  handleChooseWorkspaceDirectory,
  handleBeginMicrophoneIntentForTest,
  handleClearMicrophoneIntentForTest,
  handleCloseRecordingTranscriptionForTest,
  handleCloseWorkspaceForTest,
  handleCreateRecordingDraftForTest,
  handleCreateSegmentSupplementRecordingDraftForTest,
  handleCreateMemoryForTest,
  handleDeleteMemoryForTest,
  handleDeleteSegmentSupplementForTest,
  handleDeleteSegmentForTest,
  handleFinalizeRecordingDraftForTest,
  handleFinalizeSegmentSupplementRecordingDraftForTest,
  handleFinishRecordingTranscriptionForTest,
  handleInitializeWorkspace,
  handleInitializeWorkspaceForTest,
  handleListWorkspaceMemorySpacesForTest,
  handleOpenWorkspace,
  handleOpenWorkspaceMemorySpaceForTest,
  handleReadWorkspaceSnapshotForTest,
  handleReadFinalizedAudioSegmentForTest,
  handleReadFinalizedAudioSegmentSupplementForTest,
  handleReadMemoryDetailForTest,
  handleRequestSegmentTranscriptionBackfillForTest,
  handleRequestSegmentSupplementTranscriptionBackfillForTest,
  handleRevealMemoryInFinderForTest,
  handleRevealMemorySpaceInFinderForTest,
  handleRevealSegmentInFinderForTest,
  handleRevealSegmentSupplementInFinderForTest,
  handleOpenMemoryDocumentForTest,
  handleOpenSegmentDocumentForTest,
  handleOpenSegmentSupplementDocumentForTest,
  handleOpenMemorySpaceAgentsFileForTest,
  handleCopyMemoryAbsolutePathForTest,
  handleCopyMemorySpaceAbsolutePathForTest,
  handleCopyMemoryRelativePathForTest,
  handleCopySegmentAbsolutePathForTest,
  handleCopySegmentRelativePathForTest,
  handleCopySegmentSupplementAbsolutePathForTest,
  handleCopySegmentSupplementRelativePathForTest,
  handleClearVoiceTranscriptionApiKeyForTest,
  handleOpenVoiceTranscriptionProviderConsoleForTest,
  handleOpenWorkspaceForTest,
  handleRemoveMemorySpaceForTest,
  handleReadVoiceTranscriptionSettingsForTest,
  handleRestoreDeletedMemoryForTest,
  handleRestoreDeletedSegmentSupplementForTest,
  handleRestoreDeletedSegmentForTest,
  handleSaveSegmentSupplementTranscriptForTest,
  handleSaveVoiceTranscriptionApiKeyForTest,
  handleSetVoiceTranscriptionEnabledForTest,
  handleValidateVoiceTranscriptionCredentialsForTest,
  sendRecordingTranscriptionEventForTest,
  handleUpdateMemorySpaceTitleForTest,
  handleUpdateMemoryTitleForTest,
  handleUpdateSegmentSupplementTitleForTest,
  handleUpdateSegmentTitleForTest,
} from '../../src/main/workspaceIpc.js';
import { createVoiceSettingsStore } from '../../src/main/voiceSettingsStore.js';
import {
  appendRecordingAudioChunk,
  appendSegmentSupplementRecordingAudioChunk,
} from '../../src/main/recordingDrafts.js';
import { createWorkspaceHandleStore } from '../../src/main/workspaceHandles.js';
import { acquireWorkspaceLock } from '../../src/main/workspaceLock.js';
import {
  initializeWorkspaceFiles,
  setBeforeWorkspaceIndexReconciliationPersistForTest,
} from '../../src/main/workspaceFiles.js';
import {
  parseWorkspaceMarkdownObject,
  renderWorkspaceMarkdownObject,
} from '../../src/main/workspaceMarkdownObjects.js';
import {
  createMicrophoneIntent,
  decideMediaPermissionRequest,
  resetMicrophoneIntentsForTest,
} from '../../src/main/security.js';
import { setAfterWorkspaceReoDirectoryCheckForTest } from '../../src/main/workspacePaths.js';
import { findSegmentDirectoryById } from '../../src/main/memoryFiles.js';
import { createWorkspaceSelectionTokenStore } from '../../src/main/workspaceSelectionTokens.js';
import { createWorkspaceMemorySpaceRegistry } from '../../src/main/workspaceMemorySpaceRegistry.js';
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
const microphoneEvent = {
  ...event,
  sender: { ...event.sender, id: 101 },
};
type MemorySpaceResolverDepsForTest = {
  readonly requireAgentsFile?: boolean;
};
type MemoryResolverDepsForTest = {
  readonly requireDocument?: boolean;
};
type SegmentResolverDepsForTest = {
  readonly requireDocument?: boolean;
};
type SegmentSupplementResolverDepsForTest = {
  readonly requireDocument?: boolean;
};

function makeFakeVoiceSafeStorage() {
  let available = true;
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
    getSelectedStorageBackend: () => 'gnome_libsecret' as const,
    setAvailable(value: boolean) {
      available = value;
    },
  };
}

function makeVoiceSettingsStoreForIpcTest() {
  const files = new Map<string, unknown>();
  const safeStorage = makeFakeVoiceSafeStorage();
  const store = createVoiceSettingsStore({
    safeStorage,
    userDataDir: path.join(os.tmpdir(), `reo-voice-ipc-${randomUUIDForTest()}`),
    platform: 'linux',
    now: () => new Date('2026-05-16T13:08:00.000Z'),
    writeJsonAtomic: async (filePath, value) => {
      files.set(filePath, value);
    },
  });
  return { files, safeStorage, store };
}

function randomUUIDForTest() {
  return Math.random().toString(16).slice(2);
}

function voiceIpcBaseOptions(input: unknown = undefined, customEvent = event) {
  return {
    event: customEvent,
    expectedSession,
    expectedSessionKey: 'default',
    input,
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
  };
}

test('recording transcription events keep the Electron sender binding', () => {
  const sent: unknown[] = [];
  const senderWithSend = {
    send(channel: string, payload: unknown) {
      assert.equal(this, senderWithSend);
      sent.push({ channel, payload });
    },
    session: expectedSession,
  };

  sendRecordingTranscriptionEventForTest(
    { ...event, sender: senderWithSend },
    {
      kind: 'error',
      message: '实时转写暂时不可用。',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
    }
  );

  assert.deepEqual(sent, [
    {
      channel: 'workspace:recordingTranscriptionEvent',
      payload: {
        kind: 'error',
        message: '实时转写暂时不可用。',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
      },
    },
  ]);
});

test('voice settings IPC read returns snapshot without key or ciphertext', async () => {
  const { store } = makeVoiceSettingsStoreForIpcTest();
  await store.setEnabled(true);
  await store.writeApiKey('abcd1234SECRET');

  const response = await handleReadVoiceTranscriptionSettingsForTest({
    ...voiceIpcBaseOptions(),
    store,
  });

  assert.equal(response.ok, true);
  if (response.ok) {
    assert.deepEqual(response.value.settings, {
      enabled: true,
      apiKeyConfigured: true,
      apiKeyLastFour: 'CRET',
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });
  }
  assert.equal(JSON.stringify(response).includes('abcd1234SECRET'), false);
  assert.equal(JSON.stringify(response).includes('enc:'), false);
});

test('voice settings IPC read rejects an untrusted sender before returning settings', async () => {
  const { store } = makeVoiceSettingsStoreForIpcTest();
  const untrustedEvent: TrustedSenderEventAdapter = {
    ...event,
    senderFrame: {
      routingId: 4,
      topRoutingId: 4,
      url: 'https://volcengine.com/settings',
    },
  };

  const response = await handleReadVoiceTranscriptionSettingsForTest({
    ...voiceIpcBaseOptions(undefined, untrustedEvent),
    store,
  });

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
});

test('voice settings IPC write channels reject untrusted senders before side effects', async () => {
  const { store } = makeVoiceSettingsStoreForIpcTest();
  const untrustedEvent: TrustedSenderEventAdapter = {
    ...event,
    senderFrame: {
      routingId: 4,
      topRoutingId: 4,
      url: 'https://volcengine.com/settings',
    },
  };
  let probeCalls = 0;
  let openedUrls = 0;

  const cases = [
    () =>
      handleSetVoiceTranscriptionEnabledForTest({
        ...voiceIpcBaseOptions({ enabled: true }, untrustedEvent),
        store,
      }),
    () =>
      handleSaveVoiceTranscriptionApiKeyForTest({
        ...voiceIpcBaseOptions({ apiKey: 'abcd1234SECRET' }, untrustedEvent),
        store,
        probe: async () => {
          probeCalls += 1;
          return { ok: true as const, code: 'ok' as const };
        },
      }),
    () =>
      handleClearVoiceTranscriptionApiKeyForTest({
        ...voiceIpcBaseOptions(undefined, untrustedEvent),
        store,
      }),
    () =>
      handleValidateVoiceTranscriptionCredentialsForTest({
        ...voiceIpcBaseOptions(undefined, untrustedEvent),
        store,
        probe: async () => {
          probeCalls += 1;
          return { ok: true as const, code: 'ok' as const };
        },
      }),
    () =>
      handleOpenVoiceTranscriptionProviderConsoleForTest({
        ...voiceIpcBaseOptions({ url: 'https://console.volcengine.com/' }, untrustedEvent),
        openExternal: async () => {
          openedUrls += 1;
        },
      }),
  ];

  for (const run of cases) {
    const response = await run();
    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
    }
  }

  assert.deepEqual(store.read(), {
    enabled: false,
    apiKeyConfigured: false,
    apiKeyLastFour: null,
    lastValidatedAt: null,
    lastValidationOk: null,
    lastValidationCode: null,
  });
  assert.equal(probeCalls, 0);
  assert.equal(openedUrls, 0);
});

test('voice settings IPC setEnabled validates payload and toggles independently from key', async () => {
  const { store } = makeVoiceSettingsStoreForIpcTest();
  await store.writeApiKey('abcd1234SECRET');

  const invalid = await handleSetVoiceTranscriptionEnabledForTest({
    ...voiceIpcBaseOptions({ enabled: 'true' }),
    store,
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');
  }

  const enabled = await handleSetVoiceTranscriptionEnabledForTest({
    ...voiceIpcBaseOptions({ enabled: true }),
    store,
  });
  assert.equal(enabled.ok, true);
  if (enabled.ok) {
    assert.equal(enabled.value.settings.enabled, true);
    assert.equal(enabled.value.settings.apiKeyConfigured, true);
  }
  assert.equal(JSON.stringify(enabled).includes('abcd1234SECRET'), false);
});

test('voice settings IPC saveApiKey writes before probe and records ok auth network branches', async () => {
  for (const code of ['ok', 'auth', 'network'] as const) {
    const { store } = makeVoiceSettingsStoreForIpcTest();
    const apiKey = `KEY-${code}-SECRET`;
    let probeSawPersistedKey = false;

    const response = await handleSaveVoiceTranscriptionApiKeyForTest({
      ...voiceIpcBaseOptions({ apiKey }),
      store,
      probe: async (key: string) => {
        assert.equal(key, apiKey);
        probeSawPersistedKey = store.readDecryptedApiKey() === apiKey;
        return code === 'ok'
          ? { ok: true, code }
          : { ok: false, code, message: `${code} validation failed for ${apiKey}` };
      },
    });

    assert.equal(probeSawPersistedKey, true);
    assert.equal(response.ok, true);
    if (response.ok) {
      assert.equal(response.value.settings.apiKeyConfigured, true);
      assert.equal(response.value.settings.apiKeyLastFour, 'CRET');
      assert.equal(response.value.settings.lastValidationCode, code);
      assert.equal(
        response.value.settings.lastValidationOk,
        code === 'ok' ? true : code === 'auth' ? false : null
      );
      assert.deepEqual(Object.keys(response.value), ['settings']);
    }
    const serialized = JSON.stringify(response);
    assert.equal(serialized.includes(apiKey), false);
    assert.equal(serialized.includes('enc:'), false);
  }
});

test('voice settings IPC saveApiKey probes the same trimmed key that it persists', async () => {
  const { store } = makeVoiceSettingsStoreForIpcTest();
  const response = await handleSaveVoiceTranscriptionApiKeyForTest({
    ...voiceIpcBaseOptions({ apiKey: '  abcd1234SECRET  ' }),
    store,
    probe: async (key: string) => {
      assert.equal(key, 'abcd1234SECRET');
      return { ok: true as const, code: 'ok' as const };
    },
  });

  assert.equal(response.ok, true);
  assert.equal(store.readDecryptedApiKey(), 'abcd1234SECRET');
});

test('voice settings IPC saveApiKey ignores stale probe results after key changes', async () => {
  const { store } = makeVoiceSettingsStoreForIpcTest();
  const response = await handleSaveVoiceTranscriptionApiKeyForTest({
    ...voiceIpcBaseOptions({ apiKey: 'first1234SECRET' }),
    store,
    probe: async () => {
      await store.writeApiKey('second5678SECRET');
      return { ok: true as const, code: 'ok' as const };
    },
  });

  assert.equal(response.ok, true);
  assert.equal(store.readDecryptedApiKey(), 'second5678SECRET');
  assert.equal(store.read().apiKeyLastFour, 'CRET');
  assert.equal(store.read().lastValidationCode, null);
});

test('voice settings IPC saveApiKey reports validation persistence failures without leaking key', async () => {
  const { store } = makeVoiceSettingsStoreForIpcTest();
  const apiKey = 'abcd1234SECRET';
  const response = await handleSaveVoiceTranscriptionApiKeyForTest({
    ...voiceIpcBaseOptions({ apiKey }),
    store: {
      ...store,
      recordValidation: async () => {
        throw new Error(`write failed for ${apiKey}`);
      },
    },
    probe: async () => ({ ok: true as const, code: 'ok' as const }),
  });

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, 'ERR_VOICE_SETTINGS_WRITE_FAILED');
    assert.equal(response.error.dataRetention, 'file-written-index-stale');
  }
  assert.equal(store.read().apiKeyConfigured, true);
  assert.equal(store.read().apiKeyLastFour, 'CRET');
  assert.equal(JSON.stringify(response).includes(apiKey), false);
});

test('voice settings IPC saveApiKey maps storage failures without leaking key', async () => {
  const { safeStorage, store } = makeVoiceSettingsStoreForIpcTest();
  safeStorage.setAvailable(false);
  const apiKey = 'SECRET-STORAGE-KEY';

  const response = await handleSaveVoiceTranscriptionApiKeyForTest({
    ...voiceIpcBaseOptions({ apiKey }),
    store,
    probe: async () => {
      throw new Error('probe must not run when storage fails');
    },
  });

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, 'ERR_VOICE_SETTINGS_STORAGE_UNAVAILABLE');
  }
  assert.equal(JSON.stringify(response).includes(apiKey), false);
});

test('voice settings IPC clearApiKey wipes key and validation state', async () => {
  const { store } = makeVoiceSettingsStoreForIpcTest();
  await store.writeApiKey('abcd1234SECRET');
  await store.recordValidation({ apiKey: 'abcd1234SECRET', code: 'auth' });

  const response = await handleClearVoiceTranscriptionApiKeyForTest({
    ...voiceIpcBaseOptions(),
    store,
  });

  assert.equal(response.ok, true);
  if (response.ok) {
    assert.deepEqual(response.value.settings, {
      enabled: false,
      apiKeyConfigured: false,
      apiKeyLastFour: null,
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });
  }
});

test('voice settings IPC validate reads decrypted key only in main and handles missing key', async () => {
  const { store } = makeVoiceSettingsStoreForIpcTest();
  const missing = await handleValidateVoiceTranscriptionCredentialsForTest({
    ...voiceIpcBaseOptions(),
    store,
    probe: async () => {
      throw new Error('probe must not run without a key');
    },
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.error.code, 'ERR_VOICE_TRANSCRIPTION_PROBE_FAILED');
  }

  await store.writeApiKey('abcd1234SECRET');
  const response = await handleValidateVoiceTranscriptionCredentialsForTest({
    ...voiceIpcBaseOptions(),
    store,
    probe: async (apiKey: string) => {
      assert.equal(apiKey, 'abcd1234SECRET');
      return { ok: false, code: 'network', message: 'network failure for abcd1234SECRET' };
    },
  });

  assert.equal(response.ok, true);
  if (response.ok) {
    assert.equal(response.value.code, 'network');
  }
  assert.equal(store.read().lastValidationOk, null);
  assert.equal(store.read().lastValidationCode, 'network');
  assert.equal(JSON.stringify(response).includes('abcd1234SECRET'), false);
});

test('voice settings IPC validate rejects stale probe results after key changes', async () => {
  const { store } = makeVoiceSettingsStoreForIpcTest();
  await store.writeApiKey('first1234SECRET');

  const response = await handleValidateVoiceTranscriptionCredentialsForTest({
    ...voiceIpcBaseOptions(),
    store,
    probe: async () => {
      await store.writeApiKey('second5678SECRET');
      return { ok: true as const, code: 'ok' as const };
    },
  });

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, 'ERR_VOICE_TRANSCRIPTION_PROBE_FAILED');
  }
  assert.equal(store.readDecryptedApiKey(), 'second5678SECRET');
  assert.equal(store.read().lastValidationCode, null);
});

test('voice settings IPC validate reports validation persistence failures without leaking key', async () => {
  const { store } = makeVoiceSettingsStoreForIpcTest();
  await store.writeApiKey('abcd1234SECRET');

  const response = await handleValidateVoiceTranscriptionCredentialsForTest({
    ...voiceIpcBaseOptions(),
    store: {
      ...store,
      recordValidation: async () => {
        throw new Error('write failed for abcd1234SECRET');
      },
    },
    probe: async () => ({ ok: true as const, code: 'ok' as const }),
  });

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, 'ERR_VOICE_SETTINGS_WRITE_FAILED');
  }
  assert.equal(JSON.stringify(response).includes('abcd1234SECRET'), false);
});

test('voice settings IPC openVoiceTranscriptionProviderConsole opens the main-owned console URL', async () => {
  const opened: string[] = [];
  const allowed = await handleOpenVoiceTranscriptionProviderConsoleForTest({
    ...voiceIpcBaseOptions(undefined),
    openExternal: async (url: string) => {
      opened.push(url);
    },
  });

  assert.deepEqual(allowed, { ok: true, value: {} });
  assert.deepEqual(opened, ['https://console.volcengine.com/']);
});

test('voice settings IPC openVoiceTranscriptionProviderConsole validates request payload', async () => {
  const response = await handleOpenVoiceTranscriptionProviderConsoleForTest({
    ...voiceIpcBaseOptions({ url: 'https://console.volcengine.com/' }),
    openExternal: async () => {
      throw new Error('invalid payload must not open');
    },
  });

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');
  }
});

async function assertWorkspaceLockCanBeReacquired(rootPath: string): Promise<void> {
  const lock = await acquireWorkspaceLock({ canonicalRoot: rootPath });
  assert.equal(lock.ok, true);
  if (lock.ok) {
    await lock.lock.release();
  }
}

async function writeFinalizedMemoryRecording({
  root,
  workspaceId,
  memoryId,
  segmentId,
  title,
}: {
  readonly root: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
}): Promise<void> {
  const memoryDirectory = path.join(root, 'memories', memoryId);
  const recordingDirectory = path.join(memoryDirectory, 'segments', segmentId);
  await mkdir(recordingDirectory, { recursive: true });
  await mkdir(path.join(root, '.reo', 'objects', 'memories'), { recursive: true });
  await mkdir(path.join(root, '.reo', 'objects', 'segments'), { recursive: true });
  await writeFile(
    path.join(memoryDirectory, 'memory.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'memory',
      data: { title },
      content: `# ${title}\n`,
    })
  );
  await writeFile(
    path.join(root, '.reo', 'objects', 'memories', `${memoryId}.json`),
    `${JSON.stringify({
      schemaVersion: 1,
      objectType: 'memory',
      memoryId,
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
    })}\n`
  );
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1, 2, 3]));
  await writeFile(
    path.join(recordingDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title, kind: 'audio' },
      content: `# ${title}\n\n## Transcript\n\n`,
    })
  );
  await writeFile(
    path.join(root, '.reo', 'objects', 'segments', `${segmentId}.json`),
    `${JSON.stringify({
      schemaVersion: 1,
      objectType: 'segment',
      workspaceId,
      memoryId,
      segmentId,
      kind: 'audio',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 3,
    })}\n`
  );
}

async function readObjectManifest(
  rootPath: string,
  kind: 'segments' | 'supplements',
  objectId: string
): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(path.join(rootPath, '.reo', 'objects', kind, `${objectId}.json`), 'utf8')
  ) as Record<string, unknown>;
}

async function writeFinalizedSegmentSupplement({
  root,
  workspaceId,
  memoryId,
  segmentId,
  supplementId,
  title,
  directoryTitle = title,
}: {
  readonly root: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly title: string;
  readonly directoryTitle?: string;
}): Promise<string> {
  const segmentDirectory = await findSegmentDirectoryById(root, segmentId);
  const supplementDirectory = path.join(
    segmentDirectory,
    'supplements',
    `${supplementId}--${directoryTitle}`
  );
  await mkdir(supplementDirectory, { recursive: true });
  await writeFinalizedSupplementFiles({
    root,
    directory: supplementDirectory,
    workspaceId,
    memoryId,
    segmentId,
    supplementId,
    title,
    content: '补充转录',
  });
  return supplementDirectory;
}

async function writeFinalizedSupplementFiles({
  root,
  directory,
  workspaceId,
  memoryId,
  segmentId,
  supplementId,
  title,
  content = '',
  audioBytes = [4, 5],
}: {
  readonly root: string;
  readonly directory: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly title: string;
  readonly content?: string;
  readonly audioBytes?: readonly number[];
}): Promise<void> {
  await writeFile(path.join(directory, 'audio.webm'), new Uint8Array(audioBytes));
  await writeFile(
    path.join(directory, 'supplement.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'supplement',
      data: { title, kind: 'audio' },
      content,
    })
  );
  await mkdir(path.join(root, '.reo', 'objects', 'supplements'), { recursive: true });
  await writeFile(
    path.join(root, '.reo', 'objects', 'supplements', `${supplementId}.json`),
    `${JSON.stringify({
      schemaVersion: 1,
      objectType: 'supplement',
      workspaceId,
      memoryId,
      segmentId,
      supplementId,
      kind: 'audio',
      createdAt: '2026-05-06T13:10:00.000Z',
      finalizedAt: '2026-05-06T13:11:00.000Z',
      updatedAt: '2026-05-06T13:11:00.000Z',
      durationMs: 500,
      nextSequence: 1,
      audioByteLength: audioBytes.length,
    })}\n`
  );
}

async function readSupplementTitle(directory: string): Promise<string> {
  const parsed = parseWorkspaceMarkdownObject({
    objectType: 'supplement',
    markdown: await readFile(path.join(directory, 'supplement.md'), 'utf8'),
  });
  return (parsed.data as { readonly title: string }).title;
}

async function readSupplementContent(directory: string): Promise<string> {
  return parseWorkspaceMarkdownObject({
    objectType: 'supplement',
    markdown: await readFile(path.join(directory, 'supplement.md'), 'utf8'),
  }).content;
}

function createRegisteredHandleStore(
  rootPath: string,
  isUsable: () => boolean = () => true,
  release: () => Promise<void> = async () => {}
) {
  const handleStore = createWorkspaceHandleStore({ createHandle: () => 'wh_ipc' });
  handleStore.register({
    canonicalRoot: rootPath,
    workspaceId: 'ws_ipc',
    sender,
    lock: {
      isHeld: () => true,
      isUsable,
      relocate: () => ({ ok: true }),
      release,
    },
  });
  return handleStore;
}

function isBackfillCall(value: unknown): value is {
  readonly assertWorkspaceUsable: unknown;
  readonly memoryId: string;
  readonly mode: 'fill-missing' | 'regenerate';
  readonly rootPath: string;
  readonly segmentId: string;
  readonly supplementId?: string;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['memoryId'] === 'string' &&
    (candidate['mode'] === 'fill-missing' || candidate['mode'] === 'regenerate') &&
    typeof candidate['rootPath'] === 'string' &&
    typeof candidate['segmentId'] === 'string' &&
    typeof candidate['workspaceHandle'] === 'string' &&
    typeof candidate['workspaceId'] === 'string'
  );
}

test('initializeWorkspace consumes selection token and never exposes rootPath', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-1',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-1',
      title: 'IPC 初始化',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_ipc',
    createHandle: () => 'wh_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      snapshot: {
        workspaceId: 'ws_ipc',
        title: 'IPC 初始化',
        description: '',
        memories: [],
      },
    });
    assert.equal('rootPath' in result.value, false);
  }

  const replay = await handleInitializeWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-1',
      title: '重放',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_replay',
    createHandle: () => 'wh_replay',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(replay.ok, false);
  if (!replay.ok) {
    assert.equal('rootPath' in replay.error, false);
  }
});

test('initializeWorkspace creates a named workspace directory under the selected parent', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-parent-'));
  const workspaceRoot = path.join(parentPath, '你好');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-named-child',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({
    rootPath: parentPath,
    displayPath: path.basename(parentPath),
    sender,
  });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-named-child',
      title: '你好',
      description: 'named child workspace',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_named_child',
    createHandle: () => 'wh_named_child',
    now: () => '2026-05-08T13:08:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.deepEqual((await readdir(parentPath)).sort(), ['你好']);
  assert.equal(
    await readFile(path.join(workspaceRoot, 'AGENTS.md'), 'utf8'),
    '# Reo workspace\n\n本文件是 Reo workspace 的 AI 协作入口。\n'
  );
  await assert.rejects(stat(path.join(parentPath, '.reo')));
  await assert.rejects(stat(path.join(parentPath, 'AGENTS.md')));
});

test('initializeWorkspace rejects an existing same-name workspace directory', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-existing-parent-'));
  const workspaceRoot = path.join(parentPath, '你好');
  await mkdir(workspaceRoot);
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-existing-child',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({
    rootPath: parentPath,
    displayPath: path.basename(parentPath),
    sender,
  });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-existing-child',
      title: '你好',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_existing_child',
    createHandle: () => 'wh_existing_child',
    now: () => '2026-05-08T13:08:00.000Z',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_ALREADY_EXISTS');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  assert.deepEqual(await readdir(parentPath), ['你好']);
  await assert.rejects(stat(path.join(workspaceRoot, '.reo')));
  await assert.rejects(stat(path.join(parentPath, '.reo')));
});

test('chooseDirectory response does not expose rootPath or equivalent absolute displayPath', async () => {
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-display',
    now: () => 1_000,
    ttlMs: 5_000,
  });

  const result = await handleChooseWorkspaceDirectory({
    event,
    input: undefined,
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    showOpenDirectoryDialog: async () => ({
      canceled: false,
      filePaths: ['/Users/example/Voice Notes'],
    }),
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      status: 'selected',
      selectionToken: 'selection-token-display',
      displayPath: 'Voice Notes',
    },
  });
});

test('beginMicrophoneIntent uses sender id from the IPC event and returns no raw path', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-mic-'));
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, { registered: true });
    assert.equal('rootPath' in result.value, false);
    assert.equal('microphoneIntentId' in result.value, false);
  }
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    true
  );
});

test('clearMicrophoneIntent requires the matching workspace handle owner', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-clear-mic-'));
  const handleStore = createRegisteredHandleStore(rootPath);

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  const result = await handleClearMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.deepEqual(result, { ok: true, value: { cleared: true } });
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('clearMicrophoneIntent clears pending intent after workspace lock is lost', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-clear-mic-lock-lost-'));
  let usable = true;
  const handleStore = createRegisteredHandleStore(rootPath, () => usable);

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  usable = false;
  const result = await handleClearMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.deepEqual(result, { ok: true, value: { cleared: true } });
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('closeWorkspace clears pending microphone intent for the closed workspace handle', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-close-mic-'));
  const handleStore = createRegisteredHandleStore(rootPath);

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  const closed = await handleCloseWorkspaceForTest({
    event,
    input: { workspaceHandle: 'wh_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.deepEqual(closed, { ok: true, value: { closed: true } });
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('closeWorkspace closes the injected recording transcription registry for the workspace handle', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-close-asr-'));
  const handleStore = createRegisteredHandleStore(rootPath);
  const closedHandles: string[] = [];
  const recordingTranscriptionSessions = {
    closeForWorkspaceHandle: (workspaceHandle: string) => {
      closedHandles.push(workspaceHandle);
    },
  };

  const closed = await handleCloseWorkspaceForTest({
    event,
    input: { workspaceHandle: 'wh_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    recordingTranscriptionSessions: recordingTranscriptionSessions as never,
  });

  assert.deepEqual(closed, { ok: true, value: { closed: true } });
  assert.deepEqual(closedHandles, ['wh_ipc']);
});

test('closeWorkspace skips global backfill cancellation when the closed handle is not the ready backfill workspace', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-close-backfill-scope-'));
  const handleStore = createRegisteredHandleStore(rootPath);
  const canceledReasons: string[] = [];

  const closed = await handleCloseWorkspaceForTest({
    event,
    input: { workspaceHandle: 'wh_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    backfillRuntime: {
      cancelAll: () => {},
      cancelAllAndDrain: async (reason: string) => {
        canceledReasons.push(reason);
      },
      enqueueAutomaticTargets: async () => ({ accepted: 0, capped: 0, duplicates: 0 }),
      enqueueAutomaticWorkspace: async () => ({ accepted: 0, capped: 0, duplicates: 0 }),
      pause: () => {},
      requestSegmentBackfill: async () =>
        ({ error: { code: 'ERR_BACKFILL_UNAVAILABLE', message: 'unused' }, ok: false }) as never,
      requestSupplementBackfill: async () =>
        ({ error: { code: 'ERR_BACKFILL_UNAVAILABLE', message: 'unused' }, ok: false }) as never,
      resume: () => {},
    },
    handleStore,
    onBeforeBackfillCancel: (workspaceHandle) => {
      assert.equal(workspaceHandle, 'wh_ipc');
      return false;
    },
  });

  assert.deepEqual(closed, { ok: true, value: { closed: true } });
  assert.deepEqual(canceledReasons, []);
});

test('request segment backfill IPC forwards mode through validated handle ownership', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-backfill-mode-'));
  const handleStore = createRegisteredHandleStore(rootPath);
  const calls: unknown[] = [];

  const response = await handleRequestSegmentTranscriptionBackfillForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      mode: 'regenerate',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    backfillRuntime: {
      cancelAll: () => {},
      cancelAllAndDrain: async () => {},
      enqueueAutomaticTargets: async () => ({ accepted: 0, capped: 0, duplicates: 0 }),
      enqueueAutomaticWorkspace: async () => ({ accepted: 0, capped: 0, duplicates: 0 }),
      pause: () => {},
      requestSegmentBackfill: async (input: unknown) => {
        calls.push(input);
        return {
          ok: true as const,
          value: {
            memory: {
              audioByteLength: 1,
              createdAt: '2026-05-17T01:00:00.000Z',
              durationMs: 1000,
              hasTranscript: true,
              memoryId: 'mem_1',
              segmentCount: 1,
              supplementCount: 0,
              title: 'Memory',
              updatedAt: '2026-05-17T01:00:00.000Z',
            },
            saved: true as const,
          },
        };
      },
      requestSupplementBackfill: async () =>
        ({ error: { code: 'ERR_BACKFILL_UNAVAILABLE', message: 'unused' }, ok: false }) as never,
      resume: () => {},
    },
    voiceSettingsStore: makeVoiceSettingsStoreForIpcTest().store,
  });

  assert.equal(response.ok, true);
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(isBackfillCall(call), true);
  if (isBackfillCall(call)) {
    assert.equal(typeof call.assertWorkspaceUsable, 'function');
    assert.equal(call.memoryId, 'mem_1');
    assert.equal(call.mode, 'regenerate');
    assert.equal(call.rootPath, rootPath);
    assert.equal(call.segmentId, 'seg_1');
    assert.equal(call.workspaceHandle, 'wh_ipc');
    assert.equal(call.workspaceId, 'ws_ipc');
  }
});

test('request supplement backfill IPC forwards mode and rejects missing mode as invalid request', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-supplement-backfill-mode-'));
  const handleStore = createRegisteredHandleStore(rootPath);
  const calls: unknown[] = [];
  const voiceSettingsStore = makeVoiceSettingsStoreForIpcTest().store;
  const backfillRuntime = {
    cancelAll: () => {},
    cancelAllAndDrain: async () => {},
    enqueueAutomaticTargets: async () => ({ accepted: 0, capped: 0, duplicates: 0 }),
    enqueueAutomaticWorkspace: async () => ({ accepted: 0, capped: 0, duplicates: 0 }),
    pause: () => {},
    requestSegmentBackfill: async () =>
      ({ error: { code: 'ERR_BACKFILL_UNAVAILABLE', message: 'unused' }, ok: false }) as never,
    requestSupplementBackfill: async (input: unknown) => {
      calls.push(input);
      return {
        ok: true as const,
        value: {
          memory: {
            audioByteLength: 1,
            createdAt: '2026-05-17T01:00:00.000Z',
            durationMs: 1000,
            hasTranscript: true,
            memoryId: 'mem_1',
            segmentCount: 1,
            supplementCount: 1,
            title: 'Memory',
            updatedAt: '2026-05-17T01:00:00.000Z',
          },
          saved: true as const,
          segment: {
            audioByteLength: 10,
            createdAt: '2026-05-17T01:00:00.000Z',
            durationMs: 1000,
            lastTranscriptionAttempt: 'failed' as const,
            memoryId: 'mem_1',
            segmentId: 'seg_1',
            supplementCount: 1,
            supplements: [],
            title: 'Segment',
            transcript: { exists: false as const },
            type: 'audio' as const,
            updatedAt: '2026-05-17T01:02:00.000Z',
            workspaceId: 'ws_ipc',
          },
          supplement: {
            audioByteLength: 10,
            createdAt: '2026-05-17T01:01:00.000Z',
            durationMs: 1000,
            lastTranscriptionAttempt: 'success' as const,
            memoryId: 'mem_1',
            segmentId: 'seg_1',
            supplementId: 'sup_1',
            title: 'Supplement',
            transcript: { exists: true as const },
            type: 'audio' as const,
            updatedAt: '2026-05-17T01:03:00.000Z',
            workspaceId: 'ws_ipc',
          },
        },
      };
    },
    resume: () => {},
  };

  const invalid = await handleRequestSegmentSupplementTranscriptionBackfillForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    backfillRuntime,
    voiceSettingsStore,
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');

  const response = await handleRequestSegmentSupplementTranscriptionBackfillForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      mode: 'regenerate',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    backfillRuntime,
    voiceSettingsStore,
  });

  assert.equal(response.ok, true);
  const call = calls[0];
  assert.equal(isBackfillCall(call), true);
  if (isBackfillCall(call)) {
    assert.equal(call.mode, 'regenerate');
    assert.equal(call.supplementId, 'sup_1');
  }
});

test('closeRecordingTranscription clears an active ASR session after workspace lock is lost', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-close-asr-lock-lost-'));
  const handleStore = createRegisteredHandleStore(rootPath, () => false);
  const closedRequests: unknown[] = [];
  const recordingTranscriptionSessions = {
    close: (request: unknown) => {
      closedRequests.push(request);
      return { ok: true as const, value: { accepted: true as const } };
    },
  };

  const closed = await handleCloseRecordingTranscriptionForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'flow_1',
      recordingSessionId: 'recording_1',
      revisionId: 'revision_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    recordingTranscriptionSessions: recordingTranscriptionSessions as never,
  });

  assert.deepEqual(closed, { ok: true, value: { accepted: true } });
  assert.deepEqual(closedRequests, [
    {
      recordingFlowSessionId: 'flow_1',
      recordingSessionId: 'recording_1',
      revisionId: 'revision_1',
      senderKey: 'default:7:4:reo-app://renderer',
      workspaceHandle: 'wh_ipc',
    },
  ]);
});

test('finishRecordingTranscription closes an active ASR session when workspace lock is lost', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-finish-asr-lock-lost-'));
  const handleStore = createRegisteredHandleStore(rootPath, () => false);
  const closedRequests: unknown[] = [];
  const recordingTranscriptionSessions = {
    close: (request: unknown) => {
      closedRequests.push(request);
      return { ok: true as const, value: { accepted: true as const } };
    },
    finish: async () => {
      throw new Error('finish should not run after lock lost');
    },
  };

  const finished = await handleFinishRecordingTranscriptionForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'flow_1',
      recordingSessionId: 'recording_1',
      revisionId: 'revision_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    recordingTranscriptionSessions: recordingTranscriptionSessions as never,
  });

  assert.equal(finished.ok, false);
  if (!finished.ok) {
    assert.equal(finished.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  assert.deepEqual(closedRequests, [
    {
      recordingFlowSessionId: 'flow_1',
      recordingSessionId: 'recording_1',
      revisionId: 'revision_1',
      senderKey: 'default:7:4:reo-app://renderer',
      workspaceHandle: 'wh_ipc',
    },
  ]);
});

test('closeWorkspace clears pending microphone intent after workspace lock is lost', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-close-mic-lock-lost-'));
  let usable = true;
  const handleStore = createRegisteredHandleStore(rootPath, () => usable);

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  usable = false;
  const closed = await handleCloseWorkspaceForTest({
    event,
    input: { workspaceHandle: 'wh_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.deepEqual(closed, { ok: true, value: { closed: true } });
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('closeWorkspace clears pending microphone intent when lock release fails', async () => {
  resetMicrophoneIntentsForTest();
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-close-mic-release-fails-'));
  const handleStore = createRegisteredHandleStore(
    rootPath,
    () => true,
    async () => {
      throw new Error('release failed');
    }
  );

  await handleBeginMicrophoneIntentForTest({
    event: microphoneEvent,
    input: {
      workspaceHandle: 'wh_ipc',
      recordingFlowSessionId: 'recording_flow_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => 1_000,
  });

  const closed = await handleCloseWorkspaceForTest({
    event,
    input: { workspaceHandle: 'wh_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(closed.ok, false);
  if (!closed.ok) {
    assert.equal(closed.error.code, 'ERR_WORKSPACE_LOCK_FAILED');
  }
  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('window teardown clears all pending microphone intents through workspace cleanup', async () => {
  resetMicrophoneIntentsForTest();
  createMicrophoneIntent({
    senderId: 101,
    workspaceHandle: 'wh_teardown',
    recordingFlowSessionId: 'recording_flow_1',
  });

  await closeAllWorkspaceHandles();

  assert.equal(
    decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 101,
      isMainFrame: true,
      requested: { audio: true, video: false },
      now: () => 1_001,
    }),
    false
  );
});

test('createMemory creates an empty Memory container through file truth', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memory-create-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleCreateMemoryForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      title: '产品灵感与思考',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    createMemoryId: () => 'mem_ipc_created',
    now: () => '2026-05-08T14:42:00.000Z',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      memoryId: 'mem_ipc_created',
      title: '产品灵感与思考',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentCount: 0,
      durationMs: 0,
      audioByteLength: 0,
      hasTranscript: false,
      supplementCount: 0,
    });
  }
  assert.deepEqual(
    parseWorkspaceMarkdownObject({
      objectType: 'memory',
      markdown: await readFile(
        path.join(rootPath, 'memories', 'mem_ipc_created--产品灵感与思考', 'memory.md'),
        'utf8'
      ),
    }).data,
    {
      title: '产品灵感与思考',
    }
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(
        path.join(rootPath, '.reo', 'objects', 'memories', 'mem_ipc_created.json'),
        'utf8'
      )
    ),
    {
      schemaVersion: 1,
      objectType: 'memory',
      memoryId: 'mem_ipc_created',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
    }
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8')).memories,
    [
      {
        memoryId: 'mem_ipc_created',
        title: '产品灵感与思考',
        createdAt: '2026-05-08T14:42:00.000Z',
        updatedAt: '2026-05-08T14:42:00.000Z',
        segmentCount: 0,
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        supplementCount: 0,
      },
    ]
  );
});

test('deleteMemory hides a Memory from the read model and restoreDeletedMemory restores it', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-delete-memory-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 删除',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_delete_me',
    segmentId: 'seg_delete_me',
    title: 'Delete me',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_keep_me',
    segmentId: 'seg_keep_me',
    title: 'Keep me',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const deleted = await handleDeleteMemoryForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      memoryId: 'mem_delete_me',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(deleted.ok, true);
  if (deleted.ok) {
    assert.equal(deleted.value.memoryId, 'mem_delete_me');
    assert.equal(deleted.value.restoreToken, 'mem_delete_me');
    assert.deepEqual(
      deleted.value.memories.map((memory: { readonly memoryId: string }) => memory.memoryId),
      ['mem_keep_me']
    );
    assert.equal('rootPath' in deleted.value, false);
  }

  const readDeleted = await handleReadMemoryDetailForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_delete_me',
      requestId: 'request_deleted',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });
  assert.equal(readDeleted.ok, false);

  const restored = await handleRestoreDeletedMemoryForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      restoreToken: 'mem_delete_me',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(restored.ok, true);
  if (restored.ok) {
    assert.equal(restored.value.memory.memoryId, 'mem_delete_me');
    assert.deepEqual(
      restored.value.memories
        .map((memory: { readonly memoryId: string }) => memory.memoryId)
        .sort(),
      ['mem_delete_me', 'mem_keep_me']
    );
    assert.equal('rootPath' in restored.value, false);
  }

  const readRestored = await handleReadMemoryDetailForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_delete_me',
      requestId: 'request_restored',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });
  assert.equal(readRestored.ok, true);
});

test('deleteSegment hides a Segment from its Memory and restoreDeletedSegment restores it', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-delete-segment-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 删除片段',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_segment_delete',
    segmentId: 'seg_segment_delete',
    title: 'Segment delete',
  });
  const handleStore = createRegisteredHandleStore(rootPath);
  const memoryDirectory = path.join(rootPath, 'memories', 'mem_segment_delete');
  const segmentDirectory = path.join(memoryDirectory, 'segments', 'seg_segment_delete');

  const deleted = await handleDeleteSegmentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_segment_delete',
      segmentId: 'seg_segment_delete',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(deleted.ok, true);
  if (deleted.ok) {
    assert.equal(deleted.value.segmentId, 'seg_segment_delete');
    assert.equal(deleted.value.restoreToken, 'seg_segment_delete');
    assert.equal(deleted.value.memory.memoryId, 'mem_segment_delete');
    assert.equal(deleted.value.memory.segmentCount, 0);
    assert.equal('rootPath' in deleted.value, false);
  }
  await assert.rejects(stat(segmentDirectory));
  assert.equal(
    parseWorkspaceMarkdownObject({
      objectType: 'memory',
      markdown: await readFile(path.join(memoryDirectory, 'memory.md'), 'utf8'),
    }).data.title,
    'Segment delete'
  );
  await readFile(
    path.join(rootPath, '.reo', 'objects', 'memories', 'mem_segment_delete.json'),
    'utf8'
  );

  const detailAfterDelete = await handleReadMemoryDetailForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_segment_delete',
      requestId: 'request_segment_deleted',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });
  assert.equal(detailAfterDelete.ok, true);
  if (detailAfterDelete.ok) {
    assert.deepEqual(detailAfterDelete.value.detail.segments, []);
  }

  const restored = await handleRestoreDeletedSegmentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_segment_delete',
      restoreToken: 'seg_segment_delete',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(restored.ok, true);
  if (restored.ok) {
    assert.equal(restored.value.memory.memoryId, 'mem_segment_delete');
    assert.equal(restored.value.memory.segmentCount, 1);
    assert.equal(restored.value.segment.segmentId, 'seg_segment_delete');
    assert.equal('rootPath' in restored.value, false);
  }
  await stat(segmentDirectory);
  assert.equal(
    parseWorkspaceMarkdownObject({
      objectType: 'segment',
      markdown: await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'),
    }).data.title,
    'Segment delete'
  );
});

test('deleteSegmentSupplement hides an supplement from its parent Segment and restoreDeletedSegmentSupplement restores it', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-delete-supplement-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 删除补充',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_supplement_delete',
    segmentId: 'seg_supplement_delete',
    title: 'Parent segment',
  });
  const supplementDirectory = await writeFinalizedSegmentSupplement({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_supplement_delete',
    segmentId: 'seg_supplement_delete',
    supplementId: 'sup_supplement_delete',
    title: '现场补充',
  });
  const handleStore = createRegisteredHandleStore(rootPath);
  const trashedSupplementDirectory = path.join(
    rootPath,
    '.reo',
    'trash',
    'supplements',
    'sup_supplement_delete--现场补充'
  );

  const deleted = await handleDeleteSegmentSupplementForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_supplement_delete',
      segmentId: 'seg_supplement_delete',
      supplementId: 'sup_supplement_delete',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(deleted.ok, true);
  if (deleted.ok) {
    assert.equal(deleted.value.supplementId, 'sup_supplement_delete');
    assert.equal(deleted.value.restoreToken, 'sup_supplement_delete');
    assert.equal(deleted.value.memory.supplementCount, 0);
    assert.equal(deleted.value.segment.supplementCount, 0);
    assert.deepEqual(deleted.value.segment.supplements, []);
    assert.equal('rootPath' in deleted.value, false);
    assert.equal('workspaceHandle' in deleted.value, false);
  }
  await assert.rejects(stat(supplementDirectory));
  await stat(path.join(trashedSupplementDirectory, 'audio.webm'));
  assert.equal(await readSupplementTitle(trashedSupplementDirectory), '现场补充');

  const detailAfterDelete = await handleReadMemoryDetailForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_supplement_delete',
      requestId: 'request_supplement_deleted',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });
  assert.equal(detailAfterDelete.ok, true);
  if (detailAfterDelete.ok) {
    assert.equal(detailAfterDelete.value.detail.supplementCount, 0);
    assert.deepEqual(detailAfterDelete.value.detail.segments[0]?.supplements, []);
  }

  const restored = await handleRestoreDeletedSegmentSupplementForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_supplement_delete',
      segmentId: 'seg_supplement_delete',
      restoreToken: 'sup_supplement_delete',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(restored.ok, true);
  if (restored.ok) {
    assert.equal(restored.value.memory.supplementCount, 1);
    assert.equal(restored.value.segment.supplementCount, 1);
    assert.equal(restored.value.supplement.supplementId, 'sup_supplement_delete');
    assert.equal(restored.value.supplement.title, '现场补充');
    assert.equal('rootPath' in restored.value, false);
    assert.equal('workspaceHandle' in restored.value, false);
  }
  await stat(supplementDirectory);
  await assert.rejects(stat(trashedSupplementDirectory));
});

test('restoreDeletedSegmentSupplement returns parent missing and leaves trash recoverable', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-restore-supplement-parent-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充恢复父级缺失',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_supplement_parent_missing',
    segmentId: 'seg_supplement_parent_missing',
    title: 'Parent segment',
  });
  await writeFinalizedSegmentSupplement({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_supplement_parent_missing',
    segmentId: 'seg_supplement_parent_missing',
    supplementId: 'sup_supplement_parent_missing',
    title: '现场补充',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const deleted = await handleDeleteSegmentSupplementForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_supplement_parent_missing',
      segmentId: 'seg_supplement_parent_missing',
      supplementId: 'sup_supplement_parent_missing',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });
  assert.equal(deleted.ok, true);
  await rm(await findSegmentDirectoryById(rootPath, 'seg_supplement_parent_missing'), {
    recursive: true,
    force: true,
  });

  const restored = await handleRestoreDeletedSegmentSupplementForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_supplement_parent_missing',
      segmentId: 'seg_supplement_parent_missing',
      restoreToken: 'sup_supplement_parent_missing',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(restored.ok, false);
  if (!restored.ok) {
    assert.equal(restored.error.code, 'ERR_SEGMENT_SUPPLEMENT_RESTORE_PARENT_MISSING');
    assert.equal(restored.error.dataRetention, 'previous-file-preserved');
  }
  await stat(
    path.join(
      rootPath,
      '.reo',
      'trash',
      'supplements',
      'sup_supplement_parent_missing--现场补充',
      'supplement.md'
    )
  );
});

test('deleteSegmentSupplement rejects workspace mismatches before file writes', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-delete-supplement-mismatch-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充删除不匹配',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_supplement_delete_mismatch',
    segmentId: 'seg_supplement_delete_mismatch',
    title: 'Parent segment',
  });
  const supplementDirectory = await writeFinalizedSegmentSupplement({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_supplement_delete_mismatch',
    segmentId: 'seg_supplement_delete_mismatch',
    supplementId: 'sup_supplement_delete_mismatch',
    title: '现场补充',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleDeleteSegmentSupplementForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_other',
      memoryId: 'mem_supplement_delete_mismatch',
      segmentId: 'seg_supplement_delete_mismatch',
      supplementId: 'sup_supplement_delete_mismatch',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH');
  }
  await stat(supplementDirectory);
  await assert.rejects(stat(path.join(rootPath, '.reo', 'trash', 'supplements')));
});

test('readMemoryDetail returns current Memory segments without exposing handle or root path', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memory-detail-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆详情',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_detail',
    segmentId: 'seg_ipc_detail',
    title: '生日录音',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleReadMemoryDetailForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_detail',
      requestId: 'request_mem_ipc_detail',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.requestId, 'request_mem_ipc_detail');
    assert.equal(result.value.detail.workspaceId, 'ws_ipc');
    assert.equal(result.value.detail.memoryId, 'mem_ipc_detail');
    assert.equal(result.value.detail.title, '生日录音');
    assert.equal(result.value.detail.segmentCount, 1);
    assert.deepEqual(result.value.detail.segments, [
      {
        workspaceId: 'ws_ipc',
        memoryId: 'mem_ipc_detail',
        segmentId: 'seg_ipc_detail',
        type: 'audio',
        title: '生日录音',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:09:00.000Z',
        durationMs: 1000,
        audioByteLength: 3,
        lastTranscriptionAttempt: 'never',
        transcript: { exists: false },
        supplementCount: 0,
        supplements: [],
      },
    ]);
    assert.equal('workspaceHandle' in result.value.detail, false);
    assert.equal('rootPath' in result.value.detail, false);
  }
});

test('readFinalizedAudioSegment returns audio bytes and transcript without exposing file paths', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-finalized-audio-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆播放',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    title: '生日录音',
  });
  await writeFile(
    path.join(rootPath, 'memories', 'mem_ipc_audio', 'segments', 'seg_ipc_audio', 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: '生日录音', kind: 'audio' },
      content: '# 生日录音\n\n## Transcript\n\n大家一起唱生日快乐。',
    })
  );
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleReadFinalizedAudioSegmentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_audio',
      segmentId: 'seg_ipc_audio',
      requestId: 'request_seg_ipc_audio',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.requestId, 'request_seg_ipc_audio');
    assert.equal(result.value.workspaceId, 'ws_ipc');
    assert.equal(result.value.memoryId, 'mem_ipc_audio');
    assert.equal(result.value.segmentId, 'seg_ipc_audio');
    assert.deepEqual(Array.from(result.value.audio), [1, 2, 3]);
    assert.equal(result.value.audioByteLength, 3);
    assert.deepEqual(result.value.transcript, {
      exists: true,
      text: '大家一起唱生日快乐。',
    });
    assert.equal('workspaceHandle' in result.value, false);
    assert.equal('rootPath' in result.value, false);
  }
});

test('readFinalizedAudioSegmentSupplement returns parent-scoped audio bytes and transcript without exposing paths', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-finalized-supplement-audio-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充播放',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    title: '生日录音',
  });
  const supplementDirectory = path.join(
    rootPath,
    'memories',
    'mem_ipc_audio',
    'segments',
    'seg_ipc_audio',
    'supplements',
    'sup_ipc_followup'
  );
  await mkdir(supplementDirectory, { recursive: true });
  await writeFinalizedSupplementFiles({
    root: rootPath,
    directory: supplementDirectory,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    supplementId: 'sup_ipc_followup',
    title: '补充录音',
    content: '# 补充录音\n\n## Transcript\n\n补充录音转写正文',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleReadFinalizedAudioSegmentSupplementForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_audio',
      segmentId: 'seg_ipc_audio',
      supplementId: 'sup_ipc_followup',
      requestId: 'request_sup_ipc_followup',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.requestId, 'request_sup_ipc_followup');
    assert.equal(result.value.workspaceId, 'ws_ipc');
    assert.equal(result.value.memoryId, 'mem_ipc_audio');
    assert.equal(result.value.segmentId, 'seg_ipc_audio');
    assert.equal(result.value.supplementId, 'sup_ipc_followup');
    assert.deepEqual(Array.from(result.value.audio), [4, 5]);
    assert.equal(result.value.audioByteLength, 2);
    assert.deepEqual(result.value.transcript, { exists: true, text: '补充录音转写正文' });
    assert.equal('workspaceHandle' in result.value, false);
    assert.equal('rootPath' in result.value, false);
  }
});

test('readFinalizedAudioSegmentSupplement returns empty transcript when supplement has no transcript section', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-empty-supplement-transcript-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充播放',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    title: '生日录音',
  });
  const supplementDirectory = path.join(
    rootPath,
    'memories',
    'mem_ipc_audio',
    'segments',
    'seg_ipc_audio',
    'supplements',
    'sup_ipc_followup'
  );
  await mkdir(supplementDirectory, { recursive: true });
  await writeFinalizedSupplementFiles({
    root: rootPath,
    directory: supplementDirectory,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    supplementId: 'sup_ipc_followup',
    title: '补充录音',
    content: '# 补充录音\n\n补充录音普通正文',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleReadFinalizedAudioSegmentSupplementForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_audio',
      segmentId: 'seg_ipc_audio',
      supplementId: 'sup_ipc_followup',
      requestId: 'request_sup_ipc_followup',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.requestId, 'request_sup_ipc_followup');
    assert.equal(result.value.workspaceId, 'ws_ipc');
    assert.equal(result.value.memoryId, 'mem_ipc_audio');
    assert.equal(result.value.segmentId, 'seg_ipc_audio');
    assert.equal(result.value.supplementId, 'sup_ipc_followup');
    assert.deepEqual(Array.from(result.value.audio), [4, 5]);
    assert.equal(result.value.audioByteLength, 2);
    assert.deepEqual(result.value.transcript, { exists: false, text: '' });
    assert.equal('workspaceHandle' in result.value, false);
    assert.equal('rootPath' in result.value, false);
  }
});

test('readFinalizedAudioSegmentSupplement reads renamed supplement file-space nodes', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-renamed-supplement-audio-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充播放',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    title: '生日录音',
  });
  const supplementDirectory = path.join(
    rootPath,
    'memories',
    'mem_ipc_audio',
    'segments',
    'seg_ipc_audio',
    'supplements',
    'sup_ipc_followup--补充录音'
  );
  await mkdir(supplementDirectory, { recursive: true });
  await writeFinalizedSupplementFiles({
    root: rootPath,
    directory: supplementDirectory,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    supplementId: 'sup_ipc_followup',
    title: '补充录音',
    audioBytes: [7, 8, 9],
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleReadFinalizedAudioSegmentSupplementForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_audio',
      segmentId: 'seg_ipc_audio',
      supplementId: 'sup_ipc_followup',
      requestId: 'request_sup_ipc_followup',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(Array.from(result.value.audio), [7, 8, 9]);
    assert.equal(result.value.audioByteLength, 3);
    assert.equal('workspaceHandle' in result.value, false);
    assert.equal('rootPath' in result.value, false);
  }
});

test('readFinalizedAudioSegmentSupplement rejects a symlinked supplements parent', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-supplement-parent-symlink-'));
  const outsideRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-supplement-outside-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充父目录',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    title: '生日录音',
  });
  const outsideSupplementDirectory = path.join(outsideRoot, 'sup_outside_followup');
  await mkdir(outsideSupplementDirectory, { recursive: true });
  await writeFinalizedSupplementFiles({
    root: rootPath,
    directory: outsideSupplementDirectory,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    supplementId: 'sup_outside_followup',
    title: '补充录音',
  });
  await symlink(
    outsideRoot,
    path.join(rootPath, 'memories', 'mem_ipc_audio', 'segments', 'seg_ipc_audio', 'supplements')
  );
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleReadFinalizedAudioSegmentSupplementForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_audio',
      segmentId: 'seg_ipc_audio',
      supplementId: 'sup_outside_followup',
      requestId: 'request_sup_symlink',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_RECORDING_NOT_FOUND');
  }
});

test('saveSegmentSupplementTranscript writes the supplement transcript without exposing paths', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-save-supplement-transcript-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充转写',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    title: '生日录音',
  });
  const supplementDirectory = path.join(
    rootPath,
    'memories',
    'mem_ipc_audio',
    'segments',
    'seg_ipc_audio',
    'supplements',
    'sup_ipc_followup--补充录音'
  );
  await mkdir(supplementDirectory, { recursive: true });
  await writeFinalizedSupplementFiles({
    root: rootPath,
    directory: supplementDirectory,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    supplementId: 'sup_ipc_followup',
    title: '补充录音',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleSaveSegmentSupplementTranscriptForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_audio',
      segmentId: 'seg_ipc_audio',
      supplementId: 'sup_ipc_followup',
      markdown: '补充录音的真实转写',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, true);
  assert.equal(
    await readSupplementContent(supplementDirectory),
    '\n\n## Transcript\n\n补充录音的真实转写\n'
  );
  if (result.ok) {
    assert.equal(result.value.saved, true);
    assert.equal(result.value.memory.supplementCount, 1);
    assert.equal(result.value.segment.supplements[0]?.transcript.exists, true);
    assert.equal(result.value.supplement.transcript.exists, true);
    assert.equal('workspaceHandle' in result.value, false);
    assert.equal('rootPath' in result.value, false);
  }
});

test('createRecordingDraft returns a flat IPC response value', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-recording-draft-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 录音',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleCreateRecordingDraftForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    createSegmentId: () => 'seg_ipc_draft',
    now: () => '2026-05-08T14:42:00.000Z',
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      segmentId: 'seg_ipc_draft',
      nextSequence: 0,
    },
  });
});

test('recording finalize IPC forwards transcription attempt to durable manifest', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-recording-finalize-attempt-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 录音完成',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const createdMemory = await handleCreateMemoryForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      title: '完成目标',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    createMemoryId: () => 'mem_ipc_finalize_attempt',
    now: () => '2026-05-08T14:42:00.000Z',
  });
  assert.equal(createdMemory.ok, true);

  const createdDraft = await handleCreateRecordingDraftForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    createSegmentId: () => 'seg_ipc_finalize_attempt',
    now: () => '2026-05-08T14:43:00.000Z',
  });
  assert.equal(createdDraft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_ipc_finalize_attempt',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await handleFinalizeRecordingDraftForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      memoryId: 'mem_ipc_finalize_attempt',
      segmentId: 'seg_ipc_finalize_attempt',
      title: '完成录音',
      durationMs: 1000,
      lastTranscriptionAttemptOnFinalize: 'failed',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => '2026-05-08T14:44:00.000Z',
  });

  assert.equal(finalized.ok, true);
  if (finalized.ok) {
    assert.equal(finalized.value.segment.lastTranscriptionAttempt, 'failed');
  }
  assert.equal(
    (await readObjectManifest(rootPath, 'segments', 'seg_ipc_finalize_attempt'))[
      'lastTranscriptionAttempt'
    ],
    'failed'
  );
});

test('segment supplement recording IPC keeps the finalized audio under the parent segment', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-supplement-draft-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充录音',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_supplement',
    segmentId: 'seg_ipc_supplement_parent',
    title: '父级录音',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const created = await handleCreateSegmentSupplementRecordingDraftForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_supplement',
      segmentId: 'seg_ipc_supplement_parent',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    createSupplementId: () => 'sup_ipc_supplement_child',
    now: () => '2026-05-08T14:42:00.000Z',
  });

  assert.deepEqual(created, {
    ok: true,
    value: {
      supplementId: 'sup_ipc_supplement_child',
      nextSequence: 0,
    },
  });
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId: 'sup_ipc_supplement_child',
    sequence: 0,
    chunk: new Uint8Array([4, 5]),
  });

  const finalized = await handleFinalizeSegmentSupplementRecordingDraftForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_supplement',
      segmentId: 'seg_ipc_supplement_parent',
      supplementId: 'sup_ipc_supplement_child',
      title: '补充录音',
      durationMs: 500,
      lastTranscriptionAttemptOnFinalize: 'never',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(finalized.ok, true);
  if (finalized.ok) {
    assert.equal(finalized.value.memory.segmentCount, 1);
    assert.equal(finalized.value.memory.supplementCount, 1);
    assert.equal(finalized.value.segment.segmentId, 'seg_ipc_supplement_parent');
    assert.equal(finalized.value.segment.supplementCount, 1);
    assert.equal(finalized.value.supplement.supplementId, 'sup_ipc_supplement_child');
    assert.equal(finalized.value.supplement.segmentId, 'seg_ipc_supplement_parent');
    assert.equal(finalized.value.supplement.audioByteLength, 2);
    assert.equal(finalized.value.supplement.lastTranscriptionAttempt, 'never');
    assert.equal('workspaceHandle' in finalized.value.supplement, false);
    assert.equal('rootPath' in finalized.value.supplement, false);
  }
  assert.equal(
    (await readObjectManifest(rootPath, 'supplements', 'sup_ipc_supplement_child'))[
      'lastTranscriptionAttempt'
    ],
    'never'
  );
  await assert.rejects(
    stat(
      path.join(rootPath, 'memories', 'mem_ipc_supplement', 'segments', 'sup_ipc_supplement_child')
    )
  );
  const segmentDirectory = await findSegmentDirectoryById(rootPath, 'seg_ipc_supplement_parent');
  const supplementDirectoryName = (await readdir(path.join(segmentDirectory, 'supplements'))).find(
    (entry) =>
      entry === 'sup_ipc_supplement_child' || entry.startsWith('sup_ipc_supplement_child--')
  );
  assert.ok(supplementDirectoryName);
  assert.equal(
    (
      await stat(path.join(segmentDirectory, 'supplements', supplementDirectoryName, 'audio.webm'))
    ).isFile(),
    true
  );
});

test('updateMemoryTitle renames the memory node through file truth', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memory-title-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc',
    segmentId: 'seg_ipc',
    title: '旧标题',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleUpdateMemoryTitleForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      memoryId: 'mem_ipc',
      title: '产品灵感与思考',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    now: () => '2026-05-08T14:42:00.000Z',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.memoryId, 'mem_ipc');
    assert.equal(result.value.title, '产品灵感与思考');
    assert.equal(result.value.segmentCount, 1);
    assert.equal(result.value.updatedAt, '2026-05-06T13:09:00.000Z');
    assert.equal('rootPath' in result.value, false);
    assert.equal('segmentIds' in result.value, false);
  }
  const memoryDirectory = path.join(rootPath, 'memories', 'mem_ipc--产品灵感与思考');
  await assert.rejects(stat(path.join(rootPath, 'memories', 'mem_ipc')));
  assert.equal(
    parseWorkspaceMarkdownObject({
      objectType: 'memory',
      markdown: await readFile(path.join(memoryDirectory, 'memory.md'), 'utf8'),
    }).data.title,
    '产品灵感与思考'
  );
  assert.equal(
    parseWorkspaceMarkdownObject({
      objectType: 'segment',
      markdown: await readFile(
        path.join(memoryDirectory, 'segments', 'seg_ipc', 'segment.md'),
        'utf8'
      ),
    }).data.title,
    '旧标题'
  );
});

test('updateSegmentTitle renames the segment node through file truth', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-segment-title-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 片段',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_segment',
    segmentId: 'seg_ipc_segment',
    title: '旧录音',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleUpdateSegmentTitleForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_segment',
      segmentId: 'seg_ipc_segment',
      title: '录音1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.memory.memoryId, 'mem_ipc_segment');
    assert.equal(result.value.memory.updatedAt, '2026-05-06T13:09:00.000Z');
    assert.equal(result.value.segment.segmentId, 'seg_ipc_segment');
    assert.equal(result.value.segment.title, '录音1');
    assert.equal(result.value.segment.updatedAt, '2026-05-06T13:09:00.000Z');
    assert.equal('rootPath' in result.value.segment, false);
  }

  const segmentDirectory = await findSegmentDirectoryById(rootPath, 'seg_ipc_segment');
  assert.equal(path.basename(segmentDirectory), 'seg_ipc_segment--录音1');
  assert.equal(
    parseWorkspaceMarkdownObject({
      objectType: 'segment',
      markdown: await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'),
    }).data.title,
    '录音1'
  );
  assert.equal(
    JSON.parse(
      await readFile(
        path.join(rootPath, '.reo', 'objects', 'memories', 'mem_ipc_segment.json'),
        'utf8'
      )
    ).updatedAt,
    '2026-05-06T13:09:00.000Z'
  );
});

test('updateSegmentSupplementTitle renames the supplement node through file truth', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-supplement-title-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充命名',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_supplement_title',
    segmentId: 'seg_ipc_supplement_title',
    title: '父级录音',
  });
  const segmentDirectory = await findSegmentDirectoryById(rootPath, 'seg_ipc_supplement_title');
  const supplementDirectory = path.join(
    segmentDirectory,
    'supplements',
    'sup_ipc_supplement_title'
  );
  await mkdir(supplementDirectory, { recursive: true });
  await writeFinalizedSupplementFiles({
    root: rootPath,
    directory: supplementDirectory,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_supplement_title',
    segmentId: 'seg_ipc_supplement_title',
    supplementId: 'sup_ipc_supplement_title',
    title: '补充录音1',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleUpdateSegmentSupplementTitleForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_supplement_title',
      segmentId: 'seg_ipc_supplement_title',
      supplementId: 'sup_ipc_supplement_title',
      title: '现场补充',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.memory.memoryId, 'mem_ipc_supplement_title');
    assert.equal(result.value.memory.supplementCount, 1);
    assert.equal(result.value.segment.segmentId, 'seg_ipc_supplement_title');
    assert.equal(result.value.segment.supplementCount, 1);
    assert.equal(result.value.supplement.supplementId, 'sup_ipc_supplement_title');
    assert.equal(result.value.supplement.title, '现场补充');
    assert.equal(result.value.supplement.updatedAt, '2026-05-06T13:11:00.000Z');
    assert.equal('rootPath' in result.value.supplement, false);
    assert.equal('workspaceHandle' in result.value.supplement, false);
  }

  const renamedSupplementDirectory = path.join(
    segmentDirectory,
    'supplements',
    'sup_ipc_supplement_title--现场补充'
  );
  await assert.rejects(stat(supplementDirectory));
  await stat(renamedSupplementDirectory);
  assert.equal(await readSupplementTitle(renamedSupplementDirectory), '现场补充');
});

test('updateSegmentSupplementTitle rejects workspace mismatches before file writes', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-supplement-title-mismatch-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充命名不匹配',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_supplement_mismatch',
    segmentId: 'seg_ipc_supplement_mismatch',
    title: '父级录音',
  });
  const segmentDirectory = await findSegmentDirectoryById(rootPath, 'seg_ipc_supplement_mismatch');
  const supplementDirectory = path.join(
    segmentDirectory,
    'supplements',
    'sup_ipc_supplement_mismatch'
  );
  await mkdir(supplementDirectory, { recursive: true });
  await writeFinalizedSupplementFiles({
    root: rootPath,
    directory: supplementDirectory,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_supplement_mismatch',
    segmentId: 'seg_ipc_supplement_mismatch',
    supplementId: 'sup_ipc_supplement_mismatch',
    title: '补充录音1',
  });

  const result = await handleUpdateSegmentSupplementTitleForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_other',
      memoryId: 'mem_ipc_supplement_mismatch',
      segmentId: 'seg_ipc_supplement_mismatch',
      supplementId: 'sup_ipc_supplement_mismatch',
      title: '不应写入',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createRegisteredHandleStore(rootPath),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH');
  }
  await stat(supplementDirectory);
  assert.equal(await readSupplementTitle(supplementDirectory), '补充录音1');
  await assert.rejects(
    stat(path.join(segmentDirectory, 'supplements', 'sup_ipc_supplement_mismatch--不应写入'))
  );
});

test('updateMemorySpaceTitle updates workspace file truth and registry projection', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-workspace-title-'));
  const rootPath = path.join(parentPath, 'IPC 记忆');
  const renamedRootPath = path.join(parentPath, '测试工作区1');
  await mkdir(rootPath, { recursive: true });
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆',
    description: 'Private notes',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const registryPath = path.join(parentPath, 'registry.json');
  let registryNow = '2026-05-08T14:39:00.000Z';
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => registryNow,
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_ipc',
      title: 'IPC 记忆',
      description: 'Private notes',
      memories: [],
    },
  });
  registryNow = '2026-05-08T14:41:00.000Z';
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: '/Users/example/Recently opened',
    snapshot: {
      workspaceId: 'ws_recent',
      title: '最近打开',
      description: '',
      memories: [],
    },
  });
  registryNow = '2026-05-08T14:42:00.000Z';

  const inactiveResult = await handleUpdateMemorySpaceTitleForTest({
    event,
    input: {
      workspaceId: 'ws_ipc',
      title: '测试工作区1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry,
  });

  assert.equal(inactiveResult.ok, true);
  if (inactiveResult.ok) {
    assert.deepEqual(inactiveResult.value, {
      workspaceId: 'ws_ipc',
      title: '测试工作区1',
      description: 'Private notes',
      memories: [],
    });
    assert.equal('rootPath' in inactiveResult.value, false);
  }
  await assert.rejects(() => stat(rootPath), { code: 'ENOENT' });
  assert.equal((await stat(renamedRootPath)).isDirectory(), true);
  assert.equal(
    JSON.parse(await readFile(path.join(renamedRootPath, '.reo', 'workspace.json'), 'utf8')).title,
    '测试工作区1'
  );
  assert.equal(
    JSON.parse(await readFile(registryPath, 'utf8')).memorySpaces.find(
      (memorySpace: { readonly workspaceId: string }) => memorySpace.workspaceId === 'ws_ipc'
    )?.rootPath,
    await realpath(renamedRootPath)
  );
  assert.deepEqual(await memorySpaceRegistry.listMemorySpaces(), [
    {
      workspaceId: 'ws_recent',
      title: '最近打开',
      description: '',
      addedAt: '2026-05-08T14:41:00.000Z',
      lastOpenedAt: '2026-05-08T14:41:00.000Z',
    },
    {
      workspaceId: 'ws_ipc',
      title: '测试工作区1',
      description: 'Private notes',
      addedAt: '2026-05-08T14:39:00.000Z',
      lastOpenedAt: '2026-05-08T14:39:00.000Z',
    },
  ]);
});

test('updateMemorySpaceTitle keeps the active handle usable after renaming the root folder', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-workspace-title-active-'));
  const rootPath = path.join(parentPath, 'IPC 记忆');
  const renamedRootPath = path.join(parentPath, '测试工作区2');
  await mkdir(rootPath, { recursive: true });
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆',
    description: 'Private notes',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const lock = await acquireWorkspaceLock({ canonicalRoot: rootPath });
  assert.equal(lock.ok, true);
  if (!lock.ok) {
    return;
  }
  const handleStore = createWorkspaceHandleStore({ createHandle: () => 'wh_ipc' });
  handleStore.register({
    canonicalRoot: rootPath,
    workspaceId: 'ws_ipc',
    sender,
    lock: lock.lock,
  });
  const registryPath = path.join(parentPath, 'registry.json');
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T14:42:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_ipc',
      title: 'IPC 记忆',
      description: 'Private notes',
      memories: [],
    },
  });

  const activeResult = await handleUpdateMemorySpaceTitleForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      title: '测试工作区2',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    memorySpaceRegistry,
  });

  assert.equal(activeResult.ok, true);
  if (activeResult.ok) {
    assert.equal(activeResult.value.title, '测试工作区2');
    assert.equal('rootPath' in activeResult.value, false);
  }
  await assert.rejects(() => stat(rootPath), { code: 'ENOENT' });
  assert.equal((await stat(renamedRootPath)).isDirectory(), true);
  assert.equal(
    JSON.parse(await readFile(path.join(renamedRootPath, '.reo', 'workspace.json'), 'utf8')).title,
    '测试工作区2'
  );
  assert.equal(
    JSON.parse(await readFile(registryPath, 'utf8')).memorySpaces[0]?.rootPath,
    await realpath(renamedRootPath)
  );

  const snapshotAfterRename = await handleReadWorkspaceSnapshotForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(snapshotAfterRename.ok, true);
  if (snapshotAfterRename.ok) {
    assert.equal(snapshotAfterRename.value.title, '测试工作区2');
    assert.equal('rootPath' in snapshotAfterRename.value, false);
  }

  const closed = await handleCloseWorkspaceForTest({
    event,
    input: { workspaceHandle: 'wh_ipc' },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.deepEqual(closed, { ok: true, value: { closed: true } });
  await assertWorkspaceLockCanBeReacquired(renamedRootPath);
});

test('updateMemorySpaceTitle repairs a previous metadata-only memory space rename', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-workspace-title-repair-'));
  const rootPath = path.join(parentPath, '生活记录');
  const renamedRootPath = path.join(parentPath, '生活记');
  await mkdir(rootPath, { recursive: true });
  await initializeWorkspaceFiles({
    rootPath,
    title: '生活记录',
    description: 'Private notes',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFile(
    path.join(rootPath, '.reo', 'workspace.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_ipc',
        title: '生活记',
        description: 'Private notes',
        createdAt: '2026-05-06T13:08:00.000Z',
      },
      null,
      2
    )}\n`
  );

  const registryPath = path.join(parentPath, 'registry.json');
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T14:42:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_ipc',
      title: '生活记',
      description: 'Private notes',
      memories: [],
    },
  });

  const result = await handleUpdateMemorySpaceTitleForTest({
    event,
    input: {
      workspaceId: 'ws_ipc',
      title: '生活记',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.title, '生活记');
    assert.equal('rootPath' in result.value, false);
  }
  await assert.rejects(() => stat(rootPath), { code: 'ENOENT' });
  assert.equal((await stat(renamedRootPath)).isDirectory(), true);
  assert.equal(
    JSON.parse(await readFile(path.join(renamedRootPath, '.reo', 'workspace.json'), 'utf8')).title,
    '生活记'
  );
  assert.equal(
    JSON.parse(await readFile(registryPath, 'utf8')).memorySpaces[0]?.rootPath,
    await realpath(renamedRootPath)
  );
});

test('updateMemorySpaceTitle preserves the current root when the target folder exists', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-workspace-title-conflict-'));
  const rootPath = path.join(parentPath, '旧空间');
  const conflictingRootPath = path.join(parentPath, '灵感空间');
  await mkdir(rootPath, { recursive: true });
  await mkdir(conflictingRootPath, { recursive: true });
  await initializeWorkspaceFiles({
    rootPath,
    title: '旧空间',
    description: 'Private notes',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const registryPath = path.join(parentPath, 'registry.json');
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T14:39:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_ipc',
      title: '旧空间',
      description: 'Private notes',
      memories: [],
    },
  });

  const result = await handleUpdateMemorySpaceTitleForTest({
    event,
    input: {
      workspaceId: 'ws_ipc',
      title: '灵感空间',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_ALREADY_EXISTS');
    assert.equal(result.error.dataRetention, 'previous-file-preserved');
  }
  assert.equal((await stat(rootPath)).isDirectory(), true);
  assert.equal((await stat(conflictingRootPath)).isDirectory(), true);
  assert.equal(
    JSON.parse(await readFile(path.join(rootPath, '.reo', 'workspace.json'), 'utf8')).title,
    '旧空间'
  );
  assert.deepEqual(JSON.parse(await readFile(registryPath, 'utf8')).memorySpaces, [
    {
      workspaceId: 'ws_ipc',
      title: '旧空间',
      description: 'Private notes',
      rootPath,
      addedAt: '2026-05-08T14:39:00.000Z',
      lastOpenedAt: '2026-05-08T14:39:00.000Z',
    },
  ]);
});

test('updateMemorySpaceTitle reports stale projection when inactive registry write fails after root rename', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-workspace-title-registry-'));
  const rootPath = path.join(parentPath, '生活记录');
  const renamedRootPath = path.join(parentPath, '生活记');
  await mkdir(rootPath, { recursive: true });
  await initializeWorkspaceFiles({
    rootPath,
    title: '生活记录',
    description: 'Private notes',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  const result = await handleUpdateMemorySpaceTitleForTest({
    event,
    input: {
      workspaceId: 'ws_ipc',
      title: '生活记',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry: {
      listMemorySpaces: async () => [],
      resolveMemorySpace: async () => null,
      resolveMemorySpaceRoot: async () => rootPath,
      removeMemorySpace: async () => {},
      updateMemorySpaceSnapshot: async () => {
        throw new Error('registry projection is unavailable');
      },
      upsertMemorySpace: async () => {
        throw new Error('unused');
      },
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_WRITE_FAILED');
    assert.equal(result.error.dataRetention, 'file-written-index-stale');
  }
  await assert.rejects(() => stat(rootPath), { code: 'ENOENT' });
  assert.equal((await stat(renamedRootPath)).isDirectory(), true);
  assert.equal(
    JSON.parse(await readFile(path.join(renamedRootPath, '.reo', 'workspace.json'), 'utf8')).title,
    '生活记'
  );
});

test('updateMemorySpaceTitle keeps active workspace rename when registry projection write fails', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-workspace-title-active-'));
  const rootPath = path.join(parentPath, 'IPC 记忆');
  const renamedRootPath = path.join(parentPath, '灵感空间');
  await mkdir(rootPath, { recursive: true });
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆',
    description: 'Private notes',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  const result = await handleUpdateMemorySpaceTitleForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      title: '灵感空间',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createRegisteredHandleStore(rootPath),
    memorySpaceRegistry: {
      listMemorySpaces: async () => [],
      resolveMemorySpace: async () => null,
      resolveMemorySpaceRoot: async () => null,
      removeMemorySpace: async () => {},
      updateMemorySpaceSnapshot: async () => {
        throw new Error('registry projection is unavailable');
      },
      upsertMemorySpace: async () => {
        throw new Error('registry projection is unavailable');
      },
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.title, '灵感空间');
    assert.equal('rootPath' in result.value, false);
  }
  await assert.rejects(() => stat(rootPath), { code: 'ENOENT' });
  assert.equal((await stat(renamedRootPath)).isDirectory(), true);
  assert.equal(
    JSON.parse(await readFile(path.join(renamedRootPath, '.reo', 'workspace.json'), 'utf8')).title,
    '灵感空间'
  );
});

test('updateMemorySpaceTitle rejects untrusted senders before parsing payloads', async () => {
  let payloadRead = false;
  const hostileInput = {};
  Object.defineProperty(hostileInput, 'workspaceId', {
    enumerable: true,
    get() {
      payloadRead = true;
      return 'ws_untrusted';
    },
  });

  const result = await handleUpdateMemorySpaceTitleForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: hostileInput,
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.equal(payloadRead, false);
});

test('readWorkspaceSnapshot reflects external workspace and memory Markdown edits', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-snapshot-refresh-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 记忆',
    description: 'Private notes',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc',
    segmentId: 'seg_ipc',
    title: '旧记忆',
  });

  await writeFile(
    path.join(rootPath, '.reo', 'workspace.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_ipc',
        title: '外部空间',
        description: 'Codex updated workspace metadata.',
        createdAt: '2026-05-06T13:08:00.000Z',
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    path.join(rootPath, 'memories', 'mem_ipc', 'memory.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'memory',
      data: { title: '外部记忆' },
      content: '# 外部记忆\n',
    })
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'memories', 'mem_ipc.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'memory',
        memoryId: 'mem_ipc',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-08T14:42:00.000Z',
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    path.join(rootPath, 'memories', 'mem_ipc', 'segments', 'seg_ipc', 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: '旧记忆', kind: 'audio' },
      content: '# 旧记忆\n\n## Transcript\n\n外部转写内容\n',
    })
  );

  const result = await handleReadWorkspaceSnapshotForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createRegisteredHandleStore(rootPath),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.title, path.basename(rootPath));
    assert.equal(result.value.description, 'Codex updated workspace metadata.');
    assert.deepEqual(result.value.memories, [
      {
        memoryId: 'mem_ipc',
        title: '外部记忆',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-08T14:42:00.000Z',
        segmentCount: 1,
        durationMs: 1000,
        audioByteLength: 3,
        hasTranscript: true,
        supplementCount: 0,
      },
    ]);
    assert.equal('rootPath' in result.value, false);
    assert.equal('workspaceHandle' in result.value, false);
  }
  assert.equal(
    JSON.parse(await readFile(path.join(rootPath, '.reo', 'workspace.json'), 'utf8')).title,
    path.basename(rootPath)
  );
});

test('initializeWorkspace releases the lock when post-lock file writes throw', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-throw-'));
  const workspaceRoot = path.join(rootPath, '写入失败工作区');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-throw',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-init-throw',
      title: '写入失败工作区',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_init_throw',
    createHandle: () => 'wh_init_throw',
    now: () => '2026-05-06T13:08:00.000Z',
    afterWorkspaceLockAcquiredForTest: async () => {
      await mkdir(path.join(workspaceRoot, '.reo', 'workspace.json'), { recursive: true });
    },
  });

  assert.equal(result.ok, false);
  await assertWorkspaceLockCanBeReacquired(workspaceRoot);
});

test('initializeWorkspace rejects lock identity loss before workspace files are written', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-lock-lost-'));
  const workspaceRoot = path.join(rootPath, 'Lock lost');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-lock-lost',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-init-lock-lost',
      title: 'Lock lost',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_init_lock_lost',
    createHandle: () => 'wh_init_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
    afterWorkspaceLockAcquiredForTest: async () => {
      await rename(path.join(workspaceRoot, '.reo'), path.join(workspaceRoot, '.reo-preserved'));
      await mkdir(path.join(workspaceRoot, '.reo'));
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await assert.rejects(stat(path.join(workspaceRoot, 'AGENTS.md')));
  await assert.rejects(stat(path.join(workspaceRoot, '.reo', 'workspace.json')));
});

test('initializeWorkspace rejects lock identity loss during managed directory creation', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-mid-lock-lost-'));
  const workspaceRoot = path.join(rootPath, 'Lock lost');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-mid-lock-lost',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });
  setAfterWorkspaceReoDirectoryCheckForTest(async () => {
    setAfterWorkspaceReoDirectoryCheckForTest(null);
    await rename(path.join(workspaceRoot, '.reo'), path.join(workspaceRoot, '.reo-preserved'));
    await mkdir(path.join(workspaceRoot, '.reo'));
  });

  try {
    const result = await handleInitializeWorkspaceForTest({
      event,
      input: {
        selectionToken: 'selection-token-init-mid-lock-lost',
        title: 'Lock lost',
        description: '',
      },
      expectedSession,
      expectedSessionKey: 'default',
      isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
      tokenStore,
      createWorkspaceId: () => 'ws_init_mid_lock_lost',
      createHandle: () => 'wh_init_mid_lock_lost',
      now: () => '2026-05-06T13:08:00.000Z',
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
  } finally {
    setAfterWorkspaceReoDirectoryCheckForTest(null);
  }
  await assert.rejects(stat(path.join(workspaceRoot, 'AGENTS.md')));
  await assert.rejects(stat(path.join(workspaceRoot, '.reo', 'drafts')));
  await assert.rejects(stat(path.join(workspaceRoot, '.reo', 'workspace.json')));
});

test('initializeWorkspace releases the lock when handle registration throws', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-init-handle-throw-'));
  const workspaceRoot = path.join(rootPath, 'handle 注册失败工作区');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-init-handle-throw',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleInitializeWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-init-handle-throw',
      title: 'handle 注册失败工作区',
      description: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_init_handle_throw',
    createHandle: () => {
      throw new Error('handle boom');
    },
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_INIT_FAILED');
  }
  await assertWorkspaceLockCanBeReacquired(workspaceRoot);
});

test('openWorkspace initializes an empty selected folder as a new workspace', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-empty-'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-empty',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-empty',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_open_empty',
    createHandle: () => 'wh_open_empty',
    now: () => '2026-05-08T13:09:00.000Z',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.workspaceHandle, 'wh_open_empty');
    assert.equal(result.value.workspaceId, 'ws_open_empty');
    assert.equal(result.value.snapshot.title, path.basename(rootPath));
  }
  assert.equal(
    await readFile(path.join(rootPath, 'AGENTS.md'), 'utf8'),
    '# Reo workspace\n\n本文件是 Reo workspace 的 AI 协作入口。\n'
  );
  await stat(path.join(rootPath, '.reo', 'workspace.json'));
});

test('openWorkspace rejects non-empty non-Reo directories before writing a workspace lock', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-non-empty-'));
  await writeFile(path.join(rootPath, 'notes.md'), 'not a Reo workspace\n');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-non-empty',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-non-empty',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(rootPath, '.reo')));
});

test('openWorkspace rejects a folder that becomes non-empty after the empty check', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-empty-race-'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-empty-race',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-empty-race',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createWorkspaceId: () => 'ws_open_empty_race',
    createHandle: () => 'wh_open_empty_race',
    now: () => '2026-05-08T13:09:00.000Z',
    afterWorkspaceLockAcquiredForTest: async () => {
      await writeFile(path.join(rootPath, 'notes.md'), 'not a Reo workspace\n');
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
    assert.equal(result.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(rootPath, '.reo')));
  await assertWorkspaceLockCanBeReacquired(rootPath);
});

test('openWorkspace registers imported memory spaces and listMemorySpaces never exposes rootPath', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-register-'));
  const rootPath = path.join(parentPath, 'Runtime validated memory');
  await mkdir(rootPath, { recursive: true });
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath: path.join(
      await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-registry-')),
      'registry.json'
    ),
    now: () => '2026-05-08T07:48:00.000Z',
  });
  await initializeWorkspaceFiles({
    rootPath,
    title: 'Runtime validated memory',
    description: 'Final runtime validation workspace.',
    createWorkspaceId: () => 'ws_runtime_validated',
    now: () => '2026-05-08T07:47:00.000Z',
  });
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-memory-space-register',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const openResult = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-memory-space-register',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    memorySpaceRegistry,
  });

  assert.equal(openResult.ok, true);
  const listResult = await handleListWorkspaceMemorySpacesForTest({
    event,
    input: undefined,
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry,
  });

  assert.deepEqual(listResult, {
    ok: true,
    value: {
      memorySpaces: [
        {
          workspaceId: 'ws_runtime_validated',
          title: 'Runtime validated memory',
          description: 'Final runtime validation workspace.',
          addedAt: '2026-05-08T07:48:00.000Z',
          lastOpenedAt: '2026-05-08T07:48:00.000Z',
        },
      ],
    },
  });
  assert.equal(JSON.stringify(listResult).includes(rootPath), false);
});

test('openWorkspace repairs the metadata title mirror from a selected root folder rename', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-finder-renamed-'));
  const originalRoot = path.join(parentPath, '生活记录');
  const renamedRoot = path.join(parentPath, '生活记');
  await mkdir(originalRoot, { recursive: true });
  await initializeWorkspaceFiles({
    rootPath: originalRoot,
    title: '生活记录',
    description: 'Private notes',
    createWorkspaceId: () => 'ws_finder_renamed',
    now: () => '2026-05-08T07:47:00.000Z',
  });
  await rename(originalRoot, renamedRoot);

  const registryPath = path.join(parentPath, 'registry.json');
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:48:00.000Z',
  });
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-finder-renamed',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath: renamedRoot, displayPath: '生活记', sender });

  const openResult = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-finder-renamed',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    createHandle: () => 'wh_open_finder_renamed',
    memorySpaceRegistry,
  });

  assert.equal(openResult.ok, true);
  if (openResult.ok) {
    assert.deepEqual(openResult.value.snapshot, {
      workspaceId: 'ws_finder_renamed',
      title: '生活记',
      description: 'Private notes',
      memories: [],
    });
    assert.equal('rootPath' in openResult.value, false);
  }
  assert.equal(
    JSON.parse(await readFile(path.join(renamedRoot, '.reo', 'workspace.json'), 'utf8')).title,
    '生活记'
  );
  assert.equal(
    JSON.parse(await readFile(registryPath, 'utf8')).memorySpaces[0]?.rootPath,
    await realpath(renamedRoot)
  );
});

test('listMemorySpaces returns an error envelope when the memory space registry cannot be read', async () => {
  const result = await handleListWorkspaceMemorySpacesForTest({
    event,
    input: undefined,
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry: {
      listMemorySpaces: async () => {
        throw new Error('registry unreadable');
      },
      resolveMemorySpace: async () => null,
      resolveMemorySpaceRoot: async () => null,
      removeMemorySpace: async () => {},
      updateMemorySpaceSnapshot: async () => {
        throw new Error('unused');
      },
      upsertMemorySpace: async () => {
        throw new Error('unused');
      },
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_READ_FAILED');
  }
});

test('openMemorySpace opens a persisted memory space without a selection token', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-open-'));
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-open-registry-')),
    'registry.json'
  );
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });
  await initializeWorkspaceFiles({
    rootPath,
    title: 'Runtime validated memory',
    description: 'Final runtime validation workspace.',
    createWorkspaceId: () => 'ws_runtime_validated',
    now: () => '2026-05-08T07:47:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_runtime_validated',
      title: 'Runtime validated memory',
      description: 'Final runtime validation workspace.',
      memories: [],
    },
  });
  const restartedMemorySpacesRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:50:00.000Z',
  });

  const result = await handleOpenWorkspaceMemorySpaceForTest({
    event,
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    createHandle: () => 'wh_memory_space_open',
    memorySpaceRegistry: restartedMemorySpacesRegistry,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      workspaceHandle: 'wh_memory_space_open',
      workspaceId: 'ws_runtime_validated',
      snapshot: {
        workspaceId: 'ws_runtime_validated',
        title: path.basename(rootPath),
        description: 'Final runtime validation workspace.',
        memories: [],
      },
    });
    assert.equal('rootPath' in result.value, false);
  }
});

test('openMemorySpace resolves only the selected memory space before opening', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-open-selected-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'Runtime validated memory',
    description: 'Final runtime validation workspace.',
    createWorkspaceId: () => 'ws_runtime_validated',
    now: () => '2026-05-08T07:47:00.000Z',
  });

  const result = await handleOpenWorkspaceMemorySpaceForTest({
    event,
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    createHandle: () => 'wh_memory_space_open_selected',
    memorySpaceRegistry: {
      listMemorySpaces: async () => {
        throw new Error('open should not list every memory space');
      },
      resolveMemorySpace: async () => ({
        workspaceId: 'ws_runtime_validated',
        title: 'Runtime validated memory',
        description: 'Final runtime validation workspace.',
        rootPath,
        addedAt: '2026-05-08T07:48:00.000Z',
        lastOpenedAt: '2026-05-08T07:48:00.000Z',
      }),
      resolveMemorySpaceRoot: async () => rootPath,
      removeMemorySpace: async () => {},
      updateMemorySpaceSnapshot: async () => {
        throw new Error('unused');
      },
      upsertMemorySpace: async () => ({
        workspaceId: 'ws_runtime_validated',
        title: 'Runtime validated memory',
        description: 'Final runtime validation workspace.',
        addedAt: '2026-05-08T07:48:00.000Z',
        lastOpenedAt: '2026-05-08T07:48:00.000Z',
      }),
    },
  });

  assert.equal(result.ok, true);
});

test('openMemorySpace persists a Finder-renamed memory space title after acquiring the lock', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-finder-rename-'));
  const originalRoot = path.join(parentPath, '旧空间');
  const renamedRoot = path.join(parentPath, '灵感空间');
  await mkdir(originalRoot, { recursive: true });
  const registryPath = path.join(parentPath, 'registry.json');
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });
  await initializeWorkspaceFiles({
    rootPath: originalRoot,
    title: '旧空间',
    description: 'Final runtime validation workspace.',
    createWorkspaceId: () => 'ws_runtime_validated',
    now: () => '2026-05-08T07:47:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: originalRoot,
    snapshot: {
      workspaceId: 'ws_runtime_validated',
      title: '旧空间',
      description: 'Final runtime validation workspace.',
      memories: [],
    },
  });
  await rename(originalRoot, renamedRoot);

  const result = await handleOpenWorkspaceMemorySpaceForTest({
    event,
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    createHandle: () => 'wh_memory_space_finder_rename',
    memorySpaceRegistry,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.snapshot.title, '灵感空间');
    assert.equal('rootPath' in result.value, false);
  }
  assert.equal(
    JSON.parse(await readFile(path.join(renamedRoot, '.reo', 'workspace.json'), 'utf8')).title,
    '灵感空间'
  );
  assert.deepEqual(await memorySpaceRegistry.listMemorySpaces(), [
    {
      workspaceId: 'ws_runtime_validated',
      title: '灵感空间',
      description: 'Final runtime validation workspace.',
      addedAt: '2026-05-08T07:49:00.000Z',
      lastOpenedAt: '2026-05-08T07:49:00.000Z',
    },
  ]);
});

test('openMemorySpace repairs a stale title mirror when the registered root still exists', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-title-stale-'));
  const rootPath = path.join(parentPath, '生活记呀啊');
  await mkdir(rootPath, { recursive: true });
  const registryPath = path.join(parentPath, 'registry.json');
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });
  await initializeWorkspaceFiles({
    rootPath,
    title: '生活记录',
    description: 'Final runtime validation workspace.',
    createWorkspaceId: () => 'ws_runtime_validated',
    now: () => '2026-05-08T07:47:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_runtime_validated',
      title: '生活记录',
      description: 'Final runtime validation workspace.',
      memories: [],
    },
  });

  const result = await handleOpenWorkspaceMemorySpaceForTest({
    event,
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    createHandle: () => 'wh_memory_space_title_stale',
    memorySpaceRegistry,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.snapshot.title, '生活记呀啊');
    assert.equal('rootPath' in result.value, false);
  }
  assert.equal(
    JSON.parse(await readFile(path.join(rootPath, '.reo', 'workspace.json'), 'utf8')).title,
    '生活记呀啊'
  );
  assert.deepEqual(await memorySpaceRegistry.listMemorySpaces(), [
    {
      workspaceId: 'ws_runtime_validated',
      title: '生活记呀啊',
      description: 'Final runtime validation workspace.',
      addedAt: '2026-05-08T07:49:00.000Z',
      lastOpenedAt: '2026-05-08T07:49:00.000Z',
    },
  ]);
});

test('openMemorySpace repairs a stale title mirror before index reconciliation writes', async () => {
  const parentPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-repair-order-'));
  const rootPath = path.join(parentPath, '生活记呀啊');
  await mkdir(rootPath, { recursive: true });
  const registryPath = path.join(parentPath, 'registry.json');
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });
  await initializeWorkspaceFiles({
    rootPath,
    title: '生活记录',
    description: 'Final runtime validation workspace.',
    createWorkspaceId: () => 'ws_runtime_validated',
    now: () => '2026-05-08T07:47:00.000Z',
  });
  await writeFile(path.join(rootPath, '.reo', 'index.json'), '{not json');
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_runtime_validated',
      title: '生活记录',
      description: 'Final runtime validation workspace.',
      memories: [],
    },
  });

  let checkedBeforeIndexPersist = false;
  setBeforeWorkspaceIndexReconciliationPersistForTest(async () => {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
    checkedBeforeIndexPersist = true;
    assert.equal(
      JSON.parse(await readFile(path.join(rootPath, '.reo', 'workspace.json'), 'utf8')).title,
      '生活记呀啊'
    );
  });

  try {
    const result = await handleOpenWorkspaceMemorySpaceForTest({
      event,
      input: {
        workspaceId: 'ws_runtime_validated',
      },
      expectedSession,
      expectedSessionKey: 'default',
      isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
      createHandle: () => 'wh_memory_space_repair_order',
      memorySpaceRegistry,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.snapshot.title, '生活记呀啊');
    }
  } finally {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
  }

  assert.equal(checkedBeforeIndexPersist, true);
});

test('openMemorySpace does not rewrite titles when a registry root now belongs to another workspace', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-stale-root-'));
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-stale-root-registry-')),
    'registry.json'
  );
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });
  await initializeWorkspaceFiles({
    rootPath,
    title: '旧空间',
    description: '',
    createWorkspaceId: () => 'ws_runtime_validated',
    now: () => '2026-05-08T07:47:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_runtime_validated',
      title: '旧空间',
      description: '',
      memories: [],
    },
  });
  await writeFile(
    path.join(rootPath, '.reo', 'workspace.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_other_workspace',
        title: '其他空间',
        description: '',
        createdAt: '2026-05-08T07:47:00.000Z',
      },
      null,
      2
    )}\n`
  );
  const indexPath = path.join(rootPath, '.reo', 'index.json');
  await rm(indexPath, { force: true });

  const result = await handleOpenWorkspaceMemorySpaceForTest({
    event,
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
  }
  assert.equal(
    JSON.parse(await readFile(path.join(rootPath, '.reo', 'workspace.json'), 'utf8')).title,
    '其他空间'
  );
  await assert.rejects(readFile(indexPath, 'utf8'), { code: 'ENOENT' });
});

test('openMemorySpace reports a missing persisted workspace folder', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-missing-'));
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-missing-registry-')),
    'registry.json'
  );
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_deleted',
      title: 'Deleted workspace',
      description: '',
      memories: [],
    },
  });
  await rm(rootPath, { recursive: true, force: true });

  const result = await handleOpenWorkspaceMemorySpaceForTest({
    event,
    input: {
      workspaceId: 'ws_deleted',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_ROOT_MISSING');
    assert.equal(result.error.dataRetention, 'none-written');
  }
});

test('revealMemorySpaceInFinder rejects untrusted sender and does not show the folder', async () => {
  const shownPaths: string[] = [];
  const result = await handleRevealMemorySpaceInFinderForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    resolver: async () => ({
      ok: true,
      value: {
        rootAbsolute: '/tmp/reo-memory-space',
        agentsFileAbsolute: '/tmp/reo-memory-space/AGENTS.md',
      },
    }),
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(shownPaths, []);
});

test('revealMemorySpaceInFinder rejects invalid request', async () => {
  const shownPaths: string[] = [];
  const result = await handleRevealMemorySpaceInFinderForTest({
    event,
    input: {
      workspaceId: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');
  }
  assert.deepEqual(shownPaths, []);
});

test('revealMemorySpaceInFinder returns root missing when the memory space cannot be resolved', async () => {
  const shownPaths: string[] = [];
  const result = await handleRevealMemorySpaceInFinderForTest({
    event,
    input: {
      workspaceId: 'ws_missing',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    resolver: async () => ({ ok: false, code: 'ERR_WORKSPACE_ROOT_MISSING' }),
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_ROOT_MISSING');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(shownPaths, []);
});

test('revealMemorySpaceInFinder shows the canonical memory space root', async () => {
  const shownPaths: string[] = [];
  const result = await handleRevealMemorySpaceInFinderForTest({
    event,
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    resolver: async (workspaceId: string) => {
      assert.equal(workspaceId, 'ws_runtime_validated');
      return {
        ok: true,
        value: {
          rootAbsolute: '/tmp/reo-memory-space-canonical',
          agentsFileAbsolute: '/tmp/reo-memory-space-canonical/AGENTS.md',
        },
      };
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(shownPaths, ['/tmp/reo-memory-space-canonical']);
});

test('revealMemoryInFinder rejects untrusted sender and does not show the folder', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-reveal-untrusted');
  const shownPaths: string[] = [];
  const result = await handleRevealMemoryInFinderForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_reveal',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(shownPaths, []);
});

test('revealMemoryInFinder rejects a missing workspace handle', async () => {
  const shownPaths: string[] = [];
  const result = await handleRevealMemoryInFinderForTest({
    event,
    input: {
      workspaceHandle: 'missing-handle',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_reveal',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createWorkspaceHandleStore(),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_NOT_FOUND');
  }
  assert.deepEqual(shownPaths, []);
});

test('revealMemoryInFinder rejects a workspace id that does not match the handle', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-reveal-mismatch');
  const shownPaths: string[] = [];
  const result = await handleRevealMemoryInFinderForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_other',
      memoryId: 'mem_reveal',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH');
  }
  assert.deepEqual(shownPaths, []);
});

test('revealMemoryInFinder returns memory missing when the memory cannot be resolved', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-reveal-missing');
  const shownPaths: string[] = [];
  const result = await handleRevealMemoryInFinderForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_missing',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-memory-reveal-missing');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_missing');
      return { ok: false, code: 'ERR_WORKSPACE_MEMORY_NOT_FOUND' };
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_MEMORY_NOT_FOUND');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(shownPaths, []);
});

test('revealMemoryInFinder shows the resolved memory directory', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-reveal-success');
  const shownPaths: string[] = [];
  const result = await handleRevealMemoryInFinderForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_reveal',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-memory-reveal-success');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_reveal');
      return {
        ok: true,
        value: {
          directoryAbsolute: '/tmp/reo-memory-reveal-success/memories/mem_reveal',
          documentAbsolute: '/tmp/reo-memory-reveal-success/memories/mem_reveal/memory.md',
        },
      };
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(shownPaths, ['/tmp/reo-memory-reveal-success/memories/mem_reveal']);
});

test('revealSegmentInFinder rejects untrusted sender and does not show the folder', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-reveal-untrusted');
  const shownPaths: string[] = [];
  const result = await handleRevealSegmentInFinderForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_reveal',
      segmentId: 'seg_reveal',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(shownPaths, []);
});

test('revealSegmentInFinder rejects a missing workspace handle', async () => {
  const shownPaths: string[] = [];
  const result = await handleRevealSegmentInFinderForTest({
    event,
    input: {
      workspaceHandle: 'missing-handle',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_reveal',
      segmentId: 'seg_reveal',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createWorkspaceHandleStore(),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_NOT_FOUND');
  }
  assert.deepEqual(shownPaths, []);
});

test('revealSegmentInFinder rejects a workspace id that does not match the handle', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-reveal-mismatch');
  const shownPaths: string[] = [];
  const result = await handleRevealSegmentInFinderForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_other',
      memoryId: 'mem_reveal',
      segmentId: 'seg_reveal',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH');
  }
  assert.deepEqual(shownPaths, []);
});

test('revealSegmentInFinder returns segment missing when the segment cannot be resolved', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-reveal-missing');
  const shownPaths: string[] = [];
  const result = await handleRevealSegmentInFinderForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_reveal',
      segmentId: 'seg_missing',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-segment-reveal-missing');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_reveal');
      assert.equal(segmentId, 'seg_missing');
      return { ok: false, code: 'ERR_WORKSPACE_SEGMENT_NOT_FOUND' };
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_SEGMENT_NOT_FOUND');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(shownPaths, []);
});

test('revealSegmentInFinder shows the resolved segment directory', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-reveal-success');
  const shownPaths: string[] = [];
  const result = await handleRevealSegmentInFinderForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_reveal',
      segmentId: 'seg_reveal',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-segment-reveal-success');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_reveal');
      assert.equal(segmentId, 'seg_reveal');
      return {
        ok: true,
        value: {
          directoryAbsolute:
            '/tmp/reo-segment-reveal-success/memories/mem_reveal/segments/seg_reveal',
          documentAbsolute:
            '/tmp/reo-segment-reveal-success/memories/mem_reveal/segments/seg_reveal/segment.md',
        },
      };
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(shownPaths, [
    '/tmp/reo-segment-reveal-success/memories/mem_reveal/segments/seg_reveal',
  ]);
});

test('revealSegmentSupplementInFinder rejects untrusted sender and does not show the folder', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-supplement-reveal-untrusted');
  const shownPaths: string[] = [];
  const result = await handleRevealSegmentSupplementInFinderForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_reveal',
      segmentId: 'seg_reveal',
      supplementId: 'sup_reveal',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(shownPaths, []);
});

test('revealSegmentSupplementInFinder rejects a missing workspace handle', async () => {
  const shownPaths: string[] = [];
  const result = await handleRevealSegmentSupplementInFinderForTest({
    event,
    input: {
      workspaceHandle: 'missing-handle',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_reveal',
      segmentId: 'seg_reveal',
      supplementId: 'sup_reveal',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createWorkspaceHandleStore(),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_NOT_FOUND');
  }
  assert.deepEqual(shownPaths, []);
});

test('revealSegmentSupplementInFinder rejects a workspace id that does not match the handle', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-supplement-reveal-mismatch');
  const shownPaths: string[] = [];
  const result = await handleRevealSegmentSupplementInFinderForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_other',
      memoryId: 'mem_reveal',
      segmentId: 'seg_reveal',
      supplementId: 'sup_reveal',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH');
  }
  assert.deepEqual(shownPaths, []);
});

test('revealSegmentSupplementInFinder returns supplement missing when the supplement cannot be resolved', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-supplement-reveal-missing');
  const shownPaths: string[] = [];
  const result = await handleRevealSegmentSupplementInFinderForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_reveal',
      segmentId: 'seg_reveal',
      supplementId: 'sup_missing',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string,
      supplementId: string
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-segment-supplement-reveal-missing');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_reveal');
      assert.equal(segmentId, 'seg_reveal');
      assert.equal(supplementId, 'sup_missing');
      return { ok: false, code: 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND' };
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(shownPaths, []);
});

test('revealSegmentSupplementInFinder shows the resolved supplement directory', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-supplement-reveal-success');
  const shownPaths: string[] = [];
  const result = await handleRevealSegmentSupplementInFinderForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_reveal',
      segmentId: 'seg_reveal',
      supplementId: 'sup_reveal',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string,
      supplementId: string
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-segment-supplement-reveal-success');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_reveal');
      assert.equal(segmentId, 'seg_reveal');
      assert.equal(supplementId, 'sup_reveal');
      return {
        ok: true,
        value: {
          directoryAbsolute:
            '/tmp/reo-segment-supplement-reveal-success/memories/mem_reveal/segments/seg_reveal/supplements/sup_reveal',
          documentAbsolute:
            '/tmp/reo-segment-supplement-reveal-success/memories/mem_reveal/segments/seg_reveal/supplements/sup_reveal/supplement.md',
        },
      };
    },
    showItemInFolder: (filePath: string) => {
      shownPaths.push(filePath);
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(shownPaths, [
    '/tmp/reo-segment-supplement-reveal-success/memories/mem_reveal/segments/seg_reveal/supplements/sup_reveal',
  ]);
});

test('openMemorySpaceAgentsFile rejects untrusted sender and does not open the file', async () => {
  const openedPaths: string[] = [];
  const result = await handleOpenMemorySpaceAgentsFileForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    resolver: async () => ({
      ok: true,
      value: {
        rootAbsolute: '/tmp/reo-memory-space',
        agentsFileAbsolute: '/tmp/reo-memory-space/AGENTS.md',
      },
    }),
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(openedPaths, []);
});

test('openMemorySpaceAgentsFile rejects invalid request and does not open the file', async () => {
  const openedPaths: string[] = [];
  const result = await handleOpenMemorySpaceAgentsFileForTest({
    event,
    input: {
      workspaceId: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');
  }
  assert.deepEqual(openedPaths, []);
});

test('openMemorySpaceAgentsFile returns agents-file missing when the resolver cannot find AGENTS.md', async () => {
  const openedPaths: string[] = [];
  const result = await handleOpenMemorySpaceAgentsFileForTest({
    event,
    input: {
      workspaceId: 'ws_missing_agents',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    resolver: async (workspaceId: string, deps?: MemorySpaceResolverDepsForTest) => {
      assert.equal(workspaceId, 'ws_missing_agents');
      assert.equal(deps?.requireAgentsFile, true);
      return { ok: false, code: 'ERR_MEMORY_SPACE_AGENTS_FILE_MISSING' };
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_MEMORY_SPACE_AGENTS_FILE_MISSING');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(openedPaths, []);
});

test('openMemorySpaceAgentsFile returns shell-open failed when Electron cannot open the file', async () => {
  const openedPaths: string[] = [];
  const result = await handleOpenMemorySpaceAgentsFileForTest({
    event,
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    resolver: async () => ({
      ok: true,
      value: {
        rootAbsolute: '/tmp/reo-memory-space',
        agentsFileAbsolute: '/tmp/reo-memory-space/AGENTS.md',
      },
    }),
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return 'No application is associated with the specified file';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_SHELL_OPEN_FAILED');
  }
  assert.deepEqual(openedPaths, ['/tmp/reo-memory-space/AGENTS.md']);
});

test('openMemorySpaceAgentsFile opens the resolved AGENTS.md file', async () => {
  const openedPaths: string[] = [];
  const result = await handleOpenMemorySpaceAgentsFileForTest({
    event,
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    resolver: async (workspaceId: string, deps?: MemorySpaceResolverDepsForTest) => {
      assert.equal(workspaceId, 'ws_runtime_validated');
      assert.equal(deps?.requireAgentsFile, true);
      return {
        ok: true,
        value: {
          rootAbsolute: '/tmp/reo-memory-space-canonical',
          agentsFileAbsolute: '/tmp/reo-memory-space-canonical/AGENTS.md',
        },
      };
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(openedPaths, ['/tmp/reo-memory-space-canonical/AGENTS.md']);
});

test('copyMemorySpaceAbsolutePath rejects untrusted sender and does not write clipboard', async () => {
  const copiedText: string[] = [];
  const result = await handleCopyMemorySpaceAbsolutePathForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemorySpaceAbsolutePath rejects invalid request and does not write clipboard', async () => {
  const copiedText: string[] = [];
  const result = await handleCopyMemorySpaceAbsolutePathForTest({
    event,
    input: {
      workspaceId: '',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemorySpaceAbsolutePath returns root missing when the memory space cannot be resolved', async () => {
  const copiedText: string[] = [];
  const result = await handleCopyMemorySpaceAbsolutePathForTest({
    event,
    input: {
      workspaceId: 'ws_missing',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    resolver: async () => ({ ok: false, code: 'ERR_WORKSPACE_ROOT_MISSING' }),
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_ROOT_MISSING');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemorySpaceAbsolutePath returns clipboard-write failed when clipboard write throws', async () => {
  const copiedText: string[] = [];
  const result = await handleCopyMemorySpaceAbsolutePathForTest({
    event,
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    resolver: async () => ({
      ok: true,
      value: {
        rootAbsolute: '/tmp/reo-memory-space-canonical',
        agentsFileAbsolute: '/tmp/reo-memory-space-canonical/AGENTS.md',
      },
    }),
    writeText: (text: string) => {
      copiedText.push(text);
      throw new Error('clipboard offline');
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_CLIPBOARD_WRITE_FAILED');
  }
  assert.deepEqual(copiedText, ['/tmp/reo-memory-space-canonical']);
});

test('copyMemorySpaceAbsolutePath writes the resolved root absolute path to clipboard', async () => {
  const copiedText: string[] = [];
  const result = await handleCopyMemorySpaceAbsolutePathForTest({
    event,
    input: {
      workspaceId: 'ws_runtime_validated',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    resolver: async (workspaceId: string) => {
      assert.equal(workspaceId, 'ws_runtime_validated');
      return {
        ok: true,
        value: {
          rootAbsolute: '/tmp/reo-memory-space-canonical',
          agentsFileAbsolute: '/tmp/reo-memory-space-canonical/AGENTS.md',
        },
      };
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(copiedText, ['/tmp/reo-memory-space-canonical']);
});

test('copyMemoryAbsolutePath rejects untrusted sender and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-copy-untrusted');
  const copiedText: string[] = [];
  const result = await handleCopyMemoryAbsolutePathForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemoryAbsolutePath rejects invalid request and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-copy-invalid');
  const copiedText: string[] = [];
  const result = await handleCopyMemoryAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemoryAbsolutePath rejects a missing workspace handle and does not write clipboard', async () => {
  const copiedText: string[] = [];
  const result = await handleCopyMemoryAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'missing-handle',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createWorkspaceHandleStore(),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_NOT_FOUND');
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemoryAbsolutePath rejects a workspace id that does not match the handle', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-copy-mismatch');
  const copiedText: string[] = [];
  const result = await handleCopyMemoryAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_other',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH');
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemoryAbsolutePath rejects an unusable workspace handle and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-copy-lock-lost', () => false);
  const copiedText: string[] = [];
  const result = await handleCopyMemoryAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemoryAbsolutePath returns memory missing when the memory cannot be resolved', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-copy-missing');
  const copiedText: string[] = [];
  const result = await handleCopyMemoryAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_missing',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      deps?: MemoryResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-memory-copy-missing');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_missing');
      assert.equal(deps?.requireDocument, undefined);
      return { ok: false, code: 'ERR_WORKSPACE_MEMORY_NOT_FOUND' };
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_MEMORY_NOT_FOUND');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemoryAbsolutePath converts resolver throws to a typed error envelope', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-copy-resolver-throws');
  const copiedText: string[] = [];
  const result = await handleCopyMemoryAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('duplicate memory directory');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemoryAbsolutePath revalidates the resolved directory before clipboard write', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-copy-revalidate-directory');
  const copiedText: string[] = [];
  let resolverReturned = false;
  const result = await handleCopyMemoryAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    fs: {
      async exists() {
        return true;
      },
      async safeDirectory(directoryPath: string) {
        assert.equal(resolverReturned, true);
        assert.equal(directoryPath, '/tmp/reo-memory-copy-revalidate-directory/memories/mem_copy');
        return 'unsafe';
      },
    },
    resolver: async () => {
      resolverReturned = true;
      return {
        ok: true,
        value: {
          directoryAbsolute: '/tmp/reo-memory-copy-revalidate-directory/memories/mem_copy',
          documentAbsolute: '/tmp/reo-memory-copy-revalidate-directory/memories/mem_copy/memory.md',
        },
      };
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemoryAbsolutePath returns clipboard-write failed when clipboard write throws', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-copy-clipboard-failure');
  const copiedText: string[] = [];
  const result = await handleCopyMemoryAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => ({
      ok: true,
      value: {
        directoryAbsolute: '/tmp/reo-memory-copy-clipboard-failure/memories/mem_copy',
        documentAbsolute: '/tmp/reo-memory-copy-clipboard-failure/memories/mem_copy/memory.md',
      },
    }),
    writeText: (text: string) => {
      copiedText.push(text);
      throw new Error('clipboard offline');
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_CLIPBOARD_WRITE_FAILED');
  }
  assert.deepEqual(copiedText, ['/tmp/reo-memory-copy-clipboard-failure/memories/mem_copy']);
});

test('copyMemoryAbsolutePath writes the resolved memory directory absolute path to clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-copy-success');
  const copiedText: string[] = [];
  const result = await handleCopyMemoryAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      deps?: MemoryResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-memory-copy-success');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_copy');
      assert.equal(deps?.requireDocument, undefined);
      return {
        ok: true,
        value: {
          directoryAbsolute: '/tmp/reo-memory-copy-success/memories/mem_copy',
          documentAbsolute: '/tmp/reo-memory-copy-success/memories/mem_copy/memory.md',
        },
      };
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(copiedText, ['/tmp/reo-memory-copy-success/memories/mem_copy']);
});

test('copyMemoryRelativePath rejects untrusted sender and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-relative-untrusted');
  const copiedText: string[] = [];
  const result = await handleCopyMemoryRelativePathForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemoryRelativePath rejects invalid request and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-relative-invalid');
  const copiedText: string[] = [];
  const result = await handleCopyMemoryRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemoryRelativePath rejects a missing workspace handle and does not write clipboard', async () => {
  const copiedText: string[] = [];
  const result = await handleCopyMemoryRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'missing-handle',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createWorkspaceHandleStore(),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_NOT_FOUND');
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemoryRelativePath rejects a workspace id that does not match the handle', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-relative-mismatch');
  const copiedText: string[] = [];
  const result = await handleCopyMemoryRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_other',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH');
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemoryRelativePath rejects an unusable workspace handle and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore(
    '/tmp/reo-memory-relative-lock-lost',
    () => false
  );
  const copiedText: string[] = [];
  const result = await handleCopyMemoryRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemoryRelativePath returns memory missing when the memory cannot be resolved', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-relative-missing');
  const copiedText: string[] = [];
  const result = await handleCopyMemoryRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_missing',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      deps?: MemoryResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-memory-relative-missing');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_missing');
      assert.equal(deps?.requireDocument, undefined);
      return { ok: false, code: 'ERR_WORKSPACE_MEMORY_NOT_FOUND' };
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_MEMORY_NOT_FOUND');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(copiedText, []);
});

test('copyMemoryRelativePath returns clipboard-write failed when clipboard write throws', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-relative-clipboard-failure');
  const copiedText: string[] = [];
  const result = await handleCopyMemoryRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => ({
      ok: true,
      value: {
        directoryAbsolute: '/tmp/reo-memory-relative-clipboard-failure/memories/mem_copy',
        documentAbsolute: '/tmp/reo-memory-relative-clipboard-failure/memories/mem_copy/memory.md',
      },
    }),
    writeText: (text: string) => {
      copiedText.push(text);
      throw new Error('clipboard offline');
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_CLIPBOARD_WRITE_FAILED');
  }
  assert.deepEqual(copiedText, ['memories/mem_copy']);
});

test('copyMemoryRelativePath writes the resolved POSIX memory directory relative path to clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-relative-success');
  const copiedText: string[] = [];
  const result = await handleCopyMemoryRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      deps?: MemoryResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-memory-relative-success');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_copy');
      assert.equal(deps?.requireDocument, undefined);
      return {
        ok: true,
        value: {
          directoryAbsolute: '/tmp/reo-memory-relative-success/memories/mem_copy',
          documentAbsolute: '/tmp/reo-memory-relative-success/memories/mem_copy/memory.md',
        },
      };
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(copiedText, ['memories/mem_copy']);
});

test('copySegmentAbsolutePath rejects untrusted sender and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-copy-untrusted');
  const copiedText: string[] = [];
  const result = await handleCopySegmentAbsolutePathForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentAbsolutePath rejects a missing workspace handle and does not write clipboard', async () => {
  const copiedText: string[] = [];
  const result = await handleCopySegmentAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'missing-handle',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createWorkspaceHandleStore(),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_NOT_FOUND');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentAbsolutePath rejects a workspace id that does not match the handle', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-copy-mismatch');
  const copiedText: string[] = [];
  const result = await handleCopySegmentAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_other',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentAbsolutePath rejects an unusable workspace handle and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-copy-lock-lost', () => false);
  const copiedText: string[] = [];
  const result = await handleCopySegmentAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentAbsolutePath returns segment missing when the segment cannot be resolved', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-copy-missing');
  const copiedText: string[] = [];
  const result = await handleCopySegmentAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_missing',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string,
      deps?: SegmentResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-segment-copy-missing');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_copy');
      assert.equal(segmentId, 'seg_missing');
      assert.equal(deps?.requireDocument, undefined);
      return { ok: false, code: 'ERR_WORKSPACE_SEGMENT_NOT_FOUND' };
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_SEGMENT_NOT_FOUND');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentAbsolutePath returns clipboard-write failed when clipboard write throws', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-copy-clipboard-failure');
  const copiedText: string[] = [];
  const result = await handleCopySegmentAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => ({
      ok: true,
      value: {
        directoryAbsolute:
          '/tmp/reo-segment-copy-clipboard-failure/memories/mem_copy/segments/seg_copy',
        documentAbsolute:
          '/tmp/reo-segment-copy-clipboard-failure/memories/mem_copy/segments/seg_copy/segment.md',
      },
    }),
    writeText: (text: string) => {
      copiedText.push(text);
      throw new Error('clipboard offline');
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_CLIPBOARD_WRITE_FAILED');
  }
  assert.deepEqual(copiedText, [
    '/tmp/reo-segment-copy-clipboard-failure/memories/mem_copy/segments/seg_copy',
  ]);
});

test('copySegmentAbsolutePath writes the resolved segment directory absolute path to clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-copy-success');
  const copiedText: string[] = [];
  const result = await handleCopySegmentAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string,
      deps?: SegmentResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-segment-copy-success');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_copy');
      assert.equal(segmentId, 'seg_copy');
      assert.equal(deps?.requireDocument, undefined);
      return {
        ok: true,
        value: {
          directoryAbsolute: '/tmp/reo-segment-copy-success/memories/mem_copy/segments/seg_copy',
          documentAbsolute:
            '/tmp/reo-segment-copy-success/memories/mem_copy/segments/seg_copy/segment.md',
        },
      };
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(copiedText, [
    '/tmp/reo-segment-copy-success/memories/mem_copy/segments/seg_copy',
  ]);
});

test('copySegmentRelativePath rejects untrusted sender and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-relative-untrusted');
  const copiedText: string[] = [];
  const result = await handleCopySegmentRelativePathForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentRelativePath rejects invalid request and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-relative-invalid');
  const copiedText: string[] = [];
  const result = await handleCopySegmentRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentRelativePath rejects a missing workspace handle and does not write clipboard', async () => {
  const copiedText: string[] = [];
  const result = await handleCopySegmentRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'missing-handle',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createWorkspaceHandleStore(),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_NOT_FOUND');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentRelativePath rejects a workspace id that does not match the handle', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-relative-mismatch');
  const copiedText: string[] = [];
  const result = await handleCopySegmentRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_other',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentRelativePath rejects an unusable workspace handle and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore(
    '/tmp/reo-segment-relative-lock-lost',
    () => false
  );
  const copiedText: string[] = [];
  const result = await handleCopySegmentRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentRelativePath returns segment missing when the segment cannot be resolved', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-relative-missing');
  const copiedText: string[] = [];
  const result = await handleCopySegmentRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_missing',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string,
      deps?: SegmentResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-segment-relative-missing');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_copy');
      assert.equal(segmentId, 'seg_missing');
      assert.equal(deps?.requireDocument, undefined);
      return { ok: false, code: 'ERR_WORKSPACE_SEGMENT_NOT_FOUND' };
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_SEGMENT_NOT_FOUND');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentRelativePath returns clipboard-write failed when clipboard write throws', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-relative-clipboard-failure');
  const copiedText: string[] = [];
  const result = await handleCopySegmentRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => ({
      ok: true,
      value: {
        directoryAbsolute:
          '/tmp/reo-segment-relative-clipboard-failure/memories/mem_copy/segments/seg_copy',
        documentAbsolute:
          '/tmp/reo-segment-relative-clipboard-failure/memories/mem_copy/segments/seg_copy/segment.md',
      },
    }),
    writeText: (text: string) => {
      copiedText.push(text);
      throw new Error('clipboard offline');
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_CLIPBOARD_WRITE_FAILED');
  }
  assert.equal(
    JSON.stringify(result).includes('/tmp/reo-segment-relative-clipboard-failure'),
    false
  );
  assert.deepEqual(copiedText, ['memories/mem_copy/segments/seg_copy']);
});

test('copySegmentRelativePath writes the resolved POSIX segment directory relative path to clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-relative-success');
  const copiedText: string[] = [];
  const result = await handleCopySegmentRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string,
      deps?: SegmentResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-segment-relative-success');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_copy');
      assert.equal(segmentId, 'seg_copy');
      assert.equal(deps?.requireDocument, undefined);
      return {
        ok: true,
        value: {
          directoryAbsolute:
            '/tmp/reo-segment-relative-success/memories/mem_copy/segments/seg_copy',
          documentAbsolute:
            '/tmp/reo-segment-relative-success/memories/mem_copy/segments/seg_copy/segment.md',
        },
      };
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(JSON.stringify(result).includes('/tmp/reo-segment-relative-success'), false);
  assert.deepEqual(copiedText, ['memories/mem_copy/segments/seg_copy']);
});

test('copySegmentSupplementAbsolutePath rejects untrusted sender and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-copy-untrusted');
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementAbsolutePathForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
      supplementId: 'sup_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentSupplementAbsolutePath rejects invalid request and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-copy-invalid');
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentSupplementAbsolutePath rejects a missing workspace handle and does not write clipboard', async () => {
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'missing-handle',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
      supplementId: 'sup_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createWorkspaceHandleStore(),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_NOT_FOUND');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentSupplementAbsolutePath rejects a workspace id that does not match the handle', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-copy-mismatch');
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_other',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
      supplementId: 'sup_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentSupplementAbsolutePath rejects an unusable workspace handle and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore(
    '/tmp/reo-supplement-copy-lock-lost',
    () => false
  );
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
      supplementId: 'sup_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentSupplementAbsolutePath returns supplement missing when the supplement cannot be resolved', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-copy-missing');
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
      supplementId: 'sup_missing',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string,
      supplementId: string,
      deps?: SegmentSupplementResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-supplement-copy-missing');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_copy');
      assert.equal(segmentId, 'seg_copy');
      assert.equal(supplementId, 'sup_missing');
      assert.equal(deps?.requireDocument, undefined);
      return { ok: false, code: 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND' };
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentSupplementAbsolutePath returns clipboard-write failed when clipboard write throws', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-copy-clipboard-failure');
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
      supplementId: 'sup_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => ({
      ok: true,
      value: {
        directoryAbsolute:
          '/tmp/reo-supplement-copy-clipboard-failure/memories/mem_copy/segments/seg_copy/supplements/sup_copy',
        documentAbsolute:
          '/tmp/reo-supplement-copy-clipboard-failure/memories/mem_copy/segments/seg_copy/supplements/sup_copy/supplement.md',
      },
    }),
    writeText: (text: string) => {
      copiedText.push(text);
      throw new Error('clipboard offline');
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_CLIPBOARD_WRITE_FAILED');
  }
  assert.deepEqual(copiedText, [
    '/tmp/reo-supplement-copy-clipboard-failure/memories/mem_copy/segments/seg_copy/supplements/sup_copy',
  ]);
});

test('copySegmentSupplementAbsolutePath writes the resolved supplement directory absolute path to clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-copy-success');
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementAbsolutePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
      supplementId: 'sup_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string,
      supplementId: string,
      deps?: SegmentSupplementResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-supplement-copy-success');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_copy');
      assert.equal(segmentId, 'seg_copy');
      assert.equal(supplementId, 'sup_copy');
      assert.equal(deps?.requireDocument, undefined);
      return {
        ok: true,
        value: {
          directoryAbsolute:
            '/tmp/reo-supplement-copy-success/memories/mem_copy/segments/seg_copy/supplements/sup_copy',
          documentAbsolute:
            '/tmp/reo-supplement-copy-success/memories/mem_copy/segments/seg_copy/supplements/sup_copy/supplement.md',
        },
      };
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(copiedText, [
    '/tmp/reo-supplement-copy-success/memories/mem_copy/segments/seg_copy/supplements/sup_copy',
  ]);
});

test('copySegmentSupplementRelativePath rejects untrusted sender and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-relative-untrusted');
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementRelativePathForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
      supplementId: 'sup_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentSupplementRelativePath rejects invalid request and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-relative-invalid');
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_INVALID_REQUEST');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentSupplementRelativePath rejects a missing workspace handle and does not write clipboard', async () => {
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'missing-handle',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
      supplementId: 'sup_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createWorkspaceHandleStore(),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_NOT_FOUND');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentSupplementRelativePath rejects a workspace id that does not match the handle', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-relative-mismatch');
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_other',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
      supplementId: 'sup_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentSupplementRelativePath rejects an unusable workspace handle and does not write clipboard', async () => {
  const handleStore = createRegisteredHandleStore(
    '/tmp/reo-supplement-relative-lock-lost',
    () => false
  );
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
      supplementId: 'sup_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentSupplementRelativePath returns supplement missing when the supplement cannot be resolved', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-relative-missing');
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
      supplementId: 'sup_missing',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string,
      supplementId: string,
      deps?: SegmentSupplementResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-supplement-relative-missing');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_copy');
      assert.equal(segmentId, 'seg_copy');
      assert.equal(supplementId, 'sup_missing');
      assert.equal(deps?.requireDocument, undefined);
      return { ok: false, code: 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND' };
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(copiedText, []);
});

test('copySegmentSupplementRelativePath returns clipboard-write failed when clipboard write throws', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-relative-clipboard-failure');
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
      supplementId: 'sup_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => ({
      ok: true,
      value: {
        directoryAbsolute:
          '/tmp/reo-supplement-relative-clipboard-failure/memories/mem_copy/segments/seg_copy/supplements/sup_copy',
        documentAbsolute:
          '/tmp/reo-supplement-relative-clipboard-failure/memories/mem_copy/segments/seg_copy/supplements/sup_copy/supplement.md',
      },
    }),
    writeText: (text: string) => {
      copiedText.push(text);
      throw new Error('clipboard offline');
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_CLIPBOARD_WRITE_FAILED');
  }
  assert.equal(
    JSON.stringify(result).includes('/tmp/reo-supplement-relative-clipboard-failure'),
    false
  );
  assert.deepEqual(copiedText, ['memories/mem_copy/segments/seg_copy/supplements/sup_copy']);
});

test('copySegmentSupplementRelativePath writes the resolved POSIX supplement directory relative path to clipboard', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-relative-success');
  const copiedText: string[] = [];
  const result = await handleCopySegmentSupplementRelativePathForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_copy',
      segmentId: 'seg_copy',
      supplementId: 'sup_copy',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string,
      supplementId: string,
      deps?: SegmentSupplementResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-supplement-relative-success');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_copy');
      assert.equal(segmentId, 'seg_copy');
      assert.equal(supplementId, 'sup_copy');
      assert.equal(deps?.requireDocument, undefined);
      return {
        ok: true,
        value: {
          directoryAbsolute:
            '/tmp/reo-supplement-relative-success/memories/mem_copy/segments/seg_copy/supplements/sup_copy',
          documentAbsolute:
            '/tmp/reo-supplement-relative-success/memories/mem_copy/segments/seg_copy/supplements/sup_copy/supplement.md',
        },
      };
    },
    writeText: (text: string) => {
      copiedText.push(text);
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(JSON.stringify(result).includes('/tmp/reo-supplement-relative-success'), false);
  assert.deepEqual(copiedText, ['memories/mem_copy/segments/seg_copy/supplements/sup_copy']);
});

test('openMemoryDocument rejects untrusted sender and does not open the file', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-document-untrusted');
  const openedPaths: string[] = [];
  const result = await handleOpenMemoryDocumentForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(openedPaths, []);
});

test('openMemoryDocument rejects a missing workspace handle and does not open the file', async () => {
  const openedPaths: string[] = [];
  const result = await handleOpenMemoryDocumentForTest({
    event,
    input: {
      workspaceHandle: 'missing-handle',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createWorkspaceHandleStore(),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_NOT_FOUND');
  }
  assert.deepEqual(openedPaths, []);
});

test('openMemoryDocument rejects a workspace id that does not match the handle', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-document-mismatch');
  const openedPaths: string[] = [];
  const result = await handleOpenMemoryDocumentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_other',
      memoryId: 'mem_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH');
  }
  assert.deepEqual(openedPaths, []);
});

test('openMemoryDocument returns document missing when the resolver cannot find memory.md', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-document-missing');
  const openedPaths: string[] = [];
  const result = await handleOpenMemoryDocumentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_missing_document',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      deps?: MemoryResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-memory-document-missing');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_missing_document');
      assert.equal(deps?.requireDocument, true);
      return { ok: false, code: 'ERR_ENTITY_DOCUMENT_MISSING' };
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_ENTITY_DOCUMENT_MISSING');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(openedPaths, []);
});

test('openMemoryDocument revalidates the resolved markdown file before shell open', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-document-revalidate-file');
  const openedPaths: string[] = [];
  let resolverReturned = false;
  const result = await handleOpenMemoryDocumentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    fs: {
      async exists() {
        return true;
      },
      async safeFile(filePath: string) {
        assert.equal(resolverReturned, true);
        assert.equal(
          filePath,
          '/tmp/reo-memory-document-revalidate-file/memories/mem_open/memory.md'
        );
        return 'unsafe';
      },
    },
    resolver: async () => {
      resolverReturned = true;
      return {
        ok: true,
        value: {
          directoryAbsolute: '/tmp/reo-memory-document-revalidate-file/memories/mem_open',
          documentAbsolute: '/tmp/reo-memory-document-revalidate-file/memories/mem_open/memory.md',
        },
      };
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  assert.deepEqual(openedPaths, []);
});

test('openMemoryDocument returns shell-open failed when Electron cannot open memory.md', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-document-shell-failure');
  const openedPaths: string[] = [];
  const result = await handleOpenMemoryDocumentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => ({
      ok: true,
      value: {
        directoryAbsolute: '/tmp/reo-memory-document-shell-failure/memories/mem_open',
        documentAbsolute: '/tmp/reo-memory-document-shell-failure/memories/mem_open/memory.md',
      },
    }),
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return 'No application is associated with the specified file';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_SHELL_OPEN_FAILED');
  }
  assert.deepEqual(openedPaths, [
    '/tmp/reo-memory-document-shell-failure/memories/mem_open/memory.md',
  ]);
});

test('openMemoryDocument opens the resolved memory.md file', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-memory-document-success');
  const openedPaths: string[] = [];
  const result = await handleOpenMemoryDocumentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      deps?: MemoryResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-memory-document-success');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_open');
      assert.equal(deps?.requireDocument, true);
      return {
        ok: true,
        value: {
          directoryAbsolute: '/tmp/reo-memory-document-success/memories/mem_open',
          documentAbsolute: '/tmp/reo-memory-document-success/memories/mem_open/memory.md',
        },
      };
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(openedPaths, ['/tmp/reo-memory-document-success/memories/mem_open/memory.md']);
});

test('openSegmentDocument rejects untrusted sender and does not open the file', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-document-untrusted');
  const openedPaths: string[] = [];
  const result = await handleOpenSegmentDocumentForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
      segmentId: 'seg_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(openedPaths, []);
});

test('openSegmentDocument rejects a missing workspace handle and does not open the file', async () => {
  const openedPaths: string[] = [];
  const result = await handleOpenSegmentDocumentForTest({
    event,
    input: {
      workspaceHandle: 'missing-handle',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
      segmentId: 'seg_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createWorkspaceHandleStore(),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_NOT_FOUND');
  }
  assert.deepEqual(openedPaths, []);
});

test('openSegmentDocument rejects a workspace id that does not match the handle', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-document-mismatch');
  const openedPaths: string[] = [];
  const result = await handleOpenSegmentDocumentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_other',
      memoryId: 'mem_open',
      segmentId: 'seg_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH');
  }
  assert.deepEqual(openedPaths, []);
});

test('openSegmentDocument returns document missing when the resolver cannot find segment.md', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-document-missing');
  const openedPaths: string[] = [];
  const result = await handleOpenSegmentDocumentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
      segmentId: 'seg_missing_document',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string,
      deps?: SegmentResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-segment-document-missing');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_open');
      assert.equal(segmentId, 'seg_missing_document');
      assert.equal(deps?.requireDocument, true);
      return { ok: false, code: 'ERR_ENTITY_DOCUMENT_MISSING' };
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_ENTITY_DOCUMENT_MISSING');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(openedPaths, []);
});

test('openSegmentDocument returns shell-open failed when Electron cannot open segment.md', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-document-shell-failure');
  const openedPaths: string[] = [];
  const result = await handleOpenSegmentDocumentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
      segmentId: 'seg_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => ({
      ok: true,
      value: {
        directoryAbsolute:
          '/tmp/reo-segment-document-shell-failure/memories/mem_open/segments/seg_open',
        documentAbsolute:
          '/tmp/reo-segment-document-shell-failure/memories/mem_open/segments/seg_open/segment.md',
      },
    }),
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return 'No application is associated with the specified file';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_SHELL_OPEN_FAILED');
  }
  assert.deepEqual(openedPaths, [
    '/tmp/reo-segment-document-shell-failure/memories/mem_open/segments/seg_open/segment.md',
  ]);
});

test('openSegmentDocument opens the resolved segment.md file', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-segment-document-success');
  const openedPaths: string[] = [];
  const result = await handleOpenSegmentDocumentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
      segmentId: 'seg_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string,
      deps?: SegmentResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-segment-document-success');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_open');
      assert.equal(segmentId, 'seg_open');
      assert.equal(deps?.requireDocument, true);
      return {
        ok: true,
        value: {
          directoryAbsolute:
            '/tmp/reo-segment-document-success/memories/mem_open/segments/seg_open',
          documentAbsolute:
            '/tmp/reo-segment-document-success/memories/mem_open/segments/seg_open/segment.md',
        },
      };
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(openedPaths, [
    '/tmp/reo-segment-document-success/memories/mem_open/segments/seg_open/segment.md',
  ]);
});

test('openSegmentSupplementDocument rejects untrusted sender and does not open the file', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-document-untrusted');
  const openedPaths: string[] = [];
  const result = await handleOpenSegmentSupplementDocumentForTest({
    event: {
      ...event,
      senderFrame: {
        routingId: 4,
        topRoutingId: 4,
        url: 'https://example.invalid/',
      },
    },
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
      segmentId: 'seg_open',
      supplementId: 'sup_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNTRUSTED_SENDER');
  }
  assert.deepEqual(openedPaths, []);
});

test('openSegmentSupplementDocument rejects a missing workspace handle and does not open the file', async () => {
  const openedPaths: string[] = [];
  const result = await handleOpenSegmentSupplementDocumentForTest({
    event,
    input: {
      workspaceHandle: 'missing-handle',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
      segmentId: 'seg_open',
      supplementId: 'sup_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore: createWorkspaceHandleStore(),
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_NOT_FOUND');
  }
  assert.deepEqual(openedPaths, []);
});

test('openSegmentSupplementDocument rejects a workspace id that does not match the handle', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-document-mismatch');
  const openedPaths: string[] = [];
  const result = await handleOpenSegmentSupplementDocumentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_other',
      memoryId: 'mem_open',
      segmentId: 'seg_open',
      supplementId: 'sup_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => {
      throw new Error('resolver should not be called');
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH');
  }
  assert.deepEqual(openedPaths, []);
});

test('openSegmentSupplementDocument returns document missing when the resolver cannot find supplement.md', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-document-missing');
  const openedPaths: string[] = [];
  const result = await handleOpenSegmentSupplementDocumentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
      segmentId: 'seg_open',
      supplementId: 'sup_missing_document',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string,
      supplementId: string,
      deps?: SegmentSupplementResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-supplement-document-missing');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_open');
      assert.equal(segmentId, 'seg_open');
      assert.equal(supplementId, 'sup_missing_document');
      assert.equal(deps?.requireDocument, true);
      return { ok: false, code: 'ERR_ENTITY_DOCUMENT_MISSING' };
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_ENTITY_DOCUMENT_MISSING');
    assert.equal('dataRetention' in result.error, false);
  }
  assert.deepEqual(openedPaths, []);
});

test('openSegmentSupplementDocument returns shell-open failed when Electron cannot open supplement.md', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-document-shell-failure');
  const openedPaths: string[] = [];
  const result = await handleOpenSegmentSupplementDocumentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
      segmentId: 'seg_open',
      supplementId: 'sup_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async () => ({
      ok: true,
      value: {
        directoryAbsolute:
          '/tmp/reo-supplement-document-shell-failure/memories/mem_open/segments/seg_open/supplements/sup_open',
        documentAbsolute:
          '/tmp/reo-supplement-document-shell-failure/memories/mem_open/segments/seg_open/supplements/sup_open/supplement.md',
      },
    }),
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return 'No application is associated with the specified file';
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_SHELL_OPEN_FAILED');
  }
  assert.deepEqual(openedPaths, [
    '/tmp/reo-supplement-document-shell-failure/memories/mem_open/segments/seg_open/supplements/sup_open/supplement.md',
  ]);
});

test('openSegmentSupplementDocument opens the resolved supplement.md file', async () => {
  const handleStore = createRegisteredHandleStore('/tmp/reo-supplement-document-success');
  const openedPaths: string[] = [];
  const result = await handleOpenSegmentSupplementDocumentForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_open',
      segmentId: 'seg_open',
      supplementId: 'sup_open',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
    resolver: async (
      handle: { readonly canonicalRoot: string; readonly workspaceId: string },
      workspaceId: string,
      memoryId: string,
      segmentId: string,
      supplementId: string,
      deps?: SegmentSupplementResolverDepsForTest
    ) => {
      assert.equal(handle.canonicalRoot, '/tmp/reo-supplement-document-success');
      assert.equal(handle.workspaceId, 'ws_ipc');
      assert.equal(workspaceId, 'ws_ipc');
      assert.equal(memoryId, 'mem_open');
      assert.equal(segmentId, 'seg_open');
      assert.equal(supplementId, 'sup_open');
      assert.equal(deps?.requireDocument, true);
      return {
        ok: true,
        value: {
          directoryAbsolute:
            '/tmp/reo-supplement-document-success/memories/mem_open/segments/seg_open/supplements/sup_open',
          documentAbsolute:
            '/tmp/reo-supplement-document-success/memories/mem_open/segments/seg_open/supplements/sup_open/supplement.md',
        },
      };
    },
    openPath: async (filePath: string) => {
      openedPaths.push(filePath);
      return '';
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(openedPaths, [
    '/tmp/reo-supplement-document-success/memories/mem_open/segments/seg_open/supplements/sup_open/supplement.md',
  ]);
});

test('removeMemorySpace removes a persisted memory space without resolving or deleting its folder', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-memorySpace-remove-'));
  const registryPath = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-space-remove-registry-')),
    'registry.json'
  );
  const memorySpaceRegistry = createWorkspaceMemorySpaceRegistry({
    registryPath,
    now: () => '2026-05-08T07:49:00.000Z',
  });
  await initializeWorkspaceFiles({
    rootPath,
    title: '测试1',
    description: '',
    createWorkspaceId: () => 'ws_test_1',
    now: () => '2026-05-08T07:47:00.000Z',
  });
  await memorySpaceRegistry.upsertMemorySpace({
    canonicalRoot: rootPath,
    snapshot: {
      workspaceId: 'ws_test_1',
      title: '测试1',
      description: '',
      memories: [],
    },
  });

  const result = await handleRemoveMemorySpaceForTest({
    event,
    input: {
      workspaceId: 'ws_test_1',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    memorySpaceRegistry,
  });

  assert.deepEqual(result, { ok: true, value: { removed: true } });
  assert.deepEqual(await memorySpaceRegistry.listMemorySpaces(), []);
  assert.equal((await stat(path.join(rootPath, '.reo'))).isDirectory(), true);
});

test('openWorkspace releases the lock when post-lock recovery or index writes throw', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-throw-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_throw',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await rm(path.join(rootPath, '.reo', 'index.json'), { force: true });
  await mkdir(path.join(rootPath, '.reo', 'index.json'));
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-throw',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-throw',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
  });

  assert.equal(result.ok, false);
  await assertWorkspaceLockCanBeReacquired(rootPath);
});

test('openWorkspace rejects lock identity loss before workspace files are opened', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-lock-lost-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-lock-lost',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspaceForTest({
    event,
    input: {
      selectionToken: 'selection-token-open-lock-lost',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    afterWorkspaceLockAcquiredForTest: async () => {
      await rename(path.join(rootPath, '.reo'), path.join(rootPath, '.reo-preserved'));
      await mkdir(path.join(rootPath, '.reo'));
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await assert.rejects(stat(path.join(rootPath, '.reo', 'index.json')));
});

test('openWorkspace rejects lock identity loss during index reconciliation', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-mid-lock-lost-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_mid_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_open_mid_lock_lost',
    memoryId: 'mem_open_mid_lock_lost',
    segmentId: 'seg_open_mid_lock_lost',
    title: 'Open mid lock lost',
  });
  await writeFile(path.join(rootPath, '.reo', 'index.json'), '{not json');
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-mid-lock-lost',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });
  setBeforeWorkspaceIndexReconciliationPersistForTest(async () => {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
    await rename(path.join(rootPath, '.reo'), path.join(rootPath, '.reo-preserved'));
    await mkdir(path.join(rootPath, '.reo'));
  });

  try {
    const result = await handleOpenWorkspaceForTest({
      event,
      input: {
        selectionToken: 'selection-token-open-mid-lock-lost',
      },
      expectedSession,
      expectedSessionKey: 'default',
      isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
      tokenStore,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
  } finally {
    setBeforeWorkspaceIndexReconciliationPersistForTest(null);
  }
  await assert.rejects(stat(path.join(rootPath, '.reo', 'index.json')));
});

test('openWorkspace releases the lock when handle registration throws', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-handle-throw-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_handle_throw',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const tokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-handle-throw',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  tokenStore.issueSelection({ rootPath, displayPath: path.basename(rootPath), sender });

  const result = await handleOpenWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-open-handle-throw',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore,
    handleStore: createWorkspaceHandleStore({
      createHandle: () => {
        throw new Error('handle boom');
      },
    }),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_OPEN_FAILED');
  }
  await assertWorkspaceLockCanBeReacquired(rootPath);
});

test('openWorkspace rejects unsafe child directories before writing a workspace lock', async () => {
  const memoriesRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-memories-link-'));
  await initializeWorkspaceFiles({
    rootPath: memoriesRoot,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_memories_link',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const outsideMemories = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-memories-outside-'));
  await rm(path.join(memoriesRoot, 'memories'), { recursive: true });
  await symlink(outsideMemories, path.join(memoriesRoot, 'memories'));
  const memoriesTokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-memories-link',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  memoriesTokenStore.issueSelection({
    rootPath: memoriesRoot,
    displayPath: path.basename(memoriesRoot),
    sender,
  });

  const memoriesResult = await handleOpenWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-open-memories-link',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore: memoriesTokenStore,
  });

  assert.equal(memoriesResult.ok, false);
  if (!memoriesResult.ok) {
    assert.equal(memoriesResult.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    assert.equal(memoriesResult.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(memoriesRoot, '.reo', 'workspace.lock')));

  const draftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-drafts-link-'));
  await initializeWorkspaceFiles({
    rootPath: draftsRoot,
    title: '已有 workspace',
    description: '',
    createWorkspaceId: () => 'ws_open_drafts_link',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const outsideDrafts = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-open-drafts-outside-'));
  await rm(path.join(draftsRoot, '.reo', 'drafts'), { recursive: true });
  await symlink(outsideDrafts, path.join(draftsRoot, '.reo', 'drafts'));
  const draftsTokenStore = createWorkspaceSelectionTokenStore({
    createToken: () => 'selection-token-open-drafts-link',
    now: () => 1_000,
    ttlMs: 5_000,
  });
  draftsTokenStore.issueSelection({
    rootPath: draftsRoot,
    displayPath: path.basename(draftsRoot),
    sender,
  });

  const draftsResult = await handleOpenWorkspace({
    event,
    input: {
      selectionToken: 'selection-token-open-drafts-link',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    tokenStore: draftsTokenStore,
  });

  assert.equal(draftsResult.ok, false);
  if (!draftsResult.ok) {
    assert.equal(draftsResult.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    assert.equal(draftsResult.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(draftsRoot, '.reo', 'workspace.lock')));
  await assert.rejects(stat(path.join(outsideDrafts, 'segments')));
});

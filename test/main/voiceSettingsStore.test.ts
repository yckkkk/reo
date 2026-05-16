import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createVoiceSettingsStore,
  getVoiceSettingsFilePath,
  type VoiceSettingsFile,
} from '../../src/main/voiceSettingsStore.js';

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

function setup() {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'reo-voice-settings-'));
  const safeStorage = makeFakeSafeStorage();
  const atomicWrites: string[] = [];
  const store = createVoiceSettingsStore({
    safeStorage,
    userDataDir,
    platform: 'linux',
    writeJsonAtomic: async (filePath: string, value: unknown) => {
      atomicWrites.push(filePath);
      writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    },
  });
  return {
    userDataDir,
    safeStorage,
    atomicWrites,
    store,
    filePath: getVoiceSettingsFilePath(userDataDir),
    cleanup: () => rmSync(userDataDir, { recursive: true, force: true }),
  };
}

test('voiceSettingsStore: read returns disabled default when userData file is missing', () => {
  const { store, cleanup } = setup();
  try {
    assert.deepEqual(store.read(), {
      enabled: false,
      apiKeyConfigured: false,
      apiKeyLastFour: null,
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: writeApiKey encrypts into application userData JSON and reads decrypted key', async () => {
  const { store, filePath, userDataDir, atomicWrites, cleanup } = setup();
  try {
    await store.writeApiKey('abcd1234EFGH5678');

    assert.deepEqual(atomicWrites, [filePath]);
    assert.equal(filePath, path.join(userDataDir, 'voice-transcription-settings.json'));
    assert.equal(store.readDecryptedApiKey(), 'abcd1234EFGH5678');
    assert.deepEqual(store.read(), {
      enabled: false,
      apiKeyConfigured: true,
      apiKeyLastFour: '5678',
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });

    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as VoiceSettingsFile;
    assert.equal(raw.apiKeyCiphertext, Buffer.from('enc:abcd1234EFGH5678').toString('base64'));
    assert.doesNotMatch(JSON.stringify(raw), /abcd1234EFGH5678/);
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: setEnabled and clearApiKey keep enabled independent from key state', async () => {
  const { store, cleanup } = setup();
  try {
    await store.setEnabled(true);
    await store.writeApiKey('xxxx1234');
    await store.recordValidation({ code: 'ok' });
    await store.clearApiKey();

    assert.deepEqual(store.read(), {
      enabled: true,
      apiKeyConfigured: false,
      apiKeyLastFour: null,
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });

    await store.setEnabled(false);
    assert.equal(store.read().enabled, false);
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: corrupted JSON falls back to default disabled snapshot', () => {
  const { userDataDir, filePath, cleanup } = setup();
  try {
    writeFileSync(filePath, '{not json', 'utf8');
    const store = createVoiceSettingsStore({
      safeStorage: makeFakeSafeStorage(),
      userDataDir,
      platform: 'linux',
    });

    assert.equal(store.read().enabled, false);
    assert.equal(store.read().apiKeyConfigured, false);
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: decrypt failure returns null and does not leak ciphertext in snapshot', async () => {
  const { store, filePath, cleanup } = setup();
  try {
    await store.writeApiKey('abcd1234');
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as VoiceSettingsFile;
    raw.apiKeyCiphertext = Buffer.from('not decryptable').toString('base64');
    writeFileSync(filePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const reloaded = createVoiceSettingsStore({
      safeStorage: makeFakeSafeStorage(),
      userDataDir: path.dirname(filePath),
      platform: 'linux',
    });

    assert.equal(reloaded.readDecryptedApiKey(), null);
    assert.deepEqual(reloaded.read(), {
      enabled: false,
      apiKeyConfigured: true,
      apiKeyLastFour: '1234',
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: writeApiKey requires secure safeStorage and at least four characters', async () => {
  const { store, safeStorage, cleanup } = setup();
  try {
    await assert.rejects(() => store.writeApiKey('abc'), /apiKey must be at least 4 characters/);

    safeStorage.setAvailable(false);
    await assert.rejects(() => store.writeApiKey('abcd'), /safeStorage unavailable/);

    safeStorage.setAvailable(true);
    safeStorage.setBackend('basic_text');
    await assert.rejects(() => store.writeApiKey('abcd'), /safeStorage unavailable/);

    safeStorage.setBackend('unknown');
    await assert.rejects(() => store.writeApiKey('abcd'), /safeStorage unavailable/);
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: readDecryptedApiKey returns null when secure safeStorage is unavailable', async () => {
  const { store, safeStorage, cleanup } = setup();
  try {
    await store.writeApiKey('abcd1234');

    safeStorage.setAvailable(false);
    assert.equal(store.readDecryptedApiKey(), null);

    safeStorage.setAvailable(true);
    safeStorage.setBackend('basic_text');
    assert.equal(store.readDecryptedApiKey(), null);
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: recordValidation maps ok auth and network to tri-state snapshot', async () => {
  const { store, cleanup } = setup();
  try {
    await store.recordValidation({ code: 'ok' });
    assert.equal(store.read().lastValidationOk, true);
    assert.equal(store.read().lastValidationCode, 'ok');
    assert.match(store.read().lastValidatedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);

    await store.recordValidation({ code: 'auth' });
    assert.equal(store.read().lastValidationOk, false);
    assert.equal(store.read().lastValidationCode, 'auth');

    await store.recordValidation({ code: 'network' });
    assert.equal(store.read().lastValidationOk, null);
    assert.equal(store.read().lastValidationCode, 'network');
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: serializes concurrent writes against the latest cache', async () => {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'reo-voice-settings-'));
  const safeStorage = makeFakeSafeStorage();
  const writes: Array<() => void> = [];
  const store = createVoiceSettingsStore({
    safeStorage,
    userDataDir,
    platform: 'linux',
    writeJsonAtomic: (filePath: string, value: unknown) =>
      new Promise<void>((resolve) => {
        writes.push(() => {
          writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
          resolve();
        });
      }),
  });

  try {
    const enablePromise = store.setEnabled(true);
    const keyPromise = store.writeApiKey('abcd1234');

    await Promise.resolve();
    await Promise.resolve();
    assert.equal(writes.length, 1);
    writes.shift()?.();
    await enablePromise;

    await Promise.resolve();
    await Promise.resolve();
    assert.equal(writes.length, 1);
    writes.shift()?.();
    await keyPromise;

    assert.deepEqual(store.read(), {
      enabled: true,
      apiKeyConfigured: true,
      apiKeyLastFour: '1234',
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });
  } finally {
    rmSync(userDataDir, { recursive: true, force: true });
  }
});

test('voiceSettingsStore: ignores oversized settings files during startup', () => {
  const { userDataDir, filePath, cleanup } = setup();
  try {
    writeFileSync(filePath, JSON.stringify({ junk: 'x'.repeat(70_000) }), 'utf8');

    const store = createVoiceSettingsStore({
      safeStorage: makeFakeSafeStorage(),
      userDataDir,
      platform: 'linux',
    });

    assert.deepEqual(store.read(), {
      enabled: false,
      apiKeyConfigured: false,
      apiKeyLastFour: null,
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });
  } finally {
    cleanup();
  }
});

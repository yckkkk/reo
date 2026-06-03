import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createVoiceSettingsStore,
  getVoiceSettingsFilePath,
  type VoiceSettingsSnapshot,
  type VoiceSettingsFile,
} from '../../src/main/voiceSettingsStore.js';

const DEFAULT_SPEECH_SYNTHESIS_SPEAKER = 'zh_female_vv_uranus_bigtts';

function voiceSettingsSnapshot(
  overrides: Partial<VoiceSettingsSnapshot> = {}
): VoiceSettingsSnapshot {
  return {
    enabled: false,
    apiKeyConfigured: false,
    apiKeyLastFour: null,
    speechSynthesisSpeaker: DEFAULT_SPEECH_SYNTHESIS_SPEAKER,
    lastTranscriptionValidatedAt: null,
    lastTranscriptionValidationOk: null,
    lastTranscriptionValidationCode: null,
    lastSpeechSynthesisValidatedAt: null,
    lastSpeechSynthesisValidationOk: null,
    lastSpeechSynthesisValidationCode: null,
    ...overrides,
  };
}

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
    assert.deepEqual(store.read(), voiceSettingsSnapshot());
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
    assert.deepEqual(
      store.read(),
      voiceSettingsSnapshot({ apiKeyConfigured: true, apiKeyLastFour: '5678' })
    );

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
    await store.recordTranscriptionValidation({ apiKey: 'xxxx1234', code: 'ok' });
    await store.clearApiKey();

    assert.deepEqual(store.read(), voiceSettingsSnapshot({ enabled: true }));

    await store.setEnabled(false);
    assert.equal(store.read().enabled, false);
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: setSpeechSynthesisSpeaker updates speaker and resets only synthesis validation', async () => {
  const { store, cleanup } = setup();
  try {
    await store.writeApiKey('xxxx1234');
    await store.recordTranscriptionValidation({ apiKey: 'xxxx1234', code: 'ok' });
    await store.recordSpeechSynthesisValidation({ apiKey: 'xxxx1234', code: 'ok' });

    await store.setSpeechSynthesisSpeaker('zh_male_shaonianzixin_uranus_bigtts');

    assert.equal(store.read().speechSynthesisSpeaker, 'zh_male_shaonianzixin_uranus_bigtts');
    assert.equal(store.read().lastTranscriptionValidationCode, 'ok');
    assert.equal(store.read().lastSpeechSynthesisValidatedAt, null);
    assert.equal(store.read().lastSpeechSynthesisValidationOk, null);
    assert.equal(store.read().lastSpeechSynthesisValidationCode, null);
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

test('voiceSettingsStore: migrates v1 settings without dropping the encrypted api key', () => {
  const { userDataDir, filePath, cleanup } = setup();
  try {
    writeFileSync(
      filePath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          enabled: true,
          apiKeyCiphertext: Buffer.from('enc:abcd1234').toString('base64'),
          apiKeyLastFour: '1234',
          lastValidatedAt: '2026-06-02T08:28:00.000Z',
          lastValidationOk: true,
          lastValidationCode: 'ok',
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const store = createVoiceSettingsStore({
      safeStorage: makeFakeSafeStorage(),
      userDataDir,
      platform: 'linux',
    });

    assert.equal(store.readDecryptedApiKey(), 'abcd1234');
    assert.deepEqual(
      store.read(),
      voiceSettingsSnapshot({
        enabled: true,
        apiKeyConfigured: true,
        apiKeyLastFour: '1234',
        lastTranscriptionValidatedAt: '2026-06-02T08:28:00.000Z',
        lastTranscriptionValidationOk: true,
        lastTranscriptionValidationCode: 'ok',
      })
    );
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: resets invalid legacy speech speaker without dropping the api key', () => {
  const { userDataDir, filePath, cleanup } = setup();
  try {
    writeFileSync(
      filePath,
      `${JSON.stringify(
        {
          schemaVersion: 2,
          enabled: true,
          apiKeyCiphertext: Buffer.from('enc:abcd1234').toString('base64'),
          apiKeyLastFour: '1234',
          speechSynthesisSpeaker: 'zh_female_vv_jupiter_bigtts',
          lastTranscriptionValidatedAt: '2026-06-02T08:28:00.000Z',
          lastTranscriptionValidationOk: true,
          lastTranscriptionValidationCode: 'ok',
          lastSpeechSynthesisValidatedAt: '2026-06-02T08:29:00.000Z',
          lastSpeechSynthesisValidationOk: null,
          lastSpeechSynthesisValidationCode: 'network',
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const store = createVoiceSettingsStore({
      safeStorage: makeFakeSafeStorage(),
      userDataDir,
      platform: 'linux',
    });

    assert.equal(store.readDecryptedApiKey(), 'abcd1234');
    assert.deepEqual(
      store.read(),
      voiceSettingsSnapshot({
        enabled: true,
        apiKeyConfigured: true,
        apiKeyLastFour: '1234',
        lastTranscriptionValidatedAt: '2026-06-02T08:28:00.000Z',
        lastTranscriptionValidationOk: true,
        lastTranscriptionValidationCode: 'ok',
      })
    );
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
    assert.deepEqual(
      reloaded.read(),
      voiceSettingsSnapshot({ apiKeyConfigured: true, apiKeyLastFour: '1234' })
    );
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

test('voiceSettingsStore: recordTranscriptionValidation maps ok auth and network to tri-state snapshot', async () => {
  const { store, cleanup } = setup();
  try {
    await store.writeApiKey('abcd1234');
    assert.equal(
      await store.recordTranscriptionValidation({ apiKey: 'abcd1234', code: 'ok' }),
      true
    );
    assert.equal(store.read().lastTranscriptionValidationOk, true);
    assert.equal(store.read().lastTranscriptionValidationCode, 'ok');
    assert.match(store.read().lastTranscriptionValidatedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);

    assert.equal(
      await store.recordTranscriptionValidation({ apiKey: 'abcd1234', code: 'auth' }),
      true
    );
    assert.equal(store.read().lastTranscriptionValidationOk, false);
    assert.equal(store.read().lastTranscriptionValidationCode, 'auth');

    assert.equal(
      await store.recordTranscriptionValidation({ apiKey: 'abcd1234', code: 'network' }),
      true
    );
    assert.equal(store.read().lastTranscriptionValidationOk, null);
    assert.equal(store.read().lastTranscriptionValidationCode, 'network');
    assert.equal(store.read().lastSpeechSynthesisValidationCode, null);
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: recordSpeechSynthesisValidation keeps synthesis status separate', async () => {
  const { store, cleanup } = setup();
  try {
    await store.writeApiKey('abcd1234');
    await store.recordTranscriptionValidation({ apiKey: 'abcd1234', code: 'ok' });

    assert.equal(
      await store.recordSpeechSynthesisValidation({ apiKey: 'abcd1234', code: 'auth' }),
      true
    );
    assert.equal(store.read().lastTranscriptionValidationCode, 'ok');
    assert.equal(store.read().lastSpeechSynthesisValidationOk, false);
    assert.equal(store.read().lastSpeechSynthesisValidationCode, 'auth');
    assert.match(store.read().lastSpeechSynthesisValidatedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: skips stale validation after key changes', async () => {
  const { store, cleanup } = setup();
  try {
    await store.writeApiKey('first1234');
    await store.writeApiKey('second5678');

    assert.equal(
      await store.recordTranscriptionValidation({ apiKey: 'first1234', code: 'ok' }),
      false
    );
    assert.deepEqual(
      store.read(),
      voiceSettingsSnapshot({ apiKeyConfigured: true, apiKeyLastFour: '5678' })
    );

    assert.equal(
      await store.recordTranscriptionValidation({ apiKey: 'second5678', code: 'auth' }),
      true
    );
    assert.equal(store.read().lastTranscriptionValidationOk, false);
    assert.equal(store.read().lastTranscriptionValidationCode, 'auth');

    await store.clearApiKey();
    assert.equal(
      await store.recordTranscriptionValidation({ apiKey: 'second5678', code: 'ok' }),
      false
    );
    assert.equal(store.read().lastTranscriptionValidationCode, null);
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

    assert.deepEqual(
      store.read(),
      voiceSettingsSnapshot({ enabled: true, apiKeyConfigured: true, apiKeyLastFour: '1234' })
    );
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

    assert.deepEqual(store.read(), voiceSettingsSnapshot());
  } finally {
    cleanup();
  }
});

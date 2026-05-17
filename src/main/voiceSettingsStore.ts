import path from 'node:path';
import { z } from 'zod';
import { writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';
import { readBoundedJsonNoFollowSync } from './workspaceJsonFile.js';

const SCHEMA_VERSION = 1;
const FILE_NAME = 'voice-transcription-settings.json';
const MAX_SETTINGS_FILE_BYTES = 64 * 1024;

const validationCodeSchema = z.enum(['ok', 'auth', 'network']);

const voiceSettingsFileSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  enabled: z.boolean(),
  apiKeyCiphertext: z.string().nullable(),
  apiKeyLastFour: z.string().length(4).nullable(),
  lastValidatedAt: z.string().nullable(),
  lastValidationOk: z.boolean().nullable(),
  lastValidationCode: validationCodeSchema.nullable(),
});

export type VoiceSettingsValidationCode = z.infer<typeof validationCodeSchema>;
export type VoiceSettingsFile = z.infer<typeof voiceSettingsFileSchema>;

export type VoiceSettingsSnapshot = {
  readonly enabled: boolean;
  readonly apiKeyConfigured: boolean;
  readonly apiKeyLastFour: string | null;
  readonly lastValidatedAt: string | null;
  readonly lastValidationOk: boolean | null;
  readonly lastValidationCode: VoiceSettingsValidationCode | null;
};

type SafeStorageBackend =
  | 'basic_text'
  | 'gnome_libsecret'
  | 'kwallet'
  | 'kwallet5'
  | 'kwallet6'
  | 'unknown';

export type VoiceSettingsStoreSafeStorage = {
  readonly isEncryptionAvailable: () => boolean;
  readonly encryptString: (plaintext: string) => Buffer;
  readonly decryptString: (cipher: Buffer) => string;
  readonly getSelectedStorageBackend?: () => SafeStorageBackend;
};

export type VoiceSettingsStoreOptions = {
  readonly safeStorage: VoiceSettingsStoreSafeStorage;
  readonly userDataDir: string;
  readonly platform?: NodeJS.Platform;
  readonly now?: () => Date;
  readonly writeJsonAtomic?: (filePath: string, value: unknown) => Promise<void>;
};

export function getVoiceSettingsFilePath(userDataDir: string): string {
  return path.join(userDataDir, FILE_NAME);
}

function defaultFile(): VoiceSettingsFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    enabled: false,
    apiKeyCiphertext: null,
    apiKeyLastFour: null,
    lastValidatedAt: null,
    lastValidationOk: null,
    lastValidationCode: null,
  };
}

function fileToSnapshot(file: VoiceSettingsFile): VoiceSettingsSnapshot {
  return {
    enabled: file.enabled,
    apiKeyConfigured: file.apiKeyCiphertext !== null,
    apiKeyLastFour: file.apiKeyLastFour,
    lastValidatedAt: file.lastValidatedAt,
    lastValidationOk: file.lastValidationOk,
    lastValidationCode: file.lastValidationCode,
  };
}

function loadFromDisk(filePath: string): VoiceSettingsFile {
  const result = readBoundedJsonNoFollowSync({
    filePath,
    maxBytes: MAX_SETTINGS_FILE_BYTES,
    schema: voiceSettingsFileSchema,
  });
  return result.status === 'ok' ? result.value : defaultFile();
}

function isSecureStorageAvailable({
  safeStorage,
  platform,
}: {
  readonly safeStorage: VoiceSettingsStoreSafeStorage;
  readonly platform: NodeJS.Platform;
}): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    return false;
  }
  if (platform !== 'linux') {
    return true;
  }
  const backend = safeStorage.getSelectedStorageBackend?.() ?? 'unknown';
  return backend !== 'basic_text' && backend !== 'unknown';
}

function validationOkForCode(code: VoiceSettingsValidationCode): boolean | null {
  if (code === 'ok') {
    return true;
  }
  if (code === 'auth') {
    return false;
  }
  return null;
}

function decryptApiKeyFromFile({
  file,
  platform,
  safeStorage,
}: {
  readonly file: VoiceSettingsFile;
  readonly platform: NodeJS.Platform;
  readonly safeStorage: VoiceSettingsStoreSafeStorage;
}): string | null {
  if (file.apiKeyCiphertext === null) {
    return null;
  }
  if (!isSecureStorageAvailable({ safeStorage, platform })) {
    return null;
  }
  try {
    return safeStorage.decryptString(Buffer.from(file.apiKeyCiphertext, 'base64'));
  } catch {
    return null;
  }
}

export function createVoiceSettingsStore({
  safeStorage,
  userDataDir,
  platform = process.platform,
  now = () => new Date(),
  writeJsonAtomic = writeWorkspaceJsonAtomic,
}: VoiceSettingsStoreOptions) {
  const filePath = getVoiceSettingsFilePath(userDataDir);
  let cache = loadFromDisk(filePath);
  let writeQueue: Promise<void> = Promise.resolve();
  const snapshotListeners = new Set<(snapshot: VoiceSettingsSnapshot) => void>();

  function notifySnapshotChange(): void {
    const snapshot = fileToSnapshot(cache);
    for (const listener of snapshotListeners) {
      try {
        listener(snapshot);
      } catch {
        continue;
      }
    }
  }

  async function persist(next: VoiceSettingsFile): Promise<void> {
    await writeJsonAtomic(filePath, next);
    cache = next;
  }

  function updateFile(mutator: (current: VoiceSettingsFile) => VoiceSettingsFile): Promise<void> {
    const queued = writeQueue
      .catch(() => {})
      .then(async () => {
        const next = mutator(cache);
        if (next !== cache) {
          await persist(next);
          notifySnapshotChange();
        }
      });
    writeQueue = queued.then(
      () => {},
      () => {}
    );
    return queued;
  }

  function requireSecureStorage(): void {
    if (!isSecureStorageAvailable({ safeStorage, platform })) {
      throw new Error('safeStorage unavailable');
    }
  }

  function read(): VoiceSettingsSnapshot {
    return fileToSnapshot(cache);
  }

  async function setEnabled(enabled: boolean): Promise<void> {
    await updateFile((current) => ({ ...current, enabled }));
  }

  async function writeApiKey(apiKey: string): Promise<void> {
    const trimmed = apiKey.trim();
    if (trimmed.length < 4) {
      throw new Error('apiKey must be at least 4 characters');
    }
    await updateFile((current) => {
      requireSecureStorage();
      const encrypted = safeStorage.encryptString(trimmed).toString('base64');
      return {
        ...current,
        apiKeyCiphertext: encrypted,
        apiKeyLastFour: trimmed.slice(-4),
        lastValidatedAt: null,
        lastValidationOk: null,
        lastValidationCode: null,
      };
    });
  }

  async function clearApiKey(): Promise<void> {
    await updateFile((current) => ({
      ...current,
      apiKeyCiphertext: null,
      apiKeyLastFour: null,
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    }));
  }

  async function recordValidation({
    apiKey,
    code,
  }: {
    readonly apiKey: string;
    readonly code: VoiceSettingsValidationCode;
  }): Promise<boolean> {
    let applied = false;
    await updateFile((current) => {
      if (decryptApiKeyFromFile({ file: current, platform, safeStorage }) !== apiKey) {
        return current;
      }
      applied = true;
      return {
        ...current,
        lastValidatedAt: now().toISOString(),
        lastValidationOk: validationOkForCode(code),
        lastValidationCode: code,
      };
    });
    return applied;
  }

  function readDecryptedApiKey(): string | null {
    return decryptApiKeyFromFile({ file: cache, platform, safeStorage });
  }

  function onSnapshotChange(listener: (snapshot: VoiceSettingsSnapshot) => void): () => void {
    snapshotListeners.add(listener);
    return () => {
      snapshotListeners.delete(listener);
    };
  }

  return {
    read,
    setEnabled,
    writeApiKey,
    clearApiKey,
    recordValidation,
    readDecryptedApiKey,
    onSnapshotChange,
  };
}

export type VoiceSettingsStore = ReturnType<typeof createVoiceSettingsStore>;

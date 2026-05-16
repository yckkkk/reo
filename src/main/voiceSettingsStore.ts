import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';

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
  let fileDescriptor: number | null = null;
  try {
    fileDescriptor = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = fstatSync(fileDescriptor);
    if (!metadata.isFile() || metadata.size > MAX_SETTINGS_FILE_BYTES) {
      return defaultFile();
    }
    const parsed = voiceSettingsFileSchema.safeParse(
      JSON.parse(readFileSync(fileDescriptor, 'utf8'))
    );
    return parsed.success ? parsed.data : defaultFile();
  } catch {
    return defaultFile();
  } finally {
    if (fileDescriptor !== null) {
      try {
        closeSync(fileDescriptor);
      } catch {
        // Startup should fall back to the default settings file on local state read issues.
      }
    }
  }
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

  async function persist(next: VoiceSettingsFile): Promise<void> {
    await writeJsonAtomic(filePath, next);
    cache = next;
  }

  function updateFile(mutator: (current: VoiceSettingsFile) => VoiceSettingsFile): Promise<void> {
    const queued = writeQueue.catch(() => {}).then(async () => {
      await persist(mutator(cache));
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
    code,
  }: {
    readonly code: VoiceSettingsValidationCode;
  }): Promise<void> {
    await updateFile((current) => ({
      ...current,
      lastValidatedAt: now().toISOString(),
      lastValidationOk: validationOkForCode(code),
      lastValidationCode: code,
    }));
  }

  function readDecryptedApiKey(): string | null {
    if (cache.apiKeyCiphertext === null) {
      return null;
    }
    if (!isSecureStorageAvailable({ safeStorage, platform })) {
      return null;
    }
    try {
      return safeStorage.decryptString(Buffer.from(cache.apiKeyCiphertext, 'base64'));
    } catch {
      return null;
    }
  }

  return {
    read,
    setEnabled,
    writeApiKey,
    clearApiKey,
    recordValidation,
    readDecryptedApiKey,
  };
}

export type VoiceSettingsStore = ReturnType<typeof createVoiceSettingsStore>;

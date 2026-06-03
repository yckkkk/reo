import path from 'node:path';
import { z } from 'zod';
import {
  DEFAULT_VOICE_SPEECH_SYNTHESIS_SPEAKER,
  voiceSpeechSynthesisSpeakerSchema,
  type VoiceSpeechSynthesisSpeaker,
} from '../workspace-contract/workspace-contract.js';
import { writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';
import { readBoundedJsonNoFollowSync } from './workspaceJsonFile.js';

const SCHEMA_VERSION = 2;
const FILE_NAME = 'voice-transcription-settings.json';
const MAX_SETTINGS_FILE_BYTES = 64 * 1024;

const validationCodeSchema = z.enum(['ok', 'auth', 'network']);

const voiceSettingsFileSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  enabled: z.boolean(),
  apiKeyCiphertext: z.string().nullable(),
  apiKeyLastFour: z.string().length(4).nullable(),
  speechSynthesisSpeaker: voiceSpeechSynthesisSpeakerSchema,
  lastTranscriptionValidatedAt: z.string().nullable(),
  lastTranscriptionValidationOk: z.boolean().nullable(),
  lastTranscriptionValidationCode: validationCodeSchema.nullable(),
  lastSpeechSynthesisValidatedAt: z.string().nullable(),
  lastSpeechSynthesisValidationOk: z.boolean().nullable(),
  lastSpeechSynthesisValidationCode: validationCodeSchema.nullable(),
});

const legacyVoiceSettingsFileV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  enabled: z.boolean(),
  apiKeyCiphertext: z.string().nullable(),
  apiKeyLastFour: z.string().length(4).nullable(),
  lastValidatedAt: z.string().nullable(),
  lastValidationOk: z.boolean().nullable(),
  lastValidationCode: validationCodeSchema.nullable(),
});

const legacyVoiceSettingsFileV2Schema = voiceSettingsFileSchema
  .omit({ speechSynthesisSpeaker: true })
  .extend({ speechSynthesisSpeaker: z.string() });

export type VoiceSettingsValidationCode = z.infer<typeof validationCodeSchema>;
export type VoiceSettingsFile = z.infer<typeof voiceSettingsFileSchema>;

export type VoiceSettingsSnapshot = {
  readonly enabled: boolean;
  readonly apiKeyConfigured: boolean;
  readonly apiKeyLastFour: string | null;
  readonly speechSynthesisSpeaker: VoiceSpeechSynthesisSpeaker;
  readonly lastTranscriptionValidatedAt: string | null;
  readonly lastTranscriptionValidationOk: boolean | null;
  readonly lastTranscriptionValidationCode: VoiceSettingsValidationCode | null;
  readonly lastSpeechSynthesisValidatedAt: string | null;
  readonly lastSpeechSynthesisValidationOk: boolean | null;
  readonly lastSpeechSynthesisValidationCode: VoiceSettingsValidationCode | null;
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
    speechSynthesisSpeaker: DEFAULT_VOICE_SPEECH_SYNTHESIS_SPEAKER,
    lastTranscriptionValidatedAt: null,
    lastTranscriptionValidationOk: null,
    lastTranscriptionValidationCode: null,
    lastSpeechSynthesisValidatedAt: null,
    lastSpeechSynthesisValidationOk: null,
    lastSpeechSynthesisValidationCode: null,
  };
}

function fileToSnapshot(file: VoiceSettingsFile): VoiceSettingsSnapshot {
  return {
    enabled: file.enabled,
    apiKeyConfigured: file.apiKeyCiphertext !== null,
    apiKeyLastFour: file.apiKeyLastFour,
    speechSynthesisSpeaker: file.speechSynthesisSpeaker,
    lastTranscriptionValidatedAt: file.lastTranscriptionValidatedAt,
    lastTranscriptionValidationOk: file.lastTranscriptionValidationOk,
    lastTranscriptionValidationCode: file.lastTranscriptionValidationCode,
    lastSpeechSynthesisValidatedAt: file.lastSpeechSynthesisValidatedAt,
    lastSpeechSynthesisValidationOk: file.lastSpeechSynthesisValidationOk,
    lastSpeechSynthesisValidationCode: file.lastSpeechSynthesisValidationCode,
  };
}

function loadFromDisk(filePath: string): VoiceSettingsFile {
  const result = readBoundedJsonNoFollowSync({
    filePath,
    maxBytes: MAX_SETTINGS_FILE_BYTES,
    schema: z.unknown(),
  });
  return result.status === 'ok' ? normalizeVoiceSettingsFile(result.value) : defaultFile();
}

function normalizeVoiceSettingsFile(value: unknown): VoiceSettingsFile {
  const current = voiceSettingsFileSchema.safeParse(value);
  if (current.success) {
    return current.data;
  }

  const legacyV2 = legacyVoiceSettingsFileV2Schema.safeParse(value);
  if (legacyV2.success) {
    const parsedSpeaker = voiceSpeechSynthesisSpeakerSchema.safeParse(
      legacyV2.data.speechSynthesisSpeaker
    );
    return {
      ...legacyV2.data,
      speechSynthesisSpeaker: parsedSpeaker.success
        ? parsedSpeaker.data
        : DEFAULT_VOICE_SPEECH_SYNTHESIS_SPEAKER,
      lastSpeechSynthesisValidatedAt: parsedSpeaker.success
        ? legacyV2.data.lastSpeechSynthesisValidatedAt
        : null,
      lastSpeechSynthesisValidationOk: parsedSpeaker.success
        ? legacyV2.data.lastSpeechSynthesisValidationOk
        : null,
      lastSpeechSynthesisValidationCode: parsedSpeaker.success
        ? legacyV2.data.lastSpeechSynthesisValidationCode
        : null,
    };
  }

  const legacyV1 = legacyVoiceSettingsFileV1Schema.safeParse(value);
  if (legacyV1.success) {
    return {
      schemaVersion: SCHEMA_VERSION,
      enabled: legacyV1.data.enabled,
      apiKeyCiphertext: legacyV1.data.apiKeyCiphertext,
      apiKeyLastFour: legacyV1.data.apiKeyLastFour,
      speechSynthesisSpeaker: DEFAULT_VOICE_SPEECH_SYNTHESIS_SPEAKER,
      lastTranscriptionValidatedAt: legacyV1.data.lastValidatedAt,
      lastTranscriptionValidationOk: legacyV1.data.lastValidationOk,
      lastTranscriptionValidationCode: legacyV1.data.lastValidationCode,
      lastSpeechSynthesisValidatedAt: null,
      lastSpeechSynthesisValidationOk: null,
      lastSpeechSynthesisValidationCode: null,
    };
  }

  return defaultFile();
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

  async function setSpeechSynthesisSpeaker(
    speechSynthesisSpeaker: VoiceSpeechSynthesisSpeaker
  ): Promise<void> {
    await updateFile((current) => ({
      ...current,
      speechSynthesisSpeaker,
      lastSpeechSynthesisValidatedAt: null,
      lastSpeechSynthesisValidationOk: null,
      lastSpeechSynthesisValidationCode: null,
    }));
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
        lastTranscriptionValidatedAt: null,
        lastTranscriptionValidationOk: null,
        lastTranscriptionValidationCode: null,
        lastSpeechSynthesisValidatedAt: null,
        lastSpeechSynthesisValidationOk: null,
        lastSpeechSynthesisValidationCode: null,
      };
    });
  }

  async function clearApiKey(): Promise<void> {
    await updateFile((current) => ({
      ...current,
      apiKeyCiphertext: null,
      apiKeyLastFour: null,
      lastTranscriptionValidatedAt: null,
      lastTranscriptionValidationOk: null,
      lastTranscriptionValidationCode: null,
      lastSpeechSynthesisValidatedAt: null,
      lastSpeechSynthesisValidationOk: null,
      lastSpeechSynthesisValidationCode: null,
    }));
  }

  async function recordTranscriptionValidation({
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
        lastTranscriptionValidatedAt: now().toISOString(),
        lastTranscriptionValidationOk: validationOkForCode(code),
        lastTranscriptionValidationCode: code,
      };
    });
    return applied;
  }

  async function recordSpeechSynthesisValidation({
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
        lastSpeechSynthesisValidatedAt: now().toISOString(),
        lastSpeechSynthesisValidationOk: validationOkForCode(code),
        lastSpeechSynthesisValidationCode: code,
      };
    });
    return applied;
  }

  function readDecryptedApiKey(): string | null {
    return decryptApiKeyFromFile({ file: cache, platform, safeStorage });
  }

  return {
    read,
    setEnabled,
    setSpeechSynthesisSpeaker,
    writeApiKey,
    clearApiKey,
    recordTranscriptionValidation,
    recordSpeechSynthesisValidation,
    readDecryptedApiKey,
  };
}

export type VoiceSettingsStore = ReturnType<typeof createVoiceSettingsStore>;

import { createHash } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { ARTIFACT_RUNTIME_MANIFEST_FILE } from '../workspace-contract/artifact-runtime-url.js';
import {
  workspaceError,
  type WorkspaceErrorEnvelope,
} from '../workspace-contract/workspace-contract.js';
import { writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';
import {
  artifactRuntimeObjectKey,
  type ArtifactRuntimeTarget,
  resolveArtifactRuntimeTargetDirectory,
} from './artifactRuntimeTarget.js';
import { readBoundedJsonNoFollow, readBoundedJsonNoFollowSync } from './workspaceJsonFile.js';

const SCHEMA_VERSION = 2;
const FILE_NAME = 'artifact-runtime-secrets.json';
const MAX_SECRET_FILE_BYTES = 1024 * 1024;
const MAX_RUNTIME_MANIFEST_BYTES = 256 * 1024;
const MAX_SECRET_VALUE_LENGTH = 128 * 1024;
const MAX_SECRET_SLOT_ID_LENGTH = 120;

type SafeStorageBackend =
  | 'basic_text'
  | 'gnome_libsecret'
  | 'kwallet'
  | 'kwallet5'
  | 'kwallet6'
  | 'unknown';

export type ArtifactRuntimeSecretSafeStorage = {
  readonly isEncryptionAvailable: () => boolean;
  readonly encryptString: (plaintext: string) => Buffer;
  readonly decryptString: (cipher: Buffer) => string;
  readonly getSelectedStorageBackend?: () => SafeStorageBackend;
};

const secretFileSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  values: z.record(z.string(), z.string()),
});

type ArtifactRuntimeSecretFile = z.infer<typeof secretFileSchema>;

export type ArtifactRuntimeSecretSlot = {
  readonly id: string;
  readonly label?: string | undefined;
  readonly purpose?: string | undefined;
  readonly configured: boolean;
};

export type ArtifactRuntimeSecretStore = ReturnType<typeof createArtifactRuntimeSecretStore>;

export function getArtifactRuntimeSecretsFilePath(userDataDir: string): string {
  return path.join(userDataDir, FILE_NAME);
}

function defaultSecretFile(): ArtifactRuntimeSecretFile {
  return { schemaVersion: SCHEMA_VERSION, values: {} };
}

function loadSecretFile(filePath: string): ArtifactRuntimeSecretFile {
  const result = readBoundedJsonNoFollowSync({
    filePath,
    maxBytes: MAX_SECRET_FILE_BYTES,
    schema: secretFileSchema,
  });
  return result.status === 'ok' ? result.value : defaultSecretFile();
}

function secretStorageKey(target: ArtifactRuntimeTarget, slotId: string): string {
  return createHash('sha256').update(artifactRuntimeObjectKey(target, slotId)).digest('hex');
}

function isSecureStorageAvailable({
  platform,
  safeStorage,
}: {
  readonly platform: NodeJS.Platform;
  readonly safeStorage: ArtifactRuntimeSecretSafeStorage;
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

function isSafeSecretSlotId(slotId: string): boolean {
  return (
    slotId.length > 0 &&
    slotId.length <= MAX_SECRET_SLOT_ID_LENGTH &&
    !slotId.includes('/') &&
    !slotId.includes('\\') &&
    slotId !== '.' &&
    slotId !== '..'
  );
}

export function createArtifactRuntimeSecretStore({
  platform = process.platform,
  safeStorage,
  userDataDir,
  writeJsonAtomic = writeWorkspaceJsonAtomic,
}: {
  readonly platform?: NodeJS.Platform;
  readonly safeStorage: ArtifactRuntimeSecretSafeStorage;
  readonly userDataDir: string;
  readonly writeJsonAtomic?: (filePath: string, value: unknown) => Promise<void>;
}) {
  const filePath = getArtifactRuntimeSecretsFilePath(userDataDir);
  let cache = loadSecretFile(filePath);
  let writeQueue: Promise<void> = Promise.resolve();

  function readValue(target: ArtifactRuntimeTarget, slotId: string): string | null {
    if (!isSafeSecretSlotId(slotId)) {
      return null;
    }
    if (!isSecureStorageAvailable({ platform, safeStorage })) {
      return null;
    }
    const ciphertext = cache.values[secretStorageKey(target, slotId)] ?? null;
    if (ciphertext === null) {
      return null;
    }
    try {
      return safeStorage.decryptString(Buffer.from(ciphertext, 'base64'));
    } catch {
      return null;
    }
  }

  async function update(
    mutator: (current: ArtifactRuntimeSecretFile) => ArtifactRuntimeSecretFile
  ) {
    const queued = writeQueue
      .catch(() => {})
      .then(async () => {
        const next = mutator(cache);
        if (next !== cache) {
          await writeJsonAtomic(filePath, next);
          cache = next;
        }
      });
    writeQueue = queued.then(
      () => {},
      () => {}
    );
    await queued;
  }

  async function writeValue(
    target: ArtifactRuntimeTarget,
    slotId: string,
    value: string
  ): Promise<void> {
    if (!isSafeSecretSlotId(slotId) || value.length > MAX_SECRET_VALUE_LENGTH) {
      throw new Error('Invalid artifact runtime secret');
    }
    if (!isSecureStorageAvailable({ platform, safeStorage })) {
      throw new Error('safeStorage unavailable');
    }
    const key = secretStorageKey(target, slotId);
    const ciphertext = safeStorage.encryptString(value).toString('base64');
    await update((current) => ({
      ...current,
      values: {
        ...current.values,
        [key]: ciphertext,
      },
    }));
  }

  async function clearValue(target: ArtifactRuntimeTarget, slotId: string): Promise<void> {
    if (!isSafeSecretSlotId(slotId)) {
      throw new Error('Invalid artifact runtime secret');
    }
    const key = secretStorageKey(target, slotId);
    await update((current) => {
      if (!(key in current.values)) {
        return current;
      }
      const values = { ...current.values };
      delete values[key];
      return { ...current, values };
    });
  }

  function isConfigured(target: ArtifactRuntimeTarget, slotId: string): boolean {
    return readValue(target, slotId) !== null;
  }

  return {
    clearValue,
    isConfigured,
    readValue,
    writeValue,
  };
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function parseRuntimeSecretSlots(
  value: unknown
): readonly Omit<ArtifactRuntimeSecretSlot, 'configured'>[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [];
  }
  const secrets = (value as Record<string, unknown>)['secrets'];
  if (!Array.isArray(secrets)) {
    return [];
  }

  const slots: Omit<ArtifactRuntimeSecretSlot, 'configured'>[] = [];
  const seen = new Set<string>();
  for (const item of secrets) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      continue;
    }
    const id = stringField((item as Record<string, unknown>)['id']);
    if (!id || !isSafeSecretSlotId(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const label = stringField((item as Record<string, unknown>)['label']);
    const purpose =
      stringField((item as Record<string, unknown>)['purpose']) ??
      stringField((item as Record<string, unknown>)['description']);
    slots.push({
      id,
      ...(label ? { label } : {}),
      ...(purpose ? { purpose } : {}),
    });
  }
  return slots;
}

async function readRuntimeSecretSlots({
  rootPath,
  target,
}: {
  readonly rootPath: string;
  readonly target: ArtifactRuntimeTarget;
}): Promise<readonly Omit<ArtifactRuntimeSecretSlot, 'configured'>[]> {
  const directory = await resolveArtifactRuntimeTargetDirectory({ rootPath, target });
  const result = await readBoundedJsonNoFollow({
    filePath: path.join(directory, ARTIFACT_RUNTIME_MANIFEST_FILE),
    maxBytes: MAX_RUNTIME_MANIFEST_BYTES,
    schema: z.unknown(),
  });
  return result.status === 'ok' ? parseRuntimeSecretSlots(result.value) : [];
}

async function validateDeclaredRuntimeSecretSlot({
  rootPath,
  slotId,
  target,
}: {
  readonly rootPath: string;
  readonly slotId: string;
  readonly target: ArtifactRuntimeTarget;
}): Promise<{ readonly ok: true } | WorkspaceErrorEnvelope> {
  if (!isSafeSecretSlotId(slotId)) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'Artifact runtime secret slot id is invalid',
      'previous-file-preserved'
    );
  }

  try {
    const slots = await readRuntimeSecretSlots({ rootPath, target });
    if (!slots.some((slot) => slot.id === slotId)) {
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'Artifact runtime secret slot is not declared',
        'previous-file-preserved'
      );
    }
    return { ok: true };
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Artifact runtime secret slot could not be verified',
      'previous-file-preserved'
    );
  }
}

export async function listArtifactRuntimeSecretSlots({
  rootPath,
  store,
  target,
}: {
  readonly rootPath: string;
  readonly store: ArtifactRuntimeSecretStore;
  readonly target: ArtifactRuntimeTarget;
}): Promise<
  | {
      readonly ok: true;
      readonly value: { readonly slots: readonly ArtifactRuntimeSecretSlot[] };
    }
  | WorkspaceErrorEnvelope
> {
  try {
    const slots = await readRuntimeSecretSlots({ rootPath, target });
    return {
      ok: true,
      value: {
        slots: slots.map((slot) => ({
          ...slot,
          configured: store.isConfigured(target, slot.id),
        })),
      },
    };
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Artifact runtime secret slots could not be read',
      'previous-file-preserved'
    );
  }
}

export async function getArtifactRuntimeSecretValue({
  rootPath,
  store,
  target,
  slotId,
}: {
  readonly rootPath: string;
  readonly store: ArtifactRuntimeSecretStore;
  readonly target: ArtifactRuntimeTarget;
  readonly slotId: string;
}): Promise<
  | {
      readonly ok: true;
      readonly value: { readonly configured: boolean; readonly value: string | null };
    }
  | WorkspaceErrorEnvelope
> {
  const declared = await validateDeclaredRuntimeSecretSlot({ rootPath, slotId, target });
  if (!declared.ok) {
    return declared;
  }
  const value = store.readValue(target, slotId);
  return { ok: true, value: { configured: value !== null, value } };
}

export async function setArtifactRuntimeSecretValue({
  rootPath,
  store,
  target,
  slotId,
  value,
}: {
  readonly rootPath: string;
  readonly store: ArtifactRuntimeSecretStore;
  readonly target: ArtifactRuntimeTarget;
  readonly slotId: string;
  readonly value: string;
}): Promise<
  { readonly ok: true; readonly value: { readonly configured: true } } | WorkspaceErrorEnvelope
> {
  const declared = await validateDeclaredRuntimeSecretSlot({ rootPath, slotId, target });
  if (!declared.ok) {
    return declared;
  }
  try {
    await store.writeValue(target, slotId, value);
    return { ok: true, value: { configured: true } };
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'Artifact runtime secret value is invalid',
      'previous-file-preserved'
    );
  }
}

export async function clearArtifactRuntimeSecretValue({
  rootPath,
  store,
  target,
  slotId,
}: {
  readonly rootPath: string;
  readonly store: ArtifactRuntimeSecretStore;
  readonly target: ArtifactRuntimeTarget;
  readonly slotId: string;
}): Promise<
  { readonly ok: true; readonly value: { readonly configured: false } } | WorkspaceErrorEnvelope
> {
  const declared = await validateDeclaredRuntimeSecretSlot({ rootPath, slotId, target });
  if (!declared.ok) {
    return declared;
  }
  try {
    await store.clearValue(target, slotId);
    return { ok: true, value: { configured: false } };
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'Artifact runtime secret slot id is invalid',
      'previous-file-preserved'
    );
  }
}

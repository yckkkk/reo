import { closeSync, constants, fstatSync, readSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ARTIFACT_RUNTIME_STATE_FILE } from '../workspace-contract/artifact-runtime-url.js';
import {
  workspaceError,
  type WorkspaceErrorEnvelope,
} from '../workspace-contract/workspace-contract.js';
import { readSafeDirectoryIdentity, type DirectoryIdentity } from './directoryIdentity.js';
import { openExistingWorkspaceFileInDirectory } from './workspaceDirectoryTransactions.js';
import {
  WorkspaceFileChangedBeforeAtomicWrite,
  writeWorkspaceFileAtomicInKnownDirectory,
  writeWorkspaceFileNoReplaceAtomicInKnownDirectory,
} from './atomicWorkspaceFile.js';
import {
  type ArtifactRuntimeTarget,
  resolveArtifactRuntimeTargetDirectory,
} from './artifactRuntimeTarget.js';

const MAX_ARTIFACT_RUNTIME_STATE_BYTES = 1024 * 1024;

export type ArtifactRuntimeStateJson = Record<string, unknown>;
export type ArtifactRuntimeStateSource = 'file' | 'missing' | 'invalid';

const DEFAULT_ARTIFACT_RUNTIME_STATE = Object.freeze({
  schemaVersion: 1,
  stores: {},
}) satisfies ArtifactRuntimeStateJson;

type RuntimeStateFileRead =
  | {
      readonly status: 'file';
      readonly raw: Uint8Array;
      readonly state: ArtifactRuntimeStateJson;
      readonly version: string;
    }
  | {
      readonly status: 'missing';
      readonly state: ArtifactRuntimeStateJson;
      readonly version: string;
    }
  | {
      readonly status: 'invalid';
      readonly raw: Uint8Array | null;
      readonly state: ArtifactRuntimeStateJson;
      readonly version: string;
    };

export type ArtifactRuntimeStateReadResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly source: ArtifactRuntimeStateSource;
        readonly state: ArtifactRuntimeStateJson;
        readonly version: string;
      };
    }
  | WorkspaceErrorEnvelope;

export type ArtifactRuntimeStateWriteResult =
  | {
      readonly ok: true;
      readonly value:
        | {
            readonly status: 'saved';
            readonly state: ArtifactRuntimeStateJson;
            readonly version: string;
          }
        | {
            readonly status: 'stale';
            readonly currentState: ArtifactRuntimeStateJson;
            readonly currentVersion: string;
          };
    }
  | WorkspaceErrorEnvelope;

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 32) {
    return false;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item, depth + 1));
  }
  if (isJsonRecord(value)) {
    return Object.values(value).every((item) => isJsonValue(item, depth + 1));
  }
  return false;
}

export function isArtifactRuntimeStateJson(value: unknown): value is ArtifactRuntimeStateJson {
  return isJsonRecord(value) && isJsonValue(value);
}

function canonicalRuntimeStateText(state: ArtifactRuntimeStateJson): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}

function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function defaultStateVersion(): string {
  return hashBytes(Buffer.from(canonicalRuntimeStateText(DEFAULT_ARTIFACT_RUNTIME_STATE), 'utf8'));
}

function defaultState(): ArtifactRuntimeStateJson {
  return { schemaVersion: 1, stores: {} };
}

function readRuntimeStateFileInKnownDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity
): RuntimeStateFileRead {
  let fd: number;
  try {
    fd = openExistingWorkspaceFileInDirectory({
      directory,
      directoryIdentity,
      fileName: ARTIFACT_RUNTIME_STATE_FILE,
      flags: constants.O_RDONLY | constants.O_NOFOLLOW,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { status: 'missing', state: defaultState(), version: defaultStateVersion() };
    }
    return { status: 'invalid', raw: null, state: defaultState(), version: defaultStateVersion() };
  }

  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_ARTIFACT_RUNTIME_STATE_BYTES) {
      return {
        status: 'invalid',
        raw: null,
        state: defaultState(),
        version: defaultStateVersion(),
      };
    }
    const raw = Buffer.allocUnsafe(stat.size);
    let offset = 0;
    while (offset < stat.size) {
      const bytesRead = readSync(fd, raw, offset, stat.size - offset, offset);
      if (bytesRead === 0) {
        return { status: 'invalid', raw, state: defaultState(), version: hashBytes(raw) };
      }
      offset += bytesRead;
    }
    try {
      const parsed = JSON.parse(raw.toString('utf8')) as unknown;
      if (!isArtifactRuntimeStateJson(parsed)) {
        return { status: 'invalid', raw, state: defaultState(), version: hashBytes(raw) };
      }
      return { status: 'file', raw, state: parsed, version: hashBytes(raw) };
    } catch {
      return { status: 'invalid', raw, state: defaultState(), version: hashBytes(raw) };
    }
  } finally {
    closeSync(fd);
  }
}

async function resolveRuntimeStateDirectory({
  rootPath,
  target,
}: {
  readonly rootPath: string;
  readonly target: ArtifactRuntimeTarget;
}): Promise<{ readonly directory: string; readonly directoryIdentity: DirectoryIdentity }> {
  const directory = await resolveArtifactRuntimeTargetDirectory({ rootPath, target });
  return {
    directory,
    directoryIdentity: await readSafeDirectoryIdentity(directory, 'Artifact runtime is unsafe'),
  };
}

export async function readArtifactRuntimeState({
  rootPath,
  target,
}: {
  readonly rootPath: string;
  readonly target: ArtifactRuntimeTarget;
}): Promise<ArtifactRuntimeStateReadResult> {
  try {
    const { directory, directoryIdentity } = await resolveRuntimeStateDirectory({
      rootPath,
      target,
    });
    const current = readRuntimeStateFileInKnownDirectory(directory, directoryIdentity);
    return {
      ok: true,
      value: {
        source: current.status === 'file' ? 'file' : current.status,
        state: current.state,
        version: current.version,
      },
    };
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Artifact runtime state could not be read',
      'previous-file-preserved'
    );
  }
}

export async function writeArtifactRuntimeState({
  baselineVersion,
  rootPath,
  state,
  target,
}: {
  readonly baselineVersion: string;
  readonly rootPath: string;
  readonly state: ArtifactRuntimeStateJson;
  readonly target: ArtifactRuntimeTarget;
}): Promise<ArtifactRuntimeStateWriteResult> {
  if (!/^[a-f0-9]{64}$/.test(baselineVersion) || !isArtifactRuntimeStateJson(state)) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'Artifact runtime state write request is invalid',
      'previous-file-preserved'
    );
  }

  try {
    const { directory, directoryIdentity } = await resolveRuntimeStateDirectory({
      rootPath,
      target,
    });
    const current = readRuntimeStateFileInKnownDirectory(directory, directoryIdentity);
    if (current.version !== baselineVersion) {
      return {
        ok: true,
        value: {
          status: 'stale',
          currentState: current.state,
          currentVersion: current.version,
        },
      };
    }

    const nextText = canonicalRuntimeStateText(state);
    if (Buffer.byteLength(nextText, 'utf8') > MAX_ARTIFACT_RUNTIME_STATE_BYTES) {
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'Artifact runtime state write request is too large',
        'previous-file-preserved'
      );
    }
    if (current.status === 'missing') {
      try {
        await writeWorkspaceFileNoReplaceAtomicInKnownDirectory({
          directory,
          directoryIdentity,
          fileName: ARTIFACT_RUNTIME_STATE_FILE,
          data: nextText,
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          const latest = readRuntimeStateFileInKnownDirectory(directory, directoryIdentity);
          return {
            ok: true,
            value: {
              status: 'stale',
              currentState: latest.state,
              currentVersion: latest.version,
            },
          };
        }
        throw error;
      }
    } else {
      await writeWorkspaceFileAtomicInKnownDirectory({
        directory,
        directoryIdentity,
        fileName: ARTIFACT_RUNTIME_STATE_FILE,
        data: nextText,
        expectedCurrentData: current.raw ?? undefined,
      });
    }

    return {
      ok: true,
      value: {
        status: 'saved',
        state,
        version: hashBytes(Buffer.from(nextText, 'utf8')),
      },
    };
  } catch (error) {
    if (error instanceof WorkspaceFileChangedBeforeAtomicWrite) {
      const latest = await readArtifactRuntimeState({ rootPath, target });
      return latest.ok
        ? {
            ok: true,
            value: {
              status: 'stale',
              currentState: latest.value.state,
              currentVersion: latest.value.version,
            },
          }
        : latest;
    }
    return workspaceError(
      'ERR_WORKSPACE_UPDATE_FAILED',
      'Artifact runtime state could not be written',
      'previous-file-preserved'
    );
  }
}

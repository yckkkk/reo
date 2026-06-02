import { closeSync, constants, fstatSync, readFileSync } from 'node:fs';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import {
  assertSameDirectoryIdentity,
  readSafeDirectoryIdentity,
  type DirectoryIdentity,
} from './directoryIdentity.js';
import {
  openExistingWorkspaceFileInDirectory,
  readWorkspaceDirectoryEntriesInDirectory,
} from './workspaceDirectoryTransactions.js';
import {
  workspaceError,
  type WorkspaceErrorEnvelope,
  type WorkspaceMemoryCoverProjection,
} from '../workspace-contract/workspace-contract.js';

const MAX_MEMORY_COVER_BYTES = 25 * 1024 * 1024;

const MEMORY_COVER_MIME_BY_EXTENSION = new Map([
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);
const MAX_MEMORY_COVER_BYTES_BIGINT = BigInt(MAX_MEMORY_COVER_BYTES);

type MemoryCoverProtocolResolution =
  | {
      readonly ok: true;
      readonly bytes: Uint8Array;
      readonly mimeType: string;
    }
  | WorkspaceErrorEnvelope;

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { readonly code?: unknown }).code === code
  );
}

function memoryCoverMimeType(filename: string): string | null {
  return MEMORY_COVER_MIME_BY_EXTENSION.get(path.extname(filename).toLowerCase()) ?? null;
}

function isSafeCoverFilename(filename: string): boolean {
  return (
    filename.length > 0 &&
    !filename.includes('/') &&
    !filename.includes('\\') &&
    !filename.includes('..') &&
    memoryCoverMimeType(filename) !== null
  );
}

function memoryCoverDirectory(memoryDirectoryPath: string): string {
  return path.join(memoryDirectoryPath, 'cover');
}

async function readExistingSafeCoverDirectory(
  memoryDirectoryPath: string
): Promise<{ readonly coverDirectory: string; readonly directoryIdentity: DirectoryIdentity }> {
  const coverDirectory = memoryCoverDirectory(memoryDirectoryPath);
  const directoryIdentity = await readSafeDirectoryIdentity(
    coverDirectory,
    'Memory cover directory is unsafe'
  );
  return { coverDirectory, directoryIdentity };
}

function readExistingCoverBytesInDirectory({
  coverDirectory,
  directoryIdentity,
  filename,
}: {
  readonly coverDirectory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly filename: string;
}): { readonly bytes: Uint8Array; readonly byteLength: number } {
  let fd: number | null = null;
  try {
    fd = openExistingWorkspaceFileInDirectory({
      directory: coverDirectory,
      directoryIdentity,
      fileName: filename,
      flags: constants.O_RDONLY,
    });
    const stats = fstatSync(fd);
    if (!stats.isFile() || stats.size > MAX_MEMORY_COVER_BYTES) {
      throw new Error('Memory cover leaf is unsafe');
    }
    return { bytes: new Uint8Array(readFileSync(fd)), byteLength: stats.size };
  } finally {
    if (fd !== null) {
      closeSync(fd);
    }
  }
}

export async function readMemoryCoverProjectionFromDirectory(
  memoryDirectoryPath: string
): Promise<WorkspaceMemoryCoverProjection> {
  let safeCoverDirectory: Awaited<ReturnType<typeof readExistingSafeCoverDirectory>>;
  try {
    safeCoverDirectory = await readExistingSafeCoverDirectory(memoryDirectoryPath);
  } catch {
    return { source: 'default' };
  }

  const { coverDirectory, directoryIdentity } = safeCoverDirectory;
  const entries = readWorkspaceDirectoryEntriesInDirectory({
    directory: coverDirectory,
    directoryIdentity,
  });
  const candidates = entries
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && isSafeCoverFilename(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  if (candidates.length === 0) {
    return { source: 'default' };
  }

  try {
    for (const candidate of candidates) {
      const selected = await lstat(path.join(coverDirectory, candidate), { bigint: true });
      if (
        !selected.isFile() ||
        selected.isSymbolicLink() ||
        selected.size > MAX_MEMORY_COVER_BYTES_BIGINT
      ) {
        continue;
      }
      await assertSameDirectoryIdentity(
        coverDirectory,
        directoryIdentity,
        'Memory cover directory changed during read'
      );
      return {
        source: 'custom',
        filename: candidate,
        version: `${selected.mtimeNs.toString()}-${selected.size.toString()}`,
      };
    }
    return { source: 'default' };
  } catch {
    return { source: 'default' };
  }
}

export async function resolveMemoryCoverFile({
  filename,
  memoryDirectoryPath,
}: {
  readonly filename: string;
  readonly memoryDirectoryPath: string;
}): Promise<MemoryCoverProtocolResolution> {
  const mimeType = memoryCoverMimeType(filename);
  if (!mimeType || !isSafeCoverFilename(filename)) {
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Memory cover path is unsafe');
  }

  try {
    const { coverDirectory, directoryIdentity } =
      await readExistingSafeCoverDirectory(memoryDirectoryPath);
    const existing = readExistingCoverBytesInDirectory({
      coverDirectory,
      directoryIdentity,
      filename,
    });
    await assertSameDirectoryIdentity(
      coverDirectory,
      directoryIdentity,
      'Memory cover directory changed during read'
    );
    return { ok: true, bytes: existing.bytes, mimeType };
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTDIR')) {
      return workspaceError('ERR_WORKSPACE_MEMORY_COVER_NOT_FOUND', 'Memory cover was not found');
    }
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Memory cover path is unsafe');
  }
}

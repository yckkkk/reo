import { lstat } from 'node:fs/promises';
import path from 'node:path';
import {
  assertSameDirectoryIdentity,
  readSafeDirectoryIdentity,
  type DirectoryIdentity,
} from './directoryIdentity.js';
import { readWorkspaceDirectoryEntriesInDirectory } from './workspaceDirectoryTransactions.js';
import {
  isSafeImageFilename,
  MEMORY_COVER_IMAGE_EXTENSIONS,
  readExistingImagePayloadInDirectory,
} from './imagePayloads.js';
import {
  workspaceError,
  type WorkspaceCoverProjection,
  type WorkspaceErrorCode,
  type WorkspaceErrorEnvelope,
  type WorkspaceMemoryCoverProjection,
} from '../workspace-contract/workspace-contract.js';

const MAX_COVER_BYTES = 25 * 1024 * 1024;
const MAX_COVER_BYTES_BIGINT = BigInt(MAX_COVER_BYTES);

type CoverProtocolResolution =
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

function fileSpaceNodeCoverDirectory(ownerDirectoryPath: string): string {
  return path.join(ownerDirectoryPath, 'cover');
}

async function readExistingSafeCoverDirectory(
  ownerDirectoryPath: string,
  unsafeMessage: string
): Promise<{ readonly coverDirectory: string; readonly directoryIdentity: DirectoryIdentity }> {
  const coverDirectory = fileSpaceNodeCoverDirectory(ownerDirectoryPath);
  const directoryIdentity = await readSafeDirectoryIdentity(coverDirectory, unsafeMessage);
  return { coverDirectory, directoryIdentity };
}

export async function readFileSpaceNodeCoverProjectionFromDirectory(
  ownerDirectoryPath: string
): Promise<WorkspaceCoverProjection> {
  let safeCoverDirectory: Awaited<ReturnType<typeof readExistingSafeCoverDirectory>>;
  try {
    safeCoverDirectory = await readExistingSafeCoverDirectory(
      ownerDirectoryPath,
      'Cover directory is unsafe'
    );
  } catch {
    return { source: 'default' };
  }

  const { coverDirectory, directoryIdentity } = safeCoverDirectory;
  const entries = readWorkspaceDirectoryEntriesInDirectory({
    directory: coverDirectory,
    directoryIdentity,
  });
  const candidates = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.isSymbolicLink() &&
        isSafeImageFilename(entry.name, MEMORY_COVER_IMAGE_EXTENSIONS)
    )
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
        selected.size > MAX_COVER_BYTES_BIGINT
      ) {
        continue;
      }
      await assertSameDirectoryIdentity(
        coverDirectory,
        directoryIdentity,
        'Cover directory changed during read'
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

export async function readMemoryCoverProjectionFromDirectory(
  memoryDirectoryPath: string
): Promise<WorkspaceMemoryCoverProjection> {
  return readFileSpaceNodeCoverProjectionFromDirectory(memoryDirectoryPath);
}

export async function resolveFileSpaceNodeCoverFile({
  filename,
  ownerDirectoryPath,
  notFoundErrorCode = 'ERR_WORKSPACE_SEGMENT_COVER_NOT_FOUND',
  notFoundMessage = 'Segment cover was not found',
  unsafeMessage = 'Cover path is unsafe',
  unsafeLeafMessage = 'Cover leaf is unsafe',
}: {
  readonly filename: string;
  readonly ownerDirectoryPath: string;
  readonly notFoundErrorCode?: WorkspaceErrorCode;
  readonly notFoundMessage?: string;
  readonly unsafeMessage?: string;
  readonly unsafeLeafMessage?: string;
}): Promise<CoverProtocolResolution> {
  if (!isSafeImageFilename(filename, MEMORY_COVER_IMAGE_EXTENSIONS)) {
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', unsafeMessage);
  }

  try {
    const { coverDirectory, directoryIdentity } = await readExistingSafeCoverDirectory(
      ownerDirectoryPath,
      unsafeMessage
    );
    const existing = await readExistingImagePayloadInDirectory({
      allowedExtensions: MEMORY_COVER_IMAGE_EXTENSIONS,
      directory: coverDirectory,
      directoryIdentity,
      filename,
      maxBytes: MAX_COVER_BYTES,
      tooLargeErrorCode: 'ERR_WORKSPACE_UNSAFE_PATH',
      tooLargeMessage: unsafeLeafMessage,
      unsafeMessage,
    });
    await assertSameDirectoryIdentity(
      coverDirectory,
      directoryIdentity,
      'Cover directory changed during read'
    );
    return { ok: true, bytes: existing.bytes, mimeType: existing.mimeType };
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTDIR')) {
      return workspaceError(notFoundErrorCode, notFoundMessage);
    }
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', unsafeMessage);
  }
}

export async function resolveMemoryCoverFile({
  filename,
  memoryDirectoryPath,
}: {
  readonly filename: string;
  readonly memoryDirectoryPath: string;
}): Promise<CoverProtocolResolution> {
  return resolveFileSpaceNodeCoverFile({
    filename,
    ownerDirectoryPath: memoryDirectoryPath,
    notFoundErrorCode: 'ERR_WORKSPACE_MEMORY_COVER_NOT_FOUND',
    notFoundMessage: 'Memory cover was not found',
    unsafeLeafMessage: 'Memory cover leaf is unsafe',
    unsafeMessage: 'Memory cover path is unsafe',
  });
}

export async function resolveSegmentCoverFile({
  filename,
  segmentDirectoryPath,
}: {
  readonly filename: string;
  readonly segmentDirectoryPath: string;
}): Promise<CoverProtocolResolution> {
  return resolveFileSpaceNodeCoverFile({
    filename,
    ownerDirectoryPath: segmentDirectoryPath,
    notFoundErrorCode: 'ERR_WORKSPACE_SEGMENT_COVER_NOT_FOUND',
    notFoundMessage: 'Segment cover was not found',
    unsafeLeafMessage: 'Segment cover leaf is unsafe',
    unsafeMessage: 'Segment cover path is unsafe',
  });
}

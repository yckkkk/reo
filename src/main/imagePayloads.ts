import { closeSync, constants, fstat, read, type Stats } from 'node:fs';
import path from 'node:path';
import { type DirectoryIdentity } from './directoryIdentity.js';
import { openExistingWorkspaceFileInDirectory } from './workspaceDirectoryTransactions.js';
import {
  workspaceError,
  type WorkspaceErrorCode,
} from '../workspace-contract/workspace-contract.js';

export const NOTE_ATTACHMENT_IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.webp',
]);

export const MEMORY_COVER_IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.jpeg',
  '.jpg',
  '.png',
  '.webp',
]);

const IMAGE_MIME_BY_EXTENSION = new Map([
  ['.gif', 'image/gif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

type ImagePayloadReadHook = (context: {
  readonly byteLength: number;
  readonly filename: string;
  readonly mimeType: string;
}) => Promise<void> | void;

let beforeImagePayloadReadForTest: ImagePayloadReadHook | null = null;

export function setBeforeImagePayloadReadForTest(hook: ImagePayloadReadHook | null): void {
  beforeImagePayloadReadForTest = hook;
}

export function imageMimeTypeForFilename(
  filename: string,
  allowedExtensions: ReadonlySet<string>
): string | null {
  const extension = path.extname(filename).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    return null;
  }
  return IMAGE_MIME_BY_EXTENSION.get(extension) ?? null;
}

export function imageExtensionForMime({
  allowedExtensions,
  mimeType,
  originalFilename,
}: {
  readonly allowedExtensions: ReadonlySet<string>;
  readonly mimeType: string;
  readonly originalFilename: string;
}): string | null {
  const normalizedMime = mimeType.toLowerCase();
  const originalExtension = path.extname(originalFilename).toLowerCase();
  if (
    allowedExtensions.has(originalExtension) &&
    IMAGE_MIME_BY_EXTENSION.get(originalExtension) === normalizedMime
  ) {
    return originalExtension;
  }
  for (const [extension, candidateMime] of IMAGE_MIME_BY_EXTENSION) {
    if (allowedExtensions.has(extension) && candidateMime === normalizedMime) {
      return extension;
    }
  }
  return null;
}

export function isSafeImageFilename(
  filename: string,
  allowedExtensions: ReadonlySet<string>
): boolean {
  return (
    filename.length > 0 &&
    !filename.includes('/') &&
    !filename.includes('\\') &&
    !filename.includes('..') &&
    imageMimeTypeForFilename(filename, allowedExtensions) !== null
  );
}

function fstatFileDescriptor(fileDescriptor: number): Promise<Stats> {
  return new Promise((resolve, reject) => {
    fstat(fileDescriptor, (error, stats) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stats);
    });
  });
}

function readFileDescriptorChunk({
  buffer,
  fileDescriptor,
  length,
  offset,
}: {
  readonly buffer: Buffer;
  readonly fileDescriptor: number;
  readonly length: number;
  readonly offset: number;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    read(fileDescriptor, buffer, offset, length, offset, (error, bytesRead) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(bytesRead);
    });
  });
}

async function readFileDescriptorBytes({
  byteLength,
  fileDescriptor,
}: {
  readonly byteLength: number;
  readonly fileDescriptor: number;
}): Promise<Uint8Array> {
  const bytes = Buffer.alloc(byteLength);
  let offset = 0;
  while (offset < byteLength) {
    const bytesRead = await readFileDescriptorChunk({
      buffer: bytes,
      fileDescriptor,
      length: byteLength - offset,
      offset,
    });
    if (bytesRead <= 0) {
      throw new Error('Image payload read made no progress');
    }
    offset += bytesRead;
  }
  return bytes;
}

export async function readExistingImagePayloadInDirectory({
  allowedExtensions,
  directory,
  directoryIdentity,
  filename,
  maxBytes,
  tooLargeErrorCode,
  tooLargeMessage,
  unsafeMessage,
}: {
  readonly allowedExtensions: ReadonlySet<string>;
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly filename: string;
  readonly maxBytes: number;
  readonly tooLargeErrorCode: WorkspaceErrorCode;
  readonly tooLargeMessage: string;
  readonly unsafeMessage: string;
}): Promise<{
  readonly byteLength: number;
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}> {
  const mimeType = imageMimeTypeForFilename(filename, allowedExtensions);
  if (!mimeType || !isSafeImageFilename(filename, allowedExtensions)) {
    throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', unsafeMessage);
  }

  let fileDescriptor: number | null = null;
  try {
    fileDescriptor = openExistingWorkspaceFileInDirectory({
      directory,
      directoryIdentity,
      fileName: filename,
      flags: constants.O_RDONLY | constants.O_NOFOLLOW,
    });
    const stats = await fstatFileDescriptor(fileDescriptor);
    if (!stats.isFile()) {
      throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', unsafeMessage);
    }
    if (stats.size > maxBytes) {
      throw workspaceError(tooLargeErrorCode, tooLargeMessage);
    }
    await beforeImagePayloadReadForTest?.({
      byteLength: stats.size,
      filename,
      mimeType,
    });
    return {
      byteLength: stats.size,
      bytes: await readFileDescriptorBytes({ byteLength: stats.size, fileDescriptor }),
      mimeType,
    };
  } finally {
    if (fileDescriptor !== null) {
      closeSync(fileDescriptor);
    }
  }
}

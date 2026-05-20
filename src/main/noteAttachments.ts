import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  mkdirSync,
  readFileSync,
  writeSync,
} from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  assertSameDirectoryIdentity,
  readSafeDirectoryIdentity,
  readSafeDirectoryIdentitySync,
  type DirectoryIdentity,
} from './directoryIdentity.js';
import {
  resolveFinalizedNoteSegmentDirectoryFromManifest,
  resolveFinalizedNoteSupplementDirectoryFromManifest,
} from './memoryFiles.js';
import {
  fsyncCurrentWorkspaceDirectoryBestEffort,
  openExistingWorkspaceFileInDirectory,
  openNoReplaceWorkspaceFileInDirectory,
  readWorkspaceDirectoryEntriesInDirectory,
  removeWorkspaceFileInDirectory,
  runInWorkspaceDirectorySync,
} from './workspaceDirectoryTransactions.js';
import {
  workspaceError,
  type WorkspaceErrorEnvelope,
} from '../workspace-contract/workspace-contract.js';
import {
  parseWorkspaceMarkdownObject,
  type WorkspaceMarkdownObjectType,
} from './workspaceMarkdownObjects.js';

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const IMAGE_MIME_BY_EXTENSION = new Map([
  ['.gif', 'image/gif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

type AttachmentSaveResult =
  | {
      readonly ok: true;
      readonly relativePath: string;
    }
  | WorkspaceErrorEnvelope;

type AttachmentListResult =
  | {
      readonly ok: true;
      readonly attachments: readonly {
        readonly relativePath: string;
        readonly byteLength: number;
        readonly mimeType: string;
      }[];
    }
  | WorkspaceErrorEnvelope;

type SegmentAttachmentInput = {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
};

type SegmentSupplementAttachmentInput = SegmentAttachmentInput & {
  readonly supplementId: string;
};

type AttachmentProtocolResolution =
  | {
      readonly ok: true;
      readonly bytes: Uint8Array;
      readonly mimeType: string;
    }
  | WorkspaceErrorEnvelope;

type SafeAttachmentsDirectory = {
  readonly attachmentsDirectory: string;
  readonly directoryIdentity: DirectoryIdentity;
};

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { readonly code?: unknown }).code === code
  );
}

function isContainedPath(parentAbsolute: string, candidateAbsolute: string): boolean {
  const relative = path.relative(path.resolve(parentAbsolute), path.resolve(candidateAbsolute));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function extensionForMime(mimeType: string, originalFilename: string): string | null {
  const normalizedMime = mimeType.toLowerCase();
  const originalExtension = path.extname(originalFilename).toLowerCase();
  if (IMAGE_MIME_BY_EXTENSION.get(originalExtension) === normalizedMime) {
    return originalExtension;
  }
  for (const [extension, candidateMime] of IMAGE_MIME_BY_EXTENSION) {
    if (candidateMime === normalizedMime) {
      return extension;
    }
  }
  return null;
}

function safeBasename(originalFilename: string, extension: string): string {
  const parsed = path.parse(originalFilename);
  const base = (parsed.name || 'attachment')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${base || 'attachment'}${extension}`;
}

async function ensureSafeAttachmentsDirectory(
  ownerDirectory: string
): Promise<SafeAttachmentsDirectory> {
  const attachmentsDirectory = path.join(ownerDirectory, 'attachments');
  const ownerDirectoryIdentity = await readSafeDirectoryIdentity(
    ownerDirectory,
    'Attachment owner directory is unsafe'
  );
  let attachmentsDirectoryIdentity: DirectoryIdentity | null = null;
  runInWorkspaceDirectorySync(
    { directory: ownerDirectory, directoryIdentity: ownerDirectoryIdentity },
    () => {
      mkdirSyncNoRecursive('attachments');
      attachmentsDirectoryIdentity = readSafeDirectoryIdentitySync(
        'attachments',
        'Attachment directory is unsafe'
      );
    }
  );
  await assertSameDirectoryIdentity(
    ownerDirectory,
    ownerDirectoryIdentity,
    'Attachment owner directory changed'
  );
  const entry = await lstat(attachmentsDirectory);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment directory is unsafe');
  }
  const ownerRealPath = await realpath(ownerDirectory);
  const attachmentsRealPath = await realpath(attachmentsDirectory);
  if (!isContainedPath(ownerRealPath, attachmentsRealPath)) {
    throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment directory escapes its owner');
  }
  await assertSameDirectoryIdentity(
    ownerDirectory,
    ownerDirectoryIdentity,
    'Attachment owner directory changed'
  );
  if (!attachmentsDirectoryIdentity) {
    throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment directory is unsafe');
  }
  return { attachmentsDirectory, directoryIdentity: attachmentsDirectoryIdentity };
}

function mkdirSyncNoRecursive(directoryName: string): void {
  try {
    readSafeDirectoryIdentitySync(directoryName, 'Attachment directory is unsafe');
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) {
      throw error;
    }
    mkdirSync(directoryName);
  }
}

function fsyncAttachmentsDirectoryBestEffort({
  attachmentsDirectory,
  directoryIdentity,
}: {
  readonly attachmentsDirectory: string;
  readonly directoryIdentity: DirectoryIdentity;
}): void {
  runInWorkspaceDirectorySync({ directory: attachmentsDirectory, directoryIdentity }, () => {
    fsyncCurrentWorkspaceDirectoryBestEffort();
  });
}

function writeAllToFileDescriptor(fileDescriptor: number, payload: Uint8Array): void {
  let offset = 0;
  while (offset < payload.byteLength) {
    const written = writeSync(fileDescriptor, payload, offset, payload.byteLength - offset);
    if (written <= 0) {
      throw new Error('Attachment write made no progress');
    }
    offset += written;
  }
}

function readExistingAttachmentBytesInDirectory({
  attachmentsDirectory,
  directoryIdentity,
  filename,
}: {
  readonly attachmentsDirectory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly filename: string;
}): { readonly ok: true; readonly bytes: Uint8Array; readonly byteLength: number } {
  let fileDescriptor: number | null = null;
  try {
    fileDescriptor = openExistingWorkspaceFileInDirectory({
      directory: attachmentsDirectory,
      directoryIdentity,
      fileName: filename,
      flags: constants.O_RDONLY | constants.O_NOFOLLOW,
    });
    const stats = fstatSync(fileDescriptor);
    if (!stats.isFile()) {
      throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment leaf is unsafe');
    }
    if (stats.size > MAX_ATTACHMENT_BYTES) {
      throw workspaceError('ERR_ATTACHMENT_TOO_LARGE', 'Attachment is too large');
    }
    const bytes = readFileSync(fileDescriptor);
    return { ok: true, bytes, byteLength: stats.size };
  } finally {
    if (fileDescriptor !== null) {
      closeSync(fileDescriptor);
    }
  }
}

function existingAttachmentBytesMatchPayload({
  attachmentsDirectory,
  directoryIdentity,
  filename,
  payload,
}: {
  readonly attachmentsDirectory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly filename: string;
  readonly payload: Uint8Array;
}): boolean {
  const existing = readExistingAttachmentBytesInDirectory({
    attachmentsDirectory,
    directoryIdentity,
    filename,
  });
  if (existing.byteLength !== payload.byteLength) {
    return false;
  }
  return Buffer.compare(Buffer.from(existing.bytes), Buffer.from(payload)) === 0;
}

function readExistingAttachmentMetadataInDirectory({
  attachmentsDirectory,
  directoryIdentity,
  filename,
}: {
  readonly attachmentsDirectory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly filename: string;
}): { readonly ok: true; readonly byteLength: number } {
  let fileDescriptor: number | null = null;
  try {
    fileDescriptor = openExistingWorkspaceFileInDirectory({
      directory: attachmentsDirectory,
      directoryIdentity,
      fileName: filename,
      flags: constants.O_RDONLY | constants.O_NOFOLLOW,
    });
    const stats = fstatSync(fileDescriptor);
    if (!stats.isFile()) {
      throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment leaf is unsafe');
    }
    return { ok: true, byteLength: stats.size };
  } finally {
    if (fileDescriptor !== null) {
      closeSync(fileDescriptor);
    }
  }
}

async function resolveExistingSafeAttachmentsDirectory(ownerDirectory: string): Promise<{
  readonly attachmentsDirectory: string;
  readonly directoryIdentity: DirectoryIdentity;
}> {
  const attachmentsDirectory = path.join(ownerDirectory, 'attachments');
  const ownerDirectoryIdentity = await readSafeDirectoryIdentity(
    ownerDirectory,
    'Attachment owner directory is unsafe'
  );
  let attachmentsDirectoryIdentity: DirectoryIdentity | null = null;
  runInWorkspaceDirectorySync(
    { directory: ownerDirectory, directoryIdentity: ownerDirectoryIdentity },
    () => {
      attachmentsDirectoryIdentity = readSafeDirectoryIdentitySync(
        'attachments',
        'Attachment directory is unsafe'
      );
    }
  );
  await assertSameDirectoryIdentity(
    ownerDirectory,
    ownerDirectoryIdentity,
    'Attachment owner directory changed'
  );
  const entry = await lstat(attachmentsDirectory);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment directory is unsafe');
  }
  const ownerRealPath = await realpath(ownerDirectory);
  const attachmentsRealPath = await realpath(attachmentsDirectory);
  if (!isContainedPath(ownerRealPath, attachmentsRealPath)) {
    throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment directory escapes its owner');
  }
  await assertSameDirectoryIdentity(
    ownerDirectory,
    ownerDirectoryIdentity,
    'Attachment owner directory changed'
  );
  if (!attachmentsDirectoryIdentity) {
    throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment directory is unsafe');
  }
  return {
    attachmentsDirectory,
    directoryIdentity: attachmentsDirectoryIdentity,
  };
}

async function resolveNoteSegmentDirectory({
  memoryId,
  rootPath,
  segmentId,
  workspaceId,
}: SegmentAttachmentInput): Promise<string> {
  const { memoryId: manifestMemoryId, segmentDirectory } =
    await resolveFinalizedNoteSegmentDirectoryFromManifest({
      rootPath,
      workspaceId,
      segmentId,
    });
  if (manifestMemoryId !== memoryId) {
    throw workspaceError('ERR_WORKSPACE_METADATA_INVALID', 'Segment is not a note');
  }
  await assertNoteMarkdownOwner({
    objectType: 'segment',
    ownerDirectory: segmentDirectory,
    fileName: 'segment.md',
    invalidMessage: 'Segment is not a note',
  });
  return segmentDirectory;
}

async function assertNoteMarkdownOwner({
  fileName,
  invalidMessage,
  objectType,
  ownerDirectory,
}: {
  readonly fileName: string;
  readonly invalidMessage: string;
  readonly objectType: WorkspaceMarkdownObjectType;
  readonly ownerDirectory: string;
}): Promise<void> {
  const directoryIdentity = await readSafeDirectoryIdentity(
    ownerDirectory,
    'Attachment owner directory is unsafe'
  );
  let markdown = '';
  runInWorkspaceDirectorySync({ directory: ownerDirectory, directoryIdentity }, () => {
    let fileDescriptor: number | null = null;
    try {
      fileDescriptor = openExistingWorkspaceFileInDirectory({
        directory: ownerDirectory,
        directoryIdentity,
        fileName,
        flags: constants.O_RDONLY | constants.O_NOFOLLOW,
      });
      const stats = fstatSync(fileDescriptor);
      if (!stats.isFile()) {
        throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment owner is unsafe');
      }
      markdown = readFileSync(fileDescriptor, 'utf8');
    } finally {
      if (fileDescriptor !== null) {
        closeSync(fileDescriptor);
      }
    }
  });
  await assertSameDirectoryIdentity(
    ownerDirectory,
    directoryIdentity,
    'Attachment owner directory changed'
  );
  const parsed = parseWorkspaceMarkdownObject({
    markdown,
    objectType,
  });
  if (!('kind' in parsed.data) || parsed.data.kind !== 'note') {
    throw workspaceError('ERR_WORKSPACE_METADATA_INVALID', invalidMessage);
  }
}

async function resolveNoteSupplementDirectory({
  memoryId,
  rootPath,
  segmentId,
  supplementId,
  workspaceId,
}: SegmentSupplementAttachmentInput): Promise<string> {
  const resolved = await resolveFinalizedNoteSupplementDirectoryFromManifest({
    rootPath,
    workspaceId,
    segmentId,
    supplementId,
  });
  if (resolved.memoryId !== memoryId || resolved.segmentId !== segmentId) {
    throw workspaceError('ERR_WORKSPACE_METADATA_INVALID', 'Segment supplement is not a note');
  }
  await assertNoteMarkdownOwner({
    objectType: 'supplement',
    ownerDirectory: resolved.supplementDirectory,
    fileName: 'supplement.md',
    invalidMessage: 'Segment supplement is not a note',
  });
  return resolved.supplementDirectory;
}

function mapResolveError(error: unknown, missingCode: WorkspaceErrorEnvelope['error']['code']) {
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { readonly ok?: unknown }).ok === false
  ) {
    return error as WorkspaceErrorEnvelope;
  }
  if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTDIR')) {
    return workspaceError(missingCode, 'Attachment owner was not found');
  }
  return workspaceError('ERR_WORKSPACE_METADATA_INVALID', 'Attachment owner is invalid');
}

async function saveAttachmentFile({
  ownerDirectory,
  originalFilename,
  mimeType,
  payload,
}: {
  readonly ownerDirectory: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly payload: Uint8Array;
}): Promise<AttachmentSaveResult> {
  const extension = extensionForMime(mimeType, originalFilename);
  if (!extension) {
    return workspaceError('ERR_ATTACHMENT_UNSUPPORTED_MIME', 'Attachment MIME type is unsupported');
  }
  if (payload.byteLength > MAX_ATTACHMENT_BYTES) {
    return workspaceError('ERR_ATTACHMENT_TOO_LARGE', 'Attachment is too large');
  }

  try {
    const { attachmentsDirectory, directoryIdentity: attachmentsDirectoryIdentity } =
      await ensureSafeAttachmentsDirectory(ownerDirectory);
    const hash = createHash('sha256').update(payload).digest('hex').slice(0, 12);
    const filename = `${hash}--${safeBasename(originalFilename, extension)}`;
    const relativePath = `attachments/${filename}`;
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment path is unsafe');
    }

    let fileDescriptor: number | null = null;
    try {
      fileDescriptor = openNoReplaceWorkspaceFileInDirectory({
        directory: attachmentsDirectory,
        directoryIdentity: attachmentsDirectoryIdentity,
        fileName: filename,
      });
      writeAllToFileDescriptor(fileDescriptor, payload);
      fsyncSync(fileDescriptor);
      await assertSameDirectoryIdentity(
        attachmentsDirectory,
        attachmentsDirectoryIdentity,
        'Attachment directory changed during write'
      );
      fsyncAttachmentsDirectoryBestEffort({
        attachmentsDirectory,
        directoryIdentity: attachmentsDirectoryIdentity,
      });
    } catch (error) {
      if (fileDescriptor !== null) {
        closeSync(fileDescriptor);
        fileDescriptor = null;
      }
      if (hasErrorCode(error, 'EEXIST')) {
        try {
          const existingMatchesPayload = existingAttachmentBytesMatchPayload({
            attachmentsDirectory,
            directoryIdentity: attachmentsDirectoryIdentity,
            filename,
            payload,
          });
          if (!existingMatchesPayload) {
            return workspaceError('ERR_ATTACHMENT_WRITE_FAILED', 'Attachment filename is occupied');
          }
          return { ok: true, relativePath };
        } catch {
          return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment leaf is unsafe');
        }
      }
      try {
        removeWorkspaceFileInDirectory({
          directory: attachmentsDirectory,
          directoryIdentity: attachmentsDirectoryIdentity,
          fileName: filename,
        });
      } catch {
        // Cleanup only touches the original attachments directory identity.
      }
      return workspaceError('ERR_ATTACHMENT_WRITE_FAILED', 'Attachment could not be written');
    } finally {
      if (fileDescriptor !== null) {
        closeSync(fileDescriptor);
      }
    }
    return { ok: true, relativePath };
  } catch (error) {
    const envelope =
      typeof error === 'object' &&
      error !== null &&
      (error as { readonly ok?: unknown }).ok === false
        ? (error as WorkspaceErrorEnvelope)
        : null;
    return (
      envelope ?? workspaceError('ERR_ATTACHMENT_WRITE_FAILED', 'Attachment could not be written')
    );
  }
}

async function listAttachmentFiles(ownerDirectory: string): Promise<AttachmentListResult> {
  let attachmentsDirectory: string;
  let directoryIdentity: DirectoryIdentity;
  try {
    const resolved = await resolveExistingSafeAttachmentsDirectory(ownerDirectory);
    attachmentsDirectory = resolved.attachmentsDirectory;
    directoryIdentity = resolved.directoryIdentity;
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTDIR')) {
      return { ok: true, attachments: [] };
    }
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment directory is unsafe');
  }

  const attachments = [];
  for (const entry of readWorkspaceDirectoryEntriesInDirectory({
    directory: attachmentsDirectory,
    directoryIdentity,
  })) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment leaf is unsafe');
    }
    const extension = path.extname(entry.name).toLowerCase();
    const mimeType = IMAGE_MIME_BY_EXTENSION.get(extension);
    if (!mimeType) {
      continue;
    }
    try {
      const existing = readExistingAttachmentMetadataInDirectory({
        attachmentsDirectory,
        directoryIdentity,
        filename: entry.name,
      });
      attachments.push({
        relativePath: `attachments/${entry.name}`,
        byteLength: existing.byteLength,
        mimeType,
      });
    } catch {
      return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment leaf is unsafe');
    }
  }
  attachments.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return { ok: true, attachments };
}

async function resolveAttachmentFile({
  filename,
  ownerDirectory,
}: {
  readonly filename: string;
  readonly ownerDirectory: string;
}): Promise<AttachmentProtocolResolution> {
  const extension = path.extname(filename).toLowerCase();
  const mimeType = IMAGE_MIME_BY_EXTENSION.get(extension);
  if (
    !mimeType ||
    filename.length === 0 ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('..')
  ) {
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment path is unsafe');
  }

  try {
    const { attachmentsDirectory, directoryIdentity } =
      await resolveExistingSafeAttachmentsDirectory(ownerDirectory);
    const existing = readExistingAttachmentBytesInDirectory({
      attachmentsDirectory,
      directoryIdentity,
      filename,
    });
    await assertSameDirectoryIdentity(
      attachmentsDirectory,
      directoryIdentity,
      'Attachment directory changed during read'
    );
    return { ok: true, bytes: existing.bytes, mimeType };
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTDIR')) {
      return workspaceError('ERR_WORKSPACE_ATTACHMENT_NOT_FOUND', 'Attachment was not found');
    }
    const envelope =
      typeof error === 'object' &&
      error !== null &&
      (error as { readonly ok?: unknown }).ok === false
        ? (error as WorkspaceErrorEnvelope)
        : null;
    return envelope ?? workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Attachment path is unsafe');
  }
}

export async function resolveNoteSegmentAttachmentFile(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly segmentId: string;
  readonly filename: string;
}): Promise<AttachmentProtocolResolution> {
  try {
    const { segmentDirectory } = await resolveFinalizedNoteSegmentDirectoryFromManifest(input);
    return resolveAttachmentFile({ ownerDirectory: segmentDirectory, filename: input.filename });
  } catch {
    return workspaceError('ERR_WORKSPACE_ATTACHMENT_NOT_FOUND', 'Attachment was not found');
  }
}

export async function resolveNoteSegmentSupplementAttachmentFile(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly filename: string;
}): Promise<AttachmentProtocolResolution> {
  try {
    const { supplementDirectory } =
      await resolveFinalizedNoteSupplementDirectoryFromManifest(input);
    return resolveAttachmentFile({ ownerDirectory: supplementDirectory, filename: input.filename });
  } catch {
    return workspaceError('ERR_WORKSPACE_ATTACHMENT_NOT_FOUND', 'Attachment was not found');
  }
}

export async function saveNoteSegmentAttachment(
  input: SegmentAttachmentInput & {
    readonly originalFilename: string;
    readonly mimeType: string;
    readonly payload: Uint8Array;
  }
): Promise<AttachmentSaveResult> {
  try {
    const ownerDirectory = await resolveNoteSegmentDirectory(input);
    return saveAttachmentFile({ ownerDirectory, ...input });
  } catch (error) {
    return mapResolveError(error, 'ERR_WORKSPACE_SEGMENT_NOT_FOUND');
  }
}

export async function saveNoteSegmentSupplementAttachment(
  input: SegmentSupplementAttachmentInput & {
    readonly originalFilename: string;
    readonly mimeType: string;
    readonly payload: Uint8Array;
  }
): Promise<AttachmentSaveResult> {
  try {
    const ownerDirectory = await resolveNoteSupplementDirectory(input);
    return saveAttachmentFile({ ownerDirectory, ...input });
  } catch (error) {
    return mapResolveError(error, 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND');
  }
}

export async function listNoteSegmentAttachments(
  input: SegmentAttachmentInput
): Promise<AttachmentListResult> {
  try {
    const ownerDirectory = await resolveNoteSegmentDirectory(input);
    return listAttachmentFiles(ownerDirectory);
  } catch (error) {
    return mapResolveError(error, 'ERR_WORKSPACE_SEGMENT_NOT_FOUND');
  }
}

export async function listNoteSegmentSupplementAttachments(
  input: SegmentSupplementAttachmentInput
): Promise<AttachmentListResult> {
  try {
    const ownerDirectory = await resolveNoteSupplementDirectory(input);
    return listAttachmentFiles(ownerDirectory);
  } catch (error) {
    return mapResolveError(error, 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND');
  }
}

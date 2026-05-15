import {
  closeSync,
  constants,
  fsync as fsyncCallback,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  read as readCallback,
  readSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  unlinkSync,
  write as writeCallback,
} from 'node:fs';
import { lstat, open, readdir, realpath, utimes } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import {
  isUnsupportedDirectoryFsync,
  writeWorkspaceFileAtomicInKnownDirectory,
  writeWorkspaceJsonAtomicInKnownDirectory,
  writeWorkspaceJsonAtomic,
} from './atomicWorkspaceFile.js';
import {
  assertSameCurrentDirectoryIdentity as assertSameCurrentDirectory,
  assertSameDirectoryIdentity as assertSameDirectoryPathAsync,
  assertSameDirectoryIdentitySync as assertSameDirectoryPath,
  readSafeDirectoryIdentity as readDirectoryIdentity,
  readSafeDirectoryIdentitySync as readDirectoryIdentitySync,
  type DirectoryIdentity,
} from './directoryIdentity.js';
import {
  getWorkspaceIndexPath,
  resolveWorkspaceDraftAttachmentDirectory,
  resolveWorkspaceDraftSegmentDirectory,
} from './workspacePaths.js';
import {
  draftSegmentAttachmentMetadataSchema,
  draftSegmentMetadataSchema,
  finalizedSegmentAttachmentMetadataSchema,
  finalizedSegmentMetadataSchema,
  ATTACHMENT_ID_PATTERN,
  MEMORY_ID_PATTERN,
  SEGMENT_ID_PATTERN,
  isSafeWorkspaceDirectoryName,
  workspaceError,
  workspaceMemorySummarySchema,
  type FinalizedSegmentAttachmentMetadata,
  type FinalizedSegmentMetadata,
  type WorkspaceError,
  type WorkspaceErrorEnvelope,
  type WorkspaceMemoryDetailProjection,
  type WorkspaceSegmentAttachmentProjection,
  type WorkspaceSegmentProjection,
} from '../workspace-contract/workspace-contract.js';

const FINALIZE_STAGING_PREFIX = '.reo-finalizing-';
const FINALIZE_TRANSACTION_MARKER = '.reo-finalize-transaction.json';
const MAX_WORKSPACE_JSON_BYTES = 1_048_576;
const DRAFT_RECORDING_FILES = new Set(['audio.webm', 'segment.json', 'transcript.md']);
const DRAFT_ATTACHMENT_FILES = new Set(['audio.webm', 'attachment.json', 'transcript.md']);
const COPY_BUFFER_BYTES = 1_048_576;
const fsyncDescriptor = promisify(fsyncCallback);
const readDescriptor = promisify(readCallback);
const writeDescriptor = promisify(writeCallback);
const inFlightMemoryWrites = new Set<string>();
const workspaceIndexWriteQueues = new Map<string, Promise<void>>();
type MaybePromise<T> = T | Promise<T>;

class FinalizeTransactionFailure extends Error {
  readonly dataRetention: WorkspaceError['dataRetention'];

  constructor(error: unknown, dataRetention: WorkspaceError['dataRetention']) {
    super(error instanceof Error ? error.message : 'Finalize transaction failed');
    this.dataRetention = dataRetention;
  }
}

class FileWrittenIndexStale extends Error {
  constructor(error: unknown) {
    super(error instanceof Error ? error.message : 'Workspace index refresh failed');
  }
}

function finalizeFailureRetention(error: unknown): WorkspaceError['dataRetention'] {
  return error instanceof FinalizeTransactionFailure && error.dataRetention
    ? error.dataRetention
    : 'draft-preserved';
}

export interface MemoryJson {
  readonly memoryId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly segmentIds: readonly string[];
}

export interface MemorySummary {
  readonly memoryId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly segmentCount: number;
  readonly durationMs: number;
  readonly audioByteLength: number;
  readonly hasTranscript: boolean;
  readonly attachmentCount: number;
}

export interface MemorySegmentSummary {
  readonly segmentId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly audioByteLength: number;
}

interface FinalizedSegmentFileTruth {
  readonly segmentId: string;
  readonly recordingDirectory: string;
  readonly recordingDirectoryIdentity: DirectoryIdentity;
  readonly metadata: FinalizedSegmentMetadata;
  readonly audioByteLength: number;
}

export interface SegmentAttachmentSummary {
  readonly attachmentId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly audioByteLength: number;
}

export type SegmentDirectoryLookup =
  | {
      readonly status: 'found';
      readonly directory: string;
      readonly segment: MemorySegmentSummary;
    }
  | { readonly status: 'not-found' }
  | { readonly status: 'invalid-id' }
  | { readonly status: 'duplicate' }
  | { readonly status: 'invalid-durable' };

export interface FinalizeTransactionHooksForTest {
  readonly beforeParentDirectoryCreate?: () => MaybePromise<void>;
  readonly beforeMemoryDirectoryCreate?: () => MaybePromise<void>;
  readonly beforeMemoryDirectoryMkdir?: () => MaybePromise<void>;
  readonly beforeSegmentsDirectoryCreate?: () => MaybePromise<void>;
  readonly beforeSegmentsDirectoryMkdir?: () => MaybePromise<void>;
  readonly beforeStagingDirectoryCreate?: () => MaybePromise<void>;
  readonly afterStagingDirectoryCreate?: () => MaybePromise<void>;
  readonly afterMarkerWrite?: () => MaybePromise<void>;
  readonly beforeDraftCopy?: () => MaybePromise<void>;
  readonly afterCopy?: () => MaybePromise<void>;
  readonly afterStagingTreeFsync?: () => MaybePromise<void>;
  readonly beforeExpose?: () => MaybePromise<void>;
  readonly beforeFinalRename?: () => MaybePromise<void>;
  readonly beforeFinalRenameCommit?: () => void;
  readonly afterFinalRenameTargetPreflight?: () => void;
  readonly afterFinalRenameLastPreflight?: () => void;
  readonly afterParentFsync?: () => MaybePromise<void>;
  readonly beforeDraftCleanup?: () => MaybePromise<void>;
  readonly beforeDraftDirectoryRemove?: () => MaybePromise<void>;
  readonly afterDraftCleanup?: () => MaybePromise<void>;
  readonly beforeSafeCleanupRemove?: () => MaybePromise<void>;
}

type FinalizeTransactionHooks = FinalizeTransactionHooksForTest;
type AssertWorkspaceUsable = () => { readonly ok: true } | WorkspaceErrorEnvelope;

export interface SafeWorkspaceDirectoryRemoveOptions {
  readonly beforeSafeCleanupRemove?: () => MaybePromise<void>;
  readonly allowMissing?: boolean;
}

interface RecoverFinalizeTransactionsOptions {
  readonly removeDraftDirectory?: (draftDirectory: string) => Promise<void>;
  readonly beforeRecordingRecoveryRemove?: () => MaybePromise<void>;
  readonly afterDraftCleanup?: () => MaybePromise<void>;
  readonly assertWorkspaceUsable?: () => MaybePromise<void>;
}

export interface CreateMemoryForAudioSegmentInput {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly now: () => string;
  readonly rebuildIndex?: (rootPath: string) => Promise<readonly MemorySummary[]>;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

export interface CreateMemoryInput {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly title: string;
  readonly now: () => string;
  readonly rebuildIndex?: (rootPath: string) => Promise<readonly MemorySummary[]>;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

export type AppendAudioSegmentToMemoryInput = CreateMemoryForAudioSegmentInput;

export interface AppendAudioAttachmentToSegmentInput {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly attachmentId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly now: () => string;
  readonly rebuildIndex?: (rootPath: string) => Promise<readonly MemorySummary[]>;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

export type CreateMemoryForAudioSegmentForTestInput = CreateMemoryForAudioSegmentInput & {
  readonly transactionHooks?: FinalizeTransactionHooksForTest;
};

export type AppendAudioSegmentToMemoryForTestInput = AppendAudioSegmentToMemoryInput & {
  readonly transactionHooks?: FinalizeTransactionHooksForTest;
};

export interface MemoryTargetInput {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

export interface UpdateMemoryTitleInput extends MemoryTargetInput {
  readonly title: string;
  readonly now: () => string;
}

export interface UpdateSegmentTitleInput extends MemoryTargetInput {
  readonly workspaceId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly now: () => string;
}

export interface UpdateSegmentAttachmentTitleInput extends MemoryTargetInput {
  readonly workspaceId: string;
  readonly segmentId: string;
  readonly attachmentId: string;
  readonly title: string;
}

export interface SegmentTargetInput extends MemoryTargetInput {
  readonly workspaceId: string;
  readonly segmentId: string;
}

export interface SegmentAttachmentTargetInput extends SegmentTargetInput {
  readonly attachmentId: string;
}

type MemoryFilesResult<T> = { readonly ok: true; readonly value: T } | WorkspaceErrorEnvelope;

let beforeReadModelReaddirForTest: (() => MaybePromise<void>) | null = null;
let beforeReadModelPersistForTest: (() => MaybePromise<void>) | null = null;
let beforeReadModelReplaceForTest: (() => MaybePromise<void>) | null = null;
let afterReadModelReplaceReadForTest: (() => MaybePromise<void>) | null = null;
let beforeRecordingLookupForTest: (() => MaybePromise<void>) | null = null;
let beforeDuplicateRecordingCheckForTest: (() => MaybePromise<void>) | null = null;
let beforeMemoryIndexEntryReadForTest: (() => MaybePromise<void>) | null = null;
let beforeFileSpaceNodeMoveForTest: (() => MaybePromise<void>) | null = null;
let beforeSegmentFileTruthListForTest: (() => MaybePromise<void>) | null = null;
let beforeSegmentDirectoryCandidateScanForTest:
  | ((input: {
      readonly parentDirectory: string;
      readonly memoryId: string;
      readonly segmentId: string;
    }) => MaybePromise<void>)
  | null = null;

class WorkspaceHandleLost extends Error {
  readonly envelope: WorkspaceErrorEnvelope;

  constructor(envelope: WorkspaceErrorEnvelope) {
    super(envelope.error.message);
    this.envelope = envelope;
  }
}

function assertWorkspaceUsable(assertUsable: AssertWorkspaceUsable | undefined): void {
  const usable = assertUsable?.();
  if (usable && !usable.ok) {
    throw new WorkspaceHandleLost(usable);
  }
}

function memoryFilesError(
  error: unknown,
  code: Parameters<typeof workspaceError>[0],
  message: string,
  dataRetention?: WorkspaceError['dataRetention']
): WorkspaceErrorEnvelope {
  return error instanceof WorkspaceHandleLost
    ? error.envelope
    : workspaceError(code, message, dataRetention);
}

function isMissingFileError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function isUnsafeWorkspacePathError(error: unknown): boolean {
  if (
    (error as NodeJS.ErrnoException).code === 'ELOOP' ||
    (error as NodeJS.ErrnoException).code === 'ENOTDIR'
  ) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('symlink') ||
    error.message.includes('escapes workspace') ||
    error.message.includes('not safe') ||
    error.message.includes('path changed') ||
    error.message.includes('unsafe')
  );
}

function updateMemoryTitleError(error: unknown): WorkspaceErrorEnvelope {
  if (error instanceof WorkspaceHandleLost) {
    return error.envelope;
  }

  if (
    isMissingFileError(error) ||
    (error instanceof Error && error.message === 'Invalid memory id')
  ) {
    return workspaceError('ERR_MEMORY_NOT_FOUND', 'Memory not found', 'none-written');
  }

  if (isUnsafeWorkspacePathError(error)) {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Memory path is unsafe',
      'previous-file-preserved'
    );
  }

  return workspaceError(
    'ERR_MEMORY_UPDATE_FAILED',
    'Memory title could not be updated',
    'previous-file-preserved'
  );
}

function updateSegmentTitleError(error: unknown): WorkspaceErrorEnvelope {
  if (error instanceof WorkspaceHandleLost) {
    return error.envelope;
  }

  if (
    isMissingFileError(error) ||
    (error instanceof Error &&
      (error.message === 'Invalid segment id' ||
        error.message === 'Finalized segment projection does not match file truth'))
  ) {
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Segment not found', 'none-written');
  }

  if (isUnsafeWorkspacePathError(error)) {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Segment path is unsafe',
      'previous-file-preserved'
    );
  }

  return workspaceError(
    'ERR_MEMORY_UPDATE_FAILED',
    'Segment title could not be updated',
    'previous-file-preserved'
  );
}

function updateSegmentAttachmentTitleError(error: unknown): WorkspaceErrorEnvelope {
  if (error instanceof WorkspaceHandleLost) {
    return error.envelope;
  }

  if (error instanceof FileWrittenIndexStale) {
    return workspaceError(
      'ERR_MEMORY_UPDATE_FAILED',
      'Segment attachment title was updated but the memory index is stale',
      'file-written-index-stale'
    );
  }

  if (
    isMissingFileError(error) ||
    (error instanceof Error &&
      (error.message === 'Invalid segment attachment id' ||
        error.message === 'Finalized segment attachment projection does not match file truth'))
  ) {
    return workspaceError(
      'ERR_RECORDING_NOT_FOUND',
      'Segment attachment not found',
      'none-written'
    );
  }

  if (isUnsafeWorkspacePathError(error)) {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Segment attachment path is unsafe',
      'previous-file-preserved'
    );
  }

  return workspaceError(
    'ERR_MEMORY_UPDATE_FAILED',
    'Segment attachment title could not be updated',
    'previous-file-preserved'
  );
}

function segmentDeleteError(
  error: unknown,
  dataRetention: WorkspaceError['dataRetention']
): WorkspaceErrorEnvelope {
  if (error instanceof WorkspaceHandleLost) {
    return {
      ok: false,
      error: {
        ...error.envelope.error,
        dataRetention: error.envelope.error.dataRetention ?? dataRetention,
      },
    };
  }

  if (
    isMissingFileError(error) ||
    (error instanceof Error &&
      (error.message === 'Invalid segment id' ||
        error.message === 'Finalized segment projection does not match file truth'))
  ) {
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Segment not found', 'none-written');
  }

  if (isUnsafeWorkspacePathError(error)) {
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Segment path is unsafe', dataRetention);
  }

  return workspaceError('ERR_SEGMENT_DELETE_FAILED', 'Segment could not be deleted', dataRetention);
}

function segmentRestoreError(
  error: unknown,
  dataRetention: WorkspaceError['dataRetention']
): WorkspaceErrorEnvelope {
  if (error instanceof WorkspaceHandleLost) {
    return {
      ok: false,
      error: {
        ...error.envelope.error,
        dataRetention: error.envelope.error.dataRetention ?? dataRetention,
      },
    };
  }

  if (error instanceof Error && error.message === 'Segment restore parent memory missing') {
    return workspaceError(
      'ERR_SEGMENT_RESTORE_PARENT_MISSING',
      'Deleted Segment parent Memory is missing',
      'previous-file-preserved'
    );
  }

  if (error instanceof Error && error.message === 'Invalid segment id') {
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Segment not found', 'none-written');
  }

  if (isUnsafeWorkspacePathError(error)) {
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Segment path is unsafe', dataRetention);
  }

  return workspaceError(
    'ERR_SEGMENT_RESTORE_FAILED',
    'Deleted Segment could not be restored',
    dataRetention
  );
}

function segmentAttachmentDeleteError(
  error: unknown,
  dataRetention: WorkspaceError['dataRetention']
): WorkspaceErrorEnvelope {
  if (error instanceof WorkspaceHandleLost) {
    return {
      ok: false,
      error: {
        ...error.envelope.error,
        dataRetention: error.envelope.error.dataRetention ?? dataRetention,
      },
    };
  }

  if (
    isMissingFileError(error) ||
    (error instanceof Error &&
      (error.message === 'Invalid segment attachment id' ||
        error.message === 'Finalized segment attachment projection does not match file truth'))
  ) {
    return workspaceError(
      'ERR_RECORDING_NOT_FOUND',
      'Segment attachment not found',
      'none-written'
    );
  }

  if (isUnsafeWorkspacePathError(error)) {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Segment attachment path is unsafe',
      dataRetention
    );
  }

  return workspaceError(
    'ERR_SEGMENT_ATTACHMENT_DELETE_FAILED',
    'Segment attachment could not be deleted',
    dataRetention
  );
}

function segmentAttachmentRestoreError(
  error: unknown,
  dataRetention: WorkspaceError['dataRetention']
): WorkspaceErrorEnvelope {
  if (error instanceof WorkspaceHandleLost) {
    return {
      ok: false,
      error: {
        ...error.envelope.error,
        dataRetention: error.envelope.error.dataRetention ?? dataRetention,
      },
    };
  }

  if (error instanceof Error && error.message === 'Segment attachment restore parent missing') {
    return workspaceError(
      'ERR_SEGMENT_ATTACHMENT_RESTORE_PARENT_MISSING',
      'Deleted SegmentAttachment parent Memory or Segment is missing',
      'previous-file-preserved'
    );
  }

  if (error instanceof Error && error.message === 'Invalid segment attachment id') {
    return workspaceError(
      'ERR_RECORDING_NOT_FOUND',
      'Segment attachment not found',
      'none-written'
    );
  }

  if (isUnsafeWorkspacePathError(error)) {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Segment attachment path is unsafe',
      dataRetention
    );
  }

  return workspaceError(
    'ERR_SEGMENT_ATTACHMENT_RESTORE_FAILED',
    'Deleted SegmentAttachment could not be restored',
    dataRetention
  );
}

const memoryJsonSchema = z
  .object({
    memoryId: z.string().regex(MEMORY_ID_PATTERN),
    title: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    segmentIds: z.array(z.string().regex(SEGMENT_ID_PATTERN)),
  })
  .strict();

const workspaceIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    memories: z.array(workspaceMemorySummarySchema),
  })
  .strict();

async function resolveSafeWorkspaceChild(rootPath: string, candidatePath: string): Promise<string> {
  const canonicalRoot = await realpath(rootPath);
  let relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    relative = path.relative(canonicalRoot, path.resolve(candidatePath));
  }
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes workspace');
  }

  let current = canonicalRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) {
        throw new Error('Workspace path crosses a symlink');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        break;
      }
      throw error;
    }
  }

  const resolved = path.join(canonicalRoot, relative);
  const containment = path.relative(canonicalRoot, resolved);
  if (containment.startsWith('..') || path.isAbsolute(containment)) {
    throw new Error('Path escapes workspace');
  }
  return resolved;
}

interface WorkspaceDirectoryFsyncHandle {
  readonly sync: () => Promise<void>;
  readonly close: () => Promise<void>;
}

async function fsyncWorkspaceDirectoryWithOpen({
  directoryPath,
  openDirectory,
}: {
  readonly directoryPath: string;
  readonly openDirectory: (directoryPath: string) => Promise<WorkspaceDirectoryFsyncHandle>;
}): Promise<void> {
  let handle: WorkspaceDirectoryFsyncHandle | null = null;
  try {
    handle = await openDirectory(directoryPath);
    await handle.sync();
  } catch (error) {
    if (!isUnsupportedDirectoryFsync(error)) {
      throw error;
    }
  } finally {
    await handle?.close();
  }
}

async function fsyncWorkspaceDirectory(directoryPath: string): Promise<void> {
  await fsyncWorkspaceDirectoryWithOpen({
    directoryPath,
    openDirectory: (nextDirectoryPath) => open(nextDirectoryPath, 'r'),
  });
}

export async function fsyncWorkspaceDirectoryForTest({
  directoryPath,
  openDirectory,
}: {
  readonly directoryPath: string;
  readonly openDirectory: (directoryPath: string) => Promise<{
    readonly sync: () => Promise<void>;
    readonly close: () => Promise<void>;
  }>;
}): Promise<void> {
  await fsyncWorkspaceDirectoryWithOpen({ directoryPath, openDirectory });
}

export function setBeforeReadModelReaddirForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeReadModelReaddirForTest = hook;
}

export function setBeforeReadModelPersistForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeReadModelPersistForTest = hook;
}

export function setBeforeReadModelReplaceForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeReadModelReplaceForTest = hook;
}

export function setAfterReadModelReplaceReadForTest(hook: (() => MaybePromise<void>) | null): void {
  afterReadModelReplaceReadForTest = hook;
}

export function setBeforeRecordingLookupForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeRecordingLookupForTest = hook;
}

export function setBeforeDuplicateRecordingCheckForTest(
  hook: (() => MaybePromise<void>) | null
): void {
  beforeDuplicateRecordingCheckForTest = hook;
}

export function setBeforeMemoryIndexEntryReadForTest(
  hook: (() => MaybePromise<void>) | null
): void {
  beforeMemoryIndexEntryReadForTest = hook;
}

export function setBeforeFileSpaceNodeMoveForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeFileSpaceNodeMoveForTest = hook;
}

export function setBeforeSegmentFileTruthListForTest(
  hook: (() => MaybePromise<void>) | null
): void {
  beforeSegmentFileTruthListForTest = hook;
}

export function setBeforeSegmentDirectoryCandidateScanForTest(
  hook:
    | ((input: {
        readonly parentDirectory: string;
        readonly memoryId: string;
        readonly segmentId: string;
      }) => MaybePromise<void>)
    | null
): void {
  beforeSegmentDirectoryCandidateScanForTest = hook;
}

async function fsyncWorkspaceFile(filePath: string): Promise<void> {
  const handle = await open(filePath, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function readWorkspaceTextFileInKnownDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string
): string {
  const fd = openFileInDirectory({
    directory,
    directoryIdentity,
    fileName,
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
  try {
    const metadata = fstatSync(fd);
    if (!metadata.isFile()) {
      throw new Error('Workspace file is not safe');
    }
    if (metadata.size > MAX_WORKSPACE_JSON_BYTES) {
      throw new Error('Workspace file is too large');
    }
    const buffer = Buffer.allocUnsafe(metadata.size);
    let offset = 0;
    while (offset < metadata.size) {
      const bytesRead = readSync(fd, buffer, offset, metadata.size - offset, offset);
      if (bytesRead === 0) {
        throw new Error('Workspace file changed during read');
      }
      offset += bytesRead;
    }
    assertSameDirectoryPath(directory, directoryIdentity);
    return buffer.toString('utf8');
  } finally {
    closeSync(fd);
  }
}

async function readWorkspaceTextFile(filePath: string): Promise<string> {
  const directory = path.dirname(filePath);
  return readWorkspaceTextFileInKnownDirectory(
    directory,
    await readDirectoryIdentity(directory),
    path.basename(filePath)
  );
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function readExistingDirectoryEntries(directoryPath: string): Promise<Dirent[]> {
  try {
    return await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function readExistingDirectoryNames(directoryPath: string): Promise<string[]> {
  try {
    return await readdir(directoryPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function fileSpaceNodeDirectoryName(nodeId: string, title: string): string {
  const trimmedTitle = title.trim();
  if (!trimmedTitle || !isSafeWorkspaceDirectoryName(trimmedTitle)) {
    throw new Error('Invalid file-space node title');
  }
  return `${nodeId}--${trimmedTitle}`;
}

function titleFromFileSpaceDirectoryName({
  nodeId,
  directoryName,
  metadataTitle,
}: {
  readonly nodeId: string;
  readonly directoryName: string;
  readonly metadataTitle: string;
}): string {
  if (directoryName === nodeId) {
    return metadataTitle;
  }
  const generatedPrefix = `${nodeId}--`;
  if (directoryName.startsWith(generatedPrefix)) {
    const title = directoryName.slice(generatedPrefix.length).trim();
    return title || metadataTitle;
  }
  return directoryName;
}

function latestIsoTimestamp(...timestamps: readonly string[]): string {
  return timestamps.reduce((latest, current) =>
    current.localeCompare(latest) > 0 ? current : latest
  );
}

function sortByProjectedUpdatedAt<
  T extends { readonly updatedAt: string; readonly createdAt: string },
>(items: readonly T[]): T[] {
  return [...items].sort((first, second) => {
    const updatedComparison = second.updatedAt.localeCompare(first.updatedAt);
    if (updatedComparison !== 0) {
      return updatedComparison;
    }
    return second.createdAt.localeCompare(first.createdAt);
  });
}

async function touchWorkspacePathBestEffort(targetPath: string, timestamp: string): Promise<void> {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) {
    return;
  }
  await utimes(targetPath, date, date).catch(() => {});
}

function mergeSegmentIdsFromFileTruth(
  metadataSegmentIds: readonly string[],
  fileTruthSegmentIds: readonly string[]
): string[] {
  const fileTruthSet = new Set(fileTruthSegmentIds);
  const merged = metadataSegmentIds.filter((segmentId) => fileTruthSet.has(segmentId));
  const mergedSet = new Set(merged);
  for (const segmentId of fileTruthSegmentIds) {
    if (!mergedSet.has(segmentId)) {
      merged.push(segmentId);
      mergedSet.add(segmentId);
    }
  }
  return merged;
}

function sameSegmentIds(first: readonly string[], second: readonly string[]): boolean {
  return (
    first.length === second.length && first.every((segmentId, index) => segmentId === second[index])
  );
}

async function writeMemorySegmentIdsMirror({
  rootPath,
  memoryId,
  memory,
  segmentIds,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly memory: MemoryJson;
  readonly segmentIds: readonly string[];
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<MemoryJson> {
  if (sameSegmentIds(memory.segmentIds, segmentIds)) {
    return memory;
  }

  const nextMemory = {
    ...memory,
    segmentIds,
  };
  await writeWorkspaceJsonAtomic(
    path.join(await memoryDirectory(rootPath, memoryId), 'memory.json'),
    nextMemory,
    () => assertWorkspaceUsable(assertUsable)
  );
  return nextMemory;
}

async function hasFinalizeTransactionMarker(recordingDirectory: string): Promise<boolean> {
  try {
    const marker = await lstat(path.join(recordingDirectory, FINALIZE_TRANSACTION_MARKER));
    return marker.isFile() && !marker.isSymbolicLink();
  } catch {
    return false;
  }
}

async function finalizedPayloadExists(directory: string): Promise<boolean> {
  return (
    (await exists(path.join(directory, 'segment.json'))) ||
    (await exists(path.join(directory, 'audio.webm')))
  );
}

async function finalizedAttachmentPayloadExists(directory: string): Promise<boolean> {
  return (
    (await exists(path.join(directory, 'attachment.json'))) ||
    (await exists(path.join(directory, 'audio.webm')))
  );
}

async function unlinkFinalizeTransactionMarker(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<string> {
  const recordingDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
  await unlinkFinalizeTransactionMarkerInDirectory(recordingDirectory);
  return recordingDirectory;
}

async function unlinkFinalizeTransactionMarkerInDirectory(directory: string): Promise<void> {
  const directoryIdentity = await readDirectoryIdentity(
    directory,
    'Recording target path is not safe'
  );
  const previousCwd = process.cwd();
  try {
    process.chdir(directory);
    assertSameCurrentDirectory(directoryIdentity);
    unlinkSync(FINALIZE_TRANSACTION_MARKER);
    assertSameCurrentDirectory(directoryIdentity);
    fsyncCurrentDirectoryBestEffort();
  } finally {
    process.chdir(previousCwd);
  }
}

async function withMemoryWriteLock<T>(
  rootPath: string,
  memoryId: string,
  write: () => Promise<T>
): Promise<T> {
  const key = `${path.resolve(rootPath)}:${memoryId}`;
  if (inFlightMemoryWrites.has(key)) {
    throw new Error('Memory write already in flight');
  }
  inFlightMemoryWrites.add(key);
  try {
    return await write();
  } finally {
    inFlightMemoryWrites.delete(key);
  }
}

async function withWorkspaceIndexWriteLock<T>(
  rootPath: string,
  write: () => Promise<T>
): Promise<T> {
  const key = path.resolve(rootPath);
  const previous = workspaceIndexWriteQueues.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = previous
    .catch(() => {})
    .then(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
  workspaceIndexWriteQueues.set(key, current);
  await previous.catch(() => {});
  try {
    return await write();
  } finally {
    release();
    if (workspaceIndexWriteQueues.get(key) === current) {
      workspaceIndexWriteQueues.delete(key);
    }
  }
}

async function fsyncDirectoryTree(directoryPath: string): Promise<void> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    const metadata = await lstat(entryPath);
    if (metadata.isSymbolicLink()) {
      throw new Error('Workspace transaction path crosses a symlink');
    }
    if (metadata.isDirectory()) {
      await fsyncDirectoryTree(entryPath);
      continue;
    }
    if (metadata.isFile()) {
      await fsyncWorkspaceFile(entryPath);
    }
  }
  await fsyncWorkspaceDirectory(directoryPath);
}

async function readMemoryJsonFromDirectory(directory: string): Promise<MemoryJson> {
  const memory = memoryJsonSchema.parse(
    JSON.parse(await readWorkspaceTextFile(path.join(directory, 'memory.json')))
  );
  return {
    ...memory,
    title: titleFromFileSpaceDirectoryName({
      nodeId: memory.memoryId,
      directoryName: path.basename(directory),
      metadataTitle: memory.title,
    }),
  };
}

async function memoryDirectoryInParent({
  defaultDirectoryName,
  memoryId,
  parentDirectory,
  rootPath,
}: {
  readonly defaultDirectoryName: string;
  readonly memoryId: string;
  readonly parentDirectory: string;
  readonly rootPath: string;
}): Promise<string> {
  if (!MEMORY_ID_PATTERN.test(memoryId)) {
    throw new Error('Invalid memory id');
  }
  const safeParentDirectory = await resolveSafeWorkspaceChild(rootPath, parentDirectory);
  const entries = await readExistingDirectoryEntries(safeParentDirectory);
  const matches: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const candidate = await resolveSafeWorkspaceChild(
      rootPath,
      path.join(safeParentDirectory, entry.name)
    );
    try {
      const memory = await readMemoryJsonFromDirectory(candidate);
      if (memory.memoryId === memoryId) {
        matches.push(candidate);
      }
    } catch {
      continue;
    }
  }
  if (matches.length > 1) {
    throw new Error('Duplicate memory id');
  }
  return (
    matches[0] ??
    resolveSafeWorkspaceChild(rootPath, path.join(safeParentDirectory, defaultDirectoryName))
  );
}

async function memoryDirectory(rootPath: string, memoryId: string): Promise<string> {
  return memoryDirectoryInParent({
    defaultDirectoryName: memoryId,
    memoryId,
    parentDirectory: path.join(rootPath, 'memories'),
    rootPath,
  });
}

async function trashedMemoryDirectory(rootPath: string, memoryId: string): Promise<string> {
  return memoryDirectoryInParent({
    defaultDirectoryName: memoryId,
    memoryId,
    parentDirectory: path.join(rootPath, '.reo', 'trash', 'memories'),
    rootPath,
  });
}

async function memoryDirectoryForNewNode(
  rootPath: string,
  memoryId: string,
  title: string
): Promise<string> {
  return resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories', fileSpaceNodeDirectoryName(memoryId, title))
  );
}

async function memoryDirectoryForWriteTarget(
  rootPath: string,
  memoryId: string,
  titleForNewNode?: string
): Promise<string> {
  const currentDirectory = await memoryDirectory(rootPath, memoryId);
  if (await exists(currentDirectory)) {
    return currentDirectory;
  }
  return titleForNewNode
    ? memoryDirectoryForNewNode(rootPath, memoryId, titleForNewNode)
    : currentDirectory;
}

async function assertSafeExistingDirectory(directoryPath: string, message: string): Promise<void> {
  const entry = await lstat(directoryPath);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error(message);
  }
}

function fsyncCurrentDirectoryBestEffort(): void {
  let directoryFd: number | null = null;
  try {
    directoryFd = openSync('.', 'r');
    fsyncSync(directoryFd);
  } catch (error) {
    if (!isUnsupportedDirectoryFsync(error)) {
      throw error;
    }
  } finally {
    if (directoryFd !== null) {
      closeSync(directoryFd);
    }
  }
}

function renameWorkspaceDirectoryWithinParent({
  parentDirectory,
  sourceName,
  targetName,
  beforeCommit,
  afterTargetPreflight,
  afterLastTargetPreflight,
}: {
  readonly parentDirectory: string;
  readonly sourceName: string;
  readonly targetName: string;
  readonly beforeCommit?: () => void;
  readonly afterTargetPreflight?: () => void;
  readonly afterLastTargetPreflight?: () => void;
}): void {
  const parentIdentity = readDirectoryIdentitySync(parentDirectory);
  const previousCwd = process.cwd();
  try {
    process.chdir(parentDirectory);
    const assertTargetMissing = () => {
      try {
        lstatSync(targetName);
        throw new Error('Recording target already exists');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    };
    assertSameCurrentDirectory(parentIdentity);
    assertSameDirectoryPath(parentDirectory, parentIdentity);
    assertSameCurrentDirectory(parentIdentity);
    const sourceIdentity = readDirectoryIdentitySync(
      sourceName,
      'Recording staging path is not safe'
    );
    beforeCommit?.();
    assertSameCurrentDirectory(parentIdentity);
    assertSameDirectoryPath(parentDirectory, parentIdentity);
    assertTargetMissing();
    afterTargetPreflight?.();
    assertSameCurrentDirectory(parentIdentity);
    assertSameDirectoryPath(parentDirectory, parentIdentity);
    assertTargetMissing();
    assertSameDirectoryPath(sourceName, sourceIdentity, 'Recording staging path changed');
    afterLastTargetPreflight?.();
    mkdirSync(targetName);
    let targetCreated = true;
    const targetIdentity = readDirectoryIdentitySync(
      targetName,
      'Recording target path is not safe'
    );
    try {
      renameSync(
        path.join(sourceName, FINALIZE_TRANSACTION_MARKER),
        path.join(targetName, FINALIZE_TRANSACTION_MARKER)
      );
      for (const entryName of readdirSync(sourceName)) {
        renameSync(path.join(sourceName, entryName), path.join(targetName, entryName));
      }
      rmdirSync(sourceName);
      targetCreated = false;
    } catch (error) {
      if (targetCreated) {
        assertSameDirectoryPath(targetName, targetIdentity, 'Recording target path changed');
        rmSync(targetName, { recursive: true, force: true });
      }
      throw error;
    }
    assertSameDirectoryPath(targetName, targetIdentity, 'Recording target path changed');
    assertSameDirectoryPath(parentDirectory, parentIdentity);
    assertSameCurrentDirectory(parentIdentity);
    fsyncCurrentDirectoryBestEffort();
  } finally {
    process.chdir(previousCwd);
  }
}

function renameWorkspaceDirectoryAcrossParents({
  sourceParentDirectory,
  sourceName,
  targetParentDirectory,
  targetName,
  beforeCommit,
  expectedSourceIdentity,
}: {
  readonly sourceParentDirectory: string;
  readonly sourceName: string;
  readonly targetParentDirectory: string;
  readonly targetName: string;
  readonly beforeCommit?: () => void;
  readonly expectedSourceIdentity?: DirectoryIdentity;
}): void {
  const sourceParentIdentity = readDirectoryIdentitySync(sourceParentDirectory);
  const targetParentIdentity = readDirectoryIdentitySync(targetParentDirectory);
  const targetPath = path.join(targetParentDirectory, targetName);
  const assertTargetMissing = () => {
    try {
      lstatSync(targetPath);
      throw new Error('Memory target already exists');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  };
  const previousCwd = process.cwd();
  try {
    process.chdir(sourceParentDirectory);
    assertSameCurrentDirectory(sourceParentIdentity);
    assertSameDirectoryPath(sourceParentDirectory, sourceParentIdentity);
    assertSameDirectoryPath(targetParentDirectory, targetParentIdentity);
    const sourceIdentity =
      expectedSourceIdentity ??
      readDirectoryIdentitySync(sourceName, 'Memory source path is not safe');
    if (expectedSourceIdentity) {
      assertSameDirectoryPath(sourceName, expectedSourceIdentity, 'Memory source path changed');
    }
    assertTargetMissing();
    beforeCommit?.();
    assertSameCurrentDirectory(sourceParentIdentity);
    assertSameDirectoryPath(sourceParentDirectory, sourceParentIdentity);
    assertSameDirectoryPath(targetParentDirectory, targetParentIdentity);
    assertSameDirectoryPath(sourceName, sourceIdentity, 'Memory source path changed');
    assertTargetMissing();
    renameSync(sourceName, targetPath);
    assertSameDirectoryPath(targetPath, sourceIdentity, 'Memory target path changed');
    assertSameCurrentDirectory(sourceParentIdentity);
    fsyncCurrentDirectoryBestEffort();
    process.chdir(targetParentDirectory);
    assertSameCurrentDirectory(targetParentIdentity);
    fsyncCurrentDirectoryBestEffort();
  } finally {
    process.chdir(previousCwd);
  }
}

async function ensureTrashNodeDirectory({
  assertUsable,
  directoryName,
  directoryUnsafeMessage,
  rootPath,
}: {
  readonly assertUsable?: AssertWorkspaceUsable;
  readonly directoryName: string;
  readonly directoryUnsafeMessage: string;
  readonly rootPath: string;
}): Promise<string> {
  const reoDirectory = await resolveSafeWorkspaceChild(rootPath, path.join(rootPath, '.reo'));
  await assertSafeExistingDirectory(reoDirectory, 'Workspace .reo directory is not safe');
  assertWorkspaceUsable(assertUsable);
  createWorkspaceDirectoryWithinParent({
    parentDirectory: reoDirectory,
    directoryName: 'trash',
    allowExisting: true,
    ...(assertUsable ? { beforeCommit: () => assertWorkspaceUsable(assertUsable) } : {}),
  });
  const trashDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, '.reo', 'trash')
  );
  await assertSafeExistingDirectory(trashDirectory, 'Workspace trash directory is not safe');
  assertWorkspaceUsable(assertUsable);
  createWorkspaceDirectoryWithinParent({
    parentDirectory: trashDirectory,
    directoryName,
    allowExisting: true,
    ...(assertUsable ? { beforeCommit: () => assertWorkspaceUsable(assertUsable) } : {}),
  });
  const nodeTrashDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, '.reo', 'trash', directoryName)
  );
  await assertSafeExistingDirectory(nodeTrashDirectory, directoryUnsafeMessage);
  return nodeTrashDirectory;
}

async function ensureMemoryTrashDirectory(
  rootPath: string,
  assertUsable?: AssertWorkspaceUsable
): Promise<string> {
  return ensureTrashNodeDirectory({
    directoryName: 'memories',
    directoryUnsafeMessage: 'Workspace memory trash directory is not safe',
    rootPath,
    ...(assertUsable ? { assertUsable } : {}),
  });
}

async function ensureSegmentTrashDirectory(
  rootPath: string,
  assertUsable?: AssertWorkspaceUsable
): Promise<string> {
  return ensureTrashNodeDirectory({
    directoryName: 'segments',
    directoryUnsafeMessage: 'Workspace segment trash directory is not safe',
    rootPath,
    ...(assertUsable ? { assertUsable } : {}),
  });
}

async function ensureSegmentAttachmentTrashDirectory(
  rootPath: string,
  assertUsable?: AssertWorkspaceUsable
): Promise<string> {
  return ensureTrashNodeDirectory({
    directoryName: 'attachments',
    directoryUnsafeMessage: 'Workspace segment attachment trash directory is not safe',
    rootPath,
    ...(assertUsable ? { assertUsable } : {}),
  });
}

function createWorkspaceDirectoryWithinParent({
  parentDirectory,
  directoryName,
  allowExisting = false,
  beforeCommit,
}: {
  readonly parentDirectory: string;
  readonly directoryName: string;
  readonly allowExisting?: boolean;
  readonly beforeCommit?: () => void;
}): void {
  const parentIdentity = readDirectoryIdentitySync(parentDirectory);
  const previousCwd = process.cwd();
  let directoryCreated = false;
  try {
    process.chdir(parentDirectory);
    assertSameCurrentDirectory(parentIdentity);
    beforeCommit?.();
    try {
      mkdirSync(directoryName);
      directoryCreated = true;
    } catch (error) {
      if (!allowExisting || (error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
      const existing = lstatSync(directoryName);
      if (!existing.isDirectory() || existing.isSymbolicLink()) {
        throw error;
      }
    }
    assertSameDirectoryPath(parentDirectory, parentIdentity);
    assertSameCurrentDirectory(parentIdentity);
    fsyncCurrentDirectoryBestEffort();
    directoryCreated = false;
  } catch (error) {
    if (directoryCreated) {
      rmSync(directoryName, { force: true, recursive: true });
    }
    throw error;
  } finally {
    process.chdir(previousCwd);
  }
}

async function ensureMemorySegmentsDirectory({
  assertUsable,
  memoryDirectoryPath,
  rootPath,
}: {
  readonly assertUsable?: AssertWorkspaceUsable;
  readonly memoryDirectoryPath: string;
  readonly rootPath: string;
}): Promise<string> {
  await assertSafeExistingDirectory(memoryDirectoryPath, 'Workspace memory directory is not safe');
  assertWorkspaceUsable(assertUsable);
  createWorkspaceDirectoryWithinParent({
    parentDirectory: memoryDirectoryPath,
    directoryName: 'segments',
    allowExisting: true,
    ...(assertUsable ? { beforeCommit: () => assertWorkspaceUsable(assertUsable) } : {}),
  });
  const segmentsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(memoryDirectoryPath, 'segments')
  );
  await assertSafeExistingDirectory(segmentsDirectory, 'Workspace segments directory is not safe');
  return segmentsDirectory;
}

async function ensureMemoryRecordingsDirectory(
  rootPath: string,
  memoryId: string,
  memoryTitleForCreate?: string,
  hooks?: FinalizeTransactionHooks
): Promise<string> {
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  await assertSafeExistingDirectory(memoriesDirectory, 'Workspace memories directory is not safe');

  const directory = await memoryDirectoryForWriteTarget(rootPath, memoryId, memoryTitleForCreate);
  await hooks?.beforeMemoryDirectoryCreate?.();
  const currentDirectory = await memoryDirectoryForWriteTarget(
    rootPath,
    memoryId,
    memoryTitleForCreate
  );
  if (currentDirectory !== directory) {
    throw new Error('Workspace memory directory changed');
  }
  await hooks?.beforeMemoryDirectoryMkdir?.();
  const currentMemoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  if (currentMemoriesDirectory !== memoriesDirectory) {
    throw new Error('Workspace memories directory changed');
  }
  await assertSafeExistingDirectory(
    currentMemoriesDirectory,
    'Workspace memories directory is not safe'
  );
  if (!(await exists(currentDirectory))) {
    createWorkspaceDirectoryWithinParent({
      parentDirectory: currentMemoriesDirectory,
      directoryName: path.basename(currentDirectory),
      allowExisting: true,
    });
  }
  const createdDirectory = await memoryDirectoryForWriteTarget(
    rootPath,
    memoryId,
    memoryTitleForCreate
  );
  if (createdDirectory !== currentDirectory) {
    throw new Error('Workspace memory directory changed');
  }
  await assertSafeExistingDirectory(createdDirectory, 'Workspace memory directory is not safe');

  await hooks?.beforeSegmentsDirectoryCreate?.();
  const safeDirectory = await memoryDirectoryForWriteTarget(
    rootPath,
    memoryId,
    memoryTitleForCreate
  );
  if (safeDirectory !== createdDirectory) {
    throw new Error('Workspace memory directory changed');
  }
  await assertSafeExistingDirectory(safeDirectory, 'Workspace memory directory is not safe');
  const segmentsDirectory = path.join(safeDirectory, 'segments');
  await hooks?.beforeSegmentsDirectoryMkdir?.();
  const currentSafeDirectory = await memoryDirectoryForWriteTarget(
    rootPath,
    memoryId,
    memoryTitleForCreate
  );
  if (currentSafeDirectory !== safeDirectory) {
    throw new Error('Workspace memory directory changed');
  }
  await assertSafeExistingDirectory(currentSafeDirectory, 'Workspace memory directory is not safe');
  createWorkspaceDirectoryWithinParent({
    parentDirectory: currentSafeDirectory,
    directoryName: 'segments',
    allowExisting: true,
  });
  const safeRecordingsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(currentSafeDirectory, 'segments')
  );
  if (safeRecordingsDirectory !== segmentsDirectory) {
    throw new Error('Workspace memory segments directory changed');
  }
  await assertSafeExistingDirectory(
    safeRecordingsDirectory,
    'Workspace memory segments directory is not safe'
  );
  return safeRecordingsDirectory;
}

async function draftSegmentDirectory(rootPath: string, segmentId: string): Promise<string> {
  return resolveSafeWorkspaceChild(
    rootPath,
    resolveWorkspaceDraftSegmentDirectory(rootPath, segmentId)
  );
}

async function draftAttachmentDirectory(rootPath: string, attachmentId: string): Promise<string> {
  return resolveSafeWorkspaceChild(
    rootPath,
    resolveWorkspaceDraftAttachmentDirectory(rootPath, attachmentId)
  );
}

async function findFileSpaceNodeDirectoryInParent({
  beforeScan,
  defaultDirectoryName,
  duplicateMessage,
  matchesCandidate,
  nodeId,
  parentDirectory,
  rootPath,
  unsafeMessage,
}: {
  readonly beforeScan?: (safeParentDirectory: string) => MaybePromise<void>;
  readonly defaultDirectoryName: string;
  readonly duplicateMessage: string;
  readonly matchesCandidate: (
    candidate: string,
    candidateIdentity: DirectoryIdentity
  ) => boolean | Promise<boolean>;
  readonly nodeId: string;
  readonly parentDirectory: string;
  readonly rootPath: string;
  readonly unsafeMessage: string;
}): Promise<string> {
  const safeParentDirectory = await resolveSafeWorkspaceChild(rootPath, parentDirectory);
  await beforeScan?.(safeParentDirectory);
  const entries = await readExistingDirectoryEntries(safeParentDirectory);
  const matches: string[] = [];
  const generatedPrefix = `${nodeId}--`;
  const isLikelyCandidate = (entry: Dirent) =>
    entry.name === nodeId || entry.name.startsWith(generatedPrefix);
  const likelyEntries = entries.filter(isLikelyCandidate);
  const fallbackEntries = entries.filter(
    (entry) => entry.isDirectory() && !isLikelyCandidate(entry)
  );
  const inspectEntry = async (
    entry: Dirent,
    options?: { readonly rejectUnsafeCandidate?: boolean }
  ): Promise<void> => {
    const candidate = await resolveSafeWorkspaceChild(
      rootPath,
      path.join(safeParentDirectory, entry.name)
    );
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      if (options?.rejectUnsafeCandidate) {
        throw new Error(unsafeMessage);
      }
      return;
    }
    try {
      await assertSafeExistingDirectory(candidate, unsafeMessage);
      const candidateIdentity = await readDirectoryIdentity(candidate);
      if (await matchesCandidate(candidate, candidateIdentity)) {
        matches.push(candidate);
      }
    } catch (error) {
      if (options?.rejectUnsafeCandidate && isUnsafeWorkspacePathError(error)) {
        throw error;
      }
    }
  };

  for (const entry of likelyEntries) {
    await inspectEntry(entry, { rejectUnsafeCandidate: true });
  }
  if (matches.length === 0) {
    for (const entry of fallbackEntries) {
      await inspectEntry(entry);
    }
  }
  if (matches.length > 1) {
    throw new Error(duplicateMessage);
  }
  return (
    matches[0] ??
    resolveSafeWorkspaceChild(rootPath, path.join(safeParentDirectory, defaultDirectoryName))
  );
}

export async function memorySegmentDirectory(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<string> {
  const directory = await memoryDirectory(rootPath, memoryId);
  return segmentDirectoryInParent({
    defaultDirectoryName: segmentId,
    memoryId,
    parentDirectory: path.join(directory, 'segments'),
    rootPath,
    segmentId,
  });
}

async function segmentDirectoryInParent({
  defaultDirectoryName,
  memoryId,
  parentDirectory,
  rootPath,
  segmentId,
}: {
  readonly defaultDirectoryName: string;
  readonly memoryId: string;
  readonly parentDirectory: string;
  readonly rootPath: string;
  readonly segmentId: string;
}): Promise<string> {
  if (!SEGMENT_ID_PATTERN.test(segmentId)) {
    throw new Error('Invalid segment id');
  }
  return findFileSpaceNodeDirectoryInParent({
    beforeScan: (safeParentDirectory) =>
      beforeSegmentDirectoryCandidateScanForTest?.({
        parentDirectory: safeParentDirectory,
        memoryId,
        segmentId,
      }) ?? Promise.resolve(),
    defaultDirectoryName,
    duplicateMessage: 'Duplicate finalized segment id',
    matchesCandidate: async (candidate, candidateIdentity) => {
      const segment = await readFinalizedSegmentMetadata(candidate, candidateIdentity);
      return segment.memoryId === memoryId && segment.segmentId === segmentId;
    },
    nodeId: segmentId,
    parentDirectory,
    rootPath,
    unsafeMessage: 'Workspace segment directory is not safe',
  });
}

async function trashedSegmentDirectory(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<string> {
  return segmentDirectoryInParent({
    defaultDirectoryName: segmentId,
    memoryId,
    parentDirectory: path.join(rootPath, '.reo', 'trash', 'segments'),
    rootPath,
    segmentId,
  });
}

async function memorySegmentDirectoryForNewNode(
  rootPath: string,
  memoryId: string,
  segmentId: string,
  title: string
): Promise<string> {
  const directory = await memoryDirectory(rootPath, memoryId);
  return resolveSafeWorkspaceChild(
    rootPath,
    path.join(directory, 'segments', fileSpaceNodeDirectoryName(segmentId, title))
  );
}

async function ensureSegmentAttachmentsDirectory({
  rootPath,
  memoryId,
  segmentId,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<string> {
  const recordingDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
  await assertSafeExistingDirectory(recordingDirectory, 'Workspace segment directory is not safe');
  assertWorkspaceUsable(assertUsable);
  createWorkspaceDirectoryWithinParent({
    parentDirectory: recordingDirectory,
    directoryName: 'attachments',
    allowExisting: true,
    ...(assertUsable ? { beforeCommit: () => assertWorkspaceUsable(assertUsable) } : {}),
  });
  const attachmentsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(recordingDirectory, 'attachments')
  );
  await assertSafeExistingDirectory(
    attachmentsDirectory,
    'Workspace segment attachments directory is not safe'
  );
  return attachmentsDirectory;
}

async function segmentDirectoryExistsInAnyMemory(
  rootPath: string,
  segmentId: string
): Promise<boolean> {
  if (!SEGMENT_ID_PATTERN.test(segmentId)) {
    throw new Error('Invalid segment id');
  }
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  const entries = await readExistingDirectoryEntries(memoriesDirectory);
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const memory = await readMemoryJsonFromDirectory(path.join(memoriesDirectory, entry.name));
      if (await exists(await memorySegmentDirectory(rootPath, memory.memoryId, segmentId))) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

export async function assertNoDuplicateSegmentDirectoryById(
  rootPath: string,
  ownerMemoryId: string,
  segmentId: string
): Promise<void> {
  if (!MEMORY_ID_PATTERN.test(ownerMemoryId) || !SEGMENT_ID_PATTERN.test(segmentId)) {
    throw new Error('Invalid recording ownership');
  }
  await beforeDuplicateRecordingCheckForTest?.();
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  const entries = await readExistingDirectoryEntries(memoriesDirectory);
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    let memory: MemoryJson;
    try {
      memory = await readMemoryJsonFromDirectory(path.join(memoriesDirectory, entry.name));
    } catch {
      continue;
    }
    if (memory.memoryId === ownerMemoryId) {
      continue;
    }
    let candidate: string;
    try {
      candidate = await memorySegmentDirectory(rootPath, memory.memoryId, segmentId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Duplicate finalized segment id') {
        throw new Error('Duplicate finalized segment id', { cause: error });
      }
      throw error;
    }
    let metadata: Awaited<ReturnType<typeof lstat>>;
    try {
      metadata = await lstat(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    if (metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error('Duplicate finalized segment id');
    }
  }
}

async function readMemoryJson(rootPath: string, memoryId: string): Promise<MemoryJson> {
  const directory = await memoryDirectory(rootPath, memoryId);
  const memory = await readMemoryJsonFromDirectory(directory);
  if (memory.memoryId !== memoryId) {
    throw new Error('Memory metadata does not match directory id');
  }
  return memory;
}

function readFileSizeInKnownDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string
): number {
  const fd = openFileInDirectory({
    directory,
    directoryIdentity,
    fileName,
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
  try {
    const entry = fstatSync(fd);
    if (!entry.isFile()) {
      throw new Error('Workspace file is not safe');
    }
    assertSameDirectoryPath(directory, directoryIdentity);
    return entry.size;
  } finally {
    closeSync(fd);
  }
}

function hasNonEmptyFileInKnownDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string
): boolean {
  try {
    return readFileSizeInKnownDirectory(directory, directoryIdentity, fileName) > 0;
  } catch {
    return false;
  }
}

async function summarizeRecording(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<MemorySegmentSummary> {
  const fileTruth = await readValidFinalizedSegmentFileTruth(rootPath, memoryId, segmentId);
  if (!fileTruth) {
    throw new Error('Finalized segment metadata does not match file truth');
  }

  return {
    segmentId,
    title: titleFromFileSpaceDirectoryName({
      nodeId: segmentId,
      directoryName: path.basename(fileTruth.recordingDirectory),
      metadataTitle: fileTruth.metadata.title,
    }),
    durationMs: fileTruth.metadata.durationMs,
    audioByteLength: fileTruth.audioByteLength,
  };
}

async function summarizeValidFinalizedSegmentDirectory(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<MemorySegmentSummary | null> {
  try {
    return await summarizeRecording(rootPath, memoryId, segmentId);
  } catch {
    return null;
  }
}

async function readFinalizedSegmentMetadata(
  recordingDirectory: string,
  recordingDirectoryIdentity?: DirectoryIdentity
): Promise<FinalizedSegmentMetadata> {
  const directoryIdentity =
    recordingDirectoryIdentity ?? (await readDirectoryIdentity(recordingDirectory));
  return finalizedSegmentMetadataSchema.parse(
    JSON.parse(
      readWorkspaceTextFileInKnownDirectory(recordingDirectory, directoryIdentity, 'segment.json')
    )
  );
}

function readFinalizedSegmentAttachmentMetadata(
  attachmentDirectory: string,
  attachmentDirectoryIdentity?: DirectoryIdentity
): FinalizedSegmentAttachmentMetadata {
  const directoryIdentity =
    attachmentDirectoryIdentity ?? readDirectoryIdentitySync(attachmentDirectory);
  return finalizedSegmentAttachmentMetadataSchema.parse(
    JSON.parse(
      readWorkspaceTextFileInKnownDirectory(
        attachmentDirectory,
        directoryIdentity,
        'attachment.json'
      )
    )
  );
}

async function segmentAttachmentsDirectory(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<string> {
  const recordingDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
  return path.join(recordingDirectory, 'attachments');
}

export async function segmentAttachmentDirectory(
  rootPath: string,
  memoryId: string,
  segmentId: string,
  attachmentId: string
): Promise<string> {
  if (!ATTACHMENT_ID_PATTERN.test(attachmentId)) {
    throw new Error('Invalid segment attachment id');
  }
  const attachmentsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    await segmentAttachmentsDirectory(rootPath, memoryId, segmentId)
  );
  return findFileSpaceNodeDirectoryInParent({
    defaultDirectoryName: attachmentId,
    duplicateMessage: 'Duplicate segment attachment id',
    matchesCandidate: (candidate, candidateIdentity) => {
      const attachment = readFinalizedSegmentAttachmentMetadata(candidate, candidateIdentity);
      return (
        attachment.memoryId === memoryId &&
        attachment.segmentId === segmentId &&
        attachment.attachmentId === attachmentId
      );
    },
    nodeId: attachmentId,
    parentDirectory: attachmentsDirectory,
    rootPath,
    unsafeMessage: 'Workspace segment attachment directory is not safe',
  });
}

async function trashedSegmentAttachmentDirectory(
  rootPath: string,
  memoryId: string,
  segmentId: string,
  attachmentId: string
): Promise<string> {
  if (!ATTACHMENT_ID_PATTERN.test(attachmentId)) {
    throw new Error('Invalid segment attachment id');
  }
  return findFileSpaceNodeDirectoryInParent({
    defaultDirectoryName: attachmentId,
    duplicateMessage: 'Duplicate deleted segment attachment id',
    matchesCandidate: (candidate, candidateIdentity) => {
      const attachment = readFinalizedSegmentAttachmentMetadata(candidate, candidateIdentity);
      return (
        attachment.memoryId === memoryId &&
        attachment.segmentId === segmentId &&
        attachment.attachmentId === attachmentId
      );
    },
    nodeId: attachmentId,
    parentDirectory: path.join(rootPath, '.reo', 'trash', 'attachments'),
    rootPath,
    unsafeMessage: 'Workspace segment attachment trash directory is not safe',
  });
}

async function segmentAttachmentDirectoryForNewNode(
  rootPath: string,
  memoryId: string,
  segmentId: string,
  attachmentId: string,
  title: string
): Promise<string> {
  const attachmentsDirectory = await segmentAttachmentsDirectory(rootPath, memoryId, segmentId);
  return resolveSafeWorkspaceChild(
    rootPath,
    path.join(attachmentsDirectory, fileSpaceNodeDirectoryName(attachmentId, title))
  );
}

function readValidFinalizedAttachmentProjection({
  attachmentDirectory,
  attachmentDirectoryIdentity,
  workspaceId,
  memoryId,
  segmentId,
}: {
  readonly attachmentDirectory: string;
  readonly attachmentDirectoryIdentity: DirectoryIdentity;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
}): WorkspaceSegmentAttachmentProjection | null {
  try {
    const attachment = readFinalizedSegmentAttachmentMetadata(
      attachmentDirectory,
      attachmentDirectoryIdentity
    );
    const audioByteLength = readFileSizeInKnownDirectory(
      attachmentDirectory,
      attachmentDirectoryIdentity,
      'audio.webm'
    );
    if (
      attachment.workspaceId !== workspaceId ||
      attachment.memoryId !== memoryId ||
      attachment.segmentId !== segmentId ||
      attachment.audioByteLength !== audioByteLength
    ) {
      return null;
    }
    const updatedAt = attachment.updatedAt ?? attachment.finalizedAt;
    return {
      workspaceId,
      memoryId,
      segmentId,
      attachmentId: attachment.attachmentId,
      type: 'audio',
      title: titleFromFileSpaceDirectoryName({
        nodeId: attachment.attachmentId,
        directoryName: path.basename(attachmentDirectory),
        metadataTitle: attachment.title,
      }),
      createdAt: attachment.createdAt,
      updatedAt,
      durationMs: attachment.durationMs,
      audioByteLength,
      transcript: {
        exists: hasNonEmptyFileInKnownDirectory(
          attachmentDirectory,
          attachmentDirectoryIdentity,
          'transcript.md'
        ),
      },
    };
  } catch {
    return null;
  }
}

async function readValidFinalizedAttachmentProjectionFromDirectory({
  attachmentDirectory,
  workspaceId,
  memoryId,
  segmentId,
}: {
  readonly attachmentDirectory: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
}): Promise<WorkspaceSegmentAttachmentProjection | null> {
  try {
    return readValidFinalizedAttachmentProjection({
      attachmentDirectory,
      attachmentDirectoryIdentity: await readDirectoryIdentity(attachmentDirectory),
      workspaceId,
      memoryId,
      segmentId,
    });
  } catch {
    return null;
  }
}

async function listValidSegmentAttachmentsFromDirectory({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  recordingDirectory,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly recordingDirectory: string;
}): Promise<WorkspaceSegmentAttachmentProjection[]> {
  const attachmentsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(recordingDirectory, 'attachments')
  );
  let entries: Dirent[];
  try {
    entries = await readExistingDirectoryEntries(attachmentsDirectory);
  } catch {
    return [];
  }
  const attachments: WorkspaceSegmentAttachmentProjection[] = [];
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const attachmentDirectory = await resolveSafeWorkspaceChild(
        rootPath,
        path.join(attachmentsDirectory, entry.name)
      );
      await assertSafeExistingDirectory(attachmentDirectory, 'Segment attachment path is not safe');
      const attachmentDirectoryIdentity = await readDirectoryIdentity(attachmentDirectory);
      const projection = readValidFinalizedAttachmentProjection({
        attachmentDirectory,
        attachmentDirectoryIdentity,
        workspaceId,
        memoryId,
        segmentId,
      });
      if (projection) {
        if (seen.has(projection.attachmentId)) {
          duplicated.add(projection.attachmentId);
          continue;
        }
        seen.add(projection.attachmentId);
        attachments.push(projection);
      }
    } catch {
      continue;
    }
  }
  return sortByProjectedUpdatedAt(
    attachments.filter((attachment) => !duplicated.has(attachment.attachmentId))
  );
}

async function recoverSegmentAttachmentFinalizeTransactions({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  recordingDirectory,
  beforeRecordingRecoveryRemove,
  afterDraftCleanup,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly recordingDirectory: string;
  readonly beforeRecordingRecoveryRemove?: () => MaybePromise<void>;
  readonly afterDraftCleanup?: () => MaybePromise<void>;
  readonly assertWorkspaceUsable?: () => MaybePromise<void>;
}): Promise<void> {
  const attachmentsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(recordingDirectory, 'attachments')
  );
  const attachmentEntries = await readExistingDirectoryEntries(attachmentsDirectory);
  for (const attachmentEntry of attachmentEntries) {
    if (!attachmentEntry.isDirectory()) {
      continue;
    }
    const attachmentDirectory = await resolveSafeWorkspaceChild(
      rootPath,
      path.join(attachmentsDirectory, attachmentEntry.name)
    );
    if (attachmentEntry.name.startsWith(FINALIZE_STAGING_PREFIX)) {
      const projection = await readValidFinalizedAttachmentProjectionFromDirectory({
        attachmentDirectory,
        workspaceId,
        memoryId,
        segmentId,
      });
      const hasMarker = await hasFinalizeTransactionMarker(attachmentDirectory);
      const hasPayload = await finalizedAttachmentPayloadExists(attachmentDirectory);
      if (projection || (!hasMarker && hasPayload)) {
        continue;
      }
      await beforeRecordingRecoveryRemove?.();
      await assertWorkspaceUsable?.();
      const removed = await removeSafeWorkspaceDirectory(rootPath, attachmentDirectory);
      if (removed) {
        await assertWorkspaceUsable?.();
        await fsyncWorkspaceDirectory(attachmentsDirectory).catch(() => {});
      }
      continue;
    }
    if (!(await hasFinalizeTransactionMarker(attachmentDirectory))) {
      continue;
    }

    const projection = await readValidFinalizedAttachmentProjectionFromDirectory({
      attachmentDirectory,
      workspaceId,
      memoryId,
      segmentId,
    });
    const attachmentId =
      projection?.attachmentId ??
      (await readFinalizedAttachmentIdFromMetadata(attachmentDirectory)) ??
      (ATTACHMENT_ID_PATTERN.test(attachmentEntry.name) ? attachmentEntry.name : null);
    const hasPayload = await finalizedAttachmentPayloadExists(attachmentDirectory);
    if (!projection || !attachmentId) {
      if (hasPayload) {
        continue;
      }
      await beforeRecordingRecoveryRemove?.();
      await assertWorkspaceUsable?.();
      await removeSafeWorkspaceDirectory(rootPath, attachmentDirectory);
      continue;
    }

    try {
      await assertWorkspaceUsable?.();
      const removed = await removeSafeWorkspaceDirectory(
        rootPath,
        await draftAttachmentDirectory(rootPath, attachmentId),
        { allowMissing: true }
      );
      if (!removed) {
        throw new Error('Segment attachment draft cleanup path is not safe');
      }
      await afterDraftCleanup?.();
      await assertWorkspaceUsable?.();
      await fsyncWorkspaceDirectory(path.join(rootPath, '.reo', 'drafts', 'attachments')).catch(
        () => {}
      );
      await assertWorkspaceUsable?.();
      await unlinkFinalizeTransactionMarkerInDirectory(attachmentDirectory);
    } catch {
      continue;
    }
  }
}

async function segmentAttachmentRecoveryWorkExists({
  rootPath,
  recordingDirectory,
}: {
  readonly rootPath: string;
  readonly recordingDirectory: string;
}): Promise<boolean> {
  const attachmentsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(recordingDirectory, 'attachments')
  );
  const attachmentEntries = await readExistingDirectoryEntries(attachmentsDirectory);
  for (const attachmentEntry of attachmentEntries) {
    if (!attachmentEntry.isDirectory()) {
      continue;
    }
    if (attachmentEntry.name.startsWith(FINALIZE_STAGING_PREFIX)) {
      return true;
    }
    const attachmentDirectory = await resolveSafeWorkspaceChild(
      rootPath,
      path.join(attachmentsDirectory, attachmentEntry.name)
    );
    if (await hasFinalizeTransactionMarker(attachmentDirectory)) {
      return true;
    }
  }
  return false;
}

async function readValidFinalizedSegmentFileTruthFromDirectory({
  recordingDirectory,
  memoryId,
  strictUnsafePath = false,
}: {
  readonly recordingDirectory: string;
  readonly memoryId: string;
  readonly strictUnsafePath?: boolean;
}): Promise<FinalizedSegmentFileTruth | null> {
  try {
    await assertSafeExistingDirectory(recordingDirectory, 'Segment directory is not safe');
    const recordingDirectoryIdentity = await readDirectoryIdentity(recordingDirectory);
    const recording = await readFinalizedSegmentMetadata(
      recordingDirectory,
      recordingDirectoryIdentity
    );
    const audioByteLength = readFileSizeInKnownDirectory(
      recordingDirectory,
      recordingDirectoryIdentity,
      'audio.webm'
    );
    if (recording.memoryId !== memoryId || recording.audioByteLength !== audioByteLength) {
      return null;
    }
    return {
      segmentId: recording.segmentId,
      recordingDirectory,
      recordingDirectoryIdentity,
      metadata: recording,
      audioByteLength,
    };
  } catch (error) {
    if (strictUnsafePath && isUnsafeWorkspacePathError(error)) {
      throw error;
    }
    return null;
  }
}

async function readFinalizedSegmentIdFromMetadata(
  recordingDirectory: string
): Promise<string | null> {
  try {
    const recordingDirectoryIdentity = await readDirectoryIdentity(recordingDirectory);
    const recording = await readFinalizedSegmentMetadata(
      recordingDirectory,
      recordingDirectoryIdentity
    );
    return recording.segmentId;
  } catch {
    return null;
  }
}

async function readFinalizedAttachmentIdFromMetadata(
  attachmentDirectory: string
): Promise<string | null> {
  try {
    const attachmentDirectoryIdentity = await readDirectoryIdentity(attachmentDirectory);
    const attachment = readFinalizedSegmentAttachmentMetadata(
      attachmentDirectory,
      attachmentDirectoryIdentity
    );
    return attachment.attachmentId;
  } catch {
    return null;
  }
}

async function listValidFinalizedSegmentFileTruths(
  rootPath: string,
  memoryId: string
): Promise<FinalizedSegmentFileTruth[]> {
  await beforeSegmentFileTruthListForTest?.();
  const directory = await memoryDirectory(rootPath, memoryId);
  const segmentsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(directory, 'segments')
  );
  const entries = await readExistingDirectoryEntries(segmentsDirectory);
  const fileTruths: FinalizedSegmentFileTruth[] = [];
  const seen = new Set<string>();
  const duplicated = new Set<string>();

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const recordingDirectory = await resolveSafeWorkspaceChild(
      rootPath,
      path.join(segmentsDirectory, entry.name)
    );
    const fileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
      recordingDirectory,
      memoryId,
    });
    if (!fileTruth) {
      continue;
    }
    const { segmentId } = fileTruth;
    if (seen.has(segmentId)) {
      duplicated.add(segmentId);
      continue;
    }
    seen.add(segmentId);
    fileTruths.push(fileTruth);
  }

  return fileTruths.filter((fileTruth) => !duplicated.has(fileTruth.segmentId));
}

async function listValidFinalizedSegmentIds(rootPath: string, memoryId: string): Promise<string[]> {
  return (await listValidFinalizedSegmentFileTruths(rootPath, memoryId)).map(
    (fileTruth) => fileTruth.segmentId
  );
}

async function readValidFinalizedSegmentFileTruth(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<FinalizedSegmentFileTruth | null> {
  const recordingDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
  const fileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
    recordingDirectory,
    memoryId,
  });
  return fileTruth?.segmentId === segmentId ? fileTruth : null;
}

async function summarizeMemoryFromFileTruths({
  fileTruths,
  memory,
  rootPath,
}: {
  readonly fileTruths: readonly FinalizedSegmentFileTruth[];
  readonly memory: MemoryJson;
  readonly rootPath: string;
}): Promise<MemorySummary> {
  let segmentCount = 0;
  let durationMs = 0;
  let audioByteLength = 0;
  let hasTranscript = false;
  let attachmentCount = 0;
  let updatedAt = memory.updatedAt;

  for (const fileTruth of fileTruths) {
    try {
      const attachments = await listValidSegmentAttachmentsFromDirectory({
        rootPath,
        workspaceId: fileTruth.metadata.workspaceId,
        memoryId: memory.memoryId,
        segmentId: fileTruth.segmentId,
        recordingDirectory: fileTruth.recordingDirectory,
      });
      updatedAt = latestIsoTimestamp(
        updatedAt,
        fileTruth.metadata.updatedAt ?? fileTruth.metadata.finalizedAt,
        ...attachments.map((attachment) => attachment.updatedAt)
      );
      segmentCount += 1;
      durationMs += fileTruth.metadata.durationMs;
      audioByteLength += fileTruth.audioByteLength;
      hasTranscript =
        hasTranscript ||
        hasNonEmptyFileInKnownDirectory(
          fileTruth.recordingDirectory,
          fileTruth.recordingDirectoryIdentity,
          'transcript.md'
        );
      attachmentCount += attachments.length;
    } catch {
      continue;
    }
  }

  return {
    memoryId: memory.memoryId,
    title: memory.title,
    createdAt: memory.createdAt,
    updatedAt,
    segmentCount,
    durationMs,
    audioByteLength,
    hasTranscript,
    attachmentCount,
  };
}

async function summarizeMemory(rootPath: string, memory: MemoryJson): Promise<MemorySummary> {
  return summarizeMemoryFromFileTruths({
    fileTruths: await listValidFinalizedSegmentFileTruths(rootPath, memory.memoryId),
    memory,
    rootPath,
  });
}

function summarizeMemoryFromSegments(
  memory: MemoryJson,
  segments: readonly WorkspaceSegmentProjection[]
): MemorySummary {
  let updatedAt = memory.updatedAt;
  let durationMs = 0;
  let audioByteLength = 0;
  let hasTranscript = false;
  let attachmentCount = 0;

  for (const segment of segments) {
    updatedAt = latestIsoTimestamp(updatedAt, segment.updatedAt);
    durationMs += segment.durationMs;
    audioByteLength += segment.audioByteLength;
    hasTranscript = hasTranscript || segment.transcript.exists;
    attachmentCount += segment.attachmentCount;
  }

  return {
    memoryId: memory.memoryId,
    title: memory.title,
    createdAt: memory.createdAt,
    updatedAt,
    segmentCount: segments.length,
    durationMs,
    audioByteLength,
    hasTranscript,
    attachmentCount,
  };
}

async function readValidFinalizedSegmentProjection({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
}): Promise<WorkspaceSegmentProjection | null> {
  try {
    const fileTruth = await readValidFinalizedSegmentFileTruth(rootPath, memoryId, segmentId);
    if (!fileTruth || fileTruth.metadata.workspaceId !== workspaceId) {
      return null;
    }
    return await finalizedSegmentProjectionFromFileTruth({ rootPath, workspaceId, fileTruth });
  } catch {
    return null;
  }
}

async function finalizedSegmentProjectionFromFileTruth({
  rootPath,
  workspaceId,
  fileTruth,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly fileTruth: FinalizedSegmentFileTruth;
}): Promise<WorkspaceSegmentProjection | null> {
  const { metadata, recordingDirectory, recordingDirectoryIdentity, segmentId } = fileTruth;
  if (metadata.workspaceId !== workspaceId) {
    return null;
  }
  const attachments = await listValidSegmentAttachmentsFromDirectory({
    rootPath,
    workspaceId,
    memoryId: metadata.memoryId,
    segmentId,
    recordingDirectory,
  });
  const updatedAt = latestIsoTimestamp(
    metadata.updatedAt ?? metadata.finalizedAt,
    ...attachments.map((attachment) => attachment.updatedAt)
  );

  return {
    workspaceId,
    memoryId: metadata.memoryId,
    segmentId,
    type: 'audio',
    title: titleFromFileSpaceDirectoryName({
      nodeId: segmentId,
      directoryName: path.basename(recordingDirectory),
      metadataTitle: metadata.title,
    }),
    createdAt: metadata.createdAt,
    updatedAt,
    durationMs: metadata.durationMs,
    audioByteLength: fileTruth.audioByteLength,
    transcript: {
      exists: hasNonEmptyFileInKnownDirectory(
        recordingDirectory,
        recordingDirectoryIdentity,
        'transcript.md'
      ),
    },
    attachmentCount: attachments.length,
    attachments,
  };
}

export async function readFinalizedSegmentProjection(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
}): Promise<WorkspaceSegmentProjection> {
  const projection = await readValidFinalizedSegmentProjection(input);

  if (!projection) {
    throw new Error('Finalized segment projection does not match file truth');
  }

  return projection;
}

export async function readMemoryDetailFromFileTruth(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<MemoryFilesResult<WorkspaceMemoryDetailProjection>> {
  try {
    assertWorkspaceUsable(input.assertWorkspaceUsable);
    const memory = await readMemoryJson(input.rootPath, input.memoryId);
    const segments: WorkspaceSegmentProjection[] = [];

    assertWorkspaceUsable(input.assertWorkspaceUsable);
    const segmentFileTruths = await listValidFinalizedSegmentFileTruths(
      input.rootPath,
      input.memoryId
    );
    for (const fileTruth of segmentFileTruths) {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const segment = await finalizedSegmentProjectionFromFileTruth({
        rootPath: input.rootPath,
        workspaceId: input.workspaceId,
        fileTruth,
      });
      if (segment) {
        segments.push(segment);
      }
    }

    assertWorkspaceUsable(input.assertWorkspaceUsable);
    const sortedSegments = sortByProjectedUpdatedAt(segments);
    const summary = summarizeMemoryFromSegments(memory, sortedSegments);
    return {
      ok: true,
      value: {
        ...summary,
        workspaceId: input.workspaceId,
        segments: sortedSegments,
      },
    };
  } catch (error) {
    return memoryFilesError(
      error,
      'ERR_MEMORY_NOT_FOUND',
      'Memory detail could not be read',
      'previous-file-preserved'
    );
  }
}

export async function rebuildWorkspaceReadModel(
  rootPath: string,
  {
    persist = false,
    assertWorkspaceUsable: assertUsable,
  }: { readonly persist?: boolean; readonly assertWorkspaceUsable?: AssertWorkspaceUsable } = {}
): Promise<{
  readonly memories: MemorySummary[];
  readonly assertMemoriesRootCurrent: () => Promise<void>;
}> {
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  const memoriesDirectoryIdentity = await readDirectoryIdentity(memoriesDirectory);
  await beforeReadModelReaddirForTest?.();
  await assertSameDirectoryPathAsync(memoriesDirectory, memoriesDirectoryIdentity);
  const entries = await readExistingDirectoryEntries(memoriesDirectory);
  await assertSameDirectoryPathAsync(memoriesDirectory, memoriesDirectoryIdentity);
  const memories: MemorySummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      await assertSameDirectoryPathAsync(memoriesDirectory, memoriesDirectoryIdentity);
      const memory = await readMemoryJsonFromDirectory(path.join(memoriesDirectory, entry.name));
      memories.push(await summarizeMemory(rootPath, memory));
    } catch {
      continue;
    }
  }
  await assertSameDirectoryPathAsync(memoriesDirectory, memoriesDirectoryIdentity);

  let sortedMemories = sortByProjectedUpdatedAt(memories);
  if (persist) {
    await beforeReadModelReplaceForTest?.();
    sortedMemories = [
      ...(await replaceWorkspaceIndex(
        rootPath,
        async () => {
          assertWorkspaceUsable(assertUsable);
          const current = await rebuildWorkspaceReadModel(rootPath, { persist: false });
          return current.memories;
        },
        async () => {
          assertWorkspaceUsable(assertUsable);
          await beforeReadModelPersistForTest?.();
          await assertSameDirectoryPathAsync(memoriesDirectory, memoriesDirectoryIdentity);
          assertWorkspaceUsable(assertUsable);
        }
      )),
    ];
  }
  return {
    memories: sortedMemories,
    assertMemoriesRootCurrent: () =>
      assertSameDirectoryPathAsync(memoriesDirectory, memoriesDirectoryIdentity),
  };
}

export async function rebuildMemoryIndex(
  rootPath: string,
  options: {
    readonly persist?: boolean;
    readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  } = {}
): Promise<MemorySummary[]> {
  return (
    await rebuildWorkspaceReadModel(rootPath, {
      persist: options.persist ?? true,
      ...(options.assertWorkspaceUsable
        ? { assertWorkspaceUsable: options.assertWorkspaceUsable }
        : {}),
    })
  ).memories;
}

export async function refreshMemoryIndexEntry(
  rootPath: string,
  memoryId: string,
  assertUsable?: AssertWorkspaceUsable
): Promise<MemorySummary> {
  await beforeMemoryIndexEntryReadForTest?.();
  return withWorkspaceIndexWriteLock(rootPath, async () => {
    assertWorkspaceUsable(assertUsable);
    const summary = await summarizeMemory(rootPath, await readMemoryJson(rootPath, memoryId));
    assertWorkspaceUsable(assertUsable);
    const index = workspaceIndexSchema.parse(
      JSON.parse(await readWorkspaceTextFile(getWorkspaceIndexPath(rootPath)))
    );
    const memories = sortByProjectedUpdatedAt([
      summary,
      ...index.memories.filter((memory) => memory.memoryId !== memoryId),
    ]);
    await writeWorkspaceJsonAtomic(
      getWorkspaceIndexPath(rootPath),
      {
        schemaVersion: 1,
        memories,
      },
      () => assertWorkspaceUsable(assertUsable)
    );
    return summary;
  });
}

async function refreshMemoryIndexEntryFromKnownFileTruths({
  assertUsable,
  fileTruths,
  memory,
  memoryId,
  rootPath,
  segmentIds,
}: {
  readonly assertUsable?: AssertWorkspaceUsable;
  readonly fileTruths: readonly FinalizedSegmentFileTruth[];
  readonly memory: MemoryJson;
  readonly memoryId: string;
  readonly rootPath: string;
  readonly segmentIds: readonly string[];
}): Promise<{ readonly memory: MemorySummary; readonly memoryJson: MemoryJson }> {
  await beforeMemoryIndexEntryReadForTest?.();
  return withWorkspaceIndexWriteLock(rootPath, async () => {
    assertWorkspaceUsable(assertUsable);
    const memoryWithSegmentIds = await writeMemorySegmentIdsMirror({
      rootPath,
      memoryId,
      memory,
      segmentIds,
      ...(assertUsable ? { assertUsable } : {}),
    });
    assertWorkspaceUsable(assertUsable);
    const summary = await summarizeMemoryFromFileTruths({
      fileTruths,
      memory: memoryWithSegmentIds,
      rootPath,
    });
    assertWorkspaceUsable(assertUsable);
    const index = workspaceIndexSchema.parse(
      JSON.parse(await readWorkspaceTextFile(getWorkspaceIndexPath(rootPath)))
    );
    const memories = sortByProjectedUpdatedAt([
      summary,
      ...index.memories.filter((indexedMemory) => indexedMemory.memoryId !== memoryId),
    ]);
    await writeWorkspaceJsonAtomic(
      getWorkspaceIndexPath(rootPath),
      {
        schemaVersion: 1,
        memories,
      },
      () => assertWorkspaceUsable(assertUsable)
    );
    return { memory: summary, memoryJson: memoryWithSegmentIds };
  });
}

export async function replaceWorkspaceIndex(
  rootPath: string,
  readMemories: () => MaybePromise<readonly MemorySummary[]>,
  beforeWrite?: () => MaybePromise<void>
): Promise<readonly MemorySummary[]> {
  let persisted: readonly MemorySummary[] = [];
  await withWorkspaceIndexWriteLock(rootPath, async () => {
    await beforeWrite?.();
    const memories = await readMemories();
    await afterReadModelReplaceReadForTest?.();
    await beforeWrite?.();
    persisted = memories;
    await writeWorkspaceJsonAtomic(getWorkspaceIndexPath(rootPath), {
      schemaVersion: 1,
      memories,
    });
  });
  return persisted;
}

export async function updateWorkspaceIndexFromCurrent(
  rootPath: string,
  update: (memories: readonly MemorySummary[]) => readonly MemorySummary[]
): Promise<void> {
  await withWorkspaceIndexWriteLock(rootPath, async () => {
    const index = workspaceIndexSchema.parse(
      JSON.parse(await readWorkspaceTextFile(getWorkspaceIndexPath(rootPath)))
    );
    await writeWorkspaceJsonAtomic(getWorkspaceIndexPath(rootPath), {
      schemaVersion: 1,
      memories: update(index.memories),
    });
  });
}

export async function readFinalizedSegmentSummary(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<MemorySegmentSummary> {
  return summarizeRecording(rootPath, memoryId, segmentId);
}

export async function recoverRecordingFinalizeTransactions(
  rootPath: string,
  {
    removeDraftDirectory,
    beforeRecordingRecoveryRemove,
    afterDraftCleanup,
    assertWorkspaceUsable: assertRecoveryWorkspaceUsable,
  }: RecoverFinalizeTransactionsOptions = {}
): Promise<void> {
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  const memoryEntries = await readExistingDirectoryEntries(memoriesDirectory);
  for (const memoryEntry of memoryEntries) {
    if (!memoryEntry.isDirectory()) {
      continue;
    }
    const memoryDirectoryPath = await resolveSafeWorkspaceChild(
      rootPath,
      path.join(memoriesDirectory, memoryEntry.name)
    );
    let memoryId = memoryEntry.name;
    let segmentsDirectory: string | null = null;
    let recordingEntries: Dirent[] = [];
    let memory: MemoryJson | null = null;
    try {
      memory = await readMemoryJsonFromDirectory(memoryDirectoryPath);
      memoryId = memory.memoryId;
    } catch {
      // Invalid memory metadata is ignored during transaction recovery.
    }
    try {
      segmentsDirectory = await resolveSafeWorkspaceChild(
        rootPath,
        path.join(memoryDirectoryPath, 'segments')
      );
      recordingEntries = await readExistingDirectoryEntries(segmentsDirectory);
    } catch {
      // Unsafe segments paths are not followed during recovery.
    }
    const validSegmentIds = new Set<string>();
    let markerBearingRecordingFound = false;
    let needsFileTruthRecovery = false;

    for (const recordingEntry of recordingEntries) {
      if (!segmentsDirectory) {
        continue;
      }
      const recordingDirectory = path.join(segmentsDirectory, recordingEntry.name);
      if (!recordingEntry.isDirectory()) {
        continue;
      }
      if (recordingEntry.name.startsWith(FINALIZE_STAGING_PREFIX)) {
        const finalizedSegmentFileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
          memoryId,
          recordingDirectory,
        });
        const hasMarker = await hasFinalizeTransactionMarker(recordingDirectory);
        const hasPayload = await finalizedPayloadExists(recordingDirectory);
        needsFileTruthRecovery ||= hasMarker;
        if (finalizedSegmentFileTruth || (!hasMarker && hasPayload)) {
          markerBearingRecordingFound = markerBearingRecordingFound || !memory;
          continue;
        }
        await beforeRecordingRecoveryRemove?.();
        await assertRecoveryWorkspaceUsable?.();
        const removed = await removeSafeWorkspaceDirectory(
          rootPath,
          path.join(memoryDirectoryPath, 'segments', recordingEntry.name)
        );
        if (removed) {
          await assertRecoveryWorkspaceUsable?.();
          await fsyncWorkspaceDirectory(segmentsDirectory).catch(() => {});
        }
        continue;
      }
      if (!(await hasFinalizeTransactionMarker(recordingDirectory))) {
        if (memory) {
          needsFileTruthRecovery ||= await segmentAttachmentRecoveryWorkExists({
            rootPath,
            recordingDirectory,
          }).catch(() => false);
        }
        continue;
      }
      needsFileTruthRecovery = true;
      const finalizedSegmentFileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
        memoryId,
        recordingDirectory,
      });
      const finalizedSegmentId = finalizedSegmentFileTruth?.segmentId ?? null;
      const metadataSegmentId =
        finalizedSegmentId ?? (await readFinalizedSegmentIdFromMetadata(recordingDirectory));
      const recordingSegmentId =
        metadataSegmentId ??
        (SEGMENT_ID_PATTERN.test(recordingEntry.name) ? recordingEntry.name : null);
      const validFinalizedSegment = finalizedSegmentId !== null;
      const markerBearingPayloadExists = await finalizedPayloadExists(recordingDirectory);
      if (!memory) {
        if (validFinalizedSegment || markerBearingPayloadExists) {
          markerBearingRecordingFound = true;
          continue;
        }
        await beforeRecordingRecoveryRemove?.();
        await assertRecoveryWorkspaceUsable?.();
        await removeSafeWorkspaceDirectory(
          rootPath,
          path.join(memoryDirectoryPath, 'segments', recordingEntry.name)
        );
        continue;
      }
      const memoryReferencesRecording =
        validFinalizedSegment ||
        (recordingSegmentId !== null && memory.segmentIds.includes(recordingSegmentId));
      if (memoryReferencesRecording) {
        if (recordingSegmentId === null) {
          continue;
        }
        if (!validFinalizedSegment) {
          validSegmentIds.add(recordingSegmentId);
          continue;
        }
        validSegmentIds.add(recordingSegmentId);
        const draftDirectory = await draftSegmentDirectory(rootPath, recordingSegmentId);
        try {
          await assertRecoveryWorkspaceUsable?.();
          if (removeDraftDirectory) {
            await removeDraftDirectory(draftDirectory);
          } else {
            const removed = await removeSafeWorkspaceDirectory(rootPath, draftDirectory);
            if (!removed && !(await isSafeMissingWorkspaceChild(rootPath, draftDirectory))) {
              throw new Error('Recording draft cleanup path is not safe');
            }
          }
        } catch {
          continue;
        }
        try {
          await afterDraftCleanup?.();
          await assertRecoveryWorkspaceUsable?.();
          await fsyncWorkspaceDirectory(path.join(rootPath, '.reo', 'drafts', 'segments'));
          await assertRecoveryWorkspaceUsable?.();
          await unlinkFinalizeTransactionMarker(rootPath, memoryId, recordingSegmentId);
        } catch {
          continue;
        }
        continue;
      }
      if (markerBearingPayloadExists) {
        continue;
      }
      await beforeRecordingRecoveryRemove?.();
      await assertRecoveryWorkspaceUsable?.();
      await removeSafeWorkspaceDirectory(rootPath, recordingDirectory);
    }

    if (!memory) {
      if (markerBearingRecordingFound) {
        continue;
      }
      await assertRecoveryWorkspaceUsable?.();
      await removeMetadataLessEmptyMemoryDirectory(
        rootPath,
        memoryId,
        assertRecoveryWorkspaceUsable
      );
      continue;
    }
    if (!needsFileTruthRecovery) {
      continue;
    }
    const fileTruthSegments = await listValidFinalizedSegmentFileTruths(rootPath, memoryId).catch(
      (): FinalizedSegmentFileTruth[] => []
    );
    for (const fileTruth of fileTruthSegments) {
      await recoverSegmentAttachmentFinalizeTransactions({
        rootPath,
        workspaceId: fileTruth.metadata.workspaceId,
        memoryId,
        segmentId: fileTruth.segmentId,
        recordingDirectory: fileTruth.recordingDirectory,
        ...(beforeRecordingRecoveryRemove ? { beforeRecordingRecoveryRemove } : {}),
        ...(afterDraftCleanup ? { afterDraftCleanup } : {}),
        ...(assertRecoveryWorkspaceUsable
          ? { assertWorkspaceUsable: assertRecoveryWorkspaceUsable }
          : {}),
      });
    }
    const fileTruthSegmentIds = fileTruthSegments.map((fileTruth) => fileTruth.segmentId);
    for (const segmentId of memory.segmentIds) {
      if (fileTruthSegmentIds.includes(segmentId)) {
        validSegmentIds.add(segmentId);
      }
    }
    for (const segmentId of fileTruthSegmentIds) {
      validSegmentIds.add(segmentId);
    }
    const repairedSegmentIds = mergeSegmentIdsFromFileTruth(memory.segmentIds, [
      ...validSegmentIds,
    ]);
    if (!sameSegmentIds(repairedSegmentIds, memory.segmentIds)) {
      try {
        await assertRecoveryWorkspaceUsable?.();
        const currentMemoryDirectory = await memoryDirectory(rootPath, memoryId);
        await writeWorkspaceJsonAtomic(path.join(currentMemoryDirectory, 'memory.json'), {
          ...memory,
          segmentIds: repairedSegmentIds,
        });
      } catch {
        continue;
      }
    }
  }
}

async function writeFinalizeTransactionMarker({
  targetRecordingDirectory,
  memoryId,
  segmentId,
}: {
  readonly targetRecordingDirectory: string;
  readonly memoryId: string;
  readonly segmentId: string;
}): Promise<void> {
  await writeWorkspaceJsonAtomic(path.join(targetRecordingDirectory, FINALIZE_TRANSACTION_MARKER), {
    schemaVersion: 1,
    memoryId,
    segmentId,
    draftPath: `.reo/drafts/segments/${segmentId}`,
  });
}

async function copyDirectoryContents(
  sourceDirectory: string,
  targetDirectory: string,
  allowedFiles: ReadonlySet<string> = DRAFT_RECORDING_FILES
): Promise<void> {
  const sourceIdentity = readDirectoryIdentitySync(
    sourceDirectory,
    'Recording draft directory is not safe'
  );
  const targetIdentity = readDirectoryIdentitySync(
    targetDirectory,
    'Recording staging directory is not safe'
  );

  for (const entry of readDirectoryEntriesInDirectory(sourceDirectory, sourceIdentity)) {
    if (!entry.isFile() || entry.isSymbolicLink() || !allowedFiles.has(entry.name)) {
      throw new Error('Recording draft file is not safe');
    }
    await copyFileBetweenDirectories({
      sourceDirectory,
      sourceIdentity,
      targetDirectory,
      targetIdentity,
      fileName: entry.name,
    });
  }
}

function readDirectoryEntriesInDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity
): Dirent[] {
  const previousCwd = process.cwd();
  try {
    process.chdir(directory);
    assertSameCurrentDirectory(directoryIdentity);
    const entries = readdirSync('.', { withFileTypes: true });
    assertSameCurrentDirectory(directoryIdentity);
    return entries;
  } finally {
    process.chdir(previousCwd);
  }
}

function openFileInDirectory({
  directory,
  directoryIdentity,
  fileName,
  flags,
}: {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly fileName: string;
  readonly flags: number;
}): number {
  const previousCwd = process.cwd();
  try {
    process.chdir(directory);
    assertSameCurrentDirectory(directoryIdentity);
    const fd = openSync(fileName, flags);
    assertSameCurrentDirectory(directoryIdentity);
    return fd;
  } finally {
    process.chdir(previousCwd);
  }
}

function removeFileInDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string
): void {
  const previousCwd = process.cwd();
  try {
    process.chdir(directory);
    assertSameCurrentDirectory(directoryIdentity);
    rmSync(fileName, { force: true });
  } finally {
    process.chdir(previousCwd);
  }
}

async function copyFileBetweenDirectories({
  sourceDirectory,
  sourceIdentity,
  targetDirectory,
  targetIdentity,
  fileName,
}: {
  readonly sourceDirectory: string;
  readonly sourceIdentity: DirectoryIdentity;
  readonly targetDirectory: string;
  readonly targetIdentity: DirectoryIdentity;
  readonly fileName: string;
}): Promise<void> {
  let sourceFd: number | null = null;
  let targetFd: number | null = null;
  let targetCreated = false;
  try {
    sourceFd = openFileInDirectory({
      directory: sourceDirectory,
      directoryIdentity: sourceIdentity,
      fileName,
      flags: constants.O_RDONLY | constants.O_NOFOLLOW,
    });
    const source = fstatSync(sourceFd);
    if (!source.isFile()) {
      throw new Error('Recording draft file is not safe');
    }

    targetFd = openFileInDirectory({
      directory: targetDirectory,
      directoryIdentity: targetIdentity,
      fileName,
      flags: constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    });
    targetCreated = true;

    const buffer = Buffer.allocUnsafe(Math.min(COPY_BUFFER_BYTES, Math.max(1, source.size)));
    let offset = 0;
    while (offset < source.size) {
      const { bytesRead } = await readDescriptor(
        sourceFd,
        buffer,
        0,
        Math.min(buffer.byteLength, source.size - offset),
        offset
      );
      if (bytesRead === 0) {
        throw new Error('Recording draft file changed during copy');
      }
      let bytesWritten = 0;
      while (bytesWritten < bytesRead) {
        const { bytesWritten: written } = await writeDescriptor(
          targetFd,
          buffer,
          bytesWritten,
          bytesRead - bytesWritten,
          offset + bytesWritten
        );
        bytesWritten += written;
      }
      offset += bytesRead;
    }

    await fsyncDescriptor(targetFd);
    assertSameDirectoryPath(sourceDirectory, sourceIdentity);
    assertSameDirectoryPath(targetDirectory, targetIdentity);
  } catch (error) {
    if (targetFd !== null) {
      closeSync(targetFd);
      targetFd = null;
    }
    if (targetCreated) {
      try {
        removeFileInDirectory(targetDirectory, targetIdentity, fileName);
      } catch {
        // Cleanup only touches the original staging directory identity.
      }
    }
    throw error;
  } finally {
    if (sourceFd !== null) {
      closeSync(sourceFd);
    }
    if (targetFd !== null) {
      closeSync(targetFd);
    }
  }
}

async function resolveSafeCleanupDirectory(
  rootPath: string,
  directoryPath: string
): Promise<string | null> {
  try {
    const rootAbsolute = await realpath(rootPath);
    const rootInputAbsolute = path.resolve(rootPath);
    const directoryAbsolute = path.resolve(directoryPath);
    let relative = path.relative(rootInputAbsolute, directoryAbsolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      relative = path.relative(rootAbsolute, directoryAbsolute);
    }
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return null;
    }

    let current = rootAbsolute;
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      const entry = await lstat(current);
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        return null;
      }
    }

    return directoryAbsolute;
  } catch {
    return null;
  }
}

async function isSafeMissingWorkspaceChild(
  rootPath: string,
  directoryPath: string
): Promise<boolean> {
  try {
    const rootAbsolute = await realpath(rootPath);
    const rootInputAbsolute = path.resolve(rootPath);
    const directoryAbsolute = path.resolve(directoryPath);
    let relative = path.relative(rootInputAbsolute, directoryAbsolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      relative = path.relative(rootAbsolute, directoryAbsolute);
    }
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return false;
    }

    const segments = relative.split(path.sep).filter(Boolean);
    let current = rootAbsolute;
    for (const segment of segments.slice(0, -1)) {
      current = path.join(current, segment);
      const entry = await lstat(current);
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        return false;
      }
    }

    try {
      await lstat(path.join(rootAbsolute, ...segments));
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT';
    }
  } catch {
    return false;
  }
}

export async function removeSafeWorkspaceDirectory(
  rootPath: string,
  directoryPath: string,
  options?: SafeWorkspaceDirectoryRemoveOptions
): Promise<boolean> {
  const safeDirectory = await resolveSafeCleanupDirectory(rootPath, directoryPath);
  if (!safeDirectory) {
    return options?.allowMissing ? isSafeMissingWorkspaceChild(rootPath, directoryPath) : false;
  }
  const parentDirectory = path.dirname(safeDirectory);
  const directoryName = path.basename(safeDirectory);
  const parentIdentity = await readDirectoryIdentity(parentDirectory);
  const directoryIdentity = await readDirectoryIdentity(safeDirectory);
  await options?.beforeSafeCleanupRemove?.();
  const currentSafeDirectory = await resolveSafeCleanupDirectory(rootPath, directoryPath);
  if (currentSafeDirectory !== safeDirectory) {
    return options?.allowMissing ? isSafeMissingWorkspaceChild(rootPath, directoryPath) : false;
  }
  const previousCwd = process.cwd();
  try {
    process.chdir(parentDirectory);
    assertSameCurrentDirectory(parentIdentity);
    assertSameDirectoryPath(directoryName, directoryIdentity, 'Workspace cleanup path changed');
    rmSync(directoryName, { recursive: true, force: true });
    assertSameCurrentDirectory(parentIdentity);
    fsyncCurrentDirectoryBestEffort();
  } finally {
    process.chdir(previousCwd);
  }
  return true;
}

async function removeDraftSegmentDirectorySafely(
  rootPath: string,
  segmentId: string,
  hooks?: FinalizeTransactionHooks
): Promise<void> {
  const draftDirectory = await draftSegmentDirectory(rootPath, segmentId);
  await hooks?.beforeDraftDirectoryRemove?.();
  const removed = await removeSafeWorkspaceDirectory(rootPath, draftDirectory, {
    allowMissing: true,
  });
  if (!removed) {
    throw new Error('Recording draft cleanup path is not safe');
  }
}

async function removeMetadataLessEmptyMemoryDirectory(
  rootPath: string,
  memoryId: string,
  assertWorkspaceUsable?: () => MaybePromise<void>
): Promise<void> {
  const directory = await memoryDirectory(rootPath, memoryId).catch(() => null);
  if (!directory || (await exists(path.join(directory, 'memory.json')))) {
    return;
  }
  const entries = await readExistingDirectoryNames(directory);
  if (entries.length === 0) {
    await assertWorkspaceUsable?.();
    await removeSafeWorkspaceDirectory(rootPath, directory).catch(() => {});
    return;
  }
  if (entries.length !== 1 || entries[0] !== 'segments') {
    return;
  }
  const segmentsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(directory, 'segments')
  );
  const segmentEntries = await readExistingDirectoryNames(segmentsDirectory);
  if (segmentEntries.length > 0) {
    return;
  }
  await assertWorkspaceUsable?.();
  await removeSafeWorkspaceDirectory(rootPath, directory).catch(() => {});
}

async function cleanupPreExposeFinalizeArtifacts({
  rootPath,
  segmentId,
  memoryDirectoryPath,
  hooks,
}: {
  readonly rootPath: string;
  readonly segmentId: string;
  readonly memoryDirectoryPath: string;
  readonly hooks?: FinalizeTransactionHooks;
}): Promise<void> {
  const segmentsDirectory = await resolveSafeCleanupDirectory(
    rootPath,
    path.join(memoryDirectoryPath, 'segments')
  );
  if (segmentsDirectory) {
    const stagingPrefix = `${FINALIZE_STAGING_PREFIX}${segmentId}.`;
    for (const entry of await readdir(segmentsDirectory, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith(stagingPrefix)) {
        await removeSafeWorkspaceDirectory(
          rootPath,
          path.join(segmentsDirectory, entry.name),
          hooks
        );
      }
    }
    await fsyncWorkspaceDirectory(segmentsDirectory).catch(() => {});
  }

  const safeMemoryDirectory = await resolveSafeCleanupDirectory(rootPath, memoryDirectoryPath);
  if (!safeMemoryDirectory) {
    return;
  }

  let hasMemoryJson: boolean;
  try {
    hasMemoryJson = await exists(path.join(safeMemoryDirectory, 'memory.json'));
  } catch {
    hasMemoryJson = true;
  }

  if (!hasMemoryJson) {
    await removeSafeWorkspaceDirectory(rootPath, safeMemoryDirectory, hooks);
  }
}

async function copyDraftRecordingIntoMemory({
  rootPath,
  memoryId,
  segmentId,
  title,
  memoryTitleForCreate,
  hooks,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly memoryTitleForCreate?: string;
  readonly hooks?: FinalizeTransactionHooks;
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<{
  readonly stagingSegmentDirectory: string;
  readonly targetRecordingDirectory: string;
}> {
  const targetMemoryDirectory = await memoryDirectoryForWriteTarget(
    rootPath,
    memoryId,
    memoryTitleForCreate
  );
  const targetDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(targetMemoryDirectory, 'segments', fileSpaceNodeDirectoryName(segmentId, title))
  );
  const parentDirectory = path.dirname(targetDirectory);
  const memoryDirectoryPath = path.dirname(parentDirectory);
  const stagingDirectory = path.join(
    parentDirectory,
    `${FINALIZE_STAGING_PREFIX}${segmentId}.${process.pid}.${Date.now()}`
  );
  const stagingName = path.basename(stagingDirectory);
  try {
    assertWorkspaceUsable(assertUsable);
    if (await segmentDirectoryExistsInAnyMemory(rootPath, segmentId)) {
      throw new Error('Recording target already exists');
    }
    await hooks?.beforeParentDirectoryCreate?.();
    assertWorkspaceUsable(assertUsable);
    const segmentsDirectory = await ensureMemoryRecordingsDirectory(
      rootPath,
      memoryId,
      memoryTitleForCreate,
      hooks
    );
    if (segmentsDirectory !== parentDirectory) {
      throw new Error('Recording target parent changed');
    }
    await fsyncWorkspaceDirectory(path.dirname(path.dirname(parentDirectory))).catch(() => {});
    await fsyncWorkspaceDirectory(path.dirname(parentDirectory)).catch(() => {});
    await fsyncWorkspaceDirectory(parentDirectory).catch(() => {});
    await assertSafeExistingDirectory(
      parentDirectory,
      'Workspace memory segments directory is not safe'
    );
    await hooks?.beforeStagingDirectoryCreate?.();
    assertWorkspaceUsable(assertUsable);
    createWorkspaceDirectoryWithinParent({
      parentDirectory,
      directoryName: stagingName,
    });
    await hooks?.afterStagingDirectoryCreate?.();
    const markerStagingDirectory = await resolveSafeWorkspaceChild(rootPath, stagingDirectory);
    await assertSafeExistingDirectory(markerStagingDirectory, 'Recording staging path is not safe');
    assertWorkspaceUsable(assertUsable);
    await writeFinalizeTransactionMarker({
      targetRecordingDirectory: markerStagingDirectory,
      memoryId,
      segmentId,
    });
    await hooks?.afterMarkerWrite?.();
    assertWorkspaceUsable(assertUsable);
    await draftSegmentDirectory(rootPath, segmentId);
    await fsyncWorkspaceDirectory(markerStagingDirectory);
    await hooks?.beforeDraftCopy?.();
    assertWorkspaceUsable(assertUsable);
    const copyStagingDirectory = await resolveSafeWorkspaceChild(rootPath, stagingDirectory);
    await assertSafeExistingDirectory(copyStagingDirectory, 'Recording staging path is not safe');
    await copyDirectoryContents(
      await draftSegmentDirectory(rootPath, segmentId),
      copyStagingDirectory
    );
    await hooks?.afterCopy?.();
    assertWorkspaceUsable(assertUsable);
    const finalStagingDirectory = await resolveSafeWorkspaceChild(rootPath, stagingDirectory);
    await assertSafeExistingDirectory(finalStagingDirectory, 'Recording staging path is not safe');
    await fsyncDirectoryTree(finalStagingDirectory);
    return {
      stagingSegmentDirectory: finalStagingDirectory,
      targetRecordingDirectory: targetDirectory,
    };
  } catch (error) {
    if (error instanceof WorkspaceHandleLost) {
      throw error;
    }
    await cleanupPreExposeFinalizeArtifacts({
      rootPath,
      segmentId,
      memoryDirectoryPath,
      ...(hooks ? { hooks } : {}),
    });
    throw error;
  }
}

async function writeFinalizedSegmentFiles({
  targetRecordingDirectory,
  workspaceId,
  memoryId,
  segmentId,
  title,
  durationMs,
  finalizedAt,
}: {
  readonly targetRecordingDirectory: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly finalizedAt: string;
}): Promise<number> {
  const targetIdentity = await readDirectoryIdentity(
    targetRecordingDirectory,
    'Recording finalize path crosses a symlink'
  );
  const audioFd = openFileInDirectory({
    directory: targetRecordingDirectory,
    directoryIdentity: targetIdentity,
    fileName: 'audio.webm',
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
  const audio = fstatSync(audioFd);
  closeSync(audioFd);
  if (!audio.isFile()) {
    throw new Error('Recording audio path is unsafe');
  }
  const draftMetadata = draftSegmentMetadataSchema.parse(
    JSON.parse(
      readWorkspaceTextFileInKnownDirectory(
        targetRecordingDirectory,
        targetIdentity,
        'segment.json'
      )
    )
  );
  if (
    draftMetadata.workspaceId !== workspaceId ||
    draftMetadata.segmentId !== segmentId ||
    draftMetadata.audioByteLength !== audio.size
  ) {
    throw new Error('Draft segment metadata does not match file truth');
  }
  await writeWorkspaceJsonAtomicInKnownDirectory({
    directory: targetRecordingDirectory,
    directoryIdentity: targetIdentity,
    fileName: 'segment.json',
    value: {
      schemaVersion: 1,
      workspaceId,
      memoryId,
      segmentId,
      type: 'audio',
      status: 'finalized',
      title,
      createdAt: draftMetadata.createdAt,
      finalizedAt,
      updatedAt: finalizedAt,
      durationMs,
      nextSequence: draftMetadata.nextSequence,
      audioByteLength: audio.size,
      transcriptPath: 'transcript.md',
    },
  });
  await ensureMarkdownFileInDirectory(targetRecordingDirectory, targetIdentity, 'transcript.md');
  return audio.size;
}

async function writeFinalizedAttachmentFiles({
  targetAttachmentDirectory,
  workspaceId,
  memoryId,
  segmentId,
  attachmentId,
  title,
  durationMs,
  finalizedAt,
}: {
  readonly targetAttachmentDirectory: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly attachmentId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly finalizedAt: string;
}): Promise<number> {
  const targetIdentity = await readDirectoryIdentity(
    targetAttachmentDirectory,
    'Segment attachment finalize path crosses a symlink'
  );
  const audioFd = openFileInDirectory({
    directory: targetAttachmentDirectory,
    directoryIdentity: targetIdentity,
    fileName: 'audio.webm',
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
  const audio = fstatSync(audioFd);
  closeSync(audioFd);
  if (!audio.isFile()) {
    throw new Error('Segment attachment audio path is unsafe');
  }
  const draftMetadata = draftSegmentAttachmentMetadataSchema.parse(
    JSON.parse(
      readWorkspaceTextFileInKnownDirectory(
        targetAttachmentDirectory,
        targetIdentity,
        'attachment.json'
      )
    )
  );
  if (
    draftMetadata.workspaceId !== workspaceId ||
    draftMetadata.memoryId !== memoryId ||
    draftMetadata.segmentId !== segmentId ||
    draftMetadata.attachmentId !== attachmentId ||
    draftMetadata.audioByteLength !== audio.size
  ) {
    throw new Error('Draft segment attachment metadata does not match file truth');
  }
  await writeWorkspaceJsonAtomicInKnownDirectory({
    directory: targetAttachmentDirectory,
    directoryIdentity: targetIdentity,
    fileName: 'attachment.json',
    value: {
      schemaVersion: 1,
      workspaceId,
      memoryId,
      segmentId,
      attachmentId,
      type: 'audio',
      status: 'finalized',
      title,
      createdAt: draftMetadata.createdAt,
      finalizedAt,
      updatedAt: finalizedAt,
      durationMs,
      nextSequence: draftMetadata.nextSequence,
      audioByteLength: audio.size,
      transcriptPath: 'transcript.md',
    },
  });
  await ensureMarkdownFileInDirectory(targetAttachmentDirectory, targetIdentity, 'transcript.md');
  return audio.size;
}

async function ensureMarkdownFileInDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: 'transcript.md'
): Promise<void> {
  try {
    const fd = openFileInDirectory({
      directory,
      directoryIdentity,
      fileName,
      flags: constants.O_RDONLY | constants.O_NOFOLLOW,
    });
    const entry = fstatSync(fd);
    closeSync(fd);
    if (!entry.isFile()) {
      throw new Error('Recording markdown path is unsafe');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    await writeWorkspaceFileAtomicInKnownDirectory({
      directory,
      directoryIdentity,
      fileName,
      data: '',
    });
  }
}

async function finishFinalizeTransaction({
  rootPath,
  stagingSegmentDirectory,
  targetRecordingDirectory,
  memoryId,
  nextMemory,
  previousMemory,
  segmentId,
  workspaceId,
  title,
  durationMs,
  finalizedAt,
  rebuildIndex,
  hooks,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly stagingSegmentDirectory: string;
  readonly targetRecordingDirectory: string;
  readonly memoryId: string;
  readonly nextMemory: MemoryJson;
  readonly previousMemory: MemoryJson | null;
  readonly segmentId: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly finalizedAt: string;
  readonly rebuildIndex: (rootPath: string) => Promise<readonly MemorySummary[]>;
  readonly hooks?: FinalizeTransactionHooks;
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<MemorySummary> {
  const targetMemoryDirectory = path.dirname(path.dirname(targetRecordingDirectory));
  const directory = previousMemory
    ? await memoryDirectory(rootPath, memoryId)
    : targetMemoryDirectory;
  let rollbackDurableRecording = true;
  let rollbackMemory = true;
  try {
    assertWorkspaceUsable(assertUsable);
    await writeFinalizedSegmentFiles({
      targetRecordingDirectory: stagingSegmentDirectory,
      workspaceId,
      memoryId,
      segmentId,
      title,
      durationMs,
      finalizedAt,
    });
    await fsyncDirectoryTree(stagingSegmentDirectory);
    await hooks?.afterStagingTreeFsync?.();
    assertWorkspaceUsable(assertUsable);
    await hooks?.beforeExpose?.();
    const currentTargetRecordingDirectory = targetRecordingDirectory;
    const currentStagingRecordingDirectory = path.join(
      path.dirname(currentTargetRecordingDirectory),
      path.basename(stagingSegmentDirectory)
    );
    await assertSafeExistingDirectory(
      currentStagingRecordingDirectory,
      'Recording staging path is not safe'
    );
    await hooks?.beforeFinalRename?.();
    assertWorkspaceUsable(assertUsable);
    const finalTargetRecordingDirectory = targetRecordingDirectory;
    const finalStagingRecordingDirectory = path.join(
      path.dirname(finalTargetRecordingDirectory),
      path.basename(stagingSegmentDirectory)
    );
    await assertSafeExistingDirectory(
      finalStagingRecordingDirectory,
      'Recording staging path is not safe'
    );
    renameWorkspaceDirectoryWithinParent({
      parentDirectory: path.dirname(finalTargetRecordingDirectory),
      sourceName: path.basename(finalStagingRecordingDirectory),
      targetName: path.basename(finalTargetRecordingDirectory),
      ...(hooks?.beforeFinalRenameCommit ? { beforeCommit: hooks.beforeFinalRenameCommit } : {}),
      ...(hooks?.afterFinalRenameTargetPreflight
        ? { afterTargetPreflight: hooks.afterFinalRenameTargetPreflight }
        : {}),
      ...(hooks?.afterFinalRenameLastPreflight
        ? { afterLastTargetPreflight: hooks.afterFinalRenameLastPreflight }
        : {}),
    });
    await assertSafeExistingDirectory(
      finalTargetRecordingDirectory,
      'Recording target path is not safe'
    );
    await hooks?.afterParentFsync?.();
    assertWorkspaceUsable(assertUsable);
    const currentMemoryDirectory = previousMemory
      ? await memoryDirectory(rootPath, memoryId)
      : targetMemoryDirectory;
    await writeWorkspaceJsonAtomic(path.join(currentMemoryDirectory, 'memory.json'), nextMemory);
    assertWorkspaceUsable(assertUsable);
    await rebuildIndex(rootPath);
    await hooks?.beforeDraftCleanup?.();
    assertWorkspaceUsable(assertUsable);
    await removeDraftSegmentDirectorySafely(rootPath, segmentId, hooks);
    rollbackDurableRecording = false;
    rollbackMemory = false;
    await hooks?.afterDraftCleanup?.();
    assertWorkspaceUsable(assertUsable);
    await fsyncWorkspaceDirectory(path.join(rootPath, '.reo', 'drafts', 'segments'));
    assertWorkspaceUsable(assertUsable);
    await unlinkFinalizeTransactionMarker(rootPath, memoryId, segmentId);
    return summarizeMemory(rootPath, nextMemory);
  } catch (error) {
    if (error instanceof WorkspaceHandleLost) {
      throw error;
    }
    await removeSafeWorkspaceDirectory(rootPath, stagingSegmentDirectory, hooks).catch(() => {});
    const safeTargetRecordingDirectory = await resolveSafeCleanupDirectory(
      rootPath,
      targetRecordingDirectory
    );
    if (rollbackDurableRecording && safeTargetRecordingDirectory) {
      const hasMarker = await hasFinalizeTransactionMarker(safeTargetRecordingDirectory).catch(
        () => false
      );
      if (hasMarker) {
        await removeSafeWorkspaceDirectory(rootPath, safeTargetRecordingDirectory, hooks).catch(
          () => {}
        );
      }
    }
    if (rollbackMemory) {
      if (previousMemory) {
        const rollbackMemoryDirectory = await memoryDirectory(rootPath, memoryId).catch(() => null);
        if (rollbackMemoryDirectory) {
          await writeWorkspaceJsonAtomic(
            path.join(rollbackMemoryDirectory, 'memory.json'),
            previousMemory
          ).catch(() => {});
        }
      } else {
        await removeSafeWorkspaceDirectory(rootPath, directory, hooks).catch(() => {});
      }
      await rebuildIndex(rootPath).catch(() => {});
    }
    throw new FinalizeTransactionFailure(
      error,
      rollbackMemory ? 'draft-preserved' : 'durable-marker-recovery-required'
    );
  }
}

async function createMemoryWithRecordingForTestFixture(
  input: CreateMemoryForAudioSegmentInput,
  transactionHooks?: FinalizeTransactionHooks
): Promise<MemoryFilesResult<MemorySummary>> {
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const targetMemoryDirectory = await memoryDirectoryForNewNode(
        input.rootPath,
        input.memoryId,
        input.title
      );
      const existingMemoryDirectory = await memoryDirectory(input.rootPath, input.memoryId);
      if (
        (await exists(existingMemoryDirectory)) ||
        (targetMemoryDirectory !== existingMemoryDirectory && (await exists(targetMemoryDirectory)))
      ) {
        throw new Error('Memory target already exists');
      }
      const createdAt = input.now();
      const memory: MemoryJson = {
        memoryId: input.memoryId,
        title: input.title,
        createdAt,
        updatedAt: createdAt,
        segmentIds: [input.segmentId],
      };
      const { stagingSegmentDirectory, targetRecordingDirectory } =
        await copyDraftRecordingIntoMemory({
          rootPath: input.rootPath,
          memoryId: input.memoryId,
          segmentId: input.segmentId,
          title: input.title,
          memoryTitleForCreate: input.title,
          ...(transactionHooks ? { hooks: transactionHooks } : {}),
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
      const summary = await finishFinalizeTransaction({
        rootPath: input.rootPath,
        stagingSegmentDirectory,
        targetRecordingDirectory,
        memoryId: input.memoryId,
        nextMemory: memory,
        previousMemory: null,
        segmentId: input.segmentId,
        workspaceId: input.workspaceId,
        title: input.title,
        durationMs: input.durationMs,
        finalizedAt: createdAt,
        rebuildIndex:
          input.rebuildIndex ??
          ((rootPath) =>
            rebuildMemoryIndex(rootPath, {
              ...(input.assertWorkspaceUsable
                ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
                : {}),
            })),
        ...(transactionHooks ? { hooks: transactionHooks } : {}),
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
      });
      return { ok: true, value: summary };
    });
  } catch (error) {
    return memoryFilesError(
      error,
      'ERR_RECORDING_FINALIZE_FAILED',
      'Recording could not be finalized',
      finalizeFailureRetention(error)
    );
  }
}

export async function createMemoryWithRecordingForTest(
  input: CreateMemoryForAudioSegmentForTestInput
): Promise<MemoryFilesResult<MemorySummary>> {
  const { transactionHooks, ...productionInput } = input;
  return createMemoryWithRecordingForTestFixture(productionInput, transactionHooks);
}

export async function createMemoryFromFileTruth(
  input: CreateMemoryInput
): Promise<MemoryFilesResult<MemorySummary>> {
  let createdDirectory: string | null = null;
  let memoryFileWritten = false;

  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memoriesDirectory = await resolveSafeWorkspaceChild(
        input.rootPath,
        path.join(input.rootPath, 'memories')
      );
      await assertSafeExistingDirectory(
        memoriesDirectory,
        'Workspace memories directory is not safe'
      );
      const targetDirectory = await memoryDirectoryForNewNode(
        input.rootPath,
        input.memoryId,
        input.title
      );
      const existingMemoryDirectory = await memoryDirectory(input.rootPath, input.memoryId);
      if (
        (await exists(existingMemoryDirectory)) ||
        (targetDirectory !== existingMemoryDirectory && (await exists(targetDirectory)))
      ) {
        throw new Error('Memory target already exists');
      }
      createWorkspaceDirectoryWithinParent({
        parentDirectory: memoriesDirectory,
        directoryName: path.basename(targetDirectory),
        ...(input.assertWorkspaceUsable
          ? { beforeCommit: () => assertWorkspaceUsable(input.assertWorkspaceUsable) }
          : {}),
      });
      createdDirectory = targetDirectory;
      await assertSafeExistingDirectory(createdDirectory, 'Workspace memory directory is not safe');

      const createdAt = input.now();
      const memory: MemoryJson = {
        memoryId: input.memoryId,
        title: input.title,
        createdAt,
        updatedAt: createdAt,
        segmentIds: [],
      };
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      await writeWorkspaceJsonAtomic(
        path.join(createdDirectory, 'memory.json'),
        memory,
        input.assertWorkspaceUsable
          ? () => assertWorkspaceUsable(input.assertWorkspaceUsable)
          : undefined
      );
      memoryFileWritten = true;
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      if (input.rebuildIndex) {
        await input.rebuildIndex(input.rootPath);
      } else {
        await refreshMemoryIndexEntry(input.rootPath, input.memoryId, input.assertWorkspaceUsable);
      }
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      return { ok: true, value: await summarizeMemory(input.rootPath, memory) };
    });
  } catch (error) {
    let cleanupSucceeded = true;
    if (createdDirectory && (!memoryFileWritten || !(error instanceof WorkspaceHandleLost))) {
      cleanupSucceeded = await removeSafeWorkspaceDirectory(input.rootPath, createdDirectory, {
        allowMissing: true,
      }).catch(() => false);
    }
    if (memoryFileWritten && !(error instanceof WorkspaceHandleLost)) {
      cleanupSucceeded =
        (await rebuildMemoryIndex(input.rootPath).then(
          () => true,
          () => false
        )) && cleanupSucceeded;
    }
    if (error instanceof WorkspaceHandleLost) {
      return memoryFilesError(
        error,
        'ERR_MEMORY_CREATE_FAILED',
        'Memory could not be created',
        cleanupSucceeded ? 'none-written' : 'unknown'
      );
    }
    return memoryFilesError(
      error,
      'ERR_MEMORY_CREATE_FAILED',
      'Memory could not be created',
      cleanupSucceeded ? 'none-written' : 'unknown'
    );
  }
}

async function moveFileSpaceNodeDirectory({
  sourceName,
  sourceParentDirectory,
  targetName,
  targetParentDirectory,
  assertWorkspaceUsable: assertUsable,
  expectedSourceIdentity,
}: {
  readonly sourceName: string;
  readonly sourceParentDirectory: string;
  readonly targetName: string;
  readonly targetParentDirectory: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly expectedSourceIdentity?: DirectoryIdentity;
}): Promise<void> {
  if (!isSafeWorkspaceDirectoryName(sourceName) || !isSafeWorkspaceDirectoryName(targetName)) {
    throw new Error('Invalid file space node directory name');
  }
  const safeSourceParent = sourceParentDirectory;
  const safeTargetParent = targetParentDirectory;
  await assertSafeExistingDirectory(safeSourceParent, 'Workspace node source parent is not safe');
  await assertSafeExistingDirectory(safeTargetParent, 'Workspace node target parent is not safe');
  assertWorkspaceUsable(assertUsable);
  await beforeFileSpaceNodeMoveForTest?.();
  renameWorkspaceDirectoryAcrossParents({
    sourceParentDirectory: safeSourceParent,
    sourceName,
    targetParentDirectory: safeTargetParent,
    targetName,
    ...(assertUsable ? { beforeCommit: () => assertWorkspaceUsable(assertUsable) } : {}),
    ...(expectedSourceIdentity ? { expectedSourceIdentity } : {}),
  });
}

export async function deleteMemoryFromFileTruth(input: MemoryTargetInput): Promise<
  MemoryFilesResult<{
    readonly memoryId: string;
    readonly restoreToken: string;
    readonly memories: readonly MemorySummary[];
  }>
> {
  let movedToTrash = false;
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memory = await readMemoryJson(input.rootPath, input.memoryId);
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memoriesDirectory = await resolveSafeWorkspaceChild(
        input.rootPath,
        path.join(input.rootPath, 'memories')
      );
      await assertSafeExistingDirectory(
        memoriesDirectory,
        'Workspace memories directory is not safe'
      );
      const trashDirectory = await ensureMemoryTrashDirectory(
        input.rootPath,
        input.assertWorkspaceUsable
      );
      const sourceDirectory = await memoryDirectory(input.rootPath, input.memoryId);
      const sourceName = path.basename(sourceDirectory);
      await moveFileSpaceNodeDirectory({
        sourceName,
        sourceParentDirectory: memoriesDirectory,
        targetName: sourceName,
        targetParentDirectory: trashDirectory,
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      movedToTrash = true;
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memories = await rebuildMemoryIndex(input.rootPath, {
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      return {
        ok: true,
        value: {
          memoryId: memory.memoryId,
          restoreToken: memory.memoryId,
          memories,
        },
      };
    });
  } catch (error) {
    let rollbackSucceeded = !movedToTrash;
    if (movedToTrash && !(error instanceof WorkspaceHandleLost)) {
      try {
        const memoriesDirectory = await resolveSafeWorkspaceChild(
          input.rootPath,
          path.join(input.rootPath, 'memories')
        );
        const trashDirectory = await ensureMemoryTrashDirectory(input.rootPath);
        const sourceDirectory = await trashedMemoryDirectory(input.rootPath, input.memoryId);
        const sourceName = path.basename(sourceDirectory);
        await moveFileSpaceNodeDirectory({
          sourceName,
          sourceParentDirectory: trashDirectory,
          targetName: sourceName,
          targetParentDirectory: memoriesDirectory,
        });
        await rebuildMemoryIndex(input.rootPath);
        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }
    }
    return memoryFilesError(
      error,
      'ERR_MEMORY_DELETE_FAILED',
      'Memory could not be deleted',
      rollbackSucceeded ? 'previous-file-preserved' : 'file-written-index-stale'
    );
  }
}

export async function restoreDeletedMemoryFromFileTruth(input: {
  readonly rootPath: string;
  readonly restoreToken: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly memories: readonly MemorySummary[];
  }>
> {
  let movedToActive = false;
  const memoryId = input.restoreToken;
  try {
    return await withMemoryWriteLock(input.rootPath, memoryId, async () => {
      if (!MEMORY_ID_PATTERN.test(memoryId)) {
        throw new Error('Invalid restore token');
      }
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memoriesDirectory = await resolveSafeWorkspaceChild(
        input.rootPath,
        path.join(input.rootPath, 'memories')
      );
      await assertSafeExistingDirectory(
        memoriesDirectory,
        'Workspace memories directory is not safe'
      );
      const trashDirectory = await ensureMemoryTrashDirectory(
        input.rootPath,
        input.assertWorkspaceUsable
      );
      const sourceDirectory = await trashedMemoryDirectory(input.rootPath, memoryId);
      const sourceName = path.basename(sourceDirectory);
      await moveFileSpaceNodeDirectory({
        sourceName,
        sourceParentDirectory: trashDirectory,
        targetName: sourceName,
        targetParentDirectory: memoriesDirectory,
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      movedToActive = true;
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memories = await rebuildMemoryIndex(input.rootPath, {
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      const memory = memories.find((candidate) => candidate.memoryId === memoryId);
      if (!memory) {
        throw new Error('Restored memory summary missing');
      }
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      return {
        ok: true,
        value: {
          memory,
          memories,
        },
      };
    });
  } catch (error) {
    let rollbackSucceeded = !movedToActive;
    if (movedToActive && !(error instanceof WorkspaceHandleLost)) {
      try {
        const memoriesDirectory = await resolveSafeWorkspaceChild(
          input.rootPath,
          path.join(input.rootPath, 'memories')
        );
        const trashDirectory = await ensureMemoryTrashDirectory(input.rootPath);
        const sourceDirectory = await memoryDirectory(input.rootPath, memoryId);
        const sourceName = path.basename(sourceDirectory);
        await moveFileSpaceNodeDirectory({
          sourceName,
          sourceParentDirectory: memoriesDirectory,
          targetName: sourceName,
          targetParentDirectory: trashDirectory,
        });
        await rebuildMemoryIndex(input.rootPath);
        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }
    }
    return memoryFilesError(
      error,
      'ERR_MEMORY_RESTORE_FAILED',
      'Deleted memory could not be restored',
      rollbackSucceeded ? 'previous-file-preserved' : 'file-written-index-stale'
    );
  }
}

export async function deleteSegmentFromFileTruth(input: SegmentTargetInput): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segmentId: string;
    readonly restoreToken: string;
  }>
> {
  let movedToTrash = false;
  let previousMemory: MemoryJson | null = null;
  let movedSegmentDirectoryIdentity: DirectoryIdentity | null = null;
  let movedSegmentDirectoryName: string | null = null;
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      previousMemory = await readMemoryJson(input.rootPath, input.memoryId);
      const sourceDirectory = await memorySegmentDirectory(
        input.rootPath,
        input.memoryId,
        input.segmentId
      );
      await assertSafeExistingDirectory(sourceDirectory, 'Workspace segment directory is not safe');
      const sourceFileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
        recordingDirectory: sourceDirectory,
        memoryId: input.memoryId,
        strictUnsafePath: true,
      });
      if (
        !sourceFileTruth ||
        sourceFileTruth.segmentId !== input.segmentId ||
        sourceFileTruth.metadata.workspaceId !== input.workspaceId
      ) {
        throw new Error('Finalized segment projection does not match file truth');
      }

      const segmentsDirectory = path.dirname(sourceDirectory);
      await assertSafeExistingDirectory(
        segmentsDirectory,
        'Workspace segments directory is not safe'
      );
      const trashDirectory = await ensureSegmentTrashDirectory(
        input.rootPath,
        input.assertWorkspaceUsable
      );
      const sourceName = path.basename(sourceDirectory);
      movedSegmentDirectoryIdentity = sourceFileTruth.recordingDirectoryIdentity;
      movedSegmentDirectoryName = sourceName;
      await moveFileSpaceNodeDirectory({
        sourceName,
        sourceParentDirectory: segmentsDirectory,
        targetName: sourceName,
        targetParentDirectory: trashDirectory,
        expectedSourceIdentity: sourceFileTruth.recordingDirectoryIdentity,
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      movedToTrash = true;
      assertWorkspaceUsable(input.assertWorkspaceUsable);

      const activeSegmentFileTruths = await listValidFinalizedSegmentFileTruths(
        input.rootPath,
        input.memoryId
      );
      const refreshed = await refreshMemoryIndexEntryFromKnownFileTruths({
        rootPath: input.rootPath,
        memoryId: input.memoryId,
        memory: previousMemory,
        segmentIds: mergeSegmentIdsFromFileTruth(
          previousMemory.segmentIds.filter((segmentId) => segmentId !== input.segmentId),
          activeSegmentFileTruths.map((fileTruth) => fileTruth.segmentId)
        ),
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        fileTruths: activeSegmentFileTruths,
      });
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      previousMemory = refreshed.memoryJson;
      return {
        ok: true,
        value: {
          memory: refreshed.memory,
          segmentId: input.segmentId,
          restoreToken: input.segmentId,
        },
      };
    });
  } catch (error) {
    let rollbackSucceeded = !movedToTrash;
    if (movedToTrash && previousMemory && !(error instanceof WorkspaceHandleLost)) {
      try {
        assertWorkspaceUsable(input.assertWorkspaceUsable);
        const memoryDirectoryPath = await memoryDirectory(input.rootPath, input.memoryId);
        const segmentsDirectory = await ensureMemorySegmentsDirectory({
          memoryDirectoryPath,
          rootPath: input.rootPath,
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
        const trashDirectory = await ensureSegmentTrashDirectory(
          input.rootPath,
          input.assertWorkspaceUsable
        );
        const sourceName = movedSegmentDirectoryName;
        if (!sourceName) {
          throw new Error('Moved segment directory name is missing', { cause: error });
        }
        await moveFileSpaceNodeDirectory({
          sourceName,
          sourceParentDirectory: trashDirectory,
          targetName: sourceName,
          targetParentDirectory: segmentsDirectory,
          ...(movedSegmentDirectoryIdentity
            ? { expectedSourceIdentity: movedSegmentDirectoryIdentity }
            : {}),
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        await writeWorkspaceJsonAtomic(
          path.join(memoryDirectoryPath, 'memory.json'),
          previousMemory,
          input.assertWorkspaceUsable
            ? () => assertWorkspaceUsable(input.assertWorkspaceUsable)
            : undefined
        );
        await rebuildMemoryIndex(input.rootPath, {
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }
    }
    return segmentDeleteError(
      error,
      rollbackSucceeded ? 'previous-file-preserved' : 'file-written-index-stale'
    );
  }
}

export async function restoreDeletedSegmentFromFileTruth(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly restoreToken: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
  }>
> {
  let movedToActive = false;
  let previousMemory: MemoryJson | null = null;
  let movedSegmentDirectoryIdentity: DirectoryIdentity | null = null;
  let movedSegmentDirectoryName: string | null = null;
  const segmentId = input.restoreToken;
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      if (!SEGMENT_ID_PATTERN.test(segmentId)) {
        throw new Error('Invalid segment id');
      }
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memoryDirectoryPath = await memoryDirectory(input.rootPath, input.memoryId);
      try {
        await assertSafeExistingDirectory(
          memoryDirectoryPath,
          'Workspace memory directory is not safe'
        );
      } catch (error) {
        if (isMissingFileError(error)) {
          throw new Error('Segment restore parent memory missing', { cause: error });
        }
        throw error;
      }
      previousMemory = await readMemoryJson(input.rootPath, input.memoryId);

      const segmentsDirectory = await ensureMemorySegmentsDirectory({
        memoryDirectoryPath,
        rootPath: input.rootPath,
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
      });
      const trashDirectory = await ensureSegmentTrashDirectory(
        input.rootPath,
        input.assertWorkspaceUsable
      );
      const sourceDirectory = await trashedSegmentDirectory(
        input.rootPath,
        input.memoryId,
        segmentId
      );
      await assertSafeExistingDirectory(sourceDirectory, 'Workspace segment directory is not safe');
      const sourceFileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
        recordingDirectory: sourceDirectory,
        memoryId: input.memoryId,
        strictUnsafePath: true,
      });
      if (
        !sourceFileTruth ||
        sourceFileTruth.segmentId !== segmentId ||
        sourceFileTruth.metadata.workspaceId !== input.workspaceId
      ) {
        throw new Error('Finalized segment projection does not match file truth');
      }

      const sourceName = path.basename(sourceDirectory);
      movedSegmentDirectoryIdentity = sourceFileTruth.recordingDirectoryIdentity;
      movedSegmentDirectoryName = sourceName;
      await moveFileSpaceNodeDirectory({
        sourceName,
        sourceParentDirectory: trashDirectory,
        targetName: sourceName,
        targetParentDirectory: segmentsDirectory,
        expectedSourceIdentity: sourceFileTruth.recordingDirectoryIdentity,
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      movedToActive = true;
      assertWorkspaceUsable(input.assertWorkspaceUsable);

      const activeSegmentFileTruths = await listValidFinalizedSegmentFileTruths(
        input.rootPath,
        input.memoryId
      );
      const restoredFileTruth =
        activeSegmentFileTruths.find((fileTruth) => fileTruth.segmentId === segmentId) ?? null;
      const restoredSegment = restoredFileTruth
        ? await finalizedSegmentProjectionFromFileTruth({
            rootPath: input.rootPath,
            workspaceId: input.workspaceId,
            fileTruth: restoredFileTruth,
          })
        : null;
      if (!restoredSegment || restoredSegment.segmentId !== segmentId) {
        throw new Error('Finalized segment projection does not match file truth');
      }
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const refreshed = await refreshMemoryIndexEntryFromKnownFileTruths({
        rootPath: input.rootPath,
        memoryId: input.memoryId,
        memory: previousMemory,
        segmentIds: mergeSegmentIdsFromFileTruth(
          previousMemory.segmentIds,
          activeSegmentFileTruths.map((fileTruth) => fileTruth.segmentId)
        ),
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        fileTruths: activeSegmentFileTruths,
      });
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      previousMemory = refreshed.memoryJson;
      return {
        ok: true,
        value: {
          memory: refreshed.memory,
          segment: restoredSegment,
        },
      };
    });
  } catch (error) {
    let rollbackSucceeded = !movedToActive;
    if (movedToActive && previousMemory && !(error instanceof WorkspaceHandleLost)) {
      try {
        assertWorkspaceUsable(input.assertWorkspaceUsable);
        const memoryDirectoryPath = await memoryDirectory(input.rootPath, input.memoryId);
        const segmentsDirectory = await ensureMemorySegmentsDirectory({
          memoryDirectoryPath,
          rootPath: input.rootPath,
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
        const trashDirectory = await ensureSegmentTrashDirectory(
          input.rootPath,
          input.assertWorkspaceUsable
        );
        const sourceName = movedSegmentDirectoryName;
        if (!sourceName) {
          throw new Error('Moved segment directory name is missing', { cause: error });
        }
        await moveFileSpaceNodeDirectory({
          sourceName,
          sourceParentDirectory: segmentsDirectory,
          targetName: sourceName,
          targetParentDirectory: trashDirectory,
          ...(movedSegmentDirectoryIdentity
            ? { expectedSourceIdentity: movedSegmentDirectoryIdentity }
            : {}),
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        await writeWorkspaceJsonAtomic(
          path.join(memoryDirectoryPath, 'memory.json'),
          previousMemory,
          input.assertWorkspaceUsable
            ? () => assertWorkspaceUsable(input.assertWorkspaceUsable)
            : undefined
        );
        await rebuildMemoryIndex(input.rootPath, {
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }
    }
    return segmentRestoreError(
      error,
      rollbackSucceeded ? 'previous-file-preserved' : 'file-written-index-stale'
    );
  }
}

export async function deleteSegmentAttachmentFromFileTruth(
  input: SegmentAttachmentTargetInput
): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
    readonly attachmentId: string;
    readonly restoreToken: string;
  }>
> {
  let movedToTrash = false;
  let movedAttachmentDirectoryIdentity: DirectoryIdentity | null = null;
  let movedAttachmentDirectoryName: string | null = null;
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memory = await readMemoryJson(input.rootPath, input.memoryId);
      const sourceDirectory = await segmentAttachmentDirectory(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        input.attachmentId
      );
      await assertSafeExistingDirectory(
        sourceDirectory,
        'Workspace segment attachment directory is not safe'
      );
      const sourceDirectoryIdentity = await readDirectoryIdentity(sourceDirectory);
      const sourceAttachment = readValidFinalizedAttachmentProjection({
        attachmentDirectory: sourceDirectory,
        attachmentDirectoryIdentity: sourceDirectoryIdentity,
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
      });
      if (!sourceAttachment || sourceAttachment.attachmentId !== input.attachmentId) {
        throw new Error('Finalized segment attachment projection does not match file truth');
      }

      const attachmentsDirectory = path.dirname(sourceDirectory);
      await assertSafeExistingDirectory(
        attachmentsDirectory,
        'Workspace segment attachments directory is not safe'
      );
      const trashDirectory = await ensureSegmentAttachmentTrashDirectory(
        input.rootPath,
        input.assertWorkspaceUsable
      );
      const sourceName = path.basename(sourceDirectory);
      movedAttachmentDirectoryIdentity = sourceDirectoryIdentity;
      movedAttachmentDirectoryName = sourceName;
      await moveFileSpaceNodeDirectory({
        sourceName,
        sourceParentDirectory: attachmentsDirectory,
        targetName: sourceName,
        targetParentDirectory: trashDirectory,
        expectedSourceIdentity: sourceDirectoryIdentity,
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      movedToTrash = true;
      assertWorkspaceUsable(input.assertWorkspaceUsable);

      const activeSegmentFileTruths = await listValidFinalizedSegmentFileTruths(
        input.rootPath,
        input.memoryId
      );
      const parentSegmentFileTruth =
        activeSegmentFileTruths.find((fileTruth) => fileTruth.segmentId === input.segmentId) ??
        null;
      const parentSegment = parentSegmentFileTruth
        ? await finalizedSegmentProjectionFromFileTruth({
            rootPath: input.rootPath,
            workspaceId: input.workspaceId,
            fileTruth: parentSegmentFileTruth,
          })
        : null;
      if (!parentSegment || parentSegment.segmentId !== input.segmentId) {
        throw new Error('Finalized segment attachment projection does not match file truth');
      }
      const refreshed = await refreshMemoryIndexEntryFromKnownFileTruths({
        rootPath: input.rootPath,
        memoryId: input.memoryId,
        memory,
        segmentIds: mergeSegmentIdsFromFileTruth(
          memory.segmentIds,
          activeSegmentFileTruths.map((fileTruth) => fileTruth.segmentId)
        ),
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        fileTruths: activeSegmentFileTruths,
      });
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      return {
        ok: true,
        value: {
          memory: refreshed.memory,
          segment: parentSegment,
          attachmentId: input.attachmentId,
          restoreToken: input.attachmentId,
        },
      };
    });
  } catch (error) {
    let rollbackSucceeded = !movedToTrash;
    if (movedToTrash && !(error instanceof WorkspaceHandleLost)) {
      try {
        assertWorkspaceUsable(input.assertWorkspaceUsable);
        const attachmentsDirectory = await ensureSegmentAttachmentsDirectory({
          rootPath: input.rootPath,
          memoryId: input.memoryId,
          segmentId: input.segmentId,
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
        const trashDirectory = await ensureSegmentAttachmentTrashDirectory(
          input.rootPath,
          input.assertWorkspaceUsable
        );
        const sourceName = movedAttachmentDirectoryName;
        if (!sourceName) {
          throw new Error('Moved segment attachment directory name is missing', { cause: error });
        }
        await moveFileSpaceNodeDirectory({
          sourceName,
          sourceParentDirectory: trashDirectory,
          targetName: sourceName,
          targetParentDirectory: attachmentsDirectory,
          ...(movedAttachmentDirectoryIdentity
            ? { expectedSourceIdentity: movedAttachmentDirectoryIdentity }
            : {}),
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        await rebuildMemoryIndex(input.rootPath, {
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }
    }
    return segmentAttachmentDeleteError(
      error,
      rollbackSucceeded ? 'previous-file-preserved' : 'file-written-index-stale'
    );
  }
}

export async function restoreDeletedSegmentAttachmentFromFileTruth(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly restoreToken: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
    readonly attachment: WorkspaceSegmentAttachmentProjection;
  }>
> {
  let movedToActive = false;
  let movedAttachmentDirectoryIdentity: DirectoryIdentity | null = null;
  let movedAttachmentDirectoryName: string | null = null;
  const attachmentId = input.restoreToken;
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      if (!ATTACHMENT_ID_PATTERN.test(attachmentId)) {
        throw new Error('Invalid segment attachment id');
      }
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      let memory: MemoryJson;
      let parentSegmentDirectory: string;
      try {
        memory = await readMemoryJson(input.rootPath, input.memoryId);
        parentSegmentDirectory = await memorySegmentDirectory(
          input.rootPath,
          input.memoryId,
          input.segmentId
        );
        await assertSafeExistingDirectory(
          parentSegmentDirectory,
          'Workspace segment directory is not safe'
        );
      } catch (error) {
        if (isMissingFileError(error)) {
          throw new Error('Segment attachment restore parent missing', { cause: error });
        }
        throw error;
      }
      const parentSegmentFileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
        recordingDirectory: parentSegmentDirectory,
        memoryId: input.memoryId,
        strictUnsafePath: true,
      });
      if (
        !parentSegmentFileTruth ||
        parentSegmentFileTruth.segmentId !== input.segmentId ||
        parentSegmentFileTruth.metadata.workspaceId !== input.workspaceId
      ) {
        throw new Error('Segment attachment restore parent missing');
      }

      const attachmentsDirectory = await ensureSegmentAttachmentsDirectory({
        rootPath: input.rootPath,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
      });
      const trashDirectory = await ensureSegmentAttachmentTrashDirectory(
        input.rootPath,
        input.assertWorkspaceUsable
      );
      const sourceDirectory = await trashedSegmentAttachmentDirectory(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        attachmentId
      );
      await assertSafeExistingDirectory(
        sourceDirectory,
        'Workspace segment attachment trash directory is not safe'
      );
      const sourceDirectoryIdentity = await readDirectoryIdentity(sourceDirectory);
      const sourceAttachment = readValidFinalizedAttachmentProjection({
        attachmentDirectory: sourceDirectory,
        attachmentDirectoryIdentity: sourceDirectoryIdentity,
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
      });
      if (!sourceAttachment || sourceAttachment.attachmentId !== attachmentId) {
        throw new Error('Finalized segment attachment projection does not match file truth');
      }

      const sourceName = path.basename(sourceDirectory);
      movedAttachmentDirectoryIdentity = sourceDirectoryIdentity;
      movedAttachmentDirectoryName = sourceName;
      await moveFileSpaceNodeDirectory({
        sourceName,
        sourceParentDirectory: trashDirectory,
        targetName: sourceName,
        targetParentDirectory: attachmentsDirectory,
        expectedSourceIdentity: sourceDirectoryIdentity,
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      movedToActive = true;
      assertWorkspaceUsable(input.assertWorkspaceUsable);

      const activeSegmentFileTruths = await listValidFinalizedSegmentFileTruths(
        input.rootPath,
        input.memoryId
      );
      const restoredSegmentFileTruth =
        activeSegmentFileTruths.find((fileTruth) => fileTruth.segmentId === input.segmentId) ??
        null;
      const restoredSegment = restoredSegmentFileTruth
        ? await finalizedSegmentProjectionFromFileTruth({
            rootPath: input.rootPath,
            workspaceId: input.workspaceId,
            fileTruth: restoredSegmentFileTruth,
          })
        : null;
      const restoredAttachment =
        restoredSegment?.attachments.find(
          (attachment) => attachment.attachmentId === attachmentId
        ) ?? null;
      if (!restoredSegment || !restoredAttachment) {
        throw new Error('Finalized segment attachment projection does not match file truth');
      }
      const refreshed = await refreshMemoryIndexEntryFromKnownFileTruths({
        rootPath: input.rootPath,
        memoryId: input.memoryId,
        memory,
        segmentIds: mergeSegmentIdsFromFileTruth(
          memory.segmentIds,
          activeSegmentFileTruths.map((fileTruth) => fileTruth.segmentId)
        ),
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        fileTruths: activeSegmentFileTruths,
      });
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      return {
        ok: true,
        value: {
          memory: refreshed.memory,
          segment: restoredSegment,
          attachment: restoredAttachment,
        },
      };
    });
  } catch (error) {
    let rollbackSucceeded = !movedToActive;
    if (movedToActive && !(error instanceof WorkspaceHandleLost)) {
      try {
        assertWorkspaceUsable(input.assertWorkspaceUsable);
        const attachmentsDirectory = await ensureSegmentAttachmentsDirectory({
          rootPath: input.rootPath,
          memoryId: input.memoryId,
          segmentId: input.segmentId,
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
        const trashDirectory = await ensureSegmentAttachmentTrashDirectory(
          input.rootPath,
          input.assertWorkspaceUsable
        );
        const sourceName = movedAttachmentDirectoryName;
        if (!sourceName) {
          throw new Error('Moved segment attachment directory name is missing', { cause: error });
        }
        await moveFileSpaceNodeDirectory({
          sourceName,
          sourceParentDirectory: attachmentsDirectory,
          targetName: sourceName,
          targetParentDirectory: trashDirectory,
          ...(movedAttachmentDirectoryIdentity
            ? { expectedSourceIdentity: movedAttachmentDirectoryIdentity }
            : {}),
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        await rebuildMemoryIndex(input.rootPath, {
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }
    }
    return segmentAttachmentRestoreError(
      error,
      rollbackSucceeded ? 'previous-file-preserved' : 'file-written-index-stale'
    );
  }
}

async function appendAudioSegmentToMemoryWithHooks(
  input: AppendAudioSegmentToMemoryInput,
  transactionHooks?: FinalizeTransactionHooks
): Promise<MemoryFilesResult<MemorySummary>> {
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const current = await readMemoryJson(input.rootPath, input.memoryId);
      const updatedAt = input.now();
      const next: MemoryJson = {
        ...current,
        updatedAt,
        segmentIds: [
          ...current.segmentIds.filter((segmentId) => segmentId !== input.segmentId),
          input.segmentId,
        ],
      };
      const { stagingSegmentDirectory, targetRecordingDirectory } =
        await copyDraftRecordingIntoMemory({
          rootPath: input.rootPath,
          memoryId: input.memoryId,
          segmentId: input.segmentId,
          title: input.title,
          ...(transactionHooks ? { hooks: transactionHooks } : {}),
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
      const summary = await finishFinalizeTransaction({
        rootPath: input.rootPath,
        stagingSegmentDirectory,
        targetRecordingDirectory,
        memoryId: input.memoryId,
        nextMemory: next,
        previousMemory: current,
        segmentId: input.segmentId,
        workspaceId: input.workspaceId,
        title: input.title,
        durationMs: input.durationMs,
        finalizedAt: updatedAt,
        rebuildIndex:
          input.rebuildIndex ??
          ((rootPath) =>
            rebuildMemoryIndex(rootPath, {
              ...(input.assertWorkspaceUsable
                ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
                : {}),
            })),
        ...(transactionHooks ? { hooks: transactionHooks } : {}),
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
      });
      return { ok: true, value: summary };
    });
  } catch (error) {
    return memoryFilesError(
      error,
      'ERR_RECORDING_FINALIZE_FAILED',
      'Recording could not be attached to memory',
      finalizeFailureRetention(error)
    );
  }
}

export async function appendAudioSegmentToMemory(
  input: AppendAudioSegmentToMemoryInput
): Promise<MemoryFilesResult<MemorySummary>> {
  return appendAudioSegmentToMemoryWithHooks(input);
}

export async function appendAudioSegmentToMemoryForTest(
  input: AppendAudioSegmentToMemoryForTestInput
): Promise<MemoryFilesResult<MemorySummary>> {
  const { transactionHooks, ...productionInput } = input;
  return appendAudioSegmentToMemoryWithHooks(productionInput, transactionHooks);
}

export async function appendAudioAttachmentToSegment(
  input: AppendAudioAttachmentToSegmentInput
): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
    readonly attachment: WorkspaceSegmentAttachmentProjection;
  }>
> {
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const current = await readMemoryJson(input.rootPath, input.memoryId);
      const fileTruthSegmentIds = await listValidFinalizedSegmentIds(
        input.rootPath,
        input.memoryId
      );
      if (!fileTruthSegmentIds.includes(input.segmentId)) {
        throw new Error('Segment attachment parent is not part of memory');
      }
      const parentSegment = await readValidFinalizedSegmentProjection({
        rootPath: input.rootPath,
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
      });
      if (!parentSegment) {
        throw new Error('Segment attachment parent is not finalized');
      }

      const updatedAt = input.now();
      const nextMemory = {
        ...current,
        updatedAt,
        segmentIds: mergeSegmentIdsFromFileTruth(current.segmentIds, fileTruthSegmentIds),
      };
      const attachmentsDirectory = await ensureSegmentAttachmentsDirectory({
        rootPath: input.rootPath,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
      });
      const targetAttachmentDirectory = await segmentAttachmentDirectoryForNewNode(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        input.attachmentId,
        input.title
      );
      const relativeTarget = path.relative(attachmentsDirectory, targetAttachmentDirectory);
      if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
        throw new Error('Segment attachment target escapes parent');
      }
      const existingAttachmentDirectory = await segmentAttachmentDirectory(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        input.attachmentId
      );
      if (await exists(existingAttachmentDirectory)) {
        throw new Error('Segment attachment target already exists');
      }
      if (await exists(targetAttachmentDirectory)) {
        throw new Error('Segment attachment target already exists');
      }

      const stagingName = `${FINALIZE_STAGING_PREFIX}${input.attachmentId}.${process.pid}.${Date.now()}`;
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      createWorkspaceDirectoryWithinParent({
        parentDirectory: attachmentsDirectory,
        directoryName: stagingName,
        ...(input.assertWorkspaceUsable
          ? { beforeCommit: () => assertWorkspaceUsable(input.assertWorkspaceUsable) }
          : {}),
      });
      const stagingAttachmentDirectory = path.join(attachmentsDirectory, stagingName);
      await writeWorkspaceJsonAtomic(
        path.join(stagingAttachmentDirectory, FINALIZE_TRANSACTION_MARKER),
        {
          schemaVersion: 1,
          memoryId: input.memoryId,
          segmentId: input.segmentId,
          attachmentId: input.attachmentId,
          draftPath: `.reo/drafts/attachments/${input.attachmentId}`,
        }
      );
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      await copyDirectoryContents(
        await draftAttachmentDirectory(input.rootPath, input.attachmentId),
        stagingAttachmentDirectory,
        DRAFT_ATTACHMENT_FILES
      );
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      await writeFinalizedAttachmentFiles({
        targetAttachmentDirectory: stagingAttachmentDirectory,
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
        attachmentId: input.attachmentId,
        title: input.title,
        durationMs: input.durationMs,
        finalizedAt: updatedAt,
      });
      await fsyncDirectoryTree(stagingAttachmentDirectory);
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      renameWorkspaceDirectoryWithinParent({
        parentDirectory: attachmentsDirectory,
        sourceName: stagingName,
        targetName: path.basename(targetAttachmentDirectory),
        ...(input.assertWorkspaceUsable
          ? { beforeCommit: () => assertWorkspaceUsable(input.assertWorkspaceUsable) }
          : {}),
      });

      const finalAttachmentDirectory = await segmentAttachmentDirectory(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        input.attachmentId
      );
      const finalAttachmentDirectoryIdentity =
        await readDirectoryIdentity(finalAttachmentDirectory);
      removeFileInDirectory(
        finalAttachmentDirectory,
        finalAttachmentDirectoryIdentity,
        FINALIZE_TRANSACTION_MARKER
      );
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const currentMemoryDirectory = await memoryDirectory(input.rootPath, input.memoryId);
      await writeWorkspaceJsonAtomic(path.join(currentMemoryDirectory, 'memory.json'), nextMemory);
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memories = input.rebuildIndex
        ? await input.rebuildIndex(input.rootPath)
        : await rebuildMemoryIndex(input.rootPath, {
            ...(input.assertWorkspaceUsable
              ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
              : {}),
          });
      const memory = memories.find((candidate) => candidate.memoryId === input.memoryId);
      if (!memory) {
        throw new Error('Segment attachment memory summary missing');
      }
      const segment = await readValidFinalizedSegmentProjection({
        rootPath: input.rootPath,
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
      });
      const attachment = readValidFinalizedAttachmentProjection({
        attachmentDirectory: finalAttachmentDirectory,
        attachmentDirectoryIdentity: await readDirectoryIdentity(finalAttachmentDirectory),
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
      });
      if (!segment || !attachment) {
        throw new Error('Segment attachment projection missing');
      }
      return {
        ok: true,
        value: {
          memory,
          segment,
          attachment,
        },
      };
    });
  } catch (error) {
    return memoryFilesError(
      error,
      'ERR_RECORDING_FINALIZE_FAILED',
      'Segment attachment recording could not be finalized',
      finalizeFailureRetention(error)
    );
  }
}

export async function updateMemoryTitleFromFileTruth(
  input: UpdateMemoryTitleInput
): Promise<MemoryFilesResult<MemorySummary>> {
  try {
    assertWorkspaceUsable(input.assertWorkspaceUsable);
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const current = await readMemoryJson(input.rootPath, input.memoryId);
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const renamedAt = input.now();
      const next = { ...current, title: input.title };
      const sourceDirectory = await memoryDirectory(input.rootPath, input.memoryId);
      const targetDirectory = await memoryDirectoryForNewNode(
        input.rootPath,
        input.memoryId,
        input.title
      );
      const parentDirectory = path.dirname(sourceDirectory);
      if (path.dirname(targetDirectory) !== parentDirectory) {
        throw new Error('Memory rename target parent changed');
      }
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      if (path.basename(sourceDirectory) !== path.basename(targetDirectory)) {
        renameWorkspaceDirectoryAcrossParents({
          sourceParentDirectory: parentDirectory,
          sourceName: path.basename(sourceDirectory),
          targetParentDirectory: parentDirectory,
          targetName: path.basename(targetDirectory),
          ...(input.assertWorkspaceUsable
            ? { beforeCommit: () => assertWorkspaceUsable(input.assertWorkspaceUsable) }
            : {}),
        });
      }
      const directory = await memoryDirectory(input.rootPath, input.memoryId);
      await writeWorkspaceJsonAtomic(path.join(directory, 'memory.json'), next);
      await touchWorkspacePathBestEffort(directory, renamedAt);
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const summary = await refreshMemoryIndexEntry(
        input.rootPath,
        input.memoryId,
        input.assertWorkspaceUsable
      ).catch(() => summarizeMemory(input.rootPath, next));
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      return { ok: true, value: summary };
    });
  } catch (error) {
    return updateMemoryTitleError(error);
  }
}

export async function updateSegmentTitleFromFileTruth(input: UpdateSegmentTitleInput): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
  }>
> {
  try {
    assertWorkspaceUsable(input.assertWorkspaceUsable);
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const currentMemory = await readMemoryJson(input.rootPath, input.memoryId);
      const fileTruths = await listValidFinalizedSegmentFileTruths(input.rootPath, input.memoryId);
      const sourceFileTruth = fileTruths.find(
        (fileTruth) => fileTruth.segmentId === input.segmentId
      );
      if (!sourceFileTruth) {
        throw new Error('Finalized segment projection does not match file truth');
      }
      const fileTruthSegmentIds = fileTruths.map((fileTruth) => fileTruth.segmentId);
      const renamedAt = input.now();
      const sourceDirectory = sourceFileTruth.recordingDirectory;
      const targetDirectory = await memorySegmentDirectoryForNewNode(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        input.title
      );
      const parentDirectory = path.dirname(sourceDirectory);
      if (path.dirname(targetDirectory) !== parentDirectory) {
        throw new Error('Segment rename target parent changed');
      }

      assertWorkspaceUsable(input.assertWorkspaceUsable);
      if (path.basename(sourceDirectory) !== path.basename(targetDirectory)) {
        renameWorkspaceDirectoryAcrossParents({
          sourceParentDirectory: parentDirectory,
          sourceName: path.basename(sourceDirectory),
          targetParentDirectory: parentDirectory,
          targetName: path.basename(targetDirectory),
          ...(input.assertWorkspaceUsable
            ? { beforeCommit: () => assertWorkspaceUsable(input.assertWorkspaceUsable) }
            : {}),
        });
      }

      const finalDirectory =
        path.basename(sourceDirectory) === path.basename(targetDirectory)
          ? sourceDirectory
          : targetDirectory;
      const finalDirectoryIdentity = await readDirectoryIdentity(finalDirectory);
      const segment = await readFinalizedSegmentMetadata(finalDirectory, finalDirectoryIdentity);
      await writeWorkspaceJsonAtomicInKnownDirectory({
        directory: finalDirectory,
        directoryIdentity: finalDirectoryIdentity,
        fileName: 'segment.json',
        value: {
          ...segment,
          title: input.title,
        },
      });
      const repairedSegmentIds = mergeSegmentIdsFromFileTruth(
        currentMemory.segmentIds,
        fileTruthSegmentIds
      );
      if (!sameSegmentIds(currentMemory.segmentIds, repairedSegmentIds)) {
        await writeWorkspaceJsonAtomic(
          path.join(await memoryDirectory(input.rootPath, input.memoryId), 'memory.json'),
          {
            ...currentMemory,
            segmentIds: repairedSegmentIds,
          }
        );
      }

      const memoryDirectoryPath = await memoryDirectory(input.rootPath, input.memoryId);
      await touchWorkspacePathBestEffort(finalDirectory, renamedAt);
      await touchWorkspacePathBestEffort(memoryDirectoryPath, renamedAt);
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memory = await refreshMemoryIndexEntry(
        input.rootPath,
        input.memoryId,
        input.assertWorkspaceUsable
      ).catch(() => summarizeMemory(input.rootPath, currentMemory));
      const refreshedFileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
        recordingDirectory: finalDirectory,
        memoryId: input.memoryId,
      });
      const refreshedSegment = refreshedFileTruth
        ? await finalizedSegmentProjectionFromFileTruth({
            rootPath: input.rootPath,
            workspaceId: input.workspaceId,
            fileTruth: refreshedFileTruth,
          })
        : null;
      if (!refreshedSegment || refreshedSegment.segmentId !== input.segmentId) {
        throw new Error('Finalized segment projection does not match file truth');
      }
      return {
        ok: true,
        value: {
          memory,
          segment: refreshedSegment,
        },
      };
    });
  } catch (error) {
    return updateSegmentTitleError(error);
  }
}

export async function updateSegmentAttachmentTitleFromFileTruth(
  input: UpdateSegmentAttachmentTitleInput
): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
    readonly attachment: WorkspaceSegmentAttachmentProjection;
  }>
> {
  try {
    assertWorkspaceUsable(input.assertWorkspaceUsable);
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const sourceDirectory = await segmentAttachmentDirectory(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        input.attachmentId
      );
      const sourceDirectoryIdentity = await readDirectoryIdentity(sourceDirectory);
      const sourceAttachmentMetadata = readFinalizedSegmentAttachmentMetadata(
        sourceDirectory,
        sourceDirectoryIdentity
      );
      if (
        sourceAttachmentMetadata.workspaceId !== input.workspaceId ||
        sourceAttachmentMetadata.memoryId !== input.memoryId ||
        sourceAttachmentMetadata.segmentId !== input.segmentId ||
        sourceAttachmentMetadata.attachmentId !== input.attachmentId
      ) {
        throw new Error('Finalized segment attachment projection does not match file truth');
      }
      const targetDirectory = await segmentAttachmentDirectoryForNewNode(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        input.attachmentId,
        input.title
      );
      const parentDirectory = path.dirname(sourceDirectory);
      if (path.dirname(targetDirectory) !== parentDirectory) {
        throw new Error('Segment attachment rename target parent changed');
      }

      assertWorkspaceUsable(input.assertWorkspaceUsable);
      if (path.basename(sourceDirectory) !== path.basename(targetDirectory)) {
        renameWorkspaceDirectoryAcrossParents({
          sourceParentDirectory: parentDirectory,
          sourceName: path.basename(sourceDirectory),
          targetParentDirectory: parentDirectory,
          targetName: path.basename(targetDirectory),
          expectedSourceIdentity: sourceDirectoryIdentity,
          ...(input.assertWorkspaceUsable
            ? { beforeCommit: () => assertWorkspaceUsable(input.assertWorkspaceUsable) }
            : {}),
        });
      }

      const finalDirectory =
        path.basename(sourceDirectory) === path.basename(targetDirectory)
          ? sourceDirectory
          : targetDirectory;
      const finalDirectoryIdentity = await readDirectoryIdentity(finalDirectory);
      const attachmentMetadata = readFinalizedSegmentAttachmentMetadata(
        finalDirectory,
        finalDirectoryIdentity
      );
      if (
        attachmentMetadata.workspaceId !== input.workspaceId ||
        attachmentMetadata.memoryId !== input.memoryId ||
        attachmentMetadata.segmentId !== input.segmentId ||
        attachmentMetadata.attachmentId !== input.attachmentId
      ) {
        throw new Error('Finalized segment attachment projection does not match file truth');
      }

      await writeWorkspaceJsonAtomicInKnownDirectory({
        directory: finalDirectory,
        directoryIdentity: finalDirectoryIdentity,
        fileName: 'attachment.json',
        value: {
          ...attachmentMetadata,
          title: input.title,
        },
      });

      assertWorkspaceUsable(input.assertWorkspaceUsable);
      let memory: MemorySummary;
      try {
        memory = await refreshMemoryIndexEntry(
          input.rootPath,
          input.memoryId,
          input.assertWorkspaceUsable
        );
      } catch (error) {
        throw new FileWrittenIndexStale(error);
      }
      const segment = await readValidFinalizedSegmentProjection({
        rootPath: input.rootPath,
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
      });
      const attachment = readValidFinalizedAttachmentProjection({
        attachmentDirectory: finalDirectory,
        attachmentDirectoryIdentity: await readDirectoryIdentity(finalDirectory),
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
      });
      if (!segment || !attachment || attachment.attachmentId !== input.attachmentId) {
        throw new Error('Finalized segment attachment projection does not match file truth');
      }
      return {
        ok: true,
        value: {
          memory,
          segment,
          attachment,
        },
      };
    });
  } catch (error) {
    return updateSegmentAttachmentTitleError(error);
  }
}

export async function lookupSegmentDirectoryById(
  rootPath: string,
  segmentId: string
): Promise<SegmentDirectoryLookup> {
  if (!SEGMENT_ID_PATTERN.test(segmentId)) {
    return { status: 'invalid-id' };
  }
  await beforeRecordingLookupForTest?.();
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  const memoryEntries = await readExistingDirectoryEntries(memoriesDirectory);
  let foundDirectory: string | null = null;
  let foundRecording: MemorySegmentSummary | null = null;
  let duplicateFound = false;
  let invalidDurableFound = false;
  for (const memoryEntry of memoryEntries) {
    if (!memoryEntry.isDirectory()) {
      continue;
    }
    let memory: MemoryJson;
    try {
      memory = await readMemoryJsonFromDirectory(path.join(memoriesDirectory, memoryEntry.name));
    } catch {
      continue;
    }
    let candidate: string;
    try {
      candidate = await memorySegmentDirectory(rootPath, memory.memoryId, segmentId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Duplicate finalized segment id') {
        duplicateFound = true;
        continue;
      }
      continue;
    }
    try {
      const metadata = await lstat(candidate);
      const recording = metadata.isDirectory()
        ? await summarizeValidFinalizedSegmentDirectory(rootPath, memory.memoryId, segmentId)
        : null;
      if (recording) {
        if (foundDirectory) {
          duplicateFound = true;
          continue;
        }
        foundDirectory = candidate;
        foundRecording = recording;
        continue;
      }
      if (metadata.isDirectory() || metadata.isSymbolicLink()) {
        invalidDurableFound = true;
      }
    } catch {
      continue;
    }
  }
  if (duplicateFound) {
    return { status: 'duplicate' };
  }
  if (invalidDurableFound) {
    return { status: 'invalid-durable' };
  }
  if (foundDirectory) {
    if (!foundRecording) {
      return { status: 'invalid-durable' };
    }
    return { status: 'found', directory: foundDirectory, segment: foundRecording };
  }
  return { status: 'not-found' };
}

export async function findSegmentDirectoryById(
  rootPath: string,
  segmentId: string
): Promise<string> {
  const lookup = await lookupSegmentDirectoryById(rootPath, segmentId);
  if (lookup.status === 'found') {
    return lookup.directory;
  }
  if (lookup.status === 'duplicate') {
    throw new Error('Duplicate finalized segment id');
  }
  if (lookup.status === 'invalid-id') {
    throw new Error('Invalid segment id');
  }
  if (lookup.status === 'invalid-durable') {
    throw new Error('Invalid durable recording');
  }
  throw new Error('Recording not found');
}

export async function findFinalizedAudioSegmentById(
  rootPath: string,
  segmentId: string
): Promise<{
  readonly directory: string;
  readonly segment: MemorySegmentSummary;
}> {
  const lookup = await lookupSegmentDirectoryById(rootPath, segmentId);
  if (lookup.status === 'found') {
    return { directory: lookup.directory, segment: lookup.segment };
  }
  if (lookup.status === 'duplicate') {
    throw new Error('Duplicate finalized segment id');
  }
  if (lookup.status === 'invalid-id') {
    throw new Error('Invalid segment id');
  }
  if (lookup.status === 'invalid-durable') {
    throw new Error('Invalid durable recording');
  }
  throw new Error('Recording not found');
}

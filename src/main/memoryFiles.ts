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
import { lstat, open, readdir, realpath } from 'node:fs/promises';
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
  MEMORY_ID_PATTERN,
  SEGMENT_ID_PATTERN,
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

type MemoryFilesResult<T> = { readonly ok: true; readonly value: T } | WorkspaceErrorEnvelope;

let beforeReadModelReaddirForTest: (() => MaybePromise<void>) | null = null;
let beforeReadModelPersistForTest: (() => MaybePromise<void>) | null = null;
let beforeReadModelReplaceForTest: (() => MaybePromise<void>) | null = null;
let afterReadModelReplaceReadForTest: (() => MaybePromise<void>) | null = null;
let beforeRecordingLookupForTest: (() => MaybePromise<void>) | null = null;
let beforeDuplicateRecordingCheckForTest: (() => MaybePromise<void>) | null = null;
let beforeMemoryIndexEntryReadForTest: (() => MaybePromise<void>) | null = null;

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
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('symlink') ||
    error.message.includes('escapes workspace') ||
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
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
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

async function hasFinalizeTransactionMarker(recordingDirectory: string): Promise<boolean> {
  try {
    const marker = await lstat(path.join(recordingDirectory, FINALIZE_TRANSACTION_MARKER));
    return marker.isFile() && !marker.isSymbolicLink();
  } catch {
    return false;
  }
}

async function unlinkFinalizeTransactionMarker(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<string> {
  const recordingDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
  const directoryIdentity = await readDirectoryIdentity(
    recordingDirectory,
    'Recording target path is not safe'
  );
  const previousCwd = process.cwd();
  try {
    process.chdir(recordingDirectory);
    assertSameCurrentDirectory(directoryIdentity);
    unlinkSync(FINALIZE_TRANSACTION_MARKER);
    assertSameCurrentDirectory(directoryIdentity);
    fsyncCurrentDirectoryBestEffort();
  } finally {
    process.chdir(previousCwd);
  }
  return recordingDirectory;
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

async function memoryDirectory(rootPath: string, memoryId: string): Promise<string> {
  if (!MEMORY_ID_PATTERN.test(memoryId)) {
    throw new Error('Invalid memory id');
  }
  return resolveSafeWorkspaceChild(rootPath, path.join(rootPath, 'memories', memoryId));
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
}: {
  readonly sourceParentDirectory: string;
  readonly sourceName: string;
  readonly targetParentDirectory: string;
  readonly targetName: string;
  readonly beforeCommit?: () => void;
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
    const sourceIdentity = readDirectoryIdentitySync(sourceName, 'Memory source path is not safe');
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

async function ensureMemoryTrashDirectory(
  rootPath: string,
  assertUsable?: AssertWorkspaceUsable
): Promise<string> {
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
    directoryName: 'memories',
    allowExisting: true,
    ...(assertUsable ? { beforeCommit: () => assertWorkspaceUsable(assertUsable) } : {}),
  });
  const memoryTrashDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, '.reo', 'trash', 'memories')
  );
  await assertSafeExistingDirectory(
    memoryTrashDirectory,
    'Workspace memory trash directory is not safe'
  );
  return memoryTrashDirectory;
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

async function ensureMemoryRecordingsDirectory(
  rootPath: string,
  memoryId: string,
  hooks?: FinalizeTransactionHooks
): Promise<string> {
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  await assertSafeExistingDirectory(memoriesDirectory, 'Workspace memories directory is not safe');

  const directory = await memoryDirectory(rootPath, memoryId);
  await hooks?.beforeMemoryDirectoryCreate?.();
  const currentDirectory = await memoryDirectory(rootPath, memoryId);
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
  createWorkspaceDirectoryWithinParent({
    parentDirectory: currentMemoriesDirectory,
    directoryName: memoryId,
    allowExisting: true,
  });
  const createdDirectory = await memoryDirectory(rootPath, memoryId);
  if (createdDirectory !== currentDirectory) {
    throw new Error('Workspace memory directory changed');
  }
  await assertSafeExistingDirectory(createdDirectory, 'Workspace memory directory is not safe');

  await hooks?.beforeSegmentsDirectoryCreate?.();
  const safeDirectory = await memoryDirectory(rootPath, memoryId);
  if (safeDirectory !== createdDirectory) {
    throw new Error('Workspace memory directory changed');
  }
  await assertSafeExistingDirectory(safeDirectory, 'Workspace memory directory is not safe');
  const segmentsDirectory = path.join(safeDirectory, 'segments');
  await hooks?.beforeSegmentsDirectoryMkdir?.();
  const currentSafeDirectory = await memoryDirectory(rootPath, memoryId);
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
    path.join(rootPath, 'memories', memoryId, 'segments')
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

export async function memorySegmentDirectory(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<string> {
  if (!SEGMENT_ID_PATTERN.test(segmentId)) {
    throw new Error('Invalid segment id');
  }
  return resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories', memoryId, 'segments', segmentId)
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
    path.join(rootPath, 'memories', memoryId, 'segments', segmentId, 'attachments')
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
    if (await exists(await memorySegmentDirectory(rootPath, entry.name, segmentId))) {
      return true;
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
    if (
      !entry.isDirectory() ||
      entry.name === ownerMemoryId ||
      !MEMORY_ID_PATTERN.test(entry.name)
    ) {
      continue;
    }
    const candidate = await memorySegmentDirectory(rootPath, entry.name, segmentId);
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
  const memory = memoryJsonSchema.parse(
    JSON.parse(await readWorkspaceTextFile(path.join(directory, 'memory.json')))
  );
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
  const recordingDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
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
  if (
    recording.segmentId !== segmentId ||
    recording.memoryId !== memoryId ||
    recording.audioByteLength !== audioByteLength
  ) {
    throw new Error('Finalized segment metadata does not match file truth');
  }

  return {
    segmentId,
    title: recording.title,
    durationMs: recording.durationMs,
    audioByteLength,
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

async function segmentAttachmentDirectory(
  rootPath: string,
  memoryId: string,
  segmentId: string,
  attachmentId: string
): Promise<string> {
  const attachmentsDirectory = await segmentAttachmentsDirectory(rootPath, memoryId, segmentId);
  const attachmentDirectory = path.join(attachmentsDirectory, attachmentId);
  const relative = path.relative(attachmentsDirectory, attachmentDirectory);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Segment attachment path escapes segment');
  }
  await assertSafeExistingDirectory(attachmentDirectory, 'Segment attachment path is not safe');
  return attachmentDirectory;
}

function readValidFinalizedAttachmentProjection({
  attachmentDirectory,
  attachmentDirectoryIdentity,
  workspaceId,
  memoryId,
  segmentId,
  attachmentId,
}: {
  readonly attachmentDirectory: string;
  readonly attachmentDirectoryIdentity: DirectoryIdentity;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly attachmentId: string;
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
      attachment.attachmentId !== attachmentId ||
      attachment.audioByteLength !== audioByteLength
    ) {
      return null;
    }
    return {
      workspaceId,
      memoryId,
      segmentId,
      attachmentId,
      type: 'audio',
      title: attachment.title,
      createdAt: attachment.createdAt,
      updatedAt: attachment.finalizedAt,
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

async function listValidSegmentAttachments({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
}): Promise<WorkspaceSegmentAttachmentProjection[]> {
  const attachmentsDirectory = await segmentAttachmentsDirectory(rootPath, memoryId, segmentId);
  let entries: Dirent[];
  try {
    entries = await readExistingDirectoryEntries(attachmentsDirectory);
  } catch {
    return [];
  }
  const attachments: WorkspaceSegmentAttachmentProjection[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const attachmentDirectory = await segmentAttachmentDirectory(
        rootPath,
        memoryId,
        segmentId,
        entry.name
      );
      const attachmentDirectoryIdentity = await readDirectoryIdentity(attachmentDirectory);
      const projection = readValidFinalizedAttachmentProjection({
        attachmentDirectory,
        attachmentDirectoryIdentity,
        workspaceId,
        memoryId,
        segmentId,
        attachmentId: entry.name,
      });
      if (projection) {
        attachments.push(projection);
      }
    } catch {
      continue;
    }
  }
  return attachments;
}

async function summarizeMemory(rootPath: string, memory: MemoryJson): Promise<MemorySummary> {
  let segmentCount = 0;
  let durationMs = 0;
  let audioByteLength = 0;
  let hasTranscript = false;
  let attachmentCount = 0;

  for (const segmentId of memory.segmentIds) {
    try {
      const recordingDirectory = await memorySegmentDirectory(rootPath, memory.memoryId, segmentId);
      const recording = await summarizeRecording(rootPath, memory.memoryId, segmentId);
      const recordingDirectoryIdentity = await readDirectoryIdentity(recordingDirectory);
      const recordingMetadata = await readFinalizedSegmentMetadata(
        recordingDirectory,
        recordingDirectoryIdentity
      );
      segmentCount += 1;
      durationMs += recording.durationMs;
      audioByteLength += recording.audioByteLength;
      hasTranscript =
        hasTranscript ||
        hasNonEmptyFileInKnownDirectory(
          recordingDirectory,
          recordingDirectoryIdentity,
          'transcript.md'
        );
      attachmentCount += (
        await listValidSegmentAttachments({
          rootPath,
          workspaceId: recordingMetadata.workspaceId,
          memoryId: memory.memoryId,
          segmentId,
        })
      ).length;
    } catch {
      continue;
    }
  }

  return {
    memoryId: memory.memoryId,
    title: memory.title,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    segmentCount,
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
    const recordingDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
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

    if (
      recording.workspaceId !== workspaceId ||
      recording.memoryId !== memoryId ||
      recording.segmentId !== segmentId ||
      recording.audioByteLength !== audioByteLength
    ) {
      return null;
    }

    const attachments = await listValidSegmentAttachments({
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
    });

    return {
      workspaceId,
      memoryId,
      segmentId,
      type: 'audio',
      title: recording.title,
      createdAt: recording.createdAt,
      updatedAt: recording.finalizedAt,
      durationMs: recording.durationMs,
      audioByteLength,
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
  } catch {
    return null;
  }
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
    assertWorkspaceUsable(input.assertWorkspaceUsable);
    const summary = await summarizeMemory(input.rootPath, memory);
    const segments: WorkspaceSegmentProjection[] = [];

    for (const segmentId of memory.segmentIds) {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const segment = await readValidFinalizedSegmentProjection({
        rootPath: input.rootPath,
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId,
      });
      if (segment) {
        segments.push(segment);
      }
    }

    assertWorkspaceUsable(input.assertWorkspaceUsable);
    return {
      ok: true,
      value: {
        ...summary,
        workspaceId: input.workspaceId,
        segments,
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
      memories.push(await summarizeMemory(rootPath, await readMemoryJson(rootPath, entry.name)));
    } catch {
      continue;
    }
  }
  await assertSameDirectoryPathAsync(memoriesDirectory, memoriesDirectoryIdentity);

  let sortedMemories = memories.sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt)
  );
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
    const memories = [
      summary,
      ...index.memories.filter((memory) => memory.memoryId !== memoryId),
    ].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
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

async function isValidFinalizedSegmentDirectory(
  recordingDirectory: string,
  memoryId: string,
  segmentId: string
): Promise<boolean> {
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
    return (
      recording.memoryId === memoryId &&
      recording.segmentId === segmentId &&
      recording.audioByteLength === audioByteLength
    );
  } catch {
    return false;
  }
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
    const memoryId = memoryEntry.name;
    let segmentsDirectory: string | null = null;
    let recordingEntries: Dirent[] = [];
    try {
      segmentsDirectory = await resolveSafeWorkspaceChild(
        rootPath,
        path.join(rootPath, 'memories', memoryId, 'segments')
      );
      recordingEntries = await readExistingDirectoryEntries(segmentsDirectory);
    } catch {
      // Unsafe segments paths are not followed during recovery.
    }
    let memory: MemoryJson | null = null;
    try {
      memory = await readMemoryJson(rootPath, memoryId);
    } catch {
      // Invalid memory metadata is ignored during transaction recovery.
    }
    const validSegmentIds = new Set<string>();
    let markerBearingRecordingFound = false;

    for (const recordingEntry of recordingEntries) {
      if (!segmentsDirectory) {
        continue;
      }
      const recordingDirectory = path.join(segmentsDirectory, recordingEntry.name);
      if (!recordingEntry.isDirectory()) {
        continue;
      }
      if (recordingEntry.name.startsWith(FINALIZE_STAGING_PREFIX)) {
        await beforeRecordingRecoveryRemove?.();
        await assertRecoveryWorkspaceUsable?.();
        const removed = await removeSafeWorkspaceDirectory(
          rootPath,
          path.join(rootPath, 'memories', memoryId, 'segments', recordingEntry.name)
        );
        if (removed) {
          await assertRecoveryWorkspaceUsable?.();
          await fsyncWorkspaceDirectory(segmentsDirectory).catch(() => {});
        }
        continue;
      }
      if (!(await hasFinalizeTransactionMarker(recordingDirectory))) {
        continue;
      }
      const validFinalizedSegment = await isValidFinalizedSegmentDirectory(
        recordingDirectory,
        memoryId,
        recordingEntry.name
      );
      if (!memory) {
        if (
          validFinalizedSegment ||
          (await exists(path.join(recordingDirectory, 'segment.json'))) ||
          (await exists(path.join(recordingDirectory, 'audio.webm')))
        ) {
          markerBearingRecordingFound = true;
          continue;
        }
        await beforeRecordingRecoveryRemove?.();
        await assertRecoveryWorkspaceUsable?.();
        await removeSafeWorkspaceDirectory(
          rootPath,
          path.join(rootPath, 'memories', memoryId, 'segments', recordingEntry.name)
        );
        continue;
      }
      const memoryReferencesRecording = memory.segmentIds.includes(recordingEntry.name);
      if (memoryReferencesRecording) {
        if (!validFinalizedSegment) {
          validSegmentIds.add(recordingEntry.name);
          continue;
        }
        validSegmentIds.add(recordingEntry.name);
        const draftDirectory = await draftSegmentDirectory(rootPath, recordingEntry.name);
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
          await unlinkFinalizeTransactionMarker(rootPath, memoryId, recordingEntry.name);
        } catch {
          continue;
        }
        continue;
      }
      await beforeRecordingRecoveryRemove?.();
      await assertRecoveryWorkspaceUsable?.();
      await removeSafeWorkspaceDirectory(
        rootPath,
        path.join(rootPath, 'memories', memoryId, 'segments', recordingEntry.name)
      );
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
    for (const segmentId of memory.segmentIds) {
      if (!segmentsDirectory) {
        continue;
      }
      const recordingDirectory = path.join(segmentsDirectory, segmentId);
      if (await isValidFinalizedSegmentDirectory(recordingDirectory, memoryId, segmentId)) {
        validSegmentIds.add(segmentId);
      }
    }
    const repairedSegmentIds = memory.segmentIds.filter((segmentId) =>
      validSegmentIds.has(segmentId)
    );
    if (repairedSegmentIds.length !== memory.segmentIds.length) {
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

async function stagingSegmentDirectory(
  rootPath: string,
  memoryId: string,
  segmentId: string,
  stagingName: string
): Promise<string> {
  const targetRecordingDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
  const stagingDirectory = path.join(path.dirname(targetRecordingDirectory), stagingName);
  await assertSafeExistingDirectory(stagingDirectory, 'Recording staging path is not safe');
  return stagingDirectory;
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
  await assertWorkspaceUsable?.();
  await removeSafeWorkspaceDirectory(rootPath, directory).catch(() => {});
}

async function cleanupPreExposeFinalizeArtifacts({
  rootPath,
  memoryId,
  segmentId,
  memoryDirectoryPath,
  hooks,
}: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly memoryDirectoryPath: string;
  readonly hooks?: FinalizeTransactionHooks;
}): Promise<void> {
  const segmentsDirectory = await resolveSafeCleanupDirectory(
    rootPath,
    path.join(rootPath, 'memories', memoryId, 'segments')
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
  hooks,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly hooks?: FinalizeTransactionHooks;
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<{
  readonly stagingSegmentDirectory: string;
  readonly targetRecordingDirectory: string;
}> {
  const targetDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
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
    const segmentsDirectory = await ensureMemoryRecordingsDirectory(rootPath, memoryId, hooks);
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
    const markerStagingDirectory = await stagingSegmentDirectory(
      rootPath,
      memoryId,
      segmentId,
      stagingName
    );
    assertWorkspaceUsable(assertUsable);
    await writeFinalizeTransactionMarker({
      targetRecordingDirectory: markerStagingDirectory,
      memoryId,
      segmentId,
    });
    await hooks?.afterMarkerWrite?.();
    assertWorkspaceUsable(assertUsable);
    await draftSegmentDirectory(rootPath, segmentId);
    await fsyncWorkspaceDirectory(
      await stagingSegmentDirectory(rootPath, memoryId, segmentId, stagingName)
    );
    await hooks?.beforeDraftCopy?.();
    assertWorkspaceUsable(assertUsable);
    const copyStagingDirectory = await stagingSegmentDirectory(
      rootPath,
      memoryId,
      segmentId,
      stagingName
    );
    await copyDirectoryContents(
      await draftSegmentDirectory(rootPath, segmentId),
      copyStagingDirectory
    );
    await hooks?.afterCopy?.();
    assertWorkspaceUsable(assertUsable);
    const finalStagingDirectory = await stagingSegmentDirectory(
      rootPath,
      memoryId,
      segmentId,
      stagingName
    );
    await fsyncDirectoryTree(finalStagingDirectory);
    return {
      stagingSegmentDirectory: finalStagingDirectory,
      targetRecordingDirectory: await memorySegmentDirectory(rootPath, memoryId, segmentId),
    };
  } catch (error) {
    if (error instanceof WorkspaceHandleLost) {
      throw error;
    }
    await cleanupPreExposeFinalizeArtifacts({
      rootPath,
      memoryId,
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
  const directory = await memoryDirectory(rootPath, memoryId);
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
    const currentTargetRecordingDirectory = await memorySegmentDirectory(
      rootPath,
      memoryId,
      segmentId
    );
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
    const finalTargetRecordingDirectory = await memorySegmentDirectory(
      rootPath,
      memoryId,
      segmentId
    );
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
    const currentMemoryDirectory = await memoryDirectory(rootPath, memoryId);
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
      if (await exists(await memoryDirectory(input.rootPath, input.memoryId))) {
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
      createWorkspaceDirectoryWithinParent({
        parentDirectory: memoriesDirectory,
        directoryName: input.memoryId,
        ...(input.assertWorkspaceUsable
          ? { beforeCommit: () => assertWorkspaceUsable(input.assertWorkspaceUsable) }
          : {}),
      });
      createdDirectory = await memoryDirectory(input.rootPath, input.memoryId);
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

async function moveMemoryDirectory({
  memoryId,
  sourceParentDirectory,
  targetParentDirectory,
  assertWorkspaceUsable: assertUsable,
}: {
  readonly memoryId: string;
  readonly sourceParentDirectory: string;
  readonly targetParentDirectory: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<void> {
  if (!MEMORY_ID_PATTERN.test(memoryId)) {
    throw new Error('Invalid memory id');
  }
  const safeSourceParent = sourceParentDirectory;
  const safeTargetParent = targetParentDirectory;
  await assertSafeExistingDirectory(safeSourceParent, 'Workspace memory source parent is not safe');
  await assertSafeExistingDirectory(safeTargetParent, 'Workspace memory target parent is not safe');
  assertWorkspaceUsable(assertUsable);
  renameWorkspaceDirectoryAcrossParents({
    sourceParentDirectory: safeSourceParent,
    sourceName: memoryId,
    targetParentDirectory: safeTargetParent,
    targetName: memoryId,
    ...(assertUsable ? { beforeCommit: () => assertWorkspaceUsable(assertUsable) } : {}),
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
      await moveMemoryDirectory({
        memoryId: input.memoryId,
        sourceParentDirectory: memoriesDirectory,
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
        await moveMemoryDirectory({
          memoryId: input.memoryId,
          sourceParentDirectory: trashDirectory,
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
      await moveMemoryDirectory({
        memoryId,
        sourceParentDirectory: trashDirectory,
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
        await moveMemoryDirectory({
          memoryId,
          sourceParentDirectory: memoriesDirectory,
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
      if (!current.segmentIds.includes(input.segmentId)) {
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
      const nextMemory = { ...current, updatedAt };
      const attachmentsDirectory = await ensureSegmentAttachmentsDirectory({
        rootPath: input.rootPath,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
      });
      const targetAttachmentDirectory = path.join(attachmentsDirectory, input.attachmentId);
      const relativeTarget = path.relative(attachmentsDirectory, targetAttachmentDirectory);
      if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
        throw new Error('Segment attachment target escapes parent');
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
        targetName: input.attachmentId,
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
        attachmentId: input.attachmentId,
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
      const next = { ...current, title: input.title, updatedAt: input.now() };
      const directory = await memoryDirectory(input.rootPath, input.memoryId);
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      await writeWorkspaceJsonAtomic(path.join(directory, 'memory.json'), next);
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
    const candidate = await memorySegmentDirectory(rootPath, memoryEntry.name, segmentId);
    try {
      const metadata = await lstat(candidate);
      const recording = metadata.isDirectory()
        ? await summarizeValidFinalizedSegmentDirectory(rootPath, memoryEntry.name, segmentId)
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

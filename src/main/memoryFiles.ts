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
  draftRecordingMetadataSchema,
  finalizedRecordingMetadataSchema,
  MEMORY_ID_PATTERN,
  RECORDING_ID_PATTERN,
  type FinalizedRecordingMetadata,
} from './recordingMetadata.js';
import {
  assertSameCurrentDirectoryIdentity as assertSameCurrentDirectory,
  assertSameDirectoryIdentity as assertSameDirectoryPathAsync,
  assertSameDirectoryIdentitySync as assertSameDirectoryPath,
  readSafeDirectoryIdentity as readDirectoryIdentity,
  readSafeDirectoryIdentitySync as readDirectoryIdentitySync,
  type DirectoryIdentity,
} from './directoryIdentity.js';
import { getWorkspaceIndexPath } from './workspacePaths.js';
import {
  workspaceError,
  workspaceMemorySummarySchema,
  type WorkspaceError,
  type WorkspaceErrorEnvelope,
} from './workspaceContract.js';

const FINALIZE_STAGING_PREFIX = '.reo-finalizing-';
const FINALIZE_TRANSACTION_MARKER = '.reo-finalize-transaction.json';
const MAX_WORKSPACE_JSON_BYTES = 1_048_576;
const MEMORY_DETAIL_RECORDING_LIMIT = 24;
const DRAFT_RECORDING_FILES = new Set([
  'audio.webm',
  'recording.json',
  'transcript.md',
  'reflections.md',
]);
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
  readonly sourceKind: 'recording';
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly recordingIds: readonly string[];
}

export interface MemorySummary {
  readonly memoryId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly recordingCount: number;
  readonly durationMs: number;
  readonly audioByteLength: number;
  readonly hasTranscript: boolean;
  readonly hasReflections: boolean;
}

export interface MemoryRecordingSummary {
  readonly recordingId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly audioByteLength: number;
}

export type MemoryDetail = MemoryJson & {
  readonly recordingCount: number;
  readonly recordingsTruncated: boolean;
  readonly hasTranscript: boolean;
  readonly hasReflections: boolean;
  readonly recordings: readonly MemoryRecordingSummary[];
};

export type RecordingDirectoryLookup =
  | {
      readonly status: 'found';
      readonly directory: string;
      readonly recording: MemoryRecordingSummary;
    }
  | { readonly status: 'not-found' }
  | { readonly status: 'invalid-id' }
  | { readonly status: 'duplicate' }
  | { readonly status: 'invalid-durable' };

export interface FinalizeTransactionHooksForTest {
  readonly beforeParentDirectoryCreate?: () => MaybePromise<void>;
  readonly beforeMemoryDirectoryCreate?: () => MaybePromise<void>;
  readonly beforeMemoryDirectoryMkdir?: () => MaybePromise<void>;
  readonly beforeRecordingsDirectoryCreate?: () => MaybePromise<void>;
  readonly beforeRecordingsDirectoryMkdir?: () => MaybePromise<void>;
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

export interface CreateMemoryForRecordingInput {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly recordingId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly now: () => string;
  readonly rebuildIndex?: (rootPath: string) => Promise<readonly MemorySummary[]>;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

export type AppendRecordingToMemoryInput = CreateMemoryForRecordingInput;

export type CreateMemoryForRecordingForTestInput = CreateMemoryForRecordingInput & {
  readonly transactionHooks?: FinalizeTransactionHooksForTest;
};

export type AppendRecordingToMemoryForTestInput = AppendRecordingToMemoryInput & {
  readonly transactionHooks?: FinalizeTransactionHooksForTest;
};

export interface ReadMemoryDetailInput {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

export interface UpdateMemoryTitleInput extends ReadMemoryDetailInput {
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

const memoryJsonSchema = z
  .object({
    memoryId: z.string().regex(MEMORY_ID_PATTERN),
    title: z.string(),
    sourceKind: z.literal('recording'),
    createdAt: z.string(),
    updatedAt: z.string(),
    recordingIds: z.array(z.string().regex(RECORDING_ID_PATTERN)),
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
  recordingId: string
): Promise<string> {
  const recordingDirectory = await memoryRecordingDirectory(rootPath, memoryId, recordingId);
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

function createWorkspaceDirectoryWithinParent({
  parentDirectory,
  directoryName,
  allowExisting = false,
}: {
  readonly parentDirectory: string;
  readonly directoryName: string;
  readonly allowExisting?: boolean;
}): void {
  const parentIdentity = readDirectoryIdentitySync(parentDirectory);
  const previousCwd = process.cwd();
  let directoryCreated = false;
  try {
    process.chdir(parentDirectory);
    assertSameCurrentDirectory(parentIdentity);
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

  await hooks?.beforeRecordingsDirectoryCreate?.();
  const safeDirectory = await memoryDirectory(rootPath, memoryId);
  if (safeDirectory !== createdDirectory) {
    throw new Error('Workspace memory directory changed');
  }
  await assertSafeExistingDirectory(safeDirectory, 'Workspace memory directory is not safe');
  const recordingsDirectory = path.join(safeDirectory, 'recordings');
  await hooks?.beforeRecordingsDirectoryMkdir?.();
  const currentSafeDirectory = await memoryDirectory(rootPath, memoryId);
  if (currentSafeDirectory !== safeDirectory) {
    throw new Error('Workspace memory directory changed');
  }
  await assertSafeExistingDirectory(currentSafeDirectory, 'Workspace memory directory is not safe');
  createWorkspaceDirectoryWithinParent({
    parentDirectory: currentSafeDirectory,
    directoryName: 'recordings',
    allowExisting: true,
  });
  const safeRecordingsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories', memoryId, 'recordings')
  );
  if (safeRecordingsDirectory !== recordingsDirectory) {
    throw new Error('Workspace memory recordings directory changed');
  }
  await assertSafeExistingDirectory(
    safeRecordingsDirectory,
    'Workspace memory recordings directory is not safe'
  );
  return safeRecordingsDirectory;
}

async function draftRecordingDirectory(rootPath: string, recordingId: string): Promise<string> {
  if (!RECORDING_ID_PATTERN.test(recordingId)) {
    throw new Error('Invalid recording id');
  }
  return resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId)
  );
}

export async function memoryRecordingDirectory(
  rootPath: string,
  memoryId: string,
  recordingId: string
): Promise<string> {
  if (!RECORDING_ID_PATTERN.test(recordingId)) {
    throw new Error('Invalid recording id');
  }
  return resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories', memoryId, 'recordings', recordingId)
  );
}

async function recordingDirectoryExistsInAnyMemory(
  rootPath: string,
  recordingId: string
): Promise<boolean> {
  if (!RECORDING_ID_PATTERN.test(recordingId)) {
    throw new Error('Invalid recording id');
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
    if (await exists(await memoryRecordingDirectory(rootPath, entry.name, recordingId))) {
      return true;
    }
  }
  return false;
}

export async function assertNoDuplicateRecordingDirectoryById(
  rootPath: string,
  ownerMemoryId: string,
  recordingId: string
): Promise<void> {
  if (!MEMORY_ID_PATTERN.test(ownerMemoryId) || !RECORDING_ID_PATTERN.test(recordingId)) {
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
    const candidate = await memoryRecordingDirectory(rootPath, entry.name, recordingId);
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
      throw new Error('Duplicate finalized recording id');
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
  recordingId: string
): Promise<MemoryRecordingSummary> {
  const recordingDirectory = await memoryRecordingDirectory(rootPath, memoryId, recordingId);
  const recordingDirectoryIdentity = await readDirectoryIdentity(recordingDirectory);
  const recording = await readFinalizedRecordingMetadata(
    recordingDirectory,
    recordingDirectoryIdentity
  );
  const audioByteLength = readFileSizeInKnownDirectory(
    recordingDirectory,
    recordingDirectoryIdentity,
    'audio.webm'
  );
  if (
    recording.recordingId !== recordingId ||
    recording.memoryId !== memoryId ||
    recording.audioByteLength !== audioByteLength
  ) {
    throw new Error('Finalized recording metadata does not match file truth');
  }

  return {
    recordingId,
    title: recording.title,
    durationMs: recording.durationMs,
    audioByteLength,
  };
}

async function summarizeValidFinalizedRecordingDirectory(
  rootPath: string,
  memoryId: string,
  recordingId: string
): Promise<MemoryRecordingSummary | null> {
  try {
    return await summarizeRecording(rootPath, memoryId, recordingId);
  } catch {
    return null;
  }
}

async function readFinalizedRecordingMetadata(
  recordingDirectory: string,
  recordingDirectoryIdentity?: DirectoryIdentity
): Promise<FinalizedRecordingMetadata> {
  const directoryIdentity =
    recordingDirectoryIdentity ?? (await readDirectoryIdentity(recordingDirectory));
  return finalizedRecordingMetadataSchema.parse(
    JSON.parse(
      readWorkspaceTextFileInKnownDirectory(recordingDirectory, directoryIdentity, 'recording.json')
    )
  );
}

async function summarizeMemory(rootPath: string, memory: MemoryJson): Promise<MemorySummary> {
  let recordingCount = 0;
  let durationMs = 0;
  let audioByteLength = 0;
  let hasTranscript = false;
  let hasReflections = false;

  for (const recordingId of memory.recordingIds) {
    try {
      const recordingDirectory = await memoryRecordingDirectory(
        rootPath,
        memory.memoryId,
        recordingId
      );
      const recording = await summarizeRecording(rootPath, memory.memoryId, recordingId);
      const recordingDirectoryIdentity = await readDirectoryIdentity(recordingDirectory);
      recordingCount += 1;
      durationMs += recording.durationMs;
      audioByteLength += recording.audioByteLength;
      hasTranscript =
        hasTranscript ||
        hasNonEmptyFileInKnownDirectory(
          recordingDirectory,
          recordingDirectoryIdentity,
          'transcript.md'
        );
      hasReflections =
        hasReflections ||
        hasNonEmptyFileInKnownDirectory(
          recordingDirectory,
          recordingDirectoryIdentity,
          'reflections.md'
        );
    } catch {
      continue;
    }
  }

  return {
    memoryId: memory.memoryId,
    title: memory.title,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    recordingCount,
    durationMs,
    audioByteLength,
    hasTranscript,
    hasReflections,
  };
}

async function readMemorySummaryFromIndex(
  rootPath: string,
  memoryId: string
): Promise<MemorySummary | null> {
  const index = workspaceIndexSchema.parse(
    JSON.parse(await readWorkspaceTextFile(getWorkspaceIndexPath(rootPath)))
  );
  return index.memories.find((memory) => memory.memoryId === memoryId) ?? null;
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

export async function readFinalizedRecordingSummary(
  rootPath: string,
  memoryId: string,
  recordingId: string
): Promise<MemoryRecordingSummary> {
  return summarizeRecording(rootPath, memoryId, recordingId);
}

async function isValidFinalizedRecordingDirectory(
  recordingDirectory: string,
  memoryId: string,
  recordingId: string
): Promise<boolean> {
  try {
    await assertSafeExistingDirectory(recordingDirectory, 'Recording directory is not safe');
    const recordingDirectoryIdentity = await readDirectoryIdentity(recordingDirectory);
    const recording = await readFinalizedRecordingMetadata(
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
      recording.recordingId === recordingId &&
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
    let recordingsDirectory: string | null = null;
    let recordingEntries: Dirent[] = [];
    try {
      recordingsDirectory = await resolveSafeWorkspaceChild(
        rootPath,
        path.join(rootPath, 'memories', memoryId, 'recordings')
      );
      recordingEntries = await readExistingDirectoryEntries(recordingsDirectory);
    } catch {
      // Unsafe recordings paths are not followed during recovery.
    }
    let memory: MemoryJson | null = null;
    try {
      memory = await readMemoryJson(rootPath, memoryId);
    } catch {
      // Invalid memory metadata is ignored during transaction recovery.
    }
    const validRecordingIds = new Set<string>();
    let markerBearingRecordingFound = false;

    for (const recordingEntry of recordingEntries) {
      if (!recordingsDirectory) {
        continue;
      }
      const recordingDirectory = path.join(recordingsDirectory, recordingEntry.name);
      if (!recordingEntry.isDirectory()) {
        continue;
      }
      if (recordingEntry.name.startsWith(FINALIZE_STAGING_PREFIX)) {
        await beforeRecordingRecoveryRemove?.();
        await assertRecoveryWorkspaceUsable?.();
        const removed = await removeSafeWorkspaceDirectory(
          rootPath,
          path.join(rootPath, 'memories', memoryId, 'recordings', recordingEntry.name)
        );
        if (removed) {
          await assertRecoveryWorkspaceUsable?.();
          await fsyncWorkspaceDirectory(recordingsDirectory).catch(() => {});
        }
        continue;
      }
      if (!(await hasFinalizeTransactionMarker(recordingDirectory))) {
        continue;
      }
      const validFinalizedRecording = await isValidFinalizedRecordingDirectory(
        recordingDirectory,
        memoryId,
        recordingEntry.name
      );
      if (!memory) {
        if (
          validFinalizedRecording ||
          (await exists(path.join(recordingDirectory, 'recording.json'))) ||
          (await exists(path.join(recordingDirectory, 'audio.webm')))
        ) {
          markerBearingRecordingFound = true;
          continue;
        }
        await beforeRecordingRecoveryRemove?.();
        await assertRecoveryWorkspaceUsable?.();
        await removeSafeWorkspaceDirectory(
          rootPath,
          path.join(rootPath, 'memories', memoryId, 'recordings', recordingEntry.name)
        );
        continue;
      }
      const memoryReferencesRecording = memory.recordingIds.includes(recordingEntry.name);
      if (memoryReferencesRecording) {
        if (!validFinalizedRecording) {
          validRecordingIds.add(recordingEntry.name);
          continue;
        }
        validRecordingIds.add(recordingEntry.name);
        const draftDirectory = await draftRecordingDirectory(rootPath, recordingEntry.name);
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
          await fsyncWorkspaceDirectory(path.join(rootPath, '.reo', 'drafts', 'recordings'));
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
        path.join(rootPath, 'memories', memoryId, 'recordings', recordingEntry.name)
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
    for (const recordingId of memory.recordingIds) {
      if (!recordingsDirectory) {
        continue;
      }
      const recordingDirectory = path.join(recordingsDirectory, recordingId);
      if (await isValidFinalizedRecordingDirectory(recordingDirectory, memoryId, recordingId)) {
        validRecordingIds.add(recordingId);
      }
    }
    const repairedRecordingIds = memory.recordingIds.filter((recordingId) =>
      validRecordingIds.has(recordingId)
    );
    if (repairedRecordingIds.length !== memory.recordingIds.length) {
      try {
        await assertRecoveryWorkspaceUsable?.();
        const currentMemoryDirectory = await memoryDirectory(rootPath, memoryId);
        await writeWorkspaceJsonAtomic(path.join(currentMemoryDirectory, 'memory.json'), {
          ...memory,
          recordingIds: repairedRecordingIds,
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
  recordingId,
}: {
  readonly targetRecordingDirectory: string;
  readonly memoryId: string;
  readonly recordingId: string;
}): Promise<void> {
  await writeWorkspaceJsonAtomic(path.join(targetRecordingDirectory, FINALIZE_TRANSACTION_MARKER), {
    schemaVersion: 1,
    memoryId,
    recordingId,
    draftPath: `.reo/drafts/recordings/${recordingId}`,
  });
}

async function stagingRecordingDirectory(
  rootPath: string,
  memoryId: string,
  recordingId: string,
  stagingName: string
): Promise<string> {
  const targetRecordingDirectory = await memoryRecordingDirectory(rootPath, memoryId, recordingId);
  const stagingDirectory = path.join(path.dirname(targetRecordingDirectory), stagingName);
  await assertSafeExistingDirectory(stagingDirectory, 'Recording staging path is not safe');
  return stagingDirectory;
}

async function copyDirectoryContents(
  sourceDirectory: string,
  targetDirectory: string
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
    if (!entry.isFile() || entry.isSymbolicLink() || !DRAFT_RECORDING_FILES.has(entry.name)) {
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

async function removeDraftRecordingDirectorySafely(
  rootPath: string,
  recordingId: string,
  hooks?: FinalizeTransactionHooks
): Promise<void> {
  const draftDirectory = await draftRecordingDirectory(rootPath, recordingId);
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
  if (entries.length !== 1 || entries[0] !== 'recordings') {
    return;
  }
  await assertWorkspaceUsable?.();
  await removeSafeWorkspaceDirectory(rootPath, directory).catch(() => {});
}

async function cleanupPreExposeFinalizeArtifacts({
  rootPath,
  memoryId,
  recordingId,
  memoryDirectoryPath,
  hooks,
}: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly recordingId: string;
  readonly memoryDirectoryPath: string;
  readonly hooks?: FinalizeTransactionHooks;
}): Promise<void> {
  const recordingsDirectory = await resolveSafeCleanupDirectory(
    rootPath,
    path.join(rootPath, 'memories', memoryId, 'recordings')
  );
  if (recordingsDirectory) {
    const stagingPrefix = `${FINALIZE_STAGING_PREFIX}${recordingId}.`;
    for (const entry of await readdir(recordingsDirectory, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith(stagingPrefix)) {
        await removeSafeWorkspaceDirectory(
          rootPath,
          path.join(recordingsDirectory, entry.name),
          hooks
        );
      }
    }
    await fsyncWorkspaceDirectory(recordingsDirectory).catch(() => {});
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
  recordingId,
  hooks,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly recordingId: string;
  readonly hooks?: FinalizeTransactionHooks;
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<{
  readonly stagingRecordingDirectory: string;
  readonly targetRecordingDirectory: string;
}> {
  const targetDirectory = await memoryRecordingDirectory(rootPath, memoryId, recordingId);
  const parentDirectory = path.dirname(targetDirectory);
  const memoryDirectoryPath = path.dirname(parentDirectory);
  const stagingDirectory = path.join(
    parentDirectory,
    `${FINALIZE_STAGING_PREFIX}${recordingId}.${process.pid}.${Date.now()}`
  );
  const stagingName = path.basename(stagingDirectory);
  try {
    assertWorkspaceUsable(assertUsable);
    if (await recordingDirectoryExistsInAnyMemory(rootPath, recordingId)) {
      throw new Error('Recording target already exists');
    }
    await hooks?.beforeParentDirectoryCreate?.();
    assertWorkspaceUsable(assertUsable);
    const recordingsDirectory = await ensureMemoryRecordingsDirectory(rootPath, memoryId, hooks);
    if (recordingsDirectory !== parentDirectory) {
      throw new Error('Recording target parent changed');
    }
    await fsyncWorkspaceDirectory(path.dirname(path.dirname(parentDirectory))).catch(() => {});
    await fsyncWorkspaceDirectory(path.dirname(parentDirectory)).catch(() => {});
    await fsyncWorkspaceDirectory(parentDirectory).catch(() => {});
    await assertSafeExistingDirectory(
      parentDirectory,
      'Workspace memory recordings directory is not safe'
    );
    await hooks?.beforeStagingDirectoryCreate?.();
    assertWorkspaceUsable(assertUsable);
    createWorkspaceDirectoryWithinParent({
      parentDirectory,
      directoryName: stagingName,
    });
    await hooks?.afterStagingDirectoryCreate?.();
    const markerStagingDirectory = await stagingRecordingDirectory(
      rootPath,
      memoryId,
      recordingId,
      stagingName
    );
    assertWorkspaceUsable(assertUsable);
    await writeFinalizeTransactionMarker({
      targetRecordingDirectory: markerStagingDirectory,
      memoryId,
      recordingId,
    });
    await hooks?.afterMarkerWrite?.();
    assertWorkspaceUsable(assertUsable);
    await draftRecordingDirectory(rootPath, recordingId);
    await fsyncWorkspaceDirectory(
      await stagingRecordingDirectory(rootPath, memoryId, recordingId, stagingName)
    );
    await hooks?.beforeDraftCopy?.();
    assertWorkspaceUsable(assertUsable);
    const copyStagingDirectory = await stagingRecordingDirectory(
      rootPath,
      memoryId,
      recordingId,
      stagingName
    );
    await copyDirectoryContents(
      await draftRecordingDirectory(rootPath, recordingId),
      copyStagingDirectory
    );
    await hooks?.afterCopy?.();
    assertWorkspaceUsable(assertUsable);
    const finalStagingDirectory = await stagingRecordingDirectory(
      rootPath,
      memoryId,
      recordingId,
      stagingName
    );
    await fsyncDirectoryTree(finalStagingDirectory);
    return {
      stagingRecordingDirectory: finalStagingDirectory,
      targetRecordingDirectory: await memoryRecordingDirectory(rootPath, memoryId, recordingId),
    };
  } catch (error) {
    if (error instanceof WorkspaceHandleLost) {
      throw error;
    }
    await cleanupPreExposeFinalizeArtifacts({
      rootPath,
      memoryId,
      recordingId,
      memoryDirectoryPath,
      ...(hooks ? { hooks } : {}),
    });
    throw error;
  }
}

async function writeFinalizedRecordingFiles({
  targetRecordingDirectory,
  workspaceId,
  memoryId,
  recordingId,
  title,
  durationMs,
  finalizedAt,
}: {
  readonly targetRecordingDirectory: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly recordingId: string;
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
  const draftMetadata = draftRecordingMetadataSchema.parse(
    JSON.parse(
      readWorkspaceTextFileInKnownDirectory(
        targetRecordingDirectory,
        targetIdentity,
        'recording.json'
      )
    )
  );
  if (
    draftMetadata.workspaceId !== workspaceId ||
    draftMetadata.recordingId !== recordingId ||
    draftMetadata.audioByteLength !== audio.size
  ) {
    throw new Error('Draft recording metadata does not match file truth');
  }
  await writeWorkspaceJsonAtomicInKnownDirectory({
    directory: targetRecordingDirectory,
    directoryIdentity: targetIdentity,
    fileName: 'recording.json',
    value: {
      schemaVersion: 1,
      workspaceId,
      memoryId,
      recordingId,
      status: 'finalized',
      title,
      createdAt: draftMetadata.createdAt,
      finalizedAt,
      durationMs,
      nextSequence: draftMetadata.nextSequence,
      audioByteLength: audio.size,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    },
  });
  await ensureMarkdownFileInDirectory(targetRecordingDirectory, targetIdentity, 'transcript.md');
  await ensureMarkdownFileInDirectory(targetRecordingDirectory, targetIdentity, 'reflections.md');
  return audio.size;
}

async function ensureMarkdownFileInDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: 'transcript.md' | 'reflections.md'
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
  stagingRecordingDirectory,
  targetRecordingDirectory,
  memoryId,
  nextMemory,
  previousMemory,
  recordingId,
  workspaceId,
  title,
  durationMs,
  finalizedAt,
  rebuildIndex,
  hooks,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly stagingRecordingDirectory: string;
  readonly targetRecordingDirectory: string;
  readonly memoryId: string;
  readonly nextMemory: MemoryJson;
  readonly previousMemory: MemoryJson | null;
  readonly recordingId: string;
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
    await writeFinalizedRecordingFiles({
      targetRecordingDirectory: stagingRecordingDirectory,
      workspaceId,
      memoryId,
      recordingId,
      title,
      durationMs,
      finalizedAt,
    });
    await fsyncDirectoryTree(stagingRecordingDirectory);
    await hooks?.afterStagingTreeFsync?.();
    assertWorkspaceUsable(assertUsable);
    await hooks?.beforeExpose?.();
    const currentTargetRecordingDirectory = await memoryRecordingDirectory(
      rootPath,
      memoryId,
      recordingId
    );
    const currentStagingRecordingDirectory = path.join(
      path.dirname(currentTargetRecordingDirectory),
      path.basename(stagingRecordingDirectory)
    );
    await assertSafeExistingDirectory(
      currentStagingRecordingDirectory,
      'Recording staging path is not safe'
    );
    await hooks?.beforeFinalRename?.();
    assertWorkspaceUsable(assertUsable);
    const finalTargetRecordingDirectory = await memoryRecordingDirectory(
      rootPath,
      memoryId,
      recordingId
    );
    const finalStagingRecordingDirectory = path.join(
      path.dirname(finalTargetRecordingDirectory),
      path.basename(stagingRecordingDirectory)
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
    await removeDraftRecordingDirectorySafely(rootPath, recordingId, hooks);
    rollbackDurableRecording = false;
    rollbackMemory = false;
    await hooks?.afterDraftCleanup?.();
    assertWorkspaceUsable(assertUsable);
    await fsyncWorkspaceDirectory(path.join(rootPath, '.reo', 'drafts', 'recordings'));
    assertWorkspaceUsable(assertUsable);
    await unlinkFinalizeTransactionMarker(rootPath, memoryId, recordingId);
    return summarizeMemory(rootPath, nextMemory);
  } catch (error) {
    if (error instanceof WorkspaceHandleLost) {
      throw error;
    }
    await removeSafeWorkspaceDirectory(rootPath, stagingRecordingDirectory, hooks).catch(() => {});
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

async function createMemoryForRecordingWithHooks(
  input: CreateMemoryForRecordingInput,
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
        sourceKind: 'recording',
        createdAt,
        updatedAt: createdAt,
        recordingIds: [input.recordingId],
      };
      const { stagingRecordingDirectory, targetRecordingDirectory } =
        await copyDraftRecordingIntoMemory({
          rootPath: input.rootPath,
          memoryId: input.memoryId,
          recordingId: input.recordingId,
          ...(transactionHooks ? { hooks: transactionHooks } : {}),
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
      const summary = await finishFinalizeTransaction({
        rootPath: input.rootPath,
        stagingRecordingDirectory,
        targetRecordingDirectory,
        memoryId: input.memoryId,
        nextMemory: memory,
        previousMemory: null,
        recordingId: input.recordingId,
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

export async function createMemoryForRecording(
  input: CreateMemoryForRecordingInput
): Promise<MemoryFilesResult<MemorySummary>> {
  return createMemoryForRecordingWithHooks(input);
}

export async function createMemoryForRecordingForTest(
  input: CreateMemoryForRecordingForTestInput
): Promise<MemoryFilesResult<MemorySummary>> {
  const { transactionHooks, ...productionInput } = input;
  return createMemoryForRecordingWithHooks(productionInput, transactionHooks);
}

async function appendRecordingToMemoryWithHooks(
  input: AppendRecordingToMemoryInput,
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
        recordingIds: [
          ...current.recordingIds.filter((recordingId) => recordingId !== input.recordingId),
          input.recordingId,
        ],
      };
      const { stagingRecordingDirectory, targetRecordingDirectory } =
        await copyDraftRecordingIntoMemory({
          rootPath: input.rootPath,
          memoryId: input.memoryId,
          recordingId: input.recordingId,
          ...(transactionHooks ? { hooks: transactionHooks } : {}),
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
      const summary = await finishFinalizeTransaction({
        rootPath: input.rootPath,
        stagingRecordingDirectory,
        targetRecordingDirectory,
        memoryId: input.memoryId,
        nextMemory: next,
        previousMemory: current,
        recordingId: input.recordingId,
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

export async function appendRecordingToMemory(
  input: AppendRecordingToMemoryInput
): Promise<MemoryFilesResult<MemorySummary>> {
  return appendRecordingToMemoryWithHooks(input);
}

export async function appendRecordingToMemoryForTest(
  input: AppendRecordingToMemoryForTestInput
): Promise<MemoryFilesResult<MemorySummary>> {
  const { transactionHooks, ...productionInput } = input;
  return appendRecordingToMemoryWithHooks(productionInput, transactionHooks);
}

export async function readMemoryDetail(
  input: ReadMemoryDetailInput
): Promise<MemoryFilesResult<MemoryDetail>> {
  try {
    assertWorkspaceUsable(input.assertWorkspaceUsable);
    const memory = await readMemoryJson(input.rootPath, input.memoryId);
    const summary = await readMemorySummaryFromIndex(input.rootPath, memory.memoryId);
    assertWorkspaceUsable(input.assertWorkspaceUsable);
    const recordings: MemoryRecordingSummary[] = [];
    for (const recordingId of memory.recordingIds.slice(0, MEMORY_DETAIL_RECORDING_LIMIT)) {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const recording = await summarizeRecording(input.rootPath, memory.memoryId, recordingId);
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      recordings.push(recording);
    }
    assertWorkspaceUsable(input.assertWorkspaceUsable);
    return {
      ok: true,
      value: {
        ...memory,
        recordingCount: summary?.recordingCount ?? memory.recordingIds.length,
        recordingsTruncated: memory.recordingIds.length > MEMORY_DETAIL_RECORDING_LIMIT,
        hasTranscript: summary?.hasTranscript ?? false,
        hasReflections: summary?.hasReflections ?? false,
        recordings,
      },
    };
  } catch (error) {
    return memoryFilesError(error, 'ERR_MEMORY_NOT_FOUND', 'Memory not found', 'none-written');
  }
}

export async function updateMemoryTitleFromFileTruth(
  input: UpdateMemoryTitleInput
): Promise<MemoryFilesResult<MemorySummary>> {
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      const current = await readMemoryJson(input.rootPath, input.memoryId);
      const next = { ...current, title: input.title, updatedAt: input.now() };
      const directory = await memoryDirectory(input.rootPath, input.memoryId);
      await writeWorkspaceJsonAtomic(path.join(directory, 'memory.json'), next);
      await rebuildMemoryIndex(input.rootPath).catch(() => {});
      return { ok: true, value: await summarizeMemory(input.rootPath, next) };
    });
  } catch {
    return workspaceError('ERR_MEMORY_NOT_FOUND', 'Memory not found', 'previous-file-preserved');
  }
}

export async function lookupRecordingDirectoryById(
  rootPath: string,
  recordingId: string
): Promise<RecordingDirectoryLookup> {
  if (!RECORDING_ID_PATTERN.test(recordingId)) {
    return { status: 'invalid-id' };
  }
  await beforeRecordingLookupForTest?.();
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  const memoryEntries = await readExistingDirectoryEntries(memoriesDirectory);
  let foundDirectory: string | null = null;
  let foundRecording: MemoryRecordingSummary | null = null;
  let duplicateFound = false;
  let invalidDurableFound = false;
  for (const memoryEntry of memoryEntries) {
    if (!memoryEntry.isDirectory()) {
      continue;
    }
    const candidate = await memoryRecordingDirectory(rootPath, memoryEntry.name, recordingId);
    try {
      const metadata = await lstat(candidate);
      const recording = metadata.isDirectory()
        ? await summarizeValidFinalizedRecordingDirectory(rootPath, memoryEntry.name, recordingId)
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
    return { status: 'found', directory: foundDirectory, recording: foundRecording };
  }
  return { status: 'not-found' };
}

export async function findRecordingDirectoryById(
  rootPath: string,
  recordingId: string
): Promise<string> {
  const lookup = await lookupRecordingDirectoryById(rootPath, recordingId);
  if (lookup.status === 'found') {
    return lookup.directory;
  }
  if (lookup.status === 'duplicate') {
    throw new Error('Duplicate finalized recording id');
  }
  if (lookup.status === 'invalid-id') {
    throw new Error('Invalid recording id');
  }
  if (lookup.status === 'invalid-durable') {
    throw new Error('Invalid durable recording');
  }
  throw new Error('Recording not found');
}

export async function findFinalizedRecordingById(
  rootPath: string,
  recordingId: string
): Promise<{
  readonly directory: string;
  readonly recording: MemoryRecordingSummary;
}> {
  const lookup = await lookupRecordingDirectoryById(rootPath, recordingId);
  if (lookup.status === 'found') {
    return { directory: lookup.directory, recording: lookup.recording };
  }
  if (lookup.status === 'duplicate') {
    throw new Error('Duplicate finalized recording id');
  }
  if (lookup.status === 'invalid-id') {
    throw new Error('Invalid recording id');
  }
  if (lookup.status === 'invalid-durable') {
    throw new Error('Invalid durable recording');
  }
  throw new Error('Recording not found');
}

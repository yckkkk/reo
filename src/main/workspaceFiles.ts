import { spawnSync } from 'node:child_process';
import { lstatSync, realpathSync, renameSync } from 'node:fs';
import { lstat, opendir, rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  writeWorkspaceFileNoReplaceAtomic,
  writeWorkspaceJsonAtomic,
} from './atomicWorkspaceFile.js';
import {
  assertSameCurrentDirectoryIdentity as assertSameCurrentDirectory,
  assertSameDirectoryIdentitySync as assertSameDirectoryPath,
  readSafeDirectoryIdentitySync as readDirectoryIdentitySync,
  sameDirectoryIdentity,
  type DirectoryIdentity,
} from './directoryIdentity.js';
import {
  rebuildMemoryIndex,
  rebuildWorkspaceReadModel,
  recoverRecordingFinalizeTransactions,
  replaceWorkspaceIndex,
  updateWorkspaceIndexFromCurrent,
  type MemorySummary,
} from './memoryFiles.js';
import {
  checkWorkspaceDraftsDirectory,
  checkWorkspaceMemoriesDirectory,
  checkWorkspaceReoDirectory,
  createNewWorkspaceRootDirectory,
  ensureWorkspaceDraftsDirectory,
  ensureWorkspaceMemoriesDirectory,
  getWorkspaceIndexPath,
  getWorkspaceMetadataPath,
  resolveWorkspaceRoot,
} from './workspacePaths.js';
import {
  workspaceError,
  workspaceMemorySummarySchema,
  type WorkspaceErrorEnvelope,
  type WorkspaceSnapshot,
} from '../workspace-contract/workspace-contract.js';
import { isSafeWorkspaceDirectoryName } from '../workspace-contract/workspace-name.js';
import { readBoundedJsonNoFollow } from './workspaceJsonFile.js';
import {
  fsyncCurrentWorkspaceDirectoryBestEffort,
  runInWorkspaceDirectorySync,
} from './workspaceDirectoryTransactions.js';

const WORKSPACE_SCHEMA_VERSION = 1;
const MAX_WORKSPACE_JSON_BYTES = 1_048_576;
const EMPTY_WORKSPACE_IGNORED_ENTRIES = new Set(['.DS_Store']);
const EMPTY_WORKSPACE_LOCK_REO_ENTRIES = new Set(['workspace.lock', 'workspace.lock.lock']);
const WORKSPACE_ROOT_RENAME_TIMEOUT_MS = 5000;
const DARWIN_MOVE_ITEM_NO_REPLACE_SCRIPT =
  'function run(argv) { ObjC.import("Foundation"); const ok = $.NSFileManager.defaultManager.moveItemAtPathToPathError(argv[0], argv[1], null); if (!ok) throw new Error("move failed"); }';

const workspaceMetadataSchema = z
  .object({
    schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
    workspaceId: z.string().min(1),
    title: z.string(),
    description: z.string(),
    createdAt: z.string(),
  })
  .strict();

const workspaceIndexSchema = z
  .object({
    schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
    memories: z.array(workspaceMemorySummarySchema),
  })
  .strict();

type WorkspaceMetadata = z.infer<typeof workspaceMetadataSchema>;
type WorkspaceIndex = z.infer<typeof workspaceIndexSchema>;

interface InitializeWorkspaceFilesOptions {
  readonly rootPath: string;
  readonly title: string;
  readonly description: string;
  readonly createWorkspaceId: () => string;
  readonly now: () => string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

interface OpenWorkspaceFilesOptions {
  readonly rootPath: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

interface RenameWorkspaceRootTitleOptions {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly relocateWorkspaceRoot: (
    canonicalRoot: string
  ) => { readonly ok: true } | WorkspaceErrorEnvelope;
}

interface RepairWorkspaceTitleMirrorOptions {
  readonly rootPath: string;
  readonly workspaceId?: string | undefined;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

interface ReadWorkspaceSnapshotOptions {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

type MaybePromise<T> = T | Promise<T>;
type AssertWorkspaceUsable = () => { readonly ok: true } | WorkspaceErrorEnvelope;

class WorkspaceOpenAborted extends Error {
  readonly envelope: WorkspaceErrorEnvelope;

  constructor(envelope: WorkspaceErrorEnvelope) {
    super(envelope.error.message);
    this.envelope = envelope;
  }
}

function assertWorkspaceUsable(assertUsable: AssertWorkspaceUsable | undefined): void {
  const usable = assertUsable?.();
  if (usable && !usable.ok) {
    throw new WorkspaceOpenAborted(usable);
  }
}

let beforeWorkspaceJsonNoFollowFinalAssertForTest:
  | ((filePath: string) => MaybePromise<void>)
  | null = null;

type WorkspaceFilesResult =
  | {
      readonly ok: true;
      readonly snapshot: WorkspaceSnapshot;
    }
  | WorkspaceErrorEnvelope;

type WorkspaceRootRenameResult =
  | {
      readonly ok: true;
      readonly canonicalRoot: string;
      readonly snapshot: WorkspaceSnapshot;
    }
  | WorkspaceErrorEnvelope;

type WorkspaceTitleMirrorRepairResult =
  | {
      readonly ok: true;
      readonly workspaceId: string;
      readonly title: string;
      readonly description: string;
    }
  | WorkspaceErrorEnvelope;

export type WorkspaceInitializeTarget =
  | {
      readonly ok: true;
      readonly canonicalRoot: string;
    }
  | WorkspaceErrorEnvelope;

export type WorkspaceValidatedOpenTarget =
  | {
      readonly ok: true;
      readonly canonicalRoot: string;
      readonly metadata: WorkspaceMetadata;
      readonly rootIdentity: DirectoryIdentity;
    }
  | WorkspaceErrorEnvelope;

export type WorkspaceOpenTarget =
  | ({
      readonly ok: true;
      readonly kind: 'existing';
      readonly canonicalRoot: string;
    } & Omit<Extract<WorkspaceValidatedOpenTarget, { readonly ok: true }>, 'ok' | 'canonicalRoot'>)
  | {
      readonly ok: true;
      readonly kind: 'empty';
      readonly canonicalRoot: string;
    }
  | WorkspaceErrorEnvelope;

export function setBeforeWorkspaceJsonNoFollowFinalAssertForTest(
  hook: ((filePath: string) => MaybePromise<void>) | null
): void {
  beforeWorkspaceJsonNoFollowFinalAssertForTest = hook;
}

let beforeWorkspaceIndexReconciliationPersistForTest: (() => MaybePromise<void>) | null = null;

export function setBeforeWorkspaceIndexReconciliationPersistForTest(
  hook: (() => MaybePromise<void>) | null
): void {
  beforeWorkspaceIndexReconciliationPersistForTest = hook;
}

let beforeWorkspaceRootRenameCommitForTest: (() => void) | null = null;

export function setBeforeWorkspaceRootRenameCommitForTest(hook: (() => void) | null): void {
  beforeWorkspaceRootRenameCommitForTest = hook;
}

let beforeWorkspaceRootRenameFinalizeForTest: (() => void) | null = null;

export function setBeforeWorkspaceRootRenameFinalizeForTest(hook: (() => void) | null): void {
  beforeWorkspaceRootRenameFinalizeForTest = hook;
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

function workspaceAlreadyExists(): WorkspaceErrorEnvelope {
  return workspaceError(
    'ERR_WORKSPACE_ALREADY_EXISTS',
    'Workspace directory already exists',
    'previous-file-preserved'
  );
}

function workspaceInvalidFolderName(): WorkspaceErrorEnvelope {
  return workspaceError(
    'ERR_WORKSPACE_INVALID_REQUEST',
    'Workspace folder name is invalid',
    'previous-file-preserved'
  );
}

function workspaceErrorAfterRootRename(error: WorkspaceErrorEnvelope): WorkspaceErrorEnvelope {
  return workspaceError(error.error.code, error.error.message, 'file-written-index-stale');
}

function targetDirectoryIdentityForRename(
  targetName: string
): DirectoryIdentity | 'exists-with-different-identity' | null {
  try {
    const entry = lstatSync(targetName);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      return 'exists-with-different-identity';
    }
    return { dev: entry.dev, ino: entry.ino };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function assertWorkspaceRootRenameTargetAvailable(
  targetName: string,
  sourceIdentity: DirectoryIdentity
): void {
  const targetIdentity = targetDirectoryIdentityForRename(targetName);
  if (
    targetIdentity !== null &&
    (targetIdentity === 'exists-with-different-identity' ||
      !sameDirectoryIdentity(targetIdentity, sourceIdentity))
  ) {
    throw new WorkspaceOpenAborted(workspaceAlreadyExists());
  }
}

type WorkspaceRootMoveResult =
  | {
      readonly ok: true;
      readonly canonicalRoot: string;
    }
  | WorkspaceErrorEnvelope;

function workspaceRootMoveFailed(): WorkspaceErrorEnvelope {
  return workspaceError(
    'ERR_WORKSPACE_UPDATE_FAILED',
    'Workspace title could not be updated',
    'previous-file-preserved'
  );
}

function workspaceRootPostMoveFailed(): WorkspaceErrorEnvelope {
  return workspaceError(
    'ERR_WORKSPACE_UPDATE_FAILED',
    'Workspace title could not be updated',
    'file-written-index-stale'
  );
}

function renameDirectoryNoReplaceSync({
  parentDirectory,
  sourceName,
  targetName,
  sourceIdentity,
}: {
  readonly parentDirectory: string;
  readonly sourceName: string;
  readonly targetName: string;
  readonly sourceIdentity: DirectoryIdentity;
}): void {
  const sourcePath = path.join(parentDirectory, sourceName);
  const targetPath = path.join(parentDirectory, targetName);
  const result =
    process.platform === 'darwin'
      ? spawnSync(
          '/usr/bin/osascript',
          ['-l', 'JavaScript', '-e', DARWIN_MOVE_ITEM_NO_REPLACE_SCRIPT, sourcePath, targetPath],
          {
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: WORKSPACE_ROOT_RENAME_TIMEOUT_MS,
            windowsHide: true,
          }
        )
      : process.platform === 'linux'
        ? spawnSync('/bin/mv', ['-T', '-n', sourcePath, targetPath], {
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: WORKSPACE_ROOT_RENAME_TIMEOUT_MS,
            windowsHide: true,
          })
        : null;

  if (result === null) {
    throw new Error('No no-replace directory rename primitive is available on this platform');
  }

  const sourceAfter = targetDirectoryIdentityForRename(sourceName);
  const targetAfter = targetDirectoryIdentityForRename(targetName);
  if (
    !result.error &&
    result.status === 0 &&
    targetAfter !== null &&
    targetAfter !== 'exists-with-different-identity' &&
    sameDirectoryIdentity(targetAfter, sourceIdentity)
  ) {
    return;
  }

  const nestedSourceAfter = targetDirectoryIdentityForRename(path.join(targetName, sourceName));
  if (
    sourceAfter === null &&
    nestedSourceAfter !== null &&
    nestedSourceAfter !== 'exists-with-different-identity' &&
    sameDirectoryIdentity(nestedSourceAfter, sourceIdentity)
  ) {
    renameSync(path.join(targetName, sourceName), sourceName);
    throw new WorkspaceOpenAborted(workspaceAlreadyExists());
  }
  if (
    sourceAfter !== null &&
    sourceAfter !== 'exists-with-different-identity' &&
    sameDirectoryIdentity(sourceAfter, sourceIdentity) &&
    targetAfter !== null &&
    (targetAfter === 'exists-with-different-identity' ||
      !sameDirectoryIdentity(targetAfter, sourceIdentity))
  ) {
    throw new WorkspaceOpenAborted(workspaceAlreadyExists());
  }
  if (
    sourceAfter !== null &&
    sourceAfter !== 'exists-with-different-identity' &&
    sameDirectoryIdentity(sourceAfter, sourceIdentity) &&
    targetAfter === null &&
    !result.error &&
    result.status === 0
  ) {
    throw new WorkspaceOpenAborted(workspaceAlreadyExists());
  }
  if (result.error) {
    throw result.error;
  }
  throw new Error(result.stderr || 'Workspace root directory could not be renamed');
}

function moveWorkspaceRootDirectory({
  canonicalRoot,
  targetName,
  expectedRootIdentity,
  assertWorkspaceUsable: assertUsable,
}: {
  readonly canonicalRoot: string;
  readonly targetName: string;
  readonly expectedRootIdentity: DirectoryIdentity;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): WorkspaceRootMoveResult {
  const sourceName = path.basename(canonicalRoot);
  const parentDirectory = path.dirname(canonicalRoot);
  const parentIdentity = readDirectoryIdentitySync(parentDirectory);
  const previousCwd = process.cwd();
  try {
    process.chdir(parentDirectory);
    assertSameCurrentDirectory(parentIdentity);
    assertSameDirectoryPath(sourceName, expectedRootIdentity, 'Workspace root path changed');
    assertWorkspaceRootRenameTargetAvailable(targetName, expectedRootIdentity);
    assertWorkspaceUsable(assertUsable);
    assertSameCurrentDirectory(parentIdentity);
    assertSameDirectoryPath(parentDirectory, parentIdentity);
    assertSameDirectoryPath(sourceName, expectedRootIdentity, 'Workspace root path changed');
    assertWorkspaceRootRenameTargetAvailable(targetName, expectedRootIdentity);
    if (sourceName !== targetName) {
      beforeWorkspaceRootRenameCommitForTest?.();
      renameDirectoryNoReplaceSync({
        parentDirectory,
        sourceName,
        targetName,
        sourceIdentity: expectedRootIdentity,
      });
    }
    return { ok: true, canonicalRoot: path.join(parentDirectory, targetName) };
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    return workspaceRootMoveFailed();
  } finally {
    process.chdir(previousCwd);
  }
}

function finalizeWorkspaceRootDirectoryRename({
  canonicalRoot,
  expectedRootIdentity,
}: {
  readonly canonicalRoot: string;
  readonly expectedRootIdentity: DirectoryIdentity;
}): WorkspaceRootMoveResult {
  const targetName = path.basename(canonicalRoot);
  const parentDirectory = path.dirname(canonicalRoot);
  const parentIdentity = readDirectoryIdentitySync(parentDirectory);
  try {
    return runInWorkspaceDirectorySync(
      { directory: parentDirectory, directoryIdentity: parentIdentity },
      () => {
        beforeWorkspaceRootRenameFinalizeForTest?.();
        assertSameCurrentDirectory(parentIdentity);
        assertSameDirectoryPath(targetName, expectedRootIdentity, 'Workspace root target changed');
        fsyncCurrentWorkspaceDirectoryBestEffort();
        return { ok: true, canonicalRoot: realpathSync(targetName) };
      }
    );
  } catch {
    return workspaceRootPostMoveFailed();
  }
}

function snapshotFrom(metadata: WorkspaceMetadata, index: WorkspaceIndex): WorkspaceSnapshot {
  return {
    workspaceId: metadata.workspaceId,
    title: metadata.title,
    description: metadata.description,
    memories: index.memories,
  };
}

async function repairWorkspaceTitleMetadataMirror({
  canonicalRoot,
  metadata,
  assertWorkspaceUsable: assertUsable,
}: {
  readonly canonicalRoot: string;
  readonly metadata: WorkspaceMetadata;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<WorkspaceMetadata> {
  const rootTitle = path.basename(canonicalRoot);
  if (metadata.title === rootTitle) {
    return metadata;
  }

  const nextMetadata = { ...metadata, title: rootTitle };
  await writeWorkspaceJsonAtomic(getWorkspaceMetadataPath(canonicalRoot), nextMetadata, () =>
    assertWorkspaceUsable(assertUsable)
  );
  assertWorkspaceUsable(assertUsable);
  return nextMetadata;
}

function sameMemorySummaries(
  first: readonly MemorySummary[],
  second: readonly MemorySummary[]
): boolean {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((memory, index) => {
    const other = second[index];
    return (
      other !== undefined &&
      memory.memoryId === other.memoryId &&
      memory.title === other.title &&
      memory.createdAt === other.createdAt &&
      memory.updatedAt === other.updatedAt &&
      memory.segmentCount === other.segmentCount &&
      memory.audioSegmentCount === other.audioSegmentCount &&
      memory.noteSegmentCount === other.noteSegmentCount &&
      memory.audioDurationMs === other.audioDurationMs &&
      memory.audioByteLength === other.audioByteLength &&
      memory.hasAudioTranscript === other.hasAudioTranscript &&
      memory.hasAnyNote === other.hasAnyNote &&
      memory.supplementCount === other.supplementCount
    );
  });
}

export async function validateWorkspaceInitializeTarget(
  rootPath: string
): Promise<WorkspaceInitializeTarget> {
  const canonicalRoot = await resolveWorkspaceRoot(rootPath);
  if (typeof canonicalRoot !== 'string') {
    return canonicalRoot;
  }

  if (await exists(path.join(canonicalRoot, 'AGENTS.md'))) {
    return workspaceError(
      'ERR_WORKSPACE_AGENTS_CONFLICT',
      'Workspace already contains AGENTS.md',
      'none-written'
    );
  }

  const reoDirectory = await checkWorkspaceReoDirectory(canonicalRoot);
  if (typeof reoDirectory !== 'string') {
    return reoDirectory;
  }
  const draftsDirectory = await checkWorkspaceDraftsDirectory(canonicalRoot);
  if (typeof draftsDirectory !== 'string') {
    return draftsDirectory;
  }
  const memoriesDirectory = await checkWorkspaceMemoriesDirectory(canonicalRoot);
  if (typeof memoriesDirectory !== 'string') {
    return memoriesDirectory;
  }

  return { ok: true, canonicalRoot };
}

export async function createWorkspaceInitializeTargetInParent(
  parentPath: string,
  folderName: string
): Promise<WorkspaceInitializeTarget> {
  const canonicalParent = await resolveWorkspaceRoot(parentPath);
  if (typeof canonicalParent !== 'string') {
    return canonicalParent;
  }

  const createdRoot = await createNewWorkspaceRootDirectory(canonicalParent, folderName);
  if (typeof createdRoot !== 'string') {
    return createdRoot;
  }

  return { ok: true, canonicalRoot: createdRoot };
}

async function readMetadata(canonicalRoot: string): Promise<WorkspaceMetadata | null> {
  return readWorkspaceJsonNoFollow(
    getWorkspaceMetadataPath(canonicalRoot),
    workspaceMetadataSchema
  );
}

async function validateWorkspaceOpenCanonicalTarget(
  canonicalRoot: string
): Promise<WorkspaceValidatedOpenTarget> {
  const reoDirectory = await checkWorkspaceReoDirectory(canonicalRoot);
  if (typeof reoDirectory !== 'string') {
    return reoDirectory;
  }
  const draftsDirectory = await checkWorkspaceDraftsDirectory(canonicalRoot);
  if (typeof draftsDirectory !== 'string') {
    return draftsDirectory;
  }
  const memoriesDirectory = await checkWorkspaceMemoriesDirectory(canonicalRoot);
  if (typeof memoriesDirectory !== 'string') {
    return memoriesDirectory;
  }

  const metadata = await readMetadata(canonicalRoot);
  if (!metadata) {
    return workspaceError(
      'ERR_WORKSPACE_METADATA_INVALID',
      'Workspace metadata is invalid',
      'none-written'
    );
  }

  try {
    return {
      ok: true,
      canonicalRoot,
      metadata,
      rootIdentity: readDirectoryIdentitySync(canonicalRoot),
    };
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_METADATA_INVALID',
      'Workspace metadata is invalid',
      'none-written'
    );
  }
}

export async function validateWorkspaceOpenTarget(
  rootPath: string
): Promise<WorkspaceValidatedOpenTarget> {
  const canonicalRoot = await resolveWorkspaceRoot(rootPath);
  if (typeof canonicalRoot !== 'string') {
    return canonicalRoot;
  }

  return validateWorkspaceOpenCanonicalTarget(canonicalRoot);
}

export async function validateWorkspaceOpenTargetWorkspaceId({
  rootPath,
  workspaceId,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
}): Promise<WorkspaceInitializeTarget> {
  const target = await validateWorkspaceOpenTarget(rootPath);
  if (!target.ok) {
    return target;
  }

  if (target.metadata.workspaceId !== workspaceId) {
    return workspaceError(
      'ERR_WORKSPACE_METADATA_INVALID',
      'Workspace metadata is invalid',
      'previous-file-preserved'
    );
  }

  return target;
}

export async function validateEmptyWorkspaceOpenCanonicalTarget(
  canonicalRoot: string
): Promise<WorkspaceInitializeTarget> {
  try {
    const directory = await opendir(canonicalRoot);
    for await (const entry of directory) {
      if (!EMPTY_WORKSPACE_IGNORED_ENTRIES.has(entry.name)) {
        return workspaceError(
          'ERR_WORKSPACE_METADATA_INVALID',
          'Workspace metadata is invalid',
          'none-written'
        );
      }
    }
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_METADATA_INVALID',
      'Workspace metadata is invalid',
      'none-written'
    );
  }

  return { ok: true, canonicalRoot };
}

async function isLockOnlyReoDirectory(reoDirectoryPath: string): Promise<boolean> {
  const stats = await lstat(reoDirectoryPath);
  if (!stats.isDirectory()) {
    return false;
  }

  const directory = await opendir(reoDirectoryPath);
  let hasWorkspaceLock = false;
  for await (const entry of directory) {
    if (!EMPTY_WORKSPACE_LOCK_REO_ENTRIES.has(entry.name)) {
      return false;
    }
    if (entry.name === 'workspace.lock' && !entry.isFile()) {
      return false;
    }
    if (entry.name === 'workspace.lock.lock' && !entry.isDirectory()) {
      return false;
    }
    hasWorkspaceLock ||= entry.name === 'workspace.lock';
  }

  return hasWorkspaceLock;
}

export async function validateEmptyWorkspaceOpenCanonicalTargetAfterLock(
  canonicalRoot: string
): Promise<WorkspaceInitializeTarget> {
  try {
    const directory = await opendir(canonicalRoot);
    for await (const entry of directory) {
      if (EMPTY_WORKSPACE_IGNORED_ENTRIES.has(entry.name)) {
        continue;
      }
      if (
        entry.name === '.reo' &&
        (await isLockOnlyReoDirectory(path.join(canonicalRoot, entry.name)))
      ) {
        continue;
      }
      return workspaceError(
        'ERR_WORKSPACE_METADATA_INVALID',
        'Workspace metadata is invalid',
        'none-written'
      );
    }
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_METADATA_INVALID',
      'Workspace metadata is invalid',
      'none-written'
    );
  }

  return { ok: true, canonicalRoot };
}

export async function removeLockOnlyReoDirectory(canonicalRoot: string): Promise<void> {
  const reoDirectoryPath = path.join(canonicalRoot, '.reo');
  const lockOnly = await isLockOnlyReoDirectory(reoDirectoryPath).catch(() => false);
  if (lockOnly) {
    await rm(reoDirectoryPath, { force: true, recursive: true });
  }
}

export async function classifyWorkspaceOpenTarget(rootPath: string): Promise<WorkspaceOpenTarget> {
  const canonicalRoot = await resolveWorkspaceRoot(rootPath);
  if (typeof canonicalRoot !== 'string') {
    return canonicalRoot;
  }

  const existingTarget = await validateWorkspaceOpenCanonicalTarget(canonicalRoot);
  if (existingTarget.ok) {
    return { ...existingTarget, kind: 'existing' };
  }

  const emptyTarget = await validateEmptyWorkspaceOpenCanonicalTarget(canonicalRoot);
  if (emptyTarget.ok) {
    return { ...emptyTarget, kind: 'empty' };
  }

  return existingTarget;
}

async function readOrRebuildIndex(
  canonicalRoot: string,
  {
    persistReconciliation = true,
    assertBeforePersist,
    rebuiltMemories,
  }: {
    readonly persistReconciliation?: boolean;
    readonly assertBeforePersist?: () => Promise<void>;
    readonly rebuiltMemories?: readonly MemorySummary[];
  } = {}
): Promise<WorkspaceIndex> {
  const parsedIndex = await readWorkspaceJsonNoFollow(
    getWorkspaceIndexPath(canonicalRoot),
    workspaceIndexSchema
  );

  if (parsedIndex && !rebuiltMemories) {
    return parsedIndex;
  }

  let memories = [
    ...(rebuiltMemories ?? (await rebuildMemoryIndex(canonicalRoot, { persist: false }))),
  ];
  if (parsedIndex && sameMemorySummaries(parsedIndex.memories, memories)) {
    return parsedIndex;
  }

  if (persistReconciliation) {
    const shouldRebuildDuringPersist = beforeWorkspaceIndexReconciliationPersistForTest !== null;
    memories = [
      ...(await replaceWorkspaceIndex(
        canonicalRoot,
        shouldRebuildDuringPersist
          ? async () => rebuildMemoryIndex(canonicalRoot, { persist: false })
          : () => memories,
        async () => {
          await beforeWorkspaceIndexReconciliationPersistForTest?.();
          await assertBeforePersist?.();
        }
      )),
    ];
  }
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    memories,
  };
}

export async function initializeWorkspaceFiles({
  rootPath,
  title,
  description,
  createWorkspaceId,
  now,
  assertWorkspaceUsable: assertUsable,
}: InitializeWorkspaceFilesOptions): Promise<WorkspaceFilesResult> {
  let canonicalRoot: string;
  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceInitializeTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }
    canonicalRoot = target.canonicalRoot;
    assertWorkspaceUsable(assertUsable);
    const draftsDirectory = await ensureWorkspaceDraftsDirectory(canonicalRoot, assertUsable);
    if (typeof draftsDirectory !== 'string') {
      return draftsDirectory;
    }
    assertWorkspaceUsable(assertUsable);
    const memoriesDirectory = await ensureWorkspaceMemoriesDirectory(canonicalRoot, assertUsable);
    if (typeof memoriesDirectory !== 'string') {
      return memoriesDirectory;
    }
    assertWorkspaceUsable(assertUsable);
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    return workspaceError(
      'ERR_WORKSPACE_INIT_FAILED',
      'Workspace could not be initialized',
      'previous-file-preserved'
    );
  }

  const metadata = {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspaceId: createWorkspaceId(),
    title,
    description,
    createdAt: now(),
  } satisfies z.infer<typeof workspaceMetadataSchema>;
  const index = {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    memories: [],
  } satisfies z.infer<typeof workspaceIndexSchema>;

  try {
    assertWorkspaceUsable(assertUsable);
    await writeWorkspaceFileNoReplaceAtomic(
      path.join(canonicalRoot, 'AGENTS.md'),
      '# Reo workspace\n\n本文件是 Reo workspace 的 AI 协作入口。\n',
      () => assertWorkspaceUsable(assertUsable)
    );
    assertWorkspaceUsable(assertUsable);
    await writeWorkspaceJsonAtomic(getWorkspaceMetadataPath(canonicalRoot), metadata, () =>
      assertWorkspaceUsable(assertUsable)
    );
    assertWorkspaceUsable(assertUsable);
    await writeWorkspaceJsonAtomic(getWorkspaceIndexPath(canonicalRoot), index, () =>
      assertWorkspaceUsable(assertUsable)
    );
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    throw error;
  }

  return {
    ok: true,
    snapshot: snapshotFrom(metadata, index),
  };
}

export async function openWorkspaceFiles({
  rootPath,
  assertWorkspaceUsable: assertUsable,
}: OpenWorkspaceFilesOptions): Promise<WorkspaceFilesResult> {
  let index: WorkspaceIndex;
  let metadata: WorkspaceMetadata;
  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceOpenTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }
    const { canonicalRoot } = target;
    metadata = target.metadata;
    assertWorkspaceUsable(assertUsable);
    const draftsDirectory = await ensureWorkspaceDraftsDirectory(canonicalRoot, assertUsable);
    if (typeof draftsDirectory !== 'string') {
      return draftsDirectory;
    }
    assertWorkspaceUsable(assertUsable);
    const memoriesDirectory = await ensureWorkspaceMemoriesDirectory(canonicalRoot, assertUsable);
    if (typeof memoriesDirectory !== 'string') {
      return memoriesDirectory;
    }
    assertWorkspaceUsable(assertUsable);
    await recoverRecordingFinalizeTransactions(canonicalRoot, {
      assertWorkspaceUsable: () => assertWorkspaceUsable(assertUsable),
    });
    assertWorkspaceUsable(assertUsable);
    index = await readOrRebuildIndex(canonicalRoot, {
      assertBeforePersist: async () => assertWorkspaceUsable(assertUsable),
    });
    assertWorkspaceUsable(assertUsable);
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    return workspaceError(
      'ERR_WORKSPACE_OPEN_FAILED',
      'Workspace could not be opened',
      'previous-file-preserved'
    );
  }
  return {
    ok: true,
    snapshot: snapshotFrom(metadata, index),
  };
}

export async function repairWorkspaceTitleMirrorFromRootName({
  rootPath,
  workspaceId,
  assertWorkspaceUsable: assertUsable,
}: RepairWorkspaceTitleMirrorOptions): Promise<WorkspaceTitleMirrorRepairResult> {
  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceOpenTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }

    const { canonicalRoot } = target;
    const metadata = target.metadata;
    assertWorkspaceUsable(assertUsable);
    if (workspaceId !== undefined && metadata.workspaceId !== workspaceId) {
      return workspaceError(
        'ERR_WORKSPACE_METADATA_INVALID',
        'Workspace metadata is invalid',
        'previous-file-preserved'
      );
    }

    const nextMetadata = await repairWorkspaceTitleMetadataMirror({
      canonicalRoot,
      metadata,
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
    });
    return {
      ok: true,
      workspaceId: nextMetadata.workspaceId,
      title: nextMetadata.title,
      description: nextMetadata.description,
    };
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    return workspaceError(
      'ERR_WORKSPACE_UPDATE_FAILED',
      'Workspace title could not be updated',
      'previous-file-preserved'
    );
  }
}

export async function renameWorkspaceRootFromFileTruth({
  rootPath,
  workspaceId,
  title,
  assertWorkspaceUsable: assertUsable,
  relocateWorkspaceRoot,
}: RenameWorkspaceRootTitleOptions): Promise<WorkspaceRootRenameResult> {
  if (!isSafeWorkspaceDirectoryName(title)) {
    return workspaceInvalidFolderName();
  }

  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceOpenTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }
    const { canonicalRoot, rootIdentity } = target;
    const metadata = target.metadata;
    assertWorkspaceUsable(assertUsable);
    if (metadata.workspaceId !== workspaceId) {
      return workspaceError(
        'ERR_WORKSPACE_METADATA_INVALID',
        'Workspace metadata is invalid',
        'previous-file-preserved'
      );
    }

    const moved = moveWorkspaceRootDirectory({
      canonicalRoot,
      targetName: title,
      expectedRootIdentity: rootIdentity,
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
    });
    if (!moved.ok) {
      return moved;
    }

    let nextCanonicalRoot = moved.canonicalRoot;
    try {
      const relocated = relocateWorkspaceRoot(nextCanonicalRoot);
      if (!relocated.ok) {
        return workspaceErrorAfterRootRename(relocated);
      }
    } catch {
      return workspaceRootPostMoveFailed();
    }

    const finalized = finalizeWorkspaceRootDirectoryRename({
      canonicalRoot: nextCanonicalRoot,
      expectedRootIdentity: rootIdentity,
    });
    if (!finalized.ok) {
      return finalized;
    }
    if (finalized.canonicalRoot !== nextCanonicalRoot) {
      try {
        const relocated = relocateWorkspaceRoot(finalized.canonicalRoot);
        if (!relocated.ok) {
          return workspaceErrorAfterRootRename(relocated);
        }
      } catch {
        return workspaceRootPostMoveFailed();
      }
      nextCanonicalRoot = finalized.canonicalRoot;
    }
    nextCanonicalRoot = finalized.canonicalRoot;

    const nextMetadata = { ...metadata, title };
    try {
      await writeWorkspaceJsonAtomic(
        getWorkspaceMetadataPath(nextCanonicalRoot),
        nextMetadata,
        () => assertWorkspaceUsable(assertUsable)
      );
    } catch (error) {
      if (error instanceof WorkspaceOpenAborted) {
        return workspaceErrorAfterRootRename(error.envelope);
      }
      return workspaceError(
        'ERR_WORKSPACE_UPDATE_FAILED',
        'Workspace title could not be updated',
        'file-written-index-stale'
      );
    }

    let index: WorkspaceIndex;
    try {
      index = await readOrRebuildIndex(nextCanonicalRoot, {
        assertBeforePersist: async () => assertWorkspaceUsable(assertUsable),
      });
      assertWorkspaceUsable(assertUsable);
    } catch (error) {
      if (error instanceof WorkspaceOpenAborted) {
        return workspaceErrorAfterRootRename(error.envelope);
      }
      return workspaceError(
        'ERR_WORKSPACE_UPDATE_FAILED',
        'Workspace title could not be updated',
        'file-written-index-stale'
      );
    }

    return {
      ok: true,
      canonicalRoot: nextCanonicalRoot,
      snapshot: snapshotFrom(nextMetadata, index),
    };
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    return workspaceError(
      'ERR_WORKSPACE_UPDATE_FAILED',
      'Workspace title could not be updated',
      'previous-file-preserved'
    );
  }
}

export async function readWorkspaceSnapshotFromFileTruth({
  rootPath,
  workspaceId,
  assertWorkspaceUsable: assertUsable,
}: ReadWorkspaceSnapshotOptions): Promise<WorkspaceFilesResult> {
  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceOpenTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }

    const { canonicalRoot } = target;
    let metadata = target.metadata;
    assertWorkspaceUsable(assertUsable);
    if (metadata.workspaceId !== workspaceId) {
      return workspaceError(
        'ERR_WORKSPACE_METADATA_INVALID',
        'Workspace metadata is invalid',
        'previous-file-preserved'
      );
    }

    metadata = await repairWorkspaceTitleMetadataMirror({
      canonicalRoot,
      metadata,
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
    });
    const readModel = await rebuildWorkspaceReadModel(canonicalRoot, {
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
    });
    assertWorkspaceUsable(assertUsable);
    const index = await readOrRebuildIndex(canonicalRoot, {
      assertBeforePersist: async () => {
        assertWorkspaceUsable(assertUsable);
        await readModel.assertMemoriesRootCurrent();
      },
      rebuiltMemories: readModel.memories,
    });
    assertWorkspaceUsable(assertUsable);
    return {
      ok: true,
      snapshot: snapshotFrom(metadata, index),
    };
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    return workspaceError(
      'ERR_WORKSPACE_OPEN_FAILED',
      'Workspace snapshot could not be read',
      'previous-file-preserved'
    );
  }
}

export async function readWorkspaceSnapshotFromIndex({
  rootPath,
  workspaceId,
  assertWorkspaceUsable: assertUsable,
}: ReadWorkspaceSnapshotOptions): Promise<WorkspaceFilesResult> {
  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceOpenTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }

    const { canonicalRoot } = target;
    let metadata = target.metadata;
    assertWorkspaceUsable(assertUsable);
    if (metadata.workspaceId !== workspaceId) {
      return workspaceError(
        'ERR_WORKSPACE_METADATA_INVALID',
        'Workspace metadata is invalid',
        'previous-file-preserved'
      );
    }

    metadata = await repairWorkspaceTitleMetadataMirror({
      canonicalRoot,
      metadata,
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
    });
    assertWorkspaceUsable(assertUsable);

    const index = await readWorkspaceJsonNoFollow(
      getWorkspaceIndexPath(canonicalRoot),
      workspaceIndexSchema
    );
    if (!index) {
      return readWorkspaceSnapshotFromFileTruth({
        rootPath,
        workspaceId,
        ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
      });
    }

    assertWorkspaceUsable(assertUsable);
    return {
      ok: true,
      snapshot: snapshotFrom(metadata, index),
    };
  } catch (error) {
    if (error instanceof WorkspaceOpenAborted) {
      return error.envelope;
    }
    return workspaceError(
      'ERR_WORKSPACE_OPEN_FAILED',
      'Workspace snapshot could not be read',
      'previous-file-preserved'
    );
  }
}

async function readWorkspaceJsonNoFollow<T>(
  filePath: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  const result = await readBoundedJsonNoFollow({
    beforeFinalAssert: () => beforeWorkspaceJsonNoFollowFinalAssertForTest?.(filePath),
    filePath,
    maxBytes: MAX_WORKSPACE_JSON_BYTES,
    schema,
  });
  return result.status === 'ok' ? result.value : null;
}

export async function updateWorkspaceIndex(
  rootPath: string,
  update: (memories: readonly MemorySummary[]) => readonly MemorySummary[]
): Promise<void> {
  await updateWorkspaceIndexFromCurrent(rootPath, update);
}

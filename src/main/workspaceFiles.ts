import { spawnSync } from 'node:child_process';
import { constants, lstatSync, realpathSync, renameSync } from 'node:fs';
import { lstat, mkdir, opendir, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  writeWorkspaceFileAtomic,
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
  checkWorkspaceWidgetsDirectory,
  checkWorkspaceReoDirectory,
  createNewWorkspaceRootDirectory,
  ensureWorkspaceDraftsDirectory,
  ensureWorkspaceMemoriesDirectory,
  ensureWorkspaceWidgetsDirectory,
  getWorkspaceIndexPath,
  getWorkspaceMetadataPath,
  resolveWorkspaceRoot,
} from './workspacePaths.js';
import {
  writeWorkspaceNeedsReviewReport,
  type WorkspaceReviewEntryInput,
} from './workspaceReviewReport.js';
import {
  workspaceError,
  workspaceWidgetTabOrderItemSchema,
  workspaceMemorySummarySchema,
  type WorkspaceWidgetProjection,
  type WorkspaceErrorEnvelope,
  type WorkspaceReviewSummary,
  type WorkspaceSnapshot,
} from '../workspace-contract/workspace-contract.js';
import { isSafeWorkspaceDirectoryName } from '../workspace-contract/workspace-name.js';
import { readBoundedJsonNoFollow } from './workspaceJsonFile.js';
import {
  DEFAULT_REO_COVER_AESTHETIC_SKILL_MD,
  DEFAULT_REO_COVER_IMAGE_SKILL_MD,
  DEFAULT_REO_DOCTOR_SCRIPT_MJS,
  DEFAULT_REO_DOCTOR_SKILL_MD,
  DEFAULT_REO_EDIT_SKILL_MD,
  DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES,
  DEFAULT_REO_GENERATIVE_RUNTIME_SCRIPT_FILES,
  DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD,
  DEFAULT_REO_WORKS_DESIGN_EXAMPLE_FILES,
  DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES,
  DEFAULT_REO_WORKS_DESIGN_SKILL_MD,
  DEFAULT_REO_WORKS_REFERENCE_FILES,
  DEFAULT_REO_WORKS_SKILL_MD,
  DEFAULT_WORKSPACE_AGENTS_MD,
  DEFAULT_WORKSPACE_REO_MD,
} from './workspaceManagedAgentTemplates.js';
export {
  DEFAULT_REO_COVER_AESTHETIC_SKILL_MD,
  DEFAULT_REO_COVER_IMAGE_SKILL_MD,
  DEFAULT_REO_DOCTOR_SCRIPT_MJS,
  DEFAULT_REO_DOCTOR_SKILL_MD,
  DEFAULT_REO_EDIT_SKILL_MD,
  DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES,
  DEFAULT_REO_GENERATIVE_RUNTIME_SCRIPT_FILES,
  DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD,
  DEFAULT_REO_WORKS_DESIGN_EXAMPLE_FILES,
  DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES,
  DEFAULT_REO_WORKS_DESIGN_SKILL_MD,
  DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS,
  DEFAULT_REO_WORKS_REFERENCE_FILES,
  DEFAULT_REO_WORKS_SKILL_MD,
  DEFAULT_WORKSPACE_AGENTS_MD,
  DEFAULT_WORKSPACE_REO_MD,
} from './workspaceManagedAgentTemplates.js';
import {
  readWorkspaceWidgetsFromFileTruth,
  workspaceWidgetOrderFromMetadata,
} from './workspaceWidgets.js';
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
    widgetTabOrder: z.array(workspaceWidgetTabOrderItemSchema).optional(),
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

function snapshotFrom(
  metadata: WorkspaceMetadata,
  index: WorkspaceIndex,
  review?: WorkspaceReviewSummary,
  widgets: readonly WorkspaceWidgetProjection[] = []
): WorkspaceSnapshot {
  return {
    workspaceId: metadata.workspaceId,
    title: metadata.title,
    description: metadata.description,
    memories: index.memories,
    ...(widgets.length > 0 ? { widgets: [...widgets] } : {}),
    ...(review ? { review } : {}),
  };
}

async function readSnapshotWidgets({
  canonicalRoot,
  metadata,
}: {
  readonly canonicalRoot: string;
  readonly metadata: WorkspaceMetadata;
}): Promise<{
  readonly widgets: readonly WorkspaceWidgetProjection[];
  readonly reviewEntries: readonly WorkspaceReviewEntryInput[];
}> {
  return readWorkspaceWidgetsFromFileTruth({
    widgetTabOrder: workspaceWidgetOrderFromMetadata(metadata),
    rootPath: canonicalRoot,
    workspaceId: metadata.workspaceId,
  });
}

type WorkspaceFileTruthConvergenceMode = 'workspace-open' | 'file-truth-refresh';

async function convergeWorkspaceSnapshotFromFileTruth({
  canonicalRoot,
  metadata,
  mode,
  assertWorkspaceUsable: assertUsable,
}: {
  readonly canonicalRoot: string;
  readonly metadata: WorkspaceMetadata;
  readonly mode: WorkspaceFileTruthConvergenceMode;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<WorkspaceSnapshot> {
  let snapshotMetadata = metadata;
  const repairTitleMirrorBeforeReadModel = mode === 'file-truth-refresh';
  const repairTitleMirrorAfterIndexReconciliation = mode === 'workspace-open';
  const passiveTiptapSidecarReconcile = mode === 'file-truth-refresh';

  const repairTitleMirror = async (): Promise<void> => {
    snapshotMetadata = await repairWorkspaceTitleMetadataMirror({
      canonicalRoot,
      metadata: snapshotMetadata,
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
    });
  };

  if (repairTitleMirrorBeforeReadModel) {
    await repairTitleMirror();
  }

  const readModel = await rebuildWorkspaceReadModel(canonicalRoot, {
    ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
    ...(passiveTiptapSidecarReconcile ? { passiveTiptapSidecarReconcile } : {}),
  });
  assertWorkspaceUsable(assertUsable);

  const index = await readOrRebuildIndex(canonicalRoot, {
    assertBeforePersist: async () => {
      assertWorkspaceUsable(assertUsable);
      await readModel.assertMemoriesRootCurrent();
    },
    rebuiltMemories: readModel.memories,
  });

  if (repairTitleMirrorAfterIndexReconciliation) {
    assertWorkspaceUsable(assertUsable);
    await repairTitleMirror();
    assertWorkspaceUsable(assertUsable);
  }

  const widgets = await readSnapshotWidgets({ canonicalRoot, metadata: snapshotMetadata });
  const review = await writeWorkspaceNeedsReviewReport({
    ...(assertUsable ? { assertUsable: () => assertWorkspaceUsable(assertUsable) } : {}),
    entries: [...readModel.reviewEntries, ...widgets.reviewEntries],
    rootPath: canonicalRoot,
  });
  assertWorkspaceUsable(assertUsable);

  return snapshotFrom(snapshotMetadata, index, review, widgets.widgets);
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
  const writtenMetadata = await writeWorkspaceMetadataPreservingWidgetTabOrder({
    canonicalRoot,
    metadata: nextMetadata,
    ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
  });
  assertWorkspaceUsable(assertUsable);
  return writtenMetadata;
}

async function writeWorkspaceMetadataPreservingWidgetTabOrder({
  canonicalRoot,
  metadata,
  assertWorkspaceUsable: assertUsable,
}: {
  readonly canonicalRoot: string;
  readonly metadata: WorkspaceMetadata;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<WorkspaceMetadata> {
  assertWorkspaceUsable(assertUsable);
  const latestMetadata = await readMetadata(canonicalRoot);
  const metadataToWrite =
    latestMetadata?.widgetTabOrder === undefined
      ? metadata
      : { ...metadata, widgetTabOrder: latestMetadata.widgetTabOrder };
  await writeWorkspaceJsonAtomic(getWorkspaceMetadataPath(canonicalRoot), metadataToWrite, () =>
    assertWorkspaceUsable(assertUsable)
  );
  return metadataToWrite;
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
    const memoryCover = memory.cover ?? { source: 'default' };
    const otherCover = other?.cover ?? { source: 'default' };
    return (
      other !== undefined &&
      memory.memoryId === other.memoryId &&
      memory.title === other.title &&
      memory.createdAt === other.createdAt &&
      memory.updatedAt === other.updatedAt &&
      memory.segmentCount === other.segmentCount &&
      memory.audioSegmentCount === other.audioSegmentCount &&
      memory.noteSegmentCount === other.noteSegmentCount &&
      memory.artifactSegmentCount === other.artifactSegmentCount &&
      memory.audioDurationMs === other.audioDurationMs &&
      memory.audioByteLength === other.audioByteLength &&
      memory.hasAudioTranscript === other.hasAudioTranscript &&
      memory.hasAnyNote === other.hasAnyNote &&
      memory.supplementCount === other.supplementCount &&
      memoryCover.source === otherCover.source &&
      ((memoryCover.source === 'default' &&
        otherCover.source === 'default' &&
        memoryCover.templateId === otherCover.templateId) ||
        (memoryCover.source === 'custom' &&
          otherCover.source === 'custom' &&
          memoryCover.filename === otherCover.filename &&
          memoryCover.version === otherCover.version))
    );
  });
}

type ManagedTextFileState =
  | { readonly kind: 'missing' }
  | { readonly kind: 'file'; readonly text: string }
  | { readonly kind: 'replace-existing' };

async function readManagedTextFileState(filePath: string): Promise<ManagedTextFileState> {
  let file: Awaited<ReturnType<typeof open>> | null = null;
  try {
    file = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stats = await file.stat();
    if (!stats.isFile()) {
      return { kind: 'replace-existing' };
    }
    return { kind: 'file', text: await file.readFile('utf8') };
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : undefined;
    if (code === 'ENOENT') {
      return { kind: 'missing' };
    }
    if (code === 'ELOOP' || code === 'EISDIR') {
      return { kind: 'replace-existing' };
    }
    throw error;
  } finally {
    await file?.close();
  }
}

async function ensureManagedDirectory(
  directoryPath: string,
  assertUsable: AssertWorkspaceUsable | undefined,
  options: { readonly replaceExisting?: boolean } = {}
): Promise<void> {
  try {
    const stats = await lstat(directoryPath);
    if (!stats.isDirectory()) {
      if (!options.replaceExisting) {
        throw new Error('Managed Reo config path is not a directory');
      }
      assertWorkspaceUsable(assertUsable);
      await rm(directoryPath, { force: true, recursive: true });
      await mkdir(directoryPath);
      assertWorkspaceUsable(assertUsable);
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      assertWorkspaceUsable(assertUsable);
      await mkdir(directoryPath);
      assertWorkspaceUsable(assertUsable);
      return;
    }
    throw error;
  }
}

async function writeManagedFileIfChanged({
  filePath,
  current,
  next,
  assertUsable,
}: {
  readonly filePath: string;
  readonly current: ManagedTextFileState;
  readonly next: string;
  readonly assertUsable: AssertWorkspaceUsable | undefined;
}): Promise<void> {
  if (current.kind === 'file' && current.text === next) {
    return;
  }
  assertWorkspaceUsable(assertUsable);
  if (current.kind === 'replace-existing') {
    await rm(filePath, { force: true, recursive: true });
  }
  if (current.kind === 'missing' || current.kind === 'replace-existing') {
    await writeWorkspaceFileNoReplaceAtomic(filePath, next, () =>
      assertWorkspaceUsable(assertUsable)
    );
  } else {
    await writeWorkspaceFileAtomic(filePath, next, () => assertWorkspaceUsable(assertUsable));
  }
  assertWorkspaceUsable(assertUsable);
}

async function createRootAgentsEntryIfMissing(
  canonicalRoot: string,
  assertUsable: AssertWorkspaceUsable | undefined
): Promise<void> {
  const agentsPath = path.join(canonicalRoot, 'AGENTS.md');
  try {
    await lstat(agentsPath);
    return;
  } catch (error) {
    if (
      !(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')
    ) {
      throw error;
    }
  }
  assertWorkspaceUsable(assertUsable);
  await writeWorkspaceFileNoReplaceAtomic(agentsPath, DEFAULT_WORKSPACE_AGENTS_MD, () =>
    assertWorkspaceUsable(assertUsable)
  );
  assertWorkspaceUsable(assertUsable);
}

async function writeManagedReferenceFiles(
  directoryPath: string,
  files: Readonly<Record<string, string>>,
  assertUsable: AssertWorkspaceUsable | undefined
): Promise<void> {
  for (const [filename, next] of Object.entries(files)) {
    const filePath = path.join(directoryPath, filename);
    const current = await readManagedTextFileState(filePath);
    await writeManagedFileIfChanged({ filePath, current, next, assertUsable });
  }
}

async function removeManagedLeafFileIfPresent(
  filePath: string,
  assertUsable: AssertWorkspaceUsable | undefined
): Promise<void> {
  try {
    const stats = await lstat(filePath);
    if (stats.isDirectory()) {
      return;
    }
    assertWorkspaceUsable(assertUsable);
    await rm(filePath, { force: true });
    assertWorkspaceUsable(assertUsable);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

async function ensureWorkspaceManagedAgentConfig(
  canonicalRoot: string,
  assertUsable: AssertWorkspaceUsable | undefined,
  options: { readonly createRootAgentsEntry?: boolean } = {}
): Promise<void> {
  if (options.createRootAgentsEntry) {
    await createRootAgentsEntryIfMissing(canonicalRoot, assertUsable);
  }
  const reoEntryPath = path.join(canonicalRoot, '.reo', 'REO.md');
  const currentReoEntry = await readManagedTextFileState(reoEntryPath);
  const skillsDirectory = path.join(canonicalRoot, 'skills');
  const editDirectory = path.join(skillsDirectory, 'reo-edit');
  const doctorDirectory = path.join(skillsDirectory, 'reo-doctor');
  const coverImageDirectory = path.join(skillsDirectory, 'reo-cover-image');
  const coverAestheticDirectory = path.join(skillsDirectory, 'reo-cover-aesthetic');
  const runtimeDirectory = path.join(skillsDirectory, 'reo-generative-runtime');
  const worksDirectory = path.join(skillsDirectory, 'reo-works');
  const worksDesignDirectory = path.join(skillsDirectory, 'reo-works-design');
  const runtimeReferencesDirectory = path.join(runtimeDirectory, 'references');
  const runtimeScriptsDirectory = path.join(runtimeDirectory, 'scripts');
  const worksReferencesDirectory = path.join(worksDirectory, 'references');
  const worksDesignReferencesDirectory = path.join(worksDesignDirectory, 'references');
  const worksDesignExamplesDirectory = path.join(worksDesignDirectory, 'examples');
  const scriptsDirectory = path.join(doctorDirectory, 'scripts');
  await ensureManagedDirectory(skillsDirectory, assertUsable);
  await ensureManagedDirectory(editDirectory, assertUsable, { replaceExisting: true });
  await ensureManagedDirectory(doctorDirectory, assertUsable, { replaceExisting: true });
  await ensureManagedDirectory(coverImageDirectory, assertUsable, { replaceExisting: true });
  await ensureManagedDirectory(coverAestheticDirectory, assertUsable, { replaceExisting: true });
  await ensureManagedDirectory(runtimeDirectory, assertUsable, { replaceExisting: true });
  await ensureManagedDirectory(worksDirectory, assertUsable, { replaceExisting: true });
  await ensureManagedDirectory(worksDesignDirectory, assertUsable, { replaceExisting: true });
  await ensureManagedDirectory(runtimeReferencesDirectory, assertUsable, { replaceExisting: true });
  await ensureManagedDirectory(runtimeScriptsDirectory, assertUsable, { replaceExisting: true });
  await ensureManagedDirectory(worksReferencesDirectory, assertUsable, { replaceExisting: true });
  await ensureManagedDirectory(worksDesignReferencesDirectory, assertUsable, {
    replaceExisting: true,
  });
  await ensureManagedDirectory(worksDesignExamplesDirectory, assertUsable, {
    replaceExisting: true,
  });
  await ensureManagedDirectory(scriptsDirectory, assertUsable, { replaceExisting: true });

  const editSkillPath = path.join(editDirectory, 'SKILL.md');
  const currentEditSkill = await readManagedTextFileState(editSkillPath);
  const coverImageSkillPath = path.join(coverImageDirectory, 'SKILL.md');
  const currentCoverImageSkill = await readManagedTextFileState(coverImageSkillPath);
  const coverAestheticSkillPath = path.join(coverAestheticDirectory, 'SKILL.md');
  const currentCoverAestheticSkill = await readManagedTextFileState(coverAestheticSkillPath);
  const runtimeSkillPath = path.join(runtimeDirectory, 'SKILL.md');
  const currentRuntimeSkill = await readManagedTextFileState(runtimeSkillPath);
  const worksSkillPath = path.join(worksDirectory, 'SKILL.md');
  const currentWorksSkill = await readManagedTextFileState(worksSkillPath);
  const worksDesignSkillPath = path.join(worksDesignDirectory, 'SKILL.md');
  const currentWorksDesignSkill = await readManagedTextFileState(worksDesignSkillPath);
  const skillPath = path.join(doctorDirectory, 'SKILL.md');
  const currentDoctorSkill = await readManagedTextFileState(skillPath);
  const scriptPath = path.join(scriptsDirectory, 'reo-doctor.mjs');
  const currentDoctorScript = await readManagedTextFileState(scriptPath);

  await writeManagedFileIfChanged({
    filePath: reoEntryPath,
    current: currentReoEntry,
    next: DEFAULT_WORKSPACE_REO_MD,
    assertUsable,
  });
  await writeManagedFileIfChanged({
    filePath: editSkillPath,
    current: currentEditSkill,
    next: DEFAULT_REO_EDIT_SKILL_MD,
    assertUsable,
  });
  await writeManagedFileIfChanged({
    filePath: coverImageSkillPath,
    current: currentCoverImageSkill,
    next: DEFAULT_REO_COVER_IMAGE_SKILL_MD,
    assertUsable,
  });
  await writeManagedFileIfChanged({
    filePath: coverAestheticSkillPath,
    current: currentCoverAestheticSkill,
    next: DEFAULT_REO_COVER_AESTHETIC_SKILL_MD,
    assertUsable,
  });
  await writeManagedFileIfChanged({
    filePath: runtimeSkillPath,
    current: currentRuntimeSkill,
    next: DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD,
    assertUsable,
  });
  await writeManagedFileIfChanged({
    filePath: worksSkillPath,
    current: currentWorksSkill,
    next: DEFAULT_REO_WORKS_SKILL_MD,
    assertUsable,
  });
  await writeManagedFileIfChanged({
    filePath: worksDesignSkillPath,
    current: currentWorksDesignSkill,
    next: DEFAULT_REO_WORKS_DESIGN_SKILL_MD,
    assertUsable,
  });
  await writeManagedReferenceFiles(
    runtimeReferencesDirectory,
    DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES,
    assertUsable
  );
  await writeManagedReferenceFiles(
    runtimeScriptsDirectory,
    DEFAULT_REO_GENERATIVE_RUNTIME_SCRIPT_FILES,
    assertUsable
  );
  await removeManagedLeafFileIfPresent(
    path.join(runtimeScriptsDirectory, 'migrate-runtime.mjs'),
    assertUsable
  );
  await writeManagedReferenceFiles(
    worksReferencesDirectory,
    DEFAULT_REO_WORKS_REFERENCE_FILES,
    assertUsable
  );
  await removeManagedLeafFileIfPresent(
    path.join(worksReferencesDirectory, 'quality-check.md'),
    assertUsable
  );
  await writeManagedReferenceFiles(
    worksDesignReferencesDirectory,
    DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES,
    assertUsable
  );
  await writeManagedReferenceFiles(
    worksDesignExamplesDirectory,
    DEFAULT_REO_WORKS_DESIGN_EXAMPLE_FILES,
    assertUsable
  );

  await writeManagedFileIfChanged({
    filePath: skillPath,
    current: currentDoctorSkill,
    next: DEFAULT_REO_DOCTOR_SKILL_MD,
    assertUsable,
  });
  await writeManagedFileIfChanged({
    filePath: scriptPath,
    current: currentDoctorScript,
    next: DEFAULT_REO_DOCTOR_SCRIPT_MJS,
    assertUsable,
  });
}

export async function validateWorkspaceInitializeTarget(
  rootPath: string
): Promise<WorkspaceInitializeTarget> {
  const canonicalRoot = await resolveWorkspaceRoot(rootPath);
  if (typeof canonicalRoot !== 'string') {
    return canonicalRoot;
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
  const widgetsDirectory = await checkWorkspaceWidgetsDirectory(canonicalRoot);
  if (typeof widgetsDirectory !== 'string') {
    return widgetsDirectory;
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
  const widgetsDirectory = await checkWorkspaceWidgetsDirectory(canonicalRoot);
  if (typeof widgetsDirectory !== 'string') {
    return widgetsDirectory;
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
    const widgetsDirectory = await ensureWorkspaceWidgetsDirectory(canonicalRoot, assertUsable);
    if (typeof widgetsDirectory !== 'string') {
      return widgetsDirectory;
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
    await ensureWorkspaceManagedAgentConfig(canonicalRoot, assertUsable, {
      createRootAgentsEntry: true,
    });
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
    snapshot: snapshotFrom(metadata, index, undefined, []),
  };
}

export async function openWorkspaceFiles({
  rootPath,
  assertWorkspaceUsable: assertUsable,
}: OpenWorkspaceFilesOptions): Promise<WorkspaceFilesResult> {
  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceOpenTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }
    const canonicalRoot = target.canonicalRoot;
    const metadata = target.metadata;
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
    const widgetsDirectory = await ensureWorkspaceWidgetsDirectory(canonicalRoot, assertUsable);
    if (typeof widgetsDirectory !== 'string') {
      return widgetsDirectory;
    }
    assertWorkspaceUsable(assertUsable);
    await ensureWorkspaceManagedAgentConfig(canonicalRoot, assertUsable);
    assertWorkspaceUsable(assertUsable);
    await recoverRecordingFinalizeTransactions(canonicalRoot, {
      assertWorkspaceUsable: () => assertWorkspaceUsable(assertUsable),
    });
    assertWorkspaceUsable(assertUsable);
    const snapshot = await convergeWorkspaceSnapshotFromFileTruth({
      canonicalRoot,
      metadata,
      mode: 'workspace-open',
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
    });
    return {
      ok: true,
      snapshot,
    };
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
      await writeWorkspaceMetadataPreservingWidgetTabOrder({
        canonicalRoot: nextCanonicalRoot,
        metadata: nextMetadata,
        ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
      });
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

    const widgets = await readSnapshotWidgets({
      canonicalRoot: nextCanonicalRoot,
      metadata: nextMetadata,
    });
    return {
      ok: true,
      canonicalRoot: nextCanonicalRoot,
      snapshot: snapshotFrom(nextMetadata, index, undefined, widgets.widgets),
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
    const metadata = target.metadata;
    assertWorkspaceUsable(assertUsable);
    if (metadata.workspaceId !== workspaceId) {
      return workspaceError(
        'ERR_WORKSPACE_METADATA_INVALID',
        'Workspace metadata is invalid',
        'previous-file-preserved'
      );
    }

    const snapshot = await convergeWorkspaceSnapshotFromFileTruth({
      canonicalRoot,
      metadata,
      mode: 'file-truth-refresh',
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
    });
    return {
      ok: true,
      snapshot,
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
    const widgets = await readSnapshotWidgets({ canonicalRoot, metadata });
    return {
      ok: true,
      snapshot: snapshotFrom(metadata, index, undefined, widgets.widgets),
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

import { lstat, opendir, rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  writeWorkspaceFileNoReplaceAtomic,
  writeWorkspaceJsonAtomic,
} from './atomicWorkspaceFile.js';
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
import { readBoundedJsonNoFollow } from './workspaceJsonFile.js';

const WORKSPACE_SCHEMA_VERSION = 1;
const MAX_WORKSPACE_JSON_BYTES = 1_048_576;
const EMPTY_WORKSPACE_IGNORED_ENTRIES = new Set(['.DS_Store']);
const EMPTY_WORKSPACE_LOCK_REO_ENTRIES = new Set(['workspace.lock', 'workspace.lock.lock']);

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

interface UpdateWorkspaceTitleOptions {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly title: string;
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

export type WorkspaceInitializeTarget =
  | {
      readonly ok: true;
      readonly canonicalRoot: string;
    }
  | WorkspaceErrorEnvelope;

export type WorkspaceOpenTarget =
  | {
      readonly ok: true;
      readonly kind: 'existing' | 'empty';
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

function snapshotFrom(
  metadata: z.infer<typeof workspaceMetadataSchema>,
  index: z.infer<typeof workspaceIndexSchema>
): WorkspaceSnapshot {
  return {
    workspaceId: metadata.workspaceId,
    title: metadata.title,
    description: metadata.description,
    memories: index.memories,
  };
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
      memory.durationMs === other.durationMs &&
      memory.audioByteLength === other.audioByteLength &&
      memory.hasTranscript === other.hasTranscript &&
      memory.attachmentCount === other.attachmentCount
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

async function readMetadata(
  canonicalRoot: string
): Promise<z.infer<typeof workspaceMetadataSchema> | null> {
  return readWorkspaceJsonNoFollow(
    getWorkspaceMetadataPath(canonicalRoot),
    workspaceMetadataSchema
  );
}

async function validateWorkspaceOpenCanonicalTarget(
  canonicalRoot: string
): Promise<WorkspaceInitializeTarget> {
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

  return { ok: true, canonicalRoot };
}

export async function validateWorkspaceOpenTarget(
  rootPath: string
): Promise<WorkspaceInitializeTarget> {
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

  const metadata = await readMetadata(target.canonicalRoot);
  if (!metadata || metadata.workspaceId !== workspaceId) {
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
): Promise<z.infer<typeof workspaceIndexSchema>> {
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
    memories = [
      ...(await replaceWorkspaceIndex(
        canonicalRoot,
        async () => rebuildMemoryIndex(canonicalRoot, { persist: false }),
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
  let index: z.infer<typeof workspaceIndexSchema>;
  let metadata: z.infer<typeof workspaceMetadataSchema>;
  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceOpenTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }
    const { canonicalRoot } = target;

    const parsedMetadata = await readMetadata(canonicalRoot);
    assertWorkspaceUsable(assertUsable);
    if (!parsedMetadata) {
      return workspaceError(
        'ERR_WORKSPACE_METADATA_INVALID',
        'Workspace metadata is invalid',
        'none-written'
      );
    }
    metadata = parsedMetadata;
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

export async function updateWorkspaceTitleFromFileTruth({
  rootPath,
  workspaceId,
  title,
  assertWorkspaceUsable: assertUsable,
}: UpdateWorkspaceTitleOptions): Promise<WorkspaceFilesResult> {
  try {
    assertWorkspaceUsable(assertUsable);
    const target = await validateWorkspaceOpenTarget(rootPath);
    if (!target.ok) {
      assertWorkspaceUsable(assertUsable);
      return target;
    }
    const { canonicalRoot } = target;
    const metadata = await readMetadata(canonicalRoot);
    assertWorkspaceUsable(assertUsable);
    if (!metadata || metadata.workspaceId !== workspaceId) {
      return workspaceError(
        'ERR_WORKSPACE_METADATA_INVALID',
        'Workspace metadata is invalid',
        'previous-file-preserved'
      );
    }
    const index = await readOrRebuildIndex(canonicalRoot, {
      assertBeforePersist: async () => assertWorkspaceUsable(assertUsable),
    });
    assertWorkspaceUsable(assertUsable);
    const nextMetadata = { ...metadata, title };
    await writeWorkspaceJsonAtomic(getWorkspaceMetadataPath(canonicalRoot), nextMetadata, () =>
      assertWorkspaceUsable(assertUsable)
    );
    assertWorkspaceUsable(assertUsable);
    return {
      ok: true,
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
    const metadata = await readMetadata(canonicalRoot);
    assertWorkspaceUsable(assertUsable);
    if (!metadata || metadata.workspaceId !== workspaceId) {
      return workspaceError(
        'ERR_WORKSPACE_METADATA_INVALID',
        'Workspace metadata is invalid',
        'previous-file-preserved'
      );
    }

    const readModel = await rebuildWorkspaceReadModel(canonicalRoot);
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

import { lstat, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';
import { createMemoryFromFileTruth } from './memoryFiles.js';
import {
  initializeWorkspaceFiles,
  openWorkspaceFiles,
  readWorkspaceSnapshotFromFileTruth,
} from './workspaceFiles.js';
import { readBoundedJsonNoFollow } from './workspaceJsonFile.js';
import {
  workspaceError,
  type WorkspaceErrorEnvelope,
  type WorkspaceSnapshot,
} from '../workspace-contract/workspace-contract.js';

export const SYSTEM_DRAFT_TITLE = '草稿';
export const SYSTEM_DRAFT_WORKSPACE_ROLE = 'draft-space';
export const SYSTEM_DRAFT_DEFAULT_MEMORY_ROLE = 'draft-default-memory';
export const SYSTEM_DRAFT_WORKSPACE_ID = 'ws_system_draft';
export const SYSTEM_DRAFT_DEFAULT_MEMORY_ID = 'mem_system_draft';

const SYSTEM_DRAFT_STORE_SCHEMA_VERSION = 1;
const SYSTEM_DRAFT_PARENT_DIRECTORY_NAME = 'system-memory-spaces';
const SYSTEM_DRAFT_ROOT_DIRECTORY_NAME = SYSTEM_DRAFT_TITLE;
const SYSTEM_DRAFT_STORE_FILE_NAME = 'system-memory-spaces.json';
const MAX_SYSTEM_DRAFT_STORE_BYTES = 65_536;

const systemDraftWorkspaceStoreSchema = z.strictObject({
  schemaVersion: z.literal(SYSTEM_DRAFT_STORE_SCHEMA_VERSION),
  systemRole: z.literal(SYSTEM_DRAFT_WORKSPACE_ROLE),
  workspaceId: z.literal(SYSTEM_DRAFT_WORKSPACE_ID),
  title: z.literal(SYSTEM_DRAFT_TITLE),
  rootPath: z.string().min(1),
  defaultMemoryId: z.literal(SYSTEM_DRAFT_DEFAULT_MEMORY_ID),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SystemDraftWorkspaceStore = z.infer<typeof systemDraftWorkspaceStoreSchema>;

export type SystemDraftWorkspaceEnsureResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly rootPath: string;
        readonly store: SystemDraftWorkspaceStore;
        readonly snapshot: WorkspaceSnapshot;
      };
    }
  | WorkspaceErrorEnvelope;

export interface EnsureSystemDraftWorkspaceOptions {
  readonly appDataDir: string;
  readonly now: () => string;
}

export function getSystemDraftWorkspaceStorePath(appDataDir: string): string {
  return path.join(appDataDir, SYSTEM_DRAFT_STORE_FILE_NAME);
}

export function getSystemDraftWorkspaceRootPath(appDataDir: string): string {
  return path.join(
    appDataDir,
    SYSTEM_DRAFT_PARENT_DIRECTORY_NAME,
    SYSTEM_DRAFT_ROOT_DIRECTORY_NAME
  );
}

export function isSystemDraftWorkspaceId(workspaceId: string): boolean {
  return workspaceId === SYSTEM_DRAFT_WORKSPACE_ID;
}

export function isSystemDraftDefaultMemoryId(memoryId: string): boolean {
  return memoryId === SYSTEM_DRAFT_DEFAULT_MEMORY_ID;
}

export async function ensureSystemDraftWorkspace({
  appDataDir,
  now,
}: EnsureSystemDraftWorkspaceOptions): Promise<SystemDraftWorkspaceEnsureResult> {
  const rootPath = getSystemDraftWorkspaceRootPath(appDataDir);
  const safeRoot = await ensureSafeDraftRoot(appDataDir, rootPath);
  if (!safeRoot.ok) {
    return safeRoot;
  }

  const storeResult = await readOrCreateSystemDraftStore({
    appDataDir,
    rootPath: safeRoot.canonicalRoot,
    now,
  });
  if (!storeResult.ok) {
    return storeResult;
  }

  const snapshotResult = await openOrInitializeDraftWorkspace({
    rootPath: safeRoot.canonicalRoot,
    now,
  });
  if (!snapshotResult.ok) {
    return snapshotResult;
  }

  const finalSnapshot = await ensureDefaultDraftMemory({
    rootPath: safeRoot.canonicalRoot,
    snapshot: snapshotResult.snapshot,
    now,
  });
  if (!finalSnapshot.ok) {
    return finalSnapshot;
  }

  return {
    ok: true,
    value: {
      rootPath: safeRoot.canonicalRoot,
      store: storeResult.store,
      snapshot: finalSnapshot.snapshot,
    },
  };
}

async function ensureSafeDraftRoot(
  appDataDir: string,
  rootPath: string
): Promise<{ readonly ok: true; readonly canonicalRoot: string } | WorkspaceErrorEnvelope> {
  const safeAppData = await assertSafeDirectory(appDataDir);
  if (!safeAppData.ok) {
    return safeAppData;
  }

  const parentDirectory = path.dirname(rootPath);
  try {
    await mkdir(parentDirectory, { recursive: true });
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_INIT_FAILED',
      'System Draft workspace root could not be prepared',
      'none-written'
    );
  }

  const safeParent = await assertSafeDirectory(parentDirectory);
  if (!safeParent.ok) {
    return safeParent;
  }

  const existingRoot = await lstat(rootPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  });
  if (existingRoot && (!existingRoot.isDirectory() || existingRoot.isSymbolicLink())) {
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'System Draft workspace root is unsafe');
  }
  if (!existingRoot) {
    try {
      await mkdir(rootPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        return workspaceError(
          'ERR_WORKSPACE_INIT_FAILED',
          'System Draft workspace root could not be prepared',
          'none-written'
        );
      }
    }
  }

  const safeRoot = await assertSafeDirectory(rootPath);
  if (!safeRoot.ok) {
    return safeRoot;
  }
  const appDataRealPath = await realpath(appDataDir);
  const rootRealPath = await realpath(rootPath);
  const relative = path.relative(appDataRealPath, rootRealPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'System Draft workspace root is unsafe');
  }
  return { ok: true, canonicalRoot: rootRealPath };
}

async function assertSafeDirectory(
  directoryPath: string
): Promise<{ readonly ok: true } | WorkspaceErrorEnvelope> {
  try {
    const entry = await lstat(directoryPath);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'System Draft directory is unsafe');
    }
    return { ok: true };
  } catch {
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'System Draft directory is unsafe');
  }
}

async function readOrCreateSystemDraftStore({
  appDataDir,
  rootPath,
  now,
}: {
  readonly appDataDir: string;
  readonly rootPath: string;
  readonly now: () => string;
}): Promise<
  | {
      readonly ok: true;
      readonly store: SystemDraftWorkspaceStore;
    }
  | WorkspaceErrorEnvelope
> {
  const storePath = getSystemDraftWorkspaceStorePath(appDataDir);
  const read = await readBoundedJsonNoFollow({
    filePath: storePath,
    maxBytes: MAX_SYSTEM_DRAFT_STORE_BYTES,
    schema: systemDraftWorkspaceStoreSchema,
  });

  if (read.status === 'read-error') {
    return workspaceError(
      'ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_READ_FAILED',
      'System Draft store could not be read',
      'previous-file-preserved'
    );
  }

  if (read.status === 'ok' && read.value.rootPath === rootPath) {
    return { ok: true, store: read.value };
  }

  const timestamp = now();
  const store: SystemDraftWorkspaceStore =
    read.status === 'ok'
      ? {
          ...read.value,
          rootPath,
          updatedAt: timestamp,
        }
      : {
          schemaVersion: SYSTEM_DRAFT_STORE_SCHEMA_VERSION,
          systemRole: SYSTEM_DRAFT_WORKSPACE_ROLE,
          workspaceId: SYSTEM_DRAFT_WORKSPACE_ID,
          title: SYSTEM_DRAFT_TITLE,
          rootPath,
          defaultMemoryId: SYSTEM_DRAFT_DEFAULT_MEMORY_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

  try {
    await writeWorkspaceJsonAtomic(storePath, store);
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_WRITE_FAILED',
      'System Draft store could not be written',
      'previous-file-preserved'
    );
  }

  return { ok: true, store };
}

async function openOrInitializeDraftWorkspace({
  rootPath,
  now,
}: {
  readonly rootPath: string;
  readonly now: () => string;
}): Promise<{ readonly ok: true; readonly snapshot: WorkspaceSnapshot } | WorkspaceErrorEnvelope> {
  const hasMetadata = await hasWorkspaceMetadata(rootPath);
  if (!hasMetadata.ok) {
    return hasMetadata;
  }

  const result = hasMetadata.exists
    ? await openWorkspaceFiles({ rootPath })
    : await initializeWorkspaceFiles({
        rootPath,
        title: SYSTEM_DRAFT_TITLE,
        description: '',
        createWorkspaceId: () => SYSTEM_DRAFT_WORKSPACE_ID,
        now,
      });

  return result.ok ? { ok: true, snapshot: result.snapshot } : result;
}

async function hasWorkspaceMetadata(rootPath: string): Promise<
  | {
      readonly ok: true;
      readonly exists: boolean;
    }
  | WorkspaceErrorEnvelope
> {
  const metadataPath = path.join(rootPath, '.reo', 'workspace.json');
  const metadata = await lstat(metadataPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  });
  if (!metadata) {
    return { ok: true, exists: false };
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'System Draft workspace metadata is unsafe');
  }
  return { ok: true, exists: true };
}

async function ensureDefaultDraftMemory({
  rootPath,
  snapshot,
  now,
}: {
  readonly rootPath: string;
  readonly snapshot: WorkspaceSnapshot;
  readonly now: () => string;
}): Promise<{ readonly ok: true; readonly snapshot: WorkspaceSnapshot } | WorkspaceErrorEnvelope> {
  const existing = snapshot.memories.find(
    (memory) => memory.memoryId === SYSTEM_DRAFT_DEFAULT_MEMORY_ID
  );
  if (existing) {
    return { ok: true, snapshot };
  }

  const created = await createMemoryFromFileTruth({
    rootPath,
    memoryId: SYSTEM_DRAFT_DEFAULT_MEMORY_ID,
    title: SYSTEM_DRAFT_TITLE,
    now,
  });
  if (!created.ok) {
    return created;
  }

  const updated = await readWorkspaceSnapshotFromFileTruth({
    rootPath,
    workspaceId: SYSTEM_DRAFT_WORKSPACE_ID,
  });
  return updated.ok ? { ok: true, snapshot: updated.snapshot } : updated;
}

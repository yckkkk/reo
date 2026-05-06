import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';
import {
  getWorkspaceIndexPath,
  getWorkspaceMetadataPath,
  resolveWorkspaceRoot,
} from './workspacePaths.js';
import {
  workspaceError,
  type WorkspaceErrorEnvelope,
  type WorkspaceSnapshot,
} from './workspaceContract.js';

const WORKSPACE_SCHEMA_VERSION = 1;

const workspaceMetadataSchema = z.object({
  schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
  workspaceId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  createdAt: z.string(),
});

const workspaceIndexSchema = z.object({
  schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
  recordings: z.array(
    z.object({
      recordingId: z.string(),
      title: z.string(),
      audioByteLength: z.number().int().nonnegative(),
    })
  ),
});

interface InitializeWorkspaceFilesOptions {
  readonly rootPath: string;
  readonly title: string;
  readonly description: string;
  readonly createWorkspaceId: () => string;
  readonly now: () => string;
}

interface OpenWorkspaceFilesOptions {
  readonly rootPath: string;
}

type WorkspaceFilesResult =
  | {
      readonly ok: true;
      readonly snapshot: WorkspaceSnapshot;
    }
  | WorkspaceErrorEnvelope;

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
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
    recordings: index.recordings,
  };
}

async function readMetadata(
  canonicalRoot: string
): Promise<z.infer<typeof workspaceMetadataSchema> | null> {
  try {
    return workspaceMetadataSchema.parse(
      JSON.parse(await readFile(getWorkspaceMetadataPath(canonicalRoot), 'utf8'))
    );
  } catch {
    return null;
  }
}

async function readOrRebuildIndex(
  canonicalRoot: string
): Promise<z.infer<typeof workspaceIndexSchema>> {
  try {
    return workspaceIndexSchema.parse(
      JSON.parse(await readFile(getWorkspaceIndexPath(canonicalRoot), 'utf8'))
    );
  } catch {
    const index = {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      recordings: [],
    } satisfies z.infer<typeof workspaceIndexSchema>;
    await writeWorkspaceJsonAtomic(getWorkspaceIndexPath(canonicalRoot), index);
    return index;
  }
}

export async function initializeWorkspaceFiles({
  rootPath,
  title,
  description,
  createWorkspaceId,
  now,
}: InitializeWorkspaceFilesOptions): Promise<WorkspaceFilesResult> {
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

  const metadata = {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspaceId: createWorkspaceId(),
    title,
    description,
    createdAt: now(),
  } satisfies z.infer<typeof workspaceMetadataSchema>;
  const index = {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    recordings: [],
  } satisfies z.infer<typeof workspaceIndexSchema>;

  await mkdir(path.join(canonicalRoot, '.reo'), { recursive: true });
  await mkdir(path.join(canonicalRoot, 'recordings'), { recursive: true });
  await writeFile(
    path.join(canonicalRoot, 'AGENTS.md'),
    '# Reo workspace\n\n本文件是 Reo workspace 的 AI 协作入口。\n',
    { flag: 'wx' }
  );
  await writeWorkspaceJsonAtomic(getWorkspaceMetadataPath(canonicalRoot), metadata);
  await writeWorkspaceJsonAtomic(getWorkspaceIndexPath(canonicalRoot), index);

  return {
    ok: true,
    snapshot: snapshotFrom(metadata, index),
  };
}

export async function openWorkspaceFiles({
  rootPath,
}: OpenWorkspaceFilesOptions): Promise<WorkspaceFilesResult> {
  const canonicalRoot = await resolveWorkspaceRoot(rootPath);
  if (typeof canonicalRoot !== 'string') {
    return canonicalRoot;
  }

  const metadata = await readMetadata(canonicalRoot);
  if (!metadata) {
    return workspaceError(
      'ERR_WORKSPACE_METADATA_INVALID',
      'Workspace metadata is invalid',
      'none-written'
    );
  }

  const index = await readOrRebuildIndex(canonicalRoot);
  return {
    ok: true,
    snapshot: snapshotFrom(metadata, index),
  };
}

export async function updateWorkspaceIndex(
  rootPath: string,
  update: (recordings: WorkspaceSnapshot['recordings']) => WorkspaceSnapshot['recordings']
): Promise<void> {
  const current = await readOrRebuildIndex(rootPath);
  await writeWorkspaceJsonAtomic(getWorkspaceIndexPath(rootPath), {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    recordings: update(current.recordings),
  });
}

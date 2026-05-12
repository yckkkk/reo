import { lstat, mkdir, opendir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';
import {
  workspaceMemorySpaceSchema,
  type WorkspaceSnapshot,
} from '../workspace-contract/workspace-contract.js';
import { readBoundedJsonNoFollow } from './workspaceJsonFile.js';

const MEMORY_SPACE_REGISTRY_VERSION = 1;
const MAX_REGISTRY_BYTES = 1_048_576;
const MAX_REGISTRY_MEMORY_SPACES = 100;
const MAX_REGISTRY_TEXT_LENGTH = 4096;
const MAX_REGISTRY_ROOT_PATH_LENGTH = 4096;
const MAX_RENAMED_ROOT_SIBLING_SCAN = 200;

const workspaceMetadataSchema = z
  .object({
    schemaVersion: z.literal(1),
    workspaceId: z.string().min(1),
    title: z.string(),
    description: z.string(),
    createdAt: z.string(),
  })
  .strict();

const workspaceMemorySpaceRegistryEntrySchema = workspaceMemorySpaceSchema
  .extend({
    title: z.string().max(MAX_REGISTRY_TEXT_LENGTH),
    description: z.string().max(MAX_REGISTRY_TEXT_LENGTH),
    rootPath: z
      .string()
      .min(1)
      .max(MAX_REGISTRY_ROOT_PATH_LENGTH)
      .refine((value) => path.isAbsolute(value)),
  })
  .strict();

const workspaceMemorySpaceRegistrySchema = z
  .object({
    schemaVersion: z.literal(MEMORY_SPACE_REGISTRY_VERSION),
    memorySpaces: z.array(workspaceMemorySpaceRegistryEntrySchema),
  })
  .strict();

type WorkspaceMemorySpaceRegistryFile = z.infer<typeof workspaceMemorySpaceRegistrySchema>;
type WorkspaceMemorySpaceRegistryEntry = z.infer<typeof workspaceMemorySpaceRegistryEntrySchema>;
type WorkspaceMetadata = z.infer<typeof workspaceMetadataSchema>;

export type WorkspaceMemorySpace = Omit<WorkspaceMemorySpaceRegistryEntry, 'rootPath'>;
export type WorkspaceMemorySpaceWithRoot = WorkspaceMemorySpaceRegistryEntry;

export interface WorkspaceMemorySpaceRegistry {
  readonly listMemorySpaces: () => Promise<readonly WorkspaceMemorySpace[]>;
  readonly resolveMemorySpace: (
    workspaceId: string
  ) => Promise<WorkspaceMemorySpaceWithRoot | null>;
  readonly resolveMemorySpaceRoot: (workspaceId: string) => Promise<string | null>;
  readonly removeMemorySpace: (workspaceId: string) => Promise<void>;
  readonly updateMemorySpaceSnapshot: (input: {
    readonly canonicalRoot: string;
    readonly snapshot: WorkspaceSnapshot;
  }) => Promise<WorkspaceMemorySpace>;
  readonly upsertMemorySpace: (input: {
    readonly canonicalRoot: string;
    readonly snapshot: WorkspaceSnapshot;
  }) => Promise<WorkspaceMemorySpace>;
}

export class WorkspaceMemorySpaceRegistryReadError extends Error {
  constructor() {
    super('Workspace memory space registry could not be read');
  }
}

export function createWorkspaceMemorySpaceRegistry({
  registryPath,
  now = () => new Date().toISOString(),
}: {
  readonly registryPath: string;
  readonly now?: () => string;
}): WorkspaceMemorySpaceRegistry {
  let writeQueue: Promise<void> = Promise.resolve();

  function withRegistryWriteLock<Result>(run: () => Promise<Result>): Promise<Result> {
    const queued = writeQueue.catch(() => {}).then(run);
    writeQueue = queued.then(
      () => {},
      () => {}
    );
    return queued;
  }

  async function readRegistry(): Promise<WorkspaceMemorySpaceRegistryFile> {
    const result = await readBoundedJsonNoFollow({
      filePath: registryPath,
      maxBytes: MAX_REGISTRY_BYTES,
      schema: workspaceMemorySpaceRegistrySchema,
    });
    if (result.status === 'ok') {
      return result.value;
    }
    if (result.status === 'read-error') {
      throw new WorkspaceMemorySpaceRegistryReadError();
    }
    return emptyRegistry();
  }

  async function readWorkspaceMetadata(rootPath: string): Promise<WorkspaceMetadata | null> {
    const result = await readBoundedJsonNoFollow({
      filePath: path.join(rootPath, '.reo', 'workspace.json'),
      maxBytes: MAX_REGISTRY_BYTES,
      schema: workspaceMetadataSchema,
    });
    return result.status === 'ok' ? result.value : null;
  }

  async function writeRegistry(registry: WorkspaceMemorySpaceRegistryFile): Promise<void> {
    const directory = path.dirname(registryPath);
    await mkdir(directory, { recursive: true });
    await writeWorkspaceJsonAtomic(registryPath, registry);
  }

  async function isSafeDirectory(directoryPath: string): Promise<boolean> {
    try {
      const stat = await lstat(directoryPath);
      return stat.isDirectory() && !stat.isSymbolicLink();
    } catch {
      return false;
    }
  }

  async function findSiblingRootByWorkspaceId(
    memorySpace: WorkspaceMemorySpaceRegistryEntry
  ): Promise<string | null> {
    const parentPath = path.dirname(memorySpace.rootPath);
    if (!(await isSafeDirectory(parentPath))) {
      return null;
    }

    try {
      let inspected = 0;
      const parent = await opendir(parentPath);
      try {
        for await (const entry of parent) {
          inspected += 1;
          if (inspected > MAX_RENAMED_ROOT_SIBLING_SCAN) {
            return null;
          }
          if (!entry.isDirectory() || entry.isSymbolicLink()) {
            continue;
          }
          const candidateRoot = path.join(parentPath, entry.name);
          const metadata = await readWorkspaceMetadata(candidateRoot);
          if (metadata?.workspaceId === memorySpace.workspaceId) {
            return await realpath(candidateRoot);
          }
        }
      } finally {
        await parent.close().catch(() => {});
      }
    } catch {
      return null;
    }

    return null;
  }

  async function reconcileMemorySpace(
    memorySpace: WorkspaceMemorySpaceRegistryEntry
  ): Promise<WorkspaceMemorySpaceRegistryEntry> {
    if (await isSafeDirectory(memorySpace.rootPath)) {
      const metadata = await readWorkspaceMetadata(memorySpace.rootPath);
      if (metadata?.workspaceId === memorySpace.workspaceId) {
        return {
          ...memorySpace,
          title: boundedRegistryText(metadata.title),
          description: boundedRegistryText(metadata.description),
        };
      }
      return memorySpace;
    }

    const renamedRoot = await findSiblingRootByWorkspaceId(memorySpace);
    if (!renamedRoot) {
      return memorySpace;
    }

    const nextTitle = boundedRegistryText(path.basename(renamedRoot));
    const metadata = await readWorkspaceMetadata(renamedRoot);
    return {
      ...memorySpace,
      rootPath: renamedRoot,
      title: nextTitle,
      description: boundedRegistryText(metadata?.description ?? memorySpace.description),
    };
  }

  async function resolveMemorySpaceById(
    workspaceId: string
  ): Promise<WorkspaceMemorySpaceWithRoot | null> {
    return withRegistryWriteLock(async () => {
      const registry = await readRegistry();
      const memorySpace =
        registry.memorySpaces.find((candidate) => candidate.workspaceId === workspaceId) ?? null;
      return memorySpace ? reconcileMemorySpace(memorySpace) : null;
    });
  }

  return {
    async listMemorySpaces() {
      const registry = await withRegistryWriteLock(readRegistry);
      return registry.memorySpaces.map(stripRootPath);
    },
    async resolveMemorySpace(workspaceId) {
      return resolveMemorySpaceById(workspaceId);
    },
    async resolveMemorySpaceRoot(workspaceId) {
      return (await resolveMemorySpaceById(workspaceId))?.rootPath ?? null;
    },
    async removeMemorySpace(workspaceId) {
      return withRegistryWriteLock(async () => {
        const registry = await readRegistry();
        const memorySpaces = registry.memorySpaces.filter(
          (memorySpace) => memorySpace.workspaceId !== workspaceId
        );
        if (memorySpaces.length === registry.memorySpaces.length) {
          return;
        }
        await writeRegistry({
          schemaVersion: MEMORY_SPACE_REGISTRY_VERSION,
          memorySpaces,
        });
      });
    },
    async updateMemorySpaceSnapshot({ canonicalRoot, snapshot }) {
      return withRegistryWriteLock(async () => {
        if (canonicalRoot.length > MAX_REGISTRY_ROOT_PATH_LENGTH) {
          throw new Error('Memory space root path is too long');
        }
        const registry = await readRegistry();
        const existingIndex = registry.memorySpaces.findIndex(
          (memorySpace) => memorySpace.workspaceId === snapshot.workspaceId
        );
        const existing = registry.memorySpaces[existingIndex];
        if (!existing) {
          throw new Error('Memory space registry entry was not found');
        }
        const nextMemorySpace: WorkspaceMemorySpaceRegistryEntry = {
          ...existing,
          title: boundedRegistryText(snapshot.title),
          description: boundedRegistryText(snapshot.description),
          rootPath: canonicalRoot,
        };
        const memorySpaces = [...registry.memorySpaces];
        memorySpaces[existingIndex] = nextMemorySpace;
        await writeRegistry({
          schemaVersion: MEMORY_SPACE_REGISTRY_VERSION,
          memorySpaces,
        });
        return stripRootPath(nextMemorySpace);
      });
    },
    async upsertMemorySpace({ canonicalRoot, snapshot }) {
      return withRegistryWriteLock(async () => {
        if (canonicalRoot.length > MAX_REGISTRY_ROOT_PATH_LENGTH) {
          throw new Error('Memory space root path is too long');
        }
        const registry = await readRegistry();
        const currentTime = now();
        const existing = registry.memorySpaces.find(
          (memorySpace) => memorySpace.workspaceId === snapshot.workspaceId
        );
        const nextMemorySpace: WorkspaceMemorySpaceRegistryEntry = {
          workspaceId: snapshot.workspaceId,
          title: boundedRegistryText(snapshot.title),
          description: boundedRegistryText(snapshot.description),
          rootPath: canonicalRoot,
          addedAt: existing?.addedAt ?? currentTime,
          lastOpenedAt: currentTime,
        };
        const otherMemorySpaces = registry.memorySpaces.filter(
          (memorySpace) => memorySpace.workspaceId !== snapshot.workspaceId
        );
        await writeRegistry({
          schemaVersion: MEMORY_SPACE_REGISTRY_VERSION,
          memorySpaces: [nextMemorySpace, ...otherMemorySpaces].slice(
            0,
            MAX_REGISTRY_MEMORY_SPACES
          ),
        });
        return stripRootPath(nextMemorySpace);
      });
    },
  };
}

function boundedRegistryText(value: string): string {
  return value.length > MAX_REGISTRY_TEXT_LENGTH ? value.slice(0, MAX_REGISTRY_TEXT_LENGTH) : value;
}

function emptyRegistry(): WorkspaceMemorySpaceRegistryFile {
  return {
    schemaVersion: MEMORY_SPACE_REGISTRY_VERSION,
    memorySpaces: [],
  };
}

function stripRootPath(memorySpace: WorkspaceMemorySpaceRegistryEntry): WorkspaceMemorySpace {
  return {
    workspaceId: memorySpace.workspaceId,
    title: memorySpace.title,
    description: memorySpace.description,
    addedAt: memorySpace.addedAt,
    lastOpenedAt: memorySpace.lastOpenedAt,
  };
}

import { mkdir } from 'node:fs/promises';
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

export type WorkspaceMemorySpace = Omit<WorkspaceMemorySpaceRegistryEntry, 'rootPath'>;

export interface WorkspaceMemorySpaceRegistry {
  readonly listMemorySpaces: () => Promise<readonly WorkspaceMemorySpace[]>;
  readonly resolveMemorySpaceRoot: (workspaceId: string) => Promise<string | null>;
  readonly removeMemorySpace: (workspaceId: string) => Promise<void>;
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

  async function waitForPendingWrite(): Promise<void> {
    await writeQueue.catch(() => {});
  }

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

  async function writeRegistry(registry: WorkspaceMemorySpaceRegistryFile): Promise<void> {
    const directory = path.dirname(registryPath);
    await mkdir(directory, { recursive: true });
    await writeWorkspaceJsonAtomic(registryPath, registry);
  }

  return {
    async listMemorySpaces() {
      await waitForPendingWrite();
      const registry = await readRegistry();
      return registry.memorySpaces.map(stripRootPath);
    },
    async resolveMemorySpaceRoot(workspaceId) {
      await waitForPendingWrite();
      const registry = await readRegistry();
      return (
        registry.memorySpaces.find((memorySpace) => memorySpace.workspaceId === workspaceId)
          ?.rootPath ?? null
      );
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

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';
import { workspaceProjectSchema, type WorkspaceSnapshot } from './workspaceContract.js';
import { readBoundedJsonNoFollow } from './workspaceJsonFile.js';

const WORKSPACE_PROJECT_REGISTRY_VERSION = 1;
const MAX_REGISTRY_BYTES = 1_048_576;
const MAX_REGISTRY_PROJECTS = 100;
const MAX_REGISTRY_TEXT_LENGTH = 4096;
const MAX_REGISTRY_ROOT_PATH_LENGTH = 4096;

const workspaceProjectRegistryEntrySchema = workspaceProjectSchema
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

const workspaceProjectRegistrySchema = z
  .object({
    schemaVersion: z.literal(WORKSPACE_PROJECT_REGISTRY_VERSION),
    projects: z.array(workspaceProjectRegistryEntrySchema),
  })
  .strict();

type WorkspaceProjectRegistryFile = z.infer<typeof workspaceProjectRegistrySchema>;
type WorkspaceProjectRegistryEntry = z.infer<typeof workspaceProjectRegistryEntrySchema>;

export type WorkspaceProject = Omit<WorkspaceProjectRegistryEntry, 'rootPath'>;

export interface WorkspaceProjectRegistry {
  readonly listProjects: () => Promise<readonly WorkspaceProject[]>;
  readonly resolveProjectRoot: (workspaceId: string) => Promise<string | null>;
  readonly removeProject: (workspaceId: string) => Promise<void>;
  readonly upsertProject: (input: {
    readonly canonicalRoot: string;
    readonly snapshot: WorkspaceSnapshot;
  }) => Promise<WorkspaceProject>;
}

export class WorkspaceProjectRegistryReadError extends Error {
  constructor() {
    super('Workspace project registry could not be read');
  }
}

export function createWorkspaceProjectRegistry({
  registryPath,
  now = () => new Date().toISOString(),
}: {
  readonly registryPath: string;
  readonly now?: () => string;
}): WorkspaceProjectRegistry {
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

  async function readRegistry(): Promise<WorkspaceProjectRegistryFile> {
    const result = await readBoundedJsonNoFollow({
      filePath: registryPath,
      maxBytes: MAX_REGISTRY_BYTES,
      schema: workspaceProjectRegistrySchema,
    });
    if (result.status === 'ok') {
      return result.value;
    }
    if (result.status === 'read-error') {
      throw new WorkspaceProjectRegistryReadError();
    }
    return emptyRegistry();
  }

  async function writeRegistry(registry: WorkspaceProjectRegistryFile): Promise<void> {
    const directory = path.dirname(registryPath);
    await mkdir(directory, { recursive: true });
    await writeWorkspaceJsonAtomic(registryPath, registry);
  }

  return {
    async listProjects() {
      await waitForPendingWrite();
      const registry = await readRegistry();
      return registry.projects.map(stripRootPath);
    },
    async resolveProjectRoot(workspaceId) {
      await waitForPendingWrite();
      const registry = await readRegistry();
      return (
        registry.projects.find((project) => project.workspaceId === workspaceId)?.rootPath ?? null
      );
    },
    async removeProject(workspaceId) {
      return withRegistryWriteLock(async () => {
        const registry = await readRegistry();
        const projects = registry.projects.filter((project) => project.workspaceId !== workspaceId);
        if (projects.length === registry.projects.length) {
          return;
        }
        await writeRegistry({
          schemaVersion: WORKSPACE_PROJECT_REGISTRY_VERSION,
          projects,
        });
      });
    },
    async upsertProject({ canonicalRoot, snapshot }) {
      return withRegistryWriteLock(async () => {
        if (canonicalRoot.length > MAX_REGISTRY_ROOT_PATH_LENGTH) {
          throw new Error('Workspace project root path is too long');
        }
        const registry = await readRegistry();
        const currentTime = now();
        const existing = registry.projects.find(
          (project) => project.workspaceId === snapshot.workspaceId
        );
        const nextProject: WorkspaceProjectRegistryEntry = {
          workspaceId: snapshot.workspaceId,
          title: boundedRegistryText(snapshot.title),
          description: boundedRegistryText(snapshot.description),
          rootPath: canonicalRoot,
          addedAt: existing?.addedAt ?? currentTime,
          lastOpenedAt: currentTime,
        };
        const otherProjects = registry.projects.filter(
          (project) => project.workspaceId !== snapshot.workspaceId
        );
        await writeRegistry({
          schemaVersion: WORKSPACE_PROJECT_REGISTRY_VERSION,
          projects: [nextProject, ...otherProjects].slice(0, MAX_REGISTRY_PROJECTS),
        });
        return stripRootPath(nextProject);
      });
    },
  };
}

function boundedRegistryText(value: string): string {
  return value.length > MAX_REGISTRY_TEXT_LENGTH ? value.slice(0, MAX_REGISTRY_TEXT_LENGTH) : value;
}

function emptyRegistry(): WorkspaceProjectRegistryFile {
  return {
    schemaVersion: WORKSPACE_PROJECT_REGISTRY_VERSION,
    projects: [],
  };
}

function stripRootPath(project: WorkspaceProjectRegistryEntry): WorkspaceProject {
  return {
    workspaceId: project.workspaceId,
    title: project.title,
    description: project.description,
    addedAt: project.addedAt,
    lastOpenedAt: project.lastOpenedAt,
  };
}

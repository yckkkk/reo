import { constants } from 'node:fs';
import { access, lstat } from 'node:fs/promises';
import path from 'node:path';
import {
  memorySegmentDirectory,
  resolveMemoryDirectoryForEntityAction,
  resolveSegmentDirectoryInMemoryDirectory,
  resolveSegmentSupplementDirectoryInSegmentDirectory,
  segmentSupplementDirectory,
} from './memoryFiles.js';
import { validateWorkspaceOpenTargetWorkspaceId } from './workspaceFiles.js';

export type ResolverErrorCode =
  | 'ERR_WORKSPACE_ROOT_MISSING'
  | 'ERR_WORKSPACE_MEMORY_NOT_FOUND'
  | 'ERR_WORKSPACE_SEGMENT_NOT_FOUND'
  | 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND'
  | 'ERR_MEMORY_SPACE_AGENTS_FILE_MISSING'
  | 'ERR_ENTITY_DOCUMENT_MISSING'
  | 'ERR_WORKSPACE_METADATA_INVALID'
  | 'ERR_WORKSPACE_UNSAFE_PATH';

export type ResolverResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: ResolverErrorCode };

export type MemorySpacePaths = {
  readonly rootAbsolute: string;
  readonly agentsFileAbsolute: string;
};

export type MemoryPaths = {
  readonly directoryAbsolute: string;
  readonly documentAbsolute: string;
};

export type SegmentPaths = {
  readonly directoryAbsolute: string;
  readonly documentAbsolute: string;
};

export type SegmentSupplementPaths = {
  readonly directoryAbsolute: string;
  readonly documentAbsolute: string;
};

export type RegistryLookup = {
  readonly findByWorkspaceId?: (
    workspaceId: string
  ) => Promise<{ readonly canonicalRoot: string } | null>;
  readonly resolveMemorySpace?: (
    workspaceId: string
  ) => Promise<{ readonly rootPath: string } | null>;
  readonly resolveMemorySpaceRoot?: (workspaceId: string) => Promise<string | null>;
};

export type FsProbe = {
  readonly exists: (filePath: string) => Promise<boolean>;
  readonly safeDirectory?: (filePath: string) => Promise<'present' | 'missing' | 'unsafe'>;
  readonly safeFile?: (filePath: string) => Promise<'present' | 'missing' | 'unsafe'>;
};

export type MemorySpaceRootValidator = (input: {
  readonly rootPath: string;
  readonly workspaceId: string;
}) => Promise<ResolverResult<{ readonly rootAbsolute: string }>>;

export type MemoryDirectoryResolver = {
  readonly resolveMemoryDirectory: (canonicalRoot: string, memoryId: string) => Promise<string>;
};

export type SegmentDirectoryResolver = {
  readonly resolveSegmentDirectory: (
    canonicalRoot: string,
    memoryId: string,
    segmentId: string,
    context?: { readonly memoryDirectoryAbsolute: string }
  ) => Promise<string>;
};

export type SegmentSupplementDirectoryResolver = {
  readonly resolveSegmentSupplementDirectory: (
    canonicalRoot: string,
    memoryId: string,
    segmentId: string,
    supplementId: string,
    context?: { readonly segmentDirectoryAbsolute: string }
  ) => Promise<string>;
};

export const nodeFsProbe: FsProbe = {
  async exists(filePath) {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  },
  async safeFile(filePath) {
    try {
      const entry = await lstat(filePath);
      return entry.isFile() && !entry.isSymbolicLink() ? 'present' : 'unsafe';
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTDIR')) {
        return 'missing';
      }
      return 'unsafe';
    }
  },
  async safeDirectory(filePath) {
    try {
      const entry = await lstat(filePath);
      return entry.isDirectory() && !entry.isSymbolicLink() ? 'present' : 'unsafe';
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTDIR')) {
        return 'missing';
      }
      return 'unsafe';
    }
  },
};

const defaultMemoryDirectoryResolver: MemoryDirectoryResolver = {
  resolveMemoryDirectory: resolveMemoryDirectoryForEntityAction,
};

const defaultSegmentDirectoryResolver: SegmentDirectoryResolver = {
  async resolveSegmentDirectory(canonicalRoot, memoryId, segmentId, context) {
    return context
      ? resolveSegmentDirectoryInMemoryDirectory({
          memoryDirectory: context.memoryDirectoryAbsolute,
          memoryId,
          rootPath: canonicalRoot,
          segmentId,
        })
      : memorySegmentDirectory(canonicalRoot, memoryId, segmentId);
  },
};

const defaultSegmentSupplementDirectoryResolver: SegmentSupplementDirectoryResolver = {
  async resolveSegmentSupplementDirectory(
    canonicalRoot,
    memoryId,
    segmentId,
    supplementId,
    context
  ) {
    return context
      ? resolveSegmentSupplementDirectoryInSegmentDirectory({
          memoryId,
          rootPath: canonicalRoot,
          segmentDirectory: context.segmentDirectoryAbsolute,
          segmentId,
          supplementId,
        })
      : segmentSupplementDirectory(canonicalRoot, memoryId, segmentId, supplementId);
  },
};

const defaultMemorySpaceRootValidator: MemorySpaceRootValidator = async ({
  rootPath,
  workspaceId,
}) => {
  const target = await validateWorkspaceOpenTargetWorkspaceId({ rootPath, workspaceId });
  if (!target.ok) {
    return {
      ok: false,
      code: mapWorkspaceRootValidationError(target.error.code),
    };
  }

  return { ok: true, value: { rootAbsolute: target.canonicalRoot } };
};

function isContainedPath(parentAbsolute: string, candidateAbsolute: string): boolean {
  const relative = path.relative(path.resolve(parentAbsolute), path.resolve(candidateAbsolute));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolveRegistryRoot(
  workspaceId: string,
  registry: RegistryLookup | undefined
): Promise<string | null> {
  if (!registry) {
    return null;
  }
  if (registry.findByWorkspaceId) {
    return (await registry.findByWorkspaceId(workspaceId))?.canonicalRoot ?? null;
  }
  if (registry.resolveMemorySpace) {
    return (await registry.resolveMemorySpace(workspaceId))?.rootPath ?? null;
  }
  if (registry.resolveMemorySpaceRoot) {
    return registry.resolveMemorySpaceRoot(workspaceId);
  }
  return null;
}

function mapWorkspaceRootValidationError(code: string): ResolverErrorCode {
  if (
    code === 'ERR_WORKSPACE_ROOT_MISSING' ||
    code === 'ERR_WORKSPACE_METADATA_INVALID' ||
    code === 'ERR_WORKSPACE_UNSAFE_PATH'
  ) {
    return code;
  }

  return 'ERR_WORKSPACE_UNSAFE_PATH';
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { readonly code?: unknown }).code === code
  );
}

async function validateRequiredFile(
  fs: FsProbe,
  filePath: string,
  missingCode: 'ERR_MEMORY_SPACE_AGENTS_FILE_MISSING' | 'ERR_ENTITY_DOCUMENT_MISSING'
): Promise<ResolverResult<null>> {
  const fileState = fs.safeFile
    ? await fs.safeFile(filePath)
    : (await fs.exists(filePath))
      ? 'present'
      : 'missing';

  if (fileState === 'present') {
    return { ok: true, value: null };
  }
  if (fileState === 'missing') {
    return { ok: false, code: missingCode };
  }
  return { ok: false, code: 'ERR_WORKSPACE_UNSAFE_PATH' };
}

async function validateRequiredDirectory(
  fs: FsProbe,
  directoryPath: string,
  missingCode:
    | 'ERR_WORKSPACE_MEMORY_NOT_FOUND'
    | 'ERR_WORKSPACE_SEGMENT_NOT_FOUND'
    | 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND'
): Promise<ResolverResult<null>> {
  const directoryState = fs.safeDirectory
    ? await fs.safeDirectory(directoryPath)
    : (await fs.exists(directoryPath))
      ? 'present'
      : 'missing';

  if (directoryState === 'present') {
    return { ok: true, value: null };
  }
  if (directoryState === 'missing') {
    return { ok: false, code: missingCode };
  }
  return { ok: false, code: 'ERR_WORKSPACE_UNSAFE_PATH' };
}

export async function resolveMemorySpacePaths(
  workspaceId: string,
  deps: {
    readonly registry?: RegistryLookup;
    readonly fs?: FsProbe;
    readonly memorySpaceRootValidator?: MemorySpaceRootValidator;
    readonly requireAgentsFile?: boolean;
  } = {}
): Promise<ResolverResult<MemorySpacePaths>> {
  const fs = deps.fs ?? nodeFsProbe;
  const registryRoot = await resolveRegistryRoot(workspaceId, deps.registry);
  if (!registryRoot) {
    return { ok: false, code: 'ERR_WORKSPACE_ROOT_MISSING' };
  }

  const rootValidation = await (deps.memorySpaceRootValidator ?? defaultMemorySpaceRootValidator)({
    rootPath: registryRoot,
    workspaceId,
  });
  if (!rootValidation.ok) {
    return rootValidation;
  }

  const rootAbsolute = rootValidation.value.rootAbsolute;
  const agentsFileAbsolute = path.join(rootAbsolute, 'AGENTS.md');
  if (deps.requireAgentsFile) {
    const agentsFileValidation = await validateRequiredFile(
      fs,
      agentsFileAbsolute,
      'ERR_MEMORY_SPACE_AGENTS_FILE_MISSING'
    );
    if (!agentsFileValidation.ok) {
      return agentsFileValidation;
    }
  }

  return {
    ok: true,
    value: {
      rootAbsolute,
      agentsFileAbsolute,
    },
  };
}

export async function resolveMemoryPaths(
  handle: { readonly canonicalRoot: string; readonly workspaceId: string },
  workspaceId: string,
  memoryId: string,
  deps: {
    readonly memoryDirectoryResolver?: MemoryDirectoryResolver;
    readonly fs?: FsProbe;
    readonly requireDocument?: boolean;
  } = {}
): Promise<ResolverResult<MemoryPaths>> {
  void workspaceId;
  const fs = deps.fs ?? nodeFsProbe;
  const memoryDirectoryResolver = deps.memoryDirectoryResolver ?? defaultMemoryDirectoryResolver;
  const directoryAbsolute = await memoryDirectoryResolver.resolveMemoryDirectory(
    handle.canonicalRoot,
    memoryId
  );
  const memoriesRootAbsolute = path.join(handle.canonicalRoot, 'memories');
  if (!isContainedPath(memoriesRootAbsolute, directoryAbsolute)) {
    return { ok: false, code: 'ERR_WORKSPACE_UNSAFE_PATH' };
  }
  const directoryValidation = await validateRequiredDirectory(
    fs,
    directoryAbsolute,
    'ERR_WORKSPACE_MEMORY_NOT_FOUND'
  );
  if (!directoryValidation.ok) {
    return directoryValidation;
  }

  const documentAbsolute = path.join(directoryAbsolute, 'memory.md');
  if (deps.requireDocument) {
    const documentValidation = await validateRequiredFile(
      fs,
      documentAbsolute,
      'ERR_ENTITY_DOCUMENT_MISSING'
    );
    if (!documentValidation.ok) {
      return documentValidation;
    }
  }

  return {
    ok: true,
    value: {
      directoryAbsolute,
      documentAbsolute,
    },
  };
}

export async function resolveSegmentPaths(
  handle: { readonly canonicalRoot: string; readonly workspaceId: string },
  workspaceId: string,
  memoryId: string,
  segmentId: string,
  deps: {
    readonly memoryDirectoryResolver?: MemoryDirectoryResolver;
    readonly segmentDirectoryResolver?: SegmentDirectoryResolver;
    readonly fs?: FsProbe;
    readonly requireDocument?: boolean;
  } = {}
): Promise<ResolverResult<SegmentPaths>> {
  const fs = deps.fs ?? nodeFsProbe;
  const memoryPaths = await resolveMemoryPaths(
    handle,
    workspaceId,
    memoryId,
    deps.memoryDirectoryResolver
      ? { fs, memoryDirectoryResolver: deps.memoryDirectoryResolver }
      : { fs }
  );
  if (!memoryPaths.ok) {
    return memoryPaths;
  }

  const segmentDirectoryResolver = deps.segmentDirectoryResolver ?? defaultSegmentDirectoryResolver;
  const directoryAbsolute = await segmentDirectoryResolver.resolveSegmentDirectory(
    handle.canonicalRoot,
    memoryId,
    segmentId,
    { memoryDirectoryAbsolute: memoryPaths.value.directoryAbsolute }
  );
  const segmentsRootAbsolute = path.join(memoryPaths.value.directoryAbsolute, 'segments');
  if (!isContainedPath(segmentsRootAbsolute, directoryAbsolute)) {
    return { ok: false, code: 'ERR_WORKSPACE_UNSAFE_PATH' };
  }
  const directoryValidation = await validateRequiredDirectory(
    fs,
    directoryAbsolute,
    'ERR_WORKSPACE_SEGMENT_NOT_FOUND'
  );
  if (!directoryValidation.ok) {
    return directoryValidation;
  }

  const documentAbsolute = path.join(directoryAbsolute, 'segment.md');
  if (deps.requireDocument) {
    const documentValidation = await validateRequiredFile(
      fs,
      documentAbsolute,
      'ERR_ENTITY_DOCUMENT_MISSING'
    );
    if (!documentValidation.ok) {
      return documentValidation;
    }
  }

  return {
    ok: true,
    value: {
      directoryAbsolute,
      documentAbsolute,
    },
  };
}

export async function resolveSegmentSupplementPaths(
  handle: { readonly canonicalRoot: string; readonly workspaceId: string },
  workspaceId: string,
  memoryId: string,
  segmentId: string,
  supplementId: string,
  deps: {
    readonly memoryDirectoryResolver?: MemoryDirectoryResolver;
    readonly segmentDirectoryResolver?: SegmentDirectoryResolver;
    readonly segmentSupplementDirectoryResolver?: SegmentSupplementDirectoryResolver;
    readonly fs?: FsProbe;
    readonly requireDocument?: boolean;
  } = {}
): Promise<ResolverResult<SegmentSupplementPaths>> {
  const fs = deps.fs ?? nodeFsProbe;
  const segmentPaths = await resolveSegmentPaths(handle, workspaceId, memoryId, segmentId, {
    fs,
    ...(deps.memoryDirectoryResolver
      ? { memoryDirectoryResolver: deps.memoryDirectoryResolver }
      : {}),
    ...(deps.segmentDirectoryResolver
      ? { segmentDirectoryResolver: deps.segmentDirectoryResolver }
      : {}),
  });
  if (!segmentPaths.ok) {
    return segmentPaths;
  }

  const supplementDirectoryResolver =
    deps.segmentSupplementDirectoryResolver ?? defaultSegmentSupplementDirectoryResolver;
  const directoryAbsolute = await supplementDirectoryResolver.resolveSegmentSupplementDirectory(
    handle.canonicalRoot,
    memoryId,
    segmentId,
    supplementId,
    { segmentDirectoryAbsolute: segmentPaths.value.directoryAbsolute }
  );
  const supplementsRootAbsolute = path.join(segmentPaths.value.directoryAbsolute, 'supplements');
  if (!isContainedPath(supplementsRootAbsolute, directoryAbsolute)) {
    return { ok: false, code: 'ERR_WORKSPACE_UNSAFE_PATH' };
  }
  const directoryValidation = await validateRequiredDirectory(
    fs,
    directoryAbsolute,
    'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND'
  );
  if (!directoryValidation.ok) {
    return directoryValidation;
  }

  const documentAbsolute = path.join(directoryAbsolute, 'supplement.md');
  if (deps.requireDocument) {
    const documentValidation = await validateRequiredFile(
      fs,
      documentAbsolute,
      'ERR_ENTITY_DOCUMENT_MISSING'
    );
    if (!documentValidation.ok) {
      return documentValidation;
    }
  }

  return {
    ok: true,
    value: {
      directoryAbsolute,
      documentAbsolute,
    },
  };
}

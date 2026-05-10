import { lstatSync, mkdirSync } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  assertSameCurrentDirectoryIdentity as assertSameCurrentDirectory,
  assertSameDirectoryIdentitySync as assertSameDirectoryPath,
  readSafeDirectoryIdentitySync as readDirectoryIdentitySync,
  sameDirectoryIdentity,
} from './directoryIdentity.js';
import {
  SEGMENT_ID_PATTERN,
  workspaceError,
  type WorkspaceErrorEnvelope,
} from '../workspace-contract/workspace-contract.js';
import { isSafeWorkspaceDirectoryName } from '../workspace-contract/workspace-name.js';

type MaybePromise<T> = T | Promise<T>;
type AssertWorkspacePathUsable = () => { readonly ok: true } | WorkspaceErrorEnvelope;

class WorkspacePathAborted extends Error {
  readonly envelope: WorkspaceErrorEnvelope;

  constructor(envelope: WorkspaceErrorEnvelope) {
    super(envelope.error.message);
    this.envelope = envelope;
  }
}

let afterWorkspaceReoDirectoryCheckForTest: (() => MaybePromise<void>) | null = null;
let beforeWorkspaceRootRealpathForTest: (() => MaybePromise<void>) | null = null;
let beforeWorkspaceRootChildDirectoryCreateForTest:
  | ((directoryName: string) => MaybePromise<void>)
  | null = null;

export async function resolveWorkspaceRoot(
  rawRootPath: string
): Promise<string | WorkspaceErrorEnvelope> {
  try {
    const rootStat = await lstat(rawRootPath);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace root is unsafe');
    }

    await beforeWorkspaceRootRealpathForTest?.();
    const canonicalRoot = await realpath(rawRootPath);
    const currentRootStat = await lstat(rawRootPath);
    if (
      !currentRootStat.isDirectory() ||
      currentRootStat.isSymbolicLink() ||
      !sameDirectoryIdentity(rootStat, currentRootStat)
    ) {
      return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace root is unsafe');
    }

    return canonicalRoot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return workspaceError(
        'ERR_WORKSPACE_ROOT_MISSING',
        'Workspace folder is missing',
        'none-written'
      );
    }
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace root is unsafe');
  }
}

function unsafeWorkspacePath(): WorkspaceErrorEnvelope {
  return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace root is unsafe', 'none-written');
}

function workspaceAlreadyExists(): WorkspaceErrorEnvelope {
  return workspaceError(
    'ERR_WORKSPACE_ALREADY_EXISTS',
    'Workspace directory already exists',
    'none-written'
  );
}

function workspacePathError(error: unknown): WorkspaceErrorEnvelope {
  return error instanceof WorkspacePathAborted ? error.envelope : unsafeWorkspacePath();
}

function assertWorkspacePathUsable(assertUsable: AssertWorkspacePathUsable | undefined): void {
  const usable = assertUsable?.();
  if (usable && !usable.ok) {
    throw new WorkspacePathAborted(usable);
  }
}

function resolveExistingDirectoryError(
  existing: 'allow' | 'reject'
): WorkspaceErrorEnvelope | null {
  return existing === 'reject' ? workspaceAlreadyExists() : null;
}

function createOrEnsureWorkspaceChildDirectory({
  parentDirectory,
  directoryName,
  assertUsable,
  existing,
}: {
  readonly parentDirectory: string;
  readonly directoryName: string;
  readonly assertUsable: AssertWorkspacePathUsable | undefined;
  readonly existing: 'allow' | 'reject';
}): string | WorkspaceErrorEnvelope {
  const previousCwd = process.cwd();
  try {
    const parentIdentity = readDirectoryIdentitySync(parentDirectory);
    process.chdir(parentDirectory);
    assertSameCurrentDirectory(parentIdentity);
    assertWorkspacePathUsable(assertUsable);
    try {
      mkdirSync(directoryName);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        const existingError = resolveExistingDirectoryError(existing);
        if (existingError) {
          return existingError;
        }
      } else {
        throw error;
      }
    }
    const entry = lstatSync(directoryName);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error('Workspace child directory is unsafe');
    }
    assertSameDirectoryPath(parentDirectory, parentIdentity);
    return path.join(parentDirectory, directoryName);
  } catch (error) {
    return workspacePathError(error);
  } finally {
    process.chdir(previousCwd);
  }
}

function ensureWorkspaceChildDirectory(
  parentDirectory: string,
  directoryName: string,
  assertUsable?: AssertWorkspacePathUsable
): string | WorkspaceErrorEnvelope {
  return createOrEnsureWorkspaceChildDirectory({
    parentDirectory,
    directoryName,
    assertUsable,
    existing: 'allow',
  });
}

function createWorkspaceChildDirectory(
  parentDirectory: string,
  directoryName: string,
  assertUsable?: AssertWorkspacePathUsable
): string | WorkspaceErrorEnvelope {
  return createOrEnsureWorkspaceChildDirectory({
    parentDirectory,
    directoryName,
    assertUsable,
    existing: 'reject',
  });
}

async function ensureWorkspaceRootChildDirectory(
  canonicalRoot: string,
  directoryName: string,
  assertUsable?: AssertWorkspacePathUsable
): Promise<string | WorkspaceErrorEnvelope> {
  try {
    const rootIdentity = readDirectoryIdentitySync(canonicalRoot);
    const directoryPath = path.join(canonicalRoot, directoryName);
    const checked = await checkWorkspaceDirectoryPath(directoryPath);
    if (typeof checked !== 'string') {
      return checked;
    }
    await beforeWorkspaceRootChildDirectoryCreateForTest?.(directoryName);
    assertSameDirectoryPath(canonicalRoot, rootIdentity);
    return ensureWorkspaceChildDirectory(canonicalRoot, directoryName, assertUsable);
  } catch (error) {
    return workspacePathError(error);
  }
}

export async function createNewWorkspaceRootDirectory(
  canonicalParent: string,
  directoryName: string,
  assertUsable?: AssertWorkspacePathUsable
): Promise<string | WorkspaceErrorEnvelope> {
  if (!isSafeWorkspaceDirectoryName(directoryName)) {
    return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'Workspace folder name is invalid');
  }

  try {
    const parentIdentity = readDirectoryIdentitySync(canonicalParent);
    assertSameDirectoryPath(canonicalParent, parentIdentity);
    return createWorkspaceChildDirectory(canonicalParent, directoryName, assertUsable);
  } catch (error) {
    return workspacePathError(error);
  }
}

async function checkWorkspaceDirectoryPath(
  directoryPath: string
): Promise<string | WorkspaceErrorEnvelope> {
  try {
    const entry = await lstat(directoryPath);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      return unsafeWorkspacePath();
    }
    return directoryPath;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return directoryPath;
    }
    return unsafeWorkspacePath();
  }
}

export async function checkWorkspaceReoDirectory(
  canonicalRoot: string
): Promise<string | WorkspaceErrorEnvelope> {
  return checkWorkspaceDirectoryPath(path.join(canonicalRoot, '.reo'));
}

export async function ensureWorkspaceReoDirectory(
  canonicalRoot: string,
  assertUsable?: AssertWorkspacePathUsable
): Promise<string | WorkspaceErrorEnvelope> {
  return ensureWorkspaceRootChildDirectory(canonicalRoot, '.reo', assertUsable);
}

export async function checkWorkspaceDraftsDirectory(
  canonicalRoot: string
): Promise<string | WorkspaceErrorEnvelope> {
  const reoDirectory = await checkWorkspaceReoDirectory(canonicalRoot);
  if (typeof reoDirectory !== 'string') {
    return reoDirectory;
  }
  const draftsDirectory = await checkWorkspaceDirectoryPath(path.join(reoDirectory, 'drafts'));
  if (typeof draftsDirectory !== 'string') {
    return draftsDirectory;
  }
  return checkWorkspaceDirectoryPath(path.join(draftsDirectory, 'segments'));
}

export async function ensureWorkspaceDraftsDirectory(
  canonicalRoot: string,
  assertUsable?: AssertWorkspacePathUsable
): Promise<string | WorkspaceErrorEnvelope> {
  try {
    const reoDirectory = await ensureWorkspaceReoDirectory(canonicalRoot, assertUsable);
    if (typeof reoDirectory !== 'string') {
      return reoDirectory;
    }
    await afterWorkspaceReoDirectoryCheckForTest?.();
    const draftsDirectory = ensureWorkspaceChildDirectory(reoDirectory, 'drafts', assertUsable);
    if (typeof draftsDirectory !== 'string') {
      return draftsDirectory;
    }
    return ensureWorkspaceChildDirectory(draftsDirectory, 'segments', assertUsable);
  } catch (error) {
    return workspacePathError(error);
  }
}

export async function checkWorkspaceMemoriesDirectory(
  canonicalRoot: string
): Promise<string | WorkspaceErrorEnvelope> {
  return checkWorkspaceDirectoryPath(path.join(canonicalRoot, 'memories'));
}

export async function ensureWorkspaceMemoriesDirectory(
  canonicalRoot: string,
  assertUsable?: AssertWorkspacePathUsable
): Promise<string | WorkspaceErrorEnvelope> {
  return ensureWorkspaceRootChildDirectory(canonicalRoot, 'memories', assertUsable);
}

export function createSafeSegmentId(segmentId: string): string {
  if (!SEGMENT_ID_PATTERN.test(segmentId)) {
    throw new Error('Invalid segment id');
  }

  return segmentId;
}

export function resolveWorkspaceDraftSegmentDirectory(
  canonicalRoot: string,
  segmentId: string
): string {
  const safeId = createSafeSegmentId(segmentId);
  const segmentsRoot = path.join(canonicalRoot, '.reo', 'drafts', 'segments');
  const segmentDirectory = path.join(segmentsRoot, safeId);
  const relative = path.relative(segmentsRoot, segmentDirectory);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Segment path escapes workspace');
  }

  for (const candidate of [
    path.join(canonicalRoot, '.reo'),
    path.join(canonicalRoot, '.reo', 'drafts'),
    segmentsRoot,
    segmentDirectory,
  ]) {
    try {
      if (lstatSync(candidate).isSymbolicLink()) {
        throw new Error('Segment path crosses a symlink');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return segmentDirectory;
}

export function setAfterWorkspaceReoDirectoryCheckForTest(
  hook: (() => MaybePromise<void>) | null
): void {
  afterWorkspaceReoDirectoryCheckForTest = hook;
}

export function setBeforeWorkspaceRootRealpathForTest(
  hook: (() => MaybePromise<void>) | null
): void {
  beforeWorkspaceRootRealpathForTest = hook;
}

export function setBeforeWorkspaceRootChildDirectoryCreateForTest(
  hook: ((directoryName: string) => MaybePromise<void>) | null
): void {
  beforeWorkspaceRootChildDirectoryCreateForTest = hook;
}

export function getWorkspaceMetadataPath(canonicalRoot: string): string {
  return path.join(canonicalRoot, '.reo', 'workspace.json');
}

export function getWorkspaceIndexPath(canonicalRoot: string): string {
  return path.join(canonicalRoot, '.reo', 'index.json');
}

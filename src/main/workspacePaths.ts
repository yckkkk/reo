import { lstatSync, mkdirSync } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  assertSameCurrentDirectoryIdentity as assertSameCurrentDirectory,
  assertSameDirectoryIdentitySync as assertSameDirectoryPath,
  readSafeDirectoryIdentitySync as readDirectoryIdentitySync,
  sameDirectoryIdentity,
} from './directoryIdentity.js';
import type { WorkspaceErrorEnvelope } from './workspaceContract.js';
import { workspaceError } from './workspaceContract.js';

const RECORDING_ID_PATTERN = /^rec_[A-Za-z0-9_-]+$/;
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
  } catch {
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace root is unsafe');
  }
}

function unsafeWorkspacePath(): WorkspaceErrorEnvelope {
  return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace root is unsafe', 'none-written');
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

function ensureWorkspaceChildDirectory(
  parentDirectory: string,
  directoryName: string,
  assertUsable?: AssertWorkspacePathUsable
): string | WorkspaceErrorEnvelope {
  const previousCwd = process.cwd();
  try {
    const parentIdentity = readDirectoryIdentitySync(parentDirectory);
    process.chdir(parentDirectory);
    assertSameCurrentDirectory(parentIdentity);
    assertWorkspacePathUsable(assertUsable);
    try {
      mkdirSync(directoryName);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
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
  return checkWorkspaceDirectoryPath(path.join(draftsDirectory, 'recordings'));
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
    return ensureWorkspaceChildDirectory(draftsDirectory, 'recordings', assertUsable);
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

export function createSafeRecordingId(recordingId: string): string {
  if (!RECORDING_ID_PATTERN.test(recordingId)) {
    throw new Error('Invalid recording id');
  }

  return recordingId;
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

import { execFileSync } from 'node:child_process';
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';
import { isUnsupportedDirectoryFsync } from './atomicWorkspaceFile.js';
import {
  assertSameCurrentDirectoryIdentity as assertSameCurrentDirectory,
  readSafeDirectoryIdentity,
  readSafeDirectoryIdentitySync as readDirectoryIdentitySync,
  sameDirectoryIdentity,
  type DirectoryIdentity,
} from './directoryIdentity.js';
import { ensureWorkspaceReoDirectory } from './workspacePaths.js';
import {
  workspaceError,
  type WorkspaceErrorEnvelope,
} from '../workspace-contract/workspace-contract.js';

let afterWorkspaceLockDirectoryCreateForTest: (() => void) | null = null;

const LOCK_OWNER_SCHEMA_VERSION = 2;
const LOCK_OWNER_MAX_BYTES = 512;
const PROCESS_START_TIME_TOLERANCE_MS = 5_000;

interface LockOwner {
  readonly pid: number;
  readonly processStartTimeMs: number | null;
  readonly ownerFileMtimeMs: number;
}

function unsafeWorkspacePath(): WorkspaceErrorEnvelope {
  return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace root is unsafe', 'none-written');
}

function workspaceLockFailed(): WorkspaceErrorEnvelope {
  return workspaceError('ERR_WORKSPACE_LOCK_FAILED', 'Workspace lock could not be acquired');
}

async function readDirectoryIdentity(
  directoryPath: string
): Promise<DirectoryIdentity | WorkspaceErrorEnvelope> {
  try {
    return await readSafeDirectoryIdentity(directoryPath, 'Workspace root is unsafe');
  } catch {
    return unsafeWorkspacePath();
  }
}

function fsyncCurrentDirectoryBestEffort(): void {
  let directoryFd: number | null = null;
  try {
    directoryFd = openSync('.', 'r');
    fsyncSync(directoryFd);
  } catch (error) {
    if (!isUnsupportedDirectoryFsync(error)) {
      throw error;
    }
  } finally {
    if (directoryFd !== null) {
      closeSync(directoryFd);
    }
  }
}

function readApproximateOwnProcessStartTimeMs(): number {
  return Math.round(Date.now() - process.uptime() * 1000);
}

function readProcessStartTimeMsFromPs(pid: number): number | null {
  try {
    const output = execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1_000,
    }).trim();
    if (output.length === 0) {
      return null;
    }
    const parsed = Date.parse(output);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readProcessStartTimeMs(pid: number): number | null {
  if (pid === process.pid) {
    return readOwnProcessStartTimeMs();
  }
  return readProcessStartTimeMsFromPs(pid);
}

function readOwnProcessStartTimeMs(): number {
  return readProcessStartTimeMsFromPs(process.pid) ?? readApproximateOwnProcessStartTimeMs();
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

function isSameProcessStartTime(left: number, right: number): boolean {
  return Math.abs(left - right) <= PROCESS_START_TIME_TOLERANCE_MS;
}

function readLockOwner(): LockOwner | null {
  let ownerFd: number | null = null;
  try {
    ownerFd = openSync('workspace.lock.lock/owner.json', constants.O_RDONLY | constants.O_NOFOLLOW);
    const ownerFile = fstatSync(ownerFd);
    if (!ownerFile.isFile() || ownerFile.size > LOCK_OWNER_MAX_BYTES) {
      return null;
    }
    const owner = JSON.parse(readFileSync(ownerFd, 'utf8')) as {
      readonly pid?: unknown;
      readonly processStartTimeMs?: unknown;
      readonly schemaVersion?: unknown;
    };
    if (typeof owner.pid !== 'number' || !Number.isInteger(owner.pid) || owner.pid <= 0) {
      return null;
    }
    if (owner.schemaVersion === undefined) {
      return { ownerFileMtimeMs: ownerFile.mtimeMs, pid: owner.pid, processStartTimeMs: null };
    }
    if (owner.schemaVersion !== LOCK_OWNER_SCHEMA_VERSION) {
      return null;
    }
    if (
      typeof owner.processStartTimeMs !== 'number' ||
      !Number.isFinite(owner.processStartTimeMs) ||
      owner.processStartTimeMs <= 0
    ) {
      return null;
    }
    return {
      ownerFileMtimeMs: ownerFile.mtimeMs,
      pid: owner.pid,
      processStartTimeMs: owner.processStartTimeMs,
    };
  } catch {
    return null;
  } finally {
    if (ownerFd !== null) {
      closeSync(ownerFd);
    }
  }
}

function isLockOwnerAlive(owner: LockOwner): boolean {
  if (!isProcessAlive(owner.pid)) {
    return false;
  }
  const currentProcessStartTimeMs = readProcessStartTimeMs(owner.pid);
  if (owner.processStartTimeMs !== null) {
    return currentProcessStartTimeMs === null
      ? true
      : isSameProcessStartTime(owner.processStartTimeMs, currentProcessStartTimeMs);
  }
  if (
    currentProcessStartTimeMs !== null &&
    owner.ownerFileMtimeMs + PROCESS_START_TIME_TOLERANCE_MS < currentProcessStartTimeMs
  ) {
    return false;
  }
  return true;
}

function removeStaleLockDirectory(): boolean {
  const lockEntry = lstatSync('workspace.lock.lock');
  if (!lockEntry.isDirectory() || lockEntry.isSymbolicLink()) {
    throw new Error('Workspace lock path is unsafe');
  }
  const owner = readLockOwner();
  if (owner !== null && isLockOwnerAlive(owner)) {
    return false;
  }
  rmSync('workspace.lock.lock', { recursive: true });
  return true;
}

function writeLockOwnerFile(lockDirectoryIdentity: DirectoryIdentity): void {
  const previousCwd = process.cwd();
  let ownerFd: number | null = null;
  try {
    process.chdir('workspace.lock.lock');
    assertSameCurrentDirectory(lockDirectoryIdentity);
    ownerFd = openSync(
      'owner.json',
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW
    );
    writeSync(
      ownerFd,
      `${JSON.stringify({
        pid: process.pid,
        processStartTimeMs: readOwnProcessStartTimeMs(),
        schemaVersion: LOCK_OWNER_SCHEMA_VERSION,
      })}\n`
    );
    fsyncSync(ownerFd);
    closeSync(ownerFd);
    ownerFd = null;
    assertSameCurrentDirectory(lockDirectoryIdentity);
    fsyncCurrentDirectoryBestEffort();
  } finally {
    if (ownerFd !== null) {
      closeSync(ownerFd);
    }
    process.chdir(previousCwd);
  }
}

function createLockWithinDirectory(
  reoDirectory: string,
  identity: DirectoryIdentity
):
  | {
      readonly lockDirectoryIdentity: DirectoryIdentity;
      readonly release: () => void;
    }
  | WorkspaceErrorEnvelope {
  const previousCwd = process.cwd();
  let lockDirectoryCreated = false;
  let fileFd: number | null = null;
  try {
    process.chdir(reoDirectory);
    assertSameCurrentDirectory(identity);
    fileFd = openSync(
      'workspace.lock',
      constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY | constants.O_NOFOLLOW
    );
    closeSync(fileFd);
    fileFd = null;
    try {
      mkdirSync('workspace.lock.lock');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || !removeStaleLockDirectory()) {
        throw error;
      }
      mkdirSync('workspace.lock.lock');
    }
    afterWorkspaceLockDirectoryCreateForTest?.();
    lockDirectoryCreated = true;
    const lockDirectoryIdentity = readDirectoryIdentitySync(
      'workspace.lock.lock',
      'Workspace lock path is unsafe'
    );
    writeLockOwnerFile(lockDirectoryIdentity);
    fsyncCurrentDirectoryBestEffort();
    return {
      lockDirectoryIdentity,
      release: () => {
        const releaseCwd = process.cwd();
        try {
          process.chdir(reoDirectory);
          assertSameCurrentDirectory(identity);
          if (
            !sameDirectoryIdentity(
              readDirectoryIdentitySync('workspace.lock.lock', 'Workspace lock path is unsafe'),
              lockDirectoryIdentity
            )
          ) {
            throw new Error('Workspace lock ownership changed');
          }
          rmSync('workspace.lock.lock', { recursive: true });
          fsyncCurrentDirectoryBestEffort();
        } finally {
          process.chdir(releaseCwd);
        }
      },
    };
  } catch (error) {
    if (fileFd !== null) {
      closeSync(fileFd);
    }
    if (lockDirectoryCreated) {
      rmSync('workspace.lock.lock', { force: true, recursive: true });
    }
    if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
      return unsafeWorkspacePath();
    }
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return workspaceError('ERR_WORKSPACE_LOCKED', 'Workspace is already locked');
    }
    if (error instanceof Error && error.message.includes('unsafe')) {
      return unsafeWorkspacePath();
    }
    return workspaceLockFailed();
  } finally {
    process.chdir(previousCwd);
  }
}

export function setAfterWorkspaceLockDirectoryCreateForTest(hook: (() => void) | null): void {
  afterWorkspaceLockDirectoryCreateForTest = hook;
}

export interface WorkspaceLock {
  readonly isHeld: () => boolean;
  readonly isUsable: () => boolean;
  readonly release: () => Promise<void>;
}

export interface AcquireWorkspaceLockOptions {
  readonly canonicalRoot: string;
  readonly beforeLockFileWrite?: () => Promise<void> | void;
  readonly beforeLockTargetOpen?: () => Promise<void> | void;
}

export async function acquireWorkspaceLock({
  canonicalRoot,
  beforeLockFileWrite,
  beforeLockTargetOpen,
}: AcquireWorkspaceLockOptions): Promise<
  | {
      readonly ok: true;
      readonly lock: WorkspaceLock;
    }
  | WorkspaceErrorEnvelope
> {
  const reoDirectory = await ensureWorkspaceReoDirectory(canonicalRoot);
  if (typeof reoDirectory !== 'string') {
    return reoDirectory;
  }
  const rootIdentity = await readDirectoryIdentity(canonicalRoot);
  if ('error' in rootIdentity) {
    return rootIdentity;
  }
  const initialReoIdentity = await readDirectoryIdentity(reoDirectory);
  if ('error' in initialReoIdentity) {
    return initialReoIdentity;
  }
  await beforeLockFileWrite?.();
  const currentReoIdentity = await readDirectoryIdentity(reoDirectory);
  if ('error' in currentReoIdentity) {
    return currentReoIdentity;
  }
  if (!sameDirectoryIdentity(currentReoIdentity, initialReoIdentity)) {
    return unsafeWorkspacePath();
  }
  await beforeLockTargetOpen?.();
  const finalReoIdentity = await readDirectoryIdentity(reoDirectory);
  if ('error' in finalReoIdentity) {
    return finalReoIdentity;
  }
  if (!sameDirectoryIdentity(finalReoIdentity, initialReoIdentity)) {
    return unsafeWorkspacePath();
  }
  const acquiredLock = createLockWithinDirectory(reoDirectory, initialReoIdentity);
  if ('error' in acquiredLock) {
    return acquiredLock;
  }

  let held = true;
  let lost = false;

  const isCurrentLockOwner = () => {
    try {
      return (
        sameDirectoryIdentity(readDirectoryIdentitySync(canonicalRoot), rootIdentity) &&
        sameDirectoryIdentity(readDirectoryIdentitySync(reoDirectory), initialReoIdentity) &&
        sameDirectoryIdentity(
          readDirectoryIdentitySync(
            path.join(reoDirectory, 'workspace.lock.lock'),
            'Workspace lock path is unsafe'
          ),
          acquiredLock.lockDirectoryIdentity
        )
      );
    } catch {
      return false;
    }
  };

  return {
    ok: true,
    lock: {
      isHeld: () => held,
      isUsable: () => held && !lost && isCurrentLockOwner(),
      release: async () => {
        if (!held) {
          return;
        }
        try {
          acquiredLock.release();
          held = false;
          lost = false;
        } catch (error) {
          lost = true;
          throw error;
        }
      },
    },
  };
}

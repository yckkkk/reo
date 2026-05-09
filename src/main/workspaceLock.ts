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

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

function readLockOwnerPid(): number | null {
  let ownerFd: number | null = null;
  try {
    ownerFd = openSync('workspace.lock.lock/owner.json', constants.O_RDONLY | constants.O_NOFOLLOW);
    const ownerFile = fstatSync(ownerFd);
    if (!ownerFile.isFile() || ownerFile.size > 256) {
      return null;
    }
    const owner = JSON.parse(readFileSync(ownerFd, 'utf8')) as { readonly pid?: unknown };
    return typeof owner.pid === 'number' && Number.isInteger(owner.pid) ? owner.pid : null;
  } catch {
    return null;
  } finally {
    if (ownerFd !== null) {
      closeSync(ownerFd);
    }
  }
}

function removeStaleLockDirectory(): boolean {
  const lockEntry = lstatSync('workspace.lock.lock');
  if (!lockEntry.isDirectory() || lockEntry.isSymbolicLink()) {
    throw new Error('Workspace lock path is unsafe');
  }
  const ownerPid = readLockOwnerPid();
  if (ownerPid !== null && isProcessAlive(ownerPid)) {
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
    writeSync(ownerFd, `${JSON.stringify({ pid: process.pid })}\n`);
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

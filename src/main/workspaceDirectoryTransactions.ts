import {
  closeSync,
  constants,
  fsyncSync,
  openSync,
  readdirSync,
  rmdirSync,
  rmSync,
  type Dirent,
} from 'node:fs';
import {
  assertSameCurrentDirectoryIdentity as assertSameCurrentDirectory,
  assertSameDirectoryIdentitySync as assertSameDirectoryPath,
  type DirectoryIdentity,
} from './directoryIdentity.js';

const UNSUPPORTED_WORKSPACE_DIRECTORY_FSYNC_CODES = new Set([
  'EACCES',
  'EISDIR',
  'EINVAL',
  'ENOTSUP',
  'EPERM',
]);

interface WorkspaceDirectoryOperation {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly validateDirectoryPath?: boolean;
}

interface WorkspaceDirectoryFileOperation extends WorkspaceDirectoryOperation {
  readonly fileName: string;
}

interface WorkspaceDirectoryTargetOperation extends WorkspaceDirectoryOperation {
  readonly targetName: string;
  readonly targetIdentity: DirectoryIdentity;
}

export function isUnsupportedWorkspaceDirectoryFsyncError(error: unknown): boolean {
  return UNSUPPORTED_WORKSPACE_DIRECTORY_FSYNC_CODES.has(
    (error as NodeJS.ErrnoException).code ?? ''
  );
}

export function fsyncCurrentWorkspaceDirectoryBestEffort(): void {
  let directoryFd: number | null = null;
  try {
    directoryFd = openSync('.', 'r');
    fsyncSync(directoryFd);
  } catch (error) {
    if (!isUnsupportedWorkspaceDirectoryFsyncError(error)) {
      throw error;
    }
  } finally {
    if (directoryFd !== null) {
      closeSync(directoryFd);
    }
  }
}

export function runInWorkspaceDirectorySync<T>(
  { directory, directoryIdentity, validateDirectoryPath = false }: WorkspaceDirectoryOperation,
  run: () => T
): T {
  const previousCwd = process.cwd();
  try {
    process.chdir(directory);
    assertSameCurrentDirectory(directoryIdentity);
    const result = run();
    if (validateDirectoryPath) {
      assertSameDirectoryPath(directory, directoryIdentity);
    }
    assertSameCurrentDirectory(directoryIdentity);
    return result;
  } finally {
    process.chdir(previousCwd);
  }
}

export function openNoReplaceWorkspaceFileInDirectory({
  directory,
  directoryIdentity,
  fileName,
}: WorkspaceDirectoryFileOperation): number {
  return openWorkspaceFileInDirectory({
    directory,
    directoryIdentity,
    fileName,
    flags: constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
  });
}

function openWorkspaceFileInDirectory({
  directory,
  directoryIdentity,
  fileName,
  flags,
}: WorkspaceDirectoryFileOperation & { readonly flags: number }): number {
  let fd: number | null = null;
  try {
    return runInWorkspaceDirectorySync({ directory, directoryIdentity }, () => {
      fd = openSync(fileName, flags | constants.O_NOFOLLOW);
      return fd;
    });
  } catch (error) {
    if (fd !== null) {
      closeSync(fd);
    }
    throw error;
  }
}

export function openExistingWorkspaceFileInDirectory({
  directory,
  directoryIdentity,
  fileName,
  flags,
}: WorkspaceDirectoryFileOperation & { readonly flags: number }): number {
  return openWorkspaceFileInDirectory({ directory, directoryIdentity, fileName, flags });
}

export function removeWorkspaceFileInDirectory({
  directory,
  directoryIdentity,
  fileName,
}: WorkspaceDirectoryFileOperation): void {
  runInWorkspaceDirectorySync({ directory, directoryIdentity }, () => {
    rmSync(fileName, { force: true });
  });
}

export function readWorkspaceDirectoryEntriesInDirectory({
  directory,
  directoryIdentity,
}: WorkspaceDirectoryOperation): Dirent[] {
  return runInWorkspaceDirectorySync({ directory, directoryIdentity }, () =>
    readdirSync('.', { withFileTypes: true })
  );
}

export function removeWorkspaceDirectoryTreeInDirectory({
  directory,
  directoryIdentity,
  targetName,
  targetIdentity,
}: WorkspaceDirectoryTargetOperation): void {
  runInWorkspaceDirectorySync({ directory, directoryIdentity }, () => {
    assertSameDirectoryPath(targetName, targetIdentity, 'Workspace directory changed');
    rmSync(targetName, { force: true, recursive: true });
    fsyncCurrentWorkspaceDirectoryBestEffort();
  });
}

export function removeEmptyWorkspaceDirectoryInDirectory({
  directory,
  directoryIdentity,
  targetName,
  targetIdentity,
}: WorkspaceDirectoryTargetOperation): void {
  runInWorkspaceDirectorySync({ directory, directoryIdentity }, () => {
    assertSameDirectoryPath(targetName, targetIdentity, 'Workspace directory changed');
    rmdirSync(targetName);
    fsyncCurrentWorkspaceDirectoryBestEffort();
  });
}

import { closeSync, fsync, linkSync, renameSync, rmSync, writeFile } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  assertSameCurrentDirectoryIdentity as assertSameCurrentDirectory,
  assertSameDirectoryIdentity as assertSameDirectory,
  assertSameDirectoryIdentitySync as assertSameDirectoryPath,
  readSafeDirectoryIdentity as readDirectoryIdentity,
  type DirectoryIdentity,
} from './directoryIdentity.js';
import {
  fsyncCurrentWorkspaceDirectoryBestEffort,
  isUnsupportedWorkspaceDirectoryFsyncError,
  openNoReplaceWorkspaceFileInDirectory,
  removeWorkspaceFileInDirectory,
} from './workspaceDirectoryTransactions.js';

interface WorkspaceFileHandle {
  writeFile(data: string | Uint8Array): Promise<void>;
  sync(): Promise<void>;
  close(): Promise<void>;
}

interface WorkspaceDirectoryHandle {
  sync(): Promise<void>;
  close(): Promise<void>;
}

interface WriteWorkspaceFileAtomicOptions {
  readonly filePath: string;
  readonly data: string | Uint8Array;
  readonly openFile: (tempPath: string) => Promise<WorkspaceFileHandle>;
  readonly renameFile: (tempPath: string, filePath: string) => Promise<void>;
  readonly openDirectory: (directoryPath: string) => Promise<WorkspaceDirectoryHandle>;
  readonly removeFile: (tempPath: string) => Promise<void>;
  readonly now: () => number;
  readonly pid: number;
}

type AssertWorkspaceFileUsable = () => void;

const fsyncDescriptor = promisify(fsync);
const writeFileDescriptor = promisify(writeFile);

let beforeAtomicWorkspaceFileCommitForTest: (() => void) | null = null;
let beforeAtomicWorkspaceFileTempOpenForTest: (() => void) | null = null;
let afterAtomicWorkspaceFileTempOpenForTest: (() => void) | null = null;
let afterAtomicWorkspaceFileValidationForTest: (() => void) | null = null;
let afterAtomicWorkspaceFileBackupRemoveForTest: (() => void) | null = null;

function isUnsupportedDirectoryFsync(error: unknown): boolean {
  return isUnsupportedWorkspaceDirectoryFsyncError(error);
}

async function writeWorkspaceFileAtomicInDirectory({
  directory,
  directoryIdentity,
  targetName,
  data,
  noReplace,
  assertUsable,
}: {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly targetName: string;
  readonly data: string | Uint8Array;
  readonly noReplace: boolean;
  readonly assertUsable?: AssertWorkspaceFileUsable | undefined;
}): Promise<void> {
  const previousCwd = process.cwd();
  const tempName = `.${targetName}.${process.pid}.${Date.now()}.part`;
  const backupName = `${tempName}.backup`;
  let tempCreated = false;
  let targetCreated = false;
  let backupCreated = false;
  let inTargetDirectory = false;
  let tempFd: number | null = null;

  try {
    beforeAtomicWorkspaceFileTempOpenForTest?.();
    tempFd = openNoReplaceWorkspaceFileInDirectory({
      directory,
      directoryIdentity,
      fileName: tempName,
    });
    tempCreated = true;
    afterAtomicWorkspaceFileTempOpenForTest?.();
    assertUsable?.();
    try {
      await assertSameDirectory(directory, directoryIdentity);
      await writeFileDescriptor(tempFd, data);
      await fsyncDescriptor(tempFd);
    } finally {
      closeSync(tempFd);
      tempFd = null;
    }

    process.chdir(directory);
    inTargetDirectory = true;
    assertSameCurrentDirectory(directoryIdentity);
    beforeAtomicWorkspaceFileCommitForTest?.();
    assertUsable?.();
    assertSameDirectoryPath(directory, directoryIdentity);
    assertSameCurrentDirectory(directoryIdentity);
    afterAtomicWorkspaceFileValidationForTest?.();
    assertUsable?.();
    if (noReplace) {
      linkSync(tempName, targetName);
      targetCreated = true;
      rmSync(tempName, { force: true });
      tempCreated = false;
    } else {
      try {
        renameSync(targetName, backupName);
        backupCreated = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
      renameSync(tempName, targetName);
      tempCreated = false;
      targetCreated = true;
    }

    assertSameDirectoryPath(directory, directoryIdentity);
    assertSameCurrentDirectory(directoryIdentity);
    fsyncCurrentWorkspaceDirectoryBestEffort();
    if (backupCreated) {
      rmSync(backupName, { force: true });
      backupCreated = false;
      targetCreated = false;
      try {
        afterAtomicWorkspaceFileBackupRemoveForTest?.();
        fsyncCurrentWorkspaceDirectoryBestEffort();
      } catch {
        // The replace commit is already durable; backup cleanup durability is best-effort.
      }
    }
    targetCreated = false;
  } catch (error) {
    if (tempFd !== null) {
      closeSync(tempFd);
    }
    if (inTargetDirectory) {
      if (targetCreated) {
        rmSync(targetName, { force: true });
      }
      if (backupCreated) {
        renameSync(backupName, targetName);
      }
      if (tempCreated) {
        rmSync(tempName, { force: true });
      }
    } else if (tempCreated) {
      try {
        removeWorkspaceFileInDirectory({
          directory,
          directoryIdentity,
          fileName: tempName,
        });
      } catch {
        // The temp file is only removed when the original directory identity is still reachable.
      }
    }
    throw error;
  } finally {
    if (inTargetDirectory) {
      process.chdir(previousCwd);
    }
  }
}

async function fsyncParentDirectoryBestEffort(
  directory: string,
  openDirectory: (directoryPath: string) => Promise<WorkspaceDirectoryHandle>
): Promise<void> {
  let directoryHandle: WorkspaceDirectoryHandle | null = null;
  try {
    directoryHandle = await openDirectory(directory);
    await directoryHandle.sync();
  } catch (error) {
    if (!isUnsupportedDirectoryFsync(error)) {
      throw error;
    }
  } finally {
    await directoryHandle?.close();
  }
}

async function writeWorkspaceFileAtomicWithOptions({
  filePath,
  data,
  openFile,
  renameFile,
  openDirectory,
  removeFile,
  now,
  pid,
}: WriteWorkspaceFileAtomicOptions): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const directoryIdentity = await readDirectoryIdentity(directory);
  const tempPath = path.join(directory, `.${path.basename(filePath)}.${pid}.${now()}.part`);
  let tempCreated = false;

  try {
    const fileHandle = await openFile(tempPath);
    tempCreated = true;
    try {
      await assertSameDirectory(directory, directoryIdentity);
      await fileHandle.writeFile(data);
      await fileHandle.sync();
    } finally {
      await fileHandle.close();
    }

    await assertSameDirectory(directory, directoryIdentity);
    await renameFile(tempPath, filePath);
    tempCreated = false;

    await assertSameDirectory(directory, directoryIdentity);
    await fsyncParentDirectoryBestEffort(directory, openDirectory);
  } catch (error) {
    if (tempCreated) {
      await removeFile(tempPath).catch(() => {});
    }
    throw error;
  }
}

export async function writeWorkspaceFileAtomic(
  filePath: string,
  data: string | Uint8Array,
  assertUsable?: AssertWorkspaceFileUsable
): Promise<void> {
  const directory = path.dirname(filePath);
  await writeWorkspaceFileAtomicInDirectory({
    directory,
    directoryIdentity: await readDirectoryIdentity(directory),
    targetName: path.basename(filePath),
    data,
    noReplace: false,
    assertUsable,
  });
}

export async function writeWorkspaceFileNoReplaceAtomic(
  filePath: string,
  data: string | Uint8Array,
  assertUsable?: AssertWorkspaceFileUsable
): Promise<void> {
  const directory = path.dirname(filePath);
  await writeWorkspaceFileAtomicInDirectory({
    directory,
    directoryIdentity: await readDirectoryIdentity(directory),
    targetName: path.basename(filePath),
    data,
    noReplace: true,
    assertUsable,
  });
}

export async function writeWorkspaceFileAtomicInKnownDirectory({
  directory,
  directoryIdentity,
  fileName,
  data,
  assertUsable,
}: {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly fileName: string;
  readonly data: string | Uint8Array;
  readonly assertUsable?: AssertWorkspaceFileUsable | undefined;
}): Promise<void> {
  await writeWorkspaceFileAtomicInDirectory({
    directory,
    directoryIdentity,
    targetName: fileName,
    data,
    noReplace: false,
    assertUsable,
  });
}

export async function writeWorkspaceJsonAtomic(
  filePath: string,
  value: unknown,
  assertUsable?: AssertWorkspaceFileUsable
): Promise<void> {
  await writeWorkspaceFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`, assertUsable);
}

export async function writeWorkspaceJsonAtomicInKnownDirectory({
  directory,
  directoryIdentity,
  fileName,
  value,
  assertUsable,
}: {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly fileName: string;
  readonly value: unknown;
  readonly assertUsable?: AssertWorkspaceFileUsable | undefined;
}): Promise<void> {
  await writeWorkspaceFileAtomicInKnownDirectory({
    directory,
    directoryIdentity,
    fileName,
    data: `${JSON.stringify(value, null, 2)}\n`,
    assertUsable,
  });
}

export function setBeforeAtomicWorkspaceFileCommitForTest(hook: (() => void) | null): void {
  beforeAtomicWorkspaceFileCommitForTest = hook;
}

export function setBeforeAtomicWorkspaceFileTempOpenForTest(hook: (() => void) | null): void {
  beforeAtomicWorkspaceFileTempOpenForTest = hook;
}

export function setAfterAtomicWorkspaceFileTempOpenForTest(hook: (() => void) | null): void {
  afterAtomicWorkspaceFileTempOpenForTest = hook;
}

export function setAfterAtomicWorkspaceFileValidationForTest(hook: (() => void) | null): void {
  afterAtomicWorkspaceFileValidationForTest = hook;
}

export function setAfterAtomicWorkspaceFileBackupRemoveForTest(hook: (() => void) | null): void {
  afterAtomicWorkspaceFileBackupRemoveForTest = hook;
}

export async function writeWorkspaceFileAtomicForTest({
  filePath,
  data,
  openFile,
  renameFile,
  openDirectory,
  removeFile,
}: {
  readonly filePath: string;
  readonly data: string | Uint8Array;
  readonly openFile: (tempPath: string) => Promise<WorkspaceFileHandle>;
  readonly renameFile: (tempPath: string, filePath: string) => Promise<void>;
  readonly openDirectory: (directoryPath: string) => Promise<WorkspaceDirectoryHandle>;
  readonly removeFile?: (tempPath: string) => Promise<void>;
}): Promise<void> {
  await writeWorkspaceFileAtomicWithOptions({
    filePath,
    data,
    openFile,
    renameFile,
    openDirectory,
    removeFile: removeFile ?? (async () => {}),
    now: () => 0,
    pid: 0,
  });
}

export async function writeWorkspaceFileNoReplaceAtomicForTest({
  filePath,
  data,
  openFile,
  linkFile,
  removeFile,
  openDirectory,
}: {
  readonly filePath: string;
  readonly data: string | Uint8Array;
  readonly openFile: (tempPath: string) => Promise<WorkspaceFileHandle>;
  readonly linkFile: (tempPath: string, filePath: string) => Promise<void>;
  readonly removeFile: (tempPath: string) => Promise<void>;
  readonly openDirectory: (directoryPath: string) => Promise<WorkspaceDirectoryHandle>;
}): Promise<void> {
  await writeWorkspaceFileAtomicWithOptions({
    filePath,
    data,
    openFile,
    renameFile: async (tempPath, targetPath) => {
      await linkFile(tempPath, targetPath);
      await removeFile(tempPath);
    },
    openDirectory,
    removeFile,
    now: () => 0,
    pid: 0,
  });
}

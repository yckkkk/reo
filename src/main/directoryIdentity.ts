import { lstatSync } from 'node:fs';
import { lstat } from 'node:fs/promises';

export interface DirectoryIdentity {
  readonly dev: number;
  readonly ino: number;
}

export function sameDirectoryIdentity(
  first: DirectoryIdentity,
  second: DirectoryIdentity
): boolean {
  return first.dev === second.dev && first.ino === second.ino;
}

export async function readSafeDirectoryIdentity(
  directoryPath: string,
  message = 'Workspace directory is not safe'
): Promise<DirectoryIdentity> {
  const entry = await lstat(directoryPath);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error(message);
  }
  return { dev: entry.dev, ino: entry.ino };
}

export function readSafeDirectoryIdentitySync(
  directoryPath: string,
  message = 'Workspace directory is not safe'
): DirectoryIdentity {
  const entry = lstatSync(directoryPath);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error(message);
  }
  return { dev: entry.dev, ino: entry.ino };
}

export async function assertSameDirectoryIdentity(
  directoryPath: string,
  identity: DirectoryIdentity,
  message = 'Workspace directory changed'
): Promise<void> {
  const current = await readSafeDirectoryIdentity(directoryPath, message);
  if (!sameDirectoryIdentity(current, identity)) {
    throw new Error(message);
  }
}

export function assertSameDirectoryIdentitySync(
  directoryPath: string,
  identity: DirectoryIdentity,
  message = 'Workspace directory changed'
): void {
  const current = readSafeDirectoryIdentitySync(directoryPath, message);
  if (!sameDirectoryIdentity(current, identity)) {
    throw new Error(message);
  }
}

export function assertSameCurrentDirectoryIdentity(
  identity: DirectoryIdentity,
  message = 'Workspace directory changed'
): void {
  assertSameDirectoryIdentitySync('.', identity, message);
}

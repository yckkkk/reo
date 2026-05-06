import { lstatSync } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { WorkspaceErrorEnvelope } from './workspaceContract.js';
import { workspaceError } from './workspaceContract.js';

const RECORDING_ID_PATTERN = /^rec_[A-Za-z0-9_-]+$/;

export async function resolveWorkspaceRoot(
  rawRootPath: string
): Promise<string | WorkspaceErrorEnvelope> {
  try {
    const rootStat = await lstat(rawRootPath);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace root is unsafe');
    }

    return await realpath(rawRootPath);
  } catch {
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace root is unsafe');
  }
}

export function createSafeRecordingId(recordingId: string): string {
  if (!RECORDING_ID_PATTERN.test(recordingId)) {
    throw new Error('Invalid recording id');
  }

  return recordingId;
}

export function resolveRecordingDirectory(canonicalRoot: string, recordingId: string): string {
  const safeId = createSafeRecordingId(recordingId);
  const recordingsRoot = path.join(canonicalRoot, 'recordings');
  const recordingDirectory = path.join(recordingsRoot, safeId);
  const relative = path.relative(recordingsRoot, recordingDirectory);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Recording path escapes workspace');
  }

  try {
    if (lstatSync(recordingDirectory).isSymbolicLink()) {
      throw new Error('Recording directory is a symlink');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return recordingDirectory;
}

export function getWorkspaceMetadataPath(canonicalRoot: string): string {
  return path.join(canonicalRoot, '.reo', 'workspace.json');
}

export function getWorkspaceIndexPath(canonicalRoot: string): string {
  return path.join(canonicalRoot, '.reo', 'index.json');
}

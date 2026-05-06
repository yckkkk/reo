import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { lock as lockFile } from 'proper-lockfile';
import { workspaceError, type WorkspaceErrorEnvelope } from './workspaceContract.js';

export interface WorkspaceLock {
  readonly isHeld: () => boolean;
  readonly release: () => Promise<void>;
}

export interface AcquireWorkspaceLockOptions {
  readonly canonicalRoot: string;
  readonly staleMs?: number;
}

export async function acquireWorkspaceLock({
  canonicalRoot,
  staleMs = 30_000,
}: AcquireWorkspaceLockOptions): Promise<
  | {
      readonly ok: true;
      readonly lock: WorkspaceLock;
    }
  | WorkspaceErrorEnvelope
> {
  const reoDirectory = path.join(canonicalRoot, '.reo');
  const lockTarget = path.join(reoDirectory, 'workspace.lock');
  await mkdir(reoDirectory, { recursive: true });
  await writeFile(lockTarget, '', { flag: 'a' });

  try {
    let held = true;
    const releaseLock = await lockFile(lockTarget, {
      stale: staleMs,
      retries: 0,
      realpath: false,
      lockfilePath: `${lockTarget}.lock`,
    });

    return {
      ok: true,
      lock: {
        isHeld: () => held,
        release: async () => {
          if (!held) {
            return;
          }
          held = false;
          await releaseLock();
        },
      },
    };
  } catch {
    return workspaceError('ERR_WORKSPACE_LOCKED', 'Workspace is already locked');
  }
}

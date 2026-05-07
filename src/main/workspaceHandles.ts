import { randomUUID } from 'node:crypto';
import type { WorkspaceErrorEnvelope } from './workspaceContract.js';
import { workspaceError } from './workspaceContract.js';
import type { TrustedSenderIdentity } from './trustedSender.js';

export interface WorkspaceHandleLock {
  readonly isHeld: () => boolean;
  readonly isUsable: () => boolean;
  readonly release: () => Promise<void>;
}

interface WorkspaceHandleEntry {
  readonly canonicalRoot: string;
  readonly workspaceId: string;
  readonly sender: TrustedSenderIdentity;
  readonly lock: WorkspaceHandleLock;
}

interface RequiredWorkspaceHandle {
  readonly canonicalRoot: string;
  readonly workspaceId: string;
  readonly assertUsable: () => { readonly ok: true } | WorkspaceErrorEnvelope;
}

export interface CreateWorkspaceHandleStoreOptions {
  readonly createHandle?: () => string;
}

export interface WorkspaceHandleStore {
  register(options: {
    readonly canonicalRoot: string;
    readonly workspaceId: string;
    readonly sender: TrustedSenderIdentity;
    readonly lock: WorkspaceHandleLock;
  }): {
    readonly workspaceHandle: string;
    readonly workspaceId: string;
  };
  requireHandle(options: {
    readonly workspaceHandle: string;
    readonly sender: TrustedSenderIdentity;
    readonly workspaceId?: string;
  }):
    | {
        readonly ok: true;
        readonly handle: RequiredWorkspaceHandle;
      }
    | WorkspaceErrorEnvelope;
  requireOwnedHandle(options: {
    readonly workspaceHandle: string;
    readonly sender: TrustedSenderIdentity;
    readonly workspaceId?: string;
  }):
    | {
        readonly ok: true;
        readonly handle: RequiredWorkspaceHandle;
      }
    | WorkspaceErrorEnvelope;
  closeHandle(options: {
    readonly workspaceHandle: string;
    readonly sender: TrustedSenderIdentity;
  }): Promise<{ readonly ok: true; readonly closed: true } | WorkspaceErrorEnvelope>;
  closeAllHandles(): Promise<void>;
}

function defaultCreateHandle(): string {
  return `wh_${randomUUID()}`;
}

function sameSender(a: TrustedSenderIdentity, b: TrustedSenderIdentity): boolean {
  return (
    a.processId === b.processId &&
    a.frameRoutingId === b.frameRoutingId &&
    a.origin === b.origin &&
    a.sessionKey === b.sessionKey
  );
}

function assertLockUsable(
  lock: WorkspaceHandleLock
): { readonly ok: true } | WorkspaceErrorEnvelope {
  if (!lock.isHeld() || !lock.isUsable()) {
    return workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost');
  }
  return { ok: true };
}

export function createWorkspaceHandleStore({
  createHandle = defaultCreateHandle,
}: CreateWorkspaceHandleStoreOptions = {}): WorkspaceHandleStore {
  const handles = new Map<string, WorkspaceHandleEntry>();

  function requireOwnedHandle({
    workspaceHandle,
    sender,
    workspaceId,
  }: {
    readonly workspaceHandle: string;
    readonly sender: TrustedSenderIdentity;
    readonly workspaceId?: string;
  }):
    | {
        readonly ok: true;
        readonly handle: RequiredWorkspaceHandle;
      }
    | WorkspaceErrorEnvelope {
    const entry = handles.get(workspaceHandle);
    if (!entry) {
      return workspaceError('ERR_WORKSPACE_HANDLE_NOT_FOUND', 'Workspace handle not found');
    }
    if (!sameSender(entry.sender, sender)) {
      return workspaceError('ERR_WORKSPACE_HANDLE_UNTRUSTED', 'Workspace handle sender mismatch');
    }
    if (workspaceId !== undefined && workspaceId !== entry.workspaceId) {
      return workspaceError(
        'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH',
        'Workspace handle workspace mismatch'
      );
    }

    return {
      ok: true,
      handle: {
        canonicalRoot: entry.canonicalRoot,
        workspaceId: entry.workspaceId,
        assertUsable: () => assertLockUsable(entry.lock),
      },
    };
  }

  return {
    register({ canonicalRoot, workspaceId, sender, lock }) {
      const workspaceHandle = createHandle();
      handles.set(workspaceHandle, {
        canonicalRoot,
        workspaceId,
        sender,
        lock,
      });
      return { workspaceHandle, workspaceId };
    },

    requireOwnedHandle,

    requireHandle(options) {
      const required = requireOwnedHandle(options);
      if (!required.ok) {
        return required;
      }

      const usable = required.handle.assertUsable();
      if (!usable.ok) {
        return usable;
      }
      return required;
    },

    async closeHandle({ workspaceHandle, sender }) {
      const entry = handles.get(workspaceHandle);
      if (!entry) {
        return workspaceError('ERR_WORKSPACE_HANDLE_NOT_FOUND', 'Workspace handle not found');
      }
      if (!sameSender(entry.sender, sender)) {
        return workspaceError('ERR_WORKSPACE_HANDLE_UNTRUSTED', 'Workspace handle sender mismatch');
      }

      try {
        await entry.lock.release();
      } catch {
        return workspaceError('ERR_WORKSPACE_LOCK_FAILED', 'Workspace lock could not be released');
      }

      handles.delete(workspaceHandle);
      return { ok: true, closed: true };
    },

    async closeAllHandles() {
      const entries = [...handles.entries()];
      await Promise.all(
        entries.map(async ([workspaceHandle, entry]) => {
          if (entry.lock.isHeld()) {
            await entry.lock.release().then(
              () => {
                handles.delete(workspaceHandle);
              },
              () => {}
            );
          } else {
            handles.delete(workspaceHandle);
          }
        })
      );
    },
  };
}

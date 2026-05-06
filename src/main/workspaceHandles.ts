import { randomUUID } from 'node:crypto';
import type { WorkspaceErrorEnvelope } from './workspaceContract.js';
import { workspaceError } from './workspaceContract.js';
import type { TrustedSenderIdentity } from './trustedSender.js';

export interface WorkspaceHandleLock {
  readonly isHeld: () => boolean;
  readonly release: () => Promise<void>;
}

interface WorkspaceHandleEntry {
  readonly canonicalRoot: string;
  readonly workspaceId: string;
  readonly sender: TrustedSenderIdentity;
  readonly lock: WorkspaceHandleLock;
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
        readonly handle: {
          readonly canonicalRoot: string;
          readonly workspaceId: string;
        };
      }
    | WorkspaceErrorEnvelope;
  closeHandle(options: {
    readonly workspaceHandle: string;
    readonly sender: TrustedSenderIdentity;
  }): Promise<{ readonly ok: true; readonly closed: true } | WorkspaceErrorEnvelope>;
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

export function createWorkspaceHandleStore({
  createHandle = defaultCreateHandle,
}: CreateWorkspaceHandleStoreOptions = {}): WorkspaceHandleStore {
  const handles = new Map<string, WorkspaceHandleEntry>();

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

    requireHandle({ workspaceHandle, sender, workspaceId }) {
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
      if (!entry.lock.isHeld()) {
        return workspaceError('ERR_WORKSPACE_LOCK_LOST', 'Workspace lock was lost');
      }

      return {
        ok: true,
        handle: {
          canonicalRoot: entry.canonicalRoot,
          workspaceId: entry.workspaceId,
        },
      };
    },

    async closeHandle({ workspaceHandle, sender }) {
      const entry = handles.get(workspaceHandle);
      if (!entry) {
        return workspaceError('ERR_WORKSPACE_HANDLE_NOT_FOUND', 'Workspace handle not found');
      }
      if (!sameSender(entry.sender, sender)) {
        return workspaceError('ERR_WORKSPACE_HANDLE_UNTRUSTED', 'Workspace handle sender mismatch');
      }

      handles.delete(workspaceHandle);
      await entry.lock.release();
      return { ok: true, closed: true };
    },
  };
}

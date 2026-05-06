import { randomUUID } from 'node:crypto';
import type { WorkspaceErrorEnvelope } from './workspaceContract.js';
import { workspaceError } from './workspaceContract.js';
import type { TrustedSenderIdentity } from './trustedSender.js';

const DEFAULT_TTL_MS = 60_000;

interface SelectionEntry {
  readonly rootPath: string;
  readonly displayPath: string;
  readonly sender: TrustedSenderIdentity;
  readonly expiresAtMs: number;
}

export interface CreateWorkspaceSelectionTokenStoreOptions {
  readonly createToken?: () => string;
  readonly now?: () => number;
  readonly ttlMs?: number;
}

export interface IssueWorkspaceSelectionOptions {
  readonly rootPath: string;
  readonly displayPath: string;
  readonly sender: TrustedSenderIdentity;
}

export interface ConsumeWorkspaceSelectionOptions {
  readonly selectionToken: string;
  readonly sender: TrustedSenderIdentity;
}

export interface WorkspaceSelectionTokenStore {
  issueSelection(options: IssueWorkspaceSelectionOptions): {
    readonly selectionToken: string;
    readonly displayPath: string;
  };
  consumeSelection(options: ConsumeWorkspaceSelectionOptions):
    | {
        readonly ok: true;
        readonly rootPath: string;
      }
    | WorkspaceErrorEnvelope;
}

function sameSender(a: TrustedSenderIdentity, b: TrustedSenderIdentity): boolean {
  return (
    a.processId === b.processId &&
    a.frameRoutingId === b.frameRoutingId &&
    a.origin === b.origin &&
    a.sessionKey === b.sessionKey
  );
}

export function createWorkspaceSelectionTokenStore({
  createToken = randomUUID,
  now = Date.now,
  ttlMs = DEFAULT_TTL_MS,
}: CreateWorkspaceSelectionTokenStoreOptions = {}): WorkspaceSelectionTokenStore {
  const selections = new Map<string, SelectionEntry>();

  return {
    issueSelection({ rootPath, displayPath, sender }) {
      const selectionToken = createToken();
      selections.set(selectionToken, {
        rootPath,
        displayPath,
        sender,
        expiresAtMs: now() + ttlMs,
      });

      return {
        selectionToken,
        displayPath,
      };
    },

    consumeSelection({ selectionToken, sender }) {
      const entry = selections.get(selectionToken);
      if (!entry) {
        return workspaceError('ERR_WORKSPACE_SELECTION_NOT_FOUND', 'Workspace selection not found');
      }

      if (entry.expiresAtMs < now()) {
        selections.delete(selectionToken);
        return workspaceError('ERR_WORKSPACE_SELECTION_EXPIRED', 'Workspace selection expired');
      }

      if (!sameSender(entry.sender, sender)) {
        return workspaceError(
          'ERR_WORKSPACE_SELECTION_SENDER_MISMATCH',
          'Workspace selection belongs to a different sender'
        );
      }

      selections.delete(selectionToken);

      return {
        ok: true,
        rootPath: entry.rootPath,
      };
    },
  };
}

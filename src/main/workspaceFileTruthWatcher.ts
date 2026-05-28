import path from 'node:path';
import chokidar from 'chokidar';
import type { WorkspaceFileTruthChangedEvent } from '../workspace-contract/workspace-contract.js';

type WorkspaceFileWatcher = {
  readonly on: (
    event: 'all' | 'error',
    listener: (...args: unknown[]) => void
  ) => WorkspaceFileWatcher;
  readonly close: () => Promise<unknown>;
};

type WatchWorkspaceOptions = {
  readonly rootPath: string;
  readonly sendEvent: (event: WorkspaceFileTruthChangedEvent) => void;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
};

type WatcherEntry = {
  readonly close: () => Promise<void>;
};

type TimerId = unknown;

export type WorkspaceFileTruthWatcherRegistry = {
  readonly closeAll: () => Promise<void>;
  readonly closeWorkspace: (workspaceHandle: string) => Promise<void>;
  readonly watchWorkspace: (options: WatchWorkspaceOptions) => void;
};

export type CreateWorkspaceFileTruthWatcherRegistryOptions = {
  readonly clearTimer?: (timer: TimerId) => void;
  readonly onWatcherError?: (diagnostic: WorkspaceFileTruthWatcherDiagnostic) => void;
  readonly settlementDelayMs?: number;
  readonly setTimer?: (callback: () => void, delayMs: number) => TimerId;
  readonly watch?: (rootPath: string, options: Record<string, unknown>) => WorkspaceFileWatcher;
};

const DEFAULT_SETTLEMENT_DELAY_MS = 120;
const IGNORED_REO_TECHNICAL_CHILDREN = new Set([
  'locks',
  'tmp',
  'cache',
  'review',
  'workspace.lock.lock',
]);

type WorkspaceFileTruthWatcherDiagnostic = {
  readonly code: string | null;
  readonly name: string;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
};

function normalizeWatchedRelativePath(rootPath: string, changedPath: string): string | null {
  const platformRelativePath = path.isAbsolute(changedPath)
    ? path.relative(rootPath, changedPath)
    : changedPath;
  if (platformRelativePath === '') {
    return '';
  }
  const relativePath = platformRelativePath.split(path.sep).join('/');
  if (
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    path.isAbsolute(platformRelativePath)
  ) {
    return null;
  }
  return relativePath;
}

export function isIgnoredWorkspaceFileEventPath(rootPath: string, changedPath: string): boolean {
  const relativePath = normalizeWatchedRelativePath(rootPath, changedPath);
  if (relativePath === null) {
    return true;
  }
  if (relativePath === '') {
    return false;
  }
  const parts = relativePath.split('/');
  const basename = parts.at(-1) ?? '';
  if (
    basename === '.DS_Store' ||
    basename.endsWith('~') ||
    basename.endsWith('.swp') ||
    basename.endsWith('.part') ||
    basename.endsWith('.tmp') ||
    basename.endsWith('.lock')
  ) {
    return true;
  }
  if (parts.includes('node_modules') || parts.includes('.git')) {
    return true;
  }
  if (parts[0] === '.reo' && IGNORED_REO_TECHNICAL_CHILDREN.has(parts[1] ?? '')) {
    return true;
  }
  return false;
}

export function createWorkspaceFileTruthWatcherRegistry({
  clearTimer = (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  onWatcherError = (diagnostic) => {
    console.warn('Workspace file truth watcher error', diagnostic);
  },
  settlementDelayMs = DEFAULT_SETTLEMENT_DELAY_MS,
  setTimer = setTimeout,
  watch = (rootPath, options) => chokidar.watch(rootPath, options),
}: CreateWorkspaceFileTruthWatcherRegistryOptions = {}): WorkspaceFileTruthWatcherRegistry {
  const entries = new Map<string, WatcherEntry>();
  let nextSequence = 0;

  async function closeWorkspace(workspaceHandle: string): Promise<void> {
    const entry = entries.get(workspaceHandle);
    if (!entry) {
      return;
    }
    entries.delete(workspaceHandle);
    await entry.close();
  }

  return {
    async closeAll() {
      await Promise.all(
        [...entries.keys()].map((workspaceHandle) => closeWorkspace(workspaceHandle))
      );
    },

    closeWorkspace,

    watchWorkspace({ rootPath, sendEvent, workspaceHandle, workspaceId }) {
      void closeWorkspace(workspaceHandle);

      let disposed = false;
      let timer: TimerId | null = null;
      const watcher = watch(rootPath, {
        awaitWriteFinish: {
          pollInterval: 25,
          stabilityThreshold: settlementDelayMs,
        },
        followSymlinks: false,
        ignoreInitial: true,
        ignored: (changedPath: string) => isIgnoredWorkspaceFileEventPath(rootPath, changedPath),
      });

      function clearPendingTimer() {
        if (timer !== null) {
          clearTimer(timer);
          timer = null;
        }
      }

      function scheduleChangedEvent() {
        if (disposed) {
          return;
        }
        clearPendingTimer();
        timer = setTimer(() => {
          timer = null;
          if (disposed) {
            return;
          }
          sendEvent({
            kind: 'changed',
            reason: 'file-system',
            sequence: ++nextSequence,
            workspaceHandle,
            workspaceId,
          });
        }, settlementDelayMs);
      }

      watcher.on('all', (_eventName, changedPath) => {
        if (typeof changedPath !== 'string') {
          scheduleChangedEvent();
          return;
        }
        if (!isIgnoredWorkspaceFileEventPath(rootPath, changedPath)) {
          scheduleChangedEvent();
        }
      });
      watcher.on('error', (error) => {
        const maybeError = error as { readonly code?: unknown; readonly name?: unknown };
        onWatcherError({
          code: typeof maybeError.code === 'string' ? maybeError.code : null,
          name: typeof maybeError.name === 'string' ? maybeError.name : 'Error',
          workspaceHandle,
          workspaceId,
        });
      });

      entries.set(workspaceHandle, {
        close: async () => {
          disposed = true;
          clearPendingTimer();
          await watcher.close();
        },
      });
    },
  };
}

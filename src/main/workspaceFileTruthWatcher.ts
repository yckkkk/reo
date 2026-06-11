import path from 'node:path';
import chokidar from 'chokidar';
import type {
  WorkspaceFileTruthChangedEvent,
  WorkspaceHomeComponentsChangedEvent,
} from '../workspace-contract/workspace-contract.js';

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

type WatchHomeComponentsOptions = {
  readonly appDataRootPath: string;
  readonly sendEvent: (event: WorkspaceHomeComponentsChangedEvent) => void;
};

type WatcherEntry = {
  readonly close: () => Promise<void>;
};

type HomeComponentsWatcherEntry = WatcherEntry & {
  readonly appDataRootPath: string;
  readonly updateSendEvent: (
    sendEvent: (event: WorkspaceHomeComponentsChangedEvent) => void
  ) => void;
};

type TimerId = unknown;

export type WorkspaceFileTruthWatcherRegistry = {
  readonly closeAll: () => Promise<void>;
  readonly closeHomeComponents: () => Promise<void>;
  readonly closeWorkspace: (workspaceHandle: string) => Promise<void>;
  readonly watchHomeComponents: (options: WatchHomeComponentsOptions) => void;
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
const HOME_COMPONENTS_WATCHER_KEY = 'app:home-components';
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
  if (
    (parts.length === 3 && parts[0] === 'widgets' && parts[2] === 'state.json') ||
    (parts.length === 5 &&
      parts[0] === 'memories' &&
      parts[2] === 'segments' &&
      parts[4] === 'state.json') ||
    (parts.length === 7 &&
      parts[0] === 'memories' &&
      parts[2] === 'segments' &&
      parts[4] === 'supplements' &&
      parts[6] === 'state.json')
  ) {
    return true;
  }
  return false;
}

export function isIgnoredHomeComponentFileEventPath(
  appDataRootPath: string,
  changedPath: string
): boolean {
  const relativePath = normalizeWatchedRelativePath(appDataRootPath, changedPath);
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
  if (relativePath === 'home-components.json') {
    return false;
  }
  if (parts[0] !== 'home-components') {
    return true;
  }
  if (parts.at(-1) === 'state.json') {
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

  async function closeHomeComponents(): Promise<void> {
    const entry = entries.get(HOME_COMPONENTS_WATCHER_KEY);
    if (!entry) {
      return;
    }
    entries.delete(HOME_COMPONENTS_WATCHER_KEY);
    await entry.close();
  }

  return {
    async closeAll() {
      await Promise.all(
        [...entries.keys()].map((workspaceHandle) => closeWorkspace(workspaceHandle))
      );
    },

    closeHomeComponents,

    closeWorkspace,

    watchHomeComponents({ appDataRootPath, sendEvent }) {
      const existingEntry = entries.get(HOME_COMPONENTS_WATCHER_KEY) as
        | HomeComponentsWatcherEntry
        | undefined;
      if (existingEntry?.appDataRootPath === appDataRootPath) {
        existingEntry.updateSendEvent(sendEvent);
        return;
      }

      void closeHomeComponents();

      let disposed = false;
      let timer: TimerId | null = null;
      let currentSendEvent = sendEvent;
      const watcher = watch(appDataRootPath, {
        awaitWriteFinish: {
          pollInterval: 25,
          stabilityThreshold: settlementDelayMs,
        },
        followSymlinks: false,
        ignoreInitial: true,
        ignored: (changedPath: string) =>
          isIgnoredHomeComponentFileEventPath(appDataRootPath, changedPath),
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
          currentSendEvent({
            kind: 'changed',
            reason: 'file-system',
            sequence: ++nextSequence,
          });
        }, settlementDelayMs);
      }

      watcher.on('all', (_eventName, changedPath) => {
        if (typeof changedPath !== 'string') {
          scheduleChangedEvent();
          return;
        }
        if (!isIgnoredHomeComponentFileEventPath(appDataRootPath, changedPath)) {
          scheduleChangedEvent();
        }
      });
      watcher.on('error', (error) => {
        const maybeError = error as { readonly code?: unknown; readonly name?: unknown };
        onWatcherError({
          code: typeof maybeError.code === 'string' ? maybeError.code : null,
          name: typeof maybeError.name === 'string' ? maybeError.name : 'Error',
          workspaceHandle: 'app',
          workspaceId: 'home-components',
        });
      });

      const watcherEntry: HomeComponentsWatcherEntry = {
        appDataRootPath,
        close: async () => {
          disposed = true;
          clearPendingTimer();
          await watcher.close();
        },
        updateSendEvent(nextSendEvent) {
          currentSendEvent = nextSendEvent;
        },
      };
      entries.set(HOME_COMPONENTS_WATCHER_KEY, watcherEntry);
    },

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

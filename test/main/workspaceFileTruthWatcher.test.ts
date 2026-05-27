import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWorkspaceFileTruthWatcherRegistry,
  isIgnoredWorkspaceFileEventPath,
} from '../../src/main/workspaceFileTruthWatcher.js';
import type { WorkspaceFileTruthChangedEvent } from '../../src/workspace-contract/workspace-contract.js';

class FakeWatcher {
  readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  closeCalls = 0;

  on(event: 'all' | 'error', listener: (...args: unknown[]) => void): this {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  emit(event: 'all' | 'error', ...args: readonly unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args);
    }
  }

  async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

function createManualTimerScheduler() {
  let nextId = 0;
  const timers = new Map<number, () => void>();
  return {
    clearTimer(timer: unknown) {
      timers.delete(Number(timer));
    },
    flush() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
    },
    setTimer(callback: () => void) {
      nextId += 1;
      timers.set(nextId, callback);
      return nextId;
    },
  };
}

test('workspace file truth watcher coalesces file changes without exposing paths', () => {
  const timers = createManualTimerScheduler();
  const fakeWatcher = new FakeWatcher();
  let watchedOptions: Record<string, unknown> | null = null;
  const sent: WorkspaceFileTruthChangedEvent[] = [];
  const registry = createWorkspaceFileTruthWatcherRegistry({
    clearTimer: timers.clearTimer,
    setTimer: timers.setTimer,
    settlementDelayMs: 25,
    watch: (_rootPath, options) => {
      watchedOptions = options;
      return fakeWatcher;
    },
  });

  registry.watchWorkspace({
    rootPath: '/workspace/root',
    sendEvent: (event) => sent.push(event),
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  fakeWatcher.emit('all', 'change', '/workspace/root/memories/memory-a/segment.md');
  fakeWatcher.emit('all', 'change', '/workspace/root/memories/memory-a/content.tiptap.json');
  timers.flush();

  assert.deepEqual(sent, [
    {
      kind: 'changed',
      reason: 'file-system',
      sequence: 1,
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
    },
  ]);
  assert.ok(watchedOptions);
  assert.equal((watchedOptions as Record<string, unknown>)['followSymlinks'], false);
});

test('workspace file truth watcher ignores transient files and closes pending events', async () => {
  const timers = createManualTimerScheduler();
  const fakeWatcher = new FakeWatcher();
  const sent: WorkspaceFileTruthChangedEvent[] = [];
  const registry = createWorkspaceFileTruthWatcherRegistry({
    clearTimer: timers.clearTimer,
    setTimer: timers.setTimer,
    settlementDelayMs: 25,
    watch: () => fakeWatcher,
  });

  registry.watchWorkspace({
    rootPath: '/workspace/root',
    sendEvent: (event) => sent.push(event),
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  fakeWatcher.emit('all', 'change', '/workspace/root/.DS_Store');
  fakeWatcher.emit('all', 'change', '/workspace/root/.reo/locks/workspace.lock');
  fakeWatcher.emit('all', 'add', '/workspace/root/memories/memory-a/.segment.md.1.2.part');
  fakeWatcher.emit('all', 'add', '/workspace/root/memories/memory-a/.content.tiptap.json.1.2.part');
  fakeWatcher.emit('all', 'change', '/workspace/root/memories/memory-a/segment.md');
  await registry.closeWorkspace('wh_1');
  timers.flush();

  assert.deepEqual(sent, []);
  assert.equal(fakeWatcher.closeCalls, 1);
});

test('workspace file truth watcher ignore rules are path-bound to the workspace root', () => {
  assert.equal(isIgnoredWorkspaceFileEventPath('/workspace/root', '/workspace/root'), false);
  assert.equal(
    isIgnoredWorkspaceFileEventPath('/workspace/root', '/workspace/root/.git/index'),
    true
  );
  assert.equal(
    isIgnoredWorkspaceFileEventPath('/workspace/root', '/workspace/root/.reo/tmp/write.tmp'),
    true
  );
  assert.equal(
    isIgnoredWorkspaceFileEventPath(
      '/workspace/root',
      '/workspace/root/memories/memory-a/segment.md'
    ),
    false
  );
  assert.equal(isIgnoredWorkspaceFileEventPath('/workspace/root', '/other/root/segment.md'), true);
  assert.equal(
    isIgnoredWorkspaceFileEventPath('/workspace/root', '/workspace/root/..not-parent/segment.md'),
    false
  );
});

test('workspace file truth watcher reports redacted watcher errors', () => {
  const timers = createManualTimerScheduler();
  const fakeWatcher = new FakeWatcher();
  const diagnostics: unknown[] = [];
  const registry = createWorkspaceFileTruthWatcherRegistry({
    clearTimer: timers.clearTimer,
    onWatcherError: (diagnostic) => diagnostics.push(diagnostic),
    setTimer: timers.setTimer,
    settlementDelayMs: 25,
    watch: () => fakeWatcher,
  });

  registry.watchWorkspace({
    rootPath: '/workspace/root',
    sendEvent: () => {},
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  fakeWatcher.emit(
    'error',
    Object.assign(new Error('ENOSPC: /workspace/root/private/path'), { code: 'ENOSPC' })
  );

  assert.deepEqual(diagnostics, [
    {
      code: 'ENOSPC',
      name: 'Error',
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
    },
  ]);
});

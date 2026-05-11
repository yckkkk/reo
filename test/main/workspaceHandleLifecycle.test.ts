import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bindWorkspaceHandleLifecycle,
  shouldReleaseWorkspaceHandlesForNavigation,
  type WorkspaceLifecycleNavigationDetails,
} from '../../src/main/workspaceHandleLifecycle.js';

class FakeEmitter {
  readonly listeners = new Map<
    string,
    Array<(() => void) | ((event: WorkspaceLifecycleNavigationDetails) => void)>
  >();

  on(eventName: 'closed' | 'render-process-gone', listener: () => void): this;
  on(
    eventName: 'did-start-navigation' | 'will-navigate',
    listener: (event: WorkspaceLifecycleNavigationDetails) => void
  ): this;
  on(
    eventName: string,
    listener: (() => void) | ((event: WorkspaceLifecycleNavigationDetails) => void)
  ): this {
    this.listeners.set(eventName, [...(this.listeners.get(eventName) ?? []), listener]);
    return this;
  }

  emit(eventName: 'closed' | 'render-process-gone'): void;
  emit(
    eventName: 'did-start-navigation' | 'will-navigate',
    event: WorkspaceLifecycleNavigationDetails
  ): void;
  emit(eventName: string, event?: WorkspaceLifecycleNavigationDetails): void {
    for (const listener of this.listeners.get(eventName) ?? []) {
      if (event) {
        (listener as (event: WorkspaceLifecycleNavigationDetails) => void)(event);
      } else {
        (listener as () => void)();
      }
    }
  }
}

test('trusted main-frame document navigation releases workspace runtime', () => {
  assert.equal(
    shouldReleaseWorkspaceHandlesForNavigation(
      {
        url: 'http://localhost:5173/',
        isMainFrame: true,
        isSameDocument: false,
      },
      (url) => url.startsWith('http://localhost:5173/')
    ),
    true
  );
});

test('same-document or untrusted navigation does not release workspace runtime', () => {
  const isTrusted = (url: string) => url.startsWith('http://localhost:5173/');

  assert.equal(
    shouldReleaseWorkspaceHandlesForNavigation(
      {
        url: 'http://localhost:5173/#memory',
        isMainFrame: true,
        isSameDocument: true,
      },
      isTrusted
    ),
    false
  );
  assert.equal(
    shouldReleaseWorkspaceHandlesForNavigation(
      {
        url: 'https://example.test/',
        isMainFrame: true,
        isSameDocument: false,
      },
      isTrusted
    ),
    false
  );
  assert.equal(
    shouldReleaseWorkspaceHandlesForNavigation(
      {
        url: 'http://localhost:5173/',
        isMainFrame: false,
        isSameDocument: false,
      },
      isTrusted
    ),
    false
  );
});

test('workspace handle lifecycle closes handles on trusted reload and window teardown', async () => {
  const webContents = new FakeEmitter();
  const browserWindow = new FakeEmitter();
  const closeReasons: string[] = [];
  const trustedNavigation: WorkspaceLifecycleNavigationDetails = {
    url: 'http://localhost:5173/',
    isMainFrame: true,
    isSameDocument: false,
  };

  bindWorkspaceHandleLifecycle({
    browserWindow,
    closeWorkspaceHandles: async () => {
      closeReasons.push('closed');
    },
    isTrustedAppUrl: (url) => url.startsWith('http://localhost:5173/'),
    webContents,
  });

  webContents.emit('did-start-navigation', trustedNavigation);
  await Promise.resolve();
  await Promise.resolve();
  browserWindow.emit('closed');
  await Promise.resolve();

  assert.deepEqual(closeReasons, ['closed', 'closed']);
});

test('workspace handle lifecycle coalesces navigation release events', () => {
  const webContents = new FakeEmitter();
  const browserWindow = new FakeEmitter();
  const trustedNavigation: WorkspaceLifecycleNavigationDetails = {
    url: 'http://localhost:5173/',
    isMainFrame: true,
    isSameDocument: false,
  };
  let releaseCount = 0;
  let finishRelease = () => {};

  bindWorkspaceHandleLifecycle({
    browserWindow,
    closeWorkspaceHandles: () =>
      new Promise<void>((resolve) => {
        releaseCount += 1;
        finishRelease = resolve;
      }),
    isTrustedAppUrl: (url: string) => url.startsWith('http://localhost:5173/'),
    webContents,
  });

  webContents.emit('did-start-navigation', trustedNavigation);
  webContents.emit('will-navigate', trustedNavigation);

  assert.equal(releaseCount, 1);
  finishRelease?.();
});

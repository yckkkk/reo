export type WorkspaceLifecycleNavigationDetails = {
  readonly url: string;
  readonly isMainFrame: boolean;
  readonly isSameDocument: boolean;
};

type WorkspaceLifecycleWebContents = {
  on(eventName: 'render-process-gone', listener: () => void): unknown;
  on(
    eventName: 'did-start-navigation' | 'will-navigate',
    listener: (event: WorkspaceLifecycleNavigationDetails) => void
  ): unknown;
};

type WorkspaceLifecycleBrowserWindow = {
  on(eventName: 'closed', listener: () => void): unknown;
};

export function shouldReleaseWorkspaceHandlesForNavigation(
  navigation: WorkspaceLifecycleNavigationDetails,
  isTrustedAppUrl: (url: string) => boolean
) {
  return navigation.isMainFrame && !navigation.isSameDocument && isTrustedAppUrl(navigation.url);
}

export function bindWorkspaceHandleLifecycle({
  browserWindow,
  closeWorkspaceHandles,
  isTrustedAppUrl,
  webContents,
}: {
  readonly browserWindow: WorkspaceLifecycleBrowserWindow;
  readonly closeWorkspaceHandles: () => Promise<void>;
  readonly isTrustedAppUrl: (url: string) => boolean;
  readonly webContents: WorkspaceLifecycleWebContents;
}) {
  let releaseInFlight: Promise<void> | null = null;
  const releaseWorkspaceRuntime = () => {
    if (!releaseInFlight) {
      releaseInFlight = closeWorkspaceHandles().finally(() => {
        releaseInFlight = null;
      });
    }
    void releaseInFlight;
  };
  const releaseOnDocumentNavigation = (navigation: WorkspaceLifecycleNavigationDetails) => {
    if (shouldReleaseWorkspaceHandlesForNavigation(navigation, isTrustedAppUrl)) {
      releaseWorkspaceRuntime();
    }
  };

  webContents.on('render-process-gone', releaseWorkspaceRuntime);
  webContents.on('did-start-navigation', releaseOnDocumentNavigation);
  webContents.on('will-navigate', releaseOnDocumentNavigation);
  browserWindow.on('closed', releaseWorkspaceRuntime);
}

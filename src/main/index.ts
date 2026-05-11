import {
  app,
  BrowserWindow,
  session,
  type Event,
  type WebContentsWillFrameNavigateEventParams,
  type WebContentsWillNavigateEventParams,
  type WebContentsWillRedirectEventParams,
} from 'electron';
import { getAppShellUrl, registerAppShellProtocol, registerAppShellScheme } from './appProtocol.js';
import { resolvePreloadPath } from './preloadPath.js';
import { createSecureWebPreferences } from './secureWebPreferences.js';
import {
  getDevServerUrl,
  isTrustedAppUrl,
  setupContentSecurityPolicy,
  setupPermissionRequestHandler,
} from './security.js';
import { closeAllWorkspaceHandles, registerWorkspaceIpc } from './workspaceIpc.js';
import { bindWorkspaceHandleLifecycle } from './workspaceHandleLifecycle.js';

app.enableSandbox();
registerAppShellScheme();

const DEV_SERVER_URL = getDevServerUrl();

let mainWindow: BrowserWindow | null = null;

function getPreloadPath(): string {
  return resolvePreloadPath(import.meta.url);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 620,
    title: 'Reo',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f8f7f4',
    show: false,
    webPreferences: createSecureWebPreferences(getPreloadPath()),
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (DEV_SERVER_URL) {
    void mainWindow.loadURL(DEV_SERVER_URL);
    if (process.env['REO_OPEN_DEVTOOLS'] === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    void mainWindow.loadURL(getAppShellUrl('index.html'));
  }

  bindWorkspaceHandleLifecycle({
    browserWindow: mainWindow,
    closeWorkspaceHandles: closeAllWorkspaceHandles,
    isTrustedAppUrl,
    webContents: mainWindow.webContents,
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

type NavigationEventParams =
  | WebContentsWillFrameNavigateEventParams
  | WebContentsWillNavigateEventParams
  | WebContentsWillRedirectEventParams;

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const handleNavigation = (event: Event<NavigationEventParams>): void => {
    if (isTrustedAppUrl(event.url)) {
      return;
    }
    event.preventDefault();
  };

  contents.on('will-navigate', handleNavigation);
  contents.on('will-redirect', handleNavigation);
  contents.on('will-frame-navigate', handleNavigation);
});

app
  .whenReady()
  .then(() => {
    setupContentSecurityPolicy();
    setupPermissionRequestHandler();
    registerWorkspaceIpc({
      expectedSession: session.defaultSession,
      expectedSessionKey: 'default',
      isTrustedUrl: isTrustedAppUrl,
    });
    registerAppShellProtocol();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })
  .catch((error: unknown) => {
    console.error('[Main] Failed to bootstrap application', error);
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (error: Error) => {
  console.error('[Main] Uncaught Exception', error);
  void closeAllWorkspaceHandles().finally(() => {
    app.exit(1);
  });
});

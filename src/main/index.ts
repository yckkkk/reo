import {
  app,
  BrowserWindow,
  safeStorage,
  session,
  type Event,
  type WebContentsWillFrameNavigateEventParams,
  type WebContentsWillNavigateEventParams,
  type WebContentsWillRedirectEventParams,
} from 'electron';
import { getAppShellUrl, registerAppShellProtocol, registerAppShellScheme } from './appProtocol.js';
import { diagnosticErrorName, recordDiagnosticEvent } from './diagnostics.js';
import { initializeElectronDiagnostics } from './electronDiagnostics.js';
import { resolvePreloadPath } from './preloadPath.js';
import { createRecordingTranscriptionSessionRegistry } from './recordingTranscriptionSessions.js';
import { createSecureWebPreferences } from './secureWebPreferences.js';
import {
  getDevServerUrl,
  isTrustedAppUrl,
  setupContentSecurityPolicy,
  setupPermissionRequestHandler,
} from './security.js';
import { createVoiceSettingsStore } from './voiceSettingsStore.js';
import { closeAllWorkspaceHandles, registerWorkspaceIpc } from './workspaceIpc.js';
import { bindWorkspaceHandleLifecycle } from './workspaceHandleLifecycle.js';

app.enableSandbox();
initializeElectronDiagnostics(app);
registerAppShellScheme();

const DEV_SERVER_URL = getDevServerUrl();

let mainWindow: BrowserWindow | null = null;
let closeWorkspaceRuntime: () => Promise<void> = closeAllWorkspaceHandles;

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
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] Renderer process gone', details.reason);
    recordDiagnosticEvent({
      area: 'app',
      event: 'renderer.gone',
      fields: { reason: details.reason },
      level: 'error',
    });
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
    closeWorkspaceHandles: closeWorkspaceRuntime,
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
    console.info('[Main] App ready');
    recordDiagnosticEvent({
      area: 'app',
      event: 'ready',
      fields: { mode: DEV_SERVER_URL ? 'development' : 'production' },
    });
    setupContentSecurityPolicy();
    setupPermissionRequestHandler();
    const voiceSettingsStore = createVoiceSettingsStore({
      safeStorage,
      userDataDir: app.getPath('userData'),
    });
    const recordingTranscriptionSessions = createRecordingTranscriptionSessionRegistry({
      resolveVoiceSettings: () => {
        const snapshot = voiceSettingsStore.read();
        return {
          enabled: snapshot.enabled,
          apiKey: voiceSettingsStore.readDecryptedApiKey(),
        };
      },
    });
    closeWorkspaceRuntime = async () => {
      recordingTranscriptionSessions.closeAll();
      await closeAllWorkspaceHandles();
    };
    registerWorkspaceIpc({
      expectedSession: session.defaultSession,
      expectedSessionKey: 'default',
      isTrustedUrl: isTrustedAppUrl,
      recordingTranscriptionSessions,
      voiceSettingsStore,
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
    console.error('[Main] Failed to bootstrap application', diagnosticErrorName(error));
    recordDiagnosticEvent({
      area: 'app',
      event: 'bootstrap.failed',
      fields: { errorName: diagnosticErrorName(error) },
      level: 'error',
    });
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (error: Error) => {
  const errorName = diagnosticErrorName(error);
  console.error('[Main] Uncaught Exception', errorName);
  recordDiagnosticEvent({
    area: 'app',
    event: 'uncaughtException',
    fields: { errorName },
    level: 'error',
  });
  void closeWorkspaceRuntime().finally(() => {
    app.exit(1);
  });
});

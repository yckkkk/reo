import { app } from 'electron';
import type { WebPreferences } from 'electron';

export function createSecureWebPreferences(): WebPreferences {
  return {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    devTools: !app.isPackaged,
  };
}

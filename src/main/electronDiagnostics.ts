import path from 'node:path';
import type { App } from 'electron';
import log from 'electron-log/main';
import {
  configureDiagnostics,
  recordDiagnosticEvent,
  type DiagnosticEvent,
} from './diagnostics.js';

export function initializeElectronDiagnostics(app: App): void {
  app.setAppLogsPath();
  const logsPath = app.getPath('logs');

  log.transports.file.resolvePathFn = () => path.join(logsPath, 'main.log');
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] {text}';
  log.transports.file.level = 'info';
  log.transports.file.maxSize = 1024 * 1024;
  log.transports.console.level = process.env['REO_DIAGNOSTICS_CONSOLE'] === '1' ? 'info' : false;

  configureDiagnostics({
    write(event) {
      writeDiagnosticEvent(event);
    },
  });

  recordDiagnosticEvent({
    area: 'app',
    event: 'diagnostics.ready',
    fields: {
      logPath: logsPath,
      processType: 'main',
    },
  });
}

export function writeDiagnosticEvent(event: DiagnosticEvent): void {
  const line = `[reo-diagnostic] ${JSON.stringify(event)}`;
  if (event.level === 'error') {
    log.error(line);
    return;
  }
  if (event.level === 'warn') {
    log.warn(line);
    return;
  }
  log.info(line);
}

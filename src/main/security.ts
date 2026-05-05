import { app, session } from 'electron';
import { APP_SHELL_SCHEME } from './appProtocol.js';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function isLoopbackHttpUrl(url: URL): boolean {
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') && LOOPBACK_HOSTNAMES.has(url.hostname)
  );
}

function resolveDevServerUrl(): string | null {
  const rawUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    if (isLoopbackHttpUrl(parsed)) {
      return parsed.origin;
    }
  } catch {
    console.warn('[Security] Ignoring invalid ELECTRON_RENDERER_URL');
    return null;
  }

  console.warn('[Security] Ignoring non-loopback ELECTRON_RENDERER_URL');
  return null;
}

const DEV_SERVER_URL = resolveDevServerUrl();
const DEV_SERVER_ORIGINS = new Set(DEV_SERVER_URL ? [DEV_SERVER_URL] : []);
const DEV_CONNECT_SOURCES = Array.from(DEV_SERVER_ORIGINS, (origin) => {
  const parsed = new URL(origin);
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  return parsed.origin;
});

const PROD_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "worker-src 'none'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

const DEV_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'none'",
  `connect-src 'self' ${DEV_CONNECT_SOURCES.join(' ')}`,
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

function isAppShellUrl(url: URL): boolean {
  if (url.protocol !== `${APP_SHELL_SCHEME}:`) {
    return false;
  }

  return url.hostname === 'renderer';
}

export function getDevServerUrl(): string | null {
  return DEV_SERVER_URL;
}

export function isTrustedAppUrl(rawUrl: string): boolean {
  if (!rawUrl) {
    return false;
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === `${APP_SHELL_SCHEME}:`) {
      return isAppShellUrl(parsed);
    }

    if (!app.isPackaged && DEV_SERVER_ORIGINS.has(parsed.origin)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function setupContentSecurityPolicy(): void {
  const usesDevServer = DEV_SERVER_URL !== null;
  const directives = usesDevServer ? DEV_CSP_DIRECTIVES : PROD_CSP_DIRECTIVES;
  const policy = directives.join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let isAppPage: boolean;
    if (usesDevServer) {
      try {
        isAppPage = DEV_SERVER_ORIGINS.has(new URL(details.url).origin);
      } catch {
        isAppPage = false;
      }
    } else {
      isAppPage = details.url.startsWith(`${APP_SHELL_SCHEME}://`);
    }

    if (!isAppPage) {
      callback(
        details.responseHeaders === undefined ? {} : { responseHeaders: details.responseHeaders }
      );
      return;
    }

    callback({
      responseHeaders: {
        ...(details.responseHeaders ?? {}),
        'Content-Security-Policy': [policy],
      },
    });
  });
}

export function setupPermissionRequestHandler(): void {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setDevicePermissionHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

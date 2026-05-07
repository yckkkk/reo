import { createRequire } from 'node:module';
import type { MediaAccessPermissionRequest } from 'electron';
import { APP_SHELL_HOST, APP_SHELL_SCHEME } from './appShellConstants.js';
import { getDevServerConnectSources, resolveDevServerUrl } from './devServerUrl.js';
import { createContentSecurityPolicy } from './securityPolicy.js';
import { workspaceError, type WorkspaceErrorEnvelope } from './workspaceContract.js';

const nodeRequire = createRequire(import.meta.url);
const MICROPHONE_INTENT_TTL_MS = 15_000;

type MediaPermissionDecisionInput = {
  readonly permission: string;
  readonly senderFrameUrl: string;
  readonly senderId: number;
  readonly isMainFrame: boolean;
  readonly requested: {
    readonly audio: boolean;
    readonly video: boolean;
  };
  readonly now?: () => number;
};

type CreateMicrophoneIntentInput = {
  readonly senderId: number;
  readonly workspaceHandle: string;
  readonly drawerSessionId: string;
  readonly now?: () => number;
};

type ClearMicrophoneIntentInput = {
  readonly senderId: number;
  readonly workspaceHandle: string;
  readonly drawerSessionId: string;
};

type MicrophoneIntent = {
  readonly workspaceHandle: string;
  readonly drawerSessionId: string;
  readonly expiresAt: number;
};

type MicrophoneIntentResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly registered: true;
      };
    }
  | WorkspaceErrorEnvelope;

const microphoneIntentsBySender = new Map<number, MicrophoneIntent>();

function pruneExpiredMicrophoneIntents(now: number): void {
  for (const [senderId, intent] of microphoneIntentsBySender) {
    if (intent.expiresAt <= now) {
      microphoneIntentsBySender.delete(senderId);
    }
  }
}

export function resetMicrophoneIntentsForTest(): void {
  microphoneIntentsBySender.clear();
}

export function createMicrophoneIntent({
  senderId,
  workspaceHandle,
  drawerSessionId,
  now: nowOption,
}: CreateMicrophoneIntentInput): MicrophoneIntentResult {
  const now = nowOption?.() ?? Date.now();
  pruneExpiredMicrophoneIntents(now);

  if (microphoneIntentsBySender.has(senderId)) {
    return workspaceError(
      'ERR_MIC_INTENT_ALREADY_ACTIVE',
      'Microphone intent already active',
      'none-written'
    );
  }

  const intent = {
    workspaceHandle,
    drawerSessionId,
    expiresAt: now + MICROPHONE_INTENT_TTL_MS,
  };
  microphoneIntentsBySender.set(senderId, intent);
  return {
    ok: true,
    value: {
      registered: true,
    },
  };
}

export function clearMicrophoneIntent({
  senderId,
  workspaceHandle,
  drawerSessionId,
}: ClearMicrophoneIntentInput): void {
  const intent = microphoneIntentsBySender.get(senderId);
  if (intent?.workspaceHandle === workspaceHandle && intent.drawerSessionId === drawerSessionId) {
    microphoneIntentsBySender.delete(senderId);
  }
}

export function clearMicrophoneIntentsForWorkspaceHandle(workspaceHandle: string): void {
  for (const [senderId, intent] of microphoneIntentsBySender) {
    if (intent.workspaceHandle === workspaceHandle) {
      microphoneIntentsBySender.delete(senderId);
    }
  }
}

export function clearAllMicrophoneIntents(): void {
  microphoneIntentsBySender.clear();
}

function consumeMicrophoneIntent(senderId: number, now: number): boolean {
  pruneExpiredMicrophoneIntents(now);
  const intent = microphoneIntentsBySender.get(senderId);
  if (!intent) {
    return false;
  }

  microphoneIntentsBySender.delete(senderId);
  return true;
}

export function decideMediaPermissionCheck(): false {
  return false;
}

export function decideMediaPermissionRequest(input: MediaPermissionDecisionInput): boolean {
  const consumed = consumeMicrophoneIntent(input.senderId, input.now?.() ?? Date.now());
  return (
    consumed &&
    input.permission === 'media' &&
    input.isMainFrame &&
    input.requested.audio &&
    !input.requested.video &&
    isTrustedAppUrl(input.senderFrameUrl)
  );
}

let cachedDevServerUrl: string | null | undefined;

function electronRuntime(): Partial<typeof import('electron')> {
  return nodeRequire('electron') as Partial<typeof import('electron')>;
}

function defaultSession(): import('electron').Session {
  const electronSession = electronRuntime().session?.defaultSession;
  if (!electronSession) {
    throw new Error('Electron session is unavailable');
  }
  return electronSession;
}

function resolveCurrentDevServerUrl(): string | null {
  if (cachedDevServerUrl !== undefined) {
    return cachedDevServerUrl;
  }

  const electronApp = electronRuntime().app;
  if (!electronApp) {
    cachedDevServerUrl = null;
    return cachedDevServerUrl;
  }

  cachedDevServerUrl = resolveDevServerUrl({
    rawUrl: process.env['ELECTRON_RENDERER_URL'],
    isPackaged: electronApp.isPackaged,
  });
  return cachedDevServerUrl;
}

function getDevServerOrigins(): ReadonlySet<string> {
  const devServerUrl = resolveCurrentDevServerUrl();
  return new Set(devServerUrl ? [devServerUrl] : []);
}

function getDevConnectSources(): readonly string[] {
  return getDevServerConnectSources(getDevServerOrigins());
}

export function getDevServerUrl(): string | null {
  return resolveCurrentDevServerUrl();
}

function isAppShellUrl(url: URL): boolean {
  if (url.protocol !== `${APP_SHELL_SCHEME}:`) {
    return false;
  }

  return url.hostname === APP_SHELL_HOST;
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

    return getDevServerOrigins().has(parsed.origin);
  } catch {
    return false;
  }
}

export function setupContentSecurityPolicy(): void {
  const session = defaultSession();
  const devServerUrl = resolveCurrentDevServerUrl();
  const devServerOrigins = getDevServerOrigins();
  const usesDevServer = devServerUrl !== null;
  const policy = createContentSecurityPolicy({
    devConnectSources: getDevConnectSources(),
    usesDevServer,
  });

  session.webRequest.onHeadersReceived((details, callback) => {
    let isAppPage: boolean;
    if (usesDevServer) {
      try {
        isAppPage = devServerOrigins.has(new URL(details.url).origin);
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
  const session = defaultSession();
  session.setPermissionCheckHandler(() => decideMediaPermissionCheck());
  session.setDevicePermissionHandler(() => false);
  session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (!webContents) {
      callback(false);
      return;
    }

    callback(
      decideMediaPermissionRequest({
        permission,
        senderFrameUrl: details.requestingUrl,
        senderId: webContents.id,
        isMainFrame: details.isMainFrame,
        requested: requestedMediaAccess(details),
      })
    );
  });
}

function requestedMediaAccess(details: MediaAccessPermissionRequest): {
  readonly audio: boolean;
  readonly video: boolean;
} {
  const mediaTypes = details.mediaTypes ?? [];
  return {
    audio: mediaTypes.includes('audio'),
    video: mediaTypes.some((mediaType) => mediaType !== 'audio'),
  };
}

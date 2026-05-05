import { app, net, protocol } from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

export const APP_SHELL_SCHEME = 'reo-app';
const APP_SHELL_HOST = 'renderer';

let schemeRegistered = false;
let protocolRegistered = false;

export function registerAppShellScheme(): void {
  if (schemeRegistered) {
    return;
  }

  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SHELL_SCHEME,
      privileges: {
        secure: true,
        standard: true,
      },
    },
  ]);

  schemeRegistered = true;
}

function getRendererDistPath(): string {
  return path.join(app.getAppPath(), 'out/renderer');
}

function resolveRendererAsset(parsed: URL): string | null {
  if (parsed.hostname !== APP_SHELL_HOST) {
    return null;
  }

  const segments = parsed.pathname
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => decodeURIComponent(segment));
  const relativePath = segments.length === 0 ? 'index.html' : path.join(...segments);
  const distPath = getRendererDistPath();
  const resolvedPath = path.normalize(path.join(distPath, relativePath));
  const relativeToDist = path.relative(distPath, resolvedPath);

  if (
    relativeToDist.length === 0 ||
    relativeToDist.startsWith('..') ||
    path.isAbsolute(relativeToDist)
  ) {
    return null;
  }

  return resolvedPath;
}

export function registerAppShellProtocol(): void {
  if (protocolRegistered) {
    return;
  }

  protocol.handle(APP_SHELL_SCHEME, async (request) => {
    try {
      const parsed = new URL(request.url);
      const assetPath = resolveRendererAsset(parsed);
      if (!assetPath) {
        return new Response('Not found', { status: 404 });
      }

      const response = await net.fetch(pathToFileURL(assetPath).toString());
      return response.ok ? response : new Response('Not found', { status: 404 });
    } catch (error) {
      console.warn('[AppProtocol] Failed to resolve renderer asset', {
        url: request.url,
        error: error instanceof Error ? error.message : String(error),
      });
      return new Response('Bad request', { status: 400 });
    }
  });

  protocolRegistered = true;
}

export function getAppShellUrl(entry: 'index.html'): string {
  return `${APP_SHELL_SCHEME}://${APP_SHELL_HOST}/${entry}`;
}

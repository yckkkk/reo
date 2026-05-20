import { app, net, protocol } from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_SHELL_HOST, APP_SHELL_SCHEME, ATTACHMENT_SCHEME } from './appShellConstants.js';
import {
  resolveNoteSegmentAttachmentFile,
  resolveNoteSegmentSupplementAttachmentFile,
} from './noteAttachments.js';

let schemeRegistered = false;
let protocolRegistered = false;

type AttachmentRootResolution =
  | {
      readonly ok: true;
      readonly canonicalRoot: string;
    }
  | { readonly ok: false };

type AttachmentRootResolver = (workspaceId: string) => AttachmentRootResolution;

export interface RegisterAppShellProtocolOptions {
  readonly resolveAttachmentRoot?: AttachmentRootResolver;
}

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
    {
      scheme: ATTACHMENT_SCHEME,
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        corsEnabled: false,
        stream: true,
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
  registerAppShellProtocolWithOptions({});
}

export function registerAppShellProtocolWithOptions({
  resolveAttachmentRoot,
}: RegisterAppShellProtocolOptions): void {
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

  protocol.handle(ATTACHMENT_SCHEME, async (request) => {
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }
    const resolved = await resolveAttachmentProtocolRequest(
      request.url,
      resolveAttachmentRoot ?? (() => ({ ok: false }))
    );
    if (!resolved.ok) {
      return new Response('Not found', { status: 404 });
    }
    try {
      return new Response(resolved.bytes, {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': resolved.mimeType,
        },
        status: 200,
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  protocolRegistered = true;
}

async function resolveAttachmentProtocolRequest(
  requestUrl: string,
  resolveAttachmentRoot: AttachmentRootResolver
): Promise<
  | { readonly ok: true; readonly bytes: Uint8Array; readonly mimeType: string }
  | { readonly ok: false }
> {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return { ok: false };
  }
  if (parsed.protocol !== `${ATTACHMENT_SCHEME}:`) {
    return { ok: false };
  }

  const workspaceId = parsed.hostname;
  const root = resolveAttachmentRoot(workspaceId);
  if (!root.ok) {
    return { ok: false };
  }

  const segments = decodeAttachmentPathSegments(parsed.pathname);
  if (!segments) {
    return { ok: false };
  }
  if (segments[0] !== 'segments') {
    return { ok: false };
  }
  if (segments.length === 3) {
    const resolved = await resolveNoteSegmentAttachmentFile({
      rootPath: root.canonicalRoot,
      workspaceId,
      segmentId: segments[1] ?? '',
      filename: segments[2] ?? '',
    });
    return resolved.ok
      ? { ok: true, bytes: resolved.bytes, mimeType: resolved.mimeType }
      : { ok: false };
  }
  if (segments.length === 5 && segments[2] === 'supplements') {
    const resolved = await resolveNoteSegmentSupplementAttachmentFile({
      rootPath: root.canonicalRoot,
      workspaceId,
      segmentId: segments[1] ?? '',
      supplementId: segments[3] ?? '',
      filename: segments[4] ?? '',
    });
    return resolved.ok
      ? { ok: true, bytes: resolved.bytes, mimeType: resolved.mimeType }
      : { ok: false };
  }
  return { ok: false };
}

export const resolveAttachmentProtocolRequestForTest = resolveAttachmentProtocolRequest;

function decodeAttachmentPathSegments(pathname: string): string[] | null {
  try {
    return pathname
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
}

export function getAppShellUrl(entry: 'index.html'): string {
  return `${APP_SHELL_SCHEME}://${APP_SHELL_HOST}/${entry}`;
}

import { app, net, protocol } from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  APP_SHELL_HOST,
  APP_SHELL_SCHEME,
  ARTIFACT_SCHEME,
  ATTACHMENT_SCHEME,
} from './appShellConstants.js';
import { resolveArtifactProtocolRequest, type ArtifactRootResolver } from './artifactProtocol.js';
import { resolveDevServerUrl } from './devServerUrl.js';
import { resolveMemoryCoverFile, resolveSegmentCoverFile } from './memoryCovers.js';
import {
  resolveFinalizedSegmentDirectoryFromManifest,
  resolveMemoryDirectory,
} from './memoryFiles.js';
import {
  resolveNoteSegmentAttachmentFile,
  resolveNoteSegmentSupplementAttachmentFile,
} from './noteAttachments.js';

let schemeRegistered = false;
let protocolRegistered = false;

const ATTACHMENT_PROTOCOL_NO_STORE_CACHE_CONTROL = 'no-store';
const MEMORY_COVER_PROTOCOL_CACHE_CONTROL = 'max-age=31536000, immutable';
const APP_SHELL_ORIGIN = `${APP_SHELL_SCHEME}://${APP_SHELL_HOST}`;

type AttachmentRootResolution =
  | {
      readonly ok: true;
      readonly canonicalRoot: string;
    }
  | { readonly ok: false };

type AttachmentRootResolver = (
  workspaceId: string
) => AttachmentRootResolution | Promise<AttachmentRootResolution>;

const denyAttachmentRoot: AttachmentRootResolver = () => ({ ok: false });
const denyArtifactRoot: ArtifactRootResolver = () => ({ ok: false });

export interface RegisterAppShellProtocolOptions {
  readonly resolveArtifactRoot?: ArtifactRootResolver;
  readonly resolveAttachmentRoot?: AttachmentRootResolver;
  readonly resolveCoverRoot?: AttachmentRootResolver;
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
        corsEnabled: true,
        stream: true,
      },
    },
    {
      scheme: ARTIFACT_SCHEME,
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ]);

  schemeRegistered = true;
}

function getRendererDistPath(): string {
  return path.join(app.getAppPath(), 'out/renderer');
}

function decodeUrlPathSegments(pathname: string): string[] {
  return pathname
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => decodeURIComponent(segment));
}

function resolveRendererAsset(parsed: URL): string | null {
  if (parsed.hostname !== APP_SHELL_HOST) {
    return null;
  }

  const segments = decodeUrlPathSegments(parsed.pathname);
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
  resolveArtifactRoot,
  resolveAttachmentRoot,
  resolveCoverRoot,
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
      resolveAttachmentRoot ?? denyAttachmentRoot,
      resolveCoverRoot ?? resolveAttachmentRoot ?? denyAttachmentRoot
    );
    if (!resolved.ok) {
      return new Response('Not found', { status: 404 });
    }
    try {
      const headers: Record<string, string> = {
        'Cache-Control': resolved.cacheControl,
        'Content-Type': resolved.mimeType,
      };
      if (resolved.coverCanvasAccess) {
        const allowedOrigin = resolveCoverCanvasAccessOrigin(request);
        if (allowedOrigin) {
          headers['Access-Control-Allow-Origin'] = allowedOrigin;
          headers['Vary'] = 'Origin';
        }
      }
      return new Response(resolved.bytes, {
        headers,
        status: 200,
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  protocol.handle(ARTIFACT_SCHEME, async (request) => {
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }
    const resolved = await resolveArtifactProtocolRequest(
      request.url,
      resolveArtifactRoot ?? denyArtifactRoot,
      {
        homeComponentAppDataRootPath: app.getPath('userData'),
        vendorRoot: getArtifactVendorRootPath(),
      }
    );
    if (!resolved.ok) {
      return new Response('Not found', { status: 404 });
    }
    return new Response(resolved.bytes, {
      headers: {
        'Cache-Control': resolved.cacheControl,
        'Content-Security-Policy': resolved.contentSecurityPolicy,
        'Content-Type': resolved.mimeType,
      },
      status: 200,
    });
  });

  protocolRegistered = true;
}

function getArtifactVendorRootPath(): string {
  return path.join(app.getAppPath(), 'resources', 'artifact-vendor');
}

async function resolveAttachmentProtocolRequest(
  requestUrl: string,
  resolveAttachmentRoot: AttachmentRootResolver,
  resolveCoverRoot: AttachmentRootResolver = resolveAttachmentRoot
): Promise<
  | {
      readonly ok: true;
      readonly bytes: Uint8Array;
      readonly cacheControl: string;
      readonly coverCanvasAccess: boolean;
      readonly mimeType: string;
    }
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
  const segments = decodeAttachmentPathSegments(parsed.pathname);
  if (!segments) {
    return { ok: false };
  }
  if (segments[0] === 'memories' && segments.length === 4 && segments[2] === 'cover') {
    const attachmentRoot = await resolveAttachmentRoot(workspaceId);
    if (!attachmentRoot.ok) {
      return { ok: false };
    }
    try {
      const memoryDirectoryPath = await resolveMemoryDirectory(
        attachmentRoot.canonicalRoot,
        segments[1] ?? ''
      );
      const resolved = await resolveMemoryCoverFile({
        memoryDirectoryPath,
        filename: segments[3] ?? '',
      });
      return resolved.ok
        ? {
            ok: true,
            bytes: resolved.bytes,
            cacheControl: MEMORY_COVER_PROTOCOL_CACHE_CONTROL,
            coverCanvasAccess: true,
            mimeType: resolved.mimeType,
          }
        : { ok: false };
    } catch {
      return { ok: false };
    }
  }
  if (segments[0] !== 'segments') {
    return { ok: false };
  }
  if (segments.length === 4 && segments[2] === 'cover') {
    const coverRoot = await resolveCoverRoot(workspaceId);
    if (!coverRoot.ok) {
      return { ok: false };
    }
    try {
      const { segmentDirectory } = await resolveFinalizedSegmentDirectoryFromManifest({
        rootPath: coverRoot.canonicalRoot,
        workspaceId,
        segmentId: segments[1] ?? '',
      });
      const resolved = await resolveSegmentCoverFile({
        segmentDirectoryPath: segmentDirectory,
        filename: segments[3] ?? '',
      });
      return resolved.ok
        ? {
            ok: true,
            bytes: resolved.bytes,
            cacheControl: MEMORY_COVER_PROTOCOL_CACHE_CONTROL,
            coverCanvasAccess: true,
            mimeType: resolved.mimeType,
          }
        : { ok: false };
    } catch {
      return { ok: false };
    }
  }
  const attachmentRoot = await resolveAttachmentRoot(workspaceId);
  if (!attachmentRoot.ok) {
    return { ok: false };
  }
  if (segments.length === 3) {
    const resolved = await resolveNoteSegmentAttachmentFile({
      rootPath: attachmentRoot.canonicalRoot,
      workspaceId,
      segmentId: segments[1] ?? '',
      filename: segments[2] ?? '',
    });
    return resolved.ok
      ? {
          ok: true,
          bytes: resolved.bytes,
          cacheControl: ATTACHMENT_PROTOCOL_NO_STORE_CACHE_CONTROL,
          coverCanvasAccess: false,
          mimeType: resolved.mimeType,
        }
      : { ok: false };
  }
  if (segments.length === 5 && segments[2] === 'supplements') {
    const resolved = await resolveNoteSegmentSupplementAttachmentFile({
      rootPath: attachmentRoot.canonicalRoot,
      workspaceId,
      segmentId: segments[1] ?? '',
      supplementId: segments[3] ?? '',
      filename: segments[4] ?? '',
    });
    return resolved.ok
      ? {
          ok: true,
          bytes: resolved.bytes,
          cacheControl: ATTACHMENT_PROTOCOL_NO_STORE_CACHE_CONTROL,
          coverCanvasAccess: false,
          mimeType: resolved.mimeType,
        }
      : { ok: false };
  }
  return { ok: false };
}

export const resolveAttachmentProtocolRequestForTest = resolveAttachmentProtocolRequest;

function resolveCoverCanvasAccessOrigin(request: Request): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) {
    return null;
  }
  if (origin === APP_SHELL_ORIGIN) {
    return origin;
  }

  const devServerOrigin = resolveDevServerUrl({
    rawUrl: process.env['ELECTRON_RENDERER_URL'],
    isPackaged: app.isPackaged,
    warn: () => {},
  });
  return origin === devServerOrigin ? origin : null;
}

function decodeAttachmentPathSegments(pathname: string): string[] | null {
  try {
    return decodeUrlPathSegments(pathname);
  } catch {
    return null;
  }
}

export function getAppShellUrl(entry: 'index.html'): string {
  return `${APP_SHELL_SCHEME}://${APP_SHELL_HOST}/${entry}`;
}

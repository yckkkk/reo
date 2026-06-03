import path from 'node:path';
import { ARTIFACT_SCHEME } from './appShellConstants.js';

export const ARTIFACT_WORKSPACE_HOST = 'workspace';
export const ARTIFACT_VENDOR_HOST = 'vendor';

const ARTIFACT_MIME_BY_EXTENSION = new Map<string, string>([
  ['.html', 'text/html'],
  ['.css', 'text/css'],
  ['.js', 'text/javascript'],
  ['.mjs', 'text/javascript'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

export type ArtifactRequestTarget =
  | {
      readonly kind: 'segment';
      readonly entry: boolean;
      readonly fileName: string;
      readonly segmentId: string;
      readonly workspaceId: string;
    }
  | {
      readonly kind: 'supplement';
      readonly entry: boolean;
      readonly fileName: string;
      readonly segmentId: string;
      readonly supplementId: string;
      readonly workspaceId: string;
    }
  | {
      readonly kind: 'vendor';
      readonly fileName: string;
      readonly packageName: string;
    };

function decodeArtifactPathSegments(pathname: string): string[] | null {
  try {
    return pathname
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
}

function isSafeSinglePathSegment(segment: string): boolean {
  return (
    segment.length > 0 &&
    segment !== '.' &&
    segment !== '..' &&
    !segment.includes('/') &&
    !segment.includes('\\') &&
    !path.isAbsolute(segment)
  );
}

function isHtmlFileName(fileName: string): boolean {
  return path.extname(fileName).toLowerCase() === '.html';
}

export function artifactMimeTypeForFileName(fileName: string): string | null {
  if (!isSafeSinglePathSegment(fileName)) {
    return null;
  }
  return ARTIFACT_MIME_BY_EXTENSION.get(path.extname(fileName).toLowerCase()) ?? null;
}

export function parseArtifactRequestTarget(parsed: URL): ArtifactRequestTarget | null {
  if (parsed.protocol !== `${ARTIFACT_SCHEME}:`) {
    return null;
  }
  const workspaceId = parsed.hostname;
  const segments = decodeArtifactPathSegments(parsed.pathname);
  if (!segments || !workspaceId) {
    return null;
  }

  if (parsed.hostname === ARTIFACT_VENDOR_HOST && segments.length === 2) {
    const packageName = segments[0] ?? '';
    const fileName = segments[1] ?? '';
    if (
      !isSafeSinglePathSegment(packageName) ||
      isHtmlFileName(fileName) ||
      !artifactMimeTypeForFileName(fileName)
    ) {
      return null;
    }
    return { kind: 'vendor', packageName, fileName };
  }

  if (parsed.hostname !== ARTIFACT_WORKSPACE_HOST) {
    return null;
  }

  const requestWorkspaceId = segments[0] ?? '';
  if (!isSafeSinglePathSegment(requestWorkspaceId) || segments[1] !== 'segments') {
    return null;
  }

  if (segments.length === 4) {
    const segmentId = segments[2] ?? '';
    const fileName = segments[3] ?? '';
    if (
      !isSafeSinglePathSegment(segmentId) ||
      !artifactMimeTypeForFileName(fileName) ||
      (isHtmlFileName(fileName) && fileName !== 'segment.html')
    ) {
      return null;
    }
    return {
      kind: 'segment',
      workspaceId: requestWorkspaceId,
      segmentId,
      fileName,
      entry: fileName === 'segment.html',
    };
  }

  if (segments.length === 6 && segments[3] === 'supplements') {
    const segmentId = segments[2] ?? '';
    const supplementId = segments[4] ?? '';
    const fileName = segments[5] ?? '';
    if (
      !isSafeSinglePathSegment(segmentId) ||
      !isSafeSinglePathSegment(supplementId) ||
      !artifactMimeTypeForFileName(fileName) ||
      (isHtmlFileName(fileName) && fileName !== 'supplement.html')
    ) {
      return null;
    }
    return {
      kind: 'supplement',
      workspaceId: requestWorkspaceId,
      segmentId,
      supplementId,
      fileName,
      entry: fileName === 'supplement.html',
    };
  }

  return null;
}

export function isArtifactWorkspaceEntryUrl(url: URL): boolean {
  const target = parseArtifactRequestTarget(url);
  return (
    (target?.kind === 'segment' || target?.kind === 'supplement') &&
    target.entry &&
    target.workspaceId.length > 0
  );
}

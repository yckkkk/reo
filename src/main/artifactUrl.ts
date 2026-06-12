import path from 'node:path';
import {
  ARTIFACT_RUNTIME_ASSETS_DIRECTORY,
  ARTIFACT_RUNTIME_ENTRY_FILE,
  ARTIFACT_RUNTIME_MANIFEST_FILE,
  ARTIFACT_RUNTIME_STATE_FILE,
  artifactSegmentRuntimeHost,
  artifactSupplementRuntimeHost,
  homeComponentRuntimeHost,
  workspaceWidgetRuntimeHost,
} from '../workspace-contract/artifact-runtime-url.js';
import { ARTIFACT_SCHEME } from './appShellConstants.js';

export const ARTIFACT_VENDOR_HOST = 'vendor';
export {
  ARTIFACT_RUNTIME_ASSETS_DIRECTORY,
  ARTIFACT_RUNTIME_ENTRY_FILE,
  ARTIFACT_RUNTIME_MANIFEST_FILE,
  ARTIFACT_RUNTIME_STATE_FILE,
  artifactSegmentRuntimeHost,
  artifactSupplementRuntimeHost,
  homeComponentRuntimeHost,
  workspaceWidgetRuntimeHost,
} from '../workspace-contract/artifact-runtime-url.js';

const ARTIFACT_MIME_BY_EXTENSION = new Map<string, string>([
  ['.html', 'text/html'],
  ['.json', 'application/json'],
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
      readonly fileScope: 'root' | 'asset';
      readonly fileName: string;
      readonly segmentId: string;
      readonly workspaceId: string;
    }
  | {
      readonly kind: 'supplement';
      readonly entry: boolean;
      readonly fileScope: 'root' | 'asset';
      readonly fileName: string;
      readonly segmentId: string;
      readonly supplementId: string;
      readonly workspaceId: string;
    }
  | {
      readonly kind: 'widget';
      readonly entry: boolean;
      readonly fileScope: 'root' | 'asset';
      readonly fileName: string;
      readonly widgetId: string;
      readonly workspaceId: string;
    }
  | {
      readonly kind: 'home-component';
      readonly componentId: string;
      readonly entry: boolean;
      readonly fileScope: 'root' | 'asset';
      readonly fileName: string;
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

function parseArtifactRuntimeFile(
  segments: readonly string[],
  fileStartIndex: number
): {
  readonly entry: boolean;
  readonly fileName: string;
  readonly fileScope: 'root' | 'asset';
} | null {
  const fileName = segments[fileStartIndex] ?? '';
  if (
    segments.length === fileStartIndex + 1 &&
    (fileName === ARTIFACT_RUNTIME_ENTRY_FILE ||
      fileName === ARTIFACT_RUNTIME_MANIFEST_FILE ||
      fileName === ARTIFACT_RUNTIME_STATE_FILE) &&
    artifactMimeTypeForFileName(fileName)
  ) {
    return {
      entry: fileName === ARTIFACT_RUNTIME_ENTRY_FILE,
      fileName,
      fileScope: 'root',
    };
  }

  const assetFileName = segments[fileStartIndex + 1] ?? '';
  if (
    segments.length === fileStartIndex + 2 &&
    fileName === ARTIFACT_RUNTIME_ASSETS_DIRECTORY &&
    !isHtmlFileName(assetFileName) &&
    artifactMimeTypeForFileName(assetFileName)
  ) {
    return {
      entry: false,
      fileName: assetFileName,
      fileScope: 'asset',
    };
  }

  return null;
}

export function parseArtifactRequestTarget(parsed: URL): ArtifactRequestTarget | null {
  if (parsed.protocol !== `${ARTIFACT_SCHEME}:`) {
    return null;
  }
  const segments = decodeArtifactPathSegments(parsed.pathname);
  if (!segments || !parsed.hostname) {
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

  if (segments[0] === 'home-components') {
    const componentId = segments[1] ?? '';
    if (!isSafeSinglePathSegment(componentId)) {
      return null;
    }
    const file = parseArtifactRuntimeFile(segments, 2);
    if (!file || parsed.hostname !== homeComponentRuntimeHost(componentId)) {
      return null;
    }
    return {
      kind: 'home-component',
      componentId,
      ...file,
    };
  }

  if (segments[0] !== 'workspaces') {
    return null;
  }

  const requestWorkspaceId = segments[1] ?? '';
  if (
    !isSafeSinglePathSegment(requestWorkspaceId) ||
    (segments[2] !== 'segments' && segments[2] !== 'widgets') ||
    !isSafeSinglePathSegment(segments[3] ?? '')
  ) {
    return null;
  }

  if (segments[2] === 'widgets') {
    const widgetId = segments[3] ?? '';
    const file = parseArtifactRuntimeFile(segments, 4);
    if (!file || parsed.hostname !== workspaceWidgetRuntimeHost(requestWorkspaceId, widgetId)) {
      return null;
    }
    return {
      kind: 'widget',
      workspaceId: requestWorkspaceId,
      widgetId,
      ...file,
    };
  }

  if (segments[4] !== 'supplements') {
    const segmentId = segments[3] ?? '';
    const file = parseArtifactRuntimeFile(segments, 4);
    if (!file || parsed.hostname !== artifactSegmentRuntimeHost(requestWorkspaceId, segmentId)) {
      return null;
    }
    return {
      kind: 'segment',
      workspaceId: requestWorkspaceId,
      segmentId,
      ...file,
    };
  }

  const segmentId = segments[3] ?? '';
  const supplementId = segments[5] ?? '';
  const file = parseArtifactRuntimeFile(segments, 6);
  if (
    !file ||
    !isSafeSinglePathSegment(segmentId) ||
    !isSafeSinglePathSegment(supplementId) ||
    parsed.hostname !== artifactSupplementRuntimeHost(requestWorkspaceId, segmentId, supplementId)
  ) {
    return null;
  }
  return {
    kind: 'supplement',
    workspaceId: requestWorkspaceId,
    segmentId,
    supplementId,
    ...file,
  };
}

export function isArtifactWorkspaceEntryUrl(url: URL): boolean {
  const target = parseArtifactRequestTarget(url);
  if (target?.kind === 'home-component') {
    return target.entry;
  }
  return (
    (target?.kind === 'segment' || target?.kind === 'supplement' || target?.kind === 'widget') &&
    target.entry &&
    target.workspaceId.length > 0
  );
}

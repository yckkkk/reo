import { closeSync, constants, fstatSync, readSync } from 'node:fs';
import path from 'node:path';
import {
  assertSameDirectoryIdentitySync,
  readSafeDirectoryIdentity,
  type DirectoryIdentity,
} from './directoryIdentity.js';
import { MAX_ARTIFACT_ASSET_BYTES, MAX_ARTIFACT_ENTRY_BYTES } from './artifactLimits.js';
import {
  ARTIFACT_RUNTIME_ASSETS_DIRECTORY,
  artifactMimeTypeForFileName,
  parseArtifactRequestTarget,
} from './artifactUrl.js';
import { openExistingWorkspaceFileInDirectory } from './workspaceDirectoryTransactions.js';
import { resolveArtifactRuntimeProtocolTargetDirectory } from './artifactRuntimeTarget.js';

export const ARTIFACT_PROTOCOL_CACHE_CONTROL = 'no-store';
export const ARTIFACT_VENDOR_PROTOCOL_CACHE_CONTROL = 'max-age=31536000, immutable';
export const ARTIFACT_PROTOCOL_CONTENT_SECURITY_POLICY =
  "default-src 'self' https: http: data: blob: reo-render:; script-src 'self' https: http: 'unsafe-inline' 'unsafe-eval' data: blob: reo-render:; style-src 'self' https: http: 'unsafe-inline' reo-render:; img-src 'self' https: http: data: blob: reo-render:; font-src 'self' https: http: data: reo-render:; media-src 'self' https: http: data: blob: reo-render:; connect-src 'self' https: http: ws: wss:; frame-src 'self' https: http:; worker-src 'self' https: http: blob: reo-render:; object-src 'none'; base-uri 'self'; form-action https: http:";

export type ArtifactRootResolution =
  | {
      readonly ok: true;
      readonly canonicalRoot: string;
    }
  | { readonly ok: false };

export type ArtifactRootResolver = (workspaceId: string) => ArtifactRootResolution;

export interface ArtifactProtocolOptions {
  readonly maxAssetBytes?: number | undefined;
  readonly maxEntryBytes?: number | undefined;
  readonly homeComponentAppDataRootPath?: string | undefined;
  readonly vendorRoot?: string | undefined;
}

type ArtifactProtocolResolution =
  | {
      readonly ok: true;
      readonly bytes: Uint8Array;
      readonly cacheControl: string;
      readonly contentSecurityPolicy: string;
      readonly mimeType: string;
    }
  | { readonly ok: false };

function readArtifactFileInKnownDirectory({
  directory,
  directoryIdentity,
  fileName,
  maxBytes,
}: {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly fileName: string;
  readonly maxBytes: number;
}): Uint8Array {
  const fd = openExistingWorkspaceFileInDirectory({
    directory,
    directoryIdentity,
    fileName,
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
  try {
    const stats = fstatSync(fd);
    if (!stats.isFile() || stats.size > maxBytes) {
      throw new Error('Artifact file is not safe');
    }
    const bytes = Buffer.allocUnsafe(stats.size);
    let offset = 0;
    while (offset < stats.size) {
      const bytesRead = readSync(fd, bytes, offset, stats.size - offset, offset);
      if (bytesRead === 0) {
        throw new Error('Artifact file changed during read');
      }
      offset += bytesRead;
    }
    assertSameDirectoryIdentitySync(directory, directoryIdentity, 'Artifact directory changed');
    return new Uint8Array(bytes);
  } finally {
    closeSync(fd);
  }
}

async function readArtifactFile({
  cacheControl,
  directory,
  fileScope = 'root',
  fileName,
  maxBytes,
}: {
  readonly cacheControl: string;
  readonly directory: string;
  readonly fileScope?: 'root' | 'asset' | undefined;
  readonly fileName: string;
  readonly maxBytes: number;
}): Promise<ArtifactProtocolResolution> {
  const mimeType = artifactMimeTypeForFileName(fileName);
  if (!mimeType) {
    return { ok: false };
  }
  try {
    const fileDirectory =
      fileScope === 'asset' ? path.join(directory, ARTIFACT_RUNTIME_ASSETS_DIRECTORY) : directory;
    const directoryIdentity = await readSafeDirectoryIdentity(
      fileDirectory,
      'Artifact directory is unsafe'
    );
    return {
      ok: true,
      bytes: readArtifactFileInKnownDirectory({
        directory: fileDirectory,
        directoryIdentity,
        fileName,
        maxBytes,
      }),
      cacheControl,
      contentSecurityPolicy: ARTIFACT_PROTOCOL_CONTENT_SECURITY_POLICY,
      mimeType,
    };
  } catch {
    return { ok: false };
  }
}

export async function resolveArtifactProtocolRequest(
  requestUrl: string,
  resolveArtifactRoot: ArtifactRootResolver,
  {
    maxAssetBytes = MAX_ARTIFACT_ASSET_BYTES,
    maxEntryBytes = MAX_ARTIFACT_ENTRY_BYTES,
    homeComponentAppDataRootPath,
    vendorRoot,
  }: ArtifactProtocolOptions = {}
): Promise<ArtifactProtocolResolution> {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return { ok: false };
  }
  const target = parseArtifactRequestTarget(parsed);
  if (!target) {
    return { ok: false };
  }

  if (target.kind === 'vendor') {
    if (!vendorRoot) {
      return { ok: false };
    }
    return readArtifactFile({
      cacheControl: ARTIFACT_VENDOR_PROTOCOL_CACHE_CONTROL,
      directory: path.join(vendorRoot, target.packageName),
      fileName: target.fileName,
      maxBytes: maxAssetBytes,
    });
  }

  if (target.kind === 'home-component') {
    try {
      if (!homeComponentAppDataRootPath) {
        return { ok: false };
      }
      const runtimeDirectory = await resolveArtifactRuntimeProtocolTargetDirectory({
        appDataRootPath: homeComponentAppDataRootPath,
        target,
      });
      return readArtifactFile({
        cacheControl: ARTIFACT_PROTOCOL_CACHE_CONTROL,
        directory: runtimeDirectory,
        fileScope: target.fileScope,
        fileName: target.fileName,
        maxBytes: target.entry ? maxEntryBytes : maxAssetBytes,
      });
    } catch {
      return { ok: false };
    }
  }

  const root = resolveArtifactRoot(target.workspaceId);
  if (!root.ok) {
    return { ok: false };
  }
  try {
    const runtimeDirectory = await resolveArtifactRuntimeProtocolTargetDirectory({
      rootPath: root.canonicalRoot,
      target,
    });
    return readArtifactFile({
      cacheControl: ARTIFACT_PROTOCOL_CACHE_CONTROL,
      directory: runtimeDirectory,
      fileScope: target.fileScope,
      fileName: target.fileName,
      maxBytes: target.entry ? maxEntryBytes : maxAssetBytes,
    });
  } catch {
    return { ok: false };
  }
}

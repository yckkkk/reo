import { closeSync, constants, fstatSync, readSync } from 'node:fs';
import path from 'node:path';
import {
  assertSameDirectoryIdentitySync,
  readSafeDirectoryIdentity,
  type DirectoryIdentity,
} from './directoryIdentity.js';
import { MAX_ARTIFACT_ASSET_BYTES, MAX_ARTIFACT_ENTRY_BYTES } from './artifactLimits.js';
import { artifactMimeTypeForFileName, parseArtifactRequestTarget } from './artifactUrl.js';
import {
  resolveFinalizedArtifactSegmentDirectoryFromManifest,
  resolveFinalizedArtifactSegmentSupplementDirectoryFromManifest,
} from './memoryFiles.js';
import { openExistingWorkspaceFileInDirectory } from './workspaceDirectoryTransactions.js';

export const ARTIFACT_PROTOCOL_CACHE_CONTROL = 'no-store';
export const ARTIFACT_VENDOR_PROTOCOL_CACHE_CONTROL = 'max-age=31536000, immutable';
export const ARTIFACT_PROTOCOL_CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'unsafe-inline' reo-artifact:; style-src 'unsafe-inline' reo-artifact:; img-src reo-artifact: data: blob:; font-src reo-artifact:; media-src reo-artifact: data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";

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
  fileName,
  maxBytes,
}: {
  readonly cacheControl: string;
  readonly directory: string;
  readonly fileName: string;
  readonly maxBytes: number;
}): Promise<ArtifactProtocolResolution> {
  const mimeType = artifactMimeTypeForFileName(fileName);
  if (!mimeType) {
    return { ok: false };
  }
  try {
    const directoryIdentity = await readSafeDirectoryIdentity(
      directory,
      'Artifact directory is unsafe'
    );
    return {
      ok: true,
      bytes: readArtifactFileInKnownDirectory({
        directory,
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

  const root = resolveArtifactRoot(target.workspaceId);
  if (!root.ok) {
    return { ok: false };
  }

  try {
    if (target.kind === 'segment') {
      const { segmentDirectory } = await resolveFinalizedArtifactSegmentDirectoryFromManifest({
        rootPath: root.canonicalRoot,
        workspaceId: target.workspaceId,
        segmentId: target.segmentId,
      });
      return readArtifactFile({
        cacheControl: ARTIFACT_PROTOCOL_CACHE_CONTROL,
        directory: segmentDirectory,
        fileName: target.fileName,
        maxBytes: target.entry ? maxEntryBytes : maxAssetBytes,
      });
    }

    const { supplementDirectory } =
      await resolveFinalizedArtifactSegmentSupplementDirectoryFromManifest({
        rootPath: root.canonicalRoot,
        workspaceId: target.workspaceId,
        segmentId: target.segmentId,
        supplementId: target.supplementId,
      });
    return readArtifactFile({
      cacheControl: ARTIFACT_PROTOCOL_CACHE_CONTROL,
      directory: supplementDirectory,
      fileName: target.fileName,
      maxBytes: target.entry ? maxEntryBytes : maxAssetBytes,
    });
  } catch {
    return { ok: false };
  }
}

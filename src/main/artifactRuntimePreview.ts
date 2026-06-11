import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  ARTIFACT_RUNTIME_ASSETS_DIRECTORY,
  ARTIFACT_RUNTIME_ENTRY_FILE,
  ARTIFACT_RUNTIME_MANIFEST_FILE,
} from './artifactUrl.js';
import { MAX_ARTIFACT_ASSET_BYTES } from './artifactLimits.js';

export type ArtifactRuntimePreviewFileDescriptor = {
  readonly byteLength: number;
  readonly hash: string;
};

export type ArtifactRuntimePreviewOptionalFileDescriptor =
  | { readonly status: 'file'; readonly byteLength: number; readonly hash: string }
  | { readonly status: 'missing' };

type CreateArtifactRuntimePreviewVersionOptions<DirectoryIdentity> = {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly entry: ArtifactRuntimePreviewFileDescriptor;
  readonly readDirectoryIdentity: (
    directory: string
  ) => DirectoryIdentity | Promise<DirectoryIdentity>;
  readonly readOptionalFileDescriptor: (
    directory: string,
    directoryIdentity: DirectoryIdentity,
    fileName: string,
    maxBytes: number
  ) => ArtifactRuntimePreviewOptionalFileDescriptor;
  readonly signature: string;
};

function appendPreviewDescriptor(
  hash: ReturnType<typeof createHash>,
  fileName: string,
  value: ArtifactRuntimePreviewOptionalFileDescriptor
): void {
  hash.update(fileName);
  hash.update('\0');
  hash.update(value.status);
  hash.update('\0');
  if (value.status === 'file') {
    hash.update(String(value.byteLength));
    hash.update('\0');
    hash.update(value.hash);
  }
  hash.update('\n');
}

export async function createArtifactRuntimePreviewVersion<DirectoryIdentity>({
  directory,
  directoryIdentity,
  entry,
  readDirectoryIdentity,
  readOptionalFileDescriptor,
  signature,
}: CreateArtifactRuntimePreviewVersionOptions<DirectoryIdentity>): Promise<string> {
  const hash = createHash('sha256');
  hash.update(`${signature}\n`);
  appendPreviewDescriptor(hash, ARTIFACT_RUNTIME_ENTRY_FILE, { status: 'file', ...entry });
  appendPreviewDescriptor(
    hash,
    ARTIFACT_RUNTIME_MANIFEST_FILE,
    readOptionalFileDescriptor(
      directory,
      directoryIdentity,
      ARTIFACT_RUNTIME_MANIFEST_FILE,
      MAX_ARTIFACT_ASSET_BYTES
    )
  );

  const assetsDirectory = path.join(directory, ARTIFACT_RUNTIME_ASSETS_DIRECTORY);
  try {
    const assetsIdentity = await readDirectoryIdentity(assetsDirectory);
    const entries = (await readdir(assetsDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
    for (const assetName of entries) {
      appendPreviewDescriptor(
        hash,
        `${ARTIFACT_RUNTIME_ASSETS_DIRECTORY}/${assetName}`,
        readOptionalFileDescriptor(
          assetsDirectory,
          assetsIdentity,
          assetName,
          MAX_ARTIFACT_ASSET_BYTES
        )
      );
    }
  } catch {
    appendPreviewDescriptor(hash, ARTIFACT_RUNTIME_ASSETS_DIRECTORY, { status: 'missing' });
  }
  return hash.digest('hex');
}

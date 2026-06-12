import { createHash } from 'node:crypto';
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
  | { readonly status: 'missing' }
  | { readonly status: 'blocked'; readonly reason: string }
  | { readonly status: 'oversized'; readonly byteLength: number };

type CreateArtifactRuntimePreviewVersionBaseOptions<DirectoryIdentity> = {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly entry: ArtifactRuntimePreviewFileDescriptor;
  readonly assertDirectoryIdentity?:
    | ((directory: string, directoryIdentity: DirectoryIdentity) => void)
    | undefined;
  readonly readOptionalFileDescriptor: (
    directory: string,
    directoryIdentity: DirectoryIdentity,
    fileName: string,
    maxBytes: number
  ) => ArtifactRuntimePreviewOptionalFileDescriptor;
  readonly signature: string;
};

type CreateArtifactRuntimePreviewVersionOptions<DirectoryIdentity> =
  CreateArtifactRuntimePreviewVersionBaseOptions<DirectoryIdentity> & {
    readonly readDirectoryEntries: (
      directory: string,
      directoryIdentity: DirectoryIdentity
    ) => readonly { readonly name: string }[] | Promise<readonly { readonly name: string }[]>;
    readonly readDirectoryIdentity: (
      directory: string
    ) => DirectoryIdentity | Promise<DirectoryIdentity>;
  };

type CreateArtifactRuntimePreviewVersionSyncOptions<DirectoryIdentity> =
  CreateArtifactRuntimePreviewVersionBaseOptions<DirectoryIdentity> & {
    readonly readDirectoryEntries: (
      directory: string,
      directoryIdentity: DirectoryIdentity
    ) => readonly { readonly name: string }[];
    readonly readDirectoryIdentity: (directory: string) => DirectoryIdentity;
  };

function directoryDescriptorFromError(
  error: unknown
): ArtifactRuntimePreviewOptionalFileDescriptor {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
    ? { status: 'missing' }
    : { status: 'blocked', reason: (error as NodeJS.ErrnoException).code ?? 'unknown' };
}

function appendPreviewDescriptor(
  hash: ReturnType<typeof createHash>,
  descriptor: {
    readonly fileName: string;
    readonly fileScope: 'asset' | 'root';
    readonly value: ArtifactRuntimePreviewOptionalFileDescriptor;
  }
): void {
  hash.update(`${JSON.stringify(descriptor)}\n`);
}

function appendRuntimeRootDescriptors<DirectoryIdentity>(
  hash: ReturnType<typeof createHash>,
  options: CreateArtifactRuntimePreviewVersionBaseOptions<DirectoryIdentity>
): void {
  appendPreviewDescriptor(hash, {
    fileName: ARTIFACT_RUNTIME_ENTRY_FILE,
    fileScope: 'root',
    value: { status: 'file', ...options.entry },
  });
  appendPreviewDescriptor(hash, {
    fileName: ARTIFACT_RUNTIME_MANIFEST_FILE,
    fileScope: 'root',
    value: options.readOptionalFileDescriptor(
      options.directory,
      options.directoryIdentity,
      ARTIFACT_RUNTIME_MANIFEST_FILE,
      MAX_ARTIFACT_ASSET_BYTES
    ),
  });
}

function assetDescriptorName(assetName: string): string {
  return `${ARTIFACT_RUNTIME_ASSETS_DIRECTORY}/${assetName}`;
}

function sortedDirectoryEntryNames(entries: readonly { readonly name: string }[]): string[] {
  return entries.map((entry) => entry.name).sort();
}

export function createArtifactRuntimePreviewVersionSync<DirectoryIdentity>(
  options: CreateArtifactRuntimePreviewVersionSyncOptions<DirectoryIdentity>
): string {
  const hash = createHash('sha256');
  hash.update(`${options.signature}\n`);
  appendRuntimeRootDescriptors(hash, options);

  const assetsDirectory = path.join(options.directory, ARTIFACT_RUNTIME_ASSETS_DIRECTORY);
  let assetsIdentity: DirectoryIdentity;
  try {
    assetsIdentity = options.readDirectoryIdentity(assetsDirectory);
  } catch (error) {
    appendPreviewDescriptor(hash, {
      fileName: ARTIFACT_RUNTIME_ASSETS_DIRECTORY,
      fileScope: 'root',
      value: directoryDescriptorFromError(error),
    });
    options.assertDirectoryIdentity?.(options.directory, options.directoryIdentity);
    return hash.digest('hex');
  }

  const entries = sortedDirectoryEntryNames(
    options.readDirectoryEntries(assetsDirectory, assetsIdentity)
  );
  for (const assetName of entries) {
    appendPreviewDescriptor(hash, {
      fileName: assetDescriptorName(assetName),
      fileScope: 'asset',
      value: options.readOptionalFileDescriptor(
        assetsDirectory,
        assetsIdentity,
        assetName,
        MAX_ARTIFACT_ASSET_BYTES
      ),
    });
  }

  options.assertDirectoryIdentity?.(options.directory, options.directoryIdentity);
  return hash.digest('hex');
}

export async function createArtifactRuntimePreviewVersion<DirectoryIdentity>(
  options: CreateArtifactRuntimePreviewVersionOptions<DirectoryIdentity>
): Promise<string> {
  const hash = createHash('sha256');
  hash.update(`${options.signature}\n`);
  appendRuntimeRootDescriptors(hash, options);

  const assetsDirectory = path.join(options.directory, ARTIFACT_RUNTIME_ASSETS_DIRECTORY);
  let assetsIdentity: DirectoryIdentity;
  try {
    assetsIdentity = await options.readDirectoryIdentity(assetsDirectory);
  } catch (error) {
    appendPreviewDescriptor(hash, {
      fileName: ARTIFACT_RUNTIME_ASSETS_DIRECTORY,
      fileScope: 'root',
      value: directoryDescriptorFromError(error),
    });
    options.assertDirectoryIdentity?.(options.directory, options.directoryIdentity);
    return hash.digest('hex');
  }

  const entries = sortedDirectoryEntryNames(
    await options.readDirectoryEntries(assetsDirectory, assetsIdentity)
  );
  for (const assetName of entries) {
    appendPreviewDescriptor(hash, {
      fileName: assetDescriptorName(assetName),
      fileScope: 'asset',
      value: options.readOptionalFileDescriptor(
        assetsDirectory,
        assetsIdentity,
        assetName,
        MAX_ARTIFACT_ASSET_BYTES
      ),
    });
  }

  options.assertDirectoryIdentity?.(options.directory, options.directoryIdentity);
  return hash.digest('hex');
}

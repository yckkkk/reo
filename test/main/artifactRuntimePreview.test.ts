import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  createArtifactRuntimePreviewVersion,
  createArtifactRuntimePreviewVersionSync,
  type ArtifactRuntimePreviewOptionalFileDescriptor,
} from '../../src/main/artifactRuntimePreview.js';

type TestIdentity = 'root' | 'assets';

const rootDirectory = '/runtime-bundle';
const assetsDirectory = path.join(rootDirectory, 'assets');

function descriptorFor(
  directory: string,
  _directoryIdentity: TestIdentity,
  fileName: string
): ArtifactRuntimePreviewOptionalFileDescriptor {
  if (directory === rootDirectory && fileName === 'runtime.json') {
    return { status: 'file', byteLength: 18, hash: 'runtime-hash' };
  }
  if (directory === assetsDirectory && fileName === 'main.css') {
    return { status: 'file', byteLength: 24, hash: 'main-css-hash' };
  }
  if (directory === assetsDirectory && fileName === 'nested') {
    return { status: 'blocked', reason: 'not-file' };
  }
  return { status: 'missing' };
}

test('artifact runtime preview version is shared by sync and async readers', async () => {
  const syncDescriptorReads: string[] = [];
  const asyncDescriptorReads: string[] = [];
  const common = {
    directory: rootDirectory,
    directoryIdentity: 'root' as const,
    entry: { byteLength: 42, hash: 'entry-hash' },
    readDirectoryEntries: (directory: string, directoryIdentity: TestIdentity) => {
      assert.equal(directory, assetsDirectory);
      assert.equal(directoryIdentity, 'assets');
      return [{ name: 'theme.css' }, { name: 'nested' }, { name: 'main.css' }];
    },
    readDirectoryIdentity: (directory: string) => {
      assert.equal(directory, assetsDirectory);
      return 'assets' as const;
    },
    signature: 'preview-test-v1',
  };

  const syncVersion = createArtifactRuntimePreviewVersionSync({
    ...common,
    readOptionalFileDescriptor: (directory, directoryIdentity, fileName) => {
      syncDescriptorReads.push(fileName);
      return descriptorFor(directory, directoryIdentity, fileName);
    },
  });

  const asyncVersion = await createArtifactRuntimePreviewVersion({
    ...common,
    readOptionalFileDescriptor: (directory, directoryIdentity, fileName) => {
      asyncDescriptorReads.push(fileName);
      return descriptorFor(directory, directoryIdentity, fileName);
    },
  });

  assert.equal(asyncVersion, syncVersion);
  assert.deepEqual(syncDescriptorReads, ['runtime.json', 'main.css', 'nested', 'theme.css']);
  assert.deepEqual(asyncDescriptorReads, syncDescriptorReads);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, stat, symlink, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setBeforeImagePayloadReadForTest } from '../../src/main/imagePayloads.js';
import {
  readMemoryCoverProjectionFromDirectory,
  resolveMemoryCoverFile,
} from '../../src/main/memoryCovers.js';

async function memoryDirectory(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-cover-'));
  const directory = path.join(root, 'memories', 'mem_cover');
  await mkdir(directory, { recursive: true });
  return directory;
}

test('memory cover projection picks the first valid image by filename with a cache version', async () => {
  const directory = await memoryDirectory();
  const coverDirectory = path.join(directory, 'cover');
  await mkdir(coverDirectory);
  await writeFile(path.join(coverDirectory, 'z-late.webp'), new Uint8Array([9, 9, 9]));
  await writeFile(path.join(coverDirectory, 'a-first.jpg'), new Uint8Array([1, 2, 3, 4]));
  await writeFile(path.join(coverDirectory, 'notes.txt'), 'not an image');

  const selected = await stat(path.join(coverDirectory, 'a-first.jpg'), { bigint: true });
  const projection = await readMemoryCoverProjectionFromDirectory(directory);

  assert.deepEqual(projection, {
    source: 'custom',
    filename: 'a-first.jpg',
    version: `${selected.mtimeNs.toString()}-${selected.size.toString()}`,
  });
});

test('memory cover projection accepts jpeg covers and skips oversized images', async () => {
  const directory = await memoryDirectory();
  const coverDirectory = path.join(directory, 'cover');
  await mkdir(coverDirectory);
  await writeFile(
    path.join(coverDirectory, 'a-too-large.png'),
    new Uint8Array(25 * 1024 * 1024 + 1)
  );
  await writeFile(path.join(coverDirectory, 'b-valid.jpeg'), new Uint8Array([1, 2, 3]));

  const selected = await stat(path.join(coverDirectory, 'b-valid.jpeg'), { bigint: true });
  const projection = await readMemoryCoverProjectionFromDirectory(directory);

  assert.deepEqual(projection, {
    source: 'custom',
    filename: 'b-valid.jpeg',
    version: `${selected.mtimeNs.toString()}-${selected.size.toString()}`,
  });
});

test('memory cover projection changes version for same-size replacements inside one millisecond', async () => {
  const directory = await memoryDirectory();
  const coverDirectory = path.join(directory, 'cover');
  const coverFile = path.join(coverDirectory, 'cover.png');
  await mkdir(coverDirectory);
  await writeFile(coverFile, new Uint8Array([1, 2, 3, 4]));
  await utimes(coverFile, 1, 1.000000001);

  const first = await readMemoryCoverProjectionFromDirectory(directory);

  await writeFile(coverFile, new Uint8Array([5, 6, 7, 8]));
  await utimes(coverFile, 1, 1.000000999);

  const second = await readMemoryCoverProjectionFromDirectory(directory);

  assert.equal(first.source, 'custom');
  assert.equal(second.source, 'custom');
  if (first.source === 'custom' && second.source === 'custom') {
    assert.equal(first.filename, 'cover.png');
    assert.equal(second.filename, 'cover.png');
    assert.notEqual(first.version, second.version);
  }
});

test('memory cover projection falls back to default for missing or unsafe cover directories', async () => {
  const directory = await memoryDirectory();

  assert.deepEqual(await readMemoryCoverProjectionFromDirectory(directory), { source: 'default' });

  await symlink(os.tmpdir(), path.join(directory, 'cover'));

  assert.deepEqual(await readMemoryCoverProjectionFromDirectory(directory), { source: 'default' });
});

test('memory cover protocol resolution returns bytes without raw filesystem paths', async () => {
  const directory = await memoryDirectory();
  const coverDirectory = path.join(directory, 'cover');
  await mkdir(coverDirectory);
  await writeFile(path.join(coverDirectory, 'garden.webp'), new Uint8Array([5, 6, 7]));

  const resolved = await resolveMemoryCoverFile({
    filename: 'garden.webp',
    memoryDirectoryPath: directory,
  });

  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  if (resolved.ok) {
    assert.deepEqual(Buffer.from(resolved.bytes), Buffer.from([5, 6, 7]));
    assert.equal(resolved.mimeType, 'image/webp');
    assert.equal('absolutePath' in resolved, false);
  }

  const traversal = await resolveMemoryCoverFile({
    filename: '../garden.webp',
    memoryDirectoryPath: directory,
  });
  assert.equal(traversal.ok, false);

  await writeFile(path.join(coverDirectory, 'garden.jpeg'), new Uint8Array([8, 9, 10]));
  const jpeg = await resolveMemoryCoverFile({
    filename: 'garden.jpeg',
    memoryDirectoryPath: directory,
  });
  assert.equal(jpeg.ok, true, JSON.stringify(jpeg));
  if (jpeg.ok) {
    assert.equal(jpeg.mimeType, 'image/jpeg');
  }
});

test('memory cover protocol resolution uses the shared async image payload reader', () => {
  const coverSource = readFileSync('src/main/memoryCovers.ts', 'utf8');
  const attachmentSource = readFileSync('src/main/noteAttachments.ts', 'utf8');

  assert.match(coverSource, /MEMORY_COVER_IMAGE_EXTENSIONS/);
  assert.match(coverSource, /readExistingImagePayloadInDirectory/);
  assert.doesNotMatch(coverSource, /readFileSync|fstatSync/);
  assert.match(attachmentSource, /NOTE_ATTACHMENT_IMAGE_EXTENSIONS/);
  assert.doesNotMatch(coverSource, /MEMORY_COVER_MIME_BY_EXTENSION/);
  assert.doesNotMatch(attachmentSource, /IMAGE_MIME_BY_EXTENSION/);
});

test('memory cover protocol reads can enter the async read gate concurrently', async () => {
  const directory = await memoryDirectory();
  const coverDirectory = path.join(directory, 'cover');
  await mkdir(coverDirectory);
  await writeFile(path.join(coverDirectory, 'first.png'), new Uint8Array([1, 2, 3]));
  await writeFile(path.join(coverDirectory, 'second.png'), new Uint8Array([4, 5, 6]));

  let entered = 0;
  let resolveBothEntered!: () => void;
  let releaseReads!: () => void;
  const bothEntered = new Promise<void>((resolve) => {
    resolveBothEntered = resolve;
  });
  const readGate = new Promise<void>((resolve) => {
    releaseReads = resolve;
  });

  setBeforeImagePayloadReadForTest(async ({ filename }) => {
    if (filename === 'first.png' || filename === 'second.png') {
      entered += 1;
      if (entered === 2) {
        resolveBothEntered();
      }
      await readGate;
    }
  });

  try {
    const first = resolveMemoryCoverFile({
      filename: 'first.png',
      memoryDirectoryPath: directory,
    });
    const second = resolveMemoryCoverFile({
      filename: 'second.png',
      memoryDirectoryPath: directory,
    });

    await Promise.race([
      bothEntered,
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('cover reads did not overlap')), 250);
      }),
    ]);
    releaseReads();

    const resolved = await Promise.all([first, second]);
    assert.deepEqual(
      resolved.map((result) => result.ok),
      [true, true]
    );
  } finally {
    setBeforeImagePayloadReadForTest(null);
  }
});

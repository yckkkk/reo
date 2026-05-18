import assert from 'node:assert/strict';
import { closeSync, existsSync, openSync, readdirSync } from 'node:fs';
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import {
  BackfillAudioDataSourceError,
  prepareBackfillAudioData,
} from '../../src/main/backfillAudioDataSource.js';

type LocalBackfillAudioDataSourceSpawn = (
  command: string,
  args: readonly string[]
) => FakeChildProcess;

class FakeChildProcess extends EventEmitter {
  killed = false;
  readonly stdin = new PassThrough();
  private readonly closeOnKill: boolean;

  constructor(closeOnKill = true) {
    super();
    this.closeOnKill = closeOnKill;
  }

  kill() {
    this.killed = true;
    if (this.closeOnKill) {
      this.emit('close', null);
    }
    return true;
  }
}

function createSuccessfulSpawn(): {
  readonly calls: Array<{ readonly args: readonly string[]; readonly command: string }>;
  readonly spawn: LocalBackfillAudioDataSourceSpawn;
} {
  const calls: Array<{ readonly args: readonly string[]; readonly command: string }> = [];
  return {
    calls,
    spawn: (command, args) => {
      calls.push({ args, command });
      const child = new FakeChildProcess();
      queueMicrotask(() => {
        void (async () => {
          const outputPath = args.at(-1);
          assert.equal(typeof outputPath, 'string');
          await writeFile(outputPath!, Buffer.from('ogg-opus-bytes'));
          child.emit('close', 0);
        })();
      });
      return child;
    },
  };
}

function createDeferred<T = void>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

test('backfill audio data source remuxes in-memory WebM Opus bytes to OGG Opus base64 and cleans temp files', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'reo-backfill-source-test-'));
  const { calls, spawn } = createSuccessfulSpawn();

  try {
    const result = await prepareBackfillAudioData({
      finalizedWebmBytes: Buffer.from('webm-opus-bytes'),
      ffmpegPath: '/safe/ffmpeg',
      spawn,
      temporaryRoot,
    });

    assert.deepEqual(result, {
      base64: Buffer.from('ogg-opus-bytes').toString('base64'),
      byteLength: Buffer.byteLength('ogg-opus-bytes'),
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    });
    assert.equal(calls[0]?.command, '/safe/ffmpeg');
    assert.deepEqual(calls[0]?.args.slice(0, 2), ['-y', '-i']);
    assert.equal(calls[0]?.args.includes('-vn'), true);
    assert.equal(calls[0]?.args.includes('copy'), true);
    assert.equal(calls[0]?.args.includes('ogg'), true);
    assert.equal(path.basename(calls[0]?.args.at(-1) ?? ''), 'output.ogg');
    assert.deepEqual(
      readdirSync(temporaryRoot).filter((entry) => entry.startsWith('reo-backfill-audio-')),
      []
    );
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});

test('backfill audio data source remuxes from an existing file descriptor without copying input bytes', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'reo-backfill-source-fd-test-'));
  const sourcePath = path.join(temporaryRoot, 'source.webm');
  await writeFile(sourcePath, Buffer.from('webm-opus-bytes'));
  const fd = openSync(sourcePath, 'r');
  const calls: Array<{ readonly args: readonly string[]; readonly command: string }> = [];
  const stdinChunks: Buffer[] = [];

  try {
    const result = await prepareBackfillAudioData({
      finalizedWebmByteLength: Buffer.byteLength('webm-opus-bytes'),
      finalizedWebmFileDescriptor: fd,
      ffmpegPath: '/safe/ffmpeg',
      spawn: (command, args) => {
        calls.push({ args, command });
        const child = new FakeChildProcess();
        const outputPath = args.at(-1);
        child.stdin.on('data', (chunk: Buffer) => {
          stdinChunks.push(chunk);
        });
        child.stdin.on('end', () => {
          void (async () => {
            assert.equal(Buffer.concat(stdinChunks).toString('utf8'), 'webm-opus-bytes');
            assert.equal(typeof outputPath, 'string');
            await writeFile(outputPath!, Buffer.from('ogg-opus-bytes'));
            child.emit('close', 0);
          })();
        });
        queueMicrotask(() => {
          assert.equal(args.includes('pipe:0'), true);
        });
        return child;
      },
      temporaryRoot,
    });

    assert.deepEqual(result, {
      base64: Buffer.from('ogg-opus-bytes').toString('base64'),
      byteLength: Buffer.byteLength('ogg-opus-bytes'),
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    });
    assert.equal(calls[0]?.args.includes(path.join(temporaryRoot, 'input.webm')), false);
  } finally {
    closeSync(fd);
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});

test('backfill audio data source caps fd pumping at the verified byte length', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'reo-backfill-source-fd-cap-test-'));
  const sourcePath = path.join(temporaryRoot, 'source.webm');
  await writeFile(sourcePath, Buffer.from('webm'));
  const fd = openSync(sourcePath, 'r');
  const stdinChunks: Buffer[] = [];

  try {
    await appendFile(sourcePath, Buffer.from('-extra'));
    const result = await prepareBackfillAudioData({
      finalizedWebmByteLength: Buffer.byteLength('webm'),
      finalizedWebmFileDescriptor: fd,
      ffmpegPath: '/safe/ffmpeg',
      spawn: (_command, args) => {
        const child = new FakeChildProcess();
        const outputPath = args.at(-1);
        child.stdin.on('data', (chunk: Buffer) => {
          stdinChunks.push(chunk);
        });
        child.stdin.on('end', () => {
          void (async () => {
            assert.equal(Buffer.concat(stdinChunks).toString('utf8'), 'webm');
            assert.equal(typeof outputPath, 'string');
            await writeFile(outputPath!, Buffer.from('ogg-opus-bytes'));
            child.emit('close', 0);
          })();
        });
        return child;
      },
      temporaryRoot,
    });

    assert.equal(result.byteLength, Buffer.byteLength('ogg-opus-bytes'));
  } finally {
    closeSync(fd);
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});

test('backfill audio data source rejects empty oversized and failed conversions with typed redacted errors', async () => {
  await assert.rejects(
    () =>
      prepareBackfillAudioData({ finalizedWebmBytes: Buffer.alloc(0), ffmpegPath: '/safe/ffmpeg' }),
    (error: unknown) =>
      error instanceof BackfillAudioDataSourceError && error.code === 'empty-audio'
  );

  await assert.rejects(
    () =>
      prepareBackfillAudioData({
        finalizedWebmBytes: Buffer.alloc(4),
        ffmpegPath: '/safe/ffmpeg',
        maxInputBytes: 3,
      }),
    (error: unknown) => error instanceof BackfillAudioDataSourceError && error.code === 'size'
  );

  await assert.rejects(
    () =>
      prepareBackfillAudioData({
        finalizedWebmBytes: Buffer.alloc(4),
        ffmpegPath: '/safe/ffmpeg',
        maxOutputBytes: 3,
        spawn: (_command, args) => {
          const child = new FakeChildProcess();
          queueMicrotask(
            () =>
              void (async () => {
                const outputPath = args.at(-1);
                assert.equal(typeof outputPath, 'string');
                await writeFile(outputPath!, Buffer.alloc(4));
                child.emit('close', 0);
              })()
          );
          return child;
        },
      }),
    (error: unknown) => error instanceof BackfillAudioDataSourceError && error.code === 'size'
  );

  await assert.rejects(
    () =>
      prepareBackfillAudioData({
        finalizedWebmBytes: Buffer.from('webm'),
        ffmpegPath: '/very/secret/raw/path/ffmpeg',
        spawn: () => {
          const child = new FakeChildProcess();
          queueMicrotask(() => child.emit('close', 1));
          return child;
        },
      }),
    (error: unknown) => {
      assert.equal(error instanceof BackfillAudioDataSourceError, true);
      assert.equal((error as BackfillAudioDataSourceError).code, 'format');
      assert.equal(String((error as Error).message).includes('/very/secret/raw/path'), false);
      return true;
    }
  );
});

test('backfill audio data source aborts conversion and removes its temp directory', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'reo-backfill-source-abort-test-'));
  const controller = new AbortController();
  const holder: { child: FakeChildProcess | null } = { child: null };
  const childStarted = createDeferred<FakeChildProcess>();

  try {
    const promise = prepareBackfillAudioData({
      finalizedWebmBytes: Buffer.from('webm'),
      ffmpegPath: '/safe/ffmpeg',
      signal: controller.signal,
      spawn: () => {
        holder.child = new FakeChildProcess(false);
        childStarted.resolve(holder.child);
        return holder.child;
      },
      temporaryRoot,
    });

    await childStarted.promise;
    controller.abort();
    assert.notDeepEqual(readdirSync(temporaryRoot), []);
    holder.child?.emit('close', null);
    await assert.rejects(
      () => promise,
      (error: unknown) => error instanceof BackfillAudioDataSourceError && error.code === 'abort'
    );
    assert.equal(holder.child?.killed, true);
    assert.deepEqual(
      readdirSync(temporaryRoot).filter((entry) => entry.startsWith('reo-backfill-audio-')),
      []
    );
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});

test('backfill audio data source aborts an active fd pump and removes its temp directory', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'reo-backfill-source-fd-abort-test-'));
  const sourcePath = path.join(temporaryRoot, 'source.webm');
  await writeFile(sourcePath, Buffer.alloc(128 * 1024, 7));
  const fd = openSync(sourcePath, 'r');
  const controller = new AbortController();
  const holder: { child: FakeChildProcess | null } = { child: null };
  const firstChunk = createDeferred<void>();

  try {
    const promise = prepareBackfillAudioData({
      finalizedWebmByteLength: 128 * 1024,
      finalizedWebmFileDescriptor: fd,
      ffmpegPath: '/safe/ffmpeg',
      signal: controller.signal,
      spawn: () => {
        holder.child = new FakeChildProcess(false);
        holder.child.stdin.on('data', () => {
          firstChunk.resolve();
          holder.child?.stdin.pause();
        });
        return holder.child;
      },
      temporaryRoot,
    });

    await firstChunk.promise;
    controller.abort();
    assert.notDeepEqual(readdirSync(temporaryRoot), []);
    holder.child?.emit('close', null);
    await assert.rejects(
      () => promise,
      (error: unknown) => error instanceof BackfillAudioDataSourceError && error.code === 'abort'
    );
    assert.equal(holder.child?.killed, true);
    assert.equal(holder.child?.stdin.destroyed, true);
    assert.deepEqual(
      readdirSync(temporaryRoot).filter((entry) => entry.startsWith('reo-backfill-audio-')),
      []
    );
  } finally {
    closeSync(fd);
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});

test('backfill audio data source aborts an active fd pump even when ffmpeg never closes', async () => {
  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), 'reo-backfill-source-fd-abort-timeout-test-')
  );
  const sourcePath = path.join(temporaryRoot, 'source.webm');
  await writeFile(sourcePath, Buffer.alloc(128 * 1024, 7));
  const fd = openSync(sourcePath, 'r');
  const controller = new AbortController();
  const holder: { child: FakeChildProcess | null } = { child: null };
  const firstChunk = createDeferred<void>();

  try {
    const promise = prepareBackfillAudioData({
      abortCloseTimeoutMs: 5,
      finalizedWebmByteLength: 128 * 1024,
      finalizedWebmFileDescriptor: fd,
      ffmpegPath: '/safe/ffmpeg',
      signal: controller.signal,
      spawn: () => {
        holder.child = new FakeChildProcess(false);
        holder.child.stdin.on('data', () => {
          firstChunk.resolve();
          holder.child?.stdin.pause();
        });
        return holder.child;
      },
      temporaryRoot,
    });

    await firstChunk.promise;
    controller.abort();
    assert.equal(holder.child?.stdin.destroyed, true);
    await assert.rejects(
      () => promise,
      (error: unknown) => error instanceof BackfillAudioDataSourceError && error.code === 'abort'
    );
    assert.equal(holder.child?.killed, true);
    assert.deepEqual(
      readdirSync(temporaryRoot).filter((entry) => entry.startsWith('reo-backfill-audio-')),
      []
    );
  } finally {
    closeSync(fd);
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});

test('backfill audio data source resolves abort even when ffmpeg never closes', async () => {
  const controller = new AbortController();
  const holder: { child: FakeChildProcess | null } = { child: null };
  const childStarted = createDeferred<FakeChildProcess>();
  const promise = prepareBackfillAudioData({
    abortCloseTimeoutMs: 5,
    finalizedWebmBytes: Buffer.from('webm'),
    ffmpegPath: '/safe/ffmpeg',
    signal: controller.signal,
    spawn: () => {
      holder.child = new FakeChildProcess(false);
      childStarted.resolve(holder.child);
      return holder.child;
    },
  });

  await childStarted.promise;
  controller.abort();

  const result = await Promise.race([
    promise.then(
      () => 'resolved',
      (error: unknown) =>
        error instanceof BackfillAudioDataSourceError && error.code === 'abort' ? 'abort' : 'other'
    ),
    new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 25)),
  ]);

  assert.equal(result, 'abort');
  assert.equal(holder.child?.killed, true);
});

test('backfill audio data source defaults to packaged ffmpeg installer binary', async () => {
  const { calls, spawn } = createSuccessfulSpawn();

  await prepareBackfillAudioData({
    finalizedWebmBytes: Buffer.from('webm-opus-bytes'),
    spawn,
  });

  const command = calls[0]?.command ?? '';
  assert.equal(command.length > 0, true);
  assert.equal(existsSync(command), true);
});

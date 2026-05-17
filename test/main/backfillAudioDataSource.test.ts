import assert from 'node:assert/strict';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { EventEmitter } from 'node:events';
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
        const outputPath = args.at(-1);
        if (outputPath) {
          writeFileSync(outputPath, Buffer.from('ogg-opus-bytes'));
        }
        child.emit('close', 0);
      });
      return child;
    },
  };
}

async function waitForChild(holder: { readonly child: FakeChildProcess | null }) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (holder.child) {
      return holder.child;
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error('expected ffmpeg process to start');
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
    assert.deepEqual(readdirSync(temporaryRoot), []);
  } finally {
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
          queueMicrotask(() => {
            const outputPath = args.at(-1);
            if (outputPath) {
              writeFileSync(outputPath, Buffer.alloc(4));
            }
            child.emit('close', 0);
          });
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

  try {
    const promise = prepareBackfillAudioData({
      finalizedWebmBytes: Buffer.from('webm'),
      ffmpegPath: '/safe/ffmpeg',
      signal: controller.signal,
      spawn: () => {
        holder.child = new FakeChildProcess(false);
        return holder.child;
      },
      temporaryRoot,
    });

    await waitForChild(holder);
    controller.abort();
    assert.notDeepEqual(readdirSync(temporaryRoot), []);
    holder.child?.emit('close', null);
    await assert.rejects(
      () => promise,
      (error: unknown) => error instanceof BackfillAudioDataSourceError && error.code === 'abort'
    );
    assert.equal(holder.child?.killed, true);
    assert.deepEqual(readdirSync(temporaryRoot), []);
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});

test('backfill audio data source resolves abort even when ffmpeg never closes', async () => {
  const controller = new AbortController();
  const holder: { child: FakeChildProcess | null } = { child: null };
  const promise = prepareBackfillAudioData({
    abortCloseTimeoutMs: 5,
    finalizedWebmBytes: Buffer.from('webm'),
    ffmpegPath: '/safe/ffmpeg',
    signal: controller.signal,
    spawn: () => {
      holder.child = new FakeChildProcess(false);
      return holder.child;
    },
  });

  await waitForChild(holder);
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

import { spawn } from 'node:child_process';
import { read } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { MAX_BACKFILL_AUDIO_READ_BYTES } from '../workspace-contract/recording-audio.js';

const require = createRequire(import.meta.url);
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg') as { readonly path: string };

export const BACKFILL_AUDIO_MAX_INPUT_BYTES = MAX_BACKFILL_AUDIO_READ_BYTES;
export const BACKFILL_AUDIO_MAX_OUTPUT_BYTES = MAX_BACKFILL_AUDIO_READ_BYTES;

export type BackfillAudioDataSourceErrorCode = 'abort' | 'empty-audio' | 'format' | 'size';

export class BackfillAudioDataSourceError extends Error {
  readonly code: BackfillAudioDataSourceErrorCode;

  constructor(code: BackfillAudioDataSourceErrorCode) {
    super(`Backfill audio data source failed: ${code}.`);
    this.code = code;
    this.name = 'BackfillAudioDataSourceError';
  }
}

export type BackfillAudioDataSourceSpawnedProcess = {
  readonly kill: () => boolean;
  readonly on: (
    event: 'close' | 'error',
    listener: (payload: Error | number | null) => void
  ) => BackfillAudioDataSourceSpawnedProcess;
  readonly stdin?: NodeJS.WritableStream | null;
};

export type BackfillAudioDataSourceSpawn = (
  command: string,
  args: readonly string[]
) => BackfillAudioDataSourceSpawnedProcess;

export type PrepareBackfillAudioDataInput = {
  readonly abortCloseTimeoutMs?: number;
  readonly ffmpegPath?: string;
  readonly finalizedWebmByteLength?: number;
  readonly finalizedWebmBytes?: Uint8Array;
  readonly finalizedWebmFileDescriptor?: number;
  readonly maxInputBytes?: number;
  readonly maxOutputBytes?: number;
  readonly signal?: AbortSignal;
  readonly spawn?: BackfillAudioDataSourceSpawn;
  readonly temporaryRoot?: string;
};

export type PreparedBackfillAudioData = {
  readonly base64: string;
  readonly byteLength: number;
  readonly contentType: 'audio/ogg; codecs=opus';
  readonly format: 'ogg-opus';
};

function createDefaultSpawn(command: string, args: readonly string[]) {
  return spawn(command, [...args], { stdio: ['pipe', 'ignore', 'ignore'] });
}

function toBuffer(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function ensureUsableInput(byteLength: number, maxInputBytes: number) {
  if (byteLength === 0) {
    throw new BackfillAudioDataSourceError('empty-audio');
  }
  if (byteLength > maxInputBytes) {
    throw new BackfillAudioDataSourceError('size');
  }
}

function readFileDescriptorChunk(fd: number, buffer: Buffer): Promise<number> {
  return new Promise((resolve, reject) => {
    read(fd, buffer, 0, buffer.length, null, (error, bytesRead) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(bytesRead);
    });
  });
}

function waitForWritableDrain(stream: NodeJS.WritableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      stream.removeListener('drain', onDrain);
      stream.removeListener('error', onError);
    };
    stream.once('drain', onDrain);
    stream.once('error', onError);
  });
}

async function pumpFileDescriptorToStdin({
  fd,
  expectedByteLength,
  shouldContinue,
  stdin,
}: {
  readonly fd: number;
  readonly expectedByteLength: number;
  readonly shouldContinue: () => boolean;
  readonly stdin: NodeJS.WritableStream;
}): Promise<void> {
  const buffer = Buffer.allocUnsafe(64 * 1024);
  let remainingBytes = expectedByteLength;
  while (shouldContinue() && remainingBytes > 0) {
    const readBuffer = remainingBytes < buffer.length ? buffer.subarray(0, remainingBytes) : buffer;
    const bytesRead = await readFileDescriptorChunk(fd, readBuffer);
    if (!shouldContinue()) {
      break;
    }
    if (bytesRead === 0) {
      throw new BackfillAudioDataSourceError('format');
    }
    remainingBytes -= bytesRead;
    const chunk = buffer.subarray(0, bytesRead);
    if (!stdin.write(chunk) && shouldContinue()) {
      await waitForWritableDrain(stdin);
    }
  }
  if (shouldContinue()) {
    stdin.end();
  }
}

function resolveInputByteLength({
  finalizedWebmByteLength,
  finalizedWebmBytes,
}: Pick<PrepareBackfillAudioDataInput, 'finalizedWebmByteLength' | 'finalizedWebmBytes'>) {
  return finalizedWebmBytes?.byteLength ?? finalizedWebmByteLength ?? 0;
}

function remuxWithFfmpeg({
  ffmpegPath,
  inputByteLength,
  inputFileDescriptor,
  inputPath,
  outputPath,
  signal,
  spawnProcess,
  abortCloseTimeoutMs,
}: {
  readonly abortCloseTimeoutMs: number;
  readonly ffmpegPath: string;
  readonly inputByteLength: number;
  readonly inputFileDescriptor?: number | undefined;
  readonly inputPath: string;
  readonly outputPath: string;
  readonly signal?: AbortSignal | undefined;
  readonly spawnProcess: BackfillAudioDataSourceSpawn;
}) {
  if (signal?.aborted) {
    return Promise.reject(new BackfillAudioDataSourceError('abort'));
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let abortRequested = false;
    let abortTimeout: NodeJS.Timeout | null = null;
    let child: BackfillAudioDataSourceSpawnedProcess | null = null;
    let pumpCanceled = false;
    let stdin: NodeJS.WritableStream | null = null;
    let stdinErrorListener: (() => void) | null = null;

    function settle(error?: BackfillAudioDataSourceError) {
      if (settled) return;
      settled = true;
      pumpCanceled = true;
      if (stdin) {
        if (stdinErrorListener) {
          stdin.removeListener('error', stdinErrorListener);
        }
        (stdin as { destroy?: () => void }).destroy?.();
        stdin = null;
        stdinErrorListener = null;
      }
      if (abortTimeout) {
        clearTimeout(abortTimeout);
        abortTimeout = null;
      }
      signal?.removeEventListener('abort', abort);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    }

    function abort() {
      if (settled) return;
      abortRequested = true;
      pumpCanceled = true;
      if (stdin) {
        if (stdinErrorListener) {
          stdin.removeListener('error', stdinErrorListener);
        }
        (stdin as { destroy?: () => void }).destroy?.();
        stdin = null;
        stdinErrorListener = null;
      }
      if (!child) {
        settle(new BackfillAudioDataSourceError('abort'));
        return;
      }
      const killed = child.kill();
      if (!killed) {
        settle(new BackfillAudioDataSourceError('abort'));
        return;
      }
      abortTimeout = setTimeout(
        () => settle(new BackfillAudioDataSourceError('abort')),
        abortCloseTimeoutMs
      );
    }

    try {
      child = spawnProcess(ffmpegPath, [
        '-y',
        '-i',
        inputFileDescriptor === undefined ? inputPath : 'pipe:0',
        '-vn',
        '-c:a',
        'copy',
        '-f',
        'ogg',
        outputPath,
      ]);
    } catch {
      settle(new BackfillAudioDataSourceError('format'));
      return;
    }
    if (inputFileDescriptor !== undefined && !child.stdin) {
      settle(new BackfillAudioDataSourceError('format'));
      return;
    }

    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    if (inputFileDescriptor !== undefined && child.stdin) {
      stdin = child.stdin;
      stdinErrorListener = () => {
        if (!settled && !abortRequested) {
          settle(new BackfillAudioDataSourceError('format'));
          child?.kill();
        }
      };
      stdin.on('error', stdinErrorListener);
      void pumpFileDescriptorToStdin({
        expectedByteLength: inputByteLength,
        fd: inputFileDescriptor,
        shouldContinue: () => !pumpCanceled && !settled,
        stdin,
      }).catch(() => {
        if (!settled && !abortRequested) {
          settle(new BackfillAudioDataSourceError('format'));
          child?.kill();
        }
      });
    }
    child
      .on('error', () => settle(new BackfillAudioDataSourceError('format')))
      .on('close', (payload) => {
        if (abortRequested) {
          settle(new BackfillAudioDataSourceError('abort'));
          return;
        }
        const code = typeof payload === 'number' ? payload : null;
        settle(code === 0 ? undefined : new BackfillAudioDataSourceError('format'));
      });
  });
}

async function readRemuxedOutput(outputPath: string, maxOutputBytes: number) {
  const output = await stat(outputPath);
  if (!output.isFile()) {
    throw new BackfillAudioDataSourceError('format');
  }
  if (output.size === 0) {
    throw new BackfillAudioDataSourceError('format');
  }
  if (output.size > maxOutputBytes) {
    throw new BackfillAudioDataSourceError('size');
  }
  return {
    base64: await readFile(outputPath, 'base64'),
    byteLength: output.size,
  };
}

export async function prepareBackfillAudioData({
  abortCloseTimeoutMs = 1_000,
  ffmpegPath = ffmpegInstaller.path,
  finalizedWebmByteLength,
  finalizedWebmBytes,
  finalizedWebmFileDescriptor,
  maxInputBytes = BACKFILL_AUDIO_MAX_INPUT_BYTES,
  maxOutputBytes = BACKFILL_AUDIO_MAX_OUTPUT_BYTES,
  signal,
  spawn: spawnProcess = createDefaultSpawn,
  temporaryRoot = tmpdir(),
}: PrepareBackfillAudioDataInput): Promise<PreparedBackfillAudioData> {
  const inputByteLength =
    finalizedWebmBytes === undefined
      ? resolveInputByteLength({
          ...(finalizedWebmByteLength !== undefined && { finalizedWebmByteLength }),
        })
      : resolveInputByteLength({ finalizedWebmBytes });
  ensureUsableInput(inputByteLength, maxInputBytes);
  if (
    (finalizedWebmBytes === undefined && finalizedWebmFileDescriptor === undefined) ||
    (finalizedWebmBytes !== undefined && finalizedWebmFileDescriptor !== undefined)
  ) {
    throw new BackfillAudioDataSourceError('format');
  }
  const temporaryDirectory = await mkdtemp(path.join(temporaryRoot, 'reo-backfill-audio-'));
  const inputPath = path.join(temporaryDirectory, 'input.webm');
  const outputPath = path.join(temporaryDirectory, 'output.ogg');

  try {
    if (finalizedWebmBytes !== undefined) {
      await writeFile(inputPath, toBuffer(finalizedWebmBytes));
    }
    await remuxWithFfmpeg({
      abortCloseTimeoutMs,
      ffmpegPath,
      inputByteLength,
      inputFileDescriptor: finalizedWebmFileDescriptor,
      inputPath,
      outputPath,
      signal,
      spawnProcess,
    });
    const output = await readRemuxedOutput(outputPath, maxOutputBytes);
    return {
      base64: output.base64,
      byteLength: output.byteLength,
      contentType: 'audio/ogg; codecs=opus',
      format: 'ogg-opus',
    };
  } catch (error) {
    if (error instanceof BackfillAudioDataSourceError) {
      throw error;
    }
    throw new BackfillAudioDataSourceError('format');
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

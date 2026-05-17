import { spawn } from 'node:child_process';
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
};

export type BackfillAudioDataSourceSpawn = (
  command: string,
  args: readonly string[]
) => BackfillAudioDataSourceSpawnedProcess;

export type PrepareBackfillAudioDataInput = {
  readonly abortCloseTimeoutMs?: number;
  readonly ffmpegPath?: string;
  readonly finalizedWebmBytes: Uint8Array;
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
  return spawn(command, [...args], { stdio: 'ignore' });
}

function toBuffer(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function ensureUsableInput(bytes: Uint8Array, maxInputBytes: number) {
  if (bytes.byteLength === 0) {
    throw new BackfillAudioDataSourceError('empty-audio');
  }
  if (bytes.byteLength > maxInputBytes) {
    throw new BackfillAudioDataSourceError('size');
  }
}

function remuxWithFfmpeg({
  ffmpegPath,
  inputPath,
  outputPath,
  signal,
  spawnProcess,
  abortCloseTimeoutMs,
}: {
  readonly abortCloseTimeoutMs: number;
  readonly ffmpegPath: string;
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
    let child: BackfillAudioDataSourceSpawnedProcess;

    function settle(error?: BackfillAudioDataSourceError) {
      if (settled) return;
      settled = true;
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
        inputPath,
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

    signal?.addEventListener('abort', abort, { once: true });
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

export async function prepareBackfillAudioData({
  abortCloseTimeoutMs = 1_000,
  ffmpegPath = ffmpegInstaller.path,
  finalizedWebmBytes,
  maxInputBytes = BACKFILL_AUDIO_MAX_INPUT_BYTES,
  maxOutputBytes = BACKFILL_AUDIO_MAX_OUTPUT_BYTES,
  signal,
  spawn: spawnProcess = createDefaultSpawn,
  temporaryRoot = tmpdir(),
}: PrepareBackfillAudioDataInput): Promise<PreparedBackfillAudioData> {
  ensureUsableInput(finalizedWebmBytes, maxInputBytes);
  const temporaryDirectory = await mkdtemp(path.join(temporaryRoot, 'reo-backfill-audio-'));
  const inputPath = path.join(temporaryDirectory, 'input.webm');
  const outputPath = path.join(temporaryDirectory, 'output.ogg');

  try {
    await writeFile(inputPath, toBuffer(finalizedWebmBytes));
    await remuxWithFfmpeg({
      abortCloseTimeoutMs,
      ffmpegPath,
      inputPath,
      outputPath,
      signal,
      spawnProcess,
    });
    const outputStat = await stat(outputPath);
    if (outputStat.size > maxOutputBytes) {
      throw new BackfillAudioDataSourceError('size');
    }
    const bytes = await readFile(outputPath);
    if (bytes.byteLength === 0) {
      throw new BackfillAudioDataSourceError('format');
    }
    return {
      base64: bytes.toString('base64'),
      byteLength: bytes.byteLength,
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

import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import type { NoteSpeechSynthesisManifest } from './noteSpeechSynthesisManifest.js';
import {
  workspaceError,
  workspaceNoteSpeechSynthesisProjectionSchema,
} from '../workspace-contract/workspace-contract.js';

export const NOTE_SPEECH_AUDIO_FILE_NAME = 'speech.mp3';
export const NOTE_SPEECH_AUDIO_BACKUP_FILE_PREFIX = '.speech-backup-';

export type NoteSpeechSynthesisProjection = z.infer<
  typeof workspaceNoteSpeechSynthesisProjectionSchema
>;

export function noteContentHash(bodyMarkdown: string): string {
  return createHash('sha256').update(bodyMarkdown).digest('hex');
}

export function noteSpeechAudioHash(audio: Uint8Array): string {
  return createHash('sha256').update(audio).digest('hex');
}

export function missingNoteSpeechSynthesisProjection(): NoteSpeechSynthesisProjection {
  return {
    status: 'missing',
    audioByteLength: null,
    contentHash: null,
    format: null,
    lastSynthesisAttempt: 'never',
    mimeType: null,
    model: null,
    reason: null,
    resourceId: null,
    sampleRate: null,
    speaker: null,
    updatedAt: null,
  };
}

export function noteSpeechSynthesisProjectionFromManifest({
  manifest,
  status,
}: {
  readonly manifest: NoteSpeechSynthesisManifest;
  readonly status: 'ready' | 'stale' | 'failed' | 'unsupported';
}): NoteSpeechSynthesisProjection {
  return {
    status,
    audioByteLength: manifest.audioByteLength,
    contentHash: manifest.contentHash,
    format: manifest.format,
    lastSynthesisAttempt: manifest.lastSynthesisAttempt,
    mimeType: manifest.mimeType,
    model: manifest.model,
    reason: manifest.reason ?? null,
    resourceId: manifest.resourceId,
    sampleRate: manifest.sampleRate,
    speaker: manifest.speaker,
    updatedAt: manifest.updatedAt,
  };
}

async function speechAudioFileExistsWithByteLength({
  expectedByteLength,
  filePath,
}: {
  readonly expectedByteLength: number;
  readonly filePath: string;
}): Promise<boolean> {
  let file;
  try {
    file = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    if (['ELOOP', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
      throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace file path is unsafe');
    }
    throw error;
  }
  try {
    const metadata = await file.stat();
    if (!metadata.isFile()) {
      throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace file path is unsafe');
    }
    return metadata.size === expectedByteLength;
  } finally {
    await file.close().catch(() => {});
  }
}

export async function readNoteSpeechSynthesisProjectionFromManifest({
  currentContentHash,
  manifest,
  objectDirectory,
}: {
  readonly currentContentHash: string;
  readonly manifest: {
    readonly speechSynthesis?: NoteSpeechSynthesisManifest | undefined;
  };
  readonly objectDirectory: string;
}): Promise<NoteSpeechSynthesisProjection> {
  if (!manifest.speechSynthesis) {
    return missingNoteSpeechSynthesisProjection();
  }
  const speechAudioExists = await speechAudioFileExistsWithByteLength({
    expectedByteLength: manifest.speechSynthesis.audioByteLength,
    filePath: path.join(objectDirectory, NOTE_SPEECH_AUDIO_FILE_NAME),
  });
  if (!speechAudioExists || manifest.speechSynthesis.lastSynthesisAttempt !== 'success') {
    return noteSpeechSynthesisProjectionFromManifest({
      manifest: manifest.speechSynthesis,
      status: manifest.speechSynthesis.reason === 'text-too-long' ? 'unsupported' : 'failed',
    });
  }
  return noteSpeechSynthesisProjectionFromManifest({
    manifest: manifest.speechSynthesis,
    status: manifest.speechSynthesis.contentHash === currentContentHash ? 'ready' : 'stale',
  });
}

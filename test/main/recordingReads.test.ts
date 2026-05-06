import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  appendRecordingAudioChunk,
  createRecordingDraft,
  finalizeRecordingDraft,
  initializeRecordingDraftWorkspace,
  readRecordingAudioChunk,
  readRecordingAudioManifest,
} from '../../src/main/recordingDrafts.js';
import { initializeWorkspaceFiles } from '../../src/main/workspaceFiles.js';

async function finalizedWorkspace(): Promise<string> {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-read-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '读取录音',
    description: '',
    createWorkspaceId: () => 'ws_read',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await initializeRecordingDraftWorkspace({ rootPath });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_read',
    createRecordingId: () => 'rec_20260506_000001',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_000001',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3, 4]),
  });
  await finalizeRecordingDraft({
    rootPath,
    recordingId: 'rec_20260506_000001',
    title: '读取',
    now: () => '2026-05-06T13:09:00.000Z',
  });
  return rootPath;
}

test('audio manifest and chunk reads enforce bounds and never expose full-file IPC', async () => {
  const rootPath = await finalizedWorkspace();

  assert.deepEqual(
    await readRecordingAudioManifest({ rootPath, recordingId: 'rec_20260506_000001' }),
    {
      ok: true,
      manifest: {
        recordingId: 'rec_20260506_000001',
        byteLength: 4,
        maxChunkBytes: 1_048_576,
      },
    }
  );

  assert.deepEqual(
    await readRecordingAudioChunk({
      rootPath,
      recordingId: 'rec_20260506_000001',
      offset: 1,
      length: 2,
    }),
    {
      ok: true,
      chunk: new Uint8Array([2, 3]),
    }
  );

  for (const request of [
    { recordingId: '../escape', offset: 0, length: 1 },
    { recordingId: 'rec_20260506_000001', offset: -1, length: 1 },
    { recordingId: 'rec_20260506_000001', offset: 0, length: 1_048_577 },
  ]) {
    const result = await readRecordingAudioChunk({ rootPath, ...request });
    assert.equal(result.ok, false);
  }
});

test('missing audio returns typed error', async () => {
  const rootPath = await finalizedWorkspace();
  const result = await readRecordingAudioManifest({ rootPath, recordingId: 'rec_missing' });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_RECORDING_AUDIO_MISSING');
  }
});

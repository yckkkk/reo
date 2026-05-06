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
} from '../../src/main/recordingDrafts.js';
import { initializeWorkspaceFiles } from '../../src/main/workspaceFiles.js';

async function workspaceRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '录音',
    description: '',
    createWorkspaceId: () => 'ws_draft',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await initializeRecordingDraftWorkspace({ rootPath: root });
  return root;
}

test('recording draft enforces sequence, 1 MiB chunk limit, and finalize waits for append idle', async () => {
  const rootPath = await workspaceRoot();
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => 'rec_20260506_000001',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.deepEqual(draft, {
    ok: true,
    recordingId: 'rec_20260506_000001',
    nextSequence: 0,
  });

  assert.equal(
    (
      await appendRecordingAudioChunk({
        rootPath,
        recordingId: 'rec_20260506_000001',
        sequence: 0,
        chunk: new Uint8Array([1, 2, 3]),
      })
    ).ok,
    true
  );

  const replay = await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_000001',
    sequence: 0,
    chunk: new Uint8Array([4]),
  });
  assert.equal(replay.ok, false);
  if (!replay.ok) {
    assert.equal(replay.error.code, 'ERR_RECORDING_SEQUENCE');
  }

  const tooLarge = await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_000001',
    sequence: 1,
    chunk: new Uint8Array(1_048_577),
  });
  assert.equal(tooLarge.ok, false);
  if (!tooLarge.ok) {
    assert.equal(tooLarge.error.code, 'ERR_RECORDING_CHUNK_TOO_LARGE');
  }

  assert.deepEqual(
    await finalizeRecordingDraft({
      rootPath,
      recordingId: 'rec_20260506_000001',
      title: '第一段录音',
      now: () => '2026-05-06T13:09:00.000Z',
    }),
    {
      ok: true,
      recording: {
        recordingId: 'rec_20260506_000001',
        title: '第一段录音',
        audioByteLength: 3,
      },
    }
  );
});

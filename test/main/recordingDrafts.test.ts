import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
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

  const finalizedMetadata = JSON.parse(
    await readFile(
      path.join(rootPath, 'recordings', 'rec_20260506_000001', 'recording.json'),
      'utf8'
    )
  );
  const audio = await stat(path.join(rootPath, 'recordings', 'rec_20260506_000001', 'audio.webm'));
  const index = JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8'));
  assert.equal(finalizedMetadata.status, 'finalized');
  assert.equal(finalizedMetadata.title, '第一段录音');
  assert.equal(finalizedMetadata.audioByteLength, 3);
  assert.equal(audio.size, 3);
  assert.deepEqual(index.recordings, [
    {
      recordingId: 'rec_20260506_000001',
      title: '第一段录音',
      audioByteLength: 3,
    },
  ]);

  const lateAppend = await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_000001',
    sequence: 1,
    chunk: new Uint8Array([9]),
  });
  assert.equal(lateAppend.ok, false);
  if (!lateAppend.ok) {
    assert.equal(lateAppend.error.code, 'ERR_RECORDING_FINALIZED');
  }

  const metadataAfterLateAppend = JSON.parse(
    await readFile(
      path.join(rootPath, 'recordings', 'rec_20260506_000001', 'recording.json'),
      'utf8'
    )
  );
  assert.deepEqual(metadataAfterLateAppend, finalizedMetadata);
});

test('recording finalize blocks late append while finalization is active', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => 'rec_20260506_000002',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_000002',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalize = finalizeRecordingDraft({
    rootPath,
    recordingId: 'rec_20260506_000002',
    title: '并发录音',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  const lateAppend = await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_000002',
    sequence: 1,
    chunk: new Uint8Array([9]),
  });

  assert.equal(lateAppend.ok, false);
  if (!lateAppend.ok) {
    assert.equal(lateAppend.error.code, 'ERR_RECORDING_FINALIZED');
  }
  assert.equal((await finalize).ok, true);
  const audio = await stat(path.join(rootPath, 'recordings', 'rec_20260506_000002', 'audio.webm'));
  assert.equal(audio.size, 3);
});

test('recording finalize returns error envelope when durable audio is missing', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => 'rec_20260506_000003',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  await rm(path.join(rootPath, 'recordings', 'rec_20260506_000003', 'audio.webm'));

  const finalized = await finalizeRecordingDraft({
    rootPath,
    recordingId: 'rec_20260506_000003',
    title: '缺失音频',
    now: () => '2026-05-06T13:13:00.000Z',
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.code, 'ERR_RECORDING_FINALIZE_FAILED');
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
});

test('recording finalize preserves draft metadata when index update fails', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => 'rec_20260506_000004',
    now: () => '2026-05-06T13:14:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_000004',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const indexPath = path.join(rootPath, '.reo', 'index.json');
  await rm(indexPath);
  await mkdir(indexPath);

  const finalized = await finalizeRecordingDraft({
    rootPath,
    recordingId: 'rec_20260506_000004',
    title: '索引失败录音',
    now: () => '2026-05-06T13:15:00.000Z',
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.code, 'ERR_RECORDING_FINALIZE_FAILED');
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  const metadata = JSON.parse(
    await readFile(
      path.join(rootPath, 'recordings', 'rec_20260506_000004', 'recording.json'),
      'utf8'
    )
  );
  assert.equal(metadata.status, 'draft');
  assert.equal(metadata.title, '');
  assert.equal(metadata.audioByteLength, 3);
});

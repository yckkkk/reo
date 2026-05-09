import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  appendRecordingAudioChunk,
  createRecordingDraft,
  finalizeRecordingDraft,
  getRecordingDetail,
  initializeRecordingDraftWorkspace,
  readRecordingAudioChunk,
  readRecordingAudioManifest,
  saveRecordingMarkdown,
  setBeforeAudioOpenForTest,
  setBeforeAudioReadForTest,
  setBeforeMarkdownWriteForTest,
} from '../../src/main/recordingDrafts.js';
import {
  createMemoryFromFileTruth,
  rebuildMemoryIndex,
  setBeforeDuplicateRecordingCheckForTest,
  setBeforeMemoryIndexEntryReadForTest,
  setBeforeReadModelPersistForTest,
  setBeforeReadModelReplaceForTest,
  setBeforeReadModelReaddirForTest,
  setBeforeRecordingLookupForTest,
} from '../../src/main/memoryFiles.js';
import { initializeWorkspaceFiles } from '../../src/main/workspaceFiles.js';

const READ_MEMORY_ID = 'mem_20260506_000001';
const READ_RECORDING_ID = 'rec_20260506_000001';

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
  const memory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_20260506_000001',
    title: '读取',
    now: () => '2026-05-06T13:09:00.000Z',
  });
  assert.equal(memory.ok, true);
  await finalizeRecordingDraft({
    durationMs: 1000,
    rootPath,
    recordingId: 'rec_20260506_000001',
    memoryId: 'mem_20260506_000001',
    title: '读取',
    now: () => '2026-05-06T13:09:00.000Z',
  });
  return rootPath;
}

async function writeFinalizedRecordingForTest(
  rootPath: string,
  recording: {
    readonly memoryId: string;
    readonly recordingId: string;
    readonly audioBytes: readonly number[];
  }
): Promise<void> {
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    recording.memoryId,
    'recordings',
    recording.recordingId
  );
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(
    path.join(recordingDirectory, 'audio.webm'),
    new Uint8Array(recording.audioBytes)
  );
  await writeFile(path.join(recordingDirectory, 'transcript.md'), '');
  await writeFile(path.join(recordingDirectory, 'reflections.md'), '');
  await writeFile(
    path.join(recordingDirectory, 'recording.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_read',
      memoryId: recording.memoryId,
      recordingId: recording.recordingId,
      status: 'finalized',
      title: recording.memoryId,
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: recording.audioBytes.length,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    })
  );
}

test('audio manifest and chunk reads enforce bounds and never expose full-file IPC', async () => {
  const rootPath = await finalizedWorkspace();

  assert.deepEqual(
    await readRecordingAudioManifest({
      rootPath,
      memoryId: READ_MEMORY_ID,
      recordingId: READ_RECORDING_ID,
    }),
    {
      ok: true,
      manifest: {
        recordingId: READ_RECORDING_ID,
        byteLength: 4,
        maxChunkBytes: 1_048_576,
      },
    }
  );

  assert.deepEqual(
    await readRecordingAudioChunk({
      rootPath,
      memoryId: READ_MEMORY_ID,
      recordingId: READ_RECORDING_ID,
      offset: 1,
      length: 2,
    }),
    {
      ok: true,
      chunk: new Uint8Array([2, 3]),
    }
  );

  for (const request of [
    { memoryId: READ_MEMORY_ID, recordingId: '../escape', offset: 0, length: 1 },
    { memoryId: READ_MEMORY_ID, recordingId: READ_RECORDING_ID, offset: -1, length: 1 },
    { memoryId: READ_MEMORY_ID, recordingId: READ_RECORDING_ID, offset: 0, length: 1_048_577 },
  ]) {
    const result = await readRecordingAudioChunk({ rootPath, ...request });
    assert.equal(result.ok, false);
  }
});

test('missing audio returns typed error', async () => {
  const rootPath = await finalizedWorkspace();
  const result = await readRecordingAudioManifest({
    rootPath,
    memoryId: READ_MEMORY_ID,
    recordingId: 'rec_missing',
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_RECORDING_AUDIO_MISSING');
  }
});

test('audio playback reads finalized truth only, not draft audio', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-read-draft-only-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '草稿读取',
    description: '',
    createWorkspaceId: () => 'ws_read_draft_only',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await initializeRecordingDraftWorkspace({ rootPath });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_read_draft_only',
    createRecordingId: () => 'rec_20260506_draft_only_audio',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_draft_only_audio',
    sequence: 0,
    chunk: new Uint8Array([7, 8, 9]),
  });

  const manifest = await readRecordingAudioManifest({
    rootPath,
    memoryId: READ_MEMORY_ID,
    recordingId: 'rec_20260506_draft_only_audio',
  });
  const chunk = await readRecordingAudioChunk({
    rootPath,
    memoryId: READ_MEMORY_ID,
    recordingId: 'rec_20260506_draft_only_audio',
    offset: 0,
    length: 1,
  });

  assert.equal(manifest.ok, false);
  if (!manifest.ok) {
    assert.equal(manifest.error.code, 'ERR_RECORDING_AUDIO_MISSING');
  }
  assert.equal(chunk.ok, false);
  if (!chunk.ok) {
    assert.equal(chunk.error.code, 'ERR_RECORDING_AUDIO_MISSING');
  }
});

test('cold audio manifest rejects invalid duplicate durable recording truth', async () => {
  const rootPath = await finalizedWorkspace();
  await writeFinalizedRecordingForTest(rootPath, {
    memoryId: 'mem_invalid_duplicate_audio',
    recordingId: 'rec_20260506_000001',
    audioBytes: [9],
  });
  await writeFile(
    path.join(
      rootPath,
      'memories',
      'mem_invalid_duplicate_audio',
      'recordings',
      'rec_20260506_000001',
      'recording.json'
    ),
    '{'
  );

  const manifest = await readRecordingAudioManifest({
    rootPath,
    memoryId: READ_MEMORY_ID,
    recordingId: 'rec_20260506_000001',
  });

  assert.equal(manifest.ok, false);
});

test('recording detail rejects oversized finalized metadata', async () => {
  const rootPath = await finalizedWorkspace();
  await writeFile(
    path.join(
      rootPath,
      'memories',
      'mem_20260506_000001',
      'recordings',
      'rec_20260506_000001',
      'recording.json'
    ),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_read',
      memoryId: 'mem_20260506_000001',
      recordingId: 'rec_20260506_000001',
      status: 'finalized',
      title: 'x'.repeat(1_100_000),
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 4,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    })
  );

  const detail = await getRecordingDetail({
    rootPath,
    memoryId: READ_MEMORY_ID,
    recordingId: READ_RECORDING_ID,
  });

  assert.equal(detail.ok, false);
});

test('finalized audio symlinks are rejected before manifest or chunk reads', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-read-symlink-audio-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '读取录音',
    description: '',
    createWorkspaceId: () => 'ws_read',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const outsideAudio = path.join(rootPath, '..', `reo-outside-audio-${Date.now()}.webm`);
  await writeFile(outsideAudio, new Uint8Array([65, 66, 67]));
  const memoryDirectory = path.join(rootPath, 'memories', 'mem_audio_link');
  const recordingDirectory = path.join(memoryDirectory, 'recordings', 'rec_audio_link');
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(
    path.join(memoryDirectory, 'memory.json'),
    JSON.stringify({
      memoryId: 'mem_audio_link',
      title: 'Audio link',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:08:00.000Z',
      assetIds: ['rec_audio_link'],
    })
  );
  await symlink(outsideAudio, path.join(recordingDirectory, 'audio.webm'));
  await writeFile(path.join(recordingDirectory, 'transcript.md'), '');
  await writeFile(path.join(recordingDirectory, 'reflections.md'), '');
  await writeFile(
    path.join(recordingDirectory, 'recording.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_read',
      memoryId: 'mem_audio_link',
      recordingId: 'rec_audio_link',
      status: 'finalized',
      title: 'Audio link',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 3,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    })
  );

  for (const result of [
    await readRecordingAudioManifest({
      rootPath,
      memoryId: 'mem_audio_link',
      recordingId: 'rec_audio_link',
    }),
    await readRecordingAudioChunk({
      rootPath,
      memoryId: 'mem_audio_link',
      recordingId: 'rec_audio_link',
      offset: 0,
      length: 3,
    }),
  ]) {
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_RECORDING_AUDIO_MISSING');
    }
  }
});

test('audio manifest aborts when workspace handle is lost before audio open', async () => {
  const rootPath = await finalizedWorkspace();
  let usable = true;
  setBeforeAudioOpenForTest(() => {
    usable = false;
    setBeforeAudioOpenForTest(null);
  });

  try {
    const manifest = await readRecordingAudioManifest({
      rootPath,
      memoryId: READ_MEMORY_ID,
      recordingId: 'rec_20260506_000001',
      assertWorkspaceUsable: () =>
        usable
          ? { ok: true as const }
          : {
              ok: false as const,
              error: { code: 'ERR_WORKSPACE_LOCK_LOST', message: 'Workspace lock was lost' },
            },
    });

    assert.equal(manifest.ok, false);
    if (!manifest.ok) {
      assert.equal(manifest.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
  } finally {
    setBeforeAudioOpenForTest(null);
  }
});

test('audio chunk aborts when workspace handle is lost before audio open', async () => {
  const rootPath = await finalizedWorkspace();
  let usable = true;
  setBeforeAudioOpenForTest(() => {
    usable = false;
    setBeforeAudioOpenForTest(null);
  });

  try {
    const chunk = await readRecordingAudioChunk({
      rootPath,
      memoryId: READ_MEMORY_ID,
      recordingId: 'rec_20260506_000001',
      offset: 0,
      length: 1,
      assertWorkspaceUsable: () =>
        usable
          ? { ok: true as const }
          : {
              ok: false as const,
              error: { code: 'ERR_WORKSPACE_LOCK_LOST', message: 'Workspace lock was lost' },
            },
    });

    assert.equal(chunk.ok, false);
    if (!chunk.ok) {
      assert.equal(chunk.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
  } finally {
    setBeforeAudioOpenForTest(null);
  }
});

test('audio chunk reads use the guarded file handle after audio validation', async () => {
  const rootPath = await finalizedWorkspace();
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_20260506_000001',
    'recordings',
    'rec_20260506_000001'
  );
  const audioFile = path.join(recordingDirectory, 'audio.webm');
  const outsideAudio = path.join(rootPath, '..', `reo-outside-audio-race-${Date.now()}.webm`);
  await writeFile(outsideAudio, new Uint8Array([9, 9, 9, 9]));
  setBeforeAudioReadForTest(async () => {
    setBeforeAudioReadForTest(null);
    await rm(audioFile);
    await symlink(outsideAudio, audioFile);
  });

  try {
    assert.deepEqual(
      await readRecordingAudioChunk({
        rootPath,
        memoryId: READ_MEMORY_ID,
        recordingId: 'rec_20260506_000001',
        offset: 0,
        length: 4,
      }),
      {
        ok: true,
        chunk: new Uint8Array([1, 2, 3, 4]),
      }
    );
  } finally {
    setBeforeAudioReadForTest(null);
  }
});

test('audio chunk reads reject finalized ancestor swap before opening audio', async () => {
  const rootPath = await finalizedWorkspace();
  const recordingId = 'rec_20260506_000001';
  const recordingsDirectory = path.join(rootPath, 'memories', 'mem_20260506_000001', 'recordings');
  const displacedRecordingsDirectory = `${recordingsDirectory}-preserved`;
  const outsideRecordingsDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-read-ancestor-'));
  const outsideRecordingDirectory = path.join(outsideRecordingsDirectory, recordingId);

  setBeforeAudioOpenForTest(async () => {
    setBeforeAudioOpenForTest(null);
    await mkdir(outsideRecordingDirectory);
    await writeFile(
      path.join(outsideRecordingDirectory, 'audio.webm'),
      new Uint8Array([9, 9, 9, 9])
    );
    await rename(recordingsDirectory, displacedRecordingsDirectory);
    await symlink(outsideRecordingsDirectory, recordingsDirectory, 'dir');
  });

  try {
    const result = await readRecordingAudioChunk({
      rootPath,
      memoryId: READ_MEMORY_ID,
      recordingId,
      offset: 0,
      length: 4,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_RECORDING_AUDIO_MISSING');
    }
  } finally {
    setBeforeAudioOpenForTest(null);
  }
});

test('cached audio chunk reads reject finalized ancestor swap', async () => {
  const rootPath = await finalizedWorkspace();
  const recordingId = 'rec_20260506_000001';
  const recordingsDirectory = path.join(rootPath, 'memories', 'mem_20260506_000001', 'recordings');
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-read-cache-outside-')
  );
  const outsideRecordingDirectory = path.join(outsideRecordingsDirectory, recordingId);
  await mkdir(outsideRecordingDirectory);
  await writeFile(path.join(outsideRecordingDirectory, 'audio.webm'), new Uint8Array([9, 9, 9, 9]));
  await writeFile(path.join(outsideRecordingDirectory, 'transcript.md'), '');
  await writeFile(path.join(outsideRecordingDirectory, 'reflections.md'), '');
  await writeFile(
    path.join(outsideRecordingDirectory, 'recording.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_read',
      memoryId: 'mem_20260506_000001',
      recordingId,
      status: 'finalized',
      title: 'outside',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 4,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    })
  );

  assert.equal(
    (
      await readRecordingAudioChunk({
        rootPath,
        memoryId: READ_MEMORY_ID,
        recordingId,
        offset: 0,
        length: 1,
      })
    ).ok,
    true
  );
  await rename(recordingsDirectory, `${recordingsDirectory}-preserved`);
  await symlink(outsideRecordingsDirectory, recordingsDirectory, 'dir');

  const chunk = await readRecordingAudioChunk({
    rootPath,
    memoryId: READ_MEMORY_ID,
    recordingId,
    offset: 0,
    length: 4,
  });

  assert.equal(chunk.ok, false);
  if (!chunk.ok) {
    assert.equal(chunk.error.code, 'ERR_RECORDING_AUDIO_MISSING');
  }
});

test('audio reads reject bytes beyond finalized metadata length after audio grows', async () => {
  const rootPath = await finalizedWorkspace();
  const audioFile = path.join(
    rootPath,
    'memories',
    'mem_20260506_000001',
    'recordings',
    'rec_20260506_000001',
    'audio.webm'
  );

  setBeforeAudioOpenForTest(async () => {
    setBeforeAudioOpenForTest(null);
    await writeFile(audioFile, new Uint8Array([1, 2, 3, 4, 9]));
  });

  try {
    const chunk = await readRecordingAudioChunk({
      rootPath,
      memoryId: READ_MEMORY_ID,
      recordingId: 'rec_20260506_000001',
      offset: 4,
      length: 1,
    });
    assert.equal(chunk.ok, false);
    if (!chunk.ok) {
      assert.equal(chunk.error.code, 'ERR_RECORDING_AUDIO_MISSING');
    }
  } finally {
    setBeforeAudioOpenForTest(null);
  }
});

test('audio chunk reads only the requested byte range', async () => {
  const rootPath = await finalizedWorkspace();
  let requestedLength = 0;
  setBeforeAudioReadForTest(({ length }) => {
    requestedLength = length;
  });

  try {
    assert.deepEqual(
      await readRecordingAudioChunk({
        rootPath,
        memoryId: READ_MEMORY_ID,
        recordingId: 'rec_20260506_000001',
        offset: 1,
        length: 2,
      }),
      {
        ok: true,
        chunk: new Uint8Array([2, 3]),
      }
    );
  } finally {
    setBeforeAudioReadForTest(null);
  }
  assert.equal(requestedLength, 2);
});

test('audio chunk reads use explicit memory ownership without global lookup', async () => {
  const rootPath = await finalizedWorkspace();
  let lookups = 0;
  setBeforeRecordingLookupForTest(() => {
    lookups += 1;
  });

  try {
    assert.equal(
      (
        await readRecordingAudioChunk({
          rootPath,
          memoryId: READ_MEMORY_ID,
          recordingId: 'rec_20260506_000001',
          offset: 0,
          length: 1,
        })
      ).ok,
      true
    );
    assert.equal(
      (
        await readRecordingAudioChunk({
          rootPath,
          memoryId: READ_MEMORY_ID,
          recordingId: 'rec_20260506_000001',
          offset: 1,
          length: 1,
        })
      ).ok,
      true
    );
  } finally {
    setBeforeRecordingLookupForTest(null);
  }

  assert.equal(lookups, 0);
});

test('cached audio chunk reads revalidate duplicate ownership per chunk', async () => {
  const rootPath = await finalizedWorkspace();
  assert.equal(
    (
      await readRecordingAudioManifest({
        rootPath,
        memoryId: READ_MEMORY_ID,
        recordingId: 'rec_20260506_000001',
      })
    ).ok,
    true
  );
  let duplicateChecks = 0;
  setBeforeDuplicateRecordingCheckForTest(() => {
    duplicateChecks += 1;
  });

  try {
    assert.equal(
      (
        await readRecordingAudioChunk({
          rootPath,
          memoryId: READ_MEMORY_ID,
          recordingId: 'rec_20260506_000001',
          offset: 0,
          length: 1,
        })
      ).ok,
      true
    );
    assert.equal(
      (
        await readRecordingAudioChunk({
          rootPath,
          memoryId: READ_MEMORY_ID,
          recordingId: 'rec_20260506_000001',
          offset: 1,
          length: 1,
        })
      ).ok,
      true
    );
  } finally {
    setBeforeDuplicateRecordingCheckForTest(null);
  }

  assert.equal(duplicateChecks, 2);
});

test('cached audio chunk reads reject stale finalized metadata after cache fill', async () => {
  const rootPath = await finalizedWorkspace();
  const recordingId = 'rec_20260506_000001';
  assert.equal(
    (
      await readRecordingAudioManifest({
        rootPath,
        memoryId: READ_MEMORY_ID,
        recordingId,
      })
    ).ok,
    true
  );
  await writeFile(
    path.join(
      rootPath,
      'memories',
      'mem_20260506_000001',
      'recordings',
      recordingId,
      'recording.json'
    ),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_read',
      recordingId,
      status: 'draft',
      title: 'stale',
      createdAt: '2026-05-06T13:08:00.000Z',
      nextSequence: 1,
      audioByteLength: 4,
    })
  );

  const chunk = await readRecordingAudioChunk({
    rootPath,
    memoryId: READ_MEMORY_ID,
    recordingId,
    offset: 0,
    length: 1,
  });

  assert.equal(chunk.ok, false);
  if (!chunk.ok) {
    assert.equal(chunk.error.code, 'ERR_RECORDING_AUDIO_MISSING');
  }
});

test('cached audio reads reject duplicate finalized ids created after cache fill', async () => {
  const rootPath = await finalizedWorkspace();
  assert.equal(
    (
      await readRecordingAudioChunk({
        rootPath,
        memoryId: READ_MEMORY_ID,
        recordingId: 'rec_20260506_000001',
        offset: 0,
        length: 1,
      })
    ).ok,
    true
  );

  await writeFinalizedRecordingForTest(rootPath, {
    memoryId: 'mem_duplicate_after_cache',
    recordingId: 'rec_20260506_000001',
    audioBytes: [9, 9],
  });

  const manifest = await readRecordingAudioManifest({
    rootPath,
    memoryId: READ_MEMORY_ID,
    recordingId: 'rec_20260506_000001',
  });

  assert.equal(manifest.ok, false);
  if (!manifest.ok) {
    assert.equal(manifest.error.code, 'ERR_RECORDING_AUDIO_MISSING');
  }
});

test('cached audio chunk reads reject duplicate finalized ids without a fresh manifest', async () => {
  const rootPath = await finalizedWorkspace();
  const recordingId = 'rec_20260506_000001';
  assert.equal(
    (
      await readRecordingAudioChunk({
        rootPath,
        memoryId: READ_MEMORY_ID,
        recordingId,
        offset: 0,
        length: 1,
      })
    ).ok,
    true
  );
  await writeFinalizedRecordingForTest(rootPath, {
    memoryId: 'mem_duplicate_direct_chunk',
    recordingId,
    audioBytes: [7, 7],
  });

  const chunk = await readRecordingAudioChunk({
    rootPath,
    memoryId: READ_MEMORY_ID,
    recordingId,
    offset: 1,
    length: 1,
  });

  assert.equal(chunk.ok, false);
  if (!chunk.ok) {
    assert.equal(chunk.error.code, 'ERR_RECORDING_AUDIO_MISSING');
  }
});

test('recording reads resolve finalized file truth before stale draft shadows', async () => {
  const rootPath = await finalizedWorkspace();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_read',
    createRecordingId: () => 'rec_20260506_000001',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_000001',
    sequence: 0,
    chunk: new Uint8Array([9]),
  });

  assert.deepEqual(
    await readRecordingAudioManifest({
      rootPath,
      memoryId: READ_MEMORY_ID,
      recordingId: READ_RECORDING_ID,
    }),
    {
      ok: true,
      manifest: {
        recordingId: READ_RECORDING_ID,
        byteLength: 4,
        maxChunkBytes: 1_048_576,
      },
    }
  );
  const detail = await getRecordingDetail({
    rootPath,
    memoryId: READ_MEMORY_ID,
    recordingId: READ_RECORDING_ID,
  });
  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.recording.status, 'finalized');
    assert.equal(detail.recording.memoryId, 'mem_20260506_000001');
  }
});

test('recording read and save reject duplicate finalized ids instead of falling back to stale draft', async () => {
  const rootPath = await finalizedWorkspace();
  await writeFinalizedRecordingForTest(rootPath, {
    memoryId: 'mem_duplicate_read',
    recordingId: 'rec_20260506_000001',
    audioBytes: [9, 9],
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_read',
    createRecordingId: () => 'rec_20260506_000001',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_000001',
    sequence: 0,
    chunk: new Uint8Array([7]),
  });

  assert.equal(
    (
      await readRecordingAudioManifest({
        rootPath,
        memoryId: READ_MEMORY_ID,
        recordingId: READ_RECORDING_ID,
      })
    ).ok,
    false
  );
  assert.equal(
    (
      await saveRecordingMarkdown({
        rootPath,
        memoryId: READ_MEMORY_ID,
        recordingId: 'rec_20260506_000001',
        fileName: 'transcript.md',
        markdown: '不应写入 stale draft\n',
      })
    ).ok,
    false
  );
});

test('recording detail rejects unsafe finalized metadata instead of falling back to stale draft', async () => {
  const rootPath = await finalizedWorkspace();
  const recordingId = 'rec_20260506_000001';
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_20260506_000001',
    'recordings',
    recordingId
  );
  const outsideMetadata = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-detail-metadata-outside-')),
    'recording.json'
  );
  await writeFile(
    outsideMetadata,
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_read',
      memoryId: 'mem_20260506_000001',
      recordingId,
      status: 'finalized',
      title: 'outside',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 4,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    })
  );
  await rm(path.join(recordingDirectory, 'recording.json'));
  await symlink(outsideMetadata, path.join(recordingDirectory, 'recording.json'));
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_read',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:10:00.000Z',
  });

  const detail = await getRecordingDetail({ rootPath, memoryId: READ_MEMORY_ID, recordingId });

  assert.equal(detail.ok, false);
  if (!detail.ok) {
    assert.equal(detail.error.code, 'ERR_RECORDING_NOT_FOUND');
  }
});

test('saving markdown rejects recording parent swap before write', async () => {
  const rootPath = await finalizedWorkspace();
  const recordingId = 'rec_20260506_000001';
  const recordingsDirectory = path.join(rootPath, 'memories', 'mem_20260506_000001', 'recordings');
  const outsideRecordingsDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-save-outside-'));
  const outsideRecordingDirectory = path.join(outsideRecordingsDirectory, recordingId);
  await mkdir(outsideRecordingDirectory);
  await writeFile(path.join(outsideRecordingDirectory, 'transcript.md'), 'outside');
  setBeforeMarkdownWriteForTest(async () => {
    setBeforeMarkdownWriteForTest(null);
    await rename(recordingsDirectory, `${recordingsDirectory}-preserved`);
    await symlink(outsideRecordingsDirectory, recordingsDirectory, 'dir');
  });

  try {
    const saved = await saveRecordingMarkdown({
      rootPath,
      memoryId: READ_MEMORY_ID,
      recordingId,
      fileName: 'transcript.md',
      markdown: 'should not escape\n',
    });

    assert.equal(saved.ok, false);
    if (!saved.ok) {
      assert.equal(saved.error.code, 'ERR_RECORDING_NOT_FOUND');
    }
    assert.equal(
      await readFile(path.join(outsideRecordingDirectory, 'transcript.md'), 'utf8'),
      'outside'
    );
    await assert.rejects(stat(path.join(outsideRecordingDirectory, 'reflections.md')));
  } finally {
    setBeforeMarkdownWriteForTest(null);
  }
});

test('saving transcript and reflections refreshes the workspace memory index projection', async () => {
  const rootPath = await finalizedWorkspace();

  assert.equal(
    (
      await saveRecordingMarkdown({
        rootPath,
        memoryId: READ_MEMORY_ID,
        recordingId: 'rec_20260506_000001',
        fileName: 'transcript.md',
        markdown: '转写内容\n',
      })
    ).ok,
    true
  );
  assert.equal(
    (
      await saveRecordingMarkdown({
        rootPath,
        memoryId: READ_MEMORY_ID,
        recordingId: 'rec_20260506_000001',
        fileName: 'reflections.md',
        markdown: '反思内容\n',
      })
    ).ok,
    true
  );

  const index = JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8'));
  assert.equal(index.memories[0].hasTranscript, true);
  assert.equal(index.memories[0].hasReflections, true);
});

test('saving markdown refreshes one memory index entry without a full workspace rescan', async () => {
  const rootPath = await finalizedWorkspace();
  setBeforeReadModelReaddirForTest(() => {
    throw new Error('full scan should not run');
  });

  try {
    const saved = await saveRecordingMarkdown({
      rootPath,
      memoryId: READ_MEMORY_ID,
      recordingId: 'rec_20260506_000001',
      fileName: 'transcript.md',
      markdown: '单条刷新\n',
    });

    assert.equal(saved.ok, true);
  } finally {
    setBeforeReadModelReaddirForTest(null);
  }

  const index = JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8'));
  assert.equal(index.memories[0].hasTranscript, true);
});

test('concurrent markdown saves preserve both memory index entry refreshes', async () => {
  const rootPath = await finalizedWorkspace();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_read',
    createRecordingId: () => 'rec_20260506_000002',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_000002',
    sequence: 0,
    chunk: new Uint8Array([5, 6]),
  });
  const createdSecondMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_20260506_000002',
    title: '第二段',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(createdSecondMemory.ok, true);
  const second = await finalizeRecordingDraft({
    durationMs: 2000,
    rootPath,
    recordingId: 'rec_20260506_000002',
    memoryId: 'mem_20260506_000002',
    title: '第二段',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(second.ok, true);
  let calls = 0;
  const waiters: Array<() => void> = [];
  setBeforeMemoryIndexEntryReadForTest(async () => {
    calls += 1;
    if (calls === 2) {
      waiters.forEach((resolve) => resolve());
      return;
    }
    await new Promise<void>((resolve) => {
      waiters.push(resolve);
    });
  });

  try {
    const [firstSave, secondSave] = await Promise.all([
      saveRecordingMarkdown({
        rootPath,
        memoryId: READ_MEMORY_ID,
        recordingId: 'rec_20260506_000001',
        fileName: 'transcript.md',
        markdown: '第一段转写\n',
      }),
      saveRecordingMarkdown({
        rootPath,
        memoryId: 'mem_20260506_000002',
        recordingId: 'rec_20260506_000002',
        fileName: 'reflections.md',
        markdown: '第二段反思\n',
      }),
    ]);

    assert.equal(firstSave.ok, true);
    assert.equal(secondSave.ok, true);
  } finally {
    setBeforeMemoryIndexEntryReadForTest(null);
  }

  const index = JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8'));
  const firstMemory = index.memories.find(
    (memory: { memoryId: string }) => memory.memoryId === 'mem_20260506_000001'
  );
  const secondMemory = index.memories.find(
    (memory: { memoryId: string }) => memory.memoryId === 'mem_20260506_000002'
  );
  assert.equal(firstMemory.hasTranscript, true);
  assert.equal(secondMemory.hasReflections, true);
});

test('markdown index refresh reads memory summary inside the workspace index queue', async () => {
  const rootPath = await finalizedWorkspace();
  let nestedSave: Awaited<ReturnType<typeof saveRecordingMarkdown>> | undefined;
  setBeforeMemoryIndexEntryReadForTest(async () => {
    setBeforeMemoryIndexEntryReadForTest(null);
    nestedSave = await saveRecordingMarkdown({
      rootPath,
      memoryId: READ_MEMORY_ID,
      recordingId: 'rec_20260506_000001',
      fileName: 'reflections.md',
      markdown: '后写入的反思\n',
    });
  });

  try {
    const transcriptSave = await saveRecordingMarkdown({
      rootPath,
      memoryId: READ_MEMORY_ID,
      recordingId: 'rec_20260506_000001',
      fileName: 'transcript.md',
      markdown: '先写入的转写\n',
    });
    assert.equal(transcriptSave.ok, true);
    assert.equal(nestedSave?.ok, true);
  } finally {
    setBeforeMemoryIndexEntryReadForTest(null);
  }

  const index = JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8'));
  const memory = index.memories.find(
    (item: { memoryId: string }) => item.memoryId === 'mem_20260506_000001'
  );
  assert.equal(memory.hasTranscript, true);
  assert.equal(memory.hasReflections, true);
});

test('full index rebuild cannot overwrite a queued markdown index refresh', async () => {
  const rootPath = await finalizedWorkspace();
  let releasePersist: () => void = () => {};
  const persistEntered = new Promise<void>((resolveEntered) => {
    setBeforeReadModelPersistForTest(async () => {
      setBeforeReadModelPersistForTest(null);
      resolveEntered();
      await new Promise<void>((resolve) => {
        releasePersist = resolve;
      });
    });
  });

  try {
    const rebuild = rebuildMemoryIndex(rootPath);
    await persistEntered;
    const transcriptSave = saveRecordingMarkdown({
      rootPath,
      memoryId: READ_MEMORY_ID,
      recordingId: 'rec_20260506_000001',
      fileName: 'transcript.md',
      markdown: '并发保存的转写\n',
    });

    releasePersist();
    const [, saved] = await Promise.all([rebuild, transcriptSave]);
    assert.equal(saved.ok, true);
  } finally {
    setBeforeReadModelPersistForTest(null);
  }

  const index = JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8'));
  assert.equal(index.memories[0].hasTranscript, true);
});

test('full index rebuild computes replacement after queued markdown refresh', async () => {
  const rootPath = await finalizedWorkspace();
  let transcriptSave: Awaited<ReturnType<typeof saveRecordingMarkdown>> | undefined;
  setBeforeReadModelReplaceForTest(async () => {
    setBeforeReadModelReplaceForTest(null);
    transcriptSave = await saveRecordingMarkdown({
      rootPath,
      memoryId: READ_MEMORY_ID,
      recordingId: 'rec_20260506_000001',
      fileName: 'transcript.md',
      markdown: '队列前保存的转写\n',
    });
  });

  try {
    const memories = await rebuildMemoryIndex(rootPath);
    assert.equal(transcriptSave?.ok, true);
    assert.equal(memories[0]?.hasTranscript, true);
  } finally {
    setBeforeReadModelReplaceForTest(null);
  }

  const index = JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8'));
  assert.equal(index.memories[0].hasTranscript, true);
});

test('saving markdown reports index refresh failure without claiming previous file preservation', async () => {
  const rootPath = await finalizedWorkspace();
  const indexPath = path.join(rootPath, '.reo', 'index.json');
  await rm(indexPath, { force: true });
  await mkdir(indexPath);

  const result = await saveRecordingMarkdown({
    rootPath,
    memoryId: READ_MEMORY_ID,
    recordingId: 'rec_20260506_000001',
    fileName: 'transcript.md',
    markdown: '已保存但投影失败\n',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_INDEX_WRITE_FAILED');
    assert.equal(result.error.dataRetention, 'file-written-index-stale');
  }
  assert.equal(
    await readFile(
      path.join(
        rootPath,
        'memories',
        'mem_20260506_000001',
        'recordings',
        'rec_20260506_000001',
        'transcript.md'
      ),
      'utf8'
    ),
    '已保存但投影失败\n'
  );
});

test('saving markdown rechecks the workspace handle before refreshing the index', async () => {
  const rootPath = await finalizedWorkspace();
  let checks = 0;

  const result = await saveRecordingMarkdown({
    rootPath,
    memoryId: READ_MEMORY_ID,
    recordingId: 'rec_20260506_000001',
    fileName: 'transcript.md',
    markdown: '写入后锁丢失\n',
    assertWorkspaceUsable: () => {
      checks += 1;
      return checks < 6
        ? { ok: true }
        : {
            ok: false,
            error: { code: 'ERR_WORKSPACE_LOCK_LOST', message: 'Workspace lock was lost' },
          };
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  assert.equal(
    await readFile(
      path.join(
        rootPath,
        'memories',
        'mem_20260506_000001',
        'recordings',
        'rec_20260506_000001',
        'transcript.md'
      ),
      'utf8'
    ),
    '写入后锁丢失\n'
  );
});

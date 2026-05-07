import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  appendRecordingAudioChunk,
  createRecordingDraft,
  finalizeRecordingDraftForTest as finalizeRecordingDraft,
  initializeRecordingDraftWorkspace,
} from '../../src/main/recordingDrafts.js';
import {
  setAfterAtomicWorkspaceFileBackupRemoveForTest,
  setAfterAtomicWorkspaceFileTempOpenForTest,
  setAfterAtomicWorkspaceFileValidationForTest,
  setBeforeAtomicWorkspaceFileTempOpenForTest,
  writeWorkspaceFileAtomic,
  writeWorkspaceFileAtomicForTest,
  writeWorkspaceFileNoReplaceAtomic,
  writeWorkspaceFileNoReplaceAtomicForTest,
} from '../../src/main/atomicWorkspaceFile.js';
import {
  appendRecordingToMemoryForTest as appendRecordingToMemory,
  createMemoryForRecordingForTest as createMemoryForRecording,
  findRecordingDirectoryById,
  fsyncWorkspaceDirectoryForTest,
  rebuildMemoryIndex,
  rebuildRecordingCompatibilitySummaries,
  readMemoryDetail,
  recoverRecordingFinalizeTransactions,
  setAfterReadModelReplaceReadForTest,
  setBeforeReadModelReaddirForTest,
  setBeforeReadModelPersistForTest,
  updateMemoryTitleFromFileTruth,
} from '../../src/main/memoryFiles.js';
import { initializeWorkspaceFiles } from '../../src/main/workspaceFiles.js';

async function workspaceRoot(): Promise<string> {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '录音',
    description: '',
    createWorkspaceId: () => 'ws_memory',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await initializeRecordingDraftWorkspace({ rootPath });
  return rootPath;
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

function workspaceLockLost() {
  return {
    ok: false,
    error: { code: 'ERR_WORKSPACE_LOCK_LOST', message: 'Workspace lock was lost' },
  } as const;
}

async function writeMemoryJsonForTest(
  rootPath: string,
  memory: {
    readonly memoryId: string;
    readonly title: string;
    readonly sourceKind: 'recording';
    readonly recordingIds: readonly string[];
  }
): Promise<void> {
  const directory = path.join(rootPath, 'memories', memory.memoryId);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'memory.json'),
    `${JSON.stringify(
      {
        ...memory,
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
      },
      null,
      2
    )}\n`
  );
}

async function writeFinalizedRecordingForTest(
  rootPath: string,
  recording: {
    readonly memoryId: string;
    readonly recordingId: string;
    readonly title: string;
    readonly audioBytes?: readonly number[];
  }
): Promise<void> {
  const audioBytes = recording.audioBytes ?? [1, 2, 3];
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    recording.memoryId,
    'recordings',
    recording.recordingId
  );
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array(audioBytes));
  await writeFile(path.join(recordingDirectory, 'transcript.md'), '');
  await writeFile(path.join(recordingDirectory, 'reflections.md'), '');
  await writeFile(
    path.join(recordingDirectory, 'recording.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      memoryId: recording.memoryId,
      recordingId: recording.recordingId,
      status: 'finalized',
      title: recording.title,
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: audioBytes.length,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    })
  );
}

async function readWorkspaceIndex(rootPath: string): Promise<unknown> {
  return readJson(path.join(rootPath, '.reo', 'index.json'));
}

test('finalizes a draft into a durable memory directory', async () => {
  const rootPath = await workspaceRoot();
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_000001',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.deepEqual(draft, {
    ok: true,
    recordingId: 'rec_20260506_000001',
    nextSequence: 0,
  });

  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_000001',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    recordingId: 'rec_20260506_000001',
    createMemoryId: () => 'mem_20260506_000001',
    title: 'My seventh birthday',
    durationMs: 73_000,
    now: () => '2026-05-06T13:09:00.000Z',
  });

  assert.deepEqual(finalized, {
    ok: true,
    recording: {
      memoryId: 'mem_20260506_000001',
      recordingId: 'rec_20260506_000001',
      title: 'My seventh birthday',
      durationMs: 73_000,
      audioByteLength: 3,
    },
    memory: {
      memoryId: 'mem_20260506_000001',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:09:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      recordingCount: 1,
      durationMs: 73_000,
      audioByteLength: 3,
      hasTranscript: false,
      hasReflections: false,
    },
  });
  assert.deepEqual(
    await readJson(path.join(rootPath, 'memories', 'mem_20260506_000001', 'memory.json')),
    {
      memoryId: 'mem_20260506_000001',
      title: 'My seventh birthday',
      sourceKind: 'recording',
      createdAt: '2026-05-06T13:09:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      recordingIds: ['rec_20260506_000001'],
    }
  );
  const audio = await stat(
    path.join(
      rootPath,
      'memories',
      'mem_20260506_000001',
      'recordings',
      'rec_20260506_000001',
      'audio.webm'
    )
  );
  assert.equal(audio.size, 3);
  assert.deepEqual(
    await readJson(
      path.join(
        rootPath,
        'memories',
        'mem_20260506_000001',
        'recordings',
        'rec_20260506_000001',
        'recording.json'
      )
    ),
    {
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      memoryId: 'mem_20260506_000001',
      recordingId: 'rec_20260506_000001',
      status: 'finalized',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 73_000,
      nextSequence: 1,
      audioByteLength: 3,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    }
  );
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
    ''
  );
  assert.equal(
    await readFile(
      path.join(
        rootPath,
        'memories',
        'mem_20260506_000001',
        'recordings',
        'rec_20260506_000001',
        'reflections.md'
      ),
      'utf8'
    ),
    ''
  );
  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_000001'))
  );
});

test('updates titles through file truth before rebuilding the index projection', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_1',
    title: 'Original title',
    sourceKind: 'recording',
    recordingIds: ['rec_existing'],
  });

  const updated = await updateMemoryTitleFromFileTruth({
    rootPath,
    memoryId: 'mem_1',
    title: 'Renamed memory',
    now: () => '2026-05-06T13:10:00.000Z',
  });

  assert.equal(updated.ok, true);
  assert.deepEqual(await readJson(path.join(rootPath, 'memories', 'mem_1', 'memory.json')), {
    memoryId: 'mem_1',
    title: 'Renamed memory',
    sourceKind: 'recording',
    createdAt: '2026-05-06T13:08:00.000Z',
    recordingIds: ['rec_existing'],
    updatedAt: '2026-05-06T13:10:00.000Z',
  });
  assert.deepEqual(await readWorkspaceIndex(rootPath), {
    schemaVersion: 1,
    memories: [
      {
        memoryId: 'mem_1',
        title: 'Renamed memory',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:10:00.000Z',
        recordingCount: 0,
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        hasReflections: false,
      },
    ],
  });
});

test('rebuild index rejects memory metadata whose memoryId does not match its directory', async () => {
  const rootPath = await workspaceRoot();
  const mismatchedDirectory = path.join(rootPath, 'memories', 'mem_directory_id');
  await mkdir(mismatchedDirectory, { recursive: true });
  await writeFile(
    path.join(mismatchedDirectory, 'memory.json'),
    `${JSON.stringify(
      {
        memoryId: 'mem_declared_id',
        title: 'Mismatched memory',
        sourceKind: 'recording',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
        recordingIds: [],
      },
      null,
      2
    )}\n`
  );

  assert.deepEqual(await rebuildMemoryIndex(rootPath, { persist: false }), []);
});

test('reads memory detail with bounded recordings and saved content flags', async () => {
  const rootPath = await workspaceRoot();
  const recordingIds = Array.from({ length: 30 }, (_, index) => `rec_detail_${index}`);
  const transcriptRecordingId = 'rec_detail_25';
  const reflectionsRecordingId = 'rec_detail_26';
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_detail_many',
    title: 'Many recordings',
    sourceKind: 'recording',
    recordingIds,
  });
  await Promise.all(
    recordingIds.map((recordingId) =>
      writeFinalizedRecordingForTest(rootPath, {
        memoryId: 'mem_detail_many',
        recordingId,
        title: recordingId,
      })
    )
  );
  await writeFile(
    path.join(
      rootPath,
      'memories',
      'mem_detail_many',
      'recordings',
      transcriptRecordingId,
      'transcript.md'
    ),
    'Saved transcript\n'
  );
  await writeFile(
    path.join(
      rootPath,
      'memories',
      'mem_detail_many',
      'recordings',
      reflectionsRecordingId,
      'reflections.md'
    ),
    'Saved reflections\n'
  );
  await rebuildMemoryIndex(rootPath);

  const detail = await readMemoryDetail({
    rootPath,
    memoryId: 'mem_detail_many',
  });

  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.value.recordingCount, 30);
    assert.equal(detail.value.recordings.length, 24);
    assert.equal(detail.value.recordingsTruncated, true);
    assert.equal(detail.value.hasTranscript, true);
    assert.equal(detail.value.hasReflections, true);
  }
});

test('rebuild index rejects symlinked memory metadata leaf files', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_symlink_metadata';
  const memoryDirectory = path.join(rootPath, 'memories', memoryId);
  const outsideMetadata = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-json-outside-')),
    'memory.json'
  );
  await mkdir(memoryDirectory);
  await writeFile(
    outsideMetadata,
    JSON.stringify(
      {
        memoryId,
        title: 'outside-title',
        sourceKind: 'recording',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
        recordingIds: [],
      },
      null,
      2
    )
  );
  await symlink(outsideMetadata, path.join(memoryDirectory, 'memory.json'));

  const memories = await rebuildMemoryIndex(rootPath, { persist: false });

  assert.equal(
    memories.some((memory) => memory.memoryId === memoryId),
    false
  );
});

test('rebuild skips finalized recording metadata with invalid projected fields', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_invalid_projection',
    title: 'Invalid projection',
    sourceKind: 'recording',
    recordingIds: ['rec_20260506_invalid_projection'],
  });
  await writeFinalizedRecordingForTest(rootPath, {
    memoryId: 'mem_invalid_projection',
    recordingId: 'rec_20260506_invalid_projection',
    title: 'Invalid projection',
    audioBytes: [1, 2],
  });
  await writeFile(
    path.join(
      rootPath,
      'memories',
      'mem_invalid_projection',
      'recordings',
      'rec_20260506_invalid_projection',
      'recording.json'
    ),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      memoryId: 'mem_invalid_projection',
      recordingId: 'rec_20260506_invalid_projection',
      status: 'finalized',
      title: 42,
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: -1,
      nextSequence: 1,
      audioByteLength: 2,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    })
  );

  assert.deepEqual(await rebuildMemoryIndex(rootPath, { persist: false }), [
    {
      memoryId: 'mem_invalid_projection',
      title: 'Invalid projection',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:08:00.000Z',
      recordingCount: 0,
      durationMs: 0,
      audioByteLength: 0,
      hasTranscript: false,
      hasReflections: false,
    },
  ]);
  assert.deepEqual(await rebuildRecordingCompatibilitySummaries(rootPath), []);
});

test('rebuild preserves the existing index when memories root changes before scan', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_rebuild_swap',
    title: 'Rebuild swap',
    sourceKind: 'recording',
    recordingIds: ['rec_rebuild_swap'],
  });
  await writeFinalizedRecordingForTest(rootPath, {
    memoryId: 'mem_rebuild_swap',
    recordingId: 'rec_rebuild_swap',
    title: 'Rebuild swap',
  });
  await rebuildMemoryIndex(rootPath);
  const previousIndex = await readWorkspaceIndex(rootPath);
  setBeforeReadModelReaddirForTest(async () => {
    setBeforeReadModelReaddirForTest(null);
    await rename(path.join(rootPath, 'memories'), path.join(rootPath, 'memories-preserved'));
    await mkdir(path.join(rootPath, 'memories'));
  });

  try {
    await assert.rejects(rebuildMemoryIndex(rootPath));
  } finally {
    setBeforeReadModelReaddirForTest(null);
  }
  assert.deepEqual(await readWorkspaceIndex(rootPath), previousIndex);
});

test('rebuild preserves the existing index when memories root changes before persist', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_rebuild_persist_swap',
    title: 'Rebuild persist swap',
    sourceKind: 'recording',
    recordingIds: ['rec_rebuild_persist_swap'],
  });
  await writeFinalizedRecordingForTest(rootPath, {
    memoryId: 'mem_rebuild_persist_swap',
    recordingId: 'rec_rebuild_persist_swap',
    title: 'Rebuild persist swap',
  });
  await rebuildMemoryIndex(rootPath);
  const previousIndex = await readWorkspaceIndex(rootPath);
  setBeforeReadModelPersistForTest(async () => {
    setBeforeReadModelPersistForTest(null);
    await rename(path.join(rootPath, 'memories'), path.join(rootPath, 'memories-preserved'));
    await mkdir(path.join(rootPath, 'memories'));
  });

  try {
    await assert.rejects(rebuildMemoryIndex(rootPath));
  } finally {
    setBeforeReadModelPersistForTest(null);
  }
  assert.deepEqual(await readWorkspaceIndex(rootPath), previousIndex);
});

test('rebuild preserves the existing index when memories root changes after replacement read', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_rebuild_after_read_swap',
    title: 'Rebuild after read swap',
    sourceKind: 'recording',
    recordingIds: ['rec_rebuild_after_read_swap'],
  });
  await writeFinalizedRecordingForTest(rootPath, {
    memoryId: 'mem_rebuild_after_read_swap',
    recordingId: 'rec_rebuild_after_read_swap',
    title: 'Rebuild after read swap',
  });
  await rebuildMemoryIndex(rootPath);
  const previousIndex = await readWorkspaceIndex(rootPath);
  setAfterReadModelReplaceReadForTest(async () => {
    setAfterReadModelReplaceReadForTest(null);
    await rename(path.join(rootPath, 'memories'), path.join(rootPath, 'memories-preserved'));
    await mkdir(path.join(rootPath, 'memories'));
  });

  try {
    await assert.rejects(rebuildMemoryIndex(rootPath));
  } finally {
    setAfterReadModelReplaceReadForTest(null);
  }
  assert.deepEqual(await readWorkspaceIndex(rootPath), previousIndex);
});

test('rebuild index rejects symlinked recording metadata leaf files', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recording_metadata_symlink';
  const recordingId = 'rec_recording_metadata_symlink';
  await writeMemoryJsonForTest(rootPath, {
    memoryId,
    title: 'Recording metadata symlink',
    sourceKind: 'recording',
    recordingIds: [recordingId],
  });
  const recordingDirectory = path.join(rootPath, 'memories', memoryId, 'recordings', recordingId);
  const outsideMetadata = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-recording-json-outside-')),
    'recording.json'
  );
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1, 2, 3]));
  await writeFile(
    outsideMetadata,
    JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_memory',
        memoryId,
        recordingId,
        status: 'finalized',
        title: 'outside-title',
        createdAt: '2026-05-06T13:08:00.000Z',
        finalizedAt: '2026-05-06T13:09:00.000Z',
        durationMs: 3000,
        nextSequence: 1,
        audioByteLength: 3,
        transcriptPath: 'transcript.md',
        reflectionsPath: 'reflections.md',
      },
      null,
      2
    )
  );
  await symlink(outsideMetadata, path.join(recordingDirectory, 'recording.json'));

  const memories = await rebuildMemoryIndex(rootPath, { persist: false });
  const recordings = await rebuildRecordingCompatibilitySummaries(rootPath);

  assert.equal(memories.find((memory) => memory.memoryId === memoryId)?.recordingCount, 0);
  assert.equal(
    recordings.some((recording) => recording.recordingId === recordingId),
    false
  );
});

test('title update succeeds from file truth when index refresh fails', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_1',
    title: 'Original title',
    sourceKind: 'recording',
    recordingIds: ['rec_existing'],
  });
  await rm(path.join(rootPath, '.reo', 'index.json'));
  await mkdir(path.join(rootPath, '.reo', 'index.json'));

  const updated = await updateMemoryTitleFromFileTruth({
    rootPath,
    memoryId: 'mem_1',
    title: 'Renamed despite stale index',
    now: () => '2026-05-06T13:10:00.000Z',
  });

  assert.equal(updated.ok, true);
  assert.deepEqual(await readJson(path.join(rootPath, 'memories', 'mem_1', 'memory.json')), {
    memoryId: 'mem_1',
    title: 'Renamed despite stale index',
    sourceKind: 'recording',
    createdAt: '2026-05-06T13:08:00.000Z',
    recordingIds: ['rec_existing'],
    updatedAt: '2026-05-06T13:10:00.000Z',
  });
});

test('preserves the draft when memory finalize cannot rebuild the index', async () => {
  const rootPath = await workspaceRoot();
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_000002',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_20260506_failed',
    recordingId: 'rec_20260506_000002',
    title: 'Will not finalize',
    durationMs: 10_000,
    now: () => '2026-05-06T13:09:00.000Z',
    rebuildIndex: async () => {
      throw new Error('index write failed');
    },
  });

  assert.equal(finalized.ok, false);
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_000002'));
  await assert.rejects(stat(path.join(rootPath, 'memories', 'mem_20260506_failed')));
});

test('new memory finalize can retry with the same memory id after marker write failure', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_marker_retry',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_marker_retry',
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });

  const failed = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    recordingId: 'rec_20260506_marker_retry',
    createMemoryId: () => 'mem_marker_retry',
    title: 'Marker retry',
    durationMs: 1000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterMarkerWrite: () => {
        throw new Error('marker follow-up failed');
      },
    },
  });

  assert.equal(failed.ok, false);
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_marker_retry'));
  await assert.rejects(stat(path.join(rootPath, 'memories', 'mem_marker_retry')));

  const retried = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    recordingId: 'rec_20260506_marker_retry',
    createMemoryId: () => 'mem_marker_retry',
    title: 'Marker retry',
    durationMs: 1000,
    now: () => '2026-05-06T13:10:00.000Z',
  });

  assert.equal(retried.ok, true);
  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_marker_retry'))
  );
  await stat(
    path.join(rootPath, 'memories', 'mem_marker_retry', 'recordings', 'rec_20260506_marker_retry')
  );
});

test('finalize rejects invalid draft metadata before exposing durable recording truth', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_invalid_draft_metadata';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const failed = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    recordingId,
    createMemoryId: () => 'mem_invalid_draft_metadata',
    title: 'Invalid draft metadata',
    durationMs: 1000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeDraftCopy: async () => {
        const draftMetadataPath = path.join(
          rootPath,
          '.reo',
          'drafts',
          'recordings',
          recordingId,
          'recording.json'
        );
        const metadata = (await readJson(draftMetadataPath)) as Record<string, unknown>;
        await writeFile(draftMetadataPath, JSON.stringify({ ...metadata, nextSequence: 'bad' }));
      },
    },
  });

  assert.equal(failed.ok, false);
  if (!failed.ok) {
    assert.equal(failed.error.code, 'ERR_RECORDING_FINALIZE_FAILED');
    assert.equal(failed.error.dataRetention, 'draft-preserved');
  }
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
  await assert.rejects(
    stat(
      path.join(
        rootPath,
        'memories',
        'mem_invalid_draft_metadata',
        'recordings',
        recordingId,
        'recording.json'
      )
    )
  );
});

test('finalize keeps durable recording when the draft is already missing at cleanup', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_missing_draft_cleanup';
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    recordingId,
    createMemoryId: () => 'mem_missing_draft_cleanup',
    title: 'Missing draft cleanup',
    durationMs: 1000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeDraftDirectoryRemove: async () => {
        await rm(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId), {
          recursive: true,
          force: true,
        });
      },
    },
  });

  assert.equal(finalized.ok, true);
  await stat(
    path.join(rootPath, 'memories', 'mem_missing_draft_cleanup', 'recordings', recordingId)
  );
  await assert.rejects(
    stat(
      path.join(
        rootPath,
        'memories',
        'mem_missing_draft_cleanup',
        'recordings',
        recordingId,
        '.reo-finalize-transaction.json'
      )
    )
  );
});

test('rolls back an existing memory append when index rebuild fails', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_existing',
    title: 'Existing memory',
    sourceKind: 'recording',
    recordingIds: ['rec_existing'],
  });
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_000003',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);

  const appended = await appendRecordingToMemory({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_existing',
    recordingId: 'rec_20260506_000003',
    title: 'Existing memory',
    durationMs: 20_000,
    now: () => '2026-05-06T13:11:00.000Z',
    rebuildIndex: async () => {
      throw new Error('index write failed');
    },
  });

  assert.equal(appended.ok, false);
  assert.deepEqual(await readJson(path.join(rootPath, 'memories', 'mem_existing', 'memory.json')), {
    memoryId: 'mem_existing',
    title: 'Existing memory',
    sourceKind: 'recording',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:08:00.000Z',
    recordingIds: ['rec_existing'],
  });
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_000003'));
  await assert.rejects(
    stat(path.join(rootPath, 'memories', 'mem_existing', 'recordings', 'rec_20260506_000003'))
  );
});

test('duplicate recording finalize cannot delete an existing durable recording', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_existing',
    title: 'Existing memory',
    sourceKind: 'recording',
    recordingIds: ['rec_existing'],
  });
  const durableRecordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_existing',
    'recordings',
    'rec_existing'
  );
  await mkdir(durableRecordingDirectory, { recursive: true });
  await writeFile(path.join(durableRecordingDirectory, 'audio.webm'), new Uint8Array([8, 8, 8]));
  await writeFile(path.join(durableRecordingDirectory, 'transcript.md'), '');
  await writeFile(path.join(durableRecordingDirectory, 'reflections.md'), '');
  await writeFile(
    path.join(durableRecordingDirectory, 'recording.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      memoryId: 'mem_existing',
      recordingId: 'rec_existing',
      status: 'finalized',
      title: 'Original',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 3,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    })
  );
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_existing',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_existing',
    sequence: 0,
    chunk: new Uint8Array([1]),
  });

  const appended = await appendRecordingToMemory({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_existing',
    recordingId: 'rec_existing',
    title: 'Duplicate',
    durationMs: 2000,
    now: () => '2026-05-06T13:11:00.000Z',
  });

  assert.equal(appended.ok, false);
  assert.deepEqual(
    Array.from(await readFile(path.join(durableRecordingDirectory, 'audio.webm'))),
    [8, 8, 8]
  );
  assert.deepEqual(await readJson(path.join(rootPath, 'memories', 'mem_existing', 'memory.json')), {
    memoryId: 'mem_existing',
    title: 'Existing memory',
    sourceKind: 'recording',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:08:00.000Z',
    recordingIds: ['rec_existing'],
  });
});

test('recording finalize rejects durable recording id collisions across all memories', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_global_duplicate',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_global_duplicate',
    sequence: 0,
    chunk: new Uint8Array([1]),
  });
  assert.equal(
    (
      await createMemoryForRecording({
        rootPath,
        workspaceId: 'ws_memory',
        memoryId: 'mem_global_duplicate_source',
        recordingId: 'rec_20260506_global_duplicate',
        title: 'Source recording',
        durationMs: 1000,
        now: () => '2026-05-06T13:09:00.000Z',
      })
    ).ok,
    true
  );

  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_global_duplicate',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_global_duplicate',
    sequence: 0,
    chunk: new Uint8Array([2]),
  });

  const duplicateCreate = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_global_duplicate_target',
    recordingId: 'rec_20260506_global_duplicate',
    title: 'Duplicate recording',
    durationMs: 1000,
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(duplicateCreate.ok, false);
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_global_duplicate'));
  await assert.rejects(
    stat(
      path.join(
        rootPath,
        'memories',
        'mem_global_duplicate_target',
        'recordings',
        'rec_20260506_global_duplicate'
      )
    )
  );

  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_global_duplicate_existing_append',
    title: 'Existing target memory',
    sourceKind: 'recording',
    recordingIds: [],
  });
  const duplicateAppend = await appendRecordingToMemory({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_global_duplicate_existing_append',
    recordingId: 'rec_20260506_global_duplicate',
    title: 'Duplicate append',
    durationMs: 1000,
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.equal(duplicateAppend.ok, false);
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_global_duplicate'));
});

test('recording lookup rejects existing duplicate finalized ids instead of returning first match', async () => {
  const rootPath = await workspaceRoot();
  for (const memoryId of ['mem_duplicate_lookup_a', 'mem_duplicate_lookup_b']) {
    await writeMemoryJsonForTest(rootPath, {
      memoryId,
      title: memoryId,
      sourceKind: 'recording',
      recordingIds: ['rec_20260506_duplicate_lookup'],
    });
    await writeFinalizedRecordingForTest(rootPath, {
      memoryId,
      recordingId: 'rec_20260506_duplicate_lookup',
      title: memoryId,
    });
  }

  await assert.rejects(
    findRecordingDirectoryById(rootPath, 'rec_20260506_duplicate_lookup'),
    /Duplicate finalized recording id/
  );
});

test('create memory finalize cannot replace an existing memory directory', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_existing',
    title: 'Existing memory',
    sourceKind: 'recording',
    recordingIds: ['rec_existing'],
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_new_memory_collision',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_new_memory_collision',
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });

  const created = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_existing',
    recordingId: 'rec_new_memory_collision',
    title: 'Collision',
    durationMs: 2000,
    now: () => '2026-05-06T13:11:00.000Z',
  });

  assert.equal(created.ok, false);
  assert.deepEqual(await readJson(path.join(rootPath, 'memories', 'mem_existing', 'memory.json')), {
    memoryId: 'mem_existing',
    title: 'Existing memory',
    sourceKind: 'recording',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:08:00.000Z',
    recordingIds: ['rec_existing'],
  });
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_new_memory_collision'));
  await assert.rejects(
    stat(path.join(rootPath, 'memories', 'mem_existing', 'recordings', 'rec_new_memory_collision'))
  );
});

test('rejects symlinked durable memory directories', async () => {
  const rootPath = await workspaceRoot();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-outside-'));
  await mkdir(path.join(rootPath, 'memories'), { recursive: true });
  await symlink(outside, path.join(rootPath, 'memories', 'mem_link'), 'dir');

  const updated = await updateMemoryTitleFromFileTruth({
    rootPath,
    memoryId: 'mem_link',
    title: 'Should not write outside',
    now: () => '2026-05-06T13:12:00.000Z',
  });

  assert.equal(updated.ok, false);
  await assert.rejects(readFile(path.join(outside, 'memory.json'), 'utf8'));
});

test('preserves a draft when the memory parent is swapped to a symlink before staging', async () => {
  const rootPath = await workspaceRoot();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-parent-outside-'));
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_parent_symlink_swap',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_parent_symlink_swap',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_parent_symlink_swap',
    recordingId: 'rec_20260506_parent_symlink_swap',
    title: 'Symlink swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeParentDirectoryCreate: async () => {
        await symlink(outside, path.join(rootPath, 'memories', 'mem_parent_symlink_swap'), 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await stat(
    path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_parent_symlink_swap')
  );
  await assert.rejects(stat(path.join(outside, 'recordings')));
});

test('finalize rejects memories root symlink swap before creating a memory directory', async () => {
  const rootPath = await workspaceRoot();
  const outsideMemories = await mkdtemp(path.join(os.tmpdir(), 'reo-memories-create-outside-'));
  const recordingId = 'rec_20260506_memories_create_swap';
  const memoryId = 'mem_memories_create_swap';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  let swapped = false;
  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Memories create swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeMemoryDirectoryCreate: async () => {
        swapped = true;
        await rename(path.join(rootPath, 'memories'), path.join(rootPath, 'memories-preserved'));
        await symlink(outsideMemories, path.join(rootPath, 'memories'), 'dir');
      },
    },
  });

  assert.equal(swapped, true);
  assert.equal(finalized.ok, false);
  await assert.rejects(stat(path.join(outsideMemories, memoryId, 'recordings')));
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
});

test('finalize rejects memories root swap after resolving the memory mkdir target', async () => {
  const rootPath = await workspaceRoot();
  const outsideMemories = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-mkdir-outside-'));
  const recordingId = 'rec_20260506_memory_mkdir_swap';
  const memoryId = 'mem_memory_mkdir_swap';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Memory mkdir swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeMemoryDirectoryMkdir: async () => {
        await rename(path.join(rootPath, 'memories'), path.join(rootPath, 'memories-preserved'));
        await symlink(outsideMemories, path.join(rootPath, 'memories'), 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await assert.rejects(stat(path.join(outsideMemories, memoryId)));
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
});

test('finalize rejects memory directory symlink swap before creating recordings directory', async () => {
  const rootPath = await workspaceRoot();
  const outsideMemoryDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-memory-create-outside-')
  );
  const recordingId = 'rec_20260506_recordings_create_swap';
  const memoryId = 'mem_recordings_create_swap';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  let swapped = false;
  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Recordings create swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeRecordingsDirectoryCreate: async () => {
        swapped = true;
        const memoryDirectoryPath = path.join(rootPath, 'memories', memoryId);
        await rename(memoryDirectoryPath, `${memoryDirectoryPath}-preserved`);
        await symlink(outsideMemoryDirectory, memoryDirectoryPath, 'dir');
      },
    },
  });

  assert.equal(swapped, true);
  assert.equal(finalized.ok, false);
  await assert.rejects(stat(path.join(outsideMemoryDirectory, 'recordings')));
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
});

test('finalize rejects memory directory swap after resolving the recordings mkdir target', async () => {
  const rootPath = await workspaceRoot();
  const outsideMemoryDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-recordings-mkdir-outside-')
  );
  const recordingId = 'rec_20260506_recordings_mkdir_swap';
  const memoryId = 'mem_recordings_mkdir_swap';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Recordings mkdir swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeRecordingsDirectoryMkdir: async () => {
        const memoryDirectoryPath = path.join(rootPath, 'memories', memoryId);
        await rename(memoryDirectoryPath, `${memoryDirectoryPath}-preserved`);
        await symlink(outsideMemoryDirectory, memoryDirectoryPath, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await assert.rejects(stat(path.join(outsideMemoryDirectory, 'recordings')));
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
});

test('pre-expose cleanup does not delete outside staging when memory parent is swapped to a symlink', async () => {
  const rootPath = await workspaceRoot();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-cleanup-outside-'));
  const recordingId = 'rec_20260506_cleanup_symlink_swap';
  const memoryId = 'mem_cleanup_symlink_swap';
  const fixedNow = 1_778_109_900_000;
  const outsideStagingDirectory = path.join(
    outside,
    'recordings',
    `.reo-finalizing-${recordingId}.${process.pid}.${fixedNow}`
  );
  const outsideSentinel = path.join(outsideStagingDirectory, 'sentinel.txt');
  await mkdir(outsideStagingDirectory, { recursive: true });
  await writeFile(outsideSentinel, 'outside user file\n');
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const originalDateNow = Date.now;
  Date.now = () => fixedNow;
  try {
    const finalized = await createMemoryForRecording({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      recordingId,
      title: 'Symlink cleanup',
      durationMs: 3000,
      now: () => '2026-05-06T13:09:00.000Z',
      transactionHooks: {
        beforeParentDirectoryCreate: async () => {
          await symlink(outside, path.join(rootPath, 'memories', memoryId), 'dir');
        },
      },
    });
    assert.equal(finalized.ok, false);
  } finally {
    Date.now = originalDateNow;
  }

  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
  assert.equal(await readFile(outsideSentinel, 'utf8'), 'outside user file\n');
});

test('finalize rejects draft directory symlink swap before copying source files', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_draft_source_swap';
  const memoryId = 'mem_draft_source_swap';
  const outsideDraftDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-source-outside-'));
  await writeFile(path.join(outsideDraftDirectory, 'audio.webm'), new Uint8Array([9, 9, 9, 9]));
  await writeFile(
    path.join(outsideDraftDirectory, 'recording.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      recordingId,
      status: 'draft',
      title: '',
      createdAt: '2026-05-06T13:08:00.000Z',
      nextSequence: 1,
      audioByteLength: 4,
    })
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const draftDirectory = path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId);
  const preservedDraftDirectory = path.join(
    rootPath,
    '.reo',
    'drafts',
    'recordings',
    `${recordingId}-preserved`
  );

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Draft source swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterMarkerWrite: async () => {
        await rename(draftDirectory, preservedDraftDirectory);
        await symlink(outsideDraftDirectory, draftDirectory, 'dir');
      },
      beforeDraftCleanup: async () => {
        await rm(draftDirectory);
        await rename(preservedDraftDirectory, draftDirectory);
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await stat(draftDirectory);
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'recordings', recordingId)));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.json')));
});

test('finalize rejects draft recordings ancestor symlink swap before copying source files', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_draft_ancestor_swap';
  const memoryId = 'mem_draft_ancestor_swap';
  const outsideRecordingsRoot = await mkdtemp(
    path.join(os.tmpdir(), 'reo-draft-ancestor-outside-')
  );
  const outsideDraftDirectory = path.join(outsideRecordingsRoot, recordingId);
  await mkdir(outsideDraftDirectory);
  await writeFile(path.join(outsideDraftDirectory, 'audio.webm'), new Uint8Array([9, 9, 9, 9]));
  await writeFile(
    path.join(outsideDraftDirectory, 'recording.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      recordingId,
      status: 'draft',
      title: '',
      createdAt: '2026-05-06T13:08:00.000Z',
      nextSequence: 1,
      audioByteLength: 4,
    })
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const recordingsRoot = path.join(rootPath, '.reo', 'drafts', 'recordings');
  const preservedRecordingsRoot = path.join(rootPath, '.reo', 'drafts', 'recordings-preserved');

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Draft ancestor swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterMarkerWrite: async () => {
        await rename(recordingsRoot, preservedRecordingsRoot);
        await symlink(outsideRecordingsRoot, recordingsRoot, 'dir');
      },
      beforeDraftCleanup: async () => {
        await rm(recordingsRoot);
        await rename(preservedRecordingsRoot, recordingsRoot);
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await stat(path.join(recordingsRoot, recordingId));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'recordings', recordingId)));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.json')));
});

test('finalize rejects draft recordings ancestor symlink swap after draft validation before copy', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_draft_post_validate_swap';
  const memoryId = 'mem_draft_post_validate_swap';
  const outsideRecordingsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-post-outside-'));
  const outsideDraftDirectory = path.join(outsideRecordingsRoot, recordingId);
  await mkdir(outsideDraftDirectory);
  await writeFile(path.join(outsideDraftDirectory, 'audio.webm'), new Uint8Array([9, 9, 9]));
  await writeFile(
    path.join(outsideDraftDirectory, 'recording.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      recordingId,
      status: 'draft',
      title: 'Outside draft',
      createdAt: '2026-05-06T13:08:00.000Z',
      nextSequence: 1,
      audioByteLength: 3,
    })
  );

  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const recordingsRoot = path.join(rootPath, '.reo', 'drafts', 'recordings');
  const preservedRecordingsRoot = path.join(rootPath, '.reo', 'drafts', 'recordings-preserved');
  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Draft post validation swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeDraftCopy: async () => {
        await rename(recordingsRoot, preservedRecordingsRoot);
        await symlink(outsideRecordingsRoot, recordingsRoot, 'dir');
      },
      beforeDraftCleanup: async () => {
        await rm(recordingsRoot);
        await rename(preservedRecordingsRoot, recordingsRoot);
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  if (finalized.ok) {
    const copiedAudio = await readFile(
      path.join(rootPath, 'memories', memoryId, 'recordings', recordingId, 'audio.webm')
    );
    assert.notDeepEqual([...copiedAudio], [9, 9, 9]);
  }
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'recordings', recordingId)));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.json')));
});

test('finalize rejects recordings parent symlink swap before exposing staging', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_expose_parent_swap';
  const memoryId = 'mem_expose_parent_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-expose-parent-outside-')
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Expose parent swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeExpose: async () => {
        const recordingsDirectory = path.join(rootPath, 'memories', memoryId, 'recordings');
        const stagingName = (await readdir(recordingsDirectory)).find((entry) =>
          entry.startsWith('.reo-finalizing-')
        );
        assert.ok(stagingName);
        const outsideStagingDirectory = path.join(outsideRecordingsDirectory, stagingName);
        await mkdir(outsideStagingDirectory);
        await writeFile(path.join(outsideStagingDirectory, 'audio.webm'), new Uint8Array([9, 9]));
        await writeFile(
          path.join(outsideStagingDirectory, 'recording.json'),
          JSON.stringify({
            schemaVersion: 1,
            workspaceId: 'ws_memory',
            memoryId,
            recordingId,
            status: 'finalized',
            title: 'Outside',
            createdAt: '2026-05-06T13:08:00.000Z',
            finalizedAt: '2026-05-06T13:09:00.000Z',
            durationMs: 3000,
            nextSequence: 1,
            audioByteLength: 2,
            transcriptPath: 'transcript.md',
            reflectionsPath: 'reflections.md',
          })
        );
        await writeFile(path.join(outsideStagingDirectory, 'transcript.md'), '');
        await writeFile(path.join(outsideStagingDirectory, 'reflections.md'), '');
        await writeFile(path.join(outsideStagingDirectory, '.reo-finalize-transaction.json'), '{}');
        await rename(
          recordingsDirectory,
          path.join(rootPath, 'memories', memoryId, 'recordings-preserved')
        );
        await symlink(outsideRecordingsDirectory, recordingsDirectory, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await assert.rejects(stat(path.join(outsideRecordingsDirectory, recordingId, 'audio.webm')));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.json')));
});

test('finalize rejects recordings parent symlink swap before creating staging', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_staging_parent_swap';
  const memoryId = 'mem_staging_parent_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-staging-parent-outside-')
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Staging parent swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeStagingDirectoryCreate: async () => {
        const recordingsDirectory = path.join(rootPath, 'memories', memoryId, 'recordings');
        await rename(
          recordingsDirectory,
          path.join(rootPath, 'memories', memoryId, 'recordings-preserved')
        );
        await symlink(outsideRecordingsDirectory, recordingsDirectory, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  assert.deepEqual(await readdir(outsideRecordingsDirectory), []);
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.json')));
});

test('finalize rejects recordings parent symlink swap after creating staging', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_staging_created_parent_swap';
  const memoryId = 'mem_staging_created_parent_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-staging-created-outside-')
  );
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Staging created parent swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterStagingDirectoryCreate: async () => {
        const recordingsDirectory = path.join(rootPath, 'memories', memoryId, 'recordings');
        const stagingName = (await readdir(recordingsDirectory)).find((entry) =>
          entry.startsWith('.reo-finalizing-')
        );
        assert.ok(stagingName);
        await mkdir(path.join(outsideRecordingsDirectory, stagingName));
        await rename(
          recordingsDirectory,
          path.join(rootPath, 'memories', memoryId, 'recordings-preserved')
        );
        await symlink(outsideRecordingsDirectory, recordingsDirectory, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  const outsideEntries = await readdir(outsideRecordingsDirectory, { recursive: true });
  assert.equal(
    outsideEntries.some((entry) => String(entry).includes('audio.webm')),
    false
  );
  assert.equal(
    outsideEntries.some((entry) => String(entry).includes('.reo-finalize-transaction.json')),
    false
  );
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.json')));
});

test('finalize rejects recordings parent symlink swap after rename validation', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_final_rename_swap';
  const memoryId = 'mem_final_rename_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-final-rename-outside-')
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Final rename swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeFinalRename: async () => {
        const recordingsDirectory = path.join(rootPath, 'memories', memoryId, 'recordings');
        const stagingName = (await readdir(recordingsDirectory)).find((entry) =>
          entry.startsWith('.reo-finalizing-')
        );
        assert.ok(stagingName);
        const outsideStagingDirectory = path.join(outsideRecordingsDirectory, stagingName);
        await mkdir(outsideStagingDirectory);
        await writeFile(path.join(outsideStagingDirectory, 'audio.webm'), new Uint8Array([9, 9]));
        await writeFile(path.join(outsideStagingDirectory, 'recording.json'), '{}');
        await writeFile(path.join(outsideStagingDirectory, 'transcript.md'), '');
        await writeFile(path.join(outsideStagingDirectory, 'reflections.md'), '');
        await writeFile(path.join(outsideStagingDirectory, '.reo-finalize-transaction.json'), '{}');
        await rename(
          recordingsDirectory,
          path.join(rootPath, 'memories', memoryId, 'recordings-preserved')
        );
        await symlink(outsideRecordingsDirectory, recordingsDirectory, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await assert.rejects(stat(path.join(outsideRecordingsDirectory, recordingId, 'audio.webm')));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.json')));
});

test('finalize does not expose outside target after final rename validation', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_final_commit_swap';
  const memoryId = 'mem_final_commit_swap';
  const recordingsDirectory = path.join(rootPath, 'memories', memoryId, 'recordings');
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-final-commit-outside-')
  );
  const displacedRecordingsDirectory = path.join(
    outsideRecordingsDirectory,
    'displaced-recordings'
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Final commit swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeFinalRenameCommit: () => {
        const stagingName = readdirSync(process.cwd()).find((entry) =>
          entry.startsWith('.reo-finalizing-')
        );
        assert.ok(stagingName);
        renameSync(recordingsDirectory, displacedRecordingsDirectory);
        symlinkSync(outsideRecordingsDirectory, recordingsDirectory, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await assert.rejects(stat(path.join(outsideRecordingsDirectory, recordingId, 'audio.webm')));
  await assert.rejects(stat(path.join(displacedRecordingsDirectory, recordingId, 'audio.webm')));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.json')));
});

test('finalize rejects recording target created after duplicate preflight', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_late_duplicate';
  const memoryId = 'mem_late_duplicate';
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Late duplicate',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeFinalRenameCommit: () => {
        mkdirSync(path.join(process.cwd(), recordingId));
      },
    },
  });

  assert.equal(finalized.ok, false);
  await assert.rejects(
    stat(path.join(rootPath, 'memories', memoryId, 'recordings', recordingId, 'audio.webm'))
  );
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
});

test('finalize rejects recording target created after final duplicate preflight', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_late_duplicate_after_check';
  const memoryId = 'mem_late_duplicate_after_check';
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Late duplicate after check',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterFinalRenameTargetPreflight: () => {
        mkdirSync(path.join(process.cwd(), recordingId));
      },
    },
  });

  assert.equal(finalized.ok, false);
  await assert.rejects(
    stat(path.join(rootPath, 'memories', memoryId, 'recordings', recordingId, 'audio.webm'))
  );
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
});

test('finalize rejects recording target created after the last target preflight', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_late_duplicate_last_check';
  const memoryId = 'mem_late_duplicate_last_check';
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Late duplicate last check',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterFinalRenameLastPreflight: () => {
        mkdirSync(path.join(process.cwd(), recordingId));
      },
    },
  });

  assert.equal(finalized.ok, false);
  await assert.rejects(
    stat(path.join(rootPath, 'memories', memoryId, 'recordings', recordingId, 'audio.webm'))
  );
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
});

test('finalize rejects staging metadata symlink after draft copy', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_staging_metadata_symlink';
  const memoryId = 'mem_staging_metadata_symlink';
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-staging-metadata-outside-'));
  await writeFile(
    path.join(outside, 'recording.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_outside',
      recordingId,
      status: 'draft',
      title: '',
      createdAt: '2026-05-06T12:00:00.000Z',
      nextSequence: 0,
      audioByteLength: 0,
    })
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Staging metadata symlink',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterCopy: async () => {
        const stagingName = readdirSync(
          path.join(rootPath, 'memories', memoryId, 'recordings')
        ).find((entry) => entry.startsWith('.reo-finalizing-'));
        assert.ok(stagingName);
        const metadataPath = path.join(
          rootPath,
          'memories',
          memoryId,
          'recordings',
          stagingName,
          'recording.json'
        );
        await rm(metadataPath);
        await symlink(path.join(outside, 'recording.json'), metadataPath);
      },
    },
  });

  assert.equal(finalized.ok, false);
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'recordings', recordingId)));
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
});

test('pre-expose cleanup does not delete outside staging after cleanup validation', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_cleanup_post_validate';
  const memoryId = 'mem_cleanup_post_validate';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-cleanup-post-outside-')
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  let swapped = false;
  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Cleanup post validation',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterMarkerWrite: () => {
        throw new Error('force cleanup');
      },
      beforeSafeCleanupRemove: async () => {
        if (swapped) {
          return;
        }
        swapped = true;
        const recordingsDirectory = path.join(rootPath, 'memories', memoryId, 'recordings');
        const stagingName = (await readdir(recordingsDirectory)).find((entry) =>
          entry.startsWith('.reo-finalizing-')
        );
        assert.ok(stagingName);
        const outsideStagingDirectory = path.join(outsideRecordingsDirectory, stagingName);
        await mkdir(outsideStagingDirectory);
        await writeFile(path.join(outsideStagingDirectory, 'sentinel.txt'), 'outside');
        await rename(
          recordingsDirectory,
          path.join(rootPath, 'memories', memoryId, 'recordings-preserved')
        );
        await symlink(outsideRecordingsDirectory, recordingsDirectory, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  assert.equal(swapped, true);
  const [outsideEntry] = await readdir(outsideRecordingsDirectory);
  assert.ok(outsideEntry);
  await stat(path.join(outsideRecordingsDirectory, outsideEntry, 'sentinel.txt'));
});

test('finalize does not delete outside draft after draft cleanup validation', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_draft_cleanup_swap';
  const memoryId = 'mem_draft_cleanup_swap';
  const outsideDraftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-cleanup-outside-'));
  await mkdir(path.join(outsideDraftsRoot, recordingId));
  await writeFile(path.join(outsideDraftsRoot, recordingId, 'sentinel.txt'), 'outside');
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const recordingsRoot = path.join(rootPath, '.reo', 'drafts', 'recordings');
  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Draft cleanup swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeDraftDirectoryRemove: async () => {
        await rename(recordingsRoot, path.join(rootPath, '.reo', 'drafts', 'recordings-preserved'));
        await symlink(outsideDraftsRoot, recordingsRoot, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  await stat(path.join(outsideDraftsRoot, recordingId, 'sentinel.txt'));
});

test('finalize rejects memory directory symlink swap before memory metadata write', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_memory_metadata_swap';
  const memoryId = 'mem_memory_metadata_swap';
  const outsideMemoryDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-json-outside-'));
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const memoryDirectoryPath = path.join(rootPath, 'memories', memoryId);
  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Memory metadata swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterParentFsync: async () => {
        await rename(memoryDirectoryPath, `${memoryDirectoryPath}-preserved`);
        await symlink(outsideMemoryDirectory, memoryDirectoryPath, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  await assert.rejects(stat(path.join(outsideMemoryDirectory, 'memory.json')));
});

test('finalize rejects staging source swap before final expose', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_expose_source_swap';
  const memoryId = 'mem_expose_source_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-expose-source-outside-')
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const recordingsDirectory = path.join(rootPath, 'memories', memoryId, 'recordings');
  let outsideStagingDirectory = '';
  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Expose source swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterFinalRenameTargetPreflight: () => {
        const stagingName = readdirSync(recordingsDirectory).find((entry) =>
          entry.startsWith('.reo-finalizing-')
        );
        assert.ok(stagingName);
        const stagingDirectory = path.join(recordingsDirectory, stagingName);
        outsideStagingDirectory = path.join(outsideRecordingsDirectory, stagingName);
        mkdirSync(outsideStagingDirectory, { recursive: true });
        writeFileSync(path.join(outsideStagingDirectory, 'sentinel.txt'), 'outside');
        renameSync(stagingDirectory, `${stagingDirectory}-preserved`);
        symlinkSync(outsideStagingDirectory, stagingDirectory, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  await stat(path.join(outsideStagingDirectory, 'sentinel.txt'));
  await assert.rejects(
    stat(path.join(rootPath, 'memories', memoryId, 'recordings', recordingId, 'sentinel.txt'))
  );
});

test('finalize aborts when workspace handle is lost during durable transaction', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_handle_lost';
  const memoryId = 'mem_handle_lost';
  let usable = true;
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Handle lost',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    assertWorkspaceUsable: () =>
      usable
        ? { ok: true }
        : {
            ok: false,
            error: { code: 'ERR_WORKSPACE_LOCK_LOST', message: 'Workspace lock was lost' },
          },
    transactionHooks: {
      afterStagingTreeFsync: () => {
        usable = false;
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
});

test('finalize does not roll back files after the workspace handle is lost', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_handle_lost_no_rollback';
  const memoryId = 'mem_handle_lost_no_rollback';
  let usable = true;
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Handle lost no rollback',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    assertWorkspaceUsable: () => (usable ? { ok: true } : workspaceLockLost()),
    transactionHooks: {
      beforeDraftCleanup: () => {
        usable = false;
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
  await stat(
    path.join(
      rootPath,
      'memories',
      memoryId,
      'recordings',
      recordingId,
      '.reo-finalize-transaction.json'
    )
  );
  assert.equal(
    (
      (await readJson(path.join(rootPath, 'memories', memoryId, 'memory.json'))) as {
        memoryId: string;
      }
    ).memoryId,
    memoryId
  );
});

test('finalize does not run pre-expose cleanup after the workspace handle is lost', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_pre_expose_lock_lost';
  const memoryId = 'mem_pre_expose_lock_lost';
  let usable = true;
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Pre-expose lock lost',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    assertWorkspaceUsable: () => (usable ? { ok: true } : workspaceLockLost()),
    transactionHooks: {
      afterMarkerWrite: () => {
        usable = false;
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  const recordingsDirectory = path.join(rootPath, 'memories', memoryId, 'recordings');
  const stagingName = (await readdir(recordingsDirectory)).find((entry) =>
    entry.startsWith('.reo-finalizing-')
  );
  assert.ok(stagingName);
  await stat(path.join(recordingsDirectory, stagingName, '.reo-finalize-transaction.json'));
});

test('finalize rechecks the workspace handle before rebuilding the index', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_index_lock_lost';
  const memoryId = 'mem_index_lock_lost';
  let afterParentFsync = false;
  let postParentChecks = 0;
  let indexRebuilt = false;
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Index lock lost',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    assertWorkspaceUsable: () => {
      if (!afterParentFsync) {
        return { ok: true };
      }
      postParentChecks += 1;
      return postParentChecks === 1 ? { ok: true } : workspaceLockLost();
    },
    rebuildIndex: async () => {
      indexRebuilt = true;
      return [];
    },
    transactionHooks: {
      afterParentFsync: () => {
        afterParentFsync = true;
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  assert.equal(indexRebuilt, false);
  await stat(path.join(rootPath, 'memories', memoryId, 'recordings', recordingId));
});

test('finalize aborts when workspace handle is lost before memory parent writes', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_parent_lock_lost';
  const memoryId = 'mem_parent_lock_lost';
  let usable = true;
  let touchedAfterLockLost = false;
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Parent lock lost',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    assertWorkspaceUsable: () => (usable ? { ok: true } : workspaceLockLost()),
    transactionHooks: {
      beforeParentDirectoryCreate: () => {
        usable = false;
      },
      beforeStagingDirectoryCreate: () => {
        touchedAfterLockLost = true;
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  assert.equal(touchedAfterLockLost, false);
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId)));
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
});

test('finalize aborts when workspace handle is lost before staging writes', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_staging_lock_lost';
  const memoryId = 'mem_staging_lock_lost';
  let usable = true;
  let markerWrittenAfterLockLost = false;
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Staging lock lost',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    assertWorkspaceUsable: () => (usable ? { ok: true } : workspaceLockLost()),
    transactionHooks: {
      beforeStagingDirectoryCreate: () => {
        usable = false;
      },
      afterMarkerWrite: () => {
        markerWrittenAfterLockLost = true;
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  assert.equal(markerWrittenAfterLockLost, false);
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'recordings', recordingId)));
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
});

test('finalize does not unlink outside marker after draft cleanup validation', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_marker_cleanup_swap';
  const memoryId = 'mem_marker_cleanup_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-marker-cleanup-outside-')
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const recordingsDirectory = path.join(rootPath, 'memories', memoryId, 'recordings');
  const outsideTargetDirectory = path.join(outsideRecordingsDirectory, recordingId);
  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    recordingId,
    title: 'Marker cleanup swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterDraftCleanup: async () => {
        await mkdir(outsideTargetDirectory, { recursive: true });
        await writeFile(
          path.join(outsideTargetDirectory, '.reo-finalize-transaction.json'),
          'outside marker'
        );
        await rename(recordingsDirectory, `${recordingsDirectory}-preserved`);
        await symlink(outsideRecordingsDirectory, recordingsDirectory, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'durable-marker-recovery-required');
  }
  await stat(path.join(outsideTargetDirectory, '.reo-finalize-transaction.json'));
});

test('atomic workspace writes fsync temp files and parent directories before success', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-atomic-'));
  const calls: string[] = [];
  await writeWorkspaceFileAtomicForTest({
    filePath: path.join(rootPath, 'memories', 'mem_1', 'memory.json'),
    data: '{}\n',
    openFile: async () => ({
      writeFile: async () => {
        calls.push('write-temp');
      },
      sync: async () => {
        calls.push('fsync-temp');
      },
      close: async () => {
        calls.push('close-temp');
      },
    }),
    renameFile: async () => {
      calls.push('rename');
    },
    openDirectory: async () => ({
      sync: async () => {
        calls.push('fsync-parent');
      },
      close: async () => {
        calls.push('close-parent');
      },
    }),
  });

  assert.deepEqual(calls, [
    'write-temp',
    'fsync-temp',
    'close-temp',
    'rename',
    'fsync-parent',
    'close-parent',
  ]);
});

test('atomic workspace writes tolerate unsupported parent directory fsync after rename', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-atomic-unsupported-'));
  const calls: string[] = [];
  const unsupportedDirectoryFsync = new Error(
    'directory fsync unsupported'
  ) as NodeJS.ErrnoException;
  unsupportedDirectoryFsync.code = 'EISDIR';

  await writeWorkspaceFileAtomicForTest({
    filePath: path.join(rootPath, 'memories', 'mem_1', 'memory.json'),
    data: '{}\n',
    openFile: async () => ({
      writeFile: async () => {
        calls.push('write-temp');
      },
      sync: async () => {
        calls.push('fsync-temp');
      },
      close: async () => {
        calls.push('close-temp');
      },
    }),
    renameFile: async () => {
      calls.push('rename');
    },
    openDirectory: async () => {
      calls.push('open-parent');
      throw unsupportedDirectoryFsync;
    },
  });

  assert.deepEqual(calls, ['write-temp', 'fsync-temp', 'close-temp', 'rename', 'open-parent']);
});

test('atomic workspace writes keep final rename inside the validated parent directory', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-atomic-parent-swap-'));
  const parentDirectory = path.join(rootPath, 'memories', 'mem_1');
  const outsideParentDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-atomic-outside-'));
  const displacedParentDirectory = path.join(outsideParentDirectory, 'displaced-parent');
  await mkdir(parentDirectory, { recursive: true });

  setAfterAtomicWorkspaceFileValidationForTest(() => {
    for (const entry of readdirSync(process.cwd())) {
      if (entry.endsWith('.part')) {
        writeFileSync(path.join(outsideParentDirectory, entry), 'outside temp');
      }
    }
    renameSync(parentDirectory, displacedParentDirectory);
    symlinkSync(outsideParentDirectory, parentDirectory, 'dir');
  });
  try {
    await assert.rejects(
      writeWorkspaceFileAtomic(path.join(parentDirectory, 'memory.json'), '{"secret":true}\n')
    );
  } finally {
    setAfterAtomicWorkspaceFileValidationForTest(null);
  }

  await assert.rejects(readFile(path.join(outsideParentDirectory, 'memory.json'), 'utf8'));
  await assert.rejects(readFile(path.join(displacedParentDirectory, 'memory.json'), 'utf8'));
});

test('atomic workspace writes do not create temp files after parent swap before temp open', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-atomic-temp-open-'));
  const parentDirectory = path.join(rootPath, 'memories', 'mem_temp_open');
  const outsideParentDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-atomic-temp-outside-'));
  await mkdir(parentDirectory, { recursive: true });
  let touchedOutside = false;

  setBeforeAtomicWorkspaceFileTempOpenForTest(() => {
    renameSync(parentDirectory, `${parentDirectory}-preserved`);
    symlinkSync(outsideParentDirectory, parentDirectory, 'dir');
  });
  setAfterAtomicWorkspaceFileTempOpenForTest(() => {
    touchedOutside = readdirSync(outsideParentDirectory).some((entry) => entry.endsWith('.part'));
  });

  try {
    await assert.rejects(
      writeWorkspaceFileAtomic(path.join(parentDirectory, 'memory.json'), '{"secret":true}\n')
    );
  } finally {
    setBeforeAtomicWorkspaceFileTempOpenForTest(null);
    setAfterAtomicWorkspaceFileTempOpenForTest(null);
  }

  assert.equal(touchedOutside, false);
});

test('atomic replace restores existing target after final rename validation fails', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-atomic-restore-'));
  const parentDirectory = path.join(rootPath, 'memories', 'mem_restore');
  const outsideParentDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-atomic-restore-outside-')
  );
  const displacedParentDirectory = path.join(outsideParentDirectory, 'displaced-parent');
  await mkdir(parentDirectory, { recursive: true });
  await writeFile(path.join(parentDirectory, 'memory.json'), '{"title":"old"}\n');

  setAfterAtomicWorkspaceFileValidationForTest(() => {
    renameSync(parentDirectory, displacedParentDirectory);
    symlinkSync(outsideParentDirectory, parentDirectory, 'dir');
  });
  try {
    await assert.rejects(
      writeWorkspaceFileAtomic(path.join(parentDirectory, 'memory.json'), '{"title":"new"}\n')
    );
  } finally {
    setAfterAtomicWorkspaceFileValidationForTest(null);
  }

  assert.equal(
    await readFile(path.join(displacedParentDirectory, 'memory.json'), 'utf8'),
    '{"title":"old"}\n'
  );
  await assert.rejects(readFile(path.join(outsideParentDirectory, 'memory.json'), 'utf8'));
});

test('atomic replace does not report failure after successful commit and backup removal', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-atomic-backup-cleanup-'));
  const parentDirectory = path.join(rootPath, 'memories', 'mem_backup_cleanup');
  const targetPath = path.join(parentDirectory, 'memory.json');
  await mkdir(parentDirectory, { recursive: true });
  await writeFile(targetPath, '{"title":"old"}\n');

  setAfterAtomicWorkspaceFileBackupRemoveForTest(() => {
    throw new Error('backup cleanup fsync failed');
  });
  try {
    await writeWorkspaceFileAtomic(targetPath, '{"title":"new"}\n');
  } finally {
    setAfterAtomicWorkspaceFileBackupRemoveForTest(null);
  }

  assert.equal(await readFile(targetPath, 'utf8'), '{"title":"new"}\n');
});

test('no-replace atomic workspace writes keep final link inside the validated parent directory', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-atomic-link-parent-swap-'));
  const outsideParentDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-atomic-link-outside-'));
  const displacedParentDirectory = path.join(outsideParentDirectory, 'displaced-root');

  setAfterAtomicWorkspaceFileValidationForTest(() => {
    for (const entry of readdirSync(process.cwd())) {
      if (entry.endsWith('.part')) {
        writeFileSync(path.join(outsideParentDirectory, entry), 'outside temp');
      }
    }
    renameSync(rootPath, displacedParentDirectory);
    symlinkSync(outsideParentDirectory, rootPath, 'dir');
  });
  try {
    await assert.rejects(
      writeWorkspaceFileNoReplaceAtomic(path.join(rootPath, 'AGENTS.md'), '# Reo workspace\n')
    );
  } finally {
    setAfterAtomicWorkspaceFileValidationForTest(null);
  }

  await assert.rejects(readFile(path.join(outsideParentDirectory, 'AGENTS.md'), 'utf8'));
  await assert.rejects(readFile(path.join(displacedParentDirectory, 'AGENTS.md'), 'utf8'));
});

test('no-replace atomic workspace writes link the target and fsync the parent', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-atomic-no-replace-'));
  const calls: string[] = [];
  await writeWorkspaceFileNoReplaceAtomicForTest({
    filePath: path.join(rootPath, 'AGENTS.md'),
    data: '# Reo workspace\n',
    openFile: async () => ({
      writeFile: async () => {
        calls.push('write-temp');
      },
      sync: async () => {
        calls.push('fsync-temp');
      },
      close: async () => {
        calls.push('close-temp');
      },
    }),
    linkFile: async () => {
      calls.push('link-target');
    },
    removeFile: async () => {
      calls.push('remove-temp');
    },
    openDirectory: async () => ({
      sync: async () => {
        calls.push('fsync-parent');
      },
      close: async () => {
        calls.push('close-parent');
      },
    }),
  });

  assert.deepEqual(calls, [
    'write-temp',
    'fsync-temp',
    'close-temp',
    'link-target',
    'remove-temp',
    'fsync-parent',
    'close-parent',
  ]);
});

test('finalize transaction directory fsync tolerates unsupported directory fsync', async () => {
  const calls: string[] = [];
  const unsupportedDirectoryFsync = new Error(
    'directory fsync unsupported'
  ) as NodeJS.ErrnoException;
  unsupportedDirectoryFsync.code = 'EISDIR';

  await fsyncWorkspaceDirectoryForTest({
    directoryPath: '/unsupported-directory-fsync',
    openDirectory: async () => ({
      sync: async () => {
        calls.push('fsync-directory');
        throw unsupportedDirectoryFsync;
      },
      close: async () => {
        calls.push('close-directory');
      },
    }),
  });

  assert.deepEqual(calls, ['fsync-directory', 'close-directory']);
});

test('rebuild skips finalized recording metadata missing detail-read required fields', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_incomplete_metadata',
    title: 'Incomplete metadata',
    sourceKind: 'recording',
    recordingIds: ['rec_20260506_incomplete_metadata'],
  });
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_incomplete_metadata',
    'recordings',
    'rec_20260506_incomplete_metadata'
  );
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1, 2]));
  await writeFile(
    path.join(recordingDirectory, 'recording.json'),
    JSON.stringify({
      memoryId: 'mem_incomplete_metadata',
      recordingId: 'rec_20260506_incomplete_metadata',
      status: 'finalized',
      title: 'Incomplete metadata',
      durationMs: 1000,
      audioByteLength: 2,
    })
  );

  assert.deepEqual(await rebuildMemoryIndex(rootPath, { persist: false }), [
    {
      audioByteLength: 0,
      createdAt: '2026-05-06T13:08:00.000Z',
      durationMs: 0,
      hasReflections: false,
      hasTranscript: false,
      memoryId: 'mem_incomplete_metadata',
      recordingCount: 0,
      title: 'Incomplete metadata',
      updatedAt: '2026-05-06T13:08:00.000Z',
    },
  ]);
});

test('recovers an interrupted recording finalization without promoting partial durable files', async () => {
  const rootPath = await workspaceRoot();
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_000004',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);

  await mkdir(
    path.join(rootPath, 'memories', 'mem_interrupted', 'recordings', 'rec_20260506_000004'),
    { recursive: true }
  );
  await writeFile(
    path.join(
      rootPath,
      'memories',
      'mem_interrupted',
      'recordings',
      'rec_20260506_000004',
      '.reo-finalize-transaction.json'
    ),
    '{"recordingId":"rec_20260506_000004"}'
  );

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_000004'));
  await assert.rejects(
    stat(path.join(rootPath, 'memories', 'mem_interrupted', 'recordings', 'rec_20260506_000004'))
  );
});

test('recovery removes empty new-memory directories after staging cleanup', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_recovery_empty_memory_retry';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });
  await mkdir(
    path.join(
      rootPath,
      'memories',
      'mem_recovery_empty_retry',
      'recordings',
      `.reo-finalizing-${recordingId}.1`
    ),
    { recursive: true }
  );
  await writeFile(
    path.join(
      rootPath,
      'memories',
      'mem_recovery_empty_retry',
      'recordings',
      `.reo-finalizing-${recordingId}.1`,
      '.reo-finalize-transaction.json'
    ),
    JSON.stringify({ recordingId })
  );

  await recoverRecordingFinalizeTransactions(rootPath);

  await assert.rejects(stat(path.join(rootPath, 'memories', 'mem_recovery_empty_retry')));
  const retried = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    recordingId,
    createMemoryId: () => 'mem_recovery_empty_retry',
    title: 'Recovery empty retry',
    durationMs: 1000,
    now: () => '2026-05-06T13:09:00.000Z',
  });
  assert.equal(retried.ok, true);
});

test('recovery stops before stale staging cleanup when workspace usability is lost', async () => {
  const rootPath = await workspaceRoot();
  const stagingDirectory = path.join(
    rootPath,
    'memories',
    'mem_recovery_lock_lost',
    'recordings',
    '.reo-finalizing-rec_20260506_recovery_lock_lost.1'
  );
  await mkdir(stagingDirectory, { recursive: true });
  await writeFile(
    path.join(stagingDirectory, '.reo-finalize-transaction.json'),
    '{"recordingId":"rec_20260506_recovery_lock_lost"}'
  );
  let usable = true;

  await assert.rejects(
    recoverRecordingFinalizeTransactions(rootPath, {
      assertWorkspaceUsable: () => {
        if (!usable) {
          throw new Error('Workspace lock was lost');
        }
      },
      beforeRecordingRecoveryRemove: () => {
        usable = false;
      },
    }),
    /Workspace lock was lost/
  );
  await stat(stagingDirectory);
});

test('recovery stops before metadata-less memory cleanup when workspace usability is lost', async () => {
  const rootPath = await workspaceRoot();
  const memoryDirectory = path.join(rootPath, 'memories', 'mem_recovery_memory_cleanup_lock_lost');
  await mkdir(path.join(memoryDirectory, 'recordings'), { recursive: true });
  let checks = 0;

  await assert.rejects(
    recoverRecordingFinalizeTransactions(rootPath, {
      assertWorkspaceUsable: () => {
        checks += 1;
        if (checks >= 2) {
          throw new Error('Workspace lock was lost');
        }
      },
    }),
    /Workspace lock was lost/
  );
  await stat(memoryDirectory);
});

test('recovery removes markerless partial new-memory recordings for retry', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_markerless_partial_retry';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });
  await mkdir(
    path.join(rootPath, 'memories', 'mem_markerless_partial', 'recordings', recordingId),
    {
      recursive: true,
    }
  );

  await recoverRecordingFinalizeTransactions(rootPath);

  await assert.rejects(stat(path.join(rootPath, 'memories', 'mem_markerless_partial')));
  const retried = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    recordingId,
    createMemoryId: () => 'mem_markerless_partial',
    title: 'Markerless partial retry',
    durationMs: 1000,
    now: () => '2026-05-06T13:09:00.000Z',
  });
  assert.equal(retried.ok, true);
});

test('recovery removes stale drafts for finalized recordings before clearing markers', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_stale_draft',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_stale_draft',
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_stale_draft',
    title: 'Recovered memory',
    sourceKind: 'recording',
    recordingIds: ['rec_20260506_stale_draft'],
  });
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_stale_draft',
    'recordings',
    'rec_20260506_stale_draft'
  );
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1, 2]));
  await writeFile(path.join(recordingDirectory, 'transcript.md'), '');
  await writeFile(path.join(recordingDirectory, 'reflections.md'), '');
  await writeFile(
    path.join(recordingDirectory, 'recording.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      memoryId: 'mem_stale_draft',
      recordingId: 'rec_20260506_stale_draft',
      status: 'finalized',
      title: 'Recovered memory',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 2,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    })
  );
  await writeFile(
    path.join(recordingDirectory, '.reo-finalize-transaction.json'),
    '{"recordingId":"rec_20260506_stale_draft"}'
  );

  await recoverRecordingFinalizeTransactions(rootPath);

  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_stale_draft'))
  );
  await stat(path.join(recordingDirectory, 'recording.json'));
  await assert.rejects(stat(path.join(recordingDirectory, '.reo-finalize-transaction.json')));
});

test('repairs memory metadata that points at a missing finalized recording during recovery', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_existing',
    title: 'Existing memory',
    sourceKind: 'recording',
    recordingIds: ['rec_missing'],
  });

  await recoverRecordingFinalizeTransactions(rootPath);
  await rebuildMemoryIndex(rootPath);

  assert.deepEqual(await readJson(path.join(rootPath, 'memories', 'mem_existing', 'memory.json')), {
    memoryId: 'mem_existing',
    title: 'Existing memory',
    sourceKind: 'recording',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:08:00.000Z',
    recordingIds: [],
  });
  assert.deepEqual(await readWorkspaceIndex(rootPath), {
    schemaVersion: 1,
    memories: [
      {
        memoryId: 'mem_existing',
        title: 'Existing memory',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
        recordingCount: 0,
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        hasReflections: false,
      },
    ],
  });
});

test('rebuilds index only from finalized recording metadata that matches audio bytes and ownership', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_existing',
    title: 'Existing memory',
    sourceKind: 'recording',
    recordingIds: ['rec_mismatch'],
  });
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_existing',
    'recordings',
    'rec_mismatch'
  );
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1, 2, 3, 4]));
  await writeFile(
    path.join(recordingDirectory, 'recording.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      memoryId: 'mem_existing',
      recordingId: 'rec_mismatch',
      status: 'finalized',
      title: 'Mismatch',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 3,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    })
  );

  await rebuildMemoryIndex(rootPath);

  assert.deepEqual(await readWorkspaceIndex(rootPath), {
    schemaVersion: 1,
    memories: [
      {
        memoryId: 'mem_existing',
        title: 'Existing memory',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
        recordingCount: 0,
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        hasReflections: false,
      },
    ],
  });
});

test('finalize transaction fsyncs staging contents before exposing a durable recording', async () => {
  const rootPath = await workspaceRoot();
  const calls: string[] = [];
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_fsync',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_20260506_fsync',
    recordingId: 'rec_20260506_fsync',
    title: 'Durable fsync order',
    durationMs: 10_000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterMarkerWrite: () => {
        calls.push('write-marker');
      },
      afterCopy: () => {
        calls.push('copy-draft');
      },
      afterStagingTreeFsync: () => {
        calls.push('fsync-staging-tree');
      },
      beforeExpose: () => {
        calls.push('before-rename');
      },
      afterParentFsync: () => {
        calls.push('fsync-recordings-parent');
      },
    },
  });

  assert.equal(finalized.ok, true);
  assert.deepEqual(calls, [
    'write-marker',
    'copy-draft',
    'fsync-staging-tree',
    'before-rename',
    'fsync-recordings-parent',
  ]);
  assert.ok(calls.indexOf('fsync-staging-tree') < calls.indexOf('before-rename'));
  assert.ok(calls.indexOf('before-rename') < calls.indexOf('fsync-recordings-parent'));
});

test('finalize fails instead of clearing marker when draft cleanup cannot complete', async () => {
  const rootPath = await workspaceRoot();
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_cleanup_blocked',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_cleanup_blocked',
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_cleanup_blocked',
    recordingId: 'rec_20260506_cleanup_blocked',
    title: 'Cleanup blocked',
    durationMs: 1000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeDraftCleanup: () => {
        throw new Error('draft cleanup blocked');
      },
    },
  });
  assert.equal(finalized.ok, false);

  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_cleanup_blocked'));
  await assert.rejects(
    stat(
      path.join(
        rootPath,
        'memories',
        'mem_cleanup_blocked',
        'recordings',
        'rec_20260506_cleanup_blocked'
      )
    )
  );
  assert.deepEqual(await readWorkspaceIndex(rootPath), { schemaVersion: 1, memories: [] });
});

test('finalize keeps durable marker once draft removal has completed but follow-up cleanup cannot be confirmed', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_cleanup_fsync_blocked',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_cleanup_fsync_blocked',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_cleanup_fsync_blocked',
    recordingId: 'rec_20260506_cleanup_fsync_blocked',
    title: 'Cleanup fsync blocked',
    durationMs: 1000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterDraftCleanup: () => {
        throw new Error('draft parent fsync blocked');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'durable-marker-recovery-required');
  }
  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_cleanup_fsync_blocked'))
  );
  await stat(
    path.join(
      rootPath,
      'memories',
      'mem_cleanup_fsync_blocked',
      'recordings',
      'rec_20260506_cleanup_fsync_blocked',
      '.reo-finalize-transaction.json'
    )
  );
  assert.deepEqual(
    await readJson(path.join(rootPath, 'memories', 'mem_cleanup_fsync_blocked', 'memory.json')),
    {
      memoryId: 'mem_cleanup_fsync_blocked',
      title: 'Cleanup fsync blocked',
      sourceKind: 'recording',
      createdAt: '2026-05-06T13:09:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      recordingIds: ['rec_20260506_cleanup_fsync_blocked'],
    }
  );
});

test('finalize keeps durable marker when workspace lock is lost after draft cleanup', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_cleanup_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_cleanup_lock_lost',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  let usable = true;

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_cleanup_lock_lost',
    recordingId: 'rec_20260506_cleanup_lock_lost',
    title: 'Cleanup lock lost',
    durationMs: 1000,
    now: () => '2026-05-06T13:09:00.000Z',
    assertWorkspaceUsable: () =>
      usable
        ? { ok: true as const }
        : {
            ok: false as const,
            error: {
              code: 'ERR_WORKSPACE_LOCK_LOST',
              dataRetention: 'none-written',
              message: 'Workspace lock was lost',
            },
          },
    transactionHooks: {
      afterDraftCleanup: () => {
        usable = false;
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_cleanup_lock_lost'))
  );
  await stat(
    path.join(
      rootPath,
      'memories',
      'mem_cleanup_lock_lost',
      'recordings',
      'rec_20260506_cleanup_lock_lost',
      '.reo-finalize-transaction.json'
    )
  );
});

test('recovery keeps marker when stale draft cleanup cannot complete', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_recovery_cleanup_blocked',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_recovery_cleanup_blocked',
    title: 'Recovery cleanup blocked',
    sourceKind: 'recording',
    recordingIds: ['rec_20260506_recovery_cleanup_blocked'],
  });
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_recovery_cleanup_blocked',
    'recordings',
    'rec_20260506_recovery_cleanup_blocked'
  );
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1, 2]));
  await writeFile(path.join(recordingDirectory, 'transcript.md'), '');
  await writeFile(path.join(recordingDirectory, 'reflections.md'), '');
  await writeFile(
    path.join(recordingDirectory, 'recording.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      memoryId: 'mem_recovery_cleanup_blocked',
      recordingId: 'rec_20260506_recovery_cleanup_blocked',
      status: 'finalized',
      title: 'Recovery cleanup blocked',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 2,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    })
  );
  await writeFile(
    path.join(recordingDirectory, '.reo-finalize-transaction.json'),
    '{"recordingId":"rec_20260506_recovery_cleanup_blocked"}'
  );

  await recoverRecordingFinalizeTransactions(rootPath, {
    removeDraftDirectory: async () => {
      throw new Error('draft cleanup blocked');
    },
  });

  await stat(
    path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_recovery_cleanup_blocked')
  );
  await stat(path.join(recordingDirectory, '.reo-finalize-transaction.json'));
});

test('recovery keeps marker when draft parent fsync cannot be confirmed', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_recovery_fsync_blocked',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_recovery_fsync_blocked',
    title: 'Recovery fsync blocked',
    sourceKind: 'recording',
    recordingIds: ['rec_20260506_recovery_fsync_blocked'],
  });
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_recovery_fsync_blocked',
    'recordings',
    'rec_20260506_recovery_fsync_blocked'
  );
  await writeFinalizedRecordingForTest(rootPath, {
    memoryId: 'mem_recovery_fsync_blocked',
    recordingId: 'rec_20260506_recovery_fsync_blocked',
    title: 'Recovery fsync blocked',
  });
  await writeFile(
    path.join(recordingDirectory, '.reo-finalize-transaction.json'),
    '{"recordingId":"rec_20260506_recovery_fsync_blocked"}'
  );

  await recoverRecordingFinalizeTransactions(rootPath, {
    afterDraftCleanup: () => {
      throw new Error('draft parent fsync blocked');
    },
  });

  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_recovery_fsync_blocked'))
  );
  await stat(path.join(recordingDirectory, '.reo-finalize-transaction.json'));
});

test('recovery clears marker when the stale draft is already missing', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_recovery_missing_draft',
    title: 'Recovery missing draft',
    sourceKind: 'recording',
    recordingIds: ['rec_20260506_recovery_missing_draft'],
  });
  await writeFinalizedRecordingForTest(rootPath, {
    memoryId: 'mem_recovery_missing_draft',
    recordingId: 'rec_20260506_recovery_missing_draft',
    title: 'Recovery missing draft',
  });
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_recovery_missing_draft',
    'recordings',
    'rec_20260506_recovery_missing_draft'
  );
  await writeFile(
    path.join(recordingDirectory, '.reo-finalize-transaction.json'),
    '{"recordingId":"rec_20260506_recovery_missing_draft"}'
  );

  await recoverRecordingFinalizeTransactions(rootPath);

  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_recovery_missing_draft'))
  );
  await assert.rejects(stat(path.join(recordingDirectory, '.reo-finalize-transaction.json')));
});

test('recovery preserves marker-bearing durable recording when finalized files are invalid', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_invalid_finalized';
  const recordingId = 'rec_20260506_recovery_invalid_finalized';
  await writeMemoryJsonForTest(rootPath, {
    memoryId,
    title: 'Recovery invalid finalized',
    sourceKind: 'recording',
    recordingIds: [recordingId],
  });
  await writeFinalizedRecordingForTest(rootPath, {
    memoryId,
    recordingId,
    title: 'Recovery invalid finalized',
    audioBytes: [1, 2, 3],
  });
  const recordingDirectory = path.join(rootPath, 'memories', memoryId, 'recordings', recordingId);
  await writeFile(path.join(recordingDirectory, '.reo-finalize-transaction.json'), '{}');
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1]));

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(path.join(recordingDirectory, 'recording.json'));
  await stat(path.join(recordingDirectory, '.reo-finalize-transaction.json'));
  assert.deepEqual(await readJson(path.join(rootPath, 'memories', memoryId, 'memory.json')), {
    memoryId,
    title: 'Recovery invalid finalized',
    sourceKind: 'recording',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:08:00.000Z',
    recordingIds: [recordingId],
  });
});

test('recovery ignores symlinked finalize markers when repairing invalid recordings', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_marker_symlink';
  const recordingId = 'rec_20260506_recovery_marker_symlink';
  await writeMemoryJsonForTest(rootPath, {
    memoryId,
    title: 'Recovery marker symlink',
    sourceKind: 'recording',
    recordingIds: [recordingId],
  });
  await writeFinalizedRecordingForTest(rootPath, {
    memoryId,
    recordingId,
    title: 'Recovery marker symlink',
    audioBytes: [1, 2, 3],
  });
  const recordingDirectory = path.join(rootPath, 'memories', memoryId, 'recordings', recordingId);
  await writeFile(path.join(recordingDirectory, 'recording.json'), '{');
  const outsideMarker = path.join(rootPath, '..', `reo-outside-marker-${Date.now()}.json`);
  await writeFile(outsideMarker, '{}');
  await symlink(outsideMarker, path.join(recordingDirectory, '.reo-finalize-transaction.json'));

  await recoverRecordingFinalizeTransactions(rootPath);

  assert.deepEqual(await readJson(path.join(rootPath, 'memories', memoryId, 'memory.json')), {
    memoryId,
    title: 'Recovery marker symlink',
    sourceKind: 'recording',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:08:00.000Z',
    recordingIds: [],
  });
});

test('recovery preserves metadata-less marker-bearing finalized recordings', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_marker_no_metadata';
  const recordingId = 'rec_20260506_recovery_marker_no_metadata';
  await writeFinalizedRecordingForTest(rootPath, {
    memoryId,
    recordingId,
    title: 'Recovery marker no metadata',
  });
  const recordingDirectory = path.join(rootPath, 'memories', memoryId, 'recordings', recordingId);
  await writeFile(path.join(recordingDirectory, '.reo-finalize-transaction.json'), '{}');

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(path.join(recordingDirectory, 'recording.json'));
  await stat(path.join(recordingDirectory, '.reo-finalize-transaction.json'));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.json')));
});

test('recovery does not unlink outside marker after draft cleanup validation', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_marker_swap';
  const recordingId = 'rec_20260506_recovery_marker_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-recovery-marker-outside-')
  );
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeMemoryJsonForTest(rootPath, {
    memoryId,
    title: 'Recovery marker swap',
    sourceKind: 'recording',
    recordingIds: [recordingId],
  });
  await writeFinalizedRecordingForTest(rootPath, {
    memoryId,
    recordingId,
    title: 'Recovery marker swap',
  });
  const recordingDirectory = path.join(rootPath, 'memories', memoryId, 'recordings', recordingId);
  await writeFile(
    path.join(recordingDirectory, '.reo-finalize-transaction.json'),
    '{"recordingId":"rec_20260506_recovery_marker_swap"}'
  );
  const recordingsDirectory = path.join(rootPath, 'memories', memoryId, 'recordings');
  const outsideTargetDirectory = path.join(outsideRecordingsDirectory, recordingId);

  await recoverRecordingFinalizeTransactions(rootPath, {
    afterDraftCleanup: async () => {
      await mkdir(outsideTargetDirectory, { recursive: true });
      await writeFile(
        path.join(outsideTargetDirectory, '.reo-finalize-transaction.json'),
        'outside marker'
      );
      await rename(recordingsDirectory, `${recordingsDirectory}-preserved`);
      await symlink(outsideRecordingsDirectory, recordingsDirectory, 'dir');
    },
  });

  await stat(path.join(outsideTargetDirectory, '.reo-finalize-transaction.json'));
});

test('recovery ignores symlinked recordings directories without deleting outside files', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_recovery_symlink_recordings',
    title: 'Symlink recordings',
    sourceKind: 'recording',
    recordingIds: [],
  });
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-recordings-outside-'));
  const outsideStaging = path.join(outside, '.reo-finalizing-rec_external');
  await mkdir(outsideStaging, { recursive: true });
  await mkdir(path.join(rootPath, 'memories', 'mem_recovery_symlink_recordings'), {
    recursive: true,
  });
  await symlink(
    outside,
    path.join(rootPath, 'memories', 'mem_recovery_symlink_recordings', 'recordings')
  );

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(outsideStaging);
});

test('recovery drops recording references whose leaf directory is a symlink', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_leaf_symlink';
  const recordingId = 'rec_recovery_leaf_symlink';
  await writeMemoryJsonForTest(rootPath, {
    memoryId,
    title: 'Leaf symlink',
    sourceKind: 'recording',
    recordingIds: [recordingId],
  });
  const recordingsDirectory = path.join(rootPath, 'memories', memoryId, 'recordings');
  const outsideRecordingDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-recording-leaf-'));
  await mkdir(recordingsDirectory);
  await writeFile(path.join(outsideRecordingDirectory, 'audio.webm'), new Uint8Array([1, 2, 3]));
  await writeFile(
    path.join(outsideRecordingDirectory, 'recording.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_memory',
        memoryId,
        recordingId,
        status: 'finalized',
        title: 'Leaf symlink',
        createdAt: '2026-05-06T13:08:00.000Z',
        finalizedAt: '2026-05-06T13:09:00.000Z',
        durationMs: 3000,
        nextSequence: 1,
        audioByteLength: 3,
        transcriptPath: 'transcript.md',
        reflectionsPath: 'reflections.md',
      },
      null,
      2
    )
  );
  await symlink(outsideRecordingDirectory, path.join(recordingsDirectory, recordingId), 'dir');

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(path.join(outsideRecordingDirectory, 'audio.webm'));
  assert.deepEqual(
    (await readJson(path.join(rootPath, 'memories', memoryId, 'memory.json'))) as {
      recordingIds: string[];
    },
    {
      memoryId,
      title: 'Leaf symlink',
      sourceKind: 'recording',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:08:00.000Z',
      recordingIds: [],
    }
  );
});

test('recovery does not delete outside staging after recordings cleanup validation', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_cleanup_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-recovery-cleanup-outside-')
  );
  const stagingName = '.reo-finalizing-rec_20260506_recovery_cleanup_swap.1';
  await writeMemoryJsonForTest(rootPath, {
    memoryId,
    title: 'Recovery cleanup swap',
    sourceKind: 'recording',
    recordingIds: [],
  });
  const recordingsDirectory = path.join(rootPath, 'memories', memoryId, 'recordings');
  await mkdir(path.join(recordingsDirectory, stagingName), { recursive: true });
  await mkdir(path.join(outsideRecordingsDirectory, stagingName), { recursive: true });
  await writeFile(path.join(outsideRecordingsDirectory, stagingName, 'sentinel.txt'), 'outside');

  let swapped = false;
  await recoverRecordingFinalizeTransactions(rootPath, {
    beforeRecordingRecoveryRemove: async () => {
      if (swapped) {
        return;
      }
      swapped = true;
      await rename(
        recordingsDirectory,
        path.join(rootPath, 'memories', memoryId, 'recordings-preserved')
      );
      await symlink(outsideRecordingsDirectory, recordingsDirectory, 'dir');
    },
  });

  assert.equal(swapped, true);
  await stat(path.join(outsideRecordingsDirectory, stagingName, 'sentinel.txt'));
});

test('recovery does not write memory repair outside after memory directory swap', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_repair_swap';
  const outsideMemoryDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-recovery-repair-outside-')
  );
  await writeMemoryJsonForTest(rootPath, {
    memoryId,
    title: 'Recovery repair swap',
    sourceKind: 'recording',
    recordingIds: ['rec_20260506_missing_repair'],
  });
  const memoryDirectoryPath = path.join(rootPath, 'memories', memoryId);
  const recordingsDirectory = path.join(memoryDirectoryPath, 'recordings');
  await mkdir(path.join(recordingsDirectory, '.reo-finalizing-rec_20260506_missing_repair.1'), {
    recursive: true,
  });

  let swapped = false;
  await recoverRecordingFinalizeTransactions(rootPath, {
    beforeRecordingRecoveryRemove: async () => {
      if (swapped) {
        return;
      }
      swapped = true;
      await rename(memoryDirectoryPath, `${memoryDirectoryPath}-preserved`);
      await symlink(outsideMemoryDirectory, memoryDirectoryPath, 'dir');
    },
  });

  assert.equal(swapped, true);
  await assert.rejects(stat(path.join(outsideMemoryDirectory, 'memory.json')));
});

test('rejects concurrent appends to the same memory without losing a draft', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_concurrent',
    title: 'Concurrent memory',
    sourceKind: 'recording',
    recordingIds: [],
  });
  for (const recordingId of ['rec_20260506_concurrent_a', 'rec_20260506_concurrent_b']) {
    await createRecordingDraft({
      rootPath,
      workspaceId: 'ws_memory',
      createRecordingId: () => recordingId,
      now: () => '2026-05-06T13:08:00.000Z',
    });
    await appendRecordingAudioChunk({
      rootPath,
      recordingId,
      sequence: 0,
      chunk: new Uint8Array([1]),
    });
  }

  const results = await Promise.all(
    ['rec_20260506_concurrent_a', 'rec_20260506_concurrent_b'].map((recordingId) =>
      appendRecordingToMemory({
        rootPath,
        workspaceId: 'ws_memory',
        memoryId: 'mem_concurrent',
        recordingId,
        title: 'Concurrent memory',
        durationMs: 1000,
        now: () => '2026-05-06T13:09:00.000Z',
      })
    )
  );

  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok).length, 1);
  const memory = (await readJson(
    path.join(rootPath, 'memories', 'mem_concurrent', 'memory.json')
  )) as { readonly recordingIds: readonly string[] };
  assert.equal(memory.recordingIds.length, 1);
});

test('title update is rejected while the same memory has an active append write', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_title_lock',
    title: 'Original title',
    sourceKind: 'recording',
    recordingIds: [],
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_title_lock',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_title_lock',
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });
  const appendEntered = createDeferred<void>();
  const releaseAppend = createDeferred<void>();

  const append = appendRecordingToMemory({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_title_lock',
    recordingId: 'rec_20260506_title_lock',
    title: 'Locked append',
    durationMs: 1000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterParentFsync: () => {
        appendEntered.resolve();
        return releaseAppend.promise;
      },
    },
  });

  await appendEntered.promise;
  const renamed = await updateMemoryTitleFromFileTruth({
    rootPath,
    memoryId: 'mem_title_lock',
    title: 'Stale concurrent title',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  releaseAppend.resolve();

  assert.equal(renamed.ok, false);
  assert.equal((await append).ok, true);
  assert.deepEqual(
    await readJson(path.join(rootPath, 'memories', 'mem_title_lock', 'memory.json')),
    {
      memoryId: 'mem_title_lock',
      title: 'Original title',
      sourceKind: 'recording',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      recordingIds: ['rec_20260506_title_lock'],
    }
  );
});

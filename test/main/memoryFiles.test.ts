import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {
  mkdir,
  lstat,
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
  appendSegmentSupplementRecordingAudioChunk,
  createRecordingDraft,
  createSegmentSupplementRecordingDraft,
  finalizeRecordingDraftForTest as finalizeRecordingDraft,
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
  appendAudioSupplementToSegmentForTest as appendAudioSupplementToSegment,
  appendAudioSegmentToMemoryForTest as appendAudioSegmentToMemory,
  createMemoryFromFileTruth,
  createMemoryWithRecordingForTest as createMemoryWithRecording,
  deleteMemoryFromFileTruth,
  deleteSegmentSupplementFromFileTruth,
  deleteSegmentFromFileTruth,
  findSegmentDirectoryById,
  fsyncWorkspaceDirectoryForTest,
  readMemoryDetailFromFileTruth,
  readFinalizedSegmentProjection,
  rebuildMemoryIndex,
  recoverRecordingFinalizeTransactions,
  restoreDeletedMemoryFromFileTruth,
  restoreDeletedSegmentSupplementFromFileTruth,
  restoreDeletedSegmentFromFileTruth,
  setAfterReadModelReplaceReadForTest,
  setBeforeFileSpaceNodeMoveForTest,
  setBeforeMemoryDirectoryCandidateScanForTest,
  setBeforeMemoryIndexEntryReadForTest,
  setBeforeReadModelReaddirForTest,
  setBeforeReadModelPersistForTest,
  setBeforeSegmentDirectoryCandidateScanForTest,
  setBeforeSegmentFileTruthListForTest,
  updateMemoryTitleFromFileTruth,
  updateSegmentContentTitleFromFileTruth,
  updateSegmentContentTabOrderFromFileTruth,
  updateSegmentSupplementTitleFromFileTruth,
  updateSegmentTitleFromFileTruth,
} from '../../src/main/memoryFiles.js';
import { initializeWorkspaceFiles } from '../../src/main/workspaceFiles.js';
import {
  parseWorkspaceMarkdownObject,
  renderWorkspaceMarkdownObject,
} from '../../src/main/workspaceMarkdownObjects.js';
import type { LastTranscriptionAttempt } from '../../src/workspace-contract/workspace-contract.js';

async function workspaceRoot(): Promise<string> {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '录音',
    description: '',
    createWorkspaceId: () => 'ws_memory',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  return rootPath;
}

async function createMemoryForDraftFinalize({
  rootPath,
  memoryId,
  title,
  now,
}: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly title: string;
  readonly now: string;
}) {
  const directory = path.join(rootPath, 'memories', memoryId);
  await mkdir(directory, { recursive: true });
  await mkdir(path.join(rootPath, '.reo', 'objects', 'memories'), { recursive: true });
  await writeFile(
    path.join(directory, 'memory.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'memory',
      data: { title },
      content: `# ${title}\n`,
    })
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'memories', `${memoryId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'memory',
        memoryId,
        createdAt: now,
        updatedAt: now,
      },
      null,
      2
    )}\n`
  );
  await rebuildMemoryIndex(rootPath);
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readSupplementTitleForTest(supplementDirectory: string): Promise<string> {
  return (
    parseWorkspaceMarkdownObject({
      objectType: 'supplement',
      markdown: await readFile(path.join(supplementDirectory, 'supplement.md'), 'utf8'),
    }).data as { readonly title: string }
  ).title;
}

async function readSupplementManifestForTest(
  rootPath: string,
  supplementId: string
): Promise<unknown> {
  return readJson(path.join(rootPath, '.reo', 'objects', 'supplements', `${supplementId}.json`));
}

async function workspaceRootFromNodeDirectory(nodeDirectory: string): Promise<string> {
  let current = nodeDirectory;
  for (;;) {
    if (existsSync(path.join(current, '.reo'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Workspace root not found for test node');
    }
    current = parent;
  }
}

async function readMemoryFileTruthForTest(memoryDirectory: string): Promise<{
  readonly memoryId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}> {
  const memoryId = path.basename(memoryDirectory).split('--')[0] ?? '';
  const rootPath = await workspaceRootFromNodeDirectory(memoryDirectory);
  const markdown = parseWorkspaceMarkdownObject({
    objectType: 'memory',
    markdown: await readFile(path.join(memoryDirectory, 'memory.md'), 'utf8'),
  });
  const manifest = (await readJson(
    path.join(rootPath, '.reo', 'objects', 'memories', `${memoryId}.json`)
  )) as {
    readonly memoryId: string;
    readonly createdAt: string;
    readonly updatedAt: string;
  };
  return {
    memoryId: manifest.memoryId,
    title: markdown.data.title,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt,
  };
}

async function readProjectedSegmentIdsFromMemoryDirectoryForTest(
  memoryDirectory: string
): Promise<readonly string[]> {
  const segmentsDirectory = path.join(memoryDirectory, 'segments');
  const rootPath = await workspaceRootFromNodeDirectory(memoryDirectory);
  const memoryId = path.basename(memoryDirectory).split('--')[0] ?? '';
  try {
    const entries = await readdir(segmentsDirectory, { withFileTypes: true });
    const projectedSegmentIds: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      try {
        const segmentId = entry.name.split('--')[0] ?? '';
        const manifest = (await readJson(
          path.join(rootPath, '.reo', 'objects', 'segments', `${segmentId}.json`)
        )) as { readonly segmentId?: unknown; readonly memoryId?: unknown };
        await readFile(path.join(segmentsDirectory, entry.name, 'segment.md'), 'utf8');
        if (manifest.memoryId === memoryId && typeof manifest.segmentId === 'string') {
          projectedSegmentIds.push(manifest.segmentId);
        }
      } catch {
        continue;
      }
    }
    return projectedSegmentIds.sort();
  } catch {
    return [];
  }
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

async function writeMemoryForTest(
  rootPath: string,
  memory: {
    readonly memoryId: string;
    readonly title: string;
  }
): Promise<void> {
  const directory = path.join(rootPath, 'memories', memory.memoryId);
  await mkdir(directory, { recursive: true });
  await mkdir(path.join(rootPath, '.reo', 'objects', 'memories'), { recursive: true });
  await writeFile(
    path.join(directory, 'memory.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'memory',
      data: { title: memory.title },
      content: `# ${memory.title}\n`,
    })
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'memories', `${memory.memoryId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'memory',
        memoryId: memory.memoryId,
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
      },
      null,
      2
    )}\n`
  );
}

async function writeFinalizedAudioSegmentForTest(
  rootPath: string,
  recording: {
    readonly memoryId: string;
    readonly segmentId: string;
    readonly title: string;
    readonly directoryName?: string;
    readonly finalizedAt?: string;
    readonly audioBytes?: readonly number[];
    readonly lastTranscriptionAttempt?: unknown;
    readonly contentTabOrder?: readonly string[];
  }
): Promise<string> {
  const audioBytes = recording.audioBytes ?? [1, 2, 3];
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    recording.memoryId,
    'segments',
    recording.directoryName ?? recording.segmentId
  );
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array(audioBytes));
  await writeFile(
    path.join(recordingDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: recording.title, kind: 'audio' },
      content: `# ${recording.title}\n\n## Transcript\n\n`,
    })
  );
  await mkdir(path.join(rootPath, '.reo', 'objects', 'segments'), { recursive: true });
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'segments', `${recording.segmentId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'segment',
        workspaceId: 'ws_memory',
        memoryId: recording.memoryId,
        segmentId: recording.segmentId,
        kind: 'audio',
        createdAt: '2026-05-06T13:08:00.000Z',
        finalizedAt: recording.finalizedAt ?? '2026-05-06T13:09:00.000Z',
        updatedAt: recording.finalizedAt ?? '2026-05-06T13:09:00.000Z',
        durationMs: 1000,
        nextSequence: 1,
        audioByteLength: audioBytes.length,
        ...(recording.lastTranscriptionAttempt !== undefined
          ? { lastTranscriptionAttempt: recording.lastTranscriptionAttempt }
          : {}),
        ...(recording.contentTabOrder !== undefined
          ? { contentTabOrder: recording.contentTabOrder }
          : {}),
      },
      null,
      2
    )}\n`
  );
  return recordingDirectory;
}

async function writeFinalizedAudioSupplementForTest(
  rootPath: string,
  supplement: {
    readonly memoryId: string;
    readonly segmentId: string;
    readonly supplementId: string;
    readonly title: string;
    readonly finalizedAt: string;
    readonly directoryName?: string;
    readonly audioBytes?: readonly number[];
    readonly transcript?: string;
    readonly lastTranscriptionAttempt?: unknown;
  }
): Promise<void> {
  const audioBytes = supplement.audioBytes ?? [4, 5, 6];
  const supplementDirectory = path.join(
    rootPath,
    'memories',
    supplement.memoryId,
    'segments',
    supplement.segmentId,
    'supplements',
    supplement.directoryName ?? supplement.supplementId
  );
  await mkdir(supplementDirectory, { recursive: true });
  await writeFile(path.join(supplementDirectory, 'audio.webm'), new Uint8Array(audioBytes));
  await writeFile(
    path.join(supplementDirectory, 'supplement.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'supplement',
      data: { title: supplement.title, kind: 'audio' },
      content: `# ${supplement.title}\n\n## Transcript\n\n${supplement.transcript ?? ''}`,
    })
  );
  await mkdir(path.join(rootPath, '.reo', 'objects', 'supplements'), { recursive: true });
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'supplements', `${supplement.supplementId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'supplement',
        workspaceId: 'ws_memory',
        memoryId: supplement.memoryId,
        segmentId: supplement.segmentId,
        supplementId: supplement.supplementId,
        kind: 'audio',
        createdAt: '2026-05-06T13:08:00.000Z',
        finalizedAt: supplement.finalizedAt,
        updatedAt: supplement.finalizedAt,
        durationMs: 500,
        nextSequence: 1,
        audioByteLength: audioBytes.length,
        ...(supplement.lastTranscriptionAttempt !== undefined
          ? { lastTranscriptionAttempt: supplement.lastTranscriptionAttempt }
          : {}),
      },
      null,
      2
    )}\n`
  );
}

async function writeFinalizedNoteSegmentForTest(
  rootPath: string,
  note: {
    readonly memoryId: string;
    readonly segmentId: string;
    readonly title: string;
    readonly body: string;
    readonly finalizedAt?: string;
  }
): Promise<string> {
  const segmentDirectory = path.join(
    rootPath,
    'memories',
    note.memoryId,
    'segments',
    note.segmentId
  );
  await mkdir(segmentDirectory, { recursive: true });
  await writeFile(
    path.join(segmentDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: note.title, kind: 'note' },
      content: note.body,
    })
  );
  await mkdir(path.join(rootPath, '.reo', 'objects', 'segments'), { recursive: true });
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'segments', `${note.segmentId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'segment',
        workspaceId: 'ws_memory',
        memoryId: note.memoryId,
        segmentId: note.segmentId,
        kind: 'note',
        createdAt: '2026-05-06T13:08:00.000Z',
        finalizedAt: note.finalizedAt ?? '2026-05-06T13:09:00.000Z',
        updatedAt: note.finalizedAt ?? '2026-05-06T13:09:00.000Z',
        bodyByteLength: Buffer.byteLength(note.body, 'utf8'),
      },
      null,
      2
    )}\n`
  );
  return segmentDirectory;
}

async function writeFinalizedNoteSupplementForTest(
  rootPath: string,
  note: {
    readonly memoryId: string;
    readonly segmentId: string;
    readonly supplementId: string;
    readonly title: string;
    readonly body: string;
    readonly finalizedAt: string;
  }
): Promise<void> {
  const supplementDirectory = path.join(
    rootPath,
    'memories',
    note.memoryId,
    'segments',
    note.segmentId,
    'supplements',
    note.supplementId
  );
  await mkdir(supplementDirectory, { recursive: true });
  await writeFile(
    path.join(supplementDirectory, 'supplement.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'supplement',
      data: { title: note.title, kind: 'note' },
      content: note.body,
    })
  );
  await mkdir(path.join(rootPath, '.reo', 'objects', 'supplements'), { recursive: true });
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'supplements', `${note.supplementId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'supplement',
        workspaceId: 'ws_memory',
        memoryId: note.memoryId,
        segmentId: note.segmentId,
        supplementId: note.supplementId,
        kind: 'note',
        createdAt: '2026-05-06T13:08:00.000Z',
        finalizedAt: note.finalizedAt,
        updatedAt: note.finalizedAt,
        bodyByteLength: Buffer.byteLength(note.body, 'utf8'),
      },
      null,
      2
    )}\n`
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
    createSegmentId: () => 'seg_20260506_000001',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.deepEqual(draft, {
    ok: true,
    segmentId: 'seg_20260506_000001',
    nextSequence: 0,
  });

  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_000001',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_20260506_000001',
    title: 'My seventh birthday',
    now: '2026-05-06T13:09:00.000Z',
  });

  const finalized = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    segmentId: 'seg_20260506_000001',
    memoryId: 'mem_20260506_000001',
    title: 'My seventh birthday',
    durationMs: 73_000,
    now: () => '2026-05-06T13:09:00.000Z',
  });

  assert.deepEqual(finalized, {
    ok: true,
    segment: {
      workspaceId: 'ws_memory',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      type: 'audio',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 73_000,
      audioByteLength: 3,
      lastTranscriptionAttempt: 'never',
      transcript: { exists: false },
      supplementCount: 0,
      supplements: [],
      contentTabOrder: ['segment'],
    },
    memory: {
      memoryId: 'mem_20260506_000001',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:09:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      segmentCount: 1,
      audioSegmentCount: 1,
      noteSegmentCount: 0,
      audioDurationMs: 73_000,
      audioByteLength: 3,
      hasAudioTranscript: false,
      hasAnyNote: false,
      supplementCount: 0,
    },
  });
  assert.deepEqual(
    await readMemoryFileTruthForTest(path.join(rootPath, 'memories', 'mem_20260506_000001')),
    {
      memoryId: 'mem_20260506_000001',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:09:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
    }
  );
  const segmentDirectory = await findSegmentDirectoryById(rootPath, 'seg_20260506_000001');
  assert.equal(path.basename(segmentDirectory), 'seg_20260506_000001--My seventh birthday');
  const audio = await stat(path.join(segmentDirectory, 'audio.webm'));
  assert.equal(audio.size, 3);
  assert.deepEqual(
    await readJson(path.join(rootPath, '.reo', 'objects', 'segments', 'seg_20260506_000001.json')),
    {
      schemaVersion: 1,
      objectType: 'segment',
      workspaceId: 'ws_memory',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      kind: 'audio',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 73_000,
      nextSequence: 1,
      audioByteLength: 3,
      lastTranscriptionAttempt: 'never',
    }
  );
  assert.equal(
    (
      parseWorkspaceMarkdownObject({
        objectType: 'segment',
        markdown: await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'),
      }).data as { readonly title: string }
    ).title,
    'My seventh birthday'
  );
  await assert.rejects(stat(path.join(segmentDirectory, 'segment.json')));
  await assert.rejects(stat(path.join(segmentDirectory, 'transcript.md')));
  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_000001'))
  );
});

test('recording finalize refreshes only the owning memory index entry on success', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_finalize_targeted_refresh';
  const segmentId = 'seg_finalize_targeted_refresh';
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId,
    title: 'Targeted refresh',
    now: '2026-05-06T13:08:00.000Z',
  });
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:09:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  let fullRebuildCount = 0;
  setBeforeReadModelReaddirForTest(() => {
    fullRebuildCount += 1;
  });

  try {
    const finalized = await finalizeRecordingDraft({
      rootPath,
      workspaceId: 'ws_memory',
      segmentId,
      memoryId,
      title: 'Targeted segment',
      durationMs: 1000,
      now: () => '2026-05-06T13:10:00.000Z',
    });

    assert.equal(finalized.ok, true);
    assert.equal(fullRebuildCount, 0);
    if (finalized.ok) {
      assert.equal(finalized.memory.memoryId, memoryId);
      assert.equal(finalized.memory.segmentCount, 1);
      assert.deepEqual(await readWorkspaceIndex(rootPath), {
        schemaVersion: 1,
        memories: [finalized.memory],
      });
    }
  } finally {
    setBeforeReadModelReaddirForTest(null);
  }
});

test('updates titles through file truth before rebuilding the index projection', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_1',
    title: 'Original title',
  });

  const updated = await updateMemoryTitleFromFileTruth({
    rootPath,
    memoryId: 'mem_1',
    title: 'Renamed memory',
    now: () => '2026-05-06T13:10:00.000Z',
  });

  assert.equal(updated.ok, true);
  await assert.rejects(stat(path.join(rootPath, 'memories', 'mem_1')));
  assert.deepEqual(
    await readMemoryFileTruthForTest(path.join(rootPath, 'memories', 'mem_1--Renamed memory')),
    {
      memoryId: 'mem_1',
      title: 'Renamed memory',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:08:00.000Z',
    }
  );
  assert.deepEqual(await readWorkspaceIndex(rootPath), {
    schemaVersion: 1,
    memories: [
      {
        memoryId: 'mem_1',
        title: 'Renamed memory',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
        segmentCount: 0,
        audioSegmentCount: 0,
        noteSegmentCount: 0,
        audioDurationMs: 0,
        audioByteLength: 0,
        hasAudioTranscript: false,
        hasAnyNote: false,
        supplementCount: 0,
      },
    ],
  });
});

test('renames segment file-space node through file truth and returns refreshed projection', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_title_update';
  const segmentId = 'seg_20260506_title_update';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '片段命名',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音1',
  });

  const updated = await updateSegmentTitleFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: '晨间记录',
    now: () => '2026-05-06T13:12:00.000Z',
  });

  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.value.segment.title, '晨间记录');
    assert.equal(updated.value.segment.updatedAt, '2026-05-06T13:09:00.000Z');
    assert.equal(updated.value.memory.updatedAt, '2026-05-06T13:09:00.000Z');
  }
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId)));
  await stat(path.join(rootPath, 'memories', memoryId, 'segments', `${segmentId}--晨间记录`));
  assert.equal(
    parseWorkspaceMarkdownObject({
      objectType: 'segment',
      markdown: await readFile(
        path.join(
          rootPath,
          'memories',
          memoryId,
          'segments',
          `${segmentId}--晨间记录`,
          'segment.md'
        ),
        'utf8'
      ),
    }).data.title,
    '晨间记录'
  );
});

test('updates primary content title in segment markdown without renaming the segment node', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_content_title_update';
  const segmentId = 'seg_20260520_content_title_update';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '内容标题更新',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音1',
  });

  const updated = await updateSegmentContentTitleFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    contentTitle: '访谈转录',
    now: () => '2026-05-06T13:12:00.000Z',
  });

  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.value.segment.title, '录音1');
    assert.equal(updated.value.segment.contentTitle, '访谈转录');
    assert.equal(updated.value.memory.segmentCount, 1);
  }

  const segmentDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  await stat(segmentDirectory);
  const parsed = parseWorkspaceMarkdownObject({
    objectType: 'segment',
    markdown: await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'),
  });
  assert.equal(parsed.data.title, '录音1');
  assert.equal('content_title' in parsed.data ? parsed.data.content_title : undefined, '访谈转录');
});

test('rejects primary content title updates when segment file truth belongs to another workspace', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_content_title_workspace_mismatch';
  const segmentId = 'seg_20260520_content_title_workspace_mismatch';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '内容标题工作区不匹配',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音1',
  });

  const updated = await updateSegmentContentTitleFromFileTruth({
    rootPath,
    workspaceId: 'ws_other',
    memoryId,
    segmentId,
    contentTitle: '不应写入',
    now: () => '2026-05-06T13:12:00.000Z',
  });

  assert.equal(updated.ok, false);
  const parsed = parseWorkspaceMarkdownObject({
    objectType: 'segment',
    markdown: await readFile(
      path.join(rootPath, 'memories', memoryId, 'segments', segmentId, 'segment.md'),
      'utf8'
    ),
  });
  assert.equal('content_title' in parsed.data ? parsed.data.content_title : undefined, undefined);
});

test('renames a segment when memory directory scan is missing no valid file-space node', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_title_missing_mirror';
  const segmentId = 'seg_20260512_missing_mirror';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '片段镜像修复',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音25',
    directoryName: `${segmentId}--录音25`,
    finalizedAt: '2026-05-12T16:27:09.824Z',
  });

  const updated = await updateSegmentTitleFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: '重命名后的录音',
    now: () => '2026-05-12T16:40:00.000Z',
  });

  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.value.segment.title, '重命名后的录音');
    assert.equal(updated.value.memory.segmentCount, 1);
  }
  assert.deepEqual(
    await readProjectedSegmentIdsFromMemoryDirectoryForTest(
      path.join(rootPath, 'memories', memoryId)
    ),
    [segmentId]
  );
});

test('renames finalized note segment file-space node through file truth', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_note_segment_title_update';
  const segmentId = 'seg_note_title_update';
  const body = '# 旧笔记\n\n保留正文。\n';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '笔记命名',
  });
  await writeFinalizedNoteSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '旧笔记',
    body,
  });

  const updated = await updateSegmentTitleFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: '新的笔记',
    now: () => '2026-05-06T13:12:00.000Z',
  });

  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.value.segment.title, '新的笔记');
    assert.equal(updated.value.segment.type, 'note');
    assert.equal(updated.value.segment.bodyByteLength, Buffer.byteLength(body, 'utf8'));
    assert.equal(updated.value.memory.hasAnyNote, true);
    assert.equal(updated.value.memory.noteSegmentCount, 1);
  }
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId)));
  const renamedSegmentDirectory = path.join(
    rootPath,
    'memories',
    memoryId,
    'segments',
    `${segmentId}--新的笔记`
  );
  await stat(renamedSegmentDirectory);
  const markdown = parseWorkspaceMarkdownObject({
    objectType: 'segment',
    markdown: await readFile(path.join(renamedSegmentDirectory, 'segment.md'), 'utf8'),
  });
  assert.equal(markdown.data.title, '新的笔记');
  assert.equal('kind' in markdown.data ? markdown.data.kind : undefined, 'note');
  assert.equal(markdown.content, body);
});

test('renames segment supplement file-space node and refreshes the parent memory index', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_supplement_title_update';
  const segmentId = 'seg_20260514_supplement_title_update';
  const supplementId = 'sup_20260514_supplement_title_update';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '补充命名',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音1',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId,
    title: '补充录音1',
    finalizedAt: '2026-05-06T13:11:00.000Z',
  });
  await writeFile(
    path.join(rootPath, '.reo', 'index.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        memories: [
          {
            memoryId,
            title: '补充命名',
            createdAt: '2026-05-06T13:08:00.000Z',
            updatedAt: '2026-05-06T13:09:00.000Z',
            segmentCount: 1,
            audioSegmentCount: 1,
            noteSegmentCount: 0,
            audioDurationMs: 1000,
            audioByteLength: 3,
            hasAudioTranscript: false,
            hasAnyNote: false,
            supplementCount: 0,
          },
        ],
      },
      null,
      2
    )}\n`
  );

  const updated = await updateSegmentSupplementTitleFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    supplementId,
    title: '现场补充',
  });

  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.value.memory.supplementCount, 1);
    assert.equal(updated.value.segment.supplementCount, 1);
    assert.equal(updated.value.supplement.title, '现场补充');
    assert.equal(updated.value.supplement.updatedAt, '2026-05-06T13:11:00.000Z');
  }
  await assert.rejects(
    stat(
      path.join(rootPath, 'memories', memoryId, 'segments', segmentId, 'supplements', supplementId)
    )
  );
  const renamedSupplementDirectory = path.join(
    rootPath,
    'memories',
    memoryId,
    'segments',
    segmentId,
    'supplements',
    `${supplementId}--现场补充`
  );
  await stat(renamedSupplementDirectory);
  assert.equal(await readSupplementTitleForTest(renamedSupplementDirectory), '现场补充');
  assert.deepEqual(await readSupplementManifestForTest(rootPath, supplementId), {
    schemaVersion: 1,
    objectType: 'supplement',
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    supplementId,
    kind: 'audio',
    createdAt: '2026-05-06T13:08:00.000Z',
    finalizedAt: '2026-05-06T13:11:00.000Z',
    updatedAt: '2026-05-06T13:11:00.000Z',
    durationMs: 500,
    nextSequence: 1,
    audioByteLength: 3,
  });
  assert.deepEqual(await readWorkspaceIndex(rootPath), {
    schemaVersion: 1,
    memories: [
      {
        memoryId,
        title: '补充命名',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:11:00.000Z',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        audioDurationMs: 1000,
        audioByteLength: 3,
        hasAudioTranscript: false,
        hasAnyNote: false,
        supplementCount: 1,
      },
    ],
  });
});

test('renames finalized note segment supplement file-space node through file truth', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_note_supplement_title_update';
  const segmentId = 'seg_note_supplement_title_update';
  const supplementId = 'sup_note_supplement_title_update';
  const body = '# 旧补充\n\n保留补充正文。\n';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '笔记补充命名',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音1',
  });
  await writeFinalizedNoteSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId,
    title: '旧补充',
    body,
    finalizedAt: '2026-05-06T13:11:00.000Z',
  });

  const updated = await updateSegmentSupplementTitleFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    supplementId,
    title: '新的补充',
  });

  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.value.memory.hasAnyNote, true);
    assert.equal(updated.value.segment.supplementCount, 1);
    assert.equal(updated.value.supplement.title, '新的补充');
    assert.equal(updated.value.supplement.type, 'note');
    assert.equal(updated.value.supplement.bodyByteLength, Buffer.byteLength(body, 'utf8'));
  }
  await assert.rejects(
    stat(
      path.join(rootPath, 'memories', memoryId, 'segments', segmentId, 'supplements', supplementId)
    )
  );
  const renamedSupplementDirectory = path.join(
    rootPath,
    'memories',
    memoryId,
    'segments',
    segmentId,
    'supplements',
    `${supplementId}--新的补充`
  );
  await stat(renamedSupplementDirectory);
  const markdown = parseWorkspaceMarkdownObject({
    objectType: 'supplement',
    markdown: await readFile(path.join(renamedSupplementDirectory, 'supplement.md'), 'utf8'),
  });
  assert.equal(markdown.data.title, '新的补充');
  assert.equal('kind' in markdown.data ? markdown.data.kind : undefined, 'note');
  assert.equal(markdown.content, body);
});

test('segment supplement title update rejects workspace mismatch before moving files', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_supplement_workspace_mismatch';
  const segmentId = 'seg_supplement_workspace_mismatch';
  const supplementId = 'sup_supplement_workspace_mismatch';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '补充命名空间不匹配',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音1',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId,
    title: '补充录音1',
    finalizedAt: '2026-05-06T13:11:00.000Z',
  });

  const updated = await updateSegmentSupplementTitleFromFileTruth({
    rootPath,
    workspaceId: 'ws_other',
    memoryId,
    segmentId,
    supplementId,
    title: '不应写入',
  });

  assert.equal(updated.ok, false);
  if (!updated.ok) {
    assert.equal(updated.error.code, 'ERR_RECORDING_NOT_FOUND');
    assert.equal(updated.error.dataRetention, 'none-written');
  }
  const supplementDirectory = path.join(
    rootPath,
    'memories',
    memoryId,
    'segments',
    segmentId,
    'supplements',
    supplementId
  );
  await stat(supplementDirectory);
  assert.equal(await readSupplementTitleForTest(supplementDirectory), '补充录音1');
  await assert.rejects(
    stat(
      path.join(
        rootPath,
        'memories',
        memoryId,
        'segments',
        segmentId,
        'supplements',
        `${supplementId}--不应写入`
      )
    )
  );
});

test('segment supplement title update reports stale index when refresh fails after file write', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_supplement_title_index_stale';
  const segmentId = 'seg_supplement_title_index_stale';
  const supplementId = 'sup_supplement_title_index_stale';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '补充命名索引失败',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音1',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId,
    title: '补充录音1',
    finalizedAt: '2026-05-06T13:11:00.000Z',
  });
  await rm(path.join(rootPath, '.reo', 'index.json'));
  await mkdir(path.join(rootPath, '.reo', 'index.json'));

  const updated = await updateSegmentSupplementTitleFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    supplementId,
    title: '现场补充',
  });

  assert.equal(updated.ok, false);
  if (!updated.ok) {
    assert.equal(updated.error.code, 'ERR_MEMORY_UPDATE_FAILED');
    assert.equal(updated.error.dataRetention, 'file-written-index-stale');
  }
  const renamedSupplementDirectory = path.join(
    rootPath,
    'memories',
    memoryId,
    'segments',
    segmentId,
    'supplements',
    `${supplementId}--现场补充`
  );
  await stat(renamedSupplementDirectory);
  assert.equal(await readSupplementTitleForTest(renamedSupplementDirectory), '现场补充');
});

test('segment supplement title update rejects renamed symlink candidates without fallback', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_supplement_renamed_symlink';
  const segmentId = 'seg_supplement_renamed_symlink';
  const supplementId = 'sup_supplement_renamed_symlink';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '补充不安全候选',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音1',
  });
  const supplementsDirectory = path.join(
    rootPath,
    'memories',
    memoryId,
    'segments',
    segmentId,
    'supplements'
  );
  const outsideDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-supplement-outside-'));
  const renamedCandidate = `${supplementId}--Finder title`;
  const renamedCandidatePath = path.join(supplementsDirectory, renamedCandidate);
  await mkdir(supplementsDirectory, { recursive: true });
  await symlink(outsideDirectory, renamedCandidatePath);

  const updated = await updateSegmentSupplementTitleFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    supplementId,
    title: '不应写入',
  });

  assert.equal(updated.ok, false);
  if (!updated.ok) {
    assert.equal(updated.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  assert.equal((await lstat(renamedCandidatePath)).isSymbolicLink(), true);
  await stat(outsideDirectory);
  await assert.rejects(stat(path.join(supplementsDirectory, `${supplementId}--不应写入`)));
});

test('segment supplement title update rejects renamed non-directory candidates without fallback', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_supplement_renamed_file';
  const segmentId = 'seg_supplement_renamed_file';
  const supplementId = 'sup_supplement_renamed_file';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '补充不安全文件候选',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音1',
  });
  const supplementsDirectory = path.join(
    rootPath,
    'memories',
    memoryId,
    'segments',
    segmentId,
    'supplements'
  );
  const renamedCandidate = `${supplementId}--Finder title`;
  const renamedCandidatePath = path.join(supplementsDirectory, renamedCandidate);
  await mkdir(supplementsDirectory, { recursive: true });
  await writeFile(renamedCandidatePath, 'not an supplement directory');

  const updated = await updateSegmentSupplementTitleFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    supplementId,
    title: '不应写入',
  });

  assert.equal(updated.ok, false);
  if (!updated.ok) {
    assert.equal(updated.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  assert.equal((await lstat(renamedCandidatePath)).isFile(), true);
  await assert.rejects(stat(path.join(supplementsDirectory, `${supplementId}--不应写入`)));
});

test('segment supplement title update rejects unsafe metadata leaf candidates without fallback', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_supplement_unsafe_metadata';
  const segmentId = 'seg_supplement_unsafe_metadata';
  const supplementId = 'sup_supplement_unsafe_metadata';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '补充不安全 metadata',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音1',
  });
  const supplementsDirectory = path.join(
    rootPath,
    'memories',
    memoryId,
    'segments',
    segmentId,
    'supplements'
  );
  const renamedCandidate = `${supplementId}--Finder title`;
  const renamedCandidatePath = path.join(supplementsDirectory, renamedCandidate);
  const outsideMetadata = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-supplement-metadata-outside-')),
    'supplement.md'
  );
  await mkdir(renamedCandidatePath, { recursive: true });
  await writeFile(path.join(renamedCandidatePath, 'audio.webm'), new Uint8Array([4, 5]));
  await writeFile(outsideMetadata, '---\ntitle: Outside\nkind: audio\n---\n# Outside\n');
  await mkdir(path.join(rootPath, '.reo', 'objects', 'supplements'), { recursive: true });
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'supplements', `${supplementId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'supplement',
        workspaceId: 'ws_memory',
        memoryId,
        segmentId,
        supplementId,
        kind: 'audio',
        createdAt: '2026-05-06T13:08:00.000Z',
        finalizedAt: '2026-05-06T13:11:00.000Z',
        updatedAt: '2026-05-06T13:11:00.000Z',
        durationMs: 500,
        nextSequence: 1,
        audioByteLength: 2,
      },
      null,
      2
    )}\n`
  );
  await symlink(outsideMetadata, path.join(renamedCandidatePath, 'supplement.md'));

  const updated = await updateSegmentSupplementTitleFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    supplementId,
    title: '不应写入',
  });

  assert.equal(updated.ok, false);
  if (!updated.ok) {
    assert.equal(updated.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  assert.equal(
    (await lstat(path.join(renamedCandidatePath, 'supplement.md'))).isSymbolicLink(),
    true
  );
  await assert.rejects(stat(path.join(supplementsDirectory, `${supplementId}--不应写入`)));
});

test('delete and restore move SegmentSupplement files through the supplement trash', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_supplement_delete_restore';
  const segmentId = 'seg_supplement_delete_restore';
  const supplementId = 'sup_supplement_delete_restore';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '补充删除恢复',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音1',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId,
    title: '补充录音1',
    directoryName: `${supplementId}--补充录音1`,
    finalizedAt: '2026-05-06T13:11:00.000Z',
    audioBytes: [4, 5, 6, 7],
  });
  const activeSupplementDirectory = path.join(
    rootPath,
    'memories',
    memoryId,
    'segments',
    segmentId,
    'supplements',
    `${supplementId}--补充录音1`
  );
  const trashedSupplementDirectory = path.join(
    rootPath,
    '.reo',
    'trash',
    'supplements',
    `${supplementId}--补充录音1`
  );

  const deleted = await deleteSegmentSupplementFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    supplementId,
  });

  assert.equal(deleted.ok, true);
  if (deleted.ok) {
    assert.equal(deleted.value.supplementId, supplementId);
    assert.equal(deleted.value.restoreToken, supplementId);
    assert.equal(deleted.value.memory.supplementCount, 0);
    assert.equal(deleted.value.segment.supplementCount, 0);
    assert.deepEqual(deleted.value.segment.supplements, []);
  }
  await assert.rejects(stat(activeSupplementDirectory));
  await stat(path.join(trashedSupplementDirectory, 'audio.webm'));
  await stat(path.join(trashedSupplementDirectory, 'supplement.md'));
  assert.equal(
    (
      (await readSupplementManifestForTest(rootPath, supplementId)) as {
        readonly supplementId: string;
      }
    ).supplementId,
    supplementId
  );
  assert.deepEqual(await readWorkspaceIndex(rootPath), {
    schemaVersion: 1,
    memories: [
      {
        memoryId,
        title: '补充删除恢复',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:09:00.000Z',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        audioDurationMs: 1000,
        audioByteLength: 3,
        hasAudioTranscript: false,
        hasAnyNote: false,
        supplementCount: 0,
      },
    ],
  });

  const restored = await restoreDeletedSegmentSupplementFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    restoreToken: supplementId,
  });

  assert.equal(restored.ok, true);
  if (restored.ok) {
    assert.equal(restored.value.memory.supplementCount, 1);
    assert.equal(restored.value.segment.supplementCount, 1);
    assert.equal(restored.value.supplement.supplementId, supplementId);
    assert.equal(restored.value.supplement.title, '补充录音1');
  }
  await stat(path.join(activeSupplementDirectory, 'audio.webm'));
  await stat(path.join(activeSupplementDirectory, 'supplement.md'));
  await assert.rejects(stat(trashedSupplementDirectory));
  assert.deepEqual(await readWorkspaceIndex(rootPath), {
    schemaVersion: 1,
    memories: [
      {
        memoryId,
        title: '补充删除恢复',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:11:00.000Z',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        audioDurationMs: 1000,
        audioByteLength: 3,
        hasAudioTranscript: false,
        hasAnyNote: false,
        supplementCount: 1,
      },
    ],
  });
});

test('restore SegmentSupplement returns parent missing and leaves trash recoverable', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_supplement_restore_parent_missing';
  const segmentId = 'seg_supplement_restore_parent_missing';
  const supplementId = 'sup_supplement_restore_parent_missing';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '补充恢复父级缺失',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音1',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId,
    title: '补充录音1',
    directoryName: `${supplementId}--补充录音1`,
    finalizedAt: '2026-05-06T13:11:00.000Z',
  });
  const activeSegmentDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  const trashedSupplementDirectory = path.join(
    rootPath,
    '.reo',
    'trash',
    'supplements',
    `${supplementId}--补充录音1`
  );

  const deleted = await deleteSegmentSupplementFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    supplementId,
  });
  assert.equal(deleted.ok, true);
  await rm(activeSegmentDirectory, { recursive: true, force: true });

  const restored = await restoreDeletedSegmentSupplementFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    restoreToken: supplementId,
  });

  assert.equal(restored.ok, false);
  if (!restored.ok) {
    assert.equal(restored.error.code, 'ERR_SEGMENT_SUPPLEMENT_RESTORE_PARENT_MISSING');
    assert.equal(restored.error.dataRetention, 'previous-file-preserved');
  }
  await stat(path.join(trashedSupplementDirectory, 'audio.webm'));
  await stat(path.join(trashedSupplementDirectory, 'supplement.md'));
});

test('delete and restore keep externally renamed segment directories addressable by metadata id', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_delete_restore';
  const segmentId = 'seg_delete_restore';
  const keepSegmentId = 'seg_keep_after_delete';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '片段删除恢复',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: 'Metadata segment title',
    directoryName: `${segmentId}--Finder segment title`,
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId: keepSegmentId,
    title: 'Keep segment',
  });
  await rebuildMemoryIndex(rootPath);

  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });

  assert.equal(deleted.ok, true);
  if (deleted.ok) {
    assert.equal(deleted.value.segmentId, segmentId);
    assert.equal(deleted.value.restoreToken, segmentId);
    assert.equal(deleted.value.memory.segmentCount, 1);
  }
  await assert.rejects(
    stat(
      path.join(rootPath, 'memories', memoryId, 'segments', `${segmentId}--Finder segment title`)
    )
  );
  await stat(
    path.join(rootPath, '.reo', 'trash', 'segments', `${segmentId}--Finder segment title`)
  );
  assert.deepEqual(
    await readProjectedSegmentIdsFromMemoryDirectoryForTest(
      path.join(rootPath, 'memories', memoryId)
    ),
    [keepSegmentId]
  );

  const restored = await restoreDeletedSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    restoreToken: segmentId,
  });

  assert.equal(restored.ok, true);
  if (restored.ok) {
    assert.equal(restored.value.segment.segmentId, segmentId);
    assert.equal(restored.value.segment.title, 'Metadata segment title');
    assert.equal(restored.value.memory.segmentCount, 2);
  }
  await stat(
    path.join(rootPath, 'memories', memoryId, 'segments', `${segmentId}--Finder segment title`)
  );
  const restoredSegmentIds = await readProjectedSegmentIdsFromMemoryDirectoryForTest(
    path.join(rootPath, 'memories', memoryId)
  );
  assert.equal(restoredSegmentIds.includes(segmentId), true);
  assert.equal(restoredSegmentIds.includes(keepSegmentId), true);
});

test('delete and restore move Segment supplements with the parent Segment directory', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_delete_supplement';
  const segmentId = 'seg_delete_supplement';
  const supplementId = 'sup_delete_supplement';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '片段补充删除',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音补充',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId,
    title: '补充录音',
    finalizedAt: '2026-05-06T13:10:00.000Z',
  });
  await rebuildMemoryIndex(rootPath);

  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });

  assert.equal(deleted.ok, true);
  await stat(
    path.join(
      rootPath,
      '.reo',
      'trash',
      'segments',
      segmentId,
      'supplements',
      supplementId,
      'audio.webm'
    )
  );
  assert.deepEqual(await readWorkspaceIndex(rootPath), {
    schemaVersion: 1,
    memories: [
      {
        memoryId,
        title: '片段补充删除',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
        segmentCount: 0,
        audioSegmentCount: 0,
        noteSegmentCount: 0,
        audioDurationMs: 0,
        audioByteLength: 0,
        hasAudioTranscript: false,
        hasAnyNote: false,
        supplementCount: 0,
      },
    ],
  });

  const restored = await restoreDeletedSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    restoreToken: segmentId,
  });

  assert.equal(restored.ok, true);
  if (restored.ok) {
    assert.equal(restored.value.segment.supplementCount, 1);
    assert.equal(restored.value.segment.supplements[0]?.supplementId, supplementId);
    assert.equal(restored.value.memory.supplementCount, 1);
  }
  await stat(
    path.join(rootPath, 'memories', memoryId, 'segments', segmentId, 'supplements', supplementId)
  );
});

test('restore deleted Segment returns a typed error when the parent Memory is missing', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_restore_parent_missing';
  const segmentId = 'seg_restore_parent_missing';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '父记忆缺失',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '待恢复录音',
  });

  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });
  assert.equal(deleted.ok, true);
  await rm(path.join(rootPath, 'memories', memoryId), { recursive: true, force: true });

  const restored = await restoreDeletedSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    restoreToken: segmentId,
  });

  assert.equal(restored.ok, false);
  if (!restored.ok) {
    assert.equal(restored.error.code, 'ERR_SEGMENT_RESTORE_PARENT_MISSING');
  }
  await stat(path.join(rootPath, '.reo', 'trash', 'segments', segmentId));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId)));
});

test('delete Segment rejects symlinked segment directories without following them', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_delete_symlink';
  const segmentId = 'seg_delete_symlink';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '不安全片段',
  });
  const outsideDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-segment-outside-'));
  await mkdir(path.join(rootPath, 'memories', memoryId, 'segments'), { recursive: true });
  await symlink(outsideDirectory, path.join(rootPath, 'memories', memoryId, 'segments', segmentId));

  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });

  assert.equal(deleted.ok, false);
  if (!deleted.ok) {
    assert.equal(deleted.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  await stat(outsideDirectory);
  await assert.rejects(stat(path.join(rootPath, '.reo', 'trash', 'segments', segmentId)));
});

test('delete Segment rejects source directory replacement after validating file truth', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_delete_replaced_source';
  const segmentId = 'seg_delete_replaced_source';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '删除替换源',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '原始片段',
  });
  const activeDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  const preservedOriginalDirectory = path.join(
    rootPath,
    'memories',
    memoryId,
    'segments',
    `${segmentId}--preserved-original`
  );
  setBeforeFileSpaceNodeMoveForTest(async () => {
    setBeforeFileSpaceNodeMoveForTest(null);
    await rename(activeDirectory, preservedOriginalDirectory);
    await writeFinalizedAudioSegmentForTest(rootPath, {
      memoryId,
      segmentId,
      title: '替换片段',
    });
  });

  try {
    const deleted = await deleteSegmentFromFileTruth({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      segmentId,
    });

    assert.equal(deleted.ok, false);
    if (!deleted.ok) {
      assert.equal(deleted.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
      assert.equal(deleted.error.dataRetention, 'previous-file-preserved');
    }
  } finally {
    setBeforeFileSpaceNodeMoveForTest(null);
  }

  await stat(path.join(activeDirectory, 'audio.webm'));
  await stat(path.join(preservedOriginalDirectory, 'audio.webm'));
  await assert.rejects(stat(path.join(rootPath, '.reo', 'trash', 'segments', segmentId)));
});

test('delete Segment reports unsafe finalized metadata leaf instead of treating it as missing', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_delete_unsafe_metadata_leaf';
  const segmentId = 'seg_delete_unsafe_metadata_leaf';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '不安全 metadata',
  });
  const recordingDirectory = await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '不安全 metadata',
  });
  const outsideMetadata = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-segment-md-')),
    'segment.md'
  );
  await writeFile(
    outsideMetadata,
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: '不安全 metadata', kind: 'audio' },
      content: '# 不安全 metadata\n\n## Transcript\n\n',
    })
  );
  await rm(path.join(recordingDirectory, 'segment.md'));
  await symlink(outsideMetadata, path.join(recordingDirectory, 'segment.md'));

  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });

  assert.equal(deleted.ok, false);
  if (!deleted.ok) {
    assert.equal(deleted.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
    assert.equal(deleted.error.dataRetention, 'previous-file-preserved');
  }
  assert.equal((await lstat(path.join(recordingDirectory, 'segment.md'))).isSymbolicLink(), true);
  await assert.rejects(stat(path.join(rootPath, '.reo', 'trash', 'segments', segmentId)));
});

test('delete Segment rejects renamed symlink candidates without falling back to the default directory', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_delete_renamed_symlink';
  const segmentId = 'seg_delete_renamed_symlink';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '不安全片段外部改名',
  });
  const segmentsDirectory = path.join(rootPath, 'memories', memoryId, 'segments');
  const outsideDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-segment-renamed-outside-'));
  const renamedCandidate = `${segmentId}--Finder segment title`;
  const renamedCandidatePath = path.join(segmentsDirectory, renamedCandidate);
  await mkdir(segmentsDirectory, { recursive: true });
  await symlink(outsideDirectory, renamedCandidatePath);

  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });

  assert.equal(deleted.ok, false);
  if (!deleted.ok) {
    assert.equal(deleted.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  assert.equal((await lstat(renamedCandidatePath)).isSymbolicLink(), true);
  await stat(outsideDirectory);
  await assert.rejects(stat(path.join(rootPath, '.reo', 'trash', 'segments', renamedCandidate)));
  await assert.rejects(stat(path.join(rootPath, '.reo', 'trash', 'segments', segmentId)));
});

test('delete Segment rejects renamed non-directory candidates without falling back to the default directory', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_delete_renamed_file';
  const segmentId = 'seg_delete_renamed_file';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '不安全片段文件',
  });
  const segmentsDirectory = path.join(rootPath, 'memories', memoryId, 'segments');
  const renamedCandidate = `${segmentId}--Finder segment title`;
  const renamedCandidatePath = path.join(segmentsDirectory, renamedCandidate);
  await mkdir(segmentsDirectory, { recursive: true });
  await writeFile(renamedCandidatePath, 'not a segment directory');

  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });

  assert.equal(deleted.ok, false);
  if (!deleted.ok) {
    assert.equal(deleted.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  assert.equal((await lstat(renamedCandidatePath)).isFile(), true);
  await assert.rejects(stat(path.join(rootPath, '.reo', 'trash', 'segments', renamedCandidate)));
  await assert.rejects(stat(path.join(rootPath, '.reo', 'trash', 'segments', segmentId)));
});

test('restore Segment rejects renamed unsafe trash candidates without falling back to the default directory', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_restore_renamed_symlink';
  const segmentId = 'seg_restore_renamed_symlink';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '不安全恢复片段',
  });
  await mkdir(path.join(rootPath, 'memories', memoryId, 'segments'), { recursive: true });
  const trashDirectory = path.join(rootPath, '.reo', 'trash', 'segments');
  const outsideDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-segment-trash-outside-'));
  const renamedCandidate = `${segmentId}--Finder segment title`;
  const renamedCandidatePath = path.join(trashDirectory, renamedCandidate);
  await mkdir(trashDirectory, { recursive: true });
  await symlink(outsideDirectory, renamedCandidatePath);

  const restored = await restoreDeletedSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    restoreToken: segmentId,
  });

  assert.equal(restored.ok, false);
  if (!restored.ok) {
    assert.equal(restored.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  assert.equal((await lstat(renamedCandidatePath)).isSymbolicLink(), true);
  await stat(outsideDirectory);
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId)));
});

test('restore Segment rejects trash directory replacement after validating file truth', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_restore_replaced_source';
  const segmentId = 'seg_restore_replaced_source';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '恢复替换源',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '原始待恢复片段',
  });
  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });
  assert.equal(deleted.ok, true);
  const activeDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  const trashDirectory = path.join(rootPath, '.reo', 'trash', 'segments', segmentId);
  const preservedOriginalTrashDirectory = path.join(
    rootPath,
    '.reo',
    'trash',
    'segments',
    `${segmentId}--preserved-original`
  );
  setBeforeFileSpaceNodeMoveForTest(async () => {
    setBeforeFileSpaceNodeMoveForTest(null);
    await rename(trashDirectory, preservedOriginalTrashDirectory);
    await writeFinalizedAudioSegmentForTest(rootPath, {
      memoryId,
      segmentId,
      title: '替换待恢复片段',
    });
    await rename(activeDirectory, trashDirectory);
  });

  try {
    const restored = await restoreDeletedSegmentFromFileTruth({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      restoreToken: segmentId,
    });

    assert.equal(restored.ok, false);
    if (!restored.ok) {
      assert.equal(restored.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
      assert.equal(restored.error.dataRetention, 'previous-file-preserved');
    }
  } finally {
    setBeforeFileSpaceNodeMoveForTest(null);
  }

  await stat(path.join(trashDirectory, 'audio.webm'));
  await stat(path.join(preservedOriginalTrashDirectory, 'audio.webm'));
  await assert.rejects(stat(activeDirectory));
});

test('delete Segment rolls back the directory move when index refresh fails', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_delete_index_rollback';
  const segmentId = 'seg_delete_index_rollback';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '删除索引失败恢复',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '索引失败片段',
  });
  await rebuildMemoryIndex(rootPath);
  const previousIndex = await readWorkspaceIndex(rootPath);
  setBeforeMemoryIndexEntryReadForTest(() => {
    setBeforeMemoryIndexEntryReadForTest(null);
    throw new Error('index refresh failed');
  });

  try {
    const deleted = await deleteSegmentFromFileTruth({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      segmentId,
    });

    assert.equal(deleted.ok, false);
    if (!deleted.ok) {
      assert.equal(deleted.error.code, 'ERR_SEGMENT_DELETE_FAILED');
      assert.equal(deleted.error.dataRetention, 'previous-file-preserved');
    }
  } finally {
    setBeforeMemoryIndexEntryReadForTest(null);
  }

  await stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId, 'audio.webm'));
  await assert.rejects(stat(path.join(rootPath, '.reo', 'trash', 'segments', segmentId)));
  assert.deepEqual(
    await readProjectedSegmentIdsFromMemoryDirectoryForTest(
      path.join(rootPath, 'memories', memoryId)
    ),
    [segmentId]
  );
  assert.deepEqual(await readWorkspaceIndex(rootPath), previousIndex);
});

test('delete Segment does not move a replacement trash directory during rollback', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_delete_rollback_replaced_source';
  const segmentId = 'seg_delete_rollback_replaced_source';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '删除回滚替换源',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '删除回滚原始片段',
  });
  await rebuildMemoryIndex(rootPath);
  const activeDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  const trashDirectory = path.join(rootPath, '.reo', 'trash', 'segments', segmentId);
  const preservedOriginalTrashDirectory = path.join(
    rootPath,
    '.reo',
    'trash',
    'segments',
    `${segmentId}--preserved-original`
  );
  setBeforeMemoryIndexEntryReadForTest(() => {
    setBeforeMemoryIndexEntryReadForTest(null);
    throw new Error('index refresh failed');
  });
  let moveAttempt = 0;
  setBeforeFileSpaceNodeMoveForTest(async () => {
    moveAttempt += 1;
    if (moveAttempt !== 2) {
      return;
    }
    setBeforeFileSpaceNodeMoveForTest(null);
    await rename(trashDirectory, preservedOriginalTrashDirectory);
    await writeFinalizedAudioSegmentForTest(rootPath, {
      memoryId,
      segmentId,
      title: '删除回滚替换片段',
    });
    await rename(activeDirectory, trashDirectory);
  });

  try {
    const deleted = await deleteSegmentFromFileTruth({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      segmentId,
    });

    assert.equal(deleted.ok, false);
    if (!deleted.ok) {
      assert.equal(deleted.error.code, 'ERR_SEGMENT_DELETE_FAILED');
      assert.equal(deleted.error.dataRetention, 'file-written-index-stale');
    }
  } finally {
    setBeforeMemoryIndexEntryReadForTest(null);
    setBeforeFileSpaceNodeMoveForTest(null);
  }

  await stat(path.join(trashDirectory, 'audio.webm'));
  await stat(path.join(preservedOriginalTrashDirectory, 'audio.webm'));
  await assert.rejects(stat(activeDirectory));
});

test('restore Segment rolls back to trash and preserves the active mirror when index refresh fails', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_restore_index_rollback';
  const segmentId = 'seg_restore_index_rollback';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '恢复索引失败',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '恢复失败片段',
  });
  await rebuildMemoryIndex(rootPath);
  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });
  assert.equal(deleted.ok, true);
  const previousIndex = await readWorkspaceIndex(rootPath);
  setBeforeMemoryIndexEntryReadForTest(() => {
    setBeforeMemoryIndexEntryReadForTest(null);
    throw new Error('index refresh failed');
  });

  try {
    const restored = await restoreDeletedSegmentFromFileTruth({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      restoreToken: segmentId,
    });

    assert.equal(restored.ok, false);
    if (!restored.ok) {
      assert.equal(restored.error.code, 'ERR_SEGMENT_RESTORE_FAILED');
      assert.equal(restored.error.dataRetention, 'previous-file-preserved');
    }
  } finally {
    setBeforeMemoryIndexEntryReadForTest(null);
  }

  await stat(path.join(rootPath, '.reo', 'trash', 'segments', segmentId, 'audio.webm'));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId)));
  assert.deepEqual(
    await readProjectedSegmentIdsFromMemoryDirectoryForTest(
      path.join(rootPath, 'memories', memoryId)
    ),
    []
  );
  assert.deepEqual(await readWorkspaceIndex(rootPath), previousIndex);
});

test('restore Segment does not move a replacement active directory during rollback', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_restore_rollback_replaced_source';
  const segmentId = 'seg_restore_rollback_replaced_source';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '恢复回滚替换源',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '恢复回滚原始片段',
  });
  await rebuildMemoryIndex(rootPath);
  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });
  assert.equal(deleted.ok, true);
  const activeDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  const trashDirectory = path.join(rootPath, '.reo', 'trash', 'segments', segmentId);
  const preservedOriginalActiveDirectory = path.join(
    rootPath,
    'memories',
    memoryId,
    'segments',
    `${segmentId}--preserved-original`
  );
  setBeforeMemoryIndexEntryReadForTest(() => {
    setBeforeMemoryIndexEntryReadForTest(null);
    throw new Error('index refresh failed');
  });
  let moveAttempt = 0;
  setBeforeFileSpaceNodeMoveForTest(async () => {
    moveAttempt += 1;
    if (moveAttempt !== 2) {
      return;
    }
    setBeforeFileSpaceNodeMoveForTest(null);
    await rename(activeDirectory, preservedOriginalActiveDirectory);
    await writeFinalizedAudioSegmentForTest(rootPath, {
      memoryId,
      segmentId,
      title: '恢复回滚替换片段',
    });
  });

  try {
    const restored = await restoreDeletedSegmentFromFileTruth({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      restoreToken: segmentId,
    });

    assert.equal(restored.ok, false);
    if (!restored.ok) {
      assert.equal(restored.error.code, 'ERR_SEGMENT_RESTORE_FAILED');
      assert.equal(restored.error.dataRetention, 'file-written-index-stale');
    }
  } finally {
    setBeforeMemoryIndexEntryReadForTest(null);
    setBeforeFileSpaceNodeMoveForTest(null);
  }

  await stat(path.join(activeDirectory, 'audio.webm'));
  await stat(path.join(preservedOriginalActiveDirectory, 'audio.webm'));
  await assert.rejects(stat(trashDirectory));
});

test('delete Segment does not rollback after index failure if the workspace lock is lost', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_delete_index_then_lock_lost';
  const segmentId = 'seg_delete_index_then_lock_lost';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '删除索引失败后锁失效',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '索引失败锁失效片段',
  });
  await rebuildMemoryIndex(rootPath);
  const activeDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  const trashDirectory = path.join(rootPath, '.reo', 'trash', 'segments', segmentId);
  let usable = true;
  setBeforeMemoryIndexEntryReadForTest(() => {
    setBeforeMemoryIndexEntryReadForTest(null);
    usable = false;
    throw new Error('index refresh failed');
  });

  try {
    const deleted = await deleteSegmentFromFileTruth({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      segmentId,
      assertWorkspaceUsable: () => (usable ? { ok: true } : workspaceLockLost()),
    });

    assert.equal(deleted.ok, false);
    if (!deleted.ok) {
      assert.equal(deleted.error.code, 'ERR_SEGMENT_DELETE_FAILED');
      assert.equal(deleted.error.dataRetention, 'file-written-index-stale');
    }
  } finally {
    setBeforeMemoryIndexEntryReadForTest(null);
  }

  await stat(path.join(trashDirectory, 'audio.webm'));
  await assert.rejects(stat(activeDirectory));
});

test('restore Segment does not rollback after index failure if the workspace lock is lost', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_restore_index_then_lock_lost';
  const segmentId = 'seg_restore_index_then_lock_lost';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '恢复索引失败后锁失效',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '恢复索引失败锁失效片段',
  });
  await rebuildMemoryIndex(rootPath);
  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });
  assert.equal(deleted.ok, true);
  const activeDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  const trashDirectory = path.join(rootPath, '.reo', 'trash', 'segments', segmentId);
  let usable = true;
  setBeforeMemoryIndexEntryReadForTest(() => {
    setBeforeMemoryIndexEntryReadForTest(null);
    usable = false;
    throw new Error('index refresh failed');
  });

  try {
    const restored = await restoreDeletedSegmentFromFileTruth({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      restoreToken: segmentId,
      assertWorkspaceUsable: () => (usable ? { ok: true } : workspaceLockLost()),
    });

    assert.equal(restored.ok, false);
    if (!restored.ok) {
      assert.equal(restored.error.code, 'ERR_SEGMENT_RESTORE_FAILED');
      assert.equal(restored.error.dataRetention, 'file-written-index-stale');
    }
  } finally {
    setBeforeMemoryIndexEntryReadForTest(null);
  }

  await stat(path.join(activeDirectory, 'audio.webm'));
  await assert.rejects(stat(trashDirectory));
});

test('delete Segment refreshes file-truth index from one file-truth scan', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_delete_single_scan';
  const segmentId = 'seg_delete_single_scan';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '删除单次扫描',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '删除单次扫描片段',
  });
  await rebuildMemoryIndex(rootPath);
  let scanCount = 0;
  setBeforeSegmentFileTruthListForTest(() => {
    scanCount += 1;
  });

  try {
    const deleted = await deleteSegmentFromFileTruth({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      segmentId,
    });

    assert.equal(deleted.ok, true);
    assert.equal(scanCount, 1);
  } finally {
    setBeforeSegmentFileTruthListForTest(null);
  }
});

test('restore Segment refreshes file-truth index from one file-truth scan', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_restore_single_scan';
  const segmentId = 'seg_restore_single_scan';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '恢复单次扫描',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '恢复单次扫描片段',
  });
  await rebuildMemoryIndex(rootPath);
  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });
  assert.equal(deleted.ok, true);
  let activeCandidateLookupCount = 0;
  let scanCount = 0;
  setBeforeSegmentDirectoryCandidateScanForTest(({ parentDirectory }) => {
    if (parentDirectory.endsWith(path.join('memories', memoryId, 'segments'))) {
      activeCandidateLookupCount += 1;
    }
  });
  setBeforeSegmentFileTruthListForTest(() => {
    scanCount += 1;
  });

  try {
    const restored = await restoreDeletedSegmentFromFileTruth({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      restoreToken: segmentId,
    });

    assert.equal(restored.ok, true);
    assert.equal(activeCandidateLookupCount, 0);
    assert.equal(scanCount, 1);
  } finally {
    setBeforeSegmentDirectoryCandidateScanForTest(null);
    setBeforeSegmentFileTruthListForTest(null);
  }
});

test('restore Segment rolls back when the active tree already has a renamed duplicate id', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_restore_active_duplicate';
  const segmentId = 'seg_restore_active_duplicate';
  const renamedActiveDirectory = `${segmentId}--active duplicate`;
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '恢复 active 重复',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '待恢复原始片段',
  });
  await rebuildMemoryIndex(rootPath);
  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });
  assert.equal(deleted.ok, true);
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    directoryName: renamedActiveDirectory,
    title: '已存在 active 片段',
    audioBytes: [9, 9, 9],
  });
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '恢复 active 重复',
  });
  await rebuildMemoryIndex(rootPath);

  const restored = await restoreDeletedSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    restoreToken: segmentId,
  });

  assert.equal(restored.ok, false);
  if (!restored.ok) {
    assert.equal(restored.error.code, 'ERR_SEGMENT_RESTORE_FAILED');
    assert.equal(restored.error.dataRetention, 'previous-file-preserved');
  }
  await stat(path.join(rootPath, '.reo', 'trash', 'segments', segmentId, 'audio.webm'));
  await stat(
    path.join(rootPath, 'memories', memoryId, 'segments', renamedActiveDirectory, 'audio.webm')
  );
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId)));
});

test('delete Segment stops before moving files when the workspace lock is lost', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_delete_lock_lost';
  const segmentId = 'seg_delete_lock_lost';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '删除锁失效',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '锁失效片段',
  });

  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    assertWorkspaceUsable: () => workspaceLockLost(),
  });

  assert.equal(deleted.ok, false);
  if (!deleted.ok) {
    assert.equal(deleted.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId, 'audio.webm'));
  await assert.rejects(stat(path.join(rootPath, '.reo', 'trash', 'segments', segmentId)));
});

test('delete Segment reports stale file truth when the workspace lock is lost after moving files', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_delete_lock_lost_after_move';
  const segmentId = 'seg_delete_lock_lost_after_move';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '删除移动后锁失效',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '移动后锁失效片段',
  });
  await rebuildMemoryIndex(rootPath);
  const activeSegmentDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  const trashedSegmentDirectory = path.join(rootPath, '.reo', 'trash', 'segments', segmentId);

  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    assertWorkspaceUsable: () =>
      !existsSync(activeSegmentDirectory) && existsSync(trashedSegmentDirectory)
        ? workspaceLockLost()
        : { ok: true },
  });

  assert.equal(deleted.ok, false);
  if (!deleted.ok) {
    assert.equal(deleted.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    assert.equal(deleted.error.dataRetention, 'file-written-index-stale');
  }
  await stat(path.join(rootPath, '.reo', 'trash', 'segments', segmentId, 'audio.webm'));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId)));
});

test('restore Segment stops before moving files when the workspace lock is lost', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_restore_lock_lost';
  const segmentId = 'seg_restore_lock_lost';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '恢复锁失效',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '锁失效恢复片段',
  });
  const deleted = await deleteSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });
  assert.equal(deleted.ok, true);

  const restored = await restoreDeletedSegmentFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    restoreToken: segmentId,
    assertWorkspaceUsable: () => workspaceLockLost(),
  });

  assert.equal(restored.ok, false);
  if (!restored.ok) {
    assert.equal(restored.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await stat(path.join(rootPath, '.reo', 'trash', 'segments', segmentId, 'audio.webm'));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId)));
});

test('reads segment markdown as the segment title source of truth', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_external_segment_title';
  const segmentId = 'seg_20260506_external_title';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '外部改名',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音1',
  });
  await rename(
    path.join(rootPath, 'memories', memoryId, 'segments', segmentId),
    path.join(rootPath, 'memories', memoryId, 'segments', `${segmentId}--晚间散步`)
  );

  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
  });

  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.value.segments.length, 1);
    assert.equal(detail.value.segments[0]?.segmentId, segmentId);
    assert.equal(detail.value.segments[0]?.title, '录音1');
  }
});

test('finalized segment projection exposes optional primary content title from segment markdown', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_content_title';
  const audioSegmentId = 'seg_20260520_audio_content_title';
  const noteSegmentId = 'seg_20260520_note_content_title';
  const noteBody = '# 笔记片段\n\nbody\n';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '内容标题',
  });
  const audioDirectory = await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId: audioSegmentId,
    title: '录音片段',
  });
  await writeFile(
    path.join(audioDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: '录音片段', content_title: '访谈转录', kind: 'audio' },
      content: '# 录音片段\n\n## Transcript\n\nhello',
    })
  );
  const noteDirectory = await writeFinalizedNoteSegmentForTest(rootPath, {
    memoryId,
    segmentId: noteSegmentId,
    title: '笔记片段',
    body: noteBody,
    finalizedAt: '2026-05-06T13:10:00.000Z',
  });
  await writeFile(
    path.join(noteDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: '笔记片段', content_title: '整理正文', kind: 'note' },
      content: noteBody,
    })
  );

  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
  });

  assert.equal(detail.ok, true);
  if (detail.ok) {
    const audioSegment = detail.value.segments.find(
      (segment) => segment.segmentId === audioSegmentId
    );
    const noteSegment = detail.value.segments.find(
      (segment) => segment.segmentId === noteSegmentId
    );
    assert.ok(audioSegment);
    assert.ok(noteSegment);
    assert.equal(audioSegment?.contentTitle, '访谈转录');
    assert.equal(noteSegment?.contentTitle, '整理正文');
  }
});

test('finalized segment projection exposes derived lastTranscriptionAttempt', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_transcription_attempts';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '转写状态',
  });
  const attempts = ['failed', 'success', undefined] as const satisfies readonly (
    | LastTranscriptionAttempt
    | undefined
  )[];

  for (const [index, attempt] of attempts.entries()) {
    const segmentId = `seg_20260516_transcription_${index}`;
    await writeFinalizedAudioSegmentForTest(rootPath, {
      memoryId,
      segmentId,
      title: '录音状态',
      lastTranscriptionAttempt: attempt,
    });

    const projection = await readFinalizedSegmentProjection({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      segmentId,
    });

    assert.equal(projection.type, 'audio');
    assert.equal(projection.lastTranscriptionAttempt, attempt ?? 'never');
  }
});

test('finalized segment projection treats HTML comment-only transcript as empty without resetting attempt', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_transcript_comment_placeholder';
  const segmentId = 'seg_20260516_transcript_comment_placeholder';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '清空转写',
  });
  const segmentDirectory = await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '已清空转写',
    lastTranscriptionAttempt: 'success',
  });
  await writeFile(
    path.join(segmentDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: '已清空转写', kind: 'audio' },
      content: '# 已清空转写\n\n## Transcript\n\n<!--\n## cleared externally\n-->',
    })
  );

  const projection = await readFinalizedSegmentProjection({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });

  assert.equal(projection.type, 'audio');
  assert.equal(projection.lastTranscriptionAttempt, 'success');
  assert.deepEqual(projection.transcript, { exists: false });
});

test('finalized segment projection keeps success without transcript heading as exists=false', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_segment_success_without_transcript';
  const segmentId = 'seg_20260516_success_without_transcript';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '无转写标题',
  });
  const segmentDirectory = await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '成功但无转写标题',
    lastTranscriptionAttempt: 'success',
  });
  await writeFile(
    path.join(segmentDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: '成功但无转写标题', kind: 'audio' },
      content: '# 成功但无转写标题\n\n这段正文不是转写区。',
    })
  );

  const projection = await readFinalizedSegmentProjection({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });

  assert.equal(projection.type, 'audio');
  assert.equal(projection.lastTranscriptionAttempt, 'success');
  assert.deepEqual(projection.transcript, { exists: false });
});

test('finalized supplement projection exposes lastTranscriptionAttempt from manifest', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_supplement_transcription_status';
  const segmentId = 'seg_20260516_supplement_status_parent';
  const failedSupplementId = 'sup_20260516_supplement_failed';
  const successSupplementId = 'sup_20260516_supplement_success';
  const neverSupplementId = 'sup_20260516_supplement_never';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '补充转写状态',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '父录音',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId: failedSupplementId,
    title: '失败补充',
    finalizedAt: '2026-05-06T13:10:00.000Z',
    lastTranscriptionAttempt: 'failed',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId: successSupplementId,
    title: '成功补充',
    finalizedAt: '2026-05-06T13:11:00.000Z',
    lastTranscriptionAttempt: 'success',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId: neverSupplementId,
    title: '未转写补充',
    finalizedAt: '2026-05-06T13:12:00.000Z',
  });

  const projection = await readFinalizedSegmentProjection({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
  });
  const attemptsBySupplementId = new Map(
    projection.supplements.map((supplement) => {
      assert.equal(supplement.type, 'audio');
      return [supplement.supplementId, supplement.lastTranscriptionAttempt];
    })
  );

  assert.equal(attemptsBySupplementId.get(failedSupplementId), 'failed');
  assert.equal(attemptsBySupplementId.get(successSupplementId), 'success');
  assert.equal(attemptsBySupplementId.get(neverSupplementId), 'never');
});

test('memory detail projects valid segment file-space nodes missing from the file-truth scan', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_detail_missing_segment_mirror';
  const segmentId = 'seg_20260512_detail_missing_mirror';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '文件真源详情',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音25',
    directoryName: `${segmentId}--录音25`,
    finalizedAt: '2026-05-12T16:27:09.824Z',
  });

  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
  });

  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.value.segmentCount, 1);
    assert.equal(detail.value.segments.length, 1);
    const segment = detail.value.segments[0];
    assert.ok(segment);
    assert.equal(segment.type, 'audio');
    assert.equal(segment.segmentId, segmentId);
    assert.equal(segment.title, '录音25');
    assert.equal(segment.lastTranscriptionAttempt, 'never');
  }
});

test('memory detail projects finalized note segments and note supplements from file truth', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_note_file_truth_projection';
  const segmentId = 'seg_20260519_note_file_truth';
  const supplementId = 'sup_20260519_note_file_truth';
  const segmentBody = '# 观察记录\n\n今天整理了 Note Foundation 的字段边界。\n';
  const supplementBody = '# 补充记录\n\n这条补充只包含 Markdown 正文。\n';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Note 文件真源',
  });
  await writeFinalizedNoteSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: 'Note Segment',
    body: segmentBody,
  });
  await writeFinalizedNoteSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId,
    title: 'Note Supplement',
    body: supplementBody,
    finalizedAt: '2026-05-06T13:10:00.000Z',
  });

  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
  });

  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.value.segmentCount, 1);
    assert.equal(detail.value.audioSegmentCount, 0);
    assert.equal(detail.value.noteSegmentCount, 1);
    assert.equal(detail.value.audioDurationMs, 0);
    assert.equal(detail.value.audioByteLength, 0);
    assert.equal(detail.value.hasAudioTranscript, false);
    assert.equal(detail.value.hasAnyNote, true);
    assert.equal(detail.value.supplementCount, 1);
    const segment = detail.value.segments[0];
    assert.ok(segment);
    assert.equal(segment.type, 'note');
    assert.equal(segment.segmentId, segmentId);
    assert.equal(segment.bodyByteLength, Buffer.byteLength(segmentBody, 'utf8'));
    assert.equal('durationMs' in segment, false);
    assert.equal('audioByteLength' in segment, false);
    assert.equal('transcript' in segment, false);
    const supplement = segment.supplements[0];
    assert.ok(supplement);
    assert.equal(supplement.type, 'note');
    assert.equal(supplement.supplementId, supplementId);
    assert.equal(supplement.bodyByteLength, Buffer.byteLength(supplementBody, 'utf8'));
    assert.equal('durationMs' in supplement, false);
    assert.equal('audioByteLength' in supplement, false);
    assert.equal('transcript' in supplement, false);
  }
});

test('memory detail projects persisted Segment content tab order from segment manifest', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_content_tab_order';
  const segmentId = 'seg_content_tab_order_parent';
  const firstSupplementId = 'sup_content_tab_order_first';
  const secondSupplementId = 'sup_content_tab_order_second';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Tab order memory',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: 'Ordered segment',
    contentTabOrder: [
      `supplement:${secondSupplementId}`,
      'segment',
      'supplement:sup_missing_stale',
      `supplement:${firstSupplementId}`,
    ],
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId: firstSupplementId,
    title: 'First supplement',
    finalizedAt: '2026-05-06T13:11:00.000Z',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId: secondSupplementId,
    title: 'Second supplement',
    finalizedAt: '2026-05-06T13:12:00.000Z',
  });

  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
  });

  assert.equal(detail.ok, true);
  if (!detail.ok) {
    return;
  }
  assert.deepEqual(
    (detail.value.segments[0] as { contentTabOrder?: readonly string[] } | undefined)
      ?.contentTabOrder,
    [`supplement:${secondSupplementId}`, 'segment', `supplement:${firstSupplementId}`]
  );
});

test('segment content tab order update writes the Segment manifest without changing activity time', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_content_tab_order_update';
  const segmentId = 'seg_content_tab_order_update_parent';
  const firstSupplementId = 'sup_content_tab_order_update_first';
  const secondSupplementId = 'sup_content_tab_order_update_second';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Tab order update memory',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: 'Ordered segment',
    finalizedAt: '2026-05-06T13:09:00.000Z',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId: firstSupplementId,
    title: 'First supplement',
    finalizedAt: '2026-05-06T13:11:00.000Z',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId: secondSupplementId,
    title: 'Second supplement',
    finalizedAt: '2026-05-06T13:12:00.000Z',
  });

  const updated = await updateSegmentContentTabOrderFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    contentTabOrder: [
      `supplement:${secondSupplementId}`,
      'segment',
      `supplement:${firstSupplementId}`,
    ],
  });

  assert.equal(updated.ok, true);
  if (!updated.ok) {
    return;
  }
  assert.deepEqual(updated.value.segment.contentTabOrder, [
    `supplement:${secondSupplementId}`,
    'segment',
    `supplement:${firstSupplementId}`,
  ]);
  assert.equal(updated.value.segment.updatedAt, '2026-05-06T13:12:00.000Z');
  const manifest = (await readJson(
    path.join(rootPath, '.reo', 'objects', 'segments', `${segmentId}.json`)
  )) as { readonly contentTabOrder?: readonly string[]; readonly updatedAt?: string };
  assert.deepEqual(manifest.contentTabOrder, [
    `supplement:${secondSupplementId}`,
    'segment',
    `supplement:${firstSupplementId}`,
  ]);
  assert.equal(manifest.updatedAt, '2026-05-06T13:09:00.000Z');
});

test('memory detail marks hasAnyNote for note supplements under audio segments', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_note_supplement_under_audio';
  const segmentId = 'seg_note_supplement_under_audio';
  const supplementId = 'sup_note_supplement_under_audio';
  const supplementBody = '# 音频补充笔记\n\n这条补充只包含 Markdown 正文。\n';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Audio with note supplement',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: 'Audio Segment',
  });
  await writeFinalizedNoteSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId,
    title: 'Note Supplement',
    body: supplementBody,
    finalizedAt: '2026-05-06T13:10:00.000Z',
  });

  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
  });

  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.value.segmentCount, 1);
    assert.equal(detail.value.audioSegmentCount, 1);
    assert.equal(detail.value.noteSegmentCount, 0);
    assert.equal(detail.value.hasAnyNote, true);
    const segment = detail.value.segments[0];
    assert.ok(segment);
    assert.equal(segment.type, 'audio');
    const supplement = segment.supplements[0];
    assert.ok(supplement);
    assert.equal(supplement.type, 'note');
    assert.equal(supplement.bodyByteLength, Buffer.byteLength(supplementBody, 'utf8'));
  }
});

test('workspace read model ignores unmanaged ordinary files including html and json', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_unmanaged_files';
  const segmentId = 'seg_unmanaged_files';
  const supplementId = 'sup_unmanaged_files';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '普通文件',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音1',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId,
    title: '补充录音1',
    finalizedAt: '2026-05-06T13:11:00.000Z',
  });
  const memoryDirectory = path.join(rootPath, 'memories', memoryId);
  const segmentDirectory = path.join(memoryDirectory, 'segments', segmentId);
  const supplementDirectory = path.join(segmentDirectory, 'supplements', supplementId);
  await writeFile(path.join(memoryDirectory, 'scratch.json'), '{"kind":"not-reo"}\n');
  await writeFile(path.join(memoryDirectory, 'extra-note.md'), '# Not a Reo object\n');
  await writeFile(path.join(segmentDirectory, 'context.html'), '<script>window.ran=true</script>');
  await writeFile(path.join(segmentDirectory, 'source.json'), '{"title":"ignored"}\n');
  await writeFile(path.join(supplementDirectory, 'reference.html'), '<h1>ordinary file</h1>');
  await writeFile(path.join(supplementDirectory, 'reference.json'), '{"title":"ignored"}\n');

  const summaries = await rebuildMemoryIndex(rootPath);
  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
  });

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.memoryId, memoryId);
  assert.equal(summaries[0]?.segmentCount, 1);
  assert.equal(summaries[0]?.supplementCount, 1);
  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.value.segments.length, 1);
    assert.equal(detail.value.segments[0]?.supplements.length, 1);
    assert.equal(detail.value.segments[0]?.supplements[0]?.supplementId, supplementId);
  }
});

test('supplement finalize uses segment file-space node truth when file-truth scan is missing parent', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_supplement_missing_segment_mirror';
  const segmentId = 'seg_20260512_supplement_missing_mirror';
  const supplementId = 'sup_20260512_supplement_missing_mirror';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '补充录音镜像修复',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音25',
    directoryName: `${segmentId}--录音25`,
    finalizedAt: '2026-05-12T16:27:09.824Z',
  });
  const draft = await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    createSupplementId: () => supplementId,
    now: () => '2026-05-12T16:28:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId,
    sequence: 0,
    chunk: new Uint8Array([4, 5, 6]),
  });

  const finalized = await appendAudioSupplementToSegment({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    supplementId,
    title: '补充录音1',
    durationMs: 1200,
    now: () => '2026-05-12T16:29:00.000Z',
  });

  assert.equal(finalized.ok, true);
  if (finalized.ok) {
    assert.equal(finalized.value.memory.segmentCount, 1);
    assert.equal(finalized.value.memory.supplementCount, 1);
    assert.equal(finalized.value.segment.segmentId, segmentId);
    assert.equal(finalized.value.segment.supplementCount, 1);
    assert.equal(finalized.value.supplement.supplementId, supplementId);
  }
  assert.deepEqual(
    await readProjectedSegmentIdsFromMemoryDirectoryForTest(
      path.join(rootPath, 'memories', memoryId)
    ),
    [segmentId]
  );
});

test('supplement finalize checks parent by direct file truth without pre-scanning all segment ids', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_supplement_direct_parent_check';
  const segmentId = 'seg_20260512_supplement_direct_parent_check';
  const supplementId = 'sup_20260512_direct_parent_check';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '补充录音直查父片段',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音25',
  });
  await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    createSupplementId: () => supplementId,
    now: () => '2026-05-12T16:28:00.000Z',
  });
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId,
    sequence: 0,
    chunk: new Uint8Array([4, 5, 6]),
  });
  let segmentFileTruthScanCount = 0;
  setBeforeSegmentFileTruthListForTest(() => {
    segmentFileTruthScanCount += 1;
  });

  try {
    const finalized = await appendAudioSupplementToSegment({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      segmentId,
      supplementId,
      title: '补充录音1',
      durationMs: 1200,
      now: () => '2026-05-12T16:29:00.000Z',
      rebuildIndex: async () => [
        {
          memoryId,
          title: '补充录音直查父片段',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-12T16:29:00.000Z',
          segmentCount: 1,
          audioSegmentCount: 1,
          noteSegmentCount: 0,
          audioDurationMs: 1200,
          audioByteLength: 3,
          hasAudioTranscript: false,
          hasAnyNote: false,
          supplementCount: 1,
        },
      ],
    });

    assert.equal(finalized.ok, true);
    assert.equal(segmentFileTruthScanCount, 0);
  } finally {
    setBeforeSegmentFileTruthListForTest(null);
  }
});

test('supplement finalize rejects duplicate supplement ids even when the existing folder was renamed', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_supplement_duplicate';
  const segmentId = 'seg_20260512_supplement_duplicate';
  const supplementId = 'sup_20260512_duplicate';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '补充录音重复',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音25',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId,
    title: '旧补充',
    directoryName: `${supplementId}--旧补充`,
    finalizedAt: '2026-05-12T16:27:09.824Z',
  });
  await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    createSupplementId: () => supplementId,
    now: () => '2026-05-12T16:28:00.000Z',
  });
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId,
    sequence: 0,
    chunk: new Uint8Array([7, 8, 9]),
  });

  const finalized = await appendAudioSupplementToSegment({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    supplementId,
    title: '新补充',
    durationMs: 1200,
    now: () => '2026-05-12T16:29:00.000Z',
  });

  assert.equal(finalized.ok, false);
  assert.equal(
    await readSupplementTitleForTest(
      path.join(
        rootPath,
        'memories',
        memoryId,
        'segments',
        segmentId,
        'supplements',
        `${supplementId}--旧补充`
      )
    ),
    '旧补充'
  );
});

test('supplement finalize rolls back exposed directory when manifest write cannot start', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_supplement_manifest_blocked';
  const segmentId = 'seg_20260518_supplement_manifest_blocked';
  const supplementId = 'sup_20260518_supplement_manifest_blocked';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '补充事务回滚',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '父录音',
  });
  await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    createSupplementId: () => supplementId,
    now: () => '2026-05-18T12:00:00.000Z',
  });
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await appendAudioSupplementToSegment({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    supplementId,
    title: '补充失败',
    durationMs: 1200,
    now: () => '2026-05-18T12:01:00.000Z',
    transactionHooks: {
      afterFinalRename: () => {
        throw new Error('manifest blocked');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await stat(path.join(rootPath, '.reo', 'drafts', 'supplements', supplementId));
  await assert.rejects(
    stat(
      path.join(
        rootPath,
        'memories',
        memoryId,
        'segments',
        segmentId,
        'supplements',
        `${supplementId}--补充失败`
      )
    )
  );
  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'objects', 'supplements', `${supplementId}.json`))
  );
  assert.deepEqual(await readWorkspaceIndex(rootPath), {
    schemaVersion: 1,
    memories: [
      {
        memoryId,
        title: '补充事务回滚',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:09:00.000Z',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        audioDurationMs: 1000,
        audioByteLength: 3,
        hasAudioTranscript: false,
        hasAnyNote: false,
        supplementCount: 0,
      },
    ],
  });
});

test('supplement finalize preserves marker after durable draft cleanup completes', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_supplement_cleanup_fsync_blocked';
  const segmentId = 'seg_20260518_supplement_cleanup_fsync_blocked';
  const supplementId = 'sup_20260518_supplement_cleanup_fsync_blocked';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '补充 marker 保留',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '父录音',
  });
  await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    createSupplementId: () => supplementId,
    now: () => '2026-05-18T12:02:00.000Z',
  });
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId,
    sequence: 0,
    chunk: new Uint8Array([4, 5, 6]),
  });

  const finalized = await appendAudioSupplementToSegment({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    supplementId,
    title: '补充已落盘',
    durationMs: 1200,
    now: () => '2026-05-18T12:03:00.000Z',
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
  await assert.rejects(stat(path.join(rootPath, '.reo', 'drafts', 'supplements', supplementId)));
  await stat(
    path.join(
      rootPath,
      'memories',
      memoryId,
      'segments',
      segmentId,
      'supplements',
      `${supplementId}--补充已落盘`,
      '.reo-finalize-transaction.json'
    )
  );
  await stat(path.join(rootPath, '.reo', 'objects', 'supplements', `${supplementId}.json`));
});

test('projects supplement updates to segment and memory ordering', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_projected_updates';
  const oldSegmentId = 'seg_20260506_old_with_supplement';
  const newSegmentId = 'seg_20260506_new_without_supplement';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: '投影更新时间',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId: oldSegmentId,
    title: '录音1',
    finalizedAt: '2026-05-06T13:09:00.000Z',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId: newSegmentId,
    title: '录音2',
    finalizedAt: '2026-05-06T13:20:00.000Z',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId: oldSegmentId,
    supplementId: 'sup_20260506_late_context',
    title: '补充录音1',
    finalizedAt: '2026-05-06T13:30:00.000Z',
  });

  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
  });

  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.value.updatedAt, '2026-05-06T13:30:00.000Z');
    assert.deepEqual(
      detail.value.segments.map((segment) => segment.segmentId),
      [oldSegmentId, newSegmentId]
    );
    assert.equal(detail.value.segments[0]?.updatedAt, '2026-05-06T13:30:00.000Z');
    assert.equal(detail.value.segments[0]?.supplements[0]?.updatedAt, '2026-05-06T13:30:00.000Z');
  }
});

test('rebuild index uses memory markdown as the title source of truth', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_markdown_title_truth';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Markdown title',
  });
  await rename(
    path.join(rootPath, 'memories', memoryId),
    path.join(rootPath, 'memories', `${memoryId}--Finder title`)
  );

  assert.deepEqual(await rebuildMemoryIndex(rootPath, { persist: false }), [
    {
      memoryId,
      title: 'Markdown title',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:08:00.000Z',
      segmentCount: 0,
      audioSegmentCount: 0,
      noteSegmentCount: 0,
      audioDurationMs: 0,
      audioByteLength: 0,
      hasAudioTranscript: false,
      hasAnyNote: false,
      supplementCount: 0,
    },
  ]);
});

test('rebuild index summarizes memories from the initial directory scan', async () => {
  const rootPath = await workspaceRoot();
  for (let index = 0; index < 3; index += 1) {
    const memoryId = `mem_rebuild_known_directory_${index}`;
    await writeMemoryForTest(rootPath, {
      memoryId,
      title: `Known directory ${index}`,
    });
    await writeFinalizedAudioSegmentForTest(rootPath, {
      memoryId,
      segmentId: `seg_rebuild_known_directory_${index}`,
      title: `Recording ${index}`,
    });
  }

  let memoryDirectoryScanCount = 0;
  setBeforeMemoryDirectoryCandidateScanForTest(() => {
    memoryDirectoryScanCount += 1;
  });

  try {
    const memories = await rebuildMemoryIndex(rootPath, { persist: false });

    assert.equal(memories.length, 3);
    assert.equal(memoryDirectoryScanCount, 0);
  } finally {
    setBeforeMemoryDirectoryCandidateScanForTest(null);
  }
});

test('delete and restore keep externally renamed memory directories addressable by metadata id', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_external_rename_delete';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Metadata title',
  });
  await rename(
    path.join(rootPath, 'memories', memoryId),
    path.join(rootPath, 'memories', `${memoryId}--Finder title`)
  );

  const deleted = await deleteMemoryFromFileTruth({ rootPath, memoryId });

  assert.equal(deleted.ok, true);
  await assert.rejects(stat(path.join(rootPath, 'memories', `${memoryId}--Finder title`)));
  await stat(path.join(rootPath, '.reo', 'trash', 'memories', `${memoryId}--Finder title`));

  const restored = await restoreDeletedMemoryFromFileTruth({
    rootPath,
    restoreToken: memoryId,
  });

  assert.equal(restored.ok, true);
  await stat(path.join(rootPath, 'memories', `${memoryId}--Finder title`, 'memory.md'));
  assert.deepEqual(await readWorkspaceIndex(rootPath), {
    schemaVersion: 1,
    memories: [
      {
        memoryId,
        title: 'Metadata title',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
        segmentCount: 0,
        audioSegmentCount: 0,
        noteSegmentCount: 0,
        audioDurationMs: 0,
        audioByteLength: 0,
        hasAudioTranscript: false,
        hasAnyNote: false,
        supplementCount: 0,
      },
    ],
  });
});

test('rebuild index rejects symlinked memory metadata leaf files', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_symlink_metadata';
  const memoryDirectory = path.join(rootPath, 'memories', memoryId);
  const outsideMetadata = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-memory-json-outside-')),
    'memory.md'
  );
  await mkdir(memoryDirectory);
  await mkdir(path.join(rootPath, '.reo', 'objects', 'memories'), { recursive: true });
  await writeFile(
    outsideMetadata,
    renderWorkspaceMarkdownObject({
      objectType: 'memory',
      data: { title: 'outside-title' },
      content: '# outside-title\n',
    })
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'memories', `${memoryId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'memory',
        memoryId,
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
      },
      null,
      2
    )}\n`
  );
  await symlink(outsideMetadata, path.join(memoryDirectory, 'memory.md'));

  const memories = await rebuildMemoryIndex(rootPath, { persist: false });

  assert.equal(
    memories.some((memory) => memory.memoryId === memoryId),
    false
  );
});

test('rebuild skips finalized audio segment metadata with invalid projected fields', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_invalid_projection',
    title: 'Invalid projection',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId: 'mem_invalid_projection',
    segmentId: 'seg_20260506_invalid_projection',
    title: 'Invalid projection',
    audioBytes: [1, 2],
  });
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'segments', 'seg_20260506_invalid_projection.json'),
    JSON.stringify({
      schemaVersion: 1,
      objectType: 'segment',
      workspaceId: 'ws_memory',
      memoryId: 'mem_invalid_projection',
      segmentId: 'seg_20260506_invalid_projection',
      kind: 'audio',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      durationMs: -1,
      nextSequence: 1,
      audioByteLength: 2,
    })
  );

  assert.deepEqual(await rebuildMemoryIndex(rootPath, { persist: false }), [
    {
      memoryId: 'mem_invalid_projection',
      title: 'Invalid projection',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:08:00.000Z',
      segmentCount: 0,
      audioSegmentCount: 0,
      noteSegmentCount: 0,
      audioDurationMs: 0,
      audioByteLength: 0,
      hasAudioTranscript: false,
      hasAnyNote: false,
      supplementCount: 0,
    },
  ]);
});

test('rebuild preserves the existing index when memories root changes before scan', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_rebuild_swap',
    title: 'Rebuild swap',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId: 'mem_rebuild_swap',
    segmentId: 'seg_rebuild_swap',
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
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_rebuild_persist_swap',
    title: 'Rebuild persist swap',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId: 'mem_rebuild_persist_swap',
    segmentId: 'seg_rebuild_persist_swap',
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
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_rebuild_after_read_swap',
    title: 'Rebuild after read swap',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId: 'mem_rebuild_after_read_swap',
    segmentId: 'seg_rebuild_after_read_swap',
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

test('rebuild index rejects symlinked segment metadata leaf files', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recording_metadata_symlink';
  const segmentId = 'seg_recording_metadata_symlink';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Recording metadata symlink',
  });
  const recordingDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  const outsideMetadata = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-recording-json-outside-')),
    'segment.json'
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
        segmentId,
        type: 'audio',
        status: 'finalized',
        title: 'outside-title',
        createdAt: '2026-05-06T13:08:00.000Z',
        finalizedAt: '2026-05-06T13:09:00.000Z',
        durationMs: 3000,
        nextSequence: 1,
        audioByteLength: 3,
        transcriptPath: 'transcript.md',
      },
      null,
      2
    )
  );
  await symlink(outsideMetadata, path.join(recordingDirectory, 'segment.json'));

  const memories = await rebuildMemoryIndex(rootPath, { persist: false });

  assert.equal(memories.find((memory) => memory.memoryId === memoryId)?.segmentCount, 0);
});

test('title update succeeds from file truth when index refresh fails', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_1',
    title: 'Original title',
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
  assert.deepEqual(
    await readMemoryFileTruthForTest(
      path.join(rootPath, 'memories', 'mem_1--Renamed despite stale index')
    ),
    {
      memoryId: 'mem_1',
      title: 'Renamed despite stale index',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:08:00.000Z',
    }
  );
});

test('standalone memory create writes Markdown semantics and Reo-only manifest', async () => {
  const rootPath = await workspaceRoot();

  const created = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_file_space_create',
    title: '灵感',
    now: () => '2026-05-12T13:10:00.000Z',
  });

  assert.equal(created.ok, true);
  assert.deepEqual(readdirSync(path.join(rootPath, 'memories')), ['mem_file_space_create--灵感']);
  const memoryDirectory = path.join(rootPath, 'memories', 'mem_file_space_create--灵感');
  await assert.rejects(stat(path.join(memoryDirectory, 'memory.json')));
  const memoryMarkdown = parseWorkspaceMarkdownObject({
    objectType: 'memory',
    markdown: await readFile(path.join(memoryDirectory, 'memory.md'), 'utf8'),
  });
  assert.deepEqual(memoryMarkdown.data, { title: '灵感' });
  assert.equal(memoryMarkdown.content, '# 灵感\n');
  assert.deepEqual(
    await readJson(
      path.join(rootPath, '.reo', 'objects', 'memories', 'mem_file_space_create.json')
    ),
    {
      schemaVersion: 1,
      objectType: 'memory',
      memoryId: 'mem_file_space_create',
      createdAt: '2026-05-12T13:10:00.000Z',
      updatedAt: '2026-05-12T13:10:00.000Z',
    }
  );
});

test('manifest lastTranscriptionAttempt accepts known segment and supplement states', async () => {
  const allowedAttempts = ['success', 'failed', 'never', undefined] as const;
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_manifest_attempts';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Manifest attempt',
  });

  for (const [index, lastTranscriptionAttempt] of allowedAttempts.entries()) {
    const segmentId = `seg_20260516_manifest_attempt_${index}`;
    const supplementId = `sup_20260516_manifest_attempt_${index}`;
    await writeFinalizedAudioSegmentForTest(rootPath, {
      memoryId,
      segmentId,
      title: 'Segment attempt',
      lastTranscriptionAttempt,
    });
    await writeFinalizedAudioSupplementForTest(rootPath, {
      memoryId,
      segmentId,
      supplementId,
      title: 'Supplement attempt',
      finalizedAt: '2026-05-16T18:10:00.000Z',
      lastTranscriptionAttempt,
    });

    const segment = await readFinalizedSegmentProjection({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      segmentId,
    });

    assert.equal(segment.segmentId, segmentId);
    assert.equal(segment.supplements.length, 1);
    assert.equal(segment.supplements[0]?.supplementId, supplementId);
  }
});

test('manifest lastTranscriptionAttempt rejects unknown segment and supplement states', async () => {
  const rejectedAttempts: readonly unknown[] = ['unknown', '', 1];
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_manifest_attempt_rejects';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Manifest attempt reject',
  });

  for (const [index, lastTranscriptionAttempt] of rejectedAttempts.entries()) {
    const invalidSegmentId = `seg_20260516_manifest_attempt_reject_${index}`;
    const validSegmentId = `seg_20260516_manifest_attempt_valid_${index}`;
    const supplementId = `sup_20260516_manifest_attempt_reject_${index}`;
    await writeFinalizedAudioSegmentForTest(rootPath, {
      memoryId,
      segmentId: invalidSegmentId,
      title: 'Segment attempt reject',
      lastTranscriptionAttempt,
    });
    await assert.rejects(
      readFinalizedSegmentProjection({
        rootPath,
        workspaceId: 'ws_memory',
        memoryId,
        segmentId: invalidSegmentId,
      })
    );

    await writeFinalizedAudioSegmentForTest(rootPath, {
      memoryId,
      segmentId: validSegmentId,
      title: 'Segment attempt with invalid supplement',
      lastTranscriptionAttempt: 'never',
    });
    await writeFinalizedAudioSupplementForTest(rootPath, {
      memoryId,
      segmentId: validSegmentId,
      supplementId,
      title: 'Supplement attempt reject',
      finalizedAt: '2026-05-16T18:10:00.000Z',
      lastTranscriptionAttempt,
    });
    const segment = await readFinalizedSegmentProjection({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      segmentId: validSegmentId,
    });

    assert.equal(segment.segmentId, validSegmentId);
    assert.deepEqual(segment.supplements, []);
  }
});

test('recording finalize creates a new memory as a file-space node when no memory exists', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => 'seg_20260512_new_memory_recording',
    now: () => '2026-05-12T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260512_new_memory_recording',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_new_recording_file_node',
    segmentId: 'seg_20260512_new_memory_recording',
    title: '录音1',
    durationMs: 1000,
    now: () => '2026-05-12T13:09:00.000Z',
  });

  assert.equal(finalized.ok, true);
  assert.deepEqual(readdirSync(path.join(rootPath, 'memories')), [
    'mem_new_recording_file_node--录音1',
  ]);
  await readFile(
    path.join(
      rootPath,
      'memories',
      'mem_new_recording_file_node--录音1',
      'segments',
      'seg_20260512_new_memory_recording--录音1',
      'audio.webm'
    )
  );
});

test('standalone memory create repairs index after rollback', async () => {
  const rootPath = await workspaceRoot();

  const created = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_create_repair_index',
    title: 'Create repair index',
    now: () => '2026-05-06T13:10:00.000Z',
    rebuildIndex: async (currentRootPath) => {
      await rebuildMemoryIndex(currentRootPath);
      throw new Error('post-index failure');
    },
  });

  assert.equal(created.ok, false);
  if (!created.ok) {
    assert.equal(created.error.dataRetention, 'none-written');
  }
  await assert.rejects(stat(path.join(rootPath, 'memories', 'mem_create_repair_index')));
  const index = (await readJson(path.join(rootPath, '.reo', 'index.json'))) as {
    memories: readonly { readonly memoryId: string }[];
  };
  assert.equal(
    index.memories.some((memory) => memory.memoryId === 'mem_create_repair_index'),
    false
  );
});

test('standalone memory create stops before directory creation when the handle is lost', async () => {
  const rootPath = await workspaceRoot();
  let checks = 0;

  const created = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_create_lock_lost_before_directory',
    title: 'Create lock lost',
    now: () => '2026-05-06T13:10:00.000Z',
    assertWorkspaceUsable: () => {
      checks += 1;
      return checks >= 2 ? workspaceLockLost() : { ok: true };
    },
  });

  assert.equal(created.ok, false);
  if (!created.ok) {
    assert.equal(created.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await assert.rejects(
    stat(path.join(rootPath, 'memories', 'mem_create_lock_lost_before_directory'))
  );
});

test('standalone memory create removes an empty directory when the handle is lost', async () => {
  const rootPath = await workspaceRoot();
  let checks = 0;

  const created = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_create_lock_lost_after_directory',
    title: 'Create lock lost after directory',
    now: () => '2026-05-06T13:10:00.000Z',
    assertWorkspaceUsable: () => {
      checks += 1;
      return checks >= 3 ? workspaceLockLost() : { ok: true };
    },
  });

  assert.equal(created.ok, false);
  if (!created.ok) {
    assert.equal(created.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await assert.rejects(
    stat(path.join(rootPath, 'memories', 'mem_create_lock_lost_after_directory'))
  );
});

test('standalone memory create keeps an existing memory directory unchanged', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_create_duplicate',
    title: 'Original memory',
  });

  const created = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_create_duplicate',
    title: 'Duplicate memory',
    now: () => '2026-05-06T13:10:00.000Z',
  });

  assert.equal(created.ok, false);
  assert.equal(
    (
      (await readMemoryFileTruthForTest(
        path.join(rootPath, 'memories', 'mem_create_duplicate')
      )) as {
        readonly title: string;
      }
    ).title,
    'Original memory'
  );
});

test('preserves the draft when memory finalize cannot rebuild the index', async () => {
  const rootPath = await workspaceRoot();
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => 'seg_20260506_000002',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_20260506_failed',
    segmentId: 'seg_20260506_000002',
    title: 'Will not finalize',
    durationMs: 10_000,
    now: () => '2026-05-06T13:09:00.000Z',
    rebuildIndex: async () => {
      throw new Error('index write failed');
    },
  });

  assert.equal(finalized.ok, false);
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_000002'));
  await assert.rejects(stat(path.join(rootPath, 'memories', 'mem_20260506_failed')));
});

test('recording append finalize can retry with the same memory id after marker write failure', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => 'seg_20260506_marker_retry',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_marker_retry',
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });

  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_marker_retry',
    title: 'Marker retry',
    now: '2026-05-06T13:09:00.000Z',
  });

  const failed = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    segmentId: 'seg_20260506_marker_retry',
    memoryId: 'mem_marker_retry',
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
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_marker_retry'));
  await assert.rejects(
    stat(
      path.join(rootPath, 'memories', 'mem_marker_retry', 'segments', 'seg_20260506_marker_retry')
    )
  );

  const retried = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    segmentId: 'seg_20260506_marker_retry',
    memoryId: 'mem_marker_retry',
    title: 'Marker retry',
    durationMs: 1000,
    now: () => '2026-05-06T13:10:00.000Z',
  });

  assert.equal(retried.ok, true);
  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_marker_retry'))
  );
  await stat(await findSegmentDirectoryById(rootPath, 'seg_20260506_marker_retry'));
});

test('finalize rejects invalid draft metadata before exposing durable segment truth', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_invalid_draft_metadata';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_invalid_draft_metadata',
    title: 'Invalid draft metadata',
    now: '2026-05-06T13:09:00.000Z',
  });

  const failed = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    segmentId,
    memoryId: 'mem_invalid_draft_metadata',
    title: 'Invalid draft metadata',
    durationMs: 1000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeDraftCopy: async () => {
        const draftMetadataPath = path.join(
          rootPath,
          '.reo',
          'drafts',
          'segments',
          segmentId,
          'segment.json'
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
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
  await assert.rejects(
    stat(
      path.join(
        rootPath,
        'memories',
        'mem_invalid_draft_metadata',
        'segments',
        segmentId,
        'segment.json'
      )
    )
  );
});

test('finalize keeps durable recording when the draft is already missing at cleanup', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_missing_draft_cleanup';
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_missing_draft_cleanup',
    title: 'Missing draft cleanup',
    now: '2026-05-06T13:09:00.000Z',
  });

  const finalized = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    segmentId,
    memoryId: 'mem_missing_draft_cleanup',
    title: 'Missing draft cleanup',
    durationMs: 1000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeDraftDirectoryRemove: async () => {
        await rm(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId), {
          recursive: true,
          force: true,
        });
      },
    },
  });

  assert.equal(finalized.ok, true);
  const segmentDirectory = await findSegmentDirectoryById(rootPath, segmentId);
  await stat(segmentDirectory);
  await assert.rejects(stat(path.join(segmentDirectory, '.reo-finalize-transaction.json')));
});

test('rolls back an existing memory append when index rebuild fails', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_existing',
    title: 'Existing memory',
  });
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => 'seg_20260506_000003',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);

  const appended = await appendAudioSegmentToMemory({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_existing',
    segmentId: 'seg_20260506_000003',
    title: 'Existing memory',
    durationMs: 20_000,
    now: () => '2026-05-06T13:11:00.000Z',
    rebuildIndex: async () => {
      throw new Error('index write failed');
    },
  });

  assert.equal(appended.ok, false);
  assert.deepEqual(
    await readMemoryFileTruthForTest(path.join(rootPath, 'memories', 'mem_existing')),
    {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:08:00.000Z',
    }
  );
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_000003'));
  await assert.rejects(
    stat(path.join(rootPath, 'memories', 'mem_existing', 'segments', 'seg_20260506_000003'))
  );
});

test('duplicate recording finalize cannot delete an existing durable recording', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_existing',
    title: 'Existing memory',
  });
  const durableRecordingDirectory = await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId: 'mem_existing',
    segmentId: 'seg_existing',
    title: 'Original',
    audioBytes: [8, 8, 8],
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => 'seg_existing',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_existing',
    sequence: 0,
    chunk: new Uint8Array([1]),
  });

  const appended = await appendAudioSegmentToMemory({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_existing',
    segmentId: 'seg_existing',
    title: 'Duplicate',
    durationMs: 2000,
    now: () => '2026-05-06T13:11:00.000Z',
  });

  assert.equal(appended.ok, false);
  assert.deepEqual(
    Array.from(await readFile(path.join(durableRecordingDirectory, 'audio.webm'))),
    [8, 8, 8]
  );
  assert.deepEqual(
    await readMemoryFileTruthForTest(path.join(rootPath, 'memories', 'mem_existing')),
    {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:08:00.000Z',
    }
  );
});

test('recording finalize rejects durable segment id collisions across all memories', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => 'seg_20260506_global_duplicate',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_global_duplicate',
    sequence: 0,
    chunk: new Uint8Array([1]),
  });
  assert.equal(
    (
      await createMemoryWithRecording({
        rootPath,
        workspaceId: 'ws_memory',
        memoryId: 'mem_global_duplicate_source',
        segmentId: 'seg_20260506_global_duplicate',
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
    createSegmentId: () => 'seg_20260506_global_duplicate',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_global_duplicate',
    sequence: 0,
    chunk: new Uint8Array([2]),
  });

  const duplicateCreate = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_global_duplicate_target',
    segmentId: 'seg_20260506_global_duplicate',
    title: 'Duplicate recording',
    durationMs: 1000,
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(duplicateCreate.ok, false);
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_global_duplicate'));
  await assert.rejects(
    stat(
      path.join(
        rootPath,
        'memories',
        'mem_global_duplicate_target',
        'segments',
        'seg_20260506_global_duplicate'
      )
    )
  );

  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_global_duplicate_existing_append',
    title: 'Existing target memory',
  });
  const duplicateAppend = await appendAudioSegmentToMemory({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_global_duplicate_existing_append',
    segmentId: 'seg_20260506_global_duplicate',
    title: 'Duplicate append',
    durationMs: 1000,
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.equal(duplicateAppend.ok, false);
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_global_duplicate'));
});

test('recording lookup rejects duplicate finalized id directories as invalid durable state', async () => {
  const rootPath = await workspaceRoot();
  for (const memoryId of ['mem_duplicate_lookup_a', 'mem_duplicate_lookup_b']) {
    await writeMemoryForTest(rootPath, {
      memoryId,
      title: memoryId,
    });
    await writeFinalizedAudioSegmentForTest(rootPath, {
      memoryId,
      segmentId: 'seg_20260506_duplicate_lookup',
      title: memoryId,
    });
  }

  await assert.rejects(
    findSegmentDirectoryById(rootPath, 'seg_20260506_duplicate_lookup'),
    /Invalid durable recording/
  );
});

test('recording lookup resolves finalized note segment directories', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_note_lookup';
  const segmentId = 'seg_note_lookup';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Note lookup memory',
  });
  await writeFinalizedNoteSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: 'Note lookup segment',
    body: 'Lookup body\n',
  });

  const segmentDirectory = await findSegmentDirectoryById(rootPath, segmentId);

  assert.equal(path.basename(segmentDirectory), segmentId);
});

test('recording lookup resolves segments from the initial memory directory scan', async () => {
  const rootPath = await workspaceRoot();
  for (let index = 0; index < 3; index += 1) {
    const memoryId = `mem_lookup_known_directory_${index}`;
    await writeMemoryForTest(rootPath, {
      memoryId,
      title: `Lookup memory ${index}`,
    });
    await writeFinalizedAudioSegmentForTest(rootPath, {
      memoryId,
      segmentId: `seg_lookup_known_directory_${index}`,
      title: `Lookup segment ${index}`,
    });
  }

  let memoryDirectoryScanCount = 0;
  setBeforeMemoryDirectoryCandidateScanForTest(() => {
    memoryDirectoryScanCount += 1;
  });

  try {
    const segmentDirectory = await findSegmentDirectoryById(
      rootPath,
      'seg_lookup_known_directory_2'
    );

    assert.equal(path.basename(segmentDirectory), 'seg_lookup_known_directory_2');
    assert.equal(memoryDirectoryScanCount, 0);
  } finally {
    setBeforeMemoryDirectoryCandidateScanForTest(null);
  }
});

test('create memory finalize cannot replace an existing memory directory', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_existing',
    title: 'Existing memory',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => 'seg_new_memory_collision',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_new_memory_collision',
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });

  const created = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_existing',
    segmentId: 'seg_new_memory_collision',
    title: 'Collision',
    durationMs: 2000,
    now: () => '2026-05-06T13:11:00.000Z',
  });

  assert.equal(created.ok, false);
  assert.deepEqual(
    await readMemoryFileTruthForTest(path.join(rootPath, 'memories', 'mem_existing')),
    {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:08:00.000Z',
    }
  );
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_new_memory_collision'));
  await assert.rejects(
    stat(path.join(rootPath, 'memories', 'mem_existing', 'segments', 'seg_new_memory_collision'))
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
  if (!updated.ok) {
    assert.equal(updated.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  await assert.rejects(readFile(path.join(outside, 'memory.md'), 'utf8'));
});

test('preserves a draft when the memory parent is swapped to a symlink before staging', async () => {
  const rootPath = await workspaceRoot();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-parent-outside-'));
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => 'seg_20260506_parent_symlink_swap',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_parent_symlink_swap',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_parent_symlink_swap',
    segmentId: 'seg_20260506_parent_symlink_swap',
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
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_parent_symlink_swap'));
  await assert.rejects(stat(path.join(outside, 'segments')));
});

test('finalize rejects memories root symlink swap before creating a memory directory', async () => {
  const rootPath = await workspaceRoot();
  const outsideMemories = await mkdtemp(path.join(os.tmpdir(), 'reo-memories-create-outside-'));
  const segmentId = 'seg_20260506_memories_create_swap';
  const memoryId = 'mem_memories_create_swap';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  let swapped = false;
  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
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
  await assert.rejects(stat(path.join(outsideMemories, memoryId, 'segments')));
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
});

test('finalize rejects memories root swap after resolving the memory mkdir target', async () => {
  const rootPath = await workspaceRoot();
  const outsideMemories = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-mkdir-outside-'));
  const segmentId = 'seg_20260506_memory_mkdir_swap';
  const memoryId = 'mem_memory_mkdir_swap';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
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
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
});

test('finalize rejects memory directory symlink swap before creating segments directory', async () => {
  const rootPath = await workspaceRoot();
  const outsideMemoryDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-memory-create-outside-')
  );
  const segmentId = 'seg_20260506_segments_create_swap';
  const memoryId = 'mem_segments_create_swap';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  let swapped = false;
  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Recordings create swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeSegmentsDirectoryCreate: async () => {
        swapped = true;
        const memoryDirectoryPath = path.join(rootPath, 'memories', memoryId);
        await rename(memoryDirectoryPath, `${memoryDirectoryPath}-preserved`);
        await symlink(outsideMemoryDirectory, memoryDirectoryPath, 'dir');
      },
    },
  });

  assert.equal(swapped, true);
  assert.equal(finalized.ok, false);
  await assert.rejects(stat(path.join(outsideMemoryDirectory, 'segments')));
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
});

test('finalize rejects memory directory swap after resolving the segments mkdir target', async () => {
  const rootPath = await workspaceRoot();
  const outsideMemoryDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-segments-mkdir-outside-')
  );
  const segmentId = 'seg_20260506_segments_mkdir_swap';
  const memoryId = 'mem_segments_mkdir_swap';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Recordings mkdir swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeSegmentsDirectoryMkdir: async () => {
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
  await assert.rejects(stat(path.join(outsideMemoryDirectory, 'segments')));
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
});

test('pre-expose cleanup does not delete outside staging when memory parent is swapped to a symlink', async () => {
  const rootPath = await workspaceRoot();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-cleanup-outside-'));
  const segmentId = 'seg_20260506_cleanup_symlink_swap';
  const memoryId = 'mem_cleanup_symlink_swap';
  const fixedNow = 1_778_109_900_000;
  const outsideStagingDirectory = path.join(
    outside,
    'segments',
    `.reo-finalizing-${segmentId}.${process.pid}.${fixedNow}`
  );
  const outsideSentinel = path.join(outsideStagingDirectory, 'sentinel.txt');
  await mkdir(outsideStagingDirectory, { recursive: true });
  await writeFile(outsideSentinel, 'outside user file\n');
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const originalDateNow = Date.now;
  Date.now = () => fixedNow;
  try {
    const finalized = await createMemoryWithRecording({
      rootPath,
      workspaceId: 'ws_memory',
      memoryId,
      segmentId,
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

  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
  assert.equal(await readFile(outsideSentinel, 'utf8'), 'outside user file\n');
});

test('finalize rejects draft directory symlink swap before copying source files', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_draft_source_swap';
  const memoryId = 'mem_draft_source_swap';
  const outsideDraftDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-source-outside-'));
  await writeFile(path.join(outsideDraftDirectory, 'audio.webm'), new Uint8Array([9, 9, 9, 9]));
  await writeFile(
    path.join(outsideDraftDirectory, 'segment.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      segmentId,
      type: 'audio',
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
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const draftDirectory = path.join(rootPath, '.reo', 'drafts', 'segments', segmentId);
  const preservedDraftDirectory = path.join(
    rootPath,
    '.reo',
    'drafts',
    'segments',
    `${segmentId}-preserved`
  );

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
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
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId)));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.md')));
});

test('finalize rejects draft segments ancestor symlink swap before copying source files', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_draft_ancestor_swap';
  const memoryId = 'mem_draft_ancestor_swap';
  const outsideRecordingsRoot = await mkdtemp(
    path.join(os.tmpdir(), 'reo-draft-ancestor-outside-')
  );
  const outsideDraftDirectory = path.join(outsideRecordingsRoot, segmentId);
  await mkdir(outsideDraftDirectory);
  await writeFile(path.join(outsideDraftDirectory, 'audio.webm'), new Uint8Array([9, 9, 9, 9]));
  await writeFile(
    path.join(outsideDraftDirectory, 'segment.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      segmentId,
      type: 'audio',
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
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const segmentsRoot = path.join(rootPath, '.reo', 'drafts', 'segments');
  const preservedRecordingsRoot = path.join(rootPath, '.reo', 'drafts', 'segments-preserved');

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Draft ancestor swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterMarkerWrite: async () => {
        await rename(segmentsRoot, preservedRecordingsRoot);
        await symlink(outsideRecordingsRoot, segmentsRoot, 'dir');
      },
      beforeDraftCleanup: async () => {
        await rm(segmentsRoot);
        await rename(preservedRecordingsRoot, segmentsRoot);
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await stat(path.join(segmentsRoot, segmentId));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId)));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.md')));
});

test('finalize rejects draft segments ancestor symlink swap after draft validation before copy', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_draft_post_validate_swap';
  const memoryId = 'mem_draft_post_validate_swap';
  const outsideRecordingsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-post-outside-'));
  const outsideDraftDirectory = path.join(outsideRecordingsRoot, segmentId);
  await mkdir(outsideDraftDirectory);
  await writeFile(path.join(outsideDraftDirectory, 'audio.webm'), new Uint8Array([9, 9, 9]));
  await writeFile(
    path.join(outsideDraftDirectory, 'segment.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      segmentId,
      type: 'audio',
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
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const segmentsRoot = path.join(rootPath, '.reo', 'drafts', 'segments');
  const preservedRecordingsRoot = path.join(rootPath, '.reo', 'drafts', 'segments-preserved');
  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Draft post validation swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeDraftCopy: async () => {
        await rename(segmentsRoot, preservedRecordingsRoot);
        await symlink(outsideRecordingsRoot, segmentsRoot, 'dir');
      },
      beforeDraftCleanup: async () => {
        await rm(segmentsRoot);
        await rename(preservedRecordingsRoot, segmentsRoot);
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  if (finalized.ok) {
    const copiedAudio = await readFile(
      path.join(rootPath, 'memories', memoryId, 'segments', segmentId, 'audio.webm')
    );
    assert.notDeepEqual([...copiedAudio], [9, 9, 9]);
  }
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId)));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.md')));
});

test('finalize rejects segments parent symlink swap before exposing staging', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_expose_parent_swap';
  const memoryId = 'mem_expose_parent_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-expose-parent-outside-')
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Expose parent swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeExpose: async () => {
        const segmentsDirectory = path.join(rootPath, 'memories', memoryId, 'segments');
        const stagingName = (await readdir(segmentsDirectory)).find((entry) =>
          entry.startsWith('.reo-finalizing-')
        );
        assert.ok(stagingName);
        const outsideStagingDirectory = path.join(outsideRecordingsDirectory, stagingName);
        await mkdir(outsideStagingDirectory);
        await writeFile(path.join(outsideStagingDirectory, 'audio.webm'), new Uint8Array([9, 9]));
        await writeFile(
          path.join(outsideStagingDirectory, 'segment.json'),
          JSON.stringify({
            schemaVersion: 1,
            workspaceId: 'ws_memory',
            memoryId,
            segmentId,
            type: 'audio',
            status: 'finalized',
            title: 'Outside',
            createdAt: '2026-05-06T13:08:00.000Z',
            finalizedAt: '2026-05-06T13:09:00.000Z',
            durationMs: 3000,
            nextSequence: 1,
            audioByteLength: 2,
            transcriptPath: 'transcript.md',
          })
        );
        await writeFile(path.join(outsideStagingDirectory, 'transcript.md'), '');
        await writeFile(path.join(outsideStagingDirectory, '.reo-finalize-transaction.json'), '{}');
        await rename(
          segmentsDirectory,
          path.join(rootPath, 'memories', memoryId, 'segments-preserved')
        );
        await symlink(outsideRecordingsDirectory, segmentsDirectory, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await assert.rejects(stat(path.join(outsideRecordingsDirectory, segmentId, 'audio.webm')));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.md')));
});

test('finalize rejects segments parent symlink swap before creating staging', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_staging_parent_swap';
  const memoryId = 'mem_staging_parent_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-staging-parent-outside-')
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Staging parent swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeStagingDirectoryCreate: async () => {
        const segmentsDirectory = path.join(rootPath, 'memories', memoryId, 'segments');
        await rename(
          segmentsDirectory,
          path.join(rootPath, 'memories', memoryId, 'segments-preserved')
        );
        await symlink(outsideRecordingsDirectory, segmentsDirectory, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  assert.deepEqual(await readdir(outsideRecordingsDirectory), []);
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.md')));
});

test('finalize rejects segments parent symlink swap after creating staging', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_staging_created_parent_swap';
  const memoryId = 'mem_staging_created_parent_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-staging-created-outside-')
  );
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Staging created parent swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterStagingDirectoryCreate: async () => {
        const segmentsDirectory = path.join(rootPath, 'memories', memoryId, 'segments');
        const stagingName = (await readdir(segmentsDirectory)).find((entry) =>
          entry.startsWith('.reo-finalizing-')
        );
        assert.ok(stagingName);
        await mkdir(path.join(outsideRecordingsDirectory, stagingName));
        await rename(
          segmentsDirectory,
          path.join(rootPath, 'memories', memoryId, 'segments-preserved')
        );
        await symlink(outsideRecordingsDirectory, segmentsDirectory, 'dir');
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
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.md')));
});

test('finalize rejects segments parent symlink swap after rename validation', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_final_rename_swap';
  const memoryId = 'mem_final_rename_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-final-rename-outside-')
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Final rename swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeFinalRename: async () => {
        const segmentsDirectory = path.join(rootPath, 'memories', memoryId, 'segments');
        const stagingName = (await readdir(segmentsDirectory)).find((entry) =>
          entry.startsWith('.reo-finalizing-')
        );
        assert.ok(stagingName);
        const outsideStagingDirectory = path.join(outsideRecordingsDirectory, stagingName);
        await mkdir(outsideStagingDirectory);
        await writeFile(path.join(outsideStagingDirectory, 'audio.webm'), new Uint8Array([9, 9]));
        await writeFile(path.join(outsideStagingDirectory, 'segment.json'), '{}');
        await writeFile(path.join(outsideStagingDirectory, 'transcript.md'), '');
        await writeFile(path.join(outsideStagingDirectory, '.reo-finalize-transaction.json'), '{}');
        await rename(
          segmentsDirectory,
          path.join(rootPath, 'memories', memoryId, 'segments-preserved')
        );
        await symlink(outsideRecordingsDirectory, segmentsDirectory, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await assert.rejects(stat(path.join(outsideRecordingsDirectory, segmentId, 'audio.webm')));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.md')));
});

test('finalize does not expose outside target after final rename validation', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_final_commit_swap';
  const memoryId = 'mem_final_commit_swap';
  const segmentsDirectory = path.join(
    rootPath,
    'memories',
    `${memoryId}--Expose source swap`,
    'segments'
  );
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-final-commit-outside-')
  );
  const displacedRecordingsDirectory = path.join(outsideRecordingsDirectory, 'displaced-segments');
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Final commit swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeFinalRenameCommit: () => {
        const stagingName = readdirSync(process.cwd()).find((entry) =>
          entry.startsWith('.reo-finalizing-')
        );
        assert.ok(stagingName);
        renameSync(segmentsDirectory, displacedRecordingsDirectory);
        symlinkSync(outsideRecordingsDirectory, segmentsDirectory, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await assert.rejects(stat(path.join(outsideRecordingsDirectory, segmentId, 'audio.webm')));
  await assert.rejects(stat(path.join(displacedRecordingsDirectory, segmentId, 'audio.webm')));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.md')));
});

test('finalize rejects recording target created after duplicate preflight', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_late_duplicate';
  const memoryId = 'mem_late_duplicate';
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Late duplicate',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeFinalRenameCommit: () => {
        mkdirSync(path.join(process.cwd(), `${segmentId}--Late duplicate`));
      },
    },
  });

  assert.equal(finalized.ok, false);
  await assert.rejects(
    stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId, 'audio.webm'))
  );
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
});

test('finalize rejects recording target created after final duplicate preflight', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_late_duplicate_after_check';
  const memoryId = 'mem_late_duplicate_after_check';
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Late duplicate after check',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterFinalRenameTargetPreflight: () => {
        mkdirSync(path.join(process.cwd(), `${segmentId}--Late duplicate after check`));
      },
    },
  });

  assert.equal(finalized.ok, false);
  await assert.rejects(
    stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId, 'audio.webm'))
  );
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
});

test('finalize rejects recording target created after the last target preflight', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_late_duplicate_last_check';
  const memoryId = 'mem_late_duplicate_last_check';
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Late duplicate last check',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterFinalRenameLastPreflight: () => {
        mkdirSync(path.join(process.cwd(), `${segmentId}--Late duplicate last check`));
      },
    },
  });

  assert.equal(finalized.ok, false);
  await assert.rejects(
    stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId, 'audio.webm'))
  );
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
});

test('finalize rejects staging metadata symlink after draft copy', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_staging_metadata_symlink';
  const memoryId = 'mem_staging_metadata_symlink';
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-staging-metadata-outside-'));
  await writeFile(
    path.join(outside, 'segment.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_outside',
      segmentId,
      type: 'audio',
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
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Staging metadata symlink',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterCopy: async () => {
        const stagingName = readdirSync(path.join(rootPath, 'memories', memoryId, 'segments')).find(
          (entry) => entry.startsWith('.reo-finalizing-')
        );
        assert.ok(stagingName);
        const metadataPath = path.join(
          rootPath,
          'memories',
          memoryId,
          'segments',
          stagingName,
          'segment.json'
        );
        await rm(metadataPath);
        await symlink(path.join(outside, 'segment.json'), metadataPath);
      },
    },
  });

  assert.equal(finalized.ok, false);
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId)));
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
});

test('pre-expose cleanup does not delete outside staging after cleanup validation', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_cleanup_post_validate';
  const memoryId = 'mem_cleanup_post_validate';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-cleanup-post-outside-')
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  let swapped = false;
  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
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
        const segmentsDirectory = path.join(
          rootPath,
          'memories',
          `${memoryId}--Cleanup post validation`,
          'segments'
        );
        const stagingName = (await readdir(segmentsDirectory)).find((entry) =>
          entry.startsWith('.reo-finalizing-')
        );
        assert.ok(stagingName);
        const outsideStagingDirectory = path.join(outsideRecordingsDirectory, stagingName);
        await mkdir(outsideStagingDirectory);
        await writeFile(path.join(outsideStagingDirectory, 'sentinel.txt'), 'outside');
        await rename(
          segmentsDirectory,
          path.join(
            rootPath,
            'memories',
            `${memoryId}--Cleanup post validation`,
            'segments-preserved'
          )
        );
        await symlink(outsideRecordingsDirectory, segmentsDirectory, 'dir');
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
  const segmentId = 'seg_20260506_draft_cleanup_swap';
  const memoryId = 'mem_draft_cleanup_swap';
  const outsideDraftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-cleanup-outside-'));
  await mkdir(path.join(outsideDraftsRoot, segmentId));
  await writeFile(path.join(outsideDraftsRoot, segmentId, 'sentinel.txt'), 'outside');
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const segmentsRoot = path.join(rootPath, '.reo', 'drafts', 'segments');
  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Draft cleanup swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      beforeDraftDirectoryRemove: async () => {
        await rename(segmentsRoot, path.join(rootPath, '.reo', 'drafts', 'segments-preserved'));
        await symlink(outsideDraftsRoot, segmentsRoot, 'dir');
      },
    },
  });

  assert.equal(finalized.ok, false);
  await stat(path.join(outsideDraftsRoot, segmentId, 'sentinel.txt'));
});

test('finalize rejects memory directory symlink swap before memory metadata write', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_memory_metadata_swap';
  const memoryId = 'mem_memory_metadata_swap';
  const outsideMemoryDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-json-outside-'));
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const memoryDirectoryPath = path.join(rootPath, 'memories', memoryId);
  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
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
  await assert.rejects(stat(path.join(outsideMemoryDirectory, 'memory.md')));
});

test('finalize rejects staging source swap before final expose', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_expose_source_swap';
  const memoryId = 'mem_expose_source_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-expose-source-outside-')
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const segmentsDirectory = path.join(
    rootPath,
    'memories',
    `${memoryId}--Expose source swap`,
    'segments'
  );
  let outsideStagingDirectory = '';
  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
    title: 'Expose source swap',
    durationMs: 3000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterFinalRenameTargetPreflight: () => {
        const stagingName = readdirSync(segmentsDirectory).find((entry) =>
          entry.startsWith('.reo-finalizing-')
        );
        assert.ok(stagingName);
        const stagingDirectory = path.join(segmentsDirectory, stagingName);
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
    stat(
      path.join(
        rootPath,
        'memories',
        `${memoryId}--Expose source swap`,
        'segments',
        segmentId,
        'sentinel.txt'
      )
    )
  );
});

test('finalize aborts when workspace handle is lost during durable transaction', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_handle_lost';
  const memoryId = 'mem_handle_lost';
  let usable = true;
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
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
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
});

test('finalize does not roll back files after the workspace handle is lost', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_handle_lost_no_rollback';
  const memoryId = 'mem_handle_lost_no_rollback';
  let usable = true;
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
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
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
  const segmentDirectory = await findSegmentDirectoryById(rootPath, segmentId);
  await stat(path.join(segmentDirectory, '.reo-finalize-transaction.json'));
  assert.equal(
    (
      (await readMemoryFileTruthForTest(path.dirname(path.dirname(segmentDirectory)))) as {
        memoryId: string;
      }
    ).memoryId,
    memoryId
  );
});

test('finalize does not run pre-expose cleanup after the workspace handle is lost', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_pre_expose_lock_lost';
  const memoryId = 'mem_pre_expose_lock_lost';
  let usable = true;
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
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
  const segmentsDirectory = path.join(
    rootPath,
    'memories',
    `${memoryId}--Pre-expose lock lost`,
    'segments'
  );
  const stagingName = (await readdir(segmentsDirectory)).find((entry) =>
    entry.startsWith('.reo-finalizing-')
  );
  assert.ok(stagingName);
  await stat(path.join(segmentsDirectory, stagingName, '.reo-finalize-transaction.json'));
});

test('finalize rechecks the workspace handle before rebuilding the index', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_index_lock_lost';
  const memoryId = 'mem_index_lock_lost';
  let afterParentFsync = false;
  let postParentChecks = 0;
  let indexRebuilt = false;
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
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
  await stat(
    path.join(
      rootPath,
      'memories',
      `${memoryId}--Index lock lost`,
      'segments',
      `${segmentId}--Index lock lost`
    )
  );
});

test('finalize aborts when workspace handle is lost before memory parent writes', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_parent_lock_lost';
  const memoryId = 'mem_parent_lock_lost';
  let usable = true;
  let touchedAfterLockLost = false;
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
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
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
});

test('finalize aborts when workspace handle is lost before staging writes', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_staging_lock_lost';
  const memoryId = 'mem_staging_lock_lost';
  let usable = true;
  let markerWrittenAfterLockLost = false;
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
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
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'segments', segmentId)));
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
});

test('finalize does not unlink outside marker after draft cleanup validation', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_marker_cleanup_swap';
  const memoryId = 'mem_marker_cleanup_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-marker-cleanup-outside-')
  );
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const segmentsDirectory = path.join(rootPath, 'memories', memoryId, 'segments');
  const outsideTargetDirectory = path.join(outsideRecordingsDirectory, segmentId);
  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
    segmentId,
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
        await rename(segmentsDirectory, `${segmentsDirectory}-preserved`);
        await symlink(outsideRecordingsDirectory, segmentsDirectory, 'dir');
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
    filePath: path.join(rootPath, 'memories', 'mem_1', 'memory.md'),
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
    filePath: path.join(rootPath, 'memories', 'mem_1', 'memory.md'),
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
      writeWorkspaceFileAtomic(path.join(parentDirectory, 'memory.md'), '{"secret":true}\n')
    );
  } finally {
    setAfterAtomicWorkspaceFileValidationForTest(null);
  }

  await assert.rejects(readFile(path.join(outsideParentDirectory, 'memory.md'), 'utf8'));
  await assert.rejects(readFile(path.join(displacedParentDirectory, 'memory.md'), 'utf8'));
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
      writeWorkspaceFileAtomic(path.join(parentDirectory, 'memory.md'), '{"secret":true}\n')
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
  await writeFile(path.join(parentDirectory, 'memory.md'), '{"title":"old"}\n');

  setAfterAtomicWorkspaceFileValidationForTest(() => {
    renameSync(parentDirectory, displacedParentDirectory);
    symlinkSync(outsideParentDirectory, parentDirectory, 'dir');
  });
  try {
    await assert.rejects(
      writeWorkspaceFileAtomic(path.join(parentDirectory, 'memory.md'), '{"title":"new"}\n')
    );
  } finally {
    setAfterAtomicWorkspaceFileValidationForTest(null);
  }

  assert.equal(
    await readFile(path.join(displacedParentDirectory, 'memory.md'), 'utf8'),
    '{"title":"old"}\n'
  );
  await assert.rejects(readFile(path.join(outsideParentDirectory, 'memory.md'), 'utf8'));
});

test('atomic replace does not report failure after successful commit and backup removal', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-atomic-backup-cleanup-'));
  const parentDirectory = path.join(rootPath, 'memories', 'mem_backup_cleanup');
  const targetPath = path.join(parentDirectory, 'memory.md');
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

test('rebuild skips finalized audio segment metadata missing detail-read required fields', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_incomplete_metadata',
    title: 'Incomplete metadata',
  });
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_incomplete_metadata',
    'segments',
    'seg_20260506_incomplete_metadata'
  );
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1, 2]));
  await writeFile(
    path.join(recordingDirectory, 'segment.json'),
    JSON.stringify({
      memoryId: 'mem_incomplete_metadata',
      type: 'audio',
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
      audioDurationMs: 0,
      supplementCount: 0,
      hasAudioTranscript: false,
      memoryId: 'mem_incomplete_metadata',
      segmentCount: 0,
      audioSegmentCount: 0,
      noteSegmentCount: 0,
      hasAnyNote: false,
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
    createSegmentId: () => 'seg_20260506_000004',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);

  await mkdir(
    path.join(rootPath, 'memories', 'mem_interrupted', 'segments', 'seg_20260506_000004'),
    { recursive: true }
  );
  await writeFile(
    path.join(
      rootPath,
      'memories',
      'mem_interrupted',
      'segments',
      'seg_20260506_000004',
      '.reo-finalize-transaction.json'
    ),
    '{"segmentId":"seg_20260506_000004"}'
  );

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_000004'));
  await assert.rejects(
    stat(path.join(rootPath, 'memories', 'mem_interrupted', 'segments', 'seg_20260506_000004'))
  );
});

test('recovery removes empty metadata-less memory directories after staging cleanup', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_recovery_empty_memory_retry';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });
  await mkdir(
    path.join(
      rootPath,
      'memories',
      'mem_recovery_empty_retry',
      'segments',
      `.reo-finalizing-${segmentId}.1`
    ),
    { recursive: true }
  );
  await writeFile(
    path.join(
      rootPath,
      'memories',
      'mem_recovery_empty_retry',
      'segments',
      `.reo-finalizing-${segmentId}.1`,
      '.reo-finalize-transaction.json'
    ),
    JSON.stringify({ segmentId })
  );

  await recoverRecordingFinalizeTransactions(rootPath);

  await assert.rejects(stat(path.join(rootPath, 'memories', 'mem_recovery_empty_retry')));
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_recovery_empty_retry',
    title: 'Recovery empty retry',
    now: '2026-05-06T13:09:00.000Z',
  });
  const retried = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    segmentId,
    memoryId: 'mem_recovery_empty_retry',
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
    'segments',
    '.reo-finalizing-seg_20260506_recovery_lock_lost.1'
  );
  await mkdir(stagingDirectory, { recursive: true });
  await writeFile(
    path.join(stagingDirectory, '.reo-finalize-transaction.json'),
    '{"segmentId":"seg_20260506_recovery_lock_lost"}'
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
  await mkdir(path.join(memoryDirectory, 'segments'), { recursive: true });
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

test('recovery preserves metadata-less memory when semantic payload appears before cleanup remove', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_late_payload';
  const memoryDirectory = path.join(rootPath, 'memories', memoryId);
  await mkdir(path.join(memoryDirectory, 'segments'), { recursive: true });
  let checks = 0;

  await recoverRecordingFinalizeTransactions(rootPath, {
    assertWorkspaceUsable: async () => {
      checks += 1;
      if (checks === 2) {
        await writeFile(
          path.join(memoryDirectory, 'memory.md'),
          renderWorkspaceMarkdownObject({
            objectType: 'memory',
            data: { title: '恢复期间出现的记忆' },
            content: '# 恢复期间出现的记忆\n',
          })
        );
      }
    },
  });

  await stat(memoryDirectory);
  assert.match(
    await readFile(path.join(memoryDirectory, 'memory.md'), 'utf8'),
    /恢复期间出现的记忆/
  );
});

test('recovery preserves markerless metadata-less memory payloads instead of guessing deletion', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_markerless_partial_retry';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });
  await mkdir(path.join(rootPath, 'memories', 'mem_markerless_partial', 'segments', segmentId), {
    recursive: true,
  });

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(path.join(rootPath, 'memories', 'mem_markerless_partial', 'segments', segmentId));
});

test('recovery removes stale drafts for finalized segments before clearing markers', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => 'seg_20260506_stale_draft',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_stale_draft',
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_stale_draft',
    title: 'Recovered memory',
  });
  const recordingDirectory = await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId: 'mem_stale_draft',
    segmentId: 'seg_20260506_stale_draft',
    title: 'Recovered memory',
    audioBytes: [1, 2],
  });
  await writeFile(
    path.join(recordingDirectory, '.reo-finalize-transaction.json'),
    '{"segmentId":"seg_20260506_stale_draft"}'
  );

  await recoverRecordingFinalizeTransactions(rootPath);

  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_stale_draft'))
  );
  await stat(path.join(recordingDirectory, 'segment.md'));
  await assert.rejects(stat(path.join(recordingDirectory, '.reo-finalize-transaction.json')));
});

test('recovery ignores stale memory segment id input when no finalize marker exists', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_existing',
    title: 'Existing memory',
  });

  await recoverRecordingFinalizeTransactions(rootPath);
  await rebuildMemoryIndex(rootPath);

  assert.deepEqual(
    await readMemoryFileTruthForTest(path.join(rootPath, 'memories', 'mem_existing')),
    {
      memoryId: 'mem_existing',
      title: 'Existing memory',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:08:00.000Z',
    }
  );
  assert.deepEqual(await readWorkspaceIndex(rootPath), {
    schemaVersion: 1,
    memories: [
      {
        memoryId: 'mem_existing',
        title: 'Existing memory',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
        segmentCount: 0,
        audioSegmentCount: 0,
        noteSegmentCount: 0,
        audioDurationMs: 0,
        audioByteLength: 0,
        hasAudioTranscript: false,
        hasAnyNote: false,
        supplementCount: 0,
      },
    ],
  });
});

test('recovery leaves markerless finalized file truth visible through detail scan', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_file_space_nodes';
  const segmentId = 'seg_20260512_recovery_file_space_node';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Recovery file-space node',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音25',
    directoryName: `${segmentId}--录音25`,
    finalizedAt: '2026-05-12T16:27:09.824Z',
  });

  await recoverRecordingFinalizeTransactions(rootPath);

  assert.deepEqual(
    await readProjectedSegmentIdsFromMemoryDirectoryForTest(
      path.join(rootPath, 'memories', memoryId)
    ),
    [segmentId]
  );
  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
  });
  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.value.segments[0]?.segmentId, segmentId);
  }
});

test('recovery preserves marker-bearing valid segment file-space node missing from file-truth scan', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_marker_file_space_node';
  const segmentId = 'seg_20260512_recovery_marker_file_space_node';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Recovery marker file-space node',
  });
  const recordingDirectory = await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音25',
    directoryName: `${segmentId}--录音25`,
    finalizedAt: '2026-05-12T16:27:09.824Z',
  });
  await writeFile(path.join(recordingDirectory, '.reo-finalize-transaction.json'), '{}');

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(path.join(recordingDirectory, 'segment.md'));
  await assert.rejects(stat(path.join(recordingDirectory, '.reo-finalize-transaction.json')));
  assert.deepEqual(
    await readProjectedSegmentIdsFromMemoryDirectoryForTest(
      path.join(rootPath, 'memories', memoryId)
    ),
    [segmentId]
  );
});

test('recovery preserves externally renamed valid segments whose title starts like staging', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_staging_named_segment';
  const segmentId = 'seg_20260512_recovery_staging_named_segment';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Recovery staging named segment',
  });
  const recordingDirectory = await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '用户命名',
    directoryName: `${segmentId}--.reo-finalizing-用户命名`,
    finalizedAt: '2026-05-12T16:27:09.824Z',
  });

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(path.join(recordingDirectory, 'segment.md'));
  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
  });
  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.value.segments[0]?.segmentId, segmentId);
  }
});

test('recovery clears finalized supplement markers after stale draft cleanup', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_supplement_marker';
  const segmentId = 'seg_20260512_recovery_supplement_marker';
  const supplementId = 'sup_20260512_recovery_supplement_marker';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Recovery supplement marker',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音25',
  });
  await writeFinalizedAudioSupplementForTest(rootPath, {
    memoryId,
    segmentId,
    supplementId,
    title: '补充录音1',
    directoryName: `${supplementId}--补充录音1`,
    finalizedAt: '2026-05-12T16:27:09.824Z',
  });
  const supplementDirectory = path.join(
    rootPath,
    'memories',
    memoryId,
    'segments',
    segmentId,
    'supplements',
    `${supplementId}--补充录音1`
  );
  await writeFile(path.join(supplementDirectory, '.reo-finalize-transaction.json'), '{}');
  await mkdir(path.join(rootPath, '.reo', 'drafts', 'supplements', supplementId), {
    recursive: true,
  });

  await recoverRecordingFinalizeTransactions(rootPath);

  await assert.rejects(stat(path.join(rootPath, '.reo', 'drafts', 'supplements', supplementId)));
  await assert.rejects(stat(path.join(supplementDirectory, '.reo-finalize-transaction.json')));
});

test('rebuilds index only from finalized audio segment metadata that matches audio bytes and ownership', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_existing',
    title: 'Existing memory',
  });
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_existing',
    'segments',
    'seg_mismatch'
  );
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1, 2, 3, 4]));
  await writeFile(
    path.join(recordingDirectory, 'segment.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      memoryId: 'mem_existing',
      segmentId: 'seg_metadata_mismatch',
      type: 'audio',
      status: 'finalized',
      title: 'Mismatch',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 3,
      transcriptPath: 'transcript.md',
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
        segmentCount: 0,
        audioSegmentCount: 0,
        noteSegmentCount: 0,
        audioDurationMs: 0,
        audioByteLength: 0,
        hasAudioTranscript: false,
        hasAnyNote: false,
        supplementCount: 0,
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
    createSegmentId: () => 'seg_20260506_fsync',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_20260506_fsync',
    segmentId: 'seg_20260506_fsync',
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
        calls.push('fsync-segments-parent');
      },
    },
  });

  assert.equal(finalized.ok, true);
  assert.deepEqual(calls, [
    'write-marker',
    'copy-draft',
    'fsync-staging-tree',
    'before-rename',
    'fsync-segments-parent',
  ]);
  assert.ok(calls.indexOf('fsync-staging-tree') < calls.indexOf('before-rename'));
  assert.ok(calls.indexOf('before-rename') < calls.indexOf('fsync-segments-parent'));
});

test('finalize fails instead of clearing marker when draft cleanup cannot complete', async () => {
  const rootPath = await workspaceRoot();
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => 'seg_20260506_cleanup_blocked',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_cleanup_blocked',
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_cleanup_blocked',
    segmentId: 'seg_20260506_cleanup_blocked',
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

  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_cleanup_blocked'));
  await assert.rejects(
    stat(
      path.join(
        rootPath,
        'memories',
        'mem_cleanup_blocked',
        'segments',
        'seg_20260506_cleanup_blocked'
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
    createSegmentId: () => 'seg_20260506_cleanup_fsync_blocked',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_cleanup_fsync_blocked',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_cleanup_fsync_blocked',
    segmentId: 'seg_20260506_cleanup_fsync_blocked',
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
    stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_cleanup_fsync_blocked'))
  );
  const finalizedSegmentDirectory = await findSegmentDirectoryById(
    rootPath,
    'seg_20260506_cleanup_fsync_blocked'
  );
  await stat(path.join(finalizedSegmentDirectory, '.reo-finalize-transaction.json'));
  assert.deepEqual(
    await readMemoryFileTruthForTest(path.dirname(path.dirname(finalizedSegmentDirectory))),
    {
      memoryId: 'mem_cleanup_fsync_blocked',
      title: 'Cleanup fsync blocked',
      createdAt: '2026-05-06T13:09:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
    }
  );
});

test('finalize keeps durable marker when workspace lock is lost after draft cleanup', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => 'seg_20260506_cleanup_lock_lost',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_cleanup_lock_lost',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  let usable = true;

  const finalized = await createMemoryWithRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_cleanup_lock_lost',
    segmentId: 'seg_20260506_cleanup_lock_lost',
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
    stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_cleanup_lock_lost'))
  );
  await stat(
    path.join(
      await findSegmentDirectoryById(rootPath, 'seg_20260506_cleanup_lock_lost'),
      '.reo-finalize-transaction.json'
    )
  );
});

test('recovery keeps marker when stale draft cleanup cannot complete', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => 'seg_20260506_recovery_cleanup_blocked',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_recovery_cleanup_blocked',
    title: 'Recovery cleanup blocked',
  });
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_recovery_cleanup_blocked',
    'segments',
    'seg_20260506_recovery_cleanup_blocked'
  );
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1, 2]));
  await writeFile(path.join(recordingDirectory, 'transcript.md'), '');
  await writeFile(
    path.join(recordingDirectory, 'segment.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      memoryId: 'mem_recovery_cleanup_blocked',
      segmentId: 'seg_20260506_recovery_cleanup_blocked',
      type: 'audio',
      status: 'finalized',
      title: 'Recovery cleanup blocked',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 2,
      transcriptPath: 'transcript.md',
    })
  );
  await writeFile(
    path.join(recordingDirectory, '.reo-finalize-transaction.json'),
    '{"segmentId":"seg_20260506_recovery_cleanup_blocked"}'
  );

  await recoverRecordingFinalizeTransactions(rootPath, {
    removeDraftDirectory: async () => {
      throw new Error('draft cleanup blocked');
    },
  });

  await stat(
    path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_recovery_cleanup_blocked')
  );
  await stat(path.join(recordingDirectory, '.reo-finalize-transaction.json'));
});

test('recovery keeps marker when draft parent fsync cannot be confirmed', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => 'seg_20260506_recovery_fsync_blocked',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_recovery_fsync_blocked',
    title: 'Recovery fsync blocked',
  });
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_recovery_fsync_blocked',
    'segments',
    'seg_20260506_recovery_fsync_blocked'
  );
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId: 'mem_recovery_fsync_blocked',
    segmentId: 'seg_20260506_recovery_fsync_blocked',
    title: 'Recovery fsync blocked',
  });
  await writeFile(
    path.join(recordingDirectory, '.reo-finalize-transaction.json'),
    '{"segmentId":"seg_20260506_recovery_fsync_blocked"}'
  );

  await recoverRecordingFinalizeTransactions(rootPath, {
    afterDraftCleanup: () => {
      throw new Error('draft parent fsync blocked');
    },
  });

  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_recovery_fsync_blocked'))
  );
  await stat(path.join(recordingDirectory, '.reo-finalize-transaction.json'));
});

test('recovery clears marker when the stale draft is already missing', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_recovery_missing_draft',
    title: 'Recovery missing draft',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId: 'mem_recovery_missing_draft',
    segmentId: 'seg_20260506_recovery_missing_draft',
    title: 'Recovery missing draft',
  });
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_recovery_missing_draft',
    'segments',
    'seg_20260506_recovery_missing_draft'
  );
  await writeFile(
    path.join(recordingDirectory, '.reo-finalize-transaction.json'),
    '{"segmentId":"seg_20260506_recovery_missing_draft"}'
  );

  await recoverRecordingFinalizeTransactions(rootPath);

  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_recovery_missing_draft'))
  );
  await assert.rejects(stat(path.join(recordingDirectory, '.reo-finalize-transaction.json')));
});

test('recovery preserves marker-bearing durable recording when finalized files are invalid', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_invalid_finalized';
  const segmentId = 'seg_20260506_recovery_invalid_finalized';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Recovery invalid finalized',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: 'Recovery invalid finalized',
    audioBytes: [1, 2, 3],
  });
  const recordingDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  await writeFile(path.join(recordingDirectory, '.reo-finalize-transaction.json'), '{}');
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1]));

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(path.join(recordingDirectory, 'segment.md'));
  await stat(path.join(recordingDirectory, '.reo-finalize-transaction.json'));
  assert.deepEqual(await readMemoryFileTruthForTest(path.join(rootPath, 'memories', memoryId)), {
    memoryId,
    title: 'Recovery invalid finalized',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:08:00.000Z',
  });
});

test('recovery preserves renamed marker-bearing durable recording when finalized files are invalid', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_renamed_invalid_finalized';
  const segmentId = 'seg_20260512_recovery_renamed_invalid';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Recovery renamed invalid finalized',
  });
  const recordingDirectory = await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: '录音25',
    directoryName: `${segmentId}--录音25`,
    audioBytes: [1, 2, 3],
  });
  await writeFile(path.join(recordingDirectory, '.reo-finalize-transaction.json'), '{}');
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1]));

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(path.join(recordingDirectory, 'segment.md'));
  await stat(path.join(recordingDirectory, '.reo-finalize-transaction.json'));
  assert.deepEqual(await readMemoryFileTruthForTest(path.join(rootPath, 'memories', memoryId)), {
    memoryId,
    title: 'Recovery renamed invalid finalized',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:08:00.000Z',
  });
});

test('recovery ignores symlinked finalize markers without repairing invalid segments', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_marker_symlink';
  const segmentId = 'seg_20260506_recovery_marker_symlink';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Recovery marker symlink',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: 'Recovery marker symlink',
    audioBytes: [1, 2, 3],
  });
  const recordingDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  await writeFile(path.join(recordingDirectory, 'segment.md'), '{');
  const outsideMarker = path.join(rootPath, '..', `reo-outside-marker-${Date.now()}.json`);
  await writeFile(outsideMarker, '{}');
  await symlink(outsideMarker, path.join(recordingDirectory, '.reo-finalize-transaction.json'));

  await recoverRecordingFinalizeTransactions(rootPath);

  assert.deepEqual(await readMemoryFileTruthForTest(path.join(rootPath, 'memories', memoryId)), {
    memoryId,
    title: 'Recovery marker symlink',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:08:00.000Z',
  });
  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
  });
  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.value.segments.length, 0);
  }
});

test('recovery preserves metadata-less marker-bearing finalized segments', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_marker_no_metadata';
  const segmentId = 'seg_20260506_recovery_marker_no_metadata';
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: 'Recovery marker no metadata',
  });
  const recordingDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  await writeFile(path.join(recordingDirectory, '.reo-finalize-transaction.json'), '{}');

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(path.join(recordingDirectory, 'segment.md'));
  await stat(path.join(recordingDirectory, '.reo-finalize-transaction.json'));
  await assert.rejects(stat(path.join(rootPath, 'memories', memoryId, 'memory.md')));
});

test('recovery does not unlink outside marker after draft cleanup validation', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_marker_swap';
  const segmentId = 'seg_20260506_recovery_marker_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-recovery-marker-outside-')
  );
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Recovery marker swap',
  });
  await writeFinalizedAudioSegmentForTest(rootPath, {
    memoryId,
    segmentId,
    title: 'Recovery marker swap',
  });
  const recordingDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  await writeFile(
    path.join(recordingDirectory, '.reo-finalize-transaction.json'),
    '{"segmentId":"seg_20260506_recovery_marker_swap"}'
  );
  const segmentsDirectory = path.join(rootPath, 'memories', memoryId, 'segments');
  const outsideTargetDirectory = path.join(outsideRecordingsDirectory, segmentId);

  await recoverRecordingFinalizeTransactions(rootPath, {
    afterDraftCleanup: async () => {
      await mkdir(outsideTargetDirectory, { recursive: true });
      await writeFile(
        path.join(outsideTargetDirectory, '.reo-finalize-transaction.json'),
        'outside marker'
      );
      await rename(segmentsDirectory, `${segmentsDirectory}-preserved`);
      await symlink(outsideRecordingsDirectory, segmentsDirectory, 'dir');
    },
  });

  await stat(path.join(outsideTargetDirectory, '.reo-finalize-transaction.json'));
});

test('recovery ignores symlinked segments directories without deleting outside files', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_recovery_symlink_segments',
    title: 'Symlink segments',
  });
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-segments-outside-'));
  const outsideStaging = path.join(outside, '.reo-finalizing-seg_external');
  await mkdir(outsideStaging, { recursive: true });
  await mkdir(path.join(rootPath, 'memories', 'mem_recovery_symlink_segments'), {
    recursive: true,
  });
  await symlink(
    outside,
    path.join(rootPath, 'memories', 'mem_recovery_symlink_segments', 'segments')
  );

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(outsideStaging);
});

test('recovery leaves recording references whose leaf directory is a symlink to read-time truth', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_leaf_symlink';
  const segmentId = 'seg_recovery_leaf_symlink';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Leaf symlink',
  });
  const segmentsDirectory = path.join(rootPath, 'memories', memoryId, 'segments');
  const outsideRecordingDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-recording-leaf-'));
  await mkdir(segmentsDirectory);
  await writeFile(path.join(outsideRecordingDirectory, 'audio.webm'), new Uint8Array([1, 2, 3]));
  await writeFile(
    path.join(outsideRecordingDirectory, 'segment.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_memory',
        memoryId,
        segmentId,
        type: 'audio',
        status: 'finalized',
        title: 'Leaf symlink',
        createdAt: '2026-05-06T13:08:00.000Z',
        finalizedAt: '2026-05-06T13:09:00.000Z',
        durationMs: 3000,
        nextSequence: 1,
        audioByteLength: 3,
        transcriptPath: 'transcript.md',
      },
      null,
      2
    )
  );
  await symlink(outsideRecordingDirectory, path.join(segmentsDirectory, segmentId), 'dir');

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(path.join(outsideRecordingDirectory, 'audio.webm'));
  assert.deepEqual(await readMemoryFileTruthForTest(path.join(rootPath, 'memories', memoryId)), {
    memoryId,
    title: 'Leaf symlink',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:08:00.000Z',
  });
  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId,
  });
  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.value.segments.length, 0);
  }
});

test('recovery does not delete outside staging after segments cleanup validation', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_recovery_cleanup_swap';
  const outsideRecordingsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'reo-recovery-cleanup-outside-')
  );
  const stagingName = '.reo-finalizing-seg_20260506_recovery_cleanup_swap.1';
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Recovery cleanup swap',
  });
  const segmentsDirectory = path.join(rootPath, 'memories', memoryId, 'segments');
  await mkdir(path.join(segmentsDirectory, stagingName), { recursive: true });
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
        segmentsDirectory,
        path.join(rootPath, 'memories', memoryId, 'segments-preserved')
      );
      await symlink(outsideRecordingsDirectory, segmentsDirectory, 'dir');
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
  await writeMemoryForTest(rootPath, {
    memoryId,
    title: 'Recovery repair swap',
  });
  const memoryDirectoryPath = path.join(rootPath, 'memories', memoryId);
  const segmentsDirectory = path.join(memoryDirectoryPath, 'segments');
  await mkdir(path.join(segmentsDirectory, '.reo-finalizing-seg_20260506_missing_repair.1'), {
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
  await assert.rejects(stat(path.join(outsideMemoryDirectory, 'memory.md')));
});

test('rejects concurrent appends to the same memory without losing a draft', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_concurrent',
    title: 'Concurrent memory',
  });
  for (const segmentId of ['seg_20260506_concurrent_a', 'seg_20260506_concurrent_b']) {
    await createRecordingDraft({
      rootPath,
      workspaceId: 'ws_memory',
      createSegmentId: () => segmentId,
      now: () => '2026-05-06T13:08:00.000Z',
    });
    await appendRecordingAudioChunk({
      rootPath,
      segmentId,
      sequence: 0,
      chunk: new Uint8Array([1]),
    });
  }

  const results = await Promise.all(
    ['seg_20260506_concurrent_a', 'seg_20260506_concurrent_b'].map((segmentId) =>
      appendAudioSegmentToMemory({
        rootPath,
        workspaceId: 'ws_memory',
        memoryId: 'mem_concurrent',
        segmentId,
        title: 'Concurrent memory',
        durationMs: 1000,
        now: () => '2026-05-06T13:09:00.000Z',
      })
    )
  );

  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok).length, 1);
  const projectedSegmentIds = await readProjectedSegmentIdsFromMemoryDirectoryForTest(
    path.join(rootPath, 'memories', 'mem_concurrent')
  );
  assert.equal(projectedSegmentIds.length, 1);
});

test('title update is rejected while the same memory has an active append write', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryForTest(rootPath, {
    memoryId: 'mem_title_lock',
    title: 'Original title',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createSegmentId: () => 'seg_20260506_title_lock',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_title_lock',
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });
  const appendEntered = createDeferred<void>();
  const releaseAppend = createDeferred<void>();

  const append = appendAudioSegmentToMemory({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_title_lock',
    segmentId: 'seg_20260506_title_lock',
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
  if (!renamed.ok) {
    assert.equal(renamed.error.code, 'ERR_MEMORY_UPDATE_FAILED');
  }
  assert.equal((await append).ok, true);
  assert.deepEqual(
    await readMemoryFileTruthForTest(path.join(rootPath, 'memories', 'mem_title_lock')),
    {
      memoryId: 'mem_title_lock',
      title: 'Original title',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
    }
  );
});

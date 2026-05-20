import assert from 'node:assert/strict';
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  truncate,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setBeforeAtomicWorkspaceFileCommitForTest } from '../../src/main/atomicWorkspaceFile.js';
import {
  appendRecordingAudioChunk,
  appendSegmentSupplementRecordingAudioChunk,
  cloneRecordingDraftPrefix,
  clearRecordingRuntimeStateForRoot,
  createRecordingDraft,
  createSegmentSupplementRecordingDraft,
  discardRecordingDraft,
  finalizeRecordingDraft,
  finalizeSegmentSupplementRecordingDraft,
  readFinalizedAudioSegmentBackfillSource,
  readFinalizedAudioSegmentContent,
  readFinalizedAudioSegmentSupplementBackfillSource,
  readFinalizedAudioSegmentSupplementContent,
  readRecordingDraftAudio,
  saveRecordingMarkdown,
  saveSegmentSupplementMarkdown,
  setAfterDraftAudioReadForTest,
  setAfterDraftDirectoryCreateForTest,
  setAfterDraftPrefixBytesCopiedForTest,
  setBeforeDraftAudioCreateForTest,
  setBeforeDraftAudioOpenForTest,
  setBeforeDraftDirectoryCreateForTest,
  setBeforeMarkdownWriteForTest,
} from '../../src/main/recordingDrafts.js';
import {
  MAX_BACKFILL_AUDIO_READ_BYTES,
  MAX_RECORDING_DRAFT_AUDIO_READ_BYTES,
} from '../../src/workspace-contract/recording-audio.js';
import {
  createMemoryFromFileTruth,
  findSegmentDirectoryById,
  readMemoryDetailFromFileTruth,
  setBeforeDuplicateRecordingCheckForTest,
  setBeforeMemoryDirectoryCandidateScanForTest,
  setBeforeMemoryIndexEntryReadForTest,
} from '../../src/main/memoryFiles.js';
import {
  parseWorkspaceMarkdownObject,
  renderWorkspaceMarkdownObject,
} from '../../src/main/workspaceMarkdownObjects.js';
import { initializeWorkspaceFiles } from '../../src/main/workspaceFiles.js';
import { transcriptDigest } from '../../src/main/transcriptDigest.js';

async function writeFinalizedAudioSegmentForTest(
  rootPath: string,
  segmentId: string
): Promise<void> {
  const memoryDirectory = path.join(rootPath, 'memories', 'mem_active_draft_clear');
  const recordingDirectory = path.join(memoryDirectory, 'segments', segmentId);
  await mkdir(recordingDirectory, { recursive: true });
  await mkdir(path.join(rootPath, '.reo', 'objects', 'memories'), { recursive: true });
  await mkdir(path.join(rootPath, '.reo', 'objects', 'segments'), { recursive: true });
  await writeFile(
    path.join(memoryDirectory, 'memory.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'memory',
      data: { title: 'Active draft clear' },
      content: '# Active draft clear\n',
    })
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'memories', 'mem_active_draft_clear.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      objectType: 'memory',
      memoryId: 'mem_active_draft_clear',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
    })}\n`
  );
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1]));
  await writeFile(
    path.join(recordingDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: 'Active draft clear', kind: 'audio' },
      content: '# Active draft clear\n\n## Transcript\n\n',
    })
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'segments', `${segmentId}.json`),
    `${JSON.stringify({
      schemaVersion: 1,
      objectType: 'segment',
      workspaceId: 'ws_draft',
      memoryId: 'mem_active_draft_clear',
      segmentId,
      kind: 'audio',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 1,
    })}\n`
  );
}

async function writeFinalizedAudioSupplementForTest({
  memoryId = 'mem_active_draft_clear',
  rootPath,
  segmentId,
  supplementId,
}: {
  readonly memoryId?: string;
  readonly rootPath: string;
  readonly segmentId: string;
  readonly supplementId: string;
}): Promise<void> {
  const supplementDirectory = path.join(
    rootPath,
    'memories',
    memoryId,
    'segments',
    segmentId,
    'supplements',
    supplementId
  );
  await mkdir(supplementDirectory, { recursive: true });
  await mkdir(path.join(rootPath, '.reo', 'objects', 'supplements'), { recursive: true });
  await writeFile(path.join(supplementDirectory, 'audio.webm'), new Uint8Array([2]));
  await writeFile(
    path.join(supplementDirectory, 'supplement.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'supplement',
      data: { title: 'Supplement', kind: 'audio' },
      content: '# Supplement\n\n## Transcript\n\n',
    })
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'supplements', `${supplementId}.json`),
    `${JSON.stringify({
      schemaVersion: 1,
      objectType: 'supplement',
      workspaceId: 'ws_draft',
      memoryId,
      segmentId,
      supplementId,
      kind: 'audio',
      createdAt: '2026-05-06T13:10:00.000Z',
      finalizedAt: '2026-05-06T13:11:00.000Z',
      updatedAt: '2026-05-06T13:11:00.000Z',
      durationMs: 500,
      nextSequence: 1,
      audioByteLength: 1,
    })}\n`
  );
}

async function workspaceRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: '录音',
    description: '',
    createWorkspaceId: () => 'ws_draft',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  return root;
}

function workspaceLockLost() {
  return {
    ok: false,
    error: {
      code: 'ERR_WORKSPACE_LOCK_LOST',
      message: 'Workspace lock was lost',
    },
  } as const;
}

async function rewriteObjectManifest(
  rootPath: string,
  kind: 'segments' | 'supplements',
  objectId: string,
  update: (manifest: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  const manifestPath = path.join(rootPath, '.reo', 'objects', kind, `${objectId}.json`);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
  await writeFile(manifestPath, `${JSON.stringify(update(manifest))}\n`);
}

async function findSupplementDirectoryById(
  segmentDirectory: string,
  supplementId: string
): Promise<string> {
  const supplementsDirectory = path.join(segmentDirectory, 'supplements');
  const supplementDirectoryName = (await readdir(supplementsDirectory)).find(
    (entry) => entry === supplementId || entry.startsWith(`${supplementId}--`)
  );
  assert.ok(supplementDirectoryName);
  return path.join(supplementsDirectory, supplementDirectoryName);
}

async function readObjectManifest(rootPath: string, kind: string, objectId: string) {
  return JSON.parse(
    await readFile(path.join(rootPath, '.reo', 'objects', kind, `${objectId}.json`), 'utf8')
  ) as Record<string, unknown>;
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
  const created = await createMemoryFromFileTruth({
    rootPath,
    memoryId,
    title,
    now: () => now,
  });
  assert.equal(created.ok, true);
}

test('finalized audio content reads include transcript baseline hashes', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_active_draft_clear';
  const segmentId = 'seg_transcript_baseline_read';
  await writeFinalizedAudioSegmentForTest(rootPath, segmentId);
  const segmentDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  await writeFile(
    path.join(segmentDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: 'Segment baseline', kind: 'audio' },
      content: '# Segment baseline\n\n## Transcript\n\n用户改过的转录',
    })
  );
  const supplementId = 'sup_transcript_baseline_read';
  await writeFinalizedAudioSupplementForTest({
    rootPath,
    segmentId,
    supplementId,
  });
  const supplementDirectory = path.join(segmentDirectory, 'supplements', supplementId);
  await writeFile(
    path.join(supplementDirectory, 'supplement.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'supplement',
      data: { title: 'Supplement baseline', kind: 'audio' },
      content: '# Supplement baseline\n\n## Transcript\n\n补充录音转录',
    })
  );

  const segment = await readFinalizedAudioSegmentContent({
    assertWorkspaceUsable: () => ({ ok: true }),
    memoryId,
    rootPath,
    segmentId,
  });
  const supplement = await readFinalizedAudioSegmentSupplementContent({
    assertWorkspaceUsable: () => ({ ok: true }),
    memoryId,
    rootPath,
    segmentId,
    supplementId,
    workspaceId: 'ws_draft',
  });

  assert.equal(segment.ok, true);
  if (segment.ok) {
    assert.equal(segment.transcript.exists, true);
    assert.equal(segment.transcript.text, '用户改过的转录');
    assert.equal(
      (segment.transcript as { readonly baselineHash?: string }).baselineHash,
      transcriptDigest('用户改过的转录')
    );
  }
  assert.equal(supplement.ok, true);
  if (supplement.ok) {
    assert.equal(supplement.transcript.exists, true);
    assert.equal(supplement.transcript.text, '补充录音转录');
    assert.equal(
      (supplement.transcript as { readonly baselineHash?: string }).baselineHash,
      transcriptDigest('补充录音转录')
    );
  }
});

test('finalized audio backfill reads accept the Turbo 100MB limit without using the preview cap', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_backfill_large';
  const memoryId = 'mem_active_draft_clear';
  const segmentDirectory = path.join(rootPath, 'memories', memoryId, 'segments', segmentId);
  const segmentAudioPath = path.join(segmentDirectory, 'audio.webm');
  const backfillReadableSize = MAX_RECORDING_DRAFT_AUDIO_READ_BYTES + 1;

  await writeFinalizedAudioSegmentForTest(rootPath, segmentId);
  await truncate(segmentAudioPath, backfillReadableSize);
  await rewriteObjectManifest(rootPath, 'segments', segmentId, (manifest) => ({
    ...manifest,
    audioByteLength: backfillReadableSize,
    lastTranscriptionAttempt: 'failed',
  }));

  const segment = await readFinalizedAudioSegmentContent({
    assertWorkspaceUsable: () => ({ ok: true }),
    maxBytes: MAX_BACKFILL_AUDIO_READ_BYTES,
    memoryId,
    rootPath,
    segmentId,
  });

  assert.equal(segment.ok, true);
  if (segment.ok) {
    assert.equal(segment.audioByteLength, backfillReadableSize);
    assert.equal(segment.audio.byteLength, backfillReadableSize);
    assert.equal(segment.lastTranscriptionAttempt, 'failed');
  }

  const supplementId = 'sup_backfill_large';
  const supplementDirectory = path.join(segmentDirectory, 'supplements', supplementId);
  await mkdir(supplementDirectory, { recursive: true });
  await mkdir(path.join(rootPath, '.reo', 'objects', 'supplements'), { recursive: true });
  await writeFile(path.join(supplementDirectory, 'audio.webm'), new Uint8Array());
  await truncate(path.join(supplementDirectory, 'audio.webm'), backfillReadableSize);
  await writeFile(
    path.join(supplementDirectory, 'supplement.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'supplement',
      data: { title: 'Large supplement', kind: 'audio' },
      content: '# Large supplement\n\n## Transcript\n\n',
    })
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'supplements', `${supplementId}.json`),
    `${JSON.stringify({
      schemaVersion: 1,
      objectType: 'supplement',
      workspaceId: 'ws_draft',
      memoryId,
      segmentId,
      supplementId,
      kind: 'audio',
      createdAt: '2026-05-06T13:10:00.000Z',
      finalizedAt: '2026-05-06T13:11:00.000Z',
      updatedAt: '2026-05-06T13:11:00.000Z',
      durationMs: 500,
      nextSequence: 1,
      audioByteLength: backfillReadableSize,
      lastTranscriptionAttempt: 'failed',
    })}\n`
  );

  const supplement = await readFinalizedAudioSegmentSupplementContent({
    assertWorkspaceUsable: () => ({ ok: true }),
    maxBytes: MAX_BACKFILL_AUDIO_READ_BYTES,
    memoryId,
    rootPath,
    segmentId,
    supplementId,
    workspaceId: 'ws_draft',
  });

  assert.equal(supplement.ok, true);
  if (supplement.ok) {
    assert.equal(supplement.audioByteLength, backfillReadableSize);
    assert.equal(supplement.audio.byteLength, backfillReadableSize);
    assert.equal(supplement.lastTranscriptionAttempt, 'failed');
  }

  const tooLargeSegmentId = 'seg_backfill_too_large';
  const tooLargeSegmentDirectory = path.join(
    rootPath,
    'memories',
    memoryId,
    'segments',
    tooLargeSegmentId
  );
  await writeFinalizedAudioSegmentForTest(rootPath, tooLargeSegmentId);
  await truncate(
    path.join(tooLargeSegmentDirectory, 'audio.webm'),
    MAX_BACKFILL_AUDIO_READ_BYTES + 1
  );
  await rewriteObjectManifest(rootPath, 'segments', tooLargeSegmentId, (manifest) => ({
    ...manifest,
    audioByteLength: MAX_BACKFILL_AUDIO_READ_BYTES + 1,
  }));
  const tooLarge = await readFinalizedAudioSegmentContent({
    assertWorkspaceUsable: () => ({ ok: true }),
    maxBytes: MAX_BACKFILL_AUDIO_READ_BYTES,
    memoryId,
    rootPath,
    segmentId: tooLargeSegmentId,
  });

  assert.equal(tooLarge.ok, false);
  if (!tooLarge.ok) {
    assert.equal(tooLarge.error.code, 'ERR_RECORDING_CHUNK_TOO_LARGE');
  }
});

test('finalized audio backfill source can reuse fill-missing transcript preflight', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_backfill_preflight_reuse';
  const memoryId = 'mem_active_draft_clear';
  await writeFinalizedAudioSegmentForTest(rootPath, segmentId);
  await writeFile(
    path.join(rootPath, 'memories', memoryId, 'segments', segmentId, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: 'Active draft clear', kind: 'audio' },
      content: '# Active draft clear\n\n## Transcript\n\nExisting transcript',
    })
  );

  const segment = await readFinalizedAudioSegmentBackfillSource({
    assertWorkspaceUsable: () => ({ ok: true }),
    memoryId,
    rootPath,
    segmentId,
    transcriptReadMode: 'assume-missing',
  });

  assert.equal(segment.ok, true);
  if (segment.ok) {
    try {
      assert.equal(segment.transcript.exists, false);
      assert.equal(segment.audioByteLength, 1);
    } finally {
      segment.dispose();
    }
  }

  const supplementId = 'sup_backfill_preflight_reuse';
  await writeFinalizedAudioSupplementForTest({
    memoryId,
    rootPath,
    segmentId,
    supplementId,
  });
  await writeFile(
    path.join(
      rootPath,
      'memories',
      memoryId,
      'segments',
      segmentId,
      'supplements',
      supplementId,
      'supplement.md'
    ),
    renderWorkspaceMarkdownObject({
      objectType: 'supplement',
      data: { title: 'Supplement', kind: 'audio' },
      content: '# Supplement\n\n## Transcript\n\nExisting supplement transcript',
    })
  );

  const supplement = await readFinalizedAudioSegmentSupplementBackfillSource({
    assertWorkspaceUsable: () => ({ ok: true }),
    memoryId,
    rootPath,
    segmentId,
    supplementId,
    transcriptReadMode: 'assume-missing',
    workspaceId: 'ws_draft',
  });

  assert.equal(supplement.ok, true);
  if (supplement.ok) {
    try {
      assert.equal(supplement.transcript.exists, false);
      assert.equal(supplement.audioByteLength, 1);
    } finally {
      supplement.dispose();
    }
  }
});

test('finalized audio reads recheck duplicate segment validation on every public read', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_active_draft_clear';
  const segmentId = 'seg_duplicate_cache';
  await writeFinalizedAudioSegmentForTest(rootPath, segmentId);
  clearRecordingRuntimeStateForRoot(rootPath);

  let duplicateChecks = 0;
  setBeforeDuplicateRecordingCheckForTest(() => {
    duplicateChecks += 1;
  });
  try {
    const first = await readFinalizedAudioSegmentContent({
      assertWorkspaceUsable: () => ({ ok: true }),
      memoryId,
      rootPath,
      segmentId,
    });
    const second = await readFinalizedAudioSegmentContent({
      assertWorkspaceUsable: () => ({ ok: true }),
      memoryId,
      rootPath,
      segmentId,
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(duplicateChecks, 2);
  } finally {
    setBeforeDuplicateRecordingCheckForTest(null);
  }
});

test('duplicate segment validation scans other Memory segment parents without reparsing each Memory', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_active_draft_clear';
  const segmentId = 'seg_duplicate_linear_scan';
  await writeFinalizedAudioSegmentForTest(rootPath, segmentId);
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_duplicate_linear_other_1',
    title: 'Other one',
    now: '2026-05-17T01:00:00.000Z',
  });
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_duplicate_linear_other_2',
    title: 'Other two',
    now: '2026-05-17T01:01:00.000Z',
  });

  let memoryDirectoryCandidateScans = 0;
  setBeforeMemoryDirectoryCandidateScanForTest(() => {
    memoryDirectoryCandidateScans += 1;
  });
  try {
    const result = await readFinalizedAudioSegmentContent({
      assertWorkspaceUsable: () => ({ ok: true }),
      memoryId,
      rootPath,
      segmentId,
    });

    assert.equal(result.ok, true);
    assert.equal(memoryDirectoryCandidateScans, 1);
  } finally {
    setBeforeMemoryDirectoryCandidateScanForTest(null);
  }
});

test('recording finalize duplicate preflight scans segment parents without reparsing each Memory', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_finalize_duplicate_linear_scan';
  const memoryId = 'mem_finalize_duplicate_linear_target';
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId,
    title: 'Target',
    now: '2026-05-17T01:00:00.000Z',
  });
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_finalize_duplicate_linear_other_1',
    title: 'Other one',
    now: '2026-05-17T01:01:00.000Z',
  });
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_finalize_duplicate_linear_other_2',
    title: 'Other two',
    now: '2026-05-17T01:02:00.000Z',
  });
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => segmentId,
    now: () => '2026-05-17T01:03:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  let duplicatePreflightStarted = false;
  let duplicatePreflightMemoryDirectoryScans = 0;
  setBeforeDuplicateRecordingCheckForTest(() => {
    duplicatePreflightStarted = true;
  });
  setBeforeMemoryDirectoryCandidateScanForTest(() => {
    if (duplicatePreflightStarted) {
      duplicatePreflightMemoryDirectoryScans += 1;
    }
  });
  try {
    const finalized = await finalizeRecordingDraft({
      durationMs: 1000,
      rootPath,
      segmentId,
      memoryId,
      title: 'Target recording',
      now: () => '2026-05-17T01:04:00.000Z',
    });

    assert.equal(finalized.ok, true);
    assert.equal(duplicatePreflightMemoryDirectoryScans, 0);
  } finally {
    setBeforeDuplicateRecordingCheckForTest(null);
    setBeforeMemoryDirectoryCandidateScanForTest(null);
  }
});

test('finalized supplement audio reads reject duplicate parent segment identity', async () => {
  const rootPath = await workspaceRoot();
  const memoryId = 'mem_active_draft_clear';
  const duplicateMemoryId = 'mem_duplicate_parent';
  const segmentId = 'seg_duplicate_parent_for_supplement';
  const supplementId = 'sup_duplicate_parent';
  await writeFinalizedAudioSegmentForTest(rootPath, segmentId);
  await writeFinalizedAudioSupplementForTest({ rootPath, segmentId, supplementId });

  const duplicateMemoryDirectory = path.join(rootPath, 'memories', duplicateMemoryId);
  const duplicateSegmentDirectory = path.join(duplicateMemoryDirectory, 'segments', segmentId);
  await mkdir(duplicateSegmentDirectory, { recursive: true });
  await writeFile(
    path.join(duplicateMemoryDirectory, 'memory.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'memory',
      data: { title: 'Duplicate parent' },
      content: '# Duplicate parent\n',
    })
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'memories', `${duplicateMemoryId}.json`),
    `${JSON.stringify({
      schemaVersion: 1,
      objectType: 'memory',
      memoryId: duplicateMemoryId,
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
    })}\n`
  );
  await writeFile(path.join(duplicateSegmentDirectory, 'audio.webm'), new Uint8Array([1]));
  await writeFile(
    path.join(duplicateSegmentDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title: 'Duplicate parent', kind: 'audio' },
      content: '# Duplicate parent\n\n## Transcript\n\n',
    })
  );
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'segments', `${segmentId}.json`),
    `${JSON.stringify({
      schemaVersion: 1,
      objectType: 'segment',
      workspaceId: 'ws_draft',
      memoryId: duplicateMemoryId,
      segmentId,
      kind: 'audio',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 1,
    })}\n`
  );

  const supplement = await readFinalizedAudioSegmentSupplementContent({
    assertWorkspaceUsable: () => ({ ok: true }),
    memoryId,
    rootPath,
    segmentId,
    supplementId,
    workspaceId: 'ws_draft',
  });

  assert.equal(supplement.ok, false);
  if (!supplement.ok) {
    assert.equal(supplement.error.code, 'ERR_RECORDING_NOT_FOUND');
  }
});

test('recording draft enforces sequence, 1 MiB chunk limit, and finalize waits for append idle', async () => {
  const rootPath = await workspaceRoot();
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260506_000001',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.deepEqual(draft, {
    ok: true,
    segmentId: 'seg_20260506_000001',
    nextSequence: 0,
  });

  assert.equal(
    (
      await appendRecordingAudioChunk({
        rootPath,
        segmentId: 'seg_20260506_000001',
        sequence: 0,
        chunk: new Uint8Array([1, 2, 3]),
      })
    ).ok,
    true
  );

  const replay = await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_000001',
    sequence: 0,
    chunk: new Uint8Array([4]),
  });
  assert.equal(replay.ok, false);
  if (!replay.ok) {
    assert.equal(replay.error.code, 'ERR_RECORDING_SEQUENCE');
  }

  const tooLarge = await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_000001',
    sequence: 1,
    chunk: new Uint8Array(1_048_577),
  });
  assert.equal(tooLarge.ok, false);
  if (!tooLarge.ok) {
    assert.equal(tooLarge.error.code, 'ERR_RECORDING_CHUNK_TOO_LARGE');
  }

  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_20260506_000001',
    title: '第一段录音',
    now: '2026-05-06T13:09:00.000Z',
  });

  assert.deepEqual(
    await finalizeRecordingDraft({
      durationMs: 0,
      rootPath,
      segmentId: 'seg_20260506_000001',
      memoryId: 'mem_20260506_000001',
      title: '第一段录音',
      now: () => '2026-05-06T13:09:00.000Z',
    }),
    {
      ok: true,
      segment: {
        workspaceId: 'ws_draft',
        memoryId: 'mem_20260506_000001',
        segmentId: 'seg_20260506_000001',
        type: 'audio',
        title: '第一段录音',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:09:00.000Z',
        durationMs: 0,
        audioByteLength: 3,
        lastTranscriptionAttempt: 'never',
        transcript: { exists: false },
        supplementCount: 0,
        supplements: [],
        contentTabOrder: ['segment'],
      },
      memory: {
        memoryId: 'mem_20260506_000001',
        title: '第一段录音',
        createdAt: '2026-05-06T13:09:00.000Z',
        updatedAt: '2026-05-06T13:09:00.000Z',
        segmentCount: 1,
        audioSegmentCount: 1,
        noteSegmentCount: 0,
        audioDurationMs: 0,
        audioByteLength: 3,
        hasAudioTranscript: false,
        hasAnyNote: false,
        supplementCount: 0,
      },
    }
  );

  const segmentDirectory = await findSegmentDirectoryById(rootPath, 'seg_20260506_000001');
  const finalizedMarkdown = await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8');
  const finalizedSemantic = parseWorkspaceMarkdownObject({
    objectType: 'segment',
    markdown: finalizedMarkdown,
  });
  const finalizedManifest = JSON.parse(
    await readFile(
      path.join(rootPath, '.reo', 'objects', 'segments', 'seg_20260506_000001.json'),
      'utf8'
    )
  );
  const audio = await stat(path.join(segmentDirectory, 'audio.webm'));
  const index = JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8'));
  assert.equal(finalizedManifest.memoryId, 'mem_20260506_000001');
  assert.equal(finalizedManifest.audioByteLength, 3);
  assert.equal(finalizedSemantic.data.title, '第一段录音');
  assert.equal(audio.size, 3);
  assert.deepEqual(index.memories, [
    {
      memoryId: 'mem_20260506_000001',
      title: '第一段录音',
      createdAt: '2026-05-06T13:09:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      segmentCount: 1,
      audioSegmentCount: 1,
      noteSegmentCount: 0,
      audioDurationMs: 0,
      audioByteLength: 3,
      hasAudioTranscript: false,
      hasAnyNote: false,
      supplementCount: 0,
    },
  ]);

  const lateAppend = await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_000001',
    sequence: 1,
    chunk: new Uint8Array([9]),
  });
  assert.equal(lateAppend.ok, false);
  if (!lateAppend.ok) {
    assert.equal(lateAppend.error.code, 'ERR_RECORDING_FINALIZED');
  }

  const markdownAfterLateAppend = await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8');
  const manifestAfterLateAppend = JSON.parse(
    await readFile(
      path.join(rootPath, '.reo', 'objects', 'segments', 'seg_20260506_000001.json'),
      'utf8'
    )
  );
  assert.equal(markdownAfterLateAppend, finalizedMarkdown);
  assert.deepEqual(manifestAfterLateAppend, finalizedManifest);
});

test('recording finalize writes last transcription attempt into segment and supplement manifests', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_finalize_attempt',
    title: 'Finalize attempt',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260506_attempt_failed',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_attempt_failed',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalizedSegment = await finalizeRecordingDraft({
    durationMs: 3000,
    rootPath,
    segmentId: 'seg_20260506_attempt_failed',
    memoryId: 'mem_finalize_attempt',
    title: 'Attempt failed',
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalizedSegment.ok, true);

  const segmentManifest = await readObjectManifest(
    rootPath,
    'segments',
    'seg_20260506_attempt_failed'
  );
  assert.equal(segmentManifest['lastTranscriptionAttempt'], 'failed');

  const supplementDraft = await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_finalize_attempt',
    segmentId: 'seg_20260506_attempt_failed',
    createSupplementId: () => 'sup_20260506_attempt_never',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.equal(supplementDraft.ok, true);
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId: 'sup_20260506_attempt_never',
    sequence: 0,
    chunk: new Uint8Array([4, 5]),
  });

  const finalizedSupplement = await finalizeSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_finalize_attempt',
    segmentId: 'seg_20260506_attempt_failed',
    supplementId: 'sup_20260506_attempt_never',
    title: 'Attempt never',
    durationMs: 2000,
    lastTranscriptionAttemptOnFinalize: 'never',
    now: () => '2026-05-06T13:13:00.000Z',
  });
  assert.equal(finalizedSupplement.ok, true);

  const supplementManifest = await readObjectManifest(
    rootPath,
    'supplements',
    'sup_20260506_attempt_never'
  );
  assert.equal(supplementManifest['lastTranscriptionAttempt'], 'never');
});

test('transcript save marks segment and supplement transcription attempts successful', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_transcript_save_success',
    title: 'Transcript save success',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260516_transcript_save_success',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260516_transcript_save_success',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const finalizedSegment = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    segmentId: 'seg_20260516_transcript_save_success',
    memoryId: 'mem_transcript_save_success',
    title: 'Segment transcript save',
    durationMs: 3000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalizedSegment.ok, true);

  const savedSegment = await saveRecordingMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_transcript_save_success',
    segmentId: 'seg_20260516_transcript_save_success',
    fileName: 'transcript.md',
    markdown: 'Segment transcript text',
  });

  assert.equal(savedSegment.ok, true);
  assert.equal(
    (await readObjectManifest(rootPath, 'segments', 'seg_20260516_transcript_save_success'))[
      'lastTranscriptionAttempt'
    ],
    'success'
  );

  const supplementDraft = await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_transcript_save_success',
    segmentId: 'seg_20260516_transcript_save_success',
    createSupplementId: () => 'sup_20260516_transcript_save_success',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.equal(supplementDraft.ok, true);
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId: 'sup_20260516_transcript_save_success',
    sequence: 0,
    chunk: new Uint8Array([4, 5]),
  });
  const finalizedSupplement = await finalizeSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_transcript_save_success',
    segmentId: 'seg_20260516_transcript_save_success',
    supplementId: 'sup_20260516_transcript_save_success',
    title: 'Supplement transcript save',
    durationMs: 2000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:13:00.000Z',
  });
  assert.equal(finalizedSupplement.ok, true);

  const savedSupplement = await saveSegmentSupplementMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_transcript_save_success',
    segmentId: 'seg_20260516_transcript_save_success',
    supplementId: 'sup_20260516_transcript_save_success',
    markdown: 'Supplement transcript text',
  });

  assert.equal(savedSupplement.ok, true);
  assert.equal(
    (await readObjectManifest(rootPath, 'supplements', 'sup_20260516_transcript_save_success'))[
      'lastTranscriptionAttempt'
    ],
    'success'
  );
});

test('backfill transcript save refuses to overwrite an existing transcript', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_backfill_no_overwrite',
    title: 'Backfill no overwrite',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260516_backfill_no_overwrite',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260516_backfill_no_overwrite',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const finalizedSegment = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    segmentId: 'seg_20260516_backfill_no_overwrite',
    memoryId: 'mem_backfill_no_overwrite',
    title: 'Segment backfill no overwrite',
    durationMs: 3000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalizedSegment.ok, true);
  const initialSegmentSave = await saveRecordingMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_backfill_no_overwrite',
    segmentId: 'seg_20260516_backfill_no_overwrite',
    fileName: 'transcript.md',
    markdown: 'User segment transcript',
  });
  assert.equal(initialSegmentSave.ok, true);

  const staleSegmentBackfill = await saveRecordingMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_backfill_no_overwrite',
    segmentId: 'seg_20260516_backfill_no_overwrite',
    fileName: 'transcript.md',
    markdown: 'Stale backfill transcript',
    requireTranscriptMissing: true,
  });
  assert.equal(staleSegmentBackfill.ok, false);
  if (!staleSegmentBackfill.ok) {
    assert.equal(staleSegmentBackfill.error.code, 'ERR_BACKFILL_TARGET_NOT_ELIGIBLE');
  }
  const segmentDirectory = await findSegmentDirectoryById(
    rootPath,
    'seg_20260516_backfill_no_overwrite'
  );
  assert.match(await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'), /User segment/);
  assert.doesNotMatch(
    await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'),
    /Stale backfill/
  );

  const supplementDraft = await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_backfill_no_overwrite',
    segmentId: 'seg_20260516_backfill_no_overwrite',
    createSupplementId: () => 'sup_20260516_backfill_no_overwrite',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.equal(supplementDraft.ok, true);
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId: 'sup_20260516_backfill_no_overwrite',
    sequence: 0,
    chunk: new Uint8Array([4, 5]),
  });
  const finalizedSupplement = await finalizeSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_backfill_no_overwrite',
    segmentId: 'seg_20260516_backfill_no_overwrite',
    supplementId: 'sup_20260516_backfill_no_overwrite',
    title: 'Supplement backfill no overwrite',
    durationMs: 2000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:13:00.000Z',
  });
  assert.equal(finalizedSupplement.ok, true);
  const initialSupplementSave = await saveSegmentSupplementMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_backfill_no_overwrite',
    segmentId: 'seg_20260516_backfill_no_overwrite',
    supplementId: 'sup_20260516_backfill_no_overwrite',
    markdown: 'User supplement transcript',
  });
  assert.equal(initialSupplementSave.ok, true);

  const staleSupplementBackfill = await saveSegmentSupplementMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_backfill_no_overwrite',
    segmentId: 'seg_20260516_backfill_no_overwrite',
    supplementId: 'sup_20260516_backfill_no_overwrite',
    markdown: 'Stale supplement backfill transcript',
    requireTranscriptMissing: true,
  });
  assert.equal(staleSupplementBackfill.ok, false);
  if (!staleSupplementBackfill.ok) {
    assert.equal(staleSupplementBackfill.error.code, 'ERR_BACKFILL_TARGET_NOT_ELIGIBLE');
  }
  const supplementDirectory = await findSupplementDirectoryById(
    segmentDirectory,
    'sup_20260516_backfill_no_overwrite'
  );
  assert.match(
    await readFile(path.join(supplementDirectory, 'supplement.md'), 'utf8'),
    /User supplement/
  );
  assert.doesNotMatch(
    await readFile(path.join(supplementDirectory, 'supplement.md'), 'utf8'),
    /Stale supplement/
  );
});

test('regenerate transcript save overwrites only when the transcript digest still matches', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_backfill_digest_guard',
    title: 'Backfill digest guard',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260516_backfill_digest_guard',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260516_backfill_digest_guard',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const finalizedSegment = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    segmentId: 'seg_20260516_backfill_digest_guard',
    memoryId: 'mem_backfill_digest_guard',
    title: 'Segment digest guard',
    durationMs: 3000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalizedSegment.ok, true);
  const initialSegmentSave = await saveRecordingMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_backfill_digest_guard',
    segmentId: 'seg_20260516_backfill_digest_guard',
    fileName: 'transcript.md',
    markdown: 'User segment transcript',
  });
  assert.equal(initialSegmentSave.ok, true);

  const changedSegmentBackfill = await saveRecordingMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_backfill_digest_guard',
    segmentId: 'seg_20260516_backfill_digest_guard',
    fileName: 'transcript.md',
    markdown: 'Regenerated segment transcript',
    allowOverwrite: true,
    expectedTranscriptDigest: transcriptDigest('Different segment transcript'),
  });
  assert.equal(changedSegmentBackfill.ok, false);
  if (!changedSegmentBackfill.ok) {
    assert.equal(changedSegmentBackfill.error.code, 'ERR_BACKFILL_TRANSCRIPT_CHANGED');
  }
  const segmentDirectory = await findSegmentDirectoryById(
    rootPath,
    'seg_20260516_backfill_digest_guard'
  );
  assert.match(await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'), /User segment/);

  const overwrittenSegment = await saveRecordingMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_backfill_digest_guard',
    segmentId: 'seg_20260516_backfill_digest_guard',
    fileName: 'transcript.md',
    markdown: 'Regenerated segment transcript',
    allowOverwrite: true,
    expectedTranscriptDigest: transcriptDigest('User segment transcript'),
  });
  assert.equal(overwrittenSegment.ok, true);
  assert.match(
    await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'),
    /Regenerated segment/
  );

  const supplementDraft = await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_backfill_digest_guard',
    segmentId: 'seg_20260516_backfill_digest_guard',
    createSupplementId: () => 'sup_20260516_backfill_digest_guard',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.equal(supplementDraft.ok, true);
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId: 'sup_20260516_backfill_digest_guard',
    sequence: 0,
    chunk: new Uint8Array([4, 5]),
  });
  const finalizedSupplement = await finalizeSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_backfill_digest_guard',
    segmentId: 'seg_20260516_backfill_digest_guard',
    supplementId: 'sup_20260516_backfill_digest_guard',
    title: 'Supplement digest guard',
    durationMs: 2000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:13:00.000Z',
  });
  assert.equal(finalizedSupplement.ok, true);
  const initialSupplementSave = await saveSegmentSupplementMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_backfill_digest_guard',
    segmentId: 'seg_20260516_backfill_digest_guard',
    supplementId: 'sup_20260516_backfill_digest_guard',
    markdown: 'User supplement transcript',
  });
  assert.equal(initialSupplementSave.ok, true);

  const changedSupplementBackfill = await saveSegmentSupplementMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_backfill_digest_guard',
    segmentId: 'seg_20260516_backfill_digest_guard',
    supplementId: 'sup_20260516_backfill_digest_guard',
    markdown: 'Regenerated supplement transcript',
    allowOverwrite: true,
    expectedTranscriptDigest: transcriptDigest('Different supplement transcript'),
  });
  assert.equal(changedSupplementBackfill.ok, false);
  if (!changedSupplementBackfill.ok) {
    assert.equal(changedSupplementBackfill.error.code, 'ERR_BACKFILL_TRANSCRIPT_CHANGED');
  }
  const supplementDirectory = await findSupplementDirectoryById(
    segmentDirectory,
    'sup_20260516_backfill_digest_guard'
  );
  assert.match(
    await readFile(path.join(supplementDirectory, 'supplement.md'), 'utf8'),
    /User supplement/
  );

  const overwrittenSupplement = await saveSegmentSupplementMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_backfill_digest_guard',
    segmentId: 'seg_20260516_backfill_digest_guard',
    supplementId: 'sup_20260516_backfill_digest_guard',
    markdown: 'Regenerated supplement transcript',
    allowOverwrite: true,
    expectedTranscriptDigest: transcriptDigest('User supplement transcript'),
  });
  assert.equal(overwrittenSupplement.ok, true);
  assert.match(
    await readFile(path.join(supplementDirectory, 'supplement.md'), 'utf8'),
    /Regenerated supplement/
  );
});

test('regenerate transcript save does not mark success when index refresh fails', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_regenerate_index_failure',
    title: 'Regenerate index failure',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260518_regenerate_index_failure',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260518_regenerate_index_failure',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const finalizedSegment = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    segmentId: 'seg_20260518_regenerate_index_failure',
    memoryId: 'mem_regenerate_index_failure',
    title: 'Regenerate index failure segment',
    durationMs: 3000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalizedSegment.ok, true);
  const initialSegmentSave = await saveRecordingMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_index_failure',
    segmentId: 'seg_20260518_regenerate_index_failure',
    fileName: 'transcript.md',
    markdown: 'User segment transcript',
  });
  assert.equal(initialSegmentSave.ok, true);
  await rewriteObjectManifest(
    rootPath,
    'segments',
    'seg_20260518_regenerate_index_failure',
    (manifest) => ({
      ...manifest,
      lastTranscriptionAttempt: 'failed',
    })
  );

  setBeforeMemoryIndexEntryReadForTest(() => {
    throw new Error('index read blocked');
  });
  try {
    const failedSegmentRegenerate = await saveRecordingMarkdown({
      rootPath,
      workspaceId: 'ws_draft',
      memoryId: 'mem_regenerate_index_failure',
      segmentId: 'seg_20260518_regenerate_index_failure',
      fileName: 'transcript.md',
      markdown: 'Regenerated segment transcript',
      allowOverwrite: true,
      expectedTranscriptDigest: transcriptDigest('User segment transcript'),
    });

    assert.equal(failedSegmentRegenerate.ok, false);
    if (!failedSegmentRegenerate.ok) {
      assert.equal(failedSegmentRegenerate.error.dataRetention, 'previous-file-preserved');
    }
  } finally {
    setBeforeMemoryIndexEntryReadForTest(null);
  }

  const segmentDirectory = await findSegmentDirectoryById(
    rootPath,
    'seg_20260518_regenerate_index_failure'
  );
  const segmentMarkdown = await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8');
  assert.match(segmentMarkdown, /User segment transcript/);
  assert.doesNotMatch(segmentMarkdown, /Regenerated segment transcript/);
  assert.equal(
    (await readObjectManifest(rootPath, 'segments', 'seg_20260518_regenerate_index_failure'))[
      'lastTranscriptionAttempt'
    ],
    'failed'
  );

  const supplementDraft = await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_index_failure',
    segmentId: 'seg_20260518_regenerate_index_failure',
    createSupplementId: () => 'sup_20260518_regenerate_index_failure',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.equal(supplementDraft.ok, true);
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId: 'sup_20260518_regenerate_index_failure',
    sequence: 0,
    chunk: new Uint8Array([4, 5]),
  });
  const finalizedSupplement = await finalizeSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_index_failure',
    segmentId: 'seg_20260518_regenerate_index_failure',
    supplementId: 'sup_20260518_regenerate_index_failure',
    title: 'Regenerate index failure supplement',
    durationMs: 2000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:13:00.000Z',
  });
  assert.equal(finalizedSupplement.ok, true);
  const initialSupplementSave = await saveSegmentSupplementMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_index_failure',
    segmentId: 'seg_20260518_regenerate_index_failure',
    supplementId: 'sup_20260518_regenerate_index_failure',
    markdown: 'User supplement transcript',
  });
  assert.equal(initialSupplementSave.ok, true);
  await rewriteObjectManifest(
    rootPath,
    'supplements',
    'sup_20260518_regenerate_index_failure',
    (manifest) => ({
      ...manifest,
      lastTranscriptionAttempt: 'failed',
    })
  );

  setBeforeMemoryIndexEntryReadForTest(() => {
    throw new Error('index read blocked');
  });
  try {
    const failedSupplementRegenerate = await saveSegmentSupplementMarkdown({
      rootPath,
      workspaceId: 'ws_draft',
      memoryId: 'mem_regenerate_index_failure',
      segmentId: 'seg_20260518_regenerate_index_failure',
      supplementId: 'sup_20260518_regenerate_index_failure',
      markdown: 'Regenerated supplement transcript',
      allowOverwrite: true,
      expectedTranscriptDigest: transcriptDigest('User supplement transcript'),
    });

    assert.equal(failedSupplementRegenerate.ok, false);
    if (!failedSupplementRegenerate.ok) {
      assert.equal(failedSupplementRegenerate.error.dataRetention, 'previous-file-preserved');
    }
  } finally {
    setBeforeMemoryIndexEntryReadForTest(null);
  }

  const supplementDirectory = await findSupplementDirectoryById(
    segmentDirectory,
    'sup_20260518_regenerate_index_failure'
  );
  const supplementMarkdown = await readFile(
    path.join(supplementDirectory, 'supplement.md'),
    'utf8'
  );
  assert.match(supplementMarkdown, /User supplement transcript/);
  assert.doesNotMatch(supplementMarkdown, /Regenerated supplement transcript/);
  assert.equal(
    (await readObjectManifest(rootPath, 'supplements', 'sup_20260518_regenerate_index_failure'))[
      'lastTranscriptionAttempt'
    ],
    'failed'
  );
});

test('recording draft regenerate segment rollback preserves transcript when manifest success fails', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_regenerate_segment_manifest_failure',
    title: 'Regenerate segment manifest failure',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260516_regenerate_manifest_failure',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260516_regenerate_manifest_failure',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const finalizedSegment = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    segmentId: 'seg_20260516_regenerate_manifest_failure',
    memoryId: 'mem_regenerate_segment_manifest_failure',
    title: 'Regenerate manifest failure',
    durationMs: 3000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalizedSegment.ok, true);
  const initialSave = await saveRecordingMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_segment_manifest_failure',
    segmentId: 'seg_20260516_regenerate_manifest_failure',
    fileName: 'transcript.md',
    markdown: 'User segment transcript',
  });
  assert.equal(initialSave.ok, true);
  await rewriteObjectManifest(
    rootPath,
    'segments',
    'seg_20260516_regenerate_manifest_failure',
    (manifest) => ({
      ...manifest,
      lastTranscriptionAttempt: 'failed',
    })
  );

  setBeforeMarkdownWriteForTest(async () => {
    await rewriteObjectManifest(
      rootPath,
      'segments',
      'seg_20260516_regenerate_manifest_failure',
      (manifest) => ({
        ...manifest,
        workspaceId: 'ws_replaced_owner',
      })
    );
  });
  try {
    const failedRegenerate = await saveRecordingMarkdown({
      rootPath,
      workspaceId: 'ws_draft',
      memoryId: 'mem_regenerate_segment_manifest_failure',
      segmentId: 'seg_20260516_regenerate_manifest_failure',
      fileName: 'transcript.md',
      markdown: 'Regenerated segment transcript',
      allowOverwrite: true,
      expectedTranscriptDigest: transcriptDigest('User segment transcript'),
    });

    assert.equal(failedRegenerate.ok, false);
    if (!failedRegenerate.ok) {
      assert.equal(failedRegenerate.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
    }
  } finally {
    setBeforeMarkdownWriteForTest(null);
  }

  const segmentDirectory = await findSegmentDirectoryById(
    rootPath,
    'seg_20260516_regenerate_manifest_failure'
  );
  const segmentMarkdown = await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8');
  assert.match(segmentMarkdown, /User segment transcript/);
  assert.doesNotMatch(segmentMarkdown, /Regenerated segment transcript/);
  assert.equal(
    (await readObjectManifest(rootPath, 'segments', 'seg_20260516_regenerate_manifest_failure'))[
      'lastTranscriptionAttempt'
    ],
    'failed'
  );
});

test('recording draft fill-missing rollback refreshes index after manifest success fails', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_fill_missing_manifest_failure',
    title: 'Fill missing manifest failure',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260518_fill_missing_manifest_failure',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260518_fill_missing_manifest_failure',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const finalizedSegment = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    segmentId: 'seg_20260518_fill_missing_manifest_failure',
    memoryId: 'mem_fill_missing_manifest_failure',
    title: 'Fill missing manifest failure segment',
    durationMs: 3000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalizedSegment.ok, true);

  let segmentIndexRefreshes = 0;
  setBeforeMemoryIndexEntryReadForTest(() => {
    segmentIndexRefreshes += 1;
  });
  setBeforeMarkdownWriteForTest(async () => {
    await rewriteObjectManifest(
      rootPath,
      'segments',
      'seg_20260518_fill_missing_manifest_failure',
      (manifest) => ({
        ...manifest,
        workspaceId: 'ws_replaced_owner',
      })
    );
  });
  try {
    const failedSegmentSave = await saveRecordingMarkdown({
      rootPath,
      workspaceId: 'ws_draft',
      memoryId: 'mem_fill_missing_manifest_failure',
      segmentId: 'seg_20260518_fill_missing_manifest_failure',
      fileName: 'transcript.md',
      markdown: 'Backfilled segment transcript',
      requireTranscriptMissing: true,
    });

    assert.equal(failedSegmentSave.ok, false);
    if (!failedSegmentSave.ok) {
      assert.equal(failedSegmentSave.error.dataRetention, 'previous-file-preserved');
    }
  } finally {
    setBeforeMarkdownWriteForTest(null);
    setBeforeMemoryIndexEntryReadForTest(null);
  }

  const segmentDirectory = await findSegmentDirectoryById(
    rootPath,
    'seg_20260518_fill_missing_manifest_failure'
  );
  assert.equal(segmentIndexRefreshes, 2);
  assert.doesNotMatch(
    await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'),
    /Backfilled segment transcript/
  );
  const indexAfterSegmentRollback = JSON.parse(
    await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8')
  ) as {
    readonly memories?: readonly {
      readonly memoryId: string;
      readonly hasAudioTranscript: boolean;
    }[];
  };
  assert.notEqual(
    indexAfterSegmentRollback.memories?.find(
      (candidate) => candidate.memoryId === 'mem_fill_missing_manifest_failure'
    )?.hasAudioTranscript,
    true
  );
  await rewriteObjectManifest(
    rootPath,
    'segments',
    'seg_20260518_fill_missing_manifest_failure',
    (manifest) => ({
      ...manifest,
      workspaceId: 'ws_draft',
    })
  );

  const supplementDraft = await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_fill_missing_manifest_failure',
    segmentId: 'seg_20260518_fill_missing_manifest_failure',
    createSupplementId: () => 'sup_20260518_fill_missing_manifest_failure',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.equal(supplementDraft.ok, true);
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId: 'sup_20260518_fill_missing_manifest_failure',
    sequence: 0,
    chunk: new Uint8Array([4, 5]),
  });
  const finalizedSupplement = await finalizeSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_fill_missing_manifest_failure',
    segmentId: 'seg_20260518_fill_missing_manifest_failure',
    supplementId: 'sup_20260518_fill_missing_manifest_failure',
    title: 'Fill missing manifest failure supplement',
    durationMs: 2000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:13:00.000Z',
  });
  assert.equal(finalizedSupplement.ok, true);

  let supplementIndexRefreshes = 0;
  setBeforeMemoryIndexEntryReadForTest(() => {
    supplementIndexRefreshes += 1;
  });
  setBeforeMarkdownWriteForTest(async () => {
    await rewriteObjectManifest(
      rootPath,
      'supplements',
      'sup_20260518_fill_missing_manifest_failure',
      (manifest) => ({
        ...manifest,
        segmentId: 'seg_replaced_owner',
      })
    );
  });
  try {
    const failedSupplementSave = await saveSegmentSupplementMarkdown({
      rootPath,
      workspaceId: 'ws_draft',
      memoryId: 'mem_fill_missing_manifest_failure',
      segmentId: 'seg_20260518_fill_missing_manifest_failure',
      supplementId: 'sup_20260518_fill_missing_manifest_failure',
      markdown: 'Backfilled supplement transcript',
      requireTranscriptMissing: true,
    });

    assert.equal(failedSupplementSave.ok, false);
    if (!failedSupplementSave.ok) {
      assert.equal(failedSupplementSave.error.dataRetention, 'previous-file-preserved');
    }
  } finally {
    setBeforeMarkdownWriteForTest(null);
    setBeforeMemoryIndexEntryReadForTest(null);
  }

  const supplementDirectory = await findSupplementDirectoryById(
    segmentDirectory,
    'sup_20260518_fill_missing_manifest_failure'
  );
  assert.equal(supplementIndexRefreshes, 2);
  assert.doesNotMatch(
    await readFile(path.join(supplementDirectory, 'supplement.md'), 'utf8'),
    /Backfilled supplement transcript/
  );
  const detailAfterSupplementRollback = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_fill_missing_manifest_failure',
  });
  assert.equal(detailAfterSupplementRollback.ok, true);
  if (detailAfterSupplementRollback.ok) {
    const rolledBackSupplement = detailAfterSupplementRollback.value.segments
      .find((candidate) => candidate.segmentId === 'seg_20260518_fill_missing_manifest_failure')
      ?.supplements.find(
        (candidate) => candidate.supplementId === 'sup_20260518_fill_missing_manifest_failure'
      );
    if (rolledBackSupplement) {
      assert.equal(rolledBackSupplement.type, 'audio');
      assert.notEqual(rolledBackSupplement.transcript.exists, true);
    }
  }
});

test('recording draft regenerate segment rollback preserves transcript when index refresh fails', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_regenerate_segment_rollback_failure',
    title: 'Regenerate segment rollback failure',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260516_regenerate_rollback_failure',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260516_regenerate_rollback_failure',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const finalizedSegment = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    segmentId: 'seg_20260516_regenerate_rollback_failure',
    memoryId: 'mem_regenerate_segment_rollback_failure',
    title: 'Regenerate rollback failure',
    durationMs: 3000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalizedSegment.ok, true);
  const initialSave = await saveRecordingMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_segment_rollback_failure',
    segmentId: 'seg_20260516_regenerate_rollback_failure',
    fileName: 'transcript.md',
    markdown: 'User segment transcript',
  });
  assert.equal(initialSave.ok, true);
  await rewriteObjectManifest(
    rootPath,
    'segments',
    'seg_20260516_regenerate_rollback_failure',
    (manifest) => ({
      ...manifest,
      lastTranscriptionAttempt: 'failed',
    })
  );

  let atomicCommitCount = 0;
  setBeforeMarkdownWriteForTest(async () => {
    await rewriteObjectManifest(
      rootPath,
      'segments',
      'seg_20260516_regenerate_rollback_failure',
      (manifest) => ({
        ...manifest,
        workspaceId: 'ws_replaced_owner',
      })
    );
  });
  setBeforeAtomicWorkspaceFileCommitForTest(() => {
    atomicCommitCount += 1;
    if (atomicCommitCount === 2) {
      throw new Error('rollback write blocked');
    }
  });
  try {
    const failedRegenerate = await saveRecordingMarkdown({
      rootPath,
      workspaceId: 'ws_draft',
      memoryId: 'mem_regenerate_segment_rollback_failure',
      segmentId: 'seg_20260516_regenerate_rollback_failure',
      fileName: 'transcript.md',
      markdown: 'Regenerated segment transcript',
      allowOverwrite: true,
      expectedTranscriptDigest: transcriptDigest('User segment transcript'),
    });

    assert.equal(failedRegenerate.ok, false);
    if (!failedRegenerate.ok) {
      assert.equal(failedRegenerate.error.code, 'ERR_WORKSPACE_UPDATE_FAILED');
      assert.equal(failedRegenerate.error.dataRetention, 'previous-file-preserved');
    }
  } finally {
    setBeforeMarkdownWriteForTest(null);
    setBeforeAtomicWorkspaceFileCommitForTest(null);
  }

  const segmentDirectory = await findSegmentDirectoryById(
    rootPath,
    'seg_20260516_regenerate_rollback_failure'
  );
  const segmentMarkdown = await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8');
  assert.ok(atomicCommitCount >= 1);
  assert.match(segmentMarkdown, /User segment transcript/);
  assert.doesNotMatch(segmentMarkdown, /Regenerated segment transcript/);
});

test('recording draft regenerate supplement rollback preserves transcript when manifest success fails', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_regenerate_supplement_manifest_failure',
    title: 'Regenerate supplement manifest failure',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260516_regenerate_supplement_parent',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260516_regenerate_supplement_parent',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const finalizedSegment = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    segmentId: 'seg_20260516_regenerate_supplement_parent',
    memoryId: 'mem_regenerate_supplement_manifest_failure',
    title: 'Regenerate supplement parent',
    durationMs: 3000,
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalizedSegment.ok, true);
  const supplementDraft = await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_supplement_manifest_failure',
    segmentId: 'seg_20260516_regenerate_supplement_parent',
    createSupplementId: () => 'sup_20260516_regenerate_manifest_failure',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.equal(supplementDraft.ok, true);
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId: 'sup_20260516_regenerate_manifest_failure',
    sequence: 0,
    chunk: new Uint8Array([4, 5]),
  });
  const finalizedSupplement = await finalizeSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_supplement_manifest_failure',
    segmentId: 'seg_20260516_regenerate_supplement_parent',
    supplementId: 'sup_20260516_regenerate_manifest_failure',
    title: 'Regenerate manifest failure supplement',
    durationMs: 2000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:13:00.000Z',
  });
  assert.equal(finalizedSupplement.ok, true);
  const initialSave = await saveSegmentSupplementMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_supplement_manifest_failure',
    segmentId: 'seg_20260516_regenerate_supplement_parent',
    supplementId: 'sup_20260516_regenerate_manifest_failure',
    markdown: 'User supplement transcript',
  });
  assert.equal(initialSave.ok, true);
  await rewriteObjectManifest(
    rootPath,
    'supplements',
    'sup_20260516_regenerate_manifest_failure',
    (manifest) => ({
      ...manifest,
      lastTranscriptionAttempt: 'failed',
    })
  );

  setBeforeMarkdownWriteForTest(async () => {
    await rewriteObjectManifest(
      rootPath,
      'supplements',
      'sup_20260516_regenerate_manifest_failure',
      (manifest) => ({
        ...manifest,
        segmentId: 'seg_replaced_owner',
      })
    );
  });
  try {
    const failedRegenerate = await saveSegmentSupplementMarkdown({
      rootPath,
      workspaceId: 'ws_draft',
      memoryId: 'mem_regenerate_supplement_manifest_failure',
      segmentId: 'seg_20260516_regenerate_supplement_parent',
      supplementId: 'sup_20260516_regenerate_manifest_failure',
      markdown: 'Regenerated supplement transcript',
      allowOverwrite: true,
      expectedTranscriptDigest: transcriptDigest('User supplement transcript'),
    });

    assert.equal(failedRegenerate.ok, false);
  } finally {
    setBeforeMarkdownWriteForTest(null);
  }

  const segmentDirectory = await findSegmentDirectoryById(
    rootPath,
    'seg_20260516_regenerate_supplement_parent'
  );
  const supplementDirectory = await findSupplementDirectoryById(
    segmentDirectory,
    'sup_20260516_regenerate_manifest_failure'
  );
  const supplementMarkdown = await readFile(
    path.join(supplementDirectory, 'supplement.md'),
    'utf8'
  );
  assert.match(supplementMarkdown, /User supplement transcript/);
  assert.doesNotMatch(supplementMarkdown, /Regenerated supplement transcript/);
  assert.equal(
    (await readObjectManifest(rootPath, 'supplements', 'sup_20260516_regenerate_manifest_failure'))[
      'lastTranscriptionAttempt'
    ],
    'failed'
  );
});

test('recording draft regenerate save checks abort before transcript re-read and file write', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_regenerate_abort_checks',
    title: 'Regenerate abort checks',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260516_regenerate_abort_checks',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260516_regenerate_abort_checks',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const finalizedSegment = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    segmentId: 'seg_20260516_regenerate_abort_checks',
    memoryId: 'mem_regenerate_abort_checks',
    title: 'Regenerate abort checks',
    durationMs: 3000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalizedSegment.ok, true);
  const initialSegmentSave = await saveRecordingMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_abort_checks',
    segmentId: 'seg_20260516_regenerate_abort_checks',
    fileName: 'transcript.md',
    markdown: 'User segment transcript',
  });
  assert.equal(initialSegmentSave.ok, true);

  const segmentAbortBeforeReadInput: Parameters<typeof saveRecordingMarkdown>[0] & {
    readonly isAbortRequested: () => boolean;
  } = {
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_abort_checks',
    segmentId: 'seg_20260516_regenerate_abort_checks',
    fileName: 'transcript.md',
    markdown: 'Regenerated segment transcript',
    allowOverwrite: true,
    expectedTranscriptDigest: transcriptDigest('User segment transcript'),
    isAbortRequested: () => true,
  };
  const abortedBeforeRead = await saveRecordingMarkdown(segmentAbortBeforeReadInput);
  assert.equal(abortedBeforeRead.ok, false);
  if (!abortedBeforeRead.ok) {
    assert.equal(abortedBeforeRead.error.code, 'ERR_BACKFILL_UNAVAILABLE');
  }

  let segmentAbortChecks = 0;
  const segmentAbortBeforeWriteInput: Parameters<typeof saveRecordingMarkdown>[0] & {
    readonly isAbortRequested: () => boolean;
  } = {
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_abort_checks',
    segmentId: 'seg_20260516_regenerate_abort_checks',
    fileName: 'transcript.md',
    markdown: 'Regenerated segment transcript',
    allowOverwrite: true,
    expectedTranscriptDigest: transcriptDigest('User segment transcript'),
    isAbortRequested: () => {
      segmentAbortChecks += 1;
      return segmentAbortChecks >= 2;
    },
  };
  const abortedBeforeWrite = await saveRecordingMarkdown(segmentAbortBeforeWriteInput);
  assert.equal(abortedBeforeWrite.ok, false);
  if (!abortedBeforeWrite.ok) {
    assert.equal(abortedBeforeWrite.error.code, 'ERR_BACKFILL_UNAVAILABLE');
  }

  const segmentDirectory = await findSegmentDirectoryById(
    rootPath,
    'seg_20260516_regenerate_abort_checks'
  );
  const segmentMarkdown = await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8');
  assert.equal(segmentAbortChecks, 2);
  assert.match(segmentMarkdown, /User segment transcript/);
  assert.doesNotMatch(segmentMarkdown, /Regenerated segment transcript/);
});

test('recording draft regenerate save checks abort inside atomic markdown writes', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_regenerate_atomic_abort',
    title: 'Regenerate atomic abort',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260516_regenerate_atomic_abort',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260516_regenerate_atomic_abort',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const finalizedSegment = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    segmentId: 'seg_20260516_regenerate_atomic_abort',
    memoryId: 'mem_regenerate_atomic_abort',
    title: 'Regenerate atomic abort',
    durationMs: 3000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalizedSegment.ok, true);
  const initialSegmentSave = await saveRecordingMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_atomic_abort',
    segmentId: 'seg_20260516_regenerate_atomic_abort',
    fileName: 'transcript.md',
    markdown: 'User segment transcript',
  });
  assert.equal(initialSegmentSave.ok, true);
  const supplementDraft = await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_atomic_abort',
    segmentId: 'seg_20260516_regenerate_atomic_abort',
    createSupplementId: () => 'sup_20260516_regenerate_atomic_abort',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.equal(supplementDraft.ok, true);
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId: 'sup_20260516_regenerate_atomic_abort',
    sequence: 0,
    chunk: new Uint8Array([4, 5]),
  });
  const finalizedSupplement = await finalizeSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_atomic_abort',
    segmentId: 'seg_20260516_regenerate_atomic_abort',
    supplementId: 'sup_20260516_regenerate_atomic_abort',
    title: 'Regenerate atomic abort supplement',
    durationMs: 2000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:13:00.000Z',
  });
  assert.equal(finalizedSupplement.ok, true);
  const initialSupplementSave = await saveSegmentSupplementMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_regenerate_atomic_abort',
    segmentId: 'seg_20260516_regenerate_atomic_abort',
    supplementId: 'sup_20260516_regenerate_atomic_abort',
    markdown: 'User supplement transcript',
  });
  assert.equal(initialSupplementSave.ok, true);

  let abortSegmentDuringAtomic = false;
  setBeforeAtomicWorkspaceFileCommitForTest(() => {
    abortSegmentDuringAtomic = true;
  });
  try {
    const abortedSegmentSave = await saveRecordingMarkdown({
      rootPath,
      workspaceId: 'ws_draft',
      memoryId: 'mem_regenerate_atomic_abort',
      segmentId: 'seg_20260516_regenerate_atomic_abort',
      fileName: 'transcript.md',
      markdown: 'Regenerated segment transcript',
      allowOverwrite: true,
      expectedTranscriptDigest: transcriptDigest('User segment transcript'),
      isAbortRequested: () => abortSegmentDuringAtomic,
    });

    assert.equal(abortedSegmentSave.ok, false);
    if (!abortedSegmentSave.ok) {
      assert.equal(abortedSegmentSave.error.code, 'ERR_BACKFILL_UNAVAILABLE');
    }
  } finally {
    setBeforeAtomicWorkspaceFileCommitForTest(null);
  }

  let abortSupplementDuringAtomic = false;
  setBeforeAtomicWorkspaceFileCommitForTest(() => {
    abortSupplementDuringAtomic = true;
  });
  try {
    const abortedSupplementSave = await saveSegmentSupplementMarkdown({
      rootPath,
      workspaceId: 'ws_draft',
      memoryId: 'mem_regenerate_atomic_abort',
      segmentId: 'seg_20260516_regenerate_atomic_abort',
      supplementId: 'sup_20260516_regenerate_atomic_abort',
      markdown: 'Regenerated supplement transcript',
      allowOverwrite: true,
      expectedTranscriptDigest: transcriptDigest('User supplement transcript'),
      isAbortRequested: () => abortSupplementDuringAtomic,
    });

    assert.equal(abortedSupplementSave.ok, false);
    if (!abortedSupplementSave.ok) {
      assert.equal(abortedSupplementSave.error.code, 'ERR_BACKFILL_UNAVAILABLE');
    }
  } finally {
    setBeforeAtomicWorkspaceFileCommitForTest(null);
  }

  const segmentDirectory = await findSegmentDirectoryById(
    rootPath,
    'seg_20260516_regenerate_atomic_abort'
  );
  const segmentMarkdown = await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8');
  const supplementDirectory = await findSupplementDirectoryById(
    segmentDirectory,
    'sup_20260516_regenerate_atomic_abort'
  );
  const supplementMarkdown = await readFile(
    path.join(supplementDirectory, 'supplement.md'),
    'utf8'
  );
  assert.match(segmentMarkdown, /User segment transcript/);
  assert.doesNotMatch(segmentMarkdown, /Regenerated segment transcript/);
  assert.match(supplementMarkdown, /User supplement transcript/);
  assert.doesNotMatch(supplementMarkdown, /Regenerated supplement transcript/);
});

test('transcript save failures keep existing transcription attempt manifests', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_transcript_save_failure',
    title: 'Transcript save failure',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260516_transcript_save_previous',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260516_transcript_save_previous',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const finalizedSegment = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    segmentId: 'seg_20260516_transcript_save_previous',
    memoryId: 'mem_transcript_save_failure',
    title: 'Previous file preserved',
    durationMs: 3000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalizedSegment.ok, true);

  setBeforeMarkdownWriteForTest(() => {
    throw new Error('markdown write blocked');
  });
  try {
    const failedSegmentSave = await saveRecordingMarkdown({
      rootPath,
      workspaceId: 'ws_draft',
      memoryId: 'mem_transcript_save_failure',
      segmentId: 'seg_20260516_transcript_save_previous',
      fileName: 'transcript.md',
      markdown: 'Segment transcript text',
    });

    assert.equal(failedSegmentSave.ok, false);
    if (!failedSegmentSave.ok) {
      assert.equal(failedSegmentSave.error.dataRetention, 'previous-file-preserved');
    }
  } finally {
    setBeforeMarkdownWriteForTest(null);
  }
  assert.equal(
    (await readObjectManifest(rootPath, 'segments', 'seg_20260516_transcript_save_previous'))[
      'lastTranscriptionAttempt'
    ],
    'failed'
  );

  const supplementDraft = await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_transcript_save_failure',
    segmentId: 'seg_20260516_transcript_save_previous',
    createSupplementId: () => 'sup_20260516_transcript_save_stale_index',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.equal(supplementDraft.ok, true);
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId: 'sup_20260516_transcript_save_stale_index',
    sequence: 0,
    chunk: new Uint8Array([4, 5]),
  });
  const finalizedSupplement = await finalizeSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_transcript_save_failure',
    segmentId: 'seg_20260516_transcript_save_previous',
    supplementId: 'sup_20260516_transcript_save_stale_index',
    title: 'Index stale supplement',
    durationMs: 2000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:13:00.000Z',
  });
  assert.equal(finalizedSupplement.ok, true);
  await rm(path.join(rootPath, '.reo', 'index.json'));
  await mkdir(path.join(rootPath, '.reo', 'index.json'));

  const failedSupplementSave = await saveSegmentSupplementMarkdown({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_transcript_save_failure',
    segmentId: 'seg_20260516_transcript_save_previous',
    supplementId: 'sup_20260516_transcript_save_stale_index',
    markdown: 'Supplement transcript text',
  });

  assert.equal(failedSupplementSave.ok, false);
  if (!failedSupplementSave.ok) {
    assert.equal(failedSupplementSave.error.dataRetention, 'previous-file-preserved');
  }
  assert.equal(
    (await readObjectManifest(rootPath, 'supplements', 'sup_20260516_transcript_save_stale_index'))[
      'lastTranscriptionAttempt'
    ],
    'failed'
  );
});

test('transcript save rejects manifest ownership changes before marking attempts successful', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_transcript_save_owner',
    title: 'Transcript save owner',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260516_transcript_save_owner',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260516_transcript_save_owner',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const finalizedSegment = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    segmentId: 'seg_20260516_transcript_save_owner',
    memoryId: 'mem_transcript_save_owner',
    title: 'Owner checked segment',
    durationMs: 3000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalizedSegment.ok, true);

  setBeforeMarkdownWriteForTest(async () => {
    const manifestPath = path.join(
      rootPath,
      '.reo',
      'objects',
      'segments',
      'seg_20260516_transcript_save_owner.json'
    );
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        ...manifest,
        workspaceId: 'ws_replaced_owner',
      })}\n`
    );
  });
  try {
    const failedSegmentSave = await saveRecordingMarkdown({
      rootPath,
      workspaceId: 'ws_draft',
      memoryId: 'mem_transcript_save_owner',
      segmentId: 'seg_20260516_transcript_save_owner',
      fileName: 'transcript.md',
      markdown: 'Segment transcript text',
    });

    assert.equal(failedSegmentSave.ok, false);
    if (!failedSegmentSave.ok) {
      assert.equal(failedSegmentSave.error.code, 'ERR_WORKSPACE_METADATA_INVALID');
      assert.equal(failedSegmentSave.error.dataRetention, 'previous-file-preserved');
    }
  } finally {
    setBeforeMarkdownWriteForTest(null);
  }
  assert.equal(
    (await readObjectManifest(rootPath, 'segments', 'seg_20260516_transcript_save_owner'))[
      'lastTranscriptionAttempt'
    ],
    'failed'
  );
});

test('segment supplement transcript save rejects manifest ownership changes before marking attempts successful', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_supplement_save_owner',
    title: 'Supplement save owner',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260516_supplement_save_owner',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260516_supplement_save_owner',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const finalizedSegment = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    segmentId: 'seg_20260516_supplement_save_owner',
    memoryId: 'mem_supplement_save_owner',
    title: 'Supplement owner parent',
    durationMs: 3000,
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalizedSegment.ok, true);
  const supplementDraft = await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_supplement_save_owner',
    segmentId: 'seg_20260516_supplement_save_owner',
    createSupplementId: () => 'sup_20260516_supplement_save_owner',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.equal(supplementDraft.ok, true);
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId: 'sup_20260516_supplement_save_owner',
    sequence: 0,
    chunk: new Uint8Array([4, 5]),
  });
  const finalizedSupplement = await finalizeSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_supplement_save_owner',
    segmentId: 'seg_20260516_supplement_save_owner',
    supplementId: 'sup_20260516_supplement_save_owner',
    title: 'Owner checked supplement',
    durationMs: 2000,
    lastTranscriptionAttemptOnFinalize: 'failed',
    now: () => '2026-05-06T13:13:00.000Z',
  });
  assert.equal(finalizedSupplement.ok, true);

  setBeforeMarkdownWriteForTest(async () => {
    const manifestPath = path.join(
      rootPath,
      '.reo',
      'objects',
      'supplements',
      'sup_20260516_supplement_save_owner.json'
    );
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        ...manifest,
        segmentId: 'seg_replaced_owner',
      })}\n`
    );
  });
  try {
    const failedSupplementSave = await saveSegmentSupplementMarkdown({
      rootPath,
      workspaceId: 'ws_draft',
      memoryId: 'mem_supplement_save_owner',
      segmentId: 'seg_20260516_supplement_save_owner',
      supplementId: 'sup_20260516_supplement_save_owner',
      markdown: 'Supplement transcript text',
    });

    assert.equal(failedSupplementSave.ok, false);
    if (!failedSupplementSave.ok) {
      assert.equal(failedSupplementSave.error.dataRetention, 'previous-file-preserved');
    }
  } finally {
    setBeforeMarkdownWriteForTest(null);
  }
  assert.equal(
    (await readObjectManifest(rootPath, 'supplements', 'sup_20260516_supplement_save_owner'))[
      'lastTranscriptionAttempt'
    ],
    'failed'
  );
});

test('segment supplement recording finalizes under the selected segment without creating a sibling segment', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_supplement_parent',
    title: 'Supplement parent',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260506_supplement_parent',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_supplement_parent',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const parent = await finalizeRecordingDraft({
    durationMs: 3000,
    rootPath,
    segmentId: 'seg_20260506_supplement_parent',
    memoryId: 'mem_supplement_parent',
    title: 'Parent segment',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(parent.ok, true);

  const supplementDraft = await createSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_supplement_parent',
    segmentId: 'seg_20260506_supplement_parent',
    createSupplementId: () => 'sup_20260506_followup',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.deepEqual(supplementDraft, {
    ok: true,
    supplementId: 'sup_20260506_followup',
    nextSequence: 0,
  });
  await appendSegmentSupplementRecordingAudioChunk({
    rootPath,
    supplementId: 'sup_20260506_followup',
    sequence: 0,
    chunk: new Uint8Array([4, 5, 6, 7]),
  });

  const finalized = await finalizeSegmentSupplementRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_supplement_parent',
    segmentId: 'seg_20260506_supplement_parent',
    supplementId: 'sup_20260506_followup',
    title: 'Follow-up supplement',
    durationMs: 4000,
    now: () => '2026-05-06T13:13:00.000Z',
  });
  assert.equal(finalized.ok, true);
  if (!finalized.ok) {
    return;
  }
  assert.equal(finalized.supplement.supplementId, 'sup_20260506_followup');
  assert.equal(finalized.supplement.segmentId, 'seg_20260506_supplement_parent');
  assert.equal(finalized.segment.supplementCount, 1);
  assert.equal(finalized.memory.segmentCount, 1);
  assert.equal(finalized.memory.supplementCount, 1);

  await assert.rejects(
    stat(
      path.join(rootPath, 'memories', 'mem_supplement_parent', 'segments', 'sup_20260506_followup')
    )
  );
  const segmentDirectory = await findSegmentDirectoryById(
    rootPath,
    'seg_20260506_supplement_parent'
  );
  const supplementDirectory = await findSupplementDirectoryById(
    segmentDirectory,
    'sup_20260506_followup'
  );
  assert.equal((await stat(path.join(supplementDirectory, 'audio.webm'))).isFile(), true);
  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_supplement_parent',
  });
  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.value.segmentCount, 1);
    assert.equal(detail.value.supplementCount, 1);
    assert.equal(detail.value.segments[0]?.supplementCount, 1);
  }
});

test('recording draft audio read returns the current safe draft audio bytes', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_audio_read';
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 1,
    chunk: new Uint8Array([3]),
  });

  const audio = await readRecordingDraftAudio({
    rootPath,
    segmentId,
  });

  assert.equal(audio.ok, true);
  if (audio.ok) {
    assert.deepEqual([...audio.audio], [1, 2, 3]);
    assert.equal(audio.audioByteLength, 3);
    assert.equal(audio.nextSequence, 2);
  }
});

test('recording draft prefix clone copies retained audio in one draft operation', async () => {
  const rootPath = await workspaceRoot();
  const sourceSegmentId = 'seg_20260506_prefix_source';
  const targetSegmentId = 'seg_20260506_prefix_target';
  const sourceDraft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => sourceSegmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(sourceDraft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: sourceSegmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2]),
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: sourceSegmentId,
    sequence: 1,
    chunk: new Uint8Array([3, 4]),
  });
  const targetDraft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => targetSegmentId,
    now: () => '2026-05-06T13:09:00.000Z',
  });
  assert.equal(targetDraft.ok, true);

  const cloned = await cloneRecordingDraftPrefix({
    rootPath,
    sourceSegmentId,
    targetSegmentId,
    retainedByteLength: 3,
    nextSequence: 0,
  });
  assert.equal(cloned.ok, true);
  if (cloned.ok) {
    assert.equal(cloned.audioByteLength, 3);
    assert.equal(cloned.nextSequence, 1);
  }
  const targetAudio = await readRecordingDraftAudio({ rootPath, segmentId: targetSegmentId });
  assert.equal(targetAudio.ok, true);
  if (targetAudio.ok) {
    assert.deepEqual([...targetAudio.audio], [1, 2, 3]);
    assert.equal(targetAudio.audioByteLength, 3);
    assert.equal(targetAudio.nextSequence, 1);
  }
  const appended = await appendRecordingAudioChunk({
    rootPath,
    segmentId: targetSegmentId,
    sequence: 1,
    chunk: new Uint8Array([9]),
  });
  assert.equal(appended.ok, true);
});

test('recording draft prefix clone rolls back target audio when copy fails after writing bytes', async () => {
  const rootPath = await workspaceRoot();
  const sourceSegmentId = 'seg_20260506_prefix_rollback_source';
  const targetSegmentId = 'seg_20260506_prefix_rollback_target';
  const sourceDraft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => sourceSegmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(sourceDraft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: sourceSegmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3, 4]),
  });
  const targetDraft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => targetSegmentId,
    now: () => '2026-05-06T13:09:00.000Z',
  });
  assert.equal(targetDraft.ok, true);
  setAfterDraftPrefixBytesCopiedForTest(() => {
    throw new Error('copy failed after bytes');
  });

  try {
    const cloned = await cloneRecordingDraftPrefix({
      rootPath,
      sourceSegmentId,
      targetSegmentId,
      retainedByteLength: 4,
      nextSequence: 0,
    });

    assert.equal(cloned.ok, false);
    if (!cloned.ok) {
      assert.equal(cloned.error.code, 'ERR_RECORDING_APPEND_FAILED');
    }
  } finally {
    setAfterDraftPrefixBytesCopiedForTest(null);
  }

  const targetAudio = await readRecordingDraftAudio({ rootPath, segmentId: targetSegmentId });
  assert.equal(targetAudio.ok, true);
  if (targetAudio.ok) {
    assert.deepEqual([...targetAudio.audio], []);
    assert.equal(targetAudio.audioByteLength, 0);
    assert.equal(targetAudio.nextSequence, 0);
  }
});

test('recording draft prefix clone rolls back target audio when workspace lock is lost during copy', async () => {
  const rootPath = await workspaceRoot();
  const sourceSegmentId = 'seg_20260506_prefix_lock_lost_source';
  const targetSegmentId = 'seg_20260506_prefix_lock_lost_target';
  let usable = true;
  const sourceDraft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => sourceSegmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(sourceDraft.ok, true);
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: sourceSegmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3, 4]),
  });
  const targetDraft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => targetSegmentId,
    now: () => '2026-05-06T13:09:00.000Z',
  });
  assert.equal(targetDraft.ok, true);
  setAfterDraftPrefixBytesCopiedForTest(() => {
    usable = false;
  });

  try {
    const cloned = await cloneRecordingDraftPrefix({
      rootPath,
      sourceSegmentId,
      targetSegmentId,
      retainedByteLength: 4,
      nextSequence: 0,
      assertWorkspaceUsable: () =>
        usable
          ? { ok: true as const }
          : {
              ok: false as const,
              error: { code: 'ERR_WORKSPACE_LOCK_LOST' as const, message: 'Workspace lock lost' },
            },
    });

    assert.equal(cloned.ok, false);
    if (!cloned.ok) {
      assert.equal(cloned.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
  } finally {
    setAfterDraftPrefixBytesCopiedForTest(null);
  }

  const targetAudio = await readRecordingDraftAudio({ rootPath, segmentId: targetSegmentId });
  assert.equal(targetAudio.ok, true);
  if (targetAudio.ok) {
    assert.deepEqual([...targetAudio.audio], []);
    assert.equal(targetAudio.audioByteLength, 0);
    assert.equal(targetAudio.nextSequence, 0);
  }
});

test('recording draft audio read respects the caller preview byte cap', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_audio_read_cap';
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
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

  const audio = await readRecordingDraftAudio({
    rootPath,
    segmentId,
    maxBytes: 2,
  });

  assert.equal(audio.ok, false);
  if (!audio.ok) {
    assert.equal(audio.error.code, 'ERR_RECORDING_CHUNK_TOO_LARGE');
  }
});

test('recording draft audio read rechecks workspace usability after async file read', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_audio_read_lock_lost';
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
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

  let workspaceUsable = true;
  setAfterDraftAudioReadForTest(() => {
    workspaceUsable = false;
  });
  try {
    const audio = await readRecordingDraftAudio({
      rootPath,
      segmentId,
      assertWorkspaceUsable: () =>
        workspaceUsable
          ? { ok: true }
          : {
              ok: false,
              error: {
                code: 'ERR_WORKSPACE_LOCK_LOST',
                message: 'Workspace lock was lost',
              },
            },
    });

    assert.equal(audio.ok, false);
    if (!audio.ok) {
      assert.equal(audio.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
  } finally {
    setAfterDraftAudioReadForTest(null);
  }
});

test('recording draft audio read rejects concurrent appends until the capped read completes', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_audio_read_append_race';
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
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

  const appendDuringRead: {
    current: Awaited<ReturnType<typeof appendRecordingAudioChunk>> | null;
  } = { current: null };
  setAfterDraftAudioReadForTest(async () => {
    appendDuringRead.current = await appendRecordingAudioChunk({
      rootPath,
      segmentId,
      sequence: 1,
      chunk: new Uint8Array([4]),
    });
  });
  try {
    const audio = await readRecordingDraftAudio({
      maxBytes: 3,
      rootPath,
      segmentId,
    });

    assert.equal(audio.ok, true);
    if (audio.ok) {
      assert.deepEqual(Array.from(audio.audio), [1, 2, 3]);
      assert.equal(audio.audioByteLength, 3);
    }
    assert.equal(appendDuringRead.current?.ok, false);
    if (appendDuringRead.current && !appendDuringRead.current.ok) {
      assert.equal(appendDuringRead.current.error.code, 'ERR_RECORDING_APPEND_IN_FLIGHT');
    }
  } finally {
    setAfterDraftAudioReadForTest(null);
  }
});

test('recording finalize rejects concurrent draft audio reads until the capped read completes', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_audio_read_finalize_race';
  const memoryId = 'mem_20260506_audio_read_finalize_race';
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
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
    memoryId,
    title: '读写互斥录音',
    now: '2026-05-06T13:11:00.000Z',
  });

  const finalizeDuringRead: {
    current: Awaited<ReturnType<typeof finalizeRecordingDraft>> | null;
  } = { current: null };
  setAfterDraftAudioReadForTest(async () => {
    finalizeDuringRead.current = await finalizeRecordingDraft({
      durationMs: 1000,
      rootPath,
      segmentId,
      memoryId,
      title: '读写互斥录音',
      now: () => '2026-05-06T13:11:00.000Z',
    });
  });
  try {
    const audio = await readRecordingDraftAudio({
      maxBytes: 3,
      rootPath,
      segmentId,
    });

    assert.equal(audio.ok, true);
    assert.equal(finalizeDuringRead.current?.ok, false);
    if (finalizeDuringRead.current && !finalizeDuringRead.current.ok) {
      assert.equal(finalizeDuringRead.current.error.code, 'ERR_RECORDING_APPEND_IN_FLIGHT');
    }
  } finally {
    setAfterDraftAudioReadForTest(null);
  }

  const finalized = await finalizeRecordingDraft({
    durationMs: 1000,
    rootPath,
    segmentId,
    memoryId,
    title: '读写互斥录音',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.equal(finalized.ok, true);
});

test('recording finalize rejects unknown draft files before durable expose', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_unknown_draft_file';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1]),
  });
  await writeFile(
    path.join(rootPath, '.reo', 'drafts', 'segments', segmentId, 'unexpected.tmp'),
    'unexpected'
  );

  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_unknown_draft_file',
    title: 'Unknown draft file',
    now: '2026-05-06T13:09:00.000Z',
  });

  const finalized = await finalizeRecordingDraft({
    durationMs: 1000,
    rootPath,
    segmentId,
    memoryId: 'mem_unknown_draft_file',
    title: 'Unknown draft file',
    now: () => '2026-05-06T13:09:00.000Z',
  });

  assert.equal(finalized.ok, false);
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId, 'unexpected.tmp'));
  await assert.rejects(
    stat(path.join(rootPath, 'memories', 'mem_unknown_draft_file', 'segments', segmentId))
  );
});

test('discard draft aborts when workspace handle is lost before removal', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_discard_lock_lost';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  let usable = true;

  const discarded = await discardRecordingDraft({
    rootPath,
    segmentId,
    beforeDraftDiscardRemove: () => {
      usable = false;
    },
    assertWorkspaceUsable: () => (usable ? { ok: true } : workspaceLockLost()),
  });

  assert.equal(discarded.ok, false);
  if (!discarded.ok) {
    assert.equal(discarded.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId));
});

test('recording finalize rejects non-file draft audio before deleting the draft', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260506_audio_directory',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const draftAudioPath = path.join(
    rootPath,
    '.reo',
    'drafts',
    'segments',
    'seg_20260506_audio_directory',
    'audio.webm'
  );
  await rm(draftAudioPath);
  await mkdir(draftAudioPath);

  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_20260506_audio_directory',
    title: '非法音频',
    now: '2026-05-06T13:09:00.000Z',
  });

  const finalized = await finalizeRecordingDraft({
    durationMs: 3000,
    rootPath,
    segmentId: 'seg_20260506_audio_directory',
    memoryId: 'mem_20260506_audio_directory',
    title: '非法音频',
    now: () => '2026-05-06T13:09:00.000Z',
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await stat(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_audio_directory'));
  await assert.rejects(
    stat(
      path.join(
        rootPath,
        'memories',
        'mem_20260506_audio_directory',
        'segments',
        'seg_20260506_audio_directory'
      )
    )
  );
  assert.deepEqual(JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8')), {
    schemaVersion: 1,
    memories: [
      {
        memoryId: 'mem_20260506_audio_directory',
        title: '非法音频',
        createdAt: '2026-05-06T13:09:00.000Z',
        updatedAt: '2026-05-06T13:09:00.000Z',
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

test('recording draft rejects symlinked draft ancestors before writing chunks', async () => {
  const rootPath = await workspaceRoot();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-outside-'));
  await rm(path.join(rootPath, '.reo', 'drafts', 'segments'), {
    recursive: true,
    force: true,
  });
  await symlink(outside, path.join(rootPath, '.reo', 'drafts', 'segments'));

  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260506_symlinked_draft_root',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(draft.ok, false);
  await assert.rejects(stat(path.join(outside, 'seg_20260506_symlinked_draft_root')));
});

test('discard draft does not delete outside draft after cleanup validation', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_discard_cleanup_swap';
  const outsideDraftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-discard-outside-'));
  await mkdir(path.join(outsideDraftsRoot, segmentId));
  await writeFile(path.join(outsideDraftsRoot, segmentId, 'sentinel.txt'), 'outside');
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });

  const segmentsRoot = path.join(rootPath, '.reo', 'drafts', 'segments');
  let swapped = false;
  const discarded = await discardRecordingDraft({
    rootPath,
    segmentId,
    beforeDraftDiscardRemove: async () => {
      swapped = true;
      await rename(segmentsRoot, `${segmentsRoot}-preserved`);
      await symlink(outsideDraftsRoot, segmentsRoot, 'dir');
    },
  } as Parameters<typeof discardRecordingDraft>[0] & {
    readonly beforeDraftDiscardRemove: () => Promise<void>;
  });

  assert.equal(swapped, true);
  assert.equal(discarded.ok, false);
  if (!discarded.ok) {
    assert.equal(discarded.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  await stat(path.join(outsideDraftsRoot, segmentId, 'sentinel.txt'));
});

test('recording draft rejects symlinked draft audio before appending chunks', async () => {
  const rootPath = await workspaceRoot();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-audio-outside-'));
  const outsideAudioPath = path.join(outside, 'outside.webm');
  await writeFile(outsideAudioPath, 'seed');
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260506_symlinked_audio',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const draftDirectory = path.join(
    rootPath,
    '.reo',
    'drafts',
    'segments',
    'seg_20260506_symlinked_audio'
  );
  const draftAudioPath = path.join(draftDirectory, 'audio.webm');
  await rm(draftAudioPath);
  await symlink(outsideAudioPath, draftAudioPath);

  const result = await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_symlinked_audio',
    sequence: 0,
    chunk: new Uint8Array([65, 66]),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  assert.equal(await readFile(outsideAudioPath, 'utf8'), 'seed');
  assert.deepEqual(JSON.parse(await readFile(path.join(draftDirectory, 'segment.json'), 'utf8')), {
    schemaVersion: 1,
    workspaceId: 'ws_draft',
    segmentId: 'seg_20260506_symlinked_audio',
    type: 'audio',
    status: 'draft',
    title: '',
    createdAt: '2026-05-06T13:08:00.000Z',
    nextSequence: 0,
    audioByteLength: 0,
  });
});

test('recording draft create rejects ancestor swap before writing draft files', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_create_ancestor_swap';
  const draftsRoot = path.join(rootPath, '.reo', 'drafts', 'segments');
  const preservedDraftsRoot = `${draftsRoot}-preserved`;
  const outsideDraftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-create-outside-'));

  setBeforeDraftDirectoryCreateForTest(async () => {
    await rename(draftsRoot, preservedDraftsRoot);
    await symlink(outsideDraftsRoot, draftsRoot, 'dir');
  });
  const result = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  setBeforeDraftDirectoryCreateForTest(null);

  assert.equal(result.ok, false);
  await assert.rejects(stat(path.join(outsideDraftsRoot, segmentId)));
  await assert.rejects(readFile(path.join(outsideDraftsRoot, segmentId, 'audio.webm')));
  await assert.rejects(readFile(path.join(outsideDraftsRoot, segmentId, 'segment.json')));
});

test('recording draft create does not touch outside parent after ancestor swap before mkdir', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_create_no_outside_touch';
  const draftsRoot = path.join(rootPath, '.reo', 'drafts', 'segments');
  const outsideDraftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-create-touch-'));

  setBeforeDraftDirectoryCreateForTest(async () => {
    setBeforeDraftDirectoryCreateForTest(null);
    await rename(draftsRoot, `${draftsRoot}-preserved`);
    await symlink(outsideDraftsRoot, draftsRoot, 'dir');
  });
  setAfterDraftDirectoryCreateForTest(async () => {
    await writeFile(path.join(outsideDraftsRoot, segmentId, 'sentinel'), 'outside\n');
  });

  try {
    const result = await createRecordingDraft({
      rootPath,
      workspaceId: 'ws_draft',
      createSegmentId: () => segmentId,
      now: () => '2026-05-06T13:08:00.000Z',
    });

    assert.equal(result.ok, false);
    await assert.rejects(stat(path.join(outsideDraftsRoot, segmentId)));
  } finally {
    setBeforeDraftDirectoryCreateForTest(null);
    setAfterDraftDirectoryCreateForTest(null);
  }
});

test('recording draft create rejects ancestor swap after leaf directory create', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_create_after_leaf_swap';
  const draftsRoot = path.join(rootPath, '.reo', 'drafts', 'segments');
  const outsideDraftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-after-leaf-'));
  const outsideDraftDirectory = path.join(outsideDraftsRoot, segmentId);

  setAfterDraftDirectoryCreateForTest(async () => {
    setAfterDraftDirectoryCreateForTest(null);
    await mkdir(outsideDraftDirectory);
    await rename(draftsRoot, `${draftsRoot}-preserved`);
    await symlink(outsideDraftsRoot, draftsRoot, 'dir');
  });

  try {
    const result = await createRecordingDraft({
      rootPath,
      workspaceId: 'ws_draft',
      createSegmentId: () => segmentId,
      now: () => '2026-05-06T13:08:00.000Z',
    });

    assert.equal(result.ok, false);
    await stat(outsideDraftDirectory);
    await assert.rejects(readFile(path.join(outsideDraftDirectory, 'audio.webm')));
    await assert.rejects(readFile(path.join(outsideDraftDirectory, 'segment.json')));
  } finally {
    setAfterDraftDirectoryCreateForTest(null);
  }
});

test('recording draft create does not touch outside parent after swap before audio create', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_create_audio_parent_swap';
  const draftsRoot = path.join(rootPath, '.reo', 'drafts', 'segments');
  const outsideDraftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-audio-create-'));
  const outsideDraftDirectory = path.join(outsideDraftsRoot, segmentId);

  setBeforeDraftAudioCreateForTest(async () => {
    await mkdir(outsideDraftDirectory);
    await rename(draftsRoot, `${draftsRoot}-preserved`);
    await symlink(outsideDraftsRoot, draftsRoot, 'dir');
  });

  try {
    const result = await createRecordingDraft({
      rootPath,
      workspaceId: 'ws_draft',
      createSegmentId: () => segmentId,
      now: () => '2026-05-06T13:08:00.000Z',
    });

    assert.equal(result.ok, false);
    await stat(outsideDraftDirectory);
    const touchedOutside = await readFile(path.join(outsideDraftDirectory, 'audio.webm'))
      .then(() => true)
      .catch(() => false);
    assert.equal(touchedOutside, false);
  } finally {
    setBeforeDraftAudioCreateForTest(null);
  }
});

test('recording draft create aborts when workspace handle is lost before draft files are written', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_create_lock_lost';
  let usable = true;
  setBeforeDraftAudioCreateForTest(() => {
    usable = false;
  });

  try {
    const result = await createRecordingDraft({
      rootPath,
      workspaceId: 'ws_draft',
      createSegmentId: () => segmentId,
      now: () => '2026-05-06T13:08:00.000Z',
      assertWorkspaceUsable: () => (usable ? { ok: true } : workspaceLockLost()),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
    await assert.rejects(stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId)));
  } finally {
    setBeforeDraftAudioCreateForTest(null);
  }
});

test('recording draft create aborts when workspace handle is lost before draft directory create', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_create_directory_lock_lost';
  let usable = true;
  let wroteAfterLockLost = false;
  setBeforeDraftDirectoryCreateForTest(() => {
    usable = false;
  });
  setAfterDraftDirectoryCreateForTest(() => {
    wroteAfterLockLost = true;
  });

  try {
    const result = await createRecordingDraft({
      rootPath,
      workspaceId: 'ws_draft',
      createSegmentId: () => segmentId,
      now: () => '2026-05-06T13:08:00.000Z',
      assertWorkspaceUsable: () => (usable ? { ok: true } : workspaceLockLost()),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
    assert.equal(wroteAfterLockLost, false);
    await assert.rejects(stat(path.join(rootPath, '.reo', 'drafts', 'segments', segmentId)));
  } finally {
    setBeforeDraftDirectoryCreateForTest(null);
    setAfterDraftDirectoryCreateForTest(null);
  }
});

test('recording append rejects ancestor swap before opening draft audio', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_append_ancestor_swap';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const draftsRoot = path.join(rootPath, '.reo', 'drafts', 'segments');
  const preservedDraftsRoot = `${draftsRoot}-preserved`;
  const outsideDraftDirectory = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-draft-append-outside-')),
    segmentId
  );
  await mkdir(outsideDraftDirectory);
  await writeFile(path.join(outsideDraftDirectory, 'audio.webm'), 'outside');
  await writeFile(
    path.join(outsideDraftDirectory, 'segment.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_draft',
        segmentId,
        type: 'audio',
        status: 'draft',
        title: '',
        createdAt: '2026-05-06T13:08:00.000Z',
        nextSequence: 0,
        audioByteLength: 0,
      },
      null,
      2
    )}\n`
  );

  setBeforeDraftAudioOpenForTest(async () => {
    await rename(draftsRoot, preservedDraftsRoot);
    await symlink(path.dirname(outsideDraftDirectory), draftsRoot, 'dir');
  });
  const result = await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([65, 66]),
  });
  setBeforeDraftAudioOpenForTest(null);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  assert.equal(await readFile(path.join(outsideDraftDirectory, 'audio.webm'), 'utf8'), 'outside');
  assert.equal(
    JSON.parse(await readFile(path.join(outsideDraftDirectory, 'segment.json'), 'utf8'))
      .audioByteLength,
    0
  );
});

test('recording append aborts when workspace handle is lost before audio write', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_append_lock_lost';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  let usable = true;
  setBeforeDraftAudioOpenForTest(() => {
    usable = false;
  });

  try {
    const result = await appendRecordingAudioChunk({
      rootPath,
      segmentId,
      sequence: 0,
      chunk: new Uint8Array([1, 2, 3]),
      assertWorkspaceUsable: () => (usable ? { ok: true } : workspaceLockLost()),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
    const metadata = JSON.parse(
      await readFile(
        path.join(rootPath, '.reo', 'drafts', 'segments', segmentId, 'segment.json'),
        'utf8'
      )
    );
    assert.equal(metadata.nextSequence, 0);
    assert.equal(metadata.audioByteLength, 0);
  } finally {
    setBeforeDraftAudioOpenForTest(null);
  }
});

test('recording draft rolls back audio when metadata write fails after append', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_metadata_write_failure';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const draftDirectory = path.join(rootPath, '.reo', 'drafts', 'segments', segmentId);

  await chmod(draftDirectory, 0o555);
  const appended = await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  await chmod(draftDirectory, 0o755);

  assert.equal(appended.ok, false);
  if (!appended.ok) {
    assert.equal(appended.error.code, 'ERR_RECORDING_APPEND_FAILED');
    assert.equal(appended.error.dataRetention, 'draft-preserved');
  }
  assert.equal((await stat(path.join(draftDirectory, 'audio.webm'))).size, 0);
  assert.deepEqual(JSON.parse(await readFile(path.join(draftDirectory, 'segment.json'), 'utf8')), {
    audioByteLength: 0,
    createdAt: '2026-05-06T13:08:00.000Z',
    nextSequence: 0,
    segmentId,
    schemaVersion: 1,
    status: 'draft',
    title: '',
    type: 'audio',
    workspaceId: 'ws_draft',
  });
});

test('recording finalize blocks late append while finalization is active', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260506_000002',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_000002',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_20260506_000002',
    title: '并发录音',
    now: '2026-05-06T13:11:00.000Z',
  });

  const finalize = finalizeRecordingDraft({
    durationMs: 0,
    rootPath,
    segmentId: 'seg_20260506_000002',
    memoryId: 'mem_20260506_000002',
    title: '并发录音',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  const lateAppend = await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_000002',
    sequence: 1,
    chunk: new Uint8Array([9]),
  });

  assert.equal(lateAppend.ok, false);
  if (!lateAppend.ok) {
    assert.equal(lateAppend.error.code, 'ERR_RECORDING_FINALIZED');
  }
  assert.equal((await finalize).ok, true);
  const segmentDirectory = await findSegmentDirectoryById(rootPath, 'seg_20260506_000002');
  const audio = await stat(path.join(segmentDirectory, 'audio.webm'));
  assert.equal(audio.size, 3);
});

test('recording append rejects stale draft when a finalized audio segment already exists', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260506_stale_draft',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_stale_draft',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_20260506_stale_draft',
    title: '已完成录音',
    now: '2026-05-06T13:11:00.000Z',
  });

  const finalized = await finalizeRecordingDraft({
    durationMs: 3000,
    rootPath,
    segmentId: 'seg_20260506_stale_draft',
    memoryId: 'mem_20260506_stale_draft',
    title: '已完成录音',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const staleDraftDirectory = path.join(
    rootPath,
    '.reo',
    'drafts',
    'segments',
    'seg_20260506_stale_draft'
  );
  await mkdir(staleDraftDirectory, { recursive: true });
  await writeFile(path.join(staleDraftDirectory, 'audio.webm'), new Uint8Array([7]));
  await writeFile(
    path.join(staleDraftDirectory, 'segment.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_draft',
        segmentId: 'seg_20260506_stale_draft',
        type: 'audio',
        status: 'draft',
        title: '',
        createdAt: '2026-05-06T13:10:00.000Z',
        nextSequence: 0,
        audioByteLength: 1,
      },
      null,
      2
    )}\n`
  );

  const staleAppend = await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_stale_draft',
    sequence: 0,
    chunk: new Uint8Array([9]),
  });

  assert.equal(staleAppend.ok, false);
  if (!staleAppend.ok) {
    assert.equal(staleAppend.error.code, 'ERR_RECORDING_FINALIZED');
  }
  assert.equal((await stat(path.join(staleDraftDirectory, 'audio.webm'))).size, 1);
  const segmentDirectory = await findSegmentDirectoryById(rootPath, 'seg_20260506_stale_draft');
  assert.equal((await stat(path.join(segmentDirectory, 'audio.webm'))).size, 3);
});

test('recording append checks finalized truth after root draft state is cleared', async () => {
  const rootPath = await workspaceRoot();
  const segmentId = 'seg_20260506_active_draft_clear';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => segmentId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  clearRecordingRuntimeStateForRoot(rootPath);
  await writeFinalizedAudioSegmentForTest(rootPath, segmentId);

  const append = await appendRecordingAudioChunk({
    rootPath,
    segmentId,
    sequence: 0,
    chunk: new Uint8Array([2]),
  });

  assert.equal(append.ok, false);
  if (!append.ok) {
    assert.equal(append.error.code, 'ERR_RECORDING_FINALIZED');
  }
});

test('recording finalize returns error envelope when durable audio is missing', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260506_000003',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  await rm(path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_000003', 'audio.webm'));

  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_20260506_000003',
    title: '缺失音频',
    now: '2026-05-06T13:13:00.000Z',
  });

  const finalized = await finalizeRecordingDraft({
    durationMs: 0,
    rootPath,
    segmentId: 'seg_20260506_000003',
    memoryId: 'mem_20260506_000003',
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
    createSegmentId: () => 'seg_20260506_000004',
    now: () => '2026-05-06T13:14:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_000004',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_20260506_000004',
    title: '索引失败录音',
    now: '2026-05-06T13:15:00.000Z',
  });
  const indexPath = path.join(rootPath, '.reo', 'index.json');
  await rm(indexPath);
  await mkdir(indexPath);

  const finalized = await finalizeRecordingDraft({
    durationMs: 0,
    rootPath,
    segmentId: 'seg_20260506_000004',
    memoryId: 'mem_20260506_000004',
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
      path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_20260506_000004', 'segment.json'),
      'utf8'
    )
  );
  assert.equal(metadata.status, 'draft');
  assert.equal(metadata.title, '');
  assert.equal(metadata.audioByteLength, 3);
});

test('recording finalize returns only the appended recording byte length for existing memories', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_seed',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_seed',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3, 4, 5]),
  });
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_existing_size',
    title: 'Seed',
    now: '2026-05-06T13:09:00.000Z',
  });

  assert.equal(
    (
      await finalizeRecordingDraft({
        rootPath,
        workspaceId: 'ws_draft',
        segmentId: 'seg_seed',
        memoryId: 'mem_existing_size',
        title: 'Seed',
        durationMs: 1000,
        now: () => '2026-05-06T13:09:00.000Z',
      })
    ).ok,
    true
  );

  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_append_size',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_append_size',
    sequence: 0,
    chunk: new Uint8Array([6, 7]),
  });

  assert.deepEqual(
    await finalizeRecordingDraft({
      rootPath,
      workspaceId: 'ws_draft',
      segmentId: 'seg_append_size',
      memoryId: 'mem_existing_size',
      title: 'Append',
      durationMs: 2000,
      now: () => '2026-05-06T13:11:00.000Z',
    }),
    {
      ok: true,
      segment: {
        workspaceId: 'ws_draft',
        memoryId: 'mem_existing_size',
        segmentId: 'seg_append_size',
        type: 'audio',
        title: 'Append',
        createdAt: '2026-05-06T13:10:00.000Z',
        updatedAt: '2026-05-06T13:11:00.000Z',
        durationMs: 2000,
        audioByteLength: 2,
        lastTranscriptionAttempt: 'never',
        transcript: { exists: false },
        supplementCount: 0,
        supplements: [],
        contentTabOrder: ['segment'],
      },
      memory: {
        memoryId: 'mem_existing_size',
        title: 'Seed',
        createdAt: '2026-05-06T13:09:00.000Z',
        updatedAt: '2026-05-06T13:11:00.000Z',
        segmentCount: 2,
        audioSegmentCount: 2,
        noteSegmentCount: 0,
        audioDurationMs: 3000,
        audioByteLength: 7,
        hasAudioTranscript: false,
        hasAnyNote: false,
        supplementCount: 0,
      },
    }
  );

  const index = JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8'));
  assert.equal(index.memories[0].audioByteLength, 7);
});

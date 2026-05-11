import assert from 'node:assert/strict';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
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
  appendSegmentAttachmentRecordingAudioChunk,
  cloneRecordingDraftPrefix,
  clearRecordingRuntimeStateForRoot,
  createRecordingDraft,
  createSegmentAttachmentRecordingDraft,
  discardRecordingDraft,
  finalizeRecordingDraft,
  finalizeSegmentAttachmentRecordingDraft,
  initializeRecordingDraftWorkspace,
  readRecordingDraftAudio,
  setAfterDraftAudioReadForTest,
  setAfterDraftDirectoryCreateForTest,
  setAfterDraftPrefixBytesCopiedForTest,
  setBeforeDraftAudioCreateForTest,
  setBeforeDraftAudioOpenForTest,
  setBeforeDraftDirectoryCreateForTest,
} from '../../src/main/recordingDrafts.js';
import {
  createMemoryFromFileTruth,
  readMemoryDetailFromFileTruth,
} from '../../src/main/memoryFiles.js';
import { initializeWorkspaceFiles } from '../../src/main/workspaceFiles.js';

async function writeFinalizedAudioSegmentForTest(
  rootPath: string,
  segmentId: string
): Promise<void> {
  const memoryDirectory = path.join(rootPath, 'memories', 'mem_active_draft_clear');
  const recordingDirectory = path.join(memoryDirectory, 'segments', segmentId);
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(
    path.join(memoryDirectory, 'memory.json'),
    `${JSON.stringify({
      memoryId: 'mem_active_draft_clear',
      title: 'Active draft clear',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      segmentIds: [segmentId],
    })}\n`
  );
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1]));
  await writeFile(path.join(recordingDirectory, 'transcript.md'), '');
  await writeFile(
    path.join(recordingDirectory, 'segment.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_draft',
      memoryId: 'mem_active_draft_clear',
      segmentId,
      type: 'audio',
      status: 'finalized',
      title: 'Active draft clear',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 1,
      transcriptPath: 'transcript.md',
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
  await initializeRecordingDraftWorkspace({ rootPath: root });
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
        transcript: { exists: false },
        attachmentCount: 0,
        attachments: [],
      },
      memory: {
        memoryId: 'mem_20260506_000001',
        title: '第一段录音',
        createdAt: '2026-05-06T13:09:00.000Z',
        updatedAt: '2026-05-06T13:09:00.000Z',
        segmentCount: 1,
        durationMs: 0,
        audioByteLength: 3,
        hasTranscript: false,
        attachmentCount: 0,
      },
    }
  );

  const finalizedMetadata = JSON.parse(
    await readFile(
      path.join(
        rootPath,
        'memories',
        'mem_20260506_000001',
        'segments',
        'seg_20260506_000001',
        'segment.json'
      ),
      'utf8'
    )
  );
  const audio = await stat(
    path.join(
      rootPath,
      'memories',
      'mem_20260506_000001',
      'segments',
      'seg_20260506_000001',
      'audio.webm'
    )
  );
  const index = JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8'));
  assert.equal(finalizedMetadata.status, 'finalized');
  assert.equal(finalizedMetadata.memoryId, 'mem_20260506_000001');
  assert.equal(finalizedMetadata.title, '第一段录音');
  assert.equal(finalizedMetadata.audioByteLength, 3);
  assert.equal(audio.size, 3);
  assert.deepEqual(index.memories, [
    {
      memoryId: 'mem_20260506_000001',
      title: '第一段录音',
      createdAt: '2026-05-06T13:09:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      segmentCount: 1,
      durationMs: 0,
      audioByteLength: 3,
      hasTranscript: false,
      attachmentCount: 0,
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

  const metadataAfterLateAppend = JSON.parse(
    await readFile(
      path.join(
        rootPath,
        'memories',
        'mem_20260506_000001',
        'segments',
        'seg_20260506_000001',
        'segment.json'
      ),
      'utf8'
    )
  );
  assert.deepEqual(metadataAfterLateAppend, finalizedMetadata);
});

test('segment attachment recording finalizes under the selected segment without creating a sibling segment', async () => {
  const rootPath = await workspaceRoot();
  await createMemoryForDraftFinalize({
    rootPath,
    memoryId: 'mem_attachment_parent',
    title: 'Attachment parent',
    now: '2026-05-06T13:09:00.000Z',
  });
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createSegmentId: () => 'seg_20260506_attachment_parent',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    segmentId: 'seg_20260506_attachment_parent',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const parent = await finalizeRecordingDraft({
    durationMs: 3000,
    rootPath,
    segmentId: 'seg_20260506_attachment_parent',
    memoryId: 'mem_attachment_parent',
    title: 'Parent segment',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(parent.ok, true);

  const attachmentDraft = await createSegmentAttachmentRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_attachment_parent',
    segmentId: 'seg_20260506_attachment_parent',
    createAttachmentId: () => 'att_20260506_followup',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  assert.deepEqual(attachmentDraft, {
    ok: true,
    attachmentId: 'att_20260506_followup',
    nextSequence: 0,
  });
  await appendSegmentAttachmentRecordingAudioChunk({
    rootPath,
    attachmentId: 'att_20260506_followup',
    sequence: 0,
    chunk: new Uint8Array([4, 5, 6, 7]),
  });

  const finalized = await finalizeSegmentAttachmentRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_attachment_parent',
    segmentId: 'seg_20260506_attachment_parent',
    attachmentId: 'att_20260506_followup',
    title: 'Follow-up attachment',
    durationMs: 4000,
    now: () => '2026-05-06T13:13:00.000Z',
  });
  assert.equal(finalized.ok, true);
  if (!finalized.ok) {
    return;
  }
  assert.equal(finalized.attachment.attachmentId, 'att_20260506_followup');
  assert.equal(finalized.attachment.segmentId, 'seg_20260506_attachment_parent');
  assert.equal(finalized.segment.attachmentCount, 1);
  assert.equal(finalized.memory.segmentCount, 1);
  assert.equal(finalized.memory.attachmentCount, 1);

  await assert.rejects(
    stat(
      path.join(rootPath, 'memories', 'mem_attachment_parent', 'segments', 'att_20260506_followup')
    )
  );
  assert.equal(
    (
      await stat(
        path.join(
          rootPath,
          'memories',
          'mem_attachment_parent',
          'segments',
          'seg_20260506_attachment_parent',
          'attachments',
          'att_20260506_followup',
          'audio.webm'
        )
      )
    ).isFile(),
    true
  );
  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_draft',
    memoryId: 'mem_attachment_parent',
  });
  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.value.segmentCount, 1);
    assert.equal(detail.value.attachmentCount, 1);
    assert.equal(detail.value.segments[0]?.attachmentCount, 1);
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
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        attachmentCount: 0,
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
  const audio = await stat(
    path.join(
      rootPath,
      'memories',
      'mem_20260506_000002',
      'segments',
      'seg_20260506_000002',
      'audio.webm'
    )
  );
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
  assert.equal(
    (
      await stat(
        path.join(
          rootPath,
          'memories',
          finalized.ok ? finalized.segment.memoryId : '',
          'segments',
          'seg_20260506_stale_draft',
          'audio.webm'
        )
      )
    ).size,
    3
  );
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
        transcript: { exists: false },
        attachmentCount: 0,
        attachments: [],
      },
      memory: {
        memoryId: 'mem_existing_size',
        title: 'Seed',
        createdAt: '2026-05-06T13:09:00.000Z',
        updatedAt: '2026-05-06T13:11:00.000Z',
        segmentCount: 2,
        durationMs: 3000,
        audioByteLength: 7,
        hasTranscript: false,
        attachmentCount: 0,
      },
    }
  );

  const index = JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8'));
  assert.equal(index.memories[0].audioByteLength, 7);
});

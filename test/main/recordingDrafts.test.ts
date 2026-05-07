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
  clearRecordingRuntimeStateForRoot,
  createRecordingDraft,
  discardRecordingDraft,
  finalizeRecordingDraft,
  initializeRecordingDraftWorkspace,
  saveRecordingDraftMarkdown,
  setAfterDraftDirectoryCreateForTest,
  setBeforeDraftAudioCreateForTest,
  setBeforeDraftAudioOpenForTest,
  setBeforeDraftDirectoryCreateForTest,
  setBeforeMarkdownWriteForTest,
} from '../../src/main/recordingDrafts.js';
import { initializeWorkspaceFiles } from '../../src/main/workspaceFiles.js';

async function writeFinalizedRecordingForTest(
  rootPath: string,
  recordingId: string
): Promise<void> {
  const memoryDirectory = path.join(rootPath, 'memories', 'mem_active_draft_clear');
  const recordingDirectory = path.join(memoryDirectory, 'recordings', recordingId);
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(
    path.join(memoryDirectory, 'memory.json'),
    `${JSON.stringify({
      memoryId: 'mem_active_draft_clear',
      title: 'Active draft clear',
      sourceKind: 'recording',
      createdAt: '2026-05-06T13:08:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      recordingIds: [recordingId],
    })}\n`
  );
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1]));
  await writeFile(path.join(recordingDirectory, 'transcript.md'), '');
  await writeFile(path.join(recordingDirectory, 'reflections.md'), '');
  await writeFile(
    path.join(recordingDirectory, 'recording.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_draft',
      memoryId: 'mem_active_draft_clear',
      recordingId,
      status: 'finalized',
      title: 'Active draft clear',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 1,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
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
      durationMs: 0,
      rootPath,
      recordingId: 'rec_20260506_000001',
      createMemoryId: () => 'mem_20260506_000001',
      title: '第一段录音',
      now: () => '2026-05-06T13:09:00.000Z',
    }),
    {
      ok: true,
      recording: {
        memoryId: 'mem_20260506_000001',
        recordingId: 'rec_20260506_000001',
        title: '第一段录音',
        durationMs: 0,
        audioByteLength: 3,
      },
      memory: {
        memoryId: 'mem_20260506_000001',
        title: '第一段录音',
        createdAt: '2026-05-06T13:09:00.000Z',
        updatedAt: '2026-05-06T13:09:00.000Z',
        recordingCount: 1,
        durationMs: 0,
        audioByteLength: 3,
        hasTranscript: false,
        hasReflections: false,
      },
    }
  );

  const finalizedMetadata = JSON.parse(
    await readFile(
      path.join(
        rootPath,
        'memories',
        'mem_20260506_000001',
        'recordings',
        'rec_20260506_000001',
        'recording.json'
      ),
      'utf8'
    )
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
      recordingCount: 1,
      durationMs: 0,
      audioByteLength: 3,
      hasTranscript: false,
      hasReflections: false,
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
      path.join(
        rootPath,
        'memories',
        'mem_20260506_000001',
        'recordings',
        'rec_20260506_000001',
        'recording.json'
      ),
      'utf8'
    )
  );
  assert.deepEqual(metadataAfterLateAppend, finalizedMetadata);
});

test('recording finalize preserves draft transcript and reflections markdown', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => 'rec_20260506_markdown_preserve',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_markdown_preserve',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  assert.equal(
    (
      await saveRecordingDraftMarkdown({
        rootPath,
        recordingId: 'rec_20260506_markdown_preserve',
        fileName: 'transcript.md',
        markdown: '用户转写草稿\n',
      })
    ).ok,
    true
  );
  assert.equal(
    (
      await saveRecordingDraftMarkdown({
        rootPath,
        recordingId: 'rec_20260506_markdown_preserve',
        fileName: 'reflections.md',
        markdown: '用户反思草稿\n',
      })
    ).ok,
    true
  );

  const finalized = await finalizeRecordingDraft({
    durationMs: 3000,
    rootPath,
    recordingId: 'rec_20260506_markdown_preserve',
    createMemoryId: () => 'mem_20260506_markdown_preserve',
    title: '保留草稿',
    now: () => '2026-05-06T13:09:00.000Z',
  });

  assert.equal(finalized.ok, true);
  if (finalized.ok) {
    assert.equal(finalized.memory.hasTranscript, true);
    assert.equal(finalized.memory.hasReflections, true);
  }
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_20260506_markdown_preserve',
    'recordings',
    'rec_20260506_markdown_preserve'
  );
  assert.equal(
    await readFile(path.join(recordingDirectory, 'transcript.md'), 'utf8'),
    '用户转写草稿\n'
  );
  assert.equal(
    await readFile(path.join(recordingDirectory, 'reflections.md'), 'utf8'),
    '用户反思草稿\n'
  );
  const index = JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8'));
  assert.equal(index.memories[0].hasTranscript, true);
  assert.equal(index.memories[0].hasReflections, true);
});

test('recording finalize rejects unknown draft files before durable expose', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_unknown_draft_file';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId,
    sequence: 0,
    chunk: new Uint8Array([1]),
  });
  await writeFile(
    path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId, 'unexpected.tmp'),
    'unexpected'
  );

  const finalized = await finalizeRecordingDraft({
    durationMs: 1000,
    rootPath,
    recordingId,
    createMemoryId: () => 'mem_unknown_draft_file',
    title: 'Unknown draft file',
    now: () => '2026-05-06T13:09:00.000Z',
  });

  assert.equal(finalized.ok, false);
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId, 'unexpected.tmp'));
  await assert.rejects(
    stat(path.join(rootPath, 'memories', 'mem_unknown_draft_file', 'recordings', recordingId))
  );
});

test('recording markdown save aborts when workspace handle is lost before write', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_markdown_lock_lost';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  let usable = true;
  setBeforeMarkdownWriteForTest(() => {
    usable = false;
  });

  try {
    const result = await saveRecordingDraftMarkdown({
      rootPath,
      recordingId,
      fileName: 'transcript.md',
      markdown: 'lost\n',
      assertWorkspaceUsable: () => (usable ? { ok: true } : workspaceLockLost()),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
    await assert.rejects(
      stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId, 'transcript.md'))
    );
  } finally {
    setBeforeMarkdownWriteForTest(null);
  }
});

test('recording markdown saves the latest same-file edit when writes overlap', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_markdown_write_queue';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  let releaseFirstWrite: () => void = () => {};
  const firstWriteEntered = new Promise<void>((resolveEntered) => {
    let calls = 0;
    setBeforeMarkdownWriteForTest(async () => {
      calls += 1;
      if (calls === 1) {
        resolveEntered();
        await new Promise<void>((resolve) => {
          releaseFirstWrite = resolve;
        });
      }
    });
  });

  try {
    const first = saveRecordingDraftMarkdown({
      rootPath,
      recordingId,
      fileName: 'transcript.md',
      markdown: '旧内容\n',
    });
    await firstWriteEntered;
    const second = saveRecordingDraftMarkdown({
      rootPath,
      recordingId,
      fileName: 'transcript.md',
      markdown: '新内容\n',
    });
    releaseFirstWrite();
    assert.equal((await first).ok, true);
    assert.equal((await second).ok, true);
  } finally {
    setBeforeMarkdownWriteForTest(null);
  }

  assert.equal(
    await readFile(
      path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId, 'transcript.md'),
      'utf8'
    ),
    '新内容\n'
  );
});

test('discard draft aborts when workspace handle is lost before removal', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_discard_lock_lost';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  let usable = true;

  const discarded = await discardRecordingDraft({
    rootPath,
    recordingId,
    beforeDraftDiscardRemove: () => {
      usable = false;
    },
    assertWorkspaceUsable: () => (usable ? { ok: true } : workspaceLockLost()),
  });

  assert.equal(discarded.ok, false);
  if (!discarded.ok) {
    assert.equal(discarded.error.code, 'ERR_WORKSPACE_LOCK_LOST');
  }
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId));
});

test('recording finalize rejects non-file draft audio before deleting the draft', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => 'rec_20260506_audio_directory',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const draftAudioPath = path.join(
    rootPath,
    '.reo',
    'drafts',
    'recordings',
    'rec_20260506_audio_directory',
    'audio.webm'
  );
  await rm(draftAudioPath);
  await mkdir(draftAudioPath);

  const finalized = await finalizeRecordingDraft({
    durationMs: 3000,
    rootPath,
    recordingId: 'rec_20260506_audio_directory',
    createMemoryId: () => 'mem_20260506_audio_directory',
    title: '非法音频',
    now: () => '2026-05-06T13:09:00.000Z',
  });

  assert.equal(finalized.ok, false);
  if (!finalized.ok) {
    assert.equal(finalized.error.dataRetention, 'draft-preserved');
  }
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_audio_directory'));
  await assert.rejects(
    stat(
      path.join(
        rootPath,
        'memories',
        'mem_20260506_audio_directory',
        'recordings',
        'rec_20260506_audio_directory'
      )
    )
  );
  assert.deepEqual(JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8')), {
    schemaVersion: 1,
    memories: [],
  });
});

test('recording draft rejects symlinked draft ancestors before writing chunks', async () => {
  const rootPath = await workspaceRoot();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-outside-'));
  await rm(path.join(rootPath, '.reo', 'drafts', 'recordings'), {
    recursive: true,
    force: true,
  });
  await symlink(outside, path.join(rootPath, '.reo', 'drafts', 'recordings'));

  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => 'rec_20260506_symlinked_draft_root',
    now: () => '2026-05-06T13:08:00.000Z',
  });

  assert.equal(draft.ok, false);
  await assert.rejects(stat(path.join(outside, 'rec_20260506_symlinked_draft_root')));
});

test('discard draft does not delete outside draft after cleanup validation', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_discard_cleanup_swap';
  const outsideDraftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-discard-outside-'));
  await mkdir(path.join(outsideDraftsRoot, recordingId));
  await writeFile(path.join(outsideDraftsRoot, recordingId, 'sentinel.txt'), 'outside');
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });

  const recordingsRoot = path.join(rootPath, '.reo', 'drafts', 'recordings');
  let swapped = false;
  const discarded = await discardRecordingDraft({
    rootPath,
    recordingId,
    beforeDraftDiscardRemove: async () => {
      swapped = true;
      await rename(recordingsRoot, `${recordingsRoot}-preserved`);
      await symlink(outsideDraftsRoot, recordingsRoot, 'dir');
    },
  } as Parameters<typeof discardRecordingDraft>[0] & {
    readonly beforeDraftDiscardRemove: () => Promise<void>;
  });

  assert.equal(swapped, true);
  assert.equal(discarded.ok, false);
  if (!discarded.ok) {
    assert.equal(discarded.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  await stat(path.join(outsideDraftsRoot, recordingId, 'sentinel.txt'));
});

test('recording draft rejects symlinked draft audio before appending chunks', async () => {
  const rootPath = await workspaceRoot();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-audio-outside-'));
  const outsideAudioPath = path.join(outside, 'outside.webm');
  await writeFile(outsideAudioPath, 'seed');
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => 'rec_20260506_symlinked_audio',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const draftDirectory = path.join(
    rootPath,
    '.reo',
    'drafts',
    'recordings',
    'rec_20260506_symlinked_audio'
  );
  const draftAudioPath = path.join(draftDirectory, 'audio.webm');
  await rm(draftAudioPath);
  await symlink(outsideAudioPath, draftAudioPath);

  const result = await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_symlinked_audio',
    sequence: 0,
    chunk: new Uint8Array([65, 66]),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
  assert.equal(await readFile(outsideAudioPath, 'utf8'), 'seed');
  assert.deepEqual(
    JSON.parse(await readFile(path.join(draftDirectory, 'recording.json'), 'utf8')),
    {
      schemaVersion: 1,
      workspaceId: 'ws_draft',
      recordingId: 'rec_20260506_symlinked_audio',
      status: 'draft',
      title: '',
      createdAt: '2026-05-06T13:08:00.000Z',
      nextSequence: 0,
      audioByteLength: 0,
    }
  );
});

test('recording draft create rejects ancestor swap before writing draft files', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_create_ancestor_swap';
  const draftsRoot = path.join(rootPath, '.reo', 'drafts', 'recordings');
  const preservedDraftsRoot = `${draftsRoot}-preserved`;
  const outsideDraftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-create-outside-'));

  setBeforeDraftDirectoryCreateForTest(async () => {
    await rename(draftsRoot, preservedDraftsRoot);
    await symlink(outsideDraftsRoot, draftsRoot, 'dir');
  });
  const result = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  setBeforeDraftDirectoryCreateForTest(null);

  assert.equal(result.ok, false);
  await assert.rejects(stat(path.join(outsideDraftsRoot, recordingId)));
  await assert.rejects(readFile(path.join(outsideDraftsRoot, recordingId, 'audio.webm')));
  await assert.rejects(readFile(path.join(outsideDraftsRoot, recordingId, 'recording.json')));
});

test('recording draft create does not touch outside parent after ancestor swap before mkdir', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_create_no_outside_touch';
  const draftsRoot = path.join(rootPath, '.reo', 'drafts', 'recordings');
  const outsideDraftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-create-touch-'));

  setBeforeDraftDirectoryCreateForTest(async () => {
    setBeforeDraftDirectoryCreateForTest(null);
    await rename(draftsRoot, `${draftsRoot}-preserved`);
    await symlink(outsideDraftsRoot, draftsRoot, 'dir');
  });
  setAfterDraftDirectoryCreateForTest(async () => {
    await writeFile(path.join(outsideDraftsRoot, recordingId, 'sentinel'), 'outside\n');
  });

  try {
    const result = await createRecordingDraft({
      rootPath,
      workspaceId: 'ws_draft',
      createRecordingId: () => recordingId,
      now: () => '2026-05-06T13:08:00.000Z',
    });

    assert.equal(result.ok, false);
    await assert.rejects(stat(path.join(outsideDraftsRoot, recordingId)));
  } finally {
    setBeforeDraftDirectoryCreateForTest(null);
    setAfterDraftDirectoryCreateForTest(null);
  }
});

test('recording draft create rejects ancestor swap after leaf directory create', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_create_after_leaf_swap';
  const draftsRoot = path.join(rootPath, '.reo', 'drafts', 'recordings');
  const outsideDraftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-after-leaf-'));
  const outsideDraftDirectory = path.join(outsideDraftsRoot, recordingId);

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
      createRecordingId: () => recordingId,
      now: () => '2026-05-06T13:08:00.000Z',
    });

    assert.equal(result.ok, false);
    await stat(outsideDraftDirectory);
    await assert.rejects(readFile(path.join(outsideDraftDirectory, 'audio.webm')));
    await assert.rejects(readFile(path.join(outsideDraftDirectory, 'recording.json')));
  } finally {
    setAfterDraftDirectoryCreateForTest(null);
  }
});

test('recording draft create does not touch outside parent after swap before audio create', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_create_audio_parent_swap';
  const draftsRoot = path.join(rootPath, '.reo', 'drafts', 'recordings');
  const outsideDraftsRoot = await mkdtemp(path.join(os.tmpdir(), 'reo-draft-audio-create-'));
  const outsideDraftDirectory = path.join(outsideDraftsRoot, recordingId);

  setBeforeDraftAudioCreateForTest(async () => {
    await mkdir(outsideDraftDirectory);
    await rename(draftsRoot, `${draftsRoot}-preserved`);
    await symlink(outsideDraftsRoot, draftsRoot, 'dir');
  });

  try {
    const result = await createRecordingDraft({
      rootPath,
      workspaceId: 'ws_draft',
      createRecordingId: () => recordingId,
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
  const recordingId = 'rec_20260506_create_lock_lost';
  let usable = true;
  setBeforeDraftAudioCreateForTest(() => {
    usable = false;
  });

  try {
    const result = await createRecordingDraft({
      rootPath,
      workspaceId: 'ws_draft',
      createRecordingId: () => recordingId,
      now: () => '2026-05-06T13:08:00.000Z',
      assertWorkspaceUsable: () => (usable ? { ok: true } : workspaceLockLost()),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
    await assert.rejects(stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId)));
  } finally {
    setBeforeDraftAudioCreateForTest(null);
  }
});

test('recording draft create aborts when workspace handle is lost before draft directory create', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_create_directory_lock_lost';
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
      createRecordingId: () => recordingId,
      now: () => '2026-05-06T13:08:00.000Z',
      assertWorkspaceUsable: () => (usable ? { ok: true } : workspaceLockLost()),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ERR_WORKSPACE_LOCK_LOST');
    }
    assert.equal(wroteAfterLockLost, false);
    await assert.rejects(stat(path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId)));
  } finally {
    setBeforeDraftDirectoryCreateForTest(null);
    setAfterDraftDirectoryCreateForTest(null);
  }
});

test('recording append rejects ancestor swap before opening draft audio', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_append_ancestor_swap';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const draftsRoot = path.join(rootPath, '.reo', 'drafts', 'recordings');
  const preservedDraftsRoot = `${draftsRoot}-preserved`;
  const outsideDraftDirectory = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-draft-append-outside-')),
    recordingId
  );
  await mkdir(outsideDraftDirectory);
  await writeFile(path.join(outsideDraftDirectory, 'audio.webm'), 'outside');
  await writeFile(
    path.join(outsideDraftDirectory, 'recording.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_draft',
        recordingId,
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
    recordingId,
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
    JSON.parse(await readFile(path.join(outsideDraftDirectory, 'recording.json'), 'utf8'))
      .audioByteLength,
    0
  );
});

test('recording append aborts when workspace handle is lost before audio write', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_append_lock_lost';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  let usable = true;
  setBeforeDraftAudioOpenForTest(() => {
    usable = false;
  });

  try {
    const result = await appendRecordingAudioChunk({
      rootPath,
      recordingId,
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
        path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId, 'recording.json'),
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
  const recordingId = 'rec_20260506_metadata_write_failure';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  const draftDirectory = path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId);

  await chmod(draftDirectory, 0o555);
  const appended = await appendRecordingAudioChunk({
    rootPath,
    recordingId,
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
  assert.deepEqual(
    JSON.parse(await readFile(path.join(draftDirectory, 'recording.json'), 'utf8')),
    {
      audioByteLength: 0,
      createdAt: '2026-05-06T13:08:00.000Z',
      nextSequence: 0,
      recordingId,
      schemaVersion: 1,
      status: 'draft',
      title: '',
      workspaceId: 'ws_draft',
    }
  );
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
    durationMs: 0,
    rootPath,
    recordingId: 'rec_20260506_000002',
    createMemoryId: () => 'mem_20260506_000002',
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
  const audio = await stat(
    path.join(
      rootPath,
      'memories',
      'mem_20260506_000002',
      'recordings',
      'rec_20260506_000002',
      'audio.webm'
    )
  );
  assert.equal(audio.size, 3);
});

test('recording append rejects stale draft when a finalized recording already exists', async () => {
  const rootPath = await workspaceRoot();
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => 'rec_20260506_stale_draft',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_stale_draft',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });
  const finalized = await finalizeRecordingDraft({
    durationMs: 3000,
    rootPath,
    recordingId: 'rec_20260506_stale_draft',
    createMemoryId: () => 'mem_20260506_stale_draft',
    title: '已完成录音',
    now: () => '2026-05-06T13:11:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const staleDraftDirectory = path.join(
    rootPath,
    '.reo',
    'drafts',
    'recordings',
    'rec_20260506_stale_draft'
  );
  await mkdir(staleDraftDirectory, { recursive: true });
  await writeFile(path.join(staleDraftDirectory, 'audio.webm'), new Uint8Array([7]));
  await writeFile(
    path.join(staleDraftDirectory, 'recording.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workspaceId: 'ws_draft',
        recordingId: 'rec_20260506_stale_draft',
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
    recordingId: 'rec_20260506_stale_draft',
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
          finalized.ok ? finalized.recording.memoryId : '',
          'recordings',
          'rec_20260506_stale_draft',
          'audio.webm'
        )
      )
    ).size,
    3
  );
});

test('recording append checks finalized truth after root draft state is cleared', async () => {
  const rootPath = await workspaceRoot();
  const recordingId = 'rec_20260506_active_draft_clear';
  await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_draft',
    createRecordingId: () => recordingId,
    now: () => '2026-05-06T13:08:00.000Z',
  });
  clearRecordingRuntimeStateForRoot(rootPath);
  await writeFinalizedRecordingForTest(rootPath, recordingId);

  const append = await appendRecordingAudioChunk({
    rootPath,
    recordingId,
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
    createRecordingId: () => 'rec_20260506_000003',
    now: () => '2026-05-06T13:12:00.000Z',
  });
  await rm(
    path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_000003', 'audio.webm')
  );

  const finalized = await finalizeRecordingDraft({
    durationMs: 0,
    rootPath,
    recordingId: 'rec_20260506_000003',
    createMemoryId: () => 'mem_20260506_000003',
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
    durationMs: 0,
    rootPath,
    recordingId: 'rec_20260506_000004',
    createMemoryId: () => 'mem_20260506_000004',
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
      path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_000004', 'recording.json'),
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
    createRecordingId: () => 'rec_seed',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_seed',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3, 4, 5]),
  });
  assert.equal(
    (
      await finalizeRecordingDraft({
        rootPath,
        workspaceId: 'ws_draft',
        recordingId: 'rec_seed',
        createMemoryId: () => 'mem_existing_size',
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
    createRecordingId: () => 'rec_append_size',
    now: () => '2026-05-06T13:10:00.000Z',
  });
  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_append_size',
    sequence: 0,
    chunk: new Uint8Array([6, 7]),
  });

  assert.deepEqual(
    await finalizeRecordingDraft({
      rootPath,
      workspaceId: 'ws_draft',
      recordingId: 'rec_append_size',
      memoryId: 'mem_existing_size',
      title: 'Append',
      durationMs: 2000,
      now: () => '2026-05-06T13:11:00.000Z',
    }),
    {
      ok: true,
      recording: {
        memoryId: 'mem_existing_size',
        recordingId: 'rec_append_size',
        title: 'Append',
        durationMs: 2000,
        audioByteLength: 2,
      },
      memory: {
        memoryId: 'mem_existing_size',
        title: 'Seed',
        createdAt: '2026-05-06T13:09:00.000Z',
        updatedAt: '2026-05-06T13:11:00.000Z',
        recordingCount: 2,
        durationMs: 3000,
        audioByteLength: 7,
        hasTranscript: false,
        hasReflections: false,
      },
    }
  );

  const index = JSON.parse(await readFile(path.join(rootPath, '.reo', 'index.json'), 'utf8'));
  assert.equal(index.memories[0].audioByteLength, 7);
});

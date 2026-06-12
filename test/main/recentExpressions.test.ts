import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createMemoryFromFileTruth, resolveMemoryDirectory } from '../../src/main/memoryFiles.js';
import {
  createNoteSegmentDraft,
  createSegmentSupplementNoteDraft,
  finalizeNoteSegmentDraft,
  finalizeSegmentSupplementNoteDraft,
  writeNoteSegmentDraftBody,
  writeSegmentSupplementNoteDraftBody,
} from '../../src/main/noteDrafts.js';
import { readRecentExpressionsFromWorkspaceSources } from '../../src/main/recentExpressions.js';
import {
  parseWorkspaceMarkdownObject,
  renderWorkspaceMarkdownObject,
} from '../../src/main/workspaceMarkdownObjects.js';
import { initializeWorkspaceFiles } from '../../src/main/workspaceFiles.js';

async function createWorkspaceWithMemory({
  memoryId,
  memoryTitle,
  title,
  workspaceId,
}: {
  readonly memoryId: string;
  readonly memoryTitle: string;
  readonly title: string;
  readonly workspaceId: string;
}): Promise<string> {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-recent-feed-'));
  const initialized = await initializeWorkspaceFiles({
    rootPath,
    title,
    description: '',
    createWorkspaceId: () => workspaceId,
    now: () => '2026-06-06T19:00:00.000-07:00',
  });
  assert.equal(initialized.ok, true);
  const memory = await createMemoryFromFileTruth({
    rootPath,
    memoryId,
    title: memoryTitle,
    now: () => '2026-06-06T19:01:00.000-07:00',
  });
  assert.equal(memory.ok, true);
  return rootPath;
}

async function createFinalizedNoteSegment({
  body,
  memoryId,
  rootPath,
  segmentId,
  title,
  updatedAt,
  workspaceId,
}: {
  readonly body: string;
  readonly memoryId: string;
  readonly rootPath: string;
  readonly segmentId: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly workspaceId: string;
}): Promise<void> {
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId,
    memoryId,
    title,
    createSegmentId: () => segmentId,
    now: () => updatedAt,
  });
  assert.equal(draft.ok, true);
  const written = await writeNoteSegmentDraftBody({
    rootPath,
    segmentId,
    bodyMarkdown: body,
    revision: 0,
  });
  assert.equal(written.ok, true);
  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId,
    memoryId,
    segmentId,
    title,
    now: () => updatedAt,
  });
  assert.equal(finalized.ok, true);
}

async function createFinalizedNoteSupplement({
  body,
  memoryId,
  rootPath,
  segmentId,
  supplementId,
  title,
  updatedAt,
  workspaceId,
}: {
  readonly body: string;
  readonly memoryId: string;
  readonly rootPath: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly workspaceId: string;
}): Promise<void> {
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId,
    memoryId,
    segmentId,
    title,
    createSupplementId: () => supplementId,
    now: () => updatedAt,
  });
  assert.equal(draft.ok, true);
  const written = await writeSegmentSupplementNoteDraftBody({
    rootPath,
    supplementId,
    bodyMarkdown: body,
    revision: 0,
  });
  assert.equal(written.ok, true);
  const finalized = await finalizeSegmentSupplementNoteDraft({
    rootPath,
    workspaceId,
    memoryId,
    segmentId,
    supplementId,
    title,
    now: () => updatedAt,
  });
  assert.equal(finalized.ok, true);
}

async function createFinalizedArtifactSegment({
  memoryId,
  rootPath,
  segmentId,
  title,
  updatedAt,
  workspaceId,
}: {
  readonly memoryId: string;
  readonly rootPath: string;
  readonly segmentId: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly workspaceId: string;
}): Promise<void> {
  const html = '<!doctype html><html><body><h1>作品</h1></body></html>\n';
  const segmentDirectory = path.join(
    await resolveMemoryDirectory(rootPath, memoryId),
    'segments',
    segmentId
  );
  await mkdir(segmentDirectory, { recursive: true });
  await writeFile(
    path.join(segmentDirectory, 'segment.md'),
    [
      '---',
      `id: ${segmentId}`,
      `title: ${title}`,
      'kind: artifact',
      'format: html',
      '---',
      '',
    ].join('\n')
  );
  await writeFile(path.join(segmentDirectory, 'entry.html'), html);
  await writeFile(path.join(segmentDirectory, 'runtime.json'), '{"schemaVersion":1}\n');
  await writeFile(path.join(segmentDirectory, 'state.json'), '{"schemaVersion":1,"stores":{}}\n');
  await mkdir(path.join(rootPath, '.reo', 'objects', 'segments'), { recursive: true });
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'segments', `${segmentId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'segment',
        workspaceId,
        memoryId,
        segmentId,
        kind: 'artifact',
        format: 'html',
        createdAt: updatedAt,
        finalizedAt: updatedAt,
        updatedAt,
        entryByteLength: Buffer.byteLength(html, 'utf8'),
        entryHash: createHash('sha256').update(html).digest('hex'),
      },
      null,
      2
    )}\n`
  );
}

async function createFinalizedAudioSegment({
  durationMs,
  memoryId,
  rootPath,
  segmentId,
  title,
  updatedAt,
  workspaceId,
}: {
  readonly durationMs: number;
  readonly memoryId: string;
  readonly rootPath: string;
  readonly segmentId: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly workspaceId: string;
}): Promise<void> {
  const audio = new Uint8Array([1, 2, 3]);
  const segmentDirectory = path.join(
    await resolveMemoryDirectory(rootPath, memoryId),
    'segments',
    segmentId
  );
  await mkdir(segmentDirectory, { recursive: true });
  await writeFile(path.join(segmentDirectory, 'audio.webm'), audio);
  await writeFile(
    path.join(segmentDirectory, 'segment.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: { title, kind: 'audio' },
      content: `# ${title}\n\n## Transcript\n\n`,
    })
  );
  await mkdir(path.join(rootPath, '.reo', 'objects', 'segments'), { recursive: true });
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'segments', `${segmentId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'segment',
        workspaceId,
        memoryId,
        segmentId,
        kind: 'audio',
        createdAt: updatedAt,
        finalizedAt: updatedAt,
        updatedAt,
        durationMs,
        nextSequence: 1,
        audioByteLength: audio.byteLength,
      },
      null,
      2
    )}\n`
  );
}

async function createFinalizedAudioSupplement({
  durationMs,
  memoryId,
  rootPath,
  segmentId,
  supplementId,
  title,
  updatedAt,
  workspaceId,
}: {
  readonly durationMs: number;
  readonly memoryId: string;
  readonly rootPath: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly workspaceId: string;
}): Promise<void> {
  const audio = new Uint8Array([4, 5, 6]);
  const supplementDirectory = path.join(
    await resolveMemoryDirectory(rootPath, memoryId),
    'segments',
    segmentId,
    'supplements',
    supplementId
  );
  await mkdir(supplementDirectory, { recursive: true });
  await writeFile(path.join(supplementDirectory, 'audio.webm'), audio);
  await writeFile(
    path.join(supplementDirectory, 'supplement.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'supplement',
      data: { title, kind: 'audio' },
      content: `# ${title}\n\n## Transcript\n\n`,
    })
  );
  await mkdir(path.join(rootPath, '.reo', 'objects', 'supplements'), { recursive: true });
  await writeFile(
    path.join(rootPath, '.reo', 'objects', 'supplements', `${supplementId}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        objectType: 'supplement',
        workspaceId,
        memoryId,
        segmentId,
        supplementId,
        kind: 'audio',
        createdAt: updatedAt,
        finalizedAt: updatedAt,
        updatedAt,
        durationMs,
        nextSequence: 1,
        audioByteLength: audio.byteLength,
      },
      null,
      2
    )}\n`
  );
}

async function writeReadySpeechForNoteSegment({
  memoryId,
  rootPath,
  segmentId,
}: {
  readonly memoryId: string;
  readonly rootPath: string;
  readonly segmentId: string;
}): Promise<void> {
  const audio = new Uint8Array([7, 8, 9]);
  const segmentsDirectory = path.join(await resolveMemoryDirectory(rootPath, memoryId), 'segments');
  const segmentEntry = (await readdir(segmentsDirectory, { withFileTypes: true })).find(
    (entry) =>
      entry.isDirectory() && (entry.name === segmentId || entry.name.startsWith(`${segmentId}--`))
  );
  if (!segmentEntry) {
    throw new Error(`Missing finalized segment directory for ${segmentId}`);
  }
  const segmentDirectory = path.join(segmentsDirectory, segmentEntry.name);
  const parsedMarkdown = parseWorkspaceMarkdownObject({
    markdown: await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'),
    objectType: 'segment',
  });
  const manifestPath = path.join(rootPath, '.reo', 'objects', 'segments', `${segmentId}.json`);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
  await writeFile(path.join(segmentDirectory, 'speech.mp3'), audio);
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        ...manifest,
        speechSynthesis: {
          audioByteLength: audio.byteLength,
          contentHash: createHash('sha256').update(parsedMarkdown.content).digest('hex'),
          format: 'mp3',
          lastSynthesisAttempt: 'success',
          mimeType: 'audio/mpeg',
          model: 'seed-tts-2.0-expressive',
          reason: null,
          resourceId: 'seed-tts-2.0',
          sampleRate: 24000,
          speaker: 'zh_female_vv_uranus_bigtts',
          updatedAt: '2026-06-06T20:20:00.000-07:00',
        },
      },
      null,
      2
    )}\n`
  );
}

test('readRecentExpressionsFromWorkspaceSources returns cross-space finalized segments and supplements newest first', async () => {
  const firstRoot = await createWorkspaceWithMemory({
    workspaceId: 'ws_recent_1',
    title: '灵感库',
    memoryId: 'mem_recent_1',
    memoryTitle: '产品想法',
  });
  const secondRoot = await createWorkspaceWithMemory({
    workspaceId: 'ws_recent_2',
    title: '项目库',
    memoryId: 'mem_recent_2',
    memoryTitle: '访谈记录',
  });
  try {
    await createFinalizedNoteSegment({
      rootPath: firstRoot,
      workspaceId: 'ws_recent_1',
      memoryId: 'mem_recent_1',
      segmentId: 'seg_old',
      title: '旧想法',
      body: '旧想法正文用于画廊摘要',
      updatedAt: '2026-06-06T20:00:00.000-07:00',
    });
    await createFinalizedNoteSegment({
      rootPath: secondRoot,
      workspaceId: 'ws_recent_2',
      memoryId: 'mem_recent_2',
      segmentId: 'seg_middle',
      title: '中间想法',
      body: '中间正文用于画廊摘要',
      updatedAt: '2026-06-06T20:05:00.000-07:00',
    });
    await createFinalizedNoteSupplement({
      rootPath: firstRoot,
      workspaceId: 'ws_recent_1',
      memoryId: 'mem_recent_1',
      segmentId: 'seg_old',
      supplementId: 'sup_new',
      title: '最新补充',
      body: '最新补充正文会显示在画廊卡片',
      updatedAt: '2026-06-06T20:10:00.000-07:00',
    });
    const unfinalized = await createNoteSegmentDraft({
      rootPath: firstRoot,
      workspaceId: 'ws_recent_1',
      memoryId: 'mem_recent_1',
      title: '未完成草稿',
      createSegmentId: () => 'seg_draft',
      now: () => '2026-06-06T20:30:00.000-07:00',
    });
    assert.equal(unfinalized.ok, true);
    await mkdir(path.join(firstRoot, 'widgets', 'wdg_recent_widget--Widget'), {
      recursive: true,
    });

    const feed = await readRecentExpressionsFromWorkspaceSources({
      limit: 10,
      sources: [
        {
          rootPath: firstRoot,
          workspaceId: 'ws_recent_1',
          workspaceTitle: '灵感库',
        },
        {
          rootPath: secondRoot,
          workspaceId: 'ws_recent_2',
          workspaceTitle: '项目库',
        },
      ],
    });

    assert.deepEqual(
      feed.items.map((item) => ({
        objectType: item.objectType,
        segmentId: item.segmentId,
        supplementId: item.objectType === 'supplement' ? item.supplementId : null,
        title: item.title,
        preview: item.preview,
        coverSource: (item as { readonly cover?: { readonly source: string } }).cover?.source,
        workspaceTitle: item.workspaceTitle,
      })),
      [
        {
          objectType: 'supplement',
          segmentId: 'seg_old',
          supplementId: 'sup_new',
          title: '最新补充',
          preview: '最新补充正文会显示在画廊卡片',
          coverSource: 'default',
          workspaceTitle: '灵感库',
        },
        {
          objectType: 'segment',
          segmentId: 'seg_middle',
          supplementId: null,
          title: '中间想法',
          preview: '中间正文用于画廊摘要',
          coverSource: 'default',
          workspaceTitle: '项目库',
        },
        {
          objectType: 'segment',
          segmentId: 'seg_old',
          supplementId: null,
          title: '旧想法',
          preview: '旧想法正文用于画廊摘要',
          coverSource: 'default',
          workspaceTitle: '灵感库',
        },
      ]
    );
    assert.deepEqual(feed.skipped, []);
    assert.equal(
      feed.items.some((item) => item.segmentId === 'seg_draft'),
      false
    );
  } finally {
    await rm(firstRoot, { force: true, recursive: true });
    await rm(secondRoot, { force: true, recursive: true });
  }
});

test('readRecentExpressionsFromWorkspaceSources attaches playback only for audio and ready note speech', async () => {
  const rootPath = await createWorkspaceWithMemory({
    workspaceId: 'ws_recent_playback',
    title: '播放测试库',
    memoryId: 'mem_recent_playback',
    memoryTitle: '播放材料',
  });
  const readyBody = 'Ready note body for speech.';
  try {
    await createFinalizedAudioSegment({
      rootPath,
      workspaceId: 'ws_recent_playback',
      memoryId: 'mem_recent_playback',
      segmentId: 'seg_playback_audio',
      title: '录音',
      durationMs: 1200,
      updatedAt: '2026-06-06T20:01:00.000-07:00',
    });
    await createFinalizedAudioSupplement({
      rootPath,
      workspaceId: 'ws_recent_playback',
      memoryId: 'mem_recent_playback',
      segmentId: 'seg_playback_audio',
      supplementId: 'sup_playback_audio',
      title: '补充录音',
      durationMs: 800,
      updatedAt: '2026-06-06T20:02:00.000-07:00',
    });
    await createFinalizedNoteSegment({
      rootPath,
      workspaceId: 'ws_recent_playback',
      memoryId: 'mem_recent_playback',
      segmentId: 'seg_playback_note_ready',
      title: '可播放笔记',
      body: readyBody,
      updatedAt: '2026-06-06T20:03:00.000-07:00',
    });
    await writeReadySpeechForNoteSegment({
      rootPath,
      memoryId: 'mem_recent_playback',
      segmentId: 'seg_playback_note_ready',
    });
    await createFinalizedNoteSegment({
      rootPath,
      workspaceId: 'ws_recent_playback',
      memoryId: 'mem_recent_playback',
      segmentId: 'seg_playback_note_missing',
      title: '无语音笔记',
      body: 'Missing speech note body.',
      updatedAt: '2026-06-06T20:04:00.000-07:00',
    });
    await createFinalizedArtifactSegment({
      rootPath,
      workspaceId: 'ws_recent_playback',
      memoryId: 'mem_recent_playback',
      segmentId: 'seg_playback_artifact',
      title: '作品',
      updatedAt: '2026-06-06T20:05:00.000-07:00',
    });

    const feed = await readRecentExpressionsFromWorkspaceSources({
      limit: 10,
      sources: [
        {
          rootPath,
          workspaceId: 'ws_recent_playback',
          workspaceTitle: '播放测试库',
        },
      ],
    });
    const playbackByTarget = new Map(
      feed.items.map((item) => [
        `${item.objectType}:${item.segmentId}:${
          item.objectType === 'supplement' ? item.supplementId : ''
        }`,
        item.playback ?? null,
      ])
    );

    assert.deepEqual(playbackByTarget.get('segment:seg_playback_audio:'), {
      kind: 'audio',
      durationMs: 1200,
    });
    assert.deepEqual(playbackByTarget.get('supplement:seg_playback_audio:sup_playback_audio'), {
      kind: 'audio',
      durationMs: 800,
    });
    assert.deepEqual(playbackByTarget.get('segment:seg_playback_note_ready:'), {
      kind: 'note-speech',
    });
    assert.equal(playbackByTarget.get('segment:seg_playback_note_missing:'), null);
    assert.equal(playbackByTarget.get('segment:seg_playback_artifact:'), null);
  } finally {
    await rm(rootPath, { force: true, recursive: true });
  }
});

test('readRecentExpressionsFromWorkspaceSources returns redacted skipped summaries for unavailable sources', async () => {
  const missingRoot = path.join(os.tmpdir(), `reo-missing-feed-${Date.now()}`);
  const feed = await readRecentExpressionsFromWorkspaceSources({
    limit: 10,
    sources: [
      {
        rootPath: missingRoot,
        workspaceId: 'ws_missing',
        workspaceTitle: '缺失空间',
      },
    ],
  });

  assert.deepEqual(feed.items, []);
  assert.deepEqual(feed.skipped, [
    {
      workspaceId: 'ws_missing',
      workspaceTitle: '缺失空间',
      reason: 'missing',
    },
  ]);
  assert.equal('rootPath' in feed.skipped[0]!, false);
});

test('readRecentExpressionsFromWorkspaceSources reports partial memory read errors without hiding readable items', async () => {
  const rootPath = await createWorkspaceWithMemory({
    workspaceId: 'ws_recent_partial_error',
    title: '部分错误库',
    memoryId: 'mem_recent_partial_good',
    memoryTitle: '可读记忆',
  });
  try {
    await createFinalizedNoteSegment({
      rootPath,
      workspaceId: 'ws_recent_partial_error',
      memoryId: 'mem_recent_partial_good',
      segmentId: 'seg_partial_good',
      title: '可读条目',
      body: '这条内容仍应显示',
      updatedAt: '2026-06-06T20:00:00.000-07:00',
    });
    await mkdir(path.join(rootPath, 'memories', 'mem_recent_partial_bad--坏记忆'), {
      recursive: true,
    });

    const feed = await readRecentExpressionsFromWorkspaceSources({
      limit: 10,
      sources: [
        {
          rootPath,
          workspaceId: 'ws_recent_partial_error',
          workspaceTitle: '部分错误库',
        },
      ],
    });

    assert.deepEqual(
      feed.items.map((item) => item.segmentId),
      ['seg_partial_good']
    );
    assert.deepEqual(feed.skipped, [
      {
        workspaceId: 'ws_recent_partial_error',
        workspaceTitle: '部分错误库',
        reason: 'read-error',
      },
    ]);
    assert.equal('rootPath' in feed.skipped[0]!, false);
  } finally {
    await rm(rootPath, { force: true, recursive: true });
  }
});

test('readRecentExpressionsFromWorkspaceSources reads covers only after applying the limit', async () => {
  const rootPath = await createWorkspaceWithMemory({
    workspaceId: 'ws_recent_limit',
    title: '性能测试库',
    memoryId: 'mem_recent_limit',
    memoryTitle: '加载测试',
  });
  try {
    await createFinalizedNoteSegment({
      rootPath,
      workspaceId: 'ws_recent_limit',
      memoryId: 'mem_recent_limit',
      segmentId: 'seg_old_limit',
      title: '旧条目',
      body: '旧条目正文不应该为了 limit 1 被读取',
      updatedAt: '2026-06-06T20:00:00.000-07:00',
    });
    await createFinalizedNoteSegment({
      rootPath,
      workspaceId: 'ws_recent_limit',
      memoryId: 'mem_recent_limit',
      segmentId: 'seg_new_limit',
      title: '新条目',
      body: '新条目正文应该进入展示摘要',
      updatedAt: '2026-06-06T20:10:00.000-07:00',
    });
    const coverTargets: string[] = [];

    const feed = await readRecentExpressionsFromWorkspaceSources({
      limit: 1,
      readCover: async ({ segmentDirectory, templateId }) => {
        coverTargets.push(path.basename(segmentDirectory));
        return templateId ? { source: 'default', templateId } : { source: 'default' };
      },
      sources: [
        {
          rootPath,
          workspaceId: 'ws_recent_limit',
          workspaceTitle: '性能测试库',
        },
      ],
    });

    assert.deepEqual(coverTargets, ['seg_new_limit--新条目']);
    assert.deepEqual(
      feed.items.map((item) => ({
        coverSource: item.cover?.source,
        segmentId: item.segmentId,
        preview: item.preview,
      })),
      [
        {
          coverSource: 'default',
          segmentId: 'seg_new_limit',
          preview: '新条目正文应该进入展示摘要',
        },
      ]
    );
  } finally {
    await rm(rootPath, { force: true, recursive: true });
  }
});

test('readRecentExpressionsFromWorkspaceSources filters content kinds before limit', async () => {
  const rootPath = await createWorkspaceWithMemory({
    workspaceId: 'ws_recent_kind_filter',
    title: '类型过滤库',
    memoryId: 'mem_recent_kind_filter',
    memoryTitle: '类型测试',
  });
  try {
    await createFinalizedNoteSegment({
      rootPath,
      workspaceId: 'ws_recent_kind_filter',
      memoryId: 'mem_recent_kind_filter',
      segmentId: 'seg_kind_note',
      title: '应该显示的笔记',
      body: '笔记正文应该进入画廊',
      updatedAt: '2026-06-06T20:00:00.000-07:00',
    });
    await createFinalizedArtifactSegment({
      rootPath,
      workspaceId: 'ws_recent_kind_filter',
      memoryId: 'mem_recent_kind_filter',
      segmentId: 'seg_kind_artifact',
      title: '更新但不应显示的作品',
      updatedAt: '2026-06-06T20:30:00.000-07:00',
    });

    const feed = await readRecentExpressionsFromWorkspaceSources({
      contentKinds: ['audio', 'note'],
      limit: 1,
      sources: [
        {
          rootPath,
          workspaceId: 'ws_recent_kind_filter',
          workspaceTitle: '类型过滤库',
        },
      ],
    });

    assert.deepEqual(
      feed.items.map((item) => ({
        contentKind: item.contentKind,
        segmentId: item.segmentId,
        title: item.title,
      })),
      [
        {
          contentKind: 'note',
          segmentId: 'seg_kind_note',
          title: '应该显示的笔记',
        },
      ]
    );
  } finally {
    await rm(rootPath, { force: true, recursive: true });
  }
});

test('readRecentExpressionsFromWorkspaceSources bounds concurrent return item hydration', async () => {
  const rootPath = await createWorkspaceWithMemory({
    workspaceId: 'ws_recent_preview_concurrency',
    title: '预览并发测试库',
    memoryId: 'mem_recent_preview_concurrency',
    memoryTitle: '加载测试',
  });
  try {
    for (let index = 0; index < 13; index += 1) {
      await createFinalizedNoteSegment({
        rootPath,
        workspaceId: 'ws_recent_preview_concurrency',
        memoryId: 'mem_recent_preview_concurrency',
        segmentId: `seg_preview_concurrency_${index}`,
        title: `预览条目 ${index}`,
        body: `预览正文 ${index}`,
        updatedAt: `2026-06-06T20:${String(index).padStart(2, '0')}:00.000-07:00`,
      });
    }

    let inFlight = 0;
    let maxInFlight = 0;
    const feed = await readRecentExpressionsFromWorkspaceSources({
      limit: 13,
      readCover: async ({ templateId }) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return templateId ? { source: 'default', templateId } : { source: 'default' };
      },
      sources: [
        {
          rootPath,
          workspaceId: 'ws_recent_preview_concurrency',
          workspaceTitle: '预览并发测试库',
        },
      ],
    });

    assert.equal(feed.items.length, 13);
    assert.equal(maxInFlight, 12);
  } finally {
    await rm(rootPath, { force: true, recursive: true });
  }
});

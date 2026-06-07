import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createMemoryFromFileTruth } from '../../src/main/memoryFiles.js';
import {
  createNoteSegmentDraft,
  createSegmentSupplementNoteDraft,
  finalizeNoteSegmentDraft,
  finalizeSegmentSupplementNoteDraft,
  writeNoteSegmentDraftBody,
  writeSegmentSupplementNoteDraftBody,
} from '../../src/main/noteDrafts.js';
import { readRecentExpressionsFromWorkspaceSources } from '../../src/main/recentExpressions.js';
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
      body: 'old body',
      updatedAt: '2026-06-06T20:00:00.000-07:00',
    });
    await createFinalizedNoteSegment({
      rootPath: secondRoot,
      workspaceId: 'ws_recent_2',
      memoryId: 'mem_recent_2',
      segmentId: 'seg_middle',
      title: '中间想法',
      body: 'middle body',
      updatedAt: '2026-06-06T20:05:00.000-07:00',
    });
    await createFinalizedNoteSupplement({
      rootPath: firstRoot,
      workspaceId: 'ws_recent_1',
      memoryId: 'mem_recent_1',
      segmentId: 'seg_old',
      supplementId: 'sup_new',
      title: '最新补充',
      body: 'new supplement',
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
        workspaceTitle: item.workspaceTitle,
      })),
      [
        {
          objectType: 'supplement',
          segmentId: 'seg_old',
          supplementId: 'sup_new',
          title: '最新补充',
          workspaceTitle: '灵感库',
        },
        {
          objectType: 'segment',
          segmentId: 'seg_middle',
          supplementId: null,
          title: '中间想法',
          workspaceTitle: '项目库',
        },
        {
          objectType: 'segment',
          segmentId: 'seg_old',
          supplementId: null,
          title: '旧想法',
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

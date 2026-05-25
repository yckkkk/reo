import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createMemoryFromFileTruth,
  assertNoDuplicateSegmentDirectoryById,
  memorySegmentDirectory,
  readMemoryDetailFromFileTruth,
  resolveSegmentSupplementDirectoryInSegmentDirectory,
  setBeforeMemoryDetailProjectionForTest,
  setBeforeSegmentFileTruthListForTest,
} from '../../src/main/memoryFiles.js';
import {
  createNoteSegmentDraft,
  createSegmentSupplementNoteDraft,
  finalizeNoteSegmentDraft,
  finalizeSegmentSupplementNoteDraft,
  readFinalizedNoteSegmentSupplementContent,
  readFinalizedNoteSegmentContent,
  setBeforeFinalizedNoteMarkdownWriteForTest,
  setBeforeNoteFinalizeTargetDirectoryCreateForTest,
  writeFinalizedNoteSegmentContent,
  writeFinalizedNoteSegmentSupplementContent,
  writeSegmentSupplementNoteDraftBody,
  writeNoteSegmentDraftBody,
} from '../../src/main/noteDrafts.js';
import { saveNoteSegmentAttachment } from '../../src/main/noteAttachments.js';
import { initializeWorkspaceFiles } from '../../src/main/workspaceFiles.js';
import { parseWorkspaceMarkdownObject } from '../../src/main/workspaceMarkdownObjects.js';

async function workspaceRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-note-draft-'));
  await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Notes',
    description: '',
    createWorkspaceId: () => 'ws_note',
    now: () => '2026-05-19T12:40:00.000Z',
  });
  return root;
}

function deferred(): {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
} {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function contentHash(markdown: string): string {
  return createHash('sha256').update(markdown).digest('hex');
}

async function readNoteSegmentBaselineContentHash({
  rootPath,
  memoryId,
  segmentId,
}: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly segmentId: string;
}): Promise<string> {
  const content = await readFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId,
    segmentId,
  });
  assert.equal(content.ok, true);
  if (!content.ok) {
    throw new Error('note segment content must be readable');
  }
  return content.baselineContentHash;
}

async function readNoteSupplementBaselineContentHash({
  rootPath,
  memoryId,
  segmentId,
  supplementId,
}: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
}): Promise<string> {
  const content = await readFinalizedNoteSegmentSupplementContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId,
    segmentId,
    supplementId,
  });
  assert.equal(content.ok, true);
  if (!content.ok) {
    throw new Error('note supplement content must be readable');
  }
  return content.baselineContentHash;
}

async function singleMemoryDirectory(rootPath: string): Promise<string> {
  const memories = await readdir(path.join(rootPath, 'memories'));
  assert.equal(memories.length, 1);
  return path.join(rootPath, 'memories', memories[0] ?? '');
}

async function createDuplicateSegmentDirectory({
  rootPath,
  duplicateMemoryId,
  segmentId,
}: {
  readonly rootPath: string;
  readonly duplicateMemoryId: string;
  readonly segmentId: string;
}): Promise<void> {
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: duplicateMemoryId,
    title: 'Duplicate memory',
    now: () => '2026-05-19T12:41:30.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const duplicateSegmentDirectory = await memorySegmentDirectory(
    rootPath,
    duplicateMemoryId,
    segmentId
  );
  await mkdir(duplicateSegmentDirectory, { recursive: true });
}

test('note segment draft writes markdown body and finalizes as durable note file truth', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);

  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_note',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  assert.equal(draft.revision, 0);

  const write = await writeNoteSegmentDraftBody({
    rootPath,
    segmentId: 'seg_note',
    bodyMarkdown: '# Draft note\n\nA note body.\n',
    revision: 0,
  });
  assert.equal(write.ok, true);
  assert.equal(write.revision, 1);

  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_note',
    title: 'Final note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(finalized.ok, true, JSON.stringify(finalized));
  assert.equal(finalized.segment.type, 'note');
  assert.equal(finalized.memory.noteSegmentCount, 1);
  assert.equal(finalized.memory.hasAnyNote, true);

  const detail = await readMemoryDetailFromFileTruth({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
  });
  assert.equal(detail.ok, true);
  assert.equal(detail.value.segments[0]?.type, 'note');
  assert.equal(
    detail.value.segments[0]?.bodyByteLength,
    Buffer.byteLength('# Draft note\n\nA note body.\n')
  );

  const manifest = JSON.parse(
    await readFile(path.join(rootPath, '.reo', 'objects', 'segments', 'seg_note.json'), 'utf8')
  ) as Record<string, unknown>;
  assert.equal(manifest['kind'], 'note');
  assert.equal(manifest['bodyByteLength'], Buffer.byteLength('# Draft note\n\nA note body.\n'));

  const segmentDirectory = await memorySegmentDirectory(rootPath, 'mem_note', 'seg_note');
  assert.equal((await stat(segmentDirectory)).isDirectory(), true);
  assert.equal(path.basename(segmentDirectory), 'seg_note--Final note');
  const segmentMarkdown = parseWorkspaceMarkdownObject({
    markdown: await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8'),
    objectType: 'segment',
  });
  assert.equal('kind' in segmentMarkdown.data ? segmentMarkdown.data.kind : undefined, 'note');
  assert.equal(segmentMarkdown.data.title, 'Final note');
  assert.equal(segmentMarkdown.content, '# Draft note\n\nA note body.\n');
});

test('finalized note segment content remains readable after content tab order is persisted', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);

  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_note_order',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const write = await writeNoteSegmentDraftBody({
    rootPath,
    segmentId: 'seg_note_order',
    bodyMarkdown: 'Readable body after tab order.\n',
    revision: 0,
  });
  assert.equal(write.ok, true);

  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_note_order',
    title: 'Ordered note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const manifestPath = path.join(rootPath, '.reo', 'objects', 'segments', 'seg_note_order.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
  await writeFile(
    manifestPath,
    JSON.stringify({ ...manifest, contentTabOrder: ['segment'] }, null, 2)
  );

  const content = await readFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_note_order',
  });

  assert.equal(content.ok, true, JSON.stringify(content));
  if (content.ok) {
    assert.equal(content.bodyMarkdown, 'Readable body after tab order.\n');
  }
});

test('note supplement draft finalizes under an existing segment with note body byte truth', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_parent',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_parent',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);

  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_parent',
    title: 'Supplement note',
    createSupplementId: () => 'sup_note',
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(draft.ok, true);
  assert.equal(draft.revision, 0);

  const write = await writeSegmentSupplementNoteDraftBody({
    rootPath,
    supplementId: 'sup_note',
    bodyMarkdown: 'Supplement body\n',
    revision: 0,
  });
  assert.equal(write.ok, true);
  assert.equal(write.revision, 1);

  const finalized = await finalizeSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_parent',
    supplementId: 'sup_note',
    title: 'Final supplement',
    now: () => '2026-05-19T12:45:00.000Z',
  });
  assert.equal(finalized.ok, true, JSON.stringify(finalized));
  assert.equal(finalized.supplement.type, 'note');
  assert.equal(finalized.segment.supplementCount, 1);
  assert.equal(finalized.memory.hasAnyNote, true);

  const manifest = JSON.parse(
    await readFile(path.join(rootPath, '.reo', 'objects', 'supplements', 'sup_note.json'), 'utf8')
  ) as Record<string, unknown>;
  assert.equal(manifest['kind'], 'note');
  assert.equal(manifest['bodyByteLength'], Buffer.byteLength('Supplement body\n'));
  const parentDirectory = await memorySegmentDirectory(rootPath, 'mem_note', 'seg_parent');
  const supplementDirectory = await resolveSegmentSupplementDirectoryInSegmentDirectory({
    rootPath,
    memoryId: 'mem_note',
    segmentDirectory: parentDirectory,
    segmentId: 'seg_parent',
    supplementId: 'sup_note',
  });
  assert.equal(path.basename(supplementDirectory), 'sup_note--Final supplement');
});

test('note supplement draft rejects unsafe parent segment markdown without reading through it', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_unsafe_parent',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_unsafe_parent',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);
  const parentDirectory = await memorySegmentDirectory(rootPath, 'mem_note', 'seg_unsafe_parent');
  const parentMarkdownPath = path.join(parentDirectory, 'segment.md');
  const outsideMarkdown = path.join(os.tmpdir(), `reo-note-parent-outside-${process.pid}.md`);
  await writeFile(outsideMarkdown, '---\ntitle: Outside\nkind: note\n---\nOutside body\n');
  await rm(parentMarkdownPath);
  await symlink(outsideMarkdown, parentMarkdownPath);

  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_unsafe_parent',
    title: 'Supplement note',
    createSupplementId: () => 'sup_unsafe_parent',
    now: () => '2026-05-19T12:44:00.000Z',
  });

  assert.equal(draft.ok, false);
  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'drafts', 'supplements', 'sup_unsafe_parent')),
    /ENOENT/
  );
});

test('note segment draft write rejects symlinked draft metadata without reading through it', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_draft_metadata_symlink',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const draftDirectory = path.join(
    rootPath,
    '.reo',
    'drafts',
    'segments',
    'seg_draft_metadata_symlink'
  );
  const metadataPath = path.join(draftDirectory, 'segment.json');
  const outsideMetadata = path.join(
    os.tmpdir(),
    `reo-note-draft-segment-metadata-${process.pid}.json`
  );
  const originalMetadata = await readFile(metadataPath, 'utf8');
  await writeFile(outsideMetadata, originalMetadata);
  await rm(metadataPath);
  await symlink(outsideMetadata, metadataPath);

  const write = await writeNoteSegmentDraftBody({
    rootPath,
    segmentId: 'seg_draft_metadata_symlink',
    bodyMarkdown: 'Should not write\n',
    revision: 0,
  });

  assert.equal(write.ok, false);
  assert.equal(await readFile(outsideMetadata, 'utf8'), originalMetadata);
  const draftBody = await readFile(path.join(draftDirectory, 'segment.md'), 'utf8');
  assert.equal(draftBody.includes('Should not write'), false);
});

test('note segment finalize rejects symlinked draft markdown without reading through it', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_draft_markdown_symlink',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const draftDirectory = path.join(
    rootPath,
    '.reo',
    'drafts',
    'segments',
    'seg_draft_markdown_symlink'
  );
  const markdownPath = path.join(draftDirectory, 'segment.md');
  const outsideMarkdown = path.join(
    os.tmpdir(),
    `reo-note-draft-segment-markdown-${process.pid}.md`
  );
  await writeFile(outsideMarkdown, '---\ntitle: Outside\nkind: note\n---\nOutside body\n');
  await rm(markdownPath);
  await symlink(outsideMarkdown, markdownPath);

  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_draft_markdown_symlink',
    title: 'Should not finalize',
    now: () => '2026-05-19T12:43:00.000Z',
  });

  assert.equal(finalized.ok, false);
  await assert.rejects(
    stat(
      path.join(
        rootPath,
        'memories',
        'mem_note',
        'segments',
        'seg_draft_markdown_symlink--Should not finalize'
      )
    ),
    /ENOENT/
  );
  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'objects', 'segments', 'seg_draft_markdown_symlink.json')),
    /ENOENT/
  );
});

test('note supplement draft write rejects symlinked draft metadata without reading through it', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_supplement_draft_metadata_parent',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_draft_metadata_parent',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_draft_metadata_parent',
    title: 'Supplement note',
    createSupplementId: () => 'sup_draft_metadata_symlink',
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(draft.ok, true);
  const draftDirectory = path.join(
    rootPath,
    '.reo',
    'drafts',
    'supplements',
    'sup_draft_metadata_symlink'
  );
  const metadataPath = path.join(draftDirectory, 'supplement.json');
  const outsideMetadata = path.join(
    os.tmpdir(),
    `reo-note-draft-supplement-metadata-${process.pid}.json`
  );
  const originalMetadata = await readFile(metadataPath, 'utf8');
  await writeFile(outsideMetadata, originalMetadata);
  await rm(metadataPath);
  await symlink(outsideMetadata, metadataPath);

  const write = await writeSegmentSupplementNoteDraftBody({
    rootPath,
    supplementId: 'sup_draft_metadata_symlink',
    bodyMarkdown: 'Should not write supplement\n',
    revision: 0,
  });

  assert.equal(write.ok, false);
  assert.equal(await readFile(outsideMetadata, 'utf8'), originalMetadata);
  const draftBody = await readFile(path.join(draftDirectory, 'supplement.md'), 'utf8');
  assert.equal(draftBody.includes('Should not write supplement'), false);
});

test('note supplement finalize rejects symlinked draft markdown without reading through it', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_supplement_draft_markdown_parent',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_draft_markdown_parent',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_draft_markdown_parent',
    title: 'Supplement note',
    createSupplementId: () => 'sup_draft_markdown_symlink',
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(draft.ok, true);
  const draftDirectory = path.join(
    rootPath,
    '.reo',
    'drafts',
    'supplements',
    'sup_draft_markdown_symlink'
  );
  const markdownPath = path.join(draftDirectory, 'supplement.md');
  const outsideMarkdown = path.join(
    os.tmpdir(),
    `reo-note-draft-supplement-markdown-${process.pid}.md`
  );
  await writeFile(outsideMarkdown, '---\ntitle: Outside\nkind: note\n---\nOutside supplement\n');
  await rm(markdownPath);
  await symlink(outsideMarkdown, markdownPath);

  const finalized = await finalizeSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_draft_markdown_parent',
    supplementId: 'sup_draft_markdown_symlink',
    title: 'Should not finalize',
    now: () => '2026-05-19T12:45:00.000Z',
  });

  assert.equal(finalized.ok, false);
  await assert.rejects(
    stat(
      path.join(
        rootPath,
        'memories',
        'mem_note',
        'segments',
        'seg_supplement_draft_markdown_parent',
        'supplements',
        'sup_draft_markdown_symlink--Should not finalize'
      )
    ),
    /ENOENT/
  );
  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'objects', 'supplements', 'sup_draft_markdown_symlink.json')),
    /ENOENT/
  );
});

test('note segment finalize preserves the draft and does not expose durable files when index refresh fails', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);

  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_refresh_failure',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const write = await writeNoteSegmentDraftBody({
    rootPath,
    segmentId: 'seg_refresh_failure',
    bodyMarkdown: 'Uncommitted note body\n',
    revision: 0,
  });
  assert.equal(write.ok, true);

  await writeFile(path.join(rootPath, '.reo', 'index.json'), '{broken');
  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_refresh_failure',
    title: 'Should not commit',
    now: () => '2026-05-19T12:43:00.000Z',
  });

  assert.equal(finalized.ok, false);
  await assert.rejects(
    stat(path.join(rootPath, 'memories', 'mem_note', 'segments', 'seg_refresh_failure')),
    /ENOENT/
  );
  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'objects', 'segments', 'seg_refresh_failure.json')),
    /ENOENT/
  );
  const preservedDraft = parseWorkspaceMarkdownObject({
    markdown: await readFile(
      path.join(rootPath, '.reo', 'drafts', 'segments', 'seg_refresh_failure', 'segment.md'),
      'utf8'
    ),
    objectType: 'segment',
  });
  assert.equal(preservedDraft.data.title, 'Draft note');
  assert.equal('kind' in preservedDraft.data ? preservedDraft.data.kind : undefined, 'note');
  assert.equal(preservedDraft.content, 'Uncommitted note body\n');
});

test('note segment finalize does not scan full Memory detail for parent existence', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_narrow_parent_check',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);

  let fullDetailScans = 0;
  setBeforeSegmentFileTruthListForTest(() => {
    fullDetailScans += 1;
  });
  try {
    const finalized = await finalizeNoteSegmentDraft({
      rootPath,
      workspaceId: 'ws_note',
      memoryId: 'mem_note',
      segmentId: 'seg_narrow_parent_check',
      title: '',
      now: () => '2026-05-19T12:43:00.000Z',
    });

    assert.equal(finalized.ok, false);
    assert.equal(fullDetailScans, 0);
  } finally {
    setBeforeSegmentFileTruthListForTest(null);
  }
});

test('note segment finalize returns targeted projection without full Memory detail projection', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_no_detail_projection',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);

  setBeforeMemoryDetailProjectionForTest(() => {
    throw new Error('full detail projection is not allowed');
  });
  try {
    const finalized = await finalizeNoteSegmentDraft({
      rootPath,
      workspaceId: 'ws_note',
      memoryId: 'mem_note',
      segmentId: 'seg_no_detail_projection',
      title: 'No detail projection',
      now: () => '2026-05-19T12:43:00.000Z',
    });

    assert.equal(finalized.ok, true, JSON.stringify(finalized));
    assert.equal(finalized.segment.segmentId, 'seg_no_detail_projection');
    assert.equal(finalized.segment.type, 'note');
  } finally {
    setBeforeMemoryDetailProjectionForTest(null);
  }
});

test('note segment finalize rejects memory parent swap before target directory create', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_parent_swap',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const memoryDirectory = await singleMemoryDirectory(rootPath);
  const outsideDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-note-outside-segments-'));

  setBeforeNoteFinalizeTargetDirectoryCreateForTest(async () => {
    setBeforeNoteFinalizeTargetDirectoryCreateForTest(null);
    await rm(memoryDirectory, { recursive: true, force: true });
    await symlink(outsideDirectory, memoryDirectory);
  });
  try {
    const finalized = await finalizeNoteSegmentDraft({
      rootPath,
      workspaceId: 'ws_note',
      memoryId: 'mem_note',
      segmentId: 'seg_parent_swap',
      title: 'Escaping note',
      now: () => '2026-05-19T12:43:00.000Z',
    });

    assert.equal(finalized.ok, false);
    await assert.rejects(stat(path.join(outsideDirectory, 'segments')), /ENOENT/);
  } finally {
    setBeforeNoteFinalizeTargetDirectoryCreateForTest(null);
  }
});

test('note segment finalize preserves unsafe parent memory errors', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_unsafe_parent_memory',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const memoryDirectory = await singleMemoryDirectory(rootPath);
  const outsideFile = path.join(
    await mkdtemp(path.join(os.tmpdir(), 'reo-note-outside-memory-')),
    'memory.md'
  );
  await writeFile(outsideFile, 'outside');
  await rm(path.join(memoryDirectory, 'memory.md'));
  await symlink(outsideFile, path.join(memoryDirectory, 'memory.md'));

  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_unsafe_parent_memory',
    title: 'Unsafe parent',
    now: () => '2026-05-19T12:43:00.000Z',
  });

  assert.equal(finalized.ok, false);
  assert.equal(finalized.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
});

test('finalized note segment edit preserves previous markdown when index refresh fails', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_edit_refresh_failure',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const write = await writeNoteSegmentDraftBody({
    rootPath,
    segmentId: 'seg_edit_refresh_failure',
    bodyMarkdown: 'Original body\n',
    revision: 0,
  });
  assert.equal(write.ok, true);
  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_edit_refresh_failure',
    title: 'Editable note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const baselineContentHash = await readNoteSegmentBaselineContentHash({
    rootPath,
    memoryId: 'mem_note',
    segmentId: 'seg_edit_refresh_failure',
  });
  await writeFile(path.join(rootPath, '.reo', 'index.json'), '{broken');
  const saved = await writeFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_edit_refresh_failure',
    bodyMarkdown: 'Changed body\n',
    baselineContentHash,
    now: () => '2026-05-19T12:44:00.000Z',
  });

  assert.equal(saved.ok, false);
  const content = await readFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_edit_refresh_failure',
  });
  assert.equal(content.ok, true);
  if (content.ok) {
    assert.equal(content.bodyMarkdown, 'Original body\n');
  }
});

test('finalized note segment edit refreshes summary without full Memory detail projection', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_edit_no_detail_projection',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_edit_no_detail_projection',
    title: 'Editable note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const baselineContentHash = await readNoteSegmentBaselineContentHash({
    rootPath,
    memoryId: 'mem_note',
    segmentId: 'seg_edit_no_detail_projection',
  });
  setBeforeMemoryDetailProjectionForTest(() => {
    throw new Error('full detail projection is not allowed');
  });
  try {
    const saved = await writeFinalizedNoteSegmentContent({
      rootPath,
      workspaceId: 'ws_note',
      memoryId: 'mem_note',
      segmentId: 'seg_edit_no_detail_projection',
      bodyMarkdown: 'Changed body\n',
      baselineContentHash,
      now: () => '2026-05-19T12:44:00.000Z',
    });

    assert.equal(saved.ok, true, JSON.stringify(saved));
  } finally {
    setBeforeMemoryDetailProjectionForTest(null);
  }
});

test('finalized note segment content returns baseline hash and rejects stale saves', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_external_conflict',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const initialBody = 'Original body\n';
  const write = await writeNoteSegmentDraftBody({
    rootPath,
    segmentId: 'seg_external_conflict',
    bodyMarkdown: initialBody,
    revision: 0,
  });
  assert.equal(write.ok, true);
  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_external_conflict',
    title: 'Editable note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const content = await readFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_external_conflict',
  });
  assert.equal(content.ok, true);
  if (!content.ok) {
    throw new Error('content read must succeed');
  }
  assert.equal(content.baselineContentHash, contentHash(initialBody));

  const segmentDirectory = await memorySegmentDirectory(
    rootPath,
    'mem_note',
    'seg_external_conflict'
  );
  await writeFile(
    path.join(segmentDirectory, 'segment.md'),
    ['---', 'kind: note', 'title: Editable note', '---', '', 'Disk body', ''].join('\n')
  );

  const stale = await writeFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_external_conflict',
    bodyMarkdown: 'My local body\n',
    baselineContentHash: content.baselineContentHash,
    now: () => '2026-05-19T12:44:00.000Z',
  });

  assert.equal(stale.ok, false);
  if (stale.ok) {
    throw new Error('stale save must fail');
  }
  assert.equal(stale.error.code, 'ERR_SEGMENT_CONTENT_STALE');
  const staleError = stale.error as typeof stale.error & {
    readonly currentBaselineContentHash: string;
    readonly currentBodyMarkdown: string;
  };
  assert.equal(staleError.currentBodyMarkdown, '\nDisk body\n');
  assert.equal(staleError.currentBaselineContentHash, contentHash('\nDisk body\n'));
});

test('finalized note segment save keeps manifest byte length aligned with persisted markdown body', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_no_trailing_newline',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const write = await writeNoteSegmentDraftBody({
    rootPath,
    segmentId: 'seg_no_trailing_newline',
    bodyMarkdown: 'Original body\n',
    revision: 0,
  });
  assert.equal(write.ok, true);
  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_no_trailing_newline',
    title: 'Editable note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const baselineContentHash = await readNoteSegmentBaselineContentHash({
    rootPath,
    memoryId: 'mem_note',
    segmentId: 'seg_no_trailing_newline',
  });
  const saved = await writeFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_no_trailing_newline',
    bodyMarkdown: 'No trailing newline',
    baselineContentHash,
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(saved.ok, true, JSON.stringify(saved));

  const content = await readFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_no_trailing_newline',
  });
  assert.equal(content.ok, true);
  if (!content.ok || !saved.ok) {
    throw new Error('saved note content must be readable');
  }
  assert.equal(saved.bodyByteLength, Buffer.byteLength(content.bodyMarkdown, 'utf8'));
  assert.equal(saved.baselineContentHash, contentHash(content.bodyMarkdown));

  const attachment = await saveNoteSegmentAttachment({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_no_trailing_newline',
    originalFilename: 'runtime.png',
    mimeType: 'image/png',
    payload: Uint8Array.from([137, 80, 78, 71]),
  });
  assert.equal(attachment.ok, true, JSON.stringify(attachment));
});

test('finalized note segment content rejects symlinked manifest leaves before save', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_manifest_symlink',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_manifest_symlink',
    title: 'Manifest symlink note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const outsideManifest = path.join(os.tmpdir(), `reo-note-outside-${process.pid}.json`);
  await writeFile(
    outsideManifest,
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_note',
      memoryId: 'mem_note',
      segmentId: 'seg_manifest_symlink',
      kind: 'note',
      bodyByteLength: 0,
      createdAt: '2026-05-19T12:43:00.000Z',
      updatedAt: '2026-05-19T12:43:00.000Z',
    })
  );
  const outsideBefore = await readFile(outsideManifest, 'utf8');
  const manifestPath = path.join(
    rootPath,
    '.reo',
    'objects',
    'segments',
    'seg_manifest_symlink.json'
  );
  await rm(manifestPath);
  await symlink(outsideManifest, manifestPath);

  const saved = await writeFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_manifest_symlink',
    bodyMarkdown: 'Should not save\n',
    baselineContentHash: contentHash(''),
    now: () => '2026-05-19T12:44:00.000Z',
  });

  assert.equal(saved.ok, false);
  assert.equal(await readFile(outsideManifest, 'utf8'), outsideBefore);
});

test('finalized note segment content rejects symlinked markdown leaves', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_markdown_symlink',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_markdown_symlink',
    title: 'Markdown symlink note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const outsideMarkdown = path.join(os.tmpdir(), `reo-note-outside-${process.pid}.md`);
  await writeFile(outsideMarkdown, '---\ntitle: Outside\nkind: note\n---\nOutside body\n');
  const segmentDirectory = await memorySegmentDirectory(
    rootPath,
    'mem_note',
    'seg_markdown_symlink'
  );
  const segmentMarkdownPath = path.join(segmentDirectory, 'segment.md');
  await rm(segmentMarkdownPath);
  await symlink(outsideMarkdown, segmentMarkdownPath);

  const content = await readFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_markdown_symlink',
  });

  assert.equal(content.ok, false);
});

test('finalized note supplement content rejects symlinked markdown leaves', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_supplement_symlink_parent',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_symlink_parent',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_symlink_parent',
    title: 'Supplement draft',
    createSupplementId: () => 'sup_markdown_symlink',
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(draft.ok, true);
  const finalized = await finalizeSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_symlink_parent',
    supplementId: 'sup_markdown_symlink',
    title: 'Supplement symlink note',
    now: () => '2026-05-19T12:45:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const outsideMarkdown = path.join(os.tmpdir(), `reo-note-supplement-outside-${process.pid}.md`);
  await writeFile(outsideMarkdown, '---\ntitle: Outside\nkind: note\n---\nOutside body\n');
  const segmentDirectory = await memorySegmentDirectory(
    rootPath,
    'mem_note',
    'seg_supplement_symlink_parent'
  );
  const supplementDirectory = await resolveSegmentSupplementDirectoryInSegmentDirectory({
    rootPath,
    memoryId: 'mem_note',
    segmentDirectory,
    segmentId: 'seg_supplement_symlink_parent',
    supplementId: 'sup_markdown_symlink',
  });
  const supplementMarkdownPath = path.join(supplementDirectory, 'supplement.md');
  await rm(supplementMarkdownPath);
  await symlink(outsideMarkdown, supplementMarkdownPath);

  const content = await readFinalizedNoteSegmentSupplementContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_symlink_parent',
    supplementId: 'sup_markdown_symlink',
  });

  assert.equal(content.ok, false);
});

test('finalized note segment body saves run in request order for the same target', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_ordered_save',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_ordered_save',
    title: 'Ordered save note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const baselineContentHash = await readNoteSegmentBaselineContentHash({
    rootPath,
    memoryId: 'mem_note',
    segmentId: 'seg_ordered_save',
  });
  const firstPaused = deferred();
  const secondReachedWrite = deferred();
  const releaseFirst = deferred();
  let writeAttempts = 0;
  setBeforeFinalizedNoteMarkdownWriteForTest(async () => {
    writeAttempts += 1;
    if (writeAttempts === 1) {
      firstPaused.resolve();
      await releaseFirst.promise;
    } else {
      secondReachedWrite.resolve();
    }
  });

  try {
    const first = writeFinalizedNoteSegmentContent({
      rootPath,
      workspaceId: 'ws_note',
      memoryId: 'mem_note',
      segmentId: 'seg_ordered_save',
      bodyMarkdown: 'First body\n',
      baselineContentHash,
      now: () => '2026-05-19T12:44:00.000Z',
    });
    await firstPaused.promise;
    const second = writeFinalizedNoteSegmentContent({
      rootPath,
      workspaceId: 'ws_note',
      memoryId: 'mem_note',
      segmentId: 'seg_ordered_save',
      bodyMarkdown: 'Second body\n',
      baselineContentHash: contentHash('First body\n'),
      now: () => '2026-05-19T12:45:00.000Z',
    });
    await Promise.race([secondReachedWrite.promise, wait(25)]);
    releaseFirst.resolve();

    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.equal(firstResult.ok, true);
    assert.equal(secondResult.ok, true);
  } finally {
    setBeforeFinalizedNoteMarkdownWriteForTest(null);
  }

  const content = await readFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_ordered_save',
  });
  assert.equal(content.ok, true);
  if (content.ok) {
    assert.equal(content.bodyMarkdown, 'Second body\n');
  }
});

test('finalized note segment content rejects manifest ownership mismatches on read and write', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_owner_mismatch',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_owner_mismatch',
    title: 'Owner mismatch note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const manifestPath = path.join(
    rootPath,
    '.reo',
    'objects',
    'segments',
    'seg_owner_mismatch.json'
  );
  const originalManifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<
    string,
    unknown
  >;
  const segmentDirectory = await memorySegmentDirectory(rootPath, 'mem_note', 'seg_owner_mismatch');
  const segmentMarkdownPath = path.join(segmentDirectory, 'segment.md');
  const segmentMarkdownBeforeMismatch = await stat(segmentMarkdownPath);
  await writeFile(
    manifestPath,
    `${JSON.stringify({ ...originalManifest, memoryId: 'other_memory' }, null, 2)}\n`
  );

  const read = await readFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_owner_mismatch',
  });
  assert.equal(read.ok, false);

  const write = await writeFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_owner_mismatch',
    bodyMarkdown: 'Should not save\n',
    baselineContentHash: contentHash(''),
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(write.ok, false);
  assert.equal((await readFile(segmentMarkdownPath, 'utf8')).includes('Should not save'), false);
  assert.equal((await stat(segmentMarkdownPath)).ino, segmentMarkdownBeforeMismatch.ino);

  await writeFile(
    manifestPath,
    `${JSON.stringify({ ...originalManifest, workspaceId: 'other_workspace' }, null, 2)}\n`
  );
  const workspaceRead = await readFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_owner_mismatch',
  });
  assert.equal(workspaceRead.ok, false);

  const workspaceWrite = await writeFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_owner_mismatch',
    bodyMarkdown: 'Should not save from workspace mismatch\n',
    baselineContentHash: contentHash(''),
    now: () => '2026-05-19T12:44:30.000Z',
  });
  assert.equal(workspaceWrite.ok, false);
  assert.equal(
    (await readFile(segmentMarkdownPath, 'utf8')).includes(
      'Should not save from workspace mismatch'
    ),
    false
  );
});

test('finalized note segment content rejects duplicate segment ids on read and write', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_duplicate_note',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_duplicate_note',
    title: 'Duplicate note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(finalized.ok, true);
  await createDuplicateSegmentDirectory({
    rootPath,
    duplicateMemoryId: 'mem_note_duplicate',
    segmentId: 'seg_duplicate_note',
  });

  const read = await readFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_duplicate_note',
  });
  assert.equal(read.ok, false);

  const write = await writeFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_duplicate_note',
    bodyMarkdown: 'Should not save duplicate\n',
    baselineContentHash: contentHash(''),
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(write.ok, false);
  const segmentDirectory = await memorySegmentDirectory(rootPath, 'mem_note', 'seg_duplicate_note');
  assert.equal(
    (await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8')).includes(
      'Should not save duplicate'
    ),
    false
  );
});

test('finalized note segment content rejects stale loose manifests on read and write', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_stale_manifest',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_stale_manifest',
    title: 'Stale manifest note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(finalized.ok, true);
  const manifestPath = path.join(
    rootPath,
    '.reo',
    'objects',
    'segments',
    'seg_stale_manifest.json'
  );
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
  const staleManifest = { ...manifest };
  delete staleManifest['objectType'];
  delete staleManifest['finalizedAt'];
  await writeFile(manifestPath, `${JSON.stringify(staleManifest, null, 2)}\n`);

  const read = await readFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_stale_manifest',
  });
  assert.equal(read.ok, false);

  const write = await writeFinalizedNoteSegmentContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_stale_manifest',
    bodyMarkdown: 'Should not save stale manifest\n',
    baselineContentHash: contentHash(''),
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(write.ok, false);
});

test('duplicate finalized segment guard rejects same-memory duplicate segment ids', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Draft note',
    createSegmentId: () => 'seg_same_memory_duplicate',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(draft.ok, true);
  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_same_memory_duplicate',
    title: 'Same memory duplicate',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(finalized.ok, true);
  const segmentDirectory = await memorySegmentDirectory(
    rootPath,
    'mem_note',
    'seg_same_memory_duplicate'
  );
  const duplicateDirectory = path.join(path.dirname(segmentDirectory), 'seg_same_memory_duplicate');
  await mkdir(duplicateDirectory);
  await writeFile(
    path.join(duplicateDirectory, 'segment.md'),
    await readFile(path.join(segmentDirectory, 'segment.md'), 'utf8')
  );

  await assert.rejects(
    assertNoDuplicateSegmentDirectoryById(rootPath, 'mem_note', 'seg_same_memory_duplicate'),
    /Duplicate finalized segment id/
  );
});

test('finalized note supplement content rejects manifest ownership mismatches on read and write', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_owner_parent',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_owner_parent',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_owner_parent',
    title: 'Supplement note',
    createSupplementId: () => 'sup_owner_mismatch',
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(draft.ok, true);
  const finalized = await finalizeSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_owner_parent',
    supplementId: 'sup_owner_mismatch',
    title: 'Owner mismatch supplement',
    now: () => '2026-05-19T12:45:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const manifestPath = path.join(
    rootPath,
    '.reo',
    'objects',
    'supplements',
    'sup_owner_mismatch.json'
  );
  const originalManifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<
    string,
    unknown
  >;
  const segmentDirectory = await memorySegmentDirectory(rootPath, 'mem_note', 'seg_owner_parent');
  const supplementDirectory = await resolveSegmentSupplementDirectoryInSegmentDirectory({
    rootPath,
    memoryId: 'mem_note',
    segmentDirectory,
    segmentId: 'seg_owner_parent',
    supplementId: 'sup_owner_mismatch',
  });
  const supplementMarkdownPath = path.join(supplementDirectory, 'supplement.md');
  const supplementMarkdownBeforeMismatch = await stat(supplementMarkdownPath);
  await writeFile(
    manifestPath,
    `${JSON.stringify({ ...originalManifest, segmentId: 'other_segment' }, null, 2)}\n`
  );

  const read = await readFinalizedNoteSegmentSupplementContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_owner_parent',
    supplementId: 'sup_owner_mismatch',
  });
  assert.equal(read.ok, false);

  const write = await writeFinalizedNoteSegmentSupplementContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_owner_parent',
    supplementId: 'sup_owner_mismatch',
    bodyMarkdown: 'Should not save\n',
    baselineContentHash: contentHash(''),
    now: () => '2026-05-19T12:46:00.000Z',
  });
  assert.equal(write.ok, false);
  assert.equal((await readFile(supplementMarkdownPath, 'utf8')).includes('Should not save'), false);
  assert.equal((await stat(supplementMarkdownPath)).ino, supplementMarkdownBeforeMismatch.ino);

  await writeFile(
    manifestPath,
    `${JSON.stringify({ ...originalManifest, workspaceId: 'other_workspace' }, null, 2)}\n`
  );
  const workspaceRead = await readFinalizedNoteSegmentSupplementContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_owner_parent',
    supplementId: 'sup_owner_mismatch',
  });
  assert.equal(workspaceRead.ok, false);

  const workspaceWrite = await writeFinalizedNoteSegmentSupplementContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_owner_parent',
    supplementId: 'sup_owner_mismatch',
    bodyMarkdown: 'Should not save from workspace mismatch\n',
    baselineContentHash: contentHash(''),
    now: () => '2026-05-19T12:46:30.000Z',
  });
  assert.equal(workspaceWrite.ok, false);
  assert.equal(
    (await readFile(supplementMarkdownPath, 'utf8')).includes(
      'Should not save from workspace mismatch'
    ),
    false
  );
});

test('finalized note supplement content rejects duplicate parent segment ids on read and write', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_duplicate_note_parent',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_duplicate_note_parent',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_duplicate_note_parent',
    title: 'Supplement note',
    createSupplementId: () => 'sup_duplicate_note_parent',
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(draft.ok, true);
  const finalized = await finalizeSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_duplicate_note_parent',
    supplementId: 'sup_duplicate_note_parent',
    title: 'Duplicate parent supplement',
    now: () => '2026-05-19T12:45:00.000Z',
  });
  assert.equal(finalized.ok, true);
  await createDuplicateSegmentDirectory({
    rootPath,
    duplicateMemoryId: 'mem_note_duplicate_parent',
    segmentId: 'seg_duplicate_note_parent',
  });

  const read = await readFinalizedNoteSegmentSupplementContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_duplicate_note_parent',
    supplementId: 'sup_duplicate_note_parent',
  });
  assert.equal(read.ok, false);

  const write = await writeFinalizedNoteSegmentSupplementContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_duplicate_note_parent',
    supplementId: 'sup_duplicate_note_parent',
    bodyMarkdown: 'Should not save duplicate parent\n',
    baselineContentHash: contentHash(''),
    now: () => '2026-05-19T12:46:00.000Z',
  });
  assert.equal(write.ok, false);
  const segmentDirectory = await memorySegmentDirectory(
    rootPath,
    'mem_note',
    'seg_duplicate_note_parent'
  );
  const supplementDirectory = await resolveSegmentSupplementDirectoryInSegmentDirectory({
    rootPath,
    memoryId: 'mem_note',
    segmentDirectory,
    segmentId: 'seg_duplicate_note_parent',
    supplementId: 'sup_duplicate_note_parent',
  });
  assert.equal(
    (await readFile(path.join(supplementDirectory, 'supplement.md'), 'utf8')).includes(
      'Should not save duplicate parent'
    ),
    false
  );
});

test('finalized note supplement content rejects stale loose manifests on read and write', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_stale_manifest_parent',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_stale_manifest_parent',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_stale_manifest_parent',
    title: 'Supplement note',
    createSupplementId: () => 'sup_stale_manifest',
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(draft.ok, true);
  const finalized = await finalizeSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_stale_manifest_parent',
    supplementId: 'sup_stale_manifest',
    title: 'Stale manifest supplement',
    now: () => '2026-05-19T12:45:00.000Z',
  });
  assert.equal(finalized.ok, true);
  const manifestPath = path.join(
    rootPath,
    '.reo',
    'objects',
    'supplements',
    'sup_stale_manifest.json'
  );
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
  const staleManifest = { ...manifest };
  delete staleManifest['objectType'];
  delete staleManifest['finalizedAt'];
  await writeFile(manifestPath, `${JSON.stringify(staleManifest, null, 2)}\n`);

  const read = await readFinalizedNoteSegmentSupplementContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_stale_manifest_parent',
    supplementId: 'sup_stale_manifest',
  });
  assert.equal(read.ok, false);

  const write = await writeFinalizedNoteSegmentSupplementContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_stale_manifest_parent',
    supplementId: 'sup_stale_manifest',
    bodyMarkdown: 'Should not save stale supplement manifest\n',
    baselineContentHash: contentHash(''),
    now: () => '2026-05-19T12:46:00.000Z',
  });
  assert.equal(write.ok, false);
});

test('note supplement finalize preserves the draft and does not expose durable files when index refresh fails', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_parent_refresh_failure',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_parent_refresh_failure',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_parent_refresh_failure',
    title: 'Supplement draft',
    createSupplementId: () => 'sup_refresh_failure',
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(draft.ok, true);
  const write = await writeSegmentSupplementNoteDraftBody({
    rootPath,
    supplementId: 'sup_refresh_failure',
    bodyMarkdown: 'Uncommitted supplement body\n',
    revision: 0,
  });
  assert.equal(write.ok, true);

  await writeFile(path.join(rootPath, '.reo', 'index.json'), '{broken');
  const finalized = await finalizeSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_parent_refresh_failure',
    supplementId: 'sup_refresh_failure',
    title: 'Should not commit',
    now: () => '2026-05-19T12:45:00.000Z',
  });

  assert.equal(finalized.ok, false);
  await assert.rejects(
    stat(
      path.join(
        rootPath,
        'memories',
        'mem_note',
        'segments',
        'seg_parent_refresh_failure',
        'supplements',
        'sup_refresh_failure'
      )
    ),
    /ENOENT/
  );
  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'objects', 'supplements', 'sup_refresh_failure.json')),
    /ENOENT/
  );
  const preservedDraft = parseWorkspaceMarkdownObject({
    markdown: await readFile(
      path.join(rootPath, '.reo', 'drafts', 'supplements', 'sup_refresh_failure', 'supplement.md'),
      'utf8'
    ),
    objectType: 'supplement',
  });
  assert.equal(preservedDraft.data.title, 'Supplement draft');
  assert.equal(preservedDraft.content, 'Uncommitted supplement body\n');
});

test('note supplement finalize does not scan full Memory detail for parent existence', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_supplement_narrow_parent',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_narrow_parent',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_narrow_parent',
    title: 'Supplement note',
    createSupplementId: () => 'sup_narrow_parent_check',
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(draft.ok, true);

  let fullDetailScans = 0;
  setBeforeSegmentFileTruthListForTest(() => {
    fullDetailScans += 1;
  });
  try {
    const finalized = await finalizeSegmentSupplementNoteDraft({
      rootPath,
      workspaceId: 'ws_note',
      memoryId: 'mem_note',
      segmentId: 'seg_supplement_narrow_parent',
      supplementId: 'sup_narrow_parent_check',
      title: '',
      now: () => '2026-05-19T12:45:00.000Z',
    });

    assert.equal(finalized.ok, false);
    assert.equal(fullDetailScans, 0);
  } finally {
    setBeforeSegmentFileTruthListForTest(null);
  }
});

test('note supplement finalize returns targeted projection without full Memory detail projection', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_supplement_no_detail',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_no_detail',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_no_detail',
    title: 'Supplement note',
    createSupplementId: () => 'sup_no_detail_projection',
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(draft.ok, true);

  setBeforeMemoryDetailProjectionForTest(() => {
    throw new Error('full detail projection is not allowed');
  });
  try {
    const finalized = await finalizeSegmentSupplementNoteDraft({
      rootPath,
      workspaceId: 'ws_note',
      memoryId: 'mem_note',
      segmentId: 'seg_supplement_no_detail',
      supplementId: 'sup_no_detail_projection',
      title: 'No detail supplement',
      now: () => '2026-05-19T12:45:00.000Z',
    });

    assert.equal(finalized.ok, true, JSON.stringify(finalized));
    assert.equal(finalized.segment.segmentId, 'seg_supplement_no_detail');
    assert.equal(finalized.supplement.supplementId, 'sup_no_detail_projection');
    assert.equal(finalized.supplement.type, 'note');
  } finally {
    setBeforeMemoryDetailProjectionForTest(null);
  }
});

test('note supplement finalize rejects parent segment swap before target directory create', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_supplement_parent_swap',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_parent_swap',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_parent_swap',
    title: 'Supplement note',
    createSupplementId: () => 'sup_parent_swap',
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(draft.ok, true);
  const parentDirectory = await memorySegmentDirectory(
    rootPath,
    'mem_note',
    'seg_supplement_parent_swap'
  );
  const outsideDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-note-outside-supplements-'));

  setBeforeNoteFinalizeTargetDirectoryCreateForTest(async () => {
    setBeforeNoteFinalizeTargetDirectoryCreateForTest(null);
    await rm(parentDirectory, { recursive: true, force: true });
    await symlink(outsideDirectory, parentDirectory);
  });
  try {
    const finalized = await finalizeSegmentSupplementNoteDraft({
      rootPath,
      workspaceId: 'ws_note',
      memoryId: 'mem_note',
      segmentId: 'seg_supplement_parent_swap',
      supplementId: 'sup_parent_swap',
      title: 'Escaping supplement',
      now: () => '2026-05-19T12:45:00.000Z',
    });

    assert.equal(finalized.ok, false);
    await assert.rejects(stat(path.join(outsideDirectory, 'supplements')), /ENOENT/);
  } finally {
    setBeforeNoteFinalizeTargetDirectoryCreateForTest(null);
  }
});

test('finalized note supplement edit preserves previous markdown when index refresh fails', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_supplement_edit_parent',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_edit_parent',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_edit_parent',
    title: 'Supplement draft',
    createSupplementId: () => 'sup_edit_refresh_failure',
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(draft.ok, true);
  const write = await writeSegmentSupplementNoteDraftBody({
    rootPath,
    supplementId: 'sup_edit_refresh_failure',
    bodyMarkdown: 'Original supplement\n',
    revision: 0,
  });
  assert.equal(write.ok, true);
  const finalized = await finalizeSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_edit_parent',
    supplementId: 'sup_edit_refresh_failure',
    title: 'Editable supplement',
    now: () => '2026-05-19T12:45:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const baselineContentHash = await readNoteSupplementBaselineContentHash({
    rootPath,
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_edit_parent',
    supplementId: 'sup_edit_refresh_failure',
  });
  await writeFile(path.join(rootPath, '.reo', 'index.json'), '{broken');
  const saved = await writeFinalizedNoteSegmentSupplementContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_edit_parent',
    supplementId: 'sup_edit_refresh_failure',
    bodyMarkdown: 'Changed supplement\n',
    baselineContentHash,
    now: () => '2026-05-19T12:46:00.000Z',
  });

  assert.equal(saved.ok, false);
  const content = await readFinalizedNoteSegmentSupplementContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_edit_parent',
    supplementId: 'sup_edit_refresh_failure',
  });
  assert.equal(content.ok, true);
  if (content.ok) {
    assert.equal(content.bodyMarkdown, 'Original supplement\n');
  }
});

test('finalized note supplement edit refreshes summary without full Memory detail projection', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_supplement_edit_no_detail',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_edit_no_detail',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_edit_no_detail',
    title: 'Supplement draft',
    createSupplementId: () => 'sup_edit_no_detail',
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(draft.ok, true);
  const finalized = await finalizeSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_edit_no_detail',
    supplementId: 'sup_edit_no_detail',
    title: 'Editable supplement',
    now: () => '2026-05-19T12:45:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const baselineContentHash = await readNoteSupplementBaselineContentHash({
    rootPath,
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_edit_no_detail',
    supplementId: 'sup_edit_no_detail',
  });
  setBeforeMemoryDetailProjectionForTest(() => {
    throw new Error('full detail projection is not allowed');
  });
  try {
    const saved = await writeFinalizedNoteSegmentSupplementContent({
      rootPath,
      workspaceId: 'ws_note',
      memoryId: 'mem_note',
      segmentId: 'seg_supplement_edit_no_detail',
      supplementId: 'sup_edit_no_detail',
      bodyMarkdown: 'Changed supplement\n',
      baselineContentHash,
      now: () => '2026-05-19T12:46:00.000Z',
    });

    assert.equal(saved.ok, true, JSON.stringify(saved));
  } finally {
    setBeforeMemoryDetailProjectionForTest(null);
  }
});

test('finalized note supplement content returns baseline hash and rejects stale saves', async () => {
  const rootPath = await workspaceRoot();
  const createdMemory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_note',
    title: 'Note memory',
    now: () => '2026-05-19T12:41:00.000Z',
  });
  assert.equal(createdMemory.ok, true);
  const parentDraft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    title: 'Parent note',
    createSegmentId: () => 'seg_supplement_external_parent',
    now: () => '2026-05-19T12:42:00.000Z',
  });
  assert.equal(parentDraft.ok, true);
  const parent = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_external_parent',
    title: 'Parent note',
    now: () => '2026-05-19T12:43:00.000Z',
  });
  assert.equal(parent.ok, true);
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_external_parent',
    title: 'Supplement draft',
    createSupplementId: () => 'sup_external_conflict',
    now: () => '2026-05-19T12:44:00.000Z',
  });
  assert.equal(draft.ok, true);
  const initialBody = 'Original supplement\n';
  const write = await writeSegmentSupplementNoteDraftBody({
    rootPath,
    supplementId: 'sup_external_conflict',
    bodyMarkdown: initialBody,
    revision: 0,
  });
  assert.equal(write.ok, true);
  const finalized = await finalizeSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_external_parent',
    supplementId: 'sup_external_conflict',
    title: 'Editable supplement',
    now: () => '2026-05-19T12:45:00.000Z',
  });
  assert.equal(finalized.ok, true);

  const content = await readFinalizedNoteSegmentSupplementContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_external_parent',
    supplementId: 'sup_external_conflict',
  });
  assert.equal(content.ok, true);
  if (!content.ok) {
    throw new Error('supplement content read must succeed');
  }
  assert.equal(content.baselineContentHash, contentHash(initialBody));

  const segmentDirectory = await memorySegmentDirectory(
    rootPath,
    'mem_note',
    'seg_supplement_external_parent'
  );
  const supplementDirectory = await resolveSegmentSupplementDirectoryInSegmentDirectory({
    rootPath,
    memoryId: 'mem_note',
    segmentDirectory,
    segmentId: 'seg_supplement_external_parent',
    supplementId: 'sup_external_conflict',
  });
  await writeFile(
    path.join(supplementDirectory, 'supplement.md'),
    ['---', 'kind: note', 'title: Editable supplement', '---', '', 'Disk supplement', ''].join('\n')
  );

  const stale = await writeFinalizedNoteSegmentSupplementContent({
    rootPath,
    workspaceId: 'ws_note',
    memoryId: 'mem_note',
    segmentId: 'seg_supplement_external_parent',
    supplementId: 'sup_external_conflict',
    bodyMarkdown: 'My local supplement\n',
    baselineContentHash: content.baselineContentHash,
    now: () => '2026-05-19T12:46:00.000Z',
  });

  assert.equal(stale.ok, false);
  if (stale.ok) {
    throw new Error('stale supplement save must fail');
  }
  assert.equal(stale.error.code, 'ERR_SEGMENT_CONTENT_STALE');
  const staleError = stale.error as typeof stale.error & {
    readonly currentBaselineContentHash: string;
    readonly currentBodyMarkdown: string;
  };
  assert.equal(staleError.currentBodyMarkdown, '\nDisk supplement\n');
  assert.equal(staleError.currentBaselineContentHash, contentHash('\nDisk supplement\n'));
});

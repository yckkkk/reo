import { createHash } from 'node:crypto';
import { constants, lstatSync, mkdirSync } from 'node:fs';
import { lstat, mkdir, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { JSONContent } from '@tiptap/core';
import { writeWorkspaceFileAtomic, writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';
import {
  assertSameCurrentDirectoryIdentity,
  assertSameDirectoryIdentitySync,
  readSafeDirectoryIdentitySync,
} from './directoryIdentity.js';
import {
  assertNoDuplicateSegmentDirectoryById,
  memorySegmentDirectory,
  memorySegmentDirectoryForNewNode,
  readMemoryFileTruth,
  readFinalizedSegmentProjection,
  readFinalizedSegmentSupplementProjectionFromKnownDirectory,
  refreshMemoryIndexEntry,
  resolveSegmentSupplementDirectoryInSegmentDirectory,
  segmentSupplementDirectoryForNewNode,
  type MemorySummary,
} from './memoryFiles.js';
import {
  parseWorkspaceMarkdownObject,
  renderWorkspaceMarkdownObject,
} from './workspaceMarkdownObjects.js';
import {
  reconcileTiptapContentSidecar,
  TIPTAP_CONTENT_SIDECAR_FILE,
  writeTiptapContentSidecar,
} from './tiptapContentSidecar.js';
import { parseTiptapMarkdown } from './tiptapMarkdownCodec.js';
import { withWorkspaceAsyncQueue } from './workspaceAsyncQueue.js';
import {
  createSafeSupplementId,
  createSafeSegmentId,
  ensureWorkspaceDraftsDirectory,
  ensureWorkspaceSupplementDraftsDirectory,
  resolveWorkspaceDraftSegmentDirectory,
  resolveWorkspaceDraftSupplementDirectory,
} from './workspacePaths.js';
import {
  workspaceSegmentContentTabOrderItemSchema,
  workspaceError,
  type WorkspaceErrorEnvelope,
  type WorkspaceSegmentProjection,
} from '../workspace-contract/workspace-contract.js';

type AssertWorkspaceUsable = () => { readonly ok: true } | WorkspaceErrorEnvelope;
type MaybePromise<T> = T | Promise<T>;

let beforeFinalizedNoteMarkdownWriteForTest: (() => MaybePromise<void>) | null = null;
let beforeNoteFinalizeTargetDirectoryCreateForTest: (() => MaybePromise<void>) | null = null;
const finalizedNoteMarkdownSaveQueues = new Map<string, Promise<void>>();

export function setBeforeFinalizedNoteMarkdownWriteForTest(
  hook: (() => MaybePromise<void>) | null
): void {
  beforeFinalizedNoteMarkdownWriteForTest = hook;
}

export function setBeforeNoteFinalizeTargetDirectoryCreateForTest(
  hook: (() => MaybePromise<void>) | null
): void {
  beforeNoteFinalizeTargetDirectoryCreateForTest = hook;
}

const noteDraftMetadataSchema = z
  .object({
    schemaVersion: z.literal(1),
    workspaceId: z.string().min(1),
    memoryId: z.string().min(1),
    segmentId: z.string().min(1),
    type: z.literal('note'),
    status: z.literal('draft'),
    title: z.string().min(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    revision: z.number().int().nonnegative(),
    bodyByteLength: z.number().int().nonnegative(),
  })
  .strict();

type NoteDraftMetadata = z.infer<typeof noteDraftMetadataSchema>;

const noteSupplementDraftMetadataSchema = z
  .object({
    schemaVersion: z.literal(1),
    workspaceId: z.string().min(1),
    memoryId: z.string().min(1),
    segmentId: z.string().min(1),
    supplementId: z.string().min(1),
    type: z.literal('note'),
    status: z.literal('draft'),
    title: z.string().min(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    revision: z.number().int().nonnegative(),
    bodyByteLength: z.number().int().nonnegative(),
  })
  .strict();

type NoteSupplementDraftMetadata = z.infer<typeof noteSupplementDraftMetadataSchema>;

const finalizedNoteSegmentManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    objectType: z.literal('segment'),
    workspaceId: z.string().min(1),
    memoryId: z.string().min(1),
    segmentId: z.string().min(1),
    kind: z.literal('note'),
    createdAt: z.string().min(1),
    finalizedAt: z.string().min(1),
    updatedAt: z.string().min(1),
    bodyByteLength: z.number().int().nonnegative(),
    contentTabOrder: z.array(workspaceSegmentContentTabOrderItemSchema).optional(),
  })
  .strict();

type FinalizedNoteSegmentManifest = z.infer<typeof finalizedNoteSegmentManifestSchema>;

const finalizedSegmentParentManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    workspaceId: z.string().min(1),
    memoryId: z.string().min(1),
    segmentId: z.string().min(1),
    kind: z.enum(['audio', 'note']),
  })
  .passthrough();

const finalizedNoteSupplementManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    objectType: z.literal('supplement'),
    workspaceId: z.string().min(1),
    memoryId: z.string().min(1),
    segmentId: z.string().min(1),
    supplementId: z.string().min(1),
    kind: z.literal('note'),
    createdAt: z.string().min(1),
    finalizedAt: z.string().min(1),
    updatedAt: z.string().min(1),
    bodyByteLength: z.number().int().nonnegative(),
  })
  .strict();

type FinalizedNoteSupplementManifest = z.infer<typeof finalizedNoteSupplementManifestSchema>;

function checkWorkspaceUsable(
  assertWorkspaceUsable?: AssertWorkspaceUsable
): WorkspaceErrorEnvelope | null {
  const usable = assertWorkspaceUsable?.();
  return usable && !usable.ok ? usable : null;
}

function assertWorkspaceUsableForWrite(assertWorkspaceUsable?: AssertWorkspaceUsable): void {
  const error = checkWorkspaceUsable(assertWorkspaceUsable);
  if (error) {
    throw error;
  }
}

function workspaceWriteAssert(
  assertWorkspaceUsable?: AssertWorkspaceUsable
): (() => void) | undefined {
  return assertWorkspaceUsable
    ? () => assertWorkspaceUsableForWrite(assertWorkspaceUsable)
    : undefined;
}

function caughtWorkspaceError(error: unknown): WorkspaceErrorEnvelope | null {
  return typeof error === 'object' && error !== null && (error as { ok?: unknown }).ok === false
    ? (error as WorkspaceErrorEnvelope)
    : null;
}

function noteContentHash(bodyMarkdown: string): string {
  return createHash('sha256').update(bodyMarkdown).digest('hex');
}

function staleNoteContentError(current: {
  readonly bodyMarkdown: string;
  readonly bodyTiptapJson: JSONContent;
  readonly baselineTiptapContentHash: string;
}): WorkspaceErrorEnvelope {
  return {
    ok: false,
    error: {
      code: 'ERR_SEGMENT_CONTENT_STALE',
      message: 'Note content changed on disk',
      currentBodyMarkdown: current.bodyMarkdown,
      currentBodyTiptapJson: current.bodyTiptapJson,
      currentBaselineContentHash: noteContentHash(current.bodyMarkdown),
      currentBaselineTiptapContentHash: current.baselineTiptapContentHash,
    },
  };
}

function isMissingFileError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function isUnsafeWorkspacePathError(error: unknown): boolean {
  if (
    (error as NodeJS.ErrnoException).code === 'ELOOP' ||
    (error as NodeJS.ErrnoException).code === 'ENOTDIR'
  ) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message.includes('symlink') ||
    error.message.includes('escapes workspace') ||
    error.message.includes('not safe') ||
    error.message.includes('path changed') ||
    error.message.includes('unsafe')
  );
}

function createOrEnsureWorkspaceChildDirectory({
  assertWorkspaceUsable,
  childName,
  existing,
  parentDirectory,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable | undefined;
  readonly childName: string;
  readonly existing: 'allow' | 'reject';
  readonly parentDirectory: string;
}): string {
  const parentIdentity = readSafeDirectoryIdentitySync(
    parentDirectory,
    'Workspace parent directory is not safe'
  );
  const previousCwd = process.cwd();
  try {
    process.chdir(parentDirectory);
    assertSameCurrentDirectoryIdentity(parentIdentity, 'Workspace parent directory changed');
    assertWorkspaceUsableForWrite(assertWorkspaceUsable);
    try {
      mkdirSync(childName);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || existing === 'reject') {
        throw error;
      }
    }
    const entry = lstatSync(childName);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace child directory is unsafe');
    }
    assertSameDirectoryIdentitySync(parentDirectory, parentIdentity, 'Workspace parent changed');
    return path.join(parentDirectory, childName);
  } finally {
    process.chdir(previousCwd);
  }
}

async function ensureNoteFinalizeChildDirectory({
  assertWorkspaceUsable,
  childName,
  parentDirectory,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable | undefined;
  readonly childName: string;
  readonly parentDirectory: string;
}): Promise<string> {
  await beforeNoteFinalizeTargetDirectoryCreateForTest?.();
  return createOrEnsureWorkspaceChildDirectory({
    childName,
    existing: 'allow',
    parentDirectory,
    ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
  });
}

async function createNoteFinalizeChildDirectory({
  assertWorkspaceUsable,
  childName,
  parentDirectory,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable | undefined;
  readonly childName: string;
  readonly parentDirectory: string;
}): Promise<string> {
  await beforeNoteFinalizeTargetDirectoryCreateForTest?.();
  return createOrEnsureWorkspaceChildDirectory({
    childName,
    existing: 'reject',
    parentDirectory,
    ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
  });
}

function bodyByteLength(bodyMarkdown: string): number {
  return Buffer.byteLength(bodyMarkdown, 'utf8');
}

type RenderedNoteMarkdown = {
  readonly baselineContentHash: string;
  readonly bodyByteLength: number;
  readonly bodyMarkdown: string;
  readonly markdown: string;
};

async function withFinalizedNoteMarkdownSaveQueue<T>(
  key: string,
  run: () => Promise<T>
): Promise<T> {
  return withWorkspaceAsyncQueue(finalizedNoteMarkdownSaveQueues, key, run);
}

async function readTextFileNoFollow(filePath: string): Promise<string> {
  let file;
  try {
    file = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (['ELOOP', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
      throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace file path is unsafe');
    }
    throw error;
  }
  try {
    const metadata = await file.stat();
    if (!metadata.isFile()) {
      throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace file path is unsafe');
    }
    return await file.readFile('utf8');
  } finally {
    await file.close().catch(() => {});
  }
}

async function resolveSafeDraftDirectory({
  id,
  kind,
  rootPath,
}: {
  readonly id: string;
  readonly kind: 'segments' | 'supplements';
  readonly rootPath: string;
}): Promise<string> {
  let currentPath = rootPath;
  for (const pathPart of ['.reo', 'drafts', kind, id]) {
    currentPath = path.join(currentPath, pathPart);
    let entry;
    try {
      entry = await lstat(currentPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'Note draft does not exist');
      }
      throw error;
    }
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace draft path is unsafe');
    }
  }
  return currentPath;
}

function assertFinalizedNoteSegmentManifestOwnership(
  manifest: FinalizedNoteSegmentManifest,
  expected: {
    readonly workspaceId?: string;
    readonly memoryId: string;
    readonly segmentId: string;
  }
): void {
  if (
    (expected.workspaceId !== undefined && manifest.workspaceId !== expected.workspaceId) ||
    manifest.memoryId !== expected.memoryId ||
    manifest.segmentId !== expected.segmentId
  ) {
    throw workspaceError('ERR_WORKSPACE_METADATA_INVALID', 'Note segment ownership is invalid');
  }
}

function assertFinalizedNoteSupplementManifestOwnership(
  manifest: FinalizedNoteSupplementManifest,
  expected: {
    readonly workspaceId?: string;
    readonly memoryId: string;
    readonly segmentId: string;
    readonly supplementId: string;
  }
): void {
  if (
    (expected.workspaceId !== undefined && manifest.workspaceId !== expected.workspaceId) ||
    manifest.memoryId !== expected.memoryId ||
    manifest.segmentId !== expected.segmentId ||
    manifest.supplementId !== expected.supplementId
  ) {
    throw workspaceError('ERR_WORKSPACE_METADATA_INVALID', 'Note supplement ownership is invalid');
  }
}

async function readNoteSegmentManifest(
  rootPath: string,
  segmentId: string
): Promise<FinalizedNoteSegmentManifest> {
  return finalizedNoteSegmentManifestSchema.parse(
    JSON.parse(await readTextFileNoFollow(noteSegmentManifestPath(rootPath, segmentId)))
  );
}

async function readFinalizedSegmentParentManifest(
  rootPath: string,
  segmentId: string
): Promise<z.infer<typeof finalizedSegmentParentManifestSchema>> {
  return finalizedSegmentParentManifestSchema.parse(
    JSON.parse(await readTextFileNoFollow(noteSegmentManifestPath(rootPath, segmentId)))
  );
}

async function readNoteSupplementManifest(
  rootPath: string,
  supplementId: string
): Promise<FinalizedNoteSupplementManifest> {
  return finalizedNoteSupplementManifestSchema.parse(
    JSON.parse(await readTextFileNoFollow(noteSupplementManifestPath(rootPath, supplementId)))
  );
}

async function pathExistsNoFollow(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function assertRegularFileNoFollow(filePath: string): Promise<void> {
  const file = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const metadata = await file.stat();
    if (!metadata.isFile()) {
      throw workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Workspace file path is unsafe');
    }
  } finally {
    await file.close().catch(() => {});
  }
}

async function assertFinalizedSegmentParentForNoteSupplement({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
}): Promise<void> {
  const manifest = await readFinalizedSegmentParentManifest(rootPath, segmentId);
  if (
    manifest.workspaceId !== workspaceId ||
    manifest.memoryId !== memoryId ||
    manifest.segmentId !== segmentId
  ) {
    throw workspaceError('ERR_WORKSPACE_METADATA_INVALID', 'Note supplement parent is invalid');
  }
  await assertNoDuplicateSegmentDirectoryById(rootPath, memoryId, segmentId);
  const segmentDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
  const segmentDirectoryMetadata = await lstat(segmentDirectory);
  if (!segmentDirectoryMetadata.isDirectory()) {
    throw workspaceError('ERR_WORKSPACE_SEGMENT_NOT_FOUND', 'Note supplement parent is not safe');
  }
  await assertRegularFileNoFollow(path.join(segmentDirectory, 'segment.md'));
}

async function assertNoteParentMemory({
  assertWorkspaceUsable,
  memoryId,
  rootPath,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly memoryId: string;
  readonly rootPath: string;
}): Promise<WorkspaceErrorEnvelope | null> {
  const usable = checkWorkspaceUsable(assertWorkspaceUsable);
  if (usable) {
    return usable;
  }
  try {
    await readMemoryFileTruth(rootPath, memoryId);
    return null;
  } catch (error) {
    const envelope = caughtWorkspaceError(error);
    if (envelope) {
      return envelope;
    }
    if (isUnsafeWorkspacePathError(error)) {
      return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Note parent memory is unsafe');
    }
    if (!isMissingFileError(error)) {
      return workspaceError('ERR_WORKSPACE_METADATA_INVALID', 'Note parent memory is invalid');
    }
    return workspaceError('ERR_MEMORY_NOT_FOUND', 'Note parent memory does not exist');
  }
}

function noteDraftMetadataPath(draftDirectory: string): string {
  return path.join(draftDirectory, 'segment.json');
}

function noteDraftMarkdownPath(draftDirectory: string): string {
  return path.join(draftDirectory, 'segment.md');
}

function noteSupplementDraftMetadataPath(draftDirectory: string): string {
  return path.join(draftDirectory, 'supplement.json');
}

function noteSupplementDraftMarkdownPath(draftDirectory: string): string {
  return path.join(draftDirectory, 'supplement.md');
}

function noteSegmentManifestPath(rootPath: string, segmentId: string): string {
  return path.join(rootPath, '.reo', 'objects', 'segments', `${segmentId}.json`);
}

function noteSupplementManifestPath(rootPath: string, supplementId: string): string {
  return path.join(rootPath, '.reo', 'objects', 'supplements', `${supplementId}.json`);
}

function renderPersistedNoteMarkdown({
  bodyMarkdown,
  objectType,
  title,
}: {
  readonly bodyMarkdown: string;
  readonly objectType: 'segment' | 'supplement';
  readonly title: string;
}): RenderedNoteMarkdown {
  const markdown = renderWorkspaceMarkdownObject({
    objectType,
    data: {
      title,
      kind: 'note',
    },
    content: bodyMarkdown,
  });
  const parsed = parseWorkspaceMarkdownObject({ markdown, objectType });
  if (!('kind' in parsed.data) || parsed.data.kind !== 'note') {
    throw workspaceError('ERR_WORKSPACE_METADATA_INVALID', 'Rendered note markdown is invalid');
  }
  return {
    baselineContentHash: noteContentHash(parsed.content),
    bodyByteLength: bodyByteLength(parsed.content),
    bodyMarkdown: parsed.content,
    markdown,
  };
}

async function readNoteDraftMetadata(
  rootPath: string,
  segmentId: string
): Promise<NoteDraftMetadata> {
  const draftDirectory = await resolveSafeDraftDirectory({
    rootPath,
    kind: 'segments',
    id: segmentId,
  });
  return noteDraftMetadataSchema.parse(
    JSON.parse(await readTextFileNoFollow(noteDraftMetadataPath(draftDirectory)))
  );
}

async function readNoteSupplementDraftMetadata(
  rootPath: string,
  supplementId: string
): Promise<NoteSupplementDraftMetadata> {
  const draftDirectory = await resolveSafeDraftDirectory({
    rootPath,
    kind: 'supplements',
    id: supplementId,
  });
  return noteSupplementDraftMetadataSchema.parse(
    JSON.parse(await readTextFileNoFollow(noteSupplementDraftMetadataPath(draftDirectory)))
  );
}

async function writeNoteDraftFiles({
  assertWorkspaceUsable,
  bodyMarkdown,
  draftDirectory,
  metadata,
}: {
  readonly assertWorkspaceUsable: AssertWorkspaceUsable | undefined;
  readonly bodyMarkdown: string;
  readonly draftDirectory: string;
  readonly metadata: NoteDraftMetadata;
}): Promise<void> {
  const assertUsable = workspaceWriteAssert(assertWorkspaceUsable);
  const rendered = renderPersistedNoteMarkdown({
    objectType: 'segment',
    title: metadata.title,
    bodyMarkdown,
  });
  await writeWorkspaceJsonAtomic(
    noteDraftMetadataPath(draftDirectory),
    { ...metadata, bodyByteLength: rendered.bodyByteLength },
    assertUsable
  );
  await writeWorkspaceFileAtomic(
    noteDraftMarkdownPath(draftDirectory),
    rendered.markdown,
    assertUsable
  );
}

async function writeNoteSupplementDraftFiles({
  assertWorkspaceUsable,
  bodyMarkdown,
  draftDirectory,
  metadata,
}: {
  readonly assertWorkspaceUsable: AssertWorkspaceUsable | undefined;
  readonly bodyMarkdown: string;
  readonly draftDirectory: string;
  readonly metadata: NoteSupplementDraftMetadata;
}): Promise<void> {
  const assertUsable = workspaceWriteAssert(assertWorkspaceUsable);
  const rendered = renderPersistedNoteMarkdown({
    objectType: 'supplement',
    title: metadata.title,
    bodyMarkdown,
  });
  await writeWorkspaceJsonAtomic(
    noteSupplementDraftMetadataPath(draftDirectory),
    { ...metadata, bodyByteLength: rendered.bodyByteLength },
    assertUsable
  );
  await writeWorkspaceFileAtomic(
    noteSupplementDraftMarkdownPath(draftDirectory),
    rendered.markdown,
    assertUsable
  );
}

export async function createNoteSegmentDraft({
  rootPath,
  workspaceId,
  memoryId,
  title,
  createSegmentId,
  now,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly title: string;
  readonly createSegmentId: () => string;
  readonly now: () => string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly segmentId: string;
      readonly revision: number;
    }
  | WorkspaceErrorEnvelope
> {
  let draftDirectory: string | null = null;
  try {
    const usable = checkWorkspaceUsable(assertWorkspaceUsable);
    if (usable) {
      return usable;
    }
    const draftsDirectory = await ensureWorkspaceDraftsDirectory(rootPath, assertWorkspaceUsable);
    if (typeof draftsDirectory !== 'string') {
      return draftsDirectory;
    }
    const segmentId = createSafeSegmentId(createSegmentId());
    draftDirectory = resolveWorkspaceDraftSegmentDirectory(rootPath, segmentId);
    assertWorkspaceUsableForWrite(assertWorkspaceUsable);
    await mkdir(draftDirectory);
    const createdAt = now();
    await writeNoteDraftFiles({
      assertWorkspaceUsable,
      bodyMarkdown: '',
      draftDirectory,
      metadata: {
        schemaVersion: 1,
        workspaceId,
        memoryId,
        segmentId,
        type: 'note',
        status: 'draft',
        title,
        createdAt,
        updatedAt: createdAt,
        revision: 0,
        bodyByteLength: 0,
      },
    });
    return { ok: true, segmentId, revision: 0 };
  } catch (error) {
    if (draftDirectory) {
      await rm(draftDirectory, { force: true, recursive: true }).catch(() => {});
    }
    const envelope = caughtWorkspaceError(error);
    return (
      envelope ?? workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'Note draft could not be created')
    );
  }
}

export async function writeNoteSegmentDraftBody({
  rootPath,
  segmentId,
  bodyMarkdown,
  revision,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly segmentId: string;
  readonly bodyMarkdown: string;
  readonly revision: number;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly bodyByteLength: number;
      readonly revision: number;
    }
  | WorkspaceErrorEnvelope
> {
  try {
    const draftDirectory = resolveWorkspaceDraftSegmentDirectory(rootPath, segmentId);
    const metadata = await readNoteDraftMetadata(rootPath, segmentId);
    if (metadata.revision !== revision) {
      return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'Note draft revision is stale');
    }
    assertWorkspaceUsableForWrite(assertWorkspaceUsable);
    const nextRevision = revision + 1;
    const rendered = renderPersistedNoteMarkdown({
      objectType: 'segment',
      title: metadata.title,
      bodyMarkdown,
    });
    const nextMetadata: NoteDraftMetadata = {
      ...metadata,
      updatedAt: new Date().toISOString(),
      revision: nextRevision,
      bodyByteLength: rendered.bodyByteLength,
    };
    await writeNoteDraftFiles({
      assertWorkspaceUsable,
      bodyMarkdown,
      draftDirectory,
      metadata: nextMetadata,
    });
    return { ok: true, bodyByteLength: nextMetadata.bodyByteLength, revision: nextRevision };
  } catch (error) {
    const envelope = caughtWorkspaceError(error);
    return (
      envelope ??
      workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'Note draft body could not be written')
    );
  }
}

export async function createSegmentSupplementNoteDraft({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  title,
  createSupplementId,
  now,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly createSupplementId: () => string;
  readonly now: () => string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly supplementId: string;
      readonly revision: number;
    }
  | WorkspaceErrorEnvelope
> {
  let draftDirectory: string | null = null;
  try {
    const usable = checkWorkspaceUsable(assertWorkspaceUsable);
    if (usable) {
      return usable;
    }
    await assertFinalizedSegmentParentForNoteSupplement({
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
    });
    const draftsDirectory = await ensureWorkspaceSupplementDraftsDirectory(
      rootPath,
      assertWorkspaceUsable
    );
    if (typeof draftsDirectory !== 'string') {
      return draftsDirectory;
    }
    const supplementId = createSafeSupplementId(createSupplementId());
    draftDirectory = resolveWorkspaceDraftSupplementDirectory(rootPath, supplementId);
    assertWorkspaceUsableForWrite(assertWorkspaceUsable);
    await mkdir(draftDirectory);
    const createdAt = now();
    await writeNoteSupplementDraftFiles({
      assertWorkspaceUsable,
      bodyMarkdown: '',
      draftDirectory,
      metadata: {
        schemaVersion: 1,
        workspaceId,
        memoryId,
        segmentId,
        supplementId,
        type: 'note',
        status: 'draft',
        title,
        createdAt,
        updatedAt: createdAt,
        revision: 0,
        bodyByteLength: 0,
      },
    });
    return { ok: true, supplementId, revision: 0 };
  } catch (error) {
    if (draftDirectory) {
      await rm(draftDirectory, { force: true, recursive: true }).catch(() => {});
    }
    const envelope = caughtWorkspaceError(error);
    return (
      envelope ??
      workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'Note supplement draft could not be created')
    );
  }
}

export async function writeSegmentSupplementNoteDraftBody({
  rootPath,
  supplementId,
  bodyMarkdown,
  revision,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly supplementId: string;
  readonly bodyMarkdown: string;
  readonly revision: number;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly bodyByteLength: number;
      readonly revision: number;
    }
  | WorkspaceErrorEnvelope
> {
  try {
    const draftDirectory = resolveWorkspaceDraftSupplementDirectory(rootPath, supplementId);
    const metadata = await readNoteSupplementDraftMetadata(rootPath, supplementId);
    if (metadata.revision !== revision) {
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'Note supplement draft revision is stale'
      );
    }
    assertWorkspaceUsableForWrite(assertWorkspaceUsable);
    const nextRevision = revision + 1;
    const rendered = renderPersistedNoteMarkdown({
      objectType: 'supplement',
      title: metadata.title,
      bodyMarkdown,
    });
    const nextMetadata: NoteSupplementDraftMetadata = {
      ...metadata,
      updatedAt: new Date().toISOString(),
      revision: nextRevision,
      bodyByteLength: rendered.bodyByteLength,
    };
    await writeNoteSupplementDraftFiles({
      assertWorkspaceUsable,
      bodyMarkdown,
      draftDirectory,
      metadata: nextMetadata,
    });
    return { ok: true, bodyByteLength: nextMetadata.bodyByteLength, revision: nextRevision };
  } catch (error) {
    const envelope = caughtWorkspaceError(error);
    return (
      envelope ??
      workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'Note supplement draft body could not be written'
      )
    );
  }
}

type FinalizeNoteSegmentDraftResult =
  | {
      readonly ok: true;
      readonly memory: MemorySummary;
      readonly segment: WorkspaceSegmentProjection;
    }
  | WorkspaceErrorEnvelope;

async function removePathBestEffort(filePath: string | null): Promise<void> {
  if (filePath) {
    await rm(filePath, { force: true, recursive: true }).catch(() => {});
  }
}

export async function finalizeNoteSegmentDraft({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  title,
  now,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly now: () => string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<FinalizeNoteSegmentDraftResult> {
  let exposedTargetDirectory: string | null = null;
  let exposedManifestPath: string | null = null;
  try {
    const draft = await readNoteDraftMetadata(rootPath, segmentId);
    if (draft.workspaceId !== workspaceId || draft.memoryId !== memoryId) {
      return workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'Note draft parent does not match');
    }
    const parentError = await assertNoteParentMemory({
      rootPath,
      memoryId,
      ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
    });
    if (parentError) {
      return parentError;
    }
    const draftDirectory = await resolveSafeDraftDirectory({
      rootPath,
      kind: 'segments',
      id: segmentId,
    });
    const parsed = parseWorkspaceMarkdownObject({
      markdown: await readTextFileNoFollow(noteDraftMarkdownPath(draftDirectory)),
      objectType: 'segment',
    });
    const bodyMarkdown = parsed.content;
    const finalizedAt = now();
    const assertUsable = workspaceWriteAssert(assertWorkspaceUsable);
    await assertNoDuplicateSegmentDirectoryById(rootPath, memoryId, segmentId);
    const targetDirectory = await memorySegmentDirectoryForNewNode(
      rootPath,
      memoryId,
      segmentId,
      title
    );
    const existingDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
    if (
      (await pathExistsNoFollow(existingDirectory)) ||
      (targetDirectory !== existingDirectory && (await pathExistsNoFollow(targetDirectory)))
    ) {
      return workspaceError('ERR_WORKSPACE_UPDATE_FAILED', 'Note segment target already exists');
    }
    const segmentsDirectory = path.dirname(targetDirectory);
    const targetMemoryDirectory = path.dirname(segmentsDirectory);
    assertWorkspaceUsableForWrite(assertWorkspaceUsable);
    await ensureNoteFinalizeChildDirectory({
      childName: path.basename(segmentsDirectory),
      parentDirectory: targetMemoryDirectory,
      ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
    });
    await createNoteFinalizeChildDirectory({
      childName: path.basename(targetDirectory),
      parentDirectory: segmentsDirectory,
      ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
    });
    exposedTargetDirectory = targetDirectory;
    const rendered = renderPersistedNoteMarkdown({
      objectType: 'segment',
      title,
      bodyMarkdown,
    });
    await writeWorkspaceFileAtomic(
      path.join(targetDirectory, 'segment.md'),
      rendered.markdown,
      assertUsable
    );
    await mkdir(path.join(rootPath, '.reo', 'objects', 'segments'), { recursive: true });
    exposedManifestPath = noteSegmentManifestPath(rootPath, segmentId);
    await writeWorkspaceJsonAtomic(
      exposedManifestPath,
      {
        schemaVersion: 1,
        objectType: 'segment',
        workspaceId,
        memoryId,
        segmentId,
        kind: 'note',
        createdAt: draft.createdAt,
        finalizedAt,
        updatedAt: finalizedAt,
        bodyByteLength: rendered.bodyByteLength,
      },
      assertUsable
    );
    const memory = await refreshMemoryIndexEntry(rootPath, memoryId, assertWorkspaceUsable);
    const segment = await readFinalizedSegmentProjection({
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
    });
    await rm(draftDirectory, { force: true, recursive: true });
    if (segment.type !== 'note') {
      return workspaceError('ERR_WORKSPACE_UPDATE_FAILED', 'Finalized note projection is missing');
    }
    return {
      ok: true,
      memory,
      segment,
    };
  } catch (error) {
    await removePathBestEffort(exposedTargetDirectory);
    await removePathBestEffort(exposedManifestPath);
    const envelope = caughtWorkspaceError(error);
    return (
      envelope ?? workspaceError('ERR_WORKSPACE_UPDATE_FAILED', 'Note draft could not be finalized')
    );
  }
}

type ReadNoteSegmentContentResult =
  | {
      readonly ok: true;
      readonly title: string;
      readonly bodyMarkdown: string;
      readonly bodyTiptapJson: JSONContent;
      readonly bodyByteLength: number;
      readonly baselineContentHash: string;
      readonly baselineTiptapContentHash: string;
    }
  | WorkspaceErrorEnvelope;

async function readNoteMarkdownContent({
  assertWorkspaceUsable,
  filePath,
  objectDirectory,
  objectType,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable | undefined;
  readonly filePath: string;
  readonly objectDirectory: string;
  readonly objectType: 'segment' | 'supplement';
}): Promise<{
  readonly title: string;
  readonly bodyMarkdown: string;
  readonly bodyTiptapJson: JSONContent;
  readonly bodyByteLength: number;
  readonly baselineContentHash: string;
  readonly baselineTiptapContentHash: string;
  readonly bodyMarkdownChanged: boolean;
}> {
  const rawMarkdown = await readTextFileNoFollow(filePath);
  const parsed = parseWorkspaceMarkdownObject({
    markdown: rawMarkdown,
    objectType,
  });
  if (!('kind' in parsed.data) || parsed.data.kind !== 'note') {
    throw workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'Workspace content is not a note');
  }
  const reconciled = await reconcileTiptapContentSidecar({
    assertUsable: workspaceWriteAssert(assertWorkspaceUsable),
    bodyMarkdown: parsed.content,
    objectDirectory,
    writeBodyMarkdown: async (nextBodyMarkdown) => {
      const markdown = renderWorkspaceMarkdownObject({
        objectType,
        data: parsed.data,
        content: nextBodyMarkdown,
      });
      const rendered = parseWorkspaceMarkdownObject({ markdown, objectType });
      await writeWorkspaceFileAtomic(
        filePath,
        markdown,
        workspaceWriteAssert(assertWorkspaceUsable)
      );
      return rendered.content;
    },
  });
  if (!reconciled.ok) {
    throw workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'Note content sidecar requires review');
  }
  return {
    title: parsed.data.title,
    bodyMarkdown: reconciled.bodyMarkdown,
    bodyTiptapJson: reconciled.tiptapJson,
    bodyByteLength: bodyByteLength(reconciled.bodyMarkdown),
    baselineContentHash: reconciled.baselineContentHash,
    baselineTiptapContentHash: reconciled.baselineTiptapContentHash,
    bodyMarkdownChanged: reconciled.bodyMarkdownChanged,
  };
}

export async function readFinalizedNoteSegmentContent({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<ReadNoteSegmentContentResult> {
  try {
    const usable = checkWorkspaceUsable(assertWorkspaceUsable);
    if (usable) {
      return usable;
    }
    const manifestPath = noteSegmentManifestPath(rootPath, segmentId);
    const manifest = await readNoteSegmentManifest(rootPath, segmentId);
    assertFinalizedNoteSegmentManifestOwnership(manifest, {
      workspaceId,
      memoryId,
      segmentId,
    });
    await assertNoDuplicateSegmentDirectoryById(rootPath, memoryId, segmentId);
    const segmentDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
    const content = await readNoteMarkdownContent({
      filePath: path.join(segmentDirectory, 'segment.md'),
      objectDirectory: segmentDirectory,
      objectType: 'segment',
      assertWorkspaceUsable,
    });
    if (content.bodyMarkdownChanged) {
      await updateManifestUpdatedAt({
        assertWorkspaceUsable,
        expected: {
          objectType: 'segment',
          workspaceId,
          memoryId,
          segmentId,
        },
        manifest,
        manifestPath,
        bodyByteLength: content.bodyByteLength,
        now: () => new Date().toISOString(),
      });
      await refreshMemoryIndexEntry(rootPath, memoryId, assertWorkspaceUsable);
    }
    const { bodyMarkdownChanged: _bodyMarkdownChanged, ...responseContent } = content;
    void _bodyMarkdownChanged;
    return { ok: true, ...responseContent };
  } catch (error) {
    const envelope = caughtWorkspaceError(error);
    return (
      envelope ??
      workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'Note segment content could not be read')
    );
  }
}

export async function readFinalizedNoteSegmentSupplementContent({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  supplementId,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<ReadNoteSegmentContentResult> {
  try {
    const usable = checkWorkspaceUsable(assertWorkspaceUsable);
    if (usable) {
      return usable;
    }
    const manifestPath = noteSupplementManifestPath(rootPath, supplementId);
    const manifest = await readNoteSupplementManifest(rootPath, supplementId);
    assertFinalizedNoteSupplementManifestOwnership(manifest, {
      workspaceId,
      memoryId,
      segmentId,
      supplementId,
    });
    await assertNoDuplicateSegmentDirectoryById(rootPath, memoryId, segmentId);
    const segmentDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
    const supplementDirectory = await resolveSegmentSupplementDirectoryInSegmentDirectory({
      rootPath,
      memoryId,
      segmentDirectory,
      segmentId,
      supplementId,
    });
    const content = await readNoteMarkdownContent({
      filePath: path.join(supplementDirectory, 'supplement.md'),
      objectDirectory: supplementDirectory,
      objectType: 'supplement',
      assertWorkspaceUsable,
    });
    if (content.bodyMarkdownChanged) {
      await updateManifestUpdatedAt({
        assertWorkspaceUsable,
        expected: {
          objectType: 'supplement',
          workspaceId,
          memoryId,
          segmentId,
          supplementId,
        },
        manifest,
        manifestPath,
        bodyByteLength: content.bodyByteLength,
        now: () => new Date().toISOString(),
      });
      await refreshMemoryIndexEntry(rootPath, memoryId, assertWorkspaceUsable);
    }
    const { bodyMarkdownChanged: _bodyMarkdownChanged, ...responseContent } = content;
    void _bodyMarkdownChanged;
    return { ok: true, ...responseContent };
  } catch (error) {
    const envelope = caughtWorkspaceError(error);
    return (
      envelope ??
      workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'Note supplement content could not be read')
    );
  }
}

async function updateManifestUpdatedAt({
  assertWorkspaceUsable,
  expected,
  manifest,
  manifestPath,
  bodyByteLength,
  now,
}: {
  readonly assertWorkspaceUsable: AssertWorkspaceUsable | undefined;
  readonly expected:
    | {
        readonly objectType: 'segment';
        readonly workspaceId: string;
        readonly memoryId: string;
        readonly segmentId: string;
      }
    | {
        readonly objectType: 'supplement';
        readonly workspaceId: string;
        readonly memoryId: string;
        readonly segmentId: string;
        readonly supplementId: string;
      };
  readonly manifest: FinalizedNoteSegmentManifest | FinalizedNoteSupplementManifest;
  readonly manifestPath: string;
  readonly bodyByteLength: number;
  readonly now: () => string;
}): Promise<void> {
  if (expected.objectType === 'segment') {
    assertFinalizedNoteSegmentManifestOwnership(manifest as FinalizedNoteSegmentManifest, expected);
  } else {
    assertFinalizedNoteSupplementManifestOwnership(
      manifest as FinalizedNoteSupplementManifest,
      expected
    );
  }
  await writeWorkspaceJsonAtomic(
    manifestPath,
    {
      ...manifest,
      updatedAt: now(),
      bodyByteLength,
    },
    workspaceWriteAssert(assertWorkspaceUsable)
  );
}

async function restoreOriginalFinalizedNoteFiles({
  assertWorkspaceUsable,
  manifestPath,
  markdownPath,
  sidecarPath,
  originalManifest,
  originalMarkdown,
  originalSidecar,
}: {
  readonly assertWorkspaceUsable: AssertWorkspaceUsable | undefined;
  readonly manifestPath: string;
  readonly markdownPath: string | null;
  readonly sidecarPath: string | null;
  readonly originalManifest: string | null;
  readonly originalMarkdown: string | null;
  readonly originalSidecar: string | null;
}): Promise<void> {
  if (markdownPath === null || originalMarkdown === null || originalManifest === null) {
    return;
  }
  const assertUsable = workspaceWriteAssert(assertWorkspaceUsable);
  try {
    await writeWorkspaceFileAtomic(markdownPath, originalMarkdown, assertUsable);
    if (sidecarPath !== null) {
      if (originalSidecar === null) {
        await rm(sidecarPath, { force: true });
      } else {
        await writeWorkspaceFileAtomic(sidecarPath, originalSidecar, assertUsable);
      }
    }
    await writeWorkspaceFileAtomic(manifestPath, originalManifest, assertUsable);
  } catch {
    // The caller reports update failure; failed rollback means the file may be index-stale.
  }
}

export async function writeFinalizedNoteSegmentContent({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  bodyMarkdown,
  bodyTiptapJson,
  baselineContentHash,
  baselineTiptapContentHash,
  now,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly bodyMarkdown: string;
  readonly bodyTiptapJson?: JSONContent;
  readonly baselineContentHash: string;
  readonly baselineTiptapContentHash?: string;
  readonly now: () => string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly baselineContentHash: string;
      readonly baselineTiptapContentHash: string;
      readonly bodyByteLength: number;
      readonly saved: true;
    }
  | WorkspaceErrorEnvelope
> {
  return withFinalizedNoteMarkdownSaveQueue(`${rootPath}:${memoryId}:${segmentId}:segment.md`, () =>
    writeFinalizedNoteSegmentContentNow({
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
      bodyMarkdown,
      ...(bodyTiptapJson ? { bodyTiptapJson } : {}),
      baselineContentHash,
      ...(baselineTiptapContentHash ? { baselineTiptapContentHash } : {}),
      now,
      ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
    })
  );
}

async function writeFinalizedNoteSegmentContentNow({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  bodyMarkdown,
  bodyTiptapJson,
  baselineContentHash,
  baselineTiptapContentHash,
  now,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly bodyMarkdown: string;
  readonly bodyTiptapJson?: JSONContent;
  readonly baselineContentHash: string;
  readonly baselineTiptapContentHash?: string;
  readonly now: () => string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly baselineContentHash: string;
      readonly baselineTiptapContentHash: string;
      readonly bodyByteLength: number;
      readonly saved: true;
    }
  | WorkspaceErrorEnvelope
> {
  let originalMarkdown: string | null = null;
  let originalManifest: string | null = null;
  let originalSidecar: string | null = null;
  let segmentPath: string | null = null;
  let sidecarPath: string | null = null;
  let finalizedWriteStarted = false;
  try {
    const segmentDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
    segmentPath = path.join(segmentDirectory, 'segment.md');
    sidecarPath = path.join(segmentDirectory, TIPTAP_CONTENT_SIDECAR_FILE);
    const manifestPath = noteSegmentManifestPath(rootPath, segmentId);
    originalManifest = await readTextFileNoFollow(manifestPath);
    const manifest = finalizedNoteSegmentManifestSchema.parse(JSON.parse(originalManifest));
    assertFinalizedNoteSegmentManifestOwnership(manifest, {
      workspaceId,
      memoryId,
      segmentId,
    });
    await assertNoDuplicateSegmentDirectoryById(rootPath, memoryId, segmentId);
    const current = await readNoteMarkdownContent({
      assertWorkspaceUsable,
      filePath: segmentPath,
      objectDirectory: segmentDirectory,
      objectType: 'segment',
    });
    originalMarkdown = await readTextFileNoFollow(segmentPath);
    originalSidecar = await readTextFileNoFollow(sidecarPath).catch(() => null);
    if (noteContentHash(current.bodyMarkdown) !== baselineContentHash) {
      throw staleNoteContentError(current);
    }
    if (
      baselineTiptapContentHash !== undefined &&
      current.baselineTiptapContentHash !== baselineTiptapContentHash
    ) {
      throw staleNoteContentError(current);
    }
    const assertUsable = workspaceWriteAssert(assertWorkspaceUsable);
    assertWorkspaceUsableForWrite(assertWorkspaceUsable);
    await beforeFinalizedNoteMarkdownWriteForTest?.();
    finalizedWriteStarted = true;
    const rendered = renderPersistedNoteMarkdown({
      objectType: 'segment',
      title: current.title,
      bodyMarkdown,
    });
    await writeWorkspaceFileAtomic(segmentPath, rendered.markdown, assertUsable);
    const savedTiptapJson = bodyTiptapJson ?? parseTiptapMarkdown(bodyMarkdown);
    const savedSidecar = await writeTiptapContentSidecar({
      assertUsable,
      bodyMarkdown: rendered.bodyMarkdown,
      objectDirectory: segmentDirectory,
      tiptapJson: savedTiptapJson,
    });
    await updateManifestUpdatedAt({
      assertWorkspaceUsable,
      expected: {
        objectType: 'segment',
        workspaceId,
        memoryId,
        segmentId,
      },
      manifest,
      manifestPath,
      bodyByteLength: rendered.bodyByteLength,
      now,
    });
    await refreshMemoryIndexEntry(rootPath, memoryId, assertWorkspaceUsable);
    return {
      ok: true,
      baselineContentHash: rendered.baselineContentHash,
      baselineTiptapContentHash: savedSidecar.contentHash,
      bodyByteLength: rendered.bodyByteLength,
      saved: true,
    };
  } catch (error) {
    if (finalizedWriteStarted) {
      await restoreOriginalFinalizedNoteFiles({
        assertWorkspaceUsable,
        manifestPath: noteSegmentManifestPath(rootPath, segmentId),
        markdownPath: segmentPath,
        sidecarPath,
        originalManifest,
        originalMarkdown,
        originalSidecar,
      });
    }
    const envelope = caughtWorkspaceError(error);
    return (
      envelope ??
      workspaceError('ERR_WORKSPACE_UPDATE_FAILED', 'Note segment content could not be written')
    );
  }
}

export async function writeFinalizedNoteSegmentSupplementContent({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  supplementId,
  bodyMarkdown,
  bodyTiptapJson,
  baselineContentHash,
  baselineTiptapContentHash,
  now,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly bodyMarkdown: string;
  readonly bodyTiptapJson?: JSONContent;
  readonly baselineContentHash: string;
  readonly baselineTiptapContentHash?: string;
  readonly now: () => string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly baselineContentHash: string;
      readonly baselineTiptapContentHash: string;
      readonly bodyByteLength: number;
      readonly saved: true;
    }
  | WorkspaceErrorEnvelope
> {
  return withFinalizedNoteMarkdownSaveQueue(
    `${rootPath}:${memoryId}:${segmentId}:${supplementId}:supplement.md`,
    () =>
      writeFinalizedNoteSegmentSupplementContentNow({
        rootPath,
        workspaceId,
        memoryId,
        segmentId,
        supplementId,
        bodyMarkdown,
        ...(bodyTiptapJson ? { bodyTiptapJson } : {}),
        baselineContentHash,
        ...(baselineTiptapContentHash ? { baselineTiptapContentHash } : {}),
        now,
        ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
      })
  );
}

async function writeFinalizedNoteSegmentSupplementContentNow({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  supplementId,
  bodyMarkdown,
  bodyTiptapJson,
  baselineContentHash,
  baselineTiptapContentHash,
  now,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly bodyMarkdown: string;
  readonly bodyTiptapJson?: JSONContent;
  readonly baselineContentHash: string;
  readonly baselineTiptapContentHash?: string;
  readonly now: () => string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly baselineContentHash: string;
      readonly baselineTiptapContentHash: string;
      readonly bodyByteLength: number;
      readonly saved: true;
    }
  | WorkspaceErrorEnvelope
> {
  let originalMarkdown: string | null = null;
  let originalManifest: string | null = null;
  let originalSidecar: string | null = null;
  let supplementPath: string | null = null;
  let sidecarPath: string | null = null;
  let finalizedWriteStarted = false;
  try {
    const segmentDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
    const supplementDirectory = await resolveSegmentSupplementDirectoryInSegmentDirectory({
      rootPath,
      memoryId,
      segmentDirectory,
      segmentId,
      supplementId,
    });
    supplementPath = path.join(supplementDirectory, 'supplement.md');
    sidecarPath = path.join(supplementDirectory, TIPTAP_CONTENT_SIDECAR_FILE);
    const manifestPath = noteSupplementManifestPath(rootPath, supplementId);
    originalManifest = await readTextFileNoFollow(manifestPath);
    const manifest = finalizedNoteSupplementManifestSchema.parse(JSON.parse(originalManifest));
    assertFinalizedNoteSupplementManifestOwnership(manifest, {
      workspaceId,
      memoryId,
      segmentId,
      supplementId,
    });
    await assertNoDuplicateSegmentDirectoryById(rootPath, memoryId, segmentId);
    const current = await readNoteMarkdownContent({
      assertWorkspaceUsable,
      filePath: supplementPath,
      objectDirectory: supplementDirectory,
      objectType: 'supplement',
    });
    originalMarkdown = await readTextFileNoFollow(supplementPath);
    originalSidecar = await readTextFileNoFollow(sidecarPath).catch(() => null);
    if (noteContentHash(current.bodyMarkdown) !== baselineContentHash) {
      throw staleNoteContentError(current);
    }
    if (
      baselineTiptapContentHash !== undefined &&
      current.baselineTiptapContentHash !== baselineTiptapContentHash
    ) {
      throw staleNoteContentError(current);
    }
    const assertUsable = workspaceWriteAssert(assertWorkspaceUsable);
    assertWorkspaceUsableForWrite(assertWorkspaceUsable);
    await beforeFinalizedNoteMarkdownWriteForTest?.();
    finalizedWriteStarted = true;
    const rendered = renderPersistedNoteMarkdown({
      objectType: 'supplement',
      title: current.title,
      bodyMarkdown,
    });
    await writeWorkspaceFileAtomic(supplementPath, rendered.markdown, assertUsable);
    const savedTiptapJson = bodyTiptapJson ?? parseTiptapMarkdown(bodyMarkdown);
    const savedSidecar = await writeTiptapContentSidecar({
      assertUsable,
      bodyMarkdown: rendered.bodyMarkdown,
      objectDirectory: supplementDirectory,
      tiptapJson: savedTiptapJson,
    });
    await updateManifestUpdatedAt({
      assertWorkspaceUsable,
      expected: {
        objectType: 'supplement',
        workspaceId,
        memoryId,
        segmentId,
        supplementId,
      },
      manifest,
      manifestPath,
      bodyByteLength: rendered.bodyByteLength,
      now,
    });
    await refreshMemoryIndexEntry(rootPath, memoryId, assertWorkspaceUsable);
    return {
      ok: true,
      baselineContentHash: rendered.baselineContentHash,
      baselineTiptapContentHash: savedSidecar.contentHash,
      bodyByteLength: rendered.bodyByteLength,
      saved: true,
    };
  } catch (error) {
    if (finalizedWriteStarted) {
      await restoreOriginalFinalizedNoteFiles({
        assertWorkspaceUsable,
        manifestPath: noteSupplementManifestPath(rootPath, supplementId),
        markdownPath: supplementPath,
        sidecarPath,
        originalManifest,
        originalMarkdown,
        originalSidecar,
      });
    }
    const envelope = caughtWorkspaceError(error);
    return (
      envelope ??
      workspaceError('ERR_WORKSPACE_UPDATE_FAILED', 'Note supplement content could not be written')
    );
  }
}

type FinalizeSegmentSupplementNoteDraftResult =
  | {
      readonly ok: true;
      readonly memory: MemorySummary;
      readonly segment: WorkspaceSegmentProjection;
      readonly supplement: NonNullable<WorkspaceSegmentProjection['supplements']>[number];
    }
  | WorkspaceErrorEnvelope;

export async function finalizeSegmentSupplementNoteDraft({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  supplementId,
  title,
  now,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly title: string;
  readonly now: () => string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<FinalizeSegmentSupplementNoteDraftResult> {
  let exposedTargetDirectory: string | null = null;
  let exposedManifestPath: string | null = null;
  try {
    const draft = await readNoteSupplementDraftMetadata(rootPath, supplementId);
    if (
      draft.workspaceId !== workspaceId ||
      draft.memoryId !== memoryId ||
      draft.segmentId !== segmentId
    ) {
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'Note supplement draft parent does not match'
      );
    }
    const parentError = await assertNoteParentMemory({
      rootPath,
      memoryId,
      ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
    });
    if (parentError) {
      return parentError;
    }
    await assertFinalizedSegmentParentForNoteSupplement({
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
    });
    const draftDirectory = await resolveSafeDraftDirectory({
      rootPath,
      kind: 'supplements',
      id: supplementId,
    });
    const parsed = parseWorkspaceMarkdownObject({
      markdown: await readTextFileNoFollow(noteSupplementDraftMarkdownPath(draftDirectory)),
      objectType: 'supplement',
    });
    const bodyMarkdown = parsed.content;
    const finalizedAt = now();
    const assertUsable = workspaceWriteAssert(assertWorkspaceUsable);
    const parentDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
    const supplementsDirectory = path.join(parentDirectory, 'supplements');
    const targetDirectory = await segmentSupplementDirectoryForNewNode(
      rootPath,
      memoryId,
      segmentId,
      supplementId,
      title
    );
    const existingSupplementDirectory = await resolveSegmentSupplementDirectoryInSegmentDirectory({
      rootPath,
      memoryId,
      segmentDirectory: parentDirectory,
      segmentId,
      supplementId,
    });
    if (
      (await pathExistsNoFollow(existingSupplementDirectory)) ||
      (targetDirectory !== existingSupplementDirectory &&
        (await pathExistsNoFollow(targetDirectory)))
    ) {
      return workspaceError('ERR_WORKSPACE_UPDATE_FAILED', 'Note supplement target already exists');
    }
    assertWorkspaceUsableForWrite(assertWorkspaceUsable);
    await ensureNoteFinalizeChildDirectory({
      childName: path.basename(supplementsDirectory),
      parentDirectory,
      ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
    });
    await createNoteFinalizeChildDirectory({
      childName: path.basename(targetDirectory),
      parentDirectory: supplementsDirectory,
      ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
    });
    exposedTargetDirectory = targetDirectory;
    const rendered = renderPersistedNoteMarkdown({
      objectType: 'supplement',
      title,
      bodyMarkdown,
    });
    await writeWorkspaceFileAtomic(
      path.join(targetDirectory, 'supplement.md'),
      rendered.markdown,
      assertUsable
    );
    await mkdir(path.join(rootPath, '.reo', 'objects', 'supplements'), { recursive: true });
    exposedManifestPath = noteSupplementManifestPath(rootPath, supplementId);
    await writeWorkspaceJsonAtomic(
      exposedManifestPath,
      {
        schemaVersion: 1,
        objectType: 'supplement',
        workspaceId,
        memoryId,
        segmentId,
        supplementId,
        kind: 'note',
        createdAt: draft.createdAt,
        finalizedAt,
        updatedAt: finalizedAt,
        bodyByteLength: rendered.bodyByteLength,
      },
      assertUsable
    );
    const memory = await refreshMemoryIndexEntry(rootPath, memoryId, assertWorkspaceUsable);
    const segment = await readFinalizedSegmentProjection({
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
    });
    const supplement = await readFinalizedSegmentSupplementProjectionFromKnownDirectory({
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
      supplementDirectory: targetDirectory,
      supplementId,
    });
    await rm(draftDirectory, { force: true, recursive: true });
    if (supplement.type !== 'note') {
      return workspaceError(
        'ERR_WORKSPACE_UPDATE_FAILED',
        'Finalized note supplement projection is missing'
      );
    }
    return {
      ok: true,
      memory,
      segment,
      supplement,
    };
  } catch (error) {
    await removePathBestEffort(exposedTargetDirectory);
    await removePathBestEffort(exposedManifestPath);
    const envelope = caughtWorkspaceError(error);
    return (
      envelope ??
      workspaceError('ERR_WORKSPACE_UPDATE_FAILED', 'Note supplement draft could not be finalized')
    );
  }
}

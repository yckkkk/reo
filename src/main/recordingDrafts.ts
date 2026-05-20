import {
  closeSync,
  constants,
  fsync as fsyncCallback,
  fstatSync,
  ftruncateSync,
  fsyncSync,
  mkdirSync,
  read as readCallback,
  readFile as readFileCallback,
  rmdirSync,
  write as writeCallback,
  writeSync,
} from 'node:fs';
import { rmdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  MAX_BACKFILL_AUDIO_READ_BYTES,
  MAX_RECORDING_DRAFT_AUDIO_READ_BYTES,
} from '../workspace-contract/recording-audio.js';
import {
  writeWorkspaceFileAtomicInKnownDirectory,
  writeWorkspaceJsonAtomicInKnownDirectory,
} from './atomicWorkspaceFile.js';
import {
  assertSameCurrentDirectoryIdentity as assertSameCurrentDirectory,
  assertSameDirectoryIdentity as assertSameDirectory,
  assertSameDirectoryIdentitySync as assertSameDirectoryPath,
  readSafeDirectoryIdentity as readDirectoryIdentity,
  readSafeDirectoryIdentitySync as readDirectoryIdentitySync,
  type DirectoryIdentity,
} from './directoryIdentity.js';
import {
  openExistingWorkspaceFileInDirectory,
  openNoReplaceWorkspaceFileInDirectory,
  runInWorkspaceDirectorySync,
} from './workspaceDirectoryTransactions.js';
import {
  appendAudioSupplementToSegment,
  appendAudioSegmentToMemory,
  appendAudioSegmentToMemoryForTest,
  assertNoDuplicateSegmentDirectoryById,
  extractSegmentTranscript,
  lookupSegmentDirectoryById,
  markSegmentTranscriptionAttemptSuccess,
  markSupplementTranscriptionAttemptSuccess,
  memorySegmentDirectory,
  readFinalizedSegmentProjection,
  readFinalizedSegmentSupplementProjectionFromKnownDirectory,
  readFinalizedSegmentSummary,
  readFinalizedSegmentSummaryFromKnownDirectory,
  replaceSegmentTranscript,
  resolveSegmentSupplementDirectoryInSegmentDirectory,
  refreshMemoryIndexEntry,
  refreshMemoryIndexEntryWithDetail,
  removeSafeWorkspaceDirectory,
  type FinalizeTransactionHooksForTest,
  type MemorySummary,
} from './memoryFiles.js';
import { transcriptDigest } from './transcriptDigest.js';
import {
  draftSegmentMetadataSchema,
  draftSegmentSupplementMetadataSchema,
  workspaceError,
  type DraftSegmentSupplementMetadata,
  type DraftSegmentMetadata,
  type FinalizeTranscriptionAttempt,
  type WorkspaceSegmentSupplementProjection,
  type WorkspaceSegmentProjection,
  type WorkspaceErrorEnvelope,
} from '../workspace-contract/workspace-contract.js';
import {
  createSafeSupplementId,
  createSafeSegmentId,
  ensureWorkspaceSupplementDraftsDirectory,
  ensureWorkspaceDraftsDirectory,
  resolveWorkspaceDraftSupplementDirectory,
  resolveWorkspaceDraftSegmentDirectory,
} from './workspacePaths.js';
import {
  parseWorkspaceMarkdownObject,
  renderWorkspaceMarkdownObject,
} from './workspaceMarkdownObjects.js';
import { withWorkspaceAsyncQueue } from './workspaceAsyncQueue.js';

const MAX_AUDIO_CHUNK_BYTES = 1_048_576;
const MAX_FINALIZED_TRANSCRIPT_READ_BYTES = 1_048_576;
const MAX_RECORDING_METADATA_BYTES = 1_048_576;
type MaybePromise<T> = T | Promise<T>;
const fsyncDescriptor = promisify(fsyncCallback);
const readDescriptor = promisify(readCallback);
const readFileDescriptor = promisify(readFileCallback);
const writeDescriptor = promisify(writeCallback);
type AssertWorkspaceUsable = () => { readonly ok: true } | WorkspaceErrorEnvelope;
type RecordingMarkdownSaveInput = {
  readonly rootPath: string;
  readonly segmentId: string;
  readonly fileName: 'transcript.md';
  readonly markdown: string;
  readonly allowOverwrite?: boolean;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly expectedTranscriptDigest?: string;
  readonly isAbortRequested?: () => boolean;
  readonly requireTranscriptMissing?: boolean;
};
type FinalizedAudioSegmentMarkdownSaveInput = RecordingMarkdownSaveInput & {
  readonly workspaceId: string;
  readonly memoryId: string;
};
type FinalizedAudioSegmentSupplementMarkdownSaveInput = {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly markdown: string;
  readonly allowOverwrite?: boolean;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly expectedTranscriptDigest?: string;
  readonly isAbortRequested?: () => boolean;
  readonly requireTranscriptMissing?: boolean;
};
type TranscriptOverwriteRollback = {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly fileName: 'segment.md' | 'supplement.md';
  readonly previousMarkdown: string;
};
function checkWorkspaceUsable(
  assertWorkspaceUsable?: AssertWorkspaceUsable
): WorkspaceErrorEnvelope | null {
  const usable = assertWorkspaceUsable?.();
  return usable && !usable.ok ? usable : null;
}

function assertWorkspaceUsableForFileWrite(assertWorkspaceUsable?: AssertWorkspaceUsable): void {
  const error = checkWorkspaceUsable(assertWorkspaceUsable);
  if (error) {
    throw error;
  }
}

function throwIfBackfillSaveAborted(isAbortRequested?: () => boolean): void {
  if (isAbortRequested?.()) {
    throw workspaceError(
      'ERR_BACKFILL_UNAVAILABLE',
      'Backfill was canceled',
      'previous-file-preserved'
    );
  }
}

function assertBackfillSaveCanContinue(
  assertWorkspaceUsable?: AssertWorkspaceUsable,
  isAbortRequested?: () => boolean
): void {
  assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
  throwIfBackfillSaveAborted(isAbortRequested);
}

function caughtWorkspaceError(error: unknown): WorkspaceErrorEnvelope | null {
  return typeof error === 'object' && error !== null && (error as { ok?: unknown }).ok === false
    ? (error as WorkspaceErrorEnvelope)
    : null;
}

const inFlightAppends = new Set<string>();
const inFlightSupplementAppends = new Set<string>();
const inFlightDraftPrefixCopies = new Set<string>();
const inFlightDraftAudioReads = new Set<string>();
const finalizingRecordings = new Set<string>();
const finalizingSupplements = new Set<string>();
const activeDrafts = new Set<string>();
const activeSupplementDrafts = new Set<string>();
const recordingRuntimeKeysByRoot = new Map<string, Set<string>>();
const markdownSaveQueues = new Map<string, Promise<void>>();
let beforeDraftDirectoryCreateForTest: (() => MaybePromise<void>) | null = null;
let afterDraftDirectoryCreateForTest: (() => MaybePromise<void>) | null = null;
let beforeDraftAudioCreateForTest: (() => MaybePromise<void>) | null = null;
let beforeDraftAudioOpenForTest: (() => MaybePromise<void>) | null = null;
let afterDraftAudioReadForTest: (() => MaybePromise<void>) | null = null;
let afterDraftPrefixBytesCopiedForTest: (() => void) | null = null;
let beforeMarkdownWriteForTest: (() => MaybePromise<void>) | null = null;

function recordingKey(rootPath: string, segmentId: string): string {
  return `${path.resolve(rootPath)}:${segmentId}`;
}

function recordingRootKey(rootPath: string): string {
  return path.resolve(rootPath);
}

function recordingRuntimeStores(): readonly Set<string>[] {
  return [
    inFlightAppends,
    inFlightSupplementAppends,
    inFlightDraftPrefixCopies,
    inFlightDraftAudioReads,
    finalizingRecordings,
    finalizingSupplements,
    activeDrafts,
    activeSupplementDrafts,
  ];
}

function trackRecordingRuntimeKey(rootPath: string, key: string): void {
  const rootKey = recordingRootKey(rootPath);
  const rootKeys = recordingRuntimeKeysByRoot.get(rootKey) ?? new Set<string>();
  rootKeys.add(key);
  recordingRuntimeKeysByRoot.set(rootKey, rootKeys);
}

function untrackRecordingRuntimeKey(rootPath: string, key: string): void {
  if (recordingRuntimeStores().some((store) => store.has(key))) {
    return;
  }
  const rootKey = recordingRootKey(rootPath);
  const rootKeys = recordingRuntimeKeysByRoot.get(rootKey);
  if (!rootKeys) {
    return;
  }
  rootKeys.delete(key);
  if (rootKeys.size === 0) {
    recordingRuntimeKeysByRoot.delete(rootKey);
  }
}

function addRecordingRuntimeKey(store: Set<string>, rootPath: string, key: string): void {
  store.add(key);
  trackRecordingRuntimeKey(rootPath, key);
}

function deleteRecordingRuntimeKey(store: Set<string>, rootPath: string, key: string): void {
  store.delete(key);
  untrackRecordingRuntimeKey(rootPath, key);
}

function clearRecordingRuntimeStateForRootKey(rootKey: string): void {
  const keys = recordingRuntimeKeysByRoot.get(rootKey);
  if (!keys) {
    return;
  }
  for (const key of keys) {
    for (const store of recordingRuntimeStores()) {
      store.delete(key);
    }
  }
  recordingRuntimeKeysByRoot.delete(rootKey);
}

export function clearRecordingRuntimeState(): void {
  inFlightAppends.clear();
  inFlightSupplementAppends.clear();
  inFlightDraftAudioReads.clear();
  inFlightDraftPrefixCopies.clear();
  finalizingRecordings.clear();
  finalizingSupplements.clear();
  activeDrafts.clear();
  activeSupplementDrafts.clear();
  recordingRuntimeKeysByRoot.clear();
  markdownSaveQueues.clear();
}

export function clearRecordingRuntimeStateForRoot(rootPath: string): void {
  const rootKey = recordingRootKey(rootPath);
  clearRecordingRuntimeStateForRootKey(rootKey);
  for (const key of markdownSaveQueues.keys()) {
    if (key.startsWith(`${rootKey}:`)) {
      markdownSaveQueues.delete(key);
    }
  }
}

async function withMarkdownSaveQueue<T>(key: string, run: () => Promise<T>): Promise<T> {
  return withWorkspaceAsyncQueue(markdownSaveQueues, key, run);
}

function createRecordingDirectoryWithinParent({
  parentDirectory,
  directoryName,
}: {
  readonly parentDirectory: string;
  readonly directoryName: string;
}): string {
  const parentIdentity = readDirectoryIdentitySync(parentDirectory);
  return runInWorkspaceDirectorySync(
    { directory: parentDirectory, directoryIdentity: parentIdentity },
    () => {
      let directoryCreated = false;
      try {
        mkdirSync(directoryName);
        directoryCreated = true;
        assertSameDirectoryPath(parentDirectory, parentIdentity);
        assertSameCurrentDirectory(parentIdentity);
        directoryCreated = false;
        return path.join(parentDirectory, directoryName);
      } catch (error) {
        if (directoryCreated) {
          rmdirSync(directoryName);
        }
        throw error;
      }
    }
  );
}

const resolveDraftRecordingDirectory = resolveWorkspaceDraftSegmentDirectory;
const resolveDraftSupplementDirectory = resolveWorkspaceDraftSupplementDirectory;

async function resolveFinalizedAudioSegmentReadTarget(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<{
  readonly directory: string;
  readonly audioByteLength: number;
  readonly lastTranscriptionAttempt: 'failed' | 'never' | 'success';
}> {
  const directory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
  const directoryIdentity = await readDirectoryIdentity(directory);
  const summary = await readFinalizedSegmentSummaryFromKnownDirectory({
    rootPath,
    memoryId,
    segmentId,
    recordingDirectory: directory,
    recordingDirectoryIdentity: directoryIdentity,
  });
  if (summary.segmentId !== segmentId) {
    throw new Error('Recording durable truth is invalid');
  }
  await assertNoDuplicateSegmentDirectoryById(rootPath, memoryId, segmentId);
  return {
    directory,
    audioByteLength: summary.audioByteLength,
    lastTranscriptionAttempt: summary.lastTranscriptionAttempt,
  };
}

async function resolveFinalizedAudioSegmentSupplementReadTarget(
  rootPath: string,
  workspaceId: string,
  memoryId: string,
  segmentId: string,
  supplementId: string
): Promise<{
  readonly directory: string;
  readonly audioByteLength: number;
  readonly lastTranscriptionAttempt: 'failed' | 'never' | 'success';
}> {
  const segmentDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
  const segmentDirectoryIdentity = await readDirectoryIdentity(segmentDirectory);
  const supplementsDirectory = path.join(segmentDirectory, 'supplements');
  const supplementsDirectoryIdentity = await readDirectoryIdentity(supplementsDirectory);
  const supplementDirectory = await resolveSegmentSupplementDirectoryInSegmentDirectory({
    rootPath,
    memoryId,
    segmentDirectory,
    segmentId,
    supplementId,
  });
  const relative = path.relative(supplementsDirectory, supplementDirectory);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Segment supplement path escapes parent segment');
  }

  const supplementDirectoryIdentity = await readDirectoryIdentity(supplementDirectory);
  await assertNoDuplicateSegmentDirectoryById(rootPath, memoryId, segmentId);
  const supplement = await readFinalizedSegmentSupplementProjectionFromKnownDirectory({
    supplementDirectory,
    rootPath,
    workspaceId,
    memoryId,
    segmentId,
    supplementId,
  });
  await assertSameDirectory(segmentDirectory, segmentDirectoryIdentity);
  await assertSameDirectory(supplementsDirectory, supplementsDirectoryIdentity);
  await assertSameDirectory(supplementDirectory, supplementDirectoryIdentity);
  if (supplement.type !== 'audio') {
    throw new Error('Segment supplement is not audio');
  }
  return {
    directory: supplementDirectory,
    audioByteLength: supplement.audioByteLength,
    lastTranscriptionAttempt: supplement.lastTranscriptionAttempt,
  };
}

async function readMetadata(
  rootPath: string,
  segmentId: string
): Promise<DraftSegmentMetadata | null> {
  try {
    const recordingDirectory = resolveDraftRecordingDirectory(rootPath, segmentId);
    const directoryIdentity = await readDirectoryIdentity(recordingDirectory);
    return await readMetadataInKnownDirectory(recordingDirectory, directoryIdentity);
  } catch {
    return null;
  }
}

async function readMetadataInKnownDirectory(
  recordingDirectory: string,
  directoryIdentity: DirectoryIdentity
): Promise<DraftSegmentMetadata> {
  const fileFd = openFileForReadInDirectory(recordingDirectory, directoryIdentity, 'segment.json');
  try {
    const metadata = fstatSync(fileFd);
    if (!metadata.isFile()) {
      throw new Error('Recording metadata path is unsafe');
    }
    if (metadata.size > MAX_RECORDING_METADATA_BYTES) {
      throw new Error('Recording metadata is too large');
    }
    const content = (await readFileDescriptor(fileFd, 'utf8')) as string;
    await assertSameDirectory(recordingDirectory, directoryIdentity);
    return draftSegmentMetadataSchema.parse(JSON.parse(content));
  } finally {
    closeSync(fileFd);
  }
}

async function readSupplementMetadata(
  rootPath: string,
  supplementId: string
): Promise<DraftSegmentSupplementMetadata | null> {
  try {
    const supplementDirectory = resolveDraftSupplementDirectory(rootPath, supplementId);
    const directoryIdentity = await readDirectoryIdentity(supplementDirectory);
    return await readSupplementMetadataInKnownDirectory(supplementDirectory, directoryIdentity);
  } catch {
    return null;
  }
}

async function readSupplementMetadataInKnownDirectory(
  supplementDirectory: string,
  directoryIdentity: DirectoryIdentity
): Promise<DraftSegmentSupplementMetadata> {
  const fileFd = openFileForReadInDirectory(
    supplementDirectory,
    directoryIdentity,
    'supplement.json'
  );
  try {
    const metadata = fstatSync(fileFd);
    if (!metadata.isFile()) {
      throw new Error('Segment supplement metadata path is unsafe');
    }
    if (metadata.size > MAX_RECORDING_METADATA_BYTES) {
      throw new Error('Segment supplement metadata is too large');
    }
    const content = (await readFileDescriptor(fileFd, 'utf8')) as string;
    await assertSameDirectory(supplementDirectory, directoryIdentity);
    return draftSegmentSupplementMetadataSchema.parse(JSON.parse(content));
  } finally {
    closeSync(fileFd);
  }
}

function openFileForReadInDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string
): number {
  return openExistingWorkspaceFileInDirectory({
    directory,
    directoryIdentity,
    fileName,
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
}

async function readTextFileInKnownDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string,
  maxBytes: number
): Promise<string> {
  const fd = openFileForReadInDirectory(directory, directoryIdentity, fileName);
  try {
    const file = fstatSync(fd);
    if (!file.isFile()) {
      throw new Error('Workspace text file path is unsafe');
    }
    if (file.size > maxBytes) {
      throw new Error('Workspace text file is too large');
    }
    return (await readFileDescriptor(fd, 'utf8')) as string;
  } finally {
    closeSync(fd);
  }
}

async function writeMetadata(
  recordingDirectory: string,
  directoryIdentity: DirectoryIdentity,
  metadata: DraftSegmentMetadata
): Promise<void> {
  await writeWorkspaceJsonAtomicInKnownDirectory({
    directory: recordingDirectory,
    directoryIdentity,
    fileName: 'segment.json',
    value: metadata,
  });
}

async function writeSupplementMetadata(
  supplementDirectory: string,
  directoryIdentity: DirectoryIdentity,
  metadata: DraftSegmentSupplementMetadata
): Promise<void> {
  await writeWorkspaceJsonAtomicInKnownDirectory({
    directory: supplementDirectory,
    directoryIdentity,
    fileName: 'supplement.json',
    value: metadata,
  });
}

export function setBeforeDraftDirectoryCreateForTest(
  hook: (() => MaybePromise<void>) | null
): void {
  beforeDraftDirectoryCreateForTest = hook;
}

export function setAfterDraftDirectoryCreateForTest(hook: (() => MaybePromise<void>) | null): void {
  afterDraftDirectoryCreateForTest = hook;
}

export function setBeforeDraftAudioCreateForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeDraftAudioCreateForTest = hook;
}

export function setBeforeDraftAudioOpenForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeDraftAudioOpenForTest = hook;
}

export function setAfterDraftAudioReadForTest(hook: (() => MaybePromise<void>) | null): void {
  afterDraftAudioReadForTest = hook;
}

export function setAfterDraftPrefixBytesCopiedForTest(hook: (() => void) | null): void {
  afterDraftPrefixBytesCopiedForTest = hook;
}

export function setBeforeMarkdownWriteForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeMarkdownWriteForTest = hook;
}

async function createEmptyDraftAudioFile(
  recordingDirectory: string,
  directoryIdentity: DirectoryIdentity,
  assertWorkspaceUsable?: AssertWorkspaceUsable
): Promise<void> {
  await assertSameDirectory(recordingDirectory, directoryIdentity);
  await beforeDraftAudioCreateForTest?.();
  assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
  const audioFd = openNoReplaceWorkspaceFileInDirectory({
    directory: recordingDirectory,
    directoryIdentity,
    fileName: 'audio.webm',
  });
  try {
    fsyncSync(audioFd);
  } finally {
    closeSync(audioFd);
  }
}

async function openAudioFileForAppend(
  recordingDirectory: string,
  directoryIdentity: DirectoryIdentity,
  expectedByteLength: number
) {
  try {
    await beforeDraftAudioOpenForTest?.();
    const audioFd = openExistingWorkspaceFileInDirectory({
      directory: recordingDirectory,
      directoryIdentity,
      fileName: 'audio.webm',
      flags: constants.O_RDWR | constants.O_APPEND | constants.O_NOFOLLOW,
    });
    try {
      const currentAudio = fstatSync(audioFd);
      if (!currentAudio.isFile() || currentAudio.size !== expectedByteLength) {
        throw new Error('Recording audio path is unsafe');
      }
      await assertSameDirectory(recordingDirectory, directoryIdentity);
      return { fd: audioFd, previousSize: currentAudio.size };
    } catch (error) {
      closeSync(audioFd);
      throw error;
    }
  } catch {
    return null;
  }
}

export async function initializeRecordingDraftWorkspace({
  rootPath,
}: {
  readonly rootPath: string;
}): Promise<void> {
  const draftsDirectory = await ensureWorkspaceDraftsDirectory(rootPath);
  if (typeof draftsDirectory !== 'string') {
    throw new Error('Workspace path is unsafe');
  }
}

export async function createRecordingDraft({
  rootPath,
  workspaceId,
  createSegmentId,
  now,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly createSegmentId: () => string;
  readonly now: () => string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly segmentId: string;
      readonly nextSequence: number;
    }
  | WorkspaceErrorEnvelope
> {
  let recordingDirectory: string | null = null;
  let recordingDirectoryIdentity: DirectoryIdentity | null = null;
  let draftDirectoryCreated = false;
  try {
    const usable = checkWorkspaceUsable(assertWorkspaceUsable);
    if (usable) {
      return usable;
    }
    const segmentId = createSafeSegmentId(createSegmentId());
    const key = recordingKey(rootPath, segmentId);
    recordingDirectory = resolveDraftRecordingDirectory(rootPath, segmentId);
    await beforeDraftDirectoryCreateForTest?.();
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    recordingDirectory = createRecordingDirectoryWithinParent({
      parentDirectory: path.dirname(recordingDirectory),
      directoryName: segmentId,
    });
    draftDirectoryCreated = true;
    recordingDirectoryIdentity = await readDirectoryIdentity(recordingDirectory);
    await afterDraftDirectoryCreateForTest?.();
    resolveDraftRecordingDirectory(rootPath, segmentId);
    await assertSameDirectory(recordingDirectory, recordingDirectoryIdentity);
    const metadata: DraftSegmentMetadata = {
      schemaVersion: 1,
      workspaceId,
      segmentId,
      type: 'audio',
      status: 'draft',
      title: '',
      createdAt: now(),
      nextSequence: 0,
      audioByteLength: 0,
    };
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    await createEmptyDraftAudioFile(
      recordingDirectory,
      recordingDirectoryIdentity,
      assertWorkspaceUsable
    );
    await assertSameDirectory(recordingDirectory, recordingDirectoryIdentity);
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    await writeMetadata(recordingDirectory, recordingDirectoryIdentity, metadata);
    addRecordingRuntimeKey(activeDrafts, rootPath, key);
    return { ok: true, segmentId, nextSequence: 0 };
  } catch (error) {
    if (draftDirectoryCreated && recordingDirectory && recordingDirectoryIdentity) {
      try {
        await assertSameDirectory(recordingDirectory, recordingDirectoryIdentity);
        await rmdir(recordingDirectory);
      } catch {
        // The managed path moved or cleanup is no longer safe.
      }
    }
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return workspaceError('ERR_RECORDING_INVALID_ID', 'Recording draft could not be created');
  }
}

export async function createSegmentSupplementRecordingDraft({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  createSupplementId,
  now,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly createSupplementId: () => string;
  readonly now: () => string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly supplementId: string;
      readonly nextSequence: number;
    }
  | WorkspaceErrorEnvelope
> {
  let supplementDirectory: string | null = null;
  let supplementDirectoryIdentity: DirectoryIdentity | null = null;
  let draftDirectoryCreated = false;
  try {
    const usable = checkWorkspaceUsable(assertWorkspaceUsable);
    if (usable) {
      return usable;
    }
    await readFinalizedSegmentSummary(rootPath, memoryId, segmentId);
    const supplementId = createSafeSupplementId(createSupplementId());
    const key = recordingKey(rootPath, supplementId);
    const supplementDraftsDirectory = await ensureWorkspaceSupplementDraftsDirectory(
      rootPath,
      assertWorkspaceUsable
    );
    if (typeof supplementDraftsDirectory !== 'string') {
      return supplementDraftsDirectory;
    }
    supplementDirectory = resolveDraftSupplementDirectory(rootPath, supplementId);
    await beforeDraftDirectoryCreateForTest?.();
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    supplementDirectory = createRecordingDirectoryWithinParent({
      parentDirectory: path.dirname(supplementDirectory),
      directoryName: supplementId,
    });
    draftDirectoryCreated = true;
    supplementDirectoryIdentity = await readDirectoryIdentity(supplementDirectory);
    await afterDraftDirectoryCreateForTest?.();
    resolveDraftSupplementDirectory(rootPath, supplementId);
    await assertSameDirectory(supplementDirectory, supplementDirectoryIdentity);
    const metadata: DraftSegmentSupplementMetadata = {
      schemaVersion: 1,
      workspaceId,
      memoryId,
      segmentId,
      supplementId,
      type: 'audio',
      status: 'draft',
      title: '',
      createdAt: now(),
      nextSequence: 0,
      audioByteLength: 0,
    };
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    await createEmptyDraftAudioFile(
      supplementDirectory,
      supplementDirectoryIdentity,
      assertWorkspaceUsable
    );
    await assertSameDirectory(supplementDirectory, supplementDirectoryIdentity);
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    await writeSupplementMetadata(supplementDirectory, supplementDirectoryIdentity, metadata);
    addRecordingRuntimeKey(activeSupplementDrafts, rootPath, key);
    return { ok: true, supplementId, nextSequence: 0 };
  } catch (error) {
    if (draftDirectoryCreated && supplementDirectory && supplementDirectoryIdentity) {
      try {
        await assertSameDirectory(supplementDirectory, supplementDirectoryIdentity);
        await rmdir(supplementDirectory);
      } catch {
        // The managed path moved or cleanup is no longer safe.
      }
    }
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return workspaceError(
      'ERR_RECORDING_INVALID_ID',
      'Segment supplement recording draft could not be created'
    );
  }
}

export async function appendRecordingAudioChunk({
  rootPath,
  segmentId,
  sequence,
  chunk,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly segmentId: string;
  readonly sequence: number;
  readonly chunk: Uint8Array;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<{ readonly ok: true; readonly nextSequence: number } | WorkspaceErrorEnvelope> {
  const usable = checkWorkspaceUsable(assertWorkspaceUsable);
  if (usable) {
    return usable;
  }
  if (chunk.byteLength > MAX_AUDIO_CHUNK_BYTES) {
    return workspaceError('ERR_RECORDING_CHUNK_TOO_LARGE', 'Recording audio chunk is too large');
  }

  const key = recordingKey(rootPath, segmentId);
  if (finalizingRecordings.has(key)) {
    return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalized');
  }
  if (inFlightAppends.has(key)) {
    return workspaceError('ERR_RECORDING_APPEND_IN_FLIGHT', 'Recording append already in flight');
  }
  if (inFlightDraftPrefixCopies.has(key)) {
    return workspaceError(
      'ERR_RECORDING_APPEND_IN_FLIGHT',
      'Recording draft prefix copy in flight'
    );
  }
  if (inFlightDraftAudioReads.has(key)) {
    return workspaceError('ERR_RECORDING_APPEND_IN_FLIGHT', 'Recording draft audio read in flight');
  }

  addRecordingRuntimeKey(inFlightAppends, rootPath, key);
  let draftKnown = false;
  try {
    if (!activeDrafts.has(key)) {
      const existing = await lookupSegmentDirectoryById(rootPath, segmentId);
      if (
        existing.status === 'found' ||
        existing.status === 'found-non-audio' ||
        existing.status === 'duplicate'
      ) {
        return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalized');
      }
      if (existing.status === 'invalid-id') {
        throw new Error('Invalid segment id');
      }
      if (existing.status === 'invalid-durable') {
        return workspaceError(
          'ERR_WORKSPACE_UNSAFE_PATH',
          'Recording durable truth is unsafe',
          'draft-preserved'
        );
      }
    }

    const recordingDirectory = resolveDraftRecordingDirectory(rootPath, segmentId);
    const recordingDirectoryIdentity = await readDirectoryIdentity(recordingDirectory);
    const metadata = await readMetadataInKnownDirectory(
      recordingDirectory,
      recordingDirectoryIdentity
    ).catch(() => null);
    if (!metadata) {
      return workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording draft not found');
    }
    draftKnown = true;
    if (metadata.status !== 'draft') {
      return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalized');
    }
    if (metadata.nextSequence !== sequence) {
      return workspaceError('ERR_RECORDING_SEQUENCE', 'Recording audio chunk sequence mismatch');
    }

    const audioAppend = await openAudioFileForAppend(
      recordingDirectory,
      recordingDirectoryIdentity,
      metadata.audioByteLength
    );
    if (!audioAppend) {
      return workspaceError(
        'ERR_WORKSPACE_UNSAFE_PATH',
        'Recording audio path is unsafe',
        'draft-preserved'
      );
    }
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    try {
      writeSync(audioAppend.fd, chunk);
      fsyncSync(audioAppend.fd);
      const nextMetadata = {
        ...metadata,
        nextSequence: metadata.nextSequence + 1,
        audioByteLength: metadata.audioByteLength + chunk.byteLength,
      };
      try {
        assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
        await writeMetadata(recordingDirectory, recordingDirectoryIdentity, nextMetadata);
      } catch (error) {
        ftruncateSync(audioAppend.fd, audioAppend.previousSize);
        fsyncSync(audioAppend.fd);
        throw error;
      }
      return { ok: true, nextSequence: nextMetadata.nextSequence };
    } finally {
      closeSync(audioAppend.fd);
    }
  } catch (error) {
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return draftKnown
      ? workspaceError(
          'ERR_RECORDING_APPEND_FAILED',
          'Recording audio chunk could not be appended',
          'draft-preserved'
        )
      : workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording draft not found');
  } finally {
    deleteRecordingRuntimeKey(inFlightAppends, rootPath, key);
  }
}

export async function appendSegmentSupplementRecordingAudioChunk({
  rootPath,
  supplementId,
  sequence,
  chunk,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly supplementId: string;
  readonly sequence: number;
  readonly chunk: Uint8Array;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<{ readonly ok: true; readonly nextSequence: number } | WorkspaceErrorEnvelope> {
  const usable = checkWorkspaceUsable(assertWorkspaceUsable);
  if (usable) {
    return usable;
  }
  if (chunk.byteLength > MAX_AUDIO_CHUNK_BYTES) {
    return workspaceError('ERR_RECORDING_CHUNK_TOO_LARGE', 'Recording audio chunk is too large');
  }

  const key = recordingKey(rootPath, supplementId);
  if (finalizingSupplements.has(key)) {
    return workspaceError('ERR_RECORDING_FINALIZED', 'Segment supplement is already finalized');
  }
  if (inFlightSupplementAppends.has(key)) {
    return workspaceError(
      'ERR_RECORDING_APPEND_IN_FLIGHT',
      'Segment supplement append already in flight'
    );
  }

  addRecordingRuntimeKey(inFlightSupplementAppends, rootPath, key);
  let draftKnown = false;
  try {
    if (!activeSupplementDrafts.has(key)) {
      const safeSupplementId = createSafeSupplementId(supplementId);
      if (safeSupplementId !== supplementId) {
        throw new Error('Invalid supplement id');
      }
    }

    const supplementDirectory = resolveDraftSupplementDirectory(rootPath, supplementId);
    const supplementDirectoryIdentity = await readDirectoryIdentity(supplementDirectory);
    const metadata = await readSupplementMetadataInKnownDirectory(
      supplementDirectory,
      supplementDirectoryIdentity
    ).catch(() => null);
    if (!metadata) {
      return workspaceError('ERR_RECORDING_NOT_FOUND', 'Segment supplement draft not found');
    }
    draftKnown = true;
    if (metadata.status !== 'draft') {
      return workspaceError('ERR_RECORDING_FINALIZED', 'Segment supplement is already finalized');
    }
    if (metadata.nextSequence !== sequence) {
      return workspaceError('ERR_RECORDING_SEQUENCE', 'Recording audio chunk sequence mismatch');
    }

    const audioAppend = await openAudioFileForAppend(
      supplementDirectory,
      supplementDirectoryIdentity,
      metadata.audioByteLength
    );
    if (!audioAppend) {
      return workspaceError(
        'ERR_WORKSPACE_UNSAFE_PATH',
        'Segment supplement audio path is unsafe',
        'draft-preserved'
      );
    }
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    try {
      writeSync(audioAppend.fd, chunk);
      fsyncSync(audioAppend.fd);
      const nextMetadata = {
        ...metadata,
        nextSequence: metadata.nextSequence + 1,
        audioByteLength: metadata.audioByteLength + chunk.byteLength,
      };
      try {
        assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
        await writeSupplementMetadata(
          supplementDirectory,
          supplementDirectoryIdentity,
          nextMetadata
        );
      } catch (error) {
        ftruncateSync(audioAppend.fd, audioAppend.previousSize);
        fsyncSync(audioAppend.fd);
        throw error;
      }
      return { ok: true, nextSequence: nextMetadata.nextSequence };
    } finally {
      closeSync(audioAppend.fd);
    }
  } catch (error) {
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return draftKnown
      ? workspaceError(
          'ERR_RECORDING_APPEND_FAILED',
          'Segment supplement audio chunk could not be appended',
          'draft-preserved'
        )
      : workspaceError('ERR_RECORDING_NOT_FOUND', 'Segment supplement draft not found');
  } finally {
    deleteRecordingRuntimeKey(inFlightSupplementAppends, rootPath, key);
  }
}

async function copyAudioPrefix({
  assertWorkspaceUsable,
  sourceFd,
  targetFd,
  byteLength,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly sourceFd: number;
  readonly targetFd: number;
  readonly byteLength: number;
}): Promise<void> {
  const buffer = Buffer.allocUnsafe(Math.min(MAX_AUDIO_CHUNK_BYTES, Math.max(1, byteLength)));
  let remaining = byteLength;
  let offset = 0;
  while (remaining > 0) {
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    const size = Math.min(buffer.byteLength, remaining);
    const { bytesRead } = await readDescriptor(sourceFd, buffer, 0, size, offset);
    if (bytesRead <= 0) {
      throw new Error('Recording source audio ended early');
    }
    let bytesWrittenForRead = 0;
    while (bytesWrittenForRead < bytesRead) {
      assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
      const { bytesWritten } = await writeDescriptor(
        targetFd,
        buffer,
        bytesWrittenForRead,
        bytesRead - bytesWrittenForRead
      );
      if (bytesWritten <= 0) {
        throw new Error('Recording target audio write ended early');
      }
      bytesWrittenForRead += bytesWritten;
    }
    afterDraftPrefixBytesCopiedForTest?.();
    offset += bytesRead;
    remaining -= bytesRead;
  }
}

export async function cloneRecordingDraftPrefix({
  rootPath,
  sourceSegmentId,
  targetSegmentId,
  retainedByteLength,
  nextSequence,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly sourceSegmentId: string;
  readonly targetSegmentId: string;
  readonly retainedByteLength: number;
  readonly nextSequence: number;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | { readonly ok: true; readonly audioByteLength: number; readonly nextSequence: number }
  | WorkspaceErrorEnvelope
> {
  const usable = checkWorkspaceUsable(assertWorkspaceUsable);
  if (usable) {
    return usable;
  }
  if (sourceSegmentId === targetSegmentId) {
    return workspaceError('ERR_RECORDING_INVALID_RANGE', 'Recording replacement range is invalid');
  }

  const sourceKey = recordingKey(rootPath, sourceSegmentId);
  const targetKey = recordingKey(rootPath, targetSegmentId);
  if (
    finalizingRecordings.has(sourceKey) ||
    finalizingRecordings.has(targetKey) ||
    inFlightAppends.has(sourceKey) ||
    inFlightAppends.has(targetKey) ||
    inFlightDraftPrefixCopies.has(sourceKey) ||
    inFlightDraftPrefixCopies.has(targetKey) ||
    inFlightDraftAudioReads.has(sourceKey) ||
    inFlightDraftAudioReads.has(targetKey)
  ) {
    return workspaceError('ERR_RECORDING_APPEND_IN_FLIGHT', 'Recording draft copy in flight');
  }

  addRecordingRuntimeKey(inFlightDraftPrefixCopies, rootPath, sourceKey);
  addRecordingRuntimeKey(inFlightDraftPrefixCopies, rootPath, targetKey);
  let sourceKnown = false;
  let targetKnown = false;
  try {
    const safeRetainedByteLength = Math.max(0, Math.trunc(retainedByteLength));
    const sourceDirectory = resolveDraftRecordingDirectory(rootPath, sourceSegmentId);
    const targetDirectory = resolveDraftRecordingDirectory(rootPath, targetSegmentId);
    const sourceDirectoryIdentity = await readDirectoryIdentity(sourceDirectory);
    const targetDirectoryIdentity = await readDirectoryIdentity(targetDirectory);
    const sourceMetadata = await readMetadataInKnownDirectory(
      sourceDirectory,
      sourceDirectoryIdentity
    ).catch(() => null);
    const targetMetadata = await readMetadataInKnownDirectory(
      targetDirectory,
      targetDirectoryIdentity
    ).catch(() => null);
    if (!sourceMetadata) {
      return workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording source draft not found');
    }
    sourceKnown = true;
    if (!targetMetadata) {
      return workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording target draft not found');
    }
    targetKnown = true;
    if (sourceMetadata.status !== 'draft' || targetMetadata.status !== 'draft') {
      return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalized');
    }
    if (sourceMetadata.audioByteLength < safeRetainedByteLength) {
      return workspaceError(
        'ERR_RECORDING_INVALID_RANGE',
        'Recording replacement range is invalid'
      );
    }
    if (targetMetadata.nextSequence !== nextSequence || targetMetadata.audioByteLength !== 0) {
      return workspaceError('ERR_RECORDING_SEQUENCE', 'Recording audio chunk sequence mismatch');
    }

    const sourceAudioFd = openFileForReadInDirectory(
      sourceDirectory,
      sourceDirectoryIdentity,
      'audio.webm'
    );
    try {
      const sourceAudio = fstatSync(sourceAudioFd);
      if (!sourceAudio.isFile() || sourceAudio.size !== sourceMetadata.audioByteLength) {
        return workspaceError(
          'ERR_WORKSPACE_UNSAFE_PATH',
          'Recording source audio path is unsafe',
          'draft-preserved'
        );
      }
      const targetAudioFd = openExistingWorkspaceFileInDirectory({
        directory: targetDirectory,
        directoryIdentity: targetDirectoryIdentity,
        fileName: 'audio.webm',
        flags: constants.O_RDWR | constants.O_NOFOLLOW,
      });
      try {
        const targetAudio = fstatSync(targetAudioFd);
        if (!targetAudio.isFile() || targetAudio.size !== targetMetadata.audioByteLength) {
          return workspaceError(
            'ERR_WORKSPACE_UNSAFE_PATH',
            'Recording target audio path is unsafe',
            'draft-preserved'
          );
        }
        assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
        try {
          ftruncateSync(targetAudioFd, 0);
          await copyAudioPrefix({
            ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
            sourceFd: sourceAudioFd,
            targetFd: targetAudioFd,
            byteLength: safeRetainedByteLength,
          });
          assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
          await fsyncDescriptor(targetAudioFd);
          await assertSameDirectory(sourceDirectory, sourceDirectoryIdentity);
          await assertSameDirectory(targetDirectory, targetDirectoryIdentity);
          const clonedMetadata: DraftSegmentMetadata = {
            ...targetMetadata,
            audioByteLength: safeRetainedByteLength,
            nextSequence: targetMetadata.nextSequence + 1,
          };
          assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
          await writeMetadata(targetDirectory, targetDirectoryIdentity, clonedMetadata);
          return {
            ok: true,
            audioByteLength: safeRetainedByteLength,
            nextSequence: clonedMetadata.nextSequence,
          };
        } catch (error) {
          ftruncateSync(targetAudioFd, targetAudio.size);
          await fsyncDescriptor(targetAudioFd);
          throw error;
        }
      } finally {
        closeSync(targetAudioFd);
      }
    } finally {
      closeSync(sourceAudioFd);
    }
  } catch (error) {
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    if (!sourceKnown || !targetKnown) {
      return workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording draft not found');
    }
    return workspaceError(
      'ERR_RECORDING_APPEND_FAILED',
      'Recording draft prefix could not be copied',
      'draft-preserved'
    );
  } finally {
    deleteRecordingRuntimeKey(inFlightDraftPrefixCopies, rootPath, sourceKey);
    deleteRecordingRuntimeKey(inFlightDraftPrefixCopies, rootPath, targetKey);
  }
}

export async function readRecordingDraftAudio({
  maxBytes = MAX_RECORDING_DRAFT_AUDIO_READ_BYTES,
  rootPath,
  segmentId,
  assertWorkspaceUsable,
}: {
  readonly maxBytes?: number;
  readonly rootPath: string;
  readonly segmentId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly audio: Uint8Array;
      readonly audioByteLength: number;
      readonly nextSequence: number;
    }
  | WorkspaceErrorEnvelope
> {
  const usable = checkWorkspaceUsable(assertWorkspaceUsable);
  if (usable) {
    return usable;
  }

  const key = recordingKey(rootPath, segmentId);
  if (finalizingRecordings.has(key)) {
    return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalizing');
  }
  if (inFlightAppends.has(key)) {
    return workspaceError('ERR_RECORDING_APPEND_IN_FLIGHT', 'Recording append still in flight');
  }
  if (inFlightDraftPrefixCopies.has(key)) {
    return workspaceError(
      'ERR_RECORDING_APPEND_IN_FLIGHT',
      'Recording draft prefix copy in flight'
    );
  }
  if (inFlightDraftAudioReads.has(key)) {
    return workspaceError('ERR_RECORDING_APPEND_IN_FLIGHT', 'Recording draft audio read in flight');
  }
  addRecordingRuntimeKey(inFlightDraftAudioReads, rootPath, key);
  try {
    const recordingDirectory = resolveDraftRecordingDirectory(rootPath, segmentId);
    const recordingDirectoryIdentity = await readDirectoryIdentity(recordingDirectory);
    const metadata = await readMetadataInKnownDirectory(
      recordingDirectory,
      recordingDirectoryIdentity
    ).catch(() => null);
    if (!metadata) {
      return workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording draft not found');
    }
    if (metadata.status !== 'draft') {
      return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalized');
    }
    const maxReadableBytes = Math.max(
      1,
      Math.min(Math.trunc(maxBytes), MAX_RECORDING_DRAFT_AUDIO_READ_BYTES)
    );
    if (metadata.audioByteLength > maxReadableBytes) {
      return workspaceError(
        'ERR_RECORDING_CHUNK_TOO_LARGE',
        'Recording draft audio is too large to read'
      );
    }

    const audioFd = openFileForReadInDirectory(
      recordingDirectory,
      recordingDirectoryIdentity,
      'audio.webm'
    );
    try {
      const audio = fstatSync(audioFd);
      if (!audio.isFile() || audio.size !== metadata.audioByteLength) {
        return workspaceError(
          'ERR_WORKSPACE_UNSAFE_PATH',
          'Recording audio path is unsafe',
          'draft-preserved'
        );
      }
      const content = (await readFileDescriptor(audioFd)) as Buffer;
      if (
        content.byteLength !== metadata.audioByteLength ||
        content.byteLength > maxReadableBytes
      ) {
        return workspaceError(
          'ERR_WORKSPACE_UNSAFE_PATH',
          'Recording audio path is unsafe',
          'draft-preserved'
        );
      }
      await afterDraftAudioReadForTest?.();
      const stillUsable = checkWorkspaceUsable(assertWorkspaceUsable);
      if (stillUsable) {
        return stillUsable;
      }
      await assertSameDirectory(recordingDirectory, recordingDirectoryIdentity);
      return {
        ok: true,
        audio: content,
        audioByteLength: metadata.audioByteLength,
        nextSequence: metadata.nextSequence,
      };
    } finally {
      closeSync(audioFd);
    }
  } catch (error) {
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording draft not found');
  } finally {
    deleteRecordingRuntimeKey(inFlightDraftAudioReads, rootPath, key);
  }
}

async function readOptionalFinalizedTranscriptFile(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  options: {
    readonly markdownFileName: 'segment.md' | 'supplement.md';
    readonly objectType: 'segment' | 'supplement';
  }
): Promise<{ readonly exists: boolean; readonly text: string }> {
  let fd: number;
  try {
    fd = openFileForReadInDirectory(directory, directoryIdentity, options.markdownFileName);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { exists: false, text: '' };
    }
    throw error;
  }

  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) {
      throw new Error(`${options.markdownFileName} path is unsafe`);
    }
    if (stat.size > MAX_FINALIZED_TRANSCRIPT_READ_BYTES) {
      throw new Error(`${options.markdownFileName} is too large`);
    }
    const markdown = (await readFileDescriptor(fd, 'utf8')) as string;
    const parsed = parseWorkspaceMarkdownObject({ objectType: options.objectType, markdown });
    const text = extractSegmentTranscript(parsed.content);
    await assertSameDirectory(directory, directoryIdentity);
    return {
      exists: text.length > 0,
      text,
    };
  } finally {
    closeSync(fd);
  }
}

export async function readFinalizedAudioSegmentContent({
  maxBytes = MAX_RECORDING_DRAFT_AUDIO_READ_BYTES,
  rootPath,
  memoryId,
  segmentId,
  assertWorkspaceUsable,
}: {
  readonly maxBytes?: number;
  readonly rootPath: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly audio: Uint8Array;
      readonly audioByteLength: number;
      readonly lastTranscriptionAttempt: 'failed' | 'never' | 'success';
      readonly transcript: { readonly exists: boolean; readonly text: string };
    }
  | WorkspaceErrorEnvelope
> {
  const usable = checkWorkspaceUsable(assertWorkspaceUsable);
  if (usable) {
    return usable;
  }

  try {
    const target = await resolveFinalizedAudioSegmentReadTarget(rootPath, memoryId, segmentId);
    const maxReadableBytes = Math.max(
      1,
      Math.min(Math.trunc(maxBytes), MAX_BACKFILL_AUDIO_READ_BYTES)
    );

    const recordingDirectoryIdentity = await readDirectoryIdentity(target.directory);
    const stillUsableBeforeAudio = checkWorkspaceUsable(assertWorkspaceUsable);
    if (stillUsableBeforeAudio) {
      return stillUsableBeforeAudio;
    }
    if (target.audioByteLength > maxReadableBytes) {
      return workspaceError(
        'ERR_RECORDING_CHUNK_TOO_LARGE',
        'Finalized audio is too large to read'
      );
    }
    const transcript = await readOptionalFinalizedTranscriptFile(
      target.directory,
      recordingDirectoryIdentity,
      { markdownFileName: 'segment.md', objectType: 'segment' }
    );

    const audioFd = openFileForReadInDirectory(
      target.directory,
      recordingDirectoryIdentity,
      'audio.webm'
    );
    try {
      const audio = fstatSync(audioFd);
      if (!audio.isFile() || audio.size !== target.audioByteLength) {
        return workspaceError(
          'ERR_WORKSPACE_UNSAFE_PATH',
          'Finalized audio path is unsafe',
          'durable-marker-recovery-required'
        );
      }
      const content = (await readFileDescriptor(audioFd)) as Buffer;
      if (content.byteLength !== target.audioByteLength || content.byteLength > maxReadableBytes) {
        return workspaceError(
          'ERR_WORKSPACE_UNSAFE_PATH',
          'Finalized audio path is unsafe',
          'durable-marker-recovery-required'
        );
      }
      const stillUsable = checkWorkspaceUsable(assertWorkspaceUsable);
      if (stillUsable) {
        return stillUsable;
      }
      await assertSameDirectory(target.directory, recordingDirectoryIdentity);
      return {
        ok: true,
        audio: content,
        audioByteLength: target.audioByteLength,
        lastTranscriptionAttempt: target.lastTranscriptionAttempt,
        transcript,
      };
    } finally {
      closeSync(audioFd);
    }
  } catch (error) {
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Finalized audio segment not found');
  }
}

export async function readFinalizedAudioSegmentBackfillSource({
  maxBytes = MAX_BACKFILL_AUDIO_READ_BYTES,
  rootPath,
  memoryId,
  segmentId,
  assertWorkspaceUsable,
  transcriptReadMode = 'read',
}: {
  readonly maxBytes?: number;
  readonly rootPath: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly transcriptReadMode?: 'read' | 'assume-missing';
}): Promise<
  | {
      readonly ok: true;
      readonly audioByteLength: number;
      readonly audioFileDescriptor: number;
      readonly dispose: () => void;
      readonly lastTranscriptionAttempt: 'failed' | 'never' | 'success';
      readonly transcript: { readonly exists: boolean; readonly text: string };
    }
  | WorkspaceErrorEnvelope
> {
  const usable = checkWorkspaceUsable(assertWorkspaceUsable);
  if (usable) {
    return usable;
  }

  try {
    const target = await resolveFinalizedAudioSegmentReadTarget(rootPath, memoryId, segmentId);
    const maxReadableBytes = Math.max(
      1,
      Math.min(Math.trunc(maxBytes), MAX_BACKFILL_AUDIO_READ_BYTES)
    );

    const recordingDirectoryIdentity = await readDirectoryIdentity(target.directory);
    const stillUsableBeforeAudio = checkWorkspaceUsable(assertWorkspaceUsable);
    if (stillUsableBeforeAudio) {
      return stillUsableBeforeAudio;
    }
    if (target.audioByteLength > maxReadableBytes) {
      return workspaceError(
        'ERR_RECORDING_CHUNK_TOO_LARGE',
        'Finalized audio is too large to read'
      );
    }
    const transcript =
      transcriptReadMode === 'assume-missing'
        ? { exists: false, text: '' }
        : await readOptionalFinalizedTranscriptFile(target.directory, recordingDirectoryIdentity, {
            markdownFileName: 'segment.md',
            objectType: 'segment',
          });

    const audioFd = openFileForReadInDirectory(
      target.directory,
      recordingDirectoryIdentity,
      'audio.webm'
    );
    let fdOwned = true;
    try {
      const audio = fstatSync(audioFd);
      if (!audio.isFile() || audio.size !== target.audioByteLength) {
        closeSync(audioFd);
        fdOwned = false;
        return workspaceError(
          'ERR_WORKSPACE_UNSAFE_PATH',
          'Finalized audio path is unsafe',
          'durable-marker-recovery-required'
        );
      }
      const stillUsable = checkWorkspaceUsable(assertWorkspaceUsable);
      if (stillUsable) {
        closeSync(audioFd);
        fdOwned = false;
        return stillUsable;
      }
      await assertSameDirectory(target.directory, recordingDirectoryIdentity);
      fdOwned = false;
      return {
        ok: true,
        audioByteLength: target.audioByteLength,
        audioFileDescriptor: audioFd,
        dispose: () => closeSync(audioFd),
        lastTranscriptionAttempt: target.lastTranscriptionAttempt,
        transcript,
      };
    } finally {
      if (fdOwned) {
        closeSync(audioFd);
      }
    }
  } catch (error) {
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Finalized audio segment not found');
  }
}

export async function readFinalizedAudioSegmentSupplementContent({
  maxBytes = MAX_RECORDING_DRAFT_AUDIO_READ_BYTES,
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  supplementId,
  assertWorkspaceUsable,
}: {
  readonly maxBytes?: number;
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly audio: Uint8Array;
      readonly audioByteLength: number;
      readonly lastTranscriptionAttempt: 'failed' | 'never' | 'success';
      readonly transcript: { readonly exists: boolean; readonly text: string };
    }
  | WorkspaceErrorEnvelope
> {
  const usable = checkWorkspaceUsable(assertWorkspaceUsable);
  if (usable) {
    return usable;
  }

  try {
    const target = await resolveFinalizedAudioSegmentSupplementReadTarget(
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
      supplementId
    );
    const maxReadableBytes = Math.max(
      1,
      Math.min(Math.trunc(maxBytes), MAX_BACKFILL_AUDIO_READ_BYTES)
    );

    const supplementDirectoryIdentity = await readDirectoryIdentity(target.directory);
    const stillUsableBeforeAudio = checkWorkspaceUsable(assertWorkspaceUsable);
    if (stillUsableBeforeAudio) {
      return stillUsableBeforeAudio;
    }
    if (target.audioByteLength > maxReadableBytes) {
      return workspaceError(
        'ERR_RECORDING_CHUNK_TOO_LARGE',
        'Finalized segment supplement audio is too large to read'
      );
    }
    const transcript = await readOptionalFinalizedTranscriptFile(
      target.directory,
      supplementDirectoryIdentity,
      { markdownFileName: 'supplement.md', objectType: 'supplement' }
    );

    const audioFd = openFileForReadInDirectory(
      target.directory,
      supplementDirectoryIdentity,
      'audio.webm'
    );
    try {
      const audio = fstatSync(audioFd);
      if (!audio.isFile() || audio.size !== target.audioByteLength) {
        return workspaceError(
          'ERR_WORKSPACE_UNSAFE_PATH',
          'Finalized segment supplement audio path is unsafe',
          'durable-marker-recovery-required'
        );
      }
      const content = (await readFileDescriptor(audioFd)) as Buffer;
      if (content.byteLength !== target.audioByteLength || content.byteLength > maxReadableBytes) {
        return workspaceError(
          'ERR_WORKSPACE_UNSAFE_PATH',
          'Finalized segment supplement audio path is unsafe',
          'durable-marker-recovery-required'
        );
      }
      const stillUsable = checkWorkspaceUsable(assertWorkspaceUsable);
      if (stillUsable) {
        return stillUsable;
      }
      await assertSameDirectory(target.directory, supplementDirectoryIdentity);
      return {
        ok: true,
        audio: content,
        audioByteLength: target.audioByteLength,
        lastTranscriptionAttempt: target.lastTranscriptionAttempt,
        transcript,
      };
    } finally {
      closeSync(audioFd);
    }
  } catch (error) {
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return workspaceError(
      'ERR_RECORDING_NOT_FOUND',
      'Finalized segment supplement audio not found'
    );
  }
}

export async function readFinalizedAudioSegmentSupplementBackfillSource({
  maxBytes = MAX_BACKFILL_AUDIO_READ_BYTES,
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  supplementId,
  assertWorkspaceUsable,
  transcriptReadMode = 'read',
}: {
  readonly maxBytes?: number;
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly transcriptReadMode?: 'read' | 'assume-missing';
}): Promise<
  | {
      readonly ok: true;
      readonly audioByteLength: number;
      readonly audioFileDescriptor: number;
      readonly dispose: () => void;
      readonly lastTranscriptionAttempt: 'failed' | 'never' | 'success';
      readonly transcript: { readonly exists: boolean; readonly text: string };
    }
  | WorkspaceErrorEnvelope
> {
  const usable = checkWorkspaceUsable(assertWorkspaceUsable);
  if (usable) {
    return usable;
  }

  try {
    const target = await resolveFinalizedAudioSegmentSupplementReadTarget(
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
      supplementId
    );
    const maxReadableBytes = Math.max(
      1,
      Math.min(Math.trunc(maxBytes), MAX_BACKFILL_AUDIO_READ_BYTES)
    );

    const supplementDirectoryIdentity = await readDirectoryIdentity(target.directory);
    const stillUsableBeforeAudio = checkWorkspaceUsable(assertWorkspaceUsable);
    if (stillUsableBeforeAudio) {
      return stillUsableBeforeAudio;
    }
    if (target.audioByteLength > maxReadableBytes) {
      return workspaceError(
        'ERR_RECORDING_CHUNK_TOO_LARGE',
        'Finalized segment supplement audio is too large to read'
      );
    }
    const transcript =
      transcriptReadMode === 'assume-missing'
        ? { exists: false, text: '' }
        : await readOptionalFinalizedTranscriptFile(target.directory, supplementDirectoryIdentity, {
            markdownFileName: 'supplement.md',
            objectType: 'supplement',
          });

    const audioFd = openFileForReadInDirectory(
      target.directory,
      supplementDirectoryIdentity,
      'audio.webm'
    );
    let fdOwned = true;
    try {
      const audio = fstatSync(audioFd);
      if (!audio.isFile() || audio.size !== target.audioByteLength) {
        closeSync(audioFd);
        fdOwned = false;
        return workspaceError(
          'ERR_WORKSPACE_UNSAFE_PATH',
          'Finalized segment supplement audio path is unsafe',
          'durable-marker-recovery-required'
        );
      }
      const stillUsable = checkWorkspaceUsable(assertWorkspaceUsable);
      if (stillUsable) {
        closeSync(audioFd);
        fdOwned = false;
        return stillUsable;
      }
      await assertSameDirectory(target.directory, supplementDirectoryIdentity);
      fdOwned = false;
      return {
        ok: true,
        audioByteLength: target.audioByteLength,
        audioFileDescriptor: audioFd,
        dispose: () => closeSync(audioFd),
        lastTranscriptionAttempt: target.lastTranscriptionAttempt,
        transcript,
      };
    } finally {
      if (fdOwned) {
        closeSync(audioFd);
      }
    }
  } catch (error) {
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return workspaceError(
      'ERR_RECORDING_NOT_FOUND',
      'Finalized segment supplement audio not found'
    );
  }
}

interface FinalizeRecordingDraftInput {
  readonly rootPath: string;
  readonly workspaceId?: string;
  readonly segmentId: string;
  readonly memoryId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly lastTranscriptionAttemptOnFinalize?: FinalizeTranscriptionAttempt;
  readonly now: () => string;
  readonly rebuildIndex?: (rootPath: string) => Promise<readonly MemorySummary[]>;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

type FinalizeRecordingDraftForTestInput = FinalizeRecordingDraftInput & {
  readonly transactionHooks?: FinalizeTransactionHooksForTest;
};

type FinalizeRecordingDraftResult =
  | {
      readonly ok: true;
      readonly segment: WorkspaceSegmentProjection;
      readonly memory: MemorySummary;
    }
  | WorkspaceErrorEnvelope;

async function finalizeRecordingDraftWithHooks(
  {
    rootPath,
    workspaceId,
    segmentId,
    memoryId,
    title,
    durationMs,
    lastTranscriptionAttemptOnFinalize,
    now,
    rebuildIndex,
    assertWorkspaceUsable,
  }: FinalizeRecordingDraftInput,
  transactionHooks?: FinalizeTransactionHooksForTest
): Promise<FinalizeRecordingDraftResult> {
  const key = recordingKey(rootPath, segmentId);
  const usable = assertWorkspaceUsable?.();
  if (usable && !usable.ok) {
    return usable;
  }
  if (finalizingRecordings.has(key)) {
    return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalized');
  }
  if (inFlightAppends.has(key)) {
    return workspaceError('ERR_RECORDING_APPEND_IN_FLIGHT', 'Recording append still in flight');
  }
  if (inFlightDraftPrefixCopies.has(key)) {
    return workspaceError(
      'ERR_RECORDING_APPEND_IN_FLIGHT',
      'Recording draft prefix copy in flight'
    );
  }
  if (inFlightDraftAudioReads.has(key)) {
    return workspaceError('ERR_RECORDING_APPEND_IN_FLIGHT', 'Recording draft audio read in flight');
  }

  addRecordingRuntimeKey(finalizingRecordings, rootPath, key);
  try {
    const metadata = await readMetadata(rootPath, segmentId);
    if (!metadata) {
      return workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording draft not found');
    }
    if (metadata.status !== 'draft') {
      return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalized');
    }

    const finalized = transactionHooks
      ? await appendAudioSegmentToMemoryForTest({
          rootPath,
          workspaceId: workspaceId ?? metadata.workspaceId,
          memoryId,
          segmentId,
          title,
          durationMs,
          ...(lastTranscriptionAttemptOnFinalize ? { lastTranscriptionAttemptOnFinalize } : {}),
          now,
          ...(rebuildIndex ? { rebuildIndex } : {}),
          ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
          transactionHooks,
        })
      : await appendAudioSegmentToMemory({
          rootPath,
          workspaceId: workspaceId ?? metadata.workspaceId,
          memoryId,
          segmentId,
          title,
          durationMs,
          ...(lastTranscriptionAttemptOnFinalize ? { lastTranscriptionAttemptOnFinalize } : {}),
          now,
          ...(rebuildIndex ? { rebuildIndex } : {}),
          ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
        });

    if (!finalized.ok) {
      return finalized;
    }

    const segment = await readFinalizedSegmentProjection({
      rootPath,
      workspaceId: workspaceId ?? metadata.workspaceId,
      memoryId,
      segmentId,
    });
    return {
      ok: true,
      segment,
      memory: finalized.value,
    };
  } catch {
    return workspaceError(
      'ERR_RECORDING_FINALIZE_FAILED',
      'Recording draft could not be finalized',
      'draft-preserved'
    );
  } finally {
    deleteRecordingRuntimeKey(activeDrafts, rootPath, key);
    deleteRecordingRuntimeKey(finalizingRecordings, rootPath, key);
  }
}

export async function finalizeRecordingDraft(
  input: FinalizeRecordingDraftInput
): Promise<FinalizeRecordingDraftResult> {
  return finalizeRecordingDraftWithHooks(input);
}

export async function finalizeRecordingDraftForTest({
  transactionHooks,
  ...input
}: FinalizeRecordingDraftForTestInput): Promise<FinalizeRecordingDraftResult> {
  return finalizeRecordingDraftWithHooks(input, transactionHooks);
}

type FinalizeSegmentSupplementRecordingDraftInput = {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly lastTranscriptionAttemptOnFinalize?: FinalizeTranscriptionAttempt;
  readonly now: () => string;
  readonly rebuildIndex?: (rootPath: string) => Promise<readonly MemorySummary[]>;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
};

type FinalizeSegmentSupplementRecordingDraftResult =
  | {
      readonly ok: true;
      readonly memory: MemorySummary;
      readonly segment: WorkspaceSegmentProjection;
      readonly supplement: WorkspaceSegmentSupplementProjection;
    }
  | WorkspaceErrorEnvelope;

export async function finalizeSegmentSupplementRecordingDraft({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  supplementId,
  title,
  durationMs,
  lastTranscriptionAttemptOnFinalize,
  now,
  rebuildIndex,
  assertWorkspaceUsable,
}: FinalizeSegmentSupplementRecordingDraftInput): Promise<FinalizeSegmentSupplementRecordingDraftResult> {
  const key = recordingKey(rootPath, supplementId);
  const usable = assertWorkspaceUsable?.();
  if (usable && !usable.ok) {
    return usable;
  }
  if (finalizingSupplements.has(key)) {
    return workspaceError('ERR_RECORDING_FINALIZED', 'Segment supplement is already finalized');
  }
  if (inFlightSupplementAppends.has(key)) {
    return workspaceError(
      'ERR_RECORDING_APPEND_IN_FLIGHT',
      'Segment supplement append still in flight'
    );
  }

  addRecordingRuntimeKey(finalizingSupplements, rootPath, key);
  try {
    const metadata = await readSupplementMetadata(rootPath, supplementId);
    if (!metadata) {
      return workspaceError('ERR_RECORDING_NOT_FOUND', 'Segment supplement draft not found');
    }
    if (metadata.status !== 'draft') {
      return workspaceError('ERR_RECORDING_FINALIZED', 'Segment supplement is already finalized');
    }
    const draft = draftSegmentSupplementMetadataSchema.parse(metadata);
    if (
      draft.workspaceId !== workspaceId ||
      draft.memoryId !== memoryId ||
      draft.segmentId !== segmentId ||
      draft.supplementId !== supplementId
    ) {
      return workspaceError(
        'ERR_RECORDING_INVALID_ID',
        'Segment supplement draft parent does not match'
      );
    }

    const finalized = await appendAudioSupplementToSegment({
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
      supplementId,
      title,
      durationMs,
      ...(lastTranscriptionAttemptOnFinalize ? { lastTranscriptionAttemptOnFinalize } : {}),
      now,
      ...(rebuildIndex ? { rebuildIndex } : {}),
      ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
    });
    if (!finalized.ok) {
      return finalized;
    }

    const draftDirectory = resolveDraftSupplementDirectory(rootPath, supplementId);
    const removed = await removeSafeWorkspaceDirectory(rootPath, draftDirectory, {
      allowMissing: true,
    });
    if (!removed) {
      return workspaceError(
        'ERR_WORKSPACE_UNSAFE_PATH',
        'Segment supplement draft cleanup path is unsafe',
        'durable-marker-recovery-required'
      );
    }

    return {
      ok: true,
      memory: finalized.value.memory,
      segment: finalized.value.segment,
      supplement: finalized.value.supplement,
    };
  } catch (error) {
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return workspaceError(
      'ERR_RECORDING_FINALIZE_FAILED',
      'Segment supplement recording could not be finalized',
      'draft-preserved'
    );
  } finally {
    deleteRecordingRuntimeKey(activeSupplementDrafts, rootPath, key);
    deleteRecordingRuntimeKey(finalizingSupplements, rootPath, key);
  }
}

export async function discardRecordingDraft({
  rootPath,
  segmentId,
  beforeDraftDiscardRemove,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly segmentId: string;
  readonly beforeDraftDiscardRemove?: () => Promise<void> | void;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<{ readonly ok: true; readonly discarded: true } | WorkspaceErrorEnvelope> {
  const usable = assertWorkspaceUsable?.();
  if (usable && !usable.ok) {
    return usable;
  }
  let draftDirectory: string;
  try {
    draftDirectory = resolveDraftRecordingDirectory(rootPath, segmentId);
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Recording draft path is unsafe',
      'draft-preserved'
    );
  }

  try {
    const removed = await removeSafeWorkspaceDirectory(rootPath, draftDirectory, {
      allowMissing: true,
      beforeSafeCleanupRemove: async () => {
        await beforeDraftDiscardRemove?.();
        assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
      },
    });
    if (!removed) {
      return workspaceError(
        'ERR_WORKSPACE_UNSAFE_PATH',
        'Recording draft path is unsafe',
        'draft-preserved'
      );
    }
    return { ok: true, discarded: true };
  } catch (error) {
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording draft not found');
  } finally {
    deleteRecordingRuntimeKey(activeDrafts, rootPath, recordingKey(rootPath, segmentId));
  }
}

export async function discardSegmentSupplementRecordingDraft({
  rootPath,
  supplementId,
  beforeDraftDiscardRemove,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly supplementId: string;
  readonly beforeDraftDiscardRemove?: () => Promise<void> | void;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<{ readonly ok: true; readonly discarded: true } | WorkspaceErrorEnvelope> {
  const usable = assertWorkspaceUsable?.();
  if (usable && !usable.ok) {
    return usable;
  }
  let draftDirectory: string;
  try {
    draftDirectory = resolveDraftSupplementDirectory(rootPath, supplementId);
  } catch {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Segment supplement draft path is unsafe',
      'draft-preserved'
    );
  }

  try {
    const removed = await removeSafeWorkspaceDirectory(rootPath, draftDirectory, {
      allowMissing: true,
      beforeSafeCleanupRemove: async () => {
        await beforeDraftDiscardRemove?.();
        assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
      },
    });
    if (!removed) {
      return workspaceError(
        'ERR_WORKSPACE_UNSAFE_PATH',
        'Segment supplement draft path is unsafe',
        'draft-preserved'
      );
    }
    return { ok: true, discarded: true };
  } catch (error) {
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Segment supplement draft not found');
  } finally {
    deleteRecordingRuntimeKey(
      activeSupplementDrafts,
      rootPath,
      recordingKey(rootPath, supplementId)
    );
  }
}

async function writeSupplementTranscriptInRecordingDirectory({
  recordingDirectory,
  markdown,
  allowOverwrite = false,
  assertWorkspaceUsable,
  expectedTranscriptDigest,
  isAbortRequested,
  requireTranscriptMissing = false,
}: {
  readonly recordingDirectory: string;
  readonly markdown: string;
  readonly allowOverwrite?: boolean;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly expectedTranscriptDigest?: string;
  readonly isAbortRequested?: () => boolean;
  readonly requireTranscriptMissing?: boolean;
}): Promise<TranscriptOverwriteRollback> {
  const directoryIdentity = await readDirectoryIdentity(recordingDirectory);
  throwIfBackfillSaveAborted(isAbortRequested);
  await beforeMarkdownWriteForTest?.();
  throwIfBackfillSaveAborted(isAbortRequested);
  assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
  await assertSameDirectory(recordingDirectory, directoryIdentity);
  const currentMarkdown = await readTextFileInKnownDirectory(
    recordingDirectory,
    directoryIdentity,
    'supplement.md',
    MAX_FINALIZED_TRANSCRIPT_READ_BYTES
  );
  const current = parseWorkspaceMarkdownObject({
    objectType: 'supplement',
    markdown: currentMarkdown,
  });
  if ('kind' in current.data && current.data.kind && current.data.kind !== 'audio') {
    throw new Error('Finalized supplement markdown kind is unsupported');
  }
  if (requireTranscriptMissing && extractSegmentTranscript(current.content).length > 0) {
    throw workspaceError(
      'ERR_BACKFILL_TARGET_NOT_ELIGIBLE',
      'Backfill target already has a transcript'
    );
  }
  if (expectedTranscriptDigest !== undefined) {
    if (!allowOverwrite) {
      throw workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'Transcript overwrite is not allowed');
    }
    const currentTranscriptDigest = transcriptDigest(extractSegmentTranscript(current.content));
    if (currentTranscriptDigest !== expectedTranscriptDigest) {
      throw workspaceError('ERR_BACKFILL_TRANSCRIPT_CHANGED', 'Transcript changed during backfill');
    }
  }
  const currentData = current.data as { readonly kind?: 'audio' };
  assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
  throwIfBackfillSaveAborted(isAbortRequested);
  await writeWorkspaceFileAtomicInKnownDirectory({
    directory: recordingDirectory,
    directoryIdentity,
    fileName: 'supplement.md',
    data: renderWorkspaceMarkdownObject({
      objectType: 'supplement',
      data: {
        ...current.data,
        kind: currentData.kind ?? 'audio',
      },
      content: replaceSegmentTranscript(current.content, markdown),
    }),
    ...(assertWorkspaceUsable || isAbortRequested
      ? {
          assertUsable: () =>
            assertBackfillSaveCanContinue(assertWorkspaceUsable, isAbortRequested),
        }
      : {}),
  });
  return {
    directory: recordingDirectory,
    directoryIdentity,
    fileName: 'supplement.md',
    previousMarkdown: currentMarkdown,
  };
}

async function writeSegmentTranscriptInRecordingDirectory({
  recordingDirectory,
  markdown,
  allowOverwrite = false,
  assertWorkspaceUsable,
  expectedTranscriptDigest,
  isAbortRequested,
  requireTranscriptMissing = false,
}: {
  readonly recordingDirectory: string;
  readonly markdown: string;
  readonly allowOverwrite?: boolean;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly expectedTranscriptDigest?: string;
  readonly isAbortRequested?: () => boolean;
  readonly requireTranscriptMissing?: boolean;
}): Promise<TranscriptOverwriteRollback> {
  const directoryIdentity = await readDirectoryIdentity(recordingDirectory);
  throwIfBackfillSaveAborted(isAbortRequested);
  await beforeMarkdownWriteForTest?.();
  throwIfBackfillSaveAborted(isAbortRequested);
  assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
  const currentMarkdown = await readTextFileInKnownDirectory(
    recordingDirectory,
    directoryIdentity,
    'segment.md',
    MAX_FINALIZED_TRANSCRIPT_READ_BYTES
  );
  const current = parseWorkspaceMarkdownObject({
    objectType: 'segment',
    markdown: currentMarkdown,
  });
  if (requireTranscriptMissing && extractSegmentTranscript(current.content).length > 0) {
    throw workspaceError(
      'ERR_BACKFILL_TARGET_NOT_ELIGIBLE',
      'Backfill target already has a transcript'
    );
  }
  if (expectedTranscriptDigest !== undefined) {
    if (!allowOverwrite) {
      throw workspaceError('ERR_WORKSPACE_INVALID_REQUEST', 'Transcript overwrite is not allowed');
    }
    const currentTranscriptDigest = transcriptDigest(extractSegmentTranscript(current.content));
    if (currentTranscriptDigest !== expectedTranscriptDigest) {
      throw workspaceError('ERR_BACKFILL_TRANSCRIPT_CHANGED', 'Transcript changed during backfill');
    }
  }
  assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
  throwIfBackfillSaveAborted(isAbortRequested);
  const nextContent = replaceSegmentTranscript(current.content, markdown);
  await assertSameDirectory(recordingDirectory, directoryIdentity);
  await writeWorkspaceFileAtomicInKnownDirectory({
    directory: recordingDirectory,
    directoryIdentity,
    fileName: 'segment.md',
    data: renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: current.data,
      content: nextContent,
    }),
    ...(assertWorkspaceUsable || isAbortRequested
      ? {
          assertUsable: () =>
            assertBackfillSaveCanContinue(assertWorkspaceUsable, isAbortRequested),
        }
      : {}),
  });
  return {
    directory: recordingDirectory,
    directoryIdentity,
    fileName: 'segment.md',
    previousMarkdown: currentMarkdown,
  };
}

async function rollbackTranscriptOverwrite(
  rollback: TranscriptOverwriteRollback,
  assertWorkspaceUsable?: AssertWorkspaceUsable
): Promise<boolean> {
  try {
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    await assertSameDirectory(rollback.directory, rollback.directoryIdentity);
    await writeWorkspaceFileAtomicInKnownDirectory({
      directory: rollback.directory,
      directoryIdentity: rollback.directoryIdentity,
      fileName: rollback.fileName,
      data: rollback.previousMarkdown,
      ...(assertWorkspaceUsable
        ? { assertUsable: () => assertWorkspaceUsableForFileWrite(assertWorkspaceUsable) }
        : {}),
    });
    return true;
  } catch {
    return false;
  }
}

async function throwAfterTranscriptOverwriteFailure(
  error: unknown,
  rollback: TranscriptOverwriteRollback,
  assertWorkspaceUsable: AssertWorkspaceUsable | undefined,
  fallbackMessage: string,
  refreshIndexAfterRollback?: () => Promise<void>
): Promise<never> {
  const rolledBack = await rollbackTranscriptOverwrite(rollback, assertWorkspaceUsable);
  let rollbackIndexRefreshed = false;
  if (rolledBack && refreshIndexAfterRollback) {
    try {
      await refreshIndexAfterRollback();
      rollbackIndexRefreshed = true;
    } catch {
      rollbackIndexRefreshed = false;
    }
  }
  const workspaceErrorEnvelope = caughtWorkspaceError(error);
  if (workspaceErrorEnvelope) {
    throw rolledBack
      ? workspaceError(
          workspaceErrorEnvelope.error.code,
          workspaceErrorEnvelope.error.message,
          refreshIndexAfterRollback && !rollbackIndexRefreshed
            ? 'file-written-index-stale'
            : 'previous-file-preserved'
        )
      : workspaceError(
          workspaceErrorEnvelope.error.code,
          workspaceErrorEnvelope.error.message,
          workspaceErrorEnvelope.error.dataRetention ?? 'file-written-index-stale'
        );
  }
  if (rolledBack) {
    throw workspaceError(
      'ERR_WORKSPACE_UPDATE_FAILED',
      fallbackMessage,
      refreshIndexAfterRollback && !rollbackIndexRefreshed
        ? 'file-written-index-stale'
        : 'previous-file-preserved'
    );
  }
  throw workspaceError('ERR_WORKSPACE_UPDATE_FAILED', fallbackMessage, 'file-written-index-stale');
}

export async function saveRecordingMarkdown(
  input: FinalizedAudioSegmentMarkdownSaveInput
): Promise<
  | { readonly ok: true; readonly memory: MemorySummary; readonly saved: true }
  | WorkspaceErrorEnvelope
> {
  return withMarkdownSaveQueue(
    recordingKey(input.rootPath, `${input.memoryId}:${input.segmentId}:${input.fileName}`),
    () => saveRecordingMarkdownNow(input)
  );
}

async function saveRecordingMarkdownNow({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  markdown,
  allowOverwrite,
  assertWorkspaceUsable,
  expectedTranscriptDigest,
  isAbortRequested,
  requireTranscriptMissing,
}: FinalizedAudioSegmentMarkdownSaveInput): Promise<
  | { readonly ok: true; readonly memory: MemorySummary; readonly saved: true }
  | WorkspaceErrorEnvelope
> {
  const usable = checkWorkspaceUsable(assertWorkspaceUsable);
  if (usable) {
    return usable;
  }
  let rollback: TranscriptOverwriteRollback;
  try {
    const { directory: recordingDirectory } = await resolveFinalizedAudioSegmentReadTarget(
      rootPath,
      memoryId,
      segmentId
    );
    rollback = await writeSegmentTranscriptInRecordingDirectory({
      recordingDirectory,
      ...(allowOverwrite ? { allowOverwrite } : {}),
      markdown,
      ...(expectedTranscriptDigest !== undefined ? { expectedTranscriptDigest } : {}),
      ...(isAbortRequested ? { isAbortRequested } : {}),
      ...(requireTranscriptMissing ? { requireTranscriptMissing } : {}),
      ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
    });
  } catch (error) {
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return workspaceError(
      'ERR_RECORDING_NOT_FOUND',
      'Recording markdown could not be saved',
      'previous-file-preserved'
    );
  }
  let indexRefreshed = false;
  try {
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    const memory = await refreshMemoryIndexEntry(rootPath, memoryId, assertWorkspaceUsable);
    indexRefreshed = true;
    await markSegmentTranscriptionAttemptSuccess({
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
      ...(assertWorkspaceUsable ? { assertUsable: assertWorkspaceUsable } : {}),
    });
    return { ok: true, memory, saved: true };
  } catch (error) {
    try {
      await throwAfterTranscriptOverwriteFailure(
        error,
        rollback,
        assertWorkspaceUsable,
        'Recording markdown was saved but the workspace index or transcription attempt manifest could not be updated',
        indexRefreshed
          ? () => refreshMemoryIndexEntry(rootPath, memoryId, assertWorkspaceUsable).then(() => {})
          : undefined
      );
    } catch (rollbackError) {
      const workspaceErrorEnvelope = caughtWorkspaceError(rollbackError);
      if (workspaceErrorEnvelope) {
        return workspaceErrorEnvelope;
      }
      return workspaceError(
        'ERR_WORKSPACE_INDEX_WRITE_FAILED',
        'Recording markdown was saved but the workspace index or transcription attempt manifest could not be updated',
        'file-written-index-stale'
      );
    }
    throw new Error('Unreachable transcript save rollback branch', { cause: error });
  }
}

export async function saveSegmentSupplementMarkdown(
  input: FinalizedAudioSegmentSupplementMarkdownSaveInput
): Promise<
  | {
      readonly ok: true;
      readonly memory: MemorySummary;
      readonly segment: WorkspaceSegmentProjection;
      readonly supplement: WorkspaceSegmentSupplementProjection;
      readonly saved: true;
    }
  | WorkspaceErrorEnvelope
> {
  return withMarkdownSaveQueue(
    recordingKey(input.rootPath, `${input.memoryId}:${input.segmentId}:${input.supplementId}`),
    () => saveSegmentSupplementMarkdownNow(input)
  );
}

async function saveSegmentSupplementMarkdownNow({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  supplementId,
  markdown,
  allowOverwrite,
  assertWorkspaceUsable,
  expectedTranscriptDigest,
  isAbortRequested,
  requireTranscriptMissing,
}: FinalizedAudioSegmentSupplementMarkdownSaveInput): Promise<
  | {
      readonly ok: true;
      readonly memory: MemorySummary;
      readonly segment: WorkspaceSegmentProjection;
      readonly supplement: WorkspaceSegmentSupplementProjection;
      readonly saved: true;
    }
  | WorkspaceErrorEnvelope
> {
  const usable = checkWorkspaceUsable(assertWorkspaceUsable);
  if (usable) {
    return usable;
  }
  let rollback: TranscriptOverwriteRollback;
  try {
    const { directory: supplementDirectory } =
      await resolveFinalizedAudioSegmentSupplementReadTarget(
        rootPath,
        workspaceId,
        memoryId,
        segmentId,
        supplementId
      );
    rollback = await writeSupplementTranscriptInRecordingDirectory({
      recordingDirectory: supplementDirectory,
      ...(allowOverwrite ? { allowOverwrite } : {}),
      markdown,
      ...(expectedTranscriptDigest !== undefined ? { expectedTranscriptDigest } : {}),
      ...(isAbortRequested ? { isAbortRequested } : {}),
      ...(requireTranscriptMissing ? { requireTranscriptMissing } : {}),
      ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
    });
  } catch (error) {
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return workspaceError(
      'ERR_RECORDING_NOT_FOUND',
      'Segment supplement markdown could not be saved',
      'previous-file-preserved'
    );
  }
  let indexRefreshed = false;
  try {
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    const refreshed = await refreshMemoryIndexEntryWithDetail({
      rootPath,
      workspaceId,
      memoryId,
      ...(assertWorkspaceUsable ? { assertUsable: assertWorkspaceUsable } : {}),
    });
    indexRefreshed = true;
    const segment = refreshed.detail.segments.find(
      (candidate) => candidate.segmentId === segmentId
    );
    if (!segment) {
      throw workspaceError(
        'ERR_RECORDING_NOT_FOUND',
        'Saved segment supplement markdown projection was not found',
        'file-written-index-stale'
      );
    }
    const supplement = segment.supplements.find(
      (candidate) => candidate.supplementId === supplementId
    );
    if (!supplement) {
      throw workspaceError(
        'ERR_RECORDING_NOT_FOUND',
        'Saved segment supplement markdown projection was not found',
        'file-written-index-stale'
      );
    }
    await markSupplementTranscriptionAttemptSuccess({
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
      supplementId,
      ...(assertWorkspaceUsable ? { assertUsable: assertWorkspaceUsable } : {}),
    });
    const updatedSupplement = {
      ...supplement,
      lastTranscriptionAttempt: 'success' as const,
    };
    return {
      ok: true,
      memory: refreshed.memory,
      segment: {
        ...segment,
        supplements: segment.supplements.map((candidate) =>
          candidate.supplementId === supplementId ? updatedSupplement : candidate
        ),
      },
      supplement: updatedSupplement,
      saved: true,
    };
  } catch (error) {
    try {
      await throwAfterTranscriptOverwriteFailure(
        error,
        rollback,
        assertWorkspaceUsable,
        'Segment supplement markdown was saved but the workspace index or transcription attempt manifest could not be updated',
        indexRefreshed
          ? () =>
              refreshMemoryIndexEntryWithDetail({
                rootPath,
                workspaceId,
                memoryId,
                ...(assertWorkspaceUsable ? { assertUsable: assertWorkspaceUsable } : {}),
              }).then(() => {})
          : undefined
      );
    } catch (rollbackError) {
      const workspaceErrorEnvelope = caughtWorkspaceError(rollbackError);
      if (workspaceErrorEnvelope) {
        return workspaceErrorEnvelope;
      }
      return workspaceError(
        'ERR_WORKSPACE_INDEX_WRITE_FAILED',
        'Segment supplement markdown was saved but the workspace index or transcription attempt manifest could not be updated',
        'file-written-index-stale'
      );
    }
    throw new Error('Unreachable supplement transcript save rollback branch', { cause: error });
  }
}

import {
  closeSync,
  constants,
  fstatSync,
  ftruncateSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  readFile as readFileCallback,
  rmdirSync,
  writeSync,
} from 'node:fs';
import { rmdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
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
  appendRecordingToMemory,
  appendRecordingToMemoryForTest,
  assertNoDuplicateRecordingDirectoryById,
  createMemoryForRecording,
  createMemoryForRecordingForTest,
  findFinalizedRecordingById,
  lookupRecordingDirectoryById,
  memoryRecordingDirectory,
  readFinalizedRecordingSummary,
  refreshMemoryIndexEntry,
  removeSafeWorkspaceDirectory,
  type FinalizeTransactionHooksForTest,
  type MemorySummary,
} from './memoryFiles.js';
import { recordingMetadataSchema, type RecordingMetadata } from './recordingMetadata.js';
import { createSafeRecordingId, ensureWorkspaceDraftsDirectory } from './workspacePaths.js';
import { workspaceError, type WorkspaceErrorEnvelope } from './workspaceContract.js';

const MAX_AUDIO_CHUNK_BYTES = 1_048_576;
type MaybePromise<T> = T | Promise<T>;
const readFileDescriptor = promisify(readFileCallback);
type AssertWorkspaceUsable = () => { readonly ok: true } | WorkspaceErrorEnvelope;

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

function caughtWorkspaceError(error: unknown): WorkspaceErrorEnvelope | null {
  return typeof error === 'object' && error !== null && (error as { ok?: unknown }).ok === false
    ? (error as WorkspaceErrorEnvelope)
    : null;
}

const inFlightAppends = new Set<string>();
const finalizingRecordings = new Set<string>();
const activeDrafts = new Set<string>();
const markdownSaveQueues = new Map<string, Promise<void>>();
const finalizedAudioTargets = new Map<
  string,
  {
    readonly memoryId: string;
    readonly audioByteLength: number;
  }
>();
const MAX_FINALIZED_AUDIO_TARGETS = 128;
interface AudioReadContext {
  readonly offset: number;
  readonly length: number;
  readonly byteLength: number;
}

let beforeAudioReadForTest: ((context: AudioReadContext) => MaybePromise<void>) | null = null;
let beforeAudioOpenForTest: (() => MaybePromise<void>) | null = null;
let beforeDraftDirectoryCreateForTest: (() => MaybePromise<void>) | null = null;
let afterDraftDirectoryCreateForTest: (() => MaybePromise<void>) | null = null;
let beforeDraftAudioCreateForTest: (() => MaybePromise<void>) | null = null;
let beforeDraftAudioOpenForTest: (() => MaybePromise<void>) | null = null;
let beforeMarkdownWriteForTest: (() => MaybePromise<void>) | null = null;

function recordingKey(rootPath: string, recordingId: string): string {
  return `${path.resolve(rootPath)}:${recordingId}`;
}

function clearRecordingRuntimeStateByPrefix(prefix: string): void {
  for (const store of [inFlightAppends, finalizingRecordings, activeDrafts]) {
    for (const key of store) {
      if (key.startsWith(prefix)) {
        store.delete(key);
      }
    }
  }
}

export function clearRecordingRuntimeState(): void {
  inFlightAppends.clear();
  finalizingRecordings.clear();
  activeDrafts.clear();
  markdownSaveQueues.clear();
  clearFinalizedAudioTargetCache();
}

export function clearRecordingRuntimeStateForRoot(rootPath: string): void {
  clearRecordingRuntimeStateByPrefix(`${path.resolve(rootPath)}:`);
  for (const key of markdownSaveQueues.keys()) {
    if (key.startsWith(`${path.resolve(rootPath)}:`)) {
      markdownSaveQueues.delete(key);
    }
  }
  clearFinalizedAudioTargetCacheForRoot(rootPath);
}

async function withMarkdownSaveQueue<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = markdownSaveQueues.get(key) ?? Promise.resolve();
  let releaseCurrent: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const tail = previous.then(() => current);
  markdownSaveQueues.set(key, tail);
  await previous;
  try {
    return await run();
  } finally {
    releaseCurrent();
    if (markdownSaveQueues.get(key) === tail) {
      markdownSaveQueues.delete(key);
    }
  }
}

function createRecordingDirectoryWithinParent({
  parentDirectory,
  directoryName,
}: {
  readonly parentDirectory: string;
  readonly directoryName: string;
}): string {
  const parentIdentity = readDirectoryIdentitySync(parentDirectory);
  const previousCwd = process.cwd();
  let directoryCreated = false;
  try {
    process.chdir(parentDirectory);
    assertSameCurrentDirectory(parentIdentity);
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
  } finally {
    process.chdir(previousCwd);
  }
}

function resolveDraftRecordingDirectory(canonicalRoot: string, recordingId: string): string {
  const safeId = createSafeRecordingId(recordingId);
  const recordingsRoot = path.join(canonicalRoot, '.reo', 'drafts', 'recordings');
  const recordingDirectory = path.join(recordingsRoot, safeId);
  const relative = path.relative(recordingsRoot, recordingDirectory);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Recording path escapes workspace');
  }

  for (const candidate of [
    path.join(canonicalRoot, '.reo'),
    path.join(canonicalRoot, '.reo', 'drafts'),
    recordingsRoot,
    recordingDirectory,
  ]) {
    try {
      if (lstatSync(candidate).isSymbolicLink()) {
        throw new Error('Recording path crosses a symlink');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return recordingDirectory;
}

async function resolveReadableRecordingDirectory(
  rootPath: string,
  recordingId: string
): Promise<string> {
  const lookup = await lookupRecordingDirectoryById(rootPath, recordingId);
  if (lookup.status === 'found') {
    return lookup.directory;
  }
  if (lookup.status !== 'not-found') {
    throw new Error('Recording durable truth is invalid');
  }

  const draftDirectory = resolveDraftRecordingDirectory(rootPath, recordingId);
  try {
    const entry = await stat(draftDirectory);
    if (entry.isDirectory()) {
      return draftDirectory;
    }
  } catch {
    // The caller returns the typed not-found/audio error.
  }

  throw new Error('Recording not found');
}

async function resolveFinalizedRecordingReadTarget(
  rootPath: string,
  recordingId: string,
  verifyDuplicateOwner: boolean
): Promise<{
  readonly directory: string;
  readonly audioByteLength: number;
}> {
  const cacheKey = recordingKey(rootPath, recordingId);
  const cached = finalizedAudioTargets.get(cacheKey);
  if (cached) {
    const directory = await memoryRecordingDirectory(rootPath, cached.memoryId, recordingId);
    if (verifyDuplicateOwner) {
      await assertNoDuplicateRecordingDirectoryById(rootPath, cached.memoryId, recordingId);
    }
    const metadata = await readMetadataFromDirectory(directory);
    if (
      metadata.status !== 'finalized' ||
      metadata.memoryId !== cached.memoryId ||
      metadata.recordingId !== recordingId ||
      metadata.durationMs === undefined ||
      metadata.audioByteLength !== cached.audioByteLength
    ) {
      finalizedAudioTargets.delete(cacheKey);
      throw new Error('Cached recording target is stale');
    }
    return { directory, audioByteLength: cached.audioByteLength };
  }
  const finalized = await findFinalizedRecordingById(rootPath, recordingId);
  const memoryId = path.basename(path.dirname(path.dirname(finalized.directory)));
  finalizedAudioTargets.set(cacheKey, {
    memoryId,
    audioByteLength: finalized.recording.audioByteLength,
  });
  if (finalizedAudioTargets.size > MAX_FINALIZED_AUDIO_TARGETS) {
    const oldestKey = finalizedAudioTargets.keys().next().value;
    if (oldestKey) {
      finalizedAudioTargets.delete(oldestKey);
    }
  }
  return {
    directory: finalized.directory,
    audioByteLength: finalized.recording.audioByteLength,
  };
}

async function readMetadata(
  rootPath: string,
  recordingId: string
): Promise<RecordingMetadata | null> {
  try {
    const recordingDirectory = resolveDraftRecordingDirectory(rootPath, recordingId);
    return await readMetadataFromDirectory(recordingDirectory);
  } catch {
    return null;
  }
}

async function readMetadataFromDirectory(recordingDirectory: string): Promise<RecordingMetadata> {
  const directoryIdentity = await readDirectoryIdentity(recordingDirectory);
  const fileFd = openFileForReadInDirectory(
    recordingDirectory,
    directoryIdentity,
    'recording.json'
  );
  try {
    const metadata = fstatSync(fileFd);
    if (!metadata.isFile()) {
      throw new Error('Recording metadata path is unsafe');
    }
    const content = (await readFileDescriptor(fileFd, 'utf8')) as string;
    await assertSameDirectory(recordingDirectory, directoryIdentity);
    return recordingMetadataSchema.parse(JSON.parse(content));
  } finally {
    closeSync(fileFd);
  }
}

function openFileForReadInDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string
): number {
  return openExistingFileInDirectory({
    directory,
    directoryIdentity,
    fileName,
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
}

function openExistingFileInDirectory({
  directory,
  directoryIdentity,
  fileName,
  flags,
}: {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly fileName: string;
  readonly flags: number;
}): number {
  const previousCwd = process.cwd();
  try {
    process.chdir(directory);
    assertSameCurrentDirectory(directoryIdentity);
    const fd = openSync(fileName, flags);
    assertSameCurrentDirectory(directoryIdentity);
    return fd;
  } finally {
    process.chdir(previousCwd);
  }
}

function openNoReplaceFileInDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string
): number {
  const previousCwd = process.cwd();
  try {
    process.chdir(directory);
    assertSameCurrentDirectory(directoryIdentity);
    const fd = openSync(
      fileName,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW
    );
    assertSameCurrentDirectory(directoryIdentity);
    return fd;
  } finally {
    process.chdir(previousCwd);
  }
}

async function writeMetadata(
  recordingDirectory: string,
  directoryIdentity: DirectoryIdentity,
  metadata: RecordingMetadata
): Promise<void> {
  await writeWorkspaceJsonAtomicInKnownDirectory({
    directory: recordingDirectory,
    directoryIdentity,
    fileName: 'recording.json',
    value: metadata,
  });
}

async function readAudioFileMetadata(
  recordingDirectory: string,
  expectedByteLength: number,
  assertWorkspaceUsable?: AssertWorkspaceUsable
): Promise<{ readonly size: number }> {
  const audio = await openAudioFileForRead(
    recordingDirectory,
    expectedByteLength,
    assertWorkspaceUsable
  );
  try {
    return { size: audio.size };
  } finally {
    closeSync(audio.fd);
  }
}

async function readAudioFileChunk(
  recordingDirectory: string,
  offset: number,
  length: number,
  expectedByteLength: number,
  assertWorkspaceUsable?: AssertWorkspaceUsable
): Promise<Uint8Array | null> {
  const audio = await openAudioFileForRead(
    recordingDirectory,
    expectedByteLength,
    assertWorkspaceUsable
  );
  try {
    if (offset + length > expectedByteLength) {
      return null;
    }
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    await beforeAudioReadForTest?.({ offset, length, byteLength: expectedByteLength });
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    const buffer = Buffer.allocUnsafe(length);
    const bytesRead = readSync(audio.fd, buffer, 0, length, offset);
    if (bytesRead !== length) {
      return null;
    }
    return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead);
  } finally {
    closeSync(audio.fd);
  }
}

async function openAudioFileForRead(
  recordingDirectory: string,
  expectedByteLength: number,
  assertWorkspaceUsable?: AssertWorkspaceUsable
) {
  const directoryIdentity = await readDirectoryIdentity(recordingDirectory);
  await beforeAudioOpenForTest?.();
  assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
  const fd = openFileForReadInDirectory(recordingDirectory, directoryIdentity, 'audio.webm');
  try {
    const audio = fstatSync(fd);
    if (!audio.isFile() || audio.size !== expectedByteLength) {
      throw new Error('Recording audio path is unsafe');
    }
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    await assertSameDirectory(recordingDirectory, directoryIdentity);
    return { fd, size: audio.size };
  } catch (error) {
    closeSync(fd);
    throw error;
  }
}

export function setBeforeAudioReadForTest(
  hook: ((context: AudioReadContext) => MaybePromise<void>) | null
): void {
  beforeAudioReadForTest = hook;
}

export function setBeforeAudioOpenForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeAudioOpenForTest = hook;
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

export function setBeforeMarkdownWriteForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeMarkdownWriteForTest = hook;
}

export function clearFinalizedAudioTargetCacheForRoot(rootPath: string): void {
  const rootPrefix = `${path.resolve(rootPath)}:`;
  for (const cacheKey of finalizedAudioTargets.keys()) {
    if (cacheKey.startsWith(rootPrefix)) {
      finalizedAudioTargets.delete(cacheKey);
    }
  }
}

export function clearFinalizedAudioTargetCache(): void {
  finalizedAudioTargets.clear();
}

async function createEmptyDraftAudioFile(
  recordingDirectory: string,
  directoryIdentity: DirectoryIdentity,
  assertWorkspaceUsable?: AssertWorkspaceUsable
): Promise<void> {
  await assertSameDirectory(recordingDirectory, directoryIdentity);
  await beforeDraftAudioCreateForTest?.();
  assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
  const audioFd = openNoReplaceFileInDirectory(recordingDirectory, directoryIdentity, 'audio.webm');
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
    const audioFd = openExistingFileInDirectory({
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
  createRecordingId,
  now,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly createRecordingId: () => string;
  readonly now: () => string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly recordingId: string;
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
    const recordingId = createSafeRecordingId(createRecordingId());
    const key = recordingKey(rootPath, recordingId);
    recordingDirectory = resolveDraftRecordingDirectory(rootPath, recordingId);
    await beforeDraftDirectoryCreateForTest?.();
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    recordingDirectory = createRecordingDirectoryWithinParent({
      parentDirectory: path.dirname(recordingDirectory),
      directoryName: recordingId,
    });
    draftDirectoryCreated = true;
    recordingDirectoryIdentity = await readDirectoryIdentity(recordingDirectory);
    await afterDraftDirectoryCreateForTest?.();
    resolveDraftRecordingDirectory(rootPath, recordingId);
    await assertSameDirectory(recordingDirectory, recordingDirectoryIdentity);
    const metadata: RecordingMetadata = {
      schemaVersion: 1,
      workspaceId,
      recordingId,
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
    activeDrafts.add(key);
    return { ok: true, recordingId, nextSequence: 0 };
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

export async function appendRecordingAudioChunk({
  rootPath,
  recordingId,
  sequence,
  chunk,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly recordingId: string;
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

  const key = recordingKey(rootPath, recordingId);
  if (finalizingRecordings.has(key)) {
    return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalized');
  }
  if (inFlightAppends.has(key)) {
    return workspaceError('ERR_RECORDING_APPEND_IN_FLIGHT', 'Recording append already in flight');
  }

  inFlightAppends.add(key);
  let draftKnown = false;
  try {
    if (!activeDrafts.has(key)) {
      const existing = await lookupRecordingDirectoryById(rootPath, recordingId);
      if (existing.status === 'found' || existing.status === 'duplicate') {
        return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalized');
      }
      if (existing.status === 'invalid-id') {
        throw new Error('Invalid recording id');
      }
      if (existing.status === 'invalid-durable') {
        return workspaceError(
          'ERR_WORKSPACE_UNSAFE_PATH',
          'Recording durable truth is unsafe',
          'draft-preserved'
        );
      }
    }

    const recordingDirectory = resolveDraftRecordingDirectory(rootPath, recordingId);
    const recordingDirectoryIdentity = await readDirectoryIdentity(recordingDirectory);
    const metadata = await readMetadata(rootPath, recordingId);
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
    inFlightAppends.delete(key);
  }
}

interface FinalizeRecordingDraftInput {
  readonly rootPath: string;
  readonly workspaceId?: string;
  readonly recordingId: string;
  readonly memoryId?: string;
  readonly createMemoryId?: () => string;
  readonly title: string;
  readonly durationMs: number;
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
      readonly recording: {
        readonly memoryId: string;
        readonly recordingId: string;
        readonly title: string;
        readonly durationMs: number;
        readonly audioByteLength: number;
      };
      readonly memory: MemorySummary;
    }
  | WorkspaceErrorEnvelope;

async function finalizeRecordingDraftWithHooks(
  {
    rootPath,
    workspaceId,
    recordingId,
    memoryId,
    createMemoryId,
    title,
    durationMs,
    now,
    rebuildIndex,
    assertWorkspaceUsable,
  }: FinalizeRecordingDraftInput,
  transactionHooks?: FinalizeTransactionHooksForTest
): Promise<FinalizeRecordingDraftResult> {
  const key = recordingKey(rootPath, recordingId);
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

  finalizingRecordings.add(key);
  try {
    const metadata = await readMetadata(rootPath, recordingId);
    if (!metadata) {
      return workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording draft not found');
    }
    if (metadata.status !== 'draft') {
      return workspaceError('ERR_RECORDING_FINALIZED', 'Recording is already finalized');
    }

    const nextMemoryId = memoryId ?? createMemoryId?.();
    if (!nextMemoryId) {
      return workspaceError(
        'ERR_RECORDING_FINALIZE_FAILED',
        'Recording draft could not be finalized',
        'draft-preserved'
      );
    }
    const finalized =
      memoryId === undefined
        ? transactionHooks
          ? await createMemoryForRecordingForTest({
              rootPath,
              workspaceId: workspaceId ?? metadata.workspaceId,
              memoryId: nextMemoryId,
              recordingId,
              title,
              durationMs,
              now,
              ...(rebuildIndex ? { rebuildIndex } : {}),
              ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
              transactionHooks,
            })
          : await createMemoryForRecording({
              rootPath,
              workspaceId: workspaceId ?? metadata.workspaceId,
              memoryId: nextMemoryId,
              recordingId,
              title,
              durationMs,
              now,
              ...(rebuildIndex ? { rebuildIndex } : {}),
              ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
            })
        : transactionHooks
          ? await appendRecordingToMemoryForTest({
              rootPath,
              workspaceId: workspaceId ?? metadata.workspaceId,
              memoryId,
              recordingId,
              title,
              durationMs,
              now,
              ...(rebuildIndex ? { rebuildIndex } : {}),
              ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
              transactionHooks,
            })
          : await appendRecordingToMemory({
              rootPath,
              workspaceId: workspaceId ?? metadata.workspaceId,
              memoryId,
              recordingId,
              title,
              durationMs,
              now,
              ...(rebuildIndex ? { rebuildIndex } : {}),
              ...(assertWorkspaceUsable ? { assertWorkspaceUsable } : {}),
            });

    if (!finalized.ok) {
      return finalized;
    }

    const recording = await readFinalizedRecordingSummary(rootPath, nextMemoryId, recordingId);
    return {
      ok: true,
      recording: {
        memoryId: nextMemoryId,
        recordingId,
        title,
        durationMs,
        audioByteLength: recording.audioByteLength,
      },
      memory: finalized.value,
    };
  } catch {
    return workspaceError(
      'ERR_RECORDING_FINALIZE_FAILED',
      'Recording draft could not be finalized',
      'draft-preserved'
    );
  } finally {
    activeDrafts.delete(key);
    finalizingRecordings.delete(key);
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

export async function discardRecordingDraft({
  rootPath,
  recordingId,
  beforeDraftDiscardRemove,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly recordingId: string;
  readonly beforeDraftDiscardRemove?: () => Promise<void> | void;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<{ readonly ok: true; readonly discarded: true } | WorkspaceErrorEnvelope> {
  const usable = assertWorkspaceUsable?.();
  if (usable && !usable.ok) {
    return usable;
  }
  let draftDirectory: string;
  try {
    draftDirectory = resolveDraftRecordingDirectory(rootPath, recordingId);
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
    activeDrafts.delete(recordingKey(rootPath, recordingId));
  }
}

export async function readRecordingAudioManifest({
  rootPath,
  recordingId,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly recordingId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  | {
      readonly ok: true;
      readonly manifest: {
        readonly recordingId: string;
        readonly byteLength: number;
        readonly maxChunkBytes: number;
      };
    }
  | WorkspaceErrorEnvelope
> {
  const usable = assertWorkspaceUsable?.();
  if (usable && !usable.ok) {
    return usable;
  }
  try {
    const finalized = await resolveFinalizedRecordingReadTarget(rootPath, recordingId, true);
    const audio = await readAudioFileMetadata(
      finalized.directory,
      finalized.audioByteLength,
      assertWorkspaceUsable
    );
    return {
      ok: true,
      manifest: {
        recordingId,
        byteLength: audio.size,
        maxChunkBytes: MAX_AUDIO_CHUNK_BYTES,
      },
    };
  } catch (error) {
    return (
      caughtWorkspaceError(error) ??
      workspaceError('ERR_RECORDING_AUDIO_MISSING', 'Recording audio is missing')
    );
  }
}

export async function readRecordingAudioChunk({
  rootPath,
  recordingId,
  offset,
  length,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly recordingId: string;
  readonly offset: number;
  readonly length: number;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<{ readonly ok: true; readonly chunk: Uint8Array } | WorkspaceErrorEnvelope> {
  const usable = assertWorkspaceUsable?.();
  if (usable && !usable.ok) {
    return usable;
  }
  if (offset < 0 || length <= 0 || length > MAX_AUDIO_CHUNK_BYTES) {
    return workspaceError('ERR_RECORDING_INVALID_RANGE', 'Recording audio range is invalid');
  }

  try {
    const finalized = await resolveFinalizedRecordingReadTarget(rootPath, recordingId, true);
    const chunk = await readAudioFileChunk(
      finalized.directory,
      offset,
      length,
      finalized.audioByteLength,
      assertWorkspaceUsable
    );
    if (!chunk) {
      return workspaceError('ERR_RECORDING_INVALID_RANGE', 'Recording audio range is invalid');
    }
    return {
      ok: true,
      chunk,
    };
  } catch (error) {
    return (
      caughtWorkspaceError(error) ??
      workspaceError('ERR_RECORDING_AUDIO_MISSING', 'Recording audio is missing')
    );
  }
}

export async function getRecordingDetail({
  rootPath,
  recordingId,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly recordingId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<{ readonly ok: true; readonly recording: RecordingMetadata } | WorkspaceErrorEnvelope> {
  const usable = assertWorkspaceUsable?.();
  if (usable && !usable.ok) {
    return usable;
  }
  try {
    const recordingDirectory = await resolveReadableRecordingDirectory(rootPath, recordingId);
    return {
      ok: true,
      recording: await readMetadataFromDirectory(recordingDirectory),
    };
  } catch {
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Recording not found');
  }
}

async function writeMarkdownInRecordingDirectory({
  recordingDirectory,
  fileName,
  markdown,
  assertWorkspaceUsable,
}: {
  readonly recordingDirectory: string;
  readonly fileName: 'transcript.md' | 'reflections.md';
  readonly markdown: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<void> {
  const directoryIdentity = await readDirectoryIdentity(recordingDirectory);
  await beforeMarkdownWriteForTest?.();
  assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
  await assertSameDirectory(recordingDirectory, directoryIdentity);
  await writeWorkspaceFileAtomicInKnownDirectory({
    directory: recordingDirectory,
    directoryIdentity,
    fileName,
    data: markdown,
    ...(assertWorkspaceUsable
      ? { assertUsable: () => assertWorkspaceUsableForFileWrite(assertWorkspaceUsable) }
      : {}),
  });
}

export async function saveRecordingMarkdown(input: {
  readonly rootPath: string;
  readonly recordingId: string;
  readonly fileName: 'transcript.md' | 'reflections.md';
  readonly markdown: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<{ readonly ok: true; readonly saved: true } | WorkspaceErrorEnvelope> {
  return withMarkdownSaveQueue(
    recordingKey(input.rootPath, `${input.recordingId}:${input.fileName}`),
    () => saveRecordingMarkdownNow(input)
  );
}

async function saveRecordingMarkdownNow({
  rootPath,
  recordingId,
  fileName,
  markdown,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly recordingId: string;
  readonly fileName: 'transcript.md' | 'reflections.md';
  readonly markdown: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<{ readonly ok: true; readonly saved: true } | WorkspaceErrorEnvelope> {
  const usable = checkWorkspaceUsable(assertWorkspaceUsable);
  if (usable) {
    return usable;
  }
  let memoryId: string | undefined;
  try {
    const recordingDirectory = await resolveReadableRecordingDirectory(rootPath, recordingId);
    const recording = await readMetadataFromDirectory(recordingDirectory);
    if (recording.status === 'finalized') {
      memoryId = recording.memoryId;
    }
    await writeMarkdownInRecordingDirectory({
      recordingDirectory,
      fileName,
      markdown,
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
  try {
    assertWorkspaceUsableForFileWrite(assertWorkspaceUsable);
    if (memoryId) {
      await refreshMemoryIndexEntry(rootPath, memoryId, assertWorkspaceUsable);
    }
  } catch (error) {
    const workspaceErrorEnvelope = caughtWorkspaceError(error);
    if (workspaceErrorEnvelope) {
      return workspaceErrorEnvelope;
    }
    return workspaceError(
      'ERR_WORKSPACE_INDEX_WRITE_FAILED',
      'Recording markdown was saved but the workspace index could not be refreshed',
      'file-written-index-stale'
    );
  }
  return { ok: true, saved: true };
}

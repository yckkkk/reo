import {
  closeSync,
  constants,
  fsync as fsyncCallback,
  fstatSync,
  lstatSync,
  mkdirSync,
  read as readCallback,
  readSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  unlinkSync,
  write as writeCallback,
} from 'node:fs';
import { lstat, open, opendir, readdir, realpath, utimes } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import {
  WorkspaceFileChangedBeforeAtomicWrite,
  writeWorkspaceFileAtomic,
  writeWorkspaceFileAtomicInKnownDirectory,
  writeWorkspaceFileNoReplaceAtomic,
  writeWorkspaceJsonAtomic,
} from './atomicWorkspaceFile.js';
import {
  reconcileTiptapContentSidecar,
  TIPTAP_CONTENT_SIDECAR_FILE,
} from './tiptapContentSidecar.js';
import {
  assertSameCurrentDirectoryIdentity as assertSameCurrentDirectory,
  assertSameDirectoryIdentity as assertSameDirectoryPathAsync,
  assertSameDirectoryIdentitySync as assertSameDirectoryPath,
  readSafeDirectoryIdentity as readDirectoryIdentity,
  readSafeDirectoryIdentitySync as readDirectoryIdentitySync,
  type DirectoryIdentity,
} from './directoryIdentity.js';
import {
  getWorkspaceIndexPath,
  resolveWorkspaceDraftSupplementDirectory,
  resolveWorkspaceDraftSegmentDirectory,
} from './workspacePaths.js';
import {
  parseWorkspaceMarkdownObjectCandidate,
  parseWorkspaceMarkdownObject,
  renderWorkspaceMarkdownObject,
} from './workspaceMarkdownObjects.js';
import { recordDiagnosticEvent } from './diagnostics.js';
import type { WorkspaceReviewEntryInput } from './workspaceReviewReport.js';
import {
  fsyncCurrentWorkspaceDirectoryBestEffort,
  isUnsupportedWorkspaceDirectoryFsyncError,
  openExistingWorkspaceFileInDirectory,
  openNoReplaceWorkspaceFileInDirectory,
  readWorkspaceDirectoryEntriesInDirectory,
  removeEmptyWorkspaceDirectoryInDirectory,
  removeWorkspaceDirectoryTreeInDirectory,
  removeWorkspaceFileInDirectory,
  runInWorkspaceDirectorySync,
} from './workspaceDirectoryTransactions.js';
import {
  draftSegmentSupplementMetadataSchema,
  draftSegmentMetadataSchema,
  SUPPLEMENT_ID_PATTERN,
  MEMORY_ID_PATTERN,
  SEGMENT_ID_PATTERN,
  isSafeWorkspaceDirectoryName,
  lastTranscriptionAttemptSchema,
  workspaceError,
  type FinalizeTranscriptionAttempt,
  type LastTranscriptionAttempt,
  workspaceMemorySummarySchema,
  workspaceSegmentContentTabOrderItemSchema,
  type WorkspaceError,
  type WorkspaceErrorEnvelope,
  type WorkspaceMemoryDetailProjection,
  type WorkspaceSegmentContentTabOrderItem,
  type WorkspaceSegmentSupplementProjection,
  type WorkspaceSegmentProjection,
} from '../workspace-contract/workspace-contract.js';

const FINALIZE_STAGING_PREFIX = '.reo-finalizing-';
const FINALIZE_TRANSACTION_MARKER = '.reo-finalize-transaction.json';
const MAX_WORKSPACE_JSON_BYTES = 1_048_576;
const DRAFT_RECORDING_FILES = new Set(['audio.webm', 'segment.json', 'transcript.md']);
const DRAFT_SUPPLEMENT_FILES = new Set(['audio.webm', 'supplement.json', 'transcript.md']);
const COPY_BUFFER_BYTES = 1_048_576;
const fsyncDescriptor = promisify(fsyncCallback);
const readDescriptor = promisify(readCallback);
const writeDescriptor = promisify(writeCallback);
const inFlightMemoryWrites = new Set<string>();
const workspaceIndexWriteQueues = new Map<string, Promise<void>>();
type MaybePromise<T> = T | Promise<T>;
type ManifestLastTranscriptionAttempt = FinalizeTranscriptionAttempt | 'success' | undefined;
type FileTruthListOptions = {
  readonly repairFileSpaceCandidates?: boolean;
};

const workspaceIdentitySchema = z
  .object({
    workspaceId: z.string().min(1),
  })
  .passthrough();

class FinalizeTransactionFailure extends Error {
  readonly dataRetention: WorkspaceError['dataRetention'];

  constructor(error: unknown, dataRetention: WorkspaceError['dataRetention']) {
    super(error instanceof Error ? error.message : 'Finalize transaction failed');
    this.dataRetention = dataRetention;
  }
}

class FileWrittenIndexStale extends Error {
  constructor(error: unknown) {
    super(error instanceof Error ? error.message : 'Workspace index refresh failed');
  }
}

function finalizeFailureRetention(error: unknown): WorkspaceError['dataRetention'] {
  return error instanceof FinalizeTransactionFailure && error.dataRetention
    ? error.dataRetention
    : 'draft-preserved';
}

export interface MemoryFileTruth {
  readonly memoryId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface MemoryObjectManifest {
  readonly schemaVersion: 1;
  readonly objectType: 'memory';
  readonly memoryId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface AudioSegmentObjectManifest {
  readonly schemaVersion: 1;
  readonly objectType: 'segment';
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly kind: 'audio';
  readonly createdAt: string;
  readonly finalizedAt: string;
  readonly updatedAt: string;
  readonly durationMs: number;
  readonly nextSequence: number;
  readonly audioByteLength: number;
  readonly lastTranscriptionAttempt?: ManifestLastTranscriptionAttempt;
  readonly contentTabOrder?: readonly WorkspaceSegmentContentTabOrderItem[] | undefined;
}

interface NoteSegmentObjectManifest {
  readonly schemaVersion: 1;
  readonly objectType: 'segment';
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly kind: 'note';
  readonly createdAt: string;
  readonly finalizedAt: string;
  readonly updatedAt: string;
  readonly bodyByteLength: number;
  readonly contentTabOrder?: readonly WorkspaceSegmentContentTabOrderItem[] | undefined;
}

type SegmentObjectManifest = AudioSegmentObjectManifest | NoteSegmentObjectManifest;

interface AudioSupplementObjectManifest {
  readonly schemaVersion: 1;
  readonly objectType: 'supplement';
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly kind: 'audio';
  readonly createdAt: string;
  readonly finalizedAt: string;
  readonly updatedAt: string;
  readonly durationMs: number;
  readonly nextSequence: number;
  readonly audioByteLength: number;
  readonly lastTranscriptionAttempt?: ManifestLastTranscriptionAttempt;
}

interface NoteSupplementObjectManifest {
  readonly schemaVersion: 1;
  readonly objectType: 'supplement';
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly kind: 'note';
  readonly createdAt: string;
  readonly finalizedAt: string;
  readonly updatedAt: string;
  readonly bodyByteLength: number;
}

type SupplementObjectManifest = AudioSupplementObjectManifest | NoteSupplementObjectManifest;

type FinalizedSegmentSemanticTruth = SegmentObjectManifest & {
  readonly title: string;
  readonly contentTitle?: string;
  readonly markdownContent: string;
};

type FinalizedAudioSegmentSemanticTruth = AudioSegmentObjectManifest & {
  readonly title: string;
  readonly contentTitle?: string;
  readonly markdownContent: string;
};

type FinalizedNoteSegmentSemanticTruth = NoteSegmentObjectManifest & {
  readonly title: string;
  readonly contentTitle?: string;
  readonly markdownContent: string;
};

type FinalizedSupplementSemanticTruth = SupplementObjectManifest & {
  readonly title: string;
  readonly markdownContent: string;
};

export interface MemorySummary {
  readonly memoryId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly segmentCount: number;
  readonly audioSegmentCount: number;
  readonly noteSegmentCount: number;
  readonly audioDurationMs: number;
  readonly audioByteLength: number;
  readonly hasAudioTranscript: boolean;
  readonly hasAnyNote: boolean;
  readonly supplementCount: number;
}

export interface MemorySegmentSummary {
  readonly segmentId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly audioByteLength: number;
  readonly lastTranscriptionAttempt: 'failed' | 'never' | 'success';
}

interface FinalizedSegmentFileTruthBase {
  readonly segmentId: string;
  readonly recordingDirectory: string;
  readonly recordingDirectoryIdentity: DirectoryIdentity;
  readonly metadata: FinalizedSegmentSemanticTruth;
}

interface FinalizedAudioSegmentFileTruth extends FinalizedSegmentFileTruthBase {
  readonly metadata: FinalizedAudioSegmentSemanticTruth;
  readonly audioByteLength: number;
}

interface FinalizedNoteSegmentFileTruth extends FinalizedSegmentFileTruthBase {
  readonly metadata: FinalizedNoteSegmentSemanticTruth;
}

type FinalizedSegmentFileTruth = FinalizedAudioSegmentFileTruth | FinalizedNoteSegmentFileTruth;

export interface SegmentSupplementSummary {
  readonly supplementId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly audioByteLength: number;
}

export type SegmentDirectoryLookup =
  | {
      readonly status: 'found';
      readonly directory: string;
      readonly segment: MemorySegmentSummary;
    }
  | {
      readonly status: 'found-non-audio';
      readonly directory: string;
    }
  | { readonly status: 'not-found' }
  | { readonly status: 'invalid-id' }
  | { readonly status: 'duplicate' }
  | { readonly status: 'invalid-durable' };

export interface FinalizeTransactionHooksForTest {
  readonly beforeParentDirectoryCreate?: () => MaybePromise<void>;
  readonly beforeMemoryDirectoryCreate?: () => MaybePromise<void>;
  readonly beforeMemoryDirectoryMkdir?: () => MaybePromise<void>;
  readonly beforeSegmentsDirectoryCreate?: () => MaybePromise<void>;
  readonly beforeSegmentsDirectoryMkdir?: () => MaybePromise<void>;
  readonly beforeStagingDirectoryCreate?: () => MaybePromise<void>;
  readonly afterStagingDirectoryCreate?: () => MaybePromise<void>;
  readonly afterMarkerWrite?: () => MaybePromise<void>;
  readonly beforeDraftCopy?: () => MaybePromise<void>;
  readonly afterCopy?: () => MaybePromise<void>;
  readonly afterStagingTreeFsync?: () => MaybePromise<void>;
  readonly beforeExpose?: () => MaybePromise<void>;
  readonly beforeFinalRename?: () => MaybePromise<void>;
  readonly beforeFinalRenameCommit?: () => void;
  readonly afterFinalRenameTargetPreflight?: () => void;
  readonly afterFinalRenameLastPreflight?: () => void;
  readonly afterFinalRename?: () => MaybePromise<void>;
  readonly afterParentFsync?: () => MaybePromise<void>;
  readonly beforeDraftCleanup?: () => MaybePromise<void>;
  readonly beforeDraftDirectoryRemove?: () => MaybePromise<void>;
  readonly afterDraftCleanup?: () => MaybePromise<void>;
  readonly beforeSafeCleanupRemove?: () => MaybePromise<void>;
}

type FinalizeTransactionHooks = FinalizeTransactionHooksForTest;
type AssertWorkspaceUsable = () => { readonly ok: true } | WorkspaceErrorEnvelope;

export interface SafeWorkspaceDirectoryRemoveOptions {
  readonly beforeSafeCleanupRemove?: () => MaybePromise<void>;
  readonly allowMissing?: boolean;
}

interface RecoverFinalizeTransactionsOptions {
  readonly removeDraftDirectory?: (draftDirectory: string) => Promise<void>;
  readonly beforeRecordingRecoveryRemove?: () => MaybePromise<void>;
  readonly afterDraftCleanup?: () => MaybePromise<void>;
  readonly assertWorkspaceUsable?: () => MaybePromise<void>;
}

export interface CreateMemoryForAudioSegmentInput {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly lastTranscriptionAttemptOnFinalize?: FinalizeTranscriptionAttempt;
  readonly now: () => string;
  readonly rebuildIndex?: (rootPath: string) => Promise<readonly MemorySummary[]>;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

export interface CreateMemoryInput {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly title: string;
  readonly now: () => string;
  readonly rebuildIndex?: (rootPath: string) => Promise<readonly MemorySummary[]>;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

export type AppendAudioSegmentToMemoryInput = CreateMemoryForAudioSegmentInput;

export interface AppendAudioSupplementToSegmentInput {
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
}

export type CreateMemoryForAudioSegmentForTestInput = CreateMemoryForAudioSegmentInput & {
  readonly transactionHooks?: FinalizeTransactionHooksForTest;
};

export type AppendAudioSegmentToMemoryForTestInput = AppendAudioSegmentToMemoryInput & {
  readonly transactionHooks?: FinalizeTransactionHooksForTest;
};

export type AppendAudioSupplementToSegmentForTestInput = AppendAudioSupplementToSegmentInput & {
  readonly transactionHooks?: FinalizeTransactionHooksForTest;
};

export interface MemoryTargetInput {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}

export interface UpdateMemoryTitleInput extends MemoryTargetInput {
  readonly title: string;
  readonly now: () => string;
}

export interface UpdateSegmentTitleInput extends MemoryTargetInput {
  readonly workspaceId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly now: () => string;
}

export interface UpdateSegmentContentTitleInput extends MemoryTargetInput {
  readonly workspaceId: string;
  readonly segmentId: string;
  readonly contentTitle: string;
  readonly now: () => string;
}

export interface UpdateSegmentContentTabOrderInput extends MemoryTargetInput {
  readonly workspaceId: string;
  readonly segmentId: string;
  readonly contentTabOrder: readonly WorkspaceSegmentContentTabOrderItem[];
}

export interface UpdateSegmentSupplementTitleInput extends MemoryTargetInput {
  readonly workspaceId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly title: string;
}

export interface SegmentTargetInput extends MemoryTargetInput {
  readonly workspaceId: string;
  readonly segmentId: string;
}

export interface SegmentSupplementTargetInput extends SegmentTargetInput {
  readonly supplementId: string;
}

type MemoryFilesResult<T> = { readonly ok: true; readonly value: T } | WorkspaceErrorEnvelope;

let beforeReadModelReaddirForTest: (() => MaybePromise<void>) | null = null;
let beforeReadModelPersistForTest: (() => MaybePromise<void>) | null = null;
let beforeReadModelReplaceForTest: (() => MaybePromise<void>) | null = null;
let afterReadModelReplaceReadForTest: (() => MaybePromise<void>) | null = null;
let beforeRecordingLookupForTest: (() => MaybePromise<void>) | null = null;
let beforeDuplicateRecordingCheckForTest: (() => MaybePromise<void>) | null = null;
let beforeMemoryIndexEntryReadForTest: (() => MaybePromise<void>) | null = null;
let beforeFileSpaceNodeMoveForTest: (() => MaybePromise<void>) | null = null;
let beforeSegmentFileTruthListForTest: (() => MaybePromise<void>) | null = null;
let beforeMemoryDetailProjectionForTest: (() => MaybePromise<void>) | null = null;
let beforeMemoryDirectoryCandidateScanForTest:
  | ((input: { readonly parentDirectory: string; readonly memoryId: string }) => MaybePromise<void>)
  | null = null;
let beforeSegmentDirectoryCandidateScanForTest:
  | ((input: {
      readonly parentDirectory: string;
      readonly memoryId: string;
      readonly segmentId: string;
    }) => MaybePromise<void>)
  | null = null;

class WorkspaceHandleLost extends Error {
  readonly envelope: WorkspaceErrorEnvelope;

  constructor(envelope: WorkspaceErrorEnvelope) {
    super(envelope.error.message);
    this.envelope = envelope;
  }
}

class PassiveTiptapSidecarReconcileFailed extends Error {
  override readonly cause: unknown;

  constructor(cause: unknown) {
    super('Passive Tiptap sidecar reconcile failed');
    this.cause = cause;
  }
}

function assertWorkspaceUsable(assertUsable: AssertWorkspaceUsable | undefined): void {
  const usable = assertUsable?.();
  if (usable && !usable.ok) {
    throw new WorkspaceHandleLost(usable);
  }
}

function memoryFilesError(
  error: unknown,
  code: Parameters<typeof workspaceError>[0],
  message: string,
  dataRetention?: WorkspaceError['dataRetention']
): WorkspaceErrorEnvelope {
  return error instanceof WorkspaceHandleLost
    ? error.envelope
    : workspaceError(code, message, dataRetention);
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

function updateMemoryTitleError(error: unknown): WorkspaceErrorEnvelope {
  if (error instanceof WorkspaceHandleLost) {
    return error.envelope;
  }

  if (
    isMissingFileError(error) ||
    (error instanceof Error && error.message === 'Invalid memory id')
  ) {
    return workspaceError('ERR_MEMORY_NOT_FOUND', 'Memory not found', 'none-written');
  }

  if (isUnsafeWorkspacePathError(error)) {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Memory path is unsafe',
      'previous-file-preserved'
    );
  }

  return workspaceError(
    'ERR_MEMORY_UPDATE_FAILED',
    'Memory title could not be updated',
    'previous-file-preserved'
  );
}

function updateSegmentTitleError(error: unknown): WorkspaceErrorEnvelope {
  if (error instanceof WorkspaceHandleLost) {
    return error.envelope;
  }

  if (
    isMissingFileError(error) ||
    (error instanceof Error &&
      (error.message === 'Invalid segment id' ||
        error.message === 'Finalized segment projection does not match file truth'))
  ) {
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Segment not found', 'none-written');
  }

  if (isUnsafeWorkspacePathError(error)) {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Segment path is unsafe',
      'previous-file-preserved'
    );
  }

  return workspaceError(
    'ERR_MEMORY_UPDATE_FAILED',
    'Segment title could not be updated',
    'previous-file-preserved'
  );
}

function updateSegmentSupplementTitleError(error: unknown): WorkspaceErrorEnvelope {
  if (error instanceof WorkspaceHandleLost) {
    return error.envelope;
  }

  if (error instanceof FileWrittenIndexStale) {
    return workspaceError(
      'ERR_MEMORY_UPDATE_FAILED',
      'Segment supplement title was updated but the memory index is stale',
      'file-written-index-stale'
    );
  }

  if (
    isMissingFileError(error) ||
    (error instanceof Error &&
      (error.message === 'Invalid segment supplement id' ||
        error.message === 'Finalized segment supplement projection does not match file truth'))
  ) {
    return workspaceError(
      'ERR_RECORDING_NOT_FOUND',
      'Segment supplement not found',
      'none-written'
    );
  }

  if (isUnsafeWorkspacePathError(error)) {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Segment supplement path is unsafe',
      'previous-file-preserved'
    );
  }

  return workspaceError(
    'ERR_MEMORY_UPDATE_FAILED',
    'Segment supplement title could not be updated',
    'previous-file-preserved'
  );
}

function segmentDeleteError(
  error: unknown,
  dataRetention: WorkspaceError['dataRetention']
): WorkspaceErrorEnvelope {
  if (error instanceof WorkspaceHandleLost) {
    return {
      ok: false,
      error: {
        ...error.envelope.error,
        dataRetention: error.envelope.error.dataRetention ?? dataRetention,
      },
    };
  }

  if (
    isMissingFileError(error) ||
    (error instanceof Error &&
      (error.message === 'Invalid segment id' ||
        error.message === 'Finalized segment projection does not match file truth'))
  ) {
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Segment not found', 'none-written');
  }

  if (isUnsafeWorkspacePathError(error)) {
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Segment path is unsafe', dataRetention);
  }

  return workspaceError('ERR_SEGMENT_DELETE_FAILED', 'Segment could not be deleted', dataRetention);
}

function segmentRestoreError(
  error: unknown,
  dataRetention: WorkspaceError['dataRetention']
): WorkspaceErrorEnvelope {
  if (error instanceof WorkspaceHandleLost) {
    return {
      ok: false,
      error: {
        ...error.envelope.error,
        dataRetention: error.envelope.error.dataRetention ?? dataRetention,
      },
    };
  }

  if (error instanceof Error && error.message === 'Segment restore parent memory missing') {
    return workspaceError(
      'ERR_SEGMENT_RESTORE_PARENT_MISSING',
      'Deleted Segment parent Memory is missing',
      'previous-file-preserved'
    );
  }

  if (error instanceof Error && error.message === 'Invalid segment id') {
    return workspaceError('ERR_RECORDING_NOT_FOUND', 'Segment not found', 'none-written');
  }

  if (isUnsafeWorkspacePathError(error)) {
    return workspaceError('ERR_WORKSPACE_UNSAFE_PATH', 'Segment path is unsafe', dataRetention);
  }

  return workspaceError(
    'ERR_SEGMENT_RESTORE_FAILED',
    'Deleted Segment could not be restored',
    dataRetention
  );
}

function segmentSupplementDeleteError(
  error: unknown,
  dataRetention: WorkspaceError['dataRetention']
): WorkspaceErrorEnvelope {
  if (error instanceof WorkspaceHandleLost) {
    return {
      ok: false,
      error: {
        ...error.envelope.error,
        dataRetention: error.envelope.error.dataRetention ?? dataRetention,
      },
    };
  }

  if (
    isMissingFileError(error) ||
    (error instanceof Error &&
      (error.message === 'Invalid segment supplement id' ||
        error.message === 'Finalized segment supplement projection does not match file truth'))
  ) {
    return workspaceError(
      'ERR_RECORDING_NOT_FOUND',
      'Segment supplement not found',
      'none-written'
    );
  }

  if (isUnsafeWorkspacePathError(error)) {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Segment supplement path is unsafe',
      dataRetention
    );
  }

  return workspaceError(
    'ERR_SEGMENT_SUPPLEMENT_DELETE_FAILED',
    'Segment supplement could not be deleted',
    dataRetention
  );
}

function segmentSupplementRestoreError(
  error: unknown,
  dataRetention: WorkspaceError['dataRetention']
): WorkspaceErrorEnvelope {
  if (error instanceof WorkspaceHandleLost) {
    return {
      ok: false,
      error: {
        ...error.envelope.error,
        dataRetention: error.envelope.error.dataRetention ?? dataRetention,
      },
    };
  }

  if (error instanceof Error && error.message === 'Segment supplement restore parent missing') {
    return workspaceError(
      'ERR_SEGMENT_SUPPLEMENT_RESTORE_PARENT_MISSING',
      'Deleted SegmentSupplement parent Memory or Segment is missing',
      'previous-file-preserved'
    );
  }

  if (error instanceof Error && error.message === 'Invalid segment supplement id') {
    return workspaceError(
      'ERR_RECORDING_NOT_FOUND',
      'Segment supplement not found',
      'none-written'
    );
  }

  if (isUnsafeWorkspacePathError(error)) {
    return workspaceError(
      'ERR_WORKSPACE_UNSAFE_PATH',
      'Segment supplement path is unsafe',
      dataRetention
    );
  }

  return workspaceError(
    'ERR_SEGMENT_SUPPLEMENT_RESTORE_FAILED',
    'Deleted SegmentSupplement could not be restored',
    dataRetention
  );
}

const memoryObjectManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    objectType: z.literal('memory'),
    memoryId: z.string().regex(MEMORY_ID_PATTERN),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

function deriveLastTranscriptionAttempt(manifest: {
  readonly lastTranscriptionAttempt?: ManifestLastTranscriptionAttempt;
}): LastTranscriptionAttempt {
  return manifest.lastTranscriptionAttempt ?? 'never';
}

function initialFinalizeTranscriptionAttempt(
  value: FinalizeTranscriptionAttempt | undefined
): FinalizeTranscriptionAttempt {
  return value ?? 'never';
}

const segmentObjectManifestBaseSchema = z
  .object({
    schemaVersion: z.literal(1),
    objectType: z.literal('segment'),
    workspaceId: z.string().min(1),
    memoryId: z.string().regex(MEMORY_ID_PATTERN),
    segmentId: z.string().regex(SEGMENT_ID_PATTERN),
    createdAt: z.string(),
    finalizedAt: z.string(),
    updatedAt: z.string(),
    contentTabOrder: z.array(workspaceSegmentContentTabOrderItemSchema).optional(),
  })
  .strict();

const audioSegmentObjectManifestSchema = segmentObjectManifestBaseSchema.extend({
  kind: z.literal('audio'),
  durationMs: z.number().int().nonnegative(),
  nextSequence: z.number().int().nonnegative(),
  audioByteLength: z.number().int().nonnegative(),
  lastTranscriptionAttempt: lastTranscriptionAttemptSchema.optional(),
});

const noteSegmentObjectManifestSchema = segmentObjectManifestBaseSchema.extend({
  kind: z.literal('note'),
  bodyByteLength: z.number().int().nonnegative(),
});

const segmentObjectManifestSchema = z.discriminatedUnion('kind', [
  audioSegmentObjectManifestSchema,
  noteSegmentObjectManifestSchema,
]);

const supplementObjectManifestBaseSchema = z
  .object({
    schemaVersion: z.literal(1),
    objectType: z.literal('supplement'),
    workspaceId: z.string().min(1),
    memoryId: z.string().regex(MEMORY_ID_PATTERN),
    segmentId: z.string().regex(SEGMENT_ID_PATTERN),
    supplementId: z.string().regex(SUPPLEMENT_ID_PATTERN),
    createdAt: z.string(),
    finalizedAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

const audioSupplementObjectManifestSchema = supplementObjectManifestBaseSchema.extend({
  kind: z.literal('audio'),
  durationMs: z.number().int().nonnegative(),
  nextSequence: z.number().int().nonnegative(),
  audioByteLength: z.number().int().nonnegative(),
  lastTranscriptionAttempt: lastTranscriptionAttemptSchema.optional(),
});

const noteSupplementObjectManifestSchema = supplementObjectManifestBaseSchema.extend({
  kind: z.literal('note'),
  bodyByteLength: z.number().int().nonnegative(),
});

const supplementObjectManifestSchema = z.discriminatedUnion('kind', [
  audioSupplementObjectManifestSchema,
  noteSupplementObjectManifestSchema,
]);

const workspaceIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    memories: z.array(workspaceMemorySummarySchema),
  })
  .strict();

async function resolveSafeWorkspaceChild(rootPath: string, candidatePath: string): Promise<string> {
  const canonicalRoot = await realpath(rootPath);
  let relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    relative = path.relative(canonicalRoot, path.resolve(candidatePath));
  }
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes workspace');
  }

  let current = canonicalRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) {
        throw new Error('Workspace path crosses a symlink');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        break;
      }
      throw error;
    }
  }

  const resolved = path.join(canonicalRoot, relative);
  const containment = path.relative(canonicalRoot, resolved);
  if (containment.startsWith('..') || path.isAbsolute(containment)) {
    throw new Error('Path escapes workspace');
  }
  return resolved;
}

interface WorkspaceDirectoryFsyncHandle {
  readonly sync: () => Promise<void>;
  readonly close: () => Promise<void>;
}

async function fsyncWorkspaceDirectoryWithOpen({
  directoryPath,
  openDirectory,
}: {
  readonly directoryPath: string;
  readonly openDirectory: (directoryPath: string) => Promise<WorkspaceDirectoryFsyncHandle>;
}): Promise<void> {
  let handle: WorkspaceDirectoryFsyncHandle | null = null;
  try {
    handle = await openDirectory(directoryPath);
    await handle.sync();
  } catch (error) {
    if (!isUnsupportedWorkspaceDirectoryFsyncError(error)) {
      throw error;
    }
  } finally {
    await handle?.close();
  }
}

async function fsyncWorkspaceDirectory(directoryPath: string): Promise<void> {
  await fsyncWorkspaceDirectoryWithOpen({
    directoryPath,
    openDirectory: (nextDirectoryPath) => open(nextDirectoryPath, 'r'),
  });
}

export async function fsyncWorkspaceDirectoryForTest({
  directoryPath,
  openDirectory,
}: {
  readonly directoryPath: string;
  readonly openDirectory: (directoryPath: string) => Promise<{
    readonly sync: () => Promise<void>;
    readonly close: () => Promise<void>;
  }>;
}): Promise<void> {
  await fsyncWorkspaceDirectoryWithOpen({ directoryPath, openDirectory });
}

export function setBeforeReadModelReaddirForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeReadModelReaddirForTest = hook;
}

export function setBeforeReadModelPersistForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeReadModelPersistForTest = hook;
}

export function setBeforeReadModelReplaceForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeReadModelReplaceForTest = hook;
}

export function setAfterReadModelReplaceReadForTest(hook: (() => MaybePromise<void>) | null): void {
  afterReadModelReplaceReadForTest = hook;
}

export function setBeforeRecordingLookupForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeRecordingLookupForTest = hook;
}

export function setBeforeDuplicateRecordingCheckForTest(
  hook: (() => MaybePromise<void>) | null
): void {
  beforeDuplicateRecordingCheckForTest = hook;
}

export function setBeforeMemoryIndexEntryReadForTest(
  hook: (() => MaybePromise<void>) | null
): void {
  beforeMemoryIndexEntryReadForTest = hook;
}

export function setBeforeFileSpaceNodeMoveForTest(hook: (() => MaybePromise<void>) | null): void {
  beforeFileSpaceNodeMoveForTest = hook;
}

export function setBeforeSegmentFileTruthListForTest(
  hook: (() => MaybePromise<void>) | null
): void {
  beforeSegmentFileTruthListForTest = hook;
}

export function setBeforeMemoryDetailProjectionForTest(
  hook: (() => MaybePromise<void>) | null
): void {
  beforeMemoryDetailProjectionForTest = hook;
}

export function setBeforeMemoryDirectoryCandidateScanForTest(
  hook:
    | ((input: {
        readonly parentDirectory: string;
        readonly memoryId: string;
      }) => MaybePromise<void>)
    | null
): void {
  beforeMemoryDirectoryCandidateScanForTest = hook;
}

export function setBeforeSegmentDirectoryCandidateScanForTest(
  hook:
    | ((input: {
        readonly parentDirectory: string;
        readonly memoryId: string;
        readonly segmentId: string;
      }) => MaybePromise<void>)
    | null
): void {
  beforeSegmentDirectoryCandidateScanForTest = hook;
}

async function fsyncWorkspaceFile(filePath: string): Promise<void> {
  const handle = await open(filePath, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function readWorkspaceTextFileInKnownDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string
): string {
  const fd = openExistingWorkspaceFileInDirectory({
    directory,
    directoryIdentity,
    fileName,
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
  try {
    const metadata = fstatSync(fd);
    if (!metadata.isFile()) {
      throw new Error('Workspace file is not safe');
    }
    if (metadata.size > MAX_WORKSPACE_JSON_BYTES) {
      throw new Error('Workspace file is too large');
    }
    const buffer = Buffer.allocUnsafe(metadata.size);
    let offset = 0;
    while (offset < metadata.size) {
      const bytesRead = readSync(fd, buffer, offset, metadata.size - offset, offset);
      if (bytesRead === 0) {
        throw new Error('Workspace file changed during read');
      }
      offset += bytesRead;
    }
    assertSameDirectoryPath(directory, directoryIdentity);
    return buffer.toString('utf8');
  } finally {
    closeSync(fd);
  }
}

async function readWorkspaceTextFile(filePath: string): Promise<string> {
  const directory = path.dirname(filePath);
  return readWorkspaceTextFileInKnownDirectory(
    directory,
    await readDirectoryIdentity(directory),
    path.basename(filePath)
  );
}

async function exists(filePath: string): Promise<boolean> {
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

async function readExistingDirectoryEntries(directoryPath: string): Promise<Dirent[]> {
  try {
    return await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function readExistingDirectoryNames(directoryPath: string): Promise<string[]> {
  try {
    return await readdir(directoryPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function readWorkspaceId(rootPath: string): Promise<string> {
  return workspaceIdentitySchema.parse(
    JSON.parse(await readWorkspaceTextFile(path.join(rootPath, '.reo', 'workspace.json')))
  ).workspaceId;
}

function createReconciledSegmentId(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `seg_${timestamp}_${randomUUID().slice(0, 8)}`;
}

function createReconciledSupplementId(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `sup_${timestamp}_${randomUUID().slice(0, 8)}`;
}

function firstNonEmptyMarkdownLine(content: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line
      .trim()
      .replace(/^#{1,6}\s+/, '')
      .trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

function inferCandidateTitle({
  content,
  directoryName,
  metadataTitle,
  nodeId,
}: {
  readonly content: string;
  readonly directoryName: string;
  readonly metadataTitle?: string | undefined;
  readonly nodeId: string;
}): string {
  const frontmatterTitle = metadataTitle?.trim();
  if (frontmatterTitle) {
    return frontmatterTitle;
  }
  const directoryTitle = titleFromFileSpaceDirectoryName({
    directoryName,
    metadataTitle: '',
    nodeId,
  }).trim();
  if (directoryTitle) {
    return directoryTitle;
  }
  return firstNonEmptyMarkdownLine(content) ?? 'Untitled note';
}

async function readSegmentManifestOrNull(
  rootPath: string,
  segmentId: string
): Promise<SegmentObjectManifest | null> {
  try {
    return segmentObjectManifestSchema.parse(
      JSON.parse(await readWorkspaceTextFile(await segmentObjectManifestPath(rootPath, segmentId)))
    );
  } catch {
    return null;
  }
}

function directorySegmentIdHint(directoryName: string): string | null {
  const hint = directoryName.split('--')[0] ?? '';
  return SEGMENT_ID_PATTERN.test(hint) ? hint : null;
}

async function readSupplementManifestOrNull(
  rootPath: string,
  supplementId: string
): Promise<SupplementObjectManifest | null> {
  try {
    return supplementObjectManifestSchema.parse(
      JSON.parse(
        await readWorkspaceTextFile(await supplementObjectManifestPath(rootPath, supplementId))
      )
    );
  } catch {
    return null;
  }
}

async function activeSegmentDirectoryStillExists({
  memoryId,
  rootPath,
  segmentId,
}: {
  readonly memoryId: string;
  readonly rootPath: string;
  readonly segmentId: string;
}): Promise<boolean> {
  try {
    const directory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
    const metadata = await lstat(directory);
    return metadata.isDirectory() || metadata.isSymbolicLink();
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? false : true;
  }
}

async function activeSupplementDirectoryStillExists({
  memoryId,
  rootPath,
  segmentId,
  supplementId,
}: {
  readonly memoryId: string;
  readonly rootPath: string;
  readonly segmentId: string;
  readonly supplementId: string;
}): Promise<boolean> {
  try {
    const directory = await segmentSupplementDirectory(rootPath, memoryId, segmentId, supplementId);
    const metadata = await lstat(directory);
    return metadata.isDirectory() || metadata.isSymbolicLink();
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? false : true;
  }
}

function directorySupplementIdHint(directoryName: string): string | null {
  const hint = directoryName.split('--')[0] ?? '';
  return SUPPLEMENT_ID_PATTERN.test(hint) ? hint : null;
}

function pushReviewEntry(
  reviewEntries: WorkspaceReviewEntryInput[] | undefined,
  entry: WorkspaceReviewEntryInput
): void {
  reviewEntries?.push(entry);
}

function pushTiptapSidecarReviewEntry({
  directory,
  kind,
  markdownFileName,
  objectType,
  reason,
  reviewEntries,
}: {
  readonly directory: string;
  readonly kind: 'audio' | 'note';
  readonly markdownFileName: 'segment.md' | 'supplement.md';
  readonly objectType: 'segment' | 'supplement';
  readonly reason: WorkspaceReviewEntryInput['reason'];
  readonly reviewEntries?: WorkspaceReviewEntryInput[];
}): void {
  pushReviewEntry(reviewEntries, {
    category: 'tiptap-sidecar',
    kind,
    objectType,
    paths: [
      path.join(directory, markdownFileName),
      path.join(directory, TIPTAP_CONTENT_SIDECAR_FILE),
    ],
    reason,
  });
}

async function reconcileNoteSegmentCandidate({
  blockedSegmentIds,
  candidateDirectory,
  candidateIdentity,
  directoryName,
  memoryId,
  reviewEntries,
  rootPath,
  workspaceId,
}: {
  readonly blockedSegmentIds: ReadonlySet<string>;
  readonly candidateDirectory: string;
  readonly candidateIdentity: DirectoryIdentity;
  readonly directoryName: string;
  readonly memoryId: string;
  readonly reviewEntries?: WorkspaceReviewEntryInput[];
  readonly rootPath: string;
  readonly workspaceId: string;
}): Promise<void> {
  if (await exists(path.join(candidateDirectory, 'supplement.md'))) {
    return;
  }
  const markdown = readWorkspaceTextFileInKnownDirectory(
    candidateDirectory,
    candidateIdentity,
    'segment.md'
  );
  const candidate = parseWorkspaceMarkdownObjectCandidate({
    objectType: 'segment',
    markdown,
  });
  const candidateKind = 'kind' in candidate.data ? candidate.data.kind : undefined;
  if (candidateKind === 'audio') {
    const frontmatterId = 'id' in candidate.data ? candidate.data.id : undefined;
    const hintedId = directorySegmentIdHint(directoryName);
    const segmentId = frontmatterId ?? hintedId;
    if (!segmentId || blockedSegmentIds.has(segmentId)) {
      return;
    }
    const existingManifest = await readSegmentManifestOrNull(rootPath, segmentId);
    if (
      !existingManifest ||
      existingManifest.objectType !== 'segment' ||
      existingManifest.workspaceId !== workspaceId ||
      existingManifest.segmentId !== segmentId ||
      existingManifest.kind !== 'audio'
    ) {
      return;
    }
    if (
      existingManifest.memoryId !== memoryId &&
      (await activeSegmentDirectoryStillExists({
        memoryId: existingManifest.memoryId,
        rootPath,
        segmentId,
      }))
    ) {
      recordDiagnosticEvent({
        area: 'workspace-files',
        event: 'markdown.segment.needs-review',
        fields: {
          ambiguousCandidateCount: 0,
          duplicateIdCount: 1,
        },
        level: 'warn',
      });
      pushReviewEntry(reviewEntries, {
        category: 'markdown-segment',
        kind: 'audio',
        objectType: 'segment',
        paths: [path.join(candidateDirectory, 'segment.md')],
        reason: 'duplicate-id',
      });
      return;
    }
    let audioByteLength: number;
    try {
      audioByteLength = readFileSizeInKnownDirectory(
        candidateDirectory,
        candidateIdentity,
        'audio.webm'
      );
    } catch {
      return;
    }
    if (existingManifest.audioByteLength !== audioByteLength) {
      return;
    }
    const title = inferCandidateTitle({
      content: candidate.content,
      directoryName,
      metadataTitle: 'title' in candidate.data ? candidate.data.title : undefined,
      nodeId: segmentId,
    });
    const candidateTitle = 'title' in candidate.data ? candidate.data.title : undefined;
    if (frontmatterId !== segmentId || candidateTitle !== title) {
      await writeWorkspaceFileAtomicInKnownDirectory({
        directory: candidateDirectory,
        directoryIdentity: candidateIdentity,
        fileName: 'segment.md',
        data: renderWorkspaceMarkdownObject({
          objectType: 'segment',
          data: {
            ...candidate.data,
            id: segmentId,
            title,
            kind: 'audio',
          },
          content: candidate.content,
        }),
      });
    }
    if (existingManifest.memoryId !== memoryId || existingManifest.workspaceId !== workspaceId) {
      const timestamp = new Date().toISOString();
      await writeSegmentObjectManifest({
        rootPath,
        segment: {
          ...existingManifest,
          workspaceId,
          memoryId,
          audioByteLength,
          updatedAt: timestamp,
        },
      });
    }
    return;
  }
  if (candidateKind !== undefined && candidateKind !== 'note') {
    return;
  }

  const frontmatterId = 'id' in candidate.data ? candidate.data.id : undefined;
  const hintedId = directorySegmentIdHint(directoryName);
  const segmentId = frontmatterId ?? hintedId ?? createReconciledSegmentId();
  if (blockedSegmentIds.has(segmentId)) {
    return;
  }
  const title = inferCandidateTitle({
    content: candidate.content,
    directoryName,
    metadataTitle: 'title' in candidate.data ? candidate.data.title : undefined,
    nodeId: segmentId,
  });
  const bodyByteLength = markdownBodyByteLength(candidate.content);
  const existingManifest = await readSegmentManifestOrNull(rootPath, segmentId);
  const existingManifestMatchesIdentity =
    existingManifest &&
    existingManifest.objectType === 'segment' &&
    existingManifest.workspaceId === workspaceId &&
    existingManifest.segmentId === segmentId &&
    existingManifest.kind === 'note';
  if (existingManifest && !existingManifestMatchesIdentity) {
    return;
  }
  if (
    existingManifestMatchesIdentity &&
    existingManifest.memoryId !== memoryId &&
    (await activeSegmentDirectoryStillExists({
      memoryId: existingManifest.memoryId,
      rootPath,
      segmentId,
    }))
  ) {
    recordDiagnosticEvent({
      area: 'workspace-files',
      event: 'markdown.segment.needs-review',
      fields: {
        ambiguousCandidateCount: 0,
        duplicateIdCount: 1,
      },
      level: 'warn',
    });
    pushReviewEntry(reviewEntries, {
      category: 'markdown-segment',
      kind: 'note',
      objectType: 'segment',
      paths: [path.join(candidateDirectory, 'segment.md')],
      reason: 'duplicate-id',
    });
    return;
  }

  const candidateTitle = 'title' in candidate.data ? candidate.data.title : undefined;
  if (frontmatterId !== segmentId || candidateTitle !== title || candidateKind !== 'note') {
    await writeWorkspaceFileAtomicInKnownDirectory({
      directory: candidateDirectory,
      directoryIdentity: candidateIdentity,
      fileName: 'segment.md',
      data: renderWorkspaceMarkdownObject({
        objectType: 'segment',
        data: {
          ...candidate.data,
          id: segmentId,
          title,
          kind: 'note',
        },
        content: candidate.content,
      }),
    });
  }

  if (
    !existingManifest ||
    existingManifest.memoryId !== memoryId ||
    existingManifest.bodyByteLength !== bodyByteLength
  ) {
    await ensureWorkspaceObjectKindDirectory({ rootPath, kind: 'segments' });
    const timestamp = new Date().toISOString();
    await writeWorkspaceJsonAtomic(await segmentObjectManifestPath(rootPath, segmentId), {
      ...(existingManifest ?? {}),
      schemaVersion: 1,
      objectType: 'segment',
      workspaceId,
      memoryId,
      segmentId,
      kind: 'note',
      createdAt: existingManifest?.createdAt ?? timestamp,
      finalizedAt: existingManifest?.finalizedAt ?? timestamp,
      updatedAt: timestamp,
      bodyByteLength,
    });
  }
}

async function classifyNoteSegmentCandidatesForReview({
  entries,
  rootPath,
  segmentsDirectory,
}: {
  readonly entries: readonly Dirent[];
  readonly rootPath: string;
  readonly segmentsDirectory: string;
}): Promise<{
  readonly ambiguousCandidateCount: number;
  readonly duplicateSegmentIds: ReadonlySet<string>;
  readonly reviewEntries: readonly WorkspaceReviewEntryInput[];
}> {
  const idPaths = new Map<string, string[]>();
  let ambiguousCandidateCount = 0;
  const reviewEntries: WorkspaceReviewEntryInput[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const candidateDirectory = await resolveSafeWorkspaceChild(
        rootPath,
        path.join(segmentsDirectory, entry.name)
      );
      await assertSafeExistingDirectory(candidateDirectory, 'Segment directory is not safe');
      const candidateIdentity = await readDirectoryIdentity(candidateDirectory);
      if (await exists(path.join(candidateDirectory, 'supplement.md'))) {
        ambiguousCandidateCount += 1;
        reviewEntries.push({
          category: 'markdown-segment',
          objectType: 'segment',
          paths: [
            path.join(candidateDirectory, 'segment.md'),
            path.join(candidateDirectory, 'supplement.md'),
          ],
          reason: 'ambiguous-candidate',
        });
        continue;
      }
      const candidate = parseWorkspaceMarkdownObjectCandidate({
        objectType: 'segment',
        markdown: readWorkspaceTextFileInKnownDirectory(
          candidateDirectory,
          candidateIdentity,
          'segment.md'
        ),
      });
      const candidateKind = 'kind' in candidate.data ? candidate.data.kind : undefined;
      if (candidateKind !== undefined && candidateKind !== 'note' && candidateKind !== 'audio') {
        continue;
      }
      const candidateId =
        ('id' in candidate.data ? candidate.data.id : undefined) ??
        directorySegmentIdHint(entry.name);
      if (candidateId) {
        const paths = idPaths.get(candidateId) ?? [];
        paths.push(path.join(candidateDirectory, 'segment.md'));
        idPaths.set(candidateId, paths);
      }
    } catch {
      continue;
    }
  }

  for (const paths of idPaths.values()) {
    if (paths.length > 1) {
      reviewEntries.push({
        category: 'markdown-segment',
        objectType: 'segment',
        paths,
        reason: 'duplicate-id',
      });
    }
  }

  return {
    ambiguousCandidateCount,
    duplicateSegmentIds: new Set(
      [...idPaths.entries()].filter(([, paths]) => paths.length > 1).map(([id]) => id)
    ),
    reviewEntries,
  };
}

async function reconcileNoteSegmentsInMemoryDirectory({
  memoryDirectoryPath,
  memoryId,
  reviewEntries,
  rootPath,
}: {
  readonly memoryDirectoryPath: string;
  readonly memoryId: string;
  readonly reviewEntries?: WorkspaceReviewEntryInput[];
  readonly rootPath: string;
}): Promise<void> {
  const workspaceId = await readWorkspaceId(rootPath);
  const segmentsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(memoryDirectoryPath, 'segments')
  );
  const entries = await readExistingDirectoryEntries(segmentsDirectory);
  const review = await classifyNoteSegmentCandidatesForReview({
    entries,
    rootPath,
    segmentsDirectory,
  });
  if (review.duplicateSegmentIds.size > 0 || review.ambiguousCandidateCount > 0) {
    recordDiagnosticEvent({
      area: 'workspace-files',
      event: 'markdown.segment.needs-review',
      fields: {
        ambiguousCandidateCount: review.ambiguousCandidateCount,
        duplicateIdCount: review.duplicateSegmentIds.size,
      },
      level: 'warn',
    });
  }
  for (const entry of review.reviewEntries) {
    pushReviewEntry(reviewEntries, entry);
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const candidateDirectory = await resolveSafeWorkspaceChild(
        rootPath,
        path.join(segmentsDirectory, entry.name)
      );
      await assertSafeExistingDirectory(candidateDirectory, 'Segment directory is not safe');
      const candidateIdentity = await readDirectoryIdentity(candidateDirectory);
      await reconcileNoteSegmentCandidate({
        blockedSegmentIds: review.duplicateSegmentIds,
        candidateDirectory,
        candidateIdentity,
        directoryName: entry.name,
        memoryId,
        ...(reviewEntries ? { reviewEntries } : {}),
        rootPath,
        workspaceId,
      });
    } catch {
      continue;
    }
  }
}

async function reconcileNoteSupplementCandidate({
  blockedSupplementIds,
  candidateDirectory,
  candidateIdentity,
  directoryName,
  memoryId,
  reviewEntries,
  rootPath,
  segmentId,
  workspaceId,
}: {
  readonly blockedSupplementIds: ReadonlySet<string>;
  readonly candidateDirectory: string;
  readonly candidateIdentity: DirectoryIdentity;
  readonly directoryName: string;
  readonly memoryId: string;
  readonly reviewEntries?: WorkspaceReviewEntryInput[];
  readonly rootPath: string;
  readonly segmentId: string;
  readonly workspaceId: string;
}): Promise<void> {
  if (await exists(path.join(candidateDirectory, 'segment.md'))) {
    return;
  }
  const markdown = readWorkspaceTextFileInKnownDirectory(
    candidateDirectory,
    candidateIdentity,
    'supplement.md'
  );
  const candidate = parseWorkspaceMarkdownObjectCandidate({
    objectType: 'supplement',
    markdown,
  });
  const candidateKind = 'kind' in candidate.data ? candidate.data.kind : undefined;
  if (candidateKind === 'audio') {
    const frontmatterId = 'id' in candidate.data ? candidate.data.id : undefined;
    const hintedId = directorySupplementIdHint(directoryName);
    const supplementId = frontmatterId ?? hintedId;
    if (!supplementId || blockedSupplementIds.has(supplementId)) {
      return;
    }
    const existingManifest = await readSupplementManifestOrNull(rootPath, supplementId);
    if (
      !existingManifest ||
      existingManifest.objectType !== 'supplement' ||
      existingManifest.workspaceId !== workspaceId ||
      existingManifest.supplementId !== supplementId ||
      existingManifest.kind !== 'audio'
    ) {
      return;
    }
    if (
      (existingManifest.memoryId !== memoryId || existingManifest.segmentId !== segmentId) &&
      (await activeSupplementDirectoryStillExists({
        memoryId: existingManifest.memoryId,
        rootPath,
        segmentId: existingManifest.segmentId,
        supplementId,
      }))
    ) {
      recordDiagnosticEvent({
        area: 'workspace-files',
        event: 'markdown.supplement.needs-review',
        fields: {
          ambiguousCandidateCount: 0,
          duplicateIdCount: 1,
        },
        level: 'warn',
      });
      pushReviewEntry(reviewEntries, {
        category: 'markdown-supplement',
        kind: 'audio',
        objectType: 'supplement',
        paths: [path.join(candidateDirectory, 'supplement.md')],
        reason: 'duplicate-id',
      });
      return;
    }
    let audioByteLength: number;
    try {
      audioByteLength = readFileSizeInKnownDirectory(
        candidateDirectory,
        candidateIdentity,
        'audio.webm'
      );
    } catch {
      return;
    }
    if (existingManifest.audioByteLength !== audioByteLength) {
      return;
    }
    const title = inferCandidateTitle({
      content: candidate.content,
      directoryName,
      metadataTitle: 'title' in candidate.data ? candidate.data.title : undefined,
      nodeId: supplementId,
    });
    const candidateTitle = 'title' in candidate.data ? candidate.data.title : undefined;
    if (frontmatterId !== supplementId || candidateTitle !== title) {
      await writeWorkspaceFileAtomicInKnownDirectory({
        directory: candidateDirectory,
        directoryIdentity: candidateIdentity,
        fileName: 'supplement.md',
        data: renderWorkspaceMarkdownObject({
          objectType: 'supplement',
          data: {
            ...candidate.data,
            id: supplementId,
            title,
            kind: 'audio',
          },
          content: candidate.content,
        }),
      });
    }
    if (
      existingManifest.memoryId !== memoryId ||
      existingManifest.segmentId !== segmentId ||
      existingManifest.workspaceId !== workspaceId
    ) {
      const timestamp = new Date().toISOString();
      await writeSupplementObjectManifest({
        rootPath,
        supplement: {
          ...existingManifest,
          workspaceId,
          memoryId,
          segmentId,
          audioByteLength,
          updatedAt: timestamp,
        },
      });
    }
    return;
  }
  if (candidateKind !== undefined && candidateKind !== 'note') {
    return;
  }

  const frontmatterId = 'id' in candidate.data ? candidate.data.id : undefined;
  const hintedId = directorySupplementIdHint(directoryName);
  const supplementId = frontmatterId ?? hintedId ?? createReconciledSupplementId();
  if (blockedSupplementIds.has(supplementId)) {
    return;
  }
  const title = inferCandidateTitle({
    content: candidate.content,
    directoryName,
    metadataTitle: 'title' in candidate.data ? candidate.data.title : undefined,
    nodeId: supplementId,
  });
  const bodyByteLength = markdownBodyByteLength(candidate.content);
  const existingManifest = await readSupplementManifestOrNull(rootPath, supplementId);
  const existingManifestMatchesIdentity =
    existingManifest &&
    existingManifest.objectType === 'supplement' &&
    existingManifest.workspaceId === workspaceId &&
    existingManifest.supplementId === supplementId &&
    existingManifest.kind === 'note';
  if (existingManifest && !existingManifestMatchesIdentity) {
    return;
  }
  if (
    existingManifestMatchesIdentity &&
    (existingManifest.memoryId !== memoryId || existingManifest.segmentId !== segmentId) &&
    (await activeSupplementDirectoryStillExists({
      memoryId: existingManifest.memoryId,
      rootPath,
      segmentId: existingManifest.segmentId,
      supplementId,
    }))
  ) {
    recordDiagnosticEvent({
      area: 'workspace-files',
      event: 'markdown.supplement.needs-review',
      fields: {
        ambiguousCandidateCount: 0,
        duplicateIdCount: 1,
      },
      level: 'warn',
    });
    pushReviewEntry(reviewEntries, {
      category: 'markdown-supplement',
      kind: 'note',
      objectType: 'supplement',
      paths: [path.join(candidateDirectory, 'supplement.md')],
      reason: 'duplicate-id',
    });
    return;
  }

  const candidateTitle = 'title' in candidate.data ? candidate.data.title : undefined;
  if (frontmatterId !== supplementId || candidateTitle !== title || candidateKind !== 'note') {
    await writeWorkspaceFileAtomicInKnownDirectory({
      directory: candidateDirectory,
      directoryIdentity: candidateIdentity,
      fileName: 'supplement.md',
      data: renderWorkspaceMarkdownObject({
        objectType: 'supplement',
        data: {
          ...candidate.data,
          id: supplementId,
          title,
          kind: 'note',
        },
        content: candidate.content,
      }),
    });
  }

  if (
    !existingManifest ||
    existingManifest.memoryId !== memoryId ||
    existingManifest.segmentId !== segmentId ||
    existingManifest.bodyByteLength !== bodyByteLength
  ) {
    await ensureWorkspaceObjectKindDirectory({ rootPath, kind: 'supplements' });
    const timestamp = new Date().toISOString();
    await writeWorkspaceJsonAtomic(await supplementObjectManifestPath(rootPath, supplementId), {
      ...(existingManifest ?? {}),
      schemaVersion: 1,
      objectType: 'supplement',
      workspaceId,
      memoryId,
      segmentId,
      supplementId,
      kind: 'note',
      createdAt: existingManifest?.createdAt ?? timestamp,
      finalizedAt: existingManifest?.finalizedAt ?? timestamp,
      updatedAt: timestamp,
      bodyByteLength,
    });
  }
}

async function classifyNoteSupplementCandidatesForReview({
  entries,
  rootPath,
  supplementsDirectory,
}: {
  readonly entries: readonly Dirent[];
  readonly rootPath: string;
  readonly supplementsDirectory: string;
}): Promise<{
  readonly ambiguousCandidateCount: number;
  readonly duplicateSupplementIds: ReadonlySet<string>;
  readonly reviewEntries: readonly WorkspaceReviewEntryInput[];
}> {
  const idPaths = new Map<string, string[]>();
  let ambiguousCandidateCount = 0;
  const reviewEntries: WorkspaceReviewEntryInput[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const candidateDirectory = await resolveSafeWorkspaceChild(
        rootPath,
        path.join(supplementsDirectory, entry.name)
      );
      await assertSafeExistingDirectory(
        candidateDirectory,
        'Segment supplement directory is not safe'
      );
      const candidateIdentity = await readDirectoryIdentity(candidateDirectory);
      if (await exists(path.join(candidateDirectory, 'segment.md'))) {
        ambiguousCandidateCount += 1;
        reviewEntries.push({
          category: 'markdown-supplement',
          objectType: 'supplement',
          paths: [
            path.join(candidateDirectory, 'segment.md'),
            path.join(candidateDirectory, 'supplement.md'),
          ],
          reason: 'ambiguous-candidate',
        });
        continue;
      }
      const candidate = parseWorkspaceMarkdownObjectCandidate({
        objectType: 'supplement',
        markdown: readWorkspaceTextFileInKnownDirectory(
          candidateDirectory,
          candidateIdentity,
          'supplement.md'
        ),
      });
      const candidateKind = 'kind' in candidate.data ? candidate.data.kind : undefined;
      if (candidateKind !== undefined && candidateKind !== 'note' && candidateKind !== 'audio') {
        continue;
      }
      const candidateId =
        ('id' in candidate.data ? candidate.data.id : undefined) ??
        directorySupplementIdHint(entry.name);
      if (candidateId) {
        const paths = idPaths.get(candidateId) ?? [];
        paths.push(path.join(candidateDirectory, 'supplement.md'));
        idPaths.set(candidateId, paths);
      }
    } catch {
      continue;
    }
  }

  for (const paths of idPaths.values()) {
    if (paths.length > 1) {
      reviewEntries.push({
        category: 'markdown-supplement',
        objectType: 'supplement',
        paths,
        reason: 'duplicate-id',
      });
    }
  }

  return {
    ambiguousCandidateCount,
    duplicateSupplementIds: new Set(
      [...idPaths.entries()].filter(([, paths]) => paths.length > 1).map(([id]) => id)
    ),
    reviewEntries,
  };
}

async function reconcileNoteSupplementsInSegmentDirectory({
  memoryId,
  recordingDirectory,
  reviewEntries,
  rootPath,
  segmentId,
  workspaceId,
}: {
  readonly memoryId: string;
  readonly recordingDirectory: string;
  readonly reviewEntries?: WorkspaceReviewEntryInput[];
  readonly rootPath: string;
  readonly segmentId: string;
  readonly workspaceId: string;
}): Promise<void> {
  const supplementsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(recordingDirectory, 'supplements')
  );
  const entries = await readExistingDirectoryEntries(supplementsDirectory);
  const review = await classifyNoteSupplementCandidatesForReview({
    entries,
    rootPath,
    supplementsDirectory,
  });
  if (review.duplicateSupplementIds.size > 0 || review.ambiguousCandidateCount > 0) {
    recordDiagnosticEvent({
      area: 'workspace-files',
      event: 'markdown.supplement.needs-review',
      fields: {
        ambiguousCandidateCount: review.ambiguousCandidateCount,
        duplicateIdCount: review.duplicateSupplementIds.size,
      },
      level: 'warn',
    });
  }
  for (const entry of review.reviewEntries) {
    pushReviewEntry(reviewEntries, entry);
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const candidateDirectory = await resolveSafeWorkspaceChild(
        rootPath,
        path.join(supplementsDirectory, entry.name)
      );
      await assertSafeExistingDirectory(
        candidateDirectory,
        'Segment supplement directory is not safe'
      );
      const candidateIdentity = await readDirectoryIdentity(candidateDirectory);
      await reconcileNoteSupplementCandidate({
        blockedSupplementIds: review.duplicateSupplementIds,
        candidateDirectory,
        candidateIdentity,
        directoryName: entry.name,
        memoryId,
        ...(reviewEntries ? { reviewEntries } : {}),
        rootPath,
        segmentId,
        workspaceId,
      });
    } catch {
      continue;
    }
  }
}

function fileSpaceNodeDirectoryName(nodeId: string, title: string): string {
  const trimmedTitle = title.trim();
  if (!trimmedTitle || !isSafeWorkspaceDirectoryName(trimmedTitle)) {
    throw new Error('Invalid file-space node title');
  }
  return `${nodeId}--${trimmedTitle}`;
}

function fileSpaceNodeDirectoryNameMatchesId(directoryName: string, nodeId: string): boolean {
  return directoryName === nodeId || directoryName.startsWith(`${nodeId}--`);
}

function titleFromFileSpaceDirectoryName({
  nodeId,
  directoryName,
  metadataTitle,
}: {
  readonly nodeId: string;
  readonly directoryName: string;
  readonly metadataTitle: string;
}): string {
  if (directoryName === nodeId) {
    return metadataTitle;
  }
  const generatedPrefix = `${nodeId}--`;
  if (directoryName.startsWith(generatedPrefix)) {
    const title = directoryName.slice(generatedPrefix.length).trim();
    return title || metadataTitle;
  }
  return directoryName;
}

async function ensureWorkspaceObjectsDirectory(
  rootPath: string,
  assertUsable?: AssertWorkspaceUsable
): Promise<string> {
  const reoDirectory = await resolveSafeWorkspaceChild(rootPath, path.join(rootPath, '.reo'));
  await assertSafeExistingDirectory(reoDirectory, 'Workspace .reo directory is not safe');
  assertWorkspaceUsable(assertUsable);
  createWorkspaceDirectoryWithinParent({
    parentDirectory: reoDirectory,
    directoryName: 'objects',
    allowExisting: true,
    ...(assertUsable ? { beforeCommit: () => assertWorkspaceUsable(assertUsable) } : {}),
  });
  return path.join(reoDirectory, 'objects');
}

async function ensureWorkspaceObjectKindDirectory({
  assertUsable,
  kind,
  rootPath,
}: {
  readonly assertUsable?: AssertWorkspaceUsable;
  readonly kind: 'memories' | 'segments' | 'supplements';
  readonly rootPath: string;
}): Promise<string> {
  const objectsDirectory = await ensureWorkspaceObjectsDirectory(rootPath, assertUsable);
  assertWorkspaceUsable(assertUsable);
  createWorkspaceDirectoryWithinParent({
    parentDirectory: objectsDirectory,
    directoryName: kind,
    allowExisting: true,
    ...(assertUsable ? { beforeCommit: () => assertWorkspaceUsable(assertUsable) } : {}),
  });
  return path.join(objectsDirectory, kind);
}

async function workspaceObjectManifestPath(
  rootPath: string,
  kind: 'memories' | 'segments' | 'supplements',
  objectId: string
): Promise<string> {
  const objectsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, '.reo', 'objects', kind)
  );
  return resolveSafeWorkspaceChild(rootPath, path.join(objectsDirectory, `${objectId}.json`));
}

async function memoryObjectManifestPath(rootPath: string, memoryId: string): Promise<string> {
  return workspaceObjectManifestPath(rootPath, 'memories', memoryId);
}

async function readMemoryObjectManifest(
  rootPath: string,
  memoryId: string
): Promise<MemoryObjectManifest> {
  return memoryObjectManifestSchema.parse(
    JSON.parse(await readWorkspaceTextFile(await memoryObjectManifestPath(rootPath, memoryId)))
  );
}

async function writeMemoryObjectManifestNoReplace({
  assertUsable,
  memory,
  rootPath,
}: {
  readonly assertUsable?: AssertWorkspaceUsable;
  readonly memory: MemoryObjectManifest;
  readonly rootPath: string;
}): Promise<void> {
  await ensureWorkspaceObjectKindDirectory({
    rootPath,
    kind: 'memories',
    ...(assertUsable ? { assertUsable } : {}),
  });
  assertWorkspaceUsable(assertUsable);
  await writeWorkspaceFileNoReplaceAtomic(
    await memoryObjectManifestPath(rootPath, memory.memoryId),
    `${JSON.stringify(memory, null, 2)}\n`,
    assertUsable ? () => assertWorkspaceUsable(assertUsable) : undefined
  );
}

async function segmentObjectManifestPath(rootPath: string, segmentId: string): Promise<string> {
  return workspaceObjectManifestPath(rootPath, 'segments', segmentId);
}

async function supplementObjectManifestPath(
  rootPath: string,
  supplementId: string
): Promise<string> {
  return workspaceObjectManifestPath(rootPath, 'supplements', supplementId);
}

function renderMemoryMarkdown(title: string): string {
  return renderWorkspaceMarkdownObject({
    objectType: 'memory',
    data: { title },
    content: `# ${title}\n`,
  });
}

function segmentMarkdownContent({
  title,
  transcript = '',
}: {
  readonly title: string;
  readonly transcript?: string;
}): string {
  return `# ${title}\n\n## Transcript\n\n${transcript}`;
}

function renderSegmentMarkdown({
  title,
  transcript,
}: {
  readonly title: string;
  readonly transcript?: string;
}): string {
  return renderWorkspaceMarkdownObject({
    objectType: 'segment',
    data: { title, kind: 'audio' },
    content: segmentMarkdownContent({
      title,
      ...(transcript !== undefined ? { transcript } : {}),
    }),
  });
}

function renderSupplementMarkdown({
  title,
  transcript,
}: {
  readonly title: string;
  readonly transcript?: string;
}): string {
  return renderWorkspaceMarkdownObject({
    objectType: 'supplement',
    data: { title, kind: 'audio' },
    content: segmentMarkdownContent({
      title,
      ...(transcript !== undefined ? { transcript } : {}),
    }),
  });
}

export function extractSegmentTranscript(markdownContent: string): string {
  const heading = /^## Transcript[ \t]*(?:\r?\n|$)/m.exec(markdownContent);
  if (!heading) {
    return '';
  }
  const bodyStart = heading.index + heading[0].length;
  const body = removeHtmlComments(markdownContent.slice(bodyStart));
  return body.replace(/^\r?\n/, '').replace(/\s+$/, '');
}

function removeHtmlComments(markdownContent: string): string {
  let cursor = 0;
  let visible = '';
  while (cursor < markdownContent.length) {
    const commentStart = markdownContent.indexOf('<!--', cursor);
    if (commentStart === -1) {
      return `${visible}${markdownContent.slice(cursor)}`;
    }
    visible += markdownContent.slice(cursor, commentStart);
    const commentEnd = markdownContent.indexOf('-->', commentStart + 4);
    if (commentEnd === -1) {
      return visible;
    }
    cursor = commentEnd + 3;
  }
  return visible;
}

export function replaceSegmentTranscript(markdownContent: string, transcript: string): string {
  const replacement = `## Transcript\n\n${transcript}`;
  const heading = /^## Transcript[ \t]*(?:\r?\n|$)/m.exec(markdownContent);
  if (heading) {
    return `${markdownContent.slice(0, heading.index)}${replacement}`;
  }
  const trimmed = markdownContent.replace(/\s+$/, '');
  return `${trimmed}\n\n${replacement}`;
}

async function writeMemoryMarkdownAndManifest({
  assertUsable,
  memory,
  memoryDirectoryPath,
  rootPath,
}: {
  readonly assertUsable?: AssertWorkspaceUsable;
  readonly memory: MemoryObjectManifest & { readonly title: string };
  readonly memoryDirectoryPath: string;
  readonly rootPath: string;
}): Promise<void> {
  await ensureWorkspaceObjectKindDirectory({
    rootPath,
    kind: 'memories',
    ...(assertUsable ? { assertUsable } : {}),
  });
  assertWorkspaceUsable(assertUsable);
  await writeWorkspaceFileAtomic(
    path.join(memoryDirectoryPath, 'memory.md'),
    renderMemoryMarkdown(memory.title),
    assertUsable ? () => assertWorkspaceUsable(assertUsable) : undefined
  );
  assertWorkspaceUsable(assertUsable);
  await writeWorkspaceJsonAtomic(
    await memoryObjectManifestPath(rootPath, memory.memoryId),
    {
      schemaVersion: 1,
      objectType: 'memory',
      memoryId: memory.memoryId,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    },
    assertUsable ? () => assertWorkspaceUsable(assertUsable) : undefined
  );
}

async function writeSegmentObjectManifest({
  rootPath,
  segment,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly segment: SegmentObjectManifest;
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<void> {
  await ensureWorkspaceObjectKindDirectory({
    rootPath,
    kind: 'segments',
    ...(assertUsable ? { assertUsable } : {}),
  });
  assertWorkspaceUsable(assertUsable);
  await writeWorkspaceJsonAtomic(
    await segmentObjectManifestPath(rootPath, segment.segmentId),
    segment,
    assertUsable ? () => assertWorkspaceUsable(assertUsable) : undefined
  );
}

async function writeSupplementObjectManifest({
  rootPath,
  supplement,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly supplement: SupplementObjectManifest;
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<void> {
  await ensureWorkspaceObjectKindDirectory({
    rootPath,
    kind: 'supplements',
    ...(assertUsable ? { assertUsable } : {}),
  });
  assertWorkspaceUsable(assertUsable);
  await writeWorkspaceJsonAtomic(
    await supplementObjectManifestPath(rootPath, supplement.supplementId),
    supplement,
    assertUsable ? () => assertWorkspaceUsable(assertUsable) : undefined
  );
}

async function markTranscriptionAttemptSuccess<
  T extends SegmentObjectManifest | SupplementObjectManifest,
>({
  manifestPath,
  parseManifest,
  validateManifest,
  writeManifest,
}: {
  readonly manifestPath: string;
  readonly parseManifest: (manifest: unknown) => T;
  readonly validateManifest: (manifest: T) => void;
  readonly writeManifest: (manifest: T) => Promise<void>;
}): Promise<void> {
  const manifest = parseManifest(JSON.parse(await readWorkspaceTextFile(manifestPath)));
  validateManifest(manifest);
  await writeManifest({
    ...manifest,
    lastTranscriptionAttempt: 'success',
  });
}

export async function markSegmentTranscriptionAttemptSuccess({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<void> {
  await markTranscriptionAttemptSuccess({
    manifestPath: await segmentObjectManifestPath(rootPath, segmentId),
    parseManifest: (manifest) => segmentObjectManifestSchema.parse(manifest),
    validateManifest: (segment) => {
      if (
        segment.workspaceId !== workspaceId ||
        segment.memoryId !== memoryId ||
        segment.segmentId !== segmentId
      ) {
        throw workspaceError(
          'ERR_WORKSPACE_METADATA_INVALID',
          'Segment transcription attempt manifest ownership mismatch',
          'file-written-index-stale'
        );
      }
    },
    writeManifest: (segment) =>
      writeSegmentObjectManifest({
        rootPath,
        segment,
        ...(assertUsable ? { assertUsable } : {}),
      }),
  });
}

export async function markSupplementTranscriptionAttemptSuccess({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  supplementId,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<void> {
  await markTranscriptionAttemptSuccess({
    manifestPath: await supplementObjectManifestPath(rootPath, supplementId),
    parseManifest: (manifest) => supplementObjectManifestSchema.parse(manifest),
    validateManifest: (supplement) => {
      if (
        supplement.workspaceId !== workspaceId ||
        supplement.memoryId !== memoryId ||
        supplement.segmentId !== segmentId ||
        supplement.supplementId !== supplementId
      ) {
        throw workspaceError(
          'ERR_WORKSPACE_METADATA_INVALID',
          'Segment supplement transcription attempt manifest ownership mismatch',
          'file-written-index-stale'
        );
      }
    },
    writeManifest: (supplement) =>
      writeSupplementObjectManifest({
        rootPath,
        supplement,
        ...(assertUsable ? { assertUsable } : {}),
      }),
  });
}

function latestIsoTimestamp(...timestamps: readonly string[]): string {
  return timestamps.reduce((latest, current) =>
    current.localeCompare(latest) > 0 ? current : latest
  );
}

function compareProjectedUpdatedAt(
  first: { readonly updatedAt: string; readonly createdAt: string },
  second: { readonly updatedAt: string; readonly createdAt: string }
): number {
  const updatedComparison = second.updatedAt.localeCompare(first.updatedAt);
  if (updatedComparison !== 0) {
    return updatedComparison;
  }
  return second.createdAt.localeCompare(first.createdAt);
}

function sortByProjectedUpdatedAt<
  T extends { readonly updatedAt: string; readonly createdAt: string },
>(items: readonly T[]): T[] {
  return [...items].sort(compareProjectedUpdatedAt);
}

function upsertMemorySummaryByProjectedOrder(
  memories: readonly MemorySummary[],
  summary: MemorySummary
): MemorySummary[] {
  const nextMemories: MemorySummary[] = [];
  let inserted = false;
  for (const memory of memories) {
    if (memory.memoryId === summary.memoryId) {
      continue;
    }
    if (!inserted && compareProjectedUpdatedAt(summary, memory) <= 0) {
      nextMemories.push(summary);
      inserted = true;
    }
    nextMemories.push(memory);
  }
  if (!inserted) {
    nextMemories.push(summary);
  }
  return nextMemories;
}

async function touchWorkspacePathBestEffort(targetPath: string, timestamp: string): Promise<void> {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) {
    return;
  }
  await utimes(targetPath, date, date).catch(() => {});
}

async function hasFinalizeTransactionMarker(recordingDirectory: string): Promise<boolean> {
  try {
    const marker = await lstat(path.join(recordingDirectory, FINALIZE_TRANSACTION_MARKER));
    return marker.isFile() && !marker.isSymbolicLink();
  } catch {
    return false;
  }
}

async function finalizedPayloadExists(directory: string): Promise<boolean> {
  return (
    (await exists(path.join(directory, 'segment.md'))) ||
    (await exists(path.join(directory, 'audio.webm')))
  );
}

async function finalizedSupplementPayloadExists(directory: string): Promise<boolean> {
  return (
    (await exists(path.join(directory, 'supplement.md'))) ||
    (await exists(path.join(directory, 'audio.webm')))
  );
}

async function unlinkFinalizeTransactionMarker(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<string> {
  const recordingDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
  await unlinkFinalizeTransactionMarkerInDirectory(recordingDirectory);
  return recordingDirectory;
}

async function unlinkFinalizeTransactionMarkerInDirectory(directory: string): Promise<void> {
  const directoryIdentity = await readDirectoryIdentity(
    directory,
    'Recording target path is not safe'
  );
  runInWorkspaceDirectorySync({ directory, directoryIdentity }, () => {
    assertSameCurrentDirectory(directoryIdentity);
    unlinkSync(FINALIZE_TRANSACTION_MARKER);
    assertSameCurrentDirectory(directoryIdentity);
    fsyncCurrentWorkspaceDirectoryBestEffort();
  });
}

async function withMemoryWriteLock<T>(
  rootPath: string,
  memoryId: string,
  write: () => Promise<T>
): Promise<T> {
  const key = `${path.resolve(rootPath)}:${memoryId}`;
  if (inFlightMemoryWrites.has(key)) {
    throw new Error('Memory write already in flight');
  }
  inFlightMemoryWrites.add(key);
  try {
    return await write();
  } finally {
    inFlightMemoryWrites.delete(key);
  }
}

async function withWorkspaceIndexWriteLock<T>(
  rootPath: string,
  write: () => Promise<T>
): Promise<T> {
  const key = path.resolve(rootPath);
  const previous = workspaceIndexWriteQueues.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = previous
    .catch(() => {})
    .then(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
  workspaceIndexWriteQueues.set(key, current);
  await previous.catch(() => {});
  try {
    return await write();
  } finally {
    release();
    if (workspaceIndexWriteQueues.get(key) === current) {
      workspaceIndexWriteQueues.delete(key);
    }
  }
}

async function fsyncDirectoryTree(directoryPath: string): Promise<void> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    const metadata = await lstat(entryPath);
    if (metadata.isSymbolicLink()) {
      throw new Error('Workspace transaction path crosses a symlink');
    }
    if (metadata.isDirectory()) {
      await fsyncDirectoryTree(entryPath);
      continue;
    }
    if (metadata.isFile()) {
      await fsyncWorkspaceFile(entryPath);
    }
  }
  await fsyncWorkspaceDirectory(directoryPath);
}

async function readMemoryFileTruthFromDirectory(
  rootPath: string,
  directory: string,
  {
    assertWorkspaceUsable: assertUsable,
    repairMissingManifest = false,
  }: {
    readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
    readonly repairMissingManifest?: boolean;
  } = {}
): Promise<MemoryFileTruth> {
  const directoryName = path.basename(directory);
  const memoryId = directoryName.split('--')[0] ?? '';
  if (!MEMORY_ID_PATTERN.test(memoryId)) {
    throw new Error('Invalid memory id');
  }
  const object = parseWorkspaceMarkdownObject({
    objectType: 'memory',
    markdown: await readWorkspaceTextFile(path.join(directory, 'memory.md')),
  });
  let manifest: MemoryObjectManifest;
  try {
    manifest = await readMemoryObjectManifest(rootPath, memoryId);
  } catch (error) {
    if (!repairMissingManifest || !isMissingFileError(error)) {
      throw error;
    }
    const memoryMarkdownStats = await lstat(path.join(directory, 'memory.md'));
    const repairedAt = memoryMarkdownStats.mtime.toISOString();
    const repairedManifest: MemoryObjectManifest = {
      schemaVersion: 1,
      objectType: 'memory',
      memoryId,
      createdAt: repairedAt,
      updatedAt: repairedAt,
    };
    try {
      await writeMemoryObjectManifestNoReplace({
        rootPath,
        memory: repairedManifest,
        ...(assertUsable ? { assertUsable } : {}),
      });
      manifest = repairedManifest;
    } catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw writeError;
      }
      manifest = await readMemoryObjectManifest(rootPath, memoryId);
    }
  }
  if (manifest.memoryId !== memoryId) {
    throw new Error('Memory manifest does not match file truth');
  }
  return {
    memoryId: manifest.memoryId,
    title: object.data.title,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt,
  };
}

async function memoryDirectoryInParent({
  defaultDirectoryName,
  memoryId,
  parentDirectory,
  rootPath,
}: {
  readonly defaultDirectoryName: string;
  readonly memoryId: string;
  readonly parentDirectory: string;
  readonly rootPath: string;
}): Promise<string> {
  if (!MEMORY_ID_PATTERN.test(memoryId)) {
    throw new Error('Invalid memory id');
  }
  return findFileSpaceNodeDirectoryInParent({
    beforeScan: (safeParentDirectory) =>
      beforeMemoryDirectoryCandidateScanForTest?.({
        parentDirectory: safeParentDirectory,
        memoryId,
      }),
    defaultDirectoryName,
    duplicateMessage: 'Duplicate memory id',
    matchesCandidate: async (candidate) => {
      const memory = await readMemoryFileTruthFromDirectory(rootPath, candidate);
      return memory.memoryId === memoryId;
    },
    nodeId: memoryId,
    parentDirectory,
    rootPath,
    unsafeMessage: 'Workspace memory directory is not safe',
  });
}

async function memoryDirectory(rootPath: string, memoryId: string): Promise<string> {
  return memoryDirectoryInParent({
    defaultDirectoryName: memoryId,
    memoryId,
    parentDirectory: path.join(rootPath, 'memories'),
    rootPath,
  });
}

export async function resolveMemoryDirectory(rootPath: string, memoryId: string): Promise<string> {
  return memoryDirectory(rootPath, memoryId);
}

export async function resolveMemoryDirectoryForEntityAction(
  rootPath: string,
  memoryId: string
): Promise<string> {
  if (!MEMORY_ID_PATTERN.test(memoryId)) {
    throw new Error('Invalid memory id');
  }

  let actionManifest: MemoryObjectManifest | null | undefined;
  const readActionManifest = async () => {
    if (actionManifest === undefined) {
      actionManifest = await readMemoryObjectManifest(rootPath, memoryId).catch(() => null);
    }

    return actionManifest;
  };

  return findFileSpaceNodeDirectoryInParent({
    defaultDirectoryName: memoryId,
    duplicateMessage: 'Duplicate memory id',
    matchesCandidate: async (candidate) => {
      try {
        const memory = await readMemoryFileTruthFromDirectory(rootPath, candidate);
        return memory.memoryId === memoryId;
      } catch (error) {
        if (isUnsafeWorkspacePathError(error)) {
          throw error;
        }

        return false;
      }
    },
    matchesFallbackCandidate: async (candidate) => {
      if (!fileSpaceNodeDirectoryNameMatchesId(path.basename(candidate), memoryId)) {
        return false;
      }
      if (await exists(path.join(candidate, 'memory.md'))) {
        return false;
      }

      const manifest = await readActionManifest();
      return manifest?.memoryId === memoryId;
    },
    nodeId: memoryId,
    parentDirectory: path.join(rootPath, 'memories'),
    rootPath,
    unsafeMessage: 'Workspace memory directory is not safe',
  });
}

async function trashedMemoryDirectory(rootPath: string, memoryId: string): Promise<string> {
  return memoryDirectoryInParent({
    defaultDirectoryName: memoryId,
    memoryId,
    parentDirectory: path.join(rootPath, '.reo', 'trash', 'memories'),
    rootPath,
  });
}

async function memoryDirectoryForNewNode(
  rootPath: string,
  memoryId: string,
  title: string
): Promise<string> {
  return resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories', fileSpaceNodeDirectoryName(memoryId, title))
  );
}

async function memoryDirectoryForWriteTarget(
  rootPath: string,
  memoryId: string,
  titleForNewNode?: string
): Promise<string> {
  const currentDirectory = await memoryDirectory(rootPath, memoryId);
  if (await exists(currentDirectory)) {
    return currentDirectory;
  }
  return titleForNewNode
    ? memoryDirectoryForNewNode(rootPath, memoryId, titleForNewNode)
    : currentDirectory;
}

async function assertSafeExistingDirectory(directoryPath: string, message: string): Promise<void> {
  const entry = await lstat(directoryPath);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error(message);
  }
}

function renameWorkspaceDirectoryWithinParent({
  parentDirectory,
  sourceName,
  targetName,
  beforeCommit,
  afterTargetPreflight,
  afterLastTargetPreflight,
}: {
  readonly parentDirectory: string;
  readonly sourceName: string;
  readonly targetName: string;
  readonly beforeCommit?: () => void;
  readonly afterTargetPreflight?: () => void;
  readonly afterLastTargetPreflight?: () => void;
}): void {
  const parentIdentity = readDirectoryIdentitySync(parentDirectory);
  const previousCwd = process.cwd();
  try {
    process.chdir(parentDirectory);
    const assertTargetMissing = () => {
      try {
        lstatSync(targetName);
        throw new Error('Recording target already exists');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    };
    assertSameCurrentDirectory(parentIdentity);
    assertSameDirectoryPath(parentDirectory, parentIdentity);
    assertSameCurrentDirectory(parentIdentity);
    const sourceIdentity = readDirectoryIdentitySync(
      sourceName,
      'Recording staging path is not safe'
    );
    beforeCommit?.();
    assertSameCurrentDirectory(parentIdentity);
    assertSameDirectoryPath(parentDirectory, parentIdentity);
    assertTargetMissing();
    afterTargetPreflight?.();
    assertSameCurrentDirectory(parentIdentity);
    assertSameDirectoryPath(parentDirectory, parentIdentity);
    assertTargetMissing();
    assertSameDirectoryPath(sourceName, sourceIdentity, 'Recording staging path changed');
    afterLastTargetPreflight?.();
    mkdirSync(targetName);
    let targetCreated = true;
    const targetIdentity = readDirectoryIdentitySync(
      targetName,
      'Recording target path is not safe'
    );
    try {
      renameSync(
        path.join(sourceName, FINALIZE_TRANSACTION_MARKER),
        path.join(targetName, FINALIZE_TRANSACTION_MARKER)
      );
      for (const entryName of readdirSync(sourceName)) {
        renameSync(path.join(sourceName, entryName), path.join(targetName, entryName));
      }
      rmdirSync(sourceName);
      targetCreated = false;
    } catch (error) {
      if (targetCreated) {
        assertSameDirectoryPath(targetName, targetIdentity, 'Recording target path changed');
        rmSync(targetName, { recursive: true, force: true });
      }
      throw error;
    }
    assertSameDirectoryPath(targetName, targetIdentity, 'Recording target path changed');
    assertSameDirectoryPath(parentDirectory, parentIdentity);
    assertSameCurrentDirectory(parentIdentity);
    fsyncCurrentWorkspaceDirectoryBestEffort();
  } finally {
    process.chdir(previousCwd);
  }
}

function renameWorkspaceDirectoryAcrossParents({
  sourceParentDirectory,
  sourceName,
  targetParentDirectory,
  targetName,
  beforeCommit,
  expectedSourceIdentity,
}: {
  readonly sourceParentDirectory: string;
  readonly sourceName: string;
  readonly targetParentDirectory: string;
  readonly targetName: string;
  readonly beforeCommit?: () => void;
  readonly expectedSourceIdentity?: DirectoryIdentity;
}): void {
  const sourceParentIdentity = readDirectoryIdentitySync(sourceParentDirectory);
  const targetParentIdentity = readDirectoryIdentitySync(targetParentDirectory);
  const targetPath = path.join(targetParentDirectory, targetName);
  const assertTargetMissing = () => {
    try {
      lstatSync(targetPath);
      throw new Error('Memory target already exists');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  };
  const previousCwd = process.cwd();
  try {
    process.chdir(sourceParentDirectory);
    assertSameCurrentDirectory(sourceParentIdentity);
    assertSameDirectoryPath(sourceParentDirectory, sourceParentIdentity);
    assertSameDirectoryPath(targetParentDirectory, targetParentIdentity);
    const sourceIdentity =
      expectedSourceIdentity ??
      readDirectoryIdentitySync(sourceName, 'Memory source path is not safe');
    if (expectedSourceIdentity) {
      assertSameDirectoryPath(sourceName, expectedSourceIdentity, 'Memory source path changed');
    }
    assertTargetMissing();
    beforeCommit?.();
    assertSameCurrentDirectory(sourceParentIdentity);
    assertSameDirectoryPath(sourceParentDirectory, sourceParentIdentity);
    assertSameDirectoryPath(targetParentDirectory, targetParentIdentity);
    assertSameDirectoryPath(sourceName, sourceIdentity, 'Memory source path changed');
    assertTargetMissing();
    renameSync(sourceName, targetPath);
    assertSameDirectoryPath(targetPath, sourceIdentity, 'Memory target path changed');
    assertSameCurrentDirectory(sourceParentIdentity);
    fsyncCurrentWorkspaceDirectoryBestEffort();
    process.chdir(targetParentDirectory);
    assertSameCurrentDirectory(targetParentIdentity);
    fsyncCurrentWorkspaceDirectoryBestEffort();
  } finally {
    process.chdir(previousCwd);
  }
}

async function ensureTrashNodeDirectory({
  assertUsable,
  directoryName,
  directoryUnsafeMessage,
  rootPath,
}: {
  readonly assertUsable?: AssertWorkspaceUsable;
  readonly directoryName: string;
  readonly directoryUnsafeMessage: string;
  readonly rootPath: string;
}): Promise<string> {
  const reoDirectory = await resolveSafeWorkspaceChild(rootPath, path.join(rootPath, '.reo'));
  await assertSafeExistingDirectory(reoDirectory, 'Workspace .reo directory is not safe');
  assertWorkspaceUsable(assertUsable);
  createWorkspaceDirectoryWithinParent({
    parentDirectory: reoDirectory,
    directoryName: 'trash',
    allowExisting: true,
    ...(assertUsable ? { beforeCommit: () => assertWorkspaceUsable(assertUsable) } : {}),
  });
  const trashDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, '.reo', 'trash')
  );
  await assertSafeExistingDirectory(trashDirectory, 'Workspace trash directory is not safe');
  assertWorkspaceUsable(assertUsable);
  createWorkspaceDirectoryWithinParent({
    parentDirectory: trashDirectory,
    directoryName,
    allowExisting: true,
    ...(assertUsable ? { beforeCommit: () => assertWorkspaceUsable(assertUsable) } : {}),
  });
  const nodeTrashDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, '.reo', 'trash', directoryName)
  );
  await assertSafeExistingDirectory(nodeTrashDirectory, directoryUnsafeMessage);
  return nodeTrashDirectory;
}

async function ensureMemoryTrashDirectory(
  rootPath: string,
  assertUsable?: AssertWorkspaceUsable
): Promise<string> {
  return ensureTrashNodeDirectory({
    directoryName: 'memories',
    directoryUnsafeMessage: 'Workspace memory trash directory is not safe',
    rootPath,
    ...(assertUsable ? { assertUsable } : {}),
  });
}

async function ensureSegmentTrashDirectory(
  rootPath: string,
  assertUsable?: AssertWorkspaceUsable
): Promise<string> {
  return ensureTrashNodeDirectory({
    directoryName: 'segments',
    directoryUnsafeMessage: 'Workspace segment trash directory is not safe',
    rootPath,
    ...(assertUsable ? { assertUsable } : {}),
  });
}

async function ensureSegmentSupplementTrashDirectory(
  rootPath: string,
  assertUsable?: AssertWorkspaceUsable
): Promise<string> {
  return ensureTrashNodeDirectory({
    directoryName: 'supplements',
    directoryUnsafeMessage: 'Workspace segment supplement trash directory is not safe',
    rootPath,
    ...(assertUsable ? { assertUsable } : {}),
  });
}

function createWorkspaceDirectoryWithinParent({
  parentDirectory,
  directoryName,
  allowExisting = false,
  beforeCommit,
}: {
  readonly parentDirectory: string;
  readonly directoryName: string;
  readonly allowExisting?: boolean;
  readonly beforeCommit?: () => void;
}): void {
  const parentIdentity = readDirectoryIdentitySync(parentDirectory);
  runInWorkspaceDirectorySync(
    { directory: parentDirectory, directoryIdentity: parentIdentity },
    () => {
      let directoryCreated = false;
      try {
        assertSameCurrentDirectory(parentIdentity);
        beforeCommit?.();
        try {
          mkdirSync(directoryName);
          directoryCreated = true;
        } catch (error) {
          if (!allowExisting || (error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error;
          }
          const existing = lstatSync(directoryName);
          if (!existing.isDirectory() || existing.isSymbolicLink()) {
            throw error;
          }
        }
        assertSameDirectoryPath(parentDirectory, parentIdentity);
        assertSameCurrentDirectory(parentIdentity);
        fsyncCurrentWorkspaceDirectoryBestEffort();
        directoryCreated = false;
      } catch (error) {
        if (directoryCreated) {
          rmSync(directoryName, { force: true, recursive: true });
        }
        throw error;
      }
    }
  );
}

async function ensureMemorySegmentsDirectory({
  assertUsable,
  memoryDirectoryPath,
  rootPath,
}: {
  readonly assertUsable?: AssertWorkspaceUsable;
  readonly memoryDirectoryPath: string;
  readonly rootPath: string;
}): Promise<string> {
  await assertSafeExistingDirectory(memoryDirectoryPath, 'Workspace memory directory is not safe');
  assertWorkspaceUsable(assertUsable);
  createWorkspaceDirectoryWithinParent({
    parentDirectory: memoryDirectoryPath,
    directoryName: 'segments',
    allowExisting: true,
    ...(assertUsable ? { beforeCommit: () => assertWorkspaceUsable(assertUsable) } : {}),
  });
  const segmentsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(memoryDirectoryPath, 'segments')
  );
  await assertSafeExistingDirectory(segmentsDirectory, 'Workspace segments directory is not safe');
  return segmentsDirectory;
}

async function ensureMemoryRecordingsDirectory(
  rootPath: string,
  memoryId: string,
  memoryTitleForCreate?: string,
  hooks?: FinalizeTransactionHooks
): Promise<string> {
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  await assertSafeExistingDirectory(memoriesDirectory, 'Workspace memories directory is not safe');

  const directory = await memoryDirectoryForWriteTarget(rootPath, memoryId, memoryTitleForCreate);
  await hooks?.beforeMemoryDirectoryCreate?.();
  const currentDirectory = await memoryDirectoryForWriteTarget(
    rootPath,
    memoryId,
    memoryTitleForCreate
  );
  if (currentDirectory !== directory) {
    throw new Error('Workspace memory directory changed');
  }
  await hooks?.beforeMemoryDirectoryMkdir?.();
  const currentMemoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  if (currentMemoriesDirectory !== memoriesDirectory) {
    throw new Error('Workspace memories directory changed');
  }
  await assertSafeExistingDirectory(
    currentMemoriesDirectory,
    'Workspace memories directory is not safe'
  );
  if (!(await exists(currentDirectory))) {
    createWorkspaceDirectoryWithinParent({
      parentDirectory: currentMemoriesDirectory,
      directoryName: path.basename(currentDirectory),
      allowExisting: true,
    });
  }
  const createdDirectory = await memoryDirectoryForWriteTarget(
    rootPath,
    memoryId,
    memoryTitleForCreate
  );
  if (createdDirectory !== currentDirectory) {
    throw new Error('Workspace memory directory changed');
  }
  await assertSafeExistingDirectory(createdDirectory, 'Workspace memory directory is not safe');

  await hooks?.beforeSegmentsDirectoryCreate?.();
  const safeDirectory = await memoryDirectoryForWriteTarget(
    rootPath,
    memoryId,
    memoryTitleForCreate
  );
  if (safeDirectory !== createdDirectory) {
    throw new Error('Workspace memory directory changed');
  }
  await assertSafeExistingDirectory(safeDirectory, 'Workspace memory directory is not safe');
  const segmentsDirectory = path.join(safeDirectory, 'segments');
  await hooks?.beforeSegmentsDirectoryMkdir?.();
  const currentSafeDirectory = await memoryDirectoryForWriteTarget(
    rootPath,
    memoryId,
    memoryTitleForCreate
  );
  if (currentSafeDirectory !== safeDirectory) {
    throw new Error('Workspace memory directory changed');
  }
  await assertSafeExistingDirectory(currentSafeDirectory, 'Workspace memory directory is not safe');
  createWorkspaceDirectoryWithinParent({
    parentDirectory: currentSafeDirectory,
    directoryName: 'segments',
    allowExisting: true,
  });
  const safeRecordingsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(currentSafeDirectory, 'segments')
  );
  if (safeRecordingsDirectory !== segmentsDirectory) {
    throw new Error('Workspace memory segments directory changed');
  }
  await assertSafeExistingDirectory(
    safeRecordingsDirectory,
    'Workspace memory segments directory is not safe'
  );
  return safeRecordingsDirectory;
}

async function draftSegmentDirectory(rootPath: string, segmentId: string): Promise<string> {
  return resolveSafeWorkspaceChild(
    rootPath,
    resolveWorkspaceDraftSegmentDirectory(rootPath, segmentId)
  );
}

async function draftSupplementDirectory(rootPath: string, supplementId: string): Promise<string> {
  return resolveSafeWorkspaceChild(
    rootPath,
    resolveWorkspaceDraftSupplementDirectory(rootPath, supplementId)
  );
}

async function findFileSpaceNodeDirectoryInParent({
  beforeScan,
  defaultDirectoryName,
  duplicateMessage,
  matchesFallbackCandidate,
  matchesCandidate,
  nodeId,
  parentDirectory,
  rootPath,
  scanFallbackCandidates = true,
  unsafeMessage,
}: {
  readonly beforeScan?: (safeParentDirectory: string) => MaybePromise<void>;
  readonly defaultDirectoryName: string;
  readonly duplicateMessage: string;
  readonly matchesFallbackCandidate?: (
    candidate: string,
    candidateIdentity: DirectoryIdentity
  ) => boolean | Promise<boolean>;
  readonly matchesCandidate: (
    candidate: string,
    candidateIdentity: DirectoryIdentity
  ) => boolean | Promise<boolean>;
  readonly nodeId: string;
  readonly parentDirectory: string;
  readonly rootPath: string;
  readonly scanFallbackCandidates?: boolean;
  readonly unsafeMessage: string;
}): Promise<string> {
  const safeParentDirectory = await resolveSafeWorkspaceChild(rootPath, parentDirectory);
  await beforeScan?.(safeParentDirectory);
  let primaryMatch: string | null = null;
  let fallbackMatch: string | null = null;
  const generatedPrefix = `${nodeId}--`;
  const isLikelyCandidate = (entry: Dirent) =>
    entry.name === nodeId || entry.name.startsWith(generatedPrefix);
  const inspectEntry = async (
    entry: Dirent,
    options?: { readonly rejectUnsafeCandidate?: boolean }
  ): Promise<void> => {
    const candidate = await resolveSafeWorkspaceChild(
      rootPath,
      path.join(safeParentDirectory, entry.name)
    );
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      if (options?.rejectUnsafeCandidate) {
        throw new Error(unsafeMessage);
      }
      return;
    }
    try {
      await assertSafeExistingDirectory(candidate, unsafeMessage);
      const candidateIdentity = await readDirectoryIdentity(candidate);
      if (await matchesCandidate(candidate, candidateIdentity)) {
        if (primaryMatch) {
          throw new Error(duplicateMessage);
        }
        primaryMatch = candidate;
        return;
      }
      if (await matchesFallbackCandidate?.(candidate, candidateIdentity)) {
        if (fallbackMatch) {
          throw new Error(duplicateMessage);
        }
        fallbackMatch = candidate;
      }
    } catch (error) {
      if (options?.rejectUnsafeCandidate && isUnsafeWorkspacePathError(error)) {
        throw error;
      }
    }
  };

  let directory: Awaited<ReturnType<typeof opendir>> | null = null;
  try {
    directory = await opendir(safeParentDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  if (directory) {
    for await (const entry of directory) {
      if (isLikelyCandidate(entry)) {
        await inspectEntry(entry, { rejectUnsafeCandidate: true });
      }
    }
  }
  if (!primaryMatch && scanFallbackCandidates) {
    let fallbackDirectory: Awaited<ReturnType<typeof opendir>> | null = null;
    try {
      fallbackDirectory = await opendir(safeParentDirectory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    if (fallbackDirectory) {
      for await (const entry of fallbackDirectory) {
        if (!isLikelyCandidate(entry) && entry.isDirectory()) {
          await inspectEntry(entry);
        }
      }
    }
  }
  return (
    primaryMatch ??
    fallbackMatch ??
    resolveSafeWorkspaceChild(rootPath, path.join(safeParentDirectory, defaultDirectoryName))
  );
}

export async function memorySegmentDirectory(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<string> {
  const directory = await memoryDirectory(rootPath, memoryId);
  return resolveSegmentDirectoryInMemoryDirectory({
    memoryDirectory: directory,
    memoryId,
    rootPath,
    segmentId,
  });
}

export async function resolveSegmentDirectoryInMemoryDirectory({
  memoryDirectory,
  memoryId,
  rootPath,
  segmentId,
}: {
  readonly memoryDirectory: string;
  readonly memoryId: string;
  readonly rootPath: string;
  readonly segmentId: string;
}): Promise<string> {
  return segmentDirectoryInParent({
    defaultDirectoryName: segmentId,
    memoryId,
    parentDirectory: path.join(memoryDirectory, 'segments'),
    rootPath,
    segmentId,
  });
}

async function segmentDirectoryInParent({
  defaultDirectoryName,
  memoryId,
  parentDirectory,
  rootPath,
  scanFallbackCandidates = true,
  segmentId,
}: {
  readonly defaultDirectoryName: string;
  readonly memoryId: string;
  readonly parentDirectory: string;
  readonly rootPath: string;
  readonly scanFallbackCandidates?: boolean;
  readonly segmentId: string;
}): Promise<string> {
  if (!SEGMENT_ID_PATTERN.test(segmentId)) {
    throw new Error('Invalid segment id');
  }
  return findFileSpaceNodeDirectoryInParent({
    beforeScan: (safeParentDirectory) =>
      beforeSegmentDirectoryCandidateScanForTest?.({
        parentDirectory: safeParentDirectory,
        memoryId,
        segmentId,
      }) ?? Promise.resolve(),
    defaultDirectoryName,
    duplicateMessage: 'Duplicate finalized segment id',
    matchesCandidate: async (candidate, candidateIdentity) => {
      const segment = await readFinalizedSegmentMetadata(rootPath, candidate, candidateIdentity);
      return segment.memoryId === memoryId && segment.segmentId === segmentId;
    },
    nodeId: segmentId,
    parentDirectory,
    rootPath,
    scanFallbackCandidates,
    unsafeMessage: 'Workspace segment directory is not safe',
  });
}

async function trashedSegmentDirectory(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<string> {
  return segmentDirectoryInParent({
    defaultDirectoryName: segmentId,
    memoryId,
    parentDirectory: path.join(rootPath, '.reo', 'trash', 'segments'),
    rootPath,
    scanFallbackCandidates: false,
    segmentId,
  });
}

export async function memorySegmentDirectoryForNewNode(
  rootPath: string,
  memoryId: string,
  segmentId: string,
  title: string
): Promise<string> {
  const directory = await memoryDirectory(rootPath, memoryId);
  return resolveSafeWorkspaceChild(
    rootPath,
    path.join(directory, 'segments', fileSpaceNodeDirectoryName(segmentId, title))
  );
}

async function ensureSegmentSupplementsDirectory({
  rootPath,
  memoryId,
  segmentId,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<string> {
  const recordingDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
  await assertSafeExistingDirectory(recordingDirectory, 'Workspace segment directory is not safe');
  assertWorkspaceUsable(assertUsable);
  createWorkspaceDirectoryWithinParent({
    parentDirectory: recordingDirectory,
    directoryName: 'supplements',
    allowExisting: true,
    ...(assertUsable ? { beforeCommit: () => assertWorkspaceUsable(assertUsable) } : {}),
  });
  const supplementsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(recordingDirectory, 'supplements')
  );
  await assertSafeExistingDirectory(
    supplementsDirectory,
    'Workspace segment supplements directory is not safe'
  );
  return supplementsDirectory;
}

async function segmentDirectoryExistsInAnyMemory(
  rootPath: string,
  segmentId: string
): Promise<boolean> {
  if (!SEGMENT_ID_PATTERN.test(segmentId)) {
    throw new Error('Invalid segment id');
  }
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  const entries = await readExistingDirectoryEntries(memoriesDirectory);
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const memory = await readMemoryFileTruthFromDirectory(
        rootPath,
        path.join(memoriesDirectory, entry.name)
      );
      if (
        await exists(
          await resolveSegmentDirectoryInMemoryDirectory({
            memoryDirectory: path.join(memoriesDirectory, entry.name),
            memoryId: memory.memoryId,
            rootPath,
            segmentId,
          })
        )
      ) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

export async function assertNoDuplicateSegmentDirectoryById(
  rootPath: string,
  ownerMemoryId: string,
  segmentId: string
): Promise<void> {
  if (!MEMORY_ID_PATTERN.test(ownerMemoryId) || !SEGMENT_ID_PATTERN.test(segmentId)) {
    throw new Error('Invalid recording ownership');
  }
  await beforeDuplicateRecordingCheckForTest?.();
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  const entries = await readExistingDirectoryEntries(memoriesDirectory);
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    let memory: MemoryFileTruth;
    try {
      memory = await readMemoryFileTruthFromDirectory(
        rootPath,
        path.join(memoriesDirectory, entry.name)
      );
    } catch {
      continue;
    }
    let candidate: string;
    const memoryDirectoryPath = path.join(memoriesDirectory, entry.name);
    const segmentsDirectory = await resolveSafeWorkspaceChild(
      rootPath,
      path.join(memoryDirectoryPath, 'segments')
    );
    const segmentEntries = await readExistingDirectoryEntries(segmentsDirectory);
    const likelyCandidateCount = segmentEntries.filter(
      (segmentEntry) =>
        (segmentEntry.isDirectory() || segmentEntry.isSymbolicLink()) &&
        fileSpaceNodeDirectoryNameMatchesId(segmentEntry.name, segmentId)
    ).length;
    if (likelyCandidateCount > 1) {
      throw new Error('Duplicate finalized segment id');
    }
    try {
      candidate = await resolveSegmentDirectoryInMemoryDirectory({
        memoryDirectory: memoryDirectoryPath,
        memoryId: memory.memoryId,
        rootPath,
        segmentId,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Duplicate finalized segment id') {
        throw new Error('Duplicate finalized segment id', { cause: error });
      }
      throw error;
    }
    if (memory.memoryId === ownerMemoryId) {
      continue;
    }
    let metadata: Awaited<ReturnType<typeof lstat>>;
    try {
      metadata = await lstat(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    if (metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error('Duplicate finalized segment id');
    }
  }
}

export async function readMemoryFileTruth(
  rootPath: string,
  memoryId: string,
  options: {
    readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
    readonly repairMissingManifest?: boolean;
  } = {}
): Promise<MemoryFileTruth> {
  const directory = await memoryDirectory(rootPath, memoryId);
  const memory = await readMemoryFileTruthFromDirectory(rootPath, directory, options);
  if (memory.memoryId !== memoryId) {
    throw new Error('Memory metadata does not match directory id');
  }
  return memory;
}

function readFileSizeInKnownDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string
): number {
  const fd = openExistingWorkspaceFileInDirectory({
    directory,
    directoryIdentity,
    fileName,
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
  try {
    const entry = fstatSync(fd);
    if (!entry.isFile()) {
      throw new Error('Workspace file is not safe');
    }
    assertSameDirectoryPath(directory, directoryIdentity);
    return entry.size;
  } finally {
    closeSync(fd);
  }
}

function markdownBodyByteLength(markdownContent: string): number {
  return Buffer.byteLength(markdownContent, 'utf8');
}

function isAudioSegmentFileTruth(
  fileTruth: FinalizedSegmentFileTruth | null
): fileTruth is FinalizedAudioSegmentFileTruth {
  return fileTruth?.metadata.kind === 'audio';
}

function hasNoteSupplement(supplements: readonly WorkspaceSegmentSupplementProjection[]): boolean {
  return supplements.some((supplement) => supplement.type === 'note');
}

function unlinkFileInKnownDirectory(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string
): void {
  runInWorkspaceDirectorySync({ directory, directoryIdentity }, () => {
    assertSameCurrentDirectory(directoryIdentity);
    unlinkSync(fileName);
    assertSameCurrentDirectory(directoryIdentity);
    fsyncCurrentWorkspaceDirectoryBestEffort();
  });
}

function unlinkFileInKnownDirectoryIfExists(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string
): void {
  try {
    unlinkFileInKnownDirectory(directory, directoryIdentity, fileName);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

async function summarizeRecording(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<MemorySegmentSummary> {
  const fileTruth = await readValidFinalizedSegmentFileTruth(rootPath, memoryId, segmentId);
  if (!isAudioSegmentFileTruth(fileTruth)) {
    throw new Error('Finalized segment metadata does not match file truth');
  }

  return {
    segmentId,
    title: fileTruth.metadata.title,
    durationMs: fileTruth.metadata.durationMs,
    audioByteLength: fileTruth.audioByteLength,
    lastTranscriptionAttempt: deriveLastTranscriptionAttempt(fileTruth.metadata),
  };
}

async function readFinalizedSegmentMetadata(
  rootPath: string,
  recordingDirectory: string,
  recordingDirectoryIdentity?: DirectoryIdentity
): Promise<FinalizedSegmentSemanticTruth> {
  const directoryIdentity =
    recordingDirectoryIdentity ?? (await readDirectoryIdentity(recordingDirectory));
  const markdown = parseWorkspaceMarkdownObject({
    objectType: 'segment',
    markdown: readWorkspaceTextFileInKnownDirectory(
      recordingDirectory,
      directoryIdentity,
      'segment.md'
    ),
  });
  const markdownSegmentId = 'id' in markdown.data ? markdown.data.id : undefined;
  const directorySegmentId = directorySegmentIdHint(path.basename(recordingDirectory));
  const segmentId = markdownSegmentId ?? directorySegmentId;
  if (!segmentId) {
    throw new Error('Finalized segment markdown does not expose a stable segment id');
  }
  if (directorySegmentId && directorySegmentId !== segmentId) {
    throw new Error('Finalized segment directory id conflicts with markdown id');
  }
  const manifest = segmentObjectManifestSchema.parse(
    JSON.parse(await readWorkspaceTextFile(await segmentObjectManifestPath(rootPath, segmentId)))
  );
  if (manifest.segmentId !== segmentId) {
    throw new Error('Finalized segment manifest does not match file-space node');
  }
  const markdownKind = 'kind' in markdown.data ? markdown.data.kind : undefined;
  if ((markdownKind ?? 'audio') !== manifest.kind) {
    throw new Error('Finalized segment markdown kind does not match manifest');
  }
  return {
    ...manifest,
    title: markdown.data.title,
    ...('content_title' in markdown.data && markdown.data.content_title !== undefined
      ? { contentTitle: markdown.data.content_title }
      : {}),
    markdownContent: markdown.content,
  };
}

async function writeSegmentMarkdownInKnownDirectory({
  directory,
  directoryIdentity,
  title,
  transcript,
}: {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly title: string;
  readonly transcript?: string;
}): Promise<void> {
  await writeWorkspaceFileAtomicInKnownDirectory({
    directory,
    directoryIdentity,
    fileName: 'segment.md',
    data: renderSegmentMarkdown({
      title,
      ...(transcript !== undefined ? { transcript } : {}),
    }),
  });
}

async function updateSegmentMarkdownInKnownDirectory({
  directory,
  directoryIdentity,
  update,
}: {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly update: (current: { readonly title: string; readonly content: string }) => {
    readonly title: string;
    readonly contentTitle?: string;
    readonly content: string;
  };
}): Promise<void> {
  const current = parseWorkspaceMarkdownObject({
    objectType: 'segment',
    markdown: readWorkspaceTextFileInKnownDirectory(directory, directoryIdentity, 'segment.md'),
  });
  const next = update({ title: current.data.title, content: current.content });
  const currentKind = 'kind' in current.data ? current.data.kind : undefined;
  const nextContent = currentKind === 'note' ? current.content : next.content;
  await writeWorkspaceFileAtomicInKnownDirectory({
    directory,
    directoryIdentity,
    fileName: 'segment.md',
    data: renderWorkspaceMarkdownObject({
      objectType: 'segment',
      data: {
        ...current.data,
        title: next.title,
        ...(next.contentTitle !== undefined ? { content_title: next.contentTitle } : {}),
        kind: currentKind ?? 'audio',
      },
      content: nextContent,
    }),
  });
}

async function writeSupplementMarkdownInKnownDirectory({
  directory,
  directoryIdentity,
  title,
  transcript,
}: {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly title: string;
  readonly transcript?: string;
}): Promise<void> {
  await writeWorkspaceFileAtomicInKnownDirectory({
    directory,
    directoryIdentity,
    fileName: 'supplement.md',
    data: renderSupplementMarkdown({
      title,
      ...(transcript !== undefined ? { transcript } : {}),
    }),
  });
}

async function updateSupplementMarkdownInKnownDirectory({
  directory,
  directoryIdentity,
  update,
}: {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly update: (current: { readonly title: string; readonly content: string }) => {
    readonly title: string;
    readonly content: string;
  };
}): Promise<void> {
  const current = parseWorkspaceMarkdownObject({
    objectType: 'supplement',
    markdown: readWorkspaceTextFileInKnownDirectory(directory, directoryIdentity, 'supplement.md'),
  });
  const next = update({ title: current.data.title, content: current.content });
  const currentKind = 'kind' in current.data ? current.data.kind : undefined;
  const nextContent = currentKind === 'note' ? current.content : next.content;
  await writeWorkspaceFileAtomicInKnownDirectory({
    directory,
    directoryIdentity,
    fileName: 'supplement.md',
    data: renderWorkspaceMarkdownObject({
      objectType: 'supplement',
      data: {
        ...current.data,
        title: next.title,
        kind: currentKind ?? 'audio',
      },
      content: nextContent,
    }),
  });
}

async function readFinalizedSegmentSupplementMetadata(
  rootPath: string,
  supplementDirectory: string,
  supplementDirectoryIdentity?: DirectoryIdentity
): Promise<FinalizedSupplementSemanticTruth> {
  const directoryIdentity =
    supplementDirectoryIdentity ?? readDirectoryIdentitySync(supplementDirectory);
  const markdown = parseWorkspaceMarkdownObject({
    objectType: 'supplement',
    markdown: readWorkspaceTextFileInKnownDirectory(
      supplementDirectory,
      directoryIdentity,
      'supplement.md'
    ),
  });
  const markdownSupplementId = 'id' in markdown.data ? markdown.data.id : undefined;
  const directorySupplementId = directorySupplementIdHint(path.basename(supplementDirectory));
  const supplementId = markdownSupplementId ?? directorySupplementId;
  if (!supplementId) {
    throw new Error('Finalized segment supplement markdown does not expose a stable supplement id');
  }
  if (directorySupplementId && directorySupplementId !== supplementId) {
    throw new Error('Finalized segment supplement directory id conflicts with markdown id');
  }
  const manifest = supplementObjectManifestSchema.parse(
    JSON.parse(
      await readWorkspaceTextFile(await supplementObjectManifestPath(rootPath, supplementId))
    )
  );
  if (manifest.supplementId !== supplementId) {
    throw new Error('Finalized supplement manifest does not match file-space node');
  }
  const markdownKind = 'kind' in markdown.data ? markdown.data.kind : undefined;
  if ((markdownKind ?? 'audio') !== manifest.kind) {
    throw new Error('Finalized supplement markdown kind does not match manifest');
  }
  return {
    ...manifest,
    title: markdown.data.title,
    markdownContent: markdown.content,
  };
}

async function segmentSupplementsDirectory(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<string> {
  const recordingDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
  return path.join(recordingDirectory, 'supplements');
}

export async function segmentSupplementDirectory(
  rootPath: string,
  memoryId: string,
  segmentId: string,
  supplementId: string
): Promise<string> {
  const recordingDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
  return resolveSegmentSupplementDirectoryInSegmentDirectory({
    memoryId,
    rootPath,
    segmentDirectory: recordingDirectory,
    segmentId,
    supplementId,
  });
}

export async function resolveSegmentSupplementDirectoryInSegmentDirectory({
  memoryId,
  rootPath,
  segmentDirectory,
  segmentId,
  supplementId,
}: {
  readonly memoryId: string;
  readonly rootPath: string;
  readonly segmentDirectory: string;
  readonly segmentId: string;
  readonly supplementId: string;
}): Promise<string> {
  if (!SUPPLEMENT_ID_PATTERN.test(supplementId)) {
    throw new Error('Invalid segment supplement id');
  }
  const supplementsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(segmentDirectory, 'supplements')
  );
  return findFileSpaceNodeDirectoryInParent({
    defaultDirectoryName: supplementId,
    duplicateMessage: 'Duplicate segment supplement id',
    matchesCandidate: async (candidate, candidateIdentity) => {
      const supplement = await readFinalizedSegmentSupplementMetadata(
        rootPath,
        candidate,
        candidateIdentity
      );
      return (
        supplement.memoryId === memoryId &&
        supplement.segmentId === segmentId &&
        supplement.supplementId === supplementId
      );
    },
    nodeId: supplementId,
    parentDirectory: supplementsDirectory,
    rootPath,
    scanFallbackCandidates: true,
    unsafeMessage: 'Workspace segment supplement directory is not safe',
  });
}

async function trashedSegmentSupplementDirectory(
  rootPath: string,
  memoryId: string,
  segmentId: string,
  supplementId: string
): Promise<string> {
  if (!SUPPLEMENT_ID_PATTERN.test(supplementId)) {
    throw new Error('Invalid segment supplement id');
  }
  return findFileSpaceNodeDirectoryInParent({
    defaultDirectoryName: supplementId,
    duplicateMessage: 'Duplicate deleted segment supplement id',
    matchesCandidate: async (candidate, candidateIdentity) => {
      const supplement = await readFinalizedSegmentSupplementMetadata(
        rootPath,
        candidate,
        candidateIdentity
      );
      return (
        supplement.memoryId === memoryId &&
        supplement.segmentId === segmentId &&
        supplement.supplementId === supplementId
      );
    },
    nodeId: supplementId,
    parentDirectory: path.join(rootPath, '.reo', 'trash', 'supplements'),
    rootPath,
    scanFallbackCandidates: false,
    unsafeMessage: 'Workspace segment supplement trash directory is not safe',
  });
}

export async function segmentSupplementDirectoryForNewNode(
  rootPath: string,
  memoryId: string,
  segmentId: string,
  supplementId: string,
  title: string
): Promise<string> {
  const supplementsDirectory = await segmentSupplementsDirectory(rootPath, memoryId, segmentId);
  return resolveSafeWorkspaceChild(
    rootPath,
    path.join(supplementsDirectory, fileSpaceNodeDirectoryName(supplementId, title))
  );
}

async function readValidFinalizedSupplementProjection({
  supplementDirectory,
  supplementDirectoryIdentity,
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
}: {
  readonly supplementDirectory: string;
  readonly supplementDirectoryIdentity: DirectoryIdentity;
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
}): Promise<WorkspaceSegmentSupplementProjection | null> {
  try {
    const supplement = await readFinalizedSegmentSupplementMetadata(
      rootPath,
      supplementDirectory,
      supplementDirectoryIdentity
    );
    const supplementBase = {
      workspaceId,
      memoryId,
      segmentId,
      supplementId: supplement.supplementId,
      title: titleFromFileSpaceDirectoryName({
        nodeId: supplement.supplementId,
        directoryName: path.basename(supplementDirectory),
        metadataTitle: supplement.title,
      }),
      createdAt: supplement.createdAt,
      updatedAt: supplement.updatedAt ?? supplement.finalizedAt,
    };
    if (supplement.kind === 'note') {
      if (
        supplement.workspaceId !== workspaceId ||
        supplement.memoryId !== memoryId ||
        supplement.segmentId !== segmentId ||
        supplement.bodyByteLength !== markdownBodyByteLength(supplement.markdownContent)
      ) {
        return null;
      }
      return {
        ...supplementBase,
        type: 'note',
        bodyByteLength: supplement.bodyByteLength,
      };
    }
    const audioByteLength = readFileSizeInKnownDirectory(
      supplementDirectory,
      supplementDirectoryIdentity,
      'audio.webm'
    );
    if (
      supplement.workspaceId !== workspaceId ||
      supplement.memoryId !== memoryId ||
      supplement.segmentId !== segmentId ||
      supplement.audioByteLength !== audioByteLength
    ) {
      return null;
    }
    return {
      ...supplementBase,
      type: 'audio',
      durationMs: supplement.durationMs,
      audioByteLength,
      lastTranscriptionAttempt: deriveLastTranscriptionAttempt(supplement),
      transcript: {
        exists: extractSegmentTranscript(supplement.markdownContent).trim().length > 0,
      },
    };
  } catch {
    return null;
  }
}

async function readValidFinalizedSupplementProjectionFromDirectory({
  supplementDirectory,
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
}: {
  readonly supplementDirectory: string;
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
}): Promise<WorkspaceSegmentSupplementProjection | null> {
  try {
    return readValidFinalizedSupplementProjection({
      supplementDirectory,
      supplementDirectoryIdentity: await readDirectoryIdentity(supplementDirectory),
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
    });
  } catch {
    return null;
  }
}

async function listValidSegmentSupplementsFromDirectory({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  recordingDirectory,
  repairFileSpaceCandidates = true,
  reviewEntries,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly recordingDirectory: string;
  readonly repairFileSpaceCandidates?: boolean;
  readonly reviewEntries?: WorkspaceReviewEntryInput[];
}): Promise<WorkspaceSegmentSupplementProjection[]> {
  const supplementsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(recordingDirectory, 'supplements')
  );
  if (repairFileSpaceCandidates) {
    await reconcileNoteSupplementsInSegmentDirectory({
      memoryId,
      recordingDirectory,
      ...(reviewEntries ? { reviewEntries } : {}),
      rootPath,
      segmentId,
      workspaceId,
    });
  }
  let entries: Dirent[];
  try {
    entries = await readExistingDirectoryEntries(supplementsDirectory);
  } catch {
    return [];
  }
  const supplements: WorkspaceSegmentSupplementProjection[] = [];
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const supplementDirectory = await resolveSafeWorkspaceChild(
        rootPath,
        path.join(supplementsDirectory, entry.name)
      );
      await assertSafeExistingDirectory(supplementDirectory, 'Segment supplement path is not safe');
      const supplementDirectoryIdentity = await readDirectoryIdentity(supplementDirectory);
      const projection = await readValidFinalizedSupplementProjection({
        supplementDirectory,
        supplementDirectoryIdentity,
        rootPath,
        workspaceId,
        memoryId,
        segmentId,
      });
      if (projection) {
        if (seen.has(projection.supplementId)) {
          duplicated.add(projection.supplementId);
          continue;
        }
        seen.add(projection.supplementId);
        supplements.push(projection);
      }
    } catch {
      continue;
    }
  }
  return sortByProjectedUpdatedAt(
    supplements.filter((supplement) => !duplicated.has(supplement.supplementId))
  );
}

function normalizeContentTabOrder(
  persistedOrder: readonly WorkspaceSegmentContentTabOrderItem[] | undefined,
  supplements: readonly WorkspaceSegmentSupplementProjection[]
): WorkspaceSegmentContentTabOrderItem[] {
  const liveItems = new Set<WorkspaceSegmentContentTabOrderItem>([
    'segment',
    ...supplements.map(
      (supplement): WorkspaceSegmentContentTabOrderItem => `supplement:${supplement.supplementId}`
    ),
  ]);
  const nextOrder: WorkspaceSegmentContentTabOrderItem[] = [];
  const seen = new Set<WorkspaceSegmentContentTabOrderItem>();

  for (const item of persistedOrder ?? []) {
    if (!liveItems.has(item) || seen.has(item)) {
      continue;
    }
    seen.add(item);
    nextOrder.push(item);
  }

  for (const item of liveItems) {
    if (!seen.has(item)) {
      nextOrder.push(item);
    }
  }

  return nextOrder;
}

async function recoverSegmentSupplementFinalizeTransactions({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
  recordingDirectory,
  beforeRecordingRecoveryRemove,
  afterDraftCleanup,
  assertWorkspaceUsable,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly recordingDirectory: string;
  readonly beforeRecordingRecoveryRemove?: () => MaybePromise<void>;
  readonly afterDraftCleanup?: () => MaybePromise<void>;
  readonly assertWorkspaceUsable?: () => MaybePromise<void>;
}): Promise<void> {
  const supplementsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(recordingDirectory, 'supplements')
  );
  const supplementEntries = await readExistingDirectoryEntries(supplementsDirectory);
  for (const supplementEntry of supplementEntries) {
    if (!supplementEntry.isDirectory()) {
      continue;
    }
    const supplementDirectory = await resolveSafeWorkspaceChild(
      rootPath,
      path.join(supplementsDirectory, supplementEntry.name)
    );
    if (supplementEntry.name.startsWith(FINALIZE_STAGING_PREFIX)) {
      const projection = await readValidFinalizedSupplementProjectionFromDirectory({
        supplementDirectory,
        rootPath,
        workspaceId,
        memoryId,
        segmentId,
      });
      const hasMarker = await hasFinalizeTransactionMarker(supplementDirectory);
      const hasPayload = await finalizedSupplementPayloadExists(supplementDirectory);
      if (projection || (!hasMarker && hasPayload)) {
        continue;
      }
      await beforeRecordingRecoveryRemove?.();
      await assertWorkspaceUsable?.();
      const removed = await removeSafeWorkspaceDirectory(rootPath, supplementDirectory);
      if (removed) {
        await assertWorkspaceUsable?.();
        await fsyncWorkspaceDirectory(supplementsDirectory).catch(() => {});
      }
      continue;
    }
    if (!(await hasFinalizeTransactionMarker(supplementDirectory))) {
      continue;
    }

    const projection = await readValidFinalizedSupplementProjectionFromDirectory({
      supplementDirectory,
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
    });
    const supplementId =
      projection?.supplementId ??
      (await readFinalizedSupplementIdFromMetadata(rootPath, supplementDirectory)) ??
      (SUPPLEMENT_ID_PATTERN.test(supplementEntry.name) ? supplementEntry.name : null);
    const hasPayload = await finalizedSupplementPayloadExists(supplementDirectory);
    if (!projection || !supplementId) {
      if (hasPayload) {
        continue;
      }
      await beforeRecordingRecoveryRemove?.();
      await assertWorkspaceUsable?.();
      await removeSafeWorkspaceDirectory(rootPath, supplementDirectory);
      continue;
    }

    try {
      await assertWorkspaceUsable?.();
      const removed = await removeSafeWorkspaceDirectory(
        rootPath,
        await draftSupplementDirectory(rootPath, supplementId),
        { allowMissing: true }
      );
      if (!removed) {
        throw new Error('Segment supplement draft cleanup path is not safe');
      }
      await afterDraftCleanup?.();
      await assertWorkspaceUsable?.();
      await fsyncWorkspaceDirectory(path.join(rootPath, '.reo', 'drafts', 'supplements')).catch(
        () => {}
      );
      await assertWorkspaceUsable?.();
      await unlinkFinalizeTransactionMarkerInDirectory(supplementDirectory);
    } catch {
      continue;
    }
  }
}

async function segmentSupplementRecoveryWorkExists({
  rootPath,
  recordingDirectory,
}: {
  readonly rootPath: string;
  readonly recordingDirectory: string;
}): Promise<boolean> {
  const supplementsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(recordingDirectory, 'supplements')
  );
  const supplementEntries = await readExistingDirectoryEntries(supplementsDirectory);
  for (const supplementEntry of supplementEntries) {
    if (!supplementEntry.isDirectory()) {
      continue;
    }
    if (supplementEntry.name.startsWith(FINALIZE_STAGING_PREFIX)) {
      return true;
    }
    const supplementDirectory = await resolveSafeWorkspaceChild(
      rootPath,
      path.join(supplementsDirectory, supplementEntry.name)
    );
    if (await hasFinalizeTransactionMarker(supplementDirectory)) {
      return true;
    }
  }
  return false;
}

async function readValidFinalizedSegmentFileTruthFromDirectory({
  rootPath,
  recordingDirectory,
  memoryId,
  strictUnsafePath = false,
}: {
  readonly rootPath: string;
  readonly recordingDirectory: string;
  readonly memoryId: string;
  readonly strictUnsafePath?: boolean;
}): Promise<FinalizedSegmentFileTruth | null> {
  try {
    await assertSafeExistingDirectory(recordingDirectory, 'Segment directory is not safe');
    const recordingDirectoryIdentity = await readDirectoryIdentity(recordingDirectory);
    const recording = await readFinalizedSegmentMetadata(
      rootPath,
      recordingDirectory,
      recordingDirectoryIdentity
    );
    if (recording.kind === 'note') {
      if (
        recording.memoryId !== memoryId ||
        recording.bodyByteLength !== markdownBodyByteLength(recording.markdownContent)
      ) {
        return null;
      }
      return {
        segmentId: recording.segmentId,
        recordingDirectory,
        recordingDirectoryIdentity,
        metadata: recording,
      };
    }
    const audioByteLength = readFileSizeInKnownDirectory(
      recordingDirectory,
      recordingDirectoryIdentity,
      'audio.webm'
    );
    if (recording.memoryId !== memoryId || recording.audioByteLength !== audioByteLength) {
      return null;
    }
    return {
      segmentId: recording.segmentId,
      recordingDirectory,
      recordingDirectoryIdentity,
      metadata: recording,
      audioByteLength,
    };
  } catch (error) {
    if (strictUnsafePath && isUnsafeWorkspacePathError(error)) {
      throw error;
    }
    return null;
  }
}

function workspaceAtomicWriteAssert(
  assertUsable: AssertWorkspaceUsable | undefined
): (() => void) | undefined {
  return assertUsable ? () => assertWorkspaceUsable(assertUsable) : undefined;
}

async function existingTiptapSidecarInKnownDirectory({
  directory,
  directoryIdentity,
}: {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
}): Promise<boolean> {
  try {
    await lstat(path.join(directory, TIPTAP_CONTENT_SIDECAR_FILE));
    await assertSameDirectoryPathAsync(directory, directoryIdentity);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

async function updatePassiveNoteSidecarManifest({
  assertWorkspaceUsable: assertUsable,
  bodyMarkdown,
  manifest,
  rootPath,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly bodyMarkdown: string;
  readonly manifest: NoteSegmentObjectManifest | NoteSupplementObjectManifest;
  readonly rootPath: string;
}): Promise<void> {
  const manifestPath =
    manifest.objectType === 'segment'
      ? await segmentObjectManifestPath(rootPath, manifest.segmentId)
      : await supplementObjectManifestPath(rootPath, manifest.supplementId);
  await writeWorkspaceJsonAtomic(
    manifestPath,
    {
      ...manifest,
      updatedAt: new Date().toISOString(),
      bodyByteLength: markdownBodyByteLength(bodyMarkdown),
    },
    workspaceAtomicWriteAssert(assertUsable)
  );
}

async function passivelyReconcileExistingTiptapSidecar({
  assertWorkspaceUsable: assertUsable,
  directory,
  directoryIdentity,
  markdownFileName,
  noteManifest,
  objectType,
  reviewEntries,
  rootPath,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly markdownFileName: 'segment.md' | 'supplement.md';
  readonly noteManifest?: NoteSegmentObjectManifest | NoteSupplementObjectManifest;
  readonly objectType: 'segment' | 'supplement';
  readonly reviewEntries?: WorkspaceReviewEntryInput[];
  readonly rootPath: string;
}): Promise<boolean> {
  if (!(await existingTiptapSidecarInKnownDirectory({ directory, directoryIdentity }))) {
    return false;
  }

  const originalMarkdown = readWorkspaceTextFileInKnownDirectory(
    directory,
    directoryIdentity,
    markdownFileName
  );
  const parsed = parseWorkspaceMarkdownObject({
    objectType,
    markdown: originalMarkdown,
  });
  const kind = 'kind' in parsed.data ? parsed.data.kind : undefined;
  if (kind !== 'note' && kind !== 'audio') {
    return false;
  }
  const bodyMarkdown = kind === 'audio' ? extractSegmentTranscript(parsed.content) : parsed.content;
  const writeAssert = workspaceAtomicWriteAssert(assertUsable);
  let reconciled: Awaited<ReturnType<typeof reconcileTiptapContentSidecar>>;
  try {
    reconciled = await reconcileTiptapContentSidecar({
      ...(writeAssert ? { assertUsable: writeAssert } : {}),
      bodyMarkdown,
      createIfMissing: false,
      objectDirectory: directory,
      writeBodyMarkdown: async (nextBodyMarkdown) => {
        const nextContent =
          kind === 'audio'
            ? replaceSegmentTranscript(parsed.content, nextBodyMarkdown)
            : nextBodyMarkdown;
        const nextMarkdown = renderWorkspaceMarkdownObject({
          objectType,
          data: parsed.data,
          content: nextContent,
        });
        const rendered = parseWorkspaceMarkdownObject({
          objectType,
          markdown: nextMarkdown,
        });
        await writeWorkspaceFileAtomicInKnownDirectory({
          directory,
          directoryIdentity,
          fileName: markdownFileName,
          data: nextMarkdown,
          expectedCurrentData: originalMarkdown,
          ...(writeAssert ? { assertUsable: writeAssert } : {}),
        });
        return kind === 'audio' ? nextBodyMarkdown : rendered.content;
      },
    });
  } catch (error) {
    if (!(error instanceof WorkspaceFileChangedBeforeAtomicWrite)) {
      throw error;
    }
    recordDiagnosticEvent({
      area: 'workspace-files',
      event: 'tiptap.sidecar.needs-review',
      fields: {
        kind,
        objectType,
        reason: 'content-conflict',
      },
      level: 'warn',
    });
    pushTiptapSidecarReviewEntry({
      directory,
      kind,
      markdownFileName,
      objectType,
      reason: 'content-conflict',
      ...(reviewEntries ? { reviewEntries } : {}),
    });
    return false;
  }

  if (!reconciled.ok) {
    recordDiagnosticEvent({
      area: 'workspace-files',
      event: 'tiptap.sidecar.needs-review',
      fields: {
        kind,
        objectType,
        reason: reconciled.reason,
      },
      level: 'warn',
    });
    pushTiptapSidecarReviewEntry({
      directory,
      kind,
      markdownFileName,
      objectType,
      reason: reconciled.reason,
      ...(reviewEntries ? { reviewEntries } : {}),
    });
    return false;
  }
  if (reconciled.bodyMarkdownChanged && kind === 'note' && noteManifest) {
    await updatePassiveNoteSidecarManifest({
      ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
      bodyMarkdown: reconciled.bodyMarkdown,
      manifest: noteManifest,
      rootPath,
    });
  }
  return reconciled.bodyMarkdownChanged;
}

async function passivelyReconcileExistingTiptapSidecarsForSupplements({
  assertWorkspaceUsable: assertUsable,
  fileTruth,
  reviewEntries,
  rootPath,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly fileTruth: FinalizedSegmentFileTruth;
  readonly reviewEntries?: WorkspaceReviewEntryInput[];
  readonly rootPath: string;
}): Promise<boolean> {
  const { metadata, recordingDirectory, segmentId } = fileTruth;
  const supplementsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(recordingDirectory, 'supplements')
  );
  let entries: Dirent[];
  try {
    entries = await readExistingDirectoryEntries(supplementsDirectory);
  } catch {
    return false;
  }

  const candidates: Array<{
    readonly directory: string;
    readonly directoryIdentity: DirectoryIdentity;
    readonly metadata: FinalizedSupplementSemanticTruth;
  }> = [];
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const supplementDirectory = await resolveSafeWorkspaceChild(
        rootPath,
        path.join(supplementsDirectory, entry.name)
      );
      await assertSafeExistingDirectory(supplementDirectory, 'Segment supplement path is not safe');
      const supplementDirectoryIdentity = await readDirectoryIdentity(supplementDirectory);
      const supplement = await readFinalizedSegmentSupplementMetadata(
        rootPath,
        supplementDirectory,
        supplementDirectoryIdentity
      );
      if (
        supplement.workspaceId !== metadata.workspaceId ||
        supplement.memoryId !== metadata.memoryId ||
        supplement.segmentId !== segmentId
      ) {
        continue;
      }
      if (seen.has(supplement.supplementId)) {
        duplicated.add(supplement.supplementId);
        continue;
      }
      seen.add(supplement.supplementId);
      candidates.push({
        directory: supplementDirectory,
        directoryIdentity: supplementDirectoryIdentity,
        metadata: supplement,
      });
    } catch {
      continue;
    }
  }

  let bodyMarkdownChanged = false;
  for (const candidate of candidates) {
    if (duplicated.has(candidate.metadata.supplementId)) {
      continue;
    }
    assertWorkspaceUsable(assertUsable);
    bodyMarkdownChanged =
      (await passivelyReconcileExistingTiptapSidecar({
        ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
        directory: candidate.directory,
        directoryIdentity: candidate.directoryIdentity,
        markdownFileName: 'supplement.md',
        ...(candidate.metadata.kind === 'note' ? { noteManifest: candidate.metadata } : {}),
        objectType: 'supplement',
        ...(reviewEntries ? { reviewEntries } : {}),
        rootPath,
      })) || bodyMarkdownChanged;
  }
  return bodyMarkdownChanged;
}

async function passivelyReconcileExistingTiptapSidecarsForMemoryDirectory({
  assertWorkspaceUsable: assertUsable,
  memory,
  memoryDirectoryPath,
  reviewEntries,
  rootPath,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly memory: MemoryFileTruth;
  readonly memoryDirectoryPath: string;
  readonly reviewEntries?: WorkspaceReviewEntryInput[];
  readonly rootPath: string;
}): Promise<{
  readonly bodyMarkdownChanged: boolean;
  readonly fileTruths: readonly FinalizedSegmentFileTruth[];
}> {
  const fileTruths = await listValidFinalizedSegmentFileTruthsFromMemoryDirectory({
    rootPath,
    memoryId: memory.memoryId,
    memoryDirectoryPath,
    ...(reviewEntries ? { reviewEntries } : {}),
  });

  let bodyMarkdownChanged = false;
  for (const fileTruth of fileTruths) {
    assertWorkspaceUsable(assertUsable);
    bodyMarkdownChanged =
      (await passivelyReconcileExistingTiptapSidecar({
        ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
        directory: fileTruth.recordingDirectory,
        directoryIdentity: fileTruth.recordingDirectoryIdentity,
        markdownFileName: 'segment.md',
        ...(fileTruth.metadata.kind === 'note' ? { noteManifest: fileTruth.metadata } : {}),
        objectType: 'segment',
        ...(reviewEntries ? { reviewEntries } : {}),
        rootPath,
      })) || bodyMarkdownChanged;
    assertWorkspaceUsable(assertUsable);
    bodyMarkdownChanged =
      (await passivelyReconcileExistingTiptapSidecarsForSupplements({
        ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
        fileTruth,
        ...(reviewEntries ? { reviewEntries } : {}),
        rootPath,
      })) || bodyMarkdownChanged;
  }
  return { bodyMarkdownChanged, fileTruths };
}

async function readFinalizedSegmentIdFromMetadata(
  rootPath: string,
  recordingDirectory: string
): Promise<string | null> {
  try {
    const recordingDirectoryIdentity = await readDirectoryIdentity(recordingDirectory);
    const recording = await readFinalizedSegmentMetadata(
      rootPath,
      recordingDirectory,
      recordingDirectoryIdentity
    );
    return recording.segmentId;
  } catch {
    return null;
  }
}

async function readFinalizedSupplementIdFromMetadata(
  rootPath: string,
  supplementDirectory: string
): Promise<string | null> {
  try {
    const supplementDirectoryIdentity = await readDirectoryIdentity(supplementDirectory);
    const supplement = await readFinalizedSegmentSupplementMetadata(
      rootPath,
      supplementDirectory,
      supplementDirectoryIdentity
    );
    return supplement.supplementId;
  } catch {
    return null;
  }
}

async function listValidFinalizedSegmentFileTruths(
  rootPath: string,
  memoryId: string,
  options: FileTruthListOptions = {}
): Promise<FinalizedSegmentFileTruth[]> {
  await beforeSegmentFileTruthListForTest?.();
  const directory = await memoryDirectory(rootPath, memoryId);
  return listValidFinalizedSegmentFileTruthsFromMemoryDirectory({
    rootPath,
    memoryId,
    memoryDirectoryPath: directory,
    ...options,
  });
}

async function listValidFinalizedSegmentFileTruthsFromMemoryDirectory({
  rootPath,
  memoryId,
  memoryDirectoryPath,
  repairFileSpaceCandidates = true,
  reviewEntries,
}: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly memoryDirectoryPath: string;
  readonly repairFileSpaceCandidates?: boolean;
  readonly reviewEntries?: WorkspaceReviewEntryInput[];
}): Promise<FinalizedSegmentFileTruth[]> {
  if (repairFileSpaceCandidates) {
    await reconcileNoteSegmentsInMemoryDirectory({
      rootPath,
      memoryId,
      memoryDirectoryPath,
      ...(reviewEntries ? { reviewEntries } : {}),
    });
  }
  const segmentsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(memoryDirectoryPath, 'segments')
  );
  const entries = await readExistingDirectoryEntries(segmentsDirectory);
  const fileTruths: FinalizedSegmentFileTruth[] = [];
  const seen = new Set<string>();
  const duplicated = new Set<string>();

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const recordingDirectory = await resolveSafeWorkspaceChild(
      rootPath,
      path.join(segmentsDirectory, entry.name)
    );
    const fileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
      rootPath,
      recordingDirectory,
      memoryId,
    });
    if (!fileTruth) {
      continue;
    }
    const { segmentId } = fileTruth;
    if (seen.has(segmentId)) {
      duplicated.add(segmentId);
      continue;
    }
    seen.add(segmentId);
    fileTruths.push(fileTruth);
  }

  return fileTruths.filter((fileTruth) => !duplicated.has(fileTruth.segmentId));
}

async function readValidFinalizedSegmentFileTruth(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<FinalizedSegmentFileTruth | null> {
  const recordingDirectory = await memorySegmentDirectory(rootPath, memoryId, segmentId);
  const fileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
    rootPath,
    recordingDirectory,
    memoryId,
  });
  return fileTruth?.segmentId === segmentId ? fileTruth : null;
}

async function summarizeMemoryFromFileTruths({
  fileTruths,
  memory,
  repairFileSpaceCandidates = true,
  reviewEntries,
  rootPath,
}: {
  readonly fileTruths: readonly FinalizedSegmentFileTruth[];
  readonly memory: MemoryFileTruth;
  readonly repairFileSpaceCandidates?: boolean;
  readonly reviewEntries?: WorkspaceReviewEntryInput[];
  readonly rootPath: string;
}): Promise<MemorySummary> {
  let segmentCount = 0;
  let audioSegmentCount = 0;
  let noteSegmentCount = 0;
  let audioDurationMs = 0;
  let audioByteLength = 0;
  let hasAudioTranscript = false;
  let hasAnyNote = false;
  let supplementCount = 0;
  let updatedAt = memory.updatedAt;

  for (const fileTruth of fileTruths) {
    try {
      const supplements = await listValidSegmentSupplementsFromDirectory({
        rootPath,
        workspaceId: fileTruth.metadata.workspaceId,
        memoryId: memory.memoryId,
        segmentId: fileTruth.segmentId,
        recordingDirectory: fileTruth.recordingDirectory,
        repairFileSpaceCandidates,
        ...(reviewEntries ? { reviewEntries } : {}),
      });
      updatedAt = latestIsoTimestamp(
        updatedAt,
        fileTruth.metadata.updatedAt ?? fileTruth.metadata.finalizedAt,
        ...supplements.map((supplement) => supplement.updatedAt)
      );
      segmentCount += 1;
      if (isAudioSegmentFileTruth(fileTruth)) {
        audioSegmentCount += 1;
        audioDurationMs += fileTruth.metadata.durationMs;
        audioByteLength += fileTruth.audioByteLength;
        hasAudioTranscript =
          hasAudioTranscript ||
          extractSegmentTranscript(fileTruth.metadata.markdownContent).length > 0;
      } else {
        noteSegmentCount += 1;
        hasAnyNote = true;
      }
      hasAnyNote = hasAnyNote || hasNoteSupplement(supplements);
      supplementCount += supplements.length;
    } catch {
      continue;
    }
  }

  return {
    memoryId: memory.memoryId,
    title: memory.title,
    createdAt: memory.createdAt,
    updatedAt,
    segmentCount,
    audioSegmentCount,
    noteSegmentCount,
    audioDurationMs,
    audioByteLength,
    hasAudioTranscript,
    hasAnyNote,
    supplementCount,
  };
}

async function summarizeMemory(
  rootPath: string,
  memory: MemoryFileTruth,
  options: FileTruthListOptions = {}
): Promise<MemorySummary> {
  return summarizeMemoryFromFileTruths({
    fileTruths: await listValidFinalizedSegmentFileTruths(rootPath, memory.memoryId, options),
    memory,
    ...options,
    rootPath,
  });
}

async function summarizeMemoryFromDirectory({
  fileTruths,
  memory,
  memoryDirectoryPath,
  reviewEntries,
  rootPath,
}: {
  readonly fileTruths?: readonly FinalizedSegmentFileTruth[];
  readonly memory: MemoryFileTruth;
  readonly memoryDirectoryPath: string;
  readonly reviewEntries?: WorkspaceReviewEntryInput[];
  readonly rootPath: string;
}): Promise<MemorySummary> {
  await beforeSegmentFileTruthListForTest?.();
  return summarizeMemoryFromFileTruths({
    fileTruths:
      fileTruths ??
      (await listValidFinalizedSegmentFileTruthsFromMemoryDirectory({
        rootPath,
        memoryId: memory.memoryId,
        memoryDirectoryPath,
        ...(reviewEntries ? { reviewEntries } : {}),
      })),
    memory,
    ...(reviewEntries ? { reviewEntries } : {}),
    rootPath,
  });
}

function summarizeMemoryFromSegments(
  memory: MemoryFileTruth,
  segments: readonly WorkspaceSegmentProjection[]
): MemorySummary {
  let updatedAt = memory.updatedAt;
  let audioSegmentCount = 0;
  let noteSegmentCount = 0;
  let audioDurationMs = 0;
  let audioByteLength = 0;
  let hasAudioTranscript = false;
  let hasAnyNote = false;
  let supplementCount = 0;

  for (const segment of segments) {
    updatedAt = latestIsoTimestamp(updatedAt, segment.updatedAt);
    if (segment.type === 'audio') {
      audioSegmentCount += 1;
      audioDurationMs += segment.durationMs;
      audioByteLength += segment.audioByteLength;
      hasAudioTranscript = hasAudioTranscript || segment.transcript.exists;
    } else {
      noteSegmentCount += 1;
      hasAnyNote = true;
    }
    hasAnyNote = hasAnyNote || hasNoteSupplement(segment.supplements);
    supplementCount += segment.supplementCount;
  }

  return {
    memoryId: memory.memoryId,
    title: memory.title,
    createdAt: memory.createdAt,
    updatedAt,
    segmentCount: segments.length,
    audioSegmentCount,
    noteSegmentCount,
    audioDurationMs,
    audioByteLength,
    hasAudioTranscript,
    hasAnyNote,
    supplementCount,
  };
}

async function readValidFinalizedSegmentProjection({
  rootPath,
  workspaceId,
  memoryId,
  segmentId,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
}): Promise<WorkspaceSegmentProjection | null> {
  try {
    const fileTruth = await readValidFinalizedSegmentFileTruth(rootPath, memoryId, segmentId);
    if (!fileTruth || fileTruth.metadata.workspaceId !== workspaceId) {
      return null;
    }
    return await finalizedSegmentProjectionFromFileTruth({ rootPath, workspaceId, fileTruth });
  } catch {
    return null;
  }
}

async function finalizedSegmentProjectionFromFileTruth({
  rootPath,
  workspaceId,
  fileTruth,
  repairFileSpaceCandidates = true,
}: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly fileTruth: FinalizedSegmentFileTruth;
  readonly repairFileSpaceCandidates?: boolean;
}): Promise<WorkspaceSegmentProjection | null> {
  const { metadata, recordingDirectory, segmentId } = fileTruth;
  if (metadata.workspaceId !== workspaceId) {
    return null;
  }
  const supplements = await listValidSegmentSupplementsFromDirectory({
    rootPath,
    workspaceId,
    memoryId: metadata.memoryId,
    segmentId,
    recordingDirectory,
    repairFileSpaceCandidates,
  });
  const updatedAt = latestIsoTimestamp(
    metadata.updatedAt ?? metadata.finalizedAt,
    ...supplements.map((supplement) => supplement.updatedAt)
  );
  const segmentBase = {
    workspaceId,
    memoryId: metadata.memoryId,
    segmentId,
    title: titleFromFileSpaceDirectoryName({
      nodeId: segmentId,
      directoryName: path.basename(recordingDirectory),
      metadataTitle: metadata.title,
    }),
    ...(metadata.contentTitle !== undefined ? { contentTitle: metadata.contentTitle } : {}),
    createdAt: metadata.createdAt,
    updatedAt,
    supplementCount: supplements.length,
    supplements,
    contentTabOrder: normalizeContentTabOrder(metadata.contentTabOrder, supplements),
  };

  if (!isAudioSegmentFileTruth(fileTruth)) {
    return {
      ...segmentBase,
      type: 'note',
      bodyByteLength: fileTruth.metadata.bodyByteLength,
    };
  }

  return {
    ...segmentBase,
    type: 'audio',
    durationMs: fileTruth.metadata.durationMs,
    audioByteLength: fileTruth.audioByteLength,
    lastTranscriptionAttempt: deriveLastTranscriptionAttempt(fileTruth.metadata),
    transcript: {
      exists: extractSegmentTranscript(fileTruth.metadata.markdownContent).length > 0,
    },
  };
}

export async function readFinalizedSegmentProjection(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
}): Promise<WorkspaceSegmentProjection> {
  const projection = await readValidFinalizedSegmentProjection(input);

  if (!projection) {
    throw new Error('Finalized segment projection does not match file truth');
  }

  return projection;
}

export async function readFinalizedSegmentAudioProjection(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
}): Promise<{
  readonly audioByteLength: number;
  readonly lastTranscriptionAttempt: 'failed' | 'never' | 'success';
  readonly transcript: { readonly exists: boolean };
}> {
  const fileTruth = await readValidFinalizedSegmentFileTruth(
    input.rootPath,
    input.memoryId,
    input.segmentId
  );
  if (!isAudioSegmentFileTruth(fileTruth) || fileTruth.metadata.workspaceId !== input.workspaceId) {
    throw new Error('Finalized segment projection does not match file truth');
  }

  return {
    audioByteLength: fileTruth.audioByteLength,
    lastTranscriptionAttempt: deriveLastTranscriptionAttempt(fileTruth.metadata),
    transcript: {
      exists: extractSegmentTranscript(fileTruth.metadata.markdownContent).length > 0,
    },
  };
}

export async function readFinalizedSegmentSupplementProjection(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
}): Promise<WorkspaceSegmentSupplementProjection> {
  const supplementDirectory = await segmentSupplementDirectory(
    input.rootPath,
    input.memoryId,
    input.segmentId,
    input.supplementId
  );
  const projection = await readValidFinalizedSupplementProjectionFromDirectory({
    supplementDirectory,
    rootPath: input.rootPath,
    workspaceId: input.workspaceId,
    memoryId: input.memoryId,
    segmentId: input.segmentId,
  });

  if (!projection || projection.supplementId !== input.supplementId) {
    throw new Error('Finalized segment supplement projection does not match file truth');
  }

  return projection;
}

export async function readFinalizedSegmentSupplementProjectionFromKnownDirectory(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementDirectory: string;
  readonly supplementId: string;
}): Promise<WorkspaceSegmentSupplementProjection> {
  const projection = await readValidFinalizedSupplementProjectionFromDirectory({
    supplementDirectory: input.supplementDirectory,
    rootPath: input.rootPath,
    workspaceId: input.workspaceId,
    memoryId: input.memoryId,
    segmentId: input.segmentId,
  });

  if (!projection || projection.supplementId !== input.supplementId) {
    throw new Error('Finalized segment supplement projection does not match file truth');
  }

  return projection;
}

export async function resolveFinalizedNoteSegmentDirectoryFromManifest(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly segmentId: string;
}): Promise<{ readonly memoryId: string; readonly segmentDirectory: string }> {
  const manifest = segmentObjectManifestSchema.parse(
    JSON.parse(
      await readWorkspaceTextFile(await segmentObjectManifestPath(input.rootPath, input.segmentId))
    )
  );
  if (
    manifest.kind !== 'note' ||
    manifest.workspaceId !== input.workspaceId ||
    manifest.segmentId !== input.segmentId
  ) {
    throw new Error('Finalized note segment manifest does not match attachment owner');
  }
  return {
    memoryId: manifest.memoryId,
    segmentDirectory: await memorySegmentDirectory(
      input.rootPath,
      manifest.memoryId,
      input.segmentId
    ),
  };
}

export async function resolveFinalizedNoteSupplementDirectoryFromManifest(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly segmentId: string;
  readonly supplementId: string;
}): Promise<{
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementDirectory: string;
}> {
  const manifest = supplementObjectManifestSchema.parse(
    JSON.parse(
      await readWorkspaceTextFile(
        await supplementObjectManifestPath(input.rootPath, input.supplementId)
      )
    )
  );
  if (
    manifest.kind !== 'note' ||
    manifest.workspaceId !== input.workspaceId ||
    manifest.segmentId !== input.segmentId ||
    manifest.supplementId !== input.supplementId
  ) {
    throw new Error('Finalized note supplement manifest does not match attachment owner');
  }
  const segmentDirectory = await memorySegmentDirectory(
    input.rootPath,
    manifest.memoryId,
    input.segmentId
  );
  return {
    memoryId: manifest.memoryId,
    segmentId: manifest.segmentId,
    supplementDirectory: await resolveSegmentSupplementDirectoryInSegmentDirectory({
      rootPath: input.rootPath,
      memoryId: manifest.memoryId,
      segmentDirectory,
      segmentId: manifest.segmentId,
      supplementId: input.supplementId,
    }),
  };
}

export async function readMemoryDetailFromFileTruth(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<MemoryFilesResult<WorkspaceMemoryDetailProjection>> {
  try {
    await beforeMemoryDetailProjectionForTest?.();
    assertWorkspaceUsable(input.assertWorkspaceUsable);
    const memory = await readMemoryFileTruth(input.rootPath, input.memoryId, {
      ...(input.assertWorkspaceUsable
        ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
        : {}),
      repairMissingManifest: true,
    });
    const segments: WorkspaceSegmentProjection[] = [];

    assertWorkspaceUsable(input.assertWorkspaceUsable);
    const segmentFileTruths = await listValidFinalizedSegmentFileTruths(
      input.rootPath,
      input.memoryId
    );
    for (const fileTruth of segmentFileTruths) {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const segment = await finalizedSegmentProjectionFromFileTruth({
        rootPath: input.rootPath,
        workspaceId: input.workspaceId,
        fileTruth,
      });
      if (segment) {
        segments.push(segment);
      }
    }

    assertWorkspaceUsable(input.assertWorkspaceUsable);
    const sortedSegments = sortByProjectedUpdatedAt(segments);
    const summary = summarizeMemoryFromSegments(memory, sortedSegments);
    return {
      ok: true,
      value: {
        ...summary,
        workspaceId: input.workspaceId,
        segments: sortedSegments,
      },
    };
  } catch (error) {
    return memoryFilesError(
      error,
      'ERR_MEMORY_NOT_FOUND',
      'Memory detail could not be read',
      'previous-file-preserved'
    );
  }
}

export async function rebuildWorkspaceReadModel(
  rootPath: string,
  {
    passiveTiptapSidecarReconcile = false,
    persist = false,
    assertWorkspaceUsable: assertUsable,
  }: {
    readonly passiveTiptapSidecarReconcile?: boolean;
    readonly persist?: boolean;
    readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  } = {}
): Promise<{
  readonly memories: MemorySummary[];
  readonly assertMemoriesRootCurrent: () => Promise<void>;
  readonly reviewEntries: readonly WorkspaceReviewEntryInput[];
}> {
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  const memoriesDirectoryIdentity = await readDirectoryIdentity(memoriesDirectory);
  await beforeReadModelReaddirForTest?.();
  await assertSameDirectoryPathAsync(memoriesDirectory, memoriesDirectoryIdentity);
  const entries = await readExistingDirectoryEntries(memoriesDirectory);
  await assertSameDirectoryPathAsync(memoriesDirectory, memoriesDirectoryIdentity);
  const memories: MemorySummary[] = [];
  const reviewEntries: WorkspaceReviewEntryInput[] = [];
  for (const entry of entries) {
    assertWorkspaceUsable(assertUsable);
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      await assertSameDirectoryPathAsync(memoriesDirectory, memoriesDirectoryIdentity);
      const memoryDirectoryPath = path.join(memoriesDirectory, entry.name);
      const memory = await readMemoryFileTruthFromDirectory(rootPath, memoryDirectoryPath, {
        ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
        repairMissingManifest: true,
      });
      let fileTruths: readonly FinalizedSegmentFileTruth[] | undefined;
      if (passiveTiptapSidecarReconcile) {
        let passiveReconcile: Awaited<
          ReturnType<typeof passivelyReconcileExistingTiptapSidecarsForMemoryDirectory>
        >;
        try {
          passiveReconcile = await passivelyReconcileExistingTiptapSidecarsForMemoryDirectory({
            ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
            memory,
            memoryDirectoryPath,
            reviewEntries,
            rootPath,
          });
        } catch (error) {
          throw new PassiveTiptapSidecarReconcileFailed(error);
        }
        if (!passiveReconcile.bodyMarkdownChanged) {
          fileTruths = passiveReconcile.fileTruths;
        }
      }
      memories.push(
        await summarizeMemoryFromDirectory({
          ...(fileTruths ? { fileTruths } : {}),
          reviewEntries,
          rootPath,
          memory,
          memoryDirectoryPath,
        })
      );
    } catch (error) {
      if (
        error instanceof WorkspaceHandleLost ||
        error instanceof PassiveTiptapSidecarReconcileFailed
      ) {
        throw error;
      }
      continue;
    }
  }
  await assertSameDirectoryPathAsync(memoriesDirectory, memoriesDirectoryIdentity);

  let sortedMemories = sortByProjectedUpdatedAt(memories);
  if (persist) {
    await beforeReadModelReplaceForTest?.();
    sortedMemories = [
      ...(await replaceWorkspaceIndex(
        rootPath,
        async () => {
          assertWorkspaceUsable(assertUsable);
          const current = await rebuildWorkspaceReadModel(rootPath, { persist: false });
          return current.memories;
        },
        async () => {
          assertWorkspaceUsable(assertUsable);
          await beforeReadModelPersistForTest?.();
          await assertSameDirectoryPathAsync(memoriesDirectory, memoriesDirectoryIdentity);
          assertWorkspaceUsable(assertUsable);
        }
      )),
    ];
  }
  return {
    memories: sortedMemories,
    assertMemoriesRootCurrent: () =>
      assertSameDirectoryPathAsync(memoriesDirectory, memoriesDirectoryIdentity),
    reviewEntries,
  };
}

export async function rebuildMemoryIndex(
  rootPath: string,
  options: {
    readonly persist?: boolean;
    readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  } = {}
): Promise<MemorySummary[]> {
  return (
    await rebuildWorkspaceReadModel(rootPath, {
      persist: options.persist ?? true,
      ...(options.assertWorkspaceUsable
        ? { assertWorkspaceUsable: options.assertWorkspaceUsable }
        : {}),
    })
  ).memories;
}

export async function refreshMemoryIndexEntry(
  rootPath: string,
  memoryId: string,
  assertUsable?: AssertWorkspaceUsable
): Promise<MemorySummary> {
  await beforeMemoryIndexEntryReadForTest?.();
  return withWorkspaceIndexWriteLock(rootPath, async () => {
    assertWorkspaceUsable(assertUsable);
    const summary = await summarizeMemory(
      rootPath,
      await readMemoryFileTruth(rootPath, memoryId, {
        ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
        repairMissingManifest: true,
      }),
      {
        repairFileSpaceCandidates: false,
      }
    );
    assertWorkspaceUsable(assertUsable);
    const index = workspaceIndexSchema.parse(
      JSON.parse(await readWorkspaceTextFile(getWorkspaceIndexPath(rootPath)))
    );
    const memories = upsertMemorySummaryByProjectedOrder(index.memories, summary);
    await writeWorkspaceJsonAtomic(
      getWorkspaceIndexPath(rootPath),
      {
        schemaVersion: 1,
        memories,
      },
      () => assertWorkspaceUsable(assertUsable)
    );
    return summary;
  });
}

export async function refreshMemoryIndexEntryWithDetail(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<{
  readonly detail: WorkspaceMemoryDetailProjection;
  readonly memory: MemorySummary;
}> {
  await beforeMemoryDetailProjectionForTest?.();
  await beforeMemoryIndexEntryReadForTest?.();
  return withWorkspaceIndexWriteLock(input.rootPath, async () => {
    assertWorkspaceUsable(input.assertUsable);
    const memory = await readMemoryFileTruth(input.rootPath, input.memoryId, {
      ...(input.assertUsable ? { assertWorkspaceUsable: input.assertUsable } : {}),
      repairMissingManifest: true,
    });
    const fileTruths = await listValidFinalizedSegmentFileTruths(input.rootPath, input.memoryId, {
      repairFileSpaceCandidates: false,
    });
    const segments: WorkspaceSegmentProjection[] = [];
    for (const fileTruth of fileTruths) {
      assertWorkspaceUsable(input.assertUsable);
      const segment = await finalizedSegmentProjectionFromFileTruth({
        rootPath: input.rootPath,
        workspaceId: input.workspaceId,
        fileTruth,
        repairFileSpaceCandidates: false,
      });
      if (segment) {
        segments.push(segment);
      }
    }
    const sortedSegments = sortByProjectedUpdatedAt(segments);
    const summary = summarizeMemoryFromSegments(memory, sortedSegments);
    assertWorkspaceUsable(input.assertUsable);
    const index = workspaceIndexSchema.parse(
      JSON.parse(await readWorkspaceTextFile(getWorkspaceIndexPath(input.rootPath)))
    );
    const memories = upsertMemorySummaryByProjectedOrder(index.memories, summary);
    await writeWorkspaceJsonAtomic(
      getWorkspaceIndexPath(input.rootPath),
      {
        schemaVersion: 1,
        memories,
      },
      () => assertWorkspaceUsable(input.assertUsable)
    );
    return {
      detail: {
        ...summary,
        workspaceId: input.workspaceId,
        segments: sortedSegments,
      },
      memory: summary,
    };
  });
}

async function refreshMemoryIndexEntryFromKnownFileTruths({
  assertUsable,
  fileTruths,
  memory,
  rootPath,
}: {
  readonly assertUsable?: AssertWorkspaceUsable;
  readonly fileTruths: readonly FinalizedSegmentFileTruth[];
  readonly memory: MemoryFileTruth;
  readonly rootPath: string;
}): Promise<{ readonly memory: MemorySummary; readonly memoryFileTruth: MemoryFileTruth }> {
  await beforeMemoryIndexEntryReadForTest?.();
  return withWorkspaceIndexWriteLock(rootPath, async () => {
    assertWorkspaceUsable(assertUsable);
    const summary = await summarizeMemoryFromFileTruths({
      fileTruths,
      memory,
      rootPath,
    });
    assertWorkspaceUsable(assertUsable);
    const index = workspaceIndexSchema.parse(
      JSON.parse(await readWorkspaceTextFile(getWorkspaceIndexPath(rootPath)))
    );
    const memories = upsertMemorySummaryByProjectedOrder(index.memories, summary);
    await writeWorkspaceJsonAtomic(
      getWorkspaceIndexPath(rootPath),
      {
        schemaVersion: 1,
        memories,
      },
      () => assertWorkspaceUsable(assertUsable)
    );
    return { memory: summary, memoryFileTruth: memory };
  });
}

export async function replaceWorkspaceIndex(
  rootPath: string,
  readMemories: () => MaybePromise<readonly MemorySummary[]>,
  beforeWrite?: () => MaybePromise<void>
): Promise<readonly MemorySummary[]> {
  let persisted: readonly MemorySummary[] = [];
  await withWorkspaceIndexWriteLock(rootPath, async () => {
    await beforeWrite?.();
    const memories = await readMemories();
    await afterReadModelReplaceReadForTest?.();
    await beforeWrite?.();
    persisted = memories;
    await writeWorkspaceJsonAtomic(getWorkspaceIndexPath(rootPath), {
      schemaVersion: 1,
      memories,
    });
  });
  return persisted;
}

export async function updateWorkspaceIndexFromCurrent(
  rootPath: string,
  update: (memories: readonly MemorySummary[]) => readonly MemorySummary[]
): Promise<void> {
  await withWorkspaceIndexWriteLock(rootPath, async () => {
    const index = workspaceIndexSchema.parse(
      JSON.parse(await readWorkspaceTextFile(getWorkspaceIndexPath(rootPath)))
    );
    await writeWorkspaceJsonAtomic(getWorkspaceIndexPath(rootPath), {
      schemaVersion: 1,
      memories: update(index.memories),
    });
  });
}

export async function readFinalizedSegmentSummary(
  rootPath: string,
  memoryId: string,
  segmentId: string
): Promise<MemorySegmentSummary> {
  return summarizeRecording(rootPath, memoryId, segmentId);
}

export async function readFinalizedSegmentSummaryFromKnownDirectory({
  memoryId,
  recordingDirectory,
  recordingDirectoryIdentity,
  rootPath,
  segmentId,
}: {
  readonly memoryId: string;
  readonly recordingDirectory: string;
  readonly recordingDirectoryIdentity: DirectoryIdentity;
  readonly rootPath: string;
  readonly segmentId: string;
}): Promise<MemorySegmentSummary> {
  const fileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
    rootPath,
    recordingDirectory,
    memoryId,
  });
  if (!isAudioSegmentFileTruth(fileTruth) || fileTruth.segmentId !== segmentId) {
    throw new Error('Finalized segment metadata does not match file truth');
  }
  await assertSameDirectoryPathAsync(recordingDirectory, recordingDirectoryIdentity);
  return {
    segmentId,
    title: fileTruth.metadata.title,
    durationMs: fileTruth.metadata.durationMs,
    audioByteLength: fileTruth.audioByteLength,
    lastTranscriptionAttempt: deriveLastTranscriptionAttempt(fileTruth.metadata),
  };
}

export async function recoverRecordingFinalizeTransactions(
  rootPath: string,
  {
    removeDraftDirectory,
    beforeRecordingRecoveryRemove,
    afterDraftCleanup,
    assertWorkspaceUsable: assertRecoveryWorkspaceUsable,
  }: RecoverFinalizeTransactionsOptions = {}
): Promise<void> {
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  const memoryEntries = await readExistingDirectoryEntries(memoriesDirectory);
  for (const memoryEntry of memoryEntries) {
    if (!memoryEntry.isDirectory()) {
      continue;
    }
    const memoryDirectoryPath = await resolveSafeWorkspaceChild(
      rootPath,
      path.join(memoriesDirectory, memoryEntry.name)
    );
    let memoryId = memoryEntry.name;
    let segmentsDirectory: string | null = null;
    let recordingEntries: Dirent[] = [];
    let memory: MemoryFileTruth | null = null;
    try {
      memory = await readMemoryFileTruthFromDirectory(rootPath, memoryDirectoryPath);
      memoryId = memory.memoryId;
    } catch {
      // Invalid memory metadata is ignored during transaction recovery.
    }
    try {
      segmentsDirectory = await resolveSafeWorkspaceChild(
        rootPath,
        path.join(memoryDirectoryPath, 'segments')
      );
      recordingEntries = await readExistingDirectoryEntries(segmentsDirectory);
    } catch {
      // Unsafe segments paths are not followed during recovery.
    }
    const validSegmentIds = new Set<string>();
    let markerBearingRecordingFound = false;
    let needsFileTruthRecovery = false;

    for (const recordingEntry of recordingEntries) {
      if (!segmentsDirectory) {
        continue;
      }
      const recordingDirectory = path.join(segmentsDirectory, recordingEntry.name);
      if (!recordingEntry.isDirectory()) {
        continue;
      }
      if (recordingEntry.name.startsWith(FINALIZE_STAGING_PREFIX)) {
        const finalizedSegmentFileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
          rootPath,
          memoryId,
          recordingDirectory,
        });
        const hasMarker = await hasFinalizeTransactionMarker(recordingDirectory);
        const hasPayload = await finalizedPayloadExists(recordingDirectory);
        needsFileTruthRecovery ||= hasMarker;
        if (finalizedSegmentFileTruth || (!hasMarker && hasPayload)) {
          markerBearingRecordingFound = markerBearingRecordingFound || !memory;
          continue;
        }
        await beforeRecordingRecoveryRemove?.();
        await assertRecoveryWorkspaceUsable?.();
        const removed = await removeSafeWorkspaceDirectory(
          rootPath,
          path.join(memoryDirectoryPath, 'segments', recordingEntry.name)
        );
        if (removed) {
          await assertRecoveryWorkspaceUsable?.();
          await fsyncWorkspaceDirectory(segmentsDirectory).catch(() => {});
        }
        continue;
      }
      if (!(await hasFinalizeTransactionMarker(recordingDirectory))) {
        if (memory) {
          needsFileTruthRecovery ||= await segmentSupplementRecoveryWorkExists({
            rootPath,
            recordingDirectory,
          }).catch(() => false);
        }
        continue;
      }
      needsFileTruthRecovery = true;
      const finalizedSegmentFileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
        rootPath,
        memoryId,
        recordingDirectory,
      });
      const finalizedSegmentId = finalizedSegmentFileTruth?.segmentId ?? null;
      const metadataSegmentId =
        finalizedSegmentId ??
        (await readFinalizedSegmentIdFromMetadata(rootPath, recordingDirectory));
      const recordingSegmentId =
        metadataSegmentId ??
        (SEGMENT_ID_PATTERN.test(recordingEntry.name) ? recordingEntry.name : null);
      const validFinalizedSegment = finalizedSegmentId !== null;
      const markerBearingPayloadExists = await finalizedPayloadExists(recordingDirectory);
      if (!memory) {
        if (validFinalizedSegment || markerBearingPayloadExists) {
          markerBearingRecordingFound = true;
          continue;
        }
        await beforeRecordingRecoveryRemove?.();
        await assertRecoveryWorkspaceUsable?.();
        await removeSafeWorkspaceDirectory(
          rootPath,
          path.join(memoryDirectoryPath, 'segments', recordingEntry.name)
        );
        continue;
      }
      const memoryReferencesRecording = validFinalizedSegment || recordingSegmentId !== null;
      if (memoryReferencesRecording) {
        if (recordingSegmentId === null) {
          continue;
        }
        if (!validFinalizedSegment) {
          validSegmentIds.add(recordingSegmentId);
          continue;
        }
        validSegmentIds.add(recordingSegmentId);
        const draftDirectory = await draftSegmentDirectory(rootPath, recordingSegmentId);
        try {
          await assertRecoveryWorkspaceUsable?.();
          if (removeDraftDirectory) {
            await removeDraftDirectory(draftDirectory);
          } else {
            const removed = await removeSafeWorkspaceDirectory(rootPath, draftDirectory);
            if (!removed && !(await isSafeMissingWorkspaceChild(rootPath, draftDirectory))) {
              throw new Error('Recording draft cleanup path is not safe');
            }
          }
        } catch {
          continue;
        }
        try {
          await afterDraftCleanup?.();
          await assertRecoveryWorkspaceUsable?.();
          await fsyncWorkspaceDirectory(path.join(rootPath, '.reo', 'drafts', 'segments'));
          await assertRecoveryWorkspaceUsable?.();
          await unlinkFinalizeTransactionMarker(rootPath, memoryId, recordingSegmentId);
        } catch {
          continue;
        }
        continue;
      }
      if (markerBearingPayloadExists) {
        continue;
      }
      await beforeRecordingRecoveryRemove?.();
      await assertRecoveryWorkspaceUsable?.();
      await removeSafeWorkspaceDirectory(rootPath, recordingDirectory);
    }

    if (!memory) {
      if (markerBearingRecordingFound) {
        continue;
      }
      await assertRecoveryWorkspaceUsable?.();
      await removeMetadataLessEmptyMemoryDirectory(
        rootPath,
        memoryId,
        assertRecoveryWorkspaceUsable
      );
      continue;
    }
    if (!needsFileTruthRecovery) {
      continue;
    }
    const fileTruthSegments = await listValidFinalizedSegmentFileTruths(rootPath, memoryId).catch(
      (): FinalizedSegmentFileTruth[] => []
    );
    for (const fileTruth of fileTruthSegments) {
      await recoverSegmentSupplementFinalizeTransactions({
        rootPath,
        workspaceId: fileTruth.metadata.workspaceId,
        memoryId,
        segmentId: fileTruth.segmentId,
        recordingDirectory: fileTruth.recordingDirectory,
        ...(beforeRecordingRecoveryRemove ? { beforeRecordingRecoveryRemove } : {}),
        ...(afterDraftCleanup ? { afterDraftCleanup } : {}),
        ...(assertRecoveryWorkspaceUsable
          ? { assertWorkspaceUsable: assertRecoveryWorkspaceUsable }
          : {}),
      });
    }
  }
}

async function writeFinalizeTransactionMarker({
  targetRecordingDirectory,
  memoryId,
  segmentId,
}: {
  readonly targetRecordingDirectory: string;
  readonly memoryId: string;
  readonly segmentId: string;
}): Promise<void> {
  await writeWorkspaceJsonAtomic(path.join(targetRecordingDirectory, FINALIZE_TRANSACTION_MARKER), {
    schemaVersion: 1,
    memoryId,
    segmentId,
    draftPath: `.reo/drafts/segments/${segmentId}`,
  });
}

async function copyDirectoryContents(
  sourceDirectory: string,
  targetDirectory: string,
  allowedFiles: ReadonlySet<string> = DRAFT_RECORDING_FILES
): Promise<void> {
  const sourceIdentity = readDirectoryIdentitySync(
    sourceDirectory,
    'Recording draft directory is not safe'
  );
  const targetIdentity = readDirectoryIdentitySync(
    targetDirectory,
    'Recording staging directory is not safe'
  );

  for (const entry of readWorkspaceDirectoryEntriesInDirectory({
    directory: sourceDirectory,
    directoryIdentity: sourceIdentity,
  })) {
    if (!entry.isFile() || entry.isSymbolicLink() || !allowedFiles.has(entry.name)) {
      throw new Error('Recording draft file is not safe');
    }
    await copyFileBetweenDirectories({
      sourceDirectory,
      sourceIdentity,
      targetDirectory,
      targetIdentity,
      fileName: entry.name,
    });
  }
}

async function copyFileBetweenDirectories({
  sourceDirectory,
  sourceIdentity,
  targetDirectory,
  targetIdentity,
  fileName,
}: {
  readonly sourceDirectory: string;
  readonly sourceIdentity: DirectoryIdentity;
  readonly targetDirectory: string;
  readonly targetIdentity: DirectoryIdentity;
  readonly fileName: string;
}): Promise<void> {
  let sourceFd: number | null = null;
  let targetFd: number | null = null;
  let targetCreated = false;
  try {
    sourceFd = openExistingWorkspaceFileInDirectory({
      directory: sourceDirectory,
      directoryIdentity: sourceIdentity,
      fileName,
      flags: constants.O_RDONLY | constants.O_NOFOLLOW,
    });
    const source = fstatSync(sourceFd);
    if (!source.isFile()) {
      throw new Error('Recording draft file is not safe');
    }

    targetFd = openNoReplaceWorkspaceFileInDirectory({
      directory: targetDirectory,
      directoryIdentity: targetIdentity,
      fileName,
    });
    targetCreated = true;

    const buffer = Buffer.allocUnsafe(Math.min(COPY_BUFFER_BYTES, Math.max(1, source.size)));
    let offset = 0;
    while (offset < source.size) {
      const { bytesRead } = await readDescriptor(
        sourceFd,
        buffer,
        0,
        Math.min(buffer.byteLength, source.size - offset),
        offset
      );
      if (bytesRead === 0) {
        throw new Error('Recording draft file changed during copy');
      }
      let bytesWritten = 0;
      while (bytesWritten < bytesRead) {
        const { bytesWritten: written } = await writeDescriptor(
          targetFd,
          buffer,
          bytesWritten,
          bytesRead - bytesWritten,
          offset + bytesWritten
        );
        bytesWritten += written;
      }
      offset += bytesRead;
    }

    await fsyncDescriptor(targetFd);
    assertSameDirectoryPath(sourceDirectory, sourceIdentity);
    assertSameDirectoryPath(targetDirectory, targetIdentity);
  } catch (error) {
    if (targetFd !== null) {
      closeSync(targetFd);
      targetFd = null;
    }
    if (targetCreated) {
      try {
        removeWorkspaceFileInDirectory({
          directory: targetDirectory,
          directoryIdentity: targetIdentity,
          fileName,
        });
      } catch {
        // Cleanup only touches the original staging directory identity.
      }
    }
    throw error;
  } finally {
    if (sourceFd !== null) {
      closeSync(sourceFd);
    }
    if (targetFd !== null) {
      closeSync(targetFd);
    }
  }
}

async function resolveSafeCleanupDirectory(
  rootPath: string,
  directoryPath: string
): Promise<string | null> {
  try {
    const rootAbsolute = await realpath(rootPath);
    const rootInputAbsolute = path.resolve(rootPath);
    const directoryAbsolute = path.resolve(directoryPath);
    let relative = path.relative(rootInputAbsolute, directoryAbsolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      relative = path.relative(rootAbsolute, directoryAbsolute);
    }
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return null;
    }

    let current = rootAbsolute;
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      const entry = await lstat(current);
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        return null;
      }
    }

    return directoryAbsolute;
  } catch {
    return null;
  }
}

async function isSafeMissingWorkspaceChild(
  rootPath: string,
  directoryPath: string
): Promise<boolean> {
  try {
    const rootAbsolute = await realpath(rootPath);
    const rootInputAbsolute = path.resolve(rootPath);
    const directoryAbsolute = path.resolve(directoryPath);
    let relative = path.relative(rootInputAbsolute, directoryAbsolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      relative = path.relative(rootAbsolute, directoryAbsolute);
    }
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return false;
    }

    const segments = relative.split(path.sep).filter(Boolean);
    let current = rootAbsolute;
    for (const segment of segments.slice(0, -1)) {
      current = path.join(current, segment);
      const entry = await lstat(current);
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        return false;
      }
    }

    try {
      await lstat(path.join(rootAbsolute, ...segments));
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT';
    }
  } catch {
    return false;
  }
}

export async function removeSafeWorkspaceDirectory(
  rootPath: string,
  directoryPath: string,
  options?: SafeWorkspaceDirectoryRemoveOptions
): Promise<boolean> {
  const safeDirectory = await resolveSafeCleanupDirectory(rootPath, directoryPath);
  if (!safeDirectory) {
    return options?.allowMissing ? isSafeMissingWorkspaceChild(rootPath, directoryPath) : false;
  }
  const parentDirectory = path.dirname(safeDirectory);
  const directoryName = path.basename(safeDirectory);
  const parentIdentity = await readDirectoryIdentity(parentDirectory);
  const directoryIdentity = await readDirectoryIdentity(safeDirectory);
  await options?.beforeSafeCleanupRemove?.();
  const currentSafeDirectory = await resolveSafeCleanupDirectory(rootPath, directoryPath);
  if (currentSafeDirectory !== safeDirectory) {
    return options?.allowMissing ? isSafeMissingWorkspaceChild(rootPath, directoryPath) : false;
  }
  removeWorkspaceDirectoryTreeInDirectory({
    directory: parentDirectory,
    directoryIdentity: parentIdentity,
    targetName: directoryName,
    targetIdentity: directoryIdentity,
  });
  return true;
}

async function removeEmptyWorkspaceDirectory(
  rootPath: string,
  directoryPath: string
): Promise<boolean> {
  const safeDirectory = await resolveSafeCleanupDirectory(rootPath, directoryPath);
  if (!safeDirectory) {
    return false;
  }
  const parentDirectory = path.dirname(safeDirectory);
  const directoryName = path.basename(safeDirectory);
  const parentIdentity = await readDirectoryIdentity(parentDirectory);
  const directoryIdentity = await readDirectoryIdentity(safeDirectory);
  removeEmptyWorkspaceDirectoryInDirectory({
    directory: parentDirectory,
    directoryIdentity: parentIdentity,
    targetName: directoryName,
    targetIdentity: directoryIdentity,
  });
  return true;
}

async function removeDraftSegmentDirectorySafely(
  rootPath: string,
  segmentId: string,
  hooks?: FinalizeTransactionHooks
): Promise<void> {
  const draftDirectory = await draftSegmentDirectory(rootPath, segmentId);
  await hooks?.beforeDraftDirectoryRemove?.();
  const removed = await removeSafeWorkspaceDirectory(rootPath, draftDirectory, {
    allowMissing: true,
  });
  if (!removed) {
    throw new Error('Recording draft cleanup path is not safe');
  }
}

async function removeDraftSupplementDirectorySafely(
  rootPath: string,
  supplementId: string,
  hooks?: FinalizeTransactionHooks
): Promise<void> {
  const draftDirectory = await draftSupplementDirectory(rootPath, supplementId);
  await hooks?.beforeDraftDirectoryRemove?.();
  const removed = await removeSafeWorkspaceDirectory(rootPath, draftDirectory, {
    allowMissing: true,
  });
  if (!removed) {
    throw new Error('Segment supplement draft cleanup path is not safe');
  }
}

async function removeMetadataLessEmptyMemoryDirectory(
  rootPath: string,
  memoryId: string,
  assertWorkspaceUsable?: () => MaybePromise<void>
): Promise<void> {
  const directory = await memoryDirectory(rootPath, memoryId).catch(() => null);
  if (!directory || (await exists(path.join(directory, 'memory.md')))) {
    return;
  }
  const entries = await readExistingDirectoryNames(directory);
  if (entries.length === 0) {
    await assertWorkspaceUsable?.();
    await removeEmptyWorkspaceDirectory(rootPath, directory).catch(() => {});
    return;
  }
  if (entries.length !== 1 || entries[0] !== 'segments') {
    return;
  }
  const segmentsDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(directory, 'segments')
  );
  const segmentEntries = await readExistingDirectoryNames(segmentsDirectory);
  if (segmentEntries.length > 0) {
    return;
  }
  await assertWorkspaceUsable?.();
  const segmentsRemoved = await removeEmptyWorkspaceDirectory(rootPath, segmentsDirectory).catch(
    () => false
  );
  if (!segmentsRemoved) {
    return;
  }
  await assertWorkspaceUsable?.();
  await removeEmptyWorkspaceDirectory(rootPath, directory).catch(() => {});
}

async function cleanupPreExposeFinalizeArtifacts({
  rootPath,
  segmentId,
  memoryDirectoryPath,
  hooks,
}: {
  readonly rootPath: string;
  readonly segmentId: string;
  readonly memoryDirectoryPath: string;
  readonly hooks?: FinalizeTransactionHooks;
}): Promise<void> {
  const segmentsDirectory = await resolveSafeCleanupDirectory(
    rootPath,
    path.join(memoryDirectoryPath, 'segments')
  );
  if (segmentsDirectory) {
    const stagingPrefix = `${FINALIZE_STAGING_PREFIX}${segmentId}.`;
    for (const entry of await readdir(segmentsDirectory, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith(stagingPrefix)) {
        await removeSafeWorkspaceDirectory(
          rootPath,
          path.join(segmentsDirectory, entry.name),
          hooks
        );
      }
    }
    await fsyncWorkspaceDirectory(segmentsDirectory).catch(() => {});
  }

  const safeMemoryDirectory = await resolveSafeCleanupDirectory(rootPath, memoryDirectoryPath);
  if (!safeMemoryDirectory) {
    return;
  }

  let hasMemoryMarkdown: boolean;
  try {
    hasMemoryMarkdown = await exists(path.join(safeMemoryDirectory, 'memory.md'));
  } catch {
    hasMemoryMarkdown = true;
  }

  if (!hasMemoryMarkdown) {
    await removeSafeWorkspaceDirectory(rootPath, safeMemoryDirectory, hooks);
  }
}

async function copyDraftRecordingIntoMemory({
  rootPath,
  memoryId,
  segmentId,
  title,
  memoryTitleForCreate,
  hooks,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly memoryTitleForCreate?: string;
  readonly hooks?: FinalizeTransactionHooks;
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<{
  readonly stagingSegmentDirectory: string;
  readonly targetRecordingDirectory: string;
}> {
  const targetMemoryDirectory = await memoryDirectoryForWriteTarget(
    rootPath,
    memoryId,
    memoryTitleForCreate
  );
  const targetDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(targetMemoryDirectory, 'segments', fileSpaceNodeDirectoryName(segmentId, title))
  );
  const parentDirectory = path.dirname(targetDirectory);
  const memoryDirectoryPath = path.dirname(parentDirectory);
  const stagingDirectory = path.join(
    parentDirectory,
    `${FINALIZE_STAGING_PREFIX}${segmentId}.${process.pid}.${Date.now()}`
  );
  const stagingName = path.basename(stagingDirectory);
  try {
    assertWorkspaceUsable(assertUsable);
    if (await segmentDirectoryExistsInAnyMemory(rootPath, segmentId)) {
      throw new Error('Recording target already exists');
    }
    await hooks?.beforeParentDirectoryCreate?.();
    assertWorkspaceUsable(assertUsable);
    const segmentsDirectory = await ensureMemoryRecordingsDirectory(
      rootPath,
      memoryId,
      memoryTitleForCreate,
      hooks
    );
    if (segmentsDirectory !== parentDirectory) {
      throw new Error('Recording target parent changed');
    }
    await fsyncWorkspaceDirectory(path.dirname(path.dirname(parentDirectory))).catch(() => {});
    await fsyncWorkspaceDirectory(path.dirname(parentDirectory)).catch(() => {});
    await fsyncWorkspaceDirectory(parentDirectory).catch(() => {});
    await assertSafeExistingDirectory(
      parentDirectory,
      'Workspace memory segments directory is not safe'
    );
    await hooks?.beforeStagingDirectoryCreate?.();
    assertWorkspaceUsable(assertUsable);
    createWorkspaceDirectoryWithinParent({
      parentDirectory,
      directoryName: stagingName,
    });
    await hooks?.afterStagingDirectoryCreate?.();
    const markerStagingDirectory = await resolveSafeWorkspaceChild(rootPath, stagingDirectory);
    await assertSafeExistingDirectory(markerStagingDirectory, 'Recording staging path is not safe');
    assertWorkspaceUsable(assertUsable);
    await writeFinalizeTransactionMarker({
      targetRecordingDirectory: markerStagingDirectory,
      memoryId,
      segmentId,
    });
    await hooks?.afterMarkerWrite?.();
    assertWorkspaceUsable(assertUsable);
    await draftSegmentDirectory(rootPath, segmentId);
    await fsyncWorkspaceDirectory(markerStagingDirectory);
    await hooks?.beforeDraftCopy?.();
    assertWorkspaceUsable(assertUsable);
    const copyStagingDirectory = await resolveSafeWorkspaceChild(rootPath, stagingDirectory);
    await assertSafeExistingDirectory(copyStagingDirectory, 'Recording staging path is not safe');
    await copyDirectoryContents(
      await draftSegmentDirectory(rootPath, segmentId),
      copyStagingDirectory
    );
    await hooks?.afterCopy?.();
    assertWorkspaceUsable(assertUsable);
    const finalStagingDirectory = await resolveSafeWorkspaceChild(rootPath, stagingDirectory);
    await assertSafeExistingDirectory(finalStagingDirectory, 'Recording staging path is not safe');
    await fsyncDirectoryTree(finalStagingDirectory);
    return {
      stagingSegmentDirectory: finalStagingDirectory,
      targetRecordingDirectory: targetDirectory,
    };
  } catch (error) {
    if (error instanceof WorkspaceHandleLost) {
      throw error;
    }
    await cleanupPreExposeFinalizeArtifacts({
      rootPath,
      segmentId,
      memoryDirectoryPath,
      ...(hooks ? { hooks } : {}),
    });
    throw error;
  }
}

async function writeFinalizedSegmentFiles({
  targetRecordingDirectory,
  workspaceId,
  memoryId,
  segmentId,
  title,
  durationMs,
  finalizedAt,
  lastTranscriptionAttemptOnFinalize,
}: {
  readonly targetRecordingDirectory: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly finalizedAt: string;
  readonly lastTranscriptionAttemptOnFinalize?: FinalizeTranscriptionAttempt;
}): Promise<SegmentObjectManifest> {
  const targetIdentity = await readDirectoryIdentity(
    targetRecordingDirectory,
    'Recording finalize path crosses a symlink'
  );
  const audioFd = openExistingWorkspaceFileInDirectory({
    directory: targetRecordingDirectory,
    directoryIdentity: targetIdentity,
    fileName: 'audio.webm',
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
  const audio = fstatSync(audioFd);
  closeSync(audioFd);
  if (!audio.isFile()) {
    throw new Error('Recording audio path is unsafe');
  }
  const draftMetadata = draftSegmentMetadataSchema.parse(
    JSON.parse(
      readWorkspaceTextFileInKnownDirectory(
        targetRecordingDirectory,
        targetIdentity,
        'segment.json'
      )
    )
  );
  if (
    draftMetadata.workspaceId !== workspaceId ||
    draftMetadata.segmentId !== segmentId ||
    draftMetadata.audioByteLength !== audio.size
  ) {
    throw new Error('Draft segment metadata does not match file truth');
  }
  await writeSegmentMarkdownInKnownDirectory({
    directory: targetRecordingDirectory,
    directoryIdentity: targetIdentity,
    title,
  });
  unlinkFileInKnownDirectory(targetRecordingDirectory, targetIdentity, 'segment.json');
  unlinkFileInKnownDirectoryIfExists(targetRecordingDirectory, targetIdentity, 'transcript.md');
  return {
    schemaVersion: 1,
    objectType: 'segment',
    workspaceId,
    memoryId,
    segmentId,
    kind: 'audio',
    createdAt: draftMetadata.createdAt,
    finalizedAt,
    updatedAt: finalizedAt,
    durationMs,
    nextSequence: draftMetadata.nextSequence,
    audioByteLength: audio.size,
    lastTranscriptionAttempt: initialFinalizeTranscriptionAttempt(
      lastTranscriptionAttemptOnFinalize
    ),
  };
}

async function writeFinalizedSupplementFiles({
  targetSupplementDirectory,
  workspaceId,
  memoryId,
  segmentId,
  supplementId,
  title,
  durationMs,
  finalizedAt,
  lastTranscriptionAttemptOnFinalize,
}: {
  readonly targetSupplementDirectory: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly finalizedAt: string;
  readonly lastTranscriptionAttemptOnFinalize?: FinalizeTranscriptionAttempt;
}): Promise<SupplementObjectManifest> {
  const targetIdentity = await readDirectoryIdentity(
    targetSupplementDirectory,
    'Segment supplement finalize path crosses a symlink'
  );
  const audioFd = openExistingWorkspaceFileInDirectory({
    directory: targetSupplementDirectory,
    directoryIdentity: targetIdentity,
    fileName: 'audio.webm',
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
  const audio = fstatSync(audioFd);
  closeSync(audioFd);
  if (!audio.isFile()) {
    throw new Error('Segment supplement audio path is unsafe');
  }
  const draftMetadata = draftSegmentSupplementMetadataSchema.parse(
    JSON.parse(
      readWorkspaceTextFileInKnownDirectory(
        targetSupplementDirectory,
        targetIdentity,
        'supplement.json'
      )
    )
  );
  if (
    draftMetadata.workspaceId !== workspaceId ||
    draftMetadata.memoryId !== memoryId ||
    draftMetadata.segmentId !== segmentId ||
    draftMetadata.supplementId !== supplementId ||
    draftMetadata.audioByteLength !== audio.size
  ) {
    throw new Error('Draft segment supplement metadata does not match file truth');
  }
  await writeSupplementMarkdownInKnownDirectory({
    directory: targetSupplementDirectory,
    directoryIdentity: targetIdentity,
    title,
  });
  unlinkFileInKnownDirectory(targetSupplementDirectory, targetIdentity, 'supplement.json');
  unlinkFileInKnownDirectoryIfExists(targetSupplementDirectory, targetIdentity, 'transcript.md');
  return {
    schemaVersion: 1,
    objectType: 'supplement',
    workspaceId,
    memoryId,
    segmentId,
    supplementId,
    kind: 'audio',
    createdAt: draftMetadata.createdAt,
    finalizedAt,
    updatedAt: finalizedAt,
    durationMs,
    nextSequence: draftMetadata.nextSequence,
    audioByteLength: audio.size,
    lastTranscriptionAttempt: initialFinalizeTranscriptionAttempt(
      lastTranscriptionAttemptOnFinalize
    ),
  };
}

async function finishFinalizeTransaction({
  rootPath,
  stagingSegmentDirectory,
  targetRecordingDirectory,
  memoryId,
  nextMemory,
  previousMemory,
  segmentId,
  workspaceId,
  title,
  durationMs,
  finalizedAt,
  lastTranscriptionAttemptOnFinalize,
  rebuildIndex,
  hooks,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly stagingSegmentDirectory: string;
  readonly targetRecordingDirectory: string;
  readonly memoryId: string;
  readonly nextMemory: MemoryFileTruth;
  readonly previousMemory: MemoryFileTruth | null;
  readonly segmentId: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly finalizedAt: string;
  readonly lastTranscriptionAttemptOnFinalize?: FinalizeTranscriptionAttempt;
  readonly rebuildIndex?: (rootPath: string) => Promise<readonly MemorySummary[]>;
  readonly hooks?: FinalizeTransactionHooks;
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<MemorySummary> {
  const targetMemoryDirectory = path.dirname(path.dirname(targetRecordingDirectory));
  const directory = targetMemoryDirectory;
  let rollbackDurableRecording = true;
  let rollbackMemory = true;
  let segmentManifestWritten = false;
  let refreshedMemory: MemorySummary;
  try {
    assertWorkspaceUsable(assertUsable);
    const segmentManifest = await writeFinalizedSegmentFiles({
      targetRecordingDirectory: stagingSegmentDirectory,
      workspaceId,
      memoryId,
      segmentId,
      title,
      durationMs,
      finalizedAt,
      ...(lastTranscriptionAttemptOnFinalize ? { lastTranscriptionAttemptOnFinalize } : {}),
    });
    await fsyncDirectoryTree(stagingSegmentDirectory);
    await hooks?.afterStagingTreeFsync?.();
    assertWorkspaceUsable(assertUsable);
    await hooks?.beforeExpose?.();
    const currentTargetRecordingDirectory = targetRecordingDirectory;
    const currentStagingRecordingDirectory = path.join(
      path.dirname(currentTargetRecordingDirectory),
      path.basename(stagingSegmentDirectory)
    );
    await assertSafeExistingDirectory(
      currentStagingRecordingDirectory,
      'Recording staging path is not safe'
    );
    await hooks?.beforeFinalRename?.();
    assertWorkspaceUsable(assertUsable);
    const finalTargetRecordingDirectory = targetRecordingDirectory;
    const finalStagingRecordingDirectory = path.join(
      path.dirname(finalTargetRecordingDirectory),
      path.basename(stagingSegmentDirectory)
    );
    await assertSafeExistingDirectory(
      finalStagingRecordingDirectory,
      'Recording staging path is not safe'
    );
    renameWorkspaceDirectoryWithinParent({
      parentDirectory: path.dirname(finalTargetRecordingDirectory),
      sourceName: path.basename(finalStagingRecordingDirectory),
      targetName: path.basename(finalTargetRecordingDirectory),
      ...(hooks?.beforeFinalRenameCommit ? { beforeCommit: hooks.beforeFinalRenameCommit } : {}),
      ...(hooks?.afterFinalRenameTargetPreflight
        ? { afterTargetPreflight: hooks.afterFinalRenameTargetPreflight }
        : {}),
      ...(hooks?.afterFinalRenameLastPreflight
        ? { afterLastTargetPreflight: hooks.afterFinalRenameLastPreflight }
        : {}),
    });
    await assertSafeExistingDirectory(
      finalTargetRecordingDirectory,
      'Recording target path is not safe'
    );
    await hooks?.afterFinalRename?.();
    assertWorkspaceUsable(assertUsable);
    await writeSegmentObjectManifest({
      rootPath,
      segment: segmentManifest,
      ...(assertUsable ? { assertUsable } : {}),
    });
    segmentManifestWritten = true;
    await hooks?.afterParentFsync?.();
    assertWorkspaceUsable(assertUsable);
    await writeMemoryMarkdownAndManifest({
      rootPath,
      memoryDirectoryPath: targetMemoryDirectory,
      memory: {
        schemaVersion: 1,
        objectType: 'memory',
        memoryId: nextMemory.memoryId,
        title: nextMemory.title,
        createdAt: nextMemory.createdAt,
        updatedAt: nextMemory.updatedAt,
      },
      ...(assertUsable ? { assertUsable } : {}),
    });
    assertWorkspaceUsable(assertUsable);
    if (rebuildIndex) {
      const memories = await rebuildIndex(rootPath);
      const rebuiltMemory = memories.find((candidate) => candidate.memoryId === memoryId) ?? null;
      if (!rebuiltMemory) {
        throw new Error('Finalized memory summary missing');
      }
      refreshedMemory = rebuiltMemory;
    } else {
      refreshedMemory = await refreshMemoryIndexEntry(rootPath, memoryId, assertUsable);
    }
    await hooks?.beforeDraftCleanup?.();
    assertWorkspaceUsable(assertUsable);
    await removeDraftSegmentDirectorySafely(rootPath, segmentId, hooks);
    rollbackDurableRecording = false;
    rollbackMemory = false;
    await hooks?.afterDraftCleanup?.();
    assertWorkspaceUsable(assertUsable);
    await fsyncWorkspaceDirectory(path.join(rootPath, '.reo', 'drafts', 'segments'));
    assertWorkspaceUsable(assertUsable);
    await unlinkFinalizeTransactionMarker(rootPath, memoryId, segmentId);
    return refreshedMemory;
  } catch (error) {
    if (error instanceof WorkspaceHandleLost) {
      throw error;
    }
    await removeSafeWorkspaceDirectory(rootPath, stagingSegmentDirectory, hooks).catch(() => {});
    const safeTargetRecordingDirectory = await resolveSafeCleanupDirectory(
      rootPath,
      targetRecordingDirectory
    );
    if (rollbackDurableRecording && safeTargetRecordingDirectory) {
      const hasMarker = await hasFinalizeTransactionMarker(safeTargetRecordingDirectory).catch(
        () => false
      );
      if (hasMarker) {
        await removeSafeWorkspaceDirectory(rootPath, safeTargetRecordingDirectory, hooks).catch(
          () => {}
        );
      }
    }
    if (segmentManifestWritten && rollbackDurableRecording) {
      const manifestPath = await segmentObjectManifestPath(rootPath, segmentId).catch(() => null);
      if (manifestPath) {
        try {
          unlinkSync(manifestPath);
        } catch (unlinkError) {
          if ((unlinkError as NodeJS.ErrnoException).code !== 'ENOENT') {
            // Rollback will report the original finalize failure below.
          }
        }
      }
    }
    if (rollbackMemory) {
      if (previousMemory) {
        const rollbackMemoryDirectory = await memoryDirectory(rootPath, memoryId).catch(() => null);
        if (rollbackMemoryDirectory) {
          await writeMemoryMarkdownAndManifest({
            rootPath,
            memoryDirectoryPath: rollbackMemoryDirectory,
            memory: {
              schemaVersion: 1,
              objectType: 'memory',
              memoryId: previousMemory.memoryId,
              title: previousMemory.title,
              createdAt: previousMemory.createdAt,
              updatedAt: previousMemory.updatedAt,
            },
          }).catch(() => {});
        }
      } else {
        await removeSafeWorkspaceDirectory(rootPath, directory, hooks).catch(() => {});
        const manifestPath = await memoryObjectManifestPath(rootPath, memoryId).catch(() => null);
        if (manifestPath) {
          try {
            unlinkSync(manifestPath);
          } catch (unlinkError) {
            if ((unlinkError as NodeJS.ErrnoException).code !== 'ENOENT') {
              // Rollback will report the original finalize failure below.
            }
          }
        }
      }
      const rebuildAfterRollback = rebuildIndex
        ? () => rebuildIndex(rootPath)
        : () =>
            rebuildMemoryIndex(rootPath, {
              ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
            });
      await rebuildAfterRollback().catch(() => {});
    }
    throw new FinalizeTransactionFailure(
      error,
      rollbackMemory ? 'draft-preserved' : 'durable-marker-recovery-required'
    );
  }
}

async function finishSupplementFinalizeTransaction({
  rootPath,
  stagingSupplementDirectory,
  targetSupplementDirectory,
  memoryId,
  segmentId,
  supplementId,
  workspaceId,
  nextMemory,
  previousMemory,
  title,
  durationMs,
  finalizedAt,
  lastTranscriptionAttemptOnFinalize,
  rebuildIndex,
  hooks,
  assertUsable,
}: {
  readonly rootPath: string;
  readonly stagingSupplementDirectory: string;
  readonly targetSupplementDirectory: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly workspaceId: string;
  readonly nextMemory: MemoryFileTruth;
  readonly previousMemory: MemoryFileTruth;
  readonly title: string;
  readonly durationMs: number;
  readonly finalizedAt: string;
  readonly lastTranscriptionAttemptOnFinalize?: FinalizeTranscriptionAttempt;
  readonly rebuildIndex?: (rootPath: string) => Promise<readonly MemorySummary[]>;
  readonly hooks?: FinalizeTransactionHooks;
  readonly assertUsable?: AssertWorkspaceUsable;
}): Promise<{
  readonly memory: MemorySummary;
  readonly segment: WorkspaceSegmentProjection;
  readonly supplement: WorkspaceSegmentSupplementProjection;
}> {
  let rollbackDurableSupplement = true;
  let rollbackMemory = true;
  let supplementManifestWritten = false;
  try {
    assertWorkspaceUsable(assertUsable);
    const supplementManifest = await writeFinalizedSupplementFiles({
      targetSupplementDirectory: stagingSupplementDirectory,
      workspaceId,
      memoryId,
      segmentId,
      supplementId,
      title,
      durationMs,
      finalizedAt,
      ...(lastTranscriptionAttemptOnFinalize ? { lastTranscriptionAttemptOnFinalize } : {}),
    });
    await fsyncDirectoryTree(stagingSupplementDirectory);
    await hooks?.afterStagingTreeFsync?.();
    assertWorkspaceUsable(assertUsable);
    await hooks?.beforeExpose?.();
    const finalTargetSupplementDirectory = targetSupplementDirectory;
    const finalStagingSupplementDirectory = path.join(
      path.dirname(finalTargetSupplementDirectory),
      path.basename(stagingSupplementDirectory)
    );
    await assertSafeExistingDirectory(
      finalStagingSupplementDirectory,
      'Segment supplement staging path is not safe'
    );
    await hooks?.beforeFinalRename?.();
    assertWorkspaceUsable(assertUsable);
    renameWorkspaceDirectoryWithinParent({
      parentDirectory: path.dirname(finalTargetSupplementDirectory),
      sourceName: path.basename(finalStagingSupplementDirectory),
      targetName: path.basename(finalTargetSupplementDirectory),
      ...(hooks?.beforeFinalRenameCommit ? { beforeCommit: hooks.beforeFinalRenameCommit } : {}),
      ...(hooks?.afterFinalRenameTargetPreflight
        ? { afterTargetPreflight: hooks.afterFinalRenameTargetPreflight }
        : {}),
      ...(hooks?.afterFinalRenameLastPreflight
        ? { afterLastTargetPreflight: hooks.afterFinalRenameLastPreflight }
        : {}),
    });
    await assertSafeExistingDirectory(
      finalTargetSupplementDirectory,
      'Workspace segment supplement directory is not safe'
    );
    await hooks?.afterFinalRename?.();
    assertWorkspaceUsable(assertUsable);
    await writeSupplementObjectManifest({
      rootPath,
      supplement: supplementManifest,
      ...(assertUsable ? { assertUsable } : {}),
    });
    supplementManifestWritten = true;
    await hooks?.afterParentFsync?.();
    assertWorkspaceUsable(assertUsable);
    const currentMemoryDirectory = await memoryDirectory(rootPath, memoryId);
    await writeMemoryMarkdownAndManifest({
      rootPath,
      memoryDirectoryPath: currentMemoryDirectory,
      memory: {
        schemaVersion: 1,
        objectType: 'memory',
        memoryId: nextMemory.memoryId,
        title: nextMemory.title,
        createdAt: nextMemory.createdAt,
        updatedAt: nextMemory.updatedAt,
      },
      ...(assertUsable ? { assertUsable } : {}),
    });
    assertWorkspaceUsable(assertUsable);
    const memory = rebuildIndex
      ? (await rebuildIndex(rootPath)).find((candidate) => candidate.memoryId === memoryId)
      : await refreshMemoryIndexEntry(rootPath, memoryId, assertUsable);
    if (!memory) {
      throw new Error('Segment supplement memory summary missing');
    }
    const segment = await readValidFinalizedSegmentProjection({
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
    });
    const supplement = await readValidFinalizedSupplementProjection({
      supplementDirectory: finalTargetSupplementDirectory,
      supplementDirectoryIdentity: await readDirectoryIdentity(finalTargetSupplementDirectory),
      rootPath,
      workspaceId,
      memoryId,
      segmentId,
    });
    if (!segment || !supplement) {
      throw new Error('Segment supplement projection missing');
    }
    await hooks?.beforeDraftCleanup?.();
    assertWorkspaceUsable(assertUsable);
    await removeDraftSupplementDirectorySafely(rootPath, supplementId, hooks);
    rollbackDurableSupplement = false;
    rollbackMemory = false;
    await hooks?.afterDraftCleanup?.();
    assertWorkspaceUsable(assertUsable);
    await fsyncWorkspaceDirectory(path.join(rootPath, '.reo', 'drafts', 'supplements'));
    assertWorkspaceUsable(assertUsable);
    await unlinkFinalizeTransactionMarkerInDirectory(finalTargetSupplementDirectory);
    return { memory, segment, supplement };
  } catch (error) {
    if (error instanceof WorkspaceHandleLost) {
      throw error;
    }
    await removeSafeWorkspaceDirectory(rootPath, stagingSupplementDirectory, hooks).catch(() => {});
    const safeTargetSupplementDirectory = await resolveSafeCleanupDirectory(
      rootPath,
      targetSupplementDirectory
    );
    if (rollbackDurableSupplement && safeTargetSupplementDirectory) {
      const hasMarker = await hasFinalizeTransactionMarker(safeTargetSupplementDirectory).catch(
        () => false
      );
      if (hasMarker) {
        await removeSafeWorkspaceDirectory(rootPath, safeTargetSupplementDirectory, hooks).catch(
          () => {}
        );
      }
    }
    if (supplementManifestWritten && rollbackDurableSupplement) {
      const manifestPath = await supplementObjectManifestPath(rootPath, supplementId).catch(
        () => null
      );
      if (manifestPath) {
        try {
          unlinkSync(manifestPath);
        } catch (unlinkError) {
          if ((unlinkError as NodeJS.ErrnoException).code !== 'ENOENT') {
            // Rollback will report the original finalize failure below.
          }
        }
      }
    }
    if (rollbackMemory) {
      const rollbackMemoryDirectory = await memoryDirectory(rootPath, memoryId).catch(() => null);
      if (rollbackMemoryDirectory) {
        await writeMemoryMarkdownAndManifest({
          rootPath,
          memoryDirectoryPath: rollbackMemoryDirectory,
          memory: {
            schemaVersion: 1,
            objectType: 'memory',
            memoryId: previousMemory.memoryId,
            title: previousMemory.title,
            createdAt: previousMemory.createdAt,
            updatedAt: previousMemory.updatedAt,
          },
        }).catch(() => {});
      }
      const rebuildAfterRollback = rebuildIndex
        ? () => rebuildIndex(rootPath)
        : () =>
            rebuildMemoryIndex(rootPath, {
              ...(assertUsable ? { assertWorkspaceUsable: assertUsable } : {}),
            });
      await rebuildAfterRollback().catch(() => {});
    }
    throw new FinalizeTransactionFailure(
      error,
      rollbackMemory ? 'draft-preserved' : 'durable-marker-recovery-required'
    );
  }
}

async function createMemoryWithRecordingForTestFixture(
  input: CreateMemoryForAudioSegmentInput,
  transactionHooks?: FinalizeTransactionHooks
): Promise<MemoryFilesResult<MemorySummary>> {
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const targetMemoryDirectory = await memoryDirectoryForNewNode(
        input.rootPath,
        input.memoryId,
        input.title
      );
      const existingMemoryDirectory = await memoryDirectory(input.rootPath, input.memoryId);
      if (
        (await exists(existingMemoryDirectory)) ||
        (targetMemoryDirectory !== existingMemoryDirectory && (await exists(targetMemoryDirectory)))
      ) {
        throw new Error('Memory target already exists');
      }
      const createdAt = input.now();
      const memory: MemoryFileTruth = {
        memoryId: input.memoryId,
        title: input.title,
        createdAt,
        updatedAt: createdAt,
      };
      const { stagingSegmentDirectory, targetRecordingDirectory } =
        await copyDraftRecordingIntoMemory({
          rootPath: input.rootPath,
          memoryId: input.memoryId,
          segmentId: input.segmentId,
          title: input.title,
          memoryTitleForCreate: input.title,
          ...(transactionHooks ? { hooks: transactionHooks } : {}),
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
      const summary = await finishFinalizeTransaction({
        rootPath: input.rootPath,
        stagingSegmentDirectory,
        targetRecordingDirectory,
        memoryId: input.memoryId,
        nextMemory: memory,
        previousMemory: null,
        segmentId: input.segmentId,
        workspaceId: input.workspaceId,
        title: input.title,
        durationMs: input.durationMs,
        finalizedAt: createdAt,
        ...(input.lastTranscriptionAttemptOnFinalize
          ? { lastTranscriptionAttemptOnFinalize: input.lastTranscriptionAttemptOnFinalize }
          : {}),
        ...(input.rebuildIndex ? { rebuildIndex: input.rebuildIndex } : {}),
        ...(transactionHooks ? { hooks: transactionHooks } : {}),
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
      });
      return { ok: true, value: summary };
    });
  } catch (error) {
    return memoryFilesError(
      error,
      'ERR_RECORDING_FINALIZE_FAILED',
      'Recording could not be finalized',
      finalizeFailureRetention(error)
    );
  }
}

export async function createMemoryWithRecordingForTest(
  input: CreateMemoryForAudioSegmentForTestInput
): Promise<MemoryFilesResult<MemorySummary>> {
  const { transactionHooks, ...productionInput } = input;
  return createMemoryWithRecordingForTestFixture(productionInput, transactionHooks);
}

export async function createMemoryFromFileTruth(
  input: CreateMemoryInput
): Promise<MemoryFilesResult<MemorySummary>> {
  let createdDirectory: string | null = null;
  let memoryFileWritten = false;
  let manifestPath: string | null = null;

  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memoriesDirectory = await resolveSafeWorkspaceChild(
        input.rootPath,
        path.join(input.rootPath, 'memories')
      );
      await assertSafeExistingDirectory(
        memoriesDirectory,
        'Workspace memories directory is not safe'
      );
      const targetDirectory = await memoryDirectoryForNewNode(
        input.rootPath,
        input.memoryId,
        input.title
      );
      const existingMemoryDirectory = await memoryDirectory(input.rootPath, input.memoryId);
      if (
        (await exists(existingMemoryDirectory)) ||
        (targetDirectory !== existingMemoryDirectory && (await exists(targetDirectory)))
      ) {
        throw new Error('Memory target already exists');
      }
      createWorkspaceDirectoryWithinParent({
        parentDirectory: memoriesDirectory,
        directoryName: path.basename(targetDirectory),
        ...(input.assertWorkspaceUsable
          ? { beforeCommit: () => assertWorkspaceUsable(input.assertWorkspaceUsable) }
          : {}),
      });
      createdDirectory = targetDirectory;
      await assertSafeExistingDirectory(createdDirectory, 'Workspace memory directory is not safe');

      const createdAt = input.now();
      const memory: MemoryFileTruth = {
        memoryId: input.memoryId,
        title: input.title,
        createdAt,
        updatedAt: createdAt,
      };
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      await writeMemoryMarkdownAndManifest({
        rootPath: input.rootPath,
        memoryDirectoryPath: createdDirectory,
        memory: {
          schemaVersion: 1,
          objectType: 'memory',
          memoryId: memory.memoryId,
          title: memory.title,
          createdAt: memory.createdAt,
          updatedAt: memory.updatedAt,
        },
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
      });
      manifestPath = await memoryObjectManifestPath(input.rootPath, input.memoryId);
      memoryFileWritten = true;
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      if (input.rebuildIndex) {
        await input.rebuildIndex(input.rootPath);
      } else {
        await refreshMemoryIndexEntry(input.rootPath, input.memoryId, input.assertWorkspaceUsable);
      }
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      return { ok: true, value: await summarizeMemory(input.rootPath, memory) };
    });
  } catch (error) {
    let cleanupSucceeded = true;
    if (createdDirectory && (!memoryFileWritten || !(error instanceof WorkspaceHandleLost))) {
      cleanupSucceeded = await removeSafeWorkspaceDirectory(input.rootPath, createdDirectory, {
        allowMissing: true,
      }).catch(() => false);
    }
    if (manifestPath && !(error instanceof WorkspaceHandleLost)) {
      try {
        unlinkSync(manifestPath);
      } catch (unlinkError) {
        if ((unlinkError as NodeJS.ErrnoException).code !== 'ENOENT') {
          cleanupSucceeded = false;
        }
      }
    }
    if (memoryFileWritten && !(error instanceof WorkspaceHandleLost)) {
      cleanupSucceeded =
        (await rebuildMemoryIndex(input.rootPath).then(
          () => true,
          () => false
        )) && cleanupSucceeded;
    }
    if (error instanceof WorkspaceHandleLost) {
      return memoryFilesError(
        error,
        'ERR_MEMORY_CREATE_FAILED',
        'Memory could not be created',
        cleanupSucceeded ? 'none-written' : 'unknown'
      );
    }
    return memoryFilesError(
      error,
      'ERR_MEMORY_CREATE_FAILED',
      'Memory could not be created',
      cleanupSucceeded ? 'none-written' : 'unknown'
    );
  }
}

async function moveFileSpaceNodeDirectory({
  sourceName,
  sourceParentDirectory,
  targetName,
  targetParentDirectory,
  assertWorkspaceUsable: assertUsable,
  expectedSourceIdentity,
}: {
  readonly sourceName: string;
  readonly sourceParentDirectory: string;
  readonly targetName: string;
  readonly targetParentDirectory: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly expectedSourceIdentity?: DirectoryIdentity;
}): Promise<void> {
  if (!isSafeWorkspaceDirectoryName(sourceName) || !isSafeWorkspaceDirectoryName(targetName)) {
    throw new Error('Invalid file space node directory name');
  }
  const safeSourceParent = sourceParentDirectory;
  const safeTargetParent = targetParentDirectory;
  await assertSafeExistingDirectory(safeSourceParent, 'Workspace node source parent is not safe');
  await assertSafeExistingDirectory(safeTargetParent, 'Workspace node target parent is not safe');
  assertWorkspaceUsable(assertUsable);
  await beforeFileSpaceNodeMoveForTest?.();
  renameWorkspaceDirectoryAcrossParents({
    sourceParentDirectory: safeSourceParent,
    sourceName,
    targetParentDirectory: safeTargetParent,
    targetName,
    ...(assertUsable ? { beforeCommit: () => assertWorkspaceUsable(assertUsable) } : {}),
    ...(expectedSourceIdentity ? { expectedSourceIdentity } : {}),
  });
}

export async function deleteMemoryFromFileTruth(input: MemoryTargetInput): Promise<
  MemoryFilesResult<{
    readonly memoryId: string;
    readonly restoreToken: string;
    readonly memories: readonly MemorySummary[];
  }>
> {
  let movedToTrash = false;
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memory = await readMemoryFileTruth(input.rootPath, input.memoryId);
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memoriesDirectory = await resolveSafeWorkspaceChild(
        input.rootPath,
        path.join(input.rootPath, 'memories')
      );
      await assertSafeExistingDirectory(
        memoriesDirectory,
        'Workspace memories directory is not safe'
      );
      const trashDirectory = await ensureMemoryTrashDirectory(
        input.rootPath,
        input.assertWorkspaceUsable
      );
      const sourceDirectory = await memoryDirectory(input.rootPath, input.memoryId);
      const sourceName = path.basename(sourceDirectory);
      await moveFileSpaceNodeDirectory({
        sourceName,
        sourceParentDirectory: memoriesDirectory,
        targetName: sourceName,
        targetParentDirectory: trashDirectory,
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      movedToTrash = true;
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memories = await rebuildMemoryIndex(input.rootPath, {
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      return {
        ok: true,
        value: {
          memoryId: memory.memoryId,
          restoreToken: memory.memoryId,
          memories,
        },
      };
    });
  } catch (error) {
    let rollbackSucceeded = !movedToTrash;
    if (movedToTrash && !(error instanceof WorkspaceHandleLost)) {
      try {
        const memoriesDirectory = await resolveSafeWorkspaceChild(
          input.rootPath,
          path.join(input.rootPath, 'memories')
        );
        const trashDirectory = await ensureMemoryTrashDirectory(input.rootPath);
        const sourceDirectory = await trashedMemoryDirectory(input.rootPath, input.memoryId);
        const sourceName = path.basename(sourceDirectory);
        await moveFileSpaceNodeDirectory({
          sourceName,
          sourceParentDirectory: trashDirectory,
          targetName: sourceName,
          targetParentDirectory: memoriesDirectory,
        });
        await rebuildMemoryIndex(input.rootPath);
        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }
    }
    return memoryFilesError(
      error,
      'ERR_MEMORY_DELETE_FAILED',
      'Memory could not be deleted',
      rollbackSucceeded ? 'previous-file-preserved' : 'file-written-index-stale'
    );
  }
}

export async function restoreDeletedMemoryFromFileTruth(input: {
  readonly rootPath: string;
  readonly restoreToken: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly memories: readonly MemorySummary[];
  }>
> {
  let movedToActive = false;
  const memoryId = input.restoreToken;
  try {
    return await withMemoryWriteLock(input.rootPath, memoryId, async () => {
      if (!MEMORY_ID_PATTERN.test(memoryId)) {
        throw new Error('Invalid restore token');
      }
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memoriesDirectory = await resolveSafeWorkspaceChild(
        input.rootPath,
        path.join(input.rootPath, 'memories')
      );
      await assertSafeExistingDirectory(
        memoriesDirectory,
        'Workspace memories directory is not safe'
      );
      const trashDirectory = await ensureMemoryTrashDirectory(
        input.rootPath,
        input.assertWorkspaceUsable
      );
      const sourceDirectory = await trashedMemoryDirectory(input.rootPath, memoryId);
      const sourceName = path.basename(sourceDirectory);
      await moveFileSpaceNodeDirectory({
        sourceName,
        sourceParentDirectory: trashDirectory,
        targetName: sourceName,
        targetParentDirectory: memoriesDirectory,
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      movedToActive = true;
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memories = await rebuildMemoryIndex(input.rootPath, {
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      const memory = memories.find((candidate) => candidate.memoryId === memoryId);
      if (!memory) {
        throw new Error('Restored memory summary missing');
      }
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      return {
        ok: true,
        value: {
          memory,
          memories,
        },
      };
    });
  } catch (error) {
    let rollbackSucceeded = !movedToActive;
    if (movedToActive && !(error instanceof WorkspaceHandleLost)) {
      try {
        const memoriesDirectory = await resolveSafeWorkspaceChild(
          input.rootPath,
          path.join(input.rootPath, 'memories')
        );
        const trashDirectory = await ensureMemoryTrashDirectory(input.rootPath);
        const sourceDirectory = await memoryDirectory(input.rootPath, memoryId);
        const sourceName = path.basename(sourceDirectory);
        await moveFileSpaceNodeDirectory({
          sourceName,
          sourceParentDirectory: memoriesDirectory,
          targetName: sourceName,
          targetParentDirectory: trashDirectory,
        });
        await rebuildMemoryIndex(input.rootPath);
        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }
    }
    return memoryFilesError(
      error,
      'ERR_MEMORY_RESTORE_FAILED',
      'Deleted memory could not be restored',
      rollbackSucceeded ? 'previous-file-preserved' : 'file-written-index-stale'
    );
  }
}

export async function deleteSegmentFromFileTruth(input: SegmentTargetInput): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segmentId: string;
    readonly restoreToken: string;
  }>
> {
  let movedToTrash = false;
  let previousMemory: MemoryFileTruth | null = null;
  let movedSegmentDirectoryIdentity: DirectoryIdentity | null = null;
  let movedSegmentDirectoryName: string | null = null;
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      previousMemory = await readMemoryFileTruth(input.rootPath, input.memoryId);
      const sourceDirectory = await memorySegmentDirectory(
        input.rootPath,
        input.memoryId,
        input.segmentId
      );
      await assertSafeExistingDirectory(sourceDirectory, 'Workspace segment directory is not safe');
      const sourceFileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
        rootPath: input.rootPath,
        recordingDirectory: sourceDirectory,
        memoryId: input.memoryId,
        strictUnsafePath: true,
      });
      if (
        !sourceFileTruth ||
        sourceFileTruth.segmentId !== input.segmentId ||
        sourceFileTruth.metadata.workspaceId !== input.workspaceId
      ) {
        throw new Error('Finalized segment projection does not match file truth');
      }

      const segmentsDirectory = path.dirname(sourceDirectory);
      await assertSafeExistingDirectory(
        segmentsDirectory,
        'Workspace segments directory is not safe'
      );
      const trashDirectory = await ensureSegmentTrashDirectory(
        input.rootPath,
        input.assertWorkspaceUsable
      );
      const sourceName = path.basename(sourceDirectory);
      movedSegmentDirectoryIdentity = sourceFileTruth.recordingDirectoryIdentity;
      movedSegmentDirectoryName = sourceName;
      await moveFileSpaceNodeDirectory({
        sourceName,
        sourceParentDirectory: segmentsDirectory,
        targetName: sourceName,
        targetParentDirectory: trashDirectory,
        expectedSourceIdentity: sourceFileTruth.recordingDirectoryIdentity,
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      movedToTrash = true;
      assertWorkspaceUsable(input.assertWorkspaceUsable);

      const activeSegmentFileTruths = await listValidFinalizedSegmentFileTruths(
        input.rootPath,
        input.memoryId
      );
      const refreshed = await refreshMemoryIndexEntryFromKnownFileTruths({
        rootPath: input.rootPath,
        memory: previousMemory,
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        fileTruths: activeSegmentFileTruths,
      });
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      previousMemory = refreshed.memoryFileTruth;
      return {
        ok: true,
        value: {
          memory: refreshed.memory,
          segmentId: input.segmentId,
          restoreToken: input.segmentId,
        },
      };
    });
  } catch (error) {
    let rollbackSucceeded = !movedToTrash;
    const rollbackMemory = previousMemory as MemoryFileTruth | null;
    if (movedToTrash && rollbackMemory && !(error instanceof WorkspaceHandleLost)) {
      try {
        assertWorkspaceUsable(input.assertWorkspaceUsable);
        const memoryDirectoryPath = await memoryDirectory(input.rootPath, input.memoryId);
        const segmentsDirectory = await ensureMemorySegmentsDirectory({
          memoryDirectoryPath,
          rootPath: input.rootPath,
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
        const trashDirectory = await ensureSegmentTrashDirectory(
          input.rootPath,
          input.assertWorkspaceUsable
        );
        const sourceName = movedSegmentDirectoryName;
        if (!sourceName) {
          throw new Error('Moved segment directory name is missing', { cause: error });
        }
        await moveFileSpaceNodeDirectory({
          sourceName,
          sourceParentDirectory: trashDirectory,
          targetName: sourceName,
          targetParentDirectory: segmentsDirectory,
          ...(movedSegmentDirectoryIdentity
            ? { expectedSourceIdentity: movedSegmentDirectoryIdentity }
            : {}),
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        await writeMemoryMarkdownAndManifest({
          rootPath: input.rootPath,
          memoryDirectoryPath,
          memory: {
            schemaVersion: 1,
            objectType: 'memory',
            memoryId: rollbackMemory.memoryId,
            title: rollbackMemory.title,
            createdAt: rollbackMemory.createdAt,
            updatedAt: rollbackMemory.updatedAt,
          },
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
        await rebuildMemoryIndex(input.rootPath, {
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }
    }
    return segmentDeleteError(
      error,
      rollbackSucceeded ? 'previous-file-preserved' : 'file-written-index-stale'
    );
  }
}

export async function restoreDeletedSegmentFromFileTruth(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly restoreToken: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
  }>
> {
  let movedToActive = false;
  let previousMemory: MemoryFileTruth | null = null;
  let movedSegmentDirectoryIdentity: DirectoryIdentity | null = null;
  let movedSegmentDirectoryName: string | null = null;
  const segmentId = input.restoreToken;
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      if (!SEGMENT_ID_PATTERN.test(segmentId)) {
        throw new Error('Invalid segment id');
      }
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memoryDirectoryPath = await memoryDirectory(input.rootPath, input.memoryId);
      try {
        await assertSafeExistingDirectory(
          memoryDirectoryPath,
          'Workspace memory directory is not safe'
        );
      } catch (error) {
        if (isMissingFileError(error)) {
          throw new Error('Segment restore parent memory missing', { cause: error });
        }
        throw error;
      }
      previousMemory = await readMemoryFileTruth(input.rootPath, input.memoryId);

      const segmentsDirectory = await ensureMemorySegmentsDirectory({
        memoryDirectoryPath,
        rootPath: input.rootPath,
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
      });
      const trashDirectory = await ensureSegmentTrashDirectory(
        input.rootPath,
        input.assertWorkspaceUsable
      );
      const sourceDirectory = await trashedSegmentDirectory(
        input.rootPath,
        input.memoryId,
        segmentId
      );
      await assertSafeExistingDirectory(sourceDirectory, 'Workspace segment directory is not safe');
      const sourceFileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
        rootPath: input.rootPath,
        recordingDirectory: sourceDirectory,
        memoryId: input.memoryId,
        strictUnsafePath: true,
      });
      if (
        !sourceFileTruth ||
        sourceFileTruth.segmentId !== segmentId ||
        sourceFileTruth.metadata.workspaceId !== input.workspaceId
      ) {
        throw new Error('Finalized segment projection does not match file truth');
      }

      const sourceName = path.basename(sourceDirectory);
      movedSegmentDirectoryIdentity = sourceFileTruth.recordingDirectoryIdentity;
      movedSegmentDirectoryName = sourceName;
      await moveFileSpaceNodeDirectory({
        sourceName,
        sourceParentDirectory: trashDirectory,
        targetName: sourceName,
        targetParentDirectory: segmentsDirectory,
        expectedSourceIdentity: sourceFileTruth.recordingDirectoryIdentity,
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      movedToActive = true;
      assertWorkspaceUsable(input.assertWorkspaceUsable);

      const activeSegmentFileTruths = await listValidFinalizedSegmentFileTruths(
        input.rootPath,
        input.memoryId
      );
      const restoredFileTruth =
        activeSegmentFileTruths.find((fileTruth) => fileTruth.segmentId === segmentId) ?? null;
      const restoredSegment = restoredFileTruth
        ? await finalizedSegmentProjectionFromFileTruth({
            rootPath: input.rootPath,
            workspaceId: input.workspaceId,
            fileTruth: restoredFileTruth,
          })
        : null;
      if (!restoredSegment || restoredSegment.segmentId !== segmentId) {
        throw new Error('Finalized segment projection does not match file truth');
      }
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const refreshed = await refreshMemoryIndexEntryFromKnownFileTruths({
        rootPath: input.rootPath,
        memory: previousMemory,
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        fileTruths: activeSegmentFileTruths,
      });
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      previousMemory = refreshed.memoryFileTruth;
      return {
        ok: true,
        value: {
          memory: refreshed.memory,
          segment: restoredSegment,
        },
      };
    });
  } catch (error) {
    let rollbackSucceeded = !movedToActive;
    const rollbackMemory = previousMemory as MemoryFileTruth | null;
    if (movedToActive && rollbackMemory && !(error instanceof WorkspaceHandleLost)) {
      try {
        assertWorkspaceUsable(input.assertWorkspaceUsable);
        const memoryDirectoryPath = await memoryDirectory(input.rootPath, input.memoryId);
        const segmentsDirectory = await ensureMemorySegmentsDirectory({
          memoryDirectoryPath,
          rootPath: input.rootPath,
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
        const trashDirectory = await ensureSegmentTrashDirectory(
          input.rootPath,
          input.assertWorkspaceUsable
        );
        const sourceName = movedSegmentDirectoryName;
        if (!sourceName) {
          throw new Error('Moved segment directory name is missing', { cause: error });
        }
        await moveFileSpaceNodeDirectory({
          sourceName,
          sourceParentDirectory: segmentsDirectory,
          targetName: sourceName,
          targetParentDirectory: trashDirectory,
          ...(movedSegmentDirectoryIdentity
            ? { expectedSourceIdentity: movedSegmentDirectoryIdentity }
            : {}),
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        await writeMemoryMarkdownAndManifest({
          rootPath: input.rootPath,
          memoryDirectoryPath,
          memory: {
            schemaVersion: 1,
            objectType: 'memory',
            memoryId: rollbackMemory.memoryId,
            title: rollbackMemory.title,
            createdAt: rollbackMemory.createdAt,
            updatedAt: rollbackMemory.updatedAt,
          },
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
        await rebuildMemoryIndex(input.rootPath, {
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }
    }
    return segmentRestoreError(
      error,
      rollbackSucceeded ? 'previous-file-preserved' : 'file-written-index-stale'
    );
  }
}

export async function deleteSegmentSupplementFromFileTruth(
  input: SegmentSupplementTargetInput
): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
    readonly supplementId: string;
    readonly restoreToken: string;
  }>
> {
  let movedToTrash = false;
  let movedSupplementDirectoryIdentity: DirectoryIdentity | null = null;
  let movedSupplementDirectoryName: string | null = null;
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memory = await readMemoryFileTruth(input.rootPath, input.memoryId);
      const sourceDirectory = await segmentSupplementDirectory(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        input.supplementId
      );
      await assertSafeExistingDirectory(
        sourceDirectory,
        'Workspace segment supplement directory is not safe'
      );
      const sourceDirectoryIdentity = await readDirectoryIdentity(sourceDirectory);
      const sourceSupplement = await readValidFinalizedSupplementProjection({
        supplementDirectory: sourceDirectory,
        supplementDirectoryIdentity: sourceDirectoryIdentity,
        rootPath: input.rootPath,
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
      });
      if (!sourceSupplement || sourceSupplement.supplementId !== input.supplementId) {
        throw new Error('Finalized segment supplement projection does not match file truth');
      }

      const supplementsDirectory = path.dirname(sourceDirectory);
      await assertSafeExistingDirectory(
        supplementsDirectory,
        'Workspace segment supplements directory is not safe'
      );
      const trashDirectory = await ensureSegmentSupplementTrashDirectory(
        input.rootPath,
        input.assertWorkspaceUsable
      );
      const sourceName = path.basename(sourceDirectory);
      movedSupplementDirectoryIdentity = sourceDirectoryIdentity;
      movedSupplementDirectoryName = sourceName;
      await moveFileSpaceNodeDirectory({
        sourceName,
        sourceParentDirectory: supplementsDirectory,
        targetName: sourceName,
        targetParentDirectory: trashDirectory,
        expectedSourceIdentity: sourceDirectoryIdentity,
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      movedToTrash = true;
      assertWorkspaceUsable(input.assertWorkspaceUsable);

      const activeSegmentFileTruths = await listValidFinalizedSegmentFileTruths(
        input.rootPath,
        input.memoryId
      );
      const parentSegmentFileTruth =
        activeSegmentFileTruths.find((fileTruth) => fileTruth.segmentId === input.segmentId) ??
        null;
      const parentSegment = parentSegmentFileTruth
        ? await finalizedSegmentProjectionFromFileTruth({
            rootPath: input.rootPath,
            workspaceId: input.workspaceId,
            fileTruth: parentSegmentFileTruth,
          })
        : null;
      if (!parentSegment || parentSegment.segmentId !== input.segmentId) {
        throw new Error('Finalized segment supplement projection does not match file truth');
      }
      const refreshed = await refreshMemoryIndexEntryFromKnownFileTruths({
        rootPath: input.rootPath,
        memory,
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        fileTruths: activeSegmentFileTruths,
      });
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      return {
        ok: true,
        value: {
          memory: refreshed.memory,
          segment: parentSegment,
          supplementId: input.supplementId,
          restoreToken: input.supplementId,
        },
      };
    });
  } catch (error) {
    let rollbackSucceeded = !movedToTrash;
    if (movedToTrash && !(error instanceof WorkspaceHandleLost)) {
      try {
        assertWorkspaceUsable(input.assertWorkspaceUsable);
        const supplementsDirectory = await ensureSegmentSupplementsDirectory({
          rootPath: input.rootPath,
          memoryId: input.memoryId,
          segmentId: input.segmentId,
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
        const trashDirectory = await ensureSegmentSupplementTrashDirectory(
          input.rootPath,
          input.assertWorkspaceUsable
        );
        const sourceName = movedSupplementDirectoryName;
        if (!sourceName) {
          throw new Error('Moved segment supplement directory name is missing', { cause: error });
        }
        await moveFileSpaceNodeDirectory({
          sourceName,
          sourceParentDirectory: trashDirectory,
          targetName: sourceName,
          targetParentDirectory: supplementsDirectory,
          ...(movedSupplementDirectoryIdentity
            ? { expectedSourceIdentity: movedSupplementDirectoryIdentity }
            : {}),
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        await rebuildMemoryIndex(input.rootPath, {
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }
    }
    return segmentSupplementDeleteError(
      error,
      rollbackSucceeded ? 'previous-file-preserved' : 'file-written-index-stale'
    );
  }
}

export async function restoreDeletedSegmentSupplementFromFileTruth(input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly restoreToken: string;
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
}): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
    readonly supplement: WorkspaceSegmentSupplementProjection;
  }>
> {
  let movedToActive = false;
  let movedSupplementDirectoryIdentity: DirectoryIdentity | null = null;
  let movedSupplementDirectoryName: string | null = null;
  const supplementId = input.restoreToken;
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      if (!SUPPLEMENT_ID_PATTERN.test(supplementId)) {
        throw new Error('Invalid segment supplement id');
      }
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      let memory: MemoryFileTruth;
      let parentSegmentDirectory: string;
      try {
        memory = await readMemoryFileTruth(input.rootPath, input.memoryId);
        parentSegmentDirectory = await memorySegmentDirectory(
          input.rootPath,
          input.memoryId,
          input.segmentId
        );
        await assertSafeExistingDirectory(
          parentSegmentDirectory,
          'Workspace segment directory is not safe'
        );
      } catch (error) {
        if (isMissingFileError(error)) {
          throw new Error('Segment supplement restore parent missing', { cause: error });
        }
        throw error;
      }
      const parentSegmentFileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
        rootPath: input.rootPath,
        recordingDirectory: parentSegmentDirectory,
        memoryId: input.memoryId,
        strictUnsafePath: true,
      });
      if (
        !parentSegmentFileTruth ||
        parentSegmentFileTruth.segmentId !== input.segmentId ||
        parentSegmentFileTruth.metadata.workspaceId !== input.workspaceId
      ) {
        throw new Error('Segment supplement restore parent missing');
      }

      const supplementsDirectory = await ensureSegmentSupplementsDirectory({
        rootPath: input.rootPath,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
      });
      const trashDirectory = await ensureSegmentSupplementTrashDirectory(
        input.rootPath,
        input.assertWorkspaceUsable
      );
      const sourceDirectory = await trashedSegmentSupplementDirectory(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        supplementId
      );
      await assertSafeExistingDirectory(
        sourceDirectory,
        'Workspace segment supplement trash directory is not safe'
      );
      const sourceDirectoryIdentity = await readDirectoryIdentity(sourceDirectory);
      const sourceSupplement = await readValidFinalizedSupplementProjection({
        supplementDirectory: sourceDirectory,
        supplementDirectoryIdentity: sourceDirectoryIdentity,
        rootPath: input.rootPath,
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
      });
      if (!sourceSupplement || sourceSupplement.supplementId !== supplementId) {
        throw new Error('Finalized segment supplement projection does not match file truth');
      }

      const sourceName = path.basename(sourceDirectory);
      movedSupplementDirectoryIdentity = sourceDirectoryIdentity;
      movedSupplementDirectoryName = sourceName;
      await moveFileSpaceNodeDirectory({
        sourceName,
        sourceParentDirectory: trashDirectory,
        targetName: sourceName,
        targetParentDirectory: supplementsDirectory,
        expectedSourceIdentity: sourceDirectoryIdentity,
        ...(input.assertWorkspaceUsable
          ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
          : {}),
      });
      movedToActive = true;
      assertWorkspaceUsable(input.assertWorkspaceUsable);

      const activeSegmentFileTruths = await listValidFinalizedSegmentFileTruths(
        input.rootPath,
        input.memoryId
      );
      const restoredSegmentFileTruth =
        activeSegmentFileTruths.find((fileTruth) => fileTruth.segmentId === input.segmentId) ??
        null;
      const restoredSegment = restoredSegmentFileTruth
        ? await finalizedSegmentProjectionFromFileTruth({
            rootPath: input.rootPath,
            workspaceId: input.workspaceId,
            fileTruth: restoredSegmentFileTruth,
          })
        : null;
      const restoredSupplement =
        restoredSegment?.supplements.find(
          (supplement) => supplement.supplementId === supplementId
        ) ?? null;
      if (!restoredSegment || !restoredSupplement) {
        throw new Error('Finalized segment supplement projection does not match file truth');
      }
      const refreshed = await refreshMemoryIndexEntryFromKnownFileTruths({
        rootPath: input.rootPath,
        memory,
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        fileTruths: activeSegmentFileTruths,
      });
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      return {
        ok: true,
        value: {
          memory: refreshed.memory,
          segment: restoredSegment,
          supplement: restoredSupplement,
        },
      };
    });
  } catch (error) {
    let rollbackSucceeded = !movedToActive;
    if (movedToActive && !(error instanceof WorkspaceHandleLost)) {
      try {
        assertWorkspaceUsable(input.assertWorkspaceUsable);
        const supplementsDirectory = await ensureSegmentSupplementsDirectory({
          rootPath: input.rootPath,
          memoryId: input.memoryId,
          segmentId: input.segmentId,
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
        const trashDirectory = await ensureSegmentSupplementTrashDirectory(
          input.rootPath,
          input.assertWorkspaceUsable
        );
        const sourceName = movedSupplementDirectoryName;
        if (!sourceName) {
          throw new Error('Moved segment supplement directory name is missing', { cause: error });
        }
        await moveFileSpaceNodeDirectory({
          sourceName,
          sourceParentDirectory: supplementsDirectory,
          targetName: sourceName,
          targetParentDirectory: trashDirectory,
          ...(movedSupplementDirectoryIdentity
            ? { expectedSourceIdentity: movedSupplementDirectoryIdentity }
            : {}),
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        await rebuildMemoryIndex(input.rootPath, {
          ...(input.assertWorkspaceUsable
            ? { assertWorkspaceUsable: input.assertWorkspaceUsable }
            : {}),
        });
        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }
    }
    return segmentSupplementRestoreError(
      error,
      rollbackSucceeded ? 'previous-file-preserved' : 'file-written-index-stale'
    );
  }
}

async function appendAudioSegmentToMemoryWithHooks(
  input: AppendAudioSegmentToMemoryInput,
  transactionHooks?: FinalizeTransactionHooks
): Promise<MemoryFilesResult<MemorySummary>> {
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const current = await readMemoryFileTruth(input.rootPath, input.memoryId);
      const updatedAt = input.now();
      const next: MemoryFileTruth = {
        ...current,
        updatedAt,
      };
      const { stagingSegmentDirectory, targetRecordingDirectory } =
        await copyDraftRecordingIntoMemory({
          rootPath: input.rootPath,
          memoryId: input.memoryId,
          segmentId: input.segmentId,
          title: input.title,
          ...(transactionHooks ? { hooks: transactionHooks } : {}),
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
      const summary = await finishFinalizeTransaction({
        rootPath: input.rootPath,
        stagingSegmentDirectory,
        targetRecordingDirectory,
        memoryId: input.memoryId,
        nextMemory: next,
        previousMemory: current,
        segmentId: input.segmentId,
        workspaceId: input.workspaceId,
        title: input.title,
        durationMs: input.durationMs,
        finalizedAt: updatedAt,
        ...(input.lastTranscriptionAttemptOnFinalize
          ? { lastTranscriptionAttemptOnFinalize: input.lastTranscriptionAttemptOnFinalize }
          : {}),
        ...(input.rebuildIndex ? { rebuildIndex: input.rebuildIndex } : {}),
        ...(transactionHooks ? { hooks: transactionHooks } : {}),
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
      });
      return { ok: true, value: summary };
    });
  } catch (error) {
    return memoryFilesError(
      error,
      'ERR_RECORDING_FINALIZE_FAILED',
      'Recording could not be attached to memory',
      finalizeFailureRetention(error)
    );
  }
}

export async function appendAudioSegmentToMemory(
  input: AppendAudioSegmentToMemoryInput
): Promise<MemoryFilesResult<MemorySummary>> {
  return appendAudioSegmentToMemoryWithHooks(input);
}

export async function appendAudioSegmentToMemoryForTest(
  input: AppendAudioSegmentToMemoryForTestInput
): Promise<MemoryFilesResult<MemorySummary>> {
  const { transactionHooks, ...productionInput } = input;
  return appendAudioSegmentToMemoryWithHooks(productionInput, transactionHooks);
}

export async function appendAudioSupplementToSegment(
  input: AppendAudioSupplementToSegmentInput
): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
    readonly supplement: WorkspaceSegmentSupplementProjection;
  }>
> {
  return appendAudioSupplementToSegmentWithHooks(input);
}

export async function appendAudioSupplementToSegmentForTest(
  input: AppendAudioSupplementToSegmentForTestInput
): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
    readonly supplement: WorkspaceSegmentSupplementProjection;
  }>
> {
  const { transactionHooks, ...productionInput } = input;
  return appendAudioSupplementToSegmentWithHooks(productionInput, transactionHooks);
}

async function appendAudioSupplementToSegmentWithHooks(
  input: AppendAudioSupplementToSegmentInput,
  transactionHooks?: FinalizeTransactionHooks
): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
    readonly supplement: WorkspaceSegmentSupplementProjection;
  }>
> {
  try {
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const current = await readMemoryFileTruth(input.rootPath, input.memoryId);
      const parentSegment = await readValidFinalizedSegmentProjection({
        rootPath: input.rootPath,
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
      });
      if (!parentSegment) {
        throw new Error('Segment supplement parent is not finalized');
      }

      const updatedAt = input.now();
      const nextMemory = {
        ...current,
        updatedAt,
      };
      const supplementsDirectory = await ensureSegmentSupplementsDirectory({
        rootPath: input.rootPath,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
      });
      const targetSupplementDirectory = await segmentSupplementDirectoryForNewNode(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        input.supplementId,
        input.title
      );
      const relativeTarget = path.relative(supplementsDirectory, targetSupplementDirectory);
      if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
        throw new Error('Segment supplement target escapes parent');
      }
      const existingSupplementDirectory = await segmentSupplementDirectory(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        input.supplementId
      );
      if (await exists(existingSupplementDirectory)) {
        throw new Error('Segment supplement target already exists');
      }
      if (await exists(targetSupplementDirectory)) {
        throw new Error('Segment supplement target already exists');
      }

      const stagingName = `${FINALIZE_STAGING_PREFIX}${input.supplementId}.${process.pid}.${Date.now()}`;
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      createWorkspaceDirectoryWithinParent({
        parentDirectory: supplementsDirectory,
        directoryName: stagingName,
        ...(input.assertWorkspaceUsable
          ? { beforeCommit: () => assertWorkspaceUsable(input.assertWorkspaceUsable) }
          : {}),
      });
      const stagingSupplementDirectory = path.join(supplementsDirectory, stagingName);
      try {
        await transactionHooks?.afterStagingDirectoryCreate?.();
        await writeWorkspaceJsonAtomic(
          path.join(stagingSupplementDirectory, FINALIZE_TRANSACTION_MARKER),
          {
            schemaVersion: 1,
            memoryId: input.memoryId,
            segmentId: input.segmentId,
            supplementId: input.supplementId,
            draftPath: `.reo/drafts/supplements/${input.supplementId}`,
          }
        );
        await transactionHooks?.afterMarkerWrite?.();
        assertWorkspaceUsable(input.assertWorkspaceUsable);
        await transactionHooks?.beforeDraftCopy?.();
        await copyDirectoryContents(
          await draftSupplementDirectory(input.rootPath, input.supplementId),
          stagingSupplementDirectory,
          DRAFT_SUPPLEMENT_FILES
        );
        await transactionHooks?.afterCopy?.();
        assertWorkspaceUsable(input.assertWorkspaceUsable);
        const finalized = await finishSupplementFinalizeTransaction({
          rootPath: input.rootPath,
          stagingSupplementDirectory,
          targetSupplementDirectory,
          memoryId: input.memoryId,
          segmentId: input.segmentId,
          supplementId: input.supplementId,
          workspaceId: input.workspaceId,
          nextMemory,
          previousMemory: current,
          title: input.title,
          durationMs: input.durationMs,
          finalizedAt: updatedAt,
          ...(input.lastTranscriptionAttemptOnFinalize
            ? { lastTranscriptionAttemptOnFinalize: input.lastTranscriptionAttemptOnFinalize }
            : {}),
          ...(input.rebuildIndex ? { rebuildIndex: input.rebuildIndex } : {}),
          ...(transactionHooks ? { hooks: transactionHooks } : {}),
          ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
        });
        return {
          ok: true,
          value: finalized,
        };
      } catch (error) {
        if (error instanceof WorkspaceHandleLost) {
          throw error;
        }
        await removeSafeWorkspaceDirectory(
          input.rootPath,
          stagingSupplementDirectory,
          transactionHooks
        ).catch(() => {});
        throw error;
      }
    });
  } catch (error) {
    return memoryFilesError(
      error,
      'ERR_RECORDING_FINALIZE_FAILED',
      'Segment supplement recording could not be finalized',
      finalizeFailureRetention(error)
    );
  }
}

export async function updateMemoryTitleFromFileTruth(
  input: UpdateMemoryTitleInput
): Promise<MemoryFilesResult<MemorySummary>> {
  try {
    assertWorkspaceUsable(input.assertWorkspaceUsable);
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const current = await readMemoryFileTruth(input.rootPath, input.memoryId);
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const renamedAt = input.now();
      const next = { ...current, title: input.title };
      const sourceDirectory = await memoryDirectory(input.rootPath, input.memoryId);
      const targetDirectory = await memoryDirectoryForNewNode(
        input.rootPath,
        input.memoryId,
        input.title
      );
      const parentDirectory = path.dirname(sourceDirectory);
      if (path.dirname(targetDirectory) !== parentDirectory) {
        throw new Error('Memory rename target parent changed');
      }
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      if (path.basename(sourceDirectory) !== path.basename(targetDirectory)) {
        renameWorkspaceDirectoryAcrossParents({
          sourceParentDirectory: parentDirectory,
          sourceName: path.basename(sourceDirectory),
          targetParentDirectory: parentDirectory,
          targetName: path.basename(targetDirectory),
          ...(input.assertWorkspaceUsable
            ? { beforeCommit: () => assertWorkspaceUsable(input.assertWorkspaceUsable) }
            : {}),
        });
      }
      const directory = await memoryDirectory(input.rootPath, input.memoryId);
      await writeMemoryMarkdownAndManifest({
        rootPath: input.rootPath,
        memoryDirectoryPath: directory,
        memory: {
          schemaVersion: 1,
          objectType: 'memory',
          memoryId: next.memoryId,
          title: next.title,
          createdAt: next.createdAt,
          updatedAt: next.updatedAt,
        },
        ...(input.assertWorkspaceUsable ? { assertUsable: input.assertWorkspaceUsable } : {}),
      });
      await touchWorkspacePathBestEffort(directory, renamedAt);
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const summary = await refreshMemoryIndexEntry(
        input.rootPath,
        input.memoryId,
        input.assertWorkspaceUsable
      ).catch(() => summarizeMemory(input.rootPath, next));
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      return { ok: true, value: summary };
    });
  } catch (error) {
    return updateMemoryTitleError(error);
  }
}

export async function updateSegmentTitleFromFileTruth(input: UpdateSegmentTitleInput): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
  }>
> {
  try {
    assertWorkspaceUsable(input.assertWorkspaceUsable);
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const currentMemory = await readMemoryFileTruth(input.rootPath, input.memoryId);
      const sourceFileTruth = await readValidFinalizedSegmentFileTruth(
        input.rootPath,
        input.memoryId,
        input.segmentId
      );
      if (!sourceFileTruth || sourceFileTruth.metadata.workspaceId !== input.workspaceId) {
        throw new Error('Finalized segment projection does not match file truth');
      }
      const renamedAt = input.now();
      const sourceDirectory = sourceFileTruth.recordingDirectory;
      const targetDirectory = await memorySegmentDirectoryForNewNode(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        input.title
      );
      const parentDirectory = path.dirname(sourceDirectory);
      if (path.dirname(targetDirectory) !== parentDirectory) {
        throw new Error('Segment rename target parent changed');
      }

      assertWorkspaceUsable(input.assertWorkspaceUsable);
      if (path.basename(sourceDirectory) !== path.basename(targetDirectory)) {
        renameWorkspaceDirectoryAcrossParents({
          sourceParentDirectory: parentDirectory,
          sourceName: path.basename(sourceDirectory),
          targetParentDirectory: parentDirectory,
          targetName: path.basename(targetDirectory),
          ...(input.assertWorkspaceUsable
            ? { beforeCommit: () => assertWorkspaceUsable(input.assertWorkspaceUsable) }
            : {}),
        });
      }

      const finalDirectory =
        path.basename(sourceDirectory) === path.basename(targetDirectory)
          ? sourceDirectory
          : targetDirectory;
      const finalDirectoryIdentity = await readDirectoryIdentity(finalDirectory);
      await updateSegmentMarkdownInKnownDirectory({
        directory: finalDirectory,
        directoryIdentity: finalDirectoryIdentity,
        update: ({ content }) => ({
          title: input.title,
          content: content.replace(/^# .*(\r?\n)?/, `# ${input.title}\n`),
        }),
      });
      const memoryDirectoryPath = await memoryDirectory(input.rootPath, input.memoryId);
      await touchWorkspacePathBestEffort(finalDirectory, renamedAt);
      await touchWorkspacePathBestEffort(memoryDirectoryPath, renamedAt);
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memory = await refreshMemoryIndexEntry(
        input.rootPath,
        input.memoryId,
        input.assertWorkspaceUsable
      ).catch(() => summarizeMemory(input.rootPath, currentMemory));
      const refreshedFileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
        rootPath: input.rootPath,
        recordingDirectory: finalDirectory,
        memoryId: input.memoryId,
      });
      const refreshedSegment = refreshedFileTruth
        ? await finalizedSegmentProjectionFromFileTruth({
            rootPath: input.rootPath,
            workspaceId: input.workspaceId,
            fileTruth: refreshedFileTruth,
          })
        : null;
      if (!refreshedSegment || refreshedSegment.segmentId !== input.segmentId) {
        throw new Error('Finalized segment projection does not match file truth');
      }
      return {
        ok: true,
        value: {
          memory,
          segment: refreshedSegment,
        },
      };
    });
  } catch (error) {
    return updateSegmentTitleError(error);
  }
}

export async function updateSegmentContentTitleFromFileTruth(
  input: UpdateSegmentContentTitleInput
): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
  }>
> {
  try {
    assertWorkspaceUsable(input.assertWorkspaceUsable);
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const currentMemory = await readMemoryFileTruth(input.rootPath, input.memoryId);
      const sourceFileTruth = await readValidFinalizedSegmentFileTruth(
        input.rootPath,
        input.memoryId,
        input.segmentId
      );
      if (!sourceFileTruth || sourceFileTruth.metadata.workspaceId !== input.workspaceId) {
        throw new Error('Finalized segment projection does not match file truth');
      }

      const updatedAt = input.now();
      await updateSegmentMarkdownInKnownDirectory({
        directory: sourceFileTruth.recordingDirectory,
        directoryIdentity: sourceFileTruth.recordingDirectoryIdentity,
        update: ({ title, content }) => ({
          title,
          contentTitle: input.contentTitle,
          content,
        }),
      });

      const memoryDirectoryPath = await memoryDirectory(input.rootPath, input.memoryId);
      await touchWorkspacePathBestEffort(sourceFileTruth.recordingDirectory, updatedAt);
      await touchWorkspacePathBestEffort(memoryDirectoryPath, updatedAt);
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const memory = await refreshMemoryIndexEntry(
        input.rootPath,
        input.memoryId,
        input.assertWorkspaceUsable
      ).catch(() => summarizeMemory(input.rootPath, currentMemory));
      const refreshedFileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
        rootPath: input.rootPath,
        recordingDirectory: sourceFileTruth.recordingDirectory,
        memoryId: input.memoryId,
      });
      const refreshedSegment = refreshedFileTruth
        ? await finalizedSegmentProjectionFromFileTruth({
            rootPath: input.rootPath,
            workspaceId: input.workspaceId,
            fileTruth: refreshedFileTruth,
          })
        : null;
      if (!refreshedSegment || refreshedSegment.segmentId !== input.segmentId) {
        throw new Error('Finalized segment projection does not match file truth');
      }
      return {
        ok: true,
        value: {
          memory,
          segment: refreshedSegment,
        },
      };
    });
  } catch (error) {
    return updateSegmentTitleError(error);
  }
}

export async function updateSegmentContentTabOrderFromFileTruth(
  input: UpdateSegmentContentTabOrderInput
): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
  }>
> {
  try {
    assertWorkspaceUsable(input.assertWorkspaceUsable);
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const currentMemory = await readMemoryFileTruth(input.rootPath, input.memoryId);
      const fileTruth = await readValidFinalizedSegmentFileTruth(
        input.rootPath,
        input.memoryId,
        input.segmentId
      );
      if (!fileTruth || fileTruth.metadata.workspaceId !== input.workspaceId) {
        throw new Error('Finalized segment projection does not match file truth');
      }

      const supplements = await listValidSegmentSupplementsFromDirectory({
        rootPath: input.rootPath,
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
        recordingDirectory: fileTruth.recordingDirectory,
      });
      const contentTabOrder = normalizeContentTabOrder(input.contentTabOrder, supplements);
      const manifestPath = await segmentObjectManifestPath(input.rootPath, input.segmentId);
      const manifest = segmentObjectManifestSchema.parse(
        JSON.parse(await readWorkspaceTextFile(manifestPath))
      );
      if (
        manifest.workspaceId !== input.workspaceId ||
        manifest.memoryId !== input.memoryId ||
        manifest.segmentId !== input.segmentId
      ) {
        throw new Error('Finalized segment manifest does not match file truth');
      }

      assertWorkspaceUsable(input.assertWorkspaceUsable);
      await writeWorkspaceJsonAtomic(manifestPath, {
        ...manifest,
        contentTabOrder,
      });
      assertWorkspaceUsable(input.assertWorkspaceUsable);

      const refreshedFileTruth = await readValidFinalizedSegmentFileTruthFromDirectory({
        rootPath: input.rootPath,
        recordingDirectory: fileTruth.recordingDirectory,
        memoryId: input.memoryId,
      });
      const refreshedSegment = refreshedFileTruth
        ? await finalizedSegmentProjectionFromFileTruth({
            rootPath: input.rootPath,
            workspaceId: input.workspaceId,
            fileTruth: refreshedFileTruth,
          })
        : null;
      if (!refreshedSegment || refreshedSegment.segmentId !== input.segmentId) {
        throw new Error('Finalized segment projection does not match file truth');
      }

      return {
        ok: true,
        value: {
          memory: await summarizeMemory(input.rootPath, currentMemory),
          segment: refreshedSegment,
        },
      };
    });
  } catch (error) {
    return updateSegmentTitleError(error);
  }
}

export async function updateSegmentSupplementTitleFromFileTruth(
  input: UpdateSegmentSupplementTitleInput
): Promise<
  MemoryFilesResult<{
    readonly memory: MemorySummary;
    readonly segment: WorkspaceSegmentProjection;
    readonly supplement: WorkspaceSegmentSupplementProjection;
  }>
> {
  try {
    assertWorkspaceUsable(input.assertWorkspaceUsable);
    return await withMemoryWriteLock(input.rootPath, input.memoryId, async () => {
      assertWorkspaceUsable(input.assertWorkspaceUsable);
      const sourceDirectory = await segmentSupplementDirectory(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        input.supplementId
      );
      const sourceDirectoryIdentity = await readDirectoryIdentity(sourceDirectory);
      const sourceSupplementMetadata = await readFinalizedSegmentSupplementMetadata(
        input.rootPath,
        sourceDirectory,
        sourceDirectoryIdentity
      );
      if (
        sourceSupplementMetadata.workspaceId !== input.workspaceId ||
        sourceSupplementMetadata.memoryId !== input.memoryId ||
        sourceSupplementMetadata.segmentId !== input.segmentId ||
        sourceSupplementMetadata.supplementId !== input.supplementId
      ) {
        throw new Error('Finalized segment supplement projection does not match file truth');
      }
      const targetDirectory = await segmentSupplementDirectoryForNewNode(
        input.rootPath,
        input.memoryId,
        input.segmentId,
        input.supplementId,
        input.title
      );
      const parentDirectory = path.dirname(sourceDirectory);
      if (path.dirname(targetDirectory) !== parentDirectory) {
        throw new Error('Segment supplement rename target parent changed');
      }

      assertWorkspaceUsable(input.assertWorkspaceUsable);
      if (path.basename(sourceDirectory) !== path.basename(targetDirectory)) {
        renameWorkspaceDirectoryAcrossParents({
          sourceParentDirectory: parentDirectory,
          sourceName: path.basename(sourceDirectory),
          targetParentDirectory: parentDirectory,
          targetName: path.basename(targetDirectory),
          expectedSourceIdentity: sourceDirectoryIdentity,
          ...(input.assertWorkspaceUsable
            ? { beforeCommit: () => assertWorkspaceUsable(input.assertWorkspaceUsable) }
            : {}),
        });
      }

      const finalDirectory =
        path.basename(sourceDirectory) === path.basename(targetDirectory)
          ? sourceDirectory
          : targetDirectory;
      const finalDirectoryIdentity = await readDirectoryIdentity(finalDirectory);
      const supplementMetadata = await readFinalizedSegmentSupplementMetadata(
        input.rootPath,
        finalDirectory,
        finalDirectoryIdentity
      );
      if (
        supplementMetadata.workspaceId !== input.workspaceId ||
        supplementMetadata.memoryId !== input.memoryId ||
        supplementMetadata.segmentId !== input.segmentId ||
        supplementMetadata.supplementId !== input.supplementId
      ) {
        throw new Error('Finalized segment supplement projection does not match file truth');
      }

      await updateSupplementMarkdownInKnownDirectory({
        directory: finalDirectory,
        directoryIdentity: finalDirectoryIdentity,
        update: ({ content }) => ({
          title: input.title,
          content: content.replace(/^# .*(\r?\n)?/, `# ${input.title}\n`),
        }),
      });

      assertWorkspaceUsable(input.assertWorkspaceUsable);
      let memory: MemorySummary;
      try {
        memory = await refreshMemoryIndexEntry(
          input.rootPath,
          input.memoryId,
          input.assertWorkspaceUsable
        );
      } catch (error) {
        throw new FileWrittenIndexStale(error);
      }
      const segment = await readValidFinalizedSegmentProjection({
        rootPath: input.rootPath,
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
      });
      const supplement = await readValidFinalizedSupplementProjection({
        supplementDirectory: finalDirectory,
        supplementDirectoryIdentity: await readDirectoryIdentity(finalDirectory),
        rootPath: input.rootPath,
        workspaceId: input.workspaceId,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
      });
      if (!segment || !supplement || supplement.supplementId !== input.supplementId) {
        throw new Error('Finalized segment supplement projection does not match file truth');
      }
      return {
        ok: true,
        value: {
          memory,
          segment,
          supplement,
        },
      };
    });
  } catch (error) {
    return updateSegmentSupplementTitleError(error);
  }
}

export async function lookupSegmentDirectoryById(
  rootPath: string,
  segmentId: string
): Promise<SegmentDirectoryLookup> {
  if (!SEGMENT_ID_PATTERN.test(segmentId)) {
    return { status: 'invalid-id' };
  }
  await beforeRecordingLookupForTest?.();
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  const memoryEntries = await readExistingDirectoryEntries(memoriesDirectory);
  let foundDirectory: string | null = null;
  let foundRecording: MemorySegmentSummary | null = null;
  let duplicateFound = false;
  let invalidDurableFound = false;
  for (const memoryEntry of memoryEntries) {
    if (!memoryEntry.isDirectory()) {
      continue;
    }
    const memoryDirectoryPath = path.join(memoriesDirectory, memoryEntry.name);
    let memory: MemoryFileTruth;
    try {
      memory = await readMemoryFileTruthFromDirectory(rootPath, memoryDirectoryPath);
    } catch {
      continue;
    }
    let candidate: string;
    try {
      candidate = await resolveSegmentDirectoryInMemoryDirectory({
        rootPath,
        memoryDirectory: memoryDirectoryPath,
        memoryId: memory.memoryId,
        segmentId,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Duplicate finalized segment id') {
        duplicateFound = true;
        continue;
      }
      continue;
    }
    try {
      const metadata = await lstat(candidate);
      const fileTruth = metadata.isDirectory()
        ? await readValidFinalizedSegmentFileTruthFromDirectory({
            rootPath,
            recordingDirectory: candidate,
            memoryId: memory.memoryId,
          })
        : null;
      const recording =
        isAudioSegmentFileTruth(fileTruth) && fileTruth.segmentId === segmentId
          ? {
              segmentId,
              title: fileTruth.metadata.title,
              durationMs: fileTruth.metadata.durationMs,
              audioByteLength: fileTruth.audioByteLength,
              lastTranscriptionAttempt: deriveLastTranscriptionAttempt(fileTruth.metadata),
            }
          : null;
      if (fileTruth?.segmentId === segmentId) {
        if (foundDirectory) {
          duplicateFound = true;
          continue;
        }
        foundDirectory = candidate;
        foundRecording = recording;
        continue;
      }
      if (metadata.isDirectory() || metadata.isSymbolicLink()) {
        invalidDurableFound = true;
      }
    } catch {
      continue;
    }
  }
  if (duplicateFound) {
    return { status: 'duplicate' };
  }
  if (invalidDurableFound) {
    return { status: 'invalid-durable' };
  }
  if (foundDirectory) {
    if (foundRecording) {
      return { status: 'found', directory: foundDirectory, segment: foundRecording };
    }
    return { status: 'found-non-audio', directory: foundDirectory };
  }
  return { status: 'not-found' };
}

export async function findSegmentDirectoryById(
  rootPath: string,
  segmentId: string
): Promise<string> {
  const lookup = await lookupSegmentDirectoryById(rootPath, segmentId);
  if (lookup.status === 'found' || lookup.status === 'found-non-audio') {
    return lookup.directory;
  }
  if (lookup.status === 'duplicate') {
    throw new Error('Duplicate finalized segment id');
  }
  if (lookup.status === 'invalid-id') {
    throw new Error('Invalid segment id');
  }
  if (lookup.status === 'invalid-durable') {
    throw new Error('Invalid durable recording');
  }
  throw new Error('Recording not found');
}

export async function findFinalizedAudioSegmentById(
  rootPath: string,
  segmentId: string
): Promise<{
  readonly directory: string;
  readonly segment: MemorySegmentSummary;
}> {
  const lookup = await lookupSegmentDirectoryById(rootPath, segmentId);
  if (lookup.status === 'found') {
    return { directory: lookup.directory, segment: lookup.segment };
  }
  if (lookup.status === 'found-non-audio') {
    throw new Error('Invalid durable recording');
  }
  if (lookup.status === 'duplicate') {
    throw new Error('Duplicate finalized segment id');
  }
  if (lookup.status === 'invalid-id') {
    throw new Error('Invalid segment id');
  }
  if (lookup.status === 'invalid-durable') {
    throw new Error('Invalid durable recording');
  }
  throw new Error('Recording not found');
}

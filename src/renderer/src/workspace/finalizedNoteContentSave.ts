import type { WorkspaceSession } from './workspaceApi';
import { writeSegmentContent, writeSegmentSupplementContent } from './workspaceApi';
import { readStaleNoteContentConflict, type NoteContentConflict } from './noteEditorModel';
import { workspaceErrorDisplayMessage } from './workspaceErrorMessages';

const utf8Encoder = new TextEncoder();

export type SavedNoteSegmentContent = {
  readonly expectedSession: WorkspaceSession;
  readonly bodyByteLength: number;
  readonly bodyMarkdown: string;
  readonly baselineContentHash: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
};

export type SavedNoteSegmentSupplementContent = SavedNoteSegmentContent & {
  readonly supplementId: string;
};

export type FinalizedNoteContentSaveResult<TSaved> =
  | { readonly ok: true; readonly saved: TSaved; readonly nextBaselineContentHash?: string }
  | { readonly ok: false; readonly kind: 'conflict'; readonly conflict: NoteContentConflict }
  | { readonly ok: false; readonly kind: 'error'; readonly message: string };

export async function saveFinalizedNoteSegmentContent({
  baselineContentHash,
  bodyMarkdown,
  memoryId,
  segmentId,
  title,
  workspaceSession,
}: {
  readonly baselineContentHash: string;
  readonly bodyMarkdown: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly workspaceSession: WorkspaceSession;
}): Promise<FinalizedNoteContentSaveResult<SavedNoteSegmentContent>> {
  const response = await writeSegmentContent({
    workspaceHandle: workspaceSession.workspaceHandle,
    workspaceId: workspaceSession.workspaceId,
    memoryId,
    segmentId,
    bodyMarkdown,
    baselineContentHash,
  });
  if (!response.ok) {
    const conflict = readStaleNoteContentConflict(response.error);
    return conflict
      ? { ok: false, kind: 'conflict', conflict }
      : {
          ok: false,
          kind: 'error',
          message: workspaceErrorDisplayMessage(response.error, '无法保存笔记正文。'),
        };
  }

  return {
    ok: true,
    nextBaselineContentHash: response.value.baselineContentHash,
    saved: {
      expectedSession: workspaceSession,
      memoryId,
      segmentId,
      title,
      bodyMarkdown,
      baselineContentHash: response.value.baselineContentHash,
      bodyByteLength: response.value.bodyByteLength,
    },
  };
}

export async function saveFinalizedNoteSegmentSupplementContent({
  baselineContentHash,
  bodyMarkdown,
  memoryId,
  segmentId,
  supplementId,
  title,
  workspaceSession,
}: {
  readonly baselineContentHash: string;
  readonly bodyMarkdown: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly title: string;
  readonly workspaceSession: WorkspaceSession;
}): Promise<FinalizedNoteContentSaveResult<SavedNoteSegmentSupplementContent>> {
  const response = await writeSegmentSupplementContent({
    workspaceHandle: workspaceSession.workspaceHandle,
    workspaceId: workspaceSession.workspaceId,
    memoryId,
    segmentId,
    supplementId,
    bodyMarkdown,
    baselineContentHash,
  });
  if (!response.ok) {
    const conflict = readStaleNoteContentConflict(response.error);
    return conflict
      ? { ok: false, kind: 'conflict', conflict }
      : {
          ok: false,
          kind: 'error',
          message: workspaceErrorDisplayMessage(response.error, '无法保存补充笔记正文。'),
        };
  }

  return {
    ok: true,
    nextBaselineContentHash: response.value.baselineContentHash,
    saved: {
      expectedSession: workspaceSession,
      memoryId,
      segmentId,
      supplementId,
      title,
      bodyMarkdown,
      baselineContentHash: response.value.baselineContentHash,
      bodyByteLength: response.value.bodyByteLength,
    },
  };
}

export function savedNoteSegmentContentFromConflict({
  conflict,
  memoryId,
  segmentId,
  title,
  workspaceSession,
}: {
  readonly conflict: NoteContentConflict;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly workspaceSession: WorkspaceSession;
}): SavedNoteSegmentContent {
  return {
    expectedSession: workspaceSession,
    memoryId,
    segmentId,
    title,
    bodyMarkdown: conflict.currentBodyMarkdown,
    bodyByteLength: utf8Encoder.encode(conflict.currentBodyMarkdown).byteLength,
    baselineContentHash: conflict.currentBaselineContentHash,
  };
}

export function savedNoteSegmentSupplementContentFromConflict({
  conflict,
  memoryId,
  segmentId,
  supplementId,
  title,
  workspaceSession,
}: {
  readonly conflict: NoteContentConflict;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly title: string;
  readonly workspaceSession: WorkspaceSession;
}): SavedNoteSegmentSupplementContent {
  return {
    expectedSession: workspaceSession,
    memoryId,
    segmentId,
    supplementId,
    title,
    bodyMarkdown: conflict.currentBodyMarkdown,
    bodyByteLength: utf8Encoder.encode(conflict.currentBodyMarkdown).byteLength,
    baselineContentHash: conflict.currentBaselineContentHash,
  };
}

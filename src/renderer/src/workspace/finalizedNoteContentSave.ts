import type { WorkspaceSession } from './workspaceApi';
import type { WorkspaceTiptapJsonContent } from '../../../workspace-contract/workspace-contract';
import { writeSegmentContent, writeSegmentSupplementContent } from './workspaceApi';
import { readStaleNoteContentConflict, type NoteContentConflict } from './noteEditorModel';
import { workspaceErrorDisplayMessage } from './workspaceErrorMessages';

const utf8Encoder = new TextEncoder();

export type SavedNoteSegmentContent = {
  readonly expectedSession: WorkspaceSession;
  readonly bodyByteLength: number;
  readonly bodyMarkdown: string;
  readonly bodyTiptapJson: WorkspaceTiptapJsonContent | null;
  readonly baselineContentHash: string;
  readonly baselineTiptapContentHash: string | null;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
};

export type SavedNoteSegmentSupplementContent = SavedNoteSegmentContent & {
  readonly supplementId: string;
};

export type FinalizedNoteContentSaveResult<TSaved> =
  | {
      readonly ok: true;
      readonly saved: TSaved;
      readonly nextBaselineContentHash?: string;
      readonly nextBaselineTiptapContentHash?: string;
    }
  | { readonly ok: false; readonly kind: 'conflict'; readonly conflict: NoteContentConflict }
  | { readonly ok: false; readonly kind: 'error'; readonly message: string };

export async function saveFinalizedNoteSegmentContent({
  baselineContentHash,
  baselineTiptapContentHash,
  bodyMarkdown,
  bodyTiptapJson,
  memoryId,
  segmentId,
  title,
  workspaceSession,
}: {
  readonly baselineContentHash: string;
  readonly baselineTiptapContentHash?: string | null;
  readonly bodyMarkdown: string;
  readonly bodyTiptapJson?: WorkspaceTiptapJsonContent | null;
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
    ...(bodyTiptapJson ? { bodyTiptapJson } : {}),
    baselineContentHash,
    ...(baselineTiptapContentHash ? { baselineTiptapContentHash } : {}),
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
    nextBaselineTiptapContentHash: response.value.baselineTiptapContentHash,
    saved: {
      expectedSession: workspaceSession,
      memoryId,
      segmentId,
      title,
      bodyMarkdown,
      bodyTiptapJson: bodyTiptapJson ?? null,
      baselineContentHash: response.value.baselineContentHash,
      baselineTiptapContentHash: response.value.baselineTiptapContentHash,
      bodyByteLength: response.value.bodyByteLength,
    },
  };
}

export async function saveFinalizedNoteSegmentSupplementContent({
  baselineContentHash,
  baselineTiptapContentHash,
  bodyMarkdown,
  bodyTiptapJson,
  memoryId,
  segmentId,
  supplementId,
  title,
  workspaceSession,
}: {
  readonly baselineContentHash: string;
  readonly baselineTiptapContentHash?: string | null;
  readonly bodyMarkdown: string;
  readonly bodyTiptapJson?: WorkspaceTiptapJsonContent | null;
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
    ...(bodyTiptapJson ? { bodyTiptapJson } : {}),
    baselineContentHash,
    ...(baselineTiptapContentHash ? { baselineTiptapContentHash } : {}),
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
    nextBaselineTiptapContentHash: response.value.baselineTiptapContentHash,
    saved: {
      expectedSession: workspaceSession,
      memoryId,
      segmentId,
      supplementId,
      title,
      bodyMarkdown,
      bodyTiptapJson: bodyTiptapJson ?? null,
      baselineContentHash: response.value.baselineContentHash,
      baselineTiptapContentHash: response.value.baselineTiptapContentHash,
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
    bodyTiptapJson: conflict.currentBodyTiptapJson,
    bodyByteLength: utf8Encoder.encode(conflict.currentBodyMarkdown).byteLength,
    baselineContentHash: conflict.currentBaselineContentHash,
    baselineTiptapContentHash: conflict.currentBaselineTiptapContentHash,
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
    bodyTiptapJson: conflict.currentBodyTiptapJson,
    bodyByteLength: utf8Encoder.encode(conflict.currentBodyMarkdown).byteLength,
    baselineContentHash: conflict.currentBaselineContentHash,
    baselineTiptapContentHash: conflict.currentBaselineTiptapContentHash,
  };
}

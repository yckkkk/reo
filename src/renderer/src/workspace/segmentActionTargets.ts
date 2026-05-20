import type { WorkspaceMemoryDetail } from './workspaceApi';

export type SegmentActionTarget = {
  readonly memoryId: string;
  readonly segment: WorkspaceMemoryDetail['segments'][number];
};

export type SegmentDeleteTarget = SegmentActionTarget;

export type SegmentRenameTarget = SegmentActionTarget;

export type SegmentContentRenameTarget = SegmentActionTarget & {
  readonly contentKind: 'body' | 'transcript';
  readonly currentTitle: string;
};

export type SegmentContentClearTarget =
  | (SegmentActionTarget & {
      readonly baselineContentHash: string;
      readonly contentKind: 'body';
      readonly currentTitle: string;
    })
  | (SegmentActionTarget & {
      readonly baselineTranscriptHash: string;
      readonly contentKind: 'transcript';
      readonly currentTitle: string;
    });

export type SegmentTranscriptEditTarget = {
  readonly baselineTranscriptHash: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
  readonly transcriptText: string;
};

export type SegmentSupplementActionTarget = SegmentActionTarget & {
  readonly supplement: WorkspaceMemoryDetail['segments'][number]['supplements'][number];
};

export type SegmentSupplementDeleteTarget = SegmentSupplementActionTarget;

export type SegmentSupplementRenameTarget = SegmentSupplementActionTarget;

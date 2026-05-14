import type { WorkspaceMemoryDetail } from './workspaceApi';

export type SegmentActionTarget = {
  readonly memoryId: string;
  readonly segment: WorkspaceMemoryDetail['segments'][number];
};

export type SegmentDeleteTarget = SegmentActionTarget;

export type SegmentRenameTarget = SegmentActionTarget;

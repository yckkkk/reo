import type { WorkspaceMemoryDetail } from './workspaceApi';

export type SegmentActionTarget = {
  readonly memoryId: string;
  readonly segment: WorkspaceMemoryDetail['segments'][number];
};

export type SegmentDeleteTarget = SegmentActionTarget;

export type SegmentRenameTarget = SegmentActionTarget;

export type SegmentAttachmentActionTarget = SegmentActionTarget & {
  readonly attachment: WorkspaceMemoryDetail['segments'][number]['attachments'][number];
};

export type SegmentAttachmentDeleteTarget = SegmentAttachmentActionTarget;

export type SegmentAttachmentRenameTarget = SegmentAttachmentActionTarget;

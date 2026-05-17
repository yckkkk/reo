export type SegmentTranscriptionTargetIdentity = {
  readonly memoryId: string;
  readonly segmentId: string;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
};

export type SegmentSupplementTranscriptionTargetIdentity = SegmentTranscriptionTargetIdentity & {
  readonly supplementId: string;
};

export function segmentTranscriptionTargetKey({
  memoryId,
  segmentId,
  workspaceHandle,
  workspaceId,
}: SegmentTranscriptionTargetIdentity): string {
  return `${workspaceHandle}\0${workspaceId}\0${memoryId}\0${segmentId}`;
}

export function supplementTranscriptionTargetKey({
  memoryId,
  segmentId,
  supplementId,
  workspaceHandle,
  workspaceId,
}: SegmentSupplementTranscriptionTargetIdentity): string {
  return `${workspaceHandle}\0${workspaceId}\0${memoryId}\0${segmentId}\0${supplementId}`;
}

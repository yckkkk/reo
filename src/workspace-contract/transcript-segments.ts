export type WorkspaceTranscriptSegmentLike = {
  readonly endTimeMs: number;
  readonly isFinal: boolean;
  readonly recordingSessionId: string;
  readonly revisionId: string;
  readonly startTimeMs: number;
  readonly text: string;
};

export function compareTranscriptSegments(
  left: WorkspaceTranscriptSegmentLike,
  right: WorkspaceTranscriptSegmentLike
) {
  return left.startTimeMs - right.startTimeMs || left.endTimeMs - right.endTimeMs;
}

export function transcriptSegmentsOverlap(
  left: WorkspaceTranscriptSegmentLike,
  right: WorkspaceTranscriptSegmentLike
) {
  return left.startTimeMs < right.endTimeMs && right.startTimeMs < left.endTimeMs;
}

export function isNonEmptyTranscriptSegment(segment: WorkspaceTranscriptSegmentLike) {
  return (
    segment.startTimeMs >= 0 &&
    segment.endTimeMs >= segment.startTimeMs &&
    segment.text.trim().length > 0
  );
}

export function mergeTranscriptSegments<Segment extends WorkspaceTranscriptSegmentLike>(
  existing: readonly Segment[],
  incoming: readonly Segment[]
) {
  const segments = [...existing];
  for (const segment of incoming) {
    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const current = segments[index];
      if (current && transcriptSegmentsOverlap(current, segment)) {
        segments.splice(index, 1);
      }
    }
    segments.push(segment);
  }
  return segments.sort(compareTranscriptSegments);
}

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
): Segment[] {
  if (incoming.length === 0) {
    return [...existing];
  }
  const orderedIncoming = normalizeIncomingTranscriptSegments(incoming);
  if (existing.length === 0) {
    return orderedIncoming;
  }

  const firstIncoming = orderedIncoming[0]!;
  const lastIncoming = orderedIncoming[orderedIncoming.length - 1]!;
  const firstExisting = existing[0]!;
  const lastExisting = existing[existing.length - 1]!;

  if (lastExisting.endTimeMs <= firstIncoming.startTimeMs) {
    return [...existing, ...orderedIncoming];
  }
  if (lastIncoming.endTimeMs <= firstExisting.startTimeMs) {
    return [...orderedIncoming, ...existing];
  }

  const merged: Segment[] = [];
  let existingIndex = 0;
  for (const segment of orderedIncoming) {
    while (
      existingIndex < existing.length &&
      existing[existingIndex]!.endTimeMs <= segment.startTimeMs
    ) {
      merged.push(existing[existingIndex]!);
      existingIndex += 1;
    }
    while (
      existingIndex < existing.length &&
      existing[existingIndex]!.startTimeMs < segment.endTimeMs
    ) {
      existingIndex += 1;
    }
    while (merged.length > 0 && transcriptSegmentsOverlap(merged[merged.length - 1]!, segment)) {
      merged.pop();
    }
    merged.push(segment);
  }
  while (existingIndex < existing.length) {
    merged.push(existing[existingIndex]!);
    existingIndex += 1;
  }
  return merged;
}

function normalizeIncomingTranscriptSegments<Segment extends WorkspaceTranscriptSegmentLike>(
  incoming: readonly Segment[]
) {
  const ordered: Segment[] = [];
  for (const segment of [...incoming].sort(compareTranscriptSegments)) {
    while (ordered.length > 0 && transcriptSegmentsOverlap(ordered[ordered.length - 1]!, segment)) {
      ordered.pop();
    }
    ordered.push(segment);
  }
  return ordered;
}

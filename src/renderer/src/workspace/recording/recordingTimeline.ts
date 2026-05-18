import {
  compareTranscriptSegments,
  isNonEmptyTranscriptSegment,
  mergeTranscriptSegments,
  type WorkspaceTranscriptSegmentLike,
} from '../../../../workspace-contract/transcript-segments';

export type TranscriptSegment = WorkspaceTranscriptSegmentLike;

export type RecordingTimeline = {
  readonly cursorTimeMs: number;
  readonly recordingSessionId: string;
  readonly revisionId: string;
  readonly totalDurationMs: number;
  readonly transcriptSegments: readonly TranscriptSegment[];
};

type CreateRecordingTimelineInput = {
  readonly cursorTimeMs?: number;
  readonly recordingSessionId: string;
  readonly revisionId: string;
  readonly totalDurationMs?: number;
  readonly transcriptSegments?: readonly TranscriptSegment[];
};

function clampTime(timeMs: number, totalDurationMs: number) {
  return Math.min(Math.max(0, Math.round(timeMs)), Math.max(0, Math.round(totalDurationMs)));
}

export function createRecordingTimeline({
  cursorTimeMs,
  recordingSessionId,
  revisionId,
  totalDurationMs = 0,
  transcriptSegments = [],
}: CreateRecordingTimelineInput): RecordingTimeline {
  const safeTotalDurationMs = Math.max(0, Math.round(totalDurationMs));
  return {
    cursorTimeMs: clampTime(cursorTimeMs ?? safeTotalDurationMs, safeTotalDurationMs),
    recordingSessionId,
    revisionId,
    totalDurationMs: safeTotalDurationMs,
    transcriptSegments: [...transcriptSegments.filter(isNonEmptyTranscriptSegment)].sort(
      compareTranscriptSegments
    ),
  };
}

export function applyTranscriptResult(
  timeline: RecordingTimeline,
  segment: TranscriptSegment
): RecordingTimeline {
  if (
    !isNonEmptyTranscriptSegment(segment) ||
    segment.recordingSessionId !== timeline.recordingSessionId ||
    segment.revisionId !== timeline.revisionId
  ) {
    return timeline;
  }

  return {
    ...timeline,
    transcriptSegments: mergeTranscriptSegments(timeline.transcriptSegments, [segment]),
    totalDurationMs: Math.max(timeline.totalDurationMs, segment.endTimeMs),
  };
}

export function applyTranscriptResults(
  timeline: RecordingTimeline,
  segments: readonly TranscriptSegment[]
): RecordingTimeline {
  if (segments.length === 0) {
    return timeline;
  }

  const acceptedSegments: TranscriptSegment[] = [];
  let maxEndTimeMs = timeline.totalDurationMs;
  for (const segment of segments) {
    if (
      isNonEmptyTranscriptSegment(segment) &&
      segment.recordingSessionId === timeline.recordingSessionId &&
      segment.revisionId === timeline.revisionId
    ) {
      acceptedSegments.push(segment);
      maxEndTimeMs = Math.max(maxEndTimeMs, segment.endTimeMs);
    }
  }
  if (acceptedSegments.length === 0) {
    return timeline;
  }

  return {
    ...timeline,
    transcriptSegments: mergeTranscriptSegments(timeline.transcriptSegments, acceptedSegments),
    totalDurationMs: maxEndTimeMs,
  };
}

export function transcriptMarkdownFromSegments(segments: readonly TranscriptSegment[]) {
  return segments
    .filter((segment) => segment.text.trim().length > 0)
    .map((segment) => segment.text.trim())
    .join('\n');
}

export function findTranscriptSegmentAtTime(
  segments: readonly TranscriptSegment[],
  timeMs: number
): TranscriptSegment | null {
  const safeTimeMs = Math.max(0, Math.round(timeMs));
  let low = 0;
  let high = segments.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const segment = segments[mid];
    if (!segment) {
      return null;
    }
    if (safeTimeMs < segment.startTimeMs) {
      high = mid - 1;
    } else if (safeTimeMs >= segment.endTimeMs) {
      low = mid + 1;
    } else {
      return segment;
    }
  }

  return null;
}

export function findTranscriptSegmentAtOrBeforeTime(
  segments: readonly TranscriptSegment[],
  timeMs: number
): TranscriptSegment | null {
  const safeTimeMs = Math.max(0, Math.round(timeMs));
  let low = 0;
  let high = segments.length - 1;
  let candidate: TranscriptSegment | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const segment = segments[mid];
    if (!segment) {
      return candidate;
    }
    if (segment.startTimeMs <= safeTimeMs) {
      candidate = segment;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return candidate;
}

export function hasTailAfterCursor(timeline: RecordingTimeline, epsilonMs = 50) {
  return timeline.cursorTimeMs < timeline.totalDurationMs - epsilonMs;
}

export function moveRecordingCursor(
  timeline: RecordingTimeline,
  nextCursorTimeMs: number
): RecordingTimeline {
  return {
    ...timeline,
    cursorTimeMs: clampTime(nextCursorTimeMs, timeline.totalDurationMs),
  };
}

export function startReplacementAtCursor(
  timeline: RecordingTimeline,
  {
    cursorTimeMs,
    nextRevisionId,
  }: {
    readonly cursorTimeMs: number;
    readonly nextRevisionId: string;
  }
): RecordingTimeline {
  const safeCursorTimeMs = clampTime(cursorTimeMs, timeline.totalDurationMs);
  return {
    ...timeline,
    cursorTimeMs: safeCursorTimeMs,
    revisionId: nextRevisionId,
    totalDurationMs: safeCursorTimeMs,
    transcriptSegments: timeline.transcriptSegments
      .map((segment) => truncateSegmentAtCursor(segment, safeCursorTimeMs))
      .filter((segment): segment is TranscriptSegment => segment !== null),
  };
}

function truncateSegmentAtCursor(
  segment: TranscriptSegment,
  cursorTimeMs: number
): TranscriptSegment | null {
  if (segment.endTimeMs <= cursorTimeMs) {
    return segment;
  }
  return null;
}

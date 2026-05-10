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
  return (
    segments.find(
      (segment) => segment.startTimeMs <= safeTimeMs && safeTimeMs < segment.endTimeMs
    ) ?? null
  );
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
  if (segment.startTimeMs >= cursorTimeMs) {
    return null;
  }

  const durationMs = Math.max(1, segment.endTimeMs - segment.startTimeMs);
  const retainedRatio = Math.min(1, Math.max(0, (cursorTimeMs - segment.startTimeMs) / durationMs));
  const retainedLength = Math.max(1, Math.floor(segment.text.length * retainedRatio));
  const retainedText = segment.text.slice(0, retainedLength).trim();
  if (retainedText.length === 0) {
    return null;
  }
  return {
    ...segment,
    endTimeMs: cursorTimeMs,
    text: retainedText,
  };
}

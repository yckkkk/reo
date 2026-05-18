import { useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { type TranscriptSegment } from './recordingTimeline';
import { RECORDING_SPEECH_TEXT_CLASS } from './recordingTypography';

type TranscriptAutoScrollMode = 'focus' | 'latest';

type RecordingTranscriptPreviewProps = {
  readonly autoScrollMode?: TranscriptAutoScrollMode;
  readonly fallback: string;
  readonly focusTimeMs: number;
  readonly segments: readonly TranscriptSegment[];
};

const TRANSCRIPT_BOTTOM_EPSILON_PX = 8;
const MAX_RENDERED_TRANSCRIPT_SEGMENT_SPANS = 80;
const FOCUSED_TRANSCRIPT_CONTEXT_BEFORE = 30;
const FOCUSED_TRANSCRIPT_CONTEXT_AFTER = 49;

function segmentKey(segment: TranscriptSegment) {
  return `${segment.revisionId}:${segment.startTimeMs}:${segment.endTimeMs}`;
}

function segmentVersion(segment: TranscriptSegment) {
  return `${segmentKey(segment)}:${segment.isFinal ? 'final' : 'partial'}:${segment.text}`;
}

function findFocusedSegmentIndex(segments: readonly TranscriptSegment[], focusTimeMs: number) {
  if (segments.length === 0) {
    return -1;
  }
  const safeTimeMs = Math.max(0, Math.round(focusTimeMs));
  let low = 0;
  let high = segments.length - 1;
  let candidateIndex = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const segment = segments[mid];
    if (!segment) {
      break;
    }
    if (safeTimeMs < segment.startTimeMs) {
      high = mid - 1;
    } else {
      candidateIndex = mid;
      if (safeTimeMs < segment.endTimeMs) {
        break;
      }
      low = mid + 1;
    }
  }

  return candidateIndex;
}

function transcriptVersionFor(segments: readonly TranscriptSegment[]) {
  const latest = segments.at(-1);
  return `${segments.length}:${latest ? segmentVersion(latest) : 'empty'}`;
}

function segmentToneClass(segment: TranscriptSegment, active: boolean) {
  if (active) {
    return 'text-foreground';
  }
  if (segment.isFinal) {
    return 'text-foreground';
  }
  return 'text-muted-foreground';
}

function isScrolledToBottom(element: HTMLElement) {
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <= TRANSCRIPT_BOTTOM_EPSILON_PX
  );
}

type TranscriptDisplayItem =
  | {
      readonly kind: 'gap';
      readonly key: string;
    }
  | {
      readonly kind: 'segment';
      readonly segment: TranscriptSegment;
    };

function transcriptWindowRange({
  focusedSegmentIndex,
  segments,
}: {
  readonly focusedSegmentIndex: number;
  readonly segments: readonly TranscriptSegment[];
}) {
  const focusedIndex = Math.max(
    0,
    focusedSegmentIndex >= 0 ? focusedSegmentIndex : segments.length - 1
  );
  let startIndex = Math.max(0, focusedIndex - FOCUSED_TRANSCRIPT_CONTEXT_BEFORE);
  let endIndex = Math.min(segments.length, focusedIndex + FOCUSED_TRANSCRIPT_CONTEXT_AFTER + 1);

  if (
    endIndex - startIndex < MAX_RENDERED_TRANSCRIPT_SEGMENT_SPANS &&
    endIndex === segments.length
  ) {
    startIndex = Math.max(0, endIndex - MAX_RENDERED_TRANSCRIPT_SEGMENT_SPANS);
  }
  if (endIndex - startIndex < MAX_RENDERED_TRANSCRIPT_SEGMENT_SPANS && startIndex === 0) {
    endIndex = Math.min(segments.length, MAX_RENDERED_TRANSCRIPT_SEGMENT_SPANS);
  }

  return { endIndex, startIndex };
}

function transcriptDisplayItems({
  focusedSegmentIndex,
  segments,
}: {
  readonly focusedSegmentIndex: number;
  readonly segments: readonly TranscriptSegment[];
}): readonly TranscriptDisplayItem[] {
  if (segments.length <= MAX_RENDERED_TRANSCRIPT_SEGMENT_SPANS) {
    return segments.map((segment) => ({ kind: 'segment', segment }));
  }

  const { endIndex, startIndex } = transcriptWindowRange({ focusedSegmentIndex, segments });
  const items: TranscriptDisplayItem[] = [];
  if (startIndex > 0) {
    items.push({
      kind: 'gap',
      key: `combined-before:${startIndex}`,
    });
  }
  for (const segment of segments.slice(startIndex, endIndex)) {
    items.push({ kind: 'segment', segment });
  }
  if (endIndex < segments.length) {
    items.push({
      kind: 'gap',
      key: `combined-after:${endIndex}`,
    });
  }
  return items;
}

function scrollTranscriptToBottom(element: HTMLElement) {
  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ behavior: 'instant', top: element.scrollHeight });
    return;
  }

  element.scrollTop = element.scrollHeight;
}

function scrollTranscriptFocusIntoView(container: HTMLElement, focusedElement: HTMLElement) {
  const availableOffset = Math.max(0, (container.clientHeight - focusedElement.offsetHeight) / 2);
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
  const top = Math.min(maxScrollTop, Math.max(0, focusedElement.offsetTop - availableOffset));

  if (typeof container.scrollTo === 'function') {
    container.scrollTo({ behavior: 'instant', top });
    return;
  }

  container.scrollTop = top;
}

export function RecordingTranscriptPreview({
  autoScrollMode = 'focus',
  fallback,
  focusTimeMs,
  segments,
}: RecordingTranscriptPreviewProps) {
  const focusedSegmentIndex = useMemo(
    () => findFocusedSegmentIndex(segments, focusTimeMs),
    [focusTimeMs, segments]
  );
  const focusedSegment = focusedSegmentIndex >= 0 ? segments[focusedSegmentIndex] : null;
  const focusedSegmentKey = focusedSegment ? segmentKey(focusedSegment) : null;
  const transcriptVersion = useMemo(() => transcriptVersionFor(segments), [segments]);
  const displayItems = useMemo(
    () => transcriptDisplayItems({ focusedSegmentIndex, segments }),
    [focusedSegmentIndex, segments]
  );
  const shouldFollowLatestRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const userScrollIntentRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const focusedSegmentRef = useRef<HTMLSpanElement | null>(null);

  const markUserScrollIntent = useCallback(() => {
    userScrollIntentRef.current = true;
    programmaticScrollRef.current = false;
  }, []);

  const handleTranscriptScroll = useCallback(() => {
    if (autoScrollMode !== 'latest' || !scrollContainerRef.current) {
      return;
    }

    if (programmaticScrollRef.current && !userScrollIntentRef.current) {
      return;
    }

    shouldFollowLatestRef.current = isScrolledToBottom(scrollContainerRef.current);
    userScrollIntentRef.current = false;
  }, [autoScrollMode]);

  useEffect(() => {
    shouldFollowLatestRef.current = true;
    programmaticScrollRef.current = false;
    userScrollIntentRef.current = false;
  }, [autoScrollMode]);

  useEffect(() => {
    if (autoScrollMode !== 'focus') {
      return;
    }

    if (!scrollContainerRef.current || !focusedSegmentRef.current) {
      return;
    }

    scrollTranscriptFocusIntoView(scrollContainerRef.current, focusedSegmentRef.current);
  }, [autoScrollMode, focusedSegmentKey]);

  useEffect(() => {
    if (autoScrollMode !== 'latest' || segments.length === 0 || !scrollContainerRef.current) {
      return;
    }

    if (!shouldFollowLatestRef.current) {
      return;
    }

    programmaticScrollRef.current = true;
    scrollTranscriptToBottom(scrollContainerRef.current);
  }, [autoScrollMode, segments.length, transcriptVersion]);

  return (
    <section
      aria-label="实时转写"
      className="relative flex h-full w-full max-w-[720px] items-center justify-center px-0 text-center"
      role="region"
    >
      {segments.length > 0 ? (
        <div
          className={cn(
            'edge-fade-y scrollbar-hover select-text max-h-[120px] overflow-y-auto py-16 text-balance text-foreground',
            RECORDING_SPEECH_TEXT_CLASS
          )}
          data-testid="recording-transcript-scroll"
          onKeyDown={markUserScrollIntent}
          onScroll={handleTranscriptScroll}
          onTouchMove={markUserScrollIntent}
          onWheel={markUserScrollIntent}
          onPointerDown={markUserScrollIntent}
          ref={scrollContainerRef}
          tabIndex={0}
        >
          {displayItems.map((item) => {
            if (item.kind === 'gap') {
              return (
                <span
                  aria-hidden="true"
                  className="mx-3 text-muted-foreground transition-colors duration-200 motion-reduce:transition-none"
                  key={item.key}
                >
                  ...
                </span>
              );
            }
            const active = focusedSegmentKey === segmentKey(item.segment);
            return (
              <span
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'mx-3 transition-colors duration-200 motion-reduce:transition-none',
                  segmentToneClass(item.segment, active)
                )}
                key={segmentKey(item.segment)}
                ref={active ? focusedSegmentRef : null}
              >
                {item.segment.text}
              </span>
            );
          })}
        </div>
      ) : (
        <p
          className={cn(
            'max-w-[620px] text-balance text-muted-foreground',
            RECORDING_SPEECH_TEXT_CLASS
          )}
        >
          {fallback}
        </p>
      )}
    </section>
  );
}

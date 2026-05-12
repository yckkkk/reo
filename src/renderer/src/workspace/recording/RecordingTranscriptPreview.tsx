import { useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { findTranscriptSegmentAtTime, type TranscriptSegment } from './recordingTimeline';

type TranscriptAutoScrollMode = 'focus' | 'latest';

type RecordingTranscriptPreviewProps = {
  readonly autoScrollMode?: TranscriptAutoScrollMode;
  readonly fallback: string;
  readonly focusTimeMs: number;
  readonly segments: readonly TranscriptSegment[];
};

const TRANSCRIPT_BOTTOM_EPSILON_PX = 8;

function segmentKey(segment: TranscriptSegment) {
  return `${segment.revisionId}:${segment.startTimeMs}:${segment.endTimeMs}`;
}

function segmentVersion(segment: TranscriptSegment) {
  return `${segmentKey(segment)}:${segment.isFinal ? 'final' : 'partial'}:${segment.text}`;
}

function findFocusedSegment(segments: readonly TranscriptSegment[], focusTimeMs: number) {
  const direct = findTranscriptSegmentAtTime(segments, focusTimeMs);
  if (direct) {
    return direct;
  }
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (segment && segment.startTimeMs <= focusTimeMs) {
      return segment;
    }
  }
  return null;
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

function scrollTranscriptToBottom(element: HTMLElement) {
  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ behavior: 'instant', top: element.scrollHeight });
    return;
  }

  element.scrollTop = element.scrollHeight;
}

export function RecordingTranscriptPreview({
  autoScrollMode = 'focus',
  fallback,
  focusTimeMs,
  segments,
}: RecordingTranscriptPreviewProps) {
  const focusedSegment = useMemo(
    () => findFocusedSegment(segments, focusTimeMs),
    [focusTimeMs, segments]
  );
  const focusedSegmentKey = focusedSegment ? segmentKey(focusedSegment) : null;
  const transcriptVersion = useMemo(() => transcriptVersionFor(segments), [segments]);
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

    if (typeof focusedSegmentRef.current?.scrollIntoView !== 'function') {
      return;
    }

    focusedSegmentRef.current.scrollIntoView({
      block: 'center',
      behavior: 'instant',
    });
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
          className="select-text max-h-[120px] overflow-y-auto py-16 text-balance text-heading-sm font-medium leading-[1.55] text-foreground"
          data-testid="recording-transcript-scroll"
          onKeyDown={markUserScrollIntent}
          onScroll={handleTranscriptScroll}
          onTouchMove={markUserScrollIntent}
          onWheel={markUserScrollIntent}
          onPointerDown={markUserScrollIntent}
          ref={scrollContainerRef}
          tabIndex={0}
        >
          {segments.map((segment) => {
            const active = focusedSegmentKey === segmentKey(segment);
            return (
              <span
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'mx-3 transition-colors duration-200 motion-reduce:transition-none',
                  segmentToneClass(segment, active)
                )}
                key={segmentKey(segment)}
                ref={active ? focusedSegmentRef : null}
              >
                {segment.text}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="max-w-[620px] text-balance text-body-lg font-medium leading-body-lg text-muted-foreground">
          {fallback}
        </p>
      )}
    </section>
  );
}

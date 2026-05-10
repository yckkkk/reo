import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingTranscriptPreview } from './RecordingTranscriptPreview';
import type { TranscriptSegment } from './recordingTimeline';

const segments: readonly TranscriptSegment[] = [
  {
    endTimeMs: 3_000,
    isFinal: true,
    recordingSessionId: 'recording-1',
    revisionId: 'revision-1',
    startTimeMs: 0,
    text: '第一段转写',
  },
  {
    endTimeMs: 8_000,
    isFinal: false,
    recordingSessionId: 'recording-1',
    revisionId: 'revision-1',
    startTimeMs: 3_000,
    text: '第二段转写',
  },
];

const thirdSegment: TranscriptSegment = {
  endTimeMs: 12_000,
  isFinal: false,
  recordingSessionId: 'recording-1',
  revisionId: 'revision-1',
  startTimeMs: 8_000,
  text: '第三段转写',
};

function setScrollMetrics(
  element: HTMLElement,
  {
    clientHeight,
    scrollHeight,
    scrollTop,
  }: {
    readonly clientHeight: number;
    readonly scrollHeight: number;
    readonly scrollTop: number;
  }
) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: clientHeight },
    scrollHeight: { configurable: true, value: scrollHeight },
    scrollTop: { configurable: true, value: scrollTop, writable: true },
  });
}

describe('RecordingTranscriptPreview', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders the active transcript segment and scrolls when cursor focus changes', () => {
    const { rerender } = render(
      <RecordingTranscriptPreview
        fallback="实时转写会在你说话时安静地出现在这里。"
        focusTimeMs={1_000}
        segments={segments}
      />
    );

    expect(screen.getByRole('region', { name: '实时转写' })).toBeInTheDocument();
    expect(screen.getByText('第一段转写')).toHaveAttribute('aria-current', 'true');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(
      <RecordingTranscriptPreview
        fallback="实时转写会在你说话时安静地出现在这里。"
        focusTimeMs={4_000}
        segments={segments}
      />
    );

    expect(screen.getByText('第二段转写')).toHaveAttribute('aria-current', 'true');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('keeps a quiet fallback when no transcript segment is available', () => {
    render(
      <RecordingTranscriptPreview
        fallback="实时转写会在你说话时安静地出现在这里。"
        focusTimeMs={0}
        segments={[]}
      />
    );

    expect(screen.getByText('实时转写会在你说话时安静地出现在这里。')).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('softly follows new live transcript content while the user is at the bottom', () => {
    const { rerender } = render(
      <RecordingTranscriptPreview
        autoScrollMode="latest"
        fallback="实时转写会在你说话时安静地出现在这里。"
        focusTimeMs={8_000}
        segments={segments}
      />
    );
    const scrollContainer = screen.getByTestId('recording-transcript-scroll');
    const scrollTo = vi.fn();
    scrollContainer.scrollTo = scrollTo;
    setScrollMetrics(scrollContainer, { clientHeight: 120, scrollHeight: 280, scrollTop: 160 });

    rerender(
      <RecordingTranscriptPreview
        autoScrollMode="latest"
        fallback="实时转写会在你说话时安静地出现在这里。"
        focusTimeMs={12_000}
        segments={[...segments, thirdSegment]}
      />
    );

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'smooth', top: 280 });
  });

  it('stops following live transcript when the user scrolls away and resumes at bottom', () => {
    const { rerender } = render(
      <RecordingTranscriptPreview
        autoScrollMode="latest"
        fallback="实时转写会在你说话时安静地出现在这里。"
        focusTimeMs={8_000}
        segments={segments}
      />
    );
    const scrollContainer = screen.getByTestId('recording-transcript-scroll');
    const scrollTo = vi.fn();
    scrollContainer.scrollTo = scrollTo;
    setScrollMetrics(scrollContainer, { clientHeight: 120, scrollHeight: 280, scrollTop: 40 });
    fireEvent.wheel(scrollContainer);
    fireEvent.scroll(scrollContainer);

    rerender(
      <RecordingTranscriptPreview
        autoScrollMode="latest"
        fallback="实时转写会在你说话时安静地出现在这里。"
        focusTimeMs={12_000}
        segments={[...segments, thirdSegment]}
      />
    );

    expect(scrollTo).not.toHaveBeenCalled();

    setScrollMetrics(scrollContainer, { clientHeight: 120, scrollHeight: 280, scrollTop: 160 });
    fireEvent.wheel(scrollContainer);
    fireEvent.scroll(scrollContainer);
    setScrollMetrics(scrollContainer, { clientHeight: 120, scrollHeight: 360, scrollTop: 160 });

    rerender(
      <RecordingTranscriptPreview
        autoScrollMode="latest"
        fallback="实时转写会在你说话时安静地出现在这里。"
        focusTimeMs={13_000}
        segments={[
          ...segments,
          thirdSegment,
          {
            endTimeMs: 13_000,
            isFinal: false,
            recordingSessionId: 'recording-1',
            revisionId: 'revision-1',
            startTimeMs: 12_000,
            text: '第四段转写',
          },
        ]}
      />
    );

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'smooth', top: 360 });
  });

  it('stops following live transcript when keyboard scrolling moves away from the bottom', () => {
    const { rerender } = render(
      <RecordingTranscriptPreview
        autoScrollMode="latest"
        fallback="实时转写会在你说话时安静地出现在这里。"
        focusTimeMs={8_000}
        segments={segments}
      />
    );
    const scrollContainer = screen.getByTestId('recording-transcript-scroll');
    const scrollTo = vi.fn();
    scrollContainer.scrollTo = scrollTo;
    setScrollMetrics(scrollContainer, { clientHeight: 120, scrollHeight: 280, scrollTop: 40 });
    fireEvent.keyDown(scrollContainer, { key: 'PageUp' });
    fireEvent.scroll(scrollContainer);

    rerender(
      <RecordingTranscriptPreview
        autoScrollMode="latest"
        fallback="实时转写会在你说话时安静地出现在这里。"
        focusTimeMs={12_000}
        segments={[...segments, thirdSegment]}
      />
    );

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('keeps following when a smooth programmatic scroll emits intermediate scroll events', () => {
    const { rerender } = render(
      <RecordingTranscriptPreview
        autoScrollMode="latest"
        fallback="实时转写会在你说话时安静地出现在这里。"
        focusTimeMs={8_000}
        segments={segments}
      />
    );
    const scrollContainer = screen.getByTestId('recording-transcript-scroll');
    const scrollTo = vi.fn();
    scrollContainer.scrollTo = scrollTo;
    setScrollMetrics(scrollContainer, { clientHeight: 120, scrollHeight: 280, scrollTop: 160 });

    rerender(
      <RecordingTranscriptPreview
        autoScrollMode="latest"
        fallback="实时转写会在你说话时安静地出现在这里。"
        focusTimeMs={12_000}
        segments={[...segments, thirdSegment]}
      />
    );

    setScrollMetrics(scrollContainer, { clientHeight: 120, scrollHeight: 360, scrollTop: 110 });
    fireEvent.scroll(scrollContainer);

    rerender(
      <RecordingTranscriptPreview
        autoScrollMode="latest"
        fallback="实时转写会在你说话时安静地出现在这里。"
        focusTimeMs={13_000}
        segments={[
          ...segments,
          thirdSegment,
          {
            endTimeMs: 13_000,
            isFinal: false,
            recordingSessionId: 'recording-1',
            revisionId: 'revision-1',
            startTimeMs: 12_000,
            text: '第四段转写',
          },
        ]}
      />
    );

    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'smooth', top: 360 });
  });

  it('does not reserve a pane-like filled transcript block', () => {
    render(
      <RecordingTranscriptPreview
        fallback="实时转写会在你说话时安静地出现在这里。"
        focusTimeMs={0}
        segments={[]}
      />
    );

    const region = screen.getByRole('region', { name: '实时转写' });
    expect(region.className).not.toContain('min-h-');
    expect(region.className).not.toContain('overflow-hidden');
    expect(region.className).not.toContain('bg-');
  });
});

type TranscriptStatus = 'loading' | 'error' | 'ready';

export type SegmentTranscriptViewCopy = {
  readonly loading: string;
  readonly error: string;
  readonly empty: string;
};

export type SegmentTranscriptViewProps = {
  readonly status: TranscriptStatus;
  readonly transcript: { readonly exists: boolean; readonly text: string } | null;
  readonly copy: SegmentTranscriptViewCopy;
};

const MUTED_PARAGRAPH = 'text-body leading-body text-muted-foreground';
const TRANSCRIPT_PARAGRAPH =
  'select-text max-w-[820px] text-body leading-[1.78] text-foreground';

export function SegmentTranscriptView({ status, transcript, copy }: SegmentTranscriptViewProps) {
  if (status === 'loading') {
    return <p className={MUTED_PARAGRAPH}>{copy.loading}</p>;
  }
  if (status === 'error') {
    return <p className={MUTED_PARAGRAPH}>{copy.error}</p>;
  }
  if (transcript?.exists) {
    return <p className={TRANSCRIPT_PARAGRAPH}>{transcript.text}</p>;
  }
  return <p className={MUTED_PARAGRAPH}>{copy.empty}</p>;
}

import { Button } from '@/components/ui/button';

type TranscriptStatus = 'loading' | 'error' | 'ready';

export type SegmentTranscriptViewCopy = {
  readonly loading: string;
  readonly error: string;
  readonly empty: string;
  readonly failedRetryable: string;
  readonly running: string;
  readonly retry: string;
};

export type SegmentTranscriptOutcome =
  | { readonly kind: 'success'; readonly text: string }
  | { readonly kind: 'empty-never' }
  | { readonly kind: 'empty-cleared' }
  | { readonly kind: 'failed-retryable' }
  | { readonly kind: 'running' };

export type SegmentTranscriptViewProps = {
  readonly status: TranscriptStatus;
  readonly outcome: SegmentTranscriptOutcome;
  readonly onRetry?: () => void;
  readonly copy: SegmentTranscriptViewCopy;
};

const MUTED_PARAGRAPH = 'text-body leading-body text-muted-foreground';
const TRANSCRIPT_PARAGRAPH = 'select-text max-w-[820px] text-body leading-[1.78] text-foreground';

export function SegmentTranscriptView({
  status,
  outcome,
  onRetry,
  copy,
}: SegmentTranscriptViewProps) {
  if (status === 'loading') {
    return <p className={MUTED_PARAGRAPH}>{copy.loading}</p>;
  }
  if (status === 'error') {
    return <p className={MUTED_PARAGRAPH}>{copy.error}</p>;
  }
  if (outcome.kind === 'success') {
    return <p className={TRANSCRIPT_PARAGRAPH}>{outcome.text}</p>;
  }
  if (outcome.kind === 'running') {
    return <p className={MUTED_PARAGRAPH}>{copy.running}</p>;
  }
  if (outcome.kind === 'failed-retryable') {
    return (
      <div className="flex items-center gap-12">
        <p className={MUTED_PARAGRAPH}>{copy.failedRetryable}</p>
        <Button
          type="button"
          variant="secondary"
          size="compact"
          disabled={!onRetry}
          onClick={onRetry}
        >
          {copy.retry}
        </Button>
      </div>
    );
  }
  return <p className={MUTED_PARAGRAPH}>{copy.empty}</p>;
}

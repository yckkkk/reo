import { format } from 'date-fns';
import { Ellipsis, FileText } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ReoCardSurface } from '@/components/ui/card-surface';
import {
  coverToneStyle,
  fallbackCoverToneForSource,
  resolveCoverToneForImageSource,
} from './covers/coverTone';
import { resolveSegmentCoverImageSource } from './covers/memoryCoverSource';
import { byteLengthLabel } from './memoryLabels';
import type { WorkspaceMemoryDetail } from './workspaceApi';

type MemorySegment = WorkspaceMemoryDetail['segments'][number];
type AudioMemorySegment = Extract<MemorySegment, { readonly type: 'audio' }>;
type MemoryStudioSegmentStripStyle = CSSProperties & {
  readonly '--memory-studio-segment-card-min-size': string;
  readonly '--memory-studio-segment-card-size': string;
  readonly '--memory-studio-segment-gap': string;
};

const SEGMENT_PREVIEW_SPECTRUM_DATA = [10, 46, 64, 82, 36, 76, 92, 52, 14];

export const MEMORY_STUDIO_SEGMENT_CARD_ESTIMATE_PX = 160;
export const MEMORY_STUDIO_SEGMENT_CARD_AXIS_TOP_CLASS =
  'top-[calc(8px+(var(--memory-studio-segment-card-size)/2)-20px)]';
export const MEMORY_STUDIO_SEGMENT_STRIP_STYLE: MemoryStudioSegmentStripStyle = {
  '--memory-studio-segment-card-min-size': '136px',
  '--memory-studio-segment-card-size':
    'clamp(var(--memory-studio-segment-card-min-size), 18vw, 148px)',
  '--memory-studio-segment-gap': '12px',
};

type MemoryStudioSegmentCardProps = {
  readonly actionMenu: ReactNode;
  readonly menuOpen?: boolean;
  readonly onSelect: () => void;
  readonly segment: MemorySegment;
  readonly selected: boolean;
  readonly workspaceId: string;
};

export function memoryStudioSegmentStripSpacerStyle(count: number): CSSProperties {
  return {
    flexBasis:
      count <= 1
        ? 'var(--memory-studio-segment-card-size)'
        : `calc(${count} * (var(--memory-studio-segment-card-size) + var(--memory-studio-segment-gap)) - var(--memory-studio-segment-gap))`,
  };
}

function isAudioMemorySegment(segment: MemorySegment): segment is AudioMemorySegment {
  return segment.type === 'audio';
}

function compactDurationLabel(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function createdTimeLabel(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return '时间未知';
  }
  return format(date, 'HH:mm');
}

function SegmentPreviewSpectrum() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-32 w-[52px] shrink-0 items-center gap-2 text-[rgb(var(--cover-bottom-r)_var(--cover-bottom-g)_var(--cover-bottom-b)/0.76)]"
      data-slot="memory-studio-segment-card-waveform"
    >
      {SEGMENT_PREVIEW_SPECTRUM_DATA.map((level, index) =>
        level <= 14 ? (
          <span key={index} className="size-4 rounded-full bg-current" />
        ) : (
          <span
            key={index}
            className="w-4 rounded-full bg-current"
            style={{ height: `${Math.round(32 * (level / 100))}px` }}
          />
        )
      )}
    </span>
  );
}

export function MemoryStudioSegmentCard({
  actionMenu,
  menuOpen = false,
  onSelect,
  segment,
  selected,
  workspaceId,
}: MemoryStudioSegmentCardProps) {
  const segmentIsAudio = isAudioMemorySegment(segment);
  const coverSource = resolveSegmentCoverImageSource({ segment, workspaceId });
  const [coverTone, setCoverTone] = useState(() => fallbackCoverToneForSource(coverSource));

  useEffect(() => {
    let cancelled = false;
    setCoverTone(fallbackCoverToneForSource(coverSource));
    void resolveCoverToneForImageSource(coverSource).then((nextTone) => {
      if (!cancelled) {
        setCoverTone(nextTone);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [coverSource]);

  return (
    <div
      data-slot="memory-studio-segment-item"
      className="group relative flex min-w-[var(--memory-studio-segment-card-min-size)] flex-[0_0_var(--memory-studio-segment-card-size)] snap-start flex-col text-left outline-none"
      style={coverToneStyle(coverTone)}
    >
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        aria-label={`选择片段 ${segment.title}`}
        className="group/segment-card flex w-full flex-col text-left outline-none"
        onClick={onSelect}
      >
        <span className="block min-w-0">
          <ReoCardSurface
            asChild
            data-slot="memory-studio-segment-card"
            shape="segmentPreview"
            className={[
              'relative flex aspect-square min-h-[var(--memory-studio-segment-card-min-size)] w-full min-w-[var(--memory-studio-segment-card-min-size)] flex-col justify-between bg-transparent p-12 text-left text-[rgb(var(--cover-title-r)_var(--cover-title-g)_var(--cover-title-b)/0.96)] transition-[filter] duration-150 [--bottom-scrim-mid:0.12] [--bottom-scrim-start:0.24] [--cover-brightness:0.98] [--cover-contrast:1.01] [--cover-saturation:1.04] [--cover-scale:1.02] [--top-scrim-mid:0.12] [--top-scrim-start:0.22] [--top-state-mid:0] [--top-state-start:0] group-focus-visible/segment-card:ring-2 group-focus-visible/segment-card:ring-ring group-focus-visible/segment-card:ring-offset-2 group-focus-visible/segment-card:ring-offset-background group-hover/segment-card:[--bottom-scrim-start:0.3] group-hover/segment-card:[--cover-brightness:1.04] group-hover/segment-card:[--cover-scale:1.035] group-hover/segment-card:[--top-scrim-start:0.26] group-hover/segment-card:[--top-state-mid:0.07] group-hover/segment-card:[--top-state-start:0.16]',
              'dark:[--bottom-scrim-mid:0.22] dark:[--bottom-scrim-start:0.38] dark:[--cover-brightness:0.92] dark:[--cover-saturation:1.02] dark:[--top-scrim-mid:0.2] dark:[--top-scrim-start:0.34] dark:group-hover/segment-card:[--bottom-scrim-start:0.34] dark:group-hover/segment-card:[--cover-brightness:0.98] dark:group-hover/segment-card:[--top-scrim-start:0.3]',
              selected
                ? '[--bottom-scrim-mid:0.42] [--bottom-scrim-start:0.7] [--cover-brightness:1] [--cover-contrast:1.04] [--cover-saturation:1.14] [--top-scrim-mid:0.42] [--top-scrim-start:0.64]'
                : '',
              menuOpen
                ? '[--bottom-scrim-start:0.68] [--cover-brightness:0.97] [--top-scrim-start:0.62] [--top-state-mid:0.09] [--top-state-start:0.2]'
                : '',
            ].join(' ')}
          >
            <span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-[-1px] z-0 block overflow-hidden"
              >
                <img
                  alt=""
                  className="size-full object-cover"
                  crossOrigin="anonymous"
                  data-slot="memory-studio-segment-card-cover"
                  decoding="async"
                  draggable={false}
                  loading="lazy"
                  src={coverSource}
                  style={{
                    filter:
                      'brightness(var(--cover-brightness)) saturate(var(--cover-saturation)) contrast(var(--cover-contrast))',
                    transform: 'scale(var(--cover-scale))',
                    transition: 'filter 150ms ease-out, transform 150ms ease-out',
                  }}
                />
              </span>
              <span
                aria-hidden="true"
                data-slot="memory-studio-segment-card-tone-scrim"
                className="pointer-events-none absolute inset-0 z-[1] block"
                style={{
                  background:
                    'radial-gradient(ellipse 124px 54px at 76px 18px, rgb(var(--cover-title-r) var(--cover-title-g) var(--cover-title-b) / var(--top-state-start)) 0%, rgb(var(--cover-title-r) var(--cover-title-g) var(--cover-title-b) / var(--top-state-mid)) 48%, transparent 84%), radial-gradient(ellipse 74px 42px at 50px 30px, rgb(var(--cover-title-protect-r) var(--cover-title-protect-g) var(--cover-title-protect-b) / var(--top-scrim-start)) 0%, rgb(var(--cover-title-protect-r) var(--cover-title-protect-g) var(--cover-title-protect-b) / var(--top-scrim-mid)) 42%, transparent 80%), radial-gradient(ellipse 64px 34px at 44px calc(100% - 24px), rgb(var(--cover-bottom-protect-r) var(--cover-bottom-protect-g) var(--cover-bottom-protect-b) / var(--bottom-scrim-start)) 0%, rgb(var(--cover-bottom-protect-r) var(--cover-bottom-protect-g) var(--cover-bottom-protect-b) / var(--bottom-scrim-mid)) 42%, transparent 80%), radial-gradient(ellipse 56px 32px at calc(100% - 30px) calc(100% - 24px), rgb(var(--cover-bottom-protect-r) var(--cover-bottom-protect-g) var(--cover-bottom-protect-b) / var(--bottom-scrim-start)) 0%, rgb(var(--cover-bottom-protect-r) var(--cover-bottom-protect-g) var(--cover-bottom-protect-b) / var(--bottom-scrim-mid)) 42%, transparent 80%)',
                }}
              />
              <span className="relative z-[2]">
                <span className="block min-w-0 pr-24">
                  <span className="block max-w-[88px] whitespace-normal text-[15px] font-[750] leading-[1.42] tracking-[0] text-[rgb(var(--cover-title-r)_var(--cover-title-g)_var(--cover-title-b)/0.97)]">
                    {segment.title}
                  </span>
                </span>
              </span>
              <span className="relative z-[2] flex min-w-0 items-center justify-between gap-6">
                {segmentIsAudio ? (
                  <>
                    <SegmentPreviewSpectrum />
                    <span
                      data-slot="memory-studio-segment-card-duration"
                      className="shrink-0 font-mono text-[13px] font-[700] leading-none tracking-[0.05em] text-[rgb(var(--cover-bottom-r)_var(--cover-bottom-g)_var(--cover-bottom-b)/0.82)]"
                    >
                      {compactDurationLabel(segment.durationMs)}
                    </span>
                  </>
                ) : (
                  <>
                    <FileText
                      aria-hidden="true"
                      className="size-28 text-[rgb(var(--cover-bottom-r)_var(--cover-bottom-g)_var(--cover-bottom-b)/0.78)]"
                      strokeWidth={1.8}
                    />
                    <span
                      data-slot="memory-studio-segment-card-note-size"
                      className="shrink-0 font-mono text-[13px] font-[700] leading-none tracking-[0.05em] text-[rgb(var(--cover-bottom-r)_var(--cover-bottom-g)_var(--cover-bottom-b)/0.82)]"
                    >
                      {byteLengthLabel(segment.bodyByteLength)}
                    </span>
                  </>
                )}
              </span>
            </span>
          </ReoCardSurface>
        </span>
        <span
          aria-hidden="true"
          data-slot="memory-studio-segment-timeline-anchor"
          className="relative mt-10 flex h-48 w-full flex-col items-center before:absolute before:left-[-12px] before:right-[-12px] before:top-[3px] before:h-px before:bg-secondary"
        >
          <span
            data-slot="memory-studio-segment-timeline-dot"
            className={[
              'relative z-[1] block size-[7px] min-h-[7px] min-w-[7px] rounded-full',
              selected ? 'bg-foreground' : 'bg-muted-foreground',
            ].join(' ')}
          />
          <span
            data-slot="memory-studio-segment-timeline-time"
            className="mt-12 block font-mono text-ui-xs leading-ui-xs tracking-wide text-muted-foreground"
          >
            {createdTimeLabel(segment.createdAt)}
          </span>
        </span>
      </button>
      {actionMenu}
    </div>
  );
}

type MemoryStudioSegmentCardActionButtonProps = ComponentPropsWithoutRef<'button'> & {
  readonly segmentTitle: string;
};

export const MemoryStudioSegmentCardActionButton = forwardRef<
  HTMLButtonElement,
  MemoryStudioSegmentCardActionButtonProps
>(function MemoryStudioSegmentCardActionButton({ className, segmentTitle, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`片段 ${segmentTitle} 更多操作`}
      className={[
        'absolute right-8 top-8 z-[3] inline-flex size-28 items-center justify-center rounded-[8px] bg-transparent text-[rgb(var(--cover-title-r)_var(--cover-title-g)_var(--cover-title-b)/0.78)] opacity-0 transition duration-150 ease-out hover:bg-[rgb(var(--cover-title-r)_var(--cover-title-g)_var(--cover-title-b)/0.14)] hover:text-[rgb(var(--cover-title-r)_var(--cover-title-g)_var(--cover-title-b)/0.96)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:bg-[rgb(var(--cover-title-r)_var(--cover-title-g)_var(--cover-title-b)/0.18)] data-[state=open]:text-[rgb(var(--cover-title-r)_var(--cover-title-g)_var(--cover-title-b)/0.96)] data-[state=open]:opacity-100',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <Ellipsis aria-hidden="true" className="size-16" />
    </button>
  );
});

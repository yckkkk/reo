import { format } from 'date-fns';
import { AppWindow, Ellipsis, FileText } from 'lucide-react';
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
  coverToneRequiresImageSampling,
  coverToneStyle,
  fallbackCoverToneForSource,
  resolveCoverToneForImageSource,
} from './covers/coverTone';
import { resolveSegmentCoverImageSource } from './covers/memoryCoverSource';
import { byteLengthLabel } from './memoryLabels';
import type { WorkspaceMemoryDetail } from './workspaceApi';

type MemorySegment = WorkspaceMemoryDetail['segments'][number];
type AudioMemorySegment = Extract<MemorySegment, { readonly type: 'audio' }>;
type ArtifactMemorySegment = Extract<MemorySegment, { readonly type: 'artifact' }>;
type MemoryStudioSegmentStripStyle = CSSProperties & {
  readonly '--memory-studio-segment-card-min-size': string;
  readonly '--memory-studio-segment-card-size': string;
  readonly '--memory-studio-segment-gap': string;
  readonly '--memory-studio-segment-selected-offset': string;
  readonly '--memory-studio-segment-selected-lift': string;
  readonly '--memory-studio-segment-selected-scale': string;
  readonly '--memory-studio-segment-selected-top-outset': string;
};
type MemoryStudioSegmentItemStyle = CSSProperties &
  Record<`--${string}`, string> & {
    readonly width: string;
  };
export type MemoryStudioSegmentSelectionPlacement = 'before' | 'selected' | 'after';

const SEGMENT_PREVIEW_SPECTRUM_DATA = [10, 46, 64, 82, 36, 76, 92, 52, 14];
const MEMORY_STUDIO_SEGMENT_CARD_SIZE = 'var(--memory-studio-segment-card-size)';
const MEMORY_STUDIO_SEGMENT_SELECTED_SCALE_VALUE = 1.08;
const MEMORY_STUDIO_SEGMENT_SELECTED_SCALE_DELTA = MEMORY_STUDIO_SEGMENT_SELECTED_SCALE_VALUE - 1;
const MEMORY_STUDIO_SEGMENT_SELECTED_OUTSET_RATIO = segmentRatio(
  MEMORY_STUDIO_SEGMENT_SELECTED_SCALE_DELTA / 2
);
const MEMORY_STUDIO_SEGMENT_SELECTED_TOP_OUTSET_RATIO = segmentRatio(
  MEMORY_STUDIO_SEGMENT_SELECTED_SCALE_DELTA
);

type WindowWithIdleCallback = Window & {
  readonly requestIdleCallback?: (
    callback: () => void,
    options?: { readonly timeout: number }
  ) => number;
  readonly cancelIdleCallback?: (handle: number) => void;
};

export const MEMORY_STUDIO_SEGMENT_CARD_AXIS_TOP_CLASS =
  'top-[calc(var(--memory-studio-segment-selected-top-outset)+(var(--memory-studio-segment-card-size)/2)-20px)]';
export const MEMORY_STUDIO_SEGMENT_STRIP_STYLE: MemoryStudioSegmentStripStyle = {
  '--memory-studio-segment-card-min-size': '136px',
  '--memory-studio-segment-card-size':
    'clamp(var(--memory-studio-segment-card-min-size), 18vw, 148px)',
  '--memory-studio-segment-gap': '12px',
  '--memory-studio-segment-selected-offset': `calc(var(--memory-studio-segment-card-size) * ${MEMORY_STUDIO_SEGMENT_SELECTED_OUTSET_RATIO})`,
  '--memory-studio-segment-selected-lift': '3px',
  '--memory-studio-segment-selected-scale': String(MEMORY_STUDIO_SEGMENT_SELECTED_SCALE_VALUE),
  '--memory-studio-segment-selected-top-outset': `calc(var(--memory-studio-segment-card-size) * ${MEMORY_STUDIO_SEGMENT_SELECTED_TOP_OUTSET_RATIO} + var(--memory-studio-segment-selected-lift))`,
};
export const MEMORY_STUDIO_SEGMENT_ITEM_STYLE = {
  width: MEMORY_STUDIO_SEGMENT_CARD_SIZE,
} satisfies CSSProperties & { readonly width: string };
const MEMORY_STUDIO_SEGMENT_CARD_BASE_SCALE = '1';
const MEMORY_STUDIO_SEGMENT_CARD_SELECTED_SCALE = 'var(--memory-studio-segment-selected-scale)';
const MEMORY_STUDIO_SEGMENT_CARD_SELECTED_Y =
  'calc(var(--memory-studio-segment-selected-lift) * -1)';
const MEMORY_STUDIO_SEGMENT_BEFORE_X = 'calc(var(--memory-studio-segment-selected-offset) * -1)';
const MEMORY_STUDIO_SEGMENT_SELECTED_X = '0px';
const MEMORY_STUDIO_SEGMENT_AFTER_X = 'var(--memory-studio-segment-selected-offset)';

type MemoryStudioSegmentCardProps = {
  readonly actionMenu: ReactNode;
  readonly menuOpen?: boolean;
  readonly onSelect: () => void;
  readonly segment: MemorySegment;
  readonly selectionPlacement: MemoryStudioSegmentSelectionPlacement;
  readonly workspaceId: string;
};

function segmentRatio(value: number) {
  return Number(value.toFixed(4)).toString();
}

function isAudioMemorySegment(segment: MemorySegment): segment is AudioMemorySegment {
  return segment.type === 'audio';
}

function isArtifactMemorySegment(segment: MemorySegment): segment is ArtifactMemorySegment {
  return segment.type === 'artifact';
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

function segmentSelectionX(placement: MemoryStudioSegmentSelectionPlacement) {
  switch (placement) {
    case 'before':
      return MEMORY_STUDIO_SEGMENT_BEFORE_X;
    case 'after':
      return MEMORY_STUDIO_SEGMENT_AFTER_X;
    case 'selected':
      return MEMORY_STUDIO_SEGMENT_SELECTED_X;
  }
}

function SegmentPreviewSpectrum() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-[32px] w-[52px] shrink-0 items-center gap-[2px] text-[rgb(var(--cover-bottom-r)_var(--cover-bottom-g)_var(--cover-bottom-b)/0.92)]"
      data-slot="memory-studio-segment-card-waveform"
    >
      {SEGMENT_PREVIEW_SPECTRUM_DATA.map((level, index) =>
        level <= 14 ? (
          <span key={index} className="block size-[4px] rounded-full bg-current" />
        ) : (
          <span
            key={index}
            className="block w-[4px] rounded-full bg-current"
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
  selectionPlacement,
  workspaceId,
}: MemoryStudioSegmentCardProps) {
  const selected = selectionPlacement === 'selected';
  const segmentIsAudio = isAudioMemorySegment(segment);
  const segmentIsArtifact = isArtifactMemorySegment(segment);
  const coverSource = resolveSegmentCoverImageSource({ segment, workspaceId });
  const [coverTone, setCoverTone] = useState(() => fallbackCoverToneForSource(coverSource));
  const selectionX = segmentSelectionX(selectionPlacement);
  const itemStyle: MemoryStudioSegmentItemStyle = {
    ...(coverToneStyle(coverTone) as Record<`--${string}`, string>),
    '--memory-studio-segment-selection-x': selectionX,
    '--memory-studio-segment-card-scale': selected
      ? MEMORY_STUDIO_SEGMENT_CARD_SELECTED_SCALE
      : MEMORY_STUDIO_SEGMENT_CARD_BASE_SCALE,
    '--memory-studio-segment-card-y': selected ? MEMORY_STUDIO_SEGMENT_CARD_SELECTED_Y : '0px',
    ...MEMORY_STUDIO_SEGMENT_ITEM_STYLE,
  };

  useEffect(() => {
    let cancelled = false;
    setCoverTone(fallbackCoverToneForSource(coverSource));
    if (!coverToneRequiresImageSampling(coverSource)) {
      return undefined;
    }
    let idleCallbackHandle: number | null = null;
    let timeoutHandle: number | null = null;
    const loadTone = () => {
      void resolveCoverToneForImageSource(coverSource).then((nextTone) => {
        if (!cancelled) {
          setCoverTone(nextTone);
        }
      });
    };
    const idleWindow = window as WindowWithIdleCallback;
    if (idleWindow.requestIdleCallback) {
      idleCallbackHandle = idleWindow.requestIdleCallback(loadTone, { timeout: 600 });
    } else {
      timeoutHandle = window.setTimeout(loadTone, 0);
    }
    return () => {
      cancelled = true;
      if (idleCallbackHandle !== null) {
        idleWindow.cancelIdleCallback?.(idleCallbackHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [coverSource]);

  return (
    <div
      data-slot="memory-studio-segment-item"
      className="group relative z-[1] flex min-w-[var(--memory-studio-segment-card-min-size)] flex-none snap-start flex-col text-left outline-none data-[selected=true]:z-[2]"
      data-selection-placement={selectionPlacement}
      data-selected={selected ? 'true' : undefined}
      style={itemStyle}
    >
      <span
        data-slot="memory-studio-segment-card-stage"
        className="relative block aspect-square min-h-[var(--memory-studio-segment-card-min-size)] w-full min-w-[var(--memory-studio-segment-card-min-size)]"
      >
        <span
          data-slot="memory-studio-segment-card-cluster"
          className="absolute bottom-0 left-1/2 block aspect-square w-full min-h-[var(--memory-studio-segment-card-min-size)] min-w-[var(--memory-studio-segment-card-min-size)] transition-transform duration-200 motion-reduce:transition-none [contain-intrinsic-size:var(--memory-studio-segment-card-size)_var(--memory-studio-segment-card-size)] [content-visibility:auto] [transform-origin:center_bottom] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]"
          style={{
            transform:
              'translateX(calc(-50% + var(--memory-studio-segment-selection-x))) translateY(var(--memory-studio-segment-card-y)) scale(var(--memory-studio-segment-card-scale))',
          }}
        >
          <button
            type="button"
            aria-current={selected ? 'true' : undefined}
            aria-label={`选择片段 ${segment.title}`}
            className="group/segment-card block size-full text-left outline-none"
            onClick={onSelect}
          >
            <ReoCardSurface
              asChild
              data-slot="memory-studio-segment-card"
              shape="segmentPreview"
              className={[
                'relative isolate flex size-full aspect-square min-h-[var(--memory-studio-segment-card-min-size)] min-w-[var(--memory-studio-segment-card-min-size)] flex-col justify-between bg-transparent p-12 text-left text-[rgb(var(--cover-title-r)_var(--cover-title-g)_var(--cover-title-b)/0.96)] transition-[filter] duration-150 ease-out motion-reduce:transition-none [--bottom-scrim-mid:0.055] [--bottom-scrim-start:0.12] [--cover-brightness:0.98] [--cover-contrast:1.01] [--cover-saturation:1.04] [--cover-scale:1.02] [--top-scrim-mid:0.055] [--top-scrim-start:0.11] [--top-state-mid:0] [--top-state-start:0] group-focus-visible/segment-card:ring-2 group-focus-visible/segment-card:ring-ring group-focus-visible/segment-card:ring-offset-2 group-focus-visible/segment-card:ring-offset-background group-hover/segment-card:[--bottom-scrim-start:0.15] group-hover/segment-card:[--cover-brightness:1.04] group-hover/segment-card:[--cover-scale:1.035] group-hover/segment-card:[--top-scrim-start:0.14] group-hover/segment-card:[--top-state-mid:0.025] group-hover/segment-card:[--top-state-start:0.06]',
                'dark:[--bottom-scrim-mid:0.08] dark:[--bottom-scrim-start:0.16] dark:[--cover-brightness:0.92] dark:[--cover-saturation:1.02] dark:[--top-scrim-mid:0.08] dark:[--top-scrim-start:0.15] dark:group-hover/segment-card:[--bottom-scrim-start:0.18] dark:group-hover/segment-card:[--cover-brightness:0.98] dark:group-hover/segment-card:[--top-scrim-start:0.17]',
                selected
                  ? '[--cover-brightness:1] [--cover-contrast:1.04] [--cover-saturation:1.12]'
                  : '',
                menuOpen ? '[--cover-brightness:0.97]' : '',
              ].join(' ')}
            >
              <span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-px z-0 block overflow-hidden [backface-visibility:hidden] [transform:translateZ(0)]"
                >
                  <img
                    alt=""
                    className="size-full object-cover [backface-visibility:hidden] [transform-origin:center]"
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
                  ) : segmentIsArtifact ? (
                    <>
                      <AppWindow
                        aria-hidden="true"
                        className="size-[28px] text-[rgb(var(--cover-bottom-r)_var(--cover-bottom-g)_var(--cover-bottom-b)/0.92)]"
                        data-slot="memory-studio-segment-card-artifact-icon"
                        strokeWidth={1.8}
                      />
                      <span
                        data-slot="memory-studio-segment-card-artifact-size"
                        className="shrink-0 font-mono text-[13px] font-[700] leading-none tracking-[0.05em] text-[rgb(var(--cover-bottom-r)_var(--cover-bottom-g)_var(--cover-bottom-b)/0.82)]"
                      >
                        {byteLengthLabel(segment.entryByteLength)}
                      </span>
                    </>
                  ) : (
                    <>
                      <FileText
                        aria-hidden="true"
                        className="size-[28px] text-[rgb(var(--cover-bottom-r)_var(--cover-bottom-g)_var(--cover-bottom-b)/0.92)]"
                        data-slot="memory-studio-segment-card-note-icon"
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
          </button>
          {actionMenu}
        </span>
      </span>
      <span
        aria-hidden="true"
        data-slot="memory-studio-segment-timeline-anchor"
        className="relative mt-10 flex h-48 w-full flex-col items-center before:absolute before:left-[-12px] before:right-[-12px] before:top-[3px] before:h-px before:bg-secondary"
      >
        <span
          data-slot="memory-studio-segment-timeline-marker"
          className="relative z-[1] flex flex-col items-center"
        >
          <span
            data-slot="memory-studio-segment-timeline-dot"
            className={[
              'block size-[7px] min-h-[7px] min-w-[7px] rounded-full transition-transform duration-200 motion-reduce:transition-none [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]',
              selected ? 'bg-foreground' : 'bg-muted-foreground',
            ].join(' ')}
            style={{
              transform: 'translateX(var(--memory-studio-segment-selection-x))',
            }}
          />
          <span
            data-slot="memory-studio-segment-timeline-time"
            className="mt-12 block font-mono text-ui-xs leading-ui-xs tracking-wide text-muted-foreground"
          >
            {createdTimeLabel(segment.createdAt)}
          </span>
        </span>
      </span>
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

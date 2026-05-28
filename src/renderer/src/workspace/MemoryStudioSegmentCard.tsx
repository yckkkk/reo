import { format } from 'date-fns';
import { Ellipsis, FileText } from 'lucide-react';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ReoCardSurface } from '@/components/ui/card-surface';
import { Waveform } from '@/components/ui/waveform';
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
const SEGMENT_PREVIEW_WAVEFORM_DATA = SEGMENT_PREVIEW_SPECTRUM_DATA.map((level) => level / 100);

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
  readonly onSelect: () => void;
  readonly segment: MemorySegment;
  readonly selected: boolean;
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

function SegmentPreviewSpectrum({ active }: { readonly active: boolean }) {
  return (
    <Waveform
      barGap={2}
      barRadius={4}
      barWidth={4}
      className="w-[52px] shrink-0"
      data={SEGMENT_PREVIEW_WAVEFORM_DATA}
      data-slot="memory-studio-segment-card-waveform"
      decorative
      height={32}
      mode="bars"
      tone={active ? 'neutral' : 'muted'}
    />
  );
}

export function MemoryStudioSegmentCard({
  actionMenu,
  onSelect,
  segment,
  selected,
}: MemoryStudioSegmentCardProps) {
  const segmentIsAudio = isAudioMemorySegment(segment);

  return (
    <div
      data-slot="memory-studio-segment-item"
      className="group relative flex min-w-[var(--memory-studio-segment-card-min-size)] flex-[0_0_var(--memory-studio-segment-card-size)] snap-start flex-col text-left outline-none"
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
              'box-border flex aspect-square min-h-[var(--memory-studio-segment-card-min-size)] w-full min-w-[var(--memory-studio-segment-card-min-size)] flex-col justify-between p-12 transition-colors duration-150 group-focus-visible/segment-card:ring-2 group-focus-visible/segment-card:ring-ring group-focus-visible/segment-card:ring-offset-2 group-focus-visible/segment-card:ring-offset-background',
              selected ? 'bg-secondary' : 'bg-card group-hover:bg-secondary',
            ].join(' ')}
          >
            <span>
              <span className="block min-w-0 pr-24">
                <span className="block max-w-[88px] whitespace-normal text-body font-bold leading-body text-foreground">
                  {segment.title}
                </span>
              </span>
              <span className="flex min-w-0 items-center justify-between gap-6">
                {segmentIsAudio ? (
                  <>
                    <SegmentPreviewSpectrum active={selected} />
                    <span
                      data-slot="memory-studio-segment-card-duration"
                      className="shrink-0 font-mono text-ui-sm font-bold leading-none tracking-wide text-foreground"
                    >
                      {compactDurationLabel(segment.durationMs)}
                    </span>
                  </>
                ) : (
                  <>
                    <FileText
                      aria-hidden="true"
                      className="size-28 text-muted-foreground"
                      strokeWidth={1.8}
                    />
                    <span
                      data-slot="memory-studio-segment-card-note-size"
                      className="shrink-0 font-mono text-ui-sm font-bold leading-none tracking-wide text-foreground"
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
              selected ? 'bg-primary' : 'bg-muted-foreground',
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
        'absolute right-8 top-8 z-[1] inline-flex size-28 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition duration-150 ease-out hover:bg-secondary hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:bg-secondary data-[state=open]:text-foreground data-[state=open]:opacity-100',
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

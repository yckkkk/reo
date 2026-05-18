import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Ellipsis, FileText, Mic, Pause, Play, Plus } from 'lucide-react';
import {
  useEffect,
  memo,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Waveform } from '@/components/ui/waveform';
import {
  canDecodeAudioBytesToWaveformData,
  closeAudioWaveformDecoder,
  decodeAudioBytesToWaveformData,
  MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT,
} from './audioWaveform';
import { CarouselArrowButton } from './CarouselArrowButton';
import { SegmentActionsMenu } from './SegmentActionsMenu';
import {
  SegmentSupplementActionsMenu,
  type SegmentSupplementActionIdentity,
} from './SegmentSupplementActionsMenu';
import { SegmentTranscriptView, type SegmentTranscriptOutcome } from './SegmentTranscriptView';
import type {
  SegmentSupplementDeleteTarget,
  SegmentSupplementRenameTarget,
  SegmentDeleteTarget,
  SegmentRenameTarget,
} from './segmentActionTargets';
import type {
  WorkspaceMemoryDetail,
  WorkspaceFinalizedAudioSegmentContent,
  WorkspaceMemorySummary,
  WorkspaceSession,
} from './workspaceApi';
import {
  memoryDetailQueryOptions,
  segmentSupplementContentQueryOptions,
  segmentContentQueryOptions,
} from './workspaceQueries';
import { WorkspaceDangerConfirmDialog } from './WorkspaceDangerConfirmDialog';

type MemoryStudioProps = {
  readonly memory: WorkspaceMemorySummary;
  readonly onDeleteSegment: (target: SegmentDeleteTarget) => void;
  readonly onDeleteSegmentSupplement: (target: SegmentSupplementDeleteTarget) => void;
  readonly onRenameSegmentSupplement: (target: SegmentSupplementRenameTarget) => void;
  readonly onRenameSegment: (target: SegmentRenameTarget) => void;
  readonly transcriptionBackfill?: TranscriptionBackfillController;
  readonly onSegmentFocusConsumed?: (segmentId: string) => void;
  readonly onStartSegmentSupplementRecording: (target: SegmentSupplementRecordingTarget) => void;
  readonly segmentFocusIntent?: string | null;
  readonly workspaceSession: WorkspaceSession;
};

export type SegmentTranscriptionRetryTarget = {
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
};

export type SegmentSupplementTranscriptionRetryTarget = {
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
};

export type TranscriptionBackfillMode = 'fill-missing' | 'regenerate';

export type TranscriptionBackfillController = {
  readonly disabledReason?: string | null;
  readonly isSegmentRunning?: (target: SegmentTranscriptionRetryTarget) => boolean;
  readonly isSupplementRunning?: (target: SegmentSupplementTranscriptionRetryTarget) => boolean;
  readonly retrySegment?: (
    target: SegmentTranscriptionRetryTarget & { readonly mode: TranscriptionBackfillMode }
  ) => Promise<void> | void;
  readonly retrySupplement?: (
    target: SegmentSupplementTranscriptionRetryTarget & {
      readonly mode: TranscriptionBackfillMode;
    }
  ) => Promise<void> | void;
};

export type SegmentSupplementRecordingTarget = {
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
};

const CAROUSEL_SCROLL_RATIO = 0.8;
const SCROLL_EDGE_EPSILON_PX = 24;

type SegmentStripScrollState = {
  readonly canScrollLeft: boolean;
  readonly canScrollRight: boolean;
};

const hiddenSegmentStripScrollState: SegmentStripScrollState = {
  canScrollLeft: false,
  canScrollRight: false,
};
const SEGMENT_PREVIEW_SPECTRUM_DATA = [10, 46, 64, 82, 36, 76, 92, 52, 14];
const SEGMENT_PREVIEW_WAVEFORM_DATA = SEGMENT_PREVIEW_SPECTRUM_DATA.map((level) => level / 100);

type MemorySegment = WorkspaceMemoryDetail['segments'][number];
type MemorySegmentSupplement = MemorySegment['supplements'][number];
type LastTranscriptionAttempt = MemorySegment['lastTranscriptionAttempt'];
type TranscriptProjection = { readonly exists: boolean; readonly text: string } | null | undefined;
type PlaybackWaveformSource = 'decoded-audio' | 'pending' | 'unavailable';
type SegmentAudioResource = {
  audioUrl: string;
  decodePromise: Promise<void>;
  decodeStarted: boolean;
  memoryId: string;
  requestId: string;
  segmentId: string;
  waveformData: readonly number[];
  waveformSource: PlaybackWaveformSource;
  workspaceHandle: string;
  workspaceId: string;
};
type SegmentSupplementAudioResource = {
  supplementId: string;
  audioUrl: string;
  decodePromise: Promise<void>;
  decodeStarted: boolean;
  memoryId: string;
  requestId: string;
  segmentId: string;
  waveformData: readonly number[];
  waveformSource: PlaybackWaveformSource;
  workspaceHandle: string;
  workspaceId: string;
};

type TranscriptionConfirmIntent =
  | {
      readonly kind: 'segment';
      readonly memoryId: string;
      readonly segmentId: string;
      readonly title: string;
    }
  | {
      readonly kind: 'supplement';
      readonly memoryId: string;
      readonly segmentId: string;
      readonly supplementId: string;
      readonly title: string;
    };

function deriveTranscriptOutcome({
  lastTranscriptionAttempt,
  transcript,
}: {
  readonly lastTranscriptionAttempt: LastTranscriptionAttempt;
  readonly transcript: TranscriptProjection;
}): SegmentTranscriptOutcome {
  if (transcript?.exists) {
    return { kind: 'success', text: transcript.text };
  }
  if (lastTranscriptionAttempt === 'failed') {
    return { kind: 'failed-retryable' };
  }
  if (lastTranscriptionAttempt === 'success') {
    return { kind: 'empty-cleared' };
  }
  return { kind: 'empty-never' };
}

function runningTranscriptOutcome(outcome: SegmentTranscriptOutcome): SegmentTranscriptOutcome {
  return outcome.kind === 'success'
    ? { kind: 'running-overwrite', text: outcome.text }
    : { kind: 'running' };
}

function transcriptionBackfillDisabledReason({
  baseReason,
  running,
}: {
  readonly baseReason?: string | null | undefined;
  readonly running: boolean;
}) {
  if (running) {
    return '正在生成中';
  }
  return baseReason ?? null;
}
type ActiveContentTab = 'transcript' | `supplement:${string}`;
type DraggedContentTab = {
  readonly segmentId: string;
  readonly value: ActiveContentTab;
};
type MemoryStudioContentTab =
  | {
      readonly kind: 'transcript';
      readonly panelId: string;
      readonly tabId: string;
      readonly title: string;
      readonly value: 'transcript';
    }
  | {
      readonly supplement: MemorySegmentSupplement;
      readonly kind: 'supplement';
      readonly panelId: string;
      readonly tabId: string;
      readonly title: string;
      readonly value: `supplement:${string}`;
    };

const CONTENT_TAB_MOTION_CLASS =
  'duration-[400ms] ease-[cubic-bezier(0.2,0.9,0.1,1)] motion-reduce:transition-none';
const CONTENT_TAB_PILL_MAX_WIDTH_CLASS = 'max-w-[130px]';
const CONTENT_TAB_PILL_WITH_ACTIONS_MAX_WIDTH_CLASS = 'max-w-[170px]';
const CONTENT_TAB_DRAG_MIME = 'application/x-reo-content-tab';

function durationLabel(durationMs: number) {
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

function supplementContentTabValue(supplementId: string): `supplement:${string}` {
  return `supplement:${supplementId}`;
}

function supplementIdFromContentTab(activeContentTab: ActiveContentTab) {
  return activeContentTab.startsWith('supplement:')
    ? activeContentTab.slice('supplement:'.length)
    : null;
}

function domIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function contentTabDomIds(segmentDomId: string, value: ActiveContentTab) {
  const valueDomId =
    value === 'transcript' ? 'transcript' : domIdPart(supplementIdFromContentTab(value) ?? value);
  const baseId = `memory-studio-${segmentDomId}-${valueDomId}`;

  return {
    panelId: `${baseId}-panel`,
    tabId: `${baseId}-tab`,
  };
}

function orderContentTabs(
  tabs: readonly MemoryStudioContentTab[],
  order: readonly ActiveContentTab[] | undefined
) {
  if (!order || order.length === 0) {
    return tabs;
  }

  const remainingTabs = new Map(tabs.map((tab) => [tab.value, tab]));
  const orderedTabs: MemoryStudioContentTab[] = [];

  for (const value of order) {
    const tab = remainingTabs.get(value);
    if (!tab) {
      continue;
    }
    orderedTabs.push(tab);
    remainingTabs.delete(value);
  }

  return [...orderedTabs, ...remainingTabs.values()];
}

function insertContentTabValue(
  values: readonly ActiveContentTab[],
  draggedValue: ActiveContentTab,
  targetValue: ActiveContentTab,
  placement: 'before' | 'after'
) {
  if (draggedValue === targetValue) {
    return values;
  }

  if (!values.includes(draggedValue) || !values.includes(targetValue)) {
    return values;
  }

  const remainingValues = values.filter((value) => value !== draggedValue);
  const targetIndex = remainingValues.indexOf(targetValue);
  if (targetIndex === -1) {
    return values;
  }

  const insertionIndex = placement === 'before' ? targetIndex : targetIndex + 1;
  const nextValues = [...remainingValues];
  nextValues.splice(insertionIndex, 0, draggedValue);
  return nextValues;
}

function segmentSupplementAudioResourceKey(
  input: Pick<
    SegmentSupplementAudioResource,
    'supplementId' | 'memoryId' | 'requestId' | 'segmentId' | 'workspaceHandle' | 'workspaceId'
  > & {
    readonly audioByteLength: number;
  }
) {
  return [
    input.workspaceHandle,
    input.workspaceId,
    input.memoryId,
    input.segmentId,
    input.supplementId,
    input.requestId,
    input.audioByteLength,
  ].join('\0');
}

function segmentAudioResourceKey(
  input: Pick<
    SegmentAudioResource,
    'memoryId' | 'requestId' | 'segmentId' | 'workspaceHandle' | 'workspaceId'
  > & {
    readonly audioByteLength: number;
  }
) {
  return [
    input.workspaceHandle,
    input.workspaceId,
    input.memoryId,
    input.segmentId,
    input.requestId,
    input.audioByteLength,
  ].join('\0');
}

function clearSegmentAudioResources(audioResourceCache: Map<string, SegmentAudioResource>) {
  for (const resource of audioResourceCache.values()) {
    URL.revokeObjectURL(resource.audioUrl);
  }
  audioResourceCache.clear();
}

function revokeSegmentAudioResource(
  audioResourceCache: Map<string, SegmentAudioResource>,
  resourceKey: string
) {
  const resource = audioResourceCache.get(resourceKey);
  if (!resource) {
    return;
  }

  URL.revokeObjectURL(resource.audioUrl);
  audioResourceCache.delete(resourceKey);
}

function pruneSegmentAudioResources(
  audioResourceCache: Map<string, SegmentAudioResource>,
  shouldKeep: (resource: SegmentAudioResource, resourceKey: string) => boolean
) {
  for (const [resourceKey, resource] of audioResourceCache) {
    if (!shouldKeep(resource, resourceKey)) {
      revokeSegmentAudioResource(audioResourceCache, resourceKey);
    }
  }
}

function clearSegmentSupplementAudioResources(
  audioResourceCache: Map<string, SegmentSupplementAudioResource>
) {
  for (const resource of audioResourceCache.values()) {
    URL.revokeObjectURL(resource.audioUrl);
  }
  audioResourceCache.clear();
}

function revokeSegmentSupplementAudioResource(
  audioResourceCache: Map<string, SegmentSupplementAudioResource>,
  resourceKey: string
) {
  const resource = audioResourceCache.get(resourceKey);
  if (!resource) {
    return;
  }

  URL.revokeObjectURL(resource.audioUrl);
  audioResourceCache.delete(resourceKey);
}

function pruneSegmentSupplementAudioResources(
  audioResourceCache: Map<string, SegmentSupplementAudioResource>,
  shouldKeep: (resource: SegmentSupplementAudioResource, resourceKey: string) => boolean
) {
  for (const [resourceKey, resource] of audioResourceCache) {
    if (!shouldKeep(resource, resourceKey)) {
      revokeSegmentSupplementAudioResource(audioResourceCache, resourceKey);
    }
  }
}

type MemoryStudioAudioPlaybackRowProps = {
  readonly audioAvailable: boolean;
  readonly durationMs: number;
  readonly loading: boolean;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly onPointerCancel: () => void;
  readonly onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: () => void;
  readonly onTogglePlayback: () => Promise<void> | void;
  readonly playButtonLabel: string;
  readonly playbackTimeMs: number;
  readonly playbackProgress: number;
  readonly playing: boolean;
  readonly rowSlot: string;
  readonly waveformData: readonly number[];
  readonly waveformLabel: string;
  readonly waveformSlot: string;
  readonly waveformSource: PlaybackWaveformSource;
};

function MemoryStudioAudioPlaybackRow({
  audioAvailable,
  durationMs,
  loading,
  onKeyDown,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onTogglePlayback,
  playButtonLabel,
  playbackTimeMs,
  playbackProgress,
  playing,
  rowSlot,
  waveformData,
  waveformLabel,
  waveformSlot,
  waveformSource,
}: MemoryStudioAudioPlaybackRowProps) {
  const disabled = !audioAvailable || loading;

  return (
    <div
      data-component="memory-studio-audio-player"
      data-slot={rowSlot}
      className="grid w-full min-w-0 shrink-0 grid-cols-[40px_minmax(64px,1fr)_max-content] items-center gap-12"
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={playButtonLabel}
        className="grid size-40 shrink-0 place-items-center rounded-md border-0 bg-card text-primary transition-colors duration-150 ease-out hover:bg-secondary hover:text-foreground disabled:bg-muted disabled:text-muted-foreground"
        onClick={() => {
          void onTogglePlayback();
        }}
      >
        {playing ? (
          <Pause aria-hidden="true" className="size-16" />
        ) : (
          <Play aria-hidden="true" className="size-16 fill-current" />
        )}
      </button>
      <Waveform
        active={playing}
        aria-disabled={!audioAvailable}
        aria-label={waveformLabel}
        aria-orientation="horizontal"
        aria-valuemax={durationMs}
        aria-valuemin={0}
        aria-valuenow={Math.round(playbackTimeMs)}
        aria-valuetext={`${durationLabel(playbackTimeMs)} / ${durationLabel(durationMs)}`}
        barRadius={4}
        barWidth={4}
        className="min-w-0 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        data={waveformData}
        data-slot={waveformSlot}
        data-waveform-source={waveformSource}
        height={42}
        label={waveformLabel}
        onKeyDown={onKeyDown}
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        progress={playbackProgress}
        role="slider"
        tabIndex={audioAvailable ? 0 : -1}
        tone="voice"
      />
      <span
        data-slot="memory-studio-audio-player-time"
        className="shrink-0 whitespace-nowrap font-mono text-ui-md font-regular leading-ui-md tracking-wide text-foreground"
      >
        {loading ? '载入中' : `${durationLabel(playbackTimeMs)} / ${durationLabel(durationMs)}`}
      </span>
    </div>
  );
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

function contentTabPillClassName(active: boolean, hasActions = false) {
  return [
    'relative inline-flex h-[34px] min-w-0 items-center overflow-hidden rounded-full select-none transition-colors',
    hasActions ? CONTENT_TAB_PILL_WITH_ACTIONS_MAX_WIDTH_CLASS : CONTENT_TAB_PILL_MAX_WIDTH_CLASS,
    CONTENT_TAB_MOTION_CLASS,
    active
      ? 'bg-secondary text-foreground'
      : 'bg-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
  ].join(' ');
}

function contentTabButtonClassName(hasActions = false) {
  return [
    'inline-flex h-full min-w-0 items-center justify-center gap-[6px] text-[13.5px] font-medium leading-none transition-colors',
    CONTENT_TAB_PILL_MAX_WIDTH_CLASS,
    CONTENT_TAB_MOTION_CLASS,
    hasActions ? 'pl-[14px] pr-0' : 'px-[14px]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  ].join(' ');
}

function contentTabMoreClassName(revealMode: 'drag-source' | 'drag-suppressed' | 'normal') {
  const revealClassName =
    revealMode === 'drag-source'
      ? 'pointer-events-auto ml-[6px] max-w-20 scale-100 opacity-100'
      : revealMode === 'drag-suppressed'
        ? ''
        : 'group-hover/supplement-tab:pointer-events-auto group-hover/supplement-tab:ml-[6px] group-hover/supplement-tab:max-w-20 group-hover/supplement-tab:scale-100 group-hover/supplement-tab:opacity-100 focus-visible:pointer-events-auto focus-visible:ml-[6px] focus-visible:max-w-20 focus-visible:scale-100 focus-visible:opacity-100';

  return [
    'inline-flex items-center justify-center overflow-hidden',
    'transition-[max-width,margin-left,opacity,transform]',
    CONTENT_TAB_MOTION_CLASS,
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'pointer-events-none ml-0 max-w-0 scale-75 opacity-0',
    'data-[state=open]:pointer-events-auto data-[state=open]:ml-[6px] data-[state=open]:max-w-20 data-[state=open]:scale-100 data-[state=open]:opacity-100',
    revealClassName,
  ].join(' ');
}

function SegmentSupplementTypeIcon({ type }: { readonly type: MemorySegmentSupplement['type'] }) {
  if (type === 'audio') {
    return <Mic aria-hidden="true" className="size-16 shrink-0" strokeWidth={2} />;
  }

  return null;
}

function SegmentSupplementTab({
  active,
  supplement,
  supplementIndex,
  actionsVisible,
  panelId,
  tabIndex,
  tabId,
  actionIdentity,
  onActionsHidden,
  onActionsVisible,
  onDragEnd,
  onDragEnter,
  onDragOver,
  onDragStart,
  onKeyDown,
  onMenuOpenChange,
  onRequestTranscriptionBackfill,
  onDelete,
  onRename,
  onSelect,
  dragging,
  revealMode,
  menuOpen,
  transcriptExists,
  transcriptionBackfillDisabledReason,
}: {
  readonly active: boolean;
  readonly actionIdentity: Omit<SegmentSupplementActionIdentity, 'supplementId'>;
  readonly actionsVisible: boolean;
  readonly supplement: MemorySegmentSupplement;
  readonly supplementIndex: number;
  readonly dragging: boolean;
  readonly menuOpen: boolean;
  readonly panelId: string;
  readonly revealMode: 'drag-source' | 'drag-suppressed' | 'normal';
  readonly tabIndex: number;
  readonly tabId: string;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  readonly onActionsHidden: () => void;
  readonly onActionsVisible: () => void;
  readonly onDragEnd: (event: DragEvent<HTMLDivElement>) => void;
  readonly onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  readonly onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  readonly onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  readonly onDelete: () => void;
  readonly onMenuOpenChange: (open: boolean) => void;
  readonly onRequestTranscriptionBackfill?: (() => void) | undefined;
  readonly onRename: () => void;
  readonly onSelect: () => void;
  readonly transcriptExists?: boolean | undefined;
  readonly transcriptionBackfillDisabledReason?: string | null | undefined;
}) {
  const tabButtonRef = useRef<HTMLButtonElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionsAccessible = actionsVisible || menuOpen;

  useEffect(() => {
    if (actionsVisible || menuOpen || document.activeElement !== moreButtonRef.current) {
      return;
    }

    tabButtonRef.current?.focus();
  }, [actionsVisible, menuOpen]);

  return (
    <div
      data-slot="memory-studio-supplement-tab-item"
      data-supplement-id={supplement.supplementId}
      data-supplement-index={supplementIndex}
      data-supplement-type={supplement.type}
      draggable
      className={[
        contentTabPillClassName(active, true),
        'group/supplement-tab cursor-grab pr-[14px] active:cursor-grabbing',
        dragging ? 'scale-[1.02] opacity-30 shadow-xl ring-1 ring-border' : '',
      ].join(' ')}
      onDragEnd={onDragEnd}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onPointerEnter={onActionsVisible}
      onPointerLeave={onActionsHidden}
      onMouseEnter={onActionsVisible}
      onMouseLeave={onActionsHidden}
    >
      <button
        ref={tabButtonRef}
        type="button"
        role="tab"
        id={tabId}
        aria-controls={panelId}
        aria-selected={active}
        data-supplement-id={supplement.supplementId}
        data-supplement-type={supplement.type}
        data-slot="memory-studio-supplement-tab"
        tabIndex={tabIndex}
        className={contentTabButtonClassName(true)}
        onClick={onSelect}
        onKeyDown={onKeyDown}
      >
        <span
          data-slot="memory-studio-supplement-reorder-anchor"
          className="inline-flex min-w-0 items-center gap-[6px]"
        >
          <SegmentSupplementTypeIcon type={supplement.type} />
          <span className="truncate">{supplement.title}</span>
        </span>
      </button>
      <SegmentSupplementActionsMenu
        actionIdentity={{ ...actionIdentity, supplementId: supplement.supplementId }}
        contentAlign="center"
        onCloseAutoFocus={(event) => {
          if (!actionsVisible) {
            event.preventDefault();
            tabButtonRef.current?.focus();
          }
        }}
        onDelete={() => {
          onMenuOpenChange(false);
          onDelete();
        }}
        onOpenChange={onMenuOpenChange}
        onRequestTranscriptionBackfill={onRequestTranscriptionBackfill}
        onRename={() => {
          onMenuOpenChange(false);
          onRename();
        }}
        open={menuOpen}
        supplementTitle={supplement.title}
        transcriptExists={transcriptExists}
        transcriptionBackfillDisabledReason={transcriptionBackfillDisabledReason}
        trigger={
          <button
            ref={moreButtonRef}
            type="button"
            aria-label={`${supplement.title} 更多操作`}
            aria-hidden={actionsAccessible ? undefined : true}
            data-slot="memory-studio-supplement-more-anchor"
            tabIndex={actionsAccessible ? 0 : -1}
            className={contentTabMoreClassName(revealMode)}
          >
            <span className="inline-flex size-20 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-150 ease-out hover:bg-secondary hover:text-foreground">
              <Ellipsis className="size-16" strokeWidth={2.5} />
            </span>
          </button>
        }
        triggerLabel={`${supplement.title} 更多操作`}
      />
    </div>
  );
}

const SegmentAudioPlayer = memo(function SegmentAudioPlayer({
  audioResourceCache,
  content,
  loading,
  segment,
  workspaceSession,
}: {
  readonly audioResourceCache: Map<string, SegmentAudioResource>;
  readonly content: WorkspaceFinalizedAudioSegmentContent | undefined;
  readonly loading: boolean;
  readonly segment: MemorySegment;
  readonly workspaceSession: WorkspaceSession;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioResourceKeyRef = useRef<string | null>(null);
  const waveformDecodeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const waveformDecodeGenerationRef = useRef(0);
  const pointerScrubbingRef = useRef(false);
  const playingRef = useRef(false);
  const playbackTimeMsRef = useRef(0);
  const lastPlaybackTimePublishAtRef = useRef(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playbackTimeMs, setPlaybackTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [waveformData, setWaveformData] = useState<readonly number[]>([]);
  const [waveformSource, setWaveformSource] = useState<PlaybackWaveformSource>('pending');
  const segmentAudio = content?.audio ?? null;
  const segmentAudioByteLength = content?.audioByteLength ?? null;
  const segmentRequestId = content?.requestId ?? null;
  const playbackProgress =
    segment.durationMs > 0 ? Math.min(1, playbackTimeMs / segment.durationMs) : 0;

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    playbackTimeMsRef.current = playbackTimeMs;
  }, [playbackTimeMs]);

  function publishPlaybackTime(nextPlaybackTimeMs: number, force = false) {
    const now = performance.now();
    if (
      !force &&
      Math.abs(nextPlaybackTimeMs - playbackTimeMsRef.current) < 100 &&
      now - lastPlaybackTimePublishAtRef.current < 100
    ) {
      return;
    }
    playbackTimeMsRef.current = nextPlaybackTimeMs;
    lastPlaybackTimePublishAtRef.current = now;
    setPlaybackTimeMs(nextPlaybackTimeMs);
  }

  useEffect(() => {
    const audio = audioRef.current;

    return () => {
      pointerScrubbingRef.current = false;
      if (playingRef.current) {
        playingRef.current = false;
        audio?.pause();
      }
    };
  }, [segment.segmentId]);

  useEffect(() => {
    let cancelled = false;

    if (segmentAudio === null || segmentAudioByteLength === null || segmentRequestId === null) {
      currentAudioResourceKeyRef.current = null;
      setAudioUrl(null);
      setPlaybackTimeMs(0);
      setWaveformData([]);
      setWaveformSource('pending');
      return () => {
        cancelled = true;
      };
    }

    const audioResourceKey = segmentAudioResourceKey({
      audioByteLength: segmentAudioByteLength,
      memoryId: segment.memoryId,
      requestId: segmentRequestId,
      segmentId: segment.segmentId,
      workspaceHandle: workspaceSession.workspaceHandle,
      workspaceId: workspaceSession.workspaceId,
    });
    const resourceChanged = currentAudioResourceKeyRef.current !== audioResourceKey;
    currentAudioResourceKeyRef.current = audioResourceKey;
    const cachedResource = audioResourceCache.get(audioResourceKey);

    if (cachedResource) {
      setAudioUrl(cachedResource.audioUrl);
      if (resourceChanged) {
        setPlaybackTimeMs(0);
      }
      setWaveformData(cachedResource.waveformData);
      setWaveformSource(cachedResource.waveformSource);

      if (cachedResource.waveformSource === 'pending') {
        void cachedResource.decodePromise.finally(() => {
          if (cancelled) {
            return;
          }

          setWaveformData(cachedResource.waveformData);
          setWaveformSource(cachedResource.waveformSource);
        });
      }

      return () => {
        cancelled = true;
      };
    }

    const nextAudioUrl = URL.createObjectURL(
      new Blob([segmentAudio as BlobPart], { type: 'audio/webm' })
    );
    const nextResource: SegmentAudioResource = {
      audioUrl: nextAudioUrl,
      decodePromise: Promise.resolve(),
      decodeStarted: false,
      memoryId: segment.memoryId,
      requestId: segmentRequestId,
      segmentId: segment.segmentId,
      waveformData: [],
      waveformSource: 'pending',
      workspaceHandle: workspaceSession.workspaceHandle,
      workspaceId: workspaceSession.workspaceId,
    };
    pruneSegmentAudioResources(
      audioResourceCache,
      (resource, resourceKey) =>
        resourceKey === audioResourceKey ||
        resource.workspaceHandle !== workspaceSession.workspaceHandle ||
        resource.workspaceId !== workspaceSession.workspaceId ||
        resource.memoryId !== segment.memoryId ||
        resource.segmentId !== segment.segmentId
    );
    audioResourceCache.set(audioResourceKey, nextResource);

    setAudioUrl(nextAudioUrl);
    setPlaybackTimeMs(0);
    setWaveformData(nextResource.waveformData);
    setWaveformSource(nextResource.waveformSource);

    if (!canDecodeAudioBytesToWaveformData(segmentAudioByteLength)) {
      nextResource.waveformData = [];
      nextResource.waveformSource = 'unavailable';
      setWaveformData(nextResource.waveformData);
      setWaveformSource(nextResource.waveformSource);
      return () => {
        cancelled = true;
      };
    }

    const decodeGeneration = (waveformDecodeGenerationRef.current += 1);
    const decodeTimeoutId = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      const decodeTask = waveformDecodeQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (cancelled || waveformDecodeGenerationRef.current !== decodeGeneration) {
            return;
          }
          nextResource.decodeStarted = true;
          return decodeAudioBytesToWaveformData(
            segmentAudio,
            MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT
          );
        });
      waveformDecodeQueueRef.current = decodeTask.then(
        () => undefined,
        () => undefined
      );
      nextResource.decodePromise = decodeTask
        .then((nextWaveformData) => {
          if (!nextWaveformData) {
            return;
          }
          if (
            currentAudioResourceKeyRef.current !== audioResourceKey ||
            audioResourceCache.get(audioResourceKey) !== nextResource
          ) {
            return;
          }
          nextResource.waveformData = nextWaveformData;
          nextResource.waveformSource = 'decoded-audio';

          if (cancelled) {
            return;
          }

          setWaveformData(nextResource.waveformData);
          setWaveformSource(nextResource.waveformSource);
        })
        .catch(() => {
          if (
            currentAudioResourceKeyRef.current !== audioResourceKey ||
            audioResourceCache.get(audioResourceKey) !== nextResource
          ) {
            return;
          }
          nextResource.waveformData = [];
          nextResource.waveformSource = 'unavailable';

          if (cancelled) {
            return;
          }

          setWaveformData(nextResource.waveformData);
          setWaveformSource(nextResource.waveformSource);
        });
    }, 0);

    return () => {
      cancelled = true;
      waveformDecodeGenerationRef.current += 1;
      window.clearTimeout(decodeTimeoutId);
    };
  }, [
    audioResourceCache,
    segment.memoryId,
    segment.segmentId,
    segmentAudio,
    segmentAudioByteLength,
    segmentRequestId,
    workspaceSession.workspaceHandle,
    workspaceSession.workspaceId,
  ]);

  function setPlaybackPosition(nextPlaybackTimeMs: number) {
    if (!audioUrl) {
      return;
    }

    const nextTimeMs = Math.min(segment.durationMs, Math.max(0, Math.round(nextPlaybackTimeMs)));
    if (audioRef.current) {
      audioRef.current.currentTime = nextTimeMs / 1000;
    }
    publishPlaybackTime(nextTimeMs, true);
  }

  function seekFromPointer(event: PointerEvent<HTMLDivElement>) {
    if (!audioUrl) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const progress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setPlaybackPosition(progress * segment.durationMs);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!audioUrl) {
      return;
    }

    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    pointerScrubbingRef.current = true;
    seekFromPointer(event);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointerScrubbingRef.current) {
      return;
    }
    seekFromPointer(event);
  }

  function endPointerScrub() {
    pointerScrubbingRef.current = false;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!audioUrl) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPlaybackPosition(playbackTimeMs - 5_000);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPlaybackPosition(playbackTimeMs + 5_000);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setPlaybackPosition(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      setPlaybackPosition(segment.durationMs);
    }
  }

  async function togglePlayback() {
    const audio = audioRef.current;

    if (!audio || !audioUrl) {
      return;
    }

    if (playing) {
      audio.pause();
      playingRef.current = false;
      setPlaying(false);
      return;
    }

    try {
      setPlaybackError(null);
      await audio.play();
      playingRef.current = true;
      setPlaying(true);
    } catch {
      playingRef.current = false;
      setPlaying(false);
      setPlaybackError('片段无法播放，请稍后重试。');
    }
  }

  return (
    <>
      <MemoryStudioAudioPlaybackRow
        audioAvailable={audioUrl !== null}
        durationMs={segment.durationMs}
        loading={loading}
        onKeyDown={handleKeyDown}
        onPointerCancel={endPointerScrub}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerScrub}
        onTogglePlayback={togglePlayback}
        playButtonLabel={`${playing ? '暂停' : '播放'}片段 ${segment.title}`}
        playbackTimeMs={playbackTimeMs}
        playbackProgress={playbackProgress}
        playing={playing}
        rowSlot="memory-studio-player"
        waveformData={waveformData}
        waveformLabel="片段播放进度"
        waveformSlot="memory-studio-playback-waveform"
        waveformSource={waveformSource}
      />
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        onEnded={() => {
          playingRef.current = false;
          setPlaying(false);
          publishPlaybackTime(segment.durationMs, true);
        }}
        onPause={() => {
          playingRef.current = false;
          setPlaying(false);
        }}
        onTimeUpdate={(event) => {
          publishPlaybackTime(
            Math.min(segment.durationMs, Math.round(event.currentTarget.currentTime * 1000))
          );
        }}
      />
      {playbackError ? (
        <p role="status" className="mt-8 shrink-0 text-ui-sm leading-ui-sm text-muted-foreground">
          {playbackError}
        </p>
      ) : null}
    </>
  );
});

function SegmentSupplementAudioPlayer({
  supplement,
  audioResourceCache,
  transcriptionBackfill,
  workspaceSession,
}: {
  readonly supplement: MemorySegmentSupplement;
  readonly audioResourceCache: Map<string, SegmentSupplementAudioResource>;
  readonly transcriptionBackfill?: TranscriptionBackfillController;
  readonly workspaceSession: WorkspaceSession;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioResourceKeyRef = useRef<string | null>(null);
  const waveformDecodeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const waveformDecodeGenerationRef = useRef(0);
  const pointerScrubbingRef = useRef(false);
  const playingRef = useRef(false);
  const playbackTimeMsRef = useRef(0);
  const lastPlaybackTimePublishAtRef = useRef(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playbackTimeMs, setPlaybackTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [waveformData, setWaveformData] = useState<readonly number[]>([]);
  const [waveformSource, setWaveformSource] = useState<PlaybackWaveformSource>('pending');
  const supplementContentQuery = useQuery(
    segmentSupplementContentQueryOptions(
      workspaceSession,
      supplement.memoryId,
      supplement.segmentId,
      supplement.supplementId
    )
  );
  const supplementContent = supplementContentQuery.data;
  const supplementId = supplement.supplementId;
  const supplementMemoryId = supplement.memoryId;
  const supplementSegmentId = supplement.segmentId;
  const supplementAudio = supplementContent?.audio ?? null;
  const supplementAudioByteLength = supplementContent?.audioByteLength ?? null;
  const retrySupplementTranscription = transcriptionBackfill?.retrySupplement
    ? () =>
        transcriptionBackfill.retrySupplement?.({
          workspaceId: workspaceSession.workspaceId,
          memoryId: supplement.memoryId,
          segmentId: supplement.segmentId,
          supplementId: supplement.supplementId,
          mode: 'fill-missing',
        })
    : undefined;
  const supplementTranscriptionRunning =
    transcriptionBackfill?.isSupplementRunning?.({
      workspaceId: workspaceSession.workspaceId,
      memoryId: supplement.memoryId,
      segmentId: supplement.segmentId,
      supplementId: supplement.supplementId,
    }) === true;
  const supplementRequestId = supplementContent?.requestId ?? null;
  const workspaceHandle = workspaceSession.workspaceHandle;
  const workspaceId = workspaceSession.workspaceId;
  const playbackProgress =
    supplement.durationMs > 0 ? Math.min(1, playbackTimeMs / supplement.durationMs) : 0;

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    playbackTimeMsRef.current = playbackTimeMs;
  }, [playbackTimeMs]);

  function publishPlaybackTime(nextPlaybackTimeMs: number, force = false) {
    const now = performance.now();
    if (
      !force &&
      Math.abs(nextPlaybackTimeMs - playbackTimeMsRef.current) < 100 &&
      now - lastPlaybackTimePublishAtRef.current < 100
    ) {
      return;
    }
    playbackTimeMsRef.current = nextPlaybackTimeMs;
    lastPlaybackTimePublishAtRef.current = now;
    setPlaybackTimeMs(nextPlaybackTimeMs);
  }

  useEffect(() => {
    const audio = audioRef.current;

    return () => {
      pointerScrubbingRef.current = false;
      if (playingRef.current) {
        playingRef.current = false;
        audio?.pause();
      }
    };
  }, [supplementId]);

  useEffect(() => {
    let cancelled = false;

    if (
      supplementAudio === null ||
      supplementAudioByteLength === null ||
      supplementRequestId === null
    ) {
      currentAudioResourceKeyRef.current = null;
      setAudioUrl(null);
      setPlaybackTimeMs(0);
      setWaveformData([]);
      setWaveformSource('pending');
      return () => {
        cancelled = true;
      };
    }

    const audioResourceKey = segmentSupplementAudioResourceKey({
      supplementId,
      audioByteLength: supplementAudioByteLength,
      memoryId: supplementMemoryId,
      requestId: supplementRequestId,
      segmentId: supplementSegmentId,
      workspaceHandle,
      workspaceId,
    });
    const resourceChanged = currentAudioResourceKeyRef.current !== audioResourceKey;
    currentAudioResourceKeyRef.current = audioResourceKey;
    const cachedResource = audioResourceCache.get(audioResourceKey);

    if (cachedResource) {
      setAudioUrl(cachedResource.audioUrl);
      if (resourceChanged) {
        setPlaybackTimeMs(0);
      }
      setWaveformData(cachedResource.waveformData);
      setWaveformSource(cachedResource.waveformSource);

      if (cachedResource.waveformSource === 'pending') {
        void cachedResource.decodePromise.finally(() => {
          if (cancelled) {
            return;
          }

          setWaveformData(cachedResource.waveformData);
          setWaveformSource(cachedResource.waveformSource);
        });
      }

      return () => {
        cancelled = true;
      };
    }

    const nextAudioUrl = URL.createObjectURL(
      new Blob([supplementAudio as BlobPart], { type: 'audio/webm' })
    );
    const nextResource: SegmentSupplementAudioResource = {
      supplementId,
      audioUrl: nextAudioUrl,
      decodePromise: Promise.resolve(),
      decodeStarted: false,
      memoryId: supplementMemoryId,
      requestId: supplementRequestId,
      segmentId: supplementSegmentId,
      waveformData: [],
      waveformSource: 'pending',
      workspaceHandle,
      workspaceId,
    };
    pruneSegmentSupplementAudioResources(
      audioResourceCache,
      (resource, resourceKey) =>
        resourceKey === audioResourceKey ||
        resource.workspaceHandle !== workspaceHandle ||
        resource.workspaceId !== workspaceId ||
        resource.memoryId !== supplementMemoryId ||
        resource.segmentId !== supplementSegmentId ||
        resource.supplementId !== supplementId
    );
    audioResourceCache.set(audioResourceKey, nextResource);

    setAudioUrl(nextAudioUrl);
    setPlaybackTimeMs(0);
    setWaveformData(nextResource.waveformData);
    setWaveformSource(nextResource.waveformSource);

    if (!canDecodeAudioBytesToWaveformData(supplementAudioByteLength)) {
      nextResource.waveformData = [];
      nextResource.waveformSource = 'unavailable';
      setWaveformData(nextResource.waveformData);
      setWaveformSource(nextResource.waveformSource);
      return () => {
        cancelled = true;
      };
    }

    const decodeGeneration = (waveformDecodeGenerationRef.current += 1);
    const decodeTimeoutId = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      const decodeTask = waveformDecodeQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (cancelled || waveformDecodeGenerationRef.current !== decodeGeneration) {
            return;
          }
          nextResource.decodeStarted = true;
          return decodeAudioBytesToWaveformData(
            supplementAudio,
            MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT
          );
        });
      waveformDecodeQueueRef.current = decodeTask.then(
        () => undefined,
        () => undefined
      );
      nextResource.decodePromise = decodeTask
        .then((nextWaveformData) => {
          if (!nextWaveformData) {
            return;
          }
          if (
            currentAudioResourceKeyRef.current !== audioResourceKey ||
            audioResourceCache.get(audioResourceKey) !== nextResource
          ) {
            return;
          }
          nextResource.waveformData = nextWaveformData;
          nextResource.waveformSource = 'decoded-audio';

          if (cancelled) {
            return;
          }

          setWaveformData(nextResource.waveformData);
          setWaveformSource(nextResource.waveformSource);
        })
        .catch(() => {
          if (
            currentAudioResourceKeyRef.current !== audioResourceKey ||
            audioResourceCache.get(audioResourceKey) !== nextResource
          ) {
            return;
          }
          nextResource.waveformData = [];
          nextResource.waveformSource = 'unavailable';

          if (cancelled) {
            return;
          }

          setWaveformData(nextResource.waveformData);
          setWaveformSource(nextResource.waveformSource);
        });
    }, 0);

    return () => {
      cancelled = true;
      waveformDecodeGenerationRef.current += 1;
      window.clearTimeout(decodeTimeoutId);
    };
  }, [
    supplementAudio,
    supplementAudioByteLength,
    supplementId,
    supplementMemoryId,
    supplementRequestId,
    supplementSegmentId,
    audioResourceCache,
    workspaceHandle,
    workspaceId,
  ]);

  function setPlaybackPosition(nextPlaybackTimeMs: number) {
    if (!audioUrl) {
      return;
    }

    const nextTimeMs = Math.min(supplement.durationMs, Math.max(0, Math.round(nextPlaybackTimeMs)));
    if (audioRef.current) {
      audioRef.current.currentTime = nextTimeMs / 1000;
    }
    publishPlaybackTime(nextTimeMs, true);
  }

  function seekFromPointer(event: PointerEvent<HTMLDivElement>) {
    if (!audioUrl) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const progress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setPlaybackPosition(progress * supplement.durationMs);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!audioUrl) {
      return;
    }

    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    pointerScrubbingRef.current = true;
    seekFromPointer(event);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointerScrubbingRef.current) {
      return;
    }
    seekFromPointer(event);
  }

  function endPointerScrub() {
    pointerScrubbingRef.current = false;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!audioUrl) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPlaybackPosition(playbackTimeMs - 5_000);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPlaybackPosition(playbackTimeMs + 5_000);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setPlaybackPosition(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      setPlaybackPosition(supplement.durationMs);
    }
  }

  async function togglePlayback() {
    const audio = audioRef.current;

    if (!audio || !audioUrl) {
      return;
    }

    if (playing) {
      audio.pause();
      playingRef.current = false;
      setPlaying(false);
      return;
    }

    try {
      setPlaybackError(null);
      await audio.play();
      playingRef.current = true;
      setPlaying(true);
    } catch {
      playingRef.current = false;
      setPlaying(false);
      setPlaybackError('补充录音无法播放，请稍后重试。');
    }
  }

  return (
    <article aria-label={supplement.title} className="py-12">
      <MemoryStudioAudioPlaybackRow
        audioAvailable={audioUrl !== null}
        durationMs={supplement.durationMs}
        loading={supplementContentQuery.isLoading}
        onKeyDown={handleKeyDown}
        onPointerCancel={endPointerScrub}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerScrub}
        onTogglePlayback={togglePlayback}
        playButtonLabel={`${playing ? '暂停' : '播放'}补充录音 ${supplement.title}`}
        playbackTimeMs={playbackTimeMs}
        playbackProgress={playbackProgress}
        playing={playing}
        rowSlot="memory-studio-supplement-player"
        waveformData={waveformData}
        waveformLabel="补充录音播放进度"
        waveformSlot="memory-studio-supplement-waveform"
        waveformSource={waveformSource}
      />
      {supplementContentQuery.isError ? (
        <p role="status" className="mt-8 text-ui-xs leading-ui-xs text-muted-foreground">
          补充录音加载失败。
        </p>
      ) : null}
      {playbackError ? (
        <p role="status" className="mt-8 text-ui-xs leading-ui-xs text-muted-foreground">
          {playbackError}
        </p>
      ) : null}
      <div data-slot="memory-studio-supplement-transcript" className="mt-12">
        <SegmentTranscriptView
          status={
            supplementContentQuery.isLoading
              ? 'loading'
              : supplementContentQuery.isError
                ? 'error'
                : 'ready'
          }
          outcome={
            supplementTranscriptionRunning
              ? runningTranscriptOutcome(
                  deriveTranscriptOutcome({
                    lastTranscriptionAttempt: supplement.lastTranscriptionAttempt,
                    transcript: supplementContent?.transcript,
                  })
                )
              : deriveTranscriptOutcome({
                  lastTranscriptionAttempt: supplement.lastTranscriptionAttempt,
                  transcript: supplementContent?.transcript,
                })
          }
          {...(retrySupplementTranscription ? { onRetry: retrySupplementTranscription } : {})}
          copy={{
            loading: '正在载入补充录音内容。',
            error: '补充录音转录加载失败，请重试。',
            empty: '这段补充录音还没有转录。',
            failedRetryable: '上次生成补充录音转录失败。',
            running: '正在生成补充录音转录。',
            retry: '重试',
          }}
        />
      </div>
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        onEnded={() => {
          playingRef.current = false;
          setPlaying(false);
          publishPlaybackTime(supplement.durationMs, true);
        }}
        onPause={() => {
          playingRef.current = false;
          setPlaying(false);
        }}
        onTimeUpdate={(event) => {
          publishPlaybackTime(
            Math.min(supplement.durationMs, Math.round(event.currentTarget.currentTime * 1000))
          );
        }}
      />
    </article>
  );
}

function readSegmentStripScrollState(element: HTMLElement): SegmentStripScrollState {
  const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);

  return {
    canScrollLeft: element.scrollLeft > SCROLL_EDGE_EPSILON_PX,
    canScrollRight: element.scrollLeft < maxScrollLeft - SCROLL_EDGE_EPSILON_PX,
  };
}

const SEGMENT_STRIP_CARD_ESTIMATE_PX = 160;
const SEGMENT_STRIP_WINDOW_OVERSCAN = 4;
const SEGMENT_STRIP_MIN_WINDOW_SIZE = 12;

type SegmentStripWindowRange = {
  readonly end: number;
  readonly start: number;
};

function clampSegmentStripWindowRange(
  range: SegmentStripWindowRange,
  segmentCount: number
): SegmentStripWindowRange {
  if (segmentCount <= SEGMENT_STRIP_MIN_WINDOW_SIZE) {
    return { start: 0, end: segmentCount };
  }
  const windowSize = Math.min(
    segmentCount,
    Math.max(SEGMENT_STRIP_MIN_WINDOW_SIZE, range.end - range.start)
  );
  const start = Math.min(Math.max(0, range.start), Math.max(0, segmentCount - windowSize));
  return { start, end: Math.min(segmentCount, start + windowSize) };
}

function segmentStripWindowAroundIndex(
  index: number,
  segmentCount: number
): SegmentStripWindowRange {
  const safeIndex = Math.min(Math.max(0, index), Math.max(0, segmentCount - 1));
  const start = safeIndex - Math.floor(SEGMENT_STRIP_MIN_WINDOW_SIZE / 2);
  return clampSegmentStripWindowRange(
    { start, end: start + SEGMENT_STRIP_MIN_WINDOW_SIZE },
    segmentCount
  );
}

function segmentStripWindowFromElement(
  element: HTMLElement,
  segmentCount: number,
  itemStep: number
): SegmentStripWindowRange {
  if (segmentCount <= SEGMENT_STRIP_MIN_WINDOW_SIZE) {
    return { start: 0, end: segmentCount };
  }
  const safeItemStep = itemStep > 0 ? itemStep : SEGMENT_STRIP_CARD_ESTIMATE_PX;
  const visibleCount = Math.max(
    SEGMENT_STRIP_MIN_WINDOW_SIZE,
    Math.ceil(element.clientWidth / safeItemStep) + SEGMENT_STRIP_WINDOW_OVERSCAN * 2
  );
  const start = Math.floor(element.scrollLeft / safeItemStep) - SEGMENT_STRIP_WINDOW_OVERSCAN;
  return clampSegmentStripWindowRange({ start, end: start + visibleCount }, segmentCount);
}

function readSegmentStripItemStep(element: HTMLElement): number {
  const firstItem = element.querySelector<HTMLElement>('[data-slot="memory-studio-segment-item"]');
  const computedStyle = window.getComputedStyle(element);
  const columnGap = Number.parseFloat(computedStyle.columnGap || computedStyle.gap || '0');
  const itemWidth = firstItem?.getBoundingClientRect().width;
  return itemWidth && itemWidth > 0
    ? itemWidth + (Number.isFinite(columnGap) ? columnGap : 0)
    : SEGMENT_STRIP_CARD_ESTIMATE_PX;
}

function segmentStripSpacerStyle(count: number): CSSProperties {
  return {
    flexBasis:
      count <= 1
        ? 'var(--memory-studio-segment-card-size)'
        : `calc(${count} * (var(--memory-studio-segment-card-size) + var(--memory-studio-segment-gap)) - var(--memory-studio-segment-gap))`,
  };
}

export function MemoryStudio({
  memory,
  onDeleteSegment,
  onDeleteSegmentSupplement,
  onRenameSegmentSupplement,
  onRenameSegment,
  transcriptionBackfill,
  onSegmentFocusConsumed,
  onStartSegmentSupplementRecording,
  segmentFocusIntent = null,
  workspaceSession,
}: MemoryStudioProps) {
  const segmentAudioResourceCacheRef = useRef(new Map<string, SegmentAudioResource>());
  const supplementAudioResourceCacheRef = useRef(new Map<string, SegmentSupplementAudioResource>());
  const [supplementMenuOpen, setSupplementMenuOpen] = useState(false);
  const [openSupplementActionMenuId, setOpenSupplementActionMenuId] = useState<string | null>(null);
  const [hoveredSupplementActionId, setHoveredSupplementActionId] = useState<string | null>(null);
  const [openSegmentMenuId, setOpenSegmentMenuId] = useState<string | null>(null);
  const stripScrollRef = useRef<HTMLDivElement | null>(null);
  const segmentStripItemStepRef = useRef(SEGMENT_STRIP_CARD_ESTIMATE_PX);
  const [activeContentTab, setActiveContentTab] = useState<ActiveContentTab>('transcript');
  const [confirmingTranscriptionBackfill, setConfirmingTranscriptionBackfill] =
    useState<TranscriptionConfirmIntent | null>(null);
  const [contentTabOrderBySegmentId, setContentTabOrderBySegmentId] = useState<
    Record<string, readonly ActiveContentTab[]>
  >({});
  const draggedContentTabRef = useRef<DraggedContentTab | null>(null);
  const lastContentTabDragPlacementRef = useRef<string | null>(null);
  const [draggedContentTab, setDraggedContentTab] = useState<DraggedContentTab | null>(null);
  const segmentSupplementPresenceRef = useRef<{
    readonly segmentId: string | null;
    readonly supplementIds: readonly string[];
  }>({ segmentId: null, supplementIds: [] });
  const [stripScrollState, setStripScrollState] = useState<SegmentStripScrollState>(
    hiddenSegmentStripScrollState
  );
  const [segmentStripWindowRange, setSegmentStripWindowRange] = useState<SegmentStripWindowRange>({
    start: 0,
    end: SEGMENT_STRIP_MIN_WINDOW_SIZE,
  });
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const detailQuery = useQuery(memoryDetailQueryOptions(workspaceSession, memory.memoryId));
  const detail = detailQuery.data?.detail;
  const segments = detail?.segments ?? [];
  const selectedSegmentResolution = useMemo(() => {
    let firstSegment: MemorySegment | null = null;
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (!segment) {
        continue;
      }
      firstSegment ??= segment;
      if (segment.segmentId === selectedSegmentId) {
        return { index, segment };
      }
    }
    return { index: firstSegment ? 0 : -1, segment: firstSegment };
  }, [segments, selectedSegmentId]);
  const selectedSegment = selectedSegmentResolution.segment;
  const selectedSegmentIndex = selectedSegmentResolution.index;
  const retrySelectedSegmentTranscription =
    selectedSegment && transcriptionBackfill?.retrySegment
      ? () =>
          transcriptionBackfill.retrySegment?.({
            workspaceId: workspaceSession.workspaceId,
            memoryId: memory.memoryId,
            segmentId: selectedSegment.segmentId,
            mode: 'fill-missing',
          })
      : undefined;
  const selectedSegmentTranscriptionRunning =
    selectedSegment &&
    transcriptionBackfill?.isSegmentRunning?.({
      workspaceId: workspaceSession.workspaceId,
      memoryId: memory.memoryId,
      segmentId: selectedSegment.segmentId,
    }) === true;
  const segmentContentQuery = useQuery({
    ...segmentContentQueryOptions(
      workspaceSession,
      memory.memoryId,
      selectedSegment?.segmentId ?? 'seg_pending'
    ),
    enabled: selectedSegment !== null,
  });
  const segmentContent = selectedSegment ? segmentContentQuery.data : undefined;
  const selectedSegmentSupplements = selectedSegment?.supplements ?? [];
  const selectedSegmentSupplementIds = useMemo(
    () => selectedSegmentSupplements.map((supplement) => supplement.supplementId),
    [selectedSegmentSupplements]
  );
  const selectedSegmentSupplementIdSet = useMemo(
    () => new Set(selectedSegmentSupplementIds),
    [selectedSegmentSupplementIds]
  );
  const selectedSegmentSupplementById = useMemo(
    () =>
      new Map(
        selectedSegmentSupplements.map((supplement) => [supplement.supplementId, supplement])
      ),
    [selectedSegmentSupplements]
  );
  const selectedSegmentSupplementIdsKey = selectedSegmentSupplementIds.join('\0');
  const activeSupplementId = supplementIdFromContentTab(activeContentTab);
  const draggedSupplementId =
    draggedContentTab &&
    selectedSegment &&
    draggedContentTab.segmentId === selectedSegment.segmentId
      ? supplementIdFromContentTab(draggedContentTab.value)
      : null;
  const activeSegmentSupplement =
    activeSupplementId === null
      ? null
      : (selectedSegmentSupplementById.get(activeSupplementId) ?? null);
  const resolvedActiveContentTab =
    activeSupplementId === null || activeSegmentSupplement ? activeContentTab : 'transcript';
  const {
    activeContentTabModel,
    baseContentTabs,
    contentTabs,
    transcriptContentTab,
    visibleSupplementIndexByTabValue,
  } = useMemo(() => {
    const selectedSegmentDomId = selectedSegment ? domIdPart(selectedSegment.segmentId) : 'pending';
    const transcriptTab: Extract<MemoryStudioContentTab, { readonly kind: 'transcript' }> = {
      kind: 'transcript',
      title: '转录',
      value: 'transcript',
      ...contentTabDomIds(selectedSegmentDomId, 'transcript'),
    };
    const supplementTabs: readonly Extract<
      MemoryStudioContentTab,
      { readonly kind: 'supplement' }
    >[] = selectedSegmentSupplements.map((supplement) => {
      const value = supplementContentTabValue(supplement.supplementId);

      return {
        supplement,
        kind: 'supplement',
        title: supplement.title,
        value,
        ...contentTabDomIds(selectedSegmentDomId, value),
      };
    });
    const unorderedTabs: readonly MemoryStudioContentTab[] = [transcriptTab, ...supplementTabs];
    const orderedTabs: readonly MemoryStudioContentTab[] = selectedSegment
      ? orderContentTabs(unorderedTabs, contentTabOrderBySegmentId[selectedSegment.segmentId])
      : unorderedTabs;
    const supplementIndexByTabValue = new Map<ActiveContentTab, number>();
    let visibleSupplementIndex = 0;
    for (const contentTab of orderedTabs) {
      if (contentTab.kind === 'supplement') {
        supplementIndexByTabValue.set(contentTab.value, visibleSupplementIndex);
        visibleSupplementIndex += 1;
      }
    }

    return {
      activeContentTabModel:
        orderedTabs.find((contentTab) => contentTab.value === resolvedActiveContentTab) ??
        transcriptTab,
      baseContentTabs: unorderedTabs,
      contentTabs: orderedTabs,
      transcriptContentTab: transcriptTab,
      visibleSupplementIndexByTabValue: supplementIndexByTabValue,
    };
  }, [
    contentTabOrderBySegmentId,
    resolvedActiveContentTab,
    selectedSegment,
    selectedSegmentSupplements,
  ]);
  useEffect(() => {
    const element = stripScrollRef.current;
    let animationFrameId: number | null = null;

    if (!element) {
      setStripScrollState(hiddenSegmentStripScrollState);
      return undefined;
    }

    const syncScrollState = (refreshItemStep = false) => {
      if (refreshItemStep) {
        segmentStripItemStepRef.current = readSegmentStripItemStep(element);
      }
      const nextScrollState = readSegmentStripScrollState(element);
      const nextWindowRange = segmentStripWindowFromElement(
        element,
        segments.length,
        segmentStripItemStepRef.current
      );
      setStripScrollState((currentScrollState) =>
        currentScrollState.canScrollLeft === nextScrollState.canScrollLeft &&
        currentScrollState.canScrollRight === nextScrollState.canScrollRight
          ? currentScrollState
          : nextScrollState
      );
      setSegmentStripWindowRange((currentRange) =>
        currentRange.start === nextWindowRange.start && currentRange.end === nextWindowRange.end
          ? currentRange
          : nextWindowRange
      );
    };

    const scheduleSyncScrollState = (refreshItemStep = false) => {
      if (animationFrameId !== null) {
        return;
      }
      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        syncScrollState(refreshItemStep);
      });
    };
    const scheduleScrollSync = () => scheduleSyncScrollState(false);
    const scheduleResizeSync = () => scheduleSyncScrollState(true);

    syncScrollState(true);
    element.addEventListener('scroll', scheduleScrollSync, { passive: true });
    window.addEventListener('resize', scheduleResizeSync);

    const resizeObserver =
      typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleResizeSync) : null;
    resizeObserver?.observe(element);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      element.removeEventListener('scroll', scheduleScrollSync);
      window.removeEventListener('resize', scheduleResizeSync);
      resizeObserver?.disconnect();
    };
  }, [segments.length]);

  useEffect(() => {
    if (segments.length === 0) {
      setSegmentStripWindowRange({ start: 0, end: 0 });
      return;
    }
    if (selectedSegmentIndex < 0) {
      setSegmentStripWindowRange((currentRange) =>
        clampSegmentStripWindowRange(currentRange, segments.length)
      );
      return;
    }
    setSegmentStripWindowRange((currentRange) => {
      if (
        selectedSegmentIndex >= currentRange.start &&
        selectedSegmentIndex < currentRange.end &&
        currentRange.end <= segments.length
      ) {
        return currentRange;
      }
      return segmentStripWindowAroundIndex(selectedSegmentIndex, segments.length);
    });
  }, [segments.length, selectedSegmentIndex]);

  useEffect(() => {
    if (!segmentFocusIntent) {
      return;
    }
    if (!segments.some((segment) => segment.segmentId === segmentFocusIntent)) {
      return;
    }

    setSelectedSegmentId(segmentFocusIntent);
    onSegmentFocusConsumed?.(segmentFocusIntent);
  }, [onSegmentFocusConsumed, segmentFocusIntent, segments]);

  useEffect(() => {
    const segmentId = selectedSegment?.segmentId ?? null;
    const previousPresence = segmentSupplementPresenceRef.current;

    if (!segmentId || previousPresence.segmentId !== segmentId) {
      segmentSupplementPresenceRef.current = {
        segmentId,
        supplementIds: selectedSegmentSupplementIds,
      };
      return;
    }

    const previousSupplementIds = new Set(previousPresence.supplementIds);
    const addedSupplementId = selectedSegmentSupplementIds.find(
      (supplementId) => !previousSupplementIds.has(supplementId)
    );
    if (addedSupplementId) {
      setActiveContentTab(supplementContentTabValue(addedSupplementId));
    }

    if (
      previousPresence.supplementIds.length !== selectedSegmentSupplementIds.length ||
      addedSupplementId
    ) {
      segmentSupplementPresenceRef.current = {
        segmentId,
        supplementIds: selectedSegmentSupplementIds,
      };
    }
  }, [selectedSegment?.segmentId, selectedSegmentSupplementIdsKey]);

  useEffect(() => {
    setSupplementMenuOpen(false);
    setOpenSupplementActionMenuId(null);
    setHoveredSupplementActionId(null);
    draggedContentTabRef.current = null;
    setDraggedContentTab(null);
    setActiveContentTab('transcript');
    setConfirmingTranscriptionBackfill(null);
  }, [selectedSegment?.segmentId]);

  useEffect(() => {
    if (activeSupplementId !== null && !selectedSegmentSupplementIdSet.has(activeSupplementId)) {
      setActiveContentTab('transcript');
    }
  }, [activeSupplementId, selectedSegmentSupplementIdSet]);

  useEffect(() => {
    if (
      openSupplementActionMenuId !== null &&
      !selectedSegmentSupplementIdSet.has(openSupplementActionMenuId)
    ) {
      setOpenSupplementActionMenuId(null);
    }

    if (
      hoveredSupplementActionId !== null &&
      !selectedSegmentSupplementIdSet.has(hoveredSupplementActionId)
    ) {
      setHoveredSupplementActionId(null);
    }
  }, [
    hoveredSupplementActionId,
    openSupplementActionMenuId,
    selectedSegmentSupplementIdSet,
    selectedSegmentSupplementIdsKey,
  ]);

  useEffect(() => {
    const audioResourceCache = supplementAudioResourceCacheRef.current;
    const segmentAudioResourceCache = segmentAudioResourceCacheRef.current;

    return () => {
      clearSegmentSupplementAudioResources(audioResourceCache);
      clearSegmentAudioResources(segmentAudioResourceCache);
      void closeAudioWaveformDecoder().catch(() => {});
    };
  }, [memory.memoryId, workspaceSession.workspaceHandle, workspaceSession.workspaceId]);

  useEffect(() => {
    const selectedSegmentId = selectedSegment?.segmentId ?? null;
    const liveSupplementIds = new Set(selectedSegmentSupplementIds);

    pruneSegmentAudioResources(
      segmentAudioResourceCacheRef.current,
      (resource) =>
        resource.workspaceHandle !== workspaceSession.workspaceHandle ||
        resource.workspaceId !== workspaceSession.workspaceId ||
        resource.memoryId !== memory.memoryId ||
        resource.segmentId === selectedSegmentId
    );
    pruneSegmentSupplementAudioResources(
      supplementAudioResourceCacheRef.current,
      (resource) =>
        resource.workspaceHandle !== workspaceSession.workspaceHandle ||
        resource.workspaceId !== workspaceSession.workspaceId ||
        resource.memoryId !== memory.memoryId ||
        resource.segmentId !== selectedSegmentId ||
        liveSupplementIds.has(resource.supplementId)
    );
  }, [
    memory.memoryId,
    selectedSegment?.segmentId,
    selectedSegmentSupplementIdsKey,
    workspaceSession.workspaceHandle,
    workspaceSession.workspaceId,
  ]);

  function confirmTranscriptionRegenerate() {
    if (!confirmingTranscriptionBackfill || !transcriptionBackfill) {
      return;
    }

    const intent = confirmingTranscriptionBackfill;
    setConfirmingTranscriptionBackfill(null);

    if (intent.kind === 'segment') {
      void transcriptionBackfill.retrySegment?.({
        workspaceId: workspaceSession.workspaceId,
        memoryId: intent.memoryId,
        segmentId: intent.segmentId,
        mode: 'regenerate',
      });
      return;
    }

    void transcriptionBackfill.retrySupplement?.({
      workspaceId: workspaceSession.workspaceId,
      memoryId: intent.memoryId,
      segmentId: intent.segmentId,
      supplementId: intent.supplementId,
      mode: 'regenerate',
    });
  }

  function handleContentTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentValue: ActiveContentTab
  ) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }

    const currentIndex = contentTabs.findIndex((contentTab) => contentTab.value === currentValue);
    if (currentIndex === -1) {
      return;
    }

    event.preventDefault();

    let nextIndex: number;
    switch (event.key) {
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = contentTabs.length - 1;
        break;
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % contentTabs.length;
        break;
      default:
        nextIndex = (currentIndex - 1 + contentTabs.length) % contentTabs.length;
        break;
    }
    const nextTab = contentTabs[nextIndex];
    if (!nextTab) {
      return;
    }

    setActiveContentTab(nextTab.value);
    window.requestAnimationFrame(() => document.getElementById(nextTab.tabId)?.focus());
  }

  function readDraggedContentTab(event: DragEvent<HTMLElement>) {
    if (draggedContentTabRef.current) {
      return draggedContentTabRef.current;
    }

    try {
      const encodedValue = event.dataTransfer.getData(CONTENT_TAB_DRAG_MIME);
      if (!encodedValue) {
        return null;
      }

      const parsedValue = JSON.parse(encodedValue) as Partial<DraggedContentTab>;
      if (
        typeof parsedValue.segmentId === 'string' &&
        (parsedValue.value === 'transcript' ||
          (typeof parsedValue.value === 'string' && parsedValue.value.startsWith('supplement:')))
      ) {
        return {
          segmentId: parsedValue.segmentId,
          value: parsedValue.value,
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  function moveContentTab(
    draggedTab: DraggedContentTab,
    targetValue: ActiveContentTab,
    targetRect: DOMRect,
    pointerClientX: number
  ) {
    const draggedValue = draggedTab.value;
    if (!selectedSegment || draggedValue === targetValue) {
      return;
    }

    const segmentId = selectedSegment.segmentId;
    const orderedValues = contentTabs.map((contentTab) => contentTab.value);
    const draggedIndex = orderedValues.indexOf(draggedValue);
    const targetIndex = orderedValues.indexOf(targetValue);
    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
      return;
    }

    const targetMidpoint = targetRect.left + targetRect.width / 2;
    const placement = pointerClientX < targetMidpoint ? 'before' : 'after';
    const placementKey = `${segmentId}\0${draggedValue}\0${targetValue}\0${placement}`;
    if (lastContentTabDragPlacementRef.current === placementKey) {
      return;
    }
    const nextValues = insertContentTabValue(orderedValues, draggedValue, targetValue, placement);

    if (nextValues === orderedValues || nextValues.join('\0') === orderedValues.join('\0')) {
      return;
    }
    lastContentTabDragPlacementRef.current = placementKey;

    setContentTabOrderBySegmentId((currentOrderBySegmentId) => {
      const currentOrderedValues = orderContentTabs(
        baseContentTabs,
        currentOrderBySegmentId[segmentId]
      ).map((contentTab) => contentTab.value);
      const currentDraggedIndex = currentOrderedValues.indexOf(draggedValue);
      const currentTargetIndex = currentOrderedValues.indexOf(targetValue);
      if (
        currentDraggedIndex === -1 ||
        currentTargetIndex === -1 ||
        currentDraggedIndex === currentTargetIndex
      ) {
        return currentOrderBySegmentId;
      }
      const nextCurrentValues = insertContentTabValue(
        currentOrderedValues,
        draggedValue,
        targetValue,
        placement
      );

      if (
        nextCurrentValues === currentOrderedValues ||
        nextCurrentValues.join('\0') === currentOrderedValues.join('\0')
      ) {
        return currentOrderBySegmentId;
      }

      return {
        ...currentOrderBySegmentId,
        [segmentId]: nextCurrentValues,
      };
    });
  }

  function handleContentTabDragStart(event: DragEvent<HTMLElement>, value: ActiveContentTab) {
    if (!selectedSegment) {
      return;
    }

    const draggedTab = { segmentId: selectedSegment.segmentId, value };
    draggedContentTabRef.current = draggedTab;
    lastContentTabDragPlacementRef.current = null;
    setHoveredSupplementActionId(null);
    setDraggedContentTab(draggedTab);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(CONTENT_TAB_DRAG_MIME, JSON.stringify(draggedTab));
  }

  function handleContentTabDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
  }

  function handleContentTabDragOver(event: DragEvent<HTMLElement>, targetValue: ActiveContentTab) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const draggedTab = readDraggedContentTab(event);
    if (!draggedTab || !selectedSegment || draggedTab.segmentId !== selectedSegment.segmentId) {
      return;
    }

    moveContentTab(
      draggedTab,
      targetValue,
      event.currentTarget.getBoundingClientRect(),
      event.clientX
    );
  }

  function handleContentTabDragEnd() {
    draggedContentTabRef.current = null;
    lastContentTabDragPlacementRef.current = null;
    setHoveredSupplementActionId(null);
    setDraggedContentTab(null);
  }

  function scrollSegmentStrip(direction: 'left' | 'right') {
    const element = stripScrollRef.current;

    if (!element) {
      return;
    }

    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const scrollDistance = Math.round(element.clientWidth * CAROUSEL_SCROLL_RATIO);
    const nextScrollLeft =
      direction === 'left'
        ? Math.max(0, element.scrollLeft - scrollDistance)
        : Math.min(maxScrollLeft, element.scrollLeft + scrollDistance);

    if (typeof element.scrollTo === 'function') {
      element.scrollTo({
        behavior: 'instant',
        left: nextScrollLeft,
      });
      return;
    }

    element.scrollLeft = nextScrollLeft;
    setStripScrollState(readSegmentStripScrollState(element));
  }

  return (
    <>
      <section
        aria-label="Memory Studio"
        className="flex h-full min-h-0 w-full flex-col overflow-hidden text-left"
      >
        <div data-slot="memory-studio-layout" className="flex h-full min-h-0 w-full flex-col">
          {detail && segments.length === 0 ? (
            <div className="mt-32 max-w-[420px]">
              <p className="text-body-lg font-medium leading-body-lg text-foreground">
                这条记忆还没有片段
              </p>
              <p className="mt-8 text-body leading-body text-muted-foreground">
                继续在这条记忆里记录。
              </p>
            </div>
          ) : detail && segments.length > 0 && selectedSegment ? (
            <>
              <section
                aria-label="片段预览流"
                className="relative min-w-0 shrink-0 pt-4"
                style={
                  {
                    '--memory-studio-segment-card-min-size': '136px',
                    '--memory-studio-segment-card-size':
                      'clamp(var(--memory-studio-segment-card-min-size), 18vw, 148px)',
                    '--memory-studio-segment-gap': '12px',
                  } as CSSProperties
                }
              >
                {stripScrollState.canScrollLeft ? (
                  <div className="pointer-events-none absolute left-0 top-[calc(8px+(var(--memory-studio-segment-card-size)/2)-20px)] z-10">
                    <div className="pointer-events-auto">
                      <CarouselArrowButton
                        direction="left"
                        ariaLabel="向左浏览片段卡片"
                        onClick={() => scrollSegmentStrip('left')}
                      />
                    </div>
                  </div>
                ) : null}
                <div
                  ref={stripScrollRef}
                  data-slot="memory-studio-segment-strip-scroll"
                  className="edge-fade-x flex snap-x gap-12 overflow-x-auto px-0 py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {segmentStripWindowRange.start > 0 ? (
                    <div
                      aria-hidden="true"
                      data-slot="memory-studio-segment-strip-spacer"
                      className="min-w-0 shrink-0"
                      style={segmentStripSpacerStyle(segmentStripWindowRange.start)}
                    />
                  ) : null}
                  {segments
                    .slice(segmentStripWindowRange.start, segmentStripWindowRange.end)
                    .map((segment) => {
                      const isSelected = segment.segmentId === selectedSegment.segmentId;
                      const segmentTranscriptionRunning =
                        transcriptionBackfill?.isSegmentRunning?.({
                          workspaceId: workspaceSession.workspaceId,
                          memoryId: memory.memoryId,
                          segmentId: segment.segmentId,
                        }) === true;
                      const segmentTranscriptionDisabledReason =
                        transcriptionBackfillDisabledReason({
                          baseReason: transcriptionBackfill?.disabledReason,
                          running: segmentTranscriptionRunning,
                        });
                      const requestSegmentTranscriptionBackfill =
                        transcriptionBackfill?.retrySegment
                          ? () => {
                              setOpenSegmentMenuId(null);
                              if (segment.transcript.exists) {
                                setConfirmingTranscriptionBackfill({
                                  kind: 'segment',
                                  memoryId: memory.memoryId,
                                  segmentId: segment.segmentId,
                                  title: segment.title,
                                });
                                return;
                              }
                              void transcriptionBackfill.retrySegment?.({
                                workspaceId: workspaceSession.workspaceId,
                                memoryId: memory.memoryId,
                                segmentId: segment.segmentId,
                                mode: 'fill-missing',
                              });
                            }
                          : undefined;
                      return (
                        <div
                          key={segment.segmentId}
                          data-slot="memory-studio-segment-item"
                          className={[
                            'group relative flex min-w-[var(--memory-studio-segment-card-min-size)] flex-[0_0_var(--memory-studio-segment-card-size)] snap-start flex-col rounded-xl text-left outline-none [contain-intrinsic-size:184px_184px] [content-visibility:auto]',
                          ].join(' ')}
                        >
                          <button
                            type="button"
                            aria-current={isSelected ? 'true' : undefined}
                            aria-label={`选择片段 ${segment.title}`}
                            className="group/segment-card flex w-full flex-col rounded-xl text-left outline-none"
                            onClick={() => setSelectedSegmentId(segment.segmentId)}
                          >
                            <span className="block min-w-0">
                              <span
                                data-slot="memory-studio-segment-card"
                                className={[
                                  'box-border flex aspect-square min-h-[var(--memory-studio-segment-card-min-size)] w-full min-w-[var(--memory-studio-segment-card-min-size)] flex-col justify-between overflow-hidden rounded-xl p-12 transition-colors duration-150 group-focus-visible/segment-card:ring-2 group-focus-visible/segment-card:ring-ring group-focus-visible/segment-card:ring-offset-2 group-focus-visible/segment-card:ring-offset-background',
                                  isSelected ? 'bg-secondary' : 'bg-card group-hover:bg-secondary',
                                ].join(' ')}
                              >
                                <span className="block min-w-0 pr-24">
                                  <span className="block max-w-[88px] whitespace-normal text-body font-bold leading-body text-foreground">
                                    {segment.title}
                                  </span>
                                </span>
                                <span className="flex min-w-0 items-center justify-between gap-6">
                                  <SegmentPreviewSpectrum active={isSelected} />
                                  <span
                                    data-slot="memory-studio-segment-card-duration"
                                    className="shrink-0 font-mono text-ui-sm font-bold leading-none tracking-wide text-foreground"
                                  >
                                    {durationLabel(segment.durationMs)}
                                  </span>
                                </span>
                              </span>
                            </span>
                            <span
                              aria-hidden="true"
                              data-slot="memory-studio-segment-timeline-anchor"
                              className="relative mt-10 flex h-48 w-full flex-col items-center before:absolute before:left-[-6px] before:right-[-6px] before:top-[3px] before:h-px before:bg-secondary"
                            >
                              <span
                                data-slot="memory-studio-segment-timeline-dot"
                                className={[
                                  'relative z-[1] block size-[7px] min-h-[7px] min-w-[7px] rounded-full',
                                  isSelected ? 'bg-primary' : 'bg-muted-foreground',
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
                          <SegmentActionsMenu
                            actionIdentity={{
                              memoryId: memory.memoryId,
                              segmentId: segment.segmentId,
                              workspaceHandle: workspaceSession.workspaceHandle,
                              workspaceId: workspaceSession.workspaceId,
                            }}
                            contentAlign="end"
                            onDelete={() => {
                              setOpenSegmentMenuId(null);
                              onDeleteSegment({ memoryId: memory.memoryId, segment });
                            }}
                            onOpenChange={(open) =>
                              setOpenSegmentMenuId(open ? segment.segmentId : null)
                            }
                            onRequestTranscriptionBackfill={requestSegmentTranscriptionBackfill}
                            onRename={() => {
                              setOpenSegmentMenuId(null);
                              onRenameSegment({ memoryId: memory.memoryId, segment });
                            }}
                            open={openSegmentMenuId === segment.segmentId}
                            segmentTitle={segment.title}
                            transcriptExists={segment.transcript.exists}
                            transcriptionBackfillDisabledReason={segmentTranscriptionDisabledReason}
                            trigger={
                              <button
                                type="button"
                                aria-label={`片段 ${segment.title} 更多操作`}
                                className={[
                                  'absolute right-8 top-8 z-[1] inline-flex size-28 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition duration-150 ease-out hover:bg-secondary hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:bg-secondary data-[state=open]:text-foreground data-[state=open]:opacity-100',
                                ].join(' ')}
                              >
                                <Ellipsis aria-hidden="true" className="size-16" />
                              </button>
                            }
                            triggerLabel={`片段 ${segment.title} 更多操作`}
                          />
                        </div>
                      );
                    })}
                  {segmentStripWindowRange.end < segments.length ? (
                    <div
                      aria-hidden="true"
                      data-slot="memory-studio-segment-strip-spacer"
                      className="min-w-0 shrink-0"
                      style={segmentStripSpacerStyle(segments.length - segmentStripWindowRange.end)}
                    />
                  ) : null}
                </div>
                {stripScrollState.canScrollRight ? (
                  <div className="pointer-events-none absolute right-0 top-[calc(8px+(var(--memory-studio-segment-card-size)/2)-20px)] z-10">
                    <div className="pointer-events-auto">
                      <CarouselArrowButton
                        direction="right"
                        ariaLabel="向右浏览片段卡片"
                        onClick={() => scrollSegmentStrip('right')}
                      />
                    </div>
                  </div>
                ) : null}
              </section>

              <section
                aria-label="片段内容"
                data-slot="memory-studio-content-panel"
                className="mt-16 flex min-h-0 flex-1 flex-col pt-12"
              >
                <SegmentAudioPlayer
                  audioResourceCache={segmentAudioResourceCacheRef.current}
                  content={segmentContent}
                  loading={segmentContentQuery.isLoading}
                  segment={selectedSegment}
                  workspaceSession={workspaceSession}
                />

                <div
                  data-slot="memory-studio-content-tab-rail-row"
                  className="mt-32 flex shrink-0 items-center justify-between gap-8"
                >
                  <div
                    role="tablist"
                    aria-label="片段内容类型"
                    data-slot="memory-studio-content-tab-rail"
                    className="edge-fade-x flex min-w-0 items-center gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {contentTabs.map((contentTab) =>
                      contentTab.kind === 'transcript' ? (
                        <span
                          key={contentTab.value}
                          data-slot="memory-studio-transcript-tab-item"
                          draggable
                          className={[
                            contentTabPillClassName(resolvedActiveContentTab === 'transcript'),
                            'cursor-grab active:cursor-grabbing',
                            draggedContentTab?.segmentId === selectedSegment.segmentId &&
                            draggedContentTab.value === contentTab.value
                              ? 'scale-[1.02] opacity-30 shadow-xl ring-1 ring-border'
                              : '',
                          ].join(' ')}
                          onDragEnd={handleContentTabDragEnd}
                          onDragEnter={handleContentTabDragEnter}
                          onDragOver={(event) => handleContentTabDragOver(event, contentTab.value)}
                          onDragStart={(event) =>
                            handleContentTabDragStart(event, contentTab.value)
                          }
                        >
                          <button
                            type="button"
                            role="tab"
                            id={contentTab.tabId}
                            aria-controls={contentTab.panelId}
                            aria-selected={resolvedActiveContentTab === 'transcript'}
                            data-slot="memory-studio-transcript-tab"
                            tabIndex={resolvedActiveContentTab === 'transcript' ? 0 : -1}
                            className={contentTabButtonClassName()}
                            onClick={() => setActiveContentTab('transcript')}
                            onKeyDown={(event) => handleContentTabKeyDown(event, 'transcript')}
                          >
                            <FileText
                              aria-hidden="true"
                              className="size-16 shrink-0"
                              strokeWidth={2}
                            />
                            <span>转录</span>
                          </button>
                        </span>
                      ) : (
                        <SegmentSupplementTab
                          key={contentTab.supplement.supplementId}
                          active={resolvedActiveContentTab === contentTab.value}
                          actionIdentity={{
                            memoryId: memory.memoryId,
                            segmentId: selectedSegment.segmentId,
                            workspaceHandle: workspaceSession.workspaceHandle,
                            workspaceId: workspaceSession.workspaceId,
                          }}
                          actionsVisible={
                            (draggedContentTab === null &&
                              hoveredSupplementActionId === contentTab.supplement.supplementId) ||
                            draggedSupplementId === contentTab.supplement.supplementId
                          }
                          supplement={contentTab.supplement}
                          supplementIndex={
                            visibleSupplementIndexByTabValue.get(contentTab.value) ?? 0
                          }
                          dragging={
                            draggedContentTab?.segmentId === selectedSegment.segmentId &&
                            draggedContentTab.value === contentTab.value
                          }
                          menuOpen={
                            openSupplementActionMenuId === contentTab.supplement.supplementId
                          }
                          revealMode={
                            draggedContentTab === null
                              ? 'normal'
                              : draggedSupplementId === contentTab.supplement.supplementId
                                ? 'drag-source'
                                : 'drag-suppressed'
                          }
                          tabId={contentTab.tabId}
                          panelId={contentTab.panelId}
                          tabIndex={resolvedActiveContentTab === contentTab.value ? 0 : -1}
                          onKeyDown={(event) => handleContentTabKeyDown(event, contentTab.value)}
                          onActionsVisible={() =>
                            draggedContentTab === null
                              ? setHoveredSupplementActionId(contentTab.supplement.supplementId)
                              : undefined
                          }
                          onActionsHidden={() =>
                            draggedContentTab === null
                              ? setHoveredSupplementActionId((currentSupplementId) =>
                                  currentSupplementId === contentTab.supplement.supplementId
                                    ? null
                                    : currentSupplementId
                                )
                              : undefined
                          }
                          onDragEnd={handleContentTabDragEnd}
                          onDragEnter={handleContentTabDragEnter}
                          onDragOver={(event) => handleContentTabDragOver(event, contentTab.value)}
                          onDragStart={(event) =>
                            handleContentTabDragStart(event, contentTab.value)
                          }
                          onMenuOpenChange={(open) =>
                            setOpenSupplementActionMenuId(
                              open ? contentTab.supplement.supplementId : null
                            )
                          }
                          onRequestTranscriptionBackfill={
                            transcriptionBackfill?.retrySupplement
                              ? () => {
                                  setOpenSupplementActionMenuId(null);
                                  if (contentTab.supplement.transcript.exists) {
                                    setConfirmingTranscriptionBackfill({
                                      kind: 'supplement',
                                      memoryId: memory.memoryId,
                                      segmentId: selectedSegment.segmentId,
                                      supplementId: contentTab.supplement.supplementId,
                                      title: contentTab.supplement.title,
                                    });
                                    return;
                                  }
                                  void transcriptionBackfill.retrySupplement?.({
                                    workspaceId: workspaceSession.workspaceId,
                                    memoryId: memory.memoryId,
                                    segmentId: selectedSegment.segmentId,
                                    supplementId: contentTab.supplement.supplementId,
                                    mode: 'fill-missing',
                                  });
                                }
                              : undefined
                          }
                          onDelete={() =>
                            onDeleteSegmentSupplement({
                              memoryId: memory.memoryId,
                              segment: selectedSegment,
                              supplement: contentTab.supplement,
                            })
                          }
                          onRename={() =>
                            onRenameSegmentSupplement({
                              memoryId: memory.memoryId,
                              segment: selectedSegment,
                              supplement: contentTab.supplement,
                            })
                          }
                          onSelect={() => setActiveContentTab(contentTab.value)}
                          transcriptExists={contentTab.supplement.transcript.exists}
                          transcriptionBackfillDisabledReason={transcriptionBackfillDisabledReason({
                            baseReason: transcriptionBackfill?.disabledReason,
                            running:
                              transcriptionBackfill?.isSupplementRunning?.({
                                workspaceId: workspaceSession.workspaceId,
                                memoryId: memory.memoryId,
                                segmentId: selectedSegment.segmentId,
                                supplementId: contentTab.supplement.supplementId,
                              }) === true,
                          })}
                        />
                      )
                    )}
                  </div>
                  <DropdownMenu open={supplementMenuOpen} onOpenChange={setSupplementMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghostIcon"
                        size="icon"
                        type="button"
                        aria-label="添加片段补充内容"
                        className="text-muted-foreground hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground"
                      >
                        <Plus aria-hidden="true" className="size-16" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      aria-label="片段补充内容"
                      aria-labelledby={undefined}
                      align="end"
                    >
                      <DropdownMenuItem
                        onSelect={() => {
                          setSupplementMenuOpen(false);
                          onStartSegmentSupplementRecording({
                            memoryId: memory.memoryId,
                            segmentId: selectedSegment.segmentId,
                            title: `补充录音${selectedSegment.supplementCount + 1}`,
                          });
                        }}
                      >
                        <Mic aria-hidden="true" className="size-16" />
                        录音补充
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {resolvedActiveContentTab === 'transcript' ? (
                  <section
                    key="transcript"
                    aria-label="片段转录"
                    role="tabpanel"
                    id={transcriptContentTab.panelId}
                    aria-labelledby={transcriptContentTab.tabId}
                    data-slot="memory-studio-transcript-scroll"
                    className="reo-content-tab-panel-motion edge-fade-y scrollbar-hover mt-4 min-h-0 flex-1 overflow-y-auto pl-8 pr-8 pb-6"
                  >
                    <SegmentTranscriptView
                      status={
                        segmentContentQuery.isLoading
                          ? 'loading'
                          : segmentContentQuery.isError
                            ? 'error'
                            : 'ready'
                      }
                      outcome={
                        selectedSegmentTranscriptionRunning
                          ? runningTranscriptOutcome(
                              deriveTranscriptOutcome({
                                lastTranscriptionAttempt: selectedSegment.lastTranscriptionAttempt,
                                transcript: segmentContent?.transcript,
                              })
                            )
                          : deriveTranscriptOutcome({
                              lastTranscriptionAttempt: selectedSegment.lastTranscriptionAttempt,
                              transcript: segmentContent?.transcript,
                            })
                      }
                      {...(retrySelectedSegmentTranscription
                        ? { onRetry: retrySelectedSegmentTranscription }
                        : {})}
                      copy={{
                        loading: '正在载入片段内容。',
                        error: '片段内容加载失败，请重试。',
                        empty: '这段录音还没有转录。',
                        failedRetryable: '上次生成转录失败。',
                        running: '正在生成转录。',
                        retry: '重试',
                      }}
                    />
                  </section>
                ) : activeSegmentSupplement ? (
                  <section
                    key={activeSegmentSupplement.supplementId}
                    aria-label={activeSegmentSupplement.title}
                    role="tabpanel"
                    id={activeContentTabModel.panelId}
                    aria-labelledby={activeContentTabModel.tabId}
                    data-slot="memory-studio-supplement-panel"
                    className="reo-content-tab-panel-motion mt-4 min-h-0 flex-1 overflow-y-auto pr-8 pb-6"
                  >
                    <SegmentSupplementAudioPlayer
                      supplement={activeSegmentSupplement}
                      audioResourceCache={supplementAudioResourceCacheRef.current}
                      {...(transcriptionBackfill ? { transcriptionBackfill } : {})}
                      workspaceSession={workspaceSession}
                    />
                  </section>
                ) : null}
              </section>
            </>
          ) : detailQuery.isError ? (
            <p className="mt-32 text-body leading-body text-muted-foreground">
              记忆内容加载失败，请重试。
            </p>
          ) : (
            <p className="mt-32 text-body leading-body text-muted-foreground">正在载入记忆内容。</p>
          )}
        </div>
      </section>
      <WorkspaceDangerConfirmDialog
        open={confirmingTranscriptionBackfill !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingTranscriptionBackfill(null);
          }
        }}
        title="重新生成转录？"
        description={`将覆盖「${confirmingTranscriptionBackfill?.title ?? ''}」当前转录。开始后如果文件内容被外部修改，Reo 会停止覆盖。`}
        confirmLabel="重新生成"
        disabled={false}
        onConfirm={() => {
          confirmTranscriptionRegenerate();
        }}
      />
    </>
  );
}

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Ellipsis, Mic, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Waveform } from '@/components/ui/waveform';
import {
  decodeAudioBytesToWaveformData,
  MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT,
} from './audioWaveform';
import { CarouselArrowButton } from './CarouselArrowButton';
import type { SegmentDeleteTarget, SegmentRenameTarget } from './segmentActionTargets';
import type {
  WorkspaceMemoryDetail,
  WorkspaceMemorySummary,
  WorkspaceSession,
} from './workspaceApi';
import {
  memoryDetailQueryOptions,
  segmentAttachmentContentQueryOptions,
  segmentContentQueryOptions,
} from './workspaceQueries';

type MemoryStudioProps = {
  readonly memory: WorkspaceMemorySummary;
  readonly onDeleteSegment: (target: SegmentDeleteTarget) => void;
  readonly onRenameSegment: (target: SegmentRenameTarget) => void;
  readonly onSegmentFocusConsumed?: (segmentId: string) => void;
  readonly onStartSegmentAttachmentRecording: (target: SegmentAttachmentRecordingTarget) => void;
  readonly segmentFocusIntent?: string | null;
  readonly workspaceSession: WorkspaceSession;
};

export type SegmentAttachmentRecordingTarget = {
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
type MemorySegmentAttachment = MemorySegment['attachments'][number];
type PlaybackWaveformSource = 'decoded-audio' | 'pending' | 'unavailable';
type ActiveContentTab = 'transcript' | 'supplements';

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

function SegmentAttachmentAudioPlayer({
  attachment,
  workspaceSession,
}: {
  readonly attachment: MemorySegmentAttachment;
  readonly workspaceSession: WorkspaceSession;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pointerScrubbingRef = useRef(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackTimeMs, setPlaybackTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [waveformData, setWaveformData] = useState<readonly number[]>([]);
  const [waveformSource, setWaveformSource] = useState<PlaybackWaveformSource>('pending');
  const attachmentContentQuery = useQuery(
    segmentAttachmentContentQueryOptions(
      workspaceSession,
      attachment.memoryId,
      attachment.segmentId,
      attachment.attachmentId
    )
  );
  const attachmentContent = attachmentContentQuery.data;
  const playbackProgress =
    attachment.durationMs > 0 ? Math.min(1, playbackTimeMs / attachment.durationMs) : 0;

  useEffect(() => {
    if (!attachmentContent) {
      setAudioUrl(null);
      setPlaybackTimeMs(0);
      setWaveformData([]);
      setWaveformSource('pending');
      return undefined;
    }

    const nextAudioUrl = URL.createObjectURL(
      new Blob([attachmentContent.audio as BlobPart], { type: 'audio/webm' })
    );
    setAudioUrl(nextAudioUrl);

    return () => {
      URL.revokeObjectURL(nextAudioUrl);
    };
  }, [attachmentContent]);

  useEffect(() => {
    let cancelled = false;

    if (!attachmentContent) {
      setWaveformData([]);
      setWaveformSource('pending');
      return () => {
        cancelled = true;
      };
    }

    setWaveformData([]);
    setWaveformSource('pending');

    void decodeAudioBytesToWaveformData(
      attachmentContent.audio,
      MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT
    )
      .then((nextWaveformData) => {
        if (cancelled) {
          return;
        }

        setWaveformData(nextWaveformData);
        setWaveformSource('decoded-audio');
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setWaveformData([]);
        setWaveformSource('unavailable');
      });

    return () => {
      cancelled = true;
    };
  }, [attachmentContent]);

  function setPlaybackPosition(nextPlaybackTimeMs: number) {
    if (!audioUrl) {
      return;
    }

    const nextTimeMs = Math.min(attachment.durationMs, Math.max(0, Math.round(nextPlaybackTimeMs)));
    if (audioRef.current) {
      audioRef.current.currentTime = nextTimeMs / 1000;
    }
    setPlaybackTimeMs(nextTimeMs);
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
    setPlaybackPosition(progress * attachment.durationMs);
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
      setPlaybackPosition(attachment.durationMs);
    }
  }

  async function togglePlayback() {
    const audio = audioRef.current;

    if (!audio || !audioUrl) {
      return;
    }

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  return (
    <article aria-label={attachment.title} className="py-12">
      <MemoryStudioAudioPlaybackRow
        audioAvailable={audioUrl !== null}
        durationMs={attachment.durationMs}
        loading={attachmentContentQuery.isLoading}
        onKeyDown={handleKeyDown}
        onPointerCancel={endPointerScrub}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerScrub}
        onTogglePlayback={togglePlayback}
        playButtonLabel={`${playing ? '暂停' : '播放'}补充录音 ${attachment.title}`}
        playbackTimeMs={playbackTimeMs}
        playbackProgress={playbackProgress}
        playing={playing}
        rowSlot="memory-studio-attachment-player"
        waveformData={waveformData}
        waveformLabel="补充录音播放进度"
        waveformSlot="memory-studio-attachment-waveform"
        waveformSource={waveformSource}
      />
      {attachmentContentQuery.isError ? (
        <p role="status" className="mt-8 text-ui-xs leading-ui-xs text-muted-foreground">
          补充录音加载失败。
        </p>
      ) : null}
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        onEnded={() => {
          setPlaying(false);
          setPlaybackTimeMs(attachment.durationMs);
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          setPlaybackTimeMs(
            Math.min(attachment.durationMs, Math.round(event.currentTarget.currentTime * 1000))
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

export function MemoryStudio({
  memory,
  onDeleteSegment,
  onRenameSegment,
  onSegmentFocusConsumed,
  onStartSegmentAttachmentRecording,
  segmentFocusIntent = null,
  workspaceSession,
}: MemoryStudioProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pointerScrubbingRef = useRef(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [openSegmentMenuId, setOpenSegmentMenuId] = useState<string | null>(null);
  const stripScrollRef = useRef<HTMLDivElement | null>(null);
  const [audioPlaybackError, setAudioPlaybackError] = useState<string | null>(null);
  const [playbackTimeMs, setPlaybackTimeMs] = useState(0);
  const [playbackWaveformData, setPlaybackWaveformData] = useState<readonly number[]>([]);
  const [playbackWaveformSource, setPlaybackWaveformSource] =
    useState<PlaybackWaveformSource>('pending');
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [segmentAudioUrl, setSegmentAudioUrl] = useState<string | null>(null);
  const [activeContentTab, setActiveContentTab] = useState<ActiveContentTab>('transcript');
  const segmentAttachmentPresenceRef = useRef<{
    readonly segmentId: string | null;
    readonly attachmentCount: number;
  }>({ segmentId: null, attachmentCount: 0 });
  const [stripScrollState, setStripScrollState] = useState<SegmentStripScrollState>(
    hiddenSegmentStripScrollState
  );
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const detailQuery = useQuery(memoryDetailQueryOptions(workspaceSession, memory.memoryId));
  const detail = detailQuery.data?.detail;
  const segments = detail?.segments ?? [];
  const selectedSegment =
    segments.find((segment) => segment.segmentId === selectedSegmentId) ?? segments[0] ?? null;
  const segmentContentQuery = useQuery({
    ...segmentContentQueryOptions(
      workspaceSession,
      memory.memoryId,
      selectedSegment?.segmentId ?? 'seg_pending'
    ),
    enabled: selectedSegment !== null,
  });
  const segmentContent = selectedSegment ? segmentContentQuery.data : undefined;
  const selectedSegmentAttachments = selectedSegment?.attachments ?? [];
  const hasSelectedSegmentAttachments = selectedSegmentAttachments.length > 0;
  const isSelectedSegmentPlaying = playingSegmentId === selectedSegment?.segmentId;
  const selectedSegmentDurationMs = selectedSegment?.durationMs ?? 0;
  const playbackProgress =
    selectedSegmentDurationMs > 0 ? Math.min(1, playbackTimeMs / selectedSegmentDurationMs) : 0;

  useEffect(() => {
    const element = stripScrollRef.current;

    if (!element) {
      setStripScrollState(hiddenSegmentStripScrollState);
      return undefined;
    }

    const syncScrollState = () => {
      const nextScrollState = readSegmentStripScrollState(element);
      setStripScrollState((currentScrollState) =>
        currentScrollState.canScrollLeft === nextScrollState.canScrollLeft &&
        currentScrollState.canScrollRight === nextScrollState.canScrollRight
          ? currentScrollState
          : nextScrollState
      );
    };

    syncScrollState();
    element.addEventListener('scroll', syncScrollState, { passive: true });
    window.addEventListener('resize', syncScrollState);

    const resizeObserver =
      typeof ResizeObserver === 'function' ? new ResizeObserver(syncScrollState) : null;
    resizeObserver?.observe(element);

    return () => {
      element.removeEventListener('scroll', syncScrollState);
      window.removeEventListener('resize', syncScrollState);
      resizeObserver?.disconnect();
    };
  }, [segments.length]);

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
    const attachmentCount = selectedSegmentAttachments.length;
    const previousPresence = segmentAttachmentPresenceRef.current;

    if (!segmentId || previousPresence.segmentId !== segmentId) {
      segmentAttachmentPresenceRef.current = { segmentId, attachmentCount };
      return;
    }

    if (previousPresence.attachmentCount === 0 && attachmentCount > 0) {
      setActiveContentTab('supplements');
    }

    if (previousPresence.attachmentCount !== attachmentCount) {
      segmentAttachmentPresenceRef.current = { segmentId, attachmentCount };
    }
  }, [selectedSegment?.segmentId, selectedSegmentAttachments.length]);

  useEffect(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
    setAudioPlaybackError(null);
    setAttachmentMenuOpen(false);
    setActiveContentTab('transcript');
    setPlaybackTimeMs(0);
    setPlayingSegmentId(null);
  }, [selectedSegment?.segmentId]);

  useEffect(() => {
    if (activeContentTab === 'supplements' && !hasSelectedSegmentAttachments) {
      setActiveContentTab('transcript');
    }
  }, [activeContentTab, hasSelectedSegmentAttachments]);

  useEffect(() => {
    if (!segmentContent) {
      setSegmentAudioUrl(null);
      setPlaybackWaveformData([]);
      setPlaybackWaveformSource('pending');
      setPlaybackTimeMs(0);
      return undefined;
    }

    const nextAudioUrl = URL.createObjectURL(
      new Blob([segmentContent.audio as BlobPart], { type: 'audio/webm' })
    );
    setSegmentAudioUrl(nextAudioUrl);

    return () => {
      URL.revokeObjectURL(nextAudioUrl);
    };
  }, [segmentContent]);

  useEffect(() => {
    let cancelled = false;

    if (!segmentContent) {
      setPlaybackWaveformData([]);
      setPlaybackWaveformSource('pending');
      return () => {
        cancelled = true;
      };
    }

    setPlaybackWaveformData([]);
    setPlaybackWaveformSource('pending');

    void decodeAudioBytesToWaveformData(
      segmentContent.audio,
      MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT
    )
      .then((nextWaveformData) => {
        if (cancelled) {
          return;
        }

        setPlaybackWaveformData(nextWaveformData);
        setPlaybackWaveformSource('decoded-audio');
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setPlaybackWaveformData([]);
        setPlaybackWaveformSource('unavailable');
      });

    return () => {
      cancelled = true;
    };
  }, [segmentContent]);

  function setSelectedSegmentPlaybackPosition(nextPlaybackTimeMs: number) {
    if (!selectedSegment || !segmentAudioUrl) {
      return;
    }

    const nextTimeMs = Math.min(
      selectedSegment.durationMs,
      Math.max(0, Math.round(nextPlaybackTimeMs))
    );
    if (audioRef.current) {
      audioRef.current.currentTime = nextTimeMs / 1000;
    }
    setPlaybackTimeMs(nextTimeMs);
  }

  function seekSelectedSegmentFromPointer(event: PointerEvent<HTMLDivElement>) {
    if (!selectedSegment || !segmentAudioUrl) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const progress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setSelectedSegmentPlaybackPosition(progress * selectedSegment.durationMs);
  }

  function handlePlaybackPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!selectedSegment || !segmentAudioUrl) {
      return;
    }

    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    pointerScrubbingRef.current = true;
    seekSelectedSegmentFromPointer(event);
  }

  function handlePlaybackPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointerScrubbingRef.current) {
      return;
    }
    seekSelectedSegmentFromPointer(event);
  }

  function endPlaybackPointerScrub() {
    pointerScrubbingRef.current = false;
  }

  function handlePlaybackKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!selectedSegment || !segmentAudioUrl) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSelectedSegmentPlaybackPosition(playbackTimeMs - 5_000);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSelectedSegmentPlaybackPosition(playbackTimeMs + 5_000);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setSelectedSegmentPlaybackPosition(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      setSelectedSegmentPlaybackPosition(selectedSegment.durationMs);
    }
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

  async function toggleSelectedSegmentPlayback() {
    const audio = audioRef.current;

    if (!selectedSegment || !audio || !segmentAudioUrl) {
      return;
    }

    if (isSelectedSegmentPlaying) {
      audio.pause();
      setPlayingSegmentId(null);
      return;
    }

    try {
      setAudioPlaybackError(null);
      await audio.play();
      setPlayingSegmentId(selectedSegment.segmentId);
    } catch {
      setPlayingSegmentId(null);
      setAudioPlaybackError('片段无法播放，请稍后重试。');
    }
  }

  return (
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
                {segments.map((segment) => {
                  const isSelected = segment.segmentId === selectedSegment.segmentId;
                  return (
                    <div
                      key={segment.segmentId}
                      data-slot="memory-studio-segment-item"
                      className={[
                        'group relative flex min-w-[var(--memory-studio-segment-card-min-size)] flex-[0_0_var(--memory-studio-segment-card-size)] snap-start flex-col rounded-xl text-left outline-none',
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
                      <DropdownMenu
                        open={openSegmentMenuId === segment.segmentId}
                        onOpenChange={(open) =>
                          setOpenSegmentMenuId(open ? segment.segmentId : null)
                        }
                      >
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`片段 ${segment.title} 更多操作`}
                            className={[
                              'absolute right-8 top-8 z-[1] inline-flex size-28 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition duration-150 ease-out hover:bg-secondary hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:bg-secondary data-[state=open]:text-foreground data-[state=open]:opacity-100',
                            ].join(' ')}
                          >
                            <Ellipsis aria-hidden="true" className="size-16" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          aria-label={`片段 ${segment.title} 操作`}
                          aria-labelledby={undefined}
                          align="end"
                        >
                          <DropdownMenuItem
                            onSelect={() => {
                              setOpenSegmentMenuId(null);
                              onRenameSegment({ memoryId: memory.memoryId, segment });
                            }}
                          >
                            <Pencil aria-hidden="true" className="size-16" />
                            重命名
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setOpenSegmentMenuId(null);
                              onDeleteSegment({ memoryId: memory.memoryId, segment });
                            }}
                          >
                            <Trash2 aria-hidden="true" className="size-16" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
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
              <MemoryStudioAudioPlaybackRow
                audioAvailable={segmentAudioUrl !== null}
                durationMs={selectedSegment.durationMs}
                loading={segmentContentQuery.isLoading}
                onKeyDown={handlePlaybackKeyDown}
                onPointerCancel={endPlaybackPointerScrub}
                onPointerDown={handlePlaybackPointerDown}
                onPointerMove={handlePlaybackPointerMove}
                onPointerUp={endPlaybackPointerScrub}
                onTogglePlayback={toggleSelectedSegmentPlayback}
                playButtonLabel={`${isSelectedSegmentPlaying ? '暂停' : '播放'}片段 ${selectedSegment.title}`}
                playbackTimeMs={playbackTimeMs}
                playbackProgress={playbackProgress}
                playing={isSelectedSegmentPlaying}
                rowSlot="memory-studio-player"
                waveformData={playbackWaveformData}
                waveformLabel="片段播放进度"
                waveformSlot="memory-studio-playback-waveform"
                waveformSource={playbackWaveformSource}
              />

              <div className="mt-32 flex shrink-0 items-center justify-between gap-8">
                <div
                  role="tablist"
                  aria-label="片段内容类型"
                  className="flex min-w-0 items-center gap-4"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeContentTab === 'transcript'}
                    className={[
                      'min-h-32 rounded-lg px-12 text-ui-sm font-medium leading-ui-sm transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      activeContentTab === 'transcript'
                        ? 'bg-secondary text-foreground'
                        : 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
                    ].join(' ')}
                    onClick={() => setActiveContentTab('transcript')}
                  >
                    转录
                  </button>
                  {hasSelectedSegmentAttachments ? (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeContentTab === 'supplements'}
                      className={[
                        'min-h-32 rounded-lg px-12 text-ui-sm font-medium leading-ui-sm transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        activeContentTab === 'supplements'
                          ? 'bg-secondary text-foreground'
                          : 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
                      ].join(' ')}
                      onClick={() => setActiveContentTab('supplements')}
                    >
                      补充
                    </button>
                  ) : null}
                </div>
                <DropdownMenu open={attachmentMenuOpen} onOpenChange={setAttachmentMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="添加片段补充内容"
                      className="mb-2 inline-flex size-32 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-150 ease-out hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-secondary data-[state=open]:text-foreground"
                    >
                      <Plus aria-hidden="true" className="size-16" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    aria-label="片段补充内容"
                    aria-labelledby={undefined}
                    align="end"
                  >
                    <DropdownMenuItem
                      onSelect={() => {
                        setAttachmentMenuOpen(false);
                        onStartSegmentAttachmentRecording({
                          memoryId: memory.memoryId,
                          segmentId: selectedSegment.segmentId,
                          title: `补充录音${selectedSegment.attachmentCount + 1}`,
                        });
                      }}
                    >
                      <Mic aria-hidden="true" className="size-16" />
                      录音补充
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <audio
                ref={audioRef}
                src={segmentAudioUrl ?? undefined}
                onEnded={() => {
                  setPlayingSegmentId(null);
                  setPlaybackTimeMs(selectedSegment.durationMs);
                }}
                onPause={() => setPlayingSegmentId(null)}
                onTimeUpdate={(event) => {
                  setPlaybackTimeMs(
                    Math.min(
                      selectedSegment.durationMs,
                      Math.round(event.currentTarget.currentTime * 1000)
                    )
                  );
                }}
              />
              {activeContentTab === 'transcript' ? (
                <section
                  aria-label="片段转录"
                  data-slot="memory-studio-transcript-scroll"
                  className="edge-fade-y scrollbar-hover mt-4 min-h-0 flex-1 overflow-y-auto pl-8 pr-8 pb-6"
                >
                  {segmentContentQuery.isLoading ? (
                    <p className="text-body leading-body text-muted-foreground">
                      正在载入片段内容。
                    </p>
                  ) : segmentContentQuery.isError ? (
                    <p className="text-body leading-body text-muted-foreground">
                      片段内容加载失败，请重试。
                    </p>
                  ) : segmentContent?.transcript.exists ? (
                    <p className="select-text max-w-[820px] text-body leading-[1.78] text-foreground">
                      {segmentContent.transcript.text}
                    </p>
                  ) : (
                    <p className="text-body leading-body text-muted-foreground">
                      这段录音还没有转录。
                    </p>
                  )}
                </section>
              ) : (
                <section
                  aria-label="片段补充内容"
                  data-slot="memory-studio-supplements-scroll"
                  className="mt-4 min-h-0 flex-1 overflow-y-auto pr-8 pb-6"
                >
                  {selectedSegmentAttachments.map((attachment) => (
                    <SegmentAttachmentAudioPlayer
                      key={attachment.attachmentId}
                      attachment={attachment}
                      workspaceSession={workspaceSession}
                    />
                  ))}
                </section>
              )}
              {audioPlaybackError ? (
                <p
                  role="status"
                  className="mt-8 shrink-0 text-ui-sm leading-ui-sm text-muted-foreground"
                >
                  {audioPlaybackError}
                </p>
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
  );
}

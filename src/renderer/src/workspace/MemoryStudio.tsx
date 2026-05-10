import { useQuery } from '@tanstack/react-query';
import { Mic, Pause, Play, Plus } from 'lucide-react';
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
import { countLabel } from './memoryLabels';
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
  readonly onStartSegmentAttachmentRecording: (target: SegmentAttachmentRecordingTarget) => void;
  readonly workspaceSession: WorkspaceSession;
};

export type SegmentAttachmentRecordingTarget = {
  readonly memoryId: string;
  readonly segmentId: string;
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
const SEGMENT_PREVIEW_SPECTRUM_DATA = [30, 50, 70, 40, 60, 30, 40, 80, 90, 50, 30, 40, 40, 60, 80];
const SEGMENT_PREVIEW_WAVE_DURATIONS = [1.2, 1.32, 1.14, 1.26, 1.38];

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

function segmentStateLabel(segment: MemorySegment) {
  if (segment.attachmentCount > 0) {
    return `${countLabel(segment.attachmentCount, '个补充')}`;
  }
  return segment.transcript.exists ? '已有转录' : '本地音频';
}

function segmentPreviewWaveDelay(index: number) {
  return index === 0 ? '0s' : `-${(index * 0.1).toFixed(1)}s`;
}

function segmentPreviewWaveDuration(index: number) {
  return `${SEGMENT_PREVIEW_WAVE_DURATIONS[index % SEGMENT_PREVIEW_WAVE_DURATIONS.length]}s`;
}

function prefersReducedMotion() {
  if (typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type MemoryStudioAudioPlaybackRowProps = {
  readonly audioAvailable: boolean;
  readonly durationMs: number;
  readonly loading: boolean;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  readonly onTogglePlayback: () => Promise<void> | void;
  readonly playButtonLabel: string;
  readonly playbackTimeMs: number;
  readonly playheadProgress: number;
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
  onPointerDown,
  onTogglePlayback,
  playButtonLabel,
  playbackTimeMs,
  playheadProgress,
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
      className="grid shrink-0 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-14"
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={playButtonLabel}
        className="grid size-40 shrink-0 place-items-center rounded-full border border-glass-border bg-card-glass text-signal-blue backdrop-blur-glass-sm transition-colors duration-150 hover:border-obsidian hover:bg-obsidian hover:text-on-accent disabled:border-glass-border disabled:bg-card-glass disabled:text-fog"
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
        barGap={4}
        barRadius={2}
        barWidth={2}
        className="min-w-0 cursor-pointer rounded-buttons focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-eggshell"
        data={waveformData}
        data-slot={waveformSlot}
        data-waveform-source={waveformSource}
        height={42}
        label={waveformLabel}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        playheadProgress={playheadProgress}
        role="slider"
        tabIndex={audioAvailable ? 0 : -1}
        tone="voice"
      />
      <span className="shrink-0 font-geist-mono text-ui-md font-regular leading-ui-md tracking-wide text-obsidian">
        {loading ? '载入中' : `${durationLabel(playbackTimeMs)} / ${durationLabel(durationMs)}`}
      </span>
    </div>
  );
}

function SegmentPreviewSpectrum({ active }: { readonly active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-48 w-[102px] shrink-0 items-center gap-[3px] overflow-hidden"
      data-slot="memory-studio-segment-card-waveform"
    >
      {SEGMENT_PREVIEW_SPECTRUM_DATA.map((level, index) => (
        <span
          key={index}
          className={[
            'w-[4px] origin-center rounded-tags transition-colors duration-150 motion-reduce:animate-none',
            active ? 'bg-signal-blue' : 'bg-slate',
          ].join(' ')}
          style={{
            animationDelay: active ? segmentPreviewWaveDelay(index) : undefined,
            animationDirection: active ? 'alternate' : undefined,
            animationDuration: active ? segmentPreviewWaveDuration(index) : undefined,
            animationIterationCount: active ? 'infinite' : undefined,
            animationName: active ? 'reo-flat-wave' : undefined,
            animationTimingFunction: active ? 'ease-in-out' : undefined,
            height: `${level}%`,
          }}
        />
      ))}
    </span>
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

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!audioUrl) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const progress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setPlaybackPosition(progress * attachment.durationMs);
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
    <article aria-label={attachment.title} className="border-b border-chalk py-12 last:border-b-0">
      <MemoryStudioAudioPlaybackRow
        audioAvailable={audioUrl !== null}
        durationMs={attachment.durationMs}
        loading={attachmentContentQuery.isLoading}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onTogglePlayback={togglePlayback}
        playButtonLabel={`${playing ? '暂停' : '播放'}补充录音 ${attachment.title}`}
        playbackTimeMs={playbackTimeMs}
        playheadProgress={playbackProgress}
        playing={playing}
        rowSlot="memory-studio-attachment-player"
        waveformData={waveformData}
        waveformLabel="补充录音播放进度"
        waveformSlot="memory-studio-attachment-waveform"
        waveformSource={waveformSource}
      />
      {attachmentContentQuery.isError ? (
        <p role="status" className="mt-8 text-ui-xs leading-ui-xs text-gravel">
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
  onStartSegmentAttachmentRecording,
  workspaceSession,
}: MemoryStudioProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
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
  const visibleMemory = detail ?? {
    ...memory,
    workspaceId: workspaceSession.workspaceId,
    segments: [],
  };
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

  function handlePlaybackPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!selectedSegment || !segmentAudioUrl) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const progress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setSelectedSegmentPlaybackPosition(progress * selectedSegment.durationMs);
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
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
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
      <div
        data-slot="memory-studio-layout"
        className="flex h-full min-h-0 w-full max-w-[1120px] flex-col"
      >
        <header className="min-w-0 shrink-0 pt-4">
          <h1 className="truncate font-waldenburg text-heading font-light leading-heading tracking-heading text-obsidian xl:text-heading-lg xl:leading-heading-lg xl:tracking-heading-lg">
            {visibleMemory.title}
          </h1>
          <p className="mt-6 text-ui-md leading-ui-md text-gravel">
            {countLabel(visibleMemory.segmentCount, '个片段')} ·{' '}
            {durationLabel(visibleMemory.durationMs)}
          </p>
        </header>

        {detail && segments.length === 0 ? (
          <div className="mt-48 max-w-[420px]">
            <p className="text-body-lg font-medium leading-body-lg text-obsidian">
              这条记忆还没有片段
            </p>
            <p className="mt-8 text-body leading-body text-gravel">继续在这条记忆里记录。</p>
          </div>
        ) : detail && segments.length > 0 && selectedSegment ? (
          <>
            <section aria-label="片段预览流" className="relative mt-20 min-w-0 shrink-0">
              {stripScrollState.canScrollLeft ? (
                <div className="pointer-events-none absolute left-0 top-[calc(50%-20px)] z-10">
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
                className="flex snap-x gap-12 overflow-x-auto px-0 py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={
                  {
                    '--memory-studio-segment-card-size': 'clamp(188px, 24%, 216px)',
                  } as CSSProperties
                }
              >
                {segments.map((segment) => {
                  const isSelected = segment.segmentId === selectedSegment.segmentId;
                  return (
                    <button
                      key={segment.segmentId}
                      type="button"
                      data-slot="memory-studio-segment-card"
                      aria-current={isSelected ? 'true' : undefined}
                      aria-label={`选择片段 ${segment.title}`}
                      className={[
                        'group box-border flex aspect-square min-w-0 flex-[0_0_var(--memory-studio-segment-card-size)] snap-start flex-col justify-between overflow-hidden rounded-panels border-2 bg-card-glass px-16 py-16 text-left shadow-subtle backdrop-blur-glass-sm transition-colors duration-150 hover:border-obsidian hover:bg-powder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-eggshell',
                        isSelected ? 'border-signal-blue shadow-glass' : 'border-glass-border',
                      ].join(' ')}
                      onClick={() => setSelectedSegmentId(segment.segmentId)}
                    >
                      <span className="block min-w-0">
                        <span className="block line-clamp-2 text-subheading font-bold leading-subheading text-obsidian">
                          {segment.title}
                        </span>
                        <span className="mt-8 block truncate text-ui-md font-medium leading-ui-md text-gravel">
                          {segmentStateLabel(segment)}
                        </span>
                      </span>
                      <span className="flex min-w-0 items-center justify-between gap-8">
                        <SegmentPreviewSpectrum active={isSelected} />
                        <span
                          data-slot="memory-studio-segment-card-duration"
                          className="shrink-0 font-geist-mono text-body-lg font-bold leading-none tracking-wide text-obsidian"
                        >
                          {durationLabel(segment.durationMs)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {stripScrollState.canScrollRight ? (
                <div className="pointer-events-none absolute right-0 top-[calc(50%-20px)] z-10">
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

            <nav
              aria-label="Memory 片段时间轴"
              className="relative mt-12 grid shrink-0 px-20 py-4 before:absolute before:left-20 before:right-20 before:top-12 before:h-px before:bg-chalk"
              style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
            >
              {segments.map((segment) => {
                const isSelected = segment.segmentId === selectedSegment.segmentId;
                return (
                  <button
                    key={segment.segmentId}
                    type="button"
                    aria-current={isSelected ? 'step' : undefined}
                    aria-label={`定位片段 ${segment.title}`}
                    className={[
                      'relative flex min-w-0 flex-col items-center gap-7 rounded-buttons px-2 py-2 text-ui-sm leading-ui-sm text-gravel outline-none transition-colors duration-150 hover:text-obsidian focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-eggshell',
                      isSelected ? 'text-obsidian' : '',
                    ].join(' ')}
                    onClick={() => setSelectedSegmentId(segment.segmentId)}
                  >
                    <span
                      aria-hidden="true"
                      className={[
                        'relative z-[1] size-8 rounded-full border bg-card-glass',
                        isSelected ? 'border-signal-blue bg-signal-blue' : 'border-slate',
                      ].join(' ')}
                    />
                    <span className="font-geist-mono tracking-wide">
                      {durationLabel(segment.durationMs)}
                    </span>
                  </button>
                );
              })}
            </nav>

            <section
              aria-label="片段内容"
              data-slot="memory-studio-content-panel"
              className="mt-16 flex min-h-0 flex-1 flex-col border-t border-chalk pt-12"
            >
              <MemoryStudioAudioPlaybackRow
                audioAvailable={segmentAudioUrl !== null}
                durationMs={selectedSegment.durationMs}
                loading={segmentContentQuery.isLoading}
                onKeyDown={handlePlaybackKeyDown}
                onPointerDown={handlePlaybackPointerDown}
                onTogglePlayback={toggleSelectedSegmentPlayback}
                playButtonLabel={`${isSelectedSegmentPlaying ? '暂停' : '播放'}片段 ${selectedSegment.title}`}
                playbackTimeMs={playbackTimeMs}
                playheadProgress={playbackProgress}
                playing={isSelectedSegmentPlaying}
                rowSlot="memory-studio-player"
                waveformData={playbackWaveformData}
                waveformLabel="片段播放进度"
                waveformSlot="memory-studio-playback-waveform"
                waveformSource={playbackWaveformSource}
              />

              <div className="mt-12 flex shrink-0 items-center justify-between gap-8 border-b border-chalk">
                <div role="tablist" aria-label="片段内容类型" className="flex min-w-0 items-end">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeContentTab === 'transcript'}
                    className={[
                      'min-h-32 border-b-2 px-12 text-ui-sm font-medium leading-ui-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-eggshell',
                      activeContentTab === 'transcript'
                        ? 'border-signal-blue text-obsidian'
                        : 'border-transparent text-gravel hover:text-obsidian',
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
                        'min-h-32 border-b-2 px-12 text-ui-sm font-medium leading-ui-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-eggshell',
                        activeContentTab === 'supplements'
                          ? 'border-signal-blue text-obsidian'
                          : 'border-transparent text-gravel hover:text-obsidian',
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
                      className="mb-2 inline-flex size-32 items-center justify-center rounded-buttons text-cinder transition-colors duration-150 hover:bg-powder hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-eggshell data-[state=open]:bg-powder data-[state=open]:text-obsidian"
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
                        });
                      }}
                    >
                      <Mic aria-hidden="true" className="size-14" />
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
                  className="mt-10 min-h-0 flex-1 overflow-y-auto pr-8 pb-6"
                >
                  {segmentContentQuery.isLoading ? (
                    <p className="text-body leading-body text-gravel">正在载入片段内容。</p>
                  ) : segmentContentQuery.isError ? (
                    <p className="text-body leading-body text-gravel">片段内容加载失败，请重试。</p>
                  ) : segmentContent?.transcript.exists ? (
                    <p className="max-w-[820px] text-body leading-[1.78] text-cinder">
                      {segmentContent.transcript.text}
                    </p>
                  ) : (
                    <p className="text-body leading-body text-gravel">这段录音还没有转录。</p>
                  )}
                </section>
              ) : (
                <section
                  aria-label="片段补充内容"
                  data-slot="memory-studio-supplements-scroll"
                  className="mt-10 min-h-0 flex-1 overflow-y-auto pr-8 pb-6"
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
                <p role="status" className="mt-8 shrink-0 text-ui-sm leading-ui-sm text-gravel">
                  {audioPlaybackError}
                </p>
              ) : null}
            </section>
          </>
        ) : detailQuery.isError ? (
          <p className="mt-32 text-body leading-body text-gravel">记忆内容加载失败，请重试。</p>
        ) : (
          <p className="mt-32 text-body leading-body text-gravel">正在载入记忆内容。</p>
        )}
      </div>
    </section>
  );
}

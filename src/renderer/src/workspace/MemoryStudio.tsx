import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ellipsis, FileText, Mic, Pause, Play, Plus } from 'lucide-react';
import {
  useEffect,
  forwardRef,
  memo,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { flushSync } from 'react-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { showReoToast } from '@/components/ui/toaster';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Waveform } from '@/components/ui/waveform';
import {
  canDecodeAudioBytesToWaveformData,
  createFallbackWaveformData,
  decodeAudioBytesToWaveformData,
  MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT,
  MEMORY_STUDIO_PLAYBACK_WAVEFORM_DECODE_TIMEOUT_MS,
} from './audioWaveform';
import { CarouselArrowButton } from './CarouselArrowButton';
import {
  MEMORY_STUDIO_SEGMENT_CARD_AXIS_TOP_CLASS,
  MEMORY_STUDIO_SEGMENT_CARD_ESTIMATE_PX,
  MEMORY_STUDIO_SEGMENT_STRIP_STYLE,
  MemoryStudioSegmentCard,
  MemoryStudioSegmentCardActionButton,
  memoryStudioSegmentStripSpacerStyle,
} from './MemoryStudioSegmentCard';
import { SegmentActionsMenu } from './SegmentActionsMenu';
import { SegmentContentActionsMenu } from './SegmentContentActionsMenu';
import {
  SegmentSupplementActionsMenu,
  type SegmentSupplementActionIdentity,
} from './SegmentSupplementActionsMenu';
import { EditorExpandShell } from './EditorExpandShell';
import {
  LightweightMarkdownEditorSurface,
  type LightweightMarkdownEditorHandle,
} from './LightweightMarkdownEditorSurface';
import {
  createInlineMarkdownEditorState,
  inlineMarkdownEditorHasUnacceptedDiskVersion,
  inlineMarkdownEditorIsDirty,
  inlineMarkdownEditorReducer,
  type InlineMarkdownEditorState,
} from './inlineMarkdownEditorState';
import { MarkdownContentSurface } from './MarkdownContentSurface';
import {
  type FinalizedNoteContentSaveResult,
  saveFinalizedNoteSegmentContent,
  saveFinalizedNoteSegmentSupplementContent,
  savedNoteSegmentContentFromConflict,
  savedNoteSegmentSupplementContentFromConflict,
  type SavedNoteSegmentContent,
  type SavedNoteSegmentSupplementContent,
} from './finalizedNoteContentSave';
import {
  SegmentTranscriptView,
  type SegmentTranscriptOutcome,
  type SegmentTranscriptViewCopy,
} from './SegmentTranscriptView';
import type {
  SegmentSupplementDeleteTarget,
  SegmentSupplementRenameTarget,
  SegmentContentClearTarget,
  SegmentContentRenameTarget,
  SegmentCoverResetTarget,
  SegmentDefaultCoverSwitchTarget,
  SegmentDeleteTarget,
  SegmentRenameTarget,
} from './segmentActionTargets';
import type {
  WorkspaceFinalizedAudioSegmentContent,
  WorkspaceFinalizedAudioSegmentSupplementContent,
  WorkspaceMemoryDetail,
  WorkspaceMemorySummary,
  WorkspaceNoteSegmentContent,
  WorkspaceNoteSegmentSupplementContent,
  WorkspaceSession,
  WorkspaceSnapshot,
} from './workspaceApi';
import {
  SPEECH_SYNTHESIS_SPEAKER_OPTIONS,
  type VoiceSpeechSynthesisSpeaker,
} from '../voiceSpeechSynthesisSpeakers';
import {
  saveSegmentSupplementTranscript,
  saveTranscript,
  updateSegmentContentTabOrder,
} from './workspaceApi';
import {
  memoryDetailQueryOptions,
  memoryDetailQueryKey,
  segmentAudioQueryOptions,
  segmentSupplementContentQueryOptions,
  segmentSupplementContentQueryKey,
  segmentSupplementAudioQueryOptions,
  segmentSupplementSpeechAudioQueryOptions,
  segmentContentQueryOptions,
  segmentContentQueryKey,
  segmentSpeechAudioQueryOptions,
  workspaceSnapshotQueryKey,
} from './workspaceQueries';
import {
  useMarkdownImageAttachment,
  type MarkdownImageAttachmentTarget,
} from './useMarkdownImageAttachment';
import { createMarkdownAttachmentContext } from './markdownAttachmentSource';
import { unknownErrorDisplayMessage, workspaceErrorDisplayMessage } from './workspaceErrorMessages';
import {
  WorkspaceAlertDialogContent,
  WorkspaceCompactAlertDialogContent,
  type WorkspaceModalLayer,
} from './WorkspaceAlertDialogContent';
import { WorkspaceDangerConfirmDialog } from './WorkspaceDangerConfirmDialog';

type MemoryStudioProps = {
  readonly audioResourceCaches: MemoryStudioAudioResourceCaches;
  readonly memory: WorkspaceMemorySummary;
  readonly onDeleteSegment: (target: SegmentDeleteTarget) => void;
  readonly onDeleteSegmentSupplement: (target: SegmentSupplementDeleteTarget) => void;
  readonly onClearSegmentContent: (target: SegmentContentClearTarget) => void;
  readonly onSegmentTranscriptSaved: (saved: SavedSegmentTranscriptContent) => void;
  readonly onSegmentSupplementTranscriptSaved: (
    saved: SavedSegmentSupplementTranscriptContent
  ) => void;
  readonly onNoteSegmentContentSaved: (saved: SavedNoteSegmentContent) => void;
  readonly onNoteSegmentSupplementContentSaved: (saved: SavedNoteSegmentSupplementContent) => void;
  readonly onRenameSegmentSupplement: (target: SegmentSupplementRenameTarget) => void;
  readonly onRenameSegmentContent: (target: SegmentContentRenameTarget) => void;
  readonly onResetSegmentCover: (target: SegmentCoverResetTarget) => void;
  readonly onSwitchSegmentDefaultCover: (target: SegmentDefaultCoverSwitchTarget) => void;
  readonly onRenameSegment: (target: SegmentRenameTarget) => void;
  readonly speechSynthesis?: SpeechSynthesisController;
  readonly transcriptionBackfill?: TranscriptionBackfillController;
  readonly onInlineMarkdownDirtyChange?: (dirty: boolean) => void;
  readonly onSegmentFocusConsumed?: (segmentId: string) => void;
  readonly onStartSegmentSupplementNote?: (target: SegmentSupplementNoteTarget) => void;
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
export type SpeechSynthesisMode = 'fill-missing' | 'regenerate';

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

export type SegmentSpeechSynthesisTarget = {
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
};

export type SegmentSupplementSpeechSynthesisTarget = {
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
};

export type SpeechSynthesisController = {
  readonly disabledReason?: string | null;
  readonly isSegmentRunning?: (target: SegmentSpeechSynthesisTarget) => boolean;
  readonly isSupplementRunning?: (target: SegmentSupplementSpeechSynthesisTarget) => boolean;
  readonly requestSegment?: (
    target: SegmentSpeechSynthesisTarget & {
      readonly mode: SpeechSynthesisMode;
      readonly speaker: VoiceSpeechSynthesisSpeaker;
    }
  ) => Promise<void> | void;
  readonly requestSupplement?: (
    target: SegmentSupplementSpeechSynthesisTarget & {
      readonly mode: SpeechSynthesisMode;
      readonly speaker: VoiceSpeechSynthesisSpeaker;
    }
  ) => Promise<void> | void;
};

export type SegmentSupplementRecordingTarget = {
  readonly memoryId: string;
  readonly segmentId: string;
  readonly title: string;
};

export type SegmentSupplementNoteTarget = {
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
const INLINE_MARKDOWN_UNSAVED_MESSAGE = '请先保存当前文本编辑。';
const INLINE_MARKDOWN_AUTOSAVE_DELAY_MS = 300;
const MEMORY_STUDIO_AUDIO_RESOURCE_CACHE_LIMIT = 12;
const MEMORY_STUDIO_AUDIO_RESOURCE_CACHE_BYTE_LIMIT = 64 * 1024 * 1024;
const MEMORY_STUDIO_PLAYBACK_EAGER_LOAD_MAX_BYTES = 2 * 1024 * 1024;

type MemorySegment = WorkspaceMemoryDetail['segments'][number];
type MemorySegmentSupplement = MemorySegment['supplements'][number];
type AudioMemorySegment = Extract<MemorySegment, { readonly type: 'audio' }>;
type NoteMemorySegment = Extract<MemorySegment, { readonly type: 'note' }>;
type AudioMemorySegmentSupplement = Extract<MemorySegmentSupplement, { readonly type: 'audio' }>;
type NoteMemorySegmentSupplement = Extract<MemorySegmentSupplement, { readonly type: 'note' }>;
type LastTranscriptionAttempt = AudioMemorySegment['lastTranscriptionAttempt'];
type TranscriptProjection =
  | { readonly exists: boolean; readonly text: string; readonly baselineHash: string }
  | null
  | undefined;
type PlaybackWaveformSource = 'decoded-audio' | 'generated-overview' | 'pending' | 'unavailable';
export type MemoryStudioAudioResource = {
  audioByteLength: number;
  audioUrl: string;
  decodePromise: Promise<void>;
  decodeStarted: boolean;
  memoryId: string;
  mimeType: string;
  requestId: string;
  segmentId: string;
  supplementId?: string;
  waveformData: readonly number[];
  waveformSource: PlaybackWaveformSource;
  workspaceHandle: string;
  workspaceId: string;
};
type SegmentAudioResource = MemoryStudioAudioResource;
type SegmentSupplementAudioResource = MemoryStudioAudioResource;

export type MemoryStudioAudioResourceCaches = {
  readonly segment: Map<string, SegmentAudioResource>;
  readonly supplement: Map<string, SegmentSupplementAudioResource>;
};

export function createMemoryStudioAudioResourceCaches(): MemoryStudioAudioResourceCaches {
  return {
    segment: new Map<string, SegmentAudioResource>(),
    supplement: new Map<string, SegmentSupplementAudioResource>(),
  };
}

export function clearMemoryStudioAudioResourceCaches(
  audioResourceCaches: MemoryStudioAudioResourceCaches
): void {
  clearMemoryStudioAudioResources(audioResourceCaches.segment);
  clearMemoryStudioAudioResources(audioResourceCaches.supplement);
}
type SavedSegmentTranscriptContent = {
  readonly expectedSession: WorkspaceSession;
  readonly baselineTranscriptHash: string;
  readonly baselineTiptapContentHash: string;
  readonly memory: WorkspaceMemorySummary;
  readonly memoryId: string;
  readonly segmentId: string;
};
export type SavedSegmentSupplementTranscriptContent = {
  readonly expectedSession: WorkspaceSession;
  readonly baselineTranscriptHash: string;
  readonly baselineTiptapContentHash: string;
  readonly memory: WorkspaceMemorySummary;
  readonly segment: MemorySegment;
  readonly supplement: AudioMemorySegmentSupplement;
};

function isAudioMemorySegment(segment: MemorySegment): segment is AudioMemorySegment {
  return segment.type === 'audio';
}

function isNoteMemorySegment(segment: MemorySegment): segment is NoteMemorySegment {
  return segment.type === 'note';
}

function isAudioSegmentContent(
  content: WorkspaceFinalizedAudioSegmentContent | WorkspaceNoteSegmentContent | undefined
): content is WorkspaceFinalizedAudioSegmentContent {
  return content !== undefined && 'transcript' in content && 'audioByteLength' in content;
}

function isNoteSegmentContent(
  content: WorkspaceFinalizedAudioSegmentContent | WorkspaceNoteSegmentContent | undefined
): content is WorkspaceNoteSegmentContent {
  return content !== undefined && 'bodyMarkdown' in content;
}

function isAudioSegmentSupplementContent(
  content:
    | WorkspaceFinalizedAudioSegmentSupplementContent
    | WorkspaceNoteSegmentSupplementContent
    | undefined
): content is WorkspaceFinalizedAudioSegmentSupplementContent {
  return content !== undefined && 'transcript' in content && 'audioByteLength' in content;
}

function isNoteSegmentSupplementContent(
  content:
    | WorkspaceFinalizedAudioSegmentSupplementContent
    | WorkspaceNoteSegmentSupplementContent
    | undefined
): content is WorkspaceNoteSegmentSupplementContent {
  return content !== undefined && 'bodyMarkdown' in content;
}

function isAudioMemorySegmentSupplement(
  supplement: MemorySegmentSupplement
): supplement is AudioMemorySegmentSupplement {
  return supplement.type === 'audio';
}

function isNoteMemorySegmentSupplement(
  supplement: MemorySegmentSupplement
): supplement is NoteMemorySegmentSupplement {
  return supplement.type === 'note';
}

function canEagerLoadPlaybackAudio(byteLength: number | null | undefined): boolean {
  return (
    typeof byteLength === 'number' &&
    Number.isFinite(byteLength) &&
    byteLength > 0 &&
    byteLength <= MEMORY_STUDIO_PLAYBACK_EAGER_LOAD_MAX_BYTES
  );
}

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

function noteSpeechSynthesisDisabledReason({
  baseReason,
  dirty,
  running,
  speechSynthesis,
}: {
  readonly baseReason?: string | null | undefined;
  readonly dirty: boolean;
  readonly running: boolean;
  readonly speechSynthesis:
    | WorkspaceNoteSegmentContent['speechSynthesis']
    | WorkspaceNoteSegmentSupplementContent['speechSynthesis']
    | undefined;
}) {
  if (running) {
    return '正在生成语音。';
  }
  if (dirty) {
    return INLINE_MARKDOWN_UNSAVED_MESSAGE;
  }
  if (speechSynthesis?.reason === 'text-too-long') {
    return '正文过长，暂不支持生成语音。';
  }
  return baseReason ?? null;
}

type ActiveContentTab = 'transcript' | `supplement:${string}`;
type PersistedContentTab = 'segment' | `supplement:${string}`;
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

function supplementContentTabValue(supplementId: string): `supplement:${string}` {
  return `supplement:${supplementId}`;
}

function contentTabValueFromPersisted(value: PersistedContentTab): ActiveContentTab {
  return value === 'segment' ? 'transcript' : value;
}

function persistedContentTabValue(value: ActiveContentTab): PersistedContentTab {
  return value === 'transcript' ? 'segment' : value;
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

function transcriptContentTabTitle(segment: MemorySegment | null) {
  if (segment?.contentTitle) {
    return segment.contentTitle;
  }
  return segment && isNoteMemorySegment(segment) ? '正文' : '转录';
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

const MEMORY_STUDIO_SEGMENT_SKELETON_ITEMS = [0, 1, 2, 3] as const;
const MEMORY_STUDIO_SEGMENT_SKELETON_WAVEFORM = [4, 15, 20, 26, 12, 24, 29, 17, 4] as const;

function MemoryStudioSegmentStripSkeleton() {
  return (
    <section
      aria-label="片段预览流"
      className="relative min-w-0 shrink-0 pt-4"
      data-slot="memory-studio-segment-strip-loading"
      style={MEMORY_STUDIO_SEGMENT_STRIP_STYLE}
    >
      <div role="status" className="sr-only">
        正在载入记忆内容。
      </div>
      <div
        aria-hidden="true"
        className="edge-fade-x flex snap-x gap-12 overflow-x-auto px-0 pb-0 pt-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-slot="memory-studio-segment-strip-scroll"
      >
        {MEMORY_STUDIO_SEGMENT_SKELETON_ITEMS.map((item) => (
          <div
            key={item}
            className="group relative flex min-w-[var(--memory-studio-segment-card-min-size)] flex-[0_0_var(--memory-studio-segment-card-size)] snap-start flex-col text-left outline-none"
            data-slot="memory-studio-segment-item"
          >
            <span
              className="relative flex aspect-square min-h-[var(--memory-studio-segment-card-min-size)] w-full min-w-[var(--memory-studio-segment-card-min-size)] flex-col justify-between overflow-hidden bg-transparent p-12 text-left reo-segment-card-squircle"
              data-slot="memory-studio-segment-card-skeleton"
            >
              <span
                className="pointer-events-none absolute inset-[-1px] z-0 block"
                style={{
                  background:
                    'linear-gradient(135deg, color-mix(in oklab, var(--secondary) 84%, var(--background)), color-mix(in oklab, var(--secondary) 42%, var(--background)) 48%, color-mix(in oklab, var(--secondary) 70%, var(--background)))',
                }}
              />
              <span className="relative z-[2] block max-w-[88px]">
                <span className="block h-[18px] w-[84px] rounded-[6px] bg-background/55" />
                <span className="mt-6 block h-[15px] w-[58px] rounded-[6px] bg-background/42" />
              </span>
              <span className="relative z-[2] flex min-w-0 items-center justify-between gap-6">
                <span className="inline-flex h-[32px] w-[52px] shrink-0 items-center gap-[2px] text-background/70">
                  {MEMORY_STUDIO_SEGMENT_SKELETON_WAVEFORM.map((height, index) => (
                    <span
                      key={`${height}-${index}`}
                      className={[
                        height <= 4 ? 'size-[4px]' : 'w-[4px]',
                        'block rounded-full bg-current',
                      ].join(' ')}
                      style={height > 4 ? { height: `${height}px` } : undefined}
                    />
                  ))}
                </span>
                <span className="block h-[13px] w-[38px] rounded-[5px] bg-background/55" />
              </span>
            </span>
            <span
              className="relative mt-10 flex h-48 w-full flex-col items-center before:absolute before:left-[-12px] before:right-[-12px] before:top-[3px] before:h-px before:bg-secondary"
              data-slot="memory-studio-segment-timeline-anchor"
            >
              <span className="relative z-[1] block size-[7px] min-h-[7px] min-w-[7px] rounded-full bg-muted-foreground/70" />
              <span className="mt-12 block h-[11px] w-[32px] rounded-[5px] bg-secondary" />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
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

function memoryStudioAudioResourceKey(
  input: Pick<
    MemoryStudioAudioResource,
    'memoryId' | 'mimeType' | 'segmentId' | 'workspaceHandle' | 'workspaceId'
  > & {
    readonly audioByteLength: number;
    readonly audioResourceIdentity: string;
    readonly supplementId?: string;
  }
) {
  const parts = [input.workspaceHandle, input.workspaceId, input.memoryId, input.segmentId];
  if (input.supplementId !== undefined) {
    parts.push(input.supplementId);
  }
  parts.push(input.audioResourceIdentity, String(input.audioByteLength), input.mimeType);
  return parts.join('\0');
}

function clearMemoryStudioAudioResources<TResource extends MemoryStudioAudioResource>(
  audioResourceCache: Map<string, TResource>
) {
  for (const resource of audioResourceCache.values()) {
    URL.revokeObjectURL(resource.audioUrl);
  }
  audioResourceCache.clear();
}

function revokeMemoryStudioAudioResource<TResource extends MemoryStudioAudioResource>(
  audioResourceCache: Map<string, TResource>,
  resourceKey: string
) {
  const resource = audioResourceCache.get(resourceKey);
  if (!resource) {
    return;
  }

  URL.revokeObjectURL(resource.audioUrl);
  audioResourceCache.delete(resourceKey);
}

function pruneMemoryStudioAudioResources<TResource extends MemoryStudioAudioResource>(
  audioResourceCache: Map<string, TResource>,
  shouldKeep: (resource: TResource, resourceKey: string) => boolean
) {
  for (const [resourceKey, resource] of audioResourceCache) {
    if (!shouldKeep(resource, resourceKey)) {
      revokeMemoryStudioAudioResource(audioResourceCache, resourceKey);
    }
  }
}

function touchMemoryStudioAudioResource<TResource extends MemoryStudioAudioResource>(
  audioResourceCache: Map<string, TResource>,
  resourceKey: string,
  resource: TResource
) {
  audioResourceCache.delete(resourceKey);
  audioResourceCache.set(resourceKey, resource);
}

function enforceMemoryStudioAudioResourceCacheLimit<TResource extends MemoryStudioAudioResource>(
  audioResourceCache: Map<string, TResource>,
  protectedResourceKey?: string
) {
  let cachedByteLength = 0;
  for (const resource of audioResourceCache.values()) {
    cachedByteLength += resource.audioByteLength;
  }

  while (
    audioResourceCache.size > MEMORY_STUDIO_AUDIO_RESOURCE_CACHE_LIMIT ||
    cachedByteLength > MEMORY_STUDIO_AUDIO_RESOURCE_CACHE_BYTE_LIMIT
  ) {
    const oldestResourceKey = audioResourceCache.keys().next().value;
    if (typeof oldestResourceKey !== 'string') {
      return;
    }
    if (oldestResourceKey === protectedResourceKey) {
      if (audioResourceCache.size <= 1) {
        return;
      }
      const protectedResource = audioResourceCache.get(oldestResourceKey);
      if (!protectedResource) {
        return;
      }
      touchMemoryStudioAudioResource(audioResourceCache, oldestResourceKey, protectedResource);
      continue;
    }
    cachedByteLength -= audioResourceCache.get(oldestResourceKey)?.audioByteLength ?? 0;
    revokeMemoryStudioAudioResource(audioResourceCache, oldestResourceKey);
  }
}

type MemoryStudioAudioPlaybackRowProps = {
  readonly audioAvailable: boolean;
  readonly audioLoadable: boolean;
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
  readonly rowTestId?: string | undefined;
  readonly waveformData: readonly number[];
  readonly waveformLabel: string;
  readonly waveformSlot: string;
  readonly waveformSource: PlaybackWaveformSource;
};

function MemoryStudioAudioPlaybackRow({
  audioAvailable,
  audioLoadable,
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
  rowTestId,
  waveformData,
  waveformLabel,
  waveformSlot,
  waveformSource,
}: MemoryStudioAudioPlaybackRowProps) {
  const disabled = (!audioAvailable && !audioLoadable) || loading;

  return (
    <div
      data-component="memory-studio-audio-player"
      data-slot={rowSlot}
      data-testid={rowTestId}
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
        aria-disabled={!audioAvailable && !audioLoadable}
        aria-label={waveformLabel}
        aria-orientation="horizontal"
        aria-valuemax={durationMs}
        aria-valuemin={0}
        aria-valuenow={Math.round(playbackTimeMs)}
        aria-valuetext={`${durationLabel(playbackTimeMs)} / ${durationLabel(durationMs)}`}
        barGap={3}
        barRadius={2}
        barWidth={2}
        className="min-w-0 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        data={waveformData}
        data-slot={waveformSlot}
        data-waveform-source={waveformSource}
        height={42}
        label={waveformLabel}
        onKeyDown={onKeyDown}
        onPointerCancel={onPointerCancel}
        onPointerDown={(event) => {
          if (!audioAvailable && audioLoadable) {
            onTogglePlayback();
            return;
          }
          onPointerDown(event);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        progress={playbackProgress}
        role="slider"
        tabIndex={audioAvailable || audioLoadable ? 0 : -1}
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

type MemoryStudioAudioBytes = Uint8Array;

type MemoryStudioAudioPlaybackInput = {
  readonly audio: MemoryStudioAudioBytes | null;
  readonly audioByteLength: number | null;
  readonly audioResourceIdentity: string | null;
  readonly audioResourceCache: Map<string, MemoryStudioAudioResource>;
  readonly durationMs: number;
  readonly memoryId: string;
  readonly mimeType?: string;
  readonly playbackErrorMessage: string;
  readonly playbackResetKey: string;
  readonly requestId: string | null;
  readonly segmentId: string;
  readonly supplementId?: string;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
};

type MemoryStudioAudioPlaybackTarget = Pick<
  MemoryStudioAudioResource,
  'memoryId' | 'segmentId' | 'workspaceHandle' | 'workspaceId'
> & {
  readonly supplementId?: string;
};

function memoryStudioAudioResourceBelongsToTarget(
  resource: MemoryStudioAudioResource,
  target: MemoryStudioAudioPlaybackTarget
) {
  return (
    resource.workspaceHandle === target.workspaceHandle &&
    resource.workspaceId === target.workspaceId &&
    resource.memoryId === target.memoryId &&
    resource.segmentId === target.segmentId &&
    resource.supplementId === target.supplementId
  );
}

function useMemoryStudioAudioPlayback({
  audio,
  audioByteLength,
  audioResourceIdentity,
  audioResourceCache,
  durationMs,
  memoryId,
  mimeType = 'audio/webm',
  playbackErrorMessage,
  playbackResetKey,
  requestId,
  segmentId,
  supplementId,
  workspaceHandle,
  workspaceId,
}: MemoryStudioAudioPlaybackInput) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioResourceKeyRef = useRef<string | null>(null);
  const waveformDecodeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const waveformDecodeGenerationRef = useRef(0);
  const pendingPlayOnAudioReadyRef = useRef(false);
  const pointerScrubbingRef = useRef(false);
  const playingRef = useRef(false);
  const playbackTimeMsRef = useRef(0);
  const lastPlaybackTimePublishAtRef = useRef(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [resolvedDurationMs, setResolvedDurationMs] = useState(durationMs);
  const [playbackTimeMs, setPlaybackTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [waveformData, setWaveformData] = useState<readonly number[]>([]);
  const [waveformSource, setWaveformSource] = useState<PlaybackWaveformSource>('pending');
  const playbackProgress =
    resolvedDurationMs > 0 ? Math.min(1, playbackTimeMs / resolvedDurationMs) : 0;

  useEffect(() => {
    setResolvedDurationMs(durationMs);
  }, [durationMs, playbackResetKey]);

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
    const audioElement = audioRef.current;
    pendingPlayOnAudioReadyRef.current = false;

    return () => {
      pointerScrubbingRef.current = false;
      if (playingRef.current) {
        playingRef.current = false;
        audioElement?.pause();
      }
    };
  }, [playbackResetKey]);

  useEffect(() => {
    if (!audioUrl || !pendingPlayOnAudioReadyRef.current || playingRef.current) {
      return;
    }

    pendingPlayOnAudioReadyRef.current = false;
    void startPlayback();
  }, [audioUrl]);

  useEffect(() => {
    let cancelled = false;
    const target: MemoryStudioAudioPlaybackTarget = {
      ...(supplementId !== undefined ? { supplementId } : {}),
      memoryId,
      segmentId,
      workspaceHandle,
      workspaceId,
    };
    const audioResourceKey =
      audioByteLength !== null && audioResourceIdentity !== null && requestId !== null
        ? memoryStudioAudioResourceKey({
            ...(supplementId !== undefined ? { supplementId } : {}),
            audioByteLength,
            audioResourceIdentity,
            memoryId,
            mimeType,
            segmentId,
            workspaceHandle,
            workspaceId,
          })
        : null;

    if (
      audio === null ||
      audioByteLength === null ||
      audioResourceIdentity === null ||
      requestId === null
    ) {
      if (audioResourceKey !== null) {
        const cachedResource = audioResourceCache.get(audioResourceKey);
        if (cachedResource) {
          const resourceChanged = currentAudioResourceKeyRef.current !== audioResourceKey;
          currentAudioResourceKeyRef.current = audioResourceKey;
          touchMemoryStudioAudioResource(audioResourceCache, audioResourceKey, cachedResource);
          setAudioUrl(cachedResource.audioUrl);
          setPlaybackError(null);
          if (resourceChanged) {
            audioRef.current?.pause();
            setPlaying(false);
            playingRef.current = false;
            setPlaybackTimeMs(0);
          }
          setWaveformData(cachedResource.waveformData);
          setWaveformSource(cachedResource.waveformSource);
          return () => {
            cancelled = true;
          };
        }
      }

      if (audioResourceIdentity === null) {
        pruneMemoryStudioAudioResources(
          audioResourceCache,
          (resource) => !memoryStudioAudioResourceBelongsToTarget(resource, target)
        );
      }
      audioRef.current?.pause();
      currentAudioResourceKeyRef.current = null;
      setAudioUrl(null);
      setPlaybackError(null);
      setPlaybackTimeMs(0);
      setPlaying(false);
      playingRef.current = false;
      setResolvedDurationMs(durationMs);
      if (audioByteLength !== null && audioResourceIdentity !== null) {
        setWaveformData(
          createFallbackWaveformData(
            audioByteLength,
            durationMs,
            MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT
          )
        );
        setWaveformSource('generated-overview');
      } else {
        setWaveformData([]);
        setWaveformSource('pending');
      }
      return () => {
        cancelled = true;
      };
    }

    if (audioResourceKey === null) {
      return () => {
        cancelled = true;
      };
    }
    const resourceChanged = currentAudioResourceKeyRef.current !== audioResourceKey;
    currentAudioResourceKeyRef.current = audioResourceKey;
    const cachedResource = audioResourceCache.get(audioResourceKey);

    if (cachedResource) {
      touchMemoryStudioAudioResource(audioResourceCache, audioResourceKey, cachedResource);
      setAudioUrl(cachedResource.audioUrl);
      setPlaybackError(null);
      if (resourceChanged) {
        audioRef.current?.pause();
        setPlaying(false);
        playingRef.current = false;
        setPlaybackTimeMs(0);
      }
      setWaveformData(cachedResource.waveformData);
      setWaveformSource(cachedResource.waveformSource);

      if (cachedResource.waveformSource === 'pending') {
        const pendingResourceTimeoutId = window.setTimeout(() => {
          if (
            cancelled ||
            currentAudioResourceKeyRef.current !== audioResourceKey ||
            audioResourceCache.get(audioResourceKey) !== cachedResource ||
            cachedResource.waveformSource !== 'pending'
          ) {
            return;
          }

          cachedResource.waveformData = [];
          cachedResource.waveformSource = 'unavailable';
          setWaveformData(cachedResource.waveformData);
          setWaveformSource(cachedResource.waveformSource);
        }, MEMORY_STUDIO_PLAYBACK_WAVEFORM_DECODE_TIMEOUT_MS);

        void cachedResource.decodePromise.finally(() => {
          window.clearTimeout(pendingResourceTimeoutId);
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

    const nextAudioUrl = URL.createObjectURL(new Blob([audio as BlobPart], { type: mimeType }));
    const nextResource: MemoryStudioAudioResource = {
      ...(supplementId !== undefined ? { supplementId } : {}),
      audioByteLength,
      audioUrl: nextAudioUrl,
      decodePromise: Promise.resolve(),
      decodeStarted: false,
      memoryId,
      mimeType,
      requestId,
      segmentId,
      waveformData: [],
      waveformSource: 'pending',
      workspaceHandle,
      workspaceId,
    };
    pruneMemoryStudioAudioResources(
      audioResourceCache,
      (resource, resourceKey) =>
        resourceKey === audioResourceKey ||
        !memoryStudioAudioResourceBelongsToTarget(resource, target)
    );
    audioResourceCache.set(audioResourceKey, nextResource);
    enforceMemoryStudioAudioResourceCacheLimit(audioResourceCache, audioResourceKey);

    setAudioUrl(nextAudioUrl);
    setPlaybackError(null);
    audioRef.current?.pause();
    setPlaying(false);
    playingRef.current = false;
    setPlaybackTimeMs(0);
    setWaveformData(nextResource.waveformData);
    setWaveformSource(nextResource.waveformSource);

    if (!canDecodeAudioBytesToWaveformData(audioByteLength)) {
      nextResource.waveformData = createFallbackWaveformData(
        audioByteLength,
        durationMs,
        MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT
      );
      nextResource.waveformSource = 'generated-overview';
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
          return decodeAudioBytesToWaveformData(audio, MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT);
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
          nextResource.waveformData = createFallbackWaveformData(
            audioByteLength,
            durationMs,
            MEMORY_STUDIO_PLAYBACK_WAVEFORM_BAR_COUNT
          );
          nextResource.waveformSource = 'generated-overview';

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
    audio,
    audioByteLength,
    audioResourceIdentity,
    audioResourceCache,
    durationMs,
    memoryId,
    mimeType,
    segmentId,
    supplementId,
    workspaceHandle,
    workspaceId,
  ]);

  function setPlaybackPosition(nextPlaybackTimeMs: number) {
    if (!audioUrl) {
      return;
    }

    const nextTimeMs = Math.min(resolvedDurationMs, Math.max(0, Math.round(nextPlaybackTimeMs)));
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
    setPlaybackPosition(progress * resolvedDurationMs);
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
      setPlaybackPosition(resolvedDurationMs);
    }
  }

  async function startPlayback() {
    const audioElement = audioRef.current;

    if (!audioElement || !audioUrl) {
      return;
    }

    try {
      setPlaybackError(null);
      await audioElement.play();
      playingRef.current = true;
      setPlaying(true);
    } catch {
      playingRef.current = false;
      setPlaying(false);
      setPlaybackError(playbackErrorMessage);
    }
  }

  function requestPlaybackWhenReady() {
    pendingPlayOnAudioReadyRef.current = true;
    if (audioUrl) {
      pendingPlayOnAudioReadyRef.current = false;
      void startPlayback();
    }
  }

  async function togglePlayback() {
    const audioElement = audioRef.current;

    if (!audioElement || !audioUrl) {
      return;
    }

    if (playing) {
      audioElement.pause();
      playingRef.current = false;
      setPlaying(false);
      return;
    }

    await startPlayback();
  }

  function handleEnded() {
    playingRef.current = false;
    setPlaying(false);
    publishPlaybackTime(resolvedDurationMs, true);
  }

  function handlePause() {
    playingRef.current = false;
    setPlaying(false);
  }

  function handleTimeUpdate(event: SyntheticEvent<HTMLAudioElement>) {
    publishPlaybackTime(
      Math.min(resolvedDurationMs, Math.round(event.currentTarget.currentTime * 1000))
    );
  }

  function handleLoadedMetadata(event: SyntheticEvent<HTMLAudioElement>) {
    const durationSeconds = event.currentTarget.duration;
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
      setResolvedDurationMs(Math.round(durationSeconds * 1000));
    }
  }

  return {
    audioAvailable: audioUrl !== null,
    audioRef,
    audioUrl,
    durationMs: resolvedDurationMs,
    handleEnded,
    handleKeyDown,
    handleLoadedMetadata,
    handlePause,
    handlePointerDown,
    handlePointerMove,
    handleTimeUpdate,
    endPointerScrub,
    playbackError,
    playbackProgress,
    playbackTimeMs,
    playing,
    requestPlaybackWhenReady,
    togglePlayback,
    waveformData,
    waveformSource,
  };
}

type MemoryStudioAudioPlaybackController = ReturnType<typeof useMemoryStudioAudioPlayback>;

function MemoryStudioAudioPlayback({
  audioLoadable,
  controller,
  durationMs,
  errorClassName,
  loading,
  onRequestAudio,
  playButtonLabel,
  rowSlot,
  rowTestId,
  showPlaybackError = true,
  waveformLabel,
  waveformSlot,
}: {
  readonly audioLoadable?: boolean;
  readonly controller: MemoryStudioAudioPlaybackController;
  readonly durationMs: number;
  readonly errorClassName: string;
  readonly loading: boolean;
  readonly onRequestAudio?: (() => void) | undefined;
  readonly playButtonLabel: string;
  readonly rowSlot: string;
  readonly rowTestId?: string | undefined;
  readonly showPlaybackError?: boolean;
  readonly waveformLabel: string;
  readonly waveformSlot: string;
}) {
  const resolvedAudioLoadable = audioLoadable === true && onRequestAudio !== undefined;
  const handleTogglePlayback = () => {
    if (!controller.audioAvailable && resolvedAudioLoadable) {
      controller.requestPlaybackWhenReady();
      onRequestAudio();
      return;
    }

    void controller.togglePlayback();
  };

  return (
    <>
      <MemoryStudioAudioPlaybackRow
        audioAvailable={controller.audioAvailable}
        audioLoadable={resolvedAudioLoadable}
        durationMs={controller.durationMs || durationMs}
        loading={loading}
        onKeyDown={controller.handleKeyDown}
        onPointerCancel={controller.endPointerScrub}
        onPointerDown={controller.handlePointerDown}
        onPointerMove={controller.handlePointerMove}
        onPointerUp={controller.endPointerScrub}
        onTogglePlayback={handleTogglePlayback}
        playButtonLabel={playButtonLabel}
        playbackTimeMs={controller.playbackTimeMs}
        playbackProgress={controller.playbackProgress}
        playing={controller.playing}
        rowSlot={rowSlot}
        rowTestId={rowTestId}
        waveformData={controller.waveformData}
        waveformLabel={waveformLabel}
        waveformSlot={waveformSlot}
        waveformSource={controller.waveformSource}
      />
      <audio
        ref={controller.audioRef}
        src={controller.audioUrl ?? undefined}
        onEnded={controller.handleEnded}
        onLoadedMetadata={controller.handleLoadedMetadata}
        onPause={controller.handlePause}
        onTimeUpdate={controller.handleTimeUpdate}
      />
      {showPlaybackError && controller.playbackError ? (
        <p role="status" className={errorClassName}>
          {controller.playbackError}
        </p>
      ) : null}
    </>
  );
}

function contentTabPillClassName(active: boolean, hasActions = false) {
  return [
    'relative inline-flex h-[34px] min-w-0 items-center overflow-hidden rounded-full select-none transition-colors',
    hasActions ? CONTENT_TAB_PILL_WITH_ACTIONS_MAX_WIDTH_CLASS : CONTENT_TAB_PILL_MAX_WIDTH_CLASS,
    CONTENT_TAB_MOTION_CLASS,
    active
      ? 'bg-secondary text-foreground'
      : 'bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground',
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
  const visibleClassName =
    'pointer-events-auto ml-[6px] max-w-20 scale-100 opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:ml-[6px] data-[state=open]:max-w-20 data-[state=open]:scale-100 data-[state=open]:opacity-100';
  const hiddenClassName =
    revealMode === 'drag-suppressed'
      ? 'pointer-events-none ml-0 max-w-0 scale-75 opacity-0'
      : 'pointer-events-none ml-0 max-w-0 scale-75 opacity-0 group-hover/supplement-tab:pointer-events-auto group-hover/supplement-tab:ml-[6px] group-hover/supplement-tab:max-w-20 group-hover/supplement-tab:scale-100 group-hover/supplement-tab:opacity-100 focus-visible:pointer-events-auto focus-visible:ml-[6px] focus-visible:max-w-20 focus-visible:scale-100 focus-visible:opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:ml-[6px] data-[state=open]:max-w-20 data-[state=open]:scale-100 data-[state=open]:opacity-100';

  return [
    'inline-flex items-center justify-center overflow-hidden',
    'transition-[max-width,margin-left,opacity,transform]',
    CONTENT_TAB_MOTION_CLASS,
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    revealMode === 'drag-source' ? visibleClassName : hiddenClassName,
  ].join(' ');
}

function stopContentTabMoreEventPropagation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

type ContentTabMoreTriggerProps = Omit<
  ComponentPropsWithoutRef<'button'>,
  'aria-hidden' | 'aria-label' | 'children' | 'className' | 'data-slot' | 'draggable' | 'type'
> & {
  readonly actionsAccessible: boolean;
  readonly dataSlot:
    | 'memory-studio-primary-tab-more-anchor'
    | 'memory-studio-supplement-more-anchor';
  readonly onRequestOpen?: (() => void) | undefined;
  readonly revealMode: 'drag-source' | 'drag-suppressed' | 'normal';
  readonly triggerLabel: string;
};

const ContentTabMoreTrigger = forwardRef<HTMLButtonElement, ContentTabMoreTriggerProps>(
  function ContentTabMoreTrigger(
    {
      actionsAccessible,
      dataSlot,
      revealMode,
      triggerLabel,
      onClick,
      onDragStart,
      onMouseDown,
      onPointerDown,
      onRequestOpen,
      style,
      ...buttonProps
    },
    ref
  ) {
    const effectiveRevealMode =
      actionsAccessible && revealMode !== 'drag-suppressed' ? 'drag-source' : revealMode;
    const visible = effectiveRevealMode === 'drag-source';

    return (
      <button
        {...buttonProps}
        ref={ref}
        type="button"
        aria-label={triggerLabel}
        aria-hidden={actionsAccessible ? undefined : true}
        data-slot={dataSlot}
        draggable={false}
        tabIndex={actionsAccessible ? 0 : -1}
        className={contentTabMoreClassName(effectiveRevealMode)}
        style={{
          ...style,
          marginLeft: visible ? 6 : 0,
          maxWidth: visible ? 20 : 0,
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.75)',
          transitionProperty: visible ? 'none' : undefined,
        }}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          onRequestOpen?.();
          stopContentTabMoreEventPropagation(event);
        }}
        onMouseDown={(event) => {
          onMouseDown?.(event);
          stopContentTabMoreEventPropagation(event);
        }}
        onClick={(event) => {
          onClick?.(event);
          onRequestOpen?.();
          stopContentTabMoreEventPropagation(event);
        }}
        onDragStart={(event) => {
          onDragStart?.(event);
          stopContentTabMoreEventPropagation(event);
        }}
      >
        <span className="inline-flex size-20 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-150 ease-out hover:bg-secondary hover:text-foreground">
          <Ellipsis className="size-16" strokeWidth={2.5} />
        </span>
      </button>
    );
  }
);

function SegmentSupplementTypeIcon({ type }: { readonly type: MemorySegmentSupplement['type'] }) {
  if (type === 'audio') {
    return <Mic aria-hidden="true" className="size-16 shrink-0" strokeWidth={2} />;
  }

  return <FileText aria-hidden="true" className="size-16 shrink-0" strokeWidth={2} />;
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
  onRequestSpeechSynthesis,
  onRequestTranscriptionBackfill,
  onDelete,
  onRename,
  onSelect,
  dragging,
  revealMode,
  menuOpen,
  speechSynthesisDisabledReason,
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
  readonly onRequestSpeechSynthesis?: ((speaker: VoiceSpeechSynthesisSpeaker) => void) | undefined;
  readonly onRequestTranscriptionBackfill?: (() => void) | undefined;
  readonly onRename: () => void;
  readonly onSelect: () => void;
  readonly speechSynthesisDisabledReason?: string | null | undefined;
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
        dragging ? 'scale-[1.02] opacity-40' : '',
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
        onRequestSpeechSynthesis={onRequestSpeechSynthesis}
        onRequestTranscriptionBackfill={onRequestTranscriptionBackfill}
        onRename={() => {
          onMenuOpenChange(false);
          onRename();
        }}
        open={menuOpen}
        speechSynthesisDisabledReason={speechSynthesisDisabledReason}
        supplementTitle={supplement.title}
        transcriptExists={transcriptExists}
        transcriptionBackfillDisabledReason={transcriptionBackfillDisabledReason}
        trigger={
          <ContentTabMoreTrigger
            ref={moreButtonRef}
            actionsAccessible={actionsAccessible}
            dataSlot="memory-studio-supplement-more-anchor"
            onRequestOpen={() => onMenuOpenChange(true)}
            revealMode={revealMode}
            triggerLabel={`${supplement.title} 更多操作`}
          />
        }
        triggerLabel={`${supplement.title} 更多操作`}
      />
    </div>
  );
}

function PrimaryContentTab({
  active,
  actionsVisible,
  children,
  dragging,
  menuOpen,
  renderMoreMenu,
  onActionsHidden,
  onActionsVisible,
  onDragEnd,
  onDragEnter,
  onDragOver,
  onDragStart,
  onKeyDown,
  onMenuOpenChange,
  onSelect,
  panelId,
  tabId,
  tabIndex,
  title,
}: {
  readonly active: boolean;
  readonly actionsVisible: boolean;
  readonly children: ReactNode;
  readonly dragging: boolean;
  readonly menuOpen: boolean;
  readonly onActionsHidden: () => void;
  readonly onActionsVisible: () => void;
  readonly onDragEnd: (event: DragEvent<HTMLDivElement>) => void;
  readonly onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  readonly onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  readonly onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  readonly onMenuOpenChange: (open: boolean) => void;
  readonly onSelect: () => void;
  readonly panelId: string;
  readonly renderMoreMenu: (
    trigger: ReactElement,
    onCloseAutoFocus: (event: Event) => void
  ) => ReactNode;
  readonly tabId: string;
  readonly tabIndex: number;
  readonly title: string;
}) {
  const tabButtonRef = useRef<HTMLButtonElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionsAccessible = actionsVisible || menuOpen;
  const triggerLabel = `${title} 更多操作`;
  const moreTrigger = (
    <ContentTabMoreTrigger
      ref={moreButtonRef}
      actionsAccessible={actionsAccessible}
      dataSlot="memory-studio-primary-tab-more-anchor"
      onRequestOpen={() => onMenuOpenChange(true)}
      revealMode={dragging ? 'drag-source' : 'normal'}
      triggerLabel={triggerLabel}
    />
  );

  useEffect(() => {
    if (actionsVisible || menuOpen || document.activeElement !== moreButtonRef.current) {
      return;
    }

    tabButtonRef.current?.focus();
  }, [actionsVisible, menuOpen]);

  return (
    <div
      data-slot="memory-studio-primary-tab-item"
      draggable
      className={[
        contentTabPillClassName(active, true),
        'group/supplement-tab cursor-grab pr-[14px] active:cursor-grabbing',
        dragging ? 'scale-[1.02] opacity-40' : '',
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
        data-slot="memory-studio-transcript-tab"
        tabIndex={tabIndex}
        className={contentTabButtonClassName(true)}
        onClick={onSelect}
        onKeyDown={onKeyDown}
      >
        <span
          data-slot="memory-studio-primary-tab-reorder-anchor"
          className="inline-flex min-w-0 items-center gap-[6px]"
        >
          {children}
        </span>
      </button>
      {renderMoreMenu(moreTrigger, (event) => {
        if (!actionsVisible) {
          event.preventDefault();
          tabButtonRef.current?.focus();
        }
      })}
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
  readonly segment: AudioMemorySegment;
  readonly workspaceSession: WorkspaceSession;
}) {
  const [audioRequested, setAudioRequested] = useState(false);
  useEffect(() => {
    setAudioRequested(false);
  }, [
    content?.audioHash,
    content?.audioByteLength,
    content?.requestId,
    segment.segmentId,
    workspaceSession.workspaceHandle,
    workspaceSession.workspaceId,
  ]);
  const audioQuery = useQuery({
    ...segmentAudioQueryOptions({
      audioByteLength: content?.audioByteLength ?? 0,
      audioHash: content?.audioHash ?? null,
      audioIdentityVersion: content?.requestId ?? 'pending-content',
      memoryId: segment.memoryId,
      segmentId: segment.segmentId,
      session: workspaceSession,
    }),
    enabled:
      content !== undefined &&
      (audioRequested || canEagerLoadPlaybackAudio(content.audioByteLength)),
  });
  const requestAudio = () => {
    setAudioRequested(true);
    if (audioQuery.isError) {
      void audioQuery.refetch();
    }
  };
  const audio = audioQuery.data?.audio ?? null;
  const playback = useMemoryStudioAudioPlayback({
    audio,
    audioByteLength: content ? (audioQuery.data?.audioByteLength ?? content.audioByteLength) : null,
    audioResourceIdentity: content
      ? `audio:${audioQuery.data?.audioHash ?? content.audioHash ?? content.requestId}`
      : null,
    audioResourceCache,
    durationMs: segment.durationMs,
    memoryId: segment.memoryId,
    playbackErrorMessage: '片段无法播放，请稍后重试。',
    playbackResetKey: segment.segmentId,
    requestId: content ? (audioQuery.data?.requestId ?? content.requestId) : null,
    segmentId: segment.segmentId,
    workspaceHandle: workspaceSession.workspaceHandle,
    workspaceId: workspaceSession.workspaceId,
  });

  return (
    <MemoryStudioAudioPlayback
      controller={playback}
      durationMs={segment.durationMs}
      errorClassName="mt-8 shrink-0 text-ui-sm leading-ui-sm text-muted-foreground"
      audioLoadable={content !== undefined}
      loading={
        loading ||
        ((audioRequested || canEagerLoadPlaybackAudio(content?.audioByteLength)) &&
          audioQuery.isLoading)
      }
      onRequestAudio={requestAudio}
      playButtonLabel={`${playback.playing ? '暂停' : '播放'}片段 ${segment.title}`}
      rowSlot="memory-studio-player"
      waveformLabel="片段播放进度"
      waveformSlot="memory-studio-playback-waveform"
    />
  );
});

const SegmentNoteSpeechPlayer = memo(function SegmentNoteSpeechPlayer({
  audioResourceCache,
  content,
  loading,
  segment,
  workspaceSession,
}: {
  readonly audioResourceCache: Map<string, SegmentAudioResource>;
  readonly content: WorkspaceNoteSegmentContent | undefined;
  readonly loading: boolean;
  readonly segment: NoteMemorySegment;
  readonly workspaceSession: WorkspaceSession;
}) {
  const [audioRequested, setAudioRequested] = useState(false);
  const speechSynthesis = content?.speechSynthesis;
  const playableSpeechSynthesis =
    (speechSynthesis?.status === 'ready' || speechSynthesis?.status === 'stale') &&
    speechSynthesis.audioByteLength !== null &&
    speechSynthesis.contentHash !== null &&
    speechSynthesis.speaker !== null &&
    speechSynthesis.updatedAt !== null
      ? {
          audioByteLength: speechSynthesis.audioByteLength,
          contentHash: speechSynthesis.contentHash,
          speaker: speechSynthesis.speaker,
          updatedAt: speechSynthesis.updatedAt,
        }
      : null;
  useEffect(() => {
    setAudioRequested(false);
  }, [
    playableSpeechSynthesis?.audioByteLength,
    playableSpeechSynthesis?.contentHash,
    playableSpeechSynthesis?.speaker,
    playableSpeechSynthesis?.updatedAt,
    segment.segmentId,
    workspaceSession.workspaceHandle,
    workspaceSession.workspaceId,
  ]);
  const speechAudioQuery = useQuery({
    ...segmentSpeechAudioQueryOptions({
      audioByteLength: playableSpeechSynthesis?.audioByteLength ?? 0,
      contentHash: playableSpeechSynthesis?.contentHash ?? '0'.repeat(64),
      memoryId: segment.memoryId,
      segmentId: segment.segmentId,
      session: workspaceSession,
      speaker: playableSpeechSynthesis?.speaker ?? SPEECH_SYNTHESIS_SPEAKER_OPTIONS[0].value,
      updatedAt: playableSpeechSynthesis?.updatedAt ?? 'pending',
    }),
    enabled:
      playableSpeechSynthesis !== null &&
      (audioRequested || canEagerLoadPlaybackAudio(playableSpeechSynthesis.audioByteLength)),
  });
  const requestAudio = () => {
    setAudioRequested(true);
    if (speechAudioQuery.isError) {
      void speechAudioQuery.refetch();
    }
  };
  const speechAudio = speechAudioQuery.data?.audio ?? null;
  const playback = useMemoryStudioAudioPlayback({
    audio: playableSpeechSynthesis ? speechAudio : null,
    audioByteLength: playableSpeechSynthesis
      ? (speechAudioQuery.data?.audioByteLength ?? playableSpeechSynthesis.audioByteLength)
      : null,
    audioResourceIdentity: playableSpeechSynthesis
      ? `speech:${playableSpeechSynthesis.contentHash}:${playableSpeechSynthesis.speaker}:${playableSpeechSynthesis.updatedAt}`
      : null,
    audioResourceCache,
    durationMs: 0,
    memoryId: segment.memoryId,
    mimeType: speechSynthesis?.mimeType ?? 'audio/mpeg',
    playbackErrorMessage: '笔记语音无法播放，请稍后重试。',
    playbackResetKey: `${segment.segmentId}:${speechSynthesis?.contentHash ?? 'missing'}`,
    requestId:
      playableSpeechSynthesis && content
        ? (speechAudioQuery.data?.requestId ?? content.requestId)
        : null,
    segmentId: segment.segmentId,
    workspaceHandle: workspaceSession.workspaceHandle,
    workspaceId: workspaceSession.workspaceId,
  });

  if (!playableSpeechSynthesis) {
    return <MemoryStudioPlayerPlaceholder />;
  }

  return (
    <MemoryStudioAudioPlayback
      controller={playback}
      durationMs={0}
      errorClassName="mt-8 shrink-0 text-ui-sm leading-ui-sm text-muted-foreground"
      audioLoadable={playableSpeechSynthesis !== null}
      loading={
        loading ||
        ((audioRequested || canEagerLoadPlaybackAudio(playableSpeechSynthesis?.audioByteLength)) &&
          speechAudioQuery.isLoading)
      }
      onRequestAudio={requestAudio}
      playButtonLabel={`${playback.playing ? '暂停' : '播放'}笔记语音 ${segment.title}`}
      rowSlot="memory-studio-player"
      rowTestId="note-speech-player-row"
      waveformLabel="笔记语音播放进度"
      waveformSlot="memory-studio-playback-waveform"
    />
  );
});

const SegmentSupplementNoteSpeechPlayer = memo(function SegmentSupplementNoteSpeechPlayer({
  audioResourceCache,
  content,
  loading,
  supplement,
  workspaceSession,
}: {
  readonly audioResourceCache: Map<string, SegmentSupplementAudioResource>;
  readonly content: WorkspaceNoteSegmentSupplementContent | undefined;
  readonly loading: boolean;
  readonly supplement: NoteMemorySegmentSupplement;
  readonly workspaceSession: WorkspaceSession;
}) {
  const [audioRequested, setAudioRequested] = useState(false);
  const speechSynthesis = content?.speechSynthesis;
  const playableSpeechSynthesis =
    (speechSynthesis?.status === 'ready' || speechSynthesis?.status === 'stale') &&
    speechSynthesis.audioByteLength !== null &&
    speechSynthesis.contentHash !== null &&
    speechSynthesis.speaker !== null &&
    speechSynthesis.updatedAt !== null
      ? {
          audioByteLength: speechSynthesis.audioByteLength,
          contentHash: speechSynthesis.contentHash,
          speaker: speechSynthesis.speaker,
          updatedAt: speechSynthesis.updatedAt,
        }
      : null;
  useEffect(() => {
    setAudioRequested(false);
  }, [
    playableSpeechSynthesis?.audioByteLength,
    playableSpeechSynthesis?.contentHash,
    playableSpeechSynthesis?.speaker,
    playableSpeechSynthesis?.updatedAt,
    supplement.supplementId,
    workspaceSession.workspaceHandle,
    workspaceSession.workspaceId,
  ]);
  const speechAudioQuery = useQuery({
    ...segmentSupplementSpeechAudioQueryOptions({
      audioByteLength: playableSpeechSynthesis?.audioByteLength ?? 0,
      contentHash: playableSpeechSynthesis?.contentHash ?? '0'.repeat(64),
      memoryId: supplement.memoryId,
      segmentId: supplement.segmentId,
      session: workspaceSession,
      speaker: playableSpeechSynthesis?.speaker ?? SPEECH_SYNTHESIS_SPEAKER_OPTIONS[0].value,
      supplementId: supplement.supplementId,
      updatedAt: playableSpeechSynthesis?.updatedAt ?? 'pending',
    }),
    enabled:
      playableSpeechSynthesis !== null &&
      (audioRequested || canEagerLoadPlaybackAudio(playableSpeechSynthesis.audioByteLength)),
  });
  const requestAudio = () => {
    setAudioRequested(true);
    if (speechAudioQuery.isError) {
      void speechAudioQuery.refetch();
    }
  };
  const speechAudio = speechAudioQuery.data?.audio ?? null;
  const playback = useMemoryStudioAudioPlayback({
    audio: playableSpeechSynthesis ? speechAudio : null,
    audioByteLength: playableSpeechSynthesis
      ? (speechAudioQuery.data?.audioByteLength ?? playableSpeechSynthesis.audioByteLength)
      : null,
    audioResourceIdentity: playableSpeechSynthesis
      ? `speech:${playableSpeechSynthesis.contentHash}:${playableSpeechSynthesis.speaker}:${playableSpeechSynthesis.updatedAt}`
      : null,
    audioResourceCache,
    durationMs: 0,
    memoryId: supplement.memoryId,
    mimeType: speechSynthesis?.mimeType ?? 'audio/mpeg',
    playbackErrorMessage: '补充笔记语音无法播放，请稍后重试。',
    playbackResetKey: `${supplement.supplementId}:${speechSynthesis?.contentHash ?? 'missing'}`,
    requestId:
      playableSpeechSynthesis && content
        ? (speechAudioQuery.data?.requestId ?? content.requestId)
        : null,
    segmentId: supplement.segmentId,
    supplementId: supplement.supplementId,
    workspaceHandle: workspaceSession.workspaceHandle,
    workspaceId: workspaceSession.workspaceId,
  });

  if (!playableSpeechSynthesis) {
    return <MemoryStudioSupplementPlayerPlaceholder />;
  }

  return (
    <MemoryStudioAudioPlayback
      controller={playback}
      durationMs={0}
      errorClassName="mt-8 text-ui-xs leading-ui-xs text-muted-foreground"
      audioLoadable={playableSpeechSynthesis !== null}
      loading={
        loading ||
        ((audioRequested || canEagerLoadPlaybackAudio(playableSpeechSynthesis?.audioByteLength)) &&
          speechAudioQuery.isLoading)
      }
      onRequestAudio={requestAudio}
      playButtonLabel={`${playback.playing ? '暂停' : '播放'}补充笔记语音 ${supplement.title}`}
      rowSlot="memory-studio-supplement-player"
      rowTestId="note-supplement-speech-player-row"
      waveformLabel="补充笔记语音播放进度"
      waveformSlot="memory-studio-supplement-waveform"
    />
  );
});

function MemoryStudioPlayerPlaceholder() {
  return (
    <div
      aria-hidden="true"
      data-slot="memory-studio-player-placeholder"
      className="h-[42px] w-full min-w-0 shrink-0"
    />
  );
}

function MemoryStudioSupplementPlayerPlaceholder() {
  return (
    <div
      aria-hidden="true"
      data-slot="memory-studio-supplement-player"
      className="h-[42px] w-full min-w-0 shrink-0"
    />
  );
}

function SegmentTranscriptMarkdownPanel({
  ariaLabelledBy,
  copy,
  error,
  id,
  loading,
  onRetry,
  outcome,
  title,
}: {
  readonly ariaLabelledBy: string;
  readonly copy: SegmentTranscriptViewCopy;
  readonly error: boolean;
  readonly id: string;
  readonly loading: boolean;
  readonly onRetry?: () => void;
  readonly outcome: SegmentTranscriptOutcome;
  readonly title: string;
}) {
  let bodyMarkdown: string | undefined = error ? undefined : '';
  let emptyCopy = copy.empty;
  let footer: ReactNode = null;

  if (error) {
    bodyMarkdown = undefined;
  } else if (outcome.kind === 'success') {
    bodyMarkdown = outcome.text;
  } else if (outcome.kind === 'running-overwrite') {
    bodyMarkdown = outcome.text;
    footer = (
      <p role="status" className="text-body leading-body text-muted-foreground">
        {copy.running}
      </p>
    );
  } else if (outcome.kind === 'running') {
    emptyCopy = copy.running;
  } else if (outcome.kind === 'failed-retryable') {
    emptyCopy = copy.failedRetryable;
    footer = (
      <Button
        type="button"
        variant="secondary"
        size="compact"
        disabled={!onRetry}
        onClick={onRetry}
      >
        {copy.retry}
      </Button>
    );
  }

  return (
    <MarkdownContentSurface
      ariaLabelledBy={ariaLabelledBy}
      bodyMarkdown={bodyMarkdown}
      className="mt-12"
      dataSlot="memory-studio-transcript-scroll"
      emptyCopy={emptyCopy}
      errorCopy={copy.error}
      footer={footer}
      id={id}
      loading={loading}
      loadingCopy={copy.loading}
      role="tabpanel"
      showTitle={false}
      title={title}
    />
  );
}

function SegmentSupplementAudioPlayer({
  ariaLabelledBy,
  supplement,
  audioResourceCache,
  onDirtyChange,
  onTranscriptSaved,
  panelId,
  transcriptionBackfill,
  workspaceSession,
}: {
  readonly ariaLabelledBy: string;
  readonly supplement: AudioMemorySegmentSupplement;
  readonly audioResourceCache: Map<string, SegmentSupplementAudioResource>;
  readonly onDirtyChange: (dirty: boolean) => void;
  readonly onTranscriptSaved: (saved: SavedSegmentSupplementTranscriptContent) => void;
  readonly panelId: string;
  readonly transcriptionBackfill?: TranscriptionBackfillController;
  readonly workspaceSession: WorkspaceSession;
}) {
  const supplementContentQuery = useQuery(
    segmentSupplementContentQueryOptions(
      workspaceSession,
      supplement.memoryId,
      supplement.segmentId,
      supplement.supplementId
    )
  );
  const supplementContent = supplementContentQuery.data;
  const audioSupplementContent = isAudioSegmentSupplementContent(supplementContent)
    ? supplementContent
    : undefined;
  const audioSupplementTranscript = audioSupplementContent?.transcript;
  const supplementId = supplement.supplementId;
  const supplementMemoryId = supplement.memoryId;
  const supplementSegmentId = supplement.segmentId;
  const [audioRequested, setAudioRequested] = useState(false);
  useEffect(() => {
    setAudioRequested(false);
  }, [
    audioSupplementContent?.audioHash,
    audioSupplementContent?.audioByteLength,
    audioSupplementContent?.requestId,
    supplementId,
    workspaceSession.workspaceHandle,
    workspaceSession.workspaceId,
  ]);
  const supplementAudioQuery = useQuery({
    ...segmentSupplementAudioQueryOptions({
      audioByteLength: audioSupplementContent?.audioByteLength ?? 0,
      audioHash: audioSupplementContent?.audioHash ?? null,
      audioIdentityVersion: audioSupplementContent?.requestId ?? 'pending-content',
      memoryId: supplementMemoryId,
      segmentId: supplementSegmentId,
      session: workspaceSession,
      supplementId,
    }),
    enabled:
      audioSupplementContent !== undefined &&
      (audioRequested || canEagerLoadPlaybackAudio(audioSupplementContent.audioByteLength)),
  });
  const requestSupplementAudio = () => {
    setAudioRequested(true);
    if (supplementAudioQuery.isError) {
      void supplementAudioQuery.refetch();
    }
  };
  const supplementRequestId = audioSupplementContent?.requestId ?? null;
  const workspaceHandle = workspaceSession.workspaceHandle;
  const workspaceId = workspaceSession.workspaceId;
  const playback = useMemoryStudioAudioPlayback({
    audio: supplementAudioQuery.data?.audio ?? null,
    audioByteLength: audioSupplementContent
      ? (supplementAudioQuery.data?.audioByteLength ?? audioSupplementContent.audioByteLength)
      : null,
    audioResourceIdentity: audioSupplementContent
      ? `audio:${supplementAudioQuery.data?.audioHash ?? audioSupplementContent.audioHash ?? audioSupplementContent.requestId}`
      : null,
    audioResourceCache,
    durationMs: supplement.durationMs,
    memoryId: supplementMemoryId,
    playbackErrorMessage: '补充录音无法播放，请稍后重试。',
    playbackResetKey: supplementId,
    requestId: audioSupplementContent
      ? (supplementAudioQuery.data?.requestId ?? supplementRequestId)
      : null,
    segmentId: supplementSegmentId,
    supplementId,
    workspaceHandle,
    workspaceId,
  });
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

  async function saveInlineSegmentSupplementTranscriptMarkdown(
    markdown: string,
    baselineTranscriptHash: string,
    tiptapJson: WorkspaceNoteSegmentContent['bodyTiptapJson'] | null,
    baselineTiptapContentHash: string | null
  ): Promise<FinalizedNoteContentSaveResult<SavedSegmentSupplementTranscriptContent>> {
    const response = await saveSegmentSupplementTranscript({
      workspaceHandle: workspaceSession.workspaceHandle,
      workspaceId: workspaceSession.workspaceId,
      memoryId: supplement.memoryId,
      segmentId: supplement.segmentId,
      supplementId: supplement.supplementId,
      markdown,
      baselineTranscriptHash,
      ...(tiptapJson ? { tiptapJson } : {}),
      ...(baselineTiptapContentHash ? { baselineTiptapContentHash } : {}),
    });
    if (!response.ok) {
      return {
        ok: false,
        kind: 'error',
        message: workspaceErrorDisplayMessage(response.error, '无法保存补充录音转录。'),
      };
    }

    if (!isAudioMemorySegmentSupplement(response.value.supplement)) {
      return {
        ok: false,
        kind: 'error',
        message: '无法保存补充录音转录。',
      };
    }

    return {
      ok: true,
      nextBaselineContentHash: response.value.baselineTranscriptHash,
      saved: {
        expectedSession: workspaceSession,
        baselineTranscriptHash: response.value.baselineTranscriptHash,
        baselineTiptapContentHash: response.value.baselineTiptapContentHash,
        memory: response.value.memory,
        segment: response.value.segment,
        supplement: response.value.supplement,
      },
      nextBaselineTiptapContentHash: response.value.baselineTiptapContentHash,
    };
  }

  return (
    <article aria-label={supplement.title} className="flex min-h-0 flex-1 flex-col pt-12">
      <MemoryStudioAudioPlayback
        controller={playback}
        durationMs={supplement.durationMs}
        errorClassName="mt-8 text-ui-xs leading-ui-xs text-muted-foreground"
        audioLoadable={audioSupplementContent !== undefined}
        loading={
          supplementContentQuery.isLoading ||
          ((audioRequested || canEagerLoadPlaybackAudio(audioSupplementContent?.audioByteLength)) &&
            supplementAudioQuery.isLoading)
        }
        onRequestAudio={requestSupplementAudio}
        playButtonLabel={`${playback.playing ? '暂停' : '播放'}补充录音 ${supplement.title}`}
        rowSlot="memory-studio-supplement-player"
        showPlaybackError={false}
        waveformLabel="补充录音播放进度"
        waveformSlot="memory-studio-supplement-waveform"
      />
      {supplementContentQuery.isError ? (
        <p role="status" className="mt-8 text-ui-xs leading-ui-xs text-muted-foreground">
          补充录音加载失败。
        </p>
      ) : null}
      {playback.playbackError ? (
        <p role="status" className="mt-8 text-ui-xs leading-ui-xs text-muted-foreground">
          {playback.playbackError}
        </p>
      ) : null}
      {audioSupplementTranscript ? (
        <InlineMarkdownContentEditor<SavedSegmentSupplementTranscriptContent>
          ariaLabelledBy={ariaLabelledBy}
          attachmentTarget={null}
          baselineContentHash={audioSupplementTranscript.baselineHash}
          baselineTiptapContentHash={audioSupplementTranscript.baselineTiptapContentHash}
          failureCopy="无法保存补充录音转录。"
          headerLabel="Markdown 补充录音转录"
          initialMarkdown={audioSupplementTranscript.text}
          initialTiptapJson={audioSupplementTranscript.tiptapJson}
          onDiskVersionAccepted={() => undefined}
          onDirtyChange={onDirtyChange}
          onSave={saveInlineSegmentSupplementTranscriptMarkdown}
          onSavedContent={onTranscriptSaved}
          panelId={`${panelId}-transcript-editor`}
          placeholder="整理或修正补充录音转录..."
          renderAsPanel={false}
          surfaceTestId="memory-studio-inline-supplement-transcript-editor"
          targetKey={`segment-supplement-transcript:${supplement.segmentId}:${supplement.supplementId}`}
          title={supplement.title}
          editorId={`${panelId}-transcript-inline-editor`}
          editorLabel="补充录音转录正文"
          workspaceSession={workspaceSession}
        />
      ) : (
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
                      transcript: undefined,
                    })
                  )
                : deriveTranscriptOutcome({
                    lastTranscriptionAttempt: supplement.lastTranscriptionAttempt,
                    transcript: undefined,
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
      )}
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
  const safeItemStep = itemStep > 0 ? itemStep : MEMORY_STUDIO_SEGMENT_CARD_ESTIMATE_PX;
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
    : MEMORY_STUDIO_SEGMENT_CARD_ESTIMATE_PX;
}

type InlineMarkdownContentEditorProps<TSaved> = {
  readonly ariaLabelledBy: string;
  readonly attachmentTarget: MarkdownImageAttachmentTarget | null;
  readonly baselineContentHash: string;
  readonly baselineTiptapContentHash?: string | null;
  readonly failureCopy: string;
  readonly headerLabel: string;
  readonly initialMarkdown: string;
  readonly initialTiptapJson?: WorkspaceNoteSegmentContent['bodyTiptapJson'] | null;
  readonly onDiskVersionAccepted: (content: {
    readonly baselineContentHash: string;
    readonly baselineTiptapContentHash: string;
    readonly markdown: string;
    readonly tiptapJson: WorkspaceNoteSegmentContent['bodyTiptapJson'];
  }) => void;
  readonly onDirtyChange: (dirty: boolean) => void;
  readonly onSave: (
    markdown: string,
    baselineContentHash: string,
    tiptapJson: WorkspaceNoteSegmentContent['bodyTiptapJson'] | null,
    baselineTiptapContentHash: string | null
  ) => Promise<FinalizedNoteContentSaveResult<TSaved>>;
  readonly onSavedContent: (saved: TSaved) => void;
  readonly panelId: string;
  readonly renderAsPanel?: boolean;
  readonly placeholder: string;
  readonly surfaceTestId: string;
  readonly targetKey: string;
  readonly title: string;
  readonly editorId: string;
  readonly editorLabel: string;
  readonly workspaceSession: WorkspaceSession;
};

type InlineMarkdownSaveSnapshot = {
  readonly baselineContentHash: string;
  readonly baselineTiptapContentHash: string | null;
  readonly markdown: string;
  readonly tiptapJson: WorkspaceNoteSegmentContent['bodyTiptapJson'] | null;
  readonly tiptapJsonKey: string;
};

function inlineMarkdownSaveSnapshot(state: InlineMarkdownEditorState): InlineMarkdownSaveSnapshot {
  return {
    baselineContentHash: state.activeBaselineContentHash,
    baselineTiptapContentHash: state.activeBaselineTiptapContentHash,
    markdown: state.markdown,
    tiptapJson: state.tiptapJson,
    tiptapJsonKey: state.tiptapJsonKey,
  };
}

function InlineMarkdownContentEditor<TSaved>({
  ariaLabelledBy,
  attachmentTarget,
  baselineContentHash,
  baselineTiptapContentHash = null,
  failureCopy,
  headerLabel,
  initialMarkdown,
  initialTiptapJson = null,
  onDiskVersionAccepted,
  onDirtyChange,
  onSave,
  onSavedContent,
  panelId,
  renderAsPanel = true,
  placeholder,
  surfaceTestId,
  targetKey,
  title,
  editorId,
  editorLabel,
  workspaceSession,
}: InlineMarkdownContentEditorProps<TSaved>) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const editorHandleRef = useRef<LightweightMarkdownEditorHandle | null>(null);
  const loadedTargetKeyRef = useRef(targetKey);
  const workspaceSessionKey = `${workspaceSession.workspaceHandle}\0${workspaceSession.workspaceId}`;
  const latestWorkspaceSessionKeyRef = useRef(workspaceSessionKey);
  const [editorState, dispatchEditorState] = useReducer(
    inlineMarkdownEditorReducer,
    {
      baselineContentHash,
      baselineTiptapContentHash,
      markdown: initialMarkdown,
      tiptapJson: initialTiptapJson,
    },
    createInlineMarkdownEditorState
  );
  const dirty = inlineMarkdownEditorIsDirty(editorState);
  const [expanded, setExpanded] = useState(false);
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const imageAttachment = useMarkdownImageAttachment({
    disabled: editorState.pending,
    editorHandleRef,
    onError: (message) => dispatchEditorState({ type: 'error-set', message }),
    target: attachmentTarget,
    workspaceSession,
  });
  const attachmentContext = useMemo(
    () =>
      createMarkdownAttachmentContext(
        attachmentTarget?.kind === 'segment'
          ? {
              kind: 'segment',
              workspaceId: workspaceSession.workspaceId,
              segmentId: attachmentTarget.segmentId,
            }
          : attachmentTarget?.kind === 'segment-supplement'
            ? {
                kind: 'segment-supplement',
                workspaceId: workspaceSession.workspaceId,
                segmentId: attachmentTarget.segmentId,
                supplementId: attachmentTarget.supplementId,
              }
            : undefined
      ),
    [
      attachmentTarget?.kind,
      attachmentTarget?.segmentId,
      attachmentTarget?.kind === 'segment-supplement' ? attachmentTarget.supplementId : '',
      workspaceSession.workspaceId,
    ]
  );
  const disabled = imageAttachment.pending;

  useEffect(() => {
    if (loadedTargetKeyRef.current !== targetKey) {
      loadedTargetKeyRef.current = targetKey;
      setReturnConfirmOpen(false);
      dispatchEditorState({
        type: 'target-changed',
        baselineContentHash,
        baselineTiptapContentHash,
        markdown: initialMarkdown,
        tiptapJson: initialTiptapJson,
      });
      return;
    }

    dispatchEditorState({
      type: 'input-received',
      baselineContentHash,
      baselineTiptapContentHash,
      markdown: initialMarkdown,
      tiptapJson: initialTiptapJson,
    });
  }, [
    baselineContentHash,
    baselineTiptapContentHash,
    initialMarkdown,
    initialTiptapJson,
    targetKey,
  ]);

  useEffect(() => {
    latestWorkspaceSessionKeyRef.current = workspaceSessionKey;
    setReturnConfirmOpen(false);
    dispatchEditorState({ type: 'workspace-session-changed' });
  }, [workspaceSessionKey]);

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  function blurEditorSurface() {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && surfaceRef.current?.contains(activeElement)) {
      activeElement.blur();
      return;
    }
    editorHandleRef.current?.blur();
  }

  async function saveMarkdown(
    snapshot = inlineMarkdownSaveSnapshot(editorState)
  ): Promise<boolean> {
    if (imageAttachment.pending || editorState.pending) {
      return false;
    }
    flushSync(() => {
      dispatchEditorState({ type: 'autosave-started' });
    });
    const saveWorkspaceSessionKey = workspaceSessionKey;
    try {
      const result = await onSave(
        snapshot.markdown,
        snapshot.baselineContentHash,
        snapshot.tiptapJson,
        snapshot.baselineTiptapContentHash
      );
      if (latestWorkspaceSessionKeyRef.current !== saveWorkspaceSessionKey) {
        dispatchEditorState({ type: 'autosave-stale-session' });
        return false;
      }
      if (result.ok) {
        onSavedContent(result.saved);
        dispatchEditorState({
          type: 'autosave-succeeded',
          markdown: snapshot.markdown,
          tiptapJson: snapshot.tiptapJson,
          tiptapJsonKey: snapshot.tiptapJsonKey,
          ...(result.nextBaselineContentHash
            ? { nextBaselineContentHash: result.nextBaselineContentHash }
            : {}),
          ...(result.nextBaselineTiptapContentHash
            ? { nextBaselineTiptapContentHash: result.nextBaselineTiptapContentHash }
            : {}),
        });
        return true;
      }
      if (result.kind === 'conflict') {
        dispatchEditorState({ type: 'autosave-conflicted', conflict: result.conflict });
        return false;
      }
      dispatchEditorState({ type: 'autosave-failed', message: result.message });
      return false;
    } catch (error) {
      if (latestWorkspaceSessionKeyRef.current !== saveWorkspaceSessionKey) {
        dispatchEditorState({ type: 'autosave-stale-session' });
        return false;
      }
      dispatchEditorState({
        type: 'autosave-failed',
        message: unknownErrorDisplayMessage(error, failureCopy),
      });
      return false;
    }
  }

  useEffect(() => {
    if (
      !dirty ||
      editorState.pending ||
      imageAttachment.pending ||
      editorState.conflict ||
      editorState.errorMessage
    ) {
      return;
    }

    const snapshot = inlineMarkdownSaveSnapshot(editorState);
    const autosaveTimer = window.setTimeout(() => {
      void saveMarkdown(snapshot);
    }, INLINE_MARKDOWN_AUTOSAVE_DELAY_MS);
    return () => {
      window.clearTimeout(autosaveTimer);
    };
  }, [
    dirty,
    editorState.activeBaselineContentHash,
    editorState.activeBaselineTiptapContentHash,
    editorState.conflict,
    editorState.errorMessage,
    editorState.markdown,
    editorState.pending,
    editorState.tiptapJson,
    editorState.tiptapJsonKey,
    imageAttachment.pending,
  ]);

  function cancelMarkdownEdit() {
    if (editorState.diskChangeNoticeVisible) {
      const latestBaselineContentHash = editorState.lastInputBaselineContentHash;
      const latestBaselineTiptapContentHash = editorState.lastInputBaselineTiptapContentHash;
      if (inlineMarkdownEditorHasUnacceptedDiskVersion(editorState)) {
        const latestMarkdown = editorState.lastInputMarkdown;
        blurEditorSurface();
        dispatchEditorState({
          type: 'disk-version-accepted',
          baselineContentHash: latestBaselineContentHash,
          baselineTiptapContentHash: latestBaselineTiptapContentHash,
          markdown: latestMarkdown,
          tiptapJson: editorState.lastInputTiptapJson,
        });
        if (editorState.lastInputTiptapJson && latestBaselineTiptapContentHash) {
          onDiskVersionAccepted({
            baselineContentHash: latestBaselineContentHash,
            baselineTiptapContentHash: latestBaselineTiptapContentHash,
            markdown: latestMarkdown,
            tiptapJson: editorState.lastInputTiptapJson,
          });
        }
        return;
      }
    }

    blurEditorSurface();
    dispatchEditorState({ type: 'cancel-clean' });
  }

  function requestReturnFromExpandedEditor() {
    if (disabled) {
      return;
    }
    if (dirty) {
      setReturnConfirmOpen(true);
      return;
    }
    setExpanded(false);
  }

  function discardMarkdownAndReturn() {
    cancelMarkdownEdit();
    setReturnConfirmOpen(false);
    setExpanded(false);
  }

  async function saveMarkdownAndReturn() {
    const saved = await saveMarkdown();
    setReturnConfirmOpen(false);
    if (saved) {
      setExpanded(false);
    }
  }

  const expandedDialogLayer: WorkspaceModalLayer = expanded ? 'immersive' : 'default';

  return (
    <>
      <EditorExpandShell
        ariaLabelledBy={ariaLabelledBy}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onReturn={requestReturnFromExpandedEditor}
        panelId={panelId}
        pending={disabled}
        renderAsPanel={renderAsPanel}
        title={title}
      >
        <LightweightMarkdownEditorSurface
          attachmentContext={attachmentContext}
          bordered={!expanded}
          disabled={disabled}
          editorHandleRef={editorHandleRef}
          headerLabel={headerLabel}
          notice={
            editorState.errorMessage ??
            (editorState.diskChangeNoticeVisible ? '磁盘内容已变化。保存时将进行冲突检查。' : null)
          }
          onChange={(nextMarkdown) =>
            dispatchEditorState({ type: 'markdown-changed', markdown: nextMarkdown })
          }
          onRichChange={({ markdown, tiptapJson, tiptapJsonKey }) =>
            dispatchEditorState({
              type: 'markdown-changed',
              markdown,
              tiptapJson,
              tiptapJsonKey,
            })
          }
          onDragOver={imageAttachment.handleDragOver}
          onDrop={imageAttachment.handleDrop}
          onAttachmentUpload={imageAttachment.uploadFile}
          onPaste={imageAttachment.handlePaste}
          placeholder={placeholder}
          readableWidth
          showHeaderLabel={false}
          surfaceRef={surfaceRef}
          surfaceTestId={surfaceTestId}
          editorId={editorId}
          editorLabel={editorLabel}
          editorTargetKey={targetKey}
          toolbarDisabled={disabled}
          value={editorState.markdown}
          valueTiptapJson={editorState.tiptapJson ?? undefined}
        />
      </EditorExpandShell>
      <AlertDialog
        open={returnConfirmOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && disabled) {
            return;
          }
          setReturnConfirmOpen(nextOpen);
        }}
      >
        <WorkspaceCompactAlertDialogContent modalLayer={expandedDialogLayer}>
          <AlertDialogHeader>
            <AlertDialogTitle>保存未完成的修改？</AlertDialogTitle>
            <AlertDialogDescription>
              返回前可以保存当前修改，或放弃未保存内容。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="secondary" disabled={disabled}>
                继续编辑
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={disabled}
                onClick={(event) => {
                  event.preventDefault();
                  discardMarkdownAndReturn();
                }}
              >
                放弃修改
              </Button>
            </AlertDialogAction>
            <AlertDialogAction asChild>
              <Button
                type="button"
                disabled={disabled}
                onClick={(event) => {
                  event.preventDefault();
                  void saveMarkdownAndReturn();
                }}
              >
                保存并返回
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </WorkspaceCompactAlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={editorState.conflict !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            dispatchEditorState({ type: 'conflict-dismissed' });
          }
        }}
      >
        <WorkspaceAlertDialogContent modalLayer={expandedDialogLayer}>
          <AlertDialogHeader>
            <AlertDialogTitle>外部修改已检测</AlertDialogTitle>
            <AlertDialogDescription>
              磁盘内容已变化。请选择保留当前编辑，或使用磁盘版本。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={editorState.pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={editorState.pending || !editorState.conflict}
              onClick={() => {
                if (!editorState.conflict) {
                  return;
                }
                dispatchEditorState({
                  type: 'disk-version-accepted',
                  baselineContentHash: editorState.conflict.currentBaselineContentHash,
                  baselineTiptapContentHash: editorState.conflict.currentBaselineTiptapContentHash,
                  markdown: editorState.conflict.currentBodyMarkdown,
                  tiptapJson: editorState.conflict.currentBodyTiptapJson,
                });
                onDiskVersionAccepted({
                  baselineContentHash: editorState.conflict.currentBaselineContentHash,
                  baselineTiptapContentHash: editorState.conflict.currentBaselineTiptapContentHash,
                  markdown: editorState.conflict.currentBodyMarkdown,
                  tiptapJson: editorState.conflict.currentBodyTiptapJson,
                });
              }}
            >
              使用磁盘版本
            </AlertDialogAction>
            <AlertDialogAction
              disabled={editorState.pending || !editorState.conflict}
              onClick={() => {
                if (!editorState.conflict) {
                  return;
                }
                const nextBaselineContentHash = editorState.conflict.currentBaselineContentHash;
                const nextBaselineTiptapContentHash =
                  editorState.conflict.currentBaselineTiptapContentHash;
                dispatchEditorState({ type: 'conflict-dismissed' });
                void saveMarkdown({
                  ...inlineMarkdownSaveSnapshot(editorState),
                  baselineContentHash: nextBaselineContentHash,
                  baselineTiptapContentHash: nextBaselineTiptapContentHash,
                });
              }}
            >
              保留我的修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </WorkspaceAlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SegmentSupplementNotePanel({
  ariaLabelledBy,
  audioResourceCache,
  onDiskVersionAccepted,
  onDirtyChange = () => undefined,
  onSaveEdit,
  onSavedContent = () => undefined,
  panelId,
  supplement,
  supplementContent,
  supplementContentError,
  supplementContentLoading,
  workspaceSession,
}: {
  readonly ariaLabelledBy: string;
  readonly audioResourceCache: Map<string, SegmentSupplementAudioResource>;
  readonly onDiskVersionAccepted?: (content: {
    readonly baselineContentHash: string;
    readonly baselineTiptapContentHash: string;
    readonly markdown: string;
    readonly tiptapJson: WorkspaceNoteSegmentSupplementContent['bodyTiptapJson'];
  }) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly onSaveEdit?: (
    markdown: string,
    baselineContentHash: string,
    tiptapJson: WorkspaceNoteSegmentSupplementContent['bodyTiptapJson'] | null,
    baselineTiptapContentHash: string | null
  ) => Promise<FinalizedNoteContentSaveResult<SavedNoteSegmentSupplementContent>>;
  readonly onSavedContent?: (saved: SavedNoteSegmentSupplementContent) => void;
  readonly panelId: string;
  readonly supplement: NoteMemorySegmentSupplement;
  readonly supplementContent?: WorkspaceNoteSegmentSupplementContent | undefined;
  readonly supplementContentError: boolean;
  readonly supplementContentLoading: boolean;
  readonly workspaceSession: WorkspaceSession;
}) {
  if (supplementContent && onSaveEdit) {
    return (
      <>
        <SegmentSupplementNoteSpeechPlayer
          audioResourceCache={audioResourceCache}
          content={supplementContent}
          loading={supplementContentLoading}
          supplement={supplement}
          workspaceSession={workspaceSession}
        />
        <InlineMarkdownContentEditor<SavedNoteSegmentSupplementContent>
          ariaLabelledBy={ariaLabelledBy}
          attachmentTarget={{
            kind: 'segment-supplement',
            memoryId: supplement.memoryId,
            segmentId: supplement.segmentId,
            supplementId: supplement.supplementId,
          }}
          baselineContentHash={supplementContent.baselineContentHash}
          baselineTiptapContentHash={supplementContent.baselineTiptapContentHash}
          failureCopy="无法保存补充笔记正文。"
          headerLabel="Markdown 补充笔记"
          initialMarkdown={supplementContent.bodyMarkdown}
          initialTiptapJson={supplementContent.bodyTiptapJson}
          onDiskVersionAccepted={onDiskVersionAccepted ?? (() => undefined)}
          onDirtyChange={onDirtyChange}
          onSave={onSaveEdit}
          onSavedContent={onSavedContent}
          panelId={panelId}
          placeholder="写下补充笔记..."
          surfaceTestId="memory-studio-inline-supplement-note-editor"
          targetKey={`segment-supplement:${supplement.segmentId}:${supplement.supplementId}`}
          title={supplement.title}
          editorId={`${panelId}-inline-editor`}
          editorLabel="补充笔记正文"
          workspaceSession={workspaceSession}
        />
      </>
    );
  }

  return (
    <MarkdownContentSurface
      ariaLabelledBy={ariaLabelledBy}
      attachmentContext={{
        kind: 'segment-supplement',
        workspaceId: workspaceSession.workspaceId,
        segmentId: supplement.segmentId,
        supplementId: supplement.supplementId,
      }}
      bodyMarkdown={supplementContentError ? undefined : supplementContent?.bodyMarkdown}
      className="mt-12"
      id={panelId}
      loading={supplementContentLoading}
      role="tabpanel"
      showTitle={false}
      emptyCopy="这条补充笔记还没有正文。"
      title={supplement.title}
    />
  );
}

export function MemoryStudio({
  audioResourceCaches,
  memory,
  onDeleteSegment,
  onDeleteSegmentSupplement,
  onClearSegmentContent,
  onSegmentTranscriptSaved,
  onSegmentSupplementTranscriptSaved,
  onNoteSegmentContentSaved,
  onNoteSegmentSupplementContentSaved,
  onRenameSegmentSupplement,
  onRenameSegmentContent,
  onResetSegmentCover,
  onSwitchSegmentDefaultCover,
  onRenameSegment,
  speechSynthesis,
  transcriptionBackfill,
  onInlineMarkdownDirtyChange,
  onSegmentFocusConsumed,
  onStartSegmentSupplementNote,
  onStartSegmentSupplementRecording,
  segmentFocusIntent = null,
  workspaceSession,
}: MemoryStudioProps) {
  const queryClient = useQueryClient();
  const latestWorkspaceSessionRef = useRef(workspaceSession);
  const segmentAudioResourceCache = audioResourceCaches.segment;
  const supplementAudioResourceCache = audioResourceCaches.supplement;
  const [supplementMenuOpen, setSupplementMenuOpen] = useState(false);
  const [primaryContentMenuOpen, setPrimaryContentMenuOpen] = useState(false);
  const [primaryContentActionsVisible, setPrimaryContentActionsVisible] = useState(false);
  const [openSupplementActionMenuId, setOpenSupplementActionMenuId] = useState<string | null>(null);
  const [hoveredSupplementActionId, setHoveredSupplementActionId] = useState<string | null>(null);
  const [openSegmentMenuId, setOpenSegmentMenuId] = useState<string | null>(null);
  const stripScrollRef = useRef<HTMLDivElement | null>(null);
  const segmentStripItemStepRef = useRef(MEMORY_STUDIO_SEGMENT_CARD_ESTIMATE_PX);
  const [activeContentTab, setActiveContentTab] = useState<ActiveContentTab>('transcript');
  const [inlineMarkdownDirty, setInlineMarkdownDirty] = useState(false);
  const [confirmingTranscriptionBackfill, setConfirmingTranscriptionBackfill] =
    useState<TranscriptionConfirmIntent | null>(null);
  const [contentTabOrderBySegmentId, setContentTabOrderBySegmentId] = useState<
    Record<string, readonly ActiveContentTab[]>
  >({});
  const contentTabOrderBySegmentIdRef = useRef<Record<string, readonly ActiveContentTab[]>>({});
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

  useEffect(() => {
    latestWorkspaceSessionRef.current = workspaceSession;
  }, [workspaceSession]);

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const detailQuery = useQuery(memoryDetailQueryOptions(workspaceSession, memory.memoryId));
  const detail = detailQuery.data?.detail;
  const allSegments = detail?.segments ?? [];
  const visibleSegments = allSegments;
  const selectedSegmentResolution = useMemo(() => {
    let firstSegment: MemorySegment | null = null;
    for (let index = 0; index < visibleSegments.length; index += 1) {
      const segment = visibleSegments[index];
      if (!segment) {
        continue;
      }
      firstSegment ??= segment;
      if (segment.segmentId === selectedSegmentId) {
        return { index, segment };
      }
    }
    return { index: firstSegment ? 0 : -1, segment: firstSegment };
  }, [visibleSegments, selectedSegmentId]);
  const selectedSegment = selectedSegmentResolution.segment;
  const selectedSegmentIndex = selectedSegmentResolution.index;
  const retrySelectedSegmentTranscription =
    selectedSegment && isAudioMemorySegment(selectedSegment) && transcriptionBackfill?.retrySegment
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
    isAudioMemorySegment(selectedSegment) &&
    transcriptionBackfill?.isSegmentRunning?.({
      workspaceId: workspaceSession.workspaceId,
      memoryId: memory.memoryId,
      segmentId: selectedSegment.segmentId,
    }) === true;
  const segmentContentQuery = useQuery({
    ...segmentContentQueryOptions(
      workspaceSession,
      memory.memoryId,
      selectedSegment?.segmentId ?? 'seg_pending',
      selectedSegment?.type ?? 'audio'
    ),
    enabled: selectedSegment !== null,
  });
  const segmentContent = selectedSegment ? segmentContentQuery.data : undefined;
  const noteSegmentContent =
    selectedSegment && isNoteMemorySegment(selectedSegment) && isNoteSegmentContent(segmentContent)
      ? segmentContent
      : undefined;
  const selectedSegmentSupplements = useMemo(
    () => selectedSegment?.supplements ?? [],
    [selectedSegment]
  );
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
  const activeNoteSupplementContentQuery = useQuery({
    ...segmentSupplementContentQueryOptions(
      workspaceSession,
      activeSegmentSupplement?.memoryId ?? memory.memoryId,
      activeSegmentSupplement?.segmentId ?? selectedSegment?.segmentId ?? 'seg_pending',
      activeSegmentSupplement?.supplementId ?? 'sup_pending',
      'note'
    ),
    enabled:
      activeSegmentSupplement !== null && isNoteMemorySegmentSupplement(activeSegmentSupplement),
  });
  const activeNoteSupplementContent =
    activeSegmentSupplement &&
    isNoteMemorySegmentSupplement(activeSegmentSupplement) &&
    isNoteSegmentSupplementContent(activeNoteSupplementContentQuery.data)
      ? activeNoteSupplementContentQuery.data
      : undefined;

  useEffect(() => {
    onInlineMarkdownDirtyChange?.(inlineMarkdownDirty);
    return () => onInlineMarkdownDirtyChange?.(false);
  }, [inlineMarkdownDirty, onInlineMarkdownDirtyChange]);

  function blockDirtyInlineMarkdownNavigation() {
    if (!inlineMarkdownDirty) {
      return false;
    }
    showReoToast({ type: 'error', title: INLINE_MARKDOWN_UNSAVED_MESSAGE });
    return true;
  }

  function savedContentBelongsToCurrentSession(saved: {
    readonly expectedSession: WorkspaceSession;
  }) {
    const latestWorkspaceSession = latestWorkspaceSessionRef.current;
    return (
      saved.expectedSession.workspaceHandle === latestWorkspaceSession.workspaceHandle &&
      saved.expectedSession.workspaceId === latestWorkspaceSession.workspaceId
    );
  }

  function handleSavedNoteSegmentContent(saved: SavedNoteSegmentContent) {
    if (savedContentBelongsToCurrentSession(saved)) {
      onNoteSegmentContentSaved(saved);
    }
  }

  function handleSavedNoteSegmentSupplementContent(saved: SavedNoteSegmentSupplementContent) {
    if (savedContentBelongsToCurrentSession(saved)) {
      onNoteSegmentSupplementContentSaved(saved);
    }
  }

  function invalidateSegmentContent(targetSegment: MemorySegment | null) {
    if (targetSegment === null) {
      return;
    }
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: segmentContentQueryKey({
        workspaceId: workspaceSession.workspaceId,
        workspaceHandle: workspaceSession.workspaceHandle,
        memoryId: targetSegment.memoryId,
        segmentId: targetSegment.segmentId,
      }),
      refetchType: 'active',
    });
  }

  function invalidateSupplementContent(targetSupplement: MemorySegmentSupplement | null) {
    if (targetSupplement === null) {
      return;
    }
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: segmentSupplementContentQueryKey({
        workspaceId: workspaceSession.workspaceId,
        workspaceHandle: workspaceSession.workspaceHandle,
        memoryId: targetSupplement.memoryId,
        segmentId: targetSupplement.segmentId,
        supplementId: targetSupplement.supplementId,
      }),
      refetchType: 'active',
    });
  }

  function requestSelectedSegment(segmentId: string) {
    const targetSegment = visibleSegments.find((segment) => segment.segmentId === segmentId);
    if (selectedSegment?.segmentId === segmentId) {
      if (!inlineMarkdownDirty) {
        invalidateSegmentContent(targetSegment ?? null);
      }
      return true;
    }
    if (blockDirtyInlineMarkdownNavigation()) {
      return false;
    }
    setSelectedSegmentId(segmentId);
    return true;
  }

  function requestActiveContentTab(nextTab: ActiveContentTab) {
    const nextSupplementId = supplementIdFromContentTab(nextTab);
    const targetSupplement =
      nextSupplementId === null
        ? null
        : (selectedSegmentSupplementById.get(nextSupplementId) ?? null);
    if (resolvedActiveContentTab === nextTab) {
      if (!inlineMarkdownDirty) {
        if (nextSupplementId === null) {
          invalidateSegmentContent(selectedSegment);
        } else {
          invalidateSupplementContent(targetSupplement);
        }
      }
      return true;
    }
    if (blockDirtyInlineMarkdownNavigation()) {
      return false;
    }
    setActiveContentTab(nextTab);
    return true;
  }

  function requestStartSupplementRecording() {
    if (!selectedSegment || blockDirtyInlineMarkdownNavigation()) {
      return;
    }
    setSupplementMenuOpen(false);
    onStartSegmentSupplementRecording({
      memoryId: memory.memoryId,
      segmentId: selectedSegment.segmentId,
      title: `补充录音${selectedSegment.supplementCount + 1}`,
    });
  }

  function requestStartSupplementNote() {
    if (!selectedSegment || blockDirtyInlineMarkdownNavigation()) {
      return;
    }
    setSupplementMenuOpen(false);
    onStartSegmentSupplementNote?.({
      memoryId: memory.memoryId,
      segmentId: selectedSegment.segmentId,
      title: `补充笔记${selectedSegment.supplementCount + 1}`,
    });
  }

  async function saveInlineNoteSegmentMarkdown({
    baselineContentHash,
    baselineTiptapContentHash,
    markdown,
    segment,
    tiptapJson,
  }: {
    readonly baselineContentHash: string;
    readonly baselineTiptapContentHash: string | null;
    readonly markdown: string;
    readonly segment: NoteMemorySegment;
    readonly tiptapJson: WorkspaceNoteSegmentContent['bodyTiptapJson'] | null;
  }): Promise<FinalizedNoteContentSaveResult<SavedNoteSegmentContent>> {
    const result = await saveFinalizedNoteSegmentContent({
      workspaceSession,
      memoryId: segment.memoryId,
      segmentId: segment.segmentId,
      title: segment.title,
      bodyMarkdown: markdown,
      bodyTiptapJson: tiptapJson,
      baselineContentHash,
      baselineTiptapContentHash,
    });
    return result;
  }

  async function saveInlineSegmentTranscriptMarkdown({
    baselineTranscriptHash,
    baselineTiptapContentHash,
    markdown,
    segment,
    tiptapJson,
  }: {
    readonly baselineTranscriptHash: string;
    readonly baselineTiptapContentHash: string | null;
    readonly markdown: string;
    readonly segment: AudioMemorySegment;
    readonly tiptapJson: WorkspaceNoteSegmentContent['bodyTiptapJson'] | null;
  }): Promise<FinalizedNoteContentSaveResult<SavedSegmentTranscriptContent>> {
    const response = await saveTranscript({
      workspaceHandle: workspaceSession.workspaceHandle,
      memoryId: segment.memoryId,
      segmentId: segment.segmentId,
      markdown,
      baselineTranscriptHash,
      ...(tiptapJson ? { tiptapJson } : {}),
      ...(baselineTiptapContentHash ? { baselineTiptapContentHash } : {}),
    });
    if (!response.ok) {
      return {
        ok: false,
        kind: 'error',
        message: workspaceErrorDisplayMessage(response.error, '无法保存转录。'),
      };
    }

    return {
      ok: true,
      nextBaselineContentHash: response.value.baselineTranscriptHash,
      nextBaselineTiptapContentHash: response.value.baselineTiptapContentHash,
      saved: {
        expectedSession: workspaceSession,
        baselineTranscriptHash: response.value.baselineTranscriptHash,
        baselineTiptapContentHash: response.value.baselineTiptapContentHash,
        memory: response.value.memory,
        memoryId: segment.memoryId,
        segmentId: segment.segmentId,
      },
    };
  }

  async function saveInlineNoteSupplementMarkdown({
    baselineContentHash,
    baselineTiptapContentHash,
    markdown,
    supplement,
    tiptapJson,
  }: {
    readonly baselineContentHash: string;
    readonly baselineTiptapContentHash: string | null;
    readonly markdown: string;
    readonly supplement: NoteMemorySegmentSupplement;
    readonly tiptapJson: WorkspaceNoteSegmentSupplementContent['bodyTiptapJson'] | null;
  }): Promise<FinalizedNoteContentSaveResult<SavedNoteSegmentSupplementContent>> {
    const result = await saveFinalizedNoteSegmentSupplementContent({
      workspaceSession,
      memoryId: supplement.memoryId,
      segmentId: supplement.segmentId,
      supplementId: supplement.supplementId,
      title: supplement.title,
      bodyMarkdown: markdown,
      bodyTiptapJson: tiptapJson,
      baselineContentHash,
      baselineTiptapContentHash,
    });
    return result;
  }

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
      title: transcriptContentTabTitle(selectedSegment),
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
    const persistedOrder = selectedSegment?.contentTabOrder?.map(contentTabValueFromPersisted);
    const pendingOrder = selectedSegment
      ? contentTabOrderBySegmentId[selectedSegment.segmentId]
      : undefined;
    const orderedTabs: readonly MemoryStudioContentTab[] = selectedSegment
      ? orderContentTabs(unorderedTabs, pendingOrder ?? persistedOrder)
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
        visibleSegments.length,
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
  }, [visibleSegments.length]);

  useEffect(() => {
    if (visibleSegments.length === 0) {
      setSegmentStripWindowRange({ start: 0, end: 0 });
      return;
    }
    if (selectedSegmentIndex < 0) {
      setSegmentStripWindowRange((currentRange) =>
        clampSegmentStripWindowRange(currentRange, visibleSegments.length)
      );
      return;
    }
    setSegmentStripWindowRange((currentRange) => {
      if (
        selectedSegmentIndex >= currentRange.start &&
        selectedSegmentIndex < currentRange.end &&
        currentRange.end <= visibleSegments.length
      ) {
        return currentRange;
      }
      return segmentStripWindowAroundIndex(selectedSegmentIndex, visibleSegments.length);
    });
  }, [visibleSegments.length, selectedSegmentIndex]);

  useEffect(() => {
    if (!segmentFocusIntent) {
      return;
    }
    if (!visibleSegments.some((segment) => segment.segmentId === segmentFocusIntent)) {
      return;
    }

    if (selectedSegment?.segmentId !== segmentFocusIntent && blockDirtyInlineMarkdownNavigation()) {
      return;
    }
    setSelectedSegmentId(segmentFocusIntent);
    onSegmentFocusConsumed?.(segmentFocusIntent);
  }, [
    inlineMarkdownDirty,
    onSegmentFocusConsumed,
    segmentFocusIntent,
    selectedSegment?.segmentId,
    visibleSegments,
  ]);

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
    if (addedSupplementId && !inlineMarkdownDirty) {
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
  }, [inlineMarkdownDirty, selectedSegment?.segmentId, selectedSegmentSupplementIdsKey]);

  useEffect(() => {
    setSupplementMenuOpen(false);
    setPrimaryContentMenuOpen(false);
    setPrimaryContentActionsVisible(false);
    setOpenSupplementActionMenuId(null);
    setHoveredSupplementActionId(null);
    draggedContentTabRef.current = null;
    setDraggedContentTab(null);
    setActiveContentTab('transcript');
    setInlineMarkdownDirty(false);
    setConfirmingTranscriptionBackfill(null);
  }, [selectedSegment?.segmentId]);

  useEffect(() => {
    setInlineMarkdownDirty(false);
  }, [resolvedActiveContentTab]);

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
    const liveSegmentIds = new Set(allSegments.map((segment) => segment.segmentId));
    const liveSupplementKeys = new Set(
      allSegments.flatMap((segment) =>
        segment.supplements.map((supplement) => `${segment.segmentId}\0${supplement.supplementId}`)
      )
    );

    pruneMemoryStudioAudioResources(
      segmentAudioResourceCache,
      (resource) =>
        resource.workspaceHandle !== workspaceSession.workspaceHandle ||
        resource.workspaceId !== workspaceSession.workspaceId ||
        resource.memoryId !== memory.memoryId ||
        liveSegmentIds.has(resource.segmentId)
    );
    pruneMemoryStudioAudioResources(
      supplementAudioResourceCache,
      (resource) =>
        resource.workspaceHandle !== workspaceSession.workspaceHandle ||
        resource.workspaceId !== workspaceSession.workspaceId ||
        resource.memoryId !== memory.memoryId ||
        (resource.supplementId !== undefined &&
          liveSupplementKeys.has(`${resource.segmentId}\0${resource.supplementId}`))
    );
  }, [
    allSegments,
    memory.memoryId,
    segmentAudioResourceCache,
    supplementAudioResourceCache,
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

    if (requestActiveContentTab(nextTab.value)) {
      window.requestAnimationFrame(() => document.getElementById(nextTab.tabId)?.focus());
    }
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
      const currentPersistedOrder = selectedSegment.contentTabOrder?.map(
        contentTabValueFromPersisted
      );
      const currentOrderedValues = orderContentTabs(
        baseContentTabs,
        currentOrderBySegmentId[segmentId] ?? currentPersistedOrder
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

      const nextOrderBySegmentId = {
        ...currentOrderBySegmentId,
        [segmentId]: nextCurrentValues,
      };
      contentTabOrderBySegmentIdRef.current = nextOrderBySegmentId;
      return nextOrderBySegmentId;
    });
  }

  function clearPendingContentTabOrder(segmentId: string) {
    if (!(segmentId in contentTabOrderBySegmentIdRef.current)) {
      return;
    }
    const remainingOrders = { ...contentTabOrderBySegmentIdRef.current };
    delete remainingOrders[segmentId];
    contentTabOrderBySegmentIdRef.current = remainingOrders;
    setContentTabOrderBySegmentId((currentOrderBySegmentId) => {
      if (!(segmentId in currentOrderBySegmentId)) {
        return currentOrderBySegmentId;
      }
      const remaining = { ...currentOrderBySegmentId };
      delete remaining[segmentId];
      return remaining;
    });
  }

  function seedContentTabOrderResult(value: {
    readonly memory: WorkspaceMemorySummary;
    readonly segment: MemorySegment;
  }) {
    queryClient.setQueryData<WorkspaceSnapshot>(
      workspaceSnapshotQueryKey(workspaceSession),
      (currentSnapshot) =>
        currentSnapshot
          ? {
              ...currentSnapshot,
              memories: currentSnapshot.memories.map((candidate) =>
                candidate.memoryId === value.memory.memoryId ? value.memory : candidate
              ),
            }
          : currentSnapshot
    );
    queryClient.setQueryData<{
      readonly requestId: string;
      readonly detail: WorkspaceMemoryDetail;
    }>(
      memoryDetailQueryKey({
        workspaceId: workspaceSession.workspaceId,
        memoryId: memory.memoryId,
      }),
      (currentDetail) =>
        currentDetail
          ? {
              ...currentDetail,
              detail: {
                ...currentDetail.detail,
                ...value.memory,
                workspaceId: currentDetail.detail.workspaceId,
                segments: currentDetail.detail.segments.map((segment) =>
                  segment.segmentId === value.segment.segmentId ? value.segment : segment
                ),
              },
            }
          : currentDetail
    );
  }

  function commitContentTabOrder(segmentId: string) {
    const pendingOrder = contentTabOrderBySegmentIdRef.current[segmentId];
    if (!selectedSegment || selectedSegment.segmentId !== segmentId || !pendingOrder) {
      return;
    }

    const projectedOrder = selectedSegment.contentTabOrder?.map(contentTabValueFromPersisted) ?? [];
    if (pendingOrder.join('\0') === projectedOrder.join('\0')) {
      clearPendingContentTabOrder(segmentId);
      return;
    }

    const contentTabOrder = pendingOrder.map(persistedContentTabValue);
    void updateSegmentContentTabOrder({
      workspaceHandle: workspaceSession.workspaceHandle,
      workspaceId: workspaceSession.workspaceId,
      memoryId: selectedSegment.memoryId,
      segmentId,
      contentTabOrder,
    })
      .then((response) => {
        if (!response.ok) {
          showReoToast({
            type: 'error',
            title: '无法保存片段内容顺序',
            description: workspaceErrorDisplayMessage(response.error, '无法保存片段内容顺序。'),
          });
          return;
        }
        seedContentTabOrderResult(response.value);
      })
      .catch((error: unknown) => {
        showReoToast({
          type: 'error',
          title: '无法保存片段内容顺序',
          description: unknownErrorDisplayMessage(error, '无法保存片段内容顺序。'),
        });
      })
      .finally(() => {
        clearPendingContentTabOrder(segmentId);
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
    const draggedTab = draggedContentTabRef.current;
    if (draggedTab) {
      commitContentTabOrder(draggedTab.segmentId);
    }
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
        data-slot="memory-studio-layout"
        className="flex h-full min-h-0 w-full flex-col overflow-hidden text-left"
      >
        {detail && visibleSegments.length === 0 ? (
          <div className="mt-32 max-w-[420px]">
            <p className="text-body-lg font-medium leading-body-lg text-foreground">
              这条记忆还没有片段
            </p>
            <p className="mt-8 text-body leading-body text-muted-foreground">
              继续在这条记忆里记录。
            </p>
          </div>
        ) : detail && visibleSegments.length > 0 && selectedSegment ? (
          <>
            <section
              aria-label="片段预览流"
              className="relative min-w-0 shrink-0 pt-4"
              style={MEMORY_STUDIO_SEGMENT_STRIP_STYLE}
            >
              {stripScrollState.canScrollLeft ? (
                <div
                  className={`pointer-events-none absolute left-0 ${MEMORY_STUDIO_SEGMENT_CARD_AXIS_TOP_CLASS} z-10`}
                >
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
                className="edge-fade-x flex snap-x gap-12 overflow-x-auto px-0 pb-0 pt-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {segmentStripWindowRange.start > 0 ? (
                  <div
                    aria-hidden="true"
                    data-slot="memory-studio-segment-strip-spacer"
                    className="min-w-0 shrink-0"
                    style={memoryStudioSegmentStripSpacerStyle(segmentStripWindowRange.start)}
                  />
                ) : null}
                {visibleSegments
                  .slice(segmentStripWindowRange.start, segmentStripWindowRange.end)
                  .map((segment) => {
                    const segmentIsAudio = isAudioMemorySegment(segment);
                    const isSelected = segment.segmentId === selectedSegment.segmentId;
                    const segmentSpeechSynthesisProjection =
                      !segmentIsAudio && isSelected
                        ? noteSegmentContent?.speechSynthesis
                        : undefined;
                    const segmentTranscriptionRunning =
                      segmentIsAudio &&
                      transcriptionBackfill?.isSegmentRunning?.({
                        workspaceId: workspaceSession.workspaceId,
                        memoryId: memory.memoryId,
                        segmentId: segment.segmentId,
                      }) === true;
                    const segmentTranscriptionDisabledReason = transcriptionBackfillDisabledReason({
                      baseReason: transcriptionBackfill?.disabledReason,
                      running: segmentTranscriptionRunning,
                    });
                    const requestSegmentTranscriptionBackfill =
                      segmentIsAudio && transcriptionBackfill?.retrySegment
                        ? () => {
                            setOpenSegmentMenuId(null);
                            if (segment.transcript.exists) {
                              setConfirmingTranscriptionBackfill({
                                kind: 'segment',
                                memoryId: memory.memoryId,
                                segmentId: segment.segmentId,
                                title: transcriptContentTabTitle(segment),
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
                    const segmentSpeechSynthesisRunning =
                      !segmentIsAudio &&
                      speechSynthesis?.isSegmentRunning?.({
                        workspaceId: workspaceSession.workspaceId,
                        memoryId: memory.memoryId,
                        segmentId: segment.segmentId,
                      }) === true;
                    const segmentSpeechSynthesisDisabledReason = !segmentIsAudio
                      ? noteSpeechSynthesisDisabledReason({
                          baseReason: speechSynthesis?.disabledReason,
                          dirty: inlineMarkdownDirty,
                          running: segmentSpeechSynthesisRunning,
                          speechSynthesis: segmentSpeechSynthesisProjection,
                        })
                      : null;
                    const requestSegmentSpeechSynthesis =
                      !segmentIsAudio && speechSynthesis?.requestSegment
                        ? (speaker: VoiceSpeechSynthesisSpeaker) => {
                            setOpenSegmentMenuId(null);
                            void speechSynthesis.requestSegment?.({
                              workspaceId: workspaceSession.workspaceId,
                              memoryId: memory.memoryId,
                              segmentId: segment.segmentId,
                              mode: 'regenerate',
                              speaker,
                            });
                          }
                        : undefined;
                    return (
                      <MemoryStudioSegmentCard
                        key={segment.segmentId}
                        actionMenu={
                          <SegmentActionsMenu
                            actionIdentity={{
                              memoryId: memory.memoryId,
                              segmentId: segment.segmentId,
                              workspaceHandle: workspaceSession.workspaceHandle,
                              workspaceId: workspaceSession.workspaceId,
                            }}
                            contentAlign="end"
                            cover={segment.cover}
                            onDelete={() => {
                              setOpenSegmentMenuId(null);
                              onDeleteSegment({ memoryId: memory.memoryId, segment });
                            }}
                            onOpenChange={(open) =>
                              setOpenSegmentMenuId(open ? segment.segmentId : null)
                            }
                            onRequestSpeechSynthesis={requestSegmentSpeechSynthesis}
                            onRequestTranscriptionBackfill={requestSegmentTranscriptionBackfill}
                            onRename={() => {
                              setOpenSegmentMenuId(null);
                              onRenameSegment({ memoryId: memory.memoryId, segment });
                            }}
                            onResetCover={() => {
                              setOpenSegmentMenuId(null);
                              onResetSegmentCover({ memoryId: memory.memoryId, segment });
                            }}
                            onSwitchDefaultCover={() => {
                              setOpenSegmentMenuId(null);
                              onSwitchSegmentDefaultCover({ memoryId: memory.memoryId, segment });
                            }}
                            open={openSegmentMenuId === segment.segmentId}
                            segmentTitle={segment.title}
                            speechSynthesisDisabledReason={segmentSpeechSynthesisDisabledReason}
                            transcriptExists={segmentIsAudio ? segment.transcript.exists : false}
                            transcriptionBackfillDisabledReason={segmentTranscriptionDisabledReason}
                            trigger={
                              <MemoryStudioSegmentCardActionButton segmentTitle={segment.title} />
                            }
                            triggerLabel={`片段 ${segment.title} 更多操作`}
                          />
                        }
                        menuOpen={openSegmentMenuId === segment.segmentId}
                        onSelect={() => requestSelectedSegment(segment.segmentId)}
                        segment={segment}
                        selected={isSelected}
                        workspaceId={workspaceSession.workspaceId}
                      />
                    );
                  })}
                {segmentStripWindowRange.end < visibleSegments.length ? (
                  <div
                    aria-hidden="true"
                    data-slot="memory-studio-segment-strip-spacer"
                    className="min-w-0 shrink-0"
                    style={memoryStudioSegmentStripSpacerStyle(
                      visibleSegments.length - segmentStripWindowRange.end
                    )}
                  />
                ) : null}
              </div>
              {stripScrollState.canScrollRight ? (
                <div
                  className={`pointer-events-none absolute right-0 ${MEMORY_STUDIO_SEGMENT_CARD_AXIS_TOP_CLASS} z-10`}
                >
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
              className="flex min-h-0 flex-1 flex-col"
            >
              {isAudioMemorySegment(selectedSegment) ? (
                <SegmentAudioPlayer
                  audioResourceCache={segmentAudioResourceCache}
                  content={isAudioSegmentContent(segmentContent) ? segmentContent : undefined}
                  loading={segmentContentQuery.isLoading}
                  segment={selectedSegment}
                  workspaceSession={workspaceSession}
                />
              ) : (
                <SegmentNoteSpeechPlayer
                  audioResourceCache={segmentAudioResourceCache}
                  content={noteSegmentContent}
                  loading={segmentContentQuery.isLoading}
                  segment={selectedSegment}
                  workspaceSession={workspaceSession}
                />
              )}

              <div
                data-slot="memory-studio-content-tab-rail-row"
                className="mt-12 flex shrink-0 items-center justify-start gap-8"
              >
                <div
                  role="tablist"
                  aria-label="片段内容类型"
                  data-slot="memory-studio-content-tab-rail"
                  className="edge-fade-x flex min-w-0 items-center gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {contentTabs.map((contentTab) => {
                    if (contentTab.kind === 'transcript') {
                      return (
                        <PrimaryContentTab
                          key={contentTab.value}
                          active={resolvedActiveContentTab === 'transcript'}
                          actionsVisible={
                            draggedContentTab === null && primaryContentActionsVisible
                          }
                          dragging={
                            draggedContentTab?.segmentId === selectedSegment.segmentId &&
                            draggedContentTab.value === contentTab.value
                          }
                          menuOpen={primaryContentMenuOpen}
                          onActionsVisible={() =>
                            draggedContentTab === null
                              ? setPrimaryContentActionsVisible(true)
                              : undefined
                          }
                          onActionsHidden={() =>
                            draggedContentTab === null
                              ? setPrimaryContentActionsVisible(false)
                              : undefined
                          }
                          onDragEnd={handleContentTabDragEnd}
                          onDragEnter={handleContentTabDragEnter}
                          onDragOver={(event) => handleContentTabDragOver(event, contentTab.value)}
                          onDragStart={(event) =>
                            handleContentTabDragStart(event, contentTab.value)
                          }
                          onKeyDown={(event) => handleContentTabKeyDown(event, 'transcript')}
                          onMenuOpenChange={setPrimaryContentMenuOpen}
                          onSelect={() => requestActiveContentTab('transcript')}
                          panelId={contentTab.panelId}
                          renderMoreMenu={(trigger, onCloseAutoFocus) => (
                            <SegmentContentActionsMenu
                              actionIdentity={{
                                memoryId: memory.memoryId,
                                segmentId: selectedSegment.segmentId,
                                workspaceHandle: workspaceSession.workspaceHandle,
                                workspaceId: workspaceSession.workspaceId,
                              }}
                              contentAlign="center"
                              onCloseAutoFocus={onCloseAutoFocus}
                              clearDisabled={
                                isAudioMemorySegment(selectedSegment)
                                  ? !isAudioSegmentContent(segmentContent)
                                  : !noteSegmentContent
                              }
                              contentKind={
                                isAudioMemorySegment(selectedSegment) ? 'transcript' : 'body'
                              }
                              menuLabel={`${contentTab.title} 更多操作`}
                              onClear={() => {
                                setPrimaryContentMenuOpen(false);
                                if (
                                  isAudioMemorySegment(selectedSegment) &&
                                  isAudioSegmentContent(segmentContent)
                                ) {
                                  onClearSegmentContent({
                                    memoryId: memory.memoryId,
                                    segment: selectedSegment,
                                    contentKind: 'transcript',
                                    currentTitle: contentTab.title,
                                    baselineTiptapContentHash:
                                      segmentContent.transcript.baselineTiptapContentHash,
                                    baselineTranscriptHash: segmentContent.transcript.baselineHash,
                                  });
                                  return;
                                }
                                if (!isAudioMemorySegment(selectedSegment) && noteSegmentContent) {
                                  onClearSegmentContent({
                                    memoryId: memory.memoryId,
                                    segment: selectedSegment,
                                    contentKind: 'body',
                                    currentTitle: contentTab.title,
                                    baselineContentHash: noteSegmentContent.baselineContentHash,
                                  });
                                }
                              }}
                              onOpenChange={setPrimaryContentMenuOpen}
                              onRequestSpeechSynthesis={
                                !isAudioMemorySegment(selectedSegment) &&
                                speechSynthesis?.requestSegment
                                  ? (speaker) => {
                                      setPrimaryContentMenuOpen(false);
                                      void speechSynthesis.requestSegment?.({
                                        workspaceId: workspaceSession.workspaceId,
                                        memoryId: memory.memoryId,
                                        segmentId: selectedSegment.segmentId,
                                        mode: 'regenerate',
                                        speaker,
                                      });
                                    }
                                  : undefined
                              }
                              onRequestTranscriptionBackfill={
                                isAudioMemorySegment(selectedSegment) &&
                                transcriptionBackfill?.retrySegment
                                  ? () => {
                                      setPrimaryContentMenuOpen(false);
                                      if (selectedSegment.transcript.exists) {
                                        setConfirmingTranscriptionBackfill({
                                          kind: 'segment',
                                          memoryId: memory.memoryId,
                                          segmentId: selectedSegment.segmentId,
                                          title: contentTab.title,
                                        });
                                        return;
                                      }
                                      void transcriptionBackfill.retrySegment?.({
                                        workspaceId: workspaceSession.workspaceId,
                                        memoryId: memory.memoryId,
                                        segmentId: selectedSegment.segmentId,
                                        mode: 'fill-missing',
                                      });
                                    }
                                  : undefined
                              }
                              onRename={() => {
                                setPrimaryContentMenuOpen(false);
                                onRenameSegmentContent({
                                  memoryId: memory.memoryId,
                                  segment: selectedSegment,
                                  contentKind: isAudioMemorySegment(selectedSegment)
                                    ? 'transcript'
                                    : 'body',
                                  currentTitle: contentTab.title,
                                });
                              }}
                              open={primaryContentMenuOpen}
                              speechSynthesisDisabledReason={
                                !isAudioMemorySegment(selectedSegment)
                                  ? noteSpeechSynthesisDisabledReason({
                                      baseReason: speechSynthesis?.disabledReason,
                                      dirty: inlineMarkdownDirty,
                                      running:
                                        speechSynthesis?.isSegmentRunning?.({
                                          workspaceId: workspaceSession.workspaceId,
                                          memoryId: memory.memoryId,
                                          segmentId: selectedSegment.segmentId,
                                        }) === true,
                                      speechSynthesis: noteSegmentContent?.speechSynthesis,
                                    })
                                  : null
                              }
                              transcriptExists={
                                isAudioMemorySegment(selectedSegment)
                                  ? selectedSegment.transcript.exists
                                  : false
                              }
                              transcriptionBackfillDisabledReason={
                                isAudioMemorySegment(selectedSegment)
                                  ? transcriptionBackfillDisabledReason({
                                      baseReason: transcriptionBackfill?.disabledReason,
                                      running:
                                        transcriptionBackfill?.isSegmentRunning?.({
                                          workspaceId: workspaceSession.workspaceId,
                                          memoryId: memory.memoryId,
                                          segmentId: selectedSegment.segmentId,
                                        }) === true,
                                    })
                                  : null
                              }
                              trigger={trigger}
                            />
                          )}
                          tabId={contentTab.tabId}
                          tabIndex={resolvedActiveContentTab === 'transcript' ? 0 : -1}
                          title={contentTab.title}
                        >
                          <FileText
                            aria-hidden="true"
                            className="size-16 shrink-0"
                            strokeWidth={2}
                          />
                          <span className="truncate">{contentTab.title}</span>
                        </PrimaryContentTab>
                      );
                    }

                    const supplement = contentTab.supplement;
                    const supplementIsAudio = isAudioMemorySegmentSupplement(supplement);
                    const supplementSpeechSynthesisProjection =
                      !supplementIsAudio &&
                      activeSegmentSupplement?.supplementId === supplement.supplementId
                        ? activeNoteSupplementContent?.speechSynthesis
                        : undefined;
                    const supplementSpeechSynthesisRunning =
                      !supplementIsAudio &&
                      speechSynthesis?.isSupplementRunning?.({
                        workspaceId: workspaceSession.workspaceId,
                        memoryId: memory.memoryId,
                        segmentId: selectedSegment.segmentId,
                        supplementId: supplement.supplementId,
                      }) === true;
                    const supplementSpeechSynthesisDisabledReason = !supplementIsAudio
                      ? noteSpeechSynthesisDisabledReason({
                          baseReason: speechSynthesis?.disabledReason,
                          dirty: inlineMarkdownDirty,
                          running: supplementSpeechSynthesisRunning,
                          speechSynthesis: supplementSpeechSynthesisProjection,
                        })
                      : null;
                    const requestSupplementSpeechSynthesis =
                      !supplementIsAudio && speechSynthesis?.requestSupplement
                        ? (speaker: VoiceSpeechSynthesisSpeaker) => {
                            setOpenSupplementActionMenuId(null);
                            void speechSynthesis.requestSupplement?.({
                              workspaceId: workspaceSession.workspaceId,
                              memoryId: memory.memoryId,
                              segmentId: selectedSegment.segmentId,
                              supplementId: supplement.supplementId,
                              mode: 'regenerate',
                              speaker,
                            });
                          }
                        : undefined;

                    return (
                      <SegmentSupplementTab
                        key={supplement.supplementId}
                        active={resolvedActiveContentTab === contentTab.value}
                        actionIdentity={{
                          memoryId: memory.memoryId,
                          segmentId: selectedSegment.segmentId,
                          workspaceHandle: workspaceSession.workspaceHandle,
                          workspaceId: workspaceSession.workspaceId,
                        }}
                        actionsVisible={
                          (draggedContentTab === null &&
                            hoveredSupplementActionId === supplement.supplementId) ||
                          draggedSupplementId === supplement.supplementId
                        }
                        supplement={supplement}
                        supplementIndex={
                          visibleSupplementIndexByTabValue.get(contentTab.value) ?? 0
                        }
                        dragging={
                          draggedContentTab?.segmentId === selectedSegment.segmentId &&
                          draggedContentTab.value === contentTab.value
                        }
                        menuOpen={openSupplementActionMenuId === supplement.supplementId}
                        revealMode={
                          draggedContentTab === null
                            ? 'normal'
                            : draggedSupplementId === supplement.supplementId
                              ? 'drag-source'
                              : 'drag-suppressed'
                        }
                        tabId={contentTab.tabId}
                        panelId={contentTab.panelId}
                        tabIndex={resolvedActiveContentTab === contentTab.value ? 0 : -1}
                        onKeyDown={(event) => handleContentTabKeyDown(event, contentTab.value)}
                        onActionsVisible={() =>
                          draggedContentTab === null
                            ? setHoveredSupplementActionId(supplement.supplementId)
                            : undefined
                        }
                        onActionsHidden={() =>
                          draggedContentTab === null
                            ? setHoveredSupplementActionId((currentSupplementId) =>
                                currentSupplementId === supplement.supplementId
                                  ? null
                                  : currentSupplementId
                              )
                            : undefined
                        }
                        onDragEnd={handleContentTabDragEnd}
                        onDragEnter={handleContentTabDragEnter}
                        onDragOver={(event) => handleContentTabDragOver(event, contentTab.value)}
                        onDragStart={(event) => handleContentTabDragStart(event, contentTab.value)}
                        onMenuOpenChange={(open) =>
                          setOpenSupplementActionMenuId(open ? supplement.supplementId : null)
                        }
                        onRequestSpeechSynthesis={requestSupplementSpeechSynthesis}
                        onRequestTranscriptionBackfill={
                          supplementIsAudio && transcriptionBackfill?.retrySupplement
                            ? () => {
                                setOpenSupplementActionMenuId(null);
                                if (supplement.transcript.exists) {
                                  setConfirmingTranscriptionBackfill({
                                    kind: 'supplement',
                                    memoryId: memory.memoryId,
                                    segmentId: selectedSegment.segmentId,
                                    supplementId: supplement.supplementId,
                                    title: supplement.title,
                                  });
                                  return;
                                }
                                void transcriptionBackfill.retrySupplement?.({
                                  workspaceId: workspaceSession.workspaceId,
                                  memoryId: memory.memoryId,
                                  segmentId: selectedSegment.segmentId,
                                  supplementId: supplement.supplementId,
                                  mode: 'fill-missing',
                                });
                              }
                            : undefined
                        }
                        onDelete={() =>
                          onDeleteSegmentSupplement({
                            memoryId: memory.memoryId,
                            segment: selectedSegment,
                            supplement,
                          })
                        }
                        onRename={() =>
                          onRenameSegmentSupplement({
                            memoryId: memory.memoryId,
                            segment: selectedSegment,
                            supplement,
                          })
                        }
                        onSelect={() => requestActiveContentTab(contentTab.value)}
                        speechSynthesisDisabledReason={supplementSpeechSynthesisDisabledReason}
                        transcriptExists={supplementIsAudio ? supplement.transcript.exists : false}
                        transcriptionBackfillDisabledReason={
                          supplementIsAudio
                            ? transcriptionBackfillDisabledReason({
                                baseReason: transcriptionBackfill?.disabledReason,
                                running:
                                  transcriptionBackfill?.isSupplementRunning?.({
                                    workspaceId: workspaceSession.workspaceId,
                                    memoryId: memory.memoryId,
                                    segmentId: selectedSegment.segmentId,
                                    supplementId: supplement.supplementId,
                                  }) === true,
                              })
                            : null
                        }
                      />
                    );
                  })}
                </div>
                <div
                  data-slot="memory-studio-content-tab-actions"
                  className="flex shrink-0 items-center gap-4"
                >
                  <DropdownMenu open={supplementMenuOpen} onOpenChange={setSupplementMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghostIcon"
                        size="compact"
                        type="button"
                        aria-label="添加片段补充内容"
                        className="gap-[6px] px-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground"
                      >
                        <Plus aria-hidden="true" className="size-16" />
                        <span>补充</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      aria-label="片段补充内容"
                      aria-labelledby={undefined}
                      align="end"
                    >
                      <DropdownMenuItem onSelect={requestStartSupplementRecording}>
                        <Mic aria-hidden="true" className="size-16" />
                        录音补充
                      </DropdownMenuItem>
                      {onStartSegmentSupplementNote ? (
                        <DropdownMenuItem onSelect={requestStartSupplementNote}>
                          <FileText aria-hidden="true" className="size-16" />
                          笔记补充
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {resolvedActiveContentTab === 'transcript' ? (
                isAudioMemorySegment(selectedSegment) && isAudioSegmentContent(segmentContent) ? (
                  <InlineMarkdownContentEditor<SavedSegmentTranscriptContent>
                    ariaLabelledBy={transcriptContentTab.tabId}
                    attachmentTarget={null}
                    baselineContentHash={segmentContent.transcript.baselineHash}
                    baselineTiptapContentHash={segmentContent.transcript.baselineTiptapContentHash}
                    failureCopy="无法保存转录。"
                    headerLabel="Markdown 转录"
                    initialMarkdown={segmentContent.transcript.text}
                    initialTiptapJson={segmentContent.transcript.tiptapJson}
                    onDiskVersionAccepted={() => undefined}
                    onDirtyChange={setInlineMarkdownDirty}
                    onSave={(
                      markdown,
                      baselineTranscriptHash,
                      tiptapJson,
                      baselineTiptapContentHash
                    ) =>
                      saveInlineSegmentTranscriptMarkdown({
                        baselineTranscriptHash,
                        baselineTiptapContentHash,
                        markdown,
                        segment: selectedSegment,
                        tiptapJson,
                      })
                    }
                    onSavedContent={onSegmentTranscriptSaved}
                    panelId={transcriptContentTab.panelId}
                    placeholder="整理或修正转录文本..."
                    surfaceTestId="memory-studio-inline-transcript-editor"
                    targetKey={`segment-transcript:${selectedSegment.segmentId}`}
                    title={transcriptContentTab.title}
                    editorId={`${transcriptContentTab.panelId}-inline-editor`}
                    editorLabel="转录正文"
                    workspaceSession={workspaceSession}
                  />
                ) : isAudioMemorySegment(selectedSegment) ? (
                  <SegmentTranscriptMarkdownPanel
                    ariaLabelledBy={transcriptContentTab.tabId}
                    copy={{
                      loading: '正在载入片段内容。',
                      error: '片段内容加载失败，请重试。',
                      empty: '这段录音还没有转录。',
                      failedRetryable: '上次生成转录失败。',
                      running: '正在生成转录。',
                      retry: '重试',
                    }}
                    error={segmentContentQuery.isError}
                    id={transcriptContentTab.panelId}
                    loading={segmentContentQuery.isLoading}
                    {...(retrySelectedSegmentTranscription
                      ? { onRetry: retrySelectedSegmentTranscription }
                      : {})}
                    outcome={
                      selectedSegmentTranscriptionRunning
                        ? runningTranscriptOutcome(
                            deriveTranscriptOutcome({
                              lastTranscriptionAttempt: selectedSegment.lastTranscriptionAttempt,
                              transcript: isAudioSegmentContent(segmentContent)
                                ? segmentContent.transcript
                                : undefined,
                            })
                          )
                        : deriveTranscriptOutcome({
                            lastTranscriptionAttempt: selectedSegment.lastTranscriptionAttempt,
                            transcript: isAudioSegmentContent(segmentContent)
                              ? segmentContent.transcript
                              : undefined,
                          })
                    }
                    title={transcriptContentTab.title}
                  />
                ) : noteSegmentContent ? (
                  <InlineMarkdownContentEditor<SavedNoteSegmentContent>
                    ariaLabelledBy={transcriptContentTab.tabId}
                    attachmentTarget={{
                      kind: 'segment',
                      memoryId: selectedSegment.memoryId,
                      segmentId: selectedSegment.segmentId,
                    }}
                    baselineContentHash={noteSegmentContent.baselineContentHash}
                    baselineTiptapContentHash={noteSegmentContent.baselineTiptapContentHash}
                    failureCopy="无法保存笔记正文。"
                    headerLabel="Markdown 正文"
                    initialMarkdown={noteSegmentContent.bodyMarkdown}
                    initialTiptapJson={noteSegmentContent.bodyTiptapJson}
                    onDiskVersionAccepted={(content) =>
                      handleSavedNoteSegmentContent(
                        savedNoteSegmentContentFromConflict({
                          conflict: {
                            currentBodyMarkdown: content.markdown,
                            currentBodyTiptapJson: content.tiptapJson,
                            currentBaselineContentHash: content.baselineContentHash,
                            currentBaselineTiptapContentHash: content.baselineTiptapContentHash,
                          },
                          memoryId: selectedSegment.memoryId,
                          segmentId: selectedSegment.segmentId,
                          title: selectedSegment.title,
                          workspaceSession,
                        })
                      )
                    }
                    onDirtyChange={setInlineMarkdownDirty}
                    onSave={(
                      markdown,
                      baselineContentHash,
                      tiptapJson,
                      baselineTiptapContentHash
                    ) =>
                      saveInlineNoteSegmentMarkdown({
                        baselineContentHash,
                        baselineTiptapContentHash,
                        markdown,
                        segment: selectedSegment,
                        tiptapJson,
                      })
                    }
                    onSavedContent={handleSavedNoteSegmentContent}
                    panelId={transcriptContentTab.panelId}
                    placeholder="写下正文..."
                    surfaceTestId="memory-studio-inline-note-editor"
                    targetKey={`segment:${selectedSegment.segmentId}`}
                    title={transcriptContentTab.title}
                    editorId={`${transcriptContentTab.panelId}-inline-editor`}
                    editorLabel="笔记正文"
                    workspaceSession={workspaceSession}
                  />
                ) : (
                  <MarkdownContentSurface
                    ariaLabelledBy={transcriptContentTab.tabId}
                    attachmentContext={{
                      kind: 'segment',
                      workspaceId: workspaceSession.workspaceId,
                      segmentId: selectedSegment.segmentId,
                    }}
                    bodyMarkdown={undefined}
                    className="mt-12"
                    id={transcriptContentTab.panelId}
                    loading={segmentContentQuery.isLoading}
                    role="tabpanel"
                    showTitle={false}
                    title={selectedSegment.title}
                  />
                )
              ) : activeSegmentSupplement ? (
                isAudioMemorySegmentSupplement(activeSegmentSupplement) ? (
                  <section
                    key={activeSegmentSupplement.supplementId}
                    aria-label={activeSegmentSupplement.title}
                    role="tabpanel"
                    id={activeContentTabModel.panelId}
                    aria-labelledby={activeContentTabModel.tabId}
                    data-slot="memory-studio-supplement-panel"
                    className="reo-content-tab-panel-motion mt-4 flex min-h-0 flex-1 flex-col overflow-hidden"
                  >
                    <SegmentSupplementAudioPlayer
                      ariaLabelledBy={activeContentTabModel.tabId}
                      supplement={activeSegmentSupplement}
                      audioResourceCache={supplementAudioResourceCache}
                      onDirtyChange={setInlineMarkdownDirty}
                      onTranscriptSaved={onSegmentSupplementTranscriptSaved}
                      panelId={activeContentTabModel.panelId}
                      {...(transcriptionBackfill ? { transcriptionBackfill } : {})}
                      workspaceSession={workspaceSession}
                    />
                  </section>
                ) : isNoteMemorySegmentSupplement(activeSegmentSupplement) ? (
                  <SegmentSupplementNotePanel
                    key={activeSegmentSupplement.supplementId}
                    ariaLabelledBy={activeContentTabModel.tabId}
                    audioResourceCache={supplementAudioResourceCache}
                    onDiskVersionAccepted={(content) => {
                      if (!activeNoteSupplementContent) {
                        return;
                      }
                      handleSavedNoteSegmentSupplementContent(
                        savedNoteSegmentSupplementContentFromConflict({
                          conflict: {
                            currentBodyMarkdown: content.markdown,
                            currentBodyTiptapJson: content.tiptapJson,
                            currentBaselineContentHash: content.baselineContentHash,
                            currentBaselineTiptapContentHash: content.baselineTiptapContentHash,
                          },
                          memoryId: activeSegmentSupplement.memoryId,
                          segmentId: activeSegmentSupplement.segmentId,
                          supplementId: activeSegmentSupplement.supplementId,
                          title: activeSegmentSupplement.title,
                          workspaceSession,
                        })
                      );
                    }}
                    onDirtyChange={setInlineMarkdownDirty}
                    onSaveEdit={(
                      markdown,
                      baselineContentHash,
                      tiptapJson,
                      baselineTiptapContentHash
                    ) => {
                      if (!activeNoteSupplementContent) {
                        return Promise.resolve({
                          ok: false,
                          kind: 'error',
                          message: '无法保存补充笔记正文。',
                        });
                      }
                      return saveInlineNoteSupplementMarkdown({
                        baselineContentHash,
                        baselineTiptapContentHash,
                        markdown,
                        supplement: activeSegmentSupplement,
                        tiptapJson,
                      });
                    }}
                    onSavedContent={handleSavedNoteSegmentSupplementContent}
                    panelId={activeContentTabModel.panelId}
                    supplement={activeSegmentSupplement}
                    supplementContent={activeNoteSupplementContent}
                    supplementContentError={activeNoteSupplementContentQuery.isError}
                    supplementContentLoading={activeNoteSupplementContentQuery.isLoading}
                    workspaceSession={workspaceSession}
                  />
                ) : null
              ) : null}
            </section>
          </>
        ) : detailQuery.isError ? (
          <div className="mt-32 max-w-[420px]">
            <p className="text-body leading-body text-muted-foreground">
              记忆内容加载失败，请重试。
            </p>
          </div>
        ) : (
          <MemoryStudioSegmentStripSkeleton />
        )}
      </section>
      <WorkspaceDangerConfirmDialog
        open={confirmingTranscriptionBackfill !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingTranscriptionBackfill(null);
          }
        }}
        title="重新生成转录？"
        description={`将覆盖当前转录正文，不会更改「${confirmingTranscriptionBackfill?.title ?? '转录'}」这个名称。开始后如果文件内容被外部修改，Reo 会停止覆盖。`}
        confirmLabel="重新生成"
        disabled={false}
        onConfirm={() => {
          confirmTranscriptionRegenerate();
        }}
      />
    </>
  );
}

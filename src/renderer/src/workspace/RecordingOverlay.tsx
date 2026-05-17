import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  MAX_RECORDING_DRAFT_AUDIO_READ_BYTES,
  pcmByteLengthToDurationMs,
  trimPcmChunkEnd,
  trimPcmChunkStart,
} from '../../../workspace-contract/recording-audio';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import {
  appendRecordingAudioChunk,
  appendSegmentSupplementRecordingAudioChunk,
  beginMicrophoneIntent,
  clearMicrophoneIntent,
  cloneRecordingDraftPrefix,
  closeRecordingTranscription,
  createRecordingDraft,
  createSegmentSupplementRecordingDraft,
  discardRecordingDraft,
  discardSegmentSupplementRecordingDraft,
  finishRecordingTranscription,
  finalizeRecordingDraft,
  finalizeSegmentSupplementRecordingDraft,
  onRecordingTranscriptionEvent,
  readRecordingDraftAudio,
  saveSegmentSupplementTranscript,
  saveTranscript,
  sendRecordingTranscriptionAudio,
  startRecordingTranscription,
} from './workspaceApi';
import type {
  FinalizedAudioSegment,
  FinalizedSegmentSupplementRecording,
  WorkspaceError,
  WorkspaceMemorySummary,
  WorkspaceSession,
} from './workspaceApi';
import {
  createBrowserMediaRecorderAdapter,
  type RecordingMediaAdapter,
  type RecordingMediaController,
  type RecordingMediaHandlers,
} from './mediaRecorderAdapter';
import {
  RecordingControls,
  type PausedRecordingPrimaryAction,
} from './recording/RecordingControls';
import { RecordingSurface } from './recording/RecordingSurface';
import { RecordingTranscriptPreview } from './recording/RecordingTranscriptPreview';
import { RecordingWaveform } from './recording/RecordingWaveform';
import { RECORDING_SPEECH_TEXT_CLASS } from './recording/recordingTypography';
import {
  applyTranscriptResult,
  createRecordingTimeline,
  hasTailAfterCursor,
  moveRecordingCursor,
  startReplacementAtCursor,
  transcriptMarkdownFromSegments,
  type TranscriptSegment,
} from './recording/recordingTimeline';
import {
  createInitialRecordingState,
  isRecordingCloseBlocked,
  transitionRecordingState,
  type RecordingState,
} from './recordingMachine';
import {
  clearRecordingRecoveryDraft,
  type RecordingRecoveryAudioChunk,
  type RecordingRecoveryDraft,
  updateRecordingRecoveryDuration,
  updateRecordingRecoverySnapshot,
  writeRecordingRecoveryDraft,
} from './recordingRecovery';
import { voiceSettingsQueryOptions } from '@/settings/voiceSettingsQueries';
import { unknownErrorDisplayMessage, workspaceErrorDisplayMessage } from './workspaceErrorMessages';

type RecordingOverlayProps = {
  readonly mediaAdapter?: RecordingMediaAdapter;
  readonly onCloseBlockedChange?: (blocked: boolean) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRecordingContentSaved?: (content: SavedRecordingContent) => void;
  readonly onAudioSegmentFinalized: (recording: FinalizedAudioSegment) => void;
  readonly onRecordingFlowSettled?: () => void;
  readonly onSegmentSupplementFinalized?: (
    recording: FinalizedSegmentSupplementRecording,
    options?: { readonly refreshContent?: boolean }
  ) => void;
  readonly open: boolean;
  readonly recoveredDraft?: RecordingRecoveryDraft | null;
  readonly recordingTarget: RecordingTarget;
  readonly workspaceSession: WorkspaceSession;
};

export type RecordingTarget =
  | { readonly kind: 'existing-memory'; readonly memoryId: string; readonly title?: string }
  | {
      readonly kind: 'segment-supplement';
      readonly memoryId: string;
      readonly segmentId: string;
      readonly title: string;
    };
export type SavedRecordingContent = {
  readonly memory: WorkspaceMemorySummary;
  readonly memoryId: string;
  readonly segmentId: string;
};

const MIN_EFFECTIVE_RECORDING_DURATION_MS = 2_000;
const MAX_RECORDING_DURATION_MS = 60 * 60 * 1000;
const LONG_RECORDING_WARNING_THRESHOLD_MS = 55 * 60 * 1000;
const RECORDING_TIMER_INTERVAL_MS = 40;
const SILENCE_NOTICE_THRESHOLD_MS = 15_000;
const AUDIBLE_LEVEL_THRESHOLD = 0.08;
const WAVEFORM_SAMPLE_INTERVAL_MS = 80;
const WAVEFORM_SEEK_EPSILON_MS = 50;
const MAX_WAVEFORM_SAMPLES = 2400;
const MAX_COMPLETION_BACKFILL_PCM_DURATION_MS = 10 * 60 * 1000;
const TRANSCRIPTION_START_BUFFER_MS = 10_000;
const MAX_TRANSCRIPTION_AUDIO_QUEUE_BYTES = 1024 * 1024;
const DRAFT_PLAYBACK_READY_TIMEOUT_MS = 1500;
const SHORT_RECORDING_NOTICE =
  '录音时间较短，可能无法生成有效内容。你可以继续录音，或再次点击完成保存。';
const LONG_RECORDING_WARNING_NOTICE = '录音即将达到时长上限，请尽快完成或分段记录。';
const MAX_RECORDING_DURATION_NOTICE = '录音已达到时长上限，已自动暂停。';
const SILENCE_NOTICE = '暂时没有检测到明显声音，你可以靠近麦克风或继续录音。';
const COMPLETION_BACKFILL_UNAVAILABLE_NOTICE = '录音已保存，转写暂时不可用，稍后可重新尝试。';
const VOICE_SETTINGS_LOADING_FINALIZE_NOTICE = '语音设置仍在加载，暂时无法完成录音保存。';

type LastTranscriptionAttemptOnFinalize = NonNullable<
  Parameters<
    Window['reoWorkspace']['finalizeRecordingDraft']
  >[0]['lastTranscriptionAttemptOnFinalize']
>;

function lastTranscriptionAttemptOnFinalize(
  transcriptionEnabled: boolean
): LastTranscriptionAttemptOnFinalize {
  return transcriptionEnabled ? 'failed' : 'never';
}

function isRecordingTranscriptionUnavailable(error: WorkspaceError) {
  return error.code === 'ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE';
}

type CapturedRecordingChunk = {
  readonly chunk: Uint8Array;
  readonly endTimeMs: number;
  readonly startTimeMs: number;
};

type CapturedPcmChunk = {
  readonly chunk: Uint8Array;
  readonly endTimeMs: number;
  readonly startTimeMs: number;
};

type DraftPlaybackStatus = 'idle' | 'preparing' | 'ready' | 'unavailable';

type DraftPlaybackPreview = {
  readonly chunkCount: number;
  readonly session: number | null;
  readonly status: DraftPlaybackStatus;
  readonly url: string | null;
};

const EMPTY_DRAFT_PLAYBACK_PREVIEW: DraftPlaybackPreview = {
  chunkCount: 0,
  session: null,
  status: 'idle',
  url: null,
};

type ActiveTranscriptionSession = {
  readonly recordingFlowSessionId: string;
  readonly recordingSessionId: string;
  readonly revisionId: string;
  readonly recordingSession: number;
  readonly workspaceHandle: string;
  acceptsAudio: boolean;
};

type TranscriptionAudioQueue = {
  readonly recordingFlowSessionId: string;
  readonly recordingSessionId: string;
  readonly revisionId: string;
  readonly recordingSession: number;
  queuedBytes: number;
  tail: Promise<void>;
};

type PendingTranscriptionStart = {
  readonly recordingFlowSessionId: string;
  readonly recordingSession: number;
  readonly revisionId: string;
  readonly timeOffsetMs: number;
};

function titleForRecordingTarget(target: RecordingTarget, workspaceSession: WorkspaceSession) {
  if (target.title) {
    return target.title;
  }
  if (target.kind === 'segment-supplement') {
    return target.title;
  }
  const memory = workspaceSession.snapshot.memories.find(
    (candidate) => candidate.memoryId === target.memoryId
  );
  return `录音${(memory?.segmentCount ?? 0) + 1}`;
}

const RECORDING_STATUS_TEXT = {
  'acquiring-permission': '正在准备麦克风权限。',
  failed: '录音没有保存。',
  finalizing: '正在保存本地音频。',
  idle: '可以开始录制本地音频。',
  paused: '录音已暂停。',
  recording: '正在录制本地音频。',
  replacing: '正在替换录音。',
} satisfies Record<RecordingState['status'], string>;

function statusTextFor(state: RecordingState): string {
  return RECORDING_STATUS_TEXT[state.status];
}

function formatRecordingTime(durationMs: number) {
  const safeDurationMs = Math.max(0, Math.round(durationMs));
  const minutes = Math.floor(safeDurationMs / 60_000);
  const seconds = Math.floor((safeDurationMs % 60_000) / 1000);
  const centiseconds = Math.floor((safeDurationMs % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

function recordingSessionNumberFrom(recordingSessionId: string) {
  const match = /^recording-(\d+)$/.exec(recordingSessionId);
  return match ? Number.parseInt(match[1] ?? '0', 10) : null;
}

function appendBoundedWaveformSample(samples: readonly number[], sample: number) {
  const next = [...samples, sample];
  if (next.length <= MAX_WAVEFORM_SAMPLES) {
    return next;
  }
  const compacted: number[] = [];
  for (let index = 0; index < next.length; index += 2) {
    compacted.push(Math.max(next[index] ?? 0, next[index + 1] ?? 0));
  }
  return compacted.slice(-MAX_WAVEFORM_SAMPLES);
}

function resolveReplacementStartMs({
  chunks,
  cursorTimeMs,
  totalDurationMs,
}: {
  readonly chunks: readonly CapturedRecordingChunk[];
  readonly cursorTimeMs: number;
  readonly totalDurationMs: number;
}) {
  const safeCursorTimeMs = Math.min(
    Math.max(0, Math.round(cursorTimeMs)),
    Math.max(0, Math.round(totalDurationMs))
  );
  if (safeCursorTimeMs <= WAVEFORM_SEEK_EPSILON_MS) {
    return 0;
  }
  const containingOrNextChunk = chunks.find(
    (chunk) => chunk.endTimeMs >= safeCursorTimeMs - WAVEFORM_SEEK_EPSILON_MS
  );
  if (!containingOrNextChunk) {
    return safeCursorTimeMs;
  }
  return Math.min(totalDurationMs, containingOrNextChunk.endTimeMs);
}

function resolveDraftPlaybackStartMs({
  cursorTimeMs,
  totalDurationMs,
}: {
  readonly cursorTimeMs: number;
  readonly totalDurationMs: number;
}) {
  const safeTotalDurationMs = Math.max(0, Math.round(totalDurationMs));
  if (safeTotalDurationMs <= WAVEFORM_SEEK_EPSILON_MS) {
    return 0;
  }

  const safeCursorTimeMs = Math.min(Math.max(0, Math.round(cursorTimeMs)), safeTotalDurationMs);
  if (safeCursorTimeMs >= safeTotalDurationMs - WAVEFORM_SEEK_EPSILON_MS) {
    return 0;
  }
  return safeCursorTimeMs;
}

function retainPcmChunksThrough(
  chunks: readonly CapturedPcmChunk[],
  cursorTimeMs: number
): CapturedPcmChunk[] {
  const retainedChunks: CapturedPcmChunk[] = [];
  for (const chunk of chunks) {
    if (chunk.endTimeMs <= cursorTimeMs) {
      retainedChunks.push(chunk);
      continue;
    }
    if (chunk.startTimeMs >= cursorTimeMs) {
      continue;
    }
    const retainedAudio = trimPcmChunkEnd(chunk.chunk, cursorTimeMs - chunk.startTimeMs);
    if (retainedAudio) {
      retainedChunks.push({
        chunk: new Uint8Array(retainedAudio),
        endTimeMs: cursorTimeMs,
        startTimeMs: chunk.startTimeMs,
      });
    }
  }
  return retainedChunks;
}

export function RecordingOverlay({
  mediaAdapter,
  onCloseBlockedChange,
  onOpenChange,
  onRecordingContentSaved,
  onAudioSegmentFinalized,
  onRecordingFlowSettled,
  onSegmentSupplementFinalized,
  open,
  recoveredDraft = null,
  recordingTarget,
  workspaceSession,
}: RecordingOverlayProps) {
  const { data: voiceSettings } = useQuery(voiceSettingsQueryOptions());
  const voiceSettingsKnown = voiceSettings !== undefined;
  const transcriptionEnabled = voiceSettings?.enabled === true;
  const transcriptionDisabled = voiceSettings?.enabled === false;
  const [state, setState] = useState<RecordingState>(() => createInitialRecordingState());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timeline, setTimeline] = useState(() =>
    createRecordingTimeline({ recordingSessionId: 'recording-0', revisionId: 'revision-0' })
  );
  const cursorTimeMs = timeline.cursorTimeMs;
  const [waveformSamples, setWaveformSamples] = useState<readonly number[]>([]);
  const [draftPlaybackPreview, setDraftPlaybackPreviewState] = useState<DraftPlaybackPreview>(
    EMPTY_DRAFT_PLAYBACK_PREVIEW
  );
  const [exitConfirmationOpen, setExitConfirmationOpen] = useState(false);
  const [exitActionPending, setExitActionPending] = useState(false);
  const [isDraftPlaybackPlaying, setIsDraftPlaybackPlaying] = useState(false);
  const [shortRecordingNoticeVisible, setShortRecordingNoticeVisible] = useState(false);
  const appendQueueRef = useRef<Promise<void>>(Promise.resolve());
  const timelineRef = useRef(timeline);
  const capturedChunksRef = useRef<CapturedRecordingChunk[]>([]);
  const recoveryAudioChunksRef = useRef<RecordingRecoveryAudioChunk[]>([]);
  const capturedPcmChunksRef = useRef<CapturedPcmChunk[]>([]);
  const controllerRef = useRef<RecordingMediaController | null>(null);
  const draftAudioRef = useRef<HTMLAudioElement | null>(null);
  const draftPlaybackPreviewRef = useRef<DraftPlaybackPreview>(EMPTY_DRAFT_PLAYBACK_PREVIEW);
  const activeDraftRef = useRef<{
    readonly segmentId: string;
    readonly recordingSession: number;
  } | null>(null);
  const activeTranscriptionRef = useRef<ActiveTranscriptionSession | null>(null);
  const activeTranscriptionStartPromiseRef = useRef<Promise<void> | null>(null);
  const pendingTranscriptionStartRef = useRef<PendingTranscriptionStart | null>(null);
  const transcriptionDisabledByMainRef = useRef(false);
  const transcriptionUnavailableForSessionRef = useRef(false);
  const transcriptionAudioQueueRef = useRef<TranscriptionAudioQueue | null>(null);
  const liveAudioInputActiveRef = useRef(false);
  const pendingMicrophoneIntentRef = useRef<{
    readonly recordingFlowSessionId: string;
    readonly recordingSession: number;
    readonly workspaceHandle: string;
  } | null>(null);
  const playbackSessionRef = useRef(0);
  const replacementCopySessionRef = useRef<number | null>(null);
  const transcriptDraftRef = useRef('');
  const completionBackfillTooLargeRef = useRef(false);
  const finalTranscriptionNeedsBackfillRef = useRef(false);
  const appendFailureRef = useRef<string | null>(null);
  const activeRevisionIdRef = useRef('revision-0');
  const lastCapturedChunkEndMsRef = useRef(0);
  const lastCapturedPcmChunkEndMsRef = useRef(0);
  const lastNoticeableAudioAtMsRef = useRef(0);
  const lastRecoveryDurationPersistedMsRef = useRef(0);
  const lastRecoveryAudioChunksPersistedMsRef = useRef(0);
  const lastRecoveryAudioChunkCountPersistedRef = useRef(0);
  const lastRecoveryWaveformPersistedMsRef = useRef(0);
  const lastWaveformSampleAtMsRef = useRef(0);
  const revisionIndexRef = useRef(0);
  const recordingDurationRef = useRef<{
    accumulatedMs: number;
    startedAtMs: number | null;
  }>({ accumulatedMs: 0, startedAtMs: null });
  const longRecordingWarningShownRef = useRef(false);
  const restoredSegmentIdRef = useRef<string | null>(null);
  const silenceNoticeShownRef = useRef(false);
  const shortRecordingCompletionArmedRef = useRef(false);
  const recordingSessionRef = useRef(0);
  const sequenceRef = useRef(0);
  const lastRecordingErrorToastRef = useRef<string | null>(null);

  const notifyRecordingError = useCallback((message: string) => {
    const displayMessage = message.trim();
    if (!displayMessage || lastRecordingErrorToastRef.current === displayMessage) {
      return;
    }

    toast.error(displayMessage);
    lastRecordingErrorToastRef.current = displayMessage;
  }, []);

  const clearRecordingError = useCallback(() => {
    lastRecordingErrorToastRef.current = null;
  }, []);

  function clearCapturedTranscriptionPcm() {
    capturedPcmChunksRef.current = [];
    completionBackfillTooLargeRef.current = false;
    lastCapturedPcmChunkEndMsRef.current = readRecordingDurationMs();
  }

  function clearTranscriptionRuntime({ clearPcm = false }: { readonly clearPcm?: boolean } = {}) {
    activeTranscriptionStartPromiseRef.current = null;
    pendingTranscriptionStartRef.current = null;
    activeTranscriptionRef.current = null;
    transcriptionAudioQueueRef.current = null;
    finalTranscriptionNeedsBackfillRef.current = false;
    if (clearPcm) {
      clearCapturedTranscriptionPcm();
    }
  }

  function shouldCaptureTranscriptionPcm() {
    return (
      !transcriptionDisabled &&
      !transcriptionDisabledByMainRef.current &&
      !transcriptionUnavailableForSessionRef.current
    );
  }

  const replaceTranscriptDraft = useCallback((nextTranscript: string) => {
    transcriptDraftRef.current = nextTranscript;
  }, []);

  const applyTranscriptionSegments = useCallback(
    (segments: readonly TranscriptSegment[]) => {
      if (segments.length === 0) {
        return;
      }
      const current = timelineRef.current;
      const next = segments.reduce(applyTranscriptResult, current);
      if (next === current) {
        return;
      }
      timelineRef.current = next;
      replaceTranscriptDraft(transcriptMarkdownFromSegments(next.transcriptSegments));
      const activeDraft = activeDraftRef.current;
      if (activeDraft) {
        updateRecordingRecoverySnapshot({
          patch: {
            durationMs: next.totalDurationMs,
            recordingSessionId: next.recordingSessionId,
            revisionId: next.revisionId,
            transcriptSegments: next.transcriptSegments,
          },
          segmentId: activeDraft.segmentId,
          workspaceId: workspaceSession.workspaceId,
        });
      }
      setTimeline(next);
    },
    [replaceTranscriptDraft, workspaceSession.workspaceId]
  );

  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  useEffect(() => {
    if (!voiceSettingsKnown) {
      return;
    }
    const pendingStart = pendingTranscriptionStartRef.current;
    if (!pendingStart) {
      return;
    }
    pendingTranscriptionStartRef.current = null;
    if (
      recordingSessionRef.current !== pendingStart.recordingSession ||
      activeRevisionIdRef.current !== pendingStart.revisionId ||
      timelineRef.current.recordingSessionId !== pendingStart.recordingFlowSessionId
    ) {
      return;
    }
    queueActiveTranscriptionStart(pendingStart);
  }, [voiceSettingsKnown, transcriptionEnabled]);

  useEffect(() => {
    if (!open || !recoveredDraft) {
      return;
    }
    if (recordingTarget.kind !== 'existing-memory') {
      return;
    }
    if (
      restoredSegmentIdRef.current === recoveredDraft.segmentId ||
      recoveredDraft.workspaceId !== workspaceSession.workspaceId ||
      recoveredDraft.memoryId !== recordingTarget.memoryId
    ) {
      return;
    }

    const recordingSessionId =
      recoveredDraft.recordingSessionId ?? `recording-${recordingSessionRef.current + 1}`;
    const revisionId = recoveredDraft.revisionId ?? `${recordingSessionId}-revision-0`;
    const recordingSession =
      recordingSessionNumberFrom(recordingSessionId) ?? recordingSessionRef.current + 1;
    const durationMs = Math.max(0, Math.round(recoveredDraft.durationMs));
    const recoveredTranscriptSegments = recoveredDraft.transcriptSegments ?? [];
    const recoveredTranscriptMarkdown =
      recoveredTranscriptSegments.length > 0
        ? transcriptMarkdownFromSegments(recoveredTranscriptSegments)
        : (recoveredDraft.transcriptMarkdown ?? '');
    const restoredTimeline = createRecordingTimeline({
      cursorTimeMs: durationMs,
      recordingSessionId,
      revisionId,
      totalDurationMs: durationMs,
      transcriptSegments: recoveredTranscriptSegments,
    });

    restoredSegmentIdRef.current = recoveredDraft.segmentId;
    recordingSessionRef.current = recordingSession;
    activeRevisionIdRef.current = revisionId;
    sequenceRef.current = recoveredDraft.nextSequence ?? 0;
    activeDraftRef.current = {
      segmentId: recoveredDraft.segmentId,
      recordingSession,
    };
    appendFailureRef.current = null;
    appendQueueRef.current = Promise.resolve();
    setCapturedChunks([]);
    capturedPcmChunksRef.current = [];
    controllerRef.current = null;
    liveAudioInputActiveRef.current = false;
    completionBackfillTooLargeRef.current = false;
    finalTranscriptionNeedsBackfillRef.current = false;
    transcriptionDisabledByMainRef.current = false;
    transcriptionUnavailableForSessionRef.current = false;
    lastCapturedChunkEndMsRef.current = durationMs;
    lastCapturedPcmChunkEndMsRef.current = durationMs;
    lastNoticeableAudioAtMsRef.current = durationMs;
    lastRecoveryDurationPersistedMsRef.current = durationMs;
    lastRecoveryAudioChunksPersistedMsRef.current = durationMs;
    lastRecoveryWaveformPersistedMsRef.current = durationMs;
    lastWaveformSampleAtMsRef.current = durationMs;
    recordingDurationRef.current = { accumulatedMs: durationMs, startedAtMs: null };

    setElapsedMs(durationMs);
    setWaveformSamples([...(recoveredDraft.waveformSamples ?? [])]);
    timelineRef.current = restoredTimeline;
    setTimeline(restoredTimeline);
    replaceTranscriptDraft(recoveredTranscriptMarkdown);
    setState({ segmentId: recoveredDraft.segmentId, status: 'paused' });
    void restoreRecoveredDraftAudio({
      audioChunks: recoveredDraft.audioChunks ?? [],
      durationMs,
      segmentId: recoveredDraft.segmentId,
      restoredSegmentId: recoveredDraft.segmentId,
    }).catch((error) => {
      if (restoredSegmentIdRef.current === recoveredDraft.segmentId) {
        notifyRecordingError(
          unknownErrorDisplayMessage(error, '无法恢复录音预览，但仍可保存未完成录音。')
        );
      }
    });
  }, [
    open,
    recoveredDraft,
    recordingTarget.kind,
    recordingTarget.memoryId,
    replaceTranscriptDraft,
    workspaceSession.workspaceId,
  ]);

  useEffect(() => {
    return onRecordingTranscriptionEvent((event) => {
      if (event.kind === 'error') {
        const activeTranscription = activeTranscriptionRef.current;
        if (
          activeTranscription?.recordingSessionId === event.recordingSessionId &&
          activeTranscription.revisionId === event.revisionId
        ) {
          finalTranscriptionNeedsBackfillRef.current = true;
          notifyRecordingError(event.message);
        }
        return;
      }
      if (event.kind !== 'segments') {
        return;
      }
      applyTranscriptionSegments(event.segments);
    });
  }, [applyTranscriptionSegments, notifyRecordingError]);

  useEffect(() => {
    if (state.status !== 'recording') {
      return undefined;
    }

    const interval = window.setInterval(() => {
      const nextDurationMs = readRecordingDurationMs();
      if (nextDurationMs >= MAX_RECORDING_DURATION_MS) {
        pauseRecordingAt(MAX_RECORDING_DURATION_MS);
        toast(MAX_RECORDING_DURATION_NOTICE);
        return;
      }
      if (
        !longRecordingWarningShownRef.current &&
        nextDurationMs >= LONG_RECORDING_WARNING_THRESHOLD_MS
      ) {
        longRecordingWarningShownRef.current = true;
        toast(LONG_RECORDING_WARNING_NOTICE);
      }
      setElapsedMs(nextDurationMs);
      persistRecoveryDuration(nextDurationMs);
      if (shortRecordingNoticeVisible && nextDurationMs >= MIN_EFFECTIVE_RECORDING_DURATION_MS) {
        clearShortRecordingNotice();
      }
    }, RECORDING_TIMER_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [shortRecordingNoticeVisible, state.status]);

  useEffect(() => {
    return () => {
      if (draftPlaybackPreviewRef.current.url) {
        draftAudioRef.current?.pause();
      }
      liveAudioInputActiveRef.current = false;
      draftPlaybackPreviewRef.current = EMPTY_DRAFT_PLAYBACK_PREVIEW;
      playbackSessionRef.current += 1;
      recordingSessionRef.current += 1;
      const pendingMicrophoneIntent = pendingMicrophoneIntentRef.current;
      pendingMicrophoneIntentRef.current = null;
      if (pendingMicrophoneIntent) {
        void clearMicrophoneIntent({
          recordingFlowSessionId: pendingMicrophoneIntent.recordingFlowSessionId,
          workspaceHandle: pendingMicrophoneIntent.workspaceHandle,
        }).catch(() => {});
      }
      const controller = controllerRef.current;
      controllerRef.current = null;
      if (controller) {
        void Promise.resolve(controller.stop()).catch(() => {});
      }
      const activeDraft = activeDraftRef.current;
      activeDraftRef.current = null;
      if (activeDraft && replacementCopySessionRef.current === null) {
        void discardDraftAndClearRecoveryOnSuccess(activeDraft.segmentId).catch(() => {});
      }
      replacementCopySessionRef.current = null;
      const activeTranscription = activeTranscriptionRef.current;
      activeTranscriptionStartPromiseRef.current = null;
      pendingTranscriptionStartRef.current = null;
      activeTranscriptionRef.current = null;
      transcriptionDisabledByMainRef.current = false;
      transcriptionUnavailableForSessionRef.current = false;
      transcriptionAudioQueueRef.current = null;
      if (activeTranscription) {
        closeTranscriptionSilently(activeTranscription);
      }
    };
  }, [workspaceSession.workspaceHandle]);

  function closeTranscriptionSilently({
    recordingFlowSessionId,
    recordingSessionId,
    revisionId,
    workspaceHandle,
  }: {
    readonly recordingFlowSessionId: string;
    readonly recordingSessionId: string;
    readonly revisionId: string;
    readonly workspaceHandle: string;
  }) {
    void closeRecordingTranscription({
      recordingFlowSessionId,
      recordingSessionId,
      revisionId,
      workspaceHandle,
    }).catch(() => {});
  }

  const draftPlaybackUrl = draftPlaybackPreview.url;
  const draftPlaybackStatus = draftPlaybackPreview.status;
  const hasTranscriptPreview = timeline.transcriptSegments.length > 0;

  function setDraftPlaybackPreview(nextPreview: DraftPlaybackPreview) {
    draftPlaybackPreviewRef.current = nextPreview;
    setDraftPlaybackPreviewState(nextPreview);
  }

  useEffect(() => {
    return () => {
      if (draftPlaybackUrl) {
        URL.revokeObjectURL(draftPlaybackUrl);
      }
    };
  }, [draftPlaybackUrl]);

  function discardActiveDraft(recordingSession: number) {
    const activeDraft = activeDraftRef.current;
    if (!activeDraft || activeDraft.recordingSession !== recordingSession) {
      return;
    }
    activeDraftRef.current = null;
    void discardDraftAndClearRecoveryOnSuccess(activeDraft.segmentId).catch(() => {});
  }

  function clearPendingMicrophoneIntent(recordingSession: number) {
    const pendingMicrophoneIntent = pendingMicrophoneIntentRef.current;
    if (!pendingMicrophoneIntent || pendingMicrophoneIntent.recordingSession !== recordingSession) {
      return;
    }
    pendingMicrophoneIntentRef.current = null;
    void clearMicrophoneIntent({
      recordingFlowSessionId: pendingMicrophoneIntent.recordingFlowSessionId,
      workspaceHandle: pendingMicrophoneIntent.workspaceHandle,
    }).catch(() => {});
  }

  function forgetPendingMicrophoneIntent(recordingSession: number) {
    if (pendingMicrophoneIntentRef.current?.recordingSession === recordingSession) {
      pendingMicrophoneIntentRef.current = null;
    }
  }

  function closeActiveTranscription(recordingSession: number) {
    const activeTranscription = activeTranscriptionRef.current;
    if (!activeTranscription) {
      if (recordingSessionRef.current === recordingSession) {
        activeTranscriptionStartPromiseRef.current = null;
      }
      return;
    }
    if (activeTranscription.recordingSession !== recordingSession) {
      return;
    }
    activeTranscriptionStartPromiseRef.current = null;
    activeTranscriptionRef.current = null;
    if (transcriptionAudioQueueRef.current?.recordingSession === recordingSession) {
      transcriptionAudioQueueRef.current = null;
    }
    closeTranscriptionSilently(activeTranscription);
  }

  function transcriptionQueueMatchesActive(
    queue: TranscriptionAudioQueue,
    activeTranscription: ActiveTranscriptionSession
  ) {
    return (
      queue.recordingSession === activeTranscription.recordingSession &&
      queue.recordingFlowSessionId === activeTranscription.recordingFlowSessionId &&
      queue.recordingSessionId === activeTranscription.recordingSessionId &&
      queue.revisionId === activeTranscription.revisionId
    );
  }

  async function drainActiveTranscriptionQueue(activeTranscription: ActiveTranscriptionSession) {
    const queue = transcriptionAudioQueueRef.current;
    if (!queue || !transcriptionQueueMatchesActive(queue, activeTranscription)) {
      return;
    }
    await queue.tail.catch(() => {});
  }

  async function finishActiveTranscription(recordingSession: number) {
    if (
      !activeTranscriptionStartPromiseRef.current &&
      !activeTranscriptionRef.current &&
      !voiceSettingsKnown
    ) {
      activeTranscriptionStartPromiseRef.current = null;
      pendingTranscriptionStartRef.current = null;
      activeTranscriptionRef.current = null;
      transcriptionAudioQueueRef.current = null;
      finalTranscriptionNeedsBackfillRef.current = capturedPcmChunksRef.current.length > 0;
      return;
    }

    if (
      !activeTranscriptionStartPromiseRef.current &&
      !activeTranscriptionRef.current &&
      !transcriptionEnabled
    ) {
      transcriptionDisabledByMainRef.current = false;
      clearTranscriptionRuntime({ clearPcm: true });
      return;
    }

    const pendingStart = activeTranscriptionStartPromiseRef.current;
    if (pendingStart) {
      await pendingStart.catch(() => {});
    }
    const activeTranscription = activeTranscriptionRef.current;
    if (!activeTranscription || activeTranscription.recordingSession !== recordingSession) {
      if (recordingSessionRef.current === recordingSession) {
        finalTranscriptionNeedsBackfillRef.current = true;
      }
      return;
    }
    activeTranscription.acceptsAudio = false;
    await drainActiveTranscriptionQueue(activeTranscription);
    if (
      recordingSessionRef.current !== recordingSession ||
      activeTranscriptionRef.current !== activeTranscription
    ) {
      if (recordingSessionRef.current === recordingSession) {
        finalTranscriptionNeedsBackfillRef.current = true;
      }
      return;
    }
    let response: Awaited<ReturnType<typeof finishRecordingTranscription>>;
    try {
      response = await finishRecordingTranscription({
        recordingFlowSessionId: activeTranscription.recordingFlowSessionId,
        recordingSessionId: activeTranscription.recordingSessionId,
        revisionId: activeTranscription.revisionId,
        workspaceHandle: activeTranscription.workspaceHandle,
      });
    } catch (error) {
      if (
        recordingSessionRef.current === recordingSession &&
        activeTranscriptionRef.current === activeTranscription
      ) {
        activeTranscriptionRef.current = null;
        finalTranscriptionNeedsBackfillRef.current = true;
        notifyRecordingError(unknownErrorDisplayMessage(error, '最终转写未返回，录音会继续保存。'));
      }
      return;
    }
    if (
      recordingSessionRef.current !== recordingSession ||
      activeTranscriptionRef.current !== activeTranscription
    ) {
      return;
    }
    activeTranscriptionRef.current = null;
    if (!response.ok) {
      finalTranscriptionNeedsBackfillRef.current = true;
      notifyRecordingError(
        workspaceErrorDisplayMessage(response.error, '最终转写未返回，录音会继续保存。')
      );
      return;
    }
    if (!response.value.accepted) {
      finalTranscriptionNeedsBackfillRef.current = true;
      return;
    }
    applyTranscriptionSegments(response.value.segments ?? []);
    finalTranscriptionNeedsBackfillRef.current = false;
  }

  async function startActiveTranscription({
    recordingFlowSessionId,
    recordingSession,
    revisionId,
    timeOffsetMs,
  }: {
    readonly recordingFlowSessionId: string;
    readonly recordingSession: number;
    readonly revisionId: string;
    readonly timeOffsetMs: number;
  }) {
    if (!transcriptionEnabled) {
      transcriptionDisabledByMainRef.current = false;
      clearTranscriptionRuntime({ clearPcm: true });
      return;
    }

    const response = await startRecordingTranscription({
      recordingFlowSessionId,
      recordingSessionId: recordingFlowSessionId,
      revisionId,
      timeOffsetMs,
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    if (
      recordingSessionRef.current !== recordingSession ||
      activeRevisionIdRef.current !== revisionId ||
      timelineRef.current.recordingSessionId !== recordingFlowSessionId
    ) {
      if (response.ok && response.value.accepted) {
        closeTranscriptionSilently({
          recordingFlowSessionId,
          recordingSessionId: recordingFlowSessionId,
          revisionId,
          workspaceHandle: workspaceSession.workspaceHandle,
        });
      }
      return;
    }
    if (!response.ok) {
      if (isRecordingTranscriptionUnavailable(response.error)) {
        transcriptionUnavailableForSessionRef.current = true;
        clearTranscriptionRuntime({ clearPcm: true });
        notifyRecordingError(workspaceErrorDisplayMessage(response.error, '实时转写暂时不可用。'));
        return;
      }
      finalTranscriptionNeedsBackfillRef.current = true;
      notifyRecordingError(workspaceErrorDisplayMessage(response.error, '实时转写暂时不可用。'));
      return;
    }
    if (!response.value.accepted) {
      finalTranscriptionNeedsBackfillRef.current = true;
      return;
    }
    if (response.value.transcriptionMode === 'disabled') {
      transcriptionDisabledByMainRef.current = true;
      clearTranscriptionRuntime({ clearPcm: true });
      return;
    }
    activeTranscriptionRef.current = {
      acceptsAudio: true,
      recordingFlowSessionId,
      recordingSession,
      recordingSessionId: recordingFlowSessionId,
      revisionId,
      workspaceHandle: workspaceSession.workspaceHandle,
    };
    transcriptionAudioQueueRef.current = null;
    flushBufferedTranscriptionAudio(recordingSession, timeOffsetMs);
  }

  function queueActiveTranscriptionStart(input: PendingTranscriptionStart) {
    if (!voiceSettingsKnown) {
      pendingTranscriptionStartRef.current = input;
      return;
    }

    pendingTranscriptionStartRef.current = null;
    if (!transcriptionEnabled) {
      transcriptionDisabledByMainRef.current = false;
      clearTranscriptionRuntime({ clearPcm: true });
      return;
    }

    transcriptionDisabledByMainRef.current = false;
    const startPromise = startActiveTranscription(input).finally(() => {
      if (activeTranscriptionStartPromiseRef.current === startPromise) {
        activeTranscriptionStartPromiseRef.current = null;
      }
    });
    activeTranscriptionStartPromiseRef.current = startPromise;
    void startPromise.catch(() => {});
  }

  function flushBufferedTranscriptionAudio(recordingSession: number, timeOffsetMs: number) {
    for (const capturedPcmChunk of capturedPcmChunksRef.current) {
      if (capturedPcmChunk.endTimeMs <= timeOffsetMs) {
        continue;
      }
      const chunk =
        capturedPcmChunk.startTimeMs < timeOffsetMs
          ? trimPcmChunkStart(capturedPcmChunk.chunk, timeOffsetMs - capturedPcmChunk.startTimeMs)
          : capturedPcmChunk.chunk;
      if (chunk) {
        sendActiveTranscriptionAudio(recordingSession, chunk);
      }
    }
  }

  function sendActiveTranscriptionAudio(recordingSession: number, chunk: Uint8Array) {
    const activeTranscription = activeTranscriptionRef.current;
    if (
      !activeTranscription ||
      !activeTranscription.acceptsAudio ||
      activeTranscription.recordingSession !== recordingSession
    ) {
      return;
    }
    const queuedChunk = new Uint8Array(chunk);
    let queue = transcriptionAudioQueueRef.current;
    if (!queue || !transcriptionQueueMatchesActive(queue, activeTranscription)) {
      queue = {
        recordingFlowSessionId: activeTranscription.recordingFlowSessionId,
        recordingSessionId: activeTranscription.recordingSessionId,
        recordingSession,
        revisionId: activeTranscription.revisionId,
        queuedBytes: 0,
        tail: Promise.resolve(),
      };
      transcriptionAudioQueueRef.current = queue;
    }
    if (queue.queuedBytes + queuedChunk.byteLength > MAX_TRANSCRIPTION_AUDIO_QUEUE_BYTES) {
      activeTranscription.acceptsAudio = false;
      finalTranscriptionNeedsBackfillRef.current = true;
      notifyRecordingError('实时转写暂时不可用，录音会继续保存。');
      closeActiveTranscription(recordingSession);
      return;
    }

    queue.queuedBytes += queuedChunk.byteLength;
    queue.tail = queue.tail
      .catch(() => {})
      .then(async () => {
        if (
          recordingSessionRef.current !== recordingSession ||
          activeTranscriptionRef.current !== activeTranscription
        ) {
          return;
        }
        const response = await sendRecordingTranscriptionAudio({
          chunk: queuedChunk,
          recordingFlowSessionId: activeTranscription.recordingFlowSessionId,
          recordingSessionId: activeTranscription.recordingSessionId,
          revisionId: activeTranscription.revisionId,
          workspaceHandle: activeTranscription.workspaceHandle,
        });
        if (
          recordingSessionRef.current !== recordingSession ||
          activeTranscriptionRef.current !== activeTranscription
        ) {
          return;
        }
        if (response.ok && response.value.accepted) {
          return;
        }
        activeTranscription.acceptsAudio = false;
        if (!response.ok && isRecordingTranscriptionUnavailable(response.error)) {
          transcriptionUnavailableForSessionRef.current = true;
          finalTranscriptionNeedsBackfillRef.current = false;
          transcriptionAudioQueueRef.current = null;
          clearCapturedTranscriptionPcm();
        } else {
          finalTranscriptionNeedsBackfillRef.current = true;
        }
        notifyRecordingError(
          response.ok
            ? '实时转写暂时不可用，录音会继续保存。'
            : workspaceErrorDisplayMessage(response.error, '实时转写暂时不可用。')
        );
        closeActiveTranscription(recordingSession);
      })
      .catch((error) => {
        if (
          recordingSessionRef.current === recordingSession &&
          activeTranscriptionRef.current === activeTranscription
        ) {
          activeTranscription.acceptsAudio = false;
          finalTranscriptionNeedsBackfillRef.current = true;
          notifyRecordingError(unknownErrorDisplayMessage(error, '实时转写暂时不可用。'));
          closeActiveTranscription(recordingSession);
        }
      })
      .finally(() => {
        queue.queuedBytes = Math.max(0, queue.queuedBytes - queuedChunk.byteLength);
      });
    void queue.tail.catch(() => {});
  }

  function resetRecordingDurationClock(startedAtMs: number | null = null) {
    recordingDurationRef.current = { accumulatedMs: 0, startedAtMs };
  }

  function clearShortRecordingNotice() {
    shortRecordingCompletionArmedRef.current = false;
    setShortRecordingNoticeVisible(false);
  }

  function shouldHoldShortRecordingSave(durationMs: number) {
    if (durationMs >= MIN_EFFECTIVE_RECORDING_DURATION_MS) {
      clearShortRecordingNotice();
      return false;
    }
    if (shortRecordingCompletionArmedRef.current) {
      setShortRecordingNoticeVisible(false);
      return false;
    }
    shortRecordingCompletionArmedRef.current = true;
    setShortRecordingNoticeVisible(true);
    return true;
  }

  function pauseRecordingDurationClock() {
    const clock = recordingDurationRef.current;
    if (clock.startedAtMs === null) {
      return;
    }
    recordingDurationRef.current = {
      accumulatedMs: clock.accumulatedMs + Math.max(0, performance.now() - clock.startedAtMs),
      startedAtMs: null,
    };
  }

  function resumeRecordingDurationClock() {
    const clock = recordingDurationRef.current;
    if (clock.startedAtMs !== null) {
      return;
    }
    recordingDurationRef.current = {
      accumulatedMs: clock.accumulatedMs,
      startedAtMs: performance.now(),
    };
  }

  function readRecordingDurationMs() {
    const clock = recordingDurationRef.current;
    const activeMs =
      clock.startedAtMs === null ? 0 : Math.max(0, performance.now() - clock.startedAtMs);
    return Math.round(clock.accumulatedMs + activeMs);
  }

  function pauseRecordingAt(durationMs: number) {
    const safeDurationMs = Math.max(0, Math.round(durationMs));
    const pausedRecordingSession = recordingSessionRef.current;
    setDraftPlaybackPreview({
      chunkCount: capturedChunksRef.current.length,
      session: pausedRecordingSession,
      status: 'preparing',
      url: null,
    });
    recordingDurationRef.current = {
      accumulatedMs: safeDurationMs,
      startedAtMs: null,
    };
    setElapsedMs(safeDurationMs);
    setTimeline((current) =>
      moveRecordingCursor(
        createRecordingTimeline({
          ...current,
          totalDurationMs: safeDurationMs,
        }),
        safeDurationMs
      )
    );
    persistRecoveryAudioChunksSnapshot(safeDurationMs, { force: true });
    persistRecoveryWaveformSnapshot(safeDurationMs, waveformSamples, { force: true });
    liveAudioInputActiveRef.current = false;
    const controller = controllerRef.current;
    controller?.pause();
    const previewFlush = controller?.flush() ?? Promise.resolve(false);
    void previewFlush
      .then((flushed) => {
        if (
          recordingSessionRef.current !== pausedRecordingSession ||
          draftPlaybackPreviewRef.current.session !== pausedRecordingSession
        ) {
          return;
        }
        if (!flushed && capturedChunksRef.current.length === 0) {
          setDraftPlaybackPreview({
            chunkCount: 0,
            session: pausedRecordingSession,
            status: 'unavailable',
            url: null,
          });
          return;
        }
        prepareDraftPlaybackPreviewForSession(pausedRecordingSession);
      })
      .catch(() => {
        if (
          recordingSessionRef.current !== pausedRecordingSession ||
          draftPlaybackPreviewRef.current.session !== pausedRecordingSession
        ) {
          return;
        }
        if (capturedChunksRef.current.length > 0) {
          prepareDraftPlaybackPreviewForSession(pausedRecordingSession);
          return;
        }
        setDraftPlaybackPreview({
          chunkCount: 0,
          session: pausedRecordingSession,
          status: 'unavailable',
          url: null,
        });
      });
    void finishActiveTranscription(recordingSessionRef.current).catch((error) => {
      notifyRecordingError(unknownErrorDisplayMessage(error, '最终转写未返回，录音会继续保存。'));
    });
    setState((current) => transitionRecordingState(current, { type: 'pause-requested' }));
  }

  function stopDraftPlayback() {
    if (draftPlaybackPreviewRef.current.url) {
      draftAudioRef.current?.pause();
    }
    setIsDraftPlaybackPlaying(false);
  }

  function cancelDraftPlaybackPreview(status: DraftPlaybackStatus = 'idle') {
    stopDraftPlayback();
    setDraftPlaybackPreview({
      chunkCount: 0,
      session: null,
      status,
      url: null,
    });
  }

  function buildDraftPlaybackUrl() {
    const chunks = capturedChunksRef.current.map((capturedChunk) => capturedChunk.chunk);
    if (chunks.length === 0) {
      return null;
    }
    return URL.createObjectURL(new Blob(chunks as BlobPart[], { type: 'audio/webm' }));
  }

  function isDraftAudioSource(audio: HTMLAudioElement, source: string) {
    return (
      audio.src === source || audio.currentSrc === source || audio.getAttribute('src') === source
    );
  }

  function isDraftAudioReadyForSource(audio: HTMLAudioElement, source: string) {
    return (
      isDraftAudioSource(audio, source) && audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    );
  }

  function waitForDraftPlaybackReady(audio: HTMLAudioElement, source: string) {
    if (isDraftAudioReadyForSource(audio, source)) {
      return Promise.resolve(true);
    }

    return new Promise<boolean>((resolve) => {
      let timeout: number | null = null;
      let settled = false;
      const finish = (ready: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeout !== null) {
          window.clearTimeout(timeout);
          timeout = null;
        }
        audio.removeEventListener('canplay', handleReady);
        audio.removeEventListener('loadeddata', handleReady);
        audio.removeEventListener('error', handleError);
        resolve(ready);
      };
      const handleReady = () => finish(isDraftAudioSource(audio, source));
      const handleError = () => finish(false);
      audio.addEventListener('canplay', handleReady);
      audio.addEventListener('loadeddata', handleReady);
      audio.addEventListener('error', handleError);
      timeout = window.setTimeout(() => {
        finish(isDraftAudioReadyForSource(audio, source));
      }, DRAFT_PLAYBACK_READY_TIMEOUT_MS);
      try {
        audio.load();
      } catch {
        finish(false);
      }
    });
  }

  async function prepareDraftPlaybackPreview(source: string) {
    const audio = draftAudioRef.current;
    if (!audio) {
      return false;
    }
    audio.src = source;
    return waitForDraftPlaybackReady(audio, source);
  }

  function prepareDraftPlaybackPreviewForSession(recordingSession: number) {
    const chunkCount = capturedChunksRef.current.length;
    if (chunkCount === 0) {
      setDraftPlaybackPreview({
        chunkCount: 0,
        session: recordingSession,
        status: 'unavailable',
        url: null,
      });
      return;
    }
    stopDraftPlayback();
    const playbackSource = buildDraftPlaybackUrl();
    if (!playbackSource) {
      setDraftPlaybackPreview({
        chunkCount: 0,
        session: recordingSession,
        status: 'unavailable',
        url: null,
      });
      return;
    }
    const preparingPreview = {
      chunkCount,
      session: recordingSession,
      status: 'preparing' as const,
      url: playbackSource,
    };
    setDraftPlaybackPreview(preparingPreview);
    void prepareDraftPlaybackPreview(playbackSource)
      .then((ready) => {
        const currentPreview = draftPlaybackPreviewRef.current;
        if (
          recordingSessionRef.current !== recordingSession ||
          currentPreview.session !== recordingSession ||
          currentPreview.url !== playbackSource ||
          currentPreview.chunkCount !== chunkCount
        ) {
          return;
        }
        setDraftPlaybackPreview({
          ...currentPreview,
          status: ready ? 'ready' : 'unavailable',
        });
      })
      .catch(() => {
        const currentPreview = draftPlaybackPreviewRef.current;
        if (
          recordingSessionRef.current !== recordingSession ||
          currentPreview.session !== recordingSession ||
          currentPreview.url !== playbackSource ||
          currentPreview.chunkCount !== chunkCount
        ) {
          return;
        }
        setDraftPlaybackPreview({
          ...currentPreview,
          status: 'unavailable',
        });
      });
  }

  function recoveryAudioChunkFromCaptured({
    chunk,
    endTimeMs,
    startTimeMs,
  }: CapturedRecordingChunk) {
    return {
      byteLength: chunk.byteLength,
      endTimeMs,
      startTimeMs,
    };
  }

  function setCapturedChunks(chunks: readonly CapturedRecordingChunk[]) {
    cancelDraftPlaybackPreview();
    capturedChunksRef.current = [...chunks];
    recoveryAudioChunksRef.current = chunks.map(recoveryAudioChunkFromCaptured);
  }

  function recoveryAudioChunksSnapshot() {
    return recoveryAudioChunksRef.current;
  }

  function persistRecoveryAudioChunksSnapshot(
    durationMs: number,
    { force = false }: { readonly force?: boolean } = {}
  ) {
    const activeDraft = activeDraftRef.current;
    const audioChunkCount = recoveryAudioChunksRef.current.length;
    if (!activeDraft) {
      persistRecoveryDuration(durationMs, { force });
      return;
    }
    const safeDurationMs = Math.max(0, Math.round(durationMs));
    if (
      !force &&
      lastRecoveryAudioChunkCountPersistedRef.current > 0 &&
      safeDurationMs - lastRecoveryAudioChunksPersistedMsRef.current < 1_000
    ) {
      persistRecoveryDuration(safeDurationMs);
      return;
    }
    lastRecoveryAudioChunksPersistedMsRef.current = safeDurationMs;
    lastRecoveryAudioChunkCountPersistedRef.current = audioChunkCount;
    lastRecoveryDurationPersistedMsRef.current = safeDurationMs;
    updateRecordingRecoverySnapshot({
      patch: {
        audioChunks: recoveryAudioChunksSnapshot(),
        durationMs: safeDurationMs,
      },
      segmentId: activeDraft.segmentId,
      workspaceId: workspaceSession.workspaceId,
    });
  }

  function capturedChunksFromRecoveredAudio({
    audio,
    audioChunks,
    durationMs,
  }: {
    readonly audio: Uint8Array;
    readonly audioChunks: readonly RecordingRecoveryAudioChunk[];
    readonly durationMs: number;
  }): readonly CapturedRecordingChunk[] {
    if (audio.byteLength === 0) {
      return [];
    }
    if (audioChunks.length === 0) {
      return [
        {
          chunk: new Uint8Array(audio),
          endTimeMs: durationMs,
          startTimeMs: 0,
        },
      ];
    }

    const capturedChunks: CapturedRecordingChunk[] = [];
    let offset = 0;
    for (const audioChunk of audioChunks) {
      const nextOffset = offset + audioChunk.byteLength;
      if (nextOffset > audio.byteLength) {
        return [
          {
            chunk: new Uint8Array(audio),
            endTimeMs: durationMs,
            startTimeMs: 0,
          },
        ];
      }
      capturedChunks.push({
        chunk: audio.slice(offset, nextOffset),
        endTimeMs: audioChunk.endTimeMs,
        startTimeMs: audioChunk.startTimeMs,
      });
      offset = nextOffset;
    }
    if (offset < audio.byteLength) {
      capturedChunks.push({
        chunk: audio.slice(offset),
        endTimeMs: durationMs,
        startTimeMs: capturedChunks.at(-1)?.endTimeMs ?? 0,
      });
    }
    return capturedChunks;
  }

  function recoveredDraftAudioReadLimit(audioChunks: readonly RecordingRecoveryAudioChunk[]) {
    const mappedByteLength = audioChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    return mappedByteLength > 0
      ? Math.min(mappedByteLength, MAX_RECORDING_DRAFT_AUDIO_READ_BYTES)
      : null;
  }

  async function restoreRecoveredDraftAudio({
    audioChunks,
    durationMs,
    segmentId,
    restoredSegmentId,
  }: {
    readonly audioChunks: readonly RecordingRecoveryAudioChunk[];
    readonly durationMs: number;
    readonly segmentId: string;
    readonly restoredSegmentId: string;
  }) {
    const readLimit = recoveredDraftAudioReadLimit(audioChunks);
    if (readLimit === null) {
      notifyRecordingError('无法恢复录音预览，但仍可保存未完成录音。');
      return;
    }
    const response = await readRecordingDraftAudio({
      maxBytes: readLimit,
      segmentId,
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    if (
      restoredSegmentIdRef.current !== restoredSegmentId ||
      activeDraftRef.current?.segmentId !== segmentId
    ) {
      return;
    }
    if (!response.ok) {
      notifyRecordingError(
        workspaceErrorDisplayMessage(response.error, '无法恢复录音预览，但仍可保存未完成录音。')
      );
      return;
    }

    const restoredChunks = capturedChunksFromRecoveredAudio({
      audio: response.value.audio,
      audioChunks,
      durationMs,
    });
    setCapturedChunks(restoredChunks);
    prepareDraftPlaybackPreviewForSession(recordingSessionRef.current);
    lastCapturedChunkEndMsRef.current = restoredChunks.at(-1)?.endTimeMs ?? durationMs;
    sequenceRef.current = response.value.nextSequence;
    updateRecordingRecoverySnapshot({
      patch: {
        audioChunks: recoveryAudioChunksSnapshot(),
        nextSequence: response.value.nextSequence,
      },
      segmentId,
      workspaceId: workspaceSession.workspaceId,
    });
  }

  function writeRecoveryMarker(
    segmentId: string,
    durationMs: number,
    {
      recordingSessionId = timeline.recordingSessionId,
      revisionId = activeRevisionIdRef.current,
    }: { readonly recordingSessionId?: string; readonly revisionId?: string } = {}
  ) {
    const targetFields =
      recordingTarget.kind === 'segment-supplement'
        ? {
            memoryId: recordingTarget.memoryId,
            parentSegmentId: recordingTarget.segmentId,
            targetKind: 'segment-supplement' as const,
          }
        : {
            memoryId: recordingTarget.memoryId,
            targetKind: 'segment' as const,
          };
    lastRecoveryDurationPersistedMsRef.current = Math.max(0, Math.round(durationMs));
    lastRecoveryAudioChunksPersistedMsRef.current = Math.max(0, Math.round(durationMs));
    lastRecoveryAudioChunkCountPersistedRef.current = recoveryAudioChunksRef.current.length;
    writeRecordingRecoveryDraft({
      audioChunks: recoveryAudioChunksSnapshot(),
      durationMs,
      ...targetFields,
      nextSequence: sequenceRef.current,
      segmentId,
      recordingSessionId,
      revisionId,
      title: titleForRecordingTarget(recordingTarget, workspaceSession),
      workspaceId: workspaceSession.workspaceId,
    });
  }

  function persistRecoveryDuration(
    durationMs: number,
    { force = false }: { readonly force?: boolean } = {}
  ) {
    const activeDraft = activeDraftRef.current;
    if (!activeDraft) {
      return;
    }
    const safeDurationMs = Math.max(0, Math.round(durationMs));
    if (!force && safeDurationMs - lastRecoveryDurationPersistedMsRef.current < 1_000) {
      return;
    }
    lastRecoveryDurationPersistedMsRef.current = safeDurationMs;
    updateRecordingRecoveryDuration({
      durationMs: safeDurationMs,
      segmentId: activeDraft.segmentId,
      workspaceId: workspaceSession.workspaceId,
    });
  }

  function persistRecoveryWaveformSnapshot(
    durationMs: number,
    samples: readonly number[],
    { force = false }: { readonly force?: boolean } = {}
  ) {
    const activeDraft = activeDraftRef.current;
    if (!activeDraft) {
      return;
    }
    const safeDurationMs = Math.max(0, Math.round(durationMs));
    if (!force && safeDurationMs - lastRecoveryWaveformPersistedMsRef.current < 1_000) {
      return;
    }
    lastRecoveryWaveformPersistedMsRef.current = safeDurationMs;
    updateRecordingRecoverySnapshot({
      patch: {
        durationMs: safeDurationMs,
        waveformSamples: samples,
      },
      segmentId: activeDraft.segmentId,
      workspaceId: workspaceSession.workspaceId,
    });
  }

  function clearRecoveryMarker(segmentId: string) {
    clearRecordingRecoveryDraft({
      segmentId,
      workspaceId: workspaceSession.workspaceId,
    });
    lastRecoveryDurationPersistedMsRef.current = 0;
    lastRecoveryWaveformPersistedMsRef.current = 0;
    lastRecoveryAudioChunksPersistedMsRef.current = 0;
    lastRecoveryAudioChunkCountPersistedRef.current = 0;
  }

  async function discardDraftAndClearRecoveryOnSuccess(segmentId: string) {
    const response =
      recordingTarget.kind === 'segment-supplement'
        ? await discardSegmentSupplementRecordingDraft({
            supplementId: segmentId,
            workspaceHandle: workspaceSession.workspaceHandle,
          })
        : await discardRecordingDraft({
            segmentId,
            workspaceHandle: workspaceSession.workspaceHandle,
          });
    if (response.ok) {
      clearRecoveryMarker(segmentId);
    }
    return response;
  }

  function captureLiveChunk(chunk: Uint8Array) {
    const startTimeMs = lastCapturedChunkEndMsRef.current;
    const endTimeMs = Math.max(startTimeMs + 1, readRecordingDurationMs());
    lastCapturedChunkEndMsRef.current = endTimeMs;
    const capturedChunk = { chunk, endTimeMs, startTimeMs };
    capturedChunksRef.current.push(capturedChunk);
    recoveryAudioChunksRef.current.push(recoveryAudioChunkFromCaptured(capturedChunk));
    persistRecoveryAudioChunksSnapshot(endTimeMs);
    const pausedPreviewSession = draftPlaybackPreviewRef.current.session;
    if (pausedPreviewSession !== null && pausedPreviewSession === recordingSessionRef.current) {
      prepareDraftPlaybackPreviewForSession(pausedPreviewSession);
    }
  }

  function captureLivePcmChunk(chunk: Uint8Array) {
    if (chunk.byteLength === 0) {
      return;
    }
    const startTimeMs = lastCapturedPcmChunkEndMsRef.current;
    const durationMs = pcmByteLengthToDurationMs(chunk.byteLength);
    const endTimeMs = startTimeMs + durationMs;
    lastCapturedPcmChunkEndMsRef.current = endTimeMs;
    const nextChunk = { chunk: new Uint8Array(chunk), endTimeMs, startTimeMs };
    if (
      completionBackfillTooLargeRef.current ||
      endTimeMs > MAX_COMPLETION_BACKFILL_PCM_DURATION_MS
    ) {
      completionBackfillTooLargeRef.current = true;
      const minimumStartMs = Math.max(0, endTimeMs - TRANSCRIPTION_START_BUFFER_MS);
      capturedPcmChunksRef.current.push(nextChunk);
      capturedPcmChunksRef.current = capturedPcmChunksRef.current.filter(
        (capturedPcmChunk) => capturedPcmChunk.endTimeMs > minimumStartMs
      );
      return;
    }
    capturedPcmChunksRef.current.push(nextChunk);
  }

  function appendWaveformLevel(samples: readonly number[]) {
    const durationMs = readRecordingDurationMs();
    if (durationMs - lastWaveformSampleAtMsRef.current < WAVEFORM_SAMPLE_INTERVAL_MS) {
      return;
    }
    lastWaveformSampleAtMsRef.current = durationMs;
    const rawAverageLevel =
      samples.reduce((sum, sample) => sum + Math.min(1, Math.max(0, sample)), 0) /
      Math.max(1, samples.length);
    if (rawAverageLevel >= AUDIBLE_LEVEL_THRESHOLD) {
      lastNoticeableAudioAtMsRef.current = durationMs;
      silenceNoticeShownRef.current = false;
    } else if (
      !silenceNoticeShownRef.current &&
      durationMs - lastNoticeableAudioAtMsRef.current >= SILENCE_NOTICE_THRESHOLD_MS
    ) {
      silenceNoticeShownRef.current = true;
      toast(SILENCE_NOTICE);
    }
    const averageLevel =
      samples.reduce((sum, sample) => sum + Math.min(1, Math.max(0.06, sample)), 0) /
      Math.max(1, samples.length);
    setWaveformSamples((current) => {
      const next = appendBoundedWaveformSample(current, averageLevel);
      persistRecoveryWaveformSnapshot(durationMs, next);
      return next;
    });
  }

  function truncateWaveformSamplesAt(cursorMs: number, totalDurationMs: number) {
    setWaveformSamples((current) => {
      if (totalDurationMs <= 0 || current.length === 0) {
        return [];
      }
      const retainedCount = Math.min(
        current.length,
        Math.max(0, Math.ceil((cursorMs / totalDurationMs) * current.length))
      );
      const next = current.slice(0, retainedCount);
      persistRecoveryWaveformSnapshot(cursorMs, next, { force: true });
      return next;
    });
  }

  function byteLengthForChunks(chunks: readonly CapturedRecordingChunk[]) {
    return chunks.reduce((sum, chunk) => sum + chunk.chunk.byteLength, 0);
  }

  function failActiveRecording(
    message: string,
    recordingSession: number,
    { discardDraft = false }: { readonly discardDraft?: boolean } = {}
  ) {
    if (recordingSessionRef.current !== recordingSession) {
      return;
    }
    recordingSessionRef.current += 1;
    liveAudioInputActiveRef.current = false;
    appendFailureRef.current = message;
    const controller = controllerRef.current;
    controllerRef.current = null;
    void controller?.stop().catch(() => {});
    closeActiveTranscription(recordingSession);
    if (discardDraft) {
      discardActiveDraft(recordingSession);
    }
    setState((current) => transitionRecordingState(current, { type: 'failed' }));
    onOpenChange(true);
    notifyRecordingError(message);
  }

  function appendChunk(segmentId: string, recordingSession: number, chunk: Uint8Array) {
    if (recordingSessionRef.current !== recordingSession) {
      return;
    }
    appendQueueRef.current = appendQueueRef.current.then(async () => {
      try {
        if (recordingSessionRef.current !== recordingSession) {
          return;
        }
        const response =
          recordingTarget.kind === 'segment-supplement'
            ? await appendSegmentSupplementRecordingAudioChunk({
                supplementId: segmentId,
                chunk,
                sequence: sequenceRef.current,
                workspaceHandle: workspaceSession.workspaceHandle,
              })
            : await appendRecordingAudioChunk({
                chunk,
                segmentId,
                sequence: sequenceRef.current,
                workspaceHandle: workspaceSession.workspaceHandle,
              });
        if (recordingSessionRef.current !== recordingSession) {
          return;
        }
        if (!response.ok) {
          const message = workspaceErrorDisplayMessage(response.error, '音频写入失败。');
          appendFailureRef.current = message;
          failActiveRecording(message, recordingSession, { discardDraft: true });
          throw new Error(message);
        }
        sequenceRef.current = response.value.nextSequence;
      } catch (appendError) {
        if (recordingSessionRef.current !== recordingSession) {
          return;
        }
        const message =
          appendFailureRef.current ?? unknownErrorDisplayMessage(appendError, '音频写入失败。');
        appendFailureRef.current = message;
        failActiveRecording(message, recordingSession, { discardDraft: true });
        throw appendError;
      }
    });
    // Keep the queue rejected for handleStop while preventing an unhandled rejection.
    void appendQueueRef.current.catch(() => {});
  }

  function recordingMediaHandlers({
    recordingSession,
  }: {
    readonly recordingSession: number;
  }): RecordingMediaHandlers {
    const shouldInstallPcmHandler = !transcriptionDisabled;
    return {
      onChunk: (chunk) => {
        if (recordingSessionRef.current !== recordingSession) {
          return;
        }
        captureLiveChunk(chunk);
        const activeDraft = activeDraftRef.current;
        if (!activeDraft || activeDraft.recordingSession !== recordingSession) {
          return;
        }
        appendChunk(activeDraft.segmentId, recordingSession, chunk);
      },
      onError: (message) => {
        failActiveRecording(
          workspaceErrorDisplayMessage({ message }, '无法使用麦克风。'),
          recordingSession,
          { discardDraft: true }
        );
      },
      onLevel: (samples) => {
        if (recordingSessionRef.current === recordingSession && liveAudioInputActiveRef.current) {
          appendWaveformLevel(samples);
        }
      },
      ...(shouldInstallPcmHandler
        ? {
            onPcmChunk: (chunk) => {
              if (
                recordingSessionRef.current !== recordingSession ||
                !liveAudioInputActiveRef.current ||
                !shouldCaptureTranscriptionPcm()
              ) {
                return;
              }
              captureLivePcmChunk(chunk);
              sendActiveTranscriptionAudio(recordingSession, chunk);
            },
          }
        : {}),
      onStop: () => {},
    };
  }

  function startMediaControllerForDraft({
    recordingSession,
  }: {
    readonly recordingSession: number;
  }) {
    const activeMediaAdapter = mediaAdapter ?? createBrowserMediaRecorderAdapter();
    return activeMediaAdapter.start(recordingMediaHandlers({ recordingSession }));
  }

  async function handleStart() {
    clearRecordingError();
    clearShortRecordingNotice();
    appendFailureRef.current = null;
    appendQueueRef.current = Promise.resolve();
    cancelDraftPlaybackPreview();
    setCapturedChunks([]);
    capturedPcmChunksRef.current = [];
    controllerRef.current = null;
    lastCapturedChunkEndMsRef.current = 0;
    lastCapturedPcmChunkEndMsRef.current = 0;
    lastNoticeableAudioAtMsRef.current = 0;
    lastRecoveryDurationPersistedMsRef.current = 0;
    lastRecoveryAudioChunksPersistedMsRef.current = 0;
    lastRecoveryAudioChunkCountPersistedRef.current = 0;
    lastRecoveryWaveformPersistedMsRef.current = 0;
    lastWaveformSampleAtMsRef.current = 0;
    revisionIndexRef.current = 0;
    longRecordingWarningShownRef.current = false;
    silenceNoticeShownRef.current = false;
    setElapsedMs(0);
    setWaveformSamples([]);
    replaceTranscriptDraft('');
    completionBackfillTooLargeRef.current = false;
    finalTranscriptionNeedsBackfillRef.current = false;
    transcriptionDisabledByMainRef.current = false;
    transcriptionUnavailableForSessionRef.current = false;
    resetRecordingDurationClock();
    const recordingSession = recordingSessionRef.current + 1;
    const recordingFlowSessionId = `recording-${recordingSession}`;
    const revisionId = `${recordingFlowSessionId}-revision-0`;
    recordingSessionRef.current = recordingSession;
    activeRevisionIdRef.current = revisionId;
    const initialTimeline = createRecordingTimeline({
      recordingSessionId: recordingFlowSessionId,
      revisionId,
    });
    timelineRef.current = initialTimeline;
    setTimeline(initialTimeline);
    setState((current) =>
      transitionRecordingState(current, {
        type: 'start-requested',
      })
    );

    const microphoneIntent = await beginMicrophoneIntent({
      recordingFlowSessionId,
      workspaceHandle: workspaceSession.workspaceHandle,
    });
    if (!microphoneIntent.ok) {
      failActiveRecording(
        workspaceErrorDisplayMessage(microphoneIntent.error, '无法使用麦克风。'),
        recordingSession
      );
      return;
    }
    if (recordingSessionRef.current !== recordingSession) {
      void clearMicrophoneIntent({
        recordingFlowSessionId,
        workspaceHandle: workspaceSession.workspaceHandle,
      }).catch(() => {});
      return;
    }
    pendingMicrophoneIntentRef.current = {
      recordingFlowSessionId,
      recordingSession,
      workspaceHandle: workspaceSession.workspaceHandle,
    };

    let nextSegmentId: string;
    let nextSequence: number;
    if (recordingTarget.kind === 'segment-supplement') {
      const draft = await createSegmentSupplementRecordingDraft({
        memoryId: recordingTarget.memoryId,
        segmentId: recordingTarget.segmentId,
        workspaceHandle: workspaceSession.workspaceHandle,
        workspaceId: workspaceSession.workspaceId,
      });
      if (!draft.ok) {
        clearPendingMicrophoneIntent(recordingSession);
        failActiveRecording(
          workspaceErrorDisplayMessage(draft.error, '无法创建录音。'),
          recordingSession
        );
        return;
      }
      nextSegmentId = draft.value.supplementId;
      nextSequence = draft.value.nextSequence;
    } else {
      const draft = await createRecordingDraft({
        workspaceHandle: workspaceSession.workspaceHandle,
      });
      if (!draft.ok) {
        clearPendingMicrophoneIntent(recordingSession);
        failActiveRecording(
          workspaceErrorDisplayMessage(draft.error, '无法创建录音。'),
          recordingSession
        );
        return;
      }
      nextSegmentId = draft.value.segmentId;
      nextSequence = draft.value.nextSequence;
    }
    sequenceRef.current = nextSequence;
    if (recordingSessionRef.current !== recordingSession) {
      clearPendingMicrophoneIntent(recordingSession);
      const discard = await discardDraftAndClearRecoveryOnSuccess(nextSegmentId).catch((error) => ({
        ok: false as const,
        error: {
          code: 'ERR_RECORDING_DISCARD_FAILED' as const,
          message: unknownErrorDisplayMessage(error, '无法清理已取消的录音草稿。'),
        },
      }));
      if (!discard.ok && !activeDraftRef.current) {
        writeRecordingRecoveryDraft({
          durationMs: 0,
          memoryId: recordingTarget.memoryId,
          nextSequence,
          ...(recordingTarget.kind === 'segment-supplement'
            ? {
                parentSegmentId: recordingTarget.segmentId,
                targetKind: 'segment-supplement' as const,
              }
            : { targetKind: 'segment' as const }),
          recordingSessionId: recordingFlowSessionId,
          revisionId,
          segmentId: nextSegmentId,
          title: titleForRecordingTarget(recordingTarget, workspaceSession),
          workspaceId: workspaceSession.workspaceId,
        });
        notifyRecordingError(
          workspaceErrorDisplayMessage(discard.error, '无法清理已取消的录音草稿。')
        );
      }
      return;
    }
    activeDraftRef.current = { segmentId: nextSegmentId, recordingSession };
    writeRecoveryMarker(nextSegmentId, 0, {
      recordingSessionId: recordingFlowSessionId,
      revisionId,
    });

    try {
      const controller = await startMediaControllerForDraft({
        recordingSession,
      });
      if (recordingSessionRef.current !== recordingSession) {
        clearPendingMicrophoneIntent(recordingSession);
        await controller.stop().catch(() => {});
        return;
      }
      forgetPendingMicrophoneIntent(recordingSession);
      resetRecordingDurationClock(performance.now());
      controllerRef.current = controller;
      liveAudioInputActiveRef.current = true;
      setState((current) =>
        transitionRecordingState(current, { segmentId: nextSegmentId, type: 'draft-ready' })
      );
      queueActiveTranscriptionStart({
        recordingFlowSessionId,
        recordingSession,
        revisionId,
        timeOffsetMs: 0,
      });
    } catch (startError) {
      clearPendingMicrophoneIntent(recordingSession);
      const message = unknownErrorDisplayMessage(startError, '无法使用麦克风。');
      failActiveRecording(message, recordingSession, { discardDraft: true });
    }
  }

  function handlePause() {
    pauseRecordingAt(readRecordingDurationMs());
  }

  async function replaceRecordingFromCursor() {
    if (replacementCopySessionRef.current !== null) {
      return;
    }
    if (state.status !== 'paused') {
      return;
    }

    const oldController = controllerRef.current;
    const oldDraft = activeDraftRef.current;
    if (!oldDraft) {
      notifyRecordingError('当前录音暂时不可替换，请先继续录音或完成保存。');
      return;
    }
    if (!oldController) {
      notifyRecordingError('恢复录音可以先保存或放弃，暂不支持继续替换。');
      return;
    }

    clearShortRecordingNotice();
    cancelDraftPlaybackPreview();
    clearRecordingError();
    const recordingSession = recordingSessionRef.current;
    const recordingFlowSessionId = timeline.recordingSessionId;
    replacementCopySessionRef.current = recordingSession;
    setState((current) =>
      transitionRecordingState(current, {
        segmentId: oldDraft.segmentId,
        type: 'replace-requested',
      })
    );
    closeActiveTranscription(recordingSession);
    const totalDurationMs = Math.max(elapsedMs, timeline.totalDurationMs);
    const replacementStartMs = resolveReplacementStartMs({
      chunks: capturedChunksRef.current,
      cursorTimeMs,
      totalDurationMs,
    });
    const replacesFromStart = replacementStartMs <= WAVEFORM_SEEK_EPSILON_MS;
    const nextRecordingSession = replacesFromStart ? recordingSession + 1 : recordingSession;
    const nextRecordingFlowSessionId = replacesFromStart
      ? `recording-${nextRecordingSession}`
      : recordingFlowSessionId;
    const nextRevisionIndex = replacesFromStart ? 0 : revisionIndexRef.current + 1;
    const nextRevisionId = `${nextRecordingFlowSessionId}-revision-${nextRevisionIndex}`;
    const retainedChunks = capturedChunksRef.current.filter(
      (chunk) => chunk.endTimeMs <= replacementStartMs + WAVEFORM_SEEK_EPSILON_MS
    );
    const retainedPcmChunks = retainPcmChunksThrough(
      capturedPcmChunksRef.current,
      replacementStartMs
    );
    const retainedByteLength = byteLengthForChunks(retainedChunks);
    const replacementNeedsTranscriptBackfill = timelineRef.current.transcriptSegments.some(
      (segment) =>
        segment.startTimeMs < replacementStartMs && replacementStartMs < segment.endTimeMs
    );

    const previousRecordingSession = recordingSessionRef.current;
    const previousSequence = sequenceRef.current;
    const previousActiveDraft = activeDraftRef.current;
    const previousCapturedChunks = capturedChunksRef.current;
    const previousCapturedPcmChunks = capturedPcmChunksRef.current;
    const previousRecoveryAudioChunks = recoveryAudioChunksRef.current;
    const previousElapsedMs = elapsedMs;
    const previousTimeline = timelineRef.current;
    const previousWaveformSamples = waveformSamples;
    const previousRecordingDuration = recordingDurationRef.current;
    const previousLastCapturedChunkEndMs = lastCapturedChunkEndMsRef.current;
    const previousLastCapturedPcmChunkEndMs = lastCapturedPcmChunkEndMsRef.current;
    const previousLastNoticeableAudioAtMs = lastNoticeableAudioAtMsRef.current;
    const previousRecoveryDurationPersistedMs = lastRecoveryDurationPersistedMsRef.current;
    const previousRecoveryAudioChunksPersistedMs = lastRecoveryAudioChunksPersistedMsRef.current;
    const previousRecoveryAudioChunkCountPersisted =
      lastRecoveryAudioChunkCountPersistedRef.current;
    const previousRecoveryWaveformPersistedMs = lastRecoveryWaveformPersistedMsRef.current;
    const previousActiveRevisionId = activeRevisionIdRef.current;
    const previousTranscriptDraft = transcriptDraftRef.current;
    const previousAppendQueue = appendQueueRef.current;
    const previousAppendFailure = appendFailureRef.current;
    const previousFinalTranscriptionNeedsBackfill = finalTranscriptionNeedsBackfillRef.current;
    const previousCompletionBackfillTooLarge = completionBackfillTooLargeRef.current;
    const previousSilenceNoticeShown = silenceNoticeShownRef.current;
    const previousRevisionIndex = revisionIndexRef.current;
    let nextSegmentId: string | null = null;

    try {
      await appendQueueRef.current;
      if (recordingSessionRef.current !== recordingSession) {
        throw new Error('录音替换已取消。');
      }
      const draft = await createRecordingDraft({
        workspaceHandle: workspaceSession.workspaceHandle,
      });
      if (!draft.ok) {
        throw new Error(workspaceErrorDisplayMessage(draft.error, '无法创建替换录音。'));
      }
      const replacementSegmentId = draft.value.segmentId;
      nextSegmentId = replacementSegmentId;
      sequenceRef.current = draft.value.nextSequence;
      appendQueueRef.current = Promise.resolve();
      appendFailureRef.current = null;
      if (!replacesFromStart) {
        const cloned = await cloneRecordingDraftPrefix({
          nextSequence: draft.value.nextSequence,
          retainedByteLength,
          sourceSegmentId: oldDraft.segmentId,
          targetSegmentId: replacementSegmentId,
          workspaceHandle: workspaceSession.workspaceHandle,
        });
        if (recordingSessionRef.current !== recordingSession) {
          throw new Error('录音替换已取消。');
        }
        if (!cloned.ok) {
          throw new Error(
            workspaceErrorDisplayMessage(cloned.error, '无法保留替换位置之前的录音。')
          );
        }
        sequenceRef.current = cloned.value.nextSequence;
      }
      replacementCopySessionRef.current = null;
      activeDraftRef.current = {
        segmentId: replacementSegmentId,
        recordingSession: nextRecordingSession,
      };
      setCapturedChunks(retainedChunks);
      capturedPcmChunksRef.current = retainedPcmChunks;
      lastCapturedChunkEndMsRef.current = replacementStartMs;
      lastCapturedPcmChunkEndMsRef.current = replacementStartMs;
      writeRecoveryMarker(replacementSegmentId, replacementStartMs, {
        recordingSessionId: nextRecordingFlowSessionId,
        revisionId: nextRevisionId,
      });
      persistRecoveryAudioChunksSnapshot(replacementStartMs, { force: true });
      lastNoticeableAudioAtMsRef.current = replacementStartMs;
      lastRecoveryWaveformPersistedMsRef.current = replacementStartMs;
      lastWaveformSampleAtMsRef.current = replacementStartMs;
      silenceNoticeShownRef.current = false;
      revisionIndexRef.current = nextRevisionIndex;
      activeRevisionIdRef.current = nextRevisionId;
      finalTranscriptionNeedsBackfillRef.current = replacementNeedsTranscriptBackfill;
      completionBackfillTooLargeRef.current = false;
      setElapsedMs(replacementStartMs);
      truncateWaveformSamplesAt(replacementStartMs, totalDurationMs);
      const replacementTimeline = createRecordingTimeline({
        ...startReplacementAtCursor(
          createRecordingTimeline({
            ...timelineRef.current,
            totalDurationMs,
          }),
          {
            cursorTimeMs: replacementStartMs,
            nextRevisionId,
          }
        ),
        recordingSessionId: nextRecordingFlowSessionId,
        revisionId: nextRevisionId,
      });
      timelineRef.current = replacementTimeline;
      setTimeline(replacementTimeline);
      const replacementTranscript = transcriptMarkdownFromSegments(
        replacementTimeline.transcriptSegments
      );
      replaceTranscriptDraft(replacementTranscript);
      updateRecordingRecoverySnapshot({
        patch: {
          durationMs: replacementStartMs,
          recordingSessionId: nextRecordingFlowSessionId,
          revisionId: nextRevisionId,
          transcriptMarkdown: replacementTranscript,
          transcriptSegments: replacementTimeline.transcriptSegments,
        },
        segmentId: replacementSegmentId,
        workspaceId: workspaceSession.workspaceId,
      });
      let nextController = oldController;
      if (replacesFromStart) {
        const microphoneIntent = await beginMicrophoneIntent({
          recordingFlowSessionId: nextRecordingFlowSessionId,
          workspaceHandle: workspaceSession.workspaceHandle,
        });
        if (!microphoneIntent.ok) {
          throw new Error(workspaceErrorDisplayMessage(microphoneIntent.error, '无法使用麦克风。'));
        }
        pendingMicrophoneIntentRef.current = {
          recordingFlowSessionId: nextRecordingFlowSessionId,
          recordingSession: nextRecordingSession,
          workspaceHandle: workspaceSession.workspaceHandle,
        };
        recordingSessionRef.current = nextRecordingSession;
        nextController = await startMediaControllerForDraft({
          recordingSession: nextRecordingSession,
        });
        if (recordingSessionRef.current !== nextRecordingSession) {
          clearPendingMicrophoneIntent(nextRecordingSession);
          await nextController.stop().catch(() => {});
          throw new Error('录音替换已取消。');
        }
        forgetPendingMicrophoneIntent(nextRecordingSession);
        void oldController.stop().catch(() => {});
      } else {
        oldController.resume();
      }
      controllerRef.current = nextController;
      queueActiveTranscriptionStart({
        recordingFlowSessionId: nextRecordingFlowSessionId,
        recordingSession: nextRecordingSession,
        revisionId: nextRevisionId,
        timeOffsetMs: replacementStartMs,
      });
      recordingDurationRef.current = {
        accumulatedMs: replacementStartMs,
        startedAtMs: performance.now(),
      };
      liveAudioInputActiveRef.current = true;
      setState((current) =>
        transitionRecordingState(current, {
          segmentId: replacementSegmentId,
          type: 'resume-requested',
        })
      );
      void discardRecordingDraft({
        segmentId: oldDraft.segmentId,
        workspaceHandle: workspaceSession.workspaceHandle,
      }).catch(() => {});
    } catch (replaceError) {
      const replacementStillCurrent =
        replacementCopySessionRef.current === recordingSession ||
        recordingSessionRef.current === recordingSession ||
        recordingSessionRef.current === nextRecordingSession;
      if (!replacementStillCurrent) {
        clearPendingMicrophoneIntent(nextRecordingSession);
        closeActiveTranscription(recordingSession);
        closeActiveTranscription(nextRecordingSession);
        replacementCopySessionRef.current = null;
        if (nextSegmentId) {
          void discardDraftAndClearRecoveryOnSuccess(nextSegmentId).catch(() => {});
        }
        return;
      }
      try {
        oldController.pause();
      } catch {
        // Best effort rollback after a partially resumed media controller.
      }
      clearPendingMicrophoneIntent(nextRecordingSession);
      closeActiveTranscription(recordingSession);
      closeActiveTranscription(nextRecordingSession);
      replacementCopySessionRef.current = null;
      recordingSessionRef.current = previousRecordingSession;
      sequenceRef.current = previousSequence;
      activeDraftRef.current = previousActiveDraft;
      setCapturedChunks(previousCapturedChunks);
      recoveryAudioChunksRef.current = [...previousRecoveryAudioChunks];
      capturedPcmChunksRef.current = previousCapturedPcmChunks;
      lastCapturedChunkEndMsRef.current = previousLastCapturedChunkEndMs;
      lastCapturedPcmChunkEndMsRef.current = previousLastCapturedPcmChunkEndMs;
      lastRecoveryDurationPersistedMsRef.current = previousRecoveryDurationPersistedMs;
      lastRecoveryAudioChunksPersistedMsRef.current = previousRecoveryAudioChunksPersistedMs;
      lastRecoveryAudioChunkCountPersistedRef.current = previousRecoveryAudioChunkCountPersisted;
      lastRecoveryWaveformPersistedMsRef.current = previousRecoveryWaveformPersistedMs;
      activeRevisionIdRef.current = previousActiveRevisionId;
      replaceTranscriptDraft(previousTranscriptDraft);
      appendQueueRef.current = previousAppendQueue;
      appendFailureRef.current = previousAppendFailure;
      finalTranscriptionNeedsBackfillRef.current = previousFinalTranscriptionNeedsBackfill;
      completionBackfillTooLargeRef.current = previousCompletionBackfillTooLarge;
      silenceNoticeShownRef.current = previousSilenceNoticeShown;
      revisionIndexRef.current = previousRevisionIndex;
      lastNoticeableAudioAtMsRef.current = previousLastNoticeableAudioAtMs;
      recordingDurationRef.current = previousRecordingDuration;
      liveAudioInputActiveRef.current = false;
      setElapsedMs(previousElapsedMs);
      timelineRef.current = previousTimeline;
      setTimeline(previousTimeline);
      setWaveformSamples(previousWaveformSamples);
      if (previousActiveDraft) {
        writeRecoveryMarker(previousActiveDraft.segmentId, previousElapsedMs, {
          recordingSessionId: timeline.recordingSessionId,
          revisionId: previousActiveRevisionId,
        });
      }
      if (nextSegmentId) {
        void discardDraftAndClearRecoveryOnSuccess(nextSegmentId).catch(() => {});
      }
      prepareDraftPlaybackPreviewForSession(previousRecordingSession);
      setState((current) => transitionRecordingState(current, { type: 'replace-failed' }));
      notifyRecordingError(
        unknownErrorDisplayMessage(replaceError, '替换录音失败，原录音已保留。')
      );
    }
  }

  function notifyRecoveredRecordingCannotResume() {
    if (state.status !== 'paused') {
      return;
    }
    const activeDraft = activeDraftRef.current;
    if (!activeDraft) {
      notifyRecordingError('当前录音暂时不可继续，请先完成保存。');
      return;
    }

    notifyRecordingError('恢复录音可以先保存或放弃，暂不支持继续录制。');
  }

  function handleResume() {
    if (state.status === 'paused' && hasTailAfterCursor(timeline)) {
      if (recordingTarget.kind === 'segment-supplement') {
        notifyRecordingError('补充录音暂不支持从中间替换，可以保存后再补充一段。');
        return;
      }
      void replaceRecordingFromCursor();
      return;
    }
    const resumeAtMs = readRecordingDurationMs();
    if (!controllerRef.current) {
      notifyRecoveredRecordingCannotResume();
      return;
    }
    clearShortRecordingNotice();
    cancelDraftPlaybackPreview();
    queueActiveTranscriptionStart({
      recordingFlowSessionId: timeline.recordingSessionId,
      recordingSession: recordingSessionRef.current,
      revisionId: activeRevisionIdRef.current,
      timeOffsetMs: resumeAtMs,
    });
    setTimeline((current) => moveRecordingCursor(current, resumeAtMs));
    resumeRecordingDurationClock();
    liveAudioInputActiveRef.current = true;
    controllerRef.current?.resume();
    setState((current) => transitionRecordingState(current, { type: 'resume-requested' }));
  }

  function setCursor(
    nextCursorTimeMs: number,
    { syncDraftAudio = true }: { readonly syncDraftAudio?: boolean } = {}
  ) {
    const totalDurationMs = Math.max(elapsedMs, timeline.totalDurationMs);
    const safeCursorTimeMs = Math.min(totalDurationMs, Math.max(0, Math.round(nextCursorTimeMs)));
    const draftAudio = draftAudioRef.current;
    if (
      syncDraftAudio &&
      state.status === 'paused' &&
      draftAudio &&
      Math.abs(draftAudio.currentTime * 1000 - safeCursorTimeMs) > WAVEFORM_SEEK_EPSILON_MS
    ) {
      draftAudio.currentTime = safeCursorTimeMs / 1000;
    }
    setTimeline((current) => {
      const nextTimeline = moveRecordingCursor(
        createRecordingTimeline({
          ...current,
          totalDurationMs,
        }),
        safeCursorTimeMs
      );
      if (
        nextTimeline.totalDurationMs === current.totalDurationMs &&
        Math.abs(nextTimeline.cursorTimeMs - current.cursorTimeMs) <= WAVEFORM_SEEK_EPSILON_MS
      ) {
        return current;
      }
      return nextTimeline;
    });
  }

  async function handleDraftPlayPause() {
    if (state.status !== 'paused') {
      return;
    }

    const audio = draftAudioRef.current;
    if (!audio) {
      return;
    }
    if (isDraftPlaybackPlaying) {
      audio.pause();
      setIsDraftPlaybackPlaying(false);
      return;
    }
    if (draftPlaybackStatus !== 'ready') {
      return;
    }

    const playbackSource = draftPlaybackPreviewRef.current.url;
    if (!playbackSource) {
      setDraftPlaybackPreview({
        ...draftPlaybackPreviewRef.current,
        status: 'unavailable',
      });
      return;
    }

    clearRecordingError();
    audio.src = playbackSource;
    const playbackStartMs = resolveDraftPlaybackStartMs({
      cursorTimeMs,
      totalDurationMs: Math.max(elapsedMs, timeline.totalDurationMs),
    });
    audio.currentTime = playbackStartMs / 1000;
    try {
      await Promise.resolve(audio.play());
      setIsDraftPlaybackPlaying(true);
      if (Math.abs(playbackStartMs - cursorTimeMs) > WAVEFORM_SEEK_EPSILON_MS) {
        setCursor(playbackStartMs, { syncDraftAudio: false });
      }
    } catch (playbackError) {
      setIsDraftPlaybackPlaying(false);
      notifyRecordingError(unknownErrorDisplayMessage(playbackError, '无法播放当前录音预览。'));
    }
  }

  function handleDraftPlaybackTimeUpdate() {
    const audio = draftAudioRef.current;
    if (!audio || state.status !== 'paused') {
      return;
    }
    setCursor(audio.currentTime * 1000, { syncDraftAudio: false });
  }

  function handleDraftPlaybackEnded() {
    setIsDraftPlaybackPlaying(false);
    setCursor(Math.max(elapsedMs, timeline.totalDurationMs), { syncDraftAudio: false });
  }

  async function saveFinalTranscript({
    memoryId,
    segmentId,
    recordingSession,
  }: {
    readonly memoryId: string;
    readonly segmentId: string;
    readonly recordingSession: number;
  }) {
    const markdown = transcriptDraftRef.current.trim();
    if (markdown.length === 0) {
      return true;
    }

    try {
      const response = await saveTranscript({
        markdown,
        memoryId,
        segmentId,
        workspaceHandle: workspaceSession.workspaceHandle,
      });
      if (recordingSessionRef.current !== recordingSession) {
        return false;
      }
      if (response.ok) {
        clearRecordingError();
        onRecordingContentSaved?.({ memory: response.value.memory, memoryId, segmentId });
        return true;
      }
      notifyRecordingError(
        workspaceErrorDisplayMessage(response.error, '录音已保存，转写暂时无法写入。')
      );
      return false;
    } catch (saveError) {
      if (recordingSessionRef.current === recordingSession) {
        notifyRecordingError(
          unknownErrorDisplayMessage(saveError, '录音已保存，转写暂时无法写入。')
        );
      }
      return false;
    }
  }

  async function saveFinalSegmentSupplementTranscript({
    supplementId,
    memoryId,
    recordingSession,
    segmentId,
  }: {
    readonly supplementId: string;
    readonly memoryId: string;
    readonly recordingSession: number;
    readonly segmentId: string;
  }) {
    const markdown = transcriptDraftRef.current.trim();
    if (markdown.length === 0) {
      return true;
    }

    try {
      const response = await saveSegmentSupplementTranscript({
        supplementId,
        markdown,
        memoryId,
        segmentId,
        workspaceHandle: workspaceSession.workspaceHandle,
        workspaceId: workspaceSession.workspaceId,
      });
      if (response.ok) {
        if (recordingSessionRef.current === recordingSession) {
          clearRecordingError();
        }
        onSegmentSupplementFinalized?.(
          {
            supplement: response.value.supplement,
            memory: response.value.memory,
            segment: response.value.segment,
          },
          { refreshContent: true }
        );
        return true;
      }
      if (recordingSessionRef.current === recordingSession) {
        notifyRecordingError(
          workspaceErrorDisplayMessage(response.error, '补充录音已保存，转写暂时无法写入。')
        );
      }
      return false;
    } catch (saveError) {
      if (recordingSessionRef.current === recordingSession) {
        notifyRecordingError(
          unknownErrorDisplayMessage(saveError, '补充录音已保存，转写暂时无法写入。')
        );
      }
      return false;
    }
  }

  function persistRecoveryTranscriptSnapshot(segmentId: string) {
    const currentTimeline = timelineRef.current;
    updateRecordingRecoverySnapshot({
      patch: {
        durationMs: currentTimeline.totalDurationMs,
        recordingSessionId: currentTimeline.recordingSessionId,
        revisionId: currentTimeline.revisionId,
        transcriptMarkdown: transcriptDraftRef.current,
        transcriptSegments: currentTimeline.transcriptSegments,
      },
      segmentId,
      workspaceId: workspaceSession.workspaceId,
    });
  }

  async function backfillFinalTranscript(recordingSession: number) {
    if (
      transcriptionDisabled ||
      transcriptionDisabledByMainRef.current ||
      transcriptionUnavailableForSessionRef.current
    ) {
      finalTranscriptionNeedsBackfillRef.current = false;
      return;
    }

    const needsBackfill =
      finalTranscriptionNeedsBackfillRef.current || transcriptDraftRef.current.trim().length === 0;
    if (!needsBackfill) {
      return;
    }
    if (completionBackfillTooLargeRef.current) {
      notifyRecordingError(COMPLETION_BACKFILL_UNAVAILABLE_NOTICE);
      return;
    }
    const pcmChunks = capturedPcmChunksRef.current;
    if (pcmChunks.length === 0) {
      return;
    }

    const recordingSessionId = `recording-${recordingSession}`;
    const recordingFlowSessionId = `${recordingSessionId}-completion-backfill`;
    const revisionId = activeRevisionIdRef.current;
    let shouldCloseBackfill = false;
    try {
      const started = await startRecordingTranscription({
        recordingFlowSessionId,
        recordingSessionId,
        revisionId,
        timeOffsetMs: 0,
        workspaceHandle: workspaceSession.workspaceHandle,
      });
      if (started.ok && started.value.accepted) {
        shouldCloseBackfill = true;
      }
      if (recordingSessionRef.current !== recordingSession) {
        return;
      }
      if (!started.ok) {
        notifyRecordingError(
          workspaceErrorDisplayMessage(started.error, COMPLETION_BACKFILL_UNAVAILABLE_NOTICE)
        );
        return;
      }
      if (!started.value.accepted) {
        return;
      }

      for (const capturedPcmChunk of pcmChunks) {
        if (recordingSessionRef.current !== recordingSession) {
          return;
        }
        const sent = await sendRecordingTranscriptionAudio({
          chunk: capturedPcmChunk.chunk,
          recordingFlowSessionId,
          recordingSessionId,
          revisionId,
          workspaceHandle: workspaceSession.workspaceHandle,
        });
        if (!sent.ok) {
          notifyRecordingError(
            workspaceErrorDisplayMessage(sent.error, COMPLETION_BACKFILL_UNAVAILABLE_NOTICE)
          );
          return;
        }
        if (!sent.value.accepted) {
          return;
        }
      }

      const finished = await finishRecordingTranscription({
        recordingFlowSessionId,
        recordingSessionId,
        revisionId,
        workspaceHandle: workspaceSession.workspaceHandle,
      });
      shouldCloseBackfill = false;
      if (recordingSessionRef.current !== recordingSession) {
        return;
      }
      if (!finished.ok) {
        notifyRecordingError(
          workspaceErrorDisplayMessage(finished.error, COMPLETION_BACKFILL_UNAVAILABLE_NOTICE)
        );
        return;
      }
      if (!finished.value.accepted) {
        return;
      }
      applyTranscriptionSegments(finished.value.segments ?? []);
      finalTranscriptionNeedsBackfillRef.current = false;
    } catch (backfillError) {
      if (recordingSessionRef.current === recordingSession) {
        notifyRecordingError(
          unknownErrorDisplayMessage(backfillError, COMPLETION_BACKFILL_UNAVAILABLE_NOTICE)
        );
      }
    } finally {
      if (shouldCloseBackfill) {
        closeTranscriptionSilently({
          recordingFlowSessionId,
          recordingSessionId,
          revisionId,
          workspaceHandle: workspaceSession.workspaceHandle,
        });
      }
    }
  }

  async function handleStop({
    bypassShortRecordingHold = false,
    closeImmediately = true,
  }: {
    readonly bypassShortRecordingHold?: boolean;
    readonly closeImmediately?: boolean;
  } = {}) {
    if (
      (state.status !== 'recording' && state.status !== 'paused') ||
      replacementCopySessionRef.current !== null
    ) {
      return;
    }

    const segmentId = state.segmentId;
    const recordingSession = recordingSessionRef.current;
    const controller = controllerRef.current;
    const activeDraft = activeDraftRef.current;
    if (!activeDraft || appendFailureRef.current) {
      return;
    }
    if (activeDraft.segmentId !== segmentId) {
      return;
    }
    if (!controller && state.status !== 'paused') {
      return;
    }
    const durationMs = readRecordingDurationMs();
    if (!bypassShortRecordingHold && shouldHoldShortRecordingSave(durationMs)) {
      return;
    }
    clearShortRecordingNotice();
    cancelDraftPlaybackPreview();
    pauseRecordingDurationClock();
    liveAudioInputActiveRef.current = false;
    persistRecoveryAudioChunksSnapshot(durationMs, { force: true });
    persistRecoveryWaveformSnapshot(durationMs, waveformSamples, { force: true });
    setElapsedMs(durationMs);
    setState((current) => transitionRecordingState(current, { type: 'stop-requested' }));
    if (closeImmediately) {
      onOpenChange(false);
    }
    try {
      await controller?.stop();
      await appendQueueRef.current;
      await finishActiveTranscription(recordingSession);
    } catch (stopError) {
      const message =
        appendFailureRef.current ?? unknownErrorDisplayMessage(stopError, '录音音频无法保存。');
      failActiveRecording(message, recordingSession, { discardDraft: true });
      return;
    }
    if (recordingSessionRef.current !== recordingSession) {
      return;
    }

    if (!voiceSettingsKnown) {
      failActiveRecording(VOICE_SETTINGS_LOADING_FINALIZE_NOTICE, recordingSession);
      return;
    }

    const title = titleForRecordingTarget(recordingTarget, workspaceSession);
    const finalizeTranscriptionAttempt = lastTranscriptionAttemptOnFinalize(transcriptionEnabled);
    try {
      if (recordingTarget.kind === 'segment-supplement') {
        const finalizedSupplement = await finalizeSegmentSupplementRecordingDraft({
          supplementId: segmentId,
          durationMs,
          lastTranscriptionAttemptOnFinalize: finalizeTranscriptionAttempt,
          memoryId: recordingTarget.memoryId,
          segmentId: recordingTarget.segmentId,
          title,
          workspaceHandle: workspaceSession.workspaceHandle,
          workspaceId: workspaceSession.workspaceId,
        });
        if (!finalizedSupplement.ok) {
          failActiveRecording(
            workspaceErrorDisplayMessage(finalizedSupplement.error, '无法完成补充录音保存。'),
            recordingSession
          );
          return;
        }
        controllerRef.current = null;
        activeDraftRef.current = null;
        onSegmentSupplementFinalized?.(finalizedSupplement.value);
        updateRecordingRecoverySnapshot({
          patch: { finalizedSupplement: finalizedSupplement.value },
          segmentId,
          workspaceId: workspaceSession.workspaceId,
        });
        await backfillFinalTranscript(recordingSession);
        persistRecoveryTranscriptSnapshot(segmentId);
        const transcriptSaved = await saveFinalSegmentSupplementTranscript({
          supplementId: finalizedSupplement.value.supplement.supplementId,
          memoryId: recordingTarget.memoryId,
          recordingSession,
          segmentId: recordingTarget.segmentId,
        });
        if (transcriptSaved) {
          clearRecoveryMarker(segmentId);
        }
        if (recordingSessionRef.current !== recordingSession) {
          return;
        }
        resetClosedRecordingState();
        onRecordingFlowSettled?.();
        if (!closeImmediately) {
          onOpenChange(false);
        }
        return;
      }

      const finalized = await finalizeRecordingDraft({
        durationMs,
        lastTranscriptionAttemptOnFinalize: finalizeTranscriptionAttempt,
        memoryId: recordingTarget.memoryId,
        segmentId,
        title,
        workspaceHandle: workspaceSession.workspaceHandle,
      });
      if (!finalized.ok) {
        failActiveRecording(
          workspaceErrorDisplayMessage(finalized.error, '无法完成录音保存。'),
          recordingSession
        );
        return;
      }

      controllerRef.current = null;
      activeDraftRef.current = null;
      onAudioSegmentFinalized(finalized.value);
      updateRecordingRecoverySnapshot({
        patch: { finalizedAudio: finalized.value },
        segmentId,
        workspaceId: workspaceSession.workspaceId,
      });
      await backfillFinalTranscript(recordingSession);
      persistRecoveryTranscriptSnapshot(segmentId);
      const transcriptSaved = await saveFinalTranscript({
        memoryId: finalized.value.segment.memoryId,
        segmentId,
        recordingSession,
      });
      if (transcriptSaved) {
        clearRecoveryMarker(segmentId);
      }
      if (recordingSessionRef.current !== recordingSession) {
        return;
      }
      resetClosedRecordingState();
      onRecordingFlowSettled?.();
      if (!closeImmediately) {
        onOpenChange(false);
      }
    } catch (finalizeError) {
      const message = unknownErrorDisplayMessage(finalizeError, '录音草稿无法完成保存。');
      failActiveRecording(message, recordingSession);
      return;
    }
  }

  function handleReturn() {
    if (
      exitActionPending ||
      state.status === 'acquiring-permission' ||
      state.status === 'finalizing'
    ) {
      return;
    }

    if (state.status === 'recording' || state.status === 'paused') {
      stopDraftPlayback();
      setExitConfirmationOpen(true);
      return;
    }

    handleOpenChange(false);
  }

  async function handleSaveAndReturn() {
    if (exitActionPending) {
      return;
    }
    setExitActionPending(true);
    setExitConfirmationOpen(false);
    try {
      await handleStop({ bypassShortRecordingHold: true, closeImmediately: false });
    } finally {
      setExitActionPending(false);
    }
  }

  async function handleDiscardAndReturn() {
    if (exitActionPending) {
      return;
    }

    setExitActionPending(true);
    setExitConfirmationOpen(false);
    stopDraftPlayback();
    const recordingSession = recordingSessionRef.current;
    pauseRecordingDurationClock();
    const controller = controllerRef.current;
    controllerRef.current = null;
    try {
      await controller?.stop();
    } catch {
      // The user explicitly chose to exit; keep cleanup moving even if the device stop rejects.
    }
    await appendQueueRef.current.catch(() => {});
    clearPendingMicrophoneIntent(recordingSession);
    closeActiveTranscription(recordingSession);

    const activeDraft = activeDraftRef.current;
    if (activeDraft?.recordingSession === recordingSession) {
      activeDraftRef.current = null;
      try {
        const discarded =
          recordingTarget.kind === 'segment-supplement'
            ? await discardSegmentSupplementRecordingDraft({
                supplementId: activeDraft.segmentId,
                workspaceHandle: workspaceSession.workspaceHandle,
              })
            : await discardRecordingDraft({
                segmentId: activeDraft.segmentId,
                workspaceHandle: workspaceSession.workspaceHandle,
              });
        if (discarded.ok) {
          clearRecoveryMarker(activeDraft.segmentId);
        } else {
          notifyRecordingError(
            workspaceErrorDisplayMessage(
              discarded.error,
              '无法放弃录音，稍后会再次提示未完成录音。'
            )
          );
        }
      } catch (discardError) {
        notifyRecordingError(
          unknownErrorDisplayMessage(discardError, '无法放弃录音，稍后会再次提示未完成录音。')
        );
      }
    }

    setExitActionPending(false);
    resetClosedRecordingState();
    onRecordingFlowSettled?.();
    onOpenChange(false);
  }

  function resetClosedRecordingState() {
    closeActiveTranscription(recordingSessionRef.current);
    recordingSessionRef.current += 1;
    liveAudioInputActiveRef.current = false;
    transcriptionAudioQueueRef.current = null;
    appendFailureRef.current = null;
    appendQueueRef.current = Promise.resolve();
    activeDraftRef.current = null;
    replacementCopySessionRef.current = null;
    controllerRef.current = null;
    setCapturedChunks([]);
    capturedPcmChunksRef.current = [];
    playbackSessionRef.current += 1;
    cancelDraftPlaybackPreview();
    resetRecordingDurationClock();
    lastRecoveryDurationPersistedMsRef.current = 0;
    lastRecoveryAudioChunksPersistedMsRef.current = 0;
    lastRecoveryAudioChunkCountPersistedRef.current = 0;
    lastRecoveryWaveformPersistedMsRef.current = 0;
    restoredSegmentIdRef.current = null;
    longRecordingWarningShownRef.current = false;
    silenceNoticeShownRef.current = false;
    setElapsedMs(0);
    setExitConfirmationOpen(false);
    setExitActionPending(false);
    clearRecordingError();
    finalTranscriptionNeedsBackfillRef.current = false;
    completionBackfillTooLargeRef.current = false;
    transcriptionDisabledByMainRef.current = false;
    transcriptionUnavailableForSessionRef.current = false;
    clearShortRecordingNotice();
    setState(createInitialRecordingState());
    const initialTimeline = createRecordingTimeline({
      recordingSessionId: 'recording-0',
      revisionId: 'revision-0',
    });
    timelineRef.current = initialTimeline;
    setTimeline(initialTimeline);
    replaceTranscriptDraft('');
    setWaveformSamples([]);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isRecordingCloseBlocked(state)) {
      return;
    }
    if (!nextOpen) {
      resetClosedRecordingState();
      onRecordingFlowSettled?.();
    }
    onOpenChange(nextOpen);
  }

  const canClose = !isRecordingCloseBlocked(state);
  useEffect(() => {
    onCloseBlockedChange?.(!canClose);
  }, [canClose, onCloseBlockedChange]);

  const statusText = statusTextFor(state);
  const totalWaveformDurationMs = Math.max(elapsedMs, cursorTimeMs, timeline.totalDurationMs);
  const visibleTimerMs =
    state.status === 'paused' || state.status === 'replacing' ? cursorTimeMs : elapsedMs;
  const transcriptFocusTimeMs =
    state.status === 'paused' || state.status === 'replacing'
      ? cursorTimeMs
      : timeline.totalDurationMs;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const pausedPrimaryAction: PausedRecordingPrimaryAction =
    state.status !== 'paused' || !activeDraftRef.current || !controllerRef.current
      ? 'none'
      : hasTailAfterCursor(timeline)
        ? recordingTarget.kind === 'existing-memory'
          ? 'replace'
          : 'none'
        : 'resume';
  const composerControls =
    state.status === 'recording' ||
    state.status === 'paused' ||
    state.status === 'replacing' ||
    state.status === 'finalizing' ? (
      <RecordingControls
        isPlaying={isDraftPlaybackPlaying}
        onPause={handlePause}
        onPlayPause={handleDraftPlayPause}
        onPrimaryPausedAction={handleResume}
        pausedPrimaryAction={pausedPrimaryAction}
        playbackDisabled={draftPlaybackStatus !== 'ready'}
        onStart={handleStart}
        onStop={handleStop}
        state={state}
      />
    ) : null;

  return (
    <RecordingSurface
      description={
        transcriptionDisabled
          ? '录制本地音频，语音识别已关闭。'
          : '录制本地音频，并在完成后保存声音和实时转写。'
      }
      closeBlocked={!canClose}
      immersive
      onOpenChange={handleOpenChange}
      open={open}
      title="录音"
    >
      <Button
        aria-label="返回"
        className="absolute left-24 top-40 z-10 size-40 rounded-md bg-transparent p-0 text-muted-foreground shadow-none hover:bg-secondary hover:text-foreground disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100 sm:left-32"
        data-vaul-no-drag
        disabled={
          exitActionPending ||
          state.status === 'acquiring-permission' ||
          state.status === 'replacing' ||
          state.status === 'finalizing'
        }
        onClick={handleReturn}
        size="iconMedium"
        type="button"
        variant="ghostIcon"
      >
        <ChevronLeft aria-hidden="true" className="size-20" />
      </Button>
      <div
        className="grid h-[min(560px,calc(100dvh-84px))] w-full grid-rows-[112px_132px_72px_88px] content-end justify-items-center gap-y-20 text-center"
        data-testid="recording-composer-layout"
      >
        <audio
          data-testid="draft-playback-audio"
          hidden
          onEnded={handleDraftPlaybackEnded}
          onPause={() => setIsDraftPlaybackPlaying(false)}
          onTimeUpdate={handleDraftPlaybackTimeUpdate}
          preload="auto"
          ref={draftAudioRef}
          src={draftPlaybackUrl ?? undefined}
        />
        <p className="sr-only">
          {statusText} 已录制：{elapsedSeconds} 秒。
        </p>
        <div
          className="row-start-1 flex h-full w-full items-center justify-center"
          data-testid="recording-waveform-slot"
        >
          <RecordingWaveform
            cursorTimeMs={cursorTimeMs}
            onCursorChange={setCursor}
            samples={waveformSamples}
            state={state}
            totalDurationMs={totalWaveformDurationMs}
          />
        </div>
        {state.status === 'idle' ||
        state.status === 'failed' ||
        state.status === 'acquiring-permission' ? (
          <>
            <div
              className="row-start-2 flex h-full w-full items-center justify-center"
              data-testid="recording-copy-slot"
            >
              <div
                className={`flex max-w-[680px] flex-col gap-8 text-center text-foreground ${RECORDING_SPEECH_TEXT_CLASS}`}
              >
                <p>从一个念头开始，慢慢说，我们会安静地为你记下。</p>
                <p>不必急着组织完整，想到哪里就说到哪里。</p>
              </div>
            </div>
            <div
              aria-hidden="true"
              className="row-start-3 flex h-full items-center justify-center"
              data-testid="recording-timer-slot"
            />
            <div
              className="row-start-4 flex h-full w-full max-w-[1040px] items-center justify-center"
              data-testid="recording-controls-slot"
            >
              <RecordingControls
                onPause={handlePause}
                onPrimaryPausedAction={handleResume}
                onStart={handleStart}
                onStop={handleStop}
                state={state}
              />
            </div>
          </>
        ) : (
          <>
            <div
              className="row-start-2 flex h-full w-full items-center justify-center"
              data-testid="recording-copy-slot"
            >
              {transcriptionDisabled && !hasTranscriptPreview ? (
                <p
                  className={`max-w-[680px] text-balance text-muted-foreground ${RECORDING_SPEECH_TEXT_CLASS}`}
                  role="status"
                >
                  语音识别已关闭，本次只保存本地录音。
                </p>
              ) : (
                <RecordingTranscriptPreview
                  autoScrollMode={
                    state.status === 'paused' || state.status === 'replacing' ? 'focus' : 'latest'
                  }
                  fallback="实时转写会在你说话时安静地出现在这里。"
                  focusTimeMs={transcriptFocusTimeMs}
                  segments={timeline.transcriptSegments}
                />
              )}
            </div>
            <div
              className="relative row-start-3 flex h-full items-center justify-center"
              data-testid="recording-timer-slot"
            >
              <p className="font-sans text-heading-lg font-bold leading-none text-foreground">
                {formatRecordingTime(visibleTimerMs)}
              </p>
              {shortRecordingNoticeVisible ? (
                <p
                  className="absolute top-full mt-4 w-[min(80vw,680px)] text-balance text-ui-sm font-medium leading-ui-sm text-muted-foreground"
                  role="status"
                >
                  {SHORT_RECORDING_NOTICE}
                </p>
              ) : null}
            </div>
            <div
              className="row-start-4 flex h-full w-full max-w-[1040px] items-center justify-center"
              data-testid="recording-controls-slot"
            >
              {composerControls}
            </div>
          </>
        )}
      </div>
      <Dialog
        open={exitConfirmationOpen}
        onOpenChange={(nextOpen) => {
          if (!exitActionPending) {
            setExitConfirmationOpen(nextOpen);
          }
        }}
      >
        <DialogContent className="sm:w-[min(440px,calc(100vw-(var(--spacing-40)*2)))]">
          <DialogHeader>
            <DialogTitle>保存这段录音吗？</DialogTitle>
            <DialogDescription>返回会结束当前录音。</DialogDescription>
          </DialogHeader>

          <p className="text-ui-sm leading-ui-sm text-muted-foreground">
            可以先保存到当前记忆，或直接退出并放弃这段内容。
          </p>

          <div className="flex justify-end gap-8">
            <Button
              disabled={exitActionPending}
              onClick={() => setExitConfirmationOpen(false)}
              type="button"
              variant="secondary"
            >
              取消
            </Button>
            <Button
              disabled={exitActionPending}
              onClick={() => {
                void handleDiscardAndReturn();
              }}
              type="button"
              variant="secondary"
            >
              直接退出
            </Button>
            <Button
              disabled={exitActionPending}
              onClick={() => {
                void handleSaveAndReturn();
              }}
              type="button"
            >
              保存录音
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </RecordingSurface>
  );
}

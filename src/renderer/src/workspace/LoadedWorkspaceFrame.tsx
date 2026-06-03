import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { showReoToast, toast } from '../components/ui/toaster';
import { ExpressionDock } from './expression/ExpressionDock';
import {
  clearMemoryStudioAudioResourceCaches,
  createMemoryStudioAudioResourceCaches,
  MemoryStudio,
  type SavedSegmentSupplementTranscriptContent,
  type SegmentSupplementNoteTarget,
  type SegmentSupplementRecordingTarget,
  type MemoryStudioAudioResourceCaches,
  type SpeechSynthesisController,
  type TranscriptionBackfillController,
} from './MemoryStudio';
import { closeAudioWaveformDecoder } from './audioWaveform';
import { MemoryRail } from './MemoryRail';
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
import { WORKSPACE_MEMORY_RAIL_ID, WorkspaceFrame } from './WorkspaceFrame';
import { WorkspaceStage } from './WorkspaceStage';
import type { WorkspaceMemorySummary, WorkspaceSession } from './workspaceApi';
import type {
  SavedNoteSegmentContent,
  SavedNoteSegmentSupplementContent,
} from './finalizedNoteContentSave';
import { copyNeedsReviewAgentPrompt } from './workspaceApi';
import { workspaceSnapshotQueryOptions } from './workspaceQueries';
import { workspaceReviewToastId } from './workspaceReviewToast';

type LoadedWorkspaceFrameProps = {
  readonly currentMemory?: WorkspaceMemorySummary | null;
  readonly expressionDockVisible?: boolean;
  readonly memoryRailOpen?: boolean;
  readonly memoryRailMode?: 'inline' | 'overlay';
  readonly onDeleteMemory: (memory: WorkspaceMemorySummary) => void;
  readonly onDeleteSegment: (target: SegmentDeleteTarget) => void;
  readonly onDeleteSegmentSupplement: (target: SegmentSupplementDeleteTarget) => void;
  readonly onClearSegmentContent: (target: SegmentContentClearTarget) => void;
  readonly onSegmentTranscriptSaved: (saved: {
    readonly expectedSession: WorkspaceSession;
    readonly baselineTranscriptHash: string;
    readonly memory: WorkspaceMemorySummary;
    readonly memoryId: string;
    readonly segmentId: string;
  }) => void;
  readonly onSegmentSupplementTranscriptSaved: (
    saved: SavedSegmentSupplementTranscriptContent
  ) => void;
  readonly onNoteSegmentContentSaved: (saved: SavedNoteSegmentContent) => void;
  readonly onNoteSegmentSupplementContentSaved: (saved: SavedNoteSegmentSupplementContent) => void;
  readonly onRenameMemory: (memory: WorkspaceMemorySummary) => void;
  readonly onResetMemoryCover: (memory: WorkspaceMemorySummary) => void;
  readonly onResetSegmentCover?: ((target: SegmentCoverResetTarget) => void) | undefined;
  readonly onSwitchMemoryDefaultCover: (memory: WorkspaceMemorySummary) => void;
  readonly onSwitchSegmentDefaultCover?:
    | ((target: SegmentDefaultCoverSwitchTarget) => void)
    | undefined;
  readonly onRenameSegmentContent: (target: SegmentContentRenameTarget) => void;
  readonly onRenameSegment: (target: SegmentRenameTarget) => void;
  readonly onRenameSegmentSupplement: (target: SegmentSupplementRenameTarget) => void;
  readonly onShownReviewToastSessionKeyChange?: (sessionKey: string | null) => void;
  readonly onInlineMarkdownDirtyChange?: (dirty: boolean) => void;
  readonly speechSynthesis?: SpeechSynthesisController;
  readonly transcriptionBackfill?: TranscriptionBackfillController;
  readonly onSegmentFocusConsumed?: (segmentId: string) => void;
  readonly onSelectMemory: (memoryId: string) => void;
  readonly onStartSegmentSupplementRecording: (target: SegmentSupplementRecordingTarget) => void;
  readonly onStartNote?: () => void;
  readonly onStartSegmentSupplementNote?: (target: SegmentSupplementNoteTarget) => void;
  readonly segmentFocusIntent?: string | null;
  readonly shownReviewToastSessionKey?: string | null;
  readonly workspaceSession: WorkspaceSession;
  readonly onStartRecording: () => void;
};

function useStableEventCallback<TArgs extends readonly unknown[], TResult>(
  callback: (...args: TArgs) => TResult
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args: TArgs) => callbackRef.current(...args), []);
}

function useStableOptionalEventCallback<TArgs extends readonly unknown[], TResult>(
  callback: ((...args: TArgs) => TResult) | undefined
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args: TArgs) => callbackRef.current?.(...args), []);
}

export function LoadedWorkspaceFrame({
  currentMemory = null,
  expressionDockVisible = true,
  memoryRailOpen = true,
  memoryRailMode = 'inline',
  onDeleteMemory,
  onDeleteSegment,
  onDeleteSegmentSupplement,
  onClearSegmentContent,
  onSegmentTranscriptSaved,
  onSegmentSupplementTranscriptSaved,
  onNoteSegmentContentSaved,
  onNoteSegmentSupplementContentSaved,
  onRenameMemory,
  onResetMemoryCover,
  onResetSegmentCover,
  onSwitchMemoryDefaultCover,
  onSwitchSegmentDefaultCover,
  onRenameSegmentContent,
  onRenameSegment,
  onRenameSegmentSupplement,
  onShownReviewToastSessionKeyChange,
  onInlineMarkdownDirtyChange,
  speechSynthesis,
  transcriptionBackfill,
  onSegmentFocusConsumed,
  onSelectMemory,
  onStartNote,
  onStartSegmentSupplementNote,
  onStartSegmentSupplementRecording,
  onStartRecording,
  segmentFocusIntent = null,
  shownReviewToastSessionKey,
  workspaceSession,
}: LoadedWorkspaceFrameProps) {
  const snapshotQuery = useQuery(workspaceSnapshotQueryOptions(workspaceSession));
  const snapshot = snapshotQuery.data ?? workspaceSession.snapshot;
  const needsReviewCount = snapshot.review?.needsReviewCount ?? 0;
  const reviewToastId = workspaceReviewToastId(snapshot.workspaceId);
  const reviewToastSessionKey = `${workspaceSession.workspaceHandle}:${snapshot.workspaceId}`;
  const audioResourceCachesRef = useRef<MemoryStudioAudioResourceCaches | null>(null);
  if (audioResourceCachesRef.current === null) {
    audioResourceCachesRef.current = createMemoryStudioAudioResourceCaches();
  }
  const audioResourceCaches = audioResourceCachesRef.current;
  const activeReviewToastIdRef = useRef<string | null>(null);
  const fallbackShownReviewToastSessionKeyRef = useRef<string | null>(null);
  const copyNeedsReviewPromptRef = useRef<() => void>(() => {});
  const lastShownReviewToastCountRef = useRef<number | null>(null);
  const deleteMemory = useStableEventCallback(onDeleteMemory);
  const deleteSegment = useStableEventCallback(onDeleteSegment);
  const deleteSegmentSupplement = useStableEventCallback(onDeleteSegmentSupplement);
  const clearSegmentContent = useStableEventCallback(onClearSegmentContent);
  const segmentTranscriptSaved = useStableEventCallback(onSegmentTranscriptSaved);
  const segmentSupplementTranscriptSaved = useStableEventCallback(
    onSegmentSupplementTranscriptSaved
  );
  const noteSegmentContentSaved = useStableEventCallback(onNoteSegmentContentSaved);
  const noteSegmentSupplementContentSaved = useStableEventCallback(
    onNoteSegmentSupplementContentSaved
  );
  const renameMemory = useStableEventCallback(onRenameMemory);
  const resetMemoryCover = useStableEventCallback(onResetMemoryCover);
  const switchMemoryDefaultCover = useStableEventCallback(onSwitchMemoryDefaultCover);
  const resetSegmentCover = useStableOptionalEventCallback(onResetSegmentCover);
  const switchSegmentDefaultCover = useStableOptionalEventCallback(onSwitchSegmentDefaultCover);
  const renameSegmentContent = useStableEventCallback(onRenameSegmentContent);
  const renameSegment = useStableEventCallback(onRenameSegment);
  const renameSegmentSupplement = useStableEventCallback(onRenameSegmentSupplement);
  const inlineMarkdownDirtyChange = useStableOptionalEventCallback(onInlineMarkdownDirtyChange);
  const segmentFocusConsumed = useStableOptionalEventCallback(onSegmentFocusConsumed);
  const selectMemory = useStableEventCallback(onSelectMemory);
  const startNote = useStableOptionalEventCallback(onStartNote);
  const startSegmentSupplementNote = useStableOptionalEventCallback(onStartSegmentSupplementNote);
  const startSegmentSupplementRecording = useStableEventCallback(onStartSegmentSupplementRecording);
  const startRecording = useStableEventCallback(onStartRecording);
  const hasInlineMarkdownDirtyChange = onInlineMarkdownDirtyChange !== undefined;
  const hasSegmentFocusConsumed = onSegmentFocusConsumed !== undefined;
  const hasStartNote = onStartNote !== undefined;
  const hasStartSegmentSupplementNote = onStartSegmentSupplementNote !== undefined;
  const currentShownReviewToastSessionKey =
    shownReviewToastSessionKey === undefined
      ? fallbackShownReviewToastSessionKeyRef.current
      : shownReviewToastSessionKey;
  const setShownReviewToastSessionKey = useCallback(
    (sessionKey: string | null) => {
      fallbackShownReviewToastSessionKeyRef.current = sessionKey;
      onShownReviewToastSessionKeyChange?.(sessionKey);
    },
    [onShownReviewToastSessionKeyChange]
  );
  const showNeedsReviewToast = useCallback(
    (copyState: 'idle' | 'copied' = 'idle') => {
      showReoToast({
        type: 'reo-doctor',
        id: reviewToastId,
        title: `${needsReviewCount}个文件需要检查`,
        description: '复制提示词给您的Agent',
        onCopyPrompt: () => copyNeedsReviewPromptRef.current(),
        onDismiss: () => {
          if (activeReviewToastIdRef.current === reviewToastId) {
            activeReviewToastIdRef.current = null;
          }
        },
        copyState,
      });
      activeReviewToastIdRef.current = reviewToastId;
      lastShownReviewToastCountRef.current = needsReviewCount;
    },
    [needsReviewCount, reviewToastId]
  );
  const copyNeedsReviewPrompt = useCallback(() => {
    void copyNeedsReviewAgentPrompt({
      workspaceHandle: workspaceSession.workspaceHandle,
      workspaceId: snapshot.workspaceId,
      needsReviewCount,
    })
      .then((result) => {
        if (!result.ok) {
          showReoToast({ type: 'error', title: '无法复制提示词' });
          return;
        }
        if (activeReviewToastIdRef.current === reviewToastId) {
          showNeedsReviewToast('copied');
        }
      })
      .catch(() => {
        showReoToast({ type: 'error', title: '无法复制提示词' });
      });
  }, [
    needsReviewCount,
    reviewToastId,
    showNeedsReviewToast,
    snapshot.workspaceId,
    workspaceSession.workspaceHandle,
  ]);

  useEffect(() => {
    copyNeedsReviewPromptRef.current = copyNeedsReviewPrompt;
  }, [copyNeedsReviewPrompt]);

  useEffect(() => {
    if (needsReviewCount <= 0) {
      setShownReviewToastSessionKey(null);
      if (activeReviewToastIdRef.current === reviewToastId) {
        toast.dismiss(reviewToastId);
        activeReviewToastIdRef.current = null;
      }
      lastShownReviewToastCountRef.current = null;
      return;
    }

    if (currentShownReviewToastSessionKey === reviewToastSessionKey) {
      if (
        activeReviewToastIdRef.current === reviewToastId &&
        lastShownReviewToastCountRef.current !== needsReviewCount
      ) {
        showNeedsReviewToast();
      }
      return;
    }

    showNeedsReviewToast();
    setShownReviewToastSessionKey(reviewToastSessionKey);
  }, [
    currentShownReviewToastSessionKey,
    needsReviewCount,
    reviewToastId,
    reviewToastSessionKey,
    setShownReviewToastSessionKey,
    showNeedsReviewToast,
  ]);

  useEffect(() => {
    return () => {
      if (activeReviewToastIdRef.current === reviewToastId) {
        toast.dismiss(reviewToastId);
        activeReviewToastIdRef.current = null;
      }
    };
  }, [reviewToastId]);

  useEffect(() => {
    return () => {
      clearMemoryStudioAudioResourceCaches(audioResourceCaches);
      void closeAudioWaveformDecoder().catch(() => {});
    };
  }, [audioResourceCaches, workspaceSession.workspaceHandle]);

  const memoryRail = useMemo(
    () => (
      <MemoryRail
        id={WORKSPACE_MEMORY_RAIL_ID}
        activeMemoryId={currentMemory?.memoryId ?? null}
        memories={snapshot.memories}
        onDeleteMemory={deleteMemory}
        onRenameMemory={renameMemory}
        onResetMemoryCover={resetMemoryCover}
        onSwitchMemoryDefaultCover={switchMemoryDefaultCover}
        onSelectMemory={selectMemory}
        workspaceHandle={workspaceSession.workspaceHandle}
        workspaceId={workspaceSession.workspaceId}
      />
    ),
    [
      currentMemory?.memoryId,
      deleteMemory,
      renameMemory,
      resetMemoryCover,
      selectMemory,
      snapshot.memories,
      switchMemoryDefaultCover,
      workspaceSession.workspaceHandle,
      workspaceSession.workspaceId,
    ]
  );
  const expressionDock = useMemo(
    () =>
      expressionDockVisible ? (
        <ExpressionDock
          {...(hasStartNote ? { onStartNote: startNote } : {})}
          onStartRecording={startRecording}
        />
      ) : null,
    [expressionDockVisible, hasStartNote, startNote, startRecording]
  );
  const workspaceStage = useMemo(
    () =>
      currentMemory ? (
        <MemoryStudio
          key={currentMemory.memoryId}
          audioResourceCaches={audioResourceCaches}
          memory={currentMemory}
          onDeleteSegment={deleteSegment}
          onDeleteSegmentSupplement={deleteSegmentSupplement}
          onClearSegmentContent={clearSegmentContent}
          onSegmentTranscriptSaved={segmentTranscriptSaved}
          onSegmentSupplementTranscriptSaved={segmentSupplementTranscriptSaved}
          onNoteSegmentContentSaved={noteSegmentContentSaved}
          onNoteSegmentSupplementContentSaved={noteSegmentSupplementContentSaved}
          onRenameSegmentSupplement={renameSegmentSupplement}
          onRenameSegmentContent={renameSegmentContent}
          onResetSegmentCover={resetSegmentCover}
          onSwitchSegmentDefaultCover={switchSegmentDefaultCover}
          onRenameSegment={renameSegment}
          {...(hasInlineMarkdownDirtyChange
            ? { onInlineMarkdownDirtyChange: inlineMarkdownDirtyChange }
            : {})}
          {...(speechSynthesis ? { speechSynthesis } : {})}
          {...(transcriptionBackfill ? { transcriptionBackfill } : {})}
          {...(hasSegmentFocusConsumed ? { onSegmentFocusConsumed: segmentFocusConsumed } : {})}
          {...(hasStartSegmentSupplementNote
            ? { onStartSegmentSupplementNote: startSegmentSupplementNote }
            : {})}
          onStartSegmentSupplementRecording={startSegmentSupplementRecording}
          segmentFocusIntent={segmentFocusIntent}
          workspaceSession={workspaceSession}
        />
      ) : (
        <WorkspaceStage />
      ),
    [
      audioResourceCaches,
      clearSegmentContent,
      currentMemory,
      deleteSegment,
      deleteSegmentSupplement,
      hasInlineMarkdownDirtyChange,
      hasSegmentFocusConsumed,
      hasStartSegmentSupplementNote,
      inlineMarkdownDirtyChange,
      noteSegmentContentSaved,
      noteSegmentSupplementContentSaved,
      renameSegment,
      renameSegmentContent,
      renameSegmentSupplement,
      resetSegmentCover,
      segmentFocusConsumed,
      segmentFocusIntent,
      segmentSupplementTranscriptSaved,
      segmentTranscriptSaved,
      speechSynthesis,
      startSegmentSupplementNote,
      startSegmentSupplementRecording,
      switchSegmentDefaultCover,
      transcriptionBackfill,
      workspaceSession,
    ]
  );

  return (
    <WorkspaceFrame
      memoryRailOpen={memoryRailOpen}
      memoryRailMode={memoryRailMode}
      rail={memoryRail}
      dock={expressionDock}
    >
      {workspaceStage}
    </WorkspaceFrame>
  );
}

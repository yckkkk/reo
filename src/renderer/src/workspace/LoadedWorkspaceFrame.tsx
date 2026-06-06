import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { showReoToast, toast } from '../components/ui/toaster';
import { ExpressionDock } from './expression/ExpressionDock';
import {
  clearMemoryStudioAudioResourceCaches,
  createMemoryStudioAudioResourceCaches,
  MemoryStudio,
  type ArtifactSegmentTarget,
  type ArtifactSupplementTarget,
  type SavedSegmentSupplementTranscriptContent,
  type SegmentSupplementArtifactTarget,
  type MemoryStudioSegmentFocusIntent,
  type SegmentSupplementNoteTarget,
  type SegmentSupplementRecordingTarget,
  type MemoryStudioAudioResourceCaches,
  type SpeechSynthesisController,
  type TranscriptionBackfillController,
} from './MemoryStudio';
import { closeAudioWaveformDecoder } from './audioWaveform';
import { MemoryRail } from './MemoryRail';
import { WorkspaceWidgetPanel } from './WorkspaceWidgetPanel';
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
import type {
  WorkspaceMemorySummary,
  WorkspaceSession,
  WorkspaceWidgetProjection,
} from './workspaceApi';
import type {
  SavedNoteSegmentContent,
  SavedNoteSegmentSupplementContent,
} from './finalizedNoteContentSave';
import { copyArtifactAgentPrompt, copyNeedsReviewAgentPrompt } from './workspaceApi';
import { workspaceSnapshotQueryOptions } from './workspaceQueries';
import { workspaceReviewToastId } from './workspaceReviewToast';
import type { WorkspaceRailTab } from './workspaceRailTabs';
import type { ArtifactRuntimeObjectSelectionTarget } from './artifactRuntimeBridge';

type LoadedWorkspaceFrameProps = {
  readonly currentMemory?: WorkspaceMemorySummary | null;
  readonly expressionDockVisible?: boolean;
  readonly memoryRailOpen?: boolean;
  readonly memoryRailMode?: 'inline' | 'overlay';
  readonly activeRailTab?: WorkspaceRailTab;
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
  readonly onSelectMemory: (memoryId: string) => boolean | void;
  readonly onSelectObject: (target: ArtifactRuntimeObjectSelectionTarget) => boolean | void;
  readonly onRequestWidgetUpdate?: ((widget: WorkspaceWidgetProjection) => void) | undefined;
  readonly onWidgetRuntimeMutation?: ((value: unknown) => boolean) | undefined;
  readonly onStartSegmentSupplementRecording: (target: SegmentSupplementRecordingTarget) => void;
  readonly onStartNote?: () => void;
  readonly onStartSegmentSupplementNote?: (target: SegmentSupplementNoteTarget) => void;
  readonly segmentFocusIntent?: MemoryStudioSegmentFocusIntent | null;
  readonly shownReviewToastSessionKey?: string | null;
  readonly workspaceSession: WorkspaceSession;
  readonly widgetRefreshVersions?: Readonly<Record<string, number>>;
  readonly onStartRecording: () => void;
};

type ArtifactAgentPromptTarget =
  | {
      readonly action: 'create-segment';
      readonly memoryId: string;
    }
  | {
      readonly action: 'create-supplement';
      readonly memoryId: string;
      readonly segmentId: string;
    }
  | {
      readonly action: 'update-segment';
      readonly memoryId: string;
      readonly segmentId: string;
    }
  | {
      readonly action: 'update-supplement';
      readonly memoryId: string;
      readonly segmentId: string;
      readonly supplementId: string;
    };

function artifactPromptCopiedDescription(action: ArtifactAgentPromptTarget['action']): string {
  if (action === 'create-segment') {
    return '交给您的 Agent 后，它会在当前记忆中创建作品文件。';
  }
  if (action === 'create-supplement') {
    return '交给您的 Agent 后，它会为当前片段创建作品补充。';
  }
  return '交给您的 Agent 后，它会更新这个作品文件。';
}

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
  activeRailTab = { kind: 'memories' },
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
  onSelectObject,
  onRequestWidgetUpdate = () => undefined,
  onWidgetRuntimeMutation,
  onStartNote,
  onStartSegmentSupplementNote,
  onStartSegmentSupplementRecording,
  onStartRecording,
  segmentFocusIntent = null,
  shownReviewToastSessionKey,
  workspaceSession,
  widgetRefreshVersions = {},
}: LoadedWorkspaceFrameProps) {
  const queryClient = useQueryClient();
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
  const selectMemory = useStableEventCallback(
    (memoryId: string) => onSelectMemory(memoryId) !== false
  );
  const selectObject = useStableEventCallback(
    (target: ArtifactRuntimeObjectSelectionTarget) => onSelectObject(target) !== false
  );
  const startNote = useStableOptionalEventCallback(onStartNote);
  const startSegmentSupplementNote = useStableOptionalEventCallback(onStartSegmentSupplementNote);
  const startSegmentSupplementRecording = useStableEventCallback(onStartSegmentSupplementRecording);
  const startRecording = useStableEventCallback(onStartRecording);
  const requestWidgetUpdate = useStableEventCallback(onRequestWidgetUpdate);
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

  const copyArtifactPrompt = useCallback(
    (target: ArtifactAgentPromptTarget) => {
      void copyArtifactAgentPrompt({
        workspaceHandle: workspaceSession.workspaceHandle,
        workspaceId: snapshot.workspaceId,
        ...target,
      })
        .then((result) => {
          if (!result.ok) {
            showReoToast({ type: 'error', title: '无法复制作品提示词' });
            return;
          }
          showReoToast({
            type: 'success',
            title: '已复制作品提示词',
            description: artifactPromptCopiedDescription(target.action),
          });
        })
        .catch(() => {
          showReoToast({ type: 'error', title: '无法复制作品提示词' });
        });
    },
    [snapshot.workspaceId, workspaceSession.workspaceHandle]
  );

  const startArtifact = useCallback(() => {
    if (!currentMemory) {
      return;
    }
    copyArtifactPrompt({
      action: 'create-segment',
      memoryId: currentMemory.memoryId,
    });
  }, [copyArtifactPrompt, currentMemory]);

  const startSegmentSupplementArtifact = useCallback(
    (target: SegmentSupplementArtifactTarget) => {
      copyArtifactPrompt({
        action: 'create-supplement',
        memoryId: target.memoryId,
        segmentId: target.segmentId,
      });
    },
    [copyArtifactPrompt]
  );

  const updateArtifactSegment = useCallback(
    (target: ArtifactSegmentTarget) => {
      copyArtifactPrompt({
        action: 'update-segment',
        memoryId: target.memoryId,
        segmentId: target.segmentId,
      });
    },
    [copyArtifactPrompt]
  );

  const updateArtifactSegmentSupplement = useCallback(
    (target: ArtifactSupplementTarget) => {
      copyArtifactPrompt({
        action: 'update-supplement',
        memoryId: target.memoryId,
        segmentId: target.segmentId,
        supplementId: target.supplementId,
      });
    },
    [copyArtifactPrompt]
  );

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

  const refreshAfterWidgetRuntimeMutation = useCallback(
    (value: unknown) => {
      if (onWidgetRuntimeMutation?.(value)) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: workspaceSnapshotQueryOptions(workspaceSession).queryKey,
      });
    },
    [onWidgetRuntimeMutation, queryClient, workspaceSession]
  );
  const activeWidget =
    memoryRailOpen && activeRailTab.kind === 'widget'
      ? (snapshot.widgets?.find((widget) => widget.widgetId === activeRailTab.widgetId) ?? null)
      : null;
  const memoryRail = useMemo(
    () =>
      activeWidget ? (
        <WorkspaceWidgetPanel
          currentMemory={currentMemory}
          id={WORKSPACE_MEMORY_RAIL_ID}
          onProductMutation={refreshAfterWidgetRuntimeMutation}
          onRequestAgentUpdate={requestWidgetUpdate}
          onSelectMemory={selectMemory}
          onSelectObject={selectObject}
          refreshVersion={widgetRefreshVersions[activeWidget.widgetId] ?? 0}
          widget={activeWidget}
          workspaceSession={workspaceSession}
        />
      ) : (
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
      activeWidget,
      currentMemory?.memoryId,
      currentMemory,
      deleteMemory,
      renameMemory,
      resetMemoryCover,
      requestWidgetUpdate,
      refreshAfterWidgetRuntimeMutation,
      selectMemory,
      selectObject,
      snapshot.memories,
      switchMemoryDefaultCover,
      widgetRefreshVersions,
      workspaceSession.workspaceHandle,
      workspaceSession.workspaceId,
      workspaceSession,
    ]
  );
  const expressionDock = useMemo(
    () =>
      expressionDockVisible ? (
        <ExpressionDock
          {...(currentMemory ? { onStartArtifact: startArtifact } : {})}
          {...(hasStartNote ? { onStartNote: startNote } : {})}
          onStartRecording={startRecording}
        />
      ) : null,
    [currentMemory, expressionDockVisible, hasStartNote, startArtifact, startNote, startRecording]
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
          onStartSegmentSupplementArtifact={startSegmentSupplementArtifact}
          onStartSegmentSupplementRecording={startSegmentSupplementRecording}
          onUpdateArtifactSegment={updateArtifactSegment}
          onUpdateArtifactSegmentSupplement={updateArtifactSegmentSupplement}
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
      startSegmentSupplementArtifact,
      startSegmentSupplementNote,
      startSegmentSupplementRecording,
      switchSegmentDefaultCover,
      transcriptionBackfill,
      updateArtifactSegment,
      updateArtifactSegmentSupplement,
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

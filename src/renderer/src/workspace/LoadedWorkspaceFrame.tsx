import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { showReoToast, toast } from '../components/ui/toaster';
import { ExpressionDock } from './expression/ExpressionDock';
import {
  MemoryStudio,
  type SavedSegmentSupplementTranscriptContent,
  type SegmentSupplementNoteTarget,
  type SegmentSupplementRecordingTarget,
  type TranscriptionBackfillController,
} from './MemoryStudio';
import { MemoryRail } from './MemoryRail';
import type {
  SegmentSupplementDeleteTarget,
  SegmentSupplementRenameTarget,
  SegmentContentClearTarget,
  SegmentContentRenameTarget,
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
  readonly onRenameSegmentContent: (target: SegmentContentRenameTarget) => void;
  readonly onRenameSegment: (target: SegmentRenameTarget) => void;
  readonly onRenameSegmentSupplement: (target: SegmentSupplementRenameTarget) => void;
  readonly onShownReviewToastSessionKeyChange?: (sessionKey: string | null) => void;
  readonly onInlineMarkdownDirtyChange?: (dirty: boolean) => void;
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
  onRenameSegmentContent,
  onRenameSegment,
  onRenameSegmentSupplement,
  onShownReviewToastSessionKeyChange,
  onInlineMarkdownDirtyChange,
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
  const activeReviewToastIdRef = useRef<string | null>(null);
  const fallbackShownReviewToastSessionKeyRef = useRef<string | null>(null);
  const copyNeedsReviewPromptRef = useRef<() => void>(() => {});
  const lastShownReviewToastCountRef = useRef<number | null>(null);
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

  return (
    <WorkspaceFrame
      memoryRailOpen={memoryRailOpen}
      memoryRailMode={memoryRailMode}
      rail={
        <MemoryRail
          id={WORKSPACE_MEMORY_RAIL_ID}
          activeMemoryId={currentMemory?.memoryId ?? null}
          memories={snapshot.memories}
          onDeleteMemory={onDeleteMemory}
          onRenameMemory={onRenameMemory}
          onSelectMemory={onSelectMemory}
          workspaceHandle={workspaceSession.workspaceHandle}
          workspaceId={workspaceSession.workspaceId}
        />
      }
      dock={
        expressionDockVisible ? (
          <ExpressionDock
            {...(onStartNote ? { onStartNote } : {})}
            onStartRecording={onStartRecording}
          />
        ) : null
      }
    >
      {currentMemory ? (
        <MemoryStudio
          key={currentMemory.memoryId}
          memory={currentMemory}
          onDeleteSegment={onDeleteSegment}
          onDeleteSegmentSupplement={onDeleteSegmentSupplement}
          onClearSegmentContent={onClearSegmentContent}
          onSegmentTranscriptSaved={onSegmentTranscriptSaved}
          onSegmentSupplementTranscriptSaved={onSegmentSupplementTranscriptSaved}
          onNoteSegmentContentSaved={onNoteSegmentContentSaved}
          onNoteSegmentSupplementContentSaved={onNoteSegmentSupplementContentSaved}
          onRenameSegmentSupplement={onRenameSegmentSupplement}
          onRenameSegmentContent={onRenameSegmentContent}
          onRenameSegment={onRenameSegment}
          {...(onInlineMarkdownDirtyChange ? { onInlineMarkdownDirtyChange } : {})}
          {...(transcriptionBackfill ? { transcriptionBackfill } : {})}
          {...(onSegmentFocusConsumed ? { onSegmentFocusConsumed } : {})}
          {...(onStartSegmentSupplementNote ? { onStartSegmentSupplementNote } : {})}
          onStartSegmentSupplementRecording={onStartSegmentSupplementRecording}
          segmentFocusIntent={segmentFocusIntent}
          workspaceSession={workspaceSession}
        />
      ) : (
        <WorkspaceStage />
      )}
    </WorkspaceFrame>
  );
}

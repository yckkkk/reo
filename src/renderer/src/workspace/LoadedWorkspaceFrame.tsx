import { useCallback, useEffect, useRef, useState } from 'react';
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

const REVIEW_PROMPT_COPIED_FEEDBACK_MS = 1800;

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
  readonly onInlineMarkdownDirtyChange?: (dirty: boolean) => void;
  readonly transcriptionBackfill?: TranscriptionBackfillController;
  readonly onSegmentFocusConsumed?: (segmentId: string) => void;
  readonly onSelectMemory: (memoryId: string) => void;
  readonly onStartSegmentSupplementRecording: (target: SegmentSupplementRecordingTarget) => void;
  readonly onStartNote?: () => void;
  readonly onStartSegmentSupplementNote?: (target: SegmentSupplementNoteTarget) => void;
  readonly segmentFocusIntent?: string | null;
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
  onInlineMarkdownDirtyChange,
  transcriptionBackfill,
  onSegmentFocusConsumed,
  onSelectMemory,
  onStartNote,
  onStartSegmentSupplementNote,
  onStartSegmentSupplementRecording,
  onStartRecording,
  segmentFocusIntent = null,
  workspaceSession,
}: LoadedWorkspaceFrameProps) {
  const snapshotQuery = useQuery(workspaceSnapshotQueryOptions(workspaceSession));
  const snapshot = snapshotQuery.data ?? workspaceSession.snapshot;
  const needsReviewCount = snapshot.review?.needsReviewCount ?? 0;
  const reviewToastId = workspaceReviewToastId(snapshot.workspaceId);
  const activeReviewToastIdRef = useRef<string | null>(null);
  const copiedFeedbackTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [reviewPromptCopied, setReviewPromptCopied] = useState(false);
  const clearCopiedFeedbackTimeout = useCallback(() => {
    if (copiedFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(copiedFeedbackTimeoutRef.current);
      copiedFeedbackTimeoutRef.current = null;
    }
  }, []);
  const showCopiedFeedback = useCallback(() => {
    clearCopiedFeedbackTimeout();
    setReviewPromptCopied(true);
    copiedFeedbackTimeoutRef.current = window.setTimeout(() => {
      copiedFeedbackTimeoutRef.current = null;
      setReviewPromptCopied(false);
    }, REVIEW_PROMPT_COPIED_FEEDBACK_MS);
  }, [clearCopiedFeedbackTimeout]);
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
        showCopiedFeedback();
      })
      .catch(() => {
        showReoToast({ type: 'error', title: '无法复制提示词' });
      });
  }, [
    needsReviewCount,
    showCopiedFeedback,
    snapshot.workspaceId,
    workspaceSession.workspaceHandle,
  ]);

  useEffect(() => {
    if (needsReviewCount <= 0) {
      clearCopiedFeedbackTimeout();
      setReviewPromptCopied(false);
      if (activeReviewToastIdRef.current === reviewToastId) {
        toast.dismiss(reviewToastId);
        activeReviewToastIdRef.current = null;
      }
      return;
    }

    showReoToast({
      type: 'reo-doctor',
      id: reviewToastId,
      title: `${needsReviewCount}个文件需要检查`,
      description: '复制提示词给您的Agent',
      onCopyPrompt: copyNeedsReviewPrompt,
      copyState: reviewPromptCopied ? 'copied' : 'idle',
    });
    activeReviewToastIdRef.current = reviewToastId;
  }, [
    clearCopiedFeedbackTimeout,
    copyNeedsReviewPrompt,
    needsReviewCount,
    reviewPromptCopied,
    reviewToastId,
  ]);

  useEffect(() => {
    return () => {
      clearCopiedFeedbackTimeout();
      if (activeReviewToastIdRef.current === reviewToastId) {
        toast.dismiss(reviewToastId);
        activeReviewToastIdRef.current = null;
      }
    };
  }, [clearCopiedFeedbackTimeout, reviewToastId]);

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
            {...(currentMemory && onStartNote ? { onStartNote } : {})}
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

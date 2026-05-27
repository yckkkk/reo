import { useQuery } from '@tanstack/react-query';
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
import { workspaceSnapshotQueryOptions } from './workspaceQueries';

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
      {needsReviewCount > 0 ? (
        <div
          role="status"
          aria-label="记忆空间需要检查"
          className="absolute left-24 right-24 top-16 z-20 flex justify-center sm:left-40 sm:right-40"
        >
          <div className="max-w-full rounded-md border border-brand-ember/40 bg-card px-12 py-6 text-ui-sm font-medium leading-ui-sm text-foreground shadow-sm">
            {needsReviewCount} 个文件需要检查 · 运行 reo-doctor
          </div>
        </div>
      ) : null}
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

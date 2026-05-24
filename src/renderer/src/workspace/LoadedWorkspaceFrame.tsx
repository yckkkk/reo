import { useQuery } from '@tanstack/react-query';
import { ExpressionDock } from './expression/ExpressionDock';
import {
  MemoryStudio,
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
  SegmentTranscriptEditTarget,
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
  readonly onEditSegmentTranscript: (target: SegmentTranscriptEditTarget) => void;
  readonly onNoteSegmentContentSaved: (saved: SavedNoteSegmentContent) => void;
  readonly onNoteSegmentSupplementContentSaved: (saved: SavedNoteSegmentSupplementContent) => void;
  readonly onRenameMemory: (memory: WorkspaceMemorySummary) => void;
  readonly onRenameSegmentContent: (target: SegmentContentRenameTarget) => void;
  readonly onRenameSegment: (target: SegmentRenameTarget) => void;
  readonly onRenameSegmentSupplement: (target: SegmentSupplementRenameTarget) => void;
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
  onEditSegmentTranscript,
  onNoteSegmentContentSaved,
  onNoteSegmentSupplementContentSaved,
  onRenameMemory,
  onRenameSegmentContent,
  onRenameSegment,
  onRenameSegmentSupplement,
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
        expressionDockVisible && !currentMemory ? (
          <ExpressionDock onStartRecording={onStartRecording} />
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
          onEditSegmentTranscript={onEditSegmentTranscript}
          onNoteSegmentContentSaved={onNoteSegmentContentSaved}
          onNoteSegmentSupplementContentSaved={onNoteSegmentSupplementContentSaved}
          onRenameSegmentSupplement={onRenameSegmentSupplement}
          onRenameSegmentContent={onRenameSegmentContent}
          onRenameSegment={onRenameSegment}
          {...(transcriptionBackfill ? { transcriptionBackfill } : {})}
          {...(onSegmentFocusConsumed ? { onSegmentFocusConsumed } : {})}
          {...(onStartNote ? { onStartNote } : {})}
          onStartRecording={onStartRecording}
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

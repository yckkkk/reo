import { useQuery } from '@tanstack/react-query';
import { ExpressionDock } from './expression/ExpressionDock';
import { MemoryStudio, type SegmentSupplementRecordingTarget } from './MemoryStudio';
import { MemoryRail } from './MemoryRail';
import type {
  SegmentSupplementDeleteTarget,
  SegmentSupplementRenameTarget,
  SegmentDeleteTarget,
  SegmentRenameTarget,
} from './segmentActionTargets';
import { WORKSPACE_MEMORY_RAIL_ID, WorkspaceFrame } from './WorkspaceFrame';
import { WorkspaceStage } from './WorkspaceStage';
import type { WorkspaceMemorySummary, WorkspaceSession } from './workspaceApi';
import { workspaceSnapshotQueryOptions } from './workspaceQueries';

type LoadedWorkspaceFrameProps = {
  readonly currentMemory?: WorkspaceMemorySummary | null;
  readonly memoryRailOpen?: boolean;
  readonly memoryRailMode?: 'inline' | 'overlay';
  readonly onDeleteMemory: (memory: WorkspaceMemorySummary) => void;
  readonly onDeleteSegment: (target: SegmentDeleteTarget) => void;
  readonly onDeleteSegmentSupplement: (target: SegmentSupplementDeleteTarget) => void;
  readonly onRenameMemory: (memory: WorkspaceMemorySummary) => void;
  readonly onRenameSegment: (target: SegmentRenameTarget) => void;
  readonly onRenameSegmentSupplement: (target: SegmentSupplementRenameTarget) => void;
  readonly onSegmentFocusConsumed?: (segmentId: string) => void;
  readonly onSelectMemory: (memoryId: string) => void;
  readonly onStartSegmentSupplementRecording: (target: SegmentSupplementRecordingTarget) => void;
  readonly segmentFocusIntent?: string | null;
  readonly workspaceSession: WorkspaceSession;
  readonly onStartRecording: () => void;
};

export function LoadedWorkspaceFrame({
  currentMemory = null,
  memoryRailOpen = true,
  memoryRailMode = 'inline',
  onDeleteMemory,
  onDeleteSegment,
  onDeleteSegmentSupplement,
  onRenameMemory,
  onRenameSegment,
  onRenameSegmentSupplement,
  onSegmentFocusConsumed,
  onSelectMemory,
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
        />
      }
      dock={<ExpressionDock onStartRecording={onStartRecording} />}
    >
      {currentMemory ? (
        <MemoryStudio
          key={currentMemory.memoryId}
          memory={currentMemory}
          onDeleteSegment={onDeleteSegment}
          onDeleteSegmentSupplement={onDeleteSegmentSupplement}
          onRenameSegmentSupplement={onRenameSegmentSupplement}
          onRenameSegment={onRenameSegment}
          {...(onSegmentFocusConsumed ? { onSegmentFocusConsumed } : {})}
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

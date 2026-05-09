import { useQuery } from '@tanstack/react-query';
import { ExpressionDock } from './expression/ExpressionDock';
import { MemoryRail } from './MemoryRail';
import { WORKSPACE_MEMORY_RAIL_ID, WorkspaceFrame } from './WorkspaceFrame';
import { WorkspaceStage } from './WorkspaceStage';
import type { WorkspaceMemorySummary, WorkspaceSession } from './workspaceApi';
import { workspaceSnapshotQueryOptions } from './workspaceQueries';

type LoadedWorkspaceFrameProps = {
  readonly memoryRailOpen?: boolean;
  readonly onOpenMemory: (memoryId: string) => void;
  readonly onRenameMemory: (memory: WorkspaceMemorySummary) => void;
  readonly workspaceSession: WorkspaceSession;
  readonly onStartRecording: () => void;
};

export function LoadedWorkspaceFrame({
  memoryRailOpen = true,
  onOpenMemory,
  onRenameMemory,
  onStartRecording,
  workspaceSession,
}: LoadedWorkspaceFrameProps) {
  const snapshotQuery = useQuery(workspaceSnapshotQueryOptions(workspaceSession));
  const snapshot = snapshotQuery.data ?? workspaceSession.snapshot;

  return (
    <WorkspaceFrame
      memoryRailOpen={memoryRailOpen}
      rail={
        <MemoryRail
          id={WORKSPACE_MEMORY_RAIL_ID}
          memories={snapshot.memories}
          onOpenMemory={onOpenMemory}
          onRenameMemory={onRenameMemory}
        />
      }
      dock={<ExpressionDock onStartRecording={onStartRecording} />}
    >
      <WorkspaceStage />
    </WorkspaceFrame>
  );
}

import { useQuery } from '@tanstack/react-query';
import { ExpressionDock } from './expression/ExpressionDock';
import { MemoryRail } from './MemoryRail';
import { WORKSPACE_MEMORY_RAIL_ID, WorkspaceFrame } from './WorkspaceFrame';
import { WorkspaceStage } from './WorkspaceStage';
import type { WorkspaceMemorySummary, WorkspaceSession } from './workspaceApi';
import { workspaceSnapshotQueryOptions } from './workspaceQueries';

type LoadedWorkspaceFrameProps = {
  readonly currentMemory?: WorkspaceMemorySummary | null;
  readonly memoryRailOpen?: boolean;
  readonly onRenameMemory: (memory: WorkspaceMemorySummary) => void;
  readonly onSelectMemory: (memoryId: string) => void;
  readonly workspaceSession: WorkspaceSession;
  readonly onStartRecording: () => void;
};

export function LoadedWorkspaceFrame({
  currentMemory = null,
  memoryRailOpen = true,
  onRenameMemory,
  onSelectMemory,
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
          activeMemoryId={currentMemory?.memoryId ?? null}
          memories={snapshot.memories}
          onRenameMemory={onRenameMemory}
          onSelectMemory={onSelectMemory}
        />
      }
      dock={<ExpressionDock onStartRecording={onStartRecording} />}
    >
      <WorkspaceStage currentMemory={currentMemory} />
    </WorkspaceFrame>
  );
}

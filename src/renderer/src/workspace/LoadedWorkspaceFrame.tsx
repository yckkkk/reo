import { useQuery } from '@tanstack/react-query';
import { ExpressionDock } from './expression/ExpressionDock';
import { MemoryStudio, type SegmentAttachmentRecordingTarget } from './MemoryStudio';
import { MemoryRail } from './MemoryRail';
import { WORKSPACE_MEMORY_RAIL_ID, WorkspaceFrame } from './WorkspaceFrame';
import { WorkspaceStage } from './WorkspaceStage';
import type { WorkspaceMemorySummary, WorkspaceSession } from './workspaceApi';
import { workspaceSnapshotQueryOptions } from './workspaceQueries';

type LoadedWorkspaceFrameProps = {
  readonly currentMemory?: WorkspaceMemorySummary | null;
  readonly memoryRailOpen?: boolean;
  readonly onDeleteMemory: (memory: WorkspaceMemorySummary) => void;
  readonly onRenameMemory: (memory: WorkspaceMemorySummary) => void;
  readonly onSelectMemory: (memoryId: string) => void;
  readonly onStartSegmentAttachmentRecording: (target: SegmentAttachmentRecordingTarget) => void;
  readonly workspaceSession: WorkspaceSession;
  readonly onStartRecording: () => void;
};

export function LoadedWorkspaceFrame({
  currentMemory = null,
  memoryRailOpen = true,
  onDeleteMemory,
  onRenameMemory,
  onSelectMemory,
  onStartSegmentAttachmentRecording,
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
          onStartSegmentAttachmentRecording={onStartSegmentAttachmentRecording}
          workspaceSession={workspaceSession}
        />
      ) : (
        <WorkspaceStage />
      )}
    </WorkspaceFrame>
  );
}

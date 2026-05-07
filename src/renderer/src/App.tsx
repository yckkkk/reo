import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CreateWorkspaceForm } from './workspace/CreateWorkspaceForm';
import { RecordingOverlay } from './workspace/RecordingOverlay';
import { WorkspaceHome } from './workspace/WorkspaceHome';
import type { WorkspaceSession } from './workspace/workspaceApi';
import { seedWorkspaceSnapshot } from './workspace/workspaceQueries';

type FinalizedRecording = {
  readonly memory: WorkspaceSession['snapshot']['memories'][number];
  readonly recording: WorkspaceSession['snapshot']['recordings'][number] & {
    readonly memoryId: string;
    readonly durationMs: number;
  };
};

export function mergeFinalizedRecordingIntoSession(
  current: WorkspaceSession,
  finalized: FinalizedRecording
): WorkspaceSession {
  return {
    ...current,
    snapshot: {
      ...current.snapshot,
      memories: [
        finalized.memory,
        ...current.snapshot.memories.filter(
          (memory) => memory.memoryId !== finalized.memory.memoryId
        ),
      ],
      recordings: [
        ...current.snapshot.recordings.filter(
          (recording) => recording.recordingId !== finalized.recording.recordingId
        ),
        finalized.recording,
      ],
    },
  };
}

export function App() {
  const queryClient = useQueryClient();
  const [workspaceSession, setWorkspaceSession] = useState<WorkspaceSession | null>(null);
  const [recordingOpen, setRecordingOpen] = useState(false);

  function handleWorkspaceReady(nextWorkspaceSession: WorkspaceSession) {
    seedWorkspaceSnapshot(queryClient, nextWorkspaceSession);
    setWorkspaceSession(nextWorkspaceSession);
  }

  if (!workspaceSession) {
    return (
      <main className="min-h-screen bg-eggshell text-obsidian">
        <CreateWorkspaceForm onWorkspaceReady={handleWorkspaceReady} />
      </main>
    );
  }

  function handleRecordingFinalized(finalized: FinalizedRecording) {
    setWorkspaceSession((current) => {
      if (!current) {
        return current;
      }
      const nextSession = mergeFinalizedRecordingIntoSession(current, finalized);
      seedWorkspaceSnapshot(queryClient, nextSession);
      return nextSession;
    });
  }

  return (
    <>
      <WorkspaceHome
        workspaceSession={workspaceSession}
        onStartRecording={() => setRecordingOpen(true)}
      />
      <RecordingOverlay
        onOpenChange={setRecordingOpen}
        onRecordingFinalized={handleRecordingFinalized}
        open={recordingOpen}
        workspaceSession={workspaceSession}
      />
    </>
  );
}

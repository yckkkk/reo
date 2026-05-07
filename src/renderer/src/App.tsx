import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AppShell } from './app-shell/AppShell';
import { RecordingOverlay } from './workspace/RecordingOverlay';
import { WorkspaceEntryDialog } from './workspace/WorkspaceEntryDialog';
import { WorkspaceHome } from './workspace/WorkspaceHome';
import { WorkspaceStarterHome } from './workspace/WorkspaceStarterHome';
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
  const [workspaceEntryOpen, setWorkspaceEntryOpen] = useState(false);
  const [recordingOpen, setRecordingOpen] = useState(false);

  function handleWorkspaceReady(nextWorkspaceSession: WorkspaceSession) {
    seedWorkspaceSnapshot(queryClient, nextWorkspaceSession);
    setWorkspaceSession(nextWorkspaceSession);
  }

  if (!workspaceSession) {
    return (
      <>
        <AppShell>
          <WorkspaceStarterHome onCreateWorkspace={() => setWorkspaceEntryOpen(true)} />
        </AppShell>
        <WorkspaceEntryDialog
          onOpenChange={setWorkspaceEntryOpen}
          onWorkspaceReady={handleWorkspaceReady}
          open={workspaceEntryOpen}
        />
      </>
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
      <AppShell onNewMemory={() => setRecordingOpen(true)}>
        <WorkspaceHome
          workspaceSession={workspaceSession}
          onStartRecording={() => setRecordingOpen(true)}
        />
      </AppShell>
      <RecordingOverlay
        onOpenChange={setRecordingOpen}
        onRecordingFinalized={handleRecordingFinalized}
        open={recordingOpen}
        workspaceSession={workspaceSession}
      />
    </>
  );
}

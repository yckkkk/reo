import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CreateWorkspaceForm } from './workspace/CreateWorkspaceForm';
import { RecordingOverlay } from './workspace/RecordingOverlay';
import { WorkspaceHome } from './workspace/WorkspaceHome';
import type { WorkspaceSession } from './workspace/workspaceApi';
import { seedWorkspaceSnapshot } from './workspace/workspaceQueries';

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

  function handleRecordingFinalized(recording: WorkspaceSession['snapshot']['recordings'][number]) {
    setWorkspaceSession((current) => {
      if (!current) {
        return current;
      }
      const nextSession = {
        ...current,
        snapshot: {
          ...current.snapshot,
          recordings: [
            ...current.snapshot.recordings.filter(
              (item) => item.recordingId !== recording.recordingId
            ),
            recording,
          ],
        },
      };
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

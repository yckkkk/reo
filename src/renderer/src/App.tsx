import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CreateWorkspaceForm } from './workspace/CreateWorkspaceForm';
import { WorkspaceHome } from './workspace/WorkspaceHome';
import type { WorkspaceSession } from './workspace/workspaceApi';
import { seedWorkspaceSnapshot } from './workspace/workspaceQueries';

export function App() {
  const queryClient = useQueryClient();
  const [workspaceSession, setWorkspaceSession] = useState<WorkspaceSession | null>(null);

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

  return <WorkspaceHome workspaceSession={workspaceSession} onStartRecording={() => {}} />;
}

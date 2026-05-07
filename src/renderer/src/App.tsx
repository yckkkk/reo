import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppShell, type ThemeMode } from './app-shell/AppShell';
import { MemoryDetailPage } from './workspace/MemoryDetailPage';
import { RecordingOverlay, type RecordingTarget } from './workspace/RecordingOverlay';
import { WorkspaceEntryDialog } from './workspace/WorkspaceEntryDialog';
import { WorkspaceHome } from './workspace/WorkspaceHome';
import { WorkspaceStarterHome } from './workspace/WorkspaceStarterHome';
import type { WorkspaceSession } from './workspace/workspaceApi';
import { memoryDetailQueryKey, seedWorkspaceSnapshot } from './workspace/workspaceQueries';

type FinalizedRecording = {
  readonly memory: WorkspaceSession['snapshot']['memories'][number];
  readonly recording: WorkspaceSession['snapshot']['recordings'][number] & {
    readonly memoryId: string;
    readonly durationMs: number;
  };
};

type WorkspaceView =
  | { readonly name: 'home' }
  | { readonly name: 'memory-detail'; readonly memoryId: string };

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
  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>({ name: 'home' });
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  useEffect(() => {
    return () => {
      document.documentElement.removeAttribute('data-theme');
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset['theme'] = themeMode;
  }, [themeMode]);

  function toggleTheme() {
    setThemeMode((currentMode) => (currentMode === 'light' ? 'dark' : 'light'));
  }

  function handleWorkspaceReady(nextWorkspaceSession: WorkspaceSession) {
    seedWorkspaceSnapshot(queryClient, nextWorkspaceSession);
    setWorkspaceView({ name: 'home' });
    setWorkspaceSession(nextWorkspaceSession);
  }

  if (!workspaceSession) {
    return (
      <>
        <AppShell themeMode={themeMode} onToggleTheme={toggleTheme}>
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
  const activeWorkspaceSession = workspaceSession;

  function handleRecordingFinalized(finalized: FinalizedRecording) {
    const nextSession = mergeFinalizedRecordingIntoSession(activeWorkspaceSession, finalized);
    seedWorkspaceSnapshot(queryClient, nextSession);
    void queryClient.invalidateQueries({
      queryKey: memoryDetailQueryKey({
        memoryId: finalized.recording.memoryId,
        workspaceId: activeWorkspaceSession.workspaceId,
      }),
    });
    setWorkspaceSession(nextSession);
  }

  function openRecording(target: RecordingTarget) {
    setRecordingTarget(target);
  }

  function handleRecordingOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setRecordingTarget(null);
    }
  }

  return (
    <>
      <AppShell
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
        onNewMemory={() => openRecording({ kind: 'new-memory' })}
      >
        {workspaceView.name === 'home' ? (
          <WorkspaceHome
            workspaceSession={activeWorkspaceSession}
            onOpenMemory={(memoryId) => setWorkspaceView({ name: 'memory-detail', memoryId })}
            onStartRecording={() => openRecording({ kind: 'new-memory' })}
          />
        ) : (
          <MemoryDetailPage
            memoryId={workspaceView.memoryId}
            workspaceHandle={activeWorkspaceSession.workspaceHandle}
            workspaceId={activeWorkspaceSession.workspaceId}
            onBack={() => setWorkspaceView({ name: 'home' })}
            onRecordMemory={() =>
              openRecording({ kind: 'existing-memory', memoryId: workspaceView.memoryId })
            }
          />
        )}
      </AppShell>
      {recordingTarget ? (
        <RecordingOverlay
          onOpenChange={handleRecordingOpenChange}
          onRecordingFinalized={handleRecordingFinalized}
          open
          recordingTarget={recordingTarget}
          workspaceSession={activeWorkspaceSession}
        />
      ) : null}
    </>
  );
}

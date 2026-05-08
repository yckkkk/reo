import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppShell, type ThemeMode } from './app-shell/AppShell';
import { MemoryDetailPage } from './workspace/MemoryDetailPage';
import { RecordingOverlay, type RecordingTarget } from './workspace/RecordingOverlay';
import { WorkspaceCreateDialog } from './workspace/WorkspaceCreateDialog';
import { WorkspaceHome } from './workspace/WorkspaceHome';
import { WorkspaceStarterHome } from './workspace/WorkspaceStarterHome';
import { openWorkspace, type WorkspaceSession } from './workspace/workspaceApi';
import { workspaceErrorDisplayMessage } from './workspace/workspaceErrorMessages';
import { chooseSafeWorkspaceFolder } from './workspace/workspaceFolderSelection';
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
  const [workspaceCreateOpen, setWorkspaceCreateOpen] = useState(false);
  const [workspaceActionPending, setWorkspaceActionPending] = useState(false);
  const [workspaceEntryError, setWorkspaceEntryError] = useState<string | null>(null);
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
    setWorkspaceCreateOpen(false);
    setWorkspaceEntryError(null);
    setWorkspaceActionPending(false);
    setWorkspaceSession(nextWorkspaceSession);
  }

  function beginWorkspaceAction() {
    if (workspaceActionPending) {
      return false;
    }

    setWorkspaceActionPending(true);
    return true;
  }

  function finishWorkspaceAction() {
    setWorkspaceActionPending(false);
  }

  function openWorkspaceCreateDialog() {
    setWorkspaceEntryError(null);
    setWorkspaceCreateOpen(true);
  }

  function handleWorkspaceCreateOpenChange(nextOpen: boolean) {
    if (!nextOpen && workspaceActionPending) {
      return;
    }

    setWorkspaceCreateOpen(nextOpen);
    if (!nextOpen) {
      setWorkspaceEntryError(null);
    }
  }

  function selectWorkspaceFromSidebar(workspaceId: string) {
    if (!workspaceSession || workspaceSession.workspaceId !== workspaceId) {
      return;
    }

    handleWorkspaceCreateOpenChange(false);
    setWorkspaceView({ name: 'home' });
  }

  async function handleOpenLocalWorkspace() {
    if (!beginWorkspaceAction()) {
      return;
    }

    setWorkspaceEntryError(null);
    try {
      const selectionResult = await chooseSafeWorkspaceFolder();

      if (selectionResult.status === 'canceled') {
        return;
      }

      if (selectionResult.status === 'error') {
        setWorkspaceEntryError(selectionResult.message);
        return;
      }

      const response = await openWorkspace({
        selectionToken: selectionResult.selection.selectionToken,
      });

      if (!response.ok) {
        setWorkspaceEntryError(workspaceErrorDisplayMessage(response.error, '无法打开工作区。'));
        return;
      }

      handleWorkspaceReady(response.value);
    } finally {
      finishWorkspaceAction();
    }
  }

  const workspaceProjects = workspaceSession
    ? [
        {
          title: workspaceSession.snapshot.title,
          workspaceId: workspaceSession.workspaceId,
        },
      ]
    : [];

  if (!workspaceSession) {
    return (
      <>
        <AppShell
          themeMode={themeMode}
          workspaceProjects={workspaceProjects}
          onCreateWorkspace={openWorkspaceCreateDialog}
          onHome={() => {
            handleWorkspaceCreateOpenChange(false);
            setWorkspaceView({ name: 'home' });
          }}
          onToggleTheme={toggleTheme}
          onOpenLocalWorkspace={() => {
            void handleOpenLocalWorkspace();
          }}
          onSelectWorkspace={selectWorkspaceFromSidebar}
        >
          <WorkspaceStarterHome />
        </AppShell>
        <WorkspaceCreateDialog
          disabled={workspaceActionPending}
          error={workspaceEntryError}
          onCreateFinish={finishWorkspaceAction}
          onCreateStart={beginWorkspaceAction}
          onOpenChange={handleWorkspaceCreateOpenChange}
          onWorkspaceReady={handleWorkspaceReady}
          open={workspaceCreateOpen}
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
        activeWorkspaceId={activeWorkspaceSession.workspaceId}
        themeMode={themeMode}
        workspaceProjects={workspaceProjects}
        onCreateWorkspace={openWorkspaceCreateDialog}
        onHome={() => {
          handleWorkspaceCreateOpenChange(false);
          setWorkspaceView({ name: 'home' });
        }}
        onToggleTheme={toggleTheme}
        onOpenLocalWorkspace={() => {
          void handleOpenLocalWorkspace();
        }}
        onSelectWorkspace={selectWorkspaceFromSidebar}
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
      <WorkspaceCreateDialog
        disabled={workspaceActionPending}
        error={workspaceEntryError}
        onCreateFinish={finishWorkspaceAction}
        onCreateStart={beginWorkspaceAction}
        onOpenChange={handleWorkspaceCreateOpenChange}
        onWorkspaceReady={handleWorkspaceReady}
        open={workspaceCreateOpen}
      />
    </>
  );
}

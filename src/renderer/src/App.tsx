import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  AppShell,
  type ThemeMode,
  type WorkspaceMemorySpace as SidebarWorkspaceMemorySpace,
} from './app-shell/AppShell';
import { ReoToaster, toast } from './components/ui/toaster';
import { MemoryDetailPage } from './workspace/MemoryDetailPage';
import { RecordingOverlay, type RecordingTarget } from './workspace/RecordingOverlay';
import { WorkspaceCreateDialog } from './workspace/WorkspaceCreateDialog';
import { WorkspaceErrorBanner } from './workspace/WorkspaceErrorBanner';
import { WorkspaceHome } from './workspace/WorkspaceHome';
import { WorkspaceLibraryPage } from './workspace/WorkspaceLibraryPage';
import { MemorySpaceRemoveDialog } from './workspace/MemorySpaceRemoveDialog';
import { WorkspaceStarterHome } from './workspace/WorkspaceStarterHome';
import {
  closeWorkspace,
  openWorkspace,
  openMemorySpace,
  removeMemorySpace,
  type WorkspaceSession,
} from './workspace/workspaceApi';
import {
  unknownErrorDisplayMessage,
  workspaceErrorDisplayMessage,
} from './workspace/workspaceErrorMessages';
import { chooseSafeWorkspaceFolder } from './workspace/workspaceFolderSelection';
import {
  memoryDetailQueryKey,
  seedWorkspaceSnapshot,
  memorySpacesQueryKey,
  memorySpacesQueryOptions,
} from './workspace/workspaceQueries';

type FinalizedRecording = {
  readonly memory: WorkspaceSession['snapshot']['memories'][number];
  readonly recording: WorkspaceSession['snapshot']['recordings'][number] & {
    readonly memoryId: string;
    readonly durationMs: number;
  };
};

type WorkspaceView =
  | { readonly name: 'home' }
  | { readonly name: 'library' }
  | { readonly name: 'memory-detail'; readonly memoryId: string };

type TopLevelWorkspaceView = Extract<WorkspaceView, { readonly name: 'home' | 'library' }>;
type WorkspaceMemorySpaceListItem = SidebarWorkspaceMemorySpace;

const HOME_VIEW: TopLevelWorkspaceView = { name: 'home' };
const LIBRARY_VIEW: TopLevelWorkspaceView = { name: 'library' };
const OPEN_MEMORY_SPACE_ERROR = '无法打开记忆空间。';
const REMOVE_MEMORY_SPACE_ERROR = '无法移除记忆空间。';
const RELEASE_MEMORY_SPACE_ERROR = '当前记忆空间会话未能释放。';

function WorkspaceContentWithEntryError({
  children,
  error,
}: {
  readonly children: React.ReactNode;
  readonly error: string | null;
}) {
  if (!error) {
    return children;
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="px-24 pt-16">
        <WorkspaceErrorBanner>{error}</WorkspaceErrorBanner>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

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
  const [memorySpaceRemoveTarget, setMemorySpaceRemoveTarget] =
    useState<WorkspaceMemorySpaceListItem | null>(null);
  const [workspaceActionPending, setWorkspaceActionPending] = useState(false);
  const [workspaceEntryError, setWorkspaceEntryError] = useState<string | null>(null);
  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>({ name: 'home' });
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const memorySpacesQuery = useQuery(memorySpacesQueryOptions());

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

  function setReadyWorkspaceSession(nextWorkspaceSession: WorkspaceSession) {
    seedWorkspaceSnapshot(queryClient, nextWorkspaceSession);
    setTopLevelWorkspaceView(HOME_VIEW);
    setWorkspaceCreateOpen(false);
    setWorkspaceEntryError(null);
    setWorkspaceSession(nextWorkspaceSession);
    void queryClient.invalidateQueries({ queryKey: memorySpacesQueryKey() });
  }

  function setTopLevelWorkspaceView(nextView: TopLevelWorkspaceView) {
    setWorkspaceView((currentView) =>
      currentView.name === nextView.name ? currentView : nextView
    );
  }

  async function closeReplacementWorkspace(nextWorkspaceSession: WorkspaceSession) {
    await closeWorkspace({ workspaceHandle: nextWorkspaceSession.workspaceHandle }).catch(() => {});
  }

  async function acceptWorkspaceSession(
    nextWorkspaceSession: WorkspaceSession,
    failureFallback = OPEN_MEMORY_SPACE_ERROR
  ) {
    if (
      workspaceSession &&
      workspaceSession.workspaceHandle !== nextWorkspaceSession.workspaceHandle
    ) {
      try {
        const closePrevious = await closeWorkspace({
          workspaceHandle: workspaceSession.workspaceHandle,
        });
        if (!closePrevious.ok) {
          await closeReplacementWorkspace(nextWorkspaceSession);
          setWorkspaceEntryError(
            workspaceErrorDisplayMessage(closePrevious.error, failureFallback)
          );
          return false;
        }
      } catch (error) {
        await closeReplacementWorkspace(nextWorkspaceSession);
        setWorkspaceEntryError(unknownErrorDisplayMessage(error, failureFallback));
        return false;
      }
    }

    setRecordingTarget(null);
    setReadyWorkspaceSession(nextWorkspaceSession);
    return true;
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
    setMemorySpaceRemoveTarget(null);
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

  async function navigateTopLevel(nextView: TopLevelWorkspaceView, failureFallback: string) {
    handleWorkspaceCreateOpenChange(false);
    handleMemorySpaceRemoveOpenChange(false);

    if (!workspaceSession) {
      setTopLevelWorkspaceView(nextView);
      return;
    }

    if (!beginWorkspaceAction()) {
      return;
    }

    setWorkspaceEntryError(null);
    try {
      const response = await closeWorkspace({
        workspaceHandle: workspaceSession.workspaceHandle,
      });

      if (!response.ok) {
        setWorkspaceEntryError(workspaceErrorDisplayMessage(response.error, failureFallback));
        return;
      }

      setRecordingTarget(null);
      setWorkspaceSession(null);
      setTopLevelWorkspaceView(nextView);
    } catch (error) {
      setWorkspaceEntryError(unknownErrorDisplayMessage(error, failureFallback));
    } finally {
      finishWorkspaceAction();
    }
  }

  async function navigateHome() {
    await navigateTopLevel(HOME_VIEW, '无法返回首页。');
  }

  async function navigateLibrary() {
    await navigateTopLevel(LIBRARY_VIEW, '无法打开资料库。');
  }

  function openMemorySpaceRemoveDialog(memorySpace: WorkspaceMemorySpaceListItem) {
    setWorkspaceCreateOpen(false);
    setWorkspaceEntryError(null);
    setMemorySpaceRemoveTarget(memorySpace);
  }

  function setMemorySpaceRemoveFailure(message: string) {
    toast.error('无法移除记忆空间', {
      description: message,
    });
  }

  function handleMemorySpaceRemoveOpenChange(nextOpen: boolean) {
    if (!nextOpen && workspaceActionPending) {
      return;
    }

    if (!nextOpen) {
      setMemorySpaceRemoveTarget(null);
    }
  }

  async function confirmRemoveMemorySpace() {
    if (!memorySpaceRemoveTarget || !beginWorkspaceAction()) {
      return;
    }

    setWorkspaceEntryError(null);
    const target = memorySpaceRemoveTarget;
    const activeSession =
      workspaceSession?.workspaceId === target.workspaceId ? workspaceSession : null;

    try {
      const response = await removeMemorySpace({
        workspaceId: target.workspaceId,
      });

      if (!response.ok) {
        setMemorySpaceRemoveFailure(
          workspaceErrorDisplayMessage(response.error, REMOVE_MEMORY_SPACE_ERROR)
        );
        return;
      }

      setMemorySpaceRemoveTarget(null);
      void queryClient.invalidateQueries({ queryKey: memorySpacesQueryKey() });

      let closeFailureMessage: string | null = null;
      if (activeSession) {
        setRecordingTarget(null);
        setWorkspaceSession(null);
        setTopLevelWorkspaceView(HOME_VIEW);

        try {
          const closeResponse = await closeWorkspace({
            workspaceHandle: activeSession.workspaceHandle,
          });
          if (!closeResponse.ok) {
            closeFailureMessage = workspaceErrorDisplayMessage(
              closeResponse.error,
              RELEASE_MEMORY_SPACE_ERROR
            );
          }
        } catch (error) {
          closeFailureMessage = unknownErrorDisplayMessage(error, RELEASE_MEMORY_SPACE_ERROR);
        }
      }

      toast.success('已移除记忆空间', {
        description: closeFailureMessage ?? '本地文件夹不会被删除。',
      });
    } catch (error) {
      setMemorySpaceRemoveFailure(unknownErrorDisplayMessage(error, REMOVE_MEMORY_SPACE_ERROR));
    } finally {
      finishWorkspaceAction();
    }
  }

  async function selectMemorySpaceFromSidebar(workspaceId: string) {
    if (workspaceSession?.workspaceId === workspaceId) {
      handleWorkspaceCreateOpenChange(false);
      setTopLevelWorkspaceView(HOME_VIEW);
      return;
    }

    if (!beginWorkspaceAction()) {
      return;
    }

    setWorkspaceEntryError(null);
    try {
      const response = await openMemorySpace({ workspaceId });
      if (!response.ok) {
        setWorkspaceEntryError(
          workspaceErrorDisplayMessage(response.error, OPEN_MEMORY_SPACE_ERROR)
        );
        return;
      }
      await acceptWorkspaceSession(response.value);
    } catch (error) {
      setWorkspaceEntryError(unknownErrorDisplayMessage(error, OPEN_MEMORY_SPACE_ERROR));
    } finally {
      finishWorkspaceAction();
    }
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
        setWorkspaceEntryError(
          workspaceErrorDisplayMessage(response.error, OPEN_MEMORY_SPACE_ERROR)
        );
        return;
      }

      await acceptWorkspaceSession(response.value);
    } catch (error) {
      setWorkspaceEntryError(unknownErrorDisplayMessage(error, OPEN_MEMORY_SPACE_ERROR));
    } finally {
      finishWorkspaceAction();
    }
  }

  const memorySpaces = memorySpacesQuery.data ?? [];
  const memorySpacesError =
    memorySpacesQuery.error === null
      ? null
      : unknownErrorDisplayMessage(memorySpacesQuery.error, '无法加载记忆空间列表。');
  const visibleWorkspaceEntryError = workspaceEntryError ?? memorySpacesError;
  const visibleWorkspaceMemorySpaces: readonly WorkspaceMemorySpaceListItem[] =
    workspaceSession &&
    !memorySpaces.some((memorySpace) => memorySpace.workspaceId === workspaceSession.workspaceId)
      ? [
          {
            workspaceId: workspaceSession.workspaceId,
            title: workspaceSession.snapshot.title,
          },
          ...memorySpaces,
        ]
      : memorySpaces;
  const shellProps = {
    themeMode,
    memorySpaces: visibleWorkspaceMemorySpaces,
    onCreateWorkspace: openWorkspaceCreateDialog,
    onHome: () => {
      void navigateHome();
    },
    onLibrary: () => {
      void navigateLibrary();
    },
    onToggleTheme: toggleTheme,
    onOpenLocalWorkspace: () => {
      void handleOpenLocalWorkspace();
    },
    onRemoveMemorySpace: openMemorySpaceRemoveDialog,
    onSelectMemorySpace: (workspaceId: string) => {
      void selectMemorySpaceFromSidebar(workspaceId);
    },
  };
  const workspaceDialogs = (
    <>
      <WorkspaceCreateDialog
        disabled={workspaceActionPending}
        error={workspaceEntryError}
        onCreateFinish={finishWorkspaceAction}
        onCreateStart={beginWorkspaceAction}
        onOpenChange={handleWorkspaceCreateOpenChange}
        onWorkspaceReady={(nextWorkspaceSession) =>
          acceptWorkspaceSession(nextWorkspaceSession, '无法创建记忆空间。')
        }
        open={workspaceCreateOpen}
      />
      <MemorySpaceRemoveDialog
        disabled={workspaceActionPending}
        onConfirm={() => {
          void confirmRemoveMemorySpace();
        }}
        onOpenChange={handleMemorySpaceRemoveOpenChange}
        open={memorySpaceRemoveTarget !== null}
        workspaceTitle={memorySpaceRemoveTarget?.title}
      />
    </>
  );

  if (!workspaceSession) {
    return (
      <>
        <ReoToaster themeMode={themeMode} />
        <AppShell
          {...shellProps}
          activeSection={workspaceView.name === 'library' ? 'library' : 'home'}
        >
          <WorkspaceContentWithEntryError error={visibleWorkspaceEntryError}>
            {workspaceView.name === 'library' ? <WorkspaceLibraryPage /> : <WorkspaceStarterHome />}
          </WorkspaceContentWithEntryError>
        </AppShell>
        {workspaceDialogs}
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
      <ReoToaster themeMode={themeMode} />
      <AppShell
        {...shellProps}
        activeWorkspaceId={activeWorkspaceSession.workspaceId}
        activeSection={workspaceView.name === 'library' ? 'library' : 'workspace'}
      >
        <WorkspaceContentWithEntryError error={visibleWorkspaceEntryError}>
          {workspaceView.name === 'library' ? (
            <WorkspaceLibraryPage />
          ) : workspaceView.name === 'home' ? (
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
        </WorkspaceContentWithEntryError>
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
      {workspaceDialogs}
    </>
  );
}

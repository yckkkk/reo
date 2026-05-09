import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  AppShell,
  type ThemeMode,
  type WorkspaceMemorySpace as SidebarWorkspaceMemorySpace,
} from './app-shell/AppShell';
import { ReoToaster, toast } from './components/ui/toaster';
import { LoadedWorkspaceFrame } from './workspace/LoadedWorkspaceFrame';
import { MemoryCreateDialog } from './workspace/MemoryCreateDialog';
import { MemoryDetailPage } from './workspace/MemoryDetailPage';
import { MemoryRenameDialog } from './workspace/MemoryRenameDialog';
import {
  RecordingOverlay,
  type RecordingTarget,
  type SavedRecordingContent,
} from './workspace/RecordingOverlay';
import { WorkspaceCreateDialog } from './workspace/WorkspaceCreateDialog';
import { WorkspaceErrorBanner } from './workspace/WorkspaceErrorBanner';
import { WorkspaceLibraryPage } from './workspace/WorkspaceLibraryPage';
import { MemorySpaceRemoveDialog } from './workspace/MemorySpaceRemoveDialog';
import { WorkspaceStarterHome } from './workspace/WorkspaceStarterHome';
import { WorkspaceTitlebar } from './workspace/WorkspaceTitlebar';
import {
  closeWorkspace,
  createMemory,
  openWorkspace,
  openMemorySpace,
  removeMemorySpace,
  updateMemoryTitle,
  type FinalizedRecording,
  type WorkspaceMemoryDetail,
  type WorkspaceMemorySummary,
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
  workspaceSnapshotQueryKey,
} from './workspace/workspaceQueries';

type WorkspaceView =
  | { readonly name: 'workspace-stage' }
  | { readonly name: 'library' }
  | { readonly name: 'memory-detail'; readonly memoryId: string };

type TopLevelWorkspaceView = Extract<
  WorkspaceView,
  { readonly name: 'workspace-stage' | 'library' }
>;
type WorkspaceMemorySpaceListItem = SidebarWorkspaceMemorySpace;
type MemoryCreateIntent =
  | { readonly afterCreate: 'stay-on-stage' }
  | { readonly afterCreate: 'record-memory' };

const WORKSPACE_STAGE_VIEW: TopLevelWorkspaceView = { name: 'workspace-stage' };
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
    },
  };
}

export function mergeUpdatedMemoryIntoSession(
  current: WorkspaceSession,
  updatedMemory: WorkspaceMemorySummary
): WorkspaceSession {
  return {
    ...current,
    snapshot: {
      ...current.snapshot,
      memories: [
        updatedMemory,
        ...current.snapshot.memories.filter((memory) => memory.memoryId !== updatedMemory.memoryId),
      ],
    },
  };
}

export function mergeSavedRecordingContentIntoDetail(
  current: WorkspaceMemoryDetail | undefined,
  memory: WorkspaceMemorySummary
): WorkspaceMemoryDetail | undefined {
  if (!current || current.memoryId !== memory.memoryId) {
    return current;
  }

  return {
    ...current,
    assetCount: memory.assetCount,
    hasReflections: memory.hasReflections,
    hasTranscript: memory.hasTranscript,
    title: memory.title,
    updatedAt: memory.updatedAt,
  };
}

export function App() {
  const queryClient = useQueryClient();
  const [workspaceSession, setWorkspaceSession] = useState<WorkspaceSession | null>(null);
  const [workspaceCreateOpen, setWorkspaceCreateOpen] = useState(false);
  const [memorySpaceRemoveTarget, setMemorySpaceRemoveTarget] =
    useState<WorkspaceMemorySpaceListItem | null>(null);
  const [memoryCreateIntent, setMemoryCreateIntent] = useState<MemoryCreateIntent | null>(null);
  const [memoryRenameTarget, setMemoryRenameTarget] = useState<WorkspaceMemorySummary | null>(null);
  const [workspaceActionPending, setWorkspaceActionPending] = useState(false);
  const [workspaceEntryError, setWorkspaceEntryError] = useState<string | null>(null);
  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget | null>(null);
  const [memoryRailOpen, setMemoryRailOpen] = useState(true);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(WORKSPACE_STAGE_VIEW);
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
    setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
    setWorkspaceCreateOpen(false);
    setWorkspaceEntryError(null);
    setMemoryCreateIntent(null);
    setMemoryRenameTarget(null);
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
    setMemoryCreateIntent(null);
    setMemoryRenameTarget(null);
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
    setMemoryCreateIntent(null);
    setMemorySpaceRemoveTarget(null);
    setMemoryRenameTarget(null);
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
      setMemoryCreateIntent(null);
      setMemoryRenameTarget(null);
      setWorkspaceSession(null);
      setTopLevelWorkspaceView(nextView);
    } catch (error) {
      setWorkspaceEntryError(unknownErrorDisplayMessage(error, failureFallback));
    } finally {
      finishWorkspaceAction();
    }
  }

  async function navigateHome() {
    await navigateTopLevel(WORKSPACE_STAGE_VIEW, '无法返回首页。');
  }

  async function navigateLibrary() {
    await navigateTopLevel(LIBRARY_VIEW, '无法打开资料库。');
  }

  function openMemorySpaceRemoveDialog(memorySpace: WorkspaceMemorySpaceListItem) {
    setWorkspaceCreateOpen(false);
    setWorkspaceEntryError(null);
    setMemoryCreateIntent(null);
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
        setMemoryCreateIntent(null);
        setMemoryRenameTarget(null);
        setWorkspaceSession(null);
        setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);

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
      setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
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
    const snapshotQueryKey = workspaceSnapshotQueryKey(activeWorkspaceSession);
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) =>
        mergeFinalizedRecordingIntoSession(
          {
            ...activeWorkspaceSession,
            snapshot: currentSnapshot ?? activeWorkspaceSession.snapshot,
          },
          finalized
        ).snapshot
    );
    void queryClient.invalidateQueries({
      queryKey: memoryDetailQueryKey({
        memoryId: finalized.recording.memoryId,
        workspaceId: activeWorkspaceSession.workspaceId,
      }),
    });
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceId === activeWorkspaceSession.workspaceId
        ? mergeFinalizedRecordingIntoSession(currentSession, finalized)
        : currentSession
    );
  }

  function seedEmptyMemoryDetail(memory: WorkspaceMemorySummary) {
    queryClient.setQueryData<WorkspaceMemoryDetail>(
      memoryDetailQueryKey({
        memoryId: memory.memoryId,
        workspaceId: activeWorkspaceSession.workspaceId,
      }),
      {
        memoryId: memory.memoryId,
        title: memory.title,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
        assetIds: [],
        assetCount: memory.assetCount,
        recordingsTruncated: false,
        hasTranscript: memory.hasTranscript,
        hasReflections: memory.hasReflections,
        recordings: [],
      }
    );
  }

  function openMemoryCreateDialog(intent: MemoryCreateIntent) {
    setWorkspaceEntryError(null);
    setWorkspaceCreateOpen(false);
    setMemorySpaceRemoveTarget(null);
    setMemoryRenameTarget(null);
    setMemoryCreateIntent(intent);
  }

  function handleMemoryCreateOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setMemoryCreateIntent(null);
    }
  }

  async function saveCreatedMemory(title: string) {
    try {
      const response = await createMemory({
        workspaceHandle: activeWorkspaceSession.workspaceHandle,
        title,
      });

      if (!response.ok) {
        return workspaceErrorDisplayMessage(response.error, '无法新建记忆。');
      }

      const snapshotQueryKey = workspaceSnapshotQueryKey(activeWorkspaceSession);
      queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
        snapshotQueryKey,
        (currentSnapshot) =>
          mergeUpdatedMemoryIntoSession(
            {
              ...activeWorkspaceSession,
              snapshot: currentSnapshot ?? activeWorkspaceSession.snapshot,
            },
            response.value
          ).snapshot
      );
      seedEmptyMemoryDetail(response.value);
      setWorkspaceSession((currentSession) =>
        currentSession?.workspaceId === activeWorkspaceSession.workspaceId
          ? mergeUpdatedMemoryIntoSession(currentSession, response.value)
          : currentSession
      );

      if (memoryCreateIntent?.afterCreate === 'record-memory') {
        openRecording({ kind: 'existing-memory', memoryId: response.value.memoryId });
      } else {
        setWorkspaceView(WORKSPACE_STAGE_VIEW);
        toast.success('已新建记忆');
      }

      return null;
    } catch (error) {
      return unknownErrorDisplayMessage(error, '无法新建记忆。');
    }
  }

  async function saveRenamedMemory(memory: WorkspaceMemorySummary, title: string) {
    if (title === memory.title.trim()) {
      return null;
    }

    try {
      const response = await updateMemoryTitle({
        workspaceHandle: activeWorkspaceSession.workspaceHandle,
        memoryId: memory.memoryId,
        title,
      });

      if (!response.ok) {
        return workspaceErrorDisplayMessage(response.error, '无法重命名记忆。');
      }

      const detailQueryKey = memoryDetailQueryKey({
        memoryId: response.value.memoryId,
        workspaceId: activeWorkspaceSession.workspaceId,
      });
      const snapshotQueryKey = workspaceSnapshotQueryKey(activeWorkspaceSession);

      queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
        snapshotQueryKey,
        (currentSnapshot) =>
          mergeUpdatedMemoryIntoSession(
            {
              ...activeWorkspaceSession,
              snapshot: currentSnapshot ?? activeWorkspaceSession.snapshot,
            },
            response.value
          ).snapshot
      );
      queryClient.setQueryData<WorkspaceMemoryDetail | undefined>(detailQueryKey, (current) =>
        mergeSavedRecordingContentIntoDetail(current, response.value)
      );
      void queryClient.invalidateQueries({ queryKey: detailQueryKey });
      setWorkspaceSession((currentSession) =>
        currentSession?.workspaceId === activeWorkspaceSession.workspaceId
          ? mergeUpdatedMemoryIntoSession(currentSession, response.value)
          : currentSession
      );
      setMemoryRenameTarget(null);
      toast.success('已重命名记忆');
      return null;
    } catch (error) {
      return unknownErrorDisplayMessage(error, '无法重命名记忆。');
    }
  }

  function openRecording(target: RecordingTarget) {
    setRecordingTarget(target);
  }

  function requestStartRecording() {
    openMemoryCreateDialog({ afterCreate: 'record-memory' });
  }

  function handleRecordingContentSaved({ memory }: SavedRecordingContent) {
    const detailQueryKey = memoryDetailQueryKey({
      memoryId: memory.memoryId,
      workspaceId: activeWorkspaceSession.workspaceId,
    });
    const snapshotQueryKey = workspaceSnapshotQueryKey(activeWorkspaceSession);
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) =>
        mergeUpdatedMemoryIntoSession(
          {
            ...activeWorkspaceSession,
            snapshot: currentSnapshot ?? activeWorkspaceSession.snapshot,
          },
          memory
        ).snapshot
    );
    queryClient.setQueryData<WorkspaceMemoryDetail | undefined>(detailQueryKey, (current) =>
      mergeSavedRecordingContentIntoDetail(current, memory)
    );
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceId === activeWorkspaceSession.workspaceId
        ? mergeUpdatedMemoryIntoSession(currentSession, memory)
        : currentSession
    );
  }

  function toggleMemoryRail() {
    setMemoryRailOpen((open) => !open);
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
        panelTitlebar={
          workspaceView.name === 'workspace-stage' ? (
            <WorkspaceTitlebar
              memoryRailOpen={memoryRailOpen}
              onCreateMemory={() => openMemoryCreateDialog({ afterCreate: 'stay-on-stage' })}
              onToggleMemoryRail={toggleMemoryRail}
              title={activeWorkspaceSession.snapshot.title}
            />
          ) : null
        }
      >
        <WorkspaceContentWithEntryError error={visibleWorkspaceEntryError}>
          {workspaceView.name === 'library' ? (
            <WorkspaceLibraryPage />
          ) : workspaceView.name === 'workspace-stage' ? (
            <LoadedWorkspaceFrame
              workspaceSession={activeWorkspaceSession}
              memoryRailOpen={memoryRailOpen}
              onOpenMemory={(memoryId) => setWorkspaceView({ name: 'memory-detail', memoryId })}
              onRenameMemory={setMemoryRenameTarget}
              onStartRecording={requestStartRecording}
            />
          ) : (
            <MemoryDetailPage
              memoryId={workspaceView.memoryId}
              workspaceHandle={activeWorkspaceSession.workspaceHandle}
              workspaceId={activeWorkspaceSession.workspaceId}
              onBack={() => setWorkspaceView(WORKSPACE_STAGE_VIEW)}
              onRecordMemory={() =>
                openRecording({ kind: 'existing-memory', memoryId: workspaceView.memoryId })
              }
            />
          )}
        </WorkspaceContentWithEntryError>
      </AppShell>
      {recordingTarget ? (
        <RecordingOverlay
          onRecordingContentSaved={handleRecordingContentSaved}
          onOpenChange={handleRecordingOpenChange}
          onRecordingFinalized={handleRecordingFinalized}
          open
          recordingTarget={recordingTarget}
          workspaceSession={activeWorkspaceSession}
        />
      ) : null}
      <MemoryRenameDialog
        memory={memoryRenameTarget}
        onOpenChange={(open) => {
          if (!open) {
            setMemoryRenameTarget(null);
          }
        }}
        onSave={saveRenamedMemory}
        open={memoryRenameTarget !== null}
      />
      <MemoryCreateDialog
        description={
          memoryCreateIntent?.afterCreate === 'record-memory'
            ? '创建记忆并开始录音'
            : '保持简短且易识别'
        }
        onCreate={saveCreatedMemory}
        onOpenChange={handleMemoryCreateOpenChange}
        open={memoryCreateIntent !== null}
        submitLabel={memoryCreateIntent?.afterCreate === 'record-memory' ? '开始录音' : '创建'}
      />
      {workspaceDialogs}
    </>
  );
}

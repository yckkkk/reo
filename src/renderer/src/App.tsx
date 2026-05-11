import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppShell,
  type ThemeMode,
  type WorkspaceMemorySpace as SidebarWorkspaceMemorySpace,
} from './app-shell/AppShell';
import { ReoToaster, toast } from './components/ui/toaster';
import { LoadedWorkspaceFrame } from './workspace/LoadedWorkspaceFrame';
import { MemoryCreateDialog } from './workspace/MemoryCreateDialog';
import { MemoryDeleteDialog } from './workspace/MemoryDeleteDialog';
import { MemoryRenameDialog } from './workspace/MemoryRenameDialog';
import { MemoryTitleDialog } from './workspace/MemoryTitleDialog';
import {
  RecordingOverlay,
  type RecordingTarget,
  type SavedRecordingContent,
} from './workspace/RecordingOverlay';
import { RecordingRecoveryDialog } from './workspace/RecordingRecoveryDialog';
import { WorkspaceCreateDialog } from './workspace/WorkspaceCreateDialog';
import { WorkspaceLibraryPage } from './workspace/WorkspaceLibraryPage';
import { MemorySpaceRemoveDialog } from './workspace/MemorySpaceRemoveDialog';
import { WorkspaceStarterHome } from './workspace/WorkspaceStarterHome';
import { WorkspaceTitlebar } from './workspace/WorkspaceTitlebar';
import {
  closeWorkspace,
  createMemory,
  deleteMemory,
  discardRecordingDraft,
  discardSegmentAttachmentRecordingDraft,
  finalizeRecordingDraft,
  finalizeSegmentAttachmentRecordingDraft,
  openWorkspace,
  openMemorySpace,
  readWorkspaceSnapshot,
  removeMemorySpace,
  restoreDeletedMemory,
  saveTranscript,
  updateMemorySpaceTitle,
  updateMemoryTitle,
  type FinalizedAudioSegment,
  type FinalizedSegmentAttachmentRecording,
  type WorkspaceMemoryDetail,
  type WorkspaceMemorySummary,
  type WorkspaceSession,
} from './workspace/workspaceApi';
import {
  clearRecordingRecoveryDraft,
  readRecordingRecoveryDraft,
  updateRecordingRecoverySnapshot,
  type RecordingRecoveryDraft,
} from './workspace/recordingRecovery';
import { transcriptMarkdownFromSegments } from './workspace/recording/recordingTimeline';
import {
  unknownErrorDisplayMessage,
  workspaceErrorDisplayMessage,
} from './workspace/workspaceErrorMessages';
import { chooseSafeWorkspaceFolder } from './workspace/workspaceFolderSelection';
import {
  seedWorkspaceSnapshot,
  memoryDetailQueryKey,
  memorySpacesQueryKey,
  memorySpacesQueryOptions,
  segmentContentQueryKey,
  workspaceSnapshotQueryKey,
} from './workspace/workspaceQueries';

type WorkspaceView = { readonly name: 'workspace-stage' } | { readonly name: 'library' };

type TopLevelWorkspaceView = Extract<
  WorkspaceView,
  { readonly name: 'workspace-stage' | 'library' }
>;
type WorkspaceMemorySpaceListItem = SidebarWorkspaceMemorySpace;
type MemoryCreateIntent =
  | { readonly afterCreate: 'stay-on-stage' }
  | { readonly afterCreate: 'record-memory' };
type SegmentFocusIntent = {
  readonly memoryId: string;
  readonly segmentId: string;
};
type MemoryDetailQueryData = {
  readonly requestId: string;
  readonly detail: WorkspaceMemoryDetail;
};

const WORKSPACE_STAGE_VIEW: TopLevelWorkspaceView = { name: 'workspace-stage' };
const LIBRARY_VIEW: TopLevelWorkspaceView = { name: 'library' };
const OPEN_MEMORY_SPACE_ERROR = '无法打开记忆空间。';
const REMOVE_MEMORY_SPACE_ERROR = '无法移除记忆空间。';
const RELEASE_MEMORY_SPACE_ERROR = '当前记忆空间会话未能释放。';
const MEMORY_DELETE_ERROR = '无法删除记忆。';
const MEMORY_RESTORE_ERROR = '无法恢复记忆。';
const WORKSPACE_MEMORY_RAIL_INLINE_QUERY = '(min-width: 1100px)';

function canShowInlineMemoryRail(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia(WORKSPACE_MEMORY_RAIL_INLINE_QUERY).matches;
}
const RECORDING_FLOW_NAVIGATION_BLOCKED = '当前录音尚未完成，请先完成或关闭录音。';
const RECORDING_RECOVERY_SAVE_ERROR = '无法保存未完成录音。';
const RECORDING_RECOVERY_DISCARD_ERROR = '无法放弃未完成录音。';

export function mergeMemoryIntoSession(
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

function mergeSegmentIntoMemoryDetail(
  currentDetail: MemoryDetailQueryData | undefined,
  memory: WorkspaceMemorySummary,
  segment: WorkspaceMemoryDetail['segments'][number],
  workspaceId: string
): MemoryDetailQueryData | undefined {
  if (
    !currentDetail ||
    currentDetail.detail.workspaceId !== workspaceId ||
    currentDetail.detail.memoryId !== memory.memoryId ||
    segment.workspaceId !== workspaceId ||
    segment.memoryId !== memory.memoryId
  ) {
    return currentDetail;
  }

  let segmentReplaced = false;
  const segments = currentDetail.detail.segments.map((currentSegment) => {
    if (currentSegment.segmentId !== segment.segmentId) {
      return currentSegment;
    }
    segmentReplaced = true;
    return segment;
  });

  return {
    ...currentDetail,
    detail: {
      ...currentDetail.detail,
      ...memory,
      workspaceId: currentDetail.detail.workspaceId,
      segments: segmentReplaced ? segments : [...segments, segment],
    },
  };
}

function replaceSessionMemories(
  current: WorkspaceSession,
  memories: readonly WorkspaceMemorySummary[]
): WorkspaceSession {
  return {
    ...current,
    snapshot: {
      ...current.snapshot,
      memories: [...memories],
    },
  };
}

export function App() {
  const queryClient = useQueryClient();
  const [workspaceSession, setWorkspaceSessionState] = useState<WorkspaceSession | null>(null);
  const [workspaceCreateOpen, setWorkspaceCreateOpen] = useState(false);
  const [memorySpaceRemoveTarget, setMemorySpaceRemoveTarget] =
    useState<WorkspaceMemorySpaceListItem | null>(null);
  const [memorySpaceRenameTarget, setMemorySpaceRenameTarget] =
    useState<WorkspaceMemorySpaceListItem | null>(null);
  const [memoryCreateIntent, setMemoryCreateIntent] = useState<MemoryCreateIntent | null>(null);
  const [memoryDeleteTarget, setMemoryDeleteTarget] = useState<WorkspaceMemorySummary | null>(null);
  const [memoryRenameTarget, setMemoryRenameTarget] = useState<WorkspaceMemorySummary | null>(null);
  const [workspaceActionPending, setWorkspaceActionPending] = useState(false);
  const [workspaceEntryError, setWorkspaceEntryError] = useState<string | null>(null);
  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget | null>(null);
  const [recordingCloseBlocked, setRecordingCloseBlocked] = useState(false);
  const [recordingRecoveryActionPending, setRecordingRecoveryActionPending] = useState(false);
  const [recordingRecoveryDraft, setRecordingRecoveryDraft] =
    useState<RecordingRecoveryDraft | null>(null);
  const [recordingRecoveryReviewDraft, setRecordingRecoveryReviewDraft] =
    useState<RecordingRecoveryDraft | null>(null);
  const [memoryRailInline, setMemoryRailInline] = useState(canShowInlineMemoryRail);
  const [memoryRailOpen, setMemoryRailOpen] = useState(false);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(WORKSPACE_STAGE_VIEW);
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [segmentFocusIntent, setSegmentFocusIntent] = useState<SegmentFocusIntent | null>(null);
  const lastWorkspaceErrorToastRef = useRef<string | null>(null);
  const workspaceSessionRevisionRef = useRef(0);
  const workspaceSnapshotRefreshRequestRef = useRef(0);
  const setWorkspaceSession = useCallback(
    (
      nextSession:
        | WorkspaceSession
        | null
        | ((currentSession: WorkspaceSession | null) => WorkspaceSession | null)
    ) => {
      workspaceSessionRevisionRef.current += 1;
      setWorkspaceSessionState((currentSession) =>
        typeof nextSession === 'function' ? nextSession(currentSession) : nextSession
      );
    },
    []
  );
  const memorySpacesQuery = useQuery(memorySpacesQueryOptions());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(WORKSPACE_MEMORY_RAIL_INLINE_QUERY);
    const syncMemoryRailMode = (event?: MediaQueryListEvent) => {
      const matches = event?.matches ?? mediaQuery.matches;
      setMemoryRailInline(matches);
    };

    syncMemoryRailMode();
    mediaQuery.addEventListener('change', syncMemoryRailMode);
    return () => {
      mediaQuery.removeEventListener('change', syncMemoryRailMode);
    };
  }, []);

  useEffect(() => {
    return () => {
      document.documentElement.removeAttribute('data-theme');
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset['theme'] = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (!recordingTarget || !recordingCloseBlocked) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = RECORDING_FLOW_NAVIGATION_BLOCKED;
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [recordingCloseBlocked, recordingTarget]);

  useEffect(() => {
    if (!workspaceSession || recordingTarget) {
      setRecordingRecoveryDraft(null);
      return;
    }

    setRecordingRecoveryDraft(readRecordingRecoveryDraft(workspaceSession));
  }, [recordingTarget, workspaceSession]);

  useEffect(() => {
    if (!workspaceSession || recordingTarget) {
      return;
    }

    const activeSession = workspaceSession;
    let disposed = false;

    async function refreshWorkspaceFromFileTruth() {
      const requestId = ++workspaceSnapshotRefreshRequestRef.current;
      const sessionRevision = workspaceSessionRevisionRef.current;
      const response = await readWorkspaceSnapshot({
        workspaceHandle: activeSession.workspaceHandle,
      }).catch((error: unknown) => {
        if (
          !disposed &&
          requestId === workspaceSnapshotRefreshRequestRef.current &&
          sessionRevision === workspaceSessionRevisionRef.current
        ) {
          setWorkspaceEntryError(unknownErrorDisplayMessage(error, '无法刷新记忆空间。'));
        }
        return null;
      });

      if (
        !response ||
        disposed ||
        requestId !== workspaceSnapshotRefreshRequestRef.current ||
        sessionRevision !== workspaceSessionRevisionRef.current
      ) {
        return;
      }

      if (!response.ok) {
        setWorkspaceEntryError(workspaceErrorDisplayMessage(response.error, '无法刷新记忆空间。'));
        return;
      }

      if (response.value.workspaceId !== activeSession.workspaceId) {
        setWorkspaceEntryError('无法刷新记忆空间。');
        return;
      }

      const refreshedSession: WorkspaceSession = {
        ...activeSession,
        snapshot: response.value,
      };

      seedWorkspaceSnapshot(queryClient, refreshedSession);
      setWorkspaceEntryError(null);
      setWorkspaceSession((currentSession) =>
        currentSession?.workspaceHandle === activeSession.workspaceHandle
          ? refreshedSession
          : currentSession
      );
      setSelectedMemoryId((currentMemoryId) => {
        if (
          currentMemoryId &&
          response.value.memories.some((memory) => memory.memoryId === currentMemoryId)
        ) {
          return currentMemoryId;
        }

        return response.value.memories[0]?.memoryId ?? null;
      });
      void queryClient.invalidateQueries({ queryKey: memorySpacesQueryKey() });
      void queryClient.invalidateQueries({
        queryKey: ['workspace', 'memory-detail', response.value.workspaceId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['workspace', 'segment-content', response.value.workspaceId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['workspace', 'segment-attachment-content', response.value.workspaceId],
      });
    }

    function handleFocus() {
      void refreshWorkspaceFromFileTruth();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshWorkspaceFromFileTruth();
      }
    }

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      disposed = true;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient, recordingTarget, setWorkspaceSession, workspaceSession]);

  function toggleTheme() {
    setThemeMode((currentMode) => (currentMode === 'light' ? 'dark' : 'light'));
  }

  function setReadyWorkspaceSession(nextWorkspaceSession: WorkspaceSession) {
    seedWorkspaceSnapshot(queryClient, nextWorkspaceSession);
    setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
    setWorkspaceCreateOpen(false);
    setWorkspaceEntryError(null);
    setMemoryCreateIntent(null);
    setMemoryDeleteTarget(null);
    setMemoryRenameTarget(null);
    setMemorySpaceRenameTarget(null);
    setSelectedMemoryId(nextWorkspaceSession.snapshot.memories[0]?.memoryId ?? null);
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
    setMemorySpaceRenameTarget(null);
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

  function blockRecordingFlowInterruption() {
    if (!recordingTarget) {
      return false;
    }

    toast.error(RECORDING_FLOW_NAVIGATION_BLOCKED);
    return true;
  }

  function openWorkspaceCreateDialog() {
    if (blockRecordingFlowInterruption()) {
      return;
    }

    setWorkspaceEntryError(null);
    setMemoryCreateIntent(null);
    setMemorySpaceRemoveTarget(null);
    setMemorySpaceRenameTarget(null);
    setMemoryDeleteTarget(null);
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
    if (blockRecordingFlowInterruption()) {
      return;
    }

    handleWorkspaceCreateOpenChange(false);
    handleMemorySpaceRemoveOpenChange(false);
    handleMemorySpaceRenameOpenChange(false);

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
      setMemorySpaceRenameTarget(null);
      setSelectedMemoryId(null);
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
    if (blockRecordingFlowInterruption()) {
      return;
    }

    setWorkspaceCreateOpen(false);
    setWorkspaceEntryError(null);
    setMemoryCreateIntent(null);
    setMemoryDeleteTarget(null);
    setMemorySpaceRenameTarget(null);
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

  function openMemorySpaceRenameDialog(memorySpace: WorkspaceMemorySpaceListItem) {
    if (blockRecordingFlowInterruption()) {
      return;
    }

    setWorkspaceCreateOpen(false);
    setWorkspaceEntryError(null);
    setMemoryCreateIntent(null);
    setMemoryDeleteTarget(null);
    setMemoryRenameTarget(null);
    setMemorySpaceRemoveTarget(null);
    setMemorySpaceRenameTarget(memorySpace);
  }

  function handleMemorySpaceRenameOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setMemorySpaceRenameTarget(null);
    }
  }

  function mergeMemorySpaceTitleIntoList(workspaceId: string, title: string, description: string) {
    queryClient.setQueryData<readonly WorkspaceMemorySpaceListItem[] | undefined>(
      memorySpacesQueryKey(),
      (currentMemorySpaces) =>
        currentMemorySpaces?.map((memorySpace) =>
          memorySpace.workspaceId === workspaceId
            ? { ...memorySpace, title, description }
            : memorySpace
        )
    );
  }

  async function saveRenamedMemorySpace(title: string) {
    if (!memorySpaceRenameTarget) {
      return null;
    }
    const nextTitle = title.trim();
    if (nextTitle === memorySpaceRenameTarget.title.trim()) {
      return null;
    }

    const activeTarget =
      workspaceSession?.workspaceId === memorySpaceRenameTarget.workspaceId
        ? workspaceSession
        : null;

    try {
      const response = await updateMemorySpaceTitle(
        activeTarget
          ? {
              workspaceHandle: activeTarget.workspaceHandle,
              title: nextTitle,
            }
          : {
              workspaceId: memorySpaceRenameTarget.workspaceId,
              title: nextTitle,
            }
      );

      if (!response.ok) {
        return workspaceErrorDisplayMessage(response.error, '无法重命名记忆空间。');
      }

      mergeMemorySpaceTitleIntoList(
        response.value.workspaceId,
        response.value.title,
        response.value.description
      );

      if (activeTarget) {
        seedWorkspaceSnapshot(queryClient, {
          ...activeTarget,
          snapshot: response.value,
        });
        setWorkspaceSession((currentSession) =>
          currentSession?.workspaceId === response.value.workspaceId
            ? { ...currentSession, snapshot: response.value }
            : currentSession
        );
      } else {
        void queryClient.invalidateQueries({ queryKey: memorySpacesQueryKey() });
      }

      setMemorySpaceRenameTarget(null);
      toast.success('已重命名记忆空间');
      return null;
    } catch (error) {
      return unknownErrorDisplayMessage(error, '无法重命名记忆空间。');
    }
  }

  async function confirmRemoveMemorySpace() {
    if (blockRecordingFlowInterruption()) {
      return;
    }

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
        setMemoryDeleteTarget(null);
        setMemoryRenameTarget(null);
        setMemorySpaceRenameTarget(null);
        setSelectedMemoryId(null);
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
    if (blockRecordingFlowInterruption()) {
      return;
    }

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
    if (blockRecordingFlowInterruption()) {
      return;
    }

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

  useEffect(() => {
    if (!visibleWorkspaceEntryError) {
      lastWorkspaceErrorToastRef.current = null;
      return;
    }

    if (lastWorkspaceErrorToastRef.current === visibleWorkspaceEntryError) {
      return;
    }

    toast.error('操作失败', {
      description: visibleWorkspaceEntryError,
    });
    lastWorkspaceErrorToastRef.current = visibleWorkspaceEntryError;
  }, [visibleWorkspaceEntryError]);

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
    onRenameMemorySpace: openMemorySpaceRenameDialog,
    onRemoveMemorySpace: openMemorySpaceRemoveDialog,
    onSelectMemorySpace: (workspaceId: string) => {
      void selectMemorySpaceFromSidebar(workspaceId);
    },
  };
  const workspaceDialogs = (
    <>
      <WorkspaceCreateDialog
        disabled={workspaceActionPending}
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
      <MemoryTitleDialog
        description="保持简短且易识别"
        fieldLabel="记忆空间名称"
        initialTitle={memorySpaceRenameTarget?.title ?? ''}
        maxLengthMessage="记忆空间名称过长"
        onOpenChange={handleMemorySpaceRenameOpenChange}
        onSubmitTitle={saveRenamedMemorySpace}
        open={memorySpaceRenameTarget !== null}
        requiredMessage="请输入记忆空间名称"
        saveErrorTitle="无法保存记忆空间名称"
        submitLabel="保存"
        title="重命名记忆空间"
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
          {workspaceView.name === 'library' ? <WorkspaceLibraryPage /> : <WorkspaceStarterHome />}
        </AppShell>
        {workspaceDialogs}
      </>
    );
  }
  const activeWorkspaceSession = workspaceSession;
  const currentMemory =
    activeWorkspaceSession.snapshot.memories.find(
      (memory) => memory.memoryId === selectedMemoryId
    ) ??
    activeWorkspaceSession.snapshot.memories[0] ??
    null;
  const currentMemoryId = currentMemory?.memoryId ?? null;

  function handleAudioSegmentFinalized(finalized: FinalizedAudioSegment) {
    const snapshotQueryKey = workspaceSnapshotQueryKey(activeWorkspaceSession);
    const detailQueryKey = memoryDetailQueryKey({
      workspaceId: activeWorkspaceSession.workspaceId,
      memoryId: finalized.memory.memoryId,
    });
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) =>
        mergeMemoryIntoSession(
          {
            ...activeWorkspaceSession,
            snapshot: currentSnapshot ?? activeWorkspaceSession.snapshot,
          },
          finalized.memory
        ).snapshot
    );
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(detailQueryKey, (currentDetail) =>
      mergeSegmentIntoMemoryDetail(
        currentDetail,
        finalized.memory,
        finalized.segment,
        activeWorkspaceSession.workspaceId
      )
    );
    setSelectedMemoryId(finalized.segment.memoryId);
    setSegmentFocusIntent({
      memoryId: finalized.segment.memoryId,
      segmentId: finalized.segment.segmentId,
    });
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceId === activeWorkspaceSession.workspaceId
        ? mergeMemoryIntoSession(currentSession, finalized.memory)
        : currentSession
    );
  }

  function handleSegmentAttachmentFinalized(finalized: FinalizedSegmentAttachmentRecording) {
    const snapshotQueryKey = workspaceSnapshotQueryKey(activeWorkspaceSession);
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) =>
        mergeMemoryIntoSession(
          {
            ...activeWorkspaceSession,
            snapshot: currentSnapshot ?? activeWorkspaceSession.snapshot,
          },
          finalized.memory
        ).snapshot
    );
    queryClient.setQueryData<
      | {
          readonly requestId: string;
          readonly detail: import('./workspace/workspaceApi').WorkspaceMemoryDetail;
        }
      | undefined
    >(
      memoryDetailQueryKey({
        workspaceId: activeWorkspaceSession.workspaceId,
        memoryId: finalized.memory.memoryId,
      }),
      (currentDetail) =>
        currentDetail
          ? {
              ...currentDetail,
              detail: {
                ...currentDetail.detail,
                ...finalized.memory,
                workspaceId: currentDetail.detail.workspaceId,
                segments: currentDetail.detail.segments.map((segment) =>
                  segment.segmentId === finalized.segment.segmentId ? finalized.segment : segment
                ),
              },
            }
          : currentDetail
    );
    setSelectedMemoryId(finalized.memory.memoryId);
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceId === activeWorkspaceSession.workspaceId
        ? mergeMemoryIntoSession(currentSession, finalized.memory)
        : currentSession
    );
  }

  async function saveRecoveredRecording() {
    const draft = recordingRecoveryDraft;
    if (!draft || recordingRecoveryActionPending) {
      return;
    }

    setRecordingRecoveryActionPending(true);
    try {
      let finalizedAudio = draft.finalizedAudio ?? null;
      if (draft.targetKind === 'segment-attachment') {
        let finalizedAttachment = draft.finalizedAttachment ?? null;
        if (!finalizedAttachment) {
          if (!draft.parentSegmentId) {
            toast.error(RECORDING_RECOVERY_SAVE_ERROR, {
              description: '无法确认补充录音所属片段。',
            });
            return;
          }
          const response = await finalizeSegmentAttachmentRecordingDraft({
            attachmentId: draft.segmentId,
            durationMs: draft.durationMs,
            memoryId: draft.memoryId,
            segmentId: draft.parentSegmentId,
            title: draft.title,
            workspaceHandle: activeWorkspaceSession.workspaceHandle,
            workspaceId: activeWorkspaceSession.workspaceId,
          });
          if (!response.ok) {
            toast.error(RECORDING_RECOVERY_SAVE_ERROR, {
              description: workspaceErrorDisplayMessage(
                response.error,
                RECORDING_RECOVERY_SAVE_ERROR
              ),
            });
            return;
          }
          finalizedAttachment = response.value;
          handleSegmentAttachmentFinalized(finalizedAttachment);
          updateRecordingRecoverySnapshot({
            patch: { finalizedAttachment },
            segmentId: draft.segmentId,
            workspaceId: activeWorkspaceSession.workspaceId,
          });
          setRecordingRecoveryDraft({ ...draft, finalizedAttachment });
        } else {
          handleSegmentAttachmentFinalized(finalizedAttachment);
        }
        clearRecordingRecoveryDraft({
          segmentId: draft.segmentId,
          workspaceId: activeWorkspaceSession.workspaceId,
        });
        setRecordingRecoveryDraft(null);
        toast.success('已保存未完成录音');
        return;
      }

      if (!finalizedAudio) {
        const response = await finalizeRecordingDraft({
          durationMs: draft.durationMs,
          memoryId: draft.memoryId,
          segmentId: draft.segmentId,
          title: draft.title,
          workspaceHandle: activeWorkspaceSession.workspaceHandle,
        });
        if (!response.ok) {
          toast.error(RECORDING_RECOVERY_SAVE_ERROR, {
            description: workspaceErrorDisplayMessage(
              response.error,
              RECORDING_RECOVERY_SAVE_ERROR
            ),
          });
          return;
        }
        finalizedAudio = response.value;
        handleAudioSegmentFinalized(finalizedAudio);
        updateRecordingRecoverySnapshot({
          patch: { finalizedAudio },
          segmentId: draft.segmentId,
          workspaceId: activeWorkspaceSession.workspaceId,
        });
        setRecordingRecoveryDraft({ ...draft, finalizedAudio });
      } else {
        handleAudioSegmentFinalized(finalizedAudio);
      }
      const recoveredTranscript =
        draft.transcriptMarkdown ?? transcriptMarkdownFromSegments(draft.transcriptSegments ?? []);
      let transcriptSaved = true;
      if (recoveredTranscript.length > 0) {
        try {
          const transcriptResponse = await saveTranscript({
            markdown: recoveredTranscript,
            memoryId: finalizedAudio.segment.memoryId,
            segmentId: finalizedAudio.segment.segmentId,
            workspaceHandle: activeWorkspaceSession.workspaceHandle,
          });
          if (transcriptResponse.ok) {
            handleRecordingContentSaved({
              memory: transcriptResponse.value.memory,
              memoryId: finalizedAudio.segment.memoryId,
              segmentId: finalizedAudio.segment.segmentId,
            });
          } else {
            transcriptSaved = false;
            toast.error('录音已保存，转写暂时无法写入。', {
              description: workspaceErrorDisplayMessage(
                transcriptResponse.error,
                '录音已保存，转写暂时无法写入。'
              ),
            });
          }
        } catch (transcriptError) {
          transcriptSaved = false;
          toast.error('录音已保存，转写暂时无法写入。', {
            description: unknownErrorDisplayMessage(
              transcriptError,
              '录音已保存，转写暂时无法写入。'
            ),
          });
        }
      }
      if (!transcriptSaved) {
        return;
      }
      clearRecordingRecoveryDraft({
        segmentId: draft.segmentId,
        workspaceId: activeWorkspaceSession.workspaceId,
      });
      setRecordingRecoveryDraft(null);
      toast.success('已保存未完成录音');
    } catch (error) {
      toast.error(RECORDING_RECOVERY_SAVE_ERROR, {
        description: unknownErrorDisplayMessage(error, RECORDING_RECOVERY_SAVE_ERROR),
      });
    } finally {
      setRecordingRecoveryActionPending(false);
    }
  }

  async function discardRecoveredRecording() {
    const draft = recordingRecoveryDraft;
    if (!draft || recordingRecoveryActionPending) {
      return;
    }

    setRecordingRecoveryActionPending(true);
    try {
      if (draft.finalizedAudio || draft.finalizedAttachment) {
        clearRecordingRecoveryDraft({
          segmentId: draft.segmentId,
          workspaceId: activeWorkspaceSession.workspaceId,
        });
        setRecordingRecoveryDraft(null);
        toast.success('已关闭录音恢复提示');
        return;
      }

      const response =
        draft.targetKind === 'segment-attachment'
          ? await discardSegmentAttachmentRecordingDraft({
              attachmentId: draft.segmentId,
              workspaceHandle: activeWorkspaceSession.workspaceHandle,
            })
          : await discardRecordingDraft({
              segmentId: draft.segmentId,
              workspaceHandle: activeWorkspaceSession.workspaceHandle,
            });
      if (!response.ok) {
        toast.error(RECORDING_RECOVERY_DISCARD_ERROR, {
          description: workspaceErrorDisplayMessage(
            response.error,
            RECORDING_RECOVERY_DISCARD_ERROR
          ),
        });
        return;
      }

      clearRecordingRecoveryDraft({
        segmentId: draft.segmentId,
        workspaceId: activeWorkspaceSession.workspaceId,
      });
      setRecordingRecoveryDraft(null);
      toast.success('已放弃未完成录音');
    } catch (error) {
      toast.error(RECORDING_RECOVERY_DISCARD_ERROR, {
        description: unknownErrorDisplayMessage(error, RECORDING_RECOVERY_DISCARD_ERROR),
      });
    } finally {
      setRecordingRecoveryActionPending(false);
    }
  }

  function openMemoryCreateDialog(intent: MemoryCreateIntent) {
    if (blockRecordingFlowInterruption()) {
      return;
    }

    setWorkspaceEntryError(null);
    setWorkspaceCreateOpen(false);
    setMemoryDeleteTarget(null);
    setMemorySpaceRemoveTarget(null);
    setMemorySpaceRenameTarget(null);
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
          mergeMemoryIntoSession(
            {
              ...activeWorkspaceSession,
              snapshot: currentSnapshot ?? activeWorkspaceSession.snapshot,
            },
            response.value
          ).snapshot
      );
      setSelectedMemoryId(response.value.memoryId);
      setWorkspaceSession((currentSession) =>
        currentSession?.workspaceId === activeWorkspaceSession.workspaceId
          ? mergeMemoryIntoSession(currentSession, response.value)
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

      const snapshotQueryKey = workspaceSnapshotQueryKey(activeWorkspaceSession);

      queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
        snapshotQueryKey,
        (currentSnapshot) =>
          mergeMemoryIntoSession(
            {
              ...activeWorkspaceSession,
              snapshot: currentSnapshot ?? activeWorkspaceSession.snapshot,
            },
            response.value
          ).snapshot
      );
      setWorkspaceSession((currentSession) =>
        currentSession?.workspaceId === activeWorkspaceSession.workspaceId
          ? mergeMemoryIntoSession(currentSession, response.value)
          : currentSession
      );
      setMemoryRenameTarget(null);
      toast.success('已重命名记忆');
      return null;
    } catch (error) {
      return unknownErrorDisplayMessage(error, '无法重命名记忆。');
    }
  }

  function applyMemoryListUpdate(memories: readonly WorkspaceMemorySummary[]) {
    const snapshotQueryKey = workspaceSnapshotQueryKey(activeWorkspaceSession);
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) => ({
        ...(currentSnapshot ?? activeWorkspaceSession.snapshot),
        memories: [...memories],
      })
    );
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceId === activeWorkspaceSession.workspaceId
        ? replaceSessionMemories(currentSession, memories)
        : currentSession
    );
  }

  function openMemoryDeleteDialog(memory: WorkspaceMemorySummary) {
    if (blockRecordingFlowInterruption()) {
      return;
    }

    setWorkspaceEntryError(null);
    setWorkspaceCreateOpen(false);
    setMemoryCreateIntent(null);
    setMemoryRenameTarget(null);
    setMemorySpaceRemoveTarget(null);
    setMemoryDeleteTarget(memory);
  }

  function handleMemoryDeleteOpenChange(nextOpen: boolean) {
    if (!nextOpen && workspaceActionPending) {
      return;
    }

    if (!nextOpen) {
      setMemoryDeleteTarget(null);
    }
  }

  async function restoreDeletedMemoryFromUndo(restoreToken: string) {
    if (!beginWorkspaceAction()) {
      return;
    }

    try {
      const response = await restoreDeletedMemory({
        workspaceHandle: activeWorkspaceSession.workspaceHandle,
        restoreToken,
      });

      if (!response.ok) {
        toast.error(MEMORY_RESTORE_ERROR, {
          description: workspaceErrorDisplayMessage(response.error, MEMORY_RESTORE_ERROR),
        });
        return;
      }

      applyMemoryListUpdate(response.value.memories);
      setSelectedMemoryId(response.value.memory.memoryId);
      toast.success('已恢复记忆');
    } catch (error) {
      toast.error(MEMORY_RESTORE_ERROR, {
        description: unknownErrorDisplayMessage(error, MEMORY_RESTORE_ERROR),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  async function confirmDeleteMemory() {
    if (blockRecordingFlowInterruption()) {
      return;
    }

    const target = memoryDeleteTarget;
    if (!target || !beginWorkspaceAction()) {
      return;
    }

    try {
      const response = await deleteMemory({
        workspaceHandle: activeWorkspaceSession.workspaceHandle,
        memoryId: target.memoryId,
      });

      if (!response.ok) {
        toast.error(MEMORY_DELETE_ERROR, {
          description: workspaceErrorDisplayMessage(response.error, MEMORY_DELETE_ERROR),
        });
        return;
      }

      applyMemoryListUpdate(response.value.memories);
      queryClient.removeQueries({
        queryKey: memoryDetailQueryKey({
          workspaceId: activeWorkspaceSession.workspaceId,
          memoryId: target.memoryId,
        }),
      });
      if (currentMemoryId === target.memoryId) {
        setSelectedMemoryId(response.value.memories[0]?.memoryId ?? null);
      }
      setMemoryDeleteTarget(null);
      toast.success('已删除记忆', {
        description: '可以从这次提示恢复。',
        action: {
          label: '恢复',
          onClick: () => {
            void restoreDeletedMemoryFromUndo(response.value.restoreToken);
          },
        },
      });
    } catch (error) {
      toast.error(MEMORY_DELETE_ERROR, {
        description: unknownErrorDisplayMessage(error, MEMORY_DELETE_ERROR),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  function openRecording(target: RecordingTarget) {
    setRecordingCloseBlocked(false);
    setRecordingTarget(target);
  }

  function reviewRecoveredRecording() {
    const draft = recordingRecoveryDraft;
    if (!draft || recordingRecoveryActionPending) {
      return;
    }
    if (draft.finalizedAudio) {
      void saveRecoveredRecording();
      return;
    }
    if (draft.targetKind === 'segment-attachment') {
      void saveRecoveredRecording();
      return;
    }

    setSelectedMemoryId(draft.memoryId);
    setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
    setRecordingRecoveryDraft(null);
    setRecordingRecoveryReviewDraft(draft);
    openRecording({ kind: 'existing-memory', memoryId: draft.memoryId });
  }

  function requestStartRecording() {
    if (currentMemoryId) {
      openRecording({ kind: 'existing-memory', memoryId: currentMemoryId });
      return;
    }

    openMemoryCreateDialog({ afterCreate: 'record-memory' });
  }

  function requestStartSegmentAttachmentRecording(target: {
    readonly memoryId: string;
    readonly segmentId: string;
  }) {
    if (blockRecordingFlowInterruption()) {
      return;
    }

    setSelectedMemoryId(target.memoryId);
    openRecording({
      kind: 'segment-attachment',
      memoryId: target.memoryId,
      segmentId: target.segmentId,
    });
  }

  function handleRecordingContentSaved({ memory, memoryId, segmentId }: SavedRecordingContent) {
    const snapshotQueryKey = workspaceSnapshotQueryKey(activeWorkspaceSession);
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) =>
        mergeMemoryIntoSession(
          {
            ...activeWorkspaceSession,
            snapshot: currentSnapshot ?? activeWorkspaceSession.snapshot,
          },
          memory
        ).snapshot
    );
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(
      memoryDetailQueryKey({
        workspaceId: activeWorkspaceSession.workspaceId,
        memoryId,
      }),
      (currentDetail) => {
        if (
          !currentDetail ||
          currentDetail.detail.workspaceId !== activeWorkspaceSession.workspaceId ||
          currentDetail.detail.memoryId !== memoryId
        ) {
          return currentDetail;
        }

        return {
          ...currentDetail,
          detail: {
            ...currentDetail.detail,
            ...memory,
            workspaceId: currentDetail.detail.workspaceId,
            segments: currentDetail.detail.segments.map((segment) =>
              segment.segmentId === segmentId
                ? {
                    ...segment,
                    transcript: { exists: true },
                  }
                : segment
            ),
          },
        };
      }
    );
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: segmentContentQueryKey({
        workspaceId: activeWorkspaceSession.workspaceId,
        memoryId,
        segmentId,
      }),
    });
    setSelectedMemoryId(memory.memoryId);
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceId === activeWorkspaceSession.workspaceId
        ? mergeMemoryIntoSession(currentSession, memory)
        : currentSession
    );
  }

  function selectMemory(memoryId: string) {
    if (blockRecordingFlowInterruption()) {
      return;
    }

    setSelectedMemoryId(memoryId);
    setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
  }

  function toggleMemoryRail() {
    setMemoryRailOpen((open) => !open);
  }

  function handleRecordingOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setRecordingCloseBlocked(false);
      setRecordingTarget(null);
      setRecordingRecoveryReviewDraft(null);
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
              currentMemory={currentMemory}
              memoryRailOpen={memoryRailOpen}
              onCreateMemory={() => openMemoryCreateDialog({ afterCreate: 'stay-on-stage' })}
              onRenameMemory={setMemoryRenameTarget}
              onRenameMemorySpace={() =>
                openMemorySpaceRenameDialog({
                  workspaceId: activeWorkspaceSession.workspaceId,
                  title: activeWorkspaceSession.snapshot.title,
                })
              }
              onToggleMemoryRail={toggleMemoryRail}
              title={activeWorkspaceSession.snapshot.title}
            />
          ) : null
        }
      >
        {workspaceView.name === 'library' ? (
          <WorkspaceLibraryPage />
        ) : (
          <LoadedWorkspaceFrame
            workspaceSession={activeWorkspaceSession}
            currentMemory={currentMemory}
            segmentFocusIntent={
              currentMemory && segmentFocusIntent?.memoryId === currentMemory.memoryId
                ? segmentFocusIntent.segmentId
                : null
            }
            memoryRailOpen={memoryRailOpen}
            memoryRailMode={memoryRailInline ? 'inline' : 'overlay'}
            onDeleteMemory={openMemoryDeleteDialog}
            onSegmentFocusConsumed={(segmentId) => {
              setSegmentFocusIntent((currentIntent) =>
                currentIntent?.segmentId === segmentId ? null : currentIntent
              );
            }}
            onSelectMemory={selectMemory}
            onRenameMemory={setMemoryRenameTarget}
            onStartSegmentAttachmentRecording={requestStartSegmentAttachmentRecording}
            onStartRecording={requestStartRecording}
          />
        )}
      </AppShell>
      {recordingTarget ? (
        <RecordingOverlay
          onCloseBlockedChange={setRecordingCloseBlocked}
          onRecordingContentSaved={handleRecordingContentSaved}
          onOpenChange={handleRecordingOpenChange}
          onAudioSegmentFinalized={handleAudioSegmentFinalized}
          onSegmentAttachmentFinalized={handleSegmentAttachmentFinalized}
          open
          recoveredDraft={recordingRecoveryReviewDraft}
          recordingTarget={recordingTarget}
          workspaceSession={activeWorkspaceSession}
        />
      ) : null}
      <RecordingRecoveryDialog
        canReview={recordingRecoveryDraft?.targetKind !== 'segment-attachment'}
        disabled={recordingRecoveryActionPending}
        draft={recordingRecoveryDraft}
        onDiscard={() => {
          void discardRecoveredRecording();
        }}
        onReview={reviewRecoveredRecording}
        onSave={() => {
          void saveRecoveredRecording();
        }}
      />
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
      <MemoryDeleteDialog
        disabled={workspaceActionPending}
        memory={memoryDeleteTarget}
        onConfirm={() => {
          void confirmDeleteMemory();
        }}
        onOpenChange={handleMemoryDeleteOpenChange}
        open={memoryDeleteTarget !== null}
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

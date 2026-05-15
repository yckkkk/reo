import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppShell,
  type WorkspaceMemorySpace as SidebarWorkspaceMemorySpace,
} from './app-shell/AppShell';
import {
  cycleThemePreference,
  readThemePreference,
  resolveEffectiveTheme,
  SYSTEM_DARK_MEDIA_QUERY,
  writeThemePreference,
  type ThemePreference,
} from './app-shell/themePreference';
import { ReoToaster, showReoUndoToast, toast } from './components/ui/toaster';
import { LoadedWorkspaceFrame } from './workspace/LoadedWorkspaceFrame';
import { MemoryCreateDialog } from './workspace/MemoryCreateDialog';
import { MemoryDeleteDialog } from './workspace/MemoryDeleteDialog';
import { MemoryRenameDialog } from './workspace/MemoryRenameDialog';
import { MemoryTitleDialog } from './workspace/MemoryTitleDialog';
import { SegmentDeleteDialog } from './workspace/SegmentDeleteDialog';
import { SegmentSupplementDeleteDialog } from './workspace/SegmentSupplementDeleteDialog';
import { SegmentSupplementRenameDialog } from './workspace/SegmentSupplementRenameDialog';
import { SegmentRenameDialog } from './workspace/SegmentRenameDialog';
import type {
  SegmentSupplementDeleteTarget,
  SegmentSupplementRenameTarget,
  SegmentDeleteTarget,
  SegmentRenameTarget,
} from './workspace/segmentActionTargets';
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
  memorySummaryAfterSegmentRemoval,
  memorySummaryAfterSegmentRestore,
  memorySummaryWithPendingSegmentDelete,
  memorySummaryWithVisibleSegments,
  pendingSegmentDeleteBelongsToSession,
  pendingSegmentDeleteKey,
  queryKeyMatchesPendingSegmentDelete,
  type PendingSegmentDeleteProjection,
} from './workspace/segmentDeleteProjection';
import {
  closeWorkspace,
  createMemory,
  deleteMemory,
  deleteSegment,
  deleteSegmentSupplement,
  discardRecordingDraft,
  discardSegmentSupplementRecordingDraft,
  finalizeRecordingDraft,
  finalizeSegmentSupplementRecordingDraft,
  openWorkspace,
  openMemorySpace,
  readMemoryDetail,
  readWorkspaceSnapshot,
  removeMemorySpace,
  restoreDeletedMemory,
  restoreDeletedSegmentSupplement,
  saveSegmentSupplementTranscript,
  saveTranscript,
  updateMemorySpaceTitle,
  updateMemoryTitle,
  updateSegmentSupplementTitle,
  updateSegmentTitle,
  type FinalizedAudioSegment,
  type FinalizedSegmentSupplementRecording,
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
  segmentSupplementContentQueryKey,
  segmentSupplementContentQueryPrefix,
  segmentContentQueryKey,
  workspaceHandleScopedContentQueryBelongsToWorkspace,
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
type SegmentSupplementRestoreContext = {
  readonly supplement: WorkspaceMemoryDetail['segments'][number]['supplements'][number];
  readonly memoryId: string;
  readonly restoreToken: string;
  readonly segment: WorkspaceMemoryDetail['segments'][number];
  readonly segmentId: string;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
};

type SegmentDeleteToastPhase = 'pending' | 'committing' | 'undone' | 'settled';
type MemoryDetailQueryData = {
  readonly requestId: string;
  readonly detail: WorkspaceMemoryDetail;
};
type RecordingFlow =
  | { readonly status: 'closed' }
  | {
      readonly closeBlocked: boolean;
      readonly open: boolean;
      readonly recoveredDraft: RecordingRecoveryDraft | null;
      readonly status: 'active';
      readonly target: RecordingTarget;
    };

const WORKSPACE_STAGE_VIEW: TopLevelWorkspaceView = { name: 'workspace-stage' };
const LIBRARY_VIEW: TopLevelWorkspaceView = { name: 'library' };
const OPEN_MEMORY_SPACE_ERROR = '无法打开记忆空间。';
const REMOVE_MEMORY_SPACE_ERROR = '无法移除记忆空间。';
const RELEASE_MEMORY_SPACE_ERROR = '当前记忆空间会话未能释放。';
const MEMORY_DELETE_ERROR = '无法删除记忆。';
const MEMORY_RESTORE_ERROR = '无法恢复记忆。';
const SEGMENT_DELETE_ERROR = '无法删除片段。';
const SEGMENT_SUPPLEMENT_DELETE_ERROR = '无法删除补充内容。';
const SEGMENT_SUPPLEMENT_RESTORE_ERROR = '无法恢复补充内容。';
const SEGMENT_DELETE_UNDO_DURATION_MS = 10000;
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

function sortByProjectedUpdatedAt<
  T extends { readonly updatedAt: string; readonly createdAt: string },
>(items: readonly T[]): T[] {
  return [...items].sort((first, second) => {
    const updatedComparison = second.updatedAt.localeCompare(first.updatedAt);
    if (updatedComparison !== 0) {
      return updatedComparison;
    }
    return second.createdAt.localeCompare(first.createdAt);
  });
}

function sortSegmentsByUpdatedAt(
  segments: readonly WorkspaceMemoryDetail['segments'][number][]
): WorkspaceMemoryDetail['segments'] {
  return sortByProjectedUpdatedAt(segments);
}

function sortMemoriesByUpdatedAt(
  memories: readonly WorkspaceMemorySummary[]
): WorkspaceMemorySummary[] {
  return sortByProjectedUpdatedAt(memories);
}

function mergeMemoryIntoSnapshot(
  current: WorkspaceSession['snapshot'],
  updatedMemory: WorkspaceMemorySummary
): WorkspaceSession['snapshot'] {
  return {
    ...current,
    memories: sortMemoriesByUpdatedAt([
      updatedMemory,
      ...current.memories.filter((memory) => memory.memoryId !== updatedMemory.memoryId),
    ]),
  };
}

function sameMemorySummary(first: WorkspaceMemorySummary, second: WorkspaceMemorySummary): boolean {
  return (
    first.memoryId === second.memoryId &&
    first.title === second.title &&
    first.createdAt === second.createdAt &&
    first.updatedAt === second.updatedAt &&
    first.segmentCount === second.segmentCount &&
    first.durationMs === second.durationMs &&
    first.audioByteLength === second.audioByteLength &&
    first.hasTranscript === second.hasTranscript &&
    first.supplementCount === second.supplementCount
  );
}

function sameWorkspaceSnapshot(
  first: WorkspaceSession['snapshot'],
  second: WorkspaceSession['snapshot']
): boolean {
  return (
    first.workspaceId === second.workspaceId &&
    first.title === second.title &&
    first.description === second.description &&
    first.memories.length === second.memories.length &&
    first.memories.every((memory, index) => {
      const other = second.memories[index];
      return other !== undefined && sameMemorySummary(memory, other);
    })
  );
}

export function mergeMemoryIntoSession(
  current: WorkspaceSession,
  updatedMemory: WorkspaceMemorySummary
): WorkspaceSession {
  return {
    ...current,
    snapshot: mergeMemoryIntoSnapshot(current.snapshot, updatedMemory),
  };
}

function mergeMemoryIntoSnapshotIfCurrentTitle(
  current: WorkspaceSession['snapshot'] | undefined,
  memoryId: string,
  expectedTitle: string,
  updatedMemory: WorkspaceMemorySummary
): WorkspaceSession['snapshot'] | undefined {
  if (!current) {
    return current;
  }
  const currentMemory = current.memories.find((memory) => memory.memoryId === memoryId);
  if (currentMemory?.title !== expectedTitle) {
    return current;
  }
  return mergeMemoryIntoSnapshot(current, updatedMemory);
}

function mergeMemoryIntoSessionIfCurrentTitle(
  current: WorkspaceSession | null,
  workspaceId: string,
  memoryId: string,
  expectedTitle: string,
  updatedMemory: WorkspaceMemorySummary
): WorkspaceSession | null {
  if (current?.workspaceId !== workspaceId) {
    return current;
  }
  const nextSnapshot = mergeMemoryIntoSnapshotIfCurrentTitle(
    current.snapshot,
    memoryId,
    expectedTitle,
    updatedMemory
  );
  if (!nextSnapshot) {
    return current;
  }
  return nextSnapshot === current.snapshot ? current : { ...current, snapshot: nextSnapshot };
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
      segments: sortSegmentsByUpdatedAt(segmentReplaced ? segments : [...segments, segment]),
    },
  };
}

function mergeSegmentIntoMemoryDetailIfCurrentTitle(
  currentDetail: MemoryDetailQueryData | undefined,
  memory: WorkspaceMemorySummary,
  segment: WorkspaceMemoryDetail['segments'][number],
  workspaceId: string,
  expectedTitle: string
): MemoryDetailQueryData | undefined {
  const currentSegment = currentDetail?.detail.segments.find(
    (candidate) => candidate.segmentId === segment.segmentId
  );
  if (currentSegment?.title !== expectedTitle) {
    return currentDetail;
  }
  return mergeSegmentIntoMemoryDetail(currentDetail, memory, segment, workspaceId);
}

function mergeSegmentSupplementIntoMemoryDetailIfCurrentTitle(
  currentDetail: MemoryDetailQueryData | undefined,
  memory: WorkspaceMemorySummary,
  segment: WorkspaceMemoryDetail['segments'][number],
  supplement: WorkspaceMemoryDetail['segments'][number]['supplements'][number],
  workspaceId: string,
  expectedTitle: string
): MemoryDetailQueryData | undefined {
  if (
    !currentDetail ||
    currentDetail.detail.workspaceId !== workspaceId ||
    currentDetail.detail.memoryId !== memory.memoryId ||
    segment.workspaceId !== workspaceId ||
    segment.memoryId !== memory.memoryId ||
    supplement.workspaceId !== workspaceId ||
    supplement.memoryId !== memory.memoryId ||
    supplement.segmentId !== segment.segmentId
  ) {
    return currentDetail;
  }

  const currentSegment = currentDetail.detail.segments.find(
    (candidate) => candidate.segmentId === segment.segmentId
  );
  const currentSupplement = currentSegment?.supplements.find(
    (candidate) => candidate.supplementId === supplement.supplementId
  );
  if (!currentSegment || currentSupplement?.title !== expectedTitle) {
    return currentDetail;
  }

  const nextSegment = {
    ...currentSegment,
    supplements: currentSegment.supplements.map((candidate) =>
      candidate.supplementId === supplement.supplementId ? supplement : candidate
    ),
  };
  return mergeSegmentIntoMemoryDetail(currentDetail, memory, nextSegment, workspaceId);
}

function segmentWithSupplementRemoved(
  segment: WorkspaceMemoryDetail['segments'][number],
  supplementId: string
): WorkspaceMemoryDetail['segments'][number] {
  const supplements = segment.supplements.filter(
    (supplement) => supplement.supplementId !== supplementId
  );

  return {
    ...segment,
    supplementCount: supplements.length,
    supplements,
  };
}

function segmentWithSupplementRestored(
  segment: WorkspaceMemoryDetail['segments'][number],
  supplement: WorkspaceMemoryDetail['segments'][number]['supplements'][number]
): WorkspaceMemoryDetail['segments'][number] {
  const supplementExists = segment.supplements.some(
    (candidate) => candidate.supplementId === supplement.supplementId
  );
  const supplements = supplementExists
    ? segment.supplements.map((candidate) =>
        candidate.supplementId === supplement.supplementId ? supplement : candidate
      )
    : sortByProjectedUpdatedAt([...segment.supplements, supplement]);

  return {
    ...segment,
    supplementCount: supplements.length,
    supplements,
  };
}

function removeSegmentFromMemoryDetail(
  currentDetail: MemoryDetailQueryData | undefined,
  memory: WorkspaceMemorySummary,
  workspaceId: string,
  segmentId: string
): MemoryDetailQueryData | undefined {
  if (
    !currentDetail ||
    currentDetail.detail.workspaceId !== workspaceId ||
    currentDetail.detail.memoryId !== memory.memoryId
  ) {
    return currentDetail;
  }

  return {
    ...currentDetail,
    detail: {
      ...currentDetail.detail,
      ...memory,
      workspaceId: currentDetail.detail.workspaceId,
      segments: currentDetail.detail.segments.filter((segment) => segment.segmentId !== segmentId),
    },
  };
}

function memorySummaryWithDetailTranscriptWhenAdditiveFieldsMatch(
  memory: WorkspaceMemorySummary,
  currentDetail: MemoryDetailQueryData | undefined,
  workspaceId: string
): WorkspaceMemorySummary {
  if (
    !currentDetail ||
    currentDetail.detail.workspaceId !== workspaceId ||
    currentDetail.detail.memoryId !== memory.memoryId
  ) {
    return memory;
  }

  const detailSummary = memorySummaryWithVisibleSegments(memory, currentDetail.detail.segments);
  const detailMatchesProjectedAdditiveFields =
    detailSummary.audioByteLength === memory.audioByteLength &&
    detailSummary.supplementCount === memory.supplementCount &&
    detailSummary.durationMs === memory.durationMs &&
    detailSummary.segmentCount === memory.segmentCount;

  return detailMatchesProjectedAdditiveFields
    ? { ...memory, hasTranscript: detailSummary.hasTranscript }
    : memory;
}

function memorySummaryWithVisibleDetail(
  memory: WorkspaceMemorySummary,
  currentDetail: MemoryDetailQueryData | undefined,
  workspaceId: string,
  pendingSegmentIds: ReadonlySet<string>
): WorkspaceMemorySummary | null {
  if (
    !currentDetail ||
    currentDetail.detail.workspaceId !== workspaceId ||
    currentDetail.detail.memoryId !== memory.memoryId
  ) {
    return null;
  }

  return memorySummaryWithVisibleSegments(
    memory,
    currentDetail.detail.segments.filter((segment) => !pendingSegmentIds.has(segment.segmentId))
  );
}

function memorySummaryPreservingExternalNonAdditiveChanges({
  memory,
  pendingProjections,
  visibleSegments,
}: {
  readonly memory: WorkspaceMemorySummary;
  readonly pendingProjections: readonly PendingSegmentDeleteProjection[];
  readonly visibleSegments: readonly WorkspaceMemoryDetail['segments'][number][];
}): WorkspaceMemorySummary {
  const projectedMemory = memorySummaryWithVisibleSegments(memory, visibleSegments);
  const hasExternalNonAdditiveChange = pendingProjections.some(
    (projection) =>
      projection.memoryBeforeDelete.updatedAt !== memory.updatedAt ||
      projection.memoryBeforeDelete.hasTranscript !== memory.hasTranscript
  );

  return hasExternalNonAdditiveChange
    ? { ...projectedMemory, hasTranscript: memory.hasTranscript }
    : projectedMemory;
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
  const [segmentDeleteTarget, setSegmentDeleteTarget] = useState<SegmentDeleteTarget | null>(null);
  const [segmentRenameTarget, setSegmentRenameTarget] = useState<SegmentRenameTarget | null>(null);
  const [segmentSupplementDeleteTarget, setSegmentSupplementDeleteTarget] =
    useState<SegmentSupplementDeleteTarget | null>(null);
  const [segmentSupplementRenameTarget, setSegmentSupplementRenameTarget] =
    useState<SegmentSupplementRenameTarget | null>(null);
  const [workspaceActionPending, setWorkspaceActionPending] = useState(false);
  const [workspaceEntryError, setWorkspaceEntryError] = useState<string | null>(null);
  const [recordingFlow, setRecordingFlow] = useState<RecordingFlow>({ status: 'closed' });
  const [recordingRecoveryActionPending, setRecordingRecoveryActionPending] = useState(false);
  const [recordingRecoveryDraft, setRecordingRecoveryDraft] =
    useState<RecordingRecoveryDraft | null>(null);
  const [memoryRailInline, setMemoryRailInline] = useState(canShowInlineMemoryRail);
  const [memoryRailOpen, setMemoryRailOpen] = useState(false);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(WORKSPACE_STAGE_VIEW);
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() =>
    readThemePreference()
  );
  const [isSystemDark, setIsSystemDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(SYSTEM_DARK_MEDIA_QUERY).matches;
  });
  const effectiveTheme = resolveEffectiveTheme(themePreference, isSystemDark);
  const [segmentFocusIntent, setSegmentFocusIntent] = useState<SegmentFocusIntent | null>(null);
  const lastWorkspaceErrorToastRef = useRef<string | null>(null);
  const pendingSegmentDeleteProjectionsRef = useRef<Map<string, PendingSegmentDeleteProjection>>(
    new Map()
  );
  const workspaceSessionRef = useRef<WorkspaceSession | null>(null);
  const workspaceSessionRevisionRef = useRef(0);
  const workspaceSnapshotRefreshRequestRef = useRef(0);
  const setWorkspaceSession = useCallback(
    (
      nextSession:
        | WorkspaceSession
        | null
        | ((currentSession: WorkspaceSession | null) => WorkspaceSession | null)
    ) => {
      const currentSession = workspaceSessionRef.current;
      const resolvedSession =
        typeof nextSession === 'function' ? nextSession(currentSession) : nextSession;
      if (resolvedSession !== currentSession) {
        workspaceSessionRevisionRef.current += 1;
      }
      workspaceSessionRef.current = resolvedSession;
      if (!resolvedSession) {
        pendingSegmentDeleteProjectionsRef.current.clear();
      } else {
        for (const [key, projection] of pendingSegmentDeleteProjectionsRef.current.entries()) {
          if (!pendingSegmentDeleteBelongsToSession(projection, resolvedSession)) {
            pendingSegmentDeleteProjectionsRef.current.delete(key);
          }
        }
      }
      setWorkspaceSessionState(resolvedSession);
    },
    []
  );
  const memorySpacesQuery = useQuery(memorySpacesQueryOptions());
  const activeRecordingFlow = recordingFlow.status === 'active' ? recordingFlow : null;
  const recordingTarget = activeRecordingFlow?.target ?? null;
  const recordingOverlayOpen = activeRecordingFlow?.open ?? false;
  const recordingCloseBlocked = activeRecordingFlow?.closeBlocked ?? false;
  const recordingRecoveryReviewDraft = activeRecordingFlow?.recoveredDraft ?? null;
  const handleRecordingCloseBlockedChange = useCallback((closeBlocked: boolean) => {
    setRecordingFlow((currentFlow) =>
      currentFlow.status === 'active' ? { ...currentFlow, closeBlocked } : currentFlow
    );
  }, []);

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
    document.documentElement.dataset['theme'] = effectiveTheme;
  }, [effectiveTheme]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(SYSTEM_DARK_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setIsSystemDark(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
    if (!workspaceSession) {
      pendingSegmentDeleteProjectionsRef.current.clear();
      return;
    }

    for (const [key, projection] of pendingSegmentDeleteProjectionsRef.current.entries()) {
      if (!pendingSegmentDeleteBelongsToSession(projection, workspaceSession)) {
        pendingSegmentDeleteProjectionsRef.current.delete(key);
      }
    }
  }, [workspaceSession]);

  useEffect(() => {
    if (!workspaceSession || recordingTarget) {
      return;
    }

    const activeSession = workspaceSession;
    let disposed = false;

    async function refreshWorkspaceFromFileTruth({ showError }: { readonly showError: boolean }) {
      const requestId = ++workspaceSnapshotRefreshRequestRef.current;
      const sessionRevision = workspaceSessionRevisionRef.current;
      const response = await readWorkspaceSnapshot({
        workspaceHandle: activeSession.workspaceHandle,
      }).catch((error: unknown) => {
        if (
          showError &&
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
        if (showError) {
          setWorkspaceEntryError(
            workspaceErrorDisplayMessage(response.error, '无法刷新记忆空间。')
          );
        }
        return;
      }

      if (response.value.workspaceId !== activeSession.workspaceId) {
        if (showError) {
          setWorkspaceEntryError('无法刷新记忆空间。');
        }
        return;
      }

      const pendingSegmentDeleteProjections = [
        ...pendingSegmentDeleteProjectionsRef.current.values(),
      ].filter((projection) => pendingSegmentDeleteBelongsToSession(projection, activeSession));
      const pendingProjectionsByMemory = new Map<string, PendingSegmentDeleteProjection[]>();
      for (const projection of pendingSegmentDeleteProjections) {
        pendingProjectionsByMemory.set(projection.memoryId, [
          ...(pendingProjectionsByMemory.get(projection.memoryId) ?? []),
          projection,
        ]);
      }
      const pendingDetailCacheUpdates: {
        readonly queryKey: ReturnType<typeof memoryDetailQueryKey>;
        readonly data: MemoryDetailQueryData;
      }[] = [];
      const projectedMemories = await Promise.all(
        response.value.memories.map(async (memory) => {
          const pendingForMemory = pendingProjectionsByMemory.get(memory.memoryId) ?? [];
          if (pendingForMemory.length === 0) {
            return memory;
          }

          const pendingSegmentIds = new Set(
            pendingForMemory.map((projection) => projection.segmentId)
          );
          const detailQueryKey = memoryDetailQueryKey({
            workspaceId: response.value.workspaceId,
            memoryId: memory.memoryId,
          });
          const requestId = `memory-detail-refresh:${response.value.workspaceId}:${
            memory.memoryId
          }:${Date.now()}:${Math.random().toString(36).slice(2)}`;
          const detailResponse = await readMemoryDetail({
            workspaceHandle: activeSession.workspaceHandle,
            workspaceId: response.value.workspaceId,
            memoryId: memory.memoryId,
            requestId,
          }).catch(() => null);
          if (
            detailResponse?.ok &&
            detailResponse.value.requestId === requestId &&
            detailResponse.value.detail.workspaceId === response.value.workspaceId &&
            detailResponse.value.detail.memoryId === memory.memoryId
          ) {
            const visibleSegments = detailResponse.value.detail.segments.filter(
              (segment) => !pendingSegmentIds.has(segment.segmentId)
            );
            const projectedMemory = memorySummaryPreservingExternalNonAdditiveChanges({
              memory,
              pendingProjections: pendingForMemory,
              visibleSegments,
            });
            pendingDetailCacheUpdates.push({
              queryKey: detailQueryKey,
              data: {
                requestId,
                detail: {
                  ...detailResponse.value.detail,
                  ...projectedMemory,
                  workspaceId: detailResponse.value.detail.workspaceId,
                  segments: visibleSegments,
                },
              },
            });
            return projectedMemory;
          }

          const projectedMemoryFromCurrentDetail = memorySummaryWithVisibleDetail(
            memory,
            queryClient.getQueryData<MemoryDetailQueryData | undefined>(detailQueryKey),
            response.value.workspaceId,
            pendingSegmentIds
          );
          if (projectedMemoryFromCurrentDetail) {
            return projectedMemoryFromCurrentDetail;
          }

          return (
            workspaceSessionRef.current?.snapshot.memories.find(
              (candidate) => candidate.memoryId === memory.memoryId
            ) ??
            activeSession.snapshot.memories.find(
              (candidate) => candidate.memoryId === memory.memoryId
            ) ??
            memory
          );
        })
      );
      if (
        disposed ||
        requestId !== workspaceSnapshotRefreshRequestRef.current ||
        sessionRevision !== workspaceSessionRevisionRef.current
      ) {
        return;
      }
      for (const cacheUpdate of pendingDetailCacheUpdates) {
        queryClient.setQueryData<MemoryDetailQueryData | undefined>(
          cacheUpdate.queryKey,
          cacheUpdate.data
        );
      }
      const projectedSnapshot = {
        ...response.value,
        memories: projectedMemories,
      };

      if (sameWorkspaceSnapshot(activeSession.snapshot, projectedSnapshot)) {
        setWorkspaceEntryError(null);
        return;
      }

      const refreshedSession: WorkspaceSession = {
        ...activeSession,
        snapshot: projectedSnapshot,
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
          projectedSnapshot.memories.some((memory) => memory.memoryId === currentMemoryId)
        ) {
          return currentMemoryId;
        }

        return projectedSnapshot.memories[0]?.memoryId ?? null;
      });
      void queryClient.invalidateQueries({ queryKey: memorySpacesQueryKey() });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          workspaceHandleScopedContentQueryBelongsToWorkspace(
            query.queryKey,
            response.value.workspaceId
          ) &&
          !pendingSegmentDeleteProjections.some((projection) =>
            queryKeyMatchesPendingSegmentDelete(query.queryKey, projection)
          ),
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshWorkspaceFromFileTruth({ showError: true });
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    void refreshWorkspaceFromFileTruth({ showError: false });
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient, recordingTarget, setWorkspaceSession, workspaceSession]);

  const setThemePreference = useCallback((next: ThemePreference) => {
    setThemePreferenceState(next);
    writeThemePreference(next);
  }, []);

  function cyclePreference() {
    setThemePreference(cycleThemePreference(themePreference));
  }

  function setReadyWorkspaceSession(nextWorkspaceSession: WorkspaceSession) {
    queryClient.removeQueries({
      predicate: (query) =>
        workspaceHandleScopedContentQueryBelongsToWorkspace(
          query.queryKey,
          nextWorkspaceSession.workspaceId
        ),
    });
    seedWorkspaceSnapshot(queryClient, nextWorkspaceSession);
    setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
    setWorkspaceCreateOpen(false);
    setWorkspaceEntryError(null);
    clearWorkspaceScopedTargets();
    setSelectedMemoryId(nextWorkspaceSession.snapshot.memories[0]?.memoryId ?? null);
    setWorkspaceSession(nextWorkspaceSession);
    void queryClient.invalidateQueries({ queryKey: memorySpacesQueryKey() });
  }

  function clearWorkspaceScopedTargets() {
    setMemoryCreateIntent(null);
    setMemoryDeleteTarget(null);
    setMemoryRenameTarget(null);
    setMemorySpaceRemoveTarget(null);
    setMemorySpaceRenameTarget(null);
    setSegmentDeleteTarget(null);
    setSegmentRenameTarget(null);
    setSegmentSupplementDeleteTarget(null);
    setSegmentSupplementRenameTarget(null);
    setSegmentFocusIntent(null);
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

    setRecordingFlow({ status: 'closed' });
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

      setRecordingFlow({ status: 'closed' });
      clearWorkspaceScopedTargets();
      setSelectedMemoryId(null);
      queryClient.removeQueries({
        predicate: (query) =>
          workspaceHandleScopedContentQueryBelongsToWorkspace(
            query.queryKey,
            workspaceSession.workspaceId
          ),
      });
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

    const target = memorySpaceRenameTarget;
    const activeTarget =
      workspaceSession?.workspaceId === target.workspaceId ? workspaceSession : null;
    const previousTitle = target.title;
    const previousDescription = activeTarget?.snapshot.description ?? '';
    const optimisticDescription = previousDescription;

    setMemorySpaceRenameTarget(null);
    mergeMemorySpaceTitleIntoList(target.workspaceId, nextTitle, optimisticDescription);
    if (activeTarget) {
      const optimisticSnapshot = {
        ...activeTarget.snapshot,
        title: nextTitle,
        description: optimisticDescription,
      };
      seedWorkspaceSnapshot(queryClient, {
        ...activeTarget,
        snapshot: optimisticSnapshot,
      });
      setWorkspaceSession((currentSession) =>
        currentSession?.workspaceId === target.workspaceId
          ? { ...currentSession, snapshot: { ...currentSession.snapshot, title: nextTitle } }
          : currentSession
      );
    }

    void (async () => {
      const rollback = () => {
        queryClient.setQueryData<readonly WorkspaceMemorySpaceListItem[] | undefined>(
          memorySpacesQueryKey(),
          (currentMemorySpaces) =>
            currentMemorySpaces?.map((memorySpace) =>
              memorySpace.workspaceId === target.workspaceId && memorySpace.title === nextTitle
                ? { ...memorySpace, title: previousTitle, description: previousDescription }
                : memorySpace
            )
        );
        if (activeTarget) {
          queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
            workspaceSnapshotQueryKey(activeTarget),
            (currentSnapshot) =>
              currentSnapshot?.workspaceId === target.workspaceId &&
              currentSnapshot.title === nextTitle
                ? {
                    ...currentSnapshot,
                    title: previousTitle,
                    description: previousDescription,
                  }
                : currentSnapshot
          );
          setWorkspaceSession((currentSession) =>
            currentSession?.workspaceId === target.workspaceId &&
            currentSession.snapshot.title === nextTitle
              ? {
                  ...currentSession,
                  snapshot: {
                    ...currentSession.snapshot,
                    title: previousTitle,
                    description: previousDescription,
                  },
                }
              : currentSession
          );
        }
      };

      try {
        const response = await updateMemorySpaceTitle(
          activeTarget
            ? {
                workspaceHandle: activeTarget.workspaceHandle,
                title: nextTitle,
              }
            : {
                workspaceId: target.workspaceId,
                title: nextTitle,
              }
        );

        if (!response.ok) {
          if (response.error.dataRetention !== 'file-written-index-stale') {
            rollback();
          }
          toast.error('无法保存记忆空间名称', {
            description: workspaceErrorDisplayMessage(response.error, '无法重命名记忆空间。'),
          });
          return;
        }

        mergeMemorySpaceTitleIntoList(
          response.value.workspaceId,
          response.value.title,
          response.value.description
        );

        if (activeTarget) {
          queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
            workspaceSnapshotQueryKey(activeTarget),
            (currentSnapshot) =>
              currentSnapshot?.workspaceId === response.value.workspaceId &&
              currentSnapshot.title === nextTitle
                ? response.value
                : currentSnapshot
          );
          setWorkspaceSession((currentSession) =>
            currentSession?.workspaceId === response.value.workspaceId &&
            currentSession.snapshot.title === nextTitle
              ? { ...currentSession, snapshot: response.value }
              : currentSession
          );
        } else {
          void queryClient.invalidateQueries({ queryKey: memorySpacesQueryKey() });
        }
      } catch (error) {
        rollback();
        toast.error('无法保存记忆空间名称', {
          description: unknownErrorDisplayMessage(error, '无法重命名记忆空间。'),
        });
      }
    })();

    return null;
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
        setRecordingFlow({ status: 'closed' });
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
    themePreference,
    effectiveTheme,
    memorySpaces: visibleWorkspaceMemorySpaces,
    onCreateWorkspace: openWorkspaceCreateDialog,
    onHome: () => {
      void navigateHome();
    },
    onLibrary: () => {
      void navigateLibrary();
    },
    onCycleThemePreference: cyclePreference,
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
        <ReoToaster themeMode={effectiveTheme} />
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

  function handleSegmentSupplementFinalized(finalized: FinalizedSegmentSupplementRecording) {
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
                segments: sortSegmentsByUpdatedAt(
                  currentDetail.detail.segments.map((segment) =>
                    segment.segmentId === finalized.segment.segmentId ? finalized.segment : segment
                  )
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
      if (draft.targetKind === 'segment-supplement') {
        let finalizedSupplement = draft.finalizedSupplement ?? null;
        if (!finalizedSupplement) {
          if (!draft.parentSegmentId) {
            toast.error(RECORDING_RECOVERY_SAVE_ERROR, {
              description: '无法确认补充录音所属片段。',
            });
            return;
          }
          const response = await finalizeSegmentSupplementRecordingDraft({
            supplementId: draft.segmentId,
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
          finalizedSupplement = response.value;
          handleSegmentSupplementFinalized(finalizedSupplement);
          updateRecordingRecoverySnapshot({
            patch: { finalizedSupplement },
            segmentId: draft.segmentId,
            workspaceId: activeWorkspaceSession.workspaceId,
          });
          setRecordingRecoveryDraft({ ...draft, finalizedSupplement });
        } else {
          handleSegmentSupplementFinalized(finalizedSupplement);
        }
        const recoveredTranscript =
          draft.transcriptMarkdown ??
          transcriptMarkdownFromSegments(draft.transcriptSegments ?? []);
        let transcriptSaved = true;
        if (recoveredTranscript.length > 0) {
          try {
            const transcriptResponse = await saveSegmentSupplementTranscript({
              supplementId: finalizedSupplement.supplement.supplementId,
              markdown: recoveredTranscript,
              memoryId: finalizedSupplement.supplement.memoryId,
              segmentId: draft.parentSegmentId ?? finalizedSupplement.supplement.segmentId,
              workspaceHandle: activeWorkspaceSession.workspaceHandle,
              workspaceId: activeWorkspaceSession.workspaceId,
            });
            if (transcriptResponse.ok) {
              handleSegmentSupplementFinalized({
                supplement: transcriptResponse.value.supplement,
                memory: transcriptResponse.value.memory,
                segment: transcriptResponse.value.segment,
              });
            } else {
              transcriptSaved = false;
              toast.error('补充录音已保存，转写暂时无法写入。', {
                description: workspaceErrorDisplayMessage(
                  transcriptResponse.error,
                  '补充录音已保存，转写暂时无法写入。'
                ),
              });
            }
          } catch (transcriptError) {
            transcriptSaved = false;
            toast.error('补充录音已保存，转写暂时无法写入。', {
              description: unknownErrorDisplayMessage(
                transcriptError,
                '补充录音已保存，转写暂时无法写入。'
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
      if (draft.finalizedAudio || draft.finalizedSupplement) {
        clearRecordingRecoveryDraft({
          segmentId: draft.segmentId,
          workspaceId: activeWorkspaceSession.workspaceId,
        });
        setRecordingRecoveryDraft(null);
        toast.success('已关闭录音恢复提示');
        return;
      }

      const response =
        draft.targetKind === 'segment-supplement'
          ? await discardSegmentSupplementRecordingDraft({
              supplementId: draft.segmentId,
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
    setSegmentRenameTarget(null);
    setSegmentSupplementRenameTarget(null);
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
        setMemoryCreateIntent(null);
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
    const nextTitle = title.trim();
    if (nextTitle === memory.title.trim()) {
      return null;
    }

    const optimisticMemory = { ...memory, title: nextTitle };
    const snapshotQueryKey = workspaceSnapshotQueryKey(activeWorkspaceSession);
    setMemoryRenameTarget(null);
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) =>
        mergeMemoryIntoSnapshot(
          currentSnapshot ?? activeWorkspaceSession.snapshot,
          optimisticMemory
        )
    );
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceId === activeWorkspaceSession.workspaceId
        ? mergeMemoryIntoSession(currentSession, optimisticMemory)
        : currentSession
    );

    void (async () => {
      const rollback = () => {
        queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
          snapshotQueryKey,
          (currentSnapshot) =>
            mergeMemoryIntoSnapshotIfCurrentTitle(
              currentSnapshot,
              memory.memoryId,
              nextTitle,
              memory
            )
        );
        setWorkspaceSession((currentSession) =>
          mergeMemoryIntoSessionIfCurrentTitle(
            currentSession,
            activeWorkspaceSession.workspaceId,
            memory.memoryId,
            nextTitle,
            memory
          )
        );
      };

      try {
        const response = await updateMemoryTitle({
          workspaceHandle: activeWorkspaceSession.workspaceHandle,
          memoryId: memory.memoryId,
          title: nextTitle,
        });

        if (!response.ok) {
          rollback();
          toast.error('无法保存记忆名称', {
            description: workspaceErrorDisplayMessage(response.error, '无法重命名记忆。'),
          });
          return;
        }

        queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
          snapshotQueryKey,
          (currentSnapshot) =>
            mergeMemoryIntoSnapshotIfCurrentTitle(
              currentSnapshot,
              memory.memoryId,
              nextTitle,
              response.value
            )
        );
        setWorkspaceSession((currentSession) =>
          mergeMemoryIntoSessionIfCurrentTitle(
            currentSession,
            activeWorkspaceSession.workspaceId,
            memory.memoryId,
            nextTitle,
            response.value
          )
        );
      } catch (error) {
        rollback();
        toast.error('无法保存记忆名称', {
          description: unknownErrorDisplayMessage(error, '无法重命名记忆。'),
        });
      }
    })();

    return null;
  }

  async function saveRenamedSegment(target: SegmentRenameTarget, title: string) {
    const nextTitle = title.trim();
    if (nextTitle === target.segment.title.trim()) {
      return null;
    }

    const memory =
      activeWorkspaceSession.snapshot.memories.find(
        (candidate) => candidate.memoryId === target.memoryId
      ) ?? null;
    if (!memory) {
      return '无法确认片段所属记忆。';
    }

    const optimisticSegment = { ...target.segment, title: nextTitle };
    const detailQueryKey = memoryDetailQueryKey({
      workspaceId: activeWorkspaceSession.workspaceId,
      memoryId: target.memoryId,
    });
    setSegmentRenameTarget(null);
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(detailQueryKey, (currentDetail) =>
      mergeSegmentIntoMemoryDetailIfCurrentTitle(
        currentDetail,
        memory,
        optimisticSegment,
        activeWorkspaceSession.workspaceId,
        target.segment.title
      )
    );
    setSegmentFocusIntent({
      memoryId: target.memoryId,
      segmentId: target.segment.segmentId,
    });

    void (async () => {
      const rollback = () => {
        queryClient.setQueryData<MemoryDetailQueryData | undefined>(
          detailQueryKey,
          (currentDetail) =>
            mergeSegmentIntoMemoryDetailIfCurrentTitle(
              currentDetail,
              memory,
              target.segment,
              activeWorkspaceSession.workspaceId,
              nextTitle
            )
        );
      };

      try {
        const response = await updateSegmentTitle({
          workspaceHandle: activeWorkspaceSession.workspaceHandle,
          workspaceId: activeWorkspaceSession.workspaceId,
          memoryId: target.memoryId,
          segmentId: target.segment.segmentId,
          title: nextTitle,
        });

        if (!response.ok) {
          rollback();
          toast.error('无法保存片段名称', {
            description: workspaceErrorDisplayMessage(response.error, '无法重命名片段。'),
          });
          return;
        }

        const snapshotQueryKey = workspaceSnapshotQueryKey(activeWorkspaceSession);
        queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
          snapshotQueryKey,
          (currentSnapshot) =>
            mergeMemoryIntoSnapshot(
              currentSnapshot ?? activeWorkspaceSession.snapshot,
              response.value.memory
            )
        );
        queryClient.setQueryData<MemoryDetailQueryData | undefined>(
          detailQueryKey,
          (currentDetail) =>
            mergeSegmentIntoMemoryDetailIfCurrentTitle(
              currentDetail,
              response.value.memory,
              response.value.segment,
              activeWorkspaceSession.workspaceId,
              nextTitle
            )
        );
        setWorkspaceSession((currentSession) =>
          currentSession?.workspaceId === activeWorkspaceSession.workspaceId
            ? mergeMemoryIntoSession(currentSession, response.value.memory)
            : currentSession
        );
        setSegmentFocusIntent({
          memoryId: response.value.segment.memoryId,
          segmentId: response.value.segment.segmentId,
        });
      } catch (error) {
        rollback();
        toast.error('无法保存片段名称', {
          description: unknownErrorDisplayMessage(error, '无法重命名片段。'),
        });
      }
    })();

    return null;
  }

  async function saveRenamedSegmentSupplement(
    target: SegmentSupplementRenameTarget,
    title: string
  ) {
    const nextTitle = title.trim();
    if (nextTitle === target.supplement.title.trim()) {
      return null;
    }

    const mutationSession = activeWorkspaceSession;
    const mutationSessionIsActive = () =>
      workspaceSessionRef.current?.workspaceHandle === mutationSession.workspaceHandle &&
      workspaceSessionRef.current.workspaceId === mutationSession.workspaceId;
    const memory =
      mutationSession.snapshot.memories.find(
        (candidate) => candidate.memoryId === target.memoryId
      ) ?? null;
    if (!memory) {
      return '无法确认补充内容所属记忆。';
    }

    const optimisticSupplement = { ...target.supplement, title: nextTitle };
    const detailQueryKey = memoryDetailQueryKey({
      workspaceId: mutationSession.workspaceId,
      memoryId: target.memoryId,
    });
    setSegmentSupplementRenameTarget(null);
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(detailQueryKey, (currentDetail) =>
      mergeSegmentSupplementIntoMemoryDetailIfCurrentTitle(
        currentDetail,
        memory,
        target.segment,
        optimisticSupplement,
        mutationSession.workspaceId,
        target.supplement.title
      )
    );
    setSegmentFocusIntent({
      memoryId: target.memoryId,
      segmentId: target.segment.segmentId,
    });

    void (async () => {
      const rollback = () => {
        queryClient.setQueryData<MemoryDetailQueryData | undefined>(
          detailQueryKey,
          (currentDetail) =>
            mergeSegmentSupplementIntoMemoryDetailIfCurrentTitle(
              currentDetail,
              memory,
              target.segment,
              target.supplement,
              mutationSession.workspaceId,
              nextTitle
            )
        );
      };

      try {
        const response = await updateSegmentSupplementTitle({
          workspaceHandle: mutationSession.workspaceHandle,
          workspaceId: mutationSession.workspaceId,
          memoryId: target.memoryId,
          segmentId: target.segment.segmentId,
          supplementId: target.supplement.supplementId,
          title: nextTitle,
        });

        if (!mutationSessionIsActive()) {
          return;
        }

        if (!response.ok) {
          if (response.error.dataRetention !== 'file-written-index-stale') {
            rollback();
          }
          toast.error('无法保存补充内容名称', {
            description: workspaceErrorDisplayMessage(response.error, '无法重命名补充内容。'),
          });
          return;
        }

        const snapshotQueryKey = workspaceSnapshotQueryKey(mutationSession);
        queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
          snapshotQueryKey,
          (currentSnapshot) =>
            mergeMemoryIntoSnapshot(
              currentSnapshot ?? mutationSession.snapshot,
              response.value.memory
            )
        );
        queryClient.setQueryData<MemoryDetailQueryData | undefined>(
          detailQueryKey,
          (currentDetail) =>
            mergeSegmentSupplementIntoMemoryDetailIfCurrentTitle(
              currentDetail,
              response.value.memory,
              response.value.segment,
              response.value.supplement,
              mutationSession.workspaceId,
              nextTitle
            )
        );
        setWorkspaceSession((currentSession) =>
          currentSession?.workspaceHandle === mutationSession.workspaceHandle &&
          currentSession.workspaceId === mutationSession.workspaceId
            ? mergeMemoryIntoSession(currentSession, response.value.memory)
            : currentSession
        );
        setSegmentFocusIntent({
          memoryId: response.value.segment.memoryId,
          segmentId: response.value.segment.segmentId,
        });
      } catch (error) {
        if (!mutationSessionIsActive()) {
          return;
        }

        rollback();
        toast.error('无法保存补充内容名称', {
          description: unknownErrorDisplayMessage(error, '无法重命名补充内容。'),
        });
      }
    })();

    return null;
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
    setSegmentDeleteTarget(null);
    setSegmentRenameTarget(null);
    setSegmentSupplementDeleteTarget(null);
    setSegmentSupplementRenameTarget(null);
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

  function openSegmentDeleteDialog(target: SegmentDeleteTarget) {
    if (blockRecordingFlowInterruption()) {
      return;
    }

    setWorkspaceEntryError(null);
    setWorkspaceCreateOpen(false);
    setMemoryCreateIntent(null);
    setMemoryDeleteTarget(null);
    setMemoryRenameTarget(null);
    setSegmentRenameTarget(null);
    setSegmentSupplementDeleteTarget(null);
    setSegmentSupplementRenameTarget(null);
    setMemorySpaceRemoveTarget(null);
    setSegmentDeleteTarget(target);
  }

  function handleSegmentDeleteOpenChange(nextOpen: boolean) {
    if (!nextOpen && workspaceActionPending) {
      return;
    }

    if (!nextOpen) {
      setSegmentDeleteTarget(null);
    }
  }

  function openSegmentSupplementDeleteDialog(target: SegmentSupplementDeleteTarget) {
    if (blockRecordingFlowInterruption()) {
      return;
    }

    setWorkspaceEntryError(null);
    setWorkspaceCreateOpen(false);
    setMemoryCreateIntent(null);
    setMemoryDeleteTarget(null);
    setMemoryRenameTarget(null);
    setSegmentDeleteTarget(null);
    setSegmentRenameTarget(null);
    setSegmentSupplementRenameTarget(null);
    setMemorySpaceRemoveTarget(null);
    setSegmentSupplementDeleteTarget(target);
  }

  function handleSegmentSupplementDeleteOpenChange(nextOpen: boolean) {
    if (!nextOpen && workspaceActionPending) {
      return;
    }

    if (!nextOpen) {
      setSegmentSupplementDeleteTarget(null);
    }
  }

  function projectRestoredSegmentSupplement(context: SegmentSupplementRestoreContext) {
    const currentSession = workspaceSessionRef.current;
    if (
      currentSession?.workspaceHandle !== context.workspaceHandle ||
      currentSession.workspaceId !== context.workspaceId
    ) {
      return;
    }

    const snapshotQueryKey = workspaceSnapshotQueryKey({
      workspaceHandle: context.workspaceHandle,
      workspaceId: context.workspaceId,
    });
    const detailQueryKey = memoryDetailQueryKey({
      workspaceId: context.workspaceId,
      memoryId: context.memoryId,
    });
    const currentSnapshot =
      queryClient.getQueryData<WorkspaceSession['snapshot']>(snapshotQueryKey) ??
      currentSession.snapshot;
    const currentMemory = currentSnapshot.memories.find(
      (memory) => memory.memoryId === context.memoryId
    );

    if (!currentMemory) {
      return;
    }

    const currentDetail = queryClient.getQueryData<MemoryDetailQueryData | undefined>(
      detailQueryKey
    );
    const detailSegment = currentDetail?.detail.segments.find(
      (segment) => segment.segmentId === context.segmentId
    );
    const nextSegment = segmentWithSupplementRestored(
      detailSegment ??
        segmentWithSupplementRemoved(context.segment, context.supplement.supplementId),
      context.supplement
    );
    const visibleSegments =
      currentDetail &&
      currentDetail.detail.workspaceId === context.workspaceId &&
      currentDetail.detail.memoryId === context.memoryId
        ? currentDetail.detail.segments.map((segment) =>
            segment.segmentId === nextSegment.segmentId ? nextSegment : segment
          )
        : null;
    const projectedMemory = visibleSegments
      ? memorySummaryWithVisibleSegments(currentMemory, visibleSegments)
      : {
          ...currentMemory,
          supplementCount: currentMemory.supplementCount + 1,
        };

    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (current) => mergeMemoryIntoSnapshot(current ?? currentSnapshot, projectedMemory)
    );
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(detailQueryKey, (current) =>
      mergeSegmentIntoMemoryDetail(current, projectedMemory, nextSegment, context.workspaceId)
    );
    setWorkspaceSession((session) =>
      session?.workspaceHandle === context.workspaceHandle &&
      session.workspaceId === context.workspaceId
        ? mergeMemoryIntoSession(session, projectedMemory)
        : session
    );
    setSelectedMemoryId(context.memoryId);
    setSegmentFocusIntent({
      memoryId: context.memoryId,
      segmentId: context.segmentId,
    });
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
      showReoUndoToast({
        description: target.title,
        onUndo: () => {
          void restoreDeletedMemoryFromUndo(response.value.restoreToken);
        },
        title: '已删除记忆',
      });
    } catch (error) {
      toast.error(MEMORY_DELETE_ERROR, {
        description: unknownErrorDisplayMessage(error, MEMORY_DELETE_ERROR),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  async function restoreDeletedSegmentSupplementFromUndo(context: SegmentSupplementRestoreContext) {
    if (!beginWorkspaceAction()) {
      return;
    }

    const restoreSessionIsActive = () =>
      workspaceSessionRef.current?.workspaceHandle === context.workspaceHandle &&
      workspaceSessionRef.current.workspaceId === context.workspaceId;

    try {
      const response = await restoreDeletedSegmentSupplement({
        workspaceHandle: context.workspaceHandle,
        workspaceId: context.workspaceId,
        memoryId: context.memoryId,
        segmentId: context.segmentId,
        restoreToken: context.restoreToken,
      });

      if (!restoreSessionIsActive()) {
        return;
      }

      if (!response.ok) {
        if (response.error.dataRetention === 'file-written-index-stale') {
          projectRestoredSegmentSupplement(context);
        }
        toast.error(SEGMENT_SUPPLEMENT_RESTORE_ERROR, {
          description: workspaceErrorDisplayMessage(
            response.error,
            SEGMENT_SUPPLEMENT_RESTORE_ERROR
          ),
        });
        return;
      }

      const snapshotQueryKey = workspaceSnapshotQueryKey({
        workspaceId: context.workspaceId,
        workspaceHandle: context.workspaceHandle,
      });
      const detailQueryKey = memoryDetailQueryKey({
        workspaceId: context.workspaceId,
        memoryId: context.memoryId,
      });
      queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
        snapshotQueryKey,
        (currentSnapshot) =>
          mergeMemoryIntoSnapshot(
            currentSnapshot ?? activeWorkspaceSession.snapshot,
            response.value.memory
          )
      );
      queryClient.setQueryData<MemoryDetailQueryData | undefined>(detailQueryKey, (currentDetail) =>
        mergeSegmentIntoMemoryDetail(
          currentDetail,
          response.value.memory,
          response.value.segment,
          context.workspaceId
        )
      );
      setWorkspaceSession((currentSession) =>
        currentSession?.workspaceHandle === context.workspaceHandle &&
        currentSession.workspaceId === context.workspaceId
          ? mergeMemoryIntoSession(currentSession, response.value.memory)
          : currentSession
      );
      setSelectedMemoryId(context.memoryId);
      setSegmentFocusIntent({
        memoryId: context.memoryId,
        segmentId: context.segmentId,
      });
      toast.success('已恢复补充内容');
    } catch (error) {
      if (!restoreSessionIsActive()) {
        return;
      }

      toast.error(SEGMENT_SUPPLEMENT_RESTORE_ERROR, {
        description: unknownErrorDisplayMessage(error, SEGMENT_SUPPLEMENT_RESTORE_ERROR),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  async function confirmDeleteSegmentSupplement() {
    if (blockRecordingFlowInterruption()) {
      return;
    }

    const target = segmentSupplementDeleteTarget;
    if (!target || !beginWorkspaceAction()) {
      return;
    }

    const session = activeWorkspaceSession;
    const deleteSessionIsActive = () =>
      workspaceSessionRef.current?.workspaceHandle === session.workspaceHandle &&
      workspaceSessionRef.current.workspaceId === session.workspaceId;
    const detailQueryKey = memoryDetailQueryKey({
      workspaceId: session.workspaceId,
      memoryId: target.memoryId,
    });
    const supplementContentKey = segmentSupplementContentQueryKey({
      workspaceId: session.workspaceId,
      memoryId: target.memoryId,
      segmentId: target.segment.segmentId,
      supplementId: target.supplement.supplementId,
    });
    const showDeletedSegmentSupplementToast = (restoreToken: string) => {
      showReoUndoToast({
        description: target.supplement.title,
        onUndo: () => {
          void restoreDeletedSegmentSupplementFromUndo({
            supplement: target.supplement,
            memoryId: target.memoryId,
            restoreToken,
            segment: target.segment,
            segmentId: target.segment.segmentId,
            workspaceHandle: session.workspaceHandle,
            workspaceId: session.workspaceId,
          });
        },
        title: '已删除补充内容',
      });
    };
    const projectDeletedSegmentSupplement = () => {
      const snapshotQueryKey = workspaceSnapshotQueryKey(session);
      const currentSnapshot =
        queryClient.getQueryData<WorkspaceSession['snapshot']>(snapshotQueryKey) ??
        session.snapshot;
      const currentMemory = currentSnapshot.memories.find(
        (memory) => memory.memoryId === target.memoryId
      );

      if (!currentMemory) {
        queryClient.removeQueries({ exact: true, queryKey: supplementContentKey });
        setSegmentSupplementDeleteTarget(null);
        return;
      }

      const currentDetail = queryClient.getQueryData<MemoryDetailQueryData | undefined>(
        detailQueryKey
      );
      const detailSegment = currentDetail?.detail.segments.find(
        (segment) => segment.segmentId === target.segment.segmentId
      );
      const nextSegment = segmentWithSupplementRemoved(
        detailSegment ?? target.segment,
        target.supplement.supplementId
      );
      const visibleSegments =
        currentDetail &&
        currentDetail.detail.workspaceId === session.workspaceId &&
        currentDetail.detail.memoryId === target.memoryId
          ? currentDetail.detail.segments.map((segment) =>
              segment.segmentId === nextSegment.segmentId ? nextSegment : segment
            )
          : null;
      const projectedMemory = visibleSegments
        ? memorySummaryWithVisibleSegments(currentMemory, visibleSegments)
        : {
            ...currentMemory,
            supplementCount: Math.max(0, currentMemory.supplementCount - 1),
          };

      queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
        snapshotQueryKey,
        (current) => mergeMemoryIntoSnapshot(current ?? currentSnapshot, projectedMemory)
      );
      queryClient.setQueryData<MemoryDetailQueryData | undefined>(detailQueryKey, (current) =>
        mergeSegmentIntoMemoryDetail(current, projectedMemory, nextSegment, session.workspaceId)
      );
      queryClient.removeQueries({ exact: true, queryKey: supplementContentKey });
      setWorkspaceSession((currentSession) =>
        currentSession?.workspaceHandle === session.workspaceHandle &&
        currentSession.workspaceId === session.workspaceId
          ? mergeMemoryIntoSession(currentSession, projectedMemory)
          : currentSession
      );
      setSegmentSupplementDeleteTarget(null);
      setSegmentFocusIntent({
        memoryId: target.memoryId,
        segmentId: target.segment.segmentId,
      });
    };

    try {
      const response = await deleteSegmentSupplement({
        workspaceHandle: session.workspaceHandle,
        workspaceId: session.workspaceId,
        memoryId: target.memoryId,
        segmentId: target.segment.segmentId,
        supplementId: target.supplement.supplementId,
      });

      if (!deleteSessionIsActive()) {
        return;
      }

      if (!response.ok) {
        if (response.error.dataRetention === 'file-written-index-stale') {
          projectDeletedSegmentSupplement();
          showDeletedSegmentSupplementToast(target.supplement.supplementId);
        }
        toast.error(SEGMENT_SUPPLEMENT_DELETE_ERROR, {
          description: workspaceErrorDisplayMessage(
            response.error,
            SEGMENT_SUPPLEMENT_DELETE_ERROR
          ),
        });
        return;
      }

      const snapshotQueryKey = workspaceSnapshotQueryKey(session);
      queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
        snapshotQueryKey,
        (currentSnapshot) =>
          mergeMemoryIntoSnapshot(currentSnapshot ?? session.snapshot, response.value.memory)
      );
      queryClient.setQueryData<MemoryDetailQueryData | undefined>(detailQueryKey, (currentDetail) =>
        mergeSegmentIntoMemoryDetail(
          currentDetail,
          response.value.memory,
          response.value.segment,
          session.workspaceId
        )
      );
      queryClient.removeQueries({ exact: true, queryKey: supplementContentKey });
      setWorkspaceSession((currentSession) =>
        currentSession?.workspaceHandle === session.workspaceHandle &&
        currentSession.workspaceId === session.workspaceId
          ? mergeMemoryIntoSession(currentSession, response.value.memory)
          : currentSession
      );
      setSegmentSupplementDeleteTarget(null);
      setSegmentFocusIntent({
        memoryId: target.memoryId,
        segmentId: target.segment.segmentId,
      });
      showDeletedSegmentSupplementToast(response.value.restoreToken);
    } catch (error) {
      if (!deleteSessionIsActive()) {
        return;
      }

      toast.error(SEGMENT_SUPPLEMENT_DELETE_ERROR, {
        description: unknownErrorDisplayMessage(error, SEGMENT_SUPPLEMENT_DELETE_ERROR),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  function confirmDeleteSegment() {
    if (blockRecordingFlowInterruption()) {
      return;
    }

    const target = segmentDeleteTarget;
    if (!target || workspaceActionPending) {
      return;
    }

    const session = activeWorkspaceSession;
    const snapshotQueryKey = workspaceSnapshotQueryKey(session);
    const memoryDetailKey = memoryDetailQueryKey({
      workspaceId: session.workspaceId,
      memoryId: target.memoryId,
    });
    const previousSnapshot =
      queryClient.getQueryData<WorkspaceSession['snapshot']>(snapshotQueryKey) ?? session.snapshot;
    const previousDetail = queryClient.getQueryData<MemoryDetailQueryData | undefined>(
      memoryDetailKey
    );
    const memoryBeforeDelete = previousSnapshot.memories.find(
      (memory) => memory.memoryId === target.memoryId
    );

    if (!memoryBeforeDelete) {
      setSegmentDeleteTarget(null);
      toast.error(SEGMENT_DELETE_ERROR);
      return;
    }

    const remainingSegments = previousDetail?.detail.segments.filter(
      (segment) => segment.segmentId !== target.segment.segmentId
    );
    const optimisticMemory = memorySummaryAfterSegmentRemoval({
      memory: memoryBeforeDelete,
      removedSegment: target.segment,
      ...(remainingSegments ? { remainingSegments } : {}),
    });
    const pendingProjectionKey = pendingSegmentDeleteKey({
      workspaceId: session.workspaceId,
      workspaceHandle: session.workspaceHandle,
      memoryId: target.memoryId,
      segmentId: target.segment.segmentId,
    });
    const clearPendingSegmentDeleteProjection = () => {
      pendingSegmentDeleteProjectionsRef.current.delete(pendingProjectionKey);
    };
    const segmentDeleteSessionIsActive = () =>
      workspaceSessionRef.current?.workspaceHandle === session.workspaceHandle &&
      workspaceSessionRef.current.workspaceId === session.workspaceId;
    const removeDeletedSegmentContentCaches = () => {
      queryClient.removeQueries({
        exact: true,
        queryKey: segmentContentQueryKey({
          workspaceId: session.workspaceId,
          memoryId: target.memoryId,
          segmentId: target.segment.segmentId,
        }),
      });
      queryClient.removeQueries({
        queryKey: segmentSupplementContentQueryPrefix({
          workspaceId: session.workspaceId,
          memoryId: target.memoryId,
          segmentId: target.segment.segmentId,
        }),
      });
    };
    const memoryWithRemainingPendingDeletes = (memory: WorkspaceMemorySummary) =>
      [...pendingSegmentDeleteProjectionsRef.current.values()]
        .filter((projection) => pendingSegmentDeleteBelongsToSession(projection, session))
        .reduce(
          (currentMemory, projection) =>
            memorySummaryWithPendingSegmentDelete(currentMemory, projection),
          memory
        );

    const rollbackSegmentDelete = () => {
      const currentDetailBeforeRollback = queryClient.getQueryData<
        MemoryDetailQueryData | undefined
      >(memoryDetailKey);
      const segmentAlreadyProjected =
        currentDetailBeforeRollback?.detail.segments.some(
          (segment) => segment.segmentId === target.segment.segmentId
        ) ?? false;

      const restoreMemorySummary = (memory: WorkspaceMemorySummary) =>
        segmentAlreadyProjected
          ? memory
          : memorySummaryAfterSegmentRestore({
              memory,
              restoredSegment: target.segment,
            });

      const restoreSnapshotMemory = (
        snapshot: WorkspaceSession['snapshot']
      ): {
        readonly memory: WorkspaceMemorySummary | null;
        readonly snapshot: WorkspaceSession['snapshot'];
      } => {
        const currentMemory = snapshot.memories.find(
          (memory) => memory.memoryId === target.memoryId
        );
        if (!currentMemory) {
          return { memory: null, snapshot };
        }

        const restoredMemory = restoreMemorySummary(currentMemory);
        return {
          memory: restoredMemory,
          snapshot: mergeMemoryIntoSnapshot(snapshot, restoredMemory),
        };
      };

      const snapshotBeforeRollback =
        queryClient.getQueryData<WorkspaceSession['snapshot'] | undefined>(snapshotQueryKey) ??
        previousSnapshot;
      const { memory: restoredMemoryForDetail } = restoreSnapshotMemory(snapshotBeforeRollback);
      queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
        snapshotQueryKey,
        (currentSnapshot) => restoreSnapshotMemory(currentSnapshot ?? previousSnapshot).snapshot
      );
      if (restoredMemoryForDetail && (previousDetail || currentDetailBeforeRollback)) {
        queryClient.setQueryData<MemoryDetailQueryData | undefined>(
          memoryDetailKey,
          (currentDetail) => {
            const sourceDetail = currentDetail ?? previousDetail;
            if (!sourceDetail) {
              return currentDetail;
            }

            return mergeSegmentIntoMemoryDetail(
              sourceDetail,
              restoredMemoryForDetail,
              target.segment,
              session.workspaceId
            );
          }
        );
      }
      setWorkspaceSession((currentSession) =>
        currentSession?.workspaceHandle === session.workspaceHandle &&
        currentSession.workspaceId === session.workspaceId
          ? { ...currentSession, snapshot: restoreSnapshotMemory(currentSession.snapshot).snapshot }
          : currentSession
      );
      if (restoredMemoryForDetail) {
        setSelectedMemoryId(target.memoryId);
        setSegmentFocusIntent({
          memoryId: target.memoryId,
          segmentId: target.segment.segmentId,
        });
      }
    };

    const commitSegmentDelete = async () => {
      try {
        const response = await deleteSegment({
          workspaceHandle: session.workspaceHandle,
          workspaceId: session.workspaceId,
          memoryId: target.memoryId,
          segmentId: target.segment.segmentId,
        });

        clearPendingSegmentDeleteProjection();
        if (!segmentDeleteSessionIsActive()) {
          return;
        }

        if (!response.ok) {
          if (response.error.dataRetention === 'file-written-index-stale') {
            removeDeletedSegmentContentCaches();
          } else {
            rollbackSegmentDelete();
          }
          toast.error(SEGMENT_DELETE_ERROR, {
            description: workspaceErrorDisplayMessage(response.error, SEGMENT_DELETE_ERROR),
          });
          return;
        }

        const remainingPendingSegmentIds = new Set(
          [...pendingSegmentDeleteProjectionsRef.current.values()]
            .filter((projection) => pendingSegmentDeleteBelongsToSession(projection, session))
            .map((projection) => projection.segmentId)
        );
        const committedMemory =
          memorySummaryWithVisibleDetail(
            response.value.memory,
            queryClient.getQueryData<MemoryDetailQueryData | undefined>(memoryDetailKey),
            session.workspaceId,
            remainingPendingSegmentIds
          ) ??
          memorySummaryWithDetailTranscriptWhenAdditiveFieldsMatch(
            memoryWithRemainingPendingDeletes(response.value.memory),
            queryClient.getQueryData<MemoryDetailQueryData | undefined>(memoryDetailKey),
            session.workspaceId
          );
        queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
          snapshotQueryKey,
          (currentSnapshot) =>
            mergeMemoryIntoSnapshot(currentSnapshot ?? previousSnapshot, committedMemory)
        );
        queryClient.setQueryData<MemoryDetailQueryData | undefined>(
          memoryDetailKey,
          (currentDetail) =>
            removeSegmentFromMemoryDetail(
              currentDetail,
              committedMemory,
              session.workspaceId,
              target.segment.segmentId
            )
        );
        removeDeletedSegmentContentCaches();
        setWorkspaceSession((currentSession) =>
          currentSession?.workspaceHandle === session.workspaceHandle &&
          currentSession.workspaceId === session.workspaceId
            ? mergeMemoryIntoSession(currentSession, committedMemory)
            : currentSession
        );
      } catch (error) {
        clearPendingSegmentDeleteProjection();
        if (!segmentDeleteSessionIsActive()) {
          return;
        }
        rollbackSegmentDelete();
        toast.error(SEGMENT_DELETE_ERROR, {
          description: unknownErrorDisplayMessage(error, SEGMENT_DELETE_ERROR),
        });
      }
    };

    pendingSegmentDeleteProjectionsRef.current.set(pendingProjectionKey, {
      memoryBeforeDelete,
      memoryId: target.memoryId,
      optimisticMemory,
      segment: target.segment,
      segmentId: target.segment.segmentId,
      workspaceHandle: session.workspaceHandle,
      workspaceId: session.workspaceId,
    });
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) =>
        mergeMemoryIntoSnapshot(currentSnapshot ?? previousSnapshot, optimisticMemory)
    );
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(memoryDetailKey, (currentDetail) =>
      removeSegmentFromMemoryDetail(
        currentDetail,
        optimisticMemory,
        session.workspaceId,
        target.segment.segmentId
      )
    );
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceHandle === session.workspaceHandle &&
      currentSession.workspaceId === session.workspaceId
        ? mergeMemoryIntoSession(currentSession, optimisticMemory)
        : currentSession
    );
    setSegmentDeleteTarget(null);

    let toastPhase: SegmentDeleteToastPhase = 'pending';
    showReoUndoToast({
      description: target.segment.title,
      durationMs: SEGMENT_DELETE_UNDO_DURATION_MS,
      onAutoClose: () => {
        if (toastPhase !== 'pending') {
          return;
        }
        toastPhase = 'committing';
        if (!segmentDeleteSessionIsActive()) {
          toastPhase = 'settled';
          clearPendingSegmentDeleteProjection();
          return;
        }
        void commitSegmentDelete();
      },
      onUndo: () => {
        if (toastPhase !== 'pending') {
          return;
        }
        toastPhase = 'undone';
        if (!segmentDeleteSessionIsActive()) {
          clearPendingSegmentDeleteProjection();
          return;
        }
        clearPendingSegmentDeleteProjection();
        rollbackSegmentDelete();
      },
      title: '已删除片段',
    });
  }

  function openRecording(
    target: RecordingTarget,
    recoveredDraft: RecordingRecoveryDraft | null = null
  ) {
    setRecordingFlow({
      closeBlocked: false,
      open: true,
      recoveredDraft,
      status: 'active',
      target,
    });
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
    if (draft.targetKind === 'segment-supplement') {
      void saveRecoveredRecording();
      return;
    }

    setSelectedMemoryId(draft.memoryId);
    setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
    setRecordingRecoveryDraft(null);
    openRecording({ kind: 'existing-memory', memoryId: draft.memoryId, title: draft.title }, draft);
  }

  function requestStartRecording() {
    if (blockRecordingFlowInterruption()) {
      return;
    }

    if (currentMemoryId) {
      openRecording({ kind: 'existing-memory', memoryId: currentMemoryId });
      return;
    }

    openMemoryCreateDialog({ afterCreate: 'record-memory' });
  }

  function requestStartSegmentSupplementRecording(target: {
    readonly memoryId: string;
    readonly segmentId: string;
    readonly title: string;
  }) {
    if (blockRecordingFlowInterruption()) {
      return;
    }

    setSelectedMemoryId(target.memoryId);
    openRecording({
      kind: 'segment-supplement',
      memoryId: target.memoryId,
      segmentId: target.segmentId,
      title: target.title,
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
    setRecordingFlow((currentFlow) =>
      currentFlow.status === 'active' ? { ...currentFlow, open: nextOpen } : currentFlow
    );
  }

  function handleRecordingFlowSettled() {
    setRecordingFlow({ status: 'closed' });
  }

  return (
    <>
      <ReoToaster themeMode={effectiveTheme} />
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
            onDeleteSegment={openSegmentDeleteDialog}
            onDeleteSegmentSupplement={openSegmentSupplementDeleteDialog}
            onSegmentFocusConsumed={(segmentId) => {
              setSegmentFocusIntent((currentIntent) =>
                currentIntent?.segmentId === segmentId ? null : currentIntent
              );
            }}
            onSelectMemory={selectMemory}
            onRenameMemory={setMemoryRenameTarget}
            onRenameSegment={setSegmentRenameTarget}
            onRenameSegmentSupplement={setSegmentSupplementRenameTarget}
            onStartSegmentSupplementRecording={requestStartSegmentSupplementRecording}
            onStartRecording={requestStartRecording}
          />
        )}
      </AppShell>
      {recordingTarget ? (
        <RecordingOverlay
          onCloseBlockedChange={handleRecordingCloseBlockedChange}
          onRecordingContentSaved={handleRecordingContentSaved}
          onOpenChange={handleRecordingOpenChange}
          onAudioSegmentFinalized={handleAudioSegmentFinalized}
          onRecordingFlowSettled={handleRecordingFlowSettled}
          onSegmentSupplementFinalized={handleSegmentSupplementFinalized}
          open={recordingOverlayOpen}
          recoveredDraft={recordingRecoveryReviewDraft}
          recordingTarget={recordingTarget}
          workspaceSession={activeWorkspaceSession}
        />
      ) : null}
      <RecordingRecoveryDialog
        canReview={recordingRecoveryDraft?.targetKind !== 'segment-supplement'}
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
      <SegmentRenameDialog
        target={segmentRenameTarget}
        onOpenChange={(open) => {
          if (!open) {
            setSegmentRenameTarget(null);
          }
        }}
        onSave={saveRenamedSegment}
        open={segmentRenameTarget !== null}
      />
      <SegmentSupplementRenameDialog
        target={segmentSupplementRenameTarget}
        onOpenChange={(open) => {
          if (!open) {
            setSegmentSupplementRenameTarget(null);
          }
        }}
        onSave={saveRenamedSegmentSupplement}
        open={segmentSupplementRenameTarget !== null}
      />
      <SegmentSupplementDeleteDialog
        disabled={workspaceActionPending}
        target={segmentSupplementDeleteTarget}
        onConfirm={() => {
          void confirmDeleteSegmentSupplement();
        }}
        onOpenChange={handleSegmentSupplementDeleteOpenChange}
        open={segmentSupplementDeleteTarget !== null}
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
      <SegmentDeleteDialog
        disabled={workspaceActionPending}
        target={segmentDeleteTarget}
        onConfirm={() => {
          void confirmDeleteSegment();
        }}
        onOpenChange={handleSegmentDeleteOpenChange}
        open={segmentDeleteTarget !== null}
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

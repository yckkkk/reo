import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  mergeMemoryIntoSession,
  mergeMemoryIntoSessionIfCurrentTitle,
  mergeMemoryIntoSnapshot,
  mergeMemoryIntoSnapshotIfCurrentTitle,
  upsertByProjectedUpdatedAt,
} from './appProjection';
import { ReoToaster, showReoUndoToast, toast } from './components/ui/toaster';
import {
  devWorkspaceScenarioMemorySpaceId,
  readAutoOpenDevWorkspaceScenarioName,
} from './devWorkspaceScenario';
import { SettingsShell } from './settings/SettingsShell';
import { VoiceSettingsPanel } from './settings/VoiceSettingsPanel';
import { voiceSettingsQueryOptions } from './settings/voiceSettingsQueries';
import { LoadedWorkspaceFrame } from './workspace/LoadedWorkspaceFrame';
import type {
  SavedSegmentSupplementTranscriptContent,
  SegmentSupplementTranscriptionRetryTarget,
  SegmentTranscriptionRetryTarget,
  TranscriptionBackfillMode,
} from './workspace/MemoryStudio';
import { MemoryCreateDialog } from './workspace/MemoryCreateDialog';
import { MemoryDeleteDialog } from './workspace/MemoryDeleteDialog';
import { MemoryRenameDialog } from './workspace/MemoryRenameDialog';
import { MemoryTitleDialog } from './workspace/MemoryTitleDialog';
import { SegmentDeleteDialog } from './workspace/SegmentDeleteDialog';
import { SegmentContentRenameDialog } from './workspace/SegmentContentRenameDialog';
import { SegmentSupplementDeleteDialog } from './workspace/SegmentSupplementDeleteDialog';
import { SegmentSupplementRenameDialog } from './workspace/SegmentSupplementRenameDialog';
import { SegmentRenameDialog } from './workspace/SegmentRenameDialog';
import type {
  SegmentSupplementDeleteTarget,
  SegmentSupplementRenameTarget,
  SegmentContentClearTarget,
  SegmentContentRenameTarget,
  SegmentDeleteTarget,
  SegmentRenameTarget,
} from './workspace/segmentActionTargets';
import {
  RecordingOverlay,
  type RecordingTarget,
  type SavedRecordingContent,
} from './workspace/RecordingOverlay';
import { NoteEditorOverlay } from './workspace/NoteEditorOverlay';
import {
  saveFinalizedNoteSegmentContent,
  type SavedNoteSegmentContent,
  type SavedNoteSegmentSupplementContent,
} from './workspace/finalizedNoteContentSave';
import type { NoteEditorTarget } from './workspace/noteEditorModel';
import { RecordingRecoveryDialog } from './workspace/RecordingRecoveryDialog';
import { WorkspaceCreateDialog } from './workspace/WorkspaceCreateDialog';
import { WorkspaceDangerConfirmDialog } from './workspace/WorkspaceDangerConfirmDialog';
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
  readWorkspaceSnapshot,
  removeMemorySpace,
  requestSegmentSupplementTranscriptionBackfill,
  requestSegmentTranscriptionBackfill,
  restoreDeletedMemory,
  restoreDeletedSegmentSupplement,
  saveSegmentSupplementTranscript,
  saveTranscript,
  updateMemorySpaceTitle,
  updateMemoryTitle,
  updateSegmentContentTitle,
  updateSegmentSupplementTitle,
  updateSegmentTitle,
  type FinalizedAudioSegment,
  type FinalizedNoteSegment,
  type FinalizedSegmentSupplementRecording,
  type FinalizedSegmentSupplementNote,
  type WorkspaceMemoryDetail,
  type WorkspaceMemorySummary,
  type WorkspaceNoteSegmentContent,
  type WorkspaceNoteSegmentSupplementContent,
  type WorkspaceError,
  type WorkspaceSession,
  type VoiceTranscriptionSettings,
} from './workspace/workspaceApi';
import {
  lastTranscriptionAttemptOnFinalize,
  type LastTranscriptionAttemptOnFinalize,
} from './workspace/recordingTranscriptionAttempt';
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
  memoryDetailQueryBelongsToWorkspace,
  memoryDetailQueryKey,
  memorySpacesQueryKey,
  memorySpacesQueryOptions,
  seedWorkspaceSnapshot,
  segmentSupplementContentQueryKey,
  segmentSupplementContentQueryPrefix,
  segmentContentQueryKey,
  workspaceHandleScopedContentQueryBelongsToWorkspace,
  workspaceContentQueryBelongsToWorkspace,
  workspaceSnapshotQueryKey,
} from './workspace/workspaceQueries';

type WorkspaceView = { readonly name: 'workspace-stage' } | { readonly name: 'library' };
type AppMode = 'app' | 'settings';

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
type TranscriptionBackfillResponse<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: WorkspaceError };
type SegmentTranscriptionBackfillValue = Extract<
  Awaited<ReturnType<typeof requestSegmentTranscriptionBackfill>>,
  { readonly ok: true }
>['value'];
type SegmentSupplementTranscriptionBackfillValue = Extract<
  Awaited<ReturnType<typeof requestSegmentSupplementTranscriptionBackfill>>,
  { readonly ok: true }
>['value'];
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
type NoteEditorFlow =
  | { readonly status: 'closed' }
  | {
      readonly open: boolean;
      readonly status: 'active';
      readonly target: NoteEditorTarget;
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
const NOTE_EDITOR_NAVIGATION_BLOCKED = '当前笔记尚未完成，请先保存或关闭笔记。';
const INLINE_MARKDOWN_EDIT_NAVIGATION_BLOCKED = '请先保存当前文本编辑。';
const RECORDING_RECOVERY_SAVE_ERROR = '无法保存未完成录音。';
const RECORDING_RECOVERY_DISCARD_ERROR = '无法放弃未完成录音。';
const TRANSCRIPTION_BACKFILL_ERROR = '无法生成转录。';
const TRANSCRIPTION_BACKFILL_SUCCESS = '已生成转录';

function segmentBackfillKey(target: SegmentTranscriptionRetryTarget): string {
  return [target.workspaceId, target.memoryId, target.segmentId].join(':');
}

function segmentSupplementBackfillKey(target: SegmentSupplementTranscriptionRetryTarget): string {
  return [target.workspaceId, target.memoryId, target.segmentId, target.supplementId].join(':');
}

function createPendingSegmentDeleteQueryGuard(
  projections: readonly PendingSegmentDeleteProjection[]
) {
  const protectedMemoryDetailKeys = new Set<string>();
  const protectedSegmentContentKeys = new Set<string>();

  for (const projection of projections) {
    protectedMemoryDetailKeys.add(`${projection.workspaceId}:${projection.memoryId}`);
    protectedSegmentContentKeys.add(
      `${projection.workspaceId}:${projection.memoryId}:${projection.segmentId}`
    );
  }

  return (queryKey: readonly unknown[]) => {
    const [scope, kind, workspaceId, memoryId, segmentId] = queryKey;
    if (scope !== 'workspace' || typeof workspaceId !== 'string' || typeof memoryId !== 'string') {
      return false;
    }

    if (kind === 'memory-detail') {
      return protectedMemoryDetailKeys.has(`${workspaceId}:${memoryId}`);
    }

    if (
      (kind === 'segment-content' || kind === 'segment-supplement-content') &&
      typeof segmentId === 'string'
    ) {
      return protectedSegmentContentKeys.has(`${workspaceId}:${memoryId}:${segmentId}`);
    }

    return false;
  };
}

function addRunningKey(current: ReadonlySet<string>, key: string): ReadonlySet<string> {
  if (current.has(key)) {
    return current;
  }
  return new Set([...current, key]);
}

function removeRunningKey(current: ReadonlySet<string>, key: string): ReadonlySet<string> {
  if (!current.has(key)) {
    return current;
  }
  const next = new Set(current);
  next.delete(key);
  return next;
}

function voiceBackfillDisabledReason({
  recordingActive,
  settings,
  settingsLoading,
}: {
  readonly recordingActive: boolean;
  readonly settings: VoiceTranscriptionSettings | undefined;
  readonly settingsLoading: boolean;
}): string | null {
  if (recordingActive) {
    return '当前录音尚未完成，请先完成或关闭录音。';
  }
  if (settingsLoading || !settings) {
    return '正在载入语音设置。';
  }
  if (!settings.enabled) {
    return '先在设置里启用语音识别。';
  }
  if (!settings.apiKeyConfigured) {
    return '先在设置里填写 X-Api-Key。';
  }
  if (settings.lastValidationCode === 'auth') {
    return 'X-Api-Key 验证失败，请在设置中更新。';
  }
  return null;
}

async function recoveryLastTranscriptionAttemptOnFinalize(
  queryClient: QueryClient
): Promise<LastTranscriptionAttemptOnFinalize> {
  // Recovery markers do not persist this field; finalize uses the current settings snapshot.
  const voiceSettings = await queryClient.fetchQuery(voiceSettingsQueryOptions());
  return lastTranscriptionAttemptOnFinalize(voiceSettings.enabled);
}

function sameMemorySummary(first: WorkspaceMemorySummary, second: WorkspaceMemorySummary): boolean {
  return (
    first.memoryId === second.memoryId &&
    first.title === second.title &&
    first.createdAt === second.createdAt &&
    first.updatedAt === second.updatedAt &&
    first.segmentCount === second.segmentCount &&
    first.audioSegmentCount === second.audioSegmentCount &&
    first.noteSegmentCount === second.noteSegmentCount &&
    first.audioDurationMs === second.audioDurationMs &&
    first.audioByteLength === second.audioByteLength &&
    first.hasAudioTranscript === second.hasAudioTranscript &&
    first.hasAnyNote === second.hasAnyNote &&
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

  return {
    ...currentDetail,
    detail: {
      ...currentDetail.detail,
      ...memory,
      workspaceId: currentDetail.detail.workspaceId,
      segments: upsertByProjectedUpdatedAt(
        currentDetail.detail.segments,
        segment,
        (currentSegment) => currentSegment.segmentId
      ),
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

function mergeSegmentIntoMemoryDetailIfCurrentContentTitle(
  currentDetail: MemoryDetailQueryData | undefined,
  memory: WorkspaceMemorySummary,
  segment: WorkspaceMemoryDetail['segments'][number],
  workspaceId: string,
  expectedTitle: string,
  fallbackTitle: string
): MemoryDetailQueryData | undefined {
  const currentSegment = currentDetail?.detail.segments.find(
    (candidate) => candidate.segmentId === segment.segmentId
  );
  if ((currentSegment?.contentTitle ?? fallbackTitle) !== expectedTitle) {
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
    supplements: upsertByProjectedUpdatedAt(
      currentSegment.supplements,
      supplement,
      (candidate) => candidate.supplementId
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
  const supplements = upsertByProjectedUpdatedAt(
    segment.supplements,
    supplement,
    (candidate) => candidate.supplementId
  );

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
    detailSummary.audioDurationMs === memory.audioDurationMs &&
    detailSummary.segmentCount === memory.segmentCount;

  return detailMatchesProjectedAdditiveFields
    ? { ...memory, hasAudioTranscript: detailSummary.hasAudioTranscript }
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
      projection.memoryBeforeDelete.hasAudioTranscript !== memory.hasAudioTranscript
  );

  return hasExternalNonAdditiveChange
    ? { ...projectedMemory, hasAudioTranscript: memory.hasAudioTranscript }
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
  const [segmentContentClearTarget, setSegmentContentClearTarget] =
    useState<SegmentContentClearTarget | null>(null);
  const [segmentContentRenameTarget, setSegmentContentRenameTarget] =
    useState<SegmentContentRenameTarget | null>(null);
  const [segmentRenameTarget, setSegmentRenameTarget] = useState<SegmentRenameTarget | null>(null);
  const [segmentSupplementDeleteTarget, setSegmentSupplementDeleteTarget] =
    useState<SegmentSupplementDeleteTarget | null>(null);
  const [segmentSupplementRenameTarget, setSegmentSupplementRenameTarget] =
    useState<SegmentSupplementRenameTarget | null>(null);
  const [workspaceActionPending, setWorkspaceActionPending] = useState(false);
  const [segmentContentClearPending, setSegmentContentClearPending] = useState(false);
  const [workspaceEntryError, setWorkspaceEntryError] = useState<string | null>(null);
  const [recordingFlow, setRecordingFlow] = useState<RecordingFlow>({ status: 'closed' });
  const [noteEditorFlow, setNoteEditorFlow] = useState<NoteEditorFlow>({ status: 'closed' });
  const [recordingRecoveryActionPending, setRecordingRecoveryActionPending] = useState(false);
  const [recordingRecoveryDraft, setRecordingRecoveryDraft] =
    useState<RecordingRecoveryDraft | null>(null);
  const [runningTranscriptionBackfills, setRunningTranscriptionBackfills] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [memoryStudioInlineMarkdownDirty, setMemoryStudioInlineMarkdownDirty] = useState(false);
  const [memoryRailInline, setMemoryRailInline] = useState(canShowInlineMemoryRail);
  const [memoryRailOpen, setMemoryRailOpen] = useState(false);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(WORKSPACE_STAGE_VIEW);
  const [appMode, setAppMode] = useState<AppMode>('app');
  const [settingsBusy, setSettingsBusy] = useState(false);
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
  const workspaceSessionRefreshHandle = workspaceSession?.workspaceHandle ?? null;
  const workspaceSessionRefreshId = workspaceSession?.workspaceId ?? null;
  const lastWorkspaceErrorToastRef = useRef<string | null>(null);
  const pendingSegmentDeleteProjectionsRef = useRef<Map<string, PendingSegmentDeleteProjection>>(
    new Map()
  );
  const workspaceSessionRef = useRef<WorkspaceSession | null>(null);
  const workspaceSessionRevisionRef = useRef(0);
  const workspaceSnapshotRefreshRequestRef = useRef(0);
  const recordingRecoveryActionIdRef = useRef(0);
  const runningTranscriptionBackfillsRef = useRef<Map<string, string>>(new Map());
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
        for (const [key, workspaceHandle] of runningTranscriptionBackfillsRef.current.entries()) {
          if (!resolvedSession || workspaceHandle !== resolvedSession.workspaceHandle) {
            runningTranscriptionBackfillsRef.current.delete(key);
          }
        }
        setRunningTranscriptionBackfills(new Set(runningTranscriptionBackfillsRef.current.keys()));
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
  const voiceSettingsQuery = useQuery(voiceSettingsQueryOptions());
  const devWorkspaceScenarioNameRef = useRef(readAutoOpenDevWorkspaceScenarioName());
  const devWorkspaceScenarioOpeningRef = useRef(false);
  const activeRecordingFlow = recordingFlow.status === 'active' ? recordingFlow : null;
  const recordingTarget = activeRecordingFlow?.target ?? null;
  const recordingOverlayOpen = activeRecordingFlow?.open ?? false;
  const recordingCloseBlocked = activeRecordingFlow?.closeBlocked ?? false;
  const recordingRecoveryReviewDraft = activeRecordingFlow?.recoveredDraft ?? null;
  const activeNoteEditorFlow = noteEditorFlow.status === 'active' ? noteEditorFlow : null;
  const noteEditorTarget = activeNoteEditorFlow?.target ?? null;
  const noteEditorOpen = activeNoteEditorFlow?.open ?? false;
  const noteEditorBlocking = noteEditorTarget !== null && noteEditorOpen;
  const transcriptionBackfillDisabledReason = voiceBackfillDisabledReason({
    recordingActive: recordingTarget !== null,
    settings: voiceSettingsQuery.data,
    settingsLoading: voiceSettingsQuery.isLoading,
  });
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
      document.documentElement.classList.remove('dark');
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset['theme'] = effectiveTheme;
    document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
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
    const interruptionMessage =
      recordingTarget && recordingCloseBlocked
        ? RECORDING_FLOW_NAVIGATION_BLOCKED
        : noteEditorBlocking
          ? NOTE_EDITOR_NAVIGATION_BLOCKED
          : memoryStudioInlineMarkdownDirty
            ? INLINE_MARKDOWN_EDIT_NAVIGATION_BLOCKED
            : null;
    if (!interruptionMessage) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = interruptionMessage;
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [memoryStudioInlineMarkdownDirty, noteEditorBlocking, recordingCloseBlocked, recordingTarget]);

  useEffect(() => {
    if (!workspaceSession || recordingTarget || noteEditorBlocking) {
      setRecordingRecoveryDraft(null);
      return;
    }

    setRecordingRecoveryDraft(readRecordingRecoveryDraft(workspaceSession));
  }, [noteEditorBlocking, recordingTarget, workspaceSession]);

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
    const activeSession = workspaceSessionRef.current;
    if (
      !activeSession ||
      recordingTarget ||
      activeSession.workspaceHandle !== workspaceSessionRefreshHandle ||
      activeSession.workspaceId !== workspaceSessionRefreshId
    ) {
      return;
    }

    const refreshSession = activeSession;
    let disposed = false;
    let refreshInFlight = false;
    let refreshQueued = false;
    let refreshQueuedShowError = false;

    async function refreshWorkspaceFromFileTruth({ showError }: { readonly showError: boolean }) {
      if (refreshInFlight) {
        refreshQueued = true;
        refreshQueuedShowError ||= showError;
        return;
      }

      refreshInFlight = true;
      try {
        await performWorkspaceRefresh({ showError });
      } finally {
        refreshInFlight = false;
        if (refreshQueued && !disposed) {
          const nextShowError = refreshQueuedShowError;
          refreshQueued = false;
          refreshQueuedShowError = false;
          void refreshWorkspaceFromFileTruth({ showError: nextShowError });
        }
      }
    }

    async function performWorkspaceRefresh({ showError }: { readonly showError: boolean }) {
      const requestId = ++workspaceSnapshotRefreshRequestRef.current;
      const sessionRevision = workspaceSessionRevisionRef.current;
      const response = await readWorkspaceSnapshot({
        workspaceHandle: refreshSession.workspaceHandle,
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

      if (response.value.workspaceId !== refreshSession.workspaceId) {
        if (showError) {
          setWorkspaceEntryError('无法刷新记忆空间。');
        }
        return;
      }

      const pendingSegmentDeleteProjections = [
        ...pendingSegmentDeleteProjectionsRef.current.values(),
      ].filter((projection) => pendingSegmentDeleteBelongsToSession(projection, refreshSession));
      const pendingProjectionsByMemory = new Map<string, PendingSegmentDeleteProjection[]>();
      for (const projection of pendingSegmentDeleteProjections) {
        const pendingForMemory = pendingProjectionsByMemory.get(projection.memoryId);
        if (pendingForMemory) {
          pendingForMemory.push(projection);
        } else {
          pendingProjectionsByMemory.set(projection.memoryId, [projection]);
        }
      }
      const currentMemoriesById = new Map(
        (workspaceSessionRef.current?.snapshot.memories ?? []).map((memory) => [
          memory.memoryId,
          memory,
        ])
      );
      const refreshSessionMemoriesById = new Map(
        refreshSession.snapshot.memories.map((memory) => [memory.memoryId, memory])
      );
      const projectedMemories = response.value.memories.map((memory) => {
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
        const currentDetail = queryClient.getQueryData<MemoryDetailQueryData | undefined>(
          detailQueryKey
        );
        if (
          currentDetail?.detail.workspaceId === response.value.workspaceId &&
          currentDetail.detail.memoryId === memory.memoryId
        ) {
          return memorySummaryPreservingExternalNonAdditiveChanges({
            memory,
            pendingProjections: pendingForMemory,
            visibleSegments: currentDetail.detail.segments.filter(
              (segment) => !pendingSegmentIds.has(segment.segmentId)
            ),
          });
        }

        return (
          currentMemoriesById.get(memory.memoryId) ??
          refreshSessionMemoriesById.get(memory.memoryId) ??
          memory
        );
      });
      if (
        disposed ||
        requestId !== workspaceSnapshotRefreshRequestRef.current ||
        sessionRevision !== workspaceSessionRevisionRef.current
      ) {
        return;
      }
      const projectedSnapshot = {
        ...response.value,
        memories: projectedMemories,
      };
      const currentSession = workspaceSessionRef.current;
      if (
        !currentSession ||
        currentSession.workspaceHandle !== refreshSession.workspaceHandle ||
        currentSession.workspaceId !== refreshSession.workspaceId
      ) {
        return;
      }
      const queryKeyMatchesProtectedPendingDelete = createPendingSegmentDeleteQueryGuard(
        pendingSegmentDeleteProjections
      );

      if (sameWorkspaceSnapshot(currentSession.snapshot, projectedSnapshot)) {
        setWorkspaceEntryError(null);
        void queryClient.invalidateQueries({
          predicate: (query) => {
            const observerCount =
              typeof query.getObserversCount === 'function' ? query.getObserversCount() : 1;
            return (
              observerCount > 0 &&
              workspaceContentQueryBelongsToWorkspace(query.queryKey, response.value.workspaceId) &&
              !queryKeyMatchesProtectedPendingDelete(query.queryKey)
            );
          },
        });
        return;
      }

      const refreshedSession: WorkspaceSession = {
        ...currentSession,
        snapshot: projectedSnapshot,
      };

      seedWorkspaceSnapshot(queryClient, refreshedSession);
      setWorkspaceEntryError(null);
      setWorkspaceSession((currentSession) =>
        currentSession?.workspaceHandle === refreshSession.workspaceHandle
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
          ) && !queryKeyMatchesProtectedPendingDelete(query.queryKey),
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
  }, [
    queryClient,
    recordingTarget,
    setWorkspaceSession,
    workspaceSessionRefreshHandle,
    workspaceSessionRefreshId,
  ]);

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
        workspaceContentQueryBelongsToWorkspace(query.queryKey, nextWorkspaceSession.workspaceId),
    });
    void queryClient.invalidateQueries({
      predicate: (query) =>
        memoryDetailQueryBelongsToWorkspace(query.queryKey, nextWorkspaceSession.workspaceId),
      refetchType: 'none',
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
    setSegmentContentClearTarget(null);
    setSegmentContentRenameTarget(null);
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
    const currentSession = workspaceSessionRef.current;
    if (currentSession && currentSession.workspaceHandle !== nextWorkspaceSession.workspaceHandle) {
      try {
        const closePrevious = await closeWorkspace({
          workspaceHandle: currentSession.workspaceHandle,
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

  useEffect(() => {
    const scenarioName = devWorkspaceScenarioNameRef.current;
    if (!scenarioName || devWorkspaceScenarioOpeningRef.current || workspaceSessionRef.current) {
      return;
    }

    let disposed = false;
    const scenarioMemorySpaceId = devWorkspaceScenarioMemorySpaceId(scenarioName);
    devWorkspaceScenarioOpeningRef.current = true;

    async function openDevWorkspaceScenario() {
      const response = await openMemorySpace({
        workspaceId: scenarioMemorySpaceId,
      }).catch((error: unknown) => {
        if (!disposed) {
          setWorkspaceEntryError(unknownErrorDisplayMessage(error, OPEN_MEMORY_SPACE_ERROR));
        }
        return null;
      });

      if (!response || disposed || workspaceSessionRef.current) {
        return;
      }

      if (!response.ok) {
        setWorkspaceEntryError(
          workspaceErrorDisplayMessage(response.error, OPEN_MEMORY_SPACE_ERROR)
        );
        return;
      }

      await acceptWorkspaceSession(response.value);
    }

    void openDevWorkspaceScenario();

    return () => {
      disposed = true;
      devWorkspaceScenarioOpeningRef.current = false;
    };
  }, []);

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

  function blockWorkspaceFlowInterruption() {
    if (recordingTarget) {
      toast.error(RECORDING_FLOW_NAVIGATION_BLOCKED);
      return true;
    }
    if (noteEditorBlocking) {
      toast.error(NOTE_EDITOR_NAVIGATION_BLOCKED);
      return true;
    }
    if (memoryStudioInlineMarkdownDirty) {
      toast.error(INLINE_MARKDOWN_EDIT_NAVIGATION_BLOCKED);
      return true;
    }

    return false;
  }

  const runTranscriptionBackfill = useCallback(
    <TValue,>({
      applySuccess,
      key,
      request,
      workspaceId,
    }: {
      readonly applySuccess: (value: TValue) => void;
      readonly key: string;
      readonly request: (
        session: WorkspaceSession
      ) => Promise<TranscriptionBackfillResponse<TValue>>;
      readonly workspaceId: string;
    }) => {
      const session = workspaceSessionRef.current;
      if (!session || session.workspaceId !== workspaceId) {
        return Promise.resolve();
      }
      if (runningTranscriptionBackfillsRef.current.get(key) === session.workspaceHandle) {
        return Promise.resolve();
      }
      runningTranscriptionBackfillsRef.current.set(key, session.workspaceHandle);
      setRunningTranscriptionBackfills((current) => addRunningKey(current, key));
      const operation = (async () => {
        try {
          const response = await request(session);
          const currentSession = workspaceSessionRef.current;
          if (
            currentSession?.workspaceId !== workspaceId ||
            currentSession.workspaceHandle !== session.workspaceHandle
          ) {
            return;
          }
          if (!response.ok) {
            toast.error(TRANSCRIPTION_BACKFILL_ERROR, {
              description: workspaceErrorDisplayMessage(
                response.error,
                TRANSCRIPTION_BACKFILL_ERROR
              ),
            });
            return;
          }
          applySuccess(response.value);
          toast.success(TRANSCRIPTION_BACKFILL_SUCCESS);
        } catch (error) {
          toast.error(TRANSCRIPTION_BACKFILL_ERROR, {
            description: unknownErrorDisplayMessage(error, TRANSCRIPTION_BACKFILL_ERROR),
          });
        } finally {
          if (runningTranscriptionBackfillsRef.current.get(key) === session.workspaceHandle) {
            runningTranscriptionBackfillsRef.current.delete(key);
            setRunningTranscriptionBackfills((current) => removeRunningKey(current, key));
          }
        }
      })();
      return operation;
    },
    []
  );
  const handleRecordingContentSavedRef = useRef(handleRecordingContentSaved);
  const handleSegmentSupplementFinalizedRef = useRef(handleSegmentSupplementFinalized);
  handleRecordingContentSavedRef.current = handleRecordingContentSaved;
  handleSegmentSupplementFinalizedRef.current = handleSegmentSupplementFinalized;

  const retrySegmentTranscriptionBackfill = useCallback(
    (target: SegmentTranscriptionRetryTarget & { readonly mode: TranscriptionBackfillMode }) => {
      return runTranscriptionBackfill<SegmentTranscriptionBackfillValue>({
        applySuccess: (value) =>
          handleRecordingContentSavedRef.current({
            memory: value.memory,
            memoryId: target.memoryId,
            segmentId: target.segmentId,
          }),
        key: segmentBackfillKey(target),
        request: (session) =>
          requestSegmentTranscriptionBackfill({
            workspaceHandle: session.workspaceHandle,
            workspaceId: target.workspaceId,
            memoryId: target.memoryId,
            segmentId: target.segmentId,
            mode: target.mode,
          }),
        workspaceId: target.workspaceId,
      });
    },
    [runTranscriptionBackfill]
  );

  const retrySupplementTranscriptionBackfill = useCallback(
    (
      target: SegmentSupplementTranscriptionRetryTarget & {
        readonly mode: TranscriptionBackfillMode;
      }
    ) => {
      return runTranscriptionBackfill<SegmentSupplementTranscriptionBackfillValue>({
        applySuccess: (value) =>
          handleSegmentSupplementFinalizedRef.current(
            {
              memory: value.memory,
              segment: value.segment,
              supplement: value.supplement,
            },
            { refreshContent: true }
          ),
        key: segmentSupplementBackfillKey(target),
        request: (session) =>
          requestSegmentSupplementTranscriptionBackfill({
            workspaceHandle: session.workspaceHandle,
            workspaceId: target.workspaceId,
            memoryId: target.memoryId,
            segmentId: target.segmentId,
            supplementId: target.supplementId,
            mode: target.mode,
          }),
        workspaceId: target.workspaceId,
      });
    },
    [runTranscriptionBackfill]
  );
  const memoryStudioTranscriptionBackfill = useMemo(
    () => ({
      disabledReason: transcriptionBackfillDisabledReason,
      isSegmentRunning: (target: SegmentTranscriptionRetryTarget) =>
        runningTranscriptionBackfills.has(segmentBackfillKey(target)),
      isSupplementRunning: (target: SegmentSupplementTranscriptionRetryTarget) =>
        runningTranscriptionBackfills.has(segmentSupplementBackfillKey(target)),
      retrySegment: retrySegmentTranscriptionBackfill,
      retrySupplement: retrySupplementTranscriptionBackfill,
    }),
    [
      retrySegmentTranscriptionBackfill,
      retrySupplementTranscriptionBackfill,
      runningTranscriptionBackfills,
      transcriptionBackfillDisabledReason,
    ]
  );

  function openWorkspaceCreateDialog() {
    if (blockWorkspaceFlowInterruption()) {
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
    if (blockWorkspaceFlowInterruption()) {
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
          workspaceContentQueryBelongsToWorkspace(query.queryKey, workspaceSession.workspaceId),
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
    if (blockWorkspaceFlowInterruption()) {
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
    if (blockWorkspaceFlowInterruption()) {
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
    if (blockWorkspaceFlowInterruption()) {
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
    if (blockWorkspaceFlowInterruption()) {
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
    if (blockWorkspaceFlowInterruption()) {
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
  const settingsContent = (
    <SettingsShell
      returnDisabled={settingsBusy}
      onReturnToApp={() => {
        if (!settingsBusy) {
          setAppMode('app');
        }
      }}
    >
      <VoiceSettingsPanel onBusyChange={setSettingsBusy} />
    </SettingsShell>
  );
  function openSettingsMode() {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    setAppMode('settings');
  }

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
    onOpenSettings: openSettingsMode,
    onOpenLocalWorkspace: () => {
      void handleOpenLocalWorkspace();
    },
    onRenameMemorySpace: openMemorySpaceRenameDialog,
    onRemoveMemorySpace: openMemorySpaceRemoveDialog,
    onSettingsBlocked: blockWorkspaceFlowInterruption,
    onSelectMemorySpace: (workspaceId: string) => {
      void selectMemorySpaceFromSidebar(workspaceId);
    },
    recordingActive: recordingTarget !== null,
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
    if (appMode === 'settings') {
      return (
        <>
          <ReoToaster themeMode={effectiveTheme} />
          {settingsContent}
          {workspaceDialogs}
        </>
      );
    }

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

  function workspaceSessionMatches(expectedSession: WorkspaceSession) {
    const currentSession = workspaceSessionRef.current;
    return (
      currentSession?.workspaceHandle === expectedSession.workspaceHandle &&
      currentSession.workspaceId === expectedSession.workspaceId
    );
  }

  function handleAudioSegmentFinalized(
    finalized: FinalizedAudioSegment,
    options: { readonly expectedSession?: WorkspaceSession } = {}
  ) {
    const expectedSession = options.expectedSession ?? activeWorkspaceSession;
    if (!workspaceSessionMatches(expectedSession)) {
      return;
    }

    const snapshotQueryKey = workspaceSnapshotQueryKey(expectedSession);
    const detailQueryKey = memoryDetailQueryKey({
      workspaceId: expectedSession.workspaceId,
      memoryId: finalized.memory.memoryId,
    });
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) =>
        mergeMemoryIntoSession(
          {
            ...expectedSession,
            snapshot: currentSnapshot ?? expectedSession.snapshot,
          },
          finalized.memory
        ).snapshot
    );
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(detailQueryKey, (currentDetail) =>
      mergeSegmentIntoMemoryDetail(
        currentDetail,
        finalized.memory,
        finalized.segment,
        expectedSession.workspaceId
      )
    );
    setSelectedMemoryId(finalized.segment.memoryId);
    setSegmentFocusIntent({
      memoryId: finalized.segment.memoryId,
      segmentId: finalized.segment.segmentId,
    });
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceHandle === expectedSession.workspaceHandle &&
      currentSession.workspaceId === expectedSession.workspaceId
        ? mergeMemoryIntoSession(currentSession, finalized.memory)
        : currentSession
    );
  }

  function handleSegmentSupplementFinalized(
    finalized: FinalizedSegmentSupplementRecording,
    options: {
      readonly expectedSession?: WorkspaceSession;
      readonly refreshContent?: boolean;
    } = {}
  ) {
    const expectedSession = options.expectedSession ?? activeWorkspaceSession;
    const activeSession = workspaceSessionRef.current;
    if (
      !activeSession ||
      activeSession.workspaceHandle !== expectedSession.workspaceHandle ||
      activeSession.workspaceId !== expectedSession.workspaceId
    ) {
      return;
    }

    const snapshotQueryKey = workspaceSnapshotQueryKey(activeSession);
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) =>
        mergeMemoryIntoSession(
          {
            ...activeSession,
            snapshot: currentSnapshot ?? activeSession.snapshot,
          },
          finalized.memory
        ).snapshot
    );
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(
      memoryDetailQueryKey({
        workspaceId: activeSession.workspaceId,
        memoryId: finalized.memory.memoryId,
      }),
      (currentDetail) =>
        mergeSegmentIntoMemoryDetail(
          currentDetail,
          finalized.memory,
          finalized.segment,
          activeSession.workspaceId
        )
    );
    setSelectedMemoryId(finalized.memory.memoryId);
    setWorkspaceSession((session) =>
      session?.workspaceHandle === activeSession.workspaceHandle &&
      session.workspaceId === activeSession.workspaceId
        ? mergeMemoryIntoSession(session, finalized.memory)
        : session
    );
    if (options.refreshContent) {
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: segmentSupplementContentQueryKey({
          workspaceId: activeSession.workspaceId,
          memoryId: finalized.memory.memoryId,
          segmentId: finalized.segment.segmentId,
          supplementId: finalized.supplement.supplementId,
        }),
      });
    }
  }

  function handleSegmentSupplementTranscriptSaved(saved: SavedSegmentSupplementTranscriptContent) {
    handleSegmentSupplementFinalized(
      {
        memory: saved.memory,
        segment: saved.segment,
        supplement: saved.supplement,
      },
      { expectedSession: saved.expectedSession, refreshContent: true }
    );
  }

  function handleNoteSegmentFinalized(finalized: FinalizedNoteSegment) {
    if (!workspaceSessionMatches(activeWorkspaceSession)) {
      return;
    }

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
      currentSession?.workspaceHandle === activeWorkspaceSession.workspaceHandle &&
      currentSession.workspaceId === activeWorkspaceSession.workspaceId
        ? mergeMemoryIntoSession(currentSession, finalized.memory)
        : currentSession
    );
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: segmentContentQueryKey({
        workspaceId: activeWorkspaceSession.workspaceId,
        memoryId: finalized.segment.memoryId,
        segmentId: finalized.segment.segmentId,
      }),
    });
  }

  function handleNoteSegmentContentSaved(saved: SavedNoteSegmentContent) {
    const session = saved.expectedSession;
    if (!workspaceSessionMatches(session)) {
      return;
    }

    queryClient.setQueryData<WorkspaceNoteSegmentContent | undefined>(
      segmentContentQueryKey({
        workspaceId: session.workspaceId,
        memoryId: saved.memoryId,
        segmentId: saved.segmentId,
      }),
      (currentContent) =>
        currentContent
          ? {
              ...currentContent,
              bodyMarkdown: saved.bodyMarkdown,
              bodyTiptapJson: saved.bodyTiptapJson ?? currentContent.bodyTiptapJson,
              bodyByteLength: saved.bodyByteLength,
              baselineContentHash: saved.baselineContentHash,
              baselineTiptapContentHash:
                saved.baselineTiptapContentHash ?? currentContent.baselineTiptapContentHash,
            }
          : currentContent
    );
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(
      memoryDetailQueryKey({
        workspaceId: session.workspaceId,
        memoryId: saved.memoryId,
      }),
      (currentDetail) => {
        if (!currentDetail || currentDetail.detail.workspaceId !== session.workspaceId) {
          return currentDetail;
        }
        return {
          ...currentDetail,
          detail: {
            ...currentDetail.detail,
            segments: currentDetail.detail.segments.map((segment) =>
              segment.segmentId === saved.segmentId && segment.type === 'note'
                ? { ...segment, bodyByteLength: saved.bodyByteLength }
                : segment
            ),
          },
        };
      }
    );
  }

  function handleNoteSegmentSupplementContentSaved(saved: SavedNoteSegmentSupplementContent) {
    const session = saved.expectedSession;
    if (!workspaceSessionMatches(session)) {
      return;
    }

    queryClient.setQueryData<WorkspaceNoteSegmentSupplementContent | undefined>(
      segmentSupplementContentQueryKey({
        workspaceId: session.workspaceId,
        memoryId: saved.memoryId,
        segmentId: saved.segmentId,
        supplementId: saved.supplementId,
      }),
      (currentContent) =>
        currentContent
          ? {
              ...currentContent,
              bodyMarkdown: saved.bodyMarkdown,
              bodyTiptapJson: saved.bodyTiptapJson ?? currentContent.bodyTiptapJson,
              bodyByteLength: saved.bodyByteLength,
              baselineContentHash: saved.baselineContentHash,
              baselineTiptapContentHash:
                saved.baselineTiptapContentHash ?? currentContent.baselineTiptapContentHash,
            }
          : currentContent
    );
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(
      memoryDetailQueryKey({
        workspaceId: session.workspaceId,
        memoryId: saved.memoryId,
      }),
      (currentDetail) => {
        if (!currentDetail || currentDetail.detail.workspaceId !== session.workspaceId) {
          return currentDetail;
        }
        return {
          ...currentDetail,
          detail: {
            ...currentDetail.detail,
            segments: currentDetail.detail.segments.map((segment) =>
              segment.segmentId === saved.segmentId
                ? {
                    ...segment,
                    supplements: segment.supplements.map((supplement) =>
                      supplement.supplementId === saved.supplementId && supplement.type === 'note'
                        ? { ...supplement, bodyByteLength: saved.bodyByteLength }
                        : supplement
                    ),
                  }
                : segment
            ),
          },
        };
      }
    );
  }

  function handleSegmentSupplementNoteFinalized(finalized: FinalizedSegmentSupplementNote) {
    if (!workspaceSessionMatches(activeWorkspaceSession)) {
      return;
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
          finalized.memory
        ).snapshot
    );
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(
      memoryDetailQueryKey({
        workspaceId: activeWorkspaceSession.workspaceId,
        memoryId: finalized.memory.memoryId,
      }),
      (currentDetail) =>
        mergeSegmentIntoMemoryDetail(
          currentDetail,
          finalized.memory,
          finalized.segment,
          activeWorkspaceSession.workspaceId
        )
    );
    setSelectedMemoryId(finalized.memory.memoryId);
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceHandle === activeWorkspaceSession.workspaceHandle &&
      currentSession.workspaceId === activeWorkspaceSession.workspaceId
        ? mergeMemoryIntoSession(currentSession, finalized.memory)
        : currentSession
    );
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: segmentSupplementContentQueryKey({
        workspaceId: activeWorkspaceSession.workspaceId,
        memoryId: finalized.memory.memoryId,
        segmentId: finalized.segment.segmentId,
        supplementId: finalized.supplement.supplementId,
      }),
    });
  }

  async function saveRecoveredRecording() {
    const draft = recordingRecoveryDraft;
    if (!draft || recordingRecoveryActionPending) {
      return;
    }

    const recoverySession = activeWorkspaceSession;
    const recoveryActionId = recordingRecoveryActionIdRef.current + 1;
    recordingRecoveryActionIdRef.current = recoveryActionId;
    const recoveryActionIsCurrent = () =>
      recordingRecoveryActionIdRef.current === recoveryActionId &&
      workspaceSessionMatches(recoverySession);

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
          const finalizeTranscriptionAttempt =
            await recoveryLastTranscriptionAttemptOnFinalize(queryClient);
          if (!recoveryActionIsCurrent()) {
            return;
          }
          const response = await finalizeSegmentSupplementRecordingDraft({
            supplementId: draft.segmentId,
            durationMs: draft.durationMs,
            lastTranscriptionAttemptOnFinalize: finalizeTranscriptionAttempt,
            memoryId: draft.memoryId,
            segmentId: draft.parentSegmentId,
            title: draft.title,
            workspaceHandle: recoverySession.workspaceHandle,
            workspaceId: recoverySession.workspaceId,
          });
          if (!recoveryActionIsCurrent()) {
            return;
          }
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
          handleSegmentSupplementFinalized(finalizedSupplement, {
            expectedSession: recoverySession,
          });
          updateRecordingRecoverySnapshot({
            patch: { finalizedSupplement },
            segmentId: draft.segmentId,
            workspaceId: recoverySession.workspaceId,
          });
          setRecordingRecoveryDraft({ ...draft, finalizedSupplement });
        } else {
          if (!recoveryActionIsCurrent()) {
            return;
          }
          handleSegmentSupplementFinalized(finalizedSupplement, {
            expectedSession: recoverySession,
          });
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
              workspaceHandle: recoverySession.workspaceHandle,
              workspaceId: recoverySession.workspaceId,
            });
            if (!recoveryActionIsCurrent()) {
              return;
            }
            if (transcriptResponse.ok) {
              handleSegmentSupplementFinalized(
                {
                  supplement: transcriptResponse.value.supplement,
                  memory: transcriptResponse.value.memory,
                  segment: transcriptResponse.value.segment,
                },
                { expectedSession: recoverySession, refreshContent: true }
              );
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
            if (!recoveryActionIsCurrent()) {
              return;
            }
            transcriptSaved = false;
            toast.error('补充录音已保存，转写暂时无法写入。', {
              description: unknownErrorDisplayMessage(
                transcriptError,
                '补充录音已保存，转写暂时无法写入。'
              ),
            });
          }
        }
        if (!recoveryActionIsCurrent()) {
          return;
        }
        if (!transcriptSaved) {
          return;
        }
        clearRecordingRecoveryDraft({
          segmentId: draft.segmentId,
          workspaceId: recoverySession.workspaceId,
        });
        setRecordingRecoveryDraft(null);
        toast.success('已保存未完成录音');
        return;
      }

      if (!finalizedAudio) {
        const finalizeTranscriptionAttempt =
          await recoveryLastTranscriptionAttemptOnFinalize(queryClient);
        if (!recoveryActionIsCurrent()) {
          return;
        }
        const response = await finalizeRecordingDraft({
          durationMs: draft.durationMs,
          lastTranscriptionAttemptOnFinalize: finalizeTranscriptionAttempt,
          memoryId: draft.memoryId,
          segmentId: draft.segmentId,
          title: draft.title,
          workspaceHandle: recoverySession.workspaceHandle,
        });
        if (!recoveryActionIsCurrent()) {
          return;
        }
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
        handleAudioSegmentFinalized(finalizedAudio, { expectedSession: recoverySession });
        updateRecordingRecoverySnapshot({
          patch: { finalizedAudio },
          segmentId: draft.segmentId,
          workspaceId: recoverySession.workspaceId,
        });
        setRecordingRecoveryDraft({ ...draft, finalizedAudio });
      } else {
        if (!recoveryActionIsCurrent()) {
          return;
        }
        handleAudioSegmentFinalized(finalizedAudio, { expectedSession: recoverySession });
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
            workspaceHandle: recoverySession.workspaceHandle,
          });
          if (!recoveryActionIsCurrent()) {
            return;
          }
          if (transcriptResponse.ok) {
            handleRecordingContentSaved({
              expectedSession: recoverySession,
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
          if (!recoveryActionIsCurrent()) {
            return;
          }
          transcriptSaved = false;
          toast.error('录音已保存，转写暂时无法写入。', {
            description: unknownErrorDisplayMessage(
              transcriptError,
              '录音已保存，转写暂时无法写入。'
            ),
          });
        }
      }
      if (!recoveryActionIsCurrent()) {
        return;
      }
      if (!transcriptSaved) {
        return;
      }
      clearRecordingRecoveryDraft({
        segmentId: draft.segmentId,
        workspaceId: recoverySession.workspaceId,
      });
      setRecordingRecoveryDraft(null);
      toast.success('已保存未完成录音');
    } catch (error) {
      if (!recoveryActionIsCurrent()) {
        return;
      }
      toast.error(RECORDING_RECOVERY_SAVE_ERROR, {
        description: unknownErrorDisplayMessage(error, RECORDING_RECOVERY_SAVE_ERROR),
      });
    } finally {
      if (recordingRecoveryActionIdRef.current === recoveryActionId) {
        setRecordingRecoveryActionPending(false);
      }
    }
  }

  async function discardRecoveredRecording() {
    const draft = recordingRecoveryDraft;
    if (!draft || recordingRecoveryActionPending) {
      return;
    }

    const recoverySession = activeWorkspaceSession;
    const recoveryActionId = recordingRecoveryActionIdRef.current + 1;
    recordingRecoveryActionIdRef.current = recoveryActionId;
    const recoveryActionIsCurrent = () =>
      recordingRecoveryActionIdRef.current === recoveryActionId &&
      workspaceSessionMatches(recoverySession);

    setRecordingRecoveryActionPending(true);
    try {
      if (draft.finalizedAudio || draft.finalizedSupplement) {
        if (!recoveryActionIsCurrent()) {
          return;
        }
        clearRecordingRecoveryDraft({
          segmentId: draft.segmentId,
          workspaceId: recoverySession.workspaceId,
        });
        setRecordingRecoveryDraft(null);
        toast.success('已关闭录音恢复提示');
        return;
      }

      const response =
        draft.targetKind === 'segment-supplement'
          ? await discardSegmentSupplementRecordingDraft({
              supplementId: draft.segmentId,
              workspaceHandle: recoverySession.workspaceHandle,
            })
          : await discardRecordingDraft({
              segmentId: draft.segmentId,
              workspaceHandle: recoverySession.workspaceHandle,
            });
      if (!recoveryActionIsCurrent()) {
        return;
      }
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
        workspaceId: recoverySession.workspaceId,
      });
      setRecordingRecoveryDraft(null);
      toast.success('已放弃未完成录音');
    } catch (error) {
      if (!recoveryActionIsCurrent()) {
        return;
      }
      toast.error(RECORDING_RECOVERY_DISCARD_ERROR, {
        description: unknownErrorDisplayMessage(error, RECORDING_RECOVERY_DISCARD_ERROR),
      });
    } finally {
      if (recordingRecoveryActionIdRef.current === recoveryActionId) {
        setRecordingRecoveryActionPending(false);
      }
    }
  }

  function openMemoryCreateDialog(intent: MemoryCreateIntent) {
    if (blockWorkspaceFlowInterruption()) {
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
    const mutationSession = activeWorkspaceSession;
    try {
      const response = await createMemory({
        workspaceHandle: mutationSession.workspaceHandle,
        title,
      });

      if (!workspaceSessionMatches(mutationSession)) {
        return null;
      }

      if (!response.ok) {
        return workspaceErrorDisplayMessage(response.error, '无法新建记忆。');
      }

      const snapshotQueryKey = workspaceSnapshotQueryKey(mutationSession);
      queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
        snapshotQueryKey,
        (currentSnapshot) =>
          mergeMemoryIntoSession(
            {
              ...mutationSession,
              snapshot: currentSnapshot ?? mutationSession.snapshot,
            },
            response.value
          ).snapshot
      );
      setSelectedMemoryId(response.value.memoryId);
      setWorkspaceSession((currentSession) =>
        currentSession?.workspaceHandle === mutationSession.workspaceHandle &&
        currentSession.workspaceId === mutationSession.workspaceId
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

    const mutationSession = activeWorkspaceSession;
    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);
    const optimisticMemory = { ...memory, title: nextTitle };
    const snapshotQueryKey = workspaceSnapshotQueryKey(mutationSession);
    setMemoryRenameTarget(null);
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) =>
        mergeMemoryIntoSnapshot(currentSnapshot ?? mutationSession.snapshot, optimisticMemory)
    );
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceHandle === mutationSession.workspaceHandle &&
      currentSession.workspaceId === mutationSession.workspaceId
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
            mutationSession.workspaceId,
            memory.memoryId,
            nextTitle,
            memory
          )
        );
      };

      try {
        const response = await updateMemoryTitle({
          workspaceHandle: mutationSession.workspaceHandle,
          memoryId: memory.memoryId,
          title: nextTitle,
        });

        if (!mutationSessionIsActive()) {
          return;
        }

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
            mutationSession.workspaceId,
            memory.memoryId,
            nextTitle,
            response.value
          )
        );
      } catch (error) {
        if (!mutationSessionIsActive()) {
          return;
        }

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

    const mutationSession = activeWorkspaceSession;
    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);
    const memory =
      mutationSession.snapshot.memories.find(
        (candidate) => candidate.memoryId === target.memoryId
      ) ?? null;
    if (!memory) {
      return '无法确认片段所属记忆。';
    }

    const optimisticSegment = { ...target.segment, title: nextTitle };
    const detailQueryKey = memoryDetailQueryKey({
      workspaceId: mutationSession.workspaceId,
      memoryId: target.memoryId,
    });
    setSegmentRenameTarget(null);
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(detailQueryKey, (currentDetail) =>
      mergeSegmentIntoMemoryDetailIfCurrentTitle(
        currentDetail,
        memory,
        optimisticSegment,
        mutationSession.workspaceId,
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
              mutationSession.workspaceId,
              nextTitle
            )
        );
      };

      try {
        const response = await updateSegmentTitle({
          workspaceHandle: mutationSession.workspaceHandle,
          workspaceId: mutationSession.workspaceId,
          memoryId: target.memoryId,
          segmentId: target.segment.segmentId,
          title: nextTitle,
        });

        if (!mutationSessionIsActive()) {
          return;
        }

        if (!response.ok) {
          rollback();
          toast.error('无法保存片段名称', {
            description: workspaceErrorDisplayMessage(response.error, '无法重命名片段。'),
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
            mergeSegmentIntoMemoryDetailIfCurrentTitle(
              currentDetail,
              response.value.memory,
              response.value.segment,
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
        toast.error('无法保存片段名称', {
          description: unknownErrorDisplayMessage(error, '无法重命名片段。'),
        });
      }
    })();

    return null;
  }

  async function saveRenamedSegmentContent(target: SegmentContentRenameTarget, title: string) {
    const nextTitle = title.trim();
    if (nextTitle === target.currentTitle.trim()) {
      return null;
    }

    const mutationSession = activeWorkspaceSession;
    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);
    const memory =
      mutationSession.snapshot.memories.find(
        (candidate) => candidate.memoryId === target.memoryId
      ) ?? null;
    if (!memory) {
      return '无法确认片段所属记忆。';
    }

    const optimisticSegment = { ...target.segment, contentTitle: nextTitle };
    const detailQueryKey = memoryDetailQueryKey({
      workspaceId: mutationSession.workspaceId,
      memoryId: target.memoryId,
    });
    setSegmentContentRenameTarget(null);
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(detailQueryKey, (currentDetail) =>
      mergeSegmentIntoMemoryDetailIfCurrentContentTitle(
        currentDetail,
        memory,
        optimisticSegment,
        mutationSession.workspaceId,
        target.currentTitle,
        target.currentTitle
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
            mergeSegmentIntoMemoryDetailIfCurrentContentTitle(
              currentDetail,
              memory,
              target.segment,
              mutationSession.workspaceId,
              nextTitle,
              target.currentTitle
            )
        );
      };

      try {
        const response = await updateSegmentContentTitle({
          workspaceHandle: mutationSession.workspaceHandle,
          workspaceId: mutationSession.workspaceId,
          memoryId: target.memoryId,
          segmentId: target.segment.segmentId,
          contentTitle: nextTitle,
        });

        if (!mutationSessionIsActive()) {
          return;
        }

        if (!response.ok) {
          rollback();
          toast.error('无法保存内容名称', {
            description: workspaceErrorDisplayMessage(response.error, '无法重命名内容。'),
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
            mergeSegmentIntoMemoryDetailIfCurrentContentTitle(
              currentDetail,
              response.value.memory,
              response.value.segment,
              mutationSession.workspaceId,
              nextTitle,
              target.currentTitle
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
        toast.error('无法保存内容名称', {
          description: unknownErrorDisplayMessage(error, '无法重命名内容。'),
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

  function applyMemoryListUpdate(
    memories: readonly WorkspaceMemorySummary[],
    session: WorkspaceSession = activeWorkspaceSession
  ) {
    const snapshotQueryKey = workspaceSnapshotQueryKey(session);
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) => ({
        ...(currentSnapshot ?? session.snapshot),
        memories: [...memories],
      })
    );
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceHandle === session.workspaceHandle &&
      currentSession.workspaceId === session.workspaceId
        ? replaceSessionMemories(currentSession, memories)
        : currentSession
    );
  }

  function openMemoryDeleteDialog(memory: WorkspaceMemorySummary) {
    if (blockWorkspaceFlowInterruption()) {
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
    if (blockWorkspaceFlowInterruption()) {
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
    if (blockWorkspaceFlowInterruption()) {
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

    const mutationSession = activeWorkspaceSession;
    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);

    try {
      const response = await restoreDeletedMemory({
        workspaceHandle: mutationSession.workspaceHandle,
        restoreToken,
      });

      if (!mutationSessionIsActive()) {
        return;
      }

      if (!response.ok) {
        toast.error(MEMORY_RESTORE_ERROR, {
          description: workspaceErrorDisplayMessage(response.error, MEMORY_RESTORE_ERROR),
        });
        return;
      }

      applyMemoryListUpdate(response.value.memories, mutationSession);
      setSelectedMemoryId(response.value.memory.memoryId);
      toast.success('已恢复记忆');
    } catch (error) {
      if (!mutationSessionIsActive()) {
        return;
      }

      toast.error(MEMORY_RESTORE_ERROR, {
        description: unknownErrorDisplayMessage(error, MEMORY_RESTORE_ERROR),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  async function confirmDeleteMemory() {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    const target = memoryDeleteTarget;
    if (!target || !beginWorkspaceAction()) {
      return;
    }

    const mutationSession = activeWorkspaceSession;
    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);
    const selectedMemoryAtRequest = currentMemoryId;

    try {
      const response = await deleteMemory({
        workspaceHandle: mutationSession.workspaceHandle,
        memoryId: target.memoryId,
      });

      if (!mutationSessionIsActive()) {
        return;
      }

      if (!response.ok) {
        toast.error(MEMORY_DELETE_ERROR, {
          description: workspaceErrorDisplayMessage(response.error, MEMORY_DELETE_ERROR),
        });
        return;
      }

      applyMemoryListUpdate(response.value.memories, mutationSession);
      queryClient.removeQueries({
        queryKey: memoryDetailQueryKey({
          workspaceId: mutationSession.workspaceId,
          memoryId: target.memoryId,
        }),
      });
      if (selectedMemoryAtRequest === target.memoryId) {
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
      if (!mutationSessionIsActive()) {
        return;
      }

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
    if (blockWorkspaceFlowInterruption()) {
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
    if (blockWorkspaceFlowInterruption()) {
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
    const currentSessionPendingSegmentDeletes = () =>
      [...pendingSegmentDeleteProjectionsRef.current.values()].filter((projection) =>
        pendingSegmentDeleteBelongsToSession(projection, session)
      );
    const memoryWithPendingDeletes = (
      memory: WorkspaceMemorySummary,
      pendingDeletes: readonly PendingSegmentDeleteProjection[]
    ) =>
      pendingDeletes.reduce(
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

        const remainingPendingSegmentDeletes = currentSessionPendingSegmentDeletes();
        const remainingPendingSegmentIds = new Set(
          remainingPendingSegmentDeletes.map((projection) => projection.segmentId)
        );
        const committedMemory =
          memorySummaryWithVisibleDetail(
            response.value.memory,
            queryClient.getQueryData<MemoryDetailQueryData | undefined>(memoryDetailKey),
            session.workspaceId,
            remainingPendingSegmentIds
          ) ??
          memorySummaryWithDetailTranscriptWhenAdditiveFieldsMatch(
            memoryWithPendingDeletes(response.value.memory, remainingPendingSegmentDeletes),
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
    void queryClient.invalidateQueries({
      predicate: (query) => {
        const [scope, kind, workspaceId, memoryId] = query.queryKey;
        return (
          scope === 'workspace' &&
          kind === 'memory-detail' &&
          workspaceId === session.workspaceId &&
          typeof memoryId === 'string' &&
          memoryId !== target.memoryId
        );
      },
    });
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
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    if (currentMemoryId) {
      openRecording({ kind: 'existing-memory', memoryId: currentMemoryId });
      return;
    }

    openMemoryCreateDialog({ afterCreate: 'record-memory' });
  }

  function requestStartNote() {
    if (blockWorkspaceFlowInterruption() || !currentMemoryId) {
      return;
    }

    setNoteEditorFlow({
      status: 'active',
      open: true,
      target: {
        kind: 'segment',
        memoryId: currentMemoryId,
        title: `笔记${(currentMemory?.noteSegmentCount ?? 0) + 1}`,
      },
    });
  }

  function requestStartSegmentSupplementRecording(target: {
    readonly memoryId: string;
    readonly segmentId: string;
    readonly title: string;
  }) {
    if (blockWorkspaceFlowInterruption()) {
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

  function requestStartSegmentSupplementNote(target: {
    readonly memoryId: string;
    readonly segmentId: string;
    readonly title: string;
  }) {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    setSelectedMemoryId(target.memoryId);
    setNoteEditorFlow({
      status: 'active',
      open: true,
      target: {
        kind: 'segment-supplement',
        memoryId: target.memoryId,
        segmentId: target.segmentId,
        title: target.title,
      },
    });
  }

  function handleRecordingContentSaved({
    expectedSession,
    memory,
    memoryId,
    segmentId,
  }: SavedRecordingContent & { readonly expectedSession?: WorkspaceSession }) {
    const session = expectedSession ?? activeWorkspaceSession;
    if (!workspaceSessionMatches(session)) {
      return;
    }

    const snapshotQueryKey = workspaceSnapshotQueryKey(session);
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) =>
        mergeMemoryIntoSession(
          {
            ...session,
            snapshot: currentSnapshot ?? session.snapshot,
          },
          memory
        ).snapshot
    );
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(
      memoryDetailQueryKey({
        workspaceId: session.workspaceId,
        memoryId,
      }),
      (currentDetail) => {
        if (
          !currentDetail ||
          currentDetail.detail.workspaceId !== session.workspaceId ||
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
                    lastTranscriptionAttempt: 'success' as const,
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
        workspaceId: session.workspaceId,
        memoryId,
        segmentId,
      }),
    });
    setSelectedMemoryId(memory.memoryId);
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceHandle === session.workspaceHandle &&
      currentSession.workspaceId === session.workspaceId
        ? mergeMemoryIntoSession(currentSession, memory)
        : currentSession
    );
  }

  async function clearSegmentContent(target: SegmentContentClearTarget) {
    const session = activeWorkspaceSession;
    if (!workspaceSessionMatches(session)) {
      return;
    }
    setSegmentContentClearPending(true);
    try {
      if (target.contentKind === 'transcript') {
        const response = await saveTranscript({
          workspaceHandle: session.workspaceHandle,
          memoryId: target.memoryId,
          segmentId: target.segment.segmentId,
          markdown: '',
          baselineTiptapContentHash: target.baselineTiptapContentHash,
          baselineTranscriptHash: target.baselineTranscriptHash,
        });
        if (!workspaceSessionMatches(session)) {
          return;
        }
        if (!response.ok) {
          toast.error('无法清空转录。', {
            description: workspaceErrorDisplayMessage(response.error, '无法清空转录。'),
          });
          return;
        }
        handleRecordingContentSaved({
          expectedSession: session,
          memory: response.value.memory,
          memoryId: target.memoryId,
          segmentId: target.segment.segmentId,
        });
        setSegmentContentClearTarget(null);
        return;
      }

      const result = await saveFinalizedNoteSegmentContent({
        workspaceSession: session,
        memoryId: target.memoryId,
        segmentId: target.segment.segmentId,
        title: target.segment.title,
        bodyMarkdown: '',
        baselineContentHash: target.baselineContentHash,
      });
      if (!workspaceSessionMatches(session)) {
        return;
      }
      if (!result.ok) {
        toast.error('无法清空正文。', {
          description:
            result.kind === 'conflict' ? '磁盘内容已变化，请重新打开后再清空。' : result.message,
        });
        return;
      }
      handleNoteSegmentContentSaved(result.saved);
      setSegmentContentClearTarget(null);
    } catch (error) {
      toast.error(target.contentKind === 'transcript' ? '无法清空转录。' : '无法清空正文。', {
        description: unknownErrorDisplayMessage(
          error,
          target.contentKind === 'transcript' ? '无法清空转录。' : '无法清空正文。'
        ),
      });
    } finally {
      setSegmentContentClearPending(false);
    }
  }

  function selectMemory(memoryId: string) {
    if (blockWorkspaceFlowInterruption()) {
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

  function handleNoteEditorOpenChange(nextOpen: boolean) {
    setNoteEditorFlow((currentFlow) =>
      currentFlow.status === 'active' ? { ...currentFlow, open: nextOpen } : currentFlow
    );
  }

  function handleNoteEditorExitAnimationEnd() {
    setNoteEditorFlow((currentFlow) =>
      currentFlow.status === 'active' && !currentFlow.open ? { status: 'closed' } : currentFlow
    );
  }

  function handleRecordingFlowSettled() {
    setRecordingFlow({ status: 'closed' });
  }

  if (appMode === 'settings') {
    return (
      <>
        <ReoToaster themeMode={effectiveTheme} />
        {settingsContent}
        {workspaceDialogs}
      </>
    );
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
              onDeleteMemory={openMemoryDeleteDialog}
              onRenameMemory={setMemoryRenameTarget}
              onRenameMemorySpace={() =>
                openMemorySpaceRenameDialog({
                  workspaceId: activeWorkspaceSession.workspaceId,
                  title: activeWorkspaceSession.snapshot.title,
                })
              }
              onRemoveMemorySpace={() =>
                openMemorySpaceRemoveDialog({
                  workspaceId: activeWorkspaceSession.workspaceId,
                  title: activeWorkspaceSession.snapshot.title,
                })
              }
              onStartNote={requestStartNote}
              onStartRecording={requestStartRecording}
              onToggleMemoryRail={toggleMemoryRail}
              title={activeWorkspaceSession.snapshot.title}
              workspaceHandle={activeWorkspaceSession.workspaceHandle}
              workspaceId={activeWorkspaceSession.workspaceId}
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
            onClearSegmentContent={setSegmentContentClearTarget}
            onSegmentTranscriptSaved={handleRecordingContentSaved}
            onSegmentSupplementTranscriptSaved={handleSegmentSupplementTranscriptSaved}
            onInlineMarkdownDirtyChange={setMemoryStudioInlineMarkdownDirty}
            onNoteSegmentContentSaved={handleNoteSegmentContentSaved}
            onNoteSegmentSupplementContentSaved={handleNoteSegmentSupplementContentSaved}
            onSegmentFocusConsumed={(segmentId) => {
              setSegmentFocusIntent((currentIntent) =>
                currentIntent?.segmentId === segmentId ? null : currentIntent
              );
            }}
            onSelectMemory={selectMemory}
            onRenameMemory={setMemoryRenameTarget}
            onRenameSegmentContent={setSegmentContentRenameTarget}
            onRenameSegment={setSegmentRenameTarget}
            onRenameSegmentSupplement={setSegmentSupplementRenameTarget}
            transcriptionBackfill={memoryStudioTranscriptionBackfill}
            expressionDockVisible={recordingTarget === null && !noteEditorBlocking}
            onStartNote={requestStartNote}
            onStartSegmentSupplementNote={requestStartSegmentSupplementNote}
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
      {noteEditorTarget ? (
        <NoteEditorOverlay
          onNoteSegmentFinalized={handleNoteSegmentFinalized}
          onExitAnimationEnd={handleNoteEditorExitAnimationEnd}
          onOpenChange={handleNoteEditorOpenChange}
          onSegmentSupplementNoteFinalized={handleSegmentSupplementNoteFinalized}
          open={noteEditorOpen}
          target={noteEditorTarget}
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
      <SegmentContentRenameDialog
        target={segmentContentRenameTarget}
        onOpenChange={(open) => {
          if (!open) {
            setSegmentContentRenameTarget(null);
          }
        }}
        onSave={saveRenamedSegmentContent}
        open={segmentContentRenameTarget !== null}
      />
      <WorkspaceDangerConfirmDialog
        confirmLabel={segmentContentClearTarget?.contentKind === 'body' ? '清空正文' : '清空转录'}
        description={
          segmentContentClearTarget?.contentKind === 'body'
            ? `清空后会把「${segmentContentClearTarget.currentTitle}」保存为空，不会删除文件或附件。确认后需要手动重新输入内容。`
            : '清空后会把转录保存为空，不会删除录音文件。确认后需要手动重新输入或重新生成转录。'
        }
        disabled={segmentContentClearPending}
        onConfirm={() => {
          if (segmentContentClearTarget) {
            void clearSegmentContent(segmentContentClearTarget);
          }
        }}
        onOpenChange={(open) => {
          if (!open && !segmentContentClearPending) {
            setSegmentContentClearTarget(null);
          }
        }}
        open={segmentContentClearTarget !== null}
        title={segmentContentClearTarget?.contentKind === 'body' ? '清空正文？' : '清空转录？'}
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

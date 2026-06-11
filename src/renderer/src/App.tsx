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
import { ReoToaster, showReoToast } from './components/ui/toaster';
import type { VoiceSpeechSynthesisSpeaker } from './voiceSpeechSynthesisSpeakers';
import {
  devWorkspaceScenarioMemorySpaceId,
  readAutoOpenDevWorkspaceScenarioName,
} from './devWorkspaceScenario';
import { PermissionGuideDialog } from './onboarding/PermissionGuideDialog';
import {
  clearPermissionRestartRequired,
  markFirstRunGuideSkipped,
  readOnboardingStartupTarget,
  writePermissionRestartRequired,
  type OnboardingStartupTarget,
} from './onboarding/onboardingState';
import { appPermissionFocusLabel } from './app-permissions/PermissionChecklistRow';
import {
  appPermissionStatusQueryOptions,
  patchAppPermissionStatus,
} from './settings/appPermissionQueries';
import { SettingsShell } from './settings/SettingsShell';
import type { SettingsSection } from './settings/SettingsShell';
import { PermissionSettingsPanel } from './settings/PermissionSettingsPanel';
import { VoiceSettingsPanel } from './settings/VoiceSettingsPanel';
import { voiceSettingsQueryOptions } from './settings/voiceSettingsQueries';
import { LoadedWorkspaceFrame } from './workspace/LoadedWorkspaceFrame';
import type {
  ArtifactRuntimeMemorySelectionTarget,
  ArtifactRuntimeObjectSelectionTarget,
} from './workspace/artifactRuntimeBridge';
import type {
  SavedSegmentSupplementTranscriptContent,
  SegmentSpeechSynthesisTarget,
  SegmentSupplementSpeechSynthesisTarget,
  SpeechSynthesisMode,
  SegmentSupplementTranscriptionRetryTarget,
  SegmentTranscriptionRetryTarget,
  TranscriptionBackfillMode,
} from './workspace/MemoryStudio';
import { MemoryCreateDialog } from './workspace/MemoryCreateDialog';
import { MemoryDeleteDialog } from './workspace/MemoryDeleteDialog';
import { EntityMoveDialog, type EntityMoveTargetSelection } from './workspace/EntityMoveDialog';
import { MemoryRenameDialog } from './workspace/MemoryRenameDialog';
import { MemoryTitleDialog } from './workspace/MemoryTitleDialog';
import { WidgetDeleteDialog } from './workspace/WidgetDeleteDialog';
import { WidgetRenameDialog } from './workspace/WidgetRenameDialog';
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
  SegmentCoverResetTarget,
  SegmentDefaultCoverSwitchTarget,
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
import {
  WorkspaceStarterHome,
  type WorkspaceStarterHomeRecentExpression,
} from './workspace/WorkspaceStarterHome';
import { WorkspaceTitlebar } from './workspace/WorkspaceTitlebar';
import { MEMORY_RAIL_TAB, type WorkspaceRailTab } from './workspace/workspaceRailTabs';
import { HOME_RECENT_EXPRESSIONS_COMPONENT_ID } from '../../workspace-contract/workspace-contract';
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
  copyArtifactAgentPrompt,
  copyHomeComponentAgentPrompt,
  copyWidgetAgentPrompt,
  deleteHomeComponent,
  createMemory,
  deleteWidget,
  deleteMemory,
  deleteSegment,
  deleteSegmentSupplement,
  discardRecordingDraft,
  discardSegmentSupplementRecordingDraft,
  finalizeRecordingDraft,
  finalizeSegmentSupplementRecordingDraft,
  listEntityMoveTargets,
  moveMemory,
  moveSegment,
  moveSegmentSupplement,
  onFileTruthChanged,
  onHomeComponentsChanged,
  openWorkspace,
  openMemorySpace,
  openSystemDraftWorkspace,
  readHomeComponentMemoryDetail,
  readWorkspaceSnapshot,
  removeMemorySpace,
  requestAppPermission,
  resetMemoryCover,
  resetSegmentCover,
  requestSegmentSpeechSynthesis,
  requestSegmentSupplementSpeechSynthesis,
  requestSegmentSupplementTranscriptionBackfill,
  requestSegmentTranscriptionBackfill,
  restoreDeletedMemory,
  restoreDeletedHomeComponent,
  restoreDeletedWidget,
  restoreMemoryCover,
  restoreSegmentCover,
  restoreDeletedSegmentSupplement,
  saveSegmentSupplementTranscript,
  saveTranscript,
  switchMemoryDefaultCover,
  switchSegmentDefaultCover,
  updateMemorySpaceTitle,
  updateWidgetTabOrder,
  updateHomeComponentTabOrder,
  updateHomeComponentTitle,
  updateWidgetTitle,
  updateMemoryTitle,
  updateSegmentContentTitle,
  updateSegmentSupplementTitle,
  updateSegmentTitle,
  type EntityMoveTargets,
  type FinalizedAudioSegment,
  type FinalizedNoteSegment,
  type FinalizedSegmentSupplementRecording,
  type FinalizedSegmentSupplementNote,
  type WorkspaceMemoryDetail,
  type WorkspaceMemorySummary,
  type WorkspaceWidgetProjection,
  type WorkspaceHomeComponent,
  type WorkspaceHomeComponentShellState,
  type WorkspaceRecentExpressionItem,
  type WorkspaceNoteSegmentContent,
  type WorkspaceNoteSegmentSupplementContent,
  type WorkspaceError,
  type WorkspaceSession,
  type WorkspaceSystemDraftSession,
  type VoiceTranscriptionSettings,
} from './workspace/workspaceApi';
import {
  resolveNextDefaultCoverTemplateId,
  resolveSegmentCoverImageSource,
} from './workspace/covers/memoryCoverSource';
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
  homeComponentsQueryOptions,
  homeComponentsQueryRootKey,
  recentExpressionsQueryRootKey,
  recentExpressionsQueryOptions,
  seedWorkspaceHandleScopedContentQueries,
  seedWorkspaceSnapshot,
  segmentSupplementContentQueryKey,
  segmentSupplementContentQueryPrefix,
  segmentContentQueryKey,
  systemDraftWorkspaceQueryKey,
  systemDraftWorkspaceQueryOptions,
  workspaceContentQueryBelongsToWorkspace,
  workspacePlaybackAudioQueryBelongsToEntity,
  workspacePlaybackAudioQueryBelongsToWorkspace,
  workspaceProjectionQueryBelongsToWorkspace,
  workspaceSnapshotQueryKey,
} from './workspace/workspaceQueries';

const HOME_RECENT_EXPRESSION_LIMIT = 12;
const LIBRARY_RECENT_EXPRESSION_FETCH_LIMIT = 300;

type WorkspaceView =
  | { readonly name: 'home' }
  | { readonly name: 'workspace-stage' }
  | { readonly name: 'library' };
type AppMode = 'app' | 'settings';
type RequestableAppPermission = Parameters<typeof requestAppPermission>[0]['permission'];

type TopLevelWorkspaceView = Extract<
  WorkspaceView,
  { readonly name: 'home' | 'workspace-stage' | 'library' }
>;
type WorkspaceMemorySpaceListItem = SidebarWorkspaceMemorySpace;
type PendingWorkspaceRelease = {
  readonly errorMessage: string | null;
  readonly promise: Promise<boolean> | null;
  readonly releaseId: symbol;
  readonly session: WorkspaceSession;
};
type WidgetReorderState = {
  readonly workspaceHandle: string;
  readonly workspaceId: string;
  readonly latestStartedMutationId: number;
  readonly latestConfirmedMutationId: number;
  readonly confirmedWidgets: readonly WorkspaceWidgetProjection[];
};
type MemoryCreateIntent =
  | { readonly afterCreate: 'stay-on-stage' }
  | { readonly afterCreate: 'record-memory' }
  | { readonly afterCreate: 'note-memory' }
  | { readonly afterCreate: 'artifact-memory' };
type SegmentFocusIntent = {
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId?: string;
};
type WorkspaceSessionPresentation = 'background' | 'foreground';
type DraftWorkspaceActionSession = WorkspaceSystemDraftSession;
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
type SpeechSynthesisResponse = Awaited<ReturnType<typeof requestSegmentSpeechSynthesis>>;

function memoryCreateDialogDescription(intent: MemoryCreateIntent | null) {
  if (intent?.afterCreate === 'record-memory') {
    return '创建记忆并开始录音';
  }
  if (intent?.afterCreate === 'note-memory') {
    return '创建记忆并开始笔记';
  }
  if (intent?.afterCreate === 'artifact-memory') {
    return '创建记忆并创建作品';
  }

  return '保持简短且易识别';
}

function memoryCreateDialogSubmitLabel(intent: MemoryCreateIntent | null) {
  if (intent?.afterCreate === 'record-memory') {
    return '开始录音';
  }
  if (intent?.afterCreate === 'note-memory') {
    return '开始笔记';
  }
  if (intent?.afterCreate === 'artifact-memory') {
    return '创建作品';
  }

  return '创建';
}

function formatRecentExpressionTime(updatedAt: string) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'numeric',
  }).format(date);
}

function mapRecentExpressionToHomeRow(
  item: WorkspaceRecentExpressionItem
): WorkspaceStarterHomeRecentExpression {
  const playback = item.playback
    ? {
        kind: item.playback.kind,
        ref: {
          workspaceId: item.workspaceId,
          memoryId: item.memoryId,
          segmentId: item.segmentId,
          ...('supplementId' in item ? { supplementId: item.supplementId } : {}),
        },
      }
    : undefined;

  return {
    coverImageSrc: resolveSegmentCoverImageSource({
      segment: { cover: item.cover, segmentId: item.segmentId },
      workspaceId: item.workspaceId,
    }),
    id: item.id,
    ...(playback ? { playback } : {}),
    preview: item.preview?.trim() || `${item.workspaceTitle} / ${item.memoryTitle}`,
    time: formatRecentExpressionTime(item.updatedAt),
    title: item.title,
    type: item.contentKind,
  };
}

function createHomeRuntimeMemoryDetailRequestId(workspaceId: string, memoryId: string) {
  return `home-runtime-memory-detail:${workspaceId}:${memoryId}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}
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
type EntityMoveTarget =
  | {
      readonly type: 'memory';
      readonly memory: WorkspaceMemorySummary;
    }
  | {
      readonly type: 'segment';
      readonly memoryId: string;
      readonly segment: WorkspaceMemoryDetail['segments'][number];
    }
  | {
      readonly type: 'supplement';
      readonly memoryId: string;
      readonly segment: WorkspaceMemoryDetail['segments'][number];
      readonly supplement: WorkspaceMemoryDetail['segments'][number]['supplements'][number];
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
const HOME_VIEW: TopLevelWorkspaceView = { name: 'home' };
const DRAFT_DEFAULT_MEMORY_SYSTEM_ROLE = 'draft-default-memory' satisfies NonNullable<
  WorkspaceMemorySummary['systemRole']
>;
const OPEN_MEMORY_SPACE_ERROR = '无法打开记忆空间。';
const REMOVE_MEMORY_SPACE_ERROR = '无法移除记忆空间。';
const RELEASE_MEMORY_SPACE_ERROR = '当前记忆空间会话未能释放。';
const MEMORY_DELETE_ERROR = '无法删除记忆。';
const MEMORY_RESTORE_ERROR = '无法恢复记忆。';
const MEMORY_COVER_RESET_ERROR = '无法恢复随机默认图片。';
const MEMORY_COVER_RESTORE_ERROR = '无法恢复原封面。';
const MEMORY_DEFAULT_COVER_SWITCH_ERROR = '无法切换随机默认图片。';
const SEGMENT_COVER_RESET_ERROR = '无法恢复随机默认图片。';
const SEGMENT_COVER_RESTORE_ERROR = '无法恢复原封面。';
const SEGMENT_DEFAULT_COVER_SWITCH_ERROR = '无法切换随机默认图片。';
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
const SPEECH_SYNTHESIS_ERROR = '无法生成语音。';
const SPEECH_SYNTHESIS_SUCCESS = '已生成语音';

function segmentBackfillKey(target: SegmentTranscriptionRetryTarget): string {
  return [target.workspaceId, target.memoryId, target.segmentId].join(':');
}

function segmentSupplementBackfillKey(target: SegmentSupplementTranscriptionRetryTarget): string {
  return [target.workspaceId, target.memoryId, target.segmentId, target.supplementId].join(':');
}

function segmentSpeechSynthesisKey(target: SegmentSpeechSynthesisTarget): string {
  return [target.workspaceId, target.memoryId, target.segmentId].join(':');
}

function segmentSupplementSpeechSynthesisKey(
  target: SegmentSupplementSpeechSynthesisTarget
): string {
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
    const [scope, kind, workspaceId] = queryKey;
    if (scope !== 'workspace' || typeof workspaceId !== 'string') {
      return false;
    }

    if (kind === 'memory-detail') {
      const memoryId = queryKey[3];
      if (typeof memoryId !== 'string') {
        return false;
      }
      return protectedMemoryDetailKeys.has(`${workspaceId}:${memoryId}`);
    }

    if (kind === 'segment-content' || kind === 'segment-supplement-content') {
      const memoryId = queryKey[4];
      const segmentId = queryKey[5];
      if (typeof memoryId !== 'string' || typeof segmentId !== 'string') {
        return false;
      }
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
  if (settings.lastTranscriptionValidationCode === 'auth') {
    return 'X-Api-Key 验证失败，请在设置中更新。';
  }
  return null;
}

function voiceSpeechSynthesisDisabledReason({
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
    return '先在设置里启用豆包语音。';
  }
  if (!settings.apiKeyConfigured) {
    return '先在设置里填写 X-Api-Key。';
  }
  if (settings.lastSpeechSynthesisValidationCode === 'auth') {
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

function sameMemoryCover(
  first: WorkspaceMemorySummary['cover'],
  second: WorkspaceMemorySummary['cover']
): boolean {
  const firstCover = first ?? { source: 'default' };
  const secondCover = second ?? { source: 'default' };
  if (firstCover.source !== secondCover.source) {
    return false;
  }
  if (firstCover.source === 'default' && secondCover.source === 'default') {
    return firstCover.templateId === secondCover.templateId;
  }
  if (firstCover.source !== 'custom' || secondCover.source !== 'custom') {
    return false;
  }
  return firstCover.filename === secondCover.filename && firstCover.version === secondCover.version;
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
    first.artifactSegmentCount === second.artifactSegmentCount &&
    first.audioDurationMs === second.audioDurationMs &&
    first.audioByteLength === second.audioByteLength &&
    first.hasAudioTranscript === second.hasAudioTranscript &&
    first.hasAnyNote === second.hasAnyNote &&
    first.supplementCount === second.supplementCount &&
    sameMemoryCover(first.cover, second.cover)
  );
}

function sameWorkspaceWidgetIcon(
  first: WorkspaceWidgetProjection['icon'],
  second: WorkspaceWidgetProjection['icon']
): boolean {
  if (first.source !== second.source) {
    return false;
  }
  if (first.source === 'default' && second.source === 'default') {
    return true;
  }
  if (first.source !== 'custom-mask' || second.source !== 'custom-mask') {
    return false;
  }
  return first.url === second.url && first.version === second.version;
}

function sameWorkspaceWidget(
  first: WorkspaceWidgetProjection,
  second: WorkspaceWidgetProjection
): boolean {
  const sameCommon =
    first.workspaceId === second.workspaceId &&
    first.widgetId === second.widgetId &&
    first.type === second.type &&
    first.format === second.format &&
    first.mount === second.mount &&
    first.title === second.title &&
    first.createdAt === second.createdAt &&
    first.updatedAt === second.updatedAt &&
    sameWorkspaceWidgetIcon(first.icon, second.icon);
  if (!sameCommon) {
    return false;
  }

  if (first.runtimeFault !== undefined || second.runtimeFault !== undefined) {
    return (
      first.runtimeFault !== undefined &&
      second.runtimeFault !== undefined &&
      first.runtimeFault.reason === second.runtimeFault.reason &&
      first.runtimeFault.diagnostic === second.runtimeFault.diagnostic
    );
  }

  return (
    first.entryByteLength === second.entryByteLength &&
    first.entryHash === second.entryHash &&
    first.previewVersion === second.previewVersion
  );
}

function widgetListFromRuntimeMutation(
  value: unknown
): readonly WorkspaceWidgetProjection[] | null {
  return typeof value === 'object' &&
    value !== null &&
    'widgets' in value &&
    Array.isArray((value as { readonly widgets?: unknown }).widgets)
    ? (value as { readonly widgets: readonly WorkspaceWidgetProjection[] }).widgets
    : null;
}

function homeComponentListFromRuntimeMutation(
  value: unknown
): readonly WorkspaceHomeComponent[] | null {
  return typeof value === 'object' &&
    value !== null &&
    'components' in value &&
    Array.isArray((value as { readonly components?: unknown }).components)
    ? (value as { readonly components: readonly WorkspaceHomeComponent[] }).components
    : null;
}

function sameWorkspaceSnapshot(
  first: WorkspaceSession['snapshot'],
  second: WorkspaceSession['snapshot']
): boolean {
  const firstReview = first.review;
  const secondReview = second.review;
  const firstWidgets = first.widgets ?? [];
  const secondWidgets = second.widgets ?? [];
  const sameReview =
    firstReview === secondReview ||
    (firstReview !== undefined &&
      secondReview !== undefined &&
      firstReview.needsReviewCount === secondReview.needsReviewCount &&
      firstReview.markdownCandidateCount === secondReview.markdownCandidateCount &&
      firstReview.tiptapSidecarCount === secondReview.tiptapSidecarCount);
  return (
    first.workspaceId === second.workspaceId &&
    first.title === second.title &&
    first.description === second.description &&
    sameReview &&
    firstWidgets.length === secondWidgets.length &&
    firstWidgets.every((widget, index) => {
      const other = secondWidgets[index];
      return other !== undefined && sameWorkspaceWidget(widget, other);
    }) &&
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
  const [widgetDeleteTarget, setWidgetDeleteTarget] = useState<WorkspaceWidgetProjection | null>(
    null
  );
  const [widgetRenameTarget, setWidgetRenameTarget] = useState<WorkspaceWidgetProjection | null>(
    null
  );
  const [homeComponentDeleteTarget, setHomeComponentDeleteTarget] =
    useState<WorkspaceHomeComponent | null>(null);
  const [homeComponentRenameTarget, setHomeComponentRenameTarget] =
    useState<WorkspaceHomeComponent | null>(null);
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
  const [entityMoveTarget, setEntityMoveTarget] = useState<EntityMoveTarget | null>(null);
  const [entityMoveTargets, setEntityMoveTargets] = useState<EntityMoveTargets | null>(null);
  const [entityMoveLoading, setEntityMoveLoading] = useState(false);
  const [workspaceActionPending, setWorkspaceActionPending] = useState(false);
  const [segmentContentClearPending, setSegmentContentClearPending] = useState(false);
  const [workspaceEntryError, setWorkspaceEntryError] = useState<string | null>(null);
  const [recordingFlow, setRecordingFlow] = useState<RecordingFlow>({ status: 'closed' });
  const [noteEditorFlow, setNoteEditorFlow] = useState<NoteEditorFlow>({ status: 'closed' });
  const [recordingRecoveryActionPending, setRecordingRecoveryActionPending] = useState(false);
  const [recordingRecoveryDraft, setRecordingRecoveryDraft] =
    useState<RecordingRecoveryDraft | null>(null);
  const [shownReviewToastSessionKey, setShownReviewToastSessionKey] = useState<string | null>(null);
  const [runningTranscriptionBackfills, setRunningTranscriptionBackfills] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [runningSpeechSyntheses, setRunningSpeechSyntheses] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [memoryStudioInlineMarkdownDirty, setMemoryStudioInlineMarkdownDirty] = useState(false);
  const [memoryRailInline, setMemoryRailInline] = useState(canShowInlineMemoryRail);
  const [memoryRailOpen, setMemoryRailOpen] = useState(false);
  const [activeWorkspaceRailTab, setActiveWorkspaceRailTab] =
    useState<WorkspaceRailTab>(MEMORY_RAIL_TAB);
  const [widgetRefreshVersions, setWidgetRefreshVersions] = useState<
    Readonly<Record<string, number>>
  >({});
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [activeHomeComponentId, setActiveHomeComponentId] = useState<string>(
    HOME_RECENT_EXPRESSIONS_COMPONENT_ID
  );
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(HOME_VIEW);
  const [appMode, setAppMode] = useState<AppMode>('app');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('voice');
  const [permissionGuideTarget, setPermissionGuideTarget] = useState<OnboardingStartupTarget>(() =>
    readOnboardingStartupTarget()
  );
  const [pendingPermissionRequest, setPendingPermissionRequest] =
    useState<RequestableAppPermission | null>(null);
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
  const entityMoveRequestIdRef = useRef(0);
  const widgetReorderMutationIdRef = useRef(0);
  const widgetReorderStateRef = useRef<WidgetReorderState | null>(null);
  const homeComponentTabMutationIdRef = useRef(0);
  const homeComponentShellStateAppliedRef = useRef(false);
  const homeComponentStoredActiveIdRef = useRef<string | null>(null);
  const homeComponentKnownIdsRef = useRef<ReadonlySet<string>>(new Set());
  const pendingHomeComponentDiscoveryRef = useRef(false);
  const workspaceReleaseRecordsRef = useRef<Map<string, PendingWorkspaceRelease>>(new Map());
  const pendingPermissionRequestRef = useRef<RequestableAppPermission | null>(null);
  const recordingRecoveryActionIdRef = useRef(0);
  const runningTranscriptionBackfillsRef = useRef<Map<string, string>>(new Map());
  const runningSpeechSynthesesRef = useRef<Map<string, string>>(new Map());
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
        const workspaceChanged =
          currentSession?.workspaceHandle !== resolvedSession?.workspaceHandle ||
          currentSession?.workspaceId !== resolvedSession?.workspaceId;
        if (workspaceChanged) {
          setActiveWorkspaceRailTab(MEMORY_RAIL_TAB);
          setWidgetRefreshVersions({});
          widgetReorderStateRef.current = null;
        }
        const currentReviewToastSessionKey = currentSession
          ? `${currentSession.workspaceHandle}:${currentSession.workspaceId}`
          : null;
        const nextReviewToastSessionKey = resolvedSession
          ? `${resolvedSession.workspaceHandle}:${resolvedSession.workspaceId}`
          : null;
        if (currentReviewToastSessionKey !== nextReviewToastSessionKey) {
          setShownReviewToastSessionKey(null);
        }
        workspaceSessionRevisionRef.current += 1;
        for (const [key, workspaceHandle] of runningTranscriptionBackfillsRef.current.entries()) {
          if (!resolvedSession || workspaceHandle !== resolvedSession.workspaceHandle) {
            runningTranscriptionBackfillsRef.current.delete(key);
          }
        }
        setRunningTranscriptionBackfills(new Set(runningTranscriptionBackfillsRef.current.keys()));
        for (const [key, workspaceHandle] of runningSpeechSynthesesRef.current.entries()) {
          if (!resolvedSession || workspaceHandle !== resolvedSession.workspaceHandle) {
            runningSpeechSynthesesRef.current.delete(key);
          }
        }
        setRunningSpeechSyntheses(new Set(runningSpeechSynthesesRef.current.keys()));
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
  const systemDraftWorkspaceQuery = useQuery(systemDraftWorkspaceQueryOptions());
  const recentExpressionsQuery = useQuery(
    recentExpressionsQueryOptions({
      enabled:
        appMode === 'app' &&
        (workspaceView.name === 'home' || workspaceView.name === 'library') &&
        systemDraftWorkspaceQuery.isSuccess,
      limit:
        workspaceView.name === 'library'
          ? LIBRARY_RECENT_EXPRESSION_FETCH_LIMIT
          : HOME_RECENT_EXPRESSION_LIMIT,
      ...(workspaceView.name === 'library' ? { contentKinds: ['audio', 'note'] } : {}),
    })
  );
  const homeComponentsQuery = useQuery(
    homeComponentsQueryOptions({
      enabled: appMode === 'app' && workspaceView.name === 'home',
    })
  );
  const voiceSettingsQuery = useQuery(voiceSettingsQueryOptions());
  const appPermissionStatusQuery = useQuery({
    ...appPermissionStatusQueryOptions(),
    enabled: permissionGuideTarget.kind === 'permission-guide',
  });

  useEffect(() => {
    const data = homeComponentsQuery.data;
    if (!data) {
      return;
    }

    const componentIds = new Set(data.components.map((component) => component.componentId));
    const knownIds = homeComponentKnownIdsRef.current;
    const newlyDiscoveredComponentId = pendingHomeComponentDiscoveryRef.current
      ? data.components.filter((component) => !knownIds.has(component.componentId)).at(-1)
          ?.componentId
      : undefined;
    const storedActiveId = data.shellState.lastActiveComponentId;
    const storedActiveIdIsValid =
      storedActiveId === HOME_RECENT_EXPRESSIONS_COMPONENT_ID ||
      (storedActiveId !== undefined && componentIds.has(storedActiveId));
    const fallbackActiveId =
      storedActiveIdIsValid && storedActiveId !== undefined
        ? storedActiveId
        : HOME_RECENT_EXPRESSIONS_COMPONENT_ID;
    const storedActiveIdChanged =
      homeComponentStoredActiveIdRef.current !== null &&
      homeComponentStoredActiveIdRef.current !== fallbackActiveId;

    setActiveHomeComponentId((currentActiveId) => {
      const currentActiveIdIsValid =
        currentActiveId === HOME_RECENT_EXPRESSIONS_COMPONENT_ID ||
        componentIds.has(currentActiveId);

      if (!homeComponentShellStateAppliedRef.current) {
        homeComponentShellStateAppliedRef.current = true;
        return fallbackActiveId;
      }

      if (newlyDiscoveredComponentId) {
        return newlyDiscoveredComponentId;
      }

      if (storedActiveIdChanged) {
        return fallbackActiveId;
      }

      return currentActiveIdIsValid ? currentActiveId : fallbackActiveId;
    });
    if (newlyDiscoveredComponentId) {
      persistHomeComponentTabState({
        componentTabOrder: data.components.map((component) => component.componentId),
        lastActiveComponentId: newlyDiscoveredComponentId,
        failureTitle: '无法保存主页组件选择',
      });
    }
    homeComponentStoredActiveIdRef.current = fallbackActiveId;
    homeComponentKnownIdsRef.current = componentIds;
    pendingHomeComponentDiscoveryRef.current = false;
  }, [homeComponentsQuery.data, queryClient]);

  useEffect(() => {
    const unsubscribeHomeComponentsChanged = onHomeComponentsChanged(() => {
      pendingHomeComponentDiscoveryRef.current = true;
      void queryClient.invalidateQueries({ queryKey: homeComponentsQueryRootKey() });
    });
    return unsubscribeHomeComponentsChanged;
  }, [queryClient]);

  useEffect(() => {
    if (
      permissionGuideTarget.kind !== 'permission-guide' ||
      permissionGuideTarget.reason !== 'permission-restart-required' ||
      permissionGuideTarget.focusItem === undefined ||
      permissionGuideTarget.focusItem === 'voice' ||
      appPermissionStatusQuery.data?.[permissionGuideTarget.focusItem]?.status !== 'granted'
    ) {
      return;
    }

    clearPermissionRestartRequired(permissionGuideTarget.focusItem);
    setPermissionGuideTarget({ kind: 'app' });
  }, [appPermissionStatusQuery.data, permissionGuideTarget]);
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
  const speechSynthesisDisabledReason = voiceSpeechSynthesisDisabledReason({
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
      if (!matches) {
        setMemoryRailOpen(false);
      }
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
              workspaceProjectionQueryBelongsToWorkspace(
                query.queryKey,
                response.value.workspaceId
              ) &&
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
          workspaceProjectionQueryBelongsToWorkspace(query.queryKey, response.value.workspaceId) &&
          !queryKeyMatchesProtectedPendingDelete(query.queryKey),
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshWorkspaceFromFileTruth({ showError: true });
      }
    }

    const unsubscribeFileTruthChanged = onFileTruthChanged((event) => {
      if (
        event.workspaceHandle !== refreshSession.workspaceHandle ||
        event.workspaceId !== refreshSession.workspaceId
      ) {
        return;
      }
      void refreshWorkspaceFromFileTruth({ showError: false });
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    void refreshWorkspaceFromFileTruth({ showError: false });
    return () => {
      disposed = true;
      unsubscribeFileTruthChanged();
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

  function setReadyWorkspaceSession(
    nextWorkspaceSession: WorkspaceSession,
    selectedMemoryIdOverride?: string,
    options: { readonly presentation?: WorkspaceSessionPresentation } = {}
  ) {
    void queryClient.invalidateQueries({
      predicate: (query) =>
        workspaceContentQueryBelongsToWorkspace(query.queryKey, nextWorkspaceSession.workspaceId),
      refetchType: 'none',
    });
    void queryClient.invalidateQueries({
      predicate: (query) =>
        memoryDetailQueryBelongsToWorkspace(query.queryKey, nextWorkspaceSession.workspaceId),
      refetchType: 'none',
    });
    seedWorkspaceHandleScopedContentQueries(queryClient, nextWorkspaceSession);
    seedWorkspaceSnapshot(queryClient, nextWorkspaceSession);
    if ((options.presentation ?? 'foreground') === 'foreground') {
      setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
    }
    setWorkspaceCreateOpen(false);
    setWorkspaceEntryError(null);
    clearWorkspaceScopedTargets();
    setSelectedMemoryId(
      selectedMemoryIdOverride ?? nextWorkspaceSession.snapshot.memories[0]?.memoryId ?? null
    );
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
    setEntityMoveTarget(null);
    setEntityMoveTargets(null);
    setEntityMoveLoading(false);
    setSegmentFocusIntent(null);
  }

  function setTopLevelWorkspaceView(nextView: TopLevelWorkspaceView) {
    setWorkspaceView((currentView) =>
      currentView.name === nextView.name ? currentView : nextView
    );
  }

  function reportWorkspaceReleaseFailure(message: string, visibleWhileSession?: WorkspaceSession) {
    const currentSession = workspaceSessionRef.current;
    if (
      visibleWhileSession &&
      (currentSession?.workspaceHandle !== visibleWhileSession.workspaceHandle ||
        currentSession.workspaceId !== visibleWhileSession.workspaceId)
    ) {
      return;
    }

    showReoToast({ type: 'error', title: '操作失败', description: message });
  }

  function releasePreviousWorkspaceSession(
    previousSession: WorkspaceSession,
    visibleWhileSession?: WorkspaceSession
  ) {
    const existingRelease = workspaceReleaseRecordsRef.current.get(previousSession.workspaceHandle);
    if (existingRelease?.promise) {
      return existingRelease.promise;
    }

    const releaseId = Symbol(previousSession.workspaceHandle);
    const releasePromise = (async () => {
      let failureMessage: string | null = null;
      try {
        const closePrevious = await closeWorkspace({
          workspaceHandle: previousSession.workspaceHandle,
        });
        if (!closePrevious.ok) {
          failureMessage = workspaceErrorDisplayMessage(
            closePrevious.error,
            RELEASE_MEMORY_SPACE_ERROR
          );
        }
      } catch (error) {
        failureMessage = unknownErrorDisplayMessage(error, RELEASE_MEMORY_SPACE_ERROR);
      }

      const currentRelease = workspaceReleaseRecordsRef.current.get(
        previousSession.workspaceHandle
      );
      if (currentRelease?.releaseId !== releaseId) {
        return failureMessage === null;
      }

      if (failureMessage) {
        workspaceReleaseRecordsRef.current.set(previousSession.workspaceHandle, {
          errorMessage: failureMessage,
          promise: null,
          releaseId,
          session: previousSession,
        });
        reportWorkspaceReleaseFailure(failureMessage, visibleWhileSession);
        return false;
      }

      workspaceReleaseRecordsRef.current.delete(previousSession.workspaceHandle);
      return true;
    })();

    workspaceReleaseRecordsRef.current.set(previousSession.workspaceHandle, {
      errorMessage: null,
      promise: releasePromise,
      releaseId,
      session: previousSession,
    });
    return releasePromise;
  }

  async function retryFailedWorkspaceReleases() {
    const failedReleases = [...workspaceReleaseRecordsRef.current.values()].filter(
      (release) => release.promise === null && release.errorMessage !== null
    );
    for (const release of failedReleases) {
      if (!(await releasePreviousWorkspaceSession(release.session))) {
        return false;
      }
    }
    return true;
  }

  async function waitForWorkspaceReleaseBeforeOpen(workspaceId: string) {
    const matchingReleases = [...workspaceReleaseRecordsRef.current.values()].filter(
      (release) => release.session.workspaceId === workspaceId
    );
    for (const release of matchingReleases) {
      if (release.promise && !(await release.promise)) {
        return false;
      }
      const latestRelease = workspaceReleaseRecordsRef.current.get(release.session.workspaceHandle);
      if (
        latestRelease?.errorMessage &&
        !(await releasePreviousWorkspaceSession(release.session))
      ) {
        return false;
      }
    }
    return true;
  }

  function acceptWorkspaceSession(
    nextWorkspaceSession: WorkspaceSession,
    options: {
      readonly presentation?: WorkspaceSessionPresentation;
      readonly selectedMemoryId?: string;
    } = {}
  ) {
    const currentSession = workspaceSessionRef.current;
    if (currentSession && currentSession.workspaceHandle !== nextWorkspaceSession.workspaceHandle) {
      releasePreviousWorkspaceSession(currentSession, nextWorkspaceSession);
    }

    setRecordingFlow({ status: 'closed' });
    setMemoryCreateIntent(null);
    setMemoryRenameTarget(null);
    setMemorySpaceRenameTarget(null);
    setReadyWorkspaceSession(
      nextWorkspaceSession,
      options.selectedMemoryId,
      options.presentation === undefined ? {} : { presentation: options.presentation }
    );
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
      showReoToast({ type: 'error', title: RECORDING_FLOW_NAVIGATION_BLOCKED });
      return true;
    }
    if (noteEditorBlocking) {
      showReoToast({ type: 'error', title: NOTE_EDITOR_NAVIGATION_BLOCKED });
      return true;
    }
    if (memoryStudioInlineMarkdownDirty) {
      showReoToast({ type: 'error', title: INLINE_MARKDOWN_EDIT_NAVIGATION_BLOCKED });
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
      readonly applySuccess: (value: TValue, session: WorkspaceSession) => void;
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
            showReoToast({
              type: 'error',
              title: TRANSCRIPTION_BACKFILL_ERROR,
              description: workspaceErrorDisplayMessage(
                response.error,
                TRANSCRIPTION_BACKFILL_ERROR
              ),
            });
            return;
          }
          applySuccess(response.value, session);
          showReoToast({ type: 'success', title: TRANSCRIPTION_BACKFILL_SUCCESS });
        } catch (error) {
          showReoToast({
            type: 'error',
            title: TRANSCRIPTION_BACKFILL_ERROR,
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
        applySuccess: (value, session) =>
          handleRecordingContentSavedRef.current({
            expectedSession: session,
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
        applySuccess: (value, session) =>
          handleSegmentSupplementFinalizedRef.current(
            {
              memory: value.memory,
              segment: value.segment,
              supplement: value.supplement,
            },
            { expectedSession: session, refreshContent: true }
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

  const runSpeechSynthesis = useCallback(
    ({
      key,
      refreshContent,
      request,
      workspaceId,
    }: {
      readonly key: string;
      readonly refreshContent: (session: WorkspaceSession) => Promise<unknown>;
      readonly request: (session: WorkspaceSession) => Promise<SpeechSynthesisResponse>;
      readonly workspaceId: string;
    }) => {
      const session = workspaceSessionRef.current;
      if (!session || session.workspaceId !== workspaceId) {
        return Promise.resolve();
      }
      if (runningSpeechSynthesesRef.current.get(key) === session.workspaceHandle) {
        return Promise.resolve();
      }
      runningSpeechSynthesesRef.current.set(key, session.workspaceHandle);
      setRunningSpeechSyntheses((current) => addRunningKey(current, key));
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
            showReoToast({
              type: 'error',
              title: SPEECH_SYNTHESIS_ERROR,
              description: workspaceErrorDisplayMessage(response.error, SPEECH_SYNTHESIS_ERROR),
            });
            return;
          }
          await refreshContent(session);
          showReoToast({ type: 'success', title: SPEECH_SYNTHESIS_SUCCESS });
        } catch (error) {
          showReoToast({
            type: 'error',
            title: SPEECH_SYNTHESIS_ERROR,
            description: unknownErrorDisplayMessage(error, SPEECH_SYNTHESIS_ERROR),
          });
        } finally {
          if (runningSpeechSynthesesRef.current.get(key) === session.workspaceHandle) {
            runningSpeechSynthesesRef.current.delete(key);
            setRunningSpeechSyntheses((current) => removeRunningKey(current, key));
          }
        }
      })();
      return operation;
    },
    [queryClient]
  );

  const requestNoteSegmentSpeechSynthesis = useCallback(
    (
      target: SegmentSpeechSynthesisTarget & {
        readonly mode: SpeechSynthesisMode;
        readonly speaker: VoiceSpeechSynthesisSpeaker;
      }
    ) => {
      return runSpeechSynthesis({
        key: segmentSpeechSynthesisKey(target),
        refreshContent: (session) =>
          queryClient.invalidateQueries({
            exact: true,
            queryKey: segmentContentQueryKey({
              workspaceId: target.workspaceId,
              workspaceHandle: session.workspaceHandle,
              memoryId: target.memoryId,
              segmentId: target.segmentId,
            }),
            refetchType: 'active',
          }),
        request: (session) =>
          requestSegmentSpeechSynthesis({
            workspaceHandle: session.workspaceHandle,
            workspaceId: target.workspaceId,
            memoryId: target.memoryId,
            segmentId: target.segmentId,
            mode: target.mode,
            speaker: target.speaker,
          }),
        workspaceId: target.workspaceId,
      });
    },
    [queryClient, runSpeechSynthesis]
  );

  const requestNoteSupplementSpeechSynthesis = useCallback(
    (
      target: SegmentSupplementSpeechSynthesisTarget & {
        readonly mode: SpeechSynthesisMode;
        readonly speaker: VoiceSpeechSynthesisSpeaker;
      }
    ) => {
      return runSpeechSynthesis({
        key: segmentSupplementSpeechSynthesisKey(target),
        refreshContent: (session) =>
          queryClient.invalidateQueries({
            exact: true,
            queryKey: segmentSupplementContentQueryKey({
              workspaceId: target.workspaceId,
              workspaceHandle: session.workspaceHandle,
              memoryId: target.memoryId,
              segmentId: target.segmentId,
              supplementId: target.supplementId,
            }),
            refetchType: 'active',
          }),
        request: (session) =>
          requestSegmentSupplementSpeechSynthesis({
            workspaceHandle: session.workspaceHandle,
            workspaceId: target.workspaceId,
            memoryId: target.memoryId,
            segmentId: target.segmentId,
            supplementId: target.supplementId,
            mode: target.mode,
            speaker: target.speaker,
          }),
        workspaceId: target.workspaceId,
      });
    },
    [queryClient, runSpeechSynthesis]
  );

  const memoryStudioSpeechSynthesis = useMemo(
    () => ({
      disabledReason: speechSynthesisDisabledReason,
      isSegmentRunning: (target: SegmentSpeechSynthesisTarget) =>
        runningSpeechSyntheses.has(segmentSpeechSynthesisKey(target)),
      isSupplementRunning: (target: SegmentSupplementSpeechSynthesisTarget) =>
        runningSpeechSyntheses.has(segmentSupplementSpeechSynthesisKey(target)),
      requestSegment: requestNoteSegmentSpeechSynthesis,
      requestSupplement: requestNoteSupplementSpeechSynthesis,
    }),
    [
      requestNoteSegmentSpeechSynthesis,
      requestNoteSupplementSpeechSynthesis,
      runningSpeechSyntheses,
      speechSynthesisDisabledReason,
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
      void queryClient.invalidateQueries({
        predicate: (query) =>
          workspaceContentQueryBelongsToWorkspace(query.queryKey, workspaceSession.workspaceId),
        refetchType: 'none',
      });
      queryClient.removeQueries({
        predicate: (query) =>
          workspacePlaybackAudioQueryBelongsToWorkspace(
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
    await navigateTopLevel(HOME_VIEW, '无法返回首页。');
  }

  async function navigateLibrary() {
    await navigateTopLevel(LIBRARY_VIEW, '无法打开画廊。');
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
    showReoToast({ type: 'error', title: '无法移除记忆空间', description: message });
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
          showReoToast({
            type: 'error',
            title: '无法保存记忆空间名称',
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
        showReoToast({
          type: 'error',
          title: '无法保存记忆空间名称',
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

      showReoToast({
        type: 'success',
        title: '已移除记忆空间',
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
      if (!(await waitForWorkspaceReleaseBeforeOpen(workspaceId))) {
        return;
      }
      if (!(await retryFailedWorkspaceReleases())) {
        return;
      }

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

  function workspaceSessionIsSystemDraft(session: WorkspaceSession | null) {
    if (!session) {
      return false;
    }

    return systemDraftWorkspaceQuery.data?.workspaceId === session.workspaceId;
  }

  function defaultDraftMemoryIdForSession(session: WorkspaceSession) {
    if (systemDraftWorkspaceQuery.data?.workspaceId === session.workspaceId) {
      return systemDraftWorkspaceQuery.data.defaultMemoryId;
    }

    return (
      session.snapshot.memories.find(
        (memory) => memory.systemRole === DRAFT_DEFAULT_MEMORY_SYSTEM_ROLE
      )?.memoryId ??
      session.snapshot.memories[0]?.memoryId ??
      null
    );
  }

  async function openSystemDraftWorkspaceAfterActionStarted(
    failureFallback: string,
    options: { readonly presentation?: WorkspaceSessionPresentation } = {}
  ): Promise<DraftWorkspaceActionSession | null> {
    const presentation = options.presentation ?? 'foreground';
    const currentSession = workspaceSessionRef.current;
    if (currentSession && workspaceSessionIsSystemDraft(currentSession)) {
      const draft = systemDraftWorkspaceQuery.data;
      if (!draft) {
        setWorkspaceEntryError('草稿缺少默认记忆。');
        return null;
      }
      const defaultMemoryId = defaultDraftMemoryIdForSession(currentSession);
      if (!defaultMemoryId) {
        setWorkspaceEntryError('草稿缺少默认记忆。');
        return null;
      }

      handleWorkspaceCreateOpenChange(false);
      if (presentation === 'foreground') {
        setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
      }
      setSelectedMemoryId(defaultMemoryId);
      return { ...currentSession, defaultMemoryId, draft };
    }

    setWorkspaceEntryError(null);
    const draftWorkspaceId = systemDraftWorkspaceQuery.data?.workspaceId;
    if (draftWorkspaceId && !(await waitForWorkspaceReleaseBeforeOpen(draftWorkspaceId))) {
      return null;
    }
    if (!(await retryFailedWorkspaceReleases())) {
      return null;
    }

    const response = await openSystemDraftWorkspace();
    if (!response.ok) {
      setWorkspaceEntryError(workspaceErrorDisplayMessage(response.error, failureFallback));
      return null;
    }

    queryClient.setQueryData(systemDraftWorkspaceQueryKey(), response.value.draft);
    acceptWorkspaceSession(response.value, {
      presentation,
      selectedMemoryId: response.value.defaultMemoryId,
    });
    return response.value;
  }

  async function openSystemDraftWorkspaceFromSidebar() {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    if (!beginWorkspaceAction()) {
      return;
    }

    try {
      await openSystemDraftWorkspaceAfterActionStarted('无法打开草稿。');
    } catch (error) {
      setWorkspaceEntryError(unknownErrorDisplayMessage(error, '无法打开草稿。'));
    } finally {
      finishWorkspaceAction();
    }
  }

  async function openSystemDraftWorkspaceForHomeAction() {
    if (blockWorkspaceFlowInterruption()) {
      return null;
    }

    if (!beginWorkspaceAction()) {
      return null;
    }

    try {
      return await openSystemDraftWorkspaceAfterActionStarted('无法打开草稿。', {
        presentation: 'background',
      });
    } catch (error) {
      setWorkspaceEntryError(unknownErrorDisplayMessage(error, '无法打开草稿。'));
      return null;
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
      if (!(await retryFailedWorkspaceReleases())) {
        return;
      }

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
  const currentWorkspaceIsSystemDraft = workspaceSessionIsSystemDraft(workspaceSession);

  useEffect(() => {
    if (!visibleWorkspaceEntryError) {
      lastWorkspaceErrorToastRef.current = null;
      return;
    }

    if (lastWorkspaceErrorToastRef.current === visibleWorkspaceEntryError) {
      return;
    }

    showReoToast({ type: 'error', title: '操作失败', description: visibleWorkspaceEntryError });
    lastWorkspaceErrorToastRef.current = visibleWorkspaceEntryError;
  }, [visibleWorkspaceEntryError]);

  const visibleWorkspaceMemorySpaces: readonly WorkspaceMemorySpaceListItem[] =
    workspaceSession &&
    !currentWorkspaceIsSystemDraft &&
    !memorySpaces.some((memorySpace) => memorySpace.workspaceId === workspaceSession.workspaceId)
      ? [
          {
            workspaceId: workspaceSession.workspaceId,
            title: workspaceSession.snapshot.title,
          },
          ...memorySpaces,
        ]
      : memorySpaces;
  const recentExpressionItems = recentExpressionsQuery.data?.items ?? [];
  const homeRecentExpressions = useMemo(
    () => recentExpressionItems.map(mapRecentExpressionToHomeRow),
    [recentExpressionItems]
  );
  const homeRecentExpressionsStatus =
    systemDraftWorkspaceQuery.isLoading || recentExpressionsQuery.isLoading
      ? 'loading'
      : systemDraftWorkspaceQuery.isError || recentExpressionsQuery.isError
        ? 'error'
        : 'ready';
  const homeComponents = homeComponentsQuery.data?.components ?? [];
  const workspaceSessionResource = workspaceSession;

  function handleOpenRecentExpression(row: WorkspaceStarterHomeRecentExpression) {
    const item = recentExpressionItems.find((candidate) => candidate.id === row.id);
    if (!item) {
      return;
    }

    void openRecentExpression(item);
  }

  async function readHomeRuntimeMemoryDetail({
    memoryId,
    workspaceId,
  }: {
    readonly memoryId: string;
    readonly workspaceId?: string | undefined;
  }): Promise<WorkspaceMemoryDetail> {
    const resolvedWorkspaceId = workspaceId ?? workspaceSessionRef.current?.workspaceId;
    if (!resolvedWorkspaceId) {
      throw new Error('Home component memory detail workspace is unavailable.');
    }
    const requestId = createHomeRuntimeMemoryDetailRequestId(resolvedWorkspaceId, memoryId);
    const response = await readHomeComponentMemoryDetail({
      workspaceId: resolvedWorkspaceId,
      memoryId,
      requestId,
    });
    if (!response.ok) {
      throw new Error(workspaceErrorDisplayMessage(response.error, '记忆内容加载失败。'));
    }
    if (
      response.value.requestId !== requestId ||
      response.value.detail.workspaceId !== resolvedWorkspaceId ||
      response.value.detail.memoryId !== memoryId
    ) {
      throw new Error('Stale home component memory detail response');
    }
    return response.value.detail;
  }

  async function openWorkspaceForHomeRuntimeTarget(
    workspaceId: string | undefined,
    failureCopy: string
  ): Promise<WorkspaceSession | null> {
    const resolvedWorkspaceId = workspaceId ?? workspaceSessionRef.current?.workspaceId;
    if (!resolvedWorkspaceId) {
      return null;
    }
    if (blockWorkspaceFlowInterruption()) {
      return null;
    }
    if (!beginWorkspaceAction()) {
      return null;
    }

    try {
      const currentSession = workspaceSessionRef.current;
      if (resolvedWorkspaceId === systemDraftWorkspaceQuery.data?.workspaceId) {
        return await openSystemDraftWorkspaceAfterActionStarted(failureCopy);
      }
      if (currentSession?.workspaceId === resolvedWorkspaceId) {
        handleWorkspaceCreateOpenChange(false);
        setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
        return currentSession;
      }
      if (!(await waitForWorkspaceReleaseBeforeOpen(resolvedWorkspaceId))) {
        return null;
      }
      if (!(await retryFailedWorkspaceReleases())) {
        return null;
      }

      const response = await openMemorySpace({ workspaceId: resolvedWorkspaceId });
      if (!response.ok) {
        setWorkspaceEntryError(workspaceErrorDisplayMessage(response.error, failureCopy));
        return null;
      }
      await acceptWorkspaceSession(response.value);
      return response.value;
    } catch (error) {
      setWorkspaceEntryError(unknownErrorDisplayMessage(error, failureCopy));
      return null;
    } finally {
      finishWorkspaceAction();
    }
  }

  async function selectHomeRuntimeMemory(
    target: ArtifactRuntimeMemorySelectionTarget
  ): Promise<boolean> {
    const targetSession = await openWorkspaceForHomeRuntimeTarget(
      target.workspaceId,
      '无法打开主页组件目标。'
    );
    if (!targetSession) {
      return false;
    }
    setSelectedMemoryId(target.memoryId);
    return true;
  }

  async function selectHomeRuntimeObject(
    target: ArtifactRuntimeObjectSelectionTarget
  ): Promise<boolean> {
    const targetSession = await openWorkspaceForHomeRuntimeTarget(
      target.workspaceId,
      '无法打开主页组件目标。'
    );
    if (!targetSession) {
      return false;
    }
    setSelectedMemoryId(target.memoryId);
    if (target.segmentId) {
      setSegmentFocusIntent({
        memoryId: target.memoryId,
        segmentId: target.segmentId,
        ...(target.supplementId ? { supplementId: target.supplementId } : {}),
      });
    }
    return true;
  }

  function copyHomeComponentPrompt(
    payload:
      | { readonly action: 'create-home-component' }
      | { readonly action: 'update-home-component'; readonly componentId: string }
  ) {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    void copyHomeComponentAgentPrompt(payload)
      .then((result) => {
        if (!result.ok) {
          showReoToast({
            type: 'error',
            title: '无法复制主页组件提示词',
            description: workspaceErrorDisplayMessage(result.error, '无法复制主页组件提示词。'),
          });
          return;
        }
        showReoToast({
          type: 'success',
          title: '已复制主页组件提示词',
          description:
            payload.action === 'create-home-component'
              ? '交给您的 Agent 后，它会创建 app-level 主页组件文件。'
              : '交给您的 Agent 后，它会更新这个主页组件。',
        });
      })
      .catch((error) => {
        showReoToast({
          type: 'error',
          title: '无法复制主页组件提示词',
          description: unknownErrorDisplayMessage(error, '无法复制主页组件提示词。'),
        });
      });
  }

  function requestCreateHomeComponent() {
    copyHomeComponentPrompt({ action: 'create-home-component' });
  }

  function requestUpdateHomeComponent(component: WorkspaceHomeComponent) {
    copyHomeComponentPrompt({
      action: 'update-home-component',
      componentId: component.componentId,
    });
  }

  function applyHomeComponentListUpdate(
    components: readonly WorkspaceHomeComponent[],
    shellStateOverride?: Partial<WorkspaceHomeComponentShellState>
  ) {
    queryClient.setQueryData<{
      readonly components: readonly WorkspaceHomeComponent[];
      readonly shellState: WorkspaceHomeComponentShellState;
    }>(homeComponentsQueryRootKey(), (current) => {
      const componentIds = new Set(components.map((component) => component.componentId));
      const currentShellState =
        current?.shellState ??
        ({
          componentTabOrder: components.map((component) => component.componentId),
          lastActiveComponentId: activeHomeComponentId ?? HOME_RECENT_EXPRESSIONS_COMPONENT_ID,
        } satisfies WorkspaceHomeComponentShellState);
      const requestedOrder =
        shellStateOverride?.componentTabOrder ?? currentShellState.componentTabOrder;
      const componentTabOrder = [
        ...requestedOrder.filter((componentId) => componentIds.has(componentId)),
        ...components
          .map((component) => component.componentId)
          .filter((componentId) => !requestedOrder.includes(componentId)),
      ];
      const requestedLastActiveComponentId =
        shellStateOverride?.lastActiveComponentId ?? currentShellState.lastActiveComponentId;
      const lastActiveComponentId =
        requestedLastActiveComponentId === HOME_RECENT_EXPRESSIONS_COMPONENT_ID ||
        componentIds.has(requestedLastActiveComponentId)
          ? requestedLastActiveComponentId
          : HOME_RECENT_EXPRESSIONS_COMPONENT_ID;
      return {
        components: [...components],
        shellState: {
          componentTabOrder,
          lastActiveComponentId,
        },
      };
    });
  }

  function handleHomeComponentRuntimeMutation(value: unknown): boolean {
    const components = homeComponentListFromRuntimeMutation(value);
    if (!components) {
      return false;
    }
    applyHomeComponentListUpdate(components);
    return true;
  }

  function persistHomeComponentTabState({
    componentTabOrder,
    failureTitle,
    lastActiveComponentId,
  }: {
    readonly componentTabOrder: readonly string[];
    readonly failureTitle: string;
    readonly lastActiveComponentId: string;
  }) {
    const mutationId = (homeComponentTabMutationIdRef.current += 1);
    void updateHomeComponentTabOrder({
      componentTabOrder: [...componentTabOrder],
      lastActiveComponentId,
    })
      .then((response) => {
        if (mutationId !== homeComponentTabMutationIdRef.current) {
          return;
        }
        if (!response.ok) {
          showReoToast({
            type: 'error',
            title: failureTitle,
            description: workspaceErrorDisplayMessage(response.error, `${failureTitle}。`),
          });
          return;
        }
        queryClient.setQueryData(homeComponentsQueryRootKey(), response.value);
      })
      .catch((error) => {
        if (mutationId !== homeComponentTabMutationIdRef.current) {
          return;
        }
        showReoToast({
          type: 'error',
          title: failureTitle,
          description: unknownErrorDisplayMessage(error, `${failureTitle}。`),
        });
      });
  }

  function selectHomeComponentTab(componentId: string) {
    if (componentId === activeHomeComponentId) {
      return;
    }

    setActiveHomeComponentId(componentId);

    const componentTabOrder = homeComponents.map((component) => component.componentId);
    persistHomeComponentTabState({
      componentTabOrder,
      lastActiveComponentId: componentId,
      failureTitle: '无法保存主页组件选择',
    });
  }

  function closePermissionGuideAsSkipped() {
    markFirstRunGuideSkipped();
    setPermissionGuideTarget({ kind: 'app' });
  }

  function openPermissionGuide(focusItem: RequestableAppPermission) {
    setPermissionGuideTarget({
      kind: 'permission-guide',
      reason: 'action-required',
      focusItem,
    });
  }

  function requestPermissionFromSettings(permission: RequestableAppPermission) {
    void requestPermissionFromGuide(permission);
  }

  async function requestPermissionFromGuide(permission: RequestableAppPermission) {
    if (pendingPermissionRequestRef.current !== null) {
      return;
    }

    pendingPermissionRequestRef.current = permission;
    setPendingPermissionRequest(permission);

    let response: Awaited<ReturnType<typeof requestAppPermission>>;
    try {
      response = await requestAppPermission({ permission });
    } catch (error) {
      showReoToast({
        type: 'error',
        title: `无法请求${appPermissionFocusLabel(permission)}权限`,
        description: unknownErrorDisplayMessage(
          error,
          `无法请求${appPermissionFocusLabel(permission)}权限`
        ),
      });
      return;
    } finally {
      pendingPermissionRequestRef.current = null;
      setPendingPermissionRequest(null);
    }

    if (!response.ok) {
      showReoToast({ type: 'error', title: `无法请求${appPermissionFocusLabel(permission)}权限` });
      return;
    }

    patchAppPermissionStatus(queryClient, response.value.permission, response.value.status);

    if (response.value.restartRequired) {
      writePermissionRestartRequired(permission);
      setPermissionGuideTarget({
        kind: 'permission-guide',
        reason: 'permission-restart-required',
        focusItem: permission,
      });
      return;
    }

    if (response.value.status === 'granted') {
      clearPermissionRestartRequired(permission);
      showReoToast({ type: 'success', title: `${appPermissionFocusLabel(permission)}权限已允许` });
      return;
    }

    setPermissionGuideTarget({
      kind: 'permission-guide',
      reason: 'action-required',
      focusItem: permission,
    });
    showReoToast({
      type: 'warning',
      title: `${appPermissionFocusLabel(permission)}权限未允许`,
      description: '请在系统设置完成后回到 Reo。',
    });
  }

  function openVoiceSettingsFromPermissionGuide() {
    closePermissionGuideAsSkipped();
    openSettingsMode('voice');
  }

  async function ensureMicrophonePermissionForRecording() {
    try {
      const permissions = await queryClient.fetchQuery(appPermissionStatusQueryOptions());
      if (permissions.microphone.status === 'granted') {
        return true;
      }
    } catch {
      // A failed permission read should keep the recording flow out of the system permission path.
    }

    openPermissionGuide('microphone');
    return false;
  }

  const settingsContent = (
    <SettingsShell
      activeSection={settingsSection}
      onSectionChange={setSettingsSection}
      returnDisabled={settingsBusy}
      onReturnToApp={() => {
        if (!settingsBusy) {
          setAppMode('app');
        }
      }}
    >
      {settingsSection === 'permissions' ? (
        <PermissionSettingsPanel
          pendingPermissionRequest={pendingPermissionRequest}
          onRequestPermission={requestPermissionFromSettings}
        />
      ) : (
        <VoiceSettingsPanel
          activeWorkspace={
            workspaceSession
              ? {
                  workspaceHandle: workspaceSession.workspaceHandle,
                  workspaceId: workspaceSession.workspaceId,
                }
              : undefined
          }
          onBusyChange={setSettingsBusy}
        />
      )}
    </SettingsShell>
  );
  function openSettingsMode(section: SettingsSection = 'voice') {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    setSettingsSection(section);
    setAppMode('settings');
  }

  const permissionGuideDialog = (
    <PermissionGuideDialog
      open={permissionGuideTarget.kind === 'permission-guide'}
      pendingPermissionRequest={pendingPermissionRequest}
      permissions={appPermissionStatusQuery.data ?? null}
      startupTarget={permissionGuideTarget}
      voiceSettingsConfigured={voiceSettingsQuery.data?.apiKeyConfigured === true}
      onOpenChange={(open) => {
        if (!open) {
          closePermissionGuideAsSkipped();
        }
      }}
      onOpenVoiceSettings={openVoiceSettingsFromPermissionGuide}
      onRequestPermission={(permission) => {
        void requestPermissionFromGuide(permission);
      }}
      onSkip={closePermissionGuideAsSkipped}
    />
  );

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
    onDraft: () => {
      void openSystemDraftWorkspaceFromSidebar();
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
        onWorkspaceReady={acceptWorkspaceSession}
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
  function renderWorkspaceExpressionOverlays(expressionSession: WorkspaceSession) {
    return (
      <>
        {recordingTarget ? (
          <RecordingOverlay
            onCloseBlockedChange={handleRecordingCloseBlockedChange}
            onRecordingContentSaved={(content) =>
              handleRecordingContentSaved({ ...content, expectedSession: expressionSession })
            }
            onOpenChange={handleRecordingOpenChange}
            onAudioSegmentFinalized={(finalized) =>
              handleAudioSegmentFinalized(finalized, { expectedSession: expressionSession })
            }
            onRecordingFlowSettled={handleRecordingFlowSettled}
            onSegmentSupplementFinalized={(finalized, options) =>
              handleSegmentSupplementFinalized(finalized, {
                ...options,
                expectedSession: expressionSession,
              })
            }
            open={recordingOverlayOpen}
            recoveredDraft={recordingRecoveryReviewDraft}
            recordingTarget={recordingTarget}
            workspaceSession={expressionSession}
          />
        ) : null}
        {noteEditorTarget ? (
          <NoteEditorOverlay
            onNoteSegmentFinalized={(finalized) =>
              handleNoteSegmentFinalized(finalized, expressionSession)
            }
            onExitAnimationEnd={handleNoteEditorExitAnimationEnd}
            onOpenChange={handleNoteEditorOpenChange}
            onSegmentSupplementNoteFinalized={(finalized) =>
              handleSegmentSupplementNoteFinalized(finalized, expressionSession)
            }
            open={noteEditorOpen}
            target={noteEditorTarget}
            workspaceSession={expressionSession}
          />
        ) : null}
      </>
    );
  }

  if (!workspaceSessionResource || workspaceView.name !== 'workspace-stage') {
    if (appMode === 'settings') {
      return (
        <>
          <ReoToaster themeMode={effectiveTheme} />
          {settingsContent}
          {permissionGuideDialog}
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
          {workspaceView.name === 'library' ? (
            <WorkspaceLibraryPage
              expressions={recentExpressionItems}
              expressionsStatus={homeRecentExpressionsStatus}
              skippedCount={recentExpressionsQuery.data?.skipped.length ?? 0}
              onOpenExpression={(expression) => {
                void openRecentExpression(expression);
              }}
            />
          ) : (
            <WorkspaceStarterHome
              activeHomeComponentId={activeHomeComponentId}
              homeComponents={homeComponents}
              homeMemorySpaces={memorySpaces}
              homeRecentExpressionItems={recentExpressionItems}
              onOpenRecentExpression={handleOpenRecentExpression}
              onCreateHomeComponent={requestCreateHomeComponent}
              onDeleteHomeComponent={openHomeComponentDeleteDialog}
              onHomeComponentRuntimeMutation={handleHomeComponentRuntimeMutation}
              onHomeComponentSelectMemory={selectHomeRuntimeMemory}
              onHomeComponentSelectObject={selectHomeRuntimeObject}
              onHomeComponentTabChange={selectHomeComponentTab}
              onRequestHomeComponentAgentUpdate={requestUpdateHomeComponent}
              onRenameHomeComponent={openHomeComponentRenameDialog}
              readHomeComponentMemoryDetail={readHomeRuntimeMemoryDetail}
              onStartArtifact={() => {
                void requestStartDraftArtifactFromHome();
              }}
              onStartNote={() => {
                void requestStartDraftNoteFromHome();
              }}
              onStartRecording={() => {
                void requestStartDraftRecordingFromHome();
              }}
              recentExpressions={homeRecentExpressions}
              recentExpressionsSkippedCount={recentExpressionsQuery.data?.skipped.length ?? 0}
              recentExpressionsStatus={homeRecentExpressionsStatus}
              workspaceSession={workspaceSession}
            />
          )}
        </AppShell>
        {workspaceSessionResource
          ? renderWorkspaceExpressionOverlays(workspaceSessionResource)
          : null}
        {permissionGuideDialog}
        {workspaceDialogs}
      </>
    );
  }
  const activeWorkspaceSession = workspaceSessionResource;
  const currentMemory =
    activeWorkspaceSession.snapshot.memories.find(
      (memory) => memory.memoryId === selectedMemoryId
    ) ??
    activeWorkspaceSession.snapshot.memories[0] ??
    null;
  const currentMemoryId = currentMemory?.memoryId ?? null;
  const workspaceWidgets = activeWorkspaceSession.snapshot.widgets ?? [];
  const effectiveWorkspaceRailTab =
    activeWorkspaceRailTab.kind === 'widget' &&
    !workspaceWidgets.some((widget) => widget.widgetId === activeWorkspaceRailTab.widgetId)
      ? MEMORY_RAIL_TAB
      : activeWorkspaceRailTab;

  function workspaceSessionMatches(expectedSession: WorkspaceSession) {
    const currentSession = workspaceSessionRef.current;
    return (
      currentSession?.workspaceHandle === expectedSession.workspaceHandle &&
      currentSession.workspaceId === expectedSession.workspaceId
    );
  }

  function invalidateRecentExpressions() {
    void queryClient.invalidateQueries({ queryKey: recentExpressionsQueryRootKey() });
  }

  function entityMoveSourcePayload(
    session: WorkspaceSession,
    target: EntityMoveTarget
  ): Parameters<typeof listEntityMoveTargets>[0] {
    if (target.type === 'memory') {
      return {
        workspaceHandle: session.workspaceHandle,
        workspaceId: session.workspaceId,
        sourceType: 'memory',
        memoryId: target.memory.memoryId,
      };
    }
    if (target.type === 'segment') {
      return {
        workspaceHandle: session.workspaceHandle,
        workspaceId: session.workspaceId,
        sourceType: 'segment',
        memoryId: target.memoryId,
        segmentId: target.segment.segmentId,
      };
    }
    return {
      workspaceHandle: session.workspaceHandle,
      workspaceId: session.workspaceId,
      sourceType: 'supplement',
      memoryId: target.memoryId,
      segmentId: target.segment.segmentId,
      supplementId: target.supplement.supplementId,
    };
  }

  function invalidateEntityMoveQueries(sourceWorkspaceId: string, targetWorkspaceId: string) {
    const movedWorkspaceIds =
      sourceWorkspaceId === targetWorkspaceId
        ? [sourceWorkspaceId]
        : [sourceWorkspaceId, targetWorkspaceId];
    void queryClient.invalidateQueries({
      predicate: (query) =>
        movedWorkspaceIds.some((workspaceId) =>
          workspaceProjectionQueryBelongsToWorkspace(query.queryKey, workspaceId)
        ),
      refetchType: 'none',
    });
    queryClient.removeQueries({
      predicate: (query) =>
        movedWorkspaceIds.some((workspaceId) =>
          workspacePlaybackAudioQueryBelongsToWorkspace(query.queryKey, workspaceId)
        ),
    });
    void queryClient.invalidateQueries({ queryKey: memorySpacesQueryKey() });
    invalidateRecentExpressions();
  }

  function showEntityMoveSuccessToast(selection: EntityMoveTargetSelection) {
    const targetMemorySpaceAvailable =
      selection.targetWorkspaceId !== activeWorkspaceSession.workspaceId &&
      memorySpaces.some((memorySpace) => memorySpace.workspaceId === selection.targetWorkspaceId);

    showReoToast({
      type: 'success',
      title: '已移动',
      ...(targetMemorySpaceAvailable
        ? {
            action: {
              label: '打开目标空间',
              onClick: () => {
                void selectMemorySpaceFromSidebar(selection.targetWorkspaceId);
              },
            },
          }
        : {}),
    });
  }

  async function refreshActiveWorkspaceAfterEntityMove(
    session: WorkspaceSession,
    target: EntityMoveTarget,
    selection: EntityMoveTargetSelection
  ) {
    const response = await readWorkspaceSnapshot({
      workspaceHandle: session.workspaceHandle,
    });
    if (!workspaceSessionMatches(session)) {
      return;
    }
    if (!response.ok || response.value.workspaceId !== session.workspaceId) {
      void queryClient.invalidateQueries({
        queryKey: workspaceSnapshotQueryKey(session),
      });
      return;
    }

    const refreshedSession: WorkspaceSession = {
      ...session,
      snapshot: response.value,
    };
    const sameWorkspaceTarget = selection.targetWorkspaceId === session.workspaceId;
    const preferredMemoryId =
      sameWorkspaceTarget && 'targetMemoryId' in selection ? selection.targetMemoryId : null;
    const selectedMemoryStillExists =
      currentMemoryId &&
      response.value.memories.some((memory) => memory.memoryId === currentMemoryId);
    const nextSelectedMemoryId =
      preferredMemoryId &&
      response.value.memories.some((memory) => memory.memoryId === preferredMemoryId)
        ? preferredMemoryId
        : selectedMemoryStillExists
          ? currentMemoryId
          : (response.value.memories[0]?.memoryId ?? null);
    const nextFocusIntent: SegmentFocusIntent | null =
      sameWorkspaceTarget && 'targetMemoryId' in selection && target.type === 'segment'
        ? {
            memoryId: selection.targetMemoryId,
            segmentId: target.segment.segmentId,
          }
        : sameWorkspaceTarget &&
            'targetMemoryId' in selection &&
            'targetSegmentId' in selection &&
            target.type === 'supplement'
          ? {
              memoryId: selection.targetMemoryId,
              segmentId: selection.targetSegmentId,
              supplementId: target.supplement.supplementId,
            }
          : null;

    seedWorkspaceSnapshot(queryClient, refreshedSession);
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceHandle === session.workspaceHandle &&
      currentSession.workspaceId === session.workspaceId
        ? refreshedSession
        : currentSession
    );
    setSelectedMemoryId(nextSelectedMemoryId);
    setSegmentFocusIntent(nextFocusIntent);
  }

  function closeEntityMoveDialog() {
    entityMoveRequestIdRef.current += 1;
    setEntityMoveTarget(null);
    setEntityMoveTargets(null);
    setEntityMoveLoading(false);
  }

  function handleEntityMoveOpenChange(nextOpen: boolean) {
    if (!nextOpen && workspaceActionPending) {
      return;
    }
    if (!nextOpen) {
      closeEntityMoveDialog();
    }
  }

  function openEntityMoveDialog(target: EntityMoveTarget) {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    const session = activeWorkspaceSession;
    const requestId = entityMoveRequestIdRef.current + 1;
    entityMoveRequestIdRef.current = requestId;
    setWorkspaceEntryError(null);
    setWorkspaceCreateOpen(false);
    setMemoryCreateIntent(null);
    setMemoryDeleteTarget(null);
    setMemoryRenameTarget(null);
    setWidgetDeleteTarget(null);
    setWidgetRenameTarget(null);
    setHomeComponentDeleteTarget(null);
    setHomeComponentRenameTarget(null);
    setSegmentDeleteTarget(null);
    setSegmentContentClearTarget(null);
    setSegmentContentRenameTarget(null);
    setSegmentRenameTarget(null);
    setSegmentSupplementDeleteTarget(null);
    setSegmentSupplementRenameTarget(null);
    setMemorySpaceRemoveTarget(null);
    setMemorySpaceRenameTarget(null);
    setEntityMoveTarget(target);
    setEntityMoveTargets(null);
    setEntityMoveLoading(true);

    void (async () => {
      try {
        const response = await listEntityMoveTargets(entityMoveSourcePayload(session, target));
        if (entityMoveRequestIdRef.current !== requestId || !workspaceSessionMatches(session)) {
          return;
        }
        if (!response.ok) {
          closeEntityMoveDialog();
          showReoToast({
            type: 'error',
            title: '无法读取移动目标',
            description: workspaceErrorDisplayMessage(response.error, '无法读取移动目标。'),
          });
          return;
        }
        setEntityMoveTargets(response.value);
      } catch (error) {
        if (entityMoveRequestIdRef.current !== requestId || !workspaceSessionMatches(session)) {
          return;
        }
        closeEntityMoveDialog();
        showReoToast({
          type: 'error',
          title: '无法读取移动目标',
          description: unknownErrorDisplayMessage(error, '无法读取移动目标。'),
        });
      } finally {
        if (entityMoveRequestIdRef.current === requestId) {
          setEntityMoveLoading(false);
        }
      }
    })();
  }

  async function confirmMoveEntity(selection: EntityMoveTargetSelection) {
    const target = entityMoveTarget;
    if (!target || !beginWorkspaceAction()) {
      return;
    }

    const mutationSession = activeWorkspaceSession;
    setEntityMoveLoading(true);
    try {
      const source = entityMoveSourcePayload(mutationSession, target);
      let response:
        | Awaited<ReturnType<typeof moveMemory>>
        | Awaited<ReturnType<typeof moveSegment>>
        | Awaited<ReturnType<typeof moveSegmentSupplement>>;

      if (target.type === 'memory') {
        response = await moveMemory({
          workspaceHandle: mutationSession.workspaceHandle,
          workspaceId: mutationSession.workspaceId,
          memoryId: target.memory.memoryId,
          targetWorkspaceId: selection.targetWorkspaceId,
        });
      } else if (target.type === 'segment') {
        if (!('targetMemoryId' in selection)) {
          return;
        }
        response = await moveSegment({
          workspaceHandle: source.workspaceHandle,
          workspaceId: source.workspaceId,
          memoryId: source.memoryId,
          segmentId: target.segment.segmentId,
          targetWorkspaceId: selection.targetWorkspaceId,
          targetMemoryId: selection.targetMemoryId,
        });
      } else {
        if (!('targetMemoryId' in selection) || !('targetSegmentId' in selection)) {
          return;
        }
        response = await moveSegmentSupplement({
          workspaceHandle: source.workspaceHandle,
          workspaceId: source.workspaceId,
          memoryId: source.memoryId,
          segmentId: target.segment.segmentId,
          supplementId: target.supplement.supplementId,
          targetWorkspaceId: selection.targetWorkspaceId,
          targetMemoryId: selection.targetMemoryId,
          targetSegmentId: selection.targetSegmentId,
        });
      }

      if (!workspaceSessionMatches(mutationSession)) {
        return;
      }
      if (!response.ok && response.error.dataRetention !== 'file-written-index-stale') {
        showReoToast({
          type: 'error',
          title: '移动失败',
          description: workspaceErrorDisplayMessage(response.error, '移动失败。'),
        });
        return;
      }

      invalidateEntityMoveQueries(mutationSession.workspaceId, selection.targetWorkspaceId);
      closeEntityMoveDialog();
      await refreshActiveWorkspaceAfterEntityMove(mutationSession, target, selection);
      if (workspaceSessionMatches(mutationSession)) {
        if (response.ok) {
          showEntityMoveSuccessToast(selection);
        } else {
          showReoToast({
            type: 'error',
            title: '移动后需要刷新',
            description: workspaceErrorDisplayMessage(response.error, '移动后需要刷新。'),
          });
        }
      }
    } catch (error) {
      if (!workspaceSessionMatches(mutationSession)) {
        return;
      }
      showReoToast({
        type: 'error',
        title: '移动失败',
        description: unknownErrorDisplayMessage(error, '移动失败。'),
      });
    } finally {
      if (workspaceSessionMatches(mutationSession)) {
        setEntityMoveLoading(false);
      }
      finishWorkspaceAction();
    }
  }

  function handleAudioSegmentFinalized(
    finalized: FinalizedAudioSegment,
    options: { readonly expectedSession: WorkspaceSession }
  ) {
    const expectedSession = options.expectedSession;
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
    setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
    invalidateRecentExpressions();
  }

  function handleSegmentSupplementFinalized(
    finalized: FinalizedSegmentSupplementRecording,
    options: {
      readonly expectedSession: WorkspaceSession;
      readonly refreshContent?: boolean;
    }
  ) {
    const expectedSession = options.expectedSession;
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
    invalidateRecentExpressions();
    if (options.refreshContent) {
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: segmentSupplementContentQueryKey({
          workspaceId: activeSession.workspaceId,
          workspaceHandle: activeSession.workspaceHandle,
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

  function handleNoteSegmentFinalized(finalized: FinalizedNoteSegment, session: WorkspaceSession) {
    if (!workspaceSessionMatches(session)) {
      return;
    }

    const snapshotQueryKey = workspaceSnapshotQueryKey(session);
    const detailQueryKey = memoryDetailQueryKey({
      workspaceId: session.workspaceId,
      memoryId: finalized.memory.memoryId,
    });
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) =>
        mergeMemoryIntoSession(
          {
            ...session,
            snapshot: currentSnapshot ?? session.snapshot,
          },
          finalized.memory
        ).snapshot
    );
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(detailQueryKey, (currentDetail) =>
      mergeSegmentIntoMemoryDetail(
        currentDetail,
        finalized.memory,
        finalized.segment,
        session.workspaceId
      )
    );
    setSelectedMemoryId(finalized.segment.memoryId);
    setSegmentFocusIntent({
      memoryId: finalized.segment.memoryId,
      segmentId: finalized.segment.segmentId,
    });
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceHandle === session.workspaceHandle &&
      currentSession.workspaceId === session.workspaceId
        ? mergeMemoryIntoSession(currentSession, finalized.memory)
        : currentSession
    );
    setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: segmentContentQueryKey({
        workspaceId: session.workspaceId,
        workspaceHandle: session.workspaceHandle,
        memoryId: finalized.segment.memoryId,
        segmentId: finalized.segment.segmentId,
      }),
    });
    invalidateRecentExpressions();
  }

  function handleNoteSegmentContentSaved(saved: SavedNoteSegmentContent) {
    const session = saved.expectedSession;
    if (!workspaceSessionMatches(session)) {
      return;
    }

    queryClient.setQueryData<WorkspaceNoteSegmentContent | undefined>(
      segmentContentQueryKey({
        workspaceId: session.workspaceId,
        workspaceHandle: session.workspaceHandle,
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
        workspaceHandle: session.workspaceHandle,
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

  function handleSegmentSupplementNoteFinalized(
    finalized: FinalizedSegmentSupplementNote,
    session: WorkspaceSession
  ) {
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
          finalized.memory
        ).snapshot
    );
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(
      memoryDetailQueryKey({
        workspaceId: session.workspaceId,
        memoryId: finalized.memory.memoryId,
      }),
      (currentDetail) =>
        mergeSegmentIntoMemoryDetail(
          currentDetail,
          finalized.memory,
          finalized.segment,
          session.workspaceId
        )
    );
    setSelectedMemoryId(finalized.memory.memoryId);
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceHandle === session.workspaceHandle &&
      currentSession.workspaceId === session.workspaceId
        ? mergeMemoryIntoSession(currentSession, finalized.memory)
        : currentSession
    );
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: segmentSupplementContentQueryKey({
        workspaceId: session.workspaceId,
        workspaceHandle: session.workspaceHandle,
        memoryId: finalized.memory.memoryId,
        segmentId: finalized.segment.segmentId,
        supplementId: finalized.supplement.supplementId,
      }),
    });
    invalidateRecentExpressions();
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
            showReoToast({
              type: 'error',
              title: RECORDING_RECOVERY_SAVE_ERROR,
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
            showReoToast({
              type: 'error',
              title: RECORDING_RECOVERY_SAVE_ERROR,
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
              showReoToast({
                type: 'error',
                title: '补充录音已保存，转写暂时无法写入。',
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
            showReoToast({
              type: 'error',
              title: '补充录音已保存，转写暂时无法写入。',
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
        showReoToast({ type: 'success', title: '已保存未完成录音' });
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
          showReoToast({
            type: 'error',
            title: RECORDING_RECOVERY_SAVE_ERROR,
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
            showReoToast({
              type: 'error',
              title: '录音已保存，转写暂时无法写入。',
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
          showReoToast({
            type: 'error',
            title: '录音已保存，转写暂时无法写入。',
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
      showReoToast({ type: 'success', title: '已保存未完成录音' });
    } catch (error) {
      if (!recoveryActionIsCurrent()) {
        return;
      }
      showReoToast({
        type: 'error',
        title: RECORDING_RECOVERY_SAVE_ERROR,
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
        showReoToast({ type: 'success', title: '已关闭录音恢复提示' });
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
        showReoToast({
          type: 'error',
          title: RECORDING_RECOVERY_DISCARD_ERROR,
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
      showReoToast({ type: 'success', title: '已放弃未完成录音' });
    } catch (error) {
      if (!recoveryActionIsCurrent()) {
        return;
      }
      showReoToast({
        type: 'error',
        title: RECORDING_RECOVERY_DISCARD_ERROR,
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
      } else if (memoryCreateIntent?.afterCreate === 'note-memory') {
        setMemoryCreateIntent(null);
        setWorkspaceView(WORKSPACE_STAGE_VIEW);
        openNoteEditorForMemory(response.value.memoryId, 1);
      } else if (memoryCreateIntent?.afterCreate === 'artifact-memory') {
        setMemoryCreateIntent(null);
        setWorkspaceView(WORKSPACE_STAGE_VIEW);
        await copyArtifactSegmentPromptForMemory(mutationSession, response.value.memoryId);
      } else {
        setWorkspaceView(WORKSPACE_STAGE_VIEW);
        showReoToast({ type: 'success', title: '已新建记忆' });
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
          showReoToast({
            type: 'error',
            title: '无法保存记忆名称',
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
        showReoToast({
          type: 'error',
          title: '无法保存记忆名称',
          description: unknownErrorDisplayMessage(error, '无法重命名记忆。'),
        });
      }
    })();

    return null;
  }

  async function saveRenamedWidget(widget: WorkspaceWidgetProjection, title: string) {
    const nextTitle = title.trim();
    if (nextTitle === widget.title.trim()) {
      return null;
    }

    const mutationSession = activeWorkspaceSession;
    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);
    const snapshotQueryKey = workspaceSnapshotQueryKey(mutationSession);
    const optimisticWidget = { ...widget, title: nextTitle };
    const optimisticWidgets = (mutationSession.snapshot.widgets ?? []).map((candidate) =>
      candidate.widgetId === widget.widgetId ? optimisticWidget : candidate
    );

    setWidgetRenameTarget(null);
    applyWidgetListUpdate(optimisticWidgets, mutationSession);

    void (async () => {
      const rollback = () => {
        queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
          snapshotQueryKey,
          (currentSnapshot) => ({
            ...(currentSnapshot ?? mutationSession.snapshot),
            widgets: (currentSnapshot?.widgets ?? mutationSession.snapshot.widgets ?? []).map(
              (candidate) => (candidate.widgetId === widget.widgetId ? widget : candidate)
            ),
          })
        );
        setWorkspaceSession((currentSession) =>
          currentSession?.workspaceHandle === mutationSession.workspaceHandle &&
          currentSession.workspaceId === mutationSession.workspaceId
            ? {
                ...currentSession,
                snapshot: {
                  ...currentSession.snapshot,
                  widgets: (currentSession.snapshot.widgets ?? []).map((candidate) =>
                    candidate.widgetId === widget.widgetId ? widget : candidate
                  ),
                },
              }
            : currentSession
        );
      };

      try {
        const response = await updateWidgetTitle({
          workspaceHandle: mutationSession.workspaceHandle,
          workspaceId: mutationSession.workspaceId,
          widgetId: widget.widgetId,
          title: nextTitle,
        });

        if (!mutationSessionIsActive()) {
          return;
        }

        if (!response.ok) {
          rollback();
          showReoToast({
            type: 'error',
            title: '无法保存 Widget 名称',
            description: workspaceErrorDisplayMessage(response.error, '无法重命名 Widget。'),
          });
          return;
        }

        applyWidgetListUpdate(response.value.widgets, mutationSession);
      } catch (error) {
        if (!mutationSessionIsActive()) {
          return;
        }

        rollback();
        showReoToast({
          type: 'error',
          title: '无法保存 Widget 名称',
          description: unknownErrorDisplayMessage(error, '无法重命名 Widget。'),
        });
      }
    })();

    return null;
  }

  async function saveRenamedHomeComponent(component: WorkspaceHomeComponent, title: string) {
    const nextTitle = title.trim();
    if (nextTitle === component.title.trim()) {
      return null;
    }

    const previousComponents = homeComponents;
    const optimisticComponents = previousComponents.map((candidate) =>
      candidate.componentId === component.componentId
        ? { ...candidate, title: nextTitle }
        : candidate
    );

    setHomeComponentRenameTarget(null);
    applyHomeComponentListUpdate(optimisticComponents);

    void (async () => {
      try {
        const response = await updateHomeComponentTitle({
          componentId: component.componentId,
          title: nextTitle,
        });

        if (!response.ok) {
          applyHomeComponentListUpdate(previousComponents);
          showReoToast({
            type: 'error',
            title: '无法保存主页组件名称',
            description: workspaceErrorDisplayMessage(response.error, '无法重命名主页组件。'),
          });
          return;
        }

        applyHomeComponentListUpdate(response.value.components);
      } catch (error) {
        applyHomeComponentListUpdate(previousComponents);
        showReoToast({
          type: 'error',
          title: '无法保存主页组件名称',
          description: unknownErrorDisplayMessage(error, '无法重命名主页组件。'),
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
          showReoToast({
            type: 'error',
            title: '无法保存片段名称',
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
        showReoToast({
          type: 'error',
          title: '无法保存片段名称',
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
          showReoToast({
            type: 'error',
            title: '无法保存内容名称',
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
        showReoToast({
          type: 'error',
          title: '无法保存内容名称',
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
          showReoToast({
            type: 'error',
            title: '无法保存补充内容名称',
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
        showReoToast({
          type: 'error',
          title: '无法保存补充内容名称',
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

  function applyWidgetListUpdate(
    widgets: readonly WorkspaceWidgetProjection[],
    session: WorkspaceSession = activeWorkspaceSession
  ) {
    const snapshotQueryKey = workspaceSnapshotQueryKey(session);
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) => ({
        ...(currentSnapshot ?? session.snapshot),
        widgets: [...widgets],
      })
    );
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceHandle === session.workspaceHandle &&
      currentSession.workspaceId === session.workspaceId
        ? {
            ...currentSession,
            snapshot: {
              ...currentSession.snapshot,
              widgets: [...widgets],
            },
          }
        : currentSession
    );
  }

  function handleWidgetRuntimeMutation(value: unknown): boolean {
    const widgets = widgetListFromRuntimeMutation(value);
    if (!widgets) {
      return false;
    }
    applyWidgetListUpdate(widgets, activeWorkspaceSession);
    return true;
  }

  function applySegmentCoverUpdate({
    memory,
    segment,
    session,
  }: {
    readonly memory: WorkspaceMemorySummary;
    readonly segment: WorkspaceMemoryDetail['segments'][number];
    readonly session: WorkspaceSession;
  }) {
    const snapshotQueryKey = workspaceSnapshotQueryKey(session);
    const detailQueryKey = memoryDetailQueryKey({
      workspaceId: session.workspaceId,
      memoryId: memory.memoryId,
    });
    queryClient.setQueryData<WorkspaceSession['snapshot'] | undefined>(
      snapshotQueryKey,
      (currentSnapshot) => mergeMemoryIntoSnapshot(currentSnapshot ?? session.snapshot, memory)
    );
    queryClient.setQueryData<MemoryDetailQueryData | undefined>(detailQueryKey, (currentDetail) =>
      mergeSegmentIntoMemoryDetail(currentDetail, memory, segment, session.workspaceId)
    );
    setWorkspaceSession((currentSession) =>
      currentSession?.workspaceHandle === session.workspaceHandle &&
      currentSession.workspaceId === session.workspaceId
        ? mergeMemoryIntoSession(currentSession, memory)
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
    setWidgetDeleteTarget(null);
    setWidgetRenameTarget(null);
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

  function openWidgetRenameDialog(widget: WorkspaceWidgetProjection) {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    setWorkspaceEntryError(null);
    setWorkspaceCreateOpen(false);
    setMemoryCreateIntent(null);
    setMemoryDeleteTarget(null);
    setMemoryRenameTarget(null);
    setWidgetDeleteTarget(null);
    setWidgetRenameTarget(widget);
    setHomeComponentDeleteTarget(null);
    setHomeComponentRenameTarget(null);
    setSegmentDeleteTarget(null);
    setSegmentRenameTarget(null);
    setSegmentSupplementDeleteTarget(null);
    setSegmentSupplementRenameTarget(null);
    setMemorySpaceRemoveTarget(null);
  }

  function openWidgetDeleteDialog(widget: WorkspaceWidgetProjection) {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    setWorkspaceEntryError(null);
    setWorkspaceCreateOpen(false);
    setMemoryCreateIntent(null);
    setMemoryDeleteTarget(null);
    setMemoryRenameTarget(null);
    setWidgetRenameTarget(null);
    setHomeComponentDeleteTarget(null);
    setHomeComponentRenameTarget(null);
    setSegmentDeleteTarget(null);
    setSegmentRenameTarget(null);
    setSegmentSupplementDeleteTarget(null);
    setSegmentSupplementRenameTarget(null);
    setMemorySpaceRemoveTarget(null);
    setWidgetDeleteTarget(widget);
  }

  function openHomeComponentRenameDialog(component: WorkspaceHomeComponent) {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    setWorkspaceEntryError(null);
    setWorkspaceCreateOpen(false);
    setMemoryCreateIntent(null);
    setMemoryDeleteTarget(null);
    setMemoryRenameTarget(null);
    setWidgetDeleteTarget(null);
    setWidgetRenameTarget(null);
    setHomeComponentDeleteTarget(null);
    setHomeComponentRenameTarget(component);
    setSegmentDeleteTarget(null);
    setSegmentRenameTarget(null);
    setSegmentSupplementDeleteTarget(null);
    setSegmentSupplementRenameTarget(null);
    setMemorySpaceRemoveTarget(null);
  }

  function openHomeComponentDeleteDialog(component: WorkspaceHomeComponent) {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    setWorkspaceEntryError(null);
    setWorkspaceCreateOpen(false);
    setMemoryCreateIntent(null);
    setMemoryDeleteTarget(null);
    setMemoryRenameTarget(null);
    setWidgetDeleteTarget(null);
    setWidgetRenameTarget(null);
    setHomeComponentRenameTarget(null);
    setSegmentDeleteTarget(null);
    setSegmentRenameTarget(null);
    setSegmentSupplementDeleteTarget(null);
    setSegmentSupplementRenameTarget(null);
    setMemorySpaceRemoveTarget(null);
    setHomeComponentDeleteTarget(component);
  }

  function handleHomeComponentDeleteOpenChange(nextOpen: boolean) {
    if (!nextOpen && workspaceActionPending) {
      return;
    }

    if (!nextOpen) {
      setHomeComponentDeleteTarget(null);
    }
  }

  function handleWidgetDeleteOpenChange(nextOpen: boolean) {
    if (!nextOpen && workspaceActionPending) {
      return;
    }

    if (!nextOpen) {
      setWidgetDeleteTarget(null);
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
    setWidgetDeleteTarget(null);
    setWidgetRenameTarget(null);
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
    setWidgetDeleteTarget(null);
    setWidgetRenameTarget(null);
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
        showReoToast({
          type: 'error',
          title: MEMORY_RESTORE_ERROR,
          description: workspaceErrorDisplayMessage(response.error, MEMORY_RESTORE_ERROR),
        });
        return;
      }

      applyMemoryListUpdate(response.value.memories, mutationSession);
      setSelectedMemoryId(response.value.memory.memoryId);
      showReoToast({ type: 'success', title: '已恢复记忆' });
    } catch (error) {
      if (!mutationSessionIsActive()) {
        return;
      }

      showReoToast({
        type: 'error',
        title: MEMORY_RESTORE_ERROR,
        description: unknownErrorDisplayMessage(error, MEMORY_RESTORE_ERROR),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  async function restoreMemoryCoverFromUndo(memoryId: string, restoreToken: string) {
    if (!beginWorkspaceAction()) {
      return;
    }

    const mutationSession = activeWorkspaceSession;
    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);

    try {
      const response = await restoreMemoryCover({
        workspaceHandle: mutationSession.workspaceHandle,
        memoryId,
        restoreToken,
      });

      if (!mutationSessionIsActive()) {
        return;
      }

      if (!response.ok) {
        showReoToast({
          type: 'error',
          title: MEMORY_COVER_RESTORE_ERROR,
          description: workspaceErrorDisplayMessage(response.error, MEMORY_COVER_RESTORE_ERROR),
        });
        return;
      }

      applyMemoryListUpdate(response.value.memories, mutationSession);
      showReoToast({ type: 'success', title: '已恢复原封面' });
    } catch (error) {
      if (!mutationSessionIsActive()) {
        return;
      }

      showReoToast({
        type: 'error',
        title: MEMORY_COVER_RESTORE_ERROR,
        description: unknownErrorDisplayMessage(error, MEMORY_COVER_RESTORE_ERROR),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  async function resetMemoryCoverToDefault(memory: WorkspaceMemorySummary) {
    if (!beginWorkspaceAction()) {
      return;
    }

    const mutationSession = activeWorkspaceSession;
    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);

    try {
      const response = await resetMemoryCover({
        workspaceHandle: mutationSession.workspaceHandle,
        memoryId: memory.memoryId,
      });

      if (!mutationSessionIsActive()) {
        return;
      }

      if (!response.ok) {
        showReoToast({
          type: 'error',
          title: MEMORY_COVER_RESET_ERROR,
          description: workspaceErrorDisplayMessage(response.error, MEMORY_COVER_RESET_ERROR),
        });
        return;
      }

      applyMemoryListUpdate(response.value.memories, mutationSession);
      showReoToast({
        title: '已恢复随机默认图片',
        description: memory.title,
        undo: {
          onUndo: () => {
            void restoreMemoryCoverFromUndo(memory.memoryId, response.value.restoreToken);
          },
        },
      });
    } catch (error) {
      if (!mutationSessionIsActive()) {
        return;
      }

      showReoToast({
        type: 'error',
        title: MEMORY_COVER_RESET_ERROR,
        description: unknownErrorDisplayMessage(error, MEMORY_COVER_RESET_ERROR),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  async function switchMemoryDefaultCoverTemplate(memory: WorkspaceMemorySummary) {
    if (memory.cover?.source === 'custom') {
      return;
    }
    if (!beginWorkspaceAction()) {
      return;
    }

    const mutationSession = activeWorkspaceSession;
    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);
    const templateId = resolveNextDefaultCoverTemplateId({
      currentTemplateId: memory.cover?.source === 'default' ? memory.cover.templateId : undefined,
      entityId: memory.memoryId,
    });

    try {
      const response = await switchMemoryDefaultCover({
        workspaceHandle: mutationSession.workspaceHandle,
        memoryId: memory.memoryId,
        templateId,
      });

      if (!mutationSessionIsActive()) {
        return;
      }

      if (!response.ok) {
        showReoToast({
          type: 'error',
          title: MEMORY_DEFAULT_COVER_SWITCH_ERROR,
          description: workspaceErrorDisplayMessage(
            response.error,
            MEMORY_DEFAULT_COVER_SWITCH_ERROR
          ),
        });
        return;
      }

      applyMemoryListUpdate(response.value.memories, mutationSession);
      showReoToast({
        type: 'success',
        title: '已切换随机默认图片',
        description: memory.title,
      });
    } catch (error) {
      if (!mutationSessionIsActive()) {
        return;
      }

      showReoToast({
        type: 'error',
        title: MEMORY_DEFAULT_COVER_SWITCH_ERROR,
        description: unknownErrorDisplayMessage(error, MEMORY_DEFAULT_COVER_SWITCH_ERROR),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  async function restoreSegmentCoverFromUndo(
    memoryId: string,
    segmentId: string,
    restoreToken: string
  ) {
    if (!beginWorkspaceAction()) {
      return;
    }

    const mutationSession = activeWorkspaceSession;
    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);

    try {
      const response = await restoreSegmentCover({
        workspaceHandle: mutationSession.workspaceHandle,
        workspaceId: mutationSession.workspaceId,
        memoryId,
        segmentId,
        restoreToken,
      });

      if (!mutationSessionIsActive()) {
        return;
      }

      if (!response.ok) {
        showReoToast({
          type: 'error',
          title: SEGMENT_COVER_RESTORE_ERROR,
          description: workspaceErrorDisplayMessage(response.error, SEGMENT_COVER_RESTORE_ERROR),
        });
        return;
      }

      applySegmentCoverUpdate({
        memory: response.value.memory,
        segment: response.value.segment,
        session: mutationSession,
      });
      showReoToast({ type: 'success', title: '已恢复原封面' });
    } catch (error) {
      if (!mutationSessionIsActive()) {
        return;
      }

      showReoToast({
        type: 'error',
        title: SEGMENT_COVER_RESTORE_ERROR,
        description: unknownErrorDisplayMessage(error, SEGMENT_COVER_RESTORE_ERROR),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  async function resetSegmentCoverToDefault(target: SegmentCoverResetTarget) {
    if (!beginWorkspaceAction()) {
      return;
    }

    const mutationSession = activeWorkspaceSession;
    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);

    try {
      const response = await resetSegmentCover({
        workspaceHandle: mutationSession.workspaceHandle,
        workspaceId: mutationSession.workspaceId,
        memoryId: target.memoryId,
        segmentId: target.segment.segmentId,
      });

      if (!mutationSessionIsActive()) {
        return;
      }

      if (!response.ok) {
        showReoToast({
          type: 'error',
          title: SEGMENT_COVER_RESET_ERROR,
          description: workspaceErrorDisplayMessage(response.error, SEGMENT_COVER_RESET_ERROR),
        });
        return;
      }

      applySegmentCoverUpdate({
        memory: response.value.memory,
        segment: response.value.segment,
        session: mutationSession,
      });
      showReoToast({
        title: '已恢复随机默认图片',
        description: target.segment.title,
        undo: {
          onUndo: () => {
            void restoreSegmentCoverFromUndo(
              target.memoryId,
              target.segment.segmentId,
              response.value.restoreToken
            );
          },
        },
      });
    } catch (error) {
      if (!mutationSessionIsActive()) {
        return;
      }

      showReoToast({
        type: 'error',
        title: SEGMENT_COVER_RESET_ERROR,
        description: unknownErrorDisplayMessage(error, SEGMENT_COVER_RESET_ERROR),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  async function switchSegmentDefaultCoverTemplate(target: SegmentDefaultCoverSwitchTarget) {
    if (target.segment.cover?.source === 'custom') {
      return;
    }
    if (!beginWorkspaceAction()) {
      return;
    }

    const mutationSession = activeWorkspaceSession;
    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);
    const templateId = resolveNextDefaultCoverTemplateId({
      currentTemplateId:
        target.segment.cover?.source === 'default' ? target.segment.cover.templateId : undefined,
      entityId: target.segment.segmentId,
    });

    try {
      const response = await switchSegmentDefaultCover({
        workspaceHandle: mutationSession.workspaceHandle,
        workspaceId: mutationSession.workspaceId,
        memoryId: target.memoryId,
        segmentId: target.segment.segmentId,
        templateId,
      });

      if (!mutationSessionIsActive()) {
        return;
      }

      if (!response.ok) {
        showReoToast({
          type: 'error',
          title: SEGMENT_DEFAULT_COVER_SWITCH_ERROR,
          description: workspaceErrorDisplayMessage(
            response.error,
            SEGMENT_DEFAULT_COVER_SWITCH_ERROR
          ),
        });
        return;
      }

      applySegmentCoverUpdate({
        memory: response.value.memory,
        segment: response.value.segment,
        session: mutationSession,
      });
      showReoToast({
        type: 'success',
        title: '已切换随机默认图片',
        description: target.segment.title,
      });
    } catch (error) {
      if (!mutationSessionIsActive()) {
        return;
      }

      showReoToast({
        type: 'error',
        title: SEGMENT_DEFAULT_COVER_SWITCH_ERROR,
        description: unknownErrorDisplayMessage(error, SEGMENT_DEFAULT_COVER_SWITCH_ERROR),
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
        showReoToast({
          type: 'error',
          title: MEMORY_DELETE_ERROR,
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
      queryClient.removeQueries({
        predicate: (query) =>
          workspacePlaybackAudioQueryBelongsToEntity(query.queryKey, {
            workspaceId: mutationSession.workspaceId,
            workspaceHandle: mutationSession.workspaceHandle,
            memoryId: target.memoryId,
          }),
      });
      if (selectedMemoryAtRequest === target.memoryId) {
        setSelectedMemoryId(response.value.memories[0]?.memoryId ?? null);
      }
      setMemoryDeleteTarget(null);
      showReoToast({
        title: '已删除记忆',
        description: target.title,
        undo: {
          onUndo: () => {
            void restoreDeletedMemoryFromUndo(response.value.restoreToken);
          },
        },
      });
    } catch (error) {
      if (!mutationSessionIsActive()) {
        return;
      }

      showReoToast({
        type: 'error',
        title: MEMORY_DELETE_ERROR,
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
        showReoToast({
          type: 'error',
          title: SEGMENT_SUPPLEMENT_RESTORE_ERROR,
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
      showReoToast({ type: 'success', title: '已恢复补充内容' });
    } catch (error) {
      if (!restoreSessionIsActive()) {
        return;
      }

      showReoToast({
        type: 'error',
        title: SEGMENT_SUPPLEMENT_RESTORE_ERROR,
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
      workspaceHandle: session.workspaceHandle,
      memoryId: target.memoryId,
      segmentId: target.segment.segmentId,
      supplementId: target.supplement.supplementId,
    });
    const removeDeletedSegmentSupplementCaches = () => {
      queryClient.removeQueries({ exact: true, queryKey: supplementContentKey });
      queryClient.removeQueries({
        predicate: (query) =>
          workspacePlaybackAudioQueryBelongsToEntity(query.queryKey, {
            workspaceId: session.workspaceId,
            workspaceHandle: session.workspaceHandle,
            memoryId: target.memoryId,
            segmentId: target.segment.segmentId,
            supplementId: target.supplement.supplementId,
          }),
      });
    };
    const showDeletedSegmentSupplementToast = (restoreToken: string) => {
      showReoToast({
        title: '已删除补充内容',
        description: target.supplement.title,
        undo: {
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
        },
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
        removeDeletedSegmentSupplementCaches();
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
      removeDeletedSegmentSupplementCaches();
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
        showReoToast({
          type: 'error',
          title: SEGMENT_SUPPLEMENT_DELETE_ERROR,
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
      removeDeletedSegmentSupplementCaches();
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

      showReoToast({
        type: 'error',
        title: SEGMENT_SUPPLEMENT_DELETE_ERROR,
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
      showReoToast({ type: 'error', title: SEGMENT_DELETE_ERROR });
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
          workspaceHandle: session.workspaceHandle,
          memoryId: target.memoryId,
          segmentId: target.segment.segmentId,
        }),
      });
      queryClient.removeQueries({
        queryKey: segmentSupplementContentQueryPrefix({
          workspaceId: session.workspaceId,
          workspaceHandle: session.workspaceHandle,
          memoryId: target.memoryId,
          segmentId: target.segment.segmentId,
        }),
      });
      queryClient.removeQueries({
        predicate: (query) =>
          workspacePlaybackAudioQueryBelongsToEntity(query.queryKey, {
            workspaceId: session.workspaceId,
            workspaceHandle: session.workspaceHandle,
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
          showReoToast({
            type: 'error',
            title: SEGMENT_DELETE_ERROR,
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
        showReoToast({
          type: 'error',
          title: SEGMENT_DELETE_ERROR,
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
    showReoToast({
      title: '已删除片段',
      description: target.segment.title,
      durationMs: SEGMENT_DELETE_UNDO_DURATION_MS,
      undo: {
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
      },
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

  async function requestStartRecording() {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    if (!(await ensureMicrophonePermissionForRecording())) {
      return;
    }

    if (currentMemoryId) {
      openRecording({ kind: 'existing-memory', memoryId: currentMemoryId });
      return;
    }

    openMemoryCreateDialog({ afterCreate: 'record-memory' });
  }

  function openNoteEditorForMemory(memoryId: string, noteIndex: number) {
    setNoteEditorFlow({
      status: 'active',
      open: true,
      target: {
        kind: 'segment',
        memoryId,
        title: `笔记${noteIndex}`,
      },
    });
  }

  function requestStartNote() {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    if (!currentMemoryId) {
      openMemoryCreateDialog({ afterCreate: 'note-memory' });
      return;
    }

    openNoteEditorForMemory(currentMemoryId, (currentMemory?.noteSegmentCount ?? 0) + 1);
  }

  async function copyArtifactSegmentPromptForMemory(session: WorkspaceSession, memoryId: string) {
    try {
      const result = await copyArtifactAgentPrompt({
        workspaceHandle: session.workspaceHandle,
        workspaceId: session.workspaceId,
        action: 'create-segment',
        memoryId,
      });

      if (!result.ok) {
        showReoToast({ type: 'error', title: '无法复制作品提示词' });
        return;
      }

      showReoToast({
        type: 'success',
        title: '已复制作品提示词',
        description: '交给您的 Agent 后，它会在当前记忆中创建作品文件。',
      });
    } catch {
      showReoToast({ type: 'error', title: '无法复制作品提示词' });
    }
  }

  function requestStartArtifact() {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    if (!currentMemoryId) {
      openMemoryCreateDialog({ afterCreate: 'artifact-memory' });
      return;
    }

    void copyArtifactSegmentPromptForMemory(activeWorkspaceSession, currentMemoryId);
  }

  async function requestStartDraftNoteFromHome() {
    const draftSession = await openSystemDraftWorkspaceForHomeAction();
    if (!draftSession) {
      return;
    }

    const defaultMemory = draftSession.snapshot.memories.find(
      (memory) => memory.memoryId === draftSession.defaultMemoryId
    );
    openNoteEditorForMemory(
      draftSession.defaultMemoryId,
      (defaultMemory?.noteSegmentCount ?? 0) + 1
    );
  }

  async function requestStartDraftRecordingFromHome() {
    if (!(await ensureMicrophonePermissionForRecording())) {
      return;
    }

    const draftSession = await openSystemDraftWorkspaceForHomeAction();
    if (!draftSession) {
      return;
    }

    openRecording({ kind: 'existing-memory', memoryId: draftSession.defaultMemoryId });
  }

  async function requestStartDraftArtifactFromHome() {
    const draftSession = await openSystemDraftWorkspaceForHomeAction();
    if (!draftSession) {
      return;
    }

    await copyArtifactSegmentPromptForMemory(draftSession, draftSession.defaultMemoryId);
  }

  async function openRecentExpression(item: WorkspaceRecentExpressionItem) {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    if (!beginWorkspaceAction()) {
      return;
    }

    try {
      let targetSession: WorkspaceSession | null = null;
      const currentSession = workspaceSessionRef.current;
      if (item.workspaceId === systemDraftWorkspaceQuery.data?.workspaceId) {
        targetSession = await openSystemDraftWorkspaceAfterActionStarted('无法打开近期表达。');
      } else if (currentSession?.workspaceId === item.workspaceId) {
        handleWorkspaceCreateOpenChange(false);
        setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
        targetSession = currentSession;
      } else {
        if (!(await waitForWorkspaceReleaseBeforeOpen(item.workspaceId))) {
          return;
        }
        if (!(await retryFailedWorkspaceReleases())) {
          return;
        }

        const response = await openMemorySpace({ workspaceId: item.workspaceId });
        if (!response.ok) {
          setWorkspaceEntryError(
            workspaceErrorDisplayMessage(response.error, '无法打开近期表达。')
          );
          return;
        }
        await acceptWorkspaceSession(response.value);
        targetSession = response.value;
      }

      if (!targetSession) {
        return;
      }

      setSelectedMemoryId(item.memoryId);
      setSegmentFocusIntent({
        memoryId: item.memoryId,
        segmentId: item.segmentId,
        ...(item.objectType === 'supplement' ? { supplementId: item.supplementId } : {}),
      });
    } catch (error) {
      setWorkspaceEntryError(unknownErrorDisplayMessage(error, '无法打开近期表达。'));
    } finally {
      finishWorkspaceAction();
    }
  }

  async function requestStartSegmentSupplementRecording(target: {
    readonly memoryId: string;
    readonly segmentId: string;
    readonly title: string;
  }) {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }

    if (!(await ensureMicrophonePermissionForRecording())) {
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
  }: SavedRecordingContent & { readonly expectedSession: WorkspaceSession }) {
    const session = expectedSession;
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
        workspaceHandle: session.workspaceHandle,
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
          showReoToast({
            type: 'error',
            title: '无法清空转录。',
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
        showReoToast({
          type: 'error',
          title: '无法清空正文。',
          description:
            result.kind === 'conflict' ? '磁盘内容已变化，请重新打开后再清空。' : result.message,
        });
        return;
      }
      handleNoteSegmentContentSaved(result.saved);
      setSegmentContentClearTarget(null);
    } catch (error) {
      showReoToast({
        type: 'error',
        title: target.contentKind === 'transcript' ? '无法清空转录。' : '无法清空正文。',
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
      return false;
    }

    setSelectedMemoryId(memoryId);
    setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
    return true;
  }

  function selectObject(target: ArtifactRuntimeObjectSelectionTarget) {
    if (target.segmentId === undefined) {
      return selectMemory(target.memoryId);
    }
    if (blockWorkspaceFlowInterruption()) {
      return false;
    }

    setSelectedMemoryId(target.memoryId);
    setSegmentFocusIntent({
      memoryId: target.memoryId,
      segmentId: target.segmentId,
      ...(target.supplementId ? { supplementId: target.supplementId } : {}),
    });
    setTopLevelWorkspaceView(WORKSPACE_STAGE_VIEW);
    return true;
  }

  function copyWorkspaceWidgetPrompt(
    payload:
      | { readonly action: 'create-widget' }
      | { readonly action: 'update-widget'; readonly widgetId: string }
  ) {
    void copyWidgetAgentPrompt({
      workspaceHandle: activeWorkspaceSession.workspaceHandle,
      workspaceId: activeWorkspaceSession.workspaceId,
      ...payload,
    })
      .then((result) => {
        if (!result.ok) {
          showReoToast({
            type: 'error',
            title: '无法复制 Widget 提示词',
            description: workspaceErrorDisplayMessage(result.error, '无法复制 Widget 提示词。'),
          });
          return;
        }
        showReoToast({
          type: 'success',
          title: '已复制 Widget 提示词',
          description:
            payload.action === 'create-widget'
              ? '交给您的 Agent 后，它会在当前记忆空间创建 Widget 文件。'
              : '交给您的 Agent 后，它会更新这个 Widget 文件。',
        });
      })
      .catch((error) => {
        showReoToast({
          type: 'error',
          title: '无法复制 Widget 提示词',
          description: unknownErrorDisplayMessage(error, '无法复制 Widget 提示词。'),
        });
      });
  }

  function requestCreateWidget() {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }
    setMemoryRailOpen(true);
    copyWorkspaceWidgetPrompt({ action: 'create-widget' });
  }

  function requestUpdateWidget(widget: WorkspaceWidgetProjection) {
    if (blockWorkspaceFlowInterruption()) {
      return;
    }
    copyWorkspaceWidgetPrompt({ action: 'update-widget', widgetId: widget.widgetId });
  }

  function refreshWidget(widget: WorkspaceWidgetProjection) {
    setWidgetRefreshVersions((current) => ({
      ...current,
      [widget.widgetId]: (current[widget.widgetId] ?? 0) + 1,
    }));
  }

  function reorderWidgets(widgetTabOrder: readonly string[]) {
    const mutationSession = activeWorkspaceSession;
    const mutationId = widgetReorderMutationIdRef.current + 1;
    widgetReorderMutationIdRef.current = mutationId;
    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);
    const existingReorderState = widgetReorderStateRef.current;
    const currentWidgets = mutationSession.snapshot.widgets ?? [];
    const reorderState =
      existingReorderState?.workspaceHandle === mutationSession.workspaceHandle &&
      existingReorderState.workspaceId === mutationSession.workspaceId
        ? {
            ...existingReorderState,
            latestStartedMutationId: mutationId,
          }
        : {
            workspaceHandle: mutationSession.workspaceHandle,
            workspaceId: mutationSession.workspaceId,
            latestStartedMutationId: mutationId,
            latestConfirmedMutationId: 0,
            confirmedWidgets: currentWidgets,
          };
    widgetReorderStateRef.current = reorderState;
    const byId = new Map(currentWidgets.map((widget) => [widget.widgetId, widget]));
    const orderedWidgetIds = new Set<string>();
    const orderedWidgets = [
      ...widgetTabOrder.flatMap((widgetId) => {
        const widget = byId.get(widgetId);
        if (widget) {
          orderedWidgetIds.add(widgetId);
        }
        return widget ? [widget] : [];
      }),
      ...currentWidgets.filter((widget) => !orderedWidgetIds.has(widget.widgetId)),
    ];
    applyWidgetListUpdate(orderedWidgets, mutationSession);

    void (async () => {
      try {
        const response = await updateWidgetTabOrder({
          workspaceHandle: mutationSession.workspaceHandle,
          workspaceId: mutationSession.workspaceId,
          widgetTabOrder: [...widgetTabOrder],
        });

        if (!mutationSessionIsActive()) {
          return;
        }

        const currentReorderState = widgetReorderStateRef.current;
        const reorderStateMatches =
          currentReorderState?.workspaceHandle === mutationSession.workspaceHandle &&
          currentReorderState.workspaceId === mutationSession.workspaceId;

        if (
          response.ok &&
          reorderStateMatches &&
          mutationId > currentReorderState.latestConfirmedMutationId
        ) {
          widgetReorderStateRef.current = {
            ...currentReorderState,
            latestConfirmedMutationId: mutationId,
            confirmedWidgets: response.value.widgets,
          };
        }

        if (widgetReorderMutationIdRef.current !== mutationId) {
          return;
        }

        if (!response.ok) {
          applyWidgetListUpdate(
            reorderStateMatches ? currentReorderState.confirmedWidgets : currentWidgets,
            mutationSession
          );
          widgetReorderStateRef.current = null;
          showReoToast({
            type: 'error',
            title: '无法调整 Widget 顺序',
            description: workspaceErrorDisplayMessage(response.error, '无法调整 Widget 顺序。'),
          });
          return;
        }

        applyWidgetListUpdate(response.value.widgets, mutationSession);
        widgetReorderStateRef.current = null;
      } catch (error) {
        if (!mutationSessionIsActive() || widgetReorderMutationIdRef.current !== mutationId) {
          return;
        }
        const currentReorderState = widgetReorderStateRef.current;
        const reorderStateMatches =
          currentReorderState?.workspaceHandle === mutationSession.workspaceHandle &&
          currentReorderState.workspaceId === mutationSession.workspaceId;
        applyWidgetListUpdate(
          reorderStateMatches ? currentReorderState.confirmedWidgets : currentWidgets,
          mutationSession
        );
        widgetReorderStateRef.current = null;
        showReoToast({
          type: 'error',
          title: '无法调整 Widget 顺序',
          description: unknownErrorDisplayMessage(error, '无法调整 Widget 顺序。'),
        });
      }
    })();
  }

  async function restoreDeletedWidgetFromUndo(
    restoreToken: string,
    mutationSession: WorkspaceSession
  ) {
    if (!beginWorkspaceAction()) {
      return;
    }

    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);

    try {
      const response = await restoreDeletedWidget({
        workspaceHandle: mutationSession.workspaceHandle,
        workspaceId: mutationSession.workspaceId,
        restoreToken,
      });

      if (!mutationSessionIsActive()) {
        return;
      }

      if (!response.ok) {
        showReoToast({
          type: 'error',
          title: '无法恢复 Widget',
          description: workspaceErrorDisplayMessage(response.error, '无法恢复 Widget。'),
        });
        return;
      }

      applyWidgetListUpdate(response.value.widgets, mutationSession);
      setActiveWorkspaceRailTab({ kind: 'widget', widgetId: response.value.widget.widgetId });
      setMemoryRailOpen(true);
      showReoToast({ type: 'success', title: '已恢复 Widget' });
    } catch (error) {
      if (!mutationSessionIsActive()) {
        return;
      }
      showReoToast({
        type: 'error',
        title: '无法恢复 Widget',
        description: unknownErrorDisplayMessage(error, '无法恢复 Widget。'),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  async function confirmDeleteWidget() {
    const target = widgetDeleteTarget;
    if (!target || !beginWorkspaceAction()) {
      return;
    }

    const mutationSession = activeWorkspaceSession;
    const mutationSessionIsActive = () => workspaceSessionMatches(mutationSession);

    try {
      const response = await deleteWidget({
        workspaceHandle: mutationSession.workspaceHandle,
        workspaceId: mutationSession.workspaceId,
        widgetId: target.widgetId,
      });

      if (!mutationSessionIsActive()) {
        return;
      }

      if (!response.ok) {
        showReoToast({
          type: 'error',
          title: '无法删除 Widget',
          description: workspaceErrorDisplayMessage(response.error, '无法删除 Widget。'),
        });
        return;
      }

      applyWidgetListUpdate(response.value.widgets, mutationSession);
      setWidgetDeleteTarget(null);
      if (
        activeWorkspaceRailTab.kind === 'widget' &&
        activeWorkspaceRailTab.widgetId === target.widgetId
      ) {
        setActiveWorkspaceRailTab(MEMORY_RAIL_TAB);
      }
      showReoToast({
        title: '已删除 Widget',
        description: target.title,
        undo: {
          onUndo: () => {
            void restoreDeletedWidgetFromUndo(response.value.restoreToken, mutationSession);
          },
        },
      });
    } catch (error) {
      if (!mutationSessionIsActive()) {
        return;
      }
      showReoToast({
        type: 'error',
        title: '无法删除 Widget',
        description: unknownErrorDisplayMessage(error, '无法删除 Widget。'),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  async function restoreDeletedHomeComponentFromUndo(restoreToken: string) {
    if (!beginWorkspaceAction()) {
      return;
    }

    try {
      const response = await restoreDeletedHomeComponent({ restoreToken });

      if (!response.ok) {
        showReoToast({
          type: 'error',
          title: '无法恢复主页组件',
          description: workspaceErrorDisplayMessage(response.error, '无法恢复主页组件。'),
        });
        return;
      }

      applyHomeComponentListUpdate(response.value.components, {
        componentTabOrder: response.value.components.map((component) => component.componentId),
        lastActiveComponentId: response.value.component.componentId,
      });
      setActiveHomeComponentId(response.value.component.componentId);
      showReoToast({ type: 'success', title: '已恢复主页组件' });
    } catch (error) {
      showReoToast({
        type: 'error',
        title: '无法恢复主页组件',
        description: unknownErrorDisplayMessage(error, '无法恢复主页组件。'),
      });
    } finally {
      finishWorkspaceAction();
    }
  }

  async function confirmDeleteHomeComponent() {
    const target = homeComponentDeleteTarget;
    if (!target || !beginWorkspaceAction()) {
      return;
    }

    try {
      const response = await deleteHomeComponent({ componentId: target.componentId });

      if (!response.ok) {
        showReoToast({
          type: 'error',
          title: '无法删除主页组件',
          description: workspaceErrorDisplayMessage(response.error, '无法删除主页组件。'),
        });
        return;
      }

      const nextActiveComponentId =
        activeHomeComponentId === target.componentId
          ? HOME_RECENT_EXPRESSIONS_COMPONENT_ID
          : activeHomeComponentId;
      applyHomeComponentListUpdate(response.value.components, {
        componentTabOrder: response.value.components.map((component) => component.componentId),
        lastActiveComponentId: nextActiveComponentId ?? HOME_RECENT_EXPRESSIONS_COMPONENT_ID,
      });
      setHomeComponentDeleteTarget(null);
      if (activeHomeComponentId === target.componentId) {
        setActiveHomeComponentId(HOME_RECENT_EXPRESSIONS_COMPONENT_ID);
      }
      showReoToast({
        title: '已删除主页组件',
        description: target.title,
        undo: {
          onUndo: () => {
            void restoreDeletedHomeComponentFromUndo(response.value.restoreToken);
          },
        },
      });
    } catch (error) {
      showReoToast({
        type: 'error',
        title: '无法删除主页组件',
        description: unknownErrorDisplayMessage(error, '无法删除主页组件。'),
      });
    } finally {
      finishWorkspaceAction();
    }
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
        {permissionGuideDialog}
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
        activeSection={currentWorkspaceIsSystemDraft ? 'draft' : 'workspace'}
        panelTitlebar={
          <WorkspaceTitlebar
            activeRailTab={effectiveWorkspaceRailTab}
            currentMemory={currentMemory}
            memorySpaceCapabilities={{
              canRemove: !currentWorkspaceIsSystemDraft,
              canRename: !currentWorkspaceIsSystemDraft,
            }}
            memoryRailOpen={memoryRailOpen}
            onCreateMemory={() => openMemoryCreateDialog({ afterCreate: 'stay-on-stage' })}
            onCreateWidget={requestCreateWidget}
            onDeleteMemory={openMemoryDeleteDialog}
            onDeleteWidget={openWidgetDeleteDialog}
            onMoveMemory={(memory) => openEntityMoveDialog({ type: 'memory', memory })}
            onRenameMemory={setMemoryRenameTarget}
            onRenameWidget={openWidgetRenameDialog}
            onRequestWidgetRefresh={refreshWidget}
            onRequestWidgetUpdate={requestUpdateWidget}
            onResetMemoryCover={(memory) => {
              void resetMemoryCoverToDefault(memory);
            }}
            onReorderWidgets={reorderWidgets}
            onSelectRailTab={setActiveWorkspaceRailTab}
            onSwitchMemoryDefaultCover={(memory) => {
              void switchMemoryDefaultCoverTemplate(memory);
            }}
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
            onToggleMemoryRail={toggleMemoryRail}
            title={activeWorkspaceSession.snapshot.title}
            widgets={workspaceWidgets}
            workspaceHandle={activeWorkspaceSession.workspaceHandle}
            workspaceId={activeWorkspaceSession.workspaceId}
          />
        }
      >
        <LoadedWorkspaceFrame
          workspaceSession={activeWorkspaceSession}
          activeRailTab={effectiveWorkspaceRailTab}
          currentMemory={currentMemory}
          segmentFocusIntent={
            currentMemory && segmentFocusIntent?.memoryId === currentMemory.memoryId
              ? {
                  segmentId: segmentFocusIntent.segmentId,
                  ...(segmentFocusIntent.supplementId
                    ? { supplementId: segmentFocusIntent.supplementId }
                    : {}),
                }
              : null
          }
          memoryRailOpen={memoryRailOpen}
          memoryRailMode={memoryRailInline ? 'inline' : 'overlay'}
          onDeleteMemory={openMemoryDeleteDialog}
          onResetMemoryCover={(memory) => {
            void resetMemoryCoverToDefault(memory);
          }}
          onSwitchMemoryDefaultCover={(memory) => {
            void switchMemoryDefaultCoverTemplate(memory);
          }}
          onResetSegmentCover={(target) => {
            void resetSegmentCoverToDefault(target);
          }}
          onSwitchSegmentDefaultCover={(target) => {
            void switchSegmentDefaultCoverTemplate(target);
          }}
          onDeleteSegment={openSegmentDeleteDialog}
          onDeleteSegmentSupplement={openSegmentSupplementDeleteDialog}
          onMoveMemory={(memory) => openEntityMoveDialog({ type: 'memory', memory })}
          onMoveSegment={(target) => openEntityMoveDialog({ type: 'segment', ...target })}
          onMoveSegmentSupplement={(target) =>
            openEntityMoveDialog({ type: 'supplement', ...target })
          }
          onClearSegmentContent={setSegmentContentClearTarget}
          onSegmentTranscriptSaved={(saved) =>
            handleRecordingContentSaved({ ...saved, expectedSession: activeWorkspaceSession })
          }
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
          onSelectObject={selectObject}
          onRequestWidgetUpdate={requestUpdateWidget}
          onWidgetRuntimeMutation={handleWidgetRuntimeMutation}
          onRenameMemory={setMemoryRenameTarget}
          onRenameSegmentContent={setSegmentContentRenameTarget}
          onRenameSegment={setSegmentRenameTarget}
          onRenameSegmentSupplement={setSegmentSupplementRenameTarget}
          onShownReviewToastSessionKeyChange={setShownReviewToastSessionKey}
          speechSynthesis={memoryStudioSpeechSynthesis}
          transcriptionBackfill={memoryStudioTranscriptionBackfill}
          expressionDockVisible={recordingTarget === null && !noteEditorBlocking}
          onStartArtifact={requestStartArtifact}
          onStartNote={requestStartNote}
          onStartSegmentSupplementNote={requestStartSegmentSupplementNote}
          onStartSegmentSupplementRecording={requestStartSegmentSupplementRecording}
          onStartRecording={requestStartRecording}
          shownReviewToastSessionKey={shownReviewToastSessionKey}
          widgetRefreshVersions={widgetRefreshVersions}
        />
      </AppShell>
      {renderWorkspaceExpressionOverlays(activeWorkspaceSession)}
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
      <WidgetRenameDialog
        widget={widgetRenameTarget}
        onOpenChange={(open) => {
          if (!open) {
            setWidgetRenameTarget(null);
          }
        }}
        onSave={saveRenamedWidget}
        open={widgetRenameTarget !== null}
      />
      <MemoryTitleDialog
        description="组件名称会写回 component.md。"
        fieldLabel="组件名称"
        initialTitle={homeComponentRenameTarget?.title ?? ''}
        onOpenChange={(open) => {
          if (!open) {
            setHomeComponentRenameTarget(null);
          }
        }}
        onSubmitTitle={(title) =>
          homeComponentRenameTarget
            ? saveRenamedHomeComponent(homeComponentRenameTarget, title)
            : Promise.resolve(null)
        }
        open={homeComponentRenameTarget !== null}
        requiredMessage="请输入组件名称"
        saveErrorTitle="无法保存主页组件名称"
        submitLabel="保存"
        title="重命名主页组件"
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
      <EntityMoveDialog
        disabled={workspaceActionPending || entityMoveLoading}
        onConfirm={(selection) => {
          void confirmMoveEntity(selection);
        }}
        onOpenChange={handleEntityMoveOpenChange}
        open={entityMoveTarget !== null}
        targets={entityMoveTargets}
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
      <WidgetDeleteDialog
        disabled={workspaceActionPending}
        widget={widgetDeleteTarget}
        onConfirm={() => {
          void confirmDeleteWidget();
        }}
        onOpenChange={handleWidgetDeleteOpenChange}
        open={widgetDeleteTarget !== null}
      />
      <WorkspaceDangerConfirmDialog
        confirmLabel="删除组件"
        description={`删除“${homeComponentDeleteTarget?.title ?? '这个组件'}”？Reo 会把这个主页组件移入回收区，可从提示中恢复。`}
        disabled={workspaceActionPending}
        onConfirm={() => {
          void confirmDeleteHomeComponent();
        }}
        onOpenChange={handleHomeComponentDeleteOpenChange}
        open={homeComponentDeleteTarget !== null}
        title="删除主页组件"
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
        description={memoryCreateDialogDescription(memoryCreateIntent)}
        onCreate={saveCreatedMemory}
        onOpenChange={handleMemoryCreateOpenChange}
        open={memoryCreateIntent !== null}
        submitLabel={memoryCreateDialogSubmitLabel(memoryCreateIntent)}
      />
      {permissionGuideDialog}
      {workspaceDialogs}
    </>
  );
}

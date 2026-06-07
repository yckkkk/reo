import { queryOptions, type QueryClient } from '@tanstack/react-query';
import {
  listMemorySpaces,
  readRecentExpressions,
  readFinalizedAudioSegment,
  readFinalizedAudioSegmentAudio,
  readFinalizedAudioSegmentSupplement,
  readFinalizedAudioSegmentSupplementAudio,
  readSystemDraftWorkspace,
  readMemoryDetail,
  readSegmentContent,
  readSegmentSpeechAudio,
  readSegmentSupplementContent,
  readSegmentSupplementSpeechAudio,
  type WorkspaceNoteSegmentContent,
  type WorkspaceNoteSegmentSpeechAudio,
  type WorkspaceNoteSegmentSupplementContent,
  type WorkspaceNoteSegmentSupplementSpeechAudio,
  type WorkspaceFinalizedAudioSegmentSupplementContent,
  type WorkspaceFinalizedAudioSegmentSupplementAudio,
  type WorkspaceFinalizedAudioSegmentContent,
  type WorkspaceFinalizedAudioSegmentAudio,
  type WorkspaceMemorySpace,
  type WorkspaceMemoryDetail,
  type WorkspaceSession,
  type WorkspaceSnapshot,
  type WorkspaceSystemDraftProjection,
  type WorkspaceRecentExpressionItem,
  type WorkspaceRecentExpressionSkipped,
} from './workspaceApi';
import { workspaceErrorDisplayMessage } from './workspaceErrorMessages';

const WORKSPACE_CONTENT_QUERY_GC_TIME_MS = 5 * 60_000;
const PLAYBACK_AUDIO_QUERY_GC_TIME_MS = 0;

export function workspaceSnapshotQueryKey({
  workspaceId,
}: {
  readonly workspaceId: string;
  readonly workspaceHandle?: string;
}) {
  return ['workspace', 'snapshot', workspaceId] as const;
}

export function workspaceSnapshotQueryOptions(session: WorkspaceSession) {
  return queryOptions({
    queryKey: workspaceSnapshotQueryKey(session),
    queryFn: async () => session.snapshot,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function seedWorkspaceSnapshot(queryClient: QueryClient, session: WorkspaceSession) {
  queryClient.setQueryData<WorkspaceSnapshot>(workspaceSnapshotQueryKey(session), session.snapshot);
}

export function memoryDetailQueryKey({
  workspaceId,
  memoryId,
}: {
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly workspaceHandle?: string;
}) {
  return ['workspace', 'memory-detail', workspaceId, memoryId] as const;
}

function createMemoryDetailRequestId(workspaceId: string, memoryId: string) {
  return `memory-detail:${workspaceId}:${memoryId}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createSegmentContentRequestId(workspaceId: string, memoryId: string, segmentId: string) {
  return `segment-content:${workspaceId}:${memoryId}:${segmentId}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createSegmentAudioRequestId(
  workspaceId: string,
  memoryId: string,
  segmentId: string,
  audioIdentity: string
) {
  return `segment-audio:${workspaceId}:${memoryId}:${segmentId}:${audioIdentity}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createSegmentSpeechAudioRequestId(
  workspaceId: string,
  memoryId: string,
  segmentId: string,
  contentHash: string
) {
  return `segment-speech-audio:${workspaceId}:${memoryId}:${segmentId}:${contentHash}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createSegmentSupplementContentRequestId(
  workspaceId: string,
  memoryId: string,
  segmentId: string,
  supplementId: string
) {
  return `segment-supplement-content:${workspaceId}:${memoryId}:${segmentId}:${supplementId}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createSegmentSupplementAudioRequestId(
  workspaceId: string,
  memoryId: string,
  segmentId: string,
  supplementId: string,
  audioIdentity: string
) {
  return `segment-supplement-audio:${workspaceId}:${memoryId}:${segmentId}:${supplementId}:${audioIdentity}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createSegmentSupplementSpeechAudioRequestId(
  workspaceId: string,
  memoryId: string,
  segmentId: string,
  supplementId: string,
  contentHash: string
) {
  return `segment-supplement-speech-audio:${workspaceId}:${memoryId}:${segmentId}:${supplementId}:${contentHash}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function createMemoryDetailQueryOptions(
  session: WorkspaceSession,
  memoryId: string,
  staleTime: number
) {
  return queryOptions({
    queryKey: memoryDetailQueryKey({ workspaceId: session.workspaceId, memoryId }),
    queryFn: async (): Promise<{
      readonly requestId: string;
      readonly detail: WorkspaceMemoryDetail;
    }> => {
      const requestId = createMemoryDetailRequestId(session.workspaceId, memoryId);
      const result = await readMemoryDetail({
        workspaceHandle: session.workspaceHandle,
        workspaceId: session.workspaceId,
        memoryId,
        requestId,
      });

      if (!result.ok) {
        throw new Error(workspaceErrorDisplayMessage(result.error, '记忆内容加载失败。'));
      }

      if (
        result.value.requestId !== requestId ||
        result.value.detail.workspaceId !== session.workspaceId ||
        result.value.detail.memoryId !== memoryId
      ) {
        throw new Error('Stale memory detail response');
      }

      return result.value;
    },
    retry: false,
    staleTime,
    gcTime: Infinity,
  });
}

export function memoryDetailQueryOptions(session: WorkspaceSession, memoryId: string) {
  return createMemoryDetailQueryOptions(session, memoryId, Infinity);
}

export function runtimeMemoryDetailQueryOptions(session: WorkspaceSession, memoryId: string) {
  return createMemoryDetailQueryOptions(session, memoryId, 0);
}

export function segmentContentQueryKey({
  workspaceId,
  workspaceHandle,
  memoryId,
  segmentId,
}: {
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly workspaceHandle: string;
}) {
  return [
    'workspace',
    'segment-content',
    workspaceId,
    workspaceHandle,
    memoryId,
    segmentId,
  ] as const;
}

export function segmentContentQueryOptions(
  session: WorkspaceSession,
  memoryId: string,
  segmentId: string,
  type: 'audio' | 'note' = 'audio'
) {
  return queryOptions({
    queryKey: segmentContentQueryKey({
      workspaceId: session.workspaceId,
      workspaceHandle: session.workspaceHandle,
      memoryId,
      segmentId,
    }),
    queryFn: async (): Promise<
      WorkspaceFinalizedAudioSegmentContent | WorkspaceNoteSegmentContent
    > => {
      const requestId = createSegmentContentRequestId(session.workspaceId, memoryId, segmentId);
      const request = {
        workspaceHandle: session.workspaceHandle,
        workspaceId: session.workspaceId,
        memoryId,
        segmentId,
        requestId,
      };
      const result =
        type === 'note'
          ? await readSegmentContent(request)
          : await readFinalizedAudioSegment(request);

      if (!result.ok) {
        throw new Error(workspaceErrorDisplayMessage(result.error, '片段内容加载失败。'));
      }

      if (
        result.value.requestId !== requestId ||
        result.value.workspaceId !== session.workspaceId ||
        result.value.memoryId !== memoryId ||
        result.value.segmentId !== segmentId
      ) {
        throw new Error('Stale segment content response');
      }

      return result.value;
    },
    retry: false,
    staleTime: Infinity,
    gcTime: WORKSPACE_CONTENT_QUERY_GC_TIME_MS,
  });
}

export function segmentSupplementContentQueryKey({
  workspaceId,
  workspaceHandle,
  memoryId,
  segmentId,
  supplementId,
}: {
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly workspaceHandle: string;
}) {
  return [
    'workspace',
    'segment-supplement-content',
    workspaceId,
    workspaceHandle,
    memoryId,
    segmentId,
    supplementId,
  ] as const;
}

export function segmentSupplementContentQueryPrefix({
  workspaceId,
  workspaceHandle,
  memoryId,
  segmentId,
}: {
  readonly workspaceId: string;
  readonly workspaceHandle: string;
  readonly memoryId: string;
  readonly segmentId: string;
}) {
  return [
    'workspace',
    'segment-supplement-content',
    workspaceId,
    workspaceHandle,
    memoryId,
    segmentId,
  ] as const;
}

export function segmentAudioQueryKey({
  audioByteLength,
  audioHash,
  audioIdentityVersion,
  memoryId,
  segmentId,
  workspaceId,
  workspaceHandle,
}: {
  readonly audioByteLength: number;
  readonly audioHash: string | null;
  readonly audioIdentityVersion: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly workspaceId: string;
  readonly workspaceHandle: string;
}) {
  return [
    'workspace',
    'segment-audio',
    workspaceId,
    workspaceHandle,
    memoryId,
    segmentId,
    audioByteLength,
    audioHash ?? audioIdentityVersion,
  ] as const;
}

export function segmentSupplementAudioQueryKey({
  audioByteLength,
  audioHash,
  audioIdentityVersion,
  memoryId,
  segmentId,
  supplementId,
  workspaceId,
  workspaceHandle,
}: {
  readonly audioByteLength: number;
  readonly audioHash: string | null;
  readonly audioIdentityVersion: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly workspaceId: string;
  readonly workspaceHandle: string;
}) {
  return [
    'workspace',
    'segment-supplement-audio',
    workspaceId,
    workspaceHandle,
    memoryId,
    segmentId,
    supplementId,
    audioByteLength,
    audioHash ?? audioIdentityVersion,
  ] as const;
}

export function segmentSpeechAudioQueryKey({
  audioByteLength,
  contentHash,
  memoryId,
  segmentId,
  speaker,
  updatedAt,
  workspaceId,
  workspaceHandle,
}: {
  readonly audioByteLength: number;
  readonly contentHash: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly speaker: string;
  readonly updatedAt: string;
  readonly workspaceId: string;
  readonly workspaceHandle: string;
}) {
  return [
    'workspace',
    'segment-speech-audio',
    workspaceId,
    workspaceHandle,
    memoryId,
    segmentId,
    contentHash,
    audioByteLength,
    speaker,
    updatedAt,
  ] as const;
}

export function segmentSupplementSpeechAudioQueryKey({
  audioByteLength,
  contentHash,
  memoryId,
  segmentId,
  speaker,
  supplementId,
  updatedAt,
  workspaceId,
  workspaceHandle,
}: {
  readonly audioByteLength: number;
  readonly contentHash: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly speaker: string;
  readonly supplementId: string;
  readonly updatedAt: string;
  readonly workspaceId: string;
  readonly workspaceHandle: string;
}) {
  return [
    'workspace',
    'segment-supplement-speech-audio',
    workspaceId,
    workspaceHandle,
    memoryId,
    segmentId,
    supplementId,
    contentHash,
    audioByteLength,
    speaker,
    updatedAt,
  ] as const;
}

export function segmentAudioQueryOptions({
  audioByteLength,
  audioHash,
  audioIdentityVersion,
  memoryId,
  segmentId,
  session,
}: {
  readonly audioByteLength: number;
  readonly audioHash: string | null;
  readonly audioIdentityVersion: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly session: WorkspaceSession;
}) {
  return queryOptions({
    queryKey: segmentAudioQueryKey({
      audioByteLength,
      audioHash,
      audioIdentityVersion,
      memoryId,
      segmentId,
      workspaceId: session.workspaceId,
      workspaceHandle: session.workspaceHandle,
    }),
    queryFn: async (): Promise<WorkspaceFinalizedAudioSegmentAudio> => {
      const audioIdentity = audioHash ?? audioIdentityVersion;
      const requestId = createSegmentAudioRequestId(
        session.workspaceId,
        memoryId,
        segmentId,
        audioIdentity
      );
      const result = await readFinalizedAudioSegmentAudio({
        workspaceHandle: session.workspaceHandle,
        workspaceId: session.workspaceId,
        memoryId,
        segmentId,
        audioByteLength,
        audioHash,
        requestId,
      });

      if (!result.ok) {
        throw new Error(workspaceErrorDisplayMessage(result.error, '片段音频加载失败。'));
      }

      if (
        result.value.requestId !== requestId ||
        result.value.workspaceId !== session.workspaceId ||
        result.value.memoryId !== memoryId ||
        result.value.segmentId !== segmentId ||
        result.value.audioByteLength !== audioByteLength ||
        (audioHash !== null && result.value.audioHash !== audioHash)
      ) {
        throw new Error('Stale segment audio response');
      }

      return result.value;
    },
    retry: false,
    staleTime: Infinity,
    gcTime: PLAYBACK_AUDIO_QUERY_GC_TIME_MS,
  });
}

export function segmentSupplementAudioQueryOptions({
  audioByteLength,
  audioHash,
  audioIdentityVersion,
  memoryId,
  segmentId,
  session,
  supplementId,
}: {
  readonly audioByteLength: number;
  readonly audioHash: string | null;
  readonly audioIdentityVersion: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly session: WorkspaceSession;
  readonly supplementId: string;
}) {
  return queryOptions({
    queryKey: segmentSupplementAudioQueryKey({
      audioByteLength,
      audioHash,
      audioIdentityVersion,
      memoryId,
      segmentId,
      supplementId,
      workspaceId: session.workspaceId,
      workspaceHandle: session.workspaceHandle,
    }),
    queryFn: async (): Promise<WorkspaceFinalizedAudioSegmentSupplementAudio> => {
      const audioIdentity = audioHash ?? audioIdentityVersion;
      const requestId = createSegmentSupplementAudioRequestId(
        session.workspaceId,
        memoryId,
        segmentId,
        supplementId,
        audioIdentity
      );
      const result = await readFinalizedAudioSegmentSupplementAudio({
        workspaceHandle: session.workspaceHandle,
        workspaceId: session.workspaceId,
        memoryId,
        segmentId,
        supplementId,
        audioByteLength,
        audioHash,
        requestId,
      });

      if (!result.ok) {
        throw new Error(workspaceErrorDisplayMessage(result.error, '补充录音音频加载失败。'));
      }

      if (
        result.value.requestId !== requestId ||
        result.value.workspaceId !== session.workspaceId ||
        result.value.memoryId !== memoryId ||
        result.value.segmentId !== segmentId ||
        result.value.supplementId !== supplementId ||
        result.value.audioByteLength !== audioByteLength ||
        (audioHash !== null && result.value.audioHash !== audioHash)
      ) {
        throw new Error('Stale segment supplement audio response');
      }

      return result.value;
    },
    retry: false,
    staleTime: Infinity,
    gcTime: PLAYBACK_AUDIO_QUERY_GC_TIME_MS,
  });
}

export function segmentSpeechAudioQueryOptions({
  audioByteLength,
  contentHash,
  memoryId,
  segmentId,
  session,
  speaker,
  updatedAt,
}: {
  readonly audioByteLength: number;
  readonly contentHash: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly session: WorkspaceSession;
  readonly speaker: WorkspaceNoteSegmentContent['speechSynthesis']['speaker'] & string;
  readonly updatedAt: string;
}) {
  return queryOptions({
    queryKey: segmentSpeechAudioQueryKey({
      audioByteLength,
      contentHash,
      memoryId,
      segmentId,
      speaker,
      updatedAt,
      workspaceId: session.workspaceId,
      workspaceHandle: session.workspaceHandle,
    }),
    queryFn: async (): Promise<WorkspaceNoteSegmentSpeechAudio> => {
      const requestId = createSegmentSpeechAudioRequestId(
        session.workspaceId,
        memoryId,
        segmentId,
        contentHash
      );
      const result = await readSegmentSpeechAudio({
        workspaceHandle: session.workspaceHandle,
        workspaceId: session.workspaceId,
        memoryId,
        segmentId,
        contentHash,
        audioByteLength,
        requestId,
        speaker,
        updatedAt,
      });

      if (!result.ok) {
        throw new Error(workspaceErrorDisplayMessage(result.error, '笔记语音加载失败。'));
      }

      if (
        result.value.requestId !== requestId ||
        result.value.workspaceId !== session.workspaceId ||
        result.value.memoryId !== memoryId ||
        result.value.segmentId !== segmentId ||
        result.value.contentHash !== contentHash ||
        result.value.audioByteLength !== audioByteLength
      ) {
        throw new Error('Stale segment speech audio response');
      }

      return result.value;
    },
    retry: false,
    staleTime: Infinity,
    gcTime: PLAYBACK_AUDIO_QUERY_GC_TIME_MS,
  });
}

export function segmentSupplementSpeechAudioQueryOptions({
  audioByteLength,
  contentHash,
  memoryId,
  segmentId,
  session,
  speaker,
  supplementId,
  updatedAt,
}: {
  readonly audioByteLength: number;
  readonly contentHash: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly session: WorkspaceSession;
  readonly speaker: WorkspaceNoteSegmentSupplementContent['speechSynthesis']['speaker'] & string;
  readonly supplementId: string;
  readonly updatedAt: string;
}) {
  return queryOptions({
    queryKey: segmentSupplementSpeechAudioQueryKey({
      audioByteLength,
      contentHash,
      memoryId,
      segmentId,
      speaker,
      supplementId,
      updatedAt,
      workspaceId: session.workspaceId,
      workspaceHandle: session.workspaceHandle,
    }),
    queryFn: async (): Promise<WorkspaceNoteSegmentSupplementSpeechAudio> => {
      const requestId = createSegmentSupplementSpeechAudioRequestId(
        session.workspaceId,
        memoryId,
        segmentId,
        supplementId,
        contentHash
      );
      const result = await readSegmentSupplementSpeechAudio({
        workspaceHandle: session.workspaceHandle,
        workspaceId: session.workspaceId,
        memoryId,
        segmentId,
        supplementId,
        contentHash,
        audioByteLength,
        requestId,
        speaker,
        updatedAt,
      });

      if (!result.ok) {
        throw new Error(workspaceErrorDisplayMessage(result.error, '补充笔记语音加载失败。'));
      }

      if (
        result.value.requestId !== requestId ||
        result.value.workspaceId !== session.workspaceId ||
        result.value.memoryId !== memoryId ||
        result.value.segmentId !== segmentId ||
        result.value.supplementId !== supplementId ||
        result.value.contentHash !== contentHash ||
        result.value.audioByteLength !== audioByteLength
      ) {
        throw new Error('Stale segment supplement speech audio response');
      }

      return result.value;
    },
    retry: false,
    staleTime: Infinity,
    gcTime: PLAYBACK_AUDIO_QUERY_GC_TIME_MS,
  });
}

export function segmentSupplementContentQueryOptions(
  session: WorkspaceSession,
  memoryId: string,
  segmentId: string,
  supplementId: string,
  type: 'audio' | 'note' = 'audio'
) {
  return queryOptions({
    queryKey: segmentSupplementContentQueryKey({
      workspaceId: session.workspaceId,
      workspaceHandle: session.workspaceHandle,
      memoryId,
      segmentId,
      supplementId,
    }),
    queryFn: async (): Promise<
      WorkspaceFinalizedAudioSegmentSupplementContent | WorkspaceNoteSegmentSupplementContent
    > => {
      const requestId = createSegmentSupplementContentRequestId(
        session.workspaceId,
        memoryId,
        segmentId,
        supplementId
      );
      const request = {
        workspaceHandle: session.workspaceHandle,
        workspaceId: session.workspaceId,
        memoryId,
        segmentId,
        supplementId,
        requestId,
      };
      const result =
        type === 'note'
          ? await readSegmentSupplementContent(request)
          : await readFinalizedAudioSegmentSupplement(request);

      if (!result.ok) {
        throw new Error(workspaceErrorDisplayMessage(result.error, '补充录音加载失败。'));
      }

      if (
        result.value.requestId !== requestId ||
        result.value.workspaceId !== session.workspaceId ||
        result.value.memoryId !== memoryId ||
        result.value.segmentId !== segmentId ||
        result.value.supplementId !== supplementId
      ) {
        throw new Error('Stale segment supplement content response');
      }

      return result.value;
    },
    retry: false,
    staleTime: Infinity,
    gcTime: WORKSPACE_CONTENT_QUERY_GC_TIME_MS,
  });
}

export function workspaceProjectionQueryBelongsToWorkspace(
  queryKey: readonly unknown[],
  workspaceId?: string
) {
  const [scope, kind, queryWorkspaceId] = queryKey;
  return (
    scope === 'workspace' &&
    (workspaceId === undefined || queryWorkspaceId === workspaceId) &&
    (kind === 'memory-detail' ||
      kind === 'segment-content' ||
      kind === 'segment-supplement-content')
  );
}

export function memoryDetailQueryBelongsToWorkspace(
  queryKey: readonly unknown[],
  workspaceId: string
) {
  const [scope, kind, queryWorkspaceId] = queryKey;
  return scope === 'workspace' && kind === 'memory-detail' && queryWorkspaceId === workspaceId;
}

export function workspaceContentQueryBelongsToWorkspace(
  queryKey: readonly unknown[],
  workspaceId: string
) {
  const [scope, kind, queryWorkspaceId] = queryKey;
  return (
    scope === 'workspace' &&
    queryWorkspaceId === workspaceId &&
    (kind === 'segment-content' || kind === 'segment-supplement-content')
  );
}

export function workspaceSpeechAudioQueryBelongsToWorkspace(
  queryKey: readonly unknown[],
  workspaceId?: string
) {
  const [scope, kind, queryWorkspaceId] = queryKey;
  return (
    scope === 'workspace' &&
    (workspaceId === undefined || queryWorkspaceId === workspaceId) &&
    (kind === 'segment-speech-audio' || kind === 'segment-supplement-speech-audio')
  );
}

export function workspacePlaybackAudioQueryBelongsToWorkspace(
  queryKey: readonly unknown[],
  workspaceId?: string
) {
  const [scope, kind, queryWorkspaceId] = queryKey;
  return (
    scope === 'workspace' &&
    (workspaceId === undefined || queryWorkspaceId === workspaceId) &&
    (kind === 'segment-audio' ||
      kind === 'segment-supplement-audio' ||
      kind === 'segment-speech-audio' ||
      kind === 'segment-supplement-speech-audio')
  );
}

export function workspacePlaybackAudioQueryBelongsToEntity(
  queryKey: readonly unknown[],
  target: {
    readonly workspaceId: string;
    readonly workspaceHandle: string;
    readonly memoryId: string;
    readonly segmentId?: string;
    readonly supplementId?: string;
  }
) {
  const [scope, kind, workspaceId, workspaceHandle, memoryId, segmentId, supplementId] = queryKey;

  if (
    scope !== 'workspace' ||
    workspaceId !== target.workspaceId ||
    workspaceHandle !== target.workspaceHandle ||
    memoryId !== target.memoryId
  ) {
    return false;
  }

  if (target.segmentId === undefined) {
    return (
      kind === 'segment-audio' ||
      kind === 'segment-supplement-audio' ||
      kind === 'segment-speech-audio' ||
      kind === 'segment-supplement-speech-audio'
    );
  }

  if (segmentId !== target.segmentId) {
    return false;
  }

  if (target.supplementId === undefined) {
    return (
      kind === 'segment-audio' ||
      kind === 'segment-supplement-audio' ||
      kind === 'segment-speech-audio' ||
      kind === 'segment-supplement-speech-audio'
    );
  }

  return (
    supplementId === target.supplementId &&
    (kind === 'segment-supplement-audio' || kind === 'segment-supplement-speech-audio')
  );
}

export function seedWorkspaceHandleScopedContentQueries(
  queryClient: QueryClient,
  session: WorkspaceSession
) {
  for (const query of queryClient.getQueryCache().getAll()) {
    const [scope, kind, queryWorkspaceId, queryWorkspaceHandle] = query.queryKey;
    if (
      scope !== 'workspace' ||
      queryWorkspaceId !== session.workspaceId ||
      queryWorkspaceHandle === session.workspaceHandle ||
      query.state.data === undefined
    ) {
      continue;
    }

    const [, , , , memoryId, segmentId, supplementId] = query.queryKey;
    if (typeof memoryId !== 'string' || typeof segmentId !== 'string') {
      continue;
    }

    const nextKey =
      kind === 'segment-content'
        ? segmentContentQueryKey({
            workspaceId: session.workspaceId,
            workspaceHandle: session.workspaceHandle,
            memoryId,
            segmentId,
          })
        : kind === 'segment-supplement-content' && typeof supplementId === 'string'
          ? segmentSupplementContentQueryKey({
              workspaceId: session.workspaceId,
              workspaceHandle: session.workspaceHandle,
              memoryId,
              segmentId,
              supplementId,
            })
          : null;

    if (nextKey === null || queryClient.getQueryData(nextKey) !== undefined) {
      continue;
    }

    queryClient.setQueryData(nextKey, query.state.data);
    void queryClient.invalidateQueries({ exact: true, queryKey: nextKey, refetchType: 'none' });
  }
}

export function memorySpacesQueryKey() {
  return ['workspace', 'memory-spaces'] as const;
}

export function memorySpacesQueryOptions() {
  return queryOptions({
    queryKey: memorySpacesQueryKey(),
    queryFn: async (): Promise<readonly WorkspaceMemorySpace[]> => {
      const result = await listMemorySpaces();

      if (!result.ok) {
        throw new Error(workspaceErrorDisplayMessage(result.error, '无法加载记忆空间列表。'));
      }

      return result.value.memorySpaces;
    },
    retry: false,
    staleTime: Infinity,
  });
}

export function systemDraftWorkspaceQueryKey() {
  return ['workspace', 'system-draft'] as const;
}

export function systemDraftWorkspaceQueryOptions() {
  return queryOptions({
    queryKey: systemDraftWorkspaceQueryKey(),
    queryFn: async (): Promise<WorkspaceSystemDraftProjection> => {
      const result = await readSystemDraftWorkspace();

      if (!result.ok) {
        throw new Error(workspaceErrorDisplayMessage(result.error, '无法加载草稿。'));
      }

      return result.value.draft;
    },
    retry: false,
    staleTime: Infinity,
  });
}

export function recentExpressionsQueryRootKey() {
  return ['workspace', 'recent-expressions'] as const;
}

export function recentExpressionsQueryKey({ limit }: { readonly limit?: number } = {}) {
  return [...recentExpressionsQueryRootKey(), limit ?? 'default'] as const;
}

export function recentExpressionsQueryOptions({
  enabled = true,
  limit,
}: { readonly enabled?: boolean; readonly limit?: number } = {}) {
  return queryOptions({
    enabled,
    queryKey:
      limit === undefined ? recentExpressionsQueryKey() : recentExpressionsQueryKey({ limit }),
    queryFn: async (): Promise<{
      readonly items: readonly WorkspaceRecentExpressionItem[];
      readonly skipped: readonly WorkspaceRecentExpressionSkipped[];
    }> => {
      const result = await readRecentExpressions(limit === undefined ? {} : { limit });

      if (!result.ok) {
        throw new Error(workspaceErrorDisplayMessage(result.error, '无法加载近期表达。'));
      }

      return result.value;
    },
    retry: false,
    staleTime: 30_000,
  });
}

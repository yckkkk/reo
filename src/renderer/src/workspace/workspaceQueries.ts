import { queryOptions, type QueryClient } from '@tanstack/react-query';
import {
  listMemorySpaces,
  readFinalizedAudioSegment,
  readMemoryDetail,
  type WorkspaceFinalizedAudioSegmentContent,
  type WorkspaceMemorySpace,
  type WorkspaceMemoryDetail,
  type WorkspaceSession,
  type WorkspaceSnapshot,
} from './workspaceApi';
import { workspaceErrorDisplayMessage } from './workspaceErrorMessages';

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

export function memoryDetailQueryOptions(session: WorkspaceSession, memoryId: string) {
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
    staleTime: Infinity,
  });
}

export function segmentContentQueryKey({
  workspaceId,
  memoryId,
  segmentId,
}: {
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly workspaceHandle?: string;
}) {
  return ['workspace', 'segment-content', workspaceId, memoryId, segmentId] as const;
}

export function segmentContentQueryOptions(
  session: WorkspaceSession,
  memoryId: string,
  segmentId: string
) {
  return queryOptions({
    queryKey: segmentContentQueryKey({
      workspaceId: session.workspaceId,
      memoryId,
      segmentId,
    }),
    queryFn: async (): Promise<WorkspaceFinalizedAudioSegmentContent> => {
      const requestId = createSegmentContentRequestId(session.workspaceId, memoryId, segmentId);
      const result = await readFinalizedAudioSegment({
        workspaceHandle: session.workspaceHandle,
        workspaceId: session.workspaceId,
        memoryId,
        segmentId,
        requestId,
      });

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
  });
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

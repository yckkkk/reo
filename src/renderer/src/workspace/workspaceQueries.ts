import { queryOptions, type QueryClient } from '@tanstack/react-query';
import {
  getMemoryDetail,
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
  memoryId,
  workspaceId,
}: {
  readonly memoryId: string;
  readonly workspaceId: string;
}) {
  return ['workspace', 'memory-detail', workspaceId, memoryId] as const;
}

export function memoryDetailQueryOptions({
  memoryId,
  workspaceHandle,
  workspaceId,
}: {
  readonly memoryId: string;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
}) {
  return queryOptions({
    queryKey: memoryDetailQueryKey({ memoryId, workspaceId }),
    queryFn: async (): Promise<WorkspaceMemoryDetail> => {
      const result = await getMemoryDetail({ workspaceHandle, memoryId });

      if (!result.ok) {
        throw new Error(workspaceErrorDisplayMessage(result.error, '无法打开这条记忆。'));
      }

      return result.value;
    },
    staleTime: Infinity,
  });
}

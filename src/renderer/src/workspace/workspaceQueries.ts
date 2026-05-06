import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { WorkspaceSession, WorkspaceSnapshot } from './workspaceApi';

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

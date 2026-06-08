import { queryOptions, type QueryClient } from '@tanstack/react-query';
import {
  readAppPermissionStatus,
  type AppPermissionStatusSnapshot,
} from '../workspace/workspaceApi';

type AppPermissionStatus = AppPermissionStatusSnapshot[keyof AppPermissionStatusSnapshot]['status'];

export function appPermissionStatusQueryKey() {
  return ['settings', 'app-permissions'] as const;
}

export function appPermissionStatusQueryOptions() {
  return queryOptions({
    queryKey: appPermissionStatusQueryKey(),
    queryFn: async (): Promise<AppPermissionStatusSnapshot> => {
      const response = await readAppPermissionStatus();

      if (!response.ok) {
        throw new Error('无法加载权限状态。');
      }

      return {
        microphone: { status: response.value.permissions.microphone.status },
        camera: { status: response.value.permissions.camera.status },
        accessibility: { status: response.value.permissions.accessibility.status },
      };
    },
    retry: false,
    staleTime: 15_000,
  });
}

export function patchAppPermissionStatus(
  queryClient: QueryClient,
  permission: keyof AppPermissionStatusSnapshot,
  status: AppPermissionStatus
) {
  queryClient.setQueryData<AppPermissionStatusSnapshot | undefined>(
    appPermissionStatusQueryKey(),
    (current) =>
      current
        ? {
            ...current,
            [permission]: { status },
          }
        : current
  );
}

import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appPermissionStatusQueryKey,
  appPermissionStatusQueryOptions,
  patchAppPermissionStatus,
} from './appPermissionQueries';
import type { AppPermissionStatusSnapshot } from '../workspace/workspaceApi';

type AppPermissionBridge = Pick<Window['reoWorkspace'], 'readAppPermissionStatus'>;

const permissions: AppPermissionStatusSnapshot = {
  microphone: { status: 'granted' },
  camera: { status: 'not-determined' },
  accessibility: { status: 'not-determined' },
};

function installAppPermissionBridge(overrides: Partial<AppPermissionBridge> = {}) {
  const bridge: AppPermissionBridge = {
    readAppPermissionStatus: vi.fn(async () => ({
      ok: true as const,
      value: { permissions },
    })),
    ...overrides,
  };

  Object.defineProperty(window, 'reoWorkspace', {
    configurable: true,
    value: bridge,
  });

  return bridge;
}

describe('app permission queries', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installAppPermissionBridge();
  });

  it('uses a stable application-scoped permission query key', () => {
    expect(appPermissionStatusQueryKey()).toEqual(['settings', 'app-permissions']);
  });

  it('fetches the bounded permission snapshot through the workspace facade', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const data = await queryClient.fetchQuery(appPermissionStatusQueryOptions());

    expect(window.reoWorkspace.readAppPermissionStatus).toHaveBeenCalledWith(undefined);
    expect(data).toEqual(permissions);
    expect(data).not.toHaveProperty('macosSettingsPath');
  });

  it('throws a safe message for permission status read errors', async () => {
    installAppPermissionBridge({
      readAppPermissionStatus: vi.fn(async () => ({
        ok: false as const,
        error: {
          code: 'ERR_WORKSPACE_UNTRUSTED_SENDER' as const,
          message: 'renderer origin failed',
          dataRetention: 'none-written' as const,
        },
      })),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await expect(queryClient.fetchQuery(appPermissionStatusQueryOptions())).rejects.toThrow(
      '无法加载权限状态。'
    );
  });

  it('patches one cached permission status without refetching the full snapshot', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(appPermissionStatusQueryKey(), permissions);

    patchAppPermissionStatus(queryClient, 'camera', 'granted');

    expect(queryClient.getQueryData(appPermissionStatusQueryKey())).toEqual({
      microphone: { status: 'granted' },
      camera: { status: 'granted' },
      accessibility: { status: 'not-determined' },
    });
    expect(window.reoWorkspace.readAppPermissionStatus).not.toHaveBeenCalled();
  });
});

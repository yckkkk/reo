import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionSettingsPanel } from './PermissionSettingsPanel';
import type { AppPermissionStatusSnapshot } from '../workspace/workspaceApi';

const permissions: AppPermissionStatusSnapshot = {
  microphone: { status: 'not-determined' },
  camera: { status: 'denied' },
  accessibility: { status: 'not-determined' },
};

function installPermissionBridge(snapshot: AppPermissionStatusSnapshot = permissions) {
  const bridge = {
    readAppPermissionStatus: vi.fn(async () => ({
      ok: true as const,
      value: { permissions: snapshot },
    })),
  };

  Object.defineProperty(window, 'reoWorkspace', {
    configurable: true,
    value: bridge,
  });

  return bridge;
}

function renderPermissionSettingsPanel(
  onRequestPermission = vi.fn(),
  pendingPermissionRequest: 'microphone' | 'camera' | 'accessibility' | null = null
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return {
    onRequestPermission,
    user: userEvent.setup(),
    ...render(
      <PermissionSettingsPanel
        pendingPermissionRequest={pendingPermissionRequest}
        onRequestPermission={onRequestPermission}
      />,
      {
        wrapper: Wrapper,
      }
    ),
  };
}

describe('PermissionSettingsPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installPermissionBridge();
  });

  it('renders app permission statuses from the app-scoped permission query', async () => {
    renderPermissionSettingsPanel();

    const microphoneRow = await screen.findByTestId('permission-settings-row-microphone');
    expect(window.reoWorkspace.readAppPermissionStatus).toHaveBeenCalledWith(undefined);
    expect(microphoneRow).toHaveTextContent('允许使用麦克风权限');
    expect(microphoneRow).toHaveTextContent('Reo 仅在您主动录音时访问麦克风。');
    expect(microphoneRow).toHaveAttribute('data-slot', 'field-row');
    expect(within(microphoneRow).queryByText('必需')).not.toBeInTheDocument();
    expect(screen.getByTestId('permission-settings-row-camera')).toHaveTextContent(
      'Reo 仅在您主动拍摄时访问摄像头。'
    );
    expect(screen.getByTestId('permission-settings-row-accessibility')).toHaveTextContent(
      'Reo 仅在您主动使用时捕获快捷键。'
    );
  });

  it('keeps all current app permission actions active until granted', async () => {
    const { onRequestPermission, user } = renderPermissionSettingsPanel();

    await user.click(await screen.findByRole('button', { name: '允许麦克风' }));
    await user.click(await screen.findByRole('button', { name: '允许摄像头' }));
    await user.click(await screen.findByRole('button', { name: '开启辅助功能' }));

    expect(onRequestPermission).toHaveBeenCalledWith('microphone');
    expect(onRequestPermission).toHaveBeenCalledWith('camera');
    expect(onRequestPermission).toHaveBeenCalledWith('accessibility');
  });

  it('disables permission actions while a permission request is pending', async () => {
    renderPermissionSettingsPanel(vi.fn(), 'camera');

    expect(await screen.findByRole('button', { name: '允许麦克风' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '允许摄像头' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '开启辅助功能' })).toBeDisabled();
  });

  it('locks the microphone action after the permission is granted', async () => {
    installPermissionBridge({
      microphone: { status: 'granted' },
      camera: { status: 'not-determined' },
      accessibility: { status: 'not-determined' },
    });

    renderPermissionSettingsPanel();

    const microphoneRow = await screen.findByTestId('permission-settings-row-microphone');
    expect(microphoneRow).toHaveTextContent('已允许');
    expect(within(microphoneRow).queryByRole('button')).not.toBeInTheDocument();
  });
});

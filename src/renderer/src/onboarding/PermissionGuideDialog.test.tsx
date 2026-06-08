import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PermissionGuideDialog } from './PermissionGuideDialog';
import type { AppPermissionStatusSnapshot } from '../workspace/workspaceApi';

const permissionSnapshot: AppPermissionStatusSnapshot = {
  microphone: { status: 'not-determined' },
  camera: { status: 'denied' },
  accessibility: { status: 'not-determined' },
};

function renderPermissionGuide(
  overrides: Partial<Parameters<typeof PermissionGuideDialog>[0]> = {}
) {
  const props = {
    open: true,
    permissions: permissionSnapshot,
    startupTarget: { kind: 'permission-guide', reason: 'first-run' } as const,
    voiceSettingsConfigured: false,
    onOpenChange: vi.fn(),
    onOpenVoiceSettings: vi.fn(),
    onRequestPermission: vi.fn(),
    onSkip: vi.fn(),
    ...overrides,
  };

  render(<PermissionGuideDialog {...props} />);
  return props;
}

describe('PermissionGuideDialog', () => {
  it('renders first-run permission and settings rows with bounded statuses', () => {
    renderPermissionGuide();

    const dialog = screen.getByRole('dialog', { name: '设置 Reo 权限' });
    expect(dialog).toHaveTextContent('录音');
    expect(dialog).toHaveTextContent('摄像头');
    expect(dialog).toHaveTextContent('辅助功能');
    expect(dialog).toHaveTextContent('语音服务');
    expect(dialog).toHaveTextContent('Reo 仅在您主动录音时访问麦克风。');
    expect(dialog).toHaveTextContent('Reo 仅在您主动拍摄时访问摄像头。');
    expect(dialog).toHaveTextContent('Reo 仅在您主动使用时捕获快捷键。');
    expect(within(dialog).getByRole('button', { name: '允许麦克风' })).toBeEnabled();
    expect(screen.getByTestId('permission-guide-row-microphone')).toHaveAttribute(
      'data-slot',
      'field-row'
    );
    expect(within(dialog).queryByText('必需')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '允许摄像头' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: '开启辅助功能' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: '设置语音服务' })).toBeEnabled();
  });

  it('calls permission and voice settings actions from explicit buttons', async () => {
    const user = userEvent.setup();
    const props = renderPermissionGuide();

    await user.click(screen.getByRole('button', { name: '允许麦克风' }));
    await user.click(screen.getByRole('button', { name: '允许摄像头' }));
    await user.click(screen.getByRole('button', { name: '开启辅助功能' }));
    await user.click(screen.getByRole('button', { name: '设置语音服务' }));

    expect(props.onRequestPermission).toHaveBeenCalledWith('microphone');
    expect(props.onRequestPermission).toHaveBeenCalledWith('camera');
    expect(props.onRequestPermission).toHaveBeenCalledWith('accessibility');
    expect(props.onOpenVoiceSettings).toHaveBeenCalledOnce();
    expect(props.onSkip).not.toHaveBeenCalled();
  });

  it('disables permission actions while another permission request is pending', () => {
    renderPermissionGuide({ pendingPermissionRequest: 'microphone' });

    expect(screen.getByRole('button', { name: '允许麦克风' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '允许摄像头' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '开启辅助功能' })).toBeDisabled();
  });

  it('keeps granted permissions passive and skips the guide without marking permissions granted', async () => {
    const user = userEvent.setup();
    const props = renderPermissionGuide({
      permissions: {
        microphone: { status: 'granted' },
        camera: { status: 'granted' },
        accessibility: { status: 'granted' },
      },
      voiceSettingsConfigured: true,
    });

    expect(screen.getByTestId('permission-guide-row-microphone')).toHaveTextContent('已允许');
    expect(screen.getByTestId('permission-guide-row-camera')).toHaveTextContent('已允许');
    expect(screen.getByTestId('permission-guide-row-accessibility')).toHaveTextContent('已允许');
    expect(screen.getByTestId('permission-guide-row-voice')).toHaveTextContent('已设置');
    expect(
      within(screen.getByTestId('permission-guide-row-microphone')).queryByRole('button')
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('permission-guide-row-camera')).queryByRole('button')
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('permission-guide-row-accessibility')).queryByRole('button')
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('permission-guide-row-voice')).queryByRole('button')
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '稍后' }));

    expect(props.onSkip).toHaveBeenCalledOnce();
    expect(props.onRequestPermission).not.toHaveBeenCalled();
  });

  it('keeps the permission guide open after a restart-required startup target and focuses the row', () => {
    renderPermissionGuide({
      startupTarget: {
        kind: 'permission-guide',
        reason: 'permission-restart-required',
        focusItem: 'microphone',
      },
    });

    const dialog = screen.getByRole('dialog', { name: '设置 Reo 权限' });
    expect(dialog).toHaveTextContent('重启后继续完成麦克风权限');
    expect(within(dialog).getByTestId('permission-guide-row-microphone')).toHaveAttribute(
      'data-focused',
      'true'
    );
  });
});

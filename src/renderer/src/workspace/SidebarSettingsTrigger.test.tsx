import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SidebarSettingsTrigger } from './SidebarSettingsTrigger';

describe('SidebarSettingsTrigger', () => {
  it('renders the settings button with a Chinese accessible name', () => {
    render(
      <SidebarSettingsTrigger
        onOpenSettings={vi.fn()}
        onRecordingBlocked={vi.fn()}
        recordingActive={false}
      />
    );

    const button = screen.getByRole('button', { name: '设置' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('设置');
  });

  it('calls onOpenSettings when recording is not active', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    const onRecordingBlocked = vi.fn();

    render(
      <SidebarSettingsTrigger
        onOpenSettings={onOpenSettings}
        onRecordingBlocked={onRecordingBlocked}
        recordingActive={false}
      />
    );

    await user.click(screen.getByRole('button', { name: '设置' }));

    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onRecordingBlocked).not.toHaveBeenCalled();
  });

  it('blocks the settings callback and emits the recording blocked callback while recording', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    const onRecordingBlocked = vi.fn();

    render(
      <SidebarSettingsTrigger
        onOpenSettings={onOpenSettings}
        onRecordingBlocked={onRecordingBlocked}
        recordingActive
      />
    );

    const button = screen.getByRole('button', { name: '设置' });
    expect(button).toHaveAttribute('aria-disabled', 'true');

    await user.click(button);

    expect(onOpenSettings).not.toHaveBeenCalled();
    expect(onRecordingBlocked).toHaveBeenCalledOnce();
  });
});

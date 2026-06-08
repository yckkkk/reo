import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsShell } from './SettingsShell';

describe('SettingsShell', () => {
  it('renders the return action, category nav, active section, and content area', () => {
    const onSectionChange = vi.fn();

    render(
      <SettingsShell
        activeSection="permissions"
        onReturnToApp={vi.fn()}
        onSectionChange={onSectionChange}
      >
        <div>权限内容</div>
      </SettingsShell>
    );

    const titlebar = screen.getByRole('banner', { name: '设置标题栏' });
    expect(titlebar).toHaveAttribute('data-slot', 'settings-titlebar');
    expect(titlebar).toHaveClass('inset-x-0', '[-webkit-app-region:drag]');
    expect(titlebar).toHaveStyle({ height: '48px' });
    const sidebar = screen.getByRole('complementary', { name: '设置侧边栏' });
    expect(sidebar).toHaveClass('bg-card', 'px-8', '[-webkit-app-region:drag]');
    expect(sidebar).toHaveStyle({ paddingTop: '48px', width: '240px' });
    expect(sidebar).not.toHaveClass('bg-secondary');
    expect(screen.getByRole('button', { name: '返回应用' })).toHaveClass(
      '[-webkit-app-region:no-drag]'
    );
    expect(screen.getByRole('navigation', { name: '设置类目' })).toHaveClass(
      'mt-4',
      'gap-4',
      '[-webkit-app-region:no-drag]'
    );
    const permissionsCategory = screen.getByRole('button', { name: '权限' });
    const voiceCategory = screen.getByRole('button', { name: '语音' });
    expect(permissionsCategory).toHaveAttribute('aria-current', 'page');
    expect(permissionsCategory).toHaveClass('!bg-secondary', '[-webkit-app-region:no-drag]');
    expect(voiceCategory).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('region', { name: '权限设置' })).toHaveTextContent('权限内容');
    expect(screen.getByRole('heading', { name: '权限' })).toBeInTheDocument();
  });

  it('emits section changes through the settings category nav', async () => {
    const onSectionChange = vi.fn();

    render(
      <SettingsShell
        activeSection="permissions"
        onReturnToApp={vi.fn()}
        onSectionChange={onSectionChange}
      >
        <div />
      </SettingsShell>
    );

    await userEvent.click(screen.getByRole('button', { name: '语音' }));

    expect(onSectionChange).toHaveBeenCalledWith('voice');
  });

  it('calls onReturnToApp when the return action is clicked', async () => {
    const onReturnToApp = vi.fn();

    render(
      <SettingsShell onReturnToApp={onReturnToApp}>
        <div />
      </SettingsShell>
    );

    await userEvent.click(screen.getByRole('button', { name: '返回应用' }));

    expect(onReturnToApp).toHaveBeenCalledOnce();
  });

  it('uses Escape to return only when navigation is not locked', async () => {
    const onReturnToApp = vi.fn();
    const { rerender } = render(
      <SettingsShell onReturnToApp={onReturnToApp}>
        <div />
      </SettingsShell>
    );

    await userEvent.keyboard('{Escape}');

    expect(onReturnToApp).toHaveBeenCalledOnce();

    rerender(
      <SettingsShell returnDisabled onReturnToApp={onReturnToApp}>
        <div />
      </SettingsShell>
    );

    await userEvent.keyboard('{Escape}');

    expect(onReturnToApp).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '返回应用' })).toBeDisabled();
  });
});

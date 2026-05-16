import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsShell } from './SettingsShell';

describe('SettingsShell', () => {
  it('renders the return action, category nav, active voice category, and content area', () => {
    render(
      <SettingsShell onReturnToApp={vi.fn()}>
        <div>语音内容</div>
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
    const voiceCategory = screen.getByRole('button', { name: '语音' });
    expect(voiceCategory).toHaveAttribute('aria-current', 'page');
    expect(voiceCategory).toHaveClass('bg-secondary', '[-webkit-app-region:no-drag]');
    expect(screen.getByRole('region', { name: '语音设置' })).toHaveTextContent('语音内容');
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

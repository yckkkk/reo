import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsShell } from './SettingsShell';

describe('SettingsShell', () => {
  it('renders the return action, category nav, active voice category, and content area', () => {
    render(
      <SettingsShell activeCategory="voice" onReturnToApp={vi.fn()} onSelectCategory={vi.fn()}>
        <div>语音内容</div>
      </SettingsShell>
    );

    const titlebar = screen.getByRole('banner', { name: '设置标题栏' });
    expect(titlebar).toHaveAttribute('data-slot', 'settings-titlebar');
    expect(titlebar).toHaveClass(
      'left-[240px]',
      'h-[48px]',
      'bg-background',
      '[-webkit-app-region:drag]'
    );
    const sidebar = screen.getByRole('complementary', { name: '设置侧边栏' });
    expect(sidebar).toHaveClass('w-[240px]', 'bg-card', 'px-8', 'pt-[48px]');
    expect(sidebar).not.toHaveClass('bg-secondary');
    expect(screen.getByRole('button', { name: '返回应用' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '设置类目' })).toHaveClass('mt-4', 'gap-4');
    const voiceCategory = screen.getByRole('button', { name: '语音' });
    expect(voiceCategory).toHaveAttribute('aria-current', 'page');
    expect(voiceCategory).toHaveClass('bg-secondary');
    expect(screen.getByRole('region', { name: '语音设置' })).toHaveTextContent('语音内容');
  });

  it('calls onReturnToApp when the return action is clicked', async () => {
    const onReturnToApp = vi.fn();

    render(
      <SettingsShell
        activeCategory="voice"
        onReturnToApp={onReturnToApp}
        onSelectCategory={vi.fn()}
      >
        <div />
      </SettingsShell>
    );

    await userEvent.click(screen.getByRole('button', { name: '返回应用' }));

    expect(onReturnToApp).toHaveBeenCalledOnce();
  });

  it('calls onSelectCategory when the voice category is clicked', async () => {
    const onSelectCategory = vi.fn();

    render(
      <SettingsShell
        activeCategory="voice"
        onReturnToApp={vi.fn()}
        onSelectCategory={onSelectCategory}
      >
        <div />
      </SettingsShell>
    );

    await userEvent.click(screen.getByRole('button', { name: '语音' }));

    expect(onSelectCategory).toHaveBeenCalledWith('voice');
  });
});

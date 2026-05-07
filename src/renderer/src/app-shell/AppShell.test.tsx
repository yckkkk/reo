import { fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell, type ThemeMode } from './AppShell';

describe('AppShell', () => {
  function TestAppShell({
    children,
    onNewMemory,
  }: {
    readonly children: ReactNode;
    readonly onNewMemory?: () => void;
  }) {
    const [themeMode, setThemeMode] = useState<ThemeMode>('light');

    return (
      <AppShell
        themeMode={themeMode}
        onToggleTheme={() =>
          setThemeMode((currentMode) => (currentMode === 'light' ? 'dark' : 'light'))
        }
        onNewMemory={onNewMemory}
      >
        {children}
      </AppShell>
    );
  }

  it('renders a layered workspace sidebar without unimplemented media routes', () => {
    render(
      <TestAppShell onNewMemory={vi.fn()}>
        <div>Home content</div>
      </TestAppShell>
    );

    expect(screen.getByRole('navigation', { name: 'Workspace' })).toBeInTheDocument();
    const sidebar = screen.getByRole('complementary', { name: 'Workspace sidebar' });
    expect(sidebar).toHaveStyle({ zIndex: '1', width: '240px' });
    const panel = screen.getByRole('main', { name: 'Workspace content' });
    expect(panel).toHaveStyle({
      inset: '0',
      transform: 'translateX(240px)',
      width: 'calc(100% - 240px)',
    });
    expect(panel.style.borderRadius).toBe('12px 0 0 12px');
    expect(panel.style.zIndex).toBe('2');
    expect(screen.getByText('Home')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'New memory' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Window controls' })).toBeInTheDocument();
    expect(screen.queryByText(/films|photos|videos|files/i)).not.toBeInTheDocument();
  });

  it('can render starter shell navigation before a workspace exists', () => {
    render(
      <TestAppShell>
        <div>Starter home</div>
      </TestAppShell>
    );

    expect(screen.getByText('Home')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'New memory' })).not.toBeInTheDocument();
  });

  it('toggles the app theme from the sidebar tool area', () => {
    render(
      <TestAppShell>
        <div>Starter home</div>
      </TestAppShell>
    );

    const shell = screen.getByRole('main', { name: 'Workspace content' }).closest('[data-theme]');
    expect(shell).toHaveAttribute('data-theme', 'light');

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));

    expect(shell).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('covers the sidebar with a transform-driven floating panel when collapsed', () => {
    render(
      <TestAppShell onNewMemory={vi.fn()}>
        <div>Home content</div>
      </TestAppShell>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hide sidebar' }));

    expect(screen.getByRole('button', { name: 'Show sidebar' })).toBeInTheDocument();
    expect(screen.getByText('Home')).toHaveAttribute('aria-current', 'page');
    const panel = screen.getByRole('main', { name: 'Workspace content' });
    expect(panel).toHaveStyle({
      transform: 'translateX(0px)',
      width: '100%',
    });
    expect(panel.style.borderRadius).toBe('0px');
  });

  it('clamps direct sidebar resizing between 240 and 520 pixels', () => {
    render(
      <TestAppShell onNewMemory={vi.fn()}>
        <div>Home content</div>
      </TestAppShell>
    );

    const handle = screen.getByRole('separator', { name: 'Resize sidebar' });
    expect(handle).toHaveAttribute('aria-valuemin', '240');
    expect(handle).toHaveAttribute('aria-valuemax', '520');
    expect(handle).toHaveAttribute('aria-valuenow', '240');
    expect(handle).toHaveStyle({ width: '8px' });
    expect(handle).toHaveClass('hover:bg-chalk/40');

    fireEvent.pointerDown(handle, { clientX: 240, pointerId: 1 });
    expect(screen.getByRole('main', { name: 'Workspace content' }).className).not.toContain(
      'duration-[280ms]'
    );
    fireEvent.pointerMove(handle, { clientX: 900, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(screen.getByRole('complementary', { name: 'Workspace sidebar' })).toHaveStyle({
      width: '520px',
    });
    expect(screen.getByRole('main', { name: 'Workspace content' })).toHaveStyle({
      transform: 'translateX(520px)',
    });

    fireEvent.pointerDown(handle, { clientX: 520, pointerId: 2 });
    fireEvent.pointerMove(handle, { clientX: 100, pointerId: 2 });
    fireEvent.pointerUp(handle, { pointerId: 2 });

    expect(screen.getByRole('complementary', { name: 'Workspace sidebar' })).toHaveStyle({
      width: '240px',
    });
    expect(screen.getByRole('main', { name: 'Workspace content' })).toHaveStyle({
      transform: 'translateX(240px)',
    });
  });

  it('supports keyboard sidebar resizing through the separator', () => {
    render(
      <TestAppShell onNewMemory={vi.fn()}>
        <div>Home content</div>
      </TestAppShell>
    );

    const handle = screen.getByRole('separator', { name: 'Resize sidebar' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });

    expect(handle).toHaveAttribute('aria-valuenow', '260');
    expect(screen.getByRole('complementary', { name: 'Workspace sidebar' })).toHaveStyle({
      width: '260px',
    });

    fireEvent.keyDown(handle, { key: 'ArrowLeft' });

    expect(handle).toHaveAttribute('aria-valuenow', '240');
    expect(screen.getByRole('complementary', { name: 'Workspace sidebar' })).toHaveStyle({
      width: '240px',
    });
  });

  it('stops resizing after pointer cancellation', () => {
    render(
      <TestAppShell onNewMemory={vi.fn()}>
        <div>Home content</div>
      </TestAppShell>
    );

    const handle = screen.getByRole('separator', { name: 'Resize sidebar' });
    fireEvent.pointerDown(handle, { clientX: 240, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 320, pointerId: 1 });
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 520, pointerId: 1 });

    expect(screen.getByRole('complementary', { name: 'Workspace sidebar' })).toHaveStyle({
      width: '320px',
    });
  });
});

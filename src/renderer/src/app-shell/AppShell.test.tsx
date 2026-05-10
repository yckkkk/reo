import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell, TITLEBAR_HEIGHT, type ThemeMode } from './AppShell';

describe('AppShell', () => {
  function TestAppShell({
    activeWorkspaceId,
    activeSection,
    children,
    onCreateWorkspace = vi.fn(),
    onHome,
    onLibrary = vi.fn(),
    onOpenLocalWorkspace = vi.fn(),
    onRemoveMemorySpace = vi.fn(),
    onSelectMemorySpace,
    memorySpaces = [
      { title: 'reo', workspaceId: 'ws_reo' },
      { title: 'MemoryOS_V1', workspaceId: 'ws_memory' },
    ],
  }: {
    readonly activeWorkspaceId?: string;
    readonly activeSection?: 'home' | 'library' | 'workspace';
    readonly children: ReactNode;
    readonly onCreateWorkspace?: () => void;
    readonly onHome?: () => void;
    readonly onLibrary?: () => void;
    readonly onOpenLocalWorkspace?: () => void;
    readonly onRemoveMemorySpace?: (memorySpace: {
      readonly title: string;
      readonly workspaceId: string;
    }) => void;
    readonly onSelectMemorySpace?: (workspaceId: string) => void;
    readonly memorySpaces?: ReadonlyArray<{
      readonly title: string;
      readonly workspaceId: string;
    }>;
  }) {
    const [themeMode, setThemeMode] = useState<ThemeMode>('light');

    return (
      <AppShell
        activeWorkspaceId={activeWorkspaceId}
        activeSection={activeSection}
        themeMode={themeMode}
        memorySpaces={memorySpaces}
        onCreateWorkspace={onCreateWorkspace}
        onToggleTheme={() =>
          setThemeMode((currentMode) => (currentMode === 'light' ? 'dark' : 'light'))
        }
        onHome={onHome ?? (() => {})}
        onLibrary={onLibrary}
        onOpenLocalWorkspace={onOpenLocalWorkspace}
        onRemoveMemorySpace={onRemoveMemorySpace}
        onSelectMemorySpace={onSelectMemorySpace}
      >
        {children}
      </AppShell>
    );
  }

  it('renders a compact Chinese memory space sidebar', () => {
    render(
      <TestAppShell activeWorkspaceId="ws_reo" activeSection="workspace">
        <div>Home content</div>
      </TestAppShell>
    );

    const appShellRoot = document.querySelector('[data-slot="app-shell-root"]');
    expect(appShellRoot).toBeInTheDocument();
    expect(appShellRoot).toHaveClass(
      'relative',
      'h-screen',
      'min-h-0',
      'w-screen',
      'overflow-hidden'
    );
    expect(screen.getByRole('navigation', { name: '记忆空间' })).toBeInTheDocument();
    const sidebar = screen.getByRole('complementary', { name: '记忆空间侧边栏' });
    expect(sidebar).toHaveStyle({ zIndex: '1', width: '240px' });
    const panel = screen.getByRole('main', { name: '记忆空间内容' });
    expect(panel).toHaveStyle({
      bottom: '0px',
      left: '240px',
      right: '0px',
      top: '0px',
    });
    expect(panel.style.borderRadius).toBe('12px 0 0 12px');
    expect(panel.style.zIndex).toBe('2');
    const titlebar = screen.getByRole('banner', { name: '标题栏' });
    expect(TITLEBAR_HEIGHT).toBe(48);
    expect(titlebar).toHaveAttribute('data-slot', 'app-shell-titlebar');
    expect(titlebar).toHaveClass(
      'h-titlebar',
      'border-0',
      'bg-transparent',
      '[-webkit-app-region:drag]'
    );
    expect(titlebar).toHaveStyle({ zIndex: '5' });
    expect(panel).toHaveClass('flex', 'min-h-0', 'flex-col', 'overflow-hidden');
    const panelTitlebar = panel.querySelector('[data-slot="app-shell-panel-titlebar"]');
    expect(panelTitlebar).toBeInTheDocument();
    expect(panelTitlebar).toHaveClass('h-titlebar', 'shrink-0');
    const panelContent = panel.querySelector('[data-slot="app-shell-panel-content"]');
    expect(panelContent).toBeInTheDocument();
    expect(panelContent).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col', 'overflow-hidden');
    expect(sidebar).toHaveClass('pt-sidebar-content-top');
    expect(screen.queryByText('REO')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '首页' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: '资料库' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('button', { name: '记忆' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '收藏' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新记忆' })).not.toBeInTheDocument();
    expect(screen.getByText('记忆空间')).toHaveClass('text-ui-sm', 'font-regular');
    const activeWorkspaceButton = screen.getByRole('button', { name: 'reo' });
    const activeWorkspaceMoreButton = screen.getByRole('button', { name: 'reo 更多操作' });
    const activeWorkspaceItem = activeWorkspaceButton.closest(
      '[data-slot="workspace-memory-space-item"]'
    );
    expect(activeWorkspaceButton).toHaveAttribute('aria-current', 'page');
    expect(activeWorkspaceItem).toContainElement(activeWorkspaceButton);
    expect(activeWorkspaceItem).toContainElement(activeWorkspaceMoreButton);
    expect(activeWorkspaceItem).toHaveClass('rounded-buttons', 'border', 'border-chalk');
    expect(activeWorkspaceMoreButton).toHaveClass(
      'opacity-0',
      'pointer-events-none',
      'group-hover/memorySpace:opacity-100',
      'group-hover/memorySpace:pointer-events-auto',
      'group-focus-within/memorySpace:opacity-100',
      'group-focus-within/memorySpace:pointer-events-auto'
    );
    expect(screen.getByRole('button', { name: 'MemoryOS_V1' })).toBeInTheDocument();
    const windowControls = screen.getByRole('group', { name: '窗口控制' });
    expect(windowControls).toHaveAttribute('data-slot', 'app-shell-titlebar-controls');
    expect(windowControls).toHaveClass('items-center', '[-webkit-app-region:no-drag]');
    expect(windowControls).not.toHaveClass('top-0', 'h-titlebar');
    expect(windowControls).toHaveStyle({
      left: 'var(--spacing-titlebar-control-left)',
      top: 'var(--spacing-titlebar-control-top)',
    });
    expect(screen.queryByText('隐藏侧边栏')).not.toBeInTheDocument();
    expect(screen.queryByText(/films|photos|videos|files/i)).not.toBeInTheDocument();
  });

  it('opens the compact add workspace menu from the workspace header', async () => {
    const user = userEvent.setup();
    const onCreateWorkspace = vi.fn();
    const onOpenLocalWorkspace = vi.fn();

    render(
      <TestAppShell
        onCreateWorkspace={onCreateWorkspace}
        onOpenLocalWorkspace={onOpenLocalWorkspace}
      >
        <div>Starter home</div>
      </TestAppShell>
    );

    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));

    const menu = screen.getByRole('menu', { name: '添加记忆空间' });
    expect(menu).toHaveClass('rounded-xl', 'bg-card-glass', 'backdrop-blur-glass-md');
    expect(menu).toHaveAttribute('data-slot', 'dropdown-menu-content');
    expect(menu).not.toHaveClass('left-full', 'ml-8');
    expect(screen.getByRole('complementary', { name: '记忆空间侧边栏' })).toHaveStyle({
      zIndex: '4',
    });
    expect(screen.getByRole('main', { name: '记忆空间内容' })).toHaveStyle({
      zIndex: '2',
    });
    const createItem = screen.getByRole('menuitem', { name: '创建本地记忆空间' });
    const openLocalWorkspaceItem = screen.getByRole('menuitem', { name: '打开本地记忆空间' });
    expect(createItem).toHaveClass('min-h-32', 'text-ui-xs', 'font-regular');
    expect(openLocalWorkspaceItem).toHaveClass('min-h-32', 'text-ui-xs', 'font-regular');

    await user.click(createItem);
    expect(onCreateWorkspace).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));
    await user.click(screen.getByRole('menuitem', { name: '打开本地记忆空间' }));
    expect(onOpenLocalWorkspace).toHaveBeenCalledOnce();
  });

  it('reveals the add workspace icon only from the named workspace header row', async () => {
    const user = userEvent.setup();

    render(
      <TestAppShell>
        <div>Starter home</div>
      </TestAppShell>
    );

    const memorySpaceActions = screen.getByRole('group', { name: '记忆空间操作' });
    expect(memorySpaceActions).toHaveClass('group');

    const addButton = screen.getByRole('button', { name: '添加记忆空间' });
    expect(addButton).toHaveAccessibleName('添加记忆空间');
    expect(addButton).toHaveClass(
      'opacity-0',
      'pointer-events-none',
      'group-hover:opacity-100',
      'group-hover:pointer-events-auto',
      'group-focus-within:opacity-100',
      'group-focus-within:pointer-events-auto'
    );

    await user.click(addButton);

    expect(addButton).toHaveClass(
      'data-[state=open]:opacity-100',
      'data-[state=open]:pointer-events-auto'
    );
    expect(addButton).toHaveAttribute('data-state', 'open');
  });

  it('restores focus to the add workspace trigger when its menu closes without launching a flow', async () => {
    const user = userEvent.setup();

    render(
      <TestAppShell>
        <div>Starter home</div>
      </TestAppShell>
    );

    const addButton = screen.getByRole('button', { name: '添加记忆空间' });

    await user.click(addButton);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu', { name: '添加记忆空间' })).not.toBeInTheDocument();
    expect(addButton).toHaveFocus();
  });

  it('gives each interactive component an accessible name instead of positional names', async () => {
    const user = userEvent.setup();

    render(
      <TestAppShell>
        <div>Starter home</div>
      </TestAppShell>
    );

    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));

    for (const button of screen.queryAllByRole('button')) {
      expect(button).toHaveAccessibleName();
    }
    for (const menuItem of screen.getAllByRole('menuitem')) {
      expect(menuItem).toHaveAccessibleName();
    }
  });

  it('can render starter shell navigation before a workspace exists', () => {
    const onHome = vi.fn();

    render(
      <TestAppShell onHome={onHome} memorySpaces={[]}>
        <div>Starter home</div>
      </TestAppShell>
    );

    const homeButton = screen.getByRole('button', { name: '首页' });
    expect(homeButton).toHaveAttribute('aria-current', 'page');
    fireEvent.click(homeButton);
    expect(onHome).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: '新记忆' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '资料库' })).toBeInTheDocument();
    expect(screen.getByText('记忆空间')).toBeInTheDocument();
  });

  it('wires named sidebar navigation items and closes the add menu before navigation', async () => {
    const user = userEvent.setup();
    const onHome = vi.fn();
    const onLibrary = vi.fn();
    const onSelectMemorySpace = vi.fn();

    render(
      <TestAppShell onHome={onHome} onLibrary={onLibrary} onSelectMemorySpace={onSelectMemorySpace}>
        <div>Detail content</div>
      </TestAppShell>
    );

    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));
    expect(screen.getByRole('menu', { name: '添加记忆空间' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '首页' }));

    expect(onHome).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu', { name: '添加记忆空间' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));
    await user.click(screen.getByRole('button', { name: '资料库' }));

    expect(onLibrary).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu', { name: '添加记忆空间' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '添加记忆空间' }));
    await user.click(screen.getByRole('button', { name: 'MemoryOS_V1' }));

    expect(onSelectMemorySpace).toHaveBeenCalledWith('ws_memory');
    expect(screen.queryByRole('menu', { name: '添加记忆空间' })).not.toBeInTheDocument();
  });

  it('opens a workspace item more menu and requests removal from the workspace list', async () => {
    const user = userEvent.setup();
    const onRemoveMemorySpace = vi.fn();

    render(
      <TestAppShell
        activeWorkspaceId="ws_reo"
        activeSection="workspace"
        onRemoveMemorySpace={onRemoveMemorySpace}
      >
        <div>Home content</div>
      </TestAppShell>
    );

    await user.click(screen.getByRole('button', { name: 'reo 更多操作' }));

    expect(screen.getByRole('menu', { name: 'reo 更多操作' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'reo 更多操作' })).toHaveClass(
      'data-[state=open]:pointer-events-auto',
      'data-[state=open]:opacity-100'
    );
    expect(screen.getByRole('complementary', { name: '记忆空间侧边栏' })).toHaveStyle({
      zIndex: '4',
    });

    await user.click(screen.getByRole('menuitem', { name: '移除记忆空间' }));

    expect(onRemoveMemorySpace).toHaveBeenCalledWith({
      title: 'reo',
      workspaceId: 'ws_reo',
    });
    expect(screen.queryByRole('menu', { name: 'reo 更多操作' })).not.toBeInTheDocument();
  });

  it('toggles the app theme from the sidebar tool area', () => {
    render(
      <TestAppShell>
        <div>Starter home</div>
      </TestAppShell>
    );

    const shell = screen.getByRole('main', { name: '记忆空间内容' }).closest('[data-theme]');
    expect(shell).toHaveAttribute('data-theme', 'light');

    fireEvent.click(screen.getByRole('button', { name: '切换到深色模式' }));

    expect(shell).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: '切换到浅色模式' })).toBeInTheDocument();
  });

  it('anchors the panel right edge and expands left when collapsed', () => {
    render(
      <TestAppShell>
        <div>Home content</div>
      </TestAppShell>
    );

    const windowControls = screen.getByRole('group', { name: '窗口控制' });
    expect(windowControls).toHaveClass('items-center');
    expect(windowControls).not.toHaveClass('top-0', 'h-titlebar');
    expect(windowControls).toHaveStyle({
      left: 'var(--spacing-titlebar-control-left)',
      top: 'var(--spacing-titlebar-control-top)',
    });

    fireEvent.click(screen.getByRole('button', { name: '隐藏侧边栏' }));

    expect(screen.getByRole('button', { name: '显示侧边栏' })).toBeInTheDocument();
    expect(windowControls).toHaveClass('items-center');
    expect(windowControls).not.toHaveClass('top-0', 'h-titlebar');
    expect(windowControls).toHaveStyle({
      left: 'var(--spacing-titlebar-control-left)',
      top: 'var(--spacing-titlebar-control-top)',
    });
    expect(screen.getByRole('button', { name: '首页' })).toHaveAttribute('aria-current', 'page');
    const panel = screen.getByRole('main', { name: '记忆空间内容' });
    expect(panel).toHaveStyle({
      bottom: '0px',
      left: '0px',
      right: '0px',
      top: '0px',
    });
    expect(panel.className).not.toContain('transition-[transform,width]');
    expect(panel.className).toContain('transition-[left,border-radius]');
    expect(panel.style.borderRadius).toBe('0px');
  });

  it('clamps direct sidebar resizing between 240 and 520 pixels', () => {
    render(
      <TestAppShell>
        <div>Home content</div>
      </TestAppShell>
    );

    const handle = screen.getByRole('separator', { name: '调整侧边栏宽度' });
    expect(handle).toHaveAttribute('aria-valuemin', '240');
    expect(handle).toHaveAttribute('aria-valuemax', '520');
    expect(handle).toHaveAttribute('aria-valuenow', '240');
    expect(handle).toHaveStyle({ width: '8px' });
    expect(handle).not.toHaveClass('hover:bg-chalk/40');
    expect(handle).not.toHaveClass('focus-visible:bg-chalk/60');

    fireEvent.pointerDown(handle, { clientX: 240, pointerId: 1 });
    expect(screen.getByRole('main', { name: '记忆空间内容' }).className).not.toContain(
      'duration-[280ms]'
    );
    fireEvent.pointerMove(handle, { clientX: 900, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(screen.getByRole('complementary', { name: '记忆空间侧边栏' })).toHaveStyle({
      width: '520px',
    });
    expect(screen.getByRole('main', { name: '记忆空间内容' })).toHaveStyle({
      left: '520px',
      right: '0px',
    });

    fireEvent.pointerDown(handle, { clientX: 520, pointerId: 2 });
    fireEvent.pointerMove(handle, { clientX: 100, pointerId: 2 });
    fireEvent.pointerUp(handle, { pointerId: 2 });

    expect(screen.getByRole('complementary', { name: '记忆空间侧边栏' })).toHaveStyle({
      width: '240px',
    });
    expect(screen.getByRole('main', { name: '记忆空间内容' })).toHaveStyle({
      left: '240px',
      right: '0px',
    });
  });

  it('supports keyboard sidebar resizing through the separator', () => {
    render(
      <TestAppShell>
        <div>Home content</div>
      </TestAppShell>
    );

    const handle = screen.getByRole('separator', { name: '调整侧边栏宽度' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });

    expect(handle).toHaveAttribute('aria-valuenow', '260');
    expect(screen.getByRole('complementary', { name: '记忆空间侧边栏' })).toHaveStyle({
      width: '260px',
    });

    fireEvent.keyDown(handle, { key: 'ArrowLeft' });

    expect(handle).toHaveAttribute('aria-valuenow', '240');
    expect(screen.getByRole('complementary', { name: '记忆空间侧边栏' })).toHaveStyle({
      width: '240px',
    });
  });

  it('stops resizing after pointer cancellation', () => {
    render(
      <TestAppShell>
        <div>Home content</div>
      </TestAppShell>
    );

    const handle = screen.getByRole('separator', { name: '调整侧边栏宽度' });
    fireEvent.pointerDown(handle, { clientX: 240, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 320, pointerId: 1 });
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 520, pointerId: 1 });

    expect(screen.getByRole('complementary', { name: '记忆空间侧边栏' })).toHaveStyle({
      width: '320px',
    });
  });
});

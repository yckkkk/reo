import { Folder, FolderPlus, Home, Menu, Mic2, Moon, PanelLeftClose, Sun } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { MenuItemButton, MenuSurface } from '@/components/ui/menu';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type AppShellState = 'expanded' | 'covered';
export type ThemeMode = 'light' | 'dark';

export const MIN_SIDEBAR_WIDTH = 240;
export const MAX_SIDEBAR_WIDTH = 520;
export const SIDEBAR_RESIZE_STEP = 20;
export const PANEL_RADIUS = 12;
export const TITLEBAR_HEIGHT = 48;
const PANEL_MOTION_CLASS =
  'transition-[left,border-radius] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';

type AppShellProps = {
  readonly activeWorkspaceId?: string | undefined;
  readonly children: React.ReactNode;
  readonly onCreateWorkspace?: (() => void) | undefined;
  readonly onHome: () => void;
  readonly onNewMemory?: (() => void) | undefined;
  readonly onOpenLocalWorkspace?: (() => void) | undefined;
  readonly onSelectWorkspace?: ((workspaceId: string) => void) | undefined;
  readonly onToggleTheme: () => void;
  readonly themeMode: ThemeMode;
  readonly workspaceProjects?: readonly WorkspaceProject[] | undefined;
};

export type WorkspaceProject = {
  readonly title: string;
  readonly workspaceId: string;
};

type DragState = {
  readonly pointerId: number;
  readonly startWidth: number;
  readonly startX: number;
};

export function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

export function AppShell({
  activeWorkspaceId,
  children,
  onCreateWorkspace,
  onHome,
  onNewMemory,
  onOpenLocalWorkspace,
  onSelectWorkspace,
  onToggleTheme,
  themeMode,
  workspaceProjects = [],
}: AppShellProps) {
  const [sidebarState, setSidebarState] = React.useState<AppShellState>('expanded');
  const [sidebarWidth, setSidebarWidth] = React.useState(MIN_SIDEBAR_WIDTH);
  const [dragState, setDragState] = React.useState<DragState | null>(null);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = React.useState(false);
  const safeSidebarWidth = clampSidebarWidth(sidebarWidth);

  function handleResizePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startWidth: safeSidebarWidth,
      startX: event.clientX,
    });
  }

  function handleResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSidebarWidth(clampSidebarWidth(safeSidebarWidth - SIDEBAR_RESIZE_STEP));
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSidebarWidth(clampSidebarWidth(safeSidebarWidth + SIDEBAR_RESIZE_STEP));
    }
  }

  function handleResizePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }
    const nextWidth = clampSidebarWidth(dragState.startWidth + event.clientX - dragState.startX);
    setSidebarWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  }

  function endResize(event: React.PointerEvent<HTMLDivElement>) {
    if (dragState && event.pointerId === dragState.pointerId) {
      setDragState(null);
    }
  }

  const panelLeft = sidebarState === 'expanded' ? `${safeSidebarWidth}px` : '0px';
  const panelRadius =
    sidebarState === 'expanded' ? `${PANEL_RADIUS}px 0 0 ${PANEL_RADIUS}px` : '0px';
  const panelMotionClass = dragState ? '' : PANEL_MOTION_CLASS;
  const SidebarToggleIcon = sidebarState === 'expanded' ? PanelLeftClose : Menu;
  const sidebarToggleLabel = sidebarState === 'expanded' ? '隐藏侧边栏' : '显示侧边栏';
  const ThemeToggleIcon = themeMode === 'dark' ? Sun : Moon;
  const themeToggleLabel = themeMode === 'dark' ? '切换到浅色模式' : '切换到深色模式';

  function handleCreateWorkspace() {
    setWorkspaceMenuOpen(false);
    onCreateWorkspace?.();
  }

  function handleHome() {
    setWorkspaceMenuOpen(false);
    onHome();
  }

  function handleOpenLocalWorkspace() {
    setWorkspaceMenuOpen(false);
    onOpenLocalWorkspace?.();
  }

  function handleSelectWorkspace(workspaceId: string) {
    setWorkspaceMenuOpen(false);
    onSelectWorkspace?.(workspaceId);
  }

  return (
    <TooltipProvider>
      <div
        data-theme={themeMode}
        className="relative min-h-screen overflow-hidden bg-eggshell text-obsidian"
      >
        <div
          role="banner"
          aria-label="标题栏"
          data-slot="app-shell-titlebar"
          className="pointer-events-auto absolute inset-x-0 top-0 h-titlebar border-0 bg-transparent [-webkit-app-region:drag]"
          style={{
            zIndex: 5,
          }}
        >
          <div
            role="group"
            aria-label="窗口控制"
            data-slot="app-shell-titlebar-controls"
            className="pointer-events-auto absolute flex items-center gap-8 [-webkit-app-region:no-drag]"
            style={{
              left: 'var(--spacing-titlebar-control-left)',
              top: 'var(--spacing-titlebar-control-top)',
            }}
          >
            <Button
              type="button"
              variant="ghostIcon"
              size="icon"
              aria-label={sidebarToggleLabel}
              onClick={() => {
                setWorkspaceMenuOpen(false);
                setSidebarState(sidebarState === 'expanded' ? 'covered' : 'expanded');
              }}
            >
              <SidebarToggleIcon className="size-16" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <aside
          aria-label="工作区侧边栏"
          className="absolute inset-y-0 left-0 flex flex-col bg-eggshell px-12 pb-16 pt-sidebar-content-top"
          style={{ width: `${safeSidebarWidth}px`, zIndex: workspaceMenuOpen ? 4 : 1 }}
        >
          <nav className="flex flex-col gap-4" aria-label="工作区">
            <Button
              type="button"
              variant="secondary"
              size="compact"
              aria-current="page"
              className="w-full justify-start border-transparent bg-powder px-8 text-cinder hover:border-chalk hover:bg-powder"
              onClick={handleHome}
            >
              <Home className="size-16" aria-hidden="true" />
              首页
            </Button>
            {onNewMemory ? (
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className="w-full justify-start border-transparent bg-transparent px-8 text-cinder hover:border-chalk hover:bg-powder"
                onClick={onNewMemory}
              >
                <Mic2 className="size-16" aria-hidden="true" />
                新记忆
              </Button>
            ) : null}
          </nav>

          <section className="relative mt-28" aria-labelledby="workspace-projects-heading">
            <div
              role="group"
              aria-label="项目操作"
              className="group mb-8 flex items-center justify-between gap-8"
            >
              <h2
                id="workspace-projects-heading"
                className="px-8 text-ui-sm font-regular leading-ui-sm text-slate"
              >
                项目
              </h2>
              {onCreateWorkspace || onOpenLocalWorkspace ? (
                <div className="relative shrink-0">
                  <Button
                    type="button"
                    variant="ghostIcon"
                    size="icon"
                    aria-expanded={workspaceMenuOpen}
                    aria-haspopup="menu"
                    aria-label="添加工作区"
                    data-state={workspaceMenuOpen ? 'open' : 'closed'}
                    className="pointer-events-none size-28 rounded-buttons text-slate opacity-0 hover:bg-powder hover:text-obsidian group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:opacity-100"
                    onClick={() => setWorkspaceMenuOpen((open) => !open)}
                  >
                    <FolderPlus className="size-16" aria-hidden="true" />
                  </Button>

                  {workspaceMenuOpen ? (
                    <MenuSurface
                      aria-label="添加工作区菜单"
                      className="absolute left-0 top-36 z-10"
                    >
                      <MenuItemButton
                        icon={<FolderPlus className="size-16" aria-hidden="true" />}
                        onClick={handleCreateWorkspace}
                      >
                        新建空白项目
                      </MenuItemButton>
                      <MenuItemButton
                        icon={<Folder className="size-16" aria-hidden="true" />}
                        onClick={handleOpenLocalWorkspace}
                      >
                        打开本地工作区
                      </MenuItemButton>
                    </MenuSurface>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-4">
              {workspaceProjects.map((project) => (
                <Button
                  key={project.workspaceId}
                  type="button"
                  variant="secondary"
                  size="compact"
                  aria-current={project.workspaceId === activeWorkspaceId ? 'page' : undefined}
                  className="w-full justify-start border-transparent bg-transparent px-8 text-cinder hover:border-chalk hover:bg-powder aria-[current=page]:bg-powder"
                  onClick={() => handleSelectWorkspace(project.workspaceId)}
                >
                  <Folder className="size-16" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-left">{project.title}</span>
                  {project.workspaceId === activeWorkspaceId ? (
                    <span className="size-4 rounded-full bg-signal-blue" aria-hidden="true" />
                  ) : null}
                </Button>
              ))}
            </div>
          </section>

          <div className="mt-auto flex items-center">
            <Tooltip>
              <Button asChild variant="ghostIcon" size="icon">
                <TooltipTrigger type="button" aria-label={themeToggleLabel} onClick={onToggleTheme}>
                  <ThemeToggleIcon className="size-16" aria-hidden="true" />
                </TooltipTrigger>
              </Button>
              <TooltipContent side="right">{themeToggleLabel}</TooltipContent>
            </Tooltip>
          </div>

          <Separator
            aria-label="调整侧边栏宽度"
            aria-valuemax={MAX_SIDEBAR_WIDTH}
            aria-valuemin={MIN_SIDEBAR_WIDTH}
            aria-valuenow={safeSidebarWidth}
            decorative={false}
            orientation="vertical"
            className="absolute right-0 top-0 h-full cursor-col-resize bg-transparent"
            style={{ width: 8 }}
            tabIndex={0}
            onKeyDown={handleResizeKeyDown}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onLostPointerCapture={endResize}
          />
        </aside>

        <main
          aria-label="工作区内容"
          className={`absolute flex flex-col overflow-hidden border border-chalk bg-card-white shadow-subtle ${panelMotionClass}`}
          style={{
            borderRadius: panelRadius,
            bottom: 0,
            left: panelLeft,
            right: 0,
            top: 0,
            zIndex: 2,
          }}
        >
          <div
            data-slot="app-shell-panel-titlebar"
            className="h-titlebar shrink-0"
            aria-hidden="true"
          />
          <div data-slot="app-shell-panel-content" className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

import {
  Folder,
  FolderPlus,
  Home,
  Library,
  Menu,
  MoreHorizontal,
  Moon,
  PanelLeftClose,
  Sun,
  Trash2,
} from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type AppShellState = 'expanded' | 'covered';
export type AppShellActiveSection = 'home' | 'library' | 'workspace';
export type ThemeMode = 'light' | 'dark';

export const MIN_SIDEBAR_WIDTH = 240;
export const MAX_SIDEBAR_WIDTH = 520;
export const SIDEBAR_RESIZE_STEP = 20;
export const PANEL_RADIUS = 12;
export const TITLEBAR_HEIGHT = 48;
const PANEL_MOTION_CLASS =
  'transition-[left,border-radius] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';
const SIDEBAR_NAV_BUTTON_CLASS =
  'w-full justify-start border-transparent px-8 text-cinder hover:border-chalk hover:bg-powder';
const HIDDEN_SIDEBAR_ACTION_BUTTON_CLASS =
  'pointer-events-none size-28 rounded-buttons text-slate opacity-0 hover:bg-powder hover:text-obsidian group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:opacity-100';
const HIDDEN_WORKSPACE_ACTION_BUTTON_CLASS =
  'pointer-events-none size-28 rounded-buttons text-slate opacity-0 hover:bg-powder hover:text-obsidian group-hover/memorySpace:pointer-events-auto group-hover/memorySpace:opacity-100 group-focus-within/memorySpace:pointer-events-auto group-focus-within/memorySpace:opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:opacity-100';

type AppShellProps = {
  readonly activeSection?: AppShellActiveSection | undefined;
  readonly activeWorkspaceId?: string | undefined;
  readonly children: React.ReactNode;
  readonly onCreateWorkspace?: (() => void) | undefined;
  readonly onHome: () => void;
  readonly onLibrary: () => void;
  readonly onOpenLocalWorkspace?: (() => void) | undefined;
  readonly onRemoveMemorySpace?: ((memorySpace: WorkspaceMemorySpace) => void) | undefined;
  readonly onSelectMemorySpace?: ((workspaceId: string) => void) | undefined;
  readonly onToggleTheme: () => void;
  readonly themeMode: ThemeMode;
  readonly memorySpaces?: readonly WorkspaceMemorySpace[] | undefined;
  readonly panelTitlebar?: React.ReactNode;
};

export type WorkspaceMemorySpace = {
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

function sidebarNavButtonClass(current: boolean) {
  return cn(SIDEBAR_NAV_BUTTON_CLASS, current ? 'bg-powder' : 'bg-transparent');
}

export function AppShell({
  activeSection,
  activeWorkspaceId,
  children,
  onCreateWorkspace,
  onHome,
  onLibrary,
  onOpenLocalWorkspace,
  onRemoveMemorySpace,
  onSelectMemorySpace,
  onToggleTheme,
  panelTitlebar,
  themeMode,
  memorySpaces = [],
}: AppShellProps) {
  const [sidebarState, setSidebarState] = React.useState<AppShellState>('expanded');
  const [sidebarWidth, setSidebarWidth] = React.useState(MIN_SIDEBAR_WIDTH);
  const [dragState, setDragState] = React.useState<DragState | null>(null);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = React.useState(false);
  const [workspaceMemorySpaceMenuOpen, setWorkspaceMemorySpaceMenuOpen] = React.useState<
    string | null
  >(null);
  const suppressWorkspaceMenuCloseAutoFocusRef = React.useRef(false);
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
  const panelTitlebarLeft =
    sidebarState === 'expanded'
      ? panelLeft
      : 'calc(var(--spacing-titlebar-control-left) + var(--spacing-titlebar-control-size) + var(--spacing-titlebar-control-gap) - var(--spacing-panel-titlebar-x))';
  const panelRadius =
    sidebarState === 'expanded' ? `${PANEL_RADIUS}px 0 0 ${PANEL_RADIUS}px` : '0px';
  const panelMotionClass = dragState ? '' : PANEL_MOTION_CLASS;
  const SidebarToggleIcon = sidebarState === 'expanded' ? PanelLeftClose : Menu;
  const sidebarToggleLabel = sidebarState === 'expanded' ? '隐藏侧边栏' : '显示侧边栏';
  const ThemeToggleIcon = themeMode === 'dark' ? Sun : Moon;
  const themeToggleLabel = themeMode === 'dark' ? '切换到浅色模式' : '切换到深色模式';
  const currentSection = activeSection ?? (activeWorkspaceId ? 'workspace' : 'home');
  const homeCurrent = currentSection === 'home';
  const libraryCurrent = currentSection === 'library';
  const anySidebarMenuOpen = workspaceMenuOpen || workspaceMemorySpaceMenuOpen !== null;

  function closeSidebarMenus() {
    setWorkspaceMenuOpen(false);
    setWorkspaceMemorySpaceMenuOpen(null);
  }

  function handleCreateWorkspace() {
    suppressWorkspaceMenuCloseAutoFocusRef.current = true;
    closeSidebarMenus();
    onCreateWorkspace?.();
  }

  function handleHome() {
    closeSidebarMenus();
    onHome();
  }

  function handleLibrary() {
    closeSidebarMenus();
    onLibrary();
  }

  function handleOpenLocalWorkspace() {
    suppressWorkspaceMenuCloseAutoFocusRef.current = true;
    closeSidebarMenus();
    onOpenLocalWorkspace?.();
  }

  function handleSelectMemorySpace(workspaceId: string) {
    closeSidebarMenus();
    onSelectMemorySpace?.(workspaceId);
  }

  function handleRemoveMemorySpace(memorySpace: WorkspaceMemorySpace) {
    setWorkspaceMemorySpaceMenuOpen(null);
    onRemoveMemorySpace?.(memorySpace);
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
                closeSidebarMenus();
                setSidebarState(sidebarState === 'expanded' ? 'covered' : 'expanded');
              }}
            >
              <SidebarToggleIcon className="size-16" aria-hidden="true" />
            </Button>
          </div>
          {panelTitlebar ? (
            <div
              data-slot="app-shell-panel-titlebar-content"
              className={`pointer-events-none absolute flex h-titlebar items-center ${panelMotionClass}`}
              style={{
                left: panelTitlebarLeft,
                right: 0,
                top: 'calc(var(--spacing-titlebar-control-top) + ((var(--spacing-titlebar-control-size) - var(--spacing-titlebar)) / 2))',
              }}
            >
              {panelTitlebar}
            </div>
          ) : null}
        </div>

        <aside
          aria-label="记忆空间侧边栏"
          className="absolute inset-y-0 left-0 flex flex-col bg-eggshell px-12 pb-16 pt-sidebar-content-top"
          style={{ width: `${safeSidebarWidth}px`, zIndex: anySidebarMenuOpen ? 4 : 1 }}
        >
          <nav className="flex flex-col gap-4" aria-label="记忆空间">
            <Button
              type="button"
              variant="secondary"
              size="compact"
              aria-current={homeCurrent ? 'page' : undefined}
              className={sidebarNavButtonClass(homeCurrent)}
              onClick={handleHome}
            >
              <Home className="size-16" aria-hidden="true" />
              首页
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              aria-current={libraryCurrent ? 'page' : undefined}
              className={sidebarNavButtonClass(libraryCurrent)}
              onClick={handleLibrary}
            >
              <Library className="size-16" aria-hidden="true" />
              资料库
            </Button>
          </nav>

          <section className="relative mt-28" aria-labelledby="workspace-memory-spaces-heading">
            <div
              role="group"
              aria-label="记忆空间操作"
              className="group mb-8 flex items-center justify-between gap-8"
            >
              <h2
                id="workspace-memory-spaces-heading"
                className="px-8 text-ui-sm font-regular leading-ui-sm text-slate"
              >
                记忆空间
              </h2>
              {onCreateWorkspace || onOpenLocalWorkspace ? (
                <div className="relative shrink-0">
                  <DropdownMenu
                    open={workspaceMenuOpen}
                    onOpenChange={(open) => {
                      if (open) {
                        suppressWorkspaceMenuCloseAutoFocusRef.current = false;
                        setWorkspaceMemorySpaceMenuOpen(null);
                      }
                      setWorkspaceMenuOpen(open);
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghostIcon"
                        size="icon"
                        aria-label="添加记忆空间"
                        className={HIDDEN_SIDEBAR_ACTION_BUTTON_CLASS}
                      >
                        <FolderPlus className="size-16" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      side="bottom"
                      aria-label="添加记忆空间菜单"
                      onCloseAutoFocus={(event) => {
                        if (suppressWorkspaceMenuCloseAutoFocusRef.current) {
                          event.preventDefault();
                          suppressWorkspaceMenuCloseAutoFocusRef.current = false;
                        }
                      }}
                    >
                      <DropdownMenuItem onSelect={handleCreateWorkspace}>
                        <FolderPlus className="size-16 text-slate" aria-hidden="true" />
                        创建本地记忆空间
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleOpenLocalWorkspace}>
                        <Folder className="size-16 text-slate" aria-hidden="true" />
                        打开本地记忆空间
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-4">
              {memorySpaces.map((memorySpace) => {
                const memorySpaceCurrent =
                  currentSection === 'workspace' && memorySpace.workspaceId === activeWorkspaceId;
                const memorySpaceMenuOpen =
                  workspaceMemorySpaceMenuOpen === memorySpace.workspaceId;

                return (
                  <div
                    key={memorySpace.workspaceId}
                    data-slot="workspace-memory-space-item"
                    className={cn(
                      'group/memorySpace relative flex min-h-32 items-center gap-4 rounded-buttons border border-transparent bg-transparent pr-4 transition-colors hover:border-chalk hover:bg-powder focus-within:border-chalk focus-within:bg-powder',
                      memorySpaceCurrent ? 'border-chalk bg-powder' : null
                    )}
                  >
                    <Button
                      type="button"
                      variant="ghostIcon"
                      size="compact"
                      aria-current={memorySpaceCurrent ? 'page' : undefined}
                      className="min-w-0 flex-1 shrink justify-start border-0 bg-transparent px-8 text-cinder hover:text-cinder"
                      onClick={() => handleSelectMemorySpace(memorySpace.workspaceId)}
                    >
                      <Folder className="size-16" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-left">{memorySpace.title}</span>
                      {memorySpaceCurrent ? (
                        <span className="size-4 rounded-full bg-signal-blue" aria-hidden="true" />
                      ) : null}
                    </Button>
                    {onRemoveMemorySpace ? (
                      <DropdownMenu
                        open={memorySpaceMenuOpen}
                        onOpenChange={(open) => {
                          setWorkspaceMenuOpen(false);
                          setWorkspaceMemorySpaceMenuOpen(open ? memorySpace.workspaceId : null);
                        }}
                      >
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghostIcon"
                            size="icon"
                            aria-label={`${memorySpace.title} 更多操作`}
                            className={HIDDEN_WORKSPACE_ACTION_BUTTON_CLASS}
                          >
                            <MoreHorizontal className="size-16" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          side="bottom"
                          aria-label={`${memorySpace.title} 记忆空间操作`}
                        >
                          <DropdownMenuItem onSelect={() => handleRemoveMemorySpace(memorySpace)}>
                            <Trash2 className="size-16 text-slate" aria-hidden="true" />
                            移除记忆空间
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                );
              })}
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
          aria-label="记忆空间内容"
          className={`absolute flex flex-col overflow-hidden border border-glass-border bg-card-glass shadow-subtle backdrop-blur-glass-lg ${panelMotionClass}`}
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

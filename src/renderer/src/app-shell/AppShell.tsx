import { Home, Menu, Mic2, Moon, PanelLeftClose, Sun } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type AppShellState = 'expanded' | 'covered';
export type ThemeMode = 'light' | 'dark';

export const MIN_SIDEBAR_WIDTH = 240;
export const MAX_SIDEBAR_WIDTH = 520;
export const SIDEBAR_RESIZE_STEP = 20;
export const PANEL_RADIUS = 12;
const WINDOW_CONTROL_BUTTON_LEFT = 80;
const WINDOW_CONTROL_BUTTON_TOP = 2;
const PANEL_MOTION_CLASS =
  'transition-[transform,width] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';

type AppShellProps = {
  readonly children: React.ReactNode;
  readonly onNewMemory?: (() => void) | undefined;
  readonly onToggleTheme: () => void;
  readonly themeMode: ThemeMode;
};

type DragState = {
  readonly pointerId: number;
  readonly startWidth: number;
  readonly startX: number;
};

export function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

export function AppShell({ children, onNewMemory, onToggleTheme, themeMode }: AppShellProps) {
  const [sidebarState, setSidebarState] = React.useState<AppShellState>('expanded');
  const [sidebarWidth, setSidebarWidth] = React.useState(MIN_SIDEBAR_WIDTH);
  const [dragState, setDragState] = React.useState<DragState | null>(null);
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

  const panelTransform =
    sidebarState === 'expanded' ? `translateX(${safeSidebarWidth}px)` : 'translateX(0px)';
  const panelWidth = sidebarState === 'expanded' ? `calc(100% - ${safeSidebarWidth}px)` : '100%';
  const panelRadius =
    sidebarState === 'expanded' ? `${PANEL_RADIUS}px 0 0 ${PANEL_RADIUS}px` : '0px';
  const panelMotionClass = dragState ? '' : PANEL_MOTION_CLASS;
  const SidebarToggleIcon = sidebarState === 'expanded' ? PanelLeftClose : Menu;
  const sidebarToggleLabel = sidebarState === 'expanded' ? 'Hide sidebar' : 'Show sidebar';
  const ThemeToggleIcon = themeMode === 'dark' ? Sun : Moon;
  const themeToggleLabel = themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <TooltipProvider>
      <div
        data-theme={themeMode}
        className="relative min-h-screen overflow-hidden bg-eggshell text-obsidian"
      >
        <div
          role="group"
          aria-label="Window controls"
          className="absolute flex items-center gap-8"
          style={{
            left: WINDOW_CONTROL_BUTTON_LEFT,
            top: WINDOW_CONTROL_BUTTON_TOP,
            zIndex: 3,
          }}
        >
          <Button
            type="button"
            variant="ghostIcon"
            size="icon"
            aria-label={sidebarToggleLabel}
            onClick={() => setSidebarState(sidebarState === 'expanded' ? 'covered' : 'expanded')}
          >
            <SidebarToggleIcon className="size-16" aria-hidden="true" />
          </Button>
        </div>

        <aside
          aria-label="Workspace sidebar"
          className="absolute inset-y-0 left-0 flex flex-col bg-eggshell px-16 pb-16 pt-56"
          style={{ width: `${safeSidebarWidth}px`, zIndex: 1 }}
        >
          <div>
            <p className="font-waldenburgfh text-body font-bold uppercase leading-body text-cinder">
              Reo
            </p>
            <p className="text-caption leading-caption text-gravel">Workspace</p>
          </div>

          <Separator className="my-16" />

          <nav className="flex flex-col gap-4" aria-label="Workspace">
            <div
              aria-current="page"
              className="flex min-h-40 items-center gap-10 rounded-buttons px-12 text-body font-bold leading-body text-cinder"
            >
              <Home className="size-16" aria-hidden="true" />
              Home
            </div>
            {onNewMemory ? (
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className="justify-start px-12"
                onClick={onNewMemory}
              >
                <Mic2 className="size-16" aria-hidden="true" />
                New memory
              </Button>
            ) : null}
          </nav>

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
            aria-label="Resize sidebar"
            aria-valuemax={MAX_SIDEBAR_WIDTH}
            aria-valuemin={MIN_SIDEBAR_WIDTH}
            aria-valuenow={safeSidebarWidth}
            decorative={false}
            orientation="vertical"
            className="absolute right-0 top-0 h-full cursor-col-resize bg-transparent hover:bg-chalk/40 focus-visible:bg-chalk/60"
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
          aria-label="Workspace content"
          className={`absolute overflow-hidden border border-chalk bg-card-white shadow-subtle ${panelMotionClass}`}
          style={{
            borderRadius: panelRadius,
            inset: 0,
            transform: panelTransform,
            width: panelWidth,
            zIndex: 2,
          }}
        >
          <div className="h-full overflow-y-auto">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}

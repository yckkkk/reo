import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Separator } from '@/components/ui/separator';
import { useResizableWidth } from '@/hooks/use-resizable-width';
import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  SIDEBAR_RESIZE_STEP,
} from '../app-shell/appShellGeometry';

export const WORKSPACE_MEMORY_RAIL_ID = 'workspace-memory-rail';
const WORKSPACE_MEMORY_RAIL_MIN_WIDTH = MIN_SIDEBAR_WIDTH;
const WORKSPACE_MEMORY_RAIL_MAX_WIDTH = MAX_SIDEBAR_WIDTH;
const WORKSPACE_MEMORY_RAIL_RESIZE_STEP = SIDEBAR_RESIZE_STEP;
export const WORKSPACE_MEMORY_RAIL_LAYOUT = {
  railWidth: `${WORKSPACE_MEMORY_RAIL_MIN_WIDTH}px`,
} as const;
const WORKSPACE_MEMORY_RAIL_MAIN_COLUMN_FLOOR = 620;

type WorkspaceFrameProps = {
  readonly children: ReactNode;
  readonly dock: ReactNode;
  readonly memoryRailOpen: boolean;
  readonly memoryRailMode?: 'inline' | 'overlay';
  readonly rail: ReactNode;
};

function resolveMemoryRailMaxWidth(frameBodyWidth: number | null) {
  if (!frameBodyWidth || frameBodyWidth <= 0) {
    return WORKSPACE_MEMORY_RAIL_MAX_WIDTH;
  }

  return Math.max(
    WORKSPACE_MEMORY_RAIL_MIN_WIDTH,
    Math.min(
      WORKSPACE_MEMORY_RAIL_MAX_WIDTH,
      Math.floor(frameBodyWidth - WORKSPACE_MEMORY_RAIL_MAIN_COLUMN_FLOOR)
    )
  );
}

export function WorkspaceFrame({
  children,
  dock,
  memoryRailMode = 'inline',
  memoryRailOpen,
  rail,
}: WorkspaceFrameProps) {
  const [frameBodyWidth, setFrameBodyWidth] = useState<number | null>(null);
  const frameBodyRef = useRef<HTMLDivElement | null>(null);
  const effectiveMaxRailWidth = resolveMemoryRailMaxWidth(frameBodyWidth);
  const {
    isResizing: railResizing,
    maxWidth: safeMaxRailWidth,
    resizeHandleProps: railResizeHandleProps,
    width: safeRailWidth,
  } = useResizableWidth({
    effectiveMaxWidth: effectiveMaxRailWidth,
    initialWidth: WORKSPACE_MEMORY_RAIL_MIN_WIDTH,
    maxWidth: WORKSPACE_MEMORY_RAIL_MAX_WIDTH,
    minWidth: WORKSPACE_MEMORY_RAIL_MIN_WIDTH,
    resizeEdge: 'left',
    step: WORKSPACE_MEMORY_RAIL_RESIZE_STEP,
  });
  const workspaceFrameStyle = {
    '--workspace-memory-rail-width': `${safeRailWidth}px`,
  } as CSSProperties;
  const inlineRailMode = memoryRailMode === 'inline';
  const inlineRailVisible = memoryRailOpen && inlineRailMode;
  const railShellPlacement = inlineRailMode
    ? 'relative col-start-2 row-start-1 w-full'
    : 'absolute inset-y-0 right-0 z-30 w-[min(var(--workspace-memory-rail-width),calc(100%-48px))]';
  const railVisibility = memoryRailOpen
    ? 'translate-x-0 opacity-100'
    : inlineRailMode
      ? 'pointer-events-none opacity-0'
      : 'pointer-events-none translate-x-full opacity-0';
  const frameBodyMotionClass = railResizing
    ? ''
    : 'transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none';

  useEffect(() => {
    const element = frameBodyRef.current;
    if (!element) {
      return;
    }

    let animationFrameId: number | null = null;
    let pendingObservedWidth: number | null = null;

    const syncFrameBodyWidth = (observedWidth?: number) => {
      const width = observedWidth ?? element.getBoundingClientRect().width;
      const nextWidth = width > 0 ? width : null;
      setFrameBodyWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
    };
    const scheduleFrameBodyWidthSync = (observedWidth?: number) => {
      if (observedWidth !== undefined) {
        pendingObservedWidth = observedWidth;
      }
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        syncFrameBodyWidth(pendingObservedWidth ?? undefined);
        pendingObservedWidth = null;
      });
    };
    syncFrameBodyWidth();
    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver((entries) => {
            scheduleFrameBodyWidthSync(entries[0]?.contentRect.width);
          })
        : null;
    const scheduleWindowResizeSync = () => scheduleFrameBodyWidthSync();
    window.addEventListener('resize', scheduleWindowResizeSync);
    resizeObserver?.observe(element);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('resize', scheduleWindowResizeSync);
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <section
      data-slot="workspace-frame"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground"
      style={workspaceFrameStyle}
    >
      <div
        data-slot="workspace-frame-body"
        ref={frameBodyRef}
        className={`relative grid min-h-0 flex-1 overflow-hidden ${frameBodyMotionClass} ${
          inlineRailVisible
            ? 'grid-cols-[minmax(0,1fr)_var(--workspace-memory-rail-width)]'
            : 'grid-cols-[minmax(0,1fr)_0px]'
        }`}
      >
        <div
          data-slot="workspace-stage-shell"
          className="relative col-start-1 row-start-1 flex min-h-0 flex-col overflow-hidden px-24 pb-16 pt-0 sm:px-40"
        >
          <div
            data-slot="workspace-stage-content"
            className="flex min-h-0 w-full flex-1 items-stretch justify-center"
          >
            {children}
          </div>
          <div
            data-slot="workspace-expression-fab-layer"
            className="pointer-events-none absolute bottom-32 left-24 right-24 z-10 sm:left-40 sm:right-40"
          >
            <div data-slot="workspace-expression-fab-track" className="w-full">
              {dock}
            </div>
          </div>
        </div>
        <div
          data-slot="workspace-memory-rail-shell"
          data-rail-mode={memoryRailMode}
          aria-hidden={!memoryRailOpen}
          inert={memoryRailOpen ? undefined : true}
          className={`min-h-0 overflow-hidden border-l border-secondary transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${railShellPlacement} ${railVisibility}`}
        >
          {inlineRailVisible ? (
            <Separator
              aria-label="调整记忆列表宽度"
              aria-valuemax={safeMaxRailWidth}
              aria-valuemin={WORKSPACE_MEMORY_RAIL_MIN_WIDTH}
              aria-valuenow={safeRailWidth}
              decorative={false}
              orientation="vertical"
              className="absolute left-0 top-0 z-20 h-full cursor-col-resize bg-transparent"
              style={{ width: 8 }}
              tabIndex={0}
              {...railResizeHandleProps}
            />
          ) : null}
          {rail}
        </div>
      </div>
    </section>
  );
}

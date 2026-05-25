import type { CSSProperties, ReactNode } from 'react';

export const WORKSPACE_MEMORY_RAIL_ID = 'workspace-memory-rail';
export const WORKSPACE_MEMORY_RAIL_LAYOUT = {
  railWidth: '240px',
} as const;
const workspaceFrameStyle = {
  '--workspace-memory-rail-width': WORKSPACE_MEMORY_RAIL_LAYOUT.railWidth,
} as CSSProperties;

type WorkspaceFrameProps = {
  readonly children: ReactNode;
  readonly dock: ReactNode;
  readonly memoryRailOpen: boolean;
  readonly memoryRailMode?: 'inline' | 'overlay';
  readonly rail: ReactNode;
};

export function WorkspaceFrame({
  children,
  dock,
  memoryRailMode = 'inline',
  memoryRailOpen,
  rail,
}: WorkspaceFrameProps) {
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

  return (
    <section
      data-slot="workspace-frame"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground"
      style={workspaceFrameStyle}
    >
      <div
        data-slot="workspace-frame-body"
        className={`relative grid min-h-0 flex-1 overflow-hidden transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none ${
          inlineRailVisible
            ? 'grid-cols-[minmax(0,1fr)_var(--workspace-memory-rail-width)]'
            : 'grid-cols-[minmax(0,1fr)_0px]'
        }`}
      >
        <div
          data-slot="workspace-stage-shell"
          className="relative col-start-1 row-start-1 flex min-h-0 flex-col overflow-hidden px-24 py-24 sm:px-40 sm:py-32"
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
          {rail}
        </div>
      </div>
    </section>
  );
}

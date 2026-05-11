import type { CSSProperties, ReactNode } from 'react';

export const WORKSPACE_MEMORY_RAIL_ID = 'workspace-memory-rail';
export const WORKSPACE_MEMORY_RAIL_LAYOUT = {
  railWidth: 'clamp(220px, 24vw, 280px)',
  stageGutter: 'clamp(12px, 2vw, 20px)',
  stageWideGutter: 'clamp(20px, 2.5vw, 40px)',
} as const;
const workspaceMemoryRailStyle = {
  '--workspace-memory-rail-width': WORKSPACE_MEMORY_RAIL_LAYOUT.railWidth,
  '--workspace-memory-rail-stage-inset': `calc(var(--workspace-memory-rail-width) + ${WORKSPACE_MEMORY_RAIL_LAYOUT.stageGutter})`,
  '--workspace-memory-rail-stage-inset-wide': `calc(var(--workspace-memory-rail-width) + ${WORKSPACE_MEMORY_RAIL_LAYOUT.stageWideGutter})`,
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
  const inlineRailVisible = memoryRailOpen && memoryRailMode === 'inline';

  return (
    <section
      data-slot="workspace-frame"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-card-glass text-obsidian backdrop-blur-glass-lg"
      style={workspaceMemoryRailStyle}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          data-slot="workspace-stage-shell"
          className={`flex min-h-0 flex-1 flex-col overflow-hidden py-24 pl-24 transition-[padding-right] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:py-32 sm:pl-40 ${
            inlineRailVisible
              ? 'pr-[var(--workspace-memory-rail-stage-inset)] xl:pr-[var(--workspace-memory-rail-stage-inset-wide)]'
              : 'pr-24 sm:pr-40 xl:pr-40'
          }`}
        >
          <div
            data-slot="workspace-stage-content"
            className="flex min-h-0 flex-1 items-stretch justify-start pb-32"
          >
            {children}
          </div>
          <div
            data-slot="workspace-expression-fab-layer"
            className={`pointer-events-none absolute bottom-32 left-24 z-10 transition-[right] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:left-40 ${
              inlineRailVisible
                ? 'right-[var(--workspace-memory-rail-stage-inset)] xl:right-[var(--workspace-memory-rail-stage-inset-wide)]'
                : 'right-24 sm:right-40 xl:right-40'
            }`}
          >
            {dock}
          </div>
        </div>
        <div
          data-slot="workspace-memory-rail-shell"
          data-rail-mode={memoryRailMode}
          aria-hidden={!memoryRailOpen}
          inert={memoryRailOpen ? undefined : true}
          className={`absolute inset-y-0 right-0 min-h-0 overflow-hidden border-l border-glass-border transition-[transform,opacity] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
            memoryRailMode === 'overlay'
              ? 'z-30 w-[min(260px,calc(100%-48px))]'
              : 'w-[var(--workspace-memory-rail-width)]'
          } ${
            memoryRailOpen
              ? 'translate-x-0 opacity-100'
              : 'pointer-events-none translate-x-full opacity-0'
          }`}
        >
          {rail}
        </div>
      </div>
    </section>
  );
}

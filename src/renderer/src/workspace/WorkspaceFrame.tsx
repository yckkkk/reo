import type { CSSProperties, ReactNode } from 'react';

export const WORKSPACE_MEMORY_RAIL_ID = 'workspace-memory-rail';
export const WORKSPACE_MEMORY_RAIL_LAYOUT = {
  railWidth: 340,
  stageGutter: 20,
  stageWideGutter: 40,
} as const;
const workspaceMemoryRailStyle = {
  '--workspace-memory-rail-width': `${WORKSPACE_MEMORY_RAIL_LAYOUT.railWidth}px`,
  '--workspace-memory-rail-stage-inset': `calc(var(--workspace-memory-rail-width) + ${WORKSPACE_MEMORY_RAIL_LAYOUT.stageGutter}px)`,
  '--workspace-memory-rail-stage-inset-wide': `calc(var(--workspace-memory-rail-width) + ${WORKSPACE_MEMORY_RAIL_LAYOUT.stageWideGutter}px)`,
} as CSSProperties;

type WorkspaceFrameProps = {
  readonly children: ReactNode;
  readonly dock: ReactNode;
  readonly memoryRailOpen: boolean;
  readonly rail: ReactNode;
};

export function WorkspaceFrame({ children, dock, memoryRailOpen, rail }: WorkspaceFrameProps) {
  return (
    <section
      data-slot="workspace-frame"
      className="flex min-h-full flex-col bg-card-white text-obsidian"
      style={workspaceMemoryRailStyle}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={`flex min-h-[640px] flex-col py-24 pl-24 transition-[padding-right] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:py-32 sm:pl-40 ${
            memoryRailOpen
              ? 'pr-[var(--workspace-memory-rail-stage-inset)] xl:pr-[var(--workspace-memory-rail-stage-inset-wide)]'
              : 'pr-24 sm:pr-40 xl:pr-40'
          }`}
        >
          <div className="flex min-h-0 flex-1 items-center justify-center pb-32">{children}</div>
          <div
            data-slot="workspace-expression-fab-layer"
            className={`pointer-events-none absolute bottom-32 left-24 z-10 transition-[right] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:left-40 ${
              memoryRailOpen
                ? 'right-[var(--workspace-memory-rail-stage-inset)] xl:right-[var(--workspace-memory-rail-stage-inset-wide)]'
                : 'right-24 sm:right-40 xl:right-40'
            }`}
          >
            {dock}
          </div>
        </div>
        <div
          data-slot="workspace-memory-rail-shell"
          aria-hidden={!memoryRailOpen}
          inert={memoryRailOpen ? undefined : true}
          className={`absolute inset-y-0 right-0 min-h-0 w-[var(--workspace-memory-rail-width)] overflow-hidden transition-[transform,opacity] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
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

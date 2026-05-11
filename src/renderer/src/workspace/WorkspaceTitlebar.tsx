import { PanelRightClose, PanelRightOpen, PencilLine, Plus } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { WORKSPACE_MEMORY_RAIL_ID } from './WorkspaceFrame';
import type { WorkspaceMemorySummary } from './workspaceApi';

type WorkspaceTitlebarMemory = WorkspaceMemorySummary;

type WorkspaceTitlebarProps = {
  readonly currentMemory?: WorkspaceTitlebarMemory | null;
  readonly memoryRailOpen: boolean;
  readonly onCreateMemory: () => void;
  readonly onRenameMemory?: ((memory: WorkspaceTitlebarMemory) => void) | undefined;
  readonly onRenameMemorySpace: () => void;
  readonly onToggleMemoryRail: () => void;
  readonly title: string;
};

export function WorkspaceTitlebar({
  currentMemory = null,
  memoryRailOpen,
  onCreateMemory,
  onRenameMemory,
  onRenameMemorySpace,
  onToggleMemoryRail,
  title,
}: WorkspaceTitlebarProps) {
  const ToggleIcon = memoryRailOpen ? PanelRightClose : PanelRightOpen;
  const toggleLabel = memoryRailOpen ? '折叠记忆列表' : '展开记忆列表';

  return (
    <div className="flex h-full w-full items-center justify-between gap-16 px-[var(--spacing-panel-titlebar-x)]">
      <Breadcrumb
        className="pointer-events-auto min-w-0 [-webkit-app-region:no-drag]"
        aria-label="当前位置"
      >
        <BreadcrumbList className="flex-nowrap gap-4">
          <BreadcrumbItem className="min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`${title} 记忆空间操作`}
                  className="inline-flex max-w-[220px] items-center gap-3 rounded-buttons px-4 py-4 text-body-lg font-medium leading-body-lg text-cinder outline-none transition-colors duration-150 hover:bg-powder hover:text-obsidian focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-eggshell data-[state=open]:bg-powder data-[state=open]:text-obsidian"
                >
                  <span className="min-w-0 truncate">{title}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" aria-label={`${title} 记忆空间操作`}>
                <DropdownMenuItem onSelect={onRenameMemorySpace}>
                  <PencilLine className="size-16 text-slate" aria-hidden="true" />
                  重命名记忆空间
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </BreadcrumbItem>
          {currentMemory ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="min-w-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`${currentMemory.title} 记忆操作`}
                        className="inline-flex max-w-[260px] items-center gap-3 rounded-buttons px-4 py-4 text-body-lg font-medium leading-body-lg text-obsidian outline-none transition-colors duration-150 hover:bg-powder focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-eggshell data-[state=open]:bg-powder"
                      >
                        <span className="min-w-0 truncate">{currentMemory.title}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      side="bottom"
                      aria-label={`${currentMemory.title} 记忆操作`}
                    >
                      <DropdownMenuItem onSelect={() => onRenameMemory?.(currentMemory)}>
                        <PencilLine className="size-16 text-slate" aria-hidden="true" />
                        重命名记忆
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="pointer-events-auto flex items-center gap-8 [-webkit-app-region:no-drag]">
        <Tooltip>
          <Button asChild variant="ghostIcon" size="icon">
            <TooltipTrigger
              type="button"
              aria-label="新建记忆"
              className="rounded-buttons text-cinder hover:bg-powder hover:text-obsidian"
              onClick={onCreateMemory}
            >
              <Plus className="size-16" aria-hidden="true" />
            </TooltipTrigger>
          </Button>
          <TooltipContent side="bottom">新建记忆</TooltipContent>
        </Tooltip>
        <Tooltip>
          <Button asChild variant="ghostIcon" size="icon">
            <TooltipTrigger
              type="button"
              aria-controls={WORKSPACE_MEMORY_RAIL_ID}
              aria-expanded={memoryRailOpen}
              aria-label={toggleLabel}
              className="rounded-buttons text-cinder hover:bg-powder hover:text-obsidian"
              onClick={onToggleMemoryRail}
            >
              <ToggleIcon className="size-16" aria-hidden="true" />
            </TooltipTrigger>
          </Button>
          <TooltipContent side="bottom">{toggleLabel}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

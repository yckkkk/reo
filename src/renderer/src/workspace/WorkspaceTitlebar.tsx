import { PanelRightClose, PanelRightOpen, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { WORKSPACE_MEMORY_RAIL_ID } from './WorkspaceFrame';

type WorkspaceTitlebarProps = {
  readonly memoryRailOpen: boolean;
  readonly onCreateMemory: () => void;
  readonly onToggleMemoryRail: () => void;
  readonly title: string;
};

export function WorkspaceTitlebar({
  memoryRailOpen,
  onCreateMemory,
  onToggleMemoryRail,
  title,
}: WorkspaceTitlebarProps) {
  const ToggleIcon = memoryRailOpen ? PanelRightClose : PanelRightOpen;
  const toggleLabel = memoryRailOpen ? '折叠记忆列表' : '展开记忆列表';

  return (
    <div className="flex h-full w-full items-center justify-between gap-16 px-[var(--spacing-panel-titlebar-x)]">
      <p className="min-w-0 truncate text-body-lg font-medium leading-body-lg text-cinder">
        {title}
      </p>
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

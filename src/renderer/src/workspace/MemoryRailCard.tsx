import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReoCardSurface } from '@/components/ui/card-surface';
import { MemoryActionsMenu } from './MemoryActionsMenu';
import { countLabel } from './memoryLabels';
import type { WorkspaceSession } from './workspaceApi';

type WorkspaceMemory = WorkspaceSession['snapshot']['memories'][number];

type MemoryRailCardProps = {
  readonly active: boolean;
  readonly memory: WorkspaceMemory;
  readonly onDeleteMemory: (memory: WorkspaceMemory) => void;
  readonly onRenameMemory: (memory: WorkspaceMemory) => void;
  readonly onSelectMemory: (memoryId: string) => void;
  readonly updatedAtLabel: string;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
};

export function MemoryRailCard({
  active,
  memory,
  onDeleteMemory,
  onRenameMemory,
  onSelectMemory,
  updatedAtLabel,
  workspaceHandle,
  workspaceId,
}: MemoryRailCardProps) {
  return (
    <ReoCardSurface
      data-slot="memory-rail-card"
      className={[
        'group relative transition-colors duration-150',
        active ? 'bg-secondary' : 'bg-card hover:bg-secondary',
      ].join(' ')}
    >
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        aria-label={`选择记忆 ${memory.title}`}
        className="block min-h-[68px] w-full px-12 py-12 pr-40 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={() => onSelectMemory(memory.memoryId)}
      >
        <span className="block min-w-0 truncate text-body font-medium leading-body text-foreground">
          {memory.title}
        </span>
        <span className="mt-4 block truncate text-ui-sm leading-ui-sm text-muted-foreground">
          {updatedAtLabel} · {countLabel(memory.segmentCount, '个片段')}
        </span>
      </button>
      <MemoryActionsMenu
        actionIdentity={{
          memoryId: memory.memoryId,
          workspaceHandle,
          workspaceId,
        }}
        contentAlign="end"
        memoryTitle={memory.title}
        onDelete={() => onDeleteMemory(memory)}
        onRename={() => onRenameMemory(memory)}
        trigger={
          <Button
            variant="ghostIcon"
            size="icon"
            type="button"
            aria-label={`${memory.title} 更多操作`}
            className="absolute right-8 top-8 size-24 text-muted-foreground hover:bg-accent data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
          >
            <MoreHorizontal className="size-[14px]" aria-hidden="true" />
          </Button>
        }
        triggerLabel={`${memory.title} 更多操作`}
      />
    </ReoCardSurface>
  );
}

export function MemoryRailEmptyState() {
  return (
    <ReoCardSurface
      data-slot="memory-rail-empty-card"
      className="flex min-h-[96px] flex-col justify-center bg-card px-16 py-16"
    >
      <p className="text-body font-medium leading-body text-foreground">还没有记忆</p>
      <p className="mt-4 text-ui-sm leading-ui-sm text-muted-foreground">先为这一刻命名。</p>
    </ReoCardSurface>
  );
}

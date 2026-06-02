import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReoCardSurface } from '@/components/ui/card-surface';
import { resolveMemoryCoverImageSource } from './covers/memoryCoverSource';
import { MemoryActionsMenu } from './MemoryActionsMenu';
import { countLabel } from './memoryLabels';
import type { WorkspaceSession } from './workspaceApi';

type WorkspaceMemory = WorkspaceSession['snapshot']['memories'][number];

type MemoryRailCardProps = {
  readonly active: boolean;
  readonly memory: WorkspaceMemory;
  readonly onDeleteMemory: (memory: WorkspaceMemory) => void;
  readonly onRenameMemory: (memory: WorkspaceMemory) => void;
  readonly onResetMemoryCover: (memory: WorkspaceMemory) => void;
  readonly onSwitchMemoryDefaultCover: (memory: WorkspaceMemory) => void;
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
  onResetMemoryCover,
  onSwitchMemoryDefaultCover,
  onSelectMemory,
  updatedAtLabel,
  workspaceHandle,
  workspaceId,
}: MemoryRailCardProps) {
  const coverSource = resolveMemoryCoverImageSource({ memory, workspaceId });

  return (
    <ReoCardSurface
      data-slot="memory-rail-card"
      className={[
        'group relative h-[80px] rounded-[14px] transition-colors duration-150',
        active ? 'bg-secondary' : 'bg-card hover:bg-secondary',
      ].join(' ')}
    >
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        aria-label={`选择记忆 ${memory.title}`}
        className="grid h-[80px] w-full grid-cols-[80px_minmax(0,1fr)] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={() => onSelectMemory(memory.memoryId)}
      >
        <span
          data-slot="memory-rail-card-cover"
          className="block h-full w-full min-h-0 overflow-hidden bg-secondary"
        >
          <img
            alt={`${memory.title} 封面`}
            className="size-full object-cover"
            decoding="async"
            draggable={false}
            loading="lazy"
            src={coverSource}
          />
        </span>
        <span
          data-slot="memory-rail-card-content"
          className="flex min-w-0 flex-col justify-center pb-[10px] pl-12 pr-[34px] pt-[11px]"
        >
          <span
            data-slot="memory-rail-card-title-line"
            className="flex min-w-0 items-center gap-[9px]"
          >
            <span
              data-slot="memory-rail-card-title"
              className="block min-w-0 truncate text-[13px] font-[700] leading-[1.14] text-foreground"
            >
              {memory.title}
            </span>
          </span>
          <span
            data-slot="memory-rail-card-meta"
            className="mt-[5px] flex min-w-0 flex-col gap-[2px] text-[11px] font-medium leading-[1.15] text-muted-foreground"
          >
            <span data-slot="memory-rail-card-updated-at" className="block truncate">
              {updatedAtLabel}
            </span>
            <span data-slot="memory-rail-card-segment-count" className="block truncate">
              {countLabel(memory.segmentCount, '个片段')}
            </span>
          </span>
        </span>
      </button>
      <MemoryActionsMenu
        actionIdentity={{
          memoryId: memory.memoryId,
          workspaceHandle,
          workspaceId,
        }}
        contentAlign="end"
        cover={memory.cover}
        memoryTitle={memory.title}
        onDelete={() => onDeleteMemory(memory)}
        onRename={() => onRenameMemory(memory)}
        onResetCover={() => onResetMemoryCover(memory)}
        onSwitchDefaultCover={() => onSwitchMemoryDefaultCover(memory)}
        trigger={
          <Button
            variant="ghostIcon"
            size="icon"
            type="button"
            aria-label={`${memory.title} 更多操作`}
            className="absolute right-[7px] top-[7px] size-[30px] rounded-[8px] text-muted-foreground hover:bg-accent data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
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

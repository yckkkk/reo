import { format, isSameDay, isSameYear, isYesterday } from 'date-fns';
import { MoreHorizontal, PencilLine, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { countLabel } from './memoryLabels';
import type { WorkspaceSession } from './workspaceApi';

type WorkspaceMemory = WorkspaceSession['snapshot']['memories'][number];

type MemoryRailProps = {
  readonly activeMemoryId?: string | null;
  readonly id?: string;
  readonly memories: readonly WorkspaceMemory[];
  readonly onDeleteMemory: (memory: WorkspaceMemory) => void;
  readonly onRenameMemory: (memory: WorkspaceMemory) => void;
  readonly onSelectMemory: (memoryId: string) => void;
};

function memoryUpdatedTimestamp(memory: WorkspaceMemory) {
  const updatedAt = new Date(memory.updatedAt).getTime();
  return Number.isNaN(updatedAt) ? 0 : updatedAt;
}

function updatedLabel(updatedAt: string) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return '时间未知';
  }

  const now = new Date();
  if (isSameDay(date, now)) {
    return format(date, 'HH:mm');
  }
  if (isYesterday(date)) {
    return `昨天 ${format(date, 'HH:mm')}`;
  }
  if (isSameYear(date, now)) {
    return format(date, 'MM/dd HH:mm');
  }
  return format(date, 'yyyy/MM/dd HH:mm');
}

export function MemoryRail({
  activeMemoryId = null,
  id,
  memories,
  onDeleteMemory,
  onRenameMemory,
  onSelectMemory,
}: MemoryRailProps) {
  const sortedMemories = useMemo(
    () =>
      [...memories].sort(
        (left, right) => memoryUpdatedTimestamp(right) - memoryUpdatedTimestamp(left)
      ),
    [memories]
  );

  return (
    <nav
      id={id}
      aria-label="记忆列表"
      className="flex h-full min-h-0 w-full flex-col bg-background px-8 py-20"
    >
      {sortedMemories.length === 0 ? (
        <div className="flex min-h-[96px] flex-col justify-center rounded-xl bg-card px-16 py-16">
          <p className="text-body font-medium leading-body text-foreground">还没有记忆</p>
          <p className="mt-4 text-ui-sm leading-ui-sm text-muted-foreground">先为这一刻命名。</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {sortedMemories.map((memory) => {
            const isActive = memory.memoryId === activeMemoryId;
            return (
              <div
                key={memory.memoryId}
                data-slot="memory-rail-card"
                className={[
                  'group relative overflow-hidden rounded-xl transition-colors duration-150',
                  isActive ? 'bg-secondary' : 'bg-card hover:bg-secondary',
                ].join(' ')}
              >
                <button
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={`选择记忆 ${memory.title}`}
                  className="block min-h-[68px] w-full px-12 py-12 pr-40 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => onSelectMemory(memory.memoryId)}
                >
                  <span className="block min-w-0 truncate text-body font-medium leading-body text-foreground">
                    {memory.title}
                  </span>
                  <span className="mt-4 block truncate text-ui-sm leading-ui-sm text-muted-foreground">
                    {updatedLabel(memory.updatedAt)} · {countLabel(memory.segmentCount, '个片段')}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghostIcon"
                      size="icon"
                      type="button"
                      aria-label={`${memory.title} 更多操作`}
                      className="absolute right-8 top-8 size-24 text-muted-foreground hover:bg-accent data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
                    >
                      <MoreHorizontal className="size-[14px]" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    aria-label={`${memory.title} 更多操作`}
                    side="bottom"
                  >
                    <DropdownMenuItem onSelect={() => onRenameMemory(memory)}>
                      <PencilLine
                        className="size-[14px] text-muted-foreground"
                        aria-hidden="true"
                      />
                      重命名记忆
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onDeleteMemory(memory)}>
                      <Trash2 className="size-[14px] text-muted-foreground" aria-hidden="true" />
                      删除记忆
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}
    </nav>
  );
}

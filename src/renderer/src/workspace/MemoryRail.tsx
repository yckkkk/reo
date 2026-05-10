import { format, isSameDay, isSameYear, isYesterday } from 'date-fns';
import { MoreHorizontal, PencilLine } from 'lucide-react';
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
      className="flex min-h-0 flex-col border-t border-chalk bg-card-white px-20 py-24 xl:border-t-0"
    >
      {sortedMemories.length === 0 ? (
        <div className="flex min-h-[128px] flex-col justify-center rounded-cards border border-chalk bg-card-white px-18 py-20 shadow-subtle">
          <p className="text-body-lg font-medium leading-body-lg text-obsidian">还没有记忆</p>
          <p className="mt-8 text-body leading-body text-gravel">先为这一刻命名。</p>
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          {sortedMemories.map((memory) => {
            const isActive = memory.memoryId === activeMemoryId;
            return (
              <div
                key={memory.memoryId}
                className={[
                  'group relative overflow-hidden rounded-cards border bg-card-white shadow-subtle transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-slate hover:shadow-subtle-4 focus-within:border-signal-blue',
                  isActive ? 'border-signal-blue/50 shadow-subtle-4' : 'border-chalk',
                ].join(' ')}
              >
                <button
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={`选择记忆 ${memory.title}`}
                  className="block min-h-[88px] w-full px-16 py-16 pr-48 text-left outline-none focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-card-white"
                  onClick={() => onSelectMemory(memory.memoryId)}
                >
                  <span className="block min-w-0 truncate text-body-lg font-medium leading-body-lg text-obsidian">
                    {memory.title}
                  </span>
                  <span className="mt-8 block truncate text-ui-md leading-ui-md text-gravel">
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
                      className="absolute right-10 top-10 size-28 text-slate hover:bg-powder data-[state=open]:bg-powder data-[state=open]:text-obsidian"
                    >
                      <MoreHorizontal className="size-16" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    aria-label={`${memory.title} 更多操作`}
                    side="bottom"
                  >
                    <DropdownMenuItem onSelect={() => onRenameMemory(memory)}>
                      <PencilLine className="size-[14px] text-slate" aria-hidden="true" />
                      重命名记忆
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

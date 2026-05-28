import { format, isSameDay, isSameYear, isYesterday } from 'date-fns';
import { useMemo } from 'react';
import { MemoryRailCard, MemoryRailEmptyState } from './MemoryRailCard';
import type { WorkspaceSession } from './workspaceApi';

type WorkspaceMemory = WorkspaceSession['snapshot']['memories'][number];
type MemoryRailRow = {
  readonly memory: WorkspaceMemory;
  readonly updatedAtLabel: string;
};

type MemoryRailProps = {
  readonly activeMemoryId?: string | null;
  readonly id?: string;
  readonly memories: readonly WorkspaceMemory[];
  readonly onDeleteMemory: (memory: WorkspaceMemory) => void;
  readonly onRenameMemory: (memory: WorkspaceMemory) => void;
  readonly onSelectMemory: (memoryId: string) => void;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
};

function updatedLabel(updatedAt: string, now: Date) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return '时间未知';
  }

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

function memoryRailRows(memories: readonly WorkspaceMemory[]): readonly MemoryRailRow[] {
  const now = new Date();
  return memories.map((memory) => ({
    memory,
    updatedAtLabel: updatedLabel(memory.updatedAt, now),
  }));
}

export function MemoryRail({
  activeMemoryId = null,
  id,
  memories,
  onDeleteMemory,
  onRenameMemory,
  onSelectMemory,
  workspaceHandle,
  workspaceId,
}: MemoryRailProps) {
  const rows = useMemo(() => memoryRailRows(memories), [memories]);

  return (
    <nav
      id={id}
      aria-label="记忆列表"
      className="flex h-full min-h-0 w-full flex-col bg-background px-8 py-20"
    >
      {rows.length === 0 ? (
        <MemoryRailEmptyState />
      ) : (
        <div className="flex flex-col gap-8">
          {rows.map(({ memory, updatedAtLabel }) => {
            const isActive = memory.memoryId === activeMemoryId;
            return (
              <MemoryRailCard
                key={memory.memoryId}
                active={isActive}
                memory={memory}
                onDeleteMemory={onDeleteMemory}
                onRenameMemory={onRenameMemory}
                onSelectMemory={onSelectMemory}
                updatedAtLabel={updatedAtLabel}
                workspaceHandle={workspaceHandle}
                workspaceId={workspaceId}
              />
            );
          })}
        </div>
      )}
    </nav>
  );
}

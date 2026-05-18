import type { WorkspaceMemorySummary, WorkspaceSession } from './workspace/workspaceApi';

export function compareProjectedUpdatedAt(
  first: { readonly updatedAt: string; readonly createdAt: string },
  second: { readonly updatedAt: string; readonly createdAt: string }
): number {
  const updatedComparison = second.updatedAt.localeCompare(first.updatedAt);
  if (updatedComparison !== 0) {
    return updatedComparison;
  }
  return second.createdAt.localeCompare(first.createdAt);
}

export function upsertByProjectedUpdatedAt<
  T extends { readonly updatedAt: string; readonly createdAt: string },
>(items: readonly T[], nextItem: T, readId: (item: T) => string): T[] {
  const nextItems: T[] = [];
  const nextId = readId(nextItem);
  let inserted = false;

  for (const item of items) {
    if (readId(item) === nextId) {
      continue;
    }
    if (!inserted && compareProjectedUpdatedAt(nextItem, item) <= 0) {
      nextItems.push(nextItem);
      inserted = true;
    }
    nextItems.push(item);
  }

  if (!inserted) {
    nextItems.push(nextItem);
  }

  return nextItems;
}

export function mergeMemoryIntoSnapshot(
  current: WorkspaceSession['snapshot'],
  updatedMemory: WorkspaceMemorySummary
): WorkspaceSession['snapshot'] {
  return {
    ...current,
    memories: upsertByProjectedUpdatedAt(
      current.memories,
      updatedMemory,
      (memory) => memory.memoryId
    ),
  };
}

export function mergeMemoryIntoSession(
  current: WorkspaceSession,
  updatedMemory: WorkspaceMemorySummary
): WorkspaceSession {
  return {
    ...current,
    snapshot: mergeMemoryIntoSnapshot(current.snapshot, updatedMemory),
  };
}

export function mergeMemoryIntoSnapshotIfCurrentTitle(
  current: WorkspaceSession['snapshot'] | undefined,
  memoryId: string,
  expectedTitle: string,
  updatedMemory: WorkspaceMemorySummary
): WorkspaceSession['snapshot'] | undefined {
  if (!current) {
    return current;
  }
  const currentMemory = current.memories.find((memory) => memory.memoryId === memoryId);
  if (currentMemory?.title !== expectedTitle) {
    return current;
  }
  return mergeMemoryIntoSnapshot(current, updatedMemory);
}

export function mergeMemoryIntoSessionIfCurrentTitle(
  current: WorkspaceSession | null,
  workspaceId: string,
  memoryId: string,
  expectedTitle: string,
  updatedMemory: WorkspaceMemorySummary
): WorkspaceSession | null {
  if (current?.workspaceId !== workspaceId) {
    return current;
  }
  const nextSnapshot = mergeMemoryIntoSnapshotIfCurrentTitle(
    current.snapshot,
    memoryId,
    expectedTitle,
    updatedMemory
  );
  if (!nextSnapshot) {
    return current;
  }
  return nextSnapshot === current.snapshot ? current : { ...current, snapshot: nextSnapshot };
}

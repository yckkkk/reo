import type {
  WorkspaceMemoryDetail,
  WorkspaceMemorySummary,
  WorkspaceSession,
} from './workspaceApi';

export type PendingSegmentDeleteProjection = {
  readonly memoryBeforeDelete: WorkspaceMemorySummary;
  readonly memoryId: string;
  readonly optimisticMemory: WorkspaceMemorySummary;
  readonly segment: WorkspaceMemoryDetail['segments'][number];
  readonly segmentId: string;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
};

function sortMemoriesByUpdatedAt(
  memories: readonly WorkspaceMemorySummary[]
): WorkspaceMemorySummary[] {
  return [...memories].sort((first, second) => {
    const updatedComparison = second.updatedAt.localeCompare(first.updatedAt);
    if (updatedComparison !== 0) {
      return updatedComparison;
    }
    return second.createdAt.localeCompare(first.createdAt);
  });
}

export function memorySummaryAfterSegmentRemoval({
  memory,
  removedSegment,
  remainingSegments,
}: {
  readonly memory: WorkspaceMemorySummary;
  readonly removedSegment: WorkspaceMemoryDetail['segments'][number];
  readonly remainingSegments?: readonly WorkspaceMemoryDetail['segments'][number][];
}): WorkspaceMemorySummary {
  if (remainingSegments) {
    return memorySummaryWithVisibleSegments(memory, remainingSegments);
  }

  return {
    ...memory,
    audioByteLength: Math.max(0, memory.audioByteLength - removedSegment.audioByteLength),
    supplementCount: Math.max(0, memory.supplementCount - removedSegment.supplementCount),
    durationMs: Math.max(0, memory.durationMs - removedSegment.durationMs),
    segmentCount: Math.max(0, memory.segmentCount - 1),
  };
}

export function memorySummaryWithVisibleSegments(
  memory: WorkspaceMemorySummary,
  visibleSegments: readonly WorkspaceMemoryDetail['segments'][number][]
): WorkspaceMemorySummary {
  return {
    ...memory,
    audioByteLength: visibleSegments.reduce((total, segment) => total + segment.audioByteLength, 0),
    supplementCount: visibleSegments.reduce((total, segment) => total + segment.supplementCount, 0),
    durationMs: visibleSegments.reduce((total, segment) => total + segment.durationMs, 0),
    hasTranscript: visibleSegments.some((segment) => segment.transcript.exists),
    segmentCount: visibleSegments.length,
  };
}

export function memorySummaryAfterSegmentRestore({
  memory,
  restoredSegment,
}: {
  readonly memory: WorkspaceMemorySummary;
  readonly restoredSegment: WorkspaceMemoryDetail['segments'][number];
}): WorkspaceMemorySummary {
  return {
    ...memory,
    audioByteLength: memory.audioByteLength + restoredSegment.audioByteLength,
    supplementCount: memory.supplementCount + restoredSegment.supplementCount,
    durationMs: memory.durationMs + restoredSegment.durationMs,
    hasTranscript: memory.hasTranscript || restoredSegment.transcript.exists,
    segmentCount: memory.segmentCount + 1,
    updatedAt:
      memory.updatedAt.localeCompare(restoredSegment.updatedAt) >= 0
        ? memory.updatedAt
        : restoredSegment.updatedAt,
  };
}

export function pendingSegmentDeleteKey({
  memoryId,
  segmentId,
  workspaceHandle,
  workspaceId,
}: {
  readonly memoryId: string;
  readonly segmentId: string;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
}) {
  return `${workspaceHandle}:${workspaceId}:${memoryId}:${segmentId}`;
}

export function memorySummaryWithPendingSegmentDelete(
  memory: WorkspaceMemorySummary,
  projection: PendingSegmentDeleteProjection
): WorkspaceMemorySummary {
  if (memory.memoryId !== projection.memoryId) {
    return memory;
  }

  const projectedMemory = memorySummaryAfterSegmentRemoval({
    memory,
    removedSegment: projection.segment,
  });
  const memoryMatchesDeleteBase =
    memory.audioByteLength === projection.memoryBeforeDelete.audioByteLength &&
    memory.supplementCount === projection.memoryBeforeDelete.supplementCount &&
    memory.durationMs === projection.memoryBeforeDelete.durationMs &&
    memory.segmentCount === projection.memoryBeforeDelete.segmentCount &&
    memory.updatedAt === projection.memoryBeforeDelete.updatedAt;

  return {
    ...projectedMemory,
    hasTranscript:
      memoryMatchesDeleteBase &&
      memory.hasTranscript === projection.memoryBeforeDelete.hasTranscript
        ? projection.optimisticMemory.hasTranscript
        : projectedMemory.hasTranscript,
    updatedAt: memoryMatchesDeleteBase
      ? projection.optimisticMemory.updatedAt
      : projectedMemory.updatedAt,
  };
}

export function snapshotWithPendingSegmentDeletes(
  snapshot: WorkspaceSession['snapshot'],
  projections: readonly PendingSegmentDeleteProjection[]
): WorkspaceSession['snapshot'] {
  if (projections.length === 0) {
    return snapshot;
  }

  let changed = false;
  const memories = snapshot.memories.map((memory) => {
    const nextMemory = projections.reduce(
      (currentMemory, projection) =>
        memorySummaryWithPendingSegmentDelete(currentMemory, projection),
      memory
    );
    changed ||= nextMemory !== memory;
    return nextMemory;
  });

  return changed ? { ...snapshot, memories: sortMemoriesByUpdatedAt(memories) } : snapshot;
}

export function pendingSegmentDeleteBelongsToSession(
  projection: PendingSegmentDeleteProjection,
  session: Pick<WorkspaceSession, 'workspaceHandle' | 'workspaceId'>
) {
  return (
    projection.workspaceHandle === session.workspaceHandle &&
    projection.workspaceId === session.workspaceId
  );
}

export function queryKeyMatchesPendingSegmentDelete(
  queryKey: readonly unknown[],
  projection: PendingSegmentDeleteProjection
) {
  const [scope, kind, workspaceId, memoryId, segmentId] = queryKey;
  if (scope !== 'workspace' || workspaceId !== projection.workspaceId) {
    return false;
  }

  if (kind === 'memory-detail') {
    return memoryId === projection.memoryId;
  }

  if (kind === 'segment-content') {
    return memoryId === projection.memoryId && segmentId === projection.segmentId;
  }

  if (kind === 'segment-supplement-content') {
    return memoryId === projection.memoryId && segmentId === projection.segmentId;
  }

  return false;
}

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

function segmentHasAnyNote(segment: WorkspaceMemoryDetail['segments'][number]): boolean {
  return (
    segment.type === 'note' || segment.supplements.some((supplement) => supplement.type === 'note')
  );
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

  const isAudioSegment = removedSegment.type === 'audio';
  return {
    ...memory,
    audioByteLength: Math.max(
      0,
      memory.audioByteLength - (isAudioSegment ? removedSegment.audioByteLength : 0)
    ),
    supplementCount: Math.max(0, memory.supplementCount - removedSegment.supplementCount),
    audioSegmentCount: Math.max(0, memory.audioSegmentCount - (isAudioSegment ? 1 : 0)),
    noteSegmentCount: Math.max(0, memory.noteSegmentCount - (isAudioSegment ? 0 : 1)),
    audioDurationMs: Math.max(
      0,
      memory.audioDurationMs - (isAudioSegment ? removedSegment.durationMs : 0)
    ),
    segmentCount: Math.max(0, memory.segmentCount - 1),
    hasAnyNote: memory.hasAnyNote,
  };
}

export function memorySummaryWithVisibleSegments(
  memory: WorkspaceMemorySummary,
  visibleSegments: readonly WorkspaceMemoryDetail['segments'][number][]
): WorkspaceMemorySummary {
  let audioByteLength = 0;
  let supplementCount = 0;
  let audioSegmentCount = 0;
  let noteSegmentCount = 0;
  let audioDurationMs = 0;
  let hasAudioTranscript = false;
  let hasAnyNote = false;

  for (const segment of visibleSegments) {
    if (segment.type === 'audio') {
      audioSegmentCount += 1;
      audioByteLength += segment.audioByteLength;
      audioDurationMs += segment.durationMs;
      hasAudioTranscript ||= segment.transcript.exists;
    } else {
      noteSegmentCount += 1;
    }
    hasAnyNote ||= segmentHasAnyNote(segment);
    supplementCount += segment.supplementCount;
  }

  return {
    ...memory,
    audioByteLength,
    supplementCount,
    audioSegmentCount,
    noteSegmentCount,
    audioDurationMs,
    hasAudioTranscript,
    hasAnyNote,
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
    audioByteLength:
      memory.audioByteLength +
      (restoredSegment.type === 'audio' ? restoredSegment.audioByteLength : 0),
    supplementCount: memory.supplementCount + restoredSegment.supplementCount,
    audioSegmentCount: memory.audioSegmentCount + (restoredSegment.type === 'audio' ? 1 : 0),
    noteSegmentCount: memory.noteSegmentCount + (restoredSegment.type === 'note' ? 1 : 0),
    audioDurationMs:
      memory.audioDurationMs + (restoredSegment.type === 'audio' ? restoredSegment.durationMs : 0),
    hasAudioTranscript:
      memory.hasAudioTranscript ||
      (restoredSegment.type === 'audio' && restoredSegment.transcript.exists),
    hasAnyNote: memory.hasAnyNote || segmentHasAnyNote(restoredSegment),
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
    memory.audioSegmentCount === projection.memoryBeforeDelete.audioSegmentCount &&
    memory.noteSegmentCount === projection.memoryBeforeDelete.noteSegmentCount &&
    memory.audioDurationMs === projection.memoryBeforeDelete.audioDurationMs &&
    memory.segmentCount === projection.memoryBeforeDelete.segmentCount &&
    memory.hasAnyNote === projection.memoryBeforeDelete.hasAnyNote &&
    memory.updatedAt === projection.memoryBeforeDelete.updatedAt;

  return {
    ...projectedMemory,
    hasAudioTranscript:
      memoryMatchesDeleteBase &&
      memory.hasAudioTranscript === projection.memoryBeforeDelete.hasAudioTranscript
        ? projection.optimisticMemory.hasAudioTranscript
        : projectedMemory.hasAudioTranscript,
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

  const projectionsByMemory = new Map<string, PendingSegmentDeleteProjection[]>();
  for (const projection of projections) {
    const pendingForMemory = projectionsByMemory.get(projection.memoryId);
    if (pendingForMemory) {
      pendingForMemory.push(projection);
    } else {
      projectionsByMemory.set(projection.memoryId, [projection]);
    }
  }

  let changed = false;
  const memories = snapshot.memories.map((memory) => {
    const pendingForMemory = projectionsByMemory.get(memory.memoryId);
    if (!pendingForMemory) {
      return memory;
    }
    const nextMemory = pendingForMemory.reduce(
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

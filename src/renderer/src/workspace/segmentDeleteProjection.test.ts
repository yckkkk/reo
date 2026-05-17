import { describe, expect, it } from 'vitest';
import {
  memorySummaryWithPendingSegmentDelete,
  snapshotWithPendingSegmentDeletes,
  type PendingSegmentDeleteProjection,
} from './segmentDeleteProjection';
import type { WorkspaceMemoryDetail, WorkspaceMemorySummary } from './workspaceApi';

function memory(overrides: Partial<WorkspaceMemorySummary> = {}): WorkspaceMemorySummary {
  return {
    supplementCount: 0,
    audioByteLength: 600,
    createdAt: '2026-05-06T13:08:00.000Z',
    durationMs: 6000,
    hasTranscript: false,
    memoryId: 'mem_projection',
    segmentCount: 3,
    title: 'Projection memory',
    updatedAt: '2026-05-06T13:13:00.000Z',
    ...overrides,
  };
}

function segment({
  audioByteLength,
  durationMs,
  segmentId,
  title,
}: {
  readonly audioByteLength: number;
  readonly durationMs: number;
  readonly segmentId: string;
  readonly title: string;
}): WorkspaceMemoryDetail['segments'][number] {
  return {
    supplementCount: 0,
    supplements: [],
    audioByteLength,
    createdAt: '2026-05-06T13:08:00.000Z',
    durationMs,
    lastTranscriptionAttempt: 'never' as const,
    memoryId: 'mem_projection',
    segmentId,
    title,
    transcript: { exists: false },
    type: 'audio',
    updatedAt: '2026-05-06T13:09:00.000Z',
    workspaceId: 'ws_projection',
  };
}

function pendingProjection({
  baseMemory,
  removedSegment,
}: {
  readonly baseMemory: WorkspaceMemorySummary;
  readonly removedSegment: WorkspaceMemoryDetail['segments'][number];
}): PendingSegmentDeleteProjection {
  return {
    memoryBeforeDelete: baseMemory,
    memoryId: baseMemory.memoryId,
    optimisticMemory: memory({
      audioByteLength: baseMemory.audioByteLength - removedSegment.audioByteLength,
      durationMs: baseMemory.durationMs - removedSegment.durationMs,
      segmentCount: baseMemory.segmentCount - 1,
    }),
    segment: removedSegment,
    segmentId: removedSegment.segmentId,
    workspaceHandle: 'workspace-handle-1',
    workspaceId: 'ws_projection',
  };
}

describe('segment delete projection', () => {
  it('replays a remaining pending delete over a later delayed commit response', () => {
    const baseMemory = memory();
    const firstSegment = segment({
      audioByteLength: 100,
      durationMs: 1000,
      segmentId: 'seg_projection_first',
      title: 'First',
    });
    const firstPending = pendingProjection({
      baseMemory,
      removedSegment: firstSegment,
    });
    const memoryAfterSecondCommit = memory({
      audioByteLength: 400,
      durationMs: 4000,
      segmentCount: 2,
    });

    expect(
      memorySummaryWithPendingSegmentDelete(memoryAfterSecondCommit, firstPending)
    ).toMatchObject({
      audioByteLength: 300,
      durationMs: 3000,
      segmentCount: 1,
    });
  });

  it('replays multiple pending deletes without using aggregate count as identity', () => {
    const baseMemory = memory();
    const firstPending = pendingProjection({
      baseMemory,
      removedSegment: segment({
        audioByteLength: 100,
        durationMs: 1000,
        segmentId: 'seg_projection_first',
        title: 'First',
      }),
    });
    const secondPending = pendingProjection({
      baseMemory,
      removedSegment: segment({
        audioByteLength: 200,
        durationMs: 2000,
        segmentId: 'seg_projection_second',
        title: 'Second',
      }),
    });

    const projected = snapshotWithPendingSegmentDeletes(
      {
        description: '',
        memories: [baseMemory],
        title: 'Projection workspace',
        workspaceId: 'ws_projection',
      },
      [firstPending, secondPending]
    );

    expect(projected.memories[0]).toMatchObject({
      audioByteLength: 300,
      durationMs: 3000,
      segmentCount: 1,
    });
  });

  it('keeps external non-additive summary fields while applying pending additive deltas', () => {
    const baseMemory = memory({
      hasTranscript: true,
      updatedAt: '2026-05-06T13:13:00.000Z',
    });
    const pending = pendingProjection({
      baseMemory,
      removedSegment: segment({
        audioByteLength: 100,
        durationMs: 1000,
        segmentId: 'seg_projection_external',
        title: 'External',
      }),
    });
    const externallyUpdatedMemory = memory({
      audioByteLength: 650,
      durationMs: 6500,
      hasTranscript: true,
      segmentCount: 3,
      updatedAt: '2026-05-06T13:20:00.000Z',
    });

    expect(memorySummaryWithPendingSegmentDelete(externallyUpdatedMemory, pending)).toMatchObject({
      audioByteLength: 550,
      durationMs: 5500,
      hasTranscript: true,
      segmentCount: 2,
      updatedAt: '2026-05-06T13:20:00.000Z',
    });
  });
});

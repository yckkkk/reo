import { describe, expect, it } from 'vitest';
import {
  memorySummaryAfterSegmentRestore,
  memorySummaryAfterSegmentRemoval,
  memorySummaryWithVisibleSegments,
  memorySummaryWithPendingSegmentDelete,
  snapshotWithPendingSegmentDeletes,
  type PendingSegmentDeleteProjection,
} from './segmentDeleteProjection';
import type { WorkspaceMemoryDetail, WorkspaceMemorySummary } from './workspaceApi';

type AnySegment = WorkspaceMemoryDetail['segments'][number];
type AudioSegment = Extract<WorkspaceMemoryDetail['segments'][number], { type: 'audio' }>;
type ArtifactSegment = Extract<WorkspaceMemoryDetail['segments'][number], { type: 'artifact' }>;
type NoteSupplement = Extract<AudioSegment['supplements'][number], { type: 'note' }>;

function memory(overrides: Partial<WorkspaceMemorySummary> = {}): WorkspaceMemorySummary {
  return {
    supplementCount: 0,
    audioByteLength: 600,
    createdAt: '2026-05-06T13:08:00.000Z',
    audioDurationMs: 6000,
    hasAudioTranscript: false,
    memoryId: 'mem_projection',
    segmentCount: 3,
    noteSegmentCount: 0,
    artifactSegmentCount: 0,
    audioSegmentCount: 3,
    hasAnyNote: false,
    title: 'Projection memory',
    updatedAt: '2026-05-06T13:13:00.000Z',
    ...overrides,
  };
}

function segment({
  audioByteLength,
  durationMs,
  segmentId,
  supplements = [],
  title,
}: {
  readonly audioByteLength: number;
  readonly durationMs: number;
  readonly segmentId: string;
  readonly supplements?: readonly AudioSegment['supplements'][number][];
  readonly title: string;
}): AudioSegment {
  return {
    supplementCount: supplements.length,
    supplements: [...supplements],
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

function artifactSegment(segmentId: string): ArtifactSegment {
  return {
    createdAt: '2026-05-06T13:08:00.000Z',
    entryByteLength: 128,
    entryHash: 'a'.repeat(64),
    format: 'html',
    memoryId: 'mem_projection',
    previewVersion: 'a'.repeat(64),
    segmentId,
    supplementCount: 0,
    supplements: [],
    title: 'Artifact',
    type: 'artifact',
    updatedAt: '2026-05-06T13:09:00.000Z',
    workspaceId: 'ws_projection',
  };
}

function noteSupplement(supplementId: string): NoteSupplement {
  return {
    bodyByteLength: 64,
    createdAt: '2026-05-06T13:08:00.000Z',
    memoryId: 'mem_projection',
    segmentId: 'seg_projection_with_note_supplement',
    supplementId,
    title: 'Note supplement',
    type: 'note',
    updatedAt: '2026-05-06T13:09:00.000Z',
    workspaceId: 'ws_projection',
  };
}

function pendingProjection({
  baseMemory,
  removedSegment,
}: {
  readonly baseMemory: WorkspaceMemorySummary;
  readonly removedSegment: AnySegment;
}): PendingSegmentDeleteProjection {
  const isAudioSegment = removedSegment.type === 'audio';
  return {
    memoryBeforeDelete: baseMemory,
    memoryId: baseMemory.memoryId,
    optimisticMemory: memory({
      audioByteLength: isAudioSegment
        ? baseMemory.audioByteLength - removedSegment.audioByteLength
        : baseMemory.audioByteLength,
      audioDurationMs: isAudioSegment
        ? baseMemory.audioDurationMs - removedSegment.durationMs
        : baseMemory.audioDurationMs,
      segmentCount: baseMemory.segmentCount - 1,
      noteSegmentCount:
        removedSegment.type === 'note'
          ? Math.max(0, baseMemory.noteSegmentCount - 1)
          : baseMemory.noteSegmentCount,
      artifactSegmentCount:
        removedSegment.type === 'artifact'
          ? Math.max(0, baseMemory.artifactSegmentCount - 1)
          : baseMemory.artifactSegmentCount,
      audioSegmentCount: isAudioSegment
        ? Math.max(0, baseMemory.audioSegmentCount - 1)
        : baseMemory.audioSegmentCount,
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
      audioDurationMs: 4000,
      segmentCount: 2,
      noteSegmentCount: 0,
      artifactSegmentCount: 0,
      audioSegmentCount: 2,
    });

    expect(
      memorySummaryWithPendingSegmentDelete(memoryAfterSecondCommit, firstPending)
    ).toMatchObject({
      audioByteLength: 300,
      audioDurationMs: 3000,
      segmentCount: 1,
      noteSegmentCount: 0,
      artifactSegmentCount: 0,
      audioSegmentCount: 1,
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
      audioDurationMs: 3000,
      segmentCount: 1,
      noteSegmentCount: 0,
      artifactSegmentCount: 0,
      audioSegmentCount: 1,
    });
  });

  it('keeps external non-additive summary fields while applying pending additive deltas', () => {
    const baseMemory = memory({
      hasAudioTranscript: true,
      hasAnyNote: false,
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
      audioDurationMs: 6500,
      hasAudioTranscript: true,
      hasAnyNote: false,
      segmentCount: 3,
      noteSegmentCount: 0,
      artifactSegmentCount: 0,
      audioSegmentCount: 3,
      updatedAt: '2026-05-06T13:20:00.000Z',
    });

    expect(memorySummaryWithPendingSegmentDelete(externallyUpdatedMemory, pending)).toMatchObject({
      audioByteLength: 550,
      audioDurationMs: 5500,
      hasAudioTranscript: true,
      hasAnyNote: false,
      segmentCount: 2,
      noteSegmentCount: 0,
      artifactSegmentCount: 0,
      audioSegmentCount: 2,
      updatedAt: '2026-05-06T13:20:00.000Z',
    });
  });

  it('recomputes hasAnyNote from note supplements in visible segments', () => {
    const visibleSegment = segment({
      audioByteLength: 100,
      durationMs: 1000,
      segmentId: 'seg_projection_with_note_supplement',
      supplements: [noteSupplement('sup_projection_note')],
      title: 'With note supplement',
    });

    expect(
      memorySummaryAfterSegmentRemoval({
        memory: memory({
          audioByteLength: 200,
          audioDurationMs: 2000,
          audioSegmentCount: 2,
          hasAnyNote: true,
          segmentCount: 2,
          supplementCount: 1,
        }),
        removedSegment: segment({
          audioByteLength: 100,
          durationMs: 1000,
          segmentId: 'seg_projection_deleted',
          title: 'Deleted',
        }),
        remainingSegments: [visibleSegment],
      })
    ).toMatchObject({
      hasAnyNote: true,
    });
  });

  it('preserves hasAnyNote when deleting without visible segment detail', () => {
    expect(
      memorySummaryAfterSegmentRemoval({
        memory: memory({
          audioByteLength: 200,
          audioDurationMs: 2000,
          audioSegmentCount: 2,
          hasAnyNote: true,
          segmentCount: 2,
        }),
        removedSegment: segment({
          audioByteLength: 100,
          durationMs: 1000,
          segmentId: 'seg_projection_deleted_without_detail',
          title: 'Deleted',
        }),
      })
    ).toMatchObject({
      hasAnyNote: true,
    });
  });

  it('updates artifact segment count without decrementing note count', () => {
    expect(
      memorySummaryAfterSegmentRemoval({
        memory: memory({
          audioByteLength: 0,
          audioDurationMs: 0,
          audioSegmentCount: 0,
          artifactSegmentCount: 1,
          noteSegmentCount: 1,
          segmentCount: 2,
        }),
        removedSegment: artifactSegment('seg_projection_artifact_deleted'),
      })
    ).toMatchObject({
      artifactSegmentCount: 0,
      noteSegmentCount: 1,
      segmentCount: 1,
    });
  });

  it('recomputes and restores artifact counts explicitly', () => {
    const visibleArtifact = artifactSegment('seg_projection_artifact_visible');

    expect(
      memorySummaryWithVisibleSegments(
        memory({
          audioByteLength: 0,
          audioDurationMs: 0,
          audioSegmentCount: 0,
          artifactSegmentCount: 0,
          noteSegmentCount: 0,
          segmentCount: 0,
        }),
        [visibleArtifact]
      )
    ).toMatchObject({
      artifactSegmentCount: 1,
      noteSegmentCount: 0,
      segmentCount: 1,
    });

    expect(
      memorySummaryAfterSegmentRestore({
        memory: memory({
          audioByteLength: 0,
          audioDurationMs: 0,
          audioSegmentCount: 0,
          artifactSegmentCount: 0,
          noteSegmentCount: 0,
          segmentCount: 0,
        }),
        restoredSegment: visibleArtifact,
      })
    ).toMatchObject({
      artifactSegmentCount: 1,
      noteSegmentCount: 0,
      segmentCount: 1,
    });
  });

  it('replays artifact pending deletes using artifact count as part of the base match', () => {
    const baseMemory = memory({
      audioByteLength: 0,
      audioDurationMs: 0,
      audioSegmentCount: 0,
      artifactSegmentCount: 2,
      noteSegmentCount: 0,
      segmentCount: 2,
    });
    const pending = pendingProjection({
      baseMemory,
      removedSegment: artifactSegment('seg_projection_artifact_pending'),
    });

    expect(memorySummaryWithPendingSegmentDelete(baseMemory, pending)).toMatchObject({
      artifactSegmentCount: 1,
      noteSegmentCount: 0,
      segmentCount: 1,
    });
  });
});

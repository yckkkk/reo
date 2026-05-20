import { describe, expect, it } from 'vitest';
import { mergeMemoryIntoSession } from './appProjection';

describe('app projection helpers', () => {
  it('keeps memory projection fresh after finalize', () => {
    const session = {
      workspaceHandle: 'workspace-handle-1',
      workspaceId: 'ws_1',
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Daily memory',
        description: '',
        memories: [],
      },
    };

    expect(
      mergeMemoryIntoSession(session, {
        audioByteLength: 3,
        createdAt: '2026-05-06T13:08:00.000Z',
        audioDurationMs: 2000,
        supplementCount: 0,
        hasAudioTranscript: false,
        hasAnyNote: false,
        memoryId: 'mem_1',
        segmentCount: 1,
        noteSegmentCount: 0,
        audioSegmentCount: 1,
        title: 'Daily memory recording',
        updatedAt: '2026-05-06T13:09:00.000Z',
      }).snapshot
    ).toMatchObject({
      memories: [{ memoryId: 'mem_1', segmentCount: 1 }],
    });
  });

  it('keeps unchanged activity order when merging a renamed memory projection', () => {
    const olderMemory = {
      audioByteLength: 3,
      createdAt: '2026-05-06T13:08:00.000Z',
      audioDurationMs: 2000,
      supplementCount: 0,
      hasAudioTranscript: false,
      hasAnyNote: false,
      memoryId: 'mem_older',
      segmentCount: 1,
      noteSegmentCount: 0,
      audioSegmentCount: 1,
      title: 'Older',
      updatedAt: '2026-05-06T13:09:00.000Z',
    };
    const newerMemory = {
      ...olderMemory,
      memoryId: 'mem_newer',
      title: 'Newer',
      updatedAt: '2026-05-06T13:12:00.000Z',
    };
    const session = {
      workspaceHandle: 'workspace-handle-1',
      workspaceId: 'ws_1',
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Daily memory',
        description: '',
        memories: [newerMemory, olderMemory],
      },
    };

    expect(
      mergeMemoryIntoSession(session, {
        ...olderMemory,
        title: 'Renamed older',
      }).snapshot.memories.map((memory) => memory.memoryId)
    ).toEqual(['mem_newer', 'mem_older']);
  });

  it('moves an updated existing memory to its projected activity position', () => {
    const olderMemory = {
      audioByteLength: 3,
      createdAt: '2026-05-06T13:08:00.000Z',
      audioDurationMs: 2000,
      supplementCount: 0,
      hasAudioTranscript: false,
      hasAnyNote: false,
      memoryId: 'mem_older',
      segmentCount: 1,
      noteSegmentCount: 0,
      audioSegmentCount: 1,
      title: 'Older',
      updatedAt: '2026-05-06T13:09:00.000Z',
    };
    const newerMemory = {
      ...olderMemory,
      memoryId: 'mem_newer',
      title: 'Newer',
      updatedAt: '2026-05-06T13:12:00.000Z',
    };
    const session = {
      workspaceHandle: 'workspace-handle-1',
      workspaceId: 'ws_1',
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Daily memory',
        description: '',
        memories: [newerMemory, olderMemory],
      },
    };

    expect(
      mergeMemoryIntoSession(session, {
        ...olderMemory,
        updatedAt: '2026-05-06T13:13:00.000Z',
      }).snapshot.memories.map((memory) => memory.memoryId)
    ).toEqual(['mem_older', 'mem_newer']);
  });

  it('moves an existing memory down when its projected activity becomes older', () => {
    const olderMemory = {
      audioByteLength: 3,
      createdAt: '2026-05-06T13:08:00.000Z',
      audioDurationMs: 2000,
      supplementCount: 0,
      hasAudioTranscript: false,
      hasAnyNote: false,
      memoryId: 'mem_older',
      segmentCount: 1,
      noteSegmentCount: 0,
      audioSegmentCount: 1,
      title: 'Older',
      updatedAt: '2026-05-06T13:09:00.000Z',
    };
    const newerMemory = {
      ...olderMemory,
      memoryId: 'mem_newer',
      title: 'Newer',
      updatedAt: '2026-05-06T13:12:00.000Z',
    };
    const session = {
      workspaceHandle: 'workspace-handle-1',
      workspaceId: 'ws_1',
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Daily memory',
        description: '',
        memories: [newerMemory, olderMemory],
      },
    };

    expect(
      mergeMemoryIntoSession(session, {
        ...newerMemory,
        updatedAt: '2026-05-06T13:07:00.000Z',
      }).snapshot.memories.map((memory) => memory.memoryId)
    ).toEqual(['mem_older', 'mem_newer']);
  });

  it('uses createdAt as the projected activity tie-break when updatedAt matches', () => {
    const firstMemory = {
      audioByteLength: 3,
      createdAt: '2026-05-06T13:10:00.000Z',
      audioDurationMs: 2000,
      supplementCount: 0,
      hasAudioTranscript: false,
      hasAnyNote: false,
      memoryId: 'mem_first',
      segmentCount: 1,
      noteSegmentCount: 0,
      audioSegmentCount: 1,
      title: 'First',
      updatedAt: '2026-05-06T13:12:00.000Z',
    };
    const secondMemory = {
      ...firstMemory,
      createdAt: '2026-05-06T13:09:00.000Z',
      memoryId: 'mem_second',
      title: 'Second',
    };
    const session = {
      workspaceHandle: 'workspace-handle-1',
      workspaceId: 'ws_1',
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Daily memory',
        description: '',
        memories: [firstMemory, secondMemory],
      },
    };

    expect(
      mergeMemoryIntoSession(session, {
        ...secondMemory,
        createdAt: '2026-05-06T13:11:00.000Z',
      }).snapshot.memories.map((memory) => memory.memoryId)
    ).toEqual(['mem_second', 'mem_first']);
  });
});

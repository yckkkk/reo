import { describe, expect, it } from 'vitest';
import {
  memoryDetailQueryBelongsToWorkspace,
  memoryDetailQueryOptions,
  memoryDetailQueryKey,
  memorySpacesQueryKey,
  segmentContentQueryOptions,
  segmentContentQueryKey,
  segmentSupplementContentQueryOptions,
  workspaceHandleScopedContentQueryBelongsToWorkspace,
  workspaceContentQueryBelongsToWorkspace,
  workspaceSnapshotQueryKey,
} from './workspaceQueries';

describe('workspace queries', () => {
  it('does not include workspaceHandle in the workspace snapshot query key', () => {
    expect(
      workspaceSnapshotQueryKey({ workspaceId: 'ws_1', workspaceHandle: 'secret-handle' })
    ).toEqual(['workspace', 'snapshot', 'ws_1']);
  });

  it('uses a stable 记忆空间 query key', () => {
    expect(memorySpacesQueryKey()).toEqual(['workspace', 'memory-spaces']);
  });

  it('does not include workspaceHandle in the Memory detail query key', () => {
    expect(
      memoryDetailQueryKey({
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        workspaceHandle: 'secret-handle',
      })
    ).toEqual(['workspace', 'memory-detail', 'ws_1', 'mem_1']);
  });

  it('does not include workspaceHandle in the Segment content query key', () => {
    expect(
      segmentContentQueryKey({
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        workspaceHandle: 'secret-handle',
      })
    ).toEqual(['workspace', 'segment-content', 'ws_1', 'mem_1', 'seg_1']);
  });

  it('refetches file-backed detail and content when cached workspace data is opened again', () => {
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

    expect(memoryDetailQueryOptions(session, 'mem_1').refetchOnMount).toBe('always');
    expect(segmentContentQueryOptions(session, 'mem_1', 'seg_1', 'note').refetchOnMount).toBe(
      'always'
    );
    expect(
      segmentSupplementContentQueryOptions(session, 'mem_1', 'seg_1', 'sup_1', 'note')
        .refetchOnMount
    ).toBe('always');
    expect(segmentContentQueryOptions(session, 'mem_1', 'seg_1', 'audio').refetchOnMount).toBe(
      'always'
    );
    expect(
      segmentSupplementContentQueryOptions(session, 'mem_1', 'seg_1', 'sup_1', 'audio')
        .refetchOnMount
    ).toBe('always');
  });

  it('matches handle-scoped workspace content query keys', () => {
    expect(
      workspaceHandleScopedContentQueryBelongsToWorkspace(
        ['workspace', 'memory-detail', 'ws_1', 'mem_1'],
        'ws_1'
      )
    ).toBe(true);
    expect(
      workspaceHandleScopedContentQueryBelongsToWorkspace(
        ['workspace', 'segment-content', 'ws_1', 'mem_1', 'seg_1'],
        'ws_1'
      )
    ).toBe(true);
    expect(
      workspaceHandleScopedContentQueryBelongsToWorkspace(
        ['workspace', 'segment-supplement-content', 'ws_1', 'mem_1', 'seg_1', 'sup_1'],
        'ws_1'
      )
    ).toBe(true);
    expect(
      workspaceHandleScopedContentQueryBelongsToWorkspace(['workspace', 'snapshot', 'ws_1'], 'ws_1')
    ).toBe(false);
    expect(
      workspaceHandleScopedContentQueryBelongsToWorkspace(
        ['workspace', 'memory-detail', 'ws_2', 'mem_1'],
        'ws_1'
      )
    ).toBe(false);
  });

  it('splits reusable Memory detail projection from large workspace content caches', () => {
    expect(
      memoryDetailQueryBelongsToWorkspace(['workspace', 'memory-detail', 'ws_1', 'mem_1'], 'ws_1')
    ).toBe(true);
    expect(
      memoryDetailQueryBelongsToWorkspace(
        ['workspace', 'segment-content', 'ws_1', 'mem_1', 'seg_1'],
        'ws_1'
      )
    ).toBe(false);
    expect(
      workspaceContentQueryBelongsToWorkspace(
        ['workspace', 'segment-content', 'ws_1', 'mem_1', 'seg_1'],
        'ws_1'
      )
    ).toBe(true);
    expect(
      workspaceContentQueryBelongsToWorkspace(
        ['workspace', 'segment-supplement-content', 'ws_1', 'mem_1', 'seg_1', 'sup_1'],
        'ws_1'
      )
    ).toBe(true);
    expect(
      workspaceContentQueryBelongsToWorkspace(
        ['workspace', 'memory-detail', 'ws_1', 'mem_1'],
        'ws_1'
      )
    ).toBe(false);
  });
});

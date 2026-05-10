import { describe, expect, it } from 'vitest';
import {
  memoryDetailQueryKey,
  memorySpacesQueryKey,
  segmentContentQueryKey,
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
});

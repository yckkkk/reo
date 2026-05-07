import { describe, expect, it } from 'vitest';
import { memoryDetailQueryKey, workspaceSnapshotQueryKey } from './workspaceQueries';

describe('workspace queries', () => {
  it('does not include workspaceHandle in the workspace snapshot query key', () => {
    expect(
      workspaceSnapshotQueryKey({ workspaceId: 'ws_1', workspaceHandle: 'secret-handle' })
    ).toEqual(['workspace', 'snapshot', 'ws_1']);
  });

  it('does not include workspaceHandle in the memory detail query key', () => {
    expect(
      memoryDetailQueryKey({
        memoryId: 'mem_birthday',
        workspaceId: 'ws_1',
      })
    ).toEqual(['workspace', 'memory-detail', 'ws_1', 'mem_birthday']);
    expect(memoryDetailQueryKey({ memoryId: 'mem_birthday', workspaceId: 'ws_1' })).not.toContain(
      'workspace-handle-secret'
    );
  });
});

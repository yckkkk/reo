import { describe, expect, it } from 'vitest';
import { memorySpacesQueryKey, workspaceSnapshotQueryKey } from './workspaceQueries';

describe('workspace queries', () => {
  it('does not include workspaceHandle in the workspace snapshot query key', () => {
    expect(
      workspaceSnapshotQueryKey({ workspaceId: 'ws_1', workspaceHandle: 'secret-handle' })
    ).toEqual(['workspace', 'snapshot', 'ws_1']);
  });

  it('uses a stable 记忆空间 query key', () => {
    expect(memorySpacesQueryKey()).toEqual(['workspace', 'memory-spaces']);
  });
});

import { describe, expect, it } from 'vitest';
import { workspaceErrorDisplayMessage } from './workspaceErrorMessages';

describe('workspaceErrorDisplayMessage', () => {
  it('maps Segment delete and restore errors to user-visible recovery copy', () => {
    expect(
      workspaceErrorDisplayMessage({
        code: 'ERR_SEGMENT_DELETE_FAILED',
        message: 'Segment could not be deleted',
      })
    ).toBe('无法删除片段。');
    expect(
      workspaceErrorDisplayMessage({
        code: 'ERR_SEGMENT_RESTORE_FAILED',
        message: 'Deleted Segment could not be restored',
      })
    ).toBe('无法恢复片段。');
    expect(
      workspaceErrorDisplayMessage({
        code: 'ERR_SEGMENT_RESTORE_PARENT_MISSING',
        message: 'Deleted Segment parent Memory is missing',
      })
    ).toBe('无法恢复片段，所属记忆已不存在。');
  });
});

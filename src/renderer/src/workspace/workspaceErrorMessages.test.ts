import { describe, expect, it } from 'vitest';
import { workspaceErrorDisplayMessage } from './workspaceErrorMessages';

describe('workspaceErrorDisplayMessage', () => {
  it('maps manual transcription backfill conflicts to actionable copy', () => {
    expect(
      workspaceErrorDisplayMessage({
        code: 'ERR_BACKFILL_TRANSCRIPT_CHANGED',
        message: 'Transcript changed before save',
      })
    ).toBe('转录已在生成期间发生变化，已保留当前内容。请确认后重新生成。');
    expect(
      workspaceErrorDisplayMessage({
        code: 'ERR_BACKFILL_TARGET_NOT_ELIGIBLE',
        message: 'Backfill target is not eligible',
      })
    ).toBe('这段录音已生成转录；如需覆盖，请使用「重新生成转录」。');
  });

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

  it('maps entity action infrastructure errors instead of exposing raw process messages', () => {
    expect(
      workspaceErrorDisplayMessage({
        code: 'ERR_SHELL_OPEN_FAILED',
        message: 'shell.openPath returned launch services error',
      })
    ).toBe('无法完成系统操作。');
    expect(
      workspaceErrorDisplayMessage({
        code: 'ERR_CLIPBOARD_WRITE_FAILED',
        message: 'clipboard.writeText failed',
      })
    ).toBe('无法复制路径。');
    expect(
      workspaceErrorDisplayMessage({
        code: 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND',
        message: 'SegmentSupplement path could not be resolved',
      })
    ).toBe('找不到这个补充内容。');
  });
});

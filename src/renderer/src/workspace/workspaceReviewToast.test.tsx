import { describe, expect, it } from 'vitest';
import { buildWorkspaceReviewAgentPrompt } from '../../../workspace-contract/workspace-review-prompt';
import { workspaceReviewToastState } from './workspaceReviewToast';

describe('workspaceReviewToastState', () => {
  it('stays clean when snapshot review is missing or clean', () => {
    expect(workspaceReviewToastState({ workspaceId: 'ws_1' })).toEqual({ status: 'clean' });
    expect(
      workspaceReviewToastState({
        workspaceId: 'ws_1',
        review: {
          needsReviewCount: 0,
          markdownCandidateCount: 0,
          tiptapSidecarCount: 0,
        },
      })
    ).toEqual({ status: 'clean' });
  });

  it('projects unresolved state from aggregate review counts only', () => {
    expect(
      workspaceReviewToastState({
        workspaceId: 'ws_1',
        review: {
          needsReviewCount: 2,
          markdownCandidateCount: 1,
          tiptapSidecarCount: 1,
        },
      })
    ).toEqual({
      status: 'unresolved',
      count: 2,
      toastId: 'reo-needs-review:ws_1',
    });
  });
});

describe('buildWorkspaceReviewAgentPrompt', () => {
  it('builds a bounded agent prompt without raw paths or report entries', () => {
    const prompt = buildWorkspaceReviewAgentPrompt(2);

    expect(prompt).toContain('Reo 检测到这个记忆空间有 2 个文件需要检查。');
    expect(prompt).toContain('node skills/reo-doctor/scripts/reo-doctor.mjs');
    expect(prompt).toContain('.reo/review/needs-review.md');
    expect(prompt).toContain('按每条 recovery hint 处理');
    expect(prompt).not.toContain('/Users/');
    expect(prompt).not.toContain('workspace-handle');
    expect(prompt).not.toContain('source.hash');
    expect(prompt).not.toContain('contentHash');
    expect(prompt).not.toContain('memories/mem_');
  });
});

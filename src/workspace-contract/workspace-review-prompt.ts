export function buildWorkspaceReviewAgentPrompt(needsReviewCount: number): string {
  const count = Math.max(0, Math.trunc(needsReviewCount));
  return [
    `Reo 检测到这个记忆空间有 ${count} 个文件需要检查。`,
    '请先阅读 AGENTS.md；如果需要诊断，运行：',
    'node skills/reo-doctor/scripts/reo-doctor.mjs',
    '',
    '只按 reo-doctor 和 .reo/review/needs-review.md 的 workspace-relative 信息处理，并按每条 recovery hint 处理。',
    '不要猜测合并，不要删除用户内容，不要把 .reo 当作语义真源。',
    '修复后让 Reo 重新刷新 Workspace snapshot，确认 needs-review 消失。',
  ].join('\n');
}

# 验证

## 设计阶段已完成

- 已确认隔离实现 worktree、分支和初始工作区状态。
- 已读取 `docs/current/*`、当前 renderer/workspace 源码和所有指定 reference 素材。
- 已覆盖 6 张主参考图和 `/private/tmp/reo-reference-frames/` 的 41 张辅助帧，作为后续 UI/reference 验证输入。
- 已查询 Context7 官方文档：Electron、shadcn/ui、TanStack Query。
- 已研究 ElevenLabs UI、shadcn Drawer、Vaul、wavesurfer.js 和相关 GitHub 开源实现。
- 已按 Practical UI 核对交互成本、认知负荷、设计系统、可访问性、视觉层级、间距、按钮和表单准则。

## 固定验证

- `npx prettier --check docs/current/frontend.md docs/current/data.md docs/current/flow.md docs/current/quality.md docs/specs/2026-05-06-0912-first-product-slice-product-grade-design-hardening/*.md`：通过。
- `npm run verify:quick`：通过。
- `git diff --check`：通过。
- `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：通过；design-hardening 归档前只输出当时的 active spec。

任务 1 开始后必须在对应 任务 spec 中重新记录实现验证、复审和归档证据。

## 审查验证

- Subagent final review：通过，无未解决 BLOCKER/MAJOR。
- Codex CLI final review：通过，无未解决 BLOCKER/MAJOR。
- 用户提供 Claude CLI review：通过，无未解决 BLOCKER/MAJOR。
- `$writing-plans` subagent review：通过，无未解决 BLOCKER/MAJOR。
- `$plan-eng-review` subagent full review：通过，无未解决 BLOCKER/MAJOR。
- `$plan-eng-review` Codex CLI full review：通过，无未解决 BLOCKER/MAJOR。
- Focused subagent review：通过，无未解决 BLOCKER/MAJOR。
- Focused Codex CLI review：通过，无未解决 BLOCKER/MAJOR。
- Claude CLI focused review attempt：按用户指定只设置 prompt、model 和 effort；当时 CLI 返回模型不可用或访问受限，未替换模型。

## 运行时验证

本 spec 不实现运行时代码，因此未执行 Computer Use。实现阶段必须在对应 任务 spec 中记录 OS dialog、录音和 reference 对照证据。

# 第一产品切片

## 目标

完成 Reo first product slice 的产品级交付：创建/打开本地 workspace、真实 app shell、Home/Memory detail、录音 drawer、音频保存/播放、transcript/reflections 编辑、文件真源、Electron 安全边界、QA/TDD、review、verification 和 commit。

## 当前状态

- Design-hardening gate 已通过独立复审，无 unresolved BLOCKER/MAJOR。
- Reconciled implementation plan 已通过 `$writing-plans` 和 `$plan-eng-review` 对抗审查，无 unresolved BLOCKER/MAJOR。
- 当前 implementation 阶段执行权威是本 initiative、`implementation-plan.md`、当前唯一 active 任务 spec、`docs/current/*` 和源码事实。
- Design-hardening spec 在 plan handoff 完成后归档到 `docs/archive/specs/2026-05-06-0912-first-product-slice-product-grade-design-hardening/`，归档后只作为背景证据。
- 当前已完成 Task 1 到 Task 12 的实现、QA、审查和提交准备。
- 当前下一步是 Task 13：Docs/current 压缩、initiative 收口、最终 review、verification 和 commit。
- 不得把计划写入 `docs/superpowers/*`。
- 不得编辑 archived implementation plan。

## 完成条件

- Reconciled implementation plan 通过 `$plan-eng-review`。
- 实现阶段在隔离 worktree 中按真实 TDD 红/绿/重构执行。
- 每个实现 slice 有 spec、验证证据、`docs/current/*` 更新和 commit。
- 运行并记录 `npm run verify:quick`、`git diff --check`、`diff -u AGENTS.md .claude/CLAUDE.md`、`find docs/specs -mindepth 1 -maxdepth 1 -print`。
- 需要真实操作验证时使用 Computer Use。
- 需要 UI/reference 验证时对照 6 张主图和 41 张辅助帧记录 evidence。

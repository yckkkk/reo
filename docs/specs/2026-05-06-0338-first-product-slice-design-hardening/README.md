# 第一产品切片设计加固

时间：2026-05-06 03:38 America/Los_Angeles
状态：设计门禁通过复审

## 目标

完成 Reo first product slice 的工程执行前设计基线。这个门禁只关闭设计阻断，不授权实现代码、不安装依赖、不执行 Slice 1。

First product slice 的完整长任务目标仍然是：创建本地 memory workspace、录音、显示 live mock transcript、停止后编辑 transcript 与 reflections、重新打开 recording 播放和编辑、workspace 文件可被 Codex CLI read-only 理解。

## 权威顺序

1. `docs/current/*`
2. `docs/initiatives/2026-05-06-first-product-slice/*`
3. 本 spec
4. `docs/archive/specs/*` 背景材料

Archived implementation plan 只作为差异输入，禁止编辑，也不能作为当前执行计划。

## 覆盖范围

- PM 与产品验收。
- Product Design、reference mapping、accessibility。
- Frontend/UI system、shadcn/ui、Radix、ElevenLabs UI、Vaul、wavesurfer.js。
- Electron、preload、IPC、安全和协议边界。
- Data、DB 暂缓、filesystem transaction、workspace file contract。
- QA/TDD、operation validation、Codex CLI read-only validation。
- Docs lifecycle、execution readiness、open-source reuse。

## TDD 说明

本阶段是文档和设计门禁，不包含行为代码改动，豁免 RED/GREEN/REFACTOR。后续 implementation slices 必须真实 TDD，并在每个 slice spec 记录 RED、GREEN、REFACTOR 和验证证据。

## 产物

- `requirements.md`
- `traceability-matrix.md`
- `ui-blueprint.md`
- `reference-map.md`
- `external-research.md`
- `reuse-decisions.md`
- `accessibility-matrix.md`
- `architecture-views.md`
- `data-contracts.md`
- `filesystem-transactions.md`
- `protocol-contracts.md`
- `security-threat-model.md`
- `state-machines.md`
- `qa-matrix.md`
- `foundation-decisions.md`
- `code-simplicity.md`
- `implementation-plan-reconciliation.md`
- `new-session-handoff.md`
- `review.md`
- `verification.md`

## 通过条件

- 本 spec 所有 mandatory artifact 完成。
- `review.md` 记录自审、subagent、Claude CLI 或 Codex CLI 对抗审查。
- 无未解决 BLOCKER 或 MAJOR。
- `verification.md` 记录当前快照执行过的 `npm run verify:quick`、`git diff --check`、`diff -u AGENTS.md .claude/CLAUDE.md`、`find docs/specs -mindepth 1 -maxdepth 1 -print`。
- active initiative 已更新下一步。
- 稳定长期结论已压缩回 `docs/current/*` 或 `docs/decisions/*`。

# 代码库简化 Start Gate

## 元信息

- 创建时间：2026-05-15 22:22 America/Los_Angeles
- 当前 HEAD：`305a24ea`
- 关联 initiative：`docs/initiatives/2026-05-15-codebase-simplification-foundation`
- 状态：complete

## Objective

按可验证任务顺序完成文件事务 helper 抽取、renderer entity action wrapper 统一，以及剩余 rename transaction 的保留决策。

## 背景

上一轮阶段性审查已经收口并提交：

- `305a24ea chore: harden staged codebase simplifications`

本轮按 plan 顺序执行代码迁移和决策 gate，避免在文件事务和 renderer owner state 上一次性扩大风险。

## 成功标准

- `src/main/workspaceDirectoryTransactions.ts` 承载已收敛的 workspace directory transaction primitives。
- `atomicWorkspaceFile.ts`、`recordingDrafts.ts`、`memoryFiles.ts`、`workspaceFiles.ts` 和 `workspaceLock.ts` 迁移后保持 lock、identity、rollback、cleanup 和 stale/unsafe path 行为。
- 四类 renderer entity action menu wrapper 通过 `workspaceApi.ts` 和 `entityActionBindings.ts` 触发只读 shell 动作，不直接调用 `window.reoWorkspace`。
- 剩余 directory rename transaction 已完成收益评估，并保留在本地 owner 中。
- `docs/current/flow.md`、`docs/current/frontend.md` 和 `docs/current/quality.md` 已更新为当前事实。

## 当前依据

- `docs/specs/*` 创建前为空。
- `docs/initiatives/README.md` 显示当前没有产品或代码开发 active initiative，只有商业化横切长期轨道。
- `docs/current/flow.md` 已记录文件事务、directory fsync、staging/expose、recovery、Query mutation 和 entity shell action 的当前边界。
- `docs/current/frontend.md` 已记录实体 More 菜单的当前 wrapper 和 action 行为。
- `docs/current/quality.md` 已记录 TDD、`verify:quick`、renderer/preload import 和简化审查门禁。

## Context7 采用依据

- Node.js v22 fs 文档用于确认 file flags、exclusive open、fsync、directory remove 和平台差异；计划不新增库，继续使用当前 Node fs API 与 Reo directory identity guard。
- React 官方文档用于确认抽取逻辑应服务组件 intent 和有意义复用；计划不把 Dialog、pending projection 或 Query owner 抽成泛用 hook。

## 非目标

- 不新增 runtime surface。
- 不改 UI 视觉和交互文案。
- 不创建 generic filesystem abstraction。
- 不把 Dialog、pending projection、Query owner 或 directory rename transaction 抽成泛用 helper。

## 验证计划

- 每个任务收口前运行 `npm run verify:quick`。
- 最终收口运行 `npm run verify:quick`。

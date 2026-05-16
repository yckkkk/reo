# 代码库简化 Start Gate

## 元信息

- 创建时间：2026-05-15 22:22 America/Los_Angeles
- 当前 HEAD：`305a24ea`
- 关联 initiative：`docs/initiatives/2026-05-15-codebase-simplification-foundation`
- 状态：active

## Objective

为更宽的文件事务 helper 抽取和 UI action wrapper 统一建立可执行 spec/plan，并定义第一批可验证实现切片。

## 背景

上一轮阶段性审查已经收口并提交：

- `305a24ea chore: harden staged codebase simplifications`

本轮不直接做大范围实现。先把长期任务拆成小的、可验证的 spec 顺序，避免在文件事务和 renderer owner state 上一次性扩大风险。

## 成功标准

- 新建一个产品或代码开发 active initiative，且不冲突当前商业化横切 initiative。
- 当前 spec 明确范围、非目标、采用依据、任务顺序和验证方式。
- 第一实现切片从文件事务 helper 最小骨架开始，不先处理宽 rename transaction 或 UI owner state。
- 明确 TDD 红线：所有行为改动必须先 RED，再 GREEN，再 REFACTOR。
- 本 planning spec 不改变 runtime 行为；TDD 豁免仅限文档和计划文件。

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

- 不执行代码迁移。
- 不新增 runtime surface。
- 不改 UI 视觉和交互文案。
- 不创建 generic filesystem abstraction。
- 不把 active spec 归档；后续实现切片仍以该 spec 的计划顺序推进或拆出新 spec。

## 验证计划

- 文档创建后运行 `npm run format:check`。
- 如果本 spec 后续进入实现阶段，每个任务收口前运行 `npm run verify:quick`。

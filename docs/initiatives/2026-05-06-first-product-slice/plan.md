# 计划

## 执行顺序

工程执行前设计基线和对齐实现计划已完成。后续实现切片以 `docs/archive/specs/2026-05-06-0452-first-product-slice-implementation-plan/plan.md` 为执行权威；不允许合并切片，不得编辑归档实现计划。

新 session 必须先设定 `$goal`：完成 Reo 第一产品切片的完整长任务交付。该目标覆盖设计加固、计划对齐、实现、QA、审查、验证和提交，不得把设计加固当作最终交付。

设计和计划阶段已完成：

0. 工程设计就绪门禁
1. 对齐实现计划和工程审查

实现阶段按对齐实现计划执行：

1. IMPL-001：Renderer 测试基础和 App 提取
2. IMPL-002：Preload、显式 IPC 和 Zod 边界
3. IMPL-003：Workspace 文件系统、handle、lock 和 recording draft
4. IMPL-004：Workspace data、Query 和创建表单
5. IMPL-005：Workspace home UI 和最小 shadcn primitives
6. IMPL-006：Recording overlay、MediaRecorder、autosave 和 playback
7. IMPL-007：Runtime、persistence、reference 和 Codex 只读验证

进入实现前必须使用 `$executing-plans`，并按 `using-git-worktrees` 创建隔离工作区；不得在 `main` 上直接实现，除非用户显式授权。

## 规则

- 每个切片必须创建自己的 `docs/specs/YYYY-MM-DD-HHMM-slug/`。
- 每个切片完成后归档自己的 session spec。
- 如果某个切片未完成，该切片 spec 留在 `docs/specs/*`，不能只存在于归档目录。
- 每个切片必须提交后才能进入下一切片。
- 不得跳过 foundation 切片直接实现产品 UI。
- 工程设计就绪门禁和对齐实现计划均已通过；进入实现前仍必须确认 `docs/specs/*` 为空。
- 归档实现计划不得再编辑；如发现计划缺陷，创建新的 active spec 修订并审查通过。
- 当前长期任务、后续设计加固 spec 和 `docs/current/*` 优先于归档 specs；归档只作背景和证据。

## 每个切片的必检问题

每个切片 spec 必须明确回答：

- DB schema：本切片是否引入 schema、migration 或 tables；如果不引入，为什么。
- 表关系：涉及哪些实体、relationship、cardinality、ownership、delete/update effect。
- 数据获取模式：TanStack Query、component state、filesystem scan、IPC request/response 的 owner 和 invalidation。
- 可复用组件：哪些是 reusable primitives，哪些是 feature-local；真实 consumer 和 invariant 是什么。
- 文件夹结构：用户文件、Reo metadata、rebuildable index、临时文件和恢复路径。
- 错误处理：用户可见错误、内部诊断、失败时保留的数据、retry/recovery 行为。

## 工程设计就绪门禁

实现前必须先完成 `engineering-readiness.md` 要求的设计包：

- 需求基线
- 产品和交互设计
- 架构视图
- 数据设计
- 协议和边界设计
- 状态和生命周期设计
- 基础能力激活决策
- QA 和验证设计
- 实现计划对齐

# 计划

## 执行顺序

先完成工程执行前设计基线，并在 `implementation-plan-reconciliation.md` 记录归档计划差异、替代决策和 `$writing-plans` 输入，再执行实现切片。不允许合并切片，不得编辑归档实现计划。

新 session 必须先设定 `$goal`：完成 Reo 第一产品切片的完整长任务交付。该目标覆盖设计加固、计划对齐、实现、QA、审查、验证和提交，不得把设计加固当作最终交付。

设计加固完成前，只有第 0 片是当前执行项：

0. 工程设计就绪门禁

第 1 片及之后的候选数量、名称、顺序和基础能力激活由 `implementation-plan-reconciliation.md` 作为 `$writing-plans` 输入。不得沿用归档计划的 7 片名称作为当前执行清单。

可执行的对齐后实现计划必须由 `$writing-plans` 产出，并先通过 `$plan-eng-review` 工程审查，再进入 `$executing-plans`。

## 规则

- 每个切片必须创建自己的 `docs/specs/YYYY-MM-DD-HHMM-slug/`。
- 每个切片完成后归档自己的 session spec。
- 如果某个切片未完成，该切片 spec 留在 `docs/specs/*`，不能只存在于归档目录。
- 每个切片必须提交后才能进入下一切片。
- 不得跳过 foundation 切片直接实现产品 UI。
- 工程设计就绪门禁通过前，不得执行第 1 片。
- 归档实现计划未完成对齐前，不得执行第 1 片。
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

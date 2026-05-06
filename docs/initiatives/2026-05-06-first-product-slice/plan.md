# Plan

## 执行顺序

先完成工程执行前设计基线，并更新、替换或显式 supersede archived implementation plan，再执行 implementation slices。不允许合并 slices。

新 session 必须先设定 `$goal`：完成 Reo first product slice 的完整长任务交付。该 goal 覆盖 design-hardening、plan reconciliation、implementation、QA、review、verification 和 commit，不得把 design-hardening 当作最终交付。

Design-hardening 完成前，只有 Slice 0 是当前执行项：

0. Engineering Design Readiness Gate

Slice 1+ 的候选数量、名称、顺序和 foundation activation 由 `implementation-plan-reconciliation.md` 作为 `$writing-plans` 输入。不得沿用 archived plan 的 7-slice 名称作为当前执行清单。

可执行的 reconciled implementation plan 必须由 `$writing-plans` 产出，并先通过 `$plan-eng-review` 工程审查，再进入 `$executing-plans`。

## 规则

- 每个 slice 必须创建自己的 `docs/specs/YYYY-MM-DD-HHMM-slug/`。
- 每个 slice 完成后归档自己的 session spec。
- 如果某个 slice 未完成，该 slice spec 留在 `docs/specs/*`，不能 archive-only。
- 每个 slice 必须提交后才能进入下一 slice。
- 不得跳过 foundation slice 直接实现产品 UI。
- Engineering Design Readiness Gate 通过前，不得执行 Slice 1。
- Archived implementation plan 未完成 reconciliation 前，不得执行 Slice 1。
- Active initiative、后续 design-hardening spec 和 `docs/current/*` 优先于 archived specs；archive 只作背景和证据。

## 每个 Slice 的必检问题

每个 slice spec 必须明确回答：

- DB schema：本 slice 是否引入 schema、migration 或 tables；如果不引入，为什么。
- 表关系：涉及哪些实体、relationship、cardinality、ownership、delete/update effect。
- 数据获取模式：TanStack Query、component state、filesystem scan、IPC request/response 的 owner 和 invalidation。
- 可复用组件：哪些是 reusable primitives，哪些是 feature-local；真实 consumer 和 invariant 是什么。
- 文件夹结构：用户文件、Reo metadata、rebuildable index、临时文件和恢复路径。
- 错误处理：用户可见错误、内部诊断、失败时保留的数据、retry/recovery 行为。

## Engineering Design Readiness Gate

实现前必须先完成 `engineering-readiness.md` 要求的设计包：

- requirements baseline
- product and interaction design
- architecture views
- data design
- protocol and boundary design
- state and lifecycle design
- foundation activation decisions
- QA and validation design
- implementation plan reconciliation

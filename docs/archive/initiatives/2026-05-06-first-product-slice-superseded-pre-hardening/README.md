# 第一产品切片旧长期任务

状态：已被当前 product-grade design-hardening 和 active initiative 取代

归档路径：`docs/archive/initiatives/2026-05-06-first-product-slice-superseded-pre-hardening/`

时间：2026-05-06 America/Los_Angeles

## 目标

记录早期 first product slice 方案。当前执行以 active initiative、当前 spec、`docs/current/*` 和源码事实为准。

## 当前状态

- 本目录只保留旧任务证据。
- 当前长期任务在 `docs/initiatives/2026-05-06-first-product-slice/`。
- 当前 design-hardening 归档在 `docs/archive/specs/2026-05-06-0912-first-product-slice-product-grade-design-hardening/`。

## 读取入口

- 设计 spec：`docs/archive/specs/2026-05-06-0100-first-product-slice/spec.md`
- archived implementation plan 背景证据：`docs/archive/specs/2026-05-06-0116-first-product-slice-plan/plan.md`。执行差异以后续 design-hardening 的 `implementation-plan-reconciliation.md` 为准。
- 工程 readiness 审查记录：`docs/archive/specs/2026-05-06-0223-first-product-slice-engineering-design/`
- 工程设计纪律审查记录：`docs/archive/specs/2026-05-06-0230-first-product-slice-design-discipline/`
- 工程执行前门禁 spec：`docs/archive/specs/2026-05-06-0338-first-product-slice-design-hardening/`
- 对齐实现计划 spec：`docs/archive/specs/2026-05-06-0452-first-product-slice-implementation-plan/`
- 工程执行前门禁规则：`docs/archive/initiatives/2026-05-06-first-product-slice/engineering-readiness.md`
- 收口 handoff：`docs/archive/initiatives/2026-05-06-first-product-slice/next-session-handoff.md`
- 长期决策：`docs/decisions/0003-local-memory-workspace.md`

## 完成条件

- 工程执行前设计基线完成并通过审查。
- Design-hardening reconciliation 后确定的 implementation slices 全部完成。
- 每个 slice 都有独立 spec、RED/GREEN/REFACTOR 证据、`docs/current/*` 更新、`npm run verify:quick` 和 commit。
- 每个 slice spec 都必须回答 DB schema、表关系、数据获取模式、可复用组件、文件夹结构和错误处理 review gates。
- Electron runtime 验证通过。
- workspace 磁盘文件验证通过。
- Codex CLI read-only 验证通过。
- `docs/current/*` 只保留稳定当前事实。
- initiative 归档到 `docs/archive/initiatives/2026-05-06-first-product-slice/`。

## 收口

此旧 initiative 已归档并更名为 superseded 证据目录，避免与当前 active initiative 同名。

# 第一产品切片长期任务

状态：活跃

时间：2026-05-06 America/Los_Angeles

## 目标

交付 Reo 第一个真实产品功能闭环：用户创建本地 memory workspace，录音，看到 live mock transcript，停止后得到可编辑 transcript 与 reflections，并能重新打开 recording 播放和编辑。Workspace 文件必须能被 Codex CLI 读取理解。

## 当前状态

- 产品设计已完成。
- 工程执行前设计基线已通过复审。
- 归档 implementation plan 只能作为背景，当前执行权威来自 design-hardening reconciliation 和后续 `$writing-plans` 产物。
- 实现尚未开始。

## 读取入口

- 设计 spec：`docs/archive/specs/2026-05-06-0100-first-product-slice/spec.md`
- archived implementation plan 背景证据：`docs/archive/specs/2026-05-06-0116-first-product-slice-plan/plan.md`。执行差异以后续 design-hardening 的 `implementation-plan-reconciliation.md` 为准。
- 工程 readiness 审查记录：`docs/archive/specs/2026-05-06-0223-first-product-slice-engineering-design/`
- 工程设计纪律审查记录：`docs/archive/specs/2026-05-06-0230-first-product-slice-design-discipline/`
- 工程执行前门禁 spec：`docs/specs/2026-05-06-0338-first-product-slice-design-hardening/`
- 工程执行前门禁规则：`docs/initiatives/2026-05-06-first-product-slice/engineering-readiness.md`
- 下一 session handoff：`docs/initiatives/2026-05-06-first-product-slice/next-session-handoff.md`
- 长期决策：`docs/decisions/0003-local-memory-workspace.md`

## 完成条件

- 工程执行前设计基线完成并通过审查。
- Design-hardening reconciliation 后确定的 implementation slices 全部完成。
- 每个 slice 都有独立 spec、RED/GREEN/REFACTOR 证据、`docs/current/*` 更新、`npm run verify:quick` 和 commit。
- 每个 slice spec 都必须回答 DB schema、表关系、数据获取模式、可复用组件、文件夹结构和错误处理 review gates。
- Electron runtime 验证通过。
- Workspace 磁盘文件验证通过。
- Codex CLI read-only 验证通过。
- `docs/current/*` 只保留稳定当前事实。
- initiative 归档到 `docs/archive/initiatives/2026-05-06-first-product-slice/`。

## 下一步

下一步使用 `$writing-plans` 产出对齐后的实现计划；该计划通过 `$plan-eng-review` 前不得进入实现。实现阶段必须按 `$executing-plans` 和 worktree 要求执行。

# First Product Slice Initiative

状态：active

时间：2026-05-06 America/Los_Angeles

## 目标

交付 Reo 第一个真实产品功能闭环：用户创建本地 memory workspace，录音，看到 live mock transcript，停止后得到可编辑 transcript 与 reflections，并能重新打开 recording 播放和编辑。Workspace 文件必须能被 Codex CLI 读取理解。

## 当前状态

- 产品设计已完成。
- Archived implementation plan 已归档，但待 design-hardening reconciliation；不是当前执行权威。
- 工程执行前设计基线未完成，当前阻断实现。
- 实现尚未开始。

## 读取入口

- 设计 spec：`docs/archive/specs/2026-05-06-0100-first-product-slice/spec.md`
- archived implementation plan 背景证据：`docs/archive/specs/2026-05-06-0116-first-product-slice-plan/plan.md`。执行差异以后续 design-hardening 的 `implementation-plan-reconciliation.md` 为准。
- 工程 readiness 审查记录：`docs/archive/specs/2026-05-06-0223-first-product-slice-engineering-design/`
- 工程设计纪律审查记录：`docs/archive/specs/2026-05-06-0230-first-product-slice-design-discipline/`
- 工程执行前门禁：`docs/initiatives/2026-05-06-first-product-slice/engineering-readiness.md`
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

新 session 先设定完整 first product slice 长任务 `$goal`，再创建当前 session spec 完成 design-hardening gate。该 gate 通过前不得执行 Slice 1；gate 通过后进入 `$writing-plans`、`$plan-eng-review` 和 `$executing-plans`。

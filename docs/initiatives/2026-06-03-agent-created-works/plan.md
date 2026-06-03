# Plan：Agent-created Works

本文件只记录跨 session 排序。单个工作单元的执行细节留在 `docs/specs/*`。

## 排序原则

- 从 Reo 产品模型出发：作品是 Memory-bound 或 Segment-bound 产物，不是通用 HTML 文件。
- 隔离预览能力必须跟真实 consumer 一起落地；首个 consumer 是静态作品。
- 创建和更新先保持 prompt-bridge：Reo 复制上下文，外部 agent 写文件。
- 先静态作品，后活 Widget；Widget 需要数据桥和性能预算，不能塞进首个切片。
- 一次只推进一个可验证 spec。

## Milestones

### M0 - 模型、skill 与 M1 实施 spec（已完成）

已归档 spec：`docs/archive/specs/2026-06-03-0630-agent-created-works-model/`

交付：

- 锁定作品 vs Widget 生命周期边界。
- 锁定用户可见命名与 durable 内部命名。
- 定义首个切片的创建、更新、渲染和安全边界。
- 草拟 Reo 管理的作品 skill 群。
- 将内部生成式 UI prompt / 模块 / 模板 / token / complexity budget 直接复制改写为 Reo-native skill 群；最终 skill 不暴露外部来源。
- 吸收沙箱 preview、`reo-artifact://`、文件识别、visual verification 与 TDD 安全边界计划。

完成门槛：后续可以直接执行 M1，不再重开产品命名、实体落点、prompt-bridge 语义或首个 runtime 深度。

### M1 - 静态作品与沙箱预览（已完成 first slice）

交付：

- `artifact` Segment 和 SegmentSupplement 文件合同，首个 `format: html`。
- main-owned recognition、manifest 收敛和 Memory Studio projection。
- 只读 `reo-artifact://` 协议候选与 sandboxed iframe 预览边界。
- FAB `作品` prompt-copy action，作用域为当前 Memory。
- 内容 tab rail `作品补充` prompt-copy action，作用域为 selected Segment。
- 已有作品的“让 Agent 更新作品” prompt-copy action。
- 最小作品 skill 群安装或更新到记忆空间。

完成门槛：用户能复制 prompt，让外部 agent 生成作品，回到 Reo 安全查看、全屏、删除/恢复，并再次通过 prompt-bridge 更新。

### M2 - Widget Runtime

交付：

- 独立 Widget 对象合同和 Workspace / Memory sibling placement。
- read-scoped host data bridge，优先 typed `postMessage`。
- 数据刷新模型和性能预算。
- Widget 生成 skill 与示例。

完成门槛：Widget 能随 Reo-owned 数据变化更新，同时不获得 Node、Electron、raw path、IPC 或 uncontrolled network 能力。

### M3+ - 完整形态联动

按需单独排期：Gallery 走马灯、Workspace-level widget、回顾 mechanics、复习日历等。它们归 roadmap 产品本质长期轨道，不绑进 M1。

## 收口

每个 spec 收口时：

- 长期事实压回 `docs/current/*`。
- 长期边界决策写入 `docs/decisions/*`。
- 任务证据移入 `docs/archive/specs/*`。
- 更新本 initiative `tasks.md` 状态与下一步。

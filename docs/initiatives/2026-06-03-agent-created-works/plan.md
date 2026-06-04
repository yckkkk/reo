# Plan：Agent-created Works 与 Shared Generative Runtime

本文件只记录跨 session 排序。单个工作单元的执行细节留在 `docs/specs/*`。

## 排序原则

- 从 Reo 产品模型出发：作品是 Memory-bound 或 Segment-bound 产物，不是通用 HTML 文件。
- 作品和未来组件共享 runtime 能力层；区别在挂载位置和生命周期，不在能力等级。
- Reo 是本地创作宿主，不是作品审查器；用户和用户 agent 承担作品内容、联网和 secret 使用风险。
- Runtime 默认放大用户创作自由；Reo 只守宿主边界和文件真源边界。
- 创建和更新优先保持 agent-native：Reo 复制上下文，外部 agent 写文件；M2 增加 runtime 内 agent prompt action。
- 一次只推进一个可验证 spec。

## Milestones

### M0 - 模型、skill 与 M1 实施 spec（已完成）

已归档 spec：`docs/archive/specs/2026-06-03-0630-agent-created-works-model/`

交付：

- 锁定作品用户可见命名与 durable 内部命名。
- 定义首个静态作品切片的创建、更新、渲染和边界。
- 草拟 Reo 管理的作品 skill 群。
- 将内部生成式 UI prompt / 模块 / 模板 / token / complexity budget 直接复制改写为 Reo-native skill 群；最终 skill 不暴露外部来源。
- 吸收沙箱 preview、`reo-artifact://`、文件识别、visual verification 与 TDD 安全边界计划。

完成门槛：后续可以直接执行 M1，不再重开产品命名、实体落点、prompt-bridge 语义。

### M1 - 静态作品与沙箱预览（已完成 first slice）

交付：

- `artifact` Segment 和 SegmentSupplement 文件合同，首个 `format: html`。
- main-owned recognition、manifest 收敛和 Memory Studio projection。
- 只读 `reo-artifact://` 协议候选与 sandboxed iframe 预览边界。
- FAB `作品` prompt-copy action，作用域为当前 Memory。
- 内容 tab rail `作品补充` prompt-copy action，作用域为 selected Segment。
- 已有作品的“让 Agent 更新作品” prompt-copy action。
- 最小作品 skill 群安装或更新到记忆空间。

完成门槛：用户能复制 prompt，让外部 agent 生成作品，回到 Reo 查看、全屏、删除/恢复，并再次通过 prompt-bridge 更新。

### M2 - Shared Generative Runtime（implementation closeout）

执行记录：`docs/archive/specs/2026-06-03-1205-shared-generative-runtime/`

交付：

- 每对象 runtime URL / origin 模型。
- Runtime bundle 四件套：`entry.html`、`runtime.json`、`state.json`、`assets/`。
- `window.reo` vendor bridge：state、workspace/content、mutations、secrets、ui、agent。
- 可见 JSON state 真源、browser storage 兼容缓存和 state conflict 模型。
- Runtime secret slots、底层 object+slot secret bridge 和不写入 bundle 的值存储。
- 普通 Web 网络和框架/CDN 支持，不做 Reo CORS proxy。
- agent creation skill、宽模板矩阵、scaffold/validate/inspect 脚本。
- 组件挂载点合同级预留。
- 三类验证样例：todo/复习表、普通 Web 状态工具、Reo 内容工具。

完成门槛：用户给一个想法，agent 能快速生成可运行、可交互、可持久化的作品；runtime 能证明 state、普通 Web 网络、bridge 和首批 product mutation 能力。

### M3+ - 组件挂载与完整形态联动

按需单独排期：

- Workspace/Home/Memory tab 等组件挂载 UI。
- Gallery 走马灯。
- Workspace-level runtime object。
- 回顾 mechanics、复习日历、跨 Memory 工具等。

它们复用 M2 Shared Generative Runtime，不重建一套能力层。

## 收口

每个 spec 收口时：

- 长期事实压回 `docs/current/*`。
- 长期边界决策写入 `docs/decisions/*`。
- 任务证据移入 `docs/archive/specs/*`。
- 更新本 initiative `tasks.md` 状态与下一步。

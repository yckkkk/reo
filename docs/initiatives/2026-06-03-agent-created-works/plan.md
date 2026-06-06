# Plan：Agent-created Works 与 Shared Generative Runtime

本文件只记录跨 session 排序。单个工作单元的执行细节留在 `docs/specs/*`。

## 排序原则

- 从 Reo 产品模型出发：作品是 Memory-bound 或 Segment-bound 产物，不是通用 HTML 文件。
- 作品和 widget 共享 runtime 能力层；区别在挂载位置和生命周期，不在能力等级。
- Reo 是本地创作宿主，不是作品审查器；用户和用户 agent 承担作品内容、联网以及作品内部值使用风险。
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

当前状态：M2 works consumer 已完成。真实环境 E2E 覆盖 workspace-wide runtime read、作品手动刷新和 state 写入不重挂 iframe；xhigh 审查与 `verify:quick` 已通过。

交付：

- 每对象 runtime URL / origin 模型。
- Runtime bundle 四件套：`entry.html`、`runtime.json`、`state.json`、`assets/`。
- `window.reo` vendor bridge：state、workspace/content、mutations、ui、agent。
- `workspace.read()` 返回全 workspace Memory summary，`content.readMemoryDetail({ memoryId })` 可按需读取同一 workspace 内任意 Memory detail，作品可构建记忆空间级数据面板。
- 可见 JSON state 真源、browser storage 兼容缓存和 state conflict 模型。
- `state.json` 写入不改变 host preview URL；作品 tab More 提供手动“刷新页面”。
- Reo 不提供作品 key、token 或 hidden value store；用户和 agent 在作品文件、浏览器存储或普通 Web 能力内自行处理这些取舍。
- 普通 Web 网络和框架/CDN 支持，不做 Reo CORS proxy。
- agent creation skill、宽模板矩阵、scaffold/validate/inspect 脚本。
- widget 挂载点合同级预留。
- 三类验证样例：todo/复习表、普通 Web 状态工具、Reo 内容工具。

完成门槛：用户给一个想法，agent 能快速生成可运行、可交互、可持久化的作品；runtime 能证明 state、普通 Web 网络、bridge、workspace-wide read、手动刷新和首批 product mutation 能力。

### M3 - Workspace Rail Widgets（已完成）

执行记录：`docs/archive/specs/2026-06-05-0515-workspace-rail-widgets/`

交付：

- Workspace-level widget 文件真源：`widgets/<widget-id--title>/widget.md`、`entry.html`、`runtime.json`、`state.json`、`assets/`。
- 右侧 rail 首个 widget 挂载点：单一 `新增` 菜单创建 Memory 或 Widget；rail 展开后投影记忆列表 tab 与 widget tabs，并和折叠按钮同排协作。
- Widget tab 支持 hover more 菜单、拖拽排序、重命名、删除/恢复、Finder/open/copy path、agent 更新 prompt 和刷新页面。
- Widget iframe 与记忆列表同属 rail 内容区；切换 tab 或关闭 rail 时卸载 iframe，长期状态只依赖 `state.json`。
- `reo-render://` runtime protocol 同时服务作品和 widget。
- `window.reo.ui.selectMemory({ memoryId })` 支持 widget 切换主内容当前 Memory。

完成门槛：Workspace-level widget 能通过外部 agent 文件写入进入 Reo rail，和记忆列表并列展开、切换、排序、更新、删除/恢复，并通过 `verify:quick`。

### M4+ - Widget 完整形态联动

M3 收口验证完成后再按需单独排期：

- Home/Memory tab 等 widget 挂载 UI。
- Gallery 走马灯。
- 回顾 mechanics、复习日历、跨 Memory 工具等。

它们复用 Shared Generative Runtime，不重建一套能力层。

## 收口

每个 spec 收口时：

- 长期事实压回 `docs/current/*`。
- 长期边界决策写入 `docs/decisions/*`。
- 任务证据移入 `docs/archive/specs/*`。
- 更新本 initiative `tasks.md` 状态与下一步。

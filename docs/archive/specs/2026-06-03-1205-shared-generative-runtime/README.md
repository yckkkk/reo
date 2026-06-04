# M2 Shared Generative Runtime

创建：2026-06-03 12:05 America/Los_Angeles
状态：archived implementation record

## Objective

M2 不再定义为只读 Widget Runtime，也不再把作品能力按安全等级逐步放开。

M2 的目标是建立 **Shared Generative Runtime**：一套用户拥有的本地 Web runtime object 能力层。作品是第一个 consumer；未来组件复用同一 runtime 合同，只在挂载位置和生命周期上与作品区分。

## Product Model

Reo 不审查用户自己创造的作品。作品和组件运行时默认按用户拥有的小型 Web app 处理：

- 默认支持 HTML、CSS、JavaScript、前端框架、CDN 库和普通 Web 网络。
- 默认支持每个 runtime object 独立 origin，用于 localStorage、IndexedDB 和浏览器缓存隔离。
- 默认支持可见 `state.json` 作为用户和 agent 可查看、可修改、可迁移的长期状态真源。
- 默认支持 Reo typed bridge：状态、Reo 数据、当前对象受限产品 mutation、secret、UI、agent prompt action。
- 默认支持 runtime 读取自身已声明 secret slot 的值；secret 描述在 `runtime.json` 中可见，值不写入 runtime bundle。
- Reo runtime 不弹权限确认，不做联网风险提示，不做内容质量审查。

Reo 只守宿主边界：用户 HTML 不进入 Reo renderer 同源执行，不获得 Node/Electron/raw path，不绕过 Reo 现有产品 mutation 的事务、baseline 和恢复模型。

Reo managed skills 只记录文件合同和 `window.reo` API 形状，不承担风险教育、审批或内容审核。

## Object Boundary

能力不区分作品和组件。对象位置和生命周期区分作品和组件。

- 作品：Segment 或 SegmentSupplement 层级的 runtime object。
- 组件：未来 Workspace/Home/Memory tab 等挂载点上的 runtime object。
- 二者共用 bundle、runtime URL、bridge、state、secret、template 和 validation 合同。

M2 首个落地 consumer 是作品。组件只做合同级预留，不实现组件挂载 UI。

## Bundle Contract

M2 runtime bundle 使用清晰四件套：

```text
entry.html
runtime.json
state.json
assets/
```

`entry.html` 是运行入口。用户或 agent 可以自由写 HTML、框架 bundle、CDN script、inline script 和样式。

`runtime.json` 是描述 + 启动文件，不是权限审批文件。它记录：

- runtime object 标题、版本、入口和显示意图。
- 使用的 template family。
- state schema version 和命名 stores。
- secret slots 的 id、label、用途和提示。
- Reo bridge API 需求。
- agent prompt actions 的建议入口。

`state.json` 是长期状态真源，必须是 JSON object。命名 stores 是推荐组织方式，不是 Reo 投影或 runtime state API 的硬性形状，例如：

```json
{
  "schemaVersion": 1,
  "stores": {
    "ui": {},
    "data": {},
    "progress": {},
    "draft": {}
  }
}
```

localStorage、IndexedDB 和浏览器缓存允许使用，但只作为 Web app 兼容缓存；长期可见状态仍推荐写入 `state.json`。用户或 agent 可以把 `state.json` 替换为任意 JSON object；Reo 只用 version/baseline 防止运行中写入覆盖外部修改。

`assets/` 保存本地资源。用户本机文件必须复制进 bundle 才能被作品引用；不直接使用 `file://` 作为 runtime 资源合同。

## Runtime URL

M2 引入新的每对象 runtime URL 模型，替代 M1 的共享 host 静态预览 URL。

目标：

- 每个作品或组件实例有独立 Web origin。
- localStorage、IndexedDB、cache 和 cookie-like browser storage 不跨对象串联。
- iframe bridge 能把调用绑定到当前 runtime object identity。
- M1 旧合同不保留兼容层；产品未发布，旧作品由 agent 按新合同迁移或修复。

## Host Container

Runtime 继续使用 iframe 嵌入 Reo，不使用主 renderer 直接挂载用户 HTML。

默认容器能力：

- 允许 scripts 和 same-origin，以支持完整 Web app、浏览器存储和框架 runtime。
- 允许正常网页表单和下载；iframe popup/window-open 默认拒绝。
- 网络按普通浏览器模型处理；M2 不提供 Reo fetch proxy，不绕过 CORS。
- Web-safe 网络/资源协议可用；`file:` 资源必须进入 bundle。

## Bridge API

HTML 通过显式 vendor script 获得 `window.reo`。Reo 不自动改写用户 HTML。

推荐顶层分类：

- `window.reo.state`：读写 `state.json` 命名 stores，带 version/baseline。
- `window.reo.workspace`：读取当前 workspace、Memory、Segment 上下文投影。
- `window.reo.content`：读取 Reo 内容投影，例如 note 正文、audio transcript、artifact metadata。
- `window.reo.mutations`：调用 Reo typed 产品 mutation，复用现有事务、baseline、stale conflict 和恢复模型。
- `window.reo.secrets`：读取、写入或清除当前 object + slot 绑定的 secret 值；Reo 不提供权限审批或产品层 key/token 管理 UI。
- `window.reo.ui`：全屏、尺寸、主题等宿主 UI 协调能力。
- `window.reo.agent`：复制或发起给用户 agent 的 prompt action。

`window.reo.agent` 的最终 prompt 由 Reo 生成骨架：作品只请求 documented action；Reo 使用可信对象身份、相对路径、skill 入口和文件合同拼出 prompt，不接受作品传入的意图、状态片段或建议文件作为 prompt 上下文。

首批 mutation 只覆盖高频产品动作和 runtime 自身能力：更新 runtime state、创建/更新作品与作品补充、更新当前作品标题、发起 agent prompt。Artifact works 不通过 `window.reo` 直接写任意 note 正文；更广的 Reo 内容修改交给 agent prompt 和普通 Reo 文件合同。删除、移动、批量破坏性动作不作为首批目标。

## Agent Creation

M2 的核心成功标准之一是用户 agent 能快速创作，不被 Reo 概念拖住。

Skill 设计：

- 新增共享 generative runtime skill；作品 skill 和未来组件 skill 都复用它。
- AGENTS.md 托管块指向 runtime skill、works skill 和 scaffold/validate 脚本。
- 用户不点击 Reo、不复制 prompt、只手打给 agent 时，agent 仍能从 AGENTS.md 和 skills 进入正确流程。
- prompt 使用任务包：目标对象相对路径、当前 Memory/Segment 摘要、可用 runtime API、模板选择指引和下一步文件清单。

模板策略：

- 使用宽模板矩阵，不把模板当边界。
- 至少覆盖报告、解释器、仪表盘、编辑器、复习表、待办、游戏、画廊、地图、原型和数据工具。
- 每类模板都是可直接运行和改写的成品 bundle。
- 用户可以完全自由描述自己的想法，agent 不被模板限制。
- agent 在目标不清楚时可以继续追问；问题必须目标驱动，不能空转阻塞创作。

脚本策略：

- scaffold 脚本生成合法 runtime bundle 骨架。
- validate 脚本只检查能否运行：文件合同、入口、runtime.json、state.json、资源引用、bridge 调用形状和基本大小。
- validate 不审查内容质量、联网风险或审美。

## External Edit

用户和 agent 可以直接查看、修改、替换 runtime bundle。

Reo 采用 fail-open 诊断：

- 尽量加载可运行部分。
- 合同缺失、state 损坏、bridge 不兼容或入口缺失时显示轻量故障面。
- 故障面提供复制诊断和让 agent 修复的 prompt。
- Reo 不自动覆盖用户文件。

`state.json` 写入使用 version/baseline。外部 agent 和运行中的作品同时修改 state 时，runtime 收到 stale 后重读，由作品逻辑决定合并或覆盖。

## Secrets

Runtime secret 分为描述和值：

- 描述在 `runtime.json` 的 secret slots 中，用户和 agent 可查看修改。
- 值绑定 runtime object id + slot id，由底层 bridge 读写或清除，不写入 runtime bundle。
- 已保存的 secret 值可由当前 runtime 静默读取到内存使用。
- Reo 不把 secret 明文写入 runtime bundle 或 userData 明文 JSON。
- 用户和用户 agent 决定 slot 如何使用；Reo 产品层不提供对象 More key/token 管理 UI。

## Network

M2 默认开放普通网页网络能力。作品可以使用远程资源、CDN、HTTPS/HTTP/WebSocket 等 Web-safe 能力。Reo 不做联网确认或联网风险弹窗。

M2 不提供 CORS proxy。第三方 API 是否可被浏览器直接调用，取决于该 API 的 CORS 策略。Skill 只记录这条浏览器技术边界，不做风险提醒。

## Validation Examples

M2 验收至少使用三类作品：

1. Todo / 复习表：证明用户交互状态、`state.json`、localStorage/IndexedDB 兼容缓存和外部 agent 修改状态。
2. 普通 Web 状态工具：证明普通 Web 网络、CDN/framework、可见 runtime state 和 runtime 错误恢复。
3. Reo 内容工具：证明 `window.reo` 读取当前 workspace 内容投影，并通过 state、当前作品标题 mutation 或 agent prompt action 完成受控写入入口。

## Non-Goals

- 不实现组件挂载 UI。
- 不提供 Reo fetch proxy 或 CORS bypass。
- 不暴露 Node、Electron、raw path 或 generic filesystem bridge。
- 不做权限弹窗、联网风险确认或内容审查。
- 不把 runtime 变成 Reo 内嵌 AI 自动整理系统。
- 不保留 M1 静态预览兼容层。

## Done When

- Active initiative 已改写为 Shared Generative Runtime 路线。
- Spec 明确作品/组件共用能力层，区别只在挂载位置和生命周期。
- Spec 明确 user-owned runtime 风险模型：风险交给用户和 agent；Reo 只守宿主边界。
- Spec 明确 bundle、URL、bridge、state、secret、network、agent skill、验证样例。
- 后续可进入 plan-eng-review 和实现计划，不再把 M2 降级为只读 Widget Runtime。

# Agent-created Works：作品与 Widget 轨道

创建：2026-06-03 America/Los_Angeles
状态：active（产品/代码开发 initiative）

## 定位

Reo 新增一种由外部 agent 创建的内容形态：**作品**。

作品不是文件格式，用户界面不叫 `html`。`html` 只是首个渲染格式；长期产品类型是 `artifact`，首个格式是 `html`。

作品有两个落点：

- **作品片段**：agent 创建的 Segment，落在当前 Memory。
- **作品补充**：agent 创建的 SegmentSupplement，落在当前选中 Segment。

这个设计保留 Reo 现有 Memory -> Segment -> SegmentSupplement 信息架构，同时给外部 agent 一个比笔记和录音更丰富的可视化表达面。

## 生命周期边界

Reo 按生命周期区分 **作品** 和 **Widget / 小应用**，不按实现技术区分。

- 作品是一次阶段性产物：报告、复盘页、教学反馈、旅行记录、学习卡片、原型、仪表盘快照、创意页面，或者一个能在自身 DOM 内局部交互的静态页面。
- Widget / 小应用是长期运行的活工具：读取当前 Workspace / Memory 数据，随数据变化更新，或拥有稳定工具角色。

两者以后可以共享 iframe 渲染边界，但它们不是同一个产品实体。一个间隔记忆复习表如果只是某次生成的快照，是作品；如果持续读取复习状态并自动变化，是 Widget。

## 首个工作单元

首个实现切片是 **静态沙箱作品**：

- FAB 增加 `作品` action，作用域是当前 Memory。
- 内容 tab rail 的补充菜单增加 `作品补充`。
- 点击入口只复制 prompt 给用户的外部 agent，不在 Reo 内新建空对象。
- 外部 agent 读取 Reo 管理的生成 skill，先澄清目标或提出三个方向，再生成或更新作品文件。
- Reo 识别合法 `artifact` Segment / SegmentSupplement，首个 `format` 为 `html`。
- Reo 在只读隔离预览面中渲染 HTML，并支持和当前内容编辑面类似的全屏查看。

首个切片不引入 Reo 数据 API、host RPC、网络出口、持久化应用状态或内嵌 AI 运行时。

## 安全不变量

- 用户或 agent 生成的 HTML 是不可信资源；renderer 不直接执行、注入或同源渲染它。
- 渲染统一走隔离预览边界：`<iframe sandbox="allow-scripts">`，不带 `allow-same-origin`，形成 opaque origin。
- 内容与同目录资产由 main 注册的只读自定义协议提供；协议名在实现 spec 中以 `reo-artifact://` 为首选。
- 协议 handler 统一下发 CSP，默认无网络，`connect-src 'none'`。
- 产物不能触达 Node、Electron、IPC、文件系统或 raw path。
- Widget 阶段如需数据，只能引入窄、只读、typed `postMessage` 数据桥。

边界细节最终以 `docs/current/electron.md`、ADR 0002 和 ADR 0006 为准。

## 完成条件

本 initiative 完成时：

- 作品 Segment 和作品 SegmentSupplement 具备 durable 文件合同、识别路径、删除/恢复路径和 Memory Studio 投影。
- HTML 预览边界符合 Reo Electron 安全基线。
- 作品和作品补充的创建、更新都走 prompt-bridge。
- Reo 管理的作品 skill 群可被外部 agent 读取，并能生成有用的作品。
- skill 群内部直接包含复制改写后的 prompt、模板、token 与设计规则；最终交付给用户 agent 的 skill 不暴露外部来源，也不要求 agent 去参考外部项目。
- Widget runtime 独立落地为 Workspace / Memory sibling，不被混进 Segment 子类。
- 长期事实压缩回 `docs/current/*`，长期边界决策写入 `docs/decisions/*`。

完成、取消或失效后移入 `docs/archive/initiatives/2026-06-03-agent-created-works/`。

## 非目标

- 不在本轨道内做 Reo 内嵌 AI、自动整理或自动生成。
- 不让作品获得网络、Node、文件系统、IPC 或 raw path 能力。
- 不在静态作品阶段引入活数据桥。
- 不把性能/轻量做成 runtime 门禁；轻量是生成 skill 的指引。
- 不为了未来可能性提前建无 consumer 的通用 runtime 抽象。
- 不使用用户可见的 `html` 类型名。

## 关联

- 已归档 spec：`docs/archive/specs/2026-06-03-0630-agent-created-works-model/`
- ADR 0006：`docs/decisions/0006-agent-native-carrier-and-generative-ui.md`
- ADR 0002：`docs/decisions/0002-electron-build-and-security-baseline.md`
- ADR 0003：`docs/decisions/0003-local-memory-workspace.md`
- 当前真源：`docs/current/product.md`、`data.md`、`flow.md`、`electron.md`、`frontend.md`、`roadmap.md`

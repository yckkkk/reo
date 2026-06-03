# Agent-created Works 与 Shared Generative Runtime

创建：2026-06-03 America/Los_Angeles
状态：active（产品/代码开发 initiative）

## 定位

Reo 新增一种由外部 agent 创建的内容形态：**作品**。

作品不是文件格式，用户界面不叫 `html`。`html` 只是首个入口技术；长期产品对象是 `artifact`，运行能力由 Shared Generative Runtime 承载。

作品有两个落点：

- **作品片段**：agent 创建的 Segment，落在当前 Memory。
- **作品补充**：agent 创建的 SegmentSupplement，落在当前选中 Segment。

这个设计保留 Reo 现有 Memory -> Segment -> SegmentSupplement 信息架构，同时让外部 agent 能生成报告、工具、仪表盘、复习表、待办、游戏、原型、可视化和其它用户自由想象的小型 Web app。

## Runtime 模型

M2 以后，Reo 使用 **Shared Generative Runtime**：

- 作品和未来组件共用同一 runtime object / bundle / bridge / state / secret / template 合同。
- 作品和组件不按能力分层；区别只在挂载位置和生命周期。
- 作品位于 Segment 或 SegmentSupplement。
- 组件未来位于 Home、Workspace side tab、Memory panel/tab 等挂载点。

Reo 是本地创作宿主，不是作品审查器。用户和用户 agent 创造的 runtime object 默认是用户拥有的小型 Web app。

默认能力：

- HTML、CSS、JavaScript、前端框架和 CDN。
- 普通 Web 网络和 Web-safe 资源。
- 每个 runtime object 独立 origin，支持 localStorage、IndexedDB 和浏览器缓存隔离。
- 可见 `state.json` 作为长期状态真源。
- `runtime.json` 描述启动、状态 schema、secret slots、Reo API 需求和 agent actions。
- `window.reo` typed bridge，覆盖 state、workspace/content、product mutations、secrets、ui 和 agent prompt actions。

Reo runtime 不做联网确认、权限弹窗、内容审查或质量审核。风险教育写入托管 skills，由用户 agent 在设计阶段简短提醒。

Reo 只守宿主边界：用户 HTML 不进入 Reo renderer 同源执行，不获得 Node、Electron、raw path 或 generic filesystem bridge；写 Reo 真实数据必须走 Reo typed product mutation，并复用现有事务、baseline、stale conflict 和恢复模型。

## 首个工作单元

首个实现切片已完成 **静态沙箱作品**：

- FAB 增加 `作品` action，作用域是当前 Memory。
- 内容 tab rail 的补充菜单增加 `作品补充`。
- 点击入口只复制 prompt 给用户的外部 agent，不在 Reo 内新建空对象。
- Reo 识别合法 `artifact` Segment / SegmentSupplement，首个 `format` 为 `html`。
- Reo 在只读隔离预览面中渲染 HTML，并支持和当前内容编辑面类似的全屏查看。

下一工作单元是 **M2 Shared Generative Runtime**：

- 用每对象 runtime URL / origin 替代 M1 共享 host 静态预览模型。
- 引入 bundle 四件套：`entry.html`、`runtime.json`、`state.json`、`assets/`。
- 引入显式 vendor script 和 `window.reo` bridge。
- 支持 runtime state、browser storage、network、secret、agent prompt action 和首批高频 product mutations。
- 强化 AGENTS.md 与 skills，让用户不点击 Reo、不复制 prompt 时，agent 也能从记忆空间内快速创建作品。
- 组件只做合同级预留，不实现组件挂载 UI。

## 完成条件

本 initiative 完成时：

- 作品 Segment 和作品 SegmentSupplement 具备 durable 文件合同、识别路径、删除/恢复路径和 Memory Studio 投影。
- Shared Generative Runtime 具备每对象 origin、bundle、bridge、state、secret、network 和 agent action 基础能力。
- 用户 agent 能通过 Reo prompt、AGENTS.md、skills、templates 和 scripts 快速创建可运行作品。
- 作品和未来组件共用 runtime 能力层，组件挂载点有合同级设计。
- Reo 管理的 skill 群直接包含 prompt、模板、token、脚本和设计规则；最终交付给用户 agent 的 skill 不要求 agent 去参考外部项目。
- 长期事实压缩回 `docs/current/*`，长期边界决策写入 `docs/decisions/*`。

完成、取消或失效后移入 `docs/archive/initiatives/2026-06-03-agent-created-works/`。

## 非目标

- 不在本轨道内做 Reo 内嵌 AI、自动整理或自动生成。
- 不让 runtime 获得 Node、Electron、raw path 或 generic filesystem bridge。
- 不做联网确认、权限弹窗、内容审查或作品质量审核。
- 不把性能/轻量做成 runtime 门禁；轻量和风险提醒是生成 skill 的指引。
- 不为了未来可能性提前建无 consumer 的通用平台；M2 首个 consumer 是作品。
- 不使用用户可见的 `html` 类型名。

## 关联

- 当前 spec：`docs/specs/2026-06-03-1205-shared-generative-runtime/`
- 已归档 spec：`docs/archive/specs/2026-06-03-0630-agent-created-works-model/`
- ADR 0006：`docs/decisions/0006-agent-native-carrier-and-generative-ui.md`
- ADR 0002：`docs/decisions/0002-electron-build-and-security-baseline.md`
- ADR 0003：`docs/decisions/0003-local-memory-workspace.md`
- 当前真源：`docs/current/product.md`、`data.md`、`flow.md`、`electron.md`、`frontend.md`、`roadmap.md`

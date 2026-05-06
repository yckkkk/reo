# Research

## 正规软件工程流程

本次采用的流程基线来自官方或一手资料：

- IEEE/ISO/IEC 29148：requirements engineering 需要覆盖需求过程、需求产物、良好需求构造、需求属性、需求特征，以及生命周期内迭代应用。
- IEEE Computer Society SWEBOK V4：软件工程一般接受的知识体系覆盖 requirements、design、construction、testing、architecture、operations、security 等知识域。
- CMU SEI Views and Beyond：architecture documentation 应按 view 组织，并服务 implementers、testers、quality specialists、security analysts 等 stakeholder。

对 Reo 的直接含义：

- 不能只写功能顺序；必须有 requirements baseline 和验收度量。
- 不能只写目录；必须有 architecture views、runtime boundary、interface behavior 和跨 view 映射。
- 不能只写测试命令；必须有测试层级、操作验证路径、风险矩阵和回归边界。

## 官方技术资料结论

### Electron

Electron 官方 security 和 context isolation 文档强调：

- Renderer 不应直接暴露 Node/Electron 能力。
- Preload 通过 `contextBridge` 暴露受控 API。
- 不应把 `ipcRenderer` 或 generic send/invoke 暴露给 renderer。
- IPC 必须验证 sender。

对 Reo 的直接含义：

- preload/IPC 是 first product slice 的真实基础，因为 workspace folder、文件写入、audio artifact 都需要 main process 特权能力。
- 但必须是显式 channel，不是通用 bridge。

### TanStack Query

Context7 查询 TanStack Query 官方资料后确认：

- Main-backed async data 属于 server state。
- Query key 必须稳定。
- Mutation 必须定义 pending/error state、invalidation；如果使用 optimistic update，必须定义 snapshot 和 rollback。

对 Reo 的直接含义：

- Workspace list、workspace detail、recording detail 一旦通过 main IPC 读取，就构成 TanStack Query 的真实 consumer。
- Recording overlay 内部正在录音的本地状态不属于 TanStack Query。

### shadcn/ui

Context7 查询 shadcn/ui 官方资料后确认：

- shadcn/ui 是 copy-owned component source，不是黑盒视觉库。
- Vite React 项目需要 `components.json`、alias、Tailwind CSS 路径和本地 component source。
- Radix primitive 适合承载 dialog、tooltip、textarea/button 这类 accessibility 需求。

对 Reo 的直接含义：

- Workspace creation dialog、recording overlay、tooltip、button、textarea 已经构成真实 UI primitive consumer。
- 引入时必须 retokenize 为 Reo design system，不保留默认视觉。

### Drizzle / Better Auth / Packaging / Sentry

- Drizzle 官方 migration 文档要求 SQL schema upfront，并通过 migrations 管理 schema 变化。
- Better Auth Electron 官方文档要求已有 Better Auth server/client，并通过 system browser/custom protocol/storage 组成完整 auth flow。
- Electron packaging 官方文档把 Forge 作为 packaging/distribution 工具，但 package/make 是分发阶段能力。
- Sentry Electron 官方文档要求 main 和 renderer 初始化，并涉及 DSN、features、logs、source maps、privacy 等配置。

对 Reo 的直接含义：

- DB conceptual model 必须先设计，但 Drizzle 物理 schema 不应在没有真实查询、索引或恢复压力前建立。
- Auth、packaging、updater、Sentry/logging 都需要 foundation decision，但不是本地 recording-first 闭环的前置实现。

## Reference Assets

本 feature 的视觉/交互参考必须保留在 verification gate 中：

- `/Users/yck/Downloads/PM/设计参考/记忆录音/`
- `/private/tmp/reo-reference-frames/`

参考只约束结构、层级、micro-interactions 和操作感。最终视觉服从 Reo design system。

## Sources

- IEEE/ISO/IEC 29148-2018: https://standards.ieee.org/standard/29148-2018.html
- IEEE SWEBOK V4: https://www.computer.org/education/bodies-of-knowledge/software-engineering
- CMU SEI Views and Beyond: https://www.sei.cmu.edu/library/views-and-beyond-collection/
- Electron Security: https://www.electronjs.org/docs/latest/tutorial/security
- Electron Context Isolation: https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Electron Packaging: https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging
- Better Auth Electron: https://better-auth.com/docs/integrations/electron
- Better Auth Database: https://www.better-auth.com/docs/concepts/database
- Drizzle Migrations: https://orm.drizzle.team/docs/migrations
- Sentry Electron: https://docs.sentry.io/platforms/javascript/guides/electron/

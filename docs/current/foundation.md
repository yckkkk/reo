# 基础原则

Reo 是未发布的 Electron 产品。当前目标是建立干净、稳定、可维护的基础。

## 原则

- 最高设计约束是第一性原理和奥卡姆剃刀：先确认目标、实体、约束和不变量，再选择能完整表达当前行为的最少规则。
- 不能在错误模型上堆积逻辑。发现模型错误时，先改回正确模型，再删除由旧模型产生的分支、状态和文案。
- 简化不是删功能。必要的产品能力、安全边界、数据真源、验证路径和用户可见恢复必须保留，并用更少、更清楚的结构表达。
- 优先官方文档、框架约定和成熟包。
- 设计新功能或使用技术栈能力前，必须先通过 Context7 查询对应官方当前文档；Context7 无覆盖时再使用官方站点、源码或包内文档，并记录采用依据。
- 不重复实现已被技术栈解决的能力。
- 所有工程设计先做 official/open-source reuse evaluation，再决定复用、适配、fork 或自研。
- 代码和文档保持小、扁平、显式。
- 精简服务于交接、收口和验证；能降低误判风险的规则保留在当前真源。
- 删除无当前用途的实现、文档、目录或接口。
- 不保留兼容层。
- 优先直接使用框架和包，不发明 wrapper、generic runtime 或抽象平台。
- Electron 是一等产品宿主，不是薄 shell。

## 技术路线

以下是已确认技术路线，不代表当前全部已安装、已配置或已被当前 slice 激活：

- React 19 + TypeScript
- Vite through `electron-vite`
- Tailwind CSS v4
- shadcn/ui + Radix primitives
- Zustand + TanStack Query
- React Hook Form + Zod
- Better Auth with Electron support
- Drizzle ORM + `better-sqlite3`
- `electron-updater`
- `date-fns`
- Sentry + `electron-log`
- Electron Forge
- Vitest

## 实施规则

只在实现对应 foundation slice 时安装或配置相关包。不得加入空闲依赖、占位目录或未来架构壳。

技术路线不是激活许可。任何 package、provider、schema、IPC、component source、store、query client、auth、DB、logging、packaging 或 updater 能力，都必须先有当前 feature 的 exact consumer、capability contract、测试路径和 `docs/current/*` 更新。

自研不是默认选项。前端组件、UI primitives、page/overlay primitives、overlay/drawer、audio/media、editor、main process capability、IPC/preload typing、filesystem transaction、file watching、schema validation、state machine、form/schema、data fetching、DB/migration、testing/QA、logging/observability、packaging/updater 都必须先评估官方方案和成熟开源包。发现现成方案不完全适配 Reo 时，先思考如何裁剪、retokenize、组合、包一层薄适配或 fork；只有这些方式仍不能满足 Electron 安全边界、Reo 本地文件真源、Reo design system、测试可控性或代码复杂度预算时，才允许自研，并必须记录已尝试的适配路径和拒绝原因。

## 文档与注释规则

- 默认文档与代码注释只写当前事实、当前规则和当前决策。
- 不写“旧、继承、废弃、过去来源、为什么从过去变成现在”这类解释。
- 无当前用途的内容直接删除，不写废弃标记。
- 需要解释设计原因时，只写当前约束、当前目标和当前 tradeoff。

## 产品方向

Reo 面向本地优先的 AI-ready memory workspace。Memory workspace 是用户选择的本地文件夹，用于保存一个用户定义的记忆主题，例如一本书的笔记、一门课、一次生活经历、一个生日派对、一个项目或零碎灵感。

Reo 的第一阶段产品主线是让用户更愿意表达，并把表达沉淀成可移动、可重温、AI-readable 的 memory。产品基线见 `product.md`，路线图见 `roadmap.md`。

Workspace 文件夹是真实产物源。用户记忆内容以普通文件保存，供用户、文件系统工具、Codex CLI 和未来 Reo 内置 AI 直接读取。DB 可以作为索引、关系、查询和处理状态层，但不替代 workspace 文件夹作为用户记忆内容真源。

每个 workspace root 使用 `AGENTS.md` 作为 AI 协作入口，Reo 自己的 workspace metadata 位于 `.reo/workspace.json`。长期决策见 `docs/decisions/0003-local-memory-workspace.md`。

## Agent 行为

- 当歧义会影响架构、数据、UX、验证或工作量时，先问或先声明假设。
- 当目标明确时，直接推进到可验证结果。
- 可以主动挑战需求，但必须给出更低成本、更少复杂度的替代方案。
- 使用对抗性审查暴露风险，但最终决策必须回到 Reo 目标、源码事实和官方指导。
- 不盲目同意；用户说错时也要礼貌指出。

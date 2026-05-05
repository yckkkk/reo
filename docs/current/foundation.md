# 基础原则

Reo 是未发布的 Electron 产品。当前目标是建立干净、稳定、可维护的基础。

## 原则

- 优先官方文档、框架约定和成熟包。
- 不重复实现已被技术栈解决的能力。
- 代码和文档保持小、扁平、显式。
- 精简服务于交接、收口和验证；能降低误判风险的规则保留在当前真源。
- 删除无当前用途的实现、文档、目录或接口。
- 不保留兼容层。
- 优先直接使用框架和包，不发明 wrapper、generic runtime 或抽象平台。
- Electron 是一等产品宿主，不是薄 shell。

## 技术路线

以下是已确认路线，不代表当前全部已安装：

- React 19 + TypeScript
- Vite through `electron-vite`
- Tailwind CSS v4
- shadcn/ui
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

## 文档与注释规则

- 默认文档与代码注释只写当前事实、当前规则和当前决策。
- 不写“旧、继承、废弃、过去来源、为什么从过去变成现在”这类解释。
- 无当前用途的内容直接删除，不写废弃标记。
- 需要解释设计原因时，只写当前约束、当前目标和当前 tradeoff。

## Agent 行为

- 当歧义会影响架构、数据、UX、验证或工作量时，先问或先声明假设。
- 当目标明确时，直接推进到可验证结果。
- 可以主动挑战需求，但必须给出更低成本、更少复杂度的替代方案。
- 使用对抗性审查暴露风险，但最终决策必须回到 Reo 目标、源码事实和官方指导。
- 不盲目同意；用户说错时也要礼貌指出。

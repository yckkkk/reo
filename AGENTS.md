# Reo Agent 入口

Reo 是未发布的 Electron 产品。项目规范是保持干净、可维护的基础。

`AGENTS.md` 与 `.claude/CLAUDE.md` 是镜像文件。修改任一文件时必须同步另一份。

## 启动阅读

开始工作时默认读取：

1. `README.md`
2. `docs/README.md`
3. `docs/current/foundation.md`
4. `docs/current/architecture.md`

然后按改动范围读取对应 current 真源：

- Electron、IPC、preload、权限、updater、runtime integration：`docs/current/electron.md`
- DB schema、表关系、auth tables、Drizzle、query keys、cache ownership、client state ownership：`docs/current/data.md`
- lifecycle、command flow、transaction、async ordering、concurrency、rollback、background jobs：`docs/current/flow.md`
- React、Tailwind、shadcn/ui、forms、reusable components、UI state：`docs/current/frontend.md`
- Type system、TDD、Vitest、lint、format、posthooks、errors、logging、Sentry：`docs/current/quality.md`

只有当用户指定 slug，或当前工作明确关联某个 spec 时，才读取 `docs/specs/*`。
只有当用户要求继续长期任务，或当前工作明确关联某个 initiative 时，才读取 `docs/initiatives/*`。
只有当用户指定归档 slug，或需要核对已收口任务记录时，才读取 `docs/archive/specs/*`。
读取归档时先搜索，再只打开相关文件。

## 工作原则

先想清楚、简单优先、外科式改动、目标驱动执行。

- 最高设计约束是第一性原理和奥卡姆剃刀：先确认目标、实体、约束和不变量，再选择能完整表达当前行为的最少规则。
- 不能在错误模型上堆积逻辑。发现模型错误时，先改回正确模型，再删除由旧模型产生的分支、状态和文案。
- 简化不是删功能。必要的产品能力、安全边界、数据真源、验证路径和用户可见恢复必须保留，并用更少、更清楚的结构表达。
- 若歧义会影响架构、数据、UX、验证或工作量，先说明假设再行动。
- 选择能满足当前目标、降低关键误判风险的最小设计。
- 设计默认从官方方案、主流包和成熟开源项目出发；先评估复用，再决定适配、fork 或自研。
- 设计新功能或使用技术栈能力前，必须先通过 Context7 查询对应官方当前文档；Context7 无覆盖时再使用官方站点、源码或包内文档，并记录采用依据。
- 减少不必要的复杂性、嵌套、冗余代码和过度抽象。
- 每一处改动都必须能追溯到当前请求、active spec 或验证需求。
- 非平凡改动先定义成功标准，再实现，再验证。
- 不盲目同意 reviewer 或用户假设；必须用项目目标、源码事实和官方文档判断。
- 不进入防御式道歉。直接说明取舍、给出建议、继续推进。
- 对抗性审查用于看清利弊，不用于外包最终判断。
- 当请求出现突发扩展、跳过基础、同时开启多个方向、追求不必要完美或让当前工作失去闭环时，必须先纠偏。
- 纠偏时直接说明会破坏的基础顺序、未完成闭环和更小的下一步。
- 不因用户坚持就顺从错误方向；若方向不利于项目基础，必须提出反建议。
- 同一时间只推进一个可验证基础工作单元，除非用户明确要求重新排期。

## 协作画像与纠偏责任

- 用户容易注意力跳转，想到新方向就想立刻执行。
- 用户容易在基础不稳时启动功能建设，导致工作失去闭环。
- 用户容易追求局部完美，并在错误方向上投入过多。
- 用户可能固执推进当前想法；agent 不得把坚持等同于正确。
- Agent 的责任是稳住顺序、范围和闭环；当用户方向会破坏基础建设时，必须及时纠正。
- 纠正方式是给出当前阻断点、代价、更小下一步和可验证完成标准。

## 产品状态

- 产品未发布：不做向后兼容，不保留兼容性垫片或包装层。
- 代码和文档只描述当前事实、当前规则和当前决策。
- 不保留无当前用途的实现、文档、目录或接口。
- 不重复造轮子。优先使用官方文档、主流包和已验证方案。
- 自研不是默认选项。前端组件、UI primitives、page/overlay primitives、overlay/drawer、audio/media、editor、main process capability、IPC/preload typing、filesystem transaction、file watching、schema validation、state machine、form/schema、data fetching、DB/migration、testing/QA、logging/observability、packaging/updater 都必须先评估官方方案和成熟开源包。
- 发现现成方案不完全适配 Reo 时，先思考如何裁剪、retokenize、组合、包一层薄适配或 fork；只有这些方式仍不能满足 Electron 安全边界、Reo 本地文件真源、Reo design system、测试可控性或代码复杂度预算时，才允许自研，并必须记录已尝试的适配路径和拒绝原因。
- 不创建 generic runtime 或 speculative abstraction。
- 基础未稳固前，不启动会扩大架构面的功能建设。

## 代码组织与命名

- 文件夹和文件名必须表达当前产品实体、能力边界或真实复用层级。
- Workspace、Memory、Asset 等核心实体命名必须与当前信息架构一致；不得用会暗示错误层级的名称承载新实现。
- Feature-local 组件默认放在对应业务目录内；只有存在跨 feature 复用和稳定视觉或交互不变量时，才提升到 `components/ui` 或共享模块。
- `components/ui` 只放可复用 primitive 或稳定交互 pattern；文件名使用 kebab-case，导出名使用 PascalCase，测试与源码同目录。
- Feature-local React 组件文件使用 PascalCase；feature helper、query、machine、adapter 使用能表达能力边界的 camelCase 文件名，并与对应测试同目录。
- 不创建 `misc`、`common`、`helpers`、`services`、`components` 这类无法表达所有权的兜底目录。
- 新增目录必须有清楚的 owner、输入输出边界、测试位置和 current 文档落点。
- 开源组件采用、裁剪、retokenize、薄适配或 fork 后，文件命名仍以 Reo 的业务语义为准，不以来源库名称替代产品语义。
- 设计变更收口必须包含运行时视觉验证；截图、测量或交互证据进入对应 spec 或最终说明，不能只用单元测试替代视觉判断。

## 技术栈方向

以下是 Reo 已确认的技术路线，不代表当前全部已安装：

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

当前工程事实以 `package.json`、源码和 `docs/current/*` 为准。除非对应基础能力已进入实施范围，不得因为技术路线已确认就一次性安装或配置全部依赖。

## 硬红线

- Renderer 不得直接使用 Node 或 Electron API。
- 不得在没有对应 `docs/current/*` 更新的情况下新增 preload、IPC、updater、auth、database、logging、packaging 或 telemetry surface。
- DB schema、表关系、auth tables、Drizzle migrations、query keys、cache ownership、Zustand ownership 必须核对并更新 `docs/current/data.md`。
- Lifecycle、transactions、async ordering、concurrency、rollback、background jobs、recovery behavior 必须核对并更新 `docs/current/flow.md`。
- Electron process model、security、IPC、permissions、protocol、updater、logging、crash reporting、future runtime integration 必须核对并更新 `docs/current/electron.md`。
- React structure、reusable components、Tailwind/shadcn setup、forms、UI state 必须核对并更新 `docs/current/frontend.md`。
- TypeScript、TDD、Vitest、lint/format、hooks、error handling、logging、observability 必须核对并更新 `docs/current/quality.md`。
- 不得为了快速实现而放松 Electron sandbox、contextIsolation、nodeIntegration、CSP、permission 或 navigation 边界。

## TDD 红线

行为改动必须执行真实 TDD。

- 测试必须从行为规格出发，不得从预设实现倒推。
- RED 阶段必须真实运行，并得到具体失败输出。
- 测试必须能识别错误实现，并覆盖高价值边界和异常。
- 断言必须面向外部行为，不绑定内部表示。
- GREEN 只写让当前行为测试通过的最小实现。
- REFACTOR 后必须重新运行保护该行为的测试。

纯文档、机械配置、生成文件可以豁免 TDD，但必须在 spec 或最终说明中写明原因。

## 文档纪律

- Reo 仓库只能有一套活跃真源：当前事实写入 `docs/current/*`，长期架构决策写入 `docs/decisions/*`，跨 session 执行入口写入 `docs/initiatives/*`，当前任务证据写入 `docs/specs/*`。
- 除 `docs/archive/*` 外，活跃文档不得写历史日志、迁移说明、旧实现来源、阶段性复盘或“为什么从过去变成现在”的解释。
- `docs/current/*` 是当前真源。
- `docs/decisions/*` 只记录长期架构决策。
- `docs/initiatives/YYYY-MM-DD-slug/*` 记录跨 session 长期任务。
- `docs/specs/YYYY-MM-DD-HHMM-slug/*` 记录当前工作意图、方案、执行清单和验证证据。
- `docs/archive/specs/YYYY-MM-DD-HHMM-slug/*` 记录已收口任务证据。
- `docs/archive/initiatives/YYYY-MM-DD-slug/*` 记录已完成、取消或失效的长期任务。
- 归档子目录在首次写入时创建；不保留空占位目录。
- spec 时间使用本机时区，并显式写出 timezone，例如 `2026-05-05 05:47 America/Los_Angeles`。
- 未完成的 spec 不能只存在于 `docs/archive/specs/*`。
- spec 只有在当前 spec objective 已完成、取消或被明确 supersede 后，才允许移入 `docs/archive/specs/*`。
- 如果 spec 产出的是 plan，而 plan 指向的产品、实现或长期工作尚未完成，归档前必须先创建或更新 active initiative 来承接剩余工作；否则该 spec 留在 `docs/specs/*`。
- `docs/archive/specs/*` 是已收口 session 证据，不是未完成工作的追踪位置。
- 已完成 specs 移入 `docs/archive/specs/*`，但不是默认阅读内容。
- 已完成、取消或失效的 initiatives 移入 `docs/archive/initiatives/*`，但不是默认阅读内容。
- Initiative 只用于跨 session 任务；每个 session 仍然只推进一个可验证 spec 工作单元。
- 默认最多 1 个产品或代码开发 active initiative；商业化基础设施 initiative 属于横切长期轨道，可以与一个产品或代码开发 active initiative 并行。每个 session 仍然只推进一个可验证 spec 工作单元。超过该边界时先收口、取消或归档。
- 长期任务的完成条件或范围不再匹配当前任务时，创建新的 initiative。
- 创建新 spec 前，必须确认 `docs/specs/*` 为空或只包含当前任务。
- 工作收口时，仍然有效的长期结论必须压缩回 `docs/current/*` 或 `docs/decisions/*`。
- `docs/current/*` 只写当前行为、边界、接口、设计约束和稳定事实；任务证据、执行清单和临时 TODO 留在 spec 或 archive。
- 默认文档与代码注释只写当前事实、当前规则和当前决策。
- 不写“旧、继承、废弃、过去来源、为什么从过去变成现在”这类解释。
- 无当前用途的内容直接删除，不写废弃标记。

## 验证

声明项目干净前必须运行：

```bash
npm run verify:quick
```

如果改动范围要求更深验证，按对应 `docs/current/*` 执行。没有在当前快照运行过的检查，不得宣称通过。

## 技能库

`.agents/skills/*` 与 `.claude/skills/*` 只作为工作流参考。技能示例不是 Reo 产品或架构真源。

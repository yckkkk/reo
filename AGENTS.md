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
- Type system、TDD、Vitest、lint、format、hooks、errors、logging、Sentry：`docs/current/quality.md`

只有当用户指定 slug，或当前工作明确关联某个 spec 时，才读取 `docs/specs/*`。
只有当用户要求继续长期任务，或当前工作明确关联某个 initiative 时，才读取 `docs/initiatives/*`。
只有当用户指定归档 slug，或需要核对已收口任务记录时，才读取 `docs/archive/specs/*`。
读取归档时先搜索，再只打开相关文件。

## 工作原则

- 先想清楚、简单优先、外科式改动、目标驱动执行。
- 最高设计约束是第一性原理和奥卡姆剃刀：先确认目标、实体、约束和不变量，再选择能完整表达当前行为的最少规则。
- 不能在错误模型上堆积逻辑。发现模型错误时，先改回正确模型，再删除由旧模型产生的分支、状态和文案。
- 简化不是删功能。必要的产品能力、安全边界、数据真源、验证路径和用户可见恢复必须保留，并用更少、更清楚的结构表达。
- 若歧义会影响架构、数据、UX、验证或工作量，先说明假设再行动。
- 设计默认从官方方案、主流包和成熟开源项目出发；设计新功能或使用技术栈能力前，必须先通过 Context7 查询对应官方当前文档；Context7 无覆盖时再使用官方站点、源码或包内文档。
- 非平凡改动先定义成功标准，再实现，再验证。
- 不盲目同意 reviewer 或用户假设；必须用项目目标、源码事实和官方文档判断。
- 当请求会破坏基础顺序、扩大范围、跳过闭环或在错误方向上追求局部完美时，必须先纠偏。
- 同一时间只推进一个可验证基础工作单元，除非用户明确要求重新排期。

## 产品与实现边界

- 产品未发布：不做向后兼容，不保留兼容性垫片或包装层。
- 代码和文档只描述当前事实、当前规则和当前决策。
- 不保留无当前用途的实现、文档、目录或接口。
- 不创建 generic runtime、speculative abstraction 或无当前 consumer 的包装层。
- 不重复造轮子。前端组件、UI primitives、editor、IPC/preload typing、filesystem transaction、file watching、schema validation、state machine、form/schema、data fetching、DB/migration、testing/QA、logging/observability、packaging/updater 都必须先评估官方方案和成熟开源包。
- 发现现成方案不完全适配 Reo 时，先考虑裁剪、retokenize、组合、薄适配或 fork；只有这些方式仍不能满足 Electron 安全边界、本地文件真源、Reo design system、测试可控性或代码复杂度预算时，才允许自研。
- 当前工程事实以 `package.json`、源码和 `docs/current/*` 为准。技术路线不等于安装或激活许可。
- 记忆空间文件合同以 `docs/current/architecture.md`、`docs/current/data.md`、`docs/current/electron.md` 和 `docs/current/flow.md` 为准；agent 不得把 `.reo` 当作用户语义第二真源。

## 代码组织

- 文件夹和文件名必须表达当前产品实体、能力边界或真实复用层级。
- Workspace、Memory、Segment、SegmentSupplement 等核心实体命名必须与当前信息架构一致。
- Feature-local 组件默认放在对应业务目录内；只有存在跨 feature 复用和稳定视觉或交互不变量时，才提升到 `components/ui` 或共享模块。
- `components/ui` 只放可复用 primitive 或稳定交互 pattern；文件名使用 kebab-case，导出名使用 PascalCase，测试与源码同目录。
- Feature-local React 组件文件使用 PascalCase；feature helper、query、machine、adapter 使用能表达能力边界的 camelCase 文件名，并与对应测试同目录。
- 不创建 `misc`、`common`、`helpers`、`services`、`components` 这类无法表达所有权的兜底目录。
- 新增目录必须有清楚的 owner、输入输出边界、测试位置和 current 文档落点。
- 设计变更收口必须包含运行时视觉验证；截图、测量或交互证据进入对应 spec 或最终说明。

## 硬红线

- Renderer 不得直接使用 Node 或 Electron API。
- 不得为了快速实现而放松 Electron sandbox、contextIsolation、nodeIntegration、CSP、permission 或 navigation 边界。
- 新增或改变 preload、IPC、updater、auth、database、logging、packaging、telemetry、DB schema、query/cache ownership、Zustand ownership、lifecycle、transaction、background job、React structure、reusable component、forms、UI state、type/test/lint/error/logging surface 时，必须核对对应 `docs/current/*`。
- 只有当改动改变稳定模型、接口合同、安全边界、跨任务不变量或当前能力索引时，才写入 `docs/current/*`；任务内取舍、具体 UI 数值、测试枚举、一次性实现判断和验证证据留在 spec 或 archive。

## TDD 红线

TDD 是风险控制，不是仪式。开始非平凡改动前必须先判断是否需要 TDD。

- 新增或改变 public contract、IPC/preload、auth、DB、filesystem、transaction/recovery、security/permission、concurrency、cache/session ownership、跨 session 状态、用户可见 workflow 或已复现高风险回归时，必须执行真实 TDD。
- 纯文档、机械配置、格式化、重命名、删除死代码、无行为变化的类型收窄、简单文案、简单样式 token 调整或已被现有测试覆盖的小改动可以豁免 TDD，但必须在 spec 或最终说明中写明原因和替代验证。
- 不得为了满足流程写假 RED、复述实现步骤的测试、无法识别错误实现的测试或只锁 DOM/class 微细节的测试。
- 执行 TDD 时，测试必须从行为规格出发，不得从预设实现倒推。
- 执行 TDD 时，RED 阶段必须真实运行，并得到具体失败输出。
- 执行 TDD 时，测试必须能识别错误实现，并覆盖高价值边界和异常。
- 执行 TDD 时，断言必须面向外部行为，不绑定内部表示。
- 执行 TDD 时，GREEN 只写让当前行为测试通过的最小实现。
- 执行 TDD 时，REFACTOR 后必须重新运行保护该行为的测试。

临时 TDD 测试不默认进入长期 suite。任务收口时，只有保护长期行为合同、安全边界、事务恢复、公开 contract 或高风险回归的测试保留；探索性测试、实现脚手架测试和重复枚举测试应合并、降级为 spec 证据或删除。

## 文档纪律

- Reo 仓库只能有一套活跃真源：当前事实写入 `docs/current/*`，长期架构决策写入 `docs/decisions/*`，跨 session 执行入口写入 `docs/initiatives/*`，当前任务证据写入 `docs/specs/*`。
- 除 `docs/archive/*` 外，活跃文档不得写历史日志、迁移说明、旧实现来源、阶段性复盘或“为什么从过去变成现在”的解释。
- `docs/current/*` 只写当前行为、边界、接口、设计约束和稳定事实；不写任务证据、执行清单、验证日志、当前未完成项或任务内小取舍。
- `docs/decisions/*` 只记录长期架构或产品决策。
- `docs/initiatives/YYYY-MM-DD-slug/*` 记录跨 session 长期任务。
- `docs/specs/YYYY-MM-DD-HHMM-slug/*` 记录当前工作意图、方案、执行清单和验证证据。
- 已完成 specs 移入 `docs/archive/specs/*`，已完成、取消或失效的 initiatives 移入 `docs/archive/initiatives/*`。
- 创建新 spec 前，必须确认 `docs/specs/*` 为空或只包含当前任务。
- 如果 spec 完成的是 plan，而 plan 指向的产品、实现或长期工作尚未完成，归档前必须先创建或更新 active initiative 来承接剩余工作；否则该 spec 留在 `docs/specs/*`。
- 工作收口时，仍然有效的长期结论必须压缩回 `docs/current/*` 或 `docs/decisions/*`；压缩只保留稳定结论，不搬运任务过程。
- 默认文档与代码注释只写当前事实、当前规则和当前决策；不写“旧、继承、废弃、过去来源、为什么从过去变成现在”。

## 验证

声明项目干净前必须运行：

```bash
npm run verify:quick
```

如果改动范围要求更深验证，按对应 `docs/current/*` 执行。没有在当前快照运行过的检查，不得宣称通过。

## 技能库

`.agents/skills/*` 与 `.claude/skills/*` 只作为工作流参考。技能示例不是 Reo 产品或架构真源。

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

以下是当前技术路线，不代表当前全部已安装、已配置或已被当前能力激活：

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

只在实现对应基础能力时安装或配置相关包。不得加入空闲依赖、占位目录或未来架构壳。

技术路线不是激活许可。任何 package、provider、schema、IPC、component source、store、query client、auth、DB、logging、packaging 或 updater 能力，都必须先有当前 feature 的 exact consumer、capability contract、测试路径和 `docs/current/*` 更新。

自研不是默认选项。前端组件、UI primitives、page/overlay primitives、overlay/drawer、audio/media、editor、main process capability、IPC/preload typing、filesystem transaction、file watching、schema validation、state machine、form/schema、data fetching、DB/migration、testing/QA、logging/observability、packaging/updater 都必须先评估官方方案和成熟开源包。发现现成方案不完全适配 Reo 时，先思考如何裁剪、retokenize、组合、包一层薄适配或 fork；只有这些方式仍不能满足 Electron 安全边界、Reo 本地文件真源、Reo design system、测试可控性或代码复杂度预算时，才允许自研，并必须记录已尝试的适配路径和拒绝原因。

## 文档与注释规则

- 默认文档与代码注释只写当前事实、当前规则和当前决策。
- 不写“旧、继承、废弃、过去来源、为什么从过去变成现在”这类解释。
- 无当前用途的内容直接删除，不写废弃标记。
- 需要解释设计原因时，只写当前约束、当前目标和当前 tradeoff。

## 产品方向

**Reo 的产品本质：让用户围绕一件事产生的所有材料，被 agent 转化成只属于用户的作品的私人空间。**

四个关键词同时成立才是 Reo：

- **"围绕一件事"** — Memory 是主题容器，不是时间流、不是文件夹、不是项目管理。例如一本书的写作、一门课的学习、一段创业心路、一次旅程、一个孩子的成长、一段重要的关系。
- **"所有材料"** — 多模态：录音、视频、照片、笔记、上传文件平等存在；任何单一模态都不是 Reo 的中心。
- **"agent 转化"** — Codex-class agent 在用户完整 Memory 的跨模态材料上生成、重构、创作，不是存储 / 检索 / 搜索。
- **"只属于用户的作品"** — 别人无法复制（材料是用户的），用户自己做不到（没有 agent 替他做）；这层唯一性是 Reo 的护城河。

产品本质由三件套支撑（不独立于核心存在）：

- **本地文件真源**：记忆空间是用户选择的本地文件夹。多模态材料以普通文件保存，供用户、文件系统工具和 Codex-class agent 直接读取。服务"属于用户"。
- **Agent-native 协作能力**：Codex-class agent 是产品第一公民。用户通过 AGENTS.md、skills、prompt-bridge 入口让 agent 在 Memory 上工作。服务"agent 转化"。
- **极致交互气质（craft）**：各模态捕获 / 回放的场景感、Memory Studio 节奏、Gallery 走马灯视觉听觉、widget 渲染一致性、prompt-bridge 反馈细节是产品不变量。所有功能必须过 craft 门槛；任何拼凑、敷衍或"先做能用版本"的功能不能进入主链。服务"用户愿意回到 Memory 并把作品当自己的"。

Reo 的目标用户是有持续主题关注的 prosumer 创作者与思考者：Obsidian 用户、专业写作者、研究者、podcasters / video essayists、深度学习者、parent journalers、有强烈记录欲的领域专家。共同特征：有思考深度、愿意尝试新工具、愿意配置和使用 AI 工具、在意"我产生的材料应该能变成属于我的作品"。Reo 不为零摩擦上手优化。

记忆空间文件夹是真实产物源。DB 可以作为索引、关系、查询和处理状态层，但不替代记忆空间文件夹作为用户记忆内容真源。每个记忆空间 root 使用 `AGENTS.md` 作为 agent 协作入口，Reo 自己的 workspace metadata 位于 `.reo/workspace.json`。

当前阶段优先完成 `roadmap.md` P1-P6，把以 audio 单模态实现的表达主链、记忆空间管理、Memory Studio、Move Memory、Review 基础和 AI-ready 验证落地。**P1-P6 是 enabling phase，不是 Reo 完整形态。** Reo 的完整产品形态需要多模态 Segment 类型（视频 / 图片 / 笔记 / 上传文件）+ widget runtime + HTML Segment 渲染 + Gallery 走马灯 + AGENTS.md / skills 模板 + prompt-bridge UI 全部到位，这些属于产品本质长期轨道，在表达主链稳固后启动独立 initiative。

长期产品本质决策见 `docs/decisions/0006-agent-native-carrier-and-generative-ui.md`，外向定位叙事与用户场景见 `docs/initiatives/2026-05-14-commercial-infrastructure-foundation/positioning.md`，文件真源底层决策见 `docs/decisions/0003-local-memory-workspace.md`。

## Agent 行为

- 当歧义会影响架构、数据、UX、验证或工作量时，先问或先声明假设。
- 当目标明确时，直接推进到可验证结果。
- 可以主动挑战需求，但必须给出更低成本、更少复杂度的替代方案。
- 使用对抗性审查暴露风险，但最终决策必须回到 Reo 目标、源码事实和官方指导。
- 不盲目同意；用户说错时也要礼貌指出。

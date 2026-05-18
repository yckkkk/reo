# 0006 Agent-native 个人记忆 Studio 与 Generative UI

时间：2026-05-18 00:30 America/Los_Angeles
状态：已接受

## 决策

Reo 是给 prosumer 用户的 agent-native 个人记忆 studio。产品差异化由三件套同时约束，缺一不是 Reo：

1. **本地文件真源** — 用户拥有的本地文件夹，可被任意 agent、Finder、备份工具直接读取。底层合同见 `0003-local-memory-workspace.md`。
2. **Agent-native 协作能力** — Codex-class agent 是产品第一公民，通过文件真源、AGENTS.md、skills 和 prompt-bridge 操作 Reo 内容。
3. **极致交互气质（craft）** — 录音场景感、画廊走马灯、视觉听觉节奏感是产品不变量。所有功能必须过 craft 门槛；任何拼凑或敷衍版本不能进入主链。

Reo 不是 AI 记录 app，不是 chatbot 伙伴，不是被动 carrier。Reo 是主动的 studio：用户在其中表达、思考、创作；agent 在其中筛选、深化、生成、回顾。

## 目标用户

Reo 的目标用户是 **Obsidian 类 prosumer**：有思考深度、愿意尝试新工具、愿意配置和使用 AI 工具（Codex CLI、Claude Code 同级 agent）的用户。

这意味着 Reo 不为零摩擦上手优化。用户被允许、被预期：

- 理解记忆空间是本地文件夹
- 自行配置 ASR / agent 凭证
- 通过 Entity More 菜单复制 prompt 到外部 agent
- 在 widget / skills 体系内做轻量定制

非目标用户：手机端碎片记录用户、不愿配置工具的消费者、寻找统一组织效率工具的用户。

## Agent 协作模型

| 角色 | 职责 |
|---|---|
| 用户 | 表达、思考、判断、选择、补充 |
| Agent | 读取、筛选、整理、深化、生成、回顾、引导用户做更深表达 |
| Reo | 承载、文件真源、craft 门槛、AGENTS.md / skills 入口、prompt-bridge UI、generative UI 渲染 |

用户不是整理员。原始记忆不被假设为资产；价值在 agent 和用户共同筛选、深化、重新表达之后才出现。

SegmentSupplement 不只是补录，也是 agent 引导用户做更深表达的载体。回顾、整理、生成动作都可以提示用户补充新的 SegmentSupplement，把记忆补全。

## Generative UI 两层模型

### Widget

Widget 是 agent 根据用户需求生成的可交互定制面板。Widget 是 Workspace / Memory 的兄弟级实体，不是 Segment 的子类。

- **Workspace-level widget** 出现在 Home 区域和 Gallery 走马灯 tab，跨 Memory 聚合或承载用户自定义视图。
- **Memory-level widget** 出现在该 Memory 的右侧 tab，和 `转录`、SegmentSupplement tab 同层。典型例子：用户对 agent 描述"在这个记忆空间加一个日历 / 热力图"，widget 出现在 Memory rail tab 中。

Widget 文件合同、对象 manifest、渲染沙箱由 widget runtime spec 定义；本 ADR 只确立 widget 是一等公民，并要求 widget 渲染必须过 craft 门槛。

### HTML Segment 与 HTML SegmentSupplement

Agent 根据用户内容生成的 HTML 报告、作品页、复盘文档作为 Segment / SegmentSupplement 的新类型 `html` 落到现有文件合同中：

```text
memories/<memoryDirectory>/segments/<segmentDirectory>/segment.html
memories/<memoryDirectory>/segments/<segmentDirectory>/supplements/<supplementDirectory>/supplement.html
```

类型字段进入 `.reo/objects/segments/*.json` 和 `.reo/objects/supplements/*.json` 的 manifest。HTML 是不可信资源，没有隔离预览能力前 renderer 不执行、不注入、不渲染用户 HTML；HTML Segment / Supplement 渲染需要先实现隔离预览能力，spec 在独立工作单元中完成。

## Prompt-bridge 入口

当前阶段 agent 协作通过外部 Codex-class agent + 文件真源 + prompt-bridge UI 实现。Reo 不内嵌 chat、tool use 或自动整理。

Reo 在 Workspace、Memory、Segment、SegmentSupplement、Widget 的 Entity More 菜单中挂统一 `agent 操作 ▸` 子菜单。每条菜单项点击后，把带上下文（实体类型、stable id、文件路径、操作意图）的 prompt 复制到剪贴板。用户粘贴到 Codex CLI 或 Codex Web 即可让 agent 操作 Reo 文件。

Reo 自身不调用任何远程 AI 服务；prompt 模板由 Reo skills 维护。

**Prompt-bridge 是当前阶段的 agent 协作入口，不是永久骨架**。未来 agent 内嵌进入 Reo runtime 时，Entity More 菜单上的 `agent 操作` 子菜单可直接演化为内嵌触发入口，无需重构 UI 结构。

## Day 1 Skills 与 Widget

Reo 出厂必须自带默认 skills 和 widget 示例，不能等用户从零创造。skills 与 prompt 模板是 Reo 对外差异化的核心承担物：Flomo 付费的 AI 视角，在 Reo 都是 skills 自定义免费——用户带 Codex / Claude credits，Reo 给 prompt 模板 + 文件结构 + 操作入口。

默认 skills（共 8 项）：

基础四类：

- **引导 skills**：在用户录音后引导他做 SegmentSupplement 补充表达
- **回顾 skills**：结合记忆曲线 + 随机推送式回顾节奏，挑出值得回顾、值得复述、值得深化的内容
- **整理总结 skills**：对 Memory / 多 Memory 范围做摘要、提取、归纳
- **Widget 生成 skills**：让 agent 基于 example 库为用户生成新 widget

思考视角四类（Day 1 starter，方法来自芒格、Howard Marks 等公开领域成熟方法）：

- **默认洞察**：挖掘 Memory 内容背后的思维模式与深层联系
- **价值澄清**：从 Memory 中识别用户真正看重的价值与优先级
- **逆向思考**：用芒格的逆向思维考察 Memory 中的关键判断
- **二阶思考**：从 Memory 识别出问题，并提炼出问题之上的问题

默认 widget 示例：

- 日历 widget
- 时间线 widget

Widget 由 agent 用 example 库制作，example 在 widget 生成 skills 中维护。

CBT 疗法、MBTI 分析等领域专业 skill 不出厂，仅以可 fork 示例形式在文档中提及。理由：CBT 涉及临床心理学边界，MBTI 涉及商业授权风险。用户自决是否启用。

具体 skills 目录结构、AGENTS.md 模板、widget example 格式由独立 spec 定义。

## Gallery 信息架构

Gallery 是 Workspace 级别独立页面，与 Home / Loaded Workspace 同级，取代当前 Library 占位入口。AppShell 顶层入口为 Home / Gallery / Loaded Workspace。

Gallery 内部两个 tab：

- **走马灯艺术 tab** — 沉浸式记忆走马灯，让用户享受自己的记忆。视觉听觉节奏感是 craft 门槛的核心承担页。
- **列表 tab** — 跨 Memory 的清晰信息呈现，承担原 Library 的资料库职责。

Library 占位入口从 product.md 信息架构中删除；code 层 placeholder 替换为 Gallery 的实际工作单元由独立 spec 处理，不在本 ADR 范围。

## Craft 不变量

极致交互是 Reo 产品不变量，不是阶段性偏好。所有功能必须过 craft 门槛：

- 录音 / 播放 / 转录的场景感
- Memory Studio 的呼吸感与节奏
- Gallery 走马灯的视觉听觉节奏
- Widget 渲染的视觉一致性
- prompt-bridge 操作的反馈细节

任何拼凑、敷衍、"先做能用版本"的功能不能进入主链。如功能短期不能达到 craft 门槛，先不做或留在 spec 中作为已知 gap，不向用户呈现。

Craft 投入是 Reo 差异化资产，不是开发负担。Reo 在 waveform、Memory Studio 卡片设计、过渡动画的现有投入是该资产的初始积累。

## 当前阶段时序

产品本质长期，实施分阶段。当前阶段优先完成 `docs/current/roadmap.md` P1-P6：表达主链、记忆空间管理、Memory Studio、Move Memory、Review 基础、AI-ready 验证。这些是 agent 能进入记忆空间工作的前提，也是 Reo 主链 craft 门槛的奠基。

Widget runtime、HTML Segment 渲染、prompt-bridge UI、AGENTS.md 模板、skills、Gallery 走马灯等产品本质长期轨道工作在表达主链稳固后启动新 active initiative。本 ADR 不开新 initiative，也不与当前 `2026-05-17-complexity-optimization` 并行执行。

录音、笔记、图片、视频等输入类型的实现是 enabling 工作，agent-first 才是 wedge。当前在录音上的投入是因为它是所有内容类型的基础；录音主链通后，笔记 / 图片 / 视频会更快打通，agent-first 工作即可全力推进。

## Founder voice 与产品哲学

Reo 的护城河不只是产品三件套（本地真源 + agent-native + craft），还需要 founder voice 和产品哲学的公开输出。Flomo 在中国 prosumer 市场已证明这是必备条件：少楠通过持续公开输出建立了 Flomo 与个人品牌的绑定，使产品有可信叙事载体。Reo 目标用户群与 Flomo 高度重叠，缺少 founder voice 意味着即使产品做出来也没有传播载体。

Reo 创作者承诺持续公开输出：

- 产品哲学（agent-native 与 generative UI 判断、craft 不变量）
- 三件套差异化叙事（本地真源 + agent-native + craft）
- 与 Flomo / Obsidian / Notion AI 等竞品的诚实对比
- 真实创作过程与产品判断的演进

founder voice 不是营销动作，是 Reo 产品的一部分。具体节奏、渠道和形态由商业化基础设施 initiative 维护。

## 非目标

为强化产品哲学一致性，本 ADR 明确以下方向不进 Reo 主线，不在 docs / runtime / roadmap 中作为产品能力出现：

- **被动监听、后台屏幕捕获**：与 Reo studio 主动表达气质冲突，与"原始记忆不是资产"判断冲突
- **AI 自动整理 / 自动生成**：所有 agent 操作必须用户触发；Reo 不假装是自动化助手
- **替代用户思考的 chatbot**：Reo 强化用户主动思考，不做"问我任何问题"式 AI 伙伴
- **云端真源**：本地文件真源不可让步；云端只能是同步层 / 服务层
- **声音复刻类创作工具能力**：属于创作工具不属于记忆 studio，目标用户偏移，且有 IP / 监管风险。如用户需要，可外部工具加工 Reo 导出的录音
- **移动碎片捕获入口**：包括独立移动 app、微信服务号、系统通知 / widget 快记。Reo 的赢法是低频高价值场景，不是高频碎片
- **平台强制绑定第三方模型**：Reo 不预设特定模型供应商；用户用自己 Codex / Claude credits 通过 prompt-bridge 操作。如未来 Reo 内嵌 AI runtime 需要选择供应商，需要独立 ADR 决定

## 与现有 ADR 关系

- `0001-agent-docs-system.md` 定义 Reo 仓库内 agent 协作真源；本 ADR 把 agent 协作扩展到用户记忆空间。
- `0002-electron-build-and-security-baseline.md` 提供 Electron 安全边界；HTML widget / Segment 渲染必须在该边界内通过隔离预览能力实现。
- `0003-local-memory-workspace.md` 提供文件真源底层；本 ADR 在其上构造 agent-native 与 generative UI 语义。

## 影响

- `docs/current/foundation.md` 产品方向段必须反映 studio + agent + craft 三件套，并把 craft 写为不变量。
- `docs/current/product.md` 把 AI 边界改写为 agent 边界；页面模型中 Library 替换为 Gallery，明确 Gallery 两个 tab 结构。
- `docs/current/roadmap.md` 在 P0-P6 之外增加产品本质长期轨道段，列出 widget runtime、HTML Segment 渲染、prompt-bridge UI、AGENTS.md / skills 模板、Gallery 走马灯等基础建设条目，明确等表达主链稳固后启动独立 initiative。
- `docs/initiatives/2026-05-14-commercial-infrastructure-foundation/product-thesis.md` 关于 agent-ready memory space、generative AI surfaces、design-system-constrained HTML creation、record-to-create loop 的长期判断引用本 ADR；该 initiative 只保留商业化和求职差异化叙事。
- Reo 后续任何会改变记忆空间文件合同、Memory Studio tab 模型、Home 信息架构、Segment / SegmentSupplement 类型、Gallery 结构或 agent 协作入口的 spec 必须核对本 ADR。

## 已知风险

- Craft 不变量 + agent-first wedge + prosumer 用户三个判断同时成立，会拉长开发周期，并面对 Obsidian / Notion AI / Tana / Cursor / Flomo 等密集竞品。本 ADR 接受这个 tension：差异化优先于速度。
- Prompt-bridge 在 OS 内嵌 agent 普及后可能成为冗余 UX。Reo 接受这层风险，因为外部 agent 在当前是最聪明的可用 agent，且 Entity More 菜单结构允许未来无重构演化。
- Reo 三件套是必要条件，不是充分条件。Flomo 没有任何一件套，但靠每日回顾习惯 + founder voice + 微信生态 + 哲学一致性在 prosumer 市场占据稳定心智。Reo 必须同时建设 founder voice + 回顾习惯机制，单靠三件套不足以胜出。竞品分析见 `docs/initiatives/2026-05-14-commercial-infrastructure-foundation/competitive-analysis.md`。
- Skills 替代付费 AI 的叙事依赖用户愿意配置外部 agent。zero-config 用户不在 Reo 目标画像内；本 ADR 接受这层用户筛选。

## 参考

- `docs/decisions/0003-local-memory-workspace.md`
- `docs/initiatives/2026-05-14-commercial-infrastructure-foundation/product-thesis.md`
- AGENTS.md 协议站点：https://agents.md
- Anthropic Claude Code skills 文档：https://docs.claude.com/en/docs/claude-code/skills

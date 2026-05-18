# 0006 Agent-native 个人记忆 Studio 与 Generative UI

时间：2026-05-18 00:30 America/Los_Angeles
状态：已接受

## 决策

Reo 的产品本质：**让用户围绕一件事产生的所有材料，被 agent 转化成只属于用户的作品的私人空间。**

四个关键词同时成立才是 Reo：

1. **"围绕一件事"** — Memory 主题容器，不是时间流，不是文件夹，不是项目管理
2. **"所有材料"** — 多模态：录音、视频、照片、笔记、上传文件平等存在；任何单一模态都不是 Reo 的中心
3. **"agent 转化"** — 不是存储 / 检索 / 搜索；Codex-class agent 在用户完整 Memory 上生成、重构、创作
4. **"只属于用户的作品"** — 唯一性。别人无法复制（材料是用户的），用户自己做不到（没有 agent 替他做）

Reo 不是 AI 记录 app，不是 chatbot 伙伴，不是被动 carrier，不是单一模态工具（不是录音工具、不是笔记工具、不是相册）。Reo 是跨模态主题容器 + agent 转化 + 唯一作品输出的私人创作空间。

产品差异化三件套是上述本质的支撑结构，由这四个关键词决定，不独立于核心存在：

1. **本地文件真源** — 服务"只属于用户的作品"中的"属于用户"。用户拥有的本地文件夹，可被任意 agent、Finder、备份工具直接读取。底层合同见 `0003-local-memory-workspace.md`。
2. **Agent-native 协作能力** — 服务"agent 转化"。Codex-class agent 是产品第一公民，通过文件真源、AGENTS.md、skills 和 prompt-bridge 在用户完整 Memory 上工作。
3. **极致交互气质（craft）** — 服务用户愿意持续回到 Memory 并把作品当成自己的。录音场景感、Gallery 走马灯视觉听觉节奏、widget 渲染一致性是产品不变量。所有功能必须过 craft 门槛。

详细用户场景、电梯演讲与唯一性论证见 `docs/initiatives/2026-05-14-commercial-infrastructure-foundation/positioning.md`。

## 目标用户

Reo 的目标用户是 **有持续主题关注的 prosumer 创作者与思考者**：

- 有思考深度、愿意尝试新工具、愿意配置和使用 AI 工具（Codex CLI、Claude Code 同级 agent）
- 对一件事会有跨模态长期投入：可能是写一本书、做一项研究、养一个孩子、学一个领域、维护一段关系、记录一段旅程
- 在意"我产生的材料应该能变成属于我的作品"，不只是"我的内容应该被记录"
- 接受桌面工具、本地文件、轻量定制、prompt-bridge 这类 prosumer 工具体验

参考画像：Obsidian 用户、专业写作者、研究者、podcasters / video essayists、深度学习者、parent journalers、有强烈记录欲的领域专家。

这意味着 Reo 不为零摩擦上手优化。用户被允许、被预期：

- 理解记忆空间是本地文件夹
- 自行配置 ASR / agent 凭证
- 通过 Entity More 菜单复制 prompt 到外部 agent
- 在 widget / skills 体系内做轻量定制

非目标用户：手机端碎片记录用户、不愿配置工具的消费者、寻找统一组织效率工具的用户、把 AI 当作 chat 伙伴而非 agent 的用户。

## Agent 协作模型

| 角色  | 职责                                                                                      |
| ----- | ----------------------------------------------------------------------------------------- |
| 用户  | 表达、思考、判断、选择、补充                                                              |
| Agent | 读取、筛选、整理、深化、生成、回顾、引导用户做更深表达                                    |
| Reo   | 承载、文件真源、craft 门槛、AGENTS.md / skills 入口、prompt-bridge UI、generative UI 渲染 |

用户不是整理员。原始材料不被假设为资产；价值在 agent 和用户共同筛选、深化、转化成作品之后才出现。

SegmentSupplement 不只是单一模态的补录，也是 agent 引导用户做更深表达的载体。Agent 引导用户的下一步可能是：补一段录音、拍一张相关照片、写一条结构化笔记、上传一份参考文件——视当前 Memory 的语境而定。回顾、整理、生成动作都可以提示用户用最合适的模态补全 Memory。

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

Reo skills 分两层：

- **原子 skill**：单一职责的 prompt 模板。用户可 fork、可定制、可被 agent 在不同场景下复用。
- **use-xxx 组合 skill**：use case 编排 skill。agent 看到它会按 use case 流程调用底层原子 skill。**skill 组合是 agent 的责任，不是用户的责任**——用户体验是"帮我做学习闭环"，不是"请你依次运行 A→B→C 三个 skill"。

### 原子 skill 库（Day 1 共 8 项）

基础四类：

- **引导 skill**：基于当前 Memory 的累积材料，引导用户用最合适的模态做下一步补充——可能是补录音、拍照、写笔记、上传文件
- **回顾 skill**：结合记忆曲线 + 随机推送式回顾节奏，从所有模态材料中挑出值得回顾、值得复述、值得深化的内容
- **整理总结 skill**：对 Memory / 多 Memory 范围的跨模态材料做摘要、提取、归纳、关联
- **Widget 生成 skill**：让 agent 基于 Memory 的多模态材料 + example 库生成新 widget（例如成长册、概念时间线、关系曲线、引言库）

思考视角四类（方法来自芒格、Howard Marks 等公开领域成熟方法）：

- **默认洞察**：挖掘 Memory 内容背后的思维模式与深层联系
- **价值澄清**：从 Memory 中识别用户真正看重的价值与优先级
- **逆向思考**：用芒格的逆向思维考察 Memory 中的关键判断
- **二阶思考**：从 Memory 识别出问题，并提炼出问题之上的问题

### use-xxx 组合 skill（Day 1 共 3 项）

每个 use-xxx skill 是 use case 编排，告诉 agent 在该 use case 下应当何时调用哪些原子 skill：

- **use-学习闭环**：服务学习场景（读书、学一个学科、提升某项技能）。流程编排：用户表达 → 调用表达深度分析（默认洞察 / 二阶思考）→ 生成教学反馈 HTML Segment（指出表达不足、解释材料中遗漏处）→ 引导用户补充表达（引导 skill）→ 配合回顾 skill 推送提醒 → 决策是否需要再次表达。
- **use-记忆回顾循环**：服务长期记录场景（孩子成长、关系、旅程）。流程编排：挑选关键时刻（回顾 skill）→ 生成跨模态走马灯 widget → 提示用户补充上下文（引导 skill）→ 整理成阶段性 HTML 作品（整理总结 + Widget 生成）。
- **use-内容创作支援**：服务创作场景（写书、写文章、做 podcast）。流程编排：提取素材（整理总结 skill）→ 生成大纲 widget（Widget 生成 skill）→ 写作草稿（HTML Segment）→ 修订循环（默认洞察 + 价值澄清）→ 自动补充访谈 / 参考资料缺口（引导 skill）。

### Widget 示例

- 日历 widget
- 时间线 widget

Widget 由 agent 用 example 库制作，example 在 widget 生成 skill 中维护。跨模态作品 widget（成长册、关系曲线、概念时间线、引言库）作为完整形态示例。

### 不出厂的 skill

CBT 疗法、MBTI 分析等领域专业 skill 不出厂，仅以可 fork 示例形式在文档中提及。理由：CBT 涉及临床心理学边界，MBTI 涉及商业授权风险。用户自决是否启用。

具体 skills 目录结构、AGENTS.md 模板、users.md 模板、widget example 格式由独立 spec 定义。

## Agent Context 双层：AGENTS.md + users.md

Agent 在用户 Memory 上工作时同时读两层 context，缺一不能产生真正属于用户的输出：

- **AGENTS.md**（项目 / Workspace 真源）：Workspace root 与每个 Memory root 的 AGENTS.md。承担"这是什么项目 / 这个 Memory 是什么主题 / 文件合同 / 协作规则"。Reo 出厂模板，用户可改。
- **users.md**（用户个人 context）：Workspace root 的 users.md。承担"用户是谁、长期目标、当前关注、表达偏好、agent 输出风格偏好"。Reo 出厂模板 + 首次启动引导用户填写，agent 每次操作前读取。Memory level users.md override 留作未来 spec 决定。

users.md 是 Reo 独家的 agent 个人化 context 层。Obsidian / Day One / Flomo / Notion AI 都没有把"用户是谁"作为一等 agent context。这层服务"只属于用户的作品"承诺：因为 agent 知道用户是谁、想要什么、偏好什么，输出才真正属于用户而不是模板。

users.md 的形态由独立 spec 定义；本 ADR 只确立它是一等 agent context 层。

## Gallery 信息架构

Gallery 是 Workspace 级别独立页面，承载跨 Memory 的沉浸式回顾和清晰信息呈现。Gallery 不是当前 runtime surface，落地由独立 spec 处理；本 ADR 只确立 Gallery 作为 Workspace-level 页面的信息架构定位。

Gallery 内部两个 tab：

- **走马灯艺术 tab** — 沉浸式记忆走马灯，跨模态混合呈现（录音 + 视频 + 照片节奏感切换）。视觉听觉节奏感是 craft 门槛的核心承担页之一。
- **列表 tab** — 跨 Memory 的清晰信息呈现，承担清单查阅职责。

AppShell 顶层入口当前为 Home / 资料库 / Loaded Workspace。资料库承担创建、打开、导入、恢复和移除记忆空间入口；Gallery 进入 AppShell 顶层时的具体位置（取代某个入口、加入第四入口、还是作为 Loaded Workspace 内部 view）由 Gallery 落地 spec 决定，不在本 ADR 范围。

## Craft 不变量

极致交互是 Reo 产品不变量，不是阶段性偏好。所有功能必须过 craft 门槛：

- 各模态捕获（录音 / 录视频 / 拍照 / 写笔记 / 上传）的场景感
- 各模态回放（waveform / video player / photo gallery / note read）的体验一致性
- Memory Studio 的呼吸感与节奏
- Gallery 走马灯的视觉听觉节奏（跨模态混合呈现）
- Widget 渲染的视觉一致性
- prompt-bridge 操作的反馈细节

任何拼凑、敷衍、"先做能用版本"的功能不能进入主链。如功能短期不能达到 craft 门槛，先不做或留在 spec 中作为已知 gap，不向用户呈现。

Craft 投入是 Reo 差异化资产，不是开发负担。Reo 在 waveform、Memory Studio 卡片设计、过渡动画的现有投入是该资产的初始积累。

## 当前阶段时序

产品本质长期，实施分阶段。当前阶段优先完成 `docs/current/roadmap.md` P1-P6：表达主链、记忆空间管理、Memory Studio、Move Memory、Review 基础、AI-ready 验证。这些是 agent 能进入记忆空间工作的前提，也是 Reo 主链 craft 门槛的奠基。

**Reo 的完整产品形态需要多模态。** P1-P6 当前以 audio 单模态实现表达主链，是因为 audio 的复杂度（live ASR、finalize、draft、recovery）最高，通它就通其他。但 audio 单模态不是 Reo，跨模态主题容器才是 Reo。视频 Segment、图片 Segment、笔记 Segment、imported_file Segment 是产品本质长期轨道的必经条目，不是"长期方向"中可选项。

Widget runtime、HTML Segment 渲染、prompt-bridge UI、AGENTS.md 模板、skills、Gallery 走马灯、多模态 Segment / SegmentSupplement 类型等产品本质长期轨道工作在 audio 主链稳固后启动新 active initiative。本 ADR 不开新 initiative，也不与当前 `2026-05-17-complexity-optimization` 并行执行。

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

- `docs/current/foundation.md` 产品方向段反映多模态主题容器核心 + agent 转化价值；三件套作为支撑结构。
- `docs/current/product.md` 定位段反映多模态核心；AI 边界改写为 agent 边界；页面模型中 Library 替换为 Gallery，明确 Gallery 两个 tab 结构；加用户场景段。
- `docs/current/roadmap.md` 把多模态 Segment / SegmentSupplement 类型从"长期方向"提升到"产品本质长期轨道"，与 widget runtime / Gallery / prompt-bridge / skills 同级。明确 P1-P6 是 audio 单模态的 enabling phase，Reo 完整产品形态需要多模态。
- `docs/initiatives/2026-05-14-commercial-infrastructure-foundation/positioning.md` 承担外向定位叙事、用户场景、电梯演讲、唯一性 moat 论证。
- `docs/initiatives/2026-05-14-commercial-infrastructure-foundation/product-thesis.md` 只保留商业化和求职差异化叙事，产品本质判断引用本 ADR 与 positioning.md。
- `docs/initiatives/2026-05-14-commercial-infrastructure-foundation/competitive-analysis.md` 反映多模态核心；补 Day One 类多模态本地日记竞品；强化"唯一作品 + 用户拥有的 lock-in"作为 moat。
- Reo 后续任何会改变记忆空间文件合同、Memory Studio tab 模型、Home / Gallery 信息架构、Segment / SegmentSupplement 类型、Widget 形态或 agent 协作入口的 spec 必须核对本 ADR。

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

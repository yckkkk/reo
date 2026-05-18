# Reo 竞品分析

时间：2026-05-18 America/Los_Angeles

本文档评估 Reo 与同类产品的差异，识别可借鉴的设计、必须避开的陷阱和 Reo 真实壁垒位置。Reo 的产品本质判断见 `docs/decisions/0006-agent-native-carrier-and-generative-ui.md`；本分析为商业化轨道服务，不重复产品本质决策。

## Reo 的核心四件套

Reo 的产品本质由四个关键词同时约束，缺一不成立：

1. **围绕一件事** — Memory 主题容器，不是时间流、不是文件夹、不是项目管理
2. **所有材料** — 多模态：录音、视频、照片、笔记、上传文件平等存在
3. **agent 转化** — Codex-class agent 在用户完整 Memory 上生成、重构、创作
4. **只属于用户的作品** — 别人无法复制（材料是用户的），用户自己做不到（没 agent 替他做）

下面的三件套是上述核心的支撑结构：

1. **本地文件真源** — 服务"只属于用户的作品"中的"属于用户"
2. **Agent-native 协作能力** — 服务"agent 转化"
3. **极致交互气质（craft）** — 服务用户愿意持续回到 Memory 并把作品当成自己的

本分析按竞品是否同时满足这四件套排序。没有任何一个现有竞品同时满足。

## 竞品地图

| 竞品                         | 主题容器                     | 多模态                  | Agent 转化   | 唯一作品 | Reo 学什么 / 拒绝什么                                                                          |
| ---------------------------- | ---------------------------- | ----------------------- | ------------ | -------- | ---------------------------------------------------------------------------------------------- |
| Day One                      | △（chronological + journal） | ✓                       | ✗            | ✗        | 学：多模态本地日记 craft + on-this-day；拒：chronological-first、云端默认                      |
| Obsidian                     | ✓（vault / folder）          | △（文字优先）           | 部分（插件） | △        | 学：本地真源 + 插件生态；拒：插件市场作为唯一扩展、文字优先                                    |
| Flomo（浮墨）                | △（tag）                     | ✗（文字优先）           | 内置克制 AI  | ✗        | 学：每日回顾习惯 + founder voice + 微信生态 + 哲学一致性；拒：tag-only、云端 lock-in、文字优先 |
| Notion / Notion AI           | ✓（page tree）               | △（多媒体嵌入但非主体） | 内置 AI      | ✗        | 学：数据库视图心智；拒：云端、标准组件、缺 craft                                               |
| Mem.ai                       | △                            | ✗                       | 内置 AI      | ✗        | 学：纯 agent-native 难找 PMF 的教训                                                            |
| Cursor / Claude Code         | △（codebase）                | ✗                       | ✓            | △        | 学：agent-native UX 模式 + 在用户文件上操作；拒：开发者画像                                    |
| MindBack                     | ✗                            | ✓                       | 内置 AI      | ✗        | 学：低摩擦表达入口；拒：云端、移动优先、AI 回响                                                |
| Granola / Limitless / Rewind | ✗                            | △                       | 内置 AI      | ✗        | 学：被动捕获减少摩擦；拒：默认监听、隐私模糊                                                   |
| Tana / Logseq / Capacities   | ✓（node）                    | △                       | 结构化导出   | △        | 学：结构化语义层；拒：节点炸裂、心智负担                                                       |
| Apple Photos                 | ✗（chronological）           | ✓                       | ✗            | ✗        | 不是竞品，是 Reo 替代的现有工具之一（媒体存放）                                                |
| Voice Memos                  | ✗                            | ✗                       | ✗            | ✗        | 不是竞品，是 Reo 替代的现有工具之一（录音存放）                                                |

## 详细对比

### Day One（多模态本地日记 / 形态最接近 Reo）

**是什么**：Bloom Built 开发的多模态日记应用，已被 Automattic 收购。Mac / iOS / Android / Web 全平台，支持文字、照片、视频、音频、绘图、PDF、位置、天气、心情等多模态条目。组织依靠 journals（多个本地容器 + 标签 + 时间），有 on-this-day 自动推送过去同一天的条目。订阅会员制，强 craft（界面美感、动画、字体、模板都精心打磨）。

**和 Reo 形态重合（高度）**：

- 多模态条目作为一等公民
- 本地优先（早期纯本地，现在 E2E 加密云同步可选）
- 多个独立容器（journals）
- 沉浸式回顾（on-this-day 推送）
- 强 craft 投入
- prosumer 用户画像（写作者、学者、家长、长期记录爱好者）

**和 Reo 不重合（关键四点）**：

| 维度     | Day One                                | Reo                                          |
| -------- | -------------------------------------- | -------------------------------------------- |
| 组织轴   | chronological（按日期）+ journal + tag | topical（按主题 Memory）                     |
| Agent    | 无 agent，只有 AI 总结 / 标签建议      | Codex-class agent 在完整 Memory 上工作       |
| 输出     | 仅是日记条目本身，可导出 PDF           | agent 生成 widget / HTML 作品 / 跨模态走马灯 |
| 文件真源 | sqlite + media 文件 + 加密同步         | 普通本地 Markdown + 媒体文件，agent 可直接读 |

**Reo 学**：

1. **多模态 craft 标准**：Day One 在不同模态的呈现（文字阅读体验、照片画廊、视频播放、音频 player）做到了几乎全行业最好。Reo 的多模态 Segment 实现可以直接参考 Day One 的设计标准，不需要重新发明。
2. **on-this-day 回顾的价值**：Day One 的 on-this-day 推送是用户长期使用的关键粘性。Reo 的 Gallery 走马灯 + 回顾 skills 可以学这个机制，但做成跨模态沉浸 + 主题维度回顾（"我对 X 一年前的思考"），而不是纯时间维度。
3. **journal 容器心智**：Day One 的 journals 让用户接受"为不同主题开不同容器"的心智，证明 prosumer 用户能理解和欣赏这种结构。
4. **加密本地优先的可信叙事**：Day One 早期纯本地、后期 E2E 加密同步都积累了"你的数据是你的"的信任。Reo 的纯本地真源可以借鉴这层叙事但走得更彻底（不做云端真源）。

**Reo 拒**：

1. **chronological-first**：日记的时间组织对"积累成可创作素材"不友好。一个孩子的成长 Memory 应该是主题容器，时间维度只是其中一种视图。
2. **agent 缺位**：Day One 没有 agent 真正在你完整 journal 上工作。它的 AI 是单条目层面的辅助（自动标签、总结某条），不是 agent 在你三年的全部材料上生成成长册 HTML 这种事。这是 Day One 最大的天花板，也是 Reo 最大的差异空间。
3. **作品形态缺失**：Day One 的输出止步于日记条目本身和 PDF 导出。Reo 的输出是 widget / HTML / 跨模态走马灯，是"用日记当素材做出的作品"。
4. **云端同步默认**：Day One 后期默认走向云端 E2E，虽然加密但仍是云端 truth。Reo 不让步：本地是 truth，云端只能是同步层。

**真实差距与 Reo 风险**：

- Day One 已经服务 prosumer 多模态记录用户多年，建立了稳定习惯和心智。Reo 切这部分用户需要回答"为什么我要从已经用 5 年的 Day One 换到 Reo"，答案必须落在"主题容器 + agent 转化成作品"上——这是 Day One 没有的，但是用户教育成本高。
- Day One 的 craft 标准很高。Reo 在多模态实现上必须达到或超过 Day One 的水准，否则会被 Day One 用户感知为"差一截的小弟"。
- Day One 没做 agent-native 是因为它把自己定位为"日记"——这是它的 telos 限制，也是 Reo 的窗口。如果 Day One 发现自己能转向"agent 在你的日记上工作"，它的形态优势会让它快速威胁 Reo。Reo 必须在 Day One 看到这层之前建立 agent + skills 心智。

### Flomo（浮墨笔记 / 已发布全平台 / 中国 prosumer 市场标杆）

**是什么**：少楠 + 小欣的卡片笔记产品，定位"持续不断记录，意义自然浮现"。多渠道捕获：微信服务号、iOS / Android / Windows / macOS / Web 全平台 + API。组织依靠 tag（含父子 tag）而非文件夹；核心回顾机制是每次打开应用 / 桌面小部件 / 推送的随机旧笔记复现。订阅会员制，主打"隐私保护可持续商业模型"。已在中国 prosumer / PM / 知识工作者社群占据稳定心智，2025-2026 加入向量化 AI 后用户增长出现近年最积极信号。

**当前 AI 能力**（截至 2026 年）：

- **相关笔记**：基于向量化在已有卡片之间发现联系，启发新视角
- **找一找**：用问题挖掘过往笔记，寻找当下线索

少楠的 AI 哲学：AI 帮助在卡片上拥有 1000+ 维度，让用户发现卡片之间的联系；AI 不替代主动思考。Flomo 明确拒绝"快速总结外部长文、自动化信息提取、辅助润色草稿"这类替代思考的能力，理由是"主动思考是铁律"+ 成本控制。

**和 Reo 重合**：

- 中国 prosumer 知识工作者目标用户（重合度最高的一个）
- "持续记录 + 定期回顾"的核心循环（Reo P5 + 产品本质长期轨道的回顾 skills 与 Flomo 的随机推送 + 8 维度统计直接竞争）
- founder voice 作为信任基础（少楠的产品哲学公开输出已建立社群信任）
- 订阅会员而非广告 / 数据变现的商业模型
- 对 craft 的克制偏好（Flomo 极简 UI 是它的 craft 表现，虽然路径与 Reo 不同）

**和 Reo 不重合**：

- 云端真源 vs 本地真源
- 移动 + 微信优先 vs 桌面 studio 优先
- 文字优先 vs 录音 + 多模态优先
- tag 组织 vs Memory 容器组织
- AI 服务于"找已有"vs Reo agent 服务于"生成新"（widget / HTML Segment / 整理 / 引导更深表达）
- 没有 agent-native 协议层（用户无法让 Codex 直接操作 Flomo 数据）
- 没有 Gallery 走马灯类沉浸交互（Flomo 的"回顾"是单卡片推送，不是空间感）

**Reo 学**：

1. **每日回顾习惯 mechanics**：Flomo 已验证"每次打开都是一次回顾"+ 桌面小部件 + 微信推送的组合能建立长期使用习惯。Reo Day 1 的回顾 skills 应直接参考这个 pattern，不要重新发明。
2. **founder voice 作为分发**：少楠通过持续输出产品哲学（虎嗅访谈、知乎、个人 newsletter）建立了 Flomo 与他个人品牌的绑定。Reo 要打中同一群用户，创作者公开输出产品哲学是必经路径，不是可选项。
3. **AI 哲学一致性**：Flomo 拒绝主流 AI 功能（总结 / 润色）的姿态反而强化了用户信任。Reo 同样需要明确说"我们不做什么"——Reo 不做被动监听、不做 AI 自动整理、不做替代用户思考的 agent。
4. **API + 多平台 ecosystem 捕获**：Flomo 通过 API 与微信读书、得到等数十款产品联动捕获用户的多入口思考。Reo 的本地文件真源 + AGENTS.md 协议层是同一思路的另一种实现（agent 在文件层联动），但需要明确"Reo 多入口是 agent 协议层，不是平台插件市场"。

**Reo 拒**：

1. **Tag-only 组织**：Flomo 用户反馈最集中的痛点是"父子 tag 体系仍需优化"和"卡片无标题导致整理困难"。Reo 的 Memory 容器 + Segment / SegmentSupplement 主题结构是更重但更清晰的组织模型；Reo 不应该退化成 tag 流。
2. **云端 lock-in**：Flomo 的"易复制"弱点（已被印象笔记轻记复制）部分来自云端模型——没有文件真源就没有用户拥有感。Reo 不能为了同步便捷牺牲本地真源。
3. **桌面 afterthought**：Flomo 的桌面端是移动端的延伸。Reo 的 studio + Gallery 走马灯本来就只在桌面成立（移动屏不够走马灯沉浸）；Reo 不应该追 Flomo 的移动优先。
4. **AI 仅服务"找已有"**：Flomo 的 AI 哲学决定它不会做 widget 生成、HTML artifact、agent-自由创作。这是 Reo 真正的差异空间——同样的"主动思考"用户也想要 agent 帮他们做出可看可交互的产物，不只是更聪明的搜索。

**真实差距与 Reo 风险**：

- Flomo 已有数年用户网络效应。Reo 用户必须有迁移到 Reo 的具体理由，不能只靠"本地 + agent + craft"三件套口号。
- Flomo 的微信服务号捕获了中国用户最高频的输入入口。Reo 没有也不应该有微信集成（违反本地真源），所以 Reo 在"高频碎片捕获"赛道上必然输。Reo 的赢法只能是"深度 studio + agent 操作"在"低频但高价值"场景上胜出。
- Flomo 的 AI 增长信号说明"克制 AI 增强思考"路线已被市场验证。Reo 的 agent-first + generative UI 路线在哲学上比 Flomo 更激进，但需要证明用户真的想让 agent 帮他们生成 widget / HTML artifact，而不只是帮他们找已有卡片。
- 少楠的 founder voice 在中国 prosumer 社群中权重极高。Reo 创作者必须开始公开输出产品哲学（不能只在代码层建设），否则即使产品做出来也没有可信叙事载体。

### MindBack（你的 AI 记录伙伴 / 已发布 iOS + Android）

**是什么**：手机端 AI 记录流产品。文字、语音、图片、链接、文件混入聊天式 inbox，AI 提供回响、问一问、链接速览、热力图、月章、洞察卡片等服务。已在 App Store / 小米商店上线，迭代节奏快。

**和 Reo 重合**：都解决"碎片不知道放哪"，都把 AI 放在记录后的处理环节。

**和 Reo 不重合**：MindBack 是移动消费品，云端、AI 内嵌、聊天流 UI、组件全部官方。Reo 是桌面 prosumer、本地真源、外部 agent、Gallery 走马灯 + Memory Studio。两者目标用户分布几乎不重叠。

**Reo 学**：低摩擦表达入口（速度 dial、即时 finalize、自动归属当前 Memory）的体验启发。
**Reo 拒**：移动 inbox 第一入口、AI 回响 / 月章 / 热力图等表层 AI 功能、把 AI 包装成 chat 的产品形态。

**风险**：MindBack 用户评论已经出现"不能导出数据让我害怕"。这是 Reo 本地真源的天然优势，但 Reo 没有 MindBack 的分发和 AI 包装能力。Reo 必须用桌面 craft + agent 能力补足。

### Obsidian（已发布桌面 + 移动 / 闭源核心 + 开源生态）

**是什么**：本地文件夹（vault）+ Markdown 真源 + 插件市场。prosumer / 知识工作者的事实标准 PKM。

**和 Reo 重合**：本地文件真源、Markdown 语义层、用户拥有数据、Codex CLI 等外部 agent 可直接读取 vault。AGENTS.md 模式与 Obsidian 的 vault README 有同源精神。

**和 Reo 不重合**：Obsidian 没有 agent-first 协议层、没有 widget runtime、没有 craft 气质（默认 UI 偏极客）、没有录音 / Gallery 走马灯这类沉浸交互。Obsidian 的 AI 体验依赖插件，质量参差不齐。

**Reo 学**：vault = 文件夹的心智模型、外部工具协作开放性、prosumer 用户对配置的容忍度。
**Reo 拒**：插件市场作为唯一扩展路径（容易导致质量分散）、纯结构化笔记的心智负担、缺 craft 的默认 UI。

**风险**：Reo 的目标用户和 Obsidian 高度重叠。Obsidian 用户为什么换到 Reo，必须用三件套同时回答：agent-first 协议层（Obsidian 无）、Gallery 走马灯 craft（Obsidian 无）、录音 / 视频 / 多模态主链（Obsidian 不擅长）。

### Notion / Notion AI（已发布全平台 / 云端）

**是什么**：云端结构化笔记 + 数据库 + 工作空间。Notion AI 提供 Q&A、写作、总结，覆盖文档级别 AI。

**和 Reo 重合**：数据库视图（calendar / timeline / kanban）与 Reo widget 概念同源；Notion AI 的"基于你的内容生成"与 Reo agent 协作目标一致。

**和 Reo 不重合**：Notion 云端、组件官方标准化、no-local-truth、agent 协作通过 Notion AI 而非外部 agent、craft 气质偏企业协作而非个人沉浸。

**Reo 学**：数据库视图的心智模型对 widget runtime 设计有参考价值；Notion AI 在"基于上下文生成"的 prompt UX 已经成熟。
**Reo 拒**：云端真源、组件官方一统、AI 内置不开放给外部 agent、企业协作气质。

**风险**：Notion 是分发巨兽。当用户已有 Notion AI，他们换到 Reo 的理由必须是 Reo 三件套同时提供 Notion 永远无法做到的事。Reo 不该和 Notion 比"功能多少"，该比"agent 自由度 + 本地拥有 + craft 气质"。

### Mem.ai（已发布 / 收敛中）

**是什么**：早期 agent-native 个人记忆产品，纯 AI inbox + 自动整理。多次重塑产品方向，未找到稳定 PMF。

**和 Reo 重合**：agent-native 个人记忆是同一类愿景。

**和 Reo 不重合**：Mem.ai 云端、无本地真源、craft 气质偏极简但不沉浸、AI 内嵌而非外部 agent 协作。

**Reo 学**：纯 agent-native 不够，必须配合本地真源和 craft。Mem.ai 失败说明 prosumer 用户不会只因为 AI 整理而长期使用一个工具，必须有更深的拥有感（本地）和体验感（craft）。
**Reo 拒**：纯 AI inbox、自动整理作为唯一卖点、云端 lock-in。

### Cursor / Claude Code / Codex CLI（开发者 agent-native 工具）

**是什么**：agent-native 开发工作环境。Cursor / Claude Code 在 IDE 内提供 agent，Codex CLI 在终端内运行 agent。这些工具证明 agent-native 模式可行。

**和 Reo 重合**：agent-native 协议层（AGENTS.md / 项目级 skills / 文件操作）、本地文件真源、prompt-bridge 文化（用户对 agent 操作文件已有心智）。

**和 Reo 不重合**：目标用户是开发者，Reo 目标用户是 prosumer 知识工作者；产品形态是 IDE / 终端，Reo 是桌面 studio；UI 偏极客，Reo 要 craft 气质。

**Reo 学**：AGENTS.md 协议、skills 目录结构、agent 操作的 UX 反馈（如 diff 预览、回滚机制、操作日志）。
**Reo 拒**：极客 UI、IDE / 终端形态、开发者画像。

**风险**：这些工具就是 Reo 推荐用户用的外部 agent。Reo 的产品边界是"Reo 不假装是 agent，让 Codex / Claude Code 来做"。这个边界长期看是优势（不重造轮子），短期看是劣势（用户必须配置两个工具）。Reo 必须用 prompt-bridge 把"两个工具的协作摩擦"降到最低。

### Granola / Limitless / Rewind（被动捕获 + AI）

**是什么**：通过录音、屏幕监听或硬件持续被动捕获用户行为，AI 后置整理。Granola 偏会议、Rewind 偏屏幕、Limitless 偏 wearable。

**和 Reo 重合**：都使用 AI 处理捕获内容，都面向 prosumer 用户。

**和 Reo 不重合**：被动捕获 vs 主动表达。Reo 的核心动作是用户主动按下录音、主动新建 Memory；Granola / Rewind / Limitless 的核心动作是用户允许后台捕获。Reo studio 气质 vs 被动捕获的 surveillance 气质。

**Reo 学**：被动捕获在某些场景（会议）确实降低摩擦；Reo 长期可以加被动捕获作为可选输入源，但不作为核心。
**Reo 拒**：默认监听、隐私模糊、把"什么都记下来"当默认设置。这与 Reo 的"原始记忆不是资产"判断冲突——被动捕获产生的原始内容更不是资产。

### Tana / Logseq / Capacities（结构化 PKM）

**是什么**：以节点、supertag、属性为基础的结构化 PKM。Tana 偏企业 + 数据库，Logseq 偏 outliner + 本地，Capacities 偏 object-oriented。

**和 Reo 重合**：结构化语义层、本地可读、prosumer 用户、对 AI 整理有兴趣。

**和 Reo 不重合**：Tana / Logseq / Capacities 的核心是节点 / 块的结构化心智，需要用户学习 supertag、property、query 系统。Reo 的核心是 Memory / Segment 的主题容器心智，更轻量。这些工具没有 Gallery 走马灯、没有录音主链、没有 agent-first 协议层。

**Reo 学**：结构化元数据（frontmatter、object manifest）对 agent 操作的价值。
**Reo 拒**：节点炸裂、属性 / 标签心智负担、把 PKM 当目的而非手段。

**风险**：这群用户对 Reo 友好（他们已经接受 prosumer 工具），但他们也已经在结构化 PKM 上投入了大量学习成本。Reo 的进入策略不是说服他们迁移，而是定位为"录音 / 多模态主链 + agent-first 协议 + Gallery 沉浸"的互补工具。

### Apple Notes / Bear（消费级笔记）

**是什么**：苹果生态原生 / 第三方简洁笔记应用。Apple Notes 已加入 Apple Intelligence，Bear 偏 markdown 美感。

**和 Reo 重合**：克制美感、桌面 + 移动、本地优先（Apple Notes 部分 iCloud / Bear 本地）。

**和 Reo 不重合**：缺 agent 协作、无主题容器心智、无 widget runtime、无录音 studio 体验。

**Reo 学**：Bear 的 markdown 美感和克制 UI 对 craft 不变量有参考价值；Apple Notes 的"打开就能用"对引导设计有启发（但 Reo 不为零摩擦上手优化）。
**Reo 拒**：把 AI 当系统级附加功能、缺主题容器心智、文件真源 vs iCloud 的真源摇摆。

## Reo 独家 Agent Context 双层：AGENTS.md + users.md

在写壁垒位置之前先单独说一层：Reo 引入 **users.md** 作为 Workspace root 的用户个人 context 文件，agent 每次操作前与 AGENTS.md 一起读。这层是 Reo 独家：

| 工具                 | 项目 context                             | 用户个人 context                                       | Agent 输出个性化程度                                     |
| -------------------- | ---------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| Obsidian             | vault README（非协议）                   | 无统一层                                               | 取决于插件，无一致性                                     |
| Day One              | 无                                       | 无                                                     | 单条目级别 AI，无                                        |
| Flomo                | 无                                       | 无                                                     | tag 偏好作为弱信号                                       |
| Notion AI            | page tree 上下文                         | 无显性 user context                                    | 基于历史使用，云端不透明                                 |
| Cursor / Claude Code | AGENTS.md 协议                           | 部分（user rules）                                     | agent 行为可个性化但偏开发者                             |
| **Reo**              | **AGENTS.md（Workspace + Memory 两层）** | **users.md（Workspace level，未来扩展 Memory level）** | **同一个 skill 在不同用户 Workspace 上输出风格完全不同** |

users.md 服务"只属于用户的作品"承诺：因为 agent 知道用户是谁、想要什么、偏好什么，输出才真正属于用户而不是模板。这是 Reo 让"用户的材料 + agent = 唯一作品"成立的关键基础设施。

## Reo 独家 Skill 编排：原子 + use-xxx 双层

Reo skills 分两层：

- **原子 skill**：单一职责 prompt 模板，可 fork、可定制、可被 agent 复用
- **use-xxx 组合 skill**：use case 编排，告诉 agent 在 use case 流程下按何顺序调用原子 skill

关键判断：**skill 组合是 agent 的责任，不是用户的责任**。用户体验是"帮我做学习闭环"，不是"请你按 A → B → C 顺序运行三个 prompt"。

| 工具                 | Skill 形态              | 组合方式                                       |
| -------------------- | ----------------------- | ---------------------------------------------- |
| Flomo                | 6 张固定付费视角卡片    | 无组合                                         |
| Notion AI            | 内置 AI 功能集          | 内置流程，用户不可见不可改                     |
| Cursor / Claude Code | skills 协议             | skill 可调 skill，但偏开发者使用               |
| Mem.ai               | 内置 chat               | 无显性 skill                                   |
| **Reo**              | **原子 + use-xxx 双层** | **agent 自主编排原子 skill，用户无需理解组合** |

社区可以贡献新的 use-xxx skill 不破坏原子 skill 库。这是 Reo 的扩展性架构。

## Reo 真实壁垒位置

Reo 的真实壁垒不是"做了某个功能"，而是 **"四件套 + 持续 founder voice + 长期 craft 投入 + 用户拥有的 lock-in + AGENTS.md + users.md 双层 context + 原子 / use-xxx 双层 skill"** 同时存在。

| 壁垒来源                                             | 强度                                                   | 风险                                         |
| ---------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| 主题容器（Memory）作为组织轴                         | 中（Day One / Tana 部分有但不彻底）                    | 用户教育成本高，"为什么不是文件夹"需要回答   |
| 多模态平等存在                                       | 中（Day One 多模态最近似但 chronological）             | 实现量大，craft 标准要超过 Day One           |
| Agent-native 协议层                                  | 中（依赖外部 Codex-class agent 持续聪明）              | OS 内嵌 agent 长期可能侵蚀 prompt-bridge UX  |
| 本地文件真源                                         | 强（Obsidian / Day One 已证明 prosumer 接受）          | 不是独家，需要其他三件加成                   |
| Craft 气质（多模态 craft + Gallery 走马灯 + 场景感） | 强（需要持续投入，对手难以快速复制）                   | 投入慢，市场窗口期短                         |
| 四件套组合                                           | 极强（无任何竞品同时满足）                             | 难以一句话说清，用户教育成本高               |
| Founder voice + 产品哲学公开输出                     | Reo 当前未建立                                         | Flomo 已证明在中国 prosumer 市场这是必备条件 |
| 用户拥有的 lock-in（唯一作品 + 累积材料）            | 极强（越用越深，但不是平台 lock，是用户自身资产 lock） | 需要时间积累才显现，前期用户感知不到         |
| AGENTS.md + users.md 双层 agent context              | 强（Reo 独家，agent 知道项目也知道用户）               | 需要用户填写 users.md，前期可能空白          |
| 原子 skill + use-xxx 组合双层                        | 中（Reo 独家概念，对用户透明，组合是 agent 责任）      | 社区扩展依赖文档教育                         |

## 唯一作品作为最深 Moat

Reo 最深的护城河是 **agent 在用户长期累积的多模态主题材料上生成的作品具有不可复制性**：

- **其他工具 + AI** 也能生成内容，但用的是公共数据，输出不是你的，是同质的
- **同一个 agent + 别人的材料** 输出不一样，因为材料决定了输出
- **你的材料 + 没有 agent** 永远停在材料阶段，不会变成作品
- **你的材料 + 你自己** 没有时间做整理和创作

Reo 让 **"你的材料 + agent"** 这个组合成为可能。这个组合的输出是真正属于你的作品。

这层护城河随时间加深：用户在 Reo 累积越多，可生成的作品维度越多。迁移到任何其他工具都无法复制这层价值，因为没有任何其他工具能在用户完整跨模态主题容器上让 agent 工作。这是真正的 lock-in，但是是基于用户拥有的 lock-in，不是基于平台扣留的 lock-in——用户可以随时把全部文件带走，但带走后无法在别处获得同等的 agent + 材料组合。

这个 moat 对外叙事可以是：

> 你在 Reo 累积一年的材料生成的作品，全世界只有你能做出来。换任何其他工具都做不到。但你随时可以把文件带走，Reo 不绑你。

详细论证见 `positioning.md` 的"唯一性 Moat"段。

## Flomo 教给 Reo 的关键观察

把 Flomo 加进竞品地图后，几个判断变得更清晰：

1. **三件套是必要条件，不是充分条件**。Flomo 没有任何一件套，但靠每日回顾习惯 + founder voice + 微信生态 + 哲学一致性在中国 prosumer 市场占据稳定心智。Reo 不能假设"我有三件套所以我赢"，必须同时建设习惯机制、创作者公开输出、产品哲学一致性。
2. **回顾机制不是 P5 可选能力，是核心粘性**。Flomo 的随机推送 + 桌面小部件 + 8 维度统计是它能让用户长期回来的根本原因。Reo 的 P5 Review 和产品本质长期轨道的回顾 skills 应该被重新评估优先级——这是粘性核心，不是 nice-to-have。
3. **AI 哲学比 AI 功能更重要**。Flomo 明确说"我们不做总结、不做润色"反而强化用户信任。Reo 也必须明确说"我们不做什么"：不做被动监听、不做 AI 自动整理、不做替代用户思考的 chatbot、不做云端真源、不做声音复刻类创作工具能力、不做移动碎片捕获入口。这些"拒绝"是产品哲学的承重墙。
4. **高频捕获赛道已被 Flomo 占据**。Reo 不应该尝试做"随时随地碎片记录"，那条路被 Flomo + 微信生态封死了。Reo 的赢法是"低频但高价值场景"：深度访谈、播客录制、研究记录、创作素材、长形思考——这些场景天然适合桌面 + studio + agent 协作。
5. **founder voice 是分发**。在中国 prosumer 市场，少楠通过持续公开输出建立了 Flomo 的可信叙事。Reo 创作者必须开始建立同样的输出节奏（产品哲学博客 / 知乎 / 视频），否则即使产品做出来也没有传播载体。这不是营销动作，是产品的一部分。

## Skills > 付费 AI：Reo 的对外第一句

Flomo "Insight perspective" 面板包含 6 张付费视角卡片（默认洞察、价值澄清、逆向思考、二阶思考、CBT 疗法、MBTI 分析），每张限定"1 条笔记 / 2 标签 / 1 天"范围。背后本质是固定 prompt 用付费 + 配额方式售卖。

Reo 的等价能力是 skills：

| 维度     | Flomo 视角                     | Reo skills                                                             |
| -------- | ------------------------------ | ---------------------------------------------------------------------- |
| 形态     | 闭源固定 prompt                | 仓库内 markdown 源文件                                                 |
| 成本承担 | Flomo 承担推理成本，转嫁会员费 | 用户用自己 Codex / Claude credits                                      |
| 范围限制 | 条数 / 标签 / 时间窗           | 无限制，可跨 Memory 跨 Workspace                                       |
| 定制     | 用户不能改 prompt              | 用户可 fork / 改 / 扩展 / 跨场景复用                                   |
| 输出     | 单次文本                       | agent 可写回文件、生成 widget、生成 HTML Segment、引导用户做下一步表达 |
| 社群扩展 | 官方上新 + @shaonan 等少数作者 | 任意用户分享 skills，类似 npm / GitHub 模式                            |

这层不是营销说法，是结构性优势。Reo 的对外第一句叙事应该是：

> **你带模型，Reo 给你 prompts 模板 + 文件结构 + 操作入口。Flomo 付费的 AI 视角，在 Reo 都是 skills 自定义免费。**

这一句比"三件套护城河"更直接、更易懂、更可对照、prosumer 用户秒懂。三件套（本地真源 + agent-native + craft）作为支撑结构，回答"为什么 Reo 能做到 unbundle 而 Flomo 做不到"。

### Day 1 starter skills 利用 Flomo 已验证的范式

Flomo 视角背后的 prompts 都来自公开领域成熟方法：

- **默认洞察 / 价值澄清 / 二阶思考 / 逆向思考**：思考视角类，方法来自芒格、Howard Marks、价值哲学等长期稳定知识。建议作为 Reo Day 1 出厂 starter skills。
- **CBT 疗法 / MBTI 分析**：领域专业类，CBT 涉及临床心理学边界，MBTI 涉及商业授权风险。建议不出厂，仅以"可 fork 示例"在文档中提及，用户自决。

加上 Reo 原本的引导 / 回顾 / 整理总结 / widget 生成四类基础 skills，Day 1 出厂 8 个 skills 起步，覆盖捕获 → 引导深化 → 回顾 → 整理 → 思考视角 → 创作生成完整循环。

### Reo 的拒绝清单（用 Flomo 哲学一致性 mirror）

Reo 通过对外明确说"我们不做什么"强化产品信任：

- 不做被动监听、不做后台屏幕捕获
- 不做 AI 自动整理 / 自动生成（agent 操作必须用户触发）
- 不做替代用户思考的 chatbot
- 不做云端真源（本地文件真源不可让步）
- 不做声音复刻类创作工具能力（属于创作工具不属于记忆 studio，且有 IP 风险）
- 不做移动碎片捕获入口（包括微信、系统通知、widget 快记）
- 不做平台强制绑定第三方模型（用户自选 agent）

## 短期决策建议

1. **多模态实现的 craft 标准对标 Day One**。Day One 是行业内多模态本地体验最高标杆。Reo 的 photo Segment / video Segment / note Segment 实现必须达到或超过 Day One 的水准，否则会被 Day One 用户感知为"差一截的小弟"。但 Reo 在主题容器和 agent 转化上比 Day One 多两个维度——必须用这两个维度回答"为什么我要从 Day One 换到 Reo"。
2. **不要追 MindBack 的功能面**。回响 / 月章 / 热力图 / AI 个性化都是移动消费品打法，Reo 的 craft 投入应给 Gallery 走马灯 / 多模态 craft / widget 渲染。
3. **不要追 Notion AI 的能力广度**。Notion 已经在那条赛道上，Reo 在那条赛道上没有壁垒。Reo 应在"主题容器 + 多模态 + agent 转化成唯一作品"这条独家赛道上跑。
4. **不要追 Flomo 的高频捕获**。微信生态 + 移动碎片捕获是 Flomo 的护城河。Reo 应该明确选择"低频高价值场景"作为入口：写一本书、养一个孩子、做一项研究、维护一段关系、记录一段旅程。这反过来让 Reo 不需要做微信集成，不需要做移动优先，可以集中投入桌面 craft 与 agent 能力。
5. **把 Obsidian / Flomo / Day One 同时当主对照**。Reo 用户最可能从这三个产品来。对比叙事必须诚实回答三个问题：（a）为什么我要从 Obsidian 切到 Reo（答案在多模态 + agent 转化 + craft）；（b）为什么我要在 Flomo 之外再用 Reo（答案在深度场景 + 多模态 + 本地真源 + agent 生成）；（c）为什么我要从 Day One 换到 Reo（答案在主题容器 + agent 转化成作品）。
6. **把回顾 mechanics 提到产品本质长期轨道前排**。Flomo + Day One 数据都证明这是长期粘性核心。具体形态参考 Day One 的 on-this-day + Flomo 的随机推送，但 Reo 应当用 widget runtime 和 Gallery 走马灯做成跨模态沉浸式回顾。
7. **认领 prompt-bridge 的过渡性**。用户已经接受外部 agent 是当前最聪明的工具；把 prompt-bridge 描述为"现在最聪明的协作方式 + 未来无重构演化路径"。
8. **拒绝被动捕获、声音复刻、移动碎片**。这些与 Reo 的"主题容器 + agent 转化成作品 + 用户拥有"判断冲突，且会模糊产品定位。
9. **创作者必须开始公开输出产品哲学**。这不是营销动作，是 Flomo 已经证明的中国 prosumer 市场必备条件。建议从"为什么 Reo 的 Memory 不是日记"、"为什么 agent 应该在你完整的材料上工作"、"唯一作品的 moat 是什么"开始输出。

## 后续

本文档进入商业化基础设施 initiative。当 Reo 出现新竞品、或现有竞品出现影响差异化叙事的变化时，更新本文档对应小节。重大判断（如某竞品威胁到三件套之一，或新的市场观察改变战略）需要触发 ADR 0006 复审。

## 参考

- flomoapp.com 官方站点
- flomo 101 用户文档：https://help.flomoapp.com/
- 虎嗅访谈少楠（flomo 与 AI）：https://m.huxiu.com/article/3752857.html
- 重新思考·别再用复杂标签折磨自己了：https://www.noesisapient.com/p/flomo-tag
- 腾讯新闻·当所有人都在追风口，flomo 却靠这三点赢得了真正用户：https://news.qq.com/rain/a/20250509A05UES00
- 知乎·如何评价 flomo：https://www.zhihu.com/question/456695454
- 灵感收集工具评测：https://www.cnblogs.com/uni112/p/16422858.html

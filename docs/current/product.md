# 产品基线

本文档是 Reo 产品定位、核心体验和页面模型的当前真源。

## 定位

**Reo 的产品本质：让用户围绕一件事产生的所有材料，被 agent 转化成只属于用户的作品的私人空间。**

四个关键词同时成立才是 Reo：围绕一件事（Memory 主题容器）+ 所有材料（多模态）+ agent 转化（不是存储 / 检索）+ 只属于用户的作品（唯一性 moat）。

Reo 不是单纯录音工具，不是文件管理器，不是 AI 记录 app，不是聊天助手，不是单一模态工具——录音、视频、照片、笔记、外部导入文件、agent 生成的 widget 和 HTML 产物都平等进入同一个 Workspace → Memory → Segment → SegmentSupplement 与 Workspace → Widget 的对象图。

一个 Workspace 是用户选择的本地记忆空间。一个 Memory 是主题容器，负责按主题聚合跨模态材料。一个 Segment 是 Memory 内的主体记录，负责承载一次具体记录（任意模态）。一个 SegmentSupplement 是围绕某个 Segment 的补充内容，负责延展上下文（任意模态）。Widget 是 agent 根据用户需求生成的可交互定制面板，是 Workspace / Memory 的兄弟级实体，不是 Segment 的子类。

产品本质长期决策见 `docs/decisions/0006-agent-native-carrier-and-generative-ui.md`，外向定位叙事与电梯演讲见 `docs/initiatives/2026-05-14-commercial-infrastructure-foundation/positioning.md`。

## 用户场景

Reo 的价值在跨模态主题容器中长期成立。典型 Memory 形态：

- **一本书的写作**：访谈录音、写作时的思考流录音、用户测试视频、白板照片、章节笔记、参考论文 PDF → agent 生成章节大纲 widget、引言库 HTML、章节草稿
- **一个孩子的成长**：成长瞬间录音 / 视频、每周照片、教育判断笔记、医生 / 学校文档 → agent 生成成长册 HTML、性格特征 widget、走马灯回顾
- **一个学习领域**：实时反应录音、关键讲座视频、讲义照片、结构化笔记、论文 → agent 生成概念时间线 widget、学习卡 HTML、按记忆曲线回顾
- **一段关系**：重要对话录音、共同时刻视频 / 照片、情绪笔记、共享文档截图 → agent 生成关系曲线 widget、共同时刻走马灯
- **一次旅程**：路上反思录音、关键场景视频、风景 / 食物照片、行前与实时笔记、机票 / 住宿 → agent 生成游记 HTML、时间线 widget

完整场景与电梯演讲见 `docs/initiatives/2026-05-14-commercial-infrastructure-foundation/positioning.md`。

Workspace 是用户选择的文件空间根；Memory、Segment 和 SegmentSupplement 是用户内容文件空间节点：稳定 id 负责身份，文件夹名称负责用户可见命名，Markdown/frontmatter 承载语义镜像，`.reo/objects/*` manifest 承载技术完整性。用户在文件管理器里直接重命名合法内容节点后，Reo 重新读取时按文件夹名称投影 UI；用户重命名 Workspace root 后，Reo 通过 stable workspaceId 重新定位已导入记忆空间。

当前已实现的 Segment 类型是 `audio`；当前已实现的 SegmentSupplement 类型是 `audio` 录音补充。`note`、`photo`、`video`、`imported_file`、`html` 和其他 Segment / SegmentSupplement 类型进入 runtime 前必须先定义文件合同、IPC contract、查询更新和恢复路径。Widget runtime 与 Gallery 走马灯渲染同样需要独立 spec 才能进入 runtime。**Reo 完整产品形态需要多模态 Segment 类型全部实现**；当前 audio 单模态是 enabling phase，不是 Reo 终局形态。

Reo 的核心目标是让 agent 与用户共同围绕主题积累跨模态材料，并把材料转化成只属于用户的作品。用户负责表达、思考、判断，agent 负责筛选、整理、深化、生成、引导用户用最合适的模态做下一步补充（补录音 / 拍照 / 写笔记 / 上传文件）。原始材料不被假设为资产，价值在 agent 与用户共同筛选、深化、转化成作品之后才出现。SegmentSupplement 既是用户主动的多模态补充，也是 agent 引导更深表达的载体。

Reo 的目标用户是有持续主题关注的 prosumer 创作者与思考者：Obsidian 用户、专业写作者、研究者、podcasters / video essayists、深度学习者、parent journalers、有强烈记录欲的领域专家。Reo 不为零摩擦上手优化。Reo 允许并预期用户理解记忆空间是本地文件夹、自行配置 ASR / agent 凭证、通过 Entity More 菜单复制 prompt 到外部 agent。

## 产品气质

Reo 是安静、克制、柔和的私人表达工作室。用户打开 Reo 的第一印象不应是管理、协作、数据库、项目推进或效率压迫，而应是一个可以慢慢说话、慢慢回想、慢慢沉淀自己的空间。

Reo 的美感来自对注意力的尊重：本地优先带来安全感，agent-native 带来未来感，留白带来呼吸感，Memory 与 Segment 的生长关系带来生命感，Gallery 走马灯带来沉浸感。产品 UI 使用 Soft Flat Design System：纯净画布、低对比灰度填充、大圆角、克制动效、真实音频波形和少量高饱和品牌色。界面不用同平面描边、基础阴影、装饰性渐变或伪媒体制造完成感。

极致交互气质是 Reo 产品不变量。录音 / 播放 / 转录的场景感、Memory Studio 的节奏、Gallery 走马灯的视觉听觉节奏、widget 渲染一致性、prompt-bridge 操作反馈细节都必须过 craft 门槛；任何拼凑、敷衍或"先做能用版本"的功能不能进入主链，必要时先不做或留在 spec 中作为已知 gap。

## 非目标

为强化产品哲学一致性与目标用户聚焦，以下方向不进 Reo 主线，不在 runtime、roadmap、ADR 中作为产品能力出现：

- **被动监听、后台屏幕捕获**：与 Reo studio 主动表达气质冲突，与"原始记忆不是资产"判断冲突。Reo 不做 Granola / Limitless / Rewind 类被动捕获。
- **AI 自动整理 / 自动生成**：所有 agent 操作必须用户触发；Reo 不假装是自动化助手。
- **替代用户思考的 chatbot**：Reo 强化用户主动思考，不做"问我任何问题"式 AI 伙伴。
- **云端真源**：本地文件真源不可让步；云端只能是同步层 / 服务层，不替代用户记忆内容真源。
- **声音复刻类创作工具能力**：属于创作工具不属于记忆 studio，目标用户偏移，且有 IP / 监管风险。如用户需要，可外部工具加工 Reo 导出的录音。
- **移动碎片捕获入口**：包括独立移动 app、微信服务号、系统通知 / widget 快记。Reo 的赢法是低频高价值场景（深度访谈、播客录制、研究记录、创作素材、长形思考），不是高频碎片捕获。微信 + 移动碎片赛道已被 Flomo / MindBack 占据，Reo 不进入。
- **平台强制绑定第三方模型**：Reo 不预设特定模型供应商；用户用自己 Codex / Claude credits 通过 prompt-bridge 操作。如未来 Reo 内嵌 AI runtime 需要选择供应商，需要独立 ADR 决定。

完整非目标判断与产品本质决策见 `docs/decisions/0006-agent-native-carrier-and-generative-ui.md`。

## 当前页面模型

AppShell 顶层入口为 Home、Gallery 和当前 Loaded Workspace。

### Home

Home 当前是全局入口 shell。它提供进入记忆空间、Gallery 和创建或打开 Workspace 的入口，不承载 Workspace 内的 Memory 导航。Home 是 Workspace-level widget 的承载页之一。

### Gallery

Gallery 是 Workspace 级别独立页面，承载跨 Memory 的沉浸式回顾和清晰信息呈现。Gallery 内部两个 tab：

- **走马灯艺术 tab**：沉浸式记忆走马灯，记忆片段的录音 / 视频 / 图片以视觉听觉节奏感呈现和消失。走马灯艺术 tab 是 craft 不变量的核心承担页之一。
- **列表 tab**：跨 Memory 的清晰信息呈现，承担资料库式的清单查阅职责。

Gallery 当前不是 runtime surface。落地由独立 spec 处理；本节只记录信息架构定位。

### Loaded Workspace

Loaded Workspace 使用三面板结构：

- 左侧 AppShell sidebar：全局导航和 Workspace 列表，保持当前入口，不承载当前 Workspace 内的 Memory 导航。
- 中间 Workspace Stage：默认表达舞台。未选中 Memory 时只表达“今天想记录些什么？”，不显示 workspace feed、全局时间线或文件流。
- 右侧 Memory rail：当前 Workspace 的 Memory 容器列表，用于在 Memory 之间切换，不展示单个 Segment 详情。

当前 Workspace 标题显示在 AppShell panel titlebar。右上角 icon-only control 控制 Memory rail 折叠和展开；`新建记忆` icon-only control 先打开命名弹层，创建成功后才产生 Memory。

## 核心层级

- Workspace 层级：当前本地记忆空间，右侧 Memory rail 展示这个空间里的所有 Memory。
- Memory 层级：主题容器。选中 Memory 后只切换当前 Workspace Stage 的当前 Memory context；当前 runtime 不进入单独详情 route。
- Segment 层级：Memory 内的主体记录。当前 runtime 只实现 `audio` Segment；Memory 的 Segment 关系来自该 Memory 目录下合法 finalized Segment 文件空间节点、`segment.md` 和 `.reo/objects/segments/<segmentId>.json` manifest。
- SegmentSupplement 层级：围绕某个 Segment 的补充内容。当前 Memory Studio 的 selected Segment `+` 菜单只暴露录音补充项；录音补充写入 selected Segment 的 supplement，不进入 Memory 顶层 Segment strip。

中间面板的横向片段时间线只属于当前选中的 Memory。它不能表示整个 Workspace 的全部内容，也不能演变成 workspace feed、日志流、文件流或社交动态流。

## 当前表达入口

底部 Floating Action Button Speed Dial 是 Workspace Stage 的表达入口。当前唯一可执行 action 是录音。note、photo、video 和 imported_file 只保留不可用的 icon-only action 位置，用于表达已接受的信息架构，不触发 runtime surface。

录音流程使用浏览器 `MediaRecorder` 和 `getUserMedia` 的薄 adapter。Renderer 先通过 IPC 获得一次性 microphone intent，再请求 audio-only media stream。音频 chunk 通过 IPC 串行写入 main process 的 durable draft；stop 必须等待 MediaRecorder 最后的 `dataavailable` chunk 完成后再 finalize。

点击 Workspace Stage 的录音优先使用当前 Memory context，并把录音 finalize 显式归属到该 Memory。只有当前 Workspace 没有任何 Memory、也没有可选当前 Memory 时，录音入口才先进入新建 Memory 命名流程，创建成功后再进入录音流程。

## 当前 Memory Context

当前点击右侧 Memory rail 只切换 loaded workspace frame 内的当前 Memory context，不进入独立详情 route。Memory rail 按 Memory 投影更新时间倒序排列，新增 Segment、保存转写或给 Segment 新增补充都会让相关 Memory 更新位置；重命名只改变可见名称，不改变 activity 排序。AppShell panel titlebar 的 Breadcrumb 显示当前记忆空间标题；选中 Memory 后 Breadcrumb 增加当前 Memory 标题。两个标题都提供统一 Entity More 菜单，支持用默认应用打开、在访达中显示、复制路径、重命名和移除或删除；titlebar 不显示额外下拉图标，两层之间只显示圆点 separator。

选中 Memory 后中间区域显示 Memory Studio：空态、该 Memory 内按投影更新时间倒序排列的 finalized audio Segment 横向预览流、横向浏览按钮、时间轴、当前片段内容区、本地音频播放、已保存 transcript、动态内容 tab 和 SegmentSupplement `+` 菜单。Memory Studio 不重复显示 Memory title、片段数量或总时长 meta。

Segment 选择只在当前 Memory 内同步 card、时间轴点、播放区、内容 tab 和内容区；普通录音完成后新 finalized audio Segment 以 `录音N` 命名，立即进入当前 Memory 的横向预览流并成为 selected Segment。横向浏览按钮只滚动 Segment 预览流，不改变当前 Segment。

Segment card、时间轴圆点和时间标签属于同一个横向 scroll item，圆点和时间固定在对应卡片下方居中，并随 Segment strip 横向滚动；时间标签显示该 Segment 的创建时间，不显示片段时长。播放区 waveform 从 selected finalized audio Segment 的真实音频 bytes 解码峰值生成，音频无法解码时不展示固定占位波形。

selected Segment 存在 finalized SegmentSupplement 时，每个 SegmentSupplement 作为独立内容 tab 出现在 `转录` 旁边；tab 上显示 supplement title 和类型 icon，内容区不重复显示标题或创建时间。同一 selected Segment 出现新补充录音时，Memory Studio 自动切到新 supplement tab 让新内容可见。补充录音在自己的 tab panel 内使用与主播放条一致的播放按钮、真实 waveform slider 和等宽时间，并在播放行下方展示该 supplement 自身 transcript、空态、失败重试态或生成中状态。

Memory Studio 只读取当前 Memory detail、selected Segment content 和 selected SegmentSupplement audio content，不聚合整个 Workspace。右侧 Memory rail 默认折叠并退出可访问树；用户手动展开后，宽视口使用 inline 模式，WorkspaceFrame 的第二条 grid 轨道从 `0px` 展开到 `240px`，中央舞台和底部 FAB 保持对称横向 padding；compact workspace 宽度下使用 overlay 模式，不挤压 Memory Studio 主体验。

Memory rail 宽度收敛到 `240px`，列表 surface 使用全高 `bg-background` 并与主内容区保持同一画布填充；rail shell 使用 `border-l border-secondary` 标记主内容和右侧记忆列表的跨区域边界。MemoryRail memory item 使用 `bg-card` 表达常态卡片、`bg-secondary` 表达 hover 和当前状态，当前 Memory 同时保留 `aria-current`；不靠边框或阴影表达层级。

Memory Studio 必须是首屏可理解的 studio surface：Segment card、timeline、playback、tab 和 transcript 不靠页面纵向滚动才能看完整主体验；中间舞台、播放器和内容区在窄视口内保持在 panel 内，Segment strip 只在自身横向滚动，不制造页面级横向滚动。

Audio Segment card 使用紧凑正方形比例、无描边纯填充、`rounded-xl`、标题直入、静态 waveform bars 和 mono duration。卡片用 `bg-card` 或透明表达常态、`bg-secondary` 表达选中；浅色模式下卡片比页面更灰，深色模式下卡片比页面更亮，不用边框或阴影制造层级。卡片不展示 `一个补充`、`已有转录` 或 `本地音频` 这类状态标签。卡片 More 入口只在 hover、focus 或菜单打开时显示，并提供用默认应用打开、在访达中显示、复制路径、生成转录或重新生成转录、片段重命名和片段删除。

当前 Memory Studio 不是完整详情页。内容 tab rail 只展示 selected Segment 已存在的内容入口；audio Segment 始终有 `转录` tab，finalized SegmentSupplement 按真实投影作为独立 tab 出现，笔记、视频和图片不会作为常驻禁用 tab 出现。SegmentSupplement tab 用 active pill 表达当前选择；More 是 tab 的 sibling 操作入口，只在 tab hover 或 More 自身键盘 focus-visible 时展开，鼠标移开后收起视觉状态，不能因为 tab active 或 DropdownMenu open 而常驻展开；active 只让当前 More 可以进入键盘路径。tab pill 和 More reveal 使用 400ms `cubic-bezier(0.2, 0.9, 0.1, 1)`，内容 panel 切换使用 300ms 同曲线，DropdownMenu 使用 150ms 进入动效。当前 More 菜单提供用默认应用打开、在访达中显示、复制路径、生成转录或重新生成转录、重命名和删除。内容 tab rail 支持当前会话内 drag/drop 重排，`转录` 和补充 tab 都可移动；该顺序不持久化，不创建假 schema 或假 IPC。`+` 菜单显示录音补充项并以 `补充录音N` 命名，写入 selected Segment supplement，不新建 Memory，也不创建同级 Segment。

Memory 删除是当前 Memory 容器的危险操作。用户只能从 Memory rail 的 More 菜单进入删除确认；确认后 main process 按 `.reo/objects/memories/<memoryId>.json` 找到当前 Memory 目录并移入 `.reo/trash/memories/`，再刷新 Workspace snapshot。删除成功后 renderer 移除该 Memory 的 detail cache，若当前 Memory 被删除则切换到剩余第一条 Memory 或回到 Workspace Stage，并通过 toast 提供本次恢复动作。恢复只把同一 `restoreToken` 对应的 Memory 从恢复区移回 active memories，不恢复为 Segment 或 SegmentSupplement，也不暴露本地路径。

Segment 删除是当前 Memory Studio 内 audio Segment 的危险操作。用户只能从 Segment card 的 More 菜单进入删除确认；确认后 renderer 立即从当前 Memory Studio 移除该 Segment，当前选中项回到剩余 Segment 或空态，并显示带进度条的可撤销 toast。Segment 删除 toast 使用统一 toast surface，`恢复` 是带 icon+文字和 hover 状态的 action；倒计时为 10 秒。用户在 toast 关闭前点击 `恢复` 时，Segment 直接回到当前 Memory Studio 并重新选中，不触发后端恢复请求。toast 自动关闭后，main process 才按 `.reo/objects/segments/<segmentId>.json` 找到当前 Memory 下的 Segment 目录并移入 `.reo/trash/segments/`，其 `supplements/` 子树随 Segment 一起进入恢复区。删除或撤销过程不暴露本地路径。

SegmentSupplement 删除是当前 Memory Studio 内容 tab 的危险操作。用户只能从对应 supplement tab 的 More 菜单进入删除确认；确认后 main process 把真实 supplement 目录移入 `.reo/trash/supplements/`，保留音频、转录和 manifest，并刷新父 Memory 的 supplementCount。删除成功后该 supplement tab 从 selected Segment 的 tab rail 消失，若当前正选中它则回到 `转录`；toast 提供可见 `恢复` action，把同一 supplement 目录移回 parent Segment `supplements/` 下。恢复要求 parent Memory 和 parent Segment 仍存在；parent missing 时 trash 保持可恢复。若删除或恢复已经移动文件但投影刷新失败，UI 保持与文件真源一致的删除或恢复投影并显示错误。删除和恢复都不暴露本地路径。

## Agent 边界

当前不实现 Reo runtime 内嵌的 AI chat、tool use、自动整理或 AI side effects。Reo 自身不调用任何远程 AI 服务（语音设置中的 ASR 凭证除外，见 `decisions/0004-doubao-voice-asr-endpoint-baseline.md`）。

当前 agent 协作通过外部 Codex-class agent + 文件真源 + prompt-bridge 入口实现：

- 记忆空间 root 的 `AGENTS.md` 描述记忆空间目的、文件结构、Reo 管理路径和 agent 协作规则；Reo 不覆盖已有 `AGENTS.md`。
- Workspace、Memory、Segment、SegmentSupplement 与未来 Widget 的 Entity More 菜单计划挂统一 `agent 操作 ▸` 子菜单。每条菜单项点击后把带上下文的 prompt 复制到剪贴板，用户粘贴到 Codex CLI / Codex Web 让 agent 操作 Reo 文件。
- 默认 skills 涵盖引导、回顾（结合记忆曲线）、整理总结、widget 生成四类；widget example 在 widget 生成 skills 中维护。

Prompt-bridge UI、AGENTS.md 模板、skills 目录、widget runtime 当前都不是 runtime surface；本节只确立产品边界和入口形态，具体落地由独立 spec 处理。

Agent-ready 的当前验证方式是本地文件结构、`AGENTS.md`、Memory metadata、audio segment 和已保存 transcript 可以被外部 Codex-class agent 读取并理解。

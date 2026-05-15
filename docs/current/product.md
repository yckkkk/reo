# 产品基线

本文档是 Reo 产品定位、核心体验和页面模型的当前真源。

## 定位

Reo 是本地优先的 AI-ready 记忆空间。它不是单纯录音工具，也不是文件管理器；录音、笔记、照片、视频和外部导入文件都进入同一个 Workspace -> Memory -> Segment -> SegmentAttachment 模型。

一个 Workspace 是用户选择的本地记忆空间。一个 Memory 是主题容器，负责组织。一个 Segment 是 Memory 内的主体记录，负责承载一次具体记录。一个 SegmentAttachment 是围绕某个 Segment 的补充内容，负责延展上下文。

Workspace 是用户选择的文件空间根；Memory、Segment 和 SegmentAttachment 是用户内容文件空间节点：稳定 id 负责身份，文件夹名称负责用户可见命名，Reo 的 metadata 是可检查镜像。用户在文件管理器里直接重命名合法内容节点后，Reo 重新读取时按文件夹名称投影 UI；用户重命名 Workspace root 后，Reo 通过 stable workspaceId 重新定位已导入记忆空间。

当前已实现的 Segment 类型是 `audio`；当前已实现的 SegmentAttachment 类型是 `audio` 录音补充。`note`、`photo`、`video`、`imported_file` 和其他 SegmentAttachment 类型进入 runtime 前必须先定义文件合同、IPC contract、查询更新和恢复路径。

Reo 的核心目标是降低表达阻力，让用户更愿意记录、回看、继续补充，并让这些记忆保持用户拥有、可迁移、AI-readable。

## 产品气质

Reo 是安静、克制、柔和的私人表达工作室。用户打开 Reo 的第一印象不应是管理、协作、数据库、项目推进、效率压迫或粗糙 MVP，而应是一个可以慢慢说话、慢慢回想、慢慢沉淀自己的空间。

Reo 的美感来自对注意力的尊重：本地优先带来安全感，AI-ready 带来未来感，留白带来呼吸感，Memory 与 Segment 的生长关系带来生命感。产品 UI 使用 Soft Flat Design System：纯净画布、低对比灰度填充、大圆角、克制动效、真实音频波形和少量高饱和品牌色。界面不用同平面描边、基础阴影、装饰性渐变或伪媒体制造完成感。

## 当前页面模型

### Home

Home 当前是全局入口 shell。它提供进入记忆空间、资料库和创建或打开 Workspace 的入口，不承载 Workspace 内的 Memory 导航。

### Library

Library 当前是资料库占位入口。它只显示资料库页面标题，不展示 Memory、Segment 或 Workspace 管理内容。Workspace 创建、打开、切换和移除当前由 AppShell sidebar 的记忆空间列表承担。

### Loaded Workspace

Loaded Workspace 使用三面板结构：

- 左侧 AppShell sidebar：全局导航和 Workspace 列表，保持当前入口，不承载当前 Workspace 内的 Memory 导航。
- 中间 Workspace Stage：默认表达舞台。未选中 Memory 时只表达“今天想记录些什么？”，不显示 workspace feed、全局时间线或文件流。
- 右侧 Memory rail：当前 Workspace 的 Memory 容器列表，用于在 Memory 之间切换，不展示单个 Segment 详情。

当前 Workspace 标题显示在 AppShell panel titlebar。右上角 icon-only control 控制 Memory rail 折叠和展开；`新建记忆` icon-only control 先打开命名弹层，创建成功后才产生 Memory。

## 核心层级

- Workspace 层级：当前本地记忆空间，右侧 Memory rail 展示这个空间里的所有 Memory。
- Memory 层级：主题容器。选中 Memory 后只切换当前 Workspace Stage 的当前 Memory context；当前 runtime 不进入单独详情 route。
- Segment 层级：Memory 内的主体记录。当前 runtime 只实现 `audio` Segment；Memory 的 Segment 关系来自该 Memory 目录下合法 finalized Segment 文件空间节点，`memory.json.segmentIds` 只是可重建 mirror。
- SegmentAttachment 层级：围绕某个 Segment 的补充内容。当前 Memory Studio 的 selected Segment `+` 菜单只暴露录音补充项；录音补充写入 selected Segment 的 attachment，不进入 Memory 顶层 Segment strip。

中间面板的横向片段时间线只属于当前选中的 Memory。它不能表示整个 Workspace 的全部内容，也不能演变成 workspace feed、日志流、文件流或社交动态流。

## 当前表达入口

底部 Floating Action Button Speed Dial 是 Workspace Stage 的表达入口。当前唯一可执行 action 是录音。note、photo、video 和 imported_file 只保留不可用的 icon-only action 位置，用于表达已接受的信息架构，不触发 runtime surface。

录音流程使用浏览器 `MediaRecorder` 和 `getUserMedia` 的薄 adapter。Renderer 先通过 IPC 获得一次性 microphone intent，再请求 audio-only media stream。音频 chunk 通过 IPC 串行写入 main process 的 durable draft；stop 必须等待 MediaRecorder 最后的 `dataavailable` chunk 完成后再 finalize。

点击 Workspace Stage 的录音优先使用当前 Memory context，并把录音 finalize 显式归属到该 Memory。只有当前 Workspace 没有任何 Memory、也没有可选当前 Memory 时，录音入口才先进入新建 Memory 命名流程，创建成功后再进入录音流程。

## 当前 Memory Context

当前点击右侧 Memory rail 只切换 loaded workspace frame 内的当前 Memory context，不进入独立详情 route。Memory rail 按 Memory 投影更新时间倒序排列，新增 Segment、保存转写或给 Segment 新增补充都会让相关 Memory 更新位置；重命名只改变可见名称，不改变 activity 排序。AppShell panel titlebar 的 Breadcrumb 显示当前记忆空间标题；选中 Memory 后 Breadcrumb 增加当前 Memory 标题。两个标题都提供 DropdownMenu 重命名入口，但 titlebar 不显示额外下拉图标；两层之间只显示圆点 separator。

选中 Memory 后中间区域显示 Memory Studio：空态、该 Memory 内按投影更新时间倒序排列的 finalized audio Segment 横向预览流、横向浏览按钮、时间轴、当前片段内容区、本地音频播放、已保存 transcript、动态内容 tab 和 SegmentAttachment `+` 菜单。Memory Studio 不重复显示 Memory title、片段数量或总时长 meta。

Segment 选择只在当前 Memory 内同步 card、时间轴点、播放区、内容 tab 和内容区；普通录音完成后新 finalized audio Segment 以 `录音N` 命名，立即进入当前 Memory 的横向预览流并成为 selected Segment。横向浏览按钮只滚动 Segment 预览流，不改变当前 Segment。

Segment card、时间轴圆点和时间标签属于同一个横向 scroll item，圆点和时间固定在对应卡片下方居中，并随 Segment strip 横向滚动；时间标签显示该 Segment 的创建时间，不显示片段时长。播放区 waveform 从 selected finalized audio Segment 的真实音频 bytes 解码峰值生成，音频无法解码时不展示固定占位波形。

selected Segment 存在 finalized SegmentAttachment 时，每个 SegmentAttachment 作为独立内容 tab 出现在 `转录` 旁边；tab 上显示 attachment title 和类型 icon，内容区不重复显示标题或创建时间。同一 selected Segment 出现新补充录音时，Memory Studio 自动切到新 attachment tab 让新内容可见。补充录音在自己的 tab panel 内使用与主播放条一致的播放按钮、真实 waveform slider 和等宽时间，但不展示 transcript。

Memory Studio 只读取当前 Memory detail、selected Segment content 和 selected SegmentAttachment audio content，不聚合整个 Workspace。右侧 Memory rail 默认折叠并退出可访问树；用户手动展开后，宽视口使用 inline 模式，WorkspaceFrame 的第二条 grid 轨道从 `0px` 展开到 `240px`，中央舞台和底部 FAB 保持对称横向 padding；compact workspace 宽度下使用 overlay 模式，不挤压 Memory Studio 主体验。

Memory rail 宽度收敛到 `240px`，列表 surface 使用全高 `bg-background` 并与主内容区保持同一画布填充；rail shell 使用 `border-l border-secondary` 标记主内容和右侧记忆列表的跨区域边界。MemoryRail memory item 使用 `bg-card` 表达常态卡片、`bg-secondary` 表达 hover 和当前状态，当前 Memory 同时保留 `aria-current`；不靠边框或阴影表达层级。

Memory Studio 必须是首屏可理解的 studio surface：Segment card、timeline、playback、tab 和 transcript 不靠页面纵向滚动才能看完整主体验；中间舞台、播放器和内容区在窄视口内保持在 panel 内，Segment strip 只在自身横向滚动，不制造页面级横向滚动。

Audio Segment card 使用紧凑正方形比例、无描边纯填充、`rounded-xl`、标题直入、静态 waveform bars 和 mono duration。卡片用 `bg-card` 或透明表达常态、`bg-secondary` 表达选中；浅色模式下卡片比页面更灰，深色模式下卡片比页面更亮，不用边框或阴影制造层级。卡片不展示 `一个补充`、`已有转录` 或 `本地音频` 这类状态标签。卡片 More 入口只在 hover、focus 或菜单打开时显示，并提供片段重命名和片段删除。

当前 Memory Studio 不是完整详情页。内容 tab rail 只展示 selected Segment 已存在的内容入口；audio Segment 始终有 `转录` tab，finalized SegmentAttachment 按真实投影作为独立 tab 出现，笔记、视频和图片不会作为常驻禁用 tab 出现。SegmentAttachment tab 用 active pill 表达当前选择；More 是 tab 的 sibling 操作入口，只在 tab hover 或 More 自身键盘 focus-visible 时展开，鼠标移开后收起视觉状态，不能因为 tab active 或 DropdownMenu open 而常驻展开；active 只让当前 More 可以进入键盘路径。tab pill 和 More reveal 使用 400ms `cubic-bezier(0.2, 0.9, 0.1, 1)`，内容 panel 切换使用 300ms 同曲线，DropdownMenu 使用 150ms 进入动效。当前 More 菜单提供重命名和删除，未来 reorder 复用同一 tab 操作边界，未定义持久顺序合同前不提供本地假重排。`+` 菜单显示录音补充项并以 `补充录音N` 命名，写入 selected Segment attachment，不新建 Memory，也不创建同级 Segment。

Memory 删除是当前 Memory 容器的危险操作。用户只能从 Memory rail 的 More 菜单进入删除确认；确认后 main process 按 `memory.json.memoryId` 找到当前 Memory 目录并移入 `.reo/trash/memories/`，再刷新 Workspace snapshot。删除成功后 renderer 移除该 Memory 的 detail cache，若当前 Memory 被删除则切换到剩余第一条 Memory 或回到 Workspace Stage，并通过 toast 提供本次恢复动作。恢复只把同一 `restoreToken` 对应的 Memory 从恢复区移回 active memories，不恢复为 Segment 或 SegmentAttachment，也不暴露本地路径。

Segment 删除是当前 Memory Studio 内 audio Segment 的危险操作。用户只能从 Segment card 的 More 菜单进入删除确认；确认后 renderer 立即从当前 Memory Studio 移除该 Segment，当前选中项回到剩余 Segment 或空态，并显示带进度条的可撤销 toast。Segment 删除 toast 使用统一 toast surface，`恢复` 是带 icon+文字和 hover 状态的 action；倒计时为 10 秒。用户在 toast 关闭前点击 `恢复` 时，Segment 直接回到当前 Memory Studio 并重新选中，不触发后端恢复请求。toast 自动关闭后，main process 才按 `segment.json.segmentId` 找到当前 Memory 下的 Segment 目录并移入 `.reo/trash/segments/`，其 `attachments/` 子树随 Segment 一起进入恢复区。删除或撤销过程不暴露本地路径。

SegmentAttachment 删除是当前 Memory Studio 内容 tab 的危险操作。用户只能从对应 attachment tab 的 More 菜单进入删除确认；确认后 main process 把真实 attachment 目录移入 `.reo/trash/attachments/`，保留音频、转录和 metadata，并刷新父 Memory 的 attachmentCount。删除成功后该 attachment tab 从 selected Segment 的 tab rail 消失，若当前正选中它则回到 `转录`；toast 提供可见 `恢复` action，把同一 attachment 目录移回 parent Segment `attachments/` 下。恢复要求 parent Memory 和 parent Segment 仍存在；parent missing 时 trash 保持可恢复。若删除或恢复已经移动文件但投影刷新失败，UI 保持与文件真源一致的删除或恢复投影并显示错误。删除和恢复都不暴露本地路径。

## AI 边界

当前不实现 Reo runtime 内的 AI agent、chat、tool use、自动整理或 AI side effects。

AI-ready 的当前验证方式是本地文件结构、`AGENTS.md`、Memory metadata、audio segment 和已保存 transcript 可以被外部 AI 工具读取并理解。

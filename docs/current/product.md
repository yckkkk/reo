# 产品基线

本文档是 Reo 产品定位、核心体验和页面模型的当前真源。

## 定位

Reo 是本地优先的 AI-ready 记忆空间。它不是单纯录音工具，也不是文件管理器；录音、笔记、照片、视频和外部导入文件都应进入同一个 Workspace -> Memory -> Segment -> SegmentAttachment 模型。

一个 Workspace 是用户选择的本地记忆空间。一个 Memory 是主题容器，负责组织。一个 Segment 是 Memory 内的主体记录，负责承载一次具体记录。一个 SegmentAttachment 是围绕某个 Segment 的补充内容，负责延展上下文。当前已实现的 Segment 类型是 `audio`；当前已实现的 SegmentAttachment 类型是 `audio` 录音补充；`note`、`photo`、`video`、`imported_file` 和其他 SegmentAttachment 类型进入 runtime 前必须先定义文件合同、IPC contract、查询更新和恢复路径。

Reo 的核心目标是降低表达阻力，让用户更愿意记录、回看、继续补充，并让这些记忆保持用户拥有、可迁移、AI-readable。

## 产品气质

Reo 是现代扁平矢量插画风 + 毛玻璃 + 北欧极简 + 日式留白的私人表达工作室：安静、克制、温柔、有时间感。用户打开 Reo 的第一印象不应是管理、协作、数据库、项目推进、效率压迫或粗糙 MVP，而应是一个可以慢慢说话、慢慢回想、慢慢沉淀自己的空间。

Reo 的美感来自对注意力的尊重：本地优先带来安全感，AI-ready 带来未来感，留白带来呼吸感，Memory 与 Segment 的生长关系带来生命感。产品 UI 使用 Card Glass 毛玻璃、低饱和纯色块、实线边界、动态矢量波形、等宽时间、命名环境光阴影和克制动效建立层级，不用阴影堆叠、装饰性渐变或伪媒体制造完成感。

这套气质的产品含义是：北欧极简负责低饱和度色彩和克制设计语言，现代扁平矢量插画负责几何图形和无描边内容对象，毛玻璃负责背景模糊与半透明空间层次，日式留白负责大面积负空间和不对称平衡。

## 当前页面模型

### Home

Home 当前是全局入口 shell。它提供进入记忆空间、资料库和创建或打开 Workspace 的入口，不承载 Workspace 内的 Memory 导航。

### Library

Library 当前是资料库占位入口。它只显示资料库页面标题，不展示 Memory、Segment 或 Workspace 管理内容。Workspace 创建、打开、切换和移除当前由 AppShell sidebar 的记忆空间列表承担。

### Loaded Workspace

Loaded Workspace 使用三面板结构：

- 左侧 AppShell sidebar：全局导航和 Workspace 列表，保持当前入口，不承载当前 Workspace 内的 Memory 导航。
- 中间 Workspace Stage：默认表达舞台。未选中 Memory 时只表达“今天想记录些什么？”，不显示 workspace feed、全局时间线或文件流。
- 右侧 Memory rail：当前 Workspace 的全部 Memory 容器列表。它用于在 Memory 之间切换，不展示单个 Segment 详情。

当前 Workspace 标题显示在 AppShell panel titlebar。右上角 icon-only control 控制 Memory rail 折叠和展开；`新建记忆` icon-only control 先打开命名弹层，创建成功后才产生 Memory。

## 核心层级

- Workspace 层级：当前本地记忆空间，右侧 Memory rail 展示这个空间里的所有 Memory。
- Memory 层级：主题容器。选中 Memory 后只切换当前 Workspace Stage 的当前 Memory context；当前 runtime 不进入单独详情 route。
- Segment 层级：Memory 内的主体记录。当前 runtime 只实现 `audio` Segment；`segmentIds` 是 Memory 的核心关系，当前只接受已实现的 audio segment id。
- SegmentAttachment 层级：围绕某个 Segment 的补充内容。当前 Memory Studio 的 selected Segment `+` 菜单只暴露录音补充项；录音补充写入 selected Segment 的 attachment，不进入 Memory 顶层 Segment strip。

中间面板的横向片段时间线只属于当前选中的 Memory。它不能表示整个 Workspace 的全部内容，也不能演变成 workspace feed、日志流、文件流或社交动态流。

## 当前表达入口

底部 Floating Action Button Speed Dial 是 Workspace Stage 的表达入口。当前唯一可执行 action 是录音。note、photo、video 和 imported_file 只保留不可用的 icon-only action 位置，用于表达已接受的信息架构，不触发 runtime surface。

录音流程使用浏览器 `MediaRecorder` 和 `getUserMedia` 的薄 adapter。Renderer 先通过 IPC 获得一次性 microphone intent，再请求 audio-only media stream。音频 chunk 通过 IPC 串行写入 main process 的 durable draft；stop 必须等待 MediaRecorder 最后的 `dataavailable` chunk 完成后再 finalize。

点击 Workspace Stage 的录音优先使用当前 Memory context，并把录音 finalize 显式归属到该 Memory。只有当前 Workspace 没有任何 Memory、也没有可选当前 Memory 时，录音入口才先进入新建 Memory 命名流程，创建成功后再进入录音流程。

## 当前 Memory Context

当前点击右侧 Memory rail 只切换 loaded workspace frame 内的当前 Memory context，不进入独立详情 route。选中 Memory 后中间区域显示 Memory Studio：当前 Memory title、片段数量、总时长、空态，以及该 Memory 内 finalized audio Segment 的横向预览流、横向浏览按钮、时间轴、当前片段内容区、本地音频播放、已保存 transcript、动态内容 tab 和 SegmentAttachment `+` 菜单。Segment 选择只在当前 Memory 内同步 card、时间轴点、播放区、内容 tab 和内容区；横向浏览按钮只滚动 Segment 预览流，不改变当前 Segment。播放区 waveform 从 selected finalized audio Segment 的真实音频 bytes 解码峰值生成，音频无法解码时不展示固定占位波形。Memory Studio 只读取当前 Memory detail 和 selected Segment content，不聚合整个 Workspace。右侧 Memory rail 折叠时整体向右滑出并退出可访问树；中央舞台和底部 FAB 使用同一 rail inset 变量同步回收空间。Memory Studio 必须是首屏可理解的 studio surface：Segment card、timeline、playback、tab 和 transcript 不靠页面纵向滚动才能看完整主体验。

Audio Segment card 使用现代扁平矢量 + 毛玻璃录音卡：正方形比例、Card Glass surface、2px token 边框、`--radius-panels`、标题直入、状态文本、动态 waveform bars 和 Geist Mono duration。active waveform 使用 15 根纯色 bars、中心伸缩、错相节奏和分散 duration，避免整排 bars 同步成同一种上下律动。

当前 Memory Studio 不是完整详情页。内容 tab 只展示 selected Segment 已存在的内容入口；audio Segment 默认只有 `转录` tab，笔记、视频和图片不会作为常驻禁用 tab 出现。`+` 菜单显示录音补充项并写入 selected Segment attachment，不新建 Memory，也不创建同级 Segment。多模态 Segment 聚合、独立笔记 Segment、图片 Segment、视频 Segment、imported_file Segment、非音频 SegmentAttachment 和整理编辑进入前必须先补齐文件合同、IPC、查询更新、错误恢复和视觉验证。

Memory 删除是当前 Memory 容器的危险操作。用户只能从 Memory rail 的 More 菜单进入删除确认；确认后 main process 把 `memories/<memoryId>/` 移入 `.reo/trash/memories/<memoryId>/` 并刷新 Workspace snapshot。删除成功后 renderer 移除该 Memory 的 detail cache，若当前 Memory 被删除则切换到剩余第一条 Memory 或回到 Workspace Stage，并通过 toast 提供本次恢复动作。恢复只把同一 `restoreToken` 对应的 Memory 从恢复区移回 active memories，不恢复为 Segment 或 SegmentAttachment，也不暴露本地路径。

## AI 边界

当前不实现 Reo runtime 内的 AI agent、chat、tool use、自动整理或 AI side effects。

AI-ready 的当前验证方式是本地文件结构、`AGENTS.md`、Memory metadata、audio segment 和已保存 transcript 可以被外部 AI 工具读取并理解。

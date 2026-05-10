# 常态 Memory 页面设计说明

开始时间：2026-05-10 04:43 America/Los_Angeles

关联长期任务：`docs/initiatives/2026-05-08-memory-studio-design-convergence`

## 目标

整理 Reo「常态 Memory 页面 / 记忆空间内的记忆常态页面」的产品功能说明、工程实现说明、状态机、边界情况和最终交付目标。本文档只定义当前设计和工程约束，不进入代码实现。

## 输入理解

本功能是 Reo loaded workspace 中央区域在用户选中某个 Memory 后呈现的 Memory 常态页。它不是录音沉浸态，不是独立详情路由，也不是 workspace 全局 feed。

### 功能类型

| 类型       | 是否涉及 | 当前规则                                                                       |
| ---------- | -------- | ------------------------------------------------------------------------------ |
| 页面功能   | 是       | loaded workspace 内选中 Memory 后的中央 Memory Studio 页面                     |
| 组件功能   | 是       | Segment 横向预览流、时间轴、播放器、内容 tab、Memory rail、FAB、Tooltip、Toast |
| 表单功能   | 部分涉及 | Memory 命名、Memory 重命名、录音保存、SegmentAttachment 保存                   |
| 搜索功能   | 否       | 当前不提供搜索入口                                                             |
| 筛选功能   | 否       | 当前不提供筛选                                                                 |
| 上传功能   | 未来涉及 | photo、video、imported_file 需要文件合同后进入 runtime                         |
| 编辑功能   | 部分涉及 | Memory 重命名、未来 transcript/note 编辑；当前不作为本页主链                   |
| 发布功能   | 否       | 当前无发布流程                                                                 |
| 审批功能   | 否       | 当前无审批流程                                                                 |
| 权限功能   | 是       | Workspace handle、文件读写、mic intent、只读、权限过期、lock lost              |
| 支付功能   | 否       | 当前无支付                                                                     |
| 通知功能   | 部分涉及 | Toast、Tooltip、错误提示                                                       |
| 数据看板   | 否       | 时间轴和统计为内容导航，不作为看板                                             |
| AI 功能    | 否       | 不展示伪 AI、伪推荐、伪转写                                                    |
| 多人协作   | 边界涉及 | 当前无多人协作；需要处理外部文件修改、冲突和过期                               |
| 异步任务   | 是       | Workspace 加载、Memory detail 加载、媒体读取、保存、恢复、删除                 |
| 后台配置   | 否       | 当前无后台配置                                                                 |
| 跨页面流程 | 是       | Workspace 打开、Memory 切换、录音完成回到当前 Memory、恢复任务回写             |

当前信息架构必须保持：

```text
User
  Workplace / 记忆空间
    Memory / 记忆
      Segment / 片段
        SegmentAttachment / 片段补充内容
```

- Workplace / 记忆空间：最高级内容空间，用于区分大的使用场景。
- Memory / 记忆：主题容器，类似文件夹，负责组织。
- Segment / 片段：Memory 内的具体记录单元，可以是 `audio`、`note`、`video`、`photo`、`imported_file`。
- SegmentAttachment / 片段补充内容：围绕某个 Segment 继续添加的相关内容。

本页面的核心动作是：用户在右侧 Memory 列表中切换当前 Memory，中间区域显示该 Memory 的标题、元信息、Segment 横向预览流、时间轴、当前片段播放或内容、内容类型 tab 和文本内容。Segment 横向预览流两侧需要在发生横向溢出时显示左右浏览按钮，用于查看当前可视区域外的 Segment 卡片。内容 tab 最右侧的 `+` 是 SegmentAttachment 添加菜单入口，点击后弹出菜单；当前目标只支持在 selected Segment 下添加录音形式的 SegmentAttachment。底部 Floating Action Button Speed Dial 继续保留，作为在当前 Workspace / 当前 Memory 中继续表达的入口。

设计效果图里缺少底部 FAB 是设计遗漏，不代表 Reo 要移除 FAB。Reo 的当前设计必须保留 ExpressionDock / FAB。FAB 触发录音时优先归属当前 Memory；只有当前 Workspace 没有任何 Memory 且没有可选当前 Memory 时，才先进入新建 Memory 命名流程。

## 设计图真实 UI 与标注语义区分

真实 UI 结构：

- 左侧 AppShell sidebar：Home、资料库、记忆空间列表、主题切换和窗口/sidebar 控制。
- AppShell panel titlebar：当前 Workspace 标题和右侧 Memory rail 折叠控制。
- 中央 Memory Studio：当前 Memory 标题、元信息、Segment 横向预览流、横向流左右浏览按钮、时间轴、音频播放区、内容 tab、tab 右侧 SegmentAttachment `+` 菜单和正文内容区。
- 右侧 Memory rail：当前 Workspace 下的 Memory 列表，用于切换当前 Memory。
- 底部 FAB：当前 Workspace Stage / Memory Studio 的表达入口，设计图遗漏但产品保留。

| 区域               | 元素                                                                                | 说明                                                                       |
| ------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 左侧 sidebar       | 首页、资料库、记忆空间列表、主题切换、窗口控制                                      | AppShell 全局导航，不承载当前 Workspace 内的 Memory 导航                   |
| 顶部 titlebar      | 当前 Workspace 名称、右侧 rail 折叠控制                                             | 当前工作空间语境入口                                                       |
| 中央 Memory Studio | Memory 标题、创建时间、片段数量、Segment 横向预览流、时间轴、播放器、内容 tab、正文 | 当前 Memory 的主要回看与补充区域                                           |
| Segment 横向预览流 | 音频卡、文本卡、图片/视频卡、左右浏览按钮                                           | 只展示当前 Memory 内 Segment，左右箭头只负责横向滚动                       |
| 时间轴             | Segment 节点、时间标记、当前选中点                                                  | 表达当前 Memory 内片段顺序与时间感                                         |
| 播放区             | 播放按钮、波形、当前时间、总时长                                                    | 用于 audio Segment 回放                                                    |
| 内容 tab           | selected Segment 已存在内容入口、右侧 `+`                                           | audio Segment 默认只有转录；`+` 给 selected Segment 添加 SegmentAttachment |
| 右侧 Memory rail   | Memory 卡片列表                                                                     | 固定右侧 rail，可折叠，用于切换当前 Memory                                 |
| 底部 FAB           | Floating Action Button Speed Dial                                                   | 作为当前 Workspace / 当前 Memory 的继续表达入口                            |

标注语义：

- 标注框、标注线、讲解编号和说明色块只帮助理解语义，不进入真实 UI。
- 右侧 Memory 列表不是弹窗、抽屉或浮层；它是 loaded workspace frame 的固定右侧 rail，可折叠。
- 中央每个模块不应变成重卡片堆叠。视觉应继续遵守 Reo 现代扁平矢量插画风 + 毛玻璃 + 北欧极简 + 日式留白的设计系统，组件样式必须追溯到 token、primitive variant 或已记录 pattern。
- Segment 横向预览流和中间时间轴只表示当前 Memory 内的 Segment，不表示整个 Workspace 的所有内容。
- Segment 横向预览流的左右按钮是辅助浏览控件，只控制中上方卡片列表横向滚动，不承担播放、选择、编辑或删除职责。
- 内容 tab 最右侧 `+` 的真实语义是给 selected Segment 添加 SegmentAttachment，不是新建 Memory，也不是新建同级 Segment；当前可执行菜单项只允许添加录音。

## 采用依据

- React 官方当前文档：组件 state 按 UI tree 位置保存；切换 Memory、Segment 或 playback context 时，应通过明确 key 或组件位置边界重置局部状态，避免把旧 Memory 的播放、tab 或编辑 draft 串到新 Memory。
- React 官方当前文档：异步事件处理器读取各自 render 的 state snapshot；Memory 切换、Segment 切换、播放加载和保存回调必须用 request token、revision 或 identity guard 防止旧结果写回当前页。
- TanStack Query 当前文档：main-backed async data 使用稳定 query key；mutation 成功后应 invalidate 或用 immutable `setQueryData` 合并返回结果；非 server-backed 的播放状态、tab 状态、hover、tooltip 和局部 draft 不进入 query cache。
- wavesurfer.js 当前文档：支持 waveform rendering、play/pause、seek、skip、timeupdate、ready/error events、pre-computed peaks 和 Regions 插件。正式引入 finalized audio playback 前，需要评估它和现有 Reo Waveform / ElevenLabs UI source 的适配成本、bundle 成本、Blob URL 生命周期和大文件策略。

## 产品功能说明

### 功能目标

常态 Memory 页面解决用户进入一个记忆主题后如何回看、定位、播放、阅读、继续补充的问题。页面需要让用户知道自己正在哪个 Workspace、哪个 Memory、已有多少 Segment、当前选中哪个 Segment、内容可以如何继续生长。

### 目标用户

- 正在整理或回看某个记忆主题的 Reo 用户。
- 刚完成录音、需要回到当前 Memory 查看结果的用户。
- 希望在同一 Memory 内继续添加录音、笔记、图片、视频或导入文件的用户。

### 使用场景

- 打开某个 Workspace 后，从右侧 Memory rail 选择一个 Memory。
- 录音完成后，Reo 自动回到受影响 Memory 的常态页。
- 用户在某个 Memory 中按时间浏览 Segment，播放音频，查看转录或笔记，继续补充内容。
- 用户在同一 Workspace 中快速切换不同 Memory。

### 用户任务

- 识别当前 Memory 的主题、创建时间和片段数量。
- 快速浏览当前 Memory 中的 Segment 序列。
- 通过时间轴定位某个时间点的 Segment。
- 播放 audio Segment，并同步播放头、波形和时间。
- 在 selected Segment 已存在内容入口之间切换；audio Segment 当前只有转录。
- 通过 Segment 横向预览流两侧按钮浏览可视区域外的片段卡片。
- 通过内容 tab 右侧 `+` 给当前 selected Segment 添加录音 SegmentAttachment。
- 通过 FAB 在当前 Memory 内继续添加同级 Segment。
- 在右侧 Memory rail 切换其他 Memory。

### 信息层级

需要突出：

- 当前 Workspace title。
- 当前 Memory title。
- 当前 Memory 的创建时间、最近更新时间、片段数量。
- 当前选中的 Segment、播放状态、当前时间、总时长。
- 当前内容 tab 和正文内容。
- 录音 / 新增等继续表达入口。

需要弱化：

- 右侧非选中 Memory。
- 非当前 Segment 的预览卡片。
- 未实现或当前不可用的 Segment 类型入口。
- 错误详情、文件路径、事务状态、权限细节。

### 主操作

- 选择 Memory。
- 选择 Segment。
- 播放、暂停和拖动 audio playback。
- 切换内容 tab。
- 使用内容 tab 右侧 `+` 打开 SegmentAttachment 添加菜单。
- 使用 FAB 继续添加当前 Memory 下的同级 Segment。

### 辅助操作

- 折叠或展开右侧 Memory rail。
- 点击 Segment 横向预览流两侧浏览按钮。
- 重命名 Memory。
- 查看 tooltip。
- 关闭错误 toast。
- 通过空态创建 Memory 或开始记录。

### 风险操作

- 删除 Memory。
- 删除 Segment。
- 丢弃未保存的 Segment 或 SegmentAttachment draft。
- 在保存中切换 Memory、关闭页面或关闭 Workspace。
- 打开需要 microphone、file import 或 media playback 权限的入口。

风险操作必须有确认、busy guard、数据保留或恢复路径。

### 功能边界

- 本页面不恢复单独 `MemoryDetailPage` 路由语义。
- 本页面不强制录音完成后填写描述、转写编辑或 reflection。
- 本页面不把 Segment 和 Memory 合并为同一层级。
- 本页面不让 FAB 录音强制新建 Memory。
- 本页面不把内容 tab 右侧 `+` 当成新建 Memory 或新建同级 Segment；它只服务 selected Segment 的 SegmentAttachment 添加。
- 本页面不展示伪 AI、伪推荐、伪转写或 mock media。
- 当前 runtime 已实现的 Segment 类型是 `audio`。`note`、`photo`、`video`、`imported_file` 和 SegmentAttachment 进入 runtime 前必须先补文件合同、IPC contract、Query 更新、恢复路径和视觉验证；本设计中 SegmentAttachment 的首个可执行添加类型只允许录音。

## 页面状态说明

| 状态                   | 进入条件                                                    | 页面表现                                                       | 可做                                                      | 不可做                                                     | 系统行为                                                    | 数据变化                             | 退出                         | 异常处理                                               | 验收                                   |
| ---------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------ | ---------------------------- | ------------------------------------------------------ | -------------------------------------- |
| 记忆空间未选择         | 没有 active workspace session                               | 显示 starter Home shell 和 sidebar 记忆空间入口                | 创建或打开 Workspace                                      | 查看 Memory Studio、播放 Segment                           | 读取 memory space registry                                  | 不写 Workspace 内容                  | 打开或创建 Workspace         | registry 读取失败用 root toast                         | 不显示 Memory timeline 或 fake content |
| 记忆空间加载中         | 用户点击已导入 Workspace 或打开本地文件夹                   | 保留当前 shell，目标入口进入 pending                           | 取消 OS dialog 后返回                                     | 重复触发同一 open/create action                            | main 校验 selection token、registry、lock 和 workspace 文件 | 成功后返回 handle 和 snapshot        | ready 或 failed              | typed error envelope 转 toast                          | pending 期间不泄露 raw path            |
| 记忆空间加载失败       | open/create 返回错误                                        | 保留当前可用页面，显示 toast                                   | 重试、移除 registry entry                                 | 切到半初始化 Workspace                                     | 不注册无效 handle                                           | 不写 current session                 | 用户重试或关闭 toast         | missing root、lock conflict、metadata invalid 分别提示 | 当前 session 不被清空                  |
| 记忆列表为空           | Workspace ready 且 `memories[]` 为空                        | 右侧 rail 显示空态，中央 Workspace Stage                       | 新建 Memory、FAB 录音先命名 Memory                        | 显示 Memory Studio timeline                                | snapshot cache 保持空 memories                              | createMemory 成功后新增 summary      | 创建 Memory                  | create 失败保留命名 draft                              | 无伪 Memory 卡片                       |
| Memory 未选择          | Workspace ready 且有 memories，但未选中 currentMemoryId     | 中央显示 Workspace Stage                                       | 选择右侧 Memory、FAB 录音可进入当前策略                   | 展示 Segment timeline                                      | App 持有 current memory session state                       | 不写文件                             | 选中 Memory                  | snapshot 中 Memory 消失则保持未选择                    | Stage 不显示 Workspace feed            |
| Memory 常态浏览        | 有 currentMemoryId，detail projection loaded                | 显示 Memory title、meta、Segment strip、timeline、内容区和 FAB | 选择 Segment、播放、切 tab、新增                          | 写未实现类型、跨 Memory 聚合                               | 读取当前 Memory detail                                      | detail query cache 更新              | 切换 Memory、进入新增、播放  | detail 失败进入错误态                                  | timeline 只含当前 Memory Segment       |
| Memory 切换中          | 用户点击右侧 Memory rail 的另一条 Memory                    | 右侧选中态可先变化，中央显示轻量 loading 或保留旧内容弱化      | 等待、取消无显式按钮                                      | 旧 detail 异步写入新 Memory                                | 发起新 detail read，带 request identity                     | currentMemoryId 更新，detail pending | loaded 或 failed             | 旧请求返回必须丢弃                                     | 快速切换不串写标题、tab、播放          |
| Segment 为空           | 当前 Memory detail loaded 且 Segment 列表为空               | Memory title 和 meta 保留，内容区显示空态                      | FAB 录音、新增 note/photo/video/file 入口按能力可用性显示 | 播放或切换不存在的 Segment                                 | 不读取 media                                                | 不写 Segment                         | 新增 Segment 成功            | 新增失败保留空态并 toast                               | 空态不引导用户离开当前 Memory          |
| Segment 已选择         | 当前 Memory 有 Segment 且 selectedSegmentId 有效            | 预览卡片、timeline point、tab 内容同步 active                  | 播放、切 tab、查看内容、新增补充                          | 把 Segment 当 Memory 切换                                  | 读取 segment projection 和可用内容                          | selectedSegmentId 为 UI state        | 选择其他 Segment 或切 Memory | Segment 不存在则回到首个或空态                         | active 状态三处一致                    |
| Segment 播放中         | selected Segment 为可播放 audio，media ready 后点击播放     | 播放按钮变暂停，波形进度和时间推进                             | 暂停、seek、切换 Segment                                  | 删除当前 Segment 时继续播放                                | 控制 HTMLAudioElement 或 audio player                       | playback state 为 local state        | 暂停、结束、切换             | play() reject 显示 toast 并停在暂停                    | 时间、播放头、按钮一致                 |
| Segment 暂停中         | 播放未开始、用户暂停或播放结束                              | 显示当前时间和可拖动播放头                                     | 播放、seek、切 tab                                        | 使用 recording draft read 当 finalized read                | media element 保持 currentTime                              | 不写 durable data                    | 播放或切换                   | 文件缺失/损坏进入播放失败                              | Blob URL 正确释放                      |
| Segment 内容切换       | 用户点击 selected Segment 已存在内容 tab                    | tab active underline，内容区切换                               | 查看已有内容或进入可用新增                                | 展示未实现类型假内容或常驻禁用 tab                         | 只切 UI state；必要时 lazy read                             | activeContentType 更新               | 点击其他内容入口             | 缺内容显示空态                                         | 未实现类型不可触发 IPC                 |
| Segment 横向浏览       | Segment 预览卡片总宽度超过可视区域                          | 卡片流左右侧按滚动位置显示 CarouselArrowButton                 | 点击左右按钮或手动横向滚动                                | 选择、播放、编辑、删除 Segment                             | 监听 scroll 和容器尺寸变化，实时计算按钮显示                | 只改变 DOM scrollLeft，不写业务数据  | 到达左右边界或切 Memory      | 计算失败时隐藏按钮，保留原生横向滚动                   | 按钮只控制卡片流滚动                   |
| SegmentAttachment 菜单 | 用户点击内容 tab 最右侧 `+`                                 | 在 `+` 附近打开 compact menu，当前只有添加录音                 | 选择添加录音、关闭菜单                                    | 新建 Memory、创建同级 Segment、触发未实现类型              | 检查 selected Segment 和 attachment 录音能力                | 菜单 open 为 UI state                | 选择录音或关闭菜单           | 无 selected Segment 时禁用并 tooltip                   | `+` 语义不混同 FAB                     |
| 新增 SegmentAttachment | 用户在 SegmentAttachment 菜单选择添加录音                   | 打开 attachment 录音 composer，父级是当前 selected Segment     | 录音、取消、保存                                          | 改变 current Memory、改变 parent Segment、创建同级 Segment | 使用 selected Segment identity 建立 attachment target       | attachment draft 或 recording state  | 保存、取消或失败             | parent Segment 消失时中止并 toast                      | 写入目标是 SegmentAttachment           |
| 新增 Segment           | 点击 FAB 或内容区新增入口                                   | 打开对应 composer 或 disabled tooltip                          | 录音可执行；其他类型按合同可用                            | 绕过 Memory target 直接写 Segment                          | 检查 current Memory 和能力合同                              | 录音创建 draft；其他未实现不写       | 保存、取消或失败             | 无 current Memory 时先命名 Memory                      | 录音 finalize 显式携带 memoryId        |
| 保存中                 | 新 Segment、SegmentAttachment 或 transcript 正在提交        | 保存按钮 disabled，切换保护，轻量 busy 状态                    | 等待、必要时取消可取消任务                                | 重复保存、关闭 Workspace、切 Memory                        | main 事务写入、刷新 index、返回 summary/detail              | 成功后更新 snapshot/detail           | 成功或失败                   | 失败按 data retention 保留 draft 或提示恢复            | 不能产生重复 Segment                   |
| 保存失败               | write、index、permission 或 media save 失败                 | toast 或错误状态，保留可恢复内容                               | 重试、放弃、继续编辑                                      | 静默丢弃 draft                                             | 根据错误信封保留或清理 draft                                | 不推进成功投影                       | 重试成功或放弃               | lock lost、file missing、schema invalid 分类型提示     | 失败后数据不丢                         |
| 删除或危险操作确认     | 用户触发 Memory/Segment 删除或丢弃 draft                    | 显示确认 dialog，文案说明影响范围                              | 确认或取消                                                | 单击直接删除                                               | 暂停相关播放或提交                                          | 确认后才发 mutation                  | 取消或完成                   | 删除失败保留原状态并 toast                             | 删除范围准确，不误删本地 Workspace     |
| 页面关闭或切换保护     | 存在 busy recording/save/import/playback write              | 顶层导航或 Memory 切换被阻止或要求确认                         | 完成、取消、放弃、等待                                    | 强制切换造成 target 丢失                                   | beforeunload 或 route guard                                 | 不改变 durable truth                 | busy 结束                    | native close 尽力阻止，异常靠 recovery                 | 忙碌态不会丢未完成内容                 |
| 可恢复状态             | 检测到 recoverable draft、finalized marker 或 detail 旧投影 | 显示恢复对话框或 inline 恢复提示                               | 继续检查、保存、放弃、重试加载                            | 静默覆盖或隐藏                                             | 读取 marker/index/file truth                                | 成功后合并 Memory summary/detail     | 用户选择处理                 | 恢复失败保留 marker                                    | 可恢复内容可见且可再次重试             |

## 核心组件说明

| 组件                       | 解决的问题                               | 出现和隐藏                                                                    | 状态                                                            | 点击或输入后                                                              | 联动                                                                         | 工程注意事项                                                                                                                        | 验收                                 |
| -------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 左侧 sidebar               | 提供全局导航和 Workspace 列表            | App 全局常驻；covered 时被主 panel 覆盖但仍可展开                             | default、hover、active、focus、menu-open、disabled-loading      | 点击 Home/Library/Workspace 切换顶层 session                              | 与 active workspace handle、recording busy guard 联动                        | 不承载当前 Workspace 内 Memory 导航；不暴露 raw path                                                                                | busy 录音时切换被阻止并 toast        |
| 工作区标题 / 下拉切换入口  | 说明当前 Workspace context               | loaded workspace titlebar 出现                                                | default、hover、focus、loading                                  | 打开 Workspace 相关菜单或未来切换入口                                     | 与 Memory rail 折叠按钮同一 titlebar 基线                                    | 标题来自 snapshot，不来自 registry root path                                                                                        | titlebar 无分隔线，位置稳定          |
| Memory 标题与元信息        | 确认当前 Memory 和基础统计               | Memory selected 后出现；未选中时隐藏                                          | loaded、loading、empty、error                                   | 未来可进入 rename 或 title actions                                        | 与 right rail selected card 同步                                             | title/meta 来自 Memory detail 或 summary，不能从 Segment 反推 Memory                                                                | 标题和右侧 active Memory 一致        |
| 右侧 Memory 列表           | 在同一 Workspace 下切换 Memory           | loaded workspace 出现，可折叠                                                 | default、hover、active、loading、empty、disabled-busy           | 点击卡片切换 currentMemoryId；More 打开菜单                               | 切换中央 Memory Studio；busy recording/save 时被阻止                         | 只使用 Workspace snapshot `memories[]`，不拥有 Segment detail                                                                       | 不展示 Segment 详情或 rail 级假推荐  |
| Segment 横向预览流         | 快速浏览当前 Memory 的 Segment           | Memory detail loaded 且有 Segment 时出现                                      | card default、hover、active、loading thumbnail、error thumbnail | 点击卡片选择 Segment；手动横向滚动浏览                                    | 同步 timeline active point、内容区、playback 和 CarouselArrowButton 显示状态 | 只展示当前 Memory segments；媒体缩略图来自明确 projection；横向滚动只影响卡片流，不影响时间轴、player、正文或右侧 rail              | 切换 Memory 后旧卡片不残留           |
| CarouselArrowButton        | 帮助用户浏览可视区域外的 Segment 卡片    | 卡片总宽度超过容器时按方向出现；最左隐藏 left，最右隐藏 right                 | default、hover、focus、active、hidden                           | `direction="left"` 向左平滑滚动；`direction="right"` 向右平滑滚动         | 只联动 Segment 横向预览流的 `scrollLeft`                                     | 组件建议命名 `CarouselArrowButton`；左侧 `direction="left"`，右侧 `direction="right"`；隐藏时不渲染、不保留点击区域、不进入键盘焦点 | 无横向溢出时左右按钮都不显示         |
| 时间轴                     | 表达当前 Memory 的片段顺序和时间感       | 有 Segment 时出现；空 Memory 隐藏或显示空线                                   | default、active point、hover point、loading                     | 点击时间点选择 Segment 或 seek                                            | 与 Segment strip、player、content active 同步                                | 不作为 Workspace 全局 feed；长列表需虚拟化或横向滚动策略                                                                            | 时间点数量和当前 Memory Segment 一致 |
| 音频播放和波形控件         | 回放 audio Segment 并定位内容            | selected audio Segment 可读时出现                                             | loading、ready、playing、paused、error、disabled                | 播放、暂停、seek、skip                                                    | 播放头、当前时间、tab 转录高亮同步                                           | 当前没有 finalized audio read IPC；实现前必须定义 public finalized audio read contract 或安全 Blob 来源                             | play failure 有 toast，不崩溃        |
| 播放头                     | 显示和控制当前播放位置                   | audio player ready 后出现                                                     | idle、dragging、playing、disabled                               | 拖动改变 currentTime                                                      | 同步波形、时间、转录高亮                                                     | drag 期间节流更新；切 Segment 时释放旧 listener                                                                                     | 拖动不会写 durable data              |
| 动态内容 tab               | 在 selected Segment 已存在内容视图间切换 | Memory selected 后出现；audio Segment 默认只有转录                            | default、hover、active、loading                                 | 点击 tab 切换 activeContentType；点击最右 `+` 打开 SegmentAttachment 菜单 | 内容区、空态、SegmentAttachment 菜单联动                                     | 不渲染未实现类型的常驻禁用 tab；最右 `+` 不属于 tab 本身，语义是给 selected Segment 添加补充内容                                    | tab active 和内容区一致              |
| SegmentAttachment `+` 菜单 | 给 selected Segment 添加补充内容         | selected Segment 存在且 attachment 能力可用时出现；无 selected Segment 时禁用 | default、hover、focus、menu-open、disabled、loading             | 点击 `+` 打开菜单；当前只允许选择添加录音                                 | 与 selectedSegmentId、attachment capability、recording composer 联动         | 菜单使用 compact menu；当前只开放录音 attachment；不得新建 Memory 或同级 Segment；进入 runtime 前需定义 attachment 文件合同         | 菜单项准确写入 selected Segment 语境 |
| 新增按钮                   | 在当前 Memory 下继续添加同级 Segment     | FAB 常驻；空态可出现同级新增入口                                              | default、hover、active、disabled、loading                       | 打开录音 composer 或其他 Segment composer                                 | 与 currentMemoryId、capability flags 联动                                    | FAB 录音优先当前 Memory；它和 SegmentAttachment `+` 菜单是两个不同入口                                                              | 无 Memory 时先命名 Memory            |
| 主内容文本区               | 展示转录、笔记或当前内容正文             | tab 有文本内容时出现；无内容显示空态                                          | read、editing-future、loading、empty、error                     | 未来编辑或添加内容                                                        | 与 playback time、tab、selected Segment 同步                                 | 转录只来自真实 ASR 或文件；不生成 mock 文本                                                                                         | 文本不溢出，可选择，可滚动           |
| Toast                      | 反馈非阻断错误和状态                     | root 常驻，事件触发显示                                                       | info、success、warning、error                                   | 可关闭                                                                    | 所有 feature 共享 ReoToaster                                                 | 不在 feature 内创建第二套 toast host                                                                                                | IPC 失败有可见反馈                   |
| Tooltip                    | 解释 icon-only 控件和 disabled 原因      | hover/focus 时出现                                                            | default、disabled reason                                        | 无持久数据变化                                                            | 与 FAB actions、rail controls、tab disabled 联动                             | 使用 Radix Tooltip primitive，button 有 accessible name                                                                             | 键盘 focus 可读                      |
| 空状态                     | 保持用户继续表达的方向                   | workspace/memory/segment/content 为空时出现                                   | empty workspace、empty memory、empty tab                        | 提供创建或新增入口                                                        | 与 current scope 联动                                                        | 空态只说明当前 scope，不扩大到全局 feed                                                                                             | 空态文案不任务化                     |
| 加载状态                   | 显示 async read/write 进度               | open/detail/media/save pending                                                | skeleton、spinner-light、disabled controls                      | 等待或取消可取消动作                                                      | 与 request identity guard 联动                                               | 旧请求不能覆盖新上下文；loading 不闪烁                                                                                              | 快速切换无旧数据串写                 |
| 错误状态                   | 让用户理解失败并恢复                     | detail/media/load 失败                                                        | inline neutral、toast、retry                                    | 重试、返回空态、切换 Memory                                               | 与 data retention 和 retry policy 联动                                       | 错误文案不暴露 raw path 或 secret                                                                                                   | 重试成功恢复内容                     |
| 危险操作确认               | 防止删除或丢弃误操作                     | 用户触发危险操作时显示                                                        | open、confirming、pending、failed                               | 确认或取消                                                                | 暂停 playback、锁定重复提交                                                  | 明确对象、范围和本地文件影响；pending 禁止重复确认                                                                                  | 取消无副作用，失败不删除             |

## 工程实现说明

### 进入和退出

- 进入：Workspace ready 后，用户点击右侧 Memory rail 中某个 Memory；或录音 finalize 成功后 App 将受影响 Memory 设为 current Memory context；或 recovery 保存成功后回到该 Memory。
- 退出：用户切换到另一个 Memory、折叠 rail 不退出、关闭 Workspace、进入 Home/Library、打开录音 overlay、或页面关闭。
- 路由：不新增独立 Memory detail route。Memory selection 属于 loaded workspace frame 内的 renderer session state。
- 关闭保护：存在 recording busy、save pending、import pending 或危险确认 pending 时，阻止顶层切换或弹确认。

### UI 展示与隐藏

- 未选中 Memory：显示 Workspace Stage，不显示 Segment timeline。
- 选中 Memory 且 detail loaded：显示 Memory Studio。
- Memory detail loading：中央区域显示轻量 loading，右侧 selected rail 保持。
- Segment 空：隐藏 player 和 timeline content，显示当前 Memory 空态和继续表达入口。
- selected Segment 不是 audio：隐藏 audio player，显示对应类型内容或未实现空态。
- right rail 折叠：退出可访问树和指针交互；不压缩内部卡片。
- Segment 横向预览流未溢出：左右 `CarouselArrowButton` 都不渲染。
- Segment 横向预览流在最左侧：左侧 `CarouselArrowButton direction="left"` 不渲染。
- Segment 横向预览流在最右侧：右侧 `CarouselArrowButton direction="right"` 不渲染。
- 内容 tab 最右侧 `+`：selected Segment 存在时显示为 SegmentAttachment 菜单入口；无 selected Segment 或 attachment 录音能力不可用时禁用并通过 tooltip 说明原因。

### 数据读取

- Workspace snapshot：继续使用 `['workspace', 'snapshot', workspaceId]`，包含 `workspaceId`、title、description、`memories[]` summary。
- Memory rail：只读取 snapshot `memories[]`。
- Memory detail：进入实现前定义新 projection，建议 query key 为 `['workspace', 'memory-detail', workspaceId, memoryId]`，不得包含 `workspaceHandle`。
- Segment detail：建议作为 Memory detail 内的 `segments[]` 投影，或在出现真实性能压力后定义 `['workspace', 'segment-detail', workspaceId, memoryId, segmentId]`。
- Media playback：finalized audio read 进入实现前必须定义明确 IPC，不能复用 unfinished draft read，也不能暴露 raw path。

### 数据写入

- 新建 Memory：继续使用 `workspace:createMemory`。
- 重命名 Memory：继续使用 `workspace:updateMemoryTitle`。
- 录音 Segment：继续使用当前 recording draft/finalize flow，finalize 必须显式携带 `memoryId`。
- 转录保存：继续使用 `workspace:saveTranscript(workspaceHandle, memoryId, segmentId)`。
- note/photo/video/imported_file Segment：进入 runtime 前必须定义各自文件合同、IPC、Query invalidation、恢复和测试。
- SegmentAttachment：进入 runtime 前必须定义 parent Segment identity、attachment 文件结构、写入 owner、删除影响和恢复策略。本设计的第一个 SegmentAttachment 写入能力只允许录音，菜单入口来自内容 tab 最右侧 `+`，写入目标必须是当前 selected Segment。

### 状态归属

| 状态                      | Owner                                             | 持久性           | 规则                                                  |
| ------------------------- | ------------------------------------------------- | ---------------- | ----------------------------------------------------- |
| active workspace session  | App renderer state + main handle                  | runtime only     | handle 不进 DOM、URL、Query key                       |
| Workspace snapshot        | TanStack Query                                    | cache            | main-backed server state                              |
| currentMemoryId           | loaded workspace frame state                      | runtime only     | 不写文件、不进 URL                                    |
| Memory detail             | TanStack Query                                    | cache            | key 使用 workspaceId + memoryId                       |
| selectedSegmentId         | Memory Studio local state                         | runtime only     | Memory 切换时重置或选择首个                           |
| activeContentType         | Memory Studio local state                         | runtime only     | Segment 切换时按可用内容校正                          |
| segmentCarouselScroll     | DOM scroll state + derived React visibility state | transient        | `scrollLeft` 是 DOM 状态；左右按钮显示是派生 UI state |
| segmentAttachmentMenuOpen | Radix/compact menu local state                    | transient        | 只表示 tab `+` 菜单开关，不写业务数据                 |
| playback state            | audio player local state                          | runtime only     | 不进 Query，不写文件                                  |
| save/import draft         | feature-local state 或 RHF                        | runtime/recovery | 需要恢复的 draft 必须写 recovery marker               |
| toast/tooltip open        | UI primitive state                                | transient        | 不进业务数据                                          |

### 异步和并发

- Memory detail 请求必须带 `workspaceId`、`memoryId` 和 request identity；旧请求返回时，如果 currentMemoryId 已变化，必须丢弃。
- Segment playback load 必须绑定 `segmentId` 和 media revision；切换 Segment 后旧 media ready/error 不得改当前 UI。
- Mutation response 只能 immutable 合并到对应 query cache；不能用旧 closure 覆盖并发更新。
- 重复点击新增、保存、删除确认必须被 action lock 或 pending state 阻止。
- 切换 Memory 过快时，right rail active 可以立即响应，但中央 detail 必须等待对应请求完成。
- Segment 横向预览流的左右按钮显示必须从当前容器滚动状态派生；卡片数据变化、窗口尺寸变化、容器尺寸变化、用户手动横向滚动和按钮点击后都需要重新计算。
- 内容 tab `+` 打开的 SegmentAttachment 菜单必须绑定当前 selected Segment identity；切换 Segment、切换 Memory 或进入保存中时关闭菜单，避免把 attachment 写到旧 Segment。

### Segment 横向预览流滚动控制

`CarouselArrowButton` 是 Segment 横向预览流的辅助浏览控件，不是播放、选择、编辑或删除入口。

组件建议：

```tsx
<CarouselArrowButton direction="left" ariaLabel="向左浏览片段卡片" />
<CarouselArrowButton direction="right" ariaLabel="向右浏览片段卡片" />
```

展示规则：

- 卡片总宽度小于或等于可视区域宽度时，左右按钮都不渲染。
- 卡片列表处于最左侧时，左侧按钮不渲染。
- 卡片列表处于最右侧时，右侧按钮不渲染。
- 卡片列表可以继续向左滚动时，显示左侧按钮。
- 卡片列表可以继续向右滚动时，显示右侧按钮。
- 按钮隐藏后不保留可点击区域，不参与键盘焦点顺序。

交互规则：

- 点击左侧按钮后，卡片列表向左平滑滚动。
- 点击右侧按钮后，卡片列表向右平滑滚动。
- 推荐滚动距离优先使用 `cardWidth + gap`，保证每次滚动稳定暴露下一张或上一张卡片。
- 滚动过程中实时计算左右按钮显示状态。
- 按钮显示时可被键盘聚焦，并支持 Enter 或 Space 触发。
- 按钮放在卡片列表左右两侧的垂直居中位置，视觉上属于卡片轮播区域，但不能遮挡卡片里的播放按钮、标题、时长等核心内容。

核心判断逻辑：

```ts
function updateArrowVisibility() {
  const el = carouselRef.current;
  if (!el) return;

  const isAtStart = el.scrollLeft <= 0;
  const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
  const hasOverflow = el.scrollWidth > el.clientWidth + 1;

  setShowLeftButton(hasOverflow && !isAtStart);
  setShowRightButton(hasOverflow && !isAtEnd);
}
```

滚动动作：

```ts
function handleScrollLeft() {
  const el = carouselRef.current;
  if (!el) return;

  el.scrollBy({
    left: -scrollStep,
    behavior: 'smooth',
  });
}

function handleScrollRight() {
  const el = carouselRef.current;
  if (!el) return;

  el.scrollBy({
    left: scrollStep,
    behavior: 'smooth',
  });
}
```

渲染规则：

```tsx
return (
  <>
    {showLeftButton && (
      <CarouselArrowButton
        direction="left"
        onClick={handleScrollLeft}
        ariaLabel="向左浏览片段卡片"
      />
    )}

    {showRightButton && (
      <CarouselArrowButton
        direction="right"
        onClick={handleScrollRight}
        ariaLabel="向右浏览片段卡片"
      />
    )}
  </>
);
```

状态更新时机：

- 页面初始化完成后。
- 用户点击左右按钮后。
- 用户手动横向滑动卡片列表后。
- 卡片数据发生变化后，例如新增、删除、加载更多片段。
- 窗口尺寸变化后。
- 卡片容器宽度变化后。

实现建议：

- 监听卡片容器 `scroll` 事件。
- 使用 `ResizeObserver` 监听容器尺寸变化。
- `useEffect` 清理 scroll listener 和 observer。
- reduced motion 下可以把 smooth scroll 降级为 instant scroll。

视觉规格：

- 尺寸：40px x 40px。
- 形状：圆形。
- 背景：Card Glass 或已记录的 glass token。
- 边框：1px 浅灰蓝色，落到 Reo Chalk/Slate token 范围。
- 图标：lucide chevron left / chevron right。
- 图标颜色：深蓝灰色，落到 Reo Cinder/Obsidian token 范围。
- Shadow：不使用 shadow token 之外的一次性阴影；普通横向浏览按钮以实线边界、颜色和 focus ring 建立可见性。
- 层级：高于卡片列表，建议 `z-index: 2`。
- 位置：绝对定位在卡片列表左右两侧的垂直居中位置，可向外偏移 8px 到 16px，避免压迫卡片内容。
- 动效：出现和消失使用 120ms 到 180ms 的轻微淡入淡出；隐藏状态最终必须移除 DOM 或移出可交互树。

### Query Key 建议

```ts
type WorkspaceId = string;
type MemoryId = string;
type SegmentId = string;
type AttachmentId = string;

const workspaceSnapshotKey = (workspaceId: WorkspaceId) =>
  ['workspace', 'snapshot', workspaceId] as const;

const memoryDetailKey = (workspaceId: WorkspaceId, memoryId: MemoryId) =>
  ['workspace', 'memory-detail', workspaceId, memoryId] as const;

const segmentDetailKey = (workspaceId: WorkspaceId, memoryId: MemoryId, segmentId: SegmentId) =>
  ['workspace', 'segment-detail', workspaceId, memoryId, segmentId] as const;
```

| 规则                                             | 说明                             |
| ------------------------------------------------ | -------------------------------- |
| Query key 不包含 `workspaceHandle`               | handle 属于 main process runtime |
| Query key 不包含 raw path                        | 避免泄露和 cache 污染            |
| Memory rail 只使用 snapshot `memories[]` summary | 不从 detail 反推 rail            |
| Memory detail 使用 `workspaceId + memoryId`      | 防止跨 Workspace 串写            |
| Segment detail 如果分层，需要带 `memoryId`       | 不做全局 first match             |
| mutation 成功后 immutable 合并                   | 禁止旧 closure 覆盖并发更新      |

### IPC / Preload Contract 建议

以下接口是实现前需要收敛的产品能力形状，不代表最终命名必须一致。

```ts
type ReadMemoryDetailInput = {
  workspaceId: string;
  memoryId: string;
  requestId: string;
};

type ReadMemoryDetailResult = {
  requestId: string;
  detail: MemoryDetailProjection;
  revision: string;
};

type ReadFinalizedAudioInput = {
  workspaceId: string;
  memoryId: string;
  segmentId: string;
  mediaRevision?: string;
};

type ReadFinalizedAudioResult = {
  segmentId: string;
  mediaRevision: string;
  bytes?: Uint8Array;
  mimeType: string;
  durationMs?: number;
};

type FinalizeSegmentRecordingInput = {
  workspaceId: string;
  memoryId: string;
  recordingDraftId: string;
  idempotencyKey: string;
};

type FinalizeAttachmentRecordingInput = {
  workspaceId: string;
  memoryId: string;
  segmentId: string;
  recordingDraftId: string;
  idempotencyKey: string;
};

type MutationResult = {
  workspaceId: string;
  affectedMemoryId: string;
  memorySummary: MemorySummary;
  memoryDetail?: MemoryDetailProjection;
  revision: string;
};
```

| 能力                          | 规则                                                               |
| ----------------------------- | ------------------------------------------------------------------ |
| `readMemoryDetail`            | 输入必须带 `workspaceId`、`memoryId`、`requestId`                  |
| `readFinalizedAudio`          | 只能读取 finalized audio，不读取 unfinished draft，不返回 raw path |
| `finalizeSegmentRecording`    | 必须显式携带 `memoryId`                                            |
| `finalizeAttachmentRecording` | 必须显式携带 `memoryId`、`segmentId`，不能写同级 Segment           |
| `saveTranscript`              | 必须带 `memoryId`、`segmentId`                                     |
| delete mutation               | pending 时锁定重复确认，失败不移除 projection                      |
| recovery / index reconcile    | 以 Workspace 文件真源为准，index 是可重建投影                      |

### 性能

- Segment 横向预览流和时间轴需要为长 Memory 保留虚拟化或 windowing 入口；第一版可先定义数量阈值和 overflow 规则。横向滚动按钮显示计算必须轻量，scroll handler 需要避免频繁触发昂贵布局读取。
- Audio waveform 对长音频不得在 renderer 主线程无界 decode；应评估 peaks cache、lazy loading、wavesurfer peaks/duration 或本地预计算策略。
- 图片和视频进入前必须定义缩略图和 metadata 读取策略，避免一次性加载原文件。
- 文本内容区应支持长 transcript 的滚动和按时间定位，避免整页 reflow。
- 第三方播放器或 waveform 库必须评估 bundle 成本、cleanup 语义和 Electron runtime 表现。

### 可访问性

| 控件                  | 要求                                               |
| --------------------- | -------------------------------------------------- |
| icon-only button      | 必须有 accessible name 和 Tooltip                  |
| `CarouselArrowButton` | 可键盘 focus，Enter / Space 触发；隐藏时退出焦点树 |
| 播放按钮              | 名称随状态变化，例如“播放片段”“暂停片段”           |
| tab                   | 具备 tablist/tab 语义或符合设计系统现有 tab 规范   |
| menu                  | `+` 菜单符合 menu/button aria 语义                 |
| dialog                | 危险确认 trap focus，Esc 和取消可关闭              |
| Toast                 | 不阻断键盘路径，错误可被读屏感知                   |
| reduced motion        | 平滑滚动和动画可降级                               |
| right rail            | 折叠后内部元素退出可访问树                         |
| disabled              | disabled 原因通过 Tooltip 或 inline 文案说明       |

### 数据防丢失

- 保存中切换 Memory、关闭 Workspace 或关闭窗口必须有保护。
- 录音继续使用 recovery marker；Memory Studio 不得新增绕开 recovery 的写入路径。
- SegmentAttachment 或 note editor 进入 runtime 前必须定义 autosave、manual save 或 discard 语义。
- 文件缺失、index 陈旧或 app crash 后，以 workspace 文件真源和可重建 index 恢复。

## 状态机 / 状态切换规则

| 当前状态               | 目标状态               | 触发条件                    | 用户动作                            | 系统行为                                                       | 界面变化                              | 数据变化                                 | 接口调用                                 | 权限判断                     | 异常处理                              | 回滚规则                       | 验收                         |
| ---------------------- | ---------------------- | --------------------------- | ----------------------------------- | -------------------------------------------------------------- | ------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------- | ------------------------------------- | ------------------------------ | ---------------------------- |
| 记忆空间未选择         | 记忆空间加载中         | 用户选择 Workspace          | 点击 sidebar entry 或打开本地       | main 校验 registry/selection/lock                              | 入口 pending                          | 无                                       | `openMemorySpace` 或 `open`              | sender、trusted origin、lock | typed error toast                     | 保持原页面                     | 不泄露 raw path              |
| 记忆空间加载中         | Memory 未选择          | open 成功且有 memories      | 无                                  | seed snapshot cache                                            | 显示 Workspace Stage + Memory rail    | active session 写入 runtime state        | open response                            | handle owner                 | parse 失败进入 failed                 | 释放新 handle                  | snapshot 正确                |
| 记忆空间加载中         | 记忆列表为空           | open 成功且 memories empty  | 无                                  | seed empty snapshot                                            | 空 rail + Stage                       | snapshot memories=[]                     | open response                            | handle owner                 | 同上                                  | 同上                           | 不显示 fake Memory           |
| Memory 未选择          | Memory 切换中          | 点击 Memory card            | 点击右侧 card                       | 设置 currentMemoryId，发 detail read                           | rail active，stage loading            | currentMemoryId runtime 更新             | future `readMemoryDetail`                | handle owner                 | detail fail 进入错误                  | 可回到未选择或保留 rail active | 无单独 route                 |
| Memory 切换中          | Memory 常态浏览        | detail loaded               | 无                                  | 校验 response identity                                         | 显示 Memory Studio                    | detail cache 写入                        | future detail response                   | handle owner                 | stale response 丢弃                   | 不覆盖当前 detail              | 快速切换安全                 |
| Memory 常态浏览        | Segment 已选择         | 用户点击 Segment            | 点击预览卡或 timeline point         | 校验 segment 属于 current Memory                               | active card/point/content             | selectedSegmentId 更新                   | 无或 lazy detail                         | 无新增                       | missing 切首个或空态                  | 不写 durable data              | 三处 active 同步             |
| Memory 常态浏览        | Segment 横向浏览       | 卡片列表横向溢出            | 点击 CarouselArrowButton 或手动滚动 | 更新 carousel `scrollLeft` 并重算按钮显示                      | 卡片流平滑横向移动，边界按钮显示变化  | 只改变 DOM scroll state                  | 无                                       | 无                           | 计算失败时隐藏按钮                    | 不写业务数据                   | 不影响播放/时间轴/正文       |
| Segment 已选择         | Segment 播放中         | audio media ready           | 点击播放                            | 调用 media play                                                | 按钮变暂停，播放头推进                | playback local state                     | future finalized audio read / media play | CSP media-src blob/self      | play reject toast                     | 停在暂停                       | 时间推进正确                 |
| Segment 播放中         | Segment 暂停中         | 用户暂停或播放结束          | 点击暂停或 ended                    | pause media                                                    | 按钮变播放                            | currentTime 保留                         | media pause                              | 无                           | pause error toast                     | local only                     | Blob 未泄漏                  |
| Segment 暂停中         | Segment 播放中         | 用户播放                    | 点击播放                            | play media                                                     | 继续播放                              | playback local state                     | media play                               | 无                           | play reject                           | local only                     | 从 currentTime 继续          |
| Segment 已选择         | Segment 内容切换       | 用户点内容 tab              | 点 selected Segment 已存在内容入口  | 设置 activeContentType                                         | 内容区切换                            | local state 更新                         | lazy content read if defined             | 未实现能力不渲染             | 缺内容空态                            | 无 durable 写                  | 不显示 mock                  |
| Segment 已选择         | SegmentAttachment 菜单 | 用户点击 tab 最右侧 `+`     | 点击 `+` icon-only control          | 校验 selected Segment 与 attachment 录音能力                   | 打开 compact menu，当前只显示添加录音 | menu open local state                    | 无                                       | 无新增                       | 无 selected Segment 时禁用            | 不写业务数据                   | 菜单不新建同级 Segment       |
| SegmentAttachment 菜单 | 新增 SegmentAttachment | 用户选择添加录音 attachment | 点击添加录音菜单项                  | 使用 selected Segment 作为 attachment parent 打开录音 composer | 关闭菜单，进入录音 composer           | recording attachment target local state  | attachment recording IPC                 | mic intent only after start  | permission denial toast               | discard attachment draft       | parent segment identity 明确 |
| 新增 SegmentAttachment | 保存中                 | 用户完成 attachment 录音    | 点击完成/保存                       | main 把录音写入 selected Segment 的 attachment 结构            | 保存 busy                             | attachment draft -> finalized attachment | attachment finalize/save                 | handle lock                  | parent missing 时失败并保留可恢复状态 | 失败保留 attachment draft      | 不创建同级 Segment           |
| Memory 常态浏览        | 新增 Segment           | 用户点击 FAB 录音           | 点击 FAB 录音                       | 使用 currentMemoryId 创建 recording target                     | 打开 recording overlay                | recording local state                    | current recording IPC                    | mic intent only after start  | permission denial toast               | discard draft                  | finalize 携带 memoryId       |
| Segment 为空           | 新增 Segment           | 用户点击新增                | 点击 FAB 或空态按钮                 | 同上                                                           | composer/overlay                      | 同上                                     | 同上                                     | 同上                         | 同上                                  | 同上                           | 不强制新建 Memory            |
| 新增 Segment           | 保存中                 | 用户完成录音或提交内容      | 点击完成/保存                       | main 执行事务写入                                              | 保存 busy                             | draft -> finalized 或 pending write      | finalize/save                            | handle lock                  | dataRetention 驱动恢复                | 失败保留 draft                 | 无重复 Segment               |
| 保存中                 | Memory 常态浏览        | 保存成功                    | 无                                  | 更新 index，返回 summary/detail                                | 关闭 composer，刷新当前 Memory        | snapshot/detail cache 合并               | finalize/save response                   | handle lock                  | transcript save fail 走恢复           | 不回滚 durable audio           | 当前 Memory active           |
| 保存中                 | 保存失败               | IPC 或文件事务失败          | 无                                  | 返回错误信封                                                   | toast + 保留上下文                    | 按 retention 保留 draft                  | failed response                          | handle lock                  | 可重试                                | 不推进 projection              | 数据不丢                     |
| Memory 常态浏览        | 删除或危险操作确认     | 用户点删除                  | 点击 more/delete                    | 暂停相关 playback                                              | dialog open                           | 无                                       | 无                                       | 无                           | 无                                    | 取消无副作用                   | 文案说明范围                 |
| 删除或危险操作确认     | 保存中                 | 用户确认删除                | 点击确认                            | 发删除 mutation                                                | confirm pending                       | 成功后移除 projection                    | future delete IPC                        | handle lock                  | 失败 toast                            | 保留原 projection              | 不误删 workspace             |
| 任意可交互             | 页面关闭或切换保护     | busy write/recording        | 点击导航/关闭                       | guard 拦截                                                     | toast 或确认                          | 无                                       | beforeunload/route guard                 | 无                           | native 强关靠 recovery                | 保留 marker                    | busy 不丢内容                |
| 可恢复状态             | Memory 常态浏览        | 用户选择保存或继续检查完成  | 点击恢复动作                        | finalize 或补保存                                              | 恢复提示关闭                          | summary/detail 合并                      | recovery IPC                             | handle lock                  | 失败保留 marker                       | 不把 not-found 当成功          | 可重复重试                   |

## 数据模型映射

### Workspace

当前来源：

- `.reo/workspace.json`：`schemaVersion`、`workspaceId`、title、description、createdAt。
- Workspace snapshot：`workspaceId`、title、description、`memories[]`。
- main-owned registry：保留 rootPath，但 renderer 不可见。

页面使用：

- titlebar 显示 Workspace title。
- sidebar 显示 memory space registry 投影。
- Query key 使用 stable `workspaceId`。

### Memory

当前来源：

- `memories/<memoryId>/memory.json` 是 Memory 容器真源。
- `.reo/index.json` 的 `memories[]` 提供 summary：`memoryId`、title、createdAt、updatedAt、segmentCount、durationMs、audioByteLength、hasTranscript、attachmentCount。

目标页面需要的 detail projection：

```ts
type MemoryDetailProjection = {
  workspaceId: string;
  memoryId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  segmentCount: number;
  durationMs: number;
  attachmentCount: number;
  segments: SegmentProjection[];
};
```

规则：

- Memory title 是可变显示 metadata，不参与 durable directory identity。
- Memory detail 只读取当前 Memory 的 Segment，不能聚合 Workspace 全部 Segment。
- Memory 切换只切 current context，不进入独立 route。

### Segment

当前已实现：

- `audio` Segment finalized 到 `memories/<memoryId>/segments/<segmentId>/`。
- `segment.json`、`audio.webm`、`transcript.md` 共同表达 finalized audio segment。

目标 projection 建议：

```ts
type SegmentProjection = {
  workspaceId: string;
  memoryId: string;
  segmentId: string;
  type: 'audio' | 'note' | 'photo' | 'video' | 'imported_file';
  title: string;
  createdAt: string;
  updatedAt: string;
  durationMs?: number;
  thumbnail?: SegmentThumbnailProjection;
  transcript?: {
    exists: boolean;
    previewText?: string;
  };
  attachmentCount: number;
};
```

规则：

- `segmentId` 全局唯一，但读写必须携带 `memoryId`，不能通过全局 lookup 选择 first match。
- 当前页面不能把 Segment 直接作为 Memory。
- note/photo/video/imported_file 进入 runtime 前必须补文件结构、metadata schema、IPC、Query invalidation、恢复和测试。

### SegmentAttachment

目标语义：

- Attachment 只围绕某个 Segment 添加，不直接挂在 Memory 下替代 Segment。
- Attachment 需要 parent identity：`workspaceId`、`memoryId`、`segmentId`、`attachmentId`。
- 当前目标只允许从内容 tab 最右侧 `+` 菜单添加录音 attachment。
- Attachment 进入 runtime 前必须定义 attachment 类型、文件位置、删除影响、恢复策略和 UI 呈现。

目标 projection 建议：

```ts
type SegmentAttachmentProjection = {
  workspaceId: string;
  memoryId: string;
  segmentId: string;
  attachmentId: string;
  type: 'audio';
  title: string;
  createdAt: string;
  durationMs?: number;
};
```

规则：

- SegmentAttachment 录音不是同级 Segment，不能出现在 Memory 顶层 Segment 横向预览流里，除非后续产品明确设计 attachment 展开视图。
- SegmentAttachment 写入必须校验 parent Segment 仍属于当前 Memory。
- 切换 Segment、切换 Memory 或 parent Segment 被删除时，未保存 attachment draft 必须进入取消、保存失败或恢复路径，不能写到旧 parent。

### UI state

- `currentMemoryId`：loaded workspace frame local state。
- `selectedSegmentId`：Memory Studio local state。
- `activeContentType`：Memory Studio local state。
- `playbackState`：audio player local state。
- `isMemoryRailCollapsed`：WorkspaceFrame local state。
- `isFabOpen`：ExpressionDock local state。
- `showLeftButton` / `showRightButton`：Segment 横向预览流根据 overflow 和 scroll position 派生的 UI state。
- `segmentAttachmentMenuOpen`：内容 tab `+` 的 compact menu state。
- `pendingAction`：feature-local action lock。

## 边界情况与异常处理

| 场景                        | 触发条件                                       | 处理规则                            | 界面反馈              | 建议提示文案                       | 数据保护                | 验收                  |
| --------------------------- | ---------------------------------------------- | ----------------------------------- | --------------------- | ---------------------------------- | ----------------------- | --------------------- |
| 无权限                      | workspace handle 不存在或 sender 不匹配        | 拒绝读写，保留当前 UI               | root toast            | 当前记忆空间不可操作，请重新打开。 | 不写文件                | 无 unauthorized write |
| 权限过期                    | handle lock lost 或 microphone intent 过期     | 停止当前操作，要求重试              | toast 或恢复提示      | 当前操作已过期，请重试。           | 保留 draft/marker       | 不继续 stale write    |
| 工作区未打开                | 无 active workspace session 触发 Memory action | 忽略 action，引导打开 Workspace     | 空态                  | 先打开一个记忆空间。               | 无写入                  | 不调用 IPC            |
| 工作区句柄失效              | Workspace root 或 `.reo` identity 改变         | main 返回 lock lost                 | toast，保持旧 UI只读  | 记忆空间状态已变化，请重新打开。   | 不用旧 handle 写        | handle 不进 Query key |
| Memory 被删除               | detail 读取时 memory missing                   | 从 snapshot/detail 移除或回到未选择 | toast + Stage         | 这条记忆已不存在。                 | 不创建替代 Memory       | 不显示 stale title    |
| Segment 被删除              | selectedSegmentId missing                      | 选择首个 Segment 或进入空态         | toast 或 inline empty | 这个片段已不存在。                 | 停止播放并释放 Blob     | 不保留 stale media    |
| 数据加载失败                | detail IPC/read 失败                           | 进入 Memory error state，可重试     | inline retry + toast  | 记忆内容加载失败，请重试。         | 不清空已有 durable data | retry 成功恢复        |
| Workspace snapshot 失败     | 读取 snapshot 失败                             | 保留 shell，可重试                  | inline retry + toast  | 记忆空间加载失败，请重试。         | 不写空 snapshot         | retry 成功恢复        |
| 数据为空                    | Memory 无 Segment 或 tab 无内容                | 显示 scope 内空态                   | 空态 CTA              | 继续在这条记忆里记录。             | 不生成 mock             | 不展示假内容          |
| tab 内容为空                | transcript、note 或媒体内容不存在              | 显示 tab 内空态                     | inline empty          | 这个片段还没有对应内容。           | 不生成假内容            | 不触发无效 IPC        |
| 文件缺失                    | audio/transcript 文件缺失                      | 对应内容进入缺失态                  | inline warning        | 文件暂时不可读取。                 | 不重写缺失文件          | 其他 Segment 可用     |
| 音频文件损坏                | decode/play error                              | 停止播放，保留 Segment metadata     | toast + player error  | 音频无法播放，但片段信息仍保留。   | 不删除 segment          | player 不崩溃         |
| 播放失败                    | `play()` reject 或 Blob read fail              | 回到暂停态                          | toast                 | 无法开始播放，请稍后重试。         | 释放失败 Blob           | 按钮状态正确          |
| 转录文本缺失                | `transcript.md` 不存在或为空                   | 转录 tab 显示空态                   | inline empty          | 这个片段还没有转录。               | 不生成 mock transcript  | 空态不写文件          |
| 切换 Memory 过快            | 多个 detail 请求并发返回                       | 只接受最新 currentMemoryId 的结果   | loading 稳定          | 无                                 | 丢弃 stale response     | 不串写标题/content    |
| 切换 Segment 过快           | 多个 media read 并发                           | 只接受最新 segmentId 的结果         | player loading 稳定   | 无                                 | 丢弃 stale media        | 不串播放              |
| 重复点击                    | 连点 Memory、play、save、delete                | idempotent 或 action lock           | pending/disabled      | 正在处理，请稍候。                 | 不发重复 write          | 只有一次 mutation     |
| 重复保存                    | save pending 时再次提交                        | 禁止第二次提交                      | button disabled       | 正在保存。                         | 防止重复 Segment        | durable id 唯一       |
| 上传文件过大                | photo/video/file 未来进入且超过合同上限        | 阻止上传或后台导入                  | toast                 | 文件过大，请选择较小的文件。       | 不写半成品              | 无残留文件            |
| 上传格式不支持              | 文件类型不在合同内                             | 阻止导入                            | toast                 | 暂不支持这种文件格式。             | 不写文件                | 不进入列表            |
| 上传中断                    | 导入过程被打断                                 | recovery 或清理临时文件             | recovery 提示         | 文件导入未完成，可以重试。         | 临时文件隔离            | 不污染 index          |
| 删除失败                    | delete mutation 失败                           | 保留原数据                          | toast                 | 删除失败，请重试。                 | 不移除 cache            | 数据仍可见            |
| 页面关闭                    | recording/save/import pending                  | beforeunload 或确认保护             | confirmation/toast    | 当前内容还在保存，完成后再关闭。   | marker 或 draft 保留    | 强关后可恢复          |
| 刷新页面                    | pending 或 draft 存在                          | recovery 检查                       | 恢复提示              | 检测到未完成内容。                 | 文件真源优先            | 不丢 finalized audio  |
| 应用崩溃                    | 进程异常退出                                   | open 时 recovery/index reconcile    | 恢复提示              | 检测到未完成内容。                 | 文件真源优先            | 不丢 finalized audio  |
| 恢复未完成任务              | marker 或 durable marker 存在                  | 显示恢复动作                        | dialog                | 发现未完成记录，可以保存或放弃。   | marker 成功后清理       | 可重试                |
| 本地文件和 index 投影不一致 | `.reo/index.json` 陈旧或损坏                   | open/rebuild 协调合法文件           | loading/retry         | 正在恢复记忆索引。                 | 不把 read error 写成空  | 合法 Segment 可见     |
| 外部修改冲突                | 文件被其他进程修改                             | revision 校验，提示重载             | toast/dialog          | 内容已被更新，请重新加载。         | 不覆盖新文件            | 无 silent overwrite   |
| 小屏幕适配                  | 宽度不足以显示三栏                             | rail 可折叠，内容区保持主体验       | responsive layout     | 无                                 | 不改变数据              | 文本不重叠            |
| 低性能设备                  | Segment 多、音频长、图片多                     | lazy load、peaks、虚拟化入口        | skeleton/渐进加载     | 无                                 | 不阻塞保存              | 操作响应可接受        |
| 辅助功能可用性              | 键盘、读屏、reduced motion                     | 提供 role/name/focus/reduced motion | focus ring/tooltip    | 控件名称清晰                       | 无                      | 全键盘路径可达        |

## 权限规则

| 权限场景                | 判断点                        | 处理规则                                        |
| ----------------------- | ----------------------------- | ----------------------------------------------- |
| Workspace handle 不存在 | main process                  | 拒绝读写，renderer 使用 root toast              |
| sender 不匹配           | main process                  | 拒绝 IPC                                        |
| lock lost               | main process                  | 返回 lock lost error，UI 进入只读或要求重新打开 |
| root identity 改变      | main process                  | 停止写入，提示重新打开                          |
| mic permission 未授权   | 用户明确点击录音后            | 请求权限，失败 toast                            |
| 文件读取无权限          | read media/detail             | inline error，不删除数据                        |
| 保存无权限              | mutation                      | 保留 draft，提示重试或重新打开                  |
| 只读模式                | Workspace 判断                | 允许浏览，禁用新增、删除、保存                  |
| 第三方服务不可用        | 未来 ASR、AI 或 waveform 服务 | 降级为空态或本地能力，不生成假结果              |

## 验收标准

### 产品验收

- 用户能从右侧 Memory rail 选择不同 Memory，中间区域只切换当前 Memory 的常态页。
- 用户能识别当前 Workspace、当前 Memory、Memory 元信息、Segment 顺序、当前 Segment 和当前内容 tab。
- FAB 保留，并在当前 Memory 内继续表达；录音不强制新建 Memory。
- 内容 tab 最右侧 `+` 打开 SegmentAttachment 添加菜单，当前只显示添加录音；它不新建 Memory，也不新建同级 Segment。
- Segment 横向预览流在发生横向溢出时显示 `CarouselArrowButton` 左右浏览按钮，未溢出或到达边界时隐藏对应按钮。
- 页面不展示 workspace feed、全局时间线、伪 AI、伪推荐或 mock media。
- 未实现类型明确不可用或显示空态，不触发 runtime surface。

### 工程验收

- 不新增独立 Memory detail route。
- Memory detail query key 不包含 `workspaceHandle` 或 raw path。
- Segment timeline 只来自当前 Memory detail projection。
- finalized audio playback 进入实现前必须有安全 read contract，不能复用 unfinished draft read。
- 切 Memory、切 Segment、播放加载、保存返回都有 stale response guard。
- 录音 finalize 继续显式携带 `memoryId`。
- SegmentAttachment 录音保存必须显式携带 parent `memoryId`、`segmentId` 和未来 `attachmentId`，不能被当作同级 Segment finalize。
- Segment 横向预览流按钮显示由 `scrollLeft`、`clientWidth` 和 `scrollWidth` 派生，并在初始化、scroll、ResizeObserver、卡片数据变化和窗口尺寸变化后重新计算。
- 保存中、录音中、导入中和危险确认期间有切换保护。

### 数据验收

- Workspace 文件夹仍是用户内容真源。
- `.reo/index.json` 仍是可重建投影，不是内容真源。
- Memory、Segment、SegmentAttachment 层级不混淆。
- note/photo/video/imported_file/SegmentAttachment 不在没有合同的情况下写文件。
- SegmentAttachment 的首个目标类型是录音，写入位置必须围绕 selected Segment，而不是 Memory 顶层。
- 所有写入必须有 source of truth、owner、rollback/recovery 和 query update。

### UI 验收

- 视觉保持 Reo 设计系统：Eggshell/Card Glass、Obsidian、Chalk/Glass Border、Gravel/Slate、低饱和 Signal Blue/Ember 点缀。
- 不把每个模块做成重卡片容器。
- `CarouselArrowButton` 使用 40px 圆形 icon-only control、lucide chevron、Reo token 边界和 focus ring；隐藏时不保留点击区，不进入键盘焦点。
- 右侧 rail 不是弹窗；折叠时整体滑出并退出可访问树。
- icon-only 控件有 accessible name 和 tooltip。
- 文本在小屏和长标题下不溢出、不遮挡。

### Segment 横向预览流验收

- 卡片列表未发生横向溢出时，左右按钮都不显示。
- 卡片列表在最左侧时，左侧按钮不显示。
- 卡片列表在最右侧时，右侧按钮不显示。
- 卡片列表处于中间位置时，左右按钮都显示。
- 点击左侧按钮，卡片列表向左平滑滚动。
- 点击右侧按钮，卡片列表向右平滑滚动。
- 按钮只影响中上方卡片列表，不影响时间轴、音频播放区、转录区、正文内容区和右侧 Memory rail。
- 窗口缩放后，按钮显示状态能够重新计算。
- 新增或删除卡片后，按钮显示状态能够重新计算。
- 按钮隐藏后不可点击，也不会被键盘聚焦。

### 分项验收索引

| 编号 | 标准                                                                                     |
| ---- | ---------------------------------------------------------------------------------------- |
| P1   | 用户能从右侧 Memory rail 选择不同 Memory                                                 |
| P2   | 中央区域只展示当前 Memory 的内容                                                         |
| P3   | 用户能识别当前 Workspace、当前 Memory、Memory meta、Segment 顺序、当前 Segment、当前 tab |
| P4   | FAB 保留，并在有 current Memory 时将录音归属当前 Memory                                  |
| P5   | Workspace 没有任何 Memory 时，FAB 录音先进入新建 Memory 命名                             |
| P6   | 内容 tab 最右侧 `+` 打开 SegmentAttachment 添加菜单                                      |
| P7   | `+` 菜单当前只显示添加录音                                                               |
| P8   | `+` 不新建 Memory，不创建同级 Segment                                                    |
| P9   | Segment 横向预览流溢出时显示左右浏览按钮                                                 |
| P10  | 横向预览流未溢出或到达边界时隐藏对应按钮                                                 |
| P11  | 页面不展示 workspace feed、全局时间线、伪 AI、伪推荐或 mock media                        |
| P12  | 未实现类型明确不可用或显示空态，不触发 runtime surface                                   |
| E1   | 不新增独立 Memory detail route                                                           |
| E2   | renderer 不直接使用 Node 或 Electron API                                                 |
| E3   | Query key 不包含 `workspaceHandle` 或 raw path                                           |
| E4   | Memory detail 请求包含 `workspaceId`、`memoryId`、`requestId`                            |
| E5   | 旧 detail response 不覆盖当前 Memory                                                     |
| E6   | Segment playback load 绑定 `segmentId` 和 `mediaRevision`                                |
| E7   | 切 Segment 后旧 media callback 不改当前 UI                                               |
| E8   | finalized audio playback 有安全 read contract                                            |
| E9   | 不复用 unfinished draft read 读取 finalized audio                                        |
| E10  | 录音 Segment finalize 显式携带 `memoryId`                                                |
| E11  | SegmentAttachment 保存显式携带 `memoryId`、`segmentId`、`attachmentId`                   |
| E12  | SegmentAttachment 录音不进入顶层 Segment strip                                           |
| E13  | save/delete 有 pending lock 和 idempotency key                                           |
| E14  | 保存中、录音中、导入中、危险确认期间有切换保护                                           |
| E15  | mutation 成功后 immutable 合并或精准 invalidate                                          |
| E16  | app crash 或保存失败后可恢复 draft                                                       |
| E17  | `npm run verify:quick` 通过后才声明代码 slice 完成                                       |
| E18  | Electron runtime 视觉验证有截图或测量证据                                                |
| U1   | 视觉符合现有设计系统                                                                     |
| U2   | 不把每个模块做成重卡片堆叠                                                               |
| U3   | 右侧 rail 是固定区域，可折叠                                                             |
| U4   | rail 折叠后退出可访问树                                                                  |
| U5   | `CarouselArrowButton` 为 40px 圆形 icon-only control                                     |
| U6   | 横向按钮隐藏时不可点击，不可被键盘聚焦                                                   |
| U7   | icon-only 控件有 accessible name 和 Tooltip                                              |
| U8   | 长标题、长正文、小屏下不遮挡、不溢出                                                     |
| U9   | loading 不闪烁，错误状态可恢复                                                           |
| U10  | Toast 和 Tooltip 使用现有设计系统                                                        |

### 验证要求

- 本文档阶段不运行 TDD，因为没有行为代码改动。
- 进入实现阶段后，每个行为 slice 必须先写 RED 测试，再实现 GREEN，再 refactor。
- 任何代码 slice 声明完成前必须运行 `npm run verify:quick`。
- 视觉实现必须做 Electron runtime 视觉验证，并记录截图或测量证据。

## 实现进度

### 2026-05-10 05:42 America/Los_Angeles

- Slice 2 已用 `LoadedWorkspaceFrame.test.tsx` 复核：Workspace Stage Empty State 仍不显示 Memory timeline、workspace feed 或伪内容。
- Slice 3 已实现 Memory Studio 基础态：`workspace:readMemoryDetail`、Memory detail Query key、requestId stale guard、当前 Memory title/meta/空态和 finalized audio Segment 轻量 projection。
- Targeted 验证：`npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/workspaceQueries.test.ts src/renderer/src/workspace/workspaceApi.test.ts` 通过 3 files / 12 tests；`npm run test:main -- test/main/workspaceContract.test.ts test/main/workspaceBridgeSurface.test.ts test/main/workspaceIpc.test.ts` 通过 282 tests。
- 下一步从 Slice 3A 开始：Segment strip + timeline。当前 Slice 3 尚未实现横向卡片流、时间轴、CarouselArrowButton、finalized playback 或 SegmentAttachment 菜单。

### 2026-05-10 05:50 America/Los_Angeles

- Slice 3A 已实现 Segment 横向预览流、Memory 片段时间轴和当前片段内容区，三处 active 状态由 feature-local `selectedSegmentId` 同步。
- Targeted 验证：先运行 `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx` 得到 RED，失败点是找不到 `片段预览流`；实现后同命令通过 1 file / 9 tests。
- 下一步进入 Slice 3B：CarouselArrowButton 横向浏览控制。当前尚未实现 finalized audio playback、内容 tab、SegmentAttachment 菜单或 SegmentAttachment 录音。

### 2026-05-10 05:55 America/Los_Angeles

- Slice 3B 已实现 feature-local `CarouselArrowButton` 左右横向浏览控制。按钮只在对应方向可滚动时渲染；不可达方向不渲染，因此不可点击也不可被键盘聚焦。
- Segment 横向预览流现在在初始化、scroll、ResizeObserver 和 window resize 后重新计算左右按钮显示状态；点击左右按钮只滚动当前 Memory 的 Segment strip，不改变 selected Segment。
- Targeted 验证：先运行 `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx` 得到 RED，失败点是缺少 `memory-studio-segment-strip-scroll` scroll owner；实现后同命令通过 1 file / 10 tests。
- 下一步进入 Slice 4：Expression Dock 与录音入口整合。当前尚未实现 finalized audio playback、内容 tab、SegmentAttachment 菜单或 SegmentAttachment 录音。

### 2026-05-10 05:57 America/Los_Angeles

- Slice 4 已复核并收口：底部 Expression Dock 的 `录音` 在存在 current Memory 时打开 existing-memory recording target，不新建 Memory；没有 current Memory 时才进入 Memory 命名流程。
- Targeted 验证：`npm run test:renderer -- src/renderer/src/App.test.tsx -t "records from the loaded workspace FAB into the current existing Memory|requires a named Memory before recording when the workspace has no memories|finalizes a FAB recording against the current selected memory without creating a new memory|opens the recording overlay from the current memory stage FAB"` 通过 1 file / 4 tests，32 skipped。
- 下一步进入 Slice 5：录音中态工艺。当前尚未实现 finalized audio playback、内容 tab、SegmentAttachment 菜单或 SegmentAttachment 录音。

### 2026-05-10 05:57 America/Los_Angeles

- Slice 5 已复核并收口：录音 overlay 的录音前、录音中和暂停态保留沉浸式 surface；录音中显示动态 waveform、计时、实时文本区域、暂停和完成；极短录音先提示并保留当前录音。
- Targeted 验证：`npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx -t "renders the active recording state with dynamic waveform, timer, transcript and disabled locator controls|keeps waveform, copy, time and control slots aligned across recording states|warns before saving an extremely short recording and keeps recording active|passes the current memory target when recording from the current memory context"` 通过 1 file / 4 tests，63 skipped。
- 下一步进入 Slice 6：回放与 transcript 查看态。当前 Memory Studio 尚未实现 finalized audio playback、内容 tab、SegmentAttachment 菜单或 SegmentAttachment 录音。

### 2026-05-10 06:08 America/Los_Angeles

- Slice 6 已实现 Memory Studio selected finalized audio Segment 的本地 playback 和已保存 transcript 查看：新增 `workspace:readFinalizedAudioSegment`、Segment content Query key、requestId stale guard、Blob URL 播放/暂停和 transcript 空态。
- 当前采用原生 HTMLAudioElement + Blob URL；Context7 已核对 wavesurfer.js 官方能力，wavesurfer 支持 URL/Blob、play/pause 和 destroy，但本 slice 不做 waveform/scrubber，因此暂缓引入新依赖，等 long waveform/scrubber 进入范围再评估。
- Targeted 验证：`npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/workspaceApi.test.ts src/renderer/src/workspace/workspaceQueries.test.ts` 通过 3 files / 16 tests；`npm run test:main -- test/main/workspaceContract.test.ts test/main/workspaceBridgeSurface.test.ts test/main/workspaceIpc.test.ts` 触发 main 全套并通过 284 tests；`npm run typecheck` 通过。
- 下一步进入 Slice 7：内容 tab 与 SegmentAttachment `+` 菜单。当前尚未实现内容 tab、SegmentAttachment 菜单或 SegmentAttachment 录音。

### 2026-05-10 06:17 America/Los_Angeles

- Slice 7 已实现 selected Segment 内容 tab 与 SegmentAttachment `+` 菜单：audio Segment 默认只显示 `转录` active tab，不渲染常驻禁用的 `笔记`、`视频`、`图片` tab；`+` 打开 selected Segment 的 compact menu，菜单暴露录音补充项。
- 菜单 open 状态是 `MemoryStudio` feature-local state，切换 Segment 会关闭菜单；`+` 菜单不属于 tablist，不新建 Memory，不创建同级 Segment。
- Context7 已核对 Radix Dropdown Menu 官方行为：disabled item 使用 `disabled` prop 并暴露 `data-disabled`；当前实现用 controlled open state 和明确 menu accessible name 收口。
- Targeted 验证：先运行 `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "scopes content tabs"` 得到 RED，失败点是找不到 `片段内容类型` tablist；实现后同命令通过 1 file / 1 test，11 skipped。
- 下一步进入 Slice 8：SegmentAttachment 录音。进入 runtime 前必须先定义 parent `memoryId`、`segmentId`、attachment id、文件合同、IPC contract、Query 更新和恢复路径。

### 2026-05-10 07:11 America/Los_Angeles

- 用户补充目标图和批注后，本 session 将页面模型纠正为当前事实：右侧 Memory rail 是整体向右滑出/滑入并推动中央舞台和 FAB 的区域；内容 tab 不是常驻功能按钮，audio Segment 只有真实存在的 `转录` tab，笔记、视频、图片和补充录音都属于 SegmentAttachment 内容，不作为同级 Segment 或常驻禁用 tab。
- Slice 8 已实现 SegmentAttachment audio recording：新增 attachment id 合同、`.reo/drafts/attachments/<attachmentId>/` draft、`memories/<memoryId>/segments/<segmentId>/attachments/<attachmentId>/` finalized 文件合同、create/append/finalize/discard IPC、bridge/preload/renderer API、main 文件写入和 index projection。保存时返回 Memory summary、parent Segment projection 和 attachment projection；renderer 只更新 Workspace snapshot 和 parent Segment detail，不把 attachment 插入 Memory 顶层 Segment strip。
- SegmentAttachment 录音恢复 marker 使用 `targetKind: "segment-attachment"`、`parentSegmentId` 和 attachment id；恢复保存调用 attachment finalize，恢复放弃调用 attachment discard。当前 attachment 恢复不提供继续检查回听，因为 draft audio preview IPC 只定义了普通 Segment draft read。
- Memory Studio 已按目标图压紧首屏结构：当前 Memory 标题、Segment 横向预览流、Memory 内时间轴、播放条、动态内容 tab、`+` 菜单和 transcript 在同一主体验区内组织；right rail 折叠/展开的 stage padding 和 FAB right inset 有测试保护。
- Targeted RED/GREEN：`npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx -t "segment attachment recording"` 先因缺少 attachment recovery marker 失败，补齐 marker 后通过；`npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "transcript tab"` 先因旧 `笔记` disabled tab 失败，改为动态 tab 后通过。
- Targeted 验证：`npm run test:renderer -- src/renderer/src/App.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/workspaceApi.test.ts src/renderer/src/workspace/ForbiddenCapabilities.test.tsx` 通过 5 files / 121 tests；`npm run test:main -- test/main/workspaceContract.test.ts test/main/workspaceBridgeSurface.test.ts test/main/workspaceIpc.test.ts test/main/recordingDrafts.test.ts` 触发 main 全套并通过 287 tests；`npm run typecheck` 通过。

### 2026-05-10 08:45 America/Los_Angeles

- Slice 8A 补齐播放区真实 waveform：新增 `audioWaveform` 解码 helper，使用浏览器 `AudioContext.decodeAudioData` 读取 selected finalized audio bytes，并按窗口取跨声道峰值、归一化后交给播放区 `Waveform`；静音或解码失败不回退固定占位 bars。
- RED/GREEN：`npm run test:renderer -- src/renderer/src/workspace/audioWaveform.test.ts` 先因缺少 `audioWaveform` 失败，补齐 helper 后通过；`npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "decoded finalized audio bytes"` 先因播放区没有 `decoded-audio` source 失败，接入解码链路后通过。
- Targeted 验证：`npm run test:renderer -- src/renderer/src/App.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/audioWaveform.test.ts src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/workspaceApi.test.ts src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/components/ui/floating-action-button-speed-dial.test.tsx src/renderer/src/components/ui/button.test.tsx` 通过 8 files / 140 tests；`npm run typecheck` 通过；`npm run format:check` 通过。
- Electron runtime 视觉验证：`REMOTE_DEBUGGING_PORT=9233 npm run dev`，CDP viewport `1600x1000`，截图 `docs/specs/2026-05-10-0443-memory-normal-page-design/artifacts/memory-studio-real-waveform-runtime-2026-05-10T0845.png`；测量结果：document/body height 均为 `1000`、`windowScrollY=0`，playback waveform `data-waveform-source="decoded-audio"`，tabs 只有 `转录`，无 `audio ·` 重复 summary，无常驻 `笔记/视频/图片` tab。

### 2026-05-10 09:27 America/Los_Angeles

- Slice 9 已实现 Memory 删除与本次恢复：MemoryRail More 菜单新增 `删除记忆`，`MemoryDeleteDialog` 确认前不写文件；确认后 `workspace:deleteMemory` 把 active `memories/<memoryId>/` 移入 `.reo/trash/memories/<memoryId>/` 并刷新 `.reo/index.json`，返回 `restoreToken` 和刷新后的 `memories[]`；toast action 调用 `workspace:restoreDeletedMemory` 把同一 Memory 从恢复区移回 active memories。
- Renderer 删除成功后只用 mutation response 更新 Workspace snapshot 和 session state，移除被删 Memory detail cache；如果删除的是当前 Memory，则切到剩余第一条 Memory 或回到 Workspace Stage。删除和恢复都不做 optimistic update，不暴露 root path、trash path 或 workspace handle。
- Context7 已核对 TanStack Query 官方能力：mutation success 可以用 immutable `setQueryData` 写入 response，optimistic update 需要 cancel/snapshot/rollback；当前 delete/restore 不采用 optimistic update。Context7 已核对 Radix Dialog/AlertDialog controlled `open/onOpenChange` 和异步关闭模式；当前确认 dialog 使用 controlled open、pending guard 和确认后关闭。
- RED/GREEN：先运行 `npm run test:main -- test/main/workspaceContract.test.ts test/main/workspaceBridgeSurface.test.ts test/main/workspaceIpc.test.ts` 得到缺少 delete/restore channel、schema、bridge 和 IPC handler 的失败；补齐合同、preload、main file truth 与 IPC 后，同命令通过 main 全套 289 tests。先运行 `npm run test:renderer -- src/renderer/src/App.test.tsx src/renderer/src/workspace/workspaceApi.test.ts -t "Memory deletion|workspace file methods"` 得到缺少 renderer API/删除 UI 的失败；补齐 `MemoryDeleteDialog`、MemoryRail 菜单和 App mutation 后通过 2 tests。
- Targeted 验证：`npm run test:renderer -- src/renderer/src/App.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/workspaceApi.test.ts src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/workspace/audioWaveform.test.ts src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/components/ui/floating-action-button-speed-dial.test.tsx` 通过 7 files / 136 tests；`npm run typecheck` 通过；`npm run format:check` 通过。
- Electron runtime 视觉验证：CDP viewport `1600x1000`，截图 `docs/specs/2026-05-10-0443-memory-normal-page-design/artifacts/memory-studio-delete-dialog-runtime-2026-05-10T0921.png`；测量结果：document/body height 均为 `1000`、`windowScrollY=0`，delete dialog role/name 为 `删除记忆`，dialog 文案说明“片段和补充录音会先进入恢复区。”，tabs 只有 `转录`，无常驻禁用 tab。
- 设计系统纠正：Reo 当前设计系统总结为现代扁平矢量插画风 + 毛玻璃 + 北欧极简 + 日式留白；北欧极简落到低饱和度色彩和克制设计语言，现代扁平矢量插画落到几何图形和无描边内容对象，毛玻璃落到背景模糊和半透明空间聚焦，日式留白落到大面积负空间和不对称平衡。所有组件视觉必须追溯到 Reo token、primitive variant 或已记录 pattern；本次把旧 token 设计备份到 `artifacts/token-backup-2026-05-10-pre-nordic-glass/`，并将 runtime/design-system token 切换为 Nordic + Card Glass + On Accent + Glass Border + glass blur/shadow 体系。

### 2026-05-10 10:19 America/Los_Angeles

- Token/pattern sub-slice 已按用户补充标准落到 runtime 和 design-system 真源：`src/renderer/src/theme.css`、`docs/current/design-system/theme.css`、`variables.css` 和 `tokens.json` 使用 Nordic low-saturation palette、Card Glass、On Accent、Glass Border、glass blur 和命名 shadow。业务组件不再使用 `card-white` 类或 `shadow-subtle-*` 旧编号类；旧 token 设计已备份到 `docs/specs/2026-05-10-0443-memory-normal-page-design/artifacts/token-backup-2026-05-10-pre-nordic-glass/`。
- RED/GREEN：`npm run test:renderer -- src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/components/ui/dropdown-menu.test.tsx src/renderer/src/components/ui/floating-action-button-speed-dial.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx` 先因旧 `rounded-[22px]` / `bg-card-white` / “无 shadow” 视觉契约失败；测试更新为 glass-vector token 契约并实现后，通过 5 files / 105 tests。
- Build 验证：`npm run build` 通过，包含 `typecheck` 和 `electron-vite build`，确认 Tailwind v4 可生成 `bg-card-glass`、`text-on-accent`、`border-glass-border`、`backdrop-blur-glass-*` 和 `shadow-glass` 等新 utilities。
- Electron runtime 视觉验证：`REMOTE_DEBUGGING_PORT=9233 npm run dev`，CDP viewport `1600x1000`。暗色截图：`artifacts/memory-studio-nordic-glass-runtime-2026-05-10T1018.png`；浅色截图：`artifacts/memory-studio-nordic-glass-light-runtime-2026-05-10T1019.png`。测量结果：document/body height 均为 `1000`、`windowScrollY=0`、dialog count `0`、`cardWhiteClassCount=0`、`shadowLegacyClassCount=0`、tabs 只有 `转录`、playback waveform source 为 `decoded-audio`、无常驻 `笔记/视频/图片` tab。浅色 root token：Eggshell `#f2f0eb`、Card Glass `rgb(255 255 255 / 0.3)`、On Accent `#f2f0eb`、Glass Border `rgb(255 255 255 / 0.5)`、Shadow Glass `0 8px 32px 0 rgb(122 139 128 / 0.1)`、Blur Glass LG `24px`。

### 2026-05-10 10:27 America/Los_Angeles

- Slice 10 已完成性能与可访问性收口的当前范围：Segment strip 横向浏览在 `prefers-reduced-motion: reduce` 下使用 `behavior: "auto"`，普通模式仍使用 smooth scroll；playback waveform slider 增加 `aria-orientation="horizontal"`、`aria-valuetext`，并保留 ArrowLeft/ArrowRight 5 秒 seek、Home/End 起止定位。
- RED/GREEN：`npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "reduced motion|playback slider value"` 先因 reduced-motion 仍调用 smooth scroll、slider 缺少 orientation/value text 失败；补齐实现后通过 1 file / 2 tests。随后 `npm run test:renderer` 通过 24 files / 213 tests。
- Electron runtime a11y 快检：CDP viewport `1600x1000`，Memory Studio 文档高度 `1000`、body height `1000`、`scrollY=0`、可见未命名 button/link 数量为 0、playback slider 暴露 `orientation=horizontal`、`valueText=00:00 / 00:05`、`tabIndex=0`、`data-waveform-source=decoded-audio`。

### 2026-05-10 10:36 America/Los_Angeles

- Slice 11 已完成 Electron runtime 视觉证据与 current 真源同步收口。已记录浅色/深色 Memory Studio 截图、delete dialog 截图、真实 waveform 截图和 a11y 测量；关键测量均确认 document/body height 等于 viewport height、`scrollY=0`、只有真实 `转录` tab、无重复 selected Segment summary、playback waveform 来源为 decoded finalized audio。
- `docs/current/product.md`、`docs/current/data.md`、`docs/current/flow.md`、`docs/current/frontend.md`、`docs/current/quality.md` 和 `docs/current/design-system/*` 已同步当前实现：Memory / Segment / SegmentAttachment 层级、delete/restore、SegmentAttachment 录音、真实 playback waveform、FAB current Memory 录音、glass-vector token/pattern、性能与可访问性规则均写入当前真源。
- 格式与旧 token 残留检查：`npm run format:check` 通过；`rg "Card White|card-white|8px radius|8px 方圆|16-24|22px radius|shadow tokens resolve|flat vector color|#0447ff|#ff4704|#3d75d8|#fdfcfc|#000000|#ffffff|#57534f" docs/current src/renderer/src -n` 只命中测试中的旧 `card-white` 负向断言。

### 2026-05-10 10:37 America/Los_Angeles

- Slice 12 已完成最终验证：`npm run verify:quick` 通过。命令链路包括 `typecheck`、`test:main`、`test:renderer`、`lint` 和 `format:check`；本次输出确认 main 289 tests passed、renderer 213 tests passed，lint 和 format check exit 0。
- `docs/initiatives/2026-05-08-memory-studio-design-convergence/tasks.md` 中常态 Memory 页面相关任务已全部勾选完成。

### 2026-05-10 11:13 America/Los_Angeles

- 补齐用户指出的补充录音展示路径：Memory detail 的 Segment projection 现在包含 finalized `attachments[]`；selected Segment 存在 finalized attachments 时，Memory Studio 显示 `补充` tab；补充录音在该 tab 内以与主片段播放条一致的 play/pause、真实 waveform slider、seek 和等宽时间 UI 展示，不显示 transcript 占位。
- 新增 `workspace:readFinalizedAudioSegmentAttachment` 合同、preload bridge、main IPC handler 和 renderer Query；Query key 为 `['workspace', 'segment-attachment-content', workspaceId, memoryId, segmentId, attachmentId]`，request 携带 `workspaceHandle` 但 Query key 不包含 handle 或 raw path，response 只返回 bounded audio bytes 和 audioByteLength。
- RED：`npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "recording supplements"` 先因找不到 `补充` tab 失败；`npm run test:main -- test/main/workspaceContract.test.ts` 先因缺少 attachment audio read channel/schema 失败。
- GREEN targeted：`npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "recording supplements"` 通过 1 file / 1 test；`npm run test:main -- test/main/workspaceContract.test.ts test/main/workspaceBridgeSurface.test.ts test/main/workspaceIpc.test.ts` 触发 main 全套并通过 290 tests；`npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/workspaceApi.test.ts src/renderer/src/App.test.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/workspace/CreateWorkspaceForm.test.tsx` 通过 6 files / 139 tests；`npm run typecheck` 通过。
- 安全补强 RED/GREEN：自查发现 attachment audio read 需要显式拒绝 symlinked `attachments/` parent；新增 `readFinalizedAudioSegmentAttachment rejects a symlinked attachments parent` 后，`npm run test:main -- test/main/workspaceIpc.test.ts` 先失败为错误地返回 `ok: true`，补齐 parent directory identity 校验后同命令通过 main 全套 291 tests。
- 新增补充可见性 RED/GREEN：`npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "moves newly created SegmentAttachment"` 先失败为第一条补充出现后 `补充` tab 仍未选中；实现 selected Segment attachments 0 -> >0 过渡检测后，同命令通过 1 file / 1 test。随后补充录音读取失败状态同一测试先因找不到 `role="status"` 失败，补齐行内 `补充录音加载失败。` 状态后通过。
- Electron runtime 视觉验证：`REMOTE_DEBUGGING_PORT=9233 npm run dev`，CDP viewport `1600x1000`，截图 `docs/specs/2026-05-10-0443-memory-normal-page-design/artifacts/memory-studio-supplements-runtime-2026-05-10T1148.png`；测量结果：document/body height 均为 `1000`、`windowScrollY=0`、`补充` tab selected、main waveform 和 supplement waveform 都存在、supplement waveform `data-waveform-source="decoded-audio"`、supplement slider `aria-valuetext="00:00 / 00:02"`、无 transcript 占位、无常驻 `笔记/视频/图片` tab。
- `docs/current/product.md`、`docs/current/data.md`、`docs/current/flow.md`、`docs/current/frontend.md`、`docs/current/electron.md` 和 `docs/current/quality.md` 已同步补充 tab、SegmentAttachment audio content Query、parent-scoped IPC read、第一条新增补充自动进入 `补充` tab、补充录音读取失败可见状态和无 transcript 的补充录音播放器规则。
- Final verification：`npm run verify:quick` 通过；命令链路包括 `typecheck`、main 291 tests、renderer 215 tests、lint 和 format check。

### 2026-05-10 12:26 America/Los_Angeles

- 设计系统审计收敛：Memory Studio 主片段播放行和 SegmentAttachment 补充录音播放行收敛为 feature-local `memory-studio-audio-player` pattern；Segment card 的 title/status/duration 从局部 `17px/15px/13px/0.04em` 改回 `text-subheading`、`text-ui-md`、`text-body-lg` 和 `tracking-wide`。这次没有新增页面专用 token，而是删除旧编号 typography steps、未消费 `2xl-2/3xl-2` radius alias 和未消费 `element-gap` root alias。
- RED/GREEN：`npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "shows finalized recording supplements"` 先因播放行缺少统一 `data-component="memory-studio-audio-player"` 失败，实现共享播放行后通过；`npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "renders Segment recording cards"` 先因卡片仍使用局部字号失败，切回系统字号后通过。
- Targeted 验证：`npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx` 通过 21 tests；`npm run typecheck` 通过；`npm run test:renderer` 通过 24 files / 215 tests；`npm run format:check` 通过。
- Electron runtime 视觉验证：`REMOTE_DEBUGGING_PORT=9233 npm run dev`，CDP viewport `1600x1000`。浅色截图：`artifacts/memory-studio-design-system-audit-light-2026-05-10T122640.png`；深色截图：`artifacts/memory-studio-design-system-audit-dark-2026-05-10T122640.png`。测量结果：document/body height 均为 `1000`、`scrollY=0`、Segment card count `4`、active card rect `216x216`、title class 为 `text-subheading font-bold leading-subheading`、duration class 为 `font-geist-mono text-body-lg font-bold tracking-wide`、tabs 只有 `转录/补充` 且 `补充` selected、主播放和补充播放都使用 `grid-cols-[40px_minmax(0,1fr)_auto]` + `gap-14`、两条 waveform source 都是 `decoded-audio`、无未命名 button、无 transcript 占位、无 `笔记/视频/图片` 常驻 tab。
- Final verification：`npm run verify:quick` 通过；命令链路包括 `typecheck`、main 293 tests、renderer 215 tests、lint 和 format check。

## 待确认问题

1. 长音频 waveform 的性能策略需要继续评估：当前播放区已经从 finalized audio bytes 解码真实峰值；更长音频进入 runtime 前需要确认 peaks cache、lazy decode、wavesurfer peaks 或 main-side 预计算策略。
2. note/photo/video/imported_file 的优先顺序需要单独按产品主链确认，不能因为 tab 或 `+` 菜单已出现就同时实现。
3. 当前没有账号体系；若未来出现登录、同步或云端能力，需要单独补登录失效、同步失败和本地草稿保留规则。
4. 当前 Memory 删除支持本次 toast 恢复；长期 trash 浏览、自动清理策略和跨会话恢复入口尚未进入当前 runtime。
5. Memory rail 折叠动画、宽度和小屏优先级以 Reo 设计系统和 Electron runtime 视觉验证为准。
6. 长 transcript 的时间高亮策略需要结合最终 transcript segment 数据结构确认。
7. 第三方能力接入以官方文档和实际接口协议为准，当前规格只定义页面消费结果和降级策略。

## 推荐研发拆分

| Slice    | 目标                      | 主要产出                                                | 验收                             |
| -------- | ------------------------- | ------------------------------------------------------- | -------------------------------- |
| Slice 1  | Memory Studio 基础态      | `currentMemoryId`、Memory detail query、标题 meta、空态 | 能选 Memory 并展示当前 Memory    |
| Slice 2  | Segment strip + timeline  | Segment projection、`selectedSegmentId`、active 同步    | 卡片、时间轴、内容区同步         |
| Slice 3  | `CarouselArrowButton`     | 横向溢出检测、左右滚动、`ResizeObserver`                | 通过横向预览流专项验收 C1 到 C12 |
| Slice 4  | finalized audio playback  | audio read contract、播放器、Blob 生命周期              | 可播放、暂停、seek、失败可恢复   |
| Slice 5  | 内容 tab                  | `activeContentType`、转录空态、未实现类型 disabled      | 不触发 mock 或无合同 IPC         |
| Slice 6  | FAB current Memory 录音   | recording target、finalize `memoryId`、cache 更新       | 新 Segment 进入当前 Memory       |
| Slice 7  | SegmentAttachment 录音    | `+` 菜单、parent target、attachment finalize            | 写入 selected Segment attachment |
| Slice 8  | 危险操作和恢复            | delete confirm、busy guard、recovery marker             | 删除、保存失败、crash 可处理     |
| Slice 9  | 性能和可访问性收口        | virtualize 入口、focus、reduced motion                  | 键盘和小屏可用                   |
| Slice 10 | Electron runtime 视觉验证 | 截图、测量、verify                                      | 符合设计图和 Reo 设计系统        |

## 最终交付目标总结

本次任务最终要交付的是 Reo 记忆空间内选中某个 Memory 后的常态 Memory 页面设计说明：用户目标是在一个清楚的 Workspace / Memory 语境中回看、播放、阅读并继续补充自己的记忆；产品体验目标是保持安静、克制、低干扰、有时间感的 Memory Studio，而不是录音沉浸态、详情路由、全局 feed 或文件管理器；功能目标是让右侧 Memory rail 切换当前 Memory，中间区域展示当前 Memory 的标题、元信息、Segment 横向预览流、用于浏览溢出卡片的 `CarouselArrowButton` 左右按钮、时间轴、音频播放与波形、按 selected Segment 已存在内容动态出现的内容 tab、tab 最右侧 SegmentAttachment `+` 菜单、正文内容区和底部 FAB；核心状态必须覆盖记忆空间未选择、加载中、加载失败、记忆列表为空、Memory 未选择、Memory 常态浏览、Memory 切换中、Segment 为空、Segment 已选择、Segment 横向浏览、播放中、暂停中、内容切换、SegmentAttachment 菜单、新增 SegmentAttachment、新增 Segment、保存中、保存失败、危险确认、页面关闭或切换保护和可恢复状态；关键交互包括选择 Memory、选择 Segment、通过左右箭头平滑横向浏览片段卡片、时间轴定位、播放暂停和 seek、切换真实内容 tab、通过 tab `+` 给 selected Segment 添加录音 SegmentAttachment、通过 FAB 给当前 Memory 添加同级 Segment、折叠右侧 rail、处理 toast/tooltip/空态/错误态；技术约束是 renderer 不直接使用 Node 或 Electron API，不新增 generic route/runtime，不把 handle 或 raw path 放进 Query key，不复用 unfinished draft read 读取 finalized audio，不把 SegmentAttachment 录音当成同级 Segment，不在 note/photo/video/imported_file 和非音频 SegmentAttachment 没有文件合同、IPC、Query 更新和恢复路径前触发 runtime；数据同步要求是 Workspace snapshot 继续由 TanStack Query 承载，Memory detail 需要稳定 query key 和 request identity，Segment 横向预览流按钮显示只由 DOM 滚动状态派生，mutation 成功后只 immutable 合并对应 summary/detail，旧异步结果必须丢弃；异常处理要求是所有加载、播放、保存、删除、权限、文件缺失、音频损坏、index 不一致、卡片滚动边界和切换竞态都有可见反馈、重试、隐藏控件或恢复路径；权限处理要求是 main process 继续拥有 workspace handle、lock、file truth 和 microphone intent，renderer 只通过窄 preload contract 调用产品能力；数据安全要求是 Workspace 文件夹仍为用户内容真源，`.reo/index.json` 只是可重建投影，保存和删除必须有事务边界、防重复提交、回滚或 data retention，SegmentAttachment 写入必须携带 parent `memoryId` 和 `segmentId`；可恢复要求是录音和未来可编辑内容在关闭、崩溃、保存失败或 transcript 保存失败后仍能保存、继续检查、放弃或重试；最终验收方向是工程师可以据此拆出 Memory Studio 基础态、Segment 横向预览流滚动控制、finalized audio playback、SegmentAttachment 录音、独立 note/photo/video/imported_file Segment 的后续实现 slice，并且每个 slice 都能用真实 TDD、current 文档同步、Electron runtime 视觉验证和 `npm run verify:quick` 收口。

# 记忆空间体验收敛计划

## 设计映射

目标设计内容保持不变，进入 Reo 时只替换视觉系统和工程边界。

- 左侧 sidebar 保持当前 Reo AppShell sidebar，不作为本轮设计重构对象。
- 主内容区是 loaded workspace frame：AppShell panel titlebar、中央 stage、右侧 memory rail、底部 expression dock。
- 右侧 memory rail 是 Workspace 层级导航，展示当前 workspace 中的全部 Memory；它不展示单个 Segment 详情。
- 中央 stage 承载两种核心形态：未选中 Memory 时的 Workspace Stage，以及选中 Memory 后的 Memory Studio。
- Memory Studio 使用片段时间线表达当前选中 Memory 的生长关系；时间线里的小卡片是这一条 Memory 内的 Segment。
- 中间片段时间线不能表示整个 workspace 的全部内容，不能做成 workspace feed、日志流、文件流或社交动态流。
- Segment 横向预览流需要在发生横向溢出时显示 `CarouselArrowButton direction="left"` 和 `CarouselArrowButton direction="right"`；按钮只滚动卡片流，不播放、不选择、不编辑、不删除。
- 内容 tab 最右侧 `+` 是 selected Segment 的 SegmentAttachment 添加菜单入口；当前只允许添加录音 attachment，不新建 Memory，也不创建同级 Segment。
- 底部 dock 是表达入口，不是全局工具栏；只有真实行为可以执行，不可用 action-shaped 位置只用于表达 SpeedDial 展开态布局。

## 组件边界

组件优先保持 feature-local；只有出现真实复用压力或稳定不变量时才上提。

- `AppShell`：保留窗口 titlebar、sidebar、resize、theme 和顶层导航责任。
- `WorkspaceFrame`：loaded workspace 的三面板布局、右侧 rail 和 dock 插槽；workspace 标题和右侧 rail 折叠 control 由 AppShell panel titlebar 承载。
- `MemoryRail`：当前 workspace 的 Memory 列表、选中态、空态和打开 Memory 事件；不拥有 Segment 详情。
- `WorkspaceStage`：无选中 memory 时的表达舞台。
- `MemoryStudio`：选中 Memory 后的标题、meta、当前 Memory 的 Segment timeline、fragment strip、fragment content 和 action row。
- `CarouselArrowButton`：Segment 横向预览流的左右辅助浏览按钮；隐藏时不保留可点击区域，不进入键盘焦点。
- `SegmentAttachmentMenu`：内容 tab 最右侧 `+` 的 compact menu；当前只允许给 selected Segment 添加录音 attachment。
- `ExpressionDock`：把当前业务 action 映射给 Floating Action Button Speed Dial；录音是可执行 action，其它 action-shaped 位置保持不可用且不触发 runtime。
- `RecordingComposer`：录音准备、录音中、暂停、完成和失败恢复入口。
- `AudioFragmentPlayer`：finalized audio segment 的本地播放、真实音频 bytes 解码 waveform、scrubber 和时间信息。

## 状态与数据归属

- App 继续拥有 active workspace session、顶层 view、选中 memory 和 recording target。
- Main-backed data 继续通过 TanStack Query：memory space list 和 workspace snapshot。
- Memory rail 使用当前 workspace snapshot 的 `memories[]` 投影。
- 当前 Memory context 只使用 workspace snapshot 的 `memories[]` 投影。Memory Studio 进入 runtime 前必须先定义 detail projection、query key、文件合同和恢复路径。
- Segment timeline 进入 runtime 前必须来自当前 Memory 的明确 detail projection，不从 workspace snapshot 或跨 Memory 聚合中推导。
- Segment 横向预览流的左右按钮显示来自 DOM scroll state 派生，不写入 Query、文件或持久化 store。
- SegmentAttachment 菜单属于 selected Segment 的局部 UI state；切换 Segment、切换 Memory 或进入保存中时关闭，避免 attachment 写入旧 parent。
- Expression dock 的当前模式属于局部 UI state；没有跨 subtree 压力前不引入 Zustand。
- 录音 lifecycle、Blob URL、autosave draft、elapsed timer 和 close protection 继续属于 recording feature-local state。
- 图片、视频、imported_file 和独立笔记在实现前必须先定义 `Segment` 文件合同、main IPC、Query invalidation 和恢复路径。
- SegmentAttachment 录音在实现前必须定义 parent `memoryId`、`segmentId`、attachment id、文件合同、main IPC、Query invalidation、恢复 marker 和 index projection。

## 基础设施审查门

每个 slice 实现前允许并要求 agent 做一次窄范围基础设施审查。审查目标是确认当前 slice 是否被缺失的技术栈基础阻断，而不是提前建设全平台。

审查范围：

- React 19 + TypeScript：组件边界、state reset、derived state、类型收窄和 renderer Node/Electron import 边界。
- Vite/electron-vite：renderer/main/preload build 边界是否足够支撑当前 slice。
- Tailwind CSS v4：是否需要新增 token、theme variable、usage rule 或 runtime theme 投影。
- shadcn/ui + Radix primitives：是否已有合适 primitive；新增 source 是否有真实 consumer。
- Zustand + TanStack Query：是否需要新 Query key、invalidation、cache owner 或跨 subtree client state owner；没有真实跨 subtree state 不引入 Zustand。
- React Hook Form + Zod：是否需要表单 owner 或 runtime boundary schema。
- Better Auth Electron、Drizzle ORM、`better-sqlite3`、electron-updater、Electron Forge、Sentry 和 `electron-log`：默认未启用；只有当前 slice 明确需要 auth、DB、packaging、updater、logging 或 error reporting 时才进入设计和安装。
- date-fns：只用于真实日期格式化 consumer。
- Vitest：每个行为 slice 先写能失败的行为测试，再实现。

审查输出：

- `needs`: 当前 slice 必须补的基础设施。
- `defer`: 技术路线中存在但当前 slice 不需要建设的项。
- `blocked`: 如果当前 slice 不能在没有某项基础设施时正确实现，先停在设计或基础设施 slice，不做假 UI。

## 官方与开源采用依据

- React：组件 state 按 UI tree 位置保存；需要切换 memory 或 session 时优先使用明确 key 或位置边界重置局部 state；派生 UI 数据优先在 render 期间计算，不用 effect 复制状态。
- Tailwind CSS v4：Reo tokens 保持在 `@theme static` 和同名 CSS variables 中，新增视觉状态先补 token 或 usage rule，再落业务组件 class。
- shadcn/ui：采用 source-owned 组件模式，新增 primitive 必须复制到项目源码、retokenize 到 Reo visual rules，并立即被真实 consumer 使用。

## 分阶段实现顺序

### 1. Loaded Workspace Frame

目标：先重构 loaded workspace 的布局骨架，不改变文件模型和录音事务。

范围：

- 新增 `WorkspaceFrame`、`MemoryRail`、`ExpressionDock` 的最小 runtime 结构。
- AppShell 继续只负责窗口和现有 sidebar；不改 sidebar 导航项、记忆空间列表、resize、theme toggle 或 titlebar control。
- Loaded workspace 使用 AppShell panel titlebar 承载 workspace 标题和右侧 rail 折叠 control，内容区承载中央 stage、右 rail 和 dock。
- 右 rail 使用现有 snapshot `memories[]`，表示当前 workspace 的全部 Memory。
- 中央区先承载 Workspace Stage；不在 Slice 1 展示横向片段时间线。
- dock 使用 Floating Action Button Speed Dial，录音是当前唯一可执行入口。
- 拍照、视频、上传和独立笔记位置保持不可用，不触发 runtime surface。

验证：

- Testing Library 覆盖三面板结构、workspace title、right rail、dock 可访问名称、未实现能力负向断言。
- current frontend/product 文档同步。
- `npm run verify:quick`。

### 2. Workspace Stage Empty State

目标：把无选中 Memory 的空态改成 Workspace Stage，而不是空白页面、workspace feed 或全局内容时间线。

范围：

- 中央 stage 显示温和空态、当前记忆空间语境和开始表达入口。
- 右 rail 在空态仍展示当前记忆列表或空提示。
- 录音完成后的归属路径必须区分“新建 Memory”和“加入已有 Memory”；加入已有 Memory 后进入该 Memory Studio，新建 Memory 后刷新右侧 Memory 列表。
- 保持 Home、Library 和 workspace 的责任分离。

验证：

- 空 workspace、有 memories、search/list 失败三种状态可见。
- 不引入新实体或 DB。

### 3. Memory Studio 基础态

目标：为 Memory Studio 定义进入 runtime 所需的 detail projection、标题、meta、片段时间线、片段条和内容区结构。

范围：

- 定义 Memory detail query 的文件真源、query key、IPC contract、恢复路径和 renderer owner。
- 标题和 meta 只描述当前 Memory，例如片段数量、开始时间和最近更新时间。
- 片段条先只承载当前 Memory 内的 finalized audio segments。
- fragment content 先支持 audio segment 摘要、转写存在状态和继续记录 action。
- 右 rail 表达当前 memory 选中态。
- Segment 横向预览流和时间轴只展示当前 Memory 内的 Segment。

验证：

- detail query key 不包含 handle。
- recording preview 保持有界。
- 未实现 image/video/photo/file/AI command 负向断言。

### 3A. Segment 横向浏览控制

目标：让 Segment 横向预览流在卡片溢出时可浏览，但不增加播放、选择、编辑或删除语义。

范围：

- `CarouselArrowButton direction="left"` 向左平滑滚动 Segment 横向预览流。
- `CarouselArrowButton direction="right"` 向右平滑滚动 Segment 横向预览流。
- 未溢出时左右按钮都隐藏；最左隐藏 left；最右隐藏 right。
- 初始化、scroll、ResizeObserver、卡片数据变化和窗口尺寸变化后重新计算显示状态。
- reduced motion 下滚动动效降级。

验证：

- 未溢出、最左、最右、中间位置的按钮显示正确。
- 按钮只影响中上方卡片列表，不影响时间轴、播放器、正文或右侧 Memory rail。
- 按钮隐藏后不可点击、不可聚焦。

### 4. Expression Dock 与录音入口整合

目标：让录音入口成为 workspace/studio 的底部表达入口，而不是孤立页面按钮。

范围：

- `ExpressionDock` 激活录音模式。
- 保留当前 MediaRecorder durable capture、microphone intent、draft/finalize 事务和 autosave 行为。
- 桌面优先评估 in-stage recording composer；若保留 Vaul/Drawer，只作为明确交互选择或窄屏 fallback，不作为假目标实现。

验证：

- RED/GREEN 覆盖 dock 触发、忙碌态阻止关闭、失败恢复和 finalize 后刷新 snapshot。
- 录音事务 current 文档同步。

### 5. 录音中态工艺

目标：实现目标图中的录音中 surface：计时、动态 waveform、暂停、完成、本地保存安全提示和实时文本区域。

范围：

- 重新评估 ElevenLabs UI、wavesurfer.js 和 browser audio analyser。
- Waveform 必须来自真实录音信号或明确 fallback，不再把固定数组当最终产品状态。
- 暂停、继续、完成和失败态必须保留当前 durable draft 安全边界。

验证：

- MediaRecorder 行为测试和操作验证覆盖 record/pause/resume/stop。
- 视觉验证覆盖不同窗口尺寸和 reduced motion。

### 6. 回放与文本编辑态

目标：实现目标图中的录音回放、波形 scrubber、转录文本和继续表达/添加笔记/保存到记忆动作。

范围：

- 继续使用 finalized audio manifest/chunk read。
- 引入 long waveform/scrubber 前重新评估 wavesurfer.js 和 ElevenLabs Audio Player source。
- 转写只来自真实 ASR 或已保存文件；不生成假 STT。

验证：

- Blob URL 生命周期、chunk 并发、关闭后过期请求、autosave 失败保留 draft。
- 内容不丢失的错误恢复证据。

### 7. 内容 tab 与 SegmentAttachment `+` 菜单

目标：让内容 tab 只切换当前 selected Segment 的内容视图，并让 `+` 成为 selected Segment 的补充内容入口。

范围：

- 内容 tab 按 selected Segment 已存在内容动态显示；audio Segment 默认只有转录，笔记、视频、图片不作为常驻禁用 tab。
- tab 最右侧 `+` 打开 compact menu。
- 当前菜单只显示添加录音。
- `+` 菜单不新建 Memory，不创建同级 Segment。
- 切换 Segment、切换 Memory 或保存中关闭菜单。

验证：

- 无 selected Segment 时 `+` 禁用或隐藏。
- 选择添加录音后建立 attachment target，target 包含 parent `memoryId` 和 `segmentId`。
- 未实现类型不触发 IPC。

### 8. SegmentAttachment 录音

目标：让 selected Segment 可以添加录音补充内容。

进入条件：

- 定义 SegmentAttachment 文件合同、parent relationship、main write/read owner、Query invalidation、recovery marker 和 index projection。
- 更新 `docs/current/data.md`、`flow.md`、`frontend.md` 和 `quality.md`。

验证：

- attachment 录音不进入 Memory 顶层 Segment strip。
- parent Segment missing 时保存失败并保留可恢复 draft。
- finalize request 显式携带 `memoryId`、`segmentId` 和 attachment identity。

### 8A. Memory Studio glass-vector 视觉收敛

目标：让 Memory Studio 在 Reo 当前设计系统下达到现代扁平矢量插画风 + 毛玻璃 + 北欧极简 + 日式留白的气质，而不是功能罗列或粗糙 MVP。

范围：

- Reo 设计系统使用已命名 token、primitive variants、玻璃化空间聚焦、纯色块、实线边界、动态矢量波形和等宽数据标签。
- Token 体系使用 Nordic low-saturation palette、Card Glass、On Accent、Glass Border、glass blur 和命名 shadow；token 备份文件只存放在当前 spec artifacts，不作为 active design source。
- Memory Studio 主体验在首屏内组织 title、Segment cards、timeline、playback、tab、`+` 和 transcript。
- Segment card 使用扁平矢量 + 毛玻璃录音卡：aspect-square、Card Glass surface、2px token border、`--radius-panels`、标题直入、动态 waveform bars 和 Geist Mono duration。
- 卡片 waveform 使用固定高度数组、中心伸缩、错相节奏和分散 duration，避免整排同步上下律动。
- 删除 selected Segment 内容区上方重复 summary。
- FAB 保留 speed dial 结构展开动效；hover、active、glass 和 halo 必须来自 Reo 设计系统 token 或已记录 pattern。

验证：

- Renderer tests 覆盖 first-viewport studio surface、glass-vector visible surfaces、Segment card size/typography/waveform rhythm、no repeated Segment summary 和 FAB expansion motion。
- Electron runtime 截图或测量证明无页面纵向滚动、无静态禁用 tab、无重复 summary、卡片比例和波形节奏可见。

### 9. 危险操作和恢复收口

目标：补齐当前 Memory / Segment / SegmentAttachment 相关危险操作、失败保留和恢复路径，不扩大到未定义媒体类型。

范围：

- 删除、保存失败、parent missing、文件缺失、权限失效、index 不一致和页面关闭都必须有明确反馈或恢复。
- SegmentAttachment 录音恢复继续使用 parent `memoryId` / `segmentId`，不误写 Memory 顶层 Segment。
- note、photo、video、imported_file 继续保持不可用或无 runtime surface，直到文件合同、IPC、Query 更新和恢复路径定义完成。

### 10. 性能与可访问性收口

目标：确认常态 Memory 页面在当前数据规模和交互路径下可访问、可键盘操作、不卡顿。

范围：

- Segment strip 溢出、timeline、playback scrubber、tab、`+` 菜单、Memory rail、FAB 和 dialog 的 role、name、focus、keyboard path、reduced motion。
- Segment 多时保持当前横向浏览策略；出现真实性能压力前不引入虚拟化或复杂 abstraction。

### 11. Electron runtime 视觉和最终收口

目标：在 Electron runtime 中验证 Memory Studio 当前视觉与行为，并同步 current 文档、spec evidence 和 initiative 任务。

范围：

- 浅色/深色主题截图或测量。
- Memory rail 折叠/展开时中央舞台和 FAB 位移。
- no page scroll、no duplicate summary、dynamic tab、SegmentAttachment `+` 菜单、playback 和 FAB action。
- `npm run verify:quick` 最终通过后收口 initiative。

## 每个代码 slice 的共同完成标准

- 先写行为测试并跑出 RED。
- GREEN 只实现当前 slice。
- REFACTOR 后删除重复状态、重复 class、无意义 wrapper 和过早抽象。
- 同批更新相关 `docs/current/*`。
- 通过 `npm run verify:quick`。
- 使用 runtime 视觉验证确认与目标设计内容一致、与 Reo 设计系统一致。

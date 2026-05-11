# 前端

本文档是 React、样式、组件和 UI state 的当前真源。

## 当前事实

- Renderer 是 React 19 + TypeScript。
- Tailwind CSS v4 已安装，并通过 `@tailwindcss/vite` 接入 renderer build。
- Reo 设计系统源文件位于 `docs/current/design-system/`。
- Reo 设计系统包含 tokens、component shape、surfaces、glass-vector layering、layout 和 usage rules。
- 当前 styling foundation 使用 Reo 设计系统 token：浅色页面 `#fffffc`、浅色 sidebar `#fcf9f6`、深色页面 `#0d0d0d`、深色 sidebar `#161616`、深石板主文字、低饱和冷灰蓝中性色、卡片常态/选中填充、降噪 Signal Blue/Ember/Vector accents、Card Glass 毛玻璃 surface、实线边界、环境光阴影和现代扁平矢量内容对象。
- Renderer 可执行主题文件是 `src/renderer/src/theme.css`。
- Reo UI 技术框架已确认为 Tailwind CSS v4 + shadcn/ui + Radix primitives。
- shadcn/ui 当前 source 范围包含 `components.json`、renderer `@/*` alias、`components/ui/button.tsx`、`components/ui/input.tsx`、`components/ui/label.tsx`、`components/ui/dialog.tsx`、`components/ui/drawer.tsx`、`components/ui/dropdown-menu.tsx`、`components/ui/textarea.tsx`、`components/ui/tooltip.tsx`、`components/ui/separator.tsx`、`components/ui/field.tsx` 和 `lib/utils.ts`。
- 当前 `components/ui/floating-action-button-speed-dial.tsx` 是 Reo 的 Floating Action Button Speed Dial primitive，使用 PrimeReact SpeedDial mechanics 并映射到 Reo design system。
- Vaul 已作为 shadcn Drawer 的 dialog/dismiss mechanics dependency 引入。
- Sonner 已作为 toast mechanics dependency 引入；renderer root 使用 `ReoToaster` 统一承载非阻断操作提示。
- `Waveform` 是当前 Reo audio UI primitive；它不包含 agent runtime、network/API key、demo feedback 或未实现文案。
- 当前没有 shared local playback primitive；暂停态回听由 recording overlay 内部的隐藏 HTMLAudioElement 和 feature-local controls 承担。
- 当前 Radix primitives 安装并使用 `@radix-ui/react-slot`、`@radix-ui/react-label`、`@radix-ui/react-dialog`、`@radix-ui/react-dropdown-menu`、`@radix-ui/react-tooltip` 和 `@radix-ui/react-separator`。
- 当前真实 reusable component consumer 是 app shell、memory space starter home、memory space create dialog、memory space entry form、loaded workspace frame、recording overlay、recording control surface 和 root toast host。
- 当前 renderer 入口由 QueryClient provider 包裹。
- 当前 renderer route state 覆盖无 active memory space 的 starter Home shell 和已初始化或已打开 memory space 的 loaded shell。
- 当前无 memory space state 使用 `AppShell` + `WorkspaceStarterHome`；Home 主内容区不显示独立创建按钮，创建入口统一在 sidebar 记忆空间列表。
- 当前 loaded memory space state 使用 `AppShell` 包裹 loaded workspace frame；创建记忆空间通过受控 `WorkspaceCreateDialog` 弹层承载，不作为页面 route。
- 当前 `AppShell` 有 48px 无边框 titlebar shell slot；titlebar 使用 `--spacing-titlebar`，保持透明 Electron drag region，视觉上不画分隔线，窗口控制和 sidebar hide/show control 属于该层。AppShell root 和主内容 panel 使用 Page/Eggshell，左侧 sidebar 使用 Sidebar/Linen；两者在交界处直接相邻，不增加 underlay、glass 合成层、左侧投影或额外边界。主内容 panel 同步保留 48px panel titlebar slot，panel titlebar 只是 page panel 内的高度占位，不建立独立实色 surface；loaded workspace 的毛玻璃层级从 panel content 内的 WorkspaceFrame 开始。sidebar hide/show control 使用 80px 的 `--spacing-titlebar-control-left` 和 2px 的 `--spacing-titlebar-control-top` 定位，对齐原生 macOS traffic-light 行；workspace panel titlebar content 的垂直位置必须由 sidebar hide/show control 的 top、size 和 titlebar height 推导，确保 workspace 标题文字中心和右侧 MemoryRail 折叠 control 视觉中心都以左侧 sidebar hide/show icon 的视觉中心为基准。
- 当前 loaded workspace frame 使用 AppShell panel titlebar、中央 Workspace Stage 或 Memory Studio、右侧可折叠 MemoryRail 和底部 ExpressionDock；右侧 MemoryRail 读取当前 workspace snapshot 的 Memory 容器，卡片只展示 title、最近更新时间和片段数，并通过 DropdownMenu More 操作打开 memory rename Dialog 或 Memory delete confirmation Dialog；底部 ExpressionDock 使用 Floating Action Button Speed Dial，录音是唯一可执行 action，其他 action-shaped 位置只表达展开态布局。
- 当前点击右侧 MemoryRail 只切换 loaded workspace frame 的当前 Memory context，不进入独立详情 route。未选中 Memory 时中央显示 Workspace Stage；选中 Memory 后中央显示 Memory Studio，通过 Memory detail Query 读取当前 Memory 的 finalized audio Segment projection 和每个 Segment 的 finalized attachments projection，展示当前 Memory title、meta、空态、Segment 横向预览流、横向浏览按钮、时间轴和当前片段内容区。Segment card、时间轴点、播放区、内容 tab 和内容区通过 feature-local `selectedSegmentId` 同步，只作用于当前 Memory 内的 Segment。Segment card 使用现代扁平矢量 + 毛玻璃录音卡：aspect-square、无描边填充 surface、`--radius-panels`、标题直入、动态矢量 waveform bars 和 Geist Mono duration；卡片用 `bg-powder` 表达未选中、`bg-chalk` 表达选中，浅色模式卡片比页面更灰，深色模式卡片比页面更亮，不显示 `SEG 01`、`一个补充`、`已有转录` 或 `本地音频` 这类标签，不用常态 border 或 shadow 表达层级。Segment card width 使用 `--memory-studio-segment-card-min-size: 136px` 和 `--memory-studio-segment-card-size: clamp(var(--memory-studio-segment-card-min-size), 18vw, 148px)`，Segment item 与 card 都保留同一最小尺寸，窄窗口通过 strip 横向滚动承载，不压缩卡片内容。内部使用 `p-12`、`text-body` 标题、`max-w-[88px]` 标题文本框、`text-ui-sm` 等宽时间、52px × 32px waveform 区和 2px bars，让录音卡保持紧凑但不靠简单缩放。timeline marker 是无描边实心圆点，时间轴线穿过圆点中心，时间标签显示 Segment 创建时间并在圆点下方持续可见；三者固定在对应卡片下方居中，并随同一个 Segment item 横向滚动。active card 的 15 根 waveform bars 使用 `[30,50,70,40,60,30,40,80,90,50,30,40,40,60,80]` 高度、2px 宽度、中心伸缩、`reo-flat-wave` 0.5 到 1.2 scaleY keyframe、负 delay 和分散 duration，避免整排 bars 周期性同步成同一种上下律动。`CarouselArrowButton` 是 feature-local 40px 圆形 icon-only control，只在对应方向可滚动时出现，并只滚动 Segment 预览流。当前片段内容区通过 Segment content Query 读取 selected finalized audio Segment 的本地音频 bytes 和已保存 transcript，提供原生 audio Blob URL 播放/暂停和 transcript 查看；播放区 waveform 使用浏览器 AudioContext 解码 finalized audio bytes 后按窗口取真实峰值，静音保持为空/零值，不回退到固定占位波形。内容 tab 只展示 selected Segment 已存在的内容入口，audio Segment 始终有 `转录` tab；只有 selected Segment 存在 finalized attachments 时才显示 `补充` tab；当同一 selected Segment 从没有 finalized attachment 变为至少一个 finalized attachment 时，Memory Studio 自动选中 `补充` tab。`补充` tab 内的录音补充通过 SegmentAttachment audio content Query 读取本地音频 bytes，使用与主播放区一致的 play/pause、真实 waveform slider、seek 和等宽时间 UI，不展示 transcript；音频读取失败时只在该补充行显示失败状态，不切回 transcript，也不生成占位转录。`笔记`、`视频`、`图片` 不作为常驻禁用 tab 渲染。右侧 `+` 打开 selected Segment 的 SegmentAttachment compact menu，当前显示录音补充项；录音补充写入 selected Segment attachment，不写入 Memory 顶层 Segment strip，不新建 Memory，不创建同级 Segment。普通录音 finalize 后，App 用返回的完整 Segment projection 更新当前 Memory detail cache，并传入一次性 focus intent，让新 Segment 立即出现在横向预览流并成为 selected Segment。当前不提供强制转写编辑或反思编辑。
- Memory Studio 的主片段播放行和 SegmentAttachment 补充录音播放行共享 feature-local `memory-studio-audio-player` pattern：40px tokenized icon control、真实 `Waveform` slider、Geist Mono nowrap 时间、`grid-cols-[40px_minmax(64px,1fr)_max-content]` compact grid geometry 和相同 focus/disabled/hover token，不为补充录音另建一套视觉或交互分支。
- Memory Studio 可访问性当前规则：Segment strip 左右浏览默认使用 smooth scroll，但当 `prefers-reduced-motion: reduce` 为真时使用 instant scroll；主片段播放 waveform 和补充录音 waveform 都是 horizontal slider，暴露 `aria-valuemin`、`aria-valuemax`、`aria-valuenow`、`aria-valuetext` 和 keyboard seek。ArrowLeft/ArrowRight 每次移动 5 秒，Home/End 定位到音频起点/终点。
- 当前 recording overlay 使用 shadcn Drawer/Vaul source、feature-local recording machine、recording timeline helper 和 browser MediaRecorder adapter。录音前、录音中和暂停态使用沉浸式 full-window recording surface：Vaul 只提供 dialog/dismiss mechanics，背景由 overlay 统一虚化、去饱和并弱化，sidebar、panel titlebar 和 Workspace Stage 仍保留可辨轮廓，前景录音控件保持清晰；录音三态不另建底部控制面板，播放定位、暂停/继续/替换和完成按钮只作为同一录音层上的轻量 action surface。完成录音后不弹出强制描述、转写编辑或反思编辑窗口；非空实时转写会在 finalize 后保存为 transcript。
- 当前 `AppShell` 记忆空间列表显示 main-backed memory space registry；无 active 记忆空间 session 时也显示已导入记忆空间。`创建本地记忆空间` 打开 `WorkspaceCreateDialog`，`打开本地记忆空间` 直接选择现有 Reo 记忆空间或空文件夹并打开；空文件夹会原地初始化为 Reo 记忆空间；打开失败使用 root toast 反馈，创建弹层保持关闭，当前记忆空间保留；点击已导入记忆空间只发送 `workspaceId` 并打开该记忆空间；已导入记忆空间的 root folder 被删除时，该记忆空间仍显示在 sidebar，点击后使用 root toast 显示“记忆空间文件夹已不存在。”；点击当前记忆空间列表项返回 loaded workspace frame；点击 sidebar `首页` 会关闭 active memory space handle 并回到 starter Home shell。录音流程打开时，App 会阻止进入首页、资料库、创建或打开其他记忆空间、移除记忆空间、切换右侧 Memory context，并使用 root toast 提示先完成或关闭录音。
- 当前 `AppShell` 添加记忆空间菜单打开时，sidebar stacking level 临时提升到主内容 panel 之上，避免菜单被 panel 裁切或遮挡；菜单左边缘锚定到添加记忆空间 icon button 左边缘；添加记忆空间 icon button 只在记忆空间列表标题行 hover、focus-within 或菜单 open 时显示；折叠/展开 sidebar 时会先关闭该菜单。
- 当前非阻断 toast 通过 `ReoToaster` 统一挂载在 App root；业务动作和跨边界失败只调用共享 `toast` export，不在 feature 内自建 toast host、临时通知 UI 或红色 inline error surface。表单字段验证可以使用 `FieldError` 就地提示，但视觉为中性色，不使用 Ember/red/destructive 文本。
- 当前 `CreateWorkspaceForm` 使用 React Hook Form + Zod resolver、Button/Input/Textarea/Label/Field primitives，并作为可嵌入表单由 `WorkspaceCreateDialog` 承载。当前 `MemoryCreateDialog` 和 `MemoryRenameDialog` 使用 React Hook Form + Zod resolver、Dialog/Input/Button/Field primitives，并只编辑 Memory 容器 title。
- TanStack Query 和 React Hook Form 已安装，并已有真实 memory space creation consumer。
- Zustand 已选型，但当前未安装。
- 当前没有跨 subtree client state consumer。

## 技术方向

- 直接使用 React 19 模式。
- 使用 Tailwind CSS v4 作为 styling foundation。
- Reo tokens/theme 是视觉真源；shadcn/ui + Radix primitives + Tailwind CSS v4 是 UI 实现框架。
- Tailwind token 优先写在 `src/renderer/src/theme.css` 的 `@theme static` 中。
- 组件和页面设计必须先核对 Reo 设计系统真源。
- 新增 token 只用于稳定跨组件不变量或已命名 primitive pattern；单一 feature 的局部尺寸保留为 feature-local geometry，并且旧 alias 或未消费 token 需要删除，不作为兼容层保留。
- 组件和交互设计必须先评估 shadcn/ui、Radix、ElevenLabs UI、Vaul、wavesurfer.js 和其他成熟开源组件；符合 Reo 边界时优先复用或适配。
- 技术栈相关 UI 能力进入设计或实现前必须先查询 Context7 官方当前文档；采用、裁剪或拒绝第三方方案时在当前 spec 记录依据。
- 有真实 reusable component consumer 时，使用 shadcn/ui source、Radix primitives 和 Tailwind utilities 建立 reusable components。
- 当前 Button/Input/Label primitive 已 retokenize 到 Reo design system；Button 默认使用 12px square-rounded radius，Input 默认使用 12px field radius、Card Glass surface、compact UI typography、Reo focus-visible ring 和 disabled state。
- 当前 Field primitive 承载字段组、字段行、label、hint、control 和 error spacing；divider 只出现在 rows 之间，不压到文字或 control。
- 当前 DropdownMenu primitive 是唯一 compact menu surface，基于 Radix DropdownMenu mechanics，承载 AppShell、MemoryRail 和所有业务 More menu。它使用 Card Glass、Glass Border、glass blur、12px radius、11px UI text、32px item height、portal positioning 和 Radix focus semantics，默认 `modal={false}`。
- 当前 Dialog/DropdownMenu/Textarea source 已 retokenize 到 Reo design system；Dialog 使用 overlay surface、18px title、small description 和 token 化宽度，DropdownMenu 使用统一 compact menu density，Textarea 使用输入框 radius token、compact UI typography、72px minimum height 和 Reo focus/disabled states。
- 当前 Drawer source 基于 shadcn/ui Drawer + Vaul，retokenize 到 Reo overlay mechanics；controlled `open/onOpenChange`、`dismissible={false}` 和 `data-vaul-no-drag` 用于录音忙碌态关闭保护与 waveform/control 交互区。Drawer content 支持普通编辑 surface 和录音沉浸式 full-window content 两种 Reo-owned visual shell，mechanics 仍由 Vaul 控制。
- 当前 Button source 的 filled primary 使用 Obsidian、On Accent 和 square-rounded radius；Signal Blue 只用于 Button `accentCircle` variant 的显式圆形 icon-only control；naked icon-only controls 使用 Button `ghostIcon` variant。
- 当前 Tooltip/Separator source 已 retokenize 到 Reo design system；Tooltip 使用 Reo small surface，Separator 使用 Chalk hairline，也用于 sidebar resize 的可访问 separator 语义。
- 当前 `ReoToaster` 使用 Sonner 官方 `Toaster`/`toast` API，retokenize 到 Reo design system；toast host 只在 root 挂载一次，业务组件不得重复挂载。
- 当前 Waveform 只保留 canvas waveform renderer、静态点状线、动态 bar 和暂停播放头，不在 renderer component 内申请 microphone stream、调用网络、创建 agent runtime 或显示 API key/model 文案；当 data 为空或样本为零时不绘制占位 bars。
- 当前不引入 ElevenLabs Transcript Viewer 作为 shared primitive；transcript preview 保持在 `RecordingTranscriptPreview` feature-local 边界内，并只消费真实 ASR 片段和有界 live preview。
- 当前 App shell 支持浅色/深色主题切换；主题状态由 `App` 持有，并通过 App shell `data-theme="light|dark"` 与 document 根节点 `data-theme` 驱动 token 级联，确保 Radix portal 内容也继承当前主题。
- 当前深色主题由 `src/renderer/src/theme.css` 的 Reo token 覆盖实现：背景避免纯黑，面板使用中性色、实线边界、玻璃化遮罩、同名 token 和命名 shadow token 表达层级，文字、弱文字、描边、scrim、Signal Blue、Ember、Vector accents、Voice Spectrum、Card Glass 和 On Accent 都有暗色 token。
- 界面不使用 emoji 表达图标、状态、装饰或情绪。
- 有现成 lucide icon 时使用 lucide；没有合适图标时优先使用文字、状态点或 Reo token 图形，不临时改用 emoji。
- 表单使用 React Hook Form + Zod。
- 来自 main/server boundary 的 async data 使用 TanStack Query；memory space list 和记忆空间 snapshot 属于当前 Query consumer。
- 当前 QueryClient provider 服务 memory space list、记忆空间 snapshot cache、Memory detail cache、selected Segment content cache 和 selected SegmentAttachment audio content cache；active recording lifecycle、overlay close protection、recording controls、local playback state 和 Blob URL 不进入 Query。
- Zustand 只用于需要跨 component subtree 保留的本地 client state。
- 没有跨 component subtree state owner 前，不创建 Zustand store。

## 产品气质与 UI 方向

- Reo UI 的第一印象是现代扁平矢量插画风 + 毛玻璃 + 北欧极简 + 日式留白的表达空间：安静、克制、温柔、有时间感，不是管理台、协作工具、数据库前端、项目推进面板或效率压迫界面。
- 北欧极简在实现中体现为低饱和 palette、克制控件语言和明确功能边界；现代扁平矢量插画体现为几何图形、无描边插画对象和纯色面；毛玻璃体现为背景模糊、半透明质感和当前操作聚焦；日式留白体现为大面积负空间、不对称平衡和非压迫式节奏。
- UI 判断优先保护表达意愿：降低开始记录的压力，强调内容安全、可恢复、可稍后整理，避免用任务化、打卡化、文件管理化的结构抢走表达中心。
- 视觉质量接近 iPhone 和 Mac 用户熟悉的高级感：留白充足、层级清晰、边界干净、纯色块准确、交互有节奏，所有按钮和状态都必须像被认真放置过。
- Reo 美感来自对注意力的尊重，不来自装饰堆叠、阴影堆叠，也不来自极端简化。页面应保持呼吸感和时间感，玻璃化只用于空间聚焦和沉浸层，扁平矢量用于内容对象和控件；避免空洞的大面积留白、装饰性背景、营销式 hero 或过度 dashboard 化。
- 记忆空间的中间区域承担主要体验；右侧 MemoryRail 承担当前 workspace 内的 Memory 导航；左侧 AppShell sidebar 只保持全局导航和记忆空间列表。当前 workspace 标题属于 AppShell panel titlebar，不属于页面内容区 header。
- Memory Studio 必须表现为“记忆正在生长”的现场。当前录音和转写草稿不显示为附件堆叠，而显示为一段时间里留下的声音与文字之间的关系；录音 Segment card、timeline、playback waveform 和 transcript 必须在同一首屏 studio surface 内组成完整体验，不靠滚动才能看完主内容。
- Loaded workspace 的右侧记忆列表是 Workspace 层级导航，只展示当前记忆空间中的 Memory 容器。它不展示单个 Segment 详情。
- Memory Studio 的横向片段时间线是 Memory 层级结构，只展示当前选中 Memory 内部的 Segment 顺序。每个 Segment 预览 item 同时包含录音卡片、卡片下方居中的 timeline 圆点和时间标签；Segment strip 横向滚动时三者作为同一个 scroll item 一起移动，不使用独立兄弟 timeline 容器。它不能用作整个 workspace 的 feed、日志流或文件流。
- 默认进入 workspace 时，中间区域是 Workspace Stage，不显示片段时间线；选择右侧某条 Memory 后，当前 runtime 只切换 Stage 的当前 Memory context，不进入单独详情 route。
- 录音组件是最需要投入 UI 工艺的核心体验。动态波形、时间轴、实时转写位置、暂停、停止、本地保存、失败恢复、回放和归入 memory 的流程，都必须让用户感到内容安全、表达自由、整理可以稍后发生。
- Review 和回顾入口的语气是重新遇见过去自己的邀请，不是任务、打卡或学习软件。

## 组件规则

- Reusable components 必须小、明确、可读。
- 没有真实组件前，不创建 design-system layer。
- 不得把 card 放进另一个 card。
- 不得为 shadcn/ui 创建没有真实 invariant 的 generic wrapper。
- 项目 UI primitives 建立后，业务组件必须通过项目 primitives 使用。
- UI 文案必须在 mobile 和 desktop 上不溢出。
- 每个功能变更必须显式判断是否产生 reusable component、feature-local component、form component 或 layout primitive。
- 可复用组件必须有真实 consumer、明确 invariant 和测试/验证路径；不得为了“未来复用”抽象。

## 组件设计门禁

进入 UI 实现前必须定义：

- Open-source component evaluation：每个 page-level、overlay、audio/media、form、editor、list/grid、state feedback 和 accessibility primitive 都必须先列出候选开源组件或官方方案。
- 页面结构：memory space management、loaded workspace frame、recording overlay 的 page/component tree。
- Layout primitives：first-run shell、sidebar、main shell、header、content region、overlay shell、scroll region、grid/list 的排版责任。
- UI primitives：button、icon button、textarea、label、dialog、tooltip、card/panel 的实现基础、token 映射和 accessibility invariant。
- Feature components：create memory space form、folder picker row、memory space card、recording controls、waveform/progress visualization、transcript preview 和 recording status 的数据输入和事件输出。
- Reuse decision：哪些组件复用，哪些保持 feature-local；复用必须来自真实 consumer 或共享 invariant。
- Reference mapping：参考图只约束结构、层级和 micro-interactions；视觉 token、spacing、radius、surface 和 icon 必须服从 Reo design system。
- Accessibility matrix：每个 page/state/component 必须定义 role、name、keyboard path、focus behavior、announcement behavior、reduced-motion fallback、hit target、contrast/focus token 和 test/manual evidence。
- Simplification review：避免过深组件树、重复 class 组合、重复状态派生和无意义 wrapper；只有能降低重复或表达不变量时才提取组件。

## 音频与 Agent UI 复用边界

- ElevenLabs UI 是 Reo audio/agent UI 的默认优先评估来源。
- ElevenLabs UI 组件是基于 shadcn/ui 的 open-code registry；只能逐组件引入，不得一次性安装全部组件。
- 需要优先评估的 ElevenLabs UI 组件包括 Audio Player、Live Waveform、Waveform、Speech Input、Transcript Viewer、Voice Button。
- Full-window overlay / large overlay 必须优先评估 Vaul 或 shadcn drawer，而不是自写 modal mechanics。
- Audio recording、waveform recording/playback 和 scrubber 必须同时评估 wavesurfer.js、ElevenLabs UI 和其他成熟开源方案。
- 采纳的组件实现必须 retokenize 到 Reo design system，并删去不符合 Reo 边界的 demo、agent runtime、network/token、未实现能力和 decorative behavior。
- 若开源组件不完全适配，必须先评估裁剪、retokenize、组合、薄适配或 fork。拒绝开源组件并自研前，必须记录这些适配路径仍不满足的边界：Electron 安全、local-first 文件真源、无网络依赖、设计系统、可访问性、测试可控性、bundle/依赖成本或代码复杂度。

## 当前 UI 决策

当前实现事实：

- Starter Home 使用 App shell 承载无 active memory space 状态；Home 主内容区不显示独立 `+` 创建按钮，创建记忆空间入口在 sidebar 记忆空间列表的添加菜单中。
- 记忆空间创建 Dialog 使用 feature-local `WorkspaceCreateDialog` 和可嵌入 `CreateWorkspaceForm`，只覆盖“新建空白记忆空间”创建表单；`打开本地记忆空间` 由 sidebar 菜单直接触发 folder picker，不进入创建弹层。
- App 拥有 memory space entry action lock；创建弹层 submit、打开本地记忆空间选择和打开期间不得重复触发同一记忆空间 action，创建弹层关闭在 pending 时被阻止，branch 结束必须释放 action lock。
- App 使用 `['workspace', 'memory-spaces']` Query 读取 sidebar 记忆空间列表；创建、打开本地记忆空间或点击已导入记忆空间成功后 invalidate 该 Query。记忆空间列表读取失败使用 root toast 显示，不把 sidebar 静默清空当作成功状态。
- 创建记忆空间表单当前使用 Button/Input/Textarea/Label/Field primitives、React Hook Form、Zod 和 submit-time validation；表单字段顺序是记忆空间名称、描述、记忆空间位置；submit button 默认可点击，空 title 或未选 folder 时提交后显示字段错误并把焦点回到 title。
- Folder picker 只显示 main process 返回的安全 `displayPath` basename，并把 `selectionToken/displayPath` 写入当前 RHF form lifecycle；create submit 只发送 `selectionToken/title/description`，main 把所选 folder 作为 parent location 并在其下创建 title 同名记忆空间文件夹。Create title 必须是安全 folder name，不能是 `.`、`..` 或包含路径分隔符。`打开本地记忆空间` 是 sidebar 菜单动作，选择文件夹后直接调用 `openWorkspace(selectionToken)`，不发送 title、description、displayPath 或 raw path；现有 Reo 记忆空间会打开，空文件夹会原地初始化。点击已导入记忆空间只调用 `openMemorySpace(workspaceId)`，不发送 selection token、displayPath 或 raw path。Create/open-local/open-memory-space 成功切换记忆空间前会释放既有 active handle，释放失败时不切换 UI 并使用 root toast 显示错误。Open failure 或 promise reject 使用 root toast，不复用创建表单字段错误位。Initialize 失败后清除已消费的 folder token 和 display name，要求用户重新选择 folder。
- 当前 App shell 已实现 48px 无边框 titlebar shell、底层可拖拽 sidebar 和上层内容 panel；renderer 的 `html`、`body` 和 `#root` 使用确定的 `height: 100%`、`min-height: 100%` 和 `overflow: hidden`，AppShell root 使用确定 viewport box，避免首次进入软件后依赖窗口 resize 才完成右侧和底部布局；titlebar 自身是 Electron drag region，窗口/sidebar 控件是 no-drag control region；sidebar 默认 240px、最小 240px、最大 520px，resize separator 有 8px 真实命中区和 hover affordance；panel 顶/右/底贴合窗口，使用 Page/Eggshell，内部先保留 48px panel titlebar slot，再渲染无 app-level scroll 的页面内容边界；展开态以 `left` 等于 sidebar 宽度并只保留左侧 12px radius，covered 态 `left` 归零且 radius 归零。折叠/展开时右边缘固定，只让左边界移动。covered 状态下 panel titlebar content 的 left 必须从 sidebar hide/show control 的 `--spacing-titlebar-control-left`、`--spacing-titlebar-control-size`、`--spacing-titlebar-control-gap` 和 `--spacing-panel-titlebar-x` 推导，确保 workspace 标题以左上 sidebar 折叠 icon 为基准定位；panel titlebar content 的 top 必须从 `--spacing-titlebar-control-top`、`--spacing-titlebar-control-size` 和 `--spacing-titlebar` 推导，确保 workspace 标题文字视觉中心和右侧 MemoryRail 折叠 control 视觉中心与左上 sidebar 折叠 icon 视觉中心对齐。
- 当前 App shell 的 hide/show sidebar icon-only control 位于左上原生窗口控制区右侧，不创建 rail sidebar；该 control 的 titlebar slot 保持稳定，折叠和展开切换只替换图标，不移动 slot。
- 当前 App shell 的浅色/深色主题切换是 sidebar 左下角工具按钮，使用 lucide Moon/Sun icon-only control 和 Tooltip accessible name；它不创建 settings 页面、系统主题跟随或持久化。
- 当前 App shell navigation 显示 `首页` 和 `资料库`；sidebar 不显示 `新记忆`。`首页`、`资料库` 和记忆空间列表项都是真实导航入口，触发导航前会关闭已打开的 sidebar 菜单；离开 loaded memory space 到 `首页` 或 `资料库` 前会释放当前记忆空间 handle。录音流程打开时，离开当前 loaded memory space、切换记忆空间和切换当前 Memory context 都被阻止，避免录音 target、draft、ASR session 或当前 transcript 被路由变化打断；录音进入忙碌态后，App 还会通过 `beforeunload` 阻止原生窗口关闭或 reload。starter shell 中 `首页` 是当前页，`资料库` 打开空白 Library page；loaded memory space 中当前页由 active 记忆空间列表项表达，`首页` 不保持当前页高亮。Home search、future media/file route、auth、sync、share、AI 和 global search 不显示。
- 记忆空间列表项容器内右侧有 icon-only 更多操作按钮；记忆空间行容器承载 hover/current surface，primary button 和 more button 都位于同一个记忆空间行容器内。More button 默认隐藏，只在对应记忆空间行 hover、keyboard focus-within 或菜单已打开时显示。当前只提供 `移除记忆空间`。确认弹层说明只从 Reo记忆空间列表移除，本地文件夹不会被删除。移除反馈只使用 root `ReoToaster`，确认弹层内不渲染第二套错误提示。移除 inactive 记忆空间只刷新记忆空间列表；移除 active 记忆空间先移除 registry entry，再回到 starter shell，并尽力释放当前记忆空间 handle；handle 释放失败时不阻断列表移除，只显示 toast。
- 当前 App shell 使用 lucide icon-only controls 和 icon+text nav；icon-only controls 的 accessible name 放在 button 上，菜单 surface、菜单项和记忆空间操作组都必须有明确 accessible name。
- 当前 loaded workspace frame 是 loaded memory space 的默认 surface：AppShell panel titlebar 显示当前 workspace 标题、`新建记忆` icon-only control 和右侧 MemoryRail 折叠/展开 icon-only control；内容区不再单独渲染标题栏或横向 header 分割线。sidebar covered 时，workspace 标题随 panel titlebar 滑到左上 sidebar 折叠控件右侧，workspace 标题文字视觉中心和右侧 MemoryRail 折叠 control 视觉中心都与左上 sidebar 折叠 icon 视觉中心对齐。未选中 Memory 时中央标题是 `今天想记录些什么？`，使用 `--font-memory-serif`，标题上方不显示 icon，不显示横向片段时间线；选中 Memory 后显示 feature-local `MemoryStudio`，用 `['workspace', 'memory-detail', workspaceId, memoryId]` Query 读取当前 Memory detail，用 `['workspace', 'segment-content', workspaceId, memoryId, segmentId]` Query 读取 selected finalized audio Segment content，并在 selected Segment 有 finalized attachments 时用 `['workspace', 'segment-attachment-content', workspaceId, memoryId, segmentId, attachmentId]` Query 读取补充录音 audio content，首屏组织为当前 Memory 标题、finalized audio Segment 横向预览流、Memory 内时间轴、当前片段播放条、动态内容 tab、SegmentAttachment `+` 菜单、transcript 查看和补充录音播放，不进入独立详情 route。右侧 MemoryRail 按更新时间展示当前 snapshot 中已加载的 Memory 容器，只显示每条 memory 的 title、最近更新时间和片段数量摘要，不显示 Segment 详情、document icon、rail 级标题或总数，rail shell 使用 Card Glass + blur；右侧空态只显示 MemoryRail empty card，不显示 rail 级标题或总数；每张 Memory 卡片是无描边填充对象，未选中为 `bg-powder`，当前 Memory 为 `bg-chalk`，不使用常态 border、shadow 或 blur 表达 card 层级；每张 Memory 卡片有独立 select button 和 More icon button，More 菜单当前提供 `重命名记忆` 和 `删除记忆`；`重命名记忆` 打开 `MemoryRenameDialog`，`删除记忆` 打开 `MemoryDeleteDialog`，确认成功后 Memory 进入恢复区并通过 toast action 提供本次恢复。MemoryRail 默认折叠并退出可访问树和指针交互；打开态 rail shell 绘制 1px `border-l border-glass-border` 作为左侧分割线。MemoryRail 有 inline 和 overlay 两种 layout mode：`(min-width: 1100px)` 匹配时使用 inline，rail 宽度为 `clamp(220px, 24vw, 280px)`，舞台右侧避让和 FAB 右侧避让共享 `WorkspaceFrame` 内的 layout variables，展开时使用 `clamp(12px, 2vw, 20px)` / `clamp(20px, 2.5vw, 40px)` gutter；compact workspace 宽度下用户手动展开时使用 `w-[min(260px,calc(100%-48px))]` 覆盖在舞台右侧，不修改中央舞台和 FAB 的右侧 inset，避免 Memory Studio 被压成窄列。MemoryRail list 使用 `px-16 py-20`、8px card gap、68px 最小卡片高度、14px 主标题、12px meta 和 24px More button，保持比 Memory Studio card 更轻。WorkspaceFrame 使用 `h-full min-h-0 overflow-hidden bg-card-glass backdrop-blur-glass-lg`，避免内容把 AppShell panel 撑出页面滚动，并作为 loaded workspace 的单一 glass stage surface；底部表达入口是浮动 SpeedDial，不参与内容流排版，并只在 inline rail 展开时随 rail inset 避让。
- 当前底部表达入口通过 `components/ui/floating-action-button-speed-dial.tsx` 使用 PrimeReact SpeedDial 的 `semi-circle`/`radius` mechanics，并 retokenize 为 Reo CTA、focus ring、glass-vector color states 和结构展开 motion。SpeedDial shell 是 320px × 184px，center button 是 56px circle，action button 是 40px circle，semi-circle radius 是 92px，展开态从左到右是 `录音`、`笔记`、`拍照`、`视频`、`上传`。唯一可执行 action 是 `录音`；Workspace Stage 的 `录音` 优先使用当前 Memory context 作为 recording target，只有当前 workspace 没有 Memory 时才先打开 `MemoryCreateDialog`，创建 Memory 后再以 existing-memory target 进入 recording overlay；`笔记`、`拍照`、`视频`、`上传` 是不可用的 action-shaped 展开位置，必须显式提供 `disabled` 和 `disabledLabel`，必须 `aria-disabled`、阻止选择、不得触发 IPC、DB、Query、Zustand 或文件写入。FAB 展开动效属于结构性 menu 展开，不表达 Z 轴厚度；trigger 和 action 不使用 hover translate 或 active scale，并且只使用 Reo token 化 surface、focus、hover 和 motion。
- 当前 loaded workspace frame 不提供本地搜索、global search、full-text search、semantic search、tag/entity filter、Zustand store、DB surface 或独立 route。
- 当前 loaded workspace frame 使用 feature-local `WorkspaceFrame`、`WorkspaceTitlebar`、`WorkspaceStage`、`MemoryStudio`、`MemoryRail` 和 `ExpressionDock`；它们不是 design-system primitive。`ExpressionDock` 只负责把当前业务 action 映射给 shared Floating Action Button Speed Dial primitive。
- 当前不提供单独详情 route；MemoryRail selection 是 loaded workspace frame 内的 current-memory state，不引入 router dependency、page registry、generic route service、detail query 或额外 provider。
- 当前 loaded workspace frame 的 `录音` 打开 shadcn Drawer/Vaul recording surface；`RecordingOverlay` 持有当前 durable recording transaction，并复用 feature-local `RecordingSurface` shell、`RecordingWaveform`、`RecordingTranscriptPreview`、`RecordingControls` 和 `recordingTimeline`。录音前只显示静态点状波形、温和引导文案和 Ember 圆形开始按钮；录音中显示动态波形、实时转写区域、`MM:SS.hh` 计时器、暂停按钮、弱化播放定位控件和完成按钮；暂停态显示已录波形、token 化播放头、cursor time、可用播放定位控件和继续/替换主按钮。录音中和暂停态 controls 不作为独立 absolute footer，也不使用独立背板、重阴影或多层胶囊容器；waveform、转写、时间和 actions 属于同一个 recording surface，视觉层级主要靠位置、实线边界、状态色和 hover/focus 反馈表达。`RecordingTranscriptPreview` 不使用背景填充；有转写片段时只对文本滚动容器使用 mask，不在录音层里制造独立白色区域。录音中实时转写默认柔和跟随最新内容向下滚动，文本变长时视觉上持续向上流动；用户在转写区域手动滚动离开底部后停止自动跟随，用户滚回底部后恢复自动跟随。暂停态播放按钮使用当前 renderer 持有的有效 MediaRecorder chunk 前缀创建 draft playback Blob，并用 audio `timeupdate`、ended、波形拖动和前进/后退 15 秒共同驱动同一个 `cursorTimeMs`。播放头、拖动和前进/后退改变同一个 focus time，`RecordingTranscriptPreview` 用 transcript segment 时间范围高亮并滚动到对应文本。播放头在末尾时继续恢复当前 MediaRecorder controller 采集；播放头在中间且 cursor 大于 0 时替换会先把可见播放头对齐到实际可保留的 durable chunk 边界，再保留 cursor 前的有效 MediaRecorder chunk 前缀、截断 waveform、PCM 和 transcript timeline、生成新 `revisionId`、创建新 draft，并复用当前已暂停的 MediaRecorder controller 从该位置继续采集；播放头在录音起点时替换必须创建新的 recording session、revision 和 MediaRecorder controller，不克隆旧 WebM 后段，避免生成缺少初始化 header 的音频。完成录音后不进入强制描述、转写编辑或反思编辑；非忙碌关闭后再次打开回到 ready recording state。
- 当前 recording overlay 的边界提示使用 root toast 或中性 status 文案，不使用红色 inline error。小于 2 秒的录音首次完成会保留录音并提示录音较短，再次完成可保存；持续 15 秒低音量输入只提示一次且不打断采集；单次录音 55 分钟提示接近上限，60 分钟自动暂停并保留当前有效录音；播放头位于中间时首次点击替换只提示覆盖影响，同一 cursor 的再次点击才创建 replacement draft；replacement 不创建新的 microphone intent，draft 创建或 retained chunk copy 失败必须保留原录音。
- 当前 recording recovery UI 使用 `RecordingRecoveryDialog`。重新打开 workspace 后如果存在匹配当前 workspace 和 Memory 的 recovery marker，App 在 Workspace Stage 上方显示“未完成录音”对话框，提供“继续检查”“保存录音”和“放弃”三个明确动作；保存会 finalize 原 draft 并合并 Memory summary 和完整 finalized audio Segment projection，若 transcript 保存失败会把该 Segment projection 写回 marker，后续重试只补 transcript，不把 draft missing 当作成功；放弃会 discard 原 draft；继续检查会打开该 Memory 的 recording overlay 并恢复为暂停检查态。恢复检查态使用 marker 中的 waveform、transcript segments 或 transcript sidecar markdown、cursor、session/revision 和 draft audio chunk map，还原回听检查；如果 marker 因预算移除了 transcript segments，但 sidecar markdown 仍存在，完成保存必须写入该 markdown。由于没有原 MediaRecorder controller，继续录制和中段替换不会跨会话拼接 WebM，触发时使用 root toast 提示并保留 marker。draft audio 读取按 marker byte map 传入读取上限；读取失败时只使用 root toast，仍允许保存未完成 draft。该对话框不重新创建 Memory、不显示红色 inline error。
- Recording 使用官方 browser MediaRecorder API + `getUserMedia` 薄 adapter 负责 durable WebM/Opus capture；adapter 从同一麦克风 stream 额外读取 Web Audio analyser level samples 供 waveform 渲染，并通过 AudioWorklet 可选输出 16 kHz 16-bit mono little-endian PCM chunks 供 ASR session 使用。pause 会停止 level pump、暂停 PCM 输入并关闭麦克风音轨，resume 再恢复。adapter 不引入 agent runtime、网络 STT 或本地 mock transcript。豆包流式语音识别接入经过 main process 安全边界：renderer 只调用 `startRecordingTranscription`、`sendRecordingTranscriptionAudio`、`finishRecordingTranscription`、`closeRecordingTranscription` 和 `onRecordingTranscriptionEvent`，不保存、不显示、不发送 API key、Access Token 或火山鉴权 header。`RecordingOverlay` 把 accepted ASR session 的 segment event 应用到 feature-local `recordingTimeline`，并用 `recordingSessionId` / `revisionId` 丢弃旧结果。实时 PCM send 使用有界串行队列，queue overflow、send failure、`accepted:false`、ASR start 未 accepted 或 live ASR 关闭只触发 root toast 和 completion backfill，不阻断 durable capture。停止录音会先等待 MediaRecorder 和 append queue flush，再 drain live PCM queue，并等待 main ASR session 返回最终包；最终转写失败时只显示 root toast，仍保留并完成 durable audio。Renderer 同步保留当前有效 PCM chunks，替换或补转写发送 PCM 时会按 cursor 裁剪首个重叠 PCM chunk，避免把 cursor 前音频写入新 revision；若 durable finalize 后 transcript 为空，或当前 revision 已收到 ASR error / finish failure，会用缓存 PCM 发起一次 completion backfill ASR session，并在最终包返回后保存 transcript；补转写失败不回滚已保存音频。若补转写成功但 transcript save 失败，recovery marker 必须保留 finalized audio Segment projection 和补转写 transcript，后续恢复只补 transcript。
- 当前 recording overlay 完成后会关闭沉浸式录音层。录音中的转写区域只消费真实 ASR 片段，不生成本地 mock transcript；非空最终 transcript 会通过 `workspace:saveTranscript` 写入当前 finalized audio segment。替换必须同时更新 audio draft、waveform、PCM cursor、cursor time、draft playback source、transcript timeline 和 `revisionId`；cursor 大于 0 时只保留有效前缀，cursor 为 0 时创建全新 capture session；旧 session/revision 的异步转写结果不得写回当前文本。
- 当前 recording finalize 成功 response 返回当前 Memory summary 和完整 finalized audio Segment projection。Overlay 向 App 汇报该 projection；App 通过 functional updater 合并 Workspace snapshot cache、当前 session state 和对应 Memory detail cache，并用一次性 focus intent 选中新 Segment。Transcript save 成功 response 返回当前 Memory summary；Overlay 向 App 汇报该 summary、`memoryId` 和 `segmentId`；App 更新 Workspace snapshot cache 和当前 session state，把对应 Memory detail cache 内的 Segment transcript presence 标记为存在，并 invalidate 该 Segment content Query，避免并发保存互相覆盖。

当前交付约束：

- 当前 app shell 承载 loaded workspace frame 和 recording overlay，不另建 page shell。
- Sidebar 使用分层 overlay shell：sidebar 是底层 `z-index: 1`，使用 Sidebar/Linen surface，紧贴窗口左边缘并铺满高度；主内容是上层 page panel `z-index: 2`，使用 Page/Eggshell，顶/右/底与窗口边缘重叠，展开态只在左侧边界显示 12px radius，并在内部保留 48px panel titlebar slot；titlebar 是 48px 无边框透明 drag slot，`z-index: 5`；sidebar action menu 打开时 sidebar 临时提升到 `z-index: 4`，窗口控制保持在更高层；sidebar action menu 必须以 trigger 左边缘为锚点，不从 sidebar 外侧重新起算。
- Sidebar 宽度可拖拽，最小 240px，最大 520px；covered 状态是主内容面板的 `left` 归零并覆盖 sidebar。
- Sidebar 展开/covered 动效使用 280ms ease-out，只过渡 panel 的 `left` 与 border radius；reduced motion 下关闭 transition；拖拽 resize 时关闭 motion，只直接更新 left。
- macOS 红黄绿窗口按钮保持原生控件；Reo 只绘制无边框 AppShell titlebar layout slot 和 sidebar hide/show control，不伪造红黄绿窗口按钮。
- Sidebar 中的 Search 不出现在 current build。
- Workspace-level search、recording-level、full-text、跨记忆空间、entity、tag、semantic search 属于后续 DB/index foundation。
- Loaded workspace frame 完成形态使用 AppShell panel titlebar、中央 Workspace Stage、右侧可折叠 MemoryRail、底部浮动 ExpressionDock 和 empty/error/loading states；`录音` 打开 recording overlay。
- 未实现的 photo、video、file、film、sharing、sync、auth user、camera、AI generation、global search 能力不得触发 runtime surface、IPC、DB、Query、Zustand、文件事务或错误模型。底部表达 SpeedDial 中的不可用 action-shaped 位置只表达当前展开态布局，不代表已接入能力。
- Recording 的最终产品形态使用 shadcn Drawer/Vaul mechanics 承载沉浸式 full-window recording surface。
- 当前 recording overlay 不生成 mock transcript 文本；完成录音后不进入强制转写、描述或反思编辑窗口。真实流式转写进入时必须携带时间范围、`recordingSessionId` 和 `revisionId`，用于暂停定位、文本同步滚动和替换后丢弃旧异步结果。
- ElevenLabs UI 逐组件评估范围是 Waveform、Live Waveform、Voice Button、Audio Player、Transcript Viewer；不得执行 `add all`。
- Waveform 不能用与官方/成熟源码无关的自研 lightweight bars 作为最终形态；当前使用 canvas/bar rendering pattern 并保持 Reo local-first 边界。引入 long waveform、live microphone waveform、peaks、regions 或 playback scrubber 时，必须重新评估 ElevenLabs UI、wavesurfer.js 或成熟开源实现。
- wavesurfer.js 不负责 current durable capture；若实现 long waveform、peaks、regions、visual scrubber 或第二个 waveform consumer，必须重新作为优先候选并记录采用、fork 或拒绝证据。
- shadcn/ui source 变更必须与 exact primitives、business consumers、shared invariants 和 tests 同批完成。

## shadcn/ui 边界

- 当前 shadcn/ui source 范围包含 Button、Input、Label、Dialog、Drawer、DropdownMenu、Textarea、Tooltip、Separator 和 Field。
- 当前存在 `components.json`、renderer import alias、`components/ui/button.tsx`、`components/ui/input.tsx`、`components/ui/label.tsx`、`components/ui/dialog.tsx`、`components/ui/drawer.tsx`、`components/ui/dropdown-menu.tsx`、`components/ui/floating-action-button-speed-dial.tsx`、`components/ui/textarea.tsx`、`components/ui/tooltip.tsx`、`components/ui/separator.tsx`、`components/ui/field.tsx` 和 `lib/utils.ts`。
- 只有存在真实 reusable component consumer 时，才允许继续添加 shadcn/ui source。
- 该 gate 只是安装与初始化门禁，不是框架选择保留项；Reo 的 UI 技术框架已经确定为 shadcn/ui + Radix primitives + Tailwind CSS v4。
- 该 consumer 必须需要 reusable primitive、accessible interaction primitive，或明确的 shared visual invariant。
- shadcn/ui source 变更必须同批配置 renderer import alias，并同步 `tsconfig.json`、`electron.vite.config.ts` 和 `vitest.config.ts`。
- `components.json` 的 Tailwind CSS 入口指向 `src/renderer/src/index.css`。
- Tailwind v4 项目中 `components.json` 的 `tailwind.config` 保持空值。
- 新增 component source 必须立即被真实 consumer 使用。
- shadcn/ui component source 的视觉规则必须服从 Reo 设计系统 token。

## 样式规则

- Component foundation 建立后，优先使用 token 和 primitive variants。
- 当前业务样式优先使用 Tailwind utility class 和已定义 token。
- 不得在业务组件中散落硬编码视觉常量。
- 所有组件设计必须遵循 Reo 设计系统；业务组件不得自造一次性 aesthetic、palette、radius、motion、icon size、waveform rhythm 或 overlay treatment。
- Reo 设计系统覆盖不到的新 UI 状态、尺寸、层级、motion 或交互形态，必须先补充为可复用 token、primitive variant 或 usage rule，再落到业务组件。
- 设计系统补充必须同时满足行业通用 UI 规范、Practical UI 指南、可访问性要求和当前参考结构；不得为了单个页面写一次性视觉例外。
- 不得为单个 screen 创建一次性 palette。
- 深色模式必须通过 Reo token 覆盖实现；不得在业务组件里散落页面级暗色 class，也不得用简单反色替代信息层级。
- 深色主题的 base surface、secondary surface、overlay surface、scrim、text strong、text weak、stroke、focus、glass-vector layering 和 accent token 必须能覆盖 Radix portal 与当前业务 surface。
- 避免不服务产品 workflow 的装饰性 UI。

## 设计系统规则

- 页面底色使用 Eggshell，主要文字使用 Obsidian，普通边界使用 Chalk 或 Glass Border，辅助文字使用 Gravel 或 Slate。
- 浅色主题是默认主题；深色主题使用同名 token 的暗色值，而不是新增第二套业务 class 名称。
- Signal Blue 和 Ember 使用低饱和映射，只用于小型圆点、状态指示、焦点环、waveform emphasis 或显式圆形 accent control，不用于正文、页面背景或普通 button 填充。
- 32px 及以上标题使用 Waldenburg 300、负 tracking 和紧凑 line-height。
- 正文和通用 UI 文案使用 Inter；产品族标签使用 WaldenburgFH 600。
- Button、tag、badge 和输入控件默认使用 12px square-rounded radius；只有 FAB、录音主按钮、小圆点和显式圆形 icon control 使用 fully rounded 形状。
- Card 使用 24-32px radius；需要明确可操作边界的 framed primitive 才使用 1px/2px token 边界，Memory Studio 的片段卡片和 MemoryRail 卡片默认使用 Powder/Chalk 填充表达状态。产品 floating/menu/dialog surface 使用 Card Glass、glass blur 和命名 shadow token 建立层级，不使用 ad hoc shadow；AppShell root 和主内容面板使用 Eggshell，WorkspaceFrame 和 MemoryRail shell 使用 Card Glass + blur，titlebar 保持透明。App 主内容面板展开态只在左侧使用 12px radius，covered 态归零以贴满窗口。
- Geist Mono 用于代码、技术注记、机器生成标记、时间、计数和数据标签。
- 所有产品界面必须保持安静、克制、温柔、有时间感的表达软件气质：清晰、可维护、可验证，但不冰冷、不任务化、不玩具化。

## 变更门禁

任何 React structure、reusable components、Tailwind/shadcn setup、forms、UI state、UI data fetching 的项目级模式变化，都必须更新本文档。

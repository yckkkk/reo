# 前端

本文档是 React、样式、组件和 UI state 的当前真源。

## 当前事实

- Renderer 是 React 19 + TypeScript。
- Tailwind CSS v4 已安装，并通过 `@tailwindcss/vite` 接入 renderer build。
- Reo UI 技术框架是 Tailwind CSS v4 + shadcn/ui + Radix primitives。
- Reo 设计系统源文件位于 `docs/current/design-system/`；renderer 可执行主题文件是 `src/renderer/src/theme.css`；renderer 样式入口是 `src/renderer/src/index.css`。
- 当前设计系统是黑色为主、红色为辅的 Soft Flat Design System：纯白或极深灰画布、低对比灰度容器、无同平面描边、基础组件无阴影、浮层使用克制 Z 轴投影、黑色用于核心动作和明确状态，红色用于表达入口、录音主按钮和危险/高注意力状态。
- `src/renderer/src/index.css` 负责 Tailwind v4 import、`data-theme="dark"` dark variant、Electron drag/no-drag utility、全局不可选中文本和输入/转录类文本可选中规则。
- `src/renderer/src/index.css` 定义设计系统级 Tailwind v4 utilities：`edge-fade-y`、`edge-fade-x`、`scrollbar-hover` 和 `reo-content-tab-panel-motion`。它们用于可滚动内容边缘渐隐、hover/focus 时才显露滚动条的文本容器，以及内容 tab panel 的轻量进入反馈，不由业务组件重复实现 gradient overlay、mask、scrollbar 或 panel motion 规则。业务局部的 sibling action reveal 留在 owner component，不写入全局 CSS。`edge-fade-*` 是滚动感知的：通过 `@property` 注册的边缘偏移变量 + scroll-driven animation，每个边缘只在该方向有内容被滚走时才渐隐，内容不溢出时无 fade。
- 当前 App shell 支持三态外观偏好 `浅色 / 深色 / 跟随系统`；偏好由 `App` 持有，默认 `跟随系统`，通过 `localStorage` key `reo.themePreference.v1` 跨会话持久化。`跟随系统` 由 `matchMedia('(prefers-color-scheme: dark)')` 解析并订阅 OS 偏好变化，得到 effective theme `light|dark`；effective theme 同时写入 App shell `data-theme` 与 document 根节点 `data-theme` 驱动 token 级联，并传给 Sonner toast theme，确保 Radix portal 内容也继承当前主题。侧边栏底部提供齿轮「设置」入口和单按钮主题循环 `浅色 → 深色 → 跟随系统 → 浅色`，主题按钮图标随当前偏好变化（Sun / Moon / MonitorSmartphone）。
- 深色主题的 `accent` 是 popover 上的交互高光色，使用 `color-mix(in oklab, var(--foreground) 10%, var(--popover))`，不得与 `popover` 同色；DropdownMenu、ghost icon、secondary Button hover 和弹层内次要按钮 hover 都依赖它表达可见但克制的状态反馈。
- 当前 shadcn/ui source 范围包含 `components.json`、renderer `@/*` alias、`components/ui/button.tsx`、`components/ui/input.tsx`、`components/ui/label.tsx`、`components/ui/dialog.tsx`、`components/ui/alert-dialog.tsx`、`components/ui/drawer.tsx`、`components/ui/dropdown-menu.tsx`、`components/ui/breadcrumb.tsx`、`components/ui/textarea.tsx`、`components/ui/tooltip.tsx`、`components/ui/separator.tsx`、`components/ui/field.tsx`、`components/ui/switch.tsx` 和 `lib/utils.ts`。
- 当前 `components/ui/floating-action-button-speed-dial.tsx` 是 Reo 的 Floating Action Button Speed Dial primitive，使用 PrimeReact SpeedDial mechanics 并映射到 Reo design system。
- Vaul 已作为 shadcn Drawer 的 dialog/dismiss mechanics dependency 引入。
- Sonner 已作为 toast mechanics dependency 引入；renderer root 使用 `ReoToaster` 统一承载非阻断操作提示。
- `Waveform` 是当前 Reo audio UI primitive；它支持 canvas bars、静态 dots、播放进度双色切分和录音编辑 cursor，并在 `data-theme` 切换时重绘 canvas 以同步主题 token 颜色；不包含 agent runtime、network/API key、demo feedback 或未实现文案。
- 当前没有 shared local playback primitive；暂停态回听由 recording overlay 内部的隐藏 HTMLAudioElement 和 feature-local controls 承担。
- 当前 Radix primitives 安装并使用 `@radix-ui/react-slot`、`@radix-ui/react-label`、`@radix-ui/react-dialog`、`@radix-ui/react-alert-dialog`、`@radix-ui/react-dropdown-menu`、`@radix-ui/react-tooltip`、`@radix-ui/react-separator` 和 `@radix-ui/react-switch`。
- 当前真实 reusable component consumer 是 app shell、memory space starter home、memory space create dialog、memory space entry form、loaded workspace frame、recording overlay、recording control surface 和 root toast host。
- 当前 renderer 入口由 QueryClient provider 包裹。
- 当前 App 顶层持有 `appMode: 'app' | 'settings'`。`appMode: 'app'` 覆盖无 active memory space 的 starter Home shell 和已初始化或已打开 memory space 的 loaded shell；`appMode: 'settings'` 在同一 BrowserWindow 的 AppShell 主内容区渲染 Settings shell，不释放当前 workspace handle，不清理 workspace session、Memory detail cache 或 stage selection state。
- Agentation 作为 dev-only renderer feedback toolbar 挂载在 renderer root，只在 Vite development 且非 test mode 下 lazy-load；它连接本机 `http://localhost:4747` MCP endpoint，保留点击标注、文本选择、多选、复制输出、本地持久化和 MCP sync 能力，不进入 product App tree、product runtime state、Query、preload 或 IPC。DevAgentation 对 Agentation copy output 执行 renderer-only fallback copy，避免 Electron runtime 拒绝 `navigator.clipboard` 时静默丢失复制结果；DevAgentation 会读取 Agentation 的本地 Layout Mode state，把 `section.note` 补入复制输出，并用 Agentation 的本地 session id 补发或更新 MCP rearrange annotation，确保只写注释、不移动或缩放的 Layout Mode feedback 也能进入复制文本和 MCP pending annotations。

## 设计系统规则

- 业务 TSX 只能消费现有语义 token，例如 `bg-background`、`bg-card`、`bg-secondary`、`bg-accent`、`text-foreground`、`text-muted-foreground`、`bg-primary`、`text-primary-foreground`、`bg-popover`、`shadow-float` 和 `shadow-modal`。
- 业务 TSX 不写硬编码颜色，不为单个组件新增设计系统 token，不把 feature-local geometry 提升成全局 token。
- 同平面的 Card、Button、Input、列表项、tab、workspace panel 和内容区不用 border 分割；难以区分时增加间距或调整灰度填充。跨区域边界和浮在内容之上的局部 overlay control 可以使用 token 化细边框来维持可读性。
- Button、Input、Textarea、Field、Memory card、Segment card 和普通 action 默认无阴影。
- 只有 Tooltip、DropdownMenu、Dialog、AlertDialog、Drawer 和 Toast 这类临时浮层使用 `shadow-float` 或 `shadow-modal`。
- Hover、active、selected 通过灰度阶梯表达：常态使用透明或 `bg-card`，hover 使用 `bg-secondary` 或 `bg-accent`，选中使用 `bg-secondary` 并配合文字权重、状态点或黑色主动作。
- `rounded-full` 只用于 FAB trigger、FAB action、录音主按钮、Segment strip overlay arrow、圆点、timeline marker 和 drawer/waveform handle。普通文本按钮使用 `rounded-lg`，compact 文本按钮使用 `rounded-md`，32px icon button 使用 `rounded-sm`，40px icon button 和菜单 action 使用 `rounded-md`，titlebar Breadcrumb trigger 使用 `rounded-sm`，输入框和卡片使用方圆角。
- 常规交互动效使用 `duration-150 ease-out`；结构动效上限 `duration-200 ease-out`；reduced motion 下关闭。Memory Studio 内容 tab rail 是 demo 对齐的局部例外：tab pill、tab text/icon color 和 tab More reveal 使用 400ms `cubic-bezier(0.2, 0.9, 0.1, 1)`，content tab panel 切换使用 300ms 同曲线。
- 全局默认不可选中文本；输入、textarea、contenteditable、转录、日志、路径和其他需要复制的内容必须显式 `select-text` 或 `.selectable-text`。
- 顶部标题栏拖拽区使用 `.drag-region` 或等价 `-webkit-app-region: drag`；内部按钮必须使用 `.no-drag-region` 或等价 `-webkit-app-region: no-drag`。

## Primitive 当前形态

- Button：radius 由 size variant 决定，文本动作用 `rounded-lg` / `rounded-md`，icon action 用 `rounded-sm` / `rounded-md` / `rounded-lg`；通用 Button primitive 不提供全圆 variant；`border-0`、`shadow-none`、focus ring；primary 使用 `bg-primary`，hover 只降到 `bg-primary/90`；destructive 使用 `bg-destructive`，hover 使用 `bg-destructive-hover`，该 token 通过 `color-mix` 将 destructive 轻微推亮，保证红色危险按钮 hover 可见且保持扁平；secondary 默认 `bg-card`，hover 用 `bg-accent text-accent-foreground`；ghost icon 默认透明，hover 用同一 `accent` 高光。FAB 使用 `bg-brand-ember`；录音主 CTA 使用 `bg-brand-ember`。FAB 和录音主 CTA 的全圆例外保留在各自 owner component。
- Input 与 Textarea：`bg-input`、`border-0`、`shadow-none`；focus 与 invalid 只用 ring。
- Field：字段行通过留白分隔，不使用 row divider。
- DropdownMenu：Radix mechanics，`bg-popover text-popover-foreground shadow-float`，content 使用 150ms `reo-dropdown-menu-enter` 进入动效并在 reduced motion 下关闭；item 使用 compact density，并同时响应 Radix `data-highlighted` 和 focus 状态；highlight 使用 `bg-accent text-accent-foreground`，默认 `modal={false}`。
- Tooltip：Radix mechanics，`bg-popover text-popover-foreground shadow-float`。
- Dialog、AlertDialog 与 Drawer：使用 `bg-popover text-popover-foreground shadow-modal`，由 Radix/Vaul 承担 overlay mechanics。危险确认统一通过 workspace-level `WorkspaceDangerConfirmDialog` 使用 AlertDialog 的 title / description / footer 线性结构；Memory delete、Segment delete、Memory space remove 和手动重新生成转录不在确认弹层内嵌套重内容卡，确认按钮不得依赖 Radix 自动关闭弹层，是否关闭由对应业务 flow 决定。
- Toast：root 只挂载一次，toast surface 使用 `bg-popover text-popover-foreground shadow-float`。所有 toast action 使用同一 action button 结构；默认态透明、无边框、无填充底色，hover/active 只用 `color-mix` 填充高光，不画描边，focus-visible 保留键盘可达 ring。恢复 action 使用 icon+文字，不使用裸文字按钮。可撤销删除 toast 统一通过 `showReoUndoToast` 使用同一 neutral surface、目标标题、icon+文字恢复 action、无 close button、`dismissible: false` 和底部 2px 进度条；Memory delete 的 undo 调用 main restore，Segment delete 的 undo 只回滚 renderer pending projection。10 秒 toast duration 是 Segment delete grace-period 唯一时钟。
- Separator：保留语义和命中区，不默认画可见线。
- Switch：Radix mechanics，source 位于 `components/ui/switch.tsx`，当前 consumer 是 `VoiceSettingsPanel` 的「启用豆包语音识别」开关；轨道使用 `bg-secondary`，checked 使用 `bg-primary`，disabled 使用 `bg-muted`，thumb 使用 `bg-background`，不使用描边或阴影。
- Breadcrumb：用于 AppShell panel titlebar；trigger 使用 `rounded-sm` 方圆角，层级之间使用圆点 separator，不使用 chevron。
- Floating Action Button Speed Dial：用于底部表达入口；trigger 使用 `bg-brand-ember` 红色，trigger 和 action 都是全圆 FAB 控件；普通菜单 action 不继承该例外。PrimeReact action 自带圆形样式，Reo primitive 在该层明确保留 `rounded-full`，不能让业务 consumer 处理；结构展开动效不表达基础阴影。
- Waveform：保留 canvas waveform renderer、静态 dots、动态 bars、播放进度双色切分和录音编辑 cursor；主题切换后重新读取 token 并重绘；当 data 为空或样本为零时不绘制占位 bars。
- Edge Fade：`edge-fade-y` 用于纵向 scroll surface 的上下渐隐，`edge-fade-x` 用于横向 scroll surface 的左右渐隐；渐隐是滚动感知的——每个边缘只在该方向有内容被滚走时出现，未滚动或内容不溢出时该边缘清晰无遮挡。`scrollbar-hover` 默认隐藏滚动条，在 hover 或 focus-within 时显示。可滚动转写文本和横向片段流必须复用这些 utilities。

## App Shell

- 当前无 memory space state 使用 `AppShell` + `WorkspaceStarterHome`；Home 主内容区不显示独立创建按钮，创建入口统一在 sidebar 记忆空间列表。
- 当前 loaded memory space state 使用 `AppShell` 包裹 loaded workspace frame；创建记忆空间通过受控 `WorkspaceCreateDialog` 弹层承载，不作为页面 route。
- Sidebar 左下角设置入口由 App 拥有的 app mode 切换驱动：非录音状态点击「设置」进入 settings mode，录音状态点击保持当前 app mode 并使用 root toast 提示先完成或关闭录音。Settings trigger 读取 app-scoped `['settings', 'voice']` 查询，且仅在 `lastValidationCode === 'auth'` 时在齿轮图标上叠加凭证失效红点；settings snapshot 未知、`ok` 或 `network` 时不显示红点。AppShell 只暴露 settings trigger，不持有应用 route state。
- 当前 `AppShell` 有 48px 无边框 titlebar shell slot；titlebar 保持透明 Electron drag region，不画分隔线。窗口控制和 sidebar hide/show control 属于该层。
- AppShell root 和主内容 panel 使用 `bg-background`；左侧 sidebar 使用 `bg-card`；两者在交界处直接相邻，不增加 underlay、合成层、左侧投影或额外边界。
- 主内容 panel 同步保留 48px panel titlebar slot；panel titlebar 只是 page panel 内的高度占位，不建立独立实色 surface。
- Sidebar hide/show control 使用 AppShell 内部几何常量定位，对齐原生 macOS traffic-light 行；这些数值不进入全局 design token。
- Sidebar 宽度可拖拽，最小 240px，最大 520px；covered 状态是主内容面板的 `left` 归零并覆盖 sidebar。
- Sidebar 展开/covered 动效使用 `duration-200 ease-out`，只过渡 panel 的 `left` 与 border radius；拖拽 resize 时关闭 motion，只直接更新 left。

## Settings Shell

- Settings mode 由 App 顶层 `appMode` 切换进入，Sidebar 左下角齿轮「设置」按钮是入口。Settings shell 渲染在现有 AppShell 主内容区，不打开第二个 BrowserWindow，不引入 router package。
- Settings shell 使用左侧设置 nav rail 和右侧内容 panel；设置 nav rail 复用 AppShell sidebar 的宽度、`bg-card` 画布、8px 左右内距和 48px 原生 titlebar 几何，顶部「返回应用」与 macOS 红绿灯底部保持同一视觉间距，下方按类目切换，当前唯一类目是「语音」。Settings titlebar 保持全宽可拖拽且不画分割线；可点击控件使用 no-drag region。
- 返回应用只把 `appMode` 切回 `'app'`，不释放当前 workspace handle，不重置当前 workspace view、selected Memory、Memory detail cache 或 recording lifecycle owner。
- 语音内容由 `VoiceSettingsPanel` 渲染，读取 main-owned voice transcription settings projection；主内容标题「语音」与设置表单列左对齐，整列在内容区居中。它使用 `Switch` 控制豆包语音识别启用状态，同一 X-Api-Key 同时用于录音实时转写、录音文件生成转录和重新生成转录；使用 password `Input` 编辑 X-Api-Key，眼睛按钮只显示当前未保存草稿；保存成功后输入框清空，已保存 key 只显示 last4 和验证状态，清除 X-Api-Key 使用 `WorkspaceDangerConfirmDialog` 二次确认，并说明实时转写和录音文件转录都会停止使用该密钥。若保存时 key 已写入但 validation snapshot 未刷新，renderer 清空草稿并重新读取 `['settings', 'voice']`。
- 录音 overlay open 时 Sidebar settings trigger 保持当前 app mode，并通过 root toast 提示先完成或关闭录音。

## Loaded Workspace

- 当前 loaded workspace frame 使用 AppShell panel titlebar、中央 Workspace Stage 或 Memory Studio、右侧可折叠 MemoryRail 和底部 ExpressionDock。
- Titlebar 使用 shadcn/ui Breadcrumb 组合当前记忆空间标题和当前 Memory 标题，两个层级都接入实体 More 菜单，中间 separator 使用 4px 圆点；titlebar 内容使用 `px-28`，右侧 icon controls 额外内收 `mr-16`。
- 右侧 MemoryRail 读取当前 workspace snapshot 的 Memory 容器，按 Memory 投影 `updatedAt` 倒序展示 title、最近更新时间和片段数，并通过 `MemoryActionsMenu` 承载每个 Memory 的 More 操作。
- Memory space、Memory、Segment 和 SegmentSupplement rename Dialog 提交后立即关闭并更新本地投影；后台 IPC 普通保存失败时只在当前 title 仍是本次提交值时回滚，并通过 root toast 显示错误；`file-written-index-stale` 代表文件真源已写出但投影 stale，renderer 保持 optimistic title，不做本地回滚。Memory delete Dialog 确认后触发 IPC，成功后更新 Query projection，并通过同一 undo toast surface 提供本次恢复入口。Segment delete 使用 AlertDialog 确认；确认后立即关闭弹层、乐观移除 renderer 投影并显示可撤销 toast，toast 的 icon+文字恢复 action 走统一 toast action 样式，toast 自动关闭时才触发 `workspace:deleteSegment`。Segment delete pending projection 绑定提交时的 `workspaceHandle`；不匹配提交 handle 的 toast auto-close、undo 或 in-flight response 不能改写当前 session。Memory space remove 复用同一危险确认结构，但不提供 undo，不删除本地文件夹。
- 底部 ExpressionDock 使用 Floating Action Button Speed Dial，当前可执行 action 是录音和笔记。录音打开 RecordingOverlay；笔记打开 NoteEditorOverlay。其他 action-shaped 位置只表达展开态布局。
- WorkspaceFrame 使用 `h-full min-h-0 overflow-hidden bg-background`，避免内容把 AppShell panel 撑出页面滚动。
- WorkspaceFrame 持有页面级内容轨道：stage shell 只负责外侧 padding，`workspace-stage-content` 使用 `mx-auto w-full max-w-[var(--workspace-stage-max-width)]` 居中，当前 `--workspace-stage-max-width` 为 `1120px`；Expression FAB track 使用同一最大宽度。WorkspaceStage 和 MemoryStudio 只填满该轨道，页面级宽度和偏移由 WorkspaceFrame 统一持有。
- MemoryRail 默认折叠并退出可访问树和指针交互。宽视口使用 inline 模式，`WorkspaceFrame` 使用固定双轨 grid：主内容列和 Memory rail 列；第二轨从 `0px` 到 `240px` 使用 `transition-[grid-template-columns] duration-200 ease-out` 展开或折叠，和 sidebar 的结构动效保持同一时长与曲线。rail shell 使用 `border-l border-secondary` 标记主内容和右侧记忆列表的跨区域边界；主内容轨道在可用主列内保持左右 gutter 对称，不根据 rail 状态做页面内补丁；compact workspace 宽度下才使用 overlay rail。
- Compact workspace 宽度下用户手动展开时使用 overlay 模式覆盖在舞台右侧，不改变中央舞台和 FAB 的对称横向 padding，避免 Memory Studio 被压成窄列。
- MemoryRail list surface 使用全高 `bg-background` 与 `px-8 py-20`，和主内容区保持同一画布填充，不使用 item border、shadow 或 blur。
- MemoryRail memory item 使用灰度卡片填充表达信息单元：常态 `bg-card`，hover `bg-secondary`，当前 Memory `bg-secondary` 并保留 `aria-current`；item 最小高度 68px，主标题 14px，meta 12px，More button 24px。

## 实体 More 菜单

- Memory Space、Memory、Segment 和 SegmentSupplement 四类实体的 More 菜单使用统一三组结构：第一组是 `用默认应用打开` 和 `在访达中显示`；第二组是 `复制相对路径` 和 `复制绝对路径`，Memory Space 只有 `复制绝对路径`；Segment 和 SegmentSupplement 在路径组之后有转录组，按 `transcript.exists` 显示 `生成转录` 或 `重新生成转录`；第三组是 `重命名` 和 `删除`，Memory Space 的末项是 `移除`。每个菜单项左侧都有 lucide 图标，组间使用可见但紧凑的 `DropdownMenuSeparator`。菜单项文案不带 `记忆` 或 `记忆空间` 后缀；实体语义由 trigger 和 menu label 承担。
- 当前 6 个 surface 是 sidebar Memory Space item、loaded workspace titlebar Memory Space title、loaded workspace titlebar current Memory title、MemoryRail Memory item、Memory Studio Segment card 和 Memory Studio SegmentSupplement tab。它们共用 4 个 feature-local typed 组件：`MemorySpaceActionsMenu`（5 项）、`MemoryActionsMenu`（6 项）、`SegmentActionsMenu`（7 项）和 `SegmentSupplementActionsMenu`（7 项），组件位于 `src/renderer/src/workspace/`。
- 打开、在访达中显示、复制相对路径和复制绝对路径 shell 动作通过 `workspaceApi.ts` 的 preload wrapper 触发，并由 `entityActionBindings.ts` 按 Memory Space、Memory、Segment 和 SegmentSupplement 绑定为菜单 handler；每个 entity menu wrapper 通过 `actionIdentity` 接收对应 workspace contract entity action request 类型；`onRename`、`onDelete` 和 `onRemove` callback 由 owner 传入，因为 Dialog、pending projection 和删除恢复状态属于 owner。
- 复制路径成功显示 root toast `已复制路径`；用默认应用打开和在访达中显示成功时静默；错误统一使用 root error toast。
- 路径字符串不进入 renderer：复制路径由 main process 调用 `clipboard.writeText` 写入系统剪贴板，renderer 只接收 `{ ok: true }` 或 typed error。

## Memory Studio

- 选中 Memory 后中央显示 Memory Studio，通过 Memory detail Query 读取当前 Memory 的 finalized audio / note Segment projection 和每个 Segment 的 finalized supplements projection。
- Memory Studio 填满 WorkspaceFrame 提供的居中内容轨道，本身只管理 Segment 预览流、播放区和内容区的内部布局。
- Memory Studio 展示空态、按 Segment 投影 `updatedAt` 倒序排列的 Segment 横向预览流、横向浏览按钮、时间轴和当前片段内容区；不重复渲染 Memory 标题、片段数量或总时长 meta。Segment 横向预览流只挂载当前窗口内的真实 Segment item，并用前后 spacer 保持横向滚动范围和选中项定位，避免大量 Segment 时一次性挂载所有 card/menu/timeline 交互树。
- Segment card、时间轴点、播放区、内容 tab 和内容区通过 feature-local `selectedSegmentId` 同步，只作用于当前 Memory 内的 Segment。
- Segment card 使用紧凑正方形比例、无描边填充状态、静态 waveform glyph 和等宽时间；preview waveform 低振幅为圆点、高振幅为圆角竖柱，常态使用 `muted-foreground`，选中态使用 `foreground`；card 常态为 `bg-card`，选中为 `bg-secondary`。
- Segment card 的选择 button 和 More trigger 是同一 item 内的 sibling controls。More trigger 只在 item hover、focus-within 或 menu open 时可见，使用 `SegmentActionsMenu` 承载实体 More 菜单；`重命名` 打开 `SegmentRenameDialog`，`删除` 打开 `SegmentDeleteDialog`。转录菜单项在 voice settings 关闭、未配置 X-Api-Key、最近验证为 `auth`、录音 overlay 或 Note editor open，或同 target 手动任务 running 时 disabled 并显示 tooltip；最近验证为 `network` 时保持可点击。
- Segment card width 使用 `--memory-studio-segment-card-min-size: 136px` 和 `--memory-studio-segment-card-size: clamp(var(--memory-studio-segment-card-min-size), 18vw, 148px)`，Segment item 与 card 都保留同一最小尺寸，窄窗口通过 strip 横向滚动承载，不压缩卡片内容。
- Segment 横向预览流使用 `edge-fade-x` 表达左右边缘裁切；不在业务层创建独立 gradient overlay。
- Timeline marker 是无描边实心圆点，时间轴线穿过圆点中心，时间标签显示 Segment 创建时间并在圆点下方持续可见；三者固定在对应卡片下方居中，并随同一个 Segment item 横向滚动。
- `CarouselArrowButton` 是 feature-local 40px `rounded-full` overlay icon-only control，只在对应方向可滚动时出现，并只滚动 Segment 预览流；它使用 `bg-background` 和 `border-secondary` 在灰色 Segment card 上形成可识别的圆形控制面，不使用 shadow 或外圈 ring。
- 当前片段内容区通过 Segment content Query 读取 selected finalized Segment 的内容：audio Segment 返回本地音频 bytes 和已保存 transcript，note Segment 返回 Markdown 正文。Audio Segment 转录 tab 使用 selected Segment projection 的 `lastTranscriptionAttempt`、Segment content transcript 和 App 的手动补转录 running set 派生 transcript outcome，并在 `MarkdownContentSurface` 内展示成功、生成中、空态、加载失败和失败可重试状态；普通 Segment 的失败可重试态和 More 菜单 `生成转录` 通过 owner callback 调用 `workspace:requestSegmentTranscriptionBackfill`，目标 payload 是 `{ workspaceId, memoryId, segmentId, mode: 'fill-missing' }`。`重新生成转录` 先打开 `WorkspaceDangerConfirmDialog`，确认后立即关闭弹层并调用同一 channel 且 `mode: 'regenerate'`；后台 mutation 继续由 App 手动补转录 running set 表达，失败只显示 root toast。手动补转录期间只显示 feature-local optimistic running 文案；regenerate running 期间继续渲染既有 transcript 正文并叠加进行中文案。不新增 Query key 或全局 store；成功后复用 transcript save response 更新当前投影。
- 播放区 waveform 使用浏览器 AudioContext 解码 finalized audio bytes 后按窗口取真实峰值，静音保持为空/零值，不回退到固定占位波形；超过 Memory Studio playback waveform 解码上限的本地音频不进入 AudioContext 解码，播放区显示 unavailable waveform 状态。AudioContext decode 输入始终复制成独立 ArrayBuffer，避免浏览器 detach Query/cache-owned audio bytes。Waveform decode 在当前选中 audio resource 已进入稳定 effect 后才启动；如果 Segment 或 SegmentSupplement selection 在 decode 启动前切走，旧 resource 不再启动 AudioContext decode，已启动的 decode 只允许更新仍然 active 的 resource；同一 player 内 decode 串行执行，queued decode 会在启动前复核 generation。同一个 Memory Studio lifecycle 内复用 waveform decoder，普通 Segment 切换不关闭 decoder，Memory Studio unmount、workspace 或 Memory lifecycle 结束时关闭 decoder；Segment 和 SegmentSupplement audio resource cache 复用 Blob URL、waveform 数据和请求 identity，同一实体的新 `requestId` 或 `audioByteLength` 会释放旧 resource，避免旧版本 Blob URL 常驻；切换 Segment、content requestId、audioByteLength、workspace handle 或 unmount 时释放对应资源；播放进度由已播放 `foreground` bars 与未播放 `secondary` bars 的 canvas 切分表达，整个 waveform 热区支持点击 seek；拖拽 seek 必须先由 waveform 内的 pointerdown 创建 scrub session，pointermove 只延续已创建的 scrub session。
- `SegmentTranscriptView` 是 Memory Studio 的 feature-local transcript outcome renderer，当前用于 audio SegmentSupplement 播放行下方的 transcript 区；selected audio Segment 的主 `转录` tab 使用同一 outcome 语义，但承载在 `MarkdownContentSurface` 内。成功态转录正文保持可选中；running 态只渲染 owner 提供的进行中文案且不显示重试按钮；两类空态渲染 owner 提供的空态文案；可重试失败态渲染 owner 提供的失败文案和 shadcn/ui compact secondary Button，缺少 retry handler 时按钮禁用。
- 内容 tab rail 只展示 selected Segment 已存在的内容入口，audio Segment 始终有带图标的 `转录` tab，note Segment 始终有带图标的 `正文` tab；每个 finalized SegmentSupplement 作为独立 tab 出现在同一条 rail 中，tab label 使用 supplement title，内容区不重复渲染 supplement title，也不展示 supplement created time。内容 tab 的 button/label 区域最大宽度是 `130px`，长 supplement title 在 rail 内截断，完整标题保留为 tab 的 accessible name；带 More affordance 的 supplement pill 外层最大宽度是 `170px`，为 hover/focus 展开的 More button 保留完整空间。
- 所有内容 tab item 都保留 type icon、label、active pill、More button 和 reorder anchor。active 只表达当前内容选择；More 是 tab button 的 sibling DropdownMenu trigger，不嵌入 tab button。More 的视觉展开使用 owner tab item 的 CSS `group-hover`、More trigger 自身 `focus-visible` 和 DropdownMenu trigger `data-state="open"`；active selection 不让 More 进入隐藏 tab order，不让它视觉常驻展开。DropdownMenu open 期间 More 保持展开，确保 trigger 作为菜单定位 anchor 的几何稳定，避免鼠标移入菜单时菜单左右抖动。未 hover/focus/open 的 More 同步收束 pointer events、tabIndex 和 `aria-hidden`。DropdownMenu 关闭时如果 trigger 已隐藏，焦点回到对应 tab。`转录` / `正文` primary tab 的 More 复用 `SegmentActionsMenu`，承载用默认应用打开、在访达中显示、复制相对路径、复制绝对路径、重命名和删除；audio `转录` tab 额外承载生成或重新生成转录。SegmentSupplement tab 的 More 使用 `SegmentSupplementActionsMenu` 承载同类实体 More 菜单，audio supplement 额外承载生成或重新生成转录。`生成转录` 和 `重新生成转录` 与 Segment 菜单使用同一 voice settings、recording overlay 和 running disabled 规则；SegmentSupplement 重命名打开 `SegmentSupplementRenameDialog`；SegmentSupplement 删除打开 `SegmentSupplementDeleteDialog`，成功或 `file-written-index-stale` 后都用统一 undo toast 提供恢复入口。内容 tab rail 支持 native drag/drop 重排，`转录` / `正文` tab 和 finalized SegmentSupplement tabs 都可移动；拖拽身份使用 Reo 内部 MIME 和 selected Segment id 校验，More trigger 不参与 drag start，`dragenter` 不改序，`dragover` 以目标 tab 中点计算 before/after 插入位置，同一次拖拽可连续在同一目标前后换位。拖拽期间 action reveal 不接受 target hover 写入：source tab 可保持展开，其他被经过或交换的 tab 不因 drag hover 展开 More。顺序属于 parent Segment 的 durable presentation state：Memory detail projection 读取 Segment manifest 的 `contentTabOrder`，renderer dragover 只维护 pending UI 顺序，drag end 通过 `workspace:updateSegmentContentTabOrder` 写回 `.reo/objects/segments/<segmentId>.json`，成功 response 更新 Workspace snapshot 和 Memory detail cache；该写入不改变 Segment `updatedAt` 或 Memory activity 排序。内容 tab 的 id、panel id、keyboard selection 和 `aria-controls` / `aria-labelledby` 来自同一份 selected Segment content tab model，不用 DOM query 或 click side effect 驱动状态。
- Audio SegmentSupplement tab panel 通过 SegmentSupplement content Query 读取本地音频 bytes 和已保存 transcript，使用与主播放区一致的 play/pause、真实 waveform slider、点击 seek、scrub-session 拖拽 seek 和等宽时间 UI。Segment 和 SegmentSupplement 播放时间 state 按播放进度节流发布，seek、scrub、ended 和重置必须立即发布。补充录音播放失败时显示 `补充录音无法播放，请稍后重试。`，不静默吞掉失败。播放行下方复用 Segment 转录 tab 的 feature-local `SegmentTranscriptView` 展示该 supplement 自身 transcript，并使用 supplement projection 的 `lastTranscriptionAttempt`、SegmentSupplement content transcript 和 App 的手动补转录 running set 派生 outcome；失败可重试态文案是 `上次生成补充录音转录失败。`，owner callback 调用 `workspace:requestSegmentSupplementTranscriptionBackfill`，payload 是 `{ workspaceId, memoryId, segmentId, supplementId, mode }`，其中空 transcript 走 `fill-missing`，重新生成走 AlertDialog 确认后的 `regenerate`。补充录音语境文案是 `正在载入补充录音内容。`、`补充录音转录加载失败，请重试。`、`这段补充录音还没有转录。` 和 `正在生成补充录音转录。`。
- Note Segment 保留与 audio Segment 相同的播放区位置，当前只渲染同一播放 row 的不可播放占位，不额外插入说明文案或改变 tab rail 的纵向位置；Note Segment 正文位于同一条 content tab rail 的 `正文` tab 内。Note Segment 和 Note SegmentSupplement 通过 `MarkdownContentSurface` 渲染 Markdown 正文、载入态、空正文态和加载失败态；该 surface 不执行用户 HTML，不把 Markdown 转成 editor JSON，也不作为语义真源。MarkdownContentSurface 把相对 `attachments/<filename>` 图片引用映射为 `reo-attachment://` 预览 URL，远程 URL、绝对路径和 `file:` 不经该映射。MarkdownContentSurface 不重复渲染 selected Segment 或 supplement title；展开编辑按钮绝对定位在正文区域右上角，不单独占用正文流高度。Note 正文编辑使用 `NoteEditorOverlay` 的单一 markdown-first textarea，不显示 markdown mode badge、standalone 图片上传按钮或未实现 toolbar；已 finalized 的 note edit target 支持把 PNG、JPEG、WebP 或 GIF 图片拖拽或粘贴到正文 textarea，renderer 保存图片到当前 note 文件空间节点的 `attachments/` 后，把 `![alt](attachments/<filename>)` 插入光标位置。新建 Note 从 FAB `笔记` action 进入与录音创建流程同级的沉浸式编辑页面，占据主内容区，不在 Memory Studio 小区域内直接编辑；已 finalized 的 Note Segment 或 Note SegmentSupplement 从 MarkdownContentSurface 右上角展开按钮进入同一编辑页面。Note Segment 正文 overlay 的可见标题是 tab rail 对应的 `正文`，不是 Segment 标题；Note SegmentSupplement overlay 的可见标题是 supplement tab 标题。保存期间 textarea、返回和保存按钮禁用；create overlay 关闭前不创建 draft，点击保存时才创建 note draft、写入 body，再 finalize。正文相对初始值有变化时，返回或关闭 drawer 必须先打开危险确认，确认放弃后关闭且不创建 draft。finalize 失败后 overlay 保留同一 draft revision，允许用户重试。已 finalized 的 Note Segment 编辑走 `workspace:writeSegmentContent`，Note SegmentSupplement 编辑走 `workspace:writeSegmentSupplementContent`；两类 edit target 都带进入编辑时的正文 baseline hash。Visibility refresh 后 clean editor 直接更新到磁盘正文；dirty editor 在正文上方显示磁盘变化提示但不覆盖用户正在编辑的正文。保存遇到外部 Markdown 修改时，overlay 用 AlertDialog 显示冲突；用户可以使用磁盘版本重置 body/baseline，或保留当前修改并用最新磁盘 hash 重试保存。笔记编辑器深化的当前研究方向是 CodeMirror 6 Live Preview：Markdown string 仍是 editor state 和保存真源，光标所在行或块保留 Markdown 源码，其它区域用 decorations/widgets 呈现标题、列表和图片预览；`codemirror-markdown-hybrid` 只作为 spike 候选或参考实现，BlockNote 和 Tiptap 不作为当前目标。
- `视频`、`图片` 不作为常驻禁用 tab 渲染。
- 右侧 `+` 使用标准 32px ghost icon Button，打开 selected Segment 的 SegmentSupplement compact menu，当前显示录音补充项和笔记补充项；录音补充默认 title 是所选 Segment 内的 `补充录音N`，笔记补充默认 title 是所选 Segment 内的 `补充笔记N`，二者都写入 selected Segment supplement，不写入 Memory 顶层 Segment strip，不新建 Memory，不创建同级 Segment。
- SegmentSupplement 删除成功后 App 更新 Workspace snapshot cache、Memory detail cache 和当前 session projection，移除该 supplement 的 exact content Query；如果当前 content tab 指向被删 supplement，Memory Studio fallback 到 `转录`。统一 toast 的 `恢复` action 调用 `workspace:restoreDeletedSegmentSupplement`，恢复成功后用 parent Segment projection 重新显示 supplement tab。删除或恢复返回 `file-written-index-stale` 时，renderer 按文件真源已移动处理：删除关闭 Dialog、保持 supplement hidden、清 exact content Query，并仍显示同一 `已删除补充内容` undo toast；恢复把同一 supplement 投影回 parent Segment，同时显示 root error toast。

## Recording Overlay

- 当前 recording overlay 使用 shadcn Drawer/Vaul source、feature-local recording machine、recording timeline helper 和 browser MediaRecorder adapter。
- 录音前、录音中和暂停态使用沉浸式 full-window recording surface；Vaul 只提供 dialog/dismiss mechanics。
- 录音前、录音中和暂停态 waveform 使用同一 canvas bars 几何：4px bar width、4px bar radius、低振幅和近似正方形样本绘制为圆点，高振幅样本绘制为圆角竖柱；暂停态用 split waveform 表达 cursor 前后，不渲染独立播放指针。
- 录音三态不另建底部控制面板；暂停、回听播放、完成，以及真实能力存在时的继续或替换按钮只作为同一录音层上的轻量 action surface，定位只通过 waveform 点击和 scrub-session 拖拽完成，不提供离散时间跳转按钮。
- 暂停后回听播放按钮只在本地可播放前缀准备完成、隐藏 audio 完成可播放预加载后启用；准备中状态不显示错误 toast，也不允许空 Blob 或未解码 Blob 触发播放失败。
- 录音前引导文案、录音中空转写提示和真实转写文本共享同一 typography：`font-sans text-body-lg font-medium leading-body-lg`；状态只改变文本内容、颜色和滚动策略。
- 录音中的转写区域只消费真实 ASR 片段，不生成本地 mock transcript。需要复制的转录内容必须可选中。
- 录音转写在录音中只跟随内部转写容器底部，暂停态 cursor focus 也只滚动内部转写容器；长转写只把焦点窗口附近的片段作为独立 span 挂载，窗口外文本合并为上下文 span，避免大量 off-window transcript segment 进入 DOM；不得使用会滚动外层页面或 Drawer 的 element-level focus scrolling。
- 录音真实转写容器使用 `edge-fade-y scrollbar-hover`：上下边缘渐隐，右侧滚动条默认隐藏，hover 或 focus-within 时显示。
- 录音中的精确时长保存在 recording duration ref 中；40ms recording clock 只更新精确 ref、恢复快照和业务阈值，视觉计时由独立 `RecordingElapsedTimer` 局部刷新，screen-reader elapsed status 使用独立秒级刷新，避免整个 RecordingOverlay 每个 clock tick 重渲染。Completion backfill 超过 PCM 上限后只保留末尾转写起始缓冲，按 chunk end time 推进 PCM tail head index，并在阈值后压缩数组，不为每个 overflow chunk 搬移或重建整组 PCM 数组。
- 点击完成录音会立即关闭 visible recording surface；App 保留隐藏的 recording lifecycle owner 直到 durable audio finalize、必要的 completion backfill、transcript save 和 recovery marker 收口完成。普通录音默认 title 是目标 Memory 内的 `录音N`；补充录音默认 title 是 selected Segment 内的 `补充录音N`；恢复录音使用 recovery marker 保存的 title。RecordingOverlay 只在 voice settings snapshot 已知后 finalize：语音识别开启时 finalize payload 带 `lastTranscriptionAttemptOnFinalize: 'failed'`，语音识别关闭时带 `'never'`。完成后不进入强制描述、转写编辑或反思编辑窗口；非空最终 transcript 会通过 `workspace:saveTranscript` 写入当前 finalized audio segment 的 `segment.md` 正文，或通过 `workspace:saveSegmentSupplementTranscript` 写入 finalized audio SegmentSupplement 的 `supplement.md` 正文；普通 Segment transcript save 成功后 App 同步 patch Memory detail cache 的 transcript presence 和 `lastTranscriptionAttempt: 'success'`；若后台收口失败，recording surface 重新打开到失败恢复态。
- 录音流程打开时，App 会阻止进入首页、资料库、创建或打开其他记忆空间、移除记忆空间、切换右侧 Memory context、切换到 settings mode，并使用 root toast 提示先完成或关闭录音。
- `RecordingOverlay` 通过 `['settings', 'voice']` 读取 voice transcription settings。语音识别关闭时不调用 `workspace:startRecordingTranscription`，不建立 live ASR audio queue，转写区域显示安静的禁用占位；settings 未加载完成时仍允许开始本地录音，但 live ASR start 会等待 settings snapshot 已知后再按当前 snapshot 决定启动或跳过，避免在未知配置下启动 live ASR；停止录音时 settings 仍未知则不执行 completion backfill 或 durable finalize，并回到失败恢复态。
- 录音中的 live transcript recovery snapshot 至多每 1000ms 写入一次完整 transcript timeline；高频 ASR segment flush 只更新 renderer 内存和已节流的 pending snapshot。暂停、停止、finalize、transcript save 和 unmount cleanup 会先 flush pending transcript recovery state，确保恢复 marker 不因节流而丢失最后一批转写片段。

## State 与 Data

- TanStack Query 和 React Hook Form 已安装，并已有真实 memory space creation consumer。
- 当前 QueryClient provider 服务 memory space list、记忆空间 snapshot cache、Memory detail cache、selected Segment content cache 和 selected SegmentSupplement content cache。Memory detail cache 用于 Memory Studio 的即时投影渲染；从 sidebar 离开并重新进入同一记忆空间时不显示初始载入态，而是先显示 cached Memory detail，再由新 workspace handle 后台刷新。Selected Segment content cache 持有 audio bytes 或 note body；Selected SegmentSupplement content cache 持有 audio bytes 或 note body；workspace session close/reopen 时清理。
- 进入新的 workspace session 或成功离开当前 workspace session 时，App 必须清理 workspace-scoped targets：Memory create/delete/rename、Segment delete/rename、SegmentSupplement delete/rename、Memory space remove/rename 和 Segment focus intent，避免前一 workspace UI target 绑定到新 handle。
- SegmentSupplement rename optimistic mutation 绑定提交时的 `workspaceHandle`；不匹配提交 handle 的 in-flight 保存成功或失败 response 不得 rollback 当前 session、写 cache、显示错误 toast 或合并 session projection。
- Segment delete 确认后 App 先更新 Workspace snapshot cache、对应 Memory detail cache 和当前 session projection，使被删 Segment 立即从 Memory Studio 消失；同一次 toast 的 `恢复` action 只把目标 Segment 重新插回当前投影，保留期间发生的 Memory title 或 summary 投影变化，并用一次性 Segment focus intent 选中恢复 Segment，不调用 `workspace:restoreDeletedSegment`。toast duration 为 10 秒，底部进度条与该 duration 同步，toast 不显示 close button 且不可手动 dismiss。toast lifecycle 使用单向 phase，重复 auto-close 不重复提交，commit 已开始后恢复 action 不执行回滚。Grace period 内的 Workspace refresh 会重放 pending delete projection，只保护目标 Memory detail 和目标 Segment content/supplement content，其它同 workspace 查询照常 invalidate。Pending replay 使用 pending Segment identity 和当前 Memory detail cache 投影可见 Segment；如果当前没有 matching detail cache，则保留当前 session 中该 Memory 的 pending projection，不在 visibility refresh 内为每个 pending Memory 发起 detail IPC，也不用 Workspace summary 的 aggregate count 猜测实体身份。toast 自动关闭后，只有当前 workspace session 仍匹配原 handle 时 App 才调用 `workspace:deleteSegment`；成功后先重放仍 pending 的其它 Segment delete projections，再移除被删 Segment 的 content cache，并按 Segment supplement content query prefix 移除该 Segment 下所有 supplement content cache。`dataRetention: "previous-file-preserved"` 失败用同一局部恢复路径回滚 projection 并显示 root toast；`dataRetention: "file-written-index-stale"` 失败保持删除投影，不把已经移动到文件真源恢复区的 Segment 重新显示。因为 Query key 不含 `workspaceHandle`，App 在进入新的 workspace session 前和关闭当前 session 成功后，会清理同 workspace 的 Segment content 与 SegmentSupplement content cache；Memory detail cache 保留并在新 session ready 后后台刷新。
- Manual transcription backfill running state 由 App component state 持有，分为普通 Segment 和 SegmentSupplement 两个 Map，并记录发起时的 `workspaceHandle`。点击失败转录的「重试」时，如果同 target 已绑定当前 handle 则不重复发起；否则立即显示 `正在生成转录。` 或 `正在生成补充录音转录。`。进入新的 workspace session 时清理不属于当前 handle 的 running key，旧 handle 的 in-flight response 不得阻塞新 handle 重新发起同 target。成功 response 复用录音保存后的 cache merge helper 更新 Workspace snapshot、Memory detail 和相关 content Query，再显示成功 toast；失败 response 显示 root error toast 并清除仍绑定原 handle 的 running 状态。自动补转录没有 renderer-visible running state、toast、event channel 或 Query key。
- Active recording lifecycle、overlay close protection、recording controls、local playback state 和 Blob URL 不进入 Query。
- Zustand 已选型，但当前未安装；没有跨 component subtree state owner 前，不创建 Zustand store。
- 表单使用 React Hook Form + Zod；Memory space create、Memory create、Memory rename、Segment rename 和 memory space rename Dialog 的提交前 title draft 都由表单持有。Memory space rename 的提交值会成为真实 root folder basename，renderer 只提交 trimmed title，最终安全文件夹名校验、同名冲突判断、root move 和 metadata mirror 写入都由 main process 执行。Memory space rename 的普通失败回滚 optimistic title；`file-written-index-stale` 表示 root folder 已移动但后续投影未收口，renderer 保持 optimistic title 并显示 root toast。
- 来自 main/server boundary 的 async data 使用 TanStack Query。

## shadcn/ui 边界

- 只有存在真实 reusable component consumer 时，才允许继续添加 shadcn/ui source。
- 该 consumer 必须需要 reusable primitive、accessible interaction primitive，或明确的 shared visual invariant。
- shadcn/ui source 变更必须同批配置 renderer import alias，并同步 `tsconfig.json`、`electron.vite.config.ts` 和 `vitest.config.ts`。
- `components.json` 的 Tailwind CSS 入口指向 `src/renderer/src/index.css`。
- Tailwind v4 项目中 `components.json` 的 `tailwind.config` 保持空值。
- 新增 component source 必须立即被真实 consumer 使用。
- shadcn/ui component source 的视觉规则必须服从 Reo 设计系统 token。
- 新增 shadcn/ui source 后必须审查并移除生成代码中的同平面 border、默认 shadow、硬编码颜色和组件专属 token 倾向。

## 变更门禁

任何 React structure、reusable components、Tailwind/shadcn setup、forms、UI state、UI data fetching 的项目级模式变化，都必须更新本文档。

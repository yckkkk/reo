# 前端

本文档是 React、样式、组件和 UI state 的当前真源。

## 当前事实

- Renderer 是 React 19 + TypeScript。
- Tailwind CSS v4 已安装，并通过 `@tailwindcss/vite` 接入 renderer build。
- Reo UI 技术框架是 Tailwind CSS v4 + shadcn/ui + Radix primitives。
- Reo 设计系统源文件位于 `docs/current/design-system/`；renderer 可执行主题文件是 `src/renderer/src/theme.css`；renderer 样式入口是 `src/renderer/src/index.css`。
- 当前设计系统是黑色为主、ember 和 destructive red 为辅的 Soft Flat Design System：纯白或极深灰画布、低对比灰度容器、无同平面描边、基础组件无阴影、浮层使用克制 Z 轴投影、黑色用于核心动作和明确状态，ember 用于表达入口和录音主按钮，destructive red 用于删除、清空、放弃等危险动作。
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
- 当前 Vite development browser 调试支持显式 `?reoScenario=memory-studio-rich` 场景：当浏览器页面没有真实 Electron preload bridge 时，renderer 安装 dev-only typed `window.reoWorkspace` 场景 bridge，并通过现有 App、TanStack Query、Loaded Workspace 和 Memory Studio 渲染含 Memory、audio Segment、note Segment、SegmentSupplement、转录和正文的丰富投影；该场景提供非静音音频 bytes，让播放区真实 waveform 也能在浏览器中检查。该场景不进入 production runtime，不替代 Electron preload、IPC、文件真源、录音、OS dialog 或真实音频能力验证。

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
- Dialog、AlertDialog 与 Drawer：使用 `bg-popover text-popover-foreground shadow-modal`，由 Radix/Vaul 承担 overlay mechanics。危险确认统一通过 workspace-level `WorkspaceDangerConfirmDialog` 使用 compact AlertDialog 的 title / description / footer 线性结构；Memory delete、Segment delete、Memory space remove 和手动重新生成转录不在确认弹层内嵌套重内容卡，确认按钮不得依赖 Radix 自动关闭弹层，是否关闭由对应业务 flow 决定。沉浸式编辑 Drawer 使用高于 dev-only feedback toolbar 的 z-index 层级，确保编辑态只显示编辑 surface。
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

- 当前 loaded workspace frame 使用 AppShell panel titlebar、中央 Workspace Stage 或 Memory Studio、右侧可折叠 MemoryRail。WorkspaceFrame 底部 ExpressionDock 在 Workspace Stage 和 Memory Studio 中都保持挂载，由当前 Memory context 决定笔记 action 是否可用。
- Titlebar 使用 shadcn/ui Breadcrumb 组合当前记忆空间标题和当前 Memory 标题，两个层级都接入实体 More 菜单，中间 separator 使用 4px 圆点；titlebar 内容使用 `px-28`，右侧 icon controls 额外内收 `mr-16`。未选中 Memory 时 titlebar 右侧显示全局 `新建记忆`；选中 Memory 后该全局新建入口隐藏，只保留 Memory rail 折叠控制，避免和 Memory Studio 内的片段创建入口重复。
- 右侧 MemoryRail 读取当前 workspace snapshot 的 Memory 容器，按 Memory 投影 `updatedAt` 倒序展示 title、最近更新时间和片段数，并通过 `MemoryActionsMenu` 承载每个 Memory 的 More 操作。
- Memory space、Memory、Segment 和 SegmentSupplement rename Dialog 提交后立即关闭并更新本地投影；普通保存失败只在当前 title 仍是本次提交值时回滚，`file-written-index-stale` 保持 optimistic title 并显示错误。Memory delete 使用真实 IPC 和 undo toast；Segment delete 使用确认弹层、renderer optimistic projection、toast grace period 和 delayed IPC commit；Memory space remove 不提供 undo，也不删除本地文件夹。
- 底部 ExpressionDock 使用 Floating Action Button Speed Dial，当前可执行 action 是录音和笔记。录音打开 RecordingOverlay；笔记打开 NoteEditorOverlay 创建新笔记。Note 创建 editor 或 RecordingOverlay 打开期间，底部 ExpressionDock 不渲染，避免底层表达入口泄漏到沉浸式编辑场景。选中 Memory 后，片段创建入口也位于 Workspace titlebar 右侧操作区的 `新片段` menu，紧邻 MemoryRail 折叠按钮左侧，承载 `录音` 和 `笔记`；它不属于 Segment preview strip 或内容 tab 动作组，不写入当前 `正文`、`转录` 或补充 tab。
- WorkspaceFrame 使用 `h-full min-h-0 overflow-hidden bg-background`，避免内容把 AppShell panel 撑出页面滚动。
- WorkspaceFrame 持有页面级内容轨道：stage shell 负责外侧 padding，`workspace-stage-content` 填满可用主列，不设置最大宽度；WorkspaceStage 和 MemoryStudio 只填满该轨道，页面级宽度和偏移由 WorkspaceFrame 统一持有。
- MemoryRail 默认折叠并退出可访问树和指针交互。宽视口使用 inline 模式，`WorkspaceFrame` 使用固定双轨 grid：主内容列和 Memory rail 列；第二轨从 `0px` 到 `240px` 使用 `transition-[grid-template-columns] duration-200 ease-out` 展开或折叠，和 sidebar 的结构动效保持同一时长与曲线。rail shell 使用 `border-l border-secondary` 标记主内容和右侧记忆列表的跨区域边界；主内容轨道在可用主列内保持左右 gutter 对称，不根据 rail 状态做页面内补丁；compact workspace 宽度下才使用 overlay rail。
- Compact workspace 宽度下用户手动展开时使用 overlay 模式覆盖在舞台右侧，不改变中央舞台和 FAB 的对称横向 padding，避免 Memory Studio 被压成窄列。
- MemoryRail list surface 使用全高 `bg-background` 与 `px-8 py-20`，和主内容区保持同一画布填充，不使用 item border、shadow 或 blur。
- MemoryRail memory item 使用灰度卡片填充表达信息单元：常态 `bg-card`，hover `bg-secondary`，当前 Memory `bg-secondary` 并保留 `aria-current`；item 最小高度 68px，主标题 14px，meta 12px，More button 24px。

## 实体 More 菜单

- Memory Space、Memory、Segment 和 SegmentSupplement 四类实体的 More 菜单使用统一三组结构：第一组是 `用默认应用打开` 和 `在访达中显示`；第二组是 `复制相对路径` 和 `复制绝对路径`，Memory Space 只有 `复制绝对路径`；Segment 和 SegmentSupplement 在路径组之后有转录组，按 `transcript.exists` 显示 `生成转录` 或 `重新生成转录`；第三组是 `重命名` 和 `删除`，Memory Space 的末项是 `移除`。每个菜单项左侧都有 lucide 图标，组间使用可见但紧凑的 `DropdownMenuSeparator`。菜单项文案不带 `记忆` 或 `记忆空间` 后缀；实体语义由 trigger 和 menu label 承担。
- 当前 6 个实体 surface 是 sidebar Memory Space item、loaded workspace titlebar Memory Space title、loaded workspace titlebar current Memory title、MemoryRail Memory item、Memory Studio Segment card 和 Memory Studio SegmentSupplement tab。它们共用 4 个 feature-local typed 菜单壳：`MemorySpaceActionsMenu`（5 项）、`MemoryActionsMenu`（6 项）、`SegmentActionsMenu`（7 项）和 `SegmentSupplementActionsMenu`（7 项），组件位于 `src/renderer/src/workspace/`。Memory Studio primary content tab 使用 `SegmentContentActionsMenu` 表达正文/转录 slot 操作，不承载实体删除或转录生成入口。
- 打开、在访达中显示、复制相对路径和复制绝对路径 shell 动作通过 `workspaceApi.ts` 的 preload wrapper 触发，并由 `entityActionBindings.ts` 按 Memory Space、Memory、Segment 和 SegmentSupplement 绑定为菜单 handler；`EntityPathActionGroup` 统一渲染这些路径类动作的 icon、路径组 separator、复制成功 toast 和错误 toast。每个 entity menu wrapper 通过 `actionIdentity` 接收对应 workspace contract entity action request 类型；`onRename`、`onDelete` 和 `onRemove` callback 由 owner 传入，因为 Dialog、pending projection 和删除恢复状态属于 owner。
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
- 当前片段内容区通过 Segment content Query 读取 selected finalized Segment 的内容：audio Segment 返回本地音频 bytes、已保存 transcript 和 transcript baseline hash，note Segment 返回 Markdown 正文和正文 baseline hash。Audio Segment 的 `转录` tab 在 content Query 成功后常态渲染内联 `LightweightMarkdownEditorSurface`；生成或重新生成转录仍由 Segment card More 菜单承载，后台 mutation 由 App 的手动补转录 running set 表达。
- 播放区 waveform 使用浏览器 AudioContext 从 finalized audio bytes 解码真实峰值，静音不回退到固定占位波形；超过解码上限时显示 unavailable waveform 状态。Waveform decoder、Blob URL 和 resource cache 只在当前 Memory Studio lifecycle 内复用，并在 Segment、content request、audio byte length、workspace handle 或 unmount 变化时释放。播放进度由 canvas bars 切分表达，点击和 scrub-session 拖拽 seek 由 waveform 自身拥有。
- `SegmentTranscriptView` 是 Memory Studio 的 feature-local transcript loading/error/fallback renderer；content Query 成功后，selected audio Segment 转录和 audio SegmentSupplement 转录都进入同一轻量 textarea editor。Note Segment card 的正文大小使用人类可读字节标签，不直接显示原始 `B` 后缀。
- 内容 tab rail 只展示 selected Segment 已存在的内容入口，audio Segment 始终有带图标的 `转录` tab，note Segment 始终有带图标的 `正文` tab；每个 finalized SegmentSupplement 作为独立 tab 出现在同一条 rail 中，tab label 使用 supplement title，内容区不重复渲染 supplement title，也不展示 supplement created time。内容 tab 的 button/label 区域最大宽度是 `130px`，长 supplement title 在 rail 内截断，完整标题保留为 tab 的 accessible name；带 More affordance 的 supplement pill 外层最大宽度是 `170px`，为 hover/focus 展开的 More button 保留完整空间。
- 所有内容 tab item 都保留 type icon、label、active state、More button 和 reorder anchor。More 是 tab button 的 sibling DropdownMenu trigger，不嵌入 tab button；hidden More 必须同时收束 pointer events、tabIndex 和 `aria-hidden`。`转录` / `正文` primary tab 的 More 使用 `SegmentContentActionsMenu`，只承载内容槽路径、重命名和清空能力，不承载编辑、生成转录、重新生成转录或删除。SegmentSupplement tab 的 More 使用 `SegmentSupplementActionsMenu` 承载同类实体动作，audio supplement 额外承载生成或重新生成转录。内容 tab rail 支持 native drag/drop 重排 `转录` / `正文` 和 finalized SegmentSupplement tabs；顺序属于 parent Segment 的 durable presentation state，写入 Segment manifest `contentTabOrder`，不改变 Segment `updatedAt` 或 Memory activity 排序。
- Audio SegmentSupplement tab panel 通过 SegmentSupplement content Query 读取本地音频 bytes 和已保存 transcript，使用与主播放区一致的 play/pause、真实 waveform slider、点击 seek、scrub-session 拖拽 seek 和等宽时间 UI。播放行下方在 content Query 成功后常态渲染该 supplement 自身 transcript 的内联 `LightweightMarkdownEditorSurface`；生成或重新生成补充录音转录由 SegmentSupplement More 菜单承载。
- Note Segment 不渲染可操作 audio 播放 row 或不可播放文案，但保留与主 audio player 等高的不可见布局占位，让 note 和 audio Segment 的 content tab rail、正文/转录正文和编辑 surface 使用同一垂直起点。Note 正文、Note SegmentSupplement 正文、selected audio Segment 转录正文和 Audio SegmentSupplement 转录正文在 content Query 成功后都常态渲染同一个 textarea-first `LightweightMarkdownEditorSurface`。该 surface 只编辑 Markdown 字符串，dirty 时显示保存/取消，保存使用当前 baseline 防止外部修改覆盖；Note 正文类 stale 保存由当前编辑 surface 的 AlertDialog 处理，转录类 stale 保存显示可见错误并保留当前 textarea 内容。finalized inline text dirty 时阻止 workspace flow interruption 和窗口关闭。
- `视频`、`图片` 不作为常驻禁用 tab 渲染。
- 内容动作组中的 `补充` icon+text Button 打开 selected Segment 的 SegmentSupplement compact menu，当前显示录音补充项和笔记补充项；录音补充默认 title 是所选 Segment 内的 `补充录音N`，笔记补充默认 title 是所选 Segment 内的 `补充笔记N`，二者都写入 selected Segment supplement，不写入 Memory 顶层 Segment strip，不新建 Memory，不创建同级 Segment。
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
- 点击完成录音会立即关闭 visible recording surface；App 保留隐藏 lifecycle owner 直到 durable finalize、必要补转录、transcript save 和 recovery marker 收口。普通录音默认 title 是目标 Memory 内的 `录音N`，补充录音默认 title 是 selected Segment 内的 `补充录音N`。Finalize 必须等待 voice settings snapshot；最终 transcript 写入对应 finalized Markdown，后台收口失败时 recording surface 重新打开到失败恢复态。
- 录音流程打开时，App 会阻止进入首页、资料库、创建或打开其他记忆空间、移除记忆空间、切换右侧 Memory context、切换到 settings mode，并使用 root toast 提示先完成或关闭录音。
- `RecordingOverlay` 通过 `['settings', 'voice']` 读取 voice transcription settings。语音识别关闭时不调用 `workspace:startRecordingTranscription`，不建立 live ASR audio queue，转写区域显示安静的禁用占位；settings 未加载完成时仍允许开始本地录音，但 live ASR start 会等待 settings snapshot 已知后再按当前 snapshot 决定启动或跳过，避免在未知配置下启动 live ASR；停止录音时 settings 仍未知则不执行 completion backfill 或 durable finalize，并回到失败恢复态。
- 录音中的 live transcript recovery snapshot 至多每 1000ms 写入一次完整 transcript timeline；高频 ASR segment flush 只更新 renderer 内存和已节流的 pending snapshot。暂停、停止、finalize、transcript save 和 unmount cleanup 会先 flush pending transcript recovery state，确保恢复 marker 不因节流而丢失最后一批转写片段。

## State 与 Data

- TanStack Query 和 React Hook Form 已安装，并已有真实 memory space creation consumer。
- 当前 QueryClient provider 服务 memory space list、记忆空间 snapshot cache、Memory detail cache、selected Segment content cache 和 selected SegmentSupplement content cache。Memory detail cache 用于 Memory Studio 的即时投影渲染；从 sidebar 离开并重新进入同一记忆空间时不显示初始载入态，而是先显示 cached Memory detail，再由新 workspace handle 后台刷新。Selected Segment content cache 持有 audio bytes 或 note body；Selected SegmentSupplement content cache 持有 audio bytes 或 note body；workspace session close/reopen 时清理。
- 进入新的 workspace session 或成功离开当前 workspace session 时，App 必须清理 workspace-scoped targets：Memory create/delete/rename、Segment delete/rename、SegmentSupplement delete/rename、Memory space remove/rename 和 Segment focus intent，避免前一 workspace UI target 绑定到新 handle。
- SegmentSupplement rename optimistic mutation 绑定提交时的 `workspaceHandle`；不匹配提交 handle 的 in-flight 保存成功或失败 response 不得 rollback 当前 session、写 cache、显示错误 toast 或合并 session projection。
- Segment delete 确认后 App 立即从 Workspace snapshot cache、Memory detail cache 和当前 session projection 中移除目标 Segment，并显示不可手动关闭的可撤销 toast。Toast `恢复` action 只做 renderer local projection restore，不调用 `workspace:restoreDeletedSegment`；自动关闭后只有当前 workspace session 仍匹配原 handle 才提交 `workspace:deleteSegment`。Grace period 内 refresh 必须重放 pending projection，且只能按 Segment identity 判断目标，不使用 summary aggregate 猜测实体状态。`previous-file-preserved` 失败走局部回滚；`file-written-index-stale` 保持删除投影。
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

只有当改动改变 React structure、reusable component 合同、Tailwind/shadcn setup、forms owner、UI state owner、UI data fetching 模型、设计系统不变量或当前能力索引时，才更新本文档。单个组件内部微调、一次性视觉取舍和任务验证证据留在 spec 或 archive。

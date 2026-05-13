# 前端

本文档是 React、样式、组件和 UI state 的当前真源。

## 当前事实

- Renderer 是 React 19 + TypeScript。
- Tailwind CSS v4 已安装，并通过 `@tailwindcss/vite` 接入 renderer build。
- Reo UI 技术框架是 Tailwind CSS v4 + shadcn/ui + Radix primitives。
- Reo 设计系统源文件位于 `docs/current/design-system/`；renderer 可执行主题文件是 `src/renderer/src/theme.css`；renderer 样式入口是 `src/renderer/src/index.css`。
- 当前设计系统是黑色为主、红色为辅的 Soft Flat Design System：纯白或极深灰画布、低对比灰度容器、无同平面描边、基础组件无阴影、浮层使用克制 Z 轴投影、黑色用于核心动作和明确状态，红色用于表达入口、录音主按钮和危险/高注意力状态。
- `src/renderer/src/index.css` 负责 Tailwind v4 import、`data-theme="dark"` dark variant、Electron drag/no-drag utility、全局不可选中文本和输入/转录类文本可选中规则。
- `src/renderer/src/index.css` 定义设计系统级 Tailwind v4 utilities：`edge-fade-y`、`edge-fade-x` 和 `scrollbar-hover`。它们用于可滚动内容边缘渐隐和 hover/focus 时才显露滚动条的文本容器，不由业务组件重复实现 gradient overlay、mask 或 scrollbar 规则。
- 当前 App shell 支持三态外观偏好 `浅色 / 深色 / 跟随系统`；偏好由 `App` 持有，默认 `跟随系统`，通过 `localStorage` key `reo.themePreference.v1` 跨会话持久化。`跟随系统` 由 `matchMedia('(prefers-color-scheme: dark)')` 解析并订阅 OS 偏好变化，得到 effective theme `light|dark`；effective theme 同时写入 App shell `data-theme` 与 document 根节点 `data-theme` 驱动 token 级联，并传给 Sonner toast theme，确保 Radix portal 内容也继承当前主题。侧边栏底部使用单按钮循环 `浅色 → 深色 → 跟随系统 → 浅色`，按钮图标随当前偏好变化（Sun / Moon / MonitorSmartphone）。
- 当前 shadcn/ui source 范围包含 `components.json`、renderer `@/*` alias、`components/ui/button.tsx`、`components/ui/input.tsx`、`components/ui/label.tsx`、`components/ui/dialog.tsx`、`components/ui/drawer.tsx`、`components/ui/dropdown-menu.tsx`、`components/ui/breadcrumb.tsx`、`components/ui/textarea.tsx`、`components/ui/tooltip.tsx`、`components/ui/separator.tsx`、`components/ui/field.tsx` 和 `lib/utils.ts`。
- 当前 `components/ui/floating-action-button-speed-dial.tsx` 是 Reo 的 Floating Action Button Speed Dial primitive，使用 PrimeReact SpeedDial mechanics 并映射到 Reo design system。
- Vaul 已作为 shadcn Drawer 的 dialog/dismiss mechanics dependency 引入。
- Sonner 已作为 toast mechanics dependency 引入；renderer root 使用 `ReoToaster` 统一承载非阻断操作提示。
- `Waveform` 是当前 Reo audio UI primitive；它支持 canvas bars、静态 dots、播放进度双色切分和录音编辑 cursor，不包含 agent runtime、network/API key、demo feedback 或未实现文案。
- 当前没有 shared local playback primitive；暂停态回听由 recording overlay 内部的隐藏 HTMLAudioElement 和 feature-local controls 承担。
- 当前 Radix primitives 安装并使用 `@radix-ui/react-slot`、`@radix-ui/react-label`、`@radix-ui/react-dialog`、`@radix-ui/react-dropdown-menu`、`@radix-ui/react-tooltip` 和 `@radix-ui/react-separator`。
- 当前真实 reusable component consumer 是 app shell、memory space starter home、memory space create dialog、memory space entry form、loaded workspace frame、recording overlay、recording control surface 和 root toast host。
- 当前 renderer 入口由 QueryClient provider 包裹。
- 当前 renderer route state 覆盖无 active memory space 的 starter Home shell 和已初始化或已打开 memory space 的 loaded shell。
- Agentation 作为 dev-only renderer feedback toolbar 挂载在 renderer root，只在 Vite development 且非 test mode 下 lazy-load；它连接本机 `http://localhost:4747` MCP endpoint，保留点击标注、文本选择、多选、复制输出、本地持久化和 MCP sync 能力，不进入 product App tree、product runtime state、Query、preload 或 IPC。

## 设计系统规则

- 业务 TSX 只能消费现有语义 token，例如 `bg-background`、`bg-card`、`bg-secondary`、`bg-accent`、`text-foreground`、`text-muted-foreground`、`bg-primary`、`text-primary-foreground`、`bg-popover`、`shadow-float` 和 `shadow-modal`。
- 业务 TSX 不写硬编码颜色，不为单个组件新增设计系统 token，不把 feature-local geometry 提升成全局 token。
- 同平面的 Card、Button、Input、列表项、tab、workspace panel 和内容区不用 border 分割；难以区分时增加间距或调整灰度填充。跨区域边界和浮在内容之上的局部 overlay control 可以使用 token 化细边框来维持可读性。
- Button、Input、Textarea、Field、Memory card、Segment card 和普通 action 默认无阴影。
- 只有 Tooltip、DropdownMenu、Dialog、Drawer 和 Toast 这类临时浮层使用 `shadow-float` 或 `shadow-modal`。
- Hover、active、selected 通过灰度阶梯表达：常态使用透明或 `bg-card`，hover 使用 `bg-secondary` 或 `bg-accent`，选中使用 `bg-secondary` 并配合文字权重、状态点或黑色主动作。
- `rounded-full` 只用于 FAB trigger、FAB action、录音主按钮、Segment strip overlay arrow、圆点、timeline marker 和 drawer/waveform handle。普通文本按钮使用 `rounded-lg`，compact 文本按钮使用 `rounded-md`，32px icon button 使用 `rounded-sm`，40px icon button 和菜单 action 使用 `rounded-md`，titlebar Breadcrumb trigger 使用 `rounded-sm`，输入框和卡片使用方圆角。
- 常规交互动效使用 `duration-150 ease-out`；结构动效上限 `duration-200 ease-out`；reduced motion 下关闭。
- 全局默认不可选中文本；输入、textarea、contenteditable、转录、日志、路径和其他需要复制的内容必须显式 `select-text` 或 `.selectable-text`。
- 顶部标题栏拖拽区使用 `.drag-region` 或等价 `-webkit-app-region: drag`；内部按钮必须使用 `.no-drag-region` 或等价 `-webkit-app-region: no-drag`。

## Primitive 当前形态

- Button：radius 由 size variant 决定，文本动作用 `rounded-lg` / `rounded-md`，icon action 用 `rounded-sm` / `rounded-md` / `rounded-lg`；通用 Button primitive 不提供全圆 variant；`border-0`、`shadow-none`、focus ring；primary 使用黑色 `bg-primary` 并避免 hover 色相跳变；destructive 使用 `bg-destructive`；secondary/ghost 使用灰度填充。FAB 使用 `bg-brand-ember`；录音主 CTA 使用 `bg-brand-ember`。FAB 和录音主 CTA 的全圆例外保留在各自 owner component。
- Input 与 Textarea：`bg-input`、`border-0`、`shadow-none`；focus 与 invalid 只用 ring。
- Field：字段行通过留白分隔，不使用 row divider。
- DropdownMenu：Radix mechanics，`bg-popover text-popover-foreground shadow-float`，item 使用 compact density 和灰度 focus 状态，默认 `modal={false}`。
- Tooltip：Radix mechanics，`bg-popover text-popover-foreground shadow-float`。
- Dialog 与 Drawer：使用 `bg-popover text-popover-foreground shadow-modal`，由 Radix/Vaul 承担 overlay mechanics。
- Toast：root 只挂载一次，toast surface 使用 `bg-popover text-popover-foreground shadow-float`。
- Separator：保留语义和命中区，不默认画可见线。
- Breadcrumb：用于 AppShell panel titlebar；trigger 使用 `rounded-sm` 方圆角，层级之间使用圆点 separator，不使用 chevron。
- Floating Action Button Speed Dial：用于底部表达入口；trigger 使用 `bg-brand-ember` 红色，trigger 和 action 都是全圆 FAB 控件；普通菜单 action 不继承该例外。PrimeReact action 自带圆形样式，Reo primitive 在该层明确保留 `rounded-full`，不能让业务 consumer 处理；结构展开动效不表达基础阴影。
- Waveform：保留 canvas waveform renderer、静态 dots、动态 bars、播放进度双色切分和录音编辑 cursor；当 data 为空或样本为零时不绘制占位 bars。
- Edge Fade：`edge-fade-y` 用于纵向 scroll surface 的上下渐隐，`edge-fade-x` 用于横向 scroll surface 的左右渐隐；`scrollbar-hover` 默认隐藏滚动条，在 hover 或 focus-within 时显示。可滚动转写文本和横向片段流必须复用这些 utilities。

## App Shell

- 当前无 memory space state 使用 `AppShell` + `WorkspaceStarterHome`；Home 主内容区不显示独立创建按钮，创建入口统一在 sidebar 记忆空间列表。
- 当前 loaded memory space state 使用 `AppShell` 包裹 loaded workspace frame；创建记忆空间通过受控 `WorkspaceCreateDialog` 弹层承载，不作为页面 route。
- 当前 `AppShell` 有 48px 无边框 titlebar shell slot；titlebar 保持透明 Electron drag region，不画分隔线。窗口控制和 sidebar hide/show control 属于该层。
- AppShell root 和主内容 panel 使用 `bg-background`；左侧 sidebar 使用 `bg-card`；两者在交界处直接相邻，不增加 underlay、合成层、左侧投影或额外边界。
- 主内容 panel 同步保留 48px panel titlebar slot；panel titlebar 只是 page panel 内的高度占位，不建立独立实色 surface。
- Sidebar hide/show control 使用 AppShell 内部几何常量定位，对齐原生 macOS traffic-light 行；这些数值不进入全局 design token。
- Sidebar 宽度可拖拽，最小 240px，最大 520px；covered 状态是主内容面板的 `left` 归零并覆盖 sidebar。
- Sidebar 展开/covered 动效使用 `duration-200 ease-out`，只过渡 panel 的 `left` 与 border radius；拖拽 resize 时关闭 motion，只直接更新 left。

## Loaded Workspace

- 当前 loaded workspace frame 使用 AppShell panel titlebar、中央 Workspace Stage 或 Memory Studio、右侧可折叠 MemoryRail 和底部 ExpressionDock。
- Titlebar 使用 shadcn/ui Breadcrumb 组合当前记忆空间标题和当前 Memory 标题，两个层级都用 DropdownMenu 提供重命名入口，中间 separator 使用 4px 圆点；titlebar 内容使用 `px-28`，右侧 icon controls 额外内收 `mr-16`。
- 右侧 MemoryRail 读取当前 workspace snapshot 的 Memory 容器，按 Memory 投影 `updatedAt` 倒序展示 title、最近更新时间和片段数，并通过 DropdownMenu More 操作打开 memory rename Dialog 或 Memory delete confirmation Dialog。
- Memory space、Memory 和 Segment rename Dialog 提交后立即关闭并更新本地投影；后台 IPC 保存失败时只在当前 title 仍是本次提交值时回滚，并通过 root toast 显示错误。
- 底部 ExpressionDock 使用 Floating Action Button Speed Dial，录音是唯一可执行 action，其他 action-shaped 位置只表达展开态布局。
- WorkspaceFrame 使用 `h-full min-h-0 overflow-hidden bg-background`，避免内容把 AppShell panel 撑出页面滚动。
- WorkspaceFrame 持有页面级内容轨道：stage shell 只负责外侧 padding，`workspace-stage-content` 使用 `mx-auto w-full max-w-[var(--workspace-stage-max-width)]` 居中，当前 `--workspace-stage-max-width` 为 `1120px`；Expression FAB track 使用同一最大宽度。WorkspaceStage 和 MemoryStudio 只填满该轨道，页面级宽度和偏移由 WorkspaceFrame 统一持有。
- MemoryRail 默认折叠并退出可访问树和指针交互。宽视口使用 inline 模式，`WorkspaceFrame` 使用固定双轨 grid：主内容列和 Memory rail 列；第二轨从 `0px` 到 `240px` 使用 `transition-[grid-template-columns] duration-200 ease-out` 展开或折叠，和 sidebar 的结构动效保持同一时长与曲线。rail shell 使用 `border-l border-secondary` 标记主内容和右侧记忆列表的跨区域边界；主内容轨道在可用主列内保持左右 gutter 对称，不根据 rail 状态做页面内补丁；compact workspace 宽度下才使用 overlay rail。
- Compact workspace 宽度下用户手动展开时使用 overlay 模式覆盖在舞台右侧，不改变中央舞台和 FAB 的对称横向 padding，避免 Memory Studio 被压成窄列。
- MemoryRail list surface 使用全高 `bg-background` 与 `px-8 py-20`，和主内容区保持同一画布填充，不使用 item border、shadow 或 blur。
- MemoryRail memory item 使用灰度卡片填充表达信息单元：常态 `bg-card`，hover `bg-secondary`，当前 Memory `bg-secondary` 并保留 `aria-current`；item 最小高度 68px，主标题 14px，meta 12px，More button 24px。

## Memory Studio

- 选中 Memory 后中央显示 Memory Studio，通过 Memory detail Query 读取当前 Memory 的 finalized audio Segment projection 和每个 Segment 的 finalized attachments projection。
- Memory Studio 填满 WorkspaceFrame 提供的居中内容轨道，本身只管理 Segment 预览流、播放区和内容区的内部布局。
- Memory Studio 展示空态、按 Segment 投影 `updatedAt` 倒序排列的 Segment 横向预览流、横向浏览按钮、时间轴和当前片段内容区；不重复渲染 Memory 标题、片段数量或总时长 meta。
- Segment card、时间轴点、播放区、内容 tab 和内容区通过 feature-local `selectedSegmentId` 同步，只作用于当前 Memory 内的 Segment。
- Segment card 使用紧凑正方形比例、无描边填充状态、静态 waveform glyph 和等宽时间；preview waveform 低振幅为圆点、高振幅为圆角竖柱，常态使用 `muted-foreground`，选中态使用 `foreground`；card 常态为 `bg-card`，选中为 `bg-secondary`。
- Segment card 的选择 button 和 More trigger 是同一 item 内的 sibling controls。More trigger 只在 item hover、focus-within 或 menu open 时可见，使用 DropdownMenu 承载 `重命名` 操作，并打开 `SegmentRenameDialog`。
- Segment card width 使用 `--memory-studio-segment-card-min-size: 136px` 和 `--memory-studio-segment-card-size: clamp(var(--memory-studio-segment-card-min-size), 18vw, 148px)`，Segment item 与 card 都保留同一最小尺寸，窄窗口通过 strip 横向滚动承载，不压缩卡片内容。
- Segment 横向预览流使用 `edge-fade-x` 表达左右边缘裁切；不在业务层创建独立 gradient overlay。
- Timeline marker 是无描边实心圆点，时间轴线穿过圆点中心，时间标签显示 Segment 创建时间并在圆点下方持续可见；三者固定在对应卡片下方居中，并随同一个 Segment item 横向滚动。
- `CarouselArrowButton` 是 feature-local 40px `rounded-full` overlay icon-only control，只在对应方向可滚动时出现，并只滚动 Segment 预览流；它使用 `bg-background` 和 `border-secondary` 在灰色 Segment card 上形成可识别的圆形控制面，不使用 shadow 或外圈 ring。
- 当前片段内容区通过 Segment content Query 读取 selected finalized audio Segment 的本地音频 bytes 和已保存 transcript，提供原生 audio Blob URL 播放/暂停和 transcript 查看。
- 播放区 waveform 使用浏览器 AudioContext 解码 finalized audio bytes 后按窗口取真实峰值，静音保持为空/零值，不回退到固定占位波形；播放进度由已播放 `foreground` bars 与未播放 `secondary` bars 的 canvas 切分表达，整个 waveform 热区支持点击 seek；拖拽 seek 必须先由 waveform 内的 pointerdown 创建 scrub session，pointermove 只延续已创建的 scrub session。
- 内容 tab 只展示 selected Segment 已存在的内容入口，audio Segment 始终有 `转录` tab；只有 selected Segment 存在 finalized attachments 时才显示 `补充` tab。
- `补充` tab 内的录音补充通过 SegmentAttachment audio content Query 读取本地音频 bytes，使用与主播放区一致的 play/pause、真实 waveform slider、点击 seek、scrub-session 拖拽 seek 和等宽时间 UI，不展示 transcript。
- `笔记`、`视频`、`图片` 不作为常驻禁用 tab 渲染。
- 右侧 `+` 打开 selected Segment 的 SegmentAttachment compact menu，当前显示录音补充项；录音补充默认 title 是所选 Segment 内的 `补充录音N`，写入 selected Segment attachment，不写入 Memory 顶层 Segment strip，不新建 Memory，不创建同级 Segment。

## Recording Overlay

- 当前 recording overlay 使用 shadcn Drawer/Vaul source、feature-local recording machine、recording timeline helper 和 browser MediaRecorder adapter。
- 录音前、录音中和暂停态使用沉浸式 full-window recording surface；Vaul 只提供 dialog/dismiss mechanics。
- 录音前、录音中和暂停态 waveform 使用同一 canvas bars 几何：4px bar width、4px bar radius、低振幅和近似正方形样本绘制为圆点，高振幅样本绘制为圆角竖柱；暂停态用 split waveform 表达 cursor 前后，不渲染独立播放指针。
- 录音三态不另建底部控制面板；暂停、回听播放、完成，以及真实能力存在时的继续或替换按钮只作为同一录音层上的轻量 action surface，定位只通过 waveform 点击和 scrub-session 拖拽完成，不提供离散时间跳转按钮。
- 暂停后回听播放按钮只在本地可播放前缀准备完成、隐藏 audio 完成可播放预加载后启用；准备中状态不显示错误 toast，也不允许空 Blob 或未解码 Blob 触发播放失败。
- 录音前引导文案、录音中空转写提示和真实转写文本共享同一 typography：`font-sans text-body-lg font-medium leading-body-lg`；状态只改变文本内容、颜色和滚动策略。
- 录音中的转写区域只消费真实 ASR 片段，不生成本地 mock transcript。需要复制的转录内容必须可选中。
- 录音转写在录音中只跟随内部转写容器底部，暂停态 cursor focus 也只滚动内部转写容器；不得使用会滚动外层页面或 Drawer 的 element-level focus scrolling。
- 录音真实转写容器使用 `edge-fade-y scrollbar-hover`：上下边缘渐隐，右侧滚动条默认隐藏，hover 或 focus-within 时显示。
- 点击完成录音会立即关闭 visible recording surface；App 保留隐藏的 recording lifecycle owner 直到 durable audio finalize、必要的 completion backfill、transcript save 和 recovery marker 收口完成。普通录音默认 title 是目标 Memory 内的 `录音N`；恢复录音使用 recovery marker 保存的 title。完成后不进入强制描述、转写编辑或反思编辑窗口；非空最终 transcript 会通过 `workspace:saveTranscript` 写入当前 finalized audio segment；若后台收口失败，recording surface 重新打开到失败恢复态。
- 录音流程打开时，App 会阻止进入首页、资料库、创建或打开其他记忆空间、移除记忆空间、切换右侧 Memory context，并使用 root toast 提示先完成或关闭录音。

## State 与 Data

- TanStack Query 和 React Hook Form 已安装，并已有真实 memory space creation consumer。
- 当前 QueryClient provider 服务 memory space list、记忆空间 snapshot cache、Memory detail cache、selected Segment content cache 和 selected SegmentAttachment audio content cache。
- Active recording lifecycle、overlay close protection、recording controls、local playback state 和 Blob URL 不进入 Query。
- Zustand 已选型，但当前未安装；没有跨 component subtree state owner 前，不创建 Zustand store。
- 表单使用 React Hook Form + Zod；Memory space create、Memory create、Memory rename、Segment rename 和 memory space rename Dialog 的提交前 title draft 都由表单持有。
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

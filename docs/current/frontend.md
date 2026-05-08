# 前端

本文档是 React、样式、组件和 UI state 的当前真源。

## 当前事实

- Renderer 是 React 19 + TypeScript。
- Tailwind CSS v4 已安装，并通过 `@tailwindcss/vite` 接入 renderer build。
- Reo 设计系统源文件位于 `docs/current/design-system/`。
- Reo 设计系统包含 tokens、component shape、surfaces、elevation、layout 和 usage rules。
- 当前 styling foundation 使用 Reo 设计系统 token：暖白底、黑色主文字、低饱和中性色、蓝/橙小型点缀、细边界和轻量阴影。
- Renderer 可执行主题文件是 `src/renderer/src/theme.css`。
- Reo UI 技术框架已确认为 Tailwind CSS v4 + shadcn/ui + Radix primitives。
- shadcn/ui 已按 source-owned 模式初始化配置：`components.json`、renderer `@/*` alias、`components/ui/button.tsx`、`components/ui/input.tsx`、`components/ui/label.tsx`、`components/ui/dialog.tsx`、`components/ui/drawer.tsx`、`components/ui/textarea.tsx`、`components/ui/tooltip.tsx`、`components/ui/separator.tsx`、`components/ui/field.tsx`、`components/ui/menu.tsx` 和 `lib/utils.ts`。
- Vaul 已作为 shadcn Drawer 的 bottom drawer mechanics dependency 引入。
- Sonner 已作为 toast mechanics dependency 引入；renderer root 使用 `ReoToaster` 统一承载非阻断操作提示。
- ElevenLabs UI source-derived `Waveform` 与 `VoiceButton` 已作为 Reo audio UI primitive 引入，并已裁剪掉 agent runtime、network/API key、demo feedback 和未实现文案。
- 当前 `AudioPlayer` 是 Reo local playback primitive：已评估 ElevenLabs Audio Player source，当前采纳 HTML5 audio underlay、Reo play/pause control、Radix Slider playback position、time labels、playback surface 信息层级和 Reo token；完整 provider、playlist、speed 和 global progress 等到出现真实 consumer 时再引入。
- 当前 Radix primitives 安装并使用 `@radix-ui/react-slot`、`@radix-ui/react-label`、`@radix-ui/react-dialog`、`@radix-ui/react-tooltip`、`@radix-ui/react-separator` 和 `@radix-ui/react-slider`。
- 当前真实 reusable component consumer 是 app shell、workspace starter home、workspace create dialog、workspace entry form、workspace home、memory detail、recording overlay、recording drawer control shell 和 root toast host。
- 当前 renderer 入口由 QueryClient provider 包裹。
- 当前 renderer route state 覆盖无 active workspace 的 starter Home shell 和已初始化或已打开 workspace 的 loaded shell。
- 当前无 workspace state 使用 `AppShell` + `WorkspaceStarterHome`；Home 主内容区不显示独立创建按钮，创建入口统一在 sidebar 项目区。
- 当前 loaded workspace state 使用 `AppShell` 包裹 workspace home 或当前 memory detail；创建工作区通过受控 `WorkspaceCreateDialog` 弹层承载，不作为页面 route。
- 当前 `AppShell` 有 48px 无边框 titlebar shell slot；titlebar 使用 `--spacing-titlebar`，视觉上不画分隔线，窗口控制和 sidebar hide/show control 属于该层。sidebar hide/show control 使用 80px 的 `--spacing-titlebar-control-left` 和 2px 的 `--spacing-titlebar-control-top` 定位，对齐原生 macOS traffic-light 行，不再用 48px titlebar 垂直居中；主内容 panel 同步保留 48px panel titlebar slot，页面内容从该 slot 下方开始。
- 当前 workspace home 展示 `全部记忆`、workspace title 标签、workspace description、本地 `搜索记忆` 输入、memory count、月份分组、memory card、空 workspace 状态、search 空结果状态和单一 `记录记忆` action。
- 当前 memory detail 展示 memory title、创建日期、单一 `继续记录` action、`语音录音`、`转写`、`反思` 和 `记忆内容` section；录音卡展示 recording title、`时长` 和 `音频` byte size。
- 当前 memory detail 的 `语音录音` 是有界首屏 preview：meta 显示总 recording count，列表最多展示 main detail response 返回的前 24 条 recording summary；当 `recordingsTruncated` 为 true 时显示当前只展示前 N 段录音的提示，不创建分页、virtualization 或后续加载 action。
- 当前 memory detail 的 `转写`/`反思` section 使用 file-backed summary flags 显示已保存/空状态；不在未知文件真源时硬编码文件内容。
- 当前 recording overlay 使用 shadcn Drawer/Vaul source、Textarea source、feature-local recording machine 和 browser MediaRecorder adapter。
- 当前 `AppShell` 项目区显示 main-backed workspace project list；无 active workspace session 时也显示已导入项目。`新建空白项目` 打开 `WorkspaceCreateDialog`，`打开本地工作区` 直接选择现有 Reo 工作区或空文件夹并打开；空文件夹会原地初始化为 Reo workspace；打开失败在当前内容区显示 alert，创建弹层保持关闭，当前 workspace 保留；点击已导入项目只发送 `workspaceId` 并打开该 workspace；已导入项目的 root folder 被删除时，该项目仍显示在 sidebar，点击后显示“工作区文件夹已不存在。”；点击当前 workspace 项目项返回该 workspace 的 Home surface；点击 sidebar `首页` 会关闭 active workspace handle 并回到 starter Home shell。
- 当前 `AppShell` 添加工作区菜单打开时，sidebar stacking level 临时提升到主内容 panel 之上，避免菜单被 panel 裁切或遮挡；菜单左边缘锚定到添加工作区 icon button 左边缘；添加工作区 icon button 只在项目标题行 hover、focus-within 或菜单 open 时显示；折叠/展开 sidebar 时会先关闭该菜单。
- 当前非阻断 toast 通过 `ReoToaster` 统一挂载在 App root；业务动作只调用共享 `toast` export，不在 feature 内自建 toast host 或临时通知 UI。
- 当前 `CreateWorkspaceForm` 使用 React Hook Form + Zod resolver、Button/Input/Textarea/Label/Field primitives，并作为可嵌入表单由 `WorkspaceCreateDialog` 承载。
- TanStack Query 和 React Hook Form 已安装，并已有真实 workspace creation consumer。
- Zustand 已选型，但当前未安装。
- 当前没有跨 subtree client state consumer。

## 技术方向

- 直接使用 React 19 模式。
- 使用 Tailwind CSS v4 作为 styling foundation。
- Reo tokens/theme 是视觉真源；shadcn/ui + Radix primitives + Tailwind CSS v4 是 UI 实现框架。
- Tailwind token 优先写在 `src/renderer/src/theme.css` 的 `@theme static` 中。
- 组件和页面设计必须先核对 Reo 设计系统真源。
- 组件和交互设计必须先评估 shadcn/ui、Radix、ElevenLabs UI、Vaul、wavesurfer.js 和其他成熟开源组件；符合 Reo 边界时优先复用或适配。
- 技术栈相关 UI 能力进入设计或实现前必须先查询 Context7 官方当前文档；采用、裁剪或拒绝第三方方案时在当前 spec 记录依据。
- 有真实 reusable component consumer 时，使用 shadcn/ui source、Radix primitives 和 Tailwind utilities 建立 reusable components。
- 当前 Button/Input/Label primitive 已 retokenize 到 Reo design system；Button/Input 默认使用 8px radius、compact UI typography、Reo focus-visible ring 和 disabled state。
- 当前 Field primitive 承载字段组、字段行、label、hint、control 和 error spacing；divider 只出现在 rows 之间，不压到文字或 control。
- 当前 Menu primitive 承载 compact action menu surface 和 item，使用 Card White、Chalk border、12px radius、11px UI text 和 32px item height。
- 当前 Dialog/Textarea source 已 retokenize 到 Reo design system；Dialog 使用 overlay surface、18px title、small description 和 token 化宽度，仍作为通用 overlay primitive 保留；Textarea 使用输入框 radius token、compact UI typography、72px minimum height 和 Reo focus/disabled states。
- 当前 Drawer source 基于 shadcn/ui Drawer + Vaul，retokenize 到 Reo bottom drawer surface；controlled `open/onOpenChange`、`dismissible={false}` 和 `data-vaul-no-drag` 用于录音忙碌态关闭保护与 waveform/control 交互区。
- 当前 Button source 的 filled primary 使用 Obsidian 和 8px radius；Signal Blue 只用于 Button `accentCircle` variant 的显式圆形 icon-only control；naked icon-only controls 使用 Button `ghostIcon` variant。
- 当前 Tooltip/Separator source 已 retokenize 到 Reo design system；Tooltip 使用 Reo small surface，Separator 使用 Chalk hairline，也用于 sidebar resize 的可访问 separator 语义。
- 当前 `ReoToaster` 使用 Sonner 官方 `Toaster`/`toast` API，retokenize 到 Reo design system；toast host 只在 root 挂载一次，业务组件不得重复挂载。
- 当前 Waveform/VoiceButton source 来自 ElevenLabs UI registry 的逐组件评估；Reo 只保留 canvas waveform bar renderer、recording/error/processing control visual 和 Button semantics，不在 renderer component 内申请 microphone stream、调用网络、创建 agent runtime 或显示 API key/model 文案。
- ElevenLabs Transcript Viewer 已评估但当前不引入为 shared primitive；它需要 alignment/STT 数据和 scrubber runtime，当前 slice 只有用户本地 draft，因此 transcript preview 保持在 `TranscriptReflectionsEditor` feature-local 边界内，并使用有界 live preview。
- 当前 App shell 支持浅色/深色主题切换；主题状态由 `App` 持有，并通过 App shell `data-theme="light|dark"` 与 document 根节点 `data-theme` 驱动 token 级联，确保 Radix portal 内容也继承当前主题。
- 当前深色主题由 `src/renderer/src/theme.css` 的 Reo token 覆盖实现：背景避免纯黑，面板使用抬升暖中性色，文字、弱文字、描边、阴影、scrim、Signal Blue、Ember 和 Voice Spectrum 都有暗色 token。
- 界面不使用 emoji 表达图标、状态、装饰或情绪。
- 有现成 lucide icon 时使用 lucide；没有合适图标时优先使用文字、状态点或 Reo token 图形，不临时改用 emoji。
- 表单使用 React Hook Form + Zod。
- 来自 main/server boundary 的 async data 使用 TanStack Query；workspace project list、workspace snapshot 和 memory detail 属于当前 Query consumer。
- 当前 QueryClient provider 服务 workspace project list、workspace snapshot cache 和 memory detail cache；active recording lifecycle、drawer close protection 和 recording controls 不进入 Query。
- Zustand 只用于需要跨 component subtree 保留的本地 client state。
- 没有跨 component subtree state owner 前，不创建 Zustand store。

## 组件规则

- Reusable components 必须小、明确、可读。
- 没有真实组件前，不创建 design-system layer。
- 不得把 card 放进另一个 card。
- 不得为 shadcn/ui 创建没有真实 invariant 的 generic wrapper。
- 项目 UI primitives 建立后，业务组件必须通过项目 primitives 使用。
- UI 文案必须在 mobile 和 desktop 上不溢出。
- 每个 feature slice 必须显式判断是否产生 reusable component、feature-local component、form component 或 layout primitive。
- 可复用组件必须有真实 consumer、明确 invariant 和测试/验证路径；不得为了“未来复用”抽象。

## 组件设计门禁

进入 UI 实现前必须定义：

- Open-source component evaluation：每个 page-level、overlay、audio/media、form、editor、list/grid、state feedback 和 accessibility primitive 都必须先列出候选开源组件或官方方案。
- 页面结构：workspace management、workspace home、recording overlay 的 page/component tree。
- Layout primitives：first-run shell、sidebar、main shell、header、content region、overlay shell、scroll region、grid/list 的排版责任。
- UI primitives：button、icon button、textarea、label、dialog、tooltip、card/panel 的来源、token 映射和 accessibility invariant。
- Feature components：create workspace form、folder picker row、workspace card、recording card、recording controls、waveform/progress visualization、transcript editor、reflections editor、autosave status 的数据输入和事件输出。
- Reuse decision：哪些组件复用，哪些保持 feature-local；复用必须来自真实 consumer 或共享 invariant。
- Reference mapping：参考图只约束结构、层级和 micro-interactions；视觉 token、spacing、radius、surface 和 icon 必须服从 Reo design system。
- Accessibility matrix：每个 page/state/component 必须定义 role、name、keyboard path、focus behavior、announcement behavior、reduced-motion fallback、hit target、contrast/focus token 和 test/manual evidence。
- Simplification review：避免过深组件树、重复 class 组合、重复状态派生和无意义 wrapper；只有能降低重复或表达不变量时才提取组件。

## 音频与 Agent UI 复用边界

- ElevenLabs UI 是 Reo audio/agent UI 的默认优先评估来源。
- ElevenLabs UI 组件是基于 shadcn/ui 的 open-code registry；只能逐组件引入，不得一次性安装全部组件。
- 需要优先评估的 ElevenLabs UI 组件包括 Audio Player、Live Waveform、Waveform、Speech Input、Transcript Viewer、Voice Button。
- Bottom drawer / large overlay 必须优先评估 Vaul 或 shadcn drawer，而不是自写 modal mechanics。
- Audio recording、waveform recording/playback 和 scrubber 必须同时评估 wavesurfer.js、ElevenLabs UI 和其他成熟开源方案。
- 采纳的组件 source 必须 retokenize 到 Reo design system，并删去不符合 Reo 边界的 demo、agent runtime、network/token、未实现能力和 decorative behavior。
- 若开源组件不完全适配，必须先评估裁剪、retokenize、组合、薄适配或 fork。拒绝开源组件并自研前，必须记录这些适配路径仍不满足的边界：Electron 安全、local-first 文件真源、无网络依赖、设计系统、可访问性、测试可控性、bundle/依赖成本或代码复杂度。

## 第一产品切片 UI 决策

当前实现事实：

- Workspace starter Home 使用 App shell 承载无 workspace 状态；Home 主内容区不显示独立 `+` 创建按钮，创建工作区入口在 sidebar 项目区的添加菜单中。
- Workspace create Dialog 使用 feature-local `WorkspaceCreateDialog` 和可嵌入 `CreateWorkspaceForm`，只覆盖“新建空白项目”创建表单；旧“添加工作区”选择弹层和 `OpenWorkspaceAction` 不属于当前 build。
- App 拥有 workspace entry action lock；创建弹层 submit、打开本地工作区选择和打开期间不得重复触发同一工作区 action，创建弹层关闭在 pending 时被阻止，branch 结束必须释放 action lock。
- App 使用 `['workspace', 'projects']` Query 读取 sidebar 项目列表；创建、打开本地工作区或点击已导入项目成功后 invalidate 该 Query。项目列表读取失败在当前内容区显示 alert，不把 sidebar 静默清空当作成功状态。
- 创建工作区表单当前使用 Button/Input/Textarea/Label/Field primitives、React Hook Form、Zod 和 submit-time validation；表单字段顺序是工作区名称、描述、工作区位置；submit button 默认可点击，空 title 或未选 folder 时提交后显示字段错误并把焦点回到 title。
- Folder picker 只显示 main process 返回的安全 `displayPath` basename，并把 `selectionToken/displayPath` 写入当前 RHF form lifecycle；create submit 只发送 `selectionToken/title/description`，main 把所选 folder 作为 parent location 并在其下创建 title 同名 workspace folder。Create title 必须是安全 folder name，不能是 `.`、`..` 或包含路径分隔符。`打开本地工作区` 是 sidebar 菜单动作，选择文件夹后直接调用 `openWorkspace(selectionToken)`，不发送 title、description、displayPath 或 raw path；现有 Reo workspace 会打开，空文件夹会原地初始化。点击已导入项目只调用 `openWorkspaceProject(workspaceId)`，不发送 selection token、displayPath 或 raw path。Create/open-local/open-project 成功切换 workspace 前会释放旧 active handle，释放失败时不切换 UI 并显示错误。Open failure 或 promise reject 显示 `WorkspaceErrorBanner`，不复用创建表单错误位。Initialize 失败后清除已消费的 folder token 和 display name，要求用户重新选择 folder。
- 当前 App shell 已实现 48px 无边框 titlebar shell、底层可拖拽 sidebar 和上层悬浮内容 panel；titlebar 自身是 Electron drag region，窗口/sidebar 控件是 no-drag control region；sidebar 默认 240px、最小 240px、最大 520px，resize separator 有 8px 真实命中区和 hover affordance；panel 顶/右/底贴合窗口，内部先保留 48px panel titlebar slot，再渲染页面内容；展开态以 `left` 等于 sidebar 宽度并只保留左侧 12px radius，covered 态 `left` 归零且 radius 归零。折叠/展开时右边缘固定，只让左边界移动。
- 当前 App shell 的 hide/show sidebar icon-only control 位于左上原生窗口控制区右侧，不创建 rail sidebar；该 control 的 titlebar slot 保持稳定，折叠和展开切换只替换图标，不移动 slot。
- 当前 App shell 的浅色/深色主题切换是 sidebar 左下角工具按钮，使用 lucide Moon/Sun icon-only control 和 Tooltip accessible name；它不创建 settings 页面、系统主题跟随或持久化。
- 当前 App shell navigation 显示 `首页` 和 `资料库`；sidebar 不显示 `新记忆`。`首页`、`资料库` 和 workspace 项目项都是真实导航入口，触发导航前会关闭已打开的 sidebar 菜单；离开 loaded workspace 到 `首页` 或 `资料库` 前会释放当前 workspace handle。starter shell 中 `首页` 是当前页，`资料库` 打开空白 Library page；loaded workspace 中当前页由 active workspace 项目项表达，`首页` 不保持当前页高亮。Home search、future media/file route、auth、sync、share、AI 和 global search 不显示。
- Workspace 项目列表项容器内右侧有 icon-only 更多操作按钮；项目行容器承载 hover/current surface，workspace primary button 和 more button 都位于同一个项目行容器内。More button 默认隐藏，只在对应项目行 hover、keyboard focus-within 或菜单已打开时显示。当前只提供 `移除工作区`。确认弹层说明只从 Reo 工作区列表移除，本地文件夹不会被删除。移除反馈只使用 root `ReoToaster`，确认弹层内不渲染第二套错误提示。移除 inactive 项目只刷新项目列表；移除 active 项目先移除 registry entry，再回到 starter shell，并尽力释放当前 workspace handle；handle 释放失败时不阻断列表移除，只显示 toast。
- 当前 App shell 使用 lucide icon-only controls 和 icon+text nav；icon-only controls 的 accessible name 放在 button 上，菜单 surface、菜单项和项目操作组都必须有明确 accessible name。
- 当前 Workspace home 是 loaded workspace 的 Home surface：主标题是 `全部记忆`，workspace title 作为上方标签；`搜索记忆` 只过滤当前 snapshot 中已加载的 memory summary；内容按 `createdAt` 月份倒序分组，同月内 memory 倒序；memory card 只展示 title、创建日期、recording count、duration、`转写`/`反思` presence。
- 当前 Workspace home 的本地搜索使用 component state；它不创建 global search、full-text search、semantic search、tag/entity filter、Zustand store、TanStack Query key、IPC 或 DB surface。
- 当前 Workspace home 直接使用 `Input` primitive 承载 searchbox，使用 `Separator` primitive 承载 header/month 的装饰性分隔；memory card 使用 `article`、`time`、`dl` 表达条目、日期和元数据，并用覆盖按钮提供打开当前 memory detail 的 command。`MemorySection` 和 `MemoryCard` 是 feature-local components，只服务 loaded workspace Home，不是 design-system primitive。
- 当前 Memory detail 使用最小 in-memory route 从 Home 进入和返回，不引入 router dependency、page registry、generic route service 或额外 provider。
- 当前 Memory detail 通过 TanStack Query 读取 main-backed detail projection；`workspaceHandle` 只在 query function 闭包中作为 request capability 使用，不进入 DOM、URL、query key 或持久化状态。
- 当前 Memory detail 的 `继续记录` 打开现有 recording overlay，并把当前 `memoryId` 作为 existing memory recording target 传入 finalize request。
- 当前 Memory detail 不渲染 More、Rename、Delete、Show in folder、Export、Films、photo、video、file、AI、entity、contact 或 global search command。
- 当前 Memory detail 使用 `MemoryDetailPage` 和 file-local `MemoryDetailSection`；它们是 feature-local components，不是 design-system primitive。
- 当前 `记录记忆`/`继续记录` 打开 shadcn Drawer/Vaul recording surface；`RecordingOverlay` 仍持有当前 durable recording transaction，并复用 feature-local `RecordAudioDrawer` shell、`RecordingWaveform`、`RecordingControls`、`RecordingPlayback` 和 `TranscriptReflectionsEditor`。Drawer 使用固定 header/footer 和中间滚动区，保证编辑态长内容不挤出关闭 command；非忙碌关闭后再次打开回到 ready recording state。
- Recording 使用官方 browser MediaRecorder API 的薄 adapter 负责 durable capture，不引入 agent runtime、网络 STT 或本地 mock transcript。
- 当前 recording overlay 停止录音后展示空白 transcript/reflections draft、`转写预览` 和 `加载录音` 本地加载 command；加载成功后隐藏加载 command 并展示本地 playback surface。内容只来自用户编辑或未来明确引入的真实转写 foundation。
- 当前 audio playback 使用 main finalized-only chunked audio read + renderer Blob URL；renderer 最多并发读取 4 个 chunk，Blob 直接从 chunk array 创建，不二次复制 chunk；Blob URL 只在 active playback 创建，并在 close/switch/unmount 时 revoke，close 后完成的过期 playback request 不得创建新的 Blob URL，也不得继续调度后续 chunk IPC；单个 chunk read 失败后不得继续调度后续 chunk IPC。

First product slice 交付约束：

- First product slice 在当前 app shell 上承载 Home local search、memory cards 和 recording drawer，不另建 page shell。
- Sidebar 使用分层 overlay shell：sidebar 是底层 `z-index: 1`，紧贴窗口左边缘并铺满高度；主内容是上层悬浮面板 `z-index: 2`，顶/右/底与窗口边缘重叠，展开态只在左侧边界显示 12px radius，并在内部保留 48px panel titlebar slot；titlebar 是 48px 无边框透明 shell slot，`z-index: 5`；sidebar action menu 打开时 sidebar 临时提升到 `z-index: 4`，窗口控制保持在更高层；sidebar action menu 必须以 trigger 左边缘为锚点，不从 sidebar 外侧重新起算。
- Sidebar 宽度可拖拽，最小 240px，最大 520px；covered 状态是主内容面板的 `left` 归零并覆盖 sidebar。
- Sidebar 展开/covered 动效使用 280ms ease-out，只过渡 panel 的 `left` 与 border radius；reduced motion 下关闭 transition；拖拽 resize 时关闭 motion，只直接更新 left。
- macOS 红黄绿窗口按钮保持原生控件；Reo 只绘制无边框 AppShell titlebar layout slot 和 sidebar hide/show control，不伪造红黄绿窗口按钮。
- Sidebar 中的 Search 只能作为聚焦 Home 本地搜索的入口；若 Home 本地搜索尚未实现，Search control 不得出现在 current build。
- Home 本地搜索只过滤当前 workspace snapshot 中已加载的 recording/memory title、日期和状态；full-text、跨 workspace、entity、tag、semantic search 属于后续 DB/index foundation。
- Workspace home 完成形态使用 `全部记忆` header、本地搜索/filter、日期分组、recording card、empty/error/loading states 和 `记录记忆` action；`记录记忆` 打开 recording drawer。
- 未实现的 photo、video、file、film、sharing、sync、auth user、camera、AI generation、global search 能力不得显示为 disabled control、placeholder section 或 future action。
- Recording 的最终产品形态使用 shadcn Drawer/Vaul bottom drawer。
- 当前 recording overlay 不生成 transcript 文本；停止后只进入可编辑 transcript/reflections draft。
- ElevenLabs UI 逐组件 source-owned 采纳，优先范围是 Waveform、Live Waveform、Voice Button、Audio Player、Transcript Viewer；不得执行 `add all`。
- Waveform 不能用与官方/成熟源码无关的自研 lightweight bars 作为最终形态；当前采用 ElevenLabs UI waveform registry 的 canvas/bar rendering pattern 并裁剪到 Reo local-first 边界。引入 long waveform、live microphone waveform、peaks、regions 或 playback scrubber 时，必须重新评估 ElevenLabs UI、wavesurfer.js 或成熟开源实现。
- wavesurfer.js 不负责 current durable capture；若实现 long waveform、peaks、regions、visual scrubber 或第二个 waveform consumer，必须重新作为优先候选并记录采用、fork 或拒绝证据。
- shadcn/ui source 变更必须与 exact primitives、business consumers、shared invariants、tests 和同 slice commit 同批完成。

## shadcn/ui 边界

- 当前 shadcn/ui source 范围包含 Button、Input、Label、Dialog、Drawer、Textarea、Tooltip、Separator、Field 和 Menu。
- 当前存在 `components.json`、renderer import alias、`components/ui/button.tsx`、`components/ui/input.tsx`、`components/ui/label.tsx`、`components/ui/dialog.tsx`、`components/ui/drawer.tsx`、`components/ui/textarea.tsx`、`components/ui/tooltip.tsx`、`components/ui/separator.tsx`、`components/ui/field.tsx`、`components/ui/menu.tsx` 和 `lib/utils.ts`。
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
- Reo 设计系统覆盖不到的新 UI 状态、尺寸、层级、motion 或交互形态，必须先补充为可复用 token、primitive variant 或 usage rule，再落到业务组件。
- 设计系统补充必须同时满足行业通用 UI 规范、Practical UI 指南、可访问性要求和本次参考图结构；不得为了单个页面写一次性视觉例外。
- 不得为单个 screen 创建一次性 palette。
- 深色模式必须通过 Reo token 覆盖实现；不得在业务组件里散落页面级暗色 class，也不得用简单反色替代信息层级。
- 深色主题的 base、raised surface、overlay surface、scrim、text strong、text weak、stroke、focus、shadow 和 accent token 必须能覆盖 Radix portal 与当前业务 surface。
- 避免不服务产品 workflow 的装饰性 UI。

## 设计系统规则

- 页面底色使用 Eggshell，主要文字使用 Obsidian，边界使用 Chalk，辅助文字使用 Gravel 或 Slate。
- 浅色主题是默认主题；深色主题使用同名 token 的暗色值，而不是新增第二套业务 class 名称。
- Signal Blue 和 Ember 只用于小型圆点、avatar、状态指示、焦点环或显式小型圆形 accent control，不用于正文、页面背景或 pill button 填充。
- 32px 及以上标题使用 Waldenburg 300、负 tracking 和紧凑 line-height。
- 正文和通用 UI 文案使用 Inter；产品族标签使用 WaldenburgFH 700。
- 大多数按钮和输入控件使用 8px 方圆 radius；只有 tags 和显式圆形 icon control 使用 fully rounded 形状。
- Card 使用 16-20px radius，并保持轻量边界或 hairline shadow；App 主内容悬浮面板展开态只在左侧使用 12px radius，covered 态归零以贴满窗口。
- Geist Mono 只用于代码、技术注记和机器生成标记。
- 所有产品界面必须保持标准软件工程产品气质：清晰、克制、可维护、可验证，不做玩具化视觉或交互。

## 变更门禁

任何 React structure、reusable components、Tailwind/shadcn setup、forms、UI state、UI data fetching 的项目级模式变化，都必须更新本文档。

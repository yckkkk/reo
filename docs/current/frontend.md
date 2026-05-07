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
- shadcn/ui 已按 source-owned 模式初始化配置：`components.json`、renderer `@/*` alias、`components/ui/button.tsx`、`components/ui/input.tsx`、`components/ui/label.tsx`、`components/ui/dialog.tsx`、`components/ui/textarea.tsx`、`components/ui/tooltip.tsx`、`components/ui/separator.tsx` 和 `lib/utils.ts`。
- 当前 Radix primitives 安装并使用 `@radix-ui/react-slot`、`@radix-ui/react-label`、`@radix-ui/react-dialog`、`@radix-ui/react-tooltip` 和 `@radix-ui/react-separator`。
- 当前真实 reusable component consumer 是 app shell、workspace starter home、workspace entry dialog/form、workspace home 和 recording overlay。
- 当前 renderer 入口由 QueryClient provider 包裹。
- 当前 renderer route state 覆盖无 workspace 的 starter Home shell 和已初始化或已打开 workspace 的 loaded shell。
- 当前无 workspace state 使用 `AppShell` + `WorkspaceStarterHome`；Home `+` 打开 `WorkspaceEntryDialog`。
- 当前 loaded workspace state 使用 `AppShell` 包裹 workspace home。
- 当前 workspace home 展示 workspace title、一个 record action、`Memory Content`、recording empty/list region。
- 当前 recording overlay 使用 Radix Dialog/shadcn Dialog source、Textarea source、feature-local recording machine 和 browser MediaRecorder adapter。
- 当前有 `WorkspaceEntryDialog`，组合 `CreateWorkspaceForm` 与 `OpenWorkspaceAction`；创建表单使用 React Hook Form + Zod resolver，打开现有 workspace 走独立 open branch。
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
- 有真实 reusable component consumer 时，使用 shadcn/ui source、Radix primitives 和 Tailwind utilities 建立 reusable components。
- 当前 Button/Label primitive 已 retokenize 到 Reo design system；Button 使用 pill shape、Reo focus-visible ring、disabled state，Label 使用 Reo body typography。
- 当前 Dialog/Textarea source 已 retokenize 到 Reo design system；Dialog 使用 bottom-sheet/mobile 和 centered desktop layout，`WorkspaceEntryDialog` 组合 `DialogClose` 与 lucide close control；Textarea 使用 0 radius input shape。
- 当前 Button source 的 filled pill primary 使用 Obsidian；Signal Blue 只用于 Button `accentCircle` variant 的小型圆形 control，例如 Home `+`；naked icon-only controls 使用 Button `ghostIcon` variant。
- 当前 Tooltip/Separator source 已 retokenize 到 Reo design system；Tooltip 使用 Reo small surface，Separator 使用 Chalk hairline，也用于 sidebar resize 的可访问 separator 语义。
- 界面不使用 emoji 表达图标、状态、装饰或情绪。
- 有现成 lucide icon 时使用 lucide；没有合适图标时优先使用文字、状态点或 Reo token 图形，不临时改用 emoji。
- 表单使用 React Hook Form + Zod。
- 来自 main/server boundary 的 async data 使用 TanStack Query。
- 当前 QueryClient provider 只服务 workspace snapshot cache；active recording lifecycle 不进入 Query。
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

- Workspace starter Home 使用 App shell 承载无 workspace 状态；Create workspace 入口是 Home 主内容区的 `+` icon-only control，不存在独立 Create workspace page。
- Workspace entry Dialog 使用 feature-local `CreateWorkspaceForm` 和 `OpenWorkspaceAction`，覆盖 create/open 两条入口；open existing workspace 不清空 create draft，也不显示 create conflict。
- Workspace entry Dialog 是 create/open 两条入口的 pending owner；任一 async branch 进行中时 sibling action 和 close control 必须 disabled，branch 结束必须释放 action lock。
- Create workspace form 当前使用 Button/Input/Label/Textarea primitives、React Hook Form、Zod 和 submit-time validation；submit button 默认可点击，空 title 或未选 folder 时提交后显示字段错误并把焦点回到 title。
- Folder picker 只显示 main process 返回的安全 `displayPath` basename，并把 `selectionToken/displayPath` 写入当前 RHF form lifecycle；create submit 只发送 `selectionToken/title/description`，open submit 只发送 `selectionToken`。Create initialize 失败后保留 title/description，但清除已消费的 folder token 和 display name，要求用户重新选择 folder。
- 当前 App shell 已实现底层可拖拽 sidebar 和上层悬浮内容 panel；sidebar 默认 240px、最小 240px、最大 520px，resize separator 有 8px 真实命中区和 hover affordance；panel 顶/右/底贴合窗口，展开态用 transform 移出 sidebar 宽度并只保留左侧 12px radius，covered 态用 transform 覆盖 sidebar、左缘归零、宽度 100% 且 radius 归零。
- 当前 App shell 的 hide/show sidebar icon-only control 位于左上窗口控制区旁边，不创建 rail sidebar。
- 当前 App shell navigation 在 starter shell 只显示 Home；loaded shell 显示 Home 和 New memory；Home search、future media/file route、auth、sync、share、AI 和 global search 不显示。
- 当前 App shell 使用 lucide icon-only controls 和 icon+text nav；icon-only controls 的 accessible name 放在 button 上。
- 当前 Workspace home 仍是基础 home：显示 workspace title、单一 `Record memory` action 和 `Memory Content`；它还没有本地 search/filter、日期分组或 memory card。
- 当前 `Record memory` 打开 Radix Dialog recording overlay；它是迁移基础，不是 first product slice 的最终 recording drawer。
- Recording 使用官方 browser MediaRecorder API 的薄 adapter 负责 durable capture，不引入 agent runtime 或网络 STT。
- 当前 recording overlay 代码仍包含本地 placeholder transcript 机制；产品级 first slice 完成形态不得显示 mock transcript，也不得暗示真实 speech-to-text。
- 当前 audio playback 使用 main finalized-only chunked audio read + renderer Blob URL；renderer 最多并发读取 4 个 chunk，Blob 直接从 chunk array 创建，不二次复制 chunk；Blob URL 只在 active playback 创建，并在 close/switch/unmount 时 revoke，close 后完成的过期 playback request 不得创建新的 Blob URL，也不得继续调度后续 chunk IPC。

已接受但尚未全部实现的 first-slice 交付约束：

- First product slice 的完成形态必须继续在当前 app shell 上完成 Home local search、memory cards 和 recording drawer，而不是另建 page shell。
- Sidebar 使用分层 overlay shell：sidebar 是底层 `z-index: 1`，紧贴窗口左边缘并铺满高度；主内容是上层悬浮面板 `z-index: 2`，顶/右/底与窗口边缘重叠，展开态只在左侧边界显示 12px radius，不设置独立 top bar。
- Sidebar 宽度可拖拽，最小 240px，最大 520px；covered 状态是主内容面板用 transform 向左滑动并覆盖在 sidebar 上方。
- Sidebar 展开/covered 动效使用 280ms ease-out，同步过渡 panel 的 transform 和 width；reduced motion 下关闭 transition；拖拽 resize 时关闭 motion，只直接更新 width。
- macOS 红黄绿窗口按钮悬浮在 sidebar 图层左上角之上；Reo 不绘制假的标题栏或顶部栏。
- Sidebar 中的 Search 只能作为聚焦 Home 本地搜索的入口；若 Home 本地搜索尚未实现，Search control 不得出现在 current build。
- Home 本地搜索只过滤当前 workspace snapshot 中已加载的 recording/memory title、日期和状态；full-text、跨 workspace、entity、tag、semantic search 属于后续 DB/index foundation。
- Workspace home 完成形态使用 `All memories` header、本地搜索/filter、日期分组、recording card、empty/error/loading states 和 `Record memory` action；`Record memory` 打开 recording drawer。
- 未实现的 photo、video、file、film、sharing、sync、auth user、camera、AI generation、global search 能力不得显示为 disabled control、placeholder section 或 future action。
- Recording 的最终产品形态使用 shadcn Drawer/Vaul bottom drawer。
- 产品级 first slice 必须把 placeholder transcript 替换为停止后可编辑 transcript/reflections draft，或在新增 STT foundation 后接入真实转写。
- ElevenLabs UI 逐组件 source-owned 采纳，优先范围是 Waveform、Live Waveform、Voice Button、Audio Player、Transcript Viewer；不得执行 `add all`。
- Waveform 不能用自研 lightweight bars 作为最终形态；必须优先 retokenize ElevenLabs UI waveform source，只有 Electron 安全、local-first、可访问性、测试或复杂度被证据阻断时才允许 fork 或替代。
- wavesurfer.js 不负责 current durable capture；若实现 long waveform、peaks、regions、visual scrubber 或第二个 waveform consumer，必须重新作为优先候选并记录采用、fork 或拒绝证据。
- shadcn/ui source 变更必须与 exact primitives、business consumers、shared invariants、tests 和同 slice commit 同批完成。

## shadcn/ui 边界

- 当前 shadcn/ui source 范围包含 Button、Input、Label、Dialog、Textarea、Tooltip 和 Separator。
- 当前存在 `components.json`、renderer import alias、`components/ui/button.tsx`、`components/ui/input.tsx`、`components/ui/label.tsx`、`components/ui/dialog.tsx`、`components/ui/textarea.tsx`、`components/ui/tooltip.tsx`、`components/ui/separator.tsx` 和 `lib/utils.ts`。
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
- 避免不服务产品 workflow 的装饰性 UI。

## 设计系统规则

- 页面底色使用 Eggshell，主要文字使用 Obsidian，边界使用 Chalk，辅助文字使用 Gravel 或 Slate。
- Signal Blue 和 Ember 只用于小型圆点、avatar、状态指示或小型圆形 accent control，不用于正文、页面背景或 pill button 填充。
- 32px 及以上标题使用 Waldenburg 300、负 tracking 和紧凑 line-height。
- 正文和通用 UI 文案使用 Inter；产品族标签使用 WaldenburgFH 700。
- 按钮和 pill tag 使用 fully rounded 形状；输入控件保持 0 radius。
- Card 使用 16-20px radius，并保持轻量边界或 hairline shadow；App 主内容悬浮面板展开态只在左侧使用 12px radius，covered 态归零以贴满窗口。
- Geist Mono 只用于代码、技术注记和机器生成标记。
- 所有产品界面必须保持标准软件工程产品气质：清晰、克制、可维护、可验证，不做玩具化视觉或交互。

## 变更门禁

任何 React structure、reusable components、Tailwind/shadcn setup、forms、UI state、UI data fetching 的项目级模式变化，都必须更新本文档。

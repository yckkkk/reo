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
- shadcn/ui 已按 source-owned 模式初始化最小配置：`components.json`、renderer `@/*` alias、`components/ui/button.tsx`、`components/ui/label.tsx` 和 `lib/utils.ts`。
- 当前 Radix primitives 只安装并使用 `@radix-ui/react-slot` 和 `@radix-ui/react-label`。
- 当前真实 reusable component consumer 是 workspace creation form 和 workspace home。
- 当前 renderer 入口由 QueryClient provider 包裹。
- 当前 renderer route state 覆盖无 workspace 的创建页和已初始化 workspace 的最小 loaded state。
- 当前 workspace home 展示 workspace title、一个 record action、`Memory Content`、recording empty/list region。
- 当前有 `CreateWorkspaceForm` 业务表单，使用 React Hook Form + Zod resolver。
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

- First product slice 不显示完整 sidebar；workspace home 使用 top header、record action 和 `Memory Content`。
- Workspace creation page 使用 feature-local `CreateWorkspaceForm`，包含 title、description、folder picker 和 submit；folder picker cancel 和 initialization failure 不清空用户输入。
- Create workspace form 当前使用 Button/Label primitives 和语义 input/textarea。
- Workspace home 使用居中 header、单一 `Record memory` action 和 `Memory Content` 内容区；recording overlay 尚未创建。
- 未实现的 photo、video、file、film、search、tag、sharing、sync 能力不得显示为 disabled control、placeholder section 或 future action。
- Recording overlay 使用 Radix Dialog 语义组合 bottom sheet layout；Vaul/shadcn Drawer 已评估，first product slice 不引入 Vaul dependency。
- ElevenLabs UI 只按组件摘取结构和状态表达，不执行 `add all`。
- Live Waveform/Waveform 只提供 visual model；first product slice 使用 Reo-owned MediaRecorder adapter 和 lightweight state bars，不复制 ElevenLabs microphone owner。
- wavesurfer.js 保持 deferred；只有出现 scrubber、peaks、regions、long waveform performance 或第二个 waveform consumer 时重新评估。
- Recording 中的 transcript 必须标记为本地草稿提示，不得暗示真实 speech-to-text 已完成。
- Audio playback 使用 Reo controls 和 chunked audio read；Blob URL 只在 active playback 创建，并在 close/switch/unmount 时 revoke。
- shadcn/ui 初始化必须与 exact primitives、business consumers、renderer alias、`components.json`、tests 和同 slice commit 同批完成。

## shadcn/ui 边界

- 当前 shadcn/ui 初始化范围只包含 Button 和 Label。
- 当前存在 `components.json`、renderer import alias、`components/ui/button.tsx`、`components/ui/label.tsx` 和 `lib/utils.ts`。
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
- 不得为单个 screen 创建一次性 palette。
- 避免不服务产品 workflow 的装饰性 UI。

## 设计系统规则

- 页面底色使用 Eggshell，主要文字使用 Obsidian，边界使用 Chalk，辅助文字使用 Gravel 或 Slate。
- Signal Blue 和 Ember 只用于小型圆点、avatar 或状态指示，不用于正文、背景填充或按钮。
- 32px 及以上标题使用 Waldenburg 300、负 tracking 和紧凑 line-height。
- 正文和通用 UI 文案使用 Inter；产品族标签使用 WaldenburgFH 700。
- 按钮和 pill tag 使用 fully rounded 形状；输入控件保持 0 radius。
- Card 和 panel 使用 16-20px radius，并保持轻量边界或 hairline shadow。
- Geist Mono 只用于代码、技术注记和机器生成标记。
- 所有产品界面必须保持标准软件工程产品气质：清晰、克制、可维护、可验证，不做玩具化视觉或交互。

## 变更门禁

任何 React structure、reusable components、Tailwind/shadcn setup、forms、UI state、UI data fetching 的项目级模式变化，都必须更新本文档。

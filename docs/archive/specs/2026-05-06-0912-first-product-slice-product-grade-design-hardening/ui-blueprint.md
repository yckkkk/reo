# UI Blueprint

本文件定义本次设计范围内 high-fidelity 规格，以及不属于当前实现范围但必须参考设计图产出的 wireframe。

## 设计系统基础

- 基底：Eggshell 页面，Card White 面板，Chalk 边界，Obsidian 主文字，Gravel/Slate 辅助文字。
- 字体：32px 以上标题用 Waldenburg 300；正文、标签、按钮用 Inter；产品紧凑标签可用 WaldenburgFH。
- 按钮：单一 primary 使用 Obsidian filled pill；secondary 使用 Card White/Chalk ghost pill；tertiary 使用文字或 icon-only control。
- 图标：全部使用 lucide；icon-only 必须有 tooltip 和 accessible name。
- 形状：按钮 pill；输入 0 radius；card 16px；App 主内容悬浮面板 12px；bottom drawer 20-24px。
- 动效：只表达 open/close、state transition 和 waveform；reduced motion 下不依赖动画传递状态。
- Reo design system 是视觉真源；本 spec 不允许业务组件临时硬编码 design-system 缺口。
- 当 Reo design system 尚未覆盖某个必要状态、尺寸、层级、motion 或交互形态时，先补充可复用 token、primitive variant 或 usage rule，再实现页面。
- 补充规则必须同时符合行业通用设计系统实践、Practical UI 的 spacing/hierarchy/accessibility 原则、参考图结构和 Reo 软件工程产品气质。

## 当前设计范围：High-Fidelity

### 1. App Shell 和 Sidebar

目标：把 first slice 放进真实软件 shell，而不是孤立页面。

Desktop layout：

- 使用分层侧边栏布局，不使用传统推挤式 sidebar。
- Sidebar 是底层，`z-index: 1`，紧贴窗口左边缘并铺满整个高度。
- Sidebar 宽度可拖拽调整，最小 240px，最大 520px；首次默认 240px。旧的 72px rail 规格被 supersede。
- 主内容区是独立上层悬浮面板，`z-index: 2`，四周固定 8px inset，四角统一 12px radius。
- 主内容面板从窗口顶部延伸到底部，不设置独立 top bar。
- macOS 红黄绿窗口按钮直接悬浮在 sidebar 图层左上角之上；Reo 不额外绘制假的 titlebar。
- Sidebar 展开时，主内容面板用 `transform: translateX(var(--sidebar-width))` 露出 sidebar；折叠时主内容面板用 280ms ease-out 向左滑动并覆盖在 sidebar 上方，而不是把 sidebar 推出视野。
- 折叠/展开动效只允许使用 transform/opacity；拖拽 resize 更新 CSS custom property，不给 width 加 transition。
- Sidebar 与主内容之间用 depth、Chalk hairline 和 Powder active row 区分层级，不使用重阴影。

Covered 状态：

- 主内容面板覆盖在 sidebar 上方，仅左上角 macOS window controls 和必要的 sidebar reveal affordance 可见。
- 该状态不是 72px rail；不渲染第二套窄 sidebar。
- 若需要 reveal control，使用 lucide icon-only button，必须有 accessible name 和 tooltip。

Expanded 状态：

- 顶部 Reo wordmark。
- Nav item：Home、New memory、Search。Search 只作用于当前 Home 本地搜索。
- Section group wireframe：Pinned memories、Collections、People。当前没有真实数据时只作为不可点击 wireframe，不进入 build。
- 底部 workspace identity：workspace title、local label、settings/more entry。Auth user 不显示，直到 Better Auth slice。

Sidebar 状态：

- `covered`
- `expanded`
- `resizing`
- `keyboard-focus`
- `reduced-motion`

Resize rules：

- Resize handle 位于 sidebar 右边缘，点击目标宽度至少 12px，视觉线可为 1px。
- 拖拽时只改变 `--sidebar-width`，并 clamp 到 240-520px。
- 拖拽结束后保留 session 内宽度；跨 session 持久化需要 Zustand/local preference gate，若未实现不得承诺。
- `Home`、`New memory` 和 `Search` nav 在 expanded sidebar 中可见；covered 状态不改变当前 route。

### 2. 创建工作区页面

目标：创建工作区是产品入口，不是配置表单。

Layout：

- 使用 app first-run shell：左侧 240px 最小 sidebar 底层，右侧为 8px inset/12px radius 的悬浮主内容面板。
- Main content 不是 hero marketing，也不是卡片堆叠；使用 type-first form region。
- 左上标题：`Create a local memory workspace`。
- 支持两个明确路径：`Create workspace` 和 `Open workspace`。当前代码已有 initialize/open IPC，因此设计必须覆盖两者。
- Form 单列：workspace title、description optional、folder picker、submit。

High-fidelity states：

- Empty：title focus，folder 未选择，submit enabled but validates on submit；不要让用户困在 disabled button。
- Folder selecting：folder row busy，保持 form draft。
- Folder canceled：回到 folder button，显示 `No folder selected`。
- Folder selected：显示 basename + `Change folder`。
- Submit missing title/folder：错误在字段上方或 row 上方，focus 到第一个错误。
- Existing `AGENTS.md` conflict：显示可行动错误：选择空文件夹或 open existing workspace。
- Permission denied/write failure：显示保留数据说明和 retry。
- Creating：primary button busy，folder/action 不重复提交。
- Success：进入 Home，seed workspace snapshot。
- Open existing：选择 folder 后 open，metadata corrupt/unsupported schema/locked 有独立错误。

组件：

- `WorkspaceEntryPage`
- `CreateWorkspaceForm`
- `OpenWorkspaceAction`
- `FolderPickerField`
- `WorkspacePathNotice`
- `WorkspaceErrorBanner`

### 3. Home / All Memories

目标：参考 Home 图，但只显示当前真实能力。

High-fidelity layout：

- Header centered：`All memories`，说明改为 `Voice notes and written reflections saved in this workspace.`。
- Control row：local search input、filter icon button、create/new memory button。
- Search input 当前只过滤 loaded workspace snapshot 中的 memory/recording title、created month、recording status 和 transcript/reflections presence。它不是 full-text、跨 workspace、entity、semantic 或 tag search。
- Filter 当前只使用 loaded snapshot 的 month/status/presence filter，不依赖 DB/index。若实现计划不包含这些本地 filter 行为，则 filter control 不得出现在 current build。
- Content sections 按 month/date 分组：`May 2026`、`April 2026`。
- Card 可表示 recording memory：title、created date、duration、audio byte length humanized、transcript/reflections status。
- Empty state：显示 `No memories yet`、单一 primary `Record memory`，并说明本地保存到 workspace。

High-fidelity states：

- Loading workspace snapshot
- Empty
- Populated with recordings
- Search focused
- Filter open
- Section collapsed/expanded
- Recording card hover/focus
- Workspace locked/missing read error

### 4. Workspace / Memory Detail

目标：建立工作区详情/单条 memory 详情结构，避免只有首页列表。

Current high-fidelity scope：

- Title：memory title，例如 `My seventh birthday` 或 recording-derived title。
- Date：使用 `date-fns` 格式化，例如 `APRIL 12, 2026`。
- Action strip：icon-only controls，当前可用只包括 `Record audio`、`Edit transcript/reflections`。
- `More` 仅为 future wireframe。若后续要渲染 `More`，必须先定义只读或 mutation 菜单项、IPC channel、filesystem transaction、security boundary、error recovery 和 tests。
- More wireframe items：`Rename memory`、`Delete memory`、`Show in folder`、`Export memory`。当前不实现、不渲染为可点击菜单。
- 未实现的 camera/photo、film、AI generate 不出现在当前 build；仅在 wireframe 中出现。
- Sections：`Voice recordings`、`Transcript`、`Reflections`、`Memory content`。
- Cards：recording card with waveform preview, duration, play action, save status。

High-fidelity states：

- No recording in memory
- Recording exists, transcript empty
- Transcript draft unsaved
- Reflections saved
- Audio playback loading/playing/paused/error
- Save failure with previous file preserved
- Detail read error
- More menu wireframe visible only in design/reference review, not current build

### 5. Record Audio Drawer

目标：匹配参考图的交互重量和完整录音生命周期。

Container：

- 使用 shadcn Drawer source built on Vaul 作为 primary bottom drawer；Radix Dialog 作为 accessibility/fallback 语义参考。
- Desktop 也采用 bottom drawer 视觉，以保持参考一致；宽屏最大内容宽 1040-1200px。
- Overlay 背景 dim + blur；blur 只在 drawer open 时存在。
- Drawer top handle，labelled title `Record audio`。

组件来源：

- `RecordAudioDrawerShell`：shadcn Drawer/Vaul retokenized。
- `RecordingWaveform`：ElevenLabs UI Waveform/LiveMicrophoneWaveform source retokenized。
- `RecordControlButton`：ElevenLabs Voice Button 概念 + Reo Button/IconButton token。
- `AudioPlayerInline`：ElevenLabs Audio Player/Scrub Bar source retokenized。
- Durable recording still uses Reo MediaRecorder adapter + main IPC append contract。

States：

- `idle`：baseline waveform，large record control，secondary `Cancel`。
- `acquiring`：record control busy，copy `Waiting for microphone permission`，cancel allowed before stream starts。
- `permission-denied`：actionable error，buttons `Try again`、`Close`、`Open system settings` wireframe only unless Electron shell support is designed。
- `recording`：live waveform, elapsed timer, state label `Recording`, controls stop/pause, no close via backdrop。
- `paused`：waveform paused visual, timer frozen, controls stop/resume。
- `stopping`：controls disabled except status, copy `Saving audio locally`。
- `append-failed`：error with `Discard draft` and `Record again`，state states data retention。
- `finalize-failed`：draft preserved, options retry finalize/discard。
- `editing`：transition to transcript/reflections editor。

当前不允许：

- 不显示 mock transcript as if STT。
- 不直接请求 camera/video。
- 不在 renderer 暴露 root path 或 raw file path。

### 6. Transcript / Reflections Editor Drawer

目标：录音停止后进入可编辑内容，不把 textarea 当最终设计。

Layout：

- 同 bottom drawer shell。
- 顶部：memory/recording title、duration、play control。
- Main：two-column desktop / stacked mobile。
- Left：Transcript editor。
- Right：Additional reflections editor。
- Autosave status：`Saved locally`、`Saving`、`Could not save`。

Editor source：

- 当前 slice 可以用 shadcn Textarea high-fidelity 承载纯 markdown draft。
- 如果需要 rich inline suggestion，需要先评估 TipTap/Lexical/Plate；当前实现不自研 contenteditable。

States：

- Transcript empty
- Transcript editing
- Transcript autosaving
- Transcript save failed
- Reflections empty
- Reflections editing
- Entity suggestion wireframe visible
- Playback loading/playing/paused/error

Entity suggestion：

- 当前 high-fidelity 只定义 overlay/popover and data contract。
- 实现必须 gated，除非已有 entity extraction owner、schema、tests。

## 非当前实现范围：Delivery Wireframe

以下功能必须参考图做 wireframe，但不得在 current build 显示为可用功能。

### Films / AI Summary

Wireframe：

- Workspace detail section `Films`。
- Card states：queued、processing/cooking、playable、failed。
- Processing progress bar、estimated time、duration chip。

当前不实现：

- 视频生成、film queue、thumbnail、camera/photo import。

触发条件：

- 有 background job owner、media artifact schema、processing service、file transaction、cancel/retry、privacy/logging 设计。

### Photo / Video / File Import

Wireframe：

- Action strip 中 camera/add icons 显示在 future wireframe。
- Content cards 表示 file/media artifact state。

当前不实现：

- 不显示 clickable camera/photo/video/file controls。
- 不创建目录占位或 DB columns。

触发条件：

- 文件导入协议、path containment、mime validation、thumbnail pipeline、storage budget、deletion/recovery 设计通过。

### Full-text / Global Search

Wireframe：

- Global search route、full-text search input、filter drawer、query result empty/loading/result/error。

当前实现策略：

- Current slice 只允许 Home 本地 snapshot search/filter。Global search、full-text、跨 workspace、tag/entity/semantic search 不进入 current build。

触发条件：

- Drizzle app index 或 filesystem scan query owner 明确，Query key 和 invalidation 明确。

### Entity/People/Places

Wireframe：

- Reflection highlight、suggestion popover、entity detail panel。

当前不实现：

- 自动抽取、联系人卡、跨 memory graph。

触发条件：

- Entity schema、review/accept flow、privacy、undo/delete effect、tests 通过。

# Soft Flat Design System 重构

开始时间：2026-05-11 09:43 America/Los_Angeles

关联长期任务：无。

## 目标

把 Reo 当前视觉系统收敛为 Soft Flat Design System。当前任务重点不是增加 token，而是用更少的语义 token 规范所有 TSX 组件，删除旧 glass/vector token 和组件专属 token 倾向。

## 成功标准

- `docs/current/design-system/*`、`src/renderer/src/theme.css` 和 `src/renderer/src/index.css` 使用同一套 Soft Flat 语义。
- TSX 组件只消费设计系统已有语义 token；无法映射时优先调整组件设计，不为单个组件新增专属 token。
- 同平面组件不用 border 或 shadow 建立层级；基础 Button/Input/Card-like surface 默认无阴影。
- 只有 Tooltip、Dropdown、Dialog、Drawer、Toast 这类浮层可使用 `shadow-float` 或 `shadow-modal`。
- Hover、active、selected 通过灰度阶梯和少量品牌色表达，不做突兀色彩跳跃。
- Electron 交互保持 `drag-region` / `no-drag-region`、`select-text` 和 150-200ms motion 约束。
- `npm run verify:quick` 通过，并保留运行时视觉证据。

## 设计依据

- Tailwind CSS v4 官方文档确认 CSS-first `@theme`、`@custom-variant` 和 CSS token 注入方式。
- shadcn/ui 当前文档确认 CSS variables + `@theme inline` 的语义变量模式。
- ElevenLabs UI Waveform / Scrub Bar / Audio Player / Live Waveform 文档确认 canvas waveform、AudioScrubber 的 `data/currentTime/duration/onSeek` 模型、RecordingWaveform / LiveWaveform 的录音态 waveform 模型，以及 scrub start / scrub / scrub end 的全热区交互边界；Reo 采用现有本地 primitive retokenize，不引入 ElevenLabs CLI 组件和新依赖。
- Reo 保留现有 `data-theme="light|dark"` runtime 机制；不切换到 `.dark` class。

## 备份

旧设计系统快照位于 `artifacts/previous-design-system/`，只作为本次证据，不作为 current 真源。

## 执行策略

1. 先改设计系统源和 runtime theme。
2. 再改 shared primitives，让修改通过上游 variant 级联到业务组件。
3. 最后逐个审查 TSX consumer，删除旧 token、组件专属 token 和无必要 border/shadow。
4. 每轮完成后询问：是否对当前实现有事实上的 100% 信心；如果没有，列出漏洞并继续修复。

## 实现结果

- `docs/current/design-system/*`、`src/renderer/src/theme.css`、`src/renderer/src/index.css` 已收敛到 Soft Flat 语义 token、`data-theme` dark variant、透明 border、浮层 shadow、全局不可选中文本和显式可选中文本规则。
- Shared UI primitives 已改为语义化 Soft Flat：Button/Input/Textarea/Field/Breadcrumb/Dropdown/Dialog/Drawer/Tooltip/Toast/SpeedDial/Waveform 不再依赖旧 glass/vector token；危险动作使用 `destructive` variant，浮层使用 `bg-popover` 与 `shadow-float`/`shadow-modal`。
- Workspace TSX consumer 已按 Soft Flat 重新冲洗：MemoryRail、MemoryStudio、RecordingOverlay、RecordingControls、WorkspaceTitlebar、WorkspaceFrame、WorkspaceCreateDialog、FolderPickerField、CarouselArrowButton 和 recording transcript view 使用灰度阶梯、无同平面边框/阴影、150-200ms motion 与 `select-text`。
- Radius pass 已把普通 button、icon button、menu action、Breadcrumb trigger、sidebar 列表项、carousel arrow、播放按钮和返回按钮收敛到方圆角；FAB trigger、FAB action 与录音主 CTA 保留全圆，dot、timeline marker 和 drawer/waveform handle 继续使用全圆。PrimeReact SpeedDial action 属于 FAB family，Reo SpeedDial primitive 在该层明确保留重要级 `rounded-full`，不能让普通菜单 action 继承该例外。
- 通用 Button primitive 不再提供全圆 CTA variant；录音主 CTA 的全圆形态保留在 `RecordingControls` 本地 owner，FAB 全圆形态保留在 `FloatingActionButtonSpeedDial` primitive。
- 组件专属全局 token 已移出设计系统；AppShell、Field 和 MemoryStudio 的几何约束保留在 owning component 或 feature-local surface，不进入全局 token 表。
- 主题色收敛为黑色主色和红色辅助：`primary` / `ring` 不再使用蓝色，FAB trigger 和录音主 CTA 使用 `brand-ember`，红色控件使用稳定前景色而不依赖 primary foreground。
- MemoryRail inline 展开/折叠模型收敛为 `WorkspaceFrame` 的固定双轨 grid：第二轨在 `0px` 与 `240px` 间使用 `transition-[grid-template-columns] duration-200 ease-out` 变化，和 sidebar 结构动效保持同一时长与曲线；`WorkspaceFrame` 持有同一条 `1120px` 居中内容轨道，主内容和 FAB track 共享该轨道并保持左右 gutter 对称，MemoryStudio 只填满轨道。
- Segment card preview waveform 从 15 个细条收敛为 9 个 glyph：低振幅绘制为 4px 圆点，高振幅绘制为 4px 全圆角竖柱；选中态使用 `foreground` 黑色，不使用 `primary` 蓝色。
- Memory Studio 主播放区和补充录音播放区使用真实 decoded audio peaks 作为 waveform progress：已播放部分用 `foreground` bars，未播放部分用 `secondary` bars，播放 waveform 使用 4px bar width、4px bar radius，并保留默认 gap 与 decoded waveform sample count；低振幅和近似正方形样本绘制为圆点，高振幅样本绘制为竖向圆角柱；移除播放态独立指针；整条 waveform 热区支持点击 seek，拖拽 seek 只延续由 waveform pointerdown 创建的 scrub session。录音前、录音中和暂停态 waveform 使用同一 4px bar width / 4px bar radius / split progress 模型，暂停态不渲染独立播放指针，不提供离散时间跳转按钮；暂停后回听等待 MediaRecorder flush 出本地可播放前缀，并等待隐藏 audio 触发可播放事件后才启用播放，末尾或 ended 后再次播放从 0 开始；替换单击立即进入 replacement flow，不使用覆盖提示 toast 或二次确认；完成录音立即关闭 overlay，后台继续 durable finalize 和 transcript save。
- 录音前引导文案、录音中空转写提示和真实转写文本统一到同一 speech/transcript typography，不再让各状态分别使用 heading、body 或一-off line-height。
- 可滚动边缘渐隐收敛为设计系统 utilities：`edge-fade-y`、`edge-fade-x` 和 `scrollbar-hover`。录音真实转写与 Memory Studio saved transcript 使用纵向 edge fade 和 hover/focus scrollbar，Segment 横向预览流使用横向 edge fade；业务组件不再自建渐变遮罩或独立滚动条规则。
- 已归档上一轮已收口 spec 与 initiative；当前 active initiative 索引为无。

## 验证证据

- `npm run test:renderer -- src/renderer/src/components/ui/button.test.tsx src/renderer/src/components/ui/floating-action-button-speed-dial.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/recording/RecordingSurface.test.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx`：通过，7 个文件、167 个测试。
- `npm run test:renderer`：通过，24 个文件、226 个测试。
- `npm run verify:memory-studio-layout -- --port 9233 --viewport 900x720 --interaction none --screenshot docs/specs/2026-05-11-0943-soft-flat-design-system/artifacts/soft-flat-memory-studio-900x720.png --metrics docs/specs/2026-05-11-0943-soft-flat-design-system/artifacts/soft-flat-memory-studio-900x720.json`：通过，`items=7`，`failures=[]`。
- `npm run verify:memory-studio-layout -- --port 9233 --screenshot docs/specs/2026-05-11-0943-soft-flat-design-system/artifacts/soft-flat-memory-studio-interaction.png --metrics docs/specs/2026-05-11-0943-soft-flat-design-system/artifacts/soft-flat-memory-studio-interaction.json`：通过，`items=7`，`clickedSecondItem=true`，`scrollMethod=cdp-mouseWheel`，`failures=[]`。
- `npm run verify:memory-studio-layout -- --port 9233 --viewport 900x720 --interaction none --screenshot docs/specs/2026-05-11-0943-soft-flat-design-system/artifacts/soft-flat-radius-pass-900x720.png --metrics docs/specs/2026-05-11-0943-soft-flat-design-system/artifacts/soft-flat-radius-pass-900x720.json`：通过，`items=7`，`failures=[]`。
- `npm run verify:memory-studio-layout -- --port 9233 --viewport 900x720 --interaction none --screenshot docs/specs/2026-05-11-0943-soft-flat-design-system/artifacts/soft-flat-memory-studio-followup-900x720.png --metrics docs/specs/2026-05-11-0943-soft-flat-design-system/artifacts/soft-flat-memory-studio-followup-900x720.json`：通过，`items=7`，`clickedSecondItem=false`，`scrollMethod=not-run`。
- `docs/specs/2026-05-11-0943-soft-flat-design-system/artifacts/soft-flat-runtime-radius-followup-2026-05-12T0436.json`：运行时 computed style 通过，`violations=[]`；干净单 runtime 下 `ERR_WORKSPACE_LOCKED` toast 未出现，sidebar 记忆空间行半径 `12px`，Breadcrumb trigger 半径 `8px`，titlebar 右侧按钮组内收 `44px`，FAB trigger/action 均为全圆。
- `docs/specs/2026-05-11-0943-soft-flat-design-system/artifacts/soft-flat-runtime-radius-followup-2026-05-12T0436.png`：900x720 sidebar、titlebar Breadcrumb、右侧 icon controls 和 FAB 展开态运行时截图。
- `npm run verify:memory-studio-layout -- --port 9233 --viewport 1200x800 --interaction none --screenshot docs/specs/2026-05-11-0943-soft-flat-design-system/artifacts/memory-rail-layout-followup-2026-05-12T0459.png --metrics docs/specs/2026-05-11-0943-soft-flat-design-system/artifacts/memory-rail-layout-followup-2026-05-12T0459.json`：通过，`items=7`，`clickedSecondItem=false`，`scrollMethod=not-run`。
- `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/App.test.tsx`：通过，2 个文件、69 个测试；覆盖 MemoryRail `240px`、rail shell `border-l border-secondary`、rail surface `bg-background px-8`、Memory item `bg-card` / `bg-secondary`、CarouselArrowButton `rounded-full border-secondary bg-background` 且无外圈 ring / shadow；覆盖 right rail inline 折叠态 `grid-cols-[minmax(0,1fr)_0px]`、展开态 `grid-cols-[minmax(0,1fr)_var(--workspace-memory-rail-width)]` 和 `transition-[grid-template-columns] duration-200 ease-out`。
- `npm run test:renderer -- src/renderer/src/components/ui/waveform.test.tsx`：RED 先失败于缺少 `data-waveform-progress`，GREEN 后通过；后续 RED 失败于近似 4px 低振幅仍被画成短柱，GREEN 后通过；覆盖播放进度由 split waveform 表达且不渲染独立播放指针，低振幅和近似正方形样本以圆点绘制，高振幅以竖向圆角柱绘制。
- `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -- --runInBand`：RED 先失败于 pointer move 后 `aria-valuenow` 仍为 `0`，GREEN 后通过，26 个测试；覆盖主播放 waveform 从 pointerdown 开始连续拖拽 seek 到 75%，并覆盖主播放和补充 waveform 对未创建 scrub session 的 pointermove 不 seek。
- `npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx -- --runInBand`：RED 先失败于旧实现仍暴露独立 playhead、前进/后退 15 秒按钮、替换二次确认和等待最终转写后才关闭；后续 RED 失败于 optimistic close 后后台 finalize 失败不重新打开恢复态、末尾 cursor 直接播放导致从末尾开始、暂停后 preview 未准备仍可点击、chunk 存在但 hidden audio 尚未 canplay 时仍可点击；GREEN 后通过，73 个测试；覆盖录音三态 waveform 几何一致、暂停态 split progress、未创建 scrub session 的 pointermove 不改变 cursor、暂停回听准备状态、hidden audio 可播放门禁、末尾/ended 后从 0 重播、替换单击进入 replacement flow、完成录音不等待最终转写 backfill 即关闭 visible surface，后台收口失败会重新打开失败恢复态。
- `npm run test:renderer -- src/renderer/src/workspace/mediaRecorderAdapter.test.ts src/renderer/src/workspace/RecordingOverlay.test.tsx -- --runInBand`：RED 先失败于 controller 缺少 `flush()` 且 paused preview 未准备仍可点；GREEN 后通过，2 个文件、85 个测试；覆盖 MediaRecorder `requestData()` flush 当前 durable chunk 并等待 chunk 转换，overlay 在可播放前缀准备完成前禁用播放而不是弹出播放失败。
- `npm run test:renderer -- src/renderer/src/workspace/recording/RecordingTranscriptPreview.test.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx -- --runInBand`：RED 先失败于 paused/focus 模式调用 `scrollIntoView`，后续 RED 失败于录音前引导、录音中空转写提示和真实转写容器 typography 不一致；GREEN 后通过，78 个测试；覆盖 cursor focus 只滚动 transcript 内部容器，不滚动外层 recording surface，并覆盖 recording speech/transcript text 统一使用 `font-sans text-body-lg font-medium leading-body-lg`。
- `npm run test:main -- rendererViewportCss.test.ts`：RED 先失败于缺少设计系统 `edge-fade-y`、`edge-fade-x` 和 `scrollbar-hover` utilities，GREEN 后通过，316 个 main tests。
- `npm run test:renderer -- src/renderer/src/workspace/recording/RecordingTranscriptPreview.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -- --runInBand`：RED 先失败于 RecordingTranscriptPreview 和 Memory Studio Segment strip 未使用 edge fade utilities，GREEN 后通过，2 个文件、33 个测试。
- `npm run format:check`：通过。
- `npm run verify:quick`：通过。包含 typecheck、main `315` tests、renderer `236` tests、lint、format check。
- Electron runtime 观察：Computer Use 读取现有 `localhost:5173` Electron 窗口，`测试工作区1 · 测试灵感` 的 Memory Studio 可见；右侧 MemoryRail 折叠时主内容区和底部红色 FAB 位于同一居中内容轨道，Segment preview waveform 选中态为黑色，播放 waveform 为浅灰未播放态。当前可见 runtime 未开放 CDP remote debugging 端口，本轮未新增 `verify:memory-studio-layout` 截图文件。
- 源码扫描无命中：旧视觉体系词汇、组件专属全局 token、错误滚动行为、旧波形动画名、错误 hover class、超过 200ms 的显式 TSX motion、TSX 硬编码颜色。

## 自审结论

事实漏洞检查后仍保留的风险为人工视觉 taste 判断；当前代码、token、文档、测试、扫描和 Electron runtime 证据未发现与 Soft Flat Design System 冲突的残留项。

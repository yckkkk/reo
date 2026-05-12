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
- MemoryRail inline 展开/折叠模型收敛为 `WorkspaceFrame` 的固定双轨 grid：第二轨在 `0px` 与 `240px` 间使用 `transition-[grid-template-columns] duration-200 ease-out` 变化，和 sidebar 结构动效保持同一时长与曲线；主内容和 FAB 保持对称横向 padding，不再使用 rail inset 或 gutter 补丁。
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
- `npm run format:check`：通过。
- `npm run verify:quick`：通过。包含 typecheck、main `315` tests、renderer `226` tests、lint、format check。
- Electron runtime 观察：当前 dev runtime 进入 `测试工作区1` 后，点击 `展开记忆列表` 时右侧 `记忆列表` 出现且按钮切换为 `折叠记忆列表`；再次点击后 `记忆列表` 退出可访问树且按钮恢复为 `展开记忆列表`。当前 runtime 未开放 CDP remote debugging 端口，本轮没有新增 `verify:memory-studio-layout` 截图文件。
- 源码扫描无命中：旧视觉体系词汇、组件专属全局 token、错误滚动行为、旧波形动画名、错误 hover class、超过 200ms 的显式 TSX motion、TSX 硬编码颜色。

## 自审结论

事实漏洞检查后仍保留的风险为人工视觉 taste 判断；当前代码、token、文档、测试、扫描和 Electron runtime 证据未发现与 Soft Flat Design System 冲突的残留项。

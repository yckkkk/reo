# Tiptap 工具栏聚焦显示（编辑会话期间才显示固定工具栏）

- Started: 2026-05-29
- Status: in progress
- 设计真源落点（收口时更新）：`docs/current/frontend.md`（第 59 行 `LightweightMarkdownEditorSurface` chrome 契约）

## 目标

正文/片段编辑器现在一打开就常驻顶部完整工具栏，无论用户在读还是在编辑。改为**只在进入编辑会话时显示**：用户聚焦编辑器（点进正文）→ 工具栏滑入；离开编辑器（失焦/纯阅读）→ 工具栏收起。纯阅读时只剩正文，更干净。

## 背景与判断（已对齐）

- 用户意图：「只有进入编辑态才显示工具栏」。已用 `askUserQuestion` 对齐，选定 **A：聚焦时显示固定工具栏**（保留现有顶部栏形态，仅随焦点显隐），而非改用 BubbleMenu 或新增阅读/编辑模式开关。
- 当前模型事实（`LightweightMarkdownEditorSurface.tsx`）：编辑器几乎一直 `editable`（`disabled` 仅图片上传中为真）；唯一的「正在编辑」运行时信号是焦点；`resolvedEditorFocused` 由 editor `onFocus/onBlur` 维护，已驱动边框色，并经 `onEditorFocusChange` 上报 `MemoryStudio`。工具栏是无条件渲染，不随焦点显隐。
- Tiptap 官方事实（`tiptap-docs`）：官方明说不提供固定工具栏（"Tiptap doesn't come with a fixed menu, but you can build one"）。官方的「按上下文出现」设计是 BubbleMenu/FloatingMenu（浮动菜单）。所以「固定工具栏仅聚焦显示」**没有官方开关**，是一个自定义的焦点门控；按用户取舍保留固定栏形态。
- 焦点门控的真实难点（决定机制选择）：
  - 工具栏按钮（`tiptap-ui-primitive/button`）**未 `preventDefault` mousedown** → 点按钮会让 contenteditable 瞬时失焦再靠链式 `.focus()` 抢回。
  - 链接/取色是 Radix Popover、标题/列表是 Radix Dropdown，内容 portal 到 surface 外层，打开时 Radix 把焦点移入 portal → 编辑器也失焦。
  - 因此「只看 `editor.isFocused` 显隐」会立刻翻车（点按钮 / 开 popover 工具栏就消失）。

## 设计方案

### 机制：focusin 显示 + 编辑会话外 pointerdown/focus 离开隐藏

定义「编辑会话」=焦点/指针落在 surface 根内，或落在工具栏自己的 Radix popover/dropdown portal（`[data-radix-popper-content-wrapper]`，Popover 与 DropdownMenu 都渲染进该 wrapper）。

- **显示**：surface 根 `focusin` → `toolbarRevealed = true`（点进、tab 进、程序 focus 都覆盖）。
- **隐藏**：document 上 capture 阶段 `pointerdown` → 命中点不在编辑会话内 → `toolbarRevealed = false`。
- **键盘/主动 blur 兜底**：surface `focusout` 的下一个焦点在会话外时收起；`relatedTarget=null` 时下一帧确认 `document.activeElement`，避免 Radix portal 过渡误收起；document capture `focusin` 命中会话外也收起，用于从 portalled popover tab 出去。
- 展开态 titlebar 非控件区域补一个 48px 透明 no-drag 命中层，保证 Electron 里 titlebar 空白/标题点击也能成为 surface 外的 pointer target。

为什么把点击隐藏主路径放在「会话外 pointerdown」：`focusout`/`relatedTarget` 对**非聚焦元素**的点击不可靠——沉浸式编辑窗的 titlebar、空白区、以及关闭 dropdown 后再点别处都不会产生干净的 editor blur，导致工具栏收不起来（实测内嵌 OK、展开态失败）。document pointerdown 覆盖这些点击，并天然区分「点工具栏按钮 / popover 内（会话内，不收）」与「点编辑区外（收，且 Radix 同时关掉浮层）」；`focusout`/`focusin` 只作为键盘 Tab 与主动 blur 的兜底。

**不改 Radix、不改 button primitive**；核心显隐逻辑留在 surface 组件内一个 effect，展开态只补 titlebar 命中层 / no-drag 命中边界。

放弃的备选：给按钮加 `preventDefault` + 只看 `isFocused`——要改共享 Tiptap UI primitive（blast radius 大、违背「不重写第三方内部」），且仍解决不了 popover 打开时 Radix 抢焦点，更脆。

### 形态：收起 44px、150ms 滑入、边框同步

- surface 现为 `grid-rows-[44px_minmax(0,1fr)]`（工具栏占固定 44px 行）。隐藏时该行 `44px → 0px`，把空间还给正文阅读。
- 过渡：`grid-template-rows`（Electron Chromium 支持该属性过渡）+ 工具栏 opacity 淡入淡出，**150ms ease-out**，复用现有边框 `duration-150 ease-out` 节奏，与设计系统已有 motion 一致；`prefers-reduced-motion` 下关闭过渡、瞬时显隐。
- 隐藏态：surface 根已 `overflow-hidden` 裁掉收起的栏；工具栏容器 `pointer-events:none` + 通过 ref 设 `inert`（不可 tab 进入、屏读跳过），避免键盘焦点落进收起的栏又触发显示。
- 边框高亮**改挂在 `toolbarRevealed`** 上（显示=`border-ring`，隐藏=`border-secondary`），让边框与工具栏同进同退；避免「开 popover 时工具栏在、边框灭」的不一致。

## 不变量（不动）

- 不把 toolbar 显隐写回 `MemoryStudio` 的编辑状态；原 `editorFocused → MemoryStudio reducer → 回传边框` round-trip 只服务旧边框效果，已删除。dirty-nav、stale-save、窗口关闭拦截继续由内容 hash / dirty state 驱动。
- editor kernel 能力、StarterKit 默认能力、工具栏分组与按钮集合不变。
- `disabled`（图片上传中）的降透明度逻辑不变，只是包在显隐容器内。
- 内嵌与展开编辑入口复用同一 surface 显隐规则；沉浸式 titlebar 的 no-drag 命中层只保证 surface 外点击能进入 renderer，不改变 `NoteEditorOverlay` 的无边框 chrome 或返回/保存职责。

## 设计系统不变量修订（change gate / 硬红线）

本次扩展 `docs/current/frontend.md:59` 记录的 surface chrome 聚焦态契约，收口时必须回写一行：toolbar 仅在编辑会话（surface 聚焦，含其 popover/dropdown 打开期间）显示，失焦收起，并与聚焦边框态同步。除此之外不向 `docs/current/*` 写入任务内 UI 数值/取舍。

## 验证

- TDD 风险面：用户可见交互的小状态机，属轻量验证面。写一个**聚焦行为测试**（复用 `LightweightMarkdownEditorSurface.test.tsx`）覆盖核心契约：初始隐藏 → editor 聚焦后显示 → surface 外 `pointerdown` 后隐藏 → 模拟 `[data-radix-popper-content-wrapper]` 内 `pointerdown` 时保持显示。RED 真实跑出失败再实现。
- 运行时视觉验证（强制）：dev 场景跑内嵌视图与独立编辑窗各一遍，验证「读→点进编辑→开链接/取色 popover→关 popover→点离开」全程工具栏显隐正确、无闪、点按钮不消失；浅色 + 深色截图进本 spec `artifacts/`。
- 提交前 `npm run verify:quick` 跑一次绿。

## 成功标准

纯阅读时无工具栏、界面更干净；点进正文即平滑显示完整工具栏，编辑期间（含开浮层、点任意按钮）工具栏稳定不消失；离开后收起。`resolvedEditorFocused` 上报与既有保存/导航不变量不回退。

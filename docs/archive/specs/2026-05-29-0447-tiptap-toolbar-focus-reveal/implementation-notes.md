# 实现笔记（running）

## 2026-05-29

- 意图对齐：`askUserQuestion` → 选 A（聚焦时显示固定工具栏）。
- 代码事实核对完成：
  - 工具栏在 `LightweightMarkdownEditorSurface.tsx:507-573`，无条件渲染，44px grid 行（`:493`）。
  - 焦点态 `resolvedEditorFocused`（`:228`）由 editor `onFocus/onBlur`（`:328-338`）维护，驱动边框色（`:497`），并经 `onEditorFocusChange` 上报。
  - 按钮 `tiptap-ui-primitive/button/button.tsx` 无 mousedown preventDefault → 点按钮瞬时失焦。
  - 链接/取色 = Radix Popover，标题/列表 = Radix Dropdown，portal 在 surface 外。
  - 复用方：`MemoryStudio.tsx`（内嵌）、`NoteEditorOverlay.tsx`（独立窗，`bordered=false`，不传 `editorFocused`→走 uncontrolled）。
  - `frontend.md:59` 已记 surface chrome 聚焦态契约 → 收口回写一行。
- spec README/plan 写定，待用户过目。

### 进度

- [x] Step 0 基线：React 19.2 / RTL 16 / vitest 4；`inert` 走 ref（DOM 属性，版本无关）。确认 `isInaccessible` 只看 `visibility:hidden`/`hidden`/`aria-hidden`/`display:none`——不看 `inert`/opacity/height，所以收起态用 opacity+height+inert 不会让现有 toolbar 查询失效。
- [x] Step 1 RED：新增 reveal 行为测试，真实跑出失败（`data-toolbar-revealed` 缺失）；review 后追加 focus-out / programmatic blur 回归用例，其中 focus-out 用例先失败再转绿。
- [x] Step 2 GREEN：
  - 关键设计决定：核对发现 `editorFocused` 整条 round-trip（surface→`onEditorFocusChange`→MemoryStudio reducer→回传 `editorFocused`→边框）**只服务边框**，reducer 字段无任何业务读取（dirty/stale 用 content hash）。按正确模型把边框改挂 surface-local `toolbarRevealed`，并删除整条死 round-trip：surface 两个 prop + 本地 focus state、MemoryStudio 两行、reducer 字段/action/test 的 focus 断言（保留 dirty/autosave 断言）。
  - 最终机制：surface 根 `focusin` 原生监听显示；document capture `pointerdown` 隐藏点击会话外；surface `focusout` / document capture `focusin` 兜住键盘 Tab 与主动 blur；命中点/焦点落在 surface 根或 `[data-radix-popper-content-wrapper]` 内则保持。
  - 形态：grid 行 `44px↔0px` + 工具栏 opacity 淡入；过渡在 SCSS（grid-template-rows + border-color 150ms ease-out，reduced-motion 关闭）；收起态 `pointer-events:none` + `inert`（ref 设）。边框挂 `toolbarRevealed`。
- [x] Step 3 targeted 验证：`LightweightMarkdownEditorSurface.test` + `inlineMarkdownEditorState.test` 全绿；`tsc -p tsconfig.json` exit 0；touched 文件 eslint 干净。
- [x] Step 4 运行时视觉（dev 场景 `?reoScenario=memory-studio-rich`，深色）：
  - 内嵌：读态无栏 → 点进显示 → 开高亮 popover 保持 → popover 内点击保持 → 点编辑区外收起且关掉 popover。
  - 展开态（EditorExpandShell，`bordered:false`）：读态无栏 → focus 显示 → **点 titlebar 收起**。
  - 全部用真实 DOM/Radix 在浏览器核对（`data-toolbar-revealed` + grid-template-rows + popper wrapper）。
- [x] verify:quick 全绿：typecheck ✓、test:main 40 ✓、test:renderer 539 ✓、lint:strict ✓、format:check ✓。
  - 顺带修两个吃旧行为的既有断言：`LoadedWorkspaceFrame.test` 改 surface 收起 grid（`0px`）、删 `transition-[border-color]` 断言、把「聚焦工具栏按钮→边框灭」改为「边框保持 ring」（新一致性）。
- [x] 回写 `docs/current/frontend.md:59`：surface chrome 增记 toolbar 编辑会话显隐 + inert。
- [x] Step 5 phase-gate：`/review` 找到并修复 keyboard/programmatic blur 漏收；`/simplify` 清掉 spec 中旧模型文字。最终归档前 targeted：4 个相关 test 文件 121 tests 通过；surface reveal 6 tests 通过；`tsc -p tsconfig.json` exit 0；touched TS/TSX eslint 通过；touched files Prettier 通过。

### 机制修订（用户实测反馈后）

用户实测：内嵌 OK，但**展开态点 titlebar/空白收不起来**，且**dropdown 关闭后再点编辑区外也收不起来**。根因：`focusout`/`relatedTarget` 对点击非聚焦元素（titlebar、空白、dropdown 关闭后）不产生干净 blur。

最小且更简的修复（按用户「不要太复杂」）：点击隐藏主路径改为 **document capture `pointerdown`：命中点不在编辑会话（surface 根 + `[data-radix-popper-content-wrapper]`）内则收起**；显示仍用 surface `focusin`。selector 同时从 `…,[role=menu],[role=dialog]` 收窄为只 `[data-radix-popper-content-wrapper]`（修一个浏览器通知 dialog 误判保持的 case；Popover 与 DropdownMenu 都进该 wrapper）。后续 review 发现 pointer-only 会漏键盘 Tab 与主动 blur，所以补回很窄的 focus 兜底：surface `focusout` 下一个焦点在会话外即收起，`relatedTarget=null` 时下一帧看 `document.activeElement`；document capture `focusin` 负责从 portalled popover tab 到外部的场景。

测试相应覆盖 pointerdown-outside、focus-outside、programmatic blur、pointerdown-in-popper（6 个 reveal 测试全绿）。tsc exit 0、touched eslint 干净。

### 展开态 titlebar 命中层修订

用户继续实测：展开态只有 titlebar 右侧能收起，左侧/中间仍不收。源码与 Electron 实测确认有两个叠加问题：

- `EditorExpandShell` 的沉浸式 titlebar 控件是绝对定位，非控件 titlebar 空白区没有自己的 DOM 命中层，点击会落到下方 editor surface 或 native drag 区，不会成为“编辑会话外点击”。
- 该区域还需要显式 `-webkit-app-region:no-drag`，否则 Electron 顶部 drag region 会吞掉部分点击，renderer 收不到 `pointerdown`。

最小修复：`ImmersiveWorkspaceTitlebar` 增加 48px 透明 titlebar hit area（`z-[9]`，低于返回/标题/actions 的 `z-10`），并把 hit area、标题、右侧 actions、返回按钮统一标为 no-drag。它不新增状态、不改变返回/缩小职责，只保证 titlebar 非控件区域命中到 surface 外 DOM。新增 `EditorExpandShell.test` 覆盖 expanded titlebar hit area。

Electron runtime 复测：刷新窗口后进入 Memory Studio 展开编辑器 → focus 正文显示 toolbar → 点击 titlebar 中间空白（约 x=600,y=20）收起；再次 focus → 点击 titlebar 标题文本附近（约 x=132,y=18）也收起。

### phase-gate review / simplify

- `/review`：Codex 只读对抗审查指出 pointer-only 隐藏路径漏掉键盘离开与 `editorHandleRef.current?.blur()` / activeElement blur，属于真实 a11y/状态回归。已补 RED 用例并修复。
- `/simplify`：未新增跨组件状态；保持一个 surface effect 内的会话判断，titlebar 侧只补 no-drag 命中层。同步清理 spec 中旧的 “focusout+rAF 已完全移除 / 只有 pointerdown” 说法。

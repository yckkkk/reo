# 执行计划

单一可验证工作单元，核心显隐增量落在 `LightweightMarkdownEditorSurface.tsx` + 同目录 `.scss` + `.test.tsx`；展开态 titlebar 命中边界补充落在 `ImmersiveWorkspaceTitlebar` / `ImmersiveWorkspaceReturnButton` + `EditorExpandShell.test.tsx`。

## Step 0 — 基线确认

- 读 `LightweightMarkdownEditorSurface.test.tsx` 现有用例，确认挂载方式与 query 习惯，行为测试无缝接入。
- 确认 React 版本（`inert` 通过 ref 赋值，版本无关）。

## Step 1 — RED：聚焦显隐行为测试

在 `LightweightMarkdownEditorSurface.test.tsx` 新增 describe「toolbar focus reveal」，对工具栏容器加稳定标识 `data-toolbar-revealed`（同时利于运行时调试），断言：

1. 初始未聚焦：`data-toolbar-revealed="false"`。
2. 编辑器获得焦点（fire focusin / editor focus）→ `"true"`。
3. surface 外 `pointerdown` → `"false"`。
4. 焦点移动到编辑会话外 → `"false"`。
5. 主动清空 editor 焦点（`relatedTarget=null`）→ 下一帧确认后 `"false"`。
6. `[data-radix-popper-content-wrapper]` 内 `pointerdown`（测试内构造）→ 保持 `"true"`。

真实运行得到失败输出（属性/状态不存在），记录到 implementation-notes。

## Step 2 — GREEN：最小实现

在 `LightweightMarkdownEditorSurfaceContent`：

- 新增 `const [toolbarRevealed, setToolbarRevealed] = useState(false)`；新增 `toolbarShellRef` 与 merged `surfaceNodeRef`。
- surface 根原生 `focusin` 设 true；document capture `pointerdown` 命中点不在 surface 根内且不在 `closest('[data-radix-popper-content-wrapper]')` 内时设 false；surface `focusout` / document capture `focusin` 兜住键盘 Tab 与主动 blur。
- 删除只服务旧边框 round-trip 的 `editorFocused` / `onEditorFocusChange` / reducer 字段；dirty/stale/关闭拦截继续由内容 hash 和 dirty state 驱动。
- 布局：surface grid 行模板按 `toolbarRevealed` 在 `44px`↔`0px` 切换，过渡加入 `grid-template-rows`（与既有 border-color 同 150ms ease-out）。
- 工具栏容器：`data-toolbar-revealed`、opacity 淡入淡出、隐藏时 `pointer-events:none`；`useEffect` 用 ref 设 `toolbarShellRef.current.inert = !toolbarRevealed`。
- 边框：旧 focus round-trip → 改为 `toolbarRevealed ? border-ring : border-secondary`。
- `prefers-reduced-motion` 下关闭过渡（SCSS media query）。
- `ImmersiveWorkspaceTitlebar` 增加 48px 透明 no-drag hit area；返回、标题、右侧 actions 统一 no-drag，让 Electron titlebar 点击进入 renderer 并命中 surface 外。

跑 Step 1 测试转绿。

## Step 3 — REFACTOR + 范围内验证

- 保持 surface 内单 effect：surface `focusin/focusout` + document capture `pointerdown/focusin`；重跑测试保持绿。
- targeted：`vitest run LightweightMarkdownEditorSurface`、相关 typecheck。

## Step 4 — 运行时视觉验证（强制）

- dev 场景（`?reoScenario=memory-studio-rich` 等）跑内嵌视图：读态无栏 → 点进显示 → 开高亮 popover 保持 → popover 内点击保持 → 点正文外收起。
- 展开编辑窗（`EditorExpandShell`）跑一遍：读态无栏 → 点进显示 → 点 titlebar 中间空白 / 标题附近收起。
- 运行时证据记录到 `implementation-notes.md`。

## Step 5 — 收口 phase-gate

- `/review` + `/simplify` 过一遍（按 memory 阶段门）。
- `npm run verify:quick` 一次绿。
- 回写 `docs/current/frontend.md:59` 一行（change gate）。
- spec 完成且无遗留长期工作 → 移入 `docs/archive/specs/`。

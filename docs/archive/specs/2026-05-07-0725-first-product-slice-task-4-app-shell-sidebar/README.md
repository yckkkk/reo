# Task 4：App shell、sidebar 和 lucide icon controls

创建时间：2026-05-07 07:25 America/Los_Angeles

## 目标

建立 first product slice 的真实 app shell：底层可拖动 sidebar、上层贴边悬浮内容面板、covered 状态覆盖 sidebar、Home 内 `+` 触发的 create/open workspace 弹层、已加载 workspace 的 New memory 导航和 lucide icon-only controls。该 shell 必须符合参考图的结构与 motion 约束，同时服从 Reo design system，不显示未实现 media/file/future capabilities。

## 范围

- App shell：`src/renderer/src/app-shell/AppShell.tsx`、`AppShell.test.tsx`。
- Starter Home：`WorkspaceStarterHome.tsx`；无 workspace 时仍渲染真实 shell，不渲染独立 entry page。
- Workspace entry Dialog：`WorkspaceEntryDialog.tsx` 组合 `CreateWorkspaceForm` 与 `OpenWorkspaceAction`。
- shadcn source：`tooltip.tsx`、`separator.tsx` 和 Dialog close control，必须同批有真实 consumer。
- Button source：主 pill action 使用 Obsidian；Home `+` 使用 Signal Blue accent circle；裸 icon-only controls 使用 `ghostIcon` variant。
- Icons：`lucide-react`，只用于 icon-only controls 或 icon+text nav。
- App integration：`src/renderer/src/App.tsx`。
- Forbidden capability tests：`src/renderer/src/workspace/ForbiddenCapabilities.test.tsx`。
- Main window chrome：`src/main/index.ts` 使用 `titleBarStyle: 'hiddenInset'`。
- Docs/current：`docs/current/frontend.md`、`docs/current/electron.md`。

## 不做

- 不实现 Home local search、memory card、recording drawer、waveform、audio controls 或 memory detail。
- 不显示 photo、video、file、film、sharing、sync、auth、AI、global search。
- 不创建 fake macOS traffic light controls、top bar、generic layout framework 或 future route registry。
- 不创建参考图中不存在的独立 Create workspace 页面；Create workspace 只能作为 Home `+` 触发的弹层工作流。
- 不使用 emoji；icon-only controls 使用 lucide 并提供 `aria-label`。

## 设计约束

- Sidebar 是底层 `z-index: 1`，紧贴窗口左边，铺满高度。
- Sidebar width 最小 240px、最大 520px；默认 240px；拖拽时关闭 motion，只直接更新 width。
- 主内容 panel 是上层 `z-index: 2`，`position: absolute`，顶/右/底与窗口边缘重叠；展开态左侧形成悬浮边界并使用 12px radius，右侧不显示圆角。
- Expanded：panel `transform: translateX(var(--sidebar-width))`。
- Covered：panel `transform: translateX(0px)`、宽度 100%、radius 归零，覆盖 sidebar，而不是把 sidebar 推出视野。
- Motion：state toggle 同步过渡 `transform,width`，280ms `cubic-bezier(0.16, 1, 0.3, 1)`；reduced motion 下关闭 motion；直接拖拽 resize 时不启用 transition。
- macOS 红黄绿按钮使用原生 hidden-inset chrome；hide/show sidebar icon-only control 位于红黄绿旁边，不创建 railbar。
- Sidebar resize handle 是可键盘操作的 vertical separator，真实命中区为 8px，ArrowLeft/ArrowRight 按 20px 步进并更新 `aria-valuenow`。
- Starter Home 只显示 Home nav；已加载 workspace 后增加 New memory nav。Search 直到 Task5 Home local search 完成前不出现。
- Starter Home 的 `+` 是 Create workspace 入口；弹层使用 shadcn/Radix Dialog、可见 close control、focus trap 和 title/description 语义。
- Practical UI：控制数量少、层级清楚、相关 actions 靠近、按钮文案或 aria-label 明确；不为 shell 包多层 card。
- Open-source/source-owned 优先：shadcn Tooltip/Separator/Dialog + Radix behavior、lucide icons；不自研 tooltip/dialog mechanics。

## RED 目标

1. Expanded shell 渲染 workspace navigation、sidebar `z-index: 1`、panel `z-index: 2`、顶/右/底贴边、左侧 radius 12px。
2. Shell 不显示 films/photos/videos/files 等未实现能力。
3. Covered shell 渲染 show-sidebar icon-only control，panel 用 transform 覆盖 sidebar，transition 是 280ms ease-out。
4. Sidebar resize handle role 为 separator，direct resize clamp 到 240-520px。
5. Icon-only controls 必须有 accessible name。
6. App 无 workspace state 使用 AppShell + Starter Home；点击 Home `+` 才打开 create/open workspace Dialog。
7. App loaded state 使用 AppShell 包裹 WorkspaceHome；旧独立 entry page 不再作为 current UI。

## 验证命令

RED/GREEN targeted：

```bash
npx vitest run src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/CreateWorkspaceForm.test.tsx
```

固定提交前门禁：

```bash
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
git status --short
```

## 停止条件

- 出现 unresolved BLOCKER/MAJOR。
- 需要实现 Home search 或 recording drawer 才能验证 shell；这些属于后续 task。
- shadcn/lucide 引入产生未证明 consumer 或大范围样式漂移。

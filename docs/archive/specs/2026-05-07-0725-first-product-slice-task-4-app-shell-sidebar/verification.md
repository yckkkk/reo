# 验证

## 初始状态

- Task 3 已归档并提交：`b44d49189f12062ca09803e8eabc913248274d13`。
- `git status --short --branch`：仅显示 `## feat/first-product-slice-impl`。
- `find docs/specs -mindepth 1 -maxdepth 1 -print` 在创建本 spec 前为空。

## RED/GREEN/REFACTOR 记录

- RED，2026-05-07 07:27 PDT：
  - `npx vitest run src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/App.test.tsx` FAIL。
  - 失败 1：`AppShell.test.tsx` 无法 resolve `./AppShell`，证明 shell 组件尚不存在。
  - 失败 2：`ForbiddenCapabilities.test.tsx` 无法 import `../app-shell/AppShell`，证明 forbidden capability 测试尚未覆盖 shell。
  - 失败 3：`App.test.tsx` loaded workspace state 找不到 `navigation` name `Workspace`，证明 App 尚未集成 shell。
- Context7，2026-05-07 07:33 PDT：
  - `/lucide-icons/lucide`：React icons 以 named exports 引入，渲染 inline SVG；icon-only button 的 accessible name 放在 button 上，icon 保持 decorative。
  - `/radix-ui/primitives`：Tooltip 使用 Provider/Root/Trigger/Content 组合；Separator 使用 orientation 与 accessibility semantics。
  - `/websites/ui_shadcn`：shadcn/ui component source 进入 `components/ui/` 后由项目拥有，可按设计系统 retokenize。
- GREEN，2026-05-07 07:36 PDT：
  - `npx vitest run src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/App.test.tsx` PASS。
  - 结果：3 个测试文件、8 个测试通过。
  - 覆盖：expanded/covered panel transform、sidebar width clamp、Home/New memory navigation、未实现 media/file capability 负向断言、App loaded state shell integration。
- RED，2026-05-07 08:11 PDT：
  - 用户指出 Create workspace 参考图中不存在独立页面，入口应是 Home 里的 `+` icon。
  - `npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/app-shell/AppShell.test.tsx` FAIL。
  - 失败 1：`WorkspaceEntryDialog` 无法 resolve，证明 create/open workspace 弹层尚不存在。
  - 失败 2：App 无 workspace state 找不到 `navigation` name `Workspace`，证明仍是旧 entry page。
  - 失败 3：`AppShell` 未支持 starter shell，仍渲染 `New memory`。
- GREEN，2026-05-07 08:12 PDT：
  - 新增 `WorkspaceStarterHome`、`WorkspaceEntryDialog`；App 无 workspace state 使用 AppShell + Starter Home，Home `+` 打开 create/open workspace Dialog。
  - 删除 `WorkspaceEntryPage` current UI。
  - `npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/app-shell/AppShell.test.tsx` PASS：3 个文件、21 个 tests 通过。
- REFACTOR，2026-05-07 08:15 PDT：
  - `WorkspaceEntryDialog` 组合 `DialogClose` 与 lucide close control，Create workspace form 删除重复品牌文案并降低弹层标题尺寸。
  - `npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx` PASS：4 个文件、22 个 tests 通过。
- REFACTOR，2026-05-07 08:17 PDT：
  - Button `primary` 回到 Reo design system 的 Obsidian filled pill；Home `+` 使用新增 Signal Blue `accent` circle。
  - `npx vitest run src/renderer/src/components/ui/button.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx` PASS：5 个文件、24 个 tests 通过。
- REFACTOR，2026-05-07 08:39 PDT：
  - 用户明确贴边效果为目标状态：展开态 panel 顶/右/底贴合窗口，只在左侧内部边界保留 12px radius；covered 态 panel 左缘也归零、宽度 100%、radius 归零。
  - 移除未使用的 ScrollArea source 与依赖，保留真实 consumer 使用的 Tooltip、Separator、Dialog。
  - `npx vitest run src/renderer/src/components/ui/button.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx` PASS：5 个文件、24 个 tests 通过。
- RED，2026-05-07 08:49 PDT：
  - `$ycksimplify` 审查指出 `WorkspaceEntryDialog` 的 create/open pending ownership 分散，create pending 时 open 仍可触发，open pending 时 create 仍可提交。
  - `npx vitest run src/renderer/src/workspace/CreateWorkspaceForm.test.tsx` FAIL：新增 pending lock 测试中，`Open workspace` 与 `Create workspace` sibling action 未 disabled。
- GREEN，2026-05-07 08:50 PDT：
  - `WorkspaceEntryDialog` 收敛单一 action lock；`CreateWorkspaceForm`、`OpenWorkspaceAction` 使用 start/finish 回调和 `try/finally` 收口 IPC/file async 生命周期；sibling action 和 close control 在 pending 时 disabled。
  - `npx vitest run src/renderer/src/workspace/CreateWorkspaceForm.test.tsx` PASS：1 个文件、13 个 tests 通过。
- REFACTOR，2026-05-07 08:52 PDT：
  - Home `+` 从 raw button 收回到 Button primitive，新增 `accentCircle` variant 和 `iconLarge` size；AppShell tests 去除导出的 motion class 常量依赖，改用语义 role/name 查询。
  - `npx vitest run src/renderer/src/components/ui/button.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx` PASS：5 个文件、27 个 tests 通过。
  - `npx tsc -p tsconfig.json --noEmit` PASS。
- REVIEW-DRIVEN REFACTOR，2026-05-07 09:28 PDT：
  - Claude CLI 前端 + `/simplify` 审查返回 FAIL：4 个 unresolved MAJOR，分别是 resize handle 实际 1px、AppShell raw button、Dialog close raw button、accentCircle hover dead code。
  - 处理：resize Separator 保留 Radix 语义并提供 8px 真实命中区；icon-only controls 收敛到 Button `ghostIcon` variant；accentCircle hover 变为 Obsidian；删除 pending action state/ref 双轨；form accessible name 改为 `Workspace details`。
  - `npx vitest run --no-color src/renderer/src/components/ui/button.test.tsx src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/workspace/CreateWorkspaceForm.test.tsx` PASS：3 个文件、23 个 tests 通过。
  - `npx tsc -p tsconfig.json --noEmit` PASS。

## Runtime / UI evidence

- Context7，2026-05-07 08:08 PDT：
  - `/radix-ui/primitives` Dialog：modal Dialog 使用 Root/Portal/Overlay/Content，Title/Description 提供可访问语义，Radix 负责 focus trap、scroll lock 和 keyboard navigation。
- Computer Use，2026-05-07 08:14-08:19 PDT：
  - `npm run dev` 启动 Electron dev runtime，窗口标题 `Reo`，URL `localhost:5173/`。
  - 无 workspace state 显示真实 AppShell：左侧 240px sidebar、上层贴边 panel、Home nav、无 railbar、无 Search/photo/video/file/film。
  - Home 主内容显示 `All memories`，`+` icon-only control 的 accessible name 是 `Create workspace`。
  - 点击 `+` 打开 shadcn/Radix Dialog；Dialog 内部为 create/open workspace 工作流，title input 自动获得焦点，可见 close control。
  - 关闭 Dialog 后点击 `Hide sidebar`，主 panel 覆盖 sidebar，control 切换为 `Show sidebar`，没有 railbar。
- Computer Use，2026-05-07 08:55 PDT：
  - HMR 后再次核对真实 Electron runtime：展开态 panel 顶/右/底贴边，左侧只在 sidebar 内部边界显示圆角；折叠后 panel 左缘归零并铺满窗口。
  - Home `+` 仍打开 workspace entry Dialog；Dialog 显示 create/open 两条入口、可见 close control、title field focus。
- Computer Use，2026-05-07 09:31 PDT：
  - Claude MAJOR 修复后复验真实 Electron runtime：hide/show sidebar control 位于原生红黄绿旁，仍为无圆圈边框的 lucide icon-only Button。
  - Home `+` 打开 Workspace entry Dialog；Dialog close control 是可见 icon-only control，表单区域 accessible name 为 `Workspace details`，title field 自动获得焦点。
  - Covered 状态下主内容 panel 左缘归零、宽度铺满窗口；展开后恢复 sidebar 240px 与左侧 12px panel radius；无 railbar、无 future media/file/search controls。

## 固定门禁

- PASS，2026-05-07 09:33 PDT：
  - `npm run verify:quick`
  - 结果：typecheck、247 个 main tests、65 个 renderer tests、lint、format check 全部通过。
- PASS，2026-05-07 09:34 PDT：
  - `npm run build`
  - 结果：main、preload、renderer production build 全部通过。
- PASS，2026-05-07 09:36 PDT：
  - `git diff --check`：无输出。
  - `diff -u AGENTS.md .claude/CLAUDE.md`：无输出。
  - `find docs/specs -mindepth 1 -maxdepth 1 -print`：归档前仅显示本 spec。
- PASS，2026-05-07 09:37 PDT：
  - spec 归档后 `find docs/specs -mindepth 1 -maxdepth 1 -print`：无输出。
  - spec 归档后 `git status --short`：只显示 Task 4 相关 tracked changes、`WorkspaceEntryPage.tsx` 删除、新增 app-shell/ui/workspace 文件和已归档 Task 4 spec。

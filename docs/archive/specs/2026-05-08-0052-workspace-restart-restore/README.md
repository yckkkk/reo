# Workspace 项目持久化

创建时间：2026-05-08 00:52 America/Los_Angeles

## 目标

Reo 在用户成功创建或打开本地 workspace 后，由 main process 注册该 workspace 为持久项目。应用重启时，renderer 通过显式 IPC 读取 workspace 项目列表；sidebar 持续显示已导入项目。用户点击项目时，renderer 只发送项目身份，main process 从持久 registry 中解析真实 root 并打开 workspace。

## 成功标准

- 成功打开或创建 workspace 后，main process 持久化 workspace registry entry，renderer 不接触 raw path。
- 重启后 sidebar 显示已导入 workspace 项目列表，即使当前还没有 active workspace session。
- 点击持久项目会通过 main-owned registry 打开 workspace，并返回新的 opaque `workspaceHandle`。
- 被点击项目缺失、metadata 无效、被其他 Reo 实例锁定或文件系统错误时，不静默失败；当前内容区显示可见错误。
- `workspaceHandle` 仍只属于本次进程内 capability，不跨重启持久化。
- 不引入 DB、Zustand、generic IPC、logging、auth、updater 或录音组件优化。

## 设计约束

- 新增 IPC 必须是显式 workspace capability，不暴露 `ipcRenderer`、raw path 或 generic command bus。
- Workspace registry 由 main-owned app state file 持久化，属于 Reo 项目列表，不是 workspace 内容真源。
- Registry entry 的 renderer 可见字段只包含 workspace/project identity、title、description 和导入/打开时间等安全元数据；root path 只在 main 持久化文件和 main 内存中存在。
- 持久项目打开流程复用当前 `openWorkspaceFiles`、single-writer lock、handle registration 和 recovery/index reconciliation 规则。
- 项目打开失败不删除 registry entry 或用户 workspace；registry 文件损坏时按空项目列表处理并保留用户 workspace 文件。

## 验证

- RED：`npm run test:renderer -- src/renderer/src/App.test.tsx src/renderer/src/workspace/workspaceApi.test.ts` 失败，缺少 `listWorkspaceProjects/openWorkspaceProject`；`npm run test:main -- workspaceContract.test.js workspaceBridgeSurface.test.js workspaceIpc.test.js` 失败，缺少 project registry contract、bridge 和 IPC handler。
- GREEN：实现 main-owned workspace project registry、`workspace:listProjects`、`workspace:openProject`、preload/renderer API、sidebar Query 读取和项目点击打开。
- REFACTOR：`$ycksimplify` 三路审查后修复 registry no-follow 读取、atomic JSON 写入、实例级写队列、strict project response contract、registry read error envelope、项目列表 TanStack Query owner、Electron main API guard 和重复 action lock 更新。
- 目标测试：`npm run test:renderer -- src/renderer/src/App.test.tsx src/renderer/src/workspace/workspaceApi.test.ts src/renderer/src/workspace/workspaceQueries.test.ts` 通过，18 tests。
- 目标测试：`npm run test:main -- workspaceContract.test.js workspaceBridgeSurface.test.js workspaceIpc.test.js workspaceProjectRegistry.test.js` 通过，256 tests。
- 全量验证：`npm run verify:quick` 通过，覆盖 typecheck、256 个 main tests、108 个 renderer tests、lint 和 format check。
- Runtime：重新 `npm run dev`，用户验证打开 workspace 后重启仍显示项目列表，并可点击打开。
- 导航修正 RED：`npm run test:renderer -- src/renderer/src/App.test.tsx` 失败，新增测试显示 loaded workspace 中点击 sidebar `首页` 未调用 `closeWorkspace`，页面仍停在 workspace Home。
- 导航修正 GREEN：sidebar `首页` 在 active workspace 存在时调用 `closeWorkspace` 并回到 starter shell；memory detail 的 `返回` 保持回 workspace Home；loaded workspace 中 `首页` 不再保持 current page 高亮。
- 导航修正目标测试：`npm run test:renderer -- src/renderer/src/App.test.tsx src/renderer/src/app-shell/AppShell.test.tsx` 通过，26 tests。
- 导航修正全量验证：`npm run verify:quick` 通过，覆盖 typecheck、256 个 main tests、109 个 renderer tests、lint 和 format check。
- Renderer reload stale lock RED：`npm run test:main -- appLifecycleSource.test.js` 失败，新增断言显示主窗口 renderer navigation/reload 没有释放 main process 持有的 workspace handles。
- Renderer reload stale lock GREEN：主窗口 `will-navigate` 触发 `closeAllWorkspaceHandles()`，避免 renderer 已回到首页但旧 handle 仍持有 single-writer lock。
- Renderer reload stale lock 目标测试：`npm run test:main -- appLifecycleSource.test.js` 通过，256 tests。
- Renderer reload stale lock 全量验证：`npm run verify:quick` 通过，覆盖 typecheck、256 个 main tests、109 个 renderer tests、lint 和 format check。
- Workspace create/open 修正 RED：`npm run test:main -- workspaceIpc.test.js workspaceContract.test.js` 失败，暴露 create 把所选目录当作 workspace root、同名 child 不报错、open 空文件夹不初始化、unsafe title 未拒绝。
- Workspace create/open 修正 GREEN：create selection folder 作为 parent location，main 在 parent 下 no-replace 创建 title 同名 child workspace root；同名 child 返回 `ERR_WORKSPACE_ALREADY_EXISTS`；open 空文件夹原地初始化；open 非空非 Reo 文件夹保持 metadata invalid。
- Workspace create/open 目标测试：`npm run test:main -- workspaceIpc.test.js workspaceContract.test.js` 通过，254 tests。
- Workspace create/open renderer 目标测试：`npm run test:renderer -- src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/workspaceApi.test.ts` 通过，25 tests。
- `$ycksimplify` 审查修正 RED：新增 App/main/registry 目标测试失败，暴露切换 workspace 未释放旧 handle、open promise reject 无可见错误、deleted persisted root 只显示泛化打开失败、registry 写入无上限。
- `$ycksimplify` 审查修正 GREEN：同一 renderer 窗口切换新 workspace 前释放旧 handle；释放旧 handle 失败时保留当前 UI 并尽力关闭新 handle；open reject 显示 alert；persisted root missing 返回 `ERR_WORKSPACE_ROOT_MISSING` 并显示“工作区文件夹已不存在。”；empty folder 判断改为 opendir 早停；registry 保留最近 100 个项目并限制 display text/root path 长度。
- `$ycksimplify` 审查修正目标测试：`npm run test:renderer -- src/renderer/src/App.test.tsx src/renderer/src/workspace/CreateWorkspaceForm.test.tsx` 通过，27 tests。
- `$ycksimplify` 审查修正目标测试：`npm run test:main -- workspaceIpc.test.js workspaceProjectRegistry.test.js workspaceContract.test.js` 通过，256 tests。
- `$ycksimplify` 审查修正全量验证：`npm run verify:quick` 通过，覆盖 typecheck、256 个 main tests、114 个 renderer tests、lint 和 format check。
- Workspace 移除与 Library RED：`npm run test:renderer -- AppShell.test.tsx App.test.tsx workspaceApi.test.ts` 失败，缺少 `资料库`、项目更多菜单、移除确认弹层和 renderer `removeWorkspaceProject`；main/preload/contract 目标测试失败，缺少 `workspace:removeProject` channel、bridge 和 registry remove。
- Workspace 移除与 Library GREEN：sidebar 删除 `新记忆`，新增 `资料库` 空白页；每个 workspace 项目右侧新增更多操作，默认隐藏，只在对应项目行 hover/focus/open 时显示；确认后只从 Reo registry 移除项目，不删除本地文件夹；移除 active 项目时先移除 registry entry，再尽力释放当前 workspace handle。
- Workspace 移除与 Library 目标测试：`npm run test:renderer -- AppShell.test.tsx App.test.tsx workspaceApi.test.ts` 通过，35 tests。
- Workspace 移除与 Library 目标测试：`npm run test:main -- workspaceContract.test.ts workspaceProjectRegistry.test.ts workspaceBridgeSurface.test.ts workspaceIpc.test.ts` 通过，258 tests。
- Context7 官方文档核对：Sonner 当前用法是 root 挂载一次 `Toaster`，业务动作调用 `toast.success` 或 `toast.error`；本 slice 采用 `ReoToaster` 作为 shared toast host。
- Subagent 审查修正：untrusted navigation 不再释放 workspace handle；open empty folder 在 lock 后重新验证并清理 lock-only `.reo`；`首页`/`资料库` 只有 close 成功后才切换顶层页；workspace more 按钮不可见时也不可点击；Sonner 依赖已有真实 `ReoToaster` consumer、测试和 current docs。
- Subagent 审查目标测试：`npm run test:renderer -- src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/workspaceApi.test.ts src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx` 通过，69 tests。
- Subagent 审查目标测试：`npm run test:main -- workspaceContract.test.ts workspaceProjectRegistry.test.ts workspaceBridgeSurface.test.ts workspaceIpc.test.ts appLifecycleSource.test.ts` 通过，260 tests。
- 最终全量验证：`npm run verify:quick` 通过，覆盖 typecheck、260 个 main tests、119 个 renderer tests、lint 和 format check。
- Dev 移除反馈修正：移除失败不再在确认弹层内渲染旧 `WorkspaceErrorBanner`，只使用 `ReoToaster`；active workspace 的 registry entry 先移除，`closeWorkspace` 失败不再阻断列表移除。
- Dev 移除反馈目标测试：`npm run test:renderer -- src/renderer/src/App.test.tsx` 通过，25 tests。
- Dev 移除反馈全量验证：`npm run verify:quick` 通过，覆盖 typecheck、260 个 main tests、121 个 renderer tests、lint 和 format check。
- Sidebar 项目行容器 RED：`npm run test:renderer -- src/renderer/src/app-shell/AppShell.test.tsx` 失败，暴露 workspace primary button 和 more button 没有共享项目行视觉容器。
- Sidebar 项目行容器 GREEN：项目行容器承载 hover/current surface，workspace primary button 和 more button 位于同一个项目行容器内，more 仍只在 hover/focus/open 时可见。
- Sidebar 项目行容器目标测试：`npm run test:renderer -- src/renderer/src/app-shell/AppShell.test.tsx` 通过，12 tests。
- 提交前 `$ycksimplify`：三路只读审查完成，无阻断；修复 workspace folder name predicate 重复、project id request schema 重复、bounded no-follow JSON 读取重复、listProjects sender validation 重复、顶层导航流程重复、active workspace 项目列表 fake DTO、App shell props/dialog 重复、sidebar class 重复，以及 remove missing project 无意义 registry 写入。
- 提交前 `$ycksimplify` RED：`npm run test:main -- workspaceProjectRegistry.test.ts` 失败，暴露 remove missing project 仍尝试写 registry。
- 提交前 `$ycksimplify` 目标测试：`npm run test:main -- workspaceProjectRegistry.test.ts workspaceContract.test.ts workspaceIpc.test.ts` 通过，261 tests；`npm run test:renderer -- src/renderer/src/App.test.tsx src/renderer/src/app-shell/AppShell.test.tsx` 通过，37 tests。
- 提交前 `$ycksimplify` 全量验证：`npm run verify:quick` 通过，覆盖 typecheck、261 个 main tests、121 个 renderer tests、lint 和 format check。

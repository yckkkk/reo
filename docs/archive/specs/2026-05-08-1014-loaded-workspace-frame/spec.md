# Loaded Workspace Frame

## 背景

目标设计已收敛为三层信息架构：

- Workspace 层级：右侧 MemoryRail 展示当前 workspace 的所有 Memory，用于切换记忆。
- Memory 层级：中间 Memory Studio 展示当前选中的一条 Memory。
- Asset 层级：Memory Studio 的横向片段时间线只展示当前 Memory 内部的 Asset。

Slice 1 只建立 loaded workspace frame。默认进入 workspace 时，中间是 WorkspaceStage，不显示片段时间线；右侧显示 MemoryRail；底部 ExpressionDock 只接入当前已有真实行为的录音入口。

## 成功标准

- 现有 AppShell sidebar 保持不变：不新增、不删除、不重排 sidebar 入口，不改变 resize、theme toggle、titlebar control 或记忆空间列表行为。
- Loaded workspace 内部有 `WorkspaceFrame`，包含 workspace bar、中央 stage、右侧 MemoryRail 和底部 ExpressionDock。
- 右侧 MemoryRail 展示当前 workspace snapshot 中的全部 Memory 容器；它不展示 Asset 详情。
- 中央 WorkspaceStage 是未选中 Memory 的默认态，不显示横向片段时间线。
- ExpressionDock 只展示已实现的录音入口；笔记、拍照、视频、上传图片不进入 current runtime surface。
- 点击右侧 Memory 后仍能进入现有 memory detail route；本 slice 不实现 Memory Studio 时间线。
- Home、Library、recording overlay、memory detail、workspace create/open/remove 现有行为保持通过测试。
- 设计符合 Reo tokens、北欧极简气质、Tailwind CSS v4、shadcn/ui/Radix source-owned 约束。

## 范围

- 新增或调整 renderer feature-local components。
- 更新 `App`/loaded workspace route composition。
- 更新 renderer tests。
- 更新 `docs/current/product.md`、`docs/current/frontend.md`、必要时更新 `docs/current/data.md`、`docs/current/flow.md`、`docs/current/quality.md`。

不做：

- 不新增 IPC channel、preload method、main process capability、DB schema、auth、logging、updater、packaging 或 telemetry。
- 不新增 `shared-types.ts` 或 `error-codes.md`，除非契约审查证明当前 slice 需要且现有项目合同无法表达。
- 不安装 Zustand、Better Auth、Drizzle、`better-sqlite3`、electron-updater、Electron Forge、Sentry 或 `electron-log`。
- 不显示未实现 asset 入口。
- 不实现 Memory Studio 的 Asset timeline。

## 基础设施审查清单

### 前后端契约点

- IPC 通道 / API 路径：本 slice 预期不新增；继续使用 `workspace:listMemorySpaces`、snapshot、memory detail 和 recording finalize 既有通道。
- 请求/响应格式：当前项目使用 workspace contract/Zod schema 和 renderer `workspaceApi` 类型；审查是否存在 `shared-types.ts`，若不存在，不为本 slice补新共享类型文件。
- 鉴权方式：当前为 Electron trusted sender、opaque `workspaceHandle` 和 main-owned capability；不引入 auth。
- 错误码：当前使用 workspace error envelope；审查是否存在 `error-codes.md`，若不存在，不为纯 layout slice 新建错误码目录。
- 状态同步机制：Workspace snapshot 使用 TanStack Query；MemoryRail 使用 snapshot `memories[]`；录音 finalize 后继续 seed snapshot cache 并 invalidate memory detail。

### 数据与字段

- DB schema：本 slice 不需要 DB。
- 表关系：不新增表；继续使用 Workspace -> Memory -> Recording 文件投影。
- 数据获取模式：右侧 MemoryRail 读取当前 `WorkspaceSession.snapshot.memories`；不新增 Query key。
- 字段：使用现有 memory summary 字段：`memoryId`、title、createdAt、updatedAt、recordingCount、durationMs、hasTranscript、hasReflections。
- Asset timeline：不在本 slice 读取或聚合。

### 前端与组件

- Reusable component：`WorkspaceFrame`、`MemoryRail`、`WorkspaceStage`、`ExpressionDock` 先作为 feature-local components。
- shadcn/ui + Radix：复用现有 Button、Separator、Tooltip 等 primitive；不新增 primitive，除非 RED 证明现有 primitive 不能表达。
- Tailwind CSS v4：使用现有 Reo token class；如发现缺口，先补 design-system token/usage rule，再落业务 class。
- 北欧极简：留白、清晰层级、轻边界、低饱和中性色、小范围 Signal Blue；不做玩具化、feed 化、装饰化或 dashboard 化。

### 文件夹结构

- 新组件放在 `src/renderer/src/workspace/`，除非出现真实子域边界。
- 不创建 generic `layout/`、`services/`、`core/` 或新的 design-system layer。

### 错误处理

- 右侧 MemoryRail 使用当前 workspace snapshot；没有单独 async error。
- Workspace list/snapshot 现有错误路径不改变。
- 点击 Memory 继续使用现有 detail/open route；错误处理留在现有 memory detail query。

## TDD 计划

RED：

- 在 renderer behavior tests 中要求 loaded workspace 显示 WorkspaceFrame、workspace bar、右侧 MemoryRail、中央 WorkspaceStage 和 ExpressionDock。
- 要求 sidebar 现有入口仍存在且不新增“记忆”“收藏”等入口。
- 要求右侧 MemoryRail 显示 Memory 容器和片段数量摘要，不展示 Asset timeline。
- 要求中央默认态不显示横向片段时间线。
- 要求 ExpressionDock 只显示“录音”，不显示笔记、拍照、视频、上传图片。
- 要求点击 ExpressionDock 的“录音”打开现有录音 drawer，并继续使用 new-memory recording target。

GREEN：

- 只实现让上述行为通过的最小 renderer 结构。

REFACTOR：

- 删除重复 class 和无意义 wrapper。
- 保持组件边界 feature-local。
- 复查 App route state 和 Query ownership 没有重复事实。

## 验证

- RED：`npm run test:renderer -- src/renderer/src/workspace/WorkspaceHome.test.tsx src/renderer/src/App.test.tsx src/renderer/src/app-shell/AppShell.test.tsx` 失败，旧实现仍渲染 `全部记忆`、`搜索记忆`、旧 memory card，而不是 Workspace Stage、MemoryRail 和 ExpressionDock。
- GREEN：`npm run test:renderer -- src/renderer/src/workspace/WorkspaceHome.test.tsx src/renderer/src/App.test.tsx src/renderer/src/app-shell/AppShell.test.tsx` 通过，覆盖 loaded workspace frame、sidebar 负向断言、MemoryRail、ExpressionDock 录音入口和现有 memory detail route。
- REFACTOR：删除旧 `WorkspaceHome`/`MemoryCard`/`MemorySection` 模型，改为 `LoadedWorkspaceFrame`、`WorkspaceFrame`、`WorkspaceStage`、`MemoryRail` 和 `ExpressionDock`；App route state 使用 `workspace-stage`，不再把 loaded workspace 默认态命名为 Home。
- Targeted after rename：`npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/App.test.tsx src/renderer/src/app-shell/AppShell.test.tsx` 通过，41 tests。
- Static：`npm run typecheck`、`npm run lint`、`npm run format:check` 均通过。
- Full：`npm run verify:quick` 通过；main tests 262 passed，renderer tests 119 passed，lint 和 format check 通过。
- Subagent infrastructure review：PASS；本 slice 不需要新增 IPC/API、DB schema、auth、logging、query key、Zustand、`shared-types.ts` 或 `error-codes.md`。
- Subagent implementation review：首轮 FAIL 指出 current docs 误把 Memory Studio/timeline 和新建/加入选择写成当前事实；修正后复查 PASS，无 blocker / important / minor。

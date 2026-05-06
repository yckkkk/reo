# 第一产品切片实现计划

> 给执行 agent：本计划通过 `$plan-eng-review` 前不得执行。执行前必须确认本 spec 的 `review.md` 记录 `$writing-plans` 和 `$plan-eng-review` 均通过，且没有未解决 BLOCKER/MAJOR；随后在隔离 worktree 使用 `$executing-plans`。每个实现切片都必须创建独立 spec，按 RED -> GREEN -> REFACTOR 执行，更新 `docs/current/*`，运行指定验证，并提交。

**目标：** 构建 Reo 第一产品切片：本地 memory workspace 创建、录音、mock transcript、停止后编辑 transcript/reflections、重开播放、Codex CLI 只读验证。

**架构：** Renderer 只通过 `window.reoWorkspace` 调用产品方法；preload 暴露显式方法；main 负责 OS dialog、权限、workspace handle、文件系统事务、lock 和 audio 读写。用户内容真源是 workspace 文件夹，DB、auth、updater、logging、Sentry 和 packaging 继续推迟。

**技术栈：** React 19、Electron、electron-vite、Tailwind v4、Vitest、Testing Library、Zod、React Hook Form、TanStack Query、Radix/shadcn source、native MediaRecorder、`proper-lockfile`。

---

## 全局执行规则

- 每个切片开始前先创建 `docs/specs/YYYY-MM-DD-HHMM-first-product-slice-impl-XXX-.../`，至少包含 `README.md`、`plan.md`、`tdd.md`、`verification.md`、`review.md`。
- 每个切片 spec 必须回答：当前真源输入、DB schema、表关系、数据获取模式、cache/query/state ownership、可复用组件与 shadcn gate、文件夹结构、Electron/preload/IPC/security 影响、filesystem transaction/recovery 影响、错误处理 gate、RED/GREEN/REFACTOR 命令和预期输出、验证证据位置。
- 如果某切片不触碰 DB、Electron、filesystem 或可复用组件，spec 必须显式写出“不创建或修改该 surface”，不得留空。
- 每个切片必须先写行为测试并运行到明确失败，再实现最小代码，再重构并重跑保护测试；RED/GREEN 输出必须写入该切片 `tdd.md`。
- RED 证据必须包含命令、失败测试名、失败原因原文和预期失败模式；GREEN 证据必须包含同一命令的通过 summary；REFACTOR 证据必须包含重跑命令和通过 summary。
- 每个切片完成前必须更新涉及的 `docs/current/*`，运行该切片列出的命令，并提交。
- 进入 IMPL-001 前必须确认 active initiative 为 `docs/initiatives/2026-05-06-first-product-slice/`，并在 plan review/verification/commit 后按文档生命周期归档已完成的 design-hardening spec 和 implementation-plan spec，使 `docs/specs/*` 为空。
- 每个实现切片创建 spec 前必须运行 `find docs/specs -mindepth 1 -maxdepth 1 -print`，确认为空；若不为空，先收口、取消或归档已完成 spec。
- 不创建 generic runtime、generic service layer、generic IPC bridge、generic repository layer。
- 不显示 photo、video、file、film 或未来能力 UI。
- 不把 DB、TanStack Query 或 renderer state 当作用户内容真源。
- 不初始化 shadcn/ui，除非该切片同时落地精确 primitive、业务 consumer、共享 invariant 和测试。
- 实现阶段不得直接在 `main` 上执行，除非用户显式授权；按 `$executing-plans` 和 `using-git-worktrees` 创建隔离工作区。
- 涉及 production loading、CSP、protocol、navigation 或 permission baseline 的切片必须运行 `npm start`，并记录 production URL、CSP header、新窗口拒绝、外部导航拒绝、权限默认拒绝。

## 文件责任图

### 测试与配置

- 修改 `package.json`：逐切片加入当前需要的脚本和依赖。
- 修改 `tsconfig.json`：只在 renderer 测试需要时包含测试类型或独立 test config。
- 创建 `vitest.config.ts`：renderer/jsdom 行为测试。
- 修改 `scripts/run-main-tests.mjs` 和 `tsconfig.main.test.json`：main/preload 纯测试覆盖新增文件。
- 修改 `eslint.config.js`：renderer source 禁止直接 import `electron`、`node:*`、`fs`、`path`。

### 运行边界图

```text
Renderer React
  |
  | window.reoWorkspace.<显式产品方法>
  v
Preload bridge
  |
  | ipcRenderer.invoke(仅允许的 channel)
  v
Workspace IPC handlers
  |
  | sender validation + Zod contract + typed error envelope
  v
Main workspace modules
  |
  | selection token / handle / lock / path containment / atomic writes
  v
Workspace folder truth
```

### 切片依赖图

```text
IMPL-001 renderer test foundation
  -> IMPL-002 preload + IPC boundary
    -> IMPL-003 workspace files + preload/API surface
      -> IMPL-004 form + Query data owner
        -> IMPL-005 home UI + shadcn primitives
          -> IMPL-006 recording overlay + media loop
            -> IMPL-007 runtime validation
```

### 录音执行流

```text
Record click
  -> MediaRecorder adapter acquires audio permission
  -> createRecordingDraft()
  -> appendAudioChunk(sequence, bytes) [1 MiB max, 1 in-flight]
  -> pause/resume updates renderer machine only
  -> stop waits append idle
  -> finalizeRecordingDraft(transcript, reflections)
  -> readRecordingDetail() + readRecordingAudioManifest()
  -> readRecordingAudioChunk() -> renderer Blob URL -> revoke on close/switch/unmount
```

### 主进程

- 修改 `src/main/index.ts`：注册 preload、workspace IPC、permission policy、CSP media-src。
- 修改 `src/main/security.ts`：trusted URL、audio-only permission、runtime CSP。
- 创建 `src/main/workspaceContract.ts`：channel 名称、Zod DTO、错误信封、metadata schema。
- 创建 `src/main/trustedSender.ts`：main frame、origin、session/partition、channel allowlist 校验。
- 创建 `src/main/workspaceSelectionTokens.ts`：main-owned selection token，单次消费、过期、sender 绑定。
- 创建 `src/main/workspaceHandles.ts`：opaque `workspaceHandle` registry。
- 创建 `src/main/workspaceIpc.ts`：显式 IPC handler 注册。
- 创建 `src/main/workspacePaths.ts`：realpath、lstat、path containment、safe id。
- 创建 `src/main/workspaceLock.ts`：`proper-lockfile` 薄适配。
- 创建 `src/main/atomicWorkspaceFile.ts`：切片专属 temp/rename/fsync helper。
- 创建 `src/main/workspaceFiles.ts`：workspace init/open/index rebuild。
- 创建 `src/main/recordingDrafts.ts`：draft create、append、finalize、discard、read detail/audio。

### 预加载

- 创建 `src/preload/index.ts`：仅加载 workspace bridge。
- 创建 `src/preload/workspaceBridge.ts`：`contextBridge.exposeInMainWorld('reoWorkspace', productMethods)`。

### 渲染进程

- 创建 `src/renderer/src/App.tsx`：App root 和 workspace route state。
- 修改 `src/renderer/src/main.tsx`：只挂载 `App`。
- 创建 `src/renderer/src/types/reoWorkspace.d.ts`：renderer 全局类型。
- 创建 `src/renderer/src/queryClient.tsx`：TanStack Query provider。
- 创建 `src/renderer/src/workspace/workspaceApi.ts`：窄 API wrapper。
- 创建 `src/renderer/src/workspace/workspaceQueries.ts`：query keys、mutations、invalidation。
- 创建 `src/renderer/src/workspace/CreateWorkspaceForm.tsx`：workspace 创建表单。
- 创建 `src/renderer/src/workspace/WorkspaceHome.tsx`：workspace header、record action、content list。
- 创建 `src/renderer/src/workspace/RecordingOverlay.tsx`：录音、播放、编辑 overlay。
- 创建 `src/renderer/src/workspace/mediaRecorderAdapter.ts`：可注入 native MediaRecorder adapter。
- 创建 `src/renderer/src/workspace/recordingMachine.ts`：录音生命周期 reducer。
- 条件创建 `src/renderer/src/components/ui/*`：仅在对应 shadcn primitive 切片落地。

## 依赖激活表

| 切片     | 依赖                                                                                                  | 激活理由                             | 禁止事项                        |
| -------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------- |
| IMPL-001 | `vitest`、Testing Library、`jsdom`                                                                    | renderer TSX/DOM 行为测试            | 不引入产品状态库                |
| IMPL-002 | `zod`                                                                                                 | IPC、metadata、form boundary schema  | 不暴露 generic invoke/send      |
| IMPL-003 | `proper-lockfile` 和类型包                                                                            | workspace single-writer lock         | 不用 DB lock 替代文件真源       |
| IMPL-004 | TanStack Query、React Hook Form、resolver                                                             | workspace snapshot 和 create form    | recording lifecycle 不进 Query  |
| IMPL-005 | `class-variance-authority`、`clsx`、`tailwind-merge`、`@radix-ui/react-slot`、`@radix-ui/react-label` | 已有 form/home 业务 consumer         | 不添加未用 primitive            |
| IMPL-006 | `@radix-ui/react-dialog`                                                                              | recording overlay 和 editor consumer | 不引入 Vaul/wavesurfer/STT      |
| IMPL-007 | 无默认新增依赖                                                                                        | 验收验证；只修复真实缺陷             | 不把验证通过伪装成 TDD RED 阶段 |

## IMPL-001：Renderer 测试基础和 App 提取

**目标：** 让 renderer TSX/DOM 行为可测试，并把现有 inline `App` 提取为独立组件。

**文件：**

- 创建：`docs/specs/YYYY-MM-DD-HHMM-first-product-slice-impl-001-renderer-test-foundation/`
- 创建：`vitest.config.ts`
- 创建：`src/renderer/src/App.tsx`
- 创建：`src/renderer/src/App.test.tsx`
- 修改：`src/renderer/src/main.tsx`
- 修改：`package.json`
- 修改：`docs/current/quality.md`

### 任务

- [ ] 创建切片 spec，写明目标、RED/GREEN/REFACTOR 证据位置和验证命令。
- [ ] 写 RED 测试：`App.test.tsx` 断言 app 有 accessible `main`、标题 `Reo`，且不出现 `Photo`、`Video`、`File`、`Film`。
- [ ] 在 `package.json` 加 `test:renderer` 脚本，暂不安装依赖时运行 `npm run test:renderer`，记录 `vitest` 不存在或 runner 缺失的 RED 输出。
- [ ] 安装 `vitest`、`@testing-library/react`、`@testing-library/user-event`、`@testing-library/jest-dom`、`jsdom`。
- [ ] 创建 `vitest.config.ts`，使用 jsdom、React plugin 和 `src/renderer/**/*.test.{ts,tsx}`。
- [ ] 提取 `App.tsx`，让 `main.tsx` 只负责 root 挂载。
- [ ] 运行 `npm run test:renderer`，预期 App 测试通过。
- [ ] 把 `verify:quick` 更新为包含 renderer 测试。
- [ ] 运行 `npm run verify:quick`。
- [ ] 更新 `docs/current/quality.md`：renderer test runner、Testing Library、RED/GREEN/REFACTOR 规则。
- [ ] 运行 `git diff --check`。
- [ ] 提交：`test: add renderer test foundation`。

### 预期 TDD 输出

- RED 命令：`npm run test:renderer`。预期输出包含 `sh: vitest: command not found`，或 `App.test.tsx` 对缺失 `main`、标题、禁用未来能力的断言失败。
- GREEN 命令：`npm run test:renderer`。预期输出包含 `App.test.tsx` 通过。
- REFACTOR 命令：`npm run test:renderer && npm run verify:quick`。预期输出包含 renderer test 通过和 quick verification 通过。

## IMPL-002：Preload、显式 IPC 和 Zod 边界

**目标：** 建立 `window.reoWorkspace.chooseDirectory()`、trusted sender 校验、Zod DTO 和错误信封。

**文件：**

- 创建：`docs/specs/YYYY-MM-DD-HHMM-first-product-slice-impl-002-preload-ipc-zod/`
- 创建：`src/preload/index.ts`
- 创建：`src/preload/workspaceBridge.ts`
- 创建：`src/main/workspaceContract.ts`
- 创建：`src/main/trustedSender.ts`
- 创建：`src/main/workspaceSelectionTokens.ts`
- 创建：`src/main/workspaceIpc.ts`
- 创建：`src/renderer/src/types/reoWorkspace.d.ts`
- 创建：`src/renderer/src/workspace/workspaceApi.ts`
- 创建测试：`test/main/workspaceContract.test.ts`、`test/main/trustedSender.test.ts`、`test/main/workspaceSelectionTokens.test.ts`、`test/main/workspaceBridgeSurface.test.ts`、`test/main/rendererImportBoundary.test.ts`
- 修改：`electron.vite.config.ts`、`src/main/index.ts`、`src/main/security.ts`、`tsconfig.main.test.json`、`eslint.config.js`、`package.json`
- 更新：`docs/current/electron.md`、`docs/current/data.md`、`docs/current/flow.md`、`docs/current/quality.md`

### 任务

- [ ] 创建切片 spec。
- [ ] 写 RED 测试：contract 只列允许的 workspace channel；`chooseDirectory` result 只返回 `selectionToken` 和 `displayPath`，不返回 raw `rootPath`，不在 choose 阶段提前返回 conflict/permission 判断。
- [ ] 写 RED 测试：selection token 单次消费、过期、sender 绑定，错误 sender 或过期 token 不暴露 path。
- [ ] 写 RED 测试：trusted sender 拒绝 subframe、错误 origin、错误 session、未知 channel。
- [ ] 写 RED 测试：preload bridge pure factory 用 fake invoker 只暴露 `chooseDirectory()`，且不暴露 generic `invoke/send`。
- [ ] 写 RED 测试：`rendererImportBoundary.test.ts` 用 ESLint API 对 renderer filePath 下的违规 import 文本断言会触发 restricted import error。
- [ ] 安装 `zod`。
- [ ] 实现 `workspaceContract.ts`：channel 常量、no-input contract、chooseDirectory result schema、error envelope。
- [ ] 实现 `trustedSender.ts`：接收最小 adapter 形状，便于 main test 构造 fake event。
- [ ] 实现 `workspaceSelectionTokens.ts`：token 存储在 main，默认短 TTL，consume 后立即删除。
- [ ] 创建 preload bridge，本切片只暴露已实现的 `chooseDirectory()`；`workspaceBridge.ts` 必须导出可测试的 pure bridge factory，runtime install 层只负责绑定 `contextBridge` 和 `ipcRenderer`；不得暴露或声明运行时占位方法；后续切片扩展显式方法时必须同步 contract、handler、preload、renderer wrapper 和测试，不暴露 `ipcRenderer`、`send`、`invoke`。
- [ ] 修改 `tsconfig.main.test.json`，把 `src/preload/**/*.ts` 和 preload surface tests 纳入 main/preload 纯测试编译。
- [ ] 修改 `eslint.config.js`，只对 renderer source 启用 Node/Electron restricted-import 规则。
- [ ] 修改 Electron config 加 preload entry，修改 BrowserWindow 使用 preload。
- [ ] 实现 `workspaceIpc.ts` 注册 `workspace:chooseDirectory`，调用 OS dialog，cancel 返回 typed result。
- [ ] 修改 permission policy：只允许 trusted renderer 的 audio media；video/camera/geolocation/notifications 继续拒绝。
- [ ] 运行 `npm run test:main`，预期 contract/sender/token/preload surface tests 通过。
- [ ] 运行 `npm run lint`，预期 renderer restricted-import 规则不误伤合法源码。
- [ ] 运行 `npm run verify:quick` 和 `npm run build`。
- [ ] 运行 `npm start`，记录 production URL、CSP header、新窗口拒绝、外部导航拒绝、权限默认拒绝。
- [ ] 更新 current 文档。
- [ ] 提交：`feat: add explicit workspace preload boundary`。

### 预期 TDD 输出

- RED 命令：`npm run test:main`。预期输出包含 `Cannot find module '../src/main/workspaceContract'`、`workspaceSelectionTokens.test.ts`、`workspaceBridgeSurface.test.ts`、`rendererImportBoundary.test.ts` 失败，或 contract/preload/import-boundary assertion 失败。
- GREEN 命令一：`npm run test:main`。预期输出包含新增 main/preload/import-boundary tests 全部通过。
- GREEN 命令二：`npm run lint`。预期输出包含 lint 通过。
- REFACTOR 命令：分别重跑 `npm run test:main`、`npm run lint` 和 `npm run verify:quick`。预期输出包含 main/preload tests、lint 和 quick verification 通过。

## IMPL-003：Workspace 文件系统、handle、lock 和 recording draft

**目标：** main 拥有 workspace 初始化、打开、index 重建、recording draft create/append/finalize/discard/read。

**文件：**

- 创建：`docs/specs/YYYY-MM-DD-HHMM-first-product-slice-impl-003-workspace-files/`
- 创建：`src/main/workspaceHandles.ts`
- 创建：`src/main/workspacePaths.ts`
- 创建：`src/main/workspaceLock.ts`
- 创建：`src/main/atomicWorkspaceFile.ts`
- 创建：`src/main/workspaceFiles.ts`
- 创建：`src/main/recordingDrafts.ts`
- 扩展：`src/main/workspaceContract.ts`、`src/main/workspaceIpc.ts`
- 扩展：`src/preload/workspaceBridge.ts`
- 扩展：`src/renderer/src/types/reoWorkspace.d.ts`
- 扩展：`src/renderer/src/workspace/workspaceApi.ts`
- 创建测试：`test/main/workspacePaths.test.ts`、`workspaceFiles.test.ts`、`workspaceHandles.test.ts`、`workspaceLock.test.ts`、`recordingDrafts.test.ts`、`workspaceBridgeSurface.test.ts`
- 扩展测试：`test/main/workspaceContract.test.ts`、`test/main/workspaceIpc.test.ts`
- 创建测试：`test/main/recordingReads.test.ts`
- 创建 renderer 测试：`src/renderer/src/workspace/workspaceApi.test.ts`
- 更新：`docs/current/electron.md`、`docs/current/data.md`、`docs/current/flow.md`、`docs/current/quality.md`

### 任务

- [ ] 创建切片 spec。
- [ ] 写 RED 测试：existing `AGENTS.md` conflict 不写任何文件，hash 保持。
- [ ] 写 RED 测试：path traversal、symlink parent、temp swap、malicious recordingId 被拒绝。
- [ ] 写 RED 测试：workspace init 创建 `AGENTS.md`、`.reo/workspace.json`、`.reo/index.json`、`recordings/`，不创建 photo/video/file/film 目录。
- [ ] 写 RED 测试：corrupt index 可重建，corrupt workspace metadata 阻断写入。
- [ ] 写 RED 测试：`initializeWorkspace`、`openWorkspace`、`closeWorkspace` contract 使用 Zod schema，输出只含 opaque `workspaceHandle`、`workspaceId`、workspace snapshot 和错误信封。
- [ ] 写 RED 测试：`initializeWorkspace` 消费 selection token 并创建 workspace；同一 token 重放、过期 token、错误 sender token 均失败且不泄露 path。
- [ ] 写 RED 测试：`openWorkspace` 消费 selection token 并返回 snapshot；schema mismatch 阻断写入并使 handle invalid。
- [ ] 写 RED 测试：`workspaceHandle` 绑定 sender identity；跨窗口复用、close 后复用、lock lost 后复用均返回 typed error。
- [ ] 写 RED 测试：preload bridge pure factory 用 fake invoker 同批暴露 `initializeWorkspace`、`openWorkspace`、`closeWorkspace`、recording draft/read/save 方法，且不暴露 generic `invoke/send`。
- [ ] 写 RED 测试：renderer global type 和 renderer API wrapper 在 renderer test/typecheck 路径中同批覆盖上述方法，不允许 `workspaceHandle` 进入 query key。
- [ ] 写 RED 测试：duplicate open 返回 `ERR_WORKSPACE_LOCKED`，stale lock 可恢复。
- [ ] 写 RED 测试：audio append sequence、1 MiB chunk 上限、1 个 in-flight append、finalize 等待 append idle。
- [ ] 写 RED 测试：audio manifest/chunk read 必须验证 offset/length、1 MiB 上限、禁止一次性 full-file IPC、malicious metadata path 和 missing audio error。
- [ ] 安装 `proper-lockfile` 和类型包。
- [ ] 实现 `workspacePaths.ts` 的 canonical realpath、lstat、safe id。
- [ ] 实现 `workspaceLock.ts` 薄适配，锁目标为 canonical workspace root，artifact 为 `.reo/workspace.lock`。
- [ ] 实现 `atomicWorkspaceFile.ts`，只服务 workspace files，不泛化。
- [ ] 实现 `workspaceHandles.ts`，绑定 canonical root、workspaceId、sender identity、lock owner。
- [ ] 实现 `workspaceFiles.ts` init/open/index rebuild。
- [ ] 实现 `recordingDrafts.ts` draft create/append/finalize/discard/read。
- [ ] 扩展 IPC contracts 和 handlers：initialize/open/close/createDraft/append/finalize/discard/read detail/audio manifest/audio chunk/save transcript/save reflections。
- [ ] 同批扩展 preload bridge、renderer global type 和 renderer API wrapper，只暴露本切片已有 matching handler、contract 和测试的方法。
- [ ] 运行 `npm run test:main` 和 `npm run test:renderer`。
- [ ] 运行 `npm run verify:quick` 和 `npm run build`。
- [ ] 更新 current 文档。
- [ ] 提交：`feat: add workspace file transactions`。

### 预期 TDD 输出

- RED 命令一：`npm run test:main`。预期输出包含 `workspaceContract.test.ts`、`workspaceIpc.test.ts`、`workspaceFiles.test.ts`、`workspaceHandles.test.ts`、`recordingDrafts.test.ts`、`recordingReads.test.ts` 或 `workspaceBridgeSurface.test.ts` 对应模块缺失或行为 assertion 失败。
- RED 命令二：`npm run test:renderer`。预期输出包含 `workspaceApi.test.ts` 对 renderer global type、API wrapper 或 query key ownership 的失败。
- GREEN 命令一：`npm run test:main`。预期输出包含 workspace contract、IPC handler、path、file、handle、lock、draft、audio read 和 bridge surface tests 全部通过。
- GREEN 命令二：`npm run test:renderer`。预期输出包含 `workspaceApi.test.ts` 通过。
- REFACTOR 命令：分别重跑 `npm run test:main`、`npm run test:renderer` 和 `npm run verify:quick`。预期输出包含 main/renderer tests 全部通过和 quick verification 通过。

## IMPL-004：Workspace data、Query 和创建表单

**目标：** renderer 建立 main-backed workspace snapshot、create form、folder selection 和错误状态。

**文件：**

- 创建：`docs/specs/YYYY-MM-DD-HHMM-first-product-slice-impl-004-workspace-form/`
- 创建：`src/renderer/src/queryClient.tsx`
- 创建：`src/renderer/src/workspace/workspaceQueries.ts`
- 创建：`src/renderer/src/workspace/CreateWorkspaceForm.tsx`
- 扩展：`src/renderer/src/App.tsx`、`src/renderer/src/workspace/workspaceApi.ts`
- 创建测试：`CreateWorkspaceForm.test.tsx`、`workspaceQueries.test.tsx`
- 更新：`docs/current/frontend.md`、`docs/current/data.md`、`docs/current/flow.md`

### 任务

- [ ] 创建切片 spec。
- [ ] 写 RED 测试：初始表单有 title、description、folder picker、submit，初始 focus 在 title。
- [ ] 写 RED 测试：OS dialog cancel 后保留 form values，focus 回 folder picker。
- [ ] 写 RED 测试：existing `AGENTS.md` conflict 显示 alert，不清空输入。
- [ ] 写 RED 测试：query key 不包含 `workspaceHandle`，只用 `workspaceId`。
- [ ] 安装 TanStack Query、React Hook Form、`@hookform/resolvers`。
- [ ] 实现 `queryClient.tsx` 和 `workspaceQueries.ts`。
- [ ] 实现 `CreateWorkspaceForm.tsx`，用 RHF + Zod resolver，folder selection state 独立于 form draft。
- [ ] 把 `App.tsx` 切到 workspace route state：无 workspace 时显示管理页。
- [ ] 运行 `npm run test:renderer`。
- [ ] 运行 `npm run verify:quick`。
- [ ] 记录 900 x 620 和宽桌面 viewport 截图或 DOM 证据。
- [ ] 更新 current 文档。
- [ ] 提交：`feat: add workspace creation flow`。

### 预期 TDD 输出

- RED 命令：`npm run test:renderer`。预期输出包含 `CreateWorkspaceForm.test.tsx` 或 `workspaceQueries.test.tsx` 对缺失组件、缺失 query wrapper 或错误 focus 行为的失败。
- GREEN 命令：`npm run test:renderer`。预期输出包含新增 renderer tests 全部通过。
- REFACTOR 命令：`npm run test:renderer && npm run verify:quick`。预期输出包含 renderer tests 全部通过和 quick verification 通过。

## IMPL-005：Workspace home UI 和最小 shadcn primitives

**目标：** 初始化精确 shadcn primitives，完成 workspace home，不显示未来能力。

**文件：**

- 创建：`docs/specs/YYYY-MM-DD-HHMM-first-product-slice-impl-005-workspace-home/`
- 创建：`components.json`
- 修改：`tsconfig.json`
- 修改：`electron.vite.config.ts`
- 修改：`vitest.config.ts`
- 创建：`src/renderer/src/lib/utils.ts`
- 创建：`src/renderer/src/components/ui/button.tsx`
- 创建：`src/renderer/src/components/ui/label.tsx`
- 创建：必要时 `src/renderer/src/components/ui/tooltip.tsx`
- 创建：`src/renderer/src/workspace/WorkspaceHome.tsx`
- 扩展：`CreateWorkspaceForm.tsx`、`App.tsx`、`index.css`
- 创建测试：`WorkspaceHome.test.tsx`、`ForbiddenCapabilities.test.tsx`、button/label primitive tests
- 更新：`docs/current/frontend.md`

### 任务

- [ ] 创建切片 spec，并列出 exact primitives、consumer、shared invariant、测试。
- [ ] 写 RED 测试：home 显示 workspace title、record action、`Memory Content`，不显示 photo/video/file/film。
- [ ] 写 RED 测试：Button/Label 有 role/name、focus-visible、disabled state；UI 不使用 emoji。
- [ ] 安装 IMPL-005 依赖表列出的精确依赖。
- [ ] 初始化 shadcn config，只添加 Button、Label；Tooltip 只有存在 icon-only control 时添加，并同批安装 `@radix-ui/react-tooltip`。
- [ ] 同批配置 renderer import alias，更新 `tsconfig.json`、`electron.vite.config.ts` 和 `vitest.config.ts`，不得让 shadcn source 或 renderer tests 依赖未声明 alias。
- [ ] Retokenize primitives 到 Reo design system，不保留默认 palette/radius。
- [ ] 实现 `WorkspaceHome.tsx` 和 recording card grid/empty state。
- [ ] 更新 create form 使用 Button/Label primitives。
- [ ] 运行 `npm run test:renderer`。
- [ ] 运行 `npm run verify:quick`。
- [ ] 记录 reference evidence：home 采用居中标题、单 record action、content grid，拒绝未来 controls。
- [ ] 更新 current 文档。
- [ ] 提交：`feat: add workspace home interface`。

### 预期 TDD 输出

- RED 命令：`npm run test:renderer`。预期输出包含 `WorkspaceHome.test.tsx`、`ForbiddenCapabilities.test.tsx` 或 primitive tests 对缺失 UI/alias/role/focus-visible 的失败。
- GREEN 命令：`npm run test:renderer`。预期输出包含 home、forbidden capability、Button、Label tests 全部通过。
- REFACTOR 命令：`npm run test:renderer && npm run verify:quick`。预期输出包含 renderer tests 全部通过和 quick verification 通过。

## IMPL-006：Recording overlay、MediaRecorder、autosave 和 playback

**目标：** 完成录音闭环：record/pause/resume/stop、mock transcript、finalize、playback、transcript/reflections autosave。

**文件：**

- 创建：`docs/specs/YYYY-MM-DD-HHMM-first-product-slice-impl-006-recording-loop/`
- 创建或引入：`src/renderer/src/components/ui/dialog.tsx`
- 创建或引入：`src/renderer/src/components/ui/textarea.tsx`
- 创建：`src/renderer/src/workspace/recordingMachine.ts`
- 创建：`src/renderer/src/workspace/mediaRecorderAdapter.ts`
- 创建：`src/renderer/src/workspace/RecordingOverlay.tsx`
- 扩展：`WorkspaceHome.tsx`、`workspaceApi.ts`、`workspaceQueries.ts`、`src/main/security.ts`
- 创建测试：recording machine、media adapter fake、overlay behavior、autosave、Blob revoke、CSP media-src。
- 更新：`docs/current/frontend.md`、`docs/current/electron.md`、`docs/current/data.md`、`docs/current/flow.md`、`docs/current/quality.md`

### 任务

- [ ] 创建切片 spec。
- [ ] 写 RED 测试：recording lifecycle idle -> acquiring -> recording -> paused -> recording -> stopping -> editing；duplicate stop ignored。
- [ ] 写 RED 测试：pause 时 timer/mock transcript 停止，resume 后恢复。
- [ ] 写 RED 测试：finalize 必须等待最后 append ack。
- [ ] 写 RED 测试：transcript/reflections 独立 autosave，save failure 保留 renderer draft 和 previous disk content。
- [ ] 写 RED 测试：audio playback 先 manifest 再 chunk，Blob URL close/switch/unmount 时 revoke。
- [ ] 写 RED 测试：overlay focus trap、Escape safe close、return focus、reduced motion fallback。
- [ ] 添加 shadcn Dialog/Textarea source 并 retokenize；不添加 Vaul。
- [ ] 安装 `@radix-ui/react-dialog`；Textarea 使用本地 shadcn source，无额外 runtime dependency。
- [ ] 实现 `recordingMachine.ts`。
- [ ] 实现 injectable `mediaRecorderAdapter.ts`。
- [ ] 实现 `RecordingOverlay.tsx`：visible text controls，避免 icon-only 依赖。
- [ ] 扩展 main/renderer API 完成 draft、audio、save、read。
- [ ] 调整 production CSP 增加 `media-src 'self' blob:`。
- [ ] 运行 `npm run test:renderer` 和 `npm run test:main`。
- [ ] 使用 Computer Use 验证 OS dialog、mic permission、录音、暂停/继续/停止、播放、save failure、900 x 620。
- [ ] 运行 `npm run verify:quick` 和 `npm run build`。
- [ ] 运行 `npm start`，记录 production URL、CSP header、blob audio 播放、新窗口拒绝、外部导航拒绝、权限默认拒绝。
- [ ] 更新 current 文档。
- [ ] 提交：`feat: add recording loop`。

### 预期 TDD 输出

- RED 命令一：`npm run test:renderer`。预期输出包含 recording machine、overlay、media adapter、autosave 或 Blob revoke 测试失败。
- RED 命令二：`npm run test:main`。预期输出包含 CSP `media-src` 或 permission/security 测试失败。
- GREEN 命令一：`npm run test:renderer`。预期输出包含 recording lifecycle、autosave、playback、accessibility tests 全部通过。
- GREEN 命令二：`npm run test:main`。预期输出包含 CSP 和 permission/security tests 全部通过。
- REFACTOR 命令：分别重跑 `npm run test:renderer`、`npm run test:main` 和 `npm run verify:quick`。预期输出包含 renderer/main tests 全部通过和 quick verification 通过。

## IMPL-007：Runtime、persistence、reference 和 Codex 只读验证

**目标：** 证明第一产品切片可用，且 workspace 文件能被 Codex CLI 只读理解。

**文件：**

- 创建：`docs/specs/YYYY-MM-DD-HHMM-first-product-slice-impl-007-runtime-validation/`
- 修改：只允许修复 runtime/manual validation 暴露的真实缺陷。
- 更新：`docs/current/*` 和 active initiative。

### 任务

- [ ] 创建切片 spec。
- [ ] 运行 `npm run verify:quick` 和 `npm run build`。
- [ ] 运行 `npm start`，记录 production URL、CSP header、新窗口拒绝、外部导航拒绝、权限默认拒绝。
- [ ] 启动 Electron runtime，使用 Computer Use 完成新 workspace、录音、暂停、继续、停止、播放、编辑、重开。
- [ ] 记录 workspace disk tree，确认有 `AGENTS.md`、`.reo/workspace.json`、`.reo/index.json`、`recordings/<id>/audio.webm`、`transcript.md`、`reflections.md`、`recording.json`。
- [ ] 对用户内容和稳定 metadata 做 hash before/after。
- [ ] 关闭或静置 Reo workspace，确认没有 append/autosave/playback in-flight，再开始 Codex CLI read-only validation。
- [ ] 运行 `codex --version`，并从 `codex exec --help` 确认可用的 read-only sandbox、`--cd`、`--skip-git-repo-check` 和 `--ephemeral` flag；若 Codex CLI 不可用，本切片不得声明通过。
- [ ] 运行 Codex CLI read-only validation，排除 `.reo/workspace.lock*` 和 temp files，确认 hash 不变。
- [ ] Codex CLI 命令必须使用 read-only sandbox 指向 workspace root，例如 `codex exec --sandbox read-only --cd "$WORKSPACE_DIR" --skip-git-repo-check --ephemeral "<read-only validation prompt>"`，并确认 Codex CLI 能读取 workspace `AGENTS.md`、`transcript.md`、`reflections.md` 和 `recording.json`。
- [ ] 对照参考素材记录 home、overlay、micro-interaction evidence。
- [ ] 如果发现缺陷，先写 failing test 或记录可复现失败，再修复；否则不制造 RED。
- [ ] 运行 `git diff --check`、`diff -u AGENTS.md .claude/CLAUDE.md`、`find docs/specs -mindepth 1 -maxdepth 1 -print`。
- [ ] 更新 current 文档和 initiative 完成状态。
- [ ] 提交：`test: validate first product slice runtime`。

### 预期 TDD 输出

- 如果 runtime/manual validation 暴露真实缺陷，RED 命令必须是能复现该缺陷的最窄自动测试或记录可复现失败的 Computer Use 步骤，预期输出必须包含具体失败断言或操作失败点。
- 如果未发现真实缺陷，本切片不制造 RED；`tdd.md` 必须写明“验证切片无行为修复，因此无 RED/GREEN/REFACTOR 代码循环”。
- 最终 GREEN 命令：`npm run verify:quick && npm run build`。预期输出包含 quick verification 和 build 通过。

## 最终交付检查

- [ ] 所有实现切片都有独立 spec、TDD 证据、验证证据、review 结果和 commit。
- [ ] `docs/current/*` 只保留当前事实，不保留过程记录。
- [ ] 没有未解决 BLOCKER/MAJOR。
- [ ] `npm run verify:quick` 通过。
- [ ] `git diff --check` 无输出。
- [ ] `diff -u AGENTS.md .claude/CLAUDE.md` 无输出。
- [ ] Codex CLI read-only validation 通过。
- [ ] active initiative 满足完成条件后归档。

# 架构视图

## 模块视图

```text
src/
  main/
    index.ts
    security.ts
    appProtocol.ts
    secureWebPreferences.ts
    workspaceContract.ts       计划中
    trustedSender.ts           计划中
    workspaceHandles.ts        计划中
    workspaceLock.ts           计划中
    workspaceIpc.ts            计划中
    workspacePaths.ts          计划中
    workspaceFiles.ts          计划中
    atomicWorkspaceFile.ts     计划中
    recordingDrafts.ts         计划中
  preload/
    index.ts                   计划中
    workspaceBridge.ts         计划中
  renderer/src/
    App.tsx                    计划提取
    queryClient.tsx            计划中
    workspace/
      workspaceApi.ts          计划中
      workspaceQueries.ts      计划中
      CreateWorkspaceForm.tsx  计划中
      WorkspaceHome.tsx        计划中
      RecordingOverlay.tsx     计划中
      mediaRecorderAdapter.ts  计划中
      recordingMachine.ts      计划中
```

禁止创建 `src/services`、domain generic `src/lib` bucket、generic command runtime、generic IPC bridge 或 generic repository layer。

## 模块清单

| 模块                      | 能力                                        | IPC 通道                          | 磁盘归属                                              | 生命周期状态                  | 测试                               |
| ------------------------- | ------------------------------------------- | --------------------------------- | ----------------------------------------------------- | ----------------------------- | ---------------------------------- |
| `security.ts`             | CSP、trusted URL、permission policy         | 无                                | 无                                                    | permission request/check      | `security*.test.ts`、runtime smoke |
| `appProtocol.ts`          | `reo-app://renderer` production shell       | 无                                | `out/renderer` read only                              | protocol request              | protocol tests、runtime smoke      |
| `workspaceContract.ts`    | channel 名称、Zod DTO、error envelope       | 全部 workspace/recording channels | metadata schema 定义                                  | schema parse                  | contract tests                     |
| `trustedSender.ts`        | senderFrame 允许列表                        | 全部 IPC handlers                 | 无                                                    | request validation            | sender tests                       |
| `workspaceHandles.ts`     | main-owned workspace capability 注册表      | workspace/recording channels      | 无                                                    | handle create/revoke/validate | handle ownership tests             |
| `workspaceLock.ts`        | single-writer lock 适配层                   | workspace open/write channels     | `.reo/workspace.lock` volatile artifact               | acquire/refresh/stale/release | lock tests                         |
| `workspaceIpc.ts`         | IPC handler 注册                            | 全部 workspace/recording channels | 只委托                                                | request/response/timeout      | IPC tests                          |
| `workspacePaths.ts`       | path containment 与 stable refs             | 无                                | workspace path normalization                          | path validation               | path traversal tests               |
| `workspaceFiles.ts`       | workspace init/open/index 写入              | 由 IPC 委托                       | `AGENTS.md`、`.reo/workspace.json`、`.reo/index.json` | init/open/rebuild             | workspace file tests               |
| `recordingDrafts.ts`      | recording draft append/finalize/discard     | recording channels                | `recordings/<id>/`                                    | draft/final/recovery          | recording transaction tests        |
| `atomicWorkspaceFile.ts`  | scoped temp/rename/fsync helper             | 无                                | 同目录 temp files                                     | write/retry/cleanup           | atomic write tests                 |
| `workspaceBridge.ts`      | contextBridge API                           | invoke 显式 channels              | 无                                                    | preload exposure              | preload bridge tests               |
| `workspaceApi.ts`         | renderer wrapper over `window.reoWorkspace` | 无直接 IPC                        | 无                                                    | error mapping                 | renderer unit tests                |
| `workspaceQueries.ts`     | query keys/mutations                        | 无直接 IPC                        | 无                                                    | pending/error/invalidation    | query tests                        |
| `CreateWorkspaceForm.tsx` | form lifecycle                              | choose/init via API               | 无                                                    | form states                   | RTL                                |
| `WorkspaceHome.tsx`       | workspace list UI                           | open/read via query               | 无                                                    | loading/empty/missing         | RTL + viewport                     |
| `RecordingOverlay.tsx`    | recording、playback、editing                | recording APIs                    | 无                                                    | recording/playback/autosave   | RTL                                |
| `mediaRecorderAdapter.ts` | browser media boundary                      | 无                                | 无                                                    | stream/recorder               | fake MediaRecorder tests           |
| `recordingMachine.ts`     | lifecycle reducer                           | 无                                | 无                                                    | recording state               | transition tests                   |

## 组件与连接器视图

```text
React renderer
  |
  | window.reoWorkspace.productMethod(input)
  v
Preload contextBridge
  |
  | ipcRenderer.invoke("workspace:*" / "recording:*", DTO)
  v
Main ipcMain.handle
  |
  | assertTrustedSender + Zod parse + timeout/error envelope
  v
Main workspace files
  |
  +-- AGENTS.md
  +-- .reo/workspace.json
  +-- .reo/index.json
  +-- .reo/workspace.lock
  +-- recordings/<recording-id>/
        +-- audio.webm
        +-- transcript.md
        +-- reflections.md
        +-- recording.json
```

Renderer 永远不 import `electron`、`node:*`、`fs`、`path`、`child_process` 或 main runtime module。

## 分配视图

| 能力                             | 进程                     | 目录                         | 测试层                              |
| -------------------------------- | ------------------------ | ---------------------------- | ----------------------------------- |
| 安全窗口/protocol/permission     | main                     | `src/main`                   | Node test runner + Electron runtime |
| 文件夹 dialog 和文件写入         | main                     | `src/main`                   | Node test runner                    |
| preload API 暴露                 | preload isolated world   | `src/preload`                | pure preload bridge tests           |
| workspace snapshot cache         | renderer                 | `src/renderer/src/workspace` | Vitest + Testing Library            |
| recording state 与 media adapter | renderer browser context | `src/renderer/src/workspace` | Vitest with fakes + Computer Use    |
| audio playback Blob URL          | renderer                 | `RecordingOverlay.tsx`       | Vitest + Electron runtime CSP       |
| Codex 只读验证                   | workspace folder         | repo 外 temp                 | Codex CLI + hash diff               |

## 接口视图

完整矩阵见 `protocol-contracts.md`。接口规则：

- 每个 product capability 一个 preload method。
- 每个 main-owned product capability 一个 IPC channel。
- 每个 request/response 都有 Zod schema 或 no-input contract。
- 每个 error 都返回 `code`、用户可见 message、internal diagnostic cause、retryability 和 data retention hint。
- 不暴露 generic file read/write 或 command bridge。
- Renderer 后续写入不传裸 `rootPath`；main 通过 opaque `workspaceHandle` 绑定 canonical workspace realpath、sender 和 lock ownership。
- Custom protocol 只服务 `reo-app://renderer/index.html` 及 renderer build assets；不服务用户 workspace 文件。

## 行为视图

```text
no workspace
  -> create form
  -> folder selected
  -> initialize workspace
  -> workspace ready
  -> recording overlay
  -> recording draft
  -> append chunks
  -> finalize recording
  -> editing
  -> autosave transcript/reflections
  -> close/reopen
```

失败行为：

```text
permission denied
  -> actionable error
  -> preserve form or editor state

append/finalize failed
  -> failed recording state
  -> preserve renderer text
  -> stale draft recovery on next open

metadata corrupt
  -> do not delete user files
  -> mark entry recoverable/unsupported
```

## 跨视图映射

- Requirements map：`traceability-matrix.md`
- Data entities map：`data-contracts.md`
- Transactions map：`filesystem-transactions.md`
- Threats map：`security-threat-model.md`
- Lifecycle and state owners map：`state-machines.md`

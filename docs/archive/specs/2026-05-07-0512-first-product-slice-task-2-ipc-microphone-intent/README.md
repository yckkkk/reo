# Task 2：显式 IPC、preload 和 microphone intent

创建时间：2026-05-07 05:12 America/Los_Angeles

## 目标

把 first product slice 的权限和 IPC 基线推进到产品级：新增 memory detail 显式 IPC/preload/API surface；把当前直接授予 trusted audio media 的 permission policy 改为 one-shot microphone intent；确保 renderer 必须先收到 `beginMicrophoneIntent` 成功响应，才允许进入 browser `getUserMedia` 流程。

## 范围

- Main：`workspaceChannels.ts`、`workspaceContract.ts`、`workspaceIpc.ts`、`security.ts`。
- Preload：`workspaceBridge.ts`。
- Renderer contract/API：`reoWorkspace.d.ts`、`workspaceApi.ts`、`RecordingOverlay.tsx`、`workspaceApi.test.ts`、`RecordingOverlay.test.tsx`。
- Tests：`securityPolicy.test.ts`、`workspaceIpc.test.ts`、`workspaceBridgeSurface.test.ts`。
- Docs/current：`electron.md`、`flow.md`、`quality.md`。

## 不做

- 不重新设计录音 drawer、不引入 waveform、不拆分完整 MediaRecorder orchestrator；本 task 只实现 `beginMicrophoneIntent` 先于 `getUserMedia` 的最小 renderer sequencing。
- 不新增 generic IPC bridge、generic service layer 或 runtime。
- 不放松 sandbox、contextIsolation、nodeIntegration、CSP、navigation 或 window-open 边界。
- 不引入 Better Auth、Sentry、electron-log、Electron Forge、updater 或新依赖。

## 设计约束

- IPC 必须是显式 channel/handler/preload method，不暴露 `invoke`、`send`、`ipcRenderer` 或通用 command bus。
- `beginMicrophoneIntent` 和 `clearMicrophoneIntent` handler 使用 `event.sender.id` 作为 sender identity，不信任 renderer 传入 sender id。
- Permission check handler 对 `media` 永远返回 `false`，不授予也不消费 intent。
- Permission request handler 只在 trusted main-frame renderer、audio-only、单个未过期 matching sender intent 同时满足时 grant，并消费 intent。
- Intent TTL 为 15 秒；同一 sender 的第二个 active intent 返回 `ERR_MIC_INTENT_ALREADY_ACTIVE`。
- `clearMicrophoneIntent` 必须要求 sender、workspace handle 和 drawer session owner 一致。
- Workspace close 必须清理该 workspace handle 的 pending intent；window teardown 必须清理全部 pending intents。
- 不允许 video/camera/geolocation/notifications 等 future capability 通过本 task 间接打开。

## RED 目标

1. 无 one-shot intent 时拒绝 microphone permission request。
2. Matching sender intent 只能消费一次；错误 sender 不消费；过期 intent 不能 grant。
3. Permission check 永远不 grant media，也不消费 intent。
4. 同 sender 第二个 active intent 返回 `ERR_MIC_INTENT_ALREADY_ACTIVE`。
5. `clearMicrophoneIntent` 只清理 matching workspace + drawer session owner。
6. valid intent + untrusted origin 仍拒绝，且消耗后不能复用。
7. trusted origin + valid intent 仍拒绝 video/camera。
8. Preload surface 暴露 `beginMicrophoneIntent`、`clearMicrophoneIntent`、`getMemoryDetail`，且没有 generic `invoke/send`。
9. Renderer API 暴露 memory detail 与 microphone intent 方法，DTO 不含 sender id 或 raw path。
10. Recording overlay 必须先 await `beginMicrophoneIntent` 成功，再启动 media adapter；begin 失败不得启动 media acquisition。
11. Media start failure 必须 clear matching pending intent；workspace close/window teardown 必须清理 pending intent。
12. `getMemoryDetail` delayed file read 期间 lock lost 必须返回 `ERR_WORKSPACE_LOCK_LOST`，不得返回 detail。

## 验证命令

RED/GREEN targeted：

```bash
npm run test:main
npx vitest run src/renderer/src/workspace/workspaceApi.test.ts
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
- 当前 active spec 不再唯一。
- 需要重新设计录音 drawer、waveform 或完整 MediaRecorder orchestrator；这些仍回到后续录音 UI task。
- 验证失败且无法通过当前范围内 TDD 修复。

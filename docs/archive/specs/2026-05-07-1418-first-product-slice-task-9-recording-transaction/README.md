# Task 9：Mic sequencing 和 recording transaction identity

创建时间：2026-05-07 14:18 America/Los_Angeles

## 目标

收口 Task 9 的当前剩余行为：录音权限顺序、MediaRecorder cleanup、draft append/finalize transaction、finalized playback/autosave 的 nested identity 和错误恢复必须与当前源码事实、`docs/current/*` 和 implementation plan 对齐。

## 当前事实

- Renderer 已在 `RecordingOverlay` 中先 await `beginMicrophoneIntent` 成功，再调用 `createRecordingDraft` 和 `mediaAdapter.start`。
- `createBrowserMediaRecorderAdapter` 已只请求 audio、停止 tracks、等待 final `dataavailable` chunk、复用 stop operation，并在 setup/construct failure 时清理 stream。
- Main finalize 已把 draft 从 `.reo/drafts/recordings/<recordingId>/` 暴露到 `memories/<memoryId>/recordings/<recordingId>/`，并返回 `memoryId`。
- Main audio/detail/markdown read/save 仍以 public `recordingId` request 为主；这是本 task 的主要收口点。
- `recordingReads.ts` 未作为当前源码文件存在；read/save helper 仍在 `recordingDrafts.ts`。本 task 不为文件名美观强拆模块。

## 范围

- 收紧 finalized recording public request：`getRecordingDetail`、`readRecordingAudioManifest`、`readRecordingAudioChunk`、`saveTranscript`、`saveReflections` 必须携带 `workspaceHandle + memoryId + recordingId`。
- `RecordingOverlay` 在 finalize 后保存 current `memoryId`，后续 playback、transcript autosave 和 reflections autosave 必须传 `memoryId + recordingId`。
- Main read/save helper 对 finalized recording 使用 nested `memoryId + recordingId` 定位，并保留 duplicate finalized id guard。
- 增加 RED/GREEN/REFACTOR 证据，覆盖 renderer request payload、workspace contract schema、main read/save nested path。
- 更新 `docs/current/electron.md`、`docs/current/flow.md`、`docs/current/data.md`、`docs/current/quality.md`。

## 非范围

- 不实现 memory detail 追加到 existing memory 的 UI 语义；当前 Memory detail `Record memory` 仍不声称 append-to-memory。
- 不新增 STT、AI transcript、agent runtime、network、API key、photo/video/file/film 能力。
- 不创建 generic recording orchestrator、generic IPC bridge、generic service layer。
- 不为了旧 direct `recordingId` public API 做兼容路径；Reo 仍是 pre-launch。
- 不引入 wavesurfer.js 或重做 playback UI；Task 10 承接本地 playback/editor 体验。

## Source / research notes

- Context7 `/electron/electron`：Electron permission handling 需要 `setPermissionRequestHandler` / `setPermissionCheckHandler`，`media` 权限可根据 trusted sender、origin、frame 和 `mediaType` deny/allow。
- Context7 `/mdn/content`：MediaRecorder stop flow 依赖 `dataavailable` 和 `stop` event；MediaStream cleanup 应停止 tracks。
- 当前 Reo 权限实现已经在 main process 用 one-shot microphone intent、trusted sender、main frame 和 audio-only media type gate 保护。

## RED targets

- Renderer finalize 后调用 `saveTranscript`、`saveReflections`、`readRecordingAudioManifest`、`readRecordingAudioChunk` 时未传 `memoryId`。
- Workspace contract 允许 read/save/detail request 只带 `recordingId`。
- Main read/save helper 可在缺少 `memoryId` 时通过全局 `recordingId` lookup 读取 finalized recording。

## GREEN target

- Renderer `editing` state 携带 finalized `memoryId` 和 `recordingId`，playback/autosave request payload 使用 nested identity。
- Public workspace contract 为 finalized read/save/detail 使用 nested recording request schema。
- Main helper 使用 `memoryRecordingDirectory(rootPath, memoryId, recordingId)` 作为 finalized read/save target，并继续拒绝 duplicate finalized recording id。
- Existing draft append/finalize/discard API 保持 `recordingId` 事务语义。
- Draft markdown save 使用独立 `saveRecordingDraftMarkdown`，finalized markdown save 使用必填 `memoryId` 的 `saveRecordingMarkdown`。
- Finalized target resolver 复用 `readFinalizedRecordingSummary` 做 recording metadata/audio file truth 校验。

## 验证命令

```bash
npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/recordingMachine.test.ts
npm run test:main
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
git status --short
```

## 停止条件

- 收紧 request schema 需要重写 main transaction 或新增 generic bridge。
- nested identity 与现有 recovery/duplicate guard 出现 unresolved BLOCKER/MAJOR。
- Electron permission sequencing 与 Context7/当前安全边界冲突。

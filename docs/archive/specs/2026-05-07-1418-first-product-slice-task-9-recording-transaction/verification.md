# Verification

## RED

- `npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx`
  - 结果：失败。
  - 失败点：`saveTranscript`、`saveReflections`、`readRecordingAudioManifest`、`readRecordingAudioChunk` payload 缺少 finalize 返回的 `memoryId`。
- `npm run test:main`
  - 结果：失败。
  - 失败点：`workspaceRecordingReadRequestSchema` 尚未导出，workspace contract 未表达 finalized read/save/detail 必须携带 `memoryId + recordingId`。

## GREEN

- `npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/recordingMachine.test.ts src/renderer/src/workspace/workspaceApi.test.ts`
  - 结果：通过，3 个文件 34 个测试通过。
- `npm run test:main`
  - 第一次 GREEN 后结果：失败，249 个 main tests 中 2 个失败。
  - 修复点：detail 读取恢复 finalized metadata 1 MiB 上限；audio read cache 测试改为当前 explicit memory identity 下不做 global lookup。
- `npm run test:main`
  - 结果：通过，249 个测试通过。

## REFACTOR / simplify

- finalized read/detail/save public contract 使用 `workspaceRecordingReadRequestSchema`，避免继续暴露 recordingId-only finalized public path。
- renderer `editing` state 只新增必要的 `memoryId`，不引入 drawer session state、generic recording target 或 orchestrator。
- main read/save helper 对 finalized path 直接解析 `memories/<memoryId>/recordings/<recordingId>/`，draft markdown save 保持 draft transaction path。
- metadata 1 MiB 上限保留在 recording metadata read helper，不为每个 caller 增加重复保护。
- `$ycksimplify` quality MAJOR 修复：`saveRecordingMarkdown` 改为 finalized 必填 `memoryId` API，draft 保存拆为 `saveRecordingDraftMarkdown`，避免漏传 `memoryId` 时静默走 draft path。
- `$ycksimplify` reuse MAJOR 修复：finalized target resolver 复用 `readFinalizedRecordingSummary(rootPath, memoryId, recordingId)` 做 audio bytes/file truth 校验，再读取 full metadata 供 detail 返回。
- `$ycksimplify` efficiency 审查：无 BLOCKER/MAJOR/MINOR。
- 修复后验证：`npx tsc -p tsconfig.main.test.json --noEmit && npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/recordingMachine.test.ts src/renderer/src/workspace/workspaceApi.test.ts && npm run test:main` 通过，renderer 3 文件 34 测试通过，main 249 测试通过。
- 完整验证：`npm run verify:quick` 通过，包含 typecheck、main 249 tests、renderer 14 files / 83 tests、lint 和 format check。

## Fixed gates

- Context7 已用于 Electron permission 和 MDN MediaRecorder 顺序核对；本 task 未修改 mic permission sequencing，只收紧 finalized recording identity。
- Claude CLI 对抗审查已尝试执行，当前返回额度限制：`You've hit your limit · resets 3:40pm (America/Los_Angeles)`。
- 仍待最终门禁：`git diff --check`、`diff -u AGENTS.md .claude/CLAUDE.md`、`find docs/specs -mindepth 1 -maxdepth 1 -print`、归档后 clean status。

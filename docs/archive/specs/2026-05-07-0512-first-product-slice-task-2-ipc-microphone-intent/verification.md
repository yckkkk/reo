# 验证

## 初始状态

- Task 1 已归档并提交：`760e0c9`。
- `git status --short` 空输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print` 在创建本 spec 前为空。

## RED/GREEN/REFACTOR 记录

- RED，2026-05-07 05:18 PDT：
  - `npm run test:main` FAIL，TypeScript 编译失败，缺少 `security.ts` 的 microphone intent helpers、`workspaceIpc.ts` 的 begin/clear/getMemoryDetail handlers、preload bridge methods。
  - `npx vitest run src/renderer/src/workspace/workspaceApi.test.ts` FAIL，`getMemoryDetail is not a function`。
- GREEN，2026-05-07 05:26 PDT：
  - 新增显式 channels：`workspace:getMemoryDetail`、`workspace:beginMicrophoneIntent`、`workspace:clearMicrophoneIntent`。
  - `security.ts` 新增 sender-scoped one-shot microphone intent、TTL、consume/clear、permission check/request decision；permission check 不 grant，request 先消费 intent 再判断 trusted audio-only。
  - `workspaceIpc.ts` 新增 memory detail 与 microphone intent handlers；begin/clear 使用 `event.sender.id`，并校验 workspace handle owner。
  - preload 和 renderer API 只暴露显式方法，不暴露 generic invoke/send。
  - `npm run test:main` PASS：235 个 main tests 全部通过。
  - `npx vitest run src/renderer/src/workspace/workspaceApi.test.ts` PASS：1 个 renderer targeted test 通过。
- 对抗审查后 RED，2026-05-07 05:41 PDT：
  - `npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx` FAIL：3 个新增测试失败，证明 overlay 未先 `beginMicrophoneIntent`、begin 失败仍 start media、media start failure 未 clear intent。
  - `npm run test:main -- workspaceIpc.test.ts` FAIL：新增 `getMemoryDetail stops when the workspace lock is lost during detail read` 失败，实际仍返回 ok detail。
- 对抗审查后 GREEN/REFACTOR，2026-05-07 05:45 PDT：
  - `RecordingOverlay` 先 await `beginMicrophoneIntent`，成功后才创建 draft 和启动 media；begin 失败进入 failed 且不创建 draft；draft failure、media start failure 或 stale session clear matching pending intent。
  - `readMemoryDetail` 接收 `assertWorkspaceUsable`，在 memory/detail read 前后与每个 recording summary 前后重新断言 lock usability。
  - 新增 `workspaceMemoryDetailResponseSchema`，返回前 strip raw path/unknown fields。
  - `npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx` PASS：20 个 tests 全部通过。
  - `npm run test:main -- workspaceIpc.test.ts` PASS：236 个 main tests 全部通过。
  - `npm run test:main -- workspaceContract.test.ts workspaceIpc.test.ts` PASS：237 个 main tests 全部通过。
- Pending intent cleanup GREEN/REFACTOR，2026-05-07 05:51 PDT：
  - `security.ts` 改为 sender keyed pending intent store，并新增 workspace-handle/all cleanup helpers。
  - `workspace:close` 走显式 handler，成功关闭后清理该 handle 的 pending microphone intents；window teardown `closeAllWorkspaceHandles` 清理全部 pending intents。
  - app shell scheme/host 移到无 Electron 副作用的 shared constants。
  - `npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/workspaceApi.test.ts` PASS：21 个 renderer tests 全部通过。
  - `npm run test:main -- securityPolicy.test.ts workspaceIpc.test.ts workspaceContract.test.ts appLifecycleSource.test.ts` PASS：240 个 main tests 全部通过。
- 第二轮审查后 RED，2026-05-07 06:05 PDT：
  - `npm run test:main -- workspaceIpc.test.ts` FAIL：新增 3 个 tests 失败，证明 clear 在 lock lost 后返回 `ERR_WORKSPACE_LOCK_LOST`，close 在 lock lost 后返回 `ERR_WORKSPACE_LOCK_LOST`，close release failure 后 pending intent 仍可被 permission request 消费。
- 第二轮审查后 GREEN/REFACTOR，2026-05-07 06:10 PDT：
  - `WorkspaceHandleStore` 新增 `requireOwnedHandle`，只校验 handle 存在、sender owner 和 workspaceId，不要求 lock usable；所有文件读写路径仍在 `requireHandle` 或 `assertUsable` 中校验 lock usability。
  - `workspace:clearMicrophoneIntent` 使用 owner-only lookup，允许 lock lost 后清理 matching pending intent。
  - `workspace:close` owner 匹配后先清 pending intent，再释放 lock；release failure 返回错误但不保留 pending authorization。
  - `npm run test:main -- workspaceIpc.test.ts workspaceHandles.test.ts securityPolicy.test.ts` PASS：243 个 main tests 全部通过。
- 最终 subagent MINOR 收口，2026-05-07 06:31 PDT：
  - 新增 subframe microphone permission request 负向测试。
  - 新增 `closeAllWorkspaceHandles()` 直接清理 pending microphone intents 测试。
  - 更新 `docs/current/flow.md` 当前 IPC request flows 列表，补 memory detail 与 microphone intent begin/clear。
  - `npm run test:main -- securityPolicy.test.ts workspaceIpc.test.ts appLifecycleSource.test.ts workspaceHandles.test.ts` PASS：245 个 main tests 全部通过。
- Codex CLI `$ycksimplify` 最终审查 RED，2026-05-07 06:44 PDT：
  - `npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/workspaceApi.test.ts && npm run test:main -- workspaceIpc.test.ts workspaceContract.test.ts` FAIL：新增 overlay sequencing test 证明旧顺序为 `create-draft`、`begin-intent`、`media-start`；新增 draft failure cleanup test 证明 intent 未清理。
- Codex CLI `$ycksimplify` 修复 GREEN/REFACTOR，2026-05-07：
  - `workspaceMicrophoneIntentResponseSchema`、renderer `reoWorkspace` type 和 main response contract 只暴露 `{ registered: true }`。
  - `RecordingOverlay` 改为 begin intent -> create draft -> media start；draft failure clear intent。
  - `workspaceApi.test.ts` 补 `getMemoryDetail` 和 `clearMicrophoneIntent` 精确 wrapper 断言；contract test 确认 token-like 字段被 strip。
  - `npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/workspaceApi.test.ts` PASS：22 个 renderer tests 全部通过。
  - `npm run test:main -- workspaceIpc.test.ts workspaceContract.test.ts securityPolicy.test.ts` PASS：246 个 main tests 全部通过。
- Claude CLI MINOR 简化修复，2026-05-07：
  - `withWorkspaceHandleRequest` 改为直接复用 `handleStore.requireHandle`。
  - `npm run test:main -- workspaceIpc.test.ts workspaceContract.test.ts securityPolicy.test.ts` PASS：246 个 main tests 全部通过。
- Codex CLI `$ycksimplify` 最终复审后 RED，2026-05-07：
  - `npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx` FAIL：新增 2 个 tests 失败，证明 begin resolve after unmount 未 clear pending intent，draft creation pending 时 unmount 未 clear pending intent，也没有在 draft resolve 后 discard stale draft。
- Codex CLI `$ycksimplify` 最终复审后 GREEN/REFACTOR，2026-05-07：
  - `RecordingOverlay` 用 pending microphone intent ref 跟踪 acquiring authorization；unmount/workspace handle 切换会 clear pending intent 并使旧 recording session 失效。
  - begin resolve 后若 session stale，立即 clear intent 且不创建 draft；draft resolve 后若 session stale，clear intent、discard draft 且不启动 media。
  - `npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/workspaceApi.test.ts` PASS：24 个 renderer tests 全部通过。
  - `npm run test:main -- workspaceIpc.test.ts workspaceContract.test.ts securityPolicy.test.ts` PASS：246 个 main tests 全部通过。
- Codex CLI `$ycksimplify` 聚焦复审后 RED，2026-05-07：
  - `npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx` FAIL：新增 media start pending unmount test 失败，证明 draft 已创建且 media start pending 时 teardown 没有 discard draft。
- Codex CLI `$ycksimplify` 聚焦复审后 GREEN/REFACTOR，2026-05-07：
  - `RecordingOverlay` cleanup 会在 unmount/workspace handle change 时停止已有 controller 并 discard active draft；media start resolve 后 stale controller 仍会 stop。
  - 新增 workspace handle change during draft creation targeted test，覆盖 replacement 路径。
  - `npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/workspaceApi.test.ts` PASS：26 个 renderer tests 全部通过。
  - `npm run test:main -- workspaceIpc.test.ts workspaceContract.test.ts securityPolicy.test.ts` PASS：246 个 main tests 全部通过。
- Codex CLI `$ycksimplify` 最终聚焦复审，2026-05-07：
  - PASS：无 BLOCKER/MAJOR。
  - MINOR：media start pending + workspace handle change 缺单独 targeted test；当前由同一 cleanup effect 和 unmount pending media test 覆盖，非阻断。
  - MINOR：固定门禁仍待执行。

## 固定门禁

- 2026-05-07 05:33 PDT：
  - `npm run verify:quick` PASS：main 235、renderer 39、typecheck、lint、format 全部通过。
  - `git diff --check` PASS，空输出。
  - `diff -u AGENTS.md .claude/CLAUDE.md` PASS，空输出。
  - `find docs/specs -mindepth 1 -maxdepth 1 -print` PASS，只列出 `docs/specs/2026-05-07-0512-first-product-slice-task-2-ipc-microphone-intent`。
- 修复后固定门禁，2026-05-07：
  - `npm run verify:quick` PASS：typecheck、main 246、renderer 46、lint、format 全部通过。
  - `git diff --check` PASS，空输出。
  - `diff -u AGENTS.md .claude/CLAUDE.md` PASS，空输出。
  - `find docs/specs -mindepth 1 -maxdepth 1 -print` PASS，只列出 `docs/specs/2026-05-07-0512-first-product-slice-task-2-ipc-microphone-intent`。

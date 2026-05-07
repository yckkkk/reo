# 任务 1：Workspace 文件真源

时间：2026-05-06 12:54 America/Los_Angeles

## 目标

把 first product slice 的 workspace 内容真源从当前基础 recording list 扩展为产品级 durable memory 文件结构：

- `memories/<memoryId>/memory.json` 是 memory 元数据真源。
- `memories/<memoryId>/recordings/<recordingId>/` 是 finalized recording 真源。
- `.reo/index.json` 只做可重建投影，不替代用户内容真源。
- recording draft finalize 必须通过 staging、marker、fsync、no-replace expose 和 parent fsync 暴露 durable recording。
- title update、append、recover 和 rebuild 必须 file truth first，projection second。

## 执行权威

- `docs/current/data.md`
- `docs/current/flow.md`
- `docs/initiatives/2026-05-06-first-product-slice/implementation-plan.md`
- `docs/initiatives/2026-05-06-first-product-slice/plan.md`
- `docs/initiatives/2026-05-06-first-product-slice/tasks.md`
- 源码事实

Archived design-hardening spec 只作为背景证据，不作为本 task 的执行权威。

## 范围

允许修改：

- `README.md`
- `package.json`
- `package-lock.json`
- `src/main/directoryIdentity.ts`
- `src/main/memoryFiles.ts`
- `src/main/atomicWorkspaceFile.ts`
- `src/main/index.ts`
- `src/main/workspaceContract.ts`
- `src/main/workspaceFiles.ts`
- `src/main/recordingDrafts.ts`
- `src/main/workspaceIpc.ts`
- `src/main/workspaceHandles.ts`
- `src/main/workspaceLock.ts`
- `src/main/workspacePaths.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/workspace/RecordingOverlay.tsx`
- `src/renderer/src/types/reoWorkspace.d.ts`
- `src/renderer/src/App.test.tsx`
- `src/renderer/src/workspace/RecordingOverlay.test.tsx`
- `src/renderer/src/workspace/WorkspaceHome.test.tsx`
- `src/renderer/src/workspace/workspaceApi.test.ts`
- `src/renderer/src/workspace/ForbiddenCapabilities.test.tsx`
- `test/main/appLifecycleSource.test.ts`
- `test/main/memoryFiles.test.ts`
- `test/main/recordingDrafts.test.ts`
- `test/main/recordingReads.test.ts`
- `test/main/workspaceContract.test.ts`
- `test/main/workspaceFiles.test.ts`
- `test/main/workspaceHandles.test.ts`
- `test/main/workspaceIpc.test.ts`
- `test/main/workspaceLock.test.ts`
- `test/main/workspacePaths.test.ts`
- `docs/current/architecture.md`
- `docs/current/data.md`
- `docs/current/electron.md`
- `docs/current/flow.md`
- `docs/current/frontend.md`
- `docs/current/quality.md`
- `docs/initiatives/README.md`
- `docs/initiatives/2026-05-06-first-product-slice/*`
- `docs/archive/initiatives/2026-05-06-first-product-slice-superseded-pre-hardening/*`
- `docs/archive/specs/2026-05-06-0912-first-product-slice-product-grade-design-hardening/*`
- 本 task spec

禁止：

- Renderer 视觉 UI/surface 改动；本 task 只允许 duration、session projection、types 和对应行为测试同步。
- 新依赖安装。
- Drizzle/SQLite activation。
- generic runtime、generic service layer、generic IPC bridge。
- 显示或实现 photo、video、file、film、AI generation、global search、auth user、contact/entity graph。

## TDD 执行方式

本 task 必须按垂直 tracer 执行，不按计划中的横向批量 RED 执行：

1. 写一个行为测试。
2. 运行 targeted main test，确认 RED。
3. 写最小实现到 GREEN。
4. 重复下一个行为。
5. 全部行为 GREEN 后执行 `/simplify` 简化审查和 REFACTOR。
6. REFACTOR 后重跑 targeted tests 和固定门禁。

## 行为清单

- finalize draft into durable memory directory。
- title update file truth first，再 rebuild index projection。
- finalize 失败时保留 draft，且不留下 durable partial。
- existing memory append 在 index rebuild 失败时 rollback。
- durable memory directory symlink guard。
- atomic workspace write fsync temp file 和 parent directory。
- interrupted recording finalize recovery 不提升 partial durable files。
- recovery 修复 missing finalized recording reference。
- rebuild index 只读取 schema、status、ownership 和 audio bytes 匹配的 finalized recording。
- finalize transaction 在暴露 durable recording 前 fsync staging contents。
- recovery 删除 stale draft 后再清除 durable target marker。
- 重复 `memoryId` 或重复 durable `recordingId` 不得覆盖或删除既有用户文件。
- 同一 `memoryId` 并发 append 至少一个失败并保留 draft，不得 last-writer-wins 丢失 recording。
- 保存 transcript/reflections 后刷新 `.reo/index.json` 的 `hasTranscript` / `hasReflections` 投影。
- open workspace snapshot 保留临时 `recordings[]` 兼容投影，直到 renderer Home 改为直接消费 `memories[]`。
- finalized recording metadata 的 title、duration、audio byte 投影字段必须通过 schema 校验。
- recovery 不得跟随 symlinked `memories/<memoryId>/recordings/` 或 symlinked `memories/<memoryId>/recordings/<recordingId>` leaf directory，也不得删除 symlink target。
- initialize/open/lock 不得跟随 symlinked `.reo`，也不得把 workspace metadata 写到 workspace 外。
- IPC initialize 遇到已有 `AGENTS.md`、dangling `AGENTS.md` symlink 或任何 `AGENTS.md` symlink 条目，必须在 lock 前返回 conflict，不得留下 `.reo/workspace.lock`、`.reo/` 或 `memories/`。
- IPC initialize/open 在获取 lock 后如果后续 workspace 文件写入、recovery、index rebuild、handle registration 或 response parse 抛异常，必须释放 lock 并返回错误信封。
- IPC open 遇到非 Reo directory、缺失 metadata 或 corrupt metadata 必须在 lock 前返回 metadata invalid，不得留下 `.reo/workspace.lock`。
- IPC open 遇到 unsafe `memories/`、`.reo/drafts` 或 `.reo/drafts/recordings` 必须在 lock 前返回 unsafe path，不得留下 `.reo/workspace.lock`。
- `memories/` 为普通文件或 symlink 时，initialize 必须在 lock 前返回 unsafe path，不得留下 partial `.reo`。
- `.reo/drafts` 或 `.reo/drafts/recordings` 为 symlink 或非目录时，initialize 必须在 lock 前返回 unsafe path，不得写到 workspace 外。
- Draft `audio.webm` 为 symlink 或非文件时，append chunk 必须返回 unsafe path，不能写到 workspace 外，也不能推进 draft metadata。
- Draft create 在 leaf recording directory 创建后、写入 audio/metadata 前必须重新解析完整 `.reo/drafts/recordings/<recordingId>` path 并复核 leaf identity；ancestor swap 时必须失败并且只清理自己创建的空 leaf directory。
- Finalize 在创建 `memories/<memoryId>/recordings/` 前后必须拒绝 memory 父目录符号链接替换，保留 draft，且不得在 workspace 外创建 staging tree。
- Finalize 在复制 draft source 前必须重新走完整 workspace child containment，复核 `.reo/drafts/recordings` ancestor 和 `<recordingId>` leaf directory，不得跟随任一层 symlink。
- Finalize 在 expose staging 前必须重新走完整 workspace child containment，复核 `memories/<memoryId>/recordings` parent 和 staging path；最终暴露必须在已验证 parent 内重验 target missing，再创建 target directory 作为 no-replace reservation，先搬迁 marker 再搬迁 staging 内容，不得用 cached path 跟随 symlink parent 或替换 late-created target。
- Atomic file commit 和 finalize directory expose 如果在最终 commit 后发现 parent path identity 改变，必须删除本次暴露的 target 并失败，不能留下 workspace 外 final target；atomic replace 覆盖已有 metadata/index/markdown target 时，如果后置 validation 或 fsync 失败，必须恢复旧 target，不能删除唯一副本。
- Finalize 在 staging 暴露前失败时必须删除 `.reo-finalizing-*` staging tree；如果新 memory 尚未写入 `memory.json`，必须删除空 memory 目录，让同一 deterministic `memoryId` 可以重试。
- Finalize transaction directory fsync 遇到平台不支持的 directory fsync 错误时必须 best-effort 继续，不得误回滚已成功的 durable 写入。
- Finalized `audio.webm` 必须是 workspace 内普通文件；manifest/chunk read、lookup 和 index rebuild 必须拒绝 symlinked 或非文件 audio。
- Audio chunk read 必须在同一个 no-follow file handle 上完成 validation 与读取，不能在 validation 后重新按 path 打开文件。
- Audio manifest/chunk hot path 可以复用 main process 内的 finalized audio target cache；cache 只是进程内性能投影。Manifest 查找、cache revalidation 和 chunk read 必须检查 duplicate finalized id，避免 direct chunk IPC 绕过 manifest；最终读取仍必须用当前 directory identity、metadata `audioByteLength` 和 no-follow audio file handle 复核。
- Audio manifest/chunk read 必须在打开 finalized audio 前后绑定 finalized recording directory identity，ancestor swap 时不能返回 workspace 外字节。
- Finalize 必须保留 draft 中已保存的 `transcript.md` 和 `reflections.md` 内容，只能补齐缺失 markdown 文件。
- 打开现有 workspace 必须在返回 ready session 前补齐缺失的 `memories/` 和 `.reo/drafts/recordings/` 托管目录；symlink 或非目录仍必须拒绝。
- 打开现有 workspace 在托管目录创建、recovery、index reconciliation 和返回 session 前必须消费 lock usability；中途失去 lock/root/`.reo` ownership 时必须返回 lock lost，不得继续写入新的 `.reo` 或执行 recovery cleanup。
- 初始化 workspace 在托管目录创建和写入 `AGENTS.md`、workspace metadata、index 前必须消费 lock usability；中途失去 lock/root/`.reo` ownership 时必须返回 lock lost，不得继续写入新的 `.reo` 或 workspace files。
- 打开现有 workspace 在 target revalidation 或 metadata read 前后发现 lock/root/`.reo` ownership 已失效时，必须返回 lock lost，不得用 metadata invalid 或 unsafe path 掩盖真实 lock lost。
- 打开/重建遇到存在但不可读的 `memories/` 必须失败并保留既有 `.reo/index.json`，不能把 read error 写成空 workspace。
- Rebuild/open 扫描 `memories/` 时必须绑定 memories root directory identity；scan 前、scan 后和持久化 index 前 identity 变化必须失败并保留既有 index，不能协调为空 workspace；open reconciliation replace 必须在 workspace index queue 内重新读取当前 read model，不能用队列外 stale snapshot 覆盖 metadata refresh。
- Lock release 失败时，handle 可以保留用于返回错误和重试，但 underlying lock 必须标记 lost，后续 handle require 不能继续授权写入。
- IPC handler 从 handle store 取到 handle 后必须能再次执行 lock usability assertion；post-lock 或 delayed operation 前发现 lock/root/`.reo` identity 已 lost 时返回 lock lost，不授权后续文件写入。
- finalized recording 已存在时，即使 `.reo/drafts/recordings/<recordingId>/` 中仍有 stale draft，append 也必须返回 finalized error。
- renderer finalize session merge 必须同时更新当前 `memories[]` 投影和临时 `recordings[]` 兼容视图。
- renderer finalize 必须传 active recording clock duration，不能用向下取整的显示秒表值写 durable metadata。
- renderer playback close 或 unmount 后返回的 pending chunk result 不得创建 Blob URL。
- Finalize 删除 draft 后、draft parent fsync 和 marker unlink 前必须重新消费 delayed handle usability；中途 lock lost 时保留 durable marker，交给后续 recovery 收口。

## 验证命令

Targeted：

```bash
npm run test:main
```

提交前固定门禁：

```bash
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
git status --short
```

预期：

- `npm run verify:quick` PASS。
- `git diff --check` 无输出。
- `diff -u AGENTS.md .claude/CLAUDE.md` 无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print` 在 task 进行中只输出本 spec，归档后无输出。
- `git status --short` 只显示本 task owns 的文件。

## 停止条件

- 出现 plan 未覆盖的 Electron/security/data truth 冲突。
- RED 无法稳定复现。
- 需要安装依赖或扩大到 renderer/UI。
- 固定门禁失败且无法在本 task 范围内闭环。

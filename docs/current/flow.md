# 流程

本文档是行为时序、生命周期和恢复策略的当前真源。

## 当前事实

- 当前 IPC request flows 覆盖 `window.reoWorkspace` 的 choose、initialize、open、close、recording draft、audio manifest/chunk read、transcript/reflections save。
- 当前 preload/IPC consumer 覆盖 workspace 文件事务基础、create workspace UI flow、MediaRecorder recording overlay、autosave 和 playback。
- 当前没有 auth/session lifecycle。
- 当前没有 auth request、exchange、sign-out 或 user-update flow。
- 当前 workspace file write 使用 atomic temp file + rename 边界。
- 当前没有 DB migration 或 startup database lifecycle。
- 当前没有 background queue。
- 当前 Query flow 覆盖 workspace initialization 后 seed workspace snapshot cache；没有 optimistic update。
- 当前没有 optimistic update path。
- 当前 form submit flow 覆盖 create workspace title/description validation、folder selection、submit failure 保留输入和成功后 route state 切换。
- 当前没有 persisted client-state migration flow。
- 当前 main process 有最小 fatal exception path：`uncaughtException` 写入 `console.error` 后退出。
- 当前没有 structured diagnostic lifecycle 或 background error reporting flow。
- 当前没有 package、make、publish、release 或 update lifecycle。

## 技术方向

- 多步骤行为先建模，再实现。
- Command/event 名称必须具体、贴近 domain。
- 在没有真实 queue/stream 需求前，优先 request/response。
- 新 preload/IPC flow 只能跟随真实 renderer-to-main 特权需求创建。
- 在没有真实 schema 和 migration owner 前，不创建 DB migration flow。
- 每个 lifecycle transition 都必须有 owner。
- failure、cancellation、retry、recovery 行为必须明确。

## 状态管理纪律

- 状态机必须先描述 domain lifecycle，再决定使用 component state、reducer、React Hook Form、TanStack Query 或 Zustand。
- 不得把同一状态同时放入 component state、cache、form draft 和 metadata。
- UI 状态、form 状态、main-backed async data、durable file state 和 derived state 必须分开定义 owner。
- 复杂状态优先用 feature-local reducer 表达转移；只有跨 component subtree 且有真实 owner 时才引入 Zustand。
- 每个 state transition 必须说明触发事件、允许来源、失败行为、用户可见状态和验证路径。
- State ownership 必须用矩阵表达；每个 state row 只能有一个 source-of-truth owner，重复投影必须写同步方向和冲突处理。

## 第一产品切片流程决策

- Workspace directory selection flow：renderer 调用 `window.reoWorkspace.chooseDirectory()`；preload 调用 `workspace:chooseDirectory`；main 校验 channel、main frame、trusted URL 和 session；OS dialog canceled 返回 canceled；selected 返回 `selectionToken` 和 `displayPath`；真实路径只保存在 main 的 selection token store。
- Selection token lifecycle：issued、consumed、expired、sender-mismatch、not-found；成功 consume 和 expired 会删除 token，错误 sender 不删除 token；所有错误都不返回 path。
- Workspace initialize flow：renderer 传 selection token、title、description；main 校验 sender 和 token，canonicalize root，获取 single-writer lock，检测 `AGENTS.md` conflict，写入 workspace files，返回 opaque `workspaceHandle`、`workspaceId` 和 snapshot。
- Workspace open flow：renderer 传 selection token；main 校验 sender 和 token，canonicalize root，获取 single-writer lock，读取 metadata，corrupt index 可重建，corrupt metadata 阻断写入。
- Workspace close flow：renderer 传 `workspaceHandle`；main 校验 sender ownership，释放 lock 并撤销 handle。
- Workspace lifecycle 覆盖 none、creating、ready、missing、conflict、unsupported、failed。
- Workspace creation form lifecycle 覆盖 idle、folder selecting、canceled、validating、submitting、submitted、failed。
- Workspace creation renderer flow：title/description draft 属于 React Hook Form；folder selection token/displayPath 属于 component state；OS dialog canceled 不修改 draft 并把 focus 返回 folder picker；existing `AGENTS.md` conflict 显示 alert，不清空 draft 或 selected folder；initialize success seed workspace snapshot Query cache 并设置当前 renderer session state。
- Recording lifecycle 覆盖 idle、acquiring、recording、paused、stopping、editing、playback、failed；mic cancel 或 permission denial 从 acquiring 回到 idle，不创建 finalized recording。
- Recording overlay flow：home `Record memory` 打开 Radix Dialog；`Start recording` 创建 draft 后启动 browser MediaRecorder adapter；只有 MediaRecorder controller ready 后 UI 才进入 recording 并显示 pause/stop；audio data 通过 append queue 串行写入；pause 暂停 MediaRecorder 和 mock transcript timer；resume 恢复；stop 先停止 recorder，等待 MediaRecorder `stop` 事件和最后一次 `dataavailable` 转换完成，再等待 append queue 清空，最后 finalize。
- Audio append 必须按 sequence 串行 ack；每个 recording 只允许 1 个 append 在途，超量进入 failed recoverable。
- MediaRecorder chunk 转换失败、append 返回错误、append promise reject 或 media start 失败时，recording overlay 立即进入 failed，不调用 finalize，停止当前 recorder controller，discard 当前未完成 draft，并用 recording session token 忽略旧 recorder 后续 stale chunks；failed 状态允许用户重新开始一次新的 recording draft，retry 会清空旧 elapsed、mock transcript、reflections draft 和 saved refs。
- Finalized recording 不允许继续 append。Finalize 使用实际 `audio.webm` 文件大小写入 `recording.json`、返回值和 `.reo/index.json`，三者的 `audioByteLength` 必须一致。
- Finalize 更新 `.reo/index.json` 失败时，main process 将 `recording.json` 从 finalized 回滚到 draft，返回 `ERR_RECORDING_FINALIZE_FAILED` 和 `dataRetention: "draft-preserved"`。
- `.reo/index.json` 损坏、丢失或合法但陈旧时，open/rebuild 会扫描 finalized recording metadata 和 `audio.webm`，只从 metadata/audio 一致的 finalized recordings 协调 summary 并写回 index。
- 如果进程在 finalized metadata 写入后、`.reo/index.json` 写入前崩溃，后续 open 会把该 finalized recording 恢复到 workspace snapshot。
- `updateWorkspaceIndex` 在 update 函数成功前不会持久化 open/rebuild 协调结果；失败路径不改变已有合法 index。
- Finalize 必须等待最后一个 append ack，不得 duplicate stop 提前 finalize。
- Transcript 和 reflections 各自拥有独立 autosave lifecycle；save failure 显示 alert，保留 renderer draft，main atomic write 保留 previous disk file。
- Playback 先读 audio manifest，再按 chunk read 组装 Blob；renderer 只在 active playback 期间持有 Blob URL，并在 close/switch/unmount revoke。
- Workspace write 使用 single-writer lock；第二个 Reo writer 返回 locked error，stale lock 只能通过明确 recovery 处理。

## 时序规则

- 多步骤 write 必须有 transaction boundary。
- 改变 cached data 的 mutation 必须有 invalidation 或 rollback。
- TanStack Query mutation 必须定义 query key、invalidation scope、pending/error state 和 rollback 策略。
- Zustand persist 必须定义 storage、version、partialize/migrate 和 user-visible recovery。
- Form submit 必须定义 validation timing、submit owner、failure behavior 和 reset behavior。
- Background task 必须有 owner、trigger、cancellation、retry、error reporting。
- Diagnostic/background error flow 必须有 owner、trigger、redaction、retention、retry 和 failure behavior。
- Session/auth change 必须写明 caller、persistence effect、renderer visibility、recovery behavior。
- Better Auth Electron flow 必须先定义 system-browser request、PKCE/state、callback exchange、session persistence、renderer visibility、sign-out、error 和 recovery。
- Packaging flow 必须先定义 build、package、sign、notarize、make、publish、verify 的顺序和 failure behavior。
- Update flow 必须先定义 trigger、channel、metadata source、download/install timing、cancellation、retry、rollback、error reporting 和 renderer visibility。
- Concurrency-sensitive flow 必须写 race condition analysis。

## 禁止

- 禁止 generic event runtime。
- 禁止没有当前产品需求的 mailbox 或 queue runtime。
- 禁止没有 observability 的 hidden background job。
- 禁止没有 signed packaged app 和 release metadata 的 updater polling。
- 禁止没有 rollback 的 optimistic UI path。
- 禁止依赖未记录 timing assumption 的 async flow。

## 变更门禁

任何 lifecycle、command flow、IPC ordering、transactions、concurrency、rollback、background jobs、recovery behavior 改动，都必须更新本文档。

# 流程

本文档是行为时序、生命周期和恢复策略的当前真源。

## 当前事实

- 当前有一个 IPC request flow：`window.reoWorkspace.chooseDirectory()`。
- 当前 preload/IPC consumer 只覆盖 workspace 目录选择，不初始化 workspace、不写文件。
- 当前没有 auth/session lifecycle。
- 当前没有 auth request、exchange、sign-out 或 user-update flow。
- 当前没有 transaction boundary。
- 当前没有 DB migration 或 startup database lifecycle。
- 当前没有 background queue。
- 当前没有 query invalidation 或 mutation flow。
- 当前没有 optimistic update path。
- 当前没有 form submit、form draft 或 field validation flow。
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
- Selection token lifecycle：issued、consumed、expired、sender-mismatch、not-found；consume 后立即删除，expired 或错误 sender 都不返回 path。
- Workspace lifecycle 覆盖 none、creating、ready、missing、conflict、unsupported、failed。
- Workspace creation form lifecycle 覆盖 idle、folder selecting、canceled、validating、submitting、submitted、failed。
- Recording lifecycle 覆盖 idle、acquiring、recording、paused、stopping、editing、playback、failed；mic cancel 或 permission denial 从 acquiring 回到 idle，不创建 finalized recording。
- Audio append 必须按 sequence 串行 ack；每个 recording 只允许 1 个 append 在途，超量进入 failed recoverable。
- Finalize 必须等待最后一个 append ack，不得 duplicate stop 提前 finalize。
- Transcript 和 reflections 各自拥有独立 autosave lifecycle；save failure 必须保留 renderer draft 和 previous disk file。
- Playback 先读 audio manifest，再 chunk read，renderer 只在 active playback 期间持有 Blob URL。
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

# 流程

本文档是行为时序、生命周期和恢复策略的当前真源。

## 当前事实

- 当前没有 IPC request flow。
- 当前没有需要建模的 preload/IPC consumer。
- 当前没有 auth/session lifecycle。
- 当前没有 transaction boundary。
- 当前没有 DB migration 或 startup database lifecycle。
- 当前没有 background queue。
- 当前没有 optimistic update path。

## 技术方向

- 多步骤行为先建模，再实现。
- Command/event 名称必须具体、贴近 domain。
- 在没有真实 queue/stream 需求前，优先 request/response。
- 在没有真实 renderer-to-main 特权需求前，不创建 preload/IPC flow。
- 在没有真实 schema 和 migration owner 前，不创建 DB migration flow。
- 每个 lifecycle transition 都必须有 owner。
- failure、cancellation、retry、recovery 行为必须明确。

## 时序规则

- 多步骤 write 必须有 transaction boundary。
- 改变 cached data 的 mutation 必须有 invalidation 或 rollback。
- Background task 必须有 owner、trigger、cancellation、retry、error reporting。
- Session/auth change 必须写明 caller、persistence effect、renderer visibility、recovery behavior。
- Concurrency-sensitive flow 必须写 race condition analysis。

## 禁止

- 禁止 generic event runtime。
- 禁止没有当前产品需求的 mailbox 或 queue runtime。
- 禁止没有 observability 的 hidden background job。
- 禁止没有 rollback 的 optimistic UI path。
- 禁止依赖未记录 timing assumption 的 async flow。

## 变更门禁

任何 lifecycle、command flow、IPC ordering、transactions、concurrency、rollback、background jobs、recovery behavior 改动，都必须更新本文档。

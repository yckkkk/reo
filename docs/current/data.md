# 数据

本文档是数据结构与状态归属的当前真源。

## 当前事实

- 当前没有 database schema。
- 当前没有真实 durable data contract。
- 当前没有 Drizzle config。
- 当前没有 Better Auth tables。
- 当前没有 auth session persistence owner。
- 当前没有 TanStack Query keys。
- 当前没有 Zustand stores。
- 当前没有 React Hook Form form owner。
- 当前没有 Zod runtime schema owner。

## 技术方向

- 本地 SQLite 使用 Drizzle ORM + `better-sqlite3`。
- 没有真实 schema、关系和 migration owner 前，不引入 Drizzle、`better-sqlite3`、Drizzle config 或 migration directory。
- Auth/session foundation 使用 Better Auth 的 Electron 支持。
- 没有真实 session lifecycle、auth tables 和 secure persistence owner 前，不引入 Better Auth package 或 auth storage。
- Form、IPC、auth、persistence 边界使用 Zod 做运行时校验。
- Main/server-backed async data 使用 TanStack Query。
- 没有真实 main/server-backed async data consumer 前，不引入 TanStack Query provider、query keys 或 mutation cache。
- 非 server-backed 的本地 UI/client state 使用 Zustand。
- 没有跨 component subtree 的 client state owner 前，不引入 Zustand store。
- Form state 使用 React Hook Form。
- 没有真实 form submit/draft/validation owner 前，不引入 React Hook Form、resolver 或 form schema。

## Schema 规则

- 从产品实体和关系定义表，不从 UI screen 倒推表。
- 实现 migration 前必须写清每个 table relationship。
- 优先显式 foreign key 和 index，不靠隐式耦合。
- 不为同一 domain concept 建多个重复 table shape。
- 不创建 speculative columns 或 generic metadata bucket。
- Migration 必须可审查，并关联引入它的 spec。

## 状态归属

- Durable data 属于 SQLite。
- Main/server-backed async data 属于 TanStack Query。
- Ephemeral UI state 属于 component state 或 Zustand。
- Form drafts 在提交前属于 React Hook Form。
- Derived state 默认计算，不存储；只有明确性能或一致性理由才存储。

## Query 规则

- Query keys 引入时必须稳定、命名清楚，并在本文档记录。
- 改变底层数据的 mutation 必须定义 invalidation。
- Optimistic update 必须在 `flow.md` 写 rollback。
- 不得为 main/server-backed data 绕过 TanStack Query 写临时 fetching。
- Zod 只用于不可信 runtime boundary，不用于重复 TypeScript 类型。

## 变更门禁

任何 schema、表关系、auth tables、migrations、query keys、cache ownership、Zustand ownership 改动，都必须更新本文档。

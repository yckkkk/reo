# 数据

本文档是数据结构与状态归属的当前真源。

## 当前事实

- 当前没有 database schema。
- 当前没有 Drizzle config。
- 当前没有 Better Auth tables。
- 当前没有 TanStack Query keys。
- 当前没有 Zustand stores。

## 技术方向

- 本地 SQLite 使用 Drizzle ORM + `better-sqlite3`。
- Auth/session foundation 使用 Better Auth 的 Electron 支持。
- Form、IPC、auth、persistence 边界使用 Zod 做运行时校验。
- Main/server-backed async data 使用 TanStack Query。
- 非 server-backed 的本地 UI/client state 使用 Zustand。
- Form state 使用 React Hook Form。

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

## 变更门禁

任何 schema、表关系、auth tables、migrations、query keys、cache ownership、Zustand ownership 改动，都必须更新本文档。

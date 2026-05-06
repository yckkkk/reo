# 数据

本文档是数据结构与状态归属的当前真源。

## 当前事实

- 当前没有 database schema。
- 当前 durable data contract 是 workspace folder 文件。
- 当前没有 Drizzle config。
- 当前没有 Better Auth tables。
- 当前没有 auth session persistence owner。
- 当前 TanStack Query key 覆盖 workspace snapshot：`['workspace', 'snapshot', workspaceId]`。
- 当前没有 Zustand stores。
- 当前 React Hook Form form owner 覆盖 create workspace submit 前的 title/description draft。
- 当前 Zod runtime schema owner 是 workspace IPC contract 和错误信封。

## 技术方向

- 本地 SQLite 使用 Drizzle ORM + `better-sqlite3`。
- 没有真实 schema、关系和 migration owner 前，不引入 Drizzle、`better-sqlite3`、Drizzle config 或 migration directory。
- 每个 feature slice 都必须显式判断是否产生 DB schema、table relationship、query key、cache ownership、form owner、client state owner 或 durable file contract。
- 如果判断为不引入 DB schema，必须说明当前 durable source、恢复路径、未来触发 DB 的具体 pressure。
- Auth/session foundation 使用 Better Auth 的 Electron 支持。
- 没有真实 session lifecycle、auth tables 和 secure persistence owner 前，不引入 Better Auth package 或 auth storage。
- Form、IPC、auth、persistence 边界使用 Zod 做运行时校验。
- Main/server-backed async data 使用 TanStack Query。
- TanStack Query provider 当前只服务真实 main-backed workspace snapshot consumer。
- 非 server-backed 的本地 UI/client state 使用 Zustand。
- 没有跨 component subtree 的 client state owner 前，不引入 Zustand store。
- Form state 使用 React Hook Form。
- React Hook Form 当前只服务真实 create workspace form submit、draft 和 validation owner。

## Schema 规则

- 从产品实体和关系定义表，不从 UI screen 倒推表。
- 实现 migration 前必须写清每个 table relationship。
- 设计表时必须先写 entity、relationship、cardinality、ownership、lifecycle、delete/update effect，再写 columns。
- 优先显式 foreign key 和 index，不靠隐式耦合。
- 不为同一 domain concept 建多个重复 table shape。
- 不创建 speculative columns 或 generic metadata bucket。
- Migration 必须可审查，并关联引入它的 spec。

## 状态归属

- 用户记忆内容的 durable artifact source 属于 workspace files。
- `.reo` metadata 和 rebuildable index 属于 workspace folder，由 Reo 管理。
- SQLite 只有在引入后才拥有明确的 app index、relationship、query、session 或 processing state；不得替代 workspace files 成为用户内容真源。
- Main/server-backed async data 属于 TanStack Query。
- Ephemeral UI state 属于 component state 或 Zustand。
- Form drafts 在提交前属于 React Hook Form。
- Derived state 默认计算，不存储；只有明确性能或一致性理由才存储。

## 第一产品切片数据决策

- First product slice 的用户内容真源是 workspace folder；不引入 Drizzle schema、SQLite file、migration directory 或 DB-backed content truth。
- Workspace stable files 包括 `AGENTS.md`、`.reo/workspace.json`、`.reo/index.json`、`recordings/<id>/audio.webm`、`transcript.md`、`reflections.md`、`recording.json`。
- `.reo/index.json` 是可重建 UI index，不是用户内容真源。
- `.reo/workspace.lock` 是 volatile runtime lock artifact，不进入 Codex read-only validation 的稳定 hash 范围。
- Query keys 使用 stable `workspaceId` 和 `recordingId`；`workspaceHandle` 是 main memory capability，不进入 query key、不写入文件、不跨 app restart 持久化。
- TanStack Query 只拥有 main-backed workspace snapshot 和 recording detail cache；active recording lifecycle、chunk sequence、editor draft 和 Blob URL 不进入 query cache。
- React Hook Form 只拥有 create workspace submit 前的 form draft。
- Create workspace folder selection token 和 displayPath 属于 form component state；selection token 只用于一次 initialize/open request，不进入 Query cache 或 durable files。
- Zod 当前用于 workspace IPC request/response、workspace metadata、recording metadata、audio read request 和错误信封。
- `chooseDirectory` 阶段不产生 durable data contract；真实路径只暂存在 main process selection token store，不写入文件、不进入 renderer、不进入 query key。
- Workspace 初始化写入 `AGENTS.md`、`.reo/workspace.json`、`.reo/index.json` 和 `recordings/`；如果已有 `AGENTS.md`，不得写入任何 workspace 文件。
- Recording draft 写入 `recordings/<recordingId>/recording.json` 和 `audio.webm`；finalize 后写入 `transcript.md` 和 `reflections.md`，并更新 `.reo/index.json`。

## 数据流设计纪律

- 每个 feature 必须先写 conceptual model，再决定是否需要 physical DB schema。
- 数据流必须写清 write owner、read owner、durable source、cache owner、mutation owner、invalidation 和 recovery。
- Workspace file、`.reo` metadata、rebuildable index、TanStack Query cache、component state 和 form state 不能存储同一事实的不同版本。
- 如果同一事实需要出现在多个位置，必须说明 source of truth、同步方向、冲突处理和丢失恢复。
- 不得因为未来可能查询就提前建表；也不得因为第一版小就省略实体、关系和字段语义设计。
- Durable file write 必须定义 atomic rename 边界、file fsync、parent directory fsync、跨平台差异、失败时 `.part` 状态和恢复策略。
- Workspace write 必须定义 single-writer 策略；同一 workspace 被多个 Reo window 或进程打开时，必须设计检测、拒绝或合并语义。

## Query 规则

- Query keys 引入时必须稳定、命名清楚，并在本文档记录。
- 改变底层数据的 mutation 必须定义 invalidation。
- Optimistic update 必须在 `flow.md` 写 rollback。
- 不得为 main/server-backed data 绕过 TanStack Query 写临时 fetching。
- Zod 只用于不可信 runtime boundary，不用于重复 TypeScript 类型。

## Slice 审查门禁

每个 spec 在进入实现前必须回答：

- 是否需要 DB schema；如果需要，实体和表关系是什么。
- 是否需要 migration；如果需要，foreign key、index、delete/update effect 是什么。
- durable source 是 workspace file、`.reo` metadata、SQLite，还是多者分工；谁是真源。
- 数据获取模式是什么：TanStack Query、direct component state、filesystem scan 或其他明确 owner。
- Query keys、mutation invalidation、optimistic update 和 rollback 是否定义。
- Form state、client state、server/main-backed state 的 owner 是否清楚。
- 文件夹结构是否有 source-of-truth、rebuildable index、用户文件和 Reo metadata 的边界。

## 变更门禁

任何 schema、表关系、auth tables、migrations、query keys、cache ownership、Zustand ownership 改动，都必须更新本文档。

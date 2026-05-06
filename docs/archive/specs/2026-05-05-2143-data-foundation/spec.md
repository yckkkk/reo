# 规格

## 当前事实

- HEAD：`2556f62 docs: define electron runtime readiness gate`。
- 工作区起始干净。
- `docs/specs` 起始为空。
- `docs/current/data.md` 记录当前没有 database schema、Drizzle config、auth tables、query keys 或 Zustand stores。
- `docs/current/flow.md` 记录当前没有 transaction boundary、auth/session lifecycle、background queue 或 optimistic update path。
- `docs/current/electron.md` 记录当前没有 preload bridge 或 IPC API，renderer 不得直接使用 Node/Electron API。
- 当前源码没有 DB module、schema file、migration directory、Drizzle config 或 SQLite access。
- 当前 `package.json` 没有 Drizzle、`better-sqlite3`、`drizzle-kit` 或 `@types/better-sqlite3`。

## 官方资料核对

- Context7：`/drizzle-team/drizzle-orm-docs`。
- Drizzle 官方文档：Drizzle Kit 基于 schema 生成 SQL migration，并通过 config 指定 dialect、schema path 和 migration 输出。
- Drizzle SQLite + `better-sqlite3` 文档：需要 `drizzle-orm`、SQLite driver、schema 和 database connection。
- `better-sqlite3` 官方文档：database file 打开/创建是同步操作，transaction function 会 commit 或在异常时 rollback，transaction function 不能跨 async tick。

## 判断

本 slice 不新增 DB。

理由：

- 没有可命名的 durable data contract。
- 如果现在安装 Drizzle 或创建 schema，只会产生空 persistence bucket。
- 没有 preload/IPC boundary，renderer 也不能访问 main-process SQLite。
- 当前 foundation 需要的是 schema/migration 启用门槛，而不是 runtime implementation。

## 成功标准

- `docs/current/data.md` 写清当前没有 durable data contract，因此不引入 Drizzle、`better-sqlite3`、schema 或 migration。
- `docs/current/flow.md` 写清当前没有 DB migration/startup lifecycle。
- 不新增 DB source、schema、migration、Drizzle config 或 SQLite file。
- 不修改 `package.json` 或 `package-lock.json`。
- 不修改 runtime code。
- `npm run verify:quick` 通过。
- `npm run build` 通过。
- `git diff --check` 通过。
- docs lifecycle checks 通过。
- 多轮 subagent review 和 Claude CLI review 通过。

## 非目标

- 不做 DB domain model。
- 不做 auth tables。
- 不做 migration runner。
- 不创建 database directory。
- 不安装 Drizzle、`better-sqlite3`、`drizzle-kit` 或 `@types/better-sqlite3`。
- 不新增 preload/IPC data bridge。
- 不做产品功能。

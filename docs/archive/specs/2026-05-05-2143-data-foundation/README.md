# Data Foundation

## 状态

Archived spec。

## 时间

2026-05-05 21:43 America/Los_Angeles。

## 目标

判断 Reo 是否已经存在真实、非产品功能的 durable data contract，足以引入 Drizzle、`better-sqlite3`、schema 和 migration。

## 结论

当前不引入 database layer。

原因：

- 当前没有产品实体或关系。
- 当前没有 auth/session persistence。
- 当前没有 settings、workspace、artifact 或 runtime state contract。
- 当前没有 renderer-to-main data access boundary。

因此本 slice 只记录启用门槛，不安装依赖、不创建空 schema、不创建空 migration。

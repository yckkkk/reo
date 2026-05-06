# Logging Error Foundation

## 状态

Archived spec。

## 时间

2026-05-05 22:34 America/Los_Angeles。

## 目标

判断 Reo 是否已经存在真实 diagnostic owner、error boundary 或 release/privacy/source-map 计划，足以引入 `electron-log` 或 Sentry。

## 结论

当前不引入 logging package 或 Sentry。

原因：

- 当前没有 release channel、packaging、source map upload 或 Sentry DSN。
- 当前没有 renderer error capture、preload bridge 或 IPC logging surface。
- 当前没有 background jobs、auth/DB/runtime flows 或用户可见错误 surface。
- 当前只有 main process bootstrap/protocol/dev-server/fatal exception 的最小 `console.warn/error` 诊断。

因此本 slice 只记录 error/logging/Sentry 启用门槛，不安装依赖、不初始化 telemetry、不创建 logging bridge。

# Auth Foundation

## 状态

Archived spec。

## 时间

2026-05-05 21:56 America/Los_Angeles。

## 目标

判断 Reo 是否已经具备引入 Better Auth Electron 支持的真实 session lifecycle、secure persistence 和 renderer visibility 边界。

## 结论

当前不引入 auth layer。

原因：

- 当前没有 auth/session lifecycle。
- 当前没有 database schema、Better Auth tables 或 durable session storage owner。
- 当前没有 preload/IPC bridge，renderer 不能安全请求 auth capability。
- 当前没有 web auth server/client、custom protocol、trusted origin、system-browser flow 或 product auth trigger。

因此本 slice 只记录启用门槛，不安装 Better Auth、不创建 auth tables、不创建 auth UI、不新增 preload/IPC。

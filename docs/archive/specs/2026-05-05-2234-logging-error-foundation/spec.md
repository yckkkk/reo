# 规格

## 当前事实

- HEAD：`4b12c76 docs: define component ui gate`。
- 工作区起始干净。
- `docs/specs` 起始为空。
- 当前没有 `electron-log`。
- 当前没有 Sentry。
- 当前没有 release channel、source map upload、DSN 或 privacy policy。
- 当前没有 renderer error capture。
- 当前没有 preload/IPC logging bridge。
- 当前没有 auth、DB、runtime、background job 或 product UI error surface。
- 当前 main process 只有 bootstrap/protocol/dev-server/fatal exception 的最小 `console.warn/error` 诊断。

## 官方资料核对

- Context7：`/getsentry/sentry-electron`。
- Sentry Electron 官方文档：`https://docs.sentry.io/platforms/javascript/guides/electron/`。
- Sentry Electron 需要 main process 初始化，renderer/preload 需要同批设计。
- contextIsolation + sandbox 下的 renderer forwarding 需要 preload bundle 或等价安全 bridge。
- Sentry 使用前必须设计 DSN、release、environment、source maps、privacy/scrubbing、sampling 和 process boundary。
- `electron-log` 官方 README：提供 main/renderer/preload entrypoints 和 file transport；preload entrypoint 只作为 bridge。

## 判断

本 slice 不新增 logging 或 Sentry。

理由：

- 没有真实 diagnostic owner。
- 没有 release/privacy/source-map 计划，Sentry 初始化会制造 telemetry surface。
- 没有 preload/IPC，不能安全引入 renderer logging/capture bridge。
- 当前无 background jobs、auth/DB/runtime flows，缺少需要持久日志的失败路径。
- 现有 `console.warn/error` 只覆盖 bootstrap 失败、安全策略警告和 fatal uncaught exception，暂不升级为 logging subsystem。

## 成功标准

- `docs/current/quality.md` 写清当前没有 logging/Sentry owner，以及启用门槛。
- `docs/current/electron.md` 写清当前不引入 renderer/preload logging or Sentry bridge。
- `docs/current/flow.md` 写清只有最小 fatal exception path，没有 structured diagnostic lifecycle/background error reporting flow。
- 不新增 `electron-log` 或 Sentry package。
- 不新增 logging source、Sentry init、preload bridge、IPC logging channel 或 renderer capture。
- 不修改 runtime code。
- `npm run verify:quick` 通过。
- `npm run build` 通过。
- `git diff --check` 通过。
- docs lifecycle checks 通过。
- 多轮 subagent review 和 Claude CLI review 通过。

## 非目标

- 不安装 `electron-log`。
- 不安装 Sentry packages。
- 不初始化 telemetry。
- 不创建 logging bridge。
- 不创建 renderer error capture。
- 不创建 source map upload 或 release pipeline。
- 不做 product error UI。

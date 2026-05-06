# Electron

Electron 是 Reo 的一等产品宿主，不是 thin shell。

## 当前事实

- Main process 位于 `src/main`。
- Renderer 位于 `src/renderer`。
- 当前没有 preload bridge。
- 当前没有 IPC API。
- 当前没有 renderer error capture、preload logging bridge 或 IPC logging channel。
- 当前没有 packaging、updater、signing、notarization、ASAR 或 fuse config。
- 当前没有 Forge config、makers、publishers、buildIdentifier、app bundle id、release channel 或 publish target。
- 当前构建权威是 `electron-vite`，不是 Electron Forge。
- 当前生产加载模型是自定义 `reo-app://renderer/index.html`。
- `package.json` 的 Electron entry 指向 `./out/main/index.js`。
- `out/` 是 `electron-vite` build output，不进入 git。

## 当前安全基线

这些是不变量，不能为了快速实现功能而放松：

- `app.enableSandbox()`
- `sandbox: true`
- `contextIsolation: true`
- `nodeIntegration: false`
- `nodeIntegrationInWorker: false`
- `nodeIntegrationInSubFrames: false`
- `webSecurity: true`
- `allowRunningInsecureContent: false`
- `webviewTag: false`
- 导航默认拦截非可信 URL
- `setWindowOpenHandler` 默认 deny
- 权限请求默认拒绝
- Dev server 只允许 loopback
- Packaged app 忽略 `ELECTRON_RENDERER_URL`
- 生产 CSP 不允许 `unsafe-inline` 或 `unsafe-eval`
- 自定义 protocol 必须保留 privileged scheme 注册时序、host allowlist、path containment、CSP 和 handler 注册时序

## 必须遵守

- 优先依据 Electron 官方 process model、security、context isolation、IPC、sandbox、protocol 文档。
- Renderer 永远按 Web app 写，不直接 import/use `electron`、`node:*`、`fs`、`path`、`child_process` 或需要 Node/OS 权限的 SDK。
- Preload 不是默认必需。只有 renderer 需要调用主进程特权能力时，才允许通过明确设计新增 preload。
- 当前没有真实 renderer 特权能力 consumer，因此不新增 preload 或 IPC。
- 当前没有 auth lifecycle、custom auth protocol 或 secure session persistence owner，因此不引入 Better Auth Electron bridge。
- 新增 preload 时，只能用 `contextBridge` 暴露窄 API。
- 禁止暴露 `ipcRenderer`、`electron`、`fs`、通用 `send(channel, ...args)` 或通用 command bus。
- IPC 必须是每个能力一个显式 channel/handler。
- 每个 IPC channel 必须有 owner、TypeScript contract、Zod 输入校验、`senderFrame` 校验、错误语义、取消或超时策略。
- 特权能力必须逐项授权、校验、记录，不允许 generic privileged proxy。
- 需要 Node/OS 权限的未来 runtime integration 必须进入 main process、utility process 或独立受控后端边界。
- 如果未来引入 custom session 或 partition，custom protocol 和 permission policy 必须注册到同一个 session。
- Better Auth Electron 只能在真实 auth slice 中引入，并且必须同批设计 custom protocol、trusted origin、preload bundle、IPC bridges、token/session exposure 和 renderer visibility。
- `electron-log` 或 Sentry 的 renderer/preload bridge 只能在真实 diagnostics slice 中引入。
- Diagnostics slice 必须同批定义 process boundary、sensitive data rules、redaction、retention、DSN/release/privacy/source-map 计划和 renderer visibility。

## Forge / electron-vite 边界

- 当前开发和构建使用 `electron-vite`。
- 当前 preview 使用 `electron-vite preview`。
- 不得把 Electron Forge snippets 混进当前 electron-vite 结构。
- 当前不安装或配置 Electron Forge、makers、publishers、`electron-updater` 或 `@electron/fuses`。
- 只有在 packaging slice 同批定义 app identity、platform targets、makers、artifact output、ASAR policy、fuses、signing/notarization、packaged launch verification 和 tracked-output checks 后，才引入 Forge 或 makers。
- 如果未来采用 Forge，必须整体设计 Forge Vite plugin 配置模型、entry、输出路径和 packaging 生命周期。
- `@electron/fuses` 必须在 package time、code signing 前执行；fuse policy 必须同批说明 ASAR integrity、only-load-from-ASAR、Node options、inspect flags 和 rollback 风险。
- ASAR policy 必须同批说明 packed/unpacked 边界、native module/resource 例外和 packaged app launch evidence。
- `electron-updater` 只能在已有 packaged artifact、publish provider、release metadata、signed/notarized app、logging/error owner 和 installed-app update test path 后引入。
- Updater 不得先创建 hidden polling、dev update feed、generic update IPC 或 UI shell。

## 验证规则

- 声明 Electron 基线关闭前，必须运行 `npm run verify:quick`。
- 涉及构建边界时，必须运行 `npm run build`。
- 涉及生产加载、CSP、protocol、navigation 或 permission baseline 时，必须运行 `npm start` 并记录 runtime 证据。
- Runtime 证据必须覆盖 production URL、CSP header、新窗口拒绝、外部导航拒绝和权限默认拒绝。

## 禁止

- 禁止 generic tool runtime。
- 禁止无当前 spec 的网关、语音链路或 agent runtime。
- 禁止 broad `window.api` dumping ground。
- 禁止无 schema、无 owner、无错误语义的 IPC channel。
- 禁止无用户可理解理由的 permission、file、system 或 shell access。
- 禁止为了接入 runtime 临时打开 Node integration、关闭 sandbox 或关闭 context isolation。

## 未来 Runtime 边界

未来 runtime integration 必须尊重 Electron 作为 workspace、sessions、queue、tools、artifacts、permissions、sources、MCP 和 runtime UI integration 的宿主。本文档不授权现在实现该层。

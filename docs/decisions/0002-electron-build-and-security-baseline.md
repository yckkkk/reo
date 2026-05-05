# 0002 Electron Build And Security Baseline

时间：2026-05-05 06:50 America/Los_Angeles
状态：已接受

## 决策

Reo 当前使用 `electron-vite` 作为开发、构建和 preview 权威。

Renderer 生产入口通过 `reo-app://renderer/index.html` 加载。该自定义 protocol 使用 secure 和 standard privileged scheme，保留 host allowlist、path containment 和 CSP。

Electron Forge、makers、publishers、signing、notarization、ASAR、fuses 和 updater 只在 packaging slice 中设计和引入。

当前不创建 preload bridge 或 IPC API。未来需要 renderer 调用特权能力时，必须通过窄 `contextBridge` API 和显式 IPC channel 暴露。

## 原因

- 当前工程只需要稳定的 Electron dev/build 基线。
- Packaging 生命周期会改变 entry、输出、ASAR、fuses、签名和发布边界。
- 空 preload、空 IPC 和 Forge config 会扩大当前 surface。
- Renderer 必须保持 Web app 边界。

## 影响

- `package.json` 的 Electron entry 指向 `./out/main/index.js`。
- `out/` 是本地 build output，不进入 git。
- 未来新增 IPC 必须定义 owner、contract、runtime validation、sender validation 和错误语义。
- 未来新增 custom session 或 partition 时，protocol policy 和 permission policy 必须注册到同一个 session。

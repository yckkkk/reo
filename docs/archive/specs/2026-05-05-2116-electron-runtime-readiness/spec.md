# 规格

## 当前事实

- HEAD：`54677d1 docs: define vitest activation gate`。
- 工作区起始干净。
- `docs/specs` 起始为空。
- 当前 main process 位于 `src/main`。
- 当前 renderer 位于 `src/renderer`。
- 当前没有 preload bridge。
- 当前没有 IPC API。
- 当前 renderer 是静态 shell，不读取文件、不调用 OS 权限、不请求 main process 数据。
- 当前 main process 已建立安全基线：sandbox、contextIsolation、nodeIntegration false、CSP、navigation/window-open deny、permission deny、custom protocol allowlist。

## 官方资料核对

- Context7：`/electron/electron`。
- Electron 官方 context isolation/security 文档要求 preload 通过 `contextBridge` 暴露窄 API。
- 官方示例明确 raw `ipcRenderer` 或 generic `on/send` 暴露是坏模式，应包装成每个能力的具体方法。
- Electron 安全基线要求保持 context isolation、sandbox、nodeIntegration false，并避免把 Electron/Node primitives 暴露给 renderer。

## 判断

本 slice 不新增 preload 或 IPC。

理由：

- 当前 renderer 没有真实主进程特权能力 consumer。
- 新增 preload/IPC 会创造空 `window.api` 或 generic bridge 风险。
- 当前 Electron security baseline 已建立；readiness 的正确结果是保持 absent，并记录未来启用条件。

## 成功标准

- `docs/current/electron.md` 写清当前不新增 preload/IPC，以及新增条件。
- `docs/current/flow.md` 写清当前无 IPC request flow，未来新增时必须先建模 owner、ordering、failure、timeout/cancel。
- 不新增 `src/preload`、preload entry、IPC channel、handler 或 renderer global API。
- 不新增 Zod 依赖。
- 不修改 `package.json` 或 `package-lock.json`。
- 不修改 runtime code。
- `npm run verify:quick` 通过。
- `npm run build` 通过。
- `npm start` runtime evidence 覆盖 production URL、CSP header、新窗口拒绝、外部导航拒绝和权限默认拒绝。
- docs lifecycle checks 通过。
- 多轮 subagent review 和 Claude CLI review 通过。

## 非目标

- 不创建 preload bridge。
- 不创建 IPC handler。
- 不创建 `window.api`。
- 不安装 Zod。
- 不做 DB、auth、logging、packaging、updater 或 product feature。

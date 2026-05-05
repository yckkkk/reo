# 规格

## 目标

确认当前 Electron 工程符合 Reo 的最小安全基线，并明确 `electron-vite` 与 Electron Forge 的边界。

## 验收标准

- Renderer 不直接使用 Node 或 Electron API。
- 当前没有 preload bridge 和 IPC API。
- Main process 启用 sandbox。
- BrowserWindow 使用 sandbox、context isolation、禁用 Node integration、启用 web security、禁用 webview。
- 生产使用 `reo-app://renderer/index.html` 加载 renderer。
- 自定义 protocol 保留 privileged scheme 注册时序、host allowlist 和 path containment。
- 权限请求默认拒绝。
- 非可信导航和新窗口默认拒绝。
- Dev server 只接受 parsed loopback `http` 或 `https` origin。
- Packaged app 忽略 `ELECTRON_RENDERER_URL`。
- 生产 CSP 存在且不包含 `unsafe-inline` 或 `unsafe-eval`。
- 当前构建权威是 `electron-vite`。
- 不引入 Forge、updater、preload、IPC、packaging、database、auth、UI、Vitest 或 runtime integration。
- `npm run verify:quick`、`npm run build` 和 `npm start` runtime 验证完成。
- `AGENTS.md` 与 `.claude/CLAUDE.md` 保持镜像。
- 没有 build artifact 被 git 跟踪。

## 非目标

- 不安装未来技术栈。
- 不新增 Electron surface。
- 不安装 Vitest。
- 不做 packaging、signing、notarization、ASAR、fuses 或 updater。
- 不创建额外 docs 顶层目录。

## TDD 判定

本 slice 修改 packaged app 的 dev server URL gate，属于行为改动，必须执行真实 TDD。

测试使用 Node test runner，不安装 Vitest。

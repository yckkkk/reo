# 执行计划

## RED

- 写 `workspaceContract.test.ts`：允许 channel、no-input request、chooseDirectory result DTO、错误信封。
- 写 `workspaceSelectionTokens.test.ts`：单次消费、过期、sender 绑定、错误路径不泄露。
- 写 `trustedSender.test.ts`：main frame、origin、session、channel allowlist。
- 写 `workspaceBridgeSurface.test.ts`：pure bridge factory 只暴露 `chooseDirectory()`。
- 写 `rendererImportBoundary.test.ts`：ESLint API 在 renderer filePath 下拦截 Node/Electron import。

## GREEN

- 安装 `zod`。
- 实现 workspace contract、trusted sender、selection token store。
- 实现 preload pure bridge factory 和 runtime install 层。
- 增加 preload entry、BrowserWindow preload 配置和 workspace IPC 注册。
- 只允许 trusted renderer 的 audio media permission，其余权限继续拒绝。
- 扩展 main test 编译范围、renderer restricted import lint 规则和 package scripts。

## REFACTOR

- 收紧类型和命名，避免 generic bridge/service/runtime。
- 更新 `docs/current/electron.md`、`docs/current/data.md`、`docs/current/flow.md`、`docs/current/quality.md`。
- 记录验证证据并归档本 spec。

# 运行时可观测性与文件空间 E2E 工作单元

## 时间

2026-05-15 09:41 America/Los_Angeles

## Objective

建立 Reo 当前需要的最小本地诊断遥测，并用真实 `npm run dev` runtime 验证用户创建记忆空间、创建 Memory、向记忆空间加入普通文件后，文件合同、UI 投影和诊断日志都可观察、可排查。

## 成功标准

- Main process 本地诊断日志可记录 app startup、workspace IPC request completion 和 fatal exception，不暴露 root path、transcript、title、token、secret 或 raw payload。
- 不创建 renderer logging bridge、preload logging bridge、generic diagnostic IPC 或 remote telemetry。
- `docs/current/electron.md`、`docs/current/flow.md` 和 `docs/current/quality.md` 描述当前 diagnostics owner、日志位置、边界、redaction 和验证路径。
- 行为测试覆盖 diagnostic span 成功/失败、payload redaction 和 IPC handler 诊断事件。
- `npm run verify:quick` 通过。
- 真实 `npm run dev` runtime 通过 E2E：创建记忆空间、创建 Memory、在记忆空间目录内新增普通 `.json`、`.md`、`.html` 和其它文件，刷新后 UI 不把这些文件投影为 Reo 对象，诊断日志能看到对应 workspace IPC 成功事件。

## 依据

- Electron 官方 `app.setAppLogsPath()` / `app.getPath('logs')` 提供平台日志目录；IPC listener 不应暴露 Electron event object 到 renderer。
- Context7 `electron-log` 文档确认 main process 可使用 `electron-log/main` 作为本地日志实现；renderer logging 需要额外 bridge，本任务不启用该 bridge。
- Reo 当前没有 Sentry DSN、release/environment、source map upload、privacy/scrubbing 或 sampling 计划，因此本任务不初始化 Sentry。

## 约束

- 只做 main-owned local diagnostics，不做远程上报。
- 不记录用户文件路径、记忆空间标题、Memory 标题、转录正文、音频内容、selection token、workspace handle 或 credentials。
- 不新增 generic logging API、renderer/preload bridge 或用户可调用诊断 IPC。
- E2E 只验证当前支持的 Memory/file-space 基础能力；不新增 note/photo/video/imported_file/HTML preview runtime。

## TDD 切入

- RED：diagnostic span 成功时记录 `workspace-ipc.start` 和 `workspace-ipc.finish`，finish 含 duration 与 status。
- RED：diagnostic span 失败时记录 error finish，不记录 request payload。
- RED：workspace IPC 注册 handler 被调用时会写入对应 channel 的 diagnostic event。

## 验证清单

- [x] targeted main tests
- [x] `npm run verify:quick`
- [ ] `npm run dev` runtime E2E

## 当前证据

- `npm run test:main -- diagnostics.test.ts workspaceIpcRegistration.test.ts` 执行了 main test runner，覆盖新增 diagnostics tests 与 workspace IPC registration diagnostic hook，全部通过。
- `npm run verify:quick` 覆盖 typecheck、main tests、renderer tests、lint 和 format check，全部通过。
- `npm run dev` runtime 已观察到 `app diagnostics.ready`、`app ready` 和 `workspace:listMemorySpaces` diagnostic console event；目录选择 native dialog automation 尚未完成，因此真实创建记忆空间、创建 Memory 和普通文件加入目录后的 runtime E2E 仍是本工作单元剩余验证项。

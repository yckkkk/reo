# 审查

## 当前结论

Task 2 已完成 RED/GREEN/REFACTOR，并已修复第一轮对抗审查指出的 1 个 BLOCKER、第一轮 Codex `$ycksimplify` 指出的 2 个 MAJOR、第二轮 Codex 发现的 pending intent cleanup 边界、最终 subagent 复审列出的 3 个 MINOR、Claude CLI `/simplify` 列出的 1 个简化 MINOR，以及 Codex CLI 最终复审列出的 2 个 MAJOR。最终聚焦复审 PASS：无 BLOCKER/MAJOR。当前无 unresolved BLOCKER/MAJOR；归档和提交前仍需执行固定门禁。

## 简化检查清单

- 复用现有 workspace error envelope、sender validation、handle ownership 和 channel 常量模式。
- 不创建 generic permission service、generic runtime 或 generic IPC bridge。
- 不在 renderer 类型中暴露 sender id、root path 或 Electron/Node 细节。
- 只在权限不可信边界使用 Zod/运行时校验，不给内部纯函数添加多余 defensive fallback。
- 避免额外日志、legacy compatibility、silent fallback 和未要求的 ErrorBoundary/loading state。

## 简化结果

- 已把新增 IPC handler options 从 `RegisterWorkspaceIpcOptions` 收窄为 task-local 最小字段，避免无关 `tokenStore/showOpenDirectoryDialog` 参数膨胀。
- 已把 production register 改为调用 production handler；`ForTest` 命名只保留给测试入口。
- Preload 仍只在内部使用 `invoke` adapter，`window.reoWorkspace` 不暴露 generic `invoke/send`。
- Renderer API payload 只包含 `workspaceHandle`、`memoryId` 或 `drawerSessionId`，不包含 sender id、root path 或 Electron 对象。
- `microphoneIntents` 改为 sender keyed map，避免每次 begin/consume 扫描全部 intent。
- app shell scheme/host 已抽到无 Electron 副作用的 `appShellConstants.ts`，避免 security/protocol 常量漂移。

## 对抗审查

- Subagent 第一轮，2026-05-07：
  - BLOCKER：`RecordingOverlay` 未在 `getUserMedia` 前调用 `beginMicrophoneIntent`。已修复：`handleStart` 先 await `beginMicrophoneIntent`，成功后才创建 draft 和启动 media acquisition；begin 失败不创建 draft，draft failure、media start failure 或 stale session clear matching pending intent；新增 renderer tests。
  - MAJOR：`getMemoryDetail` delayed filesystem read 期间未重新断言 handle lock usability。已修复：`readMemoryDetail` 接收并消费 `assertWorkspaceUsable`，IPC handler 传入 handle assert；新增 lock-lost test。
  - MINOR：memory detail response schema 缺少 strip raw path 合同。已修复：新增 `workspaceMemoryDetailResponseSchema` 与 contract test。
- Codex `$ycksimplify` 第一轮，2026-05-07：
  - BLOCKER：同 subagent，已修复。
  - MAJOR：pending microphone intent 未随 workspace close/window teardown 清理。已修复：close workspace 清理该 handle 的 pending intent，teardown 清理全部 pending intents；新增 main tests。
  - MAJOR：同 `getMemoryDetail` delayed lock lost，已修复。
  - MINOR：`APP_SHELL_SCHEME` 重复、intent store O(n)、spec 范围矛盾，已修复。
- Codex `$ycksimplify` 第二轮，2026-05-07：
  - MAJOR：`workspace:clearMicrophoneIntent` 和 `workspace:close` 仍依赖 usable handle；lock lost 或 release failure 分支会残留 pending microphone intent。已修复：新增 owner-only handle lookup；clear 在 owner 匹配后可清理 lock-lost handle 的 pending intent；close 在 owner 匹配后先清 pending intent，再释放 lock，release failure 也不保留 authorization；新增 3 个 main RED/GREEN tests。
- Subagent 最终复审，2026-05-07：
  - PASS：无 BLOCKER/MAJOR。
  - MINOR：缺 `isMainFrame: false` permission request 负向测试。已补 `denies microphone permission for a subframe even with a valid intent`。
  - MINOR：window teardown cleanup 测试偏间接。已补 `window teardown clears all pending microphone intents through workspace cleanup`，直接覆盖 `closeAllWorkspaceHandles()` 清理 pending microphone intents。
  - MINOR：`docs/current/flow.md` IPC flow 列表缺 memory detail 和 microphone intent begin/clear。已同步。
- Codex CLI `$ycksimplify` 最终复审，2026-05-07：
  - MAJOR：microphone intent response 暴露未被消费的 token-like 字段。已修复：response contract/type 只返回 `{ registered: true }`，authority 只保留在 main 的 sender-scoped intent store。
  - MAJOR：`RecordingOverlay` 在登记 microphone intent 前创建 draft。已修复：先登记 intent，再创建 draft；draft 创建失败会 clear intent。
  - MAJOR：renderer API test 未精确断言 `getMemoryDetail` 与 `clearMicrophoneIntent` wrapper。已补精确 payload 断言。
  - MINOR：`closeAllWorkspaceHandles()`、memory id regex、spec scope 已修复。
- Claude CLI `/simplify` 最终复审，2026-05-07：
  - PASS：无 BLOCKER/MAJOR。
  - MINOR：`withWorkspaceHandleRequest` 内联 `requireOwnedHandle + assertUsable` 可直接复用 `requireHandle`。已修复。
  - MINOR：权限请求失败时消费 mic intent、SPA 内 acquiring unmount 最多保留 TTL 内 pending intent。权限请求失败消费 intent 保持当前 fail-closed one-shot 语义；SPA acquiring unmount 后续由 Codex CLI 最终复审升级为 MAJOR 并修复。
- Codex CLI `$ycksimplify` 最终复审，2026-05-07：
  - MAJOR：`RecordingOverlay` acquiring 阶段父组件 unmount、workspace/session replacement 或 route teardown 可能让 begin 成功后的 pending microphone intent 留到 TTL。已修复：renderer 记录 pending intent ref；unmount/workspace handle 切换会 clear pending intent 并使旧 recording session 失效；begin resolve 后若 session stale 会 clear 且不创建 draft；draft resolve 后若 session stale 会 discard draft 且不启动 media。
  - MINOR：`verification.md` 固定门禁仍待执行。保留为提交前门禁项。
- Codex CLI `$ycksimplify` 聚焦复审，2026-05-07：
  - MAJOR：draft 已创建、media start pending 时发生 parent unmount 或 workspace handle 切换，cleanup 只 clear intent，不 discard active draft。已修复：cleanup 会停止已有 controller、discard active draft，并保留 media start resolve 后的 stale controller stop；新增 media start pending unmount test。
  - MINOR：缺 workspace/session replacement targeted test。已补 workspace handle change during draft creation test。
- Codex CLI `$ycksimplify` 最终聚焦复审，2026-05-07：
  - PASS：无 BLOCKER/MAJOR。
  - MINOR：media start pending 的 workspace handle change 只有共享 cleanup 路径推理覆盖，没有单独 targeted test。当前实现与 unmount 共用 cleanup effect，保留为非阻断测试增强。
  - MINOR：固定门禁仍待执行。提交前补齐。

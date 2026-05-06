# 审查记录

本切片收口前记录本地自查、subagent 只读审查和最终结论。

当前结论：未发现 unresolved BLOCKER/MAJOR。

## Subagent 只读审查

结论：发现进入实现前必须处理的 BLOCKER/MAJOR。

处理要求：

- active spec 必须补齐归档计划要求的 RED 清单，不能只保留粗粒度计划。
- `displayPath` 不能等同 renderer 禁止持有的真实 `rootPath`；RED 覆盖 chooseDirectory response。
- selection token 到 workspace handle 的 capability 转换必须同组测试。
- lock 是写入门禁，不能延后。
- path containment、symlink、TOCTOU、audio draft/read、错误信封和 docs current 漂移必须在本切片收口。

处理结果：

- active spec 已补齐 RED 清单。
- chooseDirectory displayPath 已改为 basename，并用 IPC test 覆盖。
- selection token 到 workspace handle 的转换由 `workspaceIpc.test.ts`、`workspaceHandles.test.ts`、`workspaceLock.test.ts` 覆盖。
- lock 在 initialize/open 前获取，duplicate open 和 lock lost 有测试。
- path、symlink、draft/read、错误信封和 current docs 已同批更新。

## 本地自查

- 未引入 DB、TanStack Query 或未来 photo/video/file/film 能力。
- Renderer 不持有裸 `rootPath`，`workspaceHandle` 不进入 query key。
- Preload 不暴露 generic `invoke/send`，runtime CDP 已验证。
- Preload bundle 未带入 Zod、workspace contract、lock 或 filesystem 依赖。

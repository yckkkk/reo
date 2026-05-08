# 契约与模型审查

时间：2026-05-08 04:27 America/Los_Angeles

## 目标

修复已确认的文档系统冲突，并审查当前 IPC、类型契约、错误码、状态同步、数据模型、组件复用、文件结构和错误处理是否符合 Reo 的当前模型。

## 成功标准

- 已确认的文档冲突被压缩回 `docs/current/*` 或 `docs/decisions/*`。
- 审查覆盖 IPC 通道、请求/响应格式、鉴权/授权方式、错误码、状态同步机制、数据真源、DB 状态、组件边界、文件夹结构和错误处理。
- 审查结果只记录当前事实和可执行问题，不把 archive 证据升级为当前真源。
- 验证命令在当前快照运行并记录结果。

## 结果

- 产品实体语言统一为“记忆空间”；用户可见文案、sidebar 入口、创建/打开/移除流程、registry response key 和相关 current 文档不再用 Project/projects 承载该实体。
- 前后端 registry 契约收敛到 `workspace:listMemorySpaces`、`workspace:openMemorySpace`、`workspace:removeMemorySpace` 和 `memorySpaces` response key。
- 当前没有 DB schema、auth tables、Drizzle migration 或 table relationship；用户内容真源仍是记忆空间文件夹，memory space registry 只保存 main-owned root path 和可展示 metadata。
- 非阻断反馈统一走 root `ReoToaster` 和共享 `toast`，移除失败不在确认弹层内重复渲染旧提示。

## 验证

- `npx vitest run src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/workspaceApi.test.ts src/renderer/src/workspace/workspaceQueries.test.ts test/main/workspaceContract.test.ts test/main/workspaceBridgeSurface.test.ts test/main/workspaceMemorySpaceRegistry.test.ts test/main/workspaceIpc.test.ts`
- `npm run test:main`
- `npm run verify:quick`

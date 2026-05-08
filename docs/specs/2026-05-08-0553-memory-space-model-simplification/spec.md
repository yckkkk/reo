# 记忆空间模型简化

时间：2026-05-08 05:53 America/Los_Angeles

## 目标

收紧当前数据模型，让记忆空间保持以用户磁盘文件夹内的普通文件为真源，删除会把临时投影误导成未来表结构的重复字段。

## 成功标准

- 当前 snapshot 只返回记忆空间身份、标题、描述和 `memories[]` 投影，不再返回顶层 `recordings[]`。
- 录音列表只通过 memory detail 读取，保持 `memoryId -> recordings` 的关系清晰。
- registry 仍只保存已导入记忆空间列表和 main-only root path，不保存用户内容真源。
- 不引入 DB、Drizzle、SQLite、Zustand、auth 或新平台层。
- `docs/current/data.md` 和相关 current 文档明确当前实体、字段归属和未来 DB 边界。

## 范围

- 修改 workspace IPC contract、main 文件模型、renderer 类型和相关测试。
- 更新 current 文档中的当前事实。
- 不做记忆空间页面视觉重构，不做录音组件优化，不做 DB schema 设计。

## 验证

- RED：先让测试要求 snapshot 拒绝顶层 `recordings`，并确认当前实现失败。
- GREEN：删除重复投影后运行对应 main / renderer 测试。
- 收口：运行 `npm run verify:quick`。

## 验证记录

- RED：`npm run test:main` 失败，证明当前实现仍要求 initialize snapshot 返回 `recordings`，且 `workspaceSnapshotSchema` 接受顶层 `recordings`。
- GREEN：删除 snapshot 顶层 `recordings`、删除 main read model 的重复 recording projection、更新 renderer 类型和合并逻辑后，`npm run typecheck`、`npm run test:main`、`npm run test:renderer` 通过。
- 简化审查：删除无 consumer 的 `workspaceRecordingSummarySchema`，并让 recording overlay 复用 `workspaceApi` 导出的 `FinalizedRecording` 类型。
- 收口：`npm run verify:quick` 通过。

# Memory detail reopen cache

创建时间：2026-05-18 20:37 America/Los_Angeles

## 目标

修复从 sidebar 首页/资料库离开记忆空间、再进入同一记忆空间时，Memory Studio 每次先显示「正在载入记忆内容」并等待完整 detail IPC 的性能回归。

## 旧优化依据

- `docs/archive/specs/2026-05-07-1125-first-product-slice-task-6-memory-detail/README.md` 已建立 Memory detail Query key：`['workspace', 'memory-detail', workspaceId, memoryId]`，并明确 `workspaceHandle` 只作为 request capability，不进入 query key、DOM、URL 或持久化。
- 同一旧 spec 的 review 已把长 memory 的 detail 读取收口为有界 preview，说明 detail cache 是为了避免打开路径重复读取/渲染重活。
- 当前 `docs/current/data.md` 仍记录 Memory detail cache 由 stable `workspaceId + memoryId` 拥有；`workspaceHandle` 不是内容身份。

## 根因假设

当前 sidebar 顶层导航会关闭 workspace handle；重新打开同一 workspace 时，renderer 清理了该 workspace 的 `memory-detail` Query。Memory Studio 因此没有 cached detail 可用，只能回到初始 loading。正确行为应是：

- 离开 workspace 时保留小型 Memory detail 投影，用于同一 `workspaceId + memoryId` 再进入时即时渲染。
- 重新打开后立刻 invalidate/refetch Memory detail，让新 handle 从文件真源刷新。
- 新增 Memory、Segment 或 SegmentSupplement 时继续使用 mutation response 精确写入 Workspace snapshot、Memory detail 和相关 content Query；不得用全 workspace reload 或清空 detail cache 作为默认刷新策略。
- 继续清理 Segment 和 SegmentSupplement content cache，因为它们持有本地音频 bytes/Blob 相关大对象。

## 主流设计约束

采用 TanStack Query 的 server-state 模型：稳定 identity 的缓存先渲染，后台同步最新文件真源；mutation 直接把服务端 response 写回受影响的 exact query。只有无法从 response 表达的外部文件变化才走 bounded refresh/invalidation，且 invalidation 不应把已有数据清空成 loading。

## TDD 验收

- RED：重新打开同一记忆空间时，旧 Memory detail cache 应在新 `readMemoryDetail` pending 期间继续渲染，不显示「正在载入记忆内容」；当前实现会失败。
- RED/GREEN：已有录音 finalize、补充录音 finalize、转录保存等 response-driven cache merge 行为继续不触发额外 Memory detail 全量 reload。
- GREEN：只调整 Query cache 清理边界和 reopen refresh，不新增 store、不新增 Query key、不改 IPC。
- REFACTOR：命名清楚区分 detail projection cache 和 finalized audio content cache。

## 验证

- RED：`npm run test:renderer -- src/renderer/src/App.test.tsx` 失败，新增测试在离开 workspace 后读取 `memory-detail` cache 得到 `undefined`。
- GREEN focused：`npm run test:renderer -- src/renderer/src/App.test.tsx -t "reuses cached Memory detail"` 通过。
- GREEN focused：`npm run test:renderer -- src/renderer/src/workspace/workspaceQueries.test.ts` 通过。
- GREEN App：`npm run test:renderer -- src/renderer/src/App.test.tsx` 通过，98 tests。
- Final：`npm run verify:quick` 通过，覆盖 typecheck:quick、main tests、renderer tests、lint:strict 和 format:check。
- `npm run test:renderer -- src/renderer/src/App.test.tsx`
- `npm run verify:quick`

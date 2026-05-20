# Tab Rail More Menu 修复计划

## Phase 1：RED

- 在 `LoadedWorkspaceFrame.test.tsx` 为 primary tab More 和 SegmentSupplement tab More 增加事件隔离测试。
- 测试必须证明 More 按钮的 pointer / mouse / click 不冒泡到 draggable tab item。
- 运行 focused renderer test，确认失败。

## Phase 2：GREEN

- 在 `MemoryStudio.tsx` 复用同一个 More trigger 事件隔离 helper。
- 对 primary tab More 和 SegmentSupplement tab More 应用该 helper。
- 运行 focused renderer test、相关 More 菜单测试和 `npm run typecheck:quick`。

## Phase 3：REFACTOR + Gate

- 清理重复事件处理。
- 更新 `implementation-notes.md` 证据。
- 运行 `npm run verify:quick`。
- 独立 `/review` 和 `$ycksimplify` gate 通过后归档。

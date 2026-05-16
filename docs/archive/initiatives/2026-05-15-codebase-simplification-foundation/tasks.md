# 代码库简化基础任务

## 里程碑

- [x] M1：文件事务 helper 最小骨架落地，并迁移 `atomicWorkspaceFile.ts` / `recordingDrafts.ts` 的同形 helper。
- [x] M2：`memoryFiles.ts` 的 safe known-directory open/read/remove/cleanup helper 完成迁移。
- [x] M3：`workspaceFiles.ts` / `workspaceLock.ts` 的 directory fsync 和 known-directory helper 完成迁移。
- [x] M4：renderer entity action binding 完成，四类 wrapper 不再直接调用 `window.reoWorkspace`。
- [x] M5：剩余 directory rename transaction 完成收益评估；只在收益明确且行为测试充分时迁移。
- [x] M6：`docs/current/*` 压缩为最终当前事实，initiative 完成或归档。

## 当前下一步

- [x] 执行 `docs/specs/2026-05-15-2222-codebase-simplification-start-gate/plan.md` 的 Task 1。
- [x] 执行 `docs/specs/2026-05-15-2222-codebase-simplification-start-gate/plan.md` 的 Task 2。
- [x] 执行 `docs/specs/2026-05-15-2222-codebase-simplification-start-gate/plan.md` 的 Task 3。
- [x] 执行 `docs/specs/2026-05-15-2222-codebase-simplification-start-gate/plan.md` 的 Task 4。
- [x] 执行 `docs/specs/2026-05-15-2222-codebase-simplification-start-gate/plan.md` 的 Task 5。

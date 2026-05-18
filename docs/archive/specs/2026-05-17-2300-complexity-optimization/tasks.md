# Complexity Optimization Current Tasks

## 本 spec 任务

- [x] 创建长期 initiative 目录。
- [x] 创建当前 spec 目录。
- [x] 生成 initiative `README.md`。
- [x] 生成 initiative `plan.md`。
- [x] 生成 initiative `tasks.md`。
- [x] 生成 spec `README.md`。
- [x] 生成 spec `plan.md`。
- [x] 生成 spec `tasks.md`。
- [x] 更新 `docs/initiatives/README.md` active initiative 索引。
- [x] 运行 `git status --short --untracked-files=all`。

## 后续实现入口

initiative task T01-T61 已完成：

- [x] T01 `src/main/memoryFiles.ts`：directory-aware workspace index rebuild。
- [x] T02-T61：见 `docs/initiatives/2026-05-17-complexity-optimization/tasks.md`。
- [x] 运行 `MAIN_TEST_BATCH_SIZE=2 npm run test:main`。
- [x] 修正 `LoadedWorkspaceFrame.test.tsx` 的 MemoryRail 上游顺序断言并运行 focused renderer test。
- [x] 运行 `npm run verify:quick`。

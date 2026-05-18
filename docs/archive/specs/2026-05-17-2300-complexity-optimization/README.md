# 复杂度与性能收敛 Spec

## 时间

2026-05-17 23:00 America/Los_Angeles

## Objective

为全库复杂度审查结果创建当前执行入口，并按 P1 到 P4 完成全部复杂度与性能修复。

## 当前事实

- `docs/specs/*` 在创建本 spec 前为空。
- 本任务已创建长期 initiative：`docs/initiatives/2026-05-17-complexity-optimization/`。
- initiative `tasks.md` 中 T01-T61 已全部完成。
- 最终验证已通过 `npm run verify:quick`。
- 完成时间：2026-05-18 01:39 America/Los_Angeles。

## 成功标准

- 创建当前 spec 的 `README.md`、`plan.md`、`tasks.md`。
- 创建长期 initiative 的 `README.md`、`plan.md`、`tasks.md`。
- 更新 `docs/initiatives/README.md`，声明新的产品或代码开发 active initiative。
- 所有 61 个审查发现都在 tasks 中保留。
- 任务按 P1、P2、P3、P4 排序。
- 按优先级完成 T01-T61。
- 完成时运行并通过 `npm run verify:quick`。

## 验证

- `git status --short --untracked-files=all`
- 人工核对 `docs/specs/2026-05-17-2300-complexity-optimization/tasks.md` 与 `docs/initiatives/2026-05-17-complexity-optimization/tasks.md` 覆盖 T01-T61。
- `MAIN_TEST_BATCH_SIZE=2 npm run test:main`
- `npm run test:renderer -- --project renderer-jsdom src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`
- `npm run verify:quick`

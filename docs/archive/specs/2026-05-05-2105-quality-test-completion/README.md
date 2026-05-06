# Quality/Test Completion

## 时间

2026-05-05 21:05 America/Los_Angeles

## 目标

完成 foundation-completion initiative Task 02：判断当前是否需要安装 Vitest，并更新质量真源的 test runner 边界。

## TDD 豁免

本 slice 不改变 runtime 行为，不新增测试 runner，不新增交互行为。

TDD 豁免：不执行 RED/GREEN/REFACTOR。验证以 Context7/官方文档核对、源码事实核对、`npm run verify:quick`、`npm run build`、docs lifecycle checks 和多轮 review 为准。

## 范围

- 核对当前 Node test runner 是否不足。
- 核对当前 renderer 是否存在 component/browser behavior 测试 consumer。
- 若没有真实 consumer，不安装 Vitest。
- 更新 `docs/current/quality.md`，记录 Vitest 启用门槛。
- 更新 initiative Task 02 状态并归档本 spec。

# Test Governance

Time: 2026-05-24 21:15 America/Los_Angeles

## Objective

把测试从“看到一个实现分支就写一个测试”的膨胀模式收回来。测试层只保留会长期保护 Reo 的行为合同、安全边界、事务恢复、公开 contract、用户可见状态和高风险并发/缓存边界；重复 schema/DOM/异常枚举改为 table-driven 或删掉。

## Current Constraints

- 本次不改 runtime 行为。
- 当前工作树已有 renderer dev scenario 相关 dirty changes；本次不重写这些源码改动。
- 安全边界、filesystem containment、lock、atomic write、recovery、IPC trust boundary 和 public contract 测试是高价值保护面，不能为了行数直接删除。
- 对只改测试和文档的治理，TDD RED 阶段不适用；验证以 focused test、format、diff 和必要 quick gate 为准。
- TDD 是适用性判断，不是所有小任务都需要 TDD；临时探索测试不默认进入长期 suite。

## Success Criteria

- `docs/current/quality.md` 记录测试收录门槛和 test bloat 禁止项。
- `docs/current/quality.md` 和 agent 入口记录 TDD 适用性判断，避免假 TDD。
- 至少完成一个低风险测试合并样例，展示 table-driven 方式如何替代重复断言。
- 保留本次不处理的大型测试热点清单，作为后续切片输入。
- 不引入 runtime source 行为改动。

## First Slice

- 修改 `test/main/workspaceContract.test.ts` 中显式 workspace channel 常量断言，把重复 `assert.equal` 改为 table-driven。
- 删除 `test/main/packageScripts.test.ts` 中只用源码正则锁实现细节的测试，保留实际 helper 行为、CLI error path 和脚本命令合同测试。
- 将 `scripts/run-renderer-tests.mjs` 的默认全量运行改为顺序运行三个 Vitest project，保留显式参数的 focused 透传。
- 删除 `src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx` 中只锁 compact content tab Tailwind class 的过期微测试；content tab 行为由同文件其它 tab 切换、拖拽、More menu、content ownership 测试继续覆盖，布局尺寸由 runtime 视觉测量承担。
- 更新 `docs/current/quality.md` 的当前质量决策，明确高价值测试与低价值测试边界。

## Verification Plan

- `MAIN_TEST_FILES=test/main/workspaceContract.test.ts npm run test:main`
- `MAIN_TEST_FILES=test/main/packageScripts.test.ts npm run test:main`
- `npm run format:check`
- `git diff --check`
- 若需要声明整体干净，再运行 `npm run verify:quick`

## Inventory

- 当前测试文件数量：96。
- 当前测试总行数约 71k。
- 最大测试热点：`src/renderer/src/App.test.tsx`、`test/main/workspaceIpc.test.ts`、`test/main/memoryFiles.test.ts`、`src/renderer/src/workspace/RecordingOverlay.test.tsx`、`src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`。
- 高风险保护面集中在 security、filesystem containment、atomic write、lock、recovery 和 IPC trust boundary；后续治理不应按行数直接删除这些测试。
- 低价值候选集中在源码正则测试、DOM class 微细节、同形 schema/error/channel 枚举和大 App workflow 文件中的重复 session setup。

## Verification Evidence

- `MAIN_TEST_FILES=test/main/workspaceContract.test.ts,test/main/packageScripts.test.ts npm run test:main` passed: 62 tests passed.
- `npm run format:check` passed.
- `git diff --check` passed.
- `test/main/packageScripts.test.ts` 删除 5 个源码正则实现细节测试，文件减少 62 行。
- `test/main/workspaceContract.test.ts` 把 channel 常量重复断言改为 table-driven，净减少 17 行，保留同一 public channel contract 覆盖。
- TDD 适用性规则已写入 `docs/current/quality.md`、`AGENTS.md` 和 `.claude/CLAUDE.md`：高风险行为改动必须真实 TDD；低风险小改动可说明豁免和替代验证；禁止假 RED 和复述实现的测试。
- `MAIN_TEST_FILES=test/main/workspaceContract.test.ts,test/main/packageScripts.test.ts npm run test:main` passed: 63 tests passed.
- `npm run test:renderer` passed: `renderer-node` 32 tests, `renderer-jsdom-browser` 40 tests, `renderer-jsdom-components` 441 tests.
- `src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx` 删除 1 个 stale Tailwind class 微测试，单文件 focused run passed: 54 tests passed.
- `npm run verify:quick` passed: typecheck quick passed; main tests 812 passed; renderer projects passed with 32, 40, and 441 tests; `lint:strict` passed; `format:check` passed.
- `cmp -s AGENTS.md .claude/CLAUDE.md` passed.
- `npx prettier --check AGENTS.md .claude/CLAUDE.md docs/current/quality.md docs/specs/2026-05-24-2115-test-governance/README.md docs/specs/2026-05-24-2115-test-governance/tasks.md` passed.
- `git diff --check -- AGENTS.md .claude/CLAUDE.md docs/current/quality.md docs/specs/2026-05-24-2115-test-governance/README.md docs/specs/2026-05-24-2115-test-governance/tasks.md` passed.

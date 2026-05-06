# 验证

## TDD

本 slice 不改变 runtime 行为，不新增测试 runner，不新增交互行为。

TDD 豁免：不执行 RED/GREEN/REFACTOR。

## Context7 核对

- Vitest：`/vitest-dev/vitest/v4.0.7`。

## 当前源码核对

- `rg --files src/renderer src/main test scripts | sort`：当前只有 main process、renderer shell、样式、`scripts/run-main-tests.mjs`、`test/main/devServerUrl.test.ts`。
- `find src/renderer -maxdepth 4 -type d -print | sort`：当前只有 `src/renderer` 和 `src/renderer/src`。
- `find test -maxdepth 4 -type f -print | sort`：当前只有 `test/main/devServerUrl.test.ts`。

## 验证结果

- `npx prettier --write docs/current/quality.md docs/initiatives/2026-05-05-foundation-completion/plan.md docs/initiatives/2026-05-05-foundation-completion/tasks.md docs/specs/2026-05-05-2105-quality-test-completion/*.md`：通过。
- `npm run verify:quick`：通过。
  - `typecheck`：通过。
  - `test:main`：4 个 Node test runner 测试通过。
  - `lint`：通过。
  - `format:check`：通过。
- `npm run build`：通过。
- `git diff --check`：通过，无输出。
- `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无输出。
- `git ls-files out dist build .vite .tmp`：通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：当前 active spec 为 `docs/specs/2026-05-05-2105-quality-test-completion`，归档后必须为空。
- `git status --short`：显示 `docs/current/quality.md`、initiative plan/tasks 修改和本 spec 未追踪。
- `git ls-files --others --exclude-standard`：只列出本 spec 文件。

## 待运行

- 修复 review 发现的问题后复审。
- 归档后 lifecycle checks。

## 独立审查

第一轮：

- Claude CLI：PASS。确认不安装 Vitest 的判断成立、TDD 豁免有效、无 package/runtime 变更。
- Subagent 1：PASS。确认 renderer 没有 component/browser behavior consumer，Vitest defer 合规；指出 tasks 中验证项应在归档前补齐。
- Subagent 2：FAIL。阻断项：Task 02 在 initiative 中过早标记完成；conditional Vitest RED test 和 `verify:quick` 更新被误标为已完成。

处理：

- Task 02 在 initiative `tasks.md` 中恢复为未完成，直到 archive/review/commit closeout 完成。
- Initiative `plan.md` 中将条件分支改写为 “Vitest 未引入，RED test 不适用” 和 “未修改 `verify:quick`，因为没有新 runner 证明价值”。

第二轮：

- Claude CLI：PASS。确认 Task 02 没有过早标完成，conditional Vitest items 已改为 factual no-op，`quality.md` gate 无 scope creep。
- Subagent：PASS。确认 prior blockers 已修复，`package.json` 没有 Vitest 或 `verify:quick` 变更。

归档后必须重新运行 closeout checks，再把 initiative Task 02 标记为完成。

## 归档后验证

- `npm run verify:quick`：通过。
  - `typecheck`：通过。
  - `test:main`：4 个 Node test runner 测试通过。
  - `lint`：通过。
  - `format:check`：通过。
- `npm run build`：通过。
- `git diff --check`：通过，无输出。
- `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无输出。
- `git ls-files out dist build .vite .tmp`：通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：通过，无输出。
- `git status --short`：显示 `docs/current/quality.md`、initiative plan/tasks 修改和本归档 spec 未追踪。
- `git ls-files --others --exclude-standard`：只列出本归档 spec 文件。

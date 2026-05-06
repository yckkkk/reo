# 验证

## TDD

本 session 是纯文档和规划，不改变 runtime 行为，不新增交互行为。

TDD 豁免：不执行 RED/GREEN/REFACTOR。

## Context7 核对

- Electron：`/electron/electron`。
- shadcn/ui：`/shadcn-ui/ui`。
- Vitest：`/vitest-dev/vitest/v4.0.7`。
- Drizzle：`/drizzle-team/drizzle-orm`。
- Better Auth：`/better-auth/better-auth`。
- TanStack Query：`/tanstack/query`。

## 官方网络核对

- Electron security/context isolation/fuses：`https://www.electronjs.org/docs/latest/tutorial/security/`、`https://www.electronjs.org/docs/latest/tutorial/context-isolation`、`https://www.electronjs.org/docs/latest/tutorial/fuses`。
- electron-vite/Vite：`https://electron-vite.org/guide/build.html`、`https://electron-vite.org/guide/typescript`、`https://vite.dev/guide/`。
- Tailwind v4：`https://tailwindcss.com/docs/installation/using-vite`、`https://tailwindcss.com/docs/theme`。
- shadcn/ui：`https://ui.shadcn.com/docs/installation/vite`、`https://ui.shadcn.com/docs/components-json`。
- Vitest：`https://vitest.dev/guide/browser/`.
- Drizzle：`https://orm.drizzle.team/docs/get-started-sqlite`、`https://orm.drizzle.team/docs/drizzle-kit-generate`。
- Better Auth：`https://better-auth.com/docs/integrations/electron`。
- TanStack Query：`https://tanstack.com/query/latest/docs/framework/react/guides/query-keys`、`https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation`。
- Zustand：`https://zustand.docs.pmnd.rs/reference/apis/create`、`https://zustand.docs.pmnd.rs/reference/middlewares/persist`。
- React Hook Form / resolvers：`https://react-hook-form.com/docs/useform`、`https://github.com/react-hook-form/resolvers`。
- Zod：`https://zod.dev/basics`。
- Electron Forge：`https://www.electronforge.io/`、`https://www.electronforge.io/config/plugins`。
- electron-updater：`https://www.electron.build/auto-update.html`、`https://www.electronjs.org/docs/latest/api/auto-updater`。
- Sentry Electron：`https://docs.sentry.io/platforms/javascript/guides/electron/`。
- electron-log：`https://github.com/megahertz/electron-log`。

## 初始命令结果

- `git status --short`：通过，无输出。
- `git rev-parse --short HEAD`：`57d5d09`。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：通过，无输出。
- `find docs/initiatives -mindepth 1 -maxdepth 1 -print`：仅 `docs/initiatives/README.md`。
- `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无输出。

## 验证结果

- `npx prettier --write docs/initiatives/README.md docs/initiatives/2026-05-05-foundation-completion/*.md docs/specs/2026-05-05-2043-foundation-completion-planning/*.md`：通过。
- `npx prettier --write docs/archive/specs/2026-05-05-2043-foundation-completion-planning/*.md`：归档后通过。
- `npm run verify:quick`：通过。
  - `typecheck`：通过。
  - `test:main`：4 个 Node test runner 测试通过。
  - `lint`：通过。
  - `format:check`：通过。
- `npm run build`：通过。
- `git diff --check`：通过，无输出。
- `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无输出。
- `git ls-files out dist build .vite .tmp`：通过，无输出。
- `git status --short`：显示 `docs/initiatives/README.md` 修改、foundation-completion initiative 未追踪、本 planning spec 未追踪。
- `git ls-files --others --exclude-standard`：只列出 foundation-completion initiative 与本 planning spec。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：归档后通过，无输出。

## 独立审查

第一轮独立 `$review` 风格 subagent 结果：FAIL。

阻断项：

- P1：本 planning spec 仍在 `docs/specs/*`，提交前必须归档到 `docs/archive/specs/*`。
- P2：Context7 证据只记录 Electron、shadcn/ui、Vitest，不足以支撑本 planning session 的技术栈矩阵。

处理：

- P1：归档步骤在最终验证前执行。
- P2：补充 Drizzle、Better Auth、TanStack Query 的 Context7 核对；其余未进入当前实现 slice 的包以官方文档约束，并要求后续对应 slice 重新做 Context7 深核。

第二轮独立审查：

- Subagent 1：PASS，无阻断项。确认 `docs/specs` 为空、P1/P2 已处理、无依赖安装、无 runtime 代码变化、无空层。
- Claude CLI：PASS，无阻断项。确认 diff 为 docs-only，initiative 是路线图，不是单 session 大实现。
- Subagent 2：FAIL，发现 lifecycle 状态、verification matrix 位置和 per-slice closeout gate 表述不清。

处理：

- 将 Task 01 plan step 改为提交前验证和 review 已完成，commit hash 由最终输出报告。
- 将本归档 spec 的提交项改为“完成提交前验证与多轮 review；提交 hash 由最终输出报告”。
- 将 initiative completion 中的 verification matrix 权威位置改为 Task 10 closeout 汇总；每个 slice 的证据保存在对应 archive spec `verification.md`。
- 在 initiative global gates 中明确每个 task 收口前必须运行 `verify:quick`、`build`、docs lifecycle checks，并要求 Electron-surface slices 执行 `docs/current/electron.md` 的 runtime evidence。

第三轮独立审查：

- Claude CLI：PASS。确认 Task 01 状态一致、verification matrix 权威位置已修正、每个 slice closeout verification 已明确、`docs/specs` 为空、无 runtime/package/dependency changes、initiative 仍是 roadmap。
- Subagent：PASS。确认前一轮 3 个问题已修复、scope checks clean、无 runtime/package/source/test/config 变更、无 product scope creep。

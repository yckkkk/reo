# 验证

## TDD

本 slice 不改变 runtime 行为，不新增 provider、store、form、schema、resolver、query key、mutation 或 package。

TDD 豁免：不执行 RED/GREEN/REFACTOR。

## Context7 核对

- TanStack Query：`/tanstack/query`。
- Zustand：`/pmndrs/zustand`。
- React Hook Form：`/react-hook-form/documentation`。

## 官方资料核对

- TanStack Query query invalidation：`https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation`。
- Zustand persist middleware：`https://zustand.docs.pmnd.rs/reference/middlewares/persist`。
- React Hook Form `useForm`：`https://react-hook-form.com/docs/useform`。
- Zod basics：`https://zod.dev/basics`。

## 当前源码核对

- `src/renderer/src/main.tsx`：当前静态 shell，无 async data、form、mutation 或 shared local state。
- `package.json`：当前没有 `@tanstack/react-query`、`zustand`、`react-hook-form`、`@hookform/resolvers` 或 `zod`。
- `rg -n "tanstack|query|zustand|useStore|create\\(|react-hook-form|useForm|zod|schema|form|input|submit|async|fetch|axios|localStorage|sessionStorage|persist|state|useState|useReducer" package.json package-lock.json src test scripts docs/current docs/initiatives/2026-05-05-foundation-completion -S`：package/source 中没有 query/store/form/Zod consumer；source 命中仅为既有 protocol async、CSP `form-action`、CSS input selector 和文档。

## 验证结果

- `npx prettier --write docs/current/data.md docs/current/flow.md docs/current/frontend.md docs/current/quality.md docs/initiatives/2026-05-05-foundation-completion/plan.md docs/specs/2026-05-05-2211-state-form-query-foundation/*.md`：通过。
- `npm run verify:quick`：通过。
  - `typecheck`：通过。
  - `test:main`：4 个 Node test runner 测试通过。
  - `lint`：通过。
  - `format:check`：通过。
- `npm run build`：通过。
- `git diff --check`：归档前通过。
- `diff -u AGENTS.md .claude/CLAUDE.md`：归档前通过，无输出。
- `git ls-files out dist build .vite .tmp`：归档前通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：当前 active spec 为 `docs/specs/2026-05-05-2211-state-form-query-foundation`，归档后必须为空。
- `git status --short`：当前显示 `docs/current/data.md`、`docs/current/flow.md`、`docs/current/frontend.md`、`docs/current/quality.md`、initiative plan 修改和本 spec 未追踪。
- `git ls-files --others --exclude-standard`：当前只列出本 spec 文件。

## 归档后验证

- `npm run verify:quick`：归档后通过。
- `npm run build`：归档后通过。
- `git diff --check`：归档后通过。
- `diff -u AGENTS.md .claude/CLAUDE.md`：归档后通过，无输出。
- `git ls-files out dist build .vite .tmp`：归档后通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：归档后通过，无输出。
- `git status --short`：归档后只显示本 slice 文档改动和 archived spec 未追踪文件。
- `git ls-files --others --exclude-standard`：归档后只显示 `docs/archive/specs/2026-05-05-2211-state-form-query-foundation/` 下的 4 个归档文件。

## 独立审查

- Claude CLI review：PASS。核对 active spec lifecycle、无 package/source/runtime 变化、无 QueryClient/Zustand/form/resolver/schema/product feature。
- Subagent review 1：PASS。核对 full diff、untracked files、无依赖安装、renderer 静态 shell、current docs 只写当前事实和 gate。
- Subagent review 2：PASS。确认 no-install judgment、package/source grep 和验证记录。

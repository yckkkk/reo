# 验证

## TDD

本 slice 不改变 runtime 行为，不新增 component source、alias、utility、dependency、test runner 或 UI interaction。

TDD 豁免：不执行 RED/GREEN/REFACTOR。

## Context7 核对

- shadcn/ui：`/shadcn-ui/ui`。

## 官方资料核对

- shadcn/ui Vite installation：`https://ui.shadcn.com/docs/installation/vite`。
- shadcn/ui `components.json`：`https://ui.shadcn.com/docs/components-json`。

## 当前源码核对

- `src/renderer/src/main.tsx`：当前是单个静态 shell，没有 reusable component consumer。
- `rg -n "shadcn|components\\.json|components/ui|lib/utils|cn\\(|cva|class-variance-authority|radix|lucide|button|dialog|form|input|card|component|reusable|primitive" package.json package-lock.json src docs/current docs/initiatives/2026-05-05-foundation-completion -S`：package/source 中没有 shadcn/ui setup、component source、renderer alias 或 reusable component consumer。

## 验证结果

- `npx prettier --write docs/current/frontend.md docs/initiatives/2026-05-05-foundation-completion/plan.md docs/specs/2026-05-05-2224-component-ui-foundation/*.md`：通过。
- `npm run verify:quick`：通过。
  - `typecheck`：通过。
  - `test:main`：4 个 Node test runner 测试通过。
  - `lint`：通过。
  - `format:check`：通过。
- `npm run build`：通过。
- `git diff --check`：归档前通过。
- `diff -u AGENTS.md .claude/CLAUDE.md`：归档前通过，无输出。
- `git ls-files out dist build .vite .tmp`：归档前通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：当前 active spec 为 `docs/specs/2026-05-05-2224-component-ui-foundation`，归档后必须为空。
- `git status --short`：当前显示 `docs/current/frontend.md`、initiative plan 修改和本 spec 未追踪。
- `git ls-files --others --exclude-standard`：当前只列出本 spec 文件。

## 归档后验证

- `npm run verify:quick`：归档后通过。
- `npm run build`：归档后通过。
- `git diff --check`：归档后通过。
- `diff -u AGENTS.md .claude/CLAUDE.md`：归档后通过，无输出。
- `git ls-files out dist build .vite .tmp`：归档后通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：归档后通过，无输出。
- `git status --short`：归档后只显示本 slice 文档改动和 archived spec 未追踪文件。
- `git ls-files --others --exclude-standard`：归档后只显示 `docs/archive/specs/2026-05-05-2224-component-ui-foundation/` 下的 4 个归档文件。

## 独立审查

- Claude CLI review：PASS。核对 active spec lifecycle、无 package/source/runtime 变化、无 shadcn init、无 `components.json`、无 component source 或 alias。
- Subagent review 1：PASS。核对 full diff、untracked files、无 shadcn deps/source/alias、frontend docs 只写当前事实和 gate。
- Subagent review 2：PASS。确认 shadcn refusal、official docs premise 和 pre-closeout pending 状态合理。

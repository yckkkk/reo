# 验证

## TDD

本 slice 不改变 runtime 行为，不新增 DB module、schema、migration、driver、IPC 或 renderer API。

TDD 豁免：不执行 RED/GREEN/REFACTOR。

## Context7 核对

- Drizzle：`/drizzle-team/drizzle-orm-docs`。

## 官方资料核对

- Drizzle Kit overview：`https://orm.drizzle.team/docs/kit-overview`。
- Drizzle SQLite + `better-sqlite3`：Context7 source `get-started-sqlite.mdx`。
- `better-sqlite3` API：`https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md`。

## 当前源码核对

- `rg --files src test scripts docs/current docs/initiatives/2026-05-05-foundation-completion | sort`：当前没有 DB module、schema file、migration directory 或 Drizzle config。
- `rg -n "drizzle|better-sqlite3|sqlite|database|db|schema|migration|migrate|transaction|durable|persistence|persist|localStorage|indexedDB|session|auth|query|zustand|tanstack" package.json package-lock.json src test scripts docs/current docs/initiatives/2026-05-05-foundation-completion -S`：package/source 中没有 Drizzle、SQLite、DB access 或 persisted state consumer。

## 验证结果

- `npx prettier --write docs/current/data.md docs/current/flow.md docs/initiatives/2026-05-05-foundation-completion/plan.md docs/specs/2026-05-05-2143-data-foundation/*.md`：通过。
- `npm run verify:quick`：通过。
  - `typecheck`：通过。
  - `test:main`：4 个 Node test runner 测试通过。
  - `lint`：通过。
  - `format:check`：通过。
- `npm run build`：通过。
- `git diff --check`：归档前通过。
- `diff -u AGENTS.md .claude/CLAUDE.md`：归档前通过，无输出。
- `git ls-files out dist build .vite .tmp`：归档前通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：当前 active spec 为 `docs/specs/2026-05-05-2143-data-foundation`，归档后必须为空。
- `git status --short`：当前显示 `docs/current/data.md`、`docs/current/flow.md`、initiative plan 修改和本 spec 未追踪。
- `git ls-files --others --exclude-standard`：当前只列出本 spec 文件。

## 归档后验证

- `npm run verify:quick`：归档后通过。
- `npm run build`：归档后通过。
- `git diff --check`：归档后通过。
- `diff -u AGENTS.md .claude/CLAUDE.md`：归档后通过，无输出。
- `git ls-files out dist build .vite .tmp`：归档后通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：归档后通过，无输出。
- `git status --short`：归档后只显示本 slice 文档改动和 archived spec 未追踪文件。
- `git ls-files --others --exclude-standard`：归档后只显示 `docs/archive/specs/2026-05-05-2143-data-foundation/` 下的 4 个归档文件。

## 独立审查

- Claude CLI review：PASS。核对 full diff、untracked files、docs lifecycle、无依赖/源码扩张、无 DB/schema/migration/product feature。
- Subagent review 1：PASS。核对 active spec lifecycle、无 package/source/runtime change、无 Drizzle/SQLite/Auth install。
- Subagent review 2：PASS。确认当前真源支持 DB refusal，required checks 已记录。
- Final pre-commit review：第一轮 FAIL，指出归档后的 `README.md` 仍写 `Active spec`。
- Fix：已将归档 `README.md` 状态改为 `Archived spec`。

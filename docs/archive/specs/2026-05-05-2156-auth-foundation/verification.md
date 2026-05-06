# 验证

## TDD

本 slice 不改变 runtime 行为，不新增 auth source、preload、IPC、schema、storage、renderer API 或 UI。

TDD 豁免：不执行 RED/GREEN/REFACTOR。

## Context7 核对

- Better Auth：`/better-auth/better-auth`。

## 官方资料核对

- Better Auth Electron integration：`https://better-auth.com/docs/integrations/electron`。

## 当前源码核对

- `rg --files src test scripts | sort`：当前没有 auth source、preload source、IPC source、DB source 或 schema source。
- `rg -n "better-auth|Better Auth|auth|session|oauth|login|sign|token|cookie|credential|user|account|electron|ipc|preload|database|schema|drizzle|sqlite" package.json package-lock.json src test scripts docs/current docs/initiatives/2026-05-05-foundation-completion -S`：package/source 中没有 Better Auth、auth source、session lifecycle、auth storage、DB schema 或 auth UI。

## 验证结果

- `npx prettier --write docs/current/data.md docs/current/flow.md docs/current/electron.md docs/current/quality.md docs/initiatives/2026-05-05-foundation-completion/plan.md docs/specs/2026-05-05-2156-auth-foundation/*.md`：通过。
- `npm run verify:quick`：通过。
  - `typecheck`：通过。
  - `test:main`：4 个 Node test runner 测试通过。
  - `lint`：通过。
  - `format:check`：通过。
- `npm run build`：通过。
- `npm start -- -- --remote-debugging-port=9335`：通过，并输出 `DevTools listening on ws://127.0.0.1:9335/...`。
- CDP runtime evidence：

```json
{
  "command": "npm start -- -- --remote-debugging-port=9335",
  "url": "reo-app://renderer/index.html",
  "csp": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; worker-src 'none'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "windowOpenDenied": true,
  "externalNavigationPrevented": true,
  "permissionDenied": true,
  "geolocationPermission": "denied",
  "finalUrl": "reo-app://renderer/index.html"
}
```

- `git diff --check`：归档前通过。
- `diff -u AGENTS.md .claude/CLAUDE.md`：归档前通过，无输出。
- `git ls-files out dist build .vite .tmp`：归档前通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：当前 active spec 为 `docs/specs/2026-05-05-2156-auth-foundation`，归档后必须为空。
- `git status --short`：当前显示 `docs/current/data.md`、`docs/current/electron.md`、`docs/current/flow.md`、`docs/current/quality.md`、initiative plan 修改和本 spec 未追踪。
- `git ls-files --others --exclude-standard`：当前只列出本 spec 文件。

## 归档后验证

- `npm run verify:quick`：归档后通过。
- `npm run build`：归档后通过。
- `git diff --check`：归档后通过。
- `diff -u AGENTS.md .claude/CLAUDE.md`：归档后通过，无输出。
- `git ls-files out dist build .vite .tmp`：归档后通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：归档后通过，无输出。
- `git status --short`：归档后只显示本 slice 文档改动和 archived spec 未追踪文件。
- `git ls-files --others --exclude-standard`：归档后只显示 `docs/archive/specs/2026-05-05-2156-auth-foundation/` 下的 4 个归档文件。

## 独立审查

- Claude CLI review：PASS。核对 active spec lifecycle、无 package/source/runtime/preload/IPC/auth UI 变更、无 Better Auth 安装，`npm start` runtime evidence 已记录。
- Subagent review 1：FAIL。Auth refusal 判断通过；指出 review 状态和 archive/lifecycle checks 尚未完成，不能作为完成态 proof package。
- Subagent review 2：FAIL。Auth refusal 判断通过；指出 review 状态仍为 pending，archive 前不得收口。
- Fix：已将本轮 review 结果写入 spec，并仅在 review 实际完成后标记 review task done；archive 和归档后 lifecycle checks 仍按顺序执行。
- Final Claude CLI review：PASS。确认 `docs/specs` 为空、archive 状态正确、无 Better Auth/package/source/auth surface 变更，post-archive checks 和 review evidence 已记录。
- Final subagent review 1：FAIL。指出已修复 blocker 后缺少复审 PASS 记录。
- Final subagent review 2：PASS。确认 hard boundaries 满足；提交时必须 stage archived spec 文件。
- Fix：记录 final re-review evidence，并在提交前 stage tracked docs 与 `docs/archive/specs/2026-05-05-2156-auth-foundation/`。

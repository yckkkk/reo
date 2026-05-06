# 验证

## TDD

本 slice 不改变 runtime 行为，不新增 logging package、Sentry init、preload bridge、IPC channel、renderer capture 或 error UI。

TDD 豁免：不执行 RED/GREEN/REFACTOR。

## Context7 核对

- Sentry Electron：`/getsentry/sentry-electron`。

## 官方资料核对

- Sentry Electron：`https://docs.sentry.io/platforms/javascript/guides/electron/`。
- `electron-log` README：`https://www.npmjs.com/package/electron-log`。

## 当前源码核对

- `rg -n "electron-log|Sentry|@sentry|captureException|crash|log\\.|logger|console\\.|error shape|error|diagnostic|telemetry|observability|source map|sourcemap|unhandled|uncaught|rejection" package.json package-lock.json src test scripts docs/current docs/initiatives/2026-05-05-foundation-completion -S`：package/source 中没有 electron-log、Sentry、renderer capture 或 logging bridge；source 命中只有既有 `console.warn/error` bootstrap/protocol/dev-server/fatal exception 诊断。
- `npm ls electron-log @sentry/electron --depth=0`：exit 1，输出 `(empty)`，确认未安装。

## Pre-archive 验证

- `npx prettier --write docs/current/quality.md docs/current/electron.md docs/current/flow.md docs/initiatives/2026-05-05-foundation-completion/plan.md docs/specs/2026-05-05-2234-logging-error-foundation/*.md`：通过。
- `npm run verify:quick`：通过，typecheck、`test:main`、lint、format check 均通过。
- `npm run build`：通过，`electron-vite build --ignoreConfigWarning` 成功生成未跟踪 build output。
- `git diff --check`：通过，无输出。
- `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无输出。
- `git ls-files out dist build .vite .tmp`：通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：仅输出 `docs/specs/2026-05-05-2234-logging-error-foundation`。
- `git status --short`：仅有本 slice docs 修改和 active spec。
- `git ls-files --others --exclude-standard`：仅有 active spec 文件。

Review 修正后重新运行：

- `npm run verify:quick`：通过，typecheck、`test:main`、lint、format check 均通过。
- `npm run build`：通过，`electron-vite build --ignoreConfigWarning` 成功。
- `git diff --check`：通过，无输出。
- `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无输出。
- `git ls-files out dist build .vite .tmp`：通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：仅输出 `docs/specs/2026-05-05-2234-logging-error-foundation`。
- `git status --short`：仅有本 slice docs 修改和 active spec。
- `git ls-files --others --exclude-standard`：仅有 active spec 文件。

## Runtime 证据

本 slice 未修改 Electron runtime、生产加载、CSP、protocol、navigation、permission、renderer capture、preload 或 IPC logging，因此不需要额外 `npm start` runtime evidence。

## Pre-archive review

- Feynman subagent：PASS。无 blocker，确认 docs-only、无 package/source/runtime 变更、无 logging/Sentry install/init、runtime evidence 不需要。
- Claude CLI：PASS。无 blocker，确认 Task 08 正确限定为 docs-only gate。
- Godel subagent：FAIL。指出 `src/main/index.ts` 已有 `uncaughtException` fatal-error path，原 spec/verification 把现有 main diagnostics 写成只有 bootstrap/protocol/dev-server 不准确。

## Review 修正

- 修正：`docs/current/flow.md`、本 spec 和 verification 已显式记录最小 fatal exception path，并把门槛收窄为没有 structured diagnostic lifecycle/background error reporting flow。
- Godel targeted re-review：PASS。确认 previous blocker 已修复，source fatal exception path 与 current/spec/verification 表述一致。
- Claude CLI targeted re-review：PASS。确认没有 package/source/runtime 变更，没有 `electron-log` 或 Sentry install/init。

## Post-archive 验证

- `npm run verify:quick`：通过，typecheck、`test:main`、lint、format check 均通过。
- `npm run build`：通过，`electron-vite build --ignoreConfigWarning` 成功。
- `git diff --check`：通过，无输出。
- `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无输出。
- `git ls-files out dist build .vite .tmp`：通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：通过，无输出。
- `git status --short`：仅有本 slice docs 修改、initiative 状态更新和 archived spec。
- `git ls-files --others --exclude-standard`：仅有 archived spec 文件。

## Final pre-commit 验证

- `npm run verify:quick`：通过，typecheck、`test:main`、lint、format check 均通过。
- `npm run build`：通过，`electron-vite build --ignoreConfigWarning` 成功。
- `git diff --check`：通过，无输出。
- `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无输出。
- `git ls-files out dist build .vite .tmp`：通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：通过，无输出。
- `git status --short`：仅有本 slice docs 修改、initiative 状态更新和 archived spec。
- `git ls-files --others --exclude-standard`：仅有 archived spec 文件。

## Final pre-commit review

- Feynman final review：FAIL。指出 initiative plan Task 08 验证行未勾选。
- Godel final adversarial review：FAIL。指出 initiative plan Task 08 验证行未勾选，且 archive verification 保留 stale `待运行` 文本。
- Claude CLI final review：PASS。
- 修正：initiative plan Task 08 验证行已勾选，archive verification 的 stale `待运行` 文本已删除。
- Targeted final re-review：Feynman、Godel 和 Claude CLI 均 PASS，确认 final blockers 已修复。

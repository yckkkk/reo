# 验证

## TDD

本 slice 不改变 runtime 行为，不新增 Forge、maker、fuse、signing、notarization、publish、updater package/config/script 或 source。

TDD 豁免：不执行 RED/GREEN/REFACTOR。

## Context7 核对

- Electron Forge：`/electron-forge/electron-forge-docs`。
- electron-updater / electron-builder：`/electron-userland/electron-builder`。
- Electron：`/electron/electron`。

## 官方资料核对

- Electron Forge configuration：`https://www.electronforge.io/config/configuration`。
- Electron Forge makers：`https://www.electronforge.io/config/makers`。
- Electron fuses：`https://www.electronjs.org/docs/latest/tutorial/fuses`。
- Electron code signing：`https://www.electronjs.org/docs/latest/tutorial/code-signing`。
- electron-builder auto update：`https://www.electron.build/auto-update.html`。
- electron-builder publish：`https://www.electron.build/publish.html`。

## 当前源码核对

- `npm ls @electron-forge/cli @electron-forge/plugin-vite @electron-forge/maker-zip @electron-forge/maker-dmg @electron-forge/maker-squirrel @electron/fuses electron-updater --depth=0`：exit 1，输出 `(empty)`，确认未安装。
- `rg -n "forge|electron-updater|autoUpdater|@electron-forge|@electron/fuses|asar|notar|sign|maker|publish|appId|productName|buildIdentifier|artifact|update" package.json package-lock.json electron.vite.config.ts src test docs/current docs/initiatives/2026-05-05-foundation-completion -S`：package/source 中没有 Forge、updater、fuse、packaging config 或 updater runtime；命中主要是 existing docs gate 和 unrelated browserlist/update 字样。

## Pre-archive 验证

- `npx prettier --write docs/current/electron.md docs/current/quality.md docs/current/flow.md docs/initiatives/2026-05-05-foundation-completion/plan.md docs/specs/2026-05-05-2255-packaging-update-foundation/*.md`：通过。
- `npm run verify:quick`：通过，typecheck、`test:main`、lint、format check 均通过。
- `npm run build`：通过，`electron-vite build --ignoreConfigWarning` 成功。
- `git diff --check`：通过，无输出。
- `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无输出。
- `git ls-files out dist build .vite .tmp`：通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：仅输出 `docs/specs/2026-05-05-2255-packaging-update-foundation`。
- `git status --short`：仅有本 slice docs 修改和 active spec。
- `git ls-files --others --exclude-standard`：仅有 active spec 文件。

## Runtime / packaged app 证据

本 slice 未新增 Forge、packaging config、fuses、ASAR、signing、notarization、updater、production loading、CSP、protocol、navigation 或 permission 行为，因此不需要 packaged launch 或 `npm start` runtime evidence。

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

- Tesla final review：FAIL。指出 initiative plan Task 09 验证行未勾选。
- Aquinas final adversarial review：FAIL。指出 initiative tasks 已完成但 plan Task 09 验证行仍未勾选。
- Claude CLI final review：FAIL。指出同一 checklist blocker。
- 修正：initiative plan Task 09 验证行已勾选，并说明 packaged launch evidence 不适用。
- Targeted final re-review：Tesla、Aquinas 和 Claude CLI 均 PASS，确认 final blocker 已修复。

## Pre-archive review

- Tesla subagent：PASS。无 blocker，确认 docs-only、无 package/source/runtime 变更，deferring packaging/updater 合理。
- Aquinas subagent：PASS。无 blocker，确认不应安装 Forge/updater/fuses，packaged launch evidence 正确不适用。
- Claude CLI：PASS。无 blocker，确认 current docs gates、official docs evidence 和 verification 充分。

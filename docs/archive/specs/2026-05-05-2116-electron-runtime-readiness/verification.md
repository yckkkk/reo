# 验证

## TDD

本 slice 不改变 runtime 行为，不新增 preload、IPC、handler、renderer API 或测试 runner。

TDD 豁免：不执行 RED/GREEN/REFACTOR。

## Context7 核对

- Electron：`/electron/electron`。

## 当前源码核对

- `rg --files src/main src/renderer test scripts | sort`：当前没有 preload source、IPC source 或 renderer API source。
- `rg -n "preload|ipc|contextBridge|ipcRenderer|ipcMain|window\\.api|electron|node:|fs|path|child_process|require\\(" src test docs/current docs/initiatives/2026-05-05-foundation-completion -g '!docs/current/design-system/**'`：源码中没有 preload/IPC/window API；renderer 不直接 import Electron/Node。
- `src/renderer/src/main.tsx`：当前是静态 shell，无 privileged capability consumer。

## 验证结果

- `npx prettier --write docs/current/electron.md docs/current/flow.md docs/initiatives/2026-05-05-foundation-completion/plan.md docs/specs/2026-05-05-2116-electron-runtime-readiness/*.md`：通过。
- `npm run verify:quick`：通过。
  - `typecheck`：通过。
  - `test:main`：4 个 Node test runner 测试通过。
  - `lint`：通过。
  - `format:check`：通过。
- `npm run build`：通过。
- Electron runtime evidence：第一轮不合格。
  - Attempted command：`./node_modules/.bin/electron . --remote-debugging-port=9333`。
  - Result：CDP evidence covered production URL、CSP、window-open deny、external navigation deny、permission deny, but reviewers rejected it because `docs/current/electron.md` requires `npm start` evidence.
- Electron runtime evidence：第二轮通过。
  - `npm start -- --remote-debugging-port=9333`：失败，`electron-vite preview` 不接受 `--remote-debugging-port` option。
  - 本地 `electron-vite` preview CLI 核对：preview 只通过 `--` separator 把 `ELECTRON_CLI_ARGS` 转发给 Electron。
  - `npm start -- -- --remote-debugging-port=9333`：通过，并输出 `DevTools listening on ws://127.0.0.1:9333/...`。
  - CDP evidence：

```json
{
  "command": "npm start -- -- --remote-debugging-port=9333",
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
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：当前 active spec 为 `docs/specs/2026-05-05-2116-electron-runtime-readiness`，归档后必须为空。
- `git status --short`：当前显示 `docs/current/electron.md`、`docs/current/flow.md`、initiative plan 修改和本 spec 未追踪。
- `git ls-files --others --exclude-standard`：当前只列出本 spec 文件。

## 归档后验证

- `npm run verify:quick`：归档后通过。
- `npm run build`：归档后通过。
- `git diff --check`：归档后通过。
- `diff -u AGENTS.md .claude/CLAUDE.md`：归档后通过，无输出。
- `git ls-files out dist build .vite .tmp`：归档后通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：归档后通过，无输出。
- `git status --short`：归档后只显示本 slice 文档改动和 archived spec 未追踪文件。
- `git ls-files --others --exclude-standard`：归档后只显示 `docs/archive/specs/2026-05-05-2116-electron-runtime-readiness/` 下的 4 个归档文件。

## 独立审查

- Claude CLI review：PASS。核对 full diff、untracked files、docs lifecycle、无依赖/源码扩张、`npm start` runtime evidence。
- Subagent review 1：第一轮 FAIL，指出 runtime evidence 不是 `npm start` 路径；修正后第二轮 PASS。
- Subagent review 2：第一轮 FAIL，指出验证项过早标完成且 runtime evidence 不是 `npm start` 路径；修正后第二轮 PASS。

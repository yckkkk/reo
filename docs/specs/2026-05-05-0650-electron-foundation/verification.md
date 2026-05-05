# 验证

## 当前状态

验证通过，提交前独立审查通过。

## 静态审查

- `app.enableSandbox()` 在 app ready 前调用。
- `registerSchemesAsPrivileged()` 在 app ready 前调用。
- `protocol.handle()` 在 app ready 后注册。
- BrowserWindow 使用安全 webPreferences。
- `reo-app://` 只允许 `renderer` host。
- Renderer asset path 使用 `path.relative` 做 containment check。
- Dev server URL 只接受 loopback `http` 或 `https` origin。
- Packaged app 忽略 `ELECTRON_RENDERER_URL`。
- 权限请求、权限检查和设备权限默认拒绝。
- 新窗口默认拒绝。
- 非可信导航默认阻止。
- 生产 CSP 不包含 `unsafe-inline` 或 `unsafe-eval`。

## 独立审查采纳

- 采纳：当前基线无代码级阻断。
- 采纳：runtime 证据必须覆盖 production protocol、CSP、navigation、window-open 和 permission baseline。
- 采纳：Forge、fuses、updater、signing、ASAR 属于 packaging slice。
- 采纳：未来 IPC 必须使用窄 `contextBridge` API、payload validation 和 sender validation。
- 拒绝：当前新增 preload stub。
- 拒绝：当前新增 `supportFetchAPI` 或 `bypassCSP`。
- 拒绝：当前安装 Vitest 或新增自动化安全回归测试。

## TDD 证据

RED：

```bash
npm run test:main
```

结果：`packaged app ignores ELECTRON_RENDERER_URL` 失败，actual 为 `http://127.0.0.1:5173`，expected 为 `null`。

GREEN：

```bash
npm run test:main
```

结果：4 tests passed，0 failed。

## 命令

```bash
npm run verify:quick
```

结果：通过。包含 typecheck、`test:main`、lint 和 format check。`test:main` 结果为 4 tests passed，0 failed，并包含 IPv6 loopback 断言。

```bash
npm run build
```

结果：通过。生成 `out/main/index.js`、`out/renderer/index.html`、renderer CSS 和 renderer JS。

```bash
npm start
```

结果：通过启动到 `starting electron app...`。该命令不接受 Electron remote debugging 参数。

```bash
npx electron --remote-debugging-port=9223 .
```

结果：runtime 检查通过。

## Runtime 证据

CDP 页面目标：

```text
reo-app://renderer/index.html
```

CSP header：

```text
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; worker-src 'none'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

Runtime assertions：

- `cspHasUnsafeInline`: `false`
- `cspHasUnsafeEval`: `false`
- `window.open('https://example.com')`: `opened: false`
- 外部 navigation 后 location 仍为 `reo-app://renderer/index.html`
- `navigator.permissions.query({ name: 'geolocation' })`: `denied`
- `reo-app://evil/index.html` navigation 后 location 仍为 `reo-app://renderer/index.html`

## Repo 证据

```bash
diff -u AGENTS.md .claude/CLAUDE.md
```

结果：无差异。

```bash
git ls-files out dist build .vite
```

结果：无输出，build artifact 未被 git 跟踪。

## 提交前独立审查

独立 `$review` subagent 结果：PASS。

第一次审查覆盖 current uncommitted diff、untracked files、`npm run verify:quick`、`git diff --check`、agent 入口镜像、build artifact 跟踪状态和 Electron foundation scope。

补充 IPv6 loopback 断言后，第二次最终审查覆盖 current uncommitted diff、untracked files、`npm run verify:quick`、docs/spec verification count、`package.json` scripts、packaged dev server URL gate、tracked build artifacts、`git diff --check` 和 agent 入口镜像。

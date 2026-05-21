# 产品功能说明与工程实现说明 — CM6-ready Style-Nonce CSP 基线（Stage 0）

> 本文件是可直接执行的工程依据。下一 session 按第 17 节代码任务拆解执行，按第 19 节验收。
> 设计已按 plan review（见 implementation-notes.md「计划审查修订」）修订：协议处理器是 app 文档 CSP 的唯一所有者，`onHeadersReceived` 对生产文档放行；测试用 `node:test`（main）+ Vitest（renderer）。

## 1. 任务复杂度判断

**高复杂度（Electron 安全基线改动）。** 改动落在 main 进程 CSP 与自定义协议响应、renderer 文档模板，触及 Reo 硬红线（不放松 CSP/sandbox）。代码量不大，但安全语义、生产/开发差异、协议响应与 `onHeadersReceived` 的职责划分必须精确，且必须有运行时证据。保留较完整结构；无终端 UI，故第 8、9、10、13 节裁剪。

## 2. 推荐实现路径

**最短正确路径：`reo-app://` 协议处理器是「app 文档」CSP 的唯一所有者；`onHeadersReceived` 对生产文档放行、只为子资源套静态 CSP。**

- 协议处理器响应 app 文档（解析后的 `index.html`，含空路径 `/` 与 `/index.html`）时：生成 per-load 随机 nonce，注入 HTML meta 占位符，并在该响应头写入带 `style-src 'self' 'nonce-<value>'` 的生产文档 CSP。
- `onHeadersReceived`：开发环境（dev server 提供文档）仍对所有 app page 套 dev CSP（dev 不经协议处理器）；生产环境对「app 文档请求」放行（不写 CSP，由协议处理器拥有），对「子资源请求」套静态生产 CSP。
- renderer 端读取 meta nonce 的能力推迟到 Stage 1（届时才有 `EditorView.cspNonce` 消费者）；Stage 0 只放置 meta 并用运行时 console 验证可读性。

**为什么是这条**：CM6 样式由 renderer JS 运行时注入，nonce 必须同时出现在「文档 CSP 头」和「renderer 可读处（meta）」且一致。唯一能同时改写响应体（注入 meta）和响应头（写 CSP）的位置是协议处理器，因此让它独占文档 CSP；`onHeadersReceived` 只需用一个与协议处理器共享的纯谓词 `isAppDocumentPath` 判断「是否生产文档」并放行，**不依赖回读协议响应头**（比「不覆盖已存在 CSP」更稳，消除 Electron 对自定义协议响应头在 webRequest 中可见性的不确定性）。决策被抽成纯函数，可在 `test/main` 单测。

**排除的路径**：

- **`onHeadersReceived` 单独生成 nonce**：无法改写响应体、无法传给 renderer；各自生成会不一致。排除。
- **「`onHeadersReceived` 不覆盖已存在 CSP」检测**（原始草案）：依赖 webRequest 能回读协议处理器设置的 CSP 头，Electron 41 下对自定义协议该行为不确定，失败会静默用静态 CSP 覆盖 nonce CSP → fail closed。改为按请求是否为文档放行，不回读响应头。排除。
- **静态/硬编码 nonce**：等价 `unsafe-inline`，违反安全基线。排除。
- **`sha256-` hash 白名单 / 抽静态样式表**：CM StyleModule 内容随版本变化、且无官方开关关闭 baseTheme 运行时注入，脆弱/不可行。排除。
- **生产 `style-src` 加 `unsafe-inline`**：违反硬红线。排除。

## 3. 本次需求目标

### 3.1 用户目标

终端用户无直接可见变化；为「笔记 Live Preview 编辑器」铺路。最终受益：未来笔记编辑器在生产环境样式正常、安全不降级。

### 3.2 产品体验目标

生产环境不因安全策略导致编辑器样式丢失/白屏；安全气质不让步。

### 3.3 功能目标

生产 CSP 在保持 `style-src` 无 `unsafe-inline` 的前提下，允许带 per-load nonce 的运行时注入 `<style>` 生效；nonce 经 index.html meta 可被 renderer 读取。

### 3.4 当前版本范围

main 生成 nonce → 注入 index.html meta + 文档响应 CSP 头带 nonce → onHeadersReceived 对生产文档放行、子资源套静态 CSP → 运行时验证 nonce 可读且生效 → 文档更新。

### 3.5 当前版本不包含

不装 `@codemirror/*`、不改 `NoteEditorOverlay`、不引入 script nonce、不改其它 CSP 指令、不改 `reo-attachment://`、**不新增 renderer nonce helper（推迟到 Stage 1）**。

## 4. 输入信息理解

### 4.1 已确认信息（仓库源码事实）

- `src/main/securityPolicy.ts`：生产 `PROD_CSP_DIRECTIVES` 含 `style-src 'self'`（无 unsafe-inline）；dev 含 `'unsafe-inline' 'unsafe-eval'`。`createContentSecurityPolicy({ devConnectSources, usesDevServer })` 返回拼接串。
- `src/main/security.ts`：`setupContentSecurityPolicy()` setup 时算一次 `policy`，在 `onHeadersReceived` 对 app page（prod：`reo-app://` 前缀；dev：dev-server origin）无条件写 `Content-Security-Policy: [policy]`，并 spread 既有响应头。
- `src/main/appProtocol.ts`：`protocol.handle(APP_SHELL_SCHEME)` 用 `resolveRendererAsset` 解析路径（**空路径段→`index.html`**，见 `:67`），`net.fetch(pathToFileURL(assetPath))` 流式返回。`getAppShellUrl('index.html')` = `reo-app://<host>/index.html`。
- `src/main/index.ts`：prod `loadURL(getAppShellUrl('index.html'))`；dev `loadURL(DEV_SERVER_URL)`。
- `src/renderer/index.html`：极简 `<head>`，无 meta nonce。
- **测试 harness（已核实）**：main 测试在 `test/main/*.test.ts`，用 `node:test` + `node:assert/strict`，经 `scripts/run-main-tests.mjs`（`tsc -p tsconfig.main.test.json` 后 `node --test`）运行；`npm run test:main` 是 `verify:quick` 一环。`test/main/securityPolicy.test.ts` 从 `../../src/main/security.js` 直接 import 纯函数测试；`test/main/appProtocol.test.ts` 用 TypeScript AST 对**源码文本**做断言、不执行 `protocol.handle`。renderer 测试用 Vitest + jsdom（`vitest.config.ts` jsdom project）。
- CM6 `EditorView.cspNonce` facet 存在；`EditorView.cspNonce.of("...")` 把 nonce 加到运行时注入 `<style>`（决策 0007 / 归档 spike evidence）。
- 依赖：electron `^41.5.0`、React `^19.2.0`、Vite `^8.0.10`、Vitest `^4.1.5`、jsdom `^29.1.1`、TypeScript `^6.0.3`。

### 4.2 仓库约束

- 硬红线：不放松 sandbox / contextIsolation / nodeIntegration / webSecurity / CSP / permission / navigation；变更 Electron security/protocol/CSP 必须更新 `docs/current/electron.md`。
- 自定义 protocol 必须保留 privileged scheme 注册时序、host allowlist、path containment、CSP、handler 注册时序。
- 行为变更走真实 TDD；涉及生产加载/CSP/protocol 必须 `npm run build` + `npm start` 并记录 runtime 证据（production URL、CSP header、新窗口拒绝、外部导航拒绝、权限默认拒绝）。
- main 模块 ESM（`.js` 扩展 import）；**main 测试用 `node:test` 放 `test/main/`，不是 colocated Vitest**；renderer 测试用 Vitest+jsdom。

### 4.3 AI 推导输入

- nonce 用 main `node:crypto` `randomBytes(16).toString('base64url')`（避免 `+ / =` 进入 meta 属性；CSP nonce 接受 base64url）。【AI 推导输入】
- meta 占位符 `__REO_STYLE_NONCE__`，meta name `reo-style-nonce`。【AI 推导输入，可评审调整】
- 文档判定 `isAppDocumentPath(pathname)`：规范化后为 `''`、`/`、`/index.html` 视为文档。与 `resolveRendererAsset` 空路径→index.html 一致。【AI 推导输入】

### 4.4 信息优先级处理

仓库真实代码 > 本 spec 推导。若评审/实现发现把 index.html 文档分支改文本响应会破坏子资源流式响应，则只对 `isAppDocumentPath(parsed.pathname)` 命中的文档分支改文本响应，子资源保持 `net.fetch` 流式。

### 4.5 假设

- A1：app 只有一个顶层文档 `index.html`；其它 reo-app:// 响应均为子资源（js/css/字体/图片），不注入样式、无需 nonce。
- A2（已重构降风险）：协议处理器在 Response 头设置的 CSP 会被 Electron 应用到文档（标准行为）。本设计**不再**依赖 `onHeadersReceived` 回读该头——它对生产文档直接放行。
- A3：dev 文档由 Vite dev server 提供、不经协议处理器，dev CSP `unsafe-inline` 覆盖 CM 样式，dev 不受影响。

### 4.6 待确认项

- 【高·安全】runtime 必须验证：生产文档响应头 CSP 确含 `style-src 'self' 'nonce-<X>'` 且 meta 同值，`onHeadersReceived` 放行后该 CSP 抵达文档、未被静态 CSP 覆盖。这是唯一可能返工点，**作为执行第 1 步先验证**（见第 17.18）。
- 【中】Stage 0 的合成样式验证只能证明「CSP 头 + 浏览器 nonce 机制」正确，**不能证明 CM6 style-mod 经 `EditorView.cspNonce` 注入的 `<style>` 一定带上 nonce**；Stage 1 必须在真机生产环境用真实 CM6 复验（见第 16/19 节）。
- 【低】meta name / 占位符 / nonce 编码最终值。

## 5. 功能类型判断

基础设施 / 安全基线 / 构建与运行时配置。无 UI、无数据模型、无权限角色变化。

## 6. 使用场景

- 触发者：生产启动加载 renderer 文档（`loadURL(reo-app://…/index.html)`）。
- 前置条件：生产加载路径（`usesDevServer === false`）。
- 成功结果：文档响应头 CSP `style-src` 含 `'self' 'nonce-<随机>'`，HTML meta 含同一 nonce，renderer 可读。
- 失败结果：nonce 缺失/不一致 → 后续 CM 样式被拦截（本 stage 合成验证应能复现并据此判失败）。

## 7. 流程说明

```
app 启动（prod）→ loadURL(reo-app://<host>/index.html)
  → protocol.handle(reo-app)：isAppDocumentPath(path) === true（文档分支）
      → generateStyleNonce()
      → 读 out/renderer/index.html 文本 → injectStyleNonce(html, nonce)
      → return Response(html, { headers: { Content-Type: text/html; charset=utf-8,
                                            Content-Security-Policy: createProductionDocumentCsp(nonce) } })
  → onHeadersReceived：prod + isTrustedAppDocument(host+path) → 放行（不写 CSP）；非受信 host 一律 apply-static
  → 文档加载，<meta reo-style-nonce> 携带 nonce
  → (Stage 1) readStyleNonce() → EditorView.cspNonce.of(nonce) → CM 注入带 nonce 的 <style> → 生效

子资源（/assets/*）：协议处理器 net.fetch 流式（无 CSP 头）
  → onHeadersReceived：prod + 非文档 → 套静态生产 CSP（createContentSecurityPolicy，无 nonce）
dev：文档与资源均由 dev server 提供 → onHeadersReceived 套 dev CSP（含 unsafe-inline），协议处理器不参与
```

## 8–10.（UI 状态 / 组件 / 交互规则）

无终端 UI 与交互。唯一「界面级」可见物是 index.html 隐藏 meta，不渲染、不可交互。

## 11. 状态机

无业务状态机。运行时只有「文档响应是否携带 nonce CSP」二态，由协议处理器分支决定，不持久化、无回滚态（每次加载独立生成）。

## 12. 数据规则

| 数据 | 类型 | 来源 | 生命周期 | 说明 |
| --- | --- | --- | --- | --- |
| styleNonce | base64url string | main `crypto.randomBytes(16)` | 每次文档加载新生成，不持久化 | 仅出现在文档 CSP 头与 index.html meta；不写 Query/DOM dataset/日志/registry/文件/IPC |

### 4.x 安全不变量

nonce per-load 随机、不可跨加载复用、不入日志（避免可预测性）、不进 IPC。

## 13. 权限规则

无角色/鉴权变化。保持 permission default deny、`script-src 'self'`、不放松其它指令。

## 14. 工程实现说明

### 14.1 main — securityPolicy.ts（Electron-free 纯函数之家）

> **测试可导入边界（关键）**：`appProtocol.ts` 顶层 `import { app, net, protocol } from 'electron'`，`node --test`（`scripts/run-main-tests.mjs` 跑的环境）无 Electron runtime，故 `test/main/appProtocol.test.ts` 刻意只做 TS-AST/文本断言、**不 import appProtocol.ts**。因此**全部可单测纯函数必须放在 Electron-free 的 `securityPolicy.ts`**（该文件当前无 electron import，`test/main/securityPolicy.test.ts` 已直接 import 它）；`appProtocol.ts` 只 import 并编排，不在其中定义纯函数。

放入 `securityPolicy.ts` 的纯函数（均 node:test 直接 import）：

- `createProductionDocumentCsp(nonce: string): string`：基于现有 `PROD_CSP_DIRECTIVES`，仅把 `style-src 'self'` 替换为 `style-src 'self' 'nonce-${nonce}'`，其余指令逐字不变，`; ` 拼接。
- `isAppDocumentPath(pathname: string): boolean`：规范化后 `''`/`/`/`/index.html` → true。
- `generateStyleNonce(): string`、`injectStyleNonce(html, nonce): string`（见 §14.2 的语义）。
- 保留 `createContentSecurityPolicy`（dev + 静态生产子资源 CSP）不变。dev CSP 不动。
- （`resolveAppPageCspAction` 放 `security.ts`：该文件只用 `createRequire`/type-only 引 electron，node:test 可 import，现有 `securityPolicy.test.ts` 已从 `../../src/main/security.js` import 验证。）

### 14.2 main — appProtocol.ts（nonce + 文档分支）

- `generateStyleNonce(): string`（定义在 `securityPolicy.ts`；`node:crypto` `randomBytes(16).toString('base64url')`，选 base64url 以避免 `+ / =` 进入 meta 属性）。**CSP nonce 是严格字符串匹配**：CSP header 的 `'nonce-${nonce}'`、index.html meta content、CM 注入 `<style>` 的 nonce 必须是**完全相同的字符串**，不做任何编码转换/解码。该字符串被 Chromium CSP 接受**以 §19.3 runtime 证据为准**；若 runtime 显示不被接受，改用标准 base64 并对 meta 属性做转义。
- `injectStyleNonce(html: string, nonce: string): string`（定义在 `securityPolicy.ts`）：全量替换 `__REO_STYLE_NONCE__`；占位符不存在时原样返回（不抛错）。
- `appProtocol.ts` 从 `securityPolicy.ts` **import** `generateStyleNonce` / `injectStyleNonce` / `createProductionDocumentCsp` / `isAppDocumentPath` 并编排，**不在 appProtocol.ts 内定义这些纯函数**（否则 node:test 无法 import，见 §14.1）。`protocol.handle(APP_SHELL_SCHEME)`：**文档判定用与 `onHeadersReceived` 同一个谓词 `isAppDocumentPath(parsed.pathname)`**（覆盖 `reo-app://<host>/` 空路径与 `/index.html`，且只认根 index.html，不把 `/sub/index.html` 误判为文档）——不要用「解析后 basename === index.html」，那会与 `onHeadersReceived` 的 pathname 判定漂移、违背单一真源。文档分支：`net.fetch` → `.text()` → `injectStyleNonce` → `new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': createProductionDocumentCsp(nonce) } })`。子资源分支：保持现有 `net.fetch` 流式 Response。
- 纯函数（`createProductionDocumentCsp`/`isAppDocumentPath`/`generateStyleNonce`/`injectStyleNonce`）可单测；handler 只编排。

### 14.3 main — security.ts（onHeadersReceived 职责划分，**host-aware**）

- 抽纯决策函数 `resolveAppPageCspAction({ usesDevServer, isTrustedAppDocument }): 'passthrough' | 'apply-static'`：
  - dev（`usesDevServer === true`）→ `apply-static`（dev CSP，文档与资源都套；dev 不经协议处理器）。
  - prod 且 `isTrustedAppDocument === true` → `passthrough`（协议处理器拥有文档 CSP，不写、不覆盖）。
  - prod 其它（子资源、**或非受信 host 的任何 `reo-app://` 响应**，含 wrong-host 的 404/400）→ `apply-static`（静态生产 CSP）。
- `isTrustedAppDocument` = `parsed.hostname === APP_SHELL_HOST` **且** `isAppDocumentPath(parsed.pathname)`。**只有受信 host 的根文档才 passthrough**；`reo-app://<其它 host>/index.html`、path traversal、asset-not-found 等响应**绝不 passthrough**，一律 `apply-static`，避免无 CSP 的 fail-open。
- `onHeadersReceived` 用同一 `isAppDocumentPath` 谓词 + host 校验求 `isTrustedAppDocument`（与协议处理器共享谓词与 host allowlist）；`passthrough` 时回调原 `responseHeaders` 不改 CSP；`apply-static` 时套对应 policy。
- **调用契约**：`resolveAppPageCspAction` 只在请求已判定为 app page（dev origin 或 `reo-app://`）后调用；**非 app page（非 `reo-app://`、非 dev origin）在调用该 helper 之前就维持现有原样放行**（回调原 `responseHeaders`，不套任何 CSP）。dev 行为与现状一致。该 helper 不负责非 app page 分支。

### 14.4 renderer — index.html

- `<head>` 增 `<meta name="reo-style-nonce" content="__REO_STYLE_NONCE__" />`。
- dev 下 Vite 原样提供占位符（dev CSP unsafe-inline，不影响）。
- 构建后须断言 `out/renderer/index.html` 仍含 `__REO_STYLE_NONCE__`（见第 17.18 步骤）。

### 14.5 renderer — nonce helper（推迟到 Stage 1）

- **本 stage 不创建** `readStyleNonce`。理由：Stage 0 无 `EditorView.cspNonce` 消费者，且其真实契约（喂给 CM）只能在 CM 存在时验证；提前创建是无消费者死代码。Stage 0 用运行时 console（第 19.2）验证 meta nonce 可读即可。Stage 1 实现 helper + Vitest jsdom 测试并接 CM。

### 14.6 不涉及

Zustand / TanStack Query / RHF / Zod / shadcn / Tailwind / Better Auth / Drizzle / electron-updater / date-fns / Sentry / Forge 均不涉及。electron-log：不记录 nonce，不新增日志字段。

## 15. 接口、本地数据库与同步

无 IPC 变更、无数据库、无同步。CSP 经协议响应头（文档）与 `onHeadersReceived`（子资源/dev）下发；nonce 仅经 index.html meta 到 renderer，不走 preload/IPC。

## 16. 架构风险与重构建议

- 无补丁化/面条化风险；改动把「静态单一 CSP」升级为「文档 CSP 由协议处理器独占 + 子资源 CSP 由 onHeadersReceived 兜底」，职责清晰、共享一个 `isAppDocumentPath` 谓词避免两处判定漂移。
- 已消除原草案对「onHeadersReceived 回读协议响应头」的依赖（H3）。
- **验证缺口（必须知晓）**：Stage 0 合成验证证明 CSP 头与浏览器 nonce 机制正确，但不证明 CM6 style-mod 经 `EditorView.cspNonce` 注入的 `<style>` 一定带 nonce。Stage 1 必须在真机生产环境复验真实 CM6 样式；如需在 Stage 0 提前 de-risk，可临时本地 import CM6 做一次性挂载验证并在收口前移除（不提交依赖）——默认不做，记为可选。
- 不需要更大重构。

## 17. 代码任务拆解

1. **目标**：生产文档 CSP 带 per-load style nonce 且 renderer 可读，安全基线不放松。
2. **推荐路径**：第 2 节。3. **不推荐路径**：第 2 节排除项。
4. **影响范围**：main 安全/协议 surface + renderer 文档模板 + electron.md。
5. **需查看的现有文件**：`src/main/securityPolicy.ts`、`src/main/security.ts`、`src/main/appProtocol.ts`、`src/main/index.ts`、`src/main/appShellConstants.ts`、`src/renderer/index.html`、`test/main/securityPolicy.test.ts`、`test/main/appProtocol.test.ts`、`scripts/run-main-tests.mjs`、`docs/current/electron.md`。
6. **需修改的文件**：
   - `src/main/securityPolicy.ts`（+`createProductionDocumentCsp`、`isAppDocumentPath`、**`generateStyleNonce`、`injectStyleNonce`**——全部 Electron-free 纯函数集中于此，见 §14.1）
   - `src/main/appProtocol.ts`（**import** securityPolicy 的上述纯函数 + 文档分支注入与 CSP 头；**不在此定义纯函数**）
   - `src/main/security.ts`（`resolveAppPageCspAction` + onHeadersReceived 按受信文档/子资源/wrong-host/dev 分流）
   - `src/renderer/index.html`（meta 占位符）
   - `docs/current/electron.md`（**必更新，且需修订 `:47-49` 现有不变量文本**，目标文本见 §14a）
7. **需新增的文件**：
   - main 纯函数/行为测试加入 `test/main/`（用 `node:test`）：并入 `test/main/securityPolicy.test.ts`（它已 import `security.js`/`securityPolicy.js`）或新增 `test/main/styleNonceCsp.test.ts`。**不要放进 `test/main/appProtocol.test.ts`**（该文件刻意只做 AST/文本断言、不 import 模块）。**不新增 colocated Vitest 文件。**
   - 本 stage **不新增** renderer 文件。
8. **需复用**：`resolveRendererAsset`、`APP_SHELL_SCHEME/HOST`、`createContentSecurityPolicy`、协议注册时序、`test/main` 既有 `node:test` 模式。
9. **需新增/调整类型/函数**（标注所在文件，确保 node:test 可 import）：`securityPolicy.ts` → `createProductionDocumentCsp(nonce): string`、`isAppDocumentPath(pathname): boolean`、`generateStyleNonce(): string`、`injectStyleNonce(html, nonce): string`；`security.ts` → `resolveAppPageCspAction({ usesDevServer, isTrustedAppDocument }): 'passthrough' | 'apply-static'`（host-aware：`isTrustedAppDocument = hostname === APP_SHELL_HOST && isAppDocumentPath(pathname)`）+ 推荐的可测 harness `resolveContentSecurityPolicyResponse({ detailsUrl, responseHeaders, usesDevServer, devServerOrigins, staticPolicy }) → { responseHeaders }`（返回 callback payload，便于断言「受信文档不写 CSP / 子资源·wrong-host·dev 写对应 CSP / 非 app page 原样」的外部行为，不绑定 Electron session）。`appProtocol.ts` 只 import 上述 securityPolicy 纯函数。
10–16. 无状态/请求/表单/权限角色/IPC/DB/迁移新增；不记录 nonce 日志；协议读 HTML 失败维持现有 404/400 兜底。
17. **测试**（真实 TDD，先红后绿，main 用 `node:test`@`test/main`）：
    - `createProductionDocumentCsp`：含 `style-src 'self' 'nonce-<nonce>'`、其它指令逐字不变、不含 `unsafe-inline`。
    - `isAppDocumentPath`：`''`/`/`/`/index.html`→true；`/assets/x.js`/`/foo/index.html`→false（仅根 index.html 视为文档）。
    - `generateStyleNonce`：非空、base64url 字符集、多次不重复。
    - `injectStyleNonce`：替换占位符；缺失原样返回；多占位符全替换。
    - `resolveAppPageCspAction`（host-aware）：dev→apply-static；prod 受信 host 根文档→passthrough；prod 受信 host 子资源→apply-static；**prod wrong-host + `/index.html`→apply-static**；prod wrong-host asset→apply-static。
    - **行为断言优先于源码断言**：首选把 `onHeadersReceived` 的决策提取为可单测的纯函数/可注入 harness，断言其在「prod 受信文档→不写 CSP、回调原 headers」「prod 子资源/wrong-host/dev→写对应 CSP」「非 app page→原样放行」下的**回调输出**。若一时无法注入 handler，再退而用最小 TS-AST/文本 guard（仿 `test/main/appProtocol.test.ts`）只确认 passthrough 分支不写 `Content-Security-Policy`；不要把测试过度绑定到「调用了某函数」这种实现细节。
18. **实现步骤**：
    1) **先 de-risk A2/runtime（throwaway scratch diff，两处都要改）**：当前 `setupContentSecurityPolicy()` 对**所有**生产 `reo-app://` app page 无条件覆盖静态 CSP（`security.ts` 用 `details.url.startsWith('reo-app://')` 判定、总是写 `Content-Security-Policy: [policy]`），所以**只改协议处理器的探针会被 onHeadersReceived 覆盖、得到假阴性**。throwaway scratch diff 必须**同时**：(a) 协议处理器文档分支临时硬编码 CSP+meta；(b) `security.ts` onHeadersReceived 临时对受信 host 根文档 passthrough（子资源/wrong-host 仍 apply-static）。`npm run build` + `npm start`，DevTools 确认文档响应头 CSP 抵达且 `style-src` 含 nonce、meta 存在。**两处临时 diff 仅作探针：记录证据后必须一并还原，不进入最终提交、不作为 GREEN 实现、不绕过 RED 测试。** 探针通过后再进入第 2 步 RED。（替代方案：跳过 throwaway，先按 §17.17 写 `resolveContentSecurityPolicyResponse` 行为测试 + 实现 host-aware passthrough（GREEN），再以 build+start 作为该实现的首轮 runtime 验收——此路径无需 throwaway，但 A2 风险延后到实现后暴露，二选一在 implementation-notes 记录所选。）
    2) 写第 17 五组 `node:test`（RED，真实失败输出）。
    3) 实现五个纯函数（GREEN）。
    4) 接线：appProtocol 文档分支（用 `isAppDocumentPath(parsed.pathname)` 判定）+ security.ts onHeadersReceived 按 `resolveAppPageCspAction`（host-aware）分流 + index.html meta。
    5) `npm run verify:quick`。
    6) `npm run build`；**断言 `out/renderer/index.html` 含 `__REO_STYLE_NONCE__`**；`npm start` 抓 runtime 证据（第 19 节）。
    7) 更新 `docs/current/electron.md`（含 `:47-49` 不变量修订，目标文本见 §14a），证据入 `evidence/`。

### 14a. `docs/current/electron.md` 目标改写文本（避免执行者再猜）

需改写三处并新增一小节，保留「无 unsafe-inline / unsafe-eval」不变量：

- **当前事实「生产 CSP」段**：补充——生产 **app 文档** CSP 由 `reo-app://renderer` 协议处理器按 per-load nonce 生成，`style-src 'self' 'nonce-<per-load>'`；生产**子资源**与 dev server 响应由 `onHeadersReceived` 套静态 CSP。
- **安全基线「生产 CSP 不允许 unsafe-inline/eval」**：保留不变；明确 per-load style nonce **不等于** unsafe-inline，是受控豁免。
- **「自定义 protocol 必须保留…CSP…」段**：补充——协议处理器对受信 host 根文档（`reo-app://renderer/` 与 `/index.html`）返回文本响应并附带 nonce CSP；非受信 host 或非文档响应不得 passthrough。
- **新增小节「app 文档 CSP 归属与 nonce 生命周期」**：app 文档 CSP owner = 协议处理器；子资源 / dev CSP owner = `onHeadersReceived`；nonce 仅存在于文档 CSP header 与 index.html meta，**不进 IPC、URL、Query、持久文件、日志**；nonce per-load 随机、不跨加载复用。
19. **验收步骤**：第 19 节。
20. **风险点**：A2 runtime（已前置为第 1 步）；文档判定两处共用 `isAppDocumentPath(pathname)`（不用 basename，避免 `/sub/index.html` 误判）；**passthrough 必须 host-aware（wrong-host 的 reo-app:// 响应一律 apply-static，防 CSP fail-open）**；index.html 文本响应不得影响子资源流式；nonce 不入日志；electron.md 不变量须修订而非仅追加。
21. **回滚策略**：改动集中 3 个 main 文件 + 1 个 html，无迁移/持久化/新依赖。回滚=还原文件（onHeadersReceived 恢复无条件套 CSP、appProtocol 恢复纯流式、删 meta），无残留。
22. **走弯路风险**：低（已排除 hash/静态 nonce/抽静态表/回读响应头）。
23. **是否需要重构**：否；职责澄清式增量。

## 18. 异常与边界情况

| 场景 | 处理 | 验收 |
| --- | --- | --- |
| out/renderer/index.html 缺占位符 | `injectStyleNonce` 原样返回 → 文档 CSP 仍带 nonce 但 meta 无 nonce → renderer 读不到 → Stage 1 CM 退化被拦截 | 构建后断言占位符存在（第 17.18.6） |
| 空路径文档 `reo-app://<host>/` | `isAppDocumentPath(pathname)` 对 `''`/`/` 返回 true，命中文档分支 | `isAppDocumentPath('')`/`'/'` 单测 |
| 协议处理器读 HTML 失败 | 维持现有 404/400 兜底，不返回半成品 CSP | 失败响应无半成品头 |
| dev 环境 | 不经协议处理器；onHeadersReceived 套 dev CSP（unsafe-inline） | dev 启动样式正常 |
| 子资源响应 | 无 CSP → onHeadersReceived 套静态生产 CSP | 子资源加载正常 |
| 非受信 host / path traversal / asset-not-found（reo-app:// 的 400/404） | `isTrustedAppDocument` 为 false → `apply-static`，绝不 passthrough | `resolveAppPageCspAction` wrong-host + `/index.html` → apply-static 单测；wrong-host 响应头带静态 CSP |
| 协议响应头 CSP 未抵达文档（A2 不成立） | 第 17.18.1 已前置 de-risk。**若 probe 显示文档 CSP 未抵达：停止实现、记录证据、回到本 spec 修订设计——不允许执行者即兴实现「onHeadersReceived/协议处理器共享 per-request nonce map」**（共享 nonce 需要完整设计 per-request key、生命周期、清理、跨窗口/reload 串用防护、host/path fail-closed 与 node:test，超出 Stage 0 范围，必须先成文再做）。 | probe 即第 17.18.1，失败则 spec 修订 |

## 19. 测试与验收标准

**单元（`npm run verify:quick`）**：第 17.17 全部通过（main `node:test` + 既有套件不回退）。

**运行时（`npm run build` + `npm start`，证据入 `evidence/`）**：

1. **正常路径**：`reo-app://<host>/index.html` 文档响应头 CSP `style-src` 为 `'self' 'nonce-<X>'`；DOM `<meta name="reo-style-nonce">` content === `<X>`；重启后 `<X>` 变化（per-load 唯一，贴两次）。
2. **nonce 可读**：console `document.querySelector('meta[name=reo-style-nonce]').content` === CSP 头中的 `<X>`。
3. **合成安全验证**：console 注入两个 `<style>`：带正确 nonce → 生效；不带/错误 nonce → 被拦截（console CSP 违规）。**记录此项仅证明 CSP 头与浏览器 nonce 机制，不代表 Stage 1 CM6 通过。**
4. **基线不回退**：`window.open` 拒、外部导航拒、media 权限默认拒、`script-src` 仍 `'self'`（无 unsafe-inline/eval）、其它指令与 `PROD_CSP_DIRECTIVES` 一致；子资源正常加载。
5. **占位符存在性**：用单测（`injectStyleNonce` 缺占位符原样返回）+ build 后 `grep -c __REO_STYLE_NONCE__ out/renderer/index.html ≥ 1` 保证，不做「临时移除占位符再构建」这类高风险手工 runtime 步骤。

**验收覆盖**：正常、异常、数据路径（nonce 不落库/不入日志/不进 IPC）、状态流转（per-load 唯一）、日志（确认未写 nonce）、基线不回退；权限角色 N/A、重复提交/串写/未保存内容 N/A、用户可见反馈 N/A。

## 20. 最终目标总结

本次任务需要交付一个面向 Reo 生产 Electron 运行时的「CM6-ready style-nonce CSP 基线」能力，使后续 CodeMirror 6 笔记编辑器在生产环境运行时注入的 `<style>` 能在不放松 `style-src 'unsafe-inline'` 的前提下通过 CSP。实现时必须优先遵守本仓库 `reo-app://` 协议注册时序、`securityPolicy.ts` 指令结构、`security.ts` 的 `onHeadersReceived` CSP 下发路径、`test/main` 的 `node:test` 测试模式与 Electron 安全硬红线，采用「协议处理器为 app 文档生成 per-load nonce 并独占文档 CSP（同时注入 HTML meta 与文档 CSP 头），`onHeadersReceived` 用共享谓词 `isAppDocumentPath` 对生产文档放行、只为子资源套静态 CSP」的最短正确路径，避免硬编码 nonce、hash 白名单、抽静态样式表、回读协议响应头或放松 CSP 等弯路。功能上覆盖 nonce 生成、HTML 注入、文档 CSP 下发、子资源静态 CSP 兜底、文档判定五个环节，保证 nonce per-load 唯一、不落库、不入日志、不进 IPC。权限上不引入新角色且保持默认拒绝。数据上保证 nonce 仅存在于文档 CSP 头与 index.html meta。异常上覆盖占位符缺失、空路径文档、文档读取失败、dev/prod 差异、协议响应头抵达风险（已前置 de-risk）。架构上属职责澄清式增量、无需重构、回滚仅需还原少量文件，并须知晓 Stage 0 合成验证不替代 Stage 1 真实 CM6 复验。最终验收需同时通过单元测试与生产构建运行时证据：文档 CSP 含 per-load nonce、renderer 可读同一 nonce、带 nonce 样式生效而无 nonce 样式被拦截、其余安全基线不回退。

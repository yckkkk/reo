# Spec — CM6-ready Style-Nonce CSP 基线（Stage 0）

- 创建时间：2026-05-20 23:48 America/Los_Angeles
- 所属 initiative：`docs/initiatives/2026-05-20-note-codemirror-live-preview/`
- 长期决策：`docs/decisions/0007-note-editor-codemirror-live-preview.md`
- 任务复杂度：高（Electron 安全基线改动）
- 状态：active（文档就绪，待下一 session 执行代码）

## 一句话目标

让 Reo 生产环境的 CSP 能在不放松 `unsafe-inline` 的前提下，允许带 per-load nonce 的运行时注入 `<style>` 生效，从而为后续 CodeMirror 6（CSS-in-JS 运行时注入样式）扫清唯一的生产硬阻断。

## 为什么是第一个工作单元

- CM6 用 style-mod 在运行时注入 `<style>`。Reo 生产 CSP 是 `style-src 'self'`（无 `unsafe-inline`），会拦截该注入。dev CSP 含 `unsafe-inline`，会让问题在开发期被掩盖，直到打包才暴露。
- 这是接入 CM6 的**前置硬阻断**：不先解决，Stage 1 装了 CM6 在 dev 能跑，生产却白屏/掉样式，造成返工。
- 本 stage **不引入任何 CM6 依赖**，只改 Electron 安全 surface + 注入链路，独立可验证、可回滚。

## 范围

### 本 spec 做

- main 进程为每次 app 文档加载生成密码学随机 nonce。
- 生产受信 host 根文档响应携带 `style-src 'self' 'nonce-<value>'` 的 CSP，并把同一 nonce 注入 `index.html` 的 meta；非受信 host / 子资源响应仍套静态 CSP（host-aware passthrough）。
- **Stage 0 只注入 meta 并用 runtime console 验证 DOM 可读**；renderer 的 `readStyleNonce` helper 与其 Vitest 测试**推迟到 Stage 1**（Stage 0 无 `EditorView.cspNonce` 消费者，提前建即无消费者死代码）。
- 合成验证：带 nonce 的注入样式生效、不带/错 nonce 的注入样式被生产 CSP 拦截。
- 更新 `docs/current/electron.md`（CSP / protocol / nonce 链路，目标文本见 plan §14a）。Stage 0 通常**只**更新 electron.md。

### 本 spec 不做

- 不安装 `@codemirror/*`，不引入 CM6，不改 `NoteEditorOverlay`。
- 不放松 sandbox / contextIsolation / nodeIntegration / webSecurity / 其它 CSP 指令。
- 不引入 script nonce（CM6 不需要；script-src 维持 `'self'`）。
- 不改 `reo-attachment://` 协议或附件链路。

## 关键产出

- `plan.md`：完整 PRD + 工程实现说明 + 代码任务拆解 + 验收标准。
- `implementation-notes.md`：执行期运行记录与下一 session 直接执行入口。
- `evidence/`：runtime CSP 证据（`npm run build` + `npm start`）落点。

## 验收摘要（详见 plan.md 第 19 节）

1. 生产构建下，app 文档响应头 CSP 的 `style-src` 含 `'self' 'nonce-<随机值>'`，每次加载 nonce 不同。
2. renderer 经 console 读到的 index.html meta nonce 与 CSP 头一致（Stage 0 不引入 helper）。
3. 合成测试：带正确 nonce 的运行时 `<style>` 生效；不带 nonce 或错误 nonce 的运行时 `<style>` 被拦截（控制台 CSP 违规）。
4. 非受信 host 的 `reo-app://` 响应不会 passthrough（仍带静态 CSP）；其余安全基线不变（new-window deny、external nav deny、permission default deny、script-src 仍 `'self'`）。
5. `npm run verify:quick` 通过；`npm run build` + `npm start` 运行时证据归档。

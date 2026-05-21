# Implementation Notes — CM6-ready Style-Nonce CSP 基线（Stage 0）

## 状态

文档就绪，**代码未开始**。本 session 只产出可执行依据（README + plan + 本文件 + evidence 占位）。
本文件与 `plan.md` 同步到「协议处理器独占文档 CSP + onHeadersReceived 对生产文档放行」的修订设计；以 `plan.md` 为权威，本文件只是执行入口索引。

## 下一 session 直接执行入口

1. 读 `README.md` 与 `plan.md`（尤其第 14 工程实现说明、第 17 代码任务拆解、第 19 验收）。
2. **先 de-risk runtime（plan §17.18 第 1 步，throwaway scratch diff，两处都改）**：当前 `setupContentSecurityPolicy()` 对所有生产 `reo-app://` 无条件覆盖静态 CSP，故 throwaway 必须**同时**临时改 (a) 协议处理器文档分支硬编码 CSP+meta、(b) `security.ts` onHeadersReceived 对受信 host 根文档 passthrough。`npm run build` + `npm start`，DevTools 确认文档 CSP 抵达且 `style-src` 含 nonce、meta 存在。**两处临时 diff 记录证据后一并还原**，再正式实现。或选 plan §17.18 第 1 步的替代方案（先行为测试+host-aware GREEN 实现，再 build/start 验收）；所选路径记在本文件。
3. 按 plan §17.17 写 **5 组 main 纯函数单测**（RED，真实失败输出），放 `test/main/`，用 `node:test` + `node:assert/strict`（**不是 colocated Vitest**；可并入 `test/main/securityPolicy.test.ts` 或新建 `test/main/styleNonceCsp.test.ts`。**不要并入或 import `appProtocol.ts`**——它顶层 import electron，node:test 无法 import，见 plan §14.1）：
   - `createProductionDocumentCsp`、`isAppDocumentPath`、`generateStyleNonce`、`injectStyleNonce`（均在 `securityPolicy.ts`）、`resolveAppPageCspAction` / `resolveContentSecurityPolicyResponse`（在 `security.ts`）
   - 本 stage **不写 renderer 测试**（无 renderer 代码）。
4. 按 plan §14 / §17.18 实现并接线（GREEN）：
   - `src/main/securityPolicy.ts`：`createProductionDocumentCsp(nonce)` + `isAppDocumentPath(pathname)` + **`generateStyleNonce`** + **`injectStyleNonce`**（全部 Electron-free 纯函数集中于此）
   - `src/main/appProtocol.ts`：**import** securityPolicy 的上述纯函数 + 文档分支（**用 `isAppDocumentPath(parsed.pathname)` 判定文档**，读文本→注入→带文档 CSP 头返回；子资源保持 `net.fetch` 流式）；**不在 appProtocol.ts 内定义纯函数**
   - `src/main/security.ts`：`resolveAppPageCspAction({ usesDevServer, isTrustedAppDocument })`（**host-aware**：`isTrustedAppDocument = hostname === APP_SHELL_HOST && isAppDocumentPath(pathname)`）+ onHeadersReceived；prod 受信 host 根文档 → passthrough（不写 CSP），prod 子资源 / 非受信 host / dev → apply-static。**wrong-host 的 reo-app:// 响应绝不 passthrough**（防 CSP fail-open）
   - `src/renderer/index.html`：`<meta name="reo-style-nonce" content="__REO_STYLE_NONCE__" />`
   - **本 stage 不创建 renderer nonce helper**（`readStyleNonce` 推迟到 Stage 1，理由见 plan §14.5：无消费者死代码）
5. `npm run verify:quick`。
6. `npm run build`；**断言 `out/renderer/index.html` 仍含 `__REO_STYLE_NONCE__`**；`npm start`（= `electron-vite preview`，走生产 `reo-app://` 路径），按 plan §19 抓 runtime 证据存入 `evidence/`。
7. 更新 `docs/current/electron.md`（必更，且**修订现有不变量文本 `:47-49`** 以记录 per-load nonce 与两源 CSP 归属，保留「无 unsafe-inline」不变量）；`docs/current/frontend.md` 按需。
8. **收口硬门槛**：运行 subagent `/review` 与 `/ycksimplify`（`/simplify`）审查本 stage 改动并处理发现后，才允许收口。
9. 收口：长期事实压回 `docs/current/electron.md`；本 spec 移 `docs/archive/specs/*`；更新 initiative `tasks.md` 勾 M0、置 **M1 进行中**（MA 设计决策已在 0007 Stage A 锁定，Stage 1 spec 在 Stage 0 收口后创建）。

## 必须先验证的高优先级假设

- **A2（已重构降风险）**：本设计**不依赖** `onHeadersReceived` 回读协议处理器设置的 CSP 头——它对生产受信文档直接 passthrough。剩余假设只是「协议处理器在 Response 头设置的 CSP 会被 Electron 应用到文档」（标准行为），由第 2 步 runtime de-risk 验证。**若 probe 显示文档 CSP 未抵达：停止实现、记录证据、回本 spec 修订设计——不允许即兴实现共享 per-request nonce map**（理由见 plan §18：需完整设计 key/生命周期/清理/跨窗口防护/host fail-closed/测试，超出 Stage 0）。

## 与保存模型重设计的关系

Stage 0 只动 Electron CSP/protocol，**不依赖也不受**「Obsidian 式保存模型简化 / studio 内联编辑 / 点击文本区展开 Markdown 格式工具栏」（Stage A 决策，见 0007）影响——CM6 无论用何保存模型与编辑面都需要这条 nonce 基线。因此 Stage 0 保持可直接执行，先于 Stage 1 完成无碍。

## TDD 说明

- 5 个 main 纯函数行为可测，走真实 TDD（`node:test`@`test/main`）。
- 运行时 CSP / nonce 生效属环境验证，不可单测，用 build+start 证据替代，已在 plan §19 固化为可复现步骤。
- 无 TDD 豁免项。

## 本 session 验证

- 本 session 仅文档变更（init + decision + spec + 归档移动），无 production 代码/依赖变更，按 CLAUDE.md 豁免 `npm run verify:quick`。下一 session 代码变更必须跑。

## 决策与依据链

- 编辑器选型、markdown-as-truth、Stage A 保存/冲突/编辑面决策：`docs/decisions/0007-note-editor-codemirror-live-preview.md`
- 可行性论证与研究来源：`docs/archive/specs/2026-05-20-2336-note-live-preview-editor-spike/`
- 跨 session 阶段与里程碑：`docs/initiatives/2026-05-20-note-codemirror-live-preview/`

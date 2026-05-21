# Evidence

下一 session 执行 Stage 0 后在此归档运行时证据（plan.md 第 19 节）。每项给出**可复现采集方法**与**判定标准**。

## 前置：在生产 preview 下打开 DevTools

`npm start`（= `electron-vite preview`）走生产 `reo-app://` 路径，但 `src/main/index.ts` 只在 dev 分支自动开 DevTools。生产 preview 下采集证据需手动开 DevTools：用 macOS 菜单 View ▸ Toggle Developer Tools 或快捷键 `Cmd+Alt+I`。若不可用，可加**临时 instrumentation**（如在 preview 分支临时 `openDevTools`），记录证据后**必须还原、不进入提交**（与 plan §17.18 的 throwaway 纪律一致）。

## 待采集

1. `runtime-url.txt`：启动前确认 shell 未设置 `ELECTRON_RENDERER_URL`（`echo $ELECTRON_RENDERER_URL` 为空）；DevTools console 执行 `location.href`，判定标准 === `reo-app://renderer/index.html`（证明走生产自定义协议而非 dev server）。
2. `csp-header.txt`：DevTools ▸ Network 选中文档请求，复制响应头完整 `Content-Security-Policy`；判定标准 `style-src` 为 `'self' 'nonce-<X>'`。
3. `meta-nonce.txt`：console 执行 `document.querySelector('meta[name="reo-style-nonce"]').content`；判定标准 === 第 2 项的 `<X>`。再贴**两次启动**的取值，证明 per-load 唯一（两次 `<X>` 不同）。
4. `synthetic-style-check.txt`（或截图）：console 注入三种 `<style>`：
   - 正确 nonce：`const s=document.createElement('style'); s.nonce='<X>'; s.textContent='#root{outline:2px solid red}'; document.head.append(s);` → 判定：`#root` 出现 outline（样式生效）。
   - 无 nonce：同上但不设 `s.nonce` → 判定：被拦截，console 出现 CSP 违规，样式不生效。
   - 错误 nonce：`s.nonce='wrong'` → 判定：被拦截。
5. wrong-host fail-closed：**必需**——以 `resolveAppPageCspAction` 单测覆盖（prod wrong-host + `/index.html` → apply-static；wrong-host asset → apply-static）作为强制保证；runtime `wrong-host-csp.txt`（手工访问非受信 host 确认带静态 CSP）为推荐补充。这是安全降级项，单测不可省。
6. `baseline-unchanged.txt`：window.open 被拒、外部导航被拒、media 权限默认拒；console 检查 `script-src` 仍 `'self'`（无 unsafe-inline/eval）、其它指令与 `PROD_CSP_DIRECTIVES` 一致；子资源正常加载。
7. `built-index-placeholder.txt`：`npm run build` 后 `grep -c __REO_STYLE_NONCE__ out/renderer/index.html`，判定标准 ≥ 1（占位符未被 Vite 剥除）。
8. `nonce-log-redaction.txt`：定位 Electron logs path（macOS 默认 `~/Library/Logs/<appName>/`；或临时非提交 instrumentation 打印 `app.getPath('logs')`，记录后还原），在其下 `grep -i -e reo-style-nonce -e '<X>' main.log main.old.log`，判定标准**无任何命中**（nonce 不入日志）。

## 单元测试

`npm run verify:quick` 输出（main `node:test` 纯函数测试：`createProductionDocumentCsp` / `isAppDocumentPath` / `generateStyleNonce` / `injectStyleNonce` / `resolveAppPageCspAction` host-aware 分支 + setupContentSecurityPolicy 源码级断言）可贴 `verify-quick.txt`。

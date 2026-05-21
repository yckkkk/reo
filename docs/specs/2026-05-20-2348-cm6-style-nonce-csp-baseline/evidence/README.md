# Evidence

下一 session 执行 Stage 0 后在此归档运行时证据（plan.md 第 19 节）。

## 待采集（`npm run build` + `npm start`）

1. `csp-header.txt`：`reo-app://<host>/index.html` 文档响应头完整 `Content-Security-Policy`，标出 `style-src 'self' 'nonce-<X>'`。
2. `meta-nonce.txt`：DOM `<meta name="reo-style-nonce">` content，与头中 `<X>` 一致；重启后变化（贴两次取值证明 per-load 唯一）。
3. `synthetic-style-check.txt` / 截图：带正确 nonce 的注入 `<style>` 生效；不带/错误 nonce 的被拦截（含 console CSP 违规文本）。
4. `baseline-unchanged.txt`：window.open 拒绝、外部导航拒绝、media 权限默认拒绝、`script-src` 仍 `'self'`、其它指令与 `PROD_CSP_DIRECTIVES` 一致。

## 单元测试

`npm run verify:quick` 输出（5 组纯函数/helper 测试通过）可贴 `verify-quick.txt`。

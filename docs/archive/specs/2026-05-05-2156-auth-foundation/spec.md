# 规格

## 当前事实

- HEAD：`aa994dc docs: define data foundation gate`。
- 工作区起始干净。
- `docs/specs` 起始为空。
- 当前没有 auth/session lifecycle。
- 当前没有 database schema、Better Auth tables 或 durable data contract。
- 当前没有 preload bridge 或 IPC API。
- 当前没有 product auth flow、business onboarding 或 sign-in screen。
- 当前 `package.json` 没有 `better-auth` 或 `@better-auth/electron`。

## 官方资料核对

- Context7：`/better-auth/better-auth`。
- Better Auth 官方 Electron integration 文档：`https://better-auth.com/docs/integrations/electron`。
- 官方文档要求先配置 Better Auth front-end/back-end。
- Electron integration 需要 `better-auth` 和 `@better-auth/electron`，并依赖 system browser auth flow。
- Electron client 需要 custom protocol、sign-in URL、storage、clientID/cookie/channel prefix 等边界。
- 官方文档明确 auth client 不应直接暴露给 renderer，应该通过 IPC bridge。
- sandbox 模式下需要把 `@better-auth/electron/preload` bundled into preload。
- main process setup 会注册 deep-link protocol、user-image proxy、CSP 和 IPC bridges。
- renderer process 通过 preload 暴露的 bridge 请求 auth、sign out、监听 authenticated/error/user update。
- manual token exchange 依赖 `requestAuth()` 先生成 PKCE verifier 和 state。

## 判断

本 slice 不新增 auth。

理由：

- 当前没有真实 auth consumer 或 session lifecycle。
- 当前没有 DB/session persistence owner。
- 当前没有 preload/IPC boundary，不能安全暴露 auth bridges。
- 当前没有 web auth front-end/back-end、custom protocol 或 trusted origin。
- 现在安装 Better Auth 会创建空 auth surface，并把 foundation 扩成 product auth flow。

## 成功标准

- `docs/current/data.md` 写清当前没有 auth tables/session persistence owner，因此不引入 Better Auth。
- `docs/current/flow.md` 写清当前没有 auth/session lifecycle，未来新增时必须先定义 request、exchange、persistence、renderer visibility、failure 和 recovery。
- `docs/current/electron.md` 写清 Better Auth Electron 需要真实 auth lifecycle、custom protocol 和 preload/IPC bridge 才能引入。
- `docs/current/quality.md` 写清 auth boundary 需要 Zod/error/test gate，当前不安装。
- 不新增 auth source、preload、IPC、schema、tables、storage 或 UI。
- 不修改 `package.json` 或 `package-lock.json`。
- 不修改 runtime code。
- `npm run verify:quick` 通过。
- `npm run build` 通过。
- `git diff --check` 通过。
- docs lifecycle checks 通过。
- 多轮 subagent review 和 Claude CLI review 通过。

## 非目标

- 不安装 `better-auth` 或 `@better-auth/electron`。
- 不创建 auth server/client。
- 不创建 sign-in/sign-out UI。
- 不创建 auth tables。
- 不新增 session storage。
- 不新增 custom protocol for auth。
- 不新增 preload/IPC bridge。
- 不做 business onboarding 或产品 auth flow。

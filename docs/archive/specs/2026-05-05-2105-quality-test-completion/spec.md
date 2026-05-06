# 规格

## 当前事实

- HEAD：`da826bb docs: plan foundation completion initiative`。
- 工作区起始干净。
- `docs/specs` 起始为空。
- 当前已有 TypeScript、ESLint、Prettier、Node test runner 和 `npm run verify:quick`。
- 当前 `test:main` 使用 Node test runner 覆盖 main process 纯策略函数。
- 当前唯一测试文件是 `test/main/devServerUrl.test.ts`。
- 当前 renderer 只有 `src/renderer/src/main.tsx`、`index.css`、`theme.css`，没有组件目录、可复用 component、form、browser interaction 或 async UI behavior。
- Vitest 已选型，但当前未安装。

## 官方资料核对

- Context7：`/vitest-dev/vitest/v4.0.7`。
- Vitest 官方资料说明其价值集中在 Vite-native transform、JSX/TS 直接运行、React component testing、browser mode、watch/HMR 和 Vite config 共享。
- Vitest browser/component testing 需要真实 component/DOM interaction consumer，否则只会增加 test runner/config surface。

## 判断

本 slice 不安装 Vitest。

理由：

- 当前 main process 纯策略函数不需要 Vite transform、JSX、browser mode、snapshot、mock 或 coverage runner 才能验证。
- 当前 renderer 没有真实 component/browser behavior 测试对象。
- 安装 Vitest 会新增依赖和配置面，但不会降低当前 foundation 风险。
- Reo 的规则要求只有当前 slice 证明真实用途，才安装或配置对应依赖。

## 成功标准

- `docs/current/quality.md` 写清 Vitest 启用门槛。
- 不新增依赖。
- 不修改 `package.json` 或 `package-lock.json`。
- 不新增 `vitest.config.*`。
- 不新增 renderer/component/browser 测试目录。
- 不修改 runtime code。
- `npm run verify:quick` 通过。
- `npm run build` 通过。
- docs lifecycle checks 通过。
- 多轮 subagent review 和 Claude CLI review 通过。

## 非目标

- 不安装 Vitest。
- 不引入 Playwright/browser provider、React Testing Library、jsdom 或 coverage 工具。
- 不创建 renderer test harness。
- 不改 `verify:quick`。
- 不做 UI、preload、IPC、DB、auth、logging、packaging 或 updater。

# 规格

## 当前事实

- 当前已安装 TypeScript、ESLint、Prettier、Node test runner、React、Electron、Vite、`electron-vite`。
- 当前未安装 Vitest、Tailwind、shadcn/ui、auth、database、updater、packaging、Sentry、`electron-log`。
- `npm run typecheck` 运行 renderer `tsconfig.json` 和 main `tsconfig.main.json`。
- `npm run test:main` 运行 `scripts/run-main-tests.mjs`。
- `scripts/run-main-tests.mjs` 清理 `.tmp/test-main`，使用 `tsconfig.main.test.json` 编译测试，再把编译后的 `.test.js` 文件传给 Node test runner。
- `tsconfig.main.test.json` 只包含 `src/main/devServerUrl.ts` 和 `test/main/**/*.ts`。
- `test/main/devServerUrl.test.ts` 使用 `node:test` 和 `node:assert/strict` 覆盖 main process 纯策略函数。
- `npm run lint` 运行 `eslint .`。
- `eslint.config.js` 使用 flat config，覆盖 renderer、main、test、`electron.vite.config.ts` 和 `scripts/**/*.mjs`。
- `npm run format:check` 运行 `prettier --check .`。
- `npm run verify:quick` 串联 typecheck、`test:main`、lint 和 format check。

## 官方文档核对

- Node.js test runner 是稳定能力，`node --test` 可以运行匹配文件，也可以接收一个或多个测试文件模式；测试文件必须可被 Node.js 执行。
- Vitest 是 Vite-native test runner，价值集中在 Vite 转换、TypeScript/JSX 直接运行、Jest-like API、mock、snapshot、coverage 和 watch 体验。
- ESLint flat config 支持 `defineConfig`、`files` glob、分对象配置和 `globalIgnores`。

## Vitest 判断

本 slice 不安装 Vitest。

当前测试目标是 main process 纯策略函数。Node test runner 已能执行编译后的 JavaScript 测试文件，并且当前 `test:main` 不需要 Vite transform、JSX、browser mode、snapshot、coverage 或 Jest compatibility。安装 Vitest 会增加 runner、配置和依赖 surface，但不会降低当前 foundation 风险。

当 renderer/component/browser 测试成为当前 slice 目标时，重新评估 Vitest。

## 成功标准

- `docs/current/quality.md` 准确描述当前 quality gate。
- 不新增 Vitest 或测试平台配置。
- 不修改 UI、DB、auth、Forge、updater、packaging、runtime integration、preload 或 IPC。
- 行为改动如发生，必须有 RED、GREEN、REFACTOR 证据。
- 纯文档或机械配置改动如无行为变化，TDD 豁免必须写入验证记录。
- `npm run verify:quick` 通过。
- `npm run build` 通过。
- 提交前独立 review 通过。
- 收口后 `docs/specs` 为空。

## 非目标

- 不做 Styling 或组件基础。
- 不安装 Vitest。
- 不做 renderer/component/browser 测试平台。
- 不做大规模测试补齐。
- 不新增 preload。
- 不新增 IPC。
- 不做 DB、auth、Forge、updater、packaging、logging、telemetry 或 runtime integration。
- 不做顺手重构。

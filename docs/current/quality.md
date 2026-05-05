# 质量

本文档是类型纪律、测试、静态检查、错误处理和 observability 的当前真源。

## 当前事实

- 当前已有 TypeScript、ESLint、Prettier、Node test runner 和 `npm run verify:quick`。
- 当前 `test:main` 使用 Node test runner 覆盖 main process 纯策略函数。
- 当前 `test/**/*.ts` 由 ESLint 覆盖。
- 当前 `test:main` 使用 Node 脚本清理测试输出目录、编译测试并运行 main process 测试。
- 当前 `typecheck` 分别检查 renderer TypeScript 和 main process TypeScript。
- 当前 ESLint 覆盖 renderer、main process、测试、Electron Vite config 和测试脚本。
- Vitest 已选型，但当前未安装。
- Sentry 和 `electron-log` 已选型，但当前未安装。
- 当前没有 posthook 或 pre-commit flow。

## Type System

- 优先严格 TypeScript 设置。
- 新代码不得使用 `any`。
- 不可信边界使用 `unknown` 加缩窄。
- 不得用 `@ts-ignore` 或 `@ts-expect-error` 压制类型错误。
- 不得用 non-null assertion 跳过真实不确定性。
- Form、IPC、auth、persistence 边界必须使用 Zod 做运行时校验。

## TDD

- 行为改动必须真实 TDD。
- RED 必须先运行并失败，再开始实现。
- 测试必须基于行为规格，而不是实现细节。
- 覆盖高价值边界和异常：空输入、错误格式、文件缺失、中文字符、并发、取消、权限失败。
- REFACTOR 后必须重新运行保护该行为的测试。

## 验证

当前基础检查：

```bash
npm run verify:quick
```

`verify:quick` 当前包含 typecheck、`test:main`、lint 和 format check。

当前命令边界：

- `typecheck`：运行 renderer `tsconfig.json` 和 main process `tsconfig.main.json`。
- `test:main`：清理 `.tmp/test-main`，使用 `tsconfig.main.test.json` 编译测试，再用 Node test runner 运行编译后的 main process 测试。
- `lint`：运行 `eslint .`，按 `eslint.config.js` 的 flat config 检查 renderer、main process、测试、Electron Vite config 和脚本。
- `format:check`：运行 `prettier --check .`。

没有新鲜验证证据，不得宣称完成。

## Error Handling

- IPC 和 UI 边界的 error shape 必须有意设计。
- 不得静默吞错。
- 用户可见错误必须可行动。
- 日志应保留诊断信息，但不得泄露 secrets。

## Observability

- 引入 logging 时，本地诊断使用 `electron-log`。
- 引入 crash/error reporting 时，使用 Sentry。
- Background work 必须暴露足够状态，用于排查时序和失败。

## 变更门禁

任何 type rules、tests、lint/format hooks、error handling、logging、Sentry、verification commands 改动，都必须更新本文档。

# TDD 证据

## RED

命令：`npm run test:renderer`

结果：失败，符合预期。

关键输出：

```text
> reo@0.1.0 test:renderer
> vitest run

sh: vitest: command not found
```

失败原因：renderer test runner 尚未安装。

## GREEN

命令：`npm run test:renderer`

结果：通过。

关键输出：

```text
Test Files  1 passed (1)
Tests  1 passed (1)
```

## REFACTOR

命令：`npm run verify:quick`

结果：通过。

关键输出：

```text
test:main: tests 4, pass 4
test:renderer: Test Files 1 passed (1), Tests 1 passed (1)
format:check: All matched files use Prettier code style!
```

重构内容：`verify:quick` 已纳入 `test:renderer`；`App` 已从 `main.tsx` 提取为独立组件。

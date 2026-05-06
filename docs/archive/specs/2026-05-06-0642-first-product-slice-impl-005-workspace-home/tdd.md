# TDD 记录

| 阶段     | 命令                    | 结果           | 证据                                                                                                                    |
| -------- | ----------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| RED      | `npm run test:renderer` | 失败，符合预期 | 缺少 `button`、`label`、`WorkspaceHome`，4 个 failed suites；现有 renderer tests 7 passed。                             |
| GREEN    | `npm run test:renderer` | 通过           | 安装精确依赖并创建 Button、Label、WorkspaceHome、alias、components.json 后，8 个 renderer test files、12 tests passed。 |
| REFACTOR | `npm run typecheck`     | 失败后修复     | TS6 报 `baseUrl` deprecated；移除 `baseUrl`，使用相对 `paths` 后 typecheck 通过。                                       |
| REFACTOR | `npm run verify:quick`  | 通过           | typecheck、main tests 33/33、renderer tests 12/12、lint、format check 均通过。                                          |

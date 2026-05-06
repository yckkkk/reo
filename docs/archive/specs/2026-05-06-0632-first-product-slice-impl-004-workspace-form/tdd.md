# TDD 记录

| 阶段     | 命令                    | 结果           | 证据                                                                                                                 |
| -------- | ----------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| RED      | `npm run test:renderer` | 失败，符合预期 | `CreateWorkspaceForm` 和 `workspaceQueries` 尚不存在；Vitest failed suites 2，现有 renderer tests 3 passed。         |
| GREEN    | `npm run test:renderer` | 通过           | 新增 CreateWorkspaceForm、workspaceQueries 和 App route tests 后，4 个 renderer test files、7 tests passed。         |
| REFACTOR | `npm run test:renderer` | 通过           | 移除 `workspaceApi.ts` 中的 query key helper，query ownership 归 `workspaceQueries.ts` 后，4 files、7 tests passed。 |
| REFACTOR | `npm run typecheck`     | 通过           | renderer、main/preload TypeScript 均通过。                                                                           |
| REFACTOR | `npm run verify:quick`  | 失败后修复     | 首次失败仅因 `src/renderer/src/App.tsx` Prettier；格式化后重跑通过。                                                 |
| REFACTOR | `npm run verify:quick`  | 通过           | typecheck、main tests 33/33、renderer tests 7/7、lint、format check 均通过。                                         |

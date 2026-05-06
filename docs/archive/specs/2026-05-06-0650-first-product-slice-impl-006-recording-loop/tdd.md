# TDD 记录

| 阶段     | 命令                    | 结果           | 证据                                                                                                          |
| -------- | ----------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| RED      | `npm run test:renderer` | 失败，符合预期 | 缺少 `recordingMachine`、`mediaRecorderAdapter`、`RecordingOverlay`，3 个 failed suites；现有 12 tests 通过。 |
| RED      | `npm run test:main`     | 失败，符合预期 | 缺少 `src/main/securityPolicy.ts`，CSP media-src test 无法编译。                                              |
| GREEN    | `npm run test:renderer` | 通过           | 新增 machine、adapter、overlay、Dialog/Textarea 后，11 个 renderer test files、18 tests passed。              |
| GREEN    | `npm run test:main`     | 通过           | 新增 `securityPolicy.ts` 和 CSP test 后，main tests 34/34 passed。                                            |
| REFACTOR | `npm run verify:quick`  | 失败后修复     | 首次停在 typecheck：mock literal type 和 BlobPart 类型；修复后又停在 Prettier；格式化后重跑通过。             |
| REFACTOR | `npm run verify:quick`  | 通过           | typecheck、main tests 34/34、renderer tests 18/18、lint、format check 均通过。                                |

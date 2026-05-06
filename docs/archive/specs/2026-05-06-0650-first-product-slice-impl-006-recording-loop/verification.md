# 验证记录

| 阶段     | 命令                                             | 结果       | 证据                                                                                                                                            |
| -------- | ------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| RED      | `npm run test:renderer`                          | 失败，预期 | 缺少 recording machine、media adapter、overlay，3 个 failed suites。                                                                            |
| RED      | `npm run test:main`                              | 失败，预期 | 缺少 `securityPolicy.ts`，CSP media-src test 无法编译。                                                                                         |
| GREEN    | `npm run test:renderer`                          | 通过       | 11 个 renderer test files、18 tests passed。                                                                                                    |
| GREEN    | `npm run test:main`                              | 通过       | 34 main/preload tests passed。                                                                                                                  |
| REFACTOR | `npm run verify:quick`                           | 通过       | typecheck、main tests 34/34、renderer tests 18/18、lint、format check 均通过。                                                                  |
| REFACTOR | `npm run build`                                  | 通过       | main、preload、renderer 均生成 production output。                                                                                              |
| Runtime  | Computer Use                                     | 通过       | Electron window `Reo`，URL 为 `reo-app://renderer/index.html`；OS directory dialog 成功打开并可取消，cancel 后 form draft 保留。                |
| Runtime  | Electron CDP                                     | 通过       | CSP 包含 `media-src 'self' blob:`；window.open 被拒绝；外部导航保持 app URL；video permission 为 `NotAllowedError`。                            |
| Runtime  | Electron CDP                                     | 通过       | `window.reoWorkspace` 暴露 recording 方法，无 generic `invoke/send`；Blob audio URL 可创建并 revoke；microphone permission query 为 `granted`。 |
| 收口     | `npm run verify:quick`                           | 通过       | 归档后重跑 typecheck、main tests 34/34、renderer tests 18/18、lint、format check 均通过。                                                       |
| 收口     | `npm run build`                                  | 通过       | 归档后重跑 main、preload、renderer build 均通过。                                                                                               |
| 收口     | `git diff --check`                               | 通过       | 无输出。                                                                                                                                        |
| 收口     | `diff -u AGENTS.md .claude/CLAUDE.md`            | 通过       | 无输出。                                                                                                                                        |
| 收口     | `find docs/specs -mindepth 1 -maxdepth 1 -print` | 通过       | 无输出，active spec 为空。                                                                                                                      |

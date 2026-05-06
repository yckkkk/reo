# 基础能力决策

本文件记录 first product slice 可以激活、必须推迟或必须保持条件触发的基础能力。这里的结论只通过 design-hardening gate；真正安装依赖、改代码和提交实现必须等 `$writing-plans`、`$plan-eng-review` 和 `$executing-plans` 通过。

## 激活矩阵

| 基础能力                   | first product slice 决策      | 精确消费者                                         | 激活输入                  | 验证                                             |
| -------------------------- | ----------------------------- | -------------------------------------------------- | ------------------------- | ------------------------------------------------ |
| Vitest                     | 建立                          | renderer TSX/DOM 行为、overlay、form、autosave     | IMPL-001                  | renderer RED/GREEN                               |
| Testing Library            | 建立                          | 面向用户的 DOM 行为和 accessibility                | IMPL-001                  | role/name/focus 测试                             |
| preload                    | 建立                          | 目录选择、workspace 文件、audio 读取               | IMPL-002                  | preload bridge 测试                              |
| 显式 IPC                   | 建立                          | 每个 main-owned 产品能力                           | IMPL-002/003              | IPC contract 测试                                |
| Zod                        | 建立                          | IPC、metadata、form boundary                       | IMPL-002/003/004          | parse/error 测试                                 |
| React Hook Form            | 建立                          | workspace 创建 form 的 submit/error lifecycle      | IMPL-004                  | form 测试                                        |
| TanStack Query             | 只为 workspace snapshots 建立 | main-backed workspace/detail reads 和 invalidation | IMPL-004                  | query key/invalidation 测试                      |
| shadcn/ui + Radix          | 只为精确 primitives 建立      | Button、Label、Dialog、Textarea、必要时 Tooltip    | IMPL-005/006              | retokenization/focus 测试                        |
| lucide                     | 条件建立                      | icon-only controls                                 | IMPL-006 若出现 icon-only | accessible name/no emoji 测试                    |
| MediaRecorder              | 使用浏览器原生 API 建立       | audio capture                                      | IMPL-006                  | adapter 测试 + Computer Use                      |
| `proper-lockfile`          | 在 filesystem slice 建立      | workspace single-writer lock                       | IMPL-003                  | duplicate open、stale lock、owner pid dead tests |
| Zustand                    | 推迟                          | first slice 不需要跨子树 client state owner        | 无                        | 不安装                                           |
| Drizzle + `better-sqlite3` | 推迟                          | first slice 无 DB schema/query 压力                | 无                        | 不产生 SQLite 文件                               |
| Better Auth                | 推迟                          | first slice 无 account/session/sharing             | 无                        | 无 auth UI                                       |
| date-fns                   | 推迟                          | 原生 `Intl` 足够支撑 first slice 标签              | 无                        | 不安装                                           |
| electron-log               | 推迟                          | first slice 无 diagnostics subsystem owner         | 无                        | 只验证 error envelope                            |
| Sentry                     | 推迟                          | 无 DSN/release/privacy/source map owner            | 无                        | 不初始化                                         |
| Electron Forge             | 推迟                          | 只做本地 runtime 验证，不产出 packaged artifact    | 无                        | `electron-vite` build/start                      |
| electron-updater           | 推迟                          | 无签名应用和 release metadata                      | 无                        | 不初始化                                         |
| file watcher               | 推迟                          | first slice 无外部编辑 live sync                   | 无                        | 不安装 watcher                                   |

## 写回 current 文档的稳定结论

- first slice 只在存在精确消费者和测试时建立 preload、IPC、Zod、Vitest、React Hook Form、TanStack Query、shadcn primitives。
- first slice 继续推迟 DB、auth、Zustand、logging、Sentry、packaging、updater。
- Vaul / shadcn Drawer 已评估；由于 Vaul 当前维护风险，first slice 不引入 Vaul，overlay 使用 Radix Dialog 语义组合 bottom sheet。
- wavesurfer.js 已评估；在 first slice 没有 scrubber、peaks、regions 和长音频性能压力前推迟。
- ElevenLabs UI 按组件评估和摘取设计结构，不执行 `add all`。

## 不得越界激活

- 不得为了“以后会用”提前安装 foundation。
- 不得为了复用而引入没有 first slice 消费者的 primitive、provider、adapter 或 service。
- 不得用 generic runtime、generic service layer、generic IPC bridge 包装这些 foundation。
- 不得把 DB、query cache 或 renderer state 升级为用户内容真源。

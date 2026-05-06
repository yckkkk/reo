# 代码精简规则

## 禁止抽象

| 禁止项                                       | 原因                                              |
| -------------------------------------------- | ------------------------------------------------- |
| `src/services/`                              | 隐藏 ownership，诱导 generic service layer        |
| generic IPC helper / command bus             | 违反每个 product method 一个 IPC channel          |
| generic `window.api`                         | preload 变 dumping ground                         |
| `src/contracts/` shared bucket               | renderer 不应 runtime-import main contracts       |
| generic `BaseCard`、`BasePanel`、`PageShell` | 当前没有 repeated invariant                       |
| generic `useApi` 或 repository layer         | TanStack Query 和 `workspaceApi` 覆盖具体数据路径 |
| 单个 `helpers.ts` 或 `types.ts` 总线         | ownership 弱，难审查                              |
| generic runtime/tool/agent platform          | first slice 之外                                  |
| compatibility shims                          | 产品未发布，不做兼容层                            |

## 禁止捷径

- 不跳过 sender validation。
- 不跳过 IPC、metadata 或 form boundary 的 DTO/schema。
- 不用 string prefix 替代 path containment。
- 不覆盖 existing `AGENTS.md`。
- Renderer 不直接 import Node/Electron。
- DB 不作为用户内容真源。
- 不创建 hidden logging/Sentry bridge。
- Save failure 不得静默丢 renderer text。
- shadcn retokenization 不得移除 focus-visible。
- 不显示 reference UI 中的 future controls。
- Filesystem 或 security 行为不能只用 screenshot 证明。

## 组件和模块预算

| 预算项                                | 限制                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| Renderer feature component tree depth | 从 page 到 leaf 最多 5 个 product levels，超过前必须审查                                   |
| Wrapper-only components               | first slice 最多 2 个；每个都必须有 invariant                                              |
| Main 业务模块                         | design-hardening 接受最多 9 个计划中的 workspace modules；新增第 10 个必须重新审查         |
| IPC helpers                           | 最多 1 个 shared helper，仅当两个 channels 共享真实 sender/error envelope invariant 时允许 |
| Zustand stores                        | 0                                                                                          |
| SQLite tables                         | 0                                                                                          |
| shadcn primitives                     | 只有 Button、Label、Dialog、Textarea、Tooltip 且存在精确测试时才允许                       |
| lucide icons                          | 只用于 slice spec 列名的 icon-only controls                                                |
| Package installs per slice            | 只允许同 slice 有 consumer 和 tests 的 package                                             |

## 抽象决策表

| ID     | 候选                        | 决策                         | 真实 consumer                                  | 共享 invariant                      | 测试               | 原因                          |
| ------ | --------------------------- | ---------------------------- | ---------------------------------------------- | ----------------------------------- | ------------------ | ----------------------------- |
| RD-001 | Button primitive            | extract                      | create submit、record action、overlay controls | Reo pill/compact variants and focus | component tests    | repeated command control      |
| RD-001 | Label primitive             | extract                      | form and editors                               | input association                   | form tests         | accessibility invariant       |
| RD-003 | Dialog shell                | 通过 shadcn source extract   | recording overlay                              | focus trap、labelled dialog         | Dialog tests       | accessibility is not optional |
| RD-002 | Page shell                  | inline                       | only workspace management/home                 | 暂无                                | viewport tests     | 避免 generic page wrapper     |
| RD-005 | Waveform component          | feature-local                | recording overlay                              | state visualization                 | overlay tests      | 无第二个 consumer             |
| RD-015 | Recording reducer           | extract feature-local        | overlay and tests                              | explicit lifecycle transitions      | machine tests      | 保持状态可读                  |
| RD-011 | Atomic write helper         | 两条写入路径出现后才 extract | transcript/reflections/metadata                | temp+rename+fsync                   | file tests         | 有真实 invariant              |
| RD-010 | IPC invoke wrapper          | reject                       | all channels                                   | 过度 generic                        | preload leak tests | 隐藏产品语义                  |
| RD-017 | Workspace query key factory | extract                      | workspace/detail queries                       | stable key names                    | query tests        | 防止漂移                      |

## 重复决策

| 重复点                                        | 保留或移除                                          | 原因                              |
| --------------------------------------------- | --------------------------------------------------- | --------------------------------- |
| Transcript/reflections 分离 autosave state    | 保留                                                | independent failure UX            |
| Save transcript/reflections 分离 IPC channels | 保留                                                | distinct product errors and tests |
| Repeated path validation calls                | remove via focused `workspacePaths`                 | security invariant                |
| Repeated button classes                       | remove via Button primitive after shadcn activation | visual invariant                  |
| Repeated error envelope shape                 | remove via small helper if two channels share shape | protocol invariant                |
| Repeated state labels in tests                | keep if improves behavior clarity                   | tests should read as specs        |

## 工具强制规则

- TypeScript strict checks through existing `typecheck`。
- ESLint forbids `any`；renderer forbids `console`。
- Prettier format check。
- Future renderer tests run through Vitest once established。

## 审查强制规则

- Tailwind tokens and Reo design system。
- No nested cards。
- Component extraction only with consumer/invariant。
- Filesystem transaction completeness。
- State ownership matrix。
- Accessibility matrix。
- Reuse-first decision coverage。

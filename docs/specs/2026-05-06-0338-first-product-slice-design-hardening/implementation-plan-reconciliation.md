# 实现计划对齐

本文件不是可执行 implementation plan。它只记录 archived implementation plan 的差异、替代决策和 `$writing-plans` 输入。可执行计划必须在 design-hardening gate 通过后重新生成。

归档计划：

- `docs/archive/specs/2026-05-06-0116-first-product-slice-plan/plan.md`

当前权威：

- `docs/current/*`
- `docs/initiatives/2026-05-06-first-product-slice/*`
- 本 design-hardening spec

## 替代决策

| 主题                  | 归档计划                                   | 当前决策                                                         | 原因                                                  |
| --------------------- | ------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------- |
| Slice authority       | 归档计划列出 7 个实现 slice                | `$writing-plans` 必须重新生成可执行计划                          | active initiative 已声明归档计划只能作为背景          |
| Drawer mechanics      | 暗含大型 bottom sheet/modal                | 先用 Radix Dialog 组合；Vaul/shadcn Drawer 已评估但当前不采用    | Vaul 有维护风险，Dialog 能提供可访问 modal 语义       |
| ElevenLabs UI         | 旧计划未完整评估必需组件                   | 必须逐组件决策，禁止 `add all`                                   | reuse-first gate                                      |
| wavesurfer.js         | 旧计划推迟                                 | 继续推迟，并记录触发条件                                         | first slice 无 scrubber/peaks/regions                 |
| React media recorder  | 旧计划拒绝                                 | 继续不作为依赖；使用原生 MediaRecorder adapter 和 chunk sequence | Reo 需要 draft filesystem contract 和 append ordering |
| TanStack Query        | 旧计划在 renderer data slice 激活          | 保留，但限制为 main-backed workspace/detail snapshots            | Query 是 async/server state，不是 recording UI state  |
| shadcn/ui             | 旧计划为 Button/Label/Dialog/Textarea 激活 | 保持条件激活；只为精确 consumer 初始化                           | current frontend gate                                 |
| Preload/IPC           | 旧计划从 chooseDirectory 开始              | 保持显式 channel rollout，不建 generic bridge                    | 当前 Electron gate                                    |
| DB                    | 旧计划推迟                                 | 继续推迟，并记录触发条件                                         | workspace files 是真源                                |
| 锁                    | 旧计划轻描写 cross-process lock            | 强化为 single-writer lock 和 stale lock 测试                     | filesystem transaction gate                           |
| Security threat model | 旧计划吸收 review 修复                     | 改为按 asset 做 STRIDE，并写 tests 和 residual risk              | current security gate                                 |
| 参考验证              | 旧计划列 manual viewports                  | 改为 reference evidence 和采用/拒绝映射                          | design-hardening gate                                 |
| Codex CLI validation  | 旧计划包含 read-only hash diff             | 保留为 runtime validation                                        | 产品验收要求                                          |

## `$writing-plans` 输入

下面是候选工作项，不锁定最终顺序或边界。`$writing-plans` 必须重新做 scope split、file mapping 和 task ordering；可以继续拆小，但不能合并到失去 TDD 边界。

### 候选工作项 1：Renderer 测试基础

目标：为真实 TSX/DOM 行为建立 Vitest + Testing Library。

必需内容：

- RED：证明当前项目缺少 renderer test runner 或 App 行为测试入口。
- 提取当前 static `App`，不引入产品行为。
- 更新 `docs/current/quality.md`。
- 运行 `npm run verify:quick`。
- 提交。

### 候选工作项 2：Preload + 显式 IPC + Zod

目标：加入可信 preload 和第一个产品 IPC channel `workspace:chooseDirectory`。

必需内容：

- Electron sender validation。
- Permission policy 只允许可信 audio，拒绝 video/camera/geolocation。
- `contextBridge` 只暴露产品方法。
- 不暴露 generic invoke/send/fs/path。
- 建立 Zod boundary owner。
- 更新 `docs/current/electron.md`、`data.md`、`flow.md`、`quality.md`。
- 运行 `npm run verify:quick` 和 `npm run build`。
- 提交。

### 候选工作项 3：Workspace 文件系统和 recording draft 基础

目标：先建立 workspace file contract 和 main-owned recording draft lifecycle，再做 renderer 产品 UI。

必需内容：

- Workspace init/open。
- existing `AGENTS.md` conflict。
- `.reo/workspace.json`、`.reo/index.json`、`recordings/`。
- Draft create/append/finalize/discard。
- temp/rename/fsync。
- path containment 和 single-writer lock。
- stale `.part` recovery。
- 更新 current data/flow/electron/quality 文档。
- 运行 `npm run verify:quick` 和 `npm run build`。
- 提交。

### 候选工作项 4：Workspace data 和 create form

目标：建立 renderer workspace data 和 form lifecycle。

必需内容：

- TanStack Query provider/keys 只服务 main-backed snapshots。
- React Hook Form + Zod resolver 用于 create form。
- folder selection state 和 form draft 分离。
- 覆盖 conflict、permission、missing errors。
- 记录 viewport evidence。
- 更新 data/frontend/flow 文档。
- 运行 `npm run verify:quick`。
- 提交。

### 候选工作项 5：Workspace home UI 和最小 shadcn primitives

目标：实现符合参考结构的 workspace home，不显示未来能力 UI。

必需内容：

- 只用 exact primitives 和 aliases 初始化 shadcn。
- shadcn init、`components.json`、renderer alias 和第一组业务 consumers 必须在同一 slice、同一 commit 中落地。
- Retokenize Button/Label 并保持 focus-visible。
- Workspace home 只显示 record action 和 Memory Content。
- 加入 Films/photo/video/file 的 absence tests。
- 记录 viewport/reference evidence。
- 更新 frontend 文档。
- 运行 `npm run verify:quick`。
- 提交。

### 候选工作项 6：Recording overlay、MediaRecorder、autosave、playback

目标：完成 recording loop。

必需内容：

- Retokenize Dialog/Textarea primitives。
- MediaRecorder adapter 支持 injectable fakes。
- Recording reducer。
- chunk append sequence。
- finalize 必须等最后一个 append ack。
- Blob playback，并把 CSP 调整为 `media-src 'self' blob:`。
- transcript/reflections 独立 autosave。
- save failure 必须保留 UI draft 和 disk previous content。
- 使用 Computer Use 验证 recording/playback/save failure。
- 更新 current 文档。
- 运行 `npm run verify:quick` 和 `npm run build`。
- 提交。

### 候选工作项 7：Runtime、persistence、reference、Codex CLI validation

目标：证明用户可用的 first product slice。

必需内容：

- Electron runtime security checks。
- 临时 workspace 操作流。
- disk tree 和 restart 前后 shasum。
- save failure hash test。
- viewport/reference validation。
- Codex CLI read-only validation 和 hash diff。
- 最终 current docs compression。
- 运行 `npm run verify:quick`、`npm run build`、`git diff --check`。
- 提交。

## 给 `$writing-plans` 的硬约束

- 每个 work item 必须拆成 bite-sized TDD tasks。
- 每个 work item 必须写清 exact files、exact commands 和预期 RED/GREEN 输出。
- 每个 implementation slice 必须创建独立 spec，记录 objective、TDD 证据、验证证据、docs/current 更新、review 结果和 commit。
- 每个 implementation slice 完成后按 Reo 文档生命周期保留 active spec 或归档；未完成工作不得 archive-only。
- 同一 task 不能先安装 package 再补 consumer/test。
- 没有 matching handler、contract 和 tests，不得暴露 preload method。
- 未经用户明确授权，implementation slice 不得直接在 `main` 上执行；必须按 `$executing-plans` 和 `using-git-worktrees` 处理隔离工作区。
- `$plan-eng-review` 有 unresolved BLOCKER/MAJOR 时不得进入实现。

## 对齐后计划不包含

- DB schema/migrations。
- Better Auth。
- Sentry/electron-log。
- Electron Forge/updater。
- Agent runtime。
- Photo/video/file/film UI。
- Search/tags/templates/sharing/sync。

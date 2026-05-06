# Review

## 审查方式

本 session 对当前 design-discipline 补丁执行了独立对抗审查：

- Subagent A：工程流程、requirements、architecture、traceability、QA、doc lifecycle。
- Subagent B：前端、产品设计、设计系统、组件、reference、accessibility。
- Subagent C：main process、IPC、data、DB deferral、state、filesystem recovery。
- Claude CLI：独立读取当前 diff，按 BLOCKER / MAJOR / MINOR 输出。

审查提示要求 reviewer 找阻断点和遗漏，不要求确认方案正确。

## 采纳的阻断修正

- 修正 `docs/current/data.md` 中 durable data 属于 SQLite 的矛盾，改为 workspace files 是用户内容真源，SQLite 只在引入后拥有明确 app/index/session/relationship state。
- 增加 active initiative 与 archived specs 的权威顺序，要求 design-hardening 后更新、替换或 supersede archived implementation plan。
- 增加 Slice 0 到 active tasks，防止直接进入 Slice 1。
- 增加 requirement IDs 和 traceability matrix。
- 增加 `review.md`、`verification.md`、`traceability-matrix.md`、`implementation-plan-reconciliation.md` 等 mandatory deliverables。
- 增加 reference map、accessibility matrix、sidebar decision、first-run/create-workspace component taxonomy。
- 增加 filesystem transaction table、protocol matrix、security threat model。
- 将 shadcn/ui、Radix、lucide 从无条件建立改为必须逐项证明 exact consumer、slice 和 tests。
- 将 code simplicity 从口号改为 forbidden abstractions、forbidden shortcuts、abstraction decision table、component/module budget、duplication decision、tool-enforced 和 review-enforced rules。

## 复审修正

Claude CLI 复审后继续发现两个阻断点：

- Active plan/tasks/README 仍锁定 archived 7-slice structure，削弱 reconciliation。
- `foundation.md` 技术路线仍可能被误读为当前 slice 的 package activation 许可。

已修正：

- `plan.md` 和 `tasks.md` 只保留 Slice 0；Slice 1+ 必须由 `implementation-plan-reconciliation.md` 重新产出。
- `README.md` 标记 archived implementation plan 为背景证据和待 reconciliation，不是当前执行权威。
- `foundation.md` 明确技术路线不是激活许可；任何 package/provider/schema/IPC/component/store/query/auth/DB/logging/packaging/updater 都必须先有 exact consumer、capability contract、测试路径和 current docs 更新。
- 补强 filesystem transaction 的 file fsync、parent directory fsync、cross-process lock、multi-window detection。
- 将 security threat model 改为 STRIDE-by-asset 矩阵，并把 Codex CLI read-only validation 移回 QA。
- 要求 code-simplicity budgets 给出具体数字。

## 剩余风险

当前 session 只补强 gate，不产出完整 design-hardening spec。first product slice 仍然 blocking implementation，直到 design-hardening spec 完成并通过独立审查。

## 追加审查：2026-05-06 03:00 America/Los_Angeles

用户纠偏后，本 session 将 reuse-first 从录音 UI 特例提升为全工程强制准则。

新增修正：

- `AGENTS.md` 与 `.claude/CLAUDE.md` 写入：设计默认从官方方案、主流包和成熟开源项目出发；先评估复用，再决定适配、fork 或自研。
- `docs/current/foundation.md` 写入：自研不是默认选项，前端组件、audio/media、main process、IPC typing、filesystem transaction、state machine、form/schema、DB/migration、testing/QA、logging/observability、packaging/updater 都必须先评估官方方案和成熟开源包。
- `docs/current/frontend.md` 写入：ElevenLabs UI、Vaul、wavesurfer.js 是 audio/agent UI 和 drawer/audio 能力的优先评估来源；不允许 `add all`，只能逐组件引入并 retokenize 到 Reo design system。
- `docs/initiatives/2026-05-06-first-product-slice/engineering-readiness.md` 与 `next-session-handoff.md` 写入：`reuse-decisions.md` 必须覆盖 UI、overlay、audio、main、IPC、filesystem、state、form/schema、data fetching、DB、testing、logging、packaging/updater；发现不适配时必须先评估裁剪、retokenize、组合、薄适配或 fork，自研只能作为最后手段。
- 增加 ElevenLabs UI 文档、ElevenLabs drawer 视频、Vaul、wavesurfer.js 为 design-hardening 的强制研究输入。
- 安全 threat model 从 threat list 强化为可执行矩阵，必须包含 attack path、mitigation/prevention、detection/recovery、negative test 或 manual verification、owner 和 residual risk。
- 明确 `implementation-plan-reconciliation.md` 只是 archived plan delta/supersession 和 `$writing-plans` 输入，不是可执行计划本体。

审查结果：

- Claude CLI 复审：PASS，无 BLOCKER/MAJOR。
- Subagent 流程审查：PASS，无 BLOCKER/MAJOR。
- Subagent 前端/设计系统审查：PASS，无 BLOCKER/MAJOR。
- Subagent data/IPC/security 审查：发现 security threat model MAJOR，已修正后由 Claude CLI 复审通过。

仍然保持的阻断点：

- first product slice 不能实现。
- 下一 session 必须先设完整 first product slice `$goal`，然后按 design-hardening -> `$writing-plans` -> `$plan-eng-review` -> `$executing-plans` 顺序推进。
- 未完成的 design-hardening spec 必须留在 `docs/specs/*`。

## `$writing-plans` And `$plan-eng-review` Readiness

结论：PASS for next-session preparation。

- `$writing-plans` readiness：`next-session-handoff.md` 已列出 reading order、background-only archives、mandatory design-hardening artifacts、hard boundaries、required answers、completion criteria 和 verification commands。`implementation-plan-reconciliation.md` 被定义为 `$writing-plans` 输入，不是可执行 plan 本体。
- `$plan-eng-review` readiness：`engineering-readiness.md` 已要求 requirements IDs、traceability、architecture views、data contracts、filesystem transactions、protocol matrix、STRIDE-by-asset threat model、state ownership matrix、QA matrix、foundation decisions、reuse decisions 和 code-simplicity budgets。
- `$executing-plans` readiness：当前仍不能进入。只有 design-hardening gate 通过、`$writing-plans` 产出可执行 reconciled implementation plan、`$plan-eng-review` 无 unresolved BLOCKER/MAJOR 后，才允许新 session 使用 `$executing-plans`。

# Agent Behavior Optimization

Timezone: America/Los_Angeles (PDT).

## Intent

Reo 已证明普通 agent 可以只改记忆空间内的目录和 Markdown，让 Reo 自动收敛 manifest、index、sidecar 和 UI。下一步不是让 agent 学更多 Reo 内部，而是继续降低判断成本：普通任务只需要读当前记忆空间入口、目标文件和必要的 `reo-edit`；只有 Reo 明确报告 needs-review、缺失配置或用户要求诊断时才进入 `reo-doctor`。

本 spec 只优化生成给记忆空间 agent 的入口和技能文本，并用 focused tests 与一次真实 `codex exec` dogfood 验证行为。目标不是限制 agent 能编辑哪些文件；agent 仍可编辑 Markdown、JSON、目录名和对象文件。Reo 负责静默收敛；不能静默收敛时给出明确 needs-review surface。

## Current Basis

- `docs/current/architecture.md` 定义 memory-space root 的 `AGENTS.md`、`skills/reo-edit/` 和 `skills/reo-doctor/` 是 agent 协作入口，`.reo` 不是用户语义第二真源。
- `docs/current/data.md` 定义用户语义真源在 `memories/` 下的普通文件，`.reo/review/needs-review.*` 是 Reo-managed 本地恢复报告。
- `docs/current/electron.md` 定义 needs-review toast 的复制提示词由 main process 生成，不接受 raw path、report entries 或 renderer prompt。
- `docs/current/flow.md` 定义合法外部编辑通过 watcher、snapshot refresh、passive sidecar reconcile 和 Query invalidation 收敛。
- `docs/archive/specs/2026-05-26-2251-external-agent-edit-dogfood-e2e/` 记录第一轮 dogfood：主要摩擦是 agent 过度查询全局记忆或 Reo 源码，而不是文件合同本身。
- `docs/archive/specs/2026-05-27-0451-agent-file-truth-e2e-matrix/` 已覆盖 File truth、Agent dogfood 和 Recovery surface 三个优先级；本轮承接它的 agent behavior 优化，不重复造同一个 E2E matrix。

## State Machine

```text
Ordinary task
  -> agent reads memory-space AGENTS.md
  -> agent either edits directly from target files or reads skills/reo-edit/SKILL.md
  -> agent edits semantic files/directories under memories/
  -> agent verifies direct file effects
  -> agent stops
  -> Reo watcher/snapshot/read model converges technical mirrors and UI

Needs-review variant

Reo reports count or user asks for recovery
  -> agent reads AGENTS.md and skills/reo-doctor/SKILL.md
  -> agent runs node skills/reo-doctor/scripts/reo-doctor.mjs
  -> doctor reports workspace-relative entries
  -> agent repairs ordinary files or sidecar without guessing merge
  -> Reo refresh recomputes report
  -> clean count returns to zero
```

## Invariants

- 普通任务不要求 agent 读 Reo 仓库源码、全局记忆、`.reo/objects`、hash、manifest、index 或 lock。
- `AGENTS.md` 必须先给默认路径和停止条件，再给实体说明；不能把内部结构解释放在 agent 的第一决策路径上。
- `reo-edit` 必须把普通 Markdown/目录操作放在最短路径；rich Markdown 和 Expert Tiptap JSON 是可选工具，不是默认要求。
- `reo-doctor` 必须是异常恢复入口，不能暗示普通任务需要先跑 doctor。
- needs-review 复制提示词应让 agent 运行 doctor 和阅读 `.reo/review/needs-review.md`，但不把 raw path、report entries 或 root path 传过 renderer。
- 生成模板升级必须保留用户自定义 `AGENTS.md` 内容，只替换 Reo managed block。
- 不能靠文档要求 agent 维护 `.reo` 技术层来弥补 Reo 系统缺口。

## Recommended Design

压缩 generated `AGENTS.md` managed block，让前 20 行内出现三件事：普通任务默认只改 `memories/`，不需要离开当前记忆空间，验证直接文件效果后停止。实体和文件层只保留必要名词，doctor 放在异常路径。

把 `skills/reo-edit/SKILL.md` 调整为更强的 quick-start：先给 4 步普通任务，再给“何时不要继续读”的 stop rules。Rich Markdown 表格保留，但放在普通路径之后；Expert Tiptap JSON 明确只用于精确富结构或用户要求，且只编辑 `content` 字段。

把 `skills/reo-doctor/SKILL.md` 继续收窄为 recovery-only：普通任务不跑；needs-review、缺失托管配置、重复 id、sidecar 冲突或用户明确要求诊断时再用。复制提示词保持安全边界，由 main 生成，不新增 raw path IPC。

## Success Criteria

- Managed `AGENTS.md` block 的普通路径和停止条件在实体细节前出现。
- Generated `reo-edit` 包含明确 stop rules：普通任务不读 Reo repo/global memory/`.reo`，验证直接文件效果后停止。
- Generated `reo-doctor` 明确只用于异常恢复，不是普通编辑前置步骤。
- `buildWorkspaceReviewAgentPrompt()` 继续只生成安全文本，不包含 root path 或 report entry；文案引导 agent 用 doctor，而不是猜测合并。
- Existing open/doctor tests 覆盖模板升级、用户自定义内容保留、symlink safety 和 needs-review report 输出。
- 一次真实 `codex exec` dogfood 证明代表性普通任务只读入口/`reo-edit`/目标文件，不触碰 `.reo`，不搜索 Reo 源码或全局记忆，且 Reo 投影收敛。
- `npm run verify:quick` 在提交前通过。

## Verification Boundary

这是生成 agent 入口和恢复 workflow 的行为变更，使用 focused TDD：

- RED main tests for generated template order and stop rules.
- RED contract/unit test for needs-review copy prompt safety and actionability if current coverage is insufficient.
- Targeted main tests for managed config generation and doctor script.
- One dogfood `codex exec` representative task after tests pass.
- xhigh subagent review for simplification and behavior-risk check.
- Final `npm run verify:quick`.

## Non-Goals

- 不新增 in-app recovery 编辑器。
- 不把 report entries 暴露给 renderer。
- 不修改 file truth/read model，除非 dogfood 暴露系统收敛缺口。
- 不限制 agent 只能编辑 Markdown。
- 不重复 Agent/File Truth E2E Matrix。

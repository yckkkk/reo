# External Agent Edit Dogfood E2E

Timezone: America/Los_Angeles.

## Goal

验证 Reo 的外部编辑协作模型是否真的低心智负担：一般情况下，Codex-class agent 或人类只编辑普通文件和目录，Reo 静默收敛 UI、index、manifest、sidecar 和 cache；用户不需要理解刷新、hash、`.reo` 或 Tiptap 内部同步。

本 spec 首期以 dogfood 证据为主，不先假设应该改 `AGENTS.md`、`skills/*` 还是 Reo 系统。只有当真实外部 agent 行为暴露摩擦后，才按归因框架决定优化位置。

## Current Basis

- Reo memory space root 的 `AGENTS.md` 是 agent 入口；普通编辑范式在 `skills/reo-edit/SKILL.md`；异常诊断在 `skills/reo-doctor/SKILL.md`。
- 用户语义真源是 `memories/` 下的普通 Markdown 文件和目录 basename。
- `.reo`、manifest、hash、index、lock、draft 和 trash 是 Reo 管理的技术层，不是普通语义编辑入口。
- `content.tiptap.json` 是同节点富结构载体；普通任务优先改 Markdown，精确富结构或异常恢复可只改同节点 sidecar 的 `content` 字段。
- 当前 Codex CLI 的非交互入口是 `codex exec`；`-p` 是 profile 参数，不是 prompt 参数。dogfood 命令必须显式记录实际 invocation。

## State Machine

每个小场景只验证一个关键转移或副作用，不写单个大而假的 E2E。

```text
Initial memory space
  -> external agent reads entry files
  -> external agent edits ordinary files/directories or content.tiptap.json
  -> Reo receives file truth event or explicit refresh/read
  -> Workspace snapshot / Memory detail / selected content query refetch
  -> UI projection and file technical mirrors converge
  -> friction is classified
```

## Invariants

- 普通 Memory、Segment、SegmentSupplement 创建、重命名、移动和正文编辑不要求 agent 维护 `.reo/objects`、`.reo/index.json`、hash 或 lock。
- Agent 可以编辑任意文件；Reo 不通过文档限制能力，只通过系统收敛、typed error 和 needs-review 处理不确定状态。
- 如果 agent 按普通文件直觉做对了，但 Reo 不收敛，这是 Reo 系统问题，不是 agent 文档问题。
- 如果 agent 必须长时间推理 Reo 技术层才能完成普通任务，这是入口/skill 或系统抽象问题。
- 如果 agent 选择了 `.reo`、hash 或 manifest 作为普通任务入口，要先判断是入口文字误导、skill 太长/不够动作化，还是 Reo 缺少更好的普通文件 affordance。
- UI 自动收敛验证必须断言横向片段流、当前详情、content tab 和 selected content 之一的实际投影变化；不能只断言命令退出或文件 diff。
- rich text 验证必须区分 Markdown fallback 与 `content.tiptap.json` JSON-only 路径，避免假覆盖。

## Dogfood Observation Model

每个 Codex CLI 场景记录四类证据：

1. Invocation：实际命令、cwd、目标记忆空间、prompt。
2. Behavior trace：agent 最终输出、它读取了哪些入口、是否提到 `.reo` / hash / manifest / sidecar。
3. File effects：Markdown、目录、sidecar 和 `.reo` mirror 的 diff 或 hash 变化。
4. Reo projection：UI 或 focused test/runtime read 是否自动收敛，以及是否需要点击、重选或刷新。

## Friction Classification

| Symptom                                               | Primary owner                   | Optimization direction                                                |
| ----------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------- |
| agent 不知道 Reo、Memory、Segment、Supplement 是什么  | `AGENTS.md`                     | 入口定义更短、更清楚，突出实体和默认技能                              |
| agent 知道实体但路径选择慢、步骤犹豫或频繁回看规则    | `skills/reo-edit`               | 将任务改成动作化最短路径，减少背景解释                                |
| agent 普通任务仍主动维护 `.reo`、hash、manifest       | `AGENTS.md` / `skills/reo-edit` | 强化“不维护技术层”的优先级；必要时拆 quick-start                      |
| agent 做了自然文件改动，但 Reo UI 或 mirror 不收敛    | Reo system                      | 修 read model、watcher、reconcile、cache invalidation 或 needs-review |
| agent 被缺字段、名称不标准、frontmatter 缺失卡住      | Reo system first                | Reo 应补全和检查；skill 只提醒继续普通文件操作                        |
| agent 需要改高亮、下划线、link 等富结构但不知最短路径 | `skills/reo-edit`               | rich text quick examples 更靠前或更可复制                             |
| agent 正常完成但验证成本很高                          | test/dev tooling                | 增加 focused dogfood harness，不增加产品规则                          |

## First Slice

首期只选择测试记忆空间或临时新建记忆空间，不触碰用户真实内容。优先使用真实 `codex exec` 做外部 agent 操作，再用文件检查和 Reo read/UI 投影验证收敛。

首期小场景：

- Segment 重命名 + 创建 note Supplement。
- 新建 Memory。
- 新建 note Segment。
- Supplement 重命名和跨 Segment 移动。
- `content.tiptap.json` JSON-only 彩色高亮/下划线编辑。
- Memory space 标题重命名。

## Results

场景 A 使用真实 `codex exec` 在测试记忆空间 root 中重命名现有 Segment 并创建 note Supplement。外部 agent 最终只修改普通目录、`segment.md` 和 `supplement.md`，没有维护 `.reo`、hash、manifest 或 sidecar；Reo 在选择该记忆空间后将新 Segment 标题、新 Supplement tab 和新 Supplement manifest 投影出来。

主要摩擦不是文件合同，而是判断路径过重：agent 在本地 `reo-edit` 已足够的情况下仍搜索全局 Codex memory，导致 token 消耗偏高。因此首个优化落点是入口/skill 的普通任务 stop condition，而不是收紧 agent 可编辑文件范围，也不是把更多复杂性写进 `.reo` 规则。

已执行的首个优化：Reo 生成的 memory-space `AGENTS.md` 明确普通任务不需要离开当前记忆空间查询 Reo 仓库源码、全局记忆或历史文档；`skills/reo-edit/SKILL.md` 增加 Quick Start 和 “Verify direct file effects, then stop” 停止条件。

后续 dogfood 场景验证了新建 Memory、新建 note Segment、Supplement 跨 Segment 移动、`content.tiptap.json` JSON-only 富结构编辑、active workspace passive refresh。场景 F 发现并修复了系统缺口：外部改名 memory space root 后，打开 workspace 现在会按 root basename 修复 `.reo/workspace.json.title` mirror。

完整证据见 `evidence/summary.md`，自信审计见 `confidence-audit.md`。

## Non-goals

- 不改变当前编辑器视觉、toolbar 形态或 Notes-like 体验。
- 不把 `.reo` 改成普通用户语义入口。
- 不用单个大 E2E 覆盖所有流程。
- 不因为某次 agent 失败就直接收紧 agent 能编辑的文件范围。
- 不把 dogfood 观察直接写入 `docs/current/*`；只有稳定规则改变才压缩回 current。

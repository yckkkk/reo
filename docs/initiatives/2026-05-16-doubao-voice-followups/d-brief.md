# D：手动重新生成转录（brief，产品意图原文）

> 本文是 D 的产品意图原文，**不是** active spec；D 当前 active spec 是
> `docs/specs/2026-05-17-0950-doubao-voice-manual-regenerate-transcript/`，
> 其中已经把状态机、合同字段、错误码、TDD/subagent/E2E 计划、敏感信息扫描和 current docs 同步清单固化为可执行版本。
> 本 brief 在 spec 化后保留，作为产品意图与边界场景表的可读参考；spec 与 d-brief 冲突时以 spec 为准。
> C→D readiness gate 已完成。

- 时间：2026-05-16 18:06 America/Los_Angeles
- 依赖：B 的 `lastTranscriptionAttempt` manifest 字段；C 归档后的 Turbo 引擎、音频转换、BackfillQueue、手动 running UI、诊断和安全边界
- 共同约束：见 `plan.md`

## 信息优先级

1. `docs/current/*` 与源码事实
2. B、C 归档 spec / ADR
3. 用户在 brainstorm 中确认的产品意图（plan.md D 段）
4. 本 brief 内的早期判断与新信息冲突时，以最新版本为准

## 当前认知

- C 当前已完成的是 missing-only 自动/手动补转录：目标必须 `lastTranscriptionAttempt='failed'`、transcript 为空且有音频。
- C 当前手动 IPC 在已有 transcript 时会返回 not eligible，并在保存前使用 `requireTranscriptMissing` 防止覆盖用户或 agent 在 Turbo 请求期间写入的 transcript。
- D 的「重新生成转录」是覆盖式 manual regeneration，不能直接复用 C 当前 missing-only 手动触发语义。
- D 仍必须复用 C 的 Turbo `audio.data` 引擎、WebM/Opus 到 OGG/Opus remux、队列、cancel/pause/breaker、诊断脱敏和 Electron 安全边界。
- D active spec 必须定义显式 manual intent：`fill-missing` 用于无 transcript 的生成，`regenerate` 用于用户二次确认后的覆盖式重新生成。Automatic backfill 继续保持 missing-only，永远不覆盖已有 transcript。
- 覆盖式重新生成必须由 main process 在任务执行时捕获当前 transcript snapshot，并在写入前确认 transcript 没有在请求期间被用户或 agent 改动；若已变化，任务失败并保留当前 transcript。

## 范围

- D-1：Segment card More 菜单 + SegmentSupplement tab More 菜单挂载「生成转录」/「重新生成转录」
- D-2：`exists=false` 无确认 / `exists=true` AlertDialog 覆盖确认
- D-3：扩展或替换 C 当前手动 backfill request 合同，使 manual request 显式携带 `fill-missing` 或 `regenerate` 意图
- D-4：复用 C 引擎、队列排序、取消/暂停、诊断与安全边界
- D-5：为已有 transcript 的 regeneration 提供不覆盖并发人工编辑的 main 侧保护

## 范围外

- 新 main-to-renderer backfill event channel
- 用户编辑 transcript 文本能力
- 选段重转
- 撤销重转
- transcript 历史版本

## 硬约束

- 不从 renderer 直接调用 saveTranscript / saveSegmentSupplementTranscript 来伪造引擎结果
- 复用 C 归档后的 Turbo 引擎、音频转换、BackfillQueue 和手动 running UI；D 不定义第二套队列或事件通道
- D 的 manual request 必须显式表达是否允许覆盖；没有 `regenerate` 意图时不得覆盖已有 transcript
- AlertDialog 使用 `WorkspaceDangerConfirmDialog`，不引入新危险确认结构
- 不放松 single-active-spec 规则

---

## 一、功能目标（产品功能说明）

让用户：

1. 对一段「上次系统失败、转录仍空」的 segment 主动触发重转（与 B 的"重试"按钮同源；但 D 把入口提升到实体 More 菜单层）
2. 对一段「转录成功但我不满意 / 我外部清空过想恢复 / 我想让 Reo 重新生成更好版本」的 segment 主动触发覆盖式重转，**带二次确认**避免误触

D 不引入额外引擎、额外队列、额外 query 或 main-to-renderer event。它是 C 引擎/队列能力 + B 状态字段 + 显式 manual regeneration 合同的组合入口。

## 二、用户角色

- 单用户本机使用者
- BYOK；启用 + key valid 是 D 的前置（C 检查已涵盖；D 调引擎时 main 侧二次验证）

## 三、使用入口

- Segment card More 菜单内一个菜单项（与 rename / delete 同层）
- SegmentSupplement tab More 菜单内一个菜单项（与 rename / delete 同层）

不在以下位置出现：

- B 的转录 tab 内 inline 按钮（B 的"重试"按钮调用 C 已归档的共享手动触发合同；D 的 More 菜单也复用同一合同，但 D 不拥有该合同）
- 不在 RecordingOverlay 内
- 不在 Memory rail 内
- 不在 Workspace titlebar 内

## 四、前置条件

- B 已归档：`lastTranscriptionAttempt` 字段稳定；`SegmentTranscriptView` 已支持 `failed-retryable` outcome
- C 已归档：BackfillQueue、missing-only 手动触发 IPC、引擎客户端与音频交付路径已实现
- voice settings：D 调引擎前 main 侧沿用 C gate，要求 `enabled=true ∧ apiKeyConfigured=true ∧ lastValidationOk=true`

## 五、页面状态 / 流程状态

D 不是页面，是菜单项 + 二次确认 + 引擎调用。状态：

| 状态          | 进入条件                               | 系统行为                                    | UI 表现                                                                                  | 退出                |
| ------------- | -------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------- |
| `menu-closed` | 默认                                   | 无                                          | More 按钮可见                                                                            | 用户点 More         |
| `menu-open`   | 用户点 More                            | 显示菜单项；判定 `exists` 决定 label        | 「生成转录」or「重新生成转录」                                                           | 选项点击 / 关闭菜单 |
| `confirming`  | `exists=true` 时点「重新生成转录」     | 打开 AlertDialog                            | "会覆盖现有转录（包括外部编辑）"                                                         | 确认 / 取消         |
| `enqueued`    | 确认 / `exists=false` 时点「生成转录」 | 调 D 扩展后的 manual backfill 入口          | 菜单项 disabled；不新增全局任务列表                                                      | 队首 → running      |
| `running`     | 队首执行                               | C 引擎跑                                    | missing 路径复用 B 的 running；regenerate 路径保留既有 transcript 并显示正在重新生成状态 | 成功 / 失败         |
| `succeeded`   | 引擎成功 + saveTranscript 成功         | manifest 'success'                          | B 的 success 分支                                                                        | 终态                |
| `failed`      | 引擎失败 / save 失败                   | transcript 与 manifest 保持本次任务前的原值 | root toast 显示错误；B 的 outcome 不变                                                   | 用户可再点 More     |

注意 D 的 `running` 状态借用 C 的 `BackfillQueue.running`；不引入第二条队列。D 任务进入同一队列，去重、排序和优先级完全服从 C 已落地的队列合同。

## 六、每个状态详细说明

### `menu-closed`

- 默认；More 按钮在 hover/focus/menu-open 时可见（现状）

### `menu-open`

- 菜单项动态 label：
  - `transcript.exists=false`：「生成转录」（无 icon 或用 RotateCw lucide icon）
  - `transcript.exists=true`：「重新生成转录」
- enable/disable 规则：
  - voice settings `enabled=false` 或 `apiKeyConfigured=false` → 菜单项 disabled，hover tooltip：「先在设置里启用并填写 X-Api-Key」
  - 任务在 C 自动队列中已存在 → 菜单项 disabled，tooltip：「正在自动生成中」

### `confirming`

- 仅 `exists=true` 时
- 用 `WorkspaceDangerConfirmDialog`：
  - title：「重新生成转录」
  - description：「这会覆盖现有转录，包括你在外部编辑过的部分。无法撤销。」
  - 确认按钮：「重新生成」（destructive variant）
  - 取消按钮：「取消」
- 确认按钮 click 不自动关闭 Dialog；先入队成功 → 关闭 Dialog；入队失败 → 显示 inline error

### `enqueued`

- D 任务通过扩展后的 manual backfill 入口进入 BackfillQueue；具体排序服从 C 队列合同
- `fill-missing` 任务可复用 C/B 的失败 + 重试 running copy
- `regenerate` 任务不得清空或隐藏已有 transcript 文件真源；UI 可以显示正在重新生成状态，但失败后必须回到原 transcript

### `running` / `succeeded` / `failed`

- 共用 C 的 BackfillQueue 与 Turbo 引擎
- `fill-missing` 成功路径与 C 一致
- `regenerate` 成功路径允许覆盖 transcript；写入前必须确认本次任务开始后 transcript 未被外部改动，否则返回 typed error 并保留当前 transcript

## 七、组件元素拆解

### renderer 组件

| 元素                                       | 解决问题                                                | 实现要点                                        |
| ------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------- |
| `SegmentActionsMenu` 扩展                  | 加「生成转录 / 重新生成转录」菜单项                     | 复用现有 menu structure；动态 label by `exists` |
| `SegmentSupplementActionsMenu` 扩展        | 对称                                                    | 同上                                            |
| `WorkspaceDangerConfirmDialog` 复用        | 不新增弹层组件                                          | 传 title / description / confirmLabel           |
| MemoryStudio 引入 backfill trigger handler | 接 menu callback → 调用 D 扩展后的 manual backfill 合同 | feature-local                                   |

### main process 组件

| 元素                         | 解决问题               | 实现要点                                                  |
| ---------------------------- | ---------------------- | --------------------------------------------------------- |
| C 引擎 / 队列 / 音频交付能力 | 提供 D 执行基础        | 复用 C 已有 Turbo、remux、queue、diagnostics、安全边界    |
| D manual regeneration 合同   | 提供覆盖式重新生成入口 | 显式区分 `fill-missing` 与 `regenerate`；只 manual 可覆盖 |

### IPC 边界

D 必须在 renderer 触发 manual backfill 合同，不能直接调用 `saveTranscript` 来伪造引擎结果。C 当前 trigger 是 missing-only；D spec 必须决定是在现有 `workspace:requestSegmentTranscriptionBackfill` / `workspace:requestSegmentSupplementTranscriptionBackfill` 上增加显式 mode，还是替换为新的当前合同。由于 Reo 未发布，不需要保留旧 request shape 的兼容层。

## 八、状态切换规则

```text
menu-closed ──[user click More]──→ menu-open
menu-open ──[esc / outside click]──→ menu-closed
menu-open ──[click 'generate' & exists=false]──→ enqueued
menu-open ──[click 'regenerate' & exists=true]──→ confirming
confirming ──[cancel]──→ menu-closed
confirming ──[confirm]──→ enqueued
enqueued ──[queue head]──→ running
running ──[engine ok + save ok]──→ succeeded
running ──[engine fail | save fail]──→ failed
failed ──[user retry via menu]──→ enqueued
```

## 九、数据如何同步

- 入队事件：D 调扩展后的 manual backfill 入口 → main 按 C 队列合同入队；不新增 main → renderer 事件通道
- transcript text 写入：main 内部复用 saveTranscript / saveSegmentSupplementTranscript 能力，但 `regenerate` 必须携带明确覆盖意图和并发编辑保护
- TanStack Query：saveTranscript success response 触发现有 Memory detail cache merge；无新 invalidation 路径

## 十、接口契约

### 新增（已固化在 active spec）

D active spec 锁定当前 manual backfill request 合同：

- 在两个现有 channel 上扩展显式 `mode: 'fill-missing' | 'regenerate'` 字段；Reo 未发布，不保留 omitted-mode 兼容垫片。
- `regenerate` 只允许 renderer 在二次确认后发送；菜单 fill-missing 路径强制 `mode='fill-missing'`，confirm 后强制 `mode='regenerate'`。
- automatic scanner / automatic batch 内部 mode 固定 fill-missing；automatic 路径不接受 regenerate。
- main 端 regenerate 路径在 in-flight 捕获 transcript snapshot digest；save 前比对，digest 不一致返回新增 `ERR_BACKFILL_TRANSCRIPT_CHANGED`，不改写 transcript / manifest。

### 复用

- C 归档后的 Turbo 引擎、音频转换、BackfillQueue、诊断和安全边界
- `workspace:saveTranscript` / `workspace:saveSegmentSupplementTranscript`（C 任务内部用）
- `WorkspaceDangerConfirmDialog`

### 不引入

- 不引入第二个 transcript save IPC
- 不引入任务取消 IPC（与 C 一致）

## 十一、第三方能力

复用 C 的录音文件识别引擎客户端与音频交付路径，不引入新外部 API。

## 十二、边界情况补齐

| 场景                                                       | 处理                                                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `enabled=false` 时点 More                                  | 菜单项 disabled + tooltip 引导 settings                                                                                        |
| `apiKeyConfigured=false`                                   | 同上                                                                                                                           |
| `lastValidationCode='auth'` 或 `lastValidationOk !== true` | 菜单项 disabled，tooltip 引导用户去 Settings 重新保存或验证 X-Api-Key                                                          |
| `confirming` 期间用户切 segment                            | Dialog 跟随 segment（绑定 confirm target identity）；切换会先 prompt（与现有 Segment delete dialog 行为一致或 forcibly close） |
| `confirming` 期间任务被 C 自动入队                         | D confirm 仍生效；BackfillQueue 内按 C 队列合同去重和排序                                                                      |
| 同 segment 同时 D 两次点击                                 | 第二次入队前检查 BackfillQueue 是否已有同 target；有 → root toast「该录音正在生成中」                                          |
| `regenerate` 请求期间 transcript 被外部编辑                | main 写入前检测到变化，返回 typed error，保留当前 transcript，不写入 Turbo 结果                                                |
| `exists=true` 但用户外部清空                               | UI 已是 `empty-cleared`；More 菜单 label 切回「生成转录」（无确认）                                                            |
| `exists=false` 但 lastAttempt='failed'                     | More 菜单 label「生成转录」（无确认）；与 B 的 inline「重试」按钮等价                                                          |
| 录音中点 More                                              | More 菜单允许打开；「生成转录 / 重新生成转录」项 disabled，tooltip「先完成或关闭录音」                                         |
| supplement 已被删除（trash）                               | More 菜单不再渲染（current implementation 已涵盖）                                                                             |
| 多 supplement 同 segment                                   | 各自独立；每个有自己的 More 与自己的 backfill 任务                                                                             |
| 任务 saveTranscript 部分失败 `previous-file-preserved`     | manifest 不更新；root toast 显示错误；UI 保持原态                                                                              |
| 任务 saveTranscript `file-written-index-stale`             | manifest 已是 'success'（路径 2）；UI 显示 success；root toast 显示 stale 错误                                                 |

## 十三、性能 / 防丢失 / 防重复

- 防重复入队：BackfillQueue 内同 target 去重
- 任务持久化：与 C 一致，不持久化 in-flight
- 手动任务与自动任务的排序服从 C 队列合同；D 不新增第二套优先级规则
- 单任务 abort：workspace 切换时与 C 共享 abort 路径

## 十四、最终目标总结（可放在 D spec 顶部）

D 的最终交付是：让用户在 Memory Studio 内通过 Segment card 与 SegmentSupplement tab 的 More 菜单显式触发转录生成或重新生成；菜单项动态显示为「生成转录」（当 transcript 不存在时，无二次确认）或「重新生成转录」（当 transcript 已存在时，AlertDialog 二次确认提示会覆盖当前转录）。确认后 D 通过显式 manual intent 进入同一 BackfillQueue，引擎与队列能力复用 C；`fill-missing` 不允许覆盖已有 transcript，`regenerate` 只在用户确认后允许覆盖，并在 main 写入前确认 transcript 未在请求期间变化。成功通过现有 transcript save 能力写回，manifest 经 save 路径变为 'success'；失败只显示 root toast，transcript 与 manifest 保持本次任务前的原值。Voice settings 未启用、未配置 X-Api-Key 或 last validation 不通过时菜单项 disabled + tooltip。本 spec 不新增 main-to-renderer event channel、不新增 Query key、不新增 Zustand store。验收依据 D spec verification.md：菜单 label 与 exists 动态对应、AlertDialog 仅在 overwrite 路径触发、manual request 显式区分 `fill-missing` / `regenerate`、自动任务仍 missing-only、入队遵守 C 队列合同、save 成功后 manifest 自动 'success'、失败和并发人工编辑不破坏既有 transcript、voice settings gate disabled、TypeScript strict 与 `npm run verify:quick` 全绿；本 spec 与 `docs/current/frontend.md` / `docs/current/flow.md` / `docs/current/electron.md` / `docs/current/data.md` / `docs/current/quality.md` 必须在收口时同批更新。

## 十五、Readiness gate

C→D readiness gate 已完成；结论是 C 的引擎、队列和安全边界足以支撑 D，但 C 当前手动触发合同不足以支撑覆盖式重新生成。覆盖式合同已在 D active spec `docs/specs/2026-05-17-0950-doubao-voice-manual-regenerate-transcript/` 锁定为 `mode: 'fill-missing' | 'regenerate'` + main 端 transcript snapshot guard + 新增 `ERR_BACKFILL_TRANSCRIPT_CHANGED`。下一步是 D 实施 session 按该 spec tasks.md 执行。

## 十六、不实施

- transcript 文本用户编辑能力
- 选段重转
- 撤销重转
- transcript 历史版本
- 任务可取消按钮
- 任务进度条

# D：手动重新生成转录（brief，待 spec 化）

> 本文是 D 的"准 spec"：按工程师可直接消费的标准撰写，但**不是** active spec。
> 进入 `docs/specs/` 前必须满足：B 已归档、C 已归档，且 plan.md 的 C→D readiness gate 已完成。
> D 只消费重新审视后完成的 C 合同；C 未归档前不得按本文提前创建 D spec。

- 时间：2026-05-16 18:06 America/Los_Angeles
- 依赖：B 的 `lastTranscriptionAttempt` manifest 字段；C 归档后的手动触发合同、BackfillQueue 与引擎基线
- 共同约束：见 `plan.md`

## 信息优先级

1. `docs/current/*` 与源码事实
2. B、C 归档 spec / ADR
3. 用户在 brainstorm 中确认的产品意图（plan.md D 段）
4. 本 brief 内的早期判断与新信息冲突时，以最新版本为准

## 范围

- D-1：Segment card More 菜单 + SegmentSupplement tab More 菜单挂载「生成转录」/「重新生成转录」
- D-2：`exists=false` 无确认 / `exists=true` AlertDialog 覆盖确认
- D-3：复用现有 saveTranscript / saveSegmentSupplementTranscript IPC，**无新 channel**
- D-4：复用 C 引擎合同、队列排序与中间态展示

## 范围外

- 新 IPC channel
- 用户编辑 transcript 文本能力
- 选段重转
- 撤销重转
- transcript 历史版本

## 硬约束

- 复用现有 saveTranscript IPC
- 复用 C 归档后的手动触发 IPC 与 BackfillQueue；D 不定义第二套队列或事件通道
- AlertDialog 使用 `WorkspaceDangerConfirmDialog`，不引入新危险确认结构
- 不放松 single-active-spec 规则

---

## 一、功能目标（产品功能说明）

让用户：

1. 对一段「上次系统失败、转录仍空」的 segment 主动触发重转（与 B 的"重试"按钮同源；但 D 把入口提升到实体 More 菜单层）
2. 对一段「转录成功但我不满意 / 我外部清空过想恢复 / 我想让 Reo 重新生成更好版本」的 segment 主动触发覆盖式重转，**带二次确认**避免误触

D 不引入额外引擎、额外 IPC、额外 query；它是 C 引擎合同 + B 状态字段 + 现有 saveTranscript 的组合入口。

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
- C 已归档：BackfillQueue、手动触发 IPC、引擎客户端与音频交付路径已实现
- voice settings：D 调引擎前 main 侧检查 `enabled=true ∧ apiKeyConfigured=true`；不强制 `lastValidationOk=true`（用户可能主动重试以验证）

## 五、页面状态 / 流程状态

D 不是页面，是菜单项 + 二次确认 + 引擎调用。状态：

| 状态          | 进入条件                               | 系统行为                                    | UI 表现                                                  | 退出                |
| ------------- | -------------------------------------- | ------------------------------------------- | -------------------------------------------------------- | ------------------- |
| `menu-closed` | 默认                                   | 无                                          | More 按钮可见                                            | 用户点 More         |
| `menu-open`   | 用户点 More                            | 显示菜单项；判定 `exists` 决定 label        | 「生成转录」or「重新生成转录」                           | 选项点击 / 关闭菜单 |
| `confirming`  | `exists=true` 时点「重新生成转录」     | 打开 AlertDialog                            | "会覆盖现有转录（包括外部编辑）"                         | 确认 / 取消         |
| `enqueued`    | 确认 / `exists=false` 时点「生成转录」 | 调 C 合同提供的手动触发入口                 | UI 不变（仍由 C/B 显示失败 + 重试，不显示排队中）        | 队首 → running      |
| `running`     | 队首执行                               | C 引擎跑                                    | B 的 outcome 'running'：transcript view 显示「正在生成」 | 成功 / 失败         |
| `succeeded`   | 引擎成功 + saveTranscript 成功         | manifest 'success'                          | B 的 success 分支                                        | 终态                |
| `failed`      | 引擎失败 / save 失败                   | transcript 与 manifest 保持本次任务前的原值 | root toast 显示错误；B 的 outcome 不变                   | 用户可再点 More     |

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

- D 任务通过 C 已有手动触发入口进入 BackfillQueue；具体排序服从 C 队列合同
- UI 保持 C/B 的失败 + 重试，不显示排队中；只有队首进入 `running` 后才切到 B 的 outcome 'running'

### `running` / `succeeded` / `failed`

- 与 C 完全一致（共用 BackfillQueue 与手动触发合同）

## 七、组件元素拆解

### renderer 组件

| 元素                                       | 解决问题                            | 实现要点                                        |
| ------------------------------------------ | ----------------------------------- | ----------------------------------------------- |
| `SegmentActionsMenu` 扩展                  | 加「生成转录 / 重新生成转录」菜单项 | 复用现有 menu structure；动态 label by `exists` |
| `SegmentSupplementActionsMenu` 扩展        | 对称                                | 同上                                            |
| `WorkspaceDangerConfirmDialog` 复用        | 不新增弹层组件                      | 传 title / description / confirmLabel           |
| MemoryStudio 引入 backfill trigger handler | 接 menu callback → 复用 C 引擎合同  | feature-local                                   |

### main process 组件

| 元素                                | 解决问题                                  | 实现要点                                                              |
| ----------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| C 引擎 / 队列合同提供的手动触发入口 | 提供 D 入队入口                           | 必须已在 C 中定义 process boundary、取消语义、并发规则和 current docs |
| 不引入 D 专属 IPC channel           | D 复用 C 的触发合同与现有 transcript save | D 只挂载菜单、确认和 renderer 状态；不单独新增 request channel        |

### IPC 边界

D 必须在 renderer 触发已存在的 C 引擎 / 队列合同，不能直接调用 `saveTranscript` 来伪造引擎结果。若 C 需要新增 renderer-to-main trigger IPC，必须在 C spec 中先作为 C 引擎合同的一部分落地；D spec 只复用该已存在 trigger，不再新增 D 专属 IPC channel。

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

- 入队事件：D 调 C 已有手动触发入口 → main 按 C 队列合同入队；不新增 main → renderer 事件通道
- transcript text 写入：复用 saveTranscript（C 实施时已做）
- TanStack Query：saveTranscript success response 触发现有 Memory detail cache merge；无新 invalidation 路径

## 十、接口契约

### 新增

- D 不定义新增 request channel。C spec 必须先定义并归档 renderer 手动触发入口、payload、response、错误信封、队列去重和排序规则；D 只复用该已存在合同。

### 复用

- C 归档后的手动 backfill IPC
- `workspace:saveTranscript` / `workspace:saveSegmentSupplementTranscript`（C 任务内部用）
- `WorkspaceDangerConfirmDialog`

### 不引入

- 不引入第二个 transcript save IPC
- 不引入任务取消 IPC（与 C 一致）

## 十一、第三方能力

复用 C 的录音文件识别引擎客户端与音频交付路径，不引入新外部 API。

## 十二、边界情况补齐

| 场景                                                   | 处理                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `enabled=false` 时点 More                              | 菜单项 disabled + tooltip 引导 settings                                                                                        |
| `apiKeyConfigured=false`                               | 同上                                                                                                                           |
| `lastValidationCode='auth'`                            | 菜单项**可点**；点击后引擎会失败 → root toast；用户被 Sidebar 红点 + 显式失败 toast 引导去 settings                            |
| `confirming` 期间用户切 segment                        | Dialog 跟随 segment（绑定 confirm target identity）；切换会先 prompt（与现有 Segment delete dialog 行为一致或 forcibly close） |
| `confirming` 期间任务被 C 自动入队                     | D confirm 仍生效；BackfillQueue 内按 C 队列合同去重和排序                                                                      |
| 同 segment 同时 D 两次点击                             | 第二次入队前检查 BackfillQueue 是否已有同 target；有 → root toast「该录音正在生成中」                                          |
| `exists=true` 但用户外部清空                           | UI 已是 `empty-cleared`；More 菜单 label 切回「生成转录」（无确认）                                                            |
| `exists=false` 但 lastAttempt='failed'                 | More 菜单 label「生成转录」（无确认）；与 B 的 inline「重试」按钮等价                                                          |
| 录音中点 More                                          | More 菜单允许打开；「生成转录 / 重新生成转录」项 disabled，tooltip「先完成或关闭录音」                                         |
| supplement 已被删除（trash）                           | More 菜单不再渲染（current implementation 已涵盖）                                                                             |
| 多 supplement 同 segment                               | 各自独立；每个有自己的 More 与自己的 backfill 任务                                                                             |
| 任务 saveTranscript 部分失败 `previous-file-preserved` | manifest 不更新；root toast 显示错误；UI 保持原态                                                                              |
| 任务 saveTranscript `file-written-index-stale`         | manifest 已是 'success'（路径 2）；UI 显示 success；root toast 显示 stale 错误                                                 |

## 十三、性能 / 防丢失 / 防重复

- 防重复入队：BackfillQueue 内同 target 去重
- 任务持久化：与 C 一致，不持久化 in-flight
- 手动任务与自动任务的排序服从 C 队列合同；D 不新增第二套优先级规则
- 单任务 abort：workspace 切换时与 C 共享 abort 路径

## 十四、最终目标总结（可放在 D spec 顶部）

D 的最终交付是：让用户在 Memory Studio 内通过 Segment card 与 SegmentSupplement tab 的 More 菜单显式触发转录重新生成；菜单项动态显示为「生成转录」（当 transcript 不存在时，无二次确认）或「重新生成转录」（当 transcript 已存在时，AlertDialog 二次确认提示会覆盖外部编辑）。确认后 D 复用 C 已归档的手动触发合同进入同一 BackfillQueue，引擎与队列能力复用 C；成功通过现有 `workspace:saveTranscript` / `workspace:saveSegmentSupplementTranscript` 写回，manifest 经 saveTranscript 路径自动变为 'success'；失败只显示 root toast，transcript 与 manifest 保持本次任务前的原值。Voice settings `enabled=false` 或 `apiKeyConfigured=false` 时菜单项 disabled + tooltip；`lastValidationCode='auth'` 时菜单可点但任务会失败，用户由 Sidebar 红点（B-2）和 toast 引导去 Settings 修正。本 spec 不新增 D 专属 IPC channel。验收依据 D spec verification.md：菜单 label 与 exists 动态对应、AlertDialog 仅在 overwrite 路径触发、入队遵守 C 队列合同、saveTranscript 成功后 manifest 自动 'success'、失败不破坏既有 transcript、`enabled=false` 时菜单 disabled、TypeScript strict 与 `npm run verify:quick` 全绿；本 spec 与 `docs/current/frontend.md` / `docs/current/flow.md` / `docs/current/electron.md` 必须在收口时同批更新。

## 十五、Readiness gate

C→D readiness gate 只在 plan.md 定义并只执行一次；D spec 创建前必须确认 C 已归档的手动触发合同足以支撑本 brief。

## 十六、不实施

- transcript 文本用户编辑能力
- 选段重转
- 撤销重转
- transcript 历史版本
- 任务可取消按钮
- 任务进度条

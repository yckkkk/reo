# D：豆包语音手动重新生成转录 — 产品功能说明与工程实现说明

本计划是 D 实施 session 的当前真源。`docs/current/*` 与源码事实优先于本计划；本计划只描述当前正确的 D 设计。Reo 未发布，不保留任何兼容垫片或旧合同分支。

## 1. 本次需求目标

### 1.1 用户目标

用户在 Memory Studio 中看到某个录音或补充录音的转录时，能够：

- 当转录为空且上一次系统补转录失败时，直接重试一次生成转录；
- 当转录已存在但自己不满意、外部清空过、或希望让 Reo 重新生成更好版本时，主动触发一次覆盖式重新生成，并被明确告知会覆盖现有转录。

### 1.2 产品体验目标

- 入口位置稳定：永远在实体的 More 菜单内，且与 rename / delete 同层。
- 菜单项 label 与当前转录是否存在一致：`生成转录` / `重新生成转录`。
- 仅覆盖式路径要求二次确认，避免误触。
- 失败时 transcript 与 manifest 保持本次任务前的原值；用户可重试。
- 运行中 UI 与 B 的 `running` 文案一致；不引入新的进行中视觉层。
- 不打断 Memory Studio 主轨道：菜单关闭即可继续浏览，AlertDialog 仅在覆盖路径短暂出现。

### 1.3 功能目标

- 扩展 manual backfill 合同字段 `mode: 'fill-missing' | 'regenerate'`，作为当前唯一允许的 manual request shape。
- 在 main 端实现 `regenerate` 路径的 transcript snapshot guard：任务进入 in-flight 时捕获 digest，save 前比对；不一致直接 typed error，不改写当前 transcript。
- 在 Segment card 与 SegmentSupplement tab 的 More 菜单中加入「生成转录 / 重新生成转录」菜单项，按 `transcript.exists` 动态切换 label。
- 覆盖路径复用 `WorkspaceDangerConfirmDialog`；确认按钮使用 destructive variant。
- 复用 C 的引擎、队列、ffmpeg remux、scanner、诊断、安全边界与现有 `running` UI。
- 自动 scanner 与 automatic batch 永远只入队等价 `fill-missing` 目标；自动路径不接受 `regenerate`。
- 不新增 main-to-renderer event channel、TanStack Query key、Zustand store、durable file 字段、manifest schema、第二条队列或第二套引擎客户端。
- 同步对应 `docs/current/*` 与本 spec 验收；归档时把 D 的稳定结论压缩进 current docs。

### 1.4 当前版本范围

- D-1：Segment card More 菜单与 SegmentSupplement tab More 菜单加入「生成转录 / 重新生成转录」菜单项。
- D-2：`transcript.exists=false` 无二次确认；`transcript.exists=true` 经 `WorkspaceDangerConfirmDialog` 覆盖确认。
- D-3：扩展 IPC 合同的 `mode` 字段并把 manual backfill 合同从 missing-only 升级到 `fill-missing | regenerate` 的当前事实。
- D-4：复用 C 的 BackfillQueue、Turbo client、ffmpeg remux、scanner、cancelAll、pause/resume、breaker、batch cap 与诊断。
- D-5：实现 main 端 `regenerate` transcript snapshot guard，防止并发人工或 agent 编辑被覆盖。
- D-6：renderer 错误映射扩展 `ERR_BACKFILL_TRANSCRIPT_CHANGED`；其它 D 触发可能命中的错误码沿用 C 现有文案。
- D-7：voice settings gate、`lastValidationCode='auth'` gate、recording overlay open gate 决定菜单项 disabled 文案。
- D-8：同步 `docs/current/electron.md`、`data.md`、`flow.md`、`frontend.md`、`quality.md`，把 D 的稳定结论压缩为 current 真源。

### 1.5 当前版本不包含

- transcript 文本用户编辑能力（无 inline editor）。
- 选段重转、撤销重转、transcript 历史版本、任务可取消按钮、任务进度条。
- 自动 scanner 触发覆盖式重新生成。
- 任何新 IPC channel、TanStack Query key、Zustand store、manifest schema 字段、durable file 字段。
- main-to-renderer backfill event channel、generic command bus、generic IPC bridge。
- 第三方对象存储、TOS、AK/SK、公网隧道、本地公开 HTTP 服务。

## 2. 输入信息理解

### 2.1 已确认信息

1. d-brief.md 中 D 的产品意图、入口位置、状态机骨架与边界情况。
2. C 归档 spec 与 ADR 0005 中的引擎、音频格式、错误策略、安全边界。
3. `docs/current/electron.md` 当前 `workspace:requestSegment(Supplement)TranscriptionBackfill` 合同：只接受 `workspaceHandle, workspaceId, memoryId, segmentId(, supplementId)`，response 复用 transcript save 响应，response 不返回 raw path、audio bytes、base64、API key、火山请求体或 transcript 外的诊断字段。
4. `docs/current/data.md` 当前 manual backfill running state 由 App component-state Set 持有。
5. `docs/current/data.md` 与 `docs/current/electron.md` 当前 manual backfill 是 missing-only：`requireTranscriptMissing: true` 在 runtime 保存前生效；已有 transcript → `ERR_BACKFILL_TARGET_NOT_ELIGIBLE`；automatic 在 save 之前命中此错时静默丢弃，manual 报错。
6. `docs/current/frontend.md` 当前 Segment card 与 SegmentSupplement tab 已经使用 `SegmentActionsMenu` / `SegmentSupplementActionsMenu` 承载 More 菜单；Segment delete 已经使用 `WorkspaceDangerConfirmDialog` 二次确认；Segment 转录 tab 已经使用 `SegmentTranscriptView` 表达 `failed-retryable` 与 `running` outcome。
7. `docs/current/quality.md` 当前错误信封真源在 `workspace-contract.ts` 的 `workspaceErrorCodeSchema` 与 `workspaceErrorEnvelopeSchema`；用户文案在 `workspaceErrorMessages.ts`。
8. d-brief.md 中明确：自动补转录永远 missing-only；renderer 不得直接调用 `workspace:saveTranscript` 或 `workspace:saveSegmentSupplementTranscript`；不引入 main-to-renderer event、新 Query key 或新 Zustand store。

### 2.2 信息优先级处理

- 当 d-brief.md 与 `docs/current/*` 冲突时，以 current 真源为准；冲突修正写在 plan/tasks。
- 当 d-brief.md 与 C 归档 spec/ADR 0005 冲突时，以最新当前 current docs 为准。
- d-brief 中关于 IPC 合同最终 shape 的"两种方向（增加字段 vs 替换 channel）"，本 plan 锁定为"在现有两个 channel 上增加显式 `mode` 字段"。理由：Reo 未发布，channel 名稱与 capability 一致；不需要为了表达意图而拆 channel。

### 2.3 假设

1. `transcript.exists` 与 `transcript.text` 是 selected Segment/SegmentSupplement content Query 的 response 字段，renderer 可直接读取并据此驱动 menu label。如果实际命名不同，下一 session 在实施时按源码事实调整 label 派生逻辑。
2. main 端 transcript snapshot digest 使用 sha256（Node 内置 `node:crypto`）；只在 main process 内部计算与比较，不暴露 digest 字段到 renderer、IPC response、诊断或文件。
3. `SegmentTranscriptView` 现有 `running` outcome 既适用 fill-missing 也适用 regenerate；regenerate 期间继续显示当前 transcript 文本，并叠加 running 文案；如果当前 outcome 派生模式只允许"running 时隐藏正文"，下一 session 在实施时按 Reo 设计系统决定是否扩展 `running-overwrite` outcome 还是复用 `running`。这条假设落在 tasks 的 RED 阶段。
4. App 当前 manual backfill running Set 的 key（普通 Segment 与 SegmentSupplement 各一）可以承载本次 mode 区分。无需新增 Set。
5. 自动 scanner 当前内部入队的等价语义是 `fill-missing`；scanner/automatic enqueue 实施时把 mode 当作 internal task field 写入 BackfillQueueTask，不暴露给 renderer/contract。

### 2.4 待确认项

1. `lastValidationCode='network'` 时菜单项是否仍可点击。本 plan 锁定"可点击，让用户手动尝试"。下一 session 在实施前若用户产品上希望对 network 也 disabled，按用户最新意图调整 plan 与 verification。
2. 当 segment/supplement 同时存在 automatic queued/in-flight 任务时，是否在 renderer 端 disable 菜单。本 plan 锁定"不禁用，依靠 main 返回 ALREADY_RUNNING + root toast"；理由：renderer 没有自动队列状态订阅，且不允许新增 main-to-renderer event。
3. confirming Dialog 期间用户切换 segment 是否强制关闭 Dialog。本 plan 锁定"切换 segment 时立刻关闭 Dialog 并丢弃 confirm intent，与现有 SegmentSupplementDeleteDialog 切换 segment 的行为对齐"。下一 session 实施时按实际 Dialog hook 行为调整。

### 2.5 工程补充

- 新增错误码 `ERR_BACKFILL_TRANSCRIPT_CHANGED` 属于工程补充：d-brief 描述了语义，但没指定字符串。本 plan 锁定为 `ERR_BACKFILL_TRANSCRIPT_CHANGED`。
- mode 字段名 `mode`、字符串 `'fill-missing'` / `'regenerate'` 属于工程补充。
- transcript snapshot digest 算法 sha256 属于工程补充。
- AlertDialog 文案"这会覆盖现有转录，包括你在外部编辑过的部分。无法撤销。"是 d-brief 提供的；按 design system + i18n 习惯保留中文。

## 3. 功能类型判断

| 功能类型           | 是否涉及 | 判断依据                                                                                                                                          |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 页面功能           | 否       | D 不引入新页面                                                                                                                                    |
| 组件功能           | 是       | 扩展 `SegmentActionsMenu` 与 `SegmentSupplementActionsMenu`；复用 `WorkspaceDangerConfirmDialog`；复用 `SegmentTranscriptView` 的 running outcome |
| 表单功能           | 否       | D 没有用户输入；只有确认按钮                                                                                                                      |
| 编辑功能           | 是       | 覆盖现有 transcript 文件正文                                                                                                                      |
| 危险操作功能       | 是       | overwrite 路径需要二次确认                                                                                                                        |
| 异步任务功能       | 是       | 任务进入 BackfillQueue，跨 main process 异步执行                                                                                                  |
| AI 功能            | 是       | 调用豆包大模型录音文件极速版识别 API                                                                                                              |
| 桌面端系统能力功能 | 是       | 通过 main process + ffmpeg remux + safeStorage X-Api-Key                                                                                          |
| 本地数据管理功能   | 是       | 写入 `segment.md` / `supplement.md` 正文；更新 `.reo/objects/*` manifest 的 `lastTranscriptionAttempt`                                            |
| 后台配置功能       | 否       | 不修改 voice settings；仅消费                                                                                                                     |
| 通知功能           | 是       | 失败通过 root toast 通知                                                                                                                          |
| 权限功能           | 是       | voice settings gate；录音 overlay open gate                                                                                                       |

## 4. 用户角色与使用场景

| 项目     | 说明                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 目标用户 | 单用户本机使用者；已保存并启用 X-Api-Key（BYOK）；当前 voice settings `enabled=true ∧ apiKeyConfigured=true`                                     |
| 用户场景 | 用户在 Memory Studio 浏览某条 finalized audio Segment 或 SegmentSupplement，对当前 transcript 不满意（自动失败、外部清空或希望重新生成更好版本） |
| 使用入口 | Segment card More 菜单项；SegmentSupplement tab More 菜单项                                                                                      |
| 前置条件 | finalized audio Segment 或 SegmentSupplement；voice settings 启用且 X-Api-Key 已配置；当前 `lastValidationOk=true`（`auth` 状态下菜单 disabled） |
| 用户任务 | 触发 manual `fill-missing` 或 `regenerate` 任务，等待 transcript 文本回到 Memory Studio                                                          |
| 成功结果 | transcript 文本更新；`lastTranscriptionAttempt='success'`；`SegmentTranscriptView` 切回 success outcome                                          |
| 失败结果 | root toast 显示脱敏错误；transcript 与 manifest 保持本次任务前的原值；用户可再次点击                                                             |
| 权限限制 | 单机用户；无多账号；BYOK 凭证不暴露 renderer；录音 overlay open 时菜单 disabled                                                                  |

## 5. 页面与流程说明

### 5.1 页面结构

D 不引入新页面。复用：

- Memory Studio Segment card（每个 finalized audio Segment 一张）
- Memory Studio SegmentSupplement tab pill（每个 finalized audio SegmentSupplement 一个 tab）
- Memory Studio Segment 转录 tab 与 SegmentSupplement audio tab 内的 `SegmentTranscriptView`
- 全局 root toast surface（Sonner / `ReoToaster`）

### 5.2 用户流程

```text
1. 用户在 Memory Studio 选中某 Memory，定位到目标 Segment 或 SegmentSupplement。
2. 用户 hover/focus 到 Segment card 或 SegmentSupplement tab 的 More button，点开实体 More 菜单。
3. 菜单项「生成转录 / 重新生成转录」按当前 transcript.exists 渲染 label，按 voice settings/recording overlay 状态决定 enable/disable。
4a. transcript.exists=false：点击立即调用扩展后的 manual backfill IPC，mode='fill-missing'；BackfillQueue 入队首；renderer 在 manual running Set 中记录目标，SegmentTranscriptView 渲染 running outcome。
4b. transcript.exists=true：点击打开 WorkspaceDangerConfirmDialog；用户确认后调用 manual backfill IPC，mode='regenerate'；BackfillQueue 入队首；renderer 在 manual running Set 中记录目标，SegmentTranscriptView 渲染 running outcome（保留当前 transcript 文本）。
5. main 端执行 in-flight：读取 finalized audio bytes、ffmpeg remux、调用 Turbo recognize，regenerate 路径在 in-flight 开始时捕获 transcript snapshot digest。
6. recognize 成功：
   - fill-missing：调用现有 saveSegmentTranscript / saveSegmentSupplementTranscript，传 requireTranscriptMissing=true；冲突时返回 TARGET_NOT_ELIGIBLE。
   - regenerate：重新读取当前 transcript 与捕获 digest 比对，命中则使用 main-only overwrite-save 路径写入；不命中则返回 TRANSCRIPT_CHANGED 并保留当前 transcript。
7. response 通过现有 transcript save response merge 路径更新 Workspace snapshot / Memory detail / selected content Query；SegmentTranscriptView 切回 success outcome。
8. 失败 response 通过 workspaceErrorMessages 映射成中文文案，root toast 显示；App 清除 running Set 中的目标。
```

### 5.3 主操作

- 「生成转录」菜单项：fill-missing 路径直接入队。
- 「重新生成转录」菜单项 + 确认按钮：regenerate 路径，二次确认后入队。

### 5.4 辅助操作

- ESC / 点击外部 / 取消按钮关闭 AlertDialog。
- 菜单关闭后无任何状态残留。

### 5.5 危险操作

- 「重新生成转录」是覆盖操作。所有 overwrite 入口必须经过 `WorkspaceDangerConfirmDialog`；确认按钮使用 destructive variant；确认按钮点击不自动关闭 Dialog，由 mutation 成功/失败决定关闭时机（与现有 Segment delete 行为对齐）。

## 6. 页面状态说明

D 的"状态"是菜单 + 弹层 + 任务 + 转录视图组合而成；下面表格按当前 segment/supplement 视角统一描述。

| 状态名称                | 进入条件                                                                                                                   | 页面表现                                                                                        | 用户可操作                                                       | 用户不可操作                           | 系统行为                                                                             | 数据变化                                                                                                                                          | 退出条件                                                            | 异常处理                                                                                                               | 验收标准                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `menu-closed`           | 默认                                                                                                                       | More 按钮在 item hover/focus/menu-open 时可见                                                   | 打开 More                                                        | /                                      | 无后台                                                                               | 无                                                                                                                                                | 用户点 More                                                         | /                                                                                                                      | 菜单 trigger reveal 不变；不引入额外 reveal 状态                                                                                                                                           |
| `menu-open`             | 用户点 More                                                                                                                | 显示菜单项；动态 label 按 `transcript.exists`                                                   | 点击「生成转录 / 重新生成转录」、rename、delete、reveal、copy 等 | 触发本身（disabled 时）                | 无后台                                                                               | 无                                                                                                                                                | ESC、点击外部、菜单项点击                                           | /                                                                                                                      | label 与 `transcript.exists` 一致；voice settings 关闭/未配置/`auth` 失败时 disabled + tooltip；recording overlay open 时 disabled + tooltip；automatic queue 占用不在 renderer 层 disable |
| `confirming-regenerate` | `transcript.exists=true` 且用户点「重新生成转录」                                                                          | `WorkspaceDangerConfirmDialog` 打开                                                             | 确认 / 取消 / ESC                                                | 操作其它 segment 入口（焦点在 Dialog） | 无后台                                                                               | 无                                                                                                                                                | 取消、ESC、确认成功入队、切换 segment 立即关闭并丢弃 confirm intent | confirm 按钮点击但 main 拒绝（如 ALREADY_RUNNING、Voice gate fail）：Dialog 关闭，root toast 显示错误；transcript 不变 | Dialog 文案符合 d-brief；destructive 按钮；confirm 不自动关闭 Dialog；切 segment 立刻关闭                                                                                                  |
| `enqueued`              | menu 点 fill-missing 或 confirming 确认后 mutation pending                                                                 | 菜单项 disabled；该 target 加入 App manual running Set；`SegmentTranscriptView` running outcome | /                                                                | 再次点击同 target 入口                 | main 入队 + 等待出队                                                                 | App component-state Set + Query cache 不变                                                                                                        | 任务出队进入 running，或 mutation 立即失败                          | mutation 立即失败（如 ALREADY_RUNNING）：清除 Set，root toast                                                          | running outcome 与 B 当前一致；同 target 不会被 renderer 二次入队                                                                                                                          |
| `running`               | 任务出队，main in-flight                                                                                                   | `SegmentTranscriptView` 的 running outcome；regenerate 路径继续显示当前 transcript 文本         | /                                                                | /                                      | main: 读音频 → ffmpeg → Turbo → save                                                 | transcript 暂未变化；regenerate 路径捕获 digest                                                                                                   | save 完成（成功或失败）                                             | recognize/save 失败：见失败状态                                                                                        | regenerate running 时不渲染空白；fill-missing running 时 transcript 区域使用 B 已有 running outcome 文案                                                                                   |
| `succeeded`             | recognize 成功且 save 成功（fill-missing：`requireTranscriptMissing` 通过；regenerate：digest 匹配并 overwrite-save 成功） | `SegmentTranscriptView` 切回 success outcome；transcript 文本更新                               | 继续浏览、再次重新生成                                           | /                                      | main: manifest `lastTranscriptionAttempt='success'`，response 携带 Memory summary 等 | `segment.md` / `supplement.md` 正文更新；manifest 更新；Memory detail / Segment content / SegmentSupplement content cache 通过现有 merge 路径更新 | 用户切换或继续                                                      | /                                                                                                                      | success outcome 与 B 当前一致；不显示成功 toast（不属于 d-brief）                                                                                                                          |
| `failed`                | recognize 失败、save 失败、TARGET_NOT_ELIGIBLE、TRANSCRIPT_CHANGED 或 ALREADY_RUNNING                                      | 菜单项可重新点击；root toast 显示错误文案                                                       | 再次点击                                                         | /                                      | 无副作用                                                                             | transcript / manifest 不变                                                                                                                        | 用户再次点击进入 enqueued                                           | /                                                                                                                      | failed 路径不改变 transcript 与 manifest；toast 文案来自 `workspaceErrorMessages` 扩展                                                                                                     |

## 7. 组件与元素说明

| 元素                                              | 用户问题                       | 出现条件                               | 隐藏条件                              | 默认态                        | hover       | active | disabled                                                                                   | loading                                                                                        | 交互结果                                                                                         | 联动关系                                                                                                                                             | 工程注意                                                                                                                          | 验收标准                                                                                           |
| ------------------------------------------------- | ------------------------------ | -------------------------------------- | ------------------------------------- | ----------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Segment card More trigger                         | 进入 Segment 实体 More 菜单    | hover/focus item 或 menu open          | item 失焦                             | sibling control 透明          | reveal      | 高亮   | /                                                                                          | /                                                                                              | 打开 `SegmentActionsMenu`                                                                        | 与 Segment 选择 button 共享 item 容器；不接管选择                                                                                                    | 已存在，不修改 reveal 规则                                                                                                        | More trigger 行为不退化；保持当前 reveal 与 focus 规则                                             |
| SegmentSupplement tab More trigger                | 进入 supplement 实体 More 菜单 | hover/focus tab 或 menu open           | tab 失焦且非 menu open                | sibling control 透明          | reveal      | 高亮   | /                                                                                          | /                                                                                              | 打开 `SegmentSupplementActionsMenu`                                                              | 与 supplement tab button 共享 item 容器；保持现有 hidden tab order 规则                                                                              | 已存在，不修改 reveal 规则                                                                                                        | 行为不退化                                                                                         |
| 「生成转录」菜单项（fill-missing）                | 转录空白时一键补转录           | menu open 且 `transcript.exists=false` | menu close、`transcript.exists=true`  | enabled 灰度 token            | accent 高亮 | /      | voice settings 未启用 / 未配置 X-Api-Key / `lastValidationCode='auth'` / 录音 overlay open | /                                                                                              | 直接调用扩展后的 manual backfill IPC（mode=`fill-missing`）                                      | 通过 `entityActionBindings` 复用 menu callback 注入；与 rename/delete 同层；ghost icon 可用 `RotateCw` lucide icon 或仅文本（按 design system 设计） | label 字串与 i18n 习惯一致；disabled 时 tooltip 引导设置或完成录音；click handler 通过现有 menu callback 形态注入                 | 菜单 label `transcript.exists=false` 时为「生成转录」；disabled tooltip 文案匹配状态原因           |
| 「重新生成转录」菜单项（regenerate）              | 转录非空且需要覆盖             | menu open 且 `transcript.exists=true`  | menu close、`transcript.exists=false` | enabled 灰度 token            | accent 高亮 | /      | 同上                                                                                       | /                                                                                              | 打开 `WorkspaceDangerConfirmDialog`；确认后调用扩展后的 manual backfill IPC（mode=`regenerate`） | 与 fill-missing 共用 menu position；同一 menu callback signature；ghost icon 同上                                                                    | label 字串与 fill-missing 同位置但文案不同；触发覆盖式路径                                                                        | label 与 `transcript.exists=true` 一致；触发 AlertDialog；AlertDialog 关闭后 menu 不残留 highlight |
| `WorkspaceDangerConfirmDialog`（regenerate 文案） | 防止误触覆盖                   | 用户点「重新生成转录」                 | 取消、ESC、点外、确认成功             | shadcn AlertDialog primitives | /           | /      | /                                                                                          | confirm 按钮在 mutation pending 时显示 spinner（沿用现有 destructive variant 的 pending 形态） | 确认入队、取消关闭                                                                               | 与 Memory delete / Segment delete 共用结构；不嵌套重内容卡                                                                                           | title「重新生成转录」、description「这会覆盖现有转录，包括你在外部编辑过的部分。无法撤销。」、confirm「重新生成」、cancel「取消」 | 文案、按钮 variant、关闭策略与现有 danger confirm 一致                                             |
| `SegmentTranscriptView` running outcome           | 表达 backfill 进行中           | App manual running Set 包含当前 target | task settle                           | 现有 running outcome          | /           | /      | /                                                                                          | /                                                                                              | 静态 running 文案                                                                                | 不与 retry 按钮共存；retry 按钮仅在 failed-retryable outcome 出现                                                                                    | regenerate 期间仍渲染当前 transcript 文本，叠加 running 文案（按假设 3 决定是否引入 `running-overwrite` outcome）                 | running 文案与 B 一致；切回 success outcome 后 transcript 文本反映新结果                           |
| root toast                                        | 表达成功/失败/限流等           | mutation settle 失败                   | toast 自动消失                        | 现有 `ReoToaster`             | /           | /      | /                                                                                          | /                                                                                              | 文案点击不携带操作（D 不需要恢复 action）                                                        | 与 C 当前 backfill 失败 toast 同源                                                                                                                   | 新增 `ERR_BACKFILL_TRANSCRIPT_CHANGED` 映射                                                                                       | 失败文案中文化、不暴露 secret、覆盖所有 D 触发可能命中的错误码                                     |

## 8. 交互规则

### 8.1 主操作规则

- fill-missing 路径：菜单点击立即进入 `enqueued`；同 target 在 App manual running Set 中存在时不重复发起，root toast 提示「该录音正在生成中」；main 返回 `ERR_BACKFILL_ALREADY_RUNNING` 时同样使用该文案；automatic queue 占用 → main 返回 ALREADY_RUNNING → 同样 toast。
- regenerate 路径：菜单点击打开 AlertDialog；确认按钮点击发起 mutation；mutation pending 期间 confirm 按钮使用现有 destructive pending 视觉；mutation 成功入队（或入队失败）后再关闭 Dialog；切换 segment 立即关闭 Dialog 并丢弃 confirm intent。

### 8.2 辅助操作规则

- 菜单关闭：ESC、点击菜单外部、点击其它菜单项；菜单关闭后不留运行态。
- AlertDialog 关闭：cancel 按钮、ESC、点击 overlay、mutation 成功入队后关闭；不允许 confirm 按钮触发自动关闭（与 Memory/Segment delete 危险确认一致）。

### 8.3 危险操作规则

- 覆盖式重新生成必须经过 `WorkspaceDangerConfirmDialog`；确认按钮 destructive variant；不嵌套重内容卡；文案明确告诉用户"覆盖"，并明确"包括外部编辑"。
- main 端 `regenerate` 在写入前必须重新读取 transcript 并比对 digest；不一致直接 typed error，不改写当前 transcript。
- fill-missing 路径不进入 AlertDialog；任何 transcript 已存在的状态下 fill-missing 在 main 都会被 `requireTranscriptMissing` 阻塞为 `ERR_BACKFILL_TARGET_NOT_ELIGIBLE`。
- 自动 scanner / automatic batch 不允许 `regenerate` 入队（runtime 端强制：scanner 只入队 fill-missing 等价目标）。

### 8.4 提示与确认规则

- 仅 regenerate 路径需要 AlertDialog。
- voice settings disabled / unconfigured / `auth` 失败：菜单项 disabled + tooltip「先在设置里启用并填写 X-Api-Key」（沿用现有 Sidebar 设置入口红点文案风格）。
- 录音 overlay open：菜单项 disabled + tooltip「先完成或关闭录音」。
- 同 target running：菜单项 disabled + tooltip「正在生成中」；renderer 端用 App manual running Set 推导。
- automatic queue 已占用同 target：renderer 不预先 disable；main 端拒绝并 root toast 提示。

### 8.5 防重复操作规则

- App manual running Set 是 renderer 端唯一 dedup gate：同 target 处于 Set 中 → 菜单项 disabled。
- 离开 Set 之前 mutation pending；mutation settle 后必须清除。
- 切换 workspace 或关闭当前 workspace session 时清除 Set 中所有 entry（沿用 C 现有 workspace-scoped target 清理路径）。
- main 端 BackfillQueue dedup 是后备保护：renderer 旁路或多窗口竞态下也不会重复入队。

### 8.6 未保存内容保护规则

- D 没有用户输入 form；不存在草稿。
- AlertDialog 取消不需要确认。
- AlertDialog 期间用户切换 segment：立即关闭 Dialog，丢弃 confirm intent；不弹"放弃确认"二次提示。

## 9. 状态机

| 当前状态              | 目标状态                                                                                       | 触发条件                                            | 用户动作            | 系统行为                                                                                                                                                   | 界面变化                                                                                                          | 数据变化                                                                                                    | 接口调用                                                                                                                               | 权限判断                                                                    | 异常处理                                                                                      | 回滚规则                         | 验收标准                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| menu-closed           | menu-open                                                                                      | 点 More                                             | 点击                | 渲染菜单                                                                                                                                                   | More menu 打开                                                                                                    | 无                                                                                                          | 无                                                                                                                                     | 无                                                                          | /                                                                                             | /                                | menu 行为不退化                                                                                                    |
| menu-open             | menu-closed                                                                                    | ESC / 点击外部                                      | /                   | 关闭菜单                                                                                                                                                   | menu 收起                                                                                                         | 无                                                                                                          | 无                                                                                                                                     | 无                                                                          | /                                                                                             | /                                | /                                                                                                                  |
| menu-open             | enqueued（fill-missing）                                                                       | `transcript.exists=false` & 点击「生成转录」        | 点击                | 通过 `workspaceApi` 调用扩展后的 backfill IPC，mode=`fill-missing`                                                                                         | 菜单关闭；目标加入 App manual Set；`SegmentTranscriptView` 切到 running                                           | App component-state Set 更新                                                                                | `workspace:requestSegmentTranscriptionBackfill` / `workspace:requestSegmentSupplementTranscriptionBackfill` with `mode='fill-missing'` | settings/recording overlay gate（renderer 已通过 disabled 阻断；main 复检） | 入队失败：clear running Set + root toast                                                      | 失败时不写 transcript / manifest | 入队失败时 running 状态被清除                                                                                      |
| menu-open             | confirming-regenerate                                                                          | `transcript.exists=true` & 点击「重新生成转录」     | 点击                | 打开 AlertDialog；不发起 mutation                                                                                                                          | menu 关闭；Dialog 打开                                                                                            | 无                                                                                                          | 无                                                                                                                                     | 同上                                                                        | /                                                                                             | /                                | Dialog 打开后用户必须显式确认或取消                                                                                |
| confirming-regenerate | menu-closed                                                                                    | cancel / ESC / 点 overlay / 切换 segment            | 点击 / 操作其它入口 | 关闭 Dialog；不发起 mutation                                                                                                                               | Dialog 关闭                                                                                                       | 无                                                                                                          | 无                                                                                                                                     | /                                                                           | /                                                                                             | /                                | confirm intent 丢弃                                                                                                |
| confirming-regenerate | enqueued（regenerate）                                                                         | 确认按钮 + mutation 成功入队                        | 点击确认            | 调用扩展后的 backfill IPC，mode=`regenerate`；mutation pending 时 confirm 按钮 spinner                                                                     | Dialog 在入队成功后关闭；目标加入 App manual Set；`SegmentTranscriptView` 切到 running（继续渲染当前 transcript） | App component-state Set 更新                                                                                | `workspace:requestSegmentTranscriptionBackfill` / `workspace:requestSegmentSupplementTranscriptionBackfill` with `mode='regenerate'`   | 同上                                                                        | 入队失败（如 ALREADY_RUNNING、voice gate failed）：Dialog 关闭；clear running Set；root toast | 失败时不写 transcript / manifest | confirm 按钮点击不自动关闭 Dialog；入队成功后才关闭；失败 toast 文案匹配错误码                                     |
| enqueued              | running                                                                                        | 任务出队                                            | /                   | main: 读取 finalized audio bytes → ffmpeg remux → Turbo recognize；regenerate 路径在 in-flight 开始时捕获 transcript digest（基于当前 `transcript.text`）  | running outcome 持续                                                                                              | 无 durable 变化；main 内存中保留 digest                                                                     | 内部调用，无 IPC                                                                                                                       | 无                                                                          | /                                                                                             | /                                | regenerate digest 捕获在 task in-flight 内完成；不阻塞 fill-missing 路径                                           |
| running               | succeeded（fill-missing）                                                                      | recognize ok & `requireTranscriptMissing` save 成功 | /                   | 复用 C `saveSegmentTranscript` / `saveSegmentSupplementTranscript` 路径；manifest `lastTranscriptionAttempt='success'`                                     | running → success outcome；transcript 文本更新                                                                    | `segment.md` / `supplement.md` 正文 + manifest 更新；Memory detail / content Query 通过 response merge 更新 | response 通过现有 merge 入 cache                                                                                                       | 无                                                                          | /                                                                                             | /                                | transcript 与 manifest 与 B/C success 路径一致                                                                     |
| running               | succeeded（regenerate）                                                                        | recognize ok & digest 匹配 & overwrite-save 成功    | /                   | main: 重新读取 transcript & digest 比对；命中 → main-only overwrite 保存（不传 `requireTranscriptMissing`）；manifest `lastTranscriptionAttempt='success'` | 同上                                                                                                              | 同上                                                                                                        | 同上                                                                                                                                   | /                                                                           | /                                                                                             | /                                | overwrite save 路径与 fill-missing save response shape 一致；renderer 不需要区分                                   |
| running               | failed（recognize / network / auth / rate-limit / transcode / size / format / empty / silent） | C 已有错误码                                        | /                   | 不写 transcript；不改 manifest；返回 typed error                                                                                                           | running 切回 failed-retryable outcome（或 empty-never，按 transcript/lastAttempt 派生）；root toast               | 无 durable 变化                                                                                             | /                                                                                                                                      | /                                                                           | clear App manual Set                                                                          | /                                | 错误码、文案与 C 一致；transcript 不被破坏                                                                         |
| running               | failed（TARGET_NOT_ELIGIBLE，仅 fill-missing）                                                 | save 时 transcript 已存在                           | /                   | 不写 transcript；不改 manifest；返回 `ERR_BACKFILL_TARGET_NOT_ELIGIBLE`                                                                                    | running 切回派生 outcome；root toast                                                                              | 无 durable 变化                                                                                             | /                                                                                                                                      | /                                                                           | clear Set                                                                                     | /                                | fill-missing 在 transcript 已存在时被 main 阻止；renderer 提示用户「该转录已生成；如需覆盖请使用『重新生成转录』」 |
| running               | failed（TRANSCRIPT_CHANGED，仅 regenerate）                                                    | 任务执行期间 transcript 被外部改动（digest 不匹配） | /                   | 不写 transcript；不改 manifest；返回新错误码 `ERR_BACKFILL_TRANSCRIPT_CHANGED`                                                                             | running 切回派生 outcome；root toast                                                                              | 无 durable 变化                                                                                             | /                                                                                                                                      | /                                                                           | clear Set                                                                                     | /                                | TRANSCRIPT_CHANGED 文案中文化；不暴露 digest；不改写 transcript；用户可再次点击                                    |
| running               | failed（ALREADY_RUNNING / UNAVAILABLE / lock-lost / workspace-switch）                         | C 已有错误码或运行期 cancel                         | /                   | 不写 transcript；不改 manifest                                                                                                                             | running 切回派生 outcome；root toast                                                                              | 无 durable 变化                                                                                             | /                                                                                                                                      | /                                                                           | clear Set；workspace-scoped 清理                                                              | /                                | 行为与 C 一致                                                                                                      |
| failed                | menu-open                                                                                      | 用户重新点 More                                     | 点击                | /                                                                                                                                                          | menu 打开                                                                                                         | 无                                                                                                          | 无                                                                                                                                     | 同上                                                                        | /                                                                                             | /                                | 用户可再次重试                                                                                                     |

## 10. 数据规则

D 不引入 durable schema；以下字段全部当前已存在或属于 main-process-only 临时数据。

| 字段                                          | 类型                                                                    | 来源                                                                                      | 默认值                  | 是否必填                             | 是否可编辑            | 校验规则                    | 存储位置                                                                                                                       | 同步规则                                                                                              | 异常处理                                                                                         | 验收标准                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------ | --------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `mode`                                        | `'fill-missing' \| 'regenerate'`                                        | renderer 显式发送                                                                         | 无                      | 是                                   | 否                    | Zod 严格枚举                | IPC request payload（仅 in-flight）                                                                                            | /                                                                                                     | 缺失或非法 → main 拒绝并返回 `ERR_WORKSPACE_BAD_PAYLOAD` 系列（沿用现有 invalid request 错误码） | contract test 覆盖：缺 mode、非法 mode、合法 mode                              |
| transcript snapshot digest                    | sha256 hex string                                                       | main 端读取当前 `segment.md` / `supplement.md` 的 `## Transcript` 文本计算                | 无                      | regenerate 必填；fill-missing 不使用 | 否                    | 内部使用，不暴露            | main process 任务内存；任务结束清理                                                                                            | /                                                                                                     | save 前重新计算并比对；不一致 → `ERR_BACKFILL_TRANSCRIPT_CHANGED`                                | digest 不进入 IPC response、诊断、日志或文件                                   |
| App manual running Set entry                  | `{ workspaceHandle, workspaceId, memoryId, segmentId, (supplementId) }` | renderer 用户点击产生                                                                     | 空                      | /                                    | /                     | 通过 React 组件 state 管理  | App component state                                                                                                            | mutation settle 时清除；workspace 切换/关闭时清空                                                     | mutation 失败 → 清除                                                                             | 重复点击同 target 不二次入队                                                   |
| `lastTranscriptionAttempt`                    | `'success' \| 'failed' \| 'never'`                                      | `.reo/objects/segments/<segmentId>.json` / `.reo/objects/supplements/<supplementId>.json` | `'never'`（缺失时投影） | 是                                   | 否                    | 由现有 manifest schema 校验 | durable manifest                                                                                                               | save 成功后 main 在 ownership 复核通过后写为 `'success'`；失败保持原值                                | save 失败 → 不修改                                                                               | manifest 字段未扩展；与 B/C 一致                                               |
| transcript 正文                               | UTF-8 text                                                              | recognize result                                                                          | 空                      | 是（保存时）                         | 由用户/agent 外部编辑 | finalized Markdown body     | `memories/.../segments/.../segment.md` 与 `memories/.../segments/.../supplements/.../supplement.md` 的 `## Transcript` section | save 成功后通过 response merge 进入 Memory detail / Segment content / SegmentSupplement content cache | save 失败时保留旧文本                                                                            | regenerate 成功后 transcript 文本更新；fill-missing 成功后 transcript 文本写入 |
| `ERR_BACKFILL_TRANSCRIPT_CHANGED`（新错误码） | `WorkspaceErrorEnvelope.error.code`                                     | main 端                                                                                   | /                       | 是                                   | 否                    | Zod enum 必须覆盖           | IPC response                                                                                                                   | renderer 通过 `workspaceErrorMessages` 映射成中文 toast                                               | /                                                                                                | error code allowlist + 文案完整                                                |

## 11. 权限规则

Reo 当前没有 Better Auth；BYOK X-Api-Key 是唯一凭证；权限判断走 voice settings + recording lifecycle。

| 权限场景                       | 角色或条件                                         | 可见规则                 | 可操作规则      | 接口规则                                                                           | 页面反馈                                      | 日志规则     | 验收标准                                      |
| ------------------------------ | -------------------------------------------------- | ------------------------ | --------------- | ---------------------------------------------------------------------------------- | --------------------------------------------- | ------------ | --------------------------------------------- |
| voice settings disabled        | `enabled=false`                                    | 菜单项可见               | 菜单项 disabled | renderer 不发起 mutation；如发起 → main 端 voice gate 拒绝                         | tooltip「先在设置里启用并填写 X-Api-Key」     | 不写敏感字段 | disabled 状态稳定；tooltip 文案一致           |
| X-Api-Key 未配置               | `apiKeyConfigured=false`                           | 同上                     | 同上            | 同上                                                                               | 同上                                          | /            | 同上                                          |
| Validation 状态 `auth`         | `lastValidationCode='auth'`                        | 同上                     | 同上            | 同上                                                                               | tooltip「先在设置里重新保存或验证 X-Api-Key」 | /            | 同上                                          |
| Validation 状态 `network`      | `lastValidationCode='network'` 且其它 gate 通过    | 菜单项可见               | 菜单项可点击    | mutation 可能命中 `ERR_BACKFILL_AUTH_FAILED`、`ERR_BACKFILL_RATE_LIMITED` 或网络错 | 失败 root toast                               | /            | 不预先 disable；用户可主动重试                |
| 录音 overlay open              | `recordingFlowOpen=true`                           | 菜单项可见               | 菜单项 disabled | renderer 不发起 mutation                                                           | tooltip「先完成或关闭录音」                   | /            | 与 RecordingOverlay 现有跨流程 block 行为一致 |
| segment 当前 manual 运行中     | App Set 包含 target                                | 菜单项可见               | 菜单项 disabled | /                                                                                  | tooltip「正在生成中」                         | /            | dedup 不重复发起                              |
| 同 target 已在 automatic queue | renderer 不知                                      | 菜单项可见               | 菜单项可点击    | main 端 BackfillQueue dedup 返回 `ERR_BACKFILL_ALREADY_RUNNING`                    | root toast「该录音正在生成中」                | /            | renderer 不预先 disable；root toast 提示      |
| supplement 已删除 (trash)      | 当前 selected Segment projection 没有该 supplement | tab 不渲染 → menu 不存在 | /               | /                                                                                  | /                                             | /            | 已存在的行为不退化                            |

## 12. 工程实现说明

### 12.1 React 组件拆分

- 不创建新组件；仅在以下 feature-local 文件中扩展：
  - `src/renderer/src/workspace/SegmentActionsMenu.tsx`
  - `src/renderer/src/workspace/SegmentSupplementActionsMenu.tsx`
  - `src/renderer/src/workspace/entityActionBindings.ts`
  - `src/renderer/src/workspace/MemoryStudio.tsx`（接 menu callback → 调用 `workspaceApi`）
  - `src/renderer/src/App.tsx`（manual running Set 已存在，需要按 mode 区分 enqueue 入口）
  - `src/renderer/src/workspace/SegmentTranscriptView.tsx`（按假设 3 决定是否扩展 `running-overwrite` outcome）
  - `src/renderer/src/workspace/WorkspaceDangerConfirmDialog.tsx`（仅消费，不修改 primitive）
  - `src/renderer/src/workspace/workspaceErrorMessages.ts`（新增 `ERR_BACKFILL_TRANSCRIPT_CHANGED` 映射）

### 12.2 TypeScript 类型定义

- Contract 端在 `src/workspace-contract/workspace-contract.ts` 扩展：
  - `workspaceRequestSegmentTranscriptionBackfillRequestSchema` 增加 `mode: z.enum(['fill-missing', 'regenerate'])`
  - `workspaceRequestSegmentSupplementTranscriptionBackfillRequestSchema` 同上
  - `workspaceErrorCodeSchema` 增加 `'ERR_BACKFILL_TRANSCRIPT_CHANGED'`
  - 派生类型自动跟随
- `entityActionBindings` 的 menu callback signature 需要在保留现有 typed action shape 前提下，接入「generate-transcript」/「regenerate-transcript」两种 intent；不引入 `any` 或 `unknown` 直通。
- App manual running Set 类型保留现有 dual-set 结构（Segment / SegmentSupplement）。

### 12.3 Zustand 状态

- D 不引入任何 Zustand store。

### 12.4 TanStack Query 数据请求

- D 不新增 Query key。
- 复用现有 Query：`['workspace', 'snapshot', workspaceId]`、`['workspace', 'memory-detail', workspaceId, memoryId]`、`['workspace', 'segment-content', workspaceId, memoryId, segmentId]`、`['workspace', 'segment-supplement-content', workspaceId, memoryId, segmentId, supplementId]`、`['settings', 'voice']`。
- mutation 成功 response 通过现有 transcript save response merge 路径更新 cache；不新增 invalidation 路径。
- voice settings gate 读取 `['settings', 'voice']` 派生 disabled / tooltip。

### 12.5 React Hook Form 与 Zod 表单规则

- D 不使用 form；只在 IPC 边界使用 Zod schema（contract 端）。

### 12.6 shadcn/ui 与 Radix primitives 组件规则

- 菜单项使用现有 `DropdownMenuItem` primitives；icon 与 `重命名 / 删除` 视觉密度一致。
- AlertDialog 通过 `WorkspaceDangerConfirmDialog` 包裹（已存在）；按 Memory delete / Segment delete 一致的危险确认结构。
- confirm 按钮在 mutation pending 时使用现有 destructive variant pending 视觉。

### 12.7 Tailwind CSS v4 样式规则

- 菜单项不引入新 token；沿用 `bg-accent`、`text-accent-foreground` 等现有 token。
- AlertDialog 不引入新颜色；沿用 destructive token。

### 12.8 Better Auth 权限与登录态

- 当前没有 Better Auth；D 不引入。
- 凭证由 voice settings X-Api-Key 表达；权限判断走 voice settings snapshot 与 recording lifecycle。

### 12.9 Drizzle ORM 与 better-sqlite3 本地数据

- 当前没有 Drizzle / SQLite；D 不引入。
- durable 真源是 `segment.md` / `supplement.md` 正文 + `.reo/objects/*` manifest，由 main process 持锁写入。

### 12.10 Electron 主进程、preload 与 IPC

- 主进程：
  - `src/main/backfillRuntime.ts`：
    - `requestSegmentBackfill` / `requestSupplementBackfill` 新增 `mode` 参数；按 mode 派发 `fill-missing`（`requireTranscriptMissing: true`）或 `regenerate`（snapshot digest 捕获 + overwrite save）。
    - 新增 main-only `saveSegmentTranscript` / `saveSupplementTranscript` overwrite 路径（或在现有 helper 中加 `allowOverwrite: true` 旗标），写入前在 ownership 复核后比对 digest，不命中即返回 `ERR_BACKFILL_TRANSCRIPT_CHANGED`。
    - automatic scanner / `enqueueAutomaticWorkspace` / `enqueueAutomaticTargets` 内部 mode 固定 `fill-missing`，不接受 regenerate。
  - `src/main/backfillQueue.ts`：`BackfillQueueTask` 增加 internal `mode` 字段（不进入 IPC response）；dedup key 不引入 mode（同 target 任意 mode 都 dedup）；breaker / batch cap 行为不变。
  - `src/main/recordingDrafts.ts` 或保存 helper：暴露 `allowOverwrite` 旗标，跳过 `requireTranscriptMissing` 检查；ownership / lock / digest 复核保持。
  - `src/main/backfillDiagnostics.ts`：诊断字段 allowlist 增加 `mode: 'fill-missing' | 'regenerate'`；不增加 transcript / digest / raw path / key 字段。
  - `src/main/workspaceIpc.ts`：handler 接收 mode 后转交 runtime；保持 Zod 校验、sender 校验、handle 校验、lock 复核。
- Preload：
  - `src/preload/workspaceBridge.ts`：bridge method signature 增加 mode；保持窄方法 + 类型 contract。
- Renderer：
  - `src/renderer/src/workspace/workspaceApi.ts`：wrapper 增加 mode 参数；与 contract 类型对齐。

### 12.11 Sentry 与 electron-log

- 当前没有 Sentry；D 不引入。
- 诊断走现有 `electron-log/main` + `recordDiagnosticEvent`；allowlist 增加 `mode` 字段，其它字段保持。

### 12.12 Vitest 测试建议

- 见 `tasks.md` TDD 章节与 `verification.md`。
- main 测试覆盖 mode 校验、`fill-missing` 回归、`regenerate` digest 捕获、TRANSCRIPT_CHANGED、automatic scanner 不接受 regenerate、queue dedup 不区分 mode、diagnostics allowlist 不漏 mode。
- renderer 测试覆盖菜单 label 动态、disabled tooltip、AlertDialog 仅在 overwrite 路径触发、mutation 成功复用 cache merge、ALREADY_RUNNING / TRANSCRIPT_CHANGED 错误 toast、recording overlay 阻塞、segment 切换关闭 Dialog。

## 13. 接口、本地数据与同步

### 13.1 接口调用

| 接口                                                                     | 调用时机                                  | 请求参数                                                                    | 响应字段                                                                                                  | 成功处理                                                                                                           | 失败处理                                                                                    | 缓存规则                                          | 权限要求                            | 验收标准                                        |
| ------------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------- | ----------------------------------------------- |
| `workspace:requestSegmentTranscriptionBackfill`（扩展）                  | 用户点 fill-missing 或 confirm regenerate | `{ workspaceHandle, workspaceId, memoryId, segmentId, mode }`               | 成功：`{ ok: true, value: { memory, saved: true } }`；失败：`WorkspaceErrorEnvelope`                      | renderer 用现有 transcript save response merge 路径合并 Memory summary、Memory detail cache、Segment content cache | renderer 根据 error code 调用 `workspaceErrorMessages` 文案显示 root toast；清除 manual Set | 不新增 Query key；mutation success 复用现有 merge | sender、handle、lock、settings gate | contract test + main test + renderer test       |
| `workspace:requestSegmentSupplementTranscriptionBackfill`（扩展）        | 用户点 fill-missing 或 confirm regenerate | `{ workspaceHandle, workspaceId, memoryId, segmentId, supplementId, mode }` | 成功：`{ ok: true, value: { memory, segment, supplement, saved: true } }`；失败：`WorkspaceErrorEnvelope` | 同上 + supplement projection 更新 SegmentSupplement content cache                                                  | 同上                                                                                        | 同上                                              | 同上                                | contract test + main test + renderer test       |
| `workspace:saveTranscript` / `workspace:saveSegmentSupplementTranscript` | 不直接被 D 调用                           | /                                                                           | /                                                                                                         | renderer 不调用；main 端 backfill runtime 内部调用                                                                 | /                                                                                           | /                                                 | /                                   | renderer 不持有 wrapper 直接发起 ASR 伪造的能力 |

### 13.2 本地数据库

- 不涉及。Reo 当前没有 SQLite。

### 13.3 数据同步

- transcript 文本 durable 真源是 `segment.md` / `supplement.md` 正文。
- manifest `lastTranscriptionAttempt` durable 真源是 `.reo/objects/*` JSON。
- TanStack Query cache 通过 mutation success response merge 更新（与 C 一致）。
- 自动 snapshot refresh（`workspace:readWorkspaceSnapshot`）仍按现有规则运行；D 不改变 refresh 节奏。

## 14. 异常与边界情况

| 边界场景                                                       | 触发条件                      | 处理规则                               | 界面反馈                        | 建议提示文案                                   | 数据保护规则                                                                        | 可恢复规则                               | 验收标准                                      |
| -------------------------------------------------------------- | ----------------------------- | -------------------------------------- | ------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------- |
| voice settings disabled                                        | `enabled=false`               | renderer disable 菜单项；main 复检拒绝 | 菜单项 disabled + tooltip       | 「先在设置里启用并填写 X-Api-Key」             | 不发起 mutation                                                                     | 用户去 Settings 启用                     | renderer / main 一致拒绝                      |
| X-Api-Key 未配置                                               | `apiKeyConfigured=false`      | 同上                                   | 同上                            | 同上                                           | 同上                                                                                | 同上                                     | 同上                                          |
| `lastValidationCode='auth'`                                    | settings snapshot             | renderer disable                       | 菜单项 disabled + tooltip       | 「先在设置里重新保存或验证 X-Api-Key」         | 不发起 mutation                                                                     | 用户去 Settings                          | 同上                                          |
| `lastValidationCode='network'`                                 | settings snapshot             | renderer 不预先 disable                | 菜单项可点击                    | /                                              | mutation 可能命中 `ERR_BACKFILL_AUTH_FAILED` / `ERR_BACKFILL_RATE_LIMITED` / 网络错 | 用户重试                                 | 不阻断；允许重试                              |
| confirming 期间切 segment                                      | renderer state                | Dialog 立即关闭，丢弃 confirm intent   | Dialog 关闭                     | /                                              | /                                                                                   | 用户在新 segment 上重新打开              | 切 segment 不残留 confirming 状态             |
| 同 target 已在 manual Set                                      | App component state           | renderer disable                       | tooltip「正在生成中」           | /                                              | /                                                                                   | 等待 settle                              | 不二次入队                                    |
| 同 target 已在 automatic queue                                 | main BackfillQueue 已有       | renderer 不预先 disable；main 拒绝     | root toast 「该录音正在生成中」 | /                                              | /                                                                                   | 等待 automatic 任务完成                  | renderer 不订阅 automatic 状态                |
| recording overlay open                                         | App `recordingFlowOpen=true`  | renderer disable                       | tooltip「先完成或关闭录音」     | /                                              | /                                                                                   | 用户完成或关闭录音                       | 与 RecordingOverlay 现有跨流程 block 行为一致 |
| regenerate 期间 transcript 被外部编辑                          | digest 不匹配                 | main 拒绝 overwrite                    | root toast                      | 「转录在重新生成期间已被改动；当前转录已保留」 | transcript / manifest 不变                                                          | 用户重试                                 | TRANSCRIPT_CHANGED 文案不暴露 digest          |
| fill-missing 期间 transcript 已存在                            | save 时 transcript 非空       | main 拒绝（C 已有路径）                | root toast                      | 「转录已生成；如需覆盖请使用『重新生成转录』」 | transcript / manifest 不变                                                          | 用户改用 regenerate                      | TARGET_NOT_ELIGIBLE 文案需要更新以引导覆盖    |
| ALREADY_RUNNING                                                | main BackfillQueue dedup      | renderer 接收并 toast                  | root toast                      | 「该录音正在生成中」                           | /                                                                                   | 等待运行结束                             | 与 C 一致                                     |
| UNAVAILABLE                                                    | manual 任务总数超过 20        | main 拒绝                              | root toast                      | 「同时进行的补转录任务过多，请稍后再试」       | /                                                                                   | 等待其它任务结束                         | 与 C 一致                                     |
| lock-lost / workspace-switch / app-quit                        | runtime cancelAll             | main 拒绝或取消                        | root toast                      | 「记忆空间已切换或关闭」                       | /                                                                                   | 用户切回                                 | 与 C 一致                                     |
| 任务 saveTranscript `dataRetention='previous-file-preserved'`  | save IO 失败                  | main 返回；transcript/manifest 不变    | root toast                      | 「保存转录失败」                               | transcript 不变                                                                     | 用户重试                                 | 与 C 一致                                     |
| 任务 saveTranscript `dataRetention='file-written-index-stale'` | 文件写入成功但 index 刷新失败 | main 返回 stale；manifest 已是 success | root toast；UI 已是 success     | 「转录已生成，但索引未同步」                   | 文件已更新                                                                          | 用户继续浏览；下次 snapshot refresh 协调 | 与 C 一致                                     |
| 主进程 ASR 网络错 / 限流 / 5XX                                 | Turbo error                   | main 返回 typed error                  | root toast                      | 沿用 C 文案                                    | /                                                                                   | 用户重试                                 | 与 C 一致                                     |
| segment / supplement 已被 trash                                | Workspace projection 缺失     | menu 不存在                            | /                               | /                                              | /                                                                                   | /                                        | 现有行为不退化                                |

## 15. 测试与验收标准

详细命令与场景在 `verification.md`。本节只列覆盖维度。

| 维度         | 内容                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 正常路径     | fill-missing 成功；regenerate 成功；菜单 label 动态切换；AlertDialog 仅在 regenerate 出现                                                                          |
| 边界路径     | TARGET_NOT_ELIGIBLE（fill-missing 时 transcript 已存在）；TRANSCRIPT_CHANGED（regenerate 期间外部编辑）；ALREADY_RUNNING；UNAVAILABLE；lock-lost；workspace-switch |
| 权限路径     | voice settings disabled / unconfigured / `auth`；`network` 可点击；recording overlay open                                                                          |
| 数据路径     | transcript 文本与 manifest 一致；automatic scanner 不接受 regenerate；queue dedup 不区分 mode                                                                      |
| 状态流转     | confirming → enqueued → running → succeeded/failed；切 segment 关闭 Dialog；recovery 不残留 confirm intent                                                         |
| 可恢复       | 任何失败都保留原 transcript / manifest                                                                                                                             |
| 日志记录     | 诊断 allowlist 仅扩展 mode；不泄漏 transcript / digest / raw path / key                                                                                            |
| 用户可见反馈 | tooltip + root toast 文案中文化；不暴露 digest 或 secret                                                                                                           |

## 16. 最终目标总结

本次任务需要交付一个面向"已配置豆包语音 X-Api-Key 的 Reo 本地用户"的"手动重新生成转录"能力，让用户能够在 Memory Studio 中通过 Segment card 与 SegmentSupplement tab 的实体 More 菜单，对当前录音或补充录音显式触发"生成转录"（当转录为空时）或"重新生成转录"（当转录已存在时，使用 `WorkspaceDangerConfirmDialog` 二次确认）。产品体验上要保证入口稳定挂载在实体 More 菜单内、菜单 label 与 `transcript.exists` 实时一致、仅覆盖路径要求二次确认、运行中复用 B 的 `SegmentTranscriptView` running outcome、失败时 transcript 与 manifest 保持本次任务前的原值并通过 root toast 提示用户。功能实现上需要覆盖 `menu-closed / menu-open / confirming-regenerate / enqueued / running / succeeded / failed` 七个状态、支持「生成转录 / 重新生成转录」两条互斥菜单入口与一个覆盖式 AlertDialog 二次确认，并基于 React 19、TypeScript、Tailwind CSS v4、shadcn/ui、Radix primitives、TanStack Query 与 Electron 当前架构完成实现。工程上需要在 `workspace:requestSegmentTranscriptionBackfill` 与 `workspace:requestSegmentSupplementTranscriptionBackfill` 两个现有 channel 上扩展显式 `mode: 'fill-missing' | 'regenerate'` 字段；`fill-missing` 路径继续走 C 当前 `requireTranscriptMissing: true` 保存路径，`regenerate` 路径在 main 端任务进入 in-flight 时捕获 transcript snapshot digest，写入前重新读取并比对，digest 不一致直接返回新增的 `ERR_BACKFILL_TRANSCRIPT_CHANGED` 错误码，不改写当前 transcript 与 manifest；automatic scanner 与 automatic batch 永远只入队等价 `fill-missing` 目标，自动路径不接受 `regenerate`；BackfillQueue / Turbo client / ffmpeg remux / 诊断 allowlist / 安全边界全部复用 C 当前能力，不新增 main-to-renderer event channel、TanStack Query key、Zustand store、durable manifest 字段或第二条队列；renderer 不直接调用 `workspace:saveTranscript` 或 `workspace:saveSegmentSupplementTranscript` 来伪造 ASR 结果；renderer 不接触 raw path、audio bytes、base64、ffmpeg path 或 X-Api-Key；本 spec 不放松 Electron sandbox、contextIsolation、nodeIntegration、CSP、permission 或 navigation 边界。权限上需要把 voice settings `enabled=false / apiKeyConfigured=false / lastValidationCode='auth'` 与"recording overlay open"映射为菜单项 disabled + tooltip，把"自动队列已占用同 target"留给 main 端通过 `ERR_BACKFILL_ALREADY_RUNNING` 拒绝并 root toast。数据上需要保证 transcript 文件正文、`.reo/objects/*` manifest `lastTranscriptionAttempt`、Memory detail / Segment content / SegmentSupplement content TanStack Query cache 与 App manual running Set 的同步规则清晰：mutation 成功通过现有 transcript save response merge 路径协调 cache，App manual running Set 在 mutation pending 期间持有目标、settle 后清除、workspace 切换/关闭时清空。异常上需要覆盖 voice settings gate 失败、`auth` / `network` validation 状态、ALREADY_RUNNING、UNAVAILABLE、TARGET_NOT_ELIGIBLE（fill-missing 命中已有 transcript）、TRANSCRIPT_CHANGED（regenerate 期间外部编辑）、Turbo network / auth / rate-limit / 5XX / timeout / 空音频 / 静音 / 格式错 / 超大、lock-lost、workspace-switch、app-quit、`saveTranscript` 的 `previous-file-preserved` 与 `file-written-index-stale` 数据保留语义。最终验收需要同时验证 contract Zod 严格性、main 端 fill-missing 回归、regenerate snapshot guard 与 TRANSCRIPT_CHANGED 行为、automatic scanner 永远只入队 fill-missing、queue dedup 不区分 mode、诊断 allowlist 不漏 mode、renderer 菜单 label 动态、AlertDialog 仅在 overwrite 路径触发、ALREADY_RUNNING / TRANSCRIPT_CHANGED toast 文案、recording overlay 与 voice settings gate 行为、`npm run verify:quick` 全绿、`npm run format:check` 全绿、`git diff --check` 全绿、真实 Electron runtime 通过 `REMOTE_DEBUGGING_PORT=9233 npm run dev` 覆盖 fill-missing / regenerate / 外部编辑保护 / settings gate / recording gate 五条核心场景，并在最终归档前同批更新 `docs/current/electron.md`、`docs/current/data.md`、`docs/current/flow.md`、`docs/current/frontend.md`、`docs/current/quality.md`，把 D 的稳定结论压缩进 current 真源。

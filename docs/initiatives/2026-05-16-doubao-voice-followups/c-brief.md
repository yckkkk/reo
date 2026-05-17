# C：自动补转录（已归档参考 brief）

> 本文是 C 的"准 spec"：按工程师可直接消费的标准撰写，但**不是** active spec。
> 进入 `docs/specs/` 前必须满足：B 已归档、B 真机 E2E gate 已通过，且 plan.md 的 B→C readiness gate 已完成。
> C spec 已归档：`docs/archive/specs/2026-05-17-0029-doubao-voice-auto-backfill/`。C 执行结果以归档 spec、current docs 和 ADR 0005 为准；本文只保留候选问题模型，不作为实施清单。

- 时间：2026-05-17 00:14 America/Los_Angeles
- 依赖：B 的 `lastTranscriptionAttempt` manifest 字段
- 共同约束：见 `plan.md`

## 当前入口

- B 已归档并通过 `npm run dev` 真机 E2E gate。
- 本文只提供 C 的候选问题模型、状态模型和工程切分；C 归档 spec 已完成重新判断。
- 本文中的文件名、组件名和队列拆分不是实施权威；active spec 必须以当前源码和 `docs/current/*` 为准重新落点。

## 信息优先级

1. `docs/current/*` 与源码事实
2. 已归档 spec / ADR：
   - `docs/decisions/0004-doubao-voice-asr-endpoint-baseline.md`
   - `docs/archive/specs/2026-05-16-1720-doubao-voice-endpoint-billing-audit/`
   - `docs/archive/specs/2026-05-16-1806-doubao-voice-unfinished-visualization/`
3. 用户在 brainstorm 中确认的产品意图（plan.md C 段）
4. 本 brief 内的早期判断与新信息冲突时，以最新版本为准

## 范围

- C-0：标准版 2.0 引擎选型、`audio.url` 本地音频交付 gate 与 submit/query 探针调研（独立技术调研子任务）
- C-1：后台任务 lifecycle owner（main process）
- C-2：触发上升沿接线（凭证保存成功 + workspace ready）
- C-3：与 B 状态字段联动（任务运行中 renderer 中间态 + 成功调 saveTranscript）

## 范围外

- 长音频进度可视化
- 任务可取消按钮
- 跨 workspace 后台任务
- 凭证撤销时主动清理已 enqueue 任务（lock-lost 已涵盖）
- D 的手动重转入口
- More 菜单挂载（D 负责）

## 硬约束

- 单 active workspace scope；切换 workspace 取消未完成任务
- 串行 FIFO（初始 1）
- voice X-Api-Key 不引入环境变量凭证；C 的 main-only TOS staging 需要运行环境显式配置，ffmpeg 默认使用随应用安装 binary 且 env path 只作为 override；renderer 不接触这些配置
- 不引入平台密钥
- 不动现有 saveTranscript / saveSegmentSupplementTranscript IPC contract（C 任务成功后调用现有 IPC，靠 manifest update 同步置 `'success'`）
- 不破坏 single-active-spec 规则

---

## 一、功能目标（产品功能说明）

让 Reo 用户的"系统侧失败、未转录"录音在用户感知不到的情况下自动补齐转录，前提是：用户已经把凭证修正、网络已经恢复。

具体来说，当任一以下事件发生：

1. 用户在 Settings 内保存 key 后，response snapshot 的 `settings.lastValidationOk === true`（且 `enabled=true`）；或用户主动 validate 返回 `code === 'ok'` 后，main settings store 从非 ok 进入 ok
2. App 启动后 / workspace 切换后，新 active workspace ready 且 `enabled=true ∧ apiKeyConfigured=true ∧ lastValidationOk=true`

main process 会扫描当前 active workspace 内 `lastTranscriptionAttempt='failed' ∧ transcript.exists=false` 的 segment 与 supplement，按 finalized `updatedAt` 倒序（或某确定序）逐条进入串行 FIFO 后台队列；每条任务用标准版 2.0 SeedASR AUC 把 finalized audio 转录成文本，成功后调用现有 `workspace:saveTranscript` / `workspace:saveSegmentSupplementTranscript` 写回，自动把 manifest `lastTranscriptionAttempt` 置为 `'success'`；失败则保持 `'failed'`，由下一次触发上升沿驱动重试。

手动任务运行中 UI 在 transcript view 内显示「正在生成」（renderer-only 中间态，不持久化）；自动任务对 renderer 静默。

## 二、用户角色

- 单用户本机使用者
- BYOK；标准版 2.0 AUC 与 streaming SAUC 共用 X-Api-Key（C0 必须验证）

## 三、使用入口

C 是后台行为；用户的"使用"是隐性的：

- 在 Settings 内保存了 key
- 启动 Reo
- 切换到一个有失败转录的 workspace

用户不需要主动按任何按钮。

## 四、前置条件

- B 已归档：`lastTranscriptionAttempt` 字段已存在；派生规则已稳定
- C0 探针通过：标准版 2.0 submit/query 可用、`audio.url` 本地音频交付 gate 已通过、key 复用合法、单次时长上限已知
- voice settings：`enabled=true ∧ apiKeyConfigured=true ∧ lastValidationOk=true`
- 当前 active workspace handle 仍有效（lock 未失去）

## 五、页面状态 / 流程状态（含完整覆盖）

### lastTranscriptionAttempt 与队列状态的笛卡尔积

每个 finalized segment / supplement 在 C 视角下有以下 lifecycle：

| 状态               | 进入条件                                                         | 系统行为                                      | UI 表现                                         | 退出                                          |
| ------------------ | ---------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| `not-eligible`     | `lastAttempt ∈ {'success', 'never'}` 或 `transcript.exists=true` | 不入队                                        | B 决定 UI                                       | n/a                                           |
| `eligible-idle`    | `lastAttempt='failed' ∧ exists=false` ∧ workspace 内无 C 任务    | 等待触发上升沿                                | B 显示「上次失败 + 重试」                       | 触发上升沿 → `enqueued`                       |
| `enqueued`         | 已被 C scanner 入队，未到队首                                    | 等待                                          | UI 不变（仍是 B 的失败 + 重试）                 | 出队头 → `running`                            |
| `running`          | 队首；正在调引擎                                                 | 引擎执行                                      | manual：显示「正在生成」覆盖按钮；auto：UI 不变 | 成功 → `succeeded`；失败 → `failed-retryable` |
| `succeeded`        | 引擎返回；saveTranscript 成功                                    | manifest 'success'，transcript view 显示文本  | B 的 success 分支                               | 终态                                          |
| `failed-retryable` | 引擎或 save 失败                                                 | manifest 仍 'failed'                          | 回到 B 的失败 + 重试                            | 下次触发上升沿 → `enqueued`                   |
| `canceled`         | workspace 切换 / lock lost / app quit                            | 任务从队列移除；如果正在跑则中断 HTTP request | 回到 B 的失败 + 重试（manifest 仍 'failed'）    | 下次触发上升沿                                |

### 后台队列状态

| 状态        | 含义                                                              |
| ----------- | ----------------------------------------------------------------- |
| `idle`      | 无 active workspace 或 active workspace 内无待补转录任务          |
| `scanning`  | 触发上升沿后，main 正在扫描 manifest 收集 eligible 集合           |
| `running`   | 队列非空，串行执行中                                              |
| `pausing`   | 录音流程打开期间暂停（保留队列但不出队）                          |
| `canceling` | workspace 切换 / lock lost / app quit；正在中断当前任务并清空队列 |

## 六、每个状态详细说明

### `not-eligible`

- 进入条件：见上表
- 页面表现：B 的对应 UI（success / never / cleared）
- 用户能做什么：n/a（C 不介入）
- 用户不能做什么：n/a
- 系统正在做什么：无
- 数据如何变化：无
- 如何退出该状态：C 不主动改变 not-eligible；只有未来合法写入路径把 manifest 变为 `'failed'` 且 transcript 为空时，才会在下一次扫描进入 eligible。D 失败必须保持 transcript 与 manifest 原值，不产生该退出。
- 异常如何处理：n/a
- 如何验收：单测 C scanner 不把这类 segment 入队

### `eligible-idle`

- 进入条件：`lastAttempt='failed' ∧ exists=false` ∧ 当前 workspace 内无 C 任务
- 页面表现：B 的失败 + 重试按钮
- 用户能做什么：手动点重试（D 接通后）
- 用户不能做什么：感知到 C 在工作（因为还没触发）
- 系统正在做什么：等待
- 数据如何变化：无
- 如何退出：触发上升沿
- 异常如何处理：n/a
- 如何验收：单测扫描结果包含该 segment

### `enqueued`

- 进入条件：已加入队列，未到队首
- 页面表现：仍是 B 的失败 + 重试（不显示"排队中"）
- 用户能做什么：点重试 → 走 D 路径复用 C 的手动触发入口；同 target 已在队列中时按 C 队列合同去重，不取消、不抢占
- 用户不能做什么：取消排队（不暴露 UI）
- 系统正在做什么：等待队首
- 数据如何变化：无
- 如何退出：出队头 → running
- 异常如何处理：workspace 切换 → canceled
- 如何验收：集成测试模拟多 segment 排队

### `running`

- 进入条件：队首任务开始执行
- 页面表现：manual 任务在 transcript view 显示「正在生成」覆盖重试按钮；auto 任务 UI 不变
- 用户能做什么：等待 / 切到其他 segment
- 用户不能做什么：取消（不暴露 UI）
- 系统正在做什么：提交标准版 2.0 submit 请求并轮询 query；成功后调 saveTranscript
- 数据如何变化：成功 → segment.md ## Transcript 写入；manifest 'success'
- 如何退出：成功 → succeeded；失败 → failed-retryable
- 异常如何处理：HTTP error / save error 都映射为 failed-retryable
- 如何验收：集成测试模拟成功 / 失败

### `succeeded`

- 终态
- 验收：transcript 文本显示；manifest 'success'

### `failed-retryable`

- 进入条件：引擎或 save 失败
- 系统不立即重试；等下一次触发上升沿
- 验收：失败后 manifest 仍 'failed'；UI 回到 B 的失败 + 重试

### `canceled`

- 进入条件：workspace switch / lock lost / app quit
- 系统：中断当前 HTTP request；从队列移除所有未执行任务
- 数据：manifest 不动；transcript.md 不写
- 验收：切换 workspace 后队列为空；in-flight 请求被 abort

### 队列 `pausing`

- 进入条件：RecordingOverlay 打开
- 系统：保留队列；不出队
- 退出：RecordingOverlay 关闭 → 继续从队首
- 验收：录音中入 workspace 时 C 不执行任何 IPC

## 七、组件元素拆解

### main process 组件

| 元素                     | 解决问题                                                    | 实现要点                                                             |
| ------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `C0SeedAsrAucClient`     | 调标准版 2.0 submit/query，处理状态码、轮询、超时和错误分类 | 单文件 `src/main/c0SeedAsrAucClient.ts`；no concurrency；abort 支持  |
| `BackfillAudioUrlSource` | 把 finalized audio 交付为火山可访问 `audio.url`             | C-0b 通过后实现；不公开本地服务、不默认对象存储上传                  |
| `BackfillQueue`          | 串行 FIFO 队列                                              | 单文件 `src/main/backfillQueue.ts`；持有 workspaceHandle scope       |
| `BackfillScanner`        | 扫描 active workspace manifest 收集 eligible 集合           | 复用现有 Memory detail projection 投影；按 updatedAt 倒序            |
| `BackfillTriggerWiring`  | 监听 voice settings 上升沿 + workspace ready 上升沿         | 在 main 注册 settings store 变更 callback + workspace lifecycle hook |

### renderer 组件

| 元素                             | 解决问题                                               | 实现要点                                                                       |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| feature-local running set        | 手动触发时在 App 内标记 target running                 | 不新增 main-to-renderer backfill event，不新增 Query key，不新增 Zustand store |
| `SegmentTranscriptView` 扩展     | 增加 `'running'` outcome（仍由 B 重构后的 model 承载） | outcome model 扩 `kind: 'running'`；C spec 内重构                              |
| MemoryStudio 注入 backfill state | 把 target identity 映射到 `running?` 状态              | feature-local；target 覆盖 Segment 与 SegmentSupplement                        |

## 八、状态切换规则（状态机）

### segment / supplement 视角

```text
not-eligible ──[lastAttempt='failed' ∧ exists=false]──→ eligible-idle
eligible-idle ──[trigger fired & enqueue]──→ enqueued
enqueued     ──[queue head]──→ running
running      ──[engine ok + save ok]──→ succeeded (manifest='success')
running      ──[engine fail | save fail]──→ failed-retryable (manifest='failed')
failed-retryable ──[next trigger fired & re-enqueue]──→ enqueued
running      ──[workspace switch | lock lost | app quit]──→ canceled (manifest='failed')
enqueued     ──[workspace switch | lock lost | app quit]──→ canceled
```

### 队列视角

```text
idle      ──[trigger fired]──→ scanning
scanning  ──[empty set]──→ idle
scanning  ──[non-empty]──→ running
running   ──[recording overlay open]──→ pausing
pausing   ──[recording overlay close]──→ running
running   ──[queue empty]──→ idle
running   ──[workspace switch | lock lost | app quit]──→ canceling
canceling ──[abort done]──→ idle
```

## 九、数据如何同步

- manifest update：经现有 main process write queue；与 finalize / title rename 串行
- TanStack Query：C 成功后 main 通过 saveTranscript response 已包含 projection 变更；renderer 现有 mutation invalidation 自动覆盖
- 中间态：不新增 main → renderer 事件 channel；手动触发由 renderer optimistic state 表达，自动任务对 UI 静默
- 不持久化"任务 running"状态：app crash 后丢失中间态，下次启动按 manifest 重新派生（manifest 仍 'failed' → 重新 eligible）

## 十、接口契约

### 新增

- renderer 手动触发合同（供 D 与 B 的 inline 重试复用）
  - C spec 必须先定义 payload、response、错误信封、去重和排序语义
  - 该合同只负责把明确 target 送入同一 `BackfillQueue`，不实现 D 菜单、确认弹层或额外 UI

### 复用

- `workspace:saveTranscript` / `workspace:saveSegmentSupplementTranscript`（C 任务内部调用）
- `['settings', 'voice']` Query（C 触发监听 store 内部状态）
- finalized projection 中 `lastTranscriptionAttempt`（B 已暴露）

### 不引入

- 不引入"启动 C / 停止 C"用户 API
- 不引入任务取消 IPC；手动触发只允许入队，不允许抢占、取消或绕过 C 队列合同

## 十一、第三方能力

| 项                           | 内容                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| 使用哪个能力                 | 火山引擎大模型录音文件识别标准版 2.0 `POST /api/v3/auc/bigmodel/submit` + `query` + `volc.seedasr.auc` |
| 工程接入边界                 | 全部在 main process；renderer 完全不接触                                                               |
| 页面消费哪些结果             | transcript text；其它字段（confidence、utterances 等）不消费                                           |
| 失败时如何降级               | retry 不在任务内部进行；交给下一次触发上升沿                                                           |
| 数据如何保存                 | 复用现有 `workspace:saveTranscript` IPC；写入 segment.md `## Transcript`                               |
| 异步结果如何回写             | BackfillQueue 单 task 内部 submit + poll；对外仍是同步 await                                           |
| 以官方文档和实际接口协议为准 | C-0 探针子任务先验证                                                                                   |

## 十二、C-0 探针子任务

C-0 是 C spec 的 Phase 0 / Gate 0；C-0 失败 → 暂停 C-1/C-2/C-3 实施，回到 brainstorm。

C-0 验证项：

1. **endpoint 可用性**：构造最小 submit/query request（极短 audio sample，如 1 秒静音），用现有 BYOK key 调用标准版 2.0 endpoint
2. **resource id 一致性**：header 用 `X-Api-Resource-Id: volc.seedasr.auc`，确认 submit/query 可用
3. **key 复用**：使用 voice settings 现存的 X-Api-Key，确认同 key 同时授权 SAUC 流式与 AUC 离线
4. **单次时长上限**：优先以官方文档确认；若官方文档缺失或与 smoke request 冲突，再做边界时长 probe
5. **本地音频 URL 交付**：确认 Reo finalized local audio 如何在不破坏本地优先与 Electron 安全边界的前提下成为火山可访问 `audio.url`

C-0 产出物：

- C 归档 spec 内的 C0 findings 段
- C0 通过后，把长期 endpoint / billing / limit 结论压缩进 ADR 0004 扩展段，或新 ADR 0005

C-0 不实施 C-1/C-2/C-3 任何代码。

## 十三、边界情况补齐（必做）

| 场景                                    | 处理                                                                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 同 segment 既被 C 入队、用户又点 D 重试 | D 复用 C 的手动触发入口；同 target 已在队列中时按 C 队列合同去重，不取消、不抢占                                                                            |
| 录音中触发上升沿                        | C 把任务入队但 `pausing` 状态不出队                                                                                                                         |
| 凭证 valid → invalid 中途               | 当前任务正在跑：fail → failed-retryable；不主动清空队列；下次触发上升沿前任务不会被取消（队列等待执行时仍可能 fail）                                        |
| 单条音频超大（>flash 上限）             | manifest 标记 `'failed'`；不进入回落（除非 C 实现回落）；D 手动也会失败；考虑在 manifest 加 `lastTranscriptionError?: 'too-large'` 子状态（待 C spec 决定） |
| 同 segment 反复失败                     | 不限制次数；每次触发上升沿都会重新入队（无 backoff，因为触发上升沿本身就是稀疏事件）                                                                        |
| workspace 切换时 in-flight              | abort HTTP；不写 manifest；下次进入该 workspace 时按 manifest 重新派生                                                                                      |
| app quit 时 in-flight                   | 同上；不持久化 in-flight 任务                                                                                                                               |
| 同 segment 多 supplement 都 failed      | scanner 把 segment 和它的 supplements 都收集；按确定序逐一入队                                                                                              |
| 多 workspace 间并发录音                 | 不存在（Reo 单 active workspace）                                                                                                                           |
| 网络抖动恢复                            | 不专门处理；workspace ready 触发上升沿会覆盖大部分场景                                                                                                      |
| Reo 进程 crash                          | 重启后按 manifest 重新派生；无 in-flight 残留                                                                                                               |

## 十四、性能与防丢失

- C 串行 FIFO 上限 1：不并发；单任务 HTTP timeout 由 C0 决定（默认 60s？）
- 不写 in-flight 状态到磁盘
- manifest update 失败 → 任务视为 failed，retry 由下次触发
- saveTranscript 失败 → 同上
- 单 workspace 内同 segment 不能并发 enqueue（去重）

## 十五、防重复 / 防串写

- 单任务串行执行
- saveTranscript 与 D 手动重转通过现有 main process write queue 自动串行
- C 不动 transcript.md 直接写；全部走 saveTranscript

## 十六、最终目标总结（可放在 C spec 顶部）

C 的最终交付是：让用户在凭证恢复 / 启动 Reo / 切换 workspace 时，所有"上次系统失败、转录仍空"的 segment 与 supplement 自动按串行 FIFO 后台补齐转录，不需要用户主动点任何按钮；整个流程对用户透明，成功后 transcript 文本出现、manifest 自动置 `'success'`；失败保留 `'failed'`，下次触发上升沿继续。后台引擎使用火山引擎大模型录音文件识别标准版 2.0 `POST /api/v3/auc/bigmodel/submit` + `query` + `volc.seedasr.auc`，C-0 必须先确认 endpoint 可用、key 复用、轮询策略、单次时长上限与本地音频 `audio.url` 交付方案。任务持有当前 active workspace handle，切 workspace / lock lost / app quit 即中断并清空队列；录音中暂停队列但不取消。复用现有 `workspace:saveTranscript` 与 `workspace:saveSegmentSupplementTranscript` 写回，依赖 B 的 `lastTranscriptionAttempt` manifest 字段判断 eligible 集合。C 同批建立手动触发合同，把 D 与 B 的 inline 重试请求送入同一 `BackfillQueue`，但不实现 D 菜单、确认弹层、任务取消或第二套排序规则；不新增 main → renderer 事件 channel。新增的外部依赖是 C0 验证后的 SeedASR AUC 2.0 客户端实现与音频 URL 交付适配。验收依据 C spec verification.md：scanner 正确收集 failed-eligible 集合、串行队列正确执行、submit/query 成功调 saveTranscript / 失败保留 manifest、workspace 切换正确取消、录音中正确暂停、saveTranscript 成功后 manifest 自动 'success'、手动触发同 target 去重且不抢占、TypeScript strict 与 `npm run verify:quick` 全绿；本 spec 与 `docs/current/electron.md` / `docs/current/flow.md` / `docs/current/data.md` / `docs/current/frontend.md` / `docs/current/quality.md` 必须在收口时同批更新。

## 十七、Readiness gate

B→C readiness gate 只在 plan.md 定义并只执行一次；本 brief 是该 gate 后的 C 输入。

## 十八、不实施

- D 的 More 菜单挂载
- 用户编辑 transcript 文本能力
- 任务可视化进度条
- 任务可取消按钮
- 跨 workspace 队列
- 凭证撤销时主动清理 enqueue（lock-lost 已涵盖）

# 产品功能说明（C）

## 1. 本次需求目标

### 1.1 用户目标

让 Reo 用户在不主动操作的前提下，让所有「上次系统失败、转录仍空」的 finalized 录音被自动补齐转录；同时让 Memory Studio 内已经存在的「上次生成转录失败 / 重试」inline 按钮真正能用——点一下就能让该段录音重新转录。

### 1.2 产品体验目标

- 自动补转录对用户透明：用户回到 Reo、修正凭证、切换到一个旧 workspace 时，过去因为网络抖动 / 凭证过期等系统侧原因卡住的录音应该「悄悄」就补齐了。
- 手动重试有立即反馈：用户在转录 tab 内点击「重试」按钮后，按钮位置立即变成「正在生成」灰文，不需要任何确认弹层；任务成功后该位置变成转录正文，失败时回到「上次失败 / 重试」并通过 root toast 告知。
- 自动失败不打扰：自动批次失败不弹 toast、不影响其它工作；用户下次主动重试或下次触发上升沿会重新尝试。
- 不烧凭证：用户反复保存错误的 X-Api-Key 时，单次 batch 任务上限与连续失败 circuit breaker 防止把 50 条失败 segment 一次性发出去导致 50 次计费失败。

### 1.3 功能目标

- 落地 main 进程后台引擎：BackfillQueue + scanner + 触发上升沿监听
- 落地 2 个手动触发 IPC（segment 与 supplement 各 1 个），可被 B inline 重试与未来 D More 菜单复用
- 把 `App.tsx` 中的 placeholder `showTranscriptionRetryPlaceholder` 改成真实 handler，接入新 IPC
- 在 `SegmentTranscriptView` outcome 模型加入 `kind: 'running'`，渲染「正在生成」灰文覆盖按钮
- 录音流程打开时暂停队列，结束后恢复
- main 本地诊断按现有 `[reo-diagnostic]` 模式记录后台任务关键事件

### 1.4 当前版本范围

- C-0 探针：endpoint 可用性 + key 复用 + 单次时长上限 + 是否需要异步回落
- C-1 main 后台引擎与触发上升沿监听
- C-2 手动触发 IPC + B inline 重试接通
- C-3 录音暂停 + circuit breaker + 诊断

### 1.5 当前版本不包含

- D 的 More 菜单挂载与覆盖确认弹层
- 任务可取消按钮、任务进度条、长音频进度可视化
- 跨 workspace 后台任务
- segment / supplement manifest schema 扩展（不增 `retryCount`、`lastTranscriptionError`、backoff timestamp）
- 失败次数上限 / 永久 disable
- 异步 `submit` / `query` 回落（视 C-0 结论在新 spec 内决定）
- 用户编辑 transcript 文本能力

## 2. 输入信息理解

### 2.1 已确认信息

1. B 已归档：segment / supplement manifest 上 `lastTranscriptionAttempt` 字段已稳定；`SegmentTranscriptView` 已经渲染失败可重试态；B inline 重试按钮已存在但调用的是 placeholder。
2. `App.tsx:1007` 当前是 `toast('转录引擎尚未上线')`，wired 到 segment 与 supplement 两条 `onRetry*Transcription` props。
3. Sidebar 红点已经接 `lastValidationCode='auth'`，跨 workspace 持续可见。
4. 当前唯一的 ASR 引擎是 streaming SAUC 2.0（`bigmodel_async` WebSocket，`volc.seedasr.sauc.duration`，单 X-Api-Key + Connect-Id + Resource-Id）。
5. 当前没有 offline / batch ASR 客户端、没有 background queue、没有 `workspace:backfillEvent` 类事件 channel。
6. main 已持有 `voiceSettingsStore.ts` + `voiceTranscriptionProbe.ts`，可解密 X-Api-Key 并对 SAUC 做最小握手 probe。
7. ADR 0004 明确「离线 / 批处理 ASR endpoint 的选型（C 后台补转录的引擎合同 C0 单独决策）」。
8. `flow.md` 明确「禁止没有 observability 的 hidden background job」。

### 2.2 信息优先级处理

- c-brief.md 的 IPC 合同 `workspace:backfillEvent`、5 个 main 组件命名、状态机文字都属于 pre-spec 草案；本 spec 与之冲突时以本 spec 为准。
- 共识：c-brief.md 中 `workspace:backfillEvent` 被本 spec 删除；手动触发 IPC 命名按本 spec 给出。

### 2.3 假设

- 假设 1：火山引擎离线极速版 `POST /api/v3/auc/bigmodel/recognize/flash` + `volc.bigasr.auc_turbo` 接受与 SAUC streaming 同一把 X-Api-Key（待 C-0 验证）。
- 假设 2：flash endpoint 单次音频时长上限覆盖 60 分钟（Reo 单次录音硬上限）（待 C-0 验证；若不覆盖需新 spec 处理异步回落）。
- 假设 3：probe 在按时长计费模型下 0 字节 / 极短音频不产生显著账单（继承 ADR 0004 同款判断；C-0 复核）。
- 假设 4：N=20（单次触发上升沿 batch cap）与 K=3（同 error code 连续失败 breaker 阈值）作为初始默认，C-0 通过后可在 spec 内微调，最终值落到 ADR。

### 2.4 待确认项

- C-0 findings 完成前不允许进入 C-1/C-2/C-3 实施
- 若 C-0 发现 X-Api-Key 不支持 SAUC + flash 同 key 同时授权，整个 C 设计回到 brainstorm；本 spec 标 paused
- N 与 K 的最终值

## 3. 功能类型判断

| 功能类型            | 是否涉及 | 说明                                                               |
| ------------------- | -------- | ------------------------------------------------------------------ |
| 页面功能            | 是       | Memory Studio 内 transcript view 增加 `running` 状态               |
| 组件功能            | 是       | `SegmentTranscriptView` outcome 模型扩展                           |
| 异步任务功能        | 是       | main 后台 BackfillQueue + scanner + 触发上升沿                     |
| 桌面端系统能力功能  | 是       | main process 触发上升沿监听 + `electron-log` 本地诊断              |
| 跨页面流程功能      | 部分     | 触发由 voice settings 保存 / workspace ready 跨流程驱动            |
| 危险操作功能        | 否       | 自动补转录不是覆盖式；只在 transcript 空时写入                     |
| 通知功能            | 部分     | 仅手动失败通过 root toast 显示；自动任务静默                       |
| 权限功能            | 否       | Reo 单用户本机；不引入 role-based permission                       |
| 表单 / 搜索 / 筛选  | 否       | 不涉及表单或筛选 UI                                                |
| 多人协作 / 同步     | 否       | Reo 单用户本机；不涉及多端同步                                     |
| 本地数据管理        | 部分     | 仅复用现有 `saveTranscript` 路径写 manifest；不新建表、不动 schema |
| AI 功能             | 是       | 第三方 ASR 引擎调用，属于 AI / ASR 范畴                            |
| 后台配置 / 数据看板 | 否       | n/a                                                                |
| 数据导入导出        | 否       | n/a                                                                |
| 应用更新            | 否       | n/a                                                                |

## 4. 用户角色与使用场景

| 项目     | 说明                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| 目标用户 | 单用户本机使用者；已启用流式语音识别且已保存有效 X-Api-Key                                                            |
| 使用场景 | 在咖啡店 / 弱网 / 凭证失效场景中导致部分录音转录失败后，希望系统自动补齐或一键重试                                    |
| 使用入口 | 触发上升沿（隐式）+ Memory Studio transcript tab 内 inline 重试按钮（显式）                                           |
| 前置条件 | B 已归档；voice settings `enabled=true ∧ apiKeyConfigured=true ∧ lastValidationOk=true`；当前 workspace handle 仍有效 |
| 用户任务 | 让那些「上次失败」的录音补齐转录                                                                                      |
| 成功结果 | 转录文本出现在该 segment / supplement 转录区；manifest 自动置 `'success'`                                             |
| 失败结果 | 手动触发：root toast 显示脱敏错误；transcript view 回到失败可重试态；自动触发：静默                                   |
| 权限限制 | n/a（Reo 单用户本机；不引入 role 权限）                                                                               |

## 5. 页面与流程说明

### 5.1 页面结构

C 不引入新页面、不引入新弹层、不改 layout。受影响的 surface 只有 `SegmentTranscriptView`：

- 失败可重试态（B 已有）：「上次生成转录失败。」灰文 + 「重试」compact secondary Button
- 新增 running 态：「正在生成」灰文，覆盖原重试按钮位置；不显示 spinner（design system 默认不用 spinner 表达进行中）；不允许在 running 态再次点击

不动：Sidebar 红点、Memory rail、Workspace titlebar、Recording overlay、Memory Studio 整体布局、Settings shell。

### 5.2 用户流程

```text
触发上升沿 (auto)
  voice settings 保存 / validate → lastValidationOk 从 false→true
  OR App 启动 / workspace 切换 → workspace ready ∧ enabled ∧ apiKeyConfigured ∧ lastValidationOk
    ↓
  main BackfillTriggerWiring 收到 trigger
    ↓
  BackfillScanner 在当前 active workspace 内收集 lastAttempt='failed' ∧ exists=false 的 segment + supplement
    ↓
  按 updatedAt desc 取前 N 条入 BackfillQueue（auto tasks）
    ↓
  Queue 串行出队（pause / cancel / breaker 保护）
    ↓
  每个 task 通过 c0FlashClient 调 flash endpoint
    ↓
  成功 → main 内部调 saveTranscript / saveSegmentSupplementTranscript → manifest 自动置 'success'
  失败 → main 记录诊断、计数 breaker、继续下一条（除非 breaker trip）

手动触发 (manual)
  用户在 transcript tab 点「重试」
    ↓
  renderer 设 target 为 optimistic running，按钮位置变「正在生成」
    ↓
  调 workspace:requestSegmentTranscriptionBackfill / ...Supplement...
    ↓
  main 校验 sender + handle + lock + workspaceId 匹配
    ↓
  main 把 task 插入 BackfillQueue 队首（不抢占 in-flight）
    ↓
  IPC handler 同步等待该 task 完成
    ↓
  成功 → response 返回 Memory summary + projection（同 saveTranscript shape）→ renderer 清 optimistic，自动看到 'success' 状态
  失败 → response 返回 typed error envelope → renderer 清 optimistic，root toast 显示脱敏错误，transcript view 回到失败可重试态
```

### 5.3 主操作

- 用户操作：点击 transcript tab 内「重试」按钮（B 已有 UI）
- 系统操作：BackfillTriggerWiring 检测到触发上升沿后启动 scan + enqueue

### 5.4 辅助操作

- 用户：切换 Segment、切换 Memory、切换 Workspace（会取消当前 in-flight task）
- 用户：开始录音（会暂停队列）

### 5.5 危险操作

无。C 不引入任何覆盖式写入；自动任务仅在 transcript 为空时写入。

## 6. 页面状态说明

### 6.1 SegmentTranscriptView outcome 状态（B 已有 + C 新增）

| 状态名称            | 进入条件                                                         | 页面表现                                     | 用户可操作 | 用户不可操作       | 系统行为                  | 数据变化                  | 退出条件                                         | 异常处理                                          | 验收标准                                  |
| ------------------- | ---------------------------------------------------------------- | -------------------------------------------- | ---------- | ------------------ | ------------------------- | ------------------------- | ------------------------------------------------ | ------------------------------------------------- | ----------------------------------------- |
| `loading`           | Segment content Query loading                                    | 「正在载入转录内容。」灰文                   | n/a        | 重试               | 等待 Query                | 无                        | Query 完成                                       | n/a                                               | B 已覆盖                                  |
| `error`             | Segment content Query error                                      | 「转录加载失败，请重试。」灰文               | n/a        | 重试               | n/a                       | 无                        | Query 重试                                       | n/a                                               | B 已覆盖                                  |
| `success`           | transcript.exists=true                                           | transcript 正文（可选中）                    | 选中、复制 | n/a                | n/a                       | 无                        | Segment 切换或 transcript 内容变化               | n/a                                               | B 已覆盖                                  |
| `empty-never`       | lastAttempt='never' ∧ exists=false                               | 「这段录音还没有转录。」灰文                 | n/a        | 重试（无按钮）     | n/a                       | 无                        | manifest 进入 'failed' 或 'success'              | n/a                                               | B 已覆盖                                  |
| `empty-cleared`     | lastAttempt='success' ∧ exists=false                             | 「这段录音还没有转录。」灰文                 | n/a        | 重试（无按钮）     | n/a                       | 无                        | 用户重新生成或外部恢复                           | n/a                                               | B 已覆盖                                  |
| `failed-retryable`  | lastAttempt='failed' ∧ exists=false ∧ 不在 running optimistic    | 「上次生成转录失败。」+「重试」compact 按钮  | 点击重试   | n/a                | n/a                       | 无                        | 用户点重试 → running；或 manifest 进入 'success' | n/a                                               | B 已覆盖                                  |
| `running`（C 新增） | 用户刚点了「重试」且本地 optimistic running target 包含本 target | 「正在生成」灰文，覆盖原按钮位置；无 spinner | n/a        | 重试（按钮被覆盖） | IPC handler 同步执行 task | 无（直到 saveTranscript） | IPC response 返回（成功或失败）                  | response 失败 → root toast，回到 failed-retryable | C 新增；测试覆盖 running 渲染与点击不可达 |

### 6.2 BackfillQueue lifecycle 状态（main 内部）

| 状态名称    | 进入条件                                                  | 系统行为                                          | 退出条件                                                                                                          | 异常处理                            | 验收标准                     |
| ----------- | --------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------- |
| `idle`      | 无 active workspace 或 active workspace 内无 pending task | 等待                                              | 收到 trigger → `scanning` 或 收到手动 enqueue → `running`                                                         | n/a                                 | 测试：空 workspace 不 scan   |
| `scanning`  | 触发上升沿后                                              | 扫描 Memory detail 投影路径找 eligible 集合       | 收集 → 若 empty 回 `idle`；非空进入 `running`                                                                     | scan IO error → 记录诊断、回 `idle` | 测试：scan 不阻塞 IPC        |
| `running`   | 队列非空且未暂停                                          | 串行执行队首任务                                  | 队列空 → `idle`；recording 开始 → `pausing`；workspace 切换 → `canceling`；breaker trip → `idle`（丢弃剩余 auto） | task 失败计入 breaker counter       | 测试：串行执行、breaker trip |
| `pausing`   | recording overlay 打开期间                                | 保留队列，不出队，不调引擎                        | recording overlay 关闭 → `running`                                                                                | n/a                                 | 测试：录音中不发 HTTP        |
| `canceling` | workspace 切换 / lock lost / app quit                     | abort in-flight HTTP，清空 enqueued auto + manual | abort 完成 → `idle`                                                                                               | abort 失败按 best-effort，记录诊断  | 测试：cancel 不留 in-flight  |

### 6.3 单 task 视角（每个 segment / supplement）

| 状态               | 进入条件                                              | 系统行为                                  | UI 表现                                                | 退出                                          |
| ------------------ | ----------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------ | --------------------------------------------- |
| `not-eligible`     | lastAttempt='success' ∨ 'never' ∨ exists=true         | 不入队                                    | B 决定                                                 | n/a                                           |
| `eligible-idle`    | lastAttempt='failed' ∧ exists=false ∧ 无 pending task | 等待触发上升沿或手动点击                  | B 失败可重试态                                         | 入队 → `enqueued`                             |
| `enqueued`         | 已加入 queue 未到队首                                 | 等待                                      | 仍为 B 失败可重试态（无 queued badge）                 | 出队头 → `running`                            |
| `running`          | 队首；正在调 flash endpoint                           | HTTP POST 进行中                          | manual：renderer optimistic「正在生成」；auto：UI 不变 | 成功 → `succeeded`；失败 → `failed-retryable` |
| `succeeded`        | flash 成功 + saveTranscript 成功                      | manifest 'success'                        | transcript 正文                                        | 终态                                          |
| `failed-retryable` | engine 或 save 失败                                   | manifest 仍 'failed'                      | manual：toast + 回到失败态；auto：UI 不变              | 下次触发上升沿 / 手动重试 → 重新 `enqueued`   |
| `canceled`         | workspace switch / lock lost / app quit               | 任务从队列移除；in-flight task abort HTTP | manual：response 返回 abort 错误，回到失败态；auto：无 | 下次触发上升沿                                |

## 7. 组件与元素说明

C 复用 B 已落地的 `SegmentTranscriptView`、Sidebar settings trigger、Memory Studio。只对 `SegmentTranscriptView` 新增一个 outcome 渲染分支，其它复用现有元素。

| 元素                       | 用户问题                     | 出现条件                    | 隐藏条件                                  | 默认态                                           | hover / active / disabled                                                            | loading | 交互结果                       | 联动关系                                                  | 工程注意                                                                        | 验收标准                                 |
| -------------------------- | ---------------------------- | --------------------------- | ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------ | ------- | ------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| 「重试」compact Button     | 给系统侧失败一个一键修复入口 | outcome=`failed-retryable`  | outcome=`running` / `success` / `empty-*` | 灰文 + secondary button                          | 沿用 shadcn Button `size="sm" variant="secondary"` 既有规则；onRetry 缺失时 disabled | n/a     | 点击 → 进入 `running` 并调 IPC | 与 `running` outcome 互斥；与 Sidebar 红点无直接联动      | 不引入 spinner；点击后立即设 optimistic；optimistic 仅保留到 IPC response       | T4 `SegmentTranscriptView.test.tsx`      |
| 「正在生成」灰文（C 新增） | 让用户知道自己的点击已被接受 | outcome=`running`           | IPC response 返回                         | `text-muted-foreground` `font-sans text-body-sm` | n/a（不可点）                                                                        | n/a     | n/a                            | 与失败可重试态互斥                                        | 文字大小与失败可重试态第一行一致；不闪烁；reduced motion 无影响                 | T4 `SegmentTranscriptView.test.tsx` 渲染 |
| Sidebar 红点（B 已有）     | 跨 workspace 提醒凭证失效    | `lastValidationCode='auth'` | 其它                                      | `bg-destructive` 8px 圆                          | 不可点击                                                                             | n/a     | n/a                            | 与 C 无直接联动；自动触发上升沿仍由 lastValidationOk 驱动 | C 不改                                                                          | B 已覆盖                                 |
| Sonner root toast          | 手动重试失败时的错误反馈     | manual IPC 失败             | toast 自然消失                            | shadcn toast 默认                                | 沿用现有 toast 行为                                                                  | n/a     | n/a                            | 与 transcript view `failed-retryable` 联动                | 文案由错误信封 errorCode 映射到 `workspaceErrorMessages.ts`；自动失败不弹 toast | T4 集成测试                              |

## 8. 交互规则

### 8.1 主操作规则

- 手动触发：点击「重试」→ 立即设 optimistic running → 调 IPC；IPC handler 同步执行；response 返回前按钮不可重复点击
- 自动触发：无用户操作；触发上升沿由 main 监听

### 8.2 辅助操作规则

- 切换 Segment / Memory 不影响 BackfillQueue
- 切换 Workspace 触发 BackfillQueue `canceling`

### 8.3 危险操作规则

n/a（C 不覆盖现有 transcript；非空 transcript 不会被自动写入）

### 8.4 提示与确认规则

- 手动 retry 不需要二次确认（与 B 一致）
- 自动 backfill 不弹任何提示

### 8.5 防重复操作规则

- BackfillQueue 内同 target 去重；renderer optimistic 期间按钮不可点击
- 手动 IPC 同一 sender + handle + target 在 in-flight 时直接返回 `ERR_BACKFILL_ALREADY_RUNNING`，不二次入队

### 8.6 未保存内容保护规则

n/a（C 不创建 draft、不写 Markdown 草稿；只复用 saveTranscript 的现有 atomic write）

## 9. 状态切换规则

详见 plan.md 的状态机段。

## 10. 数据规则

### 10.1 字段写入与读取

C 不引入新字段；只复用 B 已落地的 `lastTranscriptionAttempt`。

| 字段                       | 类型                               | 来源                                                          | 默认值             | 是否必填                   | 是否可编辑                                                 | 校验规则             | 存储位置                                                                 | 同步规则                           | 异常处理                             | 验收标准    |
| -------------------------- | ---------------------------------- | ------------------------------------------------------------- | ------------------ | -------------------------- | ---------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------ | ----------- |
| `lastTranscriptionAttempt` | `'success' \| 'failed' \| 'never'` | finalize / saveTranscript / C 任务（间接复用 saveTranscript） | 缺失视为 `'never'` | 否（manifest 内 optional） | 仅 main 在 finalize 与 saveTranscript 路径写入；C 不直接写 | strict literal union | `.reo/objects/segments/<id>.json` / `.reo/objects/supplements/<id>.json` | manifest 写 + Memory index refresh | C task 失败 → manifest 保持 'failed' | 复用 B 验证 |
| `transcript` 正文          | string（Markdown `## Transcript`） | C 任务 → saveTranscript                                       | 空                 | 否                         | 仅 main 写；renderer 不直接写                              | UTF-8 普通文件       | `segment.md` / `supplement.md` 正文                                      | 复用现有 main process write queue  | save 失败 → typed error envelope     | 复用 B 验证 |

### 10.2 Query key 与 cache

- 不新增 Query key
- 不写 optimistic state 到任何 Query cache
- 手动 retry 成功 response 返回 Memory summary + projection（同 saveTranscript shape）；renderer 通过现有 mutation 路径合并 Memory detail cache，并 invalidate 该 Segment / supplement content Query
- 自动 task 成功后 main 调 saveTranscript 内部路径，不经过 renderer mutation；renderer 看到 transcript 出现的时机：下一次 Workspace snapshot visibility refresh、或下次 Memory detail Query stale time 到期、或下次手动 retry 触发刷新

### 10.3 状态归属

- BackfillQueue / scanner / trigger wiring 状态：main process runtime state（不持久化）
- circuit breaker counter：main process runtime state（不持久化；app restart 清零）
- batch cap counter：main process runtime state
- renderer optimistic running target set：feature-local component state（Memory Studio 或 App 顶层 useState）；不进 Query、不写文件
- 不引入 Zustand store

## 11. 权限规则

Reo 单用户本机。C 不引入 role-based permission。访问控制完全沿用现有：

| 权限场景            | 角色或条件                              | 可见规则                | 可操作规则                             | 接口规则                                                                            | 页面反馈                                           | 日志规则                                                      | 验收标准 |
| ------------------- | --------------------------------------- | ----------------------- | -------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- | -------- |
| 未启用流式语音识别  | voice settings `enabled=false`          | B 失败按钮按 B 当前规则 | 手动重试 IPC 立即 fail-fast            | 校验 enabled=true；不通过返回 `ERR_BACKFILL_VOICE_DISABLED`，不计 breaker，不调引擎 | root toast「先在设置里启用语音识别」               | 诊断 event=`task-failed`、errorCode=`voice-disabled`          | T7 测试  |
| 未配置 X-Api-Key    | voice settings `apiKeyConfigured=false` | 同上                    | 手动重试 IPC 立即 fail-fast            | 校验 apiKeyConfigured=true；不通过返回 `ERR_BACKFILL_API_KEY_MISSING`               | root toast 引导去设置                              | 同上 errorCode=`api-key-missing`                              | T7 测试  |
| Workspace lock lost | handle / lock 已失效                    | 无可见变化              | IPC 返回现有 `ERR_WORKSPACE_LOCK_LOST` | 沿用 `assertWorkspaceUsable` 现有路径，不映射成 `ERR_BACKFILL_CANCELED`             | root toast 复用 `ERR_WORKSPACE_LOCK_LOST` 既有文案 | 诊断 event=`task-failed`、errorCode=`ERR_WORKSPACE_LOCK_LOST` | T7 测试  |
| 录音中              | recording overlay 打开                  | 无变化                  | 手动重试入队但暂停                     | 入队后 BackfillQueue 在 `pausing` 状态；录音结束后出队                              | UI 显示 running optimistic 直至录音结束            | 诊断 event=`queue-paused`                                     | T8 测试  |

## 12. 接口与本地数据说明（精简，详见 plan.md）

### 12.1 新增 IPC

- `workspace:requestSegmentTranscriptionBackfill`：request `{ workspaceHandle, workspaceId, memoryId, segmentId }`，response 同 `workspace:saveTranscript` shape（Memory summary）
- `workspace:requestSegmentSupplementTranscriptionBackfill`：request `{ workspaceHandle, workspaceId, memoryId, segmentId, supplementId }`，response 同 `workspace:saveSegmentSupplementTranscript` shape（Memory summary + parent segment projection + supplement projection）

### 12.2 复用 IPC（不动 contract）

- `workspace:saveTranscript` / `workspace:saveSegmentSupplementTranscript`：C 任务内部调用，沿用现有 lock + manifest update + index refresh 路径
- `workspace:readVoiceTranscriptionSettings`：renderer 只读
- 现有 voice settings save / validate / clear / setEnabled IPC contract 不动；`voiceSettingsStore.ts` 仅追加一个 main 内部 `onSnapshotChange` listener export 供 trigger wiring 使用，不暴露到 preload / IPC

### 12.3 不引入

- `workspace:backfillEvent` 中间态事件 channel
- 手动取消 IPC
- 任何写入 transcript text 的额外 IPC
- 本地数据库表（Reo 当前没有 SQLite）

## 13. 异常与边界情况

详见 verification.md。

## 14. 成功结果 / 失败结果

### 14.1 成功（手动触发）

- transcript view 从「正在生成」变为 transcript 正文
- manifest `'success'`
- Memory detail cache 自动合并新 projection
- 无 toast 弹出

### 14.2 成功（自动触发）

- 用户在下次 Workspace snapshot visibility refresh 或 Memory detail Query 失效后看到 transcript 出现
- manifest `'success'`
- 不弹任何提示

### 14.3 失败（手动触发）

- root toast 显示脱敏错误（按 errorCode 映射文案）
- transcript view 回到 `failed-retryable`
- manifest 保持 `'failed'`

### 14.4 失败（自动触发）

- 不弹 toast
- transcript view 保持 `failed-retryable`
- manifest 保持 `'failed'`
- main 诊断写 `task-failed`
- 累计 breaker counter

## 15. 验收标准

详见 verification.md。

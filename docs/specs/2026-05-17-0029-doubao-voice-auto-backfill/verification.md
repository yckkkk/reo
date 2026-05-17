# 边界情况 + 验收清单 + 最终复核（C）

## 1. 边界情况补齐

### 1.1 C-0 探针边界

| #   | 场景                                                 | 触发        | 处理规则                                                          | 界面反馈 | 建议文案 | 数据保护规则        | 可恢复规则                | 验收标准         |
| --- | ---------------------------------------------------- | ----------- | ----------------------------------------------------------------- | -------- | -------- | ------------------- | ------------------------- | ---------------- |
| 1   | 标准版 2.0 endpoint 不存在或 URL 404                 | 探针发现    | 暂停 C 实施，回 brainstorm                                        | n/a      | n/a      | 不动任何文件        | 由用户决定后续方向        | C-0 评估明确记录 |
| 2   | 标准版 2.0 endpoint 存在但 X-Api-Key 不能复用        | 探针 401    | 暂停 C 实施，回 brainstorm；评估是否需要单独 ASR key 配置         | n/a      | n/a      | 不动 voice settings | 由用户决定后续方向        | C-0 评估明确记录 |
| 3   | `audio.url` 交付方案违反本地优先或 Electron 安全边界 | C-0b 评估   | 暂停 C-1/C-2/C-3；不得用公开本地服务、公网隧道或默认对象存储绕过  | n/a      | n/a      | 不上传用户音频      | 由新 spec 或用户决策处理  | C-0 评估明确记录 |
| 4   | 标准版 2.0 格式不接受 Reo WebM/Opus                  | 探针 / 文档 | 优先评估 remux 到 OGG/Opus；不行再评估 WAV/MP3 转码依赖和打包成本 | n/a      | n/a      | 不动文件            | 由 C-0b 方案处理          | ADR 0005 内说明  |
| 5   | 标准版 2.0 单次上限 < Reo 单次录音上限               | 探针 / 文档 | 暂停 C-1/C-2/C-3；回 brainstorm 调整切分或引擎策略                | n/a      | n/a      | 不动文件            | 由新 spec 处理            | C-0 评估明确记录 |
| 6   | 标准版 2.0 probe 触发计费                            | 探针测算    | 在 ADR 中明确记录单次 probe 成本；如显著则后续不做开机自动 probe  | n/a      | n/a      | n/a                 | 后续 spec 决定 probe 策略 | ADR 0005 内说明  |

### 1.2 自动触发上升沿边界

| #   | 场景                                          | 触发                               | 处理规则                                                           | 界面反馈     | 建议文案 | 数据保护规则              | 可恢复规则                        | 验收标准           |
| --- | --------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ | ------------ | -------- | ------------------------- | --------------------------------- | ------------------ |
| 5   | 保存 key 后 probe 返回 ok                     | `lastValidationOk` 从 false → true | trigger fired；scanner 收集 + enqueue 前 N 条                      | 无变化       | n/a      | n/a                       | n/a                               | T1.4 + 集成测试    |
| 6   | 保存 key 后 probe 返回 auth                   | `lastValidationCode='auth'`        | 不触发；Sidebar 红点亮（B 已有）                                   | Sidebar 红点 | B 文案   | n/a                       | 用户重新保存 key                  | T1.4               |
| 7   | App 启动后切到一个无失败 segment 的 workspace | workspace ready ∧ enabled+ok       | trigger fired；scanner 返回空集合；queue 保持 idle                 | 无变化       | n/a      | n/a                       | n/a                               | T1.3 + T1.4        |
| 8   | App 启动后切到 50 个失败 segment 的 workspace | workspace ready ∧ enabled+ok       | trigger fired；scanner 收集 50；enqueue 前 N=20 条；剩余 30 等下次 | 无变化       | n/a      | n/a                       | 下次触发上升沿                    | T1.2 + T1.3 + T3.2 |
| 9   | 同一 workspace 重复 ready 事件                | workspace lifecycle 多次发         | once-per-ready guard，不重复 trigger                               | n/a          | n/a      | n/a                       | n/a                               | T1.4               |
| 10  | 凭证 clear                                    | apiKeyConfigured 从 true → false   | 不触发；如有 in-flight task 自然 fail-fast pre-flight              | 无变化       | n/a      | manifest 不动             | 用户重新保存 key 后下次触发上升沿 | T1.4 + 集成        |
| 11  | Workspace 切换中 trigger 触发                 | 切换过程中                         | trigger wiring 校验 workspace handle 仍 active；切换中不入队       | 无变化       | n/a      | 旧 workspace queue cancel | 新 workspace ready 后重新 trigger | T1.4 + 集成        |

### 1.3 手动触发边界

| #   | 场景                                      | 触发                         | 处理规则                                                                                   | 界面反馈                                                                                 | 建议文案                   | 数据保护规则  | 可恢复规则                      | 验收标准         |
| --- | ----------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------- | ------------- | ------------------------------- | ---------------- |
| 12  | 点击重试 → 立即可见反馈                   | 用户点 inline 「重试」       | renderer optimistic 进入 running；调 IPC                                                   | 按钮变「正在生成」灰文                                                                   | 「正在生成」               | n/a           | IPC 完成后状态自然恢复          | T2.5 + T2.6      |
| 13  | running 期间用户重复点击                  | 用户多次点击                 | 按钮已被 `running` 覆盖，不可点；renderer 集合 `manualRunningSegmentTargets` 内同 key 跳过 | 无副作用                                                                                 | n/a                        | n/a           | n/a                             | T2.6             |
| 14  | running 期间切换 Segment                  | 用户切到其他 Segment         | 不取消任务；切回后看到结果                                                                 | 当前 Segment 内 UI 立即随 cache 状态变化                                                 | n/a                        | n/a           | n/a                             | T2.6             |
| 15  | running 期间切换 Workspace                | 用户切到其他 workspace       | BackfillQueue.cancelAll；in-flight HTTP abort；renderer optimistic 被清理                  | 旧 workspace 的 running optimistic 直接清除；切换后用户不在原 workspace 视图，不弹 toast | n/a                        | manifest 不动 | 下次回到 workspace + 触发上升沿 | T2.6 + main test |
| 16  | running 期间 voice settings 被关闭        | 用户禁用                     | in-flight 继续执行（key 已解密拿到）；后续新 task pre-flight 失败                          | 当前任务正常返回；后续 manual 点击 fail-fast                                             | 「先在设置里启用语音识别」 | manifest 不动 | 用户重新启用                    | T2.2 + 集成      |
| 17  | manual 与 auto 同时涉及同 target          | scanner enqueue 后用户点重试 | 去重：手动检测 target 已在 queue → IPC 返回 `ERR_BACKFILL_ALREADY_RUNNING`                 | toast「该录音正在生成中，请稍候」                                                        | 「该录音正在生成中」       | manifest 不动 | 等 auto 完成自动看到结果        | T2.2             |
| 18  | 同 supplement 同 segment 多 supplement    | 不同 target                  | 独立任务，独立 optimistic                                                                  | 各自独立显示                                                                             | n/a                        | n/a           | n/a                             | T2.6             |
| 19  | IPC handler 抛 unhandled error            | 内部代码 bug                 | typed error envelope `ERR_BACKFILL_ENGINE_UNKNOWN`                                         | root toast                                                                               | 「补转录失败，请稍后重试」 | manifest 不动 | 用户重新点击                    | T2.2             |
| 20  | renderer optimistic 与 main response race | 用户点击后立即切换 Workspace | renderer detected workspace handle 已变；丢弃 in-flight optimistic                         | 静默清理                                                                                 | n/a                        | manifest 不动 | n/a                             | T2.6             |

### 1.4 队列 / breaker / batch cap 边界

| #   | 场景                                 | 触发                               | 处理规则                                                                                         | 界面反馈                  | 建议文案       | 数据保护规则      | 可恢复规则                      | 验收标准    |
| --- | ------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------- | -------------- | ----------------- | ------------------------------- | ----------- |
| 21  | 同一 batch 内连续 K 次 `auth` 失败   | 50 失败 segment + bad key          | breaker trip；丢弃剩余 auto enqueued；记录 `breaker-tripped` 诊断                                | 无可见 UI                 | n/a            | manifest 不动     | 下次触发上升沿 breaker 自动重置 | T3.2        |
| 22  | 同一 batch 内交替不同 errorCode 失败 | 部分 auth 部分 network             | 不 trip（计数按同 errorCode 连续）                                                               | n/a                       | n/a            | n/a               | n/a                             | T3.2        |
| 23  | 手动触发不受 breaker 限制            | breaker 已 trip 后用户点重试       | 手动 enqueue 仍接受，调 SeedASR AUC 2.0；若仍失败，breaker counter 不累加                        | 沿用 manual 路径          | 沿用           | n/a               | n/a                             | T3.2        |
| 24  | batch cap 后剩余 segment             | 50 个失败，N=20                    | 20 enqueue，30 留下；下次触发上升沿重新 scan + 入队                                              | 无 UI                     | n/a            | n/a               | 下次触发                        | T3.2        |
| 25  | scanner IO 失败                      | manifest 不可读                    | 抛 typed error，trigger wiring 记录诊断 `scan-failed`，queue 不入队                              | 无 UI                     | n/a            | n/a               | 下次触发上升沿重试              | T1.3        |
| 26  | task 内部 saveTranscript 失败        | manifest update / index refresh 错 | task 返回 errorCode；manifest 保持 'failed'（saveTranscript 失败时不推进 attempt）；breaker 计数 | 沿用 manual / auto        | 沿用           | manifest 保持原值 | 下次触发                        | T1.2 + T2.2 |
| 27  | task 调用期间 lock lost              | workspace 切换或外部 unmount       | abort；BackfillQueue 进 canceling；in-flight task 返回 ERR_BACKFILL_CANCELED                     | manual: toast；auto: 静默 | 「转录已取消」 | manifest 不动     | 下次触发                        | T1.2 + T2.2 |

### 1.5 录音并发边界

| #   | 场景                             | 触发                                    | 处理规则                                                             | 界面反馈                                      | 建议文案 | 数据保护规则 | 可恢复规则             | 验收标准 |
| --- | -------------------------------- | --------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------- | -------- | ------------ | ---------------------- | -------- |
| 28  | 录音中触发上升沿                 | 录音期间 ready 或 lastValidationOk 上升 | trigger wiring 检查 recording flow open，不 scan / 不入队            | 无                                            | n/a      | n/a          | 录音结束后下次自然触发 | T3.1     |
| 29  | 录音中用户手动点击               | 录音期间                                | manual enqueue 仍接受；BackfillQueue 在 pausing 状态；任务等录音结束 | 按钮变「正在生成」；UI 等录音结束后才看到结果 | n/a      | n/a          | 录音结束后自然出队     | T3.1     |
| 30  | 录音过程中 manual task in-flight | 录音开始前已 in-flight HTTP             | 不打断 in-flight；新 enqueue 等录音结束                              | 当前任务正常完成                              | n/a      | n/a          | n/a                    | T3.1     |
| 31  | 录音结束后 queue resume          | overlay close                           | 出队 / 继续执行；记录 `queue-resumed` 诊断                           | 无                                            | n/a      | n/a          | n/a                    | T3.1     |

### 1.6 lifecycle / 进程边界

| #   | 场景                                          | 触发             | 处理规则                                                                                                                | 界面反馈                  | 建议文案                                | 数据保护规则  | 可恢复规则                   | 验收标准 |
| --- | --------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------- | ------------- | ---------------------------- | -------- |
| 32  | app quit 期间 in-flight task                  | 用户关闭 Reo     | BackfillQueue.cancelAll('app-quit')；abort HTTP；不写 manifest                                                          | n/a                       | n/a                                     | manifest 不动 | 下次启动按 manifest 重新派生 | T1.6     |
| 33  | renderer process gone                         | renderer crash   | 同上                                                                                                                    | n/a                       | n/a                                     | n/a           | n/a                          | T1.6     |
| 34  | main process crash                            | 不可预知         | OS 终止；下次启动 manifest 仍 'failed'，下次触发自动重试                                                                | n/a                       | n/a                                     | manifest 不动 | 自然恢复                     | manual   |
| 35  | workspace switch 期间 BackfillQueue cancelAll | 用户切 workspace | abort + clear；新 workspace ready 后初始 trigger 重新 scan                                                              | n/a                       | n/a                                     | n/a           | 自然恢复                     | T1.6     |
| 36  | lock lost 期间 in-flight task                 | 外部抢 lock      | BackfillQueue.cancelAll('lock-lost')；abort；IPC 返回现有 `ERR_WORKSPACE_LOCK_LOST`（不映射成 `ERR_BACKFILL_CANCELED`） | manual: toast；auto: 静默 | 沿用 `ERR_WORKSPACE_LOCK_LOST` 既有文案 | manifest 不动 | n/a                          | T1.6     |

### 1.7 IPC / 安全边界

| #   | 场景                                              | 触发            | 处理规则                                         | 验收标准 |
| --- | ------------------------------------------------- | --------------- | ------------------------------------------------ | -------- |
| 37  | 非 trusted sender 调新 IPC                        | 模拟非法 sender | 拒绝；现有 `assertTrustedSender` 路径            | T2.2     |
| 38  | request payload schema 不合法                     | 缺字段 / 类型错 | Zod strict reject；typed error envelope          | T2.2     |
| 39  | workspaceHandle 已撤销                            | 旧 handle       | `requireHandle` 返回 lock-lost                   | T2.2     |
| 40  | request 中 workspaceId 与 handle workspace 不匹配 | 模拟篡改        | typed error envelope                             | T2.2     |
| 41  | 诊断写入 transcript text 字段                     | 调用方误传      | `backfillDiagnostics` 过滤为 `<redacted>` 或拒绝 | T1.5     |
| 42  | 诊断写入 X-Api-Key                                | 调用方误传      | 同上                                             | T1.5     |

### 1.8 性能 / 用户体验边界

| #   | 场景                            | 触发                       | 处理规则                                                    | 验收标准    |
| --- | ------------------------------- | -------------------------- | ----------------------------------------------------------- | ----------- |
| 43  | scanner 性能（大 workspace）    | 1000 + segment             | 单次 scan ≤ 200ms                                           | T1.3        |
| 44  | submit/query timeout            | 网络极慢或服务长时间处理中 | timeout → `network` errorCode；breaker 计数；下次重试       | T1.1 + T1.2 |
| 45  | renderer 重渲染（large Memory） | manual running set 变化    | 使用 immutable Set 引用稳定；不全量 re-render Memory Studio | T2.6        |
| 46  | reduced motion                  | 用户偏好                   | running 灰文静态；无 spinner；reduced motion 下无差异       | T2.5        |
| 47  | 主题切换（light / dark）        | 用户切主题                 | running 灰文使用 token `text-muted-foreground`；自动适配    | T2.5        |

### 1.9 工程边界

| #   | 场景                                         | 处理                                    |
| --- | -------------------------------------------- | --------------------------------------- |
| 48  | TypeScript strict 失败                       | 阻断 commit                             |
| 49  | renderer 测试退化                            | 阻断                                    |
| 50  | main 测试退化                                | 阻断                                    |
| 51  | lint / format check 失败                     | 阻断                                    |
| 52  | npm run verify:quick 失败                    | 阻断 spec 收口                          |
| 53  | preload 引入 Zod 或普通包                    | 阻断（违反 preload boundary）           |
| 54  | renderer 直接 import 'electron' 或 'fs'      | 阻断（违反 renderer security baseline） |
| 55  | 新增任何额外 IPC（除 2 个 backfill request） | 阻断（不在本 spec 范围）                |
| 56  | 新增任何 main → renderer 事件 channel        | 阻断（违反 brainstorm 共识）            |
| 57  | 修改 segment / supplement manifest schema    | 阻断（违反硬约束）                      |
| 58  | 新增 Query key                               | 阻断                                    |
| 59  | 新增 Zustand store                           | 阻断                                    |
| 60  | C-0 未通过即开始 C-1/C-2/C-3 实施            | 阻断 spec 收口                          |

## 2. 验收清单

### 2.1 C-0 验收

- [x] Context7 / 官方文档交叉验证 endpoint + resource id + body 编码，选型改为标准版 2.0 `volc.seedasr.auc`
- [ ] C-0b 本地音频 `audio.url` 交付方案通过，且不破坏本地优先与 Electron 安全边界
- [ ] X-Api-Key 同时支持 SAUC streaming + AUC 标准版 2.0 验证通过；本地官方 demo 的旧版双 key 代码不能替代新版控制台 smoke probe
- [ ] 标准版 2.0 单次时长上限覆盖 Reo 60min 录音
- [ ] probe 成本评估完成
- [ ] N 与 K 决定，写入 README.md `C-0 findings`
- [x] ADR 0005 选型与 gate 草案完成；C-0b 通过后补具体交付方案

### 2.2 代码事实

- [ ] `src/main/c0SeedAsrAucClient.ts` 实现 + 完整 errorCode 分类测试
- [ ] `src/main/backfillAudioUrlSource.ts` 实现 + URL 交付边界测试
- [ ] `src/main/backfillQueue.ts` 实现 + dedup + head-insert + pause/resume + cancel + breaker + batch cap 测试
- [ ] `src/main/backfillScanner.ts` 实现 + 性能 budget 测试
- [ ] `src/main/backfillTriggerWiring.ts` 实现 + once-per-ready 测试
- [ ] `src/main/backfillDiagnostics.ts` 实现 + allowlist 测试
- [ ] `src/main/voiceSettingsStore.ts` 增 `subscribeLastValidationOk` 窄 API
- [ ] `src/main/workspaceIpc.ts` 注册 2 个新 handler
- [ ] `src/workspace-contract/workspace-contract.ts` 新增 schema + 9 个错误码
- [ ] `src/preload/` 暴露 2 个新方法
- [ ] `src/renderer/src/workspace/workspaceApi.ts` 2 个 wrapper
- [ ] `src/renderer/src/workspace/SegmentTranscriptView.tsx` outcome `'running'`
- [ ] `src/renderer/src/workspace/MemoryStudio.tsx` 接 running set
- [ ] `src/renderer/src/App.tsx` 替换 placeholder + 持有 running set
- [ ] `src/renderer/src/workspace/workspaceErrorMessages.ts` 文案映射（9 个新 `ERR_BACKFILL_*`）
- [ ] `App.tsx` 删除 `showTranscriptionRetryPlaceholder` 与 `toast('转录引擎尚未上线')`
- [ ] 无新增 npm 依赖
- [ ] 无新增 Query key
- [ ] 无新增 Zustand store
- [ ] 无新增 `workspace:backfillEvent` 或类似事件 channel
- [ ] segment / supplement manifest schema 不变

### 2.3 文档事实

- [ ] `docs/current/electron.md`：2 个 IPC channel + 诊断 allowlist 追加
- [ ] `docs/current/flow.md`：BackfillQueue lifecycle + 触发上升沿 + recording pause + breaker + batch cap
- [ ] `docs/current/data.md`：renderer manual running state；不增 Query key；不增 Zustand
- [ ] `docs/current/frontend.md`：`SegmentTranscriptView` outcome `'running'`
- [ ] `docs/current/quality.md`：错误码 + 后台任务诊断 + main 测试覆盖
- [ ] `docs/decisions/0005-doubao-voice-file-asr-baseline.md` 写入并随 C-0b 更新

### 2.4 测试事实

- [ ] 所有阶段 1-3 新增测试通过
- [ ] `npm run verify:quick` 全绿
- [ ] backfillIntegration.test.ts 覆盖 batch cap + breaker
- [ ] 现有所有 B / voice / recording / Memory Studio 测试不退化

### 2.5 验收测试矩阵

| 编号 | 前置条件                                                 | 操作步骤                             | 预期页面结果                                     | 预期数据结果                         | 异常结果   | 验收方式        |
| ---- | -------------------------------------------------------- | ------------------------------------ | ------------------------------------------------ | ------------------------------------ | ---------- | --------------- |
| AC1  | 用户保存正确 key probe ok；workspace 有 3 个失败 segment | 等 trigger 自动 fire                 | UI 无变化；下次 visibility refresh 看到转录出现  | manifest 进入 'success'              | n/a        | 集成 + manual   |
| AC2  | 同 AC1，但 voice settings 关闭                           | 等                                   | UI 无变化                                        | manifest 不变                        | n/a        | 集成            |
| AC3  | 用户点击 inline 重试                                     | 点                                   | 按钮变「正在生成」；完成后变 transcript 正文     | manifest 进入 'success'              | n/a        | manual + 集成   |
| AC4  | 用户点击 inline 重试但 voice settings 关闭               | 点                                   | root toast「先在设置里启用语音识别」             | manifest 不变                        | toast 出现 | 集成            |
| AC5  | 用户点击 inline 重试但 key 错                            | 点                                   | root toast 错误文案；按钮回到失败可重试态        | manifest 不变                        | toast 出现 | 集成            |
| AC6  | 50 个失败 segment + bad key reproduce                    | 触发 trigger                         | 无可见 UI                                        | breaker trip；只 K 次 auth fail 计费 | 诊断写入   | 集成            |
| AC7  | running 期间用户切 workspace                             | 切                                   | toast「转录已取消」或静默回退                    | manifest 不变；in-flight HTTP abort  | n/a        | 集成 + manual   |
| AC8  | running 期间用户开始录音                                 | 开始录音                             | 队列暂停；录音结束后继续                         | manifest 在录音结束后才更新          | n/a        | 集成            |
| AC9  | 同 segment manual 与 auto 同时涉及                       | scanner enqueue auto；用户立即点重试 | toast「该录音正在生成中」                        | 不重复 enqueue                       | toast 出现 | 集成            |
| AC10 | reduced motion + 主题切换（light/dark）                  | 测                                   | running 灰文使用 token；无 spinner；主题切换正常 | n/a                                  | n/a        | 视觉手验 + 单元 |

## 3. 最终复核

- [ ] 基于最新 brainstorm 共识与 current docs 真源
- [ ] 每个状态都有产品说明和工程说明
- [ ] 包含完整状态机（target lifecycle + queue lifecycle）
- [ ] 包含 60 项边界情况
- [ ] 包含异常处理（schema reject / write failure / network / breaker / cancel / lock-lost）
- [ ] 包含数据规则（manifest 字段写入 owner、不引入新 Query key、不引入 Zustand）
- [ ] 包含权限规则（Reo 单用户；按 voice settings 与 workspace handle 校验）
- [ ] 包含验收标准（C-0、代码事实、文档事实、测试事实、AC 集成矩阵）
- [ ] README.md 末尾包含「最终目标总结」长段
- [ ] 内容可以直接复制给工程师（plan.md + tasks.md 可直接执行）
- [ ] 未跨越 C 范围进入 D 实施
- [ ] 未跨越 C 范围引入 manifest schema 扩展或新 Query key

## 4. 收口产出物（spec 进 archive 时必须存在）

- 本目录 5 个文件（README / goal / plan / tasks / verification）保持完整
- `docs/current/electron.md` / `flow.md` / `data.md` / `frontend.md` / `quality.md` 已同批更新
- `docs/decisions/0005-doubao-voice-file-asr-baseline.md` 已写入并随 C-0b 更新
- `docs/initiatives/2026-05-16-doubao-voice-followups/tasks.md` C 行从 `[ ]` 改为 `[x]` + 归档路径
- 进入 archive：`docs/archive/specs/2026-05-17-0029-doubao-voice-auto-backfill/`

## 5. 后续 D spec 接通点

- D 必须复用本 spec 落地的 2 个手动触发 IPC，不新增 transcript-write IPC
- D 的 `生成转录` / `重新生成转录` 菜单项的 callback 直接调本 spec 的 renderer wrapper
- D 的 AlertDialog 确认在调 wrapper 之前；wrapper 之后状态完全由 BackfillQueue 与 manualRunning set 接管

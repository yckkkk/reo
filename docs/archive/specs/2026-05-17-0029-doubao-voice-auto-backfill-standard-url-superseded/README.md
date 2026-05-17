# 豆包语音自动补转录（C）

- 时间：2026-05-17 00:29 America/Los_Angeles
- 归档状态：superseded。该标准版 2.0 `audio.url` / TOS staging 方案不满足 Reo 当前普通个人用户只配置 `X-Api-Key` 的产品约束。C 交付证据归档在 `docs/archive/specs/2026-05-17-0512-doubao-voice-auto-backfill-turbo/`。
- 来源 initiative：`docs/initiatives/2026-05-16-doubao-voice-followups/`
- 本 spec 类别：跨数据模型 + IPC + 前端 + 主进程后台任务的功能 spec
- 范围：C-0 SeedASR AUC 2.0 引擎基线与本地音频 URL 交付 gate（Phase 0 / Gate 0）；C-1 BackfillQueue + scanner + 触发上升沿；C-2 手动触发 IPC 与 B inline 重试的真实接通；C-3 录音暂停、circuit breaker 与诊断

## 信息优先级

输入冲突时按以下顺序解释：

1. 用户在本次 brainstorm 中确认的 4 项核心决策（见下文「Brainstorm 共识」）
2. `docs/current/*` 当前真源（electron / data / flow / frontend / quality）
3. 已归档 spec / ADR：
   - `docs/decisions/0004-doubao-voice-asr-endpoint-baseline.md`
   - `docs/archive/specs/2026-05-16-1806-doubao-voice-unfinished-visualization/`
   - `docs/archive/specs/2026-05-16-1720-doubao-voice-endpoint-billing-audit/`
   - `docs/archive/specs/2026-05-16-0605-doubao-voice-byok-settings/`
4. 现有源码事实（`voiceSettingsStore.ts`、`voiceTranscriptionProbe.ts`、`recordingTranscriptionSessions.ts`、`memoryFiles.ts`、`workspaceIpc.ts`、`App.tsx`、`SegmentTranscriptView.tsx`、`MemoryStudio.tsx`）
5. initiative `c-brief.md` 中的早期判断；本 spec 与 brief 冲突时以本 spec 为准
6. 本文档内的早期判断与新信息冲突时，以最新版本为准

## Brainstorm 共识（本 session 已和用户确认）

1. C 本轮目标锁在「按 c-brief 原样推进 auto-backfill」整段范围；内部仍按 Phase 0 / Gate 0 推进，C-0 未通过禁止实施 C-1/C-2/C-3。
2. 手动触发（B inline 重试 + 未来 D More 菜单）与自动 BackfillQueue 共享同一 FIFO，但手动**插入队首**，不抢占 in-flight 任务。
3. 任务 running 中间态**不**实时同步到 renderer；不新增 `workspace:backfillEvent` callback channel；中间态由 renderer 本地 optimistic state 表达（仅手动触发持有 optimistic，自动任务对 UI 静默）。
4. 成本爆炸保护：同一次触发上升沿设置 batch 上限 + 同 batch 同 error code 连续失败 K 次触发 connection-failure circuit breaker；breaker 是 main process 运行时态，不持久化到 manifest；手动触发不受 breaker 限制。

## 范围（in-scope）

- C-0 探针：标准版 2.0 `volc.seedasr.auc` 可用性 + key 复用 + `audio.url` 本地音频交付方案 + 轮询上限，并新增 ADR 0005
- C-1 main 侧后台引擎：`c0SeedAsrAucClient` + `backfillQueue` + `backfillScanner` + `backfillTriggerWiring`
- C-2 两个新 IPC channel（手动触发）：
  - `workspace:requestSegmentTranscriptionBackfill`
  - `workspace:requestSegmentSupplementTranscriptionBackfill`
- C-3 录音中暂停队列、circuit breaker、batch cap、main 本地诊断
- B inline 重试 callback 真实化：替换 `App.tsx` 当前的 `showTranscriptionRetryPlaceholder`，接入新 IPC
- `SegmentTranscriptView` outcome 模型新增 `kind: 'running'`，覆盖重试按钮
- 同批更新 `docs/current/electron.md`、`flow.md`、`data.md`、`frontend.md`、`quality.md`
- 同批补 9 个新 `ERR_BACKFILL_*` 用户可见文案到 `src/renderer/src/workspace/workspaceErrorMessages.ts`

## 范围外（out-of-scope）

- D 的 Segment / SegmentSupplement More 菜单「生成转录」「重新生成转录」入口
- 任务可取消按钮 / 进度条
- 长音频进度可视化
- 跨 workspace 后台任务
- 凭证 clear 时主动清理已 enqueue 任务（由 pre-flight check 自然 fail-fast 覆盖）
- 用户编辑 transcript 文本能力
- segment / supplement manifest schema 扩展（不引入 `retryCount`、`lastTranscriptionError`、backoff timestamp）
- 极速版 `volc.bigasr.auc_turbo` 作为默认引擎
- 在未通过 C-0 URL 交付 gate 前直接实施 C-1/C-2/C-3
- 失败次数上限 / 永久 disable（不在 manifest 中持久化失败计数）

## 硬约束（不可破坏）

- 单 active workspace scope；切换 workspace 取消未完成任务
- 串行 FIFO（concurrency=1）
- 不引入环境变量凭证、双 header 鉴权或平台密钥路径
- 不动现有 `workspace:saveTranscript` / `workspace:saveSegmentSupplementTranscript` IPC contract；C 任务成功后调用现有 IPC，靠 manifest update 同步置 `'success'`
- 不破坏 single-active-spec 规则；本 spec 完成归档后才能开 D
- 不引入 `workspace:backfillEvent` 或任何新 main→renderer 事件 channel
- 不扩展 segment / supplement manifest schema
- 不新增 Query key
- 不引入 Zustand store（按 `frontend.md`「当前没有 Zustand stores」基线，optimistic state 留在 feature-local component state）
- 不放松 Electron sandbox、contextIsolation、CSP、permission 边界
- 不在 main process 起公开 HTTP 服务、不开公网隧道、不把本地 `.reo` 音频目录暴露给火山服务器
- 不默认引入对象存储上传；若 C-0 选择用户配置对象存储，必须先单独记录本地优先与隐私边界
- 任何新 endpoint / SDK 调用前必须先用 Context7 查询官方文档；Context7 无覆盖时使用官方站点 / 源码 / 包内文档并在 c0-findings 段记录依据

## C-0 findings（2026-05-17）

本 session 已完成官方文档调研，结论用于修订本 spec，不进入产品实施。

| 能力          | 录音文件极速版 `volc.bigasr.auc_turbo`                                                                              | 录音文件识别标准版 2.0 `volc.seedasr.auc`                                                                  | 录音文件识别闲时版 `volc.bigasr.auc_idle`                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 调用模型      | 同步一次请求返回，`POST /api/v3/auc/bigmodel/recognize/flash`                                                       | 异步 submit/query，`POST /api/v3/auc/bigmodel/submit` + `POST /api/v3/auc/bigmodel/query`                  | 异步 idle submit/query，`POST /api/v3/auc/bigmodel/idle/submit` + `POST /api/v3/auc/bigmodel/idle/query` |
| audio 输入    | `audio.url` 或 `audio.data` base64 二选一                                                                           | `audio.url` 必填                                                                                           | `audio.url`，同标准版请求体                                                                              |
| 格式          | WAV / MP3 / OGG OPUS；音频大小不超过 100MB；上传二进制流建议 20MB 以内                                              | `format` 必填：raw / wav / mp3 / ogg；`codec` 可为 raw / opus；音频时长小于 5 小时且文件小于 512MB         | 格式 / 时长 / 大小同标准版                                                                               |
| 模型族        | BigASR 1.0，跨族                                                                                                    | SeedASR 2.0，与 Reo live streaming 同族                                                                    | BigASR 1.0，跨族                                                                                         |
| 鉴权          | 新版控制台支持 `X-Api-Key` + `X-Api-Resource-Id: volc.bigasr.auc_turbo` + `X-Api-Request-Id` + `X-Api-Sequence: -1` | 新版控制台使用同一 `X-Api-Key` 形态，resource id 为 `volc.seedasr.auc`；submit/query 共用 request id       | 官方示例仍以旧 header 为主，resource id 为 `volc.bigasr.auc_idle`                                        |
| 价格判断      | 官方计费页显示极速版后付费高于标准版 2.0；用户明确拒绝作为 C 默认                                                   | 官方计费页显示标准版 2.0 后付费低于极速版；用户指定为 C 基线                                               | 价格低于极速版，但最长 24h 返回，且仍是 URL-only 与跨族                                                  |
| 对 Reo 可行性 | 可用 base64 绕开公网 URL，但贵且跨族；不选                                                                          | 成本和质量一致性最好；硬阻断是 `audio.url` 需要火山可访问音频 URL                                          | 不适合 inline retry 的用户反馈时效；不解决 URL-only；不选                                                |
| 对接复杂度    | sync HTTP 最简单；需确认 WebM 是否被接受或先 remux/transcode                                                        | submit + poll 可接受；BackfillQueue 对外仍同步 await；需要新增轮询间隔、总超时、processing/queued 状态处理 | submit + poll 且 24h SLA，不适合当前 C                                                                   |

选型结论：C 的引擎基线改为标准版 2.0 `volc.seedasr.auc`。极速版 `volc.bigasr.auc_turbo` 仅作为被评估后拒绝的方案，不再作为默认实现路径。C-0 剩余 gate 是本地音频 URL 交付方案：在不公开本地服务、不绕过 Electron 安全边界、不默认把用户本地录音上传到未配置对象存储的前提下，确定火山服务器如何读取 Reo 的 finalized `audio.webm`。该 gate 未通过前，C-1/C-2/C-3 仍不得实施。

依据：

- Context7 `/websites/volcengine_6561`：`POST /api/v3/auc/bigmodel/recognize/flash` 支持 `audio.url` 或 `audio.data` base64；标准版 2.0 `submit/query` 使用 `volc.seedasr.auc`，`audio.url` 必填。
- 火山官方文档 `https://www.volcengine.com/docs/6561/1631584?lang=zh`：极速版同步返回，`audio.url` 与 `audio.data` 二选一，限制包含 2h / 100MB / WAV-MP3-OGG OPUS。
- 火山官方文档 `https://www.volcengine.com/docs/6561/1354868?lang=zh`：标准版 submit/query，resource id 包含 `volc.seedasr.auc`，请求字段要求 `audio.url` 与 `format`。
- 火山官方文档 `https://www.volcengine.com/docs/6561/1840838?lang=zh`：闲时版 24h 内返回，resource id `volc.bigasr.auc_idle`，请求体沿用标准版 URL。
- 火山官方计费页 `https://www.volcengine.com/docs/6561/1359370?lang=zh`：标准版 2.0 的小时单价低于大模型录音文件极速版；具体价格以后续官方页面为准。
- 本地官方 demo 副本 `/Users/yck/Downloads/PM/技术线/reo文件区/auc_python`：`auc_http_demo.py` 是 submit/query 形态，但仍使用旧版 `X-Api-App-Key` + `X-Api-Access-Key` 与 `volc.bigasr.auc`；脚本注释写明新版控制台只需要 app key、不需要 access key。因此它不能作为新版标准版 2.0 客户端代码基线，只能作为旧版 / BigASR 示例和 key 形态补充证据；C-0 smoke 仍必须验证当前 Reo 的 X-Api-Key 可同时用于 SAUC streaming 与 AUC 标准版 2.0。

## 最终目标总结（可放在研发任务顶部）

本 spec 的最终交付是：让 Reo 用户在凭证恢复（保存 X-Api-Key probe ok）、Reo 启动后切换到有失败转录的 workspace、或当前 workspace ready 时，所有「上次系统失败、转录仍空」的 finalized audio segment 与 SegmentSupplement 在用户无感知的情况下按串行 FIFO 后台自动补齐转录；同时让 Memory Studio 内已有的 B inline「重试」按钮（以及未来 D 的 More 菜单入口）真实可用——点击后 renderer 显示「正在生成」覆盖按钮，任务插到 BackfillQueue 队首，main 同步等待完成，成功后通过现有 `workspace:saveTranscript` / `workspace:saveSegmentSupplementTranscript` 写回 transcript 文本与把 manifest `lastTranscriptionAttempt` 置为 `'success'`，失败时 root toast 显示脱敏错误信封并把 transcript view 退回失败可重试态。后台引擎选择火山引擎大模型录音文件识别标准版 2.0：`POST /api/v3/auc/bigmodel/submit` + `POST /api/v3/auc/bigmodel/query` + `volc.seedasr.auc`；BackfillQueue 内单 task 执行 submit + poll，对外仍保持同步 await 的 IPC 语义。C-0 必须先解决本地 finalized audio 到 `audio.url` 的交付 gate，并验证同一 X-Api-Key 对 SAUC streaming 与 AUC 2.0 都可用、轮询状态码与超时策略正确、音频格式与 Reo WebM/Opus 的转换或投递路径可行。任务持有当前 active `workspaceHandle`，切换 workspace / lock lost / app quit 即中断 in-flight submit/query 并清空队列；录音中暂停队列但不取消、不入队 auto 任务；同一次触发上升沿最多 enqueue N 个任务（C-0 后定 N，建议 20）；同 batch 内同 error code 连续 K 次失败（建议 K=3）触发 circuit breaker，丢弃剩余 auto enqueued tasks，等待下次触发上升沿。手动触发不受 batch cap 与 circuit breaker 限制，因为它来自用户明确意图。本 spec 不引入任何新 main→renderer 事件 channel、不扩展 segment / supplement manifest schema、不新增 Query key、不引入 Zustand store。新增的唯一外部依赖是 C-0 验证后的 SeedASR AUC 2.0 客户端实现与音频 URL 交付适配，新增的 IPC 是 2 个手动触发 channel；自动任务对 renderer 完全静默，由下一次 Workspace snapshot visibility refresh 或同 segment content Query 失效后看到 transcript 出现。验收依据 `verification.md`：scanner 正确收集 failed-eligible 集合、串行队列正确执行、submit/query 成功后调 saveTranscript 同步置 manifest `'success'` 与失败时保留 manifest `'failed'`、workspace 切换正确取消、录音中正确暂停、手动同 target 去重且不抢占、batch cap 与 circuit breaker 防止成本爆炸、main 本地诊断按 `[reo-diagnostic]` 允许 list 写入、TypeScript strict 与 `npm run verify:quick` 全绿；本 spec 与 `docs/current/electron.md` / `docs/current/flow.md` / `docs/current/data.md` / `docs/current/frontend.md` / `docs/current/quality.md` 必须在收口时同批更新；C-0 长期结论写入 ADR 0005。

## 文件入口

- 产品功能说明：`goal.md`
- 工程实现说明 + 状态机 + 组件元素 + IPC contract：`plan.md`
- 实施清单（TDD 顺序）：`tasks.md`
- 边界情况补齐 + 验收清单 + 最终复核：`verification.md`

## Readiness gate

B→C readiness gate 已在 initiative `plan.md` 完成（仅一次）。本 spec 创建已满足该 gate；C→D readiness gate 在 C 归档后单独执行。

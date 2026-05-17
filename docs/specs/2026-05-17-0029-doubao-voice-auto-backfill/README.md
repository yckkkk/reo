# 豆包语音自动补转录（C）

- 时间：2026-05-17 00:29 America/Los_Angeles
- 来源 initiative：`docs/initiatives/2026-05-16-doubao-voice-followups/`
- 本 spec 类别：跨数据模型 + IPC + 前端 + 主进程后台任务的功能 spec
- 范围：C-0 离线 flash endpoint 探针（Phase 0 / Gate 0）；C-1 BackfillQueue + scanner + 触发上升沿；C-2 手动触发 IPC 与 B inline 重试的真实接通；C-3 录音暂停、circuit breaker 与诊断

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

- C-0 探针：离线 flash endpoint 可用性 + key 复用 + 单次时长上限 + 是否需要异步回落，并扩展 ADR 0004 或新增 ADR 0005
- C-1 main 侧后台引擎：`c0FlashClient` + `backfillQueue` + `backfillScanner` + `backfillTriggerWiring`
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
- 异步 `submit` / `query` 回落（视 C-0 findings 在新 spec 决定）
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
- 任何新 endpoint / SDK 调用前必须先用 Context7 查询官方文档；Context7 无覆盖时使用官方站点 / 源码 / 包内文档并在 c0-findings 段记录依据

## 最终目标总结（可放在研发任务顶部）

本 spec 的最终交付是：让 Reo 用户在凭证恢复（保存 X-Api-Key probe ok）、Reo 启动后切换到有失败转录的 workspace、或当前 workspace ready 时，所有「上次系统失败、转录仍空」的 finalized audio segment 与 SegmentSupplement 在用户无感知的情况下按串行 FIFO 后台自动补齐转录；同时让 Memory Studio 内已有的 B inline「重试」按钮（以及未来 D 的 More 菜单入口）真实可用——点击后 renderer 显示「正在生成」覆盖按钮，任务插到 BackfillQueue 队首，main 同步等待完成，成功后通过现有 `workspace:saveTranscript` / `workspace:saveSegmentSupplementTranscript` 写回 transcript 文本与把 manifest `lastTranscriptionAttempt` 置为 `'success'`，失败时 root toast 显示脱敏错误信封并把 transcript view 退回失败可重试态。后台引擎使用火山引擎离线极速版 `POST /api/v3/auc/bigmodel/recognize/flash` + `volc.bigasr.auc_turbo`（C-0 探针必须先确认 endpoint 可用、与 SAUC streaming 共用同一 X-Api-Key 合法、单次音频时长上限覆盖典型 Reo 录音、是否需要异步回落），任务持有当前 active `workspaceHandle`，切换 workspace / lock lost / app quit 即中断 in-flight HTTP 并清空队列；录音中暂停队列但不取消、不入队 auto 任务；同一次触发上升沿最多 enqueue N 个任务（C-0 后定 N，建议 20）；同 batch 内同 error code 连续 K 次失败（建议 K=3）触发 circuit breaker，丢弃剩余 auto enqueued tasks，等待下次触发上升沿。手动触发不受 batch cap 与 circuit breaker 限制，因为它来自用户明确意图。本 spec 不引入任何新 main→renderer 事件 channel、不扩展 segment / supplement manifest schema、不新增 Query key、不引入 Zustand store。新增的唯一外部依赖是 C-0 验证后的离线 flash engine 客户端实现，新增的 IPC 是 2 个手动触发 channel；自动任务对 renderer 完全静默，由下一次 Workspace snapshot visibility refresh 或同 segment content Query 失效后看到 transcript 出现。验收依据 `verification.md`：scanner 正确收集 failed-eligible 集合、串行队列正确执行、HTTP 成功后调 saveTranscript 同步置 manifest `'success'` 与失败时保留 manifest `'failed'`、workspace 切换正确取消、录音中正确暂停、手动同 target 去重且不抢占、batch cap 与 circuit breaker 防止成本爆炸、main 本地诊断按 `[reo-diagnostic]` 允许 list 写入、TypeScript strict 与 `npm run verify:quick` 全绿；本 spec 与 `docs/current/electron.md` / `docs/current/flow.md` / `docs/current/data.md` / `docs/current/frontend.md` / `docs/current/quality.md` 必须在收口时同批更新；C-0 长期结论压缩进 ADR 0004 扩展段或新 ADR 0005。

## 文件入口

- 产品功能说明：`goal.md`
- 工程实现说明 + 状态机 + 组件元素 + IPC contract：`plan.md`
- 实施清单（TDD 顺序）：`tasks.md`
- 边界情况补齐 + 验收清单 + 最终复核：`verification.md`

## Readiness gate

B→C readiness gate 已在 initiative `plan.md` 完成（仅一次）。本 spec 创建已满足该 gate；C→D readiness gate 在 C 归档后单独执行。

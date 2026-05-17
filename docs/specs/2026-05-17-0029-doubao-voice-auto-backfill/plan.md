# 工程实现说明 + 状态机 + 组件元素 + IPC contract（C）

## 0. n/a 一次性声明

以下能力是 Reo 当前未引入或与 C 无关的项目；本 spec 一次性声明 n/a，不再在各节重复：

- Better Auth：Reo 当前没有 auth lifecycle；C 不引入登录、角色或权限校验。
- Drizzle ORM / better-sqlite3：Reo 当前没有 DB layer；C 不引入表、迁移、本地数据库读写。
- Sentry：Reo 当前未初始化 Sentry；C 只使用 `electron-log/main` 本地诊断。
- electron-updater / Electron Forge packaging：与 C 无关；不动。
- 多人协作 / 多端同步：Reo 单用户本机；C 不引入冲突解决、合并、同步队列。
- 多窗口：当前默认单 BrowserWindow；C 不解决多窗口任务调度。
- 文件上传 / 文件导入导出：与 C 无关。
- 角色权限 / 审批：与 C 无关。
- 数据看板 / 操作日志表 / 审计日志表：与 C 无关。

## 1. 信息优先级与来源

详见 README.md 的「信息优先级」与「Brainstorm 共识」段。

## 2. 数据模型变更

### 2.1 segment manifest / supplement manifest schema

**不变**。C 不扩展 `segmentObjectManifestSchema` 或 `supplementObjectManifestSchema`，复用 B 已落地的 `lastTranscriptionAttempt` optional 字段。失败次数 / backoff timestamp / 错误码不写入 manifest；circuit breaker 与 batch cap 均为 main 运行时态。

### 2.2 finalize / saveTranscript projection

**不变**。`FinalizedAudioSegmentProjection` 与 `FinalizedAudioSegmentSupplementProjection` 字段集与 B 一致。

### 2.3 `.reo/index.json` Memory summary

**不变**。C 任务成功后 saveTranscript 自动按现有规则刷新所属 Memory 的 index entry；不重复扫描全 workspace。

## 3. 主进程组件（C-1 引擎）

```
src/main/
  c0SeedAsrAucClient.ts       # 单文件；HTTPS submit/query；no concurrency；AbortController
  backfillAudioUrlSource.ts   # C-0b 通过后才实现；把 finalized audio 转成火山可访问 URL
  backfillQueue.ts            # 串行 FIFO queue；持有 workspaceHandle scope；breaker + batch cap 计数器
  backfillScanner.ts          # 扫描当前 active workspace 内 eligible segment + supplement
  backfillTriggerWiring.ts    # 监听 voiceSettingsStore + workspace lifecycle 上升沿
  backfillDiagnostics.ts      # 复用 electron-log/main，包装允许 list 写入
```

并对应 main test 文件：

```
src/main/__tests__/
  c0SeedAsrAucClient.test.ts
  backfillAudioUrlSource.test.ts
  backfillQueue.test.ts
  backfillScanner.test.ts
  backfillTriggerWiring.test.ts
```

### 3.1 `c0SeedAsrAucClient.ts`

**职责**：对火山大模型录音文件识别标准版 2.0 执行 submit + query 轮询，并解析 response 成 `{ ok: true, transcriptText } | { ok: false, errorCode, message? }`。

**接口**（示意）：

```ts
type SeedAsrAucRequest = {
  apiKey: string;
  audioUrl: string;
  audioFormat: 'raw' | 'wav' | 'mp3' | 'ogg';
  audioCodec?: 'raw' | 'opus';
  abortSignal: AbortSignal;
  submitTimeoutMs: number; // C-0 决定
  pollIntervalMs: number; // C-0 决定，初始建议 5000
  pollTimeoutMs: number; // C-0 决定，覆盖 Reo 60min 内典型补转录
};

type SeedAsrAucResult =
  | { ok: true; transcriptText: string }
  | {
      ok: false;
      errorCode: 'auth' | 'network' | 'format' | 'rate-limit' | 'empty-audio' | 'quota' | 'unknown';
      message?: string;
    };

declare function callSeedAsrAuc(req: SeedAsrAucRequest): Promise<SeedAsrAucResult>;
```

**实现要点**：

- endpoint：submit `POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit`；query `POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/query`
- header：新版控制台使用单 `X-Api-Key` + `X-Api-Resource-Id: volc.seedasr.auc` + `X-Api-Request-Id` + `X-Api-Sequence: -1`；submit 与 query 使用同一 request id
- submit body：`audio.url` 必填，`audio.format` 必填（raw / wav / mp3 / ogg），`audio.codec` 按 format 需要传入；`request.model_name='bigmodel'`
- query body：空 JSON `{}`；轮询 header 继续携带同一 request id
- 轮询处理：
  - `X-Api-Status-Code=20000000` → 读取 body `result.text`
  - `20000001` / `20000002` → 等待 `pollIntervalMs` 后继续 query
  - 超过 `pollTimeoutMs` → `network`
- 错误分类：
  - HTTP 401/403 或 body 显式 auth 错误 → `auth`
  - HTTP 429 → `rate-limit`
  - HTTP 5xx / network error / timeout / TLS / DNS → `network`
  - `45000002` → `empty-audio`
  - `45000131` → `quota`
  - `45000132` → `format`（文件过大按当前错误码体系归入格式/请求边界，文案说明大小限制）
  - `45000151` → `format`
  - body schema invalid / 非 JSON / 缺 transcript 字段 → `format`
  - 其它 → `unknown`
- 不实现重试；上层 BackfillQueue 决定是否重试
- 单文件 ≤ 250 LOC

### 3.1a `backfillAudioUrlSource.ts`

**职责**：在 C-0b 通过后，负责把 Reo finalized audio 转成火山服务器可访问的 `audio.url`。本文件当前是设计落点，不允许在未通过 gate 时实现。

**当前未决 gate**：

- Reo durable audio 是本地 `audio.webm`（MediaRecorder WebM/Opus）。
- 标准版 2.0 请求要求 `audio.url`，火山服务器无法读取本地文件路径。
- 标准版 2.0 支持的容器是 raw / wav / mp3 / ogg，不列 WebM；若继续使用 Opus，优先评估 WebM/Opus remux 到 OGG/Opus，而不是重编码；如果官方或实际 probe 不接受 OGG/Opus，再评估 WAV/MP3 转码成本。
- 禁止方案：main process 起公开 HTTP 服务、ngrok 风格公网隧道、放松 Electron 安全边界、默认把用户本地音频上传到未配置对象存储。
- 可继续评估的方案：用户显式配置的对象存储临时 URL、火山官方可接受的本地字节上传替代接口（当前标准版 2.0 文档未发现）、或暂停 C 等待官方字节路径。

**通过标准**：C-0b 必须产出一个不会破坏本地优先与安全边界的 `audio.url` 交付方案，并写入 ADR 0005 的 Implementation Gate 段；否则 C-1/C-2/C-3 暂停。

### 3.2 `backfillQueue.ts`

**职责**：串行 FIFO，concurrency=1。持有当前 active `workspaceHandle`、main 内运行时 batch counter、circuit breaker counter。

**接口**（示意）：

```ts
type BackfillTask =
  | {
      kind: 'segment';
      workspaceHandle: WorkspaceHandle;
      workspaceId: string;
      memoryId: string;
      segmentId: string;
      source: 'auto' | 'manual';
    }
  | {
      kind: 'supplement';
      workspaceHandle: WorkspaceHandle;
      workspaceId: string;
      memoryId: string;
      segmentId: string;
      supplementId: string;
      source: 'auto' | 'manual';
    };

type EnqueueResult =
  | { accepted: true; position: number }
  | { accepted: false; reason: 'duplicate' | 'queue-canceled' | 'workspace-mismatch' };

interface BackfillQueue {
  enqueue(task: BackfillTask, options: { insertAtHead: boolean }): EnqueueResult;
  awaitTask(task: BackfillTask): Promise<BackfillRunResult>;
  pause(reason: 'recording'): void;
  resume(reason: 'recording'): void;
  cancelAll(reason: 'workspace-switch' | 'lock-lost' | 'app-quit'): void;
}
```

**实现要点**：

- 内部维护 deque（head insert vs tail insert）
- 同 target（按 kind + workspaceId + memoryId + segmentId + supplementId 复合 key）去重；duplicate 直接返回 accepted=false
- pause 期间不出队但允许 enqueue
- cancel 期间 abort 当前 in-flight submit/query（通过 c0SeedAsrAucClient AbortController）并清空 deque
- batch cap：scanner 触发的 batch enqueue 一次性最多 N 条；超出忽略并写诊断 `batch-capped`
- circuit breaker：同 batch 内 same errorCode 连续 K 次 → trip，丢弃剩余 auto enqueued，写诊断 `breaker-tripped`；breaker 不影响 manual enqueue
- breaker / batch cap counter 在下一次 trigger 上升沿时重置

### 3.3 `backfillScanner.ts`

**职责**：在 active workspace 内收集 eligible 集合。

**接口**（示意）：

```ts
type EligibleTarget =
  | { kind: 'segment'; workspaceId: string; memoryId: string; segmentId: string; updatedAt: string }
  | {
      kind: 'supplement';
      workspaceId: string;
      memoryId: string;
      segmentId: string;
      supplementId: string;
      updatedAt: string;
    };

declare function collectEligibleTargets(
  workspaceHandle: WorkspaceHandle,
  limit: number
): Promise<ReadonlyArray<EligibleTarget>>;
```

**实现要点**：

- 复用现有 Memory detail projection 路径：从 `.reo/index.json` + Memory file truth 派生
- 不重新读全部 manifest；只读 projection 即可判定 `lastTranscriptionAttempt='failed' ∧ transcript.exists=false`
- 按 `updatedAt desc` 排序，取前 `limit` 条
- scan 中如果 lock lost 立即抛 typed error，回 `idle` 不入队
- 单次 scan 时间预算：≤ 200ms（即使 Memory 大量），通过测试覆盖

### 3.4 `backfillTriggerWiring.ts`

**职责**：监听两类触发上升沿，调用 scanner + queue.enqueue。

**两类上升沿**：

1. **凭证保存上升沿**：监听 `voiceSettingsStore` snapshot 变化；`lastValidationOk` 从 false → true 时触发；同时要求 `enabled ∧ apiKeyConfigured` 为 true
2. **Workspace ready 上升沿**：每次 workspace handle 注册成功 且 voiceSettings `enabled ∧ apiKeyConfigured ∧ lastValidationOk=true` 时触发一次

**实现要点**：

- 同一 workspace 同次 ready 只触发一次（避免重复 scan）
- 凭证 clear 不触发；`lastValidationCode='auth'` 也不触发
- voice settings 自身变化的回调挂在 store；`src/main/voiceSettingsStore.ts` 当前不暴露 subscribe API，需要新增窄 export：`onSnapshotChange(listener: (snapshot: VoiceSettingsSnapshot) => void): () => void`；listener 在 main thread 同步触发，调用方按 `lastValidationOk` 上升沿过滤；该 export 是「读取扩展」，不改 saveApiKey / validate / clearApiKey / setEnabled 现有 contract
- 触发后调用 `scanner.collectEligibleTargets(handle, BATCH_CAP_N)` → 批量 `queue.enqueue(task, { insertAtHead: false })`
- trigger wiring 自身**不**检查 recording flow；recording flow 的暂停由 BackfillQueue.pause/resume 处理（scan 与 enqueue 可在录音中发生，但 dequeue 被暂停）

### 3.5 `backfillDiagnostics.ts`

**职责**：包装现有 `src/main/diagnostics.ts` 的 `recordDiagnosticEvent` API，按现有 `area` + `event` + `fields` 三元组写入；不引入独立 sanitizer。

**约定**：

- `area: 'backfill'`
- `event` 是自由字符串，建议使用：`trigger-fired`、`scan-started`、`scan-completed`、`scan-failed`、`batch-capped`、`task-started`、`task-succeeded`、`task-failed`、`breaker-tripped`、`queue-paused`、`queue-resumed`、`queue-canceled`；event 名编码来源（如 `task-succeeded-auto` / `task-succeeded-manual`）以避免新增 `source` 字段
- 允许字段：
  - `errorCode`（来自现有 `workspaceErrorCodeSchema`，含本 spec 新增 8 个 `ERR_BACKFILL_*`；通过现有 `SAFE_ERROR_CODES` sanitizer 保留）
  - `taskCount`（number；现有 sanitizer 直接保留 finite number）
  - `durationMs`（number；同上）
- 其它字段（`workspaceId`、segment id 等）经现有 `sanitizeDiagnosticFields` 自动 mask 为 `[string:N]`；spec 不要求 workspace 身份在诊断中以原文出现
- **禁止**写入：transcript text、X-Api-Key 任何形式、raw path、segment / supplement title、用户输入（均由现有 `SENSITIVE_FIELD_PATTERNS` 自动 `[redacted]`）

## 4. IPC contract（新增 2 个 channel）

### 4.1 `workspace:requestSegmentTranscriptionBackfill`

**Request DTO**：

```ts
type WorkspaceRequestSegmentTranscriptionBackfillRequest = {
  workspaceHandle: WorkspaceHandle;
  workspaceId: string;
  memoryId: string;
  segmentId: string;
};
```

**Response DTO**：成功时复用现有 `WorkspaceRecordingMarkdownSaveResponse`（即 `workspace:saveTranscript` 的 response 类型）；本 spec 不引入新 response shape。失败时返回 typed error envelope，错误码定义在下文。

**Handler 行为**：

1. trusted sender 校验
2. handle ownership + workspaceId match + lock usability 校验（沿用现有 `requireHandle` + `assertWorkspaceUsable`）
3. voice settings pre-flight：enabled + apiKeyConfigured 必须 true；否则 fail-fast，不计 breaker
4. target identity 校验：按 `segmentId` 解析 finalized segment 文件空间节点；不存在或 unsafe → typed error
5. enqueue task `{ source: 'manual' }`，`insertAtHead: true`
6. **同步 await** task 完成
7. task 成功 → 内部调 `saveTranscript`（main-only 函数，不经过 IPC dispatch）→ 返回 Memory summary
8. task 失败 → 按 errorCode 映射成 typed error envelope；不调 saveTranscript

### 4.2 `workspace:requestSegmentSupplementTranscriptionBackfill`

对称结构；request 多带 `supplementId`，response 复用现有 `WorkspaceSegmentSupplementMarkdownSaveResponse`。Handler 校验和入队语义与 segment 版完全一致，只是 `kind='supplement'`。

### 4.3 错误码

新增错误码 9 个（写入 `src/workspace-contract/workspace-contract.ts` 的 `workspaceErrorCodeSchema`）：

- `ERR_BACKFILL_VOICE_DISABLED`：voice settings 未启用
- `ERR_BACKFILL_API_KEY_MISSING`：未配置 X-Api-Key
- `ERR_BACKFILL_ALREADY_RUNNING`：同 target 正在 running 或 enqueued
- `ERR_BACKFILL_ENGINE_AUTH`：SeedASR AUC 2.0 认证失败
- `ERR_BACKFILL_ENGINE_NETWORK`：SeedASR AUC 2.0 网络 / 超时 / 5xx
- `ERR_BACKFILL_ENGINE_FORMAT`：SeedASR AUC 2.0 请求格式、音频格式、大小限制或返回 body schema 异常
- `ERR_BACKFILL_ENGINE_RATE_LIMIT`：SeedASR AUC 2.0 429 或配额 / QPS 限制
- `ERR_BACKFILL_ENGINE_UNKNOWN`：其它
- `ERR_BACKFILL_CANCELED`：workspace switch / app quit / renderer process gone 期间被取消

**复用**现有错误码（不新增）：

- workspace lock 失效或 handle 已撤销 → 现有 `ERR_WORKSPACE_LOCK_LOST`（由 `assertWorkspaceUsable` 路径返回）
- 其它 workspace 通用错误（unsafe path、metadata invalid 等）→ 现有错误码

`src/renderer/src/workspace/workspaceErrorMessages.ts` 同批补 9 个新 errorCode 的用户可见文案映射；不动 `ERR_WORKSPACE_LOCK_LOST` 既有文案。

### 4.4 不引入 IPC

- 不引入 `workspace:backfillEvent` 中间态 callback channel
- 不引入手动取消 IPC
- 不引入查询队列状态 IPC

## 5. 前端组件

### 5.1 `SegmentTranscriptView` outcome 扩展

```ts
type TranscriptOutcome =
  | { readonly kind: 'success'; readonly text: string }
  | { readonly kind: 'empty-never' }
  | { readonly kind: 'empty-cleared' }
  | { readonly kind: 'failed-retryable' }
  | { readonly kind: 'running' }; // C 新增

type SegmentTranscriptViewProps = {
  readonly status: 'loading' | 'error' | 'ready';
  readonly outcome: TranscriptOutcome | null;
  readonly copy: {
    readonly loading: string;
    readonly error: string;
    readonly empty: string;
    readonly failedRetryable: string;
    readonly retryLabel: string;
    readonly running: string; // C 新增："正在生成"（segment）/"正在生成补充录音转录"（supplement）
  };
  readonly onRetry?: () => void;
};
```

**渲染分支补充**：

| `outcome.kind`      | 渲染                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `running`（C 新增） | 单行：`copy.running` 灰文（`text-muted-foreground` `font-sans text-body-sm`）；无 spinner；无按钮 |

### 5.2 Memory Studio / App 调用方

`MemoryStudio.tsx` 两处 outcome derive 增加 running 判定：

```ts
const isManualRunning = manualRunningSegmentTargets.has(
  targetKey({ workspaceId, memoryId, segmentId })
);
const outcome: TranscriptOutcome = isManualRunning
  ? { kind: 'running' }
  : deriveTranscriptOutcome(segmentProjection.lastTranscriptionAttempt, segmentContent?.transcript);
```

`App.tsx` 持有 `manualRunningSegmentTargets: Set<TargetKey>` 与 `manualRunningSupplementTargets: Set<TargetKey>`，通过 `Set` immutable update 传给 Memory Studio props；不引入 Zustand。

`App.tsx` 把 `showTranscriptionRetryPlaceholder` 替换为真实 handler：

```ts
async function handleRetrySegmentTranscription(target: {
  workspaceId: string;
  memoryId: string;
  segmentId: string;
}): Promise<void> {
  const key = segmentTargetKey(target);
  if (manualRunningSegmentTargets.has(key)) return;
  setManualRunningSegmentTargets((prev) => addImmutable(prev, key));
  try {
    const response = await workspaceApi.requestSegmentTranscriptionBackfill({
      workspaceHandle: currentHandle,
      workspaceId: target.workspaceId,
      memoryId: target.memoryId,
      segmentId: target.segmentId,
    });
    mergeWorkspaceMemorySummary(response.workspaceMemorySummary);
    invalidateSegmentContent(target);
  } catch (error) {
    toast.error(mapWorkspaceErrorToMessage(error));
  } finally {
    setManualRunningSegmentTargets((prev) => removeImmutable(prev, key));
  }
}
```

Supplement 对称。

### 5.3 preload 类型

`src/preload/index.ts` 与 `src/preload/workspaceBridge.ts` 通过 `contextBridge` 暴露窄方法：

```ts
window.reoWorkspace.requestSegmentTranscriptionBackfill(request);
window.reoWorkspace.requestSegmentSupplementTranscriptionBackfill(request);
```

build 输出到 `out/preload/index.cjs`，沿用 electron-vite 现有配置；preload source 不引入 Zod-backed contract 或普通 npm 包。`src/workspace-contract/reo-workspace-bridge.ts` 加 type-only 入口与 `ReoWorkspaceBridge` 接口扩展，复用现有 wrapping 模式。

### 5.4 不动

- Sidebar 红点（B 已有）
- Settings shell / VoiceSettingsPanel
- Recording overlay
- Memory rail
- Memory Studio 整体布局
- 实体 More 菜单

## 6. 状态机

### 6.1 单 task 状态机

```text
not-eligible ──[lastAttempt='failed' ∧ exists=false]──→ eligible-idle
eligible-idle ──[scanner trigger | manual click]──→ enqueued
enqueued     ──[queue head]──→ running
running      ──[submit/query ok + saveTranscript ok]──→ succeeded (manifest='success')
running      ──[submit/query fail | save fail]──→ failed-retryable (manifest='failed')
failed-retryable ──[next trigger | manual click]──→ enqueued
running      ──[workspace switch | lock lost | app quit]──→ canceled (manifest='failed')
enqueued     ──[workspace switch | lock lost | app quit]──→ canceled
```

### 6.2 队列状态机

```text
idle      ──[trigger fired & non-empty scan]──→ running
idle      ──[manual enqueue]──→ running
running   ──[queue empty]──→ idle
running   ──[recording overlay open]──→ pausing
pausing   ──[recording overlay close]──→ running
running   ──[same-errorCode K consecutive failures]──→ idle (auto cleared, manual preserved)
running   ──[workspace switch | lock lost | app quit]──→ canceling
canceling ──[abort done]──→ idle
```

### 6.3 SegmentTranscriptView outcome 转移

详见 goal.md §6.1。新增 `running` 状态由 renderer optimistic 管理；进入条件是「本 target 在 `manualRunning*Targets` Set 中」，退出条件是 IPC response 返回（成功或失败）。

## 7. 数据如何同步

### 7.1 manifest 写入

C 自身不写 manifest；通过 main 内部调 `saveTranscript` / `saveSegmentSupplementTranscript` 间接写入。完全复用 B 已有的 manifest update 路径与 Memory write queue。

### 7.2 TanStack Query cache

- 手动 retry response 返回 Memory summary 后，renderer 用 immutable update 合并当前 Workspace snapshot cache（`['workspace', 'snapshot', workspaceId]`）和 Memory detail cache（`['workspace', 'memory-detail', workspaceId, memoryId]`），并 invalidate 该 Segment / supplement content Query（`['workspace', 'segment-content', ...]` / `['workspace', 'segment-supplement-content', ...]`）
- 自动 task 完成后 main 调 saveTranscript 内部路径；renderer 不接收任何事件
  - 下次 Workspace snapshot visibility refresh 看到 `transcript.exists=true` 与 `lastTranscriptionAttempt='success'`
  - 或下次手动 Segment 切换触发 Segment content Query 重新拉
- 不创建任何新 Query key

### 7.3 voice settings

C 完全不写 voice settings；只读 `voiceSettingsStore`。

## 8. 性能与防丢失

### 8.1 性能

- BackfillScanner 单次扫描 ≤ 200ms（即使 Memory 大量）；通过 fixture 测试覆盖
- submit timeout、poll interval、poll 总超时由 C-0 验证后固定；HTTP 失败与轮询总超时均按 `network` 计入 breaker
- BackfillQueue 出队是 main thread 同步操作，不阻塞 IPC（每个 task 内部 await HTTP 时让出）
- main 诊断写入是同步 `electron-log` call；按现有节奏不阻塞 hot path

### 8.2 防丢失

- 不持久化 in-flight 任务状态；app crash 后下次启动从 manifest 重新派生
- saveTranscript 失败 → manifest 不动；下次触发上升沿重新尝试
- transcript text 仅在 SeedASR AUC 2.0 query 成功后通过 saveTranscript atomic write 写入 `segment.md` / `supplement.md`，沿用现有 `previous-file-preserved` / `file-written-index-stale` 错误信封

### 8.3 防重复

- 同 target enqueue 去重（包括手动 + 自动）
- renderer optimistic running 期间按钮不可点
- 自动 trigger 同一 workspace 同次 ready 只触发一次
- breaker 在同一 batch 内防止失败连续放大

### 8.4 防串写

- 复用 main process Memory write lock；同一 memoryId 的 create / append / title update / Segment delete / Segment restore / saveTranscript 串行
- BackfillQueue 串行 FIFO（concurrency=1），自身不引入并发

### 8.5 防 stale response

- 手动 IPC handler 同步等待；不存在 stale response 问题
- 自动 task 不向 renderer 推送；不存在 stale event 问题
- workspace switch 后 in-flight HTTP abort；abort 后 main 不再写 manifest

## 9. 第三方能力

| 项                               | 内容                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 使用哪个能力                     | 火山引擎大模型录音文件识别标准版 2.0 `POST /api/v3/auc/bigmodel/submit` + `query` + `volc.seedasr.auc` |
| 工程接入边界                     | 全部在 main process；renderer 完全不接触 endpoint、audio URL 交付细节或 audio bytes                    |
| 页面消费哪些结果                 | 仅 transcript text；其它字段不消费                                                                     |
| 主进程是否参与                   | 是；c0SeedAsrAucClient + backfillAudioUrlSource + saveTranscript                                       |
| preload 是否暴露受控 API         | 是；2 个手动触发 IPC                                                                                   |
| renderer 是否只消费安全结果      | 是；renderer 不收到 transcript 之外的 ASR 元数据                                                       |
| 失败时如何降级                   | 单 task 失败 → manifest 仍 'failed'；breaker 保护批次；不引入额外 retry path                           |
| 数据如何保存                     | 复用 `workspace:saveTranscript` / `workspace:saveSegmentSupplementTranscript`                          |
| 异步结果如何回写                 | 单 task 内 submit + poll；IPC handler 对外仍同步 await 完成结果                                        |
| 是否需要重试                     | 单 task 内不重试；下一次触发上升沿或手动点击作为重试                                                   |
| 是否需要超时处理                 | 是；submit timeout、poll interval、poll 总超时均由 C-0 验证                                            |
| 是否需要错误日志                 | 是；main 本地诊断按允许 list 写入                                                                      |
| 是否需要上报 Sentry              | 否（Reo 当前无 Sentry）                                                                                |
| 是否涉及敏感数据                 | 是；X-Api-Key + audio bytes + 临时 audio URL；renderer 不接触；诊断字段不记录                          |
| 是否需要用户授权                 | 否；用户已通过 voice settings 启用；若 C-0 选择对象存储，则必须另行定义用户可理解授权                  |
| 是否存在平台差异                 | 有；本地音频 URL 交付、WebM/Opus remux 或转码路径待 C-0 验证                                           |
| 是否影响应用打包                 | 若选择转码依赖则会影响；C-0 必须先评估，不默认引入                                                     |
| 是否影响自动更新                 | 否                                                                                                     |
| 是否需要官方文档确认             | 是；必须 Context7 + 火山官方站点交叉验证，结论写入 ADR 0005                                            |
| 最终以官方文档和实际接口协议为准 | 是；C-0 探针先验证                                                                                     |

## 10. 文件改动清单（参考；详细 TDD 见 tasks.md）

新增：

- `src/main/c0SeedAsrAucClient.ts`
- `src/main/backfillAudioUrlSource.ts`
- `src/main/backfillQueue.ts`
- `src/main/backfillScanner.ts`
- `src/main/backfillTriggerWiring.ts`
- `src/main/backfillDiagnostics.ts`
- `src/main/__tests__/c0SeedAsrAucClient.test.ts`
- `src/main/__tests__/backfillAudioUrlSource.test.ts`
- `src/main/__tests__/backfillQueue.test.ts`
- `src/main/__tests__/backfillScanner.test.ts`
- `src/main/__tests__/backfillTriggerWiring.test.ts`

修改：

- `src/main/workspaceIpc.ts`：注册 2 个新 IPC handler；接入 BackfillQueue
- `src/main/voiceSettingsStore.ts`：暴露窄 subscribeLastValidationOk API
- `src/main/index.ts`：app startup 与 workspace lifecycle 初始化 trigger wiring 与 queue
- `src/workspace-contract/workspace-contract.ts`：新增错误码 + 2 个 IPC request/response schema
- `src/workspace-contract/reo-workspace-bridge.ts`：type-only 入口
- `src/preload/`：暴露 2 个新方法
- `src/renderer/src/workspace/workspaceApi.ts`：preload wrapper
- `src/renderer/src/workspace/SegmentTranscriptView.tsx`：outcome `'running'` 渲染
- `src/renderer/src/workspace/MemoryStudio.tsx`：合并 manual running set 派生 outcome
- `src/renderer/src/App.tsx`：替换 `showTranscriptionRetryPlaceholder`；持有 manual running sets
- `src/renderer/src/workspace/workspaceErrorMessages.ts`：9 个新 `ERR_BACKFILL_*` 文案映射；不动 `ERR_WORKSPACE_LOCK_LOST` 等既有项

## 11. 文档同步（实施同批）

- `docs/current/electron.md`：新增 2 个手动触发 IPC channel；诊断允许 list 追加 backfill events
- `docs/current/flow.md`：新增 BackfillQueue lifecycle、触发上升沿、recording pause、circuit breaker、batch cap；说明手动 vs 自动入队规则
- `docs/current/data.md`：renderer manual running state 归属说明；明确不引入新 Query key、不引入 Zustand store
- `docs/current/frontend.md`：`SegmentTranscriptView` outcome `'running'`；App `manualRunning*Targets` set 持有
- `docs/current/quality.md`：错误码列表追加 `ERR_BACKFILL_*`；后台任务诊断要求；c0SeedAsrAucClient + backfillQueue 测试覆盖要求
- 新 ADR：`docs/decisions/0005-doubao-voice-file-asr-baseline.md`（本 session 写入选型与 gate；C-0b 通过后补具体交付方案）

## 12. 不实施

- 不写新顶层 `docs/decisions/` ADR 之外的长期决策文档
- 不写迁移脚本
- 不修改 segment / supplement manifest schema
- 不引入 Zustand store
- 不创建任何用户可见的 backfill 控制面板
- 不实现 D 的 More 菜单或覆盖确认弹层

# 工程实现说明 + 状态机 + 组件元素

## 数据模型变更

### segment manifest

`src/main/memoryFiles.ts` 中 `segmentObjectManifestSchema`：

```ts
const lastTranscriptionAttemptSchema = z.union([
  z.literal('success'),
  z.literal('failed'),
  z.literal('never'),
]);

const segmentObjectManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    objectType: z.literal('segment'),
    workspaceId: z.string().min(1),
    memoryId: z.string().regex(MEMORY_ID_PATTERN),
    segmentId: z.string().regex(SEGMENT_ID_PATTERN),
    kind: z.literal('audio'),
    createdAt: z.string(),
    finalizedAt: z.string(),
    updatedAt: z.string(),
    durationMs: z.number().int().nonnegative(),
    nextSequence: z.number().int().nonnegative(),
    audioByteLength: z.number().int().nonnegative(),
    lastTranscriptionAttempt: lastTranscriptionAttemptSchema.optional(),
  })
  .strict();
```

`schemaVersion` 保持 `1`，新字段标记为 optional：

- 旧文件无此字段时仍能 strict 解析通过
- read path 在派生 projection 时将 absent 等价于 `'never'`
- write path 在每次写 manifest 时**始终**写入显式值（不会再写出 absent）

### supplement manifest

`supplementObjectManifestSchema` 同步加同名 optional 字段，语义对称。

### Workspace snapshot / Memory detail projection 接口

`src/workspace-contract/` 与 `src/main/workspaceFiles.ts` 中的 finalized segment projection 类型：

```ts
type FinalizedAudioSegmentProjection = {
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly type: 'audio';
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly durationMs: number;
  readonly audioByteLength: number;
  readonly transcript: { readonly exists: boolean };
  readonly lastTranscriptionAttempt: 'success' | 'failed' | 'never';
  readonly supplementCount: number;
  readonly supplements: ReadonlyArray<FinalizedAudioSegmentSupplementProjection>;
};
```

`lastTranscriptionAttempt` 在 projection 中**必填**（manifest absent 时投影为 `'never'`）。
SegmentSupplement projection 同步加同名必填字段，缺失 → `'never'`。

### `.reo/index.json` Memory summary

`workspaceMemorySummarySchema` 不变。Memory summary 不冗余 `lastTranscriptionAttempt`，UI 不需要 Memory 层 aggregate（已在 plan.md 排除 Memory rail badge）。

## Write 路径（manifest 字段写入时机）

### 1. Recording finalize（普通录音）

`src/main/recordingDrafts.ts` 的 `finalizeRecordingDraft`：

写 manifest 时根据 finalize request 字段计算初值；finalize 不写 `'success'`：

```
const initialAttempt = request.lastTranscriptionAttemptOnFinalize ?? 'never';
```

**判定来源**：finalize request 可以携带 `lastTranscriptionAttemptOnFinalize`；字段缺失时 main 按 `'never'` 派生，不引入兼容垫片以外的额外状态。

具体落到三条子路径：

| 子路径                                 | 触发条件                                                      | `lastTranscriptionAttempt` 初值 |
| -------------------------------------- | ------------------------------------------------------------- | ------------------------------- |
| Finalize request 缺字段或 ASR disabled | request 缺字段或 `lastTranscriptionAttemptOnFinalize='never'` | `'never'`                       |
| Finalize 时 ASR enabled                | `lastTranscriptionAttemptOnFinalize='failed'`                 | `'failed'`                      |
| saveTranscript 成功                    | finalize 后正文保存成功                                       | `'success'`                     |

注意：finalize manifest write 与 transcript save 不是同一个 IPC 调用。当前流程是：finalize 先写 manifest（带空 transcript），renderer 紧接着调 saveTranscript 写正文。为了让 manifest 初值正确：

- 方案 A（推荐）：finalize manifest 写 `'never'` 或 `'failed'` 作为占位，saveTranscript 成功后再 update manifest 为 `'success'`
- 方案 B：finalize 接收可选 request 字段 `lastTranscriptionAttemptOnFinalize?: 'failed' | 'never'`；saveTranscript 成功后置 `'success'`

采用 **方案 B 的可选字段版本**，避免当前 renderer 在 enabled 路径 finalize 后、saveTranscript 前的窗口内被误读为 `'never'`，同时让缺字段路径按当前合同安全派生为 `'never'`。这要求：

- `WorkspaceFinalizeRecordingDraftRequest` 增加可选 `lastTranscriptionAttemptOnFinalize?: 'failed' | 'never'`（不接受 `'success'`，避免 renderer 提前声明成功）
- `WorkspaceFinalizeSegmentSupplementRecordingDraftRequest` 对称增加可选同字段
- renderer 在 finalize 时由 `voiceSettingsKnown && transcriptionEnabled` 决定：true → `'failed'`；false → `'never'`
- main 接收后写入 manifest；缺字段按 `'never'`

### 2. Transcript save（含 completion backfill 成功）

`workspace:saveTranscript` handler：

- 写 segment.md `## Transcript` 成功后，在同一 atomic operation 内 update manifest `lastTranscriptionAttempt = 'success'`
- 失败：manifest 不变（保持 finalize 时写的 `'failed'` 或 `'never'`）

`workspace:saveSegmentSupplementTranscript` 对称。

**写入实现**：复用 `updateSegmentManifest` / `updateSupplementManifest` 现有的 main process write queue，保证与 finalize / title rename 串行；transcript text 写 segment.md 与 manifest update 必须在同一锁内成功才算成功，单边失败 → 仍按 `previous-file-preserved` 失败。

### 3. Completion backfill 内部失败（RecordingOverlay 内的自动 backfill）

RecordingOverlay 在 finalize 后启动 backfill：

- backfill 成功 → 通过 saveTranscript 路径写 `'success'`（路径 2 已覆盖）
- backfill 失败 → root toast；不调用 saveTranscript；manifest 保持 finalize 时写的 `'failed'`（路径 1 已覆盖）

### 4. C 自动补转录成功（未来路径）

未来 C 的后台任务成功后调用现有 `workspace:saveTranscript` → 路径 2 自动置 `'success'`。本 spec 不实施 C，但路径已贯通。

### 5. D 手动重转成功（未来路径）

D 调同一个 saveTranscript，路径 2 自动置 `'success'`。覆盖路径下 manifest 从 `'failed'` 或 `'success'` 变为 `'success'`。

### 6. 用户外部清空 segment.md

用户在 Finder 编辑 segment.md 删除 `## Transcript`。Reo 不监听文件系统变化；下一次 Workspace snapshot refresh 时 `transcript.exists=false`，但**不**触发 manifest update。manifest 保持原值（`'success'`），派生 projection 仍是 `'success'`。

UI 层因 `'success' ∧ exists=false` → 显示通用空态文案，不显示重试 CTA。

### 7. Index rebuild / open recovery

`updateWorkspaceIndex` / open recovery 不主动写 manifest。仅读：

- 若 manifest 存在 `lastTranscriptionAttempt` → 用之
- 若 absent → projection 取 `'never'`

不在 rebuild 路径回写 manifest，避免改变文件 mtime / fsync 边界。

## Read 路径（manifest 字段读出与 projection 暴露）

### Memory detail projection

`src/main/workspaceFiles.ts` 中 finalized segment projection 派生逻辑：

```ts
const lastTranscriptionAttempt: 'success' | 'failed' | 'never' =
  manifest.lastTranscriptionAttempt ?? 'never';
```

SegmentSupplement projection 同。

### Workspace snapshot summary

不暴露该字段。Memory summary 不冗余 aggregate（如 `failedTranscriptionCount`）。

### `transcript.exists` 投影不变

仍来自 `extractSegmentTranscript(markdownContent)` 是否非空。

## IPC contract 变化

### `workspace:finalizeRecordingDraft` request

```ts
type WorkspaceFinalizeRecordingDraftRequest = {
  workspaceHandle: WorkspaceHandle;
  memoryId: string;
  segmentId: string;
  title: string;
  durationMs: number;
  lastTranscriptionAttemptOnFinalize?: 'failed' | 'never'; // NEW
};
```

### `workspace:finalizeSegmentSupplementRecordingDraft` request

对称增加可选同字段。

### `workspace:saveTranscript` / `workspace:saveSegmentSupplementTranscript`

request / response 不变；handler 内部多写一次 manifest update。

### `workspace:readMemoryDetail` / snapshot / supplement content

response 内 finalized segment / supplement projection 增加必填 `lastTranscriptionAttempt`。

### 不变

- `workspace:readVoiceTranscriptionSettings` / `setEnabled` / `saveApiKey` / `clearApiKey` / `validateVoiceTranscriptionCredentials`：不变；B-2 复用 `lastValidationCode='auth'`
- 录音 transcription 相关 IPC（start/send/finish/close）：不变
- 实体 More 菜单 shell 动作：不变

## 前端组件元素

### B-1：`SegmentTranscriptView` 接口扩展

```ts
type TranscriptOutcome =
  | { readonly kind: 'success'; readonly text: string }
  | { readonly kind: 'empty-never' } // lastAttempt='never' ∧ exists=false
  | { readonly kind: 'empty-cleared' } // lastAttempt='success' ∧ exists=false
  | { readonly kind: 'failed-retryable' }; // lastAttempt='failed' ∧ exists=false

type SegmentTranscriptViewProps = {
  readonly status: 'loading' | 'error' | 'ready';
  readonly outcome: TranscriptOutcome | null; // ready 时一定非空
  readonly copy: {
    readonly loading: string;
    readonly error: string;
    readonly empty: string; // 用于 'empty-never' 和 'empty-cleared'
    readonly failedRetryable: string; // 新增："上次生成转录失败"
    readonly retryLabel: string; // 新增："重试"
  };
  readonly onRetry?: () => void; // failed-retryable 时调用；缺失时不渲染按钮
};
```

current `transcript: { exists, text } | null` prop 由 caller 在调用前转换为 `outcome`。

### B-1：`SegmentTranscriptView` 渲染分支

| `outcome.kind`     | 渲染                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `success`          | 现状：transcript 段落                                                                                                                                              |
| `empty-never`      | 现状：`copy.empty` 灰文                                                                                                                                            |
| `empty-cleared`    | 现状：`copy.empty` 灰文（同 empty-never）                                                                                                                          |
| `failed-retryable` | 两行结构：第一行 `copy.failedRetryable` 灰文；第二行 `Button(size=sm, variant=secondary)` `copy.retryLabel`，`onClick={onRetry}`；`disabled` when `onRetry` absent |

视觉规则：

- 灰文使用 `text-muted-foreground`（与 empty 一致）
- 按钮使用 shadcn Button `size="sm"` `variant="secondary"`；不引入新 variant
- 两行之间 `mt-12` 间距
- 不画 border、不画 shadow、不引入 icon

### B-1：调用方改动

`MemoryStudio.tsx` 内两处 `SegmentTranscriptView` 用法：

1. Segment 转录 tab（line ~1897）：
   - 把现有 `transcript={segmentContent?.transcript ?? null}` 改为 `outcome={deriveOutcome(segmentProjection.lastTranscriptionAttempt, segmentContent?.transcript)}`
   - 把 `copy.empty: '这段录音还没有转录。'` 扩展，加 `failedRetryable: '上次生成转录失败。'`、`retryLabel: '重试'`
   - `onRetry`：本 spec 内 prop 来自 `MemoryStudioProps.onRetrySegmentTranscription`；该 prop 在 `App.tsx` 内当前 stub 为弹 toast「转录引擎尚未上线」（D 实施后接通）
2. SegmentSupplement transcript（line ~890）：
   - 同上结构；copy 用「上次生成补充录音转录失败。」+「重试」
   - `onRetry` 接 `MemoryStudioProps.onRetrySupplementTranscription`

### B-2：Sidebar 设置按钮红点

`src/renderer/src/app/AppShell.tsx`（或 sidebar 文件）中 Settings trigger 渲染：

- 复用现有 `useQuery(voiceSettingsQueryOptions())`（已在 RecordingOverlay 使用）
- 在 Settings IconButton 内叠加一个 `<span>` 绝对定位 dot：
  - 条件：`voiceSettings?.lastValidationCode === 'auth'`
  - 几何：8px 圆，右上角 `-top-1 -right-1`，`bg-destructive`，无 border 无 shadow
  - 不打扰键盘焦点、不进入可点击树（`aria-hidden="true"`）
  - 不影响 IconButton 本身的 click handler
  - 复用现有 IconButton geometry，不改原按钮大小

## 状态机

### segment / supplement `lastTranscriptionAttempt` 状态机

```text
states: 'never' | 'failed' | 'success' (+ absent in manifest, derived as 'never')

events:
  - finalize.with_asr_enabled   → write 'failed' (placeholder)
  - finalize.with_asr_disabled  → write 'never'
  - saveTranscript.success      → write 'success'
  - saveTranscript.failure      → no change
  - userEdit.transcript_md      → no change (manifest not touched)
  - cManualRetry.success        → write 'success' (via saveTranscript)
  - cManualRetry.failure        → no change
  - dManualRetry.success        → write 'success' (via saveTranscript)
  - dManualRetry.failure        → no change

invariants:
  - 'success' ↔ user-visible transcript may or may not exist; derived UI uses (lastAttempt, transcript.exists) tuple
  - 'failed' → transcript.exists=false at write time
  - 'never'  → transcript.exists=false at write time
  - state field never goes from 'success' back to 'failed' or 'never' inside Reo;
    only via manifest schema reset (out of scope) or workspace reinit (out of scope)
```

### B-1 UI 状态机（每个 segment / supplement transcript view）

```text
inputs: (queryStatus, lastTranscriptionAttempt, transcript.exists)

state: 'loading' | 'error' | 'empty' | 'success' | 'failed-retryable'

transitions:
  queryStatus='loading' → 'loading'
  queryStatus='error'   → 'error'
  queryStatus='ready':
    transcript.exists=true                              → 'success'
    transcript.exists=false ∧ lastAttempt='failed'      → 'failed-retryable'
    transcript.exists=false ∧ lastAttempt∈{'never','success'} → 'empty'

events:
  retryClick (only in 'failed-retryable' state) → invoke onRetry callback;
    UI does not transition locally (no spinner inside B; future C/D will handle running state)
```

### B-2 红点状态机

```text
inputs: (voiceSettingsQuery.status, voiceSettings.lastValidationCode)

state: 'hidden' | 'visible'

transitions:
  voiceSettingsQuery.status='loading'    → 'hidden'  (未知不展示)
  voiceSettingsQuery.status='error'      → 'hidden'  (settings 读失败不通过 dot 表达)
  voiceSettingsQuery.status='success':
    lastValidationCode='auth'            → 'visible'
    lastValidationCode∈{'ok','network',undefined} → 'hidden'

events:
  none (dot 本身不可点击)
```

## 数据如何同步

- manifest write：经现有 `updateSegmentManifest` / `updateSupplementManifest` write queue，与 finalize / title rename 共用 lock；不引入新锁
- TanStack Query cache：finalize / saveTranscript response 携带更新后的 projection，renderer 按 immutable update 写入 Memory detail cache；不引入新 Query
- 跨 workspace：B-2 红点完全依赖 `['settings', 'voice']` 已有 invalidation 路径（saveApiKey / validate / setEnabled / clear 已有 invalidate），不增加 effect

## 性能注意

- manifest 多写一个字段不引入额外 IO（同一文件写）
- read 派生 `lastTranscriptionAttempt` 是 O(1)
- 红点判断是 O(1) memo
- 不增加 Workspace open / refresh 的 scan 行为

## 防丢失 / 防串写

- manifest update 复用现有 write queue，与 finalize / title rename / supplement rename 串行
- saveTranscript 内部把 segment.md write 与 manifest update 视为同一 atomic group：任一失败 → 双回滚（segment.md 走 previous-file-preserved；manifest 走同样）
- finalize 时如果 saveTranscript 失败，manifest 已是 `'failed'`，recovery marker 路径不变（已有 marker 持有 finalized projection 等待重试）

## 防重复提交 / 防 stale response

- 重试 CTA 的 click handler 是 stub callback（本 spec 内）；不触发 IPC，不需防重复
- finalize 的 `lastTranscriptionAttemptOnFinalize` 是 request 内静态字段，不需 idempotency
- saveTranscript 的 manifest update 不引入新 race 路径（已有 segment.md write 的并发保护已经覆盖）

## 第三方能力

本 spec **不使用任何第三方 API**：

- 不调用火山引擎
- 不引入新包
- 不引入新 npm dependency
- 仅依赖现有 Electron / Zod / TanStack Query / React 19 / shadcn Button

## 文件改动清单（参考，tasks.md 内 TDD 化）

- `src/main/memoryFiles.ts`：manifest schema 加字段；projection 派生
- `src/main/recordingDrafts.ts`：finalize 时根据 request 字段写 manifest 初值；saveTranscript 成功后 update manifest
- `src/main/recordingTranscription*`：无变化
- `src/main/voiceSettings*`：无变化
- `src/workspace-contract/`：finalize request DTO + segment / supplement projection 加字段
- `src/preload/`：自动跟随类型变化
- `src/renderer/src/workspace/SegmentTranscriptView.tsx`：props 重构 + 渲染分支
- `src/renderer/src/workspace/MemoryStudio.tsx`：两处 SegmentTranscriptView 调用方更新；新增 `onRetrySegment/SupplementTranscription` props
- `src/renderer/src/App.tsx`：注入 stub `onRetry*` callback（toast「转录引擎尚未上线」）
- `src/renderer/src/app/AppShell.tsx`（或对应 sidebar 文件）：Settings IconButton 叠加 dot
- `src/renderer/src/workspace/RecordingOverlay.tsx`：finalize 调用处补上 `lastTranscriptionAttemptOnFinalize: transcriptionEnabled ? 'failed' : 'never'`（由 voice settings snapshot 决定）

## 文档同步（实施同批）

- `docs/current/data.md`：新增 `lastTranscriptionAttempt` 字段段落；finalized projection 字段表更新；说明 manifest 缺失时投影为 `'never'`
- `docs/current/flow.md`：finalize 与 saveTranscript 段落补 manifest 字段写入语义；外部清空 transcript 不改 manifest 说明
- `docs/current/frontend.md`：`SegmentTranscriptView` 增加 failed-retryable 渲染；Sidebar Settings IconButton 红点
- `docs/current/electron.md`：finalize IPC request 新字段
- `docs/current/quality.md`：无变化（不增加新 lint/test 规则）

## 不实施

- `docs/decisions/`：不写新 ADR；本 spec 是 B 的功能切片，不是长期架构决策
- 不写迁移脚本；旧 manifest 缺字段就是 `'never'`，不主动升级

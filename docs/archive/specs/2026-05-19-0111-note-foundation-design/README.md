# Note Foundation 设计 spec

- 时间：2026-05-19 01:11 America/Los_Angeles
- 类型：design-only spec（无代码改动）
- 关联 initiative：`docs/initiatives/2026-05-19-note-foundation/`
- 关联 ADR：`docs/decisions/0006-agent-native-carrier-and-generative-ui.md`
- 工程交付形态：`engineering-handoff.md`（工程师 day-1 入手文档；本 README 承担决策记录与跨节关联）
- 状态：design 完成；Stage 1 spike evidence 已补齐；sub-spec (a) 可启动；sub-spec (b) 进入前必须先完成编辑器决策收口

## 目的

为 Reo 引入 `kind: note` 的 Segment 与 SegmentSupplement，把当前 audio-only 的对象合同、IPC、projection 与 Memory Studio 渲染扩展为 multi-kind。本 spec 是产品本质长期轨道首条 active 工作的设计依据；不在本 session 写代码，只产出概念模型、文件合同、IPC、UI 集成、subset/gate、conflict 策略、文档更新清单、TDD checklist、spike 清单、phase gate 与下一 session 启动 prompt。

## Stage 1 evidence 结论

- Spike #1：`@blocknote/mantine@0.51.1` 可在隔离 React 19 + Vite + Tailwind v4 环境 mount；体积要求 sub-spec (b) lazy-load note editor。
- Spike #2：BlockNote 0.51.1 在当前 markdown-truth gate 下 subset pass 11/13；Milkdown 7.21.1 fallback 同样 subset pass 11/13。sub-spec (b) 不得直接把 BlockNote 或 Milkdown 定为默认编辑器，必须先收口更窄的 editor decision。
- Spike #3：`reo-attachment://` 可支撑 `<img>` 显示；renderer JS fetch 不作为主路径。
- Spike #4：note draft 可复用目录事务与 Markdown write queue，但必须用 note-specific sibling draft/finalize path，不能泛化重写 audio draft 主链。
- Spike #5：`baselineContentHash` 使用 full SHA-256 hex；日志、toast、DOM 和 crash/error report 不暴露完整 hash。
- Spike #6：visibility refresh 足够支撑 dirty body isolation；不引入 file watcher。

## 设计立场

- Note foundation = 把 audio-only Segment / SegmentSupplement 合同扩展为 multi-kind 对象合同，并在 `kind: note` 上接入 Notion-like Markdown editor adapter。录音功能提供对象结构、补充关系、删除恢复、Query identity、More 菜单、沉浸式创建流程和 Memory Studio 模板；笔记只在 note payload 与 content surface 上分叉。
- Markdown / frontmatter 是 Reo 语义真源；editor JSON 不是。Notion-like editor 只能作为 UI adapter；必须有 round-trip gate、raw mode 和明确 fallback decision。
- 不创建 `note.md`；不创建独立 `notes/` 目录；`segment.md` / `supplement.md` 永远是语义 Markdown 文件；`supplements/` 是补充内容对象，不是附件目录；`attachments/` 是新合同，仅承载 markdown 引用的本地资源。
- 不引入 file watcher、generic runtime、speculative abstraction、plugin runtime。

## 1. 概念模型

```
Workspace → Memory → Segment(kind: audio | note) → SegmentSupplement(kind: audio | note)
```

- `kind` 区分 payload，不区分层级。Memory Studio 模板、recording / 创建沉浸式流程、删除恢复、Query identity、More 菜单跨 kind 共享。
- audio Segment 可有 note Supplement；note Segment 可有 audio Supplement。
- Widget / HTML / video / photo / imported_file kind 不在本 spec；推迟到产品本质长期轨道其他条目。

## 2. 文件合同

```
memories/<memId>--<memTitle>/
  memory.md
  segments/<segId>--<segTitle>/
    segment.md                       # kind=audio 时是转录正文；kind=note 时是笔记正文
    audio.webm                       # 仅 kind=audio 存在
    attachments/                     # 仅 segment.md 引用本地资源时按需创建
      <sha256-prefix>--<safe-name>.<ext>
    supplements/<supId>--<supTitle>/
      supplement.md
      audio.webm                     # 仅 kind=audio supplement
      attachments/                   # supplement 自有 attachments，与父 segment 隔离
.reo/drafts/
  segments/<segId>/segment.md        # note draft；与 audio draft 同一 .reo/drafts/segments 层
  supplements/<supId>/supplement.md
.reo/objects/
  segments/<segId>.json              # kind 字段从 "audio" 扩展为 "audio" | "note"
  supplements/<supId>.json
```

硬约束：

- 不创建 `note.md`。
- 不创建独立 `notes/` 目录。
- `supplements/` 只承载补充对象。
- `attachments/` 只承载 markdown 引用的本地资源；不被识别为 Segment 或 SegmentSupplement；不进入对象图。
- `audio.webm` 仅 `kind=audio` 时存在；`kind=note` 没有 audio payload。

## 3. Frontmatter（语义、用户/agent 可编辑）vs `.reo/objects` manifest（技术、Reo 管理）归属

| 字段                                                                                     | 归属         | 说明                                                            |
| ---------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------- |
| `title / summary / description / status / tags / topics / people / places / related`     | frontmatter  | 已有 shared schema 沿用                                         |
| `kind`                                                                                   | **同时存在** | manifest 是真源；frontmatter 作为可读 mirror（写时由 Reo 同步） |
| `occurred_at / language`                                                                 | frontmatter  | 已有 Segment / Supplement 扩展沿用                              |
| `objectType / memoryId / segmentId / supplementId / createdAt / updatedAt / finalizedAt` | manifest     | Reo 管理                                                        |
| audio 专属 `durationMs / audioByteLength / lastTranscriptionAttempt`                     | manifest     | 现状保留                                                        |
| note 专属 `bodyByteLength`                                                               | manifest     | 新增；用于 Memory summary 聚合与 `baselineContentHash` 配套     |

`workspaceMarkdownObjectKindSchema` 从 `z.literal('audio')` 改为 `z.enum(['audio','note'])`。

## 4. Multi-kind projection（顶层 discriminated union by `type`）

```ts
workspaceSegmentProjectionSchema = z.discriminatedUnion('type', [
  audioSegmentProjectionSchema, // 现状字段完整保留
  noteSegmentProjectionSchema, // 新增
]);

noteSegmentProjectionSchema = z.strictObject({
  workspaceId,
  memoryId,
  segmentId,
  type: z.literal('note'),
  title,
  createdAt,
  updatedAt,
  bodyByteLength: z.number().int().nonnegative(),
  supplementCount,
  supplements: z.array(workspaceSegmentSupplementProjectionSchema), // 自身也是 discriminated union
});
```

`workspaceSegmentSupplementProjectionSchema` 同构。Renderer 用 `switch (segment.type)` 路由组件。

`workspaceMemorySummarySchema` 字段重命名 + 新增：

| 现状              | 新                                       |
| ----------------- | ---------------------------------------- |
| `segmentCount`    | 保留，**跨 kind 总和**                   |
| `supplementCount` | 保留，**跨 kind 总和**                   |
| `durationMs`      | 重命名为 `audioDurationMs`（audio-only） |
| `audioByteLength` | 不变（audio-only）                       |
| `hasTranscript`   | 重命名为 `hasAudioTranscript`            |
| —                 | 新增 `audioSegmentCount`                 |
| —                 | 新增 `noteSegmentCount`                  |
| —                 | 新增 `hasAnyNote`                        |

`.reo/index.json` 的 memory summary 投影同步。

## 5. 录音基础设施 → note 复用映射

### Main process（`src/main/`）

| 已有能力（行号 / 函数）                                                                                             | note 复用方式                                                                                             | 原因                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `withMarkdownSaveQueue` (`recordingDrafts.ts:274`)                                                                  | **REUSE 1:1**                                                                                             | 同一 segment write 串行化合同                                                                                   |
| `withMemoryWriteLock` / `withWorkspaceIndexWriteLock` (`memoryFiles.ts:1438/1455`)                                  | **REUSE 1:1**                                                                                             | Memory 单写者锁、index write queue                                                                              |
| `workspaceDirectoryTransactions.ts` 全部 primitives                                                                 | **REUSE 1:1**                                                                                             | atomic / no-replace / identity-preserved 文件操作                                                               |
| `createRecordingDraft` / `createSegmentSupplementRecordingDraft` (`recordingDrafts.ts:623/704`)                     | **ADAPT 同构 sibling**：`createNoteSegmentDraft` / `createNoteSegmentSupplementDraft`                     | 同 `.reo/drafts/segments/<id>/` 层；写 `segment.md` 而非 `audio.webm`；不带 sequence / byteLength               |
| `appendRecordingAudioChunk` / `cloneRecordingDraftPrefix` / `readRecordingDraftAudio`                               | **N/A**                                                                                                   | note 没有流式 chunk；改为 `writeNoteSegmentDraftBody`（throttled 全量替换）+ `readNoteSegmentDraftBody`（恢复） |
| `finalizeRecordingDraft` / `finalizeSegmentSupplementRecordingDraft` (`recordingDrafts.ts:1951/1987`)               | **ADAPT 同构**：`finalizeNoteSegmentDraft` / `finalizeNoteSegmentSupplementDraft`                         | 复用 staging dir、marker、no-replace expose、parent identity recheck；payload 仅 markdown                       |
| `discardRecordingDraft` / `discardSegmentSupplementRecordingDraft` (`recordingDrafts.ts:2088/2141`)                 | **ADAPT 同构 sibling**                                                                                    | 同一清理边界                                                                                                    |
| `saveRecordingMarkdown` / `saveSegmentSupplementMarkdown` (`recordingDrafts.ts:2421/2518`)                          | **GENERICIZE**：拆出 generic `writeSegmentContent` / `writeSegmentSupplementContent`                      | audio kind 走 `replaceSegmentTranscript`；note kind 走 `replaceSegmentBody`；按 manifest kind 分派              |
| `extractSegmentTranscript` / `replaceSegmentTranscript` (`memoryFiles.ts:1114/1145`)                                | **REUSE 在 audio 路径** + 新增 `extractSegmentBody` / `replaceSegmentBody`（body = frontmatter 之后整段） | note 没有 `## Transcript` section，body 即真源                                                                  |
| `writeSegmentObjectManifest` / `writeSupplementObjectManifest` (`memoryFiles.ts:1195/1217`)                         | **REUSE，extend payload**                                                                                 | 新增 `kind: 'note'` 与 `bodyByteLength` 字段                                                                    |
| `markSegmentTranscriptionAttemptSuccess` / `markSupplementTranscriptionAttemptSuccess` (`memoryFiles.ts:1260/1298`) | **保留 audio-only**                                                                                       | note 不写 `lastTranscriptionAttempt`                                                                            |
| `clearRecordingRuntimeStateForRoot` (`recordingDrafts.ts:264`)                                                      | **EXTEND 同构**                                                                                           | session boundary 时同清 note draft runtime                                                                      |
| `backfillRuntime.ts`、豆包 ASR、microphone intent、voice settings IPC                                               | **N/A**                                                                                                   | note 没有 ASR / 凭证 / 麦克风需求                                                                               |

### Renderer（`src/renderer/src/workspace/`）

| 已有                                                                                                        | note 复用方式                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `workspaceQueries.ts` query keys（snapshot / memory-detail / segment-content / segment-supplement-content） | **REUSE 1:1**；segment-content 返回值变 discriminated；helper `finalizedAudioContentQueryBelongsToWorkspace` → 重命名 `segmentContentQueryBelongsToWorkspace`（语义中性）                                                                               |
| `segmentDeleteProjection.ts` (grace period + 多 pending + summary 重算)                                     | **REUSE + EXTEND**：`memorySummaryWithVisibleSegments` 同时减 audio 与 note 聚合字段，按 segment.type 分桶                                                                                                                                              |
| `entityActionBindings.ts` 全部绑定                                                                          | **REUSE 1:1**（reveal / open / copy paths 与 kind 无关）                                                                                                                                                                                                |
| `SegmentTranscriptView.tsx` (outcome state machine)                                                         | **PROMOTE**：拆 outcome 与 `SegmentTranscriptViewCopy` 与渲染容器解耦；新建 `MarkdownContentSurface` primitive 包裹 audio outcome + note 预览                                                                                                           |
| `RecordingOverlay.tsx` 沉浸式 surface 模板                                                                  | **MIRROR**：新建 `NoteEditorOverlay`，结构同构、ASR / MediaRecorder 段落抽走、改挂 BlockNote                                                                                                                                                            |
| `recordingRecovery.ts` localStorage marker 框架                                                             | **MIRROR**：新建 `noteEditorRecovery.ts`；marker 字段 `workspaceId / memoryId / segmentId 或 supplementId+parentSegmentId+targetKind / title / bodySnapshot / baselineContentHash / dirty / updatedAt`；不含 audio byte map / waveform / chunk sequence |
| `App.tsx` workspace-scoped target cleanup + handle-bound mutation set                                       | **EXTEND 同构**                                                                                                                                                                                                                                         | 新增 `pendingNoteEditOwners` Map（key = workspaceHandle + segmentId / supplementId），session 切换 / close 同清 |
| FAB note action `disabled: true`（`ExpressionDock.tsx:36-40`）                                              | **ENABLE**：`onSelect: onStartNote`；保留 `PencilLine` 图标与"笔记"文案                                                                                                                                                                                 |
| Memory Studio audio player + tab rail + Supplement tabs                                                     | **DISPATCH by `segment.type`**：audio 不动；note 在 player slot 显示占位文案、内容区直接挂 `MarkdownContentSurface`；Supplement tab kind 同构                                                                                                           |
| 实体 More 菜单（`SegmentActionsMenu` / `SegmentSupplementActionsMenu`）                                     | **EXTEND**：audio 保留转录组；note 把"生成转录 / 重新生成转录"换为"通过 agent 生成 prompt（暂不可用）"，路径 / 重命名 / 删除完全等价                                                                                                                    |
| `WORKSPACE_RENDERER_EVENT_CHANNELS`（transcription event）                                                  | **不改**                                                                                                                                                                                                                                                | note 无对应 event                                                                                               |

## 6. Content read / save IPC（generic + per-kind draft）

新增 generic content channels（取代 audio-specific `saveTranscript` / `readFinalizedAudioSegment` 中的 markdown 部分；audio bytes 读取保留独立 channel）：

```
workspace:readSegmentContent
  request: { workspaceHandle, workspaceId, memoryId, segmentId, requestId, maxAudioBytes? }
  response value: discriminated by `type`
    type='audio': { ...identity, audio: Uint8Array, audioByteLength, transcript: { exists, text } }
    type='note':  { ...identity, body: { exists, text, byteLength, contentHash } }

workspace:readSegmentSupplementContent (同构，加 supplementId)

workspace:writeSegmentContent
  request: { workspaceHandle, workspaceId, memoryId, segmentId, body: string, baselineContentHash }
  main: lock 内读 manifest 取 kind；
    kind='audio' → replaceSegmentTranscript + markSegmentTranscriptionAttemptSuccess（保留现行副作用）
    kind='note'  → replaceSegmentBody（frontmatter 不动）
  baselineContentHash mismatch → ERR_SEGMENT_CONTENT_STALE
  response: { memory, segment }  (segment 为 discriminated projection)

workspace:writeSegmentSupplementContent (同构)
```

保留不变：`workspace:readFinalizedAudioSegment` 与 `workspace:readFinalizedAudioSegmentSupplement` 在本 sub-spec 内继续承载播放路径的 audio bytes 读取（`maxBytes` 沿用），不变 schema；transcript 读取迁移到新 generic channel。

## 7. Note draft IPC（sibling channels）

```
workspace:createNoteSegmentDraft              { workspaceHandle, workspaceId, memoryId, title? }
workspace:writeNoteSegmentDraftBody           { workspaceHandle, segmentId, body, revision }
workspace:readNoteSegmentDraftBody            { workspaceHandle, segmentId }   # recovery
workspace:finalizeNoteSegmentDraft            { workspaceHandle, workspaceId, memoryId, segmentId, title, body }
workspace:discardNoteSegmentDraft             { workspaceHandle, segmentId }

workspace:createNoteSegmentSupplementDraft    { workspaceHandle, workspaceId, memoryId, segmentId, title? }
workspace:writeNoteSegmentSupplementDraftBody { workspaceHandle, supplementId, body, revision }
workspace:readNoteSegmentSupplementDraftBody  { workspaceHandle, supplementId }
workspace:finalizeNoteSegmentSupplementDraft  { workspaceHandle, workspaceId, memoryId, segmentId, supplementId, title, body }
workspace:discardNoteSegmentSupplementDraft   { workspaceHandle, supplementId }
```

不 generic 化以保持事务边界清晰；audio recording draft / supplement recording draft 同样保留独立 channel。

## 8. Note Segment create flow（镜像 audio）

1. 用户点击 FAB note action（启用 disabled 状态）
2. App 立即调 `createNoteSegmentDraft` → main 在 `.reo/drafts/segments/<segId>/` 创建 `segment.md` 草稿（frontmatter title default `笔记N`，body 空），返回 `segmentId`
3. App 进入 `NoteEditorOverlay`（覆盖 AppShell panel 内容区，与 `RecordingOverlay` 同 layer）
4. Overlay mount → 拉草稿 body → editor adapter 实例化（subset 检测决定 normal vs raw mode）
5. 用户编辑 → throttled（400ms idle）`writeNoteSegmentDraftBody` + localStorage recovery marker 同步更新
6. 用户点"完成"或 Cmd+S → `finalizeNoteSegmentDraft`（main 在 lock 下事务 move 草稿 → `memories/<mem>/segments/<seg>/`、写 manifest `kind: 'note' / bodyByteLength`、刷父 Memory summary）
7. 成功后 App seed Memory detail cache（note segment projection 合入 `segments[]`）、关闭 overlay、Memory Studio 选中新 segment
8. ESC（dirty）→ 二次确认 AlertDialog；选丢弃 → `discardNoteSegmentDraft` + 清 marker
9. 异常恢复：进入 workspace 时 App 读 marker → 重开 overlay（与 audio recovery 同入口）

## 9. Note Supplement create flow

1. 用户在 Memory Studio selected Segment 的 `+` 菜单点 "笔记补充"（与现"录音补充"平级）
2. App 调 `createNoteSegmentSupplementDraft`（带 parent Memory / Segment identity）
3. 进入 `NoteEditorOverlay`（标题默认 `补充笔记N`）
4. throttled draft write + marker
5. 完成 → `finalizeNoteSegmentSupplementDraft` → main 写到 parent Segment 的 `supplements/<sup>/supplement.md` + manifest
6. 成功 response 返回 `{ memory, segment (parent), supplement }` → 与现有 audio supplement finalize 完全同构，自动切到新 supplement tab

## 10. Markdown Content Surface

- 替换 Memory Studio 现有 `SegmentTranscriptView` 直接渲染位
- 容器：feature-local primitive `MarkdownContentSurface`，传入 `outcome: AudioTranscriptOutcome | NoteBodyOutcome` 与 `copy`
- Audio kind：继续走现有 `SegmentTranscriptView` outcome（loading / error / success / running / failed-retryable / running-overwrite）
- Note kind：outcome（loading / error / empty / ready），ready 时挂 BlockNote read-only 实例渲染 body；空态 `这条笔记暂无内容。`；不显示编辑工具栏
- 容器右上角 expand icon button（`Maximize2`），点击进入沉浸式编辑（mode=edit）
- 复用 `edge-fade-y scrollbar-hover` 全局 utilities；select-text 行为一致
- 单一渲染管线：BlockNote 既负责编辑也负责只读预览（视觉一致性）

## 11. 沉浸式编辑器 lifecycle

- Component：`NoteEditorOverlay`，feature-local
- Layer：覆盖 AppShell panel 内容区（与 `RecordingOverlay` 同高度策略）；不开第二窗口
- 模式：
  - **create**：`createNoteSegmentDraft` → mount，body 空
  - **edit**：mount 时读 `segment.md` baseline content + 计算 `baselineContentHash`，进入编辑
- 编辑器选择：mount 时对 source markdown 执行 subset 检测
  - subset 内 → BlockNote normal mode
  - subset 外 → Raw mode（plain `<textarea>` + 等宽字体 + 行号 + `select-text`），protect markdown 原样
- Throttled draft write + recovery marker 同 §8
- Cmd+S / "完成" → create flow 走 finalize；edit flow 走 `writeSegmentContent`（带 `baselineContentHash`）
- staleness（`ERR_SEGMENT_CONTENT_STALE`）→ banner + 用户选择 `保留我的修改`（强制重写并提交新 baseline）/ `使用磁盘版本`（放弃 unsaved 重新 mount）
- ESC dirty 二次确认；保存中阻止重复 submit；保存失败 toast 复用现有 root toast 模式
- 阻塞：编辑器 open 时阻止录音 overlay 启动、阻止切 Memory / sidebar 走法、阻止进入 settings（与 `RecordingOverlay` 同策略；允许 Memory rail 折叠等不破坏 dirty 的动作）

## 12. Memory Studio per-kind dispatch

- `selected segment.type='audio'` → 上方 audio player（waveform + 控件）+ 下方 `MarkdownContentSurface`(audio transcript outcome)
- `selected segment.type='note'` → 上方 player 区域显示静态占位文案 `未来：笔记可被朗读` + 下方 `MarkdownContentSurface`(note body outcome)
- Segment card preview：
  - audio：现有 waveform glyph + duration
  - note：line icon (`PencilLine`) + 首段文本预览（`text-body-sm text-muted-foreground line-clamp-2`），不显示 duration
- Segment timeline：跨 kind 通用，仅显示 `createdAt`
- Content tab rail (Supplement tabs)：tab icon 区分 kind（audio = `Mic`，note = `PencilLine`），渲染容器同 `MarkdownContentSurface`
- `+` 菜单：新增 "笔记补充"，与"录音补充"平级；只依赖父 Segment identity，不依赖 kind
- More 菜单转录组：见 §5 audio / note 变体

## 13. Attachments 完整合同

### 目录与命名

```
memories/<memId>--<memTitle>/segments/<segId>--<segTitle>/
  segment.md
  attachments/                     # 仅在 segment.md 引用本地资源时按需创建
    <sha256-prefix>--<safe-original-stem>.<ext>
  supplements/<supId>--<supTitle>/
    supplement.md
    attachments/                   # supplement 自有 attachments，与父 segment 隔离
```

- 命名：`<sha256-12-prefix>--<safe-original-stem>.<ext>`
  - sha256 前缀提供 dedup 与外部 rename 抗性
  - `safe-original-stem` 保留可读性（与 `isSafeWorkspaceDirectoryName` 同套字符规则，去掉路径分隔符与控制字符）
  - 扩展名从 mimeType 派生（白名单内），不信任原文件名扩展
- 父目录隔离：segment 与每个 supplement 各持独立 `attachments/`，不共享

### 引用语法

- 仅允许相对路径：`![alt](attachments/<filename>)`
- 复用 `validateWorkspaceRelativeResourcePath`（`src/main/workspaceMarkdownObjects.ts:51`）：
  - 拒绝绝对路径、scheme URL、`..` 出逃、空字符串
  - 必须 `attachments/` 前缀
- 外部 agent 写入的 markdown 若包含其他引用形式（`./attachments/...`、`<image>` HTML、`reo-attachment://...`），Reo 投影读取时不破坏正文，但 BlockNote 不识别则触发 raw mode

### 文件合同硬约束（initial cap）

- 允许 mimeType：`image/png` / `image/jpeg` / `image/webp` / `image/gif`
- 禁止：`image/svg+xml`（可执行 JS）、HTML、PDF、video / audio（后续独立 spec）
- 单文件 ≤ 25 MiB（main 在写入前 chunk 校验）
- 同 segment 下 `attachments/` 体积软上限 100 MiB（超过 IPC response 带 warning 字段，不阻断）
- 所有读写 no-follow；`attachments/` 自身、leaf file 任一层为 symlink 则拒绝

### IPC

```
workspace:saveSegmentAttachment
  request: { workspaceHandle, workspaceId, memoryId, segmentId, supplementId?,
             originalFilename, mimeType, payload: Uint8Array (≤ 25 MiB) }
  main: lock → 校验 → 计算 sha256 → 分配 stable filename → no-replace atomic write
        → fsync attachments/ → 不刷 Memory summary（attachments 不入 manifest 字段）
  response: { relativePath: 'attachments/<stable-name>' }
  errors: ERR_ATTACHMENT_UNSUPPORTED_MIME / ERR_ATTACHMENT_TOO_LARGE /
          ERR_ATTACHMENT_WRITE_FAILED / ERR_WORKSPACE_UNSAFE_PATH / ERR_WORKSPACE_LOCK_LOST

workspace:listSegmentAttachments
  request: { workspaceHandle, workspaceId, memoryId, segmentId, supplementId? }
  main: 枚举普通文件 → 白名单 ext 过滤 → no-follow
  response: { attachments: [{ relativePath, byteLength, mimeType }] }
```

不引入 `deleteAttachment` 显式 IPC：

- segment / supplement delete 会随目录一起进 `.reo/trash`，attachments 跟随
- 引用被移除产生的 orphan 留在原地，已知 follow-up（独立 `cleanupOrphanAttachments` spec）

### 删除 / 恢复

- Segment / Supplement 删除经 `.reo/trash/segments/...` / `.reo/trash/supplements/...` 整体 move（现有 audio 路径），`attachments/` 子目录跟随
- Restore 同
- Orphan attachments 本 spec 不自动 GC

## 14. `reo-attachment://` custom protocol

- **scheme**：`reo-attachment`
- **URL 结构**（两条 path pattern，明示 segment vs supplement attachment）：
  - segment attachment：`reo-attachment://<workspaceId>/segments/<segmentId>/<filename>`
  - supplement attachment：`reo-attachment://<workspaceId>/segments/<segmentId>/supplements/<supplementId>/<filename>`
  - host = `workspaceId`；main 解析时严格校验当前 active handle 的 `workspaceId` 与 host 匹配，不匹配 deny；URL 必须严格匹配上述两条 pattern 之一，否则 404
- **`registerSchemesAsPrivileged`**（必须在 `app.ready` 前注册）：

  ```ts
  { scheme: 'reo-attachment',
    privileges: { secure: true, supportFetchAPI: true, corsEnabled: false, stream: true } }
  ```

- **handler**（与 `reo-app://` 同 session 内注册）：
  - 仅响应 GET
  - 通过 main-only `EntityPathResolver` 解析 segment / supplement 路径，拼 `attachments/<filename>`
  - 二次 no-follow 校验 leaf 是普通文件、扩展名在白名单
  - 返回 stream + 正确 `Content-Type` + `Cache-Control: no-store`
  - 任何校验失败 → 404，不泄露 path
- **生产 CSP 更新**：`img-src 'self' blob: reo-attachment:`（保持 `media-src 'self' blob:` 不变；不加 `script-src` / `style-src`）
- **navigation**：existing `will-navigate` + `setWindowOpenHandler` 已 deny 非 `reo-app://`；保持不变。`reo-attachment://` 仅由 `<img src=>` / fetch 使用
- **permission policy**：不新增；image fetch 不需要 permission

### Renderer 插入流程

1. BlockNote 图片 block 用户粘贴 / 拖拽 → renderer 截获 Blob
2. 校验 mimeType / size（renderer 侧 early reject）
3. `saveSegmentAttachment` IPC → 取回 `relativePath`
4. 写入 BlockNote 图片 block url = `relativePath`（markdown 序列化为 `![alt](attachments/...)`）
5. Read-only 预览（`MarkdownContentSurface`）需要把 markdown 中的 `attachments/...` 映射为 `reo-attachment://<workspaceId>/segments/<segmentId>/[supplementId/]<filename>` 后传给 BlockNote read-only renderer

## 15. Editor subset / round-trip gate / fallback decision

### Supported subset（normal mode 接管）

Headings (h1-h6) · paragraphs · ul / ol · task lists · blockquote · code fence (含 lang hint) · inline code · link · image（仅 `attachments/...` 相对引用）· emphasis (em / strong) · strikethrough · hard break · table (GFM 标准)

### Raw mode 触发（subset 外）

footnote (`[^x]`) · math (`$...$` / `$$ ... $$`) · callout / admonition (`::: note ... :::`) · definition list · MDX (`import` / `{` JSX) · 非 attachments 引用的图片 / 链接 scheme · 未知 inline HTML（除 attachments img）· frontmatter 之外的额外 YAML / TOML 块

进入 raw mode：plain `<textarea>` + 等宽字体 + 行号 + `select-text`；protect markdown 原样；保存路径同 normal mode（`writeSegmentContent` 带 `baselineContentHash`）。

### Round-trip gate（CI 强制）

- Fixture suite：≥ 20 markdown 样本，覆盖每个 subset feature + 已知 BlockNote bug（#1762 blockquote、#826 checklist）+ raw mode 触发样本
- Test pipeline：input → `tryParseMarkdownToBlocks` → `editor.document` → `blocksToMarkdownLossy` → 再 `tryParseMarkdownToBlocks` → assert deep-equal `editor.document`
- Pass 阈值：subset 内 100% pass；subset 外 100% raw mode 触发
- 任一 subset fixture 失败 → CI red；进入 editor fallback decision

### shadcn 集成方案（选型 in spike #1）

- `@blocknote/shadcn` 要求 injected components no-Portal，与 Reo Radix DropdownMenu / Popover / Tooltip 冲突
- **Spike #1 可行路径**：`@blocknote/mantine`（不接 shadcn 组件；编辑器内部 mantine portals 不影响 Reo Radix）
- **Spike #1 备选路径**：裸 `BlockNoteView` + custom CSS via Tailwind v4 `@source` directive + 手写 theme bridge 映射 Reo design tokens
- **不选**：`@blocknote/shadcn`（强冲突）
- spike #1 输出 adapter mount evidence；最终 editor decision 由 sub-spec (b) 前置收口

### Editor fallback decision

Spike #2 已触发 BlockNote fallback evaluation，但 Milkdown fallback 没有通过当前 markdown-truth gate。因此 sub-spec (b) 前必须先完成更窄的 editor decision：

- 可接受路径必须在 ≥ 20 fixtures 下满足 subset 100% pass、raw trigger 100% 正确。
- 若继续使用 BlockNote，必须缩小 normal-mode subset 或修复 BlockNote 红项后再进入实现。
- 若继续评估 Milkdown，必须解决 list / task-list serialization 红项后再进入实现。
- 无论最终 adapter 是 BlockNote、Milkdown 或更窄自研 adapter，接口仍保持 markdown-first、subset gate、raw mode、`reo-attachment://` 集成不变。

## 16. External edit / dirty / conflict

- 默认：visibility refresh + dirty 拒覆 + save-time staleness check
- 进入 visible → `workspace:readWorkspaceSnapshot` 重读，Memory detail cache 后台刷新
- 若当前 `NoteEditorOverlay` open 且 dirty：刷新跳过对应 segment 的 body 字段，保留 renderer draft；顶部 banner `磁盘内容已变化。保存时将进行冲突检查。`
- Save 路径：renderer 始终带 `baselineContentHash`（mount 时 sha256 of body）
- Main lock 内：读现状 → 计算 hash → 比对：
  - 一致 → 写入新 body，返回新 contentHash
  - 不一致 → 返回 `ERR_SEGMENT_CONTENT_STALE`，response 带磁盘当前 body text + 当前 hash
- Renderer 收到 stale → AlertDialog 两选项：
  - `保留我的修改`：renderer 用磁盘 hash 作新 baseline 再发一次 save（强制覆盖）
  - `使用磁盘版本`：放弃 unsaved，editor reload 为磁盘 body
- 无 file watcher（不动 `electron.md` 已有 watcher 边界）
- ASR backfill 写 audio Segment transcript：仍走现 audio path，但通过同 lock 串行；audio Segment 的沉浸式编辑器 open 时 `baselineContentHash` 守住

## 17. `docs/current/*` 更新清单

| 文档              | 必须更新内容                                                                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `foundation.md`   | 多模态长期轨道首条 active initiative（note）启动注记                                                                                                                                                                                                         |
| `architecture.md` | 不新增目录；`src/main` / `src/renderer/src/workspace` 内现有结构承载 note module；记 `reo-attachment://` 是第二个自定义 protocol                                                                                                                             |
| `product.md`      | "已实现 Segment kind" 列表加 note；Memory Studio per-kind dispatch；FAB 笔记入口启用；attachments 在 product 边界（仅 markdown 引用，非独立 Segment）的说明                                                                                                  |
| `roadmap.md`      | 产品本质长期轨道"多模态 Segment 类型"标记 note 进入 active；其余条目保持长期                                                                                                                                                                                 |
| `electron.md`     | 新增 IPC channels（10 个 generic + note draft + attachments）；新增 `reo-attachment://` 安全合同；CSP `img-src` 更新；privileged scheme 注册时序；现有麦克风 / ASR / voice settings 边界不动                                                                 |
| `data.md`         | multi-kind discriminated projection；Memory summary 字段重命名表；note manifest 字段；`baselineContentHash` 字段；query helpers 重命名；`segmentDeleteProjection` 扩展；attachments 文件合同（不入 manifest，纯文件真源）；orphan attachments 已知 follow-up |
| `flow.md`         | note create / finalize / discard flow；`NoteEditorOverlay` lifecycle；subset 检测分支；attachment paste flow；external edit conflict flow；ASR vs immersive `baselineContentHash` 串行性                                                                     |
| `frontend.md`     | `NoteEditorOverlay` primitive 边界；`MarkdownContentSurface` primitive；FAB note action 启用；Memory Studio per-kind dispatch；Segment card note preview；More 菜单 note 变体                                                                                |
| `quality.md`      | TDD 新增条目（main + renderer + round-trip gate fixture + attachments + protocol）；spike list 引用；`verify:quick` 覆盖范围说明                                                                                                                             |
| `design-system/`  | 不新增 token；评估 `MarkdownContentSurface` typography 复用 `text-body leading-body`、`select-text`、`edge-fade-y scrollbar-hover`                                                                                                                           |

## 18. TDD / verification checklist（implementation 阶段执行）

### Main tests

- `workspaceMarkdownObjectKindSchema` 接受 `'audio' | 'note'`
- segment / supplement manifest schema 接受 `kind='note'` + `bodyByteLength`
- `createNoteSegmentDraft` / `createNoteSegmentSupplementDraft`：草稿目录、frontmatter title default、空 body
- `writeNoteSegmentDraftBody` revision check + throttle 边界
- `finalizeNoteSegmentDraft` / `finalizeNoteSegmentSupplementDraft`：staging dir、marker、no-replace expose、parent identity recheck、manifest write、index refresh、failure rollback
- `discardNoteSegmentDraft` / `discardNoteSegmentSupplementDraft` 清理
- `readSegmentContent` / `readSegmentSupplementContent` 按 manifest kind 分派
- `writeSegmentContent` / `writeSegmentSupplementContent`：`baselineContentHash` 比对、kind 分派、`ERR_SEGMENT_CONTENT_STALE`、audio kind 仍触发 `markSegmentTranscriptionAttemptSuccess`
- 跨 kind 子图：audio Segment + note Supplement / note Segment + audio Supplement
- `saveSegmentAttachment`：mime 白名单、size cap、sha256 stable filename、symlink 拒、unsafe path 拒、no-replace、attachments 父目录按需创建、fsync
- `listSegmentAttachments`：白名单过滤、no-follow
- segment / supplement delete + restore：attachments 随目录入 trash + 恢复
- `reo-attachment://` protocol handler：scheme privilege 时序、workspaceId host 校验、path containment、no-follow、404 不泄露 path
- 生产 CSP 头包含 `img-src 'self' blob: reo-attachment:`

### Renderer tests

- FAB note action 启用、`disabled` 改 `onSelect`
- `NoteEditorOverlay` mount → create flow / mount → edit flow / dirty ESC 二次确认 / discard
- subset detection → BlockNote normal vs raw mode 切换边界
- throttled draft write + recovery marker 写入 / 重启重开
- finalize 后 Memory detail cache merge + selected Segment 切换
- `MarkdownContentSurface` audio outcome / note outcome 渲染、空态、loading、failed-retryable、expand icon → 沉浸式
- Segment card per-kind preview（waveform vs `PencilLine` + body excerpt）
- Memory Studio per-kind dispatch：audio 保留 player；note 显示占位文案
- SegmentSupplement note tab rendering / drag 重排不破坏 kind
- 实体 More 菜单 audio / note 变体
- `segmentDeleteProjection` 扩展：跨 kind summary 重算 + `noteSegmentCount` / `hasAnyNote` 不被压制
- external edit visibility refresh：dirty 时 body 字段不被覆盖
- `ERR_SEGMENT_CONTENT_STALE` 触发 AlertDialog → 两选项行为
- attachment paste → IPC 调用 → image block 引用插入
- attachment 预览：`attachments/x.png` → `reo-attachment://...` URL 映射
- `workspaceHandleScopedContentQueryBelongsToWorkspace` 覆盖 note content query

### Round-trip gate

- ≥ 20 markdown fixtures 文件落到 `test/renderer/fixtures/note-roundtrip/`
- CI script：subset fixture pass 100%；raw fixture 全部进 raw mode 检测；任一红 → CI red
- 输出 subset / raw 分类报告 JSON 供 spec evidence 引用

### 操作验证

- 启动 → FAB 笔记 → 写入 → 保存 → 重启 → 内容仍在
- 写入过程中 force-kill → 重启 → recovery marker 恢复编辑器
- 外部 vim 改 `segment.md` → renderer visible → dirty 时 banner / clean 时自动 reload
- 粘贴图片 → `attachments/` 出现 → 关闭重开 → 预览正常
- audio Segment 下新建 note Supplement → tab rail 切换
- Segment delete → attachments 入 trash → restore 恢复

### `npm run verify:quick` 必须全绿

## 19. Blockers / Risks

1. **Notion-like editor vs Reo markdown 真源**：BlockNote 与 Milkdown 在 Stage 1 fixtures 中都未达到当前 subset 100% gate；sub-spec (b) 前必须先收口 editor decision
2. **BlockNote shadcn no-Portal 与 Reo Radix Portal 冲突**：`@blocknote/shadcn` 不进入候选；Spike #1 仅证明 `@blocknote/mantine` / 裸 `BlockNoteView` 可 mount，不代表 editor decision 已收口
3. **BlockNote 已知 issue（#1762 blockquote、#826 checklist）** 影响主用例的可能性
4. **`reo-attachment://` 是 Reo 第二个自定义 protocol**：Electron 安全面扩展；同 session 注册、CSP 更新、navigation deny、permission 不放开；spike #3 dev runtime 验证
5. **ASR backfill 与 audio Segment 沉浸式编辑并发**：靠 `baselineContentHash` 拦截，但 UX 需 banner 提示；spec 内已含
6. **Orphan attachments 累积**：本 spec 不自动 GC，已知 follow-up；用户文件夹可见，不破坏数据安全
7. **Bundle size**：BlockNote core + react + mantine ≈ 400 KB gzipped 量级；不阻塞但 spike 必须测量
8. **跨 kind subgraph 删除恢复边界**：audio Segment 下 note Supplement 删除恢复需独立测试覆盖
9. **路线图门禁**：本 initiative 启动产品本质长期轨道，需要在 sub-spec (a) 启动前与 ADR 0006 与 `roadmap.md` 复核确认 audio 主链已"稳固"

## 20. Spike 清单（implementation 代码改动前必须完成）

| #   | Spike                                                                                                                                                   | 输出                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | BlockNote current package 在隔离 sandbox 项目 mount + Tailwind v4 集成 + Radix Portal 冲突解决方案（`@blocknote/mantine` vs 裸 view + custom CSS）      | adapter 选型证据 + bundle size 报告 + Reo design system 视觉一致性截图 |
| 2   | Markdown round-trip fixture suite（≥ 20 fixtures，覆盖 subset + raw triggers + 已知 BlockNote issues）                                                  | subset / raw 分类清单 JSON + pass/fail 报告                            |
| 3   | `reo-attachment://` protocol POC：dev runtime 注册时序、CSP 加载、`<img>` fetch、navigation deny、`workspaceId` host 校验、path containment、symlink 拒 | runtime 证据（截图 + 日志）+ CSP header dump                           |
| 4   | Note draft transaction：复用 `.reo/drafts/segments/` + `workspaceDirectoryTransactions`，验证空 `audio.webm` 不破坏现有 unsafe-payload 校验             | main test 报告 + 不破坏 audio 现行测试套件                             |
| 5   | `baselineContentHash` staleness flow：sha256 性能（典型 5 KB markdown）、lock 内 read-compare-write 顺序、`ERR_SEGMENT_CONTENT_STALE` 信封字段          | timings + happy / conflict 双路径证据                                  |
| 6   | External edit visibility refresh + dirty body 隔离：模拟 Finder vim 改动后，renderer 进入 visible 仅刷 Memory detail 非编辑字段                         | renderer test 报告                                                     |

所有 spike 不进入主仓：独立目录 / 临时分支 / sandbox 项目；证据回写 `evidence/` 子目录。

## 21. 实施流程合同（phase gate + implementation-notes）

本 initiative 4 个 implementation sub-spec 都必须遵守：

### Phase gate

每个 sub-spec 的 plan 按 phase 切分。Phase 完成定义：

1. `npm run verify:quick` green
2. `/review` pass（无未解 BLOCKER / MAJOR）
3. `$ycksimplify` pass（已用尽可消化的复用与简化机会）

任一 gate 未通过都不进入下一 phase。用户明确豁免才能跳过，豁免必须写进 `implementation-notes.md`。

### implementation-notes.md

每个 sub-spec 在 `docs/specs/<slug>/implementation-notes.md` 维护：

- 规范中未提及的决策（带时间戳 + commit / PR 锚点）
- 必须做出的更改（与 spec 不一致的原因）
- 权衡取舍
- 用户需要了解的其他事项（包含 phase gate 豁免）

Spec 归档时随 spec 一起进入 `docs/archive/specs/<slug>/`。

ad-hoc 决策累积超过 spec 设计 30% → 触发 spec 重写而非继续累积。

## 22. 下一 session 用于正式 implementation plan 的 copy-paste prompt

```
按 docs/archive/specs/2026-05-19-0111-note-foundation-design/README.md 推进 note foundation 实现准备。

本 session 任务：
1) 先跑 spike #1（BlockNote 环境 mount + Portal 冲突解决）与 spike #2（round-trip
   fixture suite），把选型证据与 fixture pass/fail 报告写入
   docs/archive/specs/2026-05-19-0111-note-foundation-design/evidence/。
2) 跑 spike #3（reo-attachment:// protocol POC），输出 CSP / path containment /
   navigation deny 的 dev runtime 证据。
3) 基于 spike 结果撰写 implementation plan，拆为 4 个 sub-spec 顺序执行：
   (a) multi-kind contract（schema + manifest + projection + Memory summary 重命名）
   (b) note Segment / Supplement create/edit + NoteEditorOverlay + MarkdownContentSurface
   (c) attachments 合同 + reo-attachment:// protocol + CSP
   (d) external edit conflict（baselineContentHash + ERR_SEGMENT_CONTENT_STALE + 冲突 AlertDialog）
4) 不进入主仓代码改动；所有 spike 在独立目录 / 临时分支 / sandbox 项目执行。
5) Spike evidence 已完成；可启动 (a) 的 RED 测试，但 (b) 前必须先完成 editor decision 收口。
6) 每个 sub-spec 必须独立 spec 落地、独立 verify:quick、独立归档。
7) 每个 sub-spec 在对应 spec 目录维护 implementation-notes.md，持续记录 spec 未提及的
   决策、被迫的更改、权衡、用户需要了解的事项。
8) 每个 phase 完成必须通过 /review 与 $ycksimplify gate；
   verify:quick green + review pass + ycksimplify pass 三件齐才能进入下一 phase；
   豁免必须写进 implementation-notes。
```

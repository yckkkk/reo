# Data Contracts

## Conceptual model

| Entity           | Meaning                                        | Source of truth                                                     | Relationships                                         |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| Workspace        | 本地记忆工作区                                 | `.reo/workspace.json` + app DB recent index                         | has many memories/recordings                          |
| Memory           | 一条可回访的记忆                               | `memories/<id>/memory.json`                                         | belongs to workspace; has recordings/text/reflections |
| Recording        | 一次音频录制                                   | `memories/<memoryId>/recordings/<id>/recording.json` + `audio.webm` | belongs to workspace/memory                           |
| AudioAsset       | audio file metadata/projection                 | file truth + DB index                                               | belongs to recording                                  |
| Transcript       | 用户可编辑文字稿                               | `memories/<memoryId>/recordings/<id>/transcript.md`                 | belongs to recording/memory                           |
| Reflection       | 用户补充反思                                   | `memories/<memoryId>/recordings/<id>/reflections.md`                | belongs to recording/memory                           |
| EntitySuggestion | future extracted person/place/topic suggestion | future app DB                                                       | belongs to memory/reflection                          |
| ProcessingJob    | future STT/film/import/indexing job            | app DB                                                              | belongs to workspace/memory/asset                     |
| User/AuthSession | future auth identity                           | Better Auth tables                                                  | does not own workspace content                        |

## Current source-of-truth rules

- 用户内容真源：workspace files。
- `.reo/index.json`：可重建 UI index，不是用户内容真源。
- SQLite：只在引入后拥有 app index、recent workspace、relationship、processing job、auth/session 等 app state；不得替代 audio/transcript/reflections。
- Query cache：只缓存 main-backed projection。
- Renderer state：只保存临时控制器、draft、focus、Blob URL。

## File truth model

```text
memories/<memoryId>/memory.json
  - memoryId
  - title
  - sourceKind
  - createdAt
  - updatedAt
  - recordingIds

memories/<memoryId>/recordings/<recordingId>/recording.json
  - recordingId
  - memoryId
  - status
  - title
  - createdAt
  - finalizedAt
  - durationMs
  - audioByteLength
  - transcriptPath
  - reflectionsPath
```

`.reo/drafts/recordings/<recordingId>/` can hold draft audio and draft metadata while capture is active. Drafts are Reo-managed transaction state, not user-facing memories. Finalize either creates a new Memory and moves the draft into it, or attaches the finalized recording to an existing Memory.

## Drizzle schema target

Drizzle + `better-sqlite3` 是锁定技术栈，但 migration 只能在 DB foundation slice 激活。以下 schema 是设计目标，不代表本 spec 要创建 migration。

```text
app_workspaces
- id text primary key
- title text not null
- root_fingerprint text not null unique
- display_path text not null
- schema_version integer not null
- last_opened_at integer
- created_at integer not null
- updated_at integer not null

memories
- id text primary key
- workspace_id text not null references app_workspaces(id) on delete cascade
- title text not null
- occurred_at integer
- created_at integer not null
- updated_at integer not null
- source_kind text not null

recordings
- id text primary key
- workspace_id text not null references app_workspaces(id) on delete cascade
- memory_id text not null references memories(id) on delete cascade
- file_recording_id text not null
- title text not null
- status text not null
- duration_ms integer
- byte_length integer not null
- created_at integer not null
- finalized_at integer

audio_assets
- id text primary key
- workspace_id text not null references app_workspaces(id) on delete cascade
- recording_id text not null references recordings(id) on delete cascade
- relative_path text not null
- mime_type text not null
- byte_length integer not null
- duration_ms integer
- waveform_peaks_json text

text_documents
- id text primary key
- workspace_id text not null references app_workspaces(id) on delete cascade
- memory_id text not null references memories(id) on delete cascade
- recording_id text references recordings(id) on delete cascade
- kind text not null
- relative_path text not null
- word_count integer
- updated_at integer not null

entity_suggestions
- id text primary key
- workspace_id text not null references app_workspaces(id) on delete cascade
- memory_id text not null references memories(id) on delete cascade
- kind text not null
- label text not null
- source_range_json text not null
- status text not null
- created_at integer not null

processing_jobs
- id text primary key
- workspace_id text not null references app_workspaces(id) on delete cascade
- subject_type text not null
- subject_id text not null
- kind text not null
- status text not null
- progress integer
- error_code text
- created_at integer not null
- updated_at integer not null
```

Status/domain constraints：

- `memories.source_kind`: `recording`、`manual_note`、`imported_file`。Current slice 只创建 `recording`。
- `recordings.status`: `draft`、`finalized`、`discarded`、`failed`。Current UI 只把 `finalized` 记忆投影进 Home；`draft` 只存在于 active recording transaction。
- `audio_assets.mime_type`: current slice 只允许 `audio/webm`，后续格式必须先更新 media validation。
- `text_documents.kind`: `transcript`、`reflection`。
- `entity_suggestions.kind`: `person`、`place`、`topic`、`date`。
- `entity_suggestions.status`: `suggested`、`accepted`、`skipped`、`deleted`。
- `processing_jobs.kind`: `stt`、`film`、`import`、`index`。
- `processing_jobs.status`: `queued`、`running`、`succeeded`、`failed`、`cancelled`。
- `processing_jobs.progress`: nullable integer 0-100；unknown progress must stay null, not 0.

Relationship and update effects：

- `app_workspaces` deletion only deletes app DB projections. It must not delete the user workspace folder unless a separate filesystem delete transaction exists and passes review.
- `memories.workspace_id` cascades when the app projection for a workspace is removed. Deleting a memory projection must also delete or detach related DB projections in the same transaction, but durable workspace files remain governed by filesystem transactions.
- `recordings.memory_id on delete cascade` mirrors the file truth that recordings live under a memory directory. Durable recording files are still deleted only by an explicit workspace file transaction.
- `audio_assets.recording_id on delete cascade` is app-index cleanup; the actual audio file is deleted only by workspace file transaction.
- `text_documents.memory_id` is required. `recording_id` is required for recording transcript/reflections and may be null only for a future memory-level text document.
- `entity_suggestions.memory_id on delete cascade` removes reviewable suggestions with the memory projection. Accepted entities must define export/delete behavior before entity graph implementation.
- `processing_jobs.subject_type/subject_id` intentionally does not use a direct FK because SQLite/Drizzle cannot enforce one polymorphic FK across memory, recording, audio asset, text document and future film/import subjects. Subject validity is enforced by Zod contract, owner-specific creation functions and cleanup tests. If a job kind becomes stable enough to need FK enforcement, it must split into explicit nullable subject columns or a job-specific table.
- Primary IDs are immutable. Title/status/timestamps may update through owner-specific mutations only; no broad `update any table` helper is allowed.
- Memory title and recording title updates must write workspace file truth first (`memory.json` or `recording.json`), then update DB projection if DB is active. If DB update fails after file write, the next index rebuild reconciles from file truth.

Indexes：

- `memories(workspace_id, occurred_at)`
- `recordings(workspace_id, finalized_at)`
- `audio_assets(recording_id)`
- `text_documents(workspace_id, kind, updated_at)`
- `entity_suggestions(memory_id, status)`
- `processing_jobs(workspace_id, status, kind)`

DB activation trigger：

- 需要跨 workspace recent list。
- 需要搜索、过滤、排序、entity relationship 或 processing jobs。
- 需要 Better Auth session persistence。
- 需要比 `.reo/index.json` 更强的 app index，但仍可从 workspace files 重建。

## Query keys

| Data               | Query key                                                               | Owner                         | Invalidation                                    |
| ------------------ | ----------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------- |
| Workspace snapshot | `['workspace', 'snapshot', workspaceId]`                                | TanStack Query                | initialize/open/finalize/save/index rebuild     |
| Memory detail      | `['workspace', 'memory-detail', workspaceId, memoryId]`                 | TanStack Query                | recording finalize, transcript/reflections save |
| Recording detail   | `['workspace', 'recording-detail', workspaceId, memoryId, recordingId]` | TanStack Query                | finalize, metadata update                       |
| Audio manifest     | `['workspace', 'audio-manifest', workspaceId, memoryId, recordingId]`   | TanStack Query or direct read | recording finalized/audio replaced              |
| Global/full search | `['workspace', 'search', workspaceId, query, filters]`                  | future only                   | not current implementation                      |

`workspaceHandle` 不进入 query key。

Home local search does not require DB activation. It filters the loaded workspace snapshot and cannot claim full-text, cross-workspace, entity, semantic or tag search.

## Local derived filters

Home local search/filter is derived component state over the loaded workspace snapshot, not a TanStack Query key. It can store:

- `query`
- selected month
- selected recording status
- transcript/reflections presence filter

It must reset or recompute from the latest snapshot after recording finalize, transcript/reflections save or index rebuild.

## Form and client state

- React Hook Form：create/open workspace form draft。
- Feature reducer：recording lifecycle。
- Component state/ref：MediaRecorder controller、append queue、timer、Blob URL、autosave dirty state。
- Zustand：只有 sidebar covered/expanded、session 内 sidebar width、selected workspace shell state 等跨 subtree 状态需要持久/共享时引入；sidebar width 当前 clamp 240-520px，跨 session 持久化另开偏好设置 gate。

## Error contract

Error envelope 必须包含：

- `code`
- `message`
- `dataRetention`
- optional `recoveryAction`

用户文案必须说明下一步，例如选择不同文件夹、重试录音、保留草稿、关闭其他 Reo 窗口。

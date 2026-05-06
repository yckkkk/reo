# 数据契约

## 概念模型

```text
Workspace 1 -- * WorkspaceEntry
WorkspaceEntry 1 -- 1 Recording
Recording 1 -- 1 AudioArtifact
Recording 1 -- 1 TranscriptDocument
Recording 1 -- 1 ReflectionDocument
Recording 0..1 -- 1 RecordingDraft
Workspace 1 -- 1 WorkspaceIndex
```

## 权属规则

- Workspace folder 是 durable user content source。
- `.reo/workspace.json` 是 Reo workspace metadata。
- `.reo/index.json` 是 rebuildable UI index。
- Recording files 是 ordinary user-readable files。
- SQLite 在本 slice 不拥有任何状态。
- TanStack Query 拥有 renderer 对 main-backed data 的 snapshot，不是 durable truth。
- Submit 前的 form draft 属于 React Hook Form。
- In-progress recording lifecycle 属于 feature-local reducer。

## Workspace 文件结构

```text
<workspace>/
  AGENTS.md
  .reo/
    workspace.json
    index.json
    workspace.lock
  recordings/
    <recording-id>/
      audio.webm
      transcript.md
      reflections.md
      recording.json
```

First product slice 不创建 `photos/`、`videos/`、`files/`、`notes/` 或 `films/` 目录。

## 持久化 schema

### `.reo/workspace.json`

| 字段            | 类型             | 归属         | 可重建 | 用户可编辑            | 失败行为                              |
| --------------- | ---------------- | ------------ | ------ | --------------------- | ------------------------------------- |
| `schemaVersion` | literal `1`      | Reo          | no     | no                    | unsupported version blocks write      |
| `id`            | UUID string      | Reo          | no     | no                    | missing blocks open                   |
| `title`         | non-empty string | user via Reo | no     | yes through future UI | invalid blocks save                   |
| `description`   | string           | user via Reo | no     | yes                   | invalid defaults empty only on create |
| `createdAt`     | ISO string       | Reo          | no     | no                    | invalid marks unsupported             |
| `updatedAt`     | ISO string       | Reo          | no     | no                    | invalid marks unsupported             |

### `.reo/index.json`

| 字段            | 类型                         | 归属 | 可重建 | 用户可编辑 | 失败行为                          |
| --------------- | ---------------------------- | ---- | ------ | ---------- | --------------------------------- |
| `schemaVersion` | literal `1`                  | Reo  | yes    | no         | rebuild from `recordings/`        |
| `entries`       | array of recording summaries | Reo  | yes    | no         | corrupt index ignored and rebuilt |
| `rebuiltAt`     | ISO string                   | Reo  | yes    | no         | regenerated                       |

Index entries contain `id`、`type`、`title`、`createdAt`、`updatedAt`、`durationMs`、`status` and relative refs only.

### `recordings/<id>/recording.json`

| 字段            | 类型                    | 归属           | 可重建            | 用户可编辑  | 失败行为                                                 |
| --------------- | ----------------------- | -------------- | ----------------- | ----------- | -------------------------------------------------------- |
| `schemaVersion` | literal `1`             | Reo            | no                | no          | unsupported entry marked unsupported                     |
| `id`            | UUID string             | Reo            | no                | no          | folder ignored if mismatch                               |
| `workspaceId`   | UUID string             | Reo            | no                | no          | mismatch marks conflict                                  |
| `title`         | string                  | Reo/user later | no                | future UI   | invalid uses fallback title in UI, no rewrite            |
| `createdAt`     | ISO string              | Reo            | no                | no          | invalid marks recoverable                                |
| `updatedAt`     | ISO string              | Reo            | no                | no          | invalid marks recoverable                                |
| `durationMs`    | non-negative integer    | Reo            | partly from audio | no          | invalid displays unknown duration                        |
| `status`        | `finalized` or `failed` | Reo            | no                | no          | unknown marks unsupported                                |
| `audio`         | `audio.webm`            | Reo            | yes ref only      | no          | missing audio marks failed                               |
| `transcript`    | `transcript.md`         | Reo            | yes ref only      | yes content | missing file creates empty editor only after user action |
| `reflections`   | `reflections.md`        | Reo            | yes ref only      | yes content | missing file creates empty editor only after user action |

### `transcript.md`

- UTF-8 Markdown/plain text。
- User content。
- Autosave writes temp + rename。
- Save failure preserves previous disk file and renderer draft。

### `reflections.md`

- UTF-8 Markdown/plain text。
- User content。
- Independent autosave lifecycle from transcript。

### `audio.webm`

- Original recording audio。
- User content。
- Produced from `audio.webm.part` finalize。
- Reo and AI must not overwrite or delete it without explicit user command。

## Query key 规则

TanStack Query 只在 renderer 存在 main-backed workspace data 时激活。

| key                                       | 归属                  | 数据               | 失效触发                                                       |
| ----------------------------------------- | --------------------- | ------------------ | -------------------------------------------------------------- |
| `['workspace', workspaceId]`              | `workspaceQueries.ts` | workspace snapshot | initialize、open、finalize draft、discard draft、save metadata |
| `['recording', workspaceId, recordingId]` | `workspaceQueries.ts` | recording detail   | save transcript、save reflections、finalize draft              |

In-progress recording chunks 和 editor drafts 不进入 TanStack Query。

`workspaceHandle` 是 main process 内存能力，不进入 query key、不写入 workspace 文件、不跨 app restart 持久化。Renderer query 只用 stable `workspaceId` 和 `recordingId` 标识缓存对象。

## 物理 DB 决策

First product slice 不引入 Drizzle schema。

DB 触发条件：

- Recent workspace list 超出显式 local config 能力。
- Search across many recordings 需要 indexes。
- Large workspace scan 变成用户可感知慢路径。
- Cross-recording relationship queries 出现。
- Auth/session 或 sync 需要 relational persistence。
- Recovery 需要 durable processing state，不能用 workspace files 表达。

在触发条件出现前，DB 继续 deferred，state ownership matrix 的 SQLite column 保持空。

## 冗余校验

| 事实             | 真源                  | 投影                                                 | 同步方向                                               |
| ---------------- | --------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Workspace title  | `.reo/workspace.json` | query snapshot、UI header、`AGENTS.md` creation text | file -> query/UI；`AGENTS.md` first slice 不 live-sync |
| Recording title  | `recording.json`      | index entry、card、overlay                           | recording.json -> index/query/UI                       |
| Transcript text  | `transcript.md`       | editor local draft                                   | editor -> file on autosave；file -> editor on open     |
| Reflections text | `reflections.md`      | editor local draft                                   | editor -> file on autosave；file -> editor on open     |
| Audio bytes      | `audio.webm`          | Blob URL                                             | file -> Blob URL                                       |
| Recording status | `recording.json`      | index/card/overlay                                   | file -> index/query/UI                                 |

## 易变 metadata

`.reo/workspace.lock` 是 runtime lock artifact，不是用户内容，也不是 Codex read-only validation 的稳定 hash 对象。Reo 关闭或 workspace close 后应释放该 artifact；stale lock recovery 只处理 lock artifact，不删除 recording、transcript、reflections 或 audio。

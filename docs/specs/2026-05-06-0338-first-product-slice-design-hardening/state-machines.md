# 状态机

## Workspace 生命周期

```text
none
  -> creating
  -> ready
creating -> failed
ready -> missing
ready -> conflict
ready -> unsupported
missing/conflict/unsupported -> ready after user action
```

## Workspace 创建 form 生命周期

```text
idle
  -> folder_selecting
  -> idle
  -> validating
  -> submitting
  -> submitted

folder_selecting -> canceled -> idle
validating/submitting -> failed -> idle
```

## Recording 生命周期

```text
idle
  -> acquiring
  -> recording
  -> paused
  -> recording
  -> stopping
  -> editing

idle/acquiring/recording/paused/stopping -> failed
acquiring -> idle after user cancel or permission denial without draft
editing -> playback
playback -> editing
```

规则：

- Timer 只统计 active recording time。
- Mock transcript 只在 `recording` 状态推进。
- `stopping` 忽略 duplicate stop。
- 只有 finalize success 或 reopened finalized recording 能进入 `editing`。

## Audio chunk 生命周期

```text
chunk_produced
  -> append_pending
  -> append_committed
append_pending -> append_failed
append_pending -> append_rejected_size
append_committed -> finalized
append_failed -> failed_recoverable
append_rejected_size -> failed_recoverable
```

## Autosave 生命周期

Transcript 和 reflections 各自拥有独立 machine：

```text
saved
  -> dirty
  -> saving
  -> saved
saving -> failed
failed -> retrying -> saving
dirty -> pending_close
```

## Playback 生命周期

```text
loading_audio
  -> ready
  -> playing
  -> paused
ready/playing/paused -> failed
ready/playing/paused -> blob_revoked
```

## Recovery 生命周期

```text
restart_scan
  -> stale_draft_classification
  -> index_rebuild
  -> ready

stale_draft_classification -> corrupt_metadata_handling -> ready_with_recoverable_entries
```

## 状态归属矩阵

SQLite 列在 first slice 中故意保持为空。

| 状态事实                                     | 组件 state | 功能 reducer | React Hook Form | TanStack Query     | Workspace file         | `.reo` metadata                      | SQLite |
| -------------------------------------------- | ---------- | ------------ | --------------- | ------------------ | ---------------------- | ------------------------------------ | ------ |
| Create form title before submit              |            |              | owner           |                    |                        |                                      |        |
| Selected folder result                       | owner      |              |                 |                    |                        |                                      |        |
| Form field validation                        |            |              | owner           |                    |                        |                                      |        |
| Workspace title after create/open            |            |              |                 | projection         |                        | owner                                |        |
| Workspace snapshot loading/error             |            |              |                 | owner              |                        |                                      |        |
| Recording lifecycle during active capture    |            | owner        |                 |                    |                        |                                      |        |
| Current audio append sequence                |            | owner        |                 |                    |                        | projection after write               |        |
| Draft audio bytes                            |            |              |                 |                    | owner `.part`          |                                      |        |
| Final audio bytes                            |            |              |                 |                    | owner `audio.webm`     |                                      |        |
| Local draft transcript text during recording |            | owner        |                 |                    |                        |                                      |        |
| Local draft transcript display scroll/focus  | owner      |              |                 |                    |                        |                                      |        |
| Transcript draft while editing               | owner      |              |                 |                    | projection after save  |                                      |        |
| Transcript persisted text                    |            |              |                 | projection on open | owner `transcript.md`  |                                      |        |
| Reflections draft while editing              | owner      |              |                 |                    | projection after save  |                                      |        |
| Reflections persisted text                   |            |              |                 | projection on open | owner `reflections.md` |                                      |        |
| Autosave status                              | owner      |              |                 |                    |                        |                                      |        |
| Recording entry list                         |            |              |                 | projection         |                        | owner rebuildable index              |        |
| Blob URL for playback                        | owner      |              |                 |                    | source bytes only      |                                      |        |
| Workspace lock                               |            |              |                 |                    |                        | owner `.reo/workspace.lock` volatile |        |
| Workspace handle registry                    |            |              |                 |                    |                        | main memory owner                    |        |

## 冗余校验

- Query data 是 cache projection，不是 durable truth。
- Index entries 为 UI speed 复制 recording metadata；source 是 `recording.json`；rebuild 方向是 recording files -> index。
- Workspace title 会在 create 时写入 `AGENTS.md` 方便 AI 读取；first slice 不做后续 title edits 的 live sync。
- Editor draft 只在 dirty 时复制 disk text；save success 后 source 回到 disk。

# Filesystem Transactions

## Workspace structure

Product-grade first slice target structure：

```text
<workspace>/
  AGENTS.md
  .reo/
    workspace.json
    index.json
    workspace.lock
    drafts/
      recordings/
        rec_<id>/
          recording.json
          audio.webm
  memories/
    mem_<id>/
      memory.json
      recordings/
        rec_<id>/
          recording.json
          audio.webm
          transcript.md
          reflections.md
```

Future wireframe only：

```text
  media/
  imports/
  films/
  thumbnails/
```

这些 future folders 不在当前实现创建，除非有真实 consumer 和 transaction contract。

## Transaction rules

- 所有 workspace writes 由 main process 执行。
- Renderer 不接收真实 root path。
- 每个 workspace handle 绑定 canonical realpath、workspace id、sender identity 和 lock。
- 写入 JSON/markdown 使用 temp file + fsync + rename + parent fsync。
- Audio append 使用单 recording 串行 sequence；同一 recording 只允许一个 append in flight。
- `.reo/index.json` 是 rebuildable；损坏或陈旧时从 finalized memory metadata、recording metadata 和 audio file size 重建。
- Finalize 失败不得留下 metadata finalized 但 index 缺失 summary 的状态。
- Draft recording 在 `.reo/drafts/recordings/rec_<id>/` 中暂存；finalize 先创建 Reo-owned `.reo-finalizing-*` staging directory 并写入 `.reo-finalize-transaction.json` marker，再复制 draft 内容、fsync copied files/tree、完成 finalized metadata 后 rename 到 `memories/mem_<id>/recordings/rec_<id>/` 并 fsync parent。
- Open/rebuild 前只能清理由 Reo 创建的 `.reo-finalizing-*` staging directory，或带 transaction marker 且不是有效 finalized recording 的 target directory，并修复指向缺失 finalized recording 的 `memory.json.recordingIds`。
- `memory.json` 是 Memory 的 durable metadata 真源，至少包含 `memoryId`、`title`、`createdAt`、`updatedAt`、`sourceKind` 和 `recordingIds`。
- Recording 属于一个 Memory；如果用户从 Home 直接开始录音，finalize 必须在同一个事务中创建 `memories/mem_<id>/memory.json` 并绑定 recording。
- 如果用户从现有 Memory detail 开始录音，finalize 必须校验 `memoryId` 属于当前 workspace，并把 recording append 到该 memory。

## Recording draft lifecycle

```text
createDraft
  -> mkdir .reo/drafts/recordings/<id>
  -> write recording.json status=draft
  -> create/append audio.webm
appendAudioChunk
  -> validate sequence
  -> append bytes
  -> ack nextSequence
finalize
  -> stop recorder and wait final chunk
  -> stat audio.webm
  -> create hidden .reo-finalizing-* staging directory
  -> write .reo-finalize-transaction.json marker
  -> copy draft directory contents into staging directory
  -> fsync copied audio/metadata files and staging tree
  -> write transcript.md/reflections.md if missing in staging
  -> write recording.json status=finalized with byteLength in staging
  -> fsync staging tree
  -> rename staging directory into memories/<memoryId>/recordings/<recordingId>
  -> fsync recording parent directory
  -> update memory.json recordingIds and updatedAt
  -> update .reo/index.json
  -> remove transaction marker
  -> remove draft directory
  -> return summary
failure
  -> preserve draft or discard based on error
open/rebuild recovery
  -> remove .reo-finalizing-* staging directories created by Reo
  -> remove target directories with marker if memory.json does not reference a valid finalized recording
  -> remove marker from valid finalized recording referenced by memory.json
  -> prune memory.json recordingIds that point at missing/corrupt recordings
  -> rebuild .reo/index.json from valid finalized recordings
```

## Data retention

| Failure                        | Retention                        | User action                 |
| ------------------------------ | -------------------------------- | --------------------------- |
| Permission denied before draft | none-written                     | try again/close             |
| Draft create failed            | none-written or unknown          | choose/open workspace again |
| Append failed                  | draft discarded if corrupted     | record again                |
| Stop/final chunk failed        | draft discarded if audio invalid | record again                |
| Draft move failed              | draft preserved                  | retry finalize/discard      |
| Memory metadata write failed   | draft preserved                  | retry finalize/discard      |
| Finalize index failed          | draft preserved                  | retry finalize/discard      |
| Interrupted finalize recovery  | draft preserved; partial removed | retry finalize/discard      |
| Transcript save failed         | previous file preserved          | retry autosave              |
| Reflections save failed        | previous file preserved          | retry autosave              |
| Workspace locked               | no write                         | close other Reo window      |
| Metadata corrupt               | no write                         | open recovery flow          |

## Codex read-only validation

Workspace disk files must be readable by Codex CLI read-only verification:

- Include `AGENTS.md` and ordinary workspace files.
- Exclude `.reo/workspace.lock*` and temp files from stable hash.
- Do not hide content behind DB-only truth.

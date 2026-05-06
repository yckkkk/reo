# 文件系统事务

## 共享规则

- Renderer 后续特权操作不传裸 `rootPath`；main 使用 `workspaceHandle` 绑定 canonical workspace realpath。
- 所有 workspace paths 先经 `realpath` 或父目录 `realpath` canonicalize，再用 `path.relative` 检查 containment。
- 所有存储 refs 都是 relative paths，不存 absolute 或 home-relative paths。
- Writes 不跟随 symlink 到 workspace 外。
- Text writes 使用同目录 temp file、file fsync、rename、parent directory fsync。
- Final target 默认不可 overwrite，除非 transaction 明确拥有 overwrite 语义。
- `.reo/index.json` 可重建，parse corrupt 后可 regenerate。
- Recovery 不删除用户内容文件；只有 Reo 创建且证明安全的 empty partial draft files 可删除。

## Symlink 和 TOCTOU 规则

| 场景           | 规则                                                                                                           | 测试                          |
| -------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Workspace root | dialog/open 后 main 记录 `realpath(root)`；handle 绑定该 canonical root                                        | symlink root canonicalization |
| 路径段检查     | 对每个将写入的父目录执行 `lstat`；workspace 内 Reo-managed 目录不得是 symlink                                  | symlink parent escape         |
| 文件创建       | temp file 使用 exclusive create；创建前校验父目录 canonical path，创建后再次 `lstat` temp file                 | temp symlink swap             |
| Rename 目标    | rename 前后校验目标父目录 canonical path；目标若存在且不是本 transaction 允许 overwrite 的 regular file 则拒绝 | rename target symlink         |
| Recording id   | recordingId 只能是 Reo 生成的 safe id，不允许 path separator、dot segment 或 URL encoded traversal             | malicious id fixtures         |
| Read audio     | `recording.json` relative ref 解析后必须仍在 workspace realpath 内                                             | malicious metadata            |

## 事务矩阵

| 操作             | 文件                                                                                          | 原子边界                                         | 顺序                                                                                                                              | 崩溃窗口                                                        | 幂等性                                                                                                              | 锁                             | 清理/恢复                                                               | 测试                        |
| ---------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- | --------------------------- |
| Workspace init   | `AGENTS.md`、`.reo/workspace.json`、`.reo/index.json`、`recordings/`                          | per file temp+rename；directory create           | validate token、canonicalize root、acquire lock、create `.reo`、write metadata、write `AGENTS.md`、write index、create recordings | partial `.reo` or missing `AGENTS.md`                           | rerun refuses if `AGENTS.md` exists without valid workspace                                                         | workspace lock                 | remove empty `.reo/*.tmp`；never overwrite existing `AGENTS.md`         | init conflict、partial init |
| Open workspace   | `.reo/workspace.json`、`.reo/index.json`、`recordings/*`                                      | read-only；rebuild index if corrupt              | parse workspace、scan recordings、rebuild index if needed                                                                         | crash during rebuild leaves temp index                          | rebuild repeat-safe                                                                                                 | write lock for rebuild         | corrupt index ignored                                                   | open/rebuild tests          |
| Draft create     | `recordings/<id>/audio.webm.part`、`recording.json`                                           | mkdir + create exclusive files                   | generate UUID、mkdir、create part、write draft metadata                                                                           | empty draft folder                                              | UUID collision retries or fails                                                                                     | workspace lock                 | empty stale draft removed on open                                       | collision、stale empty      |
| Audio append     | `audio.webm.part`                                                                             | append sequence ack                              | check sequence、check budget、append bytes、fsync file                                                                            | appended bytes but ack lost                                     | retry same sequence rejected unless exact duplicate policy is implemented；first slice treats as failed/recoverable | per-recording append lock      | non-empty part becomes failed recoverable entry                         | strict sequence、budget     |
| Finalize draft   | `audio.webm.part` -> `audio.webm`、`transcript.md`、`reflections.md`、`recording.json`、index | multi-file ordered transaction with no overwrite | wait append idle、write text files、write recording metadata temp、rename audio、write final metadata、update index               | text exists but audio still part；audio renamed but index stale | open scans recording.json/audio and rebuilds index                                                                  | workspace + per-recording lock | non-empty stale part surfaced failed；finalized audio never overwritten | finalize race               |
| Discard draft    | draft folder                                                                                  | directory remove only if not finalized           | acquire lock、verify status not finalized、remove part and metadata                                                               | partial remove                                                  | repeat-safe if folder absent                                                                                        | workspace lock                 | absent draft ignored                                                    | discard tests               |
| Transcript save  | `transcript.md`                                                                               | temp+rename                                      | write temp、fsync、rename、parent fsync、update recording/index timestamps                                                        | temp remains or old file remains                                | retry safe                                                                                                          | per-recording file lock        | stale temp removed after newer file exists                              | save fail/hash              |
| Reflections save | `reflections.md`                                                                              | temp+rename                                      | same as transcript                                                                                                                | same                                                            | same                                                                                                                | same                           | same                                                                    | independent fail            |
| Read audio       | `audio.webm`                                                                                  | read-only                                        | validate handle、validate ref、read bytes                                                                                         | none                                                            | repeat-safe                                                                                                         | read lock optional             | missing file returns actionable error                                   | path traversal              |
| Recovery scan    | `.part`、corrupt metadata、index                                                              | scan and classify                                | parse workspace、scan recordings、classify drafts、rebuild index                                                                  | recovery interrupted                                            | repeat-safe                                                                                                         | workspace lock                 | no user content delete except empty Reo partial                         | restart scan tests          |

## 锁实现

First product slice 的 workspace single-writer lock 使用 `proper-lockfile`，只在 filesystem slice 有精确 consumer 和 stale-lock tests 时安装。

| 项               | 决策                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| 锁目标           | canonical workspace root                                                                           |
| 锁产物           | `.reo/workspace.lock`，视 package 语义可表现为目录或文件；属于 volatile metadata                   |
| 适配层           | `workspaceLock.ts` 薄适配，只暴露 acquire、refresh、release、checkStale                            |
| heartbeat/update | 10 秒 refresh                                                                                      |
| stale 阈值       | 60 秒无 update 且 owner pid 不存在时可恢复                                                         |
| owner metadata   | pid、hostname、app instance id、workspaceId、createdAt、updatedAt                                  |
| 第二写入者       | 返回 `ERR_WORKSPACE_LOCKED`，不降级为并发写                                                        |
| 用户恢复         | 显示“该 workspace 似乎仍在另一个 Reo 窗口中使用；关闭后重试，或恢复 stale lock”                    |
| 测试             | duplicate open、stale lock、live lock refusal、owner pid dead、network/permission failure fallback |

Codex CLI read-only validation 不使用 Reo lock。做 hash diff 时必须在 Reo quiescent 状态下运行，并排除 volatile lock artifact。

## 音频 artifact 预算

| 属性                | 决策                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------ |
| 容器                | First slice 使用 WebM                                                                |
| 编码                | Browser/Electron MediaRecorder default compatible audio codec，metadata 记录可得值   |
| 单 chunk            | 1 MiB                                                                                |
| 在途 append         | 每个 recording 只允许 1 个 append 在途                                               |
| 单次 recording 上限 | 60 分钟或 120 MiB                                                                    |
| chunk 路径          | `audio.webm.part` append sequence                                                    |
| 最终路径            | `audio.webm`                                                                         |
| Blob URL            | 只为 active playback 创建，在 recording switch/overlay close/unmount 时 revoke       |
| CSP                 | playback 落地时 production `media-src 'self' blob:`                                  |
| metadata            | `recording.json` stores duration、mime type when available、byte size after finalize |

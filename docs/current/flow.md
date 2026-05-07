# 流程

本文档是行为时序、生命周期和恢复策略的当前真源。

## 当前事实

- 当前 IPC request flows 覆盖 `window.reoWorkspace` 的 choose、initialize、open、close、memory detail、recording draft、audio manifest/chunk read、transcript/reflections save、microphone intent begin/clear。
- 当前 preload/IPC consumer 覆盖 workspace 文件事务基础、create workspace UI flow、MediaRecorder recording overlay、autosave 和 playback。
- 当前没有 auth/session lifecycle。
- 当前没有 auth request、exchange、sign-out 或 user-update flow。
- 当前 workspace file write 使用 atomic temp file、file fsync、rename 或 no-replace hard link、parent directory fsync 边界；可替换 metadata 用 rename，不能覆盖用户文件的 stable path 用 no-replace hard link。
- 当前没有 DB migration 或 startup database lifecycle。
- 当前没有 background queue。
- 当前 Query flow 覆盖 workspace initialization 后 seed workspace snapshot cache；没有 optimistic update。
- 当前 App route flow 使用 renderer in-memory state：无 workspace 时显示 starter Home + workspace entry dialog；workspace ready 后显示 Home；Home memory card 打开 memory detail；Back 返回 Home；Home `Record memory` 和 app shell `New memory` 使用 new-memory recording target；memory detail `Record memory` 使用 existing-memory target，并把当前 `memoryId` 传给 recording finalize request。Finalize 后 App seed workspace snapshot cache，并 invalidate 受影响的 memory detail query；该 route state 不写入 URL、workspace files、Query key 或持久化 store。
- 当前 memory detail flow 是 request/response read：renderer 用 TanStack Query 发起 `workspace:getMemoryDetail`，main 先读取 `memory.json`，再读取 `.reo/index.json` 中同 memory summary 的 count/status 投影，并只汇总前 24 条 recording preview 后返回；该 flow 不做 optimistic update、不创建 pagination state、不读取完整 audio 或 transcript/reflections markdown。
- 当前没有 optimistic update path。
- 当前 form submit flow 覆盖 create workspace title/description/folder selection validation、open existing workspace、submit failure 保留 create draft 和成功后 route state 切换。
- 当前没有 persisted client-state migration flow。
- 当前 main process 有最小 fatal exception path：`uncaughtException` 写入 `console.error`，先释放当前 workspace handles，再退出。
- 当前没有 structured diagnostic lifecycle 或 background error reporting flow。
- 当前没有 package、make、publish、release 或 update lifecycle。

## 技术方向

- 多步骤行为先建模，再实现。
- Command/event 名称必须具体、贴近 domain。
- 在没有真实 queue/stream 需求前，优先 request/response。
- 新 preload/IPC flow 只能跟随真实 renderer-to-main 特权需求创建。
- 在没有真实 schema 和 migration owner 前，不创建 DB migration flow。
- 每个 lifecycle transition 都必须有 owner。
- failure、cancellation、retry、recovery 行为必须明确。

## 状态管理纪律

- 状态机必须先描述 domain lifecycle，再决定使用 component state、reducer、React Hook Form、TanStack Query 或 Zustand。
- 不得把同一状态同时放入 component state、cache、form draft 和 metadata。
- UI 状态、form 状态、main-backed async data、durable file state 和 derived state 必须分开定义 owner。
- 复杂状态优先用 feature-local reducer 表达转移；只有跨 component subtree 且有真实 owner 时才引入 Zustand。
- 每个 state transition 必须说明触发事件、允许来源、失败行为、用户可见状态和验证路径。
- State ownership 必须用矩阵表达；每个 state row 只能有一个 source-of-truth owner，重复投影必须写同步方向和冲突处理。

## 第一产品切片流程决策

- Workspace directory selection flow：renderer 调用 `window.reoWorkspace.chooseDirectory()`；preload 调用 `workspace:chooseDirectory`；main 校验 channel、main frame、trusted URL 和 session；OS dialog canceled 返回 canceled；selected 返回 `selectionToken` 和 `displayPath`；真实路径只保存在 main 的 selection token store。
- Selection token lifecycle：issued、consumed、expired、sender-mismatch、not-found；成功 consume 和 expired 会删除 token，错误 sender 不删除 token；所有错误都不返回 path。
- Workspace initialize flow：renderer 传 selection token、title、description；main 校验 sender 和 token，canonicalize root，先做 no-write preflight，拒绝已有 `AGENTS.md`，包括 dangling symlink 或任何 symlink 条目；拒绝 unsafe `.reo`、unsafe `.reo/drafts/recordings` 或 unsafe `memories/`，再获取 single-writer lock。lock file 写入前和打开前必须复核 `.reo` directory identity，lock target leaf 必须用 no-follow 打开并拒绝 symlink，lock directory 必须在同一 `.reo` 当前目录内创建并绑定 directory identity；owner file 必须在 lock directory 内 no-follow 创建、写入 pid 并 fsync。owner 进程已不存在，或 owner file 缺失、损坏、symlinked 的 stale lock 可被替换，当前仍存活 owner 的 lock 返回 locked error。`AGENTS.md` 通过 no-replace atomic write 创建；写入 workspace files 后返回 opaque `workspaceHandle`、`workspaceId` 和 snapshot。
- Workspace open flow：renderer 传 selection token；main 校验 sender 和 token，canonicalize root，先做 no-write preflight，拒绝 unsafe `.reo`、unsafe `.reo/drafts/recordings`、unsafe `memories/` 或 invalid workspace metadata，再获取 single-writer lock。lock file 写入前和打开前必须复核 `.reo` directory identity，lock target leaf 必须用 no-follow 打开并拒绝 symlink，lock directory 必须在同一 `.reo` 当前目录内创建并绑定 directory identity；owner file 必须在 lock directory 内 no-follow 创建、写入 pid 并 fsync。owner 进程已不存在，或 owner file 缺失、损坏、symlinked 的 stale lock 可被替换，当前仍存活 owner 的 lock 返回 locked error。corrupt index 可重建，corrupt metadata 阻断写入且不得留下 lock。
- Workspace initialize/open 在获取 lock 后，如果 workspace file write、recovery、index rebuild、handle registration 或 response parse 抛出异常，必须释放 lock 并返回 workspace error envelope；lock target 写入失败必须返回 `ERR_WORKSPACE_LOCK_FAILED`，不得让 IPC handler reject。Lock 可用性同时要求 root identity、`.reo` identity 和当前 lock directory identity 未变化；initialize/open 获取 lock 后、写入或打开 workspace files 前必须再次检查 lock usability；initialize 文件阶段在补齐托管目录和写入 `AGENTS.md`、workspace metadata、index 前都必须重新消费 lock usability；open 文件阶段在 target revalidation、metadata read、补齐托管目录、recovery、read model rebuild、index reconciliation 和返回 session 前也必须重新消费 lock usability；identity 变化或 release 失败后，handle require 和 delayed handler operation 必须返回 lock lost，不得继续授权写入。
- Workspace close flow：renderer 传 `workspaceHandle`；main 校验 sender ownership，释放 lock 并撤销 handle。Handle close 只有在 lock release 成功后才能删除 handle；release 失败时保留 handle 并返回 `ERR_WORKSPACE_LOCK_FAILED`。BrowserWindow `closed` 或 `render-process-gone` 会尝试释放当前 main process 持有的 workspace handles；teardown close-all 只删除 release 成功的 handle，release 失败的 handle 保留为 lock lost 状态以便后续 close-all 重试。
- Workspace lifecycle 覆盖 none、creating、ready、missing、conflict、unsupported、failed。
- Workspace entry lifecycle 覆盖 idle、folder selecting、canceled、creating、opening、create-error、open-error 和 ready。
- Workspace creation renderer flow：title、description、selection token 和 displayPath 属于当前 React Hook Form lifecycle；OS dialog canceled 不修改 draft 并把 focus 返回 folder picker；existing `AGENTS.md` conflict 显示 create alert，保留 title/description，清除已消费的 selection token 和 displayPath；initialize success seed workspace snapshot Query cache 并设置当前 renderer session state。
- Workspace open renderer flow：open action 单独调用 folder picker，拒绝含 `/` 或 `\` 的 displayPath，`openWorkspace` request 只发送 selection token；open failure 显示 open alert，不清空 create draft；open success seed workspace snapshot Query cache 并设置当前 renderer session state。
- Recording lifecycle 覆盖 idle、acquiring-permission、recording、paused、finalizing、editing、playback 和 failed；mic intent 拒绝、permission denial、media start failure 或 append failure 从忙碌状态进入 failed，discard 当前未完成 draft，不创建 finalized recording。Finalize failure 从 finalizing 进入 failed，并按 main error envelope 的 data retention 保留或清理 draft。idle 和 editing 收到 late failed event 必须 no-op。
- Recording drawer 忙碌状态包括 acquiring-permission、recording、paused 和 finalizing；Drawer/Vaul close、Escape 和 overlay dismiss 必须阻止这些状态误关。
- 当前 recording overlay flow：home 或 memory detail `Record memory` 打开 shadcn Drawer/Vaul recording surface；Home/app shell 入口使用 `new-memory` target，finalize request 不传 `memoryId`，由 main 创建新 memory；memory detail 入口使用 `existing-memory` target，finalize request 传当前 `memoryId`，由 main 追加到该 memory。`Start recording` 先 await `beginMicrophoneIntent` 成功，再创建 recording draft，最后启动 browser MediaRecorder adapter；draft 创建失败、media start failure、stale session、组件 unmount 或 workspace handle 切换会 clear matching pending intent；draft 创建成功后如果 session 已 stale，会 discard draft 且不启动 media；只有 MediaRecorder controller ready 后 UI 才进入 recording 并显示 pause/stop；audio data 通过 append queue 串行写入；pause 暂停 MediaRecorder 和 elapsed timer；resume 恢复；stop 先停止 recorder，等待 MediaRecorder `stop` 事件和最后一次 `dataavailable` 转换完成，再等待 append queue 清空，最后 finalize。Finalize 后进入空白 transcript/reflections draft 编辑状态，不生成本地转写文本，并由 App 负责刷新 workspace snapshot 和对应 memory detail cache。非忙碌状态关闭 drawer 会清空 renderer-local drawer draft、error、elapsed、playback URL、recording target 和 machine state，忽略已关闭 session 的 autosave 结果；下一次打开必须从 idle ready state 开始。
- Audio append 必须按 sequence 串行 ack；每个 recording 只允许 1 个 append 在途，超量进入 failed recoverable。当前进程创建的 active draft 可以跳过每个 append 的 durable finalized scan；workspace close、window teardown 或 root runtime state 清理后必须移除该进程态，后续 append 重新检查 finalized truth；stale/manual draft append 必须先检查 durable finalized recording。存在 finalized truth 时返回 finalized error，即使 `.reo/drafts/recordings/<recordingId>/` 中仍有 stale draft。Append 写 chunk 前必须确认 draft `audio.webm` 是 workspace 内普通文件，拒绝 symlink 或非文件 audio；metadata 写失败时必须 truncate audio 回 append 前 size 并 fsync，返回 `ERR_RECORDING_APPEND_FAILED` 与 `dataRetention: "draft-preserved"`，且不得推进 sequence、audio bytes 或写到 workspace 外。
- MediaRecorder chunk 转换失败、append 返回错误、append promise reject 或 media start 失败时，recording overlay 立即进入 failed，不调用 finalize，停止当前 recorder controller，discard 当前未完成 draft，并用 recording session token 忽略旧 recorder 后续 stale chunks；discard draft cleanup 必须重新验证 workspace containment，不能跟随 symlink parent 删除 workspace 外目录；failed 状态允许用户重新开始一次新的 recording draft，retry 会清空旧 elapsed、transcript draft、reflections draft 和 saved refs。
- Finalized recording 不允许继续 append。Finalize 必须先复核 `memories/` root，再逐段创建并复核 `memories/<memoryId>` 和 `memories/<memoryId>/recordings/`，不能用递归 `mkdir` 跟随 symlink；创建 memory directory 和 recordings directory 的目标解析后、实际 `mkdir` 前后都必须重新解析 workspace child containment，拒绝 ancestor symlink swap。随后在已验证 `recordings/` parent 内使用相对 `mkdir` 创建 Reo-owned `.reo-finalizing-*` staging directory，不得用缓存 absolute path 创建 staging；staging 创建后写 marker、fsync、copy 和 expose 前都必须重新解析当前 staging directory；staging `recording.json` 读取必须使用 no-follow file handle。再通过完整 workspace child containment 重新解析 draft source，复核 `.reo/drafts/recordings` ancestor 和 leaf draft directory 都不是 symlink 或非目录，复制前再次解析 draft source，只允许异步复制普通 `recording.json`、`audio.webm`、`transcript.md`、`reflections.md`，未知文件必须失败并保留 draft；复制后 fsync staging tree。在 expose 前必须重新通过完整 containment 解析 target recording path 并复核 staging parent，最终 expose 在已验证 parent directory 内重验 target missing，创建 target directory 作为 no-replace reservation，再先搬迁 marker、后搬迁 staging 内容，parent identity 改变或 late-created target 必须失败，不能使用已缓存 absolute path 直接暴露；最后 fsync parent。
- Finalize cleanup 在删除 draft、staging、target 或未提交 memory 目录前后必须重新做 workspace containment；如果 cleanup path 在验证后变为 unsafe，main 必须失败或跳过删除，不得删除 workspace 外文件。
- Finalize 在 staging copy 后、durable target expose 前必须按 draft metadata schema 重新校验复制结果，并确认 `workspaceId`、`recordingId` 和 `audioByteLength` 与当前请求及实际 audio file 一致；该校验失败属于 pre-expose failure，必须清理 staging、保留 draft、不得删除 draft 或写出 finalized truth。
- Finalize 在 staging 暴露前失败时必须删除 `.reo-finalizing-*` staging tree；如果这是新建 memory 且尚未写入 `memory.json`，也必须删除该空 memory 目录，保证同一显式 `memoryId` 可以重试。
- Directory fsync 在不支持的平台或文件系统上按 best-effort 处理；`EACCES`、`EISDIR`、`EINVAL`、`ENOTSUP`、`EPERM` 不得让已成功写入的 atomic file 或 finalize transaction 误回滚。
- Finalize 使用 renderer active recording clock 计算的显式 duration 和实际 `audio.webm` 文件大小写入 `recording.json`、返回值和 `.reo/index.json`，三者的 `audioByteLength` 必须一致，且 `recording.json.status/memoryId/recordingId` 必须与目录 ownership 一致。`memory.json` 写入和 previous-memory rollback 前必须重新解析 memory directory，不能复用 final rename 前缓存的 memory path。
- Memory metadata、workspace metadata、workspace index 和 finalized recording metadata 必须从 workspace 内普通文件读取；`.reo/workspace.json`、`.reo/index.json`、`memory.json` 和 finalized `recording.json` leaf 必须用 no-follow file handle 打开，symlink leaf 不进入 open、rebuild、detail 或 lookup 投影。每个 metadata/index JSON 文件不得超过 1 MiB，schema 必须 strict，unknown 字段不进入当前合同。Finalized recording detail/save public request 必须携带 finalize response 返回的 `memoryId` 和 `recordingId`；main 直接解析 nested finalized recording directory，遇到 unsafe finalized metadata、ownership mismatch 或 duplicate durable recording id 必须返回 typed not-found/error envelope，不能 fallback 到 stale draft。markdown save 必须在当前 recording directory identity 内执行 atomic write，同一 root/memory/recording/file 进入 main process 写队列，避免 out-of-order autosave 旧内容覆盖新内容。
- Finalized audio file 必须是 workspace 内普通文件，不能是 symlink 或非文件；manifest/chunk read、index rebuild 和 finalized lookup 都必须拒绝 symlinked `audio.webm`。Manifest/chunk public request 必须携带 finalize response 返回的 `memoryId` 和 `recordingId`；chunk read 可以复用 main process 内 finalized target cache，但每次 chunk read 仍必须重新检查重复 finalized `recordingId`，避免直接 chunk IPC 绕过 manifest。chunk read 必须通过当前 recording directory identity、同一个 no-follow file handle、fstat 和 finalized metadata `audioByteLength` 完成 validation 与读取，且只按请求的 `offset` 与 `length` 做 bounded read；open 后 audio file size 必须继续等于 finalized metadata `audioByteLength`，避免 validation 后路径被替换成 symlink 或文件增长时暴露 workspace 外字节或 metadata 未承认的尾部字节，也避免每个 IPC chunk 读取完整 audio 文件。
- Finalize 复制 draft 后只能补齐缺失的 `transcript.md` 和 `reflections.md`；如果 draft 中已有普通 markdown 文件，必须保留内容，不能用空文件覆盖。
- Finalize 更新 `.reo/index.json` 失败时，main process 删除 interrupted staging/target directory、恢复 `memory.json` 并保留 draft，返回 `ERR_RECORDING_FINALIZE_FAILED` 和 `dataRetention: "draft-preserved"`；如果 target directory 已存在且不属于当前 finalize marker，不得删除。若 delayed handle usability 在 finalize 内部返回 lock lost，必须立即返回 lock lost，不得继续执行旧 handle cleanup、rollback 或 index 写入；后续 recovery 由新 owner 在重新获取 lock 后处理 marker/staging。
- Finalize 在 index 已刷新后又因 draft cleanup 前错误需要 rollback 时，必须删除 interrupted staging/target directory、恢复或删除 `memory.json`，并重新刷新 `.reo/index.json`，避免 projection 指向已回滚的 recording。
- Finalize 成功时先删除 draft 并 fsync draft parent，再重新解析 durable target directory、复核 containment、清除 durable target marker；如果 draft 删除前失败，返回 `dataRetention: "draft-preserved"`；如果 draft 已安全缺失，按 cleanup 已完成处理，不得回滚已写入的 durable recording；如果 draft 已删除但 draft parent fsync、target 复核或 marker 清除失败，返回 `dataRetention: "durable-marker-recovery-required"`，不能把该 finalized recording 当作已完整收口。删除 draft 后、draft parent fsync 和 marker unlink 前必须重新消费 delayed handle usability；中途 lock lost 时保留 durable marker，让后续新 owner recovery 收口。Recovery 看到 marker-bearing valid finalized recording 时也必须先删除 stale draft、确认 draft parent fsync、重新解析 target directory，再清除 marker；如果 draft 已安全缺失，按 cleanup 已完成处理，继续 fsync parent 并清 marker，避免 stale draft 影子读取或 durable marker 永久保留。open 调用 recovery 时，staging/partial 删除、draft cleanup、draft parent fsync、marker unlink、metadata-less memory cleanup 和 memory repair 写入前必须消费当前 lock/root/`.reo` usability；中途 lock lost 时停止 recovery 写操作并返回 lock lost。Recovery 遇到缺失 `memory.json` 但带 marker 且含 `recording.json` 或 `audio.webm` 的 finalized recording payload 时必须 fail-open 保留；删除 staging/partial recording 后，如果 new-memory directory 没有 `memory.json` 且只剩 `recordings/`，必须删除该 metadata-less memory directory，即使 `recordings/` 内还有 markerless partial target，避免同一显式 memory id 重试被阻断。
- 同一 `memoryId` 的 create、append 和 title update 通过 main process memory write lock 串行保护；并发 append 中未获得锁的一方返回 `ERR_RECORDING_FINALIZE_FAILED` 和 `dataRetention: "draft-preserved"`，并发 title update 中未获得锁的一方返回错误信封并保留既有 `memory.json`。
- `.reo/index.json` 损坏、丢失或合法但陈旧时，open/rebuild 会扫描 `memories/*/memory.json`、finalized recording metadata 和 `audio.webm`，只从 schema、status、ownership 和 metadata/audio 一致的 finalized recordings 协调 memory summary 并写回 index；scan 必须绑定 `memories/` root identity，scan 前、scan 后或持久化前 identity 改变时失败并保留原 index；如果 `memories/` 存在但不可读取，open 必须失败并保留原 index，不能把 read error 协调为空 workspace。Transcript/reflections autosave 只刷新所属 memory 的 index entry，避免每次保存重扫全 workspace；同一 workspace 的全量 index replace 和 index entry refresh 进入同一个 main process write queue。全量 replace 与 open reconciliation replace 都在队列内重新读取当前 read model 后再写入；单条 refresh 在队列内部重新读取当前 memory summary，再按顺序读取当前 index、合并单条 memory summary、atomic 写回。
- Recovery 扫描 `memories/<memoryId>/recordings/` 前必须重新做 workspace containment 和 symlink guard；如果 `recordings` 本身或 `<recordingId>` leaf directory 是 symlink，不能跟随、不能删除 symlink target，只能按缺失 durable recording 修复当前 memory metadata 投影。Recovery repair 写回 `memory.json` 前必须重新解析当前 `memoryDirectory()`，不能复用扫描开始时缓存的 `memoriesDirectory`。
- 如果进程在 finalized metadata 写入后、`.reo/index.json` 写入前崩溃，后续 open 会把该 finalized recording 恢复到 workspace snapshot。
- Metadata、index、transcript 和 reflections 的 atomic write 先异步写入并 fsync temp file，再在已验证 parent directory 内 rename；temp open、data write、rename 与 parent fsync 前后复核 parent directory identity。replace write 覆盖已有 target 前必须保留同目录 backup，backup 删除前的后置 validation 或 fsync 失败时恢复旧 target，不能删除唯一副本；backup 已删除后的 cleanup durability failure 属于 best-effort，不得把已提交 target 误报为失败；`AGENTS.md` no-replace write 在 temp file fsync 后 hard-link 到目标 path。当前 Node API 没有 fd-relative `renameat/linkat`，final commit 使用短同步 critical section 临时进入已验证 parent directory；该窗口内不得 `await`，也不得调用依赖 `process.cwd()` 的外部逻辑。若 commit 后发现 parent path identity 改变，必须删除本次暴露的 target；replace write 还必须恢复旧 target。parent directory fsync 成功时提供更强持久性，遇到当前平台或挂载点不支持 directory fsync 的错误时不得在 rename 或 hard link 后误报写入失败。
- `updateWorkspaceIndex` 在 update 函数成功前不会持久化 open/rebuild 协调结果；失败路径不改变已有合法 index。
- Finalize 必须等待最后一个 append ack，不得 duplicate stop 提前 finalize。
- Transcript 和 reflections 各自拥有独立 autosave lifecycle；save failure 显示 alert，保留 renderer draft，main atomic write 保留 previous disk file。
- Playback 只从 finalized recording truth 读取 audio；先读 manifest，再按最多 4 个并发 chunk read 组装 Blob；renderer 只在 active playback 期间持有 Blob URL，close/switch/unmount 会 revoke，close 或 unmount 后返回的过期 chunk 结果不得再创建 Blob URL，也不得继续调度后续 chunk IPC。
- Workspace write 使用 single-writer lock；第二个 Reo writer 返回 locked error。带 dead owner pid、缺失 owner file、损坏 owner file 或 symlinked owner file 的 stale lock directory 可在下一次 acquire 时被替换；无法确认 owner 仍存活时不做 silent override。

## 时序规则

- 多步骤 write 必须有 transaction boundary。
- 改变 cached data 的 mutation 必须有 invalidation 或 rollback。
- TanStack Query mutation 必须定义 query key、invalidation scope、pending/error state 和 rollback 策略。
- Zustand persist 必须定义 storage、version、partialize/migrate 和 user-visible recovery。
- Form submit 必须定义 validation timing、submit owner、failure behavior 和 reset behavior。
- Background task 必须有 owner、trigger、cancellation、retry、error reporting。
- Diagnostic/background error flow 必须有 owner、trigger、redaction、retention、retry 和 failure behavior。
- Session/auth change 必须写明 caller、persistence effect、renderer visibility、recovery behavior。
- Better Auth Electron flow 必须先定义 system-browser request、PKCE/state、callback exchange、session persistence、renderer visibility、sign-out、error 和 recovery。
- Packaging flow 必须先定义 build、package、sign、notarize、make、publish、verify 的顺序和 failure behavior。
- Update flow 必须先定义 trigger、channel、metadata source、download/install timing、cancellation、retry、rollback、error reporting 和 renderer visibility。
- Concurrency-sensitive flow 必须写 race condition analysis。

## 禁止

- 禁止 generic event runtime。
- 禁止没有当前产品需求的 mailbox 或 queue runtime。
- 禁止没有 observability 的 hidden background job。
- 禁止没有 signed packaged app 和 release metadata 的 updater polling。
- 禁止没有 rollback 的 optimistic UI path。
- 禁止依赖未记录 timing assumption 的 async flow。

## 变更门禁

任何 lifecycle、command flow、IPC ordering、transactions、concurrency、rollback、background jobs、recovery behavior 改动，都必须更新本文档。

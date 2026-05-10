# 数据

本文档是数据结构与状态归属的当前真源。

## 当前事实

- 当前没有 database schema。
- 当前 durable data contract 是记忆空间文件夹文件和 main-owned memory space registry。
- 当前没有 Drizzle config。
- 当前没有 Better Auth tables。
- 当前没有 auth session persistence owner。
- 当前 TanStack Query key 覆盖记忆空间 snapshot：`['workspace', 'snapshot', workspaceId]`。
- 当前 TanStack Query key 覆盖 Memory detail：`['workspace', 'memory-detail', workspaceId, memoryId]`。
- 当前 TanStack Query key 覆盖 selected Segment content：`['workspace', 'segment-content', workspaceId, memoryId, segmentId]`。
- 当前 TanStack Query key 覆盖 memory space list：`['workspace', 'memory-spaces']`。
- 当前没有 Zustand stores。
- 当前 React Hook Form form owner 覆盖 create memory space submit 前的 title、description、selection token、displayPath draft、Memory create title draft 和 Memory rename title draft。
- 当前 Zod runtime schema owner 是 workspace IPC contract 和错误信封。

## 当前实体与字段归属

- 记忆空间是用户选择的本地文件夹；用户内容真源是该文件夹内的普通文件。
- `.reo/workspace.json` 保存 `schemaVersion`、`workspaceId`、title、description 和 createdAt；它定义记忆空间身份，不保存 UI 状态、root path、handle 或查询缓存。
- Workspace snapshot 是 IPC response 和 TanStack Query cache 投影，只包含 `workspaceId`、title、description 和 `memories[]`；不包含顶层 `segments[]`、root path、selection token 或 `workspaceHandle`。
- Memory summary 由 `.reo/index.json` 的 `memories[]` 提供，字段包含 `memoryId`、title、createdAt、updatedAt、segmentCount、durationMs、audioByteLength、hasTranscript 和 attachmentCount。
- Memory detail 由 `memories/<memoryId>/memory.json` 和该 Memory 内 finalized audio segment 文件派生，字段包含 `workspaceId`、Memory summary 字段和 `segments[]`。`segments[]` 当前只投影 finalized `audio` Segment，字段包含 `workspaceId`、`memoryId`、`segmentId`、type、title、createdAt、updatedAt、durationMs、audioByteLength、transcript presence 和 attachmentCount。
- Memory 的核心关系由 `memory.json.segmentIds` 表达，当前只接受已实现的 audio segment id；note、photo、video、imported_file 和非音频 SegmentAttachment 进入 runtime 前必须扩展文件合同、schema、IPC 和恢复路径。
- Audio segment draft 属于 `.reo/drafts/segments/<segmentId>/`；finalized audio segment 属于 `memories/<memoryId>/segments/<segmentId>/`，并通过 `segment.json`、`audio.webm` 和 `transcript.md` 表达该段主体记录。Audio SegmentAttachment draft 属于 `.reo/drafts/attachments/<attachmentId>/`，并通过 `attachment.json` 与 `audio.webm` 表达 selected Segment 的补充录音草稿；finalized audio SegmentAttachment 属于 `memories/<memoryId>/segments/<segmentId>/attachments/<attachmentId>/`，并通过 `attachment.json`、`audio.webm` 和 `transcript.md` 表达该段主体记录的补充内容。
- Finalized audio segment 的 `segment.json` 必须与所在 memory directory 和 segment directory 一致；`memoryId` 与 `segmentId` 不通过全局 lookup 推断。
- Memory space registry entry 属于 main-owned app state，字段包含 `workspaceId`、title、description、rootPath、addedAt 和 lastOpenedAt；renderer 只能读取不含 rootPath 的列表投影。
- `workspaceHandle` 是 main process runtime capability，只用于当前窗口授权 IPC 操作，不进入 query key、DOM、URL、记忆空间文件或 registry。

## 技术方向

- 本地 SQLite 使用 Drizzle ORM + `better-sqlite3`。
- 没有真实 schema、关系和 migration owner 前，不引入 Drizzle、`better-sqlite3`、Drizzle config 或 migration directory。
- 每个功能变更都必须显式判断是否产生 DB schema、table relationship、query key、cache ownership、form owner、client state owner 或 durable file contract。
- 如果判断为不引入 DB schema，必须说明当前 durable source、恢复路径、未来触发 DB 的具体 pressure。
- Auth/session foundation 使用 Better Auth 的 Electron 支持。
- 没有真实 session lifecycle、auth tables 和 secure persistence owner 前，不引入 Better Auth package 或 auth storage。
- Form、IPC、auth、persistence 边界使用 Zod 做运行时校验。
- Main/server-backed async data 使用 TanStack Query。
- TanStack Query provider 当前服务真实 main-backed memory space list、记忆空间 snapshot consumer、Memory detail consumer 和 selected Segment content consumer。
- 非 server-backed 的本地 UI/client state 使用 Zustand。
- 没有跨 component subtree 的 client state owner 前，不引入 Zustand store。
- Form state 使用 React Hook Form。
- React Hook Form 当前只服务真实 create memory space form submit、folder selection draft、Memory create title draft、Memory rename title draft 和 validation owner。

## Schema 规则

- 从产品实体和关系定义表，不从 UI screen 倒推表。
- 实现 migration 前必须写清每个 table relationship。
- 设计表时必须先写 entity、relationship、cardinality、ownership、lifecycle、delete/update effect，再写 columns。
- 优先显式 foreign key 和 index，不靠隐式耦合。
- 不为同一 domain concept 建多个重复 table shape。
- 不创建 speculative columns 或 generic metadata bucket。
- Migration 必须可审查，并关联引入它的 spec。

## 状态归属

- 用户记忆内容的 durable artifact source 属于记忆空间文件。
- `.reo` metadata 和 rebuildable index 属于记忆空间文件夹，由 Reo 管理。
- Memory space registry 属于 main-owned app state，只保存已导入记忆空间列表和 main-only root path，不是用户内容真源。
- SQLite 只有在引入后才拥有明确的 app index、relationship、query、session 或 processing state；不得替代记忆空间文件成为用户内容真源。
- Main/server-backed async data 属于 TanStack Query。
- Ephemeral UI state 属于 component state 或 Zustand。
- Form drafts 在提交前属于 React Hook Form。
- Derived state 默认计算，不存储；只有明确性能或一致性理由才存储。

## 当前数据决策

- 当前用户内容真源是记忆空间文件夹；不引入 Drizzle schema、SQLite file、migration directory 或 DB-backed content truth。
- Memory space registry 是 Reo app state，用于跨 app restart 保留已导入记忆空间。Registry entry 包含 `workspaceId`、title、description、root path、addedAt 和 lastOpenedAt；root path 只在 main-owned registry file 和 main process 内部存在。Renderer 只能通过 `workspace:listMemorySpaces` 读取不含 root path 的记忆空间元数据，通过 `workspace:openMemorySpace(workspaceId)` 打开记忆空间，并通过 `workspace:removeMemorySpace(workspaceId)` 从列表移除记忆空间。Registry 最多保留最近 100 个记忆空间，title/description 有 display text 长度上限；root path 超出上限时 registry write 失败。
- Memory space registry 不是记忆空间内容真源；记忆空间 title、description、memory summary 和 segment truth 仍来自记忆空间文件。Registry 文件缺失、损坏、schema 不匹配或 symlink leaf 按空记忆空间列表处理；不可读 IO 错误返回 typed error envelope。Registry upsert 在单 registry 实例内串行化，避免并发导入覆盖既有记忆空间。
- 用户直接删除记忆空间文件夹后，registry entry 可以继续显示在 sidebar。点击该记忆空间时 main 返回 `ERR_WORKSPACE_ROOT_MISSING`；renderer 通过 root toast 显示文件夹已不存在，不自动移除 registry entry，不切换 active session。用户可用 sidebar 记忆空间更多菜单把该 entry 从 Reo 列表移除；该动作不删除本地文件夹。
- Memory space stable files 包括 `AGENTS.md`、`.reo/workspace.json`、`.reo/index.json`、`memories/<memoryId>/memory.json`、`memories/<memoryId>/segments/<segmentId>/segment.json`、`memories/<memoryId>/segments/<segmentId>/audio.webm`、`memories/<memoryId>/segments/<segmentId>/transcript.md`、`memories/<memoryId>/segments/<segmentId>/attachments/<attachmentId>/attachment.json`、`memories/<memoryId>/segments/<segmentId>/attachments/<attachmentId>/audio.webm`、`memories/<memoryId>/segments/<segmentId>/attachments/<attachmentId>/transcript.md` 和 `.reo/trash/memories/<memoryId>/` 下的可恢复已删除 Memory 目录。
- `.reo/index.json` 是可重建 UI index，不是用户内容真源。
- `.reo/index.json` 当前保存 `memories[]` 投影；每个 summary 包含 `memoryId`、title、created/updated time、segmentCount、duration、audio bytes、非空 transcript presence 和 attachmentCount。
- `.reo/workspace.lock` 和 `.reo/workspace.lock.lock` 是 volatile runtime lock artifacts，不进入 Codex read-only validation 的稳定 hash 范围；`.reo/workspace.lock.lock/owner.json` 只记录当前 main process pid，用于识别 stale lock，不是用户内容。缺失、损坏或 symlinked owner file 代表未完成或无效 lock，可在下一次 acquire 时替换。
- Query keys 使用 stable `workspaceId`、`memoryId` 和 `segmentId`；memory space list 使用 `['workspace', 'memory-spaces']`；Workspace snapshot 使用 `['workspace', 'snapshot', workspaceId]`；Memory detail 使用 `['workspace', 'memory-detail', workspaceId, memoryId]`；selected Segment content 使用 `['workspace', 'segment-content', workspaceId, memoryId, segmentId]`；`workspaceHandle` 是 main memory capability，不进入 query key、不写入文件、不跨 app restart 持久化。
- TanStack Query 拥有 main-backed memory space list、记忆空间 snapshot cache、Memory detail cache 和 selected Segment content cache；active recording lifecycle、overlay close protection、chunk sequence、transcript draft ref、finalized playback state 和 Blob URL 不进入 query cache。录音异常恢复 marker 存在 renderer `localStorage`，key 按 `workspaceId` 隔离，保存 `workspaceId`、`memoryId`、`segmentId`、title、duration、append `nextSequence`、recording session、revision、waveform samples、audio chunk time/byte map、safe audio byte length、当前有效 transcript segments 或 transcript markdown sidecar 引用、timestamps，以及已 finalize audio 但 transcript 尚未保存时的 finalized audio summary；SegmentAttachment 录音 marker 额外保存 `targetKind: "segment-attachment"` 和 `parentSegmentId`，`segmentId` 位置保存 attachment id，并可保存 finalized attachment summary。finalized audio summary 必须与 marker 的 `memoryId` 和 `segmentId` 匹配；finalized attachment summary 必须与 marker 的 `memoryId`、`parentSegmentId` 和 attachment id 匹配；marker 不保存音频二进制、密钥、workspace handle 或 raw path。
- React Hook Form 只拥有 create memory space submit 前的 form draft，包括 title、description、selection token 和 displayPath；也拥有 Memory create Dialog 和 Memory rename Dialog 提交前的 title draft。
- Loaded workspace frame 的 MemoryRail 只派生渲染当前 loaded 记忆空间 snapshot 的 `memories` 投影；它不拥有独立 async data、Query key、Zustand store、IPC、DB、记忆空间文件或 `.reo/index.json` 写入。
- 当前 MemoryRail selection 只使用 renderer session state 中的 current memory id；选中 Memory 后 Memory Studio 使用 Memory detail Query 读取当前 Memory 的 finalized audio Segment projection。该 Query key 只包含 `workspaceId` 和 `memoryId`，request 携带 `workspaceHandle`、`workspaceId`、`memoryId` 和 requestId，response 不返回 handle 或 raw path。Memory Studio 的 `selectedSegmentId` 是 feature-local component state，只在当前 Memory detail projection 内选择 Segment；切换 Memory 时组件 key 重置该状态，缺失时回到首个 Segment 或空态。
- 当前 Memory Studio selected Segment content Query 读取当前 selected finalized audio Segment 的 `audio.webm` bytes 和 `transcript.md` 文本。该 Query key 只包含 `workspaceId`、`memoryId` 和 `segmentId`；request 携带 `workspaceHandle`、`workspaceId`、`memoryId`、`segmentId` 和 requestId；response 返回同 requestId、identity、audio bytes、audioByteLength 和 transcript text，不返回 handle、root path、file path 或 selection token。Renderer 用 response audio bytes 创建临时 Blob URL，本地播放状态和 Blob URL 属于 `MemoryStudio` component state，并在 Segment 切换、content 变化或 unmount 时释放。
- 当前 Memory Studio 内容 tab 和 SegmentAttachment `+` 菜单 open 状态只属于 feature-local component state。它们不进入 TanStack Query key、Workspace snapshot、Memory detail projection、registry、Zustand store 或 durable file。内容 tab 只展示 selected Segment 已存在的内容入口；audio Segment 默认只有 `转录`，不会渲染笔记、视频或图片的常驻禁用 tab。`+` 菜单当前只暴露录音补充项，录音补充写入 selected Segment 的 finalized audio SegmentAttachment。
- Recording finalize 后 renderer seed 当前记忆空间 snapshot cache 的 `memories[]` 投影，并把受影响 Memory 设为当前 Memory context；不读取或 invalidate 单条详情 query。
- Memory create 使用 `workspace:createMemory`，request 只包含 `workspaceHandle` 和 trimmed title；response 返回新建的 Memory summary，不返回 root path、recording list 或 Segment 字段。Main process 生成稳定 `memoryId`，在 `memories/<memoryId>/` 下创建空 `memory.json`，`segmentIds` 初始为空，并刷新该 Memory 的 `.reo/index.json` summary entry。Title 只写入 `memory.json`，不参与 directory name；rename 不移动 Memory folder。Renderer 只在成功 response 后合并当前 session snapshot、seed snapshot Query cache，并把新 Memory 设为 current memory context；该 flow 不做 optimistic update。
- Memory rename 使用 `workspace:updateMemoryTitle`，request 只包含 `workspaceHandle`、`memoryId` 和 trimmed title；response 返回更新后的 Memory summary，不返回 recording 详情、root path 或 Segment 字段。Main process 以 `memories/<memoryId>/memory.json` 为真源更新 title 和 updatedAt，并刷新该 Memory 的 `.reo/index.json` summary entry；index refresh 失败时仍以 file truth 返回成功 summary，后续 open/rebuild 会协调 index。Renderer 只在成功 response 后合并当前 session snapshot 和 snapshot Query cache；该 flow 不做 optimistic update。
- Memory delete 使用 `workspace:deleteMemory`，request 只包含 `workspaceHandle` 和 `memoryId`；response 返回被删除的 `memoryId`、本次 `restoreToken` 和刷新后的 `memories[]` 投影，不返回 root path、trash path、Segment 详情或文件路径。Main process 把 active `memories/<memoryId>/` 移入 `.reo/trash/memories/<memoryId>/`，刷新 `.reo/index.json`，并在 index 刷新或 move 失败时尝试回滚原目录。当前 `restoreToken` 是同一 `memoryId`，只作为恢复能力 token 暴露给 renderer，不代表路径。Renderer 成功后合并当前 session snapshot 和 snapshot Query cache，移除该 Memory detail Query cache；如果删除的是当前 Memory，则选择剩余第一条 Memory 或回到 Workspace Stage。该 flow 不做 optimistic update。
- Memory restore 使用 `workspace:restoreDeletedMemory`，request 只包含 `workspaceHandle` 和 `restoreToken`；response 返回恢复后的 Memory summary 和刷新后的 `memories[]` 投影，不返回 trash path 或 raw path。Main process 把 `.reo/trash/memories/<restoreToken>/` 移回 `memories/<memoryId>/` 并刷新 `.reo/index.json`；如果 active Memory 目录已存在、trash 目录缺失或 index 刷新失败，必须保留可恢复状态或回滚 move。Renderer 成功后合并 snapshot cache、把恢复的 Memory 设为 current Memory context，并通过 toast 告知恢复完成。
- 创建记忆空间 folder selection token 和 displayPath 属于当前 RHF form lifecycle；create selection token 指向用户选择的父目录，记忆空间 title 同时是将要创建的 child folder name；sidebar `打开本地记忆空间` 的 selection token 只存在于该当前事件流。Create selection token 只用于一次 initialize request；open-local selection token 只用于一次 open request；selection token 不进入 Query cache 或 durable files。
- Recording overlay component state 拥有 active recording lifecycle、overlay close protection、elapsed timer、cursor time、waveform samples、captured chunk prefix、transcript draft ref、recording timeline state 和 paused draft playback Blob URL。Paused draft playback Blob 由当前 renderer 已捕获的有效 chunk 前缀生成；异常恢复时，renderer 通过 `workspace:readRecordingDraftAudio` 只读取未完成 draft audio，并按 recovery marker 中的 chunk time/byte map 计算读取上限和还原有效 chunk 前缀，用于暂停态回听和保存前检查，不跨 MediaRecorder session 继续或替换；main read 会与同 draft append/finalize 互斥，并在读取后复核 metadata byte length 与读取上限。没有 marker-derived chunk map 时不得使用固定大上限读取 draft audio，只显示 toast 并允许保存或放弃。该 draft audio read 不是 finalized public audio read，不进入 Query cache。Transcript draft 初始为空，只来自真实 ASR 片段，不生成本地 mock transcript，也不作为 STT 真源。Recording timeline 的转写片段必须包含 `startTimeMs`、`endTimeMs`、`text`、`isFinal`、`recordingSessionId` 和 `revisionId`；替换录音时只能保留 cursor 之前的有效片段，旧 session/revision 的异步结果必须丢弃。Recording overlay 在 audio segment draft 创建后写入 recovery marker，按有效录音时长、首个或节流后的 audio chunk map、safe audio byte length、waveform、transcript timeline、pause/stop 和 finalize/transcript-save 分界更新恢复快照；append ack 不逐次写 `localStorage`，恢复继续检查时以 draft metadata 读取真实 `nextSequence`。若 recovery save 已完成 audio finalize 但 transcript save 失败，App 把 finalized audio summary 和最新 transcript snapshot 写回 marker，后续重试只补 transcript。正常 finalize、discard、replacement discard 或 unmount discard 时清除匹配 marker 和 transcript sidecar。
- Finalize response 返回当前 memory summary 和单条 audio segment summary；renderer 只把 memory summary 合并进当前记忆空间 session 的 `memories` 投影，并把该 Memory 设为 current memory context。SegmentAttachment finalize response 返回当前 memory summary、parent segment projection 和 attachment projection；renderer 用 memory summary 更新 Workspace snapshot，用 parent segment projection 精准更新 Memory detail cache 的对应 segment `attachmentCount`，但不把 attachment 作为同级 Segment 插入顶层 Segment strip。durable truth 仍是记忆空间文件和 `.reo/index.json` 的 memory summary。
- Zod 当前用于 workspace IPC request/response、记忆空间 metadata、segment metadata 和错误信封。
- `chooseDirectory` 阶段不产生 durable data contract；真实路径只暂存在 main process selection token store，不写入文件、不进入 renderer、不进入 query key。
- Memory space initialize 在所选父目录下 no-replace 创建 title 同名 child folder，再在 child root 写入 `AGENTS.md`、`.reo/workspace.json`、`.reo/index.json`、`memories/` 和 `.reo/drafts/segments/`；同名 child 已存在时返回 `ERR_WORKSPACE_ALREADY_EXISTS`。`.reo/drafts/attachments/` 只在 SegmentAttachment 录音草稿创建时按需创建。open 现有记忆空间时会在返回 ready session 前补齐缺失的 `memories/` 和 `.reo/drafts/segments/` 托管目录；open 空文件夹时会在该文件夹内原地初始化 Reo 文件；open 非空非 Reo 文件夹返回 metadata invalid。initialize/open 获取 lock 后，托管目录创建、metadata revalidation、recovery、index reconciliation 和 session 返回前都必须消费当前 lock/root/`.reo` usability；中途失去 ownership 时返回 lock lost，不能继续写入新的 `.reo` 或记忆空间文件。`AGENTS.md` 使用 no-replace atomic write，不能覆盖用户已有文件。
- `.reo` metadata directory、`.reo/drafts`、`.reo/drafts/segments` 和 `memories/` 必须是缺失或真实目录；如果任一层是 symlink 或非目录，initialize/open/lock/draft 初始化都必须拒绝，不能跟随 symlink 写入 记忆空间外。`.reo/workspace.json` 和 `.reo/index.json` 读取必须使用 no-follow file handle，symlink leaf 不作为 记忆空间 metadata 或 index 输入。托管 child directory 必须在已验证 parent identity 内相对创建，创建前后复核 parent，不能在 ancestor swap 后复用缓存 absolute path。Workspace lock 必须绑定当前 memory space root identity、`.reo` directory identity 和 lock directory identity，在当前 `.reo` directory identity 内打开 no-follow `workspace.lock` leaf 并创建同目录 `workspace.lock.lock`；owner file 必须在已绑定 lock directory identity 内 no-follow 创建、写入 pid 并 fsync，owner 进程已不存在或 owner file 无效的 stale lock 可被替换，symlink leaf、root swap、parent swap 或 lock directory replacement 必须让 lock 不可用于后续 handle 授权。
- Audio segment draft 写入 `.reo/drafts/segments/<segmentId>/segment.json` 和 `audio.webm`；draft path 的 `.reo`、`.reo/drafts`、`.reo/drafts/segments` 和 leaf segment directory 任一层是 symlink 时必须拒绝写入。Draft create 在 parent identity 改变后必须清理自己刚创建的空 draft directory；当前进程创建的 active draft 在 append hot path 不重复扫描 finalized segments，但记忆空间 close、window teardown 或 root runtime state 清理后必须移除该进程态，后续 append 重新检查 finalized truth。Append metadata 写失败时必须将 audio 截回 append 前 size，返回 `ERR_RECORDING_APPEND_FAILED` 与 `dataRetention: "draft-preserved"`，且不得推进 sequence 或 byte count。cursor 大于 0 的替换时 target draft 必须先保持空 audio，再由 `workspace:cloneRecordingDraftPrefix` 从 source draft 复制 retained byte prefix；copy 前后必须校验 source/target metadata 和 target 空状态，复制中 lock lost 或 IO failure 必须回滚 target audio 为空，不得改变 source draft。cursor 为 0 的替换不克隆旧 draft，不保留旧 WebM 后段，必须创建新的 recording session 和新 draft 后重新写入 audio。Finalize request 必须带显式 `memoryId` 和 `durationMs`；Workspace Stage 录音优先使用当前 Memory context，只有没有当前 Memory 时才先创建 Memory，main 只把 audio segment 追加到显式 Memory，不允许从 `segmentId` 隐式派生 Memory。Finalize 后只允许复制 `segment.json`、`audio.webm` 和 `transcript.md` 到对应 `memories/<memoryId>/segments/<segmentId>/`；未知普通文件、symlink 或非文件必须让 finalize 失败并保留 draft。Durable `segment.json` 标记为 `finalized`，写入 `memoryId`、`segmentId`、`type: "audio"`、title、duration、`finalizedAt` 和实际 `audio.webm` 字节数，创建缺失的 `transcript.md`，并更新 `.reo/index.json`。
- Finalize 在写 durable `segment.json` 前必须把复制后的 draft metadata 作为不可信文件重新按 draft schema 校验，并确认 `workspaceId`、`segmentId`、`type: "audio"` 和 `audioByteLength` 与当前 finalize 请求及实际 `audio.webm` 一致；校验失败必须在暴露 durable segment truth 前失败并保留 draft。
- Finalize 创建 `memories/<memoryId>/segments/` 时必须逐段使用非递归目录创建和 `lstat` 复核；如果 `memories/`、`memories/<memoryId>` 或 `segments` 在目标解析后、实际 `mkdir` 前被替换成 symlink，必须拒绝 finalize、保留 draft，且不得在 记忆空间外创建 memory、segments 或 staging tree。Staging directory 必须在已验证 `segments/` parent 内用相对 `mkdir` 创建，并在 marker、fsync、copy 和 expose 前重新解析，不能复用 validation 前缓存的 absolute path；staging `segment.json` 必须通过 no-follow file handle 读取。最终 expose 必须在已验证 `segments/` parent 内重验 target missing，创建 target directory 作为 no-replace reservation，先搬迁 marker 再搬迁 staging 内容；发现同名 target 已存在或 late-created target 必须失败并保留 draft，不得替换用户文件。
- Memory metadata 必须满足 `memory.json.memoryId` 与所在 `memories/<memoryId>/` directory 一致；`memory.json` leaf 必须用 no-follow file handle 读取，symlink leaf 不进入 rebuild/index/read 投影。
- Finalized audio segment 必须同时满足：`segment.json.status === "finalized"`、`segment.json.type === "audio"`、`segment.json.memoryId` 与所在 memory directory 一致、`segment.json.segmentId` 与所在 segment directory 一致、title、duration 和 audio byte 投影字段通过 schema 校验，且 segment leaf directory 不是 symlink，finalized `segment.json` leaf 通过 no-follow file handle 读取，`segment.json.audioByteLength` 与 `audio.webm` 实际文件大小一致。finalized audio segment 不接受后续 audio append；即使存在同 id stale draft，append 也必须先识别 durable finalized truth 并返回 finalized error。
- Finalized audio segment transcript save public request 必须携带 `workspaceHandle`、`memoryId` 和 `segmentId`，main process 直接解析 `memories/<memoryId>/segments/<segmentId>/` 文件真源，不通过全局 `segmentId` lookup 选择 first match。已有重复 finalized `segmentId`、unsafe finalized metadata 或 metadata ownership mismatch 必须返回 typed error envelope。Transcript save 必须在当前 segment directory identity 内写入，不能在 parent swap 后使用缓存 absolute path。Save 成功 response 返回刷新后的 Memory summary，renderer 以该 summary 更新 Workspace snapshot。Draft markdown save 只服务 in-progress draft transaction，不是 finalized public fallback。
- 如果 `.reo/index.json` 更新失败，finalize 返回错误信封并保留 draft metadata；不得留下 metadata finalized 但 index 缺失 summary 的不一致状态。
- 同一 `memoryId` 一次只允许一个 memory file write；create、append 和 title update 共用 main process memory write lock。并发 append 或并发 title update/append 会拒绝其中一个并保留未完成写入的既有文件状态，避免 last-writer-wins 丢失 recording。
- Workspace metadata、workspace index、memory metadata 和 segment metadata 都是受限 JSON 文件；读取必须 no-follow、普通文件、当前目录 identity 未变化，大小不得超过 1 MiB，schema 必须 strict，不得通过 unknown 字段偷偷扩展合同。
- `segmentId` 在所有 `memories/*/segments/*` 下必须全局唯一；已有重复 finalized `segmentId` 会让 lookup 拒绝返回 first match，避免不确定读写。
- 新建 Memory 容器不得复用已存在的 `memories/<memoryId>/`；重复 `memoryId` 或重复 durable `segmentId` 必须失败并保留既有文件，不得覆盖或删除用户内容。
- `.reo/index.json` 是可重建 index；损坏、丢失、symlink leaf 或合法但陈旧时，Reo 从 `memories/*/memory.json`、`memories/*/segments/*/segment.json` 和对应 `audio.webm` 实际文件大小协调并写回 summary，只纳入 schema、metadata ownership、finalized status 和 audio 字节数一致的 finalized audio segments。Transcript presence 只由记忆空间内普通 `transcript.md` 的 `lstat` size 投影，symlink leaf 不进入 index。`memories/` scan 必须绑定 root directory identity；scan 前、scan 后或 index 持久化前 identity 改变时必须失败并保留既有 index。`memories/` 存在但不可读时，open 必须失败并保留既有 index，不能把 read error 写成空投影。Transcript save 只刷新所属 memory 的 index entry，不因单次保存重扫全 workspace；同一 workspace 的全量 index replace 和单条 index entry refresh 共用 main process index write queue。全量 replace 和 open reconciliation replace 都在队列内重新读取当前 read model；单条 refresh 每次在队列内部重新读取当前 memory summary，再合并当前 index，避免并发 metadata refresh 或 full rebuild 造成 stale summary 与 `.reo/index.json` last-writer-wins。
- 如果进程在 finalized metadata 写入后、`.reo/index.json` 写入前崩溃，下一次 open 会按记忆空间文件真源协调合法但陈旧的 index，避免 finalized audio segment 永久隐藏。
- `updateWorkspaceIndex` 不在 update 成功前持久化 index 协调结果；如果 update 失败，已有合法 index 保持原状，避免 index summary 与回滚后的 draft metadata 反向不一致。

## 数据流设计纪律

- 每个 feature 必须先写 conceptual model，再决定是否需要 physical DB schema。
- 数据流必须写清 write owner、read owner、durable source、cache owner、mutation owner、invalidation 和 recovery。
- Workspace file、`.reo` metadata、rebuildable index、TanStack Query cache、component state 和 form state 不能存储同一事实的不同版本；Segment 关系只在 `memory.json.segmentIds` 和 derived Workspace snapshot summary 中出现。
- 如果同一事实需要出现在多个位置，必须说明 source of truth、同步方向、冲突处理和丢失恢复。
- 不得因为未来可能查询就提前建表；也不得因为第一版小就省略实体、关系和字段语义设计。
- Durable file write 必须定义 atomic rename 边界、file fsync、parent directory fsync、跨平台差异、失败时 `.part` 状态和恢复策略。
- Memory space write 必须定义 single-writer 策略；同一 workspace 被多个 Reo window 或进程打开时，必须设计检测、拒绝或合并语义。

## Query 规则

- Query keys 引入时必须稳定、命名清楚，并在本文档记录。
- 改变底层数据的 mutation 必须定义 invalidation。
- Optimistic update 必须在 `flow.md` 写 rollback。
- 不得为 main/server-backed data 绕过 TanStack Query 写临时 fetching。
- Zod 只用于不可信 runtime boundary，不用于重复 TypeScript 类型。

## Slice 审查门禁

每个 spec 在进入实现前必须回答：

- 是否需要 DB schema；如果需要，实体和表关系是什么。
- 是否需要 migration；如果需要，foreign key、index、delete/update effect 是什么。
- durable source 是 workspace file、`.reo` metadata、SQLite，还是多者分工；谁是真源。
- 数据获取模式是什么：TanStack Query、direct component state、filesystem scan 或其他明确 owner。
- Query keys、mutation invalidation、optimistic update 和 rollback 是否定义。
- Form state、client state、server/main-backed state 的 owner 是否清楚。
- 文件夹结构是否有 source-of-truth、rebuildable index、用户文件和 Reo metadata 的边界。

## 变更门禁

任何 schema、表关系、auth tables、migrations、query keys、cache ownership、Zustand ownership 改动，都必须更新本文档。

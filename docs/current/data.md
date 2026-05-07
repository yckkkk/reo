# 数据

本文档是数据结构与状态归属的当前真源。

## 当前事实

- 当前没有 database schema。
- 当前 durable data contract 是 workspace folder 文件。
- 当前没有 Drizzle config。
- 当前没有 Better Auth tables。
- 当前没有 auth session persistence owner。
- 当前 TanStack Query key 覆盖 workspace snapshot：`['workspace', 'snapshot', workspaceId]`。
- 当前 TanStack Query key 覆盖 memory detail：`['workspace', 'memory-detail', workspaceId, memoryId]`。
- 当前没有 Zustand stores。
- 当前 React Hook Form form owner 覆盖 create workspace submit 前的 title、description、selection token 和 displayPath draft。
- 当前 Zod runtime schema owner 是 workspace IPC contract 和错误信封。

## 技术方向

- 本地 SQLite 使用 Drizzle ORM + `better-sqlite3`。
- 没有真实 schema、关系和 migration owner 前，不引入 Drizzle、`better-sqlite3`、Drizzle config 或 migration directory。
- 每个 feature slice 都必须显式判断是否产生 DB schema、table relationship、query key、cache ownership、form owner、client state owner 或 durable file contract。
- 如果判断为不引入 DB schema，必须说明当前 durable source、恢复路径、未来触发 DB 的具体 pressure。
- Auth/session foundation 使用 Better Auth 的 Electron 支持。
- 没有真实 session lifecycle、auth tables 和 secure persistence owner 前，不引入 Better Auth package 或 auth storage。
- Form、IPC、auth、persistence 边界使用 Zod 做运行时校验。
- Main/server-backed async data 使用 TanStack Query。
- TanStack Query provider 当前服务真实 main-backed workspace snapshot 和 memory detail consumer。
- 非 server-backed 的本地 UI/client state 使用 Zustand。
- 没有跨 component subtree 的 client state owner 前，不引入 Zustand store。
- Form state 使用 React Hook Form。
- React Hook Form 当前只服务真实 create workspace form submit、folder selection draft 和 validation owner。

## Schema 规则

- 从产品实体和关系定义表，不从 UI screen 倒推表。
- 实现 migration 前必须写清每个 table relationship。
- 设计表时必须先写 entity、relationship、cardinality、ownership、lifecycle、delete/update effect，再写 columns。
- 优先显式 foreign key 和 index，不靠隐式耦合。
- 不为同一 domain concept 建多个重复 table shape。
- 不创建 speculative columns 或 generic metadata bucket。
- Migration 必须可审查，并关联引入它的 spec。

## 状态归属

- 用户记忆内容的 durable artifact source 属于 workspace files。
- `.reo` metadata 和 rebuildable index 属于 workspace folder，由 Reo 管理。
- SQLite 只有在引入后才拥有明确的 app index、relationship、query、session 或 processing state；不得替代 workspace files 成为用户内容真源。
- Main/server-backed async data 属于 TanStack Query。
- Ephemeral UI state 属于 component state 或 Zustand。
- Form drafts 在提交前属于 React Hook Form。
- Derived state 默认计算，不存储；只有明确性能或一致性理由才存储。

## 第一产品切片数据决策

- First product slice 的用户内容真源是 workspace folder；不引入 Drizzle schema、SQLite file、migration directory 或 DB-backed content truth。
- Workspace stable files 包括 `AGENTS.md`、`.reo/workspace.json`、`.reo/index.json`、`memories/<memoryId>/memory.json`、`memories/<memoryId>/recordings/<recordingId>/recording.json`、`audio.webm`、`transcript.md` 和 `reflections.md`。
- `.reo/index.json` 是可重建 UI index，不是用户内容真源。
- `.reo/index.json` 当前保存 `memories[]` 投影；每个 summary 包含 `memoryId`、title、created/updated time、recording count、duration、audio bytes、非空 transcript/reflections presence。
- `.reo/workspace.lock` 和 `.reo/workspace.lock.lock` 是 volatile runtime lock artifacts，不进入 Codex read-only validation 的稳定 hash 范围；`.reo/workspace.lock.lock/owner.json` 只记录当前 main process pid，用于识别 stale lock，不是用户内容。缺失、损坏或 symlinked owner file 代表未完成或无效 lock，可在下一次 acquire 时替换。
- Query keys 使用 stable `workspaceId`、`memoryId` 和 `recordingId`；`workspaceHandle` 是 main memory capability，不进入 query key、不写入文件、不跨 app restart 持久化。
- TanStack Query 只拥有 main-backed workspace snapshot 和 memory detail cache；active recording lifecycle、drawer close protection、chunk sequence、editor draft 和 Blob URL 不进入 query cache。
- React Hook Form 只拥有 create workspace submit 前的 form draft，包括 title、description、selection token 和 displayPath。
- Workspace Home 本地搜索只使用当前 loaded workspace snapshot 的 `memories` 投影和 renderer component state；搜索词不进入 Query key、Zustand、IPC、DB、workspace files 或 `.reo/index.json`。
- Memory detail 使用 `['workspace', 'memory-detail', workspaceId, memoryId]` 读取当前 memory detail projection；`workspaceHandle` 只作为 `getMemoryDetail` request capability 进入 preload/main 边界，不进入 Query key、DOM、URL、workspace files、`.reo/index.json` 或持久化缓存身份。
- Memory detail response 读取 `memory.json` 作为 detail identity 真源，使用 `.reo/index.json` 中同一 memory summary 的 `recordingCount`、`hasTranscript` 和 `hasReflections` 投影，并只返回前 24 条 recording summary 作为当前首屏 preview；`recordingsTruncated` 标明还有未展示的 recordings，避免 detail navigation 对长 memory 做无界 recording 文件读取或 DOM 渲染。
- Create workspace folder selection token 和 displayPath 属于当前 RHF form lifecycle；open existing workspace 的 selection token 只存在于该 open action 的当前事件流。selection token 只用于一次 initialize/open request，不进入 Query cache 或 durable files；initialize/open 消费 token 后如果返回错误，renderer 不复用该 token。
- Recording overlay/drawer component state 拥有 active recording lifecycle、drawer close protection、elapsed timer、transcript draft、reflections draft、autosave status 和 active playback Blob URL。Transcript draft 初始为空，只来自用户编辑或已保存文件，不生成本地 mock transcript，也不作为 STT 真源。
- Finalize response 返回当前 memory summary 和单条 recording summary；renderer 必须同时更新当前 workspace session 的 `memories` 投影和临时 `recordings` 兼容视图。durable truth 仍是 workspace files 和 `.reo/index.json` 的 memory summary。后续 Home/Memory detail slice 会改为直接消费 `memories`。
- Zod 当前用于 workspace IPC request/response、workspace metadata、recording metadata、audio read request 和错误信封。
- `chooseDirectory` 阶段不产生 durable data contract；真实路径只暂存在 main process selection token store，不写入文件、不进入 renderer、不进入 query key。
- Workspace 初始化写入 `AGENTS.md`、`.reo/workspace.json`、`.reo/index.json`、`memories/` 和 `.reo/drafts/recordings/`；open 现有 workspace 时会在返回 ready session 前补齐缺失的 `memories/` 和 `.reo/drafts/recordings/` 托管目录，仍拒绝 symlink 或非目录。initialize/open 获取 lock 后，托管目录创建、metadata revalidation、recovery、index reconciliation 和 session 返回前都必须消费当前 lock/root/`.reo` usability；中途失去 ownership 时返回 lock lost，不能继续写入新的 `.reo` 或 workspace files。如果已有 `AGENTS.md`，main 必须在获取 lock 前返回 conflict，不得创建 `.reo/workspace.lock` 或任何 workspace 文件。`AGENTS.md` 使用 no-replace atomic write，不能覆盖用户已有文件。
- `.reo` metadata directory、`.reo/drafts`、`.reo/drafts/recordings` 和 `memories/` 必须是缺失或真实目录；如果任一层是 symlink 或非目录，initialize/open/lock/draft 初始化都必须拒绝，不能跟随 symlink 写入 workspace 外。`.reo/workspace.json` 和 `.reo/index.json` 读取必须使用 no-follow file handle，symlink leaf 不作为 workspace metadata 或 index 输入。托管 child directory 必须在已验证 parent identity 内相对创建，创建前后复核 parent，不能在 ancestor swap 后复用缓存 absolute path。Workspace lock 必须绑定当前 workspace root identity、`.reo` directory identity 和 lock directory identity，在当前 `.reo` directory identity 内打开 no-follow `workspace.lock` leaf 并创建同目录 `workspace.lock.lock`；owner file 必须在已绑定 lock directory identity 内 no-follow 创建、写入 pid 并 fsync，owner 进程已不存在或 owner file 无效的 stale lock 可被替换，symlink leaf、root swap、parent swap 或 lock directory replacement 必须让 lock 不可用于后续 handle 授权。
- Recording draft 写入 `.reo/drafts/recordings/<recordingId>/recording.json` 和 `audio.webm`；draft path 的 `.reo`、`.reo/drafts`、`.reo/drafts/recordings` 和 leaf recording directory 任一层是 symlink 时必须拒绝写入。Draft create 在 parent identity 改变后必须清理自己刚创建的空 draft directory；当前进程创建的 active draft 在 append hot path 不重复扫描 finalized recordings，但 workspace close、window teardown 或 root runtime state 清理后必须移除该进程态，后续 append 重新检查 finalized truth。Append metadata 写失败时必须将 audio 截回 append 前 size，返回 `ERR_RECORDING_APPEND_FAILED` 与 `dataRetention: "draft-preserved"`，且不得推进 sequence 或 byte count。Finalize request 必须带显式 `durationMs`，不得由 IPC 默认写 0；new memory finalize 的 `memoryId` 必须由 IPC owner 或 caller 显式提供，不允许从 `recordingId` 隐式派生。Finalize 后只允许复制 `recording.json`、`audio.webm`、`transcript.md` 和 `reflections.md` 到对应 `memories/<memoryId>/recordings/<recordingId>/`；未知普通文件、symlink 或非文件必须让 finalize 失败并保留 draft。Durable `recording.json` 标记为 `finalized`，写入 `memoryId`、`recordingId`、title、duration、`finalizedAt` 和实际 `audio.webm` 字节数，创建缺失的 `transcript.md` 与 `reflections.md`，并更新 `.reo/index.json`。
- Finalize 在写 durable `recording.json` 前必须把复制后的 draft metadata 作为不可信文件重新按 draft schema 校验，并确认 `workspaceId`、`recordingId` 和 `audioByteLength` 与当前 finalize 请求及实际 `audio.webm` 一致；校验失败必须在暴露 durable recording truth 前失败并保留 draft。
- Finalize 创建 `memories/<memoryId>/recordings/` 时必须逐段使用非递归目录创建和 `lstat` 复核；如果 `memories/`、`memories/<memoryId>` 或 `recordings` 在目标解析后、实际 `mkdir` 前被替换成 symlink，必须拒绝 finalize、保留 draft，且不得在 workspace 外创建 memory、recordings 或 staging tree。Staging directory 必须在已验证 `recordings/` parent 内用相对 `mkdir` 创建，并在 marker、fsync、copy 和 expose 前重新解析，不能复用 validation 前缓存的 absolute path；staging `recording.json` 必须通过 no-follow file handle 读取。最终 expose 必须在已验证 `recordings/` parent 内重验 target missing，创建 target directory 作为 no-replace reservation，先搬迁 marker 再搬迁 staging 内容；发现同名 target 已存在或 late-created target 必须失败并保留 draft，不得替换用户文件。
- Memory metadata 必须满足 `memory.json.memoryId` 与所在 `memories/<memoryId>/` directory 一致；`memory.json` leaf 必须用 no-follow file handle 读取，symlink leaf 不进入 rebuild/index/read 投影。
- Finalized recording 必须同时满足：`recording.json.status === "finalized"`、`recording.json.memoryId` 与所在 memory directory 一致、`recording.json.recordingId` 与所在 recording directory 一致、title、duration 和 audio byte 投影字段通过 schema 校验，且 recording leaf directory 不是 symlink，finalized `recording.json` leaf 通过 no-follow file handle 读取，`recording.json.audioByteLength` 与 `audio.webm` 实际文件大小一致。finalized recording 不接受后续 audio append；即使存在同 id stale draft，append 也必须先识别 durable finalized truth 并返回 finalized error。Audio playback manifest/chunk read 只从 finalized recording truth 读取，public request 必须携带 `workspaceHandle`、`memoryId` 和 `recordingId`，并拒绝 draft-only recording、symlink 或非文件 `audio.webm`；main process 可以按 workspace + memory id + recording id 复用 finalized audio target cache。manifest 和 chunk read 都会检查其他 memory 下是否存在同 `recordingId` 的 duplicate finalized directory，避免 direct chunk IPC 绕过 manifest；chunk read 只返回请求 byte range，不得把完整 audio file 读入 IPC 热路径；audio open 后的 file handle size 必须继续等于 finalized metadata 的 `audioByteLength`，不能读取 finalized metadata 未承认的尾部字节。
- Finalized recording detail/save public request 必须携带 `workspaceHandle`、`memoryId` 和 `recordingId`，main process 直接解析 `memories/<memoryId>/recordings/<recordingId>/` 文件真源，不通过全局 `recordingId` lookup 选择 first match。已有重复 finalized `recordingId`、unsafe finalized metadata 或 metadata ownership mismatch 必须返回 typed error envelope。Detail 读取 finalized `recording.json` 必须使用当前 recording directory identity 和 no-follow file handle；transcript/reflections save 必须在当前 recording directory identity 内写入，不能在 parent swap 后使用缓存 absolute path。Draft markdown save 只服务 in-progress draft transaction，不是 finalized public fallback。
- 如果 `.reo/index.json` 更新失败，finalize 返回错误信封并保留 draft metadata；不得留下 metadata finalized 但 index 缺失 summary 的不一致状态。
- 同一 `memoryId` 一次只允许一个 memory file write；create、append 和 title update 共用 main process memory write lock。并发 append 或并发 title update/append 会拒绝其中一个并保留未完成写入的既有文件状态，避免 last-writer-wins 丢失 recording。
- Workspace metadata、workspace index、memory metadata 和 recording metadata 都是受限 JSON 文件；读取必须 no-follow、普通文件、当前目录 identity 未变化，大小不得超过 1 MiB，schema 必须 strict，不得通过 unknown 字段偷偷扩展合同。
- `recordingId` 在所有 `memories/*/recordings/*` 下必须全局唯一；已有重复 finalized `recordingId` 会让 lookup 拒绝返回 first match，避免不确定读写。
- 新建 memory 不得复用已存在的 `memories/<memoryId>/`；重复 `memoryId` 或重复 durable `recordingId` 必须失败并保留 draft，不得覆盖或删除既有用户文件。
- `.reo/index.json` 是可重建 index；损坏、丢失、symlink leaf 或合法但陈旧时，Reo 从 `memories/*/memory.json`、`memories/*/recordings/*/recording.json` 和对应 `audio.webm` 实际文件大小协调并写回 summary，只纳入 schema、metadata ownership、finalized status 和 audio 字节数一致的 finalized recordings。Transcript/reflections presence 只由 workspace 内普通 markdown file 的 `lstat` size 投影，symlink leaf 不进入 index。`memories/` scan 必须绑定 root directory identity；scan 前、scan 后或 index 持久化前 identity 改变时必须失败并保留既有 index。`memories/` 存在但不可读时，open 必须失败并保留既有 index，不能把 read error 写成空投影。Transcript/reflections save 只刷新所属 memory 的 index entry，不因单次 autosave 重扫全 workspace；同一 workspace 的全量 index replace 和单条 index entry refresh 共用 main process index write queue。全量 replace 和 open reconciliation replace 都在队列内重新读取当前 read model；单条 refresh 每次在队列内部重新读取当前 memory summary，再合并当前 index，避免并发 autosave、metadata refresh 或 full rebuild 造成 stale summary 与 `.reo/index.json` last-writer-wins。
- 如果进程在 finalized metadata 写入后、`.reo/index.json` 写入前崩溃，下一次 open 会按 workspace 文件真源协调合法但陈旧的 index，避免 finalized recording 永久隐藏。
- `updateWorkspaceIndex` 不在 update 成功前持久化 index 协调结果；如果 update 失败，已有合法 index 保持原状，避免 index summary 与回滚后的 draft metadata 反向不一致。

## 数据流设计纪律

- 每个 feature 必须先写 conceptual model，再决定是否需要 physical DB schema。
- 数据流必须写清 write owner、read owner、durable source、cache owner、mutation owner、invalidation 和 recovery。
- Workspace file、`.reo` metadata、rebuildable index、TanStack Query cache、component state 和 form state 不能存储同一事实的不同版本。
- 如果同一事实需要出现在多个位置，必须说明 source of truth、同步方向、冲突处理和丢失恢复。
- 不得因为未来可能查询就提前建表；也不得因为第一版小就省略实体、关系和字段语义设计。
- Durable file write 必须定义 atomic rename 边界、file fsync、parent directory fsync、跨平台差异、失败时 `.part` 状态和恢复策略。
- Workspace write 必须定义 single-writer 策略；同一 workspace 被多个 Reo window 或进程打开时，必须设计检测、拒绝或合并语义。

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

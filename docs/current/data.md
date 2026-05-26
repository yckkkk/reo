# 数据

本文档是数据结构与状态归属的当前真源。

## 当前事实

- 当前没有 database schema、Drizzle config、Better Auth tables 或 auth session persistence owner。
- 当前 durable data contract 是记忆空间文件夹文件和 main-owned memory space registry。
- 当前 TanStack Query key 覆盖 memory space list、Workspace snapshot、Memory detail、selected Segment content、selected SegmentSupplement content 和 voice transcription settings。
- 当前没有 Zustand stores。
- 当前补转录不新增 Query key、不新增 durable schema、不新增 Zustand store。自动补转录状态只存在于 main process queue；手动补转录 running 状态只存在于 App feature-local component state。
- 当前 React Hook Form form owner 覆盖 create memory space、Memory create、Memory rename、Segment rename、SegmentSupplement rename 和 memory space rename 的提交前 draft。
- 当前 Zod runtime schema owner 是 workspace IPC contract、记忆空间 metadata、object manifest 和错误信封。

## 当前实体与字段归属

- 记忆空间是用户选择的本地文件夹；用户内容真源是该文件夹内的普通文件。
- `.reo/workspace.json` 保存 `schemaVersion`、`workspaceId`、title、description 和 createdAt；它定义记忆空间身份，不保存 UI 状态、root path、handle 或查询缓存。
- Workspace snapshot 是 IPC response 和 TanStack Query cache 投影，只包含 `workspaceId`、title、description 和 `memories[]`；不包含顶层 `segments[]`、root path、selection token 或 `workspaceHandle`。
- Memory、Segment 和 SegmentSupplement 是用户内容文件空间节点。用户可编辑语义写在 Markdown/frontmatter；Segment 和 SegmentSupplement 的稳定 id 写在对应 Markdown frontmatter `id`，`.reo/objects/<kind>/<id>.json` manifest 镜像 id、归属、kind、时长、音频字节数、正文 byte 长度、presentation state 和事务字段。
- 目录 basename 是用户可见名称真源；Markdown frontmatter title 是 Reo 持锁写入的语义镜像。目录 basename 等于稳定 id 时使用 Markdown title 投影；目录 basename 为 `<id>--<title>` 或用户手动改名后的安全名称时使用 basename title 投影。
- Memory summary 由 `.reo/index.json` 的 `memories[]` 提供，包含 identity、title、timestamps、Segment 计数、audio 聚合、note presence 和 supplement count。`hasAnyNote` 表示存在 note Segment 或 note SegmentSupplement。
- Memory detail 由 matching Memory 目录内的 `memory.md`、Memory manifest 和 finalized Segment 文件空间节点派生，包含 Memory summary 字段和 `segments[]`。
- Segment projection 当前支持 `audio` 和 `note`。Audio Segment 持有 duration、audio byte length、transcript presence、lastTranscriptionAttempt、supplements 和 contentTabOrder；note Segment 持有 bodyByteLength、supplements 和 contentTabOrder。
- Segment primary content tab 的用户可见名称来自 `segment.md` frontmatter `content_title`，缺失时由 renderer 按 Segment type 显示 `转录` 或 `正文`。
- SegmentSupplement projection 当前支持 `audio` 和 `note`。Audio supplement 持有 duration、audio byte length、transcript presence 和 lastTranscriptionAttempt；note supplement 持有 bodyByteLength。
- Memory 的 Segment 关系由该 Memory 目录下合法 finalized Segment 文件空间节点表达；当前不保存显式 Segment id 列表。关系来自合法目录、Markdown/frontmatter `id` 和 `.reo/objects/*` manifest mirror。
- 当前 finalized read model 只接受 `audio` 和 `note`；photo、video、imported_file 和其它 kind 不进入投影。
- Draft 属于 `.reo/drafts/segments/<segmentId>/` 或 `.reo/drafts/supplements/<supplementId>/`。Finalized Segment 属于 matching Memory 的 `segments/<segmentDirectory>/`；Finalized SegmentSupplement 属于 matching Segment 的 `supplements/<supplementDirectory>/`。
- Audio finalized object 由 Markdown、manifest、`audio.webm` 和 transcript Tiptap sidecar 表达；note finalized object 由 Markdown、Tiptap JSON sidecar 和 manifest 表达。Note Segment 与 note SegmentSupplement 可以包含同目录 `attachments/<filename>` 图片 payload。Audio 的 `content.tiptap.json` 只映射 `segment.md` / `supplement.md` 中 `## Transcript` 后的正文。
- Note Segment / note SegmentSupplement body 和 audio Segment / audio SegmentSupplement transcript 的 `content.tiptap.json` 是同节点可编辑正文的富结构载体，保存 `schemaVersion`、`objectType: 'tiptap-content'`、对应 Markdown body hash、profile、canonical Tiptap JSON hash 和有界 Tiptap JSON `content`。Markdown 缺 sidecar 时由 `@tiptap/markdown` 生成；Markdown 未变且 sidecar JSON 改变时由 sidecar serialize 回 Markdown；Markdown 改变且 sidecar 未改变时重新生成 sidecar；双方同时发生不可自动合并的变化或 sidecar 含无法无损序列化的 Tiptap 内容时进入 review/错误，不覆盖任一方。当前 durable Tiptap profile 覆盖 heading、paragraph text-align、blockquote、bullet/ordered/task list、code block、horizontal rule、image、bold、italic、strike、inline code、underline、link、highlight、colored highlight、superscript 和 subscript。Tiptap JSON attrs 只接受 JSON 可表达值，不接受 `NaN` / `Infinity`；colored highlight 只接受 Reo toolbar 暴露的 `var(--tt-color-highlight-green|blue|red|purple|yellow)` 变量，任意外部 CSS color 不进入 durable JSON/Markdown 合同。
- Reo 打开、刷新和 index rebuild 时只对 `memories/*/segments/*/segment.md` 与 `memories/*/segments/*/supplements/*/supplement.md` 做浅层有界候选识别。缺少 frontmatter 的 note Segment 或 note SegmentSupplement 可以在身份唯一且路径安全时被补全 `id`、`title`、`kind: note` 和 manifest mirror；已存在的 note/audio Segment 目录移动到另一个 Memory 下时修复 Segment manifest 的 `memoryId`，已存在的 note/audio SegmentSupplement 目录移动到另一个 Segment 下时修复 Supplement manifest 的 `memoryId` 和 `segmentId`。Audio 移动修复要求同目录 `audio.webm` 与 manifest byte length 匹配。保存事务后的 index refresh 不执行跨父级移动修复，ownership mismatch 仍返回 typed error。duplicate id、混合对象形态、unsafe path 或无法唯一归属的候选不进入 Memory detail、Workspace snapshot 或 `.reo/index.json`。
- Finalized Segment manifest 的 `contentTabOrder` 是 Reo 管理的可选 durable presentation 字段，元素为 `segment` 或 `supplement:<supplementId>`；读取投影时按当前合法 tab 归一化。
- `lastTranscriptionAttempt` 是 Reo 管理的技术状态字段，取值为 `'success'`、`'failed'` 或 `'never'`；读取投影时缺失按 `'never'` 投影。手动补转录 mode 不扩展该字段取值。
- Note projection 不暴露 duration、audio byte、transcript 或 lastTranscriptionAttempt 字段。附件相对引用写在 Markdown 正文中；附件本身不是独立对象、不是 `.reo/index.json` 投影，也不进入 manifest 列表。
- Memory space registry entry 属于 main-owned app state，字段包含 `workspaceId`、title、description、rootPath、addedAt 和 lastOpenedAt；renderer 只能读取不含 rootPath 的列表投影。
- Voice transcription settings 属于 main-owned app state，文件位于 `userData/voice-transcription-settings.json`；X-Api-Key 字段经 Electron `safeStorage` 加密，renderer 只能读取不含明文或密文的 settings snapshot。同一 key 是录音中流式识别和 finalized audio 补转录的凭证真源。
- `workspaceHandle` 是 main process runtime capability，只用于当前窗口授权 IPC 操作，不进入 query key、DOM、URL、记忆空间文件或 registry。

## 技术方向

- 本地 SQLite 使用 Drizzle ORM + `better-sqlite3`；没有真实 schema、关系和 migration owner 前，不引入 Drizzle、`better-sqlite3`、Drizzle config 或 migration directory。
- Auth/session foundation 使用 Better Auth 的 Electron 支持；没有真实 session lifecycle、auth tables 和 secure persistence owner 前，不引入 Better Auth package 或 auth storage。
- Form、IPC、auth、persistence 边界使用 Zod 做运行时校验。
- Main/server-backed async data 使用 TanStack Query。
- 非 server-backed 的本地 UI/client state 使用 Zustand；没有跨 component subtree 的 client state owner 前，不引入 Zustand store。
- Form state 使用 React Hook Form。
- 每个功能变更都必须显式判断是否产生 DB schema、table relationship、query key、cache ownership、form owner、client state owner 或 durable file contract。

## 当前数据决策

- 当前用户内容真源是记忆空间文件夹；不引入 Drizzle schema、SQLite file、migration directory 或 DB-backed content truth。
- Memory space registry 用于跨 app restart 保留已导入记忆空间。Registry 最多保留最近 100 个记忆空间；root path 只在 main-owned registry file 和 main process 内部存在。Renderer 通过 list/open/remove IPC 操作 registry projection，不读取真实路径。
- Memory space registry 不是记忆空间内容真源。记忆空间 root folder basename 是 title 文件真源；`.reo/workspace.json.title` 是 metadata mirror；description、memory summary 和 Segment truth 仍来自记忆空间文件。
- Registry 文件缺失、损坏、schema 不匹配或 symlink leaf 按空列表处理；不可读 IO 错误返回 typed error envelope。Open 已导入记忆空间时只 resolve 当前 `workspaceId`；stored root 缺失时才做有界 sibling scan。
- Memory space rename 使用 `workspace:updateMemorySpaceTitle`。Active request 使用 `workspaceHandle` 和安全 title；inactive request 使用 `workspaceId` 和安全 title。Main 在 single-writer lock 下移动真实 root folder basename，并在 root move 成功后写入 `.reo/workspace.json.title` mirror。Response 不返回 root path 或 handle。
- 用户直接删除记忆空间文件夹后，registry entry 可以继续显示。点击该 entry 时 main 返回 missing-root typed error；用户可从 sidebar 移除 registry entry，该动作不删除本地文件夹。
- Memory space stable files 包括入口 `AGENTS.md`、Reo 托管的 `skills/reo-edit/` 和 `skills/reo-doctor/`、`.reo` metadata/index/object manifests、Memory/Segment/Supplement Markdown、audio payload、note attachment payload、draft、trash、lock 和 recovery marker。具体路径合同以 workspace contract 与文件读写代码为准；本文档只记录所有权与真源边界。
- `memory.md`、`segment.md` 和 `supplement.md` 是用户和 agent 可编辑的语义真源；`.reo/workspace.json`、`.reo/objects/*/*.json`、draft、trash、lock 和 recovery marker 是 Reo 管理的技术完整性层。
- 用户内容目录中的普通 `.json`、`.md`、`.html` 或其它文件可以存在，但不自动成为 Reo 对象，也不作为 Reo schema 输入。HTML 默认是不可信资源，未进入隔离预览能力前不由 renderer 执行或渲染。候选对象进入 needs-review 时，main-owned diagnostics 只记录类别和计数，不记录 root path、file path、title、正文、frontmatter 原文或 id 列表。
- `.reo/index.json` 是可重建 UI index，不是用户内容真源。合法但陈旧的 index 只能作为启动 cache，不能让合法 finalized object 永久隐藏。
- `.reo/workspace.lock` 和 `.reo/workspace.lock.lock` 是 volatile runtime lock artifacts，不进入稳定内容 hash；owner file 只用于识别 stale lock，不是用户内容。
- Query keys 使用 stable `workspaceId`、`memoryId`、`segmentId` 和 `supplementId`；`workspaceHandle` 是 runtime capability，不进入 query key、不写入文件、不跨 app restart 持久化。
- TanStack Query 拥有 main-backed memory space list、Workspace snapshot、Memory detail、selected Segment content、selected SegmentSupplement content 和 voice settings snapshot。Memory detail、note Segment content 和 note SegmentSupplement content 是文件真源投影，重新打开或重新选择时必须能 refetch；Segment/audio content cache 可持有本地音频 bytes 和 baseline hash；baseline 只用于下一次保存的外部修改检测。
- Workspace session close 或进入新 session 时，renderer 清理 workspace-scoped selected Segment content 和 selected SegmentSupplement content cache；Memory detail cache 可保留为即时投影，并由新 handle 后台刷新。
- Active recording lifecycle、overlay close protection、chunk sequence、transcript draft ref、playback state、Blob URL、pending rename/delete targets 和 manual backfill running state 都不进入 durable files 或 Query truth，按 owner 保留在 feature-local state。
- Recording recovery marker 存在 renderer `localStorage`，按 `workspaceId` 隔离，不保存音频二进制、密钥、workspace handle 或 raw path。
- Entity More 菜单 shell 动作不创建或更新 renderer projection、Query key、Zustand store、form schema、DB schema、Drizzle migration、registry projection 或 cache ownership。
- Finalize、transcript save、note body save、SegmentSupplement transcript save、SegmentSupplement body save 和 SegmentSupplement finalize response 只用返回的 summary/projection patch Workspace snapshot、Memory detail cache、exact content Query 和当前 session projection；durable truth 仍是记忆空间文件和 `.reo/index.json` 的 memory summary。
- SegmentSupplement projection 只更新 parent Segment，不作为同级 Segment 插入顶层 Segment strip。
- Note image attachment save response 不写 Query cache、不改变 Memory summary，也不改变 `.reo/index.json`。正文保存成功后，Markdown 相对引用才成为正文语义真源。Reo 当前不实现附件 garbage collection、file watcher 或独立附件对象索引。
- `chooseDirectory` 阶段不产生 durable data contract；真实路径只暂存在 main process selection token store，不写入文件、不进入 renderer、不进入 query key。
- Initialize/open 获取 lock 后，托管目录创建、metadata revalidation、recovery、valid index read、必要 index rebuild 和 session 返回前都必须消费当前 lock/root/`.reo` usability；中途失去 ownership 时返回 lock lost，不能继续写入新的 `.reo` 或记忆空间文件。
- `.reo` metadata directory、draft roots 和 `memories/` 必须是缺失或真实目录；metadata、index、manifest 和 Markdown leaf 必须用 no-follow file handle 读取。Symlink、parent swap、root swap 或 lock directory replacement 必须让对应 read/write/handle 授权失败。
- Draft、finalize、restore、transcript save、note body save、attachment write/list 和 index rebuild 都必须从 explicit workspace/Memory/Segment/Supplement identity 出发，不接受 raw path。
- Finalized object lookup 必须校验 manifest ownership、kind、directory identity、Markdown/frontmatter schema 和 payload consistency。Duplicate durable id、unsafe path 或 ownership mismatch 必须返回 typed error，不得 fallback 到 first match 或 stale draft。
- Note body save 和 audio transcript save 都使用 Markdown baseline hash 与 Tiptap JSON baseline hash 防止外部修改覆盖；请求携带 Tiptap JSON 时必须同时携带对应 Tiptap baseline。Baseline 不匹配不覆盖 Markdown、不刷新 index、不推进 manifest；note body stale save 返回当前磁盘 Markdown、Tiptap JSON 和两组 baseline hash，audio transcript stale save 返回 transcript changed error 并保留当前编辑器内容。
- `.reo/index.json` rebuild 从合法 Memory、Segment、SegmentSupplement 文件空间节点协调 summary。Index scan 必须绑定 `memories/` root identity；scan/read/persist identity 改变或 `memories/` 不可读时失败并保留既有 index。
- 同一 `memoryId` 一次只允许一个 memory file write；同一 workspace 的 full index replace 和 single memory index refresh 共用 main process index write queue，避免 stale summary last-writer-wins。

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

## 数据流设计纪律

- 每个 feature 必须先写 conceptual model，再决定是否需要 physical DB schema。
- 数据流必须写清 write owner、read owner、durable source、cache owner、mutation owner、invalidation 和 recovery。
- Workspace file、`.reo` metadata、rebuildable index、TanStack Query cache、component state 和 form state 不能存储同一事实的不同版本。
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

只有当改动改变 schema、表关系、auth tables、migrations、durable file contract、query key、cache ownership、Zustand ownership、form owner、client state owner 或当前能力索引时，才更新本文档。单个 mutation 的实现步骤、测试枚举和任务级异常组合留在 spec 或 archive。

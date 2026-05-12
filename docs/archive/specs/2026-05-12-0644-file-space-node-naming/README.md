# 文件空间节点命名与排序

开始时间：2026-05-12 06:44 America/Los_Angeles

关联长期任务：无。

## 目标

把 Workspace 文件空间根，以及 Memory、Segment 和 SegmentAttachment 内容节点的命名、更新时间、排序和外部文件系统修改收敛到同一个文件真源模型。当前任务先完善已实现的 audio Segment 与 audio SegmentAttachment，不扩展 note、photo、video 或 imported_file。

## PRD

### 问题

当前 Segment 卡片的标题来自硬编码录音标题，用户无法在 Reo 内重命名片段；Segment strip 仍按创建顺序展示，不能表达最近被补充的内容；Memory、Segment 和 SegmentAttachment 对“文件系统是真源”的表达不统一。用户在 Finder 直接重命名文件夹后，Reo 也应该像 Obsidian 一样从文件系统重新投影 UI，而不是保留独立的 Reo 内部命名状态。打开记忆空间、切换首页和记忆空间、窗口 focus 这类空操作不应触发全量文件树扫描、重读 Memory detail 或重解码音频。

### 用户故事

1. 作为用户，我希望新录音自动命名为 `录音1`、`录音2`，以便不用先命名也能留下可读文件。
2. 作为用户，我希望补充录音自动命名为 `补充录音1`、`补充录音2`，以便能区分同一片段下的补充内容。
3. 作为用户，我希望在片段卡片上通过 More 菜单重命名片段，以便让横向时间轴更容易回看。
4. 作为用户，我希望重命名片段时实际文件夹名也改变，以便 Finder、Codex CLI 和其他本地工具看到同一个名称。
5. 作为用户，我希望在 Finder 里重命名 Workspace、Memory、Segment 或 SegmentAttachment 后，Reo 下次刷新能显示新的名称。
6. 作为用户，我希望 Memory 列表和 Segment 卡片都按最近更新排序，以便最近发生变化的内容在最前。
7. 作为用户，我希望新增补充录音能让父 Segment 和父 Memory 排到更前，以便补充过的内容重新浮上来。
8. 作为用户，我希望文件系统内仍保留稳定 identity，以便重命名不破坏引用、恢复、转写和播放。

### 成功标准

- Workspace 是文件空间根，Memory、Segment 和 SegmentAttachment 共享同一内容节点规则：稳定 id 是身份，目录 basename 是用户可见名称真源，metadata 保存 id、title mirror 和时间投影。
- Reo 内重命名 Segment 通过窄 IPC 修改文件空间节点目录名，并同步 `segment.json`、父 Memory summary、Memory detail cache 和 selected Segment。
- Memory 下的 Segment 关系以合法 finalized Segment 文件空间节点为真源，`memory.json.segmentIds` 只是可重建 mirror；mirror 遗漏不能让可见 Segment 无法重命名或从 detail 投影中消失。
- Finder 外部重命名后的合法节点在按需 refresh 或 focused detail read 时重新投影 UI；Reo 不因目录名变化丢失节点。
- MemoryRail 与 Segment strip 都按投影 `updatedAt` 倒序展示；SegmentAttachment 新增会更新父 Segment 和父 Memory 的投影更新时间。
- 重命名只改变 title，不改变 activity `updatedAt`，不让 Memory 或 Segment 因改名改变排序位置。
- 打开记忆空间优先读取合法 `.reo/index.json` 作为启动 cache；index 缺失、损坏或 unsafe 时才在 open 路径 rebuild。renderer 在 ready 后立即静默调用一次 snapshot refresh 协调外部文件修改；registry list 不扫描所有记忆空间 root；打开已导入记忆空间只 resolve 当前点击的 entry。
- 可见性 refresh 结果完全相同时，不更新 session，不 invalidate Memory detail、Segment content 或 SegmentAttachment content Query；普通 focus 不触发 refresh。
- Reo 自己写入节点时尽力同步节点目录和祖先目录 mtime，让 Finder 和 Codex CLI 能看到修改时间。
- 行为代码使用真实 TDD：先写 RED，确认失败，再实现 GREEN，重跑保护测试。
- `docs/current/data.md`、`docs/current/flow.md`、`docs/current/frontend.md`、`docs/current/electron.md` 和 `docs/current/product.md` 同步当前真源。
- `npm run verify:quick` 通过。

### 非目标

- 不引入 DB、Drizzle、Zustand、file watcher 或后台索引服务。
- 不引入 file watcher 或后台索引服务；本次使用合法 index 启动 cache、ready 后静默 refresh、visibility refresh 和 focused detail read。
- 不扩展未实现的 Segment 类型。
- 不把 renderer 暴露为通用文件系统 API。

## 工程设计

### 抽象

统一内容节点抽象为 `FileSpaceNode`：

- `id`：稳定身份，写在 metadata 中，不随重命名变化。
- `directoryName`：文件系统目录 basename，是用户可见名称的真源。
- `metadata.title`：Reo 持锁写入的镜像，服务 metadata 读取和可检查 JSON。
- `contentUpdatedAt`：节点自身内容变化时间，不包含 title rename。
- `updatedAt`：用于排序的投影时间，等于节点自身内容与子孙节点内容更新时间的最大值。

物理文件路径保持浅层结构，节点目录名允许 `id`、`id--safe-title` 和安全的用户手动命名形态。读取时通过 metadata id 识别节点，不能把目录名当成唯一身份。Reo 写入和重命名使用 `id--safe-title`，便于 Finder 和 Codex CLI 直接阅读。

### 数据与文件

- Workspace root folder 是文件空间根；`.reo/workspace.json.title` 是 Workspace title 真源。root folder 被 Finder 重命名后，已导入列表用 stable `workspaceId` 重新定位并更新 registry projection。
- Memory directory basename 是 Memory title 真源；`memory.json.memoryId` 是身份。
- Segment directory basename 是 Segment title 真源；`segment.json.segmentId` 是身份。
- SegmentAttachment directory basename 是 SegmentAttachment title 真源；`attachment.json.attachmentId` 是身份。
- 目录扫描通过 metadata id 建立关系：Memory 下的 Segment 关系来自当前 Memory 目录内合法 finalized Segment 文件空间节点；`memory.json.segmentIds` 是可重建 mirror，不参与是否存在的最终判定；SegmentAttachment 仍在 parent Segment 的 `attachments/` 下。
- 外部合法 rename：目录 identity 和 metadata id 仍匹配时，Reo 接受 basename title，并在持锁 refresh/rebuild 时写回 metadata title mirror。
- 外部非法结构、symlink leaf、metadata id mismatch 仍按现有 unsafe / not-found 处理，不自动覆盖用户内容。

### 时间与排序

- Reo 写入节点名称时只更新目录 basename 和 metadata title mirror，不改变 activity 排序时间。
- Finalize Segment、finalize SegmentAttachment、保存 transcript 时写入对应内容更新时间，并用投影规则刷新祖先 summary。
- Segment `updatedAt` 取自身 metadata 时间、transcript mtime 和所有 Attachment 投影更新时间的最大值。
- Memory `updatedAt` 取自身 metadata 时间和所有 Segment 投影更新时间的最大值。
- Workspace snapshot 的 `memories[]` 按 Memory `updatedAt` 倒序。
- Memory detail 的 `segments[]` 按 Segment `updatedAt` 倒序。
- SegmentAttachment 列表按 Attachment `updatedAt` 倒序。
- Reo 自己写入时使用 Node `fs.utimes` 同步节点目录和祖先目录 mtime；失败不回滚已提交的 metadata/index，但返回前仍以 metadata 投影为准。

### 性能与刷新

- `workspace:listMemorySpaces` 只读 main-owned registry，不读取每个记忆空间 root，不扫描 Finder rename。
- `workspace:openMemorySpace` 只 resolve 当前点击的 `workspaceId`；stored root 缺失时才做同父目录 sibling scan。
- `workspace:open` 和 `workspace:openMemorySpace` 读取合法 `.reo/index.json` 作为启动 cache；只有 index 缺失、损坏或 unsafe 时才从文件真源 rebuild。
- `workspace:readWorkspaceSnapshot` 是显式文件真源刷新路径；renderer 在 ready 后静默调用一次，之后只在 document visibility 变为 visible 时调用，不在普通 window focus 时调用。
- Refresh response 与当前 snapshot 完全一致时，renderer 不 seed snapshot、不更新 session、不 invalidate Memory detail 和音频内容 Query。

### IPC 与前端

- 新增 `workspace:updateSegmentTitle`，request 只接受 `workspaceHandle`、`workspaceId`、`memoryId`、`segmentId`、`title`。
- Response 返回更新后的 Memory summary 和完整 Segment projection。
- Renderer 复用 `MemoryTitleDialog` 创建 `SegmentRenameDialog`。
- Segment card 的 More 按钮只在 hover、focus-within 或 menu open 时可见；按钮使用 Radix DropdownMenu trigger，不嵌套在 card selection button 内。
- Rename 提交后立即关闭 Dialog 并更新本地投影；后台保存成功后用 response 精准合并，失败时只在当前 title 仍是本次提交值时回滚，并保持 selected Segment id 不变。

### 官方依据

- Obsidian 官方数据存储文档确认 notes 存在本地 vault 文件夹中，可被其他编辑器和文件管理器管理；Obsidian 会刷新 vault 以跟上外部修改。
- Obsidian 官方数据存储文档也把 metadata cache 定义为服务速度的本地元数据记录，并提供 cache rebuild；因此 Reo 的 `.reo/index.json` 与 `memory.json.segmentIds` 只能是可重建投影或 mirror，启动时可以服务速度，但不能压过文件空间节点真源。
- Context7 Node.js 文档确认 `fsPromises.utimes(path, atime, mtime)` 可修改文件或目录 timestamp。
- Context7 Electron 文档确认 preload 应通过 `contextBridge` 暴露窄 API，不直接暴露 `ipcRenderer`、`fs`、Node API 或 generic invoke。
- Context7 Radix Dropdown Menu 文档确认 DropdownMenu Trigger / Item 是 Menu Button WAI-ARIA pattern，适合承载 card More 操作。

### 测试计划

- Main RED：外部重命名 Segment directory 后 `readMemoryDetailFromFileTruth` 仍按 metadata id 找到 Segment，并用目录 basename title 投影。
- Main RED：SegmentAttachment finalize 更新父 Segment `updatedAt`，Memory summary 和 Segment strip 排序按投影更新时间倒序。
- Main RED：`updateSegmentTitleFromFileTruth` rename directory、更新 `segment.json`，并返回刷新后的 Segment projection。
- Renderer RED：Segment card hover/focus More 菜单存在“重命名片段”，保存后调用 IPC 并更新卡片标题。
- Renderer RED：Segment strip 按 `updatedAt` 倒序，MemoryRail 继续按同一投影规则倒序。
- Renderer RED：focus-only 不触发 workspace snapshot refresh。
- Renderer RED：refresh 返回相同 snapshot 时不 invalidate Memory detail。
- Main RED：open 看到合法 `.reo/index.json` 时不得为比较而全量 rebuild；active renderer ready 后的 `workspace:readWorkspaceSnapshot` 才协调文件真源。
- Main RED：打开已导入记忆空间只 resolve 当前 entry，不先 list/协调全部 registry entry。
- Main RED：当合法 Segment 文件空间节点存在但 `memory.json.segmentIds` mirror 遗漏该 id 时，`updateSegmentTitleFromFileTruth` 仍能重命名该 Segment，并修复 mirror。
- Main RED：当合法 Segment 文件空间节点存在但 `memory.json.segmentIds` mirror 遗漏该 id 时，`readMemoryDetailFromFileTruth` 仍投影该 Segment。
- Main RED：recovery 从合法 Segment 文件空间节点修复 `memory.json.segmentIds` mirror。
- Main RED：带 finalize marker 的合法 Segment 文件空间节点即使不在 `memory.json.segmentIds` mirror 中，recovery 也必须保留该节点、清理 marker 并修复 mirror。
- Main RED：Workspace title update 遇到合法 `.reo/index.json` 时不得 rebuild memory file truth。

## 验证记录

- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "does not refresh the active workspace on focus-only events|skips child query invalidation when external JSON refresh returns the same snapshot|refreshes the open workspace snapshot from external JSON edits when the document becomes visible|ignores stale workspace refresh responses when visibility events overlap"` 通过：4 个目标测试覆盖 focus-only 不刷新、相同 snapshot 不重刷、visibility refresh 和 stale response。
- `npx tsc -p tsconfig.main.test.json && node --test --test-name-pattern "marker-bearing valid segment file-space node missing from segmentIds mirror" .tmp/test-main/test/main/memoryFiles.test.js` RED 失败：旧 recovery 删除了合法 marker-bearing Segment 文件空间节点。
- `npx tsc -p tsconfig.main.test.json && node --test --test-name-pattern "missing the valid file-space node|missing from the segmentIds mirror|repairs segmentIds mirror from valid segment file-space nodes|marker-bearing valid segment file-space node missing from segmentIds mirror" .tmp/test-main/test/main/memoryFiles.test.js` 通过：4 个目标测试覆盖 Segment file-space node truth 和 `segmentIds` mirror 修复。
- `npx tsc -p tsconfig.main.test.json && node --test --test-name-pattern "workspace title update uses a valid index without rebuilding memory file truth" .tmp/test-main/test/main/workspaceFiles.test.js` RED 失败：旧 Workspace title update 会 rebuild memory file truth。
- `npx tsc -p tsconfig.main.test.json && node --test --test-name-pattern "workspace title update uses a valid index without rebuilding memory file truth" .tmp/test-main/test/main/workspaceFiles.test.js` 通过：Workspace title update 在合法 index 存在时走 cache，不全量扫描 Memory 文件树。
- `npx tsc -p tsconfig.main.test.json` 通过。
- `npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx` 通过：3 个文件、77 个测试。
- `npm run test:main` 通过：335 个 main/preload 测试。
- `npm run verify:quick` 通过：typecheck、test:main 335、test:renderer 247、lint、format:check。

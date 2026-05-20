# 内容 Tab 操作与转录编辑 Spec

创建时间：2026-05-20 05:58 America/Los_Angeles

## 1. 任务复杂度判断

本任务是中等复杂度产品与工程切片。

原因：

- 它不是单纯文案调整。当前 `转录 / 正文` primary tab 复用 `SegmentActionsMenu`，会把片段级动作暴露在内容 tab 上，已经造成对象边界误导。
- 它不需要引入 DB、auth、Zustand、router、generic document runtime 或多版本 transcript 模型。
- 它会影响 React 组件、菜单复用边界、Markdown frontmatter、IPC schema、main process 文件写入、TanStack Query cache patch、冲突保护、AlertDialog 确认和 Vitest 行为测试。

输出粒度采用可直接进入实现的产品功能 spec + 工程实现说明 + 代码任务拆解。

## 2. 推荐实现路径

推荐路径：在现有 `Segment / SegmentSupplement / segment.md / supplement.md` 模型内做增量修正，不创建独立 Document 实体。

最短正确实现：

1. 保持 Segment 和 SegmentSupplement 是材料对象。
2. 把 selected Segment 的 primary content tab 视为 slot 型内容面：audio Segment 默认 `转录`，note Segment 默认 `正文`。
3. 给 primary content tab 增加独立显示名，默认不写入，用户重命名后写入 `segment.md` frontmatter 的 `content_title`。
4. primary content tab More 不再复用完整 `SegmentActionsMenu`，改为 slot 操作菜单。
5. audio Segment card More 继续承载 `生成转录 / 重新生成转录`，因为这是用 audio source 生成 transcript 的材料对象动作。
6. audio SegmentSupplement tab 继续承载 `生成转录 / 重新生成转录`，因为它本身是 audio-bearing supplement object。
7. `重新生成转录` 只覆盖 transcript body，不覆盖 `content_title` 或 supplement title。
8. slot 型内容不用 `删除`，使用 `清空转录 / 清空正文`；实体型内容仍使用 `删除`。
9. 转录编辑必须有 baseline digest 冲突保护，不能把外部修改或后台 ASR 结果静默覆盖。

需要复用的仓库能力：

- `EntityActionMenu` 的 open / reveal / copy 行为和 toast 模式。
- `WorkspaceDangerConfirmDialog` 的危险确认结构。
- `NoteEditorOverlay` 的 baseline、dirty、冲突处理和沉浸式编辑模式作为实现参考。
- `saveRecordingMarkdown`、`saveSegmentSupplementMarkdown`、`transcriptDigest`、`replaceSegmentTranscript` 和现有 rollback/index refresh 事务。
- TanStack Query 的 exact key patch / invalidate 模式。
- Radix DropdownMenu / AlertDialog 的受控打开、关闭和 focus 恢复。

不推荐路径：

- 不新增 `transcript.md`、`body.md` 或通用 `documents/` 目录。原因：打破当前 `segment.md / supplement.md` 文件合同，扩大迁移面。
- 不把 `重新生成转录` 放回 `转录` tab More。原因：文档 tab 入口会误导用户以为在操作 Markdown 文档本身，而实际执行 ASR 覆盖。
- 不把重新生成结果写成新的 tab。原因：会把唯一 transcript slot 变成多版本文档集合，打破 Segment / Supplement 层级。
- 不让重新生成覆盖标题。原因：title 是用户对内容面的命名，ASR 只更新 transcript body。
- 不用临时 component state 存储 content tab title。原因：标题是用户语义，必须随文件真源恢复。

## 3. 本次需求目标

### 3.1 用户目标

用户在 Memory Studio 中能清楚区分“操作片段或补充录音”与“操作正文或转录这个内容面”，并能编辑、重命名、清空转录/正文，同时不会因为重新生成转录丢失自定义标题。

### 3.2 产品体验目标

- 入口语义符合用户心智：卡片 More 是材料对象操作，primary tab More 是内容 slot 操作，补充录音 tab More 是补充录音对象操作。
- 危险动作有明确确认。
- 用户修改过标题后，后台生成或重新生成不重置标题。
- 用户编辑过转录后，重新生成必须明确告知会覆盖正文。

### 3.3 功能目标

- `转录 / 正文` primary tab More 改为 slot 操作菜单。
- `转录 / 正文` 支持重命名 tab 显示名。
- `转录` 支持编辑正文。
- `转录 / 正文` 支持清空正文。
- audio Segment card More 保留 `生成转录 / 重新生成转录`。
- audio SegmentSupplement tab More 保留 `生成转录 / 重新生成转录`。
- `重新生成转录` 保留现有 digest guard，且不改标题。

### 3.4 当前版本范围

当前版本只处理 Memory Studio 内 selected Segment 的 primary content tab 和 finalized audio Segment / SegmentSupplement transcript。

包含：

- audio Segment primary `转录` slot。
- note Segment primary `正文` slot。
- audio SegmentSupplement 的重新生成转录行为。
- note SegmentSupplement 保持实体 tab 行为，不增加重新生成转录。
- 转录编辑与清空。
- primary content title frontmatter 持久化。

### 3.5 当前版本不包含

- 多份转录、多版本转录、转录历史、diff、恢复旧版本。
- 独立 Document 实体、document registry、document query key、document runtime。
- 新 DB schema、Drizzle migration、Better Auth、Zustand store。
- HTML 渲染、widget runtime、Gallery。
- 对 SegmentSupplement 内 transcript 增加独立 tab；audio supplement 仍是在自己的 supplement tab panel 下显示转录。

## 4. 输入信息理解

### 4.1 已确认信息

- 用户确认：primary `正文 / 转录` tab 是文档/slot 操作，不应该出现 `重新生成转录`。
- 用户纠正：tab rail 中的 `补充录音` 是 audio-bearing supplement，仍需要 `重新生成转录`。
- 用户确认：Segment card 上点击 `重新生成转录` 仍覆盖该 Segment 的唯一 transcript slot，不生成新 tab。
- 用户确认：重新生成只覆盖转录正文，不覆盖用户给转录改过的标题。
- 用户确认：slot 型内容不应使用 `删除`，应使用 `清空转录 / 清空正文`。

### 4.2 仓库约束

- Reo 当前用户语义真源是 `memory.md`、`segment.md`、`supplement.md` 的 Markdown/frontmatter。
- `.reo/objects/*/*.json` 是技术完整性和 presentation state 层，不应承载用户语义标题。
- 当前 `SegmentActionsMenu` 和 `SegmentSupplementActionsMenu` 都复用 `EntityActionMenu`。
- 当前 `PrimaryContentTab` 的 More 复用 `SegmentActionsMenu`，这是需要修正的核心问题。
- 当前 note body 编辑已有 `NoteEditorOverlay`、`baselineContentHash`、冲突确认和 cache patch 模式。
- 当前 audio transcript content read response 只有 `transcript.exists/text`，没有 baseline hash。
- 当前 regenerate backfill 已使用 `transcriptDigest` 防止异步覆盖期间用户或 agent 修改转录。
- 当前 `lastTranscriptionAttempt === 'success'` 且 transcript 为空会投影为 `empty-cleared`。

### 4.3 AI 推导输入

- `content_title` 应写入 `segment.md` frontmatter，因为它是用户可编辑语义，不属于 `.reo` manifest。
- 转录编辑应复用 transcript digest 概念，暴露为 renderer 可使用的 baseline hash。
- primary tab slot 清空应使用危险确认，但不应移动 Segment 或 Supplement 到 trash。
- primary content title 更新不应改变 Segment activity 排序。

### 4.4 信息优先级处理

最新用户确认覆盖早期“tab rail 全部文档级”的旧判断。最终模型是：tab rail 的 More 操作当前 tab 对应对象；primary tab 是 slot，supplement tab 是 supplement object。

### 4.5 假设

- `content_title` frontmatter 字段命名可接受；如果研发更倾向 `primary_content_title`，必须保持只服务 selected Segment primary slot，不泛化为 document runtime。
- 转录编辑使用与 Note 编辑相同的沉浸式 overlay 体验，但可以先新增 `TranscriptEditorOverlay`，不强行把 Note overlay 抽成通用编辑器。

### 4.6 待确认项

无阻断实现的产品待确认项。字段名 `content_title` 可在实现前由研发做最后命名确认。

## 5. 功能类型判断

涉及功能类型：

- UI 行为修正：tab More 菜单语义调整。
- 内容编辑：transcript body 编辑。
- 文件语义扩展：`segment.md` frontmatter 增加 optional primary content title。
- 异步任务保护：regenerate 与手动编辑之间的 digest guard。
- 危险操作：清空正文、清空转录、重新生成转录覆盖正文。
- Cache 同步：Memory detail、Segment content、SegmentSupplement content、Workspace snapshot summary patch / invalidate。

不涉及：

- 数据库、auth、updater、packaging、remote telemetry。

## 6. 用户角色与使用场景

目标用户：在 Reo Memory Studio 中管理录音、笔记和补充内容的用户。

入口：

- 横向 Segment card More。
- primary content tab `转录 / 正文` More。
- audio SegmentSupplement tab More。
- 转录内容区域编辑入口。

前置条件：

- 已打开 Workspace。
- 已选中 Memory。
- 已选中 finalized Segment。
- 对转录生成 / 重新生成，语音设置需要满足现有 voice gate。

成功结果：

- 用户能从正确入口完成对应对象的操作。
- primary tab title 可被用户改名并持久化。
- 转录正文可编辑、保存、清空和重新生成。
- 重新生成不会重置 title。

失败结果：

- 保存失败时保留旧文件或显示 `file-written-index-stale` 语义。
- baseline 不匹配时不覆盖磁盘内容，提示用户解决冲突。
- voice settings 不可用时生成/重新生成入口沿用现有 disabled tooltip。

权限限制：

- 当前没有 auth 权限层。
- Renderer 不直接访问 Node/Electron API；所有文件写入通过 preload IPC 到 main process。
- IPC 必须校验 `workspaceHandle`、`workspaceId`、entity ownership、lock usability 和 schema。

## 7. 页面与流程说明

### 7.1 Segment card More

audio Segment：

- 用默认应用打开
- 在访达中显示
- 复制相对路径
- 复制绝对路径
- 生成转录 / 重新生成转录
- 重命名
- 删除

note Segment：

- 用默认应用打开
- 在访达中显示
- 复制相对路径
- 复制绝对路径
- 重命名
- 删除

### 7.2 Primary content tab More

audio Segment 的 primary tab：

- 用默认应用打开
- 在访达中显示
- 复制相对路径
- 复制绝对路径
- 编辑转录
- 重命名
- 清空转录

note Segment 的 primary tab：

- 用默认应用打开
- 在访达中显示
- 复制相对路径
- 复制绝对路径
- 编辑正文
- 重命名
- 清空正文

规则：这里不显示 `生成转录 / 重新生成转录`，不显示 `删除`。

### 7.3 SegmentSupplement tab More

audio supplement：

- 用默认应用打开
- 在访达中显示
- 复制相对路径
- 复制绝对路径
- 生成转录 / 重新生成转录
- 重命名
- 删除

note supplement：

- 用默认应用打开
- 在访达中显示
- 复制相对路径
- 复制绝对路径
- 重命名
- 删除

规则：supplement tab 是实体 tab，`删除` 仍表示删除补充内容并进入恢复区。

## 8. 页面状态说明

### 8.1 默认显示

进入条件：selected Segment 有合法 Memory detail projection。

页面表现：

- Primary tab title 使用 `segment.contentTitle ?? defaultTitle`。
- audio defaultTitle 是 `转录`。
- note defaultTitle 是 `正文`。

验收标准：

- 未重命名时 UI 与当前视觉保持一致。
- 重命名后切换 Segment、切换 Memory、刷新 snapshot 后仍显示自定义 title。

### 8.2 编辑转录

进入条件：用户从转录 surface 或 primary tab More 点击 `编辑转录`。

页面表现：

- 打开沉浸式编辑 overlay。
- 初始正文来自 selected Segment content Query 的 transcript text。
- 保存按钮在 pending 时禁用。
- dirty 时返回/关闭需要确认放弃。

数据变化：

- 保存调用 main process transcript save path。
- 保存成功后 patch exact Segment content Query 的 transcript text、exists 和 baseline hash。
- patch Memory detail 中目标 Segment 的 `transcript.exists` 和 `lastTranscriptionAttempt`。

异常处理：

- baseline hash 不匹配时保持编辑器打开，保留用户当前输入，显示冲突错误。
- 用户确认后可重新打开内容或再次保存；当前版本不引入磁盘版本/本地版本二选一冲突弹窗。

验收标准：

- 外部修改发生后，旧编辑器保存不得覆盖磁盘内容。

### 8.3 清空转录

进入条件：primary audio `转录` tab More 点击 `清空转录`。

页面表现：

- 使用 `WorkspaceDangerConfirmDialog`。
- 文案：`清空当前转录正文？录音和转录名称不会被删除。`

数据变化：

- transcript body 写为空字符串。
- `lastTranscriptionAttempt` 标记为 `success`，使空态投影为 `empty-cleared`。
- `content_title` 保留。

验收标准：

- 清空后 tab title 保持用户自定义值。
- Segment card 仍存在。
- 转录 panel 显示清空后的空态。

### 8.4 重新生成转录

进入条件：

- audio Segment card More 点击 `重新生成转录`。
- audio SegmentSupplement tab More 点击 `重新生成转录`。

页面表现：

- 使用现有重新生成确认弹层。
- 文案必须明确：`将替换当前转录正文，不会更改转录名称。`

数据变化：

- 读取当前 transcript digest。
- ASR 成功后覆盖 transcript body。
- 不修改 `content_title`。
- 不修改 Segment title 或 supplement title。

异常处理：

- ASR 期间 transcript 被用户或 agent 修改，返回 `ERR_BACKFILL_TRANSCRIPT_CHANGED`，不覆盖。

验收标准：

- 用户把 `转录` 改成 `访谈整理稿` 后重新生成，tab 仍显示 `访谈整理稿`。

### 8.5 清空正文

进入条件：primary note `正文` tab More 点击 `清空正文`。

页面表现：

- 使用 `WorkspaceDangerConfirmDialog`。
- 文案：`清空当前正文？片段和正文名称不会被删除。`

数据变化：

- 调用现有 `workspace:writeSegmentContent`，`bodyMarkdown: ''`，带当前 `baselineContentHash`。
- 更新 exact Segment content Query 和 Memory detail bodyByteLength。
- `content_title` 保留。

验收标准：

- 清空正文不删除 note Segment。
- card 仍显示 Segment title。

## 9. 组件与元素说明

### 9.1 SegmentContentActionsMenu

新增 feature-local 菜单组件，放在 `src/renderer/src/workspace/`。

职责：

- 只服务 selected Segment primary content slot。
- 复用 open/reveal/copy action binding。
- 根据 slot type 显示 `编辑转录 / 编辑正文`、`清空转录 / 清空正文`。
- 不接收 transcriptionAction。
- 不接收 Segment delete callback。

不放入 `components/ui`，因为它是 Memory Studio 业务菜单。

### 9.2 Content title rename dialog

新增或复用标题 Dialog 模式。

字段：

- label：`转录名称` 或 `正文名称`
- 默认值：当前 content title
- 保存后关闭并 optimistic patch。

校验：

- trimmed title 非空。
- 使用现有 workspace title 安全限制。

### 9.3 TranscriptEditorOverlay

新增 feature-local overlay，参考 `NoteEditorOverlay`。

职责：

- 编辑 finalized audio Segment transcript。
- 编辑 finalized audio SegmentSupplement transcript。
- 处理 dirty close、pending、baseline conflict、保存失败。

不建议第一版强行抽象 `MarkdownEditorOverlay`，避免把 note attachment、note draft、transcript save 混进一个过宽组件。

### 9.4 WorkspaceDangerConfirmDialog

复用现有危险确认：

- `清空转录`
- `清空正文`
- `重新生成转录`

Radix 要求：

- AlertDialog 必须有 title 和 description。
- destructive action 不依赖自动关闭；由业务 flow 决定何时关闭。
- 菜单项打开确认弹层时必须处理 DropdownMenu close 与 focus 恢复。

## 10. 交互规则

- 相同对象的 More 菜单只展示与该对象层级一致的动作。
- slot 型内容使用 `清空`，实体型内容使用 `删除`。
- `重新生成转录` 属于 audio-bearing object，不属于 Markdown slot 菜单。
- 清空、重新生成都需要确认。
- 保存期间禁用保存、返回和关闭。
- 旧 workspace handle 的 in-flight response 不得改写新 session。
- 同 target running backfill 继续复用现有 running Map，不重复发起。
- 用户 dirty 编辑期间 visibility refresh 不覆盖本地正文，只显示磁盘变化提示或冲突确认。

## 11. 状态机

### 11.1 Primary content title rename

| 当前状态 | 触发                     | 系统行为                          | 成功    | 失败        |
| -------- | ------------------------ | --------------------------------- | ------- | ----------- |
| idle     | 点击 `重命名`            | 打开 Dialog                       | editing | idle        |
| editing  | 保存                     | optimistic patch tab title        | saving  | 保持 Dialog |
| saving   | IPC success              | patch Memory detail               | idle    | -           |
| saving   | 普通失败                 | 若当前 title 仍是本次提交值则回滚 | idle    | toast       |
| saving   | file-written-index-stale | 保持 optimistic title             | idle    | root toast  |

### 11.2 Transcript edit

| 当前状态      | 触发              | 系统行为                                   | 成功          | 失败   |
| ------------- | ----------------- | ------------------------------------------ | ------------- | ------ |
| idle          | 编辑转录          | 读取 content Query                         | editing-clean | 错误态 |
| editing-clean | 输入              | 标记 dirty                                 | editing-dirty | -      |
| editing-dirty | 保存              | 发送 markdown + baseline digest            | saving        | -      |
| saving        | success           | patch exact content query 和 Memory detail | idle          | -      |
| saving        | baseline mismatch | 保留输入并显示冲突错误                     | editing-dirty | 不覆盖 |

### 11.3 Regenerate

| 当前状态          | 触发            | 系统行为                                    | 成功              | 失败       |
| ----------------- | --------------- | ------------------------------------------- | ----------------- | ---------- |
| ready             | 确认重新生成    | 读取 transcript digest，进入 backfill queue | running-overwrite | toast      |
| running-overwrite | ASR success     | digest 匹配则覆盖正文                       | success           | -          |
| running-overwrite | digest mismatch | 不覆盖正文                                  | ready             | root toast |

## 12. 数据规则

### 12.1 Segment projection

新增字段：

- `contentTitle?: string`

来源：

- `segment.md` frontmatter `content_title`。

默认：

- audio Segment：`转录`
- note Segment：`正文`

存储：

- 只写 `segment.md` frontmatter。
- 不写 `.reo/objects/segments/*.json`。
- 不写 `.reo/index.json`，但 Memory detail projection 读取时投影。

### 12.2 Audio Segment content response

新增字段：

- `transcript.baselineHash: string`

来源：

- `transcriptDigest(transcript.text)`。

用途：

- 转录编辑保存。
- 清空转录。
- 与 regenerate 的 overwrite guard 保持一致。

### 12.3 Audio SegmentSupplement content response

同样在 `transcript` 内新增 `baselineHash`。

### 12.4 Save transcript request

扩展：

- `baselineTranscriptHash?: string`

规则：

- recording finalize 后保存 transcript 可以不传 baseline。
- 用户编辑、清空必须传 baseline。
- main process 收到 baseline 后，在同一持锁写入段内重读当前 transcript 并比对 digest；不匹配返回 stale error，不覆盖。

### 12.5 Content title update request

新增 IPC：

- `workspace:updateSegmentContentTitle`

Request：

- `workspaceHandle`
- `workspaceId`
- `memoryId`
- `segmentId`
- `title`

Response：

- `memory`
- `segment`
- `saved: true`

规则：

- 只更新 `segment.md` frontmatter `content_title`。
- 不改变 Segment directory basename。
- 不改变 Segment title。
- 不改变 Memory activity 排序。

## 13. 权限规则

当前无 auth。

必须执行：

- trusted sender 校验。
- workspace handle 校验。
- `workspaceId` 与 active handle 匹配。
- lock usability 校验。
- memory / segment / supplement ownership 校验。
- no-follow file read/write 与 directory identity 校验沿用现有文件事务规则。

## 14. 工程实现说明

### React

- `MemoryStudio.tsx` 将 primary content tab 的 `renderMoreMenu` 从 `SegmentActionsMenu` 替换为 `SegmentContentActionsMenu`。
- `SegmentSupplementTab` 继续使用 `SegmentSupplementActionsMenu`。
- 新增 `TranscriptEditorOverlay`，由 `App.tsx` 或 `MemoryStudio` owner 持有 target state；应参考当前 Note editor 的 ownership，避免在 tab item 内持有保存流程。

### TypeScript

新增类型：

- `SegmentContentActionIdentity`
- `SegmentPrimaryContentKind = 'transcript' | 'body'`
- `TranscriptEditorTarget`
- `WorkspaceUpdateSegmentContentTitleRequest/Response`
- transcript `baselineHash`

### Zustand

不引入。

### TanStack Query

- Segment content Query 成功读取后包含 transcript baseline。
- 保存 transcript 成功后 `setQueryData` patch exact Segment content key。
- 保存 supplement transcript 成功后 patch exact SegmentSupplement content key。
- content title 更新成功后 patch Memory detail exact key。
- 必要时 invalidate exact content key，不做 broad invalidation。
- mutation settle 时检查 workspace handle/session identity，旧结果不得写入当前 session。

### React Hook Form / Zod

- content title Dialog 可复用现有 title form 模式。
- IPC request schema 用 Zod 校验 trimmed title 和 baseline hash。

### shadcn/ui / Radix

- DropdownMenu 保持现有密度和 icon+text。
- AlertDialog 用 `WorkspaceDangerConfirmDialog`。
- 菜单关闭后焦点回到 tab 或 More trigger，沿用 `onCloseAutoFocus` 模式。

### Tailwind CSS v4

- 不新增 token。
- 新菜单视觉沿用 `EntityActionMenu`。
- 编辑 overlay 沿用 `ImmersiveWorkspaceSurface`、Button、Textarea。

### Better Auth / Drizzle / SQLite / Updater

不涉及，不新增依赖、不新增 schema、不新增 migration。

### Electron / IPC

- 新增 channel 需要同步 `workspace-channels.ts`、`workspace-contract.ts`、`reo-workspace-bridge.ts`、preload bridge、main IPC register、renderer `workspaceApi.ts`。
- Renderer 不暴露 raw path。
- 文件写入继续在 main process。

### 日志

- 不新增 Sentry。
- 现有 workspace IPC diagnostics 会覆盖 request completion。
- 不把 transcript 正文写入 diagnostic payload。

### Vitest

必须覆盖 renderer menu 行为、main IPC schema/write 行为、cache patch、baseline mismatch 和 stale handle。

## 15. 接口、本地数据库与同步

接口：

- 新增 `workspace:updateSegmentContentTitle`。
- 扩展 read finalized audio Segment/Supplement content response 的 transcript shape。
- 扩展 save transcript request 的 optional baseline hash。

本地数据库：

- 不涉及。

同步：

- 文件真源仍是 `segment.md` / `supplement.md`。
- `.reo/index.json` 只维持 summary，不承载 content title。
- content title 只随 Memory detail 读取投影。

失败回滚：

- transcript save 继续使用 existing rollback + index refresh after rollback。
- content title update 必须使用 atomic write；index refresh 失败时按现有 `file-written-index-stale` 语义处理。

## 16. 架构风险与重构建议

### 16.1 当前风险

- `EntityActionMenu` 同时承担实体菜单和转录菜单，继续叠加会让菜单语义更混乱。
- primary content tab 复用 `SegmentActionsMenu` 是当前用户心智冲突的根因。
- transcript editing 如果绕过 baseline guard，会制造静默覆盖风险。

### 16.2 推荐局部整理

- 保留 `EntityActionMenu` 作为基础菜单 renderer。
- 新增 `SegmentContentActionsMenu` 做 slot 菜单，不把 slot 行为塞回 `SegmentActionsMenu`。
- 新增 transcript editor，不急于把 Note editor 抽成通用 Markdown editor。

### 16.3 不需要的重构

- 不需要架构级重构。
- 不需要 document runtime。
- 不需要 DB。
- 不需要 Zustand。

## 17. 代码任务拆解

### Task 1：RED - 菜单语义测试

影响文件：

- `src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`
- `src/renderer/src/workspace/SegmentActionsMenu.test.tsx`
- 新增 `SegmentContentActionsMenu.test.tsx`

测试目标：

- primary `转录` tab More 不显示 `重新生成转录`、不显示 `删除`。
- primary `转录` tab More 显示 `编辑转录`、`重命名`、`清空转录`。
- primary `正文` tab More 显示 `编辑正文`、`清空正文`。
- audio supplement tab More 仍显示 `重新生成转录`。
- note supplement tab More 不显示 `重新生成转录`。

### Task 2：实现 SegmentContentActionsMenu

文件：

- 新增 `src/renderer/src/workspace/SegmentContentActionsMenu.tsx`
- 修改 `MemoryStudio.tsx`

要求：

- 复用 action bindings。
- 不传 transcriptionAction。
- 清空动作打开确认 target。
- 编辑动作打开 editor target。
- 重命名动作打开 content title dialog。

### Task 3：content_title 数据合同

文件：

- `src/main/workspaceMarkdownObjects.ts`
- `src/main/memoryFiles.ts`
- `src/workspace-contract/workspace-contract.ts`
- 相关 tests

要求：

- frontmatter schema 允许 optional `content_title`。
- Segment projection 增加 `contentTitle?: string`。
- Memory detail read 投影该字段。
- 默认 title 不写入文件。

### Task 4：content title update IPC

文件：

- `src/workspace-contract/workspace-channels.ts`
- `src/workspace-contract/workspace-contract.ts`
- `src/workspace-contract/reo-workspace-bridge.ts`
- `src/preload/index.ts`
- `src/main/workspaceIpc.ts`
- `src/main/memoryFiles.ts`
- `src/renderer/src/workspace/workspaceApi.ts`
- `src/renderer/src/App.tsx`

要求：

- 更新 `segment.md` frontmatter `content_title`。
- scoped optimistic update。
- 旧 handle response 不串写。
- 失败 rollback 只在当前 title 仍等于提交值时发生。

### Task 5：转录 baseline hash

文件：

- `src/workspace-contract/workspace-contract.ts`
- `src/main/recordingDrafts.ts`
- `src/main/workspaceIpc.ts`
- `src/renderer/src/workspace/workspaceApi.ts`

要求：

- audio Segment/Supplement content read 返回 `transcript.baselineHash`。
- save transcript request 支持 optional `baselineTranscriptHash`。
- 用户编辑/清空必须传 baseline。
- baseline mismatch 返回可识别 stale error，不覆盖正文。

### Task 6：TranscriptEditorOverlay

文件：

- 新增 `src/renderer/src/workspace/TranscriptEditorOverlay.tsx`
- 新增 `TranscriptEditorOverlay.test.tsx`
- 修改 `App.tsx` / `MemoryStudio.tsx`

要求：

- 支持 Segment transcript 和 SegmentSupplement transcript。
- dirty close 确认。
- 保存 pending 禁用。
- conflict 处理参考 Note editor。
- 保存成功 patch exact content Query 和 Memory detail。

### Task 7：清空正文 / 清空转录

文件：

- `MemoryStudio.tsx`
- `App.tsx`
- tests

要求：

- `清空正文` 调用现有 note content write。
- `清空转录` 调用 transcript save with empty markdown + baseline。
- 使用 `WorkspaceDangerConfirmDialog`。
- 清空不删除 entity，不改变 title。

### Task 8：重新生成确认文案与 title 保留测试

文件：

- `MemoryStudio.tsx`
- `App.test.tsx`
- `LoadedWorkspaceFrame.test.tsx`

要求：

- confirmation description 改为明确不更改转录名称。
- regenerate success 后保持 `contentTitle`。
- digest mismatch 不覆盖。

### Task 9：docs/current 同步

文件：

- `docs/current/data.md`
- `docs/current/flow.md`
- `docs/current/frontend.md`
- `docs/current/product.md`
- 必要时 `docs/current/architecture.md`

要求：

- 当前事实只写最终模型，不写历史纠偏叙述。

### Task 10：验证

必须运行：

```bash
npm run verify:quick
```

按 TDD 红线，每个行为改动先写失败测试并记录 RED 输出，再实现。

## 18. 异常与边界情况

- voice settings disabled / no API key / auth failure：生成和重新生成入口沿用现有 disabled tooltip。
- network validation failure：沿用当前可点击策略。
- transcript empty：`清空转录` 可以 disabled 或确认后幂等成功；推荐 disabled 并 tooltip `当前转录已经为空。`
- title empty：Dialog 校验阻止提交。
- external file edit：baseline mismatch，不覆盖。
- workspace switch：旧 response 不写当前 session。
- lock lost：main 返回 typed error，renderer toast。
- index refresh failure after write：按 `file-written-index-stale` 保持文件真源已写出的 UI 投影。
- user clears transcript while regenerate running：regenerate digest mismatch 后不得覆盖清空结果。
- user renames content title while regenerate running：regenerate success 不覆盖 title。

## 19. 测试与验收标准

### 正常路径

1. 打开 audio Segment。
2. 在 primary `转录` tab More 中看到 `编辑转录 / 重命名 / 清空转录`，看不到 `重新生成转录 / 删除`。
3. 从 Segment card More 看到 `重新生成转录`。
4. 把 `转录` 重命名为 `访谈整理稿`。
5. 从 Segment card More 重新生成转录。
6. 验证正文被替换，tab 仍显示 `访谈整理稿`。

### Supplement 路径

1. 打开 audio supplement tab More。
2. 验证仍显示 `重新生成转录`。
3. 打开 note supplement tab More。
4. 验证不显示 `重新生成转录`。

### 编辑路径

1. 打开转录编辑器。
2. 修改正文并保存。
3. 验证 transcript panel 更新，content Query 更新，Memory detail transcript exists 更新。

### 冲突路径

1. 打开转录编辑器。
2. 模拟外部修改 transcript。
3. 保存旧编辑器内容。
4. 验证显示冲突错误，编辑器保持打开，用户输入仍保留，且不覆盖磁盘内容。

### 清空路径

1. 清空转录。
2. 验证 Segment 仍存在。
3. 验证 title 保留。
4. 验证 transcript empty-cleared 空态。

### 旧结果串写

1. 发起 content title rename 或 transcript save。
2. 切换/重开 workspace session。
3. 旧 response resolve。
4. 验证不写新 session cache，不显示错误 toast。

## 20. 最终目标总结

本次任务需要交付 Memory Studio 内容 tab 操作与转录编辑能力，使用户能够在同一条内容 tab rail 中清楚区分材料对象操作和内容 slot 操作：横向 Segment card More 继续处理片段级动作，audio SegmentSupplement tab More 继续处理补充录音对象动作并保留生成/重新生成转录，selected Segment 的 primary `转录 / 正文` tab More 改为内容 slot 操作，支持编辑、重命名和清空，但不再显示重新生成转录或删除。产品体验上必须保证重新生成转录只覆盖转录正文，不覆盖用户自定义的转录名称；清空只清空正文或转录，不删除 Segment 或 Supplement；危险动作有明确确认，编辑保存有冲突保护。实现时必须遵守 Reo 当前本地文件真源模型，继续使用 `segment.md / supplement.md` 和 `.reo/objects/*` 的既有分工，不新增 Document runtime、DB schema、Zustand store 或临时文件合同。工程上优先复用现有 EntityActionMenu、WorkspaceDangerConfirmDialog、NoteEditorOverlay 的冲突处理模式、transcriptDigest、save transcript 事务和 TanStack Query exact key patch 模式；新增的 content title 写入 `segment.md` frontmatter，转录编辑和清空必须带 baseline digest，防止外部修改、后台 ASR 或旧 session response 覆盖用户内容。最终验收必须覆盖菜单语义、标题持久化、转录编辑、清空、重新生成覆盖正文但保留标题、audio supplement regenerate、note supplement 不显示 regenerate、baseline 冲突、防重复、防旧结果串写、文件真源恢复、docs/current 同步和 `npm run verify:quick`。

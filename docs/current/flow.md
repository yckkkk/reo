# 流程

本文档是行为时序、生命周期和恢复策略的当前真源。

## 当前事实

- 当前没有 auth/session lifecycle、auth request、DB migration、startup database lifecycle、package、make、publish、release 或 update lifecycle。
- 当前 preload/IPC consumer 覆盖记忆空间选择与打开、记忆空间文件事务、Memory 创建与维护、Segment 与 SegmentSupplement 读写、录音、转写、补转录、受限外部链接和实体 More 菜单 shell 动作。
- 新 preload/IPC flow 只能跟随真实 renderer-to-main 特权需求创建；没有真实 queue、stream、schema、migration、packaging 或 updater owner 前，不创建对应 lifecycle。
- 记忆空间 file write 使用 atomic temp file、file fsync、rename 或 no-replace hard link、parent directory fsync 边界；可替换 metadata 用 rename，不能覆盖用户文件的 stable path 用 no-replace hard link。
- Main process 的 workspace directory transaction primitives 位于 `src/main/workspaceDirectoryTransactions.ts`。通用 helper 只表达已验证目录内的基础文件操作；具体 transaction 的 rollback、staging、recovery 和用户可见错误语义仍由调用方负责。
- Directory rename、file-space node move、workspace root rename 和 stale lock cleanup 保留 feature-local transaction，因为它们需要绑定 source/target identity、lock usability、父目录 fsync、提交点和失败恢复语义。
- 当前 main process 有 finalized audio 自动补转录 background queue。Queue 串行执行，同 target 去重，manual task 可插入队首但不抢占 in-flight task；recording、workspace switch、lock lost 和 app quit 会取消未完成工作，已提交的成功结果不得被后续 cancel 改报为 canceled。
- 当前 Query flow 覆盖 memory space list、Workspace snapshot、Memory detail、selected Segment content、selected SegmentSupplement content 和 application-scoped voice settings。Mutation 必须按 owner patch 或 invalidate exact cache；optimistic update 必须有可见 rollback 或明确的 stale-file handling。
- 当前 App route flow 使用 renderer in-memory state。无 active memory space 时显示 Home shell；memory space ready 后显示 loaded workspace frame；离开当前记忆空间必须先释放 handle，再进入其它顶层页面。
- Loaded workspace frame 的状态 owner 分层：App 持有顶层 view、active workspace session、当前 Memory id、recording flow 和跨 route 阻塞；WorkspaceFrame 持有主内容轨道和 MemoryRail layout；Memory Studio 持有当前 Memory 内的 selected Segment、预览流、时间轴和内容 tab；RecordingOverlay 持有录音 machine、MediaRecorder、draft chunks、paused preview、replacement transaction 和 finalize owner。
- 录音流程在 App 中是单一 `recordingFlow`。流程打开后阻止会切换 workspace、Memory 或顶层 view 的动作；完成录音会先隐藏 visible surface，但 flow 必须保留到 durable finalize、必要转写保存和 recovery marker 收口完成。
- `lastTranscriptionAttempt` 的 durable write owner 只有 finalize 和 transcript save。Finalize 只写入初值；completion backfill 不直接写 manifest；transcript save 只有在 Markdown 写入、Memory index refresh 和目标 manifest ownership 复核完成后才写入 `'success'`。
- Structured diagnostic lifecycle 只在 main process 内运行，写入本地 `electron-log`。诊断只记录闭合 allowlist 字段，不记录 root path、file path、display path、title、token、handle、payload、transcript、正文、audio bytes、base64 或 secret。

## 技术方向

- 多步骤行为先建模，再实现。
- Command/event 名称必须具体、贴近 domain。
- 在没有真实 queue/stream 需求前，优先 request/response。
- 每个 lifecycle transition 都必须有 owner。
- failure、cancellation、retry、recovery 行为必须明确。

## 当前流程决策

- Directory selection flow：renderer 通过 preload 请求 OS dialog；main 校验 sender、main frame、trusted URL 和 session。成功只返回 `selectionToken` 和 `displayPath`，真实路径只保存在 main selection token store。
- Selection token lifecycle 是 issued、consumed、expired、sender-mismatch 和 not-found。成功消费和过期会删除 token；错误 sender 不删除 token；所有错误都不返回真实路径。
- Memory space initialize/open flow 必须在获取 single-writer lock 后写入或打开记忆空间。Initialize 在所选父目录下 no-replace 创建 title 同名 child root；open 可打开现有 Reo 记忆空间或把空目录原地初始化。打开现有记忆空间会静默补齐或升级 Reo managed `AGENTS.md` block、`skills/reo-edit/` 与 `skills/reo-doctor/`，保留用户自定义 `AGENTS.md` 内容。非空非 Reo、unsafe `.reo`、unsafe draft/root 目录或 invalid metadata 必须返回 typed error，不能留下半初始化状态。
- Workspace lock 必须绑定 root、`.reo` 和 lock directory identity。Lock leaf 与 owner file 使用 no-follow 创建或读取；可判定 stale 的 lock 可以替换，无法确认 owner 已失效时返回 locked error。
- Memory space registry flow 属于 main-owned app state。Initialize/open 成功后 upsert canonical root 和 snapshot；list 只读取 registry，不扫描每个 root；registry open 只 resolve 当前 `workspaceId`，stored root 缺失时才做有界 sibling scan。
- Memory space title update 同时支持 active workspace 和 inactive registry entry。Active path 在 single-writer lock 下移动真实 root folder basename 并写入 `.reo/workspace.json.title` mirror；root move 是提交点，成功后同一个 opaque handle 迁移到新 canonical root。
- Workspace snapshot refresh 在 ready 后、document visibility 变为 visible 和 main-owned workspace file truth event 到达时协调外部合法文件修改。Main process 对 active workspace root 运行 path-redacted watcher，显式不跟随 symlink，忽略 `.part` atomic temp、lock、cache 和 editor 临时文件，coalesce 文件变化并通过 preload 发送 safe event；watcher error 只留下脱敏 workspace/错误类别诊断，不暴露 path。Renderer 收到同一 workspace handle/session 的 event 后重新读取 Workspace snapshot；snapshot read 在合法 finalized note/audio Segment 与 SegmentSupplement 浅层扫描内，只对已存在的 `content.tiptap.json` 执行 passive reconcile，安全 sidecar-authored 变化会先写回 Markdown mirror，再返回 snapshot。Renderer 随后 invalidates 同 workspace 的 Memory detail、selected Segment content 和 selected SegmentSupplement content Query。合法 `.reo/index.json` 是启动 cache；只有 index 丢失、损坏或 unsafe 时才 rebuild。普通 title update 和单条内容保存不为 response 全量扫描 workspace。
- Memory create 是 request/response mutation，不做 optimistic update。成功后 renderer seed snapshot cache，并把新 Memory 设为当前 Memory context。
- Memory、Segment、SegmentSupplement 和 memory space rename 使用 optimistic UI。保存失败只有在当前 title 仍是本次提交值时才回滚；`file-written-index-stale` 表示文件真源已写出但投影未收口，renderer 保持 optimistic projection 并显示错误。
- Memory delete/restore 是真实 request/response mutation。Delete 把 Memory 文件空间节点移入 `.reo/trash/memories/`，refresh index 后返回 restore token；restore 只恢复同一 token 对应 Memory，不暴露路径。
- Segment delete 是 renderer optimistic projection + delayed request/response mutation。Toast grace period 内的恢复只做 local projection restore，不调用 main restore；grace 结束后才提交 `workspace:deleteSegment`。Pending replay 必须以 Segment identity 为准，不能用 summary aggregate 猜测实体是否存在。
- `workspace:restoreDeletedSegment` 是 main 侧恢复区能力，只在 parent Memory 仍存在时把 trash Segment 移回 active tree。它不是 Segment delete toast 的本地撤销路径。
- SegmentSupplement delete/restore 使用真实 main mutation，不使用 Segment delete 的 delayed grace-period 模型。成功 response 只更新 parent Segment projection、父 Memory summary 和 exact content Query。
- 实体 More 菜单 shell 动作是只读 OS 调用，不进入 lock-bound mutation 序列，不具备 transaction、rollback 或 grace-period 行为，也不写入 Query cache、session projection 或 registry projection。
- Note Segment 和 Note SegmentSupplement draft 在用户点击保存时创建，draft body write 接受 Markdown 和可选 Tiptap JSON，并写入同 draft 节点的 `content.tiptap.json`。Draft body write 必须把 metadata、Markdown 和 sidecar 作为同一提交单元处理；sidecar 校验或写入失败时回滚到本次写入前的三份文件状态。Finalize 前必须 reconcile draft Markdown 与 sidecar；sidecar JSON 改变且 Markdown 未变时先把 sidecar serialize 回 draft Markdown，再进入对应 finalized file-space node。Finalized inline text edit 使用 debounced autosave，保存请求仍使用 baseline hash 防止外部修改覆盖；stale 保存必须返回当前磁盘正文和新 hash。
- Segment 和 SegmentSupplement content tab order 属于 parent Segment 的 durable presentation state，写入 Segment manifest `contentTabOrder`，不改变 Segment 或 Memory activity 排序。
- Finalized transcript save 必须直接定位 matching finalized Segment 或 SegmentSupplement 文件空间节点，并同时保护 Markdown baseline 与 Tiptap JSON baseline。Baseline 不匹配时返回 stale typed error，不覆盖 Markdown、不刷新 index、不推进 manifest；保存事务后的 index refresh 不执行跨父级移动修复，manifest ownership 复核失败必须回滚 transcript 与 sidecar。
- Manual transcription backfill 使用 finalized audio 文件作为 source，按 `fill-missing` 或 `regenerate` mode 复核 eligibility。成功后复用 transcript save 路径；同 target queued 或 running 时返回 already-running error。
- Recording draft create、append、clone prefix、finalize、discard 和 draft audio read 都必须绑定当前 workspace handle、lock usability、draft identity 和 sequence。每个 draft 只允许一个 append 在途；metadata 写失败必须回滚 audio 到 append 前状态。
- Finalize 必须使用显式 `memoryId`、`segmentId`、duration 和当前 draft truth。Finalize 通过 staging、marker、no-replace expose、index refresh 和 cleanup 表达事务边界；pre-expose failure 保留 draft，post-expose cleanup failure 通过 dataRetention 表达后续 recovery。
- SegmentSupplement recording 使用独立 supplement draft 和 finalize IPC surface，不把 supplement 当作同级 Segment，也不写入顶层 Segment strip。
- Recovery 只处理带 marker、staging 或明确 supplement recovery work 的对象；没有 recovery marker 时不得为了修复投影全量读取 Segment manifest。无法证明可安全删除的用户 payload 必须 fail-open 保留。
- Metadata、index、transcript 和 note body atomic write 必须在已验证 parent directory 内提交。Replace write 覆盖已有 target 前保留同目录 backup；commit 后发现 parent identity 改变时必须删除本次暴露 target，replace write 还必须恢复旧 target。
- Open、snapshot refresh 和 index rebuild 都以文件空间节点真源为准。Scan 只纳入 schema、manifest ownership、file-space ownership 和 kind-specific payload 一致的 finalized audio/note Segment 与 SegmentSupplement。
- Snapshot refresh 执行 passive sidecar reconcile 和 direct Markdown candidate scan 后，必须把无法确定的 sidecar 冲突、invalid/unsupported Tiptap JSON、重复 id 和歧义候选写入 `.reo/review/needs-review.json` / `.reo/review/needs-review.md`；没有 unresolved item 时删除旧 report。Renderer 只收到 snapshot `review` 汇总计数，具体相对路径留在本地 report 和 `reo-doctor` 输出。
- 同一 `memoryId` 的 create、append、title update、Segment title update 和 Segment delete/restore 通过 main process memory write lock 串行保护。同一 workspace 的 full index replace 和 single memory index refresh 进入同一个 main process write queue。
- Paused draft playback 默认只使用 renderer 当前录音会话持有的有效 chunk 前缀；异常恢复只能通过 `workspace:readRecordingDraftAudio` 在 marker byte map 限制内重建回听检查前缀，不跨 MediaRecorder session 继续或替换。
- 豆包 live ASR 只在 main 侧运行。Renderer 只能通过 preload 方法 start/send/finish/close 和订阅安全 event；renderer 不得生成鉴权 header，不得保存或显示 X-Api-Key 明文。Live ASR 失败不回滚 durable audio finalize，必要时触发 completion backfill。
- 豆包 finalized audio 补转录只在 main 侧运行。Renderer 不接触 raw path、audio bytes、base64、ffmpeg binary path、火山 header 或 X-Api-Key。
- Voice settings save 只接受 trimmed X-Api-Key 草稿。Main 使用 `safeStorage` 保存后做 validation probe；key 已写入但 validation snapshot 写入失败时返回 `file-written-index-stale`，renderer invalidate exact query 并清空草稿。
- Permission policy 使用 one-shot microphone intent。Renderer 必须先 begin intent，再调用 `getUserMedia`；permission request handler 消费 sender-bound intent 并只允许 trusted main-frame audio request。Video、camera、geolocation、notifications、navigation/window-open 默认拒绝。

## 状态管理纪律

- 状态机必须先描述 domain lifecycle，再决定使用 component state、reducer、React Hook Form、TanStack Query 或 Zustand。
- 不得把同一状态同时放入 component state、cache、form draft 和 metadata。
- UI 状态、form 状态、main-backed async data、durable file state 和 derived state 必须分开定义 owner。
- 复杂状态优先用 feature-local reducer 表达转移；只有跨 component subtree 且有真实 owner 时才引入 Zustand。
- 每个 state transition 必须说明触发事件、允许来源、失败行为、用户可见状态和验证路径。
- State ownership 必须用矩阵表达；每个 state row 只能有一个 source-of-truth owner，重复投影必须写同步方向和冲突处理。

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

只有当改动改变 lifecycle、command flow、IPC ordering、transaction boundary、concurrency model、rollback/recovery behavior、background job owner 或当前能力索引时，才更新本文档。单个组件内的交互细节、测试枚举和任务级验证证据留在 spec 或 archive。

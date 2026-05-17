# Electron

Electron 是 Reo 的一等产品宿主，不是 thin shell。

## 当前事实

- Main process 位于 `src/main`。
- Renderer 位于 `src/renderer`。
- Preload 位于 `src/preload`。
- 当前 preload 只暴露 `window.reoWorkspace` 下的显式记忆空间、录音和录音转写方法；main-to-renderer 事件只允许通过受控 callback 暴露，不暴露 `ipcRenderer` 或 `IpcRendererEvent`。
- 当前 preload bundle 输出为 `out/preload/index.cjs`；sandbox preload source 不运行时引入 Zod-backed contract 或普通 Node package。
- 当前 IPC API 只有显式 workspace product channels，不存在 generic `invoke/send` bridge。
- 当前 main process 持有 memory space registry，真实 memory space root 只存放在 main-owned app state file 中，不进入 renderer、preload DTO、DOM、URL 或 Query key。
- 当前 main process 使用 `electron-log/main` 写入本地结构化诊断日志；日志目录由 `app.setAppLogsPath()` 交给 Electron 管理，当前文件为 Electron logs path 下的 `main.log`。
- 当前本地诊断覆盖 app diagnostics ready、app ready、bootstrap failed、renderer process gone、uncaught exception 和 workspace IPC request start/finish。Workspace IPC 诊断只记录 channel、status、duration 和脱敏字段，不记录 root path、file path、display path、title、token、handle、payload、transcript、正文或 secret。诊断字段默认不展开对象、数组或未知字符串；channel、status、errorName、errorCode、mode、processType、reason 和 dataRetention 只在闭合 allowlist 中保留。
- 当前没有 renderer error capture、preload logging bridge、IPC logging channel、generic diagnostic IPC 或远程 telemetry。
- 当前没有 packaging、updater、signing、notarization、ASAR 或 fuse config。
- 当前没有 Forge config、makers、publishers、buildIdentifier、app bundle id、release channel 或 publish target。
- 当前构建权威是 `electron-vite`，不是 Electron Forge。
- 当前 `npm run dev` 通过 `scripts/run-dev.mjs` 先加载 git-ignored `.env.local`，再启动 `electron-vite dev`。`.env.local` 只作为本机 shell 环境注入给 Electron dev process；loader 不注入 `VITE_*` key。
- 当前豆包流式语音识别凭证使用 Electron `safeStorage` 加密存放在 `userData/voice-transcription-settings.json`，由 main process `voiceSettingsStore` 持有。Renderer/preload 通过 application-scoped voice settings IPC 读取不含密文的 snapshot：`enabled`、`apiKeyConfigured`、`apiKeyLastFour`、`lastValidatedAt`、`lastValidationOk` 和 `lastValidationCode`。X-Api-Key 只在用户保存设置的 request 和 main process 解密后的运行时输入中出现；settings response、录音 IPC response、日志、错误信封和记忆空间内容文件不返回明文或密文。
- 当前 Agentation 只作为 development renderer toolbar 连接本机 `http://localhost:4747`；development CSP 的 `connect-src` 允许该 loopback endpoint 用于 MCP sync、annotation update 和 event stream。Agentation 不新增 preload、IPC、permission、protocol、navigation 或 product runtime surface。
- 当前生产加载模型是自定义 `reo-app://renderer/index.html`。
- 当前生产 CSP 包含 `media-src 'self' blob:`，只用于本地 audio playback Blob URL。
- `package.json` 的 Electron entry 指向 `./out/main/index.js`。
- `out/` 是 `electron-vite` build output，不进入 git。
- 当前主 BrowserWindow 使用 `titleBarStyle: 'hiddenInset'`；Reo renderer 负责 app shell 内容区域，macOS 红黄绿按钮保持原生控件，不在 renderer 中伪造。

## 当前安全基线

这些是不变量，不能为了快速实现功能而放松：

- `app.enableSandbox()`
- `sandbox: true`
- `contextIsolation: true`
- `nodeIntegration: false`
- `nodeIntegrationInWorker: false`
- `nodeIntegrationInSubFrames: false`
- `webSecurity: true`
- `allowRunningInsecureContent: false`
- `webviewTag: false`
- 导航默认拦截非可信 URL
- `setWindowOpenHandler` 默认 deny
- 权限请求默认拒绝；audio media 只能通过 one-shot microphone intent 临时授予
- Dev server 只允许 loopback
- Packaged app 忽略 `ELECTRON_RENDERER_URL`
- 生产 CSP 不允许 `unsafe-inline` 或 `unsafe-eval`
- 生产 CSP 只允许 `'self'` 和 `blob:` media source
- 自定义 protocol 必须保留 privileged scheme 注册时序、host allowlist、path containment、CSP 和 handler 注册时序

## 必须遵守

- 优先依据 Electron 官方 process model、security、context isolation、IPC、sandbox、protocol 文档。
- Renderer 永远按 Web app 写，不直接 import/use `electron`、`node:*`、`fs`、`path`、`child_process` 或需要 Node/OS 权限的 SDK。
- Preload 只服务明确设计的 renderer 特权能力。
- 当前 `window.reoWorkspace` 只能暴露已实现且有 contract、handler、preload、renderer type 和测试覆盖的产品方法。
- 当前没有 auth lifecycle、custom auth protocol 或 secure session persistence owner，因此不引入 Better Auth Electron bridge。
- 新增 preload 时，只能用 `contextBridge` 暴露窄 API。
- 禁止暴露 `ipcRenderer`、`electron`、`fs`、通用 `send(channel, ...args)` 或通用 command bus。
- IPC 必须是每个能力一个显式 channel/handler。
- 每个 IPC channel 必须有 owner、TypeScript contract、Zod 输入校验、`senderFrame` 校验、错误语义、取消或超时策略。
- 特权能力必须逐项授权、校验、记录，不允许 generic privileged proxy。
- 需要 Node/OS 权限的未来 runtime integration 必须进入 main process、utility process 或独立受控后端边界。
- 如果未来引入 custom session 或 partition，custom protocol 和 permission policy 必须注册到同一个 session。
- Better Auth Electron 只能在真实 auth 能力中引入，并且必须同批设计 custom protocol、trusted origin、preload bundle、IPC bridges、token/session exposure 和 renderer visibility。
- `electron-log` 当前只允许在 main process 本地日志中使用；renderer/preload bridge 只能在真实 renderer diagnostics 能力中引入。
- Sentry 只能在真实 crash/error reporting 能力中引入。
- Diagnostics 能力必须同批定义 process boundary、sensitive data rules、redaction、retention、DSN/release/privacy/source-map 计划和 renderer visibility。当前本地日志只保留 `main.log` 与一次 rotation 的 `main.old.log`，单文件大小上限为 1 MiB。

## IPC 设计纪律

- IPC 是产品能力协议，不是 renderer 调 main 的临时通道。
- 每个 IPC channel 必须先写清 capability、caller、owner、request DTO、response DTO、error envelope、timeout、cancellation、sender validation、permission effect 和 test owner。
- Cancellation 必须说明信号传递机制、main 端如何中止、renderer 端如何确认、部分写入如何回滚或保留；不可取消的 channel 必须说明用户可见时长上限、timeout 语义和恢复行为。
- 多个 channel 只有在共享真实协议不变量时才提取 helper；不得为了减少文件数创建 generic invoke、generic command 或 generic backend service。
- Channel 命名必须贴近 domain 行为，不能用技术层动作掩盖产品语义。
- IPC 设计必须说明数据如何进入 TanStack Query、component state、React Hook Form 或其他明确 owner。

## 当前 Electron 决策

- Renderer 特权能力必须通过窄 preload 暴露为 `window.reoWorkspace` 产品方法。
- Memory space IPC channels 覆盖 choose、list memory space entries、initialize、open、open memory space entry、remove memory space entry、memory space title update、close、Workspace snapshot read、Memory create、Memory detail read、finalized audio segment read、finalized audio SegmentSupplement read、memory title update、Segment title update、SegmentSupplement title update、Memory delete/restore、Segment delete/restore、SegmentSupplement delete/restore、recording draft create/read-unfinished-audio/clone-prefix/append/finalize/discard、SegmentSupplement recording draft create/append/finalize/discard、Segment transcript save、SegmentSupplement transcript save、microphone intent begin/clear、recording transcription start/send audio/finish/close、voice transcription settings read/setEnabled/save/clear/validate、受限外部链接打开，以及实体 More 菜单 shell 动作。
- `workspace:readVoiceTranscriptionSettings` request 不接受 payload；response 返回 `settings: { enabled, apiKeyConfigured, apiKeyLastFour, lastValidatedAt, lastValidationOk, lastValidationCode }`，不返回 X-Api-Key 明文或密文。
- `workspace:setVoiceTranscriptionEnabled` request 接受 `{ enabled }`；response 与 read 同。
- `workspace:saveVoiceTranscriptionApiKey` request 接受 `{ apiKey }`；main 先用 `safeStorage` 加密写入 `voiceSettingsStore`，再立即执行 voice transcription probe，response 携带最新 snapshot，不返回密钥、probe 原始错误或额外 validation 字段。若 key 文件已写入但 validation snapshot 写入失败，错误信封使用 `dataRetention: "file-written-index-stale"`；renderer 重新读取 settings snapshot，不重发或显示已保存密钥明文。
- `workspace:clearVoiceTranscriptionApiKey` request 不接受 payload；response 与 read 同；ciphertext、`apiKeyLastFour` 和 validation 字段一并清空。
- `workspace:validateVoiceTranscriptionCredentials` request 不接受 payload；main 解密当前 X-Api-Key 后执行 probe，response 返回 `{ code: 'ok' | 'auth' | 'network', message? }`，并同步更新 store 的 last validation 字段。
- `workspace:openVoiceTranscriptionProviderConsole` request 不接受 payload；main 固定打开 `https://console.volcengine.com/`，并在调用 `shell.openExternal` 前校验该 URL 使用 `https:`、无 username/password、无显式 port，且 hostname 属于 `volcengine.com`。
- 上述 6 个 settings 相关 channel 是 application-scoped channel，不接收 `workspaceHandle`，也不绑定单个记忆空间 session。
- 实体 More 菜单 shell 动作 IPC channels 覆盖 `workspace:revealMemorySpaceInFinder`、`workspace:revealMemoryInFinder`、`workspace:revealSegmentInFinder`、`workspace:revealSegmentSupplementInFinder`、`workspace:openMemorySpaceAgentsFile`、`workspace:openMemoryDocument`、`workspace:openSegmentDocument`、`workspace:openSegmentSupplementDocument`、`workspace:copyMemorySpaceAbsolutePath`、`workspace:copyMemoryAbsolutePath`、`workspace:copySegmentAbsolutePath`、`workspace:copySegmentSupplementAbsolutePath`、`workspace:copyMemoryRelativePath`、`workspace:copySegmentRelativePath` 和 `workspace:copySegmentSupplementRelativePath`。Response 是 `{ ok: true }` 或 typed error envelope，不返回 raw path 字符串。Memory Space channels 只接受 `workspaceId`，并校验 sender、registry root、root ownership `workspaceId` 和 root usability；其它 channels 接受 `workspaceHandle`、`workspaceId`、`memoryId`，并按实体层级追加 `segmentId` 或 `supplementId`，同时校验 sender、handle ownership、workspaceId 一致性和 lock usability。Main process 经 main-only `EntityPathResolver` 解析目录或语义文件路径，调用系统 API 前再次校验目标目录或语义文件 leaf 不是 symlink/非预期类型，然后调用 `shell.openPath`、`shell.showItemInFolder` 或 `clipboard.writeText`。`shell.openPath` 非空结果或 `shell.showItemInFolder` 抛错映射 `ERR_SHELL_OPEN_FAILED`；`clipboard.writeText` 失败映射 `ERR_CLIPBOARD_WRITE_FAILED`；`AGENTS.md` 缺失映射 `ERR_MEMORY_SPACE_AGENTS_FILE_MISSING`；`memory.md`、`segment.md` 或 `supplement.md` 缺失映射 `ERR_ENTITY_DOCUMENT_MISSING`；manifest 缺失映射 `ERR_WORKSPACE_MEMORY_NOT_FOUND`、`ERR_WORKSPACE_SEGMENT_NOT_FOUND` 或 `ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND`；unsafe path 映射 `ERR_WORKSPACE_UNSAFE_PATH`；root missing 映射 `ERR_WORKSPACE_ROOT_MISSING`；Memory Space registry root 与 `workspaceId` 不匹配映射 `ERR_WORKSPACE_METADATA_INVALID`。复制路径字符串只在 main process 出现；这些 channel 对 Reo 文件真源是只读 OS 调用，没有 `dataRetention` 半成功状态。
- `workspace:listMemorySpaces` request 不接受 payload；response 只返回 `workspaceId`、title、description、addedAt 和 lastOpenedAt，不返回 raw path。Registry 文件缺失、损坏、schema 不匹配或 symlink leaf 按空列表处理；不可读 IO 错误返回 `ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_READ_FAILED`。List 只读取 main-owned registry file，不扫描每个记忆空间 root，不读取 `.reo/workspace.json`，不做同父目录 rename scan。
- `workspace:initialize`、`workspace:open` 和 `workspace:openMemorySpace` 成功 response 返回 opaque `workspaceHandle`、`workspaceId` 和 Workspace snapshot。Workspace snapshot 只返回 `workspaceId`、title、description 和 `memories[]` summary 投影，不返回 root path、selection token、handle internals 或顶层 recording 投影。
- `workspace:readWorkspaceSnapshot` request 只接受 `workspaceHandle`；main process 校验 sender、handle ownership 和 lock usability 后，从当前 `.reo/workspace.json` 和记忆空间文件 read model 重新返回 Workspace snapshot。该 channel 用于 active session 同步外部合法文件修改，不返回 root path、selection token、handle internals、file path 或顶层 recording 投影。
- `workspace:openMemorySpace` request 只接受 `workspaceId`；main process 只 resolve 该 `workspaceId` 的 registry entry，复用记忆空间 open 的 target validation、single-writer lock、记忆空间文件 recovery、valid index read、必要 index rebuild 和 handle registration，并返回新的 opaque `workspaceHandle`。Stored root 不存在时才在原父目录下最多检查 200 个直接子目录寻找同一 `workspaceId`。Open 获取 lock 后必须在任何 recovery/index 写入前只读确认打开的 `workspaceId` 匹配请求，然后才把 folder basename 写回 `.reo/workspace.json.title` mirror 并更新 registry projection。Registry 中的 root folder 已被用户删除且同父目录下没有同一 `workspaceId` 记忆空间时返回 `ERR_WORKSPACE_ROOT_MISSING`，不暴露 raw path。
- `workspace:removeMemorySpace` request 只接受 `workspaceId`；main process 只从 memory space registry 移除该 entry，不解析 root path、不删除本地记忆空间文件夹，也不需要 selection token。Registry 写入失败返回 `ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_WRITE_FAILED`。
- `workspace:updateMemorySpaceTitle` request 接受二选一 payload：active 记忆空间使用 `workspaceHandle` 和安全 title，inactive registry entry 使用 `workspaceId` 和安全 title。Main process 在 single-writer lock 下同步改名真实 memory space root folder basename 和 `.reo/workspace.json.title` mirror；target sibling folder 已存在时返回 `ERR_WORKSPACE_ALREADY_EXISTS` 且保留既有 root、metadata、registry 和 `.reo/index.json`。Root move 和 metadata mirror 提交后才读取或重建 index 投影来返回 Workspace snapshot；root move 前不得为了 rename 错误响应协调 index。Active path root move 成功后迁移当前 handle 与 lock 的 canonical root，同一个 opaque handle 继续用于后续 snapshot read 和 close，且不因 registry projection 写入失败阻断保存。Inactive path 需要 registry 解析 root 并更新 title/description/root projection，但不改变 addedAt、lastOpenedAt 或列表顺序。Response 返回 Workspace snapshot，不返回 root path、selection token、handle internals 或文件路径。
- `workspace:createMemory` request 只接受 `workspaceHandle` 和 title；main 通过当前 handle 授权创建空 Memory 容器，生成稳定 `memoryId`，写入新建 Memory 目录的 `memory.md` 和 `.reo/objects/memories/<memoryId>.json`，刷新 `.reo/index.json`，不接受 renderer-provided `memoryId`、segment id、Segment 字段或 raw path。Response 只返回 Memory summary。
- `workspace:readMemoryDetail` request 接受 `workspaceHandle`、`workspaceId`、`memoryId` 和 requestId；main 校验 sender、handle ownership、workspaceId 与当前 handle workspace 匹配和 lock usability 后，按 `.reo/objects/memories/<memoryId>.json` 定位 Memory 目录，并从 `memory.md`、Memory manifest 及 finalized audio segment 文件读取当前 Memory detail projection。Response 返回同 requestId 和 detail，不返回 `workspaceHandle`、root path、selection token 或 raw path。
- `workspace:readFinalizedAudioSegment` request 接受 `workspaceHandle`、`workspaceId`、`memoryId`、`segmentId` 和 requestId；main 校验 sender、handle ownership、workspaceId 与当前 handle workspace 匹配和 lock usability 后，只读取该 Memory 下 matching finalized audio Segment 的 `audio.webm` 和 `segment.md` 正文。Response 返回同 requestId、identity、bounded audio bytes、audioByteLength 和 transcript text，不返回 `workspaceHandle`、root path、file path、selection token 或 raw path。
- `workspace:readFinalizedAudioSegmentSupplement` request 接受 `workspaceHandle`、`workspaceId`、`memoryId`、`segmentId`、`supplementId` 和 requestId；main 校验 sender、handle ownership、workspaceId 与当前 handle workspace 匹配和 lock usability 后，按 supplement manifest id 定位 parent Segment 下 matching finalized audio SegmentSupplement 文件空间节点，并读取其中的 `audio.webm` 和 `supplement.md` transcript section。Response 返回同 requestId、identity、bounded audio bytes、audioByteLength 和 transcript text，不返回 `workspaceHandle`、root path、file path、selection token 或 raw path。
- `workspace:updateMemoryTitle` request 只接受 `workspaceHandle`、`memoryId` 和 title；main 通过当前 handle 授权更新当前 Memory 目录 basename 和 `memory.md` frontmatter title，不接受 `segmentId`、Segment 字段或 raw path。Response 只返回 Memory summary。
- `workspace:updateSegmentTitle` request 只接受 `workspaceHandle`、`workspaceId`、`memoryId`、`segmentId` 和 title；main 通过当前 handle 授权更新当前 Segment 目录 basename 和 `segment.md` frontmatter title，并刷新父 Memory summary。Response 只返回 Memory summary 和 Segment projection，不返回 root path、file path、selection token 或 handle。
- `workspace:updateSegmentSupplementTitle` request 只接受 `workspaceHandle`、`workspaceId`、parent `memoryId`、parent `segmentId`、`supplementId` 和 title；main 先校验 trusted sender、session、handle owner、request `workspaceId` 与 handle workspace 一致和 lock usability，再通过 current Segment 下 matching SegmentSupplement 文件空间节点更新目录 basename 和 `supplement.md` frontmatter title，并刷新父 Memory summary。命名上匹配 `supplementId` 或 `<supplementId>--*` 的 unsafe candidate 必须返回 unsafe typed error，不得 fallback 到其它目录。Title rename 不改变 supplement `updatedAt`。Response 只返回 Memory summary、parent Segment projection 和 supplement projection，不返回 root path、file path、selection token 或 handle。若目录 basename 和 `supplement.md` 已写出但父 Memory index refresh 失败，错误信封必须带 `dataRetention: "file-written-index-stale"`，避免 renderer 把已写出的 supplement title 误回滚。
- `workspace:deleteSegment` request 只接受 `workspaceHandle`、`workspaceId`、parent `memoryId` 和 `segmentId`；main 通过当前 handle 授权把 matching finalized Segment 文件空间节点移入 `.reo/trash/segments/`，并刷新父 Memory summary。正向 move 和 rollback move 前必须把读取 file truth 时验证过的 Segment directory identity 传入最终 rename；rollback 使用本次已移动的 leaf name 和 directory identity，不按 Segment id 重新扫描 trash candidates；rollback 继续消费 handle lock usability，如果源目录在验证后被替换或 rollback 前 lock 已失效，不移动替换目录或 stale handle 文件。成功 delete 的 index refresh 必须来自同一次 active Segment file-truth scan。Renderer 的 Segment undo toast grace period 结束前不得调用该 channel。Response 只返回父 Memory summary、被删除的 `segmentId` 和 `restoreToken`，不返回 root path、trash path、file path、selection token 或 handle。若 delayed handle lock 在 Segment 已移入 trash 后失效，错误信封必须带 `dataRetention: "file-written-index-stale"`，避免 renderer 把已写出的文件真源误回滚成可见 active Segment。
- `workspace:restoreDeletedSegment` request 只接受 `workspaceHandle`、`workspaceId`、parent `memoryId` 和 `restoreToken`；main 通过当前 handle 授权把 trash 中 matching Segment 文件空间节点移回 parent Memory 的 `segments/`，并刷新父 Memory summary。Restore parent Memory 缺失直接由安全目录读取错误映射为 typed error，不做独立 exists probe。Restore 不做恢复前 active Segment candidate scan；同 id active duplicate 由 move 后的唯一一次 active Segment file-truth scan 检出，并用本次已移动的 leaf name 和 directory identity 精确回滚回 trash。正向 restore move 和 rollback move 同样使用已验证 trash Segment directory identity 作为 expected source identity，并在 rollback 中继续消费 handle lock usability；验证后目录替换不得进入 active tree 或 trash tree，lock 失效后不得继续搬文件。成功 restore 的 restored Segment projection 和 index refresh 必须来自同一次 active Segment file-truth scan。Response 只返回父 Memory summary 和恢复后的 Segment projection，不返回 root path、trash path、file path、selection token 或 handle。Parent Memory 缺失时返回 typed error，不创建 orphan Segment。
- `workspace:deleteSegmentSupplement` request 只接受 `workspaceHandle`、`workspaceId`、parent `memoryId`、parent `segmentId` 和 `supplementId`；main 校验 trusted sender、session、handle owner、request `workspaceId` 与 handle workspace 一致和 lock usability 后，把 parent Segment 下 matching finalized SegmentSupplement 文件空间节点移入 `.reo/trash/supplements/`，并刷新父 Memory summary。Response 只返回父 Memory summary、parent Segment projection、被删除的 `supplementId` 和 `restoreToken`，不返回 root path、trash path、file path、selection token 或 handle。若 supplement 已移入 trash 但父 Memory index refresh 或后续 projection 失败，错误信封带 `dataRetention: "file-written-index-stale"`。
- `workspace:restoreDeletedSegmentSupplement` request 只接受 `workspaceHandle`、`workspaceId`、parent `memoryId`、parent `segmentId` 和 `restoreToken`；main 通过当前 handle 授权把 trash 中 matching SegmentSupplement 文件空间节点移回 parent Segment 的 `supplements/`。Restore 要求 parent Memory 和 parent Segment 仍存在；parent missing 返回 `ERR_SEGMENT_SUPPLEMENT_RESTORE_PARENT_MISSING` 并保留 trash supplement。成功 response 只返回父 Memory summary、parent Segment projection 和恢复后的 supplement projection，不返回 root path、trash path、file path、selection token 或 handle。若 supplement 已移回 active tree 但父 Memory index refresh 或后续 projection 失败，错误信封带 `dataRetention: "file-written-index-stale"`。
- `workspace:saveTranscript` 只接受 finalized audio segment identity：`workspaceHandle`、`memoryId` 和 `segmentId`。成功 response 返回当前 Memory summary，并把 transcript 写入 `segment.md` 正文。`workspace:saveSegmentSupplementTranscript` 只接受 `workspaceHandle`、`workspaceId`、parent `memoryId`、parent `segmentId`、`supplementId` 和 markdown；main 通过 parent Segment 下 matching SegmentSupplement 文件空间节点写入 `supplement.md` 正文，刷新父 Memory summary，并返回父 Memory summary、parent Segment projection 和 supplement projection。两个保存 channel 都不返回 raw path、file path、selection token 或 handle。Segment draft create/append/finalize/discard 使用 draft `segmentId` transaction identity。
- `workspace:finalizeRecordingDraft` request 接受 `workspaceHandle`、`memoryId`、`segmentId`、title、duration 和可选 `lastTranscriptionAttemptOnFinalize`。`lastTranscriptionAttemptOnFinalize` 只接受 `'failed'` 或 `'never'`，renderer 不能在 finalize request 中声明 `'success'`。Main 通过当前 handle 授权把 draft finalize 到显式 Memory，并返回当前 Memory summary 和完整 finalized audio Segment projection。Response 不返回 `workspaceHandle`、root path、file path、selection token 或 raw path。
- SegmentSupplement 录音使用显式 supplement IPC surface：`workspace:createSegmentSupplementRecordingDraft` 接受 `workspaceHandle`、`workspaceId`、parent `memoryId` 和 parent `segmentId`，返回 `supplementId` 和 `nextSequence`；`workspace:appendSegmentSupplementRecordingAudioChunk` 接受 `workspaceHandle`、`supplementId`、sequence 和 audio chunk；`workspace:finalizeSegmentSupplementRecordingDraft` 接受 `workspaceHandle`、`workspaceId`、parent `memoryId`、parent `segmentId`、`supplementId`、title、duration 和可选 `lastTranscriptionAttemptOnFinalize`，返回当前 Memory summary、parent Segment projection 和 supplement projection；`workspace:discardSegmentSupplementRecordingDraft` 接受 `workspaceHandle` 和 `supplementId`。这些 channels 不接受 raw path，不把 supplement 当作同级 Segment，也不返回 `workspaceHandle`。SegmentSupplement finalize request 同样只允许 `'failed'` 或 `'never'` 作为 finalize 初始转写尝试状态。
- `chooseDirectory` 只返回 `selectionToken` 和 `displayPath` 或 canceled 结果，不返回裸 `rootPath`，也不提前返回 conflict 或 permission 判断。
- `displayPath` 只使用文件夹 basename，不等同真实绝对路径。
- Selection token 由 main process 保存真实路径，单次消费、短 TTL、绑定 sender identity；过期 token 会删除，错误 sender 不烧掉 token，错误结果不得泄露真实路径。
- Preload 运行时只导入无 Zod、无普通包依赖的 channel 常量；`ReoWorkspaceBridge` 使用 `src/workspace-contract/reo-workspace-bridge.ts` 的 type-only contract。DTO 校验和错误信封属于 main process contract。
- Renderer 后续读写 workspace 不传裸 `rootPath`；main process 在 choose/open 后 canonicalize 路径，并返回 opaque `workspaceHandle`。
- `workspaceHandle` 绑定 canonical realpath、memory space root identity、`.reo` directory identity、lock directory identity、`workspaceId`、owning sender、session/partition、lock ownership 和 app lifecycle；记忆空间 close、BrowserWindow closed、renderer process gone、trusted main-frame non-same-document navigation、trusted main-frame reload、`uncaughtException` teardown、lock lost、root identity changed 或 schema mismatch 时撤销。Same-document navigation、subframe navigation 和 untrusted navigation 不撤销 handle。Navigation 与 teardown release 通过 main process lifecycle helper 合并重入 close-all；teardown close-all 只能删除 release 成功的 handle，release 失败的 handle 保留但不可继续授权写入，用于后续 close-all 重试。每个 handler 在 delayed filesystem operation 前必须能重新断言 handle lock usability，不能只依赖最初的 `requireHandle` 返回值。
- Memory space initialize 把 selection token 指向的目录视为父目录，记忆空间 title 必须是安全文件夹名；main process 在父目录下用 no-replace `mkdir` 创建同名 child memory space root，child 已存在返回 `ERR_WORKSPACE_ALREADY_EXISTS`，然后只在新 child root 内获取 lock 和写入 Reo 文件。新建 `AGENTS.md` 使用 no-replace atomic write，不允许覆盖用户文件。`.reo`、`.reo/drafts`、`.reo/drafts/segments` 或 `memories/` 为 symlink 或非目录时返回 unsafe path，不得跟随到 记忆空间外；lock 必须绑定当前 `.reo` directory identity，`.reo/workspace.lock` leaf 用 no-follow 打开，`.reo/workspace.lock.lock` 只在同一目录内创建并绑定 identity，owner file 在该目录内 no-follow 创建，写入 main process pid 与进程启动指纹并 fsync；owner 进程已退出、启动指纹不匹配、无效 owner file 或可判定 PID 复用的 owner file 可在下一次 acquire 时替换。
- Memory space open 在 lock 前确认 `.reo/workspace.json` 是合法 Reo metadata；空目录作为新 Reo 记忆空间原地初始化，使用所选目录 basename 作为 title 和空 description；空目录判断必须迭代到首个非忽略 entry 即停止，不能无界读取大型目录；空目录分支获取 lock 后、写入记忆空间文件前必须再次确认 root 除 lock-only `.reo` artifacts 外仍为空；若期间出现非 Reo 文件，返回 metadata invalid 并清理 lock-only `.reo`。非空非 Reo 目录、corrupt metadata、missing root、unsafe `.reo`、unsafe `.reo/drafts`、unsafe `.reo/drafts/segments` 或 unsafe `memories/` 返回 typed error，且 lock 前失败不得创建 `.reo/workspace.lock*`。Lock target leaf symlink 或 lock 前 `.reo` parent swap 必须拒绝，不能写入 记忆空间外。
- IPC sender validation 必须校验 main frame、trusted production origin `reo-app://renderer/index.html`、loopback dev origin、session/partition、channel allowlist 和 handle ownership。
- Custom protocol 只服务 renderer build assets，不服务用户记忆空间文件；host 只允许 `renderer`，路径必须 containment 到 renderer output。
- Audio append 每个 chunk 最多 1 MiB，每个 recording 只允许 1 个 append 在途。
- Finalized audio playback 使用 `workspace:readFinalizedAudioSegment` 和 `workspace:readFinalizedAudioSegmentSupplement`，分别服务 Memory Studio selected Segment 的本地播放/transcript 查看，以及 selected Segment `补充` tab 中 finalized audio supplement 的本地播放和 transcript 查看。SegmentSupplement playback 接收 selected supplement tab 的 audio bytes 和 transcript text。Renderer 把返回 audio bytes 转成 Blob URL，并在 content/session 变化、Segment 切换或 component unmount 时停止播放并 revoke。暂停态回听默认只使用 renderer 当前录音会话持有的有效 MediaRecorder chunk 前缀创建临时 Blob；异常恢复时，`workspace:readRecordingDraftAudio` 只允许读取当前 `workspaceHandle` 下尚未完成的 draft `audio.webm`，并要求 renderer 提供按 recovery marker byte map 推导的读取上限，用于重建暂停态回听和保存前检查所需的 chunk 前缀；该 IPC 不读取 finalized audio segment，也不返回 raw path；同一 draft 的 read、append 和 finalize 互斥，read 完成后必须复核 metadata byte length 与读取上限。cursor 大于 0 的替换使用 `workspace:cloneRecordingDraftPrefix` 把旧 draft 的 retained audio byte prefix 复制到新 draft；该 request 只接受 source/target draft identity 和 retained byte length，不返回 raw path，并在复制循环、fsync 和 metadata 写入前持续复核 workspace lock usability。cursor 为 0 的替换不得调用 prefix clone，必须走新的 recording session 和新 MediaRecorder controller。恢复态没有原 MediaRecorder controller 时不得继续或替换。完成、关闭、替换或 unmount 时必须停止回听并 revoke。
- 豆包流式语音识别在 main 侧运行 live session：由当前 voice settings 快照解密得到的 X-Api-Key 构造火山 WebSocket header，header 使用单 `X-Api-Key` 加 `X-Api-Connect-Id` 和 `X-Api-Resource-Id`，资源 ID 使用 `volc.seedasr.sauc.duration`，`ws` 连接 `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async`。start 时发送 gzip JSON full request，音频声明为 16 kHz、16-bit、mono、raw PCM；audio chunk 使用 gzip audio-only request 和正/负 sequence；server full/error response 会解析为带 `recordingSessionId` 和 `revisionId` 的 transcript segment，transport 与 server error message 会脱敏后回调；server error 会关闭 session，open 前 close 会拒绝 start，已开始后的非预期 close 会作为 transport failure 通知 registry。Recording transcription registry 会对初始 start 连接失败重试一次，重试期间不向 renderer 发临时失败 event，重试耗尽后只返回脱敏错误信封；录音中断线后 registry 会创建新 live session，并回放最近 5 秒 PCM buffer；如果重连起点位于某个 PCM chunk 内，registry 会裁剪首个重叠 chunk，segment timestamp 继续落在原录音时间线。Renderer 通过 preload 显式方法启动/发 PCM/finish/close 录音转写，并通过 `workspace:recordingTranscriptionEvent` 接收已去除 Electron event object 的 safe payload；renderer 发 PCM 使用有界串行队列，队列失败、overflow、`accepted:false` 或 start 未 accepted 只关闭 live ASR 并触发完成后补转写；close transcription 在 sender/handle owner 匹配后即使 workspace lock 已 lost 也允许清理 active ASR session，finish transcription 在 lock lost 时先关闭 owner-matched active ASR session 再返回 lock error；renderer 不得直接生成或发送火山鉴权 header，不得保存或显示已配置的 X-Api-Key 明文。
- 当前 permission policy 使用 one-shot microphone intent：renderer 必须先 await `workspace:beginMicrophoneIntent` 成功，再调用 `navigator.mediaDevices.getUserMedia`；main 的 `media` permission check 永远不授予也不消费 intent；permission request handler 先按 sender id 消费一个未过期 intent，再要求 trusted main-frame renderer 和 audio-only request。
- `workspace:beginMicrophoneIntent` 只接受 `workspaceHandle` 与 `recordingFlowSessionId`，handler 使用 `event.sender.id` 作为 sender identity，不信任 renderer sender id；同一 sender 已有未过期 intent 时返回 `ERR_MIC_INTENT_ALREADY_ACTIVE`。
- `workspace:clearMicrophoneIntent` 要求 sender、记忆空间 handle 和 recording flow session owner 匹配；owner 匹配后即使记忆空间 lock 已 lost 也允许清理 pending intent。Memory space close 在 owner 匹配后先清理该 handle 的 pending microphone intents，再释放 lock；即使 release 失败也不得保留 pending microphone authorization。Window teardown 清理全部 pending microphone intents。Video、camera、geolocation、notifications、navigation/window-open 默认拒绝。
- 当前 `shell.openExternal` 只在 settings 场景下用于打开 main-owned 火山引擎控制台链接，由 `workspace:openVoiceTranscriptionProviderConsole` 校验固定 URL 后转发；renderer 不传入 URL，当前不暴露通用外链能力、generic command bus、generic IPC bridge、renderer/preload logging bridge、Sentry bridge、Forge 或 updater。

## Forge 与 electron-vite 边界

- 当前开发和构建使用 `electron-vite`。
- 当前开发启动前加载 `.env.local`；已有 shell 环境变量优先于 `.env.local`，便于临时覆盖本机开发变量。
- 当前 preview 使用 `electron-vite preview`。
- 不得把 Electron Forge snippets 混进当前 electron-vite 结构。
- 当前不安装或配置 Electron Forge、makers、publishers、`electron-updater` 或 `@electron/fuses`。
- 只有在 packaging 能力同批定义 app identity、platform targets、makers、artifact output、ASAR policy、fuses、signing/notarization、packaged launch verification 和 tracked-output checks 后，才引入 Forge 或 makers。
- 如果未来采用 Forge，必须整体设计 Forge Vite plugin 配置模型、entry、输出路径和 packaging 生命周期。
- `@electron/fuses` 必须在 package time、code signing 前执行；fuse policy 必须同批说明 ASAR integrity、only-load-from-ASAR、Node options、inspect flags 和 rollback 风险。
- ASAR policy 必须同批说明 packed/unpacked 边界、native module/resource 例外和 packaged app launch evidence。
- `electron-updater` 只能在已有 packaged artifact、publish provider、release metadata、signed/notarized app、logging/error owner 和 installed-app update test path 后引入。
- Updater 不得先创建 hidden polling、dev update feed、generic update IPC 或 UI shell。

## 验证规则

- 声明 Electron 基线关闭前，必须运行 `npm run verify:quick`。
- 涉及构建边界时，必须运行 `npm run build`。
- 涉及生产加载、CSP、protocol、navigation 或 permission baseline 时，必须运行 `npm start` 并记录 runtime 证据。
- Runtime 证据必须覆盖 production URL、CSP header、新窗口拒绝、外部导航拒绝和权限默认拒绝。

## 实体路径边界

- 实体 More 菜单 shell 动作的目录路径和语义文件路径只能在 main process 出现；复制路径必须由 main process 通过 `clipboard.writeText` 写入系统剪贴板，不得把 raw path 写入 IPC response、preload、renderer、Query cache、DOM 或日志。

## 禁止

- 禁止 generic tool runtime。
- 禁止无当前 spec 的网关、语音链路或 agent runtime。
- 禁止 broad `window.api` dumping ground。
- 禁止无 schema、无 owner、无错误语义的 IPC channel。
- 禁止无用户可理解理由的 permission、file、system 或 shell access。
- 禁止为了接入 runtime 临时打开 Node integration、关闭 sandbox 或关闭 context isolation。

## 未来 Runtime 边界

未来 runtime integration 必须尊重 Electron 作为记忆空间、sessions、queue、tools、artifacts、permissions、sources、MCP 和 runtime UI integration 的宿主。本文档不授权现在实现该层。

# Electron

Electron 是 Reo 的一等产品宿主，不是 thin shell。

## 当前事实

- Main process 位于 `src/main`。
- Renderer 位于 `src/renderer`。
- Preload 位于 `src/preload`。
- 当前 preload 只暴露 `window.reoWorkspace` 下的显式记忆空间、录音、录音转写和补转录方法；main-to-renderer 事件只允许通过受控 callback 暴露，不暴露 `ipcRenderer` 或 `IpcRendererEvent`。
- 当前 preload bundle 输出为 `out/preload/index.cjs`；sandbox preload source 不运行时引入 Zod-backed contract 或普通 Node package。
- 当前 IPC API 只有显式 workspace product channels，不存在 generic `invoke/send` bridge。
- 当前 main process 持有 memory space registry，真实 memory space root 只存放在 main-owned app state file 中，不进入 renderer、preload DTO、DOM、URL 或 Query key。
- 当前 main process 使用 `electron-log/main` 写入本地结构化诊断日志；日志目录由 `app.setAppLogsPath()` 交给 Electron 管理，当前文件为 Electron logs path 下的 `main.log`。
- 当前本地诊断覆盖 app diagnostics ready、app ready、bootstrap failed、renderer process gone、uncaught exception 和 workspace IPC request start/finish。Workspace IPC 诊断只记录 channel、status、duration 和脱敏字段，不记录 root path、file path、display path、title、token、handle、payload、transcript、正文或 secret。诊断字段默认不展开对象、数组或未知字符串；channel、status、errorName、errorCode、mode、processType、reason 和 dataRetention 只在闭合 allowlist 中保留。
- 当前没有 renderer error capture、preload logging bridge、IPC logging channel、generic diagnostic IPC 或远程 telemetry。
- 当前没有 packaging、updater、signing、notarization、ASAR 或 fuse config。
- 当前没有 Forge config、makers、publishers、buildIdentifier、app bundle id、release channel 或 publish target。
- 当前构建权威是 `electron-vite`，不是 Electron Forge。
- 当前 `npm run dev` 通过 `scripts/run-dev.mjs` 先加载 git-ignored `.env.local`，再启动 `electron-vite dev`。Renderer development server 固定使用 `http://localhost:5183` 且启用 `strictPort`；端口被占用时启动失败，不自动漂移到未知端口。`.env.local` 只作为本机 shell 环境注入给 Electron dev process；loader 不注入 `VITE_*` key。
- 当前豆包语音能力凭证使用 Electron `safeStorage` 加密存放在 `userData/voice-transcription-settings.json`，由 main process `voiceSettingsStore` 持有。Renderer/preload 通过 application-scoped voice settings IPC 读取不含密文的 snapshot：`enabled`、`apiKeyConfigured`、`apiKeyLastFour`、`lastValidatedAt`、`lastValidationOk` 和 `lastValidationCode`。同一 X-Api-Key 服务录音中流式识别、finalized audio 自动补转录和手动重新生成转录；X-Api-Key 只在用户保存设置的 request 和 main process 解密后的运行时输入中出现；settings response、录音 IPC response、补转录 IPC response、日志、错误信封和记忆空间内容文件不返回明文或密文。
- 当前 Agentation 只作为 development renderer toolbar 连接本机 `http://localhost:4747`；development CSP 的 `connect-src` 允许该 loopback endpoint 用于 MCP sync、annotation update 和 event stream。Agentation 不新增 preload、IPC、permission、protocol、navigation 或 product runtime surface。
- 当前生产加载模型是自定义 `reo-app://renderer/index.html`。
- 当前生产 CSP 包含 `media-src 'self' blob:`，只用于本地 audio playback Blob URL；`img-src` 允许 `'self'`、`data:`、`blob:` 和 `reo-attachment:`，只用于 Markdown Content Surface 中 note 图片附件预览。生产 CSP 不把 `reo-attachment:` 加入 `connect-src`。
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
- 生产 CSP 只允许 `'self'` 和 `blob:` media source；note 图片附件进入 `img-src reo-attachment:`，并保留 image Blob URL 来源
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
- Memory space IPC channels 覆盖记忆空间选择/列表/初始化/打开/关闭、Workspace snapshot、Memory/Segment/SegmentSupplement 读写、note draft/finalize、audio recording draft/finalize、transcript save、manual transcription backfill、microphone intent、recording transcription、voice transcription settings、受限外部链接打开和实体 More 菜单 shell 动作。具体 channel name、DTO 和错误信封以 `src/workspace-contract/workspace-channels.ts`、`workspace-contract.ts` 和 bridge contract 为准。
- `workspace:readVoiceTranscriptionSettings` request 不接受 payload；response 返回 `settings: { enabled, apiKeyConfigured, apiKeyLastFour, lastValidatedAt, lastValidationOk, lastValidationCode }`，不返回 X-Api-Key 明文或密文。
- `workspace:setVoiceTranscriptionEnabled` request 接受 `{ enabled }`；response 与 read 同。
- `workspace:saveVoiceTranscriptionApiKey` request 接受 `{ apiKey }`；main 先用 `safeStorage` 加密写入 `voiceSettingsStore`，再立即执行 voice transcription probe，response 携带最新 snapshot，不返回密钥、probe 原始错误或额外 validation 字段。若 key 文件已写入但 validation snapshot 写入失败，错误信封使用 `dataRetention: "file-written-index-stale"`；renderer 重新读取 settings snapshot，不重发或显示已保存密钥明文。
- `workspace:clearVoiceTranscriptionApiKey` request 不接受 payload；response 与 read 同；ciphertext、`apiKeyLastFour` 和 validation 字段一并清空。
- `workspace:validateVoiceTranscriptionCredentials` request 不接受 payload；main 解密当前 X-Api-Key 后执行 probe，response 返回 `{ code: 'ok' | 'auth' | 'network', message? }`，并同步更新 store 的 last validation 字段。
- `workspace:openVoiceTranscriptionProviderConsole` request 不接受 payload；main 固定打开 `https://console.volcengine.com/`，并在调用 `shell.openExternal` 前校验该 URL 使用 `https:`、无 username/password、无显式 port，且 hostname 属于 `volcengine.com`。
- 上述 6 个 settings 相关 channel 是 application-scoped channel，不接收 `workspaceHandle`，也不绑定单个记忆空间 session。
- 实体 More 菜单 shell 动作 IPC channels 覆盖 reveal、open 和 copy 三类只读 OS 调用。Response 是 `{ ok: true }` 或 typed error envelope，不返回 raw path 字符串。Memory Space channels 只接受 `workspaceId`；其它 entity channels 接受当前 workspace handle 与实体 identity。Main process 经 main-only `EntityPathResolver` 解析目录或语义文件路径，调用系统 API 前再次校验目标目录或语义文件 leaf，不把路径写入 renderer、preload DTO、Query cache、DOM 或日志。这些 channel 对 Reo 文件真源是只读 OS 调用，没有 `dataRetention` 半成功状态。
- `workspace:listMemorySpaces` request 不接受 payload；response 只返回 `workspaceId`、title、description、addedAt 和 lastOpenedAt，不返回 raw path。Registry 文件缺失、损坏、schema 不匹配或 symlink leaf 按空列表处理；不可读 IO 错误返回 `ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_READ_FAILED`。List 只读取 main-owned registry file，不扫描每个记忆空间 root，不读取 `.reo/workspace.json`，不做同父目录 rename scan。
- `workspace:initialize`、`workspace:open` 和 `workspace:openMemorySpace` 成功 response 返回 opaque `workspaceHandle`、`workspaceId` 和 Workspace snapshot。Workspace snapshot 只返回 `workspaceId`、title、description 和 `memories[]` summary 投影，不返回 root path、selection token、handle internals 或顶层 recording 投影。
- `workspace:readWorkspaceSnapshot` request 只接受 `workspaceHandle`；main process 校验 sender、handle ownership 和 lock usability 后，从当前 `.reo/workspace.json` 和记忆空间文件 read model 重新返回 Workspace snapshot。该 channel 用于 active session 同步外部合法文件修改，不返回 root path、selection token、handle internals、file path 或顶层 recording 投影。
- `workspace:openMemorySpace` request 只接受 `workspaceId`；main process 只 resolve 该 `workspaceId` 的 registry entry，复用记忆空间 open 的 target validation、single-writer lock、记忆空间文件 recovery、valid index read、必要 index rebuild 和 handle registration，并返回新的 opaque `workspaceHandle`。Stored root 不存在时才在原父目录下最多检查 200 个直接子目录寻找同一 `workspaceId`。Open 获取 lock 后必须在任何 recovery/index 写入前只读确认打开的 `workspaceId` 匹配请求，然后才把 folder basename 写回 `.reo/workspace.json.title` mirror 并更新 registry projection。Registry 中的 root folder 已被用户删除且同父目录下没有同一 `workspaceId` 记忆空间时返回 `ERR_WORKSPACE_ROOT_MISSING`，不暴露 raw path。
- `workspace:removeMemorySpace` request 只接受 `workspaceId`；main process 只从 memory space registry 移除该 entry，不解析 root path、不删除本地记忆空间文件夹，也不需要 selection token。Registry 写入失败返回 `ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_WRITE_FAILED`。
- `workspace:updateMemorySpaceTitle` request 接受 active `workspaceHandle` 或 inactive `workspaceId` 加安全 title。Main process 在 single-writer lock 下改名真实 memory space root folder basename，并写入 `.reo/workspace.json.title` mirror；root move 是提交点。Response 返回 Workspace snapshot，不返回 root path、selection token、handle internals 或文件路径。
- `workspace:createMemory` request 只接受 `workspaceHandle` 和 title；main 通过当前 handle 授权创建空 Memory 容器，生成稳定 `memoryId`，写入新建 Memory 目录的 `memory.md` 和 `.reo/objects/memories/<memoryId>.json`，刷新 `.reo/index.json`，不接受 renderer-provided `memoryId`、segment id、Segment 字段或 raw path。Response 只返回 Memory summary。
- `workspace:readMemoryDetail` request 接受 `workspaceHandle`、`workspaceId`、`memoryId` 和 requestId；main 校验 sender、handle ownership、workspaceId 与当前 handle workspace 匹配和 lock usability 后，按 `.reo/objects/memories/<memoryId>.json` 定位 Memory 目录，并从 `memory.md`、Memory manifest 及 finalized audio / note Segment 文件读取当前 Memory detail projection。Response 返回同 requestId 和 detail，不返回 `workspaceHandle`、root path、selection token 或 raw path。
- `workspace:readFinalizedAudioSegment` request 接受 `workspaceHandle`、`workspaceId`、`memoryId`、`segmentId` 和 requestId；main 校验 sender、handle ownership、workspaceId 与当前 handle workspace 匹配和 lock usability 后，只读取该 Memory 下 matching finalized audio Segment 的 `audio.webm` 和 `segment.md` 正文。Response 返回同 requestId、identity、bounded audio bytes、audioByteLength、transcript text 和 transcript `baselineHash`，不返回 `workspaceHandle`、root path、file path、selection token 或 raw path。
- `workspace:readFinalizedAudioSegmentSupplement` request 接受 `workspaceHandle`、`workspaceId`、`memoryId`、`segmentId`、`supplementId` 和 requestId；main 校验 sender、handle ownership、workspaceId 与当前 handle workspace 匹配和 lock usability 后，按 supplement manifest id 定位 parent Segment 下 matching finalized audio SegmentSupplement 文件空间节点，并读取其中的 `audio.webm` 和 `supplement.md` transcript section。Response 返回同 requestId、identity、bounded audio bytes、audioByteLength、transcript text 和 transcript `baselineHash`，不返回 `workspaceHandle`、root path、file path、selection token 或 raw path。
- `workspace:createNoteSegmentDraft` request 接受 `workspaceHandle`、`workspaceId`、`memoryId` 和 title；main 校验 sender、handle ownership、workspaceId 与当前 handle workspace 匹配和 lock usability 后，在 `.reo/drafts/segments/<segmentId>/` 创建 note draft metadata 与 markdown body，返回 `segmentId` 和 revision，不返回 raw path。`workspace:writeNoteSegmentDraftBody` 接受 `workspaceHandle`、`segmentId`、bodyMarkdown 和 revision；main 按 revision 写入 draft markdown body 并返回下一 revision。`workspace:finalizeNoteSegmentDraft` 接受 `workspaceHandle`、`workspaceId`、`memoryId`、`segmentId` 和 title，把 draft finalize 到 matching Memory 的 note Segment 文件空间节点，返回当前 Memory summary 和 note Segment projection。
- `workspace:createSegmentSupplementNoteDraft` request 接受 `workspaceHandle`、`workspaceId`、parent `memoryId`、parent `segmentId` 和 title；main 校验 sender、handle ownership、workspaceId 与当前 handle workspace 匹配和 lock usability 后，在 `.reo/drafts/supplements/<supplementId>/` 创建 note supplement draft metadata 与 markdown body，返回 `supplementId` 和 revision，不返回 raw path。`workspace:writeSegmentSupplementNoteDraftBody` 接受 `workspaceHandle`、`supplementId`、bodyMarkdown 和 revision；main 按 revision 写入 draft markdown body 并返回下一 revision。`workspace:finalizeSegmentSupplementNoteDraft` 接受 `workspaceHandle`、`workspaceId`、parent `memoryId`、parent `segmentId`、`supplementId` 和 title，把 draft finalize 到 parent Segment 的 note SegmentSupplement 文件空间节点，返回当前 Memory summary、parent Segment projection 和 note supplement projection。
- `workspace:readSegmentContent` request 接受 `workspaceHandle`、`workspaceId`、`memoryId`、`segmentId` 和 requestId；main 只读取 finalized note Segment 的 `segment.md` 正文和 bodyByteLength，response 返回同 requestId、identity、`type: 'note'`、title、bodyMarkdown、bodyByteLength 和 `baselineContentHash`，不返回 root path、file path、selection token 或 handle。`workspace:writeSegmentContent` 接受同一 finalized note Segment identity、bodyMarkdown 和 `baselineContentHash`；main 在当前 Segment directory identity 内先比较当前磁盘正文 hash，匹配后 atomic 写入 `segment.md` 正文、刷新父 Memory summary，并返回 bodyByteLength 与新的 `baselineContentHash`。Audio Segment transcript save 仍使用 `workspace:saveTranscript`，不走该 channel。
- `workspace:readSegmentSupplementContent` request 接受 `workspaceHandle`、`workspaceId`、parent `memoryId`、parent `segmentId`、`supplementId` 和 requestId；main 只读取 finalized note SegmentSupplement 的 `supplement.md` 正文和 bodyByteLength，response 返回同 requestId、identity、`type: 'note'`、title、bodyMarkdown、bodyByteLength 和 `baselineContentHash`，不返回 root path、file path、selection token 或 handle。`workspace:writeSegmentSupplementContent` 接受同一 finalized note SegmentSupplement identity、bodyMarkdown 和 `baselineContentHash`；main 在当前 SegmentSupplement directory identity 内先比较当前磁盘正文 hash，匹配后 atomic 写入 `supplement.md` 正文、刷新父 Memory summary，并返回 bodyByteLength 与新的 `baselineContentHash`。Audio SegmentSupplement transcript save 仍使用 `workspace:saveSegmentSupplementTranscript`，不走该 channel。
- `workspace:saveSegmentAttachment` / `workspace:listSegmentAttachments` 只服务 finalized note Segment；`workspace:saveSegmentSupplementAttachment` / `workspace:listSegmentSupplementAttachments` 只服务 finalized note SegmentSupplement。Request 必须携带完整 workspace、Memory、Segment 或 SegmentSupplement identity，save request 额外携带 bounded image bytes；main 只接受 PNG、JPEG、WebP 和 GIF，写入对应文件空间节点下的 `attachments/` 子目录。Save response 只返回 relative `attachments/<filename>`；list response 返回 `{ relativePath, byteLength, mimeType }[]`。Attachment IPC 不返回 raw path、file path、selection token 或 handle。
- `workspace:updateMemoryTitle` request 只接受 `workspaceHandle`、`memoryId` 和 title；main 通过当前 handle 授权更新当前 Memory 目录 basename 和 `memory.md` frontmatter title，不接受 `segmentId`、Segment 字段或 raw path。Response 只返回 Memory summary。
- `workspace:updateSegmentTitle` request 只接受 `workspaceHandle`、`workspaceId`、`memoryId`、`segmentId` 和 title；main 通过当前 handle 授权更新当前 Segment 目录 basename 和 `segment.md` frontmatter title，并刷新父 Memory summary。Response 只返回 Memory summary 和 Segment projection，不返回 root path、file path、selection token 或 handle。
- `workspace:updateSegmentContentTitle` request 只接受 `workspaceHandle`、`workspaceId`、`memoryId`、`segmentId` 和 title；main 通过当前 handle 授权更新当前 Segment 的 `segment.md` frontmatter `content_title`，刷新父 Memory summary 并返回 Memory summary 和 Segment projection。该 channel 不改 Segment 目录 basename、frontmatter `title`、Segment manifest 或 supplement 投影，不返回 root path、file path、selection token 或 handle。
- `workspace:updateSegmentSupplementTitle` request 只接受当前 workspace、parent Segment、supplement 和 title identity。Main 通过 matching SegmentSupplement 文件空间节点更新目录 basename 与 `supplement.md` frontmatter title，并刷新父 Memory summary。Response 只返回 Memory summary、parent Segment projection 和 supplement projection，不返回 root path、file path、selection token 或 handle。
- `workspace:deleteSegment` request 只接受当前 workspace、parent Memory 和 Segment identity。Main 把 matching finalized Segment 文件空间节点移入 `.reo/trash/segments/`，并刷新父 Memory summary。Response 只返回父 Memory summary、被删除的 `segmentId` 和 `restoreToken`，不返回 root path、trash path、file path、selection token 或 handle。Renderer 的 Segment undo toast grace period 结束前不得调用该 channel。
- `workspace:restoreDeletedSegment` request 只接受当前 workspace、parent Memory 和 `restoreToken`。Main 只在 parent Memory 仍存在时把 trash Segment 移回 active `segments/` 并刷新父 Memory summary；parent 缺失时返回 typed error，不创建 orphan Segment。Response 不返回 root path、trash path、file path、selection token 或 handle。
- `workspace:deleteSegmentSupplement` request 只接受 `workspaceHandle`、`workspaceId`、parent `memoryId`、parent `segmentId` 和 `supplementId`；main 校验 trusted sender、session、handle owner、request `workspaceId` 与 handle workspace 一致和 lock usability 后，把 parent Segment 下 matching finalized SegmentSupplement 文件空间节点移入 `.reo/trash/supplements/`，并刷新父 Memory summary。Response 只返回父 Memory summary、parent Segment projection、被删除的 `supplementId` 和 `restoreToken`，不返回 root path、trash path、file path、selection token 或 handle。若 supplement 已移入 trash 但父 Memory index refresh 或后续 projection 失败，错误信封带 `dataRetention: "file-written-index-stale"`。
- `workspace:restoreDeletedSegmentSupplement` request 只接受 `workspaceHandle`、`workspaceId`、parent `memoryId`、parent `segmentId` 和 `restoreToken`；main 通过当前 handle 授权把 trash 中 matching SegmentSupplement 文件空间节点移回 parent Segment 的 `supplements/`。Restore 要求 parent Memory 和 parent Segment 仍存在；parent missing 返回 `ERR_SEGMENT_SUPPLEMENT_RESTORE_PARENT_MISSING` 并保留 trash supplement。成功 response 只返回父 Memory summary、parent Segment projection 和恢复后的 supplement projection，不返回 root path、trash path、file path、selection token 或 handle。若 supplement 已移回 active tree 但父 Memory index refresh 或后续 projection 失败，错误信封带 `dataRetention: "file-written-index-stale"`。
- `workspace:saveTranscript` 和 `workspace:saveSegmentSupplementTranscript` 只接受 finalized audio identity、markdown 和可选 baseline。Baseline 不匹配时返回 stale typed error，不覆盖 Markdown、不刷新 index、不推进 manifest。成功后写入对应 Markdown transcript，刷新父 Memory projection，并在 ownership 复核后把对应 manifest `lastTranscriptionAttempt` 写为 `'success'`。两个保存 channel 都不返回 raw path、file path、selection token 或 handle。
- `workspace:requestSegmentTranscriptionBackfill` 和 `workspace:requestSegmentSupplementTranscriptionBackfill` 只接受 finalized audio identity 和 `fill-missing` 或 `regenerate` mode。Main 在内部读取有界 audio、remux 并调用豆包文件 ASR；成功后复用 transcript save 路径。Response 不返回 raw path、audio bytes、base64、API key、火山请求体、transcript digest 或 transcript 外诊断字段。
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
- `reo-app://renderer/...` 只服务 renderer build assets；host 只允许 `renderer`，路径必须 containment 到 renderer output。
- `reo-attachment://<workspaceId>/segments/<segmentId>/<filename>` 和 `reo-attachment://<workspaceId>/segments/<segmentId>/supplements/<supplementId>/<filename>` 只服务当前 active workspace 下 finalized note Segment 或 note SegmentSupplement 的图片附件预览。Handler 只接受 GET，按 active workspace handle 解析 root，在 main process 内复核 workspace、entity manifest、note kind、`attachments/` child directory identity、filename containment、ordinary file 和 25 MiB 上限；response 使用 `Content-Type` 和 `Cache-Control: no-store` 返回 bytes，不返回 raw path。`reo-attachment:` 只进入 renderer `img-src`，不作为导航、window open、fetch 主通道或通用文件读取能力。
- Audio append 每个 chunk 最多 1 MiB，每个 recording 只允许 1 个 append 在途。
- Finalized audio playback 使用 finalized audio read channels，服务 selected Segment 和 selected SegmentSupplement 的本地播放与 transcript 查看。Renderer 只把 response audio bytes 转为生命周期受控 Blob URL；draft playback 只读取当前 recording draft 或 renderer chunk prefix，不读取 finalized audio，也不返回 raw path。
- 豆包流式语音识别在 main 侧运行 live session。Renderer 通过 preload 显式 start/send/finish/close，并订阅去除 Electron event object 的 safe payload；renderer 不得生成火山鉴权 header，不得保存或显示 X-Api-Key 明文。Live ASR 的 transport/server error 必须脱敏，失败时不回滚 durable audio finalize。
- 豆包 finalized audio 补转录在 main 侧运行 Turbo file ASR：由当前 voice settings 解密得到 X-Api-Key，HTTP endpoint 固定为 `https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`，资源 ID 固定为 `volc.bigasr.auc_turbo`，header 使用单 `X-Api-Key`、`X-Api-Resource-Id`、`X-Api-Request-Id` 和 `X-Api-Sequence: -1`。请求体只使用 `audio.data` base64 和 `request.model_name: "bigmodel"`。Finalized WebM/Opus 不直接提交；main 用随包 `@ffmpeg-installer/ffmpeg` binary 执行 WebM/Opus 到 OGG/Opus remux，转换临时目录在任务结束后清理。Automatic scanner 永远只入队 `fill-missing`；`regenerate` 只来自手动菜单 request。Renderer 不得接触 raw path、audio bytes、base64、ffmpeg binary path、火山 header 或 X-Api-Key。
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

## 变更门禁

只有当改动改变 Electron process model、preload/IPC surface、security baseline、permission policy、protocol、navigation、packaging/updater、logging/crash reporting、future runtime boundary 或当前能力索引时，才更新本文档。单个 channel 的任务级实现步骤、测试枚举和验证证据留在 spec 或 archive。

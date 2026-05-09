# Electron

Electron 是 Reo 的一等产品宿主，不是 thin shell。

## 当前事实

- Main process 位于 `src/main`。
- Renderer 位于 `src/renderer`。
- Preload 位于 `src/preload`。
- 当前 preload 只暴露 `window.reoWorkspace` 下的显式记忆空间方法。
- 当前 preload bundle 输出为 `out/preload/index.cjs`；sandbox preload source 不运行时引入 Zod-backed contract 或普通 Node package。
- 当前 IPC API 只有显式 memory space channels，不存在 generic `invoke/send` bridge。
- 当前 main process 持有 memory space registry，真实 memory space root 只存放在 main-owned app state file 中，不进入 renderer、preload DTO、DOM、URL 或 Query key。
- 当前没有 renderer error capture、preload logging bridge 或 IPC logging channel。
- 当前没有 packaging、updater、signing、notarization、ASAR 或 fuse config。
- 当前没有 Forge config、makers、publishers、buildIdentifier、app bundle id、release channel 或 publish target。
- 当前构建权威是 `electron-vite`，不是 Electron Forge。
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
- `electron-log` 或 Sentry 的 renderer/preload bridge 只能在真实 diagnostics 能力中引入。
- Diagnostics 能力必须同批定义 process boundary、sensitive data rules、redaction、retention、DSN/release/privacy/source-map 计划和 renderer visibility。

## IPC 设计纪律

- IPC 是产品能力协议，不是 renderer 调 main 的临时通道。
- 每个 IPC channel 必须先写清 capability、caller、owner、request DTO、response DTO、error envelope、timeout、cancellation、sender validation、permission effect 和 test owner。
- Cancellation 必须说明信号传递机制、main 端如何中止、renderer 端如何确认、部分写入如何回滚或保留；不可取消的 channel 必须说明用户可见时长上限、timeout 语义和恢复行为。
- 多个 channel 只有在共享真实协议不变量时才提取 helper；不得为了减少文件数创建 generic invoke、generic command 或 generic backend service。
- Channel 命名必须贴近 domain 行为，不能用技术层动作掩盖产品语义。
- IPC 设计必须说明数据如何进入 TanStack Query、component state、React Hook Form 或其他明确 owner。

## 当前 Electron 决策

- Renderer 特权能力必须通过窄 preload 暴露为 `window.reoWorkspace` 产品方法。
- Memory space IPC channels 覆盖 choose、list memory space entries、initialize、open、open memory space entry、remove memory space entry、close、Memory create、memory detail、memory title update、recording draft、audio manifest/chunk read、transcript/reflections save、microphone intent begin/clear。
- `workspace:listMemorySpaces` request 不接受 payload；response 只返回 `workspaceId`、title、description、addedAt 和 lastOpenedAt，不返回 raw path。Registry 文件缺失、损坏、schema 不匹配或 symlink leaf 按空列表处理；不可读 IO 错误返回 `ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_READ_FAILED`。
- `workspace:initialize`、`workspace:open` 和 `workspace:openMemorySpace` 成功 response 返回 opaque `workspaceHandle`、`workspaceId` 和 Workspace snapshot。Workspace snapshot 只返回 `workspaceId`、title、description 和 `memories[]` summary 投影，不返回 root path、selection token、handle internals 或顶层 recording 投影。
- `workspace:openMemorySpace` request 只接受 `workspaceId`；main process 从 registry 解析真实 root，复用记忆空间 open 的 target validation、single-writer lock、记忆空间文件 recovery/index reconciliation 和 handle registration，并返回新的 opaque `workspaceHandle`。Registry 中的 root folder 已被用户删除时返回 `ERR_WORKSPACE_ROOT_MISSING`，不暴露 raw path。
- `workspace:removeMemorySpace` request 只接受 `workspaceId`；main process 只从 memory space registry 移除该 entry，不解析 root path、不删除本地记忆空间文件夹，也不需要 selection token。Registry 写入失败返回 `ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_WRITE_FAILED`。
- `workspace:getMemoryDetail` request 只接受 `workspaceHandle` 和 `memoryId`；response 不返回 raw path，只返回 memory identity、title、created/updated time、full `assetIds` identity list、总 `assetCount`、`recordingsTruncated`、`hasTranscript`、`hasReflections` 和有界 recording summary preview。当前 `assetIds` 只接受已实现的 recording asset id；新增 note、photo、video 或 upload asset 前必须同批扩展 contract。
- `workspace:createMemory` request 只接受 `workspaceHandle` 和 title；main 通过当前 handle 授权创建空 Memory 容器，生成稳定 `memoryId`，写入 `memories/<memoryId>/memory.json`，刷新 `.reo/index.json`，不接受 renderer-provided `memoryId`、recording id、Asset 字段或 raw path。Response 只返回 Memory summary。
- `workspace:updateMemoryTitle` request 只接受 `workspaceHandle`、`memoryId` 和 title；main 通过当前 handle 授权更新 `memory.json` 中的 Memory 容器 title，不接受 `recordingId`、Asset 字段或 raw path。Response 只返回 Memory summary。
- `workspace:getRecordingDetail`、`workspace:readRecordingAudioManifest`、`workspace:readRecordingAudioChunk`、`workspace:saveTranscript` 和 `workspace:saveReflections` 只接受 finalized recording identity：`workspaceHandle`、`memoryId` 和 `recordingId`。`workspace:saveTranscript` 和 `workspace:saveReflections` 成功 response 返回当前 Memory summary。Draft create/append/finalize/discard 仍使用 draft `recordingId` transaction identity。
- `chooseDirectory` 只返回 `selectionToken` 和 `displayPath` 或 canceled 结果，不返回裸 `rootPath`，也不提前返回 conflict 或 permission 判断。
- `displayPath` 只使用文件夹 basename，不等同真实绝对路径。
- Selection token 由 main process 保存真实路径，单次消费、短 TTL、绑定 sender identity；过期 token 会删除，错误 sender 不烧掉 token，错误结果不得泄露真实路径。
- Preload 运行时只导入无 Zod、无普通包依赖的 channel 常量；`ReoWorkspaceBridge` 使用 `src/workspace-contract/reo-workspace-bridge.ts` 的 type-only contract。DTO 校验和错误信封属于 main process contract。
- Renderer 后续读写 workspace 不传裸 `rootPath`；main process 在 choose/open 后 canonicalize 路径，并返回 opaque `workspaceHandle`。
- `workspaceHandle` 绑定 canonical realpath、memory space root identity、`.reo` directory identity、lock directory identity、`workspaceId`、owning sender、session/partition、lock ownership 和 app lifecycle；记忆空间 close、BrowserWindow closed、renderer process gone、renderer navigation/reload、`uncaughtException` teardown、lock lost、root identity changed 或 schema mismatch 时撤销。Teardown close-all 只能删除 release 成功的 handle；release 失败的 handle 保留但不可继续授权写入，用于后续 close-all 重试。每个 handler 在 delayed filesystem operation 前必须能重新断言 handle lock usability，不能只依赖最初的 `requireHandle` 返回值。
- Memory space initialize 把 selection token 指向的目录视为父目录，记忆空间 title 必须是安全文件夹名；main process 在父目录下用 no-replace `mkdir` 创建同名 child memory space root，child 已存在返回 `ERR_WORKSPACE_ALREADY_EXISTS`，然后只在新 child root 内获取 lock 和写入 Reo 文件。新建 `AGENTS.md` 使用 no-replace atomic write，不允许覆盖用户文件。`.reo`、`.reo/drafts`、`.reo/drafts/recordings` 或 `memories/` 为 symlink 或非目录时返回 unsafe path，不得跟随到 记忆空间外；lock 必须绑定当前 `.reo` directory identity，`.reo/workspace.lock` leaf 用 no-follow 打开，`.reo/workspace.lock.lock` 只在同一目录内创建并绑定 identity，owner file 在该目录内 no-follow 创建并 fsync。
- Memory space open 在 lock 前确认 `.reo/workspace.json` 是合法 Reo metadata；空目录作为新 Reo 记忆空间原地初始化，使用所选目录 basename 作为 title 和空 description；空目录判断必须迭代到首个非忽略 entry 即停止，不能无界读取大型目录；空目录分支获取 lock 后、写入记忆空间文件前必须再次确认 root 除 lock-only `.reo` artifacts 外仍为空；若期间出现非 Reo 文件，返回 metadata invalid 并清理 lock-only `.reo`。非空非 Reo 目录、corrupt metadata、missing root、unsafe `.reo`、unsafe `.reo/drafts`、unsafe `.reo/drafts/recordings` 或 unsafe `memories/` 返回 typed error，且 lock 前失败不得创建 `.reo/workspace.lock*`。Lock target leaf symlink 或 lock 前 `.reo` parent swap 必须拒绝，不能写入 记忆空间外。
- IPC sender validation 必须校验 main frame、trusted production origin `reo-app://renderer/index.html`、loopback dev origin、session/partition、channel allowlist 和 handle ownership。
- Custom protocol 只服务 renderer build assets，不服务用户记忆空间文件；host 只允许 `renderer`，路径必须 containment 到 renderer output。
- Audio append 每个 chunk 最多 1 MiB，每个 recording 只允许 1 个 append 在途。
- Audio playback 不允许一次性 IPC 返回完整 audio 文件；manifest/chunk 只读取 `memoryId + recordingId` 指向的 finalized recording truth，拒绝 draft-only recording；renderer 最多并发 4 个 1 MiB chunk read 后组装 Blob。
- Renderer audio playback Blob URL 只在 active playback 期间存在，close/switch/unmount 必须 revoke；close 后完成的过期 chunk read 不得创建新的 Blob URL，也不得继续调度后续 chunk IPC。
- 当前 permission policy 使用 one-shot microphone intent：renderer 必须先 await `workspace:beginMicrophoneIntent` 成功，再调用 `navigator.mediaDevices.getUserMedia`；main 的 `media` permission check 永远不授予也不消费 intent；permission request handler 先按 sender id 消费一个未过期 intent，再要求 trusted main-frame renderer 和 audio-only request。
- `workspace:beginMicrophoneIntent` 只接受 `workspaceHandle` 与 `drawerSessionId`，handler 使用 `event.sender.id` 作为 sender identity，不信任 renderer sender id；同一 sender 已有未过期 intent 时返回 `ERR_MIC_INTENT_ALREADY_ACTIVE`。
- `workspace:clearMicrophoneIntent` 要求 sender、记忆空间 handle 和 drawer session owner 匹配；owner 匹配后即使记忆空间 lock 已 lost 也允许清理 pending intent。Memory space close 在 owner 匹配后先清理该 handle 的 pending microphone intents，再释放 lock；即使 release 失败也不得保留 pending microphone authorization。Window teardown 清理全部 pending microphone intents。Video、camera、geolocation、notifications、navigation/window-open 默认拒绝。
- 当前不使用 `shell.openExternal`、generic command bus、generic IPC bridge、logging bridge、Sentry bridge、Forge 或 updater。

## Forge 与 electron-vite 边界

- 当前开发和构建使用 `electron-vite`。
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

## 禁止

- 禁止 generic tool runtime。
- 禁止无当前 spec 的网关、语音链路或 agent runtime。
- 禁止 broad `window.api` dumping ground。
- 禁止无 schema、无 owner、无错误语义的 IPC channel。
- 禁止无用户可理解理由的 permission、file、system 或 shell access。
- 禁止为了接入 runtime 临时打开 Node integration、关闭 sandbox 或关闭 context isolation。

## 未来 Runtime 边界

未来 runtime integration 必须尊重 Electron 作为记忆空间、sessions、queue、tools、artifacts、permissions、sources、MCP 和 runtime UI integration 的宿主。本文档不授权现在实现该层。

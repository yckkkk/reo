# 质量

本文档是类型纪律、测试、静态检查、错误处理和 observability 的当前真源。

## 当前事实

- 当前已有 TypeScript、ESLint、Prettier、Node test runner、Vitest、Testing Library、`npm run verify:quick` 和 `npm run verify:strict`。
- 当前 `test:main` 使用 Node test runner 覆盖 main process 和 preload 纯策略函数。
- 当前 `test:renderer` 使用 Vitest + jsdom + Testing Library 覆盖 renderer/component 行为测试；jsdom 使用 `http://127.0.0.1/` 作为测试 URL，确保 `window.localStorage` 按浏览器同源存储可用；renderer test files 串行执行并限制为 1 个 worker。
- 当前 `test/**/*.ts` 由 ESLint 覆盖。
- 当前 `test:main` 使用 Node 脚本清理测试输出目录、编译测试并运行 main process 测试。
- 当前 `typecheck` 分别检查 renderer TypeScript、main process TypeScript 和 preload TypeScript。
- 当前 ESLint 覆盖 renderer、main process、preload、测试、Electron Vite config 和测试脚本。
- 当前有 `verify:titlebar` 本地视觉测量脚本，用于从截图像素中计算 macOS traffic-light 行、左侧 sidebar hide/show icon、workspace 标题文字和右侧 MemoryRail 折叠 icon 的视觉中心与标题间距；该脚本依赖本机截图和 ImageMagick，不属于 `verify:quick`。
- 当前有 `verify:memory-studio-layout` Electron runtime 布局测量脚本，用于通过 remote debugging 端口执行 Memory Studio Segment item 点击、横向 wheel 滚动、截图和结构测量；该脚本支持 `--viewport <width>x<height>` 和 `--interaction click-scroll|none`，检查 AppShell root、panel、panel content、WorkspaceFrame、Workspace stage shell、Workspace stage content、Expression FAB track 和可见 MemoryRail shell 的 viewport 边界与 overflow owner，检查 stage content 与 FAB track 的 1120px 内容轨道、左右 gutter 对称和 Memory Studio 填满轨道，检查 compact viewport 下 MemoryRail 默认 overlay-hidden 且不挤压 Memory Studio，检查单一 Segment strip scroll owner、card/dot/time 中心对齐、timeline marker 为可见圆点、timeline line 穿过圆点中心、timeline time label 可见、独立 timeline 容器消失、selected item 数量、紧凑 card 宽度范围、audio player 时间不换行、页面横向滚动和页面纵向滚动高度；脚本在退出前清理 viewport emulation、scroll position 和 resize state，不把测量状态遗留到可见 Electron runtime；该脚本不属于 `verify:quick`。
- Better Auth 已选型，但当前未安装。
- Zod 已安装，当前服务 workspace IPC contract、DTO、记忆空间 metadata、segment metadata 和错误信封。
- 当前错误码真源是 `src/workspace-contract/workspace-contract.ts` 的 `workspaceErrorCodeSchema` 和 `workspaceErrorEnvelopeSchema`；renderer 用户可见文案映射位于 `workspaceErrorMessages.ts`。
- 当前 backfill typed error 覆盖 voice disabled、API key missing、already running、target not eligible、provider failed、audio URL unconfigured、audio URL failed 和 canceled；lock lost 继续复用 `ERR_WORKSPACE_LOCK_LOST`。Renderer 文案必须从 `workspaceErrorMessages.ts` 映射，不显示 provider raw error、URL、object key、path、transcript 或 credential。
- TanStack Query、React Hook Form 和 `@hookform/resolvers` 已安装，当前服务 memory space creation form、memory rename form、memory space list 和记忆空间 snapshot cache。
- `class-variance-authority`、`clsx`、`tailwind-merge`、`@radix-ui/react-slot`、`@radix-ui/react-label`、`@radix-ui/react-dialog`、`@radix-ui/react-alert-dialog`、`@radix-ui/react-dropdown-menu`、`@radix-ui/react-tooltip`、`@radix-ui/react-separator`、`primereact`、`vaul` 和 `lucide-react` 已安装，当前服务 Button、Label、Dialog、AlertDialog、DropdownMenu、Floating Action Button Speed Dial、Drawer、Textarea、Tooltip、Separator、App shell、recording audio controls 和 icon controls。
- Workspace single-writer lock 使用 `.reo/workspace.lock` no-follow leaf file 和同目录 `.reo/workspace.lock.lock` 目录锁，owner 文件写入 pid 与进程启动指纹，不依赖通用 lock service。
- Workspace directory transaction helper 有 focused main tests 覆盖 parent identity replacement、no-replace leaf safety、known-directory file remove safety、known-directory entry read identity、known-directory tree remove identity、empty directory late payload protection 和 unsupported directory fsync code allowlist。
- `electron-log` 已安装，当前只服务 main-owned 本地诊断日志。
- 当前 logging owner 是 main process diagnostics；diagnostic event contract 位于 `src/main/diagnostics.ts`，本地 Electron file transport 初始化位于 `src/main/electronDiagnostics.ts`。
- Backfill diagnostics 通过 `src/main/backfillDiagnostics.ts` 调用既有 main diagnostics，不引入新的 sanitizer、IPC 或 remote telemetry。测试必须覆盖 backfill diagnostics allowlist、audio URL source sensitive field absence、queue events、trigger scan failure、breaker、cancel 和 cleanup。
- 当前没有 Sentry DSN、release environment、source map upload、sampling 或 privacy/scrubbing policy。
- 当前没有 posthook 或 pre-commit flow。

## 类型系统

- 优先严格 TypeScript 设置。
- 新代码不得使用 `any`。
- 不可信边界使用 `unknown` 加缩窄。
- 不得用 `@ts-ignore` 或 `@ts-expect-error` 压制类型错误。
- 不得用 non-null assertion 跳过真实不确定性。
- Form、IPC、auth、persistence 边界必须使用 Zod 做运行时校验。
- 没有真实不可信 runtime boundary 前，不安装 Zod 或创建 decorative schema。
- Auth boundary 必须测试 session request、callback exchange、storage failure、expired/invalid session、sign-out、renderer visibility 和 recovery。
- Form validation 必须测试 invalid input、field-level errors、submit failure、reset behavior 和 schema/type mismatch。

## TDD

- 行为改动必须真实 TDD。
- RED 必须先运行并失败，再开始实现。
- 测试必须基于行为规格，而不是实现细节。
- 覆盖高价值边界和异常：空输入、错误格式、文件缺失、中文字符、并发、取消、权限失败。
- REFACTOR 后必须重新运行保护该行为的测试。

## 验证

当前基础检查：

```bash
npm run verify:quick
```

`verify:quick` 当前包含 typecheck、`test:main`、`test:renderer`、lint 和 format check。

当前严格检查：

```bash
npm run verify:strict
```

`verify:strict` 当前包含 typecheck、`test:main`、`test:renderer`、`lint:strict`、format check 和 build。

当前命令边界：

- `dev`：运行 `scripts/run-dev.mjs`，加载本机 ignored `.env.local` 后启动 `electron-vite dev --ignoreConfigWarning`。该加载逻辑由 main test 覆盖，已有 shell env 优先于本地 env 文件。
- `typecheck`：运行 renderer `tsconfig.json` 和 main/preload `tsconfig.main.json`。
- `test:main`：清理 `.tmp/test-main`，使用 `tsconfig.main.test.json` 编译测试，再用 Node test runner 运行编译后的 main/preload 测试。
- `test:renderer`：使用 Vitest 运行 `src/renderer/**/*.test.{ts,tsx}`，测试环境为 jsdom，jsdom URL 固定为 `http://127.0.0.1/`，renderer test files 串行执行且最多使用 1 个 worker；setup 文件加载 Testing Library DOM matchers、pointer capture、canvas 2D context 测试替身、`ResizeObserver` 测试替身和 localStorage 测试存储，并在每个测试后执行 DOM cleanup。canvas 2D context 替身保持可配置，允许 focused canvas 行为测试局部替换 context。
- `lint`：运行 `eslint .`，按 `eslint.config.js` 的 flat config 检查 renderer、main process、测试、Electron Vite config 和脚本。
- `lint:strict`：运行 `eslint . --max-warnings=0`，同一 flat config 下把 warning 作为失败。
- `format:check`：运行 `prettier --check .`。

当前本地视觉测量：

```bash
npm run verify:titlebar -- --image /tmp/reo-window.png
npm run verify:titlebar -- --capture -1339,1211,1200,800 --output /tmp/reo-window.png
npm run verify:titlebar:self-test
REMOTE_DEBUGGING_PORT=9233 npm run dev
npm run verify:memory-studio-layout -- --port 9233 --screenshot /tmp/reo-memory-studio.png --metrics /tmp/reo-memory-studio.json
npm run verify:memory-studio-layout -- --port 9233 --viewport 900x720 --interaction none --screenshot /tmp/reo-memory-studio-compact.png --metrics /tmp/reo-memory-studio-compact.json
```

`verify:titlebar` 默认读取截图完整宽度的顶部 140px titlebar 区域，将图像像素分组成 traffic-light 色块、左侧 sidebar hide/show icon 色块、workspace 标题文字色块和右侧 MemoryRail 折叠 icon 色块，计算 sidebar hide/show icon 与 traffic-light 行的垂直差值、workspace 标题文字与 sidebar hide/show icon 的水平间距、workspace 标题文字视觉中心与 sidebar hide/show icon 视觉中心的垂直差值，以及右侧 MemoryRail 折叠 icon 视觉中心与 sidebar hide/show icon 视觉中心的垂直差值；默认阈值是 1 个物理像素或 1-2 个 CSS px。截图窗口必须处于 active 状态，确保原生 traffic-light 色块可被识别；截图必须包含完整 Reo 窗口宽度，确保右侧 MemoryRail 折叠 icon 进入测量区域。该命令只作为本地操作验证证据，不替代 `verify:quick`。

`verify:memory-studio-layout` 需要已启动的 Electron runtime 和可见的 Memory Studio。脚本默认通过 CDP 输入事件点击第二个 Segment item、执行横向 wheel 滚动，并保存可选 screenshot/metrics；`--interaction none` 用于采集默认静止态视觉证据。通过标准是：AppShell root、AppShell panel、AppShell panel content、WorkspaceFrame、Workspace stage shell、Workspace stage content、Expression FAB track 和可见的 Workspace MemoryRail shell 都位于 viewport 内，Workspace stage content 的 computed `max-width` 为 `1120px`，stage content 与 FAB track 相对 stage shell 的左右 gutter 必须对称，Memory Studio 和 `memory-studio-layout` 必须填满 stage content 轨道，compact viewport 下 MemoryRail 必须是 overlay-hidden 初始态；AppShell root、panel、panel content 和 WorkspaceFrame 的 overflow owner 都是 `hidden`；Memory Studio 只有一个 `memory-studio-segment-strip-scroll`，每个 `memory-studio-segment-item` 同时包含 `memory-studio-segment-card`、`memory-studio-segment-timeline-dot` 和 `memory-studio-segment-timeline-time`，dot/time 与 card 水平中心偏差不超过阈值，timeline marker 宽高必须保持圆点形态，dot 垂直中心与 timeline line 中心偏差不超过阈值，timeline time label 必须有可见尺寸和非空文本，独立 `Memory 片段时间轴` navigation 不存在，紧凑 Segment card 宽度处于脚本配置范围内，audio player 和等宽时间位于 viewport 内且时间 `white-space` 为 `nowrap`，`windowScrollX` 与 `windowScrollY` 均为 0，document width/height 不超过 viewport width/height。脚本使用 `--viewport` 后必须在 `finally` 中调用 `Emulation.clearDeviceMetricsOverride` 并重置 scroll/resize。

没有新鲜验证证据，不得宣称完成。

## 操作验证

- 需要真实桌面操作、OS dialog、Electron runtime、录音、播放、保存、重开或视觉对比的任务，必须使用 Computer Use 验证。
- 操作验证不能替代 TDD、typecheck、lint 或 format。
- 如果 spec 指定 reference segments，验证证据必须说明哪些结构、状态和交互已对照 reference，哪些视觉由 Reo design system 替换。

## 当前质量决策

- 每个行为代码变更必须有独立 spec、RED/GREEN/REFACTOR 证据、`docs/current/*` 更新和 `npm run verify:quick`。
- 每个代码变更在完成前必须执行简化审查：复用已有 helper/component，删除重复逻辑、冗余状态、不必要 JSX wrapper、无价值注释，检查热路径额外工作、事件监听器、timer 和 Blob URL 清理。
- Segment delete projection 这类跨 UI/cache/session 的纯规则必须有独立 renderer 单元测试，覆盖乱序 delayed commit、多个 pending delete、外部 summary 变化、不使用 aggregate count 猜测实体身份、commit/undo phase 互斥，以及 stale refresh detail 不能越过 session revision 写入重开后的 cache。
- 只读 runtime validation 不伪装成 RED；只有发现行为缺陷并修改代码时，才先写 failing test 或记录可复现失败，再进入 GREEN。
- Codex CLI read-only validation 必须在 Reo quiescent 或记忆空间 closed 状态运行，hash 范围排除 `.reo/workspace.lock*` 和 temp files。
- Renderer source 禁止直接或动态 import Electron 和所有 Node builtin，包括 bare builtin 与 `node:` 前缀；restricted import 规则必须由测试覆盖。
- Preload source 只允许直接或动态 import `electron`、preload 内部 module，以及当前允许的轻量 contract module；不得引入 Zod-backed contract、Node builtin、main/renderer source 或普通 package；preload path 必须指向 `out/preload/index.cjs`，source crawl 与 lint 边界必须由测试覆盖。
- Main tests 必须覆盖 workspace file truth、IPC contract、trusted sender、selection token、single-writer lock、stale lock owner 启动指纹、无启动指纹 owner 的 PID 复用判定、filesystem containment、atomic write、metadata schema、memory space registry 同父目录 folder rename 协调、direct open selected root folder rename 后修复 metadata mirror、registered open 在 index reconciliation 前修复 stale title mirror、active snapshot refresh 使用 root folder basename 并修复 stale title mirror、memory space rename 真实移动 root folder、case-only root rename、metadata-only rename 错位恢复、root move 作为提交点且后续 mirror 失败返回 `file-written-index-stale`、同名 sibling conflict 保留旧 root/metadata/registry/index、root move 前失败不得重建 `.reo/index.json`、active memory space rename 后同一 handle 仍可 snapshot read 和 close、active memory space rename 不被 registry projection 写入失败阻断、active Workspace snapshot read 同步外部合法 Markdown、manifest 和 transcript presence 修改、file-space node 目录命名投影、Finder 直接重命名后的 manifest id 定位、Segment title update、SegmentSupplement title update、SegmentSupplement title update 的 request workspace mismatch 先于文件写入拒绝、renamed symlink/non-directory/unsafe metadata candidate 拒绝且不 fallback、title 已写出但 index refresh 失败返回 `file-written-index-stale`、Segment delete/restore、Segment delete/restore 在 source identity 验证后目录被替换时不得移动替换目录、Segment delete/restore index-failure rollback 不得移动 replacement active/trash 目录、Segment delete/restore index-failure rollback 在 lock lost 后不得继续搬文件、Segment delete/restore 成功路径不得为 index refresh 重复扫描 Segment tree、Segment restore 不得在恢复前扫描 active candidates，且同 id renamed active duplicate 必须回滚本次恢复、restore parent missing 不得通过先 exists 再使用实现、SegmentSupplement delete/restore move、restore parent Memory 或 Segment missing typed error、restore parent missing 后 trash supplement 保持可恢复、SegmentSupplement delete/restore 刷新父 Memory supplementCount、destructive Segment read 遇到 unsafe finalized metadata leaf 必须返回 unsafe typed error、Segment 文件空间节点真源扫描、SegmentSupplement 更新时间投影、SegmentSupplement renamed file-space node audio read、SegmentSupplement transcript save、index rebuild/recovery、Memory delete/restore move + rollback、recording draft/finalize、finalize response full Segment projection、unfinished draft audio read 与读取上限、draft audio read/append/finalize 互斥、markdown save、error envelope、lock-lost 行为、trusted main-frame reload/navigation workspace handle release、lifecycle release coalescing、豆包 ASR live session、协议 frame、response 解析、错误脱敏、非预期 close 断线报告、初始连接重试、pending start close、录音中断线重连、PCM replay buffer、录音转写 session registry、timestamp offset 和 stale revision 丢弃。
- Main tests 必须继续覆盖 backfill AUC client submit/query、processing/queued/success、auth/rate-limit/network/timeout/empty-audio/quota/size/format/malformed/abort；audio URL source WebM/Opus 到 OGG/Opus remux、TOS PUT/GET/DELETE signing、short TTL、cleanup、abort 和敏感字段不泄漏；BackfillQueue FIFO、manual head insert、dedup、pause/resume、cancel/abort、batch cap N=20、breaker K=3、manual bypass、URL cleanup；scanner eligibility；trigger wiring voice settings/workspace ready 上升沿、once-per-ready、lock lost/workspace switch cancel 和 recording pause；manual IPC/preload/renderer wrapper 与 running state。
- Renderer tests 必须覆盖当前用户可见行为和 owner 边界，而不是绑定内部 class 串。最小覆盖面包括 App shell 与 workspace entry、WorkspaceFrame/MemoryRail layout contract、Memory Studio selection/content/query ownership、Button / DropdownMenu / toast action 交互状态约束、Memory/Segment/Memory space remove 共享危险确认结构、Segment card More 菜单、Segment rename/delete Dialog、rename optimistic update 与 rollback、Memory space rename 遇到 `file-written-index-stale` 时保持 optimistic title、Segment delete 的乐观投影、toast undo、delayed IPC commit、10 秒 grace-period duration、toast 不可手动 dismiss、重复 toast auto-close 不重复提交、commit 已开始后 undo 不回滚、离开 workspace 后不使用旧 handle 提交 pending delete、旧 handle 的 in-flight delayed delete response 不改写同 workspaceId 的新 session、旧 pending refresh detail 不改写重开后的 Memory detail cache、恢复 action 的 icon+文字结构、默认透明状态和 hover/focus 样式、delete failure rollback、`file-written-index-stale` failure 不做本地假恢复、grace period 内 file-truth refresh 不打破 pending delete projection、多个 pending Segment delete 的 projection 不互相复活、delayed commit 乱序返回时仍重放剩余 pending projection、pending projection 不用 aggregate count equality 猜测实体身份、pending projection 保留外部 summary 变化、pending delete 不压制非目标 Memory detail/content invalidation、session 边界清理不含 handle 的内容 query cache、workspace-scoped Dialog target 在切换或离开 workspace 时清理、rollback 不覆盖后续 Memory 投影变化、成功 commit 后移除 Segment content 与 SegmentSupplement content cache、visibility refresh 的无变化不重刷、Waveform 点击与 scrub-session seek、SegmentSupplement content tab rail、多个 SegmentSupplement tab 切换、content tab rail drag/drop 可重排 `转录` 和 SegmentSupplement tabs、dragenter 不改序、同次拖拽可连续前后换位、drag hover 不展开 target More、supplement More button/reorder anchor、SegmentSupplement More 不因 active selection 或 DropdownMenu open 常驻展开、More trigger 自身 focus-visible 可展开且 blur/unhover 后视觉收起、非 active hidden More 同步收束 pointer events、tabIndex 和 `aria-hidden`、SegmentSupplement tab rail 400ms demo motion、content panel 300ms motion、DropdownMenu 150ms enter motion、SegmentSupplement More menu rename/delete intent、SegmentSupplement rename optimistic update、普通失败 rollback、旧 handle 的 in-flight SegmentSupplement rename response 不回滚新 session、`file-written-index-stale` 失败保持 optimistic title、SegmentSupplement delete Dialog、delete 后 detail cache parent segment `supplements[]` 投影、delete `file-written-index-stale` 后保持 hidden、清 exact content Query 并仍提供 restore toast action、exact supplement content query cleanup、toast restore action、restore 后 parent Segment projection 与 supplement tab 恢复、restore `file-written-index-stale` 后恢复本地 supplement projection、SegmentSupplement audio resource cache reuse、title-only supplement update 不重建 audio resource 也不重置 playback position、supplement 消失时的 Blob URL release、SegmentSupplement content 与录音 target、SegmentSupplement finalize 后 transcript save、SegmentSupplement recovery transcript retry、FAB 当前 Memory target、recording flow 阻塞与 `beforeunload`、recording recovery 保存/放弃/检查、录音三态 waveform 和 typography、paused draft playback readiness 与 replay 起点、暂停态可执行 action capability、replacement transaction/rollback、completion backfill、transcript focus/scroll、finalize 后 App cache projection 和 Query key ownership。
- Operation validation 必须覆盖 OS dialog、mic permission、record/pause/resume/stop、playback、save failure、restart/reopen、viewport/reference。
- 设计变更的操作验证必须覆盖运行时视觉证据；布局、尺寸、折叠位移、展开态、浅色/深色和交互状态不能只由 class 或单元测试证明。
- 对抗审查有 unresolved BLOCKER/MAJOR 时不得进入 `$writing-plans`、`$plan-eng-review` 或实现阶段。

## 打包与更新验证

- 当前没有 packaging、maker、fuse、signing、notarization、publish 或 updater verification command。
- 引入 packaging 必须同批新增 package/make 验证、packaged app launch evidence、artifact output 检查和 tracked-output exclusion 检查。
- 包含 `@ffmpeg-installer/ffmpeg` 或其它 bundled media binary 的 packaged artifact 必须验证目标平台实际进入 artifact 的 binary、license 和分发义务；未完成该验证前不得把 packaged artifact 标记为可发布。
- 引入 fuses 或 ASAR integrity 必须同批验证 packaged artifact 的 fuse/ASAR 状态。
- 引入 updater 必须同批验证 update metadata、publish target、signed/notarized installed app、update failure path 和 no-secret logging。
- 没有 packaged app 和 release metadata 前，不创建 updater tests 或 dev update config。

## Vitest 边界

- 当前 Vitest 只服务 renderer/component 行为测试。
- 当前 main process 纯策略测试继续使用 Node test runner。
- 当前 Vitest 配置覆盖 Vite transform、React JSX、jsdom DOM queries、jsdom URL 和 Testing Library matchers。
- 当前不启用 snapshot、coverage、browser mode 或 watch 作为验证门禁。
- 新 renderer 行为必须优先写 Testing Library 测试，断言 accessible role/name 和用户可见状态。

## 错误处理

- IPC 和 UI 边界的 error shape 必须有意设计。
- Auth error shape 必须区分 request、callback、exchange、storage、session refresh 和 sign-out failure。
- 不创建无 consumer 的通用 error taxonomy。
- 每个真实边界必须分别定义 user-facing error shape 和 internal diagnostic shape。
- Diagnostic payload 必须有 owner、category、cause、recovery hint 和 redaction rule。
- 不得静默吞错。
- 用户可见错误必须可行动。
- 日志应保留诊断信息，但不得泄露 secrets。
- 每个功能变更必须显式列出用户可见错误、内部诊断错误、恢复路径和失败时保留的数据。
- 错误处理必须覆盖权限失败、取消、并发、文件缺失、schema 不支持、写入失败和保存失败中与当前功能变更相关的项。

## 可观测性

- 当前本地诊断使用 `electron-log/main`，只在 main process 内初始化。
- 当前诊断事件写入 Electron logs path 下的 `main.log`，事件前缀为 `[reo-diagnostic]`，内容是经过脱敏的 JSON。
- 当前日志 retention 使用 `electron-log` file rotation：`main.log` 单文件大小上限为 1 MiB，超过后轮转为 `main.old.log`。
- 当前诊断覆盖 app diagnostics ready、app ready、bootstrap failed、renderer process gone、uncaught exception 和 workspace IPC request start/finish。
- Workspace IPC diagnostic span 只记录 channel、status、duration 和脱敏字段，不记录 request payload、root path、file path、display path、title、token、handle、transcript、正文或 secret。
- Diagnostic fields 默认不展开对象、数组或未知字符串；`channel`、`status`、`mode`、`processType`、`reason`、`errorName`、`errorCode` 和 `dataRetention` 只能在闭合 allowlist 中保留。未知 `errorName` 收敛为 `Error`，未知 `errorCode` 收敛为 `ERR_UNKNOWN`，未知 `error:*` status 收敛为 `error`。
- `REO_DIAGNOSTICS_CONSOLE=1` 只允许在本机开发时把同一诊断事件同步到 console；默认 console transport 关闭。
- Renderer error capture、preload logging bridge、IPC logging channel、generic diagnostic IPC 和远程 telemetry 当前都不存在。
- 引入 crash/error reporting 时，使用 Sentry。
- 没有 DSN、release/environment、source map upload、privacy/scrubbing 和 sampling 计划前，不初始化 Sentry。
- Background work 必须暴露足够状态，用于排查时序和失败。

## 变更门禁

任何 type rules、tests、lint/format hooks、error handling、logging、Sentry、verification commands 改动，都必须更新本文档。

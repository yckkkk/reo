# 质量

本文档是类型纪律、测试、静态检查、错误处理和 observability 的当前真源。

## 当前事实

- 当前已有 TypeScript、ESLint、Prettier、Node test runner、Vitest、Testing Library 和 `npm run verify:quick`。
- 当前 `test:main` 使用 Node test runner 覆盖 main process 和 preload 纯策略函数。
- 当前 `test:renderer` 使用 Vitest + jsdom + Testing Library 覆盖 renderer/component 行为测试。
- 当前 `test/**/*.ts` 由 ESLint 覆盖。
- 当前 `test:main` 使用 Node 脚本清理测试输出目录、编译测试并运行 main process 测试。
- 当前 `typecheck` 分别检查 renderer TypeScript、main process TypeScript 和 preload TypeScript。
- 当前 ESLint 覆盖 renderer、main process、preload、测试、Electron Vite config 和测试脚本。
- 当前有 `verify:titlebar` 本地视觉测量脚本，用于从截图像素中计算 macOS traffic-light 行与 Reo titlebar icon control 的垂直中心差；该脚本依赖本机截图和 ImageMagick，不属于 `verify:quick`。
- Better Auth 已选型，但当前未安装。
- Zod 已安装，当前服务 workspace IPC contract、DTO、workspace metadata、recording metadata 和错误信封。
- TanStack Query、React Hook Form 和 `@hookform/resolvers` 已安装，当前服务 workspace creation form 和 workspace snapshot cache。
- `class-variance-authority`、`clsx`、`tailwind-merge`、`@radix-ui/react-slot`、`@radix-ui/react-label`、`@radix-ui/react-dialog`、`@radix-ui/react-tooltip`、`@radix-ui/react-separator`、`@radix-ui/react-slider`、`vaul` 和 `lucide-react` 已安装，当前服务 Button、Label、Dialog、Drawer、Textarea、Tooltip、Separator、AudioPlayer、App shell、recording audio controls 和 icon controls。
- Workspace single-writer lock 使用 `.reo/workspace.lock` no-follow leaf file 和同目录 `.reo/workspace.lock.lock` 目录锁，不依赖通用 lock service。
- Sentry 和 `electron-log` 已选型，但当前未安装。
- 当前没有 logging owner、diagnostic event contract、Sentry DSN、release environment、source map upload 或 privacy/scrubbing policy。
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

当前命令边界：

- `typecheck`：运行 renderer `tsconfig.json` 和 main/preload `tsconfig.main.json`。
- `test:main`：清理 `.tmp/test-main`，使用 `tsconfig.main.test.json` 编译测试，再用 Node test runner 运行编译后的 main/preload 测试。
- `test:renderer`：使用 Vitest 运行 `src/renderer/**/*.test.{ts,tsx}`，测试环境为 jsdom，setup 文件加载 Testing Library DOM matchers、pointer capture 与 `ResizeObserver` 测试替身，并在每个测试后执行 DOM cleanup。
- `lint`：运行 `eslint .`，按 `eslint.config.js` 的 flat config 检查 renderer、main process、测试、Electron Vite config 和脚本。
- `format:check`：运行 `prettier --check .`。

当前本地视觉测量：

```bash
npm run verify:titlebar -- --image /tmp/reo-window.png
npm run verify:titlebar -- --capture -1339,1211,1200,800 --output /tmp/reo-window.png
npm run verify:titlebar:self-test
```

`verify:titlebar` 会读取截图左上 titlebar 区域，将图像像素分组成 traffic-light 色块和 titlebar icon 色块，计算两个 bounding box center 的垂直差值；默认阈值是 1 个物理像素。截图窗口必须处于 active 状态，确保原生 traffic-light 色块可被识别。该命令只作为本地操作验证证据，不替代 `verify:quick`。

没有新鲜验证证据，不得宣称完成。

## 操作验证

- 需要真实桌面操作、OS dialog、Electron runtime、录音、播放、保存、重开或视觉对比的任务，必须使用 Computer Use 验证。
- 操作验证不能替代 TDD、typecheck、lint 或 format。
- 如果 spec 指定 reference assets，验证证据必须说明哪些结构、状态和交互已对照 reference，哪些视觉由 Reo design system 替换。

## 第一产品切片质量决策

- First product slice 的 implementation slices 必须各自有独立 spec、RED/GREEN/REFACTOR 证据、`docs/current/*` 更新、`npm run verify:quick` 和 commit。
- First product slice 的每个代码 slice 在 GREEN/REFACTOR 后、commit 前必须执行简化审查：复用已有 helper/component，删除重复逻辑、冗余状态、不必要 JSX wrapper、无价值注释，检查热路径额外工作、事件监听器、timer 和 Blob URL 清理。
- Runtime validation slice 不把“检查通过”伪装成 RED；只有发现行为缺陷并修改代码时，才先写 failing test 或记录可复现失败，再进入 GREEN。
- Renderer behavior tests 引入 Vitest + Testing Library 时，必须先用 RED 证明当前 runner 不足，再把配置纳入 `verify:quick`。
- Codex CLI read-only validation 必须在 Reo quiescent 或 workspace closed 状态运行，hash 范围排除 `.reo/workspace.lock*` 和 temp files。
- Renderer source 禁止直接 import Node/Electron API；`rendererImportBoundary.test.ts` 使用 ESLint API 验证 restricted import 规则。
- Preload sandbox 边界由 `preloadPath.test.ts` 和 `preloadSandboxBoundary.test.ts` 覆盖：preload path 必须指向 `out/preload/index.cjs`，preload source 不得引入 Zod-backed contract 或普通 Node package。
- Workspace filesystem 由 main tests 覆盖：path containment、`AGENTS.md` conflict no-write、dangling `AGENTS.md` symlink conflict no-write、IPC conflict no-lock、open non-Reo no-lock、open unsafe child no-lock、获取 lock 后异常必须释放 lock、handle registration 失败释放 lock、lock target 写入失败 error envelope、lock target symlink leaf no-follow、lock target open 前 `.reo` parent swap guard、stale lock dead owner recovery、handle release 失败保留 handle 且 lock lost、lock file 写入前 `.reo` identity 复核、pre-expose staging cleanup 与同 memory id retry、`.reo` metadata directory symlink guard、`.reo/drafts` symlink guard、unsafe `memories/` target guard、memory 父目录符号链接替换防护、memory directory 创建前 `memories/` root symlink swap guard、recordings directory 创建前 memory directory symlink swap guard、staging parent relative mkdir guard、staging 创建后 parent swap guard、staging source swap guard、draft source leaf/ancestor symlink swap guard、draft validation 后 ancestor symlink swap guard、draft cleanup validation 后 symlink swap guard、draft discard cleanup validation 后 symlink swap guard、memory metadata write 前 symlink swap guard、memory metadata symlink leaf no-follow、finalized recording metadata symlink leaf no-follow、invalid draft metadata pre-expose guard、unsafe finalized metadata detail no-fallback、markdown save parent swap guard、recovery repair 写入前 memory directory 复核、marker-bearing invalid finalized recovery fail-open、finalize/recovery marker unlink 前 target 复核、recordings parent pre-expose/final-rename/recovery cleanup symlink swap guard、recovery recording leaf symlink guard、cleanup validation 后 remove guard、metadata/index、memory file truth、durable recording finalize、finalize 保留 draft markdown、title update file-first、memory metadata directory ownership、corrupt/stale index rebuild from finalized memory metadata/audio、unreadable memories no-empty-index、finalized metadata 投影字段校验、finalized audio symlink/non-file rejection、audio read TOCTOU guard、audio chunk bounded range read、audio cache stale metadata guard、audio cache duplicate finalized id guard、draft audio symlink append guard、append metadata write failure rollback/error envelope、index update failure no pre-persisted reconciliation side effect、finalize rollback、rollback index refresh、accurate data retention、duplicate memory/recording protection、existing duplicate recording lookup rejection、stale draft recovery、missing stale draft marker cleanup、stale draft append guard、stale draft read/detail guard、markdown index refresh、symlink guard、draft ancestor symlink guard、recovery recordings symlink guard、fsync order、unsupported directory fsync fallback、transaction directory fsync fallback、transaction recovery、handle sender binding、single-writer lock、recording draft、finalized recording append guard、audio manifest/chunk read。
- Workspace transaction 回归测试还覆盖：`AGENTS.md` no-replace atomic write、atomic replace post-commit failure restore existing target、atomic replace backup removal 后 cleanup durability best-effort、atomic write final rename/link parent swap 与后置 cleanup、atomic temp write async + final commit 短同步段、finalize final expose parent swap 与后置 cleanup、finalize target 通过 no-replace reservation 暴露并重验 late duplicate、finalize staging source identity guard、draft create/append ancestor post-validation swap、draft create leaf directory 创建后 ancestor swap、draft create 空目录 cleanup、draft metadata schema validation before durable expose、audio read finalized ancestor swap、audio finalized target hot path cache、explicit memory identity audio read、no global lookup on explicit finalized audio read、audio cache hit duplicate finalized id rejection、cached audio chunk duplicate ownership revalidation、cached audio metadata revalidation、audio growth after finalized metadata guard、markdown autosave 单 memory index refresh、markdown index refresh queue 内读取当前 summary、full index rebuild 不能覆盖 queued markdown index refresh、full index rebuild 在 queued markdown refresh 后重新计算 replace payload、open reconciliation 在 metadata refresh 后重新计算 replace payload、workspace metadata parent swap no-follow read、read model memories root identity guard、read model persist 前 memories root identity guard、post-lock/pre-file-write lock usability guard、initialize workspace 托管目录创建期间 lock identity loss guard、open workspace target revalidation 前 lock lost guard、open workspace 托管目录创建期间 lock identity loss guard、open workspace index reconciliation 期间 lock identity loss guard、recovery metadata-less cleanup 前 lock usability guard、recovery 写操作前 lock usability guard、finalize draft cleanup 后 lock usability guard、delayed handle usability assertion、lock lost 后 finalize 不执行旧 handle rollback、pre-expose lock lost 后不执行旧 handle cleanup、open workspace 补齐缺失托管目录、workspace metadata symlink no-follow、workspace index symlink rebuild、markdown presence symlink no-follow、window teardown close-all workspace handles、uncaught exception close-all workspace handles、teardown release failure retains lost handle、workspace root identity change invalidates lock usability、lock directory replacement invalidates lock usability、stale lock missing/symlinked owner recovery、`.reo` ancestor swap before managed draft child mkdir、final expose late duplicate no-replace、staging metadata symlink no-follow、finalized-only audio playback、append metadata 写失败后的 audio truncate rollback、draft 已安全缺失时保留 durable finalize、recovery 清理 metadata-less new-memory partial directory、recovery 保留 metadata-less marker-bearing recording payload、marker-bearing invalid finalized recovery preserves memory reference、recording metadata single schema owner、async finalize copy、bounded concurrent playback chunk loading、close 后过期 playback request 不创建 Blob URL、unmount 后过期 playback request 不创建 Blob URL。
- 当前回归测试还覆盖：atomic write 内 lock lost 不写 `AGENTS.md`、audio manifest/chunk open/read delayed lock lost、symlinked finalize marker 不触发 fail-open、lock directory 创建后 owner 写入前替换窗口、cold invalid durable duplicate audio read、index replace read 后 write 前 `memories/` identity 复核、same-file markdown save queue、root-scoped active draft state 清理、discard remove delayed lock lost、close 后停止继续调度 playback chunk、finalize draft file allowlist、metadata/index 1 MiB 上限与 strict schema。
- Task 2 后 main/preload tests 覆盖：无 one-shot intent 拒绝 microphone permission request、matching sender intent 只能消费一次、过期 intent 拒绝、permission check 永不 grant media、同 sender 第二个 active intent 返回 `ERR_MIC_INTENT_ALREADY_ACTIVE`、clear 只清 matching workspace/drawer owner、clear 在 lock lost 后仍清理 matching pending intent、workspace close/window teardown 清理 pending intents、close 在 lock lost 或 release failure 分支不保留 pending intent、untrusted origin 消费后仍拒绝、video/camera 拒绝、memory detail delayed lock lost、memory detail response strip raw path、memory detail IPC、microphone intent IPC、preload surface 无 generic invoke/send。
- Workspace entry UI 由 renderer tests 覆盖：Home 主内容区不显示独立 `+` 创建按钮、sidebar 添加菜单打开专用“创建本地工作区” Dialog、Dialog accessible name、Dialog close control、workspace action pending 保护、初始 focus、名称/描述/位置字段、description payload、submit-time validation、folder picker cancel 保留输入、`AGENTS.md` conflict alert、`打开本地工作区` open branch、raw path/displayPath 不进入 IPC payload、workspace snapshot query key 不包含 handle、initialize/open 成功后 route state 切换。
- App shell 与 App flow UI 由 renderer tests 覆盖：starter shell 只显示 `首页`、loaded shell 显示 `首页`/`新记忆`、`首页` 和 workspace 项目项触发真实导航并关闭已打开的添加菜单、48px 无边框 titlebar shell slot、main panel titlebar slot、titlebar drag/no-drag region、titlebar hide/show control token 定位和垂直居中、sidebar 240-520px resize clamp、8px resize hit area、separator keyboard resize、covered panel right-edge anchoring、sidebar add menu stacking above main panel、add menu trigger-left anchoring、project header hover/focus/open reveal、interactive component accessible names、drag resize 关闭 motion、pointer cancel cleanup、light/dark theme toggle、创建 workspace 后 theme 保持、Home/detail 打开 recording drawer、detail 录音 finalize 传当前 `memoryId` 并刷新 active memory detail query、未实现 media/file/AI/auth/global search capability 负向断言。
- MediaRecorder adapter 由 renderer tests 覆盖：audio-only `getUserMedia`、chunk 转换为 `Uint8Array`、`stop()` 等待最后一次 `dataavailable` chunk 转换完成后再 resolve、重复 stop 复用同一 stop operation、final chunk 转换失败时 reject stop、recorder construction/start failure 停止已获取 media tracks。
- Workspace home 和最小 UI primitives 由 renderer tests 覆盖：Button role/name/focus-visible/disabled、Label accessible name、`全部记忆` header、本地 `搜索记忆` 过滤、月份分组、memory card metadata、memory card 打开当前 detail、空 workspace 状态、单一 record action、no future capabilities。
- Memory detail 由 renderer tests 覆盖：通过 `getMemoryDetail` 渲染 title/date/recordings/`转写`/`反思`/`记忆内容`、按 `hasTranscript/hasReflections` 显示 saved/empty 状态、detail query key 不包含 `workspaceHandle`、More/Rename/Delete/Show in folder/Export/Films/photo/video/file/AI 不进入 runtime command surface、App Home ↔ detail ↔ Home in-memory route。
- Memory detail main contract 由 main tests 覆盖：detail read 使用有界 recording preview，返回总 recording count、`recordingsTruncated`、`hasTranscript` 和 `hasReflections`，避免长 memory 首屏无界读取所有 recording 文件。
- 当前 recording loop 由 renderer tests 覆盖：record/pause/resume/stop lifecycle、begin microphone intent 先于 media acquisition、begin intent 失败不启动 media acquisition、begin resolves after unmount 会 clear pending intent 且不创建 draft、draft creation pending 时 unmount 或 workspace handle change 会 clear pending intent、draft 返回后 discard 且不启动 media、media start pending 时 unmount 会 clear pending intent、discard draft 并在 controller resolve 后 stop、media start failure clear pending intent、controller ready 前不显示 stop 或 finalize、pause/resume 只影响 elapsed timer 和 media controller、录音过程中不生成 mock transcript、finalize 后 transcript draft 初始为空、finalize waits for append ack、finalize 传递 active recording clock duration、existing memory target `memoryId`、sub-second duration、finalize 后 session 同步 memory/recording projection、append error/reject 立即 failed 且不 finalize、failed 后 retry、failed retry draft/timer reset、failed recorder cleanup、failed draft discard、stale stop ignore、stale chunk ignore、autosave failure draft retention、close/reopen 后忽略旧 autosave 结果、manifest/chunk playback、`转写预览`、local playback surface、unmount Blob URL revoke、close recording panel Blob URL revoke、close 后过期 playback request 不创建 Blob URL、close 后停止继续调度后续 chunk IPC、chunk read 失败后停止继续调度后续 chunk IPC，以及 unmount 后过期 playback request 不创建 Blob URL。
- Recording audio/transcript UI 由 renderer tests 覆盖：`AudioPlayer` 具名 local playback surface、Reo play/pause control、Radix Slider position control 与 Reo token、`RecordingPlayback` load command 与 local playback surface、`TranscriptReflectionsEditor` 有界 `转写预览`、empty label、no STT copy、`转写`/`反思` controlled draft editor。
- Recording drawer 由 renderer tests 覆盖：Drawer accessible role/name、录音忙碌态阻止 Escape/close、idle 可见 close command、固定 footer 不被编辑内容挤出、close 后重开回到 ready state、Waveform/VoiceButton 渲染、无 agent/cloud/API key/model runtime copy、late failed no-op 和 close blocked helper。Recording overlay tests 覆盖 begin microphone intent 先于 draft create。
- Recording transaction identity 由 renderer 和 main tests 覆盖：finalize 后 editing state 保存 `memoryId`，transcript/reflections autosave、audio manifest 和 audio chunk request 都传 `memoryId + recordingId`；workspace contract 拒绝缺少 `memoryId` 的 finalized read/save/detail request；main finalized read/save 直接解析 nested recording directory，并保留 duplicate finalized `recordingId` guard。
- Recording CSP 由 main tests 覆盖：production policy 必须包含 `media-src 'self' blob:`，且不允许 wildcard media source。
- 操作验证必须覆盖 OS dialog、mic permission、record/pause/resume/stop、playback、save failure、restart/reopen、viewport/reference。
- First product slice 的操作验证证据覆盖 Electron dev runtime：OS folder picker、create/open workspace、light/dark theme、sidebar expanded/covered、Home empty/memory card、recording drawer ready/recording/paused/editing/playback、save failure/recovery、Memory detail、existing-memory append、workspace file truth、reference frame mapping 和未实现能力负向边界。
- 对抗审查有 unresolved BLOCKER/MAJOR 时不得进入 `$writing-plans`、`$plan-eng-review` 或实现阶段。

## 打包与更新验证

- 当前没有 packaging、maker、fuse、signing、notarization、publish 或 updater verification command。
- 引入 packaging 必须同批新增 package/make 验证、packaged app launch evidence、artifact output 检查和 tracked-output exclusion 检查。
- 引入 fuses 或 ASAR integrity 必须同批验证 packaged artifact 的 fuse/ASAR 状态。
- 引入 updater 必须同批验证 update metadata、publish target、signed/notarized installed app、update failure path 和 no-secret logging。
- 没有 packaged app 和 release metadata 前，不创建 updater tests 或 dev update config。

## Vitest 边界

- 当前 Vitest 只服务 renderer/component 行为测试。
- 当前 main process 纯策略测试继续使用 Node test runner。
- 当前 Vitest 配置覆盖 Vite transform、React JSX、jsdom DOM queries 和 Testing Library matchers。
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
- 每个 feature slice 必须显式列出用户可见错误、内部诊断错误、恢复路径和失败时保留的数据。
- 错误处理必须覆盖权限失败、取消、并发、文件缺失、schema 不支持、写入失败和保存失败中与当前 slice 相关的项。

## 可观测性

- 当前不安装 `electron-log` 或 Sentry。
- 没有真实 diagnostic owner 前，不创建 logging subsystem。
- 引入 logging 时，本地诊断使用 `electron-log`。
- 引入 crash/error reporting 时，使用 Sentry。
- 没有 DSN、release/environment、source map upload、privacy/scrubbing 和 sampling 计划前，不初始化 Sentry。
- Renderer error capture、preload logging bridge 或 IPC logging channel 必须在真实 diagnostics slice 中设计，不得先创建 bridge 等 consumer。
- Background work 必须暴露足够状态，用于排查时序和失败。

## 变更门禁

任何 type rules、tests、lint/format hooks、error handling、logging、Sentry、verification commands 改动，都必须更新本文档。

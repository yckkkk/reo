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
- 当前有 `verify:titlebar` 本地视觉测量脚本，用于从截图像素中计算 macOS traffic-light 行、左侧 sidebar hide/show icon、workspace 标题文字和右侧 MemoryRail 折叠 icon 的视觉中心与标题间距；该脚本依赖本机截图和 ImageMagick，不属于 `verify:quick`。
- Better Auth 已选型，但当前未安装。
- Zod 已安装，当前服务 workspace IPC contract、DTO、记忆空间 metadata、segment metadata 和错误信封。
- 当前错误码真源是 `src/workspace-contract/workspace-contract.ts` 的 `workspaceErrorCodeSchema` 和 `workspaceErrorEnvelopeSchema`；renderer 用户可见文案映射位于 `workspaceErrorMessages.ts`。
- TanStack Query、React Hook Form 和 `@hookform/resolvers` 已安装，当前服务 memory space creation form、memory rename form、memory space list 和记忆空间 snapshot cache。
- `class-variance-authority`、`clsx`、`tailwind-merge`、`@radix-ui/react-slot`、`@radix-ui/react-label`、`@radix-ui/react-dialog`、`@radix-ui/react-dropdown-menu`、`@radix-ui/react-tooltip`、`@radix-ui/react-separator`、`primereact`、`vaul` 和 `lucide-react` 已安装，当前服务 Button、Label、Dialog、DropdownMenu、Floating Action Button Speed Dial、Drawer、Textarea、Tooltip、Separator、App shell、recording audio controls 和 icon controls。
- Workspace single-writer lock 使用 `.reo/workspace.lock` no-follow leaf file 和同目录 `.reo/workspace.lock.lock` 目录锁，owner 文件写入 pid 与进程启动指纹，不依赖通用 lock service。
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

- `dev`：运行 `scripts/run-dev.mjs`，加载本机 ignored `.env.local` 后启动 `electron-vite dev --ignoreConfigWarning`。该加载逻辑由 main test 覆盖，已有 shell env 优先于本地 env 文件。
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

`verify:titlebar` 默认读取截图完整宽度的顶部 140px titlebar 区域，将图像像素分组成 traffic-light 色块、左侧 sidebar hide/show icon 色块、workspace 标题文字色块和右侧 MemoryRail 折叠 icon 色块，计算 sidebar hide/show icon 与 traffic-light 行的垂直差值、workspace 标题文字与 sidebar hide/show icon 的水平间距、workspace 标题文字视觉中心与 sidebar hide/show icon 视觉中心的垂直差值，以及右侧 MemoryRail 折叠 icon 视觉中心与 sidebar hide/show icon 视觉中心的垂直差值；默认阈值是 1 个物理像素或 1-2 个 CSS px。截图窗口必须处于 active 状态，确保原生 traffic-light 色块可被识别；截图必须包含完整 Reo 窗口宽度，确保右侧 MemoryRail 折叠 icon 进入测量区域。该命令只作为本地操作验证证据，不替代 `verify:quick`。

没有新鲜验证证据，不得宣称完成。

## 操作验证

- 需要真实桌面操作、OS dialog、Electron runtime、录音、播放、保存、重开或视觉对比的任务，必须使用 Computer Use 验证。
- 操作验证不能替代 TDD、typecheck、lint 或 format。
- 如果 spec 指定 reference segments，验证证据必须说明哪些结构、状态和交互已对照 reference，哪些视觉由 Reo design system 替换。

## 当前质量决策

- 每个行为代码变更必须有独立 spec、RED/GREEN/REFACTOR 证据、`docs/current/*` 更新和 `npm run verify:quick`。
- 每个代码变更在完成前必须执行简化审查：复用已有 helper/component，删除重复逻辑、冗余状态、不必要 JSX wrapper、无价值注释，检查热路径额外工作、事件监听器、timer 和 Blob URL 清理。
- 只读 runtime validation 不伪装成 RED；只有发现行为缺陷并修改代码时，才先写 failing test 或记录可复现失败，再进入 GREEN。
- Codex CLI read-only validation 必须在 Reo quiescent 或记忆空间 closed 状态运行，hash 范围排除 `.reo/workspace.lock*` 和 temp files。
- Renderer source 禁止直接 import Node/Electron API；restricted import 规则必须由测试覆盖。
- Preload source 不得引入 Zod-backed contract 或普通 Node package；preload path 必须指向 `out/preload/index.cjs`。
- Main tests 必须覆盖 workspace file truth、IPC contract、trusted sender、selection token、single-writer lock、stale lock owner 启动指纹、无启动指纹 owner 的 PID 复用判定、filesystem containment、atomic write、metadata schema、index rebuild/recovery、Memory delete/restore move + rollback、recording draft/finalize、unfinished draft audio read 与读取上限、draft audio read/append/finalize 互斥、markdown save、error envelope、lock-lost 行为、豆包 ASR live session、协议 frame、response 解析、错误脱敏、非预期 close 断线报告、初始连接重试、pending start close、录音中断线重连、PCM replay buffer、录音转写 session registry、timestamp offset 和 stale revision 丢弃。
- Renderer tests 必须覆盖 App shell、workspace entry、loaded workspace frame、MemoryRail current-memory selection、MemoryRail rename/delete menu、Memory delete confirmation + restore toast、MemoryRail 折叠时推动中央舞台和 FAB、Memory Studio detail projection、Memory Studio first-viewport glass-vector layout、Segment recording card size/typography/waveform rhythm、Segment strip/timeline/content selection sync、CarouselArrowButton overflow edge visibility、strip-only scroll behavior、reduced-motion instant scroll fallback、finalized Segment playback/transcript view、playback slider `aria-valuetext`/orientation/keyboard seek、playback waveform 从 decoded finalized audio bytes 取真实峰值且不回退固定占位数据、audio Segment 只渲染真实 transcript tab 而不渲染常驻禁用 note/video/photo tab、selected Segment 存在 finalized attachments 时显示 `补充` tab、新增第一条 finalized SegmentAttachment 后自动进入 `补充` tab、补充录音 playback 使用真实 audio bytes、Waveform slider、读取失败可见状态和无 transcript UI、SegmentAttachment menu selected-Segment scope、SegmentAttachment 录音 target 与恢复保存/放弃路径、Memory detail、Segment content 和 SegmentAttachment content Query key ownership、FAB current-memory recording target、FAB structure expansion motion、recording-flow workspace switch guard、busy recording `beforeunload` guard、recording recovery marker save/clear、workspace reopen recovery dialog save/discard/review path、recovered paused review continue/replace path、recording overlay、recording lifecycle、recording pre/active/paused state distinction、paused draft playback cursor sync、cursor/timeline replacement flow、PCM 转写发包、有界 live PCM send queue、live send `accepted:false` backfill、pause 时停止 PCM/level 输入、completion backfill transcript save for empty and failed-final transcripts、backfilled transcript recovery after save failure、recovered draft preview without chunk map、transcript segment focus/scroll sync、no forced post-recording editor、accessibility names、negative capability boundaries 和 Query key ownership。
- Operation validation 必须覆盖 OS dialog、mic permission、record/pause/resume/stop、playback、save failure、restart/reopen、viewport/reference。
- 设计变更的操作验证必须覆盖运行时视觉证据；布局、尺寸、折叠位移、展开态、浅色/深色和交互状态不能只由 class 或单元测试证明。
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
- 每个功能变更必须显式列出用户可见错误、内部诊断错误、恢复路径和失败时保留的数据。
- 错误处理必须覆盖权限失败、取消、并发、文件缺失、schema 不支持、写入失败和保存失败中与当前功能变更相关的项。

## 可观测性

- 当前不安装 `electron-log` 或 Sentry。
- 没有真实 diagnostic owner 前，不创建 logging subsystem。
- 引入 logging 时，本地诊断使用 `electron-log`。
- 引入 crash/error reporting 时，使用 Sentry。
- 没有 DSN、release/environment、source map upload、privacy/scrubbing 和 sampling 计划前，不初始化 Sentry。
- Renderer error capture、preload logging bridge 或 IPC logging channel 必须在真实 diagnostics 能力中设计，不得先创建 bridge 等 consumer。
- Background work 必须暴露足够状态，用于排查时序和失败。

## 变更门禁

任何 type rules、tests、lint/format hooks、error handling、logging、Sentry、verification commands 改动，都必须更新本文档。

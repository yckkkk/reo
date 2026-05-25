# 质量

本文档是类型纪律、测试、静态检查、错误处理和 observability 的当前真源。

## 当前事实

- 当前已有 TypeScript、ESLint、Prettier、Node test runner、Vitest、Testing Library、`npm run verify:quick` 和 `npm run verify:strict`。
- 当前 `test:main` 使用 Node test runner 覆盖 main process 和 preload 纯策略函数。
- 当前 `test:renderer` 使用 Vitest + jsdom + Testing Library 覆盖 renderer/component 行为测试；jsdom 使用 `http://127.0.0.1/` 作为测试 URL，确保 `window.localStorage` 按浏览器同源存储可用；纯 projection/query/state-machine 测试运行在 `renderer-node` project，browser API jsdom `.test.ts` 运行在可并行 `renderer-jsdom-browser` project，React component `.test.tsx` 运行在串行 `renderer-jsdom-components` project。
- 当前 `test/**/*.ts` 由 ESLint 覆盖。
- 当前 `test:main` 使用 Node 脚本清理测试输出目录、编译测试并运行 main process 测试。
- 当前 `typecheck` 分别检查 renderer TypeScript、main process TypeScript 和 preload TypeScript。
- 当前 ESLint 覆盖 renderer、main process、preload、测试、Electron Vite config 和测试脚本；ESLint traversal 忽略 `node_modules`、`out`、`.tmp`、`.agents/skills`、`.claude/skills` 和 `.superpowers`。
- 当前有 `verify:titlebar` 本地视觉测量脚本，用于从截图像素复核 macOS 标题栏关键控件对齐；该脚本依赖本机截图和 ImageMagick，不属于 `verify:quick`。
- 当前有 `verify:memory-studio-layout` Electron runtime 布局测量脚本，用于通过 remote debugging 端口复核 Memory Studio 的 viewport 边界、overflow owner、主列 gutter、Segment strip、timeline、播放区、inline editor、compact rail 和页面滚动。脚本支持 viewport、interaction、sample size 和 full-scan 参数，必须在退出前清理 emulation、scroll 和 resize state；该脚本不属于 `verify:quick`。
- Better Auth 已选型，但当前未安装。
- Zod 已安装，当前服务 workspace IPC contract、DTO、记忆空间 metadata、segment metadata 和错误信封。
- 当前错误码真源是 `src/workspace-contract/workspace-contract.ts` 的 `workspaceErrorCodeSchema` 和 `workspaceErrorEnvelopeSchema`；renderer 用户可见文案映射位于 `workspaceErrorMessages.ts`。
- TanStack Query、React Hook Form 和 `@hookform/resolvers` 已安装，当前服务 memory space creation form、memory rename form、memory space list 和记忆空间 snapshot cache。
- `class-variance-authority`、`clsx`、`tailwind-merge`、`@radix-ui/react-slot`、`@radix-ui/react-label`、`@radix-ui/react-dialog`、`@radix-ui/react-alert-dialog`、`@radix-ui/react-dropdown-menu`、`@radix-ui/react-tooltip`、`@radix-ui/react-separator`、Tiptap React/StarterKit/Markdown/Image、`primereact`、`vaul` 和 `lucide-react` 已安装，当前服务 Button、Label、Dialog、AlertDialog、DropdownMenu、Floating Action Button Speed Dial、Drawer、Textarea、Tooltip、Separator、App shell、lightweight Markdown editor、recording audio controls 和 icon controls。
- Workspace single-writer lock 使用 `.reo/workspace.lock` no-follow leaf file 和同目录 `.reo/workspace.lock.lock` 目录锁，owner 文件写入 pid 与进程启动指纹，不依赖通用 lock service。
- Workspace directory transaction helper 有 focused main tests 覆盖 parent identity replacement、no-replace leaf safety、known-directory file remove safety、known-directory entry read identity、known-directory tree remove identity、empty directory late payload protection 和 unsupported directory fsync code allowlist。
- Note attachment main tests 覆盖 attachment IPC contract、MIME/size gate、owner-bound `attachments/` directory identity、no-follow write/list/read、idempotent same-bytes save、different-bytes collision failure、protocol containment、CSP `img-src reo-attachment:` 和 malformed protocol URL failure。
- Finalized note external edit tests 覆盖 note Segment 和 note SegmentSupplement content read baseline hash、write request baseline 必填、stale body save 返回 `ERR_SEGMENT_CONTENT_STALE` 与当前磁盘正文/hash、renderer edit save 发送 baseline、visibility refresh 下 dirty editor 显示磁盘变化提示且保留 dirty body、clean editor 更新到磁盘正文、same-snapshot body-only 外部修改也触发 content Query refresh、stale save 的 `使用磁盘版本` 重置 body/baseline，以及 `保留我的修改` 使用当前磁盘 baseline 重试。
- Content tab action 和 inline text edit tests 覆盖当前用户可见合同：primary content More 只承载内容槽路径、重命名和清空；Memory 顶层 `新片段` 入口只在 workspace titlebar；finalized 转录、Note 正文和补充内容共用 Tiptap-backed 轻量 Markdown editor surface；stale save、baseline 更新和 toolbar 能力按当前编辑合同验证。
- `electron-log` 已安装，当前只服务 main-owned 本地诊断日志。
- `@ffmpeg-installer/ffmpeg` 已安装，当前只服务 main process finalized audio 补转录的 WebM/Opus 到 OGG/Opus remux；renderer/preload 不引入该依赖。
- 当前 logging owner 是 main process diagnostics；diagnostic event contract 位于 `src/main/diagnostics.ts`，本地 Electron file transport 初始化位于 `src/main/electronDiagnostics.ts`。
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

- TDD 是风险控制，不是仪式；非平凡改动开始前必须先判断是否需要 TDD。
- 新增或改变 public contract、IPC/preload、auth、DB、filesystem、transaction/recovery、security/permission、concurrency、cache/session ownership、跨 session 状态、用户可见 workflow 或已复现高风险回归时，必须真实 TDD。
- 纯文档、机械配置、格式化、重命名、删除死代码、无行为变化的类型收窄、简单文案、简单样式 token 调整或已被现有测试覆盖的小改动可以豁免 TDD，但必须说明原因和替代验证。
- 不得为了满足流程写假 RED、复述实现步骤的测试、无法识别错误实现的测试或只锁 DOM/class 微细节的测试。
- 执行 TDD 时，RED 必须先运行并失败，再开始实现。
- 执行 TDD 时，测试必须基于行为规格，而不是实现细节。
- 执行 TDD 时，覆盖高价值边界和异常：空输入、错误格式、文件缺失、中文字符、并发、取消、权限失败。
- 执行 TDD 时，REFACTOR 后必须重新运行保护该行为的测试。

## 验证

当前基础检查：

```bash
npm run verify:quick
```

`verify:quick` 当前包含 `typecheck:quick`、`test:main`、`test:renderer`、`lint:strict` 和 quick format check。`typecheck:quick` 检查 renderer TypeScript、Electron Vite config 和 Vitest config；main/preload source 由 main test 编译边界覆盖。Focused main test 通过 `MAIN_TEST_FILES` 选择文件，未匹配任何 compiled test file 时必须失败。Renderer Vitest project membership 由配置中的实际 include pattern 判定，React component `.test.tsx` 只归入 component project。

当前严格检查：

```bash
npm run verify:strict
```

`verify:strict` 当前包含 typecheck、`test:main`、`test:renderer`、`lint:strict`、format check 和 `build:app`；`build:app` 不重复运行 typecheck。

当前命令边界：

- `dev`：运行 `scripts/run-dev.mjs`，加载本机 ignored `.env.local` 后启动 `electron-vite dev --ignoreConfigWarning`。该加载逻辑由 main test 覆盖，已有 shell env 优先于本地 env 文件。
- `build`：先运行 `typecheck`，再运行 `build:app`，保持 standalone build 的类型检查边界。
- `build:app`：运行 `electron-vite build --ignoreConfigWarning`，供已完成 typecheck 的严格验证复用。
- `typecheck`：运行 renderer `tsconfig.json` 和 main/preload `tsconfig.main.json`。
- `test:main`：清理 `.tmp/test-main`，使用 `tsconfig.main.test.json` 编译测试，再用 Node test runner 运行编译后的 main/preload 测试；默认以 64 个 test files 为批次运行，`MAIN_TEST_BATCH_SIZE=0` 可显式关闭批处理，传给 `npm run test:main -- ...` 的 Node test 参数会转发给每个批次。
- `test:renderer`：使用 `scripts/run-renderer-tests.mjs` 包裹 Vitest projects 运行 renderer 测试。无显式参数时按 `renderer-node`、`renderer-jsdom-browser`、`renderer-jsdom-components` 顺序运行，避免 full renderer suite 的跨 project 并发污染诊断；传入 `--project`、file filter 或 reporter 参数时保持单次 Vitest 透传。runner 只过滤 Node 当前 `localStorage` backing file 的已知 `ExperimentalWarning`；其它 warning 失败。Projection/query/state-machine 测试归入 Node project；browser-facing 测试归入 jsdom browser project；React component 测试归入 jsdom components project 并串行执行。jsdom setup 提供 DOM matcher、pointer capture、canvas、geometry APIs、`ResizeObserver` 和 localStorage 测试替身，并在每个测试后 cleanup。
- `lint`：运行 `eslint .`，按 `eslint.config.js` 的 flat config 检查 renderer、main process、测试、Electron Vite config、Vitest config 和脚本，并跳过非产品输入目录。
- `lint:strict`：运行 `eslint . --max-warnings=0`，同一 flat config 下把 warning 作为失败。
- `format:check`：运行 quick active-scope Prettier check，覆盖 `AGENTS.md`、`.claude/CLAUDE.md`、`README.md`、配置文件、scripts、src、test、`docs/README.md`、`docs/current`、`docs/decisions`、`docs/initiatives` 和 active `docs/specs`，不扫描 `docs/archive`；必需路径使用严格 Prettier check，只有 optional active `docs/specs` 路径使用 unmatched pattern 容错，允许没有 active spec 时 `docs/specs` 目录不存在；全量格式检查入口是 `format:check:all`。
- `complexity:scan`：通过 repo-local `scripts/run-complexity-scan.mjs` 调用 agent-local `$complexity-optimizer` scanner；默认路径是 `~/.codex/skills/complexity-optimizer/scripts/analyze_complexity.py`，也可以用 `COMPLEXITY_OPTIMIZER_SCANNER` 指向其它 scanner。scanner 缺失时命令必须给出可行动错误；scanner 返回非 0 退出码时 wrapper 必须用同一退出码失败。wrapper 默认排除 `.tmp`、`.agents`、`.claude`、`out` 和归档目录，避免 generated output、技能示例、归档证据和构建产物污染当前复杂度审查；wrapper 参数行为和失败传播由 main test 的 fake scanner 覆盖。

当前本地视觉测量：

```bash
npm run verify:titlebar -- --image /tmp/reo-window.png
npm run verify:titlebar -- --capture -1339,1211,1200,800 --output /tmp/reo-window.png
npm run verify:titlebar:self-test
REMOTE_DEBUGGING_PORT=9233 npm run dev
npm run verify:memory-studio-layout -- --port 9233 --screenshot /tmp/reo-memory-studio.png --metrics /tmp/reo-memory-studio.json
npm run verify:memory-studio-layout -- --port 9233 --viewport 900x720 --interaction none --screenshot /tmp/reo-memory-studio-compact.png --metrics /tmp/reo-memory-studio-compact.json
```

`verify:titlebar` 默认读取截图顶部标题栏区域，测量 macOS traffic-light、sidebar hide/show control、workspace title 和 MemoryRail 折叠 control 的视觉对齐。截图窗口必须处于 active 状态并包含完整 Reo 窗口宽度。该命令只作为本地操作验证证据，不替代 `verify:quick`。

`verify:memory-studio-layout` 需要已启动的 Electron runtime 和可见的 Memory Studio。脚本采集 screenshot/metrics，按有界 Segment 样本验证 stage、Memory Studio、Segment strip、timeline、audio/note content 区、inline editor 和 compact rail 的布局合同；`--full` 才测量全部已挂载 Segment item。脚本必须在 `finally` 中重置 viewport emulation、scroll position 和 resize state。

没有新鲜验证证据，不得宣称完成。

## 操作验证

- 需要真实桌面操作、OS dialog、Electron runtime、录音、播放、保存、重开或视觉对比的任务，必须使用 Computer Use 验证。
- 操作验证不能替代 TDD、typecheck、lint 或 format。
- 如果 spec 指定 reference segments，验证证据必须说明哪些结构、状态和交互已对照 reference，哪些视觉由 Reo design system 替换。

## 当前质量决策

- 每个非平凡代码变更必须先定义验证边界。高风险行为改动必须有独立 spec、真实 RED/GREEN/REFACTOR 证据、必要的 `docs/current/*` 更新和 `npm run verify:quick`。低风险小改动可以不做 TDD，但必须说明豁免理由和替代验证。
- 每个代码变更在完成前必须执行简化审查：复用已有 helper/component，删除重复逻辑、冗余状态、不必要 JSX wrapper、无价值注释，检查热路径额外工作、事件监听器、timer 和 Blob URL 清理。
- 测试只进入长期 suite，当它保护 public contract、安全/权限边界、filesystem containment、transaction/recovery、cache/session ownership、用户可见行为或曾经复现的高风险回归。单个实现分支、临时设计取舍、DOM class 微细节、等价 schema permutation 和重复异常枚举默认留在 spec 证据或删除。
- 同一合同的多组输入输出优先使用 table-driven 测试；相同 setup、相同断言形状、只替换 id/error code/channel 名称的测试不得继续复制成多个独立用例，除非每个用例有不同 failure mode 和不同诊断价值。
- 跨 UI/cache/session 的纯规则必须有独立 renderer 单元测试，覆盖乱序响应、多 pending 状态、外部刷新、session 边界、rollback 和 stale response 防护。
- Memory detail cache reopen 行为必须有 renderer 集成测试覆盖：同一 workspace 重新打开时，已有 Memory detail 投影在新 `readMemoryDetail` pending 期间继续渲染，不显示初始载入态，并确认后台请求使用新的 `workspaceHandle`。
- 只读 runtime validation 不伪装成 RED；只有发现行为缺陷并修改代码时，才先写 failing test 或记录可复现失败，再进入 GREEN。
- Codex CLI read-only validation 必须在 Reo quiescent 或记忆空间 closed 状态运行，hash 范围排除 `.reo/workspace.lock*` 和 temp files。
- Renderer source 禁止直接或动态 import Electron 和所有 Node builtin，包括 bare builtin 与 `node:` 前缀；restricted import 规则必须由测试覆盖。
- Preload source 只允许直接或动态 import `electron`、preload 内部 module，以及当前允许的轻量 contract module；不得引入 Zod-backed contract、Node builtin、main/renderer source 或普通 package；preload path 必须指向 `out/preload/index.cjs`，source crawl 与 lint 边界必须由测试覆盖。
- Main tests 必须覆盖 workspace file truth、IPC contract、trusted sender、selection token、single-writer lock、filesystem containment、atomic write、metadata schema、registry、index rebuild/recovery、entity read/write/delete/restore、recording draft/finalize、markdown save、note attachments、custom protocol、error envelope、lock-lost behavior、diagnostics redaction、voice transcription 和 backfill runtime 的当前合同。
- Renderer tests 必须覆盖当前用户可见行为和 owner 边界，而不是绑定内部 class 串。最小覆盖面包括 App shell、WorkspaceFrame/MemoryRail、Memory Studio selection/content/query ownership、shared UI primitives、实体菜单、危险操作、optimistic update/rollback、session cleanup、content tab ordering、playback、inline text editing、note attachments、recording overlay、voice settings 和 backfill 用户可见状态。
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
- Backfill diagnostics 只能记录 allowlist 字段：durationMs、errorCode、taskCount 和 mode；不得记录 transcript、用户正文、title、root path、file path、raw audio bytes、audio URL、audio.data、base64、digest 或 X-Api-Key。

## 变更门禁

只有当改动改变类型纪律、测试分层、验证命令、lint/format 边界、错误处理模型、logging/observability surface 或当前能力索引时，才更新本文档。单个测试用例、一次性验证日志和任务内 review 结论留在 spec 或 archive。

# Engineering Readiness Gate

状态：blocking implementation

## 结论

First product slice 不能直接进入实现。下一步必须先完成执行前工程设计包。

该 gate 不是扩大产品范围，而是把一个小而完整的产品闭环按正规软件工程方式设计清楚，避免实现阶段把需求、架构、数据、协议、状态和验证临时拼接。

## 权威顺序

- 本文件和后续 design-hardening spec 是进入实现前的当前执行权威。
- Archived design spec 和 archived implementation plan 只作为产品背景、参考素材和历史审查证据；与本文件或 design-hardening spec 冲突时，以当前 active initiative 和 `docs/current/*` 为准。
- 禁止编辑 archived implementation plan。Design-hardening 必须创建 `implementation-plan-reconciliation.md`，记录 archived plan delta、supersession decisions 和 `$writing-plans` 输入；未完成 plan reconciliation 前不得执行 Slice 1。

## 正规工程设计基线

进入实现前，必须完成以下产物。

### 1. Requirements Baseline

必须定义：

- Stakeholders：用户、Reo owner、实现者、QA、未来 AI consumer。
- Operational context：本地 Electron app、本地文件夹、Codex CLI read-only validation。
- Requirement IDs：每个 requirement 必须使用稳定 ID，例如 `FR-*`、`NFR-*`、`ERR-*`、`NG-*`。
- Functional requirements：workspace 创建、文件夹选择、录音、暂停、继续、停止、waveform/progress visualization、mock transcript、编辑 transcript、编辑 reflections、保存、重开、播放。
- Quality attributes：security、local-first durability、recoverability、accessibility、responsiveness、maintainability、testability。
- Non-goals：本 slice 不实现的能力及其不出现于 UI 的规则。
- Traceability：每个 requirement 对应 architecture view、interface contract、data contract、state owner、test 和 validation path。
- Acceptance matrix：每个 requirement 必须有客观验收方式。

### 2. Product And Interaction Design

必须定义：

- Workspace management 页面：first-run、create workspace、open existing workspace、recent/missing workspace、folder conflict、permission failure。
- Workspace 页面：sidebar、main layout、header、record action、Memory Content、recording card、empty/loading/error/reopened states。
- Recording overlay：recording、paused、stopping、editing、playback、saving、save failed、pending close。
- Sidebar decision：必须明确第一版 sidebar 是否显示；如果显示，只显示已实现 navigation，并定义内容、宽度、responsive behavior、keyboard model 和 tests；如果不显示，说明 reference 结构如何被 Reo layout 替代。
- Layout：desktop、narrow desktop、minimum Electron window 的 grid、scroll region、long text behavior。
- Keyboard and focus：dialog focus trap、icon buttons accessible label、tooltip/focus-visible。
- Motion：overlay open/close、record/pause/resume、transcript reveal、autosave status。
- Reference comparison：必须对照 `/Users/yck/Downloads/PM/设计参考/记忆录音/` 和 `/private/tmp/reo-reference-frames/`，只吸收结构、层级和 micro-interactions，视觉服从 Reo design system。
- Reference map：必须逐项映射 reference asset/frame 到 Reo screen、state、interaction、accepted structure、rejected visual 和 verification evidence。
- Accessibility matrix：必须覆盖每个 page/state/component 的 role、name、keyboard path、focus behavior、announcement behavior、reduced-motion fallback、hit target、contrast/focus token 和 test/manual evidence。

### 2.1 External Reference Gate

必须定义：

- Official docs check：通过 Context7 核对 Electron security/preload/IPC、shadcn/ui component ownership、TanStack Query query/mutation/cache ownership，以及任何被 design-hardening 触发的新 foundation。
- Design trend check：使用网络搜索核对当年主流 productivity/local-first/AI-assisted interface 做法，只吸收结构性约束，不追随装饰趋势。
- Open-source reuse check：使用 GitHub 搜索和仓库查看核对 audio recording/transcription、local-first note/workspace、Electron file app 是否有可复用方案。
- Reuse-first decision：所有前端组件、overlay/drawer、audio/media、editor、main process capability、IPC/preload typing、filesystem transaction、file watching、schema validation、state machine、form handling、data fetching、DB/migration、testing/QA、logging/observability 和 packaging/updater 能力必须先评估成熟开源包或官方方案；能满足 Reo security、local-first、design system 和代码精简边界时优先复用。
- ElevenLabs UI check：audio/agent UI 必须优先评估 ElevenLabs UI；至少覆盖 Audio Player、Live Waveform、Waveform、Speech Input、Transcript Viewer、Voice Button，并记录哪些组件可 copy/adapt、哪些因网络/token/agent runtime/demo dependency 被拒绝。
- Drawer check：recording overlay 必须优先评估 Vaul 或 shadcn drawer 的 bottom drawer model，不能自写 modal mechanics。
- Audio engine check：recording、waveform、playback、scrubber 必须评估 wavesurfer.js、ElevenLabs UI 和至少一个其他成熟 audio package。
- Adaptation before self-design：发现现成方案不完全适配时，必须先评估裁剪、retokenize、组合、薄适配或 fork；不能把“不完全适配”直接等同于“自研”。
- Self-design exception：只有裁剪、retokenize、组合、薄适配或 fork 仍不能满足 Electron 安全边界、Reo design system、workspace 文件真源、测试可控性或代码复杂度预算时，才允许自研；必须记录 rejected package、已评估适配路径、拒绝原因、风险和替代设计。
- Obsidian reference boundary：Obsidian 的可借鉴点是 vault 文件夹、普通文件、附件、配置目录和 workspace 管理；不得把 Obsidian 主程序当作可直接复用的开源实现。
- Research log：每个被采纳或拒绝的外部资料必须记录 source、用途、采纳点、拒绝点和对 Reo design system/architecture 的影响。
- Reuse decisions table：`reuse-decisions.md` 必须逐项覆盖 UI primitives、page/overlay primitives、recording controls、waveform/progress、audio playback/editor、transcription mock seam、IPC/preload typing、filesystem atomic write、file watching、schema validation、state machine、form/schema、data fetching、DB/migration、testing/QA、logging/observability、packaging/updater；每行必须包含 capability、candidates、adopt/adapt/compose/fork/self-design decision、adaptation paths considered、reason、risks、tests、owner。`self-design` 只能作为最后手段。
- Table ownership：`reuse-decisions.md` 是开源/官方方案取舍真源；component extraction table 和 code-simplicity abstraction table 必须引用它的 capability id，不能复制一份会漂移的取舍结论。

### 2.2 Component And Layout Design

必须定义：

- Page/component tree：workspace management、workspace home、recording overlay 的组件树。
- Layout primitives：first-run shell、sidebar、main shell、header、content region、overlay shell、scroll region、list/grid。
- UI primitives：button、icon button、dialog、tooltip、textarea、label、card/panel 的来源、Reo token mapping 和 accessibility invariant。
- Workspace management components：first-run shell、create workspace form、folder picker row、recent/missing workspace row、conflict notice、permission failure notice、submit/status/error surfaces。
- Feature components：workspace card、recording card、recording controls、waveform/progress visualization、transcript editor、reflections editor、autosave status。
- Large component reuse：recording controls、waveform/progress、audio playback/editor、bottom drawer、transcript viewer、speech input 这类大组件不得凭感觉自写；必须先评估开源组件或底层库，再决定 compose、adapt、fork 或自研。
- Component props/events：每个 feature component 的输入、输出、state owner 和 error display。
- Reuse boundary：哪些组件是 reusable primitives，哪些是 feature-local；复用必须有真实 consumer 或 shared invariant。
- Component extraction table：每个候选组件必须标记 `extract` 或 `inline`，并写明真实 consumer、invariant、props/events、test owner 和不抽象理由。
- Simplification review：是否存在过深组件树、重复 class、重复 derived state、无意义 wrapper、一次性 abstraction。

### 3. Architecture Views

必须定义：

- Module view：renderer feature modules、preload bridge、main IPC handlers、filesystem contract modules、tests。
- Module inventory table：每个 module 必须列出 name、capability、owned IPC channels、owned files on disk、owned lifecycle states、tests；renderer feature modules 和 main process modules 都必须列出。
- Component-and-connector view：renderer -> preload -> IPC -> main -> filesystem 的 runtime connector。
- Allocation view：每个 module 落在哪个 process、哪个目录、哪个 test layer。
- Interface view：preload API、IPC channels、DTO、error envelope、permission model。
- Behavior view：workspace lifecycle、recording lifecycle、autosave lifecycle、playback lifecycle、recovery lifecycle。
- Cross-view mapping：每个 requirement 映射到 module、runtime connector、data contract 和 test。

### 4. Data Design

必须定义：

- Conceptual entities：Workspace、WorkspaceIndex、WorkspaceEntry、Recording、RecordingDraft、AudioArtifact、TranscriptDocument、ReflectionDocument、AutosaveState。
- Relationships：workspace to entries、entry to recording、recording to files、draft to final recording、index to rebuildable scan。
- Cardinality：每个 workspace 多个 recordings；每个 recording 一个 audio、一个 transcript、一个 reflections、一个 metadata。
- Ownership：workspace folder 是用户内容真源；`.reo/index.json` 是可重建索引；DB 只能是索引/关系/查询/状态层。
- Durable file schema：`workspace.json`、`index.json`、`recording.json` 字段、版本、兼容规则、unsupported schema behavior。
- Durable artifact design：audio、transcript、reflections、JSON metadata 都必须定义 format、encoding、可重建性、size/length pressure、failure retention 和 recovery。
- Physical DB decision：本 slice 默认不建立 Drizzle schema；如果后续设计证明 recent workspace、多 workspace query、search、large index、conflict recovery 或 auth/session 需要 DB，必须先写 DB schema spec。
- Query key design：如果使用 TanStack Query，必须定义 exact query key factories、mutation keys、invalidation、pending/error state、rollback；不得沿用 archived plan 中未审查的示例。
- Data fetching：workspace/detail/main-backed async data 是否使用 TanStack Query 必须由 design-hardening 逐项证明真实 consumer；recording in-progress state 不进入 TanStack Query。
- Data flow：每个 read/write 的 caller、owner、source of truth、cache owner、mutation、invalidation、rollback 和 recovery。
- Field design：每个 durable JSON field 的语义、类型、是否用户可改、是否可重建、失败时保留策略。
- Filesystem transaction table：workspace init、index rebuild、draft create、audio append、finalize、discard、transcript save、reflections save、recovery scan 必须定义 atomic temp/rename、file fsync、parent directory fsync、multi-file ordering、crash window、idempotency、cross-process lock、multi-window detection、single-writer rule、stale partial cleanup 和 recovery。

### 5. Protocol And Boundary Design

必须定义：

- Preload public API：只暴露 product methods，不暴露 generic invoke/send。
- IPC channels：每个 channel 的 owner、payload、result、error、timeout、cancellation、sender validation。
- Protocol matrix：每个 requirement 必须映射到 preload method、IPC channel、request DTO、response DTO、error codes、timeout/cancel behavior、sender validation、permission effect、state/query owner 和 tests；不能只描述已选择的 channel。
- Zod schema：用于 IPC、workspace metadata、recording metadata 和 form submit boundary。
- Error envelope：用户可见 message、internal diagnostic cause、recoverability、retry hint、data retention。
- Permission model：folder access、microphone permission、media type restriction、navigation/window open policy。
- Concurrency：recording append sequence、finalize while append pending、duplicate stop、save while close、stale `.part` recovery。
- Backend/main design：main process 模块只按真实 capability 拆分；不得创建 generic backend/service bucket。
- IPC simplicity：helper 只能提取真实共享协议不变量，不能隐藏 channel 的产品语义。
- Security threat model：必须使用 STRIDE-by-asset 矩阵，资产至少包括 workspace folder、IPC channel、preload bridge、custom protocol、renderer window、audio artifact、metadata files。威胁至少包括 path traversal、symlink escape、sender spoofing、folder overwrite、large-file DoS、JSON size/parse failure、media permission、CSP/media-src、custom protocol、Blob URL、navigation/window-open、shell/openExternal 和用户文件保护。每行必须包含 asset、trust boundary、threat、attack path、mitigation/prevention、detection/recovery、negative test 或 manual verification、owner、residual risk；不能只列威胁名称。

### 6. State And Lifecycle Design

必须定义：

- Workspace lifecycle：none、creating、ready、missing、conflict、unsupported、failed。
- Workspace creation form lifecycle：idle、folder selecting、validating、submitting、submitted、failed、canceled。
- Recording lifecycle：idle、acquiring、recording、paused、stopping、editing、failed。
- Audio chunk lifecycle：chunk produced、append pending、append committed、append failed、finalized。
- Autosave lifecycle：dirty、saving、saved、failed、retrying。
- Playback lifecycle：loading audio、ready、playing、paused、failed、blob revoked。
- Recovery lifecycle：restart scan、stale draft classification、index rebuild、corrupt metadata handling。
- State ownership matrix：rows 是每个状态事实，columns 是 component state、feature reducer、React Hook Form、TanStack Query、workspace file、`.reo` metadata、SQLite；每行只能有一个 source-of-truth owner。
- 本 slice 不引入 SQLite 时，state ownership matrix 的 SQLite column 必须为空；任何非空项都触发 DB schema decision。
- Redundancy check：同一事实是否被重复存储；如果必须重复，source of truth 和同步方向是什么。

### 7. Foundation Activation Matrix

| Foundation               | 是否在 first product slice 建立 | 判断                                                                                                     |
| ------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Vitest                   | 是                              | Renderer TSX、DOM interaction、autosave UI 和 recording overlay 需要行为测试。                           |
| preload                  | 是                              | Renderer 需要选择文件夹、读写 workspace 和读取音频。                                                     |
| IPC                      | 是                              | 每个 workspace/recording 特权能力都需要显式 main boundary。                                              |
| Zod                      | 是                              | IPC payload、metadata、form submit 都是不可信边界。                                                      |
| TanStack Query           | 待逐项证明                      | 只有 main-backed async data consumer、query key、mutation 和 invalidation 明确后才建立。                 |
| React Hook Form          | 是                              | Workspace creation 是真实 form submit/error lifecycle。                                                  |
| shadcn/ui + Radix        | 待逐项证明                      | 必须列出 exact primitive、business component consumer、shared invariant、slice 和 tests，才允许初始化。  |
| lucide                   | 待逐项证明                      | 必须列出 icon name、对应 icon-only control、accessible label 和 slice，才允许安装或使用。                |
| Zustand                  | 否                              | 当前状态优先由 component state、feature reducer、RHF 和 query cache 覆盖；没有跨 subtree client owner。  |
| Drizzle + better-sqlite3 | 否                              | 本 slice 的用户内容真源是 workspace files；没有证明关系查询、搜索、auth tables 或 large index pressure。 |
| Better Auth              | 否                              | 本地 recording-first 闭环没有账号、session、remote service 或 sharing。                                  |
| electron-log             | 否                              | 需要 error envelope 和 local diagnostics 设计，但不先建立 logging subsystem。                            |
| Sentry                   | 否                              | 未发布本地产品没有 DSN、release、privacy、source map 和 external error owner。                           |
| Electron Forge           | 否                              | 本 slice 验证不要求 distributable artifact。                                                             |
| electron-updater         | 否                              | 没有 signed packaged app、release metadata 和 publish channel。                                          |
| date-fns                 | 否                              | 第一版可用明确 native local formatting；复杂日期需求出现后再引入。                                       |

### 8. QA And Validation Design

必须定义：

- TDD slice：RED、GREEN、REFACTOR、verification、commit。
- Test layers：main pure/file tests、renderer component tests、IPC contract tests、Electron runtime checks、manual operation validation。
- Operation validation：需要真实点击、输入、OS dialog、录音、播放、保存、重开或视觉对比时，必须使用 Computer Use 操作验证。
- Codex CLI read-only validation 属于 QA validation，不属于 security threat；必须验证 workspace `AGENTS.md` 和普通文件可读。
- Reference validation：UI/interaction 验证必须对照 reference assets，记录哪些结构被采用，哪些视觉被 Reo design system 替换。
- Regression matrix：security、data loss、filesystem corruption、permission denial、long text、long recording、save failure、reopen recovery。
- Review exit：`review.md` 必须记录独立对抗审查结果；存在 unresolved BLOCKER 或 MAJOR 时不得归档 spec、不得进入 Slice 1。

### 9. Code Simplicity Design

必须定义可审查表格：

- Forbidden abstractions：禁止的空桶和空 wrapper，例如 generic `services/`、generic IPC helper、generic `BaseCard`、generic `useApi`、单文件 `helpers.ts` 或 `types.ts` 总线。
- Forbidden shortcuts：不得因精简省略 sender validation、DTO schemas、path containment、atomic writes、recovery tests、state ownership、accessibility 和 error envelope。
- Abstraction decision table：每个候选 abstraction 标记 `extract` 或 `inline`，列出真实 consumer、shared invariant、tests 和拒绝提前抽象的理由。
- Component and module budget：必须给出具体数字，例如组件树深度、wrapper-only components、state stores、IPC helpers、main modules 的上限；没有数字视为未完成。
- Duplication decision：哪些重复必须保留以保持可读性，哪些重复必须通过 primitive、variant、schema 或 reducer 消除。
- Tool-enforced rules：TypeScript、ESLint、Prettier。
- Review-enforced rules：Tailwind token、Reo design system、component extraction、state ownership、filesystem transaction 和 accessibility。
- Audio artifact budget：必须定义 container、codec、Blob URL support、cross-platform playback constraint 和 Codex-readable metadata。

## 实施前阻断规则

执行 Slice 1 前，必须创建并完成一个 design-hardening spec，至少包含：

- `requirements.md`
- `traceability-matrix.md`
- `ui-blueprint.md`
- `reference-map.md`
- `external-research.md`
- `reuse-decisions.md`
- `accessibility-matrix.md`
- `architecture-views.md`
- `data-contracts.md`
- `filesystem-transactions.md`
- `protocol-contracts.md`
- `security-threat-model.md`
- `state-machines.md`
- `qa-matrix.md`
- `foundation-decisions.md`
- `code-simplicity.md`
- `implementation-plan-reconciliation.md`
- `new-session-handoff.md`
- `review.md`
- `verification.md`

`implementation-plan-reconciliation.md` 只记录 archived implementation plan 的 delta、supersession 和 `$writing-plans` 输入，不是可执行计划本体。Design-hardening gate 通过后，必须另行使用 `$writing-plans` 产出 reconciled implementation plan，并用 `$plan-eng-review` 审查。

该 spec 未完成时留在 `docs/specs/*`。完成后，跨 session 工作进度回写 initiative；稳定的实体、关系、IPC 契约、durable schema、state ownership matrix、security boundary、verification rules 必须回写 `docs/current/*` 或 `docs/decisions/*`，否则 spec 不得归档。`review.md` 必须记录审查者类型、审查方式和所有 BLOCKER/MAJOR 的处理结果。

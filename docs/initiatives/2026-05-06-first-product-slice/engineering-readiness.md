# Engineering Readiness Gate

状态：blocking implementation

## 结论

First product slice 不能直接进入实现。下一步必须先完成执行前工程设计包。

该 gate 不是扩大产品范围，而是把一个小而完整的产品闭环按正规软件工程方式设计清楚，避免实现阶段把需求、架构、数据、协议、状态和验证临时拼接。

## 正规工程设计基线

进入实现前，必须完成以下产物。

### 1. Requirements Baseline

必须定义：

- Stakeholders：用户、Reo owner、实现者、QA、未来 AI consumer。
- Operational context：本地 Electron app、本地文件夹、Codex CLI read-only validation。
- Functional requirements：workspace 创建、文件夹选择、录音、暂停、继续、停止、mock transcript、编辑 transcript、编辑 reflections、保存、重开、播放。
- Quality attributes：security、local-first durability、recoverability、accessibility、responsiveness、maintainability、testability。
- Non-goals：本 slice 不实现的能力及其不出现于 UI 的规则。
- Traceability：每个 requirement 对应 UI state、data contract、test 和 validation path。
- Acceptance matrix：每个 requirement 必须有客观验收方式。

### 2. Product And Interaction Design

必须定义：

- Workspace management 页面：first-run、create workspace、open existing workspace、recent/missing workspace、folder conflict、permission failure。
- Workspace 页面：sidebar、main layout、header、record action、Memory Content、recording card、empty/loading/error/reopened states。
- Recording overlay：recording、paused、stopping、editing、playback、saving、save failed、pending close。
- Sidebar：第一版只显示已实现 navigation；不可显示未实现能力。
- Layout：desktop、narrow desktop、minimum Electron window 的 grid、scroll region、long text behavior。
- Keyboard and focus：dialog focus trap、icon buttons accessible label、tooltip/focus-visible。
- Motion：overlay open/close、record/pause/resume、transcript reveal、autosave status。
- Reference comparison：必须对照 `/Users/yck/Downloads/PM/设计参考/记忆录音/` 和 `/private/tmp/reo-reference-frames/`，只吸收结构、层级和 micro-interactions，视觉服从 Reo design system。

### 3. Architecture Views

必须定义：

- Module view：renderer feature modules、preload bridge、main IPC handlers、filesystem contract modules、tests。
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
- Physical DB decision：本 slice 默认不建立 Drizzle schema；如果后续设计证明 recent workspace、多 workspace query、search、large index、conflict recovery 或 auth/session 需要 DB，必须先写 DB schema spec。
- Data fetching：workspace/detail/main-backed async data 使用 TanStack Query；recording in-progress state 不进入 TanStack Query。

### 5. Protocol And Boundary Design

必须定义：

- Preload public API：只暴露 product methods，不暴露 generic invoke/send。
- IPC channels：每个 channel 的 owner、payload、result、error、timeout、cancellation、sender validation。
- Zod schema：用于 IPC、workspace metadata、recording metadata 和 form submit boundary。
- Error envelope：用户可见 message、internal diagnostic cause、recoverability、retry hint、data retention。
- Permission model：folder access、microphone permission、media type restriction、navigation/window open policy。
- Concurrency：recording append sequence、finalize while append pending、duplicate stop、save while close、stale `.part` recovery。

### 6. State And Lifecycle Design

必须定义：

- Workspace lifecycle：none、creating、ready、missing、conflict、unsupported、failed。
- Workspace creation form lifecycle：idle、folder selecting、validating、submitting、submitted、failed、canceled。
- Recording lifecycle：idle、acquiring、recording、paused、stopping、editing、failed。
- Audio chunk lifecycle：chunk produced、append pending、append committed、append failed、finalized。
- Autosave lifecycle：dirty、saving、saved、failed、retrying。
- Playback lifecycle：loading audio、ready、playing、paused、failed、blob revoked。
- Recovery lifecycle：restart scan、stale draft classification、index rebuild、corrupt metadata handling。

### 7. Foundation Activation Matrix

| Foundation               | 是否在 first product slice 建立 | 判断                                                                                                     |
| ------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Vitest                   | 是                              | Renderer TSX、DOM interaction、autosave UI 和 recording overlay 需要行为测试。                           |
| preload                  | 是                              | Renderer 需要选择文件夹、读写 workspace 和读取音频。                                                     |
| IPC                      | 是                              | 每个 workspace/recording 特权能力都需要显式 main boundary。                                              |
| Zod                      | 是                              | IPC payload、metadata、form submit 都是不可信边界。                                                      |
| TanStack Query           | 是                              | Workspace list/detail/recording detail 是 main-backed async data。                                       |
| React Hook Form          | 是                              | Workspace creation 是真实 form submit/error lifecycle。                                                  |
| shadcn/ui + Radix        | 是                              | Dialog、tooltip、button、textarea、label 是真实 accessible primitive consumer。                          |
| lucide                   | 是                              | Icon-only controls 不得使用 emoji。                                                                      |
| Zustand                  | 否                              | 当前状态可由 component state、reducers 和 TanStack Query 覆盖；没有跨 subtree client-state owner。       |
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
- Reference validation：UI/interaction 验证必须对照 reference assets，记录哪些结构被采用，哪些视觉被 Reo design system 替换。
- Regression matrix：security、data loss、filesystem corruption、permission denial、long text、long recording、save failure、reopen recovery。

## 实施前阻断规则

执行 Slice 1 前，必须创建并完成一个 design-hardening spec，至少包含：

- `requirements.md`
- `ui-blueprint.md`
- `architecture-views.md`
- `data-contracts.md`
- `protocol-contracts.md`
- `state-machines.md`
- `qa-matrix.md`
- `foundation-decisions.md`
- `new-session-handoff.md`

该 spec 未完成时留在 `docs/specs/*`。完成后，其长期结论压缩到本 initiative 或 `docs/current/*`，再归档。

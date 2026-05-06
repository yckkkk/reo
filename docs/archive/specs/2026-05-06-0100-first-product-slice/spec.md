# First Product Slice Spec

## 审查结论

采用 **Filesystem-First Product Slice**。

Reo 的第一个真实产品闭环不是 demo UI，也不是泛 agent 平台。第一版只做记录：用户创建一个本地 memory workspace，进入 workspace 后录音，录音期间看到实时 mock transcription，停止后得到可编辑 transcript 与可编辑 reflections，并能再次打开同一 recording 播放原始录音、继续编辑 transcript 与 reflections。

这个 slice 已经证明真实 foundation consumer：

- Electron 文件夹选择、文件写入和权限边界。
- Media recording 状态机。
- Workspace 文件系统契约。
- Autosave 与恢复。
- Renderer 行为测试能力。

它不证明以下能力必须立即引入：

- 内置 agent runtime。
- film generation。
- shadcn/ui。
- 通用 IPC bridge。
- 通用 service layer。
- 全局 DB 平台。
- logging / Sentry / packaging / updater。

## 产品方向

Reo 的长期产品方向是本地优先的 memory workspace。

Memory workspace 是用户自己选择的本地文件夹。它可以是一门课、一本书的笔记、一次生活经历、一个生日派对、一个领域感悟或任何用户定义的记忆主题。Workspace 可以包含录音、视频、笔记、图片和任意文件；Reo 第一版只产品化录音记录，但不限制 workspace 文件夹承载其他文件。

Workspace 文件夹是真实产物源。Reo 可以使用 DB 作为索引、关系、查询和处理状态层，但用户记忆内容不能只藏在 DB 里。Codex CLI 或未来内置 AI 应该能直接进入 workspace folder，通过 `AGENTS.md` 和普通文件理解这个 workspace。

长期架构决策记录在 `docs/decisions/0003-local-memory-workspace.md`。

## PM

### 用户

第一版用户是需要快速记录自己记忆、想法和感悟的本地优先用户。当前验证用户是 Reo 的 owner：使用 Reo 创建 memory workspace，并使用 Codex CLI 验证 AI 是否能读取 workspace 文件、理解记录语境并做后续整理。

### 问题

用户有很多临时想法、生活记忆、学习感悟和素材，但普通录音工具只保存音频，笔记工具又无法把录音、转写、reflection 和未来 AI 协作放在一个可读工作区里。

### 目标

用户能在一个 memory workspace 中完成一次 voice memory capture：

1. 选择一个本地文件夹创建 workspace。
2. Reo 初始化 workspace metadata 与 `AGENTS.md`。
3. 用户点击录音。
4. Reo 显示录音状态、计时、暂停/继续/停止和实时 mock transcript。
5. 停止后 Reo 保存原始音频、transcript 和 reflections 文件。
6. 用户编辑 transcript 与 reflections，修改自动保存。
7. 用户关闭并重新打开 recording 后，能播放原始录音并继续编辑。
8. Codex CLI 进入 workspace 后，可以通过 `AGENTS.md` 和普通文件理解该 workspace。

### 非目标

- 不做真实 speech-to-text 服务接入。
- 不做 film generation。
- 不做图片、视频、任意文件 UI 支持。
- 不做内置 AI。
- 不做跨设备同步。
- 不做 workspace 搜索。
- 不做模板系统。
- 不做 workspace sharing。
- 不做发布、updater、Sentry 或 packaging。

### 成功标准

- 用户可以从空 Reo 创建一个 workspace，并在自己选择的文件夹内看到 `AGENTS.md` 和 `.reo/workspace.json`。
- 用户可以录音、暂停、继续、停止。
- Live transcript 在录音过程中按时间逐句出现；暂停时停止增长，继续时恢复增长。
- 停止后 recording entry 出现在 workspace 首页的 `Memory Content`。
- Recording detail overlay 可播放原始录音。
- Transcript 与 reflections 是两个独立可编辑区域。
- Transcript 与 reflections 自动保存，并分别显示保存状态。
- 重新打开 workspace 和 recording 后，音频、transcript、reflections 和 entry metadata 可恢复。
- 选择已有 `AGENTS.md` 的文件夹时，Reo 不覆盖，提示用户选择其他文件夹或手动处理。
- Codex CLI 在 workspace folder 中能读取 `AGENTS.md` 并定位 recording 文件。

## Product Design

### 用户旅程

1. 用户启动 Reo。
2. 用户点击创建 workspace。
3. 用户输入 workspace 标题，描述可选。
4. 用户选择本地文件夹。
5. Reo 初始化 workspace。
6. 用户进入 workspace 首页。
7. 空态只显示 `Memory Content` 和录音入口。
8. 用户点击录音入口，打开 large bottom sheet overlay。
9. 用户录音，看到波形、计时、live transcript、暂停/继续/停止。
10. 用户停止录音，overlay 切换到编辑状态。
11. 用户编辑 transcript 与 reflections。
12. 用户关闭 overlay 回到 workspace 首页。
13. 用户点击 recording entry，再次打开 overlay 播放和编辑。

### 信息架构

```text
Workspace Home
  Header
    Workspace title
    Workspace date / optional description
    Record action
  Memory Content
    Empty state
    Recording entries

Recording Overlay
  Recording title
  Waveform / playback
  Timer / status
  Transcript editor
  Reflections editor
  Save status
```

第一版不显示 `Films` section。第一版 action row 只显示录音入口。

### 主要界面

Workspace 首页参考用户提供的 `My seventh birthday` 页面结构，但视觉必须服从 Reo 设计系统：Eggshell 页面、Obsidian 主文字、Chalk 细边界、Gravel/Slate 辅助文字、Signal Blue/Ember 仅作小型状态点或 avatar 点缀、Waldenburg/Inter 字体系统、轻 shadow。

Recording detail 使用 large bottom sheet / modal overlay，背景 workspace 模糊。Overlay 表达用户仍在同一个 workspace 中，但当前聚焦这条 voice memory。

### 设计质量标准

第一版是 first product slice，不是最低成本 MVP。范围可以小，但体验必须完整、克制、可交付。

设计系统运用要求：

- 所有 surface、文字、边界、状态点、按钮和输入区必须使用 Reo 当前 design-system token，不复制参考图的粉色按钮、灰白卡片比例或装饰性模糊风格。
- Workspace home 要保持 type-first、surface-light 的 Reo 气质，而不是堆叠卡片。
- Recording overlay 必须像产品级录音界面，不是调试面板：波形、计时、状态、控制按钮、transcript、reflections 和保存状态都要有明确层级。
- Micro-interactions 是第一版质量的一部分：录音按钮 hover/active、pause/resume 状态切换、live transcript 逐句出现、overlay open/close、autosave saving/saved/failed 都要设计。
- 所有文本必须在 desktop 和窄窗口中不溢出，长 workspace title、长 recording title、长 transcript/reflections 都要有布局策略。
- Icon-only actions 必须有 hover tooltip 或 accessible label。
- Empty、recording、paused、stopping、editing、saving、failed、reopened states 都要在设计中覆盖。
- 第一版只显示已实现能力；不通过 disabled controls 暗示未实现的 photo/video/file/film 功能。

### 状态

- Empty workspace：`Memory Content` 空态，引导开始录音。
- Recording：计时增长、波形活动、transcript 增长。
- Paused：计时停止、波形和 transcript 停止，显示 resume action。
- Resumed：计时和 transcript 继续。
- Stopping：停止中，避免重复点击。
- Editing：音频可播放，transcript 与 reflections 可编辑。
- Saving：对应编辑区显示保存中。
- Saved：对应编辑区显示已保存。
- Save failed：对应编辑区显示失败、保留本地编辑内容、允许重试。
- Workspace conflict：已有 `AGENTS.md` 时阻止初始化。
- Workspace missing：打开 recent workspace 但文件夹不存在时，提示重新定位或移除索引。

## Engineering

### 技术栈对齐

First product slice 必须服从 Reo 已确认技术路线：

- React 19 + TypeScript。
- Vite through `electron-vite`。
- Tailwind CSS v4。
- shadcn/ui。
- Zustand + TanStack Query。
- React Hook Form + Zod。
- Better Auth with Electron support。
- Drizzle ORM + `better-sqlite3`。
- `electron-updater`。
- `date-fns`。
- Sentry + `electron-log`。
- Electron Forge。
- Vitest。

不偏离架构不等于一次性启用全部依赖。当前 slice 要按这套路线判断真实 consumer：

- UI 使用 React 19、TypeScript、electron-vite、Tailwind v4 和 Reo design-system token。
- 可复用组件如果出现真实 consumer，再按 Reo gate 引入 shadcn/ui。
- 跨 subtree client state 如果出现真实 owner，再引入 Zustand。
- Main-backed async data 如果出现真实 query/invalidation pressure，再引入 TanStack Query。
- 表单提交、draft 和 runtime validation 如果出现真实 owner，再引入 React Hook Form + Zod。
- DB schema、关系和 migration 如果必须支撑 first slice，再按 Drizzle + `better-sqlite3` 设计；否则保持 filesystem-first。
- Renderer/component 行为测试如果现有 Node runner 不足，再按 Vitest gate 引入。
- Auth、updater、Sentry、electron-log、Forge 不属于 recording-first slice 的当前 consumer，不在本 slice 启用。

### Stage 0 Foundation Design

本 slice 先设计被产品真实消费的 foundation，不创建泛基础。

必须设计：

- Electron file workspace foundation。
- Media recording foundation。
- Workspace filesystem contract。
- Autosave 和恢复。
- Slice-specific error handling。
- Renderer 行为测试策略。

暂不默认设计：

- shadcn/ui foundation。
- generic IPC bridge。
- generic service layer。
- full DB platform。
- logging/Sentry。
- packaging/updater。

### Workspace Filesystem Contract

推荐结构：

```text
<workspace>/
  AGENTS.md
  .reo/
    workspace.json
    index.json
  recordings/
    <recording-id>/
      audio.webm
      transcript.md
      reflections.md
      recording.json
```

规则：

- `AGENTS.md` 位于 workspace root，供 Codex CLI 自动读取。
- `.reo/workspace.json` 是 Reo workspace metadata。
- `.reo/index.json` 是可重建索引，不是用户记忆真源。
- `recordings/<recording-id>/` 保存单条 recording 的所有普通文件。
- 第一版只创建 `.reo/` 和 `recordings/` 等有真实 consumer 的路径，不创建 notes/photos/videos/files 占位目录。
- 用户可以把任意文件放入 workspace folder；Reo 第一版不移动、不索引、不产品化这些任意文件。
- `recording-id` 使用稳定 id，不依赖用户可改标题。
- 用户可改 recording title，但不重命名 recording folder。
- 用户已有文件不被移动、不被覆盖。
- 选择已有 `AGENTS.md` 的文件夹时初始化失败。
- 选择已有 `.reo/workspace.json` 的文件夹时按 existing workspace 打开。

### `AGENTS.md` Contract

Workspace-level `AGENTS.md` 必须写清：

- 这是 Reo memory workspace。
- Workspace title 和可选描述。
- Reo 管理的目录：`.reo/`、`recordings/`。
- Recording 文件语义：`audio.webm` 是原始录音，`transcript.md` 是用户可修正的转写，`reflections.md` 是用户补充感悟，`recording.json` 是 recording metadata。
- AI 可以读取、总结、提出整理建议。
- AI 不得删除或覆盖原始音频。
- AI 不得改写 transcript/reflections，除非用户明确要求。

### Data Model

产品实体：

- `Workspace`
  - id
  - title
  - optional description
  - root path
  - created at
  - updated at
  - schema version
- `WorkspaceEntry`
  - id
  - workspace id
  - type: recording
  - title
  - created at
  - updated at
  - path refs
- `Recording`
  - entry id
  - duration
  - status
  - audio file path
  - transcript file path
  - reflections file path
  - recording metadata path
- `EditableDocumentState`
  - target: transcript or reflections
  - save status
  - last saved at
  - last error

第一版推荐不引入 SQLite，采用 `.reo/workspace.json` + `.reo/index.json` + filesystem scan。SQLite 是下一步 pressure：当 recent workspaces、搜索、多 workspace query、large workspace performance 或 conflict recovery 证明 JSON/file scan 不足时再引入。

### Data Fetching

第一版没有 main/server-backed remote data，不引入 TanStack Query。Renderer 通过窄 preload/IPC 调用 main process 的 workspace capability。Main process 返回明确 DTO。Renderer local state 管理当前 recording overlay、编辑状态和 save indicator。

### Electron Boundary

Renderer 不能直接访问 Node 或 Electron API。

需要窄 preload/IPC capability：

- 选择 workspace directory。
- 初始化 workspace。
- 打开 existing workspace。
- 保存 recording artifact。
- 写 transcript。
- 写 reflections。
- 读取 workspace index。
- 读取 recording detail。

禁止：

- 暴露 `ipcRenderer`。
- 暴露 `fs`。
- 暴露 generic `send(channel, payload)`。
- 暴露 generic file write API。

每个 IPC 必须在 implementation plan 中定义 owner、contract、runtime validation、sender validation、错误语义和测试。

### Media Recording

Renderer 使用 Web MediaRecorder 类能力录音。第一版 transcription 是 mock：固定示例文本按时间逐句出现。Mock 只替代 speech-to-text，不替代录音状态机、文件保存、autosave、恢复和错误测试。

状态机：

```text
idle -> recording -> paused -> recording -> stopping -> editing
idle -> failed
recording -> failed
paused -> failed
stopping -> failed
editing -> saving -> saved
editing -> save_failed
```

录音不设置产品时长上限。实现必须有安全护栏：磁盘空间、异常停止、长录音内存策略、停止中重复点击、关闭 overlay 前保存状态。

### Autosave

Transcript 与 reflections 分开保存、分开显示状态、分开失败处理。

Autosave 规则：

- 停止录音后 transcript 立即保存。
- 用户编辑 transcript 时 debounce 保存。
- 用户编辑 reflections 时 debounce 保存。
- 关闭 overlay 时不弹保存确认，除非存在保存失败或未写入内容。
- 保存失败时保留 renderer 当前编辑内容，并允许重试。

### Component Boundary

第一版不初始化 shadcn/ui。原因：当前仍可以使用 Reo tokens 和 feature-local focused components 完成 workspace home、recording overlay、recording card 和 editor surfaces。只有后续出现两个以上真实 reusable consumers，或需要 Radix accessible primitive 承载明确交互 invariant 时，再评估 shadcn/ui。

### Error Handling

错误必须具体、可行动：

- Folder permission denied。
- Existing `AGENTS.md` conflict。
- Existing `.reo/workspace.json` schema unsupported。
- Workspace path missing。
- Audio permission denied。
- Recording start/pause/resume/stop failure。
- Audio write failure。
- Transcript save failure。
- Reflections save failure。
- Corrupt recording metadata。

不创建通用 error taxonomy。

## QA/Test

### TDD 切片

Implementation 必须用真实 TDD。建议切片：

1. Workspace path validation：已有 `AGENTS.md` 时 RED，阻止覆盖。
2. Workspace initialization：生成 `.reo/workspace.json`、`AGENTS.md` 和基础目录。
3. Existing workspace open：已有 `.reo/workspace.json` 时读取而不是重复初始化。
4. Recording state reducer：start/pause/resume/stop 的状态转移。
5. Mock transcript ticker：recording 时增长，paused 时停止，resumed 时继续。
6. Recording artifact writer：写 `audio.webm`、`transcript.md`、`reflections.md`、`recording.json`。
7. Autosave transcript：失败时保留未保存内容并显示重试。
8. Autosave reflections：与 transcript 独立失败。
9. Workspace recovery：重新打开 workspace 恢复 recording entry。
10. Recording reopen：播放录音，加载 transcript/reflections。

### 测试工具判断

Main process 纯策略和文件 contract 可以继续使用 Node test runner。Renderer recording overlay、component interaction、autosave UI 和 MediaRecorder mock 大概率需要 Vitest 或等价 renderer/component test runner。Implementation plan 必须先写 RED 测试证明现有 Node runner 不足，再按 `docs/current/quality.md` gate 引入 Vitest。

### 手动验证路径

1. 启动 Reo。
2. 创建 workspace，输入标题，选择没有 `AGENTS.md` 的非空文件夹。
3. 确认 folder 中出现 `AGENTS.md` 和 `.reo/workspace.json`。
4. 点击录音。
5. 录音 10 秒，确认 transcript 增长。
6. 暂停，确认计时和 transcript 停止。
7. 继续，确认计时和 transcript 恢复。
8. 停止，确认进入编辑状态。
9. 编辑 transcript。
10. 编辑 reflections。
11. 关闭 overlay，确认 `Memory Content` 出现 recording entry。
12. 重启 Reo 或重新打开 workspace。
13. 打开 recording，确认音频、transcript、reflections 恢复。
14. 在 workspace folder 运行 Codex CLI 前的检查：`AGENTS.md` 能解释结构，文件可读。

### 回归风险

- Renderer 直接使用 Node API。
- Generic IPC 泄露特权面。
- 覆盖用户已有 `AGENTS.md`。
- 文件路径跟随标题改名导致断链。
- Autosave 失败静默丢内容。
- Mock transcription 掩盖真实 recording lifecycle 问题。
- DB 提前变成唯一真源。
- UI 显示未实现的 film/photo/video/file 功能造成范围漂移。

## Approaches Considered

### A. Filesystem-First Product Slice

采用。Workspace folder 是第一版真源，`.reo` metadata 与 filesystem scan 支撑 UI。DB 延后到真实查询和多 workspace pressure。

### B. Filesystem + SQLite Index From Day One

暂不采用。它更完整，但当前会同时引入 DB、IPC、recording、autosave、renderer tests 等多个 foundation surface，容易变成 mega-slice。

### C. Recording UI Prototype With Workspace Shell

不采用。它能快速看到 UI，但不能验证 workspace 文件契约、Codex CLI 可读性和恢复路径。

## External References

### User Reference Assets

原始参考素材：

- `/Users/yck/Downloads/PM/设计参考/记忆录音/1参考.mp4`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/2参考micro interactions..mp4`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/HGBO9m_bkAA2gLL.jpg`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/HGBO9nIbAAAe4Hk.jpg`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/HGg_Q5wXAAATFN7.jpg`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/HGVwkTJbIAAeWE4.jpg`

本 session 抽帧分析目录：

- `/private/tmp/reo-reference-frames/`

这些素材提供 UI 结构、workspace home、recording overlay、reflection editing 和 micro-interactions 参考。最终视觉必须服从 Reo design system。

### External Product References

- Obsidian Help, Create a vault: https://obsidian.md/help/Getting%2Bstarted/Create%2Ba%2Bvault
- Obsidian Help, How Obsidian stores data: https://obsidian.md/help/data-storage
- Obsidian Help, Configuration folder: https://obsidian.md/help/configuration-folder
- Obsidian Help, Attachments: https://obsidian.md/help/attachments
- Zettlr User Manual, Projects: https://docs.zettlr.com/en/file-manager/projects/

## 下一步

用户审查本 spec 后，下一步只能进入 `$writing-plans`，为该 first product slice 写 implementation plan。不得直接实现。

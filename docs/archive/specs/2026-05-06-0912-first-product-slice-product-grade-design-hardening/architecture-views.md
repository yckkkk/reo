# Architecture Views

## Frontend component view

```text
App
├── QueryClientProvider
├── WorkspaceEntryPage
│   ├── FirstRunShell
│   ├── CreateWorkspaceForm
│   ├── OpenWorkspaceAction
│   └── WorkspaceErrorBanner
└── WorkspaceAppShell
    ├── SidebarLayer
    │   ├── SidebarNavigation
    │   ├── SidebarResizeHandle
    │   └── WindowControlsAnchor
    ├── FloatingContentPanel
    ├── HomePage
    │   ├── HomeHeader
    │   ├── MemorySearchBar
    │   ├── MemorySection
    │   └── MemoryCard
    ├── MemoryDetailPage
    │   ├── MemoryTitleBlock
    │   ├── MemoryActionToolbar
    │   ├── VoiceRecordingsSection
    │   ├── TranscriptSection
    │   └── ReflectionsSection
    ├── RecordAudioDrawer
    │   ├── DrawerShell
    │   ├── RecordingWaveform
    │   ├── RecordingControls
    │   └── RecordingErrorState
    └── ReflectionEditorDrawer
        ├── AudioPlayerInline
        ├── TranscriptEditor
        ├── ReflectionsEditor
        └── EntitySuggestionPopover
```

## UI source ownership

- `src/renderer/src/components/ui/*`：shadcn/Radix/ElevenLabs source-owned primitives，必须 retokenize。
- `src/renderer/src/components/reo/*`：只有跨 feature 的 Reo business primitive 才进入，例如 `IconButton`、`SectionHeader`、`ProductCard`。
- `src/renderer/src/workspace/*`：workspace feature pages、queries、forms、recording drawer。
- `src/renderer/src/recording/*`：若 recording 组件继续膨胀，拆出 recording feature folder，避免 `workspace/RecordingOverlay.tsx` 继续扩大。

## Electron capability view

```text
Renderer
  -> window.reoWorkspace explicit methods
Preload
  -> contextBridge exposes product methods only
Main IPC handlers
  -> validate sender/frame/session/channel
  -> validate Zod request
  -> execute capability module
  -> return typed success/error envelope
Workspace filesystem
  -> workspace handle registry
  -> lock
  -> path containment
  -> atomic writes
```

不允许：

- renderer import `electron` 或 `node:*`
- preload 暴露 `ipcRenderer`
- generic `invoke(channel, payload)`
- generic service layer 或 runtime

## Data view

```text
Workspace files: user content truth
├── memories/<memoryId>/memory.json
├── memories/<memoryId>/recordings/<recordingId>/audio.webm
├── memories/<memoryId>/recordings/<recordingId>/transcript.md
├── memories/<memoryId>/recordings/<recordingId>/reflections.md
└── memories/<memoryId>/recordings/<recordingId>/recording.json

.reo metadata: Reo-managed local metadata/index
├── workspace.json
├── index.json
├── workspace.lock
└── drafts/recordings/<recordingId>/

SQLite app DB: optional app index/relationships/jobs
└── never user content truth

TanStack Query: main-backed async read cache
RHF: create/open form draft
Feature reducer: recording lifecycle
Zustand: future shell/client state only when cross-subtree owner exists
```

## Folder structure target

```text
src/
  main/
    workspace/
    recording/
    database/
    security/
    diagnostics/
  preload/
    index.ts
    workspaceBridge.ts
  renderer/src/
    app-shell/
    workspace/
    recording/
    components/ui/
    components/reo/
    lib/
```

迁移规则：

- 当前实现可按小步迁移，不为了目录美观一次性重排。
- 新 folder 必须对应真实 bounded context。
- 不创建 `services/`、`runtime/`、`core/` 这类泛化目录。

## State ownership view

| State                        | Owner                                 | Durable?       | Notes                                       |
| ---------------------------- | ------------------------------------- | -------------- | ------------------------------------------- |
| Workspace handle             | main memory                           | no             | capability token，不进 Query key            |
| Workspace snapshot           | workspace files + `.reo/index.json`   | yes            | Query cache only projection                 |
| Sidebar covered/expanded     | component/Zustand if cross-route      | no             | route 不变，panel transform 切换            |
| Sidebar width                | component/Zustand if cross-route      | no/current     | clamp 240-520px；跨 session 持久化另开 gate |
| Create workspace draft       | RHF                                   | no             | submit success后清理                        |
| Folder selection token       | component + main token store          | no             | one-shot                                    |
| Active recording lifecycle   | feature reducer                       | no             | not Query                                   |
| Audio chunks                 | workspace files                       | yes            | append sequence                             |
| Transcript/reflections draft | editor component, then markdown files | yes after save | autosave status separate                    |
| Playback Blob URL            | component ref/state                   | no             | revoke on close/switch                      |
| Entity suggestions           | future DB/app index                   | no/current     | wireframe only                              |

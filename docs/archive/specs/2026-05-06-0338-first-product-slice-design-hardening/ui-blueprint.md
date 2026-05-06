# UI 蓝图

## 设计结论

Reo first slice 使用 type-first 的本地 workspace 产品界面。参考素材只约束结构、层级、bottom-sheet 行为和 micro-interactions。Reo design system 控制视觉 token、radius、typography、surface、focus 和 color。

## 侧边栏结论

第一版不显示完整 sidebar。

原因：

- First slice 只有一个已实现导航目标：当前 workspace 的 `Memory Content`。
- Reference sidebar 展示 Photos、Videos、Places 等未实现能力，直接复制会违反 non-goal。
- Reo 当前最小 Electron window 是 900 x 620，首版应优先保证 workspace header、record action、content grid 和 overlay scroll region。

替代结构：

- Workspace home 使用 top header + content section。
- Future sidebar 只有当至少存在两个已实现 navigation targets 时引入。
- 如果后续引入 sidebar，必须定义 width、collapse behavior、keyboard roving/focus、responsive tests。

## 页面与状态

### Workspace 管理

```text
+---------------------------------------------------+
| Reo                                               |
| Create a memory workspace                         |
|                                                   |
| Title                                             |
| [_____________________________________________]   |
| Description                                       |
| [_____________________________________________]   |
| Folder                                            |
| [Choose folder] /path/to/workspace                |
|                                                   |
| [Create workspace]                                |
| status / error / recovery hint                    |
+---------------------------------------------------+
```

状态：

- first-run
- folder selecting
- folder selected
- OS dialog canceled
- validating
- submitting
- existing `AGENTS.md` conflict
- permission denied
- unsupported existing workspace
- created

### Workspace 首页

```text
Header
  Workspace title
  date / description
  Record action

Memory Content
  Empty state OR recording card grid
```

规则：

- 不显示 `Films` section。
- 不显示 photo/video/file action row。
- Recording action 是唯一 primary creation control。
- Long title 在 workspace home 最多两行换行；完整标题保持 screen reader 可读，需要时用 tooltip 或 detail 展示。

### 录音 overlay

```text
Workspace Home, de-emphasized
  |
  v
+---------------------------------------------------+
| Recording title                                   |
| waveform/progress                                 |
| timer / status                                    |
|                                                   |
| Local draft transcript prompt or playback controls |
| Transcript editor                                 |
| Reflections editor                                |
|                                                   |
| status        pause/resume  stop/close            |
+---------------------------------------------------+
```

机制：

- 使用 accessible Dialog semantics 承担 focus trap、Escape handling 和 return focus。
- 视觉位置是 desktop 与 minimum Electron size 下的大型 bottom sheet。
- 背景 workspace 可以 blur 和 dim，但不能作为唯一 modality indicator。
- Overlay 内部滚动，controls 必须始终可达。
- 录音中的 transcript 文案必须标记为本地草稿提示，例如 `本地草稿提示，停止后可编辑`，不得写成真实转写完成状态。

## 组件树

```text
App
  QueryClientProvider
  WorkspaceRouteState
    WorkspaceManagementPage
      CreateWorkspaceForm
        FolderPickerRow
        FieldError
        FormStatus
    WorkspaceHome
      WorkspaceHeader
      RecordAction
      MemoryContentSection
        EmptyMemoryState
        RecordingCard
      RecordingOverlay
        RecordingDialogShell
        RecordingHeader
        RecordingWaveform
        RecordingControls
        LiveTranscript
        PlaybackPanel
        TranscriptEditor
        ReflectionsEditor
        AutosaveStatus
```

## 布局规则

| 视图                 | 宽桌面                                          | 窄桌面                                | 900 x 620 最小窗口                                 |
| -------------------- | ----------------------------------------------- | ------------------------------------- | -------------------------------------------------- |
| Workspace management | centered form, max 560 px                       | centered, smaller gutters             | title、folder row、submit visible without clipping |
| Workspace home       | max 1200 px, header centered                    | content grid collapses to two columns | one column or compact grid, no action overflow     |
| Recording overlay    | bottom sheet max width 1040 px, max height 82vh | width 100%, rounded top panel         | max height 88vh, internal scroll, controls sticky  |
| Editors              | two-column when space allows                    | stacked                               | stacked, min-height with scroll                    |

文字溢出规则：

- Titles wrap, never shrink below readable size。
- Recording cards 可 line clamp，但完整 title 必须能在 detail 中获取。
- Transcript/reflections 使用正常换行和垂直滚动。
- Buttons 使用稳定 min size，状态 label 变化不能造成 layout shift。

## UI 基础组件

| 基础组件     | 来源                                                       | Reo 映射                                        | 测试                               |
| ------------ | ---------------------------------------------------------- | ----------------------------------------------- | ---------------------------------- |
| Button       | 有真实 consumer 后引入 shadcn Button source                | filled pill、ghost pill、compact action         | role/name、focus visible、disabled |
| Icon button  | shadcn Button + lucide when icon-only exists               | 40 x 40 minimum hit target、accessible name     | accessible name、tooltip/focus     |
| Dialog shell | shadcn Dialog/Radix Dialog                                 | modal/panel radius、hairline shadow、focus trap | focus trap、Escape、return focus   |
| Tooltip      | icon-only controls 需要时引入 shadcn Tooltip/Radix Tooltip | 不承载唯一信息                                  | keyboard/focus evidence            |
| Textarea     | shadcn Textarea source                                     | 0 radius、Reo border/input token                | label、error、long text            |
| Label        | shadcn Label source                                        | Inter label、Gravel/Slate secondary             | associated input                   |
| Card/panel   | 优先 inline，重复 invariant 后再提取                       | Card White / panel surfaces                     | no nested cards                    |

## 功能组件

| 组件                | 输入                                              | 事件                                    | 状态归属                         | 复用决策                                             |
| ------------------- | ------------------------------------------------- | --------------------------------------- | -------------------------------- | ---------------------------------------------------- |
| CreateWorkspaceForm | initial title/description, selected folder result | choose folder, submit                   | RHF + component folder state     | feature-local                                        |
| FolderPickerRow     | folder selection result                           | choose                                  | component state                  | feature-local                                        |
| WorkspaceHome       | workspace snapshot                                | record, open recording                  | TanStack Query snapshot          | feature-local page                                   |
| RecordingCard       | entry snapshot                                    | open                                    | props only                       | reusable only after second entry type                |
| RecordingOverlay    | recording mode, draft/detail                      | start, pause, resume, stop, edit, close | reducer + local editor state     | feature-local                                        |
| RecordingControls   | lifecycle state                                   | pause/resume/stop/play                  | reducer                          | extract if playback + live share invariant           |
| RecordingWaveform   | active/processing/progress                        | none                                    | derived from recording state     | adapt ElevenLabs visual structure, not its mic owner |
| TranscriptEditor    | text, save status                                 | change, retry                           | component state + workspace file | feature-local                                        |
| ReflectionsEditor   | text, save status                                 | change, retry                           | component state + workspace file | feature-local                                        |

## 键盘和 focus

- Create form 初始 focus：title input。
- Folder picker 是 button，有 visible focus 和 label。
- Dialog 初始 focus：按模式落在 recording title/status region 或第一个安全 control。
- Escape 只有在安全时关闭：没有 active recording、没有 pending final append、没有 failed unsaved content。
- Close 后 focus 回到 opener。
- Recording controls 必须有 accessible names：`Start recording`、`Pause recording`、`Resume recording`、`Stop recording`、`Play recording`、`Pause playback`。
- Icon-only controls 必须有 lucide icon 加 `aria-label`；tooltip 只是补充。

## 动效规则

- Overlay open/close：短 transform/opacity，reduced-motion fallback 为 no transform。
- Recording active：waveform bars 只在 recording 时移动。
- Pause/resume：状态立即切换，waveform 和 transcript 明确暂停/恢复。
- Transcript reveal：录音中追加行，paused 时不追加。
- Autosave：`saving` 和 `saved` 使用非打扰 `role="status"`；failed save 使用 `role="alert"`。

## 参考映射摘要

- 采纳：centered memory page、action strip idea reduced to one implemented recording action、card grid for recording entries、blurred workspace behind bottom overlay、waveform/timer/local draft transcript hierarchy。
- 拒绝：pink palette、film/photo/video/file controls、heavy blur as decoration、rounded novelty UI、reference font system、disabled future controls。

# Agent Actions Menu Convergence

Timezone: America/Los_Angeles

## Objective

收敛已有 prompt-bridge 菜单入口：把作品和 Workspace Widget 的现有 agent update prompt 从普通 More 菜单项归入统一 `Agent 操作` 子菜单，同时保留现有创建入口位置和所有 main/preload prompt-copy 边界。

## Scope

- 覆盖现有可见 update prompt：
  - artifact Segment card More 的更新作品 prompt。
  - artifact primary content tab More 的更新作品 prompt。
  - artifact SegmentSupplement content tab More 的更新作品 prompt。
  - Workspace Widget tab More 的更新组件 prompt。
- 保留现有 create prompt 入口：
  - FAB `作品`。
  - selected Segment `补充` 菜单里的 `作品补充`。
  - titlebar `新增` 菜单里的 `新增组件`。
- 不新增 Workspace、Memory、普通 audio/note Segment、普通 note/audio Supplement 的 agent action。
- 不新增或改变 IPC/preload channel、prompt payload、runtime bridge method、文件合同或 `.reo` 行为。

## Current Model

- Artifact prompt-bridge 已由 `workspace:copyArtifactAgentPrompt` 承担。
- Widget prompt-bridge 已由 `workspace:copyWidgetAgentPrompt` 承担。
- Renderer 只传 workspace / Memory / Segment / Supplement / Widget identity；main process 生成 prompt 并写剪贴板。
- `EntityActionMenu` 已支持 submenu 型 extra action。
- `SegmentContentActionsMenu` 当前是自有 DropdownMenu 结构，需要保持 path actions、refresh、speech/transcription、rename/clear 的相对顺序。

## Menu Model

More 菜单继续分组：

1. 路径 / 打开类只读 OS actions。
2. Runtime-local actions，例如 `刷新页面`。
3. `Agent 操作` submenu，承载现有 prompt-copy action。
4. 其它实体动作，例如封面、语音、重命名、删除。

`Agent 操作` 是 progressive disclosure：减少顶层菜单混杂，但不隐藏现有能力。子菜单项使用具体动词：

- `更新作品`
- `更新组件`

## Invariants

- Prompt-copy 仍只调用现有 renderer API。
- 菜单收敛不创建文件、不创建空作品、不创建空 Widget。
- 不把 raw path、prompt text、report entries 或 workspace handle 输出到 renderer。
- 不改变 runtime iframe bridge 的 `agent.copyPrompt` 行为。
- 菜单 item 仍可键盘访问，并保留 Radix DropdownMenu submenu mechanics。

## Success Criteria

- Artifact Segment card More 显示 `Agent 操作` submenu，submenu 内有 `更新作品`，不再在顶层显示 `让 Agent 更新作品`。
- Artifact primary content tab More 和 artifact Supplement tab More 同样把 update prompt 放入 `Agent 操作` submenu。
- Widget tab More 显示 `Agent 操作` submenu，submenu 内有 `更新组件`，不再在顶层显示 `让 Agent 更新组件`。
- Existing create prompt tests 继续通过，证明创建入口未移动到 Entity More 或变成写文件 flow。
- Focused renderer tests 先 RED 后 GREEN；收口前运行 `npm run verify:quick`。

## Verification

- RED: focused renderer menu tests failed while update prompt entries were still top-level.
- GREEN: `npm run test:renderer -- src/renderer/src/workspace/SegmentActionsMenu.test.tsx src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/SegmentSupplementActionsMenu.test.tsx src/renderer/src/workspace/WorkspaceTitlebar.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`
- Final gate before archive: `npm run verify:quick`

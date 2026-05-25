# Memory Studio Inline Text Editing

Time: 2026-05-24 08:35 America/Los_Angeles

## Objective

把 finalized 文本编辑收敛为 Memory Studio 内的一条路径：正文、普通转录、补充笔记和补充录音转录在内容载入后常态显示同一套轻量 textarea 编辑 surface。删除旧的展开编辑入口、转录独立 overlay 和内容 More 菜单里的编辑项。工具栏只保留当前轻量文本编辑需要的少量 Markdown 插入能力，删除引用等扩展动作。

## Current Constraints

- Markdown 字符串仍是 `segment.md` 和 `supplement.md` 的文件真源。
- 底层 single-writer lock、baseline hash、visibility refresh 和冲突保护保留；这些是本地文件真源安全边界，不是需要删除的 UI 复杂度。
- 新建笔记仍保留创建流，因为尚不存在可点击的 finalized 内容面板。
- 设计参考 Figma `PyDjdcihllrvfMLR0Q5SWJ` 节点 `8:55` 与 `8:331`：stage 40px/32px padding、tab rail 到 editor 14px、toolbar 44px、body padding 20px/16px、14px mono text、165% line-height。Runtime 不给文本编辑器设置最大/最小宽度；编辑器跟随可用主列伸缩，右边距距窗口右侧或展开 Memory rail 左边缘 40px，底边距窗口底部 32px。

## Success Criteria

- finalized Note 正文、Audio 转录、Note Supplement 正文和 Audio Supplement 转录内容载入后，均在 Memory Studio 当前位置常态显示同一有边框编辑容器；toolbar 常态可见，`取消` / `保存` 只在正文 dirty 后显示；点击保存后 action 同步隐藏，不显示中间 disabled/pressed action 状态，保存成功后退出 focus/ring。
- Memory、Segment 或 content tab 切换不自动聚焦 textarea；只有 textarea 本身获得光标焦点后，编辑容器边框才切换到 ring 色；toolbar、toolbar button、body 和 textarea 不出现点击或保存填充闪烁。
- Audio 转录保存调用 `workspace:saveTranscript`，Audio Supplement 转录保存调用 `workspace:saveSegmentSupplementTranscript`，提交进入编辑时的 `baselineTranscriptHash`；保存失败不丢弃当前编辑。
- Note 与 Note Supplement 继续使用 `baselineContentHash`、外部修改提示、冲突保留/重试逻辑。
- Content tab rail 不显示独立「编辑」按钮；primary content More 菜单不包含「编辑正文」或「编辑转录」。
- `TranscriptEditorOverlay` 和 App 级 `transcriptEditorTarget` 路径移除。
- Markdown 工具栏不再渲染「引用」，并从 action type 与格式插入逻辑中删除 quote/heading/separator 扩展动作。
- 更新 `docs/current/frontend.md`、`docs/current/data.md`、`docs/current/flow.md`、`docs/current/quality.md` 中仍然描述旧编辑模型的当前事实。

## Verification Plan

- RED: focused renderer tests first, proving current implementation still exposes old edit buttons/menu/overlay path and toolbar actions.
- GREEN: implement smallest code changes to pass those behavior tests.
- REFACTOR: remove dead overlay code and obsolete tests.
- Run focused renderer tests for Memory Studio, toolbar/model, App surface as needed.
- Run `npm run verify:quick`.
- Run Memory Studio runtime visual validation against the Figma spacing-critical surface.

## Runtime Evidence

- `memory-studio-layout-1440.json`: note editor collapsed rail, width 1120px, left 40px, right 40px, bottom 32px, tab-to-editor gap 14px, radius 12px.
- `memory-studio-layout-1440-rail-open.json`: note editor with Memory rail open, right gutter remains 40px to the rail edge.
- `memory-studio-layout-1440-audio-supplement-rail-open.json`: audio supplement transcript editor with Memory rail open, width 880px, left 40px, right 40px, bottom 32px, player-to-editor gap 14px.
- `memory-studio-layout-900.json`: compact note editor, width 580px, left 40px, right 40px, bottom 32px.
- Follow-up runtime metric `memory-studio-layout-inline-save-focus.json`: clean inline editor initially not focused, toolbar only shows format controls, textarea click focuses editor and changes border to ring color without showing clean-state actions; toolbar、toolbar button、body 和 textarea computed background 均为透明，transition-property 均不包含背景或颜色 transition。
- Follow-up runtime metric `memory-studio-layout-inline-save-focus-900.json`: 900x720 viewport 下同一 layout gate 通过。

## Review Evidence

- Blind subagent review found stale-baseline risk for consecutive transcript saves before query refetch. Transcript save responses now return the next transcript baseline hash, and the inline editor adopts it immediately after a successful save.
- Blind subagent review found docs overstated stale conflict parity across Note body and transcript saves. Current docs now state Note body stale saves use the editor conflict AlertDialog, while transcript stale saves show a visible error and keep the textarea body.
- Blind subagent review found ring state still followed descendant focus instead of textarea caret focus. Inline editor focus is now driven by textarea focus/blur only; toolbar focus does not keep or enter ring state.
- Follow-up blind review found no blocking issue. Its low-risk findings were closed by making the layout telemetry reject `transition-property: all` and renaming editor focus state to `textareaFocused`.

## Verification Evidence

- `npm run typecheck:quick`
- `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`
- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "edits finalized Note segment markdown from Memory Studio|reenables the finalized Note editor when save rejects|keeps dirty Note segment edits intact when save detects an external conflict|retries a stale Note segment save with the current disk baseline when keeping local edits|finalizes and edits a Note SegmentSupplement from the selected Segment plus menu|handles stale Note SegmentSupplement save conflict actions|blocks settings navigation and window unload while inline transcript edits are dirty|refreshes an active SegmentSupplement panel after its transcript is saved"`
- `npm run test:renderer -- src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/noteEditorModel.test.ts src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/workspace/workspaceApi.test.ts src/renderer/src/workspace/RecordingOverlay.test.tsx`
- `MAIN_TEST_FILES='test/main/workspaceContract.test.ts,test/main/workspaceIpc.test.ts,test/main/workspaceBridgeSurface.test.ts' npm run test:main`
- `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "renders finalized Note segments as markdown content in Memory Studio"`
- `npm run test:renderer -- src/renderer/src/workspace/inlineMarkdownEditorState.test.tsx`
- `npm run typecheck -- --pretty false`
- `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/workspace/inlineMarkdownEditorState.test.tsx`
- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "reenables the finalized Note editor when save rejects"`
- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "edits finalized Note segment markdown from Memory Studio|reenables the finalized Note editor when save rejects|keeps dirty Note segment edits intact when save detects an external conflict|retries a stale Note segment save with the current disk baseline when keeping local edits|finalizes and edits a Note SegmentSupplement from the selected Segment plus menu|handles stale Note SegmentSupplement save conflict actions|blocks settings navigation and window unload while inline transcript edits are dirty|refreshes an active SegmentSupplement panel after its transcript is saved"`
- `npm run verify:memory-studio-layout -- --port 9345 --screenshot /tmp/reo-memory-studio-inline-focus.png --metrics /tmp/reo-memory-studio-inline-focus.json`
- `npm run verify:memory-studio-layout -- --port 9345 --viewport 900x720 --interaction none --screenshot /tmp/reo-memory-studio-inline-focus-900.png --metrics /tmp/reo-memory-studio-inline-focus-900.json`
- `npm run verify:memory-studio-layout -- --port 9345 --screenshot docs/specs/2026-05-24-0835-memory-studio-inline-text-editing/artifacts/memory-studio-layout-inline-save-focus.png --metrics docs/specs/2026-05-24-0835-memory-studio-inline-text-editing/artifacts/memory-studio-layout-inline-save-focus.json`
- `npm run verify:memory-studio-layout -- --port 9345 --viewport 900x720 --interaction none --screenshot docs/specs/2026-05-24-0835-memory-studio-inline-text-editing/artifacts/memory-studio-layout-inline-save-focus-900.png --metrics docs/specs/2026-05-24-0835-memory-studio-inline-text-editing/artifacts/memory-studio-layout-inline-save-focus-900.json`
- `npm run verify:quick`

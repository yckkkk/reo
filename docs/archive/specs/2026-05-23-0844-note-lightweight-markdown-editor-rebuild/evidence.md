# Evidence

## T1 Main 残留盘点

- `git grep` 显示 `main` 的主线代码没有 `CodeMirror` / `note-cm6` 实现，但 `docs/current/frontend.md` 和 `docs/current/roadmap.md` 仍保留 CodeMirror 6 作为后续研究方向。
- `main:package.json` 没有 CodeMirror、Lezer、KaTeX、Mermaid、DOMPurify、markdown-it 依赖；`primereact` 是既有依赖。

## T2 回退

- 已从 `main` 恢复 `package.json`、`package-lock.json`、`src/`、`test/main/`、`vitest.config.ts` 和 `docs/current/*` 的代码基线。
- 已删除未跟踪的 `src/renderer/src/workspace/note-cm6/`、`scripts/verify-note-cm6-runtime.mjs`、复杂 Markdown renderer、安全预览 adapter、CM6 toolbar/helper 文件和相关测试。
- 已移除 CM6 initiative、decision 和 active specs 的主线路径；当前 CM6 click precision spec 已移动到 `docs/archive/specs/2026-05-23-0402-note-cm6-click-precision/`。

## T3 RED

- RED command: `npm run test:renderer -- src/renderer/src/workspace/noteEditorModel.test.ts src/renderer/src/workspace/NoteEditorOverlay.test.tsx -t "lightweight Markdown"`.
- RED result: failed as expected. `NoteEditorOverlay` could not find an accessible `粗体` toolbar button, proving the textarea baseline did not yet expose lightweight Markdown commands.

## T4 GREEN

- GREEN change: `NoteEditorOverlay` now renders a compact Markdown toolbar above the textarea. Buttons apply pure string transforms for bold, emphasis, image placeholder, horizontal rule, heading, bullet list, numbered list and quote against the current textarea selection.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/noteEditorModel.test.ts src/renderer/src/workspace/NoteEditorOverlay.test.tsx -t "lightweight Markdown"`.
- GREEN result: passed. 2 test files passed, 2 tests passed, 2 skipped by name filter.

## T5 RED

- RED command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "edits a finalized Note segment directly"`.
- RED result: failed as expected. Memory Studio rendered the finalized Note Segment body as read-only Markdown text and could not find the accessible `编辑笔记 Cake planning note` button inside the正文 panel.

## T6 GREEN

- First GREEN attempt added an inline textarea to `MarkdownContentSurface`; focused test passed, but full `src/renderer/src/App.test.tsx --reporter=verbose` failed 13 existing tests that protect the single finalized Note edit overlay, image attachment paste/drop, visibility refresh and stale-save conflict flows.
- Refactor decision: inline textarea was a second editing state and violated the current simplicity constraint. It was removed. Memory Studio edit remains available through the existing `NoteEditorOverlay`, now backed by the lightweight textarea toolbar.
- `/review` subagent result: PASS. No CM6 / CodeMirror / Tiptap / ProseMirror / BlockNote or complex Markdown renderer remained in `src/`; no main/preload/Electron security diff; Memory Studio finalized Note edit path remains App state to the single `NoteEditorOverlay`.
- `/ycksimplify` follow-up fixes: reused the Markdown range insertion helper, factored textarea selection restore, changed the non-rendering HTML underline command to Markdown emphasis, added toolbar tooltips, removed an unused toolbar style prop, replaced nested separator prefix logic with a guard helper, and removed the old editor-name assertion from the toolbar test.
- Refactor/focused command: `npm run test:renderer -- src/renderer/src/workspace/noteEditorModel.test.ts src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/workspaceApi.test.ts -t "Note|note|笔记|Markdown|attachment|正文"`.
- Refactor/focused result: passed. 4 test files passed, 8 tests passed, 48 skipped by name filter.
- App regression command: `npm run test:renderer -- src/renderer/src/App.test.tsx`.
- App regression result: passed. 1 test file passed, 121 tests passed.
- Typecheck command: `npm run typecheck:quick`.
- Typecheck result: passed.

## T8 Final Verification

- Focused command: `npm run test:renderer -- src/renderer/src/workspace/noteEditorModel.test.ts src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/workspaceApi.test.ts -t "Note|note|笔记|Markdown|attachment|正文|prefixes every selected line"`.
- Focused result: passed. 4 test files passed, 9 tests passed, 48 skipped by name filter.
- Typecheck command: `npm run typecheck:quick`.
- Typecheck result: passed.
- Final command: `npm run verify:quick`.
- Final result: passed. Main tests: 815 passed. Renderer tests: 47 files passed, 497 tests passed. `lint:strict` passed. `format:check` passed.
- Build command: `npm run build`.
- Build result: passed. `out/main/index.js` 666.50 kB, `out/preload/index.cjs` 16.46 kB, renderer CSS 66.32 kB, renderer JS 2,090.61 kB.

## Follow-up: Memory Studio 展开编辑按钮位置

- RED command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "renders finalized Note segments as markdown content|places the active note supplement edit action"`.
- RED result: failed as expected. Note Segment and Note SegmentSupplement both still rendered an edit button inside `MarkdownContentSurface`.
- GREEN change: `MarkdownContentSurface` no longer owns edit buttons. Memory Studio renders the active Note Segment or active Note SegmentSupplement edit button in the content tab rail row immediately before `添加片段补充内容`.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "renders finalized Note segments as markdown content|places the active note supplement edit action"`.
- GREEN result: passed. 1 test file passed, 2 tests passed, 48 skipped by name filter.

## Follow-up: content tab rail 右侧动作组

- RED command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "shows finalized recording supplements as content rail tabs"`.
- RED result: failed as expected. The content tab rail had no `memory-studio-content-tab-actions` action group and no visible `编辑转录` rail button after transcript content loaded.
- GREEN change: Memory Studio now renders a right-side `memory-studio-content-tab-actions` group. Active `正文`, active `转录`, and active Note SegmentSupplement expose exactly one expand edit button in that group, directly before `添加片段补充内容`.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "renders finalized Note segments as markdown content|shows finalized recording supplements as content rail tabs|places the active note supplement edit action"`.
- GREEN result: passed. 1 test file passed, 3 tests passed, 47 skipped by name filter.
- Runtime root-cause check: current workspace `笔记1` carried `.reo/objects/segments/<segmentId>.json.contentTabOrder`, and `window.reoWorkspace.readSegmentContent(...)` returned `ERR_WORKSPACE_INVALID_REQUEST / Note segment content could not be read`.
- Main RED command: `npm run test:main -- --test-name-pattern "content remains readable after content tab order"`.
- Main RED result: failed as expected. `readFinalizedNoteSegmentContent` rejected a finalized Note Segment manifest after `contentTabOrder` was persisted.
- Main GREEN change: finalized Note Segment manifest schema now accepts `contentTabOrder` as a current known Segment manifest field, so Note content reads and writes do not fail after content tab ordering is saved.
- Main GREEN command: `npm run test:main -- --test-name-pattern "content remains readable after content tab order"`.
- Main GREEN result: passed. 45 main test entries passed under the name filter; targeted test `finalized note segment content remains readable after content tab order is persisted` passed.
- Renderer GREEN rerun: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "renders finalized Note segments as markdown content|shows finalized recording supplements as content rail tabs|places the active note supplement edit action"` passed. 1 test file passed, 3 tests passed, 47 skipped by name filter.
- Typecheck command: `npm run typecheck:quick`.
- Typecheck result: passed.
- Dev runtime restarted after the main-process schema change. Runtime state screenshots:
  - `evidence/screenshots/runtime-body-action-group.png`
  - `evidence/screenshots/runtime-note-supplement-action-group.png`
  - `evidence/screenshots/runtime-note-supplement-plus-menu-open.png`
  - `evidence/screenshots/runtime-note-supplement-editor-overlay.png`
  - `evidence/screenshots/runtime-transcript-action-group.png`
  - `evidence/screenshots/runtime-transcript-editor-overlay.png`
- Runtime metrics: `evidence/runtime-state-metrics.json`. In `body-action-group`, `note-supplement-action-group`, and `transcript-action-group`, the active edit button is before `添加片段补充内容` with `editAddGapPx: 4`; note supplement and transcript edit buttons open their respective editor overlays.

## Follow-up: blind review action ownership

- Blind visual/state review result: FAIL. Reviewer found that content edit and add controls read as global because they drifted far from the active tab, the primary tab More menu duplicated edit ownership, and an opened editor did not clearly enter an input-ready state.
- RED command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx -t "renders finalized Note segments as markdown content|shows finalized recording supplements as content rail tabs|places the active note supplement edit action|SegmentContentActionsMenu|places the title and save action"`.
- RED result: failed as expected. Primary tab More still exposed `编辑正文` / `编辑转录`, the content rail row still used right/left distribution, the add control had no visible content label, and the note editor textarea did not receive focus.
- GREEN change: content rail actions now sit immediately after the tablist, the active edit action is the only edit owner for `正文` / `转录` / Note supplement, the add control is labeled `补充`, primary tab More contains only path, rename and clear actions, and `NoteEditorOverlay` focuses the Markdown textarea on open.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx -t "renders finalized Note segments as markdown content|shows finalized recording supplements as content rail tabs|places the active note supplement edit action|SegmentContentActionsMenu|places the title and save action"`.
- GREEN result: passed. 3 test files passed, 7 tests passed, 49 skipped by name filter.
- Runtime spacing RED command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "renders finalized Note segments as markdown content"`.
- Runtime spacing RED result: failed as expected. The `补充` button still used Tailwind spacing scale classes `gap-6 px-10`, which rendered as a 144px-wide button in runtime.
- Runtime spacing GREEN change: the `补充` button now uses explicit pixel utilities `gap-[6px] px-[10px]` so icon and text remain one compact control.
- Runtime spacing GREEN result: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "renders finalized Note segments as markdown content"` passed. The broader focused renderer command also passed again with 3 files, 7 tests, 49 skipped by name filter.
- Runtime state screenshots:
  - `evidence/screenshots/runtime-body-action-group-v2.png`
  - `evidence/screenshots/runtime-body-more-menu-v2.png`
  - `evidence/screenshots/runtime-add-supplement-menu-v2.png`
  - `evidence/screenshots/runtime-note-supplement-action-group-v2.png`
  - `evidence/screenshots/runtime-note-supplement-editor-focused-v2.png`
  - `evidence/screenshots/runtime-transcript-action-group-v2.png`
  - `evidence/screenshots/runtime-transcript-more-menu-v2.png`
  - `evidence/screenshots/runtime-transcript-editor-overlay-v2.png`
- Runtime metrics: `evidence/runtime-state-metrics.json`. The action group immediately follows the content tab rail with `tabActionGapPx: 8`; edit is before add with `editAddGapPx: 4`; the add button computed width is `66px` with `gap: 6px` and `padding-inline: 10px`; primary tab More menus contain no edit items; the Note editor textarea focused on open.

## Follow-up: blind review high findings

- Independent blind multi-state review result: FAIL. High findings were visible raw or corrupted source-document frontmatter in the note reading state, ambiguous icon-only edit entry, inconsistent Note versus Transcript editor forms, and insufficient destructive affordance on clear actions.
- RED command: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx -t "embedded source-document frontmatter|renders finalized Note segments as markdown content|shows finalized recording supplements as content rail tabs|places the active note supplement edit action|disables clear|lightweight Markdown toolbar"`.
- RED result: failed as expected. `MarkdownContentSurface` rendered embedded `title:` / `author:` preamble text; rail edit buttons were icon-only; clear menu item did not carry destructive visual semantics; `TranscriptEditorOverlay` had no Markdown toolbar.
- GREEN change: read-mode Markdown now filters an embedded source-document YAML preamble from the visible body; rail edit buttons render `编辑` with a pencil icon and explicit pixel spacing; primary content clear items use destructive text styling; `TranscriptEditorOverlay` uses the same lightweight Markdown toolbar and textarea focus behavior as the Note editor.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx -t "embedded source-document frontmatter|renders finalized Note segments as markdown content|shows finalized recording supplements as content rail tabs|places the active note supplement edit action|disables clear|lightweight Markdown toolbar"`.
- GREEN result: passed. 4 test files passed, 6 tests passed, 52 skipped by name filter.
- App regression follow-up: previous full renderer run exposed a stale App test path that still opened transcript editing through the primary tab More menu. The test was updated to open the single rail `编辑转录` action. `npm run test:renderer -- src/renderer/src/App.test.tsx -t "blocks settings navigation while the transcript editor is open"` passed.
- Focused rerun: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/App.test.tsx -t "embedded source-document frontmatter|renders finalized Note segments as markdown content|shows finalized recording supplements as content rail tabs|places the active note supplement edit action|disables clear|lightweight Markdown toolbar|blocks settings navigation while the transcript editor is open"` passed. 5 test files passed, 7 tests passed, 172 skipped by name filter.
- Typecheck: `npm run typecheck:quick` passed.

## Follow-up: read-mode basic Markdown blocks

- RED command: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "embedded source-document frontmatter|basic Markdown block markers|renders finalized Note segments as markdown content|places the active note supplement edit action"`.
- RED result: failed as expected. Read mode still rendered `# Markdown 全格式测试文档`, `## 小标题`, `- 第一项`, `- 第二项` and `---` as raw source text, so tests could not find semantic headings.
- GREEN change: `MarkdownContentSurface` now applies a small read-mode block parser for headings, unordered lists, ordered lists and horizontal rules while keeping the Markdown string as the file/save truth and without adding a heavy editor or renderer dependency.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "embedded source-document frontmatter|basic Markdown block markers|renders finalized Note segments as markdown content|places the active note supplement edit action"`.
- GREEN result: passed. 2 test files passed, 4 tests passed, 48 skipped by name filter.
- Focused rerun: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/App.test.tsx -t "embedded source-document frontmatter|basic Markdown block markers|renders finalized Note segments as markdown content|shows finalized recording supplements as content rail tabs|places the active note supplement edit action|disables clear|lightweight Markdown toolbar|blocks settings navigation while the transcript editor is open"` passed. 5 test files passed, 8 tests passed, 172 skipped by name filter.
- Main regression: `npm run test:main -- --test-name-pattern "content remains readable after content tab order"` passed. 45 main test entries passed under the name filter; targeted finalized Note Segment content-order test passed.
- Typecheck: `npm run typecheck:quick` passed.
- Diff hygiene: `git diff --check` passed.
- Runtime screenshots were regenerated against the running Electron dev app and the user's full-format Markdown test document:
  - `evidence/screenshots/runtime-body-action-group-v4.png`
  - `evidence/screenshots/runtime-body-more-menu-v4.png`
  - `evidence/screenshots/runtime-add-supplement-menu-v4.png`
  - `evidence/screenshots/runtime-note-supplement-action-group-v4.png`
  - `evidence/screenshots/runtime-note-supplement-editor-focused-v4.png`
  - `evidence/screenshots/runtime-transcript-action-group-v4.png`
  - `evidence/screenshots/runtime-transcript-more-menu-v4.png`
  - `evidence/screenshots/runtime-transcript-editor-overlay-v4.png`
- Runtime metrics: `evidence/runtime-state-metrics.json`. The Note body, Note supplement and Transcript states each expose exactly one rail `编辑` action before `补充`; the body read state hides frontmatter keys and ATX heading markers while rendering `Markdown 全格式测试文档` as a semantic heading.

## Follow-up: blind multi-state editor model review

- Independent blind multi-state review result: FAIL. High findings were ambiguous active tab ownership, generic supplement empty/editor state, Transcript editor showing Note Markdown controls, and destructive clear action needing visible confirmation evidence. The review was run against screenshots covering body read state, primary More menu, supplement tab, supplement editor, transcript tab, transcript More menu and transcript editor.
- RED command: `npm run test:renderer -- src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/App.test.tsx -t "edits transcript text without note Markdown formatting controls|labels an empty supplement editor|uses supplement-specific empty copy|caps content tab pills|clears the transcript from the primary tab action menu|finalizes a FAB Note"`.
- RED result: failed as expected. The Note supplement empty state still used generic note copy, inactive content tabs painted a second active-looking background on hover, Note supplement editor lacked a supplement-specific placeholder, and `TranscriptEditorOverlay` still exposed the Note Markdown toolbar.
- GREEN change: content tab active state now has an explicit ring and inactive hover no longer paints another pill; empty Note supplement content says `这条补充笔记还没有正文。`; Note supplement editor placeholder is `写下补充笔记...`; Transcript editor is a plain transcript textarea with no Note Markdown toolbar and placeholder `整理或修正转录文本...`; clear confirmation copy explicitly states that the corresponding body will be saved empty and cannot be directly undone from the menu.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/App.test.tsx -t "edits transcript text without note Markdown formatting controls|labels an empty supplement editor|uses supplement-specific empty copy|caps content tab pills|clears the transcript from the primary tab action menu|finalizes a FAB Note"`.
- GREEN result: passed. 4 test files passed, 5 tests passed, 175 skipped by name filter.
- Clear confirmation focused rerun: `npm run test:renderer -- src/renderer/src/App.test.tsx -t "clears primary Segment transcript"` passed. 1 test file passed, 1 test passed, 120 skipped by name filter.
- Focused rerun: `npm run test:renderer -- src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/App.test.tsx -t "edits transcript text without note Markdown formatting controls|labels an empty supplement editor|uses supplement-specific empty copy|caps content tab pills|clears primary Segment transcript|finalizes a FAB Note"` passed. 4 test files passed, 6 tests passed, 174 skipped by name filter.
- Broader focused rerun: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/App.test.tsx -t "embedded source-document frontmatter|basic Markdown block markers|renders finalized Note segments as markdown content|shows finalized recording supplements as content rail tabs|places the active note supplement edit action|disables clear|edits transcript text without note Markdown formatting controls|labels an empty supplement editor|uses supplement-specific empty copy|caps content tab pills|clears primary Segment transcript|finalizes a FAB Note"` passed. 5 test files passed, 11 tests passed, 170 skipped by name filter.
- Main regression: `npm run test:main -- --test-name-pattern "content remains readable after content tab order"` passed. 45 main test entries passed under the name filter; targeted finalized Note Segment content-order test passed.
- Typecheck: `npm run typecheck:quick` passed.
- Diff hygiene: `git diff --check` passed.
- Runtime screenshots were regenerated through CDP against the running Electron dev app and the user's full-format Markdown test document:
  - `evidence/screenshots/runtime-body-action-group-v5.png`
  - `evidence/screenshots/runtime-body-more-menu-v5.png`
  - `evidence/screenshots/runtime-body-clear-confirm-v5.png`
  - `evidence/screenshots/runtime-add-supplement-menu-v5.png`
  - `evidence/screenshots/runtime-note-supplement-action-group-v5.png`
  - `evidence/screenshots/runtime-note-supplement-editor-focused-v5.png`
  - `evidence/screenshots/runtime-transcript-action-group-v5.png`
  - `evidence/screenshots/runtime-transcript-more-menu-v5.png`
  - `evidence/screenshots/runtime-transcript-clear-confirm-v5.png`
  - `evidence/screenshots/runtime-transcript-editor-overlay-v5.png`
- Runtime metrics: `evidence/runtime-state-metrics.json`. Checks passed: frontmatter hidden, raw ATX heading marker hidden, semantic heading visible, edit before supplement add, body clear confirmation visible, Note supplement empty copy visible, Note supplement editor placeholder present, transcript editor has no Note Markdown toolbar, transcript editor placeholder present, transcript clear confirmation visible.

## Follow-up: blind review v5 high findings

- Independent blind multi-state review result: FAIL. High findings were: editor overlay leaked the bottom ExpressionDock into editing state, empty editor focus looked like a horizontal rendering bug, `[TOC]` rendered as visible body text, and the reviewer interpreted Note and Transcript editor differences as two editor models. Decision: keep Note Markdown toolbar and Transcript plain textarea as the current lightweight model, but fix the real visual and state leaks.
- RED command: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/workspace/WorkspaceDangerConfirmDialog.test.tsx src/renderer/src/App.test.tsx -t "table-of-contents control marker|labels an empty supplement editor|edits transcript text without note Markdown formatting controls|compact danger confirmation|blocks settings navigation while the transcript editor is open|clears primary Segment transcript"`.
- RED result: failed as expected. `[TOC]` rendered as a paragraph; Note and Transcript textareas still carried their own focus-visible ring and tight top padding; danger confirmation used the wider default AlertDialog sizing; clear transcript copy still said `转录正文`; ExpressionDock remained visible while the transcript editor was open.
- Design-token RED command: `MAIN_TEST_FILES=test/main/designSystemTokens.test.ts npm run test:main -- --test-name-pattern "design token source defines compact Soft Flat semantic colors|runtime and design-system CSS project the same semantic tokens"`.
- Design-token RED result: failed as expected. Runtime/design-system tokens still used the same `#ff4704` value for `destructive` and `brand-ember`.
- GREEN change: read-mode Markdown filters `[TOC]`; Note and Transcript editors move focus indication to the editor container and remove textarea focus divider; editor textareas use larger top padding and explicit placeholder color; `WorkspaceDangerConfirmDialog` uses a compact surface; clear copy no longer repeats `正文`; ExpressionDock is not rendered while Note, Transcript, or Recording overlay state is active; destructive red is separated from brand ember in runtime and design-system tokens.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/workspace/WorkspaceDangerConfirmDialog.test.tsx src/renderer/src/App.test.tsx -t "table-of-contents control marker|labels an empty supplement editor|edits transcript text without note Markdown formatting controls|compact danger confirmation|blocks settings navigation while the transcript editor is open|clears primary Segment transcript"`.
- GREEN result: passed. 5 test files passed, 6 tests passed, 127 skipped by name filter.
- Design-token GREEN command: `MAIN_TEST_FILES=test/main/designSystemTokens.test.ts npm run test:main -- --test-name-pattern "design token source defines compact Soft Flat semantic colors|runtime and design-system CSS project the same semantic tokens"`.
- Design-token GREEN result: passed. 2 main tests passed.
- Broader focused renderer rerun: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/workspace/WorkspaceDangerConfirmDialog.test.tsx src/renderer/src/App.test.tsx -t "embedded source-document frontmatter|basic Markdown block markers|table-of-contents control marker|renders finalized Note segments as markdown content|shows finalized recording supplements as content rail tabs|places the active note supplement edit action|disables clear|applies lightweight Markdown toolbar|edits transcript text without note Markdown formatting controls|labels an empty supplement editor|uses supplement-specific empty copy|caps content tab pills|compact danger confirmation|blocks settings navigation while the transcript editor is open|clears primary Segment transcript|finalizes a FAB Note"` passed. 7 test files passed, 16 tests passed, 171 skipped by name filter.
- Main regression: `npm run test:main -- --test-name-pattern "content remains readable after content tab order|design token source defines compact Soft Flat semantic colors|runtime and design-system CSS project the same semantic tokens"` passed. 46 main test entries passed under the name filter.
- Typecheck: `npm run typecheck:quick` passed.
- Diff hygiene: `git diff --check` passed.
- Dev overlay layering RED command: `npm run test:renderer -- src/renderer/src/workspace/ImmersiveWorkspaceSurface.test.tsx -t "places immersive editor surfaces"`.
- Dev overlay layering RED result: failed as expected. Immersive Drawer content still used default `z-50`, below the dev-only feedback toolbar.
- Dev overlay layering GREEN change: immersive Drawer overlay/content use explicit high z-index classes so editing surfaces cover dev-only feedback chrome.
- Dev overlay layering GREEN command: `npm run test:renderer -- src/renderer/src/workspace/ImmersiveWorkspaceSurface.test.tsx -t "places immersive editor surfaces"`.
- Dev overlay layering GREEN result: passed. 1 renderer test passed.

## Follow-up: Memory Studio ownership and multi-state evidence

- Independent blind multi-state review result: FAIL. High findings were: Note editor and Transcript editor still read as two unrelated models, Memory Studio still exposed too many creation/action entry points, the bottom expression entry created ownership confusion, and content More menus still looked like they owned file/Finder actions.
- RED command: `npm run test:renderer -- src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "shows only transcript slot actions|edits transcript text without note Markdown formatting controls|keeps the global expression entry"`.
- RED result: failed as expected. Primary content slot menus still carried file path actions, `TranscriptEditorOverlay` had no explicit transcript surface header, and Memory Studio still rendered the bottom ExpressionDock.
- GREEN change: `SegmentContentActionsMenu` now only owns content-slot rename and clear actions; entity file/Finder/path actions remain on entity More menus. `TranscriptEditorOverlay` now shows a `转录文本` strip above the transcript textarea. Loaded Memory Studio no longer renders the bottom ExpressionDock and instead exposes an inline `新片段` menu for top-level `录音` and `笔记`.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "shows only transcript slot actions|uses body copy|edits transcript text without note Markdown formatting controls|keeps the global expression entry|renders the loaded workspace frame"`.
- GREEN result: passed. 3 renderer test files passed, 5 tests passed.
- App regression command: `npm run test:renderer -- src/renderer/src/App.test.tsx -t "records from the loaded workspace FAB|blocks workspace switching while a recording flow|blocks workspace switching while a Note editor|blocks native window unload|finalizes a FAB recording|finalizes a FAB Note|confirms before closing a dirty FAB Note|retries a FAB Note save|does not create a Note draft|projects a finalized FAB recording|opens the recording overlay from the current memory stage FAB|records into the selected Memory"`.
- App regression result: passed. 1 renderer test file passed, 12 tests passed.
- Broader focused renderer command: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/workspace/WorkspaceDangerConfirmDialog.test.tsx src/renderer/src/workspace/ImmersiveWorkspaceSurface.test.tsx src/renderer/src/App.test.tsx -t "embedded source-document frontmatter|basic Markdown block markers|table-of-contents control marker|renders finalized Note segments as markdown content|shows finalized recording supplements as content rail tabs|places the active note supplement edit action|disables clear|shows only transcript slot actions|uses body copy|applies lightweight Markdown toolbar|edits transcript text without note Markdown formatting controls|labels an empty supplement editor|uses supplement-specific empty copy|caps content tab pills|compact danger confirmation|places immersive editor surfaces|blocks settings navigation while the transcript editor is open|clears primary Segment transcript|finalizes a FAB Note|records from the loaded workspace FAB|opens the recording overlay from the current memory stage FAB|keeps the global expression entry"`.
- Broader focused renderer result: passed. 8 renderer test files passed, 22 tests passed, 166 skipped.
- Main focused command: `npm run test:main -- --test-name-pattern "content remains readable after content tab order|design token source defines compact Soft Flat semantic colors|runtime and design-system CSS project the same semantic tokens"`.
- Main focused result: passed. 46 main test entries passed.
- Typecheck command: `npm run typecheck:quick`.
- Typecheck result: passed.
- Diff hygiene command: `git diff --check`.
- Diff hygiene result: passed.
- Runtime screenshots were regenerated through CDP against the running Electron dev app and the user's full-format Markdown test document:
  - `evidence/screenshots/runtime-body-action-group-v9.png`
  - `evidence/screenshots/runtime-body-more-menu-v9.png`
  - `evidence/screenshots/runtime-body-clear-confirm-v9.png`
  - `evidence/screenshots/runtime-add-supplement-menu-v9.png`
  - `evidence/screenshots/runtime-new-segment-menu-v9.png`
  - `evidence/screenshots/runtime-note-supplement-action-group-v9.png`
  - `evidence/screenshots/runtime-note-supplement-editor-focused-v9.png`
  - `evidence/screenshots/runtime-transcript-action-group-v9.png`
  - `evidence/screenshots/runtime-transcript-more-menu-v9.png`
  - `evidence/screenshots/runtime-transcript-clear-confirm-v9.png`
  - `evidence/screenshots/runtime-transcript-editor-overlay-v9.png`
- Runtime metrics: `evidence/runtime-state-metrics.json`. Checks passed: ExpressionDock region absent in all captured Memory Studio states; primary body menu is `重命名` / `清空正文`; primary transcript menu is `重命名` / `清空转录`; active `正文`, `转录`, and Note supplement edit buttons appear before `补充` with a 4px gap; `新片段` exposes `录音` and `笔记`; frontmatter, raw ATX H1 marker, `[TOC]`, and dev feedback toolbar are hidden in evidence screenshots.

## Follow-up: blind review v10 editor surface and empty-state findings

- Independent blind multi-state review result: FAIL. Blockers were that Note and Transcript editor screenshots still read as two separate editor implementations, the captured read state did not prove the larger Markdown preview surface, and transcript/recording actions still needed stronger owner evidence. Major findings also flagged implementation-exposing clear confirmation copy and raw `16015B` size text.
- RED command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/WorkspaceDangerConfirmDialog.test.tsx -t "renders finalized Note segments as markdown content|uses supplement-specific empty copy|window titlebar for navigation|clears primary Segment transcript|compact danger confirmation"`.
- RED result: failed as expected. Note Segment card still showed raw `32B`, empty Note supplement panel had no inline `写补充笔记` CTA, Note editor surface had no `Markdown 笔记` type strip, and clear confirmation copy still referenced a menu undo boundary.
- GREEN change: Note editor surface now has a `Markdown 笔记` type strip next to the lightweight toolbar and surface-level save action; empty Note supplement content renders `写补充笔记` when editable; clear confirmation copy describes the durable empty save and manual recovery path without mentioning a menu; Note Segment card byte count uses a human-readable size label.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/WorkspaceDangerConfirmDialog.test.tsx -t "renders finalized Note segments as markdown content|uses supplement-specific empty copy|window titlebar for navigation|clears primary Segment transcript|compact danger confirmation"`.
- GREEN result: passed. 4 renderer test files passed, 5 tests passed, 172 skipped.
- Focused single-file reruns:
  - `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx` passed. 51 tests passed.
  - `npm run test:renderer -- src/renderer/src/workspace/NoteEditorOverlay.test.tsx` passed. 4 tests passed.
  - `npm run test:renderer -- src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx` passed. 4 tests passed.
  - `npm run test:renderer -- src/renderer/src/workspace/WorkspaceDangerConfirmDialog.test.tsx` passed. 1 test passed.
- Typecheck: `npm run typecheck:quick` passed.
- Runtime screenshots were regenerated through CDP against the running Electron dev app and the user's full-format Markdown test document:
  - `evidence/screenshots/runtime-body-action-group-v11.png`
  - `evidence/screenshots/runtime-markdown-list-preview-v11.png`
  - `evidence/screenshots/runtime-markdown-code-table-preview-v11.png`
  - `evidence/screenshots/runtime-body-more-menu-v11.png`
  - `evidence/screenshots/runtime-body-clear-confirm-v11.png`
  - `evidence/screenshots/runtime-new-segment-menu-v11.png`
  - `evidence/screenshots/runtime-add-supplement-menu-v11.png`
  - `evidence/screenshots/runtime-empty-note-supplement-v11.png`
  - `evidence/screenshots/runtime-note-supplement-editor-focused-v11.png`
  - `evidence/screenshots/runtime-transcript-action-group-v11.png`
  - `evidence/screenshots/runtime-transcript-more-menu-v11.png`
  - `evidence/screenshots/runtime-transcript-clear-confirm-v11.png`
  - `evidence/screenshots/runtime-transcript-editor-overlay-v11.png`
- Runtime metrics:
  - `evidence/runtime-state-metrics-v11.json` records viewport `1200x800` at DPR 2, hidden dev feedback overlay, human-readable byte labels, Markdown read-state scroll evidence, empty supplement CTA, `Markdown 笔记` strip, and `转录文本` strip.
  - `evidence/runtime-menu-metrics-v11.json` records transcript More menu items `重命名` / `清空转录` and clear confirmation copy without implementation-specific menu wording.
- Diff hygiene command: `git diff --check` passed.
- Latest typecheck rerun: `npm run typecheck:quick` passed.

## Follow-up: unified lightweight editor and primary More menu restore

- Root cause: current code had no CM6 / CodeMirror runtime in `src`, `package.json`, or `package-lock.json`, but `TranscriptEditorOverlay` and `NoteEditorOverlay` had diverged into two editor surfaces. `SegmentContentActionsMenu` had also been over-trimmed: primary `正文` / `转录` More menus lost path and edit actions that remain part of the content slot workflow.
- RED command: `npm run test:renderer -- src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "path, edit, rename, and clear|same lightweight Markdown controls|renders finalized Note segments as markdown content|shows finalized recording supplements as content rail tabs"`.
- RED result: failed as expected. More menus only returned `重命名` / `清空正文` or `重命名` / `清空转录`, and Transcript editor had no `Markdown 格式工具栏`.
- GREEN change: added `LightweightMarkdownEditorSurface` and routed Note body, Note supplement and Transcript editing through that shared textarea-first surface. Transcript now shows `Markdown 转录` with the same lightweight toolbar and selection transforms as notes. `SegmentContentActionsMenu` restores path actions, edit action, rename and clear while still excluding generate/regenerate/delete. Memory Studio wires body/transcript More edit actions to the same edit targets as the visible rail edit button.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "path, edit, rename, and clear|same lightweight Markdown controls|renders finalized Note segments as markdown content|shows finalized recording supplements as content rail tabs"`.
- GREEN result: passed. 3 renderer test files passed, 4 tests passed, 54 skipped.
- Broader focused renderer command: `npm run test:renderer -- src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`.
- Broader focused renderer result: passed. 4 renderer test files passed, 62 tests passed.
- Source residue check: `rg -n "@codemirror|codemirror|CodeMirror|cm6|EditorView|note-cm6|markdownLivePreview|CodeMirrorNoteEditor" src package.json package-lock.json` returned no matches.

## Final Review And Verification

- `/review` / `/ycksimplify` result: three independent code-quality passes reviewed reuse, quality and efficiency. Accepted fixes included routing clear-body through the shared finalized-note save helper, extracting textarea selection restore, guarding dirty inline edits across segment/tab/create flows, keeping unfenced `title:\n---` user content visible, limiting same-snapshot content refresh to active observed queries, and memoizing read-mode empty checks.
- One reviewer recommendation to delete inline finalized Note editing and restore overlay finalized editing was rejected because the current product requirement is direct Memory Studio editing for `正文`、`转录` 和 `补充笔记`; the current implementation keeps a single shared textarea-first surface rather than two finalized editing models.
- Focused tests:
  - `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx` passed. 2 files, 63 tests.
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "detects body-only Note editor refresh when the Workspace snapshot is unchanged"` passed.
- Static verification:
  - `npm run typecheck:quick` passed.
  - `npm run lint:strict` passed.
  - `npm run format:check` passed.
  - `git diff --check` passed.
- Full verification:
  - `npm run verify:quick` passed. Main tests: 816 passed. Renderer tests: 50 files, 512 tests passed. `lint:strict` passed. `format:check` passed.
  - `npm run build:app` passed.
- Heavy editor residue check: `rg -n "@codemirror|codemirror|CodeMirror|cm6|CM6|EditorView|note-cm6|markdownLivePreview|CodeMirrorNoteEditor|Tiptap|ProseMirror|BlockNote|edit-segment" src docs/current docs/initiatives docs/decisions package.json package-lock.json` returned only a `package-lock.json` integrity hash containing `CM6`; no source, docs direction, dependency, or editor target residue remains.
- Runtime evidence retained: final `v14` screenshots and metrics remain under `evidence/screenshots/*-v14.png`, `evidence/runtime-state-metrics-v14.json`, and `evidence/runtime-menu-metrics-v14.json`. Earlier temporary screenshot iterations were removed to keep the repository evidence small.

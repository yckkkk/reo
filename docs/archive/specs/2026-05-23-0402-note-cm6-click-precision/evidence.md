# Evidence

## External Reference

- Context7 查询 CodeMirror 6 文档失败：月度额度已用尽。
- Official fallback: CodeMirror reference states `EditorView.posAtCoords` maps screen coordinates to document positions and may return an estimated position when called with `precise: false`; `posAtDOM` maps DOM nodes inside editor content back to document positions.

## T1/T2 RED

- RED command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "clicked visual source line"`.
- RED result: failed as expected. The test clicked the first visual read-preview line while simulating a CM6 coordinate estimate for the adjacent paragraph; selection landed on source line 3 instead of source line 1.
- Root cause: read-preview line clicks trusted `posAtCoords(..., false)` once `domAtPos` appeared to point back into the clicked `.cm-line`. In live-preview/widget geometry that estimate can describe an adjacent source line; the clicked visual line did not carry a source-line range to validate the estimate.

## T2 Complex Block RED

- RED command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "reveals"`.
- RED result: failed as expected for horizontal rule, table, details, HTML block, math block, blockquote and container callout. Each clicked widget entered textbox/edit mode but the read-preview `Decoration.replace` widget stayed mounted instead of revealing the Markdown source.
- Additional observation: fenced code block clicks already removed the widget and selected the code body source line; the test expectation was corrected to assert that source line instead of the opening fence.
- Root cause: several block preview ranges did not stop their replacement decoration when the edit-mode selection landed inside the same Markdown source range, so the source remained covered and could not be directly edited or deleted.

## T3/T4 GREEN

- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "reveals"`.
- GREEN result: passed. The matrix covers horizontal rule, table, details, HTML block, math block, blockquote, container callout and fenced code.
- Focused command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx`.
- Focused result: passed, 60 tests.

## T6 Blind Visual Review Inputs

- Screenshot source command: `node scripts/verify-note-cm6-runtime.mjs --case full-markdown-visual --port 9340 --markdown-file "/Users/yck/Downloads/PM/技术线/reo文件区/Markdown 全格式测试文档.md" --surface memory --screenshot-mode viewport --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/blind-review-full-preview.png --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/blind-review-full-preview.json`.
- Screenshot source command: `node scripts/verify-note-cm6-runtime.mjs --case full-markdown-visual --port 9340 --markdown-file "/Users/yck/Downloads/PM/技术线/reo文件区/Markdown 全格式测试文档.md" --surface overlay --focus-line 1 --screenshot-mode viewport --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/blind-review-overlay-edit-top.png --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/blind-review-overlay-edit-top.json`.
- Screenshot source command: `node scripts/verify-note-cm6-runtime.mjs --case full-markdown-visual --port 9340 --markdown-file docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/blind-review-setext-input-fixture.md --surface overlay --focus-line 2 --screenshot-mode viewport --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/blind-review-setext-input-bug.png --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/blind-review-setext-input-bug.json`.
- Screenshot source command: `node scripts/verify-note-cm6-runtime.mjs --case full-markdown-visual --port 9340 --markdown-file docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/blind-review-blank-line-fixture.md --surface overlay --focus-line 2 --screenshot-mode viewport --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/blind-review-blank-line-rail.png --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/blind-review-blank-line-rail.json`.
- Reference target thumbnail: `docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/pdf-reference/Markdown 全格式测试文档.pdf.png`, generated from `/Users/yck/Downloads/PM/技术线/reo文件区/Markdown 全格式测试文档.pdf`.
- Blind review agents: `019e5493-2e4a-7af0-aa0d-1380b0613385` and `019e5493-6c91-7820-93ae-6648a252b2cd`.
- Blind prompt constraints: no product name, no repo name, no technology stack, no implementation route, no CM6 mention; review only a正在构建的 Markdown 编辑器 against mature Markdown editor quality.

## T6 Blind Review Result

- Agent `019e5493-2e4a-7af0-aa0d-1380b0613385`: FAIL. It judged the editor not suitable for ordinary users because visible input, semantic interpretation, cursor feedback and command reliability are not trustworthy.
- Agent `019e5493-6c91-7820-93ae-6648a252b2cd`: FAIL. It identified unpredictable basic input, unclear live-preview boundaries and unreliable toolbar/shortcut behavior as the top release blockers.
- Shared blocker: this is not a visual polish issue. The minimum fix scope is editing stability: every typed character must remain visible and controllable; the current editing line/range must not be stolen by preview rendering; blank-line caret/current-line feedback must remain full-height; toolbar and keyboard shortcuts must dispatch the same editor transactions.

## Editing Stability RED/GREEN

- RED command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "setext underline|blank lines|shortcuts"`.
- RED result: failed as expected. Setext underline typing kept the previous line styled as heading, blank-line compression applied in edit mode, and common Markdown shortcuts were not wired to the CM6-first editor keymap.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "setext underline|blank lines|shortcuts"`.
- GREEN result: passed, 3 tests.
- Focused command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx`.
- Focused result: passed, 63 tests.
- Runtime setext command: `node scripts/verify-note-cm6-runtime.mjs --case full-markdown-visual --port 9340 --markdown-file docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/blind-review-setext-input-fixture.md --surface overlay --focus-line 2 --screenshot-mode viewport --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-setext-input-stable.png --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-setext-input-stable.json`.
- Runtime setext result: passed; metrics show `headingCount: 0`, visible text includes `Draft title` and `-`.
- Runtime blank-line command: `node scripts/verify-note-cm6-runtime.mjs --case full-markdown-visual --port 9340 --markdown-file docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/blind-review-blank-line-fixture.md --surface overlay --focus-line 2 --screenshot-mode viewport --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-blank-line-rail-stable.png --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-blank-line-rail-stable.json`.
- Runtime blank-line result: passed; metrics show active line 2 remains the empty source line in textbox mode.
- Runtime special interaction command: `node scripts/verify-note-cm6-runtime.mjs --case markdown-special-interaction --port 9340 --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-markdown-special-interaction.png --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-markdown-special-interaction.json`.
- Runtime special interaction result: passed; metrics show code language badge hover background, click copy payload, `已复制` state, selectable special widgets, source-anchor clicks and CM6 transaction edit.
- Typecheck command: `npm run typecheck:quick`.
- Typecheck result: passed.
- Format command: `npm run format:check`.
- Format result: passed after formatting the touched source/spec fixture files.

## T7 Single Editor Path RED/GREEN

- RED command: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx -t "passes paste events"`.
- RED result: failed as expected. `MarkdownContentSurface` editing mode rendered `[data-slot="codemirror-note-editor"]` instead of `[data-slot="note-markdown-editor"]`.
- Root cause: `MarkdownContentSurface` still exposed an alternate editor engine path and defaulted editing mode to that alternate path when the caller did not force `editorEngine="note-cm6"`. Some tests passed only because they explicitly forced the new engine.
- GREEN changes: `MarkdownContentSurface` now mounts only `NoteMarkdownEditor`; inline paste/drop/dragover are forwarded into `NoteMarkdownEditor`; inline-to-overlay handoff uses `NoteMarkdownEditorOwner`; runtime fixture `content-widget-soft-flat` uses `NoteMarkdownEditor`; the standalone alternate editor implementation and its tests were removed.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx -t "passes paste events"`.
- GREEN result: passed.
- Focused command: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx`.
- Focused result: passed, 21 tests.
- Focused command: `npm run test:renderer -- src/renderer/src/workspace/NoteEditorOverlay.test.tsx`.
- Focused result: passed, 13 tests.
- Focused command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx`.
- Focused result: passed, 63 tests.
- Focused command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "note|Note|codemirror-note-editor|笔记"`.
- Focused result: passed, 20 tests.
- Combined focused command after formatting: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx`.
- Combined focused result: passed, 97 tests.
- Typecheck command: `npm run typecheck:quick`.
- Typecheck result: passed.
- Format command: `npm run format:check`.
- Format result: passed.
- Search command: `rg -n "CodeMirrorNoteEditor|createCodeMirrorNoteEditorOwner|CodeMirrorNoteEditorOwner|CodeMirrorNoteEditorHandoff|markdownLivePreview|editorEngine" src/renderer/src scripts/verify-note-cm6-runtime.mjs`.
- Search result: no matches.
- Runtime user repro command: `node scripts/verify-note-cm6-runtime.mjs --case full-markdown-visual --host 127.0.0.1 --port 9341 --markdown-file docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/user-hyphen-repro-fixture.md --surface overlay --focus-line 2 --screenshot-mode viewport --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-user-hyphen-repro.png --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-user-hyphen-repro.json`.
- Runtime user repro result: passed; metrics show `activeLineNumber: 2`, `activeLineText: "-"`, `headingCount: 0`, `contentRole: "textbox"` and `failures: []`.

## T8 Setext Edit-Mode Stability RED/GREEN

- Diagnostic keyboard command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "real keyboard input types text"`.
- Diagnostic keyboard result: passed in jsdom, so direct keyboard simulation did not reproduce the user screenshot.
- RED command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "setext heading source raw everywhere"`.
- RED result: failed as expected. In edit mode, `Draft title\n-` styled the previous line as `.cm-reo-md-heading-2` when the cursor was away from the Setext block; the line also received duplicate heading classes from two decoration passes.
- Root cause: Setext heading line styling still ran in edit mode outside the active selection range. That made a newly typed `-` capable of turning the previous line into a live-preview heading when selection or remount timing did not touch the Setext node.
- GREEN change: Setext heading rendering is now read-preview-only. Edit mode always leaves Setext source raw, while ATX heading preview remains available in edit mode.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "setext heading source raw everywhere|setext underline|hyphen|real keyboard input"`.
- GREEN result: passed, 5 tests.
- Focused command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx`.
- Focused result: passed, 68 tests.
- Runtime command: `node scripts/verify-note-cm6-runtime.mjs --case full-markdown-visual --host 127.0.0.1 --port 9343 --markdown-file docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/user-setext-raw-edit.fixture --surface overlay --focus-line 2 --screenshot-mode viewport --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-user-setext-raw-edit-after-fix.png --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-user-setext-raw-edit-after-fix.json`.
- Runtime result: passed; metrics show `activeLineNumber: 2`, `activeLineText: "-"`, `activeText: "你好\n-\n"`, `headingCount: 0`, `contentRole: "textbox"` and `failures: []`.

## T9 Memory Inline Click Anchor RED/GREEN

- RED command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "blank-line clicks"`.
- RED result: failed as expected. A read-preview pointerdown whose DOM target was `.cm-content` and whose CM6 coordinate estimate pointed at line 1 selected source line 1 instead of the clicked blank source line 2.
- Root cause 1: empty-line and line-gap clicks can target `.cm-content` instead of `.cm-line`; the old fallback trusted `posAtCoords` before consulting CM6 visual line height.
- GREEN change 1: read-preview click resolution now uses `EditorView.lineBlockAtHeight` for no-line DOM targets before falling back to `posAtCoords`.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "blank-line clicks|clicked visual source line"`.
- GREEN result: passed, 2 tests.
- RED command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "clicked source line"`.
- RED result: failed as expected. The real Memory Studio inline path clicked source line 2 but the newly mounted inline editor selection landed on line 1.
- Root cause 2: `MarkdownContentSurface` passed the clicked anchor to `MemoryStudio`, but `MemoryStudio` discarded it when creating the inline draft; the key change from read preview to inline editor remounted `NoteMarkdownEditor` with default selection.
- GREEN change 2: inline draft stores `initialSelectionAnchor`; `MarkdownContentSurface` forwards it to `NoteMarkdownEditor`; `NoteMarkdownEditor` uses it to initialize selection when no handoff state exists. Segment and SegmentSupplement inline paths share the same contract.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "clicked source line"`.
- GREEN result: passed.
- Runtime command before runtime click-helper repair: `node scripts/verify-note-cm6-runtime.mjs --case full-markdown-visual --host 127.0.0.1 --port 9343 --markdown-file docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/user-blank-line-click.fixture --surface memory --click-line 2 --insert-text - --screenshot-mode viewport --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-user-blank-line-click-typed-memory-after-anchor-fix.png --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-user-blank-line-click-typed-memory-after-anchor-fix.json`.
- Runtime result before runtime click-helper repair: failed diagnostic despite product tests passing; metrics showed `activeLineNumber: 1` and `activeText: "-你好\n\n"`. The runtime helper clicked a coordinate computed from `lineBlockAt`, which still landed on the first visual line for the blank-line fixture.
- Runtime helper change: `prepareVisualLineClick` now clicks the real `.cm-line[data-cm-source-line-number]` DOM rectangle center when available, instead of synthesizing blank-line coordinates only from `lineBlockAt`.
- Runtime command after repair: `node scripts/verify-note-cm6-runtime.mjs --case full-markdown-visual --host 127.0.0.1 --port 9343 --markdown-file docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/user-blank-line-click.fixture --surface memory --click-line 2 --insert-text - --screenshot-mode viewport --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-user-blank-line-click-typed-memory-after-dom-click-fix.png --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-user-blank-line-click-typed-memory-after-dom-click-fix.json`.
- Runtime result after repair: passed; metrics show `activeLineNumber: 2`, `activeLineText: "-"`, `activeText: "你好\n-\n"`, `headingCount: 0`, `contentRole: "textbox"` and `failures: []`.
- Focused command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "clicked source line|bottom expression track|blank CodeMirror"`.
- Focused result: passed, 3 tests.
- Combined focused command: `npm run test:renderer -- src/renderer/src/workspace/MarkdownContentSurface.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx`.
- Combined focused result: passed, 34 tests.
- Typecheck command: `npm run typecheck:quick`.
- Typecheck result: passed after removing an unreachable edit-mode Setext branch.
- Format command: `npm run format:check`.
- Format result: passed.
- Dev restart command: `npm run dev`.
- Dev restart result: main and preload built, renderer dev server is available at `http://localhost:5183/`, and Electron reported `[Main] App ready`.

## T10 Overlay Single-Editor Ownership RED/GREEN

- RED command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "unmounts the matching note supplement surface"`.
- RED result: failed as expected. When the immersive editor owned a matching Note SegmentSupplement, Memory Studio still rendered the background `markdown-content-surface` and kept a second CM6 surface mounted.
- GREEN change 1: `LoadedWorkspaceFrame` passes the active Note editor target to `MemoryStudio`; matching Note Segment and Note SegmentSupplement surfaces render a handoff placeholder instead of `MarkdownContentSurface` while the overlay owns the session.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "unmounts the matching note supplement surface"`.
- GREEN result: passed.
- RED command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "opens immersive Note supplement editing"`.
- RED result: failed as expected. The inline supplement editor remained mounted after inline-to-overlay handoff, so the same note had a background textbox plus the overlay textbox.
- GREEN change 2: SegmentSupplement inline-to-overlay handoff clears the matching inline draft, editor view and composition state after transferring the owner to the overlay.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "opens immersive Note supplement editing"`.
- GREEN result: passed.
- Combined focused command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "unmounts the matching note supplement surface|opens immersive Note supplement editing|opens immersive Note editing from inline"`.
- Combined focused result: passed, 3 tests.

## T11 Overlay Toolbar Geometry RED/GREEN

- RED command: `npm run test:renderer -- src/renderer/src/workspace/NoteEditorOverlay.test.tsx -t "opens the immersive markdown formatting toolbar"`.
- RED result: failed as expected. The toolbar dock still used the right-side action band and the editor pane still applied extra `px-24` outer padding.
- GREEN change: the immersive Markdown toolbar is centered under the titlebar with `left-1/2 -translate-x-1/2`, and the outer CodeMirror pane no longer adds horizontal padding on top of the CM6 document layout.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/NoteEditorOverlay.test.tsx -t "opens the immersive markdown formatting toolbar"`.
- GREEN result: passed.
- Combined focused command: `npm run test:renderer -- src/renderer/src/workspace/NoteEditorOverlay.test.tsx -t "opens the immersive markdown formatting toolbar|focused without showing"`.
- Combined focused result: passed, 2 tests.
- Typecheck command: `npm run typecheck:quick`.
- Typecheck result: passed.
- Runtime dev-open command: `node scripts/verify-note-cm6-runtime.mjs --case memory-space-open-dev --host 127.0.0.1 --port 9344 --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/runtime-real-memory-space-open-after-layout-fix.json`.
- Runtime dev-open result: passed; the real Electron dev app opened Memory Studio without blocking editor exceptions or CSP violations.
- Runtime real supplement overlay evidence: `docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/runtime-real-supplement-overlay-single-editor.json` and `docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/runtime-real-supplement-overlay-single-editor.png`.
- Runtime real supplement overlay result: passed. Metrics show `editorCount: 1`, `overlayEditorCount: 1`, `backgroundEditorCount: 0`, `handoffSurfaceCount: 1`, `editHeadingCount: 0`, raw edit lines `你好` and `-`, `contentRole: "textbox"`, and toolbar center `720` aligned with editor/dialog/content center `720`.
- Post-format check command: `npx prettier --check docs/current/flow.md docs/current/frontend.md docs/current/design-system/DESIGN.md docs/current/quality.md docs/specs/2026-05-23-0402-note-cm6-click-precision/tasks.md docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence.md src/renderer/src/App.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.tsx src/renderer/src/workspace/MemoryStudio.tsx src/renderer/src/workspace/NoteEditorOverlay.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx`.
- Post-format check result: passed.
- Post-format focused command: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx -t "unmounts the matching note supplement surface|opens immersive Note supplement editing|opens immersive Note editing from inline|opens the immersive markdown formatting toolbar|focused without showing"`.
- Post-format focused result: passed, 5 tests.
- Post-format typecheck command: `npm run typecheck:quick`.
- Post-format typecheck result: passed.
- Post-format runtime dev-open command: `node scripts/verify-note-cm6-runtime.mjs --case memory-space-open-dev --host 127.0.0.1 --port 9344 --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/runtime-real-memory-space-open-after-final-format.json`.
- Post-format runtime dev-open result: passed; no blocking renderer editor exceptions or CSP violations, and Memory Studio plus a CM6 editor were visible in the current Electron dev app.
- User-run build command: `npm run build:app`.
- User-run build result: passed. `electron-vite build --ignoreConfigWarning` built main, preload and renderer production outputs successfully; the output included Node `[DEP0205] module.register()` deprecation warning and normal production asset size listings, but no build failure.

## T12 Setext Default Highlighter Neutralization RED/GREEN

- RED command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "setext heading text visually plain"`.
- RED result: failed as expected. The title line had no Reo preview heading class, but `getComputedStyle(titleText).fontWeight` was `bold`; the style came from CodeMirror's default markdown heading highlighter, not from Reo Live Preview decorations.
- Root cause: `syntaxHighlighting(defaultHighlightStyle, { fallback: true })` applies Lezer heading tags for `SetextHeading1/...` and `SetextHeading2/...`. Reo had disabled Setext preview decorations in edit mode, but did not neutralize the default highlighter's generated heading span styles.
- GREEN change: edit-mode Setext source ranges receive `cm-reo-md-setext-source`, and the editor theme resets font weight and text decoration for that source range only. Read-mode Setext preview and ATX edit-mode heading behavior are unchanged.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "setext heading text visually plain|setext heading source raw everywhere|setext underline|hyphen|real keyboard input"`.
- GREEN result: passed, 6 tests.
- Runtime command: `node scripts/verify-note-cm6-runtime.mjs --case full-markdown-visual --host 127.0.0.1 --port 9344 --markdown-file docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/user-setext-default-highlight.fixture --surface overlay --focus-line 5 --screenshot-mode viewport --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-user-setext-default-highlight-overlay.png --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-user-setext-default-highlight-overlay.json`.
- Runtime result: passed. Metrics show `contentRole: "textbox"`, `activeText: "你好\n=\n\n-\n\n"`, `headingCount: 0`, `visibleTextSample: "你好\n\n=\n\n-"`, and screenshot evidence shows `你好` rendered as plain text while raw `=` and `-` remain visible.
- Full focused command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx`.
- Full focused result: passed, 69 tests.
- Typecheck command: `npm run typecheck:quick`.
- Typecheck result: passed.
- Format command: `npx prettier --check docs/current/quality.md docs/specs/2026-05-23-0402-note-cm6-click-precision/tasks.md docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence.md src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.tsx src/renderer/src/workspace/note-cm6/markdownExtensions.ts`.
- Format result: passed.
- Build command: `npm run build:app`.
- Build result: passed. The output included the existing Node `[DEP0205] module.register()` deprecation warning and normal production asset size listings, but no build failure.
- Dev restart command: `REMOTE_DEBUGGING_PORT=9344 ELECTRON_ENABLE_LOGGING=1 npm run dev`.
- Dev restart result: main and preload built, renderer dev server is available at `http://localhost:5183/`, DevTools is listening on port `9344`, and Electron reported `[Main] App ready`.
- Post-restart runtime command: `node scripts/verify-note-cm6-runtime.mjs --case memory-space-open-dev --host 127.0.0.1 --port 9344 --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/runtime-real-memory-space-open-after-setext-highlighter-fix.json`.
- Post-restart runtime result: passed; no blocking renderer editor exceptions or CSP violations, and Memory Studio plus a CM6 editor were visible in the cleanly restarted Electron dev app.

## T13 Complex Preview Click Geometry RED/GREEN

- Diagnostic runtime command: `node scripts/verify-note-cm6-runtime.mjs --case long-doc-click-geometry --host 127.0.0.1 --port 9344 --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/diagnostic-long-doc-click-geometry-current.json --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/diagnostic-long-doc-click-geometry-current.png`.
- Diagnostic runtime result: passed for plain visible source line clicks, so the remaining user bug was not pure-text line mapping.
- RED command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "visible DOM line geometry"`.
- RED result: failed as expected. When a read-preview click target was `.cm-content` whitespace at the visual y-position of line 3, `lineBlockAtHeight` estimated line 1 and selection landed on source line 1.
- GREEN change 1: read-preview clicks that do not target a concrete `.cm-line` first inspect visible source-bearing DOM line/widget rectangles and use the nearest matching source anchor before falling back to CM6 height/coordinate estimates.
- GREEN command 1: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "visible DOM line geometry|blank-line clicks|clicked visual source line"`.
- GREEN result 1: passed, 3 tests.
- RED command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "edit-mode click lands beside an inactive block widget"`.
- RED result: failed as expected. In edit mode, clicking `.cm-content` whitespace beside an inactive code block left selection on line 1 instead of the code block source line.
- GREEN change 2: edit-mode clicks that do not target a concrete `.cm-line` or widget action also use visible source-bearing DOM geometry, so inactive preview block side whitespace maps to that block source instead of CM6's stale estimate.
- GREEN command 2: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "edit-mode click lands beside an inactive block widget|visible preview widget geometry|visible DOM line geometry|blank-line clicks|clicked visual source line"`.
- GREEN result 2: passed, 5 tests.
- Focused command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx`.
- Focused result: passed, 72 tests.
- Typecheck command: `npm run typecheck:quick`.
- Typecheck result: passed.
- Format command: `npx prettier --check src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.tsx src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx src/renderer/src/workspace/note-cm6/markdownExtensions.ts`.
- Format result: passed.
- Runtime fixture load command: `node scripts/verify-note-cm6-runtime.mjs --case full-markdown-visual --host 127.0.0.1 --port 9344 --markdown-file docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/user-complex-block-click.fixture --surface overlay --screenshot-mode viewport --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-complex-block-click-fixture-loaded-2.png --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/green-complex-block-click-fixture-loaded-2.json`.
- Runtime fixture load result: passed; metrics showed one code widget and one table widget in edit mode.
- Runtime CDP probe: clicked `.cm-content` whitespace beside the visible code block, with `beforeTarget: "cm-content cm-lineWrapping"` and widget `data-cm-source-from: 10`.
- Runtime CDP probe result: passed; post-click metrics showed `activeLineNumber: 4`, `activeLineText: "const value = 1;"`, `selectionAnchor: 10`, `codeWidgetCount: 0`, and `toolbarState: "open"`.
- Dev restart command: `REMOTE_DEBUGGING_PORT=9344 ELECTRON_ENABLE_LOGGING=1 npm run dev`.
- Dev restart result: main and preload built, renderer dev server is available at `http://localhost:5183/`, DevTools is listening on port `9344`, and Electron reported `[Main] App ready`.
- Post-restart runtime command: `node scripts/verify-note-cm6-runtime.mjs --case memory-space-open-dev --host 127.0.0.1 --port 9344 --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/runtime-real-memory-space-open-after-click-geometry-fix.json`.
- Post-restart runtime result: passed; no blocking renderer editor exceptions or CSP violations, and Memory Studio plus a CM6 editor were visible in the cleanly restarted Electron dev app.
- Build command: `npm run build:app`.
- Build result: passed. The output included the existing Node `[DEP0205] module.register()` deprecation warning and normal production asset size listings, but no build failure.

## T14 Source-Line Keyboard Navigation RED/GREEN

- Context7 query result: quota exhausted, so official CodeMirror reference was used.
- Official reference: CodeMirror `moveVertically` moves to the next visual line including wrapped lines, `EditorView.atomicRanges` can make cursor motion skip regions, `KeyBinding.run` returning `false` allows later bindings, and keymap precedence decides which handler runs first.
- RED command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "moves through inactive preview block source lines"`.
- RED result: failed as expected. ArrowDown from the blank line before an inactive fenced code preview landed on source line 7 instead of line 3, and ArrowUp from the blank line after the inactive preview landed on source line 1 instead of line 5.
- Root cause: edit-mode `Decoration.replace` collapses multi-line Markdown source into a block widget. CM6 vertical motion then follows the current visual block geometry, so inactive fenced code/table/HTML/details/math/blockquote/callout preview can be crossed as one visual object rather than as editable Markdown source lines. This is the same class of bug as click geometry: the source of truth is still CM6 doc positions, but the visual widget no longer exposes one DOM line per source line.
- GREEN change: a highest-precedence CM6 keymap handles plain ArrowUp/ArrowDown only in editable mode, only for collapsed selections and only outside IME composition. It moves the selection by Markdown source line in the CM6 document and preserves the source-column where possible, so the preview widget cannot skip opening source, body source, closing source or adjacent blank lines. The key binding does not force `preventDefault` when the command returns `false`, so IME, range selections and boundary-line behavior can fall through to CM6's later handlers. Reo still does not maintain a React line model.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "moves through inactive preview block source lines|real keyboard input types text"`.
- GREEN result: passed, 3 tests.
- Focused command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx`.
- Focused result: passed, 74 tests.
- Typecheck command: `npm run typecheck:quick`.
- Typecheck result: passed.
- Format command before docs update: `npx prettier --check src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.tsx src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx`.
- Format result before docs update: passed.
- Runtime fixture load command: `node scripts/verify-note-cm6-runtime.mjs --case full-markdown-visual --host 127.0.0.1 --port 9344 --markdown-file docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/user-complex-block-click.fixture --surface overlay --focus-line 2 --screenshot-mode viewport --screenshot docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/keyboard-complex-block-fixture-loaded-after-source-line-keymap.png --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/keyboard-complex-block-fixture-loaded-after-source-line-keymap.json`.
- Runtime fixture load result: passed; metrics showed active line 2, one code widget and one table widget in edit mode.
- Runtime CDP ArrowDown probe result: from line 2, four ArrowDown presses selected line 3 opening fence, line 4 `const value = 1;`, line 5 closing fence, then line 6 blank.
- Runtime CDP ArrowUp probe result: from line 6, four ArrowUp presses selected line 5 closing fence, line 4 `const value = 1;`, line 3 opening fence, then line 2 blank.
- Post-doc format command: `npx prettier --check docs/current/frontend.md docs/current/flow.md docs/current/quality.md docs/specs/2026-05-23-0402-note-cm6-click-precision/tasks.md docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence.md src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.tsx src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx src/renderer/src/workspace/note-cm6/markdownExtensions.ts`.
- Post-doc format result: passed.
- Post-doc focused command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx`.
- Post-doc focused result: passed, 74 tests.
- Post-doc typecheck command: `npm run typecheck:quick`.
- Post-doc typecheck result: passed.
- Build command: `npm run build:app`.
- Build result: passed. The output included the existing Node `[DEP0205] module.register()` deprecation warning and normal production asset size listings, but no build failure.
- Runtime dev-open command: `node scripts/verify-note-cm6-runtime.mjs --case memory-space-open-dev --host 127.0.0.1 --port 9344 --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/runtime-real-memory-space-open-after-keyboard-source-line-fix.json`.
- Runtime dev-open result: passed; the real Electron dev app opened Memory Studio without blocking renderer editor exceptions or CSP violations, and a CM6 editor was visible.
- Final refined keymap command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "moves through inactive preview block source lines|real keyboard input types text"`.
- Final refined keymap result: passed, 3 tests.
- Final focused command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx`.
- Final focused result: passed, 74 tests.
- Final typecheck command: `npm run typecheck:quick`.
- Final typecheck result: passed.
- Final build command: `npm run build:app`.
- Final build result: passed. The output included the existing Node `[DEP0205] module.register()` deprecation warning and normal production asset size listings, but no build failure.
- Final runtime dev-open command: `node scripts/verify-note-cm6-runtime.mjs --case memory-space-open-dev --host 127.0.0.1 --port 9344 --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/runtime-real-memory-space-open-after-keyboard-source-line-fix-final.json`.
- Final runtime dev-open result: passed; the real Electron dev app opened Memory Studio without blocking renderer editor exceptions or CSP violations, and a CM6 editor was visible.

## T15/T16 Verify Regression RED/GREEN

- RED command: `npm run verify:quick`.
- RED result: failed in `test:renderer`. `App.test.tsx > inserts a pasted image attachment reference at the finalized Note cursor` could not find the attachment image preview `src`, and `NoteEditorOverlay.test.tsx > opens the immersive markdown formatting toolbar near the focused editor context` could not find the toolbar after clicking the textbox.
- Toolbar root cause: toolbar visibility is Reo chrome state, but the overlay path relied only on CM6 internal `EditorView.domEventHandlers.pointerdown`. In jsdom and React outer-event paths, that coupling can miss the product-level focus signal even though the editor becomes focused. The owner boundary is the React host, not CM6 internals.
- Toolbar GREEN change: `NoteMarkdownEditor` host now opens the toolbar from `onPointerDownCapture` when the CM6 view is editable, while CM6 still owns document selection and transactions.
- Image preview root cause: inline image preview used the block-source reveal predicate. That predicate intentionally treats a cursor at a replacement block range end as touching the source so deletion/reveal remains stable, but for inline image preview the cursor exactly after `![...](...)` is outside the editable image source. After attachment paste, the cursor lands at the source end, so the raw image text stayed visible and the preview node was absent.
- Image preview GREEN change: inline image preview now uses strict selection intersection for its own source range. Selecting inside the image source still reveals raw Markdown, while a collapsed cursor at the source end renders the preview.
- Focused toolbar command: `npm run test:renderer -- src/renderer/src/workspace/NoteEditorOverlay.test.tsx -t "opens the immersive markdown formatting toolbar near the focused editor context"`.
- Focused toolbar result: passed.

## T18 Independent Review, /review and /ycksimplify

- Screenshot cleanup command: `find docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence docs/archive/specs .tmp/visual-evidence -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) -delete`.
- Screenshot cleanup result: active spec evidence images, archived screenshot images and `.tmp/visual-evidence` image files were removed per user disk-space request.
- Blind independent review agents:
  - Architecture/design reviewers returned FAIL for duplicate editor/session/autosave ownership paths, ad hoc click geometry, keyboard source-line patches and overlapping pointer handlers.
  - `/ycksimplify` reviewers returned FAIL for duplicated autosave/cache helpers, duplicate URL policy logic, duplicated CDP helpers, stale README dependency text, unbounded inline draft maps, remote image resource handling and fake/inert controls.
  - `/review` returned FAIL/P1 findings for duplicate autosave, remote image DNS/body timeout, note finalize rollback semantics, markdown link IPC not wired to widgets and untracked source files.
  - Codex static adversarial review returned FAIL with high-severity findings for duplicate autosave, remote image DNS/body timeout, rollback/index-stale semantics and inert markdown link widgets.
- Additional narrow blind review agent result: FAIL. It found multiple live note state/autosave ownership paths, ad hoc inline-to-overlay handoff, custom click/cursor DOM geometry, highest-precedence ArrowUp/ArrowDown patching, overlapping document pointer handlers and stale `NoteEditorSessionController` not wired into production.
- Current verdict after T18: not cleanly shippable. The following were fixed in T19-T21; click/keyboard geometry and preview widget interaction-layer design remain open in T22.

## T19 Single Autosave Source RED/GREEN

- RED command: `npm run test:renderer -- src/renderer/src/workspace/noteAutosaveMachine.test.ts -t "derives cache patches"`.
- RED result: failed as expected with `TypeError: applyNoteBodySave is not a function`, proving save-patch derivation lived only in the duplicate `note-cm6/noteAutosaveMachine`.
- GREEN change: `applyNoteBodySave`, `NoteBodySaveResult` and `NoteBodySavePatch` moved into `src/renderer/src/workspace/noteAutosaveMachine.ts`; `MemoryStudio` imports the shared module; `NoteEditorSessionController` uses the shared autosave type; `src/renderer/src/workspace/note-cm6/noteAutosaveMachine.ts` and its test were deleted.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/noteAutosaveMachine.test.ts src/renderer/src/workspace/note-cm6/NoteEditorSessionController.test.ts -t "derives cache patches|transfers dirty"`.
- GREEN result: passed, 2 tests.
- Search command: `rg -n "note-cm6/noteAutosaveMachine|note-cm6 noteAutosaveMachine|from './noteAutosaveMachine'" src/renderer/src/workspace docs/specs/2026-05-23-0402-note-cm6-click-precision vitest.config.ts -S`.
- Search result: no stale `note-cm6/noteAutosaveMachine` production/test imports remain; matches only refer to the shared workspace-level `noteAutosaveMachine`.

## T20 Markdown Link Opener RED/GREEN

- RED command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "routes link clicks|renders linked images"`.
- RED result: failed as expected. Both ordinary link preview and linked-image preview rendered clickable-looking widgets but did not call the explicit opener.
- GREEN change: `NoteMarkdownEditor` accepts an explicit `onOpenMarkdownLink` callback; `markdownExtensions` routes link widgets and linked-image widgets to that callback without giving widgets direct IPC access; `MarkdownContentSurface` and `NoteEditorOverlay` pass `openMarkdownLinkFromPreview`, which calls `openMarkdownExternalLink` through preload/IPC and surfaces rejected links via toast.
- GREEN command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "routes link clicks|renders linked images"`.
- GREEN result: passed, 2 tests.

## T21 File Safety RED/GREEN

- Attachment RED command: `MAIN_TEST_FILES=test/main/noteAttachments.test.ts npm run test:main -- --test-name-pattern "attachment IPC rejects when the workspace lock is lost"`.
- Attachment RED result: failed as expected after the handle passed entry checks but became unusable during attachment write; the current code still returned `ok: true`.
- Attachment GREEN change: `saveNoteSegmentAttachment` and `saveNoteSegmentSupplementAttachment` accept `assertWorkspaceUsable`; IPC handlers pass the active handle assertion; attachment save checks it before directory preparation, before file open, after payload write and before fsync.
- Attachment GREEN command: `MAIN_TEST_FILES=test/main/noteAttachments.test.ts npm run test:main -- --test-name-pattern "attachment IPC rejects when the workspace lock is lost"`.
- Attachment GREEN result: passed.
- Finalize cleanup RED command: `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "replacement target directory"`.
- Finalize cleanup RED result: failed as expected because path-based cleanup deleted an externally replaced target directory after lock loss.
- Finalize cleanup GREEN change: exposed note finalize target directories are tracked as path plus creation-time `DirectoryIdentity`; cleanup verifies the identity before recursive removal and skips deletion when the path now belongs to a replacement directory.
- Finalize cleanup GREEN command: `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "replacement target directory"`.
- Finalize cleanup GREEN result: passed.
- Focused verification command: `npx prettier --check src/renderer/src/workspace/noteAutosaveMachine.ts src/renderer/src/workspace/noteAutosaveMachine.test.ts src/renderer/src/workspace/note-cm6/NoteEditorSessionController.ts src/renderer/src/workspace/note-cm6/NoteEditorSessionController.test.ts src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.tsx src/renderer/src/workspace/note-cm6/markdownExtensions.ts src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx src/renderer/src/workspace/MarkdownContentSurface.tsx src/renderer/src/workspace/NoteEditorOverlay.tsx src/renderer/src/workspace/openMarkdownLinkFromPreview.ts src/main/noteAttachments.ts src/main/noteDrafts.ts src/main/workspaceIpc.ts test/main/noteAttachments.test.ts test/main/noteDrafts.test.ts vitest.config.ts && npm run test:renderer -- src/renderer/src/workspace/noteAutosaveMachine.test.ts src/renderer/src/workspace/note-cm6/NoteEditorSessionController.test.ts src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx -t "derives cache patches|transfers dirty|routes link clicks|renders linked images" && MAIN_TEST_FILES=test/main/noteAttachments.test.ts npm run test:main -- --test-name-pattern "attachment IPC rejects when the workspace lock is lost" && MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main -- --test-name-pattern "replacement target directory"`.
- Focused verification result: passed. Prettier passed; renderer focused tests passed 4 tests; main focused attachment and finalize cleanup tests passed.
- Focused image paste command: `npm run test:renderer -- src/renderer/src/App.test.tsx -t "inserts a pasted image attachment reference at the finalized Note cursor"`.
- Focused image paste result: passed.
- Related overlay command: `npm run test:renderer -- src/renderer/src/workspace/NoteEditorOverlay.test.tsx`.
- Related overlay result: passed, 13 tests.
- Related CM6 fixture command: `npm run test:renderer -- src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx`.
- Related CM6 fixture result: passed, 74 tests.
- Related App command: `npm run test:renderer -- src/renderer/src/App.test.tsx`.
- Related App result: passed, 121 tests.
- Typecheck command: `npm run typecheck:quick`.
- Typecheck result: passed.
- Format command: `npx prettier --check docs/current/frontend.md docs/current/flow.md docs/current/quality.md docs/specs/2026-05-23-0402-note-cm6-click-precision/tasks.md docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence.md src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.tsx src/renderer/src/workspace/note-cm6/NoteMarkdownEditor.fixture.test.tsx src/renderer/src/workspace/note-cm6/markdownExtensions.ts src/renderer/src/workspace/NoteEditorOverlay.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx`.
- Format result: passed.
- Build command: `npm run build:app`.
- Build result: passed. The output included the existing Node `[DEP0205] module.register()` deprecation warning and normal production asset size listings, but no build failure.
- Verify rerun command after formatting generated evidence JSON: `npm run verify:quick`.
- Verify rerun result: passed. Main tests passed 834/834, renderer tests passed 674/674 across 58 files, `eslint . --max-warnings=0` passed, and both Prettier checks passed.
- Final runtime dev-open command: `node scripts/verify-note-cm6-runtime.mjs --case memory-space-open-dev --host 127.0.0.1 --port 9344 --metrics docs/specs/2026-05-23-0402-note-cm6-click-precision/evidence/runtime-real-memory-space-open-after-final-verify.json`.
- Final runtime dev-open result: passed; metrics show `ok: true`, `failures: []`, no blocking renderer events, no CSP violations, Memory Studio visible and CM6 editor visible at `http://localhost:5183/`.

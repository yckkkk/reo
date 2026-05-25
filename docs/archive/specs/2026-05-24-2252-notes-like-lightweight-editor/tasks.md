# Tasks

- [x] Add Tiptap dependencies and document the package boundary.
- [x] Write RED tests for Markdown import/export and Notes-like formatting behavior.
- [x] Implement a focused Tiptap Markdown adapter for the supported subset.
- [x] Replace `LightweightMarkdownEditorSurface` textarea with the Tiptap editor surface.
- [x] Wire toolbar actions, focus state, dirty state, paste/drop image insertion, and save/cancel behavior.
- [x] Delete old textarea formatting kernel files instead of keeping old and new kernels together.
- [x] Update existing renderer tests from textarea assertions to Markdown-backed rich editor assertions.
- [x] Update current docs only if stable editor truth changes.
- [x] Run focused tests, `npm run verify:quick`, and runtime visual validation.

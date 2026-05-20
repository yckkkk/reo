# Note External Edit Conflict Plan

## Phase 1: RED

1. Main contract tests:
   - `readSegmentContent` and `readSegmentSupplementContent` return `baselineContentHash`.
   - `writeSegmentContent` and `writeSegmentSupplementContent` require `baselineContentHash`.
   - stale finalized note Segment write returns `ERR_SEGMENT_CONTENT_STALE` with current body and current hash.
   - stale finalized note SegmentSupplement write mirrors the Segment behavior.
2. Renderer tests:
   - edit overlay sends baseline hash on save.
   - stale save keeps local body unchanged and opens conflict dialog.
   - "使用磁盘版本" resets body/baseline to disk version.
   - "保留我的修改" retries save with the disk hash baseline.

Gate: run the focused tests and record the expected failures.

## Phase 2: GREEN

1. Extend Zod contracts and bridge types.
2. Add deterministic SHA-256 helper in main note content read/write path.
3. Compare baseline inside the existing workspace lock/write path for note Segment and SegmentSupplement.
4. Add renderer conflict state and AlertDialog behavior to `NoteEditorOverlay`.
5. Keep success cache merge semantics unchanged.

Gate: focused tests green, `npm run verify:quick` green, `/review` pass, `$ycksimplify` pass.

## Phase 3: REFACTOR + Docs

1. Remove duplication introduced during GREEN.
2. Update `docs/current/data.md`, `flow.md`, `frontend.md`, and `quality.md`.
3. Run `npm run verify:quick`.
4. Run `/review` and `$ycksimplify` against archived design plus active sub-spec.
5. Archive this spec after gates pass.

## Known Closeout Dependency

The user-reported content tab rail More menu issue for primary `转录` / `正文` and SegmentSupplement tabs remains a
must-fix before initiative closeout. It is tracked as a closeout item because it is a UI correctness regression from
the note create/edit surface, not part of the external edit storage conflict contract.

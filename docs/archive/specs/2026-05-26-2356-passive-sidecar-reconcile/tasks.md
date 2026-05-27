# Tasks

## Phase 1: Planning Lock

- [x] Commit previous dogfood work before opening this spec.
- [x] Confirm `docs/specs/*` was empty before creating this spec.
- [x] Use `request_user_input` to choose the next spec track.
- [x] Read current foundation, architecture, data, flow, frontend and quality docs relevant to sidecar/live sync.
- [x] Query Context7 for Tiptap official docs and inspect installed `@tiptap/markdown` package types/source when Context7 did not expose enough Markdown API detail.
- [x] Read current Reo sidecar codec, file truth watcher and renderer refresh/invalidation surfaces.

## Phase 2: RED Tests

- [x] Add a focused main test proving a non-selected note Segment existing `content.tiptap.json` JSON change is serialized to `segment.md` by passive workspace file-truth refresh before content selection.
- [x] Add a focused main test proving a non-selected note SegmentSupplement existing `content.tiptap.json` JSON change is serialized to `supplement.md` by passive workspace file-truth refresh before tab selection.
- [x] Add a focused main test proving an audio Segment transcript sidecar JSON change updates only the `## Transcript` body in `segment.md`.
- [x] Add a focused main test proving an audio SegmentSupplement transcript sidecar JSON change updates only the transcript body in `supplement.md`.
- [x] Add a conflict test proving simultaneous Markdown and sidecar edits do not overwrite either file.
- [x] Add invalid/unsupported sidecar tests proving snapshot refresh remains usable and does not claim mirror convergence.
- [x] Run the focused tests and record real RED failures in this spec evidence.

## Phase 3: Implementation

- [x] Add a small main-owned passive sidecar reconcile helper or extend the existing file-truth read path, using existing finalized object identity and `reconcileTiptapContentSidecar`.
- [x] Limit the candidate set to existing `content.tiptap.json` files under legal finalized note/audio Segment and SegmentSupplement directories.
- [x] Preserve frontmatter/title and non-body Markdown when writing note body mirrors.
- [x] Preserve audio object metadata and only replace transcript body when writing audio transcript mirrors.
- [x] Ensure all writes use current workspace lock/root usability checks and existing atomic write helpers.
- [x] Ensure conflicts, invalid sidecars and unsupported Tiptap content preserve files and do not abort unrelated workspace snapshot refresh.
- [x] Ensure passive reconcile does not generate a missing sidecar, clobber a concurrently changed Markdown leaf, or swallow passive write failures into a partial index.
- [x] Avoid new IPC, new query key, new DB, new Zustand store or renderer raw path exposure.

## Phase 4: GREEN And Refactor

- [x] Run focused main tests until GREEN.
- [x] Re-run existing Tiptap sidecar tests: `MAIN_TEST_FILES=test/main/tiptapContentSidecar.test.ts npm run test:main`.
- [x] Re-run relevant workspace file tests if the snapshot refresh path changes.
- [x] Simplify implementation after GREEN: remove duplicate scan logic, keep helper boundaries tied to actual callers, and avoid generic background runtime.
- [x] Re-run the protecting focused tests after refactor.

## Phase 5: Runtime Dogfood

- [x] In the test memory space, pick a non-selected note Segment with existing `content.tiptap.json`.
- [x] Externally edit its sidecar JSON to add a supported colored highlight or underline.
- [x] Wait for passive watcher refresh without clicking the target Segment.
- [x] Inspect Markdown mirror on disk before selecting the Segment.
- [x] Select the Segment and verify UI shows the rich mark without manual refresh/reopen.
- [x] Repeat for a note Supplement or audio transcript sidecar if unit tests found separate write paths.

## Phase 6: Closeout

- [x] Update `docs/current/*` only if the stable file contract or flow wording changes.
- [x] Record evidence and remaining boundaries in this spec.
- [x] Ask the confidence question: do we have factual 100% confidence in the implemented slice?
- [x] Fix every concrete gap found by the confidence audit or explicitly move non-implemented boundaries out of scope.
- [x] Run `npm run verify:quick`.
- [x] Archive this spec when complete.

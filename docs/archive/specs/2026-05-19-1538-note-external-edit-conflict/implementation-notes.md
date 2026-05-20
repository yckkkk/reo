# Note External Edit Conflict Implementation Notes

## 2026-05-19 15:39 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Decision:
  - Start sub-spec (d) after sub-spec (c) passed `npm run verify:quick`, `/review`, and `$ycksimplify`, then moved to
    `docs/archive/specs/2026-05-19-1305-note-attachments-protocol/`.
  - Keep the user-reported content tab rail More menu issue as a required closeout fix before initiative archive, but
    do not mix it into the external edit conflict storage contract.
- Alternatives considered:
  - Add the tab rail More fix into sub-spec (d). Rejected because it would blur the external edit conflict contract and
    make phase gates harder to interpret.
  - Reopen sub-spec (b). Rejected because its archive remains evidence; a follow-up correction can be verified as a
    closeout item after the ordered sub-specs finish.

## 2026-05-19 15:44 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 1 RED evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts,test/main/workspaceContract.test.ts npm run test:main` failed as
    expected:
    - note Segment content read returned no `baselineContentHash`.
    - note SegmentSupplement content read returned no `baselineContentHash`.
    - contract schemas rejected `baselineContentHash` and did not accept `ERR_SEGMENT_CONTENT_STALE` conflict payload.
  - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "edits finalized Note segment markdown|keeps dirty Note segment edits intact"`
    failed as expected:
    - edit save did not send `baselineContentHash`.
    - stale save did not open the external conflict AlertDialog.
- Decision:
  - Treat TypeScript compile failures from the first RED attempt as test-authoring feedback, then cast only the future
    fields in tests so the RED run exercises runtime behavior rather than stopping at type checking.

## 2026-05-19 15:52 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Decision:
  - Implement renderer conflict handling with the existing Radix/shadcn AlertDialog primitive and a single editable
    `baselineContentHash` state in `NoteEditorOverlay`.
  - Keep finalized note external edit detection save-time only; do not introduce a watcher or polling refresh.
- Alternatives considered:
  - Add a renderer-level file watcher or automatic visibility refresh before save. Rejected because the design spec keeps
    no-watcher as a hard boundary and the current sub-spec only needs deterministic save conflict detection.
  - Store both original and current disk bodies in shared App state. Rejected because conflict resolution is local to the
    active editor and query cache only needs the accepted save result.
- Tradeoff:
  - External stale payloads return the current body exactly as the existing Markdown/frontmatter parser reads it. A
    hand-edited file with an extra separator blank line can therefore surface a leading newline; this sub-spec preserves
    parser truth instead of adding normalization in the conflict layer.

## 2026-05-19 15:58 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 2 GREEN evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts,test/main/workspaceContract.test.ts npm run test:main` passed with
    82 tests.
  - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "edits finalized Note segment markdown|keeps dirty Note segment edits intact"`
    passed with 2 targeted tests and 106 skipped.

## 2026-05-19 16:08 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- `$ycksimplify` Phase 2 gate adjustment:
  - `ERR_SEGMENT_CONTENT_STALE` payload is now schema-scoped to stale note content errors only; generic workspace
    errors cannot carry current Markdown body or baseline hash fields.
  - Stale save detection now exits before rollback writes for both note Segment and SegmentSupplement finalized content.
- Reason:
  - The archived design requires conflict payloads for external edit resolution, but also requires no body/hash leakage
    through unrelated error paths and no file watcher or extra disk churn. The previous catch path could rewrite the
    same Markdown and manifest after a stale pre-write check.
- Alternatives considered:
  - Leave the broad optional error fields and rely on call sites. Rejected because the contract should encode the
    narrower payload boundary.
  - Add a separate stale-error envelope type for every response schema. Rejected for Phase 2 because the existing shared
    error envelope can express the invariant with one schema refinement.

## 2026-05-19 16:24 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 2 gate failure and fix:
  - Independent `/review` returned FAIL with three MAJOR findings:
    - finalized note Segment and SegmentSupplement main write helpers still accepted optional `baselineContentHash`;
    - stale error payload typing needed to be enforced by the shared error schema;
    - renderer tests did not cover both conflict resolution actions.
  - Fixes applied:
    - main finalized note write helpers now require `baselineContentHash` and always compare the current disk body hash
      before writing;
    - `$ycksimplify` tightened stale error schema payload ownership;
    - renderer tests now cover `使用磁盘版本` and `保留我的修改`.
- Evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts,test/main/workspaceContract.test.ts npm run test:main` passed with
    82 tests.
  - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "keeps dirty Note segment edits intact|retries a stale Note segment save"`
    passed with 2 targeted tests and 107 skipped.
  - `npm run verify:quick` passed: typecheck, 802 main tests, 464 renderer tests, `lint:strict`, and `format:check`.

## 2026-05-19 16:35 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 docs compression:
  - `docs/current/data.md` now records note content cache ownership of `baselineContentHash` and save success cache
    updates.
  - `docs/current/flow.md` now records save-time stale detection, no-overwrite stale behavior, and renderer conflict
    resolution actions.
  - `docs/current/frontend.md` now records that finalized note edit targets carry a baseline and preserve dirty body on
    conflicts.
  - `docs/current/electron.md` now records the IPC read/write baseline fields for finalized note Segment and
    SegmentSupplement content.
  - `docs/current/quality.md` now records the main and renderer behavior coverage for finalized note external edit
    conflicts.
- Decision:
  - Update `docs/current/electron.md` in addition to the sub-spec's listed current docs because the implementation
    changed IPC request/response contracts. This follows the project hard line that IPC surface changes update the
    Electron current truth.
- Phase 3 verification evidence:
  - `npm run verify:quick` passed: typecheck, 802 main tests, 464 renderer tests, `lint:strict`, and `format:check`.

## 2026-05-19 16:47 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- `$ycksimplify` Phase 3 gate adjustment:
  - Removed stale Phase 1 type casts from finalized note Segment and SegmentSupplement external conflict main tests now
    that the production read result type carries `baselineContentHash`.
- Reason:
  - The casts no longer expressed a current constraint and could hide future contract drift between
    `readFinalizedNoteSegmentContent`, `readFinalizedNoteSegmentSupplementContent`, and their stale-save tests.
- Evidence:
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts,test/main/workspaceContract.test.ts npm run test:main` passed with
    82 tests.
  - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "keeps dirty Note segment edits intact|retries a stale Note segment save"`
    passed with 2 targeted tests and 107 skipped.

## 2026-05-19 16:51 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 gate failure and fix:
  - Independent `/review` returned FAIL with two MAJOR findings:
    - Note editor incorrectly disabled visibility snapshot refresh instead of only keeping refreshed body out of the
      dirty editor state;
    - renderer stale-conflict tests covered Note Segment but not Note SegmentSupplement.
  - RED evidence:
    - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "refreshes non-body workspace projections|handles stale Note SegmentSupplement"`
      failed because `readWorkspaceSnapshot` was called once instead of twice while a dirty Note editor was open. The
      new SegmentSupplement conflict coverage passed because the shared overlay conflict branch already handled it.
  - Fix:
    - Workspace snapshot refresh remains disabled during recording, but no longer exits when `NoteEditorOverlay` is
      open. The overlay keeps dirty body in local state and does not receive refreshed body content by prop mutation.
    - `docs/current/flow.md` now states that Note editor allows non-body refresh while preserving local dirty body.
  - GREEN evidence:
    - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "refreshes non-body workspace projections|handles stale Note SegmentSupplement"`
      passed with 2 targeted tests and 109 skipped.
    - `npm run verify:quick` passed after the fix: typecheck, 802 main tests, 466 renderer tests, `lint:strict`, and
      `format:check`.

## 2026-05-19 17:12 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 re-gate failure and fix:
  - Independent `/review` returned FAIL with one MAJOR finding:
    - visibility refresh now ran while `NoteEditorOverlay` was open, but the overlay still did not implement dirty
      body-change awareness banner or clean editor body reload.
  - Fix:
    - `NoteEditorOverlay` now subscribes to the active finalized note content Query. When refreshed disk body has a new
      baseline and the editor is clean, body and baseline update in place. When the editor is dirty, the local body is
      preserved and the overlay shows `磁盘内容已变化。保存时将进行冲突检查。`.
    - The overlay ignores the stale opening-cache baseline after a save-time conflict action advances the local
      baseline, preventing old Query data from overwriting `使用磁盘版本`.
  - Evidence:
    - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "refreshes non-body workspace projections|reloads a clean Note editor body|handles stale Note SegmentSupplement"`
      passed with 3 targeted tests and 109 skipped.
    - `npm run typecheck:quick` passed.
    - `npm run verify:quick` passed after the dirty banner / clean reload fix: typecheck, 802 main tests, 467
      renderer tests, `lint:strict`, and `format:check`.

## 2026-05-19 17:25 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 re-gate failure and fix:
  - Independent `/review` returned FAIL with one MAJOR finding:
    - same-snapshot visibility refresh returned before invalidating note content queries, so byte-length-neutral
      external body changes could miss the dirty banner / clean reload path.
  - RED evidence:
    - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "body-only Note editor refresh"`
      failed because the dirty banner did not appear when `workspace:readWorkspaceSnapshot` returned an unchanged
      snapshot.
  - Fix:
    - The same-snapshot refresh branch now invalidates the active finalized note editor target's exact Segment content
      or SegmentSupplement content Query while continuing to avoid Memory detail invalidation or snapshot reseeding.
  - GREEN evidence:
    - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "body-only Note editor refresh"`
      passed with 1 targeted test and 112 skipped.

## 2026-05-19 17:20 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Independent `$ycksimplify` Phase 3 re-gate after the dirty visibility-refresh fix:
  - Rechecked changed Phase 3 files against
    `docs/archive/specs/2026-05-19-0111-note-foundation-design/README.md` and
    `docs/archive/specs/2026-05-19-0111-note-foundation-design/engineering-handoff.md`.
  - Confirmed `workspace:readWorkspaceSnapshot` continues while `NoteEditorOverlay` is open; recording remains the
    only overlay state that disables refresh.
  - Confirmed clean finalized note editors reload refreshed body/baseline from the active content Query.
  - Confirmed dirty finalized note editors preserve local body and show
    `磁盘内容已变化。保存时将进行冲突检查。`.
  - Confirmed renderer stale conflict coverage includes Note Segment and Note SegmentSupplement conflict actions.
- Adjustment:
  - `NoteEditorOverlay` now clears the dirty disk-change banner when the user chooses `使用磁盘版本`, because that action
    makes the editor body clean against the accepted disk baseline.
  - Replaced the earlier stale `$ycksimplify` entry that predated the dirty banner / clean reload fix, so Phase 3
    evidence remains chronological and matches the current implementation.
- Evidence:
  - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "refreshes non-body workspace projections|reloads a clean Note editor body|handles stale Note SegmentSupplement"`
    passed with 3 targeted tests and 109 skipped.
  - `MAIN_TEST_FILES=test/main/noteDrafts.test.ts,test/main/workspaceContract.test.ts npm run test:main` passed with
    82 tests.
  - `npm run verify:quick` passed: typecheck, 802 main tests, 467 renderer tests, `lint:strict`, and `format:check`.

## 2026-05-19 17:34 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 current verification after the same-snapshot body-only refresh fix:
  - `npm run verify:quick` passed with the current workspace state: typecheck, 802 main tests, 468 renderer tests,
    `lint:strict`, and `format:check`.
- Gate note:
  - The earlier `$ycksimplify` PASS ran before the same-snapshot body-only refresh test increased the renderer test
    count. It is superseded by the fresh `$ycksimplify` gate below.

## 2026-05-19 17:43 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Fresh `$ycksimplify` gate for active sub-spec d:
  - Reuse review found no remaining Segment vs SegmentSupplement stale-conflict helper blocker; the shared main helper
    remains limited to hash/error/read/write primitives while the product-specific Segment and SegmentSupplement paths
    keep explicit ownership checks.
  - Quality review found the content query workspace helper name still said finalized audio after note content joined the
    same cache family; it now uses the neutral `workspaceContentQueryBelongsToWorkspace` name.
  - Efficiency review found same-snapshot refresh invalidated every Segment and SegmentSupplement content query in the
    workspace, which could refetch active audio byte queries when only the open note editor needs body-only conflict
    detection. The branch now exact-invalidates only the active finalized note edit target's content query.
  - `docs/current/flow.md` now records the narrowed same-snapshot invalidation rule.
  - `implementation-notes.md` now supersedes the stale pre-same-snapshot `$ycksimplify` gate note.
- Verification correction:
  - First wider renderer/typecheck rerun exposed a test-only provider edit leaking into unrelated App tests; the test
    setup was restored before the final evidence below.
- Evidence:
  - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "body-only Note editor refresh"`
    passed with 1 targeted test and 113 skipped.
  - `npm run test:renderer -- --run src/renderer/src/workspace/workspaceQueries.test.ts` passed with 6 tests.
  - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "body-only Note editor refresh|reloads a clean Note editor body|refreshes non-body workspace projections"`
    passed with 3 targeted tests and 111 skipped.
  - `npm run typecheck:quick` passed.
  - `npm run format:check` passed.
  - `npm run lint:strict` passed.

## 2026-05-19 17:43 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 re-gate failure and fix:
  - Independent `/review` returned FAIL with one MAJOR finding:
    - `NoteEditorOverlay` used the opening `target.baselineContentHash` as a long-lived guard against stale cached query
      data after conflict resolution. That also suppressed real future refreshes when disk content returned to the
      opening hash.
  - RED evidence:
    - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "opening hash"` failed because a
      clean editor stayed on `Disk changed by agent` instead of reloading `Disk reverted after conflict`.
  - Fix:
    - Accepting `使用磁盘版本` and `保留我的修改` now writes the conflict disk body/baseline into the active finalized note
      content Query cache. The overlay no longer needs a long-lived opening-hash guard, so later real refetches with the
      same hash can drive clean reload or dirty warning behavior.
  - GREEN evidence:
    - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "opening hash"` passed with 1
      targeted test and 113 skipped.
    - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "refreshes non-body workspace projections|reloads a clean Note editor body|body-only Note editor refresh|opening hash|handles stale Note SegmentSupplement|keeps dirty Note segment edits intact|retries a stale Note segment save"`
      passed with 7 targeted tests and 107 skipped.
    - `npm run typecheck:quick` passed.

## 2026-05-19 17:51 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Verification failure and fix:
  - `npm run verify:quick` failed in full renderer testing after the conflict-query-cache fix. Main tests passed with
    802 tests, but two existing SegmentSupplement delete cache tests failed because their local `queryClient` seeded a
    cached supplement content entry while the rendered App used a separate `ReoQueryProvider` client.
  - Root cause:
    - The failure was test harness ownership, not production delete behavior: the assertions inspected a cache that the
      App could not mutate.
  - Fix:
    - The two SegmentSupplement delete tests now render with `QueryClientProvider client={queryClient}`, matching the
      cache they seed and assert.
  - Evidence:
    - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "deletes a SegmentSupplement through confirmation|keeps a SegmentSupplement hidden"`
      passed with 2 targeted tests and 112 skipped.
    - `npm run typecheck:quick` passed.

## 2026-05-19 17:57 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 current verification after the query cache and test harness fixes:
  - `npm run verify:quick` passed with the current workspace state: typecheck, 802 main tests, 469 renderer tests,
    `lint:strict`, and `format:check`.

## 2026-05-19 18:01 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Fresh `$ycksimplify` re-gate for active sub-spec d:
  - Reuse review found `NoteEditorOverlay` was constructing full content query options just to get query keys during
    stale-conflict cache sync. The conflict path now uses exact `segmentContentQueryKey` and
    `segmentSupplementContentQueryKey` helpers directly.
  - Quality review found the Segment and SegmentSupplement conflict cache payloads repeated the same note body,
    byte-length, baseline and title fields. The shared `createNoteContentCachePatch` helper now owns that shape while
    keeping Segment and SegmentSupplement identity explicit.
  - Efficiency review found same-snapshot refresh already exact-invalidates only the active finalized note editor target
    and does not broaden into workspace content invalidation.
  - Test harness review found the current SegmentSupplement cache tests use the same `QueryClientProvider` client that
    they seed and assert.
- Evidence:
  - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "body-only Note editor refresh|reloads a clean Note editor body|refreshes non-body workspace projections|opening hash|handles stale Note SegmentSupplement|keeps dirty Note segment edits intact|retries a stale Note segment save"`
    passed with 7 targeted tests and 107 skipped.
  - `npm run typecheck:quick` passed.
  - `npm run format:check` passed.
  - `npm run lint:strict` passed.

## 2026-05-19 18:08 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Final Phase 3 gate evidence after `$ycksimplify` edits:
  - `npm run verify:quick` passed with the current workspace state: typecheck, 802 main tests, 469 renderer tests,
    `lint:strict`, and `format:check`.
  - Independent `/review` re-gate passed with no MAJOR / BLOCKER findings.
  - Independent `$ycksimplify` re-gate passed after simplifying conflict cache sync and updating this evidence.
- Status:
  - Sub-spec (d) external edit conflict is ready to archive.

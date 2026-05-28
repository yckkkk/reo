# Tasks

## Phase 0: Setup

- [x] Confirm `docs/specs` contains only this spec.
- [x] Record that request-user-input alignment selected one combined spec with three subtask groups.
- [x] Confirm current docs describe the intended contracts before code changes.
- [x] Decide TDD scope: uncovered watcher lock churn is RED/GREEN; already covered selected-content and directory-move behavior is cited as evidence.

## Phase 1: Test Surface Map

- [x] Inspect main coverage in `test/main/memoryFiles.test.ts`, `test/main/workspaceFiles.test.ts`, `test/main/workspaceFileTruthWatcher.test.ts` and `test/main/tiptapContentSidecar.test.ts`.
- [x] Inspect renderer coverage in `src/renderer/src/App.test.tsx`, `src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx` and nearby Memory Studio/editor tests.
- [x] Map helpers for note Segment, audio transcript, note Supplement, sidecar JSON, watcher event and disposable workspace fixtures.
- [x] Classify each scenario as existing coverage, new test, runtime evidence or non-goal.

## Phase 2: Selected Content Refresh

- [x] Scenario A1: clean selected note Segment body refreshes from external `segment.md`.
  - Covered by `App.test.tsx` file-truth refresh and body-only refresh tests.

- [x] Scenario A2: clean selected note SegmentSupplement body refreshes from external `supplement.md`.
  - Covered by `App.test.tsx` SegmentSupplement body refresh test.

- [x] Scenario A3: same-snapshot body-only edit still invalidates exact content.
  - Covered by `App.test.tsx` unchanged snapshot body refresh test.

- [x] Scenario A4: selected content sidecar JSON-only edit refreshes Tiptap JSON and baselines.
  - Covered by `App.test.tsx` JSON-only rich mark refresh test and `tiptapContentSidecar.test.ts` sidecar reconcile tests.

- [x] Scenario A5: dirty or pending editor is not overwritten by external refresh.
  - Covered by `App.test.tsx` dirty Note refresh/conflict tests and `LoadedWorkspaceFrame.test.tsx` dirty inline guard tests.

## Phase 3: Directory Moves

- [x] Scenario B1: Memory directory rename updates Workspace snapshot and visible title.
  - Covered by `memoryFiles.test.ts` Memory basename title truth and workspace snapshot title refresh tests.

- [x] Scenario B2: Segment directory rename keeps id stable and updates Segment strip title.
  - Covered by `memoryFiles.test.ts` segment basename title and rename-through-file-truth tests.

- [x] Scenario B3: Segment move across Memory repairs legal manifest parent mirror and moves projection.
  - Covered by `memoryFiles.test.ts` CLI-moved note/audio Segment repair tests.

- [x] Scenario B4: SegmentSupplement directory rename updates tab title and selected content projection.
  - Covered by `memoryFiles.test.ts` SegmentSupplement rename-through-file-truth tests and `LoadedWorkspaceFrame.test.tsx` title-only tab projection test.

- [x] Scenario B5: SegmentSupplement move across Segment repairs legal parent mirrors and moves projection.
  - Covered by `memoryFiles.test.ts` CLI-moved note/audio SegmentSupplement repair tests.

- [x] Scenario B6: unresolved move/duplicate/unsafe/ambiguous candidate enters needs-review and is excluded from normal projection.
  - Covered by duplicate, ambiguous, copied Segment/Supplement and needs-review diagnostics tests in `memoryFiles.test.ts` / `workspaceFiles.test.ts`.

## Phase 4: Watcher Edge Cases

- [x] Scenario C1: `.reo/review` writes are ignored by watcher and do not produce refresh loops.
  - Covered by updated watcher ignored-only test.

- [x] Scenario C2: atomic temp, lock, cache and common editor temp files are ignored.
  - Added coverage for real `.reo/workspace.lock.lock/owner.json` lock artifacts; existing basename/temp/cache ignore coverage remains.

- [x] Scenario C3: symlink or unsafe path activity does not leak raw paths or follow outside workspace.
  - Covered by watcher redacted error/path-bound tests and file-truth symlink rejection tests.

- [x] Scenario C4: burst changes coalesce and still settle to one refresh path.
  - Covered by watcher coalescing test and renderer file-truth refresh tests.

- [x] Scenario C5: close/switch/stale handle events cannot mutate a new session.
  - Added renderer stale workspace handle/workspace id event test.

## Phase 5: Implementation

- [x] Add focused RED tests for uncovered selected-content refresh gaps.
  - No uncovered selected-content production gap found; existing tests were cited and rerun.

- [x] Add focused RED tests for uncovered directory move or needs-review gaps.
  - No uncovered directory-move production gap found; existing tests were cited and rerun.

- [x] Add focused RED tests for uncovered watcher ignore/redaction/lifecycle gaps.
  - RED: `workspaceFileTruthWatcher.test.ts` failed for `.reo/workspace.lock.lock/owner.json` lock artifact before the ignore rule was fixed.

- [x] Implement the smallest production changes required by failing tests.
  - Added `.reo/workspace.lock.lock` to the watcher technical subtree ignore set.

- [x] Refactor only after GREEN and rerun focused tests.
  - Split watcher ignored-only and close-pending tests; hoisted ignored `.reo` children into a module-level set.

## Phase 6: Subagent Review And Simplification

- [x] Run xhigh subagent spec/behavior review against the diff and this spec.
  - Result: no blocking findings; requested closeout evidence.

- [x] Run xhigh simplification review focused on code reuse, test duplication, event churn and cache invalidation complexity.
  - Result: one medium async-test risk and two low simplification gaps.

- [x] Fix accepted findings and rerun affected targeted tests.
  - Fixed stale-event test flushing, split ignored-only watcher test, and hoisted the watcher ignore set.

- [x] Record rejected findings with reason if any.
  - None rejected.

## Phase 7: Verification

- [x] Run targeted main checks:

```bash
MAIN_TEST_FILES=memoryFiles.test.ts,workspaceFiles.test.ts,workspaceFileTruthWatcher.test.ts,tiptapContentSidecar.test.ts npm run test:main
```

- [x] Run targeted renderer checks:

```bash
npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx
```

- [x] Run any additional focused commands needed by new tests.
- [x] Run `npm run verify:quick` once before commit.

## Phase 8: Closeout

- [x] Compress stable facts into `docs/current/*` only if contracts changed.
  - No current docs update; implementation only aligns watcher behavior with existing lock-artifact ignore contract.

- [x] Archive this spec under `docs/archive/specs/2026-05-27-1813-live-sync-hardening/`.
- [x] Confirm active `docs/specs` is empty after archive.
- [x] Commit only this slice.

## Evidence

- Setup:
  - `git status --short` showed only this slice after implementation began.
  - `docs/specs` contained only `2026-05-27-1813-live-sync-hardening`.
  - `request_user_input` alignment selected one combined spec with Selected content refresh, Directory moves and Watcher edge cases.

- RED/GREEN:
  - RED command: `MAIN_TEST_FILES=workspaceFileTruthWatcher.test.ts npm run test:main -- --test-name-pattern "ignore rules"`.
  - RED failure: `.reo/workspace.lock.lock/owner.json` was not ignored.
  - GREEN command: same focused watcher command after adding the ignore rule.

- Focused verification:
  - `MAIN_TEST_FILES=workspaceFileTruthWatcher.test.ts npm run test:main` -> 5 tests passed.
  - `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx -t "stale workspace handles"` -> 1 passed, 128 skipped.
  - `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx -t "file truth events|stale workspace handles|JSON-only rich marks|SegmentSupplement body"` -> 4 passed, 125 skipped.
  - `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "SegmentSupplement playback position|newly created SegmentSupplement|selected SegmentSupplement disappears"` -> 3 passed, 59 skipped.

- Targeted suite verification:
  - `MAIN_TEST_FILES=memoryFiles.test.ts,workspaceFiles.test.ts,workspaceFileTruthWatcher.test.ts,tiptapContentSidecar.test.ts npm run test:main` -> 256 tests passed.
  - `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx` -> 191 tests passed.

- Subagent review:
  - Spec/behavior xhigh subagent: no blocking findings.
  - Simplification xhigh subagent: accepted and fixed stale async negative assertion risk, watcher test mixing risk and hot-path ignore-set simplification.

- Final gate:
  - `npm run verify:quick` -> main 920 tests, renderer 525 tests, typecheck, lint and format passed.
  - `find docs/specs -mindepth 1 -maxdepth 3 -print` -> no output after archive.

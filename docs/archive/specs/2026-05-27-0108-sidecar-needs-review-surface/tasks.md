# Tasks

## State Machine And Constraints

- [x] Define needs-review state machine and invariants in `README.md`.
- [x] Confirm current hidden diagnostics and doctor script surfaces.
- [x] Add focused RED tests for review report generation, redaction and stale cleanup.
- [x] Add focused RED tests for snapshot review summary contract.
- [x] Add focused RED tests for `reo-doctor` reading unresolved review reports.
- [x] Add focused RED renderer test for compact review indicator.

## Implementation

- [x] Add main-owned `.reo/review/needs-review.json` and `.reo/review/needs-review.md` writer.
- [x] Collect review entries from sidecar conflict, invalid sidecar, unsupported sidecar and duplicate or ambiguous direct Markdown candidates.
- [x] Add redacted optional snapshot `review` summary.
- [x] Surface compact renderer indicator from snapshot aggregate counts only.
- [x] Update generated `reo-doctor` skill/script to report unresolved review entries while preserving deterministic config repair.

## Verification

- [x] Run targeted main, contract and renderer tests.
- [x] Run `npm run verify:quick` once before closeout.
- [x] Run independent review and simplify pass.
- [x] Compress stable conclusions into current docs if the implementation changes long-term contract.
- [x] Archive completed spec.
- [ ] Commit the completed slice.

## Evidence

- `MAIN_TEST_FILES=workspaceFiles.test.ts,workspaceContract.test.ts,workspaceFileTruthWatcher.test.ts npm run test:main`
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`
- `npm run verify:quick`
- Independent reviewer found missing SegmentSupplement candidate coverage; the focused supplement test now covers duplicate and ambiguous `supplement.md` review entries, aggregate counts and redaction.
- Simplification review found `.reo/review` watcher churn and clean-report no-op churn; watcher ignore and idempotent/clean no-op writer behavior now cover those paths.

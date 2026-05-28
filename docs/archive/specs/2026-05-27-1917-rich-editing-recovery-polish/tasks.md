# Tasks

## Phase 0: Setup

- [x] Reread `AGENTS.md` before creating this spec.
- [x] Confirm `docs/specs` was empty before creating this spec.
- [x] Use `request_user_input` to align the next priority.
- [x] Use brainstorming context before writing the spec.
- [x] Read current architecture/data/electron/flow/frontend/quality docs relevant to sidecar recovery, needs-review, UI aggregate counts and Tiptap.
- [x] Query current Tiptap docs through Context7.
- [x] Read archived Tiptap capability, sidecar needs-review, needs-review toast, agent behavior and live sync evidence.

## Phase 1: Test Surface Map

- [x] Inspect `src/main/workspaceReviewReport.ts`.
- [x] Inspect generated `reo-doctor` script in `src/main/workspaceFiles.ts`.
- [x] Inspect report, doctor and prompt tests in `test/main/workspaceFiles.test.ts`, `test/main/workspaceIpc.test.ts`, `test/main/workspaceContract.test.ts` and `src/renderer/src/workspace/workspaceReviewToast.test.tsx`.
- [x] Classify each scenario as new test, existing coverage or non-goal.

## Phase 2: RED Tests

- [x] Report Markdown RED: sidecar conflict/invalid/unsupported/markdown-write-required entries include conservative recovery hints.
- [x] Report Markdown RED: duplicate and ambiguous Markdown candidate entries include safe shape hints.
- [x] Report redaction RED: hints do not include body text, frontmatter raw text, root path, absolute path, hash or handle.
- [x] Doctor RED: sanitized needs-review entries include the same recovery hint.
- [x] Prompt RED: copied agent prompt tells the agent to follow local report/doctor recovery hints without embedding entries.

## Phase 3: Implementation

- [x] Add a shared reason-to-hint model for needs-review entries.
- [x] Render the hint into `.reo/review/needs-review.md`.
- [x] Embed the same hint model into generated `reo-doctor` output.
- [x] Update the copied agent prompt text only if the prompt test proves it needs a clearer hint reference.
- [x] Avoid any renderer report entry, raw path IPC, automatic sidecar merge or semantic content mutation.

## Phase 4: Targeted Verification

- [x] Run focused report/doctor/prompt tests.
- [x] Run targeted main checks around sidecar needs-review:

```bash
MAIN_TEST_FILES=workspaceFiles.test.ts,tiptapContentSidecar.test.ts,workspaceContract.test.ts,workspaceIpc.test.ts npm run test:main
```

- [x] Run targeted renderer prompt/toast checks if prompt text changes:

```bash
npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/workspaceReviewToast.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx
```

## Phase 5: Review And Simplification

- [x] Run xhigh subagent behavior review against the diff and this spec.
- [x] Run xhigh simplification review focused on duplicate hint wording, generated-script drift, redaction and overbroad product surface.
- [x] Fix accepted findings and rerun affected tests.
- [x] Record rejected findings with reason if any.

## Phase 6: Closeout

- [x] Update `docs/current/*` only if stable recovery contract changed.
- [x] Run `npm run verify:quick`.
- [x] Archive this spec under `docs/archive/specs/2026-05-27-1917-rich-editing-recovery-polish/`.
- [x] Confirm active `docs/specs` is empty after archive.
- [x] Commit only this slice.

## Evidence

- Alignment: `request_user_input` selected `Recovery polish (Recommended)`.
- Context7: Tiptap docs confirm content error handling through `onContentError`, `emitContentError` and `setContent({ errorOnInvalidContent })`; this slice keeps Tiptap handling official and only improves Reo recovery hints.
- RED: `MAIN_TEST_FILES=workspaceFiles.test.ts npm run test:main -- --test-name-pattern "recovery hints|reo-doctor skill script reports unresolved"` failed because Markdown report and `reo-doctor` lacked recovery hints.
- RED: `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/workspaceReviewToast.test.tsx --testNamePattern "bounded agent prompt"` failed because the copied prompt did not point agents at recovery hints.
- GREEN: focused main recovery tests passed with 3 tests after adding hints, JSON shape protection and inherited reason fallback.
- GREEN: focused renderer prompt test passed with 1 test.
- Targeted main: `MAIN_TEST_FILES=workspaceFiles.test.ts,tiptapContentSidecar.test.ts,workspaceContract.test.ts,workspaceIpc.test.ts npm run test:main` passed 325 tests.
- Targeted renderer: `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/workspaceReviewToast.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx` passed 65 tests.
- Xhigh behavior review accepted findings: remove deletion wording from ambiguous candidate hint; assert `.reo/review/needs-review.json` entry shape remains unchanged.
- Xhigh simplification review accepted finding: guard hint lookup against inherited keys such as `__proto__` and reuse the exported fallback string in the generated doctor script.
- Rejected findings: none.
- Current docs: `docs/current/data.md` now records that Markdown report and `reo-doctor` may show conservative hints while JSON entries and renderer snapshot remain redacted.
- Closeout: `npm run verify:quick` passed with typecheck, main 922 tests, renderer 525 tests, lint and format.
- Archive: active `docs/specs` is empty after moving this spec to `docs/archive/specs/2026-05-27-1917-rich-editing-recovery-polish/`.

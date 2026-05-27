# Tasks

## Phase 0: Setup And Scope

- [x] Confirm `docs/specs` contains only this spec before implementation starts.
- [x] Keep the selected priority as B: file truth convergence first, then dogfood, then recovery.
- [x] If any old subagent session is still active in the implementation environment, close it opportunistically, but do not block this spec on that cleanup.
- [x] Reconfirm no current-doc update is needed before code changes; update `docs/current/*` only if stable contracts change.

## Phase 1: Test Surface Map

- [x] Inspect existing main tests in `test/main/workspaceFiles.test.ts`, `test/main/workspaceFileTruthWatcher.test.ts` and `test/main/tiptapContentSidecar.test.ts`.
- [x] Inspect existing renderer tests in `src/renderer/src/App.test.tsx`, `src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx` and any focused Memory Studio test owner used for selected content behavior.
- [x] Map existing helpers for creating memory-space fixtures, legal direct note Segment candidates, legal direct note Supplement candidates and sidecar JSON payloads.
- [x] Decide whether each scenario needs a new long-term test, a runtime evidence step, or only spec evidence because existing tests already cover it.

## Phase 2: Normal File Truth Scenarios

- [x] Scenario 1 test: external Memory creation appears in Workspace snapshot and UI list.
  - Main focus: legal Memory files, `.reo/index.json` convergence.
  - Renderer focus: snapshot event updates sidebar or loaded workspace projection.

- [x] Scenario 2 test: external Memory rename updates visible title.
  - Assert basename title truth wins according to `docs/current/data.md`.
  - Assert stale `memory.md` mirror does not keep old UI title.

- [x] Scenario 3 test: external Segment rename or legal move refreshes Memory detail.
  - Assert Segment id remains stable.
  - Assert legal parent mirror repair happens when the Segment is moved across Memory.
  - Assert Segment strip projection updates.

- [x] Scenario 4 test: external Segment creation appears in horizontal Segment flow.
  - Use ordinary `segment.md` with legal frontmatter and note body.
  - Assert the new Segment is not hidden behind stale index cache.

- [x] Scenario 5 test: external SegmentSupplement creation appears as a content tab.
  - Use ordinary `supplement.md` under an existing Segment.
  - Assert it updates parent Segment projection and does not become a top-level Segment.

- [x] Scenario 6 test: external SegmentSupplement rename updates tab title.
  - Assert title changes in Memory detail and active tab rail.
  - Assert selected content cache does not preserve the old title.

## Phase 3: Selected Content Refresh

- [x] Scenario 7 renderer test: external `segment.md` body edit refreshes the currently open Segment content.
  - Simulate or trigger a same-workspace file truth event.
  - Assert `readWorkspaceSnapshot` is called.
  - Assert exact selected Segment content query invalidates/refetches.
  - Assert visible editor content uses the disk version when the editor is clean.

- [x] Scenario 8 renderer test: external `supplement.md` body edit refreshes the currently open Supplement content.
  - Simulate or trigger a same-workspace file truth event.
  - Assert selected Supplement content query invalidates/refetches.
  - Assert active Supplement tab panel shows the disk version.

- [x] Preserve dirty-editor protection.
  - If a new test touches dirty state, assert external refresh does not silently overwrite local dirty edits.
  - If existing tests already cover this, cite them in Evidence instead of duplicating.

## Phase 4: Tiptap Sidecar Representative

- [x] Scenario 9 main test: safe JSON-only `content.tiptap.json` edit reconciles through Tiptap sidecar.
  - Use one highlight or underline mark supported by the current durable profile.
  - Assert Markdown mirror updates only through the existing sidecar reconcile path.
  - Assert unsupported or invalid JSON is not silently merged here; it belongs to Phase 5.

- [x] Scenario 9 renderer test or runtime evidence: open editor renders the sidecar-authored mark through `LightweightMarkdownEditorSurface`.
  - Assert Tiptap-rendered mark behavior or accessible editor content, not only raw Markdown text.
  - Keep this representative; do not expand into the full Tiptap capability audit.

## Phase 5: Recovery Surface Scenarios

- [x] Scenario 10 duplicate id test: duplicate direct Segment or Supplement candidate writes needs-review report and excludes unsafe candidate from normal projection.
- [x] Scenario 10 invalid sidecar test: invalid `content.tiptap.json` writes needs-review report without body/path leakage.
- [x] Scenario 10 unsupported Tiptap JSON test: unsupported content writes needs-review report and preserves both files.
- [x] Snapshot assertion: review summary exposes aggregate counts only.
- [x] UI assertion: compact needs-review indicator shows count only and does not expose raw paths.
- [x] Doctor assertion: generated `skills/reo-doctor/scripts/reo-doctor.mjs` prints workspace-relative paths and preserves deterministic managed-config repair behavior.
- [x] Cleanup assertion: after repair, stale `.reo/review/needs-review.json` / `.md` is removed or deterministically cleared according to existing implementation.

## Phase 6: Agent Dogfood

- [x] Prepare a disposable test memory space or clearly isolated fixture memory space.
- [x] Run one real non-interactive Codex dogfood command with `codex exec`, not `codex -p` as a prompt shortcut.
- [x] Prompt task: rename one Segment, create one note Supplement and edit one body.
- [x] Record invocation, cwd, elapsed time, final Codex output and files read when observable.
- [x] Record file effects: directories, Markdown, sidecar and whether `.reo` technical files were manually touched.
- [x] Record projection effects: snapshot, Memory detail, Segment strip, Supplement tab and selected content convergence.
- [x] Classify friction owner as `AGENTS.md`, `skills/reo-edit`, `skills/reo-doctor`, Reo system or test/dev tooling.
- [x] If Codex edits ordinary files correctly but Reo fails to converge, create a focused system test before fixing. Do not add complexity to agent instructions as the first response.

## Phase 7: Verification

- [x] Run targeted main checks:

```bash
MAIN_TEST_FILES=memoryFiles.test.ts,workspaceFiles.test.ts,workspaceFileTruthWatcher.test.ts,tiptapContentSidecar.test.ts npm run test:main
```

- [x] Run targeted renderer checks:

```bash
npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx
```

- [x] Run any additional focused renderer command required by the selected content tests.
- [x] Run `npm run verify:quick` once before commit.
- [x] Add Evidence entries below with exact commands and outcomes.

## Phase 8: Closeout

- [x] Run a simplification review over changed files: reuse existing helpers, remove duplicate fixture setup, avoid broad E2E helpers that hide assertions.
- [x] Compress only stable new facts into `docs/current/*`, if any.
- [x] Archive this spec under `docs/archive/specs/2026-05-27-0451-agent-file-truth-e2e-matrix/` after completion.
- [x] Confirm active `docs/specs` is empty after archive.
- [x] Commit only this slice and its directly related source/test/doc changes.

## Evidence

- Setup: `git status --short` showed only this slice dirty after spec creation; `git log -3 --oneline` confirmed `326cef76 Add workspace needs-review surface` at HEAD. `find docs/specs -mindepth 1 -maxdepth 2` showed only this active spec.
- Alignment: `request_user_input` selected B, file truth convergence first. `brainstorming` was used before writing this spec.
- Test surface map: existing coverage already covers Scenarios 1, 3, 4, 5, 6, 9 and 10 across `test/main/memoryFiles.test.ts`, `test/main/workspaceFiles.test.ts`, `test/main/workspaceFileTruthWatcher.test.ts`, `test/main/tiptapContentSidecar.test.ts`, `src/renderer/src/App.test.tsx` and `src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`.
- RED: `MAIN_TEST_FILES=memoryFiles.test.ts npm run test:main -- --test-name-pattern "external Memory directory rename"` failed because the index/detail projected stale `memory.md` title (`Original Memory Title`) instead of the renamed directory basename.
- GREEN: production fix in `src/main/memoryFiles.ts` reuses `titleFromFileSpaceDirectoryName` for Memory file-truth reads. The long-term test was folded into `test/main/memoryFiles.test.ts` as `Memory file truth uses memory directory basename as the title source of truth`, asserting index projection, Memory detail projection and stale `memory.md` mirror preservation.
- Focused main: `MAIN_TEST_FILES=memoryFiles.test.ts npm run test:main -- --test-name-pattern "Memory file truth uses memory directory basename"` passed: 1 test, 0 failures.
- Focused renderer: `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx -t "reloads a clean Note SegmentSupplement body|reloads clean Note editor JSON-only"` passed: 2 tests, 126 skipped.
- Targeted main: `MAIN_TEST_FILES=memoryFiles.test.ts,workspaceFiles.test.ts,workspaceFileTruthWatcher.test.ts,tiptapContentSidecar.test.ts npm run test:main` passed: 250 tests, 0 failures.
- Targeted renderer: `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx` passed: 2 files, 186 tests, 0 failures.
- Dogfood setup: created disposable workspace under `/var/folders/ql/82hx_cy97xd902x7ryf2dx3m0000gn/T/reo-dogfood-zzYDLW` with Memory `mem_dogfood` and Segment `seg_dogfood_target`.
- Dogfood command: `codex exec --cd "$ROOT" --sandbox workspace-write --skip-git-repo-check --ephemeral "$PROMPT"` ran with model `gpt-5.5`, reasoning effort `xhigh`, status 0 and elapsed 80 seconds.
- Dogfood behavior: Codex read `AGENTS.md` and `skills/reo-edit/SKILL.md`, then used ordinary file operations under `memories/`; it did not inspect Reo source, run Reo internals or edit `.reo`.
- Dogfood file effects: Codex renamed `memories/mem_dogfood--Dogfood Memory/segments/seg_dogfood_target--Original Segment` to `seg_dogfood_target--Agent Renamed Segment`, edited `segment.md`, and created `supplements/sup_dogfood_followup--Agent Followup/supplement.md`. No sidecar was manually touched.
- Dogfood projection: before projection `.reo/objects/supplements/sup_dogfood_followup.json` was absent; after `readWorkspaceSnapshotFromFileTruth`, `readMemoryDetailFromFileTruth`, `readFinalizedNoteSegmentContent` and `readFinalizedNoteSegmentSupplementContent`, the Segment title/body and Supplement tab/body projected correctly, the Supplement manifest was repaired, and `.reo/review/needs-review.json` was absent.
- Simplification review: ran `ycksimplify` review with xhigh subagents. Actionable findings were addressed by folding duplicate Memory rename assertions into the existing basename-title test, replacing brittle exact snapshot counts with count deltas, and extracting shared note workspace/content fixtures for the renderer tests. One stale old subagent was closed opportunistically.
- Current docs: no `docs/current/*` update was needed. `docs/current/data.md` already states directory basename is the user-visible name truth and Markdown title is a Reo-held mirror.
- Formatting: `npx prettier --write src/main/memoryFiles.ts test/main/memoryFiles.test.ts src/renderer/src/App.test.tsx docs/specs/2026-05-27-0451-agent-file-truth-e2e-matrix/README.md docs/specs/2026-05-27-0451-agent-file-truth-e2e-matrix/tasks.md` completed with no formatting changes remaining.
- Final verification: `npm run verify:quick` passed after this spec was archived and `docs/specs` was empty.

# Tasks

## Phase 0: Scope

- [x] Reread `AGENTS.md` before creating this spec.
- [x] Confirm `docs/specs` was empty before creating this spec.
- [x] Use `request_user_input` to align the next confirmed task.
- [x] Read current architecture/data/electron/flow/frontend/quality docs relevant to managed agent files, needs-review and file truth.
- [x] Read archived dogfood and Agent/File Truth E2E Matrix evidence.

## Phase 1: Test Surface

- [x] Inspect current managed template constants in `src/main/workspaceFiles.ts`.
- [x] Inspect current managed config and doctor tests in `test/main/workspaceFiles.test.ts`.
- [x] Inspect current needs-review prompt tests.
- [x] Decide which assertions are long-term behavior contracts rather than text snapshot churn.

## Phase 2: RED Tests

- [x] Add failing main test that `DEFAULT_WORKSPACE_AGENTS_MD` puts the ordinary-task path and stop condition before detailed entity/internal descriptions.
- [x] Add failing main test that generated `reo-edit` contains stop rules for ordinary tasks and preserves Expert Tiptap JSON as an explicit non-default path.
- [x] Add or tighten test that generated `reo-doctor` is recovery-only and reports needs-review without becoming normal edit guidance.
- [x] Confirm existing prompt/toast coverage is sufficient for actionable, path-safe copied needs-review prompts.
- [x] Run focused tests and record expected failures in Evidence.

## Phase 3: Implementation

- [x] Simplify `DEFAULT_WORKSPACE_AGENTS_MANAGED_BLOCK` around default path, stop condition and recovery path.
- [x] Simplify `DEFAULT_REO_EDIT_SKILL_MD` quick-start and stop rules without removing supported file and rich text capabilities.
- [x] Simplify `DEFAULT_REO_DOCTOR_SKILL_MD` only if tests show ambiguity.
- [x] Keep user custom `AGENTS.md` preservation and legacy-template replacement behavior intact.
- [x] Keep generated doctor script behavior and symlink safety intact.

## Phase 4: Targeted Verification

- [x] Run focused managed-template tests.
- [x] Run focused needs-review prompt/toast tests if prompt text changes.
- [x] Run targeted main managed config tests:

```bash
MAIN_TEST_FILES=workspaceFiles.test.ts npm run test:main -- --test-name-pattern "AGENTS|reo-doctor|reo-edit|managed"
```

- [x] Run targeted renderer prompt/toast tests if affected.

## Phase 5: Dogfood

- [x] Create or reuse a disposable memory space fixture.
- [x] Run one real `codex exec` representative ordinary task with xhigh reasoning.
- [x] Record invocation, elapsed time and final output.
- [x] Record which entry files were read when observable.
- [x] Record file effects and confirm `.reo` technical files were not manually touched.
- [x] Run Reo read model or focused runtime projection to confirm convergence.
- [x] Classify any friction as template, skill, Reo system or tooling.

## Phase 6: Review And Closeout

- [x] Use xhigh subagent review for behavior-risk and simplification.
- [x] Fix actionable review issues.
- [x] Decide whether `docs/current/*` needs stable fact compression.
- [x] Move completed spec to `docs/archive/specs/2026-05-27-1724-agent-behavior-optimization/`.
- [x] Confirm `docs/specs` is empty after archive.
- [x] Run `npm run verify:quick`.
- [ ] Commit only this slice.

## Evidence

- Alignment: `request_user_input` selected Agent behavior optimization after confirming Agent/File Truth E2E Matrix already covered the three prior priorities in commit `fcec6095`.
- RED: `MAIN_TEST_FILES=workspaceFiles.test.ts npm run test:main -- --test-name-pattern "managed AGENTS block|managed reo-edit skill|managed reo-doctor skill"` failed as expected. Missing behavior: `AGENTS.md` had no `## 普通任务默认路径` / `## 需要检查时` front-loaded sections; `reo-edit` had no `## Stop Rules`; `reo-doctor` did not explicitly say not to run before ordinary edits.
- GREEN: `MAIN_TEST_FILES=workspaceFiles.test.ts npm run test:main -- --test-name-pattern "managed AGENTS block|managed reo-edit skill|managed reo-doctor skill|workspace init creates stable root files"` passed: 4 tests, 0 failures.
- Prompt safety: existing `src/renderer/src/workspace/workspaceReviewToast.test.tsx` already asserts `buildWorkspaceReviewAgentPrompt()` includes doctor command and `.reo/review/needs-review.md` while excluding root path, workspace handle, hashes and report entry paths; no prompt production change was needed.
- Targeted main: `MAIN_TEST_FILES=workspaceFiles.test.ts npm run test:main -- --test-name-pattern "AGENTS|reo-doctor|reo-edit|managed"` passed: 14 tests, 0 failures.
- Targeted renderer prompt/toast: `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/workspaceReviewToast.test.tsx src/renderer/src/components/ui/toaster.test.tsx --testNamePattern "buildWorkspaceReviewAgentPrompt|reo-doctor recovery"` passed: 2 files, 3 tests, 9 skipped.
- Tooling repair: first dogfood attempt exposed local `~/.codex/config.toml` duplicate `mcp_servers.twitter.env` shape. Fixed local Codex config by merging the duplicate inline env into `[mcp_servers.twitter.env]`; `codex exec --help` now starts normally. No repository files were changed for this repair.
- Dogfood invocation: created a disposable valid memory space under `$TMPDIR/reo-agent-behavior-valid-*`; ran `codex exec --json -C "$ROOT" --sandbox workspace-write --skip-git-repo-check --ephemeral -c 'approval_policy="never"' -c 'model_reasoning_effort="xhigh"'`.
- Dogfood result: status 0, elapsed 88.4s. Agent read `skills/reo-edit/SKILL.md`, `memory.md`, target `segment.md`, and nearby `memories/` paths. It did not read Reo repo source, global memory, `.reo`, manifests, index, hash or doctor files.
- Dogfood file effects: renamed the target Segment directory, modified only `segment.md`, created a note Supplement directory and `supplement.md`. Final response reported only ordinary files/directories.
- Dogfood projection: `readWorkspaceSnapshotFromFileTruth`, `readMemoryDetailFromFileTruth`, `readFinalizedNoteSegmentContent` and `readFinalizedNoteSegmentSupplementContent` converged. Snapshot showed one note Segment and one Supplement; detail projected Segment title `Agent Behavior Segment` and Supplement title `Agent Behavior Followup`; selected content returned both edited Markdown bodies and regenerated Tiptap JSON; review entries were empty.
- Dogfood friction classification: the local config duplicate-key failure was test/dev tooling. The ordinary task path itself followed the intended local-entry behavior. One harmless extra note: Codex noticed `content.tiptap.json` while listing target files but did not read or edit it.
- Review follow-up: xhigh behavior review found the template could be misread as Markdown/dirs-only. Fixed by adding positive ordinary-path permission for Markdown, same-node `content.tiptap.json`, attachments and ordinary object files while keeping `.reo` mirrors/hash/index/lock as Reo-owned. xhigh simplification review found repeated template guidance and brittle tests; fixed by removing duplicated sections, compressing doctor wording, adding `assertIncludesInOrder`, and anonymizing temp dogfood path evidence.
- Current docs: no `docs/current/*` update is needed. Existing current truth already states agents may edit ordinary files, Reo owns `.reo` technical convergence, and needs-review/doctor are recovery surfaces.
- Retest after review fixes: `MAIN_TEST_FILES=workspaceFiles.test.ts npm run test:main -- --test-name-pattern "managed AGENTS block|managed reo-edit skill|managed reo-doctor skill|workspace init creates stable root files|AGENTS|reo-doctor|reo-edit|managed"` passed: 15 tests, 0 failures.
- Archive: moved this spec to `docs/archive/specs/2026-05-27-1724-agent-behavior-optimization/`; `find docs/specs -mindepth 1 -maxdepth 1 -print` returned no entries.
- Final verification: `npm run verify:quick` passed after archive with `docs/specs` empty.

# Cross-Space Move Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make same-level Memory, Segment, and SegmentSupplement directory moves converge within and across Reo memory spaces, especially Draft-to-ordinary-space movement.

**Architecture:** Keep the first slice inside the existing main-process file-truth read model. Target workspace roots repair their own `.reo/objects/*` mirrors and rebuildable index from the current file tree; source roots are not scanned or cleaned.

**Tech Stack:** TypeScript main process, Node test runner, Reo workspace file contract, existing Markdown/manifest reconciliation helpers.

---

## Files

- Modify: `test/main/memoryFiles.test.ts`
- Modify: `src/main/memoryFiles.ts`
- Modify: `src/main/workspace-agent-config/skills/reo-edit/SKILL.md`
- Modify: `docs/current/architecture.md`
- Modify: `docs/current/data.md`
- Modify: `docs/current/flow.md`
- Update: `docs/specs/2026-06-09-2116-cross-space-move-contract/README.md`

## Success Criteria

- Cross-space moved audio Segments and audio SegmentSupplements are adopted by the target root when their moved directories contain valid Markdown plus `audio.webm`.
- Cross-space moved note and artifact Segments/Supplements keep working through the same target convergence path.
- Whole Memory directory movement across ordinary memory spaces repairs missing target memory manifest and child Segment/Supplement ownership mirrors.
- Same id in different memory spaces is allowed; duplicate ids inside one target scope still do not project.
- No new IPC channel, renderer state owner, global move scan, or source-root cleanup is introduced.

## Task 1: RED For Cross-Space Segment And Supplement Adoption

- [x] Add focused tests in `test/main/memoryFiles.test.ts` for moving a finalized audio Segment directory from one workspace root into a Memory in another workspace root.
- [x] Add focused tests in `test/main/memoryFiles.test.ts` for moving a finalized audio SegmentSupplement directory from one workspace root into a Segment in another workspace root.
- [x] Run:

```bash
MAIN_TEST_FILES=test/main/memoryFiles.test.ts npm run test:main -- --test-name-pattern "cross-space"
```

Expected: the new audio cross-space tests fail because the target root has no matching audio object manifest.

## Task 2: GREEN Minimal Audio Manifest Adoption

- [x] Modify `src/main/memoryFiles.ts` so audio Segment candidate reconciliation can create a target-root manifest when no target manifest exists and the candidate has a safe id, valid `kind: audio`, and matching `audio.webm` payload.
- [x] Modify audio SegmentSupplement candidate reconciliation with the same target-root manifest creation behavior.
- [x] Preserve duplicate-id protection when the same target root still has an active object with the same id in another parent.
- [x] Re-run the focused test command from Task 1.

Expected: focused cross-space tests pass.

## Task 3: RED/GREEN For Whole Memory Cross-Space Movement

- [x] Add a focused test that moves a whole Memory directory from one ordinary workspace root into another root.
- [x] Assert the target root repairs `.reo/objects/memories/<memoryId>.json`, adopts child Segment/Supplement projections, and writes target workspace ownership into child manifests.
- [x] Run the same focused main test command and verify the test fails if current behavior does not repair the child ownership contract.
- [x] Implement the smallest missing read-model repair in `src/main/memoryFiles.ts`.
- [x] Re-run focused tests.

Expected: Memory-level cross-space movement and children converge in the target root.

## Task 4: Contract Documentation And Managed Agent Guidance

- [x] Update `src/main/workspace-agent-config/skills/reo-edit/SKILL.md` to state that same-level moves may cross memory spaces, including Draft as source/target, while preserving ids and moving whole directories.
- [x] Update `docs/current/architecture.md`, `docs/current/data.md`, and `docs/current/flow.md` only with stable current contract facts.
- [x] Mark implementation status and verification evidence in this spec `README.md`.

## Task 5: Verification

- [x] Run focused main tests for memory file truth:

```bash
MAIN_TEST_FILES=test/main/memoryFiles.test.ts npm run test:main -- --test-name-pattern "cross-space|CLI-moved"
```

- [x] Run typecheck:

```bash
npm run typecheck
```

- [x] Run final gate before claiming clean:

```bash
npm run verify:quick
```

- [x] Run real external-agent dogfood with `REMOTE_DEBUGGING_PORT=9233 npm run dev` and `codex exec` against Draft plus Test memory spaces; preserve redacted output traces under `evidence/runtime-codex/`.

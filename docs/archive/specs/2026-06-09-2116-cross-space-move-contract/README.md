# Cross-Space Move Contract

创建：2026-06-09 21:16 PDT
状态：implemented-verified
Timezone：America/Los_Angeles

## Objective

Support same-level movement of Reo content nodes within a memory space and across memory spaces, so users and agents can move Draft content into ordinary memory spaces by moving ordinary file-space directories.

The first implementation slice is file-truth convergence only. Reo UI movement is a future consumer of the same contract, not a separate behavior model.

## Core Contract

Reo has three movable content node levels:

- Memory: a whole directory under `memories/`.
- Segment: a whole directory under a Memory `segments/`.
- SegmentSupplement: a whole directory under a Segment `supplements/`.

Movement is same-level only:

- A Memory may be placed under any Reo memory space `memories/`.
- A Segment may be placed under any Memory `segments/`, including a Memory in another memory space.
- A SegmentSupplement may be placed under any Segment `supplements/`, including a Segment in another memory space.

The move unit is always the whole directory subtree. Reo does not split attachments, cover files, Tiptap sidecars, generated speech, audio payloads, artifact runtime bundles, state files, assets, or child supplements away from the moved node.

Moved nodes preserve their stable ids. IDs remain workspace-scoped for app identity, so the same Memory, Segment, or Supplement id may exist in two different memory spaces. Duplicate ids inside the same target scope remain conflicts.

## Draft Boundary

System Draft participates as a source and target memory space for user content. Draft content must be movable out to ordinary memory spaces.

The protected default Memory `草稿` remains system-owned and must continue to exist. Reo does not support moving or deleting that protected Memory itself. Segments and supplements inside it may move out. User-created Memories inside Draft may move as whole Memory nodes.

## Convergence Model

Reo does not need a global move service for this slice. Each memory space converges only its own root.

When a target memory space is opened, refreshed, read for Memory detail, or has its index rebuilt, the read model treats the current file-tree position as the ownership truth:

- A Memory under target `memories/` is adopted into the target space.
- A Segment under target `memories/<memory>/segments/` is adopted under that target Memory.
- A SegmentSupplement under target `memories/<memory>/segments/<segment>/supplements/` is adopted under that target Segment.

Target convergence writes or repairs only the target memory space technical mirrors:

- `.reo/objects/memories/<memoryId>.json` when needed.
- `.reo/objects/segments/<segmentId>.json` with target workspace and Memory ownership.
- `.reo/objects/supplements/<supplementId>.json` with target workspace, Memory, and Segment ownership.
- `.reo/index.json` as the rebuildable target UI index.

The target space does not clean the source space. The source space later refreshes from its own file tree. Orphan source manifests remain technical mirror residue and belong to doctor/recovery diagnostics, not user semantic truth.

The current UI does not automatically follow a moved object across spaces. If an active object disappears from the current root after external movement, the current projection drops it. The user can open the destination space.

## Conflict Rules

Keep conflict handling local and minimal:

- Duplicate ids inside the same target scope are not guessed or merged.
- A directory with mixed object shapes is not guessed.
- Unsafe paths, symlinks, unsupported kinds, unsupported artifact formats, missing artifact entries, and oversized artifact entries use the existing review/fault behavior.
- Cross-space same id is not a conflict by itself.
- Reo does not auto-generate replacement ids for moved nodes.
- Reo does not search all registry spaces to infer source/destination pairs.
- Reo does not auto-clean source roots.

## Future UI Consumer

Future Reo UI movement must reuse this same contract:

- same-level only,
- whole-node subtree,
- preserve id,
- derive ownership from target parent,
- local target convergence,
- local conflict reporting.

The first implementation should not add a speculative UI move primitive or IPC channel. Add UI/IPC only when that slice has a real caller and can reuse the contract above without inventing a second move model.

## First Implementation Scope

Implement passive convergence and documentation only:

- Extend the existing read-model candidate reconciliation so target spaces can adopt cross-space moved Memory, Segment, and SegmentSupplement directories.
- Preserve current same-space Segment/Supplement movement behavior.
- Ensure note, audio, and artifact Segment/Supplement movement all converge when the moved directory contains the required payload files.
- Update Reo managed agent guidance so external agents know cross-space same-level movement is allowed.
- Do not add Reo UI, new IPC move commands, global scan state, source cleanup, or active selection following in this slice.

## Implementation Notes

- Audio Segment and SegmentSupplement target-root adoption now creates a target manifest when no target manifest exists and the moved directory contains valid Markdown plus `audio.webm`.
- If the target root already has an audio manifest for that id, `audio.webm` byte length must still match before the object projects.
- When an audio manifest is created from only the moved directory payload, `audioByteLength` comes from `audio.webm`, `durationMs` starts at 0, and `nextSequence` starts at 1 because source `.reo` metadata is not part of the whole content-node directory move.
- Existing note and artifact candidate repair paths already supported target-root adoption when the target root lacked a manifest.
- No IPC, renderer state owner, UI move command, source-root scan, or source `.reo` cleanup was added.

## Verification Plan

Use focused code regression checks and real external-agent/runtime scenarios:

- Move a note Segment from Draft default Memory to a normal memory space Memory; target projects it and Draft no longer projects it after refresh.
- Move note, audio, and artifact Supplements from Draft or another memory space into a normal target Segment; target projects them.
- Move a whole Memory directory from one ordinary memory space into another; child Segment and Supplement ownership converges in the target.
- Preserve moved ids across spaces.
- Allow the same id to exist in different memory spaces without global conflict.
- Keep target-scope duplicate ids in review or out of projection rather than auto-merging.
- Confirm no new IPC move channel or UI state owner is introduced in the first slice.

## Verification Evidence

- Code regression guard: `MAIN_TEST_FILES=test/main/memoryFiles.test.ts npm run test:main -- --test-name-pattern "cross-space"` first failed with both new audio cross-space cases projecting 0 objects instead of 1, then passed 5 tests after implementation and artifact cross-space review coverage.
- Code regression guard: `MAIN_TEST_FILES=test/main/memoryFiles.test.ts npm run test:main -- --test-name-pattern "cross-space|CLI-moved"` passed 9 tests after artifact cross-space review coverage.
- Code regression guard after invalid-manifest fix: `MAIN_TEST_FILES=test/main/memoryFiles.test.ts,test/main/workspaceManagedAgentTemplates.test.ts,test/main/workspaceFiles.test.ts npm run test:main -- --test-name-pattern "cross-space|CLI-moved|managed Reo agent templates|official skill symlink|invalid projected fields|lastTranscriptionAttempt rejects"` passed 11 tests.
- Static/final gate: `npm run typecheck` passed; `npm run verify:quick` passed before external-agent dogfood and again after review/simplify fixes.
- Real dev runtime: `REMOTE_DEBUGGING_PORT=9233 npm run dev` launched Electron with renderer at `http://localhost:5183/` and DevTools at `ws://127.0.0.1:9233/...`.
- Real external-agent dogfood: `codex exec` with real local Codex auth ran against Draft and Test memory spaces, saved redacted JSONL traces at `evidence/runtime-codex/codex-agent-move.jsonl` and `evidence/runtime-codex/codex-agent-cleanup-move.jsonl`, and completed run `20260609221232`.
- Runtime evidence redacts local absolute roots as `$DRAFT_ROOT`, `$TEST_ROOT`, and `$REPO_ROOT` while preserving command/output ordering, moved object ids, projection summaries, and target `.reo` record fields.
- Codex agent moved a Draft Segment into Test Memory `mem_codex_dogfood_17800058`, moved a Draft Supplement into Test Segment `seg_codex_dogfood_17800103`, moved a whole Draft user Memory into the Test `memories/` root, and then moved the remaining Draft source Segment into the same Test Memory without reading or editing `.reo`.
- Runtime projection evidence: `evidence/runtime-codex/runtime-after.json` shows Draft detail no longer contains any run `20260609221232` Segment/Supplement, Test target detail contains `seg_cross_space_codex_segment_20260609221232`, `seg_cross_space_codex_supp_source_20260609221232`, and `sup_cross_space_codex_supp_20260609221232`, and moved Memory `mem_cross_space_codex_20260609221232` contains child Segment/Supplement with Test workspace ownership.
- Runtime record evidence: `evidence/runtime-codex/target-reo-records.json` shows target `.reo/objects` records created for moved Segments, moved Supplement, child Segment, and child Supplement with `workspaceId: ws_9c3f83a8-cb51-4c35-923f-0b68be4753ee`.
- Index evidence: `evidence/runtime-codex/target-index-record.json` shows Test `.reo/index.json` has moved Memory `mem_cross_space_codex_20260609221232` and target Memory summary updated to three note Segments and two Supplements.

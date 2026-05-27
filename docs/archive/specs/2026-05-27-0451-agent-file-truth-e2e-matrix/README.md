# Agent File Truth E2E Matrix

Timezone: America/Los_Angeles (PDT).

## State Machine

```text
Active workspace is open
  -> external human or agent edits ordinary memory-space files
  -> main-owned watcher emits a path-redacted file truth event
  -> renderer reads Workspace snapshot for the same workspace handle
  -> snapshot read scans legal finalized file-space nodes
  -> deterministic repairs run for missing mirrors, parent mirrors, index summary and safe Tiptap sidecar changes
  -> renderer invalidates same-workspace Memory detail, selected Segment content and selected Supplement content queries
  -> UI projection updates current lists, detail, tabs and open editor content
  -> clean state removes stale needs-review report

Unresolved variant:

Active workspace is open
  -> external edit creates duplicate id, ambiguous candidate, invalid sidecar, unsupported Tiptap content or conflicting Markdown/sidecar change
  -> snapshot refresh excludes unsafe candidate from normal projection
  -> main writes .reo/review/needs-review.json and .reo/review/needs-review.md
  -> Workspace snapshot exposes aggregate review counts only
  -> UI shows compact needs-review indicator
  -> user or agent runs skills/reo-doctor/scripts/reo-doctor.mjs
  -> doctor prints workspace-relative paths and recovery guidance
  -> user or agent repairs ordinary files or sidecar
  -> next open or snapshot refresh recomputes report and returns to clean state
```

Each E2E scenario must exercise one transition or one side effect from this state machine. A single click-through that only proves the app did not crash is not valid coverage.

## Invariants

- Reo memory-space files are the user content truth. DB does not exist in the current runtime.
- Agents and humans may edit Markdown, JSON sidecars, directories and object files. The product goal is lower judgment cost, not artificial restriction to Markdown-only edits.
- Ordinary file tasks must not require maintaining `.reo/index.json`, `.reo/objects/*`, content hashes, lock files or cache state.
- Legal external edits converge through watcher events, snapshot refresh, read-model repair and TanStack Query invalidation.
- Unresolved edits do not silently disappear and do not force agents to infer Reo internals. They enter `.reo/review/needs-review.json` / `.md`, UI aggregate counts and `reo-doctor`.
- Renderer/preload never receive raw root paths or review report entries. Snapshot review data stays aggregate-only.
- Needs-review report entries use workspace-relative POSIX paths only and never include absolute paths, title, body, transcript, frontmatter source or content hashes.
- Tiptap remains the editor model owner. Reo validates the official JSON document and Markdown parse/serialize path, stores a bounded sidecar, and adapts only file truth, theme, layout and Electron security boundaries.
- Tiptap E2E must prove the open editor still renders the sidecar-authored mark through the existing Tiptap surface; it must not replace this with ad hoc Markdown string checks.
- E2E is a matrix of small scenarios. Each scenario must assert at least one critical side effect: file change, snapshot convergence, UI projection, needs-review report, doctor output or cache invalidation.

## Intent

This spec proves that the current file contract, live sync, Tiptap sidecar, needs-review surface and generated agent skills compose into a stable real workflow.

The first priority is **B. File truth convergence**. This was selected with `request_user_input` on 2026-05-27. The order is:

1. File truth convergence first: external file operations converge into snapshot, Memory detail, selected content and UI.
2. Agent dogfood second: run a representative `codex exec` task against a memory space and record whether ordinary file editing is enough.
3. Recovery surface third: validate conflict and invalid cases enter needs-review and doctor output.

This avoids mixing agent reasoning behavior with system sync correctness before the system foundation is proven.

## Current Basis

- `docs/current/architecture.md` defines the memory-space file model, generated `AGENTS.md`, `skills/reo-edit`, `skills/reo-doctor`, sidecar, manifest and needs-review boundaries.
- `docs/current/data.md` defines workspace snapshot shape, Memory/Segment/Supplement identity, sidecar profile, direct external edit repair, TanStack Query ownership and review report redaction.
- `docs/current/electron.md` defines the `workspace:fileTruthChanged` event, `workspace:readWorkspaceSnapshot`, renderer raw-path boundary and aggregate-only needs-review visibility.
- `docs/current/flow.md` defines active workspace refresh, watcher coalescing, snapshot reconcile, cache invalidation and needs-review report recomputation.
- `docs/current/frontend.md` defines Memory Studio projection, content tabs, selected content queries and the Tiptap-backed `LightweightMarkdownEditorSurface`.
- `docs/current/quality.md` lists existing main and renderer coverage for file truth, Tiptap sidecar, needs-review, watcher and cache refresh.
- The archived dogfood spec `docs/archive/specs/2026-05-26-2251-external-agent-edit-dogfood-e2e/` established that the real non-interactive Codex CLI entry is `codex exec`; `-p` is profile selection, not the prompt flag.
- Context7 was checked for Tiptap docs. Official Tiptap docs expose editor JSON through `editor.getJSON()` / JSON `setContent`, and the Markdown extension supports parsing and serializing Markdown through the editor extension stack. Reo must validate this official model, not reimplement it.

## Scenario Matrix

### File Truth Convergence

1. External create Memory.
   Assert the memory-space files exist, Workspace snapshot includes the Memory, the sidebar or horizontal list updates, and `.reo/index.json` summary converges without agent-maintained mirrors.

2. External rename Memory.
   Assert directory basename title truth projects to Workspace snapshot and UI. If `memory.md` has stale title mirror, Reo must choose the documented basename title projection.

3. External move or rename Segment.
   Assert Memory detail refreshes, Segment identity remains stable, parent manifest mirror is repaired when the move is legal, and the Segment strip updates.

4. External create Segment.
   Assert a legal note Segment created from ordinary files appears in Memory detail and the horizontal Segment flow.

5. External create SegmentSupplement.
   Assert a legal note SegmentSupplement created under an existing Segment appears as a content tab, not as a top-level Segment.

6. External rename SegmentSupplement.
   Assert the tab title updates from directory basename/frontmatter rules and stale content cache does not preserve the old title.

7. External edit `segment.md`.
   Assert the currently open selected Segment content query refetches, the inline editor shows disk content, and dirty local editor protection still applies where relevant.

8. External edit `supplement.md`.
   Assert the currently open selected Supplement content query refetches and the active tab panel shows disk content.

9. External edit `content.tiptap.json`.
   Assert safe JSON-only highlight or underline changes serialize back through the sidecar reconcile path, refresh the open editor and preserve Tiptap rendering. This is one representative rich-structure scenario, not a full Tiptap capability audit.

### Recovery Surface

10. Conflict and invalid cases.
    Assert duplicate ids, invalid sidecar JSON and unsupported Tiptap JSON write `.reo/review/needs-review.json` / `.md`; Workspace snapshot exposes only aggregate counts; UI shows only compact counts; `reo-doctor` prints workspace-relative paths.

### Agent Dogfood

11. One representative `codex exec` run.
    Ask Codex to rename one Segment, create one Supplement and edit body text in a test memory space. Record command, elapsed time, entry files read, final file effects, whether it touched `.reo` unnecessarily, whether it mentioned hash/manifest/sidecar, and whether Reo projected the changes without manual internal repair.

## Success Criteria

- The file-truth convergence phase covers all nine normal scenarios as focused tests or runtime steps, with each scenario proving a specific side effect.
- At least one renderer test proves file truth events invalidate selected Segment and selected Supplement content, not just Workspace snapshot.
- At least one Tiptap sidecar scenario proves JSON-authored highlight or underline reaches the open editor through the existing Tiptap surface.
- Needs-review coverage asserts report files, aggregate-only snapshot, UI compact indicator, doctor output and cleanup after repair.
- Dogfood uses the real `codex exec` invocation and does not treat Codex reasoning as the product design. The product contract remains ordinary file edits first, needs-review only when Reo reports it.
- Any discovered system gap is first captured in a focused failing test or runtime reproduction, then fixed with the smallest code change. Do not paper over a Reo sync bug by making the skill more complicated.
- `docs/current/*` changes only if the implementation changes stable current facts. Scenario evidence stays in this spec.
- Completed spec is archived after verification and current-doc compression, if any.
- `npm run verify:quick` passes before commit.

## Verification Boundary

This work touches filesystem truth, watcher refresh, snapshot read model, sidecar reconcile, Query invalidation, UI projection and recovery reporting. It is high risk enough that behavior gaps require real TDD:

- For missing coverage where behavior already exists, add focused tests and run them; do not pretend a passing existing behavior was RED.
- For behavior failures, record the failing command or test output before implementation, then make the smallest fix and rerun the focused check.
- Do not create one broad E2E. Split by state transition and side effect.

Targeted checks:

- `MAIN_TEST_FILES=memoryFiles.test.ts,workspaceFiles.test.ts,workspaceFileTruthWatcher.test.ts,tiptapContentSidecar.test.ts npm run test:main`
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`
- Additional focused renderer command for any new Memory Studio selected-content test.
- Real `codex exec` dogfood only for one or two representative tasks after file truth convergence is proven.
- Final `npm run verify:quick`.

## Non-Goals

- No in-app needs-review repair UI in this slice.
- No raw path IPC, generic diagnostics IPC or report-entry exposure to renderer.
- No Tiptap capability expansion beyond one representative sidecar-authored mark scenario.
- No restriction that agents can only edit Markdown.
- No DB, auth, packaging, updater or generic runtime work.
- No one-shot full-flow E2E that hides missing side-effect assertions.

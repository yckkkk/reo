# Entity Move UI

创建：2026-06-09 23:25 PDT
状态：implementation-verified
Timezone：America/Los_Angeles

## Objective

Add product UI for moving Memory, Segment and SegmentSupplement nodes through their existing More menus.

The UI must reuse the current same-level move model:

- Memory -> any memory space `memories/` root.
- Segment -> any Memory in any memory space.
- SegmentSupplement -> any Segment in any memory space.

The move unit is always the whole content-node directory subtree.

## Product Constraints

- Every move entry lives in the entity More menu.
- User-facing copy must be short action copy, not explanatory teaching text.
- The move surface is a single-layer directory picker. No card-in-card, panel-in-panel or multi-nested UI.
- The picker shows all memory spaces and disables illegal targets.
- Primary content tabs (`正文`, `转录`, `作品`) are not independent movable objects. Their move entry moves the parent Segment and all SegmentSupplement children.
- The protected default Draft Memory cannot be moved. User content inside Draft can move out.
- Disabled target reasons are not persistent paragraphs. Use disabled state, tooltip, or submit error.

## Entry Points

Add `移动...` in the same action group as rename/delete:

- Memory More menu opens `移动记忆`.
- Segment More menu opens `移动片段`.
- SegmentSupplement More menu opens `移动补充内容`.
- Primary `正文` / `转录` / `作品` tab More menu opens `移动片段`.

Primary content tab menus must label this action as `移动片段...`, not `移动...`, so it is not mistaken for moving only one content slot.

## Move Dialog

Use one reusable Dialog shell with entity-specific title and selectable target level.

Visible structure:

- Header: `移动记忆` / `移动片段` / `移动补充内容`.
- Directory tree: all memory spaces.
- Footer: `取消`, `移动`.

No explanatory body paragraph is shown by default.

## Target Tree Rules

Memory move:

- Memory space rows are selectable targets.
- Memory and lower rows are not shown.
- Current parent memory space is disabled when moving there would be a no-op.

Segment move:

- Memory space rows are group rows.
- Memory rows are selectable targets.
- Segment rows are not shown.
- Current parent Memory is disabled when moving there would be a no-op.

SegmentSupplement move:

- Memory space and Memory rows are group rows.
- Segment rows are selectable targets.
- Supplement rows are not shown by default.
- Current parent Segment is disabled when moving there would be a no-op.

## Mutation Model

UI movement needs explicit product IPC; it must not expose raw paths to renderer.

Expected capabilities:

- List move targets for a source entity.
- Move a Memory to a target memory space.
- Move a Segment to a target Memory.
- Move a SegmentSupplement to a target Segment.
- Primary content tab movement must call the Segment move capability for the parent Segment. There is no body/transcript/artifact move capability.

Main process owns:

- target validation,
- protected Draft Memory guard,
- single-writer lock handling,
- whole-directory move,
- target convergence,
- typed error envelopes.

Renderer owns:

- dialog open target,
- selected target id,
- pending state,
- query/session projection updates,
- user-visible toasts.

## Post-Move Projection

Same-space move:

- Remove the entity from the old parent projection.
- Add or refresh the target parent projection.
- Focus the moved entity at the new location when possible.

Cross-space move:

- Remove the entity from the active source projection.
- Invalidate source workspace snapshot and affected Memory detail/content/playback caches.
- Show a success toast with an `打开目标空间` action when the destination is a normal registered memory space.
- Draft destination/source uses the same projection rules, but protected default Draft Memory remains immovable.

Stale response guard:

- In-flight move responses are ignored if the active workspace handle changed.

## Error Handling

Use existing root toast style.

Expected visible failures:

- target no longer exists,
- source no longer exists,
- duplicate id conflict in target scope,
- protected entity,
- workspace lock lost,
- filesystem move failed,
- target convergence/index stale.

For `file-written-index-stale`, treat the file move as committed, refresh/invalidate projections, and show the error toast.

## Verification

Implementation must include:

- IPC contract tests for request/response schemas and bridge surface.
- Main tests for Memory, Segment and SegmentSupplement UI move handlers across same-space and cross-space targets.
- Renderer tests for More menu entry, dialog target filtering, disabled no-op targets, pending state, stale response guard and cache cleanup.
- Renderer tests for primary `正文` / `转录` / `作品` tab More entries invoking the parent Segment move flow.
- Runtime verification with `npm run dev` against Draft and a test memory space.

Agent validation must use real Codex CLI auth and inspect traces/records, not regex-only scripts.

Final gate before commit:

```bash
npm run verify:quick
```

## Verification Evidence

- `npm run dev` opened the real Electron app at `localhost:5183`; Memory, Segment and primary `正文` More menus showed move entries and opened the correct target-level dialog.
- Codex CLI read real Draft and `测试` memory-space files using local auth and wrote its final record to `.tmp/codex-memory-move-validation.md`.
- Focused checks passed for workspace contract, preload bridge, file-truth move helpers, workspace IPC, renderer API, action menus, move dialog, affected renderer components, `App.test.tsx`, and `npm run typecheck`.

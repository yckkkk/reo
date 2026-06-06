# Widget Object Navigation And Orphan Diagnostics

Timezone: America/Los_Angeles

## Objective

Allow Workspace Widget runtime code to request host selection of a concrete Memory object when it has a valid `memoryId` plus optional `segmentId` or `supplementId`, and report orphan `.reo/objects/**` mirrors that no longer have an active semantic file and are not in trash.

## Current Model

- Widget iframe runtime is isolated under `reo-render://` and can only use documented `window.reo` methods.
- `window.reo.ui.selectMemory({ memoryId })` switches the main content Memory but cannot focus a Segment or SegmentSupplement.
- Renderer already owns Memory Studio selection through `selectedMemoryId`, `segmentFocusIntent`, and content tab state.
- `content.readMemoryDetail({ memoryId })` already provides the active Memory detail projection needed to verify whether a Segment or Supplement can be selected.
- `.reo/objects/*/*.json` is a Reo-managed mirror layer, not semantic truth. A mirror without matching active `memory.md`, `segment.md`, `supplement.md`, or `widget.md`, and without a matching trash object, should be visible to diagnostics.

## State Machine

Widget object selection:

1. Runtime calls `window.reo.ui.selectObject({ memoryId, segmentId?, supplementId? })`.
2. Host accepts only workspace Widget iframe origin/source.
3. Host validates the target shape:
   - `memoryId` only selects the Memory.
   - `memoryId + segmentId` selects the Memory and focuses the Segment.
   - `memoryId + segmentId + supplementId` selects the Memory, focuses the Segment, and activates the Supplement tab.
   - `supplementId` without `segmentId` is invalid.
4. Host confirms the Memory exists in the current snapshot and confirms Segment/Supplement existence through the Memory detail read model.
5. Host changes only renderer UI selection state. It does not create files, expose paths, switch away from the Widget tab, or call a new main IPC mutation.
6. If workspace flow interruption is blocked or target cannot be found, response is explicit and no partial selection is committed.

Orphan object diagnostics:

1. Doctor scans `.reo/objects/{memories,segments,supplements}`.
2. For each manifest, doctor checks active semantic file existence by id and kind.
3. If active semantic file is missing, doctor checks matching trash locations.
4. A mirror with no active semantic file and no matching trash location is reported as an orphan mirror.
5. Doctor remains read-only and does not delete or rewrite user files.

## Invariants

- No raw root path or workspace-relative object path is exposed through Widget runtime bridge responses.
- Runtime bridge remains a closed method allowlist; no generic IPC or filesystem bridge is added.
- Object navigation does not loosen Electron sandbox, context isolation, CSP, protocol, navigation, or permission rules.
- Widget selection uses `memory.memoryId`, never `memory.id`.
- `state.json` does not affect host preview version or navigation availability.
- Orphan diagnostics preserve user content and report recovery hints only.

## Success Criteria

- `window.reo.ui.selectObject({ memoryId })` preserves existing Memory selection behavior.
- `window.reo.ui.selectObject({ memoryId, segmentId })` focuses an existing Segment after selecting its Memory.
- `window.reo.ui.selectObject({ memoryId, segmentId, supplementId })` focuses the Segment and activates the Supplement tab.
- Invalid object targets return typed runtime errors or `{ selected: false }` without changing host selection.
- The managed runtime bridge and prompt/reference docs document `selectObject`.
- `reo-doctor` reports a `.reo/objects/segments/<id>.json` mirror with no active `segment.md` and no trash entry.
- Focused tests run RED before implementation and pass after implementation.

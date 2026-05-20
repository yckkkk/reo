# Spike 6 - external edit refresh and dirty body isolation

Status: DONE

## Answer

Yes. The current visibility refresh path can support note dirty body isolation without a file watcher.

The existing App flow already refreshes file truth when the active document becomes visible, seeds the workspace snapshot, and invalidates workspace-scoped child queries. A future note editor can use the same refresh trigger: clean editor state may adopt the refreshed note content query result, while dirty editor state must keep its local body and expose a conflict/banner state. No watcher is required for the first note foundation slice.

## Source references

- `src/renderer/src/App.tsx:734-940`: active workspace refresh effect. It reads `workspace:readWorkspaceSnapshot`, coalesces overlapping refreshes, checks stale session revisions, seeds the refreshed snapshot, and invalidates workspace-scoped child queries after a changed file-truth snapshot.
- `src/renderer/src/workspace/workspaceQueries.ts:18-29`: workspace snapshot cache key is `['workspace', 'snapshot', workspaceId]`; handle is intentionally not part of the key.
- `src/renderer/src/workspace/workspaceQueries.ts:58-93`: Memory detail query uses `workspaceId + memoryId`, verifies request identity, and returns the detail projection.
- `src/renderer/src/workspace/workspaceQueries.ts:95-145`: Segment content query uses `workspaceId + memoryId + segmentId` and verifies the response identity. Future generic note content can reuse this identity shape.
- `src/renderer/src/workspace/LoadedWorkspaceFrame.tsx:57-83`: loaded workspace reads the snapshot query and passes the selected Memory into `MemoryStudio`; note content isolation should not live in this frame.
- `src/renderer/src/workspace/MemoryStudio.tsx:1699-1743`: selected Memory detail and selected Segment content are already separate query reads. This is the future hook for generic note body content, not snapshot summary.
- `src/renderer/src/App.tsx:917-927`: after file-truth refresh changes the snapshot, App invalidates workspace-scoped child queries while preserving protected pending Segment delete queries.
- `src/renderer/src/workspace/segmentDeleteProjection.ts:1-154`: pending Segment delete uses feature-local refs/projection guards instead of a global store. Note dirty isolation should follow the same local-owner pattern.

## Recommended hook

Do not put note body text into the workspace snapshot. Keep snapshot refresh as the external-change trigger and keep note body in the future generic `segment-content` / `segment-supplement-content` query result.

Hook point:

1. App visibility refresh continues to call `readWorkspaceSnapshot`.
2. If the snapshot changed, App continues to invalidate workspace-scoped detail/content queries.
3. `NoteEditorOverlay` receives the refreshed note content query result.
4. Overlay applies refreshed body only when `dirty === false`.
5. If `dirty === true` and refreshed `contentHash` differs from the editor baseline, keep the local body and show conflict-needed banner state.

## Minimal state shape

No Zustand is needed for sub-spec (d). The state owner is the mounted App/NoteEditorOverlay subtree.

```ts
type NoteEditorOwner = {
  workspaceHandle: string;
  workspaceId: string;
  memoryId: string;
  segmentId: string;
  supplementId?: string;
};

type NoteEditorOverlayState = {
  owner: NoteEditorOwner;
  body: string;
  baselineContentHash: string;
  dirty: boolean;
  savePending: boolean;
  conflictBanner: null | {
    kind: 'external-edit-conflict';
    diskContentHash: string;
    editorBaselineContentHash: string;
  };
};
```

`App` only needs a feature-local active note editor target, plus session-bound cleanup equivalent to existing workspace targets. The body draft and banner belong inside `NoteEditorOverlay`; they should not enter TanStack Query, workspace snapshot, URL, `.reo`, or Zustand.

## Tests for sub-spec (d)

- App visibility refresh: when visible refresh changes a note segment summary, it invalidates the exact generic note content query for the active workspace.
- Clean editor refresh: with `dirty === false`, a refetched note content body replaces the editor body and updates `baselineContentHash`.
- Dirty editor refresh: with `dirty === true`, a refetched note content body does not replace the editor body and sets `external-edit-conflict`.
- Same-hash dirty refresh: with `dirty === true` but unchanged `contentHash`, no banner is shown.
- Save after conflict: save uses the original `baselineContentHash`; stale disk response keeps local body and keeps the conflict banner actionable.
- Session boundary: stale note content responses from an old `workspaceHandle` do not modify a reopened editor for the same `workspaceId`.
- Pending Segment delete interaction: visibility refresh keeps existing pending delete protections and does not suppress unrelated note content invalidation.

## Recommendation

Implement dirty body isolation as a small reducer inside `NoteEditorOverlay` or a feature-local pure helper imported by that overlay. The reducer should be covered by renderer-node tests, and the App/overlay behavior should be covered by jsdom component tests around query invalidation and visible banner copy.

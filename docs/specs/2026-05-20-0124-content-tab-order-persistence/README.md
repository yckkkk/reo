# Content Tab Order Persistence

Timezone: 2026-05-20 01:24 America/Los_Angeles

## Objective

Content tab drag order in Memory Studio must survive renderer remounts, page switches, workspace snapshot refresh, and memory detail rereads.

## Model

- Content tab order belongs to the parent Segment, not to `MemoryStudio` component lifetime.
- The durable source is the Segment technical manifest in `.reo/objects/segments/<segmentId>.json`.
- The field stores ordered content tab ids: primary Segment content plus finalized SegmentSupplement ids.
- Memory detail projects the order; renderer uses that projection first and keeps dragover state only as pending UI.
- Dragover may update the visible order optimistically, but persistence commits once at drag end/drop.
- Reorder does not change Segment `updatedAt` or Memory activity ordering.

## Success Criteria

- Existing drag/drop behavior still works during a single drag session.
- After a drag reorder, remounting Memory Studio with the same Memory detail projection keeps the new order.
- Main file-truth read returns the persisted order.
- Invalid or stale order ids are ignored on read, with live tabs appended in file-truth order.
- No DB, Zustand store, generic runtime, or compatibility shim is introduced.

## TDD Evidence

- RED: add renderer behavior coverage for reorder persistence across remount.
- RED: add main file-truth coverage for persisted Segment content tab order projection.
- GREEN: implement the smallest contract, IPC, main write, renderer commit, and docs update that satisfies those tests.

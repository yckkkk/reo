# Entity Move UI Implementation Plan

Goal: ship UI-driven same-level movement for Memory, Segment and SegmentSupplement, including primary content tab entries that move the parent Segment.

## Tasks

- [x] Add IPC contract schemas, channel names and bridge methods for move targets and three move mutations.
- [x] Add main file-truth move helpers for Memory, Segment and SegmentSupplement whole-directory moves.
- [x] Wire workspace IPC handlers with sender/handle validation, protected Draft guard, registry/Draft target resolution and typed errors.
- [x] Add renderer API wrappers.
- [x] Add More menu entries: Memory/Segment/Supplement `移动...`; primary `正文` / `转录` / `作品` `移动片段...`.
- [x] Add single-layer move Dialog and target tree.
- [x] Update App/LoadedWorkspaceFrame/MemoryStudio state flow for open target, pending mutation, cache cleanup and focus/toast.
- [x] Run focused main/contract/bridge/renderer checks, then `npm run dev` runtime verification.
- [x] Run `npm run verify:quick`.

## TDD Boundary

This changes IPC, filesystem mutation and user-visible workflow, so implementation starts with failing tests:

- Contract and preload bridge surface.
- Main handler move behavior across same-space and cross-space targets.
- Renderer More menu entries and content tab parent Segment move behavior.

Runtime agent validation remains separate from code tests and must inspect actual traces/records.

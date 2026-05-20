# Note External Edit Conflict

Created: 2026-05-19 15:39 America/Los_Angeles

## Objective

Deliver Note Foundation sub-spec (d): finalized note Segment and SegmentSupplement edits must detect external
Markdown changes through `baselineContentHash`, return `ERR_SEGMENT_CONTENT_STALE` on stale saves, keep dirty editor
body intact during visibility refresh, and present a conflict dialog with "保留我的修改" and "使用磁盘版本" choices.

## Source Constraints

- Original design authority:
  - `docs/archive/specs/2026-05-19-0111-note-foundation-design/README.md`
  - `docs/archive/specs/2026-05-19-0111-note-foundation-design/engineering-handoff.md`
- Active initiative:
  - `docs/initiatives/2026-05-19-note-foundation/README.md`
  - `docs/initiatives/2026-05-19-note-foundation/plan.md`
  - `docs/initiatives/2026-05-19-note-foundation/tasks.md`
- Current truth to update:
  - `docs/current/data.md`
  - `docs/current/flow.md`
  - `docs/current/frontend.md`
  - `docs/current/quality.md`

## Scope

- Add `baselineContentHash` to finalized generic content read/write contracts for note Segment and note
  SegmentSupplement.
- Compute full SHA-256 hex from Markdown body text at read time; do not store the hash in Markdown, manifest, index,
  DOM text, toast copy, or logs.
- On finalized note write, compare request `baselineContentHash` with current disk body hash inside the existing
  workspace write path before replacing Markdown.
- Return typed `ERR_SEGMENT_CONTENT_STALE` with current disk body and current hash when the baseline mismatches.
- In `NoteEditorOverlay`, keep the baseline with the edit target; stale save opens an AlertDialog without overwriting
  the user's dirty body.
- "使用磁盘版本" resets body and baseline to the current disk body/hash.
- "保留我的修改" retries the save with the current disk hash as baseline.
- Visibility refresh keeps dirty note body fields out of the editor while allowing non-body projections to refresh.

## Out Of Scope

- File watcher.
- Automatic merge/diff UI.
- Rich editor adapter.
- New storage roots or `note.md`.
- Attachment garbage collection.
- Any relaxation of Electron security baselines.

## Acceptance Checks

- RED tests are run and fail before production changes for each phase.
- `npm run verify:quick` passes at every phase gate.
- Independent `/review` subagent passes with no unresolved BLOCKER/MAJOR.
- Independent `$ycksimplify` subagent passes.
- `implementation-notes.md` records all spec deviations, gate failures, and decisions.

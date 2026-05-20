# Implementation Plan

## Phase 1: RED

- Main tests:
  - Attachment save/list IPC contract surface exists and rejects untrusted sender / wrong workspace.
  - Segment attachment save creates `attachments/`, returns relative path only, rejects unsupported MIME and oversize.
  - SegmentSupplement attachment save writes under supplement-owned `attachments/`.
  - Attachment list skips or rejects unsafe symlink leaves without following them.
  - `reo-attachment://` scheme registration includes `reo-app` and `reo-attachment` in the pre-ready privileged
    registration path.
  - Production CSP includes `img-src ... reo-attachment:` and does not add `connect-src reo-attachment:`.
- Renderer tests:
  - Note editor attachment insertion calls the workspace API and inserts markdown image syntax at current cursor.
  - Markdown preview maps `attachments/...` image refs to `reo-attachment://` URLs and leaves unsafe schemes unchanged.
- Run RED tests and record concrete failures in `implementation-notes.md`.

## Phase 2: GREEN

- Add attachment schemas and explicit workspace channels in `src/workspace-contract/*`.
- Add preload methods under `window.reoWorkspace`; no generic invoke bridge.
- Implement main attachment save/list helpers in file-truth layer using no-follow filesystem validation.
- Register `reo-attachment` privileged scheme with existing app protocol registration path.
- Add `reo-attachment://` handler that resolves active workspace entity paths through main-owned workspace state.
- Update production CSP builder.
- Add renderer attachment insertion UI inside existing `NoteEditorOverlay` markdown-first surface.
- Add Markdown attachment URL mapping used by `MarkdownContentSurface` and overlay preview.
- Run focused tests and `npm run verify:quick`.

## Phase 3: REFACTOR + Docs + Operation Validation

- Remove duplication between Segment and SegmentSupplement attachment path handling where a real invariant exists.
- Update `docs/current/electron.md`, `data.md`, `flow.md`, `frontend.md`, `quality.md`, `product.md`, and
  `roadmap.md`.
- Run Electron runtime validation and save evidence under
  `docs/specs/2026-05-19-1305-note-attachments-protocol/evidence/runtime/`.
- Run `npm run verify:quick`.
- Run independent `/review` and `$ycksimplify` gates against active source, active spec, initiative docs, and archived
  design spec.
- Archive this spec only after all gates pass.

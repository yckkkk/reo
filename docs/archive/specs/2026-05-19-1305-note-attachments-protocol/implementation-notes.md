# Implementation Notes

## 2026-05-19 13:05 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Start scope:
  This sub-spec implements attachments and `reo-attachment://` for the current markdown-first note editor. It does
  not integrate BlockNote / Milkdown paste flow because sub-spec (b) established that no rich editor adapter has
  passed Reo's markdown-truth round-trip gate.
- Design inputs:
  - Archived design spec §13 / §14 define attachments as local resources referenced by Markdown relative paths.
  - Spike #3 proved `reo-attachment://` works for `<img>` under locked Electron security and that renderer JS
    `fetch()` should not be the main path with `corsEnabled: false`.
  - Electron official docs via Context7 confirm `registerSchemesAsPrivileged` must run before app ready and
    `protocol.handle` should serve contained custom protocol resources after ready.
- Decision:
  Keep `reo-attachment://` image-display only for this sub-spec. Production CSP adds the scheme to `img-src` only;
  no `connect-src reo-attachment:` support is added.
- Alternatives considered:
  - Base64 inline images: rejected because it increases Markdown/DOM size and weakens the clean file-backed URL model.
  - Renderer JS fetch for attachment bytes: rejected for this sub-spec because Spike #3 failed cross-scheme fetch
    under `corsEnabled: false`, and preview only needs `<img>`.
  - Immediate rich editor image block paste: rejected until a future editor adapter spec passes markdown round-trip.

## 2026-05-19 13:08 America/Los_Angeles

- Worker C RED renderer tests added in `src/renderer/src/App.test.tsx` for finalized Note image insertion and
  Segment / SegmentSupplement attachment image URL mapping.
- Focused RED command:
  `npm run test:renderer -- src/renderer/src/App.test.tsx -t "inserts a saved image attachment reference|maps Note Segment attachment image references|maps Note SegmentSupplement attachment image references"`
- Expected RED result:
  - `inserts a saved image attachment reference at the finalized Note cursor` fails because `NoteEditorOverlay` has
    no accessible icon button named `插入图片`.
  - `maps Note Segment attachment image references to reo-attachment URLs only for attachments paths` fails because
    no `img` role named `Local cake` is rendered from Markdown.
  - `maps Note SegmentSupplement attachment image references to supplement reo-attachment URLs` fails because no
    `img` role named `Supplement local` is rendered from Markdown.
- Formatting check: `npx prettier --check src/renderer/src/App.test.tsx` passed.

## 2026-05-19 Worker A Phase 1 RED

- Added focused main RED tests in `test/main/noteAttachments.test.ts` for Segment / SegmentSupplement attachment
  save/list file truth and explicit IPC contract.
- RED command: `MAIN_TEST_FILES=test/main/noteAttachments.test.ts npm run test:main`.
  Result: 6 failing tests, 0 passing. Expected RED failures are missing `src/main/noteAttachments.js`, missing
  attachment channel constants, and missing `handleSave/ListSegmentAttachment*ForTest` IPC exports.

## 2026-05-19 13:07 America/Los_Angeles

- Worker B Phase 1 RED scope: protocol/CSP registration tests only.
- Added focused RED tests:
  - `test/main/appProtocol.test.ts` checks the before-ready privileged scheme registration path includes both
    `reo-app` and `reo-attachment`, keeps existing `reo-app` secure/standard privileges, and requires the attachment
    scheme's image-serving privileges from the spec.
  - `test/main/securityPolicy.test.ts` checks production CSP allows `reo-attachment:` in `img-src`, does not add it
    to `connect-src`, and keeps `media-src 'self' blob:`.
- Focused RED command:
  `MAIN_TEST_FILES=test/main/appProtocol.test.ts,test/main/securityPolicy.test.ts npm run test:main`
- Expected RED result:
  - `privileged schemes register reo-app and reo-attachment before app ready` fails because actual registered schemes
    are only `['reo-app']`.
  - `production content security policy allows attachment images without widening fetch or media sources` fails because
    production `img-src` does not include `reo-attachment:`.
- Navigation/window-open note: no existing pure-testable helper was found for these denials; current deny behavior is
  wired directly in `src/main/index.ts`. Keep this for Phase 3 runtime validation instead of adding a brittle main-window
  unit test.

## 2026-05-19 13:30 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 2 GREEN implementation:
  - Added Segment and SegmentSupplement attachment IPC schemas, bridge methods, preload invocations, renderer API
    wrappers, and main handlers.
  - Added `src/main/noteAttachments.ts` for image-only attachment save/list and protocol file resolution.
  - Added `NoteEditorOverlay` image insertion for finalized note Segment / SegmentSupplement edit targets. Create
    draft targets remain markdown-only until a saved object id exists.
  - Added `MarkdownContentSurface` mapping for Markdown image references under `attachments/<filename>` to
    `reo-attachment://<workspaceId>/segments/<segmentId>/<filename>` or the supplement variant.
  - Registered `reo-attachment` as a privileged scheme before app ready and installed a GET-only protocol handler
    after ready.
- Decision:
  `reo-attachment://` resolves only through the active main-process workspace handle store. The URL carries
  `workspaceId`, entity ids, and one safe filename; main process resolves the raw path from manifests and current
  file truth.
- Alternatives considered:
  - Encoding memoryId or absolute paths in the URL: rejected because URLs should not leak raw filesystem structure,
    and segment / supplement manifests already carry parent ownership.
  - Global registry outside workspace handles: rejected because the active handle store already represents the opened
    workspace authority and lock usability.
- Focused GREEN evidence:
  - `MAIN_TEST_FILES=test/main/noteAttachments.test.ts npm run test:main` passed: 6/6.
  - `MAIN_TEST_FILES=test/main/appProtocol.test.ts,test/main/securityPolicy.test.ts npm run test:main` passed: 16/16
    before protocol serve was added, then combined with attachment tests passed: 22/22.
  - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "inserts a saved image attachment reference|maps Note Segment attachment image references|maps Note SegmentSupplement attachment image references"`
    passed: 3/3 selected tests.
  - `npx tsc -b` passed after adding attachment bridge mocks to `RecordingOverlay.test.tsx`.
  - `npm run verify:quick` passed: main 794 tests, renderer 462 tests, strict lint green, format check green.

## 2026-05-19 14:03 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 2 gate failure count:
  - `/review`: 1 failure. BLOCKER: attachment save/read/protocol still depended on path-based filesystem access after
    initial directory validation; MAJOR: successful `reo-attachment://` responses missed `Cache-Control: no-store`;
    MINOR: malformed percent encoding could throw during URL segment decode.
  - `$ycksimplify`: 1 failure. MAJOR: protocol read path must not create `attachments/`; MAJOR: save/list/read should
    reuse the existing no-follow directory identity primitives; MINOR: renderer should reject oversized files before
    reading them into memory.
- Fix:
  - `src/main/noteAttachments.ts` now uses directory identity + `O_NOFOLLOW` for save, existing-file reuse, list
    metadata, and protocol reads. Protocol resolution returns bytes + MIME, never raw absolute paths.
  - Protocol reads use an existing-directory path and do not call `mkdir`; missing `attachments/` returns
    `ERR_WORKSPACE_ATTACHMENT_NOT_FOUND`.
  - `src/main/appProtocol.ts` serves attachment bytes directly through `Response`, adds `Cache-Control: no-store`, and
    safely denies malformed percent-encoded paths.
  - `NoteEditorOverlay` rejects files over 25 MiB before `arrayBuffer()`.
- Focused evidence after fix:
  - `MAIN_TEST_FILES=test/main/noteAttachments.test.ts,test/main/appProtocol.test.ts,test/main/securityPolicy.test.ts npm run test:main`
    passed: 26/26.
  - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "inserts a saved image attachment reference|maps Note Segment attachment image references|maps Note SegmentSupplement attachment image references"`
    passed: 3/3 selected tests.
  - `npx tsc -b`, `npm run lint:strict`, and `npm run format:check` passed.
  - `npm run verify:quick` passed after the second fix: main 799 tests, renderer 462 tests, strict lint green, format
    check green.

## 2026-05-19 14:27 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 2 third gate failure count:
  - `/review`: 1 failure. MAJOR: read/list/protocol path for an existing `attachments/` directory still lacked owner
    directory identity binding.
  - `$ycksimplify`: 1 failure. MAJOR: protocol byte read checked size on a first fd, then reopened for read; MAJOR:
    read/list/protocol path still needed the same owner identity discipline as save.
- Fix:
  - Existing attachment directory resolution now reads the owner directory identity before touching `attachments`,
    validates `attachments` by local name while inside that owner identity, and rechecks the owner identity after
    child validation and containment.
  - Protocol byte read now opens a single fd and performs `fstat`, regular-file validation, 25 MiB cap, and
    `readFileSync` on that same fd.
- Focused evidence after fix:
  - `MAIN_TEST_FILES=test/main/noteAttachments.test.ts,test/main/appProtocol.test.ts,test/main/securityPolicy.test.ts npm run test:main`
    passed: 27/27.
  - `npx tsc -b`, `npm run lint:strict`, and `npm run format:check` passed.
  - `npm run verify:quick` passed after the fourth fix: main 799 tests, renderer 462 tests, strict lint green, format
    check green.
  - Phase 2 fourth gate rerun passed:
    - `/review` PASS: no unresolved BLOCKER or MAJOR.
    - `$ycksimplify` PASS: no unresolved BLOCKER or MAJOR.
  - `npm run verify:quick` passed after the third fix: main 799 tests, renderer 462 tests, strict lint green, format
    check green.

## 2026-05-19 14:37 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 2 fourth gate failure count:
  - `/review`: 1 failure. MAJOR: the `attachments/` child directory identity was still reacquired by absolute path
    after leaving the owner-bound operation.
  - `$ycksimplify`: 1 failure. MAJOR: same child identity authority issue for save/read/list/protocol.
- Fix:
  - Save and read directory resolution now capture the `attachments/` `DirectoryIdentity` while still inside
    `runInWorkspaceDirectorySync({ directory: ownerDirectory, directoryIdentity: ownerDirectoryIdentity })`.
  - Later file opens, list, reads, dedupe checks, and fsync use the captured child identity. The code no longer
    reacquires the child identity by absolute path after leaving the owner-bound section.
- Focused evidence after fix:
  - `MAIN_TEST_FILES=test/main/noteAttachments.test.ts,test/main/appProtocol.test.ts,test/main/securityPolicy.test.ts npm run test:main`
    passed: 27/27.
  - `npx tsc -b`, `npm run lint:strict`, and `npm run format:check` passed.
  - `npm run verify:quick` passed after the fix: main 798 tests, renderer 462 tests, strict lint green, format check
    green.

## 2026-05-19 14:16 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 2 second gate failure count:
  - `/review`: 1 failure. MAJOR: `attachments/` creation was not bound to the already-resolved Segment /
    SegmentSupplement owner directory identity; MAJOR: deterministic filename `EEXIST` treated any safe regular file
    as success without comparing bytes.
  - `$ycksimplify`: 1 failure. MAJOR: AVIF widened the attachment MIME scope beyond archived design §13; MAJOR:
    list/dedup read whole attachment bytes for metadata-only checks; MAJOR: protocol reads did not cap
    externally-created oversized files before `readFileSync`.
- Fix:
  - Attachment MIME support is limited to `image/png`, `image/jpeg`, `image/webp`, and `image/gif` in main and the
    renderer file picker.
  - `attachments/` creation now runs inside the owner directory identity with a non-recursive local mkdir, and rechecks
    the owner identity after creation and containment validation.
  - Existing-file reuse compares existing bytes to the requested payload; same deterministic filename with different
    bytes is a write failure, not success.
  - List and existing-file metadata checks use no-follow open + `fstat` only. Protocol serving remains the only path
    that reads bytes, and it rejects files over 25 MiB before reading.
- Focused evidence after fix:
  - `MAIN_TEST_FILES=test/main/noteAttachments.test.ts,test/main/appProtocol.test.ts,test/main/securityPolicy.test.ts npm run test:main`
    passed: 27/27.
  - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "inserts a saved image attachment reference|maps Note Segment attachment image references|maps Note SegmentSupplement attachment image references"`
    passed: 3/3 selected tests.
  - `npx tsc -b`, `npm run lint:strict`, and `npm run format:check` passed.

## 2026-05-19 14:52 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 docs/current compression:
  - Updated `docs/current/electron.md` with current CSP, IPC, and protocol truth: `reo-app://` remains renderer
    asset-only; `reo-attachment://` is image-preview-only for active finalized note Segment and note
    SegmentSupplement attachments; the scheme is added only to `img-src`, not `connect-src`.
  - Updated `docs/current/data.md`, `architecture.md`, `flow.md`, `frontend.md`, `product.md`, `quality.md`, and
    `roadmap.md` so note attachments are represented as `attachments/<filename>` payloads under the owning note file
    space node, not as objects, query keys, manifest lists, or `.reo/index.json` truth.
- Decision:
  - Attachment save writes the image file immediately for finalized edit targets, while Markdown remains the semantic
    truth. If the user inserts an image but never saves the body, the unreferenced file remains in that note directory.
  - Alternative considered: defer attachment writes until body save. Rejected because it would require a new draft
    attachment transaction for finalized edits and would widen the conflict surface before external edit conflict is
    implemented.

## 2026-05-19 14:54 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 runtime evidence:
  - `npm run build:app` passed.
  - `REO_DIAGNOSTICS_CONSOLE=1 npm start` launched production preview and logged app ready with
    `fields.mode: "production"`, then successfully served initial workspace IPC calls.
  - Evidence written to `docs/specs/2026-05-19-1305-note-attachments-protocol/evidence/runtime/runtime-validation.md`.
- Verification boundary:
  - Runtime evidence covers production mode launch plus source-backed production URL, CSP header, new-window deny,
    external navigation deny, and permission default deny.
  - Attachment byte serving and CSP shape are also covered by focused main tests and will remain under
    `npm run verify:quick` for the final Phase 3 gate.

## 2026-05-19 15:11 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 verification:
  - First `npm run verify:quick` run was interrupted during renderer tests after main tests passed because the default
    renderer runner was silent for several minutes. This was not counted as a gate pass or failure.
  - `npm run test:renderer -- --reporter verbose` then passed: 42 files, 462 tests. The silence was runner output
    behavior plus slow component tests, not a product failure.
  - Final `npm run verify:quick` passed: main 799 tests, renderer 462 tests, strict lint green, format check green.

## 2026-05-19 15:24 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 `$ycksimplify` gate fix:
  - Archived design spec §14 and engineering handoff AC-PROTO require production `img-src` to include `blob:` while
    adding `reo-attachment:`.
  - `src/main/securityPolicy.ts` kept the existing `data:` image source and added `blob:` plus `reo-attachment:`.
    `connect-src` and `media-src` remain unchanged.
- Decision:
  Keep `data:` because it was already part of the current production image CSP before this sub-spec; add `blob:` to
  satisfy the archived protocol constraint without widening fetch, script, style, media, frame, or object sources.

## 2026-05-19 15:19 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 `/review` gate failure:
  - The review subagent found a MAJOR issue in `NoteEditorOverlay`: image attachment insertion captured the current
    body text, then awaited the attachment save while the body textarea remained editable. A user edit during that
    window could be overwritten by the later attachment insertion.
- RED evidence:
  - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "inserts a saved image attachment reference"`
    failed because the textarea was not disabled while `saveSegmentAttachment` was still pending.
- Fix:
  - The note body textarea is disabled while either body save or attachment save is pending. This keeps the existing
    single-write interaction model and avoids adding a second buffered merge path during sub-spec c.
  - The test now waits for React to commit the resolved async attachment insertion before asserting the final Markdown.
- GREEN evidence:
  - The same focused renderer test passed: 1/1 selected test.
- Alternatives considered:
  - Rebase the attachment insertion against the latest body state when the IPC returns. Rejected for this phase because
    it would require cursor/selection reconciliation across an async boundary and belongs with the external edit
    conflict work in sub-spec d rather than the attachment protocol contract.

## 2026-05-19 15:25 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 verification after `/review` fix and `$ycksimplify` CSP fix:
  - `npm run test:renderer -- --run src/renderer/src/App.test.tsx --testNamePattern "inserts a saved image attachment reference|maps Note Segment attachment image references|maps Note SegmentSupplement attachment image references"`
    passed: 3/3 selected tests.
  - `MAIN_TEST_FILES=test/main/noteAttachments.test.ts,test/main/appProtocol.test.ts,test/main/securityPolicy.test.ts npm run test:main`
    passed: 27/27.
  - `npm run verify:quick` passed: main 799 tests, renderer 462 tests, strict lint green, format check green.

## 2026-05-19 15:37 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase 3 final gate:
  - `/review` subagent PASS: no unresolved BLOCKER/MAJOR after checking archived design, active sub-spec, and
    `docs/current/*`.
  - `$ycksimplify` subagent PASS after two small fixes: attachment insertion now stores the exact cursor returned by
    the insertion helper, so duplicate image markdown does not move the caret to the first duplicate; image markdown
    parsing no longer uses an unnecessary type cast.
  - Final `npm run verify:quick` passed after the `$ycksimplify` edits: main 799 tests, renderer 462 tests, strict
    lint green, format check green.

## 2026-05-20 00:24 America/Los_Angeles

- Commit anchor: pending working tree after `4e7e5e69`.
- Runtime correction:
  - Electron dev CSP did not include `reo-attachment:` in `img-src`, so pasted/dropped note images could be saved
    and rendered as `<img>` elements while still decoding as broken images in dev runtime.
  - Production and development CSP now both allow `reo-attachment:` only in `img-src`; `connect-src` and
    `media-src` remain unchanged.
- Attachment owner model correction:
  - `saveNoteSegmentAttachment` and `saveNoteSegmentSupplementAttachment` no longer depend on full finalized
    Segment/Supplement projection reads for owner validation. Attachment save only needs manifest owner identity
    plus Markdown frontmatter `kind: note`.
  - This avoids blocking drag/paste image insertion when a note manifest has stale derived body byte length/hash but
    `segment.md` / `supplement.md` is still valid note truth.
- Alternatives considered:
  - Loosen attachment validation or bypass owner validation: rejected because `reo-attachment://` must remain
    owner-scoped and path-contained.
  - Keep using full projections and repair stale manifests opportunistically first: rejected because attachment save
    should not require a full note content projection when it only writes an owner-local file.
- Evidence:
  - RED: `npm run test:main -- --test-name-pattern "stale note body byte length"` failed with
    `ERR_WORKSPACE_METADATA_INVALID`.
  - GREEN: focused attachment/CSP/note tests passed, 93/93.
  - Runtime E2E verified paste and drop image insertion in expanded note editor, `reo-attachment://` image decode
    with `naturalWidth=1`, then restored the original note body and removed generated runtime image files.

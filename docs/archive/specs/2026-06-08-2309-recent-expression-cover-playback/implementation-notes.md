# Implementation Notes — Recent Expression Cover Background And Hover Playback

Running log. Append one entry per task: what changed, test evidence (command +
result), and any deviation from the plan or spec. Newest at the bottom.

## Status

- Phase 1 — Contract + channel: complete
- Phase 2 — Main playback derivation: complete
- Phase 3 — Playback-read IPC: complete
- Phase 4 — Renderer primitives: complete
- Phase 5 — Home integration: complete
- Phase 6 — Closeout: not started

## Log

<!-- e.g.
### Task 1.1 — WorkspacePlaybackSource schema (2026-06-08)
- Added schema + field + type. RED: `npx vitest run src/workspace-contract` → 3 failing.
  GREEN → pass. Deviation: none.
-->

### Phase 1 — Contract + channel (2026-06-08)

- Added `WorkspacePlaybackSource`, optional recent-expression `playback`, and the
  explicit `workspace:readExpressionPlaybackAudio` channel/request/response contract.
- RED: `npm run test:main -- test/main/workspaceContract.test.ts` failed because
  the new channel/schema exports and `playback` field did not exist.
- GREEN: `MAIN_TEST_FILES=test/main/workspaceContract.test.ts npm run test:main`
  passed 70/70. `npm run typecheck:quick` passed.
- Review/simplify: fixed the request schema to be truly handle-less after the first
  GREEN attempt exposed an accidental `workspaceHandle` requirement; `git diff --check`
  passed. Deviation: used the repo's `MAIN_TEST_FILES` main-test filter because the
  contract suite is Node-test based, not Vitest.

### Phase 2 — Main playback derivation (2026-06-08)

- Added `recentExpressionSegmentPlayback` and `recentExpressionSupplementPlayback`;
  wired `readRecentExpressionItemsFromFileTruth` to attach `playback` for audio
  segments/supplements and ready note speech only.
- RED: `MAIN_TEST_FILES=test/main/recentExpressionPlayback.test.ts npm run test:main`
  failed on the missing helper module. RED:
  `MAIN_TEST_FILES=test/main/recentExpressions.test.ts npm run test:main` failed with
  missing `playback` on emitted recent-expression items after fixing the test helper
  to locate finalized note directories by file truth.
- GREEN: `MAIN_TEST_FILES=test/main/recentExpressionPlayback.test.ts,test/main/recentExpressions.test.ts npm run test:main`
  passed 11/11.
- Review/simplify: kept helper inputs to the minimum metadata/projection shape instead
  of exporting file-truth internals; missing note speech does not read `speech.mp3`;
  note supplements remain non-playable in this slice. `git diff --check` passed for
  Phase 2 files. Deviation: main tests use Node test runner filters rather than Vitest.

### Phase 3 — Playback-read IPC (2026-06-08)

- Added `resolveExpressionPlaybackAudio`, the handle-less
  `handleReadExpressionPlaybackAudio` IPC path, registration for
  `workspace:readExpressionPlaybackAudio`, and preload/bridge contract exposure.
- RED: `MAIN_TEST_FILES=test/main/expressionPlaybackAudio.test.ts npm run test:main`
  failed on missing resolver module. RED:
  `MAIN_TEST_FILES=test/main/workspaceIpc.test.ts npm run test:main` failed on the
  missing `handleReadExpressionPlaybackAudioForTest` export. RED:
  `MAIN_TEST_FILES=test/main/workspaceBridgeSurface.test.ts npm run test:main`
  failed because `ReoWorkspaceBridge` had no `readExpressionPlaybackAudio` method.
- GREEN: `MAIN_TEST_FILES=test/main/expressionPlaybackAudio.test.ts,test/main/workspaceIpc.test.ts,test/main/workspaceBridgeSurface.test.ts npm run test:main`
  passed 242/242 after implementation and review fixes.
- Review/simplify: fixed projection-reader thrown errors so stale playback requests
  return error envelopes instead of rejected IPC promises; reused `resolveMemorySpacePaths`
  for normal-space root validation/canonicalization; simplified the playback resolver
  to accept an already verified `rootPath` instead of a one-off root resolver.
- `git diff --check` passed for the Phase 3 files before the review fixes; the final
  diff check will run in Phase 6. Deviation: main tests use Node test runner filters
  rather than Vitest.

### Phase 4 — Renderer primitives (2026-06-08)

- Added `useMediaPlaybackController` and `MediaPlaybackControl` for the reusable
  one-active-audio playback contract and hover/loading/playing/paused control surface.
  Updated the typed RecordingOverlay bridge test default for the new preload method.
- RED: `npx vitest run src/renderer/src/components/ui/media-playback-control.test.tsx src/renderer/src/components/ui/useMediaPlaybackController.test.tsx`
  failed on missing renderer primitive modules.
- GREEN: the same Vitest command passed 12/12. `npm run typecheck:quick` passed.
- Review/simplify: strengthened URL lifecycle assertions so source switching uses a
  distinct second object URL and `ended` verifies both `src` cleanup and object URL
  revocation; split one long visibility condition. Raw-color scan found no token
  violations. Existing MemoryStudio playback remains feature-local and was not reused
  because it includes waveform/progress/editor-specific behavior beyond the Home icon
  control contract.
- Docs/current decision: deferred the stable frontend note until Phase 5/6 because
  the primitive is intentionally consumed by Home in this task, and should not be
  documented as a standalone no-consumer abstraction before that integration lands.

### Phase 5 — Home integration (2026-06-09)

- Wired Home recent-expression rows to project cover image sources and optional
  handle-less playback refs; Home playback calls `readExpressionPlaybackAudio`
  only for playable recent expressions and validates the echoed request/ref before
  creating an audio source.
- Added Home icon cover fill, hover play/pause control, single active playback,
  and the post-review UI behavior fixes: no inner hover-fill change, paused +
  pointer-leave restores the pre-hover glyph, playing remains visible after
  pointer-leave, and non-playable rows do not show the playback scrim.
- Added a Home-specific recent-expression glyph-tone path. It reuses the existing
  background-to-foreground contrast calculation, but samples the small Home icon
  viewport instead of reusing Memory Studio card `cover-bottom` variables. The
  shared idle/cancel hook lives in `covers/useResolvedImageTone`.
- Corrected the playback icon shape after visual review: the outer 34px recent
  expression icon remains the original `rounded-full`; the playback control
  wrapper is transparent; the only playback background is the centered 28px inner
  button with the same concentric rounded-full/squircle model and no hover fill.
- RED: `npx vitest run src/renderer/src/workspace/WorkspaceStarterHome.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/workspaceApi.test.ts`
  failed on missing Home cover/playback projection and renderer bridge wrapper.
  RED: `npx vitest run src/renderer/src/components/ui/media-playback-control.test.tsx src/renderer/src/workspace/WorkspaceStarterHome.test.tsx -t "shows a play control|shows paused playback|hides loading|fills recent expression|plays a playable"`
  failed on the old hover-fill/paused-leave behavior and missing glyph-tone vars.
  RED: `npx vitest run src/renderer/src/workspace/covers/recentExpressionGlyphTone.test.tsx src/renderer/src/workspace/WorkspaceStarterHome.test.tsx -t "recent expression glyph tone|fills recent expression|plays a playable"`
  failed before the Home-specific glyph-tone module and corrected shape model
  existed.
- GREEN: `npx vitest run src/renderer/src/workspace/covers/recentExpressionGlyphTone.test.tsx src/renderer/src/workspace/covers/coverTone.test.ts src/renderer/src/workspace/MemoryStudioSegmentCard.test.tsx src/renderer/src/components/ui/media-playback-control.test.tsx src/renderer/src/components/ui/useMediaPlaybackController.test.tsx src/renderer/src/workspace/WorkspaceStarterHome.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/workspaceApi.test.ts`
  passed 205/205. `npm run typecheck:quick` passed. `git diff --check` passed
  for the Phase 5 renderer/covers files.
- Review/simplify: fixed the non-playable scrim, removed the duplicate playback
  overlay background, restored the outer icon radius, moved Home glyph color off
  Memory Studio `cover-bottom` variables, and deduplicated cover-tone idle loading.
  Deviation: `recentExpressionGlyphTone.test.tsx` uses the renderer component
  Vitest project because the repo's `.test.ts` cover tests are explicitly
  allowlisted.

### Phase 6 — Final verification and closeout (2026-06-09)

- Compressed stable facts into `docs/current/data.md`, `docs/current/electron.md`,
  and `docs/current/frontend.md`: recent expression feed playback descriptors,
  the handle-less playback audio IPC/preload surface, and the reusable Home
  media playback primitive contract. No `docs/current/flow.md` update was needed
  because this slice did not change transaction, lifecycle, rollback, background
  job, or async ordering rules.
- Runtime visual verification used real Electron dev runtime:
  `REMOTE_DEBUGGING_PORT=9233 npm run dev`. CDP viewport was `1200x820`; evidence
  files are
  `artifacts/home-recent-expression-hover-play-runtime.png`,
  `artifacts/home-recent-expression-playing-runtime.png`, and
  `artifacts/home-recent-expression-playback-runtime.json`.
- Runtime evidence confirmed the outer recent-expression icon remains `34x34`
  with `rounded-full`; the playback wrapper background is transparent; the only
  playback background is the centered `28x28` inner `rounded-full` button; hover
  shows play, playing shows pause, pausing while hovered returns to play, and
  pointer-leave after pause hides playback and restores the glyph/scrim state.
- Final verification gate: `npm run verify:quick` passed on 2026-06-09 03:02 PDT:
  typecheck:quick, `test:renderer:quick`, `test:main`, `lint:strict`, and
  `format:check` all completed successfully.

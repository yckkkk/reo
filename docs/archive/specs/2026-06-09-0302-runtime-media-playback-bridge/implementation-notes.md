# Runtime Media Playback Bridge Implementation Notes

## Implemented

- Added `window.reo.media.readPlaybackAudio({ memoryId, segmentId, supplementId?, kind })` to the vendor bridge.
- Routed `media.readPlaybackAudio` through the existing `readExpressionPlaybackAudio` preload read from both work and Widget hosts.
- Returned only `{ audio, mimeType }` to runtime code.
- Added note SegmentSupplement speech support to `resolveExpressionPlaybackAudio`.
- Updated current docs and Reo managed skills so user-owned works/widgets own playback UI, Blob URL lifecycle, errors and state.

## Verification

- RED confirmed before implementation:
  - vendor bridge test failed before `window.reo.media.readPlaybackAudio` existed.
  - renderer bridge test failed before the host route called `readExpressionPlaybackAudio`.
  - main note supplement speech test failed before `readSupplementProjection` / `readNoteSupplementSpeech` support existed.
- Passed:
  - `MAIN_TEST_FILES=test/main/expressionPlaybackAudio.test.ts,test/main/artifactProtocol.test.ts,test/main/workspaceManagedAgentTemplates.test.ts,test/main/workspaceFiles.test.ts npm run test:main`
  - `npx vitest run src/renderer/src/workspace/artifactRuntimeBridge.test.tsx`
  - `npm run typecheck:quick`
  - `REO_E2E_REUSE=1 npx tsx .tmp/runtime-media-playback-e2e.ts`
  - `npm run verify:quick`

## User-Simulation E2E

- Test memory space: `.tmp/runtime-media-playback-e2e/workspace`.
- Source objects:
  - audio Segment `seg_runtime_media_audio_a11d1001` with `audio.webm` bytes
    `[11, 12, 13, 14]`.
  - note Segment `seg_runtime_media_note_b22d2002` with ready `speech.mp3`
    bytes `[21, 22, 23]`.
- Codex CLI created:
  - work Segment
    `memories/mem_runtime_media_e2e--Runtime media sources/segments/seg_runtime_media_work_c0de0001--runtime-media-work`.
  - workspace Widget
    `widgets/wdg_runtime_media_widget_c0de0002--runtime-media-widget`.
- Runtime validation:
  - work `entry.html` loads `reo-render://vendor/reo-render/bridge.js` and
    calls `window.reo.media.readPlaybackAudio({ memoryId:
"mem_runtime_media_e2e", segmentId: "seg_runtime_media_audio_a11d1001",
kind: "audio" })`.
  - Widget `entry.html` loads the same bridge and calls
    `window.reo.media.readPlaybackAudio({ memoryId: "mem_runtime_media_e2e",
segmentId: "seg_runtime_media_note_b22d2002", kind: "note-speech" })`.
  - The E2E script resolved both `reo-render://` entry URLs through the real
    artifact protocol handler, then executed the vendor bridge against
    `createArtifactRuntimeMessageHandler`.
  - Work media returned MIME `audio/webm` and bytes `[11, 12, 13, 14]`.
  - Widget media returned MIME `audio/mpeg` and bytes `[21, 22, 23]`.

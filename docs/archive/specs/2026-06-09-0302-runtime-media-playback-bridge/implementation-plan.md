# Runtime Media Playback Bridge Implementation Plan

> **For agentic workers:** Use focused RED/GREEN tests for the runtime bridge
> contract. Keep the implementation narrow; do not add playback state management.

**Goal:** Expose existing current-workspace audio byte reads to works/widgets via
`window.reo.media.readPlaybackAudio`.

**Architecture:** The iframe vendor bridge adds a `media` group. The renderer
host router validates a tiny payload, injects active workspace identity, calls
the existing `readExpressionPlaybackAudio` preload method, and returns audio
bytes plus MIME. Runtime objects own playback UI and all media behavior.

**Tech Stack:** Electron preload IPC, React renderer runtime bridge, TypeScript,
Vitest, Node test runner.

---

## Files

- Modify `resources/artifact-vendor/reo-render/bridge.js`: add
  `window.reo.media.readPlaybackAudio`.
- Modify `src/renderer/src/workspace/artifactRuntimeBridge.ts`: route
  `media.readPlaybackAudio`.
- Modify `src/main/expressionPlaybackAudio.ts`: add note supplement speech read.
- Modify `src/renderer/src/workspace/MemoryStudio.tsx`: pass
  `readExpressionPlaybackAudio` into the runtime bridge API for works.
- Modify `src/renderer/src/workspace/WorkspaceWidgetPanel.tsx`: pass the same
  read function for widgets.
- Modify managed skills under `src/main/workspace-agent-config/skills/`.
- Update `docs/current/electron.md` and `docs/current/frontend.md` only if the
  final interface matches this spec.

## Tasks

### Task 1: Vendor Bridge Method

- [x] Add a failing test in `test/main/artifactProtocol.test.ts` proving
      `window.reo.media.readPlaybackAudio({ memoryId, segmentId, kind })`
      posts method `media.readPlaybackAudio`.
- [x] Run the focused test and verify RED.
- [x] Add the `media` group to `resources/artifact-vendor/reo-render/bridge.js`.
- [x] Re-run the focused test and verify GREEN.

### Task 2: Host Runtime Router

- [x] Add failing tests in
      `src/renderer/src/workspace/artifactRuntimeBridge.test.tsx` for:
      audio Segment, audio Supplement, note Segment speech, note Supplement
      speech, and invalid `kind`.
- [x] Run the focused renderer test and verify RED.
- [x] Extend `RuntimeApi` with `readExpressionPlaybackAudio`.
- [x] Add `media.readPlaybackAudio` routing in `handleRuntimeRequest`.
- [x] Return only `{ audio, mimeType }`.
- [x] Re-run the focused renderer test and verify GREEN.

### Task 3: Note Supplement Speech Support

- [x] Add a failing main test proving `resolveExpressionPlaybackAudio` can read
      `kind: "note-speech"` with `supplementId`.
- [x] Implement the missing note supplement speech branch by reading the note
      supplement projection and calling the existing note supplement speech
      reader.
- [x] Re-run the focused main test and verify GREEN.

### Task 4: Wire Works And Widgets

- [x] Update `ArtifactPreviewPanel` bridge API to include
      `readExpressionPlaybackAudio`.
- [x] Update `WorkspaceWidgetPanel` bridge API the same way.
- [x] Run focused renderer tests covering artifact runtime bridge and widget
      panel compile path.

### Task 5: Managed Skills And Current Docs

- [x] Update `reo-generative-runtime` and `bridge-api.md` with the minimal API.
- [x] Update `reo-works` and `reo-works-design` with one short usage note.
- [x] Update current docs only for stable interface truth.
- [x] Run `npm run typecheck:quick` and targeted tests.

### Task 6: Final Gate

- [x] Run a user-simulation E2E where Codex CLI creates a real work and Widget
      in a test memory space, then verify both call `readPlaybackAudio`.
- [x] Run `npm run verify:quick`.
- [x] Record verification in this spec.

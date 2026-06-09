# Runtime Media Playback Bridge

创建：2026-06-09 03:02 PDT
状态：completed

## Objective

Give Reo works and workspace rail widgets one minimal runtime method for reading
already-existing playable audio from the current workspace, so user-owned
runtime objects can build their own playback UI.

## Principle

Reo does not manage media product risk, playback UX, queues, transcript panels,
TTS generation, sync state or user-agent choices. Users and their agents own the
runtime app, UI, data shaping, and behavior. Reo only provides the narrow host
capability an iframe cannot implement by itself: reading current-workspace audio
bytes without raw paths, Node, Electron or filesystem access.

## Interface

Add one method to `window.reo`:

```js
const result = await window.reo.media.readPlaybackAudio({
  memoryId,
  segmentId,
  supplementId, // optional
  kind: 'audio', // or "note-speech"
});

const blob = new Blob([result.audio], { type: result.mimeType });
const url = URL.createObjectURL(blob);
audio.src = url;
```

Supported sources:

- `kind: "audio"` reads finalized recording audio for a Segment or
  SegmentSupplement.
- `kind: "note-speech"` reads ready generated speech for a note Segment or note
  SegmentSupplement.

No generation is triggered. Missing, stale or failed speech is a normal error
for the runtime app to handle however it wants.

## Design

- Runtime bridge method: `media.readPlaybackAudio`.
- Host route: `artifactRuntimeBridge.ts` receives the method, requires
  `memoryId`, `segmentId`, optional `supplementId`, and `kind`.
- Renderer implementation calls the existing `readExpressionPlaybackAudio`
  preload method with the active `workspaceId` and a host-generated `requestId`.
- `readExpressionPlaybackAudio` already reads manifest identity in main before
  returning bytes. This slice only adds the missing note SegmentSupplement
  speech branch, so runtime callers do not need to know byte lengths, hashes or
  speech manifest fields.
- The host injects only active `workspaceId` and `requestId`; it does not expose
  raw paths, workspace handles or a generic filesystem bridge.
- The response returns `{ audio, mimeType }` to the iframe. The runtime owns
  `Blob`, `URL.createObjectURL`, `<audio>`, progress, cleanup and UI state.

## Non-goals

- No playback component in Reo for works/widgets.
- No transcript-specific runtime API.
- No TTS request API.
- No queue, playlist, persisted playback state, waveform, scrubber or global
  media manager.
- No cross-workspace registry playback. Runtime objects live in the active
  workspace and read active-workspace objects only.
- No new artifact/widget file contract.

## Docs And Skills

Update only stable surfaces:

- `docs/current/electron.md`: runtime bridge now includes a minimal media read.
- `docs/current/frontend.md`: `window.reo.media.readPlaybackAudio` is available
  to works/widgets; playback UI remains runtime-owned.
- `src/main/workspace-agent-config/skills/reo-generative-runtime/SKILL.md`
  and `references/bridge-api.md`: document the API and that runtime apps own
  playback UI and risk.
- `src/main/workspace-agent-config/skills/reo-works/SKILL.md` and
  `reo-works-design/SKILL.md`: mention that works/widgets may use this bridge
  method when they need playable Reo audio.

## Verification

- Runtime vendor bridge test proves `window.reo.media.readPlaybackAudio(...)`
  posts method `media.readPlaybackAudio`.
- Main tests prove `readExpressionPlaybackAudio` supports note SegmentSupplement
  speech.
- Renderer bridge tests prove the host routes each supported target to the
  existing preload read and rejects invalid input.
- Focused typecheck / renderer tests after implementation.
- User-simulation E2E proves Codex CLI can create a real work and Widget in a
  test memory space, and both can call `window.reo.media.readPlaybackAudio`.
- `npm run verify:quick`.

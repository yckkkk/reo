# Recent Expression Cover Background And Hover Playback

创建：2026-06-08 23:09 PDT
状态：designed

## Objective

Upgrade the Home "近期表达" list-item icon so its background is filled by the
entity's own cover, while the foreground type glyph stays unchanged, and add a
hover-revealed play/pause control that plays a recording's audio or a note's
ready speech (TTS). Define the playback capability as a small, named, reusable
contract + renderer primitive so artifacts and components can adopt the same
control later — without building artifact/component playback now.

近期表达 is treated as the first built-in Home "component". This slice is also
the reference implementation of the reusable playback capability that future
user-designed components will consume.

## Intent Alignment

Confirmed with product owner before design:

- **Note playback source** — a note has no audio body; the only thing it can
  "play" is its TTS speech (`speech.mp3`, on-demand synthesized, status
  `missing`/`ready`/`stale`/`failed`). Decision: show the play control **only
  when speech status is `ready`**. Notes without ready speech get the cover
  background but no play control. No on-demand synthesis from the Home icon.
- **Scope of the playback interface** — artifacts/components are a code runtime
  (run/stop), not audio, and have no real playback consumer today. Decision:
  build **audio playback now** for notes + recordings, and define a clean,
  named, extensible "playable capability" contract + renderer primitive that
  artifacts/components can adopt later. Do **not** implement artifact/component
  playback in this slice (no consumer → no speculative abstraction).
- **Cover background scope** — covers already exist for all three content kinds
  and resolve client-side. Decision: apply the cover-fill background to **all
  three types** (note / audio / artifact); the foreground glyph is unchanged.

## Current Reo Facts (verified)

- Home "近期表达" renders in `WorkspaceStarterHome` (`RecentExpressionRow` +
  `RecentExpressionTypeIcon`). The icon is a 34px squircle with a tone-colored
  badge and a type glyph: `audio` → 7-bar waveform, `artifact` → `AppWindow`,
  `note` → `FileText`.
- The whole row is currently a single `<button>` that opens the expression; the
  icon lives inside it.
- Data flows: main `readRecentExpressionsFromWorkspaceSources` →
  `readRecentExpressionItemsFromFileTruth` (holds each segment/supplement
  manifest + body) → contract `WorkspaceRecentExpressionItem` (already carries
  `cover?`, `segmentId`, `workspaceId`, `memoryId`, `objectType`,
  `supplementId?`, `contentKind`) → `App.mapRecentExpressionToHomeRow` →
  `WorkspaceStarterHomeRecentExpression` (UI shape; currently drops `cover`).
- Cover image source resolves **client-side** via
  `resolveSegmentCoverImageSource({ segment: { cover, segmentId }, workspaceId })`
  (custom → `reo-attachment://…`; default → bundled template PNG). No new IPC
  needed for cover backgrounds.
- Audio fetch IPC already exists for every case — **no new audio IPC needed**:
  - Recording segment audio: `readFinalizedAudioSegmentAudio`
  - Recording supplement audio: `readFinalizedAudioSegmentSupplementAudio`
  - Note speech audio: `readSegmentSpeechAudio`
  - Note speech supplement audio: `readSegmentSupplementSpeechAudio`
- Note speech readiness is derivable in main during the recent-expression read
  via the existing `readNoteSpeechSynthesisProjectionFromManifest` (compares note
  content hash to the synthesized manifest hash and checks the audio file). The
  recent-expression read already holds `fileTruth.metadata.speechSynthesis` and
  the note body.
- Existing renderer audio playback (`useMemoryStudioAudioPlayback`,
  `RecordingOverlay` draft playback) uses native `<audio>` + `URL.createObjectURL`
  on a fetched blob. The new primitive follows the same pattern but is a small,
  focused, single-active controller — it does not reuse the MemoryStudio hook.

## Interaction Model (minimal math model)

**Entity:** each row's 34px icon is a `tile` with four stacked layers
(bottom → top):

1. `cover` — cover image fill (`object-cover`)
2. `scrim` — darkening overlay (fades in on hover / active)
3. `glyph` — foreground type glyph (waveform / FileText / AppWindow) — unchanged
4. `control` — ▶ / ⏸ / spinner overlay

**Source variables (per row):**

- `playable ∈ {true,false}` — recording: always `true`; note: `true` iff speech
  status `ready`; artifact: `false` (this slice).
- `hovered` — pointer over the tile.
- `playState ∈ {idle, loading, playing, paused}` — from a **single-active global
  playback controller**: at most one row is `active` (controller.activeRef === row).

**Derived presentation (only meaningful when `playable`):**

| Condition | scrim | glyph | control |
|---|---|---|---|
| idle, not hovered | hidden | shown | none |
| idle, hovered | shown | hidden | ▶ |
| loading | shown | hidden | spinner |
| playing (active) | shown | hidden | ⏸ (stays ⏸ even when hover leaves) |
| paused (active) | shown | hidden | ▶ |

**Invariants:**

1. An `active` row (controller.activeRef === row, i.e. `playState ≠ idle` —
   loading, playing, or paused) shows the control regardless of `hovered`; a
   non-active row shows ▶ only while `hovered`.
2. Starting playback on row B stops row A — one `<audio>` element + one
   `activeRef`. Single-active is a hard invariant.
3. Playback `ended` → clear `activeRef` → row returns to `idle`.
4. `playable=false` rows have no control overlay; they keep the cover + glyph and
   the existing row background hover only.

**Transitions:** `scrim`/`glyph`/`control` cross-fade with the existing
`~150ms ease-out` used by row hover. No new animation curve, no per-frame state.

## Contract / Data Changes

Add a named, reusable playback capability to `workspace-contract`:

```ts
// kind discriminates the audio source; durationMs optional (informational)
WorkspacePlaybackSource = { kind: 'audio' | 'note-speech'; durationMs?: number }
```

- Add `playback?: WorkspacePlaybackSource` to `workspaceRecentExpressionBaseSchema`
  (present only when actually playable):
  - audio segment/supplement → `{ kind: 'audio', durationMs }`
  - note segment with speech status `ready` → `{ kind: 'note-speech' }`
  - otherwise field absent.
- This named type is the documented extension point: artifact/component
  projections **may** embed the same `WorkspacePlaybackSource` later. Only the
  recent-expression item embeds it now (single current consumer — not speculative).

## Main Process Changes

- In `readRecentExpressionItemsFromFileTruth`, compute `playback` for each emitted
  item:
  - audio segment → `{ kind: 'audio', durationMs: metadata.durationMs }`.
  - audio supplement → `{ kind: 'audio', durationMs }` from the supplement manifest.
  - note segment → reuse `readNoteSpeechSynthesisProjectionFromManifest`; emit
    `{ kind: 'note-speech' }` only when status === `ready`, else omit.
  - artifact → omit.
- No new IPC channels; no change to playback data truth.

## Renderer: Reusable Primitive + Home Integration

New reusable primitives under `components/ui/` (kebab-case file, PascalCase
export, colocated test):

- `useMediaPlaybackController(loadSource)` — owns a single `<audio>` element,
  `activeRef`, and `playState`. Exposes `toggle(ref)` and `stop()`.
  `loadSource(ref)` fetches the right blob via the existing IPC and returns an
  object URL + mime type:
  - `{ kind:'audio', objectType:'segment' }` → `readFinalizedAudioSegmentAudio`
  - `{ kind:'audio', objectType:'supplement' }` → `readFinalizedAudioSegmentSupplementAudio`
  - `{ kind:'note-speech', objectType:'segment' }` → `readSegmentSpeechAudio`
  - `{ kind:'note-speech', objectType:'supplement' }` → `readSegmentSupplementSpeechAudio`
  Object URLs are revoked on switch/unmount.
- `MediaPlaybackControl` — pure presentational; renders ▶ / ⏸ / spinner + scrim
  from `{ playable, hovered, playState }`.

Wiring:

- The controller is instantiated at the App layer (where the workspace handle and
  the audio-fetch callbacks live). `WorkspaceStarterHome` stays a presentational
  component: it receives, per row, the `playback` descriptor, the active row's
  `playState`, and an `onTogglePlayback(ref)` callback, plus the resolved
  `coverImageSrc`.
- `mapRecentExpressionToHomeRow` is extended to also project `coverImageSrc`
  (via `resolveSegmentCoverImageSource`) and the playback ref/descriptor.

## Row Structure Fix (required)

The current row is one `<button>` wrapping the icon. A nested play/pause button
is invalid HTML and conflicts on click. Restructure:

- Row container becomes a `div` (not a button).
- The title/preview region is the "open" affordance (a `button` calling
  `onOpenRecentExpression`).
- The icon region's play/pause is a separate `button` that `stopPropagation`s and
  calls `onTogglePlayback`.
- Cover background fills the tile for all three types; `playable=false` rows show
  cover + glyph with no control.

Keep keyboard accessibility: open button is focusable/labeled; play button is a
real labeled button (aria-label reflects play/pause state).

## Scope Boundaries

**In scope:** cover-fill background (all three types), hover play/pause for
recordings + ready-speech notes, single-active controller, the named
`WorkspacePlaybackSource` contract + renderer primitive, the row-structure fix.

**Out of scope:** artifact/component playback implementation, on-demand TTS
synthesis from Home, waveform/progress scrubber, any new audio IPC, any change to
playback data truth.

## Verification Plan

- Main `playback` derivation — unit tests: audio segment → `audio`; note ready →
  `note-speech`; note missing/stale/failed → absent; artifact → absent;
  audio supplement → `audio`.
- Renderer state machine — component tests covering the 5 presentation rows of the
  model table, the single-active switch (starting B stops A), `ended` → idle, and
  `playable=false` → no control.
- `loadSource` routing — test each `(kind, objectType)` maps to the correct IPC.
- Closeout — real Electron runtime visual verification: cover backgrounds render
  for note/audio/artifact rows; recording playback and note-speech playback work;
  hover/active states match the model. Screenshots + behavior evidence recorded in
  this spec folder.

## Current Reo Doc Contracts To Re-check Before Coding

- `docs/current/data.md` — adding `WorkspacePlaybackSource` to the recent-expression
  contract (a stable interface change) may warrant a one-line note.
- `docs/current/electron.md` — confirm no IPC/preload surface change (expected: none).
- `docs/current/frontend.md` — a new reusable `components/ui` primitive
  (`MediaPlaybackControl` / `useMediaPlaybackController`) is a reusable-component
  surface; re-check whether a stable note is warranted.

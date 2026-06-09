# Recent Expression Cover Background And Hover Playback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement task-by-task. Steps use
> checkbox (`- [ ]`) syntax. Apply superpowers:test-driven-development for every
> behavior change; the TDD red lines in `.claude/CLAUDE.md` decide where real RED→GREEN
> is mandatory vs. a lighter targeted check.

**Goal:** Fill each Home 近期表达 icon with the entity's own cover, keep the
foreground glyph, and add a hover-revealed play/pause control that plays a
recording's audio or a note's ready speech — with a reusable
`WorkspacePlaybackSource` descriptor, one new handle-less playback-read IPC, and a
reusable renderer playback primitive that artifacts/components can adopt later.

**Architecture:** Main derives a `playback` descriptor per recent-expression item
(recording always; note only when speech `ready`). A new registry-resolved,
handle-less IPC `workspace:readExpressionPlaybackAudio` reuses the existing
root-based byte readers so playback works cross-workspace without opening a handle.
Renderer adds `MediaPlaybackControl` + `useMediaPlaybackController` (single-active
`<audio>`); `WorkspaceStarterHome` consumes them and renders the 4-layer icon
(cover / scrim / glyph / control) per the spec state model.

**Tech Stack:** TypeScript, Zod (workspace-contract), Electron IPC + preload,
React + Tailwind + shadcn, Vitest + Testing Library.

**Spec:** `docs/specs/2026-06-08-2309-recent-expression-cover-playback/README.md`

---

## Conventions For This Plan

- After **each phase**, run the phase-gate before advancing: `/review` then
  `/simplify` on the phase diff; fix findings; only then start the next phase.
  (See `[[phase-gate-review-simplify]]`.)
- Keep a running `implementation-notes.md` in this spec folder; append one entry
  per task with what changed, test evidence, and any deviation. (See
  `[[implementation-notes-file]]`.)
- Targeted checks during a phase; run `npm run verify:quick` only at closeout.
- Reuse existing patterns: copy the shape of a sibling schema / query / handler
  rather than inventing one. Exact anchors are given per task.

---

## File Structure

| File                                                                 | Responsibility                                      | Change                                                                                        |
| -------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/workspace-contract/workspace-contract.ts`                       | shared schemas/types                                | add `WorkspacePlaybackSource`, `playback` on recent-expr item, playback-read request/response |
| `src/workspace-contract/workspace-channels.ts`                       | channel constants                                   | add `WORKSPACE_READ_EXPRESSION_PLAYBACK_AUDIO_CHANNEL`                                        |
| `src/main/recentExpressionPlayback.ts` (new)                         | derive playback descriptor + resolve playback bytes | new helpers, unit-tested                                                                      |
| `src/main/memoryFiles.ts`                                            | recent-expr file-truth read                         | populate `playback` on emitted items                                                          |
| `src/main/workspaceIpc.ts`                                           | IPC handlers                                        | add `handleReadExpressionPlaybackAudio` + register channel                                    |
| `src/preload/workspaceBridge.ts`                                     | preload bridge                                      | add `readExpressionPlaybackAudio` method                                                      |
| `src/renderer/src/types/reoWorkspace.d.ts`                           | renderer bridge typing                              | add method signature                                                                          |
| `src/renderer/src/components/ui/media-playback-control.tsx` (new)    | presentational ▶/⏸/spinner + scrim                  | new, tested                                                                                   |
| `src/renderer/src/components/ui/useMediaPlaybackController.ts` (new) | single-active `<audio>` controller                  | new, tested                                                                                   |
| `src/renderer/src/workspace/WorkspaceStarterHome.tsx`                | Home recent list UI                                 | cover background, row restructure, consume controller                                         |
| `src/renderer/src/App.tsx`                                           | map contract → home row                             | project `coverImageSrc` + `playback` ref                                                      |

---

## Phase 1 — Contract + Channel (types only, no behavior)

### Task 1.1: `WorkspacePlaybackSource` schema + `playback` on recent-expr item

**Files:**

- Modify: `src/workspace-contract/workspace-contract.ts`
- Test: `src/workspace-contract/workspace-contract.test.ts` (or the existing nearest contract test; match where recent-expression schemas are tested)

- [ ] **Step 1: Write failing tests**

Assert the new schema and field:

- `workspacePlaybackSourceSchema.parse({ kind: 'audio', durationMs: 1200 })` → ok.
- `workspacePlaybackSourceSchema.parse({ kind: 'note-speech' })` → ok.
- `workspacePlaybackSourceSchema.safeParse({ kind: 'artifact' })` → `success === false`.
- `workspaceRecentExpressionItemSchema.parse(<valid segment item with playback omitted>)` → ok.
- `workspaceRecentExpressionItemSchema.parse(<valid segment item with playback:{kind:'audio',durationMs:10}>)` → ok and `.playback?.kind === 'audio'`.

- [ ] **Step 2: Run to verify RED** — `npx vitest run src/workspace-contract` → fails (schema undefined).

- [ ] **Step 3: Implement**

Add near `workspaceCoverProjectionSchema` (around line 114):

```ts
export const workspacePlaybackSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('audio'),
    durationMs: z.number().int().nonnegative().optional(),
  }),
  z.strictObject({
    kind: z.literal('note-speech'),
    durationMs: z.number().int().nonnegative().optional(),
  }),
]);
```

Add `playback: workspacePlaybackSourceSchema.optional(),` to
`workspaceRecentExpressionBaseSchema` (line ~938, beside `cover`).

Export the type beside `WorkspaceRecentExpressionItem` (line ~2637):
`export type WorkspacePlaybackSource = z.infer<typeof workspacePlaybackSourceSchema>;`

- [ ] **Step 4: Run to verify GREEN** — `npx vitest run src/workspace-contract` → pass.

- [ ] **Step 5: Commit** — `feat(contract): add WorkspacePlaybackSource + recent-expression playback field`.

### Task 1.2: Playback-read IPC request/response schemas + channel

**Files:**

- Modify: `src/workspace-contract/workspace-channels.ts`
- Modify: `src/workspace-contract/workspace-contract.ts`
- Test: same contract test file

- [ ] **Step 1: Write failing tests**
- Request schema rejects unknown `kind` and missing `requestId`; accepts a
  segment shape (no `supplementId`) and a supplement shape (`supplementId` present).
- Response schema (`ok:true`) requires `audio` (Uint8Array/`z.instanceof(Uint8Array)`
  — match how existing audio responses type `audio`; see
  `workspaceReadFinalizedAudioSegmentAudioResponseSchema`) and `mimeType`.

- [ ] **Step 2: Run RED** — fails (schemas/channel undefined).

- [ ] **Step 3: Implement**
- In `workspace-channels.ts`, add beside the other audio channels (line ~40):
  `export const WORKSPACE_READ_EXPRESSION_PLAYBACK_AUDIO_CHANNEL = 'workspace:readExpressionPlaybackAudio' as const;`
  and include it in the channel registry array near line ~216.
- In `workspace-contract.ts`, define
  `workspaceReadExpressionPlaybackAudioRequestSchema` (strictObject:
  `workspaceId`, `memoryId: memoryIdSchema`, `segmentId: segmentIdSchema`,
  `supplementId: supplementIdSchema.optional()`, `kind: z.enum(['audio','note-speech'])`,
  `requestId: z.string().min(1)`) and
  `workspaceReadExpressionPlaybackAudioResponseSchema` (discriminatedUnion `ok`;
  success value echoes ids + `kind`, plus `audio` and `mimeType: z.string().min(1)`).
  Model both on the existing `…ReadFinalizedAudioSegmentAudio…` schemas. Export the
  inferred request/response types.

- [ ] **Step 4: Run GREEN** — pass.
- [ ] **Step 5: Commit** — `feat(contract): add readExpressionPlaybackAudio channel + schemas`.

### Phase 1 gate

- [ ] `npx tsc --noEmit` (or repo typecheck script) passes.
- [ ] Run `/review` then `/simplify` on the Phase 1 diff; address findings.
- [ ] Append `implementation-notes.md` entry.

---

## Phase 2 — Main playback descriptor derivation

### Task 2.1: `recentExpressionSegmentPlayback` / `…SupplementPlayback` helpers

**Files:**

- Create: `src/main/recentExpressionPlayback.ts`
- Test: `src/main/recentExpressionPlayback.test.ts`

- [ ] **Step 1: Write failing tests** — table-drive the helper:
- audio segment metadata `{ kind:'audio', durationMs: 4200, … }` →
  `{ kind:'audio', durationMs: 4200 }`.
- artifact segment metadata → `undefined`.
- note segment whose speech projection resolves `ready` → `{ kind:'note-speech' }`.
- note segment whose speech projection resolves `missing`/`stale`/`failed` → `undefined`.
  (Inject the speech-status resolver so the test does not touch the filesystem —
  the helper takes a `readSpeechStatus` dependency defaulting to
  `readNoteSpeechSynthesisProjectionFromManifest`.)
- audio supplement projection `{ type:'audio', durationMs: 800, … }` →
  `{ kind:'audio', durationMs: 800 }`; note/artifact supplement → `undefined`.

- [ ] **Step 2: Run RED** — `npx vitest run src/main/recentExpressionPlayback` → fails.

- [ ] **Step 3: Implement** — export two pure-ish functions:

```ts
// segment: switch on metadata.kind (FinalizedSegmentSemanticTruth narrows by kind)
//  - 'audio'   -> { kind: 'audio', durationMs: metadata.durationMs }
//  - 'note'    -> ready ? { kind: 'note-speech' } : undefined
//               (ready via readNoteSpeechSynthesisProjectionFromManifest using
//                noteContentHash(metadata.markdownContent), objectDirectory)
//  - 'artifact'-> undefined
// supplement: supplement.type === 'audio'
//  ? { kind: 'audio', durationMs: supplement.durationMs } : undefined
```

Keep the speech-status read injectable for tests; default to the real reader from
`./noteSpeechSynthesisProjection.js`.

- [ ] **Step 4: Run GREEN** — pass.
- [ ] **Step 5: Commit** — `feat(main): derive recent-expression playback descriptor`.

### Task 2.2: Populate `playback` in `readRecentExpressionItemsFromFileTruth`

**Files:**

- Modify: `src/main/memoryFiles.ts` (`readRecentExpressionItemsFromFileTruth`, ~2841–2972; segment push ~2916, supplement push ~2940)
- Test: extend the existing recent-expressions main test (locate via
  `rg "readRecentExpressionItemsFromFileTruth|readRecentExpressionsFromWorkspaceSources" -l src`); if a file-truth fixture test exists, add cases there.

- [ ] **Step 1: Write failing test** — using the existing recent-expressions
      fixture harness, assert that a finalized **audio** segment yields an item with
      `playback: { kind:'audio', durationMs }`, a finalized **artifact** yields no
      `playback`, and a **note** with synthesized ready speech yields
      `playback: { kind:'note-speech' }` while a note without speech yields none.

- [ ] **Step 2: Run RED** — fails (no `playback` on items).

- [ ] **Step 3: Implement** — call `recentExpressionSegmentPlayback({ metadata:
fileTruth.metadata, objectDirectory: fileTruth.recordingDirectory })` and spread
      `...(playback ? { playback } : {})` into the segment item; call
      `recentExpressionSupplementPlayback(supplement)` and spread into the supplement
      item. `RecentExpressionItemFromFileTruth` already extends
      `WorkspaceRecentExpressionItem`, which now carries `playback?`, so no type change.

- [ ] **Step 4: Run GREEN** — pass.
- [ ] **Step 5: Commit** — `feat(main): attach playback descriptor to recent expressions`.

### Phase 2 gate

- [ ] Targeted: `npx vitest run src/main/recentExpressionPlayback src/main/<recent-expr test>`.
- [ ] `/review` + `/simplify` on Phase 2 diff; fix findings.
- [ ] `implementation-notes.md` entry.

---

## Phase 3 — New handle-less playback-read IPC

### Task 3.1: `resolveExpressionPlaybackAudio` (root resolution + reader dispatch)

**Files:**

- Modify: `src/main/recentExpressionPlayback.ts` (or a sibling `expressionPlaybackAudio.ts` if it keeps files focused)
- Test: `src/main/recentExpressionPlayback.test.ts`

- [ ] **Step 1: Write failing tests** — with injected dependencies
      (`resolveRootPath`, `readSegmentAudio`, `readSupplementAudio`, `readNoteSpeech`):
- `kind:'audio'`, no `supplementId` → calls `readSegmentAudio({ rootPath, memoryId,
segmentId, … })`, returns `{ audio, mimeType: 'audio/webm' }`.
- `kind:'audio'`, with `supplementId` → calls `readSupplementAudio(...)`.
- `kind:'note-speech'`, segment → calls `readNoteSpeech(...)`, `mimeType: 'audio/mpeg'`.
- root resolver returns null → returns a `ERR_WORKSPACE_MEMORY_SPACE_NOT_FOUND`
  workspace error (no reader called).
- reader returns `ok:false` → error is propagated unchanged.

- [ ] **Step 2: Run RED** — fails.

- [ ] **Step 3: Implement** — resolve identity (audioByteLength/hash or speech
      byteLength) by reading the manifest, then dispatch to the existing root-based
      readers: `readFinalizedAudioSegmentAudio` / `readFinalizedAudioSegmentSupplementAudio`
      (recordingDrafts.ts), `readNoteSpeechAudio` (noteDrafts.ts). Return
      `{ ok:true, audio, mimeType }` or the reader's error.

- [ ] **Step 4: Run GREEN** — pass.
- [ ] **Step 5: Commit** — `feat(main): resolve expression playback audio by registry root`.

### Task 3.2: IPC handler + channel registration

**Files:**

- Modify: `src/main/workspaceIpc.ts` (add `handleReadExpressionPlaybackAudioCore`
  modeled on `handleReadRecentExpressionsCore` ~1299 for root resolution +
  trust/session envelope; register near the other audio handlers ~9718)
- Test: extend the workspace IPC test that covers recent expressions / audio reads.

- [ ] **Step 1: Write failing test** — given a fixture registry with one memory
      space + system draft, invoking the handler with a valid audio segment request
      returns `ok:true` with bytes and `mimeType`; an unknown `workspaceId` returns the
      not-found error; `workspaceId === SYSTEM_DRAFT_WORKSPACE_ID` resolves the ensured
      draft root.

- [ ] **Step 2: Run RED** — fails (handler/channel absent).

- [ ] **Step 3: Implement** — parse via the request schema, run the same trust/
      session guard the recent-expressions handler uses, resolve `rootPath` (system
      draft vs `memorySpaceRegistry.resolveMemorySpace`), call
      `resolveExpressionPlaybackAudio`, return the parsed response schema. Register the
      channel with `registerWorkspaceIpcHandler(WORKSPACE_READ_EXPRESSION_PLAYBACK_AUDIO_CHANNEL, …)`.

- [ ] **Step 4: Run GREEN** — pass.
- [ ] **Step 5: Commit** — `feat(main): add readExpressionPlaybackAudio IPC handler`.

### Task 3.3: Preload bridge method + renderer typing

**Files:**

- Modify: `src/preload/workspaceBridge.ts` (import channel; add
  `readExpressionPlaybackAudio: (payload) => invoke<…>(WORKSPACE_READ_EXPRESSION_PLAYBACK_AUDIO_CHANNEL, payload)` beside `readFinalizedAudioSegmentAudio` ~380)
- Modify: `src/renderer/src/types/reoWorkspace.d.ts` (add the method signature using the contract request/response types)
- Test: the preload bridge exposure test (match the existing one that asserts each method maps to its channel)

- [ ] **Step 1: Write failing test** — assert `bridge.readExpressionPlaybackAudio`
      invokes `WORKSPACE_READ_EXPRESSION_PLAYBACK_AUDIO_CHANNEL` with the payload.
- [ ] **Step 2: Run RED** — fails.
- [ ] **Step 3: Implement** — add the method + channel to the registry list used by
      the bridge; add the d.ts signature.
- [ ] **Step 4: Run GREEN** — pass.
- [ ] **Step 5: Commit** — `feat(preload): expose readExpressionPlaybackAudio`.

### Phase 3 gate

- [ ] Targeted: IPC + preload tests; `tsc --noEmit`.
- [ ] Re-check `docs/current/electron.md` per spec; add a stable note only if warranted.
- [ ] `/review` + `/simplify`; fix findings.
- [ ] `implementation-notes.md` entry.

---

## Phase 4 — Renderer playback primitives (`components/ui`)

### Task 4.1: `MediaPlaybackControl` (presentational)

**Files:**

- Create: `src/renderer/src/components/ui/media-playback-control.tsx`
- Test: `src/renderer/src/components/ui/media-playback-control.test.tsx`

- [ ] **Step 1: Write failing tests** — props `{ playable, hovered, playState,
onToggle, label }`. Assert the spec table:
  - `playable:false` → renders nothing interactive (no control button).
  - `playable, !hovered, idle` → no control (parent shows glyph).
  - `playable, hovered, idle` → ▶ button present (aria-label 播放).
  - `playState:'loading'` → spinner, control disabled.
  - `playState:'playing'` → ⏸ button (aria-label 暂停) present **even when `hovered:false`**.
  - `playState:'paused'` → ▶ button present.
  - clicking the button calls `onToggle`.

- [ ] **Step 2: Run RED** — fails.
- [ ] **Step 3: Implement** — pure component; derive visibility from the table.
      Render scrim + ▶/⏸/spinner with tokenized classes (no raw colors — see
      `[[colors-must-be-tokens]]`); `~150ms ease-out` transitions matching the row.
- [ ] **Step 4: Run GREEN** — pass.
- [ ] **Step 5: Commit** — `feat(ui): add MediaPlaybackControl`.

### Task 4.2: `useMediaPlaybackController` (single-active `<audio>`)

**Files:**

- Create: `src/renderer/src/components/ui/useMediaPlaybackController.ts`
- Test: `src/renderer/src/components/ui/useMediaPlaybackController.test.tsx`

- [ ] **Step 1: Write failing tests** (mock `loadSource` + the `<audio>` element via
      a ref injected into the hook, or assert through a tiny harness component):
  - initial: `activeId === null`, `playState === 'idle'`.
  - `toggle('A')` → `loadSource('A')` called once → `playState` transitions
    `loading` → `playing`; `activeId === 'A'`.
  - `toggle('A')` while playing → `paused`; `toggle('A')` again → `playing` (no
    second `loadSource` — same loaded ref reused).
  - `toggle('B')` while A playing → A stops, `loadSource('B')` called, `activeId === 'B'`.
  - audio `ended` event → `activeId === null`, `playState === 'idle'`.
  - object URL of the previous ref is revoked on switch/unmount.

- [ ] **Step 2: Run RED** — fails.
- [ ] **Step 3: Implement** — one `<audio>` (or `Audio()` instance held in a ref),
      `activeId`, `playState`; `toggle(id)` implements the transitions above; revoke the
      cached object URL on switch/unmount. Returns `{ activeId, playState, toggle, stop }`.
- [ ] **Step 4: Run GREEN** — pass.
- [ ] **Step 5: Commit** — `feat(ui): add useMediaPlaybackController`.

### Phase 4 gate

- [ ] Targeted: `npx vitest run src/renderer/src/components/ui/media-playback-control src/renderer/src/components/ui/useMediaPlaybackController`.
- [ ] Re-check `docs/current/frontend.md`; add a stable note for the new primitive only if warranted.
- [ ] `/review` + `/simplify`; fix findings.
- [ ] `implementation-notes.md` entry.

---

## Phase 5 — Home integration + App map

### Task 5.1: Extend home row type + map projection

**Files:**

- Modify: `src/renderer/src/workspace/WorkspaceStarterHome.tsx`
  (`WorkspaceStarterHomeRecentExpression`)
- Modify: `src/renderer/src/App.tsx` (`mapRecentExpressionToHomeRow` ~294)
- Test: extend the existing App map test (locate via `rg "mapRecentExpressionToHomeRow" src/renderer`)

- [ ] **Step 1: Write failing test** — `mapRecentExpressionToHomeRow(item)` projects
      `coverImageSrc` (via `resolveSegmentCoverImageSource({ segment: { cover: item.cover,
segmentId: item.segmentId }, workspaceId: item.workspaceId })`) and, when
      `item.playback` exists, a `playback: { kind, ref: { workspaceId, memoryId,
segmentId, supplementId? } }`; when absent, no `playback`.

- [ ] **Step 2: Run RED** — fails.
- [ ] **Step 3: Implement** — extend the row type:

```ts
export type WorkspaceStarterHomeRecentExpression = {
  readonly id: string;
  readonly preview: string;
  readonly time: string;
  readonly title: string;
  readonly type: RecentExpressionType;
  readonly coverImageSrc: string;
  readonly playback?: {
    readonly kind: 'audio' | 'note-speech';
    readonly ref: {
      readonly workspaceId: string;
      readonly memoryId: string;
      readonly segmentId: string;
      readonly supplementId?: string;
    };
  };
};
```

Populate it in `mapRecentExpressionToHomeRow`.

- [ ] **Step 4: Run GREEN** — pass.
- [ ] **Step 5: Commit** — `feat(home): project cover + playback ref onto recent rows`.

### Task 5.2: Cover background + row restructure + control wiring

**Files:**

- Modify: `src/renderer/src/workspace/WorkspaceStarterHome.tsx`
  (`RecentExpressionTypeIcon` ~144, `RecentExpressionRow` ~182, list render)
- Test: `src/renderer/src/workspace/WorkspaceStarterHome.test.tsx` (extend if present, else create)

- [ ] **Step 1: Write failing tests**
- Every row icon renders the cover `<img>` with `src === row.coverImageSrc` and the
  foreground glyph for its `type` (waveform/FileText/AppWindow).
- A row with `playback` shows the play control on hover; clicking it does **not**
  trigger the row "open" handler (no `onOpenRecentExpression` call) and does call
  the controller toggle.
- A row without `playback` shows no control on hover; clicking the row body calls
  `onOpenRecentExpression`.
- The active (playing) row shows ⏸ even after pointer-leave.

- [ ] **Step 2: Run RED** — fails.
- [ ] **Step 3: Implement**
- Instantiate `useMediaPlaybackController(loadSource)` inside `WorkspaceStarterHome`,
  where `loadSource(id)` maps the row id → its `playback.ref` →
  `window.reoWorkspace.readExpressionPlaybackAudio({ …ref, kind, requestId })`,
  validates the echoed `requestId`, and returns a Blob object URL of `mimeType`.
- Replace the single row `<button>` with a `div` row containing (a) an "open"
  `button` over title/preview/time calling `onOpenRecentExpression`, and (b) the
  icon region: a 4-layer tile (cover `<img>`, scrim, glyph, `MediaPlaybackControl`).
  The play button `stopPropagation`s. No nested buttons.
- Track `hovered` per icon (pointer enter/leave on the tile). Pass
  `playState` for the active row + `hovered` to `MediaPlaybackControl`.
- Keep the squircle, sizing, and tokens; glyph cross-fades with the control.

- [ ] **Step 4: Run GREEN** — pass.
- [ ] **Step 5: Commit** — `feat(home): cover-fill icons with hover play/pause`.

### Phase 5 gate

- [ ] Targeted: `npx vitest run src/renderer/src/workspace/WorkspaceStarterHome src/renderer/src/App` (map test).
- [ ] `/review` + `/simplify`; fix findings.
- [ ] `implementation-notes.md` entry.

---

## Phase 6 — Closeout

- [ ] Re-check `docs/current/data.md`, `electron.md`, `frontend.md`; compress only
      stable conclusions per the doc red lines (interface change to recent-expression
      contract; new IPC/preload surface; new reusable primitive).
- [ ] Real Electron runtime visual verification (`/run` or dev app):
  - cover backgrounds render for note / audio / artifact rows;
  - hover a recording → ▶ → click plays → ⏸ → pointer-leave stays ⏸ → click pauses;
  - hover a ready-speech note → plays speech; a note without ready speech shows no control;
  - starting a second item stops the first; playback end returns to idle.
    Capture screenshots + a short interaction note into this spec folder.
- [ ] `npm run verify:quick` once; record evidence in `implementation-notes.md`.
- [ ] superpowers:finishing-a-development-branch to decide merge/PR.

---

## Spec Coverage Check

- Cover background (all three types) → Tasks 5.1, 5.2.
- Hover play/pause, recordings + ready-speech notes → Tasks 4.1, 4.2, 5.2; readiness in 2.1/2.2.
- Single-active invariant + ended→idle → Task 4.2.
- `playable=false` → no control → Tasks 4.1, 5.2.
- `WorkspacePlaybackSource` descriptor → Tasks 1.1, 2.1, 2.2.
- New handle-less playback-read IPC → Tasks 1.2, 3.1, 3.2, 3.3.
- Row-structure fix (no nested buttons) → Task 5.2.
- Verification (main unit, renderer state machine, loadSource routing, runtime) →
  Tasks 2.1/2.2, 3.x, 4.x, 5.x, Phase 6.
- Out of scope (artifact/component playback, on-demand TTS, scrubber) → not planned.

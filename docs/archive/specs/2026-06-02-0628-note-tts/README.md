# Note Text To Speech

Timezone: America/Los_Angeles

## Objective

Add text-to-speech for finalized note Segments and note SegmentSupplements, using the same main-owned Volcengine X-Api-Key voice setting that already powers Doubao speech recognition and recording transcription.

## Status

Implemented in current working tree. Focused main/renderer verification, real-key provider E2E, runtime UI layout verification, review/simplification fixes, and final `npm run verify:quick` have passed.

## Implementation Summary

- Added explicit note speech synthesis IPC/preload/renderer bridge methods for finalized note Segment and note SegmentSupplement targets.
- Added main-owned Doubao TTS V3 client using the existing X-Api-Key, `seed-tts-2.0`, `seed-tts-2.0-expressive`, MP3 24000 Hz, and fixed speaker ids.
- Added durable note speech payload support: generated `speech.mp3` plus manifest `speechSynthesis` projection on note Segment and note SegmentSupplement content reads.
- Added split ASR/TTS voice validation state, fixed TTS speaker selector, and short TTS probe on key save / speaker change.
- Added voice settings startup normalization so a legacy v1 settings file or an earlier dev v2 file with obsolete speaker ids keeps its encrypted X-Api-Key and ASR validation state instead of falling back to an empty settings file.
- Added long note speech support by splitting cleaned note text into short synchronous TTS requests and saving the merged MP3 as one durable `speech.mp3`.
- Added manual and automatic note speech synthesis runtime with serial queue, duplicate target protection, capped-wave automatic draining, workspace-close cancellation, recording pause/resume, ready/settings trigger, and clean note-save trigger.
- Added Memory Studio note speech playback rows, Segment/Supplement and primary-tab menu actions, per-request speaker selection, settings batch regeneration, and App-level manual running state.
- Split note speech metadata from MP3 bytes: note content reads return speech projection only, while players lazy-load bounded speech audio bytes through dedicated query/IPC and a short-lived audio-byte cache.
- Fixed workspace/segment switching performance regressions by preserving content/detail projection cache, using short GC only for speech audio bytes, and avoiding requestId-based Blob/waveform cache misses.
- Serialized note speech success/failed writes with finalized note body saves so empty-note speech cleanup cannot be overwritten by an in-flight older TTS result.
- Updated `docs/current/electron.md`, `docs/current/data.md`, `docs/current/flow.md`, and `docs/current/frontend.md` with the stable contracts.

## Official Docs Checked

- Context7 library: `/websites/volcengine_6561`.
- Volcengine TTS V3 HTTP Chunked/SSE docs: `https://www.volcengine.com/docs/6561/1598757?lang=zh`.
- Volcengine async long-text docs: `https://www.volcengine.com/docs/6561/1829010?lang=zh`.

Adopted API basis:

- Use V3 HTTP Chunked/SSE with `X-Api-Key` and `X-Api-Resource-Id: seed-tts-2.0`.
- Use MP3 output at 24000 Hz.
- Use `seed-tts-2.0-expressive`.
- Use fixed official O2.0 speaker choices:
  - `zh_female_vv_uranus_bigtts` (`Vivi`, default)
  - `zh_female_xiaohe_uranus_bigtts` (`小荷`)
  - `zh_male_m191_uranus_bigtts` (`云舟`)
  - `zh_male_shaonianzixin_uranus_bigtts` (`少年梓辛`)

Live provider probe result:

- `seed-tts-2.0` rejects the initially considered `jupiter` speaker ids as resource/speaker mismatches.
- The `uranus` speaker ids listed above returned successful MP3 synthesis with the same X-Api-Key credential shape used by ASR.

Rejected for this slice:

- Async long text. Current official async long-text docs found during alignment require `X-Api-App-Id` and `X-Api-Access-Key`, which conflicts with the user requirement that this feature use the same X-Api-Key. Do not add legacy credentials in this slice.

## Aligned Decisions

- Generated speech is durable content owned by the note node, not a new Segment or SegmentSupplement.
- Note Segment speech player appears under the horizontal Segment strip and above the content tab rail, replacing the current note player placeholder.
- Note SegmentSupplement speech player appears in the supplement panel in the same position and visual model as the supplement recording player.
- Generated MP3 is saved in the note or note supplement directory as Reo-managed `speech.mp3`.
- Speech technical state is recorded in the corresponding Segment or SegmentSupplement manifest.
- TTS source is the saved file-truth note body, not unsaved renderer editor text.
- Dirty, pending-save, or conflict editor states disable generation.
- Markdown is converted to readable plain text from parsed rich content/text content. Do not send frontmatter, Markdown syntax, link URLs, or image paths as speech text.
- Empty body removes speech payload and speech state.
- Long note text is split into short provider requests and saved as one generated MP3, so existing long note bodies are eligible for manual and automatic generation without adding App ID / Access Key credentials.
- Automatic TTS is enabled by the same voice master switch as speech recognition/transcription.
- Voice settings keep one X-Api-Key, but validation status is split by capability: ASR can stay usable even if TTS validation fails.
- Saving the key runs the existing ASR probe and a short TTS probe; changing speaker saves the default speaker and probes TTS without automatically replacing existing speech files.
- TTS automatic queue fills missing and stale targets only; failed targets do not auto-retry until source text changes or the user explicitly retries them from settings.
- Automatic TTS scan runs on workspace open/refresh and after a clean saved note body creates a stale target.
- Automatic TTS admits 5 targets per wave, then continues with the next capped wave until the current workspace has no more eligible missing/stale targets or the workspace/session is canceled.
- Automatic queue is serial, de-duplicated by target, paused during recording, canceled on workspace switch/lock lost/app quit, and manual tasks insert at the head without preempting an in-flight task.
- Only manual TTS tasks show a renderer "generating" state. Automatic tasks remain missing or stale until completed.
- Manual speech generation uses a `生成语音` submenu with the four fixed speakers. Picking a speaker immediately replaces existing speech for that target without changing the global default speaker.
- Segment card More, primary `正文` tab More, and note SegmentSupplement tab More expose the same speech generation submenu. Primary `转录` tab More exposes the same transcription generate/regenerate action as the Segment card.
- Settings exposes `重新生成全部笔记语音`, which regenerates all imported Memory Space note Segment and note SegmentSupplement speech with the current default speaker, and `重试失败项`, which retries the failed targets from the latest batch summary with that summary's speaker.
- Generated speech does not affect Memory audio aggregate counts, audio duration aggregates, audio byte aggregates, or user-visible activity ordering.
- Settings copy gets a minimal current-fact disclosure that saved note text is sent to Volcengine for speech generation. No first-run modal.

## Non-Goals

- No async long-text API integration.
- No App ID / Access Key settings.
- No dynamic ListSpeakers integration.
- No per-note stored voice preference. Per-target menu speaker selection is a one-shot generation override.
- No user-configurable speech rate, pitch, emotion, format, sample rate, or model variant.
- No generated speech count/duration aggregate in Memory summaries.
- No new audio Segment or audio supplement creation from TTS.

## Data Contract

Add a Reo-managed speech payload to finalized note Segments and note SegmentSupplements.

Recommended file shape:

```text
memories/<memory>/segments/<note-segment>/segment.md
memories/<memory>/segments/<note-segment>/content.tiptap.json
memories/<memory>/segments/<note-segment>/speech.mp3

memories/<memory>/segments/<segment>/supplements/<note-supplement>/supplement.md
memories/<memory>/segments/<segment>/supplements/<note-supplement>/content.tiptap.json
memories/<memory>/segments/<segment>/supplements/<note-supplement>/speech.mp3
```

Recommended manifest fields:

```ts
type NoteSpeechSynthesisManifest = {
  audioByteLength: number;
  contentHash: string;
  format: 'mp3';
  lastSynthesisAttempt: 'never' | 'failed' | 'success';
  mimeType: 'audio/mpeg';
  model: 'seed-tts-2.0-expressive';
  resourceId: 'seed-tts-2.0';
  sampleRate: 24000;
  speaker: string;
  updatedAt: string;
};
```

Implementation notes:

- `speech.mp3` is a derived artifact. It is stored beside user content for locality, but it must not be confused with `audio.webm`, which only represents recording objects.
- Read model computes `missing`, `ready`, `stale`, and `failed` from manifest state, `speech.mp3`, note body hash, selected speaker, and model.
- `stale` keeps old speech playable while queueing regeneration.
- If `speech.mp3` exists without a valid matching manifest, treat it conservatively as not ready for Reo playback; do not silently trust arbitrary external MP3 as matching current text.
- TTS writes use atomic file write and parent directory fsync rules consistent with current workspace file writes.
- TTS writes must not update Segment or Memory user activity ordering.

## IPC And Main Runtime

Add explicit product channels; do not create a generic voice or provider channel.

Recommended channels:

- `workspace:requestSegmentSpeechSynthesis`
- `workspace:requestSegmentSupplementSpeechSynthesis`
- `workspace:regenerateImportedSpeechSynthesis`

Request mode:

```ts
type SpeechSynthesisMode = 'fill-missing' | 'regenerate';
```

Request identity:

- Segment request takes `workspaceHandle`, `workspaceId`, `memoryId`, `segmentId`, `mode`, and optional one-shot `speaker`.
- Supplement request takes `workspaceHandle`, `workspaceId`, `memoryId`, `segmentId`, `supplementId`, `mode`, and optional one-shot `speaker`.
- Imported batch regeneration request takes either `mode: 'all'` with a selected speaker, or `mode: 'retry'` with selected failed targets and the summary speaker.
- Renderer never sends body text, raw path, provider headers, API key, or generated audio bytes to provider directly.

Main runtime shape:

- New focused TTS client for V3 HTTP Chunked/SSE parsing.
- New focused note speech synthesis runtime, modeled after `backfillRuntime` but separate from ASR naming.
- Runtime reads saved note text from file truth, extracts speech text, checks length, reads decrypted X-Api-Key, calls TTS, saves `speech.mp3`, updates manifest speech state, refreshes exact projections.
- Manual regenerate compares expected source hash before overwrite. If body changed while generation was in flight, fail without overwriting.
- Automatic fill-missing checks current eligibility before generation and before save.
- Queue diagnostics must redact title, body text, speech text, root path, file path, audio bytes, base64, provider request body, and X-Api-Key.

Provider error mapping:

- Auth or TTS probe auth failure pauses automatic TTS but must not disable ASR if ASR validation is still ok.
- Rate limit, quota, timeout, server busy, malformed response, and network errors map to typed workspace errors.
- Failed TTS writes mark the target failed only when the failure belongs to that target and source hash.

## Settings UI

Rename user-facing settings from narrow `豆包语音识别` wording to common `豆包语音`.

The existing master switch controls:

- live speech recognition
- finalized recording transcription backfill
- note TTS

Settings additions:

- TTS speaker selector with the four fixed speaker choices.
- Split validation display for ASR and TTS when one succeeds and the other fails.
- Minimal disclosure sentence: saved note text is sent to Volcengine to generate speech.

Settings persistence:

- Keep the existing main-owned encrypted X-Api-Key storage.
- Add TTS speaker and TTS validation status fields to the same settings file.
- Preserve response redaction: no API key plaintext, ciphertext, provider request body, body text, or generated speech text returns to renderer.

## Memory Studio UI

Segment player area:

- Audio Segment: current recording player behavior remains.
- Note Segment:
  - ready or stale speech: show the same playback row style as audio playback, using MP3 MIME.
  - missing: keep a stable-height placeholder under the Segment strip and above the tab rail; generation is available from the Segment More menu.
  - manual running: show stable-height generating status.
  - failed: show failure status with retry action.
  - stale: keep old audio playable and show a compact "待更新" status.

Supplement panel:

- Audio supplement: current supplement recording player remains.
- Note supplement: add the same speech playback/placeholder row at the top of the panel, then the existing inline editor. Missing speech keeps the row stable without a playback button; generation is available from the supplement tab More menu.

Menus:

- Note Segment card More gets `生成语音` as a speaker submenu.
- Primary `正文` tab More gets the same `生成语音` speaker submenu.
- Primary `转录` tab More gets `生成转录` or `重新生成转录`.
- Note SegmentSupplement tab More gets `生成语音` as a speaker submenu.
- Audio SegmentSupplement tab More keeps `生成转录` or `重新生成转录`.

## Cache And State

- Add feature-local manual running state in `App`, parallel to transcription backfill running state, keyed by workspace/session/entity.
- Automatic TTS does not expose renderer-visible queue events.
- On successful manual TTS response, patch Workspace snapshot, Memory detail, and exact selected content query if the initiating session still matches.
- Settings speaker change only updates the default speaker and TTS validation snapshot. Existing speech files are replaced only by a per-target menu action or the explicit settings batch regeneration button.
- Settings batch regeneration invalidates workspace-scoped Memory detail and exact note content queries after completion, then exposes counts and failed retry targets in the settings panel.
- Workspace close/switch clears manual TTS running keys for the old handle.

## Implementation File Map

Likely main/workspace-contract changes:

- `src/workspace-contract/workspace-channels.ts`
- `src/workspace-contract/workspace-contract.ts`
- `src/workspace-contract/reo-workspace-bridge.ts`
- `src/preload/workspaceBridge.ts`
- `src/main/workspaceIpc.ts`
- `src/main/index.ts`
- `src/main/voiceSettingsStore.ts`
- `src/main/voiceTranscriptionProbe.ts`
- `src/main/doubaoTtsClient.ts` (new)
- `src/main/speechSynthesisRuntime.ts` (new)
- `src/main/memoryFiles.ts`

Likely renderer changes:

- `src/renderer/src/settings/VoiceSettingsPanel.tsx`
- `src/renderer/src/settings/voiceSettingsQueries.ts`
- `src/renderer/src/workspace/workspaceApi.ts`
- `src/renderer/src/workspace/workspaceQueries.ts`
- `src/renderer/src/workspace/entityActionMenu.tsx`
- `src/renderer/src/workspace/SegmentActionsMenu.tsx`
- `src/renderer/src/workspace/SegmentSupplementActionsMenu.tsx`
- `src/renderer/src/workspace/MemoryStudio.tsx`
- `src/renderer/src/App.tsx`
- `src/renderer/src/devWorkspaceScenario.ts`

Likely tests:

- `test/main/workspaceContract.test.ts`
- `test/main/workspaceBridgeSurface.test.ts`
- `test/main/voiceSettingsStore.test.ts`
- `test/main/voiceTranscriptionProbe.test.ts`
- `test/main/doubaoTtsClient.test.ts` (new)
- `test/main/speechSynthesisRuntime.test.ts` (new)
- `test/main/workspaceFiles.test.ts`
- `src/renderer/src/settings/VoiceSettingsPanel.test.tsx`
- `src/renderer/src/settings/voiceSettingsQueries.test.ts`
- `src/renderer/src/workspace/workspaceApi.test.ts`
- `src/renderer/src/workspace/workspaceQueries.test.ts`
- `src/renderer/src/workspace/SegmentActionsMenu.test.tsx`
- `src/renderer/src/workspace/SegmentSupplementActionsMenu.test.tsx`
- `src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`
- `src/renderer/src/App.test.tsx`

## Implementation Checklist

### Phase 1: Contracts And Settings

- [x] Add speech synthesis schemas and error codes to workspace contract tests first.
- [x] Add bridge/preload surface tests for explicit speech channels.
- [x] Extend voice settings store schema with TTS speaker and split validation state.
- [x] Add TTS probe test using a mocked client; ensure key and text are not exposed.
- [x] Update settings queries and settings panel tests for common voice wording, speaker selection, split validation, and minimal disclosure copy.

### Phase 2: File Truth And Read Model

- [x] Add failing main tests for note Segment `speech.mp3` projection, stale detection, missing manifest handling, empty body removal, and no audio aggregate change.
- [x] Add equivalent tests for note SegmentSupplement.
- [x] Implement speech manifest read/write helpers with no-follow/known-directory safety and atomic MP3 write.
- [x] Extend note content read responses to include speech metadata and move bounded MP3 bytes to dedicated lazy read channels.
- [x] Generalize renderer audio playback resource handling from WebM-only to MIME-aware MP3/WebM.

### Phase 3: Provider Client And Runtime

- [x] Add `doubaoTtsClient` tests for request headers/body, MP3 base64 chunk assembly, abort, timeout, auth, rate limit, quota, malformed response, and redaction.
- [x] Implement V3 HTTP Chunked/SSE client with `X-Api-Key`, `seed-tts-2.0`, `seed-tts-2.0-expressive`, selected speaker, MP3 24000 Hz, and no renderer/provider secret leakage.
- [x] Add runtime tests for manual fill-missing, manual regenerate hash guard, long-text chunking, Markdown/HTML cleanup, empty text rejection, stale regeneration, failed target behavior, capped-wave automatic draining, recording pause, cancel, lock lost, and session mismatch.
- [x] Implement note speech synthesis runtime and wire it into app lifecycle next to backfill runtime.
- [x] Add automatic scan triggers for workspace open/refresh and clean note saves.

### Phase 4: Renderer Workflow

- [x] Add App tests for manual TTS running state, stale session response ignore, success cache patch, error toast, settings-disabled reason, TTS validation-disabled reason, and recording interlock.
- [x] Add Memory Studio tests for note Segment player states, note supplement player states, speaker submenu action labels, direct regeneration, long-text disabled state, and primary content tab More carrying the matching TTS/transcription actions.
- [x] Implement speech synthesis controller in App and pass it into Memory Studio.
- [x] Add note Segment and note supplement speech player/status UI using the existing audio playback row style.
- [x] Update dev workspace scenario to include note speech ready, stale, missing, and failed examples for visual checks.

### Phase 5: Docs And Verification

- [x] Update `docs/current/electron.md` if IPC/settings/provider boundary changes are stable current facts.
- [x] Update `docs/current/data.md` for speech payload file contract, manifest fields, cache ownership, and non-aggregate rule.
- [x] Update `docs/current/flow.md` for TTS queue, cancellation, auto scan, stale, retry rules, and per-note speech/body save serialization.
- [x] Update `docs/current/frontend.md` for note/supplement speech player placement, stable audio resource keys, and settings UI changes.
- [x] Update `docs/current/quality.md` if new focused tests or validation commands become stable current facts.
- [x] Run focused main tests with `MAIN_TEST_FILES=... npm run test:main`.
- [x] Run focused renderer tests through `npm run test:renderer -- ...`.
- [ ] Run `npm run verify:quick` once before declaring completion.
- [ ] Run Memory Studio runtime visual verification for note and supplement speech player states.

## Verification Evidence

- Focused renderer: `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/SegmentSupplementActionsMenu.test.tsx src/renderer/src/workspace/SegmentActionsMenu.test.tsx` passed 94 tests across 3 files.
- Focused main: `MAIN_TEST_FILES=test/main/noteSpeechSynthesisLiveE2e.test.ts,test/main/doubaoTtsClient.test.ts,test/main/speechSynthesisRuntime.test.ts,test/main/workspaceContract.test.ts,test/main/voiceSettingsStore.test.ts,test/main/workspaceIpc.test.ts,test/main/workspaceIpcRegistration.test.ts,test/main/workspaceBridgeSurface.test.ts,test/main/backfillRuntime.test.ts,test/main/noteWorkspaceContract.test.ts npm run test:main` passed 325 tests with 1 expected live-key skip.
- Real-key live E2E: `MAIN_TEST_FILES=test/main/noteSpeechSynthesisLiveE2e.test.ts npm run test:main` passed with the key injected through no-echo stdin. The test generated note Segment and note SegmentSupplement MP3 speech, then used Doubao ASR to confirm the generated audio speaks cleaned note text and does not speak Markdown syntax, link URLs, or image paths.
- Runtime UI verification: system Chrome headless against `http://localhost:5183/?reoScenario=memory-studio-rich` at 1200x800 confirmed note Segment missing speech keeps a 42px placeholder under the Segment strip and above the tab rail, and note supplement missing speech keeps a 42px `memory-studio-supplement-player` row above the inline editor without a playback button.
- Dev app settings verification: after restarting Electron with the settings normalization fix, the local persisted settings retained the encrypted X-Api-Key, normalized the obsolete speaker id to `zh_female_vv_uranus_bigtts`, and the live settings page showed both `语音识别：已验证` and `语音生成：已验证`.
- Runtime follow-up: existing 7 KB note bodies were not generated earlier because the automatic scanner skipped text over the short synchronous TTS limit. The runtime now chunks cleaned long text into multiple same-key TTS calls and merges the MP3 bytes; settings batch regeneration is the explicit path for replacing old speech after a default speaker change.
- Dev app historical workspace verification: reopening `启示录阅读记录` generated `speech.mp3` for the 7.5 KB note Segment and the 3.3 KB note SegmentSupplement. Reading the same content through preload returned `speechStatus: ready` for both targets, and ASR verification of the generated 3.97 MB Segment MP3 returned the expected semantic terms without URL/image-path/Markdown-symbol leakage.
- Typecheck: `npm run typecheck:quick` passed after the second-round fixes.
- Second-round focused main: `MAIN_TEST_FILES=test/main/workspaceIpc.test.ts npm run test:main` passed 198 tests, including the regression test that pauses TTS after hash check and verifies clearing the note body still removes speech.
- Second-round focused renderer: `npm run test:renderer -- --run src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/workspaceQueries.test.ts src/renderer/src/settings/voiceSettingsQueries.test.ts src/renderer/src/App.test.tsx` passed 219 tests, including cache GC separation and stable audio resource key behavior.
- Second-round subagent review/ycksimplify fixes addressed: speech audio query GC, projection-vs-audio invalidation separation, requestId-free Blob/waveform cache keys, pending delete query guard key layout, and per-note speech/body save serialization.
- Final `npm run verify:quick` is pending.

## Risks

- Provider docs differ by endpoint. Do not implement async long text without verified same-key support.
- TTS response parsing must not log or expose note body text or generated audio base64.
- Automatic generation after every saved edit can consume quota; this is mitigated by stale detection, capped-wave queueing, serial execution, and failed-target non-retry.
- MP3 duration may not be known until browser metadata loads. Playback UI must keep stable dimensions and handle duration discovery without layout shift.
- Voice setting changes can make many speech files stale. Scanner must apply the 5-target limit and avoid changing user activity ordering.

## Success Criteria

- Note Segment and note SegmentSupplement can generate, play, retry, and regenerate MP3 speech using the same X-Api-Key.
- Missing and stale eligible notes are automatically queued under the agreed batch and interlock rules.
- Long text, empty text, failed TTS validation, recording-active, dirty editor, and conflict states are visible and safe.
- Renderer never receives or sends provider credentials, provider request headers, raw paths, or generated provider request bodies.
- Generated speech persists across app restart and does not alter recording aggregates or activity sorting.
- Focused tests and `npm run verify:quick` pass in the current snapshot.

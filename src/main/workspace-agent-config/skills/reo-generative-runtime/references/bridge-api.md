# Reo runtime bridge API

Use this reference when a work, widget or home component needs live Reo context, durable state, host UI coordination, typed product writes or agent prompt actions.

## Setup

Add this script before your own runtime script:

```html
<script src="reo-render://vendor/reo-render/bridge.js"></script>
```

The script creates `window.reo`. All methods return Promises. On Reo errors, the Promise rejects with `error.code` and `error.message`.

## API groups

- `window.reo.state.read()` and `window.reo.state.write(state, { baselineVersion })` for `state.json`.
- `window.reo.workspace.read()` for current workspace summary, all Memory summaries, current Memory summary, target identity and current object projection. Home components also receive `memorySpaces` and `recentExpressions`.
- `window.reo.content.readMemoryDetail()` for the current Memory detail, or `window.reo.content.readMemoryDetail({ workspaceId?, memoryId })` after reading `workspace.memories`, `workspace.memorySpaces` or `workspace.recentExpressions`.
- `window.reo.content.readCurrentObject()` for the current Reo object projection without raw paths.
- `window.reo.media.readPlaybackAudio({ workspaceId?, memoryId, segmentId, supplementId?, kind })` for existing recording audio (`kind: "audio"`) or ready note speech (`kind: "note-speech"`). Use `workspaceId` in home components when the audio is not from the current workspace context.
- `window.reo.mutations.updateTitle({ title })` for the current work title.
- `window.reo.ui.requestFullscreen()` to ask the host preview to expand.
- `window.reo.ui.selectMemory({ workspaceId?, memoryId })` for workspace rail widgets or home components that need to switch the main content Memory after reading context data; this keeps the runtime tab active and does not make the runtime object become Memory content.
- `window.reo.ui.selectObject({ workspaceId?, memoryId, segmentId?, supplementId? })` for workspace rail widgets or home components that need to switch the main content Memory and focus an active Segment or SegmentSupplement. Use `supplementId` only with its parent `segmentId`.
- `window.reo.agent.copyPrompt({ action })` to copy a Reo-built agent prompt. Use `action: "create-supplement"` from a work Segment; otherwise omit action to update the current work.

## Workspace Memory ids

`window.reo.workspace.read()` returns Memory summaries with `memoryId`. Home components can also use `workspace.memorySpaces` and `workspace.recentExpressions` to choose a `workspaceId`. Use those exact fields for selection and detail reads:

```js
const snapshot = await window.reo.workspace.read();
for (const memory of snapshot.workspace.memories) {
  const memoryId = memory.memoryId;
  button.dataset.memoryId = memoryId;
  button.addEventListener("click", () => window.reo.ui.selectMemory({ memoryId }));
}

for (const expression of snapshot.recentExpressions || []) {
  const { workspaceId, memoryId, segmentId, supplementId } = expression;
  card.addEventListener("click", () =>
    window.reo.ui.selectObject({ workspaceId, memoryId, segmentId, supplementId })
  );
}
```

For cards backed by `readMemoryDetail({ memoryId })`, use the active object ids returned by that detail:

```js
await window.reo.ui.selectObject({ memoryId, segmentId, supplementId });
```

Do not use `memory.id`; that field is not part of the runtime workspace summary contract.

## Playback audio

Use this only to read bytes for audio that already exists in Reo. It does not generate speech, expose transcripts or provide a player.

```js
const media = await window.reo.media.readPlaybackAudio({
  memoryId,
  segmentId,
  kind: "audio",
});
const url = URL.createObjectURL(new Blob([media.audio], { type: media.mimeType }));
audio.src = url;
```

Works, widgets and home components own the `<audio>` element, Blob URL lifecycle, progress UI, error display and any playback state.

## Boundaries

- Do not call Electron, Node, preload internals or raw filesystem paths.
- Do not invent methods outside documented `window.reo` groups.
- Reo bridge mutations are typed product actions, not a generic file bridge.
- Reo media reads do not create speech, manage playback state, provide a queue or choose a player design.
- Artifact works cannot write arbitrary note bodies through `window.reo`; use agent prompt actions when a work needs a broader Reo content edit.
- Workspace rail widgets and home components cannot create, reorder or delete runtime objects through `window.reo`; use host UI actions or agent prompt actions and the file contract for broader edits.
- Network, CDN and browser APIs are allowed; browser CORS rules still apply.

Reo does not provide a runtime key, token or hidden value store for works, widgets or home components. If a runtime object needs user-provided values, keep that behavior explicit inside the user-owned files and agent instructions.

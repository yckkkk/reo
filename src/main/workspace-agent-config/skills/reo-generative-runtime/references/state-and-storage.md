# Reo runtime state and storage

Use this reference when the work or widget has user interaction, checkboxes, filters, drafts, progress or generated data.

## state.json

Default shape:

```json
{
  "schemaVersion": 1,
  "stores": {
    "ui": {},
    "data": {},
    "progress": {},
    "draft": {}
  }
}
```

Use named stores so future agents can update one area without guessing the whole app. Keep values JSON-serializable.

## Runtime state bridge

`window.reo.state.read()` returns `{ state, version, source }`.
`window.reo.state.write(nextState, { baselineVersion })` writes `state.json` through Reo. If another agent edited the file first, Reo returns a stale result with the current state/version; reread and merge deliberately.

Minimal pattern:

```js
const snapshot = await window.reo.state.read();
const next = { ...snapshot.state, stores: { ...snapshot.state.stores, ui: { done: true } } };
const saved = await window.reo.state.write(next, { baselineVersion: snapshot.version });
```

## Browser persistence

Each runtime object has its own origin, so localStorage and IndexedDB are isolated per object. Use browser storage for fast UI cache when helpful. Do not use browser storage as the only long-term state for check-ins, todo items, progress or user preferences; keep `state.json` as the visible durable state that users and agents can inspect and modify.

Writing `state.json` through `window.reo.state.write` does not reload the host iframe. Update the DOM from the returned result. Reo reloads the iframe when `entry.html`, `runtime.json` or `assets/` change, and the user can manually reload from the work or widget tab More menu with “刷新页面”.

## Agent updates

When an agent updates data, it should edit `state.json` and `entry.html` together if the entry embeds a static copy of the data. Preserve unknown store keys unless the user asks for a reset.

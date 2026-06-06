---
name: reo-generative-runtime
description: Shared Reo generative runtime skill for building small local Web app bundles used by works and workspace rail widgets. Use for entry.html/runtime.json/state.json/assets, widget.md, window.reo bridge, state, templates, network, scaffold and validation.
---

# Reo Generative Runtime

Use this skill whenever you create or update a Reo runtime object. A runtime object is a small local Web app bundle owned by the user. Works and workspace rail widgets are current consumers of the same runtime contract.

## Runtime Bundle

A valid runtime bundle lives beside the object Markdown file and uses four stable entries:

- `entry.html`: the runnable HTML app entry.
- `runtime.json`: description, entry, template family, state stores and bridge needs.
- `state.json`: user-visible state stores that agents can inspect and edit.
- `assets/`: local images, CSS, JS, fonts or data files copied into the bundle.

For workspace rail widgets, the object directory is `widgets/<widget-directory>/`. The object Markdown file is `widget.md`; its frontmatter must contain only stable widget contract fields such as `id`, `title`, `kind: widget`, `format: html` and `mount: workspace-rail`. Do not add `workspaceId` or raw paths to `widget.md`.

Read `references/bundle-contract.md` before writing files.

## State

`state.json` is the durable agent-readable state file. Runtime code may read and write it through `window.reo.state` with a version/baseline contract. If a work or widget needs to remember user actions, progress, preferences, check-ins, filters or todo items, write that durable state to `state.json`; browser storage such as localStorage and IndexedDB is only a fast UI cache or compatibility cache. State writes update the running work or widget through the returned state/version; they do not reload the host iframe.

Read `references/state-and-storage.md` for store naming, versioning and merge rules.

## Bridge

To use Reo data, state, UI, mutation or agent prompt actions, explicitly load `reo-render://vendor/reo-render/bridge.js` from `entry.html`. This provides `window.reo` inside the iframe. Do not invent any other host bridge. Memory summaries expose `memoryId`, not `id`; when iterating `workspace.memories`, use `const memoryId = memory.memoryId` before calling `selectMemory`, `selectObject` or `readMemoryDetail`. Workspace rail widgets may call `window.reo.ui.selectMemory({ memoryId })` to switch the main content Memory, or `window.reo.ui.selectObject({ memoryId, segmentId?, supplementId? })` after reading Memory detail to focus an active Segment or SegmentSupplement; this does not switch away from the widget tab.

Read `references/bridge-api.md` before using `window.reo`.

## Web Capability

普通 Web 网络 is allowed. You may use remote HTTP/HTTPS resources, CDN libraries, WebSocket endpoints and browser APIs available inside an iframe. Do not use Node, Electron, raw filesystem paths, `file://`, symlinks or hidden editor temp files. If a third-party API blocks browser CORS, explain that to the user or use a different browser-compatible source.

## Templates

Choose a template family to move fast, then adapt it freely. Useful families include report, explainer, explorable, dashboard, editor, spaced review, todo, game, gallery, map, prototype and data tool. An explorable is an explainer driven by a source->derive->render reactive model (1-2 source variables driving a live chart); for those, references/templates.md links the reo-works-design explorables guide and runnable examples. Templates are starting points, not capability limits.

Read `references/templates.md` before choosing structure.

## Responsive Layout

Runtime layouts must survive narrow iframes and right rail widgets. For flex/grid text containers, set `min-width: 0`; for single-line labels use `display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`; for long identifiers or free text use `overflow-wrap: anywhere`. Never let titles, ids, URLs or generated prose create horizontal overflow.

Inline work previews should show the useful summary, primary controls and core result before the user has to scroll far. Complex works may use sections, compact internal panels, deliberate internal scroll areas, fullscreen affordances or work supplements for depth; do not lock every work to one fixed pixel height. Workspace rail widgets must stay useful from a 240px rail to a 520px rail.

Do not put literal local file URL scheme examples, machine paths or usernames into user-visible runtime copy; the validator treats those strings conservatively.

## Scripts

- Scaffold a runnable bundle in an existing target object directory: `node skills/reo-generative-runtime/scripts/scaffold-runtime.mjs <target-directory> --title "标题" --template dashboard`.
- Validate a bundle can run: `node skills/reo-generative-runtime/scripts/validate-runtime.mjs <target-directory>`.
- Inspect a bundle summary: `node skills/reo-generative-runtime/scripts/inspect-runtime.mjs <target-directory>`.

Validation is about file contract and runnability. It does not judge content quality, network choices or user intent.

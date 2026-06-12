---
name: reo-generative-runtime
description: Shared Reo generative runtime skill for building small local Web app bundles used by works, workspace rail widgets and home components. Use for entry.html/runtime.json/state.json/assets, widget.md, component.md, window.reo bridge, state, templates, network, scaffold and validation.
---

# Reo Generative Runtime

Use this skill whenever you create or update a Reo runtime object. A runtime object is a small local Web app bundle owned by the user. Works, workspace rail widgets and home components are current consumers of the same runtime contract.

## Runtime Bundle

A valid runtime bundle lives beside the object Markdown file and uses four stable entries:

- `entry.html`: the runnable HTML app entry.
- `runtime.json`: description, entry, template family, theme token contract, state stores and bridge needs.
- `state.json`: user-visible state stores that agents can inspect and edit.
- `assets/`: local images, CSS, JS, fonts or data files copied into the bundle.

For workspace rail widgets, the object directory is `widgets/<widget-directory>/`. The object Markdown file is `widget.md`; its frontmatter must contain only stable widget contract fields such as `id`, `title`, `kind: widget`, `format: html` and `mount: workspace-rail`. Do not add `workspaceId` or raw paths to `widget.md`.

For home components, the app-level object directory is `home-components/<component-directory>/`. The object Markdown file is `component.md`; its frontmatter must contain `id`, `title`, `kind: home-component`, `format: html` and `mount: home`. Do not add `workspaceId` or raw paths to `component.md`.

For app-level home component prompts, treat the provided home components root as authoritative. For new bundles, run `scaffold-runtime.mjs` from the parent app data root that contains `home-components/`; for updates, edit the existing bundle directly. Run `validate-runtime.mjs` and `inspect-runtime.mjs` from that parent app data root, using `home-components/<component-directory>` as the target. Do not apply patches against the memory-space cwd when the target root is outside it.

Read `references/bundle-contract.md` before writing files.

## State

`state.json` is the durable agent-readable state file. Runtime code may read and write it through `window.reo.state` with a version/baseline contract. If a work or widget needs to remember user actions, progress, preferences, check-ins, filters or todo items, write that durable state to `state.json`; browser storage such as localStorage and IndexedDB is only a fast UI cache or compatibility cache. State writes update the running work or widget through the returned state/version; they do not reload the host iframe.

Read `references/state-and-storage.md` for store naming, versioning and merge rules.

## Bridge

To use Reo data, state, media, UI, mutation or agent prompt actions, explicitly load `reo-render://vendor/reo-render/bridge.js` from `entry.html`. This provides `window.reo` inside the iframe. Do not invent any other host bridge. If a runtime needs playable Reo audio that already exists, call `window.reo.media.readPlaybackAudio({ workspaceId?, memoryId, segmentId, supplementId?, kind })`; the runtime owns the `<audio>` element, Blob URL cleanup, UI state and user-facing behavior. Memory summaries expose `memoryId`, not `id`; when iterating `workspace.memories`, use `const memoryId = memory.memoryId` before calling `selectMemory`, `selectObject` or `readMemoryDetail`. Workspace rail widgets may call `window.reo.ui.selectMemory({ memoryId })` to switch the main content Memory, or `window.reo.ui.selectObject({ memoryId, segmentId?, supplementId? })` after reading Memory detail to focus an active Segment or SegmentSupplement; this does not switch away from the widget tab. Home components may use `workspaceId` from `workspace.memorySpaces` or `workspace.recentExpressions` with `readMemoryDetail`, `readPlaybackAudio`, `selectMemory` and `selectObject`.

Read `references/bridge-api.md` before using `window.reo`.

## Web Capability

普通 Web 网络 is allowed. You may use remote HTTP/HTTPS resources, CDN libraries, WebSocket endpoints and browser APIs available inside an iframe. Do not use Node, Electron, raw filesystem paths, `file://`, symlinks or hidden editor temp files. If a third-party API blocks browser CORS, explain that to the user or use a different browser-compatible source.

## Templates

Choose a template family to move fast, then adapt it freely. Useful families include report, explainer, explorable, dashboard, editor, spaced review, todo, game, gallery, map, prototype and data tool. An explorable is an explainer driven by a source->derive->render reactive model (1-2 source variables driving a live chart); for those, references/templates.md links the reo-works-design explorables guide and runnable examples. Templates are starting points, not capability limits.

New works, widgets and home components should write `runtime.json.theme` as `{ "tokens": "reo-semantic-v1", "modes": ["light", "dark"], "default": "system" }`. Use the full Reo semantic token block from `skills/reo-works-design/references/core-design-system.md` for the standard UI frame and controls; do not hand-write an abbreviated token block. Creative content inside the frame can use its own scoped palette when that better serves the user's request.

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

Generic global workflow gates are not required for short Reo runtime-object creation prompts. Do not start brainstorming, product-design, test-driven-development, practical-ui, visual companion, browser screenshots or broad repo-search flows unless the current user prompt explicitly asks for them.

For short memory-space creation prompts, run `validate-runtime.mjs` and `inspect-runtime.mjs`, then stop as soon as they pass. Do not run headless browser screenshots, broad repo searches or extra visual-polish loops unless the user explicitly asks for that in the current prompt.

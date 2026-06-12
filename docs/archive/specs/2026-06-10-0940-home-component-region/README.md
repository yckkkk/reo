# Home Component Region Design

Timezone: America/Los_Angeles

## Objective

Redesign the Home red-box area that currently contains `近期表达` into a Home component region. The fixed Home greeting, headline, and four expression entry tiles stay outside this component region.

## Current Facts

- Home currently renders fixed expression entry tiles above a `近期表达` block in `WorkspaceStarterHome`.
- `近期表达` already has real recent-expression data, cover icons, hover playback, click-to-open behavior, loading/empty/error states, and partial unreadable workspace messaging.
- Right-side Workspace Widget and artifact runtime already provide reusable runtime bundle, prompt bridge, state, More menu, iframe preview, fault panel, and runtime bridge patterns.
- Memory Studio content tab rail already provides the tab pill, icon+label, active state, hidden More affordance, drag ordering, and fixed action-area interaction model that Home should reuse.

## Approved Design

### Region Boundary

Only the current `近期表达` area becomes the Home component region. The greeting, headline, and four expression entry tiles remain fixed Home UI and do not enter the rail.

### Layout

The component region header is:

1. A same-size content-tab-style rail.
2. A fixed icon-only `新增组件` button on the right.
3. The active component title below the rail.
4. The active component content below the title.

The rail viewport scrolls horizontally. The add button does not scroll with tabs. The component region has no large outer card; content fills the remaining Home height and owns internal scrolling.

### Built-In Component

`近期表达` is the first built-in Home component. It participates in tab ordering and active-tab selection, but has no More menu and cannot be deleted or renamed.

Its content keeps the current list model: cover icon, type glyph, hover playback, click-to-open, loading/empty/failure states, and skipped-workspace message. It does not become a grid, timeline, or Gallery variant.

### Custom Home Components

Custom Home Components are app-level entities, not memory-space entities. They live under app-owned `userData` subdirectories and survive deletion or removal of any memory space.

Each custom component uses the existing Shared Generative Runtime bundle shape:

```text
entry.html
runtime.json
state.json
assets/
```

Component resources reuse existing runtime bundle boundaries. Component internal state stays in its own `state.json`; Reo only owns shell state for tab order and last active tab.

### Home Shell State

Home has a lightweight app-level config for:

- component tab order
- last active component tab

If the last active component no longer exists, Home falls back to `近期表达`.

### Creation And Discovery

Clicking `新增组件` only copies a Home Component creation prompt. Reo does not create an empty component directory first.

The prompt gives the agent the app-owned component directory path. A main-owned watcher observes the Home Component root. The watcher is coarse-grained: any relevant change rereads the component index instead of maintaining complex incremental state.

When a newly created component is discovered, Home switches to it. If the active component changes on disk, its iframe reloads.

### Management

Custom component tabs show icon + title. The title and optional icon come from component metadata/assets; missing icons use the default component icon.

Custom components reuse the existing component/action menu language:

- open with default app
- reveal in Finder
- copy path
- rename
- refresh page
- Agent update
- delete

Rename updates component metadata title and does not rename the directory. Delete moves the component directory into app-level trash and offers restore.

### Runtime Bridge

Home Component runtime reuses `window.reo`; it does not introduce `window.reoHome`.

The first Home target adds minimal runtime capability:

- read global memory-space summary
- read recent expressions
- read detail by workspace / Memory / Segment / SegmentSupplement id
- request opening a memory space
- request focusing a Memory / Segment / SegmentSupplement
- update the current Home Component title
- read and write the current component `state.json`

Home Component runtime does not directly create, edit, move, or delete Reo memory content.

When linked memory-space data is missing or unreadable, Reo keeps the Home Component and returns missing or empty projections. The component, user, and agent handle that state.

### Lifecycle

Only the active component iframe is mounted. Switching tabs unmounts inactive iframes. Persistent state is the component runtime's responsibility through `state.json`.

Fault UI reuses the existing lightweight runtime fault pattern and exposes an Agent update action. Reo does not attempt automatic repair.

## Non-Goals

- Do not move the fixed expression entry tiles into the rail.
- Do not create a second right-rail Widget model.
- Do not make Home Components belong to memory spaces.
- Do not add a complex permissions, data-link, or state-management system.
- Do not expose write APIs for Home Components to mutate Reo memory content.
- Do not redesign Gallery or the current expression entry tiles.

## Success Criteria

- The existing Home expression entry tiles remain visually and behaviorally fixed above the component region.
- The old `近期表达` block is represented as a built-in component tab with the same data and playback behavior.
- Custom Home Components are app-level runtime bundles discovered from the app-owned component directory.
- Creating and updating custom components uses prompt bridge and file truth, not an in-app component builder.
- Home persists only tab order and last active tab.
- Runtime, More menu, fault panel, and state handling reuse existing artifact/Widget runtime patterns where they fit.
- The implementation stays small: no new global state library, no component registry UI, no object-level link manager, and no automatic repair machinery.

## Implementation Plan

### Phase 1: Contracts And File Truth

- Add Home Component ids, projection schemas, request/response schemas, and channels to `src/workspace-contract/*`.
- Add an app-level Home Component file owner under Electron `userData` subdirectories.
- Reuse runtime bundle constants, size limits, icon projection shape, preview-version hashing, state read/write behavior, and shell path actions from the existing artifact/Widget runtime patterns where possible.
- Add focused main tests first for: reading ready/fault components, title update, tab-order/last-active config, trash restore, and coarse watcher event projection.

### Phase 2: IPC, Preload, And Runtime Protocol

- Expose explicit IPC/preload methods for Home Component read/update/delete/restore/order/prompt/path/state operations.
- Extend `reo-render://` URL parsing and protocol resolution with a Home Component target.
- Extend runtime state target resolution and renderer runtime bridge with `targetType: 'home-component'`.
- Add focused contract/preload/runtime bridge tests before implementation.

### Phase 3: Renderer Home Region

- Replace the current `近期表达` block header with a Home component region shell.
- Keep the fixed expression tiles untouched.
- Render the built-in `近期表达` tab and custom Home Component tabs in a content-tab-style rail with fixed Plus action.
- Mount only the active custom component iframe, reuse fault panel behavior, and keep recent-expression list/playback behavior intact.
- Add renderer tests first for fixed expression tiles, active-tab fallback, persisted last active, tab ordering, add prompt, More actions, and recent-expression preservation.

### Phase 4: Verification And Docs

- Update `docs/current/*` only for durable Home Component model, app-level file truth, IPC/runtime bridge, and frontend invariants.
- Run targeted tests while building.
- Run runtime visual verification for Home.
- Run `npm run verify:quick` once at the end before claiming the tree is clean.

## Implementation Notes

- Implemented app-level Home Component file truth under Electron `userData/home-components/` with app-level shell state in `home-components.json` and trash restore under `home-components-trash/`.
- Reused artifact/Widget runtime bundle shape, shared preview-version hashing, `reo-render://` protocol handling, runtime `state.json` bridge, prompt bridge, fault panel, and More menu action model.
- Preserved the fixed Home expression entries above the component region. Only the previous `近期表达` area became the component region.
- Rendered built-in `近期表达` as the first Home component tab and custom Home Components as additional tabs with icon, title, More menu, prompt update, refresh, rename, delete, path actions, and active-only iframe mounting.
- Matched custom Home Component tab More affordance to the existing Widget tab model: hidden from the accessible tree while inactive, revealed on hover/focus/menu-open, and kept as a sibling of the tab button.
- Extended `window.reo` for Home Component runtime with global memory-space summaries, recent expressions, optional workspace-targeted detail/audio reads, UI selection requests, state read/write, title update, and agent prompt copy.

## Verification Evidence

- Visual screenshots:
  - `.tmp/ui-checks/home-components-review-visible.png`
  - `.tmp/ui-checks/home-components-review-after-reload.png`
  - `.tmp/ui-checks/home-components-review-after-active-sync-fix.png`
  - `.tmp/ui-checks/home-components-review-cold-start-after-active-sync.png`
  - `.tmp/ui-checks/home-components-final-after-more-affordance.png`
  - `.tmp/ui-checks/home-components-content-region-final.png`
  - `.tmp/ui-checks/home-components-custom-content-region-final.png`
- Created an external Codex-generated test Home Component under app data to verify file-truth discovery and tab visibility.
- External Codex review found that Home Component runtime bridge had not passed `readExpressionPlaybackAudio`; fixed by adding it to the Home Component bridge API and covering `media.readPlaybackAudio` in renderer tests.
- Fixed duplicate active-tab persistence so clicking the already selected Home Component tab does not write `home-components.json` again.
- `npx prettier --write` on changed TypeScript/TSX/JS/Markdown files passed.
- `git diff --check` passed.
- `npm run typecheck` passed.
- `npm run test:renderer -- --run src/renderer/src/workspace/WorkspaceStarterHome.test.tsx` passed after the final More-affordance cleanup.
- `MAIN_TEST_FILES=test/main/homeComponents.test.ts,test/main/artifactRuntimeState.test.ts,test/main/artifactProtocol.test.ts,test/main/workspaceFileTruthWatcher.test.ts,test/main/workspaceBridgeSurface.test.ts,test/main/workspaceContract.test.ts,test/main/securityPolicy.test.ts npm run test:main` passed.
- `npm run test:renderer -- --run src/renderer/src/App.test.tsx src/renderer/src/workspace/WorkspaceStarterHome.test.tsx src/renderer/src/workspace/artifactRuntimeBridge.test.tsx src/renderer/src/workspace/workspaceApi.test.ts src/renderer/src/workspace/RecordingOverlay.test.tsx` passed.
- `npm run test:renderer -- --run src/renderer/src/App.test.tsx` passed.
- `npm run verify:quick` passed on the final task snapshot.

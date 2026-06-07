# Home + System Draft Memory Space Spec

Timezone: America/Los_Angeles (PDT, -0700)

## Objective

Design the Reo homepage and the always-existing system `草稿` memory space before implementation.

This spec covers the backend/system model, renderer routing, protected entity behavior, sidebar IA, homepage expression actions, and the first real cross-space `近期表达` feed.

## Current Checkpoint

The current worktree already has an incomplete dirty checkpoint in these files:

- `src/renderer/src/workspace/WorkspaceStarterHome.tsx`
- `src/renderer/src/app-shell/AppShell.tsx`
- `src/renderer/src/workspace/WorkspaceLibraryPage.tsx`
- `src/renderer/src/app-shell/AppShell.test.tsx`

That checkpoint restores a non-blank homepage shape and begins the sidebar IA rename, but it does not implement the system Draft model, Draft routing, protected main-process behavior, or real recent-expression data. No verification has been run after that checkpoint.

## Confirmed Product Decisions

- Sidebar IA is `首页`, `画廊`, `草稿`, then `记忆空间`.
- `草稿` is a top-level sidebar entry under `画廊`; it is not rendered inside the normal memory-space list.
- `草稿` is an always-existing Reo-managed system memory space, not a lazily created space when clicking a Home entry.
- `草稿` is a real Reo memory space root using the normal workspace file contract and normal `workspaceHandle` session model.
- `草稿` is not a renderer-only special workspace.
- The physical Draft root is created and owned by Reo in a fixed app-managed local directory.
- The authoritative system identity store lives in main-owned app state, not in user-editable workspace files.
- Workspace files may mirror system role information for agent readability, but main must not trust those files to decide protection.
- The Draft root contains a protected default Memory also named `草稿`.
- The default Draft Memory has a stable system role/id and is the default landing target for homepage expression actions.
- Users and agents can still create and operate normal Memories, Segments, and SegmentSupplements inside the Draft space.
- The protected system Draft space itself cannot be renamed or removed.
- The protected default Memory named `草稿` cannot be renamed or deleted.
- Protection is identity-based, not title-based.
- Renderer hides or disables protected rename/remove/delete actions.
- Main IPC enforces the same protection by stable role/id and returns typed errors for forbidden mutation attempts.
- Read-only file/agent actions remain available for protected system entities where applicable: open agent entry/default app, reveal in Finder, and copy absolute path.
- Home actions `写下来`, `录下来`, and `造出来` use the default Draft Memory as the target without showing an intermediate Draft workspace route.
- `写下来` opens the existing note editor flow over the Home foreground; closing without saving stays on Home, and successful save switches to Draft.
- `录下来` opens the existing recording flow over the Home foreground; closing without saving stays on Home, and successful finalize switches to Draft.
- `造出来` reuses the existing artifact prompt-copy flow targeting the default Draft Memory and stays on Home.
- `拍下来` remains disabled in this spec; no photo/camera permission or new content kind is introduced.
- The homepage remains restored/non-blank: four top entries and one lower `近期表达` block.
- Homepage visuals must support light/dark mode and must not rely on white-background PNG assets.
- Generated icon assets are not optimized in this spec; final custom icons are out of scope.
- `近期表达` is a real cross-space feed in this spec.
- The recent feed includes finalized top-level Segments and finalized SegmentSupplements from Draft and all imported normal memory spaces.
- The recent feed excludes Widgets and unfinalized `.reo/drafts`.
- Recent feed reading is main-owned, app-scoped, and uses temporary bounded reads for inactive spaces instead of renderer opening spaces one by one.
- Clicking a recent feed row opens the source workspace and focuses the target object. For SegmentSupplement rows, Reo opens the parent Segment and selects the corresponding supplement tab.
- `画廊` is IA-only in this spec and remains a lightweight placeholder page.
- No Figma push is in scope.

## Non-Goals

- No implementation in this spec-writing slice.
- No Figma sync or design asset optimization.
- No camera/photo object support.
- No persistent global recent-expression index.
- No database, Drizzle schema, migration, auth, Zustand store, packaging, updater, telemetry, or new generic runtime.
- No full Gallery page, search, filtering, or media browser.
- No new artifact editor or empty artifact skeleton write contract.
- No renderer raw-path exposure.

## Official / Current Basis

The implementation must continue to follow Reo current truth:

- User semantic content truth is workspace files, not registry or DB.
- Main process owns real root paths, registry state, filesystem writes, locks, and typed IPC.
- Renderer works through `window.reoWorkspace`, TanStack Query, feature-local state, and existing explicit product channels.
- Electron renderer must not directly use Node or Electron APIs.
- Preload must expose narrow `contextBridge` methods and must not expose raw `ipcRenderer`.
- IPC channels must be explicit, validated, sender-checked, and typed.

Electron official documentation confirms the same IPC/security model: expose narrow preload wrappers through `contextBridge`, do not expose `ipcRenderer` directly, and pass only necessary data to renderer callbacks.

## System Draft Model

### Entities

Draft system space:

- Product name: `草稿`
- Type: real Reo memory space root
- System role: `draft-space`
- Root owner: main process
- Physical root: fixed Reo app-managed local directory
- Authority: main-owned system-space store
- Workspace file mirror: optional readable mirror for agents, not authoritative

Default Draft Memory:

- Product name: `草稿`
- Type: normal Reo Memory inside the Draft workspace
- System role: `draft-default-memory`
- Stable id: implementation should use a deterministic valid `mem_...` id
- Authority: main-owned system-space store
- File mirror: Memory manifest / Markdown may mirror role for readability, not authority

Normal user-created Memories inside Draft:

- Behave like normal Memories.
- Can be renamed, deleted, covered, selected, and used by agent workflows.
- Can contain normal note/audio/artifact Segments and SegmentSupplements.

### Main-Owned Store

Add a main-owned system-space store under app state. It records the authoritative system Draft identity and physical root:

- schema version
- system role `draft-space`
- canonical root path
- workspaceId
- title `草稿`
- defaultMemoryId
- createdAt / updatedAt as needed

The store is the protection source of truth. Workspace files can be repaired from it. User-editable workspace files cannot grant or remove protected status.

### Startup Ensure

At app startup / first renderer shell data load, main ensures:

1. The system-space store exists and is valid.
2. The Draft root exists under the app-managed directory.
3. The Draft root is a valid Reo workspace root with `.reo`, `memories/`, `widgets/`, and draft directories.
4. `.reo/REO.md` and Reo-managed official skills are installed or repaired using the same managed-agent path as normal workspace open.
5. The protected default `草稿` Memory exists with the stable defaultMemoryId.
6. The Draft workspace is available as a top-level system projection to renderer.

If the app-managed root is missing, recreate it. If the store is missing but a valid Draft root can be safely recovered, repair the store. If the root is unsafe, symlinked, locked by another live Reo process, or unrecoverably corrupt, return a typed system Draft error and keep Home actions disabled with a visible error state.

## IPC / Contract Changes

Add explicit product contracts rather than generic commands.

Expected new or changed surfaces:

- A startup/system shell data read or ensure channel that returns the Draft system projection.
- A channel to open the system Draft space, returning a normal `workspaceHandle`, `workspaceId`, snapshot, and `defaultMemoryId`.
- A channel for real cross-space recent expressions.
- Existing memory-space list remains the normal imported-space list; Draft is not mixed into that list.
- Existing open/remove/rename channels must reject protected system space mutation attempts by role/id.
- Existing Memory rename/delete channels must reject protected default Draft Memory mutation attempts by role/id.
- Existing read-only entity actions should work for Draft where the root/action target resolves safely.

Renderer DTOs must include enough projection flags to render the protected UX without title-based guesses:

- `systemRole?: 'draft-space'`
- `protectedActions` or equivalent capability booleans
- for Memory summaries, `systemRole?: 'draft-default-memory'` or equivalent protected marker

The exact DTO shape should be kept narrow and feature-specific. Do not create a generic permission framework.

## Renderer Flow

### Sidebar

Render top-level nav in this order:

1. `首页`
2. `画廊`
3. `草稿`
4. `记忆空间` section

`草稿` active state is separate from normal workspace active state. Opening Draft should not duplicate it in the normal memory-space list.

### Opening Draft

When the user clicks `草稿`:

1. Reuse `blockWorkspaceFlowInterruption`.
2. Release any currently open workspace if needed through the existing close/replacement flow.
3. Open the system Draft workspace through main.
4. Set active section to `draft`.
5. Select the protected default Draft Memory.
6. Render the normal loaded workspace frame.

### Home Actions

For `写下来`, `录下来`, and `造出来`:

1. Reuse `blockWorkspaceFlowInterruption`.
2. Ensure/open the system Draft workspace as a background target.
3. Select the default Draft Memory.
4. Keep Home as the foreground route while the expression is unsaved.
5. Start the matching flow:
   - `写下来`: existing note editor target for the default Draft Memory; successful save switches to Draft.
   - `录下来`: existing recording target for the default Draft Memory; successful finalize switches to Draft.
   - `造出来`: existing artifact prompt-copy flow for the default Draft Memory; stays on Home.

Do not show a memory-space selector or expression selector in this path.

`拍下来` remains disabled with accessible disabled state.

### Protected Menus

For Draft system space:

- Keep read-only/file actions.
- Hide or disable rename/remove.
- Main rejects rename/remove even if a stale renderer calls the IPC directly.

For default Draft Memory:

- Keep safe read-only/file actions and cover actions only if they remain semantically valid.
- Hide or disable rename/delete.
- Main rejects rename/delete even if called directly.

Normal Memories inside Draft keep normal actions.

## Recent Expression Feed

### Scope

The Home `近期表达` block displays a real cross-space feed from:

- the system Draft workspace
- all imported normal memory spaces from the registry

Included objects:

- finalized note/audio/artifact Segments
- finalized note/audio/artifact SegmentSupplements

Excluded objects:

- Widgets
- unfinalized `.reo/drafts`
- trash
- unsafe or needs-review-only candidates that do not project as valid finalized objects

### Read Model

Implement a main-owned app-scoped IPC that:

1. Ensures the system Draft space is ready.
2. Enumerates Draft plus registered memory spaces.
3. For the active workspace, reuses the active handle/read model where safe.
4. For inactive workspaces, uses temporary bounded open/read with lock handling.
5. Reads only the minimum needed data for feed rows.
6. Returns a bounded list sorted by object `updatedAt`, then `createdAt`, newest first.
7. Returns partial results if some inactive spaces are missing, locked, corrupt, or unsafe.
8. Returns a redacted skipped/error summary without raw paths.

Feed row fields should include:

- source workspaceId and workspace title
- memoryId and Memory title
- segmentId
- optional supplementId
- object type `note | audio | artifact`
- object title
- createdAt
- updatedAt
- a short preview when cheaply available
- enough identity to open and focus the object later

Preview policy:

- Note: first non-empty body text within a bounded read.
- Audio: first transcript text if it exists and can be read within bounds; otherwise a type/status fallback.
- Artifact: title or Markdown summary fallback; do not parse or execute `entry.html`.
- Supplement rows include parent Segment context in the row projection or accessible label.

No persistent app-wide recent index is introduced in this spec.

### Feed Click

Clicking a row:

1. Reuses `blockWorkspaceFlowInterruption`.
2. Opens the row source workspace if it is not already active.
3. Selects the row Memory.
4. If the row is a Segment, focuses that Segment.
5. If the row is a SegmentSupplement, focuses the parent Segment and selects the corresponding supplement tab.

Stale rows are handled by opening the source workspace and attempting a focused projection. If the object no longer exists, show a typed toast and refresh the feed.

## Homepage UI Requirements

The dirty checkpoint can be used as visual direction, but implementation must finish the data and routing model rather than stop at static UI.

Requirements:

- Four top entries: `写下来`, `录下来`, `造出来`, `拍下来`.
- One lower `近期表达` block.
- Support light and dark mode through existing design tokens.
- Do not rely on white-background PNGs.
- Do not optimize generated icon assets in this slice.
- Keep text responsive and non-overlapping.
- Keep Home usable before a normal memory space is imported.
- Home actions that require Draft must reflect Draft ensure/open pending and error states.

## Gallery Scope

`画廊` in this spec is IA-only:

- Sidebar label is `画廊`.
- Page title is `画廊`.
- The page can remain a lightweight placeholder.

Do not implement Gallery search, filters, real media aggregation, or recent feed reuse in this spec.

## Success Criteria

Implementation is complete only when:

- App startup ensures the system Draft root and default Draft Memory.
- Sidebar shows `首页 / 画廊 / 草稿 / 记忆空间`.
- Draft is never rendered as a normal memory-space list entry.
- Clicking `草稿` opens the Draft workspace and selects default Memory `草稿`.
- Protected Draft space cannot be renamed or removed from renderer UI or main IPC.
- Protected default Draft Memory cannot be renamed or deleted from renderer UI or main IPC.
- Users can create normal Memories inside Draft.
- Home `写下来` opens the note editor over Home, stays Home if closed unsaved, and switches to Draft only after save.
- Home `录下来` opens the recording flow over Home, stays Home if closed unsaved, and switches to Draft only after finalize.
- Home `造出来` copies the artifact creation prompt targeting the default Draft Memory without leaving Home.
- Home `拍下来` remains disabled.
- Home `近期表达` renders real cross-space Segment and SegmentSupplement rows.
- Clicking a feed row opens and focuses its source object.
- Missing/locked/corrupt inactive spaces do not blank Home; feed returns partial results with redacted error state.
- Light/dark Home rendering does not depend on white-background PNG assets.
- The incomplete dirty checkpoint is either completed or replaced by the final implementation.

## Verification Plan

Because this changes public IPC contracts, filesystem source-of-truth behavior, protected mutation behavior, cross-session state, and user-visible workflow, implementation should use real TDD for high-risk backend contracts.

Focused tests should cover:

- system-space store create/read/repair behavior
- Draft root ensure creates valid Reo workspace files
- default Draft Memory ensure creates stable Memory only once
- Draft open returns normal workspace session plus defaultMemoryId
- protected space rename/remove IPC rejection
- protected default Memory rename/delete IPC rejection
- renderer hides or disables protected actions
- Home action routing to Draft note/record/artifact flows
- recent feed main IPC includes Segments and SegmentSupplements
- recent feed skips missing/locked/corrupt inactive spaces without leaking raw paths
- feed click opens source workspace and focuses Segment/Supplement identity
- AppShell sidebar order and active state

Runtime visual verification is required before closeout because this changes homepage UI:

- light mode screenshot/inspection
- dark mode screenshot/inspection
- Home with no imported normal spaces
- Home with Draft available
- Home recent feed partial-error state

Final closeout must run `npm run verify:quick` before declaring the repo clean or ready to commit.

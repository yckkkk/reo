# Home Draft System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This repo's user rules override the generic commit guidance: do not commit unless the user explicitly asks.

**Goal:** Build the Reo homepage expression entry model backed by an always-existing protected system `草稿` memory space and a real cross-space `近期表达` feed.

**Architecture:** Main owns the system Draft root, system identity store, filesystem repair, recent-feed reads, and protected mutation enforcement. Renderer consumes narrow explicit IPC contracts through preload, treats Draft as a top-level section, and reuses the normal workspace session, Memory Studio, note editor, recording overlay, and artifact prompt flows.

**Tech Stack:** Electron main/preload IPC, Zod workspace contracts, React 19, TanStack Query v5 `queryOptions`, Vitest/Testing Library renderer tests, Node test runner main tests.

---

## File Map

- Create `src/main/systemDraftWorkspace.ts`: main-owned Draft store, Draft root ensure, default Memory ensure, protected identity helpers.
- Create `test/main/systemDraftWorkspace.test.ts`: focused TDD coverage for store/root/default Memory behavior.
- Modify `src/main/workspaceIpc.ts`: expose Draft open/ensure and recent feed handlers; enforce protected rename/remove/delete.
- Modify `src/workspace-contract/workspace-channels.ts`: add explicit Draft/recent feed channel names.
- Modify `src/workspace-contract/workspace-contract.ts`: add Draft projection, system role fields, recent feed schemas, protected error code if needed.
- Modify `src/workspace-contract/reo-workspace-bridge.ts`: add bridge types for new explicit methods.
- Modify `src/preload/workspaceBridge.ts`: map new methods to explicit channels.
- Modify `test/main/workspaceContract.test.ts`, `test/main/workspaceBridgeSurface.test.ts`, `test/main/workspaceIpcRegistration.test.ts`, and `test/main/workspaceIpc.test.ts`: contract, bridge, registration, IPC behavior coverage.
- Modify `src/renderer/src/workspace/workspaceApi.ts`: wrappers for Draft/recent feed methods.
- Modify `src/renderer/src/workspace/workspaceQueries.ts`: query keys/options for Draft system projection and recent feed.
- Modify `src/renderer/src/App.tsx`: use Draft as Home action background target, keep unsaved Home expressions on Home foreground, switch to Draft only after saved/finalized expression content, open feed rows and focus objects, keep Draft out of normal list.
- Modify `src/renderer/src/app-shell/AppShell.tsx`: finish Draft entry state and protected top-level IA.
- Modify `src/renderer/src/workspace/WorkspaceStarterHome.tsx`: replace static recent data with real feed states and action callbacks.
- Modify `src/renderer/src/workspace/WorkspaceLibraryPage.tsx`: keep `画廊` placeholder only.
- Modify renderer tests: `src/renderer/src/app-shell/AppShell.test.tsx`, `src/renderer/src/App.test.tsx`, `src/renderer/src/workspace/WorkspaceStarterHome.test.tsx` if a new focused test file is cleaner, and menu tests for protected actions.
- Update `docs/current/data.md`, `docs/current/electron.md`, `docs/current/flow.md`, and `docs/current/frontend.md` only for stable changed facts.

## Task 1: System Draft Root and Default Memory

**Files:**

- Create: `src/main/systemDraftWorkspace.ts`
- Test: `test/main/systemDraftWorkspace.test.ts`
- Possibly modify: `src/main/workspaceFiles.ts` or reuse existing exported functions only if a narrow helper is missing.

- [x] **Step 1: Write failing tests**
  - Ensure missing system store creates a valid Draft workspace root under a supplied app data directory.
  - Ensure the default `草稿` Memory is created once with a stable `mem_...` id.
  - Ensure a second ensure call is idempotent and does not duplicate the Memory.
  - Ensure unsafe/symlink root returns a typed error instead of following outside the app-managed directory.

- [x] **Step 2: Run RED**
  - Run: `MAIN_TEST_FILES=test/main/systemDraftWorkspace.test.ts npm run test:main`
  - Expected: FAIL because `systemDraftWorkspace.ts` does not exist or exported functions are missing.

- [x] **Step 3: Implement minimal main helper**
  - Create a small store schema in `systemDraftWorkspace.ts`.
  - Use app-managed root path input for tests and `app.getPath('userData')`-derived root from IPC integration later.
  - Reuse `initializeWorkspaceFiles`, `openWorkspaceFiles`, `createMemoryFromFileTruth`, safe path helpers, and existing workspace file contracts.
  - Export helpers such as `ensureSystemDraftWorkspace`, `isSystemDraftWorkspaceId`, `isSystemDraftDefaultMemoryId`, and `getSystemDraftStorePath`.

- [x] **Step 4: Run GREEN**
  - Run: `MAIN_TEST_FILES=test/main/systemDraftWorkspace.test.ts npm run test:main`
  - Expected: PASS.

## Task 2: Contract and Bridge Surface

**Files:**

- Modify: `src/workspace-contract/workspace-channels.ts`
- Modify: `src/workspace-contract/workspace-contract.ts`
- Modify: `src/workspace-contract/reo-workspace-bridge.ts`
- Modify: `src/preload/workspaceBridge.ts`
- Test: `test/main/workspaceContract.test.ts`
- Test: `test/main/workspaceBridgeSurface.test.ts`

- [x] **Step 1: Write failing contract/bridge tests**
  - Draft system projection includes `workspaceId`, `title`, `systemRole: 'draft-space'`, `defaultMemoryId`, and protected capabilities.
  - Recent feed response includes Segment and SegmentSupplement identity shapes.
  - Preload bridge exposes explicit methods only: no generic IPC.

- [x] **Step 2: Run RED**
  - Run: `MAIN_TEST_FILES=test/main/workspaceContract.test.ts,test/main/workspaceBridgeSurface.test.ts npm run test:main`
  - Expected: FAIL on missing schemas/channels/bridge methods.

- [x] **Step 3: Implement contracts**
  - Add explicit channel constants for Draft ensure/read/open and recent expressions.
  - Add Zod schemas and TypeScript types.
  - Add bridge interface and preload method mapping.

- [x] **Step 4: Run GREEN**
  - Run: `MAIN_TEST_FILES=test/main/workspaceContract.test.ts,test/main/workspaceBridgeSurface.test.ts npm run test:main`
  - Expected: PASS.

## Task 3: Draft IPC Open and Protected Main Mutations

**Files:**

- Modify: `src/main/workspaceIpc.ts`
- Test: `test/main/workspaceIpc.test.ts`
- Test: `test/main/workspaceIpcRegistration.test.ts`

- [x] **Step 1: Write failing IPC tests**
  - `handleReadSystemDraftWorkspaceForTest` or equivalent ensures and returns Draft projection.
  - `handleOpenSystemDraftWorkspaceForTest` returns a normal workspace session plus `defaultMemoryId`.
  - `handleListWorkspaceMemorySpacesForTest` continues returning only normal registry spaces.
  - `handleUpdateMemorySpaceTitleForTest` rejects protected Draft workspace rename.
  - `handleRemoveMemorySpaceForTest` rejects protected Draft workspace remove.
  - `handleUpdateMemoryTitleForTest` rejects protected default Draft Memory rename.
  - `handleDeleteMemoryForTest` rejects protected default Draft Memory delete.

- [x] **Step 2: Run RED**
  - Run: `MAIN_TEST_FILES=test/main/workspaceIpc.test.ts,test/main/workspaceIpcRegistration.test.ts npm run test:main`
  - Expected: FAIL on missing handlers/protection.

- [x] **Step 3: Implement IPC**
  - Add for-test handler exports matching existing IPC test conventions.
  - Add registration for new channels.
  - Integrate system Draft helper with handle store and existing `persistAndRegisterWorkspaceSession`/open flow.
  - Enforce protected operations in main before filesystem mutation.
  - Preserve read-only entity actions for Draft root where resolver can safely resolve it.

- [x] **Step 4: Run GREEN**
  - Run: `MAIN_TEST_FILES=test/main/workspaceIpc.test.ts,test/main/workspaceIpcRegistration.test.ts npm run test:main`
  - Expected: PASS.

## Task 4: Recent Expression Main Read Model

**Files:**

- Create or modify: `src/main/recentExpressions.ts`
- Modify: `src/main/workspaceIpc.ts`
- Test: `test/main/recentExpressions.test.ts` or focused additions in `test/main/workspaceIpc.test.ts`

- [x] **Step 1: Write failing tests**
  - Feed includes finalized Segment rows from Draft and a registered normal workspace.
  - Feed includes SegmentSupplement rows with parent identity.
  - Feed excludes Widgets, trash, and unfinalized drafts.
  - Missing/locked/corrupt inactive spaces are skipped with redacted summary and no raw paths.
  - Rows sort by `updatedAt`, then `createdAt`, newest first.

- [x] **Step 2: Run RED**
  - Run: `MAIN_TEST_FILES=test/main/recentExpressions.test.ts,test/main/workspaceIpc.test.ts npm run test:main`
  - Expected: FAIL on missing feed implementation.

- [x] **Step 3: Implement feed**
  - Use main-only roots from system Draft helper and memory-space registry.
  - Use active handle when available; use temporary bounded open/read for inactive spaces.
  - Read only bounded Markdown/projection data needed for rows.
  - Return partial result plus redacted skipped counts/reasons.

- [x] **Step 4: Run GREEN**
  - Run: `MAIN_TEST_FILES=test/main/recentExpressions.test.ts,test/main/workspaceIpc.test.ts npm run test:main`
  - Expected: PASS.

## Task 5: Renderer Queries and Sidebar/Home Routing

**Files:**

- Modify: `src/renderer/src/workspace/workspaceApi.ts`
- Modify: `src/renderer/src/workspace/workspaceQueries.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/app-shell/AppShell.tsx`
- Test: `src/renderer/src/App.test.tsx`
- Test: `src/renderer/src/app-shell/AppShell.test.tsx`

- [x] **Step 1: Write failing renderer tests**
  - AppShell renders top-level order `首页`, `画廊`, `草稿`, then `记忆空间`.
  - Draft is not rendered as a normal memory-space list entry.
  - Clicking Draft calls the App owner and opens the system Draft workspace.
  - Home `写下来` opens the note flow for defaultMemoryId over Home and switches to Draft only after save.
  - Home `录下来` opens the recording flow for defaultMemoryId over Home and switches to Draft only after finalize.
  - Home `造出来` copies artifact prompt for defaultMemoryId without leaving Home.
  - Existing flow blockers still prevent Draft/Home action navigation.

- [x] **Step 2: Run RED**
  - Run: `npm run test:renderer:quick -- src/renderer/src/App.test.tsx src/renderer/src/app-shell/AppShell.test.tsx`
  - If the runner does not accept file args, run the repo's supported scoped renderer command from `scripts/run-renderer-tests.mjs`.
  - Expected: FAIL on missing Draft routing.

- [x] **Step 3: Implement renderer routing**
  - Add workspace API wrappers and query options.
  - Add Draft system projection to App state/query.
  - Add `openSystemDraftWorkspace` flow that reuses release/replacement helpers.
  - Pass `onDraft` to AppShell when Draft is available.
  - Wire Home action callbacks to open Draft then call existing note/record/artifact flows.

- [x] **Step 4: Run GREEN**
  - Run focused renderer tests.
  - Expected: PASS.

## Task 6: Home Recent Feed UI and Focus Navigation

**Files:**

- Modify: `src/renderer/src/workspace/WorkspaceStarterHome.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/workspace/MemoryStudio.tsx` only if supplement tab focus cannot be expressed with existing focus intent.
- Test: `src/renderer/src/workspace/WorkspaceStarterHome.test.tsx`
- Test: `src/renderer/src/App.test.tsx`

- [x] **Step 1: Write failing tests**
  - Home renders loading, empty, partial-error, and populated recent feed states.
  - Segment row click opens source workspace and focuses Segment.
  - SegmentSupplement row click opens source workspace and focuses supplement tab.
  - Static fixture rows are no longer the default data source.

- [x] **Step 2: Run RED**
  - Run focused renderer tests.
  - Expected: FAIL on missing real feed behavior.

- [x] **Step 3: Implement feed UI**
  - Use TanStack Query `queryOptions` for app-scoped feed.
  - Keep restored four-tile layout and lower `近期表达` block.
  - Use semantic tokens for light/dark.
  - Keep `拍下来` disabled.
  - Add accessible row labels including source workspace/memory context.

- [x] **Step 4: Run GREEN**
  - Run focused renderer tests.
  - Expected: PASS.

## Task 7: Current Docs and Final Verification

**Files:**

- Modify only if stable facts changed: `docs/current/data.md`, `docs/current/electron.md`, `docs/current/flow.md`, `docs/current/frontend.md`

- [x] **Step 1: Update current docs narrowly**
  - Add only stable system Draft, protected role, IPC/feed, and Home routing facts that future agents need.

- [x] **Step 2: Run focused suites**
  - Main: `MAIN_TEST_FILES=test/main/systemDraftWorkspace.test.ts,test/main/recentExpressions.test.ts,test/main/workspaceIpc.test.ts,test/main/workspaceContract.test.ts,test/main/workspaceBridgeSurface.test.ts,test/main/workspaceIpcRegistration.test.ts npm run test:main`
  - Renderer: run focused renderer tests touched by this work.
  - Typecheck: `npm run typecheck:quick`
  - Format check: `npm run format:check`

- [x] **Step 3: Runtime visual verification**
  - Start dev server or Electron runtime as appropriate.
  - Inspect Home in light and dark mode.
  - Inspect Home with no imported normal spaces.
  - Inspect Draft available state and recent-feed partial-error state if test setup supports it.

- [x] **Step 4: Final gate**
  - Run: `npm run verify:quick`
  - Expected: PASS before declaring the implementation clean.

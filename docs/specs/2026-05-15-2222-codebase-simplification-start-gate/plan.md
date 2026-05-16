# Codebase Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `writing-plans` before changing this plan and use an execution workflow task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce repeated filesystem transaction mechanics and renderer entity action wiring without changing Reo behavior.

**Architecture:** Extract only the workspace directory transaction primitives that already exist in multiple main-process files, then migrate callers in narrow batches. For renderer entity actions, keep state ownership in existing components and move only read-only shell action binding behind typed workspace API wrappers.

**Tech Stack:** Node.js fs APIs, Electron main process, React 19, TypeScript, shadcn/ui, Radix DropdownMenu, Sonner toast, Node test runner, Vitest.

---

## File Structure

- Create: `src/main/workspaceDirectoryTransactions.ts`
  - Owns validated current-directory critical sections, best-effort directory fsync, known-directory file open/remove/read helpers, and empty/tree directory cleanup helpers.
- Modify: `src/main/atomicWorkspaceFile.ts`
  - Consumes shared helper for current-directory fsync, no-replace temp open, temp removal and commit critical section.
- Modify: `src/main/recordingDrafts.ts`
  - Consumes shared helper for draft directory create/open/read/remove operations.
- Modify: `src/main/memoryFiles.ts`
  - Later consumes shared helper for finalized file copy, marker cleanup, safe directory remove and empty directory remove.
- Modify: `src/main/workspaceFiles.ts`
  - Later consumes shared helper for workspace root child creation and title metadata helper fsync.
- Modify: `src/main/workspaceLock.ts`
  - Later consumes shared helper only where it does not weaken lock owner identity and stale lock semantics.
- Create: `test/main/workspaceDirectoryTransactions.test.ts`
  - Focused helper tests for identity swap, unsafe path rejection and best-effort fsync behavior.
- Modify: `src/renderer/src/workspace/workspaceApi.ts`
  - Adds narrow typed wrappers for open/reveal/copy entity shell actions.
- Create: `src/renderer/src/workspace/entityActionBindings.ts`
  - Maps entity action identity to `EntityActionMenu` read-only shell handlers through `workspaceApi.ts`.
- Modify: `src/renderer/src/workspace/*ActionsMenu.tsx`
  - Four wrappers consume action bindings while keeping rename/delete/remove callbacks local.
- Create or modify: `src/renderer/src/workspace/entityActionBindings.test.tsx`
  - Verifies action mapping without changing toast ownership.
- Modify as needed: `docs/current/flow.md`, `docs/current/frontend.md`, `docs/current/quality.md`
  - Only after implementation changes project-level current facts.

## Task 1: Filesystem Helper Skeleton And First Consumers

**Files:**

- Create: `src/main/workspaceDirectoryTransactions.ts`
- Create: `test/main/workspaceDirectoryTransactions.test.ts`
- Modify: `src/main/atomicWorkspaceFile.ts`
- Modify: `src/main/recordingDrafts.ts`
- Modify if current fact changes: `docs/current/flow.md`, `docs/current/quality.md`

- [ ] **Step 1: Write focused RED tests**

Cover helper behavior before migration:

- running a sync critical section rejects parent identity replacement.
- opening no-replace file rejects existing leaf and symlink leaf.
- removing a file in a known directory does not run after parent identity changes.
- best-effort directory fsync ignores only the currently allowed unsupported fsync codes.

Run:

```bash
npm run test:main -- --test-name-pattern='workspace directory transaction'
```

Expected: FAIL because `workspaceDirectoryTransactions.ts` does not exist.

- [ ] **Step 2: Implement minimal helper**

Add only primitives needed by `atomicWorkspaceFile.ts` and `recordingDrafts.ts`:

- `fsyncCurrentWorkspaceDirectoryBestEffort`
- `runInWorkspaceDirectorySync`
- `openNoReplaceWorkspaceFileInDirectory`
- `openExistingWorkspaceFileInDirectory`
- `removeWorkspaceFileInDirectory`
- `readWorkspaceDirectoryEntriesInDirectory`

Do not add rename helpers in this task.

- [ ] **Step 3: Run RED target to GREEN**

```bash
npm run test:main -- --test-name-pattern='workspace directory transaction'
```

Expected: PASS.

- [ ] **Step 4: Migrate first consumers**

Replace duplicated helper logic in:

- `src/main/atomicWorkspaceFile.ts`
- `src/main/recordingDrafts.ts`

Keep existing exported APIs unchanged.

- [ ] **Step 5: Run protection tests**

```bash
npm run test:main -- --test-name-pattern='atomic workspace writes|recording draft'
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Simplification review**

Remove duplicate local helpers only after all call sites in this task compile. Do not migrate `memoryFiles.ts` yet.

- [ ] **Step 7: Full gate**

```bash
npm run verify:quick
```

Expected: PASS.

## Task 2: Memory File Safe Directory Operations

**Files:**

- Modify: `src/main/workspaceDirectoryTransactions.ts`
- Modify: `src/main/memoryFiles.ts`
- Modify: `test/main/memoryFiles.test.ts`
- Modify if current fact changes: `docs/current/flow.md`

- [ ] **Step 1: Write RED tests for migrated memory file behaviors**

Use existing memory file test patterns to prove:

- copy from draft to staging still rejects source directory swap.
- cleanup still refuses unsafe symlink parent.
- empty metadata-less memory cleanup still preserves late `memory.md` payload.
- recursive cleanup still requires validated workspace containment.

Run targeted tests and expect failure only after replacing local helper references with missing shared helper names.

- [ ] **Step 2: Extend helper minimally**

Add only capabilities needed by memory file cleanup/copy:

- safe tree directory remove with optional allow-missing.
- empty directory remove.
- known-directory copy/open helpers if they remove real duplication.

Do not migrate directory rename transaction in this task.

- [ ] **Step 3: Migrate memoryFiles safe open/read/remove helper call sites**

Keep transaction marker, staging expose, rollback and recovery order unchanged.

- [ ] **Step 4: Run protection tests**

```bash
npm run test:main -- --test-name-pattern='finalize|recovery|delete Segment|restore Segment|SegmentSupplement'
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Full gate**

```bash
npm run verify:quick
```

Expected: PASS.

## Task 3: Workspace Files And Lock Helper Migration

**Files:**

- Modify: `src/main/workspaceDirectoryTransactions.ts`
- Modify: `src/main/workspaceFiles.ts`
- Modify: `src/main/workspaceLock.ts`
- Modify: `test/main/workspaceLock.test.ts`
- Modify if current fact changes: `docs/current/flow.md`

- [ ] **Step 1: Write RED tests only for newly shared helper boundary**

Do not rewrite existing lock behavior tests. Add helper-level coverage if a helper is extended for lock owner directory operations.

- [ ] **Step 2: Migrate best-effort fsync and known-directory open helpers**

Keep stale lock replacement, owner file no-follow open and lock directory identity checks in `workspaceLock.ts` unless the shared helper exactly preserves the same sequence.

- [ ] **Step 3: Run protection tests**

```bash
npm run test:main -- --test-name-pattern='workspace lock|workspace root|initializeWorkspace|openWorkspace'
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Full gate**

```bash
npm run verify:quick
```

Expected: PASS.

## Task 4: Entity Action Binding

**Files:**

- Modify: `src/renderer/src/workspace/workspaceApi.ts`
- Create: `src/renderer/src/workspace/entityActionBindings.ts`
- Create or modify: `src/renderer/src/workspace/entityActionBindings.test.tsx`
- Modify: `src/renderer/src/workspace/MemorySpaceActionsMenu.tsx`
- Modify: `src/renderer/src/workspace/MemoryActionsMenu.tsx`
- Modify: `src/renderer/src/workspace/SegmentActionsMenu.tsx`
- Modify: `src/renderer/src/workspace/SegmentSupplementActionsMenu.tsx`
- Modify if current fact changes: `docs/current/frontend.md`

- [ ] **Step 1: Write RED binding tests**

Test that each entity kind maps to the correct workspace API wrappers:

- Memory Space: open AGENTS file, reveal, copy absolute.
- Memory: open memory document, reveal, copy relative, copy absolute.
- Segment: open segment document, reveal, copy relative, copy absolute.
- SegmentSupplement: open supplement document, reveal, copy relative, copy absolute.

Run:

```bash
npm run test:renderer -- entityActionBindings
```

Expected: FAIL because binding module does not exist.

- [ ] **Step 2: Add workspace API wrappers**

Add typed wrappers in `workspaceApi.ts`; direct `window.reoWorkspace` access stays there.

- [ ] **Step 3: Add `entityActionBindings.ts`**

Return only read-only shell handlers. Do not include rename/delete/remove, because owner components still own Dialog and mutation state.

- [ ] **Step 4: Migrate four action menu wrappers**

Keep prop names and public wrapper behavior stable unless a test proves a simpler prop shape is safe.

- [ ] **Step 5: Run renderer protection tests**

```bash
npm run test:renderer -- MemorySpaceActionsMenu MemoryActionsMenu SegmentActionsMenu SegmentSupplementActionsMenu entityActionMenu entityActionBindings
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Full gate**

```bash
npm run verify:quick
```

Expected: PASS.

## Task 5: Rename Transaction Decision Gate

**Files:**

- Read: `src/main/memoryFiles.ts`
- Read: `src/main/workspaceFiles.ts`
- Read: `src/main/workspaceLock.ts`
- Modify only if justified: `src/main/workspaceDirectoryTransactions.ts`
- Modify if current fact changes: `docs/current/flow.md`

- [ ] **Step 1: Audit remaining duplicate rename transactions**

List each remaining duplicate and its unique constraints:

- same-parent staging expose.
- cross-parent memory move/trash/restore.
- workspace root rename with platform no-replace behavior.
- stale lock directory replacement.

- [ ] **Step 2: Decide migrate or keep**

Migrate only if a helper can preserve all target preflight, source identity, target identity, rollback, parent fsync and platform-specific semantics with less code.

- [ ] **Step 3: If migrate, write RED tests first**

Each migrated rename primitive must have a focused race/rollback test before implementation.

- [ ] **Step 4: If keep, document the current split**

If migration is not worth it, keep local rename helpers and document that they remain local because each one owns different transaction semantics.

- [ ] **Step 5: Full gate**

```bash
npm run verify:quick
```

Expected: PASS.

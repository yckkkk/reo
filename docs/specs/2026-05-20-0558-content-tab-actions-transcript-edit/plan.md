# Content Tab Actions And Transcript Edit Implementation Plan

**Goal:** Align Memory Studio tab actions with the Segment/Supplement object model, add primary content slot titles, and make transcript editing/clearing safe.

**Architecture:** Keep `segment.md` and `supplement.md` as the semantic source of truth. Add a feature-local primary content slot menu and transcript editor path instead of creating a generic document runtime. Extend existing IPC/file transactions and TanStack Query cache patches only where current behavior needs new persisted data.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui/Radix, TanStack Query, Zod IPC schemas, Electron main/preload IPC, Vitest.

---

## Task 1: RED menu semantics

**Files:**

- Modify tests: `src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`
- Modify tests: `src/renderer/src/workspace/SegmentActionsMenu.test.tsx`
- Create tests if useful: `src/renderer/src/workspace/SegmentContentActionsMenu.test.tsx`

- [x] Write failing renderer tests proving primary `转录/正文` tab More does not show `生成转录/重新生成转录/删除`, and does show `编辑转录|编辑正文/重命名/清空转录|清空正文`.
- [x] Write or update tests proving audio Segment card More still shows transcription generation and audio supplement tab More still shows transcription generation.
- [x] Run focused renderer tests and record expected RED failure.

## Task 2: GREEN primary slot menu

**Files:**

- Create: `src/renderer/src/workspace/SegmentContentActionsMenu.tsx`
- Modify: `src/renderer/src/workspace/MemoryStudio.tsx`
- Test: renderer focused tests from Task 1

- [x] Implement `SegmentContentActionsMenu` as a feature-local menu reusing entity open/reveal/copy bindings but exposing slot actions only.
- [x] Replace primary content tab `SegmentActionsMenu` usage with `SegmentContentActionsMenu`.
- [x] Keep `SegmentActionsMenu` on horizontal cards and `SegmentSupplementActionsMenu` on supplement tabs.
- [x] Run focused renderer tests and make Task 1 green.

## Task 3: RED/GREEN content title projection

**Files:**

- Modify: `src/main/workspaceMarkdownObjects.ts`
- Modify: `src/main/memoryFiles.ts`
- Modify: `src/workspace-contract/workspace-contract.ts`
- Modify tests: relevant main projection tests and renderer projection tests

- [x] Write failing tests for optional `content_title` in `segment.md` projecting as `contentTitle` on audio and note Segment projections.
- [x] Implement schema/projection support with default UI fallback staying in renderer.
- [x] Run focused main and renderer tests.

## Task 4: RED/GREEN content title update IPC

**Files:**

- Modify: `src/workspace-contract/workspace-channels.ts`
- Modify: `src/workspace-contract/workspace-contract.ts`
- Modify: `src/workspace-contract/reo-workspace-bridge.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/workspaceIpc.ts`
- Modify: `src/main/memoryFiles.ts`
- Modify: `src/renderer/src/workspace/workspaceApi.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify tests: main IPC tests and renderer App tests

- [x] Write failing tests for `workspace:updateSegmentContentTitle`.
- [x] Implement main file write that updates only `segment.md` frontmatter `content_title`.
- [x] Implement renderer optimistic patch with stale-session guards.
- [x] Run focused tests.

## Task 5: RED/GREEN transcript baseline hash

**Files:**

- Modify: `src/workspace-contract/workspace-contract.ts`
- Modify: `src/main/recordingDrafts.ts`
- Modify: `src/main/workspaceIpc.ts`
- Modify: `src/renderer/src/workspace/workspaceApi.ts`
- Modify tests: main transcript read/save tests and renderer query tests

- [x] Write failing tests that audio Segment and audio SegmentSupplement content reads return `transcript.baselineHash`.
- [x] Write failing tests that user-initiated transcript save with stale `baselineTranscriptHash` refuses to overwrite.
- [x] Implement baseline hash in read responses and optional baseline guard in save requests.
- [x] Run focused tests.

## Task 6: RED/GREEN transcript editor and clear actions

**Files:**

- Create: `src/renderer/src/workspace/TranscriptEditorOverlay.tsx`
- Create: `src/renderer/src/workspace/TranscriptEditorOverlay.test.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/workspace/MemoryStudio.tsx`
- Modify tests: `src/renderer/src/App.test.tsx`, `src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`

- [x] Write failing tests for opening transcript editor, dirty close confirmation, successful save, stale conflict, and clear transcript.
- [x] Implement transcript editor overlay using baseline hash and exact query patching.
- [x] Implement clear transcript/body confirm flows.
- [x] Run focused renderer tests.

## Task 7: RED/GREEN regenerate copy and title preservation

**Files:**

- Modify: `src/renderer/src/workspace/MemoryStudio.tsx`
- Modify tests: `src/renderer/src/App.test.tsx`, `src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`

- [x] Write failing tests that regenerate confirmation says it replaces正文 and does not change the transcript name.
- [x] Ensure regenerate success patches transcript body without changing `contentTitle`.
- [x] Run focused renderer tests.

## Task 8: Docs and verification

**Files:**

- Modify: `docs/current/data.md`
- Modify: `docs/current/flow.md`
- Modify: `docs/current/frontend.md`
- Modify: `docs/current/product.md`

- [x] Sync current truth only, with no history narration.
- [x] Run `npm run verify:quick`.
- [x] Run `git diff --check`.

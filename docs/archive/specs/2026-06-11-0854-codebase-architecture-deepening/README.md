# Codebase Architecture Deepening

Timezone: America/Los_Angeles

## Objective

Improve Reo architecture in priority order, one verifiable slice at a time. Each slice must keep names and directories clear for agent navigation, avoid unnecessary fragmentation, and close with targeted verification, `$review`, and `$ycksimplify`.

## Session Priorities

1. Workspace file-truth convergence.
2. Workspace IPC capability registration.
3. Renderer projection transactions.
4. Recording capture session.
5. Runtime-object hosting.

## Slice 1: Workspace File-Truth Convergence

## Scope

- Keep the current public contract unchanged.
- Keep `openWorkspaceFiles` responsible for open-only setup: target validation, managed directory creation, managed agent config repair, and recording finalize recovery.
- Keep `readWorkspaceSnapshotFromFileTruth` responsible for active snapshot refresh and passive Tiptap sidecar reconcile.
- Consolidate the shared file-truth convergence sequence:
  - repair workspace title metadata mirror from the root folder basename at the caller's existing failure boundary
  - rebuild the workspace read model
  - reconcile or rebuild `.reo/index.json`
  - read Workspace Widget projections
  - write or clear needs-review report
  - build the Workspace snapshot projection

## Design

Add a single helper in `src/main/workspaceFiles.ts` named after the product behavior it owns. Do not create a new directory or scatter this behavior across helper files.

The helper should make the call sites read as product flow:

- open workspace setup
- converge snapshot from file truth
- return ready snapshot

It should preserve the current differences between open and refresh. Open should not enable passive Tiptap sidecar reconcile. File-truth refresh should enable passive reconcile.

It should also preserve title mirror timing. Open currently repairs the mirror after read model and index convergence succeed. Snapshot refresh currently repairs the mirror before passive sidecar reconcile.

## TDD Decision

This is a behavior-preserving refactor of an existing filesystem/recovery path. No new public contract or behavior is introduced, so no new RED test is added. Existing focused main tests already protect the relevant behavior: open, file-truth refresh, stale index reconciliation, root title mirror repair, sidecar reconcile, needs-review report writing, and Widget projection.

## Success Criteria

- `openWorkspaceFiles` and `readWorkspaceSnapshotFromFileTruth` no longer duplicate the convergence sequence.
- Function and option names are clear enough for an agent to understand without following many files.
- No new speculative abstraction, directory, or generic runtime is introduced.
- Existing focused tests pass before and after the refactor.

## Verification

Baseline before implementation:

```bash
MAIN_TEST_FILES=test/main/workspaceFiles.test.ts,test/main/workspaceWidgets.test.ts npm run test:main
```

Result: pass, 81 tests.

After implementation:

```bash
MAIN_TEST_FILES=test/main/workspaceFiles.test.ts,test/main/workspaceWidgets.test.ts npm run test:main
```

Result: pass, 81 tests.

After review timing fix:

```bash
MAIN_TEST_FILES=test/main/workspaceFiles.test.ts,test/main/workspaceWidgets.test.ts npm run test:main
```

Result: pass, 81 tests.

After `$ycksimplify` mode fix:

```bash
MAIN_TEST_FILES=test/main/workspaceFiles.test.ts,test/main/workspaceWidgets.test.ts npm run test:main
```

Result: pass, 81 tests.

## Review

`$review` scoped to the current uncommitted slice found one behavior-preservation issue: the first helper version added an extra `assertWorkspaceUsable` check to the snapshot refresh path after index reconciliation. The helper now preserves the original open and refresh assert timing.

`$ycksimplify` found one quality issue: the first helper exposed title mirror timing and passive sidecar reconcile as independent options even though only two product modes are valid. The helper now accepts `workspace-open` or `file-truth-refresh` and derives internal sequencing from that mode.

## Slice 2: Workspace IPC Capability Registration

## Scope

- Keep every workspace IPC channel explicit.
- Keep preload, contract schemas, handler behavior, diagnostics, sender validation, and side effects unchanged.
- Do not split registration into new files or directories.
- Reduce registration noise so each channel call site foregrounds only its capability-specific dependencies.

## Design

Create local registration context objects inside `registerWorkspaceIpc`:

- `workspaceIpcBaseOptions` for sender trust context: `expectedSession`, `expectedSessionKey`, and `isTrustedUrl`.
- `workspaceIpcAppDataOptions` for optional app data root propagation.

Use those objects only in the registration block. Do not hide channel names, schemas, handler names, `handleStore`, `memorySpaceRegistry`, runtime queues, watcher hooks, or after-success side effects.

## TDD Decision

This is a behavior-preserving registration refactor. No public IPC contract, schema, preload method, sender validation rule, or handler behavior changes. Existing focused main tests protect the relevant behavior and channel surface.

## Success Criteria

- `registerWorkspaceIpc` no longer repeats the sender trust triple at every channel call site.
- App-data scoped channels use one clearly named local options object.
- Channel registration remains explicit and searchable by channel constant.
- No new generic command bus, runtime, or registration directory is introduced.

## Verification

Baseline before implementation:

```bash
MAIN_TEST_FILES=test/main/workspaceIpc.test.ts,test/main/workspaceBridgeSurface.test.ts,test/main/workspaceContract.test.ts npm run test:main
```

Result: pass, 311 tests.

After implementation:

```bash
MAIN_TEST_FILES=test/main/workspaceIpc.test.ts,test/main/workspaceBridgeSurface.test.ts,test/main/workspaceContract.test.ts npm run test:main
```

Result: pass, 311 tests.

After `$review` and `$ycksimplify`:

```bash
MAIN_TEST_FILES=test/main/workspaceIpc.test.ts,test/main/workspaceBridgeSurface.test.ts,test/main/workspaceContract.test.ts npm run test:main
```

Result: pass, 311 tests.

## Review

`$review` scoped to the current Slice 2 diff found no issues. Registration count stayed at 118 channels, and app-data propagation stayed equivalent to the original registration call sites.

`$ycksimplify` ran reuse, quality, and efficiency checks against the Slice 2 diff. All three returned no findings.

## Slice 3: Renderer Projection Transactions

## Scope

- Keep current UI behavior, visual behavior, query keys, and renderer bridge calls unchanged.
- Keep `App.tsx` as the owner of workflow-specific side effects such as focus intent, toast, dialog close, and route changes.
- Do not introduce a generic command bus, global store, or new directory.
- Consolidate only the repeated renderer projection write sequence shared by simple success paths:
  - update the Workspace snapshot query cache
  - optionally update the Memory detail query cache when a Segment projection is available
  - update the active `WorkspaceSession` state if it still matches the mutation session

## Design

Add a local helper inside `App` named for the product behavior it owns: applying a Memory projection transaction to the renderer state. The helper should accept the mutation session, updated Memory summary, and optional Segment projection. Callers keep their own workflow-specific decisions around selection, focus, toast, invalidation, and optimistic rollback.

This intentionally does not move code into a new file yet. The first deepening step should reduce duplicate renderer projection mechanics while preserving locality for the workflows that still live in `App.tsx`.

## TDD Decision

This is a behavior-preserving renderer refactor. No public workflow, IPC contract, query key, or UI state model changes. Existing focused renderer tests cover the projection query helpers and key workspace UI flows; this slice uses those plus typecheck rather than adding a RED test for unchanged behavior.

## Success Criteria

- Repeated snapshot/detail/session projection writes in simple success paths call one helper.
- Workflow-specific effects remain visible at each caller.
- Optimistic update and rollback paths are left unchanged unless they exactly match the helper contract.
- Existing focused renderer tests pass after the refactor.

## Verification

After implementation:

```bash
npm run typecheck
```

Result: pass.

```bash
npm run test:renderer -- src/renderer/src/workspace/workspaceQueries.test.ts src/renderer/src/devWorkspaceScenario.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/MemoryStudioSegmentCard.test.tsx
```

Result: pass, 110 tests.

```bash
npm run test:renderer -- src/renderer/src/App.test.tsx
```

Result: pass, 170 tests.

After review ordering fix:

```bash
npm run typecheck
```

Result: pass.

```bash
npm run test:renderer -- src/renderer/src/App.test.tsx
```

Result: pass, 170 tests.

## Review

`$review` scoped to the current Slice 3 diff found one behavior-preservation issue: the first helper version moved some active session state updates before existing selection and focus updates. The helper now accepts `beforeSessionUpdate` so callers preserve the original query cache, workflow state, and session update ordering.

`$ycksimplify` ran reuse, quality, and efficiency checks against the Slice 3 diff. All three returned no findings.

## Slice 4: Recording Capture Session Model

## Scope

- Keep recording UI behavior, animation, media adapter behavior, IPC calls, and transcription runtime behavior unchanged.
- Keep `RecordingOverlay.tsx` responsible for React workflow state, side effects, bridge calls, toasts, recovery writes, and media controller orchestration.
- Move only capture-session model helpers out of `RecordingOverlay.tsx`:
  - captured durable audio chunk and PCM chunk types
  - recording session id parsing
  - bounded waveform sample compaction
  - replacement and draft playback start-time resolution
  - retained PCM chunk trimming through a replacement cursor

## Design

Create `src/renderer/src/workspace/recording/recordingCaptureModel.ts` as the owner for capture-session model logic with no React, bridge, or media-device imports. This keeps recording-specific code under the existing `workspace/recording` owner instead of adding a generic utility directory.

`RecordingOverlay.tsx` should import those model helpers and continue to own all workflow effects. The new model module must not import React, query, workspace bridge functions, media controller APIs, or UI components. The waveform helper intentionally mutates the caller-owned sample buffer in place to preserve the existing hot-path behavior.

## TDD Decision

This is a behavior-preserving extraction of capture model helpers. Existing overlay and media adapter tests cover the runtime flow, and a focused capture model characterization test now protects the extracted model logic.

## Success Criteria

- `RecordingOverlay.tsx` no longer defines capture-session math/helper functions inline.
- The new file name and location make the capture model obvious to an agent scanning `workspace/recording`.
- No new renderer state owner, global store, or recording workflow split is introduced.
- Focused typecheck and recording tests pass.

## Verification

After implementation:

```bash
npm run typecheck
```

Result: pass.

```bash
npm run test:renderer -- src/renderer/src/workspace/recording/recordingCaptureModel.test.ts src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/mediaRecorderAdapter.test.ts src/renderer/src/workspace/recording/recordingTimeline.test.ts
```

Result: pass, 114 tests.

After review test allowlist fix:

```bash
npm run test:renderer -- src/renderer/src/workspace/recording/recordingCaptureModel.test.ts
```

Result: pass, 4 tests.

After `$ycksimplify` quality fix:

```bash
npm run test:renderer -- src/renderer/src/workspace/recording/recordingCaptureModel.test.ts
```

Result: pass, 5 tests.

```bash
npm run typecheck
```

Result: pass.

```bash
npm run test:renderer -- src/renderer/src/workspace/recording/recordingCaptureModel.test.ts src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/mediaRecorderAdapter.test.ts src/renderer/src/workspace/recording/recordingTimeline.test.ts
```

Result: pass, 115 tests.

```bash
npm run test:renderer -- src/renderer/src/workspace/recording/recordingCaptureModel.test.ts src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/mediaRecorderAdapter.test.ts src/renderer/src/workspace/recording/recordingTimeline.test.ts
```

Result: pass, 114 tests.

```bash
npm run test:renderer -- src/renderer/src/workspace/recording/recordingTimeline.test.ts
```

Result: pass, 6 tests.

## Review

`$review` scoped to the current Slice 4 diff found one verification issue: the new capture model test was not listed in the renderer-node Vitest project, so the initial grouped renderer command did not execute it. `vitest.config.ts` now includes `recordingCaptureModel.test.ts`, and the test runs both standalone and in the recording focused suite.

`$ycksimplify` reuse and efficiency checks returned no findings. The quality check found two issues: the capture model test did not cover waveform buffer compaction, and the spec described all moved helpers as pure even though the waveform helper intentionally mutates a caller-owned buffer. The test now covers waveform compaction, and the spec now describes the module as capture-session model logic with no React, bridge, or media-device imports.

## Slice 5: Runtime-Object Hosting

## Scope

- Keep artifact, Segment Supplement, Workspace Widget, and Home Component runtime URLs, CSP, MIME handling, cache policy, byte caps, bridge behavior, and state writes unchanged.
- Keep `artifactProtocol.ts` responsible for URL parsing, vendor assets, MIME/CSP response shape, and safe file reads.
- Keep runtime bundle directory ownership in `artifactRuntimeTarget.ts`, the existing module named for runtime targets.
- Do not create a generic runtime directory, new host abstraction, or compatibility layer.

## Design

Add one protocol-facing directory resolver to `src/main/artifactRuntimeTarget.ts`. The resolver should accept the parsed non-vendor artifact URL target and return the runtime bundle directory for Segment, Segment Supplement, Workspace Widget, or Home Component targets.

`src/main/artifactProtocol.ts` should stop duplicating the target-kind directory switch and call the resolver after it validates the active workspace root or app-data root required by the parsed target.

Because existing protocol tests cover Segment, Supplement, and Home Component but not Widget, add a focused Widget protocol test before the refactor. This protects the runtime-object hosting surface that would otherwise be changed without direct coverage.

## TDD Decision

This is a behavior-preserving main-process refactor inside an existing protocol/runtime boundary. It touches runtime object hosting for multiple product object types, so a focused Widget protocol regression test is added before implementation. No broad E2E test is needed because the changed behavior is fully inside URL-to-directory resolution and safe file reads.

## Success Criteria

- Runtime object directory resolution for Segment, Segment Supplement, Workspace Widget, and Home Component is owned by `artifactRuntimeTarget.ts`.
- `artifactProtocol.ts` reads as protocol handling rather than product-object directory dispatch.
- Widget runtime protocol entry and asset reads have direct test coverage.
- Focused artifact runtime/protocol tests pass.

## Verification

Widget protocol regression before refactor:

```bash
MAIN_TEST_FILES=test/main/artifactProtocol.test.ts npm run test:main
```

Result: pass, 12 tests.

After implementation:

```bash
MAIN_TEST_FILES=test/main/artifactProtocol.test.ts npm run test:main
```

Result: pass, 12 tests.

After review root-resolution boundary fix:

```bash
MAIN_TEST_FILES=test/main/artifactRuntimeIpc.test.ts,test/main/artifactProtocol.test.ts,test/main/artifactRuntimePreview.test.ts,test/main/artifactRuntimeState.test.ts,test/main/workspaceWidgets.test.ts npm run test:main
```

Result: pass, 31 tests.

```bash
npm run typecheck
```

Result: pass.

## Review

`$review` scoped to the current Slice 5 diff found one behavior-preservation issue: the first refactor put `resolveArtifactRoot` inside the protocol catch block. The workspace root lookup is now back outside the catch boundary, preserving the original failure behavior while runtime directory resolution is centralized.

`$ycksimplify` quality and efficiency checks returned no findings. The reuse check found that the first `resolveArtifactRuntimeProtocolTargetDirectory` version repeated product-object directory dispatch already owned by `resolveArtifactRuntimeTargetDirectory`. `artifactRuntimeTarget.ts` now has one private runtime-target directory resolver that returns directory plus manifest-owner metadata; the state IPC resolver keeps the memory/parent checks, and the protocol resolver adapts URL targets into the same resolver.

After `$ycksimplify` reuse fix:

```bash
MAIN_TEST_FILES=test/main/artifactRuntimeIpc.test.ts,test/main/artifactProtocol.test.ts,test/main/artifactRuntimePreview.test.ts,test/main/artifactRuntimeState.test.ts,test/main/workspaceWidgets.test.ts npm run test:main
```

Result: pass, 31 tests.

```bash
npm run typecheck
```

Result: pass.

```bash
git diff --check -- src/main/artifactRuntimeTarget.ts src/main/artifactProtocol.ts test/main/artifactProtocol.test.ts docs/specs/2026-06-11-0854-codebase-architecture-deepening/README.md
```

Result: pass, no output.

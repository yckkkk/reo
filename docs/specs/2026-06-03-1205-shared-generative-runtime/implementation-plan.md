# Shared Generative Runtime M2.1 Implementation Plan

> For agentic workers: implement task-by-task with focused RED/GREEN evidence. This plan uses Reo repo paths and overrides generic `docs/superpowers/*` plan locations.

**Goal:** Replace the M1 static artifact preview contract with the smallest coherent Shared Generative Runtime vertical slice for works.

**Architecture:** Keep the existing `artifact` Segment/Supplement entity and `reo-artifact` privileged custom protocol. Change the runtime contract under that protocol to per-object origins and a bundle layout (`entry.html`, `runtime.json`, `state.json`, `assets/`), while preserving iframe isolation from the Reo renderer and the existing file-truth refresh model.

**Current Slice:** M2.1 covers bundle recognition, protocol loading, iframe container capability, and managed agent skills/scripts. It does not yet implement secret values, `window.reo` product mutations, component mount UI, or popup/window-open policy changes.

---

## Success Criteria

- Artifact Segment and SegmentSupplement file truth recognizes `entry.html` as the entry.
- Existing manifest projection still uses only entry byte length/hash, so `state.json` edits do not reorder Memories or force manifest churn.
- Memory detail `previewVersion` reflects the runtime bundle files Reo serves (`entry.html`, `runtime.json`, `state.json`, direct `assets/` files), so external agent edits reload the artifact iframe.
- `reo-artifact` URLs use a per-object host plus path identity, giving each work its own browser origin.
- Protocol serves only:
  - `entry.html`
  - `runtime.json`
  - `state.json`
  - direct files under `assets/`
  - managed vendor files under `reo-artifact://vendor/...`
- Runtime CSP allows normal Web resources and network (`http`, `https`, `ws`, `wss`) without allowing `file:`.
- Artifact iframe allows scripts and same-origin storage; it keeps Reo renderer/node/preload isolation.
- Managed Reo works skills describe the new bundle and do not mention the external reference project.
- Focused tests cover protocol parsing/containment, file-truth projection, renderer iframe URL/sandbox, app protocol CSP wiring, and managed skill generation.

## Task 1 - Runtime URL And Protocol

**Files:**

- Modify `src/main/artifactUrl.ts`
- Modify `src/main/artifactProtocol.ts`
- Modify `test/main/artifactProtocol.test.ts`
- Modify `test/main/appProtocol.test.ts`

Steps:

- [x] RED: change/add `artifactProtocol` tests for per-object URL hosts, `entry.html`, `assets/style.css`, `runtime.json`, `state.json`, nested/traversal rejection, old `segment.html` rejection, and network-enabled CSP.
- [x] RED: run `MAIN_TEST_FILES=test/main/artifactProtocol.test.ts npm run test:main`.
- [x] GREEN: implement URL helpers and parser in `artifactUrl.ts`; preserve vendor route.
- [x] GREEN: update protocol file serving to root runtime files plus direct `assets/` files; keep no-follow and directory identity checks.
- [x] GREEN: update artifact CSP to allow Web app network and framework/CDN use without `file:`.
- [x] GREEN: update `appProtocol` assertions for the new CSP shape.
- [x] Verify: run `MAIN_TEST_FILES=test/main/artifactProtocol.test.ts,test/main/appProtocol.test.ts npm run test:main`.

## Task 2 - File Truth Projection

**Files:**

- Modify `src/main/memoryFiles.ts`
- Modify `src/main/workspaceReviewReport.ts`
- Modify `test/main/memoryFiles.test.ts`
- Modify `test/main/workspaceFiles.test.ts`

Steps:

- [x] RED: add/update workspace file tests showing artifact Segment/Supplement recognize `entry.html` and no longer accept `segment.html`/`supplement.html`.
- [x] RED: add file-truth tests showing `state.json`, `runtime.json`, and direct asset edits change `previewVersion` without changing `entryHash`.
- [x] RED: run `MAIN_TEST_FILES=test/main/workspaceFiles.test.ts npm run test:main`.
- [x] GREEN: replace entry descriptor reads with `entry.html`.
- [x] GREEN: derive `previewVersion` from the runtime bundle fingerprint while keeping manifest entry hash stable.
- [x] GREEN: update missing-entry recovery hint to `entry.html`.
- [x] Verify focused workspace file tests.

## Task 3 - Renderer Container

**Files:**

- Modify `src/renderer/src/workspace/MemoryStudio.tsx`
- Modify `src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`

Steps:

- [x] RED: update renderer tests to expect per-object runtime URLs and `sandbox` tokens with `allow-scripts allow-same-origin allow-forms allow-downloads`.
- [x] RED: run `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`.
- [x] GREEN: update URL builders and iframe sandbox.
- [x] Verify focused renderer test.

## Task 4 - Managed Skills And Scripts

**Files:**

- Modify `src/main/workspaceFiles.ts`
- Modify `test/main/workspaceFiles.test.ts`

Steps:

- [x] RED: update managed skill tests for `entry.html`, `runtime.json`, `state.json`, `assets/`, scaffold/validate references, network allowed, and no external project mention.
- [x] RED: run `MAIN_TEST_FILES=test/main/workspaceFiles.test.ts npm run test:main`.
- [x] GREEN: update `AGENTS.md` managed block, `reo-works`, `reo-works-design`, references, and doctor managed-file script constants.
- [x] GREEN: add minimal scaffold/validate script files if they fit existing managed skill generation without creating a new generic runtime framework.
- [x] Verify focused workspace file tests.

## Task 5 - Docs And Confidence Audit

**Files:**

- Modify relevant `docs/current/*`
- Update this spec with verification evidence if needed

Steps:

- [x] Update current docs only where stable contracts changed.
- [x] Run focused main and renderer tests listed above.
- [x] Run `npm run typecheck:quick`.
- [x] Run `git diff --check`.
- [x] Ask: "Do I have factual confidence in the implemented M2.1 contract?" First answer was no: Codex review exposed web subframe navigation mismatch and non-entry bundle edits not refreshing previews. Both were fixed with tests.
- [x] Run `npm run verify:quick` once before final commit/cleanliness statement.
- [ ] Commit only owned changes.

## Verification Evidence

- `codex exec -s read-only` review found that artifact CSP allowed external frames/forms while app navigation denied web subframes, and that `state.json` / `runtime.json` / `assets/*` edits could leave preview iframe URLs stale.
- Fixed web subframe navigation by allowing `http:` / `https:` subframe navigations while preserving top-level denial; covered by `test/main/securityPolicy.test.ts`.
- Fixed stale preview by deriving `previewVersion` from runtime bundle files while keeping manifest `entryHash` stable; covered by `test/main/memoryFiles.test.ts`.
- Focused pass: `MAIN_TEST_FILES=test/main/memoryFiles.test.ts,test/main/workspaceFiles.test.ts npm run test:main`.
- Focused pass: `MAIN_TEST_FILES=test/main/artifactProtocol.test.ts,test/main/securityPolicy.test.ts npm run test:main`.
- Focused pass: `MAIN_TEST_FILES=test/main/workspaceIpc.test.ts npm run test:main`.
- Focused pass: `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`.
- Focused pass: `npm run typecheck:quick`.
- Focused pass: `git diff --check`.
- Final pass: `npm run verify:quick`.
- Real memory-space dogfood: in `/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试`, directly edited the M2 dogfood artifact `state.json` and `assets/style.css`; Reo read model reported changed `previewVersion` and stable `entryHash`.

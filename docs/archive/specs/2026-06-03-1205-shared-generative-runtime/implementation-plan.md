# Shared Generative Runtime M2 Implementation Plan

> For agentic workers: implement task-by-task with focused RED/GREEN evidence. This plan uses Reo repo paths and overrides generic `docs/superpowers/*` plan locations.

**Goal:** Complete M2 Shared Generative Runtime for works, not only the M2.1 preview slice.

**Architecture:** Keep the existing `artifact` Segment/Supplement entity, `reo-artifact` privileged custom protocol, and iframe isolation. Add the smallest coherent runtime bridge: a vendor script in the artifact iframe talks to the parent Reo renderer through `postMessage`; the parent validates iframe `origin` + `source` and calls explicit `window.reoWorkspace` IPC; main process owns state file writes, safeStorage-backed secret values, prompt copy, and existing product mutations.

**Already Done:** M2.1 covers bundle recognition, protocol loading, per-object origin, iframe container capability, open ordinary Web network, external bundle edit refresh, and managed agent skills/scripts.

**Current Slice:** Complete M2 for the first consumer, works. Component mount UI remains a non-goal; components inherit the same runtime contract later.

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
- Managed Reo works skills describe the bundle, bridge, templates, state, secret, and validation flow without exposing external reference projects.
- `entry.html` can explicitly load `reo-artifact://vendor/reo-runtime/bridge.js` and receive `window.reo`.
- `window.reo.state` reads and writes `state.json` with a version/baseline contract; stale writes return the current state/version.
- `window.reo.workspace` and `window.reo.content` return current object context and current Memory detail projection without raw paths.
- `window.reo.mutations` exposes only high-frequency M2 work actions: update the current work title through existing title mutation and copy Reo-built agent prompts for broader edits.
- `window.reo.secrets` stores declared object+slot values as safeStorage ciphertext in Reo-managed userData, not in the runtime bundle; get/set/clear must re-resolve the artifact target and reject undeclared slots.
- `window.reo.ui` exposes host coordination for fullscreen request.
- `window.reo.agent` copies existing create/update prompt actions through the current prompt bridge.
- Focused tests cover protocol/vendor serving, state baseline conflict, secret persistence, bridge source/origin validation, product mutation routing, managed skill generation, and real memory-space dogfood.

## M2 Completion Tasks

### Task 6 - Runtime State And Secret IPC

**Files:**

- Add `src/main/artifactRuntimeState.ts`
- Add `src/main/artifactRuntimeSecrets.ts`
- Modify `src/workspace-contract/workspace-contract.ts`
- Modify `src/workspace-contract/workspace-channels.ts`
- Modify `src/workspace-contract/reo-workspace-bridge.ts`
- Modify `src/preload/workspaceBridge.ts`
- Modify `src/main/workspaceIpc.ts`
- Add/update focused main tests

Steps:

- [x] RED: add main tests for state read/write, missing/corrupt `state.json` fail-open default, baseline stale conflict, Segment/Supplement ownership, and oversized write rejection.
- [x] RED: add main tests for secret set/get/list/clear with object+slot binding, declared slot enforcement, no plaintext bundle write, no plaintext userData write, and secure storage unavailable failure.
- [x] GREEN: implement explicit IPC, Zod contracts, main-owned file containment, atomic baseline writes, safeStorage-backed Reo-managed secret store, and preload bridge methods.
- [x] Verify focused main tests.

### Task 7 - Vendor `window.reo` Bridge And Parent Message Router

**Files:**

- Add managed vendor file under artifact protocol package root.
- Add `src/renderer/src/workspace/artifactRuntimeBridge.ts`
- Modify `src/renderer/src/workspace/MemoryStudio.tsx`
- Modify renderer tests

Steps:

- [x] RED: test that artifact iframe message routing accepts only the expected runtime origin + iframe `contentWindow`, ignores other frames, and returns structured success/error replies.
- [x] RED: test that context/content/state/secret/agent/mutation calls route to the right existing `window.reoWorkspace` methods, and rejects artifact work note-body writes.
- [x] GREEN: serve `reo-artifact://vendor/reo-runtime/bridge.js`.
- [x] GREEN: implement lightweight parent router local to artifact previews; no preload, no raw paths, no generic filesystem bridge.
- [x] Verify focused renderer tests.

### Task 8 - Skills, Templates, Scripts, And Samples

**Files:**

- Modify `src/main/workspaceFiles.ts`
- Modify `test/main/workspaceFiles.test.ts`

Steps:

- [x] RED: update managed skill tests for `window.reo` API, bridge script import, secret slots, state baseline, templates, inspect/validate guidance, ID generation guidance, and removal of M2.1 temporary prohibitions.
- [x] GREEN: update runtime skill, works skill, design references, scaffold script, validate script, and doctor repair constants.
- [x] Verify focused workspace files tests.

### Task 9 - Current Docs And Real Runtime Dogfood

**Files:**

- Modify relevant `docs/current/*`
- Update this spec with evidence.

Steps:

- [x] Update only stable current facts: runtime bridge, state, secret, and product mutation boundary.
- [x] In `/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试`, create/update real works that exercise todo/review state, ordinary Web capability, runtime state, and Reo content/tooling bridge paths without adding product-level key/token management UI.
- [x] Verify direct external edits/replacements of `entry.html`, `state.json`, and `runtime.json` do not break Reo.
- [x] Run Codex CLI read-only review/challenge after targeted tests.
- [x] Ask the factual confidence question, fix gaps, repeat until no known unresolved gap remains.
- [x] Run `npm run verify:quick` once before commit and cleanliness statement.
- [x] Commit only owned changes.

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
- [x] Commit only owned changes.

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
- M2 focused pass: `MAIN_TEST_FILES=test/main/artifactRuntimeState.test.ts,test/main/artifactRuntimeIpc.test.ts,test/main/workspaceBridgeSurface.test.ts,test/main/workspaceIpcRegistration.test.ts,test/main/artifactProtocol.test.ts,test/main/workspaceFiles.test.ts,test/main/appLifecycleSource.test.ts npm run test:main`.
- M2 renderer focused pass: `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/artifactRuntimeBridge.test.tsx`.
- M2 renderer API focused pass: `npm run test:renderer -- --project renderer-jsdom-browser src/renderer/src/workspace/workspaceApi.test.ts`.
- M2 type pass: `npm run typecheck:quick`.
- M2 review fix: renderer bridge rejects artifact work `mutations.saveNoteBody` and no longer passes note write methods into the artifact bridge API.
- M2 review fix: secret get/set/clear re-resolve the artifact target and require a declared `runtime.json` slot before reading or writing object+slot values.
- M2 review fix: artifact runtime secrets are stored as Electron `safeStorage` ciphertext in `userData/artifact-runtime-secrets.json`; runtime bundle files and userData JSON do not contain secret plaintext.
- M2 review fix: `writeArtifactRuntimeState` rejects serialized state payloads over the same 1 MiB readable state cap.
- Real memory-space dogfood: in `/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试`, external Codex CLI created valid file-truth-only works `seg_20260604033000_d1e2f3a4--M2 CLI Todo State`, ordinary Web runtime object `seg_20260604033100_e2f3a4b5--M2 CLI Web Status`, and supplement `sup_20260604033200_f3a4b5c6--M2 CLI Reo Content Tool` under `seg_20260526013336_a2815d52--笔记2`; Reo read model projected all three and converged manifest hash/previewVersion from file truth.
- User-boundary dogfood correction: the old visible `M2 CLI Network Secret` test object in the real memory space was replaced with `seg_20260604033100_e2f3a4b5--M2 CLI Web Status`, a normal Web/status example with no token/key UI and no secret slot. `validate-runtime` passed, and Reo file-truth projection converged `entryHash` `c6afbe577fd1264e7be9f04881794709491c48649ac97525d860eb3339e9a9ee`, `previewVersion` `9f24792644166cd689050f1f3e44dd0b662184ab68cfc127e58b533904d74e89`, and manifest `updatedAt` `2026-06-04T09:41:35.889Z`.
- External replacement dogfood: directly replaced `entry.html`, `runtime.json`, and `state.json` for `seg_20260604033000_d1e2f3a4--M2 CLI Todo State`; Reo read model preserved projection, changed entry hash/previewVersion, converged manifest, and `readArtifactRuntimeState` returned the externally written JSON object.
- Codex CLI read-only review after targeted tests reported no blocker-level findings and specifically confirmed the prior `saveNoteBody`, secret target/slot, secret plaintext, oversized state, and managed skill ID findings were fixed.
- Factual confidence check: yes for the full M2 works contract. Negative searches and opened contexts confirmed old entry names only remain in rejection tests, `saveNoteBody` only remains in the runtime bridge rejection path/tests, old `seg_agent_*` examples only remain as invalid examples, and current docs/spec describe safeStorage-managed secret values rather than plaintext bundle secrets.
- Final verification first exposed one stale public-contract snapshot: `test/main/workspaceContract.test.ts` did not list the six new explicit artifact runtime IPC channels. The runtime contract already exposed them; the test snapshot and named-channel assertions were updated, then `MAIN_TEST_FILES=test/main/workspaceContract.test.ts npm run test:main` passed.
- Final pass: `npm run verify:quick` passed after the workspace contract snapshot, lint, and Prettier fixes.
- Final M2 E2E state machine: ordinary user prompt -> external agent writes visible `memories/` files -> Reo file-truth detail projection converges manifest/hash/previewVersion -> runtime state bridge reads/writes `state.json` with baseline protection -> damaged entry produces fault projection without ready preview fields -> restored entry returns to ready projection.
- Final M2 E2E invariant set: agents do not rely on `.reo` as semantic truth; `entry.html` is the only runtime entry; `state.json` accepts any JSON object; stale baseline never overwrites external edits; fault projection does not expose `entryHash`/`previewVersion`; Reo product layer provides no key/token manager UI, no permission popup, no network confirmation, and no content/quality review.
- Final M2 E2E evidence in `/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试`: ordinary prompt `帮我做一个每天打卡的小工具，打开就能点一下记今天完成了。` updated existing `seg_20260604011359_0623d928--每日打卡`; Reo projected it from file truth, wrote `.reo/objects/segments/seg_20260604011359_0623d928.json`, matched `entryHash` `093c07fe2660103cda8747f0198f90d62b0d02fc01f79c809994577654c92883`, produced `previewVersion` `1a05200ba30dc15b1b9548dc16994f54c55cc45d116e98ac7652dbe672700b38`, and repaired nonsemantic `createdAt`/`updatedAt` frontmatter back to the current Markdown contract.
- Final M2 E2E evidence: ordinary prompt `帮我在笔记2下面做一个很简单的小清单工具，列出接下来要做的事。` created supplement `sup_20260604022622_0f39c49c--下一步小清单`; validator passed; Reo parent detail projected it under `seg_20260526013336_a2815d52--笔记2`, matched `entryHash` `23a073a676c5aa57d39872045158899e2eec1b6d23a9b1fc6398226a15e2f556`, and produced `previewVersion` `0ad0b6434b9e0ae32490ccd5ad1d268a404712e00e64aa2b8d8dc685b4f1e5d3`.
- Final M2 E2E evidence: direct external replacement of that supplement changed `entryHash` from `23a073a676c5aa57d39872045158899e2eec1b6d23a9b1fc6398226a15e2f556` to `4be3d7c0bd88e1110bcaa53c8c8600cf994415e256bc850e5d078778a7340ff9`; Reo converged manifest `updatedAt` `2026-06-04T09:31:07.484Z`, produced `previewVersion` `774f0611d79d90228f986248f93eb37fdf7cefc9d3f55faec6a42fe5cacacf2b`, and `readArtifactRuntimeState` read externally written `stores.externalEdit`.
- Final M2 E2E evidence: stale state write with old baseline returned `status: stale`, current version `ae179e47dc3274eedb84be07a1f3c5bf35f69148744963a02b8fb12e0b0c2d07`, and preserved external `stores.externalAgent`; temporary missing `entry.html` returned `runtimeFault.reason: missing-entry` with no ready preview fields, then restoring `entry.html` returned to ready projection with `entryHash` `4be3d7c0bd88e1110bcaa53c8c8600cf994415e256bc850e5d078778a7340ff9`.

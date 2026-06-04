# Shared Generative Runtime M2 Implementation Plan

> For agentic workers: implement task-by-task with focused RED/GREEN evidence. This plan uses Reo repo paths and overrides generic `docs/superpowers/*` plan locations.

**Goal:** Complete M2 Shared Generative Runtime for works, not only the M2.1 preview slice.

**Architecture:** Keep the existing `artifact` Segment/Supplement entity, `reo-artifact` privileged custom protocol, and iframe isolation. Add the smallest coherent runtime bridge: a vendor script in the artifact iframe talks to the parent Reo renderer through `postMessage`; the parent validates iframe `origin` + `source` and calls explicit `window.reoWorkspace` IPC; main process owns state file writes, prompt copy, and existing product mutations. Reo does not provide a work-level key, token or hidden value store.

**Already Done:** M2.1 covers bundle recognition, protocol loading, per-object origin, iframe container capability, open ordinary Web network, external bundle edit refresh, and managed agent skills/scripts.

**Current Slice:** Complete M2 for the first consumer, works. Component mount UI remains a non-goal; components inherit the same runtime contract later. 2026-06-04 correction: M2 also requires workspace-wide read context, user-triggered work page refresh, and state writes that do not remount the host iframe.

---

## Success Criteria

- Artifact Segment and SegmentSupplement file truth recognizes `entry.html` as the entry.
- Existing manifest projection still uses only entry byte length/hash, so `state.json` edits do not reorder Memories or force manifest churn.
- Memory detail `previewVersion` reflects the host-relevant runtime bundle files Reo serves (`entry.html`, `runtime.json`, direct `assets/` files), so external entry/resource edits reload the artifact iframe; `state.json` is runtime state and does not change the host preview URL.
- `reo-artifact` URLs use a per-object host plus path identity, giving each work its own browser origin.
- Protocol serves only:
  - `entry.html`
  - `runtime.json`
  - `state.json`
  - direct files under `assets/`
  - managed vendor files under `reo-artifact://vendor/...`
- Runtime CSP allows normal Web resources and network (`http`, `https`, `ws`, `wss`) without allowing `file:`.
- Artifact iframe allows scripts and same-origin storage; it keeps Reo renderer/node/preload isolation.
- Managed Reo works skills describe the bundle, bridge, templates, state and validation flow without exposing external reference projects.
- `entry.html` can explicitly load `reo-artifact://vendor/reo-runtime/bridge.js` and receive `window.reo`.
- `window.reo.state` reads and writes `state.json` with a version/baseline contract; stale writes return the current state/version and saved writes do not remount the iframe.
- `window.reo.workspace` returns current workspace summary, all Memory summaries, target identity and current object projection; `window.reo.content` returns current object projection and can read any Memory detail in the current workspace by `memoryId` without raw paths.
- `window.reo.mutations` exposes only high-frequency M2 work actions: update the current work title through existing title mutation and copy Reo-built agent prompts for broader edits.
- Reo runtime does not expose `window.reo.secrets` or any work-level key/token/value store; works use visible files, browser storage or ordinary Web capability for their own values.
- `window.reo.ui` exposes host coordination for fullscreen request.
- `window.reo.agent` copies existing create/update prompt actions through the current prompt bridge.
- Focused tests cover protocol/vendor serving, state baseline conflict, absence of secret/value public runtime surface, bridge source/origin validation, product mutation routing, managed skill generation, and real memory-space dogfood.

## M2 Completion Tasks

### Task 6 - Runtime State IPC

**Files:**

- Add `src/main/artifactRuntimeState.ts`
- Modify `src/workspace-contract/workspace-contract.ts`
- Modify `src/workspace-contract/workspace-channels.ts`
- Modify `src/workspace-contract/reo-workspace-bridge.ts`
- Modify `src/preload/workspaceBridge.ts`
- Modify `src/main/workspaceIpc.ts`
- Add/update focused main tests

Steps:

- [x] RED: add main tests for state read/write, missing/corrupt `state.json` fail-open default, baseline stale conflict, Segment/Supplement ownership, and oversized write rejection.
- [x] RED: add main tests ensuring no artifact runtime secret/value IPC remains in the public bridge surface.
- [x] GREEN: implement explicit IPC, Zod contracts, main-owned file containment, atomic baseline writes, and preload bridge methods.
- [x] Verify focused main tests.

### Task 7 - Vendor `window.reo` Bridge And Parent Message Router

**Files:**

- Add managed vendor file under artifact protocol package root.
- Add `src/renderer/src/workspace/artifactRuntimeBridge.ts`
- Modify `src/renderer/src/workspace/MemoryStudio.tsx`
- Modify renderer tests

Steps:

- [x] RED: test that artifact iframe message routing accepts only the expected runtime origin + iframe `contentWindow`, ignores other frames, and returns structured success/error replies.
- [x] RED: test that context/content/state/agent/title-mutation calls route to the right existing `window.reoWorkspace` methods and rejects unknown `secrets.*` calls.
- [x] GREEN: serve `reo-artifact://vendor/reo-runtime/bridge.js`.
- [x] GREEN: implement lightweight parent router local to artifact previews; no preload, no raw paths, no generic filesystem bridge.
- [x] Verify focused renderer tests.

### Task 8 - Skills, Templates, Scripts, And Samples

**Files:**

- Modify `src/main/workspaceFiles.ts`
- Modify `test/main/workspaceFiles.test.ts`

Steps:

- [x] RED: update managed skill tests for `window.reo` API, bridge script import, state baseline, templates, inspect/validate guidance, ID generation guidance, and removal of M2.1 temporary prohibitions.
- [x] GREEN: update runtime skill, works skill, design references, scaffold script, validate script, and doctor repair constants.
- [x] Verify focused workspace files tests.

### Task 9 - Current Docs And Real Runtime Dogfood

**Files:**

- Modify relevant `docs/current/*`
- Update this spec with evidence.

Steps:

- [x] Update only stable current facts: runtime bridge, state, no work-level key/token/value store, and product mutation boundary.
- [x] In `/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试`, create/update real works that exercise todo/review state, ordinary Web capability, runtime state, and Reo content/tooling bridge paths without adding product-level key/token management UI.
- [x] Verify direct external edits/replacements of `entry.html`, `state.json`, and `runtime.json` do not break Reo.
- [x] Run Codex CLI read-only review/challenge after targeted tests.
- [x] Ask the factual confidence question for the current diff, fix gaps, repeat until no known unresolved gap remains.
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
- [x] RED: add file-truth tests showing `state.json` does not change `previewVersion`, while `runtime.json` and direct asset edits change `previewVersion` without changing `entryHash`.
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
- [x] Ask: "Do I have factual confidence in the implemented early preview-slice contract?" First answer was no: Codex review exposed web subframe navigation mismatch and non-entry bundle edits not refreshing previews. Both were fixed with tests.
- [x] Run `npm run verify:quick` once for the early preview-slice closeout.
- [x] Commit early preview-slice owned changes.

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
- Earlier pass: `npm run verify:quick`.
- Real memory-space dogfood: in `/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试`, directly edited the M2 dogfood artifact `state.json` and `assets/style.css`; `state.json` remained runtime state while `assets/style.css` changed host `previewVersion` with stable `entryHash`.
- M2 focused pass: `MAIN_TEST_FILES=test/main/artifactRuntimeState.test.ts,test/main/artifactRuntimeIpc.test.ts,test/main/workspaceBridgeSurface.test.ts,test/main/workspaceIpcRegistration.test.ts,test/main/artifactProtocol.test.ts,test/main/workspaceFiles.test.ts,test/main/appLifecycleSource.test.ts npm run test:main`.
- M2 renderer focused pass: `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/artifactRuntimeBridge.test.tsx`.
- M2 renderer API focused pass: `npm run test:renderer -- --project renderer-jsdom-browser src/renderer/src/workspace/workspaceApi.test.ts`.
- M2 type pass: `npm run typecheck:quick`.
- M2 review fix: renderer bridge exposes only the current grouped API surface and no longer exposes a generic note-body mutation method to artifact work.
- M2 review fix: the artifact runtime secret/object-local value bridge was removed entirely. Reo runtime no longer exposes `window.reo.secrets`, secret/value IPC channels, a preload bridge surface, or `userData/artifact-runtime-secrets.json`.
- M2 review fix: `writeArtifactRuntimeState` rejects serialized state payloads over the same 1 MiB readable state cap.
- Real memory-space dogfood: in `/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试`, external Codex CLI created valid file-truth-only works `seg_20260604033000_d1e2f3a4--M2 CLI Todo State`, ordinary Web runtime object `seg_20260604033100_e2f3a4b5--M2 CLI Web Status`, and supplement `sup_20260604033200_f3a4b5c6--M2 CLI Reo Content Tool` under `seg_20260526013336_a2815d52--笔记2`; Reo read model projected all three and converged manifest hash/previewVersion from file truth.
- User-boundary dogfood correction: the old visible `M2 CLI Network Secret` test object in the real memory space was replaced with `seg_20260604033100_e2f3a4b5--M2 CLI Web Status`, a normal Web/status example with no token/key UI and no object-local value slot. `validate-runtime` passed, and Reo file-truth projection converged `entryHash` `c6afbe577fd1264e7be9f04881794709491c48649ac97525d860eb3339e9a9ee`, `previewVersion` `9f24792644166cd689050f1f3e44dd0b662184ab68cfc127e58b533904d74e89`, and manifest `updatedAt` `2026-06-04T09:41:35.889Z`.
- External replacement dogfood: directly replaced `entry.html`, `runtime.json`, and `state.json` for `seg_20260604033000_d1e2f3a4--M2 CLI Todo State`; Reo read model preserved projection, changed entry hash/previewVersion, converged manifest, and `readArtifactRuntimeState` returned the externally written JSON object.
- Codex CLI read-only review after targeted tests reported no blocker-level findings and specifically confirmed the prior note-body mutation leak, oversized state and managed skill ID findings were fixed; the earlier object-local value path was removed rather than carried forward.
- Factual confidence check: yes for the full M2 works contract after removing the artifact secret/value bridge. Negative searches and opened contexts confirmed old entry names only remain in rejection tests, no artifact work note-body mutation API remains public, old `seg_agent_*` examples only remain as invalid examples, and current docs/spec state that Reo provides no work-level key/token/value store.
- Final verification first exposed one stale public-contract snapshot: `test/main/workspaceContract.test.ts` did not list the six new explicit artifact runtime IPC channels. The runtime contract already exposed them; the test snapshot and named-channel assertions were updated, then `MAIN_TEST_FILES=test/main/workspaceContract.test.ts npm run test:main` passed.
- Earlier final pass: `npm run verify:quick` passed after the workspace contract snapshot, lint, and Prettier fixes.
- Fresh final pass: `npm run verify:quick` passed for the current full M2 diff after hook-level cross-Memory bridge, runtime fresh-detail cache, data-panel E2E evidence, formatting and review fixes.
- Final M2 E2E state machine: ordinary user prompt -> external agent writes visible `memories/` files -> Reo file-truth detail projection converges manifest/hash/previewVersion -> runtime state bridge reads/writes `state.json` with baseline protection -> damaged entry produces fault projection without ready preview fields -> restored entry returns to ready projection.
- Final M2 E2E invariant set: agents do not rely on `.reo` as semantic truth; `entry.html` is the only runtime entry; `state.json` accepts any JSON object; stale baseline never overwrites external edits; fault projection does not expose `entryHash`/`previewVersion`; Reo product layer provides no key/token manager UI, no permission popup, no network confirmation, and no content/quality review.
- Final M2 E2E evidence in `/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试`: ordinary prompt `帮我做一个每天打卡的小工具，打开就能点一下记今天完成了。` updated existing `seg_20260604011359_0623d928--每日打卡`; Reo projected it from file truth, wrote `.reo/objects/segments/seg_20260604011359_0623d928.json`, matched `entryHash` `093c07fe2660103cda8747f0198f90d62b0d02fc01f79c809994577654c92883`, produced `previewVersion` `1a05200ba30dc15b1b9548dc16994f54c55cc45d116e98ac7652dbe672700b38`, and repaired nonsemantic `createdAt`/`updatedAt` frontmatter back to the current Markdown contract.
- Final M2 E2E evidence: ordinary prompt `帮我在笔记2下面做一个很简单的小清单工具，列出接下来要做的事。` created supplement `sup_20260604022622_0f39c49c--下一步小清单`; validator passed; Reo parent detail projected it under `seg_20260526013336_a2815d52--笔记2`, matched `entryHash` `23a073a676c5aa57d39872045158899e2eec1b6d23a9b1fc6398226a15e2f556`, and produced `previewVersion` `0ad0b6434b9e0ae32490ccd5ad1d268a404712e00e64aa2b8d8dc685b4f1e5d3`.
- Final M2 E2E evidence: direct external replacement of that supplement changed `entryHash` from `23a073a676c5aa57d39872045158899e2eec1b6d23a9b1fc6398226a15e2f556` to `4be3d7c0bd88e1110bcaa53c8c8600cf994415e256bc850e5d078778a7340ff9`; Reo converged manifest `updatedAt` `2026-06-04T09:31:07.484Z`, produced `previewVersion` `774f0611d79d90228f986248f93eb37fdf7cefc9d3f55faec6a42fe5cacacf2b`, and `readArtifactRuntimeState` read externally written `stores.externalEdit`.
- Final M2 E2E evidence: stale state write with old baseline returned `status: stale`, current version `ae179e47dc3274eedb84be07a1f3c5bf35f69148744963a02b8fb12e0b0c2d07`, and preserved external `stores.externalAgent`; temporary missing `entry.html` returned `runtimeFault.reason: missing-entry` with no ready preview fields, then restoring `entry.html` returned to ready projection with `entryHash` `4be3d7c0bd88e1110bcaa53c8c8600cf994415e256bc850e5d078778a7340ff9`.
- 2026-06-04 xhigh subagent review: design/infra review found active initiative status drift and missing real Electron evidence; ycksimplify review found default scaffold over-declared bridge needs and ambiguous token wording; E2E audit found missing prompt-copy replay, real iframe proof, style proof, `window.reo.workspace/content`, state/stale, network and cache convergence evidence. All became explicit fixes or E2E checks in this closeout.
- 2026-06-04 final judgement over `grill-decisions.md`: keep the user-owned runtime and no review/approval model, but remove `window.reo.secrets` / object-local value store entirely. Runtime prompts, scaffold defaults and current docs no longer make API token/key examples or Reo-managed hidden values part of M2.
- 2026-06-04 real dev E2E state machine: ordinary user prompt -> external agent writes only `memories/` files -> Reo opens `/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试` -> file-truth projection creates or refreshes manifests -> iframe runtime serves with current `previewVersion` -> user interaction writes visible state -> reload preserves state -> direct external edit or Reo mutation invalidates projection and converges again.
- 2026-06-04 new work prompt replay: Reo UI copied a `# 创建一个 Reo 作品片段` prompt, then external Codex CLI received only the ordinary user request `帮我做一个特别简单的喝水打卡，打开能点一下就行。` and created `segments/seg_20260604033327_c7596b95--喝水打卡` with `segment.md`, `entry.html`, `runtime.json`, `state.json` and `assets/`. Reo projected it, matched manifest `entryHash` `ce5ba081b33fa9a5c647fcc1ecd52fe2e996ab40481f341828ff9aa2394d9644`, and real iframe click persisted through reload.
- 2026-06-04 supplement prompt replay: Reo UI copied a `# 创建一个 Reo 作品补充` prompt for `seg_20260526013336_a2815d52--笔记2`, then external Codex CLI received only `帮我在这条笔记下面做一个很简单的小清单，把接下来要做的事列出来。` and created `sup_20260604034312_4ffcc3db--后续行动小清单`. Reo projected it under the parent Segment, matched manifest `entryHash` `b304631c06af0baaa20fcb1d75632257ec2b062787bc43abb6a1508188fc5dcd`, and real iframe checkbox click persisted through reload.
- 2026-06-04 style E2E: the supplement exposed a real dark-mode contrast issue because the design reference used light semantic success backgrounds in dark mode. The managed design skill, scaffold script and tests now include dark semantic overrides for info/danger/success/warning fills and text, and prompt copy says `Reo 视觉变量和参考模块` instead of ambiguous token wording.
- 2026-06-04 `window.reo` E2E: an artifact supplement called `window.reo.workspace.read()`, `window.reo.content.readCurrentObject()`, `window.reo.content.readMemoryDetail()` and `window.reo.agent.copyPrompt()`, then `window.reo.mutations.updateTitle({ title: "M2 CLI Reo Content Tool 已验证" })` renamed the owning supplement directory and Markdown frontmatter through Reo product mutation without changing runtime `entryHash`.
- 2026-06-04 state E2E: real iframe added `E2E 状态验证 1780571039804` through `window.reo.state.write`, `state.json` contained six visible items after reload, and a stale write using an old baseline returned `status: "stale"` while preserving the external marker from the direct file edit.
- 2026-06-04 Web/network E2E: the old Web status sample had invalid inline script syntax that the validator missed. A focused failing validator test was added first, then `validate-runtime.mjs` learned inline script syntax checking. The repaired real artifact fetched CORS-compatible `https://api.github.com/zen`, wrote `{ ok: true, status: 200, sample: "Design for failure." }` into `state.json`, and Reo converged the new `entryHash` `9023e9395015d42700fbd7505abd14cf5dcd888ad042db9477ad4dcf5028b77c`.
- 2026-06-04 Reo data sync E2E: a normal note supplement `sup_20260604040722_a9b8c7d6--同步验证补充` was added directly under `笔记2` without writing `.reo`; Reo UI projected the new tab, and an existing artifact content tool's `readMemoryDetail()` saw `supplementCount: 6` and the new supplement title.
- 2026-06-04 fault recovery E2E: two older M2.1 dogfood artifacts with only `segment.html` / `supplement.html` produced a real needs-review toast. They were repaired to the current bundle contract with `entry.html`, `runtime.json`, `state.json` and `assets/`; `validate-runtime` passed and `.reo/review/needs-review.json` disappeared. Final evidence JSON also records a temporary missing `entry.html` branch returning `runtimeFault.reason: "missing-entry"` with no ready preview fields, followed by restoration to the same `entryHash` and `previewVersion`.
- 2026-06-04 real dev E2E rerun: with Reo dev open on `/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试`, the copied create-work prompt plus ordinary user request `帮我做一个很简单的喝水打卡，打开以后点一下就记住今天喝了几杯。` produced the minimal work `seg_20260604052142_86bbc739--今日喝水打卡 已验证2`. Validator passed, negative search found no `window.reo.secrets`, `secrets`, `localStorage`, token or key UI, and Reo converged manifest `entryHash` `68b60aa62b1d6b38c687249f1aba9f557d94f7a63a4ba9446819e049e40e908d`.
- 2026-06-04 real dev state E2E: screenshots are stored under `docs/archive/specs/2026-06-03-1205-shared-generative-runtime/evidence/2026-06-04-real-dev-water-*.png`; iframe click changed visible count to `1`, `state.json` persisted `stores.data.days["2026-06-04"] = 1`, reload kept count `1`, and stale write returned `status: "stale"` while preserving external markers and not persisting `staleAttempt3`.
- 2026-06-04 real dev Reo data E2E: the same artifact iframe called `window.reo.workspace.read()`, `window.reo.content.readCurrentObject()` and `window.reo.content.readMemoryDetail()`; after a normal note supplement `sup_20260604053012_54909845--数据同步验证二` was written directly under `笔记2`, the iframe saw `memorySupplementCount: 17`, parent `targetSupplementCount: 7`, and the new title in the live detail projection.
- 2026-06-04 runtime title consistency fix: real `window.reo.mutations.updateTitle()` revealed that artifact Markdown directory/frontmatter changed but `runtime.json.title` could remain stale. Focused tests now cover artifact Segment and Supplement title mutations syncing runtime manifest title. Final dev rerun called `window.reo.mutations.updateTitle({ title: "三步小清单 已验证" })` from the artifact iframe target; Reo renamed the supplement directory, synced `supplement.md` and `runtime.json.title`, kept entry hash `ceafb51b70ffcdf3a0bd5cf0b879cd57e4a095f2c673684a5edb8919a7e6ab52`, and refreshed `previewVersion` to `06d0411d0683497a600b65e0bcefbb1ad52975f04fced9569258259606d40e87`.
- 2026-06-04 stable evidence files: `docs/archive/specs/2026-06-03-1205-shared-generative-runtime/evidence/2026-06-04-real-dev-m2-e2e.json` records the small-step state machine, immutable checks, actual copied prompt outputs, screenshot paths, stale result, network state output, Reo data sync result, external replacement, fault recovery, style proof, and iframe title mutation result for the real dev rerun; `docs/archive/specs/2026-06-03-1205-shared-generative-runtime/evidence/2026-06-04-m2-data-panel-e2e.json` records a copied-prompt data-panel work that reads the whole workspace, updates after external Memory file changes, preserves iframe identity for runtime state changes, uses the host tab More refresh only for explicit page remount, and proves iframe `window.reo.content.readMemoryDetail({ memoryId })` fresh-reads another Memory detail after a same-snapshot external artifact asset edit.
- 2026-06-04 supplement prompt replay rerun: the copied create-supplement prompt plus ordinary user request `帮我在这条笔记下面做一个很简单的小清单，把接下来要做的事列出来。` produced `sup_20260604060457_75e11a6e--三步小清单`, then final iframe title mutation renamed it to `sup_20260604060457_75e11a6e--三步小清单 已验证` under `笔记2`. Validator passed; Reo projected it from file truth, converged manifest `entryHash` `ceafb51b70ffcdf3a0bd5cf0b879cd57e4a095f2c673684a5edb8919a7e6ab52`, and iframe checkbox state persisted as `1 / 3 项完成` through reload via visible `state.json`.

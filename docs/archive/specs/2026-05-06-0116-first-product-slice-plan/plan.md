# First Product Slice Implementation Plan

> **For agentic workers:** Use this plan task-by-task. Do not collapse slices together unless the previous slice is verified, documented and committed. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Reo's first real product slice: local memory workspace creation, voice recording with live mock transcript, editable transcript/reflections saved as ordinary workspace files, reopen/play/edit recovery, and Codex CLI validation through workspace `AGENTS.md`.

**Architecture:** Filesystem-first workspace. Electron main owns folder selection, file writes and workspace audio reads through narrow preload/IPC. Renderer owns product UI, MediaRecorder lifecycle, mock transcript timing, autosave UX and playback. Each new foundation is activated only in the slice where its real consumer lands.

**Tech Stack:** React 19, TypeScript, electron-vite, Tailwind CSS v4, Zod for IPC/persistence validation, TanStack Query for main-backed workspace data once renderer queries exist, shadcn/ui for real accessible UI primitives once product UI exists, Vitest + Testing Library for renderer behavior once a TSX/DOM test proves the current runner gap, Node test runner for main pure/file behavior.

---

## Review-Driven Correction

Initial independent reviews failed the first draft. The failures were valid:

- Too many dependencies were installed in the first task before their real consumers existed.
- Preload methods were exposed before matching handlers existed.
- Recording draft flow lacked cancellation, timeout, crash recovery and race rules.
- Renderer test activation used a pure reducer test instead of real TSX/DOM behavior.
- The UI plan did not lock the reference structure, accessibility and responsive state matrix tightly enough.

This version fixes those blockers by splitting implementation into ordered slices. Each slice is independently verifiable and may become its own future `docs/specs/YYYY-MM-DD-HHMM-*` implementation session.

## Hard Stop Rule

Do not start a later slice until the current slice has:

- RED evidence.
- GREEN implementation.
- REFACTOR verification.
- `docs/current/*` updates for stable new truth.
- `npm run verify:quick` passing.
- A commit.

This is the guard against jumping from fragile foundation into product UI.

Command rule:

- `npm run test:main` currently runs the whole main test suite.
- Do not use `npm run test:main -- test/main/foo.test.ts` unless `scripts/run-main-tests.mjs` is explicitly changed to support file filters.

## Foundation Activation Matrix

| Foundation                    | First Real Consumer                            | Slice | Decision                                |
| ----------------------------- | ---------------------------------------------- | ----- | --------------------------------------- |
| Vitest + Testing Library      | TSX/DOM behavior for current renderer shell    | 1     | Activate                                |
| Preload + explicit IPC        | Folder selection and trusted bridge capability | 2     | Activate                                |
| Zod                           | First IPC boundary, then workspace metadata    | 2     | Activate                                |
| Workspace filesystem contract | `.reo`, `AGENTS.md`, recording files           | 3     | Activate                                |
| TanStack Query                | Renderer reads/mutates main-backed workspace   | 4     | Activate                                |
| shadcn/ui                     | Dialog/Button/Textarea/Label product UI        | 5     | Activate                                |
| lucide-react                  | Icon-only recording controls                   | 6     | Activate only if controls are icon-only |
| React Hook Form               | Workspace creation form submit/errors          | 4     | Activate                                |
| date-fns                      | Deferred                                       | —     | Use native local formatter first        |
| Zustand                       | Deferred                                       | —     | Defer                                   |
| Drizzle / better-sqlite3      | Deferred                                       | —     | Defer                                   |
| Better Auth                   | Deferred                                       | —     | Defer                                   |
| Sentry / electron-log         | Deferred                                       | —     | Defer                                   |
| Forge / electron-updater      | Deferred                                       | —     | Defer                                   |
| react-media-recorder          | Deferred                                       | —     | Direct MediaRecorder is smaller         |
| wavesurfer.js                 | Deferred                                       | —     | No waveform scrubbing/regions yet       |

## Cross-Process Data Flow

```text
Renderer React
  |
  | window.reoWorkspace.<explicit method>
  v
Preload contextBridge
  |
  | ipcRenderer.invoke('named:channel', payload)
  v
Main IPC handler
  |
  | sender validation + Zod validation + timeout/error envelope
  v
Workspace filesystem
  |
  +-- AGENTS.md
  +-- .reo/workspace.json
  +-- .reo/index.json
  +-- recordings/<recording-id>/
        +-- audio.webm
        +-- transcript.md
        +-- reflections.md
        +-- recording.json
```

Renderer never imports `electron`, `node:*`, `fs`, `path` or user file paths directly.

## Main Process Contract Ownership

Do not create `src/contracts/`, `src/shared/`, `src/services/` or a generic bucket.

Use:

- `src/main/workspaceContract.ts`
  - Main-owned Zod schemas.
  - IPC channel names.
  - TypeScript types inferred from schemas.

Preload may import type-only definitions from this file. Renderer receives its public API type through `src/renderer/src/preload.d.ts` and feature-local DTO types. No renderer runtime import from `src/main`.

## IPC Channel Rollout

Each channel must be introduced end-to-end in the same slice: contract, handler, preload method, tests, docs.

Rollout:

- Slice 2:
  - `workspace:chooseDirectory`
- Slice 3:
  - `workspace:initialize`
  - `workspace:open`
  - `recording:createDraft`
  - `recording:appendAudioChunk`
  - `recording:finalizeDraft`
  - `recording:discardDraft`
  - `recording:readDetail`
  - `recording:readAudio`
  - `recording:saveTranscript`
  - `recording:saveReflections`

No generic `invoke`, `send`, command bus, service layer or file proxy.

## Recording Draft Flow

Draft states:

```text
none -> draft_created -> appending -> finalizing -> finalized
draft_created/appending/finalizing -> discard_requested -> discarded
draft_created/appending/finalizing -> failed
```

Rules:

- Main generates `recording-id` on `createDraft` using `crypto.randomUUID()`.
- Main checks folder collision before `mkdir`.
- Audio writes to `audio.webm.part`.
- `appendAudioChunk` accepts exactly the next sequence number.
- Duplicate, skipped or negative sequence fails.
- `finalizeDraft` rejects while another append is in progress for that recording.
- `discardDraft` rejects after finalized.
- On append failure, renderer transitions to failed, attempts `discardDraft`, and preserves visible transcript text for user recovery.
- On app crash or restart, workspace open scans stale `.part` drafts and marks them as recoverable failed drafts or removes empty drafts. The choice must be documented in `flow.md`; first implementation should remove empty drafts and surface non-empty stale drafts as failed entries.
- Text writes use temp file + rename.
- `.reo/index.json` is rebuildable, not user content truth.

Timeouts:

- Folder choose has no app timeout because OS dialog owns user timing.
- File write IPC calls use a bounded timeout in the renderer API wrapper.
- Timeout does not assume main stopped writing; follow-up open reads disk truth.

## Recording State Machine

```text
idle
  -> acquiring
  -> recording
  -> paused
  -> recording
  -> stopping
  -> editing

idle/acquiring/recording/paused/stopping
  -> failed

editing
  -> saving_transcript -> saved_transcript
  -> save_failed_transcript
  -> saving_reflections -> saved_reflections
  -> save_failed_reflections
```

Rules:

- Timer counts active recording time, not paused time.
- Mock transcript advances only while state is `recording`.
- MediaRecorder uses `start(1000)` and emits ordered chunks.
- Stop finalizes the draft.
- Reopened playback uses `recording:readAudio`, creates a Blob URL, and revokes old Blob URLs.
- CSP must include `media-src 'self' blob:` if playback uses Blob URLs.

## Product UI Blueprint

Reference structure to preserve:

- First-run workspace creation:
  - Centered Reo shell on Eggshell ground.
  - Workspace title input is the primary field.
  - Description is optional and visually secondary.
  - Folder selection is explicit, with selected path shown in a subdued row.
  - OS dialog cancel returns to the same form without error styling.
  - Initializing state disables submit and shows a quiet progress/status line.
  - Existing `AGENTS.md` conflict explains that Reo will not overwrite the file and asks the user to choose another folder or handle it manually.
  - Folder permission failure is actionable and does not erase typed title/description.
  - Layout works at 900 x 620 without text clipping.

- Workspace home:
  - Centered workspace title.
  - Date/secondary label below title.
  - A single implemented recording action.
  - `Memory Content` divider section.
  - Empty state or recording card grid below.
  - No `Films` section.
  - No photo/video/file actions.

- Recording overlay:
  - Large bottom sheet / modal overlay.
  - Background workspace is blurred/scaled/de-emphasized.
  - Title at top.
  - Waveform-like lightweight bars using Reo tokens.
  - Live transcript block during recording.
  - Bottom controls for stop, timer/status, pause/resume.
  - Editing mode shows playback, transcript editor, reflections editor and independent save states.

Reference elements to adapt, not copy:

- Preserve structure, hierarchy, bottom-sheet behavior and micro-interactions.
- Replace pink accents with Reo small accent usage.
- Use Eggshell, Obsidian, Chalk, Gravel/Slate, Card White, hairline elevation.
- Do not create a one-off palette.
- Do not use emoji anywhere in the interface.
- Use lucide icons for icon-only controls when a matching icon exists.
- Keep the UI software-like and engineered, not toy-like: restrained motion, precise controls, clear state, and no playful decorative shortcuts.

Micro-interactions:

- Record hover/active.
- Overlay open/close.
- Pause/resume state transition.
- Transcript line reveal.
- Saving/saved/failed state.
- Playback start/pause.

## Responsive And State Matrix

Minimum states:

- Empty workspace.
- Loading workspace.
- Workspace conflict: existing `AGENTS.md`.
- Workspace missing.
- Permission denied.
- Recording acquiring failed.
- Recording.
- Paused.
- Stopping.
- Editing.
- Reopened.
- Saving.
- Saved.
- Save failed.
- Pending-save close.

Manual viewport checks:

- Wide desktop.
- Narrow desktop.
- Electron minimum window: 900 x 620.

Check header wrapping, action row behavior, card grid collapse, overlay scroll regions, long title, long transcript and long reflections.

## shadcn/ui Token Mapping

shadcn/ui is not a visual authority. It supplies accessible source that Reo owns.

When shadcn is introduced:

- Alias must be `@/* -> src/renderer/src/*` in `tsconfig.json` and `electron.vite.config.ts`.
- `components.json` aliases must match renderer paths.
- Tailwind CSS file is `src/renderer/src/index.css`.
- Tailwind config path remains empty for Tailwind v4.

Retokenization requirements:

- Button:
  - Filled maps to Reo Filled Pill Button.
  - Secondary maps to Reo Ghost Pill Button.
  - Icon/compact maps to Reo Compact Action Button.
  - Icon-only controls use lucide icons, not emoji.
- Dialog:
  - Reo modal/panel radius and hairline elevation.
  - Card White surface over blurred workspace.
- Textarea:
  - 0 radius input rule.
  - Chalk border or transparent bottom-border variant.
- Label:
  - Inter UI label, Gravel/Slate secondary text.

Do not keep default shadcn palette/radius/ring values unless mapped to Reo tokens.

Keyboard focus must remain visible. Use a Reo token focus treatment, for example an Obsidian outline with Chalk offset or another documented Reo-token treatment. Do not erase focus-visible styles while removing default shadcn rings.

## Slice 1: Renderer Test Foundation

**Purpose:** Prove and install renderer behavior test foundation without product implementation.

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `test/renderer/setup.ts`
- Create: `test/renderer/App.test.tsx`
- Create: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/main.tsx`
- Modify: `docs/current/quality.md`

- [ ] **Step 1: Pre-install renderer test proof**

Create `test/renderer/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/renderer/src/App';

describe('App', () => {
  it('renders the current Reo shell through React DOM', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Reo' })).toBeInTheDocument();
  });
});
```

Run:

```bash
npm run test:renderer -- test/renderer/App.test.tsx
```

Expected output:

```text
npm ERR! Missing script: "test:renderer"
```

This is a pre-install tooling proof, not a TDD behavior RED. Treat Step 4 as the behavior RED for this slice.

- [ ] **Step 2: Install renderer test foundation**

Run:

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 3: Add test script and config**

Add these `package.json` script keys. Preserve existing scripts, and replace only `verify:quick` so it also runs `test:renderer`:

```json
{
  "test:renderer": "vitest run --config vitest.config.ts",
  "verify:quick": "npm run typecheck && npm run test:main && npm run test:renderer && npm run lint && npm run format:check"
}
```

`vitest.config.ts` uses jsdom and Testing Library setup.

Required config shape:

```ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['test/renderer/setup.ts'],
    include: ['test/renderer/**/*.test.ts', 'test/renderer/**/*.test.tsx'],
  },
});
```

`test/renderer/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Run behavior RED**

Run:

```bash
npm run test:renderer -- test/renderer/App.test.tsx
```

Expected RED:

```text
Cannot find module ... App
```

- [ ] **Step 5: Extract current shell without product changes**

Move the existing `App` component from `src/renderer/src/main.tsx` into `src/renderer/src/App.tsx`, export it, and import it back in `main.tsx`. Do not introduce workspace product UI in this slice.

Run:

```bash
npm run test:renderer -- test/renderer/App.test.tsx
```

Expected GREEN.

- [ ] **Step 6: Docs and verification**

Update `quality.md`:

- Vitest is installed for renderer TSX/DOM behavior.
- Main pure tests still use Node test runner.
- `test:renderer` is CI-style `vitest run`, not watch.

Run:

```bash
npm run verify:quick
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts test/renderer/setup.ts src/renderer/src/App.tsx src/renderer/src/main.tsx test/renderer/App.test.tsx docs/current/quality.md
git commit -m "test: add renderer behavior foundation"
```

## Slice 2: Preload + Trusted IPC + Zod Foundation

**Purpose:** Add preload wiring, sender validation, microphone permission policy, Zod validation for the first IPC boundary, and the first explicit IPC channel. No product UI and no workspace file contract yet.

**Files:**

- Create: `src/main/workspaceContract.ts`
- Create: `src/main/trustedSender.ts`
- Create: `src/main/workspaceIpc.ts`
- Create: `src/preload/index.ts`
- Create: `src/preload/workspaceBridge.ts`
- Create: `src/renderer/src/preload.d.ts`
- Modify: `src/main/secureWebPreferences.ts`
- Modify: `src/main/security.ts`
- Modify: `src/main/index.ts`
- Modify: `electron.vite.config.ts`
- Modify: `tsconfig.main.json`
- Test: `test/main/securityPermissions.test.ts`
- Test: `test/main/workspaceIpcContracts.test.ts`
- Test: `test/main/preloadBridge.test.ts`
- Docs: `docs/current/electron.md`, `docs/current/flow.md`, `docs/current/data.md`, `docs/current/quality.md`

- [ ] **Step 1: Install Zod**

Run only now, because `workspace:chooseDirectory` is the first real IPC boundary:

```bash
npm install zod
```

- [ ] **Step 2: RED sender and permission tests**

Exact media cases:

- permission check handler:
  - trusted + `permission: 'media'` + `mediaType: 'audio'` allows.
  - trusted + `mediaType: 'video'` denies.
  - trusted + unknown or missing `mediaType` denies.
  - untrusted + `mediaType: 'audio'` denies.
  - non-media permission denies.
- permission request handler:
  - trusted + `mediaTypes: ['audio']` allows.
  - trusted + `mediaTypes: ['video']` denies.
  - trusted + `mediaTypes: ['audio', 'video']` denies.
  - trusted + empty or missing `mediaTypes` denies.
  - untrusted + `mediaTypes: ['audio']` denies.
  - non-media permission denies.
- `setPermissionCheckHandler` and `setPermissionRequestHandler` agree.
- Dev loopback is trusted only when not packaged.

Run:

```bash
npm run test:main
```

Expected RED for missing trusted sender / permission helper.

- [ ] **Step 3: RED IPC contract and preload bridge tests**

Design `src/preload/workspaceBridge.ts` as a pure function:

```ts
export function registerWorkspaceBridge(deps: {
  contextBridge: Pick<typeof contextBridge, 'exposeInMainWorld'>;
  ipcRenderer: Pick<typeof ipcRenderer, 'invoke'>;
}): void;
```

`src/preload/index.ts` passes real Electron dependencies. Tests pass fakes, not a mocked `electron` module.

Assert:

- exposed key is exactly `reoWorkspace`.
- exposed method is exactly `chooseDirectory`.
- `chooseDirectory` maps to `workspace:chooseDirectory`.
- no `ipcRenderer`, generic `invoke`, generic `send`, `electron`, `fs`, `path` or Node global is exposed.

Contract tests:

- `workspace:chooseDirectory` has a Zod-validated no-input contract.
- Canceled dialog returns typed canceled result, not thrown unknown error.
- Error envelopes have actionable codes.

Run:

```bash
npm run test:main
```

- [ ] **Step 4: Implement trusted sender helper**

`assertTrustedSender(event)` checks `event.senderFrame.url` or equivalent Electron frame URL through one centralized policy. Reuse existing trusted app URL rules; do not duplicate origin logic in handlers.

- [ ] **Step 5: Implement `workspace:chooseDirectory` end-to-end**

Use `dialog.showOpenDialog` with `openDirectory`.

Do not expose workspace initialize/open/recording methods in this slice. They arrive with real file handlers in Slice 3.

- [ ] **Step 6: Attach preload**

Use electron-vite convention:

```text
src/preload/index.ts
out/preload/index.js
```

Add preload path to `createSecureWebPreferences`. Preserve all current hardening.

- [ ] **Step 7: Permission**

No CSP relaxation is needed for `getUserMedia`.

Do not add `media-src blob:` in this slice. Playback is not implemented yet.

- [ ] **Step 8: Docs and verification**

Update current docs:

- `electron.md`: preload exists and exposes only `chooseDirectory`.
- `flow.md`: `chooseDirectory` has OS-dialog cancellation semantics.
- `data.md`: Zod now owns IPC runtime validation.
- `quality.md`: preload bridge has direct tests.

Run:

```bash
npm run verify:quick
npm run build
```

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/main src/preload src/renderer/src/preload.d.ts electron.vite.config.ts tsconfig.main.json test/main docs/current
git commit -m "feat: add trusted preload foundation"
```

## Slice 3: Workspace IPC + Filesystem + Recording Draft Foundation

**Purpose:** Extend Zod-validated workspace contracts and implement recording draft lifecycle in main process before renderer feature UI.

**Files:**

- Modify: `src/main/workspaceContract.ts`
- Create: `src/main/workspacePaths.ts`
- Create: `src/main/workspaceFiles.ts`
- Modify: `src/main/workspaceIpc.ts`
- Modify: `src/preload/workspaceBridge.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/preload.d.ts`
- Test: `test/main/workspaceIpcContracts.test.ts`
- Test: `test/main/workspacePaths.test.ts`
- Test: `test/main/workspaceFiles.test.ts`
- Test: `test/main/recordingDrafts.test.ts`
- Test: `test/main/preloadBridge.test.ts`
- Docs: `docs/current/data.md`, `docs/current/flow.md`, `docs/current/electron.md`, `docs/current/quality.md`

- [ ] **Step 1: RED contract tests**

Run:

```bash
npm run test:main
```

Expected RED for missing extended workspace/recording schemas or missing newly exposed bridge methods.

Tests must cover:

- Empty workspace title rejected.
- Missing root path rejected.
- Negative audio chunk sequence rejected.
- `recording:readAudio` rejects path traversal input.
- Error envelopes have actionable codes.
- All newly exposed preload methods have matching handlers.

- [ ] **Step 2: Implement contracts**

`src/main/workspaceContract.ts` owns Zod schemas and channel names. Do not create generic command schema.

Minimum schemas:

- `InitializeWorkspaceInput`
- `OpenWorkspaceInput`
- `CreateRecordingDraftInput`
- `AppendAudioChunkInput`
- `FinalizeRecordingDraftInput`
- `ReadRecordingDetailInput`
- `ReadRecordingAudioInput`
- `SaveTranscriptInput`
- `SaveReflectionsInput`

- [ ] **Step 3: RED path tests**

Run:

```bash
npm run test:main
```

Tests:

- Existing `AGENTS.md` blocks initialization if `.reo/workspace.json` absent.
- Existing `.reo/workspace.json` opens workspace.
- Recording title never controls folder path.
- Unsupported schema version is actionable.
- Path traversal is rejected.

- [ ] **Step 4: Implement path helpers**

Use structured `path.resolve` / `path.relative` containment. No ad hoc string checks.

- [ ] **Step 5: RED workspace file tests**

Assert created:

```text
AGENTS.md
.reo/workspace.json
.reo/index.json
recordings/
```

Assert not created:

```text
notes/
photos/
videos/
files/
```

- [ ] **Step 6: Implement workspace initialization**

`AGENTS.md` must explain:

- This is a Reo memory workspace.
- Workspace title/description.
- `.reo/` and `recordings/` ownership.
- `audio.webm`, `transcript.md`, `reflections.md`, `recording.json` meanings.
- AI may read/summarize.
- AI must not delete original audio.
- AI must not rewrite transcript/reflections unless asked.

- [ ] **Step 7: RED recording draft tests**

Tests:

- Main generates UUID recording id.
- Collision check before `mkdir`.
- Create draft creates `audio.webm.part`.
- Append sequence is strict.
- Finalize writes `audio.webm`, transcript, reflections, `recording.json`.
- Finalize rejects while append is active.
- Discard removes non-final draft.
- Stale `.part` recovery behavior on workspace open.
- Empty stale draft is removed.
- Non-empty stale draft is surfaced as a failed/recoverable entry with an explicit status in `recording.json`.

- [ ] **Step 8: Implement draft lifecycle**

Keep logic in `workspaceFiles.ts`. No service layer.

`recording.json` schema:

```json
{
  "schemaVersion": 1,
  "id": "uuid",
  "title": "Voice note - May 6, 00:24",
  "createdAt": "ISO string",
  "updatedAt": "ISO string",
  "durationMs": 0,
  "audio": "audio.webm",
  "transcript": "transcript.md",
  "reflections": "reflections.md"
}
```

`durationMs: 0` above is a type/example placeholder. Finalized recordings must write the actual active recording duration.

Use native local formatter for title. Do not install date-fns.

Finalize uses `fs.rename` without overwrite. The target `audio.webm` must be absent before rename. Add a test for a prior partial finalize attempt so retry/rollback behavior is explicit.

- [ ] **Step 9: Wire real IPC handlers**

Keep the Slice 2 `chooseDirectory` handler and add the remaining real channel behavior:

- initialize/open workspace.
- draft create/append/finalize/discard.
- read detail.
- read audio.
- save transcript/reflections.

Update `preloadBridge.test.ts` to assert the exact full post-Slice-3 method set and continue asserting no `ipcRenderer`, `fs`, `path`, generic `invoke` or generic `send` leaks.

- [ ] **Step 10: Docs and verification**

Update `data.md` and `flow.md` with durable file contract, index ownership, query-invalidating writes later, draft lifecycle, stale draft recovery and timeout semantics.

Run:

```bash
npm run verify:quick
npm run build
```

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/main src/preload src/renderer/src/preload.d.ts test/main docs/current
git commit -m "feat: add workspace file persistence"
```

## Slice 4: Renderer Workspace Data And Create Form

**Purpose:** Add main-backed async data ownership and the workspace creation form.

**Files:**

- Create: `src/renderer/src/queryClient.tsx`
- Create: `src/renderer/src/workspace/workspaceApi.ts`
- Create: `src/renderer/src/workspace/workspaceQueries.ts`
- Create: `src/renderer/src/workspace/CreateWorkspaceForm.tsx`
- Modify: `src/renderer/src/main.tsx`
- Modify: `src/renderer/src/App.tsx`
- Test: `test/renderer/CreateWorkspaceForm.test.tsx`
- Test: `test/renderer/workspaceQueries.test.ts`
- Docs: `docs/current/data.md`, `docs/current/frontend.md`, `docs/current/flow.md`

- [ ] **Step 1: Install TanStack Query and React Hook Form**

Run:

```bash
npm install @tanstack/react-query react-hook-form @hookform/resolvers
```

This is the first real form submit/error lifecycle consumer, so React Hook Form is activated here.

- [ ] **Step 2: RED query tests**

Run:

```bash
npm run test:renderer -- test/renderer/workspaceQueries.test.ts
```

Expected RED until helpers exist.

Stable keys:

```ts
['workspace', rootPath][('recording', rootPath, recordingId)];
```

- [ ] **Step 3: Implement query client and API wrapper**

`workspaceApi.ts` wraps `window.reoWorkspace` only.

- [ ] **Step 4: RED form behavior tests**

Run:

```bash
npm run test:renderer -- test/renderer/CreateWorkspaceForm.test.tsx
```

Tests:

- Empty title blocks submit.
- Description is optional.
- Field-level title error is announced.
- Choose folder button calls preload API.
- OS dialog cancel keeps typed values and does not show error styling.
- Selected folder path is shown after choose.
- Initializing disables submit and shows status.
- Submit failure preserves title, description and folder state.
- Existing `AGENTS.md` conflict renders actionable message.
- Workspace missing is actionable.
- Permission denied preserves typed values and gives recovery guidance.
- 900 x 620 layout keeps title, folder row and submit visible without clipping.

- [ ] **Step 5: Implement form**

Use React Hook Form + Zod resolver. Folder selection remains explicit component state because it is owned by the OS dialog result, but submit validation and field errors are RHF-owned.

- [ ] **Step 6: Verification**

Run:

```bash
npm run verify:quick
```

- [ ] **Step 7: Slice UI verification**

Before committing Slice 4, manually check the create-workspace screen at wide desktop, narrow desktop and 900 x 620. Evidence goes in the implementation spec verification file.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/renderer/src test/renderer docs/current
git commit -m "feat: add workspace renderer data"
```

## Slice 5: Workspace Home UI + shadcn Foundation

**Purpose:** Implement the reference-aligned workspace home and initialize only needed UI primitives.

**Files:**

- Create: `components.json`
- Create: `src/renderer/src/lib/utils.ts`
- Create: `src/renderer/src/components/ui/button.tsx`
- Create: `src/renderer/src/components/ui/label.tsx`
- Create: `src/renderer/src/workspace/WorkspaceHome.tsx`
- Create: `src/renderer/src/workspace/RecordingCard.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/index.css`
- Modify: `src/renderer/src/theme.css`
- Modify: `electron.vite.config.ts`
- Modify: `tsconfig.json`
- Test: `test/renderer/WorkspaceHome.test.tsx`
- Docs: `docs/current/frontend.md`

- [ ] **Step 1: RED UI behavior tests**

Run:

```bash
npm run test:renderer -- test/renderer/WorkspaceHome.test.tsx
```

Tests:

- Empty workspace shows title area, record action and `Memory Content`.
- `Films` is absent.
- Photo/video/file actions are absent.
- Recording entries render from workspace snapshot.
- Long workspace title remains accessible and does not duplicate hidden layout text.
- Workspace missing state is actionable.

- [ ] **Step 2: Initialize shadcn only for current consumers**

Run:

```bash
npx shadcn@latest init
npx shadcn@latest add button label
```

Pin aliases:

```text
@/* -> src/renderer/src/*
```

- [ ] **Step 3: Retokenize primitives**

Map Button and Label to Reo tokens. Remove unmapped default shadcn visual constants.

Keep visible keyboard focus for every button-like control using a Reo token focus treatment. Tests or manual evidence must prove focus is visible after keyboard navigation.

Light theme only. Do not add a dark variant or media-query theme switch in this slice.

- [ ] **Step 4: Implement WorkspaceHome**

Follow Product UI Blueprint. Keep scope small, not sparse.

- [ ] **Step 5: Slice UI verification**

Run:

```bash
npm run verify:quick
```

Manual checks before commit:

- Wide desktop, narrow desktop and 900 x 620.
- Header wraps cleanly.
- Action row does not overflow.
- Card grid collapses cleanly.
- Keyboard focus is visible on record action and card actions.
- Empty/loading/missing/conflict states do not clip text.

- [ ] **Step 6: Commit**

```bash
git add components.json electron.vite.config.ts tsconfig.json src/renderer/src test/renderer docs/current/frontend.md
git commit -m "feat: add workspace home ui"
```

## Slice 6: Recording Overlay, MediaRecorder And Autosave

**Purpose:** Complete the recording loop and editing overlay.

**Files:**

- Add shadcn primitives:
  - `src/renderer/src/components/ui/dialog.tsx`
  - `src/renderer/src/components/ui/textarea.tsx`
- Create: `src/renderer/src/workspace/RecordingOverlay.tsx`
- Create: `src/renderer/src/workspace/mediaRecorderAdapter.ts`
- Create: `src/renderer/src/workspace/recordingMachine.ts`
- Modify: `src/main/security.ts`
- Create: `test/renderer/RecordingOverlay.test.tsx`
- Create: `test/renderer/mediaRecorderAdapter.test.ts`
- Create: `test/renderer/recordingMachine.test.ts`
- Create: `test/main/csp.test.ts`
- Modify: `src/renderer/src/workspace/WorkspaceHome.tsx`
- Docs: `docs/current/frontend.md`, `docs/current/flow.md`, `docs/current/electron.md`

- [ ] **Step 1: Install lucide only if icon-only controls are implemented**

If overlay controls are icon-only:

```bash
npm install lucide-react
```

If controls use visible text labels, do not install lucide.

Do not use emoji as a fallback for recording, pause, resume, stop, playback, save, error, empty, or workspace states.

- [ ] **Step 2: Add shadcn Dialog/Textarea**

Run:

```bash
npx shadcn@latest add dialog textarea
```

Retokenize immediately:

- Dialog maps to Reo modal/panel.
- Textarea maps to Reo 0-radius input.

- [ ] **Step 3: RED CSP test for playback Blob URL**

Run:

```bash
npm run test:main
```

Expected RED until CSP includes `media-src 'self' blob:`.

Test:

- production CSP includes `media-src 'self' blob:` once Blob URL audio playback is implemented.
- the CSP change does not add broader media sources.
- dev CSP remains no broader than needed.

Implement the CSP change in `src/main/security.ts` in this slice, before renderer playback lands. Update `electron.md`.

- [ ] **Step 4: RED state machine tests**

Run:

```bash
npm run test:renderer -- test/renderer/recordingMachine.test.ts
```

Tests:

- idle -> acquiring -> recording.
- recording -> paused.
- paused -> recording.
- stopping ignores repeated stop.
- failed preserves actionable reason.

- [ ] **Step 5: RED MediaRecorder adapter tests**

Run:

```bash
npm run test:renderer -- test/renderer/mediaRecorderAdapter.test.ts
```

Tests:

- calls `start(1000)`.
- calls `getUserMedia({ audio: true, video: false })`.
- missing MediaRecorder or mediaDevices gives actionable failure.
- emits ordered chunks.
- emits only non-empty chunks.
- stops all tracks on stop.
- stops all tracks on failure.
- propagates permission/start failure and cleans up tracks.

The adapter must accept injectable `mediaDevices` and `MediaRecorder` constructor fakes for tests. jsdom does not provide a real microphone or MediaRecorder.

- [ ] **Step 6: RED overlay tests**

Run:

```bash
npm run test:renderer -- test/renderer/RecordingOverlay.test.tsx
```

Tests:

- Dialog has title/description.
- Initial focus is deterministic.
- Focus returns to opener.
- Escape closes only after flush or safe state.
- Record/pause/resume/stop controls have accessible names.
- Keyboard focus is visibly retained on controls after shadcn retokenization.
- Pause/resume state is exposed.
- Stop is disabled or busy while stopping.
- Stop waits for the final `dataavailable` append acknowledgement before `finalizeDraft`.
- Transcript reveals lines while recording, pauses while paused.
- Stop finalizes draft and enters editing.
- Reopened recording reads audio and renders playback.
- Transcript/reflections save independently.
- Save failure uses `role="alert"` and preserves edited text.
- Saving/saved uses non-noisy `role="status"`.

- [ ] **Step 7: Implement overlay**

Keep `mockTranscript` and autosave helpers inside `RecordingOverlay.tsx` unless tests become unreadable. Keep `mediaRecorderAdapter.ts` separate because it is a browser API boundary.

Stop/finalize ordering:

- call MediaRecorder stop,
- collect the final `dataavailable` chunk,
- await the last `appendAudioChunk` acknowledgement,
- then call `finalizeDraft`.

Add a RED test: stop while last append is in flight -> finalize succeeds and does not hit the main-process append/finalize race rejection.

- [ ] **Step 8: Slice UI verification**

Run:

```bash
npm run verify:quick
npm run build
```

Manual checks before commit:

- Wide desktop, narrow desktop and 900 x 620.
- Overlay scroll regions keep controls reachable.
- Long transcript/reflections do not hide controls.
- Keyboard focus is visible in Dialog and Textarea.
- Permission denied, recording, paused, stopping, editing, saving, saved, save failed and pending-save close states render without overflow.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/main/security.ts src/renderer/src test/main test/renderer docs/current
git commit -m "feat: add recording overlay"
```

## Slice 7: Runtime, Persistence And Codex CLI Validation

**Purpose:** Prove the product slice works in Electron and on disk.

**Files:**

- Docs only unless runtime verification reveals a defect.

- [ ] **Step 1: Automated verification**

Run:

```bash
npm run verify:quick
npm run build
git diff --check
```

- [ ] **Step 2: Electron runtime security verification**

Run:

```bash
npm start
```

Verify:

- Production URL is `reo-app://renderer/index.html`.
- CSP header exists and includes `media-src 'self' blob:`.
- External navigation is blocked.
- New window is denied.
- Renderer cannot access Node.
- Camera/geolocation/unknown permissions denied.
- Microphone permission allowed only from trusted renderer.

- [ ] **Step 3: Product path**

Use a repeat-safe temp folder outside the repo:

```bash
WORKSPACE_DIR="$(mktemp -d /tmp/reo-memory-workspace-smoke.XXXXXX)"
echo "$WORKSPACE_DIR"
```

Manual steps:

1. Create workspace with title.
2. Select folder.
3. Confirm `AGENTS.md`, `.reo/workspace.json`, `.reo/index.json`, `recordings/`.
4. Record, pause, resume, stop.
5. Edit transcript.
6. Edit reflections.
7. Close overlay.
8. Reopen recording and play audio.
9. Quit/restart and reopen workspace.

- [ ] **Step 4: Disk persistence checks**

Inspect disk:

```bash
find "$WORKSPACE_DIR" -maxdepth 4 -type f | sort
find "$WORKSPACE_DIR" -type f -exec shasum {} + | sort > /tmp/reo-before-restart.sha
```

Verify:

- `audio.webm` exists.
- `audio.webm.part` is gone after finalize.
- temp files are gone after autosave.
- `transcript.md` contains edited transcript.
- `reflections.md` contains edited reflections.
- restart does not change file contents.
- save failure does not corrupt the previous file.

After restart:

```bash
find "$WORKSPACE_DIR" -type f -exec shasum {} + | sort > /tmp/reo-after-restart.sha
diff -u /tmp/reo-before-restart.sha /tmp/reo-after-restart.sha
```

To induce save failure:

```bash
RECORDING_DIR="$WORKSPACE_DIR/recordings/<id>"
find "$WORKSPACE_DIR" -type f -exec shasum {} + | sort > /tmp/reo-before-failure.sha
chmod -w "$RECORDING_DIR"
```

Then edit transcript or reflections in Reo, verify UI alert and preserved edited UI text, restore permissions, and compare hashes:

```bash
chmod +w "$RECORDING_DIR"
find "$WORKSPACE_DIR" -type f -exec shasum {} + | sort > /tmp/reo-after-failure.sha
diff -u /tmp/reo-before-failure.sha /tmp/reo-after-failure.sha
```

- [ ] **Step 5: Viewport checks**

Check wide desktop, narrow desktop and 900 x 620.

Verify:

- Header wraps cleanly.
- Action row does not overflow.
- Cards collapse cleanly.
- Overlay scrolls internally.
- Long transcript/reflections do not hide controls.

- [ ] **Step 6: Codex CLI read-only validation**

Run:

```bash
find "$WORKSPACE_DIR" -type f -exec shasum {} + | sort > /tmp/reo-before-codex.sha
codex exec --sandbox read-only --cd "$WORKSPACE_DIR" --skip-git-repo-check --ephemeral "Read AGENTS.md and summarize what this memory workspace contains. Do not modify files."
find "$WORKSPACE_DIR" -type f -exec shasum {} + | sort > /tmp/reo-after-codex.sha
diff -u /tmp/reo-before-codex.sha /tmp/reo-after-codex.sha
```

Expected:

- Codex reads workspace `AGENTS.md`.
- Codex identifies recording files.
- Codex does not require Reo DB access.
- Workspace files are not modified.

- [ ] **Step 7: Final current docs**

Only stable truth goes into `docs/current/*`. Evidence stays in the implementation spec archive.

- [ ] **Step 8: Commit**

```bash
git add docs/current docs/specs/<implementation-session>
git commit -m "docs: verify first memory recording slice"
```

## Acceptance Criteria

- No implementation slice starts before prior foundation slice closes.
- Renderer uses no Node/Electron direct imports.
- Preload exposes only `window.reoWorkspace`.
- IPC channels are explicit, sender-checked and Zod-validated.
- Workspace initialization never overwrites existing `AGENTS.md`.
- Workspace folder is readable by Codex CLI without Reo private DB context.
- Audio persists as `audio.webm`.
- Transcript and reflections persist as separate editable Markdown files.
- Reopen restores audio, transcript and reflections.
- Autosave failure preserves user edits and previous disk content.
- UI keeps the reference structure while using Reo design system.
- UI contains no emoji; any icon-only controls use lucide icons when a matching icon exists.
- UI remains a standard engineered software product, not a toy-like interface.
- `npm run verify:quick`, `npm run build`, Electron runtime smoke and Codex CLI validation pass.

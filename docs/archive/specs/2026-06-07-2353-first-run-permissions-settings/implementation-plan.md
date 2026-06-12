# First Run Permissions And Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development before behavior changes. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first implementation slice for Reo's first-run permissions/settings guide, including app-scoped microphone/camera/accessibility permission requests, action-time microphone resolution and Settings access.

**Architecture:** Keep onboarding state in renderer app-level localStorage with no secrets, raw paths, handles or media tokens. Add narrow application-scoped main/preload permission status and request surfaces for microphone, camera and Accessibility. Media capture for recording still requires the existing sender-bound one-shot microphone intent before `getUserMedia`; camera permission setup does not enable renderer video capture.

**Tech Stack:** Electron session/systemPreferences, explicit preload IPC, React 19, TanStack Query, Testing Library, Vitest, Node test runner, Tailwind/shadcn/Radix primitives.

---

## File Structure

- Create `src/renderer/src/onboarding/onboardingState.ts`
  - Owns localStorage parsing, writing and startup decision.
- Create `src/renderer/src/onboarding/PermissionGuideDialog.tsx`
  - First-run/action-time permission guide surface using existing shadcn/Radix primitives.
- Create `src/renderer/src/components/ui/badge.tsx`
  - Reo-tokenized shadcn-style status metadata primitive with real permission/settings consumers.
- Create `src/renderer/src/onboarding/*.test.ts(x)`
  - Pure state/model tests and component behavior tests.
- Modify `src/workspace-contract/workspace-channels.ts`
  - Add explicit permission status and request channel names.
- Modify `src/workspace-contract/reo-workspace-bridge.ts`
  - Add typed bridge methods for reading permission statuses and requesting current requestable permissions.
- Modify `src/preload/workspaceBridge.ts`
  - Expose the narrow method.
- Modify `src/main/workspaceIpc.ts`
  - Register handlers that return microphone/camera/accessibility status and request microphone, camera or Accessibility permission.
- Modify `src/renderer/src/workspace/workspaceApi.ts`
  - Add typed API wrapper.
- Modify `src/renderer/src/settings/SettingsShell.tsx`
  - Add `权限` nav support while preserving `语音`.
- Create `src/renderer/src/settings/PermissionSettingsPanel.tsx`
  - Settings permission status section using the same app-scoped query/action semantics.
- Modify `src/renderer/src/App.tsx`
  - Render first-run guide before Home when needed, integrate settings permission tab, and intercept Home `录下来` when microphone permission needs resolution.

## Task 1: Onboarding State

**Files:**

- Create: `src/renderer/src/onboarding/onboardingState.ts`
- Test: `src/renderer/src/onboarding/onboardingState.test.ts`

- [x] **Step 1: Write failing tests**
  - Startup state is `first-run` when no storage exists.
  - Skipping writes `hasSeenFirstRun: true` and returns `app`.
  - `restart-required` marker returns `permission-guide` and preserves focused item.
  - Invalid storage fails closed to `first-run`.

- [x] **Step 2: Run tests to verify RED**
  - `npm run test:renderer -- src/renderer/src/onboarding/onboardingState.test.ts --project renderer-node`

- [x] **Step 3: Implement minimal state helper**
  - Versioned localStorage key, safe JSON parse, no secret/path/handle fields.

- [x] **Step 4: Run tests to verify GREEN**
  - Same command.

## Task 2: Permission Status IPC

**Files:**

- Modify: `src/workspace-contract/workspace-channels.ts`
- Modify: `src/workspace-contract/reo-workspace-bridge.ts`
- Modify: `src/preload/workspaceBridge.ts`
- Modify: `src/main/workspaceIpc.ts`
- Modify: `src/renderer/src/workspace/workspaceApi.ts`
- Test: `test/main/workspaceContract.test.ts`
- Test: `test/main/workspaceBridgeSurface.test.ts`
- Test: `test/main/workspaceIpc.test.ts`
- Test: `src/renderer/src/workspace/workspaceApi.test.ts`

- [x] **Step 1: Write failing contract/bridge tests**
  - New method exists on bridge.
  - New channel is registered and request takes no workspace handle.
  - Response returns status for `microphone`, `camera`, and `accessibility` without raw paths.

- [x] **Step 2: Run tests to verify RED**
  - Targeted main and renderer commands for the new/changed tests.

- [x] **Step 3: Implement minimal IPC**
- Main reads Electron `systemPreferences.getMediaAccessStatus('microphone'|'camera')`.
- Main reads Accessibility with `systemPreferences.isTrustedAccessibilityClient(false)`.
- Main requests microphone/camera through `systemPreferences.askForMediaAccess('microphone'|'camera')`.
- Main requests Accessibility through `systemPreferences.isTrustedAccessibilityClient(true)`.

- [x] **Step 4: Run tests to verify GREEN**
  - Repeat targeted commands.

## Task 3: Permission Guide UI

**Files:**

- Create: `src/renderer/src/onboarding/PermissionGuideDialog.tsx`
- Create: `src/renderer/src/components/ui/badge.tsx`
- Test: `src/renderer/src/onboarding/PermissionGuideDialog.test.tsx`
- Test: `src/renderer/src/components/ui/badge.test.tsx`

- [x] **Step 1: Write failing tests**
  - Renders microphone, camera, accessibility and voice rows.
  - Camera can request permission.
  - Accessibility can request permission.
  - Microphone row can be focused for action-time resolver.
  - Skip/continue calls owner callback.

- [x] **Step 2: Run tests to verify RED**
  - `npm run test:renderer -- src/renderer/src/onboarding --project renderer-jsdom-components`

- [x] **Step 3: Implement minimal component**
  - Use existing shadcn/Radix `Dialog`, `FieldRow`, `Badge`, `Button` and lucide icons.
  - Avoid nested cards and broad marketing copy.

- [x] **Step 4: Run tests to verify GREEN**
  - Same command.

## Task 4: Settings Integration

**Files:**

- Modify: `src/renderer/src/settings/SettingsShell.tsx`
- Modify: `src/renderer/src/App.tsx`
- Test: `src/renderer/src/settings/SettingsShell.test.tsx`
- Test: `src/renderer/src/App.test.tsx`

- [x] **Step 1: Write failing tests**
  - Settings shell can show `权限` and `语音` nav items.
  - Sidebar settings opens permissions/settings mode without releasing workspace.
  - Returning from settings preserves app state.

- [x] **Step 2: Run tests to verify RED**
  - Targeted renderer component/workflow tests.

- [x] **Step 3: Implement minimal integration**
  - Add settings section state in App.
  - Render PermissionGuide for `权限`, existing VoiceSettingsPanel for `语音`.

- [x] **Step 4: Run tests to verify GREEN**
  - Repeat targeted tests.

## Task 5: First-Run And Action-Time Resolver

**Files:**

- Modify: `src/renderer/src/App.tsx`
- Test: `src/renderer/src/App.test.tsx`

- [x] **Step 1: Write failing tests**
  - First app launch renders permission guide before Home.
  - Skipping guide enters Home and persists seen state.
  - Clicking Home `录下来` with microphone denied opens permission guide focused on microphone.
  - Restart-required marker reopens permission guide on next startup.

- [x] **Step 2: Run tests to verify RED**
  - Targeted App tests in renderer workflow project.

- [x] **Step 3: Implement minimal flow**
  - Use onboarding state helper.
  - Intercept Home recording only when microphone status is denied/restricted/not-determined/unknown.
  - Do not persist handles or pending intents.

- [x] **Step 4: Run tests to verify GREEN**
  - Repeat targeted App tests.

## Task 6: Verification And Current Docs

**Files:**

- Modify current docs only if stable contract/current behavior changes.
- Keep task evidence in this spec.

- [x] **Step 1: Run focused tests**
  - Main contract/IPC tests.
  - Renderer onboarding/settings/App tests.

- [x] **Step 2: Run format/lint/type targeted checks**
  - Use scoped checks while developing.

- [x] **Step 3: Run final gate once**
  - `npm run verify:quick`

- [x] **Step 4: Record verification evidence**
  - Add final evidence to this spec only after fresh final snapshot verification.

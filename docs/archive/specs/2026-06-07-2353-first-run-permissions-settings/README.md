# First Run Permissions And Settings Design

创建：2026-06-07 23:53 PDT
状态：implemented

## Objective

Design Reo's first-run permissions and settings guide for new users. The first implementation slice prioritizes the initial permissions/settings experience; the guided example memory space and later in-product guidance are follow-up phases.

## Intent Alignment

Confirmed direction:

- Use a first-run setup guide.
- Borrow PermissionFlow's interaction model, not the Swift/AppKit library.
- Include microphone, camera and accessibility in the permission model.
- Do not block users from entering Reo just because optional permissions are incomplete.
- When a user invokes a feature that needs a missing permission, open the same guide focused on that permission and make that permission mandatory for the action.
- If macOS requires app restart after a permission change, Reo reopens into the permissions guide after restart and refreshes statuses.

Reference:

- PermissionFlow README.zh: statusful permission rows, open the relevant System Settings page, refresh state when the app becomes active, show unknown state when detection is unavailable, and do not bypass macOS security.
- Electron official docs: media permission checks and requests should be explicitly handled; `systemPreferences.getMediaAccessStatus()` can report microphone/camera/screen state, and `systemPreferences.askForMediaAccess()` can request microphone/camera on macOS when the app has the required privacy descriptions.
- shadcn/ui current docs: `Dialog` can compose directly with `FieldGroup` / `Field` and `Button`; `Badge` is appropriate for compact status metadata. `Card` is not used inside the Dialog because the Dialog/Settings panel already provides the outer surface.
- Radix Primitives current docs: Radix provides unstyled accessible primitives intended to be wrapped by the app's design system; Reo uses its existing shadcn/Radix wrappers instead of adding a feature-local modal primitive.

## Current Reo Facts

- Renderer has no direct Node or Electron access.
- Permissions are deny-by-default.
- Microphone access currently uses a one-shot main-owned intent before renderer calls `getUserMedia`.
- Camera is a current setup permission item. Current renderer video capture remains denied by media policy until photo/video capture has its own flow.
- Accessibility is a current setup permission item for macOS trusted-client status; Reo stores only bounded status/resume state, not System Settings paths or native tokens.
- Voice credentials are main-owned and stored via Electron `safeStorage`; renderer only reads non-secret settings projection.
- Home already has `写下来`, `录下来`, `造出来` and disabled `拍下来` actions backed by the system Draft workspace.
- Settings currently has one category, `语音`, rendered by `VoiceSettingsPanel`.

## Product Model

Use two layers:

1. First-run setup guide: optional completion.
2. Action-time resolver: required completion for the feature the user just invoked.

This avoids the wrong model where users must satisfy every future permission before they can enter a private studio. It also avoids the failure mode where clicking `录下来` with no microphone access produces an opaque runtime error.

## Setup Guide Structure

The guide is an application-level surface in the same BrowserWindow. It should feel like a quiet setup desk, not a marketing page or a generic checklist.

Primary sections for the full design:

- Local workspace: create/open a user memory space, or continue with system Draft.
- Voice service: enable or skip Doubao voice settings; configure X-Api-Key only through the existing voice settings boundary.
- Microphone: explain and test recording permission.
- Camera: request camera permission through the same app-scoped permission guide when the user explicitly clicks the row.
- Accessibility: request trusted Accessibility client status through the same app-scoped permission guide when the user explicitly clicks the row.
- Finish: enter Reo, or return later from Settings.

The setup guide must have a clear skip/continue action. Skipping records that the user has seen the guide; it does not mark missing permissions as granted or ready.

First implementation slice:

- Render `PermissionGuideDialog` on first run or permission restart resume.
- Include microphone, camera, accessibility and voice service rows.
- Use Reo shadcn/Radix primitives: `Dialog`, `FieldGroup`, `FieldRow`, `FieldLabel`, `FieldHint`, `FieldControl`, `Badge` and `Button`.
- Use `Badge` only for passive right-side status; render `Button` while microphone, camera or accessibility are not granted.
- Route voice setup to the existing `VoiceSettingsPanel` boundary instead of owning credentials in onboarding.
- Keep local workspace setup and guided example memory space for the follow-up phase.

## Permission Item State Model

Every permission row uses the same conceptual state shape:

- `checking`: Reo is refreshing the OS/app state.
- `granted`: permission is available.
- `not-determined`: user has not answered yet.
- `denied`: user denied or revoked permission.
- `restricted`: OS policy prevents access.
- `unknown`: Reo cannot detect state for this permission in the current implementation.
- `restart-required`: user completed a step but macOS requires Reo to restart before the app can observe or use the new state.

Rows have:

- status label
- short reason
- primary action
- secondary action when useful
- last checked timestamp only when it improves recovery

## Permission Items

### Microphone

Current consumer: `录下来` and recording supplements.

First-run action:

- Show `测试麦克风`.
- Use existing one-shot microphone intent semantics.
- If a system Draft workspace handle is needed to preserve current security boundaries, open Draft in the background and do not create a finalized recording.
- Stop media tracks immediately after the permission/test succeeds.

Action-time resolver:

- When the user clicks `录下来` and microphone is not available, open the guide focused on microphone.
- After grant, continue into the recording flow.
- Do not preserve old `workspaceHandle`, pending intent or draft across app restart.

### Camera

Current permission consumer: first-run/settings permission setup. `拍下来` is still disabled and photo/video capture remains outside this slice.

Current guide behavior:

- Include a camera row with a real request action.
- Main requests camera permission with `systemPreferences.askForMediaAccess('camera')`.
- If macOS does not report `granted` after the request, return `restartRequired` and keep the guide focused on camera after restart.
- Do not call `getUserMedia({ video: true })`.
- Do not change current permission policy to allow video.

Future capture resolver:

- When `拍下来`, photo Segment, or video Segment becomes real, camera permission must use the same resolver pattern as microphone.
- The implementation must add a real file contract, IPC/preload contract, recovery path and operation validation before camera permission is requested.

### Accessibility

Current permission consumer: first-run/settings permission setup for macOS trusted Accessibility client state.

Current guide behavior:

- Include an accessibility row with a real request action.
- Main reads status with `systemPreferences.isTrustedAccessibilityClient(false)`.
- Main prompts with `systemPreferences.isTrustedAccessibilityClient(true)`.
- If macOS does not report `granted` after the prompt, return `restartRequired` and keep the guide focused on accessibility after restart.
- Do not imply it is required for recording, writing notes, creating works, opening local memory spaces or prompt-bridge.

## Restart Handling

Onboarding state persists across app restarts with no secrets and no raw paths. It records only:

- whether the user has seen the guide
- whether the user skipped first-run setup
- the last focused permission item
- any `restart-required` resume marker
- timestamp/version metadata

On app startup:

- If first-run has not been seen, render the guide first.
- If a resume marker says a permission is restart-required, render the guide first and focus that row.
- Refresh permission statuses before presenting the row result.
- If the permission is now granted, show a `继续` action for the interrupted feature only when the feature can be safely resumed without stale handles.

Reo must not persist transient runtime capability tokens, `workspaceHandle`, pending media intent, MediaStream, recording draft owner, or user secret in onboarding state.

## Settings Integration

After first-run, Settings gains a `权限与设置` entry or a first-class `权限` entry plus existing `语音`.

The same permission rows should be reused in Settings. First-run and action-time resolver should not fork copy, status logic or action semantics.

Voice settings stay in `VoiceSettingsPanel` or a thin composition around it. The first-run guide may embed the same controls or route to the same panel, but it must not create a second key owner.

## Guided Example Memory Space

This is a follow-up phase, not the first slice.

Design direction:

- Create or import one guided example memory space after the permissions/settings guide.
- It should demonstrate common Reo objects: recording, note, work/artifact and widget/component.
- It must use current workspace file contracts.
- Runtime examples must use `entry.html`, `runtime.json`, `state.json` and `assets/`.
- It must not write outside the intended workspace object files.
- It must not create `.reo` as user semantic content.

## Later In-Product Guidance

This is the third phase.

The guide should teach by context:

- first recording
- first note
- first work prompt copy
- first Memory creation
- first example-space exploration

It should not become a persistent tour overlay that competes with the studio surface.

## Implementation Implications

Likely implementation units:

- App-level onboarding state owner.
- Permission status query and row model.
- First-run guide surface.
- Settings integration.
- Action-time permission resolver for recording.
- Focus/resume model after permission restart.

Risk-bearing implementation requires TDD:

- Any new preload/IPC surface.
- Any media permission status or request channel.
- Any shell/system-settings opener.
- Any permission policy change.
- Any app restart resume behavior.
- Any action-time resolver that continues a recording or capture flow.

Low-risk renderer-only copy/layout can use focused component tests and runtime visual verification.

## Non-Goals

- Do not integrate the Swift/AppKit PermissionFlow library in this slice.
- Do not allow renderer video capture just because camera permission is requestable in the setup guide.
- Do not expose System Settings paths, native tokens, generic shell openers or broad native helpers for Accessibility.
- Do not loosen Electron sandbox, contextIsolation, nodeIntegration, CSP, navigation, shell or permission boundaries.
- Do not create generic permission runtime, generic IPC, generic shell opener or broad native helper.
- Do not store secrets, raw paths or transient handles in onboarding state.
- Do not block Home/草稿 just because optional permissions are incomplete.

## Success Criteria

- A new user sees a setup guide on first launch.
- The user can skip setup and still enter Reo.
- Clicking `录下来` without microphone access opens the guide focused on microphone.
- If macOS requires restart, restarting Reo returns to the guide and refreshes permission state.
- Voice service setup reuses existing main-owned voice settings.
- Camera and Accessibility are current requestable rows with explicit user actions.
- No permission is requested without an explicit user action.

## Implementation Evidence

Implemented in this slice:

- App-level onboarding state in `src/renderer/src/onboarding/onboardingState.ts`.
- First-run/action-time permission guide in `src/renderer/src/onboarding/PermissionGuideDialog.tsx`.
- Shared `Badge` primitive in `src/renderer/src/components/ui/badge.tsx`.
- Settings `权限` section in `src/renderer/src/settings/PermissionSettingsPanel.tsx`.
- Application-scoped permission status/request IPC in `src/workspace-contract/*`, `src/preload/workspaceBridge.ts` and `src/main/workspaceIpc.ts`.
- Home `录下来` action-time resolver in `src/renderer/src/App.tsx`.

Verification run after implementation:

- `npm run test:renderer -- src/renderer/src/components/ui/badge.test.tsx src/renderer/src/onboarding/PermissionGuideDialog.test.tsx src/renderer/src/settings/PermissionSettingsPanel.test.tsx --project renderer-jsdom-components`: 3 files, 8 tests passed.
- `npm run test:renderer -- src/renderer/src/App.test.tsx --project renderer-jsdom-workflows -t "permission guide|Record when microphone|permission settings"`: 4 tests passed, 153 skipped by filter.
- `MAIN_TEST_FILES=test/main/workspaceContract.test.ts,test/main/workspaceBridgeSurface.test.ts,test/main/workspaceIpc.test.ts npm run test:main`: 299 tests passed.
- `npm run test:renderer -- src/renderer/src/workspace/workspaceApi.test.ts --project renderer-jsdom-browser`: 6 tests passed.
- `npm run test:renderer -- src/renderer/src/settings/appPermissionQueries.test.ts --project renderer-jsdom-browser`: 3 tests passed.
- `npm run test:renderer -- src/renderer/src/settings/SettingsShell.test.tsx --project renderer-jsdom-components`: 4 tests passed.
- `npm run test:renderer -- src/renderer/src/onboarding/onboardingState.test.ts --project renderer-jsdom-browser`: 4 tests passed.
- `npm run verify:quick`: typecheck passed; renderer quick passed 55 files / 515 tests; main passed 1097 tests with 1 skipped live-provider test; `lint:strict` and `format:check` passed.

Runtime visual evidence:

- Temporary Electron visual check against `http://localhost:5183/?reoScenario=memory-studio-rich`.
- Screenshot: `.tmp/permission-guide-visual.png`.
- Screenshot: `.tmp/permission-settings-visual.png`.
- Captured dialog state: `data-state="open"`, opacity `1`, 4 permission/settings rows, 680px width, 542px height, row radius 12px, button radius 12px.

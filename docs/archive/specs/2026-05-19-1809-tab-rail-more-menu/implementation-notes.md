# Implementation Notes

## 2026-05-19 18:09 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Decision:
  - 将用户反馈的 tab rail More 菜单问题作为 initiative 收口前的独立 bugfix spec，而不是塞回已归档的 note create/edit sub-spec。
- Reason:
  - 四个 implementation sub-spec 已完成归档；该问题属于已交付 UI 复用合同的回归修复，需要独立 RED / GREEN / REFACTOR 证据并保持 active specs 单一。
- Constraints:
  - 不重做 Memory Studio 页面。
  - More 菜单必须复用现有 tab rail、实体菜单与视觉模式。
  - 审查时继续对照 `docs/archive/specs/2026-05-19-0111-note-foundation-design/` 原始设计约束。

## 2026-05-19 18:13 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- RED evidence:
  - `npm run test:renderer -- --run src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "visible supplement identity"`
    failed because the primary tab More trigger did not stop `pointerDown` propagation.
- Test correction:
  - The first RED assertion used `cancelBubble`; jsdom did not reflect React synthetic `stopPropagation()` back into that
    field reliably. The assertion now spies on the native event `stopPropagation` method directly while still verifying
    that click opens the menu.
- GREEN fix:
  - `MemoryStudio.tsx` now uses one `stopContentTabMoreEventPropagation` helper for primary and SegmentSupplement More
    triggers.
  - The helper is applied to `pointerDown`, `mouseDown`, `click`, and `dragStart` without calling `preventDefault`, so
    Radix menu trigger behavior remains intact.
- GREEN evidence:
  - `npm run test:renderer -- --run src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "visible supplement identity"`
    passed with 1 targeted test and 45 skipped.
  - `npm run test:renderer -- --run src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "visible supplement identity|opens the SegmentSupplement sibling More menu|keeps the SegmentSupplement More affordance|content tab More"`
    passed with 4 targeted tests and 42 skipped.
  - `npm run typecheck:quick` passed.

## 2026-05-19 18:19 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Phase gate verification:
  - `npm run verify:quick` passed with the current workspace state: typecheck, 802 main tests, 469 renderer tests,
    `lint:strict`, and `format:check`.

## 2026-05-19 18:31 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- Independent gate evidence:
  - `/review` gate passed with no BLOCKER / MAJOR.
  - `$ycksimplify` gate passed after extracting shared `ContentTabMoreTrigger` and expanding the test helper to cover
    `dragStart`.
- Final verification after `$ycksimplify` edits:
  - `npm run verify:quick` passed with the current workspace state: typecheck, 802 main tests, 469 renderer tests,
    `lint:strict`, and `format:check`.
- Status:
  - Tab rail More menu fix is ready to archive.

## 2026-05-19 18:21 America/Los_Angeles

- Commit anchor: `4e7e5e69`
- `$ycksimplify` cleanup:
  - `MemoryStudio.tsx` now uses one `ContentTabMoreTrigger` for primary and SegmentSupplement tab rail More buttons, so
    the reveal classes, event isolation handlers, icon markup, focusability and aria-hidden behavior stay in one
    expression.
  - `LoadedWorkspaceFrame.test.tsx` now exercises the shared More trigger helper against `pointerDown`, `mouseDown`,
    `dragStart` and `click`; `click` still proves the Radix menu opens after propagation isolation.
- Verification:
  - First focused rerun failed because the extracted trigger did not forward Radix `asChild` props/ref. The trigger now
    uses `forwardRef`, spreads injected button props, and composes Radix handlers after event propagation isolation.
  - `npm run test:renderer -- --run src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --testNamePattern "visible supplement identity|opens the SegmentSupplement sibling More menu|keeps the SegmentSupplement More affordance|content tab More"`
    passed with 4 targeted tests and 42 skipped.
  - `npm run typecheck:quick` passed.
  - `npm run format:check` passed.
  - `npx eslint src/renderer/src/workspace/MemoryStudio.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx --max-warnings=0`
    passed.
  - `git diff --check -- src/renderer/src/workspace/MemoryStudio.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx docs/specs/2026-05-19-1809-tab-rail-more-menu/implementation-notes.md`
    passed.

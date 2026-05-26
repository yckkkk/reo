# Tiptap 官方基线与文件实时同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `test-driven-development` for watcher, autosave, IPC, conflict and persistence changes. Steps use checkbox syntax for tracking.

**Goal:** 让 Reo 记忆空间在普通文件被人类或 Codex 直接修改后自动收敛，并把编辑器正常路径切换到 Tiptap 官方模型 + autosave，而不是显式保存和手动刷新。

**Architecture:** Main process owns active workspace file watcher and event coalescing. Renderer receives safe file-truth event through preload, then uses a centralized refresh coordinator to read file truth and update App projection plus TanStack Query caches. Tiptap owns editor schema, Markdown import/export, commands, toolbar state and renderer content errors. Reo owns Markdown/sidecar file truth, CAS baselines, atomic write, recovery, Electron security and needs-review.

**Tech Stack:** Electron main/preload IPC, TypeScript, Node fs/chokidar evaluation, TanStack Query, Tiptap React, `@tiptap/markdown`, Vitest/node:test, Playwright or browser runtime verification where needed.

---

## Task 1: Official Tiptap Baseline Audit

- [x] Diff local `components/tiptap-*`, `hooks/use-tiptap-editor`, `lib/tiptap-utils` and `LightweightMarkdownEditorSurface` against the current official Tiptap/Simple Editor model.
- [x] Define the official template import boundary before touching toolbar/template code: full official template alignment, explicit fork, or Reo-only boundary wrapper. No piecemeal toolbar fixes are allowed.
- [x] Classify every local divergence as:
  - Reo boundary thin adapter.
  - Replace with official command/state/content-error model.
  - Remove as old workaround.
  - Requires fork-level ownership.
- [x] If replacing local toolbar/template code, replace by official-current capability groups rather than individually selected controls or local symptom patches.
- [x] Add direct package dependencies for any Tiptap packages imported directly.
- [x] Document only stable boundaries in current docs after implementation.

## Task 2: Renderer Content Error And Rich New-Note Path

- [x] Add failing renderer tests for invalid or unsupported `content.tiptap.json` entering the editor and surfacing through a Reo recovery state.
- [x] Add failing renderer/main tests proving new Note/Supplement autosave keeps Tiptap JSON rich marks from first durable write.
- [x] Wire Tiptap `contentError` / content check options in the editor boundary.
- [x] Replace new Note overlay Markdown-only `onChange` persistence with the same Markdown + Tiptap JSON payload shape used by finalized content.

## Task 3: Autosave State Machine

- [x] Add failing tests for typing into Segment body, SegmentSupplement body and transcript edit:
  - Local update schedules autosave.
  - Successful write clears pending state.
  - Stale write preserves local input and exposes disk version.
  - Navigation is not blocked for ordinary dirty state after autosave settles.
- [x] Replace explicit save-oriented reducer actions with autosave states: idle, dirty-debouncing, saving, synced, conflict, error.
- [x] Remove save/cancel controls as normal editing path while preserving a small status/error/conflict surface.
- [x] Keep user-visible recovery for conflict/error without making normal users reason about hash or sidecar.

## Task 4: Main-Owned File Watcher Event

- [x] Evaluate official Node watcher behavior and mature watcher package fit for Electron local workspaces; prefer chokidar if it materially improves cross-platform reliability and ignore patterns.
- [x] Add main/preload/contract tests for:
  - watcher lifecycle per active workspace/session.
  - burst coalescing and atomic-write settlement.
  - ignored temp/lock/cache artifacts.
  - subscription cleanup on close/switch.
  - no raw path or raw Electron event exposure.
- [x] Implement main-owned watcher and safe preload subscription.
- [x] Ensure Reo-origin writes do not create harmful echo loops.

## Task 5: Unified Refresh Coordinator

- [x] Add renderer tests proving file event refreshes current visible content without visibility change, reselect or tab click.
- [x] Centralize current `refreshWorkspaceFromFileTruth` and query invalidation so snapshot/detail/content projections update together.
- [x] Treat same-snapshot body-only events as content refresh and relevant Memory detail invalidation.
- [x] Keep initial open, reopen, visibility visible, reselect and tab-click refresh as fallback paths.
- [x] Add race tests for stale session events, pending Segment delete projection, rename/delete echo and active local edit.

## Task 6: External File Operation E2E

- [x] Use the test memory space and at least one new temporary memory space.
- [x] List the file-truth refresh state machine and invariants before treating E2E evidence as meaningful.
- [x] Split E2E into small direct-file scenarios rather than one broad script:
  - [x] edit current Segment Markdown.
  - [x] edit current Segment `content.tiptap.json` for highlighter/underline-style rich mark.
  - [x] create Memory.
  - [x] create Segment.
  - [x] create SegmentSupplement.
  - [x] rename Memory.
  - [x] rename Segment.
  - [x] rename SegmentSupplement.
  - [x] move Segment across Memory.
  - [x] move SegmentSupplement across Segment.
- [x] Assert key branches and side effects for every scenario: read model projection, manifest/parent repair, sidecar/hash preservation, doctor result and/or UI/query refresh.
- [x] Confirm Reo UI updates without manual refresh/click.
- [x] Confirm deterministic repairs happen silently and ambiguous cases enter needs-review instead of being rejected.

## Task 7: Docs, Review, And Gates

- [x] Update `docs/current/architecture.md`, `docs/current/data.md`, `docs/current/electron.md`, `docs/current/flow.md`, `docs/current/frontend.md` and/or `docs/current/quality.md` only for stable changed facts.
- [x] Update generated memory-space `AGENTS.md` / skills only if the agent-facing fast path materially changes.
- [x] Run `$review` and `$ycksimplify` subagents after implementation.
- [x] Run focused tests.
- [x] Run `npm run verify:quick`.
- [x] Record evidence here and archive this spec after implementation/docs compression.

## Evidence

- Intent alignment locked on 2026-05-26:
  - 首期边界：模型替换。
  - Tiptap 基线：官方基线。
- Read-only subagent audits completed:
  - Tiptap official-model drift.
  - Old save/dirty/manual refresh model.
  - Watcher/live refresh and Query projection gaps.
- Context7 official docs checked:
  - Tiptap Markdown and React editor patterns.
  - Electron secure IPC event wrapper.
  - TanStack Query invalidation/refetch behavior.
- Official Tiptap simple-editor CLI baseline checked on 2026-05-26:
  - Current generated reusable component file set is present after normalizing Reo's `components/` mount.
  - Official `tiptap-templates/simple/*` remains a non-mounted reference shell; Reo's product entry is `LightweightMarkdownEditorSurface`, a boundary wrapper for Markdown file truth, attachments, Chinese labels, theme owner and Electron constraints.
  - No toolbar/template behavior was changed piecemeal in this slice.
- Focused main watcher/contract tests passed: `MAIN_TEST_FILES=test/main/workspaceContract.test.ts,test/main/workspaceBridgeSurface.test.ts,test/main/workspaceFileTruthWatcher.test.ts npm run test:main`.
- Focused renderer file event tests passed: `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "file truth events|document becomes visible"`.
- `npm run typecheck:quick` passed after watcher/content-error contract changes.
- Focused rich draft tests passed: `MAIN_TEST_FILES=test/main/noteDrafts.test.ts npm run test:main`.
- Focused renderer autosave tests passed: `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`.
- Focused new-note rich payload tests passed: `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/NoteEditorOverlay.test.tsx`.
- `$review` / `$ycksimplify` subagents completed:
  - Adopted: watcher `followSymlinks: false`, `.part` ignore, redacted watcher diagnostics, draft metadata/Markdown/sidecar rollback, draft Tiptap JSON dirty tracking, IPC renderer-event helper and close callback cleanup.
  - Rejected: deleting unmounted official Tiptap template files solely because they have no current consumer. This would reintroduce piecemeal Tiptap adoption; official template files remain treated as the complete official baseline while Reo product entry stays a thin boundary wrapper.
- Codex CLI E2E 1 passed in the test memory space `reo文件区/reo测试工作区/测试`:
  - Command shape: `codex exec --skip-git-repo-check -C '../reo文件区/reo测试工作区/测试' -s workspace-write --output-last-message /tmp/reo-codex-e2e-last-message.md ...`.
  - Created Memory, created Segment, created SegmentSupplement, renamed Memory, renamed Segment, moved Segment across Memory, edited Segment Markdown with toolbar-visible highlight/underline syntax.
  - `node skills/reo-doctor/scripts/reo-doctor.mjs` returned `ok: true`.
- Codex CLI E2E 2 passed in the same test memory space:
  - Renamed and moved `sup_agent_codex_live_1779792000` across Segment.
  - Directly edited `content.tiptap.json` with one text node carrying both `underline` and purple `highlight` marks.
  - `node skills/reo-doctor/scripts/reo-doctor.mjs` returned `ok: true`.
- Codex CLI E2E 3 passed in a new temporary memory space `reo文件区/reo测试工作区/Agent临时记忆空间1779793200`:
  - Reo initialized the memory space file contract.
  - Codex created Memory, Segment and SegmentSupplement through normal Markdown files with heading, blue highlight HTML mark and underline syntax.
  - Initial read model exposed that agent-created `memory.md` may include a redundant `id` field; added a RED/GREEN main test and allowed this field as tolerated redundant metadata while keeping Memory id truth in the directory prefix.
  - `readWorkspaceSnapshotFromFileTruth` returned the new Memory with `segmentCount: 1`, `noteSegmentCount: 1` and `supplementCount: 1`; `reo-doctor` returned `ok: true`.
- TDD evidence for E2E-discovered branch:
  - RED: `MAIN_TEST_FILES=test/main/memoryFiles.test.ts npm run test:main -- --test-name-pattern "frontmatter id remains"` failed before schema tolerance.
  - GREEN: same command passed after allowing redundant Memory `id` while preserving directory prefix as identity truth.
- Focused watcher/draft regression tests passed after subagent fixes: `MAIN_TEST_FILES=test/main/workspaceFileTruthWatcher.test.ts,test/main/noteDrafts.test.ts npm run test:main`.
- Focused memory redundant-id regression test passed: `MAIN_TEST_FILES=test/main/memoryFiles.test.ts npm run test:main -- --test-name-pattern "frontmatter id remains"`.
- Focused renderer component tests passed after aligning tests to autosave/current Tiptap JSON contract:
  - `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx`: 125 passed.
  - `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/NoteEditorOverlay.test.tsx src/renderer/src/workspace/LightweightMarkdownEditorSurface.test.tsx src/renderer/src/workspace/inlineMarkdownEditorState.test.tsx`: 91 passed.
- Final gate passed after formatting the official generated hook file:
  - `npm run verify:quick`: main 879 passed, renderer 490 passed, `lint:strict` passed, `format:check` passed.
  - `git diff --check`: passed.

# Agent 快路径与 Reo Doctor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `test-driven-development` for implementation. Steps use checkbox syntax for tracking.

**Goal:** 让 Reo 记忆空间对 agent 的默认入口变成“直接编辑文件即可”：`AGENTS.md` 只做定义和技能导航，`reo-edit` 处理普通文件操作范式，`reo-doctor` 处理异常诊断。

**Architecture:** `workspaceFiles` owns memory-space root bootstrap and open-time managed config reconciliation. Generated memory-space `AGENTS.md` keeps Reo definitions and skill navigation; `skills/reo-edit` keeps ordinary edit/create/rename/move examples; `skills/reo-doctor` bundles deterministic repair scripts inside the skill directory. Existing sidecar/hash repair remains in the read model; this slice changes the agent-facing entry and missing managed config repair.

**Tech Stack:** Electron main process, TypeScript, Node fs, Zod, node:test, Codex skills folder conventions.

---

## Task 1: Managed Agent Config Contract

- [x] Add failing main tests:
  - New workspace creates root `AGENTS.md`, `skills/reo-edit/SKILL.md`, `skills/reo-doctor/SKILL.md`, and `skills/reo-doctor/scripts/reo-doctor.mjs`.
  - Existing workspace missing those files gets them on open.
  - Existing custom `AGENTS.md` keeps user content and receives/updates only the Reo managed block.
- [x] Run RED: `MAIN_TEST_FILES=test/main/workspaceFiles.test.ts npm run test:main`.
- [x] Implement managed block constants, skill templates, script templates and open-time reconciliation.
- [x] Run GREEN.

## Task 2: Reo Doctor Skill Script

- [x] Add failing tests for doctor script content and execution:
  - Script detects missing managed config in a fixture workspace.
  - Script repairs only Reo managed AGENTS block and managed skill files.
  - Script does not overwrite custom user AGENTS content.
- [x] Run RED focused tests.
- [x] Implement skill-bundled script behavior.
- [x] Run GREEN.

## Task 3: Agent Entry And Edit Skill Split

- [x] Rewrite generated `AGENTS.md` around definitions and navigation:
  - Reo / Memory space / Memory / Segment / SegmentSupplement definitions.
  - File-layer ownership for `memories/`, `.reo/`, `content.tiptap.json` and `skills/`.
  - Links to `skills/reo-edit/SKILL.md` and `skills/reo-doctor/SKILL.md`.
  - Agent can edit any file; general tasks should not reason about hash/sidecar.
- [x] Add `skills/reo-edit/SKILL.md`:
  - Normal edit/create/rename/move task map.
  - Memory / Segment / Supplement minimal Markdown shapes.
  - Tiptap toolbar rich-text Markdown/HTML examples and supported highlight colors.
- [x] Update tests that assert template content.

## Task 4: Docs And Evidence

- [x] Update `docs/current/architecture.md`, `docs/current/data.md`, `docs/current/electron.md`, `docs/current/flow.md` and/or `docs/current/quality.md` only for stable changed facts.
- [x] Run Codex CLI E2E against the test memory space with normal edit prompts that do not mention sidecar/hash:
  - Rename memory space.
  - Rename Memory.
  - Rename Segment.
  - Rename SegmentSupplement.
  - Create Memory.
  - Create Segment.
  - Create SegmentSupplement.
  - Edit Segment Markdown body.
- [ ] Record evidence here.

Evidence:

- Focused RED failed because new workspaces did not create `skills/`, open did not restore missing `AGENTS.md`, custom `AGENTS.md` did not receive a managed block, and the doctor script did not exist.
- Focused GREEN passed: `MAIN_TEST_FILES=test/main/workspaceFiles.test.ts npm run test:main` ran 33 tests with 33 pass.
- Test memory space `/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试` was opened through `openWorkspaceFiles`; legacy AGENTS text containing `source.hash` was replaced by the fast-path managed entry and `skills/reo-doctor` was written.
- First Codex CLI smoke used current CLI syntax without `-p`: `codex -a never exec -C <test-space> --skip-git-repo-check --sandbox danger-full-access -`.
- First Codex prompt asked only to read `AGENTS.md` and edit `segment.md`; it completed in 32 seconds with 4,084 tokens, only edited `memories/mem_20260519032914_666583be--碎片记录/segments/seg_20260526013336_a2815d52--笔记2/segment.md`, and explicitly chose not to maintain `.reo` or rich-structure files.
- Reo `readFinalizedNoteSegmentContent` then projected that Markdown-only edit, returned 64-char Markdown and Tiptap baselines, and `content.tiptap.json` contained marker `1779820033`.
- After AGENTS/skill split, focused main tests passed: `MAIN_TEST_FILES=test/main/workspaceFiles.test.ts,test/main/workspaceIpc.test.ts,test/main/memoryFiles.test.ts npm run test:main` ran 395 tests with 395 pass.
- Full Codex CLI E2E used the current prompt argument path because `codex exec --help` shows `-p` is `--profile`, not prompt. Command shape: `codex -a never exec -C <test-parent> --skip-git-repo-check --sandbox danger-full-access '<prompt>'`.
- Full Codex CLI E2E target: `/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/agent-fast-path-e2e-1779801183153`. Codex read generated `AGENTS.md`, then `skills/reo-edit/SKILL.md`, renamed the memory space to `agent-fast-path-e2e-1779801183153-renamed`, created and renamed Memory `mem_cli_e2e_1779801183153--Agent 改名记忆`, Segment `seg_cli_e2e_1779801183153--Agent 改名片段`, and Supplement `sup_cli_e2e_1779801183153--Agent 改名补充`, wrote Markdown bodies with marker `Agent 全面快路径 E2E 1779801183153`, and did not edit `.reo`.
- Reo projection verification opened the renamed root, refreshed file truth, projected workspace title `agent-fast-path-e2e-1779801183153-renamed`, Memory title `Agent 改名记忆`, Segment title `Agent 改名片段`, Supplement title `Agent 改名补充`, and generated matching `content.tiptap.json` baselines for Segment and Supplement note bodies.
- `$review` and `$ycksimplify` subagents found hardening issues. Fixes added before final gates:
  - `reo-doctor.mjs --fix` no longer treats symlink/non-file leaves as missing and no longer writes through unsafe managed skill paths.
  - open-time managed config reconciliation validates/creates managed directories and reads managed file shapes before writing `AGENTS.md`, so unsafe skill paths do not leave `AGENTS.md` partially updated.
  - direct Memory Markdown manifest repair is explicit to projection/index refresh paths and uses no-replace manifest writes with `EEXIST` reread instead of `exists -> write`.
- Post-review targeted tests passed: `MAIN_TEST_FILES=test/main/workspaceFiles.test.ts,test/main/memoryFiles.test.ts npm run test:main -- --test-name-pattern "reo-doctor skill script does not overwrite symlink targets|open workspace does not update AGENTS before rejecting unsafe managed skill paths|segment id lookup does not repair direct memory Markdown manifests"`.
- Broader affected main tests passed after fixes: `MAIN_TEST_FILES=test/main/workspaceFiles.test.ts,test/main/workspaceIpc.test.ts,test/main/memoryFiles.test.ts npm run test:main` ran 398 tests with 398 pass.
- `npm run typecheck:quick` passed after post-review fixes.
- Final `npm run verify:quick` passed: `typecheck:quick`, main tests with 43 files and 485 tests passing, `lint:strict`, and `format:check`.

## Task 5: Final Gates

- [x] Run targeted main tests.
- [x] Run `npm run verify:quick`.
- [x] Archive this spec after implementation and docs compression.

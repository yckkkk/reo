# Foundation Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement one task at a time. Steps use checkbox (`- [ ]`) syntax for tracking. Do not use the Superpowers default `docs/superpowers/*` paths in this repo.

**Goal:** 在正式功能开发前，以 10 个可验证 foundation slice 补齐或明确推迟 Reo 基础建设。

**Architecture:** Initiative 只保存长期路线和门槛。每个 session 创建自己的 `docs/specs/YYYY-MM-DD-HHMM-slug/`，完成后归档到 `docs/archive/specs/*`，长期事实压缩回 `docs/current/*` 或 `docs/decisions/*`。

**Tech Stack:** Electron、React 19、TypeScript、electron-vite/Vite、Tailwind v4；后续仅在对应 slice 证明真实用途时评估 Vitest、Drizzle、Better Auth、TanStack Query、Zustand、React Hook Form、Zod、shadcn/ui、Electron Forge、electron-updater、Sentry、electron-log。

---

## 总体节奏

10 天是路线节奏，不是承诺每天安装一个基础包。每个子任务必须先创建当前 session spec，再决定是否需要代码、依赖或仅文档收口。

```text
Day 01  Scope / gates
Day 02  Quality / test
Day 03  Electron runtime readiness
Day 04  Data foundation
Day 05  Auth foundation
Day 06  Query / state / forms
Day 07  Component / UI foundation gate
Day 08  Logging / errors
Day 09  Packaging / updates
Day 10  Full closeout
```

## 文件结构

- `docs/initiatives/2026-05-05-foundation-completion/README.md`：initiative 入口和完成条件。
- `docs/initiatives/2026-05-05-foundation-completion/spec.md`：scope、非目标、官方资料矩阵。
- `docs/initiatives/2026-05-05-foundation-completion/plan.md`：10 个 slice 的执行计划。
- `docs/initiatives/2026-05-05-foundation-completion/tasks.md`：跨 session 状态。
- `docs/initiatives/2026-05-05-foundation-completion/review.md`：plan review、失败模式、测试策略、独立挑战。
- `docs/initiatives/README.md`：active initiative 索引。
- `docs/specs/YYYY-MM-DD-HHMM-*/`：每个 session 的临时工作区，完成后归档。

## Task 01: Initiative scope and gates

**Files:**

- Modify: `docs/initiatives/README.md`
- Create: `docs/initiatives/2026-05-05-foundation-completion/README.md`
- Create: `docs/initiatives/2026-05-05-foundation-completion/spec.md`
- Create: `docs/initiatives/2026-05-05-foundation-completion/plan.md`
- Create: `docs/initiatives/2026-05-05-foundation-completion/tasks.md`
- Create: `docs/initiatives/2026-05-05-foundation-completion/review.md`
- Create then archive: `docs/specs/YYYY-MM-DD-HHMM-foundation-completion-planning/`

- [x] **Step 1: Confirm repo state**

Run: `git status --short`

Expected: no output.

- [x] **Step 2: Confirm lifecycle state**

Run: `find docs/specs -mindepth 1 -maxdepth 1 -print`

Expected: no output before creating the current planning spec.

- [x] **Step 3: Review required current truth**

Read: `AGENTS.md`, `README.md`, `docs/README.md`, `docs/current/foundation.md`, `docs/current/architecture.md`, `docs/current/electron.md`, `docs/current/frontend.md`, `docs/current/quality.md`, `docs/current/data.md`, `docs/current/flow.md`.

- [x] **Step 4: Verify official docs**

Use Context7 and official docs listed in `spec.md`.

- [x] **Step 5: Write initiative and planning spec**

Write only docs. Do not install dependencies or change runtime code.

- [x] **Step 6: Run plan review**

Record scope challenge, existing state, non-goals, failure modes, test strategy, sequence analysis and independent challenge in `review.md`.

- [x] **Step 7: Verify, review and prepare commit**

Run required checks, archive planning spec, run independent `$review` style subagents and Claude CLI review. The final commit hash is reported by the session output after `git commit`.

## Task 02: Quality/Test completion

**Goal:** Decide whether Vitest is now justified, and if yes, introduce it only for renderer/component/browser test pressure.

**Required current docs:** `docs/current/quality.md`, `docs/current/frontend.md`.

**Expected slice spec:** `docs/specs/YYYY-MM-DD-HHMM-quality-test-completion/`.

- [x] Start by proving whether current Node test runner is insufficient.
- [x] If no renderer/component behavior exists, keep Vitest deferred and update docs only.
- [x] Vitest was not introduced; RED test for a Vitest consumer is not applicable in this slice.
- [x] `verify:quick` was not changed because no new test runner proved value.
- [x] Run `npm run verify:quick`, `npm run build`, `git diff --check`.

**Install allowed:** only if a real renderer/component/browser test consumer exists.

## Task 03: Electron runtime readiness

**Goal:** Decide whether Reo has a real privileged capability that requires preload/IPC.

**Required current docs:** `docs/current/electron.md`, `docs/current/flow.md`, `docs/current/quality.md`.

**Expected slice spec:** `docs/specs/YYYY-MM-DD-HHMM-electron-runtime-readiness/`.

- [x] Inventory any real renderer need for main-process privilege.
- [x] Reject generic bridge, generic command bus and `window.api` dumping ground.
- [x] No real capability exists; TDD for a new IPC contract is not applicable in this slice.
- [x] No IPC channel exists; channel contract requirements remain future gates.
- [x] If no real capability exists, produce a no-op readiness decision and keep preload/IPC absent.
- [x] Run `npm run verify:quick`, `npm run build`, `git diff --check` and any runtime evidence required by `docs/current/electron.md`.

**Install allowed:** Zod only if the same slice implements a real runtime boundary that needs validation.

## Task 04: Data foundation

**Goal:** Establish local durable data only when a real non-product foundation need exists.

**Required current docs:** `docs/current/data.md`, `docs/current/flow.md`, `docs/current/electron.md`.

**Expected slice spec:** `docs/specs/YYYY-MM-DD-HHMM-data-foundation/`.

- [x] No durable data contract exists outside product features.
- [x] Drizzle and `better-sqlite3` were not installed.
- [x] No schema relationships exist; migration modeling remains a future gate.
- [x] No migration generation/application plan exists because there is no schema owner.
- [x] DB access remains absent from renderer and main process.
- [x] Run `npm run verify:quick`, `npm run build`, `git diff --check`.

**Install allowed:** Drizzle, `better-sqlite3`, `drizzle-kit`, `@types/better-sqlite3` only with a real schema and migration.

## Task 05: Auth foundation

**Goal:** Decide whether Better Auth Electron support can be introduced without building product auth flow.

**Required current docs:** `docs/current/data.md`, `docs/current/flow.md`, `docs/current/electron.md`, `docs/current/quality.md`.

**Expected slice spec:** `docs/specs/YYYY-MM-DD-HHMM-auth-foundation/`.

- [x] No auth is currently needed before product feature work.
- [x] Better Auth Electron flow requires system browser, PKCE/state, session persistence and renderer visibility, but those remain future gates.
- [x] Auth product screens and business onboarding were refused.
- [x] Auth was not implemented; TDD for session lifecycle is not applicable in this slice.
- [x] Updated data, flow, electron and quality current docs in the same slice.
- [x] Run `npm run verify:quick`, `npm run build`, `git diff --check` and any Electron runtime evidence required by the auth boundary.

**Install allowed:** Better Auth packages only if the slice owns a real session lifecycle and persistence design.

## Task 06: Data fetching, client state and forms

**Goal:** Assign TanStack Query, Zustand, React Hook Form and Zod to real ownership boundaries.

**Required current docs:** `docs/current/data.md`, `docs/current/flow.md`, `docs/current/frontend.md`, `docs/current/quality.md`.

**Expected slice spec:** `docs/specs/YYYY-MM-DD-HHMM-state-form-query-foundation/`.

- [ ] Inventory actual async data, local UI state and form state.
- [ ] Do not install query/store/form packages without a real consumer.
- [ ] Define query key naming, invalidation, optimistic update rollback if a mutation exists.
- [ ] Define Zustand persistence only with storage/version/migration and user-visible recovery.
- [ ] Use Zod at untrusted boundaries, not as decorative type duplication.
- [ ] Run `npm run verify:quick`, `npm run build`, `git diff --check`.

**Install allowed:** only the package needed by the real consumer in the slice.

## Task 07: Component/UI foundation gate

**Goal:** Re-evaluate whether shadcn/ui has a real reusable component consumer.

**Required current docs:** `docs/current/frontend.md`, `docs/current/foundation.md`.

**Expected slice spec:** `docs/specs/YYYY-MM-DD-HHMM-component-ui-foundation/`.

- [ ] Confirm whether a real component consumer exists.
- [ ] If none exists, keep shadcn/ui uninitialized.
- [ ] If one exists, configure renderer alias, `components.json`, Tailwind CSS path and generated component source in the same slice.
- [ ] Ensure generated source immediately serves the real consumer.
- [ ] Keep Reo design system tokens as visual authority.
- [ ] Run `npm run verify:quick`, `npm run build`, `git diff --check`.

**Install allowed:** shadcn/ui related dependencies only with a real generated component consumer.

## Task 08: Logging/error foundation

**Goal:** Establish local diagnostics and error shape before production packaging.

**Required current docs:** `docs/current/quality.md`, `docs/current/electron.md`, `docs/current/flow.md`.

**Expected slice spec:** `docs/specs/YYYY-MM-DD-HHMM-logging-error-foundation/`.

- [ ] Define error categories, user-facing error shape and diagnostic shape.
- [ ] Decide whether local `electron-log` is needed before Sentry.
- [ ] If logging is introduced, define main/renderer/preload boundaries and sensitive data rules.
- [ ] Do not initialize Sentry until DSN, privacy, source map and release environment are defined.
- [ ] Add tests for error normalization and failure paths when behavior changes.
- [ ] Run `npm run verify:quick`, `npm run build`, `git diff --check` and runtime evidence if Electron logging or renderer error capture changes.

**Install allowed:** `electron-log` only with a real diagnostic owner; Sentry only with release/privacy/source-map plan.

## Task 09: Packaging/update foundation

**Goal:** Introduce packaging and update infrastructure only as a coherent release pipeline.

**Required current docs:** `docs/current/electron.md`, `docs/current/quality.md`, `docs/current/flow.md`.

**Expected slice spec:** `docs/specs/YYYY-MM-DD-HHMM-packaging-update-foundation/`.

- [ ] Decide whether to keep electron-vite as build authority and add Forge only for packaging.
- [ ] Define makers, platform targets, ASAR policy, fuses, signing, notarization and artifact output.
- [ ] Do not add updater before release metadata and publish target exist.
- [ ] Add verification for packaged app launch and security fuses where feasible.
- [ ] Keep `out/`, `dist/`, `build/`, `.vite/`, `.tmp/` out of git.
- [ ] Run `npm run verify:quick`, `npm run build`, `git diff --check`, packaged launch evidence and tracked-output checks.

**Install allowed:** Forge/updater packages only when packaging target and verification are in scope.

## Task 10: Full foundation closeout

**Goal:** Close the initiative cleanly and produce the next-session handoff for product feature work.

**Required current docs:** all `docs/current/*`, relevant `docs/decisions/*`.

**Expected slice spec:** `docs/specs/YYYY-MM-DD-HHMM-foundation-closeout/`.

- [ ] Audit every completed slice and compress stable facts into `docs/current/*`.
- [ ] Move durable architecture choices into `docs/decisions/*` only when they are long-lived.
- [ ] Produce verification matrix covering current commands and package/runtime boundaries.
- [ ] Archive all completed specs.
- [ ] Move this initiative to `docs/archive/initiatives/2026-05-05-foundation-completion/`.
- [ ] Run `npm run verify:quick`, `npm run build`, `git diff --check`, docs lifecycle checks and final multi-review.

**Install allowed:** none by default.

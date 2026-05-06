# Plan Engineering Review

## Scope challenge

结论：10 天 initiative 合理，但只作为路线图。若把它当作单 session 或连续大实现，会违反 Reo 的 one-slice-at-a-time 纪律，并导致空依赖、空目录和 speculative abstraction。

更小替代方案是只规划后续 3 个 slice：Quality/Test、Electron runtime readiness、Data foundation。当前保留 10 个子任务，是因为每个子任务都有独立停止条件，并允许输出 no-op/defer，而不是强制实现。

## What already exists

- Electron main process：`src/main/index.ts`。
- Secure WebPreferences：`src/main/secureWebPreferences.ts`。
- Custom app protocol：`src/main/appProtocol.ts`。
- CSP、navigation、permission policy：`src/main/security.ts`。
- React renderer：`src/renderer/src/main.tsx`。
- Tailwind v4 token foundation：`src/renderer/src/theme.css` 和 `src/renderer/src/index.css`。
- Node test runner main tests：`test/main/devServerUrl.test.ts`。
- Verification scripts：`package.json` 的 `typecheck`、`test:main`、`lint`、`format:check`、`verify:quick`。
- Current docs boundary：`docs/current/*` 已记录 Electron、frontend、quality、data、flow 当前状态。

计划复用这些基础，不重建 parallel runtime、parallel test runner 或 parallel docs layer。

## NOT in scope

- 产品功能：没有 business screen、agent runtime、voice、auth product flow 或 DB domain model。
- 兼容层：产品未发布，不做旧数据、旧 API 或旧 UI compatibility。
- 一次性依赖安装：不批量安装 Vitest、Drizzle、Better Auth、TanStack Query、Zustand、RHF、Zod、Forge、updater、Sentry、electron-log。
- Generic bridge：不创建通用 preload、通用 IPC、通用 command bus 或 broad `window.api`。
- 空组件层：当前不创建 shadcn/ui、`components.json`、`components/ui`、`lib/utils` 或 alias。
- 发布承诺：packaging/update slice 之前不承诺 release channel、signing、notarization 或 auto-update。

## Architecture review

No blocking issue if the initiative remains a route map.

Primary architecture risk is sequence leakage:

```text
Bad path:
  10-day plan
    -> install every selected package
    -> create empty layers
    -> later product code bends around fake foundations

Accepted path:
  initiative route
    -> one spec slice
    -> prove real consumer
    -> implement or defer
    -> verify
    -> archive
```

Each new surface must land with its owner document:

```text
Electron/preload/IPC      -> docs/current/electron.md + flow.md + quality.md
DB/schema/migrations      -> docs/current/data.md + flow.md
Auth/session lifecycle    -> data.md + flow.md + electron.md + quality.md
Query/store/form state    -> data.md + frontend.md + flow.md
Logging/Sentry/errors     -> quality.md + electron.md + flow.md
Packaging/updater/fuses   -> electron.md + quality.md
```

## Code quality review

No code changes in this planning slice.

For later slices, file count is a scope smell. If a slice touches more than one foundation surface, split it unless the second surface is required to verify the first. Example: adding IPC plus Zod contract can be one slice; adding IPC plus DB plus Auth plus Query is too large.

## Test strategy

Planning slice:

- TDD exempt because no runtime behavior changes.
- Required verification: `npm run verify:quick`, `npm run build`, `git diff --check`, docs lifecycle commands, independent review.
- Verification authority for slice evidence is the archived spec `verification.md`. This initiative `review.md` records plan-level review and sequence risks; Task 10 closeout must consolidate the final verification matrix.

Behavior slices:

```text
Behavior spec
  -> RED test from external behavior
  -> minimal implementation
  -> GREEN
  -> refactor if needed
  -> rerun protecting tests
  -> verify:quick/build as required
```

Coverage expectations by slice:

- Quality/Test：test runner config must have failing test evidence before install/config changes.
- Electron runtime：IPC/preload tests must cover allowed sender, invalid sender, invalid input, handler failure, timeout/cancel if supported.
- Data：migration tests must cover empty DB, existing DB, failed migration and transaction rollback.
- Auth：session lifecycle tests must cover request, exchange, persistence, expired/invalid token, renderer visibility and recovery.
- Query/state/forms：tests must cover cache key uniqueness, invalidation/rollback, persisted-state migration and form validation edge cases.
- Logging/error：tests must cover error normalization and no secret leakage in diagnostic payloads.
- Packaging/update：runtime smoke must cover packaged load path, protocol/CSP and artifact exclusion.

Closeout commands required for every slice:

```bash
npm run verify:quick
npm run build
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
git ls-files out dist build .vite .tmp
find docs/specs -mindepth 1 -maxdepth 1 -print
git status --short
git ls-files --others --exclude-standard
```

Electron-surface slices must also run the runtime evidence required by `docs/current/electron.md`.

## Failure modes

| Area              | Failure mode                                        | Required mitigation                                                                   |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Initiative scope  | 10 tasks become one large implementation            | Every session has one spec slice and independent verification.                        |
| Quality/Test      | Vitest installed without renderer behavior          | Require real component/browser consumer or keep Node runner.                          |
| Electron runtime  | Generic bridge leaks privileged capability          | One method per capability, Zod validation, `senderFrame` check, no raw `ipcRenderer`. |
| Data              | Empty DB layer becomes generic persistence bucket   | Require schema relationships and migration owner before install.                      |
| Auth              | Auth product flow sneaks in through foundation work | Limit to lifecycle/persistence boundary or defer.                                     |
| State/query/forms | Zustand/TanStack/RHF installed as placeholders      | Require real async data, local UI state or form state consumer.                       |
| Components        | shadcn source generated with no consumer            | Keep shadcn gated until reusable component pressure exists.                           |
| Logging/Sentry    | Sensitive diagnostics leak into logs/events         | Define redaction and process boundaries before install.                               |
| Packaging/updater | Updater added before signing/publish metadata       | Package first, release metadata second, updater last.                                 |
| Closeout          | Initiative remains active with stale partial truth  | Compress stable facts to current docs, archive initiative.                            |

Critical silent gaps: none in this planning slice because it does not alter runtime behavior.

## Performance review

No runtime performance impact in this planning slice.

Later performance risks:

- Drizzle/SQLite sync driver can block main process if used for heavy work.
- Query invalidation can overfetch if keys are broad.
- Sentry replay/tracing/logs can add runtime and privacy cost if enabled without sampling policy.
- Packaging choices such as ASAR and source maps can affect startup, debugging and update size.

## Parallelization/sequence analysis

Recommended execution is mostly sequential because each foundation surface changes the assumptions of later surfaces.

| Step                       | Modules touched                      | Depends on                                      |
| -------------------------- | ------------------------------------ | ----------------------------------------------- |
| Task 02 Quality/Test       | quality docs, test config            | Task 01                                         |
| Task 03 Electron readiness | main/electron docs, flow docs        | Task 02                                         |
| Task 04 Data               | data docs, main DB boundary          | Task 02, Task 03 if renderer access exists      |
| Task 05 Auth               | auth/data/electron/flow docs         | Task 03, maybe Task 04                          |
| Task 06 Query/state/forms  | frontend/data/flow docs              | Task 04 or Task 05 if server-backed data exists |
| Task 07 Component/UI       | frontend/design docs                 | Task 02, consumer proof                         |
| Task 08 Logging/error      | quality/electron/flow docs           | Task 03                                         |
| Task 09 Packaging/update   | electron/quality/package config      | Task 03, Task 08                                |
| Task 10 Closeout           | all current docs, decisions, archive | all prior tasks                                 |

Parallel lanes:

- Lane A sequential: Task 02 -> Task 03 -> Task 04 -> Task 05 -> Task 06 -> Task 10.
- Lane B conditional: Task 07 can run after Task 02 only if a real reusable UI consumer exists.
- Lane C conditional: Task 08 can run after Task 03 and before Task 09.
- Lane D sequential: Task 09 waits for Task 03 and Task 08.

Default execution: do not parallelize in one shared workspace. If multiple worktrees are used later, keep lanes disjoint and merge only after each slice passes verification.

## Outside voice / independent challenge

Independent challenge to apply before each implementation slice:

- Ask whether the slice has a real current consumer.
- Ask whether an official package already solves the work.
- Ask whether implementation can be reduced to a no-op/defer decision.
- Ask whether the slice is secretly building product feature surface.
- Ask whether docs/current would remain true if implementation failed halfway.

Current reviewer judgment: the largest risk is not missing infrastructure. The risk is pretending foundations are complete by installing packages without real behavior. The plan should prefer boring no-op gates over impressive empty scaffolding.

## Completion summary

- Step 0 Scope Challenge: scope accepted as roadmap only.
- Architecture Review: 0 blockers, 1 standing risk documented.
- Code Quality Review: 0 code issues, file-count scope smell documented for future slices.
- Test Review: planning TDD exempt, behavior-slice test matrix written.
- Performance Review: no planning impact, future risks documented.
- NOT in scope: written.
- What already exists: written.
- TODOs: none proposed; initiative tasks are tracked in `tasks.md`.
- Failure modes: 0 critical silent gaps for this planning slice.
- Outside voice: independent challenge criteria written; pre-commit independent review must still run on the final diff.
- Parallelization: 4 lanes identified, default sequential execution recommended.

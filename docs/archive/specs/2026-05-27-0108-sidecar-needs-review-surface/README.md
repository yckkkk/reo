# Sidecar Needs Review Surface

Timezone: PDT

## Intent

Reo 已能让外部 agent 或人类直接编辑 Markdown、目录和已有 `content.tiptap.json`，并在安全场景下静默收敛。剩余问题是：无法自动判断的冲突现在只进入 main-owned diagnostics，用户和 agent 很难发现，也不知道下一步该打开哪里、用哪个工具恢复。

本 spec 把 sidecar / mirror / 文件空间 needs-review 从“隐藏诊断”提升为当前记忆空间内的可发现 surface。目标不是让 agent 理解 Reo 内部 hash，而是让 Reo 写出可读、可机器解析、相对路径定位的 review 报告，并让 renderer 只显示脱敏汇总。普通编辑仍走 `skills/reo-edit`；只有出现 review 报告时才切到 `skills/reo-doctor`。

## Current Facts

- `docs/current/architecture.md` 已定义：无法确定的冲突进入 needs-review；agent 不应把 `.reo` 当用户语义第二真源。
- `docs/current/data.md` 已定义：candidate needs-review diagnostics 只记录类别和计数，不记录 raw path、title、正文或 id 列表。
- `docs/current/flow.md` 已定义：workspace snapshot refresh 负责 active session 外部合法文件修改与 passive sidecar reconcile。
- `docs/current/electron.md` 要求 renderer/preload DTO 不暴露 raw path；实体路径只能留在 main 或用户可打开的文件系统内。
- 当前 `recordDiagnosticEvent` 只进本地 `main.log`，不是用户/agent 可发现的恢复入口。
- 当前 generated `skills/reo-doctor/scripts/reo-doctor.mjs` 只修复 managed `AGENTS.md` / skill 文件，并输出 unresolved `issues[]`。
- TanStack Query 官方 v5 模型支持在外部事件或 mutation 后用 `invalidateQueries` 标记/刷新 main-backed data；Reo 当前已经在 file-truth event 后刷新 Workspace snapshot 并 invalidates active content query。

## State Machine

```text
Clean
  -> file truth scan or passive sidecar reconcile detects unresolved review item
  -> main writes .reo/review/needs-review.json and .reo/review/needs-review.md
  -> Workspace snapshot returns review summary counts, not raw paths
  -> renderer shows compact workspace review indicator
  -> agent or user runs skills/reo-doctor/scripts/reo-doctor.mjs
  -> doctor prints same report with relative paths and recommended action
  -> user/agent edits ordinary Markdown / sidecar / duplicate directory
  -> next open/snapshot refresh recomputes review report
  -> no unresolved items removes or clears the report
```

## Invariants

- Renderer/preload still never receive raw filesystem paths.
- Review files live under `.reo/review/` and are Reo-managed technical state, not user semantic content.
- Review report entries use workspace-relative POSIX paths only; no absolute root path, no title/body/transcript/Markdown/source hash.
- Diagnostics continue to stay redacted. The report may include relative object paths because it is a local file inside the same memory space, read by the user/agent with filesystem access.
- Reo does not auto-merge sidecar conflicts, unsupported Tiptap JSON, duplicate ids or ambiguous parentage.
- Safe deterministic repair remains automatic; report is only for unresolved items.
- Ordinary agent tasks should not read `.reo/review` unless the report exists or Reo/doctor says review is needed.
- No DB, no Zustand store, no generic diagnostics IPC and no raw path bridge.

## Recommended Design

Add a main-owned workspace review report writer under `.reo/review/`. The report has a strict schema with `schemaVersion`, `updatedAt`, aggregate counts and entries. Entries use stable categories such as `tiptap-sidecar`, `markdown-segment`, `markdown-supplement`; reasons use current review states such as `content-conflict`, `invalid-sidecar`, `unsupported-tiptap-content`, `duplicate-id` and `ambiguous-candidate`. Each entry includes only object type/kind when known and workspace-relative paths like `memories/.../segments/.../content.tiptap.json`.

The read model should collect review entries at the same locations that currently call `recordDiagnosticEvent`. Snapshot refresh writes the report after scanning. If no entries remain, it removes the report files or writes an empty clean report; the chosen behavior must be deterministic and tested. Workspace snapshot gets an optional redacted `review` summary with counts only.

Renderer displays a small, non-blocking workspace review indicator when `snapshot.review.needsReviewCount > 0`. It should not open raw paths. It can tell the user that Reo found file conflicts and that the local `reo-doctor` skill can inspect them. It must not explain hash mechanics or sidecar internals.

`reo-doctor.mjs` should read `.reo/review/needs-review.json` if present, print unresolved items, and keep `--fix` limited to deterministic managed-config repairs. It should not attempt to guess conflict resolution.

## Alternatives Considered

1. Keep diagnostics only.
   This hides the problem from both user and agent, so it fails the current purpose.

2. Put exact review entries directly into Workspace snapshot.
   This would be convenient for UI but violates the current renderer raw-path boundary and increases preload/Query payload sensitivity.

3. Teach agents to infer review by scanning `.reo/objects` and sidecars.
   This recreates the previous mistake: external agents would carry Reo internal complexity. Reo must produce the review report.

## Success Criteria

- A sidecar content conflict produces a deterministic `.reo/review/needs-review.json` entry with relative object path and no absolute path or body text.
- Invalid sidecar JSON and unsupported Tiptap JSON produce separate review entries.
- Duplicate direct note Segment / SegmentSupplement candidates produce review entries without leaking titles or body content.
- Clean snapshot refresh removes or clears stale review reports.
- Workspace snapshot exposes only aggregate review counts.
- Renderer shows a compact visible review indicator when counts are nonzero and hides it when clean.
- `reo-doctor.mjs` reports unresolved review entries and preserves managed config repair behavior.
- `npm run verify:quick` passes before closeout.

## Verification Boundary

This changes public file contract, workspace snapshot contract, recovery workflow and visible UI, so implementation must use focused TDD:

- RED main tests for report generation, redaction and stale report cleanup.
- RED workspace contract test for optional snapshot review summary.
- RED doctor script test for reading the generated report while preserving config repair behavior.
- RED renderer test for review indicator visibility based on snapshot counts.
- GREEN targeted tests, then relevant full main/renderer suites, then `npm run verify:quick`.

## Non-Goals

- No conflict merge UI.
- No raw path IPC or renderer file opener.
- No remote telemetry or diagnostics viewer.
- No DB/schema work.
- No generic issue tracker, task list or background job runtime.

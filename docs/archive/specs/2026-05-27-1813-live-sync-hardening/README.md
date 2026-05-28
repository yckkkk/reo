# Live Sync Hardening

Timezone: America/Los_Angeles (PDT).

## Intent

Reo 已经建立外部文件改动到 active workspace refresh 的主链路。本轮不扩展产品面，也不把 agent 思考路径当作方案；目标是把当前 live sync 的高风险边界继续压实：当前打开内容必须刷新，合法目录移动必须静默收敛，watcher 只能发出安全、有效、脱敏的变化信号。普通人类或 agent 仍然只改记忆空间里的普通文件、目录和必要 sidecar；Reo 负责投影、修复、失效缓存和把无法判断的情况送入 needs-review。

本轮意图对齐已完成：用户要求 `Selected content refresh`、`Directory moves` 和 `Watcher edge cases` 三个优先级放入同一个 spec 的不同子任务中进行。

## Current Basis

- `docs/current/architecture.md` 定义记忆空间文件模型、sidecar、manifest、needs-review 和合法外部跨父级移动的收敛边界。
- `docs/current/data.md` 定义目录 basename 标题真源、TanStack Query cache owner、外部移动 parent mirror repair、sidecar profile、review report redaction 和 snapshot aggregate-only review。
- `docs/current/electron.md` 定义 `workspace:fileTruthChanged` 的脱敏事件、`workspace:readWorkspaceSnapshot` 的 file truth refresh、renderer raw-path 边界和 needs-review prompt copy IPC。
- `docs/current/flow.md` 定义 watcher coalescing、snapshot refresh、Memory detail / selected Segment / selected Supplement content invalidation、dirty editor protection、passive sidecar reconcile 和 needs-review report recompute。
- `docs/current/frontend.md` 定义 Memory Studio 的 selected Segment、content tab、selected content Query 和 Tiptap-backed editor projection。
- `docs/current/quality.md` 记录当前已有 coverage：external note edit、watcher symlink/temp/error、same-snapshot body refresh、direct file truth、sidecar reconcile、needs-review、renderer projection 和 dirty editor protection。
- 已归档的 `2026-05-27-0451-agent-file-truth-e2e-matrix` 证明了 file truth matrix 的主干；本轮只补强边界，不重复造一个大 E2E。

## State Machine

```text
Active workspace session is ready
  -> main-owned watcher observes a real external file-space change
  -> watcher filters ignored artifacts and coalesces burst events
  -> preload sends path-redacted file-truth event for the same workspace handle
  -> renderer rejects stale-session or stale-handle events
  -> renderer reads Workspace snapshot from main file truth
  -> snapshot read scans legal shallow file-space nodes and passive sidecar state
  -> deterministic repairs run for safe missing mirrors, parent mirrors and sidecar-authored changes
  -> needs-review report is rewritten or cleared from scan result
  -> renderer invalidates Memory detail and selected content queries for the same workspace
  -> clean selected editor refetches and applies disk Markdown/Tiptap JSON
  -> dirty, pending, conflict or error editor keeps local content and exposes recovery state
  -> Workspace snapshot, Memory detail, selected content and UI projection settle on the same file truth
```

Directory move variant:

```text
External move or rename moves an entire Memory, Segment or SegmentSupplement node
  -> snapshot/detail read locates the node by stable id and legal directory shape
  -> title projection follows directory basename/frontmatter rules
  -> legal cross-parent move repairs manifest parent mirror
  -> illegal partial move, duplicate id, unsafe path or ambiguous parent enters needs-review
```

Watcher edge variant:

```text
External file activity happens under active workspace
  -> lock, `.part`, cache, editor temp, `.reo/review` and symlink-unsafe paths are ignored or reduced to safe diagnostics
  -> event payload never contains raw path, report entries, title, body, transcript or handle internals
  -> no-op or ignored events do not force unnecessary UI churn
```

## Invariants

- Memory space files remain the durable source of truth; `.reo/index.json` is rebuildable cache and `.reo/objects/*` are technical mirrors, not user semantic truth.
- Renderer/preload never receive raw root paths, workspace-relative review entries, file paths, Electron event objects, title/body/transcript source, content hashes or handle internals.
- Watcher events are hints only. Renderer must re-read main-owned file truth and must not infer object identity from event payload.
- Same-workspace file truth events must invalidate Workspace snapshot, Memory detail and selected Segment/Supplement content; same-snapshot body-only changes are still meaningful.
- Clean editor state may accept disk changes silently; dirty, pending, conflict and error states must not be overwritten by external changes.
- Legal external directory move or rename must move the whole file-space node. Reo may repair deterministic manifest parent mirrors; it must not guess partial or ambiguous structures.
- Unsupported sidecar content, invalid sidecar, duplicate ids, unsafe paths and ambiguous candidates enter needs-review, not silent merge.
- `.reo/review` report churn must not loop through watcher into another report refresh.
- E2E remains a matrix of small scenarios. Each scenario must assert a specific side effect: file change, snapshot convergence, Memory detail projection, selected content cache invalidation, UI projection, needs-review report, doctor output or watcher redaction.
- No raw path IPC, generic filesystem bridge, generic diagnostics viewer, DB, auth, updater, packaging, CRDT or collaborative editing work in this slice.

## Scenario Groups

### A. Selected Content Refresh

1. External edit to the currently selected note Segment body refreshes the open editor when clean.
2. External edit to the currently selected note SegmentSupplement body refreshes the active tab panel when clean.
3. External edit to selected audio transcript or note body invalidates exact content Query even when Workspace snapshot aggregate values do not visibly change.
4. External sidecar JSON-only change for selected content refreshes Tiptap JSON/baselines and keeps the editor rendered by Tiptap, not raw Markdown.
5. Dirty/pending/conflict selected editor is not silently overwritten by external refresh.

### B. Directory Moves

1. External Memory directory rename updates Workspace snapshot and visible list title, with directory basename as title truth.
2. External Segment directory rename keeps Segment id stable and updates Memory detail / Segment strip title.
3. External Segment move across Memory repairs legal manifest `memoryId` mirror and moves projection between parent details.
4. External SegmentSupplement directory rename updates content tab title without retaining stale selected-content title.
5. External SegmentSupplement move across Segment repairs legal `memoryId` and `segmentId` mirror and moves tab projection to the new parent.
6. Partial move, duplicate id, unsafe path or ambiguous parent is excluded from normal projection and written to needs-review.

### C. Watcher Edge Cases

1. `.reo/review/needs-review.json` / `.md` writes are ignored by watcher and do not cause refresh loops.
2. Atomic temp, lock, cache and common editor temporary files are ignored.
3. Symlink or unsafe path activity does not follow outside the workspace and does not leak raw paths in diagnostics or events.
4. Burst file changes coalesce into bounded safe events and still lead to one settled snapshot/detail/content refresh path.
5. Close, workspace switch or stale handle prevents late watcher events from mutating the new session.

## Success Criteria

- New or existing long-term tests cover each scenario group with small, named scenarios. Gaps become focused tests before implementation.
- Selected Segment and selected Supplement content refresh tests assert Query refetch and visible editor projection, not only snapshot reads.
- Directory move tests assert manifest parent repair, projection movement and needs-review classification for unresolved variants.
- Watcher tests assert ignored paths, no raw-path payloads, cleanup and no `.reo/review` refresh loop.
- Any behavior gap is captured as RED before production changes. Existing passing behavior may be cited as evidence but must not be labeled RED.
- No current docs update unless implementation changes stable behavior or contracts.
- Final verification runs targeted main/renderer checks, xhigh subagent review/simplification, `npm run verify:quick`, archive, empty `docs/specs`, and a focused commit.

## Verification Boundary

This work touches filesystem truth, watcher filtering, recovery, Query invalidation, current editor content, and renderer session ownership. It requires focused TDD for uncovered behavior or failures.

Targeted commands:

```bash
MAIN_TEST_FILES=memoryFiles.test.ts,workspaceFiles.test.ts,workspaceFileTruthWatcher.test.ts,tiptapContentSidecar.test.ts npm run test:main
npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx
```

Additional focused commands should be added for any file that receives new tests.

Final gate:

```bash
npm run verify:quick
```

## Non-Goals

- No one-shot full-flow E2E.
- No in-app conflict editor or automatic merge.
- No raw path renderer surface.
- No agent instruction expansion as first response to Reo sync bugs.
- No Tiptap capability expansion beyond verifying current sidecar/live refresh behavior.
- No broad refactor of Memory Studio or watcher architecture unless required by a failing scenario.

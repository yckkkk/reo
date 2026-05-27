# Passive Sidecar Reconcile

Timezone: PDT

## Intent

外部 agent 或人类直接编辑非当前选中对象的 `content.tiptap.json` 后，Reo 应在 active workspace 的文件真源刷新中静默收敛 Markdown mirror、sidecar hash 和后续 UI 投影。用户不需要点击横向片段流、切换 tab、重新打开记忆空间，也不需要理解 Reo 的 sidecar/hash/manifest 机制。

这不是改变编辑器预览或 toolbar 的 spec。当前 Tiptap 编辑器视觉、toolbar 和选中对象 live refresh 已经可用，本 spec 只补齐非选中对象的后台文件收敛。

## Current Facts

- 已归档 dogfood spec 证明：选中对象的外部 Markdown 和 JSON sidecar 改动会在约 2 秒内刷新 UI 并同步 Markdown/sidecar；非选中对象的 JSON-only sidecar 改动会在 focused content read 时收敛，但不会提前写回 Markdown。
- `docs/current/data.md` 已定义：Markdown 未变且 sidecar JSON 改变时，sidecar 应 serialize 回 Markdown；双方同时发生不可自动合并的变化时进入 review/错误，不覆盖任一方。
- `docs/current/flow.md` 已定义：workspace file truth event 会触发 active workspace snapshot refresh；renderer 收到同 workspace event 后读取 snapshot，并 invalidates Memory detail、selected Segment content 和 selected SegmentSupplement content Query。
- Renderer 已有同快照分支：当 snapshot 内容没有变化时，仍 invalidates 有 observer 的 `memory-detail`、`segment-content` 和 `segment-supplement-content` query。
- Main 侧已有 `reconcileTiptapContentSidecar`：它能处理 missing sidecar、sidecar-authored JSON-to-Markdown、Markdown-to-sidecar、content conflict、invalid sidecar 和 unsupported Tiptap content。
- `@tiptap/markdown` 的当前 installed package 类型暴露 `MarkdownManager.parse()`、`MarkdownManager.serialize()`、editor `getMarkdown()`、`editor.markdown`、`storage.markdown.manager`，并让 `setContent` / `insertContent` / `insertContentAt` 接受 `contentType: 'markdown'`。Reo main 侧已经通过 `MarkdownManager` 使用官方 parse/serialize 模型，renderer 编辑器通过 `Markdown` extension 和 `contentType: 'markdown'` 使用官方模型。

## State Machine

```text
Idle
  -> external file write settles under active workspace watcher
  -> renderer receives redacted workspace file-truth event
  -> renderer calls readWorkspaceSnapshot
  -> main validates workspace/root/lock and rebuilds file-truth read model
  -> main scans bounded existing content.tiptap.json candidates under legal finalized objects
  -> each candidate is classified:
       clean mirror
       sidecar-authored JSON change
       markdown-authored change
       simultaneous conflict
       invalid or unsupported sidecar
  -> safe sidecar-authored candidates serialize through Reo Tiptap Markdown codec and update Markdown + sidecar metadata
  -> unsafe candidates are not overwritten and are recorded as review/error evidence
  -> snapshot/index response returns
  -> renderer invalidates observed Memory detail/content queries
  -> UI projection converges without user refresh or reselect
```

## Invariants

- Renderer/preload still receive no raw filesystem path.
- Agent and human workflows stay unrestricted: they may edit Markdown, directories or JSON files; Reo owns deterministic convergence.
- No dirty editor may be overwritten. Dirty selected editor conflict handling remains unchanged.
- Passive refresh must not generate missing sidecars for every old object. It only reconciles existing `content.tiptap.json` files or objects already touched by the content read path.
- Missing sidecar remains a focused-read concern unless another current product path requires proactive generation.
- Simultaneous Markdown and sidecar edits must not auto-merge or overwrite either side.
- Unsupported Tiptap JSON must not be silently dropped to Markdown.
- The implementation must not fork, narrow or bypass Tiptap. Serialization continues through the existing `@tiptap/markdown`-backed Reo codec.
- Background work must be bounded by the existing shallow finalized-object scan; no full recursive parse of arbitrary user files.
- File writes still respect workspace lock/root usability, no-follow file reads, atomic write and index write queue rules.

## Recommended Design

Add a main-owned passive sidecar reconcile step inside active file-truth snapshot refresh, after workspace/root validation and finalized object discovery, before snapshot/index response is returned.

The step should use existing finalized object identity, existing Markdown body extraction, and existing `reconcileTiptapContentSidecar`. It should only consider existing `content.tiptap.json` files under legal finalized note Segment, note SegmentSupplement, audio Segment transcript and audio SegmentSupplement transcript directories. For note objects, `writeBodyMarkdown` updates the editable body Markdown while preserving frontmatter/title. For audio objects, `writeBodyMarkdown` updates only the `## Transcript` body while preserving audio metadata and the rest of the Markdown document.

Safe JSON-to-Markdown changes are written immediately under the same active workspace lock. Conflicts or unsupported content do not fail the whole snapshot refresh by default; they preserve both files and produce review/error evidence. If the existing code already has a needs-review diagnostic surface for sidecar conflict, use it. If not, this spec records the behavior in focused tests and defers user-facing review UI until there is an actual product surface for it.

## Alternatives Considered

1. Renderer-only invalidation.
   This is insufficient because renderer cannot and must not rewrite filesystem mirrors. It also keeps the convergence burden on selection/focused read.

2. Teach agents to edit Markdown and hashes correctly.
   This is the wrong owner. The previous dogfood showed that normal agents should edit files directly; Reo must own deterministic sidecar/hash convergence.

3. Watcher sends changed paths to renderer.
   This would expose more path-level information across the preload boundary and still would not solve main-owned write safety. Path classification can remain inside main if needed, but renderer does not need raw paths.

## Success Criteria

- A non-selected note Segment sidecar JSON edit serializes to `segment.md` during workspace file-truth refresh, before the Segment is selected.
- A non-selected note SegmentSupplement sidecar JSON edit serializes to `supplement.md` during workspace file-truth refresh, before its tab is selected.
- An audio Segment transcript sidecar JSON edit serializes only the transcript body in `segment.md`; headings and non-transcript metadata remain intact.
- An audio SegmentSupplement transcript sidecar JSON edit serializes only the supplement transcript body in `supplement.md`.
- Simultaneous Markdown and sidecar edits preserve both files and do not report successful mirror convergence.
- Invalid sidecar JSON and unsupported Tiptap JSON do not break the whole workspace snapshot refresh.
- Existing selected-content JSON refresh behavior still passes.
- Dogfood E2E confirms: edit `content.tiptap.json` for a non-selected object, wait for passive refresh, inspect Markdown mirror before selecting, then select and verify UI already reflects the rich marks.

## Verification Boundary

This is a high-risk filesystem/cache/workflow change, so implementation must use real TDD:

- RED focused main tests for passive sidecar reconciliation from `readWorkspaceSnapshotFromFileTruth` or a narrower helper invoked by it.
- RED negative tests for conflict/invalid/unsupported sidecars.
- Renderer test only if implementation changes invalidation semantics; otherwise existing same-snapshot invalidation tests are supporting evidence.
- Operation dogfood with the test memory space after unit tests pass.
- Final `npm run verify:quick` before commit.

## Non-Goals

- No toolbar, editor preview, Tiptap UI or theme redesign.
- No new DB, Zustand store, query key or renderer path exposure.
- No proactive generation of sidecars for every object missing `content.tiptap.json`.
- No generic background job runtime.
- No user-facing conflict review UI unless the implementation discovers an existing current surface that can be reused without broadening scope.

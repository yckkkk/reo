# 文件空间内容合同 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `test-driven-development` for implementation. Steps use checkbox syntax for tracking.

**Goal:** 让人类和 Codex 直接创建的 note Segment / SegmentSupplement Markdown 文件在 Reo 打开或刷新时被浅层有界扫描、自动补全、投影，并把真实歧义排除到 `needs-review` 摘要/日志。

**Architecture:** Main process 仍是唯一文件系统 owner。实现挂在现有 finalized read model / index rebuild 路径前，用显式 reconcile pass 修复 Markdown frontmatter `id`、`kind`、manifest 和 index，再交给现有 strict finalized projection。Renderer、preload、IPC 和当前 Tiptap 编辑/预览不变。

**Tech Stack:** Electron main process, TypeScript, Node fs, Zod, gray-matter, Node test runner.

---

## Locked Decisions

- 扫描边界：浅层有界扫描，只看 `memories/*/segments/*/segment.md` 和 `memories/*/segments/*/supplements/*/supplement.md`。
- `needs-review` 首期 surface：受控 summary + main-owned 脱敏日志；不新增 renderer 待检查 UI。
- `id carrier`：Markdown frontmatter `id` 是主身份载体；manifest 是 Reo 技术 mirror；目录 basename 只做人类可见标题。
- duplicate stable id：两个 live 对象共享同一 `id` 时都不进入有效投影，也不写入 `.reo/index.json`。

## File Map

- Modify `src/main/workspaceMarkdownObjects.ts`: allow optional `id` for Segment/Supplement strict schemas and add candidate parser/render helper for body-only or incomplete frontmatter.
- Modify `src/main/memoryFiles.ts`: add shallow reconcile pass for note Segment and note SegmentSupplement candidates; update finalized metadata readers to resolve identity from frontmatter first and directory prefix as migration hint; record safe diagnostic counts.
- Modify `test/main/workspaceMarkdownObjects.test.ts`: cover frontmatter `id` and candidate body-only parsing.
- Modify `test/main/memoryFiles.test.ts`: cover direct file-created Segment, direct file-created Supplement, duplicate `id` exclusion, oversized/ambiguous candidate exclusion.
- Modify `docs/current/architecture.md` and `docs/current/data.md` only after code lands, because the durable file contract changes from manifest-only identity to Markdown-frontmatter identity carrier plus manifest mirror.
- Keep unchanged: `src/preload/*`, `src/renderer/*`, `src/workspace-contract/*` IPC DTOs, current editor UI and preview.

## Task 1: Markdown Schema And Candidate Parser

- [x] Add failing tests in `test/main/workspaceMarkdownObjects.test.ts`:
  - strict Segment Markdown accepts `id: seg_external`.
  - strict Supplement Markdown accepts `id: sup_external`.
  - candidate parser accepts body-only Markdown and returns empty data plus content.
  - candidate parser rejects invalid YAML without swallowing content silently.
- [x] Run:

```bash
npm run test:main -- test/main/workspaceMarkdownObjects.test.ts
```

Expected: fail because `id` is rejected and candidate parser does not exist.

- [x] Implement minimal schema/parser changes in `src/main/workspaceMarkdownObjects.ts`.
- [x] Re-run the same test until green.
- [x] Refactor only if it removes duplicated schema logic.

## Task 2: Direct Note Segment Reconcile

- [x] Add failing tests in `test/main/memoryFiles.test.ts`:
  - creating `memories/<memory>/segments/我的新想法/segment.md` with body only, then rebuilding the index, writes frontmatter `id`, `title`, `kind: note`, writes `.reo/objects/segments/<id>.json`, and projects a note Segment.
  - directory basename remains `我的新想法`; Reo does not silently rename it to `<id>--title`.
  - existing standardized Segment without frontmatter `id` is repaired by writing the manifest id into frontmatter without changing body.
- [x] Run focused RED:

```bash
npm run test:main -- test/main/memoryFiles.test.ts --test-name-pattern "direct.*note segment|frontmatter id"
```

- [x] Implement segment reconcile in `src/main/memoryFiles.ts`:
  - scan only one level under the owning Memory `segments/`.
  - require a real directory and no-follow `segment.md`.
  - infer title from frontmatter title, directory basename, then first non-empty body line fallback.
  - resolve id from frontmatter `id`, existing compatible manifest, directory prefix, or generated `seg_*`.
  - write repaired Markdown through atomic file write and manifest through atomic JSON write.
  - use existing workspace index write queue/rebuild path; do not write during ordinary content read.
- [x] Re-run focused tests until green.

## Task 3: Direct Note Supplement Reconcile

- [x] Add failing tests in `test/main/memoryFiles.test.ts`:
  - creating `supplements/补充观察/supplement.md` under a valid Segment repairs `id`, `title`, `kind: note`, writes supplement manifest, and projects only under parent Segment tabs.
  - parent Segment directory can be Finder-renamed; ownership comes from the parent Segment file truth, not raw path text alone.
  - missing parent Segment or ambiguous parent leaves the supplement out of projection.
- [x] Run focused RED:

```bash
npm run test:main -- test/main/memoryFiles.test.ts --test-name-pattern "direct.*note supplement|supplement.*reconcile"
```

- [x] Implement supplement reconcile in `src/main/memoryFiles.ts`:
  - run after parent Segment identity is known.
  - scan only one level under `supplements/`.
  - reuse Segment id-carrier rules with `sup_*`.
  - write manifest mirror and repaired Markdown atomically.
  - keep supplements out of Memory top-level Segment strip.
- [x] Re-run focused tests until green.

## Task 4: Needs-Review Summary And Safety Boundaries

- [x] Add failing tests in `test/main/memoryFiles.test.ts`:
  - duplicate frontmatter `id` across live Segment directories excludes both from Memory detail and index.
  - duplicate frontmatter `id` across live Supplement directories excludes duplicates from parent tab list.
  - candidate with both `segment.md` and `supplement.md` in the same directory is excluded.
  - symlink candidate does not enter repaired projection.
- [x] Add focused diagnostic test only if a stable recorder seam already exists without adding generic IPC; otherwise record summary through existing main diagnostic recorder and assert projection/index behavior.
- [x] Run focused RED:

```bash
npm run test:main -- test/main/memoryFiles.test.ts --test-name-pattern "duplicate.*id|needs-review|symlink.*candidate"
```

- [x] Implement duplicate/ambiguous classification:
  - no raw path, title, body, or frontmatter in diagnostics.
  - only safe fields such as `objectType`, `status`, `reason`, and counts.
  - ambiguous objects are excluded from `.reo/index.json` effective objects.
- [x] Re-run focused tests until green.

## Task 5: Current Docs Compression

- [x] Update `docs/current/architecture.md` to state that Segment/Supplement stable id is carried by Markdown frontmatter and mirrored in manifest; directory basename remains visible title.
- [x] Update `docs/current/data.md` with the same durable source/truth split.
- [x] Do not write task evidence, migration history, or implementation log into current docs.

## Task 6: Final Verification And Commit

- [x] Run targeted main tests:

```bash
npm run test:main -- test/main/workspaceMarkdownObjects.test.ts test/main/memoryFiles.test.ts
```

- [x] Run quick verification once before final commit:

```bash
npm run verify:quick
```

- [x] Commit only files touched by this spec:

```bash
git add docs/specs/2026-05-25-2050-file-space-content-contract/README.md \
  docs/specs/2026-05-25-2050-file-space-content-contract/tasks.md \
  docs/current/architecture.md docs/current/data.md \
  src/main/workspaceMarkdownObjects.ts src/main/memoryFiles.ts \
  test/main/workspaceMarkdownObjects.test.ts test/main/memoryFiles.test.ts
git commit -m "feat: reconcile direct note file creation"
```

## Stop Conditions

- Implementing this requires changing preload, renderer, generic IPC, or current editor/preview UI.
- The repair path cannot preserve user body text exactly.
- Duplicate id handling would require silently creating new identities.
- Any safety test requires following symlinks or exposing raw paths.

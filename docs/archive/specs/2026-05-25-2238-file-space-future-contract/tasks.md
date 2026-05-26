# 文件空间未来态合同 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `test-driven-development` for implementation. Steps use checkbox syntax for tracking.

**Goal:** 落地 Segment/Supplement 跨父级移动、Markdown + Tiptap JSON 双载体、官方 `@tiptap/markdown` roundtrip、Codex CLI 直接文件编辑和 Electron E2E 验证。

**Architecture:** Main process 继续是唯一 filesystem owner；Tiptap JSON sidecar 是内容对象同目录的语义结构载体；`.reo/objects/*.json` 继续是技术 mirror。Renderer 只扩展 editor 数据载荷，不改变 UI 结构或样式。

**Tech Stack:** Electron main process, TypeScript, Node fs, Zod, `@tiptap/markdown`, Tiptap v3 extensions, React, TanStack Query, Node test runner, Vitest.

---

## Locked Decisions

- Markdown 是普通人类/agent 可读语义投影。
- `content.tiptap.json` 是富结构载体，服务 finalized note Segment / note SegmentSupplement body，以及 finalized audio Segment / audio SegmentSupplement transcript。
- Audio transcript sidecar 只映射 `## Transcript` 正文，不映射标题、音频元数据或整个 Markdown 文件。
- `.reo/objects/*.json` 不是正常语义工作流入口；Codex 可以编辑它做异常/恢复测试，但 normal path 是 Markdown + sidecar。
- 跨父级移动通过 open/refresh/detail/index reconcile 接受，不新增用户 UI。
- 重复 id、unsafe path、混合对象形态、Markdown+JSON 双方冲突不自动猜测用户意图。
- Tiptap codec 必须覆盖当前 editor durable extension profile；不能为了 main 侧方便裁剪 Tiptap 能力。编辑态临时节点若无法无损落盘，必须拒绝而不是丢弃。

## Task 1: Official Tiptap Markdown Codec

- [x] Add failing main tests for official parse/serialize:
  - `==高亮==` roundtrips as highlight mark.
  - underline mark serializes to `++text++` and parses back.
  - colored highlight JSON serializes to Reo Markdown-compatible HTML and parses back with color.
  - heading/list/link/image survive markdown -> JSON -> markdown.
- [x] Run RED:

```bash
npm run test:main -- test/main/tiptapMarkdownCodec.test.ts
```

- [x] Implement main-side codec using `@tiptap/markdown` MarkdownManager and existing Reo extension profile.
- [x] Re-run until GREEN.

## Task 2: Tiptap JSON Sidecar File Contract

- [x] Add failing main tests for `content.tiptap.json`:
  - missing sidecar is generated from Markdown.
  - sidecar changed while Markdown hash is unchanged updates Markdown from JSON.
  - Markdown changed while sidecar is still projection regenerates sidecar.
  - incompatible Markdown and sidecar concurrent edits return typed conflict / needs-review and preserve both files.
  - invalid sidecar does not corrupt Markdown.
- [x] Run RED focused tests.
- [x] Implement sidecar schema, read/write helpers, hash comparison and atomic writes.
- [x] Re-run until GREEN.

## Task 3: IPC And Renderer Rich Payload

- [x] Add failing renderer/main contract tests:
  - read note Segment content returns Markdown, Tiptap JSON and sidecar baseline.
  - write note Segment content sends Markdown + JSON and persists both.
  - stale sidecar save does not overwrite external JSON edit.
  - `LightweightMarkdownEditorSurface` initializes from JSON when provided and still emits Markdown for current save flow.
- [x] Run RED targeted tests.
- [x] Extend workspace contract DTOs, preload bridge types, workspaceApi wrappers and content save owner.
- [x] Update editor surface to call `getJSON()` alongside `getMarkdown()` without visual changes.
- [x] Re-run until GREEN.

## Task 4: Segment Cross-Memory Move Reconcile

- [x] Add failing main tests:
  - moving a Segment directory from Memory A to Memory B preserves `segmentId`, body, attachments, supplements and sidecar.
  - Segment manifest `memoryId` updates to target Memory.
  - descendant Supplement manifests update `memoryId` and `segmentId`.
  - source Memory projection loses Segment and target Memory gains it.
  - duplicate `segmentId` collision excludes conflict rather than rewriting id.
- [x] Run RED focused tests.
- [x] Implement reconcile in existing shallow scan/index read model.
- [x] Re-run until GREEN.

## Task 5: SegmentSupplement Cross-Segment Move Reconcile

- [x] Add failing main tests:
  - moving a Supplement directory to another Segment preserves `supplementId`, body, attachments and sidecar.
  - Supplement manifest parent ownership updates.
  - old parent tab list removes supplement and new parent tab list adds it.
  - old/new `contentTabOrder` normalize around the move.
  - duplicate `supplementId` collision excludes conflict.
- [x] Run RED focused tests.
- [x] Implement supplement parent reconcile.
- [x] Re-run until GREEN.

## Task 6: Codex CLI And Electron E2E

- [x] Create or reuse a test fixture memory space.
- [x] Simulate Codex CLI operations with normal file edits:
  - create Segment from Markdown only.
  - create Supplement from Markdown only.
  - move Segment across Memory.
  - move Supplement across Segment.
  - edit `content.tiptap.json` to add highlight / underline.
- [x] Verify Reo main read model projects the expected state.
- [x] Run Electron runtime and verify open/read/save/reopen behavior without changing editor visuals.
- [x] Record evidence in this spec.

Codex CLI evidence:

- 当前安装的 Codex CLI 中 `-p` 是 `--profile`，不是 prompt 参数；E2E 使用 `codex exec` 的 positional prompt/stdin 执行。
- Phase 1 让 Codex 只编辑普通 Markdown 和移动目录：创建 note Segment、创建 note Supplement、跨 Memory 移动 Segment、跨 Segment 移动 Supplement、给现有 note Segment/Supplement Markdown 添加高亮和下划线。Reo read model 生成缺失 sidecar、修复合法移动的 manifest parent，并把复制/重复 id 留给 needs-review/exclusion。
- Phase 2 让 Codex 只编辑两个 `content.tiptap.json` sidecar：为 note Segment 添加蓝色高亮和下划线，为 note Supplement 添加红色高亮和上标。Reo read model 把 JSON-only 修改镜像回 Markdown，并刷新 sidecar source hash。
- Audio 补充阶段把测试记忆空间中剩余 10 个 `kind: audio` Markdown 对象全部通过 finalized audio read 生成 transcript sidecar；随后 Codex 只编辑 audio Segment 和 audio SegmentSupplement 的 `content.tiptap.json`，Reo 把 JSON-only 高亮、下划线和上标镜像回对应 `## Transcript` 正文。验证 token `1779785055` 在 Codex 写入后只存在于两个 JSON sidecar；Reo read model 读取后，Segment Markdown 包含 `var(--tt-color-highlight-blue)` 和 `++audio underline 1779785055++`，Supplement Markdown 包含 `var(--tt-color-highlight-red)` 和 `<sup>audio sup 1779785055</sup>`。
- 记忆空间 root `AGENTS.md` 已改为 Reo 创建/导入空文件夹时写入的默认模板，不只是测试空间单文件。模板说明普通 Markdown、同级 `content.tiptap.json`、audio transcript sidecar 边界、`.reo` mirror 边界、创建/移动目录规则和富文本高亮/下划线/上下标写法；测试空间 `AGENTS.md` 与默认模板字节一致。
- Review 后补充验证：audio transcript 的 `## Transcript` 正文不再被后续 Tiptap H2 截断；note/audio Segment 跨 Memory 移动与 note/audio SegmentSupplement 跨 Segment 移动均会在读模型扫描中修复 parent manifest，保存事务后的 index refresh 不执行移动修复，避免把 manifest ownership 篡改当成合法移动。

Runtime evidence:

- Dev runtime: `REMOTE_DEBUGGING_PORT=9345 npm run dev`, renderer URL `http://localhost:5183/`, test memory space `测试`.
- Opened Note Segment `seg_20260519192922_8f6358fb--笔记4`; toolbar still rendered with existing Tiptap controls including underline and highlight.
- UI edit/save wrote `Runtime UI save validation 1779777966830` into both `segment.md` and `content.tiptap.json`.
- External JSON-only edit wrote highlight + underline into `content.tiptap.json`; reopening the test memory projected editor HTML `<mark>Runtime JSON highlight 1779778010304</mark> and <u>underlined</u>` and rewrote Markdown to `==Runtime JSON highlight 1779778010304== and ++underlined++`.
- Self-audit found cached selected content did not refetch on simple segment re-open. Added exact content Query invalidation on Segment/content-tab selection and `refetchOnMount: 'always'` for file-backed detail/content queries.
- After the cache fix, another external JSON-only edit to `Runtime JSON live reopen 1779778672553` became visible by switching to another segment and back without page reload; editor HTML rendered one `mark` and one `u`, and Markdown rewrote to `==Runtime JSON live reopen 1779778672553== -&gt; ++no page reload++`.
- After restarting the Electron main process with the final implementation, external JSON-only edit to `content.tiptap.json` wrote colored highlight `var(--tt-color-highlight-blue)` plus underline. Switching away from and back to the selected Segment rendered editor HTML `<mark data-color="var(--tt-color-highlight-blue)" ...>E2E final color 1779782003216</mark> -&gt; <u>active app mirrored markdown</u>`, and physical `segment.md` rewrote to `<mark data-color="var(--tt-color-highlight-blue)" style="background-color: var(--tt-color-highlight-blue); color: inherit">E2E final color 1779782003216</mark> -&gt; ++active app mirrored markdown++`.
- Audio runtime read model now verifies that all Markdown content objects in the `测试` memory space have same-node sidecars, including the previously missing 10 audio objects.

Subagent review / simplify evidence:

- Review found copied Segment/Supplement directories were being repaired as moves. The implementation now repairs parent ownership only when the old parent directory no longer exists; copied duplicate ids are held for needs-review/exclusion.
- Review found sidecar edits that also updated `contentHash` could bypass Markdown mirroring. The reconcile path now compares serialized sidecar Markdown against current Markdown and mirrors JSON edits even when `contentHash` is already current.
- Simplify review found duplicated main/renderer Markdown extension definitions. Shared durable Markdown extensions now live in `src/tiptap-markdown/tiptapMarkdownExtensions.ts`.
- Quality review found unbounded Tiptap JSON sidecar surface. The shared workspace contract now bounds JSON depth, node/mark count, text length, attrs length and sidecar byte size.
- Efficiency review found redundant inactive query refetch and repeated JSON stringify in editor dirty checks. Note content invalidation now targets active queries, and editor state stores stable JSON keys for dirty comparison.
- Follow-up review found audio content cache still used note-only refresh and audio transcript H2 could be truncated. Segment/Supplement content queries now refetch on mount for both note and audio; reselect/tab switch invalidation no longer filters out audio; transcript extraction treats everything after `## Transcript` as transcript body.
- Final simplify review found three remaining contract leaks: canceling a dirty editor with a JSON-only disk update ignored the Tiptap baseline, arbitrary highlight colors could persist into `<mark style>`, and non-finite JSON numbers could stringify to `null`. The implementation now treats Markdown or Tiptap baseline changes as unaccepted disk versions, limits highlight colors to Reo toolbar variables, and rejects `NaN` / `Infinity` attrs at the workspace contract boundary.

## Task 7: Current Docs And Final Gates

- [x] Update `docs/current/architecture.md`, `docs/current/data.md`, `docs/current/electron.md`, `docs/current/frontend.md` and `docs/current/quality.md` only for stable changed facts.
- [x] Run targeted tests.
- [x] Run `npm run verify:quick` once before declaring completion.
- [x] Run subagent `$review` and `$ycksimplify` after the audio sidecar extension.
- [x] Run self-audit loop:
  - Ask whether the implementation is factually 100% trusted.
  - List every remaining blocker/major risk.
  - Add tests/fixes for each real risk.
  - Repeat until no known blocker/major risk remains.
- [x] Archive spec after implementation is complete and current docs are compressed.

Self-audit conclusion:

- Remaining blocker/major risk: none known after full `verify:quick`, targeted codec/contract/editor tests, Codex CLI E2E through normal file edits, runtime Electron reopen verification, and subagent review/simplify fixes.
- Non-blocking future hardening: Codex CLI E2E is currently recorded evidence rather than a permanent automated suite; very large memory spaces may deserve later performance sampling around sidecar reconcile.

## Stop Conditions

- Any implementation would require changing editor visuals or preview style.
- Official `@tiptap/markdown` cannot parse/serialize a required mark without a documented extension profile.
- Sidecar conflict handling would silently discard Markdown or JSON edits.
- Cross-parent move repair would require following symlinks, exposing raw paths, or guessing duplicate identities.

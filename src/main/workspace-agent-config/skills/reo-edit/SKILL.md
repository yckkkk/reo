---
name: reo-edit
description: Use when editing, creating, renaming, moving, or organizing files inside a Reo memory space, including Memory, Segment, SegmentSupplement, Markdown, HTML rich text marks, titles, and directory names.
---

# Reo Edit

Use this skill for normal Reo memory-space file work. The goal is to edit files directly and let Reo reconcile deterministic structure later.

## Quick Start

For ordinary edit, create, rename, move or organize tasks:

1. Read the target `memory.md`, `segment.md` or `supplement.md` and nearby directory names.
2. Apply the requested change to ordinary files and directories under `memories/`.
3. Preserve existing stable ids; add simple frontmatter ids only for new Segment or SegmentSupplement objects.
4. Verify direct file effects, then stop.

Ordinary tasks may edit Markdown, same-node `content.tiptap.json`, attachments and ordinary object files when the requested change needs them. Do not reduce Reo work to Markdown-only.

Do not read Reo repo source, global agent memories, `.reo`, hash fields, manifests or sidecars for ordinary tasks. Use those only when the user asks for low-level repair/testing or Reo reports an explicit conflict.

## Stop Rules

- After direct file verification, stop.
- Do not inspect Reo repo source, global memories, `.reo`, hashes, manifests, index or lock files for ordinary tasks.
- Do not run `reo-doctor` unless Reo reports needs-review, missing managed config, duplicate ids, sidecar conflicts, mirror issues, or the user explicitly asks for diagnosis.
- Do not maintain `.reo`, `source.hash`, `contentHash`, manifest mirrors or `.reo/index.json`; Reo owns deterministic convergence.
- You may edit any file when the task requires it; the non-default boundary is Reo-owned technical mirrors, not file extension.

## Common File Operations

| Task | Normal action |
| --- | --- |
| Edit Memory text | Edit `memories/<memory>/memory.md`. |
| Edit Segment text | Edit `memories/<memory>/segments/<segment>/segment.md`. |
| Edit Supplement text | Edit `memories/<memory>/segments/<segment>/supplements/<supplement>/supplement.md`. |
| Rename Memory | Rename the Memory directory basename and update `memory.md` title/frontmatter. |
| Rename Segment | Rename the Segment directory basename and update `segment.md` title/frontmatter. |
| Rename Supplement | Rename the Supplement directory basename and update `supplement.md` title/frontmatter. |
| Move Memory | Move the whole Memory directory under another Reo memory space `memories/` directory. |
| Move Segment | Move the whole Segment directory under another Memory `segments/` directory, in the same Reo memory space or another one. |
| Move Supplement | Move the whole Supplement directory under another Segment `supplements/` directory, in the same Reo memory space or another one. |

Keep stable ids in directory prefixes and Markdown frontmatter when they already exist. For a new Segment, generate an id matching `seg_YYYYMMDDHHMMSS_8hex`; for a new Supplement, generate an id matching `sup_YYYYMMDDHHMMSS_8hex`. Use the same id as the directory prefix and Markdown frontmatter id.

Moves are same-level and whole-directory only. Do not move a Segment into a Supplement, split a Supplement away from its files, or copy only selected attachments, sidecars, audio, runtime files, `state.json`, or child supplements. Reo treats the target directory position as ownership truth when that target memory space is opened or refreshed, and repairs the target `.reo` mirrors and index there. Reo does not clean source `.reo` mirrors; those are technical residue for Reo repair/doctor paths.

The system Draft memory space can be a move source or target for user content. Do not move or delete the protected default Draft Memory itself, but Segments and supplements inside it can move out, and user-created Memories inside Draft can move as whole Memory directories.

## Minimal Shapes

Memory:

```markdown
---
title: My Memory
---
# My Memory

Body text.
```

Note Segment:

```markdown
---
id: seg_20260604024800_a1b2c3d4
title: My Segment
kind: note
---
# My Segment

Body text.
```

Note Supplement:

```markdown
---
id: sup_20260604024900_d4c3b2a1
title: My Supplement
kind: note
---
# My Supplement

Body text.
```

## Rich Text Markdown

Use the Reo Markdown profile: standard Markdown/GFM plus Tiptap-compatible HTML and a few Reo profile marks that the editor can roundtrip.

For ordinary tasks, edit Markdown in `memory.md`, `segment.md` or `supplement.md`. Reo will reconcile matching `content.tiptap.json` later.

| Format | Shortest path | Notes |
| --- | --- | --- |
| Heading | `# Heading` through `###### Heading` | Toolbar exposes H1-H4; file/profile can carry H1-H6. |
| Bold | `**text**` | Standard Markdown. |
| Italic | `*text*` | Standard Markdown. |
| Strike | `~~text~~` | GFM. |
| Inline code | `` `code` `` | Standard Markdown. |
| Highlight | `==text==` | No color. |
| Colored highlight | `<mark data-color="var(--tt-color-highlight-blue)" style="background-color: var(--tt-color-highlight-blue); color: inherit">text</mark>` | Use only Reo toolbar highlight tokens. |
| Underline | `++text++` or `<u>text</u>` | Reo profile mark. |
| Superscript | `<sup>text</sup>` | HTML-compatible Markdown. |
| Subscript | `<sub>text</sub>` | HTML-compatible Markdown. |
| Link | `[text](https://example.com)` | Use http or https URLs. |
| Bullet list | `- item` | GFM/Markdown. |
| Ordered list | `1. item` | GFM/Markdown. |
| Task list | `- [ ] task` and `- [x] done` | GFM task list. |
| Fenced code block | fenced block with optional language | See example below. |
| Blockquote | `> quote` | Standard Markdown. |
| Alignment | `<p style="text-align: center">text</p>` or aligned heading HTML | Supports left, center, right and justify. |

````markdown
## Heading

**Bold**, *italic*, ~~strike~~, `inline code`, ++underline++.

==Plain highlight==

<mark data-color="var(--tt-color-highlight-blue)" style="background-color: var(--tt-color-highlight-blue); color: inherit">Blue highlight</mark>

<sup>superscript</sup> <sub>subscript</sub>

[Link](https://example.com)

> Blockquote

```ts
const value = 1
```

- [ ] Todo
- [x] Done

<p style="text-align: center">Centered paragraph</p>
````

## Expert Tiptap JSON

Use Expert Tiptap JSON only when the user asks for exact rich structure or Markdown cannot express the requested mark precisely.
If exact rich structure is easier in JSON, edit only the `content` field in the same-node `content.tiptap.json`.
Do not maintain `source.hash` or `contentHash`; Reo recalculates or validates those fields when it reconciles the Markdown and sidecar.
Only content that can serialize back through the Reo Markdown profile is accepted automatically. Unknown nodes, unknown marks, arbitrary CSS colors and unsafe link attrs stay in review instead of being silently written to Markdown.

Supported toolbar highlight colors:

- `var(--tt-color-highlight-gray)`
- `var(--tt-color-highlight-brown)`
- `var(--tt-color-highlight-orange)`
- `var(--tt-color-highlight-yellow)`
- `var(--tt-color-highlight-green)`
- `var(--tt-color-highlight-blue)`
- `var(--tt-color-highlight-purple)`
- `var(--tt-color-highlight-pink)`
- `var(--tt-color-highlight-red)`

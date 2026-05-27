# Managed config snapshot

## AGENTS first 80 lines

# Reo 记忆空间 Agent 入口

<!-- reo-managed:agent-entry:start v1 -->

## Reo 是什么

Reo 是一个 agent-native 的本地记忆空间。人类、Codex 和其他 agent 都可以把它当作普通文件夹读写；Reo 负责把合法文件改动重新投影回应用界面。

这个入口的目标是降低判断成本，不是限制能力。Agent 可以编辑任何文件；一般任务应优先读写用户语义文件，复杂一致性由 Reo 在打开、刷新、保存时收敛。

## 核心实体

- Memory space：当前文件夹本身，是一个可被 Finder、编辑器和 agent 打开的 Reo 记忆空间。
- Memory：`memories/` 下的一组长期主题或语义容器。
- Segment：Memory 内的正文片段，可以是 note、audio 或未来更多类型。
- SegmentSupplement：挂在某个 Segment 下的补充内容。
- `.reo/`：Reo 的技术完整性层，保存索引、manifest、草稿、回收站、lock 和恢复信息。
- `skills/`：给 agent 使用的工作流技能，不是用户语义内容本身。

## 文件层

- `memories/` 保存用户语义内容，是普通编辑和创建任务的默认工作区。
- Memory 使用 `memory.md`，Segment 使用 `segment.md`，SegmentSupplement 使用 `supplement.md`。
- `content.tiptap.json` 是同一正文的富结构载体，由 Reo 与编辑器维护。
- 普通 `.json`、`.html` 或未被对象合同识别的文件不会自动成为 Reo 对象。
- 目录 basename 是用户可见名称的一部分；对象身份由稳定 id 承载。

## 使用技能

- 编辑、创建、重命名、移动、整理 Memory、Segment 或 SegmentSupplement：读取 `skills/reo-edit/SKILL.md`。
- 诊断或修复 Reo 文件空间异常、缺失托管配置、重复 id、sidecar/mirror 冲突或 needs-review：读取 `skills/reo-doctor/SKILL.md`。

## 协作原则

- 不要为了普通内容任务推理 hash、sidecar 或 `.reo/objects`；先完成用户可见的文件改动。
- 不要创建 symlink，不要移动 `.reo/workspace.lock*`，不要删除不属于当前任务的文件。
- 如果文件缺字段或名称不完整，Reo 会做确定性补全；无法判断的冲突保留内容并进入 needs-review。
- 遇到 Reo 报错或不确定恢复路径时，停止猜测并使用 `reo-doctor`。
<!-- reo-managed:agent-entry:end -->

## reo-edit first 120 lines

---

name: reo-edit
description: Use when editing, creating, renaming, moving, or organizing files inside a Reo memory space, including Memory, Segment, SegmentSupplement, Markdown, HTML rich text marks, titles, and directory names.

---

# Reo Edit

Use this skill for normal Reo memory-space file work. The goal is to edit files directly and let Reo reconcile deterministic structure later.

## Default Path

- Edit user-visible content in `memories/` first.
- Do not maintain `.reo`, hash fields, manifests or sidecars for ordinary tasks.
- You may edit any file when the task explicitly asks for expert repair or low-level testing.
- If Reo reports missing config, duplicate ids, sidecar conflicts or unclear recovery state, switch to `skills/reo-doctor/SKILL.md`.

## Common File Operations

| Task                 | Normal action                                                                          |
| -------------------- | -------------------------------------------------------------------------------------- |
| Edit Memory text     | Edit `memories/<memory>/memory.md`.                                                    |
| Edit Segment text    | Edit `memories/<memory>/segments/<segment>/segment.md`.                                |
| Edit Supplement text | Edit `memories/<memory>/segments/<segment>/supplements/<supplement>/supplement.md`.    |
| Rename Memory        | Rename the Memory directory basename and update `memory.md` title/frontmatter.         |
| Rename Segment       | Rename the Segment directory basename and update `segment.md` title/frontmatter.       |
| Rename Supplement    | Rename the Supplement directory basename and update `supplement.md` title/frontmatter. |
| Move Segment         | Move the whole Segment directory under another Memory `segments/` directory.           |
| Move Supplement      | Move the whole Supplement directory under another Segment `supplements/` directory.    |

Keep stable ids in directory prefixes and Markdown frontmatter when they already exist. For a new object, use a clear deterministic id prefix such as `mem_agent_<slug>`, `seg_agent_<slug>` or `sup_agent_<slug>`.

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
id: seg_agent_example
title: My Segment
kind: note
---

# My Segment

Body text.
```

Note Supplement:

```markdown
---
id: sup_agent_example
title: My Supplement
kind: note
---

# My Supplement

Body text.
```

## Rich Text Markdown

Use Markdown or HTML that Tiptap can read back:

```markdown
## Heading

**Bold**, _italic_, ~~strike~~, `inline code`, ++underline++.

<mark data-color="var(--tt-color-highlight-blue)" style="background-color: var(--tt-color-highlight-blue); color: inherit">Blue highlight</mark>

<sup>superscript</sup> <sub>subscript</sub>

- [ ] Todo
- [x] Done
```

Supported toolbar highlight colors:

- `var(--tt-color-highlight-green)`
- `var(--tt-color-highlight-blue)`
- `var(--tt-color-highlight-red)`
- `var(--tt-color-highlight-purple)`
- `var(--tt-color-highlight-yellow)`

## managed config files

/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试/AGENTS.md
/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试/skills/reo-doctor/SKILL.md
/Users/yck/Downloads/PM/技术线/reo文件区/reo测试工作区/测试/skills/reo-edit/SKILL.md

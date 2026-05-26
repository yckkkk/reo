# 文件空间未来态合同

## 元信息

- 时间：2026-05-25 22:38 PDT
- 范围：Segment 跨 Memory 移动、SegmentSupplement 跨 Segment 移动、Markdown + Tiptap JSON 双载体、`@tiptap/markdown` roundtrip、Codex CLI 直接文件编辑、Electron runtime E2E 验证。
- 非范围：改变当前 Tiptap 编辑器视觉、改变当前编辑/预览样式、引入 AI runtime、引入 Widget runtime、引入数据库或文件 watcher。

## 意图锁定

Reo 的记忆空间必须像普通工程项目一样可读写。人类可以用 Finder、Markdown 编辑器或终端创建、移动和编辑文件；Codex-class agent 可以在同一文件空间里做更结构化的编辑，包括直接编辑 JSON sidecar、添加高亮、下划线、标题和其它 Tiptap mark。Reo 的职责是打开、刷新或读写时把这些普通文件操作 reconcile 成可投影、可保存、可恢复的当前对象状态。

本轮交付不改变现有编辑器 UI 和预览样式。所有改变只落在文件合同、main process reconcile、IPC DTO、renderer 数据携带和验证层。

## 官方依据

- `@tiptap/markdown` 官方范式是把 Markdown extension 加入 editor，使用 `contentType: 'markdown'` 初始化 Markdown 内容，用 `editor.getMarkdown()` 序列化，或用 `editor.commands.setContent(markdown, { contentType: 'markdown' })` 重新载入。
- 官方 Markdown manager 提供 `parse(markdown)` 到 Tiptap JSON、`serialize(json)` 到 Markdown 的能力；自定义扩展通过 `parseMarkdown`、`renderMarkdown` 和 tokenizer 描述 Markdown roundtrip。
- Tiptap JSON 官方持久化能力是 `editor.getJSON()` 导出 JSON，并用 `setContent(json)` 载入 JSON。
- 当前已安装并启用的 Tiptap v3 editor profile 必须整体进入 roundtrip 判断；不能只挑选部分看似够用的 mark/node。Highlight 支持 `==text==`，Underline 支持 `++text++`，Image 支持标准 Markdown 图片。TextAlign 和 colored highlight 需要 Reo 已有自定义 Markdown serializer 承载 HTML-compatible Markdown；colored highlight 只接受 Reo toolbar 暴露的 `var(--tt-color-highlight-green|blue|red|purple|yellow)` 变量。`ImageUploadNode` 和 `Selection` 属于编辑态 UI/交互能力，不是 durable content 表示；若持久化 JSON 中出现无法无损序列化的编辑态节点，必须拒绝或进入 review，不能静默丢弃。

## 当前事实

- `LightweightMarkdownEditorSurface` 已使用 Tiptap + `@tiptap/markdown`，编辑器保存时通过 `editor.getMarkdown()` 写回 Markdown。
- Renderer content save 当前同时携带 Markdown、Tiptap JSON 和两组 baseline hash；editor state dirty 判断使用同一 Tiptap JSON key，避免重复 dispatch。
- Note Segment / Note SegmentSupplement 的正文保存 IPC 已携带 Markdown、Tiptap JSON 和两组 baseline hash。
- Audio transcript 保存 IPC 已携带 Markdown、Tiptap JSON 和两组 baseline hash；audio sidecar 只映射 `## Transcript` 后的正文。
- 当前 direct note file reconcile 已能补齐缺 id、缺 kind、缺 manifest 的 Note Segment / Supplement。
- 当前 note/audio Segment 跨 Memory 移动、note/audio SegmentSupplement 跨 Segment 移动已作为合法外部编辑 reconcile；保存事务后的 index refresh 不执行跨父级移动修复，以保留 ownership mismatch 防护。

## 目标状态

### 普通文件工作流

- 人类可以只编辑 `segment.md` / `supplement.md`。
- 人类可以把整个 Segment 目录移动到另一个 Memory 的 `segments/` 下。
- 人类可以把整个 Supplement 目录移动到另一个 Segment 的 `supplements/` 下。
- Reo 在打开、刷新、detail read 或 index rebuild 时接受这些操作，保留稳定 id，修复 manifest ownership，刷新 index/projection。
- 缺技术镜像时补齐；重复 id、unsafe path、混合对象形态或不可判定冲突进入 needs-review / exclusion，不静默覆盖。

### Codex / 高级文件工作流

- Codex 可以直接编辑 Markdown 正文。
- Codex 可以直接编辑 `content.tiptap.json` 添加高亮、下划线、标题、列表、图片等结构。
- Codex 可以读取 sidecar JSON，精确知道哪里有 mark/node，而不是只能解析 Markdown/HTML 字符串。
- Codex 可以创建 Segment、Supplement、补充内容，移动整个目录，或修复 manifest mirror。
- `.reo/objects/*.json` 仍是 Reo 技术 mirror；Codex 可作为异常/恢复测试编辑它，但正常语义工作流优先走 Markdown 和 content sidecar。

## 文件合同

每个 Markdown-compatible text content object 可以拥有同目录 sidecar：

```text
segment.md
content.tiptap.json
attachments/
```

或：

```text
supplement.md
content.tiptap.json
attachments/
```

`content.tiptap.json` 结构：

```json
{
  "schemaVersion": 1,
  "objectType": "tiptap-content",
  "source": {
    "format": "markdown",
    "hash": "64-char-sha256-hex"
  },
  "profile": {
    "name": "reo-tiptap-markdown",
    "version": 1
  },
  "contentHash": "64-char-sha256-hex",
  "content": {
    "type": "doc",
    "content": []
  }
}
```

规则：

- Markdown 仍是人类可读语义投影。
- Tiptap JSON 是富结构载体，不是 `.reo` 技术 mirror。
- Note sidecar 映射 note body；audio sidecar 映射 `## Transcript` 正文，不映射整个 Markdown 文件。
- Sidecar 缺失时，Reo 使用官方 `@tiptap/markdown` 从 Markdown 补 sidecar。
- Sidecar JSON 被 Codex 修改且 Markdown 未变时，Reo 从 JSON serialize 回 Markdown，并更新 sidecar source hash。
- Markdown 被人类修改且 sidecar 没有结构性变化时，Reo 从 Markdown 重新生成 sidecar。
- Markdown 和 sidecar 同时发生不可自动合并的变化时，Reo 不覆盖任一方；对象进入可诊断的 needs-review/exclusion 或读写返回 typed conflict。
- `source.hash` 跟踪 Markdown raw body，`contentHash` 跟踪 canonical Tiptap JSON；不能通过 serializer 输出是否等于 source hash 来判断 JSON 是否变化，因为 Markdown serializer 可以做合法格式归一化。

## Roundtrip 合同

启用 sidecar 前必须有行为测试覆盖当前编辑器完整 durable extension profile，而不是筛选后的最小子集：

- Markdown `==高亮==` parse 成 highlight mark，再 serialize 回 Markdown。
- Tiptap underline mark serialize 成 `++text++`，再 parse 回 underline mark。
- Colored highlight JSON serialize 成 Reo Markdown-compatible HTML，parse 后仍保留 color attribute。
- Toolbar durable surface 当前必须覆盖 undo/redo 以外的可持久化编辑结果：heading、bullet/ordered/task list、blockquote、code block、bold、italic、strike、inline code、underline、highlight、colored highlight、link、superscript/subscript、text align、horizontal rule 和 image。彩色高光使用现有 Tiptap template 颜色变量，如 `var(--tt-color-highlight-green)`、`blue`、`red`、`purple`、`yellow`，外部 JSON 和 Markdown-compatible HTML 都必须能被 Reo 读回；任意外部 CSS color、`NaN` 或 `Infinity` 不进入持久化 JSON 合同。
- Heading、list、blockquote、code、link、image 和 inline code 不因 sidecar 读写损坏。
- Text alignment、superscript 和 subscript 使用 HTML-compatible Markdown 时能回到 Tiptap JSON。
- 无法无损写入 Markdown 的 Tiptap node/mark 必须返回 review/error，不允许被 serializer 静默丢弃。
- Editor 保存同一文档时 `getMarkdown()` 和 `getJSON()` 表达同一 Tiptap state。

## 实现结果

- Main 与 renderer 共用 `src/tiptap-markdown/tiptapMarkdownExtensions.ts` 中的 Markdown extension profile，避免两端对 heading、paragraph、highlight、superscript 和 subscript 的 durable 语义漂移。
- Main 侧 `@tiptap/markdown` codec 覆盖当前 toolbar durable matrix；编辑态临时 node、未知 node/mark 或不可无损 Markdown 表达的 attr 进入 unsupported/review，不静默丢弃。
- Note Segment 和 note SegmentSupplement 读路径会 reconcile `content.tiptap.json`：Markdown 未变且 JSON 改变时先把 JSON serialize 回 `segment.md` / `supplement.md`，再更新 manifest byte length、index summary 和 sidecar source/content hash。
- Audio Segment 和 audio SegmentSupplement transcript 读写路径会 reconcile 同级 `content.tiptap.json`：缺失时由 transcript Markdown 生成，JSON-only 改动会回写到 `## Transcript` 正文，保存时同时写 transcript Markdown 和 sidecar，并用 Markdown baseline 与 Tiptap JSON baseline 防止覆盖外部改动。`## Transcript` 后的正文允许包含 Tiptap heading；任意 `##` 不再截断 transcript。
- 外部复制目录不再被误判成跨父级移动；只有旧父目录已不存在且 workspace/kind/audio byte length 校验通过时才修复 manifest ownership。复制产生的 duplicate id 进入 diagnostics needs-review surface，不改变原对象归属。

## 移动合同

### Segment 跨 Memory 移动

合法外部操作：

```text
memories/A/segments/<segment-dir>  ->  memories/B/segments/<segment-dir>
```

Reo 必须：

- 保留 `segmentId`。
- 以 `segment.md` frontmatter `id` 为身份载体。
- 更新 Segment manifest `memoryId`。
- 更新 descendant Supplement manifest `memoryId` 和 `segmentId`。
- 保留正文、attachments、supplements、content sidecar。
- 刷新源 Memory 和目标 Memory summary/projection。
- 发现目标空间重复 `segmentId` 时排除冲突对象，不任意改 id。

### SegmentSupplement 跨 Segment 移动

合法外部操作：

```text
segments/X/supplements/<supplement-dir>  ->  segments/Y/supplements/<supplement-dir>
```

Reo 必须：

- 保留 `supplementId`。
- 以 `supplement.md` frontmatter `id` 为身份载体。
- 更新 Supplement manifest `memoryId` 和 `segmentId`。
- 保留正文、attachments、content sidecar。
- 从旧 parent projection 移除，加入新 parent projection。
- 归一化旧 parent 和新 parent `contentTabOrder`。

## 成功标准

- TDD RED/GREEN 覆盖 high-risk filesystem、IPC 和 renderer state 行为。
- `@tiptap/markdown` official parse/serialize 成为 main 侧 sidecar reconcile 的基础。
- 现有编辑器视觉和预览样式不变。
- Codex CLI 通过普通文件操作完成创建、移动、富文本 JSON 编辑，Reo 能重新投影。
- Electron runtime E2E 覆盖打开/刷新/保存/重开后的 Markdown 与 JSON sidecar 一致性。
- `npm run verify:quick` 通过。
- 任务结束前执行自审循环，直到没有已知 blocker/major 漏洞。

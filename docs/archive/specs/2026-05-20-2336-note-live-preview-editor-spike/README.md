# Note Live Preview Editor Spike

- 创建时间：2026-05-20 23:36 America/Los_Angeles
- 类型：技术与产品可行性 spike（不写 implementation spec，不改 production editor 代码）
- 目标实体：Reo Note Segment / Note SegmentSupplement 的正文编辑器底座

## Spike 目标

回答一个问题：**Reo Note editor 是否应以 CodeMirror 6 + Obsidian 风格 Live Preview 作为底座，`codemirror-markdown-hybrid` 应被采用、fork 还是仅作参考。**

不回答如何实现，不进入 sub-spec 实现清单。

## 当前事实（spike 起点）

- 当前 Note 编辑器是 `NoteEditorOverlay` 内的单一 markdown-first `<Textarea>`（`src/renderer/src/workspace/NoteEditorOverlay.tsx`）。
- 当前 Note 预览是 `MarkdownContentSurface`（`src/renderer/src/workspace/MarkdownContentSurface.tsx`）：按行 split，只用正则把 `![alt](attachments/<filename>)` 渲染为 `reo-attachment://` 预览图，其余文本是 `whitespace-pre-wrap` 纯文本。它不渲染标题、列表、引用、代码块、链接。
- Markdown / frontmatter 是语义真源；editor JSON 不是真源（note foundation 原始约束，见归档 spec）。
- 当前没有安装任何编辑器包：无 CodeMirror、ProseMirror、Tiptap、BlockNote、Milkdown、remark/unified。
- 保存走 `workspace:writeSegmentContent` / `workspace:writeSegmentSupplementContent`；create 走 note draft create/write/finalize；冲突用 `baselineContentHash` + `ERR_SEGMENT_CONTENT_STALE`。
- 图片附件：`workspace:saveSegmentAttachment` / `saveSegmentSupplementAttachment` 写入文件空间节点的 `attachments/`，返回相对 `attachments/<filename>`；预览通过 `reo-attachment://<workspaceId>/segments/<segmentId>[/supplements/<supplementId>]/<filename>` 只读协议。
- `docs/current/frontend.md` 已记录当前研究方向是 CM6 Live Preview，`codemirror-markdown-hybrid` 只作 spike 候选或参考，BlockNote 与 Tiptap 不是目标。

## 归档约束对照（note foundation）

归档 spec `docs/archive/specs/2026-05-19-0111-note-foundation-design/` 的原始 editor 决策是「BlockNote normal mode + raw mode fallback + subset 检测」。其 Spike #2 实测结论：**BlockNote 0.51.1 与 Milkdown 7.21.1 在 markdown-truth gate 下都只过 11/13 subset**，handoff 明确要求后续 sub-spec **不得**直接把 BlockNote 或 Milkdown 定为默认编辑器，必须先收口更窄的 editor decision。

因此当前用户新方向（CM6 Live Preview）与归档约束**不冲突**：它正面回应了归档遗留的 editor decision，且因为 CM6 的 editor state 本身就是 Markdown 字符串（不是结构化文档模型），它从根上消除了 BlockNote/Milkdown 失败的 round-trip 有损问题。冲突项以当前 `docs/current/*` 和用户新方向为准。

## 结论摘要

1. **推荐以 CodeMirror 6 作为 Reo Note editor 底座。** 它的 `EditorState` 文档本身就是字符串（`EditorState.create({doc})` / `state.doc.toString()`），Markdown 是唯一真源，没有第二语义模型，与 Reo 硬约束一致。它 framework-agnostic，可挂载到任意 DOM 节点，适配 React 19 renderer。
2. **`codemirror-markdown-hybrid` 仅作参考实现，不采用、不 fork。** 它实现了正确的 Obsidian Live Preview 思路（unfocused 行渲染、active 行 raw），MIT License，但只有 8 stars、无 published release、单维护者，且默认捆绑 KaTeX / Mermaid / 代码高亮 / 折叠等 Reo 当前不需要、且与 Reo「用户 HTML / 可执行内容默认不可信」边界冲突的能力。Reo 应基于官方 `@codemirror/*` 包自建一组薄 Live Preview decorations，参考它的 active-line/decoration 思路。
3. **不走 BlockNote / Tiptap。** 两者都基于 ProseMirror，canonical state 是结构化文档模型（ProseMirror Node / JSON），Markdown 只是有损 import/export，违反 Reo「Markdown 是唯一语义真源、editor JSON 不是真源」硬约束，且正是归档 Spike #2 实测失败的原因。
4. **关键阻断点：Electron 生产 CSP。** 生产 CSP 是 `style-src 'self'`（无 `unsafe-inline`），CM6 用 CSS-in-JS 运行时注入 `<style>`，在生产下会被拦截（dev CSP 有 `unsafe-inline`，会掩盖该问题）。官方 mitigation 是 `EditorView.cspNonce` facet + 在 `style-src` 加 per-load nonce。这条必须在实现 spec 中先落地，并更新 `docs/current/electron.md` 与 `src/main/securityPolicy.ts`。

详细推理见 `plan.md`，研究来源见 `evidence/research-sources.md`，过程记录见 `implementation-notes.md`。

## 原型稿定位

`reo文件区/reo的Balsamiq 风格的低保真原型图/concept4_codemirror_副本.html` 是展开态低保真原型：手写模拟 Live Preview（active 行显示 raw markdown + ember 微染背景，其它行渲染富文本）。**只参考其结构与交互意图，不参考其设计系统**——它的字体、颜色、圆角、毛玻璃工具栏不符合 Reo Soft Flat Design System，实现时一律以 Reo design token 为准。

## 推荐下一步

采用 CM6 自建薄 Live Preview extension（参考 `codemirror-markdown-hybrid`），分阶段：先 CSP nonce 基线 → 再最小 POC → 再 Live Preview + 图片 widget。详见 `plan.md` 第 10 节。

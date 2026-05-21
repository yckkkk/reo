# 0007 — Note 编辑器采用 CodeMirror 6 + Live Preview，Markdown 为唯一真源

## 决策

Reo Note Segment / Note SegmentSupplement 的正文编辑器底座采用 **CodeMirror 6**，并在其上自建一组薄 Obsidian 风格 Live Preview decorations。**不采用 BlockNote、Tiptap、Milkdown 或任何 ProseMirror 系结构化文档编辑器。**

## 约束（不变量）

- Markdown / frontmatter 是 Note 的唯一语义真源；editor 不持久化任何派生结构（无 editor JSON、无 ProseMirror document、无 block model）。
- CodeMirror 6 的 `EditorState` 文档本身就是 Markdown 字符串：`EditorState.create({ doc })` 初始化，`view.state.doc.toString()` 读回。预览只通过 view 层 decorations（mark / widget / replace / line）表达，不改文档字符。
- 不创建 `note.md`，不创建 `notes/` 目录；正文继续写入 `segment.md` / `supplement.md`。
- 图片继续走 Reo 现有附件模型：`attachments/<filename>` markdown 引用 + `reo-attachment://` 只读预览协议。
- 保存继续走 `workspace:writeSegmentContent` / `workspace:writeSegmentSupplementContent` 与 note draft create/write/finalize；external edit 冲突继续用 `baselineContentHash` + `ERR_SEGMENT_CONTENT_STALE`。
- 不放松 Electron sandbox / contextIsolation / nodeIntegration / webSecurity / CSP / permission / navigation 安全基线。

## 理由

- **真源一致性（决定性）**：CM6 doc=string，从根上满足「Markdown 唯一真源」，无 Markdown ⇄ 文档模型的有损 round-trip。
- **排除 BlockNote/Tiptap/Milkdown**：三者基于 ProseMirror，canonical state 是结构化文档模型，Markdown 仅 lossy import/export，违反真源约束。归档 spec `2026-05-19-0111-note-foundation-design` 的 Spike #2 实测 BlockNote 0.51.1 与 Milkdown 7.21.1 在 markdown-truth gate 下均只过 11/13，已证明该路径不可行。
- **排除直接依赖 `codemirror-markdown-hybrid`**：思路正确（unfocused 行渲染、active 行 raw）且 MIT，但只有 8 stars、无 published release、单维护者，且默认捆绑 KaTeX / Mermaid / 折叠等超 Reo 当前范围、并触「不可信可执行内容」边界的能力。仅作 active-line / decoration 组织方式的参考实现。

## 已知前置阻断

CM6 用 CSS-in-JS 运行时注入 `<style>`。Reo 生产 CSP 是 `style-src 'self'`（无 `unsafe-inline`），会拦截该注入；dev CSP 含 `unsafe-inline` 会掩盖该问题。Mitigation 是官方 `EditorView.cspNonce` facet + 生产 `style-src` 增加 per-load `nonce-...`。该基线必须先于编辑器实现落地，并更新 `docs/current/electron.md`。

## Stage A 设计决策（2026-05-21 锁定）

参考 Obsidian 简化保存与文件空间模型。以下取代当前 note 的 draft/finalize/显式保存/baseline-hash 冲突模型；audio 录音的 draft/finalize（音频字节累积）不受影响。

### 保存模型 — Obsidian 式全自动保存

- 新建笔记即创建真实 `segment.md` 文件（空 body 也建文件），不再 draft→finalize 两段式。
- 编辑时防抖自动写盘到 `segment.md`；**无显式「保存」按钮**。
- 因 auto-save 后无 dirty 状态，note 的「未保存内容丢失」风险与 dirty-close 二次确认取消。
- Stage 1 IPC 影响：note 简化为「创建 finalized note segment」+「防抖 auto-write 正文」两条路径，取消 `createNoteSegmentDraft` / `writeNoteSegmentDraftBody` / `finalizeNoteSegmentDraft` 的 note 两段式（SegmentSupplement note 同理）。

### 外部修改 / 冲突 — Obsidian 式监听 + 自动重载

- 去掉 baseline-hash 比对与 `ERR_SEGMENT_CONTENT_STALE` 冲突 AlertDialog。
- 本地无未保存编辑 → 静默重载磁盘版本；本地有未保存编辑 → 非阻断提示，不弹窗、不强制覆盖。
- **实现路径（Occam / 不过早引入 capability）**：优先复用现有 visibility/focus re-read 实现「重新聚焦即重载」，**不**为此立即引入持久 fs 文件监听。真正的 live `fs.watch` 作为可选后续增强；若引入必须同批设计 `docs/current/electron.md` / `flow.md` / `data.md`（main-owned watcher、scope、节流、安全边界）。

### 编辑面 — 三入口同一 CM6 实例

- **Memory Studio 正文区可直接就地编辑**：点击文本区即进入内联 CM6 编辑，不必先展开沉浸式态。
- 点击文本区时从左侧动画展开一个 **Markdown 格式工具栏**（加粗/斜体/标题/列表等）。该工具栏视觉上像从红色 FAB 区域展开，但**与 FAB 功能无关**；红色 FAB 保持现有 录音/笔记 speed dial 不变。
- 沉浸式展开仍保留（同一编辑器更大尺寸）。
- 三处编辑入口（studio 内联 / 沉浸式展开 / 格式工具栏）由**同一个 CM6 编辑器组件/实例**驱动（Occam），不为每个入口各造一套。
- 视觉一律用 Reo Soft Flat design token；原型稿只参考结构与意图。

## 来源

可行性论证与研究来源见归档 spec `docs/archive/specs/2026-05-20-2336-note-live-preview-editor-spike/`。跨 session 执行入口见 `docs/initiatives/2026-05-20-note-codemirror-live-preview/`。

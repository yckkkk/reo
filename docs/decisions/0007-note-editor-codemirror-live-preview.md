# 0007 — Note 编辑器采用 CodeMirror 6 + Live Preview，Markdown 为唯一真源

## 决策

Reo Note Segment / Note SegmentSupplement 的正文编辑器底座采用 **CodeMirror 6**，并在其上自建一组薄 Obsidian 风格 Live Preview decorations。**不采用 BlockNote、Tiptap、Milkdown 或任何 ProseMirror 系结构化文档编辑器。**

## 约束（不变量）

- Markdown / frontmatter 是 Note 的唯一语义真源；editor 不持久化任何派生结构（无 editor JSON、无 ProseMirror document、无 block model）。
- CodeMirror 6 的 `EditorState` 文档本身就是 Markdown 字符串：`EditorState.create({ doc })` 初始化，`view.state.doc.toString()` 读回。预览只通过 view 层 decorations（mark / widget / replace / line）表达，不改文档字符。
- 不创建 `note.md`，不创建 `notes/` 目录；正文继续写入 `segment.md` / `supplement.md`。
- 图片继续走 Reo 现有附件模型：`attachments/<filename>` markdown 引用 + `reo-attachment://` 只读预览协议。
- **保存采用 Obsidian 式自动保存**（见下「Stage A 设计决策」为权威）：note 新建即建真实 `segment.md`、编辑防抖 auto-write、无显式保存按钮、取消 note 的 `createNoteSegmentDraft`/`writeNoteSegmentDraftBody`/`finalizeNoteSegmentDraft` 两段式；external edit 用 visibilitychange re-read 自动重载，不用 `baselineContentHash` + `ERR_SEGMENT_CONTENT_STALE` 冲突弹窗。audio 录音的 draft/finalize 不受影响。
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
- 取消**显式保存型** dirty-close 二次确认。但编辑器仍有 pending write 状态（debounce 未 flush、in-flight write、写失败可恢复）；关闭 / 切换 selection / 录音 overlay 打开时必须 flush 或取消并保留可恢复，不得静默丢数据。Stage 1 必须把这些状态落成 auto-save 状态机（clean / debounce-pending / write-in-flight / write-failed / external-reload-pending）。
- Stage 1 IPC 影响：note 简化为「创建 finalized note segment」+「防抖 auto-write 正文」两条路径，取消 `createNoteSegmentDraft` / `writeNoteSegmentDraftBody` / `finalizeNoteSegmentDraft` 的 note 两段式（SegmentSupplement note 同理）。

### 外部修改 / 冲突 — Obsidian 式监听 + 自动重载

- 去掉 baseline-hash 比对与 `ERR_SEGMENT_CONTENT_STALE` 冲突 AlertDialog。
- 本地无未保存编辑 → 静默重载磁盘版本；本地有未保存编辑 → 非阻断提示，不弹窗、不强制覆盖。
- **实现路径（Occam / 不过早引入 capability）**：优先复用现有 **`visibilitychange` re-read**（`src/renderer/src/App.tsx` 已有 visibilitychange listener；当前**没有** window focus listener）实现「重新可见即重载」。若 Stage 1 需要 window focus 触发，必须同批添加 listener、测试与文档，不得把不存在的 focus 机制当现状。真正的 live `fs.watch` 作为可选后续增强；若引入必须同批设计 `docs/current/electron.md` / `flow.md` / `data.md`（main-owned watcher、scope、节流、安全边界）。

### 编辑面 — 三入口同一 CM6 实例

- **Memory Studio 正文区可直接就地编辑**：点击文本区即进入内联 CM6 编辑，不必先展开沉浸式态。
- 点击文本区时从左侧动画展开一个 **Markdown 格式工具栏**（加粗/斜体/标题/列表等）。该工具栏视觉上像从红色 FAB 区域展开，但**与 FAB 功能无关**；红色 FAB 保持现有 录音/笔记 speed dial 不变。
- 沉浸式展开仍保留（同一编辑器更大尺寸）。
- **「同一个 CM6 实例」的工程含义**（Stage 1 必须落定，不可停留在口号）：一个 editor owner 持有 `EditorState`、selection、composition 与 pending autosave 状态；studio 内联与沉浸式展开是同一 owner 的两种 **layout slot**。若切换布局需要 remount `EditorView`，必须 preserve doc / selection / undo history，且 composition-safe（IME 输入中不迁移）、focus 还原。Markdown 格式工具栏只向当前 owner `dispatch` transaction，**不自持 markdown 状态**。Stage 1 spec 必须写清：focus 迁移、selection 保留、IME composition 中不迁移、工具栏命令如何访问 view、关闭沉浸式后如何回到 studio。
- 视觉一律用 Reo Soft Flat design token；原型稿只参考结构与意图。
- **Stage 1 落地涉及的 current 文档更新**：`docs/current/electron.md`（note IPC 合同迁移）、`docs/current/flow.md`（auto-save 时序、写入串行化、外部重载）、`docs/current/frontend.md`（编辑面/工具栏/状态）；若改 note 文件生命周期或 manifest/data 合同再加 `docs/current/data.md`。

## 来源

可行性论证与研究来源见归档 spec `docs/archive/specs/2026-05-20-2336-note-live-preview-editor-spike/`。跨 session 执行入口见 `docs/initiatives/2026-05-20-note-codemirror-live-preview/`。

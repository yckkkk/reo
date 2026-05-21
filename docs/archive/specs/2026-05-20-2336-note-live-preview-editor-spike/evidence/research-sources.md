# Research Sources

调研阶段来源记录。本机环境无 Context7 MCP 工具，按 `.claude/CLAUDE.md` fallback 使用官方站点与源码。

## Context7 可用性

- 本 session 环境**未提供 Context7 MCP 工具**（工具清单中无 `mcp__context7__*`）。
- 按 CLAUDE.md「Context7 无覆盖时再使用官方站点、源码或包内文档，并记录采用依据」，改用 codemirror.net 官方文档、官方仓库与 GitHub 源码。

## CodeMirror 6 官方

- System Guide — <https://codemirror.net/docs/guide/>
  - EditorState 不可变、文档以行树结构存字符串、transaction 更新、EditorView 同步 DOM、view/state 分离、extensions 组合。
  - `EditorState.create({ doc: "string", extensions: [...] })` 初始化；`.doc.toString()` 读回字符串。
  - 四类 decoration：mark（区间样式）、widget（位置插 DOM）、replace（隐藏/替换文本）、line（行容器）。replace decoration 用于「替换区间为自定义 widget」。
  - framework-agnostic，`new EditorView({ parent })` 挂任意 DOM。
- Styling Example — <https://codemirror.net/examples/styling/>
  - CM6 用 CSS-in-JS（style-mod / StyleModule）运行时注入样式。
- Reference Manual — <https://codemirror.net/docs/ref/>
  - 官方包：`@codemirror/state`、`@codemirror/view`、`@codemirror/commands`、`@codemirror/language`、`@codemirror/lang-markdown`。
- CSP nonce（关键 mitigation）：
  - Changelog / discuss / dev issue 确认存在 `EditorView.cspNonce` facet：`EditorView.cspNonce.of("...")` 提供 nonce，挂到运行时注入的 `<style>`，可在禁用 `unsafe-inline` 的严格 CSP 下通过校验。
  - <https://discuss.codemirror.net/t/csp-nonce-value-check/7200>
  - <https://github.com/codemirror/dev/issues/395>（CSS doesn't work with a strict Content Security Policy）
  - <https://codemirror.net/docs/changelog/>
  - <https://github.com/codemirror/view/blob/main/src/editorview.ts>

## codemirror-markdown-hybrid（候选参考）

- 仓库 — <https://github.com/markdowneditors/codemirror-markdown-hybrid>
  - 功能：unfocused 行渲染预览 + active 行 raw markdown（Obsidian live preview 思路）；折叠标题、明暗主题、Markdown 快捷键（Ctrl+B/I/K）、代码高亮、表格、任务列表、KaTeX、Mermaid。
  - API：`hybridMarkdown(options?)`，options = `theme` / `enablePreview` / `enableKeymap` / `enableCollableH`；另有 theme/mode toggle 与 `actions` 格式化工具。
  - 目标 CM 版本：6。包名 `codemirror-markdown-hybrid`，ESM。
  - License：**MIT**。
  - 成熟度：8 stars / 2 forks / 1 watcher，102 commits，**无 published release**，单维护者。
  - 定位：作者意图是库；对 Reo 评估结论为**仅参考**（成熟度低、捆绑 KaTeX/Mermaid 等超范围且触安全边界、设计系统不匹配）。

## Tiptap（对照，确认不选）

- Intro — <https://tiptap.dev/docs/editor/core-concepts/introduction>
  - 基于 ProseMirror，canonical state 是结构化文档模型（ProseMirror Node），推荐用 Tiptap JSON 存储（`editor.getJSON()`）。
  - Markdown 是次要项（beta），仅 lossy import/export，不是一等持久化格式。
  - 结论：与 Reo「Markdown 唯一真源、editor JSON 不是真源」冲突，且与归档 Spike #2 中 BlockNote/Milkdown（同属 ProseMirror 系/文档模型系）失败原因同源。不选。

## Reo 代码事实（本机源码核对）

- `src/main/securityPolicy.ts`：生产 CSP `style-src 'self'`（无 `unsafe-inline`）、`img-src 'self' data: blob: reo-attachment:`、`script-src 'self'`；dev CSP 含 `'unsafe-inline' 'unsafe-eval'`。
- `src/renderer/src/workspace/NoteEditorOverlay.tsx`：当前单一 `<Textarea>`，markdown-first；paste/drop 用 `readPastedImageFile`/`readDroppedImageFile` → `saveSegmentAttachment`/`saveSegmentSupplementAttachment` → `insertMarkdownAtSelection` 插 `![alt](attachments/<filename>)`。
- `src/renderer/src/workspace/MarkdownContentSurface.tsx`：只读，按行 split + 正则只渲染图片，`parseAttachmentImageSource` 映射 `attachments/<filename>` → `reo-attachment://...`。
- `package.json`：React `^19.2.0`、Vite `^8.0.10`、electron `^41.5.0`、TypeScript `^6.0.3`、Tailwind `^4.2.4`、Vitest `^4.1.5`、jsdom `^29.1.1`。无任何编辑器/markdown 解析依赖。
- `docs/current/frontend.md`:117 已记录 CM6 Live Preview 研究方向、`codemirror-markdown-hybrid` 仅 spike 候选、BlockNote/Tiptap 非目标。
- 归档 `docs/archive/specs/2026-05-19-0111-note-foundation-design/`：Spike #2 实测 BlockNote 0.51.1 与 Milkdown 7.21.1 markdown-truth gate 均 11/13，handoff 要求收口更窄 editor decision，不得默认 BlockNote/Milkdown。

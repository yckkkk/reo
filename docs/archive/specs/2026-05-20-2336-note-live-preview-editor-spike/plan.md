# Plan — Note Live Preview Editor Spike

本文件是 spike 的分析正文。每节对应 session 要求覆盖的可行性问题。结论用于决定是否进入 implementation spec，不是实现清单本身。

## 0. 真实目标与非目标

### 目标

- Note Segment / Note SegmentSupplement 正文编辑器从「纯 textarea」升级为 Obsidian 风格 Live Preview：Markdown 字符串是 editor state 与保存真源；光标所在行/块保留 Markdown 源码，其它区域渲染成接近富文本的预览。
- 基本预览覆盖：标题、列表、引用、代码块、链接、图片。
- 图片沿用 Reo 当前附件模型：`attachments/<filename>` markdown 引用 + `reo-attachment://` 预览。
- 保存、external edit baselineContentHash 冲突沿用当前通道与模型。
- 复用现有 Memory Studio：Segment strip、播放区占位、content tab rail、`MarkdownContentSurface`、More 菜单、展开编辑入口。

### 非目标

- 不引入第二语义真源（不引入 BlockNote JSON、ProseMirror document、Notion-like block model）。
- 不创建 `note.md`，不创建新的 `notes/` 目录。
- 不放松 Electron sandbox / contextIsolation / nodeIntegration / webSecurity / CSP / permission / navigation 安全基线。
- 不新增 standalone 图片上传按钮，不新增未实现 toolbar，不重做 Memory Studio 页面。
- 不在本 spike 引入 KaTeX / Mermaid / 数学 / 图表 / 折叠等超范围能力。

## 1. CodeMirror 6 是否适合作为 Reo Note editor 底座

**结论：适合，且是当前最契合 Reo 硬约束的底座。**

- **真源一致性（决定性）。** CM6 的 `EditorState` 文档以行树结构存储**纯文本字符串**。初始化 `EditorState.create({ doc: markdownString, extensions })`，读取 `view.state.doc.toString()`。editor state 本身就是 Markdown 字符串，没有需要序列化的中间文档模型，因此不存在 BlockNote/ProseMirror 那种 Markdown ⇄ 文档模型的有损 round-trip。这直接满足「Markdown 是唯一语义真源」。
- **预览靠 decoration，不改文档。** Live Preview 用 view 层 decorations 实现（mark / widget / replace / line decoration）+ `ViewPlugin` 读取 selection 与语法树。预览是渲染层效果，底层文档字符不变。`@codemirror/lang-markdown` 用 Lezer 增量解析出语法树，`syntaxTree(state)` 提供可遍历树来驱动 decorations。
- **framework-agnostic。** CM6 是一组独立模块，`new EditorView({ parent })` 挂到任意 DOM。React 19 集成是成熟 pattern：`useRef` 容器 + `useEffect` 内 `new EditorView`，cleanup 时 `view.destroy()`；React 不托管 CM 内部 DOM，避免双重 reconciliation。
- **官方包面小且稳定。** 核心 `@codemirror/state`、`@codemirror/view`、`@codemirror/commands`、`@codemirror/language`、`@codemirror/lang-markdown`。无需 Forge/updater/Node 能力，纯 renderer 依赖。
- **风险：CSP（见第 6、7 节）。** 唯一硬阻断在 Electron 生产 CSP，可由官方 `EditorView.cspNonce` 解决。

## 2. codemirror-markdown-hybrid：采用 / 薄适配 / fork / 仅参考

**结论：仅作参考实现。不采用、不薄适配、不 fork。**

事实（见 evidence）：

- 功能正确：unfocused 行渲染预览、active 行 raw markdown，正是目标交互。导出 `hybridMarkdown(options?)`，options 含 `theme`、`enablePreview`、`enableKeymap`、`enableCollableH`，另有 theme/mode toggle 与 `actions` 格式化工具。
- License：MIT（可参考、可借鉴思路）。
- 成熟度低：8 stars / 2 forks / 1 watcher，**无 published release**，单维护者，102 commits。作为 Reo 长期 note 底座的运行时依赖风险过高。
- 范围超载且触红线：默认捆绑 KaTeX、Mermaid、代码高亮、折叠。Mermaid / KaTeX 属于渲染可执行/复杂内容，与 Reo「HTML 与可执行/可嵌入内容默认不可信，没有隔离预览能力前 renderer 不执行、不注入、不渲染」边界冲突，也违反「不引入无当前用途实现」。
- 设计系统不匹配：它自带主题与 DOM 结构，Reo 必须用自己的 design token、active-line ember 微染、`reo-attachment://` 图片 widget，落地时几乎不会复用它的样式与组件。

按 Reo「先评估复用 → 裁剪 / retokenize / 薄适配 / fork → 才自研」的顺序：采用整包带入超范围能力且不可控；fork 一个无 release 的单人项目维护成本高于收益；薄适配仍需剥离 KaTeX/Mermaid/折叠并重写主题，剥到只剩 active-line decoration 思路时，等价于基于官方 `@codemirror/*` 自建。**因此正确路径是基于官方包自建一组薄 Live Preview decorations，把 codemirror-markdown-hybrid 当作 active-line 切换与 decoration 组织方式的参考读物。** 该自研判断的拒绝理由（超范围能力、无 release、安全边界、design system、复杂度预算）已按 Reo 规则记录在此。

## 3. Markdown string 如何保持唯一真源

- editor state = `state.doc`（Markdown 字符串）。任何编辑都是对该字符串的 transaction。
- 保存：`view.state.doc.toString()` → 现有 `bodyMarkdown` 路径（create draft write/finalize；edit `writeSegmentContent` / `writeSegmentSupplementContent`），不改 IPC 合同。
- 不持久化任何 editor 派生结构（语法树、decoration、widget DOM 都是渲染期产物）。
- frontmatter 仍由 Markdown 文件承载；editor 只编辑 body（与当前 textarea 行为一致）。
- 不新增 Query key、不新增 manifest 字段；`baselineContentHash` 仍来自磁盘正文。

## 4. 光标行 raw + 其它区域 preview 的状态模型

- **触发输入**：`EditorState.selection`（主 range 所在行/块）+ `syntaxTree(state)`（块边界与行内 token 边界）。
- **decoration 计算**：`ViewPlugin` 在 `update`（doc/selection/viewport 变化）时重算 `DecorationSet`：
  - 对**不包含选区**的块：用 replace/widget/line/mark decoration 把 raw Markdown 语法渲染成预览（标题层级样式、列表 bullet、引用条、代码块容器、链接文本、图片 widget）。
  - 对**包含选区**的块/行：不施加隐藏型 decoration，露出 raw Markdown（可选 active-line 背景，对应原型 ember 微染，但用 Reo token）。
- **真源不变**：以上全部是 view decoration，`state.doc` 始终是完整 Markdown，光标移动只改变哪些块露出 raw，不改字符。
- **性能**：只对当前 viewport 内可见行计算 decoration（CM6 viewport/`visibleRanges` 机制），大文档不全量渲染。

## 5. 图片附件：preview / paste / drop / save path 接入

当前 Reo 附件链路已就绪，CM6 只替换「插入点」与「预览渲染」两端，不动 IPC：

- **预览**：图片 markdown `![alt](attachments/<filename>)` 用 replace `WidgetType` 渲染为 `<img>`，src 经现有映射规则转成 `reo-attachment://<workspaceId>/segments/<segmentId>[/supplements/<supplementId>]/<filename>`（与 `MarkdownContentSurface.parseAttachmentImageSource` 同规则，应提取为共享 helper 复用，避免两套映射）。CSP `img-src` 已含 `reo-attachment:`，无需放松。active 行（图片行被编辑时）回落显示 raw markdown。
- **paste / drop**：CM6 `EditorView.domEventHandlers({ paste, drop })` 捕获事件，复用现有 `readPastedImageFile` / `readDroppedImageFile`（mime/size 校验）→ `saveSegmentAttachment` / `saveSegmentSupplementAttachment` → 用返回的 `relativePath` 组 `![alt](attachments/<filename>)`，通过 transaction 插入到当前 selection（替代现有 textarea 的 `insertMarkdownAtSelection`，改用 `view.dispatch({ changes })`）。
- **save path 不变**：附件只改 body markdown 文本，随正常保存写回。
- **约束保持**：不新增 standalone 上传按钮；只保留 paste/drop 入口；只对 finalized edit target（`edit-segment` / `edit-segment-supplement`）启用，与当前 `canAttachImage` 一致。

## 6. 风险评估：selection / IME / undo-redo / large document / scroll / accessibility / CSP

| 风险 | 评估 | 处置 |
| --- | --- | --- |
| **CSP（生产）** | **高 / 决定性**。生产 `style-src 'self'` 无 `unsafe-inline`，CM6 CSS-in-JS 注入 `<style>` 会被拦截；dev CSP 有 `unsafe-inline` 会掩盖。 | 用 `EditorView.cspNonce.of(nonce)`，并在 `securityPolicy.ts` 生产 `style-src` 加 per-load `nonce-...`；renderer 通过受控通道拿到该 nonce。必须更新 `docs/current/electron.md`。先做这条再做编辑器。 |
| IME（中文输入） | 中。Live Preview 在 composition 中重算 decoration 可能打断输入法。 | composition 期间（`compositionstart`→`compositionend`）暂停 decoration 重算/active-block 切换；CM6 对 IME 有内建处理，需在真机验证中文/日文输入。 |
| undo/redo | 低。`@codemirror/commands` 的 history 基于文档 transaction，天然正确；decoration 不进 history。 | 直接用官方 history + keymap。 |
| selection | 低-中。active-block 判定要正确处理多行选区、块边界、空行。 | 以 selection 主 range 覆盖的块集合为「露出 raw」集合；用语法树块边界，不用纯行号猜测。 |
| large document | 低。CM6 viewport 化渲染，decoration 只算可见区。 | 只对 `view.visibleRanges` 计算；POC 用大 fixture 验证滚动不卡。 |
| scroll | 低-中。预览态与 raw 态行高不同，光标进出块时可能跳动。 | 预览 widget 尽量与 raw 行高一致；接受小幅 reflow，纳入运行时视觉验证。 |
| accessibility | 中。CM `contentDOM` 是 `textbox`；replace decoration 隐藏的语法对 AT 不可见。 | 图片 widget 给 `alt`/`aria-label`；保留键盘可达；纳入运行时验证。 |
| 主题切换 | 低。Reo 有 `data-theme` 明暗切换。 | CM 主题用 Reo token 驱动，`data-theme` 变化时重读 token（与 `Waveform` 同思路）。 |

## 7. 复用现有 Memory Studio，不重做页面

- **`NoteEditorOverlay`**：保留沉浸式 surface、titlebar（返回 / 标题 / 保存）、save/create/finalize 流程、dirty 关闭确认、disk-change banner、`ERR_SEGMENT_CONTENT_STALE` 冲突 AlertDialog、attachment pending 状态。**只替换**中间的 `<Textarea>` 为 CM6 `EditorView` 容器；`bodyMarkdown` state 改为由 CM 文档驱动（onChange transaction → setState 或直接读 `doc.toString()` 保存）。paste/drop 从 textarea handler 迁到 CM `domEventHandlers`。
- **`MarkdownContentSurface`**（只读预览）：可在第二阶段共享同一套 CM6 read-only decoration 渲染，达成「编辑态与只读态视觉一致」；但 spike 不强制，第一阶段可保持现状只读 surface。附件 src 映射 helper 应抽出共享。
- **content tab rail / More 菜单 / 展开入口 / Segment strip / 播放区占位**：全部不动。编辑器是 overlay 内部实现替换，不触达页面结构与 IPC。
- **复用边界**：CM6 编辑器是 feature-local 组件（放 `src/renderer/src/workspace/`），命名以 Reo note 语义为准，不以 codemirror 命名承载产品语义。

## 8. 与归档 note foundation 约束的冲突核对

- 不冲突项（强一致）：Markdown/frontmatter 唯一真源、editor JSON 不持久化、不建 `note.md`/`notes/`、`attachments/` 仅承载 markdown 引用资源、external edit baselineContentHash 冲突模型、沉浸式 overlay 不开新窗口。
- 取代项：归档的「BlockNote normal + raw fallback + subset 检测」被「CM6 Live Preview」取代。依据：归档 Spike #2 实测 BlockNote/Milkdown 都未过 markdown-truth gate，handoff 本就要求收口更窄 editor decision；CM6 因 doc=string 从根上满足该 gate，无需 subset 检测与 raw fallback 双模式。冲突以当前 `docs/current/*` 与用户新方向为准，理由如上。

## 9. 最小 POC 的验证标准

POC 必须验证（而不仅是「能 import」）：

1. CM6 在 Electron renderer + React 19 + Vite + Tailwind v4 真机环境挂载成功（不只 jsdom）。
2. 从 Markdown 字符串初始化文档，编辑后能原样 `doc.toString()` 导出，往返字符不丢。
3. 光标行 raw、其它块 preview 的切换在真实布局下成立（标题/列表/引用/代码块/链接其一即可作为机制证明，先标题+列表+图片）。
4. `![alt](attachments/<filename>)` 渲染为 `reo-attachment://` 预览 widget，且光标进入该行时回落 raw，body markdown 文本不变。
5. paste/drop 图片事件被 CM 捕获并能交给现有 `saveSegmentAttachment` 流程（POC 可 mock IPC，验证事件入口与插入 transaction）。
6. **生产 CSP（`style-src 'self' 'nonce-...'` + `EditorView.cspNonce`）下样式不被拦截**——必须用 `npm run build` + `npm start` 真机验证，dev 模式不算数。
7. 全程不放松任何 Electron 安全基线。

## 10. 推荐下一步与分阶段路径

**推荐：采用 CodeMirror 6 自建薄 Live Preview extension（参考 codemirror-markdown-hybrid），不走 BlockNote/Tiptap，不依赖/不 fork codemirror-markdown-hybrid。**

实现 spec 分阶段（每阶段是一个可验证工作单元，按 memory 约定每阶段过 /review + /simplify）：

- **阶段 0（前置硬阻断）**：CSP nonce 基线。生产 `securityPolicy.ts` 加 per-load style nonce，renderer 经受控通道取得并 `EditorView.cspNonce.of(nonce)`；更新 `docs/current/electron.md`。`npm run build` + `npm start` 验证生产 CSP。**不先解决这条不进编辑器。**
- **阶段 1（最小 POC → 收编）**：安装 `@codemirror/{state,view,commands,language,lang-markdown}`，在 `NoteEditorOverlay` 内用 CM6 容器替换 textarea，纯源码编辑（无 Live Preview），跑通 create/edit/finalize/conflict/paste-drop 与现有流程。此时才安装依赖（满足 Reo「实现对应能力才装包」）。
- **阶段 2（Live Preview decorations）**：实现 active-block raw + 其它块 preview（标题/列表/引用/代码块/链接），用 Reo design token，不用原型样式。
- **阶段 3（图片 widget + 共享映射）**：图片 replace widget + `reo-attachment://` 预览，抽出共享附件 src 映射 helper，与 `MarkdownContentSurface` 复用。
- **阶段 4（只读态统一，可选）**：`MarkdownContentSurface` 改用同一套 read-only decoration，达成编辑/只读视觉一致。

每个行为阶段执行真实 TDD（doc=string 往返、decoration 计算、paste/drop 插入 transaction 都可单测）；CSP 与 Live Preview 真实布局需运行时视觉验证证据进 spec。

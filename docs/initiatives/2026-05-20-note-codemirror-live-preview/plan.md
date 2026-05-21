# Plan — Note CodeMirror 6 Live Preview Initiative

本文件记录跨工作单元的阶段拆解依据与排序逻辑，不复制各 spec 的执行清单。

## 为什么这样排序

终极目标改动面横跨 Electron 安全基线、renderer 编辑器、decoration 渲染、附件链路。直接一次性接入 CM6 + Live Preview + 图片会把「生产 CSP 拦截」这个唯一硬阻断埋在大改动里，难以隔离验证与回滚。因此按「先解阻断 → 再换底座 → 再加预览 → 再加图片」拆分，每步独立可验证、可回滚。

## Stage 0 — CM6-ready style-nonce CSP 基线（前置硬阻断）

- 问题：生产 CSP `style-src 'self'` 无 `unsafe-inline`，CM6 CSS-in-JS 注入的 `<style>` 在生产会被拦截；dev CSP 含 `unsafe-inline` 会掩盖。
- 目标：建立 per-load style nonce 链路——main 生成 nonce → 注入 index.html meta + 写入生产 CSP `style-src 'self' 'nonce-…'` → renderer 读 meta 备用（供后续 `EditorView.cspNonce.of(nonce)`）。
- 不含 CM6 依赖。用合成 runtime 验证：带 nonce 的注入样式生效、不带 nonce 的注入样式被拦截。
- 触面：`src/main/securityPolicy.ts`、`src/main/security.ts`、`src/main/appProtocol.ts`、`src/renderer/index.html`、renderer 取 nonce helper；更新 `docs/current/electron.md`，必要时 `docs/current/frontend.md`。
- 当前 spec：`docs/specs/2026-05-20-2348-cm6-style-nonce-csp-baseline/`。

## Stage 1 — NoteEditorOverlay textarea → CM6 容器替换

- 安装 `@codemirror/state`、`@codemirror/view`、`@codemirror/commands`、`@codemirror/language`、`@codemirror/lang-markdown`（此时才装包）。
- 在 `NoteEditorOverlay` 内用 CM6 `EditorView` 替换 `<Textarea>`，纯源码编辑（暂无 Live Preview）。
- 保留并复用：save / create draft / finalize、dirty 关闭确认、disk-change banner、`ERR_SEGMENT_CONTENT_STALE` 冲突 AlertDialog、attachment pending、titlebar。
- `bodyMarkdown` 由 CM 文档驱动；paste/drop 从 textarea handler 迁到 CM `domEventHandlers`，复用现有 `readPastedImageFile` / `readDroppedImageFile` → `saveSegmentAttachment` / `saveSegmentSupplementAttachment`，插入改用 `view.dispatch({ changes })`。
- 用 Stage 0 的 nonce 接 `EditorView.cspNonce.of(nonce)`；此时才创建 renderer `readStyleNonce` helper（Stage 0 已推迟）。
- 按 0007 Stage A 实现 Obsidian 式保存（新建即建 segment.md、防抖 auto-write、无保存按钮、取消 note draft/finalize 与冲突弹窗）与三入口同一 CM6 实例（studio 内联 / 沉浸式展开 / 点击文本区从左侧展开 Markdown 格式工具栏）。
- 验证：现有 NoteEditorOverlay 行为测试全绿 + 真机生产 CSP 下 CM 样式生效。
- **Stage 1 spec 必须显式包含的两点**（Stage 0 不覆盖、易遗漏）：
  1. **真实 CM6 nonce 复验是 Stage 1 验收门槛**：Stage 0 的合成样式验证只证明 CSP 头机制，不证明 CM6 经 `EditorView.cspNonce` 注入的 `<style>` 带 nonce；Stage 1 必须在 `npm run build` + `npm start` 真机确认真实 CM6 样式生效。
  2. **新增 renderer 测试需登记 `vitest.config.ts` 的 `include`**：renderer project 用显式 `include` 数组，`*.test.ts`（如 `readStyleNonce`）不会被默认 glob 命中，必须加入 include 才会运行。

## Stage 2 — Live Preview decorations

- `ViewPlugin` + `syntaxTree`（@codemirror/lang-markdown 的 Lezer 树）+ selection 计算 `DecorationSet`：active block 露 raw，其它 block 用 decoration 渲染标题/列表/引用/代码块/链接预览。
- 只对 `view.visibleRanges` 计算（大文档性能）。
- composition（中文 IME）期间暂停 active-block 切换/重算。
- 视觉一律用 Reo design token；原型稿只参考结构与意图，不参考其设计系统。

## Stage 3 — 图片 widget + 共享映射

- 图片 markdown 用 replace `WidgetType` 渲染 `<img src="reo-attachment://…">`；active 行回落 raw。
- 抽出共享附件 src 映射 helper（与 `MarkdownContentSurface.parseAttachmentImageSource` 同规则），消除两套映射。
- body markdown 文本始终不变。

## Stage 4 —（可选）只读态统一

- `MarkdownContentSurface` 改用同一套 read-only decoration 渲染，编辑/只读视觉一致。
- 评估收益 vs 复杂度后决定是否纳入；可作为后续建议。

## 走弯路防护（贯穿所有 stage）

- 不绕开现有 NoteEditorOverlay / 附件 IPC / 冲突模型重写一套。
- 不引入 editor JSON 或第二真源。
- 不为预览能力提前引入 KaTeX/Mermaid/折叠。
- 不放松安全基线换取实现速度。
- CM6 组件 feature-local，命名以 Reo note 语义为准，不以 codemirror 命名承载产品语义。

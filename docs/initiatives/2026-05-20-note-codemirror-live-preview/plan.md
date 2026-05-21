# Plan — Note CodeMirror 6 Live Preview Initiative

本文件记录跨工作单元的阶段拆解依据与排序逻辑，不复制各 spec 的执行清单。

## 为什么这样排序

终极目标改动面横跨 Electron 安全基线、renderer 编辑器、decoration 渲染、附件链路。直接一次性接入 CM6 + Live Preview + 图片会把「生产 CSP 拦截」这个唯一硬阻断埋在大改动里，难以隔离验证与回滚。因此按「先解阻断 → 再换底座 → 再加预览 → 再加图片」拆分，每步独立可验证、可回滚。

## Stage 0 — CM6-ready style-nonce CSP 基线（前置硬阻断）

- 问题：生产 CSP `style-src 'self'` 无 `unsafe-inline`，CM6 CSS-in-JS 注入的 `<style>` 在生产会被拦截；dev CSP 含 `unsafe-inline` 会掩盖。
- 目标：建立 per-load style nonce 链路——main 生成 nonce → 注入 index.html meta + 写入生产 CSP `style-src 'self' 'nonce-…'` → renderer 读 meta 备用（供后续 `EditorView.cspNonce.of(nonce)`）。
- 不含 CM6 依赖。用合成 runtime 验证：带 nonce 的注入样式生效、不带 nonce 的注入样式被拦截。
- 目标链路：main 生成 nonce → 协议处理器注入 index.html meta + 文档 CSP → **Stage 0 用 runtime console 读 meta 验证可读**（renderer `readStyleNonce` helper 与其测试推迟到 Stage 1，Stage 0 无消费者）。
- 触面：`src/main/securityPolicy.ts`、`src/main/security.ts`、`src/main/appProtocol.ts`、`src/renderer/index.html`（meta 占位符）；更新 `docs/current/electron.md`（Stage 0 通常只更新 electron.md）。**Stage 0 不动 renderer 代码、不建 helper。**
- 当前 spec：`docs/specs/2026-05-20-2348-cm6-style-nonce-csp-baseline/`。

## Stage 1 — NoteEditorOverlay textarea → CM6 容器替换

- 安装 `@codemirror/state`、`@codemirror/view`、`@codemirror/commands`、`@codemirror/language`、`@codemirror/lang-markdown`（此时才装包）。
- 在 `NoteEditorOverlay` 内用 CM6 `EditorView` 替换 `<Textarea>`，纯源码编辑（暂无 Live Preview）。
- 按 0007 Stage A 实现 **Obsidian 式保存**：note 新建即建真实 `segment.md`、编辑防抖 auto-write、无显式保存按钮、**取消** note 的 `createNoteSegmentDraft`/`writeNoteSegmentDraftBody`/`finalizeNoteSegmentDraft` 两段式与 `ERR_SEGMENT_CONTENT_STALE` 冲突 AlertDialog。audio 录音 draft/finalize 不受影响。
- `bodyMarkdown` 由 CM 文档驱动；paste/drop 从 textarea handler 迁到 CM `domEventHandlers`，复用现有 `readPastedImageFile` / `readDroppedImageFile` → `saveSegmentAttachment` / `saveSegmentSupplementAttachment`，插入改用 `view.dispatch({ changes })`。
- 用 Stage 0 的 nonce 接 `EditorView.cspNonce.of(nonce)`；此时才创建 renderer `readStyleNonce` helper（Stage 0 已推迟）。
- 三入口同一 CM6 实例（studio 内联 / 沉浸式展开 / 点击文本区从左侧展开 Markdown 格式工具栏，按 0007 的「同一实例」工程含义）。

### Stage 1 spec 必须显式落定（Stage 0 不覆盖、否则会遗漏或返工）

1. **删除旧保存模型**：旧 NoteEditorOverlay 的 save/create draft/finalize/dirty 关闭确认/disk-change banner/冲突 AlertDialog 路径与其行为测试**必须被删除或重写为新行为**，不得要求「现有 create/edit/finalize/冲突测试全绿」。
2. **note IPC 合同迁移清单**：列出 contract / preload / main handler / renderer wrapper / 测试的 exact change——新增或替换「创建 finalized note segment / supplement」；auto-write 是否继续用 `writeSegmentContent`、是否携带 revision；`baselineContentHash` 字段删除/可选/仅作 stale 检测；`ERR_SEGMENT_CONTENT_STALE` 是否从 note body write 移除；旧 draft channel 是否仅保留给 recording。
3. **auto-save 状态机**：clean / debounce-pending / write-in-flight / write-failed-recoverable / external-reload-pending；定义 debounce 毫秒、flush 触发（关闭/切换/录音 overlay 打开）、写入串行化、旧 session response 丢弃（绑定 workspaceHandle）、失败 toast/inline status、Query cache 更新、attachment 插入后立即 schedule write。
4. **外部修改重载**：复用 `App.tsx` 现有 `visibilitychange` re-read；clean editor 静默更新、pending/dirty editor 非阻断提示、避免 auto-write 覆盖磁盘新版本；如需 window focus 触发须同批加 listener+测试+文档。
5. **「同一 CM6 实例」工程形态**：按 0007 定义落到 editor owner / layout slot / reparent / focus / selection / **undo history 保留** / IME composition / 工具栏 dispatch。
6. **Markdown 格式工具栏**：按钮键盘可达、ARIA label、命令如何改 selection、IME composition 中禁用/延迟 transaction、动画上限与 reduced motion、屏幕阅读器状态。
7. **Memory Studio 复用**：内联编辑如何更新 selected content Query / Memory detail cache / content tab rail / More 菜单 disabled 规则；录音 overlay 与 note editor 互斥规则。
8. **真实 CM6 nonce 复验是验收门槛**：Stage 0 合成验证只证明 CSP 头机制，不证明 CM6 经 `EditorView.cspNonce` 注入的 `<style>` 带 nonce；Stage 1 必须 `npm run build` + `npm start` 真机确认真实 CM6 样式生效（截图/DevTools 证据）。
9. **新增 renderer 测试登记 `vitest.config.ts` `include`**：renderer project 用显式 `include` 数组，`*.test.ts`（如 `readStyleNonce`）不会被默认 glob 命中，须加入 include 才运行。
10. **current 文档更新**：`docs/current/electron.md`（IPC 合同）、`flow.md`（auto-save 时序/串行化/重载）、`frontend.md`（编辑面/工具栏/状态）；改 note 文件生命周期或 manifest 再加 `data.md`。
11. **依赖安装**：仅 Stage 1 安装 `@codemirror/{state,view,commands,language,lang-markdown}`，spec 列出 exact 版本来源；Stage 0 不安装。

## Stage 2 — Live Preview decorations

- `ViewPlugin` + `syntaxTree`（@codemirror/lang-markdown 的 Lezer 树）+ selection 计算 `DecorationSet`：active block 露 raw，其它 block 用 decoration 渲染标题/列表/引用/代码块/链接预览。
- 只对 `view.visibleRanges` 计算（大文档性能）。
- composition（中文 IME）期间暂停 active-block 切换/重算。
- 视觉一律用 Reo design token。低保真原型稿 `/Users/yck/Downloads/PM/技术线/reo文件区/reo的Balsamiq 风格的低保真原型图/concept4_codemirror_副本.html`（仓库外）**只参考结构与交互意图**（active 行 raw + 其它行预览、点击文本区从左侧展开 Markdown 格式工具栏的动画），**不参考其设计系统**（字体/颜色/圆角/毛玻璃均不符合 Reo）。

## Stage 3 — 图片 widget + 共享映射

- 图片 markdown 用 replace `WidgetType` 渲染 `<img src="reo-attachment://…">`；active 行回落 raw。
- 抽出共享附件 src 映射 helper（与 `MarkdownContentSurface.parseAttachmentImageSource` 同规则），消除两套映射。
- body markdown 文本始终不变。

## Stage 4 —（可选）只读态统一

- `MarkdownContentSurface` 改用同一套 read-only decoration 渲染，编辑/只读视觉一致。
- 评估收益 vs 复杂度后决定是否纳入；可作为后续建议。

## 走弯路防护（贯穿所有 stage）

- 不绕开现有 NoteEditorOverlay 与附件 IPC、note content Query/cache ownership 另起一套；但 note 旧 baseline-hash 冲突路径（`ERR_SEGMENT_CONTENT_STALE` + AlertDialog）按 Stage A **删除或替换**——它是待迁移的源码现状，不是要保留的不变量。
- 不引入 editor JSON 或第二真源。
- 不为预览能力提前引入 KaTeX/Mermaid/折叠。
- 不放松安全基线换取实现速度。
- CM6 组件 feature-local，命名以 Reo note 语义为准，不以 codemirror 命名承载产品语义。

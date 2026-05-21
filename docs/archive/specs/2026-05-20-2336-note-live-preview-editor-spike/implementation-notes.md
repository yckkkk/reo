# Implementation Notes — Note Live Preview Editor Spike

## 性质

这是技术/产品可行性 spike，输出是结论与分阶段路径，**不是 implementation spec**，不改 production editor 代码。

## 本 session 做了什么

1. 完成 CLAUDE.md 启动阅读：AGENTS.md、README、docs/README、foundation、architecture、product、frontend、electron，按需 grep flow，并核对归档 note foundation 约束。
2. 核对当前 editor 源码事实：`NoteEditorOverlay.tsx`（textarea + 附件 paste/drop + 冲突流程）、`noteEditorModel.ts`、`MarkdownContentSurface.tsx`（只读、按行正则、图片映射）。
3. 核对 Electron 安全基线：`securityPolicy.ts` 生产 `style-src 'self'`（无 unsafe-inline）。
4. 调研 CodeMirror 6 官方文档（state/view/decoration/framework-agnostic、`EditorView.cspNonce`）。
5. 调研 `codemirror-markdown-hybrid`（功能、API、MIT、8 stars/无 release/捆绑 KaTeX+Mermaid）。
6. 对照 Tiptap（ProseMirror 文档模型、Markdown 仅 lossy import/export）确认不选。
7. 写出 README / plan / evidence / 本文件。

## 关键判断

- **CM6 是底座**：doc=string，Markdown 唯一真源，无第二模型；framework-agnostic 适配 React 19 renderer。
- **codemirror-markdown-hybrid 仅参考**：成熟度低 + 超范围捆绑 + 触「不可信 HTML/可执行内容」边界 + 设计系统不匹配。
- **不走 BlockNote/Tiptap**：ProseMirror 文档模型与「Markdown 唯一真源」冲突，正是归档 Spike #2 失败原因。
- **CSP 是唯一硬阻断**：生产 `style-src 'self'` 无 unsafe-inline，CM6 运行时注入 `<style>` 会被拦截，dev CSP 会掩盖；mitigation 是 `EditorView.cspNonce` + 生产 style-src 加 per-load nonce，必须更新 `docs/current/electron.md` 与 `securityPolicy.ts`，且作为实现阶段 0。

## 为什么本 session 不写可执行 POC 代码（TDD / POC 豁免理由）

- Reo 装包纪律：`@codemirror/*`（5 包）一旦写入 `package.json` 就是 production 依赖足迹；CLAUDE.md 明确「只在实现对应基础能力时安装」「不得加入空闲依赖」。为一个可由官方文档高置信回答的可行性问题装包再回滚，违反该纪律。
- session 约束：「输出 spike 结论前不修改 production editor 代码」「不要接入 production runtime，除非 spike 已证明必要且非常小」。
- POC 中**唯一无法靠分析定论**的两点（生产 CSP 下样式不被拦截、Live Preview 在真实布局下的交互/IME/滚动）都**必须在真实 Electron 生产构建中验证**（dev 模式因 CSP 含 unsafe-inline 会掩盖问题，jsdom 无真实布局）。这类验证需要 CSP nonce 接线，已触达 production runtime 与安全基线，**不属于「非常小」**，应放进实现 spec 的阶段 0/阶段 1，而非本 spike。
- 因此本 spike 以分析 + 精确 POC 验证标准（plan.md 第 9 节）+ 分阶段路径（第 10 节）收口可行性，executable POC 推迟到实现阶段，届时按真实 TDD 执行。

## 验证

- 本 session **仅文档变更，无任何 production 代码或依赖变更**，按 CLAUDE.md「明确只是文档调研且没有 production 代码变更」豁免 `npm run verify:quick`。
- 若进入实现阶段，行为变更必须真实 TDD，CSP / Live Preview 真实布局必须 `npm run build` + `npm start` 运行时视觉验证证据进 spec。

## 下一 session 从哪里继续

1. 决定是否把本 spike 的「采用 CM6 自建薄 Live Preview」推进为 implementation spec。
2. 若推进：先做实现阶段 0（CSP nonce 基线，更新 electron.md + securityPolicy.ts，build+start 验证），再阶段 1（装 `@codemirror/*` + 在 NoteEditorOverlay 内 textarea→CM6 容器替换，跑通现有 create/edit/finalize/conflict/paste-drop）。
3. 本 spike 产出的是 plan 而非已完成实现；归档前若进入跨 session 实现，需先建/更新对应 active initiative 承接（见 docs 纪律）。当前 spike objective（可行性结论）已完成，但所指向实现尚未做，故本 spec 暂留 `docs/specs/*`，不归档。

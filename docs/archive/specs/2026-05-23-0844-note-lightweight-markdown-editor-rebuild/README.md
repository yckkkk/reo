# Note 轻量 Markdown 编辑器回退

创建时间：2026-05-23 08:44 America/Los_Angeles

## Objective

回退 Note 编辑器的重型 CM6 路线，恢复为轻量 Markdown textarea-first 编辑器，并保留 `memory.md`、`segment.md`、`supplement.md` 文件合同。

## 成功标准

- 主线代码、依赖、current 文档和 active docs 中不再把 CodeMirror 6 作为 Note 编辑器方向。
- Note 编辑器使用单一 textarea 编辑 Markdown 字符串。
- Memory Studio 中的已保存 Note Segment 和 Note SegmentSupplement 可从当前正文区域进入同一个轻量 textarea 编辑器。
- 工具栏只提供轻量 Markdown 文本插入：图片、分割线、标题、项目列表、编号列表、引用、粗体和强调。
- 图片粘贴/拖放继续写入当前 note 文件空间节点的 `attachments/`，正文只插入相对 Markdown 引用。
- 保存、冲突提示和访达可编辑的 `segment.md` / `supplement.md` 合同保持可用。
- focused tests、`npm run typecheck:quick`、`npm run verify:quick` 和 `npm run build` 在当前快照运行通过后才声明完成。

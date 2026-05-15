# 0003 Local Memory Space Folder

时间：2026-05-06 01:00 America/Los_Angeles
状态：已接受

## 决策

Reo 的记忆空间是用户选择的本地文件夹。

用户可读写的语义真源是普通 Markdown 和普通资源文件。Reo 的技术完整性、事务、恢复和可重建索引放在 `.reo/` 中。DB 只能作为索引、关系、查询和处理状态层，不能替代记忆空间文件夹成为用户记忆内容真源。

每个记忆空间 root 必须包含 `AGENTS.md`，用于说明记忆空间目的、文件结构、Reo 管理路径和 AI 协作规则。Reo 不覆盖已有 `AGENTS.md`。

当前文件合同：

```text
AGENTS.md
.reo/workspace.json
.reo/index.json
.reo/objects/memories/<memoryId>.json
.reo/objects/segments/<segmentId>.json
.reo/objects/supplements/<supplementId>.json
memories/<memoryDirectory>/memory.md
memories/<memoryDirectory>/segments/<segmentDirectory>/segment.md
memories/<memoryDirectory>/segments/<segmentDirectory>/audio.webm
memories/<memoryDirectory>/segments/<segmentDirectory>/supplements/<supplementDirectory>/supplement.md
memories/<memoryDirectory>/segments/<segmentDirectory>/supplements/<supplementDirectory>/audio.webm
```

`memory.md`、`segment.md` 和 `supplement.md` 的 Markdown 正文与 YAML frontmatter 是用户和 agent 可编辑语义层。`.reo/objects/*/*.json` 是 Reo-only 技术 manifest。`.reo/index.json` 是可删除、可重建的 UI index。

Draft audio segment 和 draft audio SegmentSupplement 保存在 Reo 管理路径：

```text
.reo/drafts/segments/<segmentId>/audio.webm
.reo/drafts/segments/<segmentId>/segment.json
.reo/drafts/segments/<segmentId>/transcript.md
.reo/drafts/supplements/<supplementId>/audio.webm
.reo/drafts/supplements/<supplementId>/supplement.json
.reo/drafts/supplements/<supplementId>/transcript.md
```

用户可在记忆空间内容目录中放入任意普通文件，包括 `.json`、`.md`、`.html`、图片、PDF 或其它资源。未被当前对象合同识别的文件不自动进入 Reo 对象图。HTML 默认是不可信资源，只有在隔离预览能力实现后才允许渲染。

## 原因

- 用户拥有本地文件夹和普通文件，能用 Finder、Git、备份工具和编辑器管理。
- Codex CLI 这类 AI 可以直接进入记忆空间 folder 工作，不依赖 Reo 私有数据库上下文。
- Markdown + YAML frontmatter 适合作为用户和 agent 可编辑的轻量语义层。
- 隐藏 `.reo/` 目录适合承载 Reo 的技术完整性、事务、恢复和可重建索引。
- Reo 是 Electron 一等宿主，应该显式管理本地记忆空间，而不是退化为只读 UI shell。

## 影响

- Renderer 不得直接访问 Node 或 Electron API；文件能力必须通过窄 preload/IPC 进入 main process。
- 记忆空间创建必须在用户选择的父目录下创建 title 同名 child folder；同名 child 已存在时失败。打开本地记忆空间时，现有 Reo 记忆空间直接打开，空文件夹原地初始化，非空非 Reo 文件夹失败。
- 文件路径使用稳定 id 和安全 basename；用户可见命名来自目录 basename 和 Markdown title frontmatter。
- DB 引入必须证明真实查询、索引、恢复或性能需求，且不能成为唯一用户内容真源。
- `AGENTS.md` 是产品契约，不是附属文档。

## 参考

- Obsidian Help, Create a vault: https://obsidian.md/help/Getting%2Bstarted/Create%2Ba%2Bvault
- Obsidian Help, How Obsidian stores data: https://obsidian.md/help/data-storage
- Obsidian Help, Configuration folder: https://obsidian.md/help/configuration-folder
- Obsidian Help, Attachments: https://obsidian.md/help/attachments
- Zettlr User Manual, Projects: https://docs.zettlr.com/en/file-manager/projects/

# 0003 Local Memory Workspace

时间：2026-05-06 01:00 America/Los_Angeles
状态：已接受

## 决策

Reo 的 memory workspace 是用户选择的本地文件夹。

Workspace 文件夹是真实产物源。用户记忆内容以普通文件保存，供用户、文件系统工具、Codex CLI 和未来 Reo 内置 AI 直接读取。Reo 可以使用 DB 作为索引、关系、查询和处理状态层，但 DB 不替代 workspace 文件夹作为用户记忆内容真源。

每个 workspace root 必须包含 `AGENTS.md`，用于说明 workspace 目的、文件结构、Reo 管理路径和 AI 协作规则。Reo 不覆盖已有 `AGENTS.md`。

Reo 自己的 workspace metadata 放在隐藏目录：

```text
.reo/workspace.json
```

Recording 产物使用普通文件：

```text
recordings/<recording-id>/audio.webm
recordings/<recording-id>/transcript.md
recordings/<recording-id>/reflections.md
recordings/<recording-id>/recording.json
```

## 原因

- 用户拥有本地文件夹和普通文件，能用 Finder、Git、备份工具和编辑器管理。
- Codex CLI 这类 AI 可以直接进入 workspace folder 工作，不依赖 Reo 私有数据库上下文。
- Obsidian 的 vault 模型证明了本地文件夹、隐藏配置目录和普通附件文件是可维护的用户数据边界。
- Zettlr 的 project folder 模型证明项目可以作为文件夹属性存在，文件夹内可保留比当前产品 UI 更多的文件。
- Reo 是 Electron 一等宿主，应该显式管理本地 workspace，而不是退化为只读 UI shell。

## 影响

- First product slice 必须设计窄 preload/IPC 文件能力，renderer 不得直接访问 Node 或 Electron API。
- Workspace 初始化必须处理非空文件夹、已有 `AGENTS.md`、已有 `.reo/workspace.json`、权限失败和 schema version。
- 文件路径使用稳定 id，不依赖用户可改标题。
- DB 引入必须证明真实查询、索引、恢复或性能需求，且不能成为唯一用户内容真源。
- `AGENTS.md` 是产品契约，不是附属文档。
- 用户可放入任意文件；Reo UI 第一版只产品化录音记录。

## 参考

- Obsidian Help, Create a vault: https://obsidian.md/help/Getting%2Bstarted/Create%2Ba%2Bvault
- Obsidian Help, How Obsidian stores data: https://obsidian.md/help/data-storage
- Obsidian Help, Configuration folder: https://obsidian.md/help/configuration-folder
- Obsidian Help, Attachments: https://obsidian.md/help/attachments
- Zettlr User Manual, Projects: https://docs.zettlr.com/en/file-manager/projects/

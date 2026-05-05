# 规格

## 目标

建立简洁、agent-first 的 Reo 操作系统，使后续 coding agents 避免不必要复杂性、假 TDD、薄弱数据建模和自创架构。

## 验收标准

- `AGENTS.md` 与 `.claude/CLAUDE.md` 保持镜像。
- Docs 只使用 `current/`、`decisions/`、`specs/`。
- 默认阅读链短且明确。
- Data、flow、Electron、frontend、quality 改动都有硬门禁。
- Specs 使用 `YYYY-MM-DD-HHMM-slug`，并记录本机 timezone。
- Docs hierarchy 保持短、扁平、可维护。
- 所有文档为中文。
- `npm run verify:quick` 通过。

## 非目标

- 本任务不安装未来技术栈。
- 本任务不新增 Electron preload、IPC、auth、database、updater 或 packaging 代码。
- 本任务不创建额外顶层 docs 目录。

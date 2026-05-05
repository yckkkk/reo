# 0001 Agent Docs System

时间：2026-05-05 05:47 America/Los_Angeles
状态：已接受

## 决策

Reo 使用 `AGENTS.md` 与 `.claude/CLAUDE.md` 作为镜像 agent 入口文件，基于 Karpathy-style coding-agent 原则，并加入 Reo 专属硬门禁。

Reo docs 使用三层结构：

```text
docs/current/
docs/decisions/
docs/specs/
```

## 原因

- Agent startup context 必须小。
- 当前项目真源必须容易找到。
- 任务记录必须可追溯，但不能进入默认阅读链。
- 默认文档层级必须保持短、扁平、可维护。

## 影响

- 已完成 specs 保留，但不是默认阅读内容。
- 长期结论必须压缩进 `docs/current/*` 或 `docs/decisions/*`。
- 未来新增 docs folder 必须有明确理由。

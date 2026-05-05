# 0001 Agent Docs System

时间：2026-05-05 05:47 America/Los_Angeles
状态：已接受

## 决策

Reo 使用 `AGENTS.md` 与 `.claude/CLAUDE.md` 作为镜像 agent 入口文件，基于 Karpathy-style coding-agent 原则，并加入 Reo 专属硬门禁。

Reo docs 使用五层结构：

```text
docs/archive/
docs/current/
docs/decisions/
docs/initiatives/
docs/specs/
```

## 原因

- Agent startup context 必须小。
- 当前项目真源必须容易找到。
- 任务记录必须可追溯，但不能进入默认阅读链。
- 默认文档层级必须保持短、扁平、可维护。
- 精简必须服务于交接、收口和验证，而不是机械减少规则。
- 已收口任务记录必须离开当前任务工作区。
- 跨 session 长期任务需要独立于当前 slice 记录。

## 影响

- 跨 session 长期任务使用 `docs/initiatives/*`。
- 当前任务使用 `docs/specs/*`。
- 已完成 specs 移入 `docs/archive/specs/*`，但不是默认阅读内容。
- 已完成、取消或失效的 initiatives 移入 `docs/archive/initiatives/*`。
- 归档子目录在首次写入时创建，不保留空占位目录。
- 默认最多 1 个 active initiative。
- 创建新 spec 前，必须确认 `docs/specs/*` 为空或只包含当前任务。
- 读取归档时先搜索，再只打开相关文件。
- 长期结论必须压缩进 `docs/current/*` 或 `docs/decisions/*`。
- `docs/current/*` 只记录当前行为、边界、接口、设计约束和稳定事实。
- 未来新增 docs folder 必须有明确理由。

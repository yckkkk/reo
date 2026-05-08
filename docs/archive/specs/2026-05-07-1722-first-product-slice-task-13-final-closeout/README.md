# Task 13：最终收口、审查与验证

创建时间：2026-05-07 17:22 America/Los_Angeles

## 目标

收口 first product slice 的长期文档、initiative 状态、最终审查、最终验证和最终提交。该 task 不新增产品能力；只确认已交付范围、移除临时状态、保留当前真源，并给出可复核的最终证据。

## 范围

- 核对 `docs/current/*` 是否已包含 first product slice 的稳定当前事实。
- 核对 active initiative 是否准确表达 Task 1 到 Task 13 的状态与剩余交付。
- 确认 `docs/specs/*` 只有当前 Task 13，已完成 Task 12 在 archive。
- 汇总 review：Codex 自审、subagent 对抗审查、Claude CLI 可用性状态、ycksimplify 代码简化边界。
- 运行最终固定验证命令。
- 归档本 spec 并提交最终收口 commit。

## 非范围

- 不实现新功能。
- 不安装依赖。
- 不创建新的 runtime/service/IPC 抽象。
- 不重写已归档 specs。
- 不把未实现的 photo、video、file、film、AI、auth、sync、share、global search、settings 或 updater 描述为已交付能力。

## 成功标准

- `docs/current/*` 与源码事实、Task 1 到 Task 12 证据一致。
- Initiative 标记 first product slice 已完成完整长任务交付，且没有虚假的未来能力。
- 没有 unresolved BLOCKER/MAJOR。
- `npm run verify:quick`、`git diff --check`、`diff -u AGENTS.md .claude/CLAUDE.md`、`find docs/specs -mindepth 1 -maxdepth 1 -print` 通过并记录。
- `docs/specs/*` 归档后为空。
- 提交独立 final closeout commit。

# IMPL-004 Workspace data、Query 和创建表单

创建时间：2026-05-06 06:32 America/Los_Angeles

## 目标

本切片把 IMPL-003 已有的 workspace 文件事务和显式 preload API 接入 renderer 数据层，完成无 workspace 状态下的新 workspace 创建入口。用户可以填写 title、description，选择本地目录，提交后由 main 初始化 workspace，并在 renderer 内保存当前 workspace session state。

## 范围

- 创建 TanStack Query client provider，作为 renderer server-state/cache 边界。
- 创建 workspace query/mutation helper，query key 不包含 `workspaceHandle`。
- 创建 `CreateWorkspaceForm`，使用 React Hook Form、Zod resolver 和 IMPL-003 的 explicit preload wrapper。
- `App` 从静态 shell 切到 workspace route state：无 workspace 显示创建表单，有 workspace 显示最小 workspace loaded 状态。
- 记录 folder picker cancel、existing `AGENTS.md` conflict、focus 和错误保留行为。

## 非范围

- 不创建 DB schema、Drizzle migration 或 DB-backed cache。
- 不创建 recording overlay、MediaRecorder、playback、transcript autosave。
- 不初始化 shadcn/ui，不新增 Button/Label primitives；本切片使用语义 HTML 控件。
- 不显示 photo、video、file、film 能力。

## 完成条件

- RED -> GREEN -> REFACTOR 证据写入 `tdd.md`。
- `npm run test:renderer` 和 `npm run verify:quick` 通过。
- 900 x 620 与宽桌面 viewport 记录 DOM 或截图证据。
- `docs/current/frontend.md`、`docs/current/data.md`、`docs/current/flow.md` 更新为当前事实。
- spec 完成后归档，active `docs/specs/*` 清空。

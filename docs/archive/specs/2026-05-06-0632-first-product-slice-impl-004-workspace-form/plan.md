# 执行计划

## 当前真源输入

- 归档实现计划：`docs/archive/specs/2026-05-06-0452-first-product-slice-implementation-plan/plan.md`
- 当前 Electron/IPC 边界：`docs/current/electron.md`
- 当前文件事务边界：`docs/current/data.md`、`docs/current/flow.md`
- 当前 renderer 结构：`docs/current/frontend.md`
- 当前质量门禁：`docs/current/quality.md`

## 设计决策

- DB schema：本切片不引入 DB、Drizzle、migration 或 tables。第一产品切片的用户内容真源仍是 workspace 磁盘文件。
- 表关系：本切片不创建关系模型；workspace snapshot 来自 main 初始化返回值和后续 Query cache。
- 数据获取模式：renderer 通过 explicit preload wrapper 调用 main。TanStack Query 只缓存 workspace snapshot 类 server-state，不持久化用户内容，不保存 `workspaceHandle`。
- cache/query/state ownership：`workspaceHandle` 只存在于当前 renderer session state；query key 只使用 `workspaceId`。表单草稿归 React Hook Form；folder selection token/displayPath 归组件本地 state。
- 可复用组件：本切片不创建 shared UI primitive。表单是业务组件，后续 IMPL-005 再 retokenize 到 shadcn Button/Label。
- 文件夹结构：创建 `queryClient.tsx`、`workspaceQueries.ts`、`CreateWorkspaceForm.tsx` 和对应 renderer tests。
- Electron/preload/IPC/security：不新增 channel；只消费 IMPL-003 已有 `chooseDirectory` 和 `initializeWorkspace`。
- filesystem transaction/recovery：不改变 main 文件事务；renderer 只展示 typed error，不直接接触路径。
- 错误处理 gate：folder cancel 不清空表单；workspace conflict 显示 alert 并保留输入；submit failure 不丢失 title/description/folder selection。

## TDD 顺序

1. RED：`CreateWorkspaceForm` 初始 UI、初始 focus、folder picker cancel 保留输入。
2. GREEN：实现最小表单和 picker state。
3. RED：existing `AGENTS.md` conflict 显示 alert，不清空输入。
4. GREEN：接入 `initializeWorkspace` mutation 和 typed error 显示。
5. RED：query key 不包含 `workspaceHandle`，App 无 workspace 时显示管理页，submit 后显示 loaded state。
6. GREEN：实现 Query provider、workspace query helper 和 App session state。
7. REFACTOR：整理类型、避免重复、重跑 renderer/quick verification。

## 验证命令

- `npm run test:renderer`
- `npm run verify:quick`
- viewport DOM 或截图证据：900 x 620、宽桌面
- `git diff --check`
- `diff -u AGENTS.md .claude/CLAUDE.md`
- `find docs/specs -mindepth 1 -maxdepth 1 -print`

## 提交

提交信息：`feat: add workspace creation flow`

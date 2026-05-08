# 验证

## RED/GREEN/REFACTOR 记录

- RED，2026-05-08：
  - `npm run test:renderer -- src/renderer/src/App.test.tsx` FAIL。
  - 新增 `shows open-local workspace errors from the starter shell` 失败：找不到 `role="alert"`。
  - 新增 `shows open-local workspace errors from the loaded shell without losing the current workspace` 失败：找不到 `role="alert"`。
  - 结论：sidebar `打开本地工作区` 失败分支会设置 renderer error state，但当前内容区没有可见错误出口。
- GREEN，2026-05-08：
  - `App` 在 starter shell 和 loaded shell 中渲染 `WorkspaceErrorBanner`，只承载 sidebar open-local failure。
  - 打开失败不打开创建弹层，不清空当前 workspace session。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx` PASS：1 个文件、12 个 tests 通过。
- REFACTOR，2026-05-08：
  - 更新 `docs/current/flow.md`、`docs/current/frontend.md`、`docs/current/quality.md`，把当前 open-local failure 行为和测试覆盖压缩回 current 真源。

## 自动化验证

- PASS，2026-05-08：
  - `npm run test:renderer -- src/renderer/src/App.test.tsx src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/workspace/CreateWorkspaceForm.test.tsx`
  - 结果：3 个文件、31 个 tests 通过。
- PASS，2026-05-08：
  - `npm run verify:quick`
  - 结果：typecheck、249 个 main tests、105 个 renderer tests、lint、format check 全部通过。

## Runtime 说明

- 本轮没有完成真实 Electron OS dialog 点击复验。
- 当前可用工具未提供可操作的 macOS Computer Use 控制面；不能把 `npm run dev` 手工路径声明为已验证。
- 本轮修复覆盖的是失败分支可见反馈；跨重启 workspace 状态持久化仍不是当前实现事实，需要独立定义 owner、存储位置、恢复语义和验证路径。

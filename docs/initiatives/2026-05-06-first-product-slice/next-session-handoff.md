# 新 session 交接

## 目标

设定 `$goal`：完成 Reo 第一产品切片的完整长任务交付。

设计加固、对齐实现计划和 `$plan-eng-review` 已通过。下一步是使用 `$executing-plans`，在隔离 worktree 中从 IMPL-001 开始真实 TDD 实现。不得在 `main` 上直接实现，除非用户显式授权。

## 启动阅读

1. `AGENTS.md`
2. `.claude/CLAUDE.md`
3. `README.md`
4. `docs/README.md`
5. `docs/current/foundation.md`
6. `docs/current/architecture.md`
7. `docs/current/electron.md`
8. `docs/current/data.md`
9. `docs/current/flow.md`
10. `docs/current/frontend.md`
11. `docs/current/quality.md`
12. `docs/initiatives/2026-05-06-first-product-slice/README.md`
13. `docs/initiatives/2026-05-06-first-product-slice/engineering-readiness.md`
14. `docs/initiatives/2026-05-06-first-product-slice/plan.md`
15. `docs/initiatives/2026-05-06-first-product-slice/tasks.md`
16. `docs/archive/specs/2026-05-06-0338-first-product-slice-design-hardening/`
17. `docs/archive/specs/2026-05-06-0452-first-product-slice-implementation-plan/plan.md`

归档 specs 是已完成阶段的执行权威和证据；不要编辑归档文件。若发现计划缺陷，创建新的 active spec 修订，并重新审查通过。

## 进入实现前检查

- 使用 `$using-superpowers`。
- 使用 `$executing-plans` 和 `using-git-worktrees`。
- 运行 `git status --short`，确认没有未解释的 dirty worktree。
- 运行 `find docs/specs -mindepth 1 -maxdepth 1 -print`，必须为空。
- 确认当前 HEAD 包含 design-hardening 和 implementation-plan 两个文档提交。
- 确认 active initiative 是 `docs/initiatives/2026-05-06-first-product-slice/`。

## 执行规则

- 每个实现切片都必须新建自己的 `docs/specs/YYYY-MM-DD-HHMM-first-product-slice-impl-XXX-.../`。
- 每个切片都必须执行真实 RED -> GREEN -> REFACTOR。
- 每个切片都必须更新涉及的 `docs/current/*`。
- 每个切片都必须运行该切片计划中的验证命令。
- 每个切片都必须独立提交。
- 不创建 generic runtime、generic service layer、generic IPC bridge 或 generic repository layer。
- 不显示 photo、video、file、film 或未来能力 UI。
- 不把 DB、TanStack Query 或 renderer state 当作用户内容真源。
- 不初始化 shadcn/ui，除非该切片同时落地 exact primitive、业务 consumer、共享 invariant 和测试。

## 下一步

执行归档实现计划中的 IMPL-001：Renderer 测试基础和 App 提取。

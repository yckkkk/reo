# 收口交接

## 状态

Reo 第一产品切片长任务已完成。设计加固、对齐实现计划、`$plan-eng-review`、TDD 实现、runtime QA、Codex CLI read-only validation 和最终验证均已通过。

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
12. `docs/archive/initiatives/2026-05-06-first-product-slice/README.md`
13. `docs/archive/initiatives/2026-05-06-first-product-slice/engineering-readiness.md`
14. `docs/archive/initiatives/2026-05-06-first-product-slice/plan.md`
15. `docs/archive/initiatives/2026-05-06-first-product-slice/tasks.md`
16. `docs/archive/specs/2026-05-06-0338-first-product-slice-design-hardening/`
17. `docs/archive/specs/2026-05-06-0452-first-product-slice-implementation-plan/plan.md`

归档 specs 和 archived initiative 是已完成阶段的证据；不要编辑归档文件。

## 进入后续工作前检查

- 使用 `$using-superpowers`。
- 运行 `git status --short`，确认没有未解释的 dirty worktree。
- 运行 `find docs/specs -mindepth 1 -maxdepth 1 -print`，必须为空。
- 以后续新目标创建新的 active spec 或 initiative，不继续复用已归档的 first product slice initiative。

## 保持的规则

- 行为改动继续执行真实 RED -> GREEN -> REFACTOR。
- 涉及 Electron、data、flow、frontend、quality 的改动继续更新对应 `docs/current/*`。
- 不创建 generic runtime、generic service layer、generic IPC bridge 或 generic repository layer。
- 不显示 photo、video、file、film 或未来能力 UI。
- 不把 DB、TanStack Query 或 renderer state 当作用户内容真源。
- 不初始化 shadcn/ui，除非该切片同时落地 exact primitive、业务 consumer、共享 invariant 和测试。

## 下一步

从新的产品目标开始；first product slice 不再是 active initiative。

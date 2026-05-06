# 新 session 交接

## 当前状态

当前任务是 Reo 第一产品切片的设计加固门禁，门禁已通过复审。

在满足以下条件前，不得实现代码、安装依赖或执行第 1 片：

1. `$writing-plans` 产出对齐后的实现计划。
2. `$plan-eng-review` 放行该计划。
3. `$executing-plans` 在要求的实现 workspace 中启动。

## 必读顺序

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
14. `docs/initiatives/2026-05-06-first-product-slice/next-session-handoff.md`
15. `docs/initiatives/2026-05-06-first-product-slice/plan.md`
16. `docs/initiatives/2026-05-06-first-product-slice/tasks.md`
17. 本 spec 目录。

Archived specs 只作为背景材料。禁止编辑 archived implementation plan。

## 门禁检查清单

- [x] 完成本 spec 的全部文件。
- [x] 完成 self-review。
- [x] 完成 subagent adversarial review。
- [x] 完成 Claude CLI 或 Codex CLI read-only adversarial review。
- [x] 修复全部 BLOCKER/MAJOR，或记录为什么该 finding 不成立。
- [x] 更新 active initiative 的下一步。
- [x] 将长期稳定结论压缩回 `docs/current/*` 或 `docs/decisions/*`。
- [ ] 运行最终验证命令。
- [ ] 提交 docs gate。

## 硬边界

- 不实现代码。
- 不安装依赖。
- 不初始化 shadcn。
- 不创建 generic runtime、generic service layer 或 generic IPC bridge。
- 不把 DB 作为用户内容真源。
- 不显示未来能力 UI。
- 不使用 emoji。
- 不让未完成 spec 只存在于 archive。

## 下一阶段

通过本 gate 后：

- 使用 `$writing-plans`。
- 按 Reo 文档生命周期保存 plan，不写入 `docs/superpowers/*`。
- `implementation-plan-reconciliation.md` 只能作为输入，不能当作可执行 plan。
- 随后使用 `$plan-eng-review`。
- 两者都通过后，才使用 `$executing-plans`。

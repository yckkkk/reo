# Next Session Handoff

## 目标

完成 first product slice 的 design-hardening gate。不要实现代码、不要安装依赖、不要执行 Slice 1。

## 读取顺序

1. `AGENTS.md`
2. `README.md`
3. `docs/README.md`
4. `docs/current/foundation.md`
5. `docs/current/architecture.md`
6. `docs/current/electron.md`
7. `docs/current/data.md`
8. `docs/current/flow.md`
9. `docs/current/frontend.md`
10. `docs/current/quality.md`
11. `docs/initiatives/2026-05-06-first-product-slice/README.md`
12. `docs/initiatives/2026-05-06-first-product-slice/engineering-readiness.md`
13. `docs/archive/specs/2026-05-06-0100-first-product-slice/spec.md`
14. `docs/archive/specs/2026-05-06-0116-first-product-slice-plan/plan.md`

## 参考素材

必须核对：

- `/Users/yck/Downloads/PM/设计参考/记忆录音/`
- `/private/tmp/reo-reference-frames/`

只吸收结构、层级、状态和 micro-interactions。视觉系统服从 Reo design system。

## 必须产出

创建：

```text
docs/specs/YYYY-MM-DD-HHMM-first-product-slice-design-hardening/
```

至少包含：

- `requirements.md`
- `ui-blueprint.md`
- `architecture-views.md`
- `data-contracts.md`
- `protocol-contracts.md`
- `state-machines.md`
- `qa-matrix.md`
- `foundation-decisions.md`
- `new-session-handoff.md`
- `review.md`
- `verification.md`

## 硬边界

- 不实现代码。
- 不安装依赖。
- 不进入 Renderer Test Foundation。
- 不创建 generic runtime、generic service layer、generic IPC bridge。
- 不显示未实现的 photo、video、file、film 能力。
- 不把 DB 当作用户内容真源。
- 不初始化 shadcn/ui，除非后续实现 slice 已证明真实 consumer。
- UI 不使用 emoji；icon-only controls 使用 lucide。

## 必须回答

- 哪些 foundation 在 first product slice 必须建立，为什么。
- 哪些 foundation 只需要 design decision，暂不建立，为什么。
- DB conceptual model 与 physical schema 的边界是什么。
- Workspace 文件结构如何支撑 Codex CLI 读取。
- 每个 IPC channel 的 request、response、error、timeout、cancellation 和 sender validation 是什么。
- Workspace、recording、autosave、playback、recovery 状态机是什么。
- 哪些测试是 RED/GREEN/REFACTOR，哪些是操作验证。
- 哪些操作验证必须使用 Computer Use。
- Reference assets 对照清单是什么。

## 完成条件

- design-hardening spec 通过自审。
- active initiative 更新下一步。
- 长期结论压缩回 `docs/current/*` 或本 initiative。
- `npm run verify:quick` 通过。
- `git diff --check` 通过。
- `diff -u AGENTS.md .claude/CLAUDE.md` 通过。
- 提交一个 docs commit。

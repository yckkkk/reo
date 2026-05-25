# Docs Truth Governance

Time: 2026-05-24 20:33 America/Los_Angeles

## Objective

把 Reo 的入口文档和 current 真源从任务级细节中瘦身出来。`AGENTS.md` / `.claude/CLAUDE.md` 保持短的规范入口；`docs/current/*` 只保留稳定模型、接口合同、安全边界、跨任务不变量和当前能力索引；任务内取舍、具体 UI 数值、测试枚举和一次性实现判断留在 spec 或 archive。

## Current Constraints

- `AGENTS.md` 与 `.claude/CLAUDE.md` 必须保持镜像。
- `docs/current/*` 仍是当前事实真源，不能删掉必要的产品能力、安全边界、数据真源、验证路径或用户可见恢复规则。
- 本次是文档治理改动，不改 runtime 行为。TDD 豁免，验证以镜像、格式、文档结构和 `npm run verify:quick` 为主。

## Success Criteria

- `AGENTS.md` 不再承载细粒度产品/实现决策，只保留启动阅读、协作规则、红线、TDD、文档生命周期和验证入口。
- `docs/README.md` 明确 current 收录门槛和不收录内容。
- `docs/current/*` 的变更门禁从“任何相关改动都必须更新本文档”改为“只有改变稳定模型、接口合同、安全边界、跨任务不变量或当前能力索引时才更新”。
- 明显 task/spec 级测试枚举、UI 微决策和重复路线声明从 current 层删除或压缩。
- 已完成 inline text editing spec 移入 `docs/archive/specs/*`，`docs/specs/*` 只保留本次 active spec。

## Verification Plan

- `cmp -s AGENTS.md .claude/CLAUDE.md`
- `find docs/specs -mindepth 1 -maxdepth 1 -type d -print`
- `git diff --check`
- `npm run format:check`
- `npm run verify:quick`

## Verification Evidence

- `cmp -s AGENTS.md .claude/CLAUDE.md` passed.
- `find docs/specs -mindepth 1 -maxdepth 1 -type d -print` showed only `docs/specs/2026-05-24-2033-docs-truth-governance` before archive.
- `git diff --check` passed.
- `npm run format:check` passed.
- First `npm run verify:quick` run passed typecheck and main tests, then hit one renderer component test failure in `App > opens the rich dev workspace scenario from the URL parameter`. Focused rerun of that exact test passed.
- Second `npm run verify:quick` passed: main tests 816 passed, renderer tests 512 passed across 50 files, `lint:strict` passed, and final `format:check` passed.

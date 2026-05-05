# Quality/Test 基础边界

创建时间：2026-05-05 10:11 America/Los_Angeles
状态：已完成

## 目的

冻结当前 Quality/Test 基础边界，让类型检查、main process 测试、lint、format 与 `verify:quick` 的职责清晰可验证。

## 当前 tradeoff

`docs/current/architecture.md` 的默认基础切片顺序是 Styling 在 Quality/Test 前。当前选择 Quality/Test，是因为项目已具备 TypeScript、ESLint、Prettier、Node test runner 和 `verify:quick`，可以用一个小 slice 固化质量门槛；Styling 不进入本 slice。

## 优先阅读

- `../../../../AGENTS.md`
- `../../../../README.md`
- `../../../README.md`
- `../../../current/foundation.md`
- `../../../current/architecture.md`
- `../../../current/quality.md`

## 产出

- 明确当前 quality gate 的职责边界。
- 核对 Node test runner、Vitest、ESLint 官方文档。
- 按需更新 `docs/current/quality.md`。
- 记录验证结果和独立审查意见。

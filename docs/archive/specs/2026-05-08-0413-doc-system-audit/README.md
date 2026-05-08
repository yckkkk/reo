# 文档系统审计

时间：2026-05-08 04:13 America/Los_Angeles

## 目标

检查 Reo 文档系统中是否存在旧事实、冲突事实、错误层级、空占位或不应进入当前阅读链的材料，并把确认的问题记录到 `error-record.md`。

## 范围

- `README.md`
- `docs/README.md`
- `docs/current/*`
- `docs/current/design-system/*`
- `docs/current/wireframes/*`
- `docs/decisions/*`
- `docs/initiatives/*`
- `docs/archive/*` 的结构位置

## TDD 豁免

本任务只修改文档和移除未跟踪系统元数据文件，不改变产品行为；TDD 不适用。

## 审计结论

- 当前阅读链、active initiative 索引、`docs/specs` 空状态和归档层级符合文档生命周期。
- 确认并修复 6 个问题，见 `error-record.md`。
- 归档材料保留为证据，不作为当前执行真源。

## 验证

- `npx prettier --check README.md docs/README.md docs/current docs/decisions docs/initiatives docs/specs/2026-05-08-0413-doc-system-audit` 通过。
- `git diff --check` 无输出。
- `AGENTS.md` 与 `.claude/CLAUDE.md` 字节级一致。

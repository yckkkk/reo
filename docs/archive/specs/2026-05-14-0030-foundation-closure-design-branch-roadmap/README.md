# 基础收口：设计分支合并与 roadmap 校准

时区：2026-05-14 00:30 America/Los_Angeles

## 工作意图

把 `feat/soft-flat-design-system` 分支收口回 `main`，并把唯一陈旧的当前真源 `docs/current/roadmap.md` 校准到已落定模型，让地基处于可验证稳定态。本工作单元只做收口和真源校准，不开新功能、不加新设计打磨。

## 背景

- `feat/soft-flat-design-system` 累积 15 个提交（领先本地 main 15、领先 origin/main 37），范围已超出分支名（含主题三态、edge-fade、titlebar chrome、segment card 等），长期未合并，属于失去闭环。
- `docs/current/roadmap.md` 是唯一仍携带 `草稿记忆空间`、`Guided Recall`、`Review 作为核心实体` 的当前文档；其余 7 个 current 真源已统一在 Workspace→Memory→Segment→SegmentAttachment 模型。

## 方案

1. 跑 `npm run verify:quick` 作为合并门禁。
2. 门禁通过后 fast-forward 合并 `feat/soft-flat-design-system` 回本地 `main`。
3. 校准 `docs/current/roadmap.md`：
   - P0 核心实体改为 Workspace、Memory、Segment、SegmentAttachment；移除 Guided Recall。
   - P1/P2 按实际实现重写：表达入口是 Loaded Workspace 底部 FAB，录音归属当前 Memory context；记忆空间管理由 AppShell sidebar 承担。
   - P3 右侧改为 MemoryRail；Memory Studio 范围对齐实际能力。
   - `草稿记忆空间` 从 P1/P2 移入「后续方向」，作为延期未来能力（Home 入口录制设计），当前不设计。
   - P4–P6 保留为未来阶段，只移除对已废弃概念的硬依赖。

## 执行清单

- [x] `verify:quick` 门禁通过（typecheck / test:main / test:renderer 257 / lint / format 全绿）
- [x] fast-forward 合并分支回 `main`（d9e39f4）
- [x] 校准 `docs/current/roadmap.md`
- [x] 收口：commit + spec 移入 `docs/archive/specs/`

## 豁免说明

roadmap 校准是纯文档真源对齐，无行为代码改动，按项目规则豁免 TDD。合并的设计分支自身已携带 RED/GREEN 证据并通过 `verify:quick`。

## 验证证据

- 合并门禁 `verify:quick`：exit 0，renderer 257 测试通过，main 测试通过，lint/format 干净。
- 合并：`c2b8a65..d9e39f4` fast-forward，192 文件，工作区干净。
- roadmap 校准后 `verify:quick`：exit 0，lint/format 全绿，typecheck/test 范围未受纯文档改动影响。

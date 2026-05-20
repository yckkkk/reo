# Plan

## Phase 1 RED

- 为 Markdown object contract 增加 `note` kind 行为测试。
- 为 durable manifest / projection / Memory summary contract 增加 note 行为测试。
- 运行聚焦测试并确认失败。

## Phase 2 GREEN

- 扩展 shared kind schema。
- 扩展 manifest schema 与 projection discriminated union。
- 扩展 Memory summary 派生字段。
- 保持 audio 路径既有行为。

## Phase 3 REFACTOR + Docs

- 清理命名中不再准确的 audio-only helper。
- 更新 `docs/current/data.md`。
- 跑 `npm run verify:quick`。
- 通过 `/review` 与 `$ycksimplify` gate 后归档。

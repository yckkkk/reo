# Note multi-kind contract

- 时间：2026-05-19 02:55 America/Los_Angeles
- 类型：implementation sub-spec
- 关联 initiative：`docs/initiatives/2026-05-19-note-foundation/`
- 关联设计 spec：`docs/archive/specs/2026-05-19-0111-note-foundation-design/`

## Objective

交付 Reo Note Foundation sub-spec (a)：把当前 audio-only Segment /
SegmentSupplement contract 扩展为 `audio` 与 `note` 两种实体类型，并保持
Markdown/frontmatter 作为语义真源。

## Scope

- `segment.md` 与 `supplement.md` frontmatter 接受 `kind: audio | note`。
- Segment 与 SegmentSupplement manifest 支持 `kind: audio | note`。
- note manifest 使用 `bodyByteLength` 表达 Markdown body 字节数；audio manifest 继续使用
  `audioByteLength`、`durationMs` 与转录状态。
- Projection 与 renderer contract 用 kind/type 区分 audio 与 note。
- Memory summary 保留总数，并补充 audio/note 分项与转录语义命名。
- `docs/current/data.md` 压缩当前事实。

## Out of Scope

- 不实现 NoteEditorOverlay。
- 不启用 FAB。
- 不引入 attachment protocol。
- 不处理 external edit conflict。
- 不选择最终 rich editor；spike 证据显示 sub-spec (b) 前仍需 editor 决策。

## Success Criteria

- RED 阶段测试先失败，并能证明当前 runtime 仍是 audio-only。
- GREEN 阶段最小实现让新增 contract 测试通过。
- REFACTOR 阶段 `npm run verify:quick` green。
- Phase gate 完成：`verify:quick` green、`/review` pass、`$ycksimplify` pass。

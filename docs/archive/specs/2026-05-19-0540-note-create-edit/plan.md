# Note Create / Edit Plan

## Phase 1：RED editor gate + note runtime contract tests

- 固化 markdown fixture suite（≥20 个样本）与 adapter decision 证据。
- 先跑 RED，证明当前没有可接受的 third-party editor round-trip decision。
- 为 note Segment / Supplement draft create/write/finalize 与 content read/write 写 main 行为测试。
- 为 renderer note overlay entry、surface outcome、lazy draft、dirty close confirm 和 retry
  写 renderer 行为测试。
- Phase gate：`npm run verify:quick` 预期在 RED 阶段之前只用于基线；RED 命令必须真实失败并记录。

## Phase 2：GREEN minimal implementation

- 收口 editor decision：若 BlockNote / Milkdown 均未通过 round-trip gate，则采用更窄的
  markdown-first textarea；不显示 mode badge，不展示未实现 toolbar。
- 实现 note draft 与 content IPC。
- 实现 `NoteEditorOverlay` 与 `MarkdownContentSurface` 最小可用路径。
- 启用 FAB note action 与 selected Segment note supplement action。
- 实现 Memory Studio note kind dispatch。
- 跑 focused tests 与 `npm run verify:quick`。
- Phase gate：`npm run verify:quick` green + `/review` PASS + `$ycksimplify` PASS。

## Phase 3：REFACTOR + docs/current + 操作验证

- 清理重复的 audio/note content projection helper。
- 压缩 renderer 状态，避免新增 Zustand store。
- 更新 `docs/current/electron.md`、`frontend.md`、`flow.md`、`product.md`、
  `roadmap.md`、`quality.md`。
- 做本地操作验证：create note、edit note、dirty discard、note Supplement、tab rail / content
  surface / More menu 运行时布局；finalize retry 通过 focused failure-injection renderer test 验证。
- 跑 `npm run verify:quick`。
- Phase gate：`npm run verify:quick` green + `/review` PASS + `$ycksimplify` PASS。

## Archive

Phase 3 gate 全部通过后，把本 spec 移入
`docs/archive/specs/2026-05-19-0540-note-create-edit/`，再进入 sub-spec (c)。

# Tab Rail More Menu 修复

## Objective

修复 Memory Studio content tab rail 上 `转录`、`正文` 和 SegmentSupplement tab 的 More 菜单触发问题。

## Scope

- `src/renderer/src/workspace/MemoryStudio.tsx`
- `src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`

## Requirements

- More 按钮必须复用现有 tab rail 设计，不新增页面或独立 UI。
- Primary tab（`转录` / `正文`）和 SegmentSupplement tab 的 More 按钮必须都能打开现有实体菜单。
- More 按钮位于 draggable tab item 内时，pointer / mouse / click / drag 事件不得冒泡触发 tab drag / select。
- More 菜单功能继续复用现有 entity action menu：默认应用打开、访达显示、复制相对路径、复制绝对路径、重命名、删除；audio tab 保留转录生成 / 重新生成。
- 修复必须对照 `docs/archive/specs/2026-05-19-0111-note-foundation-design/` 原始设计约束：Memory Studio 复用、通用 tab rail、Markdown-first 真源、不重做页面。

## Verification

- RED：新增行为测试先失败，证明 More 按钮事件未隔离。
- GREEN：实现最小事件隔离后，focused renderer tests 通过。
- REFACTOR：运行 `npm run verify:quick`，再做独立 `/review` 与 `$ycksimplify` gate。

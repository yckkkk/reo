# Note Create / Edit Sub-spec

## 状态

- 状态：archived
- 创建时间：2026-05-19 05:40 America/Los_Angeles
- Initiative：`docs/initiatives/2026-05-19-note-foundation/`
- 上游设计：`docs/archive/specs/2026-05-19-0111-note-foundation-design/`
- 前置 sub-spec：`docs/archive/specs/2026-05-19-0255-note-multikind-contract/`

## Objective

交付 Note Foundation sub-spec (b)：在已完成的 multi-kind contract 上实现 note Segment /
SegmentSupplement create/edit、`NoteEditorOverlay`、`MarkdownContentSurface` 与 FAB note
入口。

## 当前硬约束

- Markdown body 与 frontmatter 是语义真源；editor JSON 不能成为真源。
- Spike #2 已证明 BlockNote 0.51.1 与 Milkdown 7.21.1 都未通过原始 normal subset
  100% round-trip gate；本 sub-spec 代码实现前必须先收口 editor decision。
- 不引入 `@blocknote/shadcn`。
- 不放松 Electron sandbox、contextIsolation、nodeIntegration、webSecurity、CSP、permission
  或 navigation 安全基线。
- 不引入 file watcher、SQLite、Sentry、Better Auth、移动端、多窗口、云同步或 generic
  runtime。
- 本 sub-spec 不实现 attachments 与 `reo-attachment://`；相关实现留给 sub-spec (c)。
- 本 sub-spec 不实现 external edit conflict；`baselineContentHash` 写入 / stale compare 留给
  sub-spec (d)，但 edit flow 的接口命名不能阻塞该扩展。

## Scope

- Editor decision：基于 ≥20 fixtures 的 markdown round-trip gate，确定当前不接入
  BlockNote / Milkdown，并使用 Reo-owned markdown-first textarea 作为本 sub-spec 的可交付编辑面。
- Note body content contract：content read/write、draft create/write/finalize 所需 IPC 与 Zod schema。
- Note Segment create flow：FAB note action → overlay → save-time lazy draft → finalize。
- Note SegmentSupplement create flow：selected Segment `+` 菜单 → overlay → save-time lazy draft → finalize。
- Note edit flow：`MarkdownContentSurface` expand → overlay → write body。
- `NoteEditorOverlay`：loading、dirty close confirm、submitting、draft retry 与 finalized
  body edit 基础状态。
- `MarkdownContentSurface`：audio transcript outcome 与 note body outcome 共用容器。
- Memory Studio per-kind dispatch：note selected state、note card preview、note supplement tab icon。
- docs/current 更新：`electron.md`、`frontend.md`、`flow.md`、`product.md`、`roadmap.md`、`quality.md`。

## Acceptance

- AC-ROUNDTRIP：≥20 markdown fixtures 证明当前 BlockNote / Milkdown 不满足
  markdown-first round-trip gate，本 sub-spec 不把 editor JSON 作为语义真源。
- AC-FAB：已选 Memory 时 FAB note action 可创建 note Segment draft 并进入 overlay。
- AC-PLUS-NOTE：selected Segment 下可创建 note Supplement draft 并进入 overlay。
- AC-MS-NOTE / AC-MS-EMPTY / AC-MS-LOAD-FAIL：Memory Studio 能渲染 note body outcome。
- AC-OE-LOAD / AC-OE-DRAFT / AC-OE-SUBMIT / AC-OE-CLOSE / AC-OE-EXPAND /
  AC-OE-BLOCK：overlay 关键状态通过 main / renderer 行为测试。创建页关闭前不创建
  draft；dirty close 必须二次确认；body write 成功但 finalize 失败时保留同一 draft revision
  供用户重试。
- AC-CARD-NOTE / AC-TAB-NOTE / AC-MENU-NOTE：note kind 的列表、tab、菜单不再走 audio
  视觉或转录动作。
- `npm run verify:quick` green。
- 每个 phase 都有独立 `/review` PASS 与 `$ycksimplify` PASS。

## Evidence

- `implementation-notes.md`
- RED/GREEN 命令输出记录在 `implementation-notes.md`
- 操作验证证据按需写入 `evidence/`

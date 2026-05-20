# Note Attachments + `reo-attachment://` Protocol

- 时间：2026-05-19 13:05 America/Los_Angeles
- 类型：implementation sub-spec (c)
- 关联 initiative：`docs/initiatives/2026-05-19-note-foundation/`
- 设计约束：`docs/archive/specs/2026-05-19-0111-note-foundation-design/`
- 上游 sub-spec：
  `docs/archive/specs/2026-05-19-0255-note-multikind-contract/`、
  `docs/archive/specs/2026-05-19-0540-note-create-edit/`

## Objective

为 note Segment 和 note SegmentSupplement 交付本地附件基础：renderer 通过显式 workspace IPC
保存 / 列出 attachment，Markdown 正文只写 `attachments/<filename>` 相对引用，生产 renderer 通过
`reo-attachment://` 自定义协议加载图片，且不暴露 raw path、不放松 Electron 安全基线。

## Scope

- `saveSegmentAttachment` / `listSegmentAttachments` IPC。
- `saveSegmentSupplementAttachment` / `listSegmentSupplementAttachments` IPC。
- Segment 与 SegmentSupplement 各自拥有独立 `attachments/` 目录；该目录不进入对象图，不写 manifest。
- 文件名使用 content hash 前缀 + safe basename；同内容重复保存返回稳定 relative path。
- 只允许受支持图片 MIME / extension 作为当前保存入口；其它附件类型不在本 sub-spec。
- Markdown-first 插入：`NoteEditorOverlay` textarea 当前光标插入 `![alt](attachments/<filename>)`。
- `MarkdownContentSurface` 和 overlay preview 将 Markdown 中的 `attachments/...` image 引用映射为
  `reo-attachment://<workspaceId>/segments/<segmentId>/<filename>` 或
  `reo-attachment://<workspaceId>/segments/<segmentId>/supplements/<supplementId>/<filename>`。
- `reo-attachment://` privileged scheme 与 handler 在 main process 注册；生产 CSP `img-src` 增加
  `reo-attachment:`，不新增 `connect-src reo-attachment:`。
- Runtime validation 覆盖 `<img>` load、wrong workspace、traversal、symlink leaf、non-GET、navigation deny、
  window-open deny 和 CSP header。

## Non-Goals

- 不实现 BlockNote / Milkdown paste flow 或 image block。
- 不引入 renderer JS `fetch(reo-attachment://...)` 主路径。
- 不实现附件 GC、文件 watcher、云同步、多窗口同步、SQLite、Sentry、Better Auth 或移动端。
- 不允许 `reo-attachment://` 打开任意文件，不在 URL / DOM / logs / responses 中编码 raw path。
- 不把 `attachments/` 识别为 Segment、SegmentSupplement 或独立 Reo 对象。

## Acceptance Criteria

- AC-ATTACH-SAVE：保存 note Segment image attachment 会在该 Segment 目录下按需创建 `attachments/`，
  no-follow 写入文件，返回 `relativePath: attachments/<stable-name>`，不返回 absolute path。
- AC-ATTACH-SUPPLEMENT：保存 note SegmentSupplement image attachment 会写入该 supplement 自己的
  `attachments/`，不共享父 Segment attachments。
- AC-ATTACH-LIST：list 返回 `{ relativePath, byteLength, mimeType }[]`，拒绝 symlink / non-file leaf，
  且不泄露 absolute path。
- AC-ATTACH-VALIDATION：unsupported MIME、过大 payload、path traversal、symlinked attachments dir 或 leaf、
  wrong workspace / parent ownership 都返回 typed error envelope。
- AC-MARKDOWN-INSERT：Note editor 的 attachment action 会在 textarea 光标处插入
  `![alt](attachments/<stable-name>)`，保存后 markdown truth 保留该相对引用。
- AC-PREVIEW-MAP：note body preview / edit preview 将受支持的 relative attachment image src 映射到
  `reo-attachment://`；remote / file / raw absolute image src 不被映射。
- AC-PROTOCOL-REGISTER：`reo-attachment` 与 `reo-app` privileged schemes 在 app ready 前统一注册；
  handler 在 ready 后注册，不使用 `file://` 或 renderer raw path。
- AC-PROTOCOL-SERVE：`GET reo-attachment://<workspaceId>/segments/<segmentId>/<filename>` 和 supplement
  variant 在 active workspace handle 内返回图片 bytes、正确 content type 和 `Cache-Control: no-store`。
- AC-PROTOCOL-DENY：wrong host、malformed path、traversal、unsupported extension、missing active workspace、
  symlink leaf 和 non-GET 不返回文件内容或 path。
- AC-CSP：生产 CSP `img-src` 保留 `blob:` 并允许 `reo-attachment:`；`media-src` 仍只允许 `'self' blob:`；
  不新增 `unsafe-inline` / `unsafe-eval`。
- AC-NAV：`reo-attachment://` top-level navigation 和 window open 继续被拒绝。
- AC-VERIFY：每个 phase 满足 `npm run verify:quick`、独立 `/review` PASS、独立 `$ycksimplify` PASS。

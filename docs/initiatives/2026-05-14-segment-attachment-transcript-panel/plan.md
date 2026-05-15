# SegmentAttachment 转录面板计划

## 文件真源

Audio SegmentAttachment 的转录文本属于该 attachment 自己的 `transcript.md`，不属于 parent Segment 的 `transcript.md`。

## 数据与 IPC

- 扩展 finalized SegmentAttachment content read response，返回 transcript presence 和文本。
- Request 继续显式携带 `workspaceHandle`、`workspaceId`、`memoryId`、`segmentId`、`attachmentId` 和 requestId。
- Response 不返回 root path、file path、selection token 或 handle internals。
- Main 侧继续校验 trusted sender、session、handle owner、request workspaceId、lock usability、parent Segment directory identity、attachment metadata ownership 和 audio byte length。

## Renderer

- 仍在当前 attachment tab panel 内实现，不新增第二层 tab 或通用 runtime。
- 播放组件保持在 panel 顶部；转录区出现在播放组件下方。
- 转录区只消费真实 transcript 文本；空 transcript 显示克制空态。
- 切换 attachment、selected Segment、Memory 或 workspace handle 时，audio resource cache 与 transcript projection 都必须按现有 Query/session 边界收敛。

## 验证

- Main tests 覆盖 transcript read、缺失 transcript、unsafe transcript leaf、parent/attachment identity mismatch 和 no raw path response。
- Renderer tests 覆盖播放组件下方 transcript、空态、加载失败、不混用 parent Segment transcript、切换 attachment 后只显示当前 attachment transcript。
- 运行时视觉验证覆盖真实 attachment panel 中播放组件与 transcript 区的相对位置。

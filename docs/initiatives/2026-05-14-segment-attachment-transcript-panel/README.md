# SegmentAttachment 转录面板长期任务

## 状态

- 状态：active
- 类型：产品或代码开发 initiative
- 当前阶段：等待下一个 spec 执行

## 目标

在 audio SegmentAttachment 内容 panel 的播放组件下方显示该补充录音自己的转录区。

## 当前边界

- 当前已完成 SegmentAttachment 内容 tab、重命名、删除和恢复基础能力。
- 当前 finalized audio SegmentAttachment panel 只读取和展示 audio bytes，不读取 transcript 文本。
- 当前 durable SegmentAttachment 已有 `transcript.md` 文件位置和 transcript presence 投影，但 renderer attachment content IPC 不返回 transcript 文本。

## 非目标

- 不创建 note、photo、video 或 imported file 的假 schema、假 IPC 或假持久化分支。
- 不把 parent Segment transcript 混入 attachment transcript。
- 不创建通用 tab runtime、通用 media runtime 或通用 transcript editor。
- 不在没有文件合同和测试前提供本地 mock transcript。

## 完成条件

- Main / IPC / preload / renderer 都能按 `workspaceHandle + workspaceId + memoryId + segmentId + attachmentId` 读取 finalized audio SegmentAttachment 的 transcript 文本。
- Renderer 在对应 attachment audio player 下方显示真实 transcript，空态和加载失败状态可见。
- Attachment transcript 与 parent Segment transcript 的文件真源、Query cache 和 UI projection 清楚分离。
- `docs/current/data.md`、`flow.md`、`electron.md`、`frontend.md`、`quality.md` 和 `product.md` 写入当前事实。
- 对应 spec 完成 RED / GREEN / REFACTOR、运行时视觉验证、subagent 审查和 `npm run verify:quick`。

## 读取入口

- `plan.md`
- `tasks.md`

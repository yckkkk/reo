# SegmentAttachment 播放、转录保存与 tab 拖拽

- 时间：2026-05-14 21:13 America/Los_Angeles
- 状态：代码与验证已收口；既有 0 byte transcript 无真实文本源，不伪造回填

## 目标

- 修复 finalized audio SegmentAttachment 在目录名为 `<attachmentId>--<title>` 时内容读取失败的问题。
- 补充录音完成后，把真实 ASR transcript markdown 保存到该 attachment 自己的 `transcript.md`。
- 目前不在 attachment panel 展示 transcript 文本。
- 实现内容 tab rail 的拖拽重排，转录 tab 和 attachment tab 都可参与；当前按 renderer session-local UI state 处理，不新增假 schema、假 IPC 或未验证持久化顺序。拖拽只接受 Reo 内部 tab drag MIME，按同一 segment 的 tab 身份重排，`dragenter` 不直接改 DOM，`dragover` 以目标 tab 中点计算 before/after 插入位置；同一次拖拽可连续在同一目标前后换位，不用屏蔽 target 的补丁状态。拖拽期间 attachment action reveal 与 pointer hover 解耦：source attachment 可保持展开态，其他被交换或经过的 tab 不因 drag hover 展开 More。

## 官方与开源依据

- Context7 `/websites/dndkit`：sortable list 的推荐模型是唯一 id、index、drag end 后移动数组；适合未来持久顺序合同。当前 Reo 只需要一个 feature-local content tab rail 交互，且没有 durable order contract，本 slice 不引入新依赖，采用 demo 同类的 native drag/drop 事件并把状态限制在 Memory Studio owner 内。

## 根因记录

- Attachment audio read 当前按 `attachments/<attachmentId>` 直读，不能定位 Reo 写出的 `<attachmentId>--<title>` 文件空间节点。
- SegmentAttachment finalize 只创建空 `transcript.md`，没有调用 attachment-scoped transcript save；普通 Segment 的 `workspace:saveTranscript` 只接受 `memoryId + segmentId`，不能写 attachment transcript。
- 真实测试工作区中既有 `att_20260515040340_63858a13--补充录音1/transcript.md` 为 0 byte；在工作区文件和 Reo app state 内未找到该次 ASR 文本副本。本 slice 不伪造历史转录文本，只保证后续 finalized SegmentAttachment 和 recovery retry 会把真实 transcript markdown 写入 attachment `transcript.md`。

## TDD 清单

- [x] RED：main 读取 `<attachmentId>--<title>` attachment audio 失败。
- [x] GREEN：复用文件空间节点定位读取 audio。
- [x] RED：补充录音 finalize 后有 transcript markdown 时必须保存到 attachment `transcript.md`。
- [x] GREEN：新增 attachment transcript 保存能力并接入 finalize/recovery。
- [x] RED：renderer 内容 tab rail 支持转录 tab 与 attachment tab 拖拽改变顺序。
- [x] GREEN：feature-local tab order state + native drag/drop。
- [x] REFACTOR：消除重复 helper，保持 Memory Studio 边界清楚。
- [x] 更新 current 真源。
- [x] 运行时验证。
- [x] subagent 审查和 `npm run verify:quick`。

## 验证证据

- RED：`npm run test:main -- --test-name-pattern "renamed attachment file-space"` 失败于 `readFinalizedAudioSegmentAttachment reads renamed attachment file-space nodes`，`result.ok` 为 false。
- GREEN：`npm run test:main -- --test-name-pattern "saveSegmentAttachmentTranscript|readFinalizedAudioSegmentAttachment reads renamed|workspace preload bridge exposes|explicit chooseDirectory channel"` 通过，392 tests pass。
- RED：`npm run test:renderer -- --run src/renderer/src/workspace/RecordingOverlay.test.tsx -t "saves segment attachment recording"` 失败，`saveSegmentAttachmentTranscript` 调用次数为 0。
- GREEN：同命令通过。
- RED：`npm run test:renderer -- --run src/renderer/src/App.test.tsx -t "recovers an unfinished SegmentAttachment"` 失败，恢复保存未调用 `saveSegmentAttachmentTranscript`。
- GREEN：同命令通过。
- RED：`npm run test:renderer -- --run src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "reorders transcript"` 失败，tab 顺序仍为 `转录 / 补充录音 / 现场补充`。
- GREEN：同命令通过，覆盖补充 tab 拖到 `转录` 前、`dragenter` 不立即改序、source attachment More 保持展开、被经过的 attachment tab 不展开 More、同一次拖拽继续跨过 `转录` 中点移到其后、再移回其前，以及 `转录` tab 拖回补充 tab 前。
- 回归：`npm run test:renderer -- --run src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "reorders transcript|does not keep"` 通过，2 tests pass，覆盖 DnD 稳定性与 active 后 More 不进入隐藏 tab order。
- 相关 renderer 套件：`npm run test:renderer -- --run src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/workspaceApi.test.ts` 通过，187 tests pass。
- 运行时：用临时 Electron userData 打开真实测试工作区 `生活记呀啊`，点击 `补充录音1` 后页面不再包含 `补充录音加载失败`，出现 `播放补充录音 补充录音1` 和 `00:00 / 00:04`；截图保存到 `/tmp/reo-runtime-attachment-fixed.png`。
- 运行时：同一窗口通过 native drag/drop 事件把 `补充录音1` 拖到 `转录` 前，tab 顺序从 `转录 / 补充录音2 / 补充录音1` 变为 `补充录音1 / 转录 / 补充录音2`；再拖动 `转录` 到 `补充录音2` 后，顺序变为 `补充录音1 / 补充录音2 / 转录`；截图保存到 `/tmp/reo-runtime-tab-dnd.png`。
- 运行时：修正 DnD 中点闪烁后，同一真实窗口验证 `dragenter` 不改序，`dragover` 后顺序从 `转录 / 补充录音2 / 补充录音1` 变为 `补充录音1 / 转录 / 补充录音2`，重复进入同一 `转录` target 后仍保持 `补充录音1 / 转录 / 补充录音2`；截图保存到 `/tmp/reo-runtime-tab-dnd-stable.png`。
- Subagent：只读复审确认 renamed attachment 读取、SegmentAttachment transcript 保存、内部 DnD MIME + segment 校验、More hidden tab order 均无新 blocker；残余风险是既有空 `transcript.md` 没有真实 ASR 文本源时不能回填。
- 全量门禁：`npm run verify:quick` 通过；typecheck、main tests 392 pass、renderer tests 294 pass、lint、format:check 全绿。

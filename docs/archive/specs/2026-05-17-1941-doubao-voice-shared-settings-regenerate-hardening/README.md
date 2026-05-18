# 豆包语音共享设置与重新生成转录收口

创建时间：2026-05-17 19:41 America/Los_Angeles

## 背景

豆包语音手动重新生成转录已经进入归档，但交付复核发现两个当前事实没有完整表达：设置页仍把 X-Api-Key 描述为只服务流式语音识别；队列取消语义在写入已经提交后仍可能把成功结果改报为 canceled。最新产品要求明确：豆包流式语音识别模型 2.0 与录音文件极速版识别共用同一个应用级 X-Api-Key；用户点击「重新生成」后弹窗必须立即退出，前端显示乐观运行态，后端继续执行，不阻塞用户。

## 当前目标

修复共享 X-Api-Key 设置体验、重新生成转录的后端取消竞态和文档真源，使用户在设置页、菜单、弹窗、运行态、失败态和保存结果中看到一致的产品语义，并通过真实 Electron runtime E2E、自动化测试、安全扫描和 100% confidence loop 后归档。

## 范围

- 设置页「语音」面板 copy、可访问名称、helper、清除确认文案必须表达同一 X-Api-Key 同时用于录音实时转写和录音文件转录/重新生成。
- `BackfillQueue` 必须保留已经提交且带 response 的成功结果，不能在后续 cancel 信号到达时把已写入文件真源的结果改报 canceled。
- `docs/current/*` 必须同步当前行为，不能继续让工程师误解为只有流式语音识别。
- 新增验证证据必须覆盖设置页真实保存 key 后的 UI、Segment/Supplement regenerate 弹窗立即关闭与 optimistic running、敏感信息不泄露。

## 非目标

- 不新增 IPC channel、main-to-renderer event channel、TanStack Query key、Zustand store 或 manifest 字段。
- 不拆分流式识别与文件识别为两个 key 或两个设置项。
- 不改变 Electron sandbox、contextIsolation、nodeIntegration、CSP、permission 或 navigation 基线。
- 不在 renderer 暴露 raw path、audio bytes、base64、ffmpeg path、digest、X-Api-Key 明文或密文。

## 实施 session 偏离记录

- 本 spec 是对已归档 D 的交付补强，不重开旧 spec；旧 D 归档记录保持历史证据，新 spec 只承载当前补齐目标。

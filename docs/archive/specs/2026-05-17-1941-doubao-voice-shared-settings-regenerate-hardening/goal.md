# Goal

按最新产品意图完成豆包语音共享设置与手动重新生成转录收口：同一个 X-Api-Key 同时服务豆包流式语音识别模型 2.0 与录音文件极速版识别；设置页必须完整表达共享 key、保存/验证/清除状态；点击「重新生成」后 AlertDialog 立即关闭，renderer 展示乐观 running，后端继续处理；已提交写入的 regenerate 成功结果不得被后续 cancel 改报 canceled。全程不新增未授权 surface，不放松 Electron 安全基线，通过自动化、真实 Electron E2E、敏感信息扫描和 100% confidence loop 后归档并 commit。

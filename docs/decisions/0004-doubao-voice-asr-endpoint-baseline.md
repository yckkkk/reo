# 0004 豆包流式语音识别 endpoint 基线

## 决策

Reo 直播录音转写使用火山引擎豆包大模型流式语音识别 SeedASR 2.0：

- WebSocket endpoint：`wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async`
- `X-Api-Resource-Id`：`volc.seedasr.sauc.duration`
- Full request `model_name`：`bigmodel`
- 鉴权：单 `X-Api-Key` header + `X-Api-Connect-Id` + `X-Api-Resource-Id`
- 计费：按音频时长（`.duration`），不依赖并发包月

凭证由用户自带（BYOK），用 Electron `safeStorage` 加密写入 `userData/voice-transcription-settings.json`；保存时执行最小 full-request 握手 probe（不发音频）做凭证验证。

## 理由

- SeedASR 是火山引擎当前推荐的下一代大模型流式 ASR（2.0），相对 BigASR (1.0) 是新版本路径
- `bigmodel_async` endpoint 与 SeedASR 2.0 严格配对；BigASR 1.0 对应 `bigmodel`
- 单 `X-Api-Key` header 是新版控制台标准鉴权；旧版双 `X-Api-App-Key` + `X-Api-Access-Key` 路径不在本基线
- `.duration` 计费模型按发送的音频时长累计，不锁并发实例，适合 BYOK 用户按实际录音量付费
- Probe 行为在 duration 计费模型下推断不触发计费（按 0 秒音频时长）

## 不在本 ADR 范围

- 离线 / 批处理 ASR endpoint 的选型（C 后台补转录的引擎合同 C0 单独决策）
- 后台任务并发上限（C0 单独决策）
- B / C / D 的实现

## 反对意见

- 火山官方文档站点是 JS-rendered SPA，本次调研未能直接抓取官方原文逐字引用；endpoint 与 resource id 配对关系由多个独立第三方实现 + 中文博客示例 + 火山官方 SDK Go 包交叉验证得出
- Probe 是否计费没有官方直接证据；按"按时长计 + 0 秒 = 0 费用"逻辑推断不计费；生产监控后若发现 probe 计费，可后续切换到更轻的握手策略

## 关联文档

- `docs/current/electron.md` 关于豆包流式语音识别 endpoint 与鉴权的当前事实段落
- `docs/archive/specs/2026-05-16-1720-doubao-voice-endpoint-billing-audit/` 调研证据
- `docs/archive/initiatives/2026-05-16-doubao-voice-followups/` 豆包语音后续工作记录
